// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*//*global window*/
const os = require('os');
const moment = require('moment-timezone');
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
        const {timezone, resolution} = opt;
        const is_win = os.platform()=='win32';
        const launch_opt = {
            headless: false,
            ignoreHTTPSErrors: true,
            args: [
                `--proxy-server=127.0.0.1:${port}`,
                '--ignore-certificate-errors',
                '--ignore-certificate-errors-spki-list',
                '--no-sandbox',
                '--disable-setuid-sandbox',
                ...args_from_opt(Object.assign({}, opt, {is_win})),
            ],
        };
        if (timezone && !is_win)
            launch_opt.env = Object.assign({TZ: timezone}, process.env);
        const browser = yield puppeteer.launch(launch_opt);
        const page = (yield browser.pages())[0] || (yield browser.newPage());
        const backgrounds = browser.targets().filter(t=>
            t.type()=='background_page');
        const timezone_bg = timezone && is_win && (yield backgrounds.find(t=>
            t._targetInfo.title.includes('Timezone')).page());
        if (timezone_bg)
        {
            yield timezone_bg.evaluate(tz=>window.init_tz_listener(tz), {
                timezone_id: timezone,
                offset: -1*moment.tz(timezone).utcOffset()+'',
            });
        }
        if (resolution)
            yield page.setViewport(resolution);
        yield page.goto(url);
        yield browser.disconnect();
    });
} catch(e){ logger.error(e.message); }

const args_from_opt = ({is_win, resolution: res, webrtc, timezone})=>{
    const args = [];
    const extensions = [];
    if (res)
        args.push(`--window-size=${res.width},${res.height}`);
    if (!webrtc)
        extensions.push('webrtc');
    if (timezone && is_win)
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
