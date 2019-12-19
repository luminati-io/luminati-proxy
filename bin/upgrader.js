#!/usr/bin/env node
// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/
const child_process = require('child_process');
const path = require('path');
const argv = require('yargs').argv;
const ipc = require('node-ipc');
const util_lib = require('../lib/util.js');
const consts = require('../lib/consts.js');
const etask = require('../util/etask.js');
const {manager_default} = require('../util/lpm_config.js');
const E = module.exports = {};

ipc.config.id = 'lpm_upgrader';
ipc.config.silent = true;

const emit_message = (msg, data)=>ipc.of.lum_node_index &&
    ipc.of.lum_node_index.emit(msg, data);

const logger = {
    notice: msg=>emit_message('log', {msg}),
    error: msg=>emit_message('log', {msg, level: 'error'}),
};

E.run_script = (script_f, log_f, cb)=>{
    const opt = {name: 'Luminati Proxy Manager'};
    const full_path = path.resolve(__dirname, script_f);
    const cmd = `bash "${full_path}" ${log_f}`;
    child_process.exec(cmd, opt, cb);
};

E.upgrade = cb=>{
    logger.notice('Upgrading proxy manager...');
    E.run_script('lpm_upgrade.sh', E.log_file, (e, stdout, stderr)=>{
        E.handle_upgrade_downgrade_error(e, stderr);
        cb(e);
    });
};

E.downgrade = cb=>{
    logger.notice('Downgrading proxy manager...');
    E.run_script('lpm_downgrade.sh', E.log_file, (e, stdout, stderr)=>{
        if (e && e.code==1)
            process.stdout.write('BACKUP_NOT_EXISTS');
        else
            E.handle_upgrade_downgrade_error(e, stderr, 1);
        cb(e);
    });
};

E.handle_upgrade_downgrade_error = (e, stderr, is_downgrade)=>{
    const script = is_downgrade ? 'downgrade' : 'upgrade';
    if (e)
        throw e;
    if (stderr)
        logger.error(`${script} stderr: ${stderr}`);
};

E.run = ()=>{
    if (argv.upgrade)
        return E.upgrade(()=>E.uninit());
    if (argv.downgrade)
        return E.downgrade(()=>E.uninit());
    util_lib.set_interval(etask._fn(function*start_auto_upgrade(){
        this.on('uncaught', e=>{
            process.stderr.write('get_last_version error: '+e.msg+'\n');
        });
        if (E.upgraded_v)
            return E.shutdown();
        if (E.upgrading)
            return;
        const v = yield util_lib.get_last_version(manager_default.api);
        if (v.newer)
        {
            logger.notice(`New ${v.ver} version is available!`);
            E.upgrading = true;
            E.upgrade(e=>{
                E.upgrading = false;
                if (!e)
                    E.upgraded_v = v.ver;
            });
            return;
        }
    }), consts.UPGRADE_CHECK_INTERVAL);
};

E.shutdown = ()=>{
    if (E.shutdowning)
        return;
    E.shutdowning = true;
    util_lib.clear_timeouts();
    E.uninit();
    process.exit(0);
};

E.init_traps = ()=>{
    E.trap_handlers = ['SIGTERM', 'SIGINT'].map(
        sig=>({sig, handler: E.shutdown.bind(E)}));
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

E.init = ()=>{
    E.upgrading = false;
    E.upgraded_v = null;
    E.shutdowning = false;
    E.init_traps();
    ipc.connectTo('lum_node_index', ()=>{
        ipc.of.lum_node_index.on('connect', ()=>{
            emit_message('upgrader_connected');
        });
    });
};

E.uninit = ()=>{
    E.uninit_traps();
    ipc.disconnect('lum_node_index');
    ipc.config.stopRetrying = true;
};

E.init();
E.run();
