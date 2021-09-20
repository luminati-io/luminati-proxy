#!/usr/bin/env node
// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/
const Manager = require('../lib/manager.js');
const file = require('../util/file.js');
const etask = require('../util/etask.js');
const zerr = require('../util/zerr.js');
const lpm_util = require('../util/lpm_util.js');
const util = require('../lib/util.js');
const get_cache = require('../lib/cache.js');
const cluster_ipc = require('../util/cluster_ipc.js');
// XXX krzysztof: is perr.run() needed here?
const perr = require('../lib/perr.js');
perr.run({});
const E = module.exports = {};
const shutdown_timeout = 3000;
const child_process = require('child_process');
const os = require('os');
const fs = require('fs');
const path = require('path');
const logger = require('../lib/logger.js').child({category: 'lum_node'});

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
            yield util.perr('crash', {error: errstr});
            return E.shutdown(errstr, err);
        }
        return E.shutdown(errstr);
    });
};

const add_alias_for_whitelist_ips = ()=>{
    const func =
        `curl_add_ip(){\n`+
        `    if (($2)); then\n`+
        `        PORT=$2\n`+
        `    else\n`+
        `        PORT=22999\n`+
        `    fi\n`+
        `    ENDPOINT="http://127.0.0.1:$PORT/api/add_whitelist_ip"\n`+
        `    DATA="ip="$1\n`+
        `    curl $ENDPOINT -X POST -d $DATA --post301 -L -k\n`+
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
        file.append_e(bashrc_path, func+'\n'+alias+'\n');
        child_process.execSync(func);
        child_process.execSync(alias);
    } catch(e){ logger.warn(`Failed to install ${name}: ${e.message}`); }
};

const init_shared_cache = ()=>{
    try {
        const cache = get_cache();
        cluster_ipc.master_on('cache_set', msg=>
            cache.set(msg.url, msg.res_data, msg.headers));
        cluster_ipc.master_on('cache_get', msg=>cache.get(msg.url));
        cluster_ipc.master_on('cache_has', msg=>cache.has(msg.url));
    } catch(e){ console.log('SETTING CACHE ERROR: '+e.message); }
};

E.run = (argv, run_config)=>{
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
        process.send({command: 'upgrade'});
        E.on_upgrade_finished = cb;
    })
    .on('downgrade', cb=>{
        if (E.on_downgrade_finished)
            return;
        process.send({command: 'downgrade'});
        E.on_downgrade_finished = cb;
    }).on('restart', opt=>{
        process.send(Object.assign(opt, {command: 'restart'}));
    });
    E.manager.start();
};

E.handle_shutdown = msg=>{
    E.shutdown(msg.reason, msg.error);
};

E.handle_msg = msg=>{
    switch (msg.command||msg.cmd)
    {
    case 'upgrade_finished':
        if (E.on_upgrade_finished)
            E.on_upgrade_finished(msg.error);
        E.on_upgrade_finished = undefined;
        break;
    case 'downgrade_finished':
        if (E.on_downgrade_finished)
            E.on_downgrade_finished(msg.error);
        E.on_downgrade_finished = undefined;
        break;
    case 'shutdown':
        E.handle_shutdown(msg);
        break;
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
    init_shared_cache();
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
