// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true, evil: true*/
const url = require('url');
const log = require('./log.js');
const {write_http_reply} = require('./util.js');

class Router {
    constructor(opt){
        this.log = log(opt.listen_port, opt.log);
        this.opt = opt;
        this.proxy_internal_bypass = opt.proxy_internal_bypass;
    }
    is_bypass_proxy(req){
        if (req.ctx.is_bypass_proxy)
            return true;
        const _url = req.ctx.url;
        const is_ssl = req.ctx.is_connect;
        const intern = this.proxy_internal_bypass;
        if (!intern)
            return false;
        const match_domain = (mask, hostname)=>{
            let mp = mask.split('.');
            let hp = hostname.split('.').slice(-mp.length);
            return mp.every((p, i)=>p=='*' || hp[i]==p);
        };
        const hostname = is_ssl ? _url.split(':')[0] :
            url.parse(_url).hostname;
        return intern.some(x=>match_domain(x, hostname));
    }
    send_null_response(req, res){
        const ctx = req.ctx;
        let status = req.method=='CONNECT' ? 501 : 200;
        write_http_reply(res, {statusCode: status, statusMessage: 'NULL'});
        res.end();
        ctx.timeline.track('end');
        ctx.response.status_code = status;
        ctx.response.status_message = 'NULL';
        return ctx.response;
    }
    send_internal_redirection(req, res){
        const ctx = req.ctx;
        const port = this.opt.port;
        const _url = encodeURIComponent(ctx.response.request.url_full);
        const hostname = req.socket.remoteAddress=='127.0.0.1' ?
            '127.0.0.1' : this.opt.current_ip;
        const host = `http://${hostname}:${this.opt.www}`;
        const location = `${host}/api_app/confirm_session/${port}/${_url}`;
        const headers = {Location: location};
        write_http_reply(res,
            {statusCode: 302, statusMessage: 'Moved temporarily'}, headers);
        res.end();
        ctx.timeline.track('end');
        ctx.response.status_code = 302;
        ctx.response.status_message = 'Moved temporarily';
        return ctx.response;
    }
}

module.exports = Router;
