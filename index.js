#!/usr/bin/env node
// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/

const Manager = require('./lib/manager.js');
const version = require('./package.json').version;
let is_electron = process.versions && !!process.versions.electron;

if (!is_electron)
{
    const Luminati = require('./lib/luminati.js');
    module.exports = {Luminati, Manager, version};
    return;
}

const electron = require('electron');
const app = electron.app, dialog = electron.dialog;
const autoUpdater = require('electron-updater').autoUpdater;
const BrowserWindow = electron.BrowserWindow;
const hutil = require('hutil');
const etask = hutil.etask;
const analytics = require('universal-analytics');
const ua = analytics('UA-60520689-2');

ua.set('an', 'LPM-electron');
ua.set('av', `v${version}`);

let manager, args = process.argv.slice(2), wnd, upgrade_available, can_upgrade;

const upgrade = ()=>{
    dialog.showMessageBox(wnd, {
        type: 'info',
        title:'Update Required',
        message: 'A new Luminati Proxy Manager version is available',
        buttons: ['Update now'],
    });
    autoUpdater.quitAndInstall();
};

autoUpdater.on('update-downloaded', e=>{
    if (manager && manager.argv && !manager.argv.no_usage_stats)
        ua.event('app', 'update-downloaded');
    if (can_upgrade)
        upgrade();
    else
        upgrade_available = true;
});
autoUpdater.on('error', ()=>{});

let run = run_config=>{
    manager = new Manager(args, Object.assign({ua}, run_config));
    if (!manager.argv.no_usage_stats)
        ua.event('app', 'run');
    autoUpdater.logger = manager._log;
    autoUpdater.checkForUpdates();
    manager.on('www_ready', url=>{
        if (!manager.argv.no_usage_stats)
            ua.event('manager', 'www_ready', url).send();
        wnd = wnd || new BrowserWindow({width: 1024, height: 768});
        wnd.loadURL(url);
    })
    .on('upgrade', cb=>{
        can_upgrade = true;
        if (upgrade_available)
            upgrade();
        else
            cb();
    })
    .on('stop', ()=>{
        if (manager.argv.no_usage_stats)
            process.exit();
        else
            ua.event('manager', 'stop', ()=>process.exit());
    })
    .on('error', (e, fatal)=> {
        let handle_fatal = ()=>{
            if (fatal)
            {
                console.log(e.raw ? e.message : 'Unhandled error: '+e);
                process.exit();
            }
        };
        if (manager.argv.no_usage_stats)
            handle_fatal();
        else
            ua.event('manager', 'error', JSON.stringify(e), handle_fatal);
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

let quit = ()=>{
    if (manager.argv.no_usage_stats)
        app.quit();
    else
        ua.event('app', 'quit', ()=>app.quit());
};

app.on('ready', run);
app.on('window-all-closed', quit);
