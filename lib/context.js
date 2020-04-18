// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true, evil: true*/
const _ = require('lodash');
const url = require('url');
const uuid_v4 = require('uuid/v4');
const etask = require('../util/etask.js');
const {is_ws_upgrade_req} = require('./util.js');
const restore_case = require('../util/http_hdr.js').restore_case;
const request_stats = require('request-stats');
const qw = require('../util/string.js').qw;
const Timeline = require('./timeline.js');
const {get_host_port} = require('./util.js');

const loopback_ip = '127.0.0.1';
const lpm_headers = qw`x-hola-context proxy-authorization x-hola-agent
    x-lpm-session x-lpm-reserved x-lpm-keep-alive x-lpm-ip x-lpm-country
    x-lpm-state x-lpm-city`;
const req_util = {
    is_ssl: req=>!!req.is_mitm_req,
    is_connect: req=>req.method=='CONNECT',
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
    constructor(req, res, serv, opt){
        this.sp = etask(function*context(){ yield this.wait(); });
        serv.sp.spawn(this.sp);
        this.opt = opt||{};
        this.serv = serv;
        this.uuid = uuid_v4();
        this.rules = serv.rules;
        this.rules_executed = new Set();
        this.port = opt.listen_port;
        this.req = req;
        this.res = res;
        this.end_listeners = [];
        this.data_listeners = [];
        this.retry = -1;
        this.id = null;
        this.timeline = new Timeline(this.port);
        this.proxy_retry = opt.proxy_retry||1;
        this.proxy_port = this.serv.opt.proxy_port;
    }
    static init_req_ctx(req, res, serv, opt){
        const port = (opt||{}).listen_port;
        if (req.ctx && req.ctx.port && port && req.ctx.port!=port)
            req.ctx.port = port;
        req.ctx = req.ctx || new Context(req, res, serv, opt);
        req.ctx.request_start();
        return req.ctx;
    }
    request_start(){
        this.responded = false;
        this.race_reqs = this.opt.race_reqs||0;
        this.proxies = [];
        this.retry = this.retry+1;
        this.timeout = this.serv.opt.socket_inactivity_timeout;
        this.id = req_util.gen_id(this.id, this.retry);
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
        this.is_connect = req_util.is_connect(this.req);
        this.is_ssl = req_util.is_ssl(this.req);
    }
    init_stats(){
        if (this.retry>0)
            return;
        const sp = etask(function*req_stats(){
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
        this.url = this.response.request.url_full = rev.url;
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
                this.req.headers, this.saved_hdrs);
        }
        this.headers.connection = 'keep-alive';
        if (is_ws_upgrade_req(this.req))
            this.headers.connection += ',upgrade';
        lpm_headers.forEach(h=>{
            let v_name = 'h_'+h.replace(/^(x-hola-|x-lpm-|x-luminati-)/, '')
            .replace('-', '_');
            this[v_name] = this.headers[h]||null;
            delete this.headers[h];
        });
    }
    init_response(){
        this.res.x_hola_context = this.h_context;
        this.headers = restore_case(this.headers, this.raw_headers);
        this.response = this.response||{
            uuid: this.uuid,
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
        this.data_listeners.forEach(cb=>this.req.removeListener('data', cb));
        this.end_listeners.forEach(cb=>this.req.removeListener('end', cb));
        const cb = chunk=>{ this.response.request.body += chunk; };
        this.end_listeners = [];
        this.data_listeners = [cb];
        this.req.on('data', cb);
    }
    get_socket_name(){
        return this.serv.https_agent.getName({
            servername: this.domain,
            port: 443,
            rejectUnauthorized: !this.opt.insecure,
            lpm_username: this.cred.username,
            host_port: get_host_port(this),
        });
    }
    complete_req(){
        this.ref--;
        if (this.ref>0)
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
    rule_executed(rule){
        this.rules_executed.add(rule);
    }
    get_rules_executed(){
        return [...this.rules_executed].map(rule=>{
            const r = Object.assign({}, rule);
            delete r.trigger;
            delete r.trigger_code;
            return r;
        });
    }
    skip_rule(rule){
        if (rule.action.retry)
            return false;
        return this.rules_executed.has(rule);
    }
};
