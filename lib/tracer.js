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
const puppeteer = require('puppeteer');
const Nightmare = require('nightmare');
const string = require('../util/string.js');
const qw = string.qw;
const proc_name = 'luminati_proxy_manager';

Nightmare.action('filter', function(name, opt, parent, win, renderer, done){
    parent.on('filter', function(headers){
        win.webContents.session.webRequest.onBeforeSendHeaders((det, cb)=>{
            parent.emit('log', 'load-filter', det);
            return cb({cancel: false, requestHeaders: Object.assign({},
                det.requestHeaders, headers)});
        });
        parent.emit('filter');
    });
    done();
    return this;
}, function(headers, done){
    this.child.once('filter', done);
    this.child.emit('filter', headers);
});

class Tracer {
    constructor(ws, proxies_running, zones, log_lvl){
        this.ws = ws;
        this.proxies_running = proxies_running;
        this.zones = zones;
        this.log = log('tracer', log_lvl);
    }
    trace(opt={}){
        let url = opt.url;
        const auth_opt = _.pick(opt, qw`country city state`);
        const cred_headers = this.calc_cred_header(opt.port, auth_opt);
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
                const p = new Puppeteer(_this.ws, _this.log, redirects);
                const ss = yield p.load_page(url, headers, opt);
                Object.assign(result, ss);
                if (!opt.html)
                    delete result.html;
                result.redirects_count = result.redirects.length;
            }
            return result;
        });
    }
    calc_headers(h){
        const res = {};
        if (h.user_agent)
            res['User-Agent'] = h.user_agent;
        let headers = {};
        try { headers = JSON.parse(h.headers); }
        catch(e){ }
        return Object.assign(res, headers);
    }
    calc_cred_header(port, opt={}){
        opt.tool = 'link_tester';
        const password = _.get(this,
            `proxies_running.${port}.config.password`);
        const user = Object.keys(opt).map(k=>`${k}-${opt[k]}`).join('-');
        return {
            'proxy-authorization': 'Basic '+
                Buffer.from(user+':'+password).toString('base64'),
        };
    }
    request(url, port, headers){
        const conf = {url, method: 'GET', followRedirect: false};
        if (port&&headers)
        {
            conf.proxy = `http://127.0.0.1:${port}`;
            if (this.proxies_running[port].opt.ssl)
                conf.ca = ssl.ca.cert;
            conf.headers = headers;
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
        const nightmare_opt = {
            show: false,
            switches: {
                'proxy-server': `127.0.0.1:${opt.port}`,
                'ignore-certificate-errors': true,
            },
        };
        let electron;
        try {
            electron = require(
                '../node_modules/nightmare/node_modules/electron');
        } catch(e){
            try { electron = require('../node_modules/electron'); }
            catch(e){ this.log.warn('taking screenshots may not work'); }
        }
        if (electron)
            nightmare_opt.electronPath = electron;
        const nightmare = Nightmare(nightmare_opt);
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
            try {
                const html = yield nightmare
                .filter(headers)
                .on('did-get-redirect-request', redirectfunction)
                .on('will-navigate', navigatefunction)
                .goto(url)
                /* jshint -W117 */
                .evaluate(function(){
                    // this code is executed in the browser without lodash
                    const get = (obj, path)=>{
                        path = path.split('.');
                        let i = 0;
                        while (i<path.length&&path[i]&&(obj = obj[path[i]]))
                            i++;
                        return obj;
                    };
                    return get(document, 'documentElement.outerHTML')||
                        get(document, 'body.outerHTML')||
                        get(document, 'body.innerHTML')||'';
                });
                if (!opt.screenshot)
                    yield nightmare.end();
                else
                    yield nightmare.screenshot(path).end();
                return {filename, path, html};
            } catch(e){ return {err: e.message}; }
        });
    }
}

