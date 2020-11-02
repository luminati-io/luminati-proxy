// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*//*global window*/
const moment = require('moment-timezone');
const logger = require('./logger.js').child({category: 'Browser'});
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
        const {timezone, resolution} = opt;
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
        const browser = yield puppeteer.launch(launch_opt);
        const page = (yield browser.pages())[0] || (yield browser.newPage());
        if (timezone)
            yield init_timezone(timezone, browser);
        if (resolution)
            yield page.setViewport(resolution);
        yield page.goto(url);
        yield browser.disconnect();
    });
} catch(e){ logger.error(e.message); }

const init_timezone = (timezone_id, browser)=>etask(function*(){
    const backgrounds = browser.targets().filter(t=>
        t.type()=='background_page');
    const timezone_bg = yield backgrounds.find(t=>
        t._targetInfo.title.includes('Timezone')).page();
    if (!timezone_bg)
        return logger.error('Failed browser timezone initialization');
    yield timezone_bg.evaluate(tz=>window._init(tz), {
        timezone_id,
        offset: moment.tz(timezone_id).utcOffset(),
    });
});

const args_from_opt = ({resolution: res, webrtc, timezone})=>{
    const args = [];
    const extensions = [];
    if (res)
        args.push(`--window-size=${res.width},${res.height}`);
    if (!webrtc)
        extensions.push('webrtc');
    if (timezone)
        extensions.push('timezone');
    return [...args, ...extensions_arg(extensions)];
};

const extensions_arg = (extensions=[])=>{
    if (!extensions.length)
        return [];
    const paths = extensions.map(ext=>path.resolve(__dirname,
        '../extensions', ext)).join(',');
    const make_arg = key=>`${key}=${paths}`;
    return ['--disable-extensions-except', '--load-extension'].map(make_arg);
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
