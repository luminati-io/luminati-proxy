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
const DIRNAME = 'proxy_manager';
const LEGACY_DIRNAME = 'luminati_proxy_manager';
const E = module.exports;

// tells Yargs to show help message from lpm_util usage instead of default one
yargs.help(false);

const fmt_log_date = ()=>{
    let dt = date.to_sql_ms(Date.now());
    if (cluster.isWorker)
        dt = `C${cluster.worker.id} ${dt}`;
    return dt;
};

const log = (msg, ...args)=>
    console.log(`${fmt_log_date()} FILE (${process.pid}): ${msg}`, ...args);

const backup_dir = src=>{
    let backup;
    try {
        backup = path.resolve(BASE_PATH,
            `${src}_${date.to_log_file(Date.now())}_${process.pid}_backup`);
        file.copy_r_e(src, backup, {no_overwrite: 1, verbose: 1});
        log(`Directory backup DONE: ${backup}`);
        return backup;
    } catch(e){
        console.log(`Directory backup failed: ${zerr.e2s(e)}`);
        if (backup)
            file.rm_rf_e(backup);
        return false;
    }
};

const migrate_legacy_dir = (legacy_path, new_path)=>{
    log(`Migrating ${legacy_path} -> ${new_path}`);
    let legacy_bup;
    if (!(legacy_bup = backup_dir(legacy_path)))
        return legacy_path;
    try {
        file.rename_e(legacy_path, new_path);
        log('Migration DONE');
        file.rm_rf_e(legacy_bup);
        log('Removed backup directory');
        return new_path;
    } catch(e){
        console.log(`Migration failed: ${zerr.e2s(e)}`);
        if (file.is_dir(legacy_bup) && file.readdir_e(legacy_bup).length)
        {
            log(`Restoring from backup: ${legacy_bup}`);
            file.rm_rf_e(legacy_path);
            file.rm_rf_e(new_path);
            file.rename_e(legacy_bup, legacy_path);
            log(`Restored backup -> ${legacy_path}`);
        }
        return legacy_path;
    }
};

const init_new_path = new_path=>{
    try {
        file.mkdirp_e(new_path);
        return new_path;
    } catch(e){
        console.log(`Failed to create directory ${new_path}: ${zerr.e2s(e)}`);
        return BASE_PATH;
    }
};

const mk_work_dir = ()=>{
    const argv = yargs.parse(process.argv.slice(2).map(String));
    if (argv.dir)
        return argv.dir;
    const new_path = path.resolve(BASE_PATH, DIRNAME);
    if (file.is_dir(new_path))
        return new_path;
    const legacy_path = path.resolve(BASE_PATH, LEGACY_DIRNAME);
    if (file.is_dir(legacy_path))
        return migrate_legacy_dir(legacy_path, new_path);
    return init_new_path(new_path);
};

E.work_dir = mk_work_dir();
E.get_file_path = filename=>path.resolve(E.work_dir, filename);
