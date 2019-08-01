#!/usr/bin/env node
// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/
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
    return path.resolve(E.work_dir, filename);
};
