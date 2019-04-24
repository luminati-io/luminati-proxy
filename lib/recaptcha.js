// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true */
const request = require('request').defaults({gzip: true});
const etask = require('../util/etask.js');
const api = 'http://2captcha.com/';
const E = module.exports = {};

const domains = [{
    regex: /google\.com\/recaptcha/,
    init: (rules, token, req, res, head)=>{
        const post_data = 'g-recaptcha-response='+token;
        req.ctx.force_body = post_data;
        req.headers['Content-Length'] = Buffer.byteLength(post_data);
        req.headers['Content-Type'] = 'application/x-www-form-urlencoded';
        req.method = 'POST';
        rules.retry(req, res, head);
    },
}, {
    regex: /redfin\.com/,
    init: (rules, token, req, res, head)=>{
        const post_data = 'g-recaptcha-response='+token;
        req.ctx.force_body = post_data;
        req.headers['Content-Length'] = Buffer.byteLength(post_data);
        req.headers['Content-Type'] = 'application/x-www-form-urlencoded';
        req.method = 'POST';
        rules.retry(req, res, head);
    },
}, {
    regex: /realself\.com/,
    init: (rules, token, req, res, head)=>etask(function*(){
        const params = {r: token, v: '9e41428e-3e92-11e9-b093-0242ac120010',
            u: 'a3e45bb0-3e92-11e9-afba-e55bc27eca1d'};
        const enc = encodeURIComponent(JSON.stringify(params).slice(1, -1));
        const _url = req.url;
        const _method = req.method;
        req.url = 'https://www.realself.com/px/captcha/?pxCaptcha={'+enc+'}';
        req.method = 'GET';
        req.recaptcha_progress = this;
        rules.retry(req, res, head);
        const captcha_resp = yield this.wait();
        req.recaptcha_progress = null;
        let cookie;
        try {
            cookie = captcha_resp._res.headers['set-cookie'][1].split(';')[0];
            req.ctx.log.notice('setting cookie %s', cookie);
        } catch(e){
            req.ctx.log.warn('couldnt read cookie: %s', e.message);
        }
        req.headers.Cookie = cookie;
        req.url = _url;
        req.method = _method;
        rules.retry(req, res, head);
    }),
}];

E.init_captcha_request = (rules, token, req, res, head)=>{
    for (let domain of domains)
    {
        if (domain.regex.test(req.ctx.url))
            return domain.init(rules, token, req, res, head);
    }
    rules.retry(req, res, head);
};

const get_code = (_qs, log, retry=0)=>etask(function*(){
    log.notice('trying to get code, retry: %s', retry);
    const resp = yield etask.nfn_apply(request, [{
        method: 'GET',
        url: api+'res.php',
        qs: _qs,
        json: true,
    }]);
    const code = resp.body.request;
    if (code!='CAPCHA_NOT_READY')
        return code;
    yield etask.sleep(5000);
    return yield get_code(_qs, log, retry+1);
});

E.get_token = (pageurl, key, googlekey, log, auth)=>etask(function*(){
    const qs = {method: 'userrecaptcha', pageurl, key, googlekey, json: 1};
    if (auth && auth.u && auth.p && auth.ip)
    {
        console.log('using auth %s', JSON.stringify(auth));
        qs.proxytype = 'HTTPS';
        qs.proxy = `${auth.u}:${auth.p}@${auth.ip}:22225`;
    }
    const res = yield etask.nfn_apply(request, [{
        method: 'GET',
        url: api+'in.php',
        qs,
        json: true,
    }]);
    const id = res.body.request;
    log.notice('captcha 2captcha id: %s', id);
    yield etask.sleep(10000);
    const _qs = {key, action: 'get', id, json: 1};
    const token = yield get_code(_qs, log);
    log.notice('captcha solved by 2captcha');
    return token;
});
