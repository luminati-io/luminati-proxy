// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true, evil: true, es9: true*/
const url = require('url');
const {v4: uuid_v4} = require('uuid');
const etask = require('../util/etask.js');
const qw = require('../util/string.js').qw;
const restore_case = require('../util/takeup_util.js').restore_case;
const {is_ws_upgrade_req, req_util, get_host_port,
    Timeline} = require('./util.js');
const username = require('./username.js');
const {assign} = Object;
const loopback_ip = '127.0.0.1';
const lpm_headers = qw`x-hola-context proxy-authorization x-hola-agent
    x-lpm-session x-lpm-reserved x-lpm-keep-alive x-lpm-ip x-lpm-country
    x-lpm-state x-lpm-city x-lpm-asn x-lpm-user x-lpm-route x-lpm-ports`;

module.exports = class Context {
    constructor(req, res, serv, opt){
        this.sp = etask(function*context(){ yield this.wait(); });
        serv.sp.spawn(this.sp);
        this.opt = opt||{};
        this.serv = serv;
        this.uuid = uuid_v4();
        this.rules_executed = new Set();
        this.port = opt.listen_port;
        this.req = req;
        this.res = res;
        this.end_listeners = [];
        this.data_listeners = [];
        this.retry = -1;
        this.id = null;
        this.timeline = new Timeline();
        this.proxy_retry = opt.proxy_retry||1;
        this.proxy_port = this.serv.opt.proxy_port;
        this.n_redirects = 0;
    }
    static init_req_ctx(req, res, serv, opt){
        let port = (opt||{}).listen_port, old_ctx;
        if (req.ctx?.n_redirects)
        {
            old_ctx = req.ctx;
            delete req.ctx;
        }
        if (req?.ctx?.port && port && req.ctx.port!=port)
            req.ctx.port = port;
        req.ctx = req.ctx || new Context(req, res, serv, opt);
        req.ctx.serv = serv;
        req.ctx.migrate_from(old_ctx);
        req.ctx.request_start(opt);
        return req.ctx;
    }
    migrate_from(source){
        if (!source || !(source instanceof Context))
            return;
        this.uuid = source.uuid;
        if (source.n_redirects)
            this.n_redirects += source.n_redirects;
        if (source.timeline instanceof Timeline)
            this.timeline = source.timeline;
        if (source.retry > -1)
            this.retry += source.retry;
        if (source.proxy_retry > 1)
            this.proxy_retry += source.proxy_retry;
    }
    request_start(opt){
        this.responded = false;
        this.proxies = [];
        this.retry = this.retry+1;
        this.timeout = this.serv.opt.socket_inactivity_timeout;
        this.id = req_util.gen_id(this.id, this.retry);
        this.ref = (this.ref||0) + 1;
        this.req_url = this.req.url;
        this.url = req_util.full_url(this.req);
        let url_parsed = url.parse(this.url);
        this.domain = url_parsed.hostname;
        this.domain_port = parseInt(url_parsed.port);
        this.process_headers();
        this.src_addr = this.serv.get_req_remote_ip(this.req);
        if (this.src_addr==loopback_ip&&this.h_src_addr)
            this.src_addr = this.h_src_addr;
        this.is_connect = req_util.is_connect(this.req);
        this.is_ssl = req_util.is_ssl(this.req);
        if (!opt.keep_session || !this.session)
            this.session = this.serv.session_mgr.request_session(this.req);
        this.timeline.add(this.port, this.session);
    }
    init_stats(){
        if (this.wait_bw)
            return;
        const sp = etask(function*req_stats(){
            yield this.wait();
        });
        this.wait_bw = sp;
        const request_stats = ()=>{
            this.res.removeListener('finish', request_stats);
            this.res.removeListener('close', request_stats);
            if (!this.req)
            {
                sp.return();
                this.wait_bw = null;
                return;
            }
            const {pr=0, pw=0} = this.req.socket._rstats||{};
            const sk = this.req.socket.ssl &&
                this.req.socket.ssl._parentWrap || this.req.socket;
            this.req.socket._rstats = {pr: sk.bytesRead, pw: sk.bytesWritten};
            this.response.in_bw += sk.bytesWritten - pw;
            this.response.out_bw += sk.bytesRead - pr;
            sp.return();
            this.wait_bw = null;
        };
        this.res.once('finish', request_stats);
        this.res.once('close', request_stats);
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
            this.saved_hdrs = assign({}, this.headers);
        else
        {
            this.headers = this.req.headers = assign({},
                this.req.headers, this.saved_hdrs);
        }
        this.headers.Connection = 'keep-alive';
        if (is_ws_upgrade_req(this.req))
            this.headers.Connection += ',upgrade';
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
                start_time: this.req.start_time,
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
        this.end_listeners = [];
        const cb = chunk=>{ this.response.request.body += chunk; };
        this.data_listeners = [cb];
        this.req.on('data', cb);
    }
    make_response_proxy(srv){
        if (!this.cred)
            this.make_req_cred(srv);
        this.response.proxy = {
            host: this.host,
            proxy_port: this.proxy_port,
            username: this.cred.username,
            password: this.cred.password,
        };
    }
    make_connect_headers(srv){
        if (!this.cred)
            this.make_req_cred(srv);
        this.connect_headers = {
            'proxy-authorization': 'Basic '+
                Buffer.from(this.cred.username+':'+this.cred.password)
                .toString('base64'),
        };
    }
    make_req_cred({opt: sopt}){
        const auth = username.parse(this.h_proxy_authorization) || {};
        if (!auth.password || auth.auth)
            delete auth.password;
        delete auth.auth;
        if (this.h_session)
            auth.session = this.h_session;
        if (this.h_country)
            auth.country = this.h_country;
        if (this.h_state)
            auth.state = this.h_state;
        if (this.h_city)
            auth.city = this.h_city;
        if (this.h_zip)
            auth.zip = this.h_zip;
        if (this.h_asn)
            auth.asn = this.h_asn;
        if (auth.tool)
        {
            delete auth.tool;
            delete auth.password;
        }
        if (this.retry)
        {
            delete auth.zone;
            delete auth.password;
            delete auth.customer;
        }
        const opt = {
            ext_proxy: this.session && this.session.ext_proxy,
            ip: this.h_ip || this.session && this.session.ip || sopt.ip,
            vip: this.session && this.session.vip || sopt.vip,
            session: this.session && this.session.session,
            direct: this.is_direct,
            unblocker: sopt.unblock,
            debug: this.opt.debug,
            const: this.opt.const,
            customer: sopt.customer_id||sopt.account_id||sopt.customer,
        };
        if (this.session && this.session.asn)
            opt.asn = this.session.asn;
        this.cred = username.calculate_username(assign({}, sopt, opt, auth));
    }
    get_socket_name(){
        return this.serv.https_agent.getName({
            servername: this.domain,
            port: 443,
            rejectUnauthorized: false,
            lpm_username: this.cred.username,
            host_port: get_host_port(this),
        });
    }
    complete_req(){
        this.end_listeners = [];
        this.data_listeners = [];
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
        Object.entries(headers).forEach(([k, v])=>{
            formatted[req_header_format[k]||k] = v;
        });
        return formatted;
    }
    rule_executed(rule){
        this.rules_executed.add(rule);
    }
    get_rules_executed(){
        return [...this.rules_executed].map(rule=>{
            const r = assign({}, rule);
            delete r.trigger;
            delete r.trigger_code;
            return r;
        });
    }
    skip_rule(rule){
        if (rule.action.retry)
            return false;
        if (rule.action.cache)
            return false;
        return this.rules_executed.has(rule);
    }
};
