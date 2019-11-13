#!/usr/bin/env node
// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/
const Manager = require('../lib/manager.js');
const Tracer = require('../lib/tracer.js');
const file = require('../util/file.js');
const etask = require('../util/etask.js');
const zerr = require('../util/zerr.js');
const lpm_util = require('../util/lpm_util.js');
const lpm_file = require('../util/lpm_file.js');
const zdate = require('../util/date.js');
require('../lib/perr.js').run({});
const pkg = require('../package.json');
const _ = require('lodash');
const analytics = require('../lib/analytics.js');
const E = module.exports = {};
const is_win = process.platform=='win32';
const shutdown_timeout = 3000;
const child_process = require('child_process');
const os = require('os');
const download = require('download');
const extract = require('extract-zip');
const is_pkg = typeof process.pkg!=='undefined';
const path = require('path');
const ws = require('lum_windows-shortcuts');
const install_path = path.resolve(os.homedir(), 'luminati_proxy_manager');
const exe_path = path.resolve(install_path, 'lpm.exe');
const logger = require('../lib/logger.js');
const util_lib = require('../lib/util.js');

const gen_filename = name=>{
    return lpm_file.get_file_path(
        `.luminati_${name}.json`.substr(is_win ? 1 : 0));
};

const perr_info = info=>Object.assign({}, info, {
    customer: _.get(E.manager, '_defaults.customer'),
});

E.write_status_file = (status, error=null, config=null, reason=null)=>{
    if (error)
        error = zerr.e2s(error);
    Object.assign(E.lpm_status, {
        last_updated: zdate(),
        status,
        reason,
        error,
        config,
        customer_name: _.get(config, '_defaults.customer'),
    });
    try { file.write_e(E.status_filename, JSON.stringify(E.lpm_status)); }
    catch(e){
        logger.error(`Failed to write status file: ${e.message}`);
    }
};

E.read_status_file = ()=>{
    let status_file;
    const invalid_start = {'running': 1, 'initializing': 1, 'shutdowning': 1};
    try { status_file = JSON.parse(file.read_e(E.status_filename)); }
    catch(e){ status_file = {}; }
    if (status_file)
        E.lpm_status = status_file;
    if (status_file && invalid_start[status_file.status])
        zerr.perr('crash_sudden', E.lpm_status);
};

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
    E.write_status_file('shutdowning', error,
        E.manager && E.manager._total_conf, reason);
    if (E.manager)
    {
        E.manager.stop(reason, true);
        E.manager = null;
    }
    if (error)
        logger.error(`Shutdown, reason is ${reason}: ${zerr.e2s(error)}`);
    else
        logger.notice(`Shutdown, reason is ${reason}`);
    file.rm_rf_e(Tracer.screenshot_dir);
    E.write_status_file('shutdown', error, E.manager && E.manager._total_conf,
        reason);
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
        logger.notice('You need to pass a separate path to the directory for'
            +' this LPM instance. Use --dir flag');
        process.exit();
    }
});

const upgrade_win = function(){
    try {
        logger.notice('Copying %s to %s', process.execPath, exe_path);
        file.copy_e(process.execPath, exe_path);
        const subprocess = child_process.spawn(exe_path, ['--cleanup_win',
            process.execPath, '--kill_pid', process.pid],
            {detached: true, stdio: 'ignore', shell: true});
        subprocess.unref();
    } catch(e){
        logger.notice(e.message);
    }
};

