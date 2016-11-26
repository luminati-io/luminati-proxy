#!/usr/bin/env node
// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/
const Manager = require('../lib/manager.js');
const hutil = require('hutil');
const pm2 = require('pm2');
const etask = hutil.etask;
let manager, args = process.argv.slice(2);
if (args.some(arg=>arg=='-d' || arg=='--daemon'))
{
    return etask(function*(){
        this.on('uncaught', err=>console.log('Uncaught exception:', err,
            err.stack));
        yield etask.nfn_apply(pm2, '.connect', []);
        yield etask.nfn_apply(pm2, '.start', [{
            name: 'luminati',
            script: process.argv[1],
            args: args.filter(arg=>arg!='-d' && arg!='daemon'),
        }]);
        yield etask.nfn_apply(pm2, '.disconnect', []);
    });
}
if (process.platform=='win32')
{
    const readline = require('readline');
    readline.createInterface({input: process.stdin, output: process.stdout})
    .on('SIGINT', ()=>process.emit('SIGINT'));
}
['SIGTERM', 'SIGINT', 'uncaughtException'].forEach(sig=>process.on(sig, err=>{
    console.log(sig, err||'recieved');
    if (manager)
        manager.stop(sig, true);
}));
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
        setTimeout(()=>run(zone_autoupdate ? {
            warnings: [`Your default zone has been automatically changed from `
                +`'${zone_autoupdate.prev}' to '${zone_autoupdate.zone}'.`],
        } : {}), 0);
    }));
    manager.start();
})();