class Puppeteer {
    constructor(ws, _log, redirects){
        this.ws = ws;
        this.log = _log;
        this.redirects = redirects;
    }
    dump_frame_tree(frame, indent){
        this.log.info(indent+frame.url());
        for (let child of frame.childFrames())
            this.dump_frame_tree(child, indent+'  ');
    }
    set_browser_hooks(browser){
        const _this = this;
        browser.on('targetchanged', target=>{
            const next_url = target.url();
            if (_this.redirects.some(r=>r.url==next_url))
                return;
            _this.redirects.push({url: next_url, code: 200});
            _this.ws.broadcast({redirects: _this.redirects, tracing_url: null,
                traced: true}, 'tracer');
        });
        browser.on('targetcreated', target=>{
            _this.log.info('<TargetCreated>', target.url());
        });
    }
    set_page_hooks(page){
        const _this = this;
        page.on('frameattached', frame=>{
            _this.log.info('<FrameAttached>', frame.name(), frame.url());
        });
        page.on('framenavigated', frame=>{
            _this.log.info('<FrameNavigated>', frame.name(), frame.url());
        });
        page.on('response', res=>{
            _this.log.info('<Response>', res.status(), res.url());
        });
        page.on('load', ()=>{
            _this.log.info('Load event dispatched');
        });
        page.on('pageerror', err=>{
            _this.log.info('Page error: ', err);
        });
        page.on('requestfailed', req=>{
            _this.log.info('Req Failed: ', req.url());
        });
        page.on('requestfinished', req=>{
            _this.log.info('Req Finished: ', req.url());
        });
        page.on('error', err=>{
            _this.log.info('[Page Error] ', err.message);
        });
        page.on('request', req=>{
            _this.log.info('Intercept '+req.resourceType()+' '+req.url());
            req.continue();
        });
    }
    load_page(url, headers, opt={}){
        const _this = this;
    return etask(function*(){
        const args = [
            `--proxy-server=127.0.0.1:${opt.port}`,
            '--ignore-certificate-errors',
            '--ignore-certificate-errors-spki-list ',
        ];
        _this.log.info('Launching browser with the following args: '
        +JSON.stringify(args));
        const browser = yield puppeteer.launch({args,
            ignoreHTTPSErrors: true, headless: true});
        _this.set_browser_hooks(browser);
        const page = yield browser.newPage();
        yield page.setExtraHTTPHeaders(headers);
        yield page.setRequestInterception(true);
        _this.set_page_hooks(page);
        let done = false;
        let err = false;
        const partial_tasks = etask(function*(){
            yield etask.sleep(500);
            while (!done&&opt.live)
            {
                const ss = yield _this.make_screenshot(page);
                _this.ws.broadcast(Object.assign({}, ss, {loading_page: true}),
                    'tracer');
                yield etask.sleep(2000);
            }
        });
        const main_task = etask(function*(){
            try {
                yield page.goto(url, {timeout: 60000,
                    waitUntil: ['networkidle2', 'load']});
                _this.dump_frame_tree(page.mainFrame(), '');
                done = true;
            } catch(e){
                done = true;
                err = e.message;
            }
        });
        yield etask.all([main_task, partial_tasks]);
        let ss = {};
        if (opt.screenshot)
            ss = yield _this.make_screenshot(page);
        /* jshint -W117 */
        const html = yield page.evaluate(()=>{
            // this code is executed in the browser without lodash
            const get = (obj, path)=>{
                path = path.split('.');
                let i = 0;
                while (i<path.length&&path[i]&&(obj = obj[path[i]]))
                    i++;
                return obj;
            };
            return get(document, 'documentElement.outerHTML')||
                get(document, 'body.outerHTML')||
                get(document, 'body.innerHTML')||'';
        });
        yield browser.close();
        return Object.assign({}, ss, {html, err});
    }); }
    make_screenshot(page){
        // XXX krzysztof refactor creating and managing directories
        file.mkdirp_e(Tracer.screenshot_dir);
        return etask(function*(){
            const filename = `screenshot_${+zdate()}.png`;
            const path = `${Tracer.screenshot_dir}/${filename}`;
            yield page.screenshot({path});
            return {filename, path};
        });
    }
}

Tracer.screenshot_dir = zpath.resolve(os.homedir(), proc_name+'/screenshots');

module.exports = Tracer;
