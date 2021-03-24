#!/usr/bin/env node
// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/
const yargs = require('yargs');
const path = require('path');
const os = require('os');
const cluster = require('cluster');
const file = require('./file.js');
const zerr = require('./zerr.js');
const date = require('./date.js');
const BASE_PATH = os.homedir();
const PM_DIRNAME = 'proxy_manager';
const LEGACY_DIRNAME = 'luminati_proxy_manager';
const E = module.exports;

// tells Yargs to show help message from lpm_util usage instead of default one
yargs.help(false);

const log = (msg, ...args)=>{
    let dt = date.to_sql_ms(Date.now());
    if (cluster.isWorker)
        dt = `C${cluster.worker.id} ${dt}`;
    return console.log(`${dt} FILE (${process.pid}): ${msg}`, ...args);
};

const rename_legacy_dir = (legacy_path, pm_path)=>{
    log(`Renaming ${legacy_path} -> ${pm_path}`);
    try {
        file.rename_e(legacy_path, pm_path);
        log('Rename DONE');
        return pm_path;
    } catch(e){
        log(`Rename failed: ${zerr.e2s(e)}`);
        return legacy_path;
    }
};

const init_pm_dir = pm_path=>{
    try {
        file.mkdirp_e(pm_path);
        return pm_path;
    } catch(e){
        log(`Failed to create directory ${pm_path}: ${zerr.e2s(e)}`);
        return BASE_PATH;
    }
};

const mk_work_dir = ()=>{
    const argv = yargs.parse(process.argv.slice(2).map(String));
    if (argv.dir)
        return argv.dir;
    const pm_path = path.resolve(BASE_PATH, PM_DIRNAME);
    if (file.is_dir(pm_path))
        return pm_path;
    const legacy_path = path.resolve(BASE_PATH, LEGACY_DIRNAME);
    if (file.is_dir(legacy_path))
        return rename_legacy_dir(legacy_path, pm_path);
    return init_pm_dir(pm_path);
};

E.work_dir = mk_work_dir();
E.get_file_path = filename=>path.resolve(E.work_dir, filename);
