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
const logger = require('../lib/logger.js');
const util_lib = require('../lib/util.js');
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

let conflict_shown = false;
const show_port_conflict = (port, force)=>etask(function*(){
    if (conflict_shown)
        return;
    conflict_shown = true;
    yield _show_port_conflict(port, force);
});

E.get_lpm_tasks = ()=>etask(function*(){
    try { return yield util_lib.get_lpm_tasks(); }
    catch(e){ process.exit(); }
});

const _show_port_conflict = (port, force)=>etask(function*(){
    const tasks = yield E.get_lpm_tasks();
    if (!tasks.length)
        return logger.error(`There is a conflict on port ${port}`);
    const pid = tasks[0].pid;
    logger.notice(`LPM is already running (${pid}) and uses port ${port}`);
    if (!force)
    {
        logger.notice('If you want to kill other instances use --force flag');
        return process.exit();
    }
    logger.notice('Trying to kill it and restart.');
    for (const t of tasks)
        process.kill(t.ppid, 'SIGTERM');
    E.manager.restart();
});

const check_running = argv=>etask(function*(){
    const tasks = yield E.get_lpm_tasks();
    if (!tasks.length)
        return;
    if (!argv.dir)
    {
        logger.notice(`LPM is already running (${tasks[0].pid})`);
        logger.notice('You need to pass a separate path to the directory for '
            +'this LPM instance. Use --dir flag');
        process.exit();
    }
});

const win_backup_check_cmd = '@echo off & FOR /F %g IN (\'npm root -g\') do '
+'(IF EXIST %g\\@luminati-io\\luminati-proxy.old (echo 1) ELSE (echo 0))';
const unix_backup_check_cmd = 'test -d "$(npm root -g)/@luminati-io/'
+'luminati-proxy.old" && printf 1 || printf 0';

E.run = (argv, run_config)=>etask(function*(){
    let backup_exist;
    try {
        const backup_exist_raw = child_process.execSync(lpm_config.is_win ?
            win_backup_check_cmd : unix_backup_check_cmd);
        backup_exist = +Buffer.from(backup_exist_raw).toString();
    } catch(e){
        backup_exist = 0;
        zerr.perr('backup_check_fail', perr_info({error: zerr.e2s(e)}));
    }
    yield check_running(argv);
    add_alias_for_whitelist_ips();
    E.manager = new Manager(argv, Object.assign({backup_exist}, run_config));
    E.manager.on('stop', ()=>{
        zerr.flush();
        if (E.shutdown_timeout)
            clearTimeout(E.shutdown_timeout);
        E.uninit();
        process.exit();
    })
    .on('error', (e, fatal)=>{
        let match;
        if (match = e.message.match(/EADDRINUSE.+:(\d+)/))
            return show_port_conflict(match[1], argv.force);
        logger.error(e.raw ? e.message : 'Unhandled error: '+e);
        const handle_fatal = ()=>{
            if (fatal)
                E.manager.stop();
        };
        if (!perr.enabled || e.raw)
            handle_fatal();
        else
        {
            // XXX krzysztof: make a generic function for sending crashes
            etask(function*send_err(){
                yield zerr.perr('crash', perr_info({error: zerr.e2s(e)}));
                handle_fatal();
            });
        }
    })
    .on('config_changed', etask.fn(function*(zone_autoupdate){
        yield E.manager.stop('config change', true, true);
        setTimeout(()=>E.run(argv, zone_autoupdate&&zone_autoupdate.prev ? {
            warnings: [`Your default zone has been automatically changed from `
                +`'${zone_autoupdate.prev}' to '${zone_autoupdate.zone}'.`],
        } : {}), 0);
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
});

E.handle_upgrade_downgrade_finished = (msg, is_downgrade)=>{
    if (!is_downgrade && E.on_upgrade_finished)
    {
        E.on_upgrade_finished(msg.error);
        E.on_upgrade_finished = undefined;
    }
    if (is_downgrade && E.on_downgrade_finished)
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
    if (process.env.DEBUG_ETASKS)
        E.start_debug_etasks(+process.env.DEBUG_ETASKS*1000);
};

E.uninit = ()=>{
    E.uninit_traps();
    E.uninit_cmd();
    if (E.debug_etask_itv)
        clearInterval(E.debug_etask_itv);
    E.initialized = false;
};

E.start_debug_etasks = (interval = 10000)=>{
    E.debug_etask_itv = setInterval(()=>{
        console.log('=======================================');
        console.log('counter ps', etask.ps());
        console.log('=======================================');
    }, interval);
};

if (!module.parent)
{
    E.init_cmd();
    // XXX vladislavl: for debug purposes only
    if (!process.env.LUM_MAIN_CHILD)
    {
        const argv = lpm_util.init_args();
        E.init(argv);
        E.run(argv);
    }
}
