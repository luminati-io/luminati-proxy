#!/usr/bin/env node
// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/
const Manager = require('../lib/manager.js');
const file = require('../util/file.js');
const etask = require('../util/etask.js');
const zerr = require('../util/zerr.js');
const lpm_util = require('../util/lpm_util.js');
const perr = require('../lib/perr.js');
perr.run({});
const _ = require('lodash');
const E = module.exports = {};
const shutdown_timeout = 3000;
const child_process = require('child_process');
const os = require('os');
const fs = require('fs');
const path = require('path');
const logger = require('../lib/logger.js').child({category: 'lum_node'});
const pm2 = require('pm2');
const lpm_config = require('../util/lpm_config.js');

const perr_info = info=>Object.assign({}, info, {
    customer: _.get(E.manager, '_defaults.customer'),
});

E.shutdown = (reason, error=null)=>{
    if (E.shutdowning)
        return;
    E.shutdowning = true;
    E.shutdown_timeout = setTimeout(()=>{
        if (!E.shutdowning)
            return;
        logger.error('Forcing exit after 3 sec');
        E.uninit();
        process.exit(1);
    }, shutdown_timeout);
    if (E.manager)
    {
        E.manager.stop(reason, true);
        E.manager = null;
    }
    if (error)
        logger.error(`Shutdown, reason is ${reason}: ${zerr.e2s(error)}`);
    else
        logger.notice(`Shutdown, reason is ${reason}`);
};

E.handle_signal = (sig, err)=>{
    const errstr = sig+(err ? ', error = '+zerr.e2s(err) : '');
    if (err && sig!='SIGINT' && sig!='SIGTERM')
        logger.error(errstr);
    etask(function*handle_signal_lum_node(){
        if (sig!='SIGINT' && sig!='SIGTERM')
        {
            yield zerr.perr('crash', perr_info({error: errstr, reason: sig}));
            return E.shutdown(errstr, err);
        }
        return E.shutdown(errstr);
    });
};

const add_alias_for_whitelist_ips = ()=>{
    const func =
        `curl_add_ip(){\n`+
        `    ENDPOINT="http://127.0.0.1:22999/api/add_whitelist_ip"\n`+
        `    DATA="ip="$1\n`+
        `    curl $ENDPOINT -X POST -d $DATA\n`+
        `}`;
    const name = 'lpm_whitelist_ip';
    const cmd = 'curl_add_ip';
    const bashrc_path = os.homedir()+'/.bashrc';
    let bashrc;
    try { bashrc = file.read_e(bashrc_path); }
    catch(e){
        logger.notice(`.bashrc not found! alias for whitelisting failed`);
        return;
    }
    if (/lpm_whitelist_ip/.test(bashrc)||/curl_add_ip/.test(bashrc))
        return;
    logger.notice(`installing ${name}`);
    try {
        const alias = `alias ${name}='${cmd}'`;
        file.append_e(bashrc_path, func+'\n'+alias);
        child_process.execSync(func);
        child_process.execSync(alias);
    } catch(e){ logger.warn(`Failed to install ${name}: ${e.message}`); }
};

E.start_daemon = ()=>{
    E.uninit();
    return etask(function*start_daemon(){
        this.on('uncaught', e=>{
            logger.error('PM2: Uncaught exception: '+zerr.e2s(e));
        });
        this.on('finally', ()=>pm2.disconnect());
        const script = path.resolve(__dirname, 'index.js');
        logger.notice('Running in daemon: %s', script);
        const daemon_start_opt = {
            name: lpm_config.daemon_name,
            script,
            mergeLogs: false,
            output: '/dev/null',
            error: '/dev/null',
            autorestart: true,
            killTimeout: 5000,
            restartDelay: 5000,
            args: process.argv.filter(arg=>arg!='-d'&&!arg.includes('daemon')),
        };
        yield etask.nfn_apply(pm2, '.connect', []);
        yield etask.nfn_apply(pm2, '.start', [daemon_start_opt]);
        const bus = yield etask.nfn_apply(pm2, '.launchBus', []);
        bus.on('log:out', data=>{
            if (data.process.name!=lpm_config.daemon_name)
                return;
            process.stdout.write(data.data);
            if (data.data.includes('Open admin browser') ||
                data.data.includes('Shutdown'))
            {
                this.continue();
            }
        });
        yield this.wait();
    });
};

E.is_daemon_running = list=>{
    const daemon = list.find(p=>p.name==lpm_config.daemon_name);
    return !!daemon &&
        ['online', 'launching'].includes(daemon.pm2_env.status);
};

