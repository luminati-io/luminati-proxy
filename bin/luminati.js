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
        this.on('uncaught', err=>console.log(err, err.stack));
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

const config_changed = ()=>{
    if (!manager.argv.config)
        args = manager.get_params();
    manager.stop(true, null, true);
    setTimeout(run, 0);
};

const run = ()=>{
    manager = new Manager(args);
    manager.on('stop', ()=>process.exit()).on('config_changed', config_changed)
    .start();
};

run();
