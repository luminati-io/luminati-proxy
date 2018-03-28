#!/usr/bin/env node
// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/

// XXX marka: use let instead of const because we will re-require it
let check_compat = require('./check_compat.js');

if (!check_compat.is_env_compat())
    process.exit();

const hutil = require('hutil');
const file = hutil.file;
const pm2 = require('pm2');
const child_process = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');
const sudo_prompt = require('sudo-prompt');
const etask = hutil.etask;
const zerr = hutil.zerr;
const is_win = process.platform == 'win32';
const proc_name = 'luminati-proxy-manager';
const daemon_startup_os = ['ubuntu', 'centos', 'redhat', 'gentoo', 'systemd',
    'darwin', 'amazon'];
let log_dir = is_win ? path.resolve(os.homedir(), proc_name)
    : `/var/log/${proc_name}`;

try {
    if (!fs.accessSync(log_dir), fs.constants.W_OK)
        throw new Error('no access to log dir');
    file.mkdirp_e(log_dir);
} catch (e){
    log_dir = path.resolve(os.homedir(), proc_name);
    file.mkdirp_e(log_dir);
}

const pm2_cmd = (command, opt)=>etask(function*pm2_cmd(){
    this.on('uncaught', err=>console.error('PM2 CMD: Uncaught exception:', err,
        err.stack));
    yield etask.nfn_apply(pm2, '.connect', []);
    if (!Array.isArray(opt))
        opt = [opt];
    yield etask.nfn_apply(pm2, '.'+command, opt);
    yield etask.nfn_apply(pm2, '.disconnect', []);
});
let args = process.argv.slice(2);
let deamon_args = {};
let dopt = args.filter(arg=>arg.includes('daemon')||arg=='-d')
.map(arg=>{
    if (arg=='-d'||arg=='--daemon')
        arg = '--start-daemon';
    let match = arg.match(/--([^-]*)-daemon(=.*)?/);
    let res = {};
    if (!match)
        return null;
    res.daemon = true;
    res.name = match[1];
    res.value = match[2];
    return res;
})
.reduce((acc, curr)=>{
    if (!curr)
        return acc;
    acc[curr.name] = curr.value||true;
    return acc;
}, {});
const daemon_start_opt = {
    name: proc_name,
    script: process.argv[1],
    output: path.resolve(log_dir, 'lpm-out.log'),
    error: path.resolve(log_dir, 'lpm-error.log'),
    autorestart: true,
    killTimeout: 5000,
    restartDelay: 5000,
    args: args.filter(arg=>arg!='-d' && !arg.includes('daemon'))
};
if (dopt.start)
    return pm2_cmd('start', daemon_start_opt);
if (dopt.stop)
    return pm2_cmd('stop', proc_name);
if (dopt.delete)
    return pm2_cmd('delete', proc_name);
if (dopt.restart)
    return pm2_cmd('restart', proc_name);
if (dopt.startup)
{
    let pm2_bin = path.resolve(__dirname, '../node_modules/.bin/pm2');
    try {
        child_process.execSync(pm2_bin+' startup');
        child_process.execSync(pm2_bin+' save');
        return;
    } catch(e){
        console.log('Failed to install startup script automatically, ',
            'try running:');
        console.log(e.stdout.toString('utf-8'));
        console.log(pm2_bin+" save");
        return;
    }
}
if (dopt.daemon)
    return;
if (is_win)
{
    const readline = require('readline');
    readline.createInterface({input: process.stdin, output: process.stdout})
        .on('SIGINT', ()=>process.emit('SIGINT'));
}
let child;
['SIGTERM', 'SIGINT', 'uncaughtException'].forEach(sig=>process.on(sig, err=>{
    child.send({command: 'shutdown', reason: sig+(err ? 'master: error = '
        +zerr.e2s(err) : ''), error: zerr.e2s(err)});
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
    const log_file = path.join(process.cwd(), '.luminati_upgrade.log');
    const is_win = /^win/.test(process.platform);
    const npm_cmd = 'npm install --unsafe-perm -g @luminati-io/luminati-proxy';
    const cmd = is_win ? npm_cmd : `bash -c "${npm_cmd} > ${log_file} 2>&1"`;
    const opt = {name: 'Luminati Proxy Manager'};
    sudo_prompt.exec(cmd, opt, (e, stdout, stderr)=>{
        if (cb)
            cb(e);
        if (e)
        {
            console.error('Error during upgrade: '+e);
            if (!is_win)
                console.error(`Look at ${log_file} for more details`);
            return;
        }
        if (stderr)
            console.error('NPM stderr: '+stderr);
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
            console.error(`Error during upgrade: ${e}`);
            process.exit();
        }
        console.error('Upgrade completed successfully.');
        create_child();
    });
}
else
    create_child();