E.stop_daemon = ()=>{
    E.uninit();
    return etask(function*stop_daemon(){
        this.on('uncaught', e=>{
            logger.error('PM2: Uncaught exception: '+zerr.e2s(e));
        });
        this.on('finally', ()=>pm2.disconnect());
        yield etask.nfn_apply(pm2, '.connect', []);
        const pm2_list = yield etask.nfn_apply(pm2, '.list', []);
        if (!E.is_daemon_running(pm2_list))
            return logger.notice('There is no running LPM daemon process');
        const bus = yield etask.nfn_apply(pm2, '.launchBus', []);
        let start_logging;
        bus.on('log:out', data=>{
            if (data.process.name!=lpm_config.daemon_name)
                return;
            start_logging = start_logging||data.data.includes('Shutdown');
            if (!start_logging || !data.data.includes('NOTICE'))
                return;
            process.stdout.write(data.data);
        });
        bus.on('process:event', data=>{
            if (data.process.name==lpm_config.daemon_name &&
                ['delete', 'stop'].includes(data.event))
            {
                this.continue();
            }
        });
        yield etask.nfn_apply(pm2, '.stop', [lpm_config.daemon_name]);
        yield this.wait();
    });
};

E.run = (argv, run_config)=>{
    if (argv.daemon_opt.start)
        return E.start_daemon();
    if (argv.daemon_opt.stop)
        return E.stop_daemon();
    const backup_exist = fs.existsSync(path.resolve(__dirname,
        './../../luminati-proxy.old/'));
    add_alias_for_whitelist_ips();
    E.manager = new Manager(argv, Object.assign({backup_exist}, run_config));
    E.manager.on('stop', ()=>{
        zerr.flush();
        if (E.shutdown_timeout)
            clearTimeout(E.shutdown_timeout);
        E.uninit();
        process.exit();
    })
    .on('config_changed', etask.fn(function*(){
        yield E.manager.stop('config change', true, true);
        setTimeout(()=>E.run(argv));
    }))
    .on('upgrade', cb=>{
        if (E.on_upgrade_finished)
            return;
        zerr.perr('upgrade_start', perr_info());
        process.send({command: 'upgrade'});
        E.on_upgrade_finished = cb;
    })
    .on('downgrade', cb=>{
        if (E.on_downgrade_finished)
            return;
        zerr.perr('downgrade_start', perr_info());
        process.send({command: 'downgrade'});
        E.on_downgrade_finished = cb;
    }).on('restart', is_upgraded=>
        process.send({command: 'restart', is_upgraded}));
    E.manager.start();
};

E.handle_upgrade_downgrade_finished = (msg, is_downgrade)=>{
    if (!is_downgrade && E.on_upgrade_finished)
    {
        E.on_upgrade_finished(msg.error);
        E.on_upgrade_finished = undefined;
    }
    else if (is_downgrade && E.on_downgrade_finished)
    {
        E.on_downgrade_finished(msg.error);
        E.on_downgrade_finished = undefined;
    }
    else if (E.manager)
        E.manager.restart_when_idle(msg.error);
    const op = is_downgrade ? 'downgrade' : 'upgrade';
    if (msg.error)
        zerr.perr(`${op}_error`, perr_info({error: msg.error}));
    else
        zerr.perr(`${op}_finish`, perr_info());
};

E.handle_shutdown = msg=>{
    E.shutdown(msg.reason, msg.error);
};

E.handle_msg = msg=>{
    switch (msg.command||msg.cmd)
    {
    case 'upgrade_finished': E.handle_upgrade_downgrade_finished(msg); break;
    case 'downgrade_finished':
        E.handle_upgrade_downgrade_finished(msg, 1);
        break;
    case 'shutdown': E.handle_shutdown(msg); break;
    case 'run':
        E.init(msg.argv);
        E.run(msg.argv, {is_upgraded: msg.is_upgraded});
        break;
    }
};

E.init_traps = ()=>{
    E.trap_handlers = ['SIGTERM', 'SIGINT', 'uncaughtException'].map(
        sig=>({sig, handler: E.handle_signal.bind(E, sig)}));
    E.trap_handlers.forEach(({sig, handler})=>{
        process.on(sig, handler);
    });
};

E.uninit_traps = ()=>{
    if (!E.trap_handlers)
        return;
    E.trap_handlers.forEach(({sig, handler})=>process.removeListener(sig,
        handler));
};

E.init_cmd = ()=>{
    process.on('message', E.handle_msg);
};
E.uninit_cmd = ()=>{
    process.removeListener('message', E.handle_msg);
};

E.init = argv=>{
    if (E.initialized)
        return;
    E.initialized = true;
    E.shutdown_timeout = null;
    E.shutdowning = false;
    E.manager = null;
    E.on_upgrade_finished = null;
    E.init_traps();
};

E.uninit = ()=>{
    E.uninit_traps();
    E.uninit_cmd();
    if (E.debug_etask_itv)
        clearInterval(E.debug_etask_itv);
    E.initialized = false;
};

E.init_cmd();
if (!process.env.LUM_MAIN_CHILD)
{
    const argv = lpm_util.init_args();
    E.init(argv);
    E.run(argv);
}
