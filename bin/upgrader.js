#!/usr/bin/env node
// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/
const child_process = require('child_process');
const path = require('path');
const ipc = require('node-ipc');
const util_lib = require('../lib/util.js');
const consts = require('../lib/consts.js');
const etask = require('../util/etask.js');
const zerr = require('../util/zerr.js');
const lpm_config = require('../util/lpm_config.js');
const {levels} = require('../lib/logger.js');
const E = module.exports = {};

ipc.config.id = 'lpm_upgrader';
ipc.config.silent = true;
ipc.config.maxRetries = 100;

const emit_message = (msg, data)=>ipc.of.lum_node_index &&
    ipc.of.lum_node_index.emit(msg, data);

const logger = {};
Object.keys(levels).forEach(level=>
    logger[level] = msg=>emit_message('log', {msg, level}));

E.run_script = (script_f, log_f, cb)=>{
    const opt = {name: 'Luminati Proxy Manager'};
    const full_path = path.resolve(__dirname, script_f);
    const cmd = `bash "${full_path}" ${log_f}`;
    child_process.exec(cmd, opt, cb);
};

E.upgrade = cb=>{
    const log_file = path.join(lpm_config.work_dir, 'upgrade.log');
    E.run_script('lpm_upgrade.sh', log_file, (e, stdout, stderr)=>{
        E.handle_upgrade_downgrade_error(e, stderr, log_file);
        cb(e);
    });
};

E.downgrade = cb=>{
    const log_file = path.join(lpm_config.work_dir, 'downgrade.log');
    E.run_script('lpm_downgrade.sh', log_file, (e, stdout, stderr)=>{
        if (e && e.code==1)
        {
            e = 'Luminati proxy manager backup version does not exist!';
            logger.warn(e);
        }
        else
            E.handle_upgrade_downgrade_error(e, stderr, log_file, 1);
        cb(e);
    });
};

E.handle_upgrade_downgrade_error = (e, stderr, log_file, is_downgrade)=>{
    const script = is_downgrade ? 'downgrade' : 'upgrade';
    if (e)
    {
        logger.error(`Error during ${script}: ${zerr.e2s(e)}`);
        if (!lpm_config.is_win)
            logger.error(`Look at ${log_file} for more details`);
    }
    if (stderr)
        logger.error(`${script} stderr: ${stderr}`);
};

E.start_auto_upgrade = ()=>{
    if (E.started_auto_upgrade)
        return;
    E.started_auto_upgrade = true;
    util_lib.set_interval(etask._fn(function*start_auto_upgrade(){
        this.on('uncaught', e=>{
            logger.error('get_last_version error: '+e.msg);
        });
        if (E.upgrading)
            return;
        const v = yield util_lib.get_last_version(
            lpm_config.manager_default.api);
        if (!v.newer)
            return;
        logger.notice(`New ${v.ver} version is available!`);
        E.upgrading = true;
        E.upgrade(e=>{
            E.upgrading = false;
            emit_message('auto_upgrade_finished', {error: e});
        });
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
    E.trap_handlers = ['SIGTERM', 'SIGINT', 'uncaughtException'].map(
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
    E.shutdowning = false;
    E.init_traps();
    ipc.connectTo('lum_node_index', ()=>{
        ipc.of.lum_node_index.on('connect', ()=>{
            emit_message('upgrader_connected');
        });
        ipc.of.lum_node_index.on('stop', ()=>{
            logger.notice('Stopping upgrader...');
            E.shutdown();
        });
        ipc.of.lum_node_index.on('start_auto_upgrade', ()=>{
            E.start_auto_upgrade();
        });
        ipc.of.lum_node_index.on('upgrade', (opt={})=>{
            logger.notice('Upgrading proxy manager...');
            E.upgrade(e=>{
                if (!e)
                    logger.notice('Upgrade completed successfully');
                emit_message('upgrade_finished', {error: e, cli: opt.cli});
            });
        });
        ipc.of.lum_node_index.on('downgrade', (opt={})=>{
            logger.notice('Downgrading proxy manager...');
            E.downgrade(e=>{
                if (!e)
                    logger.notice('Downgrade completed successfully');
                emit_message('downgrade_finished', {error: e, cli: opt.cli});
            });
        });
    });
};

E.uninit = ()=>{
    E.uninit_traps();
    ipc.disconnect('lum_node_index');
    ipc.config.stopRetrying = true;
};

E.init();
