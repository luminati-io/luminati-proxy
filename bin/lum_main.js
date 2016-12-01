#!/usr/bin/env node
// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/

const Manager = require('../lib/manager.js');
const hutil = require('hutil');
const etask = hutil.etask;
let manager, args = process.argv.slice(2), shutdowning = false;
['SIGTERM', 'SIGINT', 'uncaughtException'].forEach(sig=>process.on(sig, err=>{
    if (!manager || shutdowning)
        return;
    console.log(sig, err||'recieved');
    shutdowning = true;
    manager.stop(sig, true);
}));
let on_upgrade_finished;
(function run(run_config){
    manager = new Manager(args, run_config);
    manager.on('stop', ()=>process.exit())
    .on('error', err=>{
        if (err.raw)
            console.log(err.message);
        else
            console.log('Unhandled error:', err);
        process.exit();
    })
    .on('config_changed', etask.fn(function*(zone_autoupdate){
        args = manager.argv.config ? args : manager.get_params();
        yield manager.stop('config change', true, true);
        setTimeout(()=>run(zone_autoupdate&&zone_autoupdate.prev ? {
            warnings: [`Your default zone has been automatically changed from `
                +`'${zone_autoupdate.prev}' to '${zone_autoupdate.zone}'.`],
        } : {}), 0);
    }))
    .on('upgrade', cb=>{
        if (on_upgrade_finished)
            return;
        process.send({command: 'upgrade'});
        on_upgrade_finished = cb;
    }).on('restart', ()=>process.send({command: 'restart'}));
    manager.start();
})();

process.on('message', (msg)=>{
    if (msg.command!='upgrade_finished')
        return;
    on_upgrade_finished(msg.error);
    on_upgrade_finished = undefined;
});
