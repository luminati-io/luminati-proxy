// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/
const is_pkg = typeof process.pkg!=='undefined';
const logger = require('./logger.js');
const path = require('path');
const os = require('os');
const file = require('../util/file.js');
const etask = require('../util/etask.js');
const {spawn} = require('child_process');
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
    puppeteer.ready = file.exists(chromium_path);
    puppeteer.launch = (opt={})=>{
        if (file.exists(chromium_path))
        {
            opt.executablePath = chromium_path;
            return launch.call(puppeteer, opt);
        }
        setTimeout(fetch_chromium);
        throw new Error('Chromium binary is not fetched');
    };
    puppeteer.open_page = (url, port)=>etask(function*(){
        if (!puppeteer.ready)
            yield fetch_chromium();
        const browser = yield puppeteer.launch({
            headless: false,
            ignoreHTTPSErrors: true,
            args: [
                `--proxy-server=127.0.0.1:${port}`,
                '--ignore-certificate-errors',
                '--ignore-certificate-errors-spki-list',
                '--no-sandbox',
                '--disable-setuid-sandbox',
            ],
        });
        const page = (yield browser.pages())[0] || (yield browser.newPage());
        yield page.goto(url);
        yield browser.disconnect();
    });
} catch(e){ logger.error(e.message); }

let pending;
const fetch_chromium = ()=>etask(function*(){
    if (pending)
    {
        pending.push(this);
        return yield this.wait();
    }
    pending = [];
    logger.notice('Fetching chromium...');
    const install_path = path.resolve(__dirname,
        '../node_modules/puppeteer/install.js');
    const child = spawn('node', [install_path], {
        stdio: ['inherit', 'inherit', 'inherit'],
    });
    child.on('exit', (code, signal)=>{
        if (code==0)
        {
            logger.notice('Chromium fetched successfully!');
            puppeteer.ready = true;
        }
        else
            logger.warn('Could not fetch Chromium');
        this.continue();
    });
    yield this.wait();
    pending.forEach(p=>p.continue());
    pending = null;
});

module.exports = puppeteer;
