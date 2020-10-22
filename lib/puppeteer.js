// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/
const logger = require('./logger.js');
const path = require('path');
const file = require('../util/file.js');
const etask = require('../util/etask.js');
const lpm_config = require('../util/lpm_config.js');
const {spawn, fork} = require('child_process');
let puppeteer;
try {
    puppeteer = require('puppeteer');
    const launch = puppeteer.launch;
    puppeteer.ready = file.exists(puppeteer.executablePath());
    puppeteer.launch = (opt={})=>{
        if (file.exists(puppeteer.executablePath()))
            return launch.call(puppeteer, opt);
        setTimeout(fetch_chromium);
        throw new Error('Chromium binary is not fetched');
    };
    puppeteer.open_page = (url, port, opt={})=>etask(function*(){
        if (!puppeteer.ready)
            yield fetch_chromium();
        const launch_opt = {
            headless: false,
            ignoreHTTPSErrors: true,
            args: [
                `--proxy-server=127.0.0.1:${port}`,
                '--ignore-certificate-errors',
                '--ignore-certificate-errors-spki-list',
                '--no-sandbox',
                '--disable-setuid-sandbox',
                ...args_from_opt(opt),
            ],
        };
        const {timezone, resolution} = opt;
        if (timezone)
            launch_opt.env = Object.assign({TZ: timezone}, process.env);
        const browser = yield puppeteer.launch(launch_opt);
        const page = (yield browser.pages())[0] || (yield browser.newPage());
        if (resolution)
            yield page.setViewport(resolution);
        yield page.goto(url);
        yield browser.disconnect();
    });
} catch(e){ logger.error(e.message); }

const args_from_opt = ({resolution: res, webrtc})=>{
    const args = [];
    if (res)
        args.push(`--window-size=${res.width},${res.height}`);
    if (webrtc=='disabled')
    {
        const ext_path = path.resolve(__dirname, '../extensions', 'webrtc');
        args.push(`--disable-extensions-except=${ext_path}`,
            `--load-extension=${ext_path}`);
    }
    return args;
};

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
    let child;
    if (lpm_config.is_win)
        child = fork(install_path, {stdio: [0, 1, 2, 'ipc']});
    else
        child = spawn('node', [install_path], {stdio: 'inherit'});
    child.on('exit', (code, signal)=>{
        if (code==0)
        {
            logger.notice('Chromium fetched successfully');
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
