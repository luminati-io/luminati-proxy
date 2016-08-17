#!/usr/bin/env node
// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/
const Manager = require('../lib/manager.js');
const hutil = require('hutil');
const etask = hutil.etask;
const is_win = process.platform=='win32';
if (is_win)
{
    const readline = require('readline');
    readline.createInterface({input: process.stdin, output: process.stdout})
        .on('SIGINT', ()=>process.emit('SIGINT'));
}
const manager = new Manager(process.argv.slice(2));
etask(function*(){ yield manager.start(); });
