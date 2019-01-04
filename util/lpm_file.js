#!/usr/bin/env node
// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/
const fs = require('fs');
const path = require('path');
const os = require('os');
const file = require('./file.js');
const E = module.exports;
const yargs = require('yargs');

const dir = yargs(process.argv.slice(2).map(String)).argv.dir;
E.work_dir = dir||path.resolve(os.homedir(), 'luminati_proxy_manager');
try { file.mkdirp_e(E.work_dir); }
catch(e){ E.work_dir = path.resolve(os.homedir()); }

E.get_file_path = filename=>{
    const file_path = path.resolve(E.work_dir, filename);
    if (fs.existsSync(file_path))
        return file_path;
    const old_path = path.resolve(os.homedir(), filename);
    if (old_path==file_path)
        return file_path;
    if (fs.existsSync(old_path))
        fs.renameSync(old_path, file_path);
    const backup_path = old_path+'.backup';
    if (fs.existsSync(backup_path))
        fs.renameSync(backup_path, file_path+'.backup');
    let i = 0;
    while (fs.existsSync(old_path+'.'+i))
    {
        fs.renameSync(old_path+'.'+i, file_path+'.'+i);
        i++;
    }
    return file_path;
};
