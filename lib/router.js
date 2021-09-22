// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true, evil: true*/
const {write_http_reply} = require('./util.js');
const {SESSION_TERMINATED_BODY} = require('./consts.js');
const {res_util} = require('./util.js');

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
        const status = req.method=='CONNECT' ? 501 : 200;
        write_http_reply(res, {statusCode: status, statusMessage: 'NULL'}, {},
            this.opt);
        res.end();
        req.ctx.response.status_code = status;
        req.ctx.response.status_message = 'NULL';
        return req.ctx.response;
    }
    send_cached(req, res, cached){
        const {res_data, headers} = cached;
        write_http_reply(res, {statusCode: 200, statusMessage: 'OK'}, headers,
            this.opt);
        for (let i=0; i<res_data.length; i++)
            res.write(res_data[i]);
        res.end();
        const har_limit = res_util.is_one_of_types({headers},
            ['image', 'javascript', 'css']) ? -1 : this.opt.har_limit;
        req.ctx.response.status_code = 200;
        req.ctx.response.status_message = 'OK';
        req.ctx.response.headers = headers;
        req.ctx.response.body_size = 0;
        for (let i=0; i<res_data.length; i++)
        {
            if (req.ctx.response.body_size>=har_limit)
                break;
            const l = har_limit-req.ctx.response.body_size;
            req.ctx.response.body.push(res_data[i].slice(0, l));
            req.ctx.response.body_size += l;
        }
        return req.ctx.response;
    }
    send_internal_redirection(req, res){
        const _url = encodeURIComponent(req.ctx.response.request.url_full);
        const headers = {
            'content-type': 'text/html',
            'content-length': SESSION_TERMINATED_BODY.length,
            'x-lpm-redirect': _url,
        };
        if (this.opt.debug=='full')
            headers['x-lpm-port'] = this.opt.port;
        write_http_reply(res, {
            statusCode: 400,
            statusMessage: 'Session terminated',
        }, headers, this.opt);
        res.write(SESSION_TERMINATED_BODY, ()=>{ res.end(); });
        req.ctx.response.status_code = 400;
        req.ctx.response.status_message = 'Session terminated';
        req.ctx.response.headers = headers;
        return req.ctx.response;
    }
}

module.exports = Router;
