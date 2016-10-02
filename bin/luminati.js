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
const run = ()=>{
    const manager = new Manager(process.argv.slice(2));
    manager.on('stop', restart=>{
        if (restart)
            setTimeout(run, 0);
        else
            process.exit();
    }).start();
};
run();
