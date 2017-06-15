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

const pm2_cmd = (command, opt)=>etask(function*pm2_cmd(){
    this.on('uncaught', err=>console.log('Uncaught exception:', err,
        err.stack));
    yield etask.nfn_apply(pm2, '.connect', []);
    yield etask.nfn_apply(pm2, '.'+command, [opt]);
    yield etask.nfn_apply(pm2, '.disconnect', []);
});
let args = process.argv.slice(2), is_win = process.platform=='win32';
if (args.some(arg=>arg=='-d' || arg=='--daemon'))
{
    return pm2_cmd('start', {
        name: 'luminati',
        script: process.argv[1],
        killTimeout: 5000,
        restartDelay: 5000,
        args: args.filter(arg=>arg!='-d' && arg!='--daemon'
            && arg!='--stop-daemon'),
    });
}
if (args.some(arg=>arg=='--stop-daemon'))
    return pm2_cmd('stop', 'luminati');
if (is_win)
{
    const readline = require('readline');
    readline.createInterface({input: process.stdin, output: process.stdout})
        .on('SIGINT', ()=>process.emit('SIGINT'));
}
let child;
['SIGTERM', 'SIGINT', 'uncaughtException'].forEach(sig=>process.on(sig, err=>{
    child.send({command: 'shutdown', reason: sig+(err ? 'error = '+err : '')});
    setTimeout(()=>process.exit(), 5000);
}));

let shutdown_on_child_exit = ()=>process.exit();
let start_on_child_exit = ()=>{
    child.removeListener('exit', start_on_child_exit);
    setTimeout(()=>create_child(), 5000);
};

let create_child = ()=>{
    child = child_process.fork(path.resolve(__dirname, 'lum_main.js'), args,
        {stdio: 'inherit'});
    child.on('message', msg_handler);
    child.on('exit', shutdown_on_child_exit);
};

let upgrade = cb=>{
    const cmd = 'npm install -g luminati-io/luminati-proxy';
    const opt = {name: 'Luminati Proxy Manager'};
    sudo_prompt.exec(cmd, opt, (e, stdout, stderr)=>{
        if (cb)
            cb(e);
        if (e)
        {
            console.log('Error during upgrade: '+e);
            return;
        }
        if (stderr)
            console.log('NPM stderr: '+stderr);
        delete require.cache[require.resolve('./check_compat.js')];
        check_compat = require('./check_compat.js');
        if (!check_compat.is_env_compat())
            process.exit();
    });
};

let msg_handler = function(msg){
    switch (msg.command)
    {
    case 'shutdown_master': return process.exit();
    case 'restart':
        child.removeListener('exit', shutdown_on_child_exit);
        child.on('exit', start_on_child_exit);
        child.kill();
        break;
    case 'upgrade':
        upgrade(e=>child.send({command: 'upgrade_finished', error: e}));
        break;
    }
};

if (args.some(arg=>arg=='--upgrade'))
{
    upgrade(e=>{
        if (e)
        {
            console.log(`Error during upgrade: ${e}`);
            process.exit();
        }
        console.log('Upgrade completed successfully.');
        create_child();
    });
}
else
    create_child();
