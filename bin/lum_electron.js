#!/usr/bin/env node
// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/
const electron = require('electron');
const child_process = require('child_process');
const semver = require('semver');
const app = electron.app;
const dialog = electron.dialog;
const open = require('open');
let _info_bkp = console.info;
console.info = function(){};
const auto_updater = require('electron-updater').autoUpdater;
console.info = _info_bkp;
const config = require('../util/lpm_config.js');
const lpm_config_static = require('../util/lpm_config_static');
const etask = require('../util/etask.js');
const zerr = require('../util/zerr.js');
const perr = require('../lib/perr.js');
const Manager = require('../lib/manager.js');
const tasklist = require('tasklist');
const taskkill = require('taskkill');
const pkg = require('../package.json');
const logger = require('../lib/logger.js');
const get_cache = require('../lib/cache.js');
const cluster_ipc = require('../util/cluster_ipc.js');
const E = module.exports;

let manager, upgrade_available, can_upgrade, is_upgrading, upgrade_cb;

const show_message = opt=>etask(function*(){
    const {response} = yield dialog.showMessageBox(opt);
    return !!response;
});

// XXX vladislavl: need refactor restart themself - electron does not support
// fork child other path js process run
const restart = ()=>{
    const child = child_process.spawn(process.execPath, process.argv.slice(1),
        {detached: true, stdio: ['inherit', 'inherit', 'inherit', 'ipc']});
    // wait until child re-open stdio
    child.on('message', msg=>{
        if (!msg || msg.cmd!='lpm_restart_init')
            return;
        child.unref();
        app.quit();
    });
};

let upgrade = ver=>etask(function*(){
    if (!can_upgrade)
    {
        let res = yield show_message({type: 'info',
            title: 'Proxy manager update',
            message: (ver ? `Proxy Manager version ${ver}` :
                'Proxy Manager update')
            +' will be installed on exit',
            buttons: ['Install on exit', 'Install now']});
        if (!res)
            return void logger.notice('Update postponed until exit');
    }
    logger.notice('Starting upgrade');
    is_upgrading = true;
    zerr.perr('upgrade_start');
    auto_updater.quitAndInstall();
});

auto_updater.allowDowngrade = true;
auto_updater.autoDownload = false;
auto_updater.on('error', e=>zerr.perr('upgrade_error', {error: e}));
auto_updater.on('before-quit', ()=>{
    if (is_upgrading)
        zerr.perr('upgrade_finish');
});

let prev_percent = 0;
auto_updater.on('download-progress', progress_obj=>{
    let current = (progress_obj.percent/10|0)*10;
    if (current==prev_percent)
        return;
    prev_percent = current;
    logger.notice(current+'% downloaded');
});

auto_updater.on('update-available', e=>etask(function*(){
    if (semver.lt(e.version, pkg.version))
    {
        if (!config.is_lum)
        {
            zerr.perr('upgrade_invalid_version',
                {upgrade_v: e.version, current_v: pkg.version});
        }
        return;
    }
    const changelog_url = 'https://github.com/'+lpm_config_static.github_repo
    +'/blob/master/CHANGELOG.md';
    const update_msg = `Update version ${e.version} is available. Full list of`
    +` changes is available here: ${changelog_url}`;
    logger.notice(update_msg);
    if (!can_upgrade)
    {
        let res = yield show_message({type: 'info',
            title: `Proxy Manager update ${e.version} is available`,
            message: 'Proxy Manager version '+e.version
            +' is available. Would you like to download it?',
            buttons: ['No', 'Yes']});
        if (!res)
            return void logger.notice('Will not download update');
    }
    logger.notice(`Downloading version ${e.version}`);
    auto_updater.downloadUpdate();
}));

auto_updater.on('update-downloaded', e=>{
    logger.notice('Update downloaded');
    upgrade_available = true;
    upgrade(e.version);
});

auto_updater.on('update-not-available', ()=>{
    if (upgrade_cb)
        upgrade_cb('Update not available');
    upgrade_cb = null;
});

const check_conflicts = ()=>etask(function*(){
    let tasks;
    try { tasks = yield tasklist(); }
    catch(e){ process.exit(); }
    tasks = tasks.filter(t=>t.imageName.includes('Proxy Manager') &&
        t.pid!=process.pid);
    if (tasks.length<=2)
        return;
    const res = yield show_message({
        type: 'warning',
        title: 'Address in use',
        message: `Proxy Manager is already running (${tasks[0].pid})\n`
            +'Click OK to stop the '
            +'offending processes or Cancel to close Proxy Manager.\n\n'
            +'Suspected processes:\n'
            +'PID\t Image Name\t Session Name\t Mem Usage\n'
            +tasks.map(t=>`${t.pid}\t ${t.imageName}\t ${t.sessionName}\t `
                +`${t.memUsage}`).join('\n'),
        buttons: ['Ok', 'Cancel'],
    });
    if (res)
        return app.exit();
    try {
        yield taskkill(tasks.map(t=>t.pid), {tree: true, force: true});
    } catch(e){
        yield show_message({
            type: 'warning',
            title: 'Failed stopping processes',
            message: 'Failed stopping processes. Restart Proxy '
                +'Manager as administrator or stop the processes manually '
                +'and then restart.\n\n'+e,
            buttons: ['Ok'],
        });
        process.exit();
    }
    restart();
});

const init_shared_cache = ()=>{
    try {
        const cache = get_cache();
        cluster_ipc.master_on('cache_set', msg=>
            cache.set(msg.url, msg.res_data, msg.headers));
        cluster_ipc.master_on('cache_get', msg=>cache.get(msg.url));
        cluster_ipc.master_on('cache_has', msg=>cache.has(msg.url));
    } catch(e){ console.log('SETTING CACHE ERROR: '+e.message); }
};

const check_for_updates = ()=>{
    try {
        auto_updater.checkForUpdates();
    } catch(e){
        logger.error('Version update check fail: '+zerr.e2s(e));
    }
};

const _run = argv=>etask(function*(){
    if (process.send)
    {
        process.send({cmd: 'lpm_restart_init'});
        // give some time to parent process to exit before checking conflicts
        yield etask.sleep(2000);
    }
    yield check_conflicts();
    init_shared_cache();
    manager = new Manager(argv);
    auto_updater.logger = manager.log;
    setTimeout(()=>check_for_updates(), 15000);
    manager.on('www_ready', url=>{
        try {
            open(url, {url: true});
        } catch(e){
            logger.error('Failed to auto open UI: '+zerr.e2s(e));
        }
    })
    .on('upgrade', cb=>{
        upgrade_cb = cb;
        can_upgrade = true;
        if (upgrade_available)
            upgrade();
        else
            check_for_updates();
    })
    .on('stop', ()=>{
        process.exit();
    })
    .on('error', (e, fatal)=>{
        let e_msg = e.raw ? e.message : 'Unhandled error: '+e;
        let handle_fatal = ()=>{
            if (fatal)
            {
                logger.error(e_msg);
                process.exit();
            }
        };
        handle_fatal();
    })
    .on('config_changed', etask.fn(function*(){
        yield manager.stop('config change', true, true);
        setTimeout(()=>_run(argv));
    }));
    manager.start();
});

let quit = err=>{
    if (err)
    {
        if (!manager)
            zerr.perr(err);
        logger.error('uncaught exception '+zerr.e2s(err));
    }
    app.quit();
};

E.run = argv=>{
    perr.run({enabled: !argv.no_usage_stats, zagent: argv.zagent});
    app.on('ready', ()=>_run(argv));
    process.on('SIGINT', quit);
    process.on('SIGTERM', quit);
    process.on('uncaughtException', quit);
};
