// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/
const is_pkg = typeof process.pkg!=='undefined';
const zerr = require('../util/zerr.js');
const path = require('path');
let puppeteer;
try {
    puppeteer = require('puppeteer');
    const chromium_path = is_pkg ?
        puppeteer.executablePath().replace(
            /^.*?(\/|\\)node_modules(\/|\\)puppeteer(\/|\\)\.local-chromium/,
            path.join(path.dirname(process.execPath), 'chromium')) :
        puppeteer.executablePath();
    const launch = puppeteer.launch;
    puppeteer.launch = (opt={})=>{
        opt.executablePath = chromium_path;
        return launch.call(puppeteer, opt);
    };
} catch(e){ zerr.warn('puppeteer not found'); }
module.exports = puppeteer;
