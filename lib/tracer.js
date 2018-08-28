// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/
const _ = require('lodash');
const etask = require('../util/etask.js');
const zdate = require('../util/date.js');
const file = require('../util/file.js');
const zurl = require('../util/url.js');
const request = require('request').defaults({gzip: true});
const ssl = require('./ssl.js');
const log = require('./log.js');
const os = require('os');
const zpath = require('path');
// const puppeteer = require('puppeteer');
const puppeteer = {};
const Nightmare = require('nightmare');
const string = require('../util/string.js');
const qw = string.qw;
const proc_name = 'luminati_proxy_manager';
const Luminati = require('./luminati.js');

class Tracer {
    constructor(ws, proxies_running, zones, log_lvl){
        this.ws = ws;
        this.proxies_running = proxies_running;
        this.zones = zones;
        this.log = log('tracer', log_lvl);
    }
    trace(opt={}){
        let url = opt.url;
        const targeting = _.pick(opt, qw`country city state`);
        const cred_headers = this.calc_cred_header(opt.port, targeting);
        const custom_headers = this.calc_headers(_.pick(opt,
            qw`user_agent headers`));
        const uid_headers = {};
        if (opt.uid)
            uid_headers['X-Unique-Id'] = opt.uid;
        const headers = Object.assign(uid_headers, cred_headers,
            custom_headers);
        const _this = this;
        const redirects = [];
        return etask(function*tracer_trace(){
            let res, next;
            do {
                _this.ws.broadcast({redirects, tracing_url: url}, 'tracer');
                res = yield _this.request(url, opt.port, headers);
                if (res.error)
                    return {redirects, err: res.error};
                redirects.push({url, code: res.statusCode});
                next = true;
                if (res.headers&&res.headers.location&&
                    res.headers.location.startsWith('/'))
                {
                    const _url = zurl.parse(url);
                    const domain_url = _url.protocol+'//'+_url.hostname;
                    url = domain_url+res.headers.location;
                }
                else if (res.headers&&res.headers.location)
                    url = res.headers.location;
                else
                    next = false;
            } while (/3../.test(res.statusCode)&&next);
            _this.ws.broadcast({redirects, tracing_url: null, traced: true},
                'tracer');
            const result = {redirects, redirects_count: redirects.length,
                err: false, loading_page: false};
            if (opt.skip_full_page===undefined)
            {
                const ss = yield _this.open_page(url, redirects, headers, opt);
                Object.assign(result, ss);
            }
            return result;
        });
    }
    calc_headers(h){
        const agent = Luminati.hola_agent+' tool=link_tester';
        const res = {'x-hola-agent': agent};
        if (h.user_agent)
            res['User-Agent'] = h.user_agent;
        let headers = {};
        try { headers = JSON.parse(h.headers); }
        catch(e){ }
        return Object.assign(res, headers);
    }
    calc_cred_header(port, target){
        const password = _.get(this,
            `proxies_running.${port}.config.password`);
        const user = Object.keys(target).map(k=>`${k}-${target[k]}`).join('-');
        return {
            'proxy-authorization': 'Basic '+
                new Buffer(user+':'+password).toString('base64'),
        };
    }
    request(url, port, headers){
        const conf = {url, method: 'GET', followRedirect: false};
        if (port&&headers)
        {
            conf.proxy = `http://127.0.0.1:${port}`;
            if (this.proxies_running[port].opt.ssl)
                conf.ca = ssl.ca.cert;
            conf.headers = Object.assign({'x-hola-context':
                'PROXY TESTER TOOL'}, headers);
        }
        const sp = etask(function*req_stats(){ yield this.wait(); });
        request(conf, (e, http_res)=>{
            if (e)
                return sp.return({error: e.message});
            sp.return(http_res);
        });
        return sp;
    }
    open_page(url, redirects, headers, opt){
        const _this = this;
        file.mkdirp_e(Tracer.screenshot_dir);
        const nightmare = Nightmare({show: false, switches: {
            'proxy-server': `127.0.0.1:${opt.port}`,
            'ignore-certificate-errors': true,
        }, electronPath: require(
            '../node_modules/nightmare/node_modules/electron')});
        const filename = `screenshot_${+zdate()}.png`;
        const path = `${Tracer.screenshot_dir}/${filename}`;
        let last = url;
        function redirectfunction(e, prev_url, next_url, _e, status,
            method, r2, _headers)
        {
            if (zurl.parse(last).hostname!=zurl.parse(prev_url).hostname)
                return;
            last = next_url;
            redirects.push({url: next_url, code: 200});
            _this.ws.broadcast({redirects, tracing_url: null, traced: true},
                'tracer');
        }
        function navigatefunction(_e, _url){
            last = _url;
            redirects.push({url: _url, code: 200});
            _this.ws.broadcast({redirects, tracing_url: null, traced: true},
                'tracer');
        }
        return etask(function*(){
            yield nightmare
                .on('did-get-redirect-request', redirectfunction)
                .on('will-navigate', navigatefunction)
                .goto(url, headers);
            if (!opt.screenshot)
                return yield nightmare.end();
            yield nightmare.screenshot(path).end();
            return {filename, path};
        });
    }
}

