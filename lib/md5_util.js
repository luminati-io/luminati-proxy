#!/usr/bin/env node
// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const file = require('hutil').file;

const E = module.exports;

E.md5_files = function(files, opt = {}){
    let hash = crypto.createHash('md5');
    files.forEach(f=>{
        if (opt.root)
            f = path.resolve(opt.root, f);
        if (fs.lstatSync(f).isFile())
            hash.update(fs.readFileSync(f));
    });
    return hash.digest('hex');
};

E.md5_package = function(root_dir = '.'){
    const exclude=/\/(CVS|Jakefile\.js|.*\.swp|\.#.*|.*\.tmp\.js|\.git|\.npmignore|\.cvsignore|\.gitignore|package\.json|publish(_files)?\.js(on)?)$|node_modules|deploy\/|d\//;
    let files = file.find_e(root_dir, {exclude});
    console.log(files);
    return {files, md5: E.md5_files(files)};
};
