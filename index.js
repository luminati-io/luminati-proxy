#!/usr/bin/env node
// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/

const Manager = require('./lib/manager.js');
const Luminati = require('./lib/luminati.js');
const version = require('./package.json').version;
let is_electron = process.versions && !!process.versions.electron;

if (!is_electron)
    return void (module.exports = {Luminati, Manager, version});

Manager.default.disable_color = Luminati.default.disable_color = true;

const electron = require('electron');
const app = electron.app, dialog = electron.dialog;
const opn = require('opn');
let _info_bkp = console.info;
console.info = function(){};
const auto_updater = require('electron-updater').autoUpdater;
console.info = _info_bkp;
const etask = require('./util/etask.js');
const zerr = require('./util/zerr.js');
const tasklist = require('tasklist');
const taskkill = require('taskkill');
const analytics = require('universal-analytics');
const child_process = require('child_process');
const ua = analytics('UA-60520689-2');
const assign = Object.assign;

ua.set('an', 'LPM-electron');
ua.set('av', `v${version}`);

let manager, args = process.argv.slice(2), wnd, upgrade_available, can_upgrade;

let show_message = opt=>etask(function*(){
    let [res] = yield etask.cb_apply({ret_a: true}, dialog, '.showMessageBox',
        [opt]);
    return res;
});

let mgr_err = msg=>{
    if (manager&&manager._log)
        manager._log.error(msg);
    else
        console.log(msg);
};
// saves stdio (unlike app.relaunch)
let restart = ()=>{
    let child = child_process.spawn(process.execPath, process.argv.slice(1),
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
        let res = yield show_message({type: 'info', title: 'Luminati update',
            message: (ver ? `Luminati version ${ver}` : 'Luminati update')
            +' will be installed on exit',
            buttons: ['Install on exit', 'Install now']});
        if (!res)
            return void console.log('Update postponed until exit');
    }
    console.log('Starting upgrade');
    auto_updater.quitAndInstall();
});

auto_updater.allowDowngrade = true;
auto_updater.autoDownload = false;
auto_updater.on('error', ()=>{});

auto_updater.on('update-available', e=>etask(function*(){
    const changelog_url = 'https://github.com/luminati-io/luminati-proxy/blob/'
    +'master/CHANGELOG.md';
    console.log(`Update version ${e.version} is available. Full list of
        changes is available here: ${changelog_url}`);
    if (!can_upgrade)
    {
        let res = yield show_message({type: 'info',
            title: `Luminati update ${e.version} is available`,
            message: 'Luminati version '+e.version
            +' is available, would you like to download it?',
            buttons: ['No', 'Yes']});
        if (!res)
            return void console.log('Will not download update');
    }
    console.log(`Downloading version ${e.version}`);
    auto_updater.downloadUpdate();
}));

auto_updater.on('update-downloaded', e=>{
    console.log('Update downloaded');
    if (manager && manager.argv && !manager.argv.no_usage_stats)
        ua.event('app', 'update-downloaded');
    upgrade_available = true;
    upgrade(e.version);
});

let _show_port_conflict = (addr, port)=>etask(function*(){
    let tasks;
    try { tasks = yield tasklist(); }
    catch(e){ process.exit(); }
    tasks = tasks.filter(t=>t.imageName.includes('Luminati Proxy Manager') &&
        t.pid!=process.pid);
    let res = dialog.showMessageBox({
        type: 'warning',
        title: 'Address in use',
        message: `There is already an application running on ${addr}:${port}\n`
            +(tasks.length ? 'Click OK button to try stopping the '
            +'offending processes or Cancel to close Luminati Proxy '
            +'Manager and stop other instances manually.\n\n'
            +'Suspected processes:\n'
            +'PID\t Image Name\t Session Name\t Mem Usage\n'
            +tasks.map(t=>`${t.pid}\t ${t.imageName}\t ${t.sessionName}\t `
                +`${t.memUsage}`).join('\n') :
            'Stop other running instances manually then click OK button '
            +'to restart Luminati Proxy Manager.'),
        buttons: ['Ok', 'Cancel'],
    });
    if (res)
        return app.exit();
    try {
        if (tasks.length)
            yield taskkill(tasks.map(t=>t.pid), {tree: true, force: true});
    } catch(e){
        dialog.showMessageBox({
            type: 'warning',
            title: 'Failed stopping processes',
            message: 'Failed stopping processes. Restart Luminati Proxy '
                +'Manager as administrator or stop the processes manually '
                +'and then restart.\n\n'+e,
            buttons: ['Ok'],
        });
        process.exit();
    }
    restart();
});

let conflict_shown;
let show_port_conflict = (addr, port)=>{
    if (conflict_shown)
        return;
    conflict_shown = true;
    _show_port_conflict(addr, port);
};

let run = run_config=>{
    if (process.send)
        process.send({cmd: 'lpm_restart_init'});
    manager = new Manager(args, Object.assign({ua}, run_config));
    if (!manager.argv.no_usage_stats)
        ua.event('app', 'run');
    auto_updater.logger = manager._log;
    setTimeout(()=>auto_updater.checkForUpdates(), 15000);
    manager.on('www_ready', url=>{
        if (!manager.argv.no_usage_stats)
            ua.event('manager', 'www_ready', url).send();
        opn(url);
    })
    .on('upgrade', cb=>{
        can_upgrade = true;
        if (upgrade_available)
            upgrade();
        else
            auto_updater.checkForUpdates();
    })
    .on('stop', ()=>{
        if (manager.argv.no_usage_stats)
            process.exit();
        else
            ua.event('manager', 'stop', ()=>process.exit());
    })
    .on('error', (e, fatal)=>{
        let e_msg = e.raw ? e.message : 'Unhandled error: '+e;
        let handle_fatal = ()=>{
            let err;
            if (err = (e.message||'').match(/((?:\d{1,3}\.?){4}):(\d+)$/))
                return show_port_conflict(err[1], err[2]);
            if (fatal)
            {
                mgr_err(e_msg);
                process.exit();
            }
        };
        if (manager.argv.no_usage_stats)
            handle_fatal();
        else
        {
            if (e.raw)
                e = assign({message: e.message}, e);
            ua.event('manager', 'error', JSON.stringify(e), handle_fatal);
        }
    })
    .on('config_changed', etask.fn(function*(zone_autoupdate){
        if (!manager.argv.no_usage_stats)
        {
            ua.event('manager', 'config_changed',
                JSON.stringify(zone_autoupdate));
        }
        args = manager.argv.config ? args : manager.get_params();
        yield manager.stop('config change', true, true);
        setTimeout(()=>run(zone_autoupdate && zone_autoupdate.prev ? {
            warnings: [`Your default zone has been automatically changed from `
                +`'${zone_autoupdate.prev}' to '${zone_autoupdate.zone}'.`],
        } : {}), 0);
    }));
    manager.start();
};

let quit = err=>{
    if (err)
    {
        if (!manager||!manager.argv.no_usage_stats)
            zerr.perr(err);
        mgr_err('uncaught exception '+zerr.e2s(err));
    }
    if (manager&&manager.argv.no_usage_stats)
        app.quit();
    else
        ua.event('app', 'quit', ()=>app.quit());
};

app.on('ready', run);
process.on('SIGINT', quit);
process.on('SIGTERM', quit);
process.on('uncaughtException', quit);
