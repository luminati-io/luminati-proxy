// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/
const etask = require('../util/etask.js');
const zdate = require('../util/date.js');
const file = require('../util/file.js');
const zurl = require('../util/url.js');
const request = require('request').defaults({gzip: true});
const ssl = require('./ssl.js');
const log = require('./log.js');
const os = require('os');
const zpath = require('path');
const Nightmare = require('nightmare');

const proc_name = 'luminati_proxy_manager';

class Tracer {
    constructor(ws, proxies_running, log_lvl){
        this.ws = ws;
        this.proxies_running = proxies_running;
        this.log = log('tracer', log_lvl);
    }
    trace(opt={}){
        let url = opt.url;
        const port = opt.port;
        const _this = this;
        const redirects = [];
        return etask(function*tracer_trace(){
            let res, next;
            do {
                _this.ws.broadcast({redirects, tracing_url: url}, 'tracer');
                res = yield _this.request(url, port);
                if (res.error)
                    return {redirects, err: res.error.message};
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
            const result = {redirects, err: false, loading_page: false};
            result.filename = yield _this.open_page(url, port, redirects, opt);
            return result;
        });
    }
    request(url, port){
        const opt = {url, method: 'GET', followRedirect: false};
        if (+port)
        {
            opt.proxy = 'http://127.0.0.1:'+port;
            if (this.proxies_running[port].opt.ssl)
                opt.ca = ssl.ca.cert;
            opt.headers = {'x-hola-context': 'PROXY TESTER TOOL'};
        }
        const sp = etask(function*req_stats(){ yield this.wait(); });
        request(opt, (e, http_res)=>{
            if (e)
                return sp.return({error: e.message});
            sp.return(http_res);
        });
        return sp;
    }
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
    open_page(url, port, redirects, opt){
        const _this = this;
        file.mkdirp_e(Tracer.screenshot_dir);
        const nightmare = Nightmare({show: false, switches: {
            'proxy-server': `127.0.0.1:${port}`,
            'ignore-certificate-errors': true,
        }});
        const filename = `screenshot_${+zdate()}.png`;
        const path = `${Tracer.screenshot_dir}/${filename}`;
        let last = url;
        function redirectfunction(e, prev_url, next_url, _, status,
            method, r2, headers)
        {
            if (zurl.parse(last).hostname!=zurl.parse(prev_url).hostname)
                return;
            console.log('REDIRECT from %s to %s with code %s, %s, %s\n\n',
                prev_url, next_url, status, _, r2);
            last = next_url;
            redirects.push({url: next_url, code: 200});
            _this.ws.broadcast({redirects, tracing_url: null, traced: true},
                'tracer');
        }
        function navigatefunction(_, _url){
            console.log('NAVIGATE to %s', _url);
            last = _url;
            redirects.push({url: _url, code: 200});
            _this.ws.broadcast({redirects, tracing_url: null, traced: true},
                'tracer');
        }
        return etask(function*(){
            yield nightmare
                .on('did-get-redirect-request', redirectfunction)
                .on('will-navigate', navigatefunction)
                .goto(url);
            if (!opt.screenshot)
                return yield nightmare.end();
            yield nightmare.screenshot(path).end();
            return filename;
        });
    }
}

Tracer.screenshot_dir = zpath.resolve(os.homedir(), proc_name+'/screenshots');

module.exports = Tracer;
