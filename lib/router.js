// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true, evil: true*/
const url = require('url');
const log = require('./log.js');
const events = require('events');

// XXX krzysztof: get rid of Router class
module.exports = class Router extends events.EventEmitter {
    constructor(opt){
        super();
        this.log = log(opt.listen_port, opt.log);
        this.opt = opt;
        this.proxy_internal_bypass = opt.proxy_internal_bypass;
    }
    is_bypass_proxy(req){
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
};
