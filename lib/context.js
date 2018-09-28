// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true, evil: true*/
const _ = require('lodash');
const tls = require('tls');
const etask = require('../util/etask.js');
const log = require('./log.js');
const url = require('url');
const restore_case = require('../util/http_hdr.js').restore_case;
const request_stats = require('request-stats');
const qw = require('../util/string.js').qw;
const Timeline = require('./timeline.js');

const loopback_ip = '127.0.0.1';
const lpm_headers = qw`x-hola-context proxy-authorization x-hola-agent
    x-lpm-src-addr x-lpm-session x-hola-timeline-debug x-lpm-reserved`;
const req_util = {
    is_ssl: req=>req.socket instanceof tls.TLSSocket,
    is_connect: req=>req.method == 'CONNECT',
    full_url: req=>{
        if (!req_util.is_ssl(req))
            return req.url;
        const _url = req.url.replace(/^(https?:\/\/[^/]+)?\//,
            req.headers.host+'/');
        return `https://${_url}`;
    },
    gen_id: (id, retry)=>{
        if (!id)
            id = 'r-0-'+rand_range(1, 1000000);
        if (retry)
            id = id.replace(/-[0-9]*-/, `-${retry}-`);
        return id;
    },
};
const rand_range = (start=0, end=1)=>Math.round(
    start+Math.random()*(end-start));

module.exports = class Context {
    constructor(req, res, lum, opt){
        this.sp = etask(function*context(){ yield this.wait(); });
        lum.sp.spawn(this.sp);
        this.opt = opt||{};
        this.lum = lum;
        this.rules = lum.rules;
        this.banlist = lum.banlist;
        this.agent = lum.protocol;
        this.port = opt.listen_port;
        this.log = log(this.port, opt.log);
        this.req = req;
        this.res = res;
        this.retry = -1;
        this.id = null;
        this.timeline = new Timeline(this.port);
        this.proxy_retry = opt.proxy_retry||1;
        this.proxy_port = this.lum.opt.proxy_port;
    }
    static init_req_ctx(req, res, lum, opt={}){
        // XXX maximk: should handle retry in a new context
        req.ctx = req.ctx || new Context(req, res, lum, opt);
        req.ctx.request_start();
        return req.ctx;
    }
    request_start(){
        this.responded = false;
        this.race_reqs = this.opt.race_reqs||0;
        this.proxies = [];
        this.retry = this.retry+1;
        this.timeout = this.lum.opt.socket_inactivity_timeout;
        this.id = req_util.gen_id(this.id, this.retry);
        this.log = log(`${this.port} ${this.id}`, this.opt.log);
        // XXX maximk: should handle retry with a new timeline
        this.ref = (this.ref||0) + 1;
        if (this.retry)
            this.timeline.retry(this.port);
        this.req_url = this.req.url;
        this.url = req_util.full_url(this.req);
        this.domain = url.parse(this.url).hostname;
        this.process_headers();
        this.src_addr = this.req.connection.remoteAddress;
        if (this.src_addr==loopback_ip&&this.h_src_addr)
            this.src_addr = this.h_src_addr;
        this.response = {};
        this.is_connect = req_util.is_connect(this.req);
        this.is_ssl = req_util.is_ssl(this.req);
    }
    init_stats(){
        if (!this.response)
            this.init_response();
        // can be create several times due to retry
        let sp = etask(function*req_stats(){
            yield this.wait();
        });
        this.sp.spawn(sp);
        this.wait_bw = sp;
        request_stats(this.req, this.res, rstats=>{
            this.response.in_bw += rstats.res.bytes;
            this.response.out_bw += rstats.req.bytes;
            sp.return();
        });
    }
    set_reverse_lookup_res(rev){
        if (!rev)
            return;
        this.url = rev.url;
        this.domain = rev.hostname;
    }
    process_headers(){
        this.headers = this.req.headers;
        this.raw_headers = this.req.rawHeaders;
        if (!this.saved_hdrs)
            this.saved_hdrs = Object.assign({}, this.headers);
        else
        {
            this.headers = this.req.headers = Object.assign({},
                this.saved_hdrs);
        }
        lpm_headers.forEach(h=>{
            let v_name = 'h_'+h.replace(/^(x-hola-|x-lpm-)/, '')
            .replace('-', '_');
            this[v_name] = this.headers[h]||null;
            delete this.headers[h];
        });
    }
    init_response(){
        this.res.x_hola_context = this.h_context;
        this.headers = restore_case(this.headers, this.raw_headers);
        this.response = {
            request: {
                method: this.req.method,
                url: this.req_url,
                url_full: this.url,
                headers: this.headers,
                raw_headers: this.raw_headers,
                body: '',
            },
            timeline: this.timeline,
            body_size: 0,
            context: this.h_context||'RESPONSE',
            body: [],
            in_bw: 0,
            out_bw: 0,
        };
        [this.req, this.res].forEach(r=>qw`data end`.forEach(e=>{
            let ev;
            if (r[ev = `_on${e}`])
            {
                r.removeListener(e, r[ev]);
                delete r[ev];
            }
        }));
        this.req.on('data', this.req._ondata = chunk=>{
            this.response.request.body += chunk; });
        // XXX ovidiu: remove this when eventemitter possible leak fixed
        this.res.setMaxListeners(45);
    }
    complete_req(){
        this.ref--;
        if (this.ref > 0)
            return;
        this.sp.return();
        delete this.req;
    }
    // capitalize the outgoing headers the same way the incoming request did
    format_headers(headers){
        let req_header_format = {};
        for (let i = 0; i<this.raw_headers.length; i+=2)
        {
            let header = this.raw_headers[i];
            req_header_format[header.toLowerCase()] = header;
        }
        let formatted = {};
        _.forEach(headers, (v, k)=>{
            formatted[req_header_format[k]||k] = v;
        });
        return formatted;
    }
};
