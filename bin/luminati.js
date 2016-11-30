#!/usr/bin/env node
// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/

// XXX marka: use let instead of const because we will re-require it
let check_compat = require('./check_compat.js');

if (!check_compat.is_env_compat())
    process.exit();

const hutil = require('hutil');
const pm2 = require('pm2');
const child_process = require('child_process');
const path = require('path');
const sudo_prompt = require('sudo-prompt');
const etask = hutil.etask;
let args = process.argv.slice(2);
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

let child;

['SIGTERM', 'SIGINT', 'uncaughtException'].forEach(sig=>process.on(sig, err=>{
    child.kill(err ? undefined : sig); }));

let shutdown_on_child_exit = ()=>process.exit();

let create_child = ()=>{
    child = child_process.fork(path.resolve(__dirname, 'lum_main.js'), args,
        {stdio: 'inherit'});
    child.on('message', msg_handler);
    child.on('exit', shutdown_on_child_exit);
};

let msg_handler = function(msg){
    switch (msg.command)
    {
    case 'shutdown_master': return process.exit();
    case 'restart':
        child.removeListener('exit', shutdown_on_child_exit);
        child.on('exit', ()=>create_child());
        child.kill();
        break;
    case 'upgrade':
        const cmd = 'npm install -g luminati-io/luminati-proxy';
        sudo_prompt.exec(cmd, {name: 'Luminati Proxy Manager'}, e=>{
            child.send({command: 'upgrade_finished', error: e});
            if (e)
                return;
            check_compat = null;
            delete require.cache[require.resolve('./check_compat.js')];
            check_compat = require('./check_compat.js');
            if (!check_compat.is_env_compat())
                process.exit();
        });
        break;
    }
};

create_child();