// XXX krzysztof: this is currently not used but nightmarejs may be swtiched to
// puppeteer in the future
class Puppeteer {
    dump_frame_tree(frame, indent){
        this.log.info(indent+frame.url());
        for (let child of frame.childFrames())
            this.dump_frame_tree(child, indent+'  ');
    }
    set_browser_hooks(browser){
        browser.on('targetchanged', target=>{
            this.log.info('<TargetChanged>', target.url());
        });
        browser.on('targetcreated', target=>{
            this.log.info('<TargetCreated>', target.url());
        });
    }
    set_page_hooks(page){
        page.on('frameattached', frame=>{
            this.log.info('<FrameAttached>', frame.name(), frame.url());
        });
        page.on('framenavigated', frame=>{
            this.log.info('<FrameNavigated>', frame.name(), frame.url());
        });
        page.on('response', res=>{
            this.log.info('<Response>', res.status(), res.url());
        });
        page.on('load', ()=>{
            this.log.info('Load event dispatched');
        });
        page.on('pageerror', err=>{
            this.log.info('Page error: ', err);
        });
        page.on('requestfailed', req=>{
            this.log.info('Req Failed: ', req.url());
        });
        page.on('requestfinished', req=>{
            this.log.info('Req Finished: ', req.url());
        });
        page.on('error', err=>{
            this.log.info('[Page Error] ', err.message);
        });
        page.on('request', req=>{
            this.log.info('Intercept '+req.resourceType()+' '+req.url());
            req.continue();
        });
    }
    screenshot(url, port){
        const _this = this;
    return etask(function*(){
        const args = [
        `--proxy-server=127.0.0.1:${port}`,
           '--ignore-certificate-errors',
           '--ignore-certificate-errors-spki-list ',
           '--enable-features=NetworkService',
        ];
        _this.log.info('Launching browser with the following args: '
        +JSON.stringify(args));
        const browser = yield puppeteer.launch({args,
            ignoreHTTPSErrors: true});
        _this.set_browser_hooks(browser);
        const page = yield browser.newPage();
        yield page.setRequestInterception(true);
        _this.set_page_hooks(page);
        let done = false;
        const partial_tasks = etask(function*(){
            yield etask.sleep(500);
            while (!done)
        {
            const filename = yield _this.make_screenshot(page);
            _this.ws.broadcast({filename, loading_page: true},
            'tracer');
            yield etask.sleep(500);
        }
        });
        const main_task = etask(function*(){
            yield page.goto(url, {timeout: 60000,
                waitUntil: 'networkidle0'});
            _this.dump_frame_tree(page.mainFrame(), '');
            done = true;
        });
        yield etask.all([main_task, partial_tasks]);
        const filename = yield _this.make_screenshot(page);
        yield browser.close();
        return filename;
    }); }
    make_screenshot(page){
        // XXX krzysztof refactor creating and managing directories
        file.mkdirp_e(Tracer.screenshot_dir);
        return etask(function*(){
            const filename = `screenshot_${+zdate()}.png`;
            const path = `${Tracer.screenshot_dir}/${filename}`;
            yield page.screenshot({path});
            return filename;
        });
    }
}

Tracer.screenshot_dir = zpath.resolve(os.homedir(), proc_name+'/screenshots');

module.exports = Tracer;
