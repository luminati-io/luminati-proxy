#!/usr/bin/env node
// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

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