const install_win = ()=>etask(function*lum_node_install_win(){
    this.on('uncaught', e=>{
        logger.error('There was an error while installing on Windows: %s',
            e.message);
    });
    logger.notice('Checking installation on Windows');
    if (!file.exists(install_path))
    {
        file.mkdir_e(install_path);
        logger.notice('Created %s', install_path);
    }
    if (process.execPath!=exe_path)
        upgrade_win();
    const lnk_path = path.resolve(os.homedir(),
        'Desktop/Luminati Proxy Manager.lnk');
    if (!file.exists(lnk_path))
    {
        ws.create(lnk_path, {
            target: exe_path,
            icon: path.join(__dirname, '../build/pkgcon.ico'),
        }, e=>{
            if (e)
                return console.log('ERR while creating a shortcut: %s', e);
            console.log('shortcut created: %s', lnk_path);
        });
    }
    const puppeteer_path = path.resolve(install_path, 'chromium');
    if (file.exists(puppeteer_path))
        return;
    const old_install_path = path.resolve(os.homedir(),
        'AppData/Local/Programs/@luminati-ioluminati-proxy');
    const old_puppeteer_path = path.resolve(old_install_path,
        'resources/app/node_modules/puppeteer/.local-chromium');
    if (file.exists(old_puppeteer_path))
    {
        const new_puppeteer_path = path.resolve(install_path, 'chromium');
        logger.notice('Copying puppeteer from %s to %s', old_puppeteer_path,
            new_puppeteer_path);
        file.rename_e(old_puppeteer_path, new_puppeteer_path);
        return logger.notice('Puppeteer reused from previous installation');
    }
    logger.notice('Started fetching puppeteer binary');
    yield download(`http://${pkg.api_domain}/static/lpm/puppeteer.zip`, 'tmp');
    const source = path.join(process.cwd(), 'tmp', 'puppeteer.zip');
    extract(source, {dir: install_path}, err=>{
        if (err)
            return this.throw(err);
        logger.notice('Puppeteer fetched');
    });
});

const cleanup_win = function(_path){
    logger.notice('Cleaning up after installation. Deleting file %s', _path);
    try {
        file.unlink_e(_path);
    } catch(e){
        logger.notice(e.message);
    }
};

E.run = (argv, run_config)=>etask(function*(){
    if (is_pkg && argv.kill_pid)
    {
        logger.notice('Killing previous process %s', argv.kill_pid);
        try {
            process.kill(argv.kill_pid);
            yield etask.sleep(4000);
        } catch(e){
            logger.notice('Could not kill process %s', argv.kill_pid);
        }
    }
    yield check_running(argv);
    if (is_pkg && argv.upgrade_win)
        upgrade_win();
    else if (is_pkg && argv.cleanup_win)
        cleanup_win(argv.cleanup_win);
    if (is_pkg)
        install_win();
    if (!is_pkg)
        add_alias_for_whitelist_ips();
    E.read_status_file();
    E.write_status_file('initializing', null,
        E.manager && E.manager._total_conf);
    E.manager = new Manager(argv, Object.assign({}, run_config));
    E.manager.on('stop', ()=>{
        // XXX krzysztof: do I need to flush logger too?
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
        if (!analytics.enabled || e.raw)
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
        E.write_status_file('changing_config', null, zone_autoupdate);
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
    }).on('restart', ()=>process.send({command: 'restart'}));
    E.manager.start();
    E.write_status_file('running', null, E.manager&&E.manager._total_conf);
});

E.handle_upgrade_finished = msg=>{
    if (E.on_upgrade_finished)
        E.on_upgrade_finished(msg.error);
    E.on_upgrade_finished = undefined;
    if (msg.error)
        zerr.perr('upgrade_error', perr_info({error: msg.error}));
    else
        zerr.perr('upgrade_finish', perr_info());
};

E.handle_shutdown = msg=>{
    E.shutdown(msg.reason, msg.error);
};

E.handle_msg = msg=>{
    switch (msg.command||msg.cmd)
    {
    case 'upgrade_finished': E.handle_upgrade_finished(msg); break;
    case 'shutdown': E.handle_shutdown(msg); break;
    case 'run':
        E.init(msg.argv);
        E.run(msg.argv);
        break;
    }
};

E.init_status = ()=>{
    E.status_filename = gen_filename('status');
    E.lpm_status = {
        status: 'initializing',
        config: null,
        error: null,
        create_date: zdate(),
        update_date: zdate(),
        customer_name: null,
        version: pkg.version,
    };
};

E.uninit_status = ()=>{};

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
    E.init_status();
    E.init_traps();
    if (process.env.DEBUG_ETASKS)
        E.start_debug_etasks(+process.env.DEBUG_ETASKS*1000);
};

E.uninit = ()=>{
    E.uninit_status();
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
