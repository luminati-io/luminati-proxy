#!/usr/bin/env node
// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/

let is_electron = process.versions && !!process.versions.electron;

if (!is_electron)
{
    const Luminati = require('./lib/luminati.js');
    const Manager = require('./lib/manager.js');
    const version = require('./package.json').version;
    module.exports = {Luminati, Manager, version};
    return;
}

const Manager = require('./lib/manager.js');
const electron = require('electron');
const app = electron.app, dialog = electron.dialog;
const autoUpdater = electron.autoUpdater;
const BrowserWindow = electron.BrowserWindow;
const hutil = require('hutil');
const etask = hutil.etask;
const analytics = require('universal-analytics');
const ua = analytics('UA-60520689-2');

if (require('electron-squirrel-startup'))
    return;

let manager, args = process.argv.slice(2), wnd;

autoUpdater.on('update-downloaded', e=>{
    dialog.showMessageBox(wnd, {type: 'info', message: 'Upgrading...'});
    autoUpdater.quitAndInstall();
});
autoUpdater.on('error', ()=>{});
autoUpdater.setFeedURL('http://localhost:9000/dist/win/');
autoUpdater.checkForUpdates();

let run = run_config=>{
    manager = new Manager(args, run_config);
    manager.on('www_ready', url=>{
        if (!manager.argv.no_usage_stats)
            ua.event('ready', url).send();
        wnd = wnd || new BrowserWindow({width: 1024, height: 768});
        wnd.loadURL(url);
    })
    .on('stop', ()=>{
        if (manager.argv.no_usage_stats)
            process.exit();
        else
            ua.event('stop', ()=>process.exit());
    })
    .on('error', e=> {
        console.log(e.raw ? e.message : 'Unhandled error: '+e);
        if (manager.argv.no_usage_stats)
            process.exit();
        else
            ua.exception('Stack: '+e.stack, true, ()=>process.exit());
    })
    .on('config_changed', etask.fn(function*(zone_autoupdate){
        if (!manager.argv.no_usage_stats)
            ua.event('config_changed');
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
        ua.event('quit', ()=>app.quit());
};

app.on('ready', run);
app.on('window-all-closed', quit);
