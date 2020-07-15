// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true, evil: true*/
const {write_http_reply} = require('./util.js');
const {SESSION_TERMINATED_BODY} = require('./consts.js');

class Router {
    constructor(opt){
        this.opt = opt;
    }
    is_bypass_proxy(req){
        return req.ctx.is_bypass_proxy;
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
