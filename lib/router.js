// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true, evil: true*/
const url = require('url');
const {write_http_reply} = require('./util.js');
const pkg = require('../package.json');
const proxy_internal_bypass = ['luminati.io', pkg.api_domain];
const {SESSION_TERMINATED_BODY} = require('./consts.js');

class Router {
    constructor(opt){
        this.opt = opt;
    }
    is_bypass_proxy(req){
        if (req.ctx.is_bypass_proxy)
            return true;
        const _url = req.ctx.url;
        const is_ssl = req.ctx.is_connect;
        const match_domain = (mask, hostname)=>{
            let mp = mask.split('.');
            let hp = hostname.split('.').slice(-mp.length);
            return mp.every((p, i)=>p=='*' || hp[i]==p);
        };
        const hostname = is_ssl ? _url.split(':')[0] :
            url.parse(_url).hostname;
        return proxy_internal_bypass.some(x=>match_domain(x, hostname));
    }
    is_fake_request(req){
        return !!req.headers['x-lpm-fake'];
    }
    send_null_response(req, res){
        const ctx = req.ctx;
        const status = req.method=='CONNECT' ? 501 : 200;
        write_http_reply(res, {statusCode: status, statusMessage: 'NULL'});
        res.end();
        ctx.timeline.track('end');
        ctx.response.status_code = status;
        ctx.response.status_message = 'NULL';
        return ctx.response;
    }
    send_internal_redirection(req, res){
        const ctx = req.ctx;
        const _url = encodeURIComponent(ctx.response.request.url_full);
        const headers = {
            'content-type': 'text/html',
            'content-length': SESSION_TERMINATED_BODY.length,
            'x-lpm-redirect': _url,
            'x-lpm-port': this.opt.port,
        };
        write_http_reply(res,
            {statusCode: 400, statusMessage: 'Session terminated'}, headers);
        res.write(SESSION_TERMINATED_BODY, ()=>{ res.end(); });
        ctx.timeline.track('end');
        ctx.response.status_code = 400;
        ctx.response.status_message = 'Session terminated';
        ctx.response.headers = headers;
        return ctx.response;
    }
}

module.exports = Router;
