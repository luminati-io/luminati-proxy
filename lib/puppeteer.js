// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/
const is_pkg = typeof process.pkg!=='undefined';
const logger = require('./logger.js');
const path = require('path');
const os = require('os');
let puppeteer;
try {
    const install_path = path.resolve(os.homedir(), 'luminati_proxy_manager');
    puppeteer = require('puppeteer');
    const chromium_path = is_pkg ?
        puppeteer.executablePath().replace(
            /^.*?(\/|\\)node_modules(\/|\\)puppeteer(\/|\\)\.local-chromium/,
            path.resolve(install_path, 'chromium')) :
        puppeteer.executablePath();
    const launch = puppeteer.launch;
    puppeteer.launch = (opt={})=>{
        opt.executablePath = chromium_path;
        return launch.call(puppeteer, opt);
    };
} catch(e){ logger.warn('puppeteer not found'); }
module.exports = puppeteer;
