#!/usr/bin/env node
// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/
const Manager = require('../lib/manager.js');
if (process.platform=='win32')
{
    const readline = require('readline');
    readline.createInterface({input: process.stdin, output: process.stdout})
    .on('SIGINT', ()=>process.emit('SIGINT'));
}
let manager, args = process.argv.slice(2);

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
