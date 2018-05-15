// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/
const _ = require('lodash');
const events = require('events');
const http = require('http');
const https = require('https');
const dns = require('dns');
const url = require('url');
const tls = require('tls');
const net = require('net');
const fs = require('fs');
const zlib = require('zlib');
const stringify = require('json-stable-stringify');
const find_iface = require('./find_iface.js');
const stream = require('stream');
const request = require('request');
const request_stats = require('request-stats');
const util = require('util');
const log = require('./log.js');
const username = require('./username.js');
const http_shutdown = require('http-shutdown');
const Socks = require('./socks.js');
const ssl = require('./ssl.js');
const hutil = require('hutil');
const version = require('../package.json').version;
const etask = hutil.etask;
const zurl = hutil.url;
const zutil = hutil.util;
const zerr = hutil.zerr;
const date = hutil.date;
const restore_case = hutil.http_hdr.restore_case;
const analytics = require('universal-analytics');
const ua = analytics('UA-60520689-2');
const qw = hutil.string.qw;
const assign = Object.assign;
const E = module.exports = Luminati;
const zproxy_port = 22225;
E.pool_types = {
    sequential: 0,
    'round-robin': 1,
};
E.user_agent = 'luminati-proxy-manager/'+version;
E.hola_agent = 'proxy='+version+' node='+process.version
+' platform='+process.platform;
// should be similar to lpm certificate
E.https_servername = 'zproxy.luminati.io';
E.default_superproxy_domain = 'zproxy.lum-superproxy.io';
E.superproxy_domains = ['zproxy.lum-superproxy.io', 'zproxy.luminati.io',
    'zproxy.luminati-china.io'];
E.default = {
    port: 24000,
    iface: '0.0.0.0',
    customer: process.env.LUMINATI_CUSTOMER,
    password: process.env.LUMINATI_PASSWORD,
    zone: process.env.LUMINATI_ZONE||'static',
    log: 'error',
    proxy: E.default_superproxy_domain,
    proxy_port: zproxy_port,
    proxy_count: 1,
    allow_proxy_auth: true,
    pool_type: 'sequential',
    sticky_ip: false,
    insecure: false,
    secure_proxy: false,
    short_username: false,
    ssl: false,
    whitelist_ips: [],
    test_url: 'http://lumtest.com/myip.json',
    disable_color: false,
    proxy_retry: 2,
    proxy_switch: 2,
    api: 'https://luminati-china.io',
};
E.dropin = assign({}, E.default, {
    port: zproxy_port,
    listen_port: zproxy_port,
    multiply: false,
    sticky_ip: true,
    allow_proxy_auth: true,
    pool_size: 0,
    max_requests: 0,
    keep_alive: false,
    session_duration: 0,
    session: false,
    seed: false,
});
const lpm_headers = qw`x-hola-context proxy-authorization x-hola-agent
    x-lpm-src-addr x-lpm-session x-hola-timeline-debug x-lpm-firewall-check
    x-lpm-reserved`;
const loopback_ip = '127.0.0.1';
const ip_re = /^(https?:\/\/)?(\d+\.\d+\.\d+\.\d+)([$/:?])/i;

let write_http_reply = (_stream, res, headers)=>{
    headers = assign(headers||{}, res.headers||{});
    if (_stream.x_hola_context)
        headers['x-hola-context'] = _stream.x_hola_context;
    if (_stream.cred)
        headers['x-lpm-authorization'] = _stream.cred;
    _stream.resp_written = true;
    if (_stream instanceof http.ServerResponse)
        return _stream.writeHead(res.statusCode, res.statusMessage, headers);
    let head = `HTTP/1.1 ${res.statusCode} ${res.statusMessage}\r\n`;
    for (let field in headers)
        head += `${field}: ${headers[field]}\r\n`;
    _stream.write(head+'\r\n');
};

let is_superproxy_domain = d=>E.superproxy_domains.includes(d);

let reverse_lookup_dns = ip=>etask(function*resolve(){
    try {
        let domains = yield etask.nfn_apply(dns, '.reverse', [ip]);
        return domains&&domains.length ? domains[0] : ip;
    } catch(e){ return ip; }
});

let reverse_lookup_values = values=>{
    const domains = {};
    for (let line of values)
    {
        const m = line.match(/^\s*(\d+\.\d+\.\d+\.\d+)\s+([^\s]+)/);
        if (m)
            domains[m[1]] = m[2];
    }
    return ip=>domains[ip]||ip;
};

let req_remote_ip = req=>{
    if (req.original_ip)
        return req.original_ip;
    if (req.headers['x-lpm-src-addr'])
        return req.headers['x-lpm-src-addr'];
    if (req.socket)
    {
        if (req.socket.remoteAddress)
            return req.socket.remoteAddress;
        if (req.socket.socket && req.socket.socket.remoteAddress)
            return req.socket.socket.remoteAddress;
    }
    return null;
};

const rand_range = (start=0, end=1)=>Math.round(
    start+Math.random()*(end-start));

const parse_ip_url = url=>{
    let match = url.match(ip_re);
    if (!match)
        return null;
    return {url: match[0]||'', protocol: match[1]||'', ip: match[2]||'',
        suffix: match[3]||''};
};

const parse_proxy_string = (_url, defaults)=>{
    if (!_url.match(/^(http|https|socks|socks5):\/\//))
        _url = `http://${_url}`;
    _url = Object.assign({}, defaults, _.omitBy(url.parse(_url), v=>!v));
    let proxy = {
        protocol: _url.protocol,
        host: _url.hostname,
        port: _url.port,
        username: _url.username,
        password: _url.password
    };
    let auth = [];
    if (_url.auth)
        auth = _url.auth.split(':');
    proxy.username = auth[0]||proxy.username||'';
    proxy.password = auth[1]||proxy.password||'';
    return proxy;

};

const req_util = {
    is_ssl: req=>req.socket instanceof tls.TLSSocket,
    is_connect: req=>req.method == 'CONNECT',
    full_url: req=>{
        if (!req_util.is_ssl(req))
            return req.url;
        let url = req.url.replace(/^(https?:\/\/[^\/]+)?\//,
            req.headers.host+'/');
        return `https://${url}`;
    },
    gen_id: (id, retry)=>{
        if (!id)
            id = 'r-0-'+rand_range(1, 1000000);

        if (retry)
            id=id.replace(/-[0-9]*-/, `-${retry}-`);
        return id;
    },
};

const create_count_stream = resp=>(new stream.Transform({
    transform(data, encoding, cb){
        if (resp.body_size<1024)
            resp.body.push(data.slice(0, 1024-resp.body_size));
        resp.body_size += data.length;
        cb(null, data);
    },
}));

class Router extends events.EventEmitter {
    constructor(opt){
        super();
        this.log = log(opt.listen_port, opt.log);
        this.opt = opt;
        if (opt.null_response)
            this.null_response = new RegExp(opt.null_response, 'i');
        if (opt.bypass_proxy)
            this.bypass_proxy = new RegExp(opt.bypass_proxy, 'i');
        if (opt.direct_include||opt.direct_exclude)
        {
            this.direct = {
                include: opt.direct_include&&new RegExp(opt.direct_include,
                    'i'),
                exclude: opt.direct_exclude&&new RegExp(opt.direct_exclude,
                    'i'),
            };
        }
        this.proxy_internal_bypass = opt.proxy_internal_bypass;
    }
    is_null_response(url, req){
        if (req && !this.is_bypass_proxy(req) && req.ctx.only_bypass)
            return true;
        return this.null_response && this.null_response.test(url);
    }
    is_fw_check(req){
        return !!req.ctx.h_firewall_check;
    }
    is_proxy_req(req){
        return !(this.is_fw_check(req)||this.is_null_response(req.ctx.url, req)
            ||this.is_bypass_proxy(req));
    }
    send_fw_check_resp(req, res){
        return res.end(JSON.stringify({pass: true}));
    }
    send_null_response(req, res){
        const ctx = req.ctx;
        ctx.log.debug('Returning null response: %s %s', req.method, ctx.url);
        let status = req.method=='CONNECT' ? 501 : 200;
        write_http_reply(res, {statusCode: status, statusMessage: 'NULL'});
        res.end();
        ctx.timeline.track('end');
        ctx.response.status_code = status;
        ctx.response.status_message = 'NULL';
        return ctx.response;
    }
    is_bypass_proxy(req){
        let ctx = req.ctx;
        let _url = ctx.url;
        let is_ssl = ctx.is_connect;
        let only_bypass = ctx.only_bypass;
        let intern = this.proxy_internal_bypass;
        let match_domain = (mask, hostname)=>{
            let mp = mask.split('.');
            let hp = hostname.split('.').slice(-mp.length);
            return mp.every((p, i)=>p=='*' || hp[i]==p);
        };
        if (this.bypass_proxy && this.bypass_proxy.test(_url))
            return true;
        if (!intern && !only_bypass)
            return false;
        let hostname = is_ssl ? _url.split(':')[0] : url.parse(_url).hostname;
        return intern && intern.some(x=>match_domain(x, hostname))
            || only_bypass && only_bypass.some(x=>match_domain(x, hostname));
    }
    is_direct(_url){
        return this.direct && (
            this.direct.include && this.direct.include.test(_url) ||
            !(this.direct.exclude && this.direct.exclude.test(_url)));
    }
}

class Context {
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
        this.timeline = new Timeline();
        this.only_bypass = this.opt.only_bypass;
        this.proxy_retry = opt.proxy_retry || 1;
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
        this.req_timeout = this.req.timeout||0;
        this.sys_timeout = this.opt.timeout*1000 || 0;
        this.timeout = Math.min(this.sys_timeout, this.req_timeout);
        this.id = req_util.gen_id(this.id, this.retry);
        this.log = log(`${this.port} ${this.id}`, this.opt.log);
        // XXX maximk: should handle retry with a new timeline
        this.ref = (this.ref||0) + 1;
        if (this.retry)
            this.timeline.retry();
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
    track_success(is_success){
        if (!this.response)
            this.init_response();
        this.response.success = is_success;
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
        this.headers = this.rules ? this.headers :
            restore_case(this.headers, this.raw_headers);
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
}

function Sess_mgr(lum, opt){
    events.EventEmitter.call(this);
    this.opt = opt;
    this.log = lum.log;
    this.lum = lum;
    this.reserved_sessions = [];
    this.reserved_keep_alive = (this.opt.reserved_keep_alive||50)*date.ms.SEC;
    this.setMaxListeners(Number.MAX_SAFE_INTEGER);
    if (opt.session_duration)
    {
        this.session_duration = (''+opt.session_duration).split(':')
        .map(i=>+i*1000);
        if (this.session_duration.length==1)
            this.session_duration = this.session_duration[0];
    }
    if (opt.max_requests)
    {
        if (opt.max_requests==0)
            this.max_requests = 0;
        else
        {
            this.max_requests = (''+opt.max_requests).split(':').map(i=>+i)
            .filter(i=>i);
        }
    }
    this.password = encodeURIComponent(opt.password);
    this.pool_type = E.pool_types[opt.pool_type]||E.pool_types.sequential;
    this.session_id = 1;
    this.sticky_sessions = {};
    this.keep_alive = opt.keep_alive && opt.keep_alive*1000;
    this.reserved_keep_alive =
        (opt.keep_alive||opt.reserved_keep_alive||50)*1000;
    this.seed = opt.seed||
        Math.ceil(Math.random()*Number.MAX_SAFE_INTEGER).toString(16);
    if ((opt.max_requests||opt.session_duration||this.keep_alive) &&
        !opt.pool_size&&!opt.sticky_ip&&opt.session!==true)
    {
        // XXX lee, gilad - can this warning be removed
        this.log.warn('empty pool_size, session flags are ignored');
    }

}

util.inherits(Sess_mgr, events.EventEmitter);

Sess_mgr.prototype.start = function(){
    this.sp = etask(function*sesssion_manager(){ yield this.wait(); });
};

Sess_mgr.prototype.calculate_username = function(opt){
    opt = assign.apply({}, [this.opt, this, opt].map(o=>_.pick(o||{},
        qw`customer zone country state city session asn dns request_timeout
        cid ip raw direct debug password mobile vip carrier ext_proxy`)));
    if (opt.ext_proxy)
    {
        return Object.assign({password: opt.password},
            _.pick(opt.ext_proxy, 'username', 'password'));
    }
    let opt_usr = _.omit(opt, qw`request_timeout password`);
    if (opt_usr.ip)
        opt_usr = _.omit(opt_usr, qw`session`);
    if (opt.request_timeout)
        opt_usr.timeout = opt.request_timeout;
    return {username: username.calc(opt_usr, this.opt.short_username),
        password: opt.password};
};

Sess_mgr.prototype.refresh_sessions = function(){
    this.log.notice('Refreshing all sessions');
    this.emit('refresh_sessions');
    if (this.opt.pool_size)
    {
        if (this.pool_type==E.pool_types.sequential && this.sessions
            && this.sessions.sessions.length)
        {
            this.stop_keep_alive(this.sessions.sessions.shift());
            this.pool_fetch();
        }
        else
        {
            // XXX marka/lee: set flag for other instncies of current session
            // that can be in use (in _pool_fetch)
            if (this.sessions)
                this.sessions.canceled = true;
            this.sessions = {sessions: []};
            if (this.pool_type==E.pool_types['round-robin'])
               this.pool(this.opt.pool_size);
            this.pool_ready = true;
        }
    }
    if (this.opt.sticky_ip)
    {
        this.sticky_sessions.canceled = true;
        this.sticky_sessions = {};
    }
    if (this.opt.session==true && this.session)
    {
        this.stop_keep_alive(this.session);
        this.session = null;
    }
};

Sess_mgr.prototype.establish_session = function(prefix, pool){
    let session_id, ips, ip, vips, vip, cred, session, host;
    let ext_proxy, ext_proxies, proxy_port;
    if (pool.canceled||this.stopped)
        return;
    ips = this.opt.ips||[];
    vips = this.opt.vips||[];
    ext_proxies = this.opt.ext_proxies||[];
    session_id = `${prefix}_${this.session_id++}`;
    ext_proxy = ext_proxies[this.session_id%ext_proxies.length];
    if (ext_proxy)
    {
        ext_proxy = parse_proxy_string(ext_proxy, {
            username: this.opt.ext_proxy_username,
            password: this.opt.ext_proxy_password,
            port: this.opt.ext_proxy_port,
        });
        host = ext_proxy.host;
        proxy_port = ext_proxy.port;
    }
    else
    {
        host = this.lum.hosts.shift();
        this.lum.hosts.push(host);
        vip = vips[this.session_id%vips.length];
        ip = ips[this.session_id%ips.length];
    }
    cred = this.calculate_username({ip: ip, session: session_id,
        vip: vip, ext_proxy: ext_proxy});
    session = {
        host: host,
        session: session_id,
        ip: ip,
        vip: vip,
        ext_proxy: ext_proxy,
        count: 0,
        bandwidth_max_downloaded: 0,
        created: Date.now(),
        username: cred.username,
        pool: pool,
        proxy_port: proxy_port,
    };
    this.log.info('new session added %s:%s', host, session_id);
    const max_requests = this.max_requests;
    if (max_requests && !session.max_requests)
    {
        session.max_requests = max_requests[0];
        if (max_requests.length>1)
        {
            session.max_requests += Math.floor(Math.random()*
                (max_requests[1]-max_requests[0]+1));
        }
    }
    return session;
};

Sess_mgr.prototype.pool_fetch = function(){
    let pool = this.sessions;
    let session = this.establish_session(
        `${this.lum.port}_${this.seed}`, pool);
    if (session)
        pool.sessions.push(session);
};

Sess_mgr.prototype.pool = function(count){
    if (!count)
        return;
    for (let i=0; i<count; i++)
        this.pool_fetch();
    this.log.debug('initialized pool - %s', this.opt.pool_size);
    this.pool_ready = true;
};

Sess_mgr.prototype.update_session = etask._fn(
function*sess_mgr_update_session(_this, session){
    const res = yield _this.info_request(session,
        (_this.opt.request_timeout||60)*1000, 'SESSION INFO');
    session.info = res.info;
});

Sess_mgr.prototype.update_all_sessions = etask._fn(
function*sess_mgr_update_all_sessions(_this){
    let sessions = _this.sessions&&_this.sessions.sessions ||
        _this.opt.sticky_ip && _.values(_this.sticky_sessions) ||
        _this.session && [_this.session] || [];
    if (!sessions.length)
        return;
    let tasks = [];
    for (let i=0; i<sessions.length; i++)
        tasks.push(_this.update_session(sessions[i]));
    yield etask.all(tasks);
});

Sess_mgr.prototype.set_keep_alive = etask._fn(
function*set_keep_alive(_this, session){
    let keep_alive = session.reserved ? _this.reserved_keep_alive
        : _this.keep_alive;
    if (!keep_alive)
        return;
    _this.stop_keep_alive(session);
    session.keep_alive = this;
    while (session.keep_alive)
    {
        _this.log.debug('Schedule keep alive %s:%s', session.host,
            session.session);
        yield etask.sleep(keep_alive);
        yield _this._keep_alive_handler(session);
    }
    _this.log.warning('session %s: keep alive ended', session.session);
});

Sess_mgr.prototype._keep_alive_handler = etask._fn(
function*_keep_alive_handler(_this, session){
    if (!session.reserved && _this.is_session_expired(session)
        || _this.lum.stopped)
    {
        return false;
    }
    _this.log.info('Keep alive %s:%s', session.host, session.session);
    let res = yield _this.info_request(session, _this.opt.request_timeout*1000,
        'SESSION KEEP ALIVE');
    let info = res.info;
    let sess_info = session.info;
    if (!res)
        res = {res: {status_code: 502}, err: 'Unknown Error'};
    let proxy_err = _this.lum._check_proxy_response(session.host, res,
        {from: 'keep alive', error: res.err});
    if (proxy_err||res.err||!info)
    {
        _this.log.warning('session %s: keep alive failed, removing session',
            session.session);
        _this.remove_session(session);
        return proxy_err||res;
    }
    if (!sess_info || !sess_info.ip)
        sess_info = info;
    if (info.ip != sess_info.ip)
    {
        _this.log.warning('session %s: ip change %s -> %s',
            session.session, sess_info.ip, info.ip);
    }
    _this.session.info = sess_info;
    return res;
});


Sess_mgr.prototype.remove_session = function(session){
    session.canceled = true;
    this.stop_keep_alive(session);
    if (session.reserved)
        this.remove_reserved(session);
    if (!session.pool)
        return;
    let sessions = _.isArray(session.pool) ? session.pool :
        session.pool.sessions;
    _.remove(sessions, s=>s===session);
};

Sess_mgr.prototype.stop_keep_alive = function(session){
    if (!session.keep_alive)
        return;
    session.keep_alive.return();
    session.keep_alive = null;
};

Sess_mgr.prototype.is_session_expired = function(session,
    check_only = false)
{
    if (!session||session.canceled||(session.pool&&session.pool.canceled))
        return true;
    const now = Date.now();
    const last_res = session && session.last_res;
    if (last_res && this.lum.banlist.has(last_res.ip))
    {
        this.log.info('session %s:%s expired, ip %s banned', session.host,
            session.session, last_res.ip);
        session.last_res = null;
        return true;
    }
    if (check_only&&!session.pool&&session!=this.session&&!session.reserved)
        return this.stop_keep_alive(session);
    if (check_only)
        this.sp.spawn(this.set_keep_alive(session));
    const duration = this.session_duration;
    if (!check_only)
        session.count++;
    if (!check_only && duration && !session.expire)
    {
        session.expire = now+duration[0];
        if (duration.length>1)
        {
            session.expire += Math.floor(Math.random()*
                (duration[1]-duration[0]+1));
        }
    }
    let expired = session.max_requests && session.count>=session.max_requests
        || session.expire && now>session.expire;
    if (expired&&!session.reserved)
    {
        this.stop_keep_alive(session);
        this.log.debug('session %s:%s expired', session.host, session.session);
    }
    return expired;
};

Sess_mgr.prototype.info_request = etask._fn(
function*info_request(_this, session, timeout, context){
    let host = session.host || _this.lum.hosts[0];
    let cred = _this.calculate_username(session);
    let protocol = _this.opt.secure_proxy ? 'https' : 'http';
    let proxy_url = `${protocol}://${cred.username}:${cred.password}@${host}:${_this.opt.proxy_port}`;
    _this.log.debug('info_request via %s', proxy_url);
    let opt = {
        url: _this.opt.test_url,
        proxy: proxy_url,
        timeout: timeout,
        headers: {
            'x-hola-agent': E.hola_agent,
            host: 'zproxy.hola.org',
        },
        proxyHeaderWhiteList: E.hola_headers,
        proxyHeaderExclusiveList: E.hola_headers,
        followRedirect: false,
    };
    const timeline = new Timeline();
    const res = {
        request: {
            method: 'GET',
            url: opt.url,
            headers: opt.headers,
            body: '',
        },
        timeline: timeline,
        context: context,
        body: '',
        proxy: {
            host: host,
            username: cred.username,
        }
    };
    let err, info;
    try {
        request(opt).on('response', _res=>{
            timeline.track('response');
            assign(res, {
                status_code: _res.statusCode,
                status_message: _res.statusMessage,
                headers: _res.headers,
                raw_headers: _res.rawHeaders,
            });
        }).on('data', data=>res.body+=data)
        .on('error', _err=>{
            err = _err;
            this.continue();
        }).on('end', ()=>{
            timeline.track('end');
            this.continue();
        });
        yield this.wait();
        if (err)
            throw err;
        res.body_size = res.body.length;
        let ct;
        if (res.status_code==200&&(ct = res.headers['content-type'])&&
            ct.match(/\/json/))
        {
            info = JSON.parse(res.body);
        }
       _this.emit('response', res);
       _this.log.debug('info_request %O %O', res, info);
    } catch(e){
        err = e;
        res.status_code = 502;
        _this.log.warn('info_request '+zerr.e2s(err));
    }
    return {res, err, info};
});

Sess_mgr.prototype.request_session = function(req){
    let session = this._request_session(req);
    let ctx = req.ctx;
    let rules = ctx.rules;
    if (session && (!session.session || ctx.retry || ctx.h_session))
    {
        if (session.authorization && this.session &&
            !(this.session.authorization && _.isEqual(session.authorization,
            this.session.authorization)))
        {
            this.session = null;
        }
        if (ctx.h_session && this.session && this.session.session!=
            ctx.h_session)
        {
            this.session = null;
        }
        if (req.session)
            session.session = req.session;
        else if (!this.session && rules && !ctx.h_session)
        {
            this.session = session;
            session.session = rules.gen_session();
        }
        else if (this.session)
            session = this.session;
    }
    return session;
};

Sess_mgr.prototype._request_session = function(req){
    let ctx = req.ctx;
    if (ctx.only_bypass)
        return;
    let authorization = this.opt.allow_proxy_auth &&
        username.parse(ctx.h_proxy_authorization);
    if (authorization)
    {
        if (authorization.timeout)
            authorization.request_timeout = authorization.timeout;
        ctx.log.debug(`Using request authorization %O`, authorization);
        if (ctx.h_session)
            authorization.session = ctx.h_session;
        return {authorization};
    }
    if (ctx.h_session)
        return {session: ctx.h_session};
    if (ctx.h_reserved)
    {
        ctx.log.info('selecting reserved session');
        return this.get_reserved_session();
    }
    if (this.opt.pool_size)
    {
        let sessions;
        if (!this.sessions)
        {
            this.sessions = {sessions: sessions = []};
            if (this.pool_type==E.pool_types['round-robin'])
                this.pool(this.opt.pool_size);
            else
                this.pool_fetch();
            this.pool_ready = true;
        }
        else
        {
            sessions = this.sessions.sessions;
            if (!sessions.length)
                this.pool_fetch();
        }
        let session = sessions[0];
        if (this.is_session_expired(session))
        {
            sessions.shift();
            if (sessions.length<this.opt.pool_size)
                this.pool_fetch();
        }
        else if (this.pool_type==E.pool_types['round-robin'])
            sessions.push(sessions.shift());
        ctx.log.debug(`Selecting pool session %s`, session&&session.session);
        return session;
    }
    if (this.opt.sticky_ip)
    {
        const ip = ctx.src_addr.replace(/\./g, '_');
        if (!this.sticky_sessions[ip])
        {
            this.sticky_sessions[ip] = this.establish_session(
                `${ctx.port}_${ip}_${this.seed}`, this.sticky_sessions);
        }
        let session = this.sticky_sessions[ip];
        if (this.is_session_expired(session))
            this.sticky_sessions[ip] = null;
        ctx.log.debug(`Selecting sticky session %s`, session&&session.session);
        return session;
    }
    if (this.opt.session===true)
    {
        if (!this.session)
            this.session = this.establish_session(this.seed, this);
        let session = this.session;
        if (this.is_session_expired(session))
            this.session = null;
        ctx.log.debug(`Selecting seed session %s`, session&&session.session);
        return session;
    }
    if (this.opt.session)
    {
        if (!this.session)
        {
            this.session = {
                session: this.opt.session,
                count: 0,
                bandwidth_max_downloaded: 0,
                created: Date.now(),
                pool: this,
            };
        }
        let session = this.session;
        this.sp.spawn(this.set_keep_alive(session));
        ctx.log.debug(`Selecting explicit session %s`, session.session);
        return session;
    }
    ctx.log.debug(`Not using session`);
    return {session: false};
};

Sess_mgr.prototype.get_req_cred = function(req){
    const ctx = req.ctx;
    const auth = ctx.session&&ctx.session.authorization||{};
    const opt = {
        ext_proxy: ctx.session&&ctx.session.ext_proxy,
        ip: ctx.session&&ctx.session.ip||this.opt.ip,
        session: ctx.session&&ctx.session.session,
        direct: this.lum.router.is_direct(ctx.url),
        vip: ctx.session&&ctx.session.vip||this.opt.vip,
    };
    return this.calculate_username(assign({}, opt, auth));
};

Sess_mgr.prototype.reserve_session = function(sess){
    if (sess.reserved||_.find(this.reserve_sessions, sess))
        return;
    this.log.info('Adding session '+sess.session+' to reserved pool');
    this.reserved_sessions.push(sess);
    sess.reserved = true;
    this.sp.spawn(this.set_keep_alive(sess));
};

Sess_mgr.prototype.get_reserved_session = function(){
    let sess = this.reserved_sessions[0]||null;
    if (this.reserved_sessions.length>1)
    {
        this.reserved_sessions.shift();
        this.reserved_sessions.push(sess);
    }
    return sess;
};

Sess_mgr.prototype.remove_reserved = function(session){
    this.log.info('delete reserved session %O', session);
    _.delete(this.reserved_sessions, session);
    this.stop_keep_alive(session);
    session.reserved = false;
};

Sess_mgr.prototype.stop = function(){
    if (this.sp)
        this.sp.return();
};

function Luminati(opt, mgr){
    events.EventEmitter.call(this);
    this.mgr = mgr||null;
    this.overload = false;
    this.rejected = 0;
    opt.listen_port = opt.listen_port||opt.port||E.default.port;
    this.log = log(opt.listen_port, opt.log);
    this.http = opt.secure_proxy ? https : http;
    let agents = mgr&&mgr.agents;
    if (!agents)
    {
        agents = {
            http: new http.Agent({keepAlive: true, keepAliveMsecs: 5000}),
            https: new https.Agent({keepAlive: true, keepAliveMsecs: 5000,
                servername: E.https_servername}),
        };
    }
    this.protocol = agents[opt.secure_proxy ? 'https' : 'http'];
    this.req_status_cnt = {total: 0, success: 0};
    opt = this.opt = assign({}, E.default, opt);
    if (opt.rules)
        this.rules = new Rules(this, opt.rules||{});
    this.banlist = new Ip_cache();
    if (opt.timeout)
        this.timeout = opt.timeout*1000;
    this.router = new Router(opt);
    this.router.on('response', res=>this.emit('response', res));
    this.active = 0;
    this.failure = {};
    this.requests_queue = [];
    this.throttle_queue = [];
    if (opt.socks)
    {
        this.socks_server = new Socks({local: opt.socks, remote: opt.port
            ||E.default.port, iface: opt.iface, log: opt.log});
    }
    this.http_server = http.createServer((req, res, head)=>{
        if (this.is_overload())
            return this.send_overload(res, 'http_req');
        if (req.headers.host=='trigger.domain' ||
            /^\/hola_trigger/.test(req.url))
        {
            return res.end();
        }
        if (!req.url.startsWith('http:'))
            req.url = 'http://'+req.headers.host+req.url;
        this.sp.spawn(this._handler(req, res, head));
    }).on('connection', socket=>socket.setNoDelay());
    http_shutdown(this.http_server);
    if (opt.ssl)
    {
        this.authorization = {};
        this.req_remote_ip = {};
        this.https_server = https.createServer(
            assign({requestCert: false}, ssl()),
            (req, res, head)=>{
                if (this.is_overload())
                    return this.send_overload(res, 'https_req');
                let remote_ip = this.req_remote_ip[req.socket.remotePort];
                if (remote_ip && req.socket.remoteAddress=='127.0.0.1')
                {
                    this.log.info('Request ip fixed %s %s', remote_ip,
                        req.url);
                    req.original_ip = remote_ip;
                }
                let authorization = this.authorization[req.socket.remotePort];
                if (authorization)
                    req.headers['proxy-authorization'] = authorization;
                this.sp.spawn(this._handler(req, res, head));
            }
        ).on('connection', socket=>socket.setNoDelay());
        http_shutdown(this.https_server);
        this.http_server.on('connect', (req, res, head)=>{
            if (this.is_overload())
                return this.send_overload(res, 'http_connect');
            if (parse_ip_url(req.url)||zurl.parse(req.url).port==43)
                return this.sp.spawn(this._handler(req, res, head));
            write_http_reply(res, {statusCode: 200, statusMessage: 'OK'});
            const socket = net.connect({host: '127.0.0.1',
                port: this.https_server.address().port});
            socket.setNoDelay();
            let port, authorization = req.headers['proxy-authorization'];
            let remote_ip = req_remote_ip(req);
            socket.on('connect', ()=>{
                port = socket.localPort;
                if (remote_ip)
                    this.req_remote_ip[port] = remote_ip;
                if (authorization)
                    this.authorization[port] = authorization;
            }).on('close', ()=>{
                delete this.authorization[port];
                delete this.req_remote_ip[port];
            });
            socket.on('error', err=>{
                if (this.is_overload(err))
                    return;
                this.log.error(`Socket error: %O`, {
                    authorization: authorization,
                    error: zerr.e2s(err),
                    port: (this.https_server.address()||{}).port
                });
            });
            res.pipe(socket).pipe(res);
            req.on('end', ()=>socket.end());
        });
    }
    else
    {
        this.http_server.on('connect', (req, res, head)=>this.sp.spawn(
            this._handler(req, res, head)));
    }
    if ((opt.history||opt.request_stats) && opt.history_aggregator)
        this.on('response', resp=>this._aggregate_history(resp));
    if (opt.reverse_lookup_dns===true)
        this.reverse_lookup = reverse_lookup_dns;
    else if (opt.reverse_lookup_file && fs.existsSync(opt.reverse_lookup_file))
    {
        this.reverse_lookup = reverse_lookup_values(
            hutil.file.read_lines_e(opt.reverse_lookup_file));
    }
    else if (opt.reverse_lookup_values)
        this.reverse_lookup = reverse_lookup_values(opt.reverse_lookup_values);
    this.session_mgr = new Sess_mgr(this, opt);
    this.session_mgr.on('response', r=>this.emit('response', r));
}

util.inherits(E, events.EventEmitter);

E.prototype._aggregate_history = function(response){
    if (!response||!response.timeline)
    {
        this.perr(new Error('invalid_response'));
        this.log.error('Invalid response %O', response);
        return;
    }
    let headers = response.headers||{};
    let proxy_info = qw`x-hola-timeline-debug x-hola-unblocker-debug`
    .map(h=>headers[h]||'')
    .map(h=>h.match(/(\d+\.\d+\.\d+\.\d+) ([^ ]+)/))
    .find(i=>i)||['', '', ''];
    let node_latency = +((headers['x-hola-timeline-debug']||'')
    .match(/(\d+) ?ms/)||[0, response.timeline.get('response')])[1];
    let data = {
        port: this.port,
        url: response.request.url,
        method: response.request.method,
        request_headers: stringify(response.request.headers),
        request_body: response.request.body,
        response_headers: stringify(headers),
        response_body: _.isArray(response.body) ?
            Buffer.concat(response.body) : response.body,
        status_code: response.status_code,
        status_message: response.status_message,
        timestamp: response.timeline.get('create'),
        elapsed: response.timeline.get_delta('end'),
        response_time: response.timeline.get_delta('response'),
        node_latency: node_latency,
        proxy_peer: proxy_info[1]||headers['x-hola-ip'],
        country: proxy_info[2],
        timeline: stringify(response.timeline.req_chain),
        content_size: response.body_size,
        context: response.context,
    };
    if (response.proxy)
    {
        data.super_proxy = response.proxy.host;
        data.username = response.proxy.username;
    }
    if (response.success)
        data.success = +response.success;
    data.in_bw = response.in_bw;
    data.out_bw = response.out_bw;
    this.opt.history_aggregator(data);
};

E.prototype.get_other_port = function(port){
    if (!this.mgr)
        return null;
    return this.mgr.get_server(port);
};

E.prototype._timeout = function(func, time, param){
    return setTimeout(()=>{
        try { func.call(this, param); }
        catch(e){ this.log.error('Async error '+zerr.e2s(e)); }
    }, time);
};

E.prototype._handler = etask._fn(
function*_handler(_this, req, res, head){
    if (_this.is_overload())
        return _this.send_overload(res, 'handler');
    this.finally(()=>_this.complete_req(this.error, req, res));
    try {
        req._queued = Date.now();
        _this.active++;
        _this.emit('idle', false);
        req.on('error', this.throw_fn());
        res.on('error', this.throw_fn());
        req.on('timeout', ()=>this.throw(new Error('request timeout')));
        let wips = _this.opt.whitelist_ips;
        if (wips.length)
        {
            let ip = req_remote_ip(req), i;
            for (i=0; i<wips.length && wips[i]!=ip; i++);
            if (i==wips.length)
            {
                _this.log.debug('Request ip not in whitelist %s %s',
                    req.url, ip);
                write_http_reply(res, {
                    statusCode: 403,
                    statusMessage: 'Forbidden',
                    headers: {Connection: 'close'},
                });
                res.end();
                return;
            }
        }
        this.info.url = req.url;
        if (_this.opt.throttle && _this.active>_this.opt.throttle)
        {
            _this.log.debug('Placing request on throttle queue');
            _this.throttle_queue.push(this);
            yield this.wait();
        }
        if (_this.opt.only_bypass || _this.hosts && _this.hosts.length)
            return yield _this._request(req, res, head);
        _this.requests_queue.push([req, res, head]);
    } catch(e){
        _this.log.debug('_handler error %s', zerr.e2s(e));
        throw e;
    }
});

E.prototype.complete_req = function(err, req, res){
    if (err)
        this.log.debug('complete err %s', zerr.e2s(err));
    if (err&&this.is_overload(err))
        this.send_overload(res, 'complete');
    else if (err && err.proxy_error)
        this.send_proxy_error(req, res, err);
    else if (err)
        this.send_lpm_error(req, res, err);
    this.active--;
    req.ctx.complete_req();
    this.log.debug('complete req %s, active: %s', req.ctx.id, this.active);
    if (!this.active)
    {
        this.emit('idle', true);
        return;
    }
    if (this.throttle_queue.length)
    {
        this.log.debug('Taking request from throttle queue');
        this.throttle_queue.shift().continue();
    }
};

E.prototype.error_handler = function error_handler(source, err){
    if (this.is_overload(err))
        return;
    this.log.error(source+' error '+zerr.e2s(err));
    let {code} = err;
    if (code=='EADDRINUSE')
    {
        err = new Error(`There's already an application which runs on `+
            `${err.address}:${err.port}`);
        err.raw = true;
        err.code = code;
    }
    err.lum_source = source;
    if (this.listenerCount('error'))
        this.emit('error', err);
    else
        throw err;
};

E.prototype.listen = etask._fn(function*listen(_this, listen_port, hostname){
    _this.proxy = [].concat(_this.opt.proxy);
    _this.session_mgr.start();
    _this.resolve_proxy();
    if (!_this.sp)
    {
        _this.sp = etask(function*luminati_listen(){
            return yield this.wait();
        });
    }
    _this.sp.spawn(_this.session_mgr.sp);
    let _http = _this.http_server, _https = _this.https_server;
    let _socks = _this.socks_server;
    listen_port = listen_port||_this.opt.listen_port||0;
    hostname = hostname||find_iface(_this.opt.iface);
    if (!hostname)
    {
        hostname = '0.0.0.0';
        _this.opt.iface = '0.0.0.0';
    }
    _http.on('error', err=>_this.error_handler('HTTP', err));
    yield etask.nfn_apply(_http, '.listen', [listen_port, hostname]);
    _this.port = !listen_port ? _http.address().port : _this.opt.port
        ||E.default.port;
    if (_https)
    {
        _https.on('error', err=>_this.error_handler('HTTPS', err));
        yield etask.nfn_apply(_https, '.listen', [0, '127.0.0.1']);
        _this.log.debug('HTTPS port: '+_https.address().port);
    }
    if (_socks)
    {
        _socks.on('error', err=>_this.error_handler('SOCKS', err));
        yield _socks.start();
    }
    _this.emit('ready');
    return _this;
});

E.prototype.stop = etask._fn(function*stop(_this, force){
    if (_this.stopped)
        return;
    if (_this.sp)
    {
        _this.sp.return();
        _this.sp = null;
    }
    _this.session_mgr.stop();
    _this.stopped = true;
    let tasks = {};
    if (_this.protocol)
        _this.protocol.destroy();
    const stop_method = force ? '.forceShutdown' : '.shutdown';
    tasks.http = etask.nfn_apply(_this.http_server, stop_method, []);
    if (_this.https_server)
        tasks.https = etask.nfn_apply(_this.https_server, stop_method, []);
    if (_this.socks_server)
        tasks.socks = _this.socks_server.stop(force);
    yield etask.all(tasks);
    return _this;
});

E.prototype._check_proxy_response = function _check_proxy_response(proxy,
    res, context)
{
    let err = new Error();
    let status_code = res.status_code || res.statusCode || 0;
    if (res.headers&&res.headers['x-luminati-error'])
    {
        err.message = res.headers['x-luminati-error'];
        err.code = status_code;
        err.retry = false;
        err.proxy_error = true;
        if (err.code == 502 && err.message.match(/^Proxy Error/))
            err.retry = true;
    }
    if (!err.message)
    {
        delete this.failure[proxy];
        return false;
    }
    if (!this.opt.proxy_switch)
        return err;
    let failures = this.failure[proxy] = (this.failure[proxy]||0)+1;
    this.log.warn('invalid proxy response %O',
        {host: proxy, code: status_code, context: context});
    if (failures>=this.opt.proxy_switch)
    {
        this.log.warn('removing failed proxy server %O', {host: proxy});
        this.sp.spawn(this.remove_proxy(proxy));
    }
    return err;
};

E.prototype.remove_proxy = etask._fn(function*remove_proxy(_this, proxy){
    if (_this.hosts)
    {
        _this.hosts = _this.hosts.filter(h=>h!=proxy);
        if (_this.opt.proxy_cache)
            _this.opt.proxy_cache.remove(proxy);
    }
    if (_this.session_mgr.sessions)
    {
        _this.session_mgr.sessions.sessions = _this.session_mgr
        .sessions.sessions.filter(
            s=>s.proxy!=proxy||_this.session_mgr.stop_keep_alive(s));
    }
    delete _this.failure[proxy];
    yield _this.resolve_proxy();
});

E.prototype.resolve_proxy = etask._fn(function*resolve_proxy(_this){
    if (_this.opt.only_bypass)
        return;
    let hosts = {}, proxies = _this.proxy.slice(0);
    if (!_this.hosts && _this.opt.proxy_cache)
        _this.hosts = yield _this.opt.proxy_cache.get(proxies);
    _this.resolving_proxies = true;
    [].concat(_this.hosts||[]).forEach(h=>hosts[h] = false);
    const timestamp = Date.now();
    while (proxies.length && Object.keys(hosts).length<_this.opt.proxy_count &&
        Date.now()-timestamp<30000)
    {
        let proxy = proxies.shift(), ips;
        if (/^\d+\.\d+\.\d+\.\d+$/.test(proxy))
        {
            _this.log.debug('using super proxy %s', proxy);
            hosts[proxy] = false;
            continue;
        }
        proxies.push(proxy);
        let domain = proxy;
        if (proxy.length==2)
            domain = E.default_superproxy_domain;
        if (is_superproxy_domain(domain))
        {
            domain = `customer-${_this.opt.customer}-`
                +`session-${Date.now()}.${domain}`;
        }
        try {
            _this.log.debug('resolving proxies from %s', domain);
            ips = ips || (yield etask.nfn_apply(dns, '.resolve', [domain]));
            _this.log.debug('resolved %s (%s) %O', proxy, domain, ips);
            ips.forEach(ip=>hosts[ip] = proxy);
        } catch(e){
            _this.log.debug('Failed to resolve %s (%s): %s', proxy, domain,
                zerr.e2s(e));
        }
    }
    _this.hosts = _.shuffle(Object.keys(hosts));
    if (_this.opt.proxy_cache)
        yield _this.opt.proxy_cache.add(_.toPairs(hosts).filter(p=>p[1]));
    if (!_this.hosts.length)
        _this.log.error('Failed to resolve any proxies');
    _this.resolving_proxies = false;
    let queue = _this.requests_queue;
    _this.requests_queue = [];
    queue.forEach(args=>_this._request.apply(_this, args));
});

E.prototype.get_req_host = etask._fn(function*get_req_host(_this, req){
    const {ctx} = req;
    // XXX maximk: watch for resolving hosts here
    if (!ctx.session || !ctx.session.host)
        yield true;
    return ctx.session&&ctx.session.host
        || (ctx.only_bypass ? loopback_ip : _this.hosts[0]);
});

E.prototype.perr = function(id, info, opt){
    let rc = this.mgr.rmt_cfg.get();
    if (info instanceof Error)
        info = {error: info};
    info = Object.assign(
        {opt: this.opt, overloaded: this.is_overload()},
        info||{}
    );
    if (rc.send_proxy_perr)
    {
        if (this.mgr)
            return this.mgr.perr(id, info, opt);
        return zerr.perr(id, info, opt);
    }
    return false;
};

E.prototype.reverse_lookup_url = etask._fn(
function*reverse_lookup_url(_this, url){
    let ip_url, rev_domain;
    if (!_this.reverse_lookup || !(ip_url = parse_ip_url(url)))
        return false;
    rev_domain = yield _this.reverse_lookup(ip_url.ip);
    if (ip_url.ip==rev_domain)
        return false;
    return {
        url: url.replace(ip_url.url,
            `${ip_url.protocol}${rev_domain}${ip_url.suffix}`),
        hostname: rev_domain,
    };
});

E.prototype.init_proxy_req = etask._fn(
function*init_proxy_req(_this, req, res){
    const {ctx} = req;
    ctx.init_stats();
    ctx.session = _this.session_mgr.request_session(req);
    ctx.host = yield _this.get_req_host(req);
    if (_this.router.is_bypass_proxy(req))
        return;
    ctx.proxy_port = ctx.session&&ctx.session.proxy_port || ctx.proxy_port;
    ctx.cred = _this.session_mgr.get_req_cred(req);
    res.cred = ctx.cred.username;
    ctx.log.info('requesting using %s', ctx.cred.username);
    ctx.response.proxy = {
        host: ctx.host,
        username: ctx.cred.username,
    };
    ctx.connect_headers = {
        'proxy-authorization': 'Basic '+
            new Buffer(ctx.cred.username+':'+ctx.cred.password)
            .toString('base64'),
    };
    if (!ctx.ext_proxy)
        ctx.connect_headers['x-hola-agent'] = E.hola_agent;
});

E.prototype._request = etask._fn(function*_request(_this, req, res, head){
    const ctx = Context.init_req_ctx(req, res, _this, _this.opt);
    try {
        // XXX maximk: hack to track detached retry etasks
        if (ctx.req_sp)
            ctx.req_sp.spawn(this);
        if (!ctx.req_sp)
            ctx.req_sp = this;
        if (_this.is_overload())
            throw new Error('overload');
        if (req._queued)
            ctx.timeline.track('queued', req._queued);
        if (_this.reverse_lookup)
        {
            ctx.set_reverse_lookup_res(
                yield _this.reverse_lookup_url(ctx.url));
        }
        if (ctx.rules)
            ctx.rules.pre(req); // XXX shachar: can it redirect from here?
        if (ctx.is_connect && parse_ip_url(ctx.url))
        {
            ctx.log.warn(`HTTPS connection to IP: %s`, ctx.url);
            // XXX maximk: show only if no ip perm
            ctx.log.warn(
                'HTTPS connection to IP will be done from super agent');
        }
        ctx.init_response(req, res, head);
        if (_this.router.is_proxy_req(req))
            yield _this.init_proxy_req(req, res);
        let resp = yield _this.route_req(req, res, head);
        if (resp instanceof Error)
            throw resp;
        if (!resp)
            throw new Error('invalid_response');
        if (ctx.wait_bw)
            yield this.wait_ext(ctx.wait_bw);
        _this.emit('response', resp);
        ctx.req_sp.return(resp);
    } catch(e){
        ctx.log.debug('_request err %s', zerr.e2s(e));
        if (e.message&&e.message.match(/(invalid_response|hang up)/))
            _this.perr(e);
        return ctx.req_sp.throw(e);
    }
});

E.prototype.route_req = etask._fn(function*route_req(_this, req, res, head){
    try {
        const {ctx} = req;
        if (_this.router.is_fw_check(req))
            return _this.router.send_fw_check_resp(req, res);
        if (_this.router.is_null_response(ctx.url))
        {
            ctx.log.debug('requested url %s matches null_response filter %s',
                ctx.url, _this.null_response);
            return _this.router.send_null_response(req, res);
        }
        ctx.log.info('%s:%s - %s %s', req.socket.remoteAddress,
            req.socket.remotePort, req.method, ctx.url);
        // XXX maximk: make sure this is handled in init function instead
        if (!ctx.only_bypass && !_this.hosts.length)
        {
            if (_this.resolving_proxies)
                return _this.requests_queue.push([req, res, head]);
            return this.throw(new Error('No hosts when processing request'));
        }
        if (_this.router.is_bypass_proxy(req))
            this.spawn(_this.send_bypass_req(this, req, res, head));
        else
        {
            this.spawn(_this.send_proxy_req(this, req, res, head, ctx.host));
            for (let i=1; i<ctx.race_reqs; i++)
            {
                ctx.log.debug('racing req %s', i);
                this.spawn(
                    _this.send_proxy_req(this, req, res, head, ctx.host));
            }
        }
        let resp = yield this.wait_child('any');
        // XXX maximk: sometimes retval is not returned directly, why?
        if (resp && resp.child && resp.child.retval)
            return resp.child.retval;
        return resp;
    } catch(e){
        if (_this.is_overload(e))
            return new Error('overload');
        _this.log.debug('route req error %s', zerr.e2s(e));
        return e;
    }
});

E.prototype.send_proxy_req = function(task, req, res, head, host){
    if (req.ctx.is_ssl)
        return this.send_proxy_req_ssl(task, req, res, head, host);
    return this.send_proxy_req_http(task, req, res, head, host);
};

E.prototype._request_handler = etask._fn(
function*_request_handler(_this, req, res, proxy, head, _headers){
    try {
        const ctx = req.ctx;
        const config = _this.config||{};
        const thdl = _this._handle_proxy_timeout(req, res, proxy, head, this);
        if (ctx.timeout)
            proxy.setTimeout(ctx.timeout, thdl);
        proxy
        .on('response', _this._handle_proxy_resp(req, res, proxy, this, head,
            _headers))
        .on('connect', _this._handle_proxy_connect(req, res, proxy,
            this, head))
        .on('error', _this._handle_proxy_error(req, res, proxy, this, head));
        return yield this.wait();
    } catch(e){
        if (_this.is_overload(e))
            return new Error('overload');
        _this.log.debug('request_handle error %s', zerr.e2s(e));
        return e;
    }
});

E.prototype.send_bypass_req = etask._fn(
function*send_bypass_req(_this, task, req, res, head){
    const ctx = req.ctx;
    let proxy;
    if (ctx.is_connect)
    {
        const parts = ctx.url.split(':');
        ctx.response.request.url = `https://${ctx.url}/`;
        proxy = net.connect({host: parts[0], port: +parts[1]});
        proxy.on('connect', ()=>{
            ctx.timeline.track('direct_connect');
            ctx.log.debug('DIRECT CONNECT - %s', ctx.url);
            write_http_reply(res, {statusCode: 200, statusMessage: 'OK'});
            res.pipe(proxy).pipe(res);
            this.return(ctx.response);
        });
        ctx.log.debug('direct proxy CONNECT');
    }
    else
    {
        proxy = request({
            uri: ctx.url,
            host: url.parse(ctx.url).hostname,
            method: req.method,
            path: ctx.req_url,
            headers: ctx.headers,
            rejectUnauthorized: !_this.opt.insecure,
        });
        proxy.on('connect', (_res, socket)=>{
            ctx.timeline.track('direct_connect');
            _res.on('error', this.throw_fn());
            socket.on('error', this.throw_fn());
            ctx.log.debug('DIRECT REQUEST - %s', ctx.url);
        });
        // XXX jesse remove duplication of this block
        if (ctx.response.request.body)
            proxy.write(ctx.response.request.body);
        req.pipe(proxy);
        ctx.log.debug('direct proxy');
    }
    proxy.on('close', ()=>{
        ctx.timeline.track('end');
        this.return(ctx.response);
    }).on('error', this.throw_fn());
    if (!ctx.is_connect)
        return yield _this._request_handler(req, res, proxy, head);
    return yield this.wait();
});

E.prototype.send_proxy_req_ssl = etask._fn(
function*send_proxy_req_ssl(_this, task, req, res, head, host){
    const ctx = req.ctx;
    try {
        ctx.response.request.url = ctx.url;
        _this.http.request({
            host: host,
            port: ctx.proxy_port,
            method: 'CONNECT',
            path: ctx.domain+':443',
            headers: ctx.connect_headers,
            agent: ctx.agent,
            rejectUnauthorized: !_this.opt.insecure,
        })
        .on('connect', (_res, socket, _head)=>{
            this.continue({res: _res, socket, head: _head});
        })
        .on('error', this.throw_fn())
        .end();
        const conn = yield this.wait();
        if (conn.res.statusCode!=200)
        {
            let proxy_err = _this._check_proxy_response(host, conn.res,
                {from: 'error', error: new Error(conn.res.statusMessage)});
            let can_retry = ctx.rules && ctx.rules.can_retry(
                req, ctx.response, {retry: ctx.proxy_retry});
            if (can_retry && proxy_err && proxy_err.retry)
            {
                ctx.log.warn('error proxy %s response, status: %s, retrying',
                    host, conn.res.statusCode);
                ctx.rules.retry(req, res, head);
                return yield this.wait();
            }
            if (proxy_err)
            {
                req.ctx.log.warn('proxy api err %s: %s', proxy_err.code,
                    proxy_err.message);
                throw proxy_err;
            }
        }
        if (ctx.banlist)
        {
            let tl = (conn.res.headers['x-hola-timeline-debug']||'')
                .split(' ');
            let ip = tl && tl.length>=3 && tl[3];
            if (ip && ctx.banlist.has(ip))
            {
                ctx.log.info('ip_banned %s', ip);
                req.session = ctx.rules.gen_session();
                ctx.rules.retry(req, res, head);
                return yield this.wait();
            }
        }
        if (ctx.session)
            _this.session_mgr.is_session_expired(ctx.session, true);
        ctx.timeline.track('connect');
        conn.res.on('error', this.throw_fn());
        conn.socket.on('error', this.throw_fn());
        const proxy = https.request({
            host: ctx.headers.host,
            method: req.method,
            path: req.url,
            headers: ctx.headers,
            proxyHeaderWhiteList: E.hola_headers,
            proxyHeaderExclusiveList: E.hola_headers,
            socket: conn.socket,
            agent: false,
            rejectUnauthorized: !_this.opt.insecure,
        });
        proxy.host = host;
        ctx.proxies.push(proxy);
        // XXX jesse remove duplication of this block
        if (ctx.response.request.body)
            proxy.write(ctx.response.request.body);
        req.pipe(proxy);
        req.on('end', req._onend = ()=>proxy.end());
        if (conn.res.headers['x-hola-timeline-debug'])
        {
            ctx.log.info('timeline-debug %s',
                conn.res.headers['x-hola-timeline-debug']);
        }
        return yield _this._request_handler(req, res, proxy, head,
            conn.res.headers);
    } catch(e){
        if (_this.is_overload(e))
            return new Error('overload');
        _this.log.error('send proxy ssl error %s', zerr.e2s(e));
        return e;
    }
});

E.prototype.send_proxy_req_http = etask._fn(
function*send_proxy_req_http(_this, task, req, res, head, host){
    try {
        const ctx = req.ctx;
        const proxy = _this.http.request({
            host: host,
            port: ctx.proxy_port,
            method: req.method,
            path: ctx.url,
            agent: ctx.agent,
            headers: assign(ctx.connect_headers, ctx.headers),
            proxyHeaderWhiteList: E.hola_headers,
            proxyHeaderExclusiveList: E.hola_headers,
            rejectUnauthorized: !_this.opt.insecure,
        });
        proxy.host = host;
        ctx.proxies.push(proxy);
        if (ctx.is_connect)
            proxy.end();
        else
        {
            // XXX jesse remove duplication of this block
            if (ctx.response.request.body)
                proxy.write(ctx.response.request.body);
            req.pipe(proxy);
            req.on('end', req._onend = ()=>!proxy.aborted&&proxy.end());
        }
        return yield _this._request_handler(req, res, proxy, head);
    } catch(e){
        _this.log.debug('send_proxy_req error %s', zerr.e2s(e));
        return e;
    }
});

E.prototype._handle_proxy_timeout = function(req, res, proxy, head, task){
    return ()=>{
        const ctx = req.ctx;
        ctx.log.debug('handle_proxy_timeout');
        if (ctx.sys_timeout)
            task.throw(new Error(`timeout ${ctx.sys_timeout}`));
        if (!ctx.rules)
            return;
        ctx.log.debug('%s %s - timeout %s', req.method, ctx.url,
            ctx.req_timeout);
        if (res.resp_written || !ctx.rules.can_retry(req));
        else if (ctx.rules.post_timeout(req, res, head))
            return this._abort_proxy_req(req, proxy, task);
    };
};

E.prototype._handle_proxy_resp = function(req, res, proxy, task, head,
    _headers)
{
    return _res=>{
        if (proxy.aborted)
            return;
        const ctx = req.ctx;
        ctx.log.debug('handle_proxy_resp');
        if (ctx.responded)
            return this._abort_proxy_req(req, proxy, task);
        ctx.proxies.forEach(p=>p!=proxy&&this._abort_proxy_req(req, p));
        ctx.responded = true;
        const count$ = create_count_stream(ctx.response);
        try {
            ctx.timeline.track('response');
            let code = `${_res.statusCode}`.replace(/(?!^)./g, 'x');
            ctx.log.info(`${req.method} ${ctx.url} - ${_res.statusCode}`);
            if (ctx.session)
            {
                ctx.session.last_res = {ts: Date.now(), ip:
                    _res.headers['x-hola-ip'], session: ctx.session.session};
            }
            if (ctx.rules)
            {
                _res.hola_headers = _headers;
                if (res.resp_written || !ctx.rules.can_retry(req));
                else if (ctx.rules.post(req, res, head, _res, true))
                    return this._abort_proxy_req(req, proxy);
                else if (ctx.rules.post_need_body(req))
                {
                    ctx.response.body_wait = true;
                    ctx.response._res = _res;
                    _res.on('data', data=>ctx.response.body.push(data));
                    _res.on('end', ()=>{
                        if (ctx.rules.post_body(req, res, head, _res,
                            ctx.response.body))
                        {
                            return this._abort_proxy_req(req, proxy);
                        }
                        write_http_reply(res, _res, _headers);
                        for (let i=0; i<ctx.response.body.length; i++)
                            res.write(ctx.response.body[i]);
                        res.end();
                        ctx.timeline.track('end');
                        assign(ctx.response, {
                            status_code: _res.statusCode,
                            status_message: _res.statusMessage,
                            headers: assign({}, _res.headers,
                            _headers||{}),
                        });
                        ctx.log.info(ctx.timeline.toString());
                        if (this.opt.log=='debug')
                        {
                            ctx.log.debug(util.inspect(ctx.response,
                                {depth: null}));
                        }
                        task.return(ctx.response);
                    }).on('error', task.throw_fn());
                    return;
                }
            }
            if (ctx.session)
                this.session_mgr.is_session_expired(ctx.session, true);
            write_http_reply(res, _res, _headers);
            _res.pipe(count$).pipe(res);
            _res.on('end', ()=>{
                ctx.timeline.track('end');
                assign(ctx.response, {
                    status_code: _res.statusCode,
                    status_message: _res.statusMessage,
                    headers: assign({}, _res.headers, _headers||{}),
                });
                ctx.log.info(ctx.timeline.toString());
                if (this.opt.log=='debug')
                {
                    ctx.log.debug(util.inspect(ctx.response,
                        {depth: null}));
                }
                task.return(ctx.response);
            }).on('error', task.throw_fn());
        } catch(e){ task.throw(e); }
    };
};

E.prototype._handle_proxy_connect = function(req, res, proxy, task, head){
    return (_res, socket, _head)=>{
        if (proxy.aborted)
            return;
        const ctx = req.ctx;
        ctx.log.debug('handle_proxy_connect');
        if (ctx.connected)
            return this._abort_proxy_req(req, proxy);
        ctx.proxies.forEach(p=>p!=proxy&&this._abort_proxy_req(req, p));
        ctx.connected = true;
        const count$ = create_count_stream(ctx.response);
        let end_socket;
        try {
            ctx.timeline.track('connect');
            ctx.log.debug('CONNECT - %s', _res.statusCode);
            let proxy_err = this._check_proxy_response(ctx.host, _res,
                'connect');
            if (proxy_err)
            {
                req.ctx.log.warn('proxy api err %s: %s', proxy_err.code,
                    proxy_err.message);
                return task.throw(proxy_err);
            }
            write_http_reply(res, _res);
            assign(ctx.response, {
                status_code: _res.statusCode,
                headers: _res.headers,
            });
            if (_res.statusCode!=200)
            {
                ctx.log.error('%s %s - %s', req.method, ctx.url,
                    _res.statusCode);
                res.end();
                return task.return(ctx.response);
            }
            if (ctx.session)
                this.session_mgr.is_session_expired(ctx.session, true);
            socket.write(head);
            res.write(_head);
            socket.pipe(count$).pipe(res).pipe(socket);
            end_socket = ()=>socket.end();
            _res.on('error', e=>{
                this.session_mgr
                    .removeListener('refresh_sessions', end_socket);
                task.throw(e);
            });
            socket.on('error', err=>{
                ctx.log.error('Request socket error %s', zerr.e2s(err));
                this.session_mgr
                    .removeListener('refresh_sessions', end_socket);
                if (this.is_overload({code: _res.statusMessage},
                    _res.statusCode))
                {
                    return task.throw(new Error('overload'));
                }
            }).on('end', ()=>{
                this.session_mgr
                    .removeListener('refresh_sessions', end_socket);
                if (ctx.timeline.get('end'))
                    return task.return();
                ctx.timeline.track('end');
                task.return(ctx.response);
            });
            this.session_mgr
                .once('refresh_sessions', end_socket);
        } catch(e){
            if (end_socket)
            {
                this.session_mgr
                    .removeListener('refresh_sessions', end_socket);
            }
            task.throw(e);
        }
    };
};

E.prototype._abort_proxy_req = function(req, proxy, task){
    req.unpipe(proxy);
    proxy.abort();
    proxy.destroy();
    if (task)
        task.return('abort');
};

E.prototype.is_overload = function(err, status){
    const overload_errors = ['EMFILE', 'overload'];
    if (err)
    {
        if (typeof err == 'string')
            err = {message: err};
        for (let i=0; i<overload_errors.length; i++)
        {
            let oerr = overload_errors[i];
            if ((err.code||'') == oerr)
                return true;
            if ((err.message||'').includes(oerr))
                return true;
            if ((err.error||'').includes(oerr))
                return true;
        }
    }
    if (status == 503)
        return true;
    if (!err && this.overload)
        return true;
    return false;
};

E.prototype.send_overload = function(res, context){
    this.rejected++;
    this.log.info('%s, overloaded, rejected %d', context, this.rejected);
    write_http_reply(res, {statusCode: 503, statusMessage: 'LPM - Overloaded',
        headers: {Connection: 'close'}});
    res.end();
    if (res.destroy)
        res.destroy();
    if (res.socket)
        res.socket.destroy();
};

E.prototype.send_proxy_error = function(req, res, err){
    if (!res.ended)
    {
        write_http_reply(res, {statusCode: 502, statusMessage:
            'LPM - Proxy Error', headers: {Connection: 'close',
            'x-lpm-error': err.message}});
    }
    res.end();
};

E.prototype.send_lpm_error = function(req, res, err){
    if (!(err.code||'').includes('ECONNRESET'))
    {
        this.log.error(`complete req %s %s %s`, req.method,
            req.url, err.message);
    }
    if (!res.ended)
    {
        write_http_reply(res, {statusCode: 502, statusMessage:
            'LPM - Bad Gateway', headers: {Connection: 'close',
            'x-lpm-error': err.message}});
    }
    res.end();
};

E.prototype._handle_proxy_error= function(req, res, proxy, task, head){
    return err=>{
        const ctx = req.ctx;
        ctx.log.debug('handle_proxy_err %s', zerr.e2s(err));
        if (proxy.aborted||ctx.responded||ctx.connected)
            return;
        if (this.is_overload(err))
        {
            this._abort_proxy_req(req, proxy);
            return task.throw(new Error('overload'));
        }
        let proxy_err = this._check_proxy_response(ctx.host,
            res||{statusCode: 502}, {from: 'error', error: err});
        let can_retry = ctx.rules && ctx.rules.can_retry(req, ctx.response, {
            retry: ctx.proxy_retry});
        if (proxy_err && proxy_err.can_retry && can_retry)
        {
            ctx.log.warn('error proxy response %s, retrying', ctx.host);
            ctx.rules.retry(req, res, head);
            this._abort_proxy_req(req, proxy);
            return;
        }
        this._abort_proxy_req(req, proxy);
        task.throw(proxy_err||err);
    };
};

E.prototype.request = function(){
    const args = [].slice.call(arguments);
    if (typeof args[0]=='string')
        args[0] = {url: args[0]};
    args[0].proxy = args[0].proxy||`http://127.0.0.1:${this.port}`;
    return request.apply(null, args);
};

E.prototype.banip = function(ip, ms){
    if (!this.banlist)
        return false;
    this.banlist.add(ip, ms);
    return true;
};

E.prototype.unban = function(ip, ms){
    if (!this.banlist)
        return false;
    if (!this.banlist.has(ip))
        return false;
    this.banlist.delete(ip);
    return true;
};

E.prototype.set_overload = function(overload){
    this.overload = overload;
    this.rejected = 0;
};

E.hola_headers = qw`proxy-connection proxy-authentication x-hola-agent
    x-hola-debug x-hola-tunnel-key x-hola-tunnel-ip x-hola-tunnel-session
    x-hola-auth x-hola-unblocker-debug x-hola-session x-hola-cid
    x-hola-country x-hola-forbid-peer x-hola-dst-ips x-hola-ip
    x-hola-immediate x-hola-dns-only x-hola-response x-hola-direct-first
    x-hola-direct-discover x-hola-blocked-response x-hola-conf
    x-hola-headers-only x-hola-unblocker-bext x-hola-dynamic-tunnels
    x-hola-context x-luminati-timeline x-luminati-peer-timeline`;

class Ip_cache {
    constructor(){
        this.cache = new Map();
    }
    add(ip, ms){
        let cache = this.cache;
        let c = cache.get(ip);
        if (!c)
            c = cache.set(ip, {ip: ip}).get(ip);
        else
            clearTimeout(c.to);
        if (ms)
            c.to = setTimeout(()=>cache.delete(c.ip), ms);
    }
    delete(ip){
        if (this.has(ip))
            this.cache.delete(ip);
    }
    has(ip){
        return this.cache.has(ip);
    }
}
E.Ip_cache = Ip_cache;

class Rules {
    constructor(luminati, rules){
        rules = rules||{};
        const priority_cmp = (a, b)=>a.priority-b.priority;
        this.luminati = luminati;
        this.rules = zutil.clone_deep(rules);
        this._post = this.rules.post;
        this._pre = (this.rules.pre||[]).map(p=>{
            p.url_re = new RegExp(zurl.http_glob_url(p.url||'', true));
            p.priority = p.priority||10;
            return p;
        }).sort(priority_cmp);
        this._post = (this.rules.post||[]).map(p=>{
            p.url_re = new RegExp(zurl.http_glob_url(p.url||'', true));
            p.need_body = p.res.filter(r=>r.body).length>0;
            p.priority = p.priority||(p.tag=='req_status' ? 1 : 10);
            return p;
        }).sort(priority_cmp);
    }
    get_time(t){
        let n = t.match(/^(\d+)(ms|sec|min|hr|day)?$/);
        if (!n)
            return 0;
        t = +n[1];
        switch (n[2])
        {
        case 'day': t *= 24*60*60*1000; break;
        case 'hr': t *= 60*60*1000; break;
        case 'min': t *= 60*1000; break;
        case 'sec': t *= 1000; break;
        case 'ms': break;
        }
        return t;
    }
    pre(req){
        if (!this._pre)
            return;
        req.ctx.timeline.track('rules_pre_start');
        let url = req.url_full||req.url;
        for (let i=0; i<this._pre.length; i++)
        {
            let p = this._pre[i];
            if (p.connect)
            {
                if (req.method!='CONNECT' || p.connect!=url)
                    continue;
            }
            else if (!p.url_re.test(url))
                continue;
            if (p.session)
                req.session = this.gen_session();
            if (p.browser)
            {
                switch (p.browser)
                {
                case 'chrome':
                    req.headers['user-agent'] = 'Mozilla/5.0 (Windows NT 10.0;'
                        +' WOW64) AppleWebKit/537.36 (KHTML, like Gecko) '
                        +'Chrome/56.0.2924.87 Safari/537.36';
                    req.headers.accept = 'text/html,application/xhtml+xml,'
                        +'application/xml;q=0.9,image/webp,*/*;q=0.8';
                    req.headers['accept-encoding'] = 'gzip, deflate, sdch, br';
                    req.headers['accept-language'] = 'en-US,en;q=0.8,he;q=0.6';
                    req.headers['upgrade-insecure-requests'] = '1';
                    break;
                case 'firefox':
                    req.headers['user-agent'] = 'Mozilla/5.0 (Windows NT 6.1; '
                        +'WOW64; rv:47.0) Gecko/20100101 Firefox/47.0';
                    req.headers['accept-encoding'] = 'gzip, deflate';
                    req.headers['accept-language'] = 'en-US,en;q=0.5';
                    req.headers.accept = 'text/html,application/xhtml+xml,'
                        +'application/xml;q=0.9,*/*;q=0.8';
                    req.headers['Upgrade-Insecure-Requests'] = '1';
                    req.headers['Cache-Control'] = 'max-age';
                    break;
                }
            }
            if (p.timeout_once && !req.retry)
                req.timeout = this.get_time(p.timeout_once);
            else if (p.timeout)
                req.timeout = this.get_time(p.timeout);
            if (p.header)
                this.handle_pre_header(req, p);
        }
        req.ctx.timeline.track('rules_pre_end');
    }
    handle_pre_header(req, p){
        if (!p.random)
            return req.headers[p.name] = p.arg;
        if (p.random=='list'&&Array.isArray(p.arg))
        {
            let ind = Math.round(Math.random()*p.arg.length-1);
            return req.headers[p.name] = p.arg[ind];
        }
        if (p.random=='string')
        {
            const default_alphabet = 'abcdefghijklmnopqrstufwxyzABCDEFGHIJKLMN'
            +'OPQRSTUFWXYZ1234567890';
            const default_size = 10;
            let val = _.sampleSize(p.alphabet||default_alphabet,
                p.size||default_size).join('');
            return req.headers[p.name] = `${p.prefix||''}${val}`
            +p.suffix||'';
        }
        if (p.random=='user-agent')
        {
            const ua_version = Math.floor(Math.random()*2240)+1000;
            const user_agent = `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_2`
            +`) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/63.0.`
            +`${ua_version}.132 Safari/537.36`;
            return req.headers[p.name] = user_agent;
        }
    }
    _cmp(rule, value){
        if (!rule)
            return false;
        let type = rule.type||'==';
        switch (type)
        {
        case '==': return rule.arg==value;
        case '!=': return rule.arg!=value;
        case '=~':
            if (!rule.arg_re)
                rule.arg_re = new RegExp(rule.arg);
            return rule.arg_re.test(value);
        case '!~':
            if (!rule.arg_re)
                rule.arg_re = new RegExp(rule.arg);
            return !rule.arg_re.test(value);
        case 'in': return rule.arg.includes(value);
        case '!in': return !rule.arg.includes(value);
        }
        return false;
    }
    cmp(rule, value){
        if (!rule)
            return false;
        if (!(rule instanceof Array))
        {
            if (rule.name)
                value = value[rule.name];
            return this._cmp(rule, value);
        }
        for (let i=0; i<rule.length; i++)
        {
            let r = rule[i], v = value;
            if (r.name)
                v = value[rule.name];
            if (this._cmp(r, v))
                return true;
        }
        return false;
    }
    post_timeout(req, res, head){
        if (!this._post)
            return;
        let url = req.url_full||req.url;
        for (let i=0; i<this._post.length; i++)
        {
            let p = this._post[i];
            if (p.connect)
            {
                if (req.method!='CONNECT' || p.connect!=url)
                    continue;
            }
            else if (!p.url_re.test(url))
                continue;
            for (let j=0; j<p.res.length; j++)
            {
                let r = p.res[j];
                if (!r.timeout)
                    continue;
                if (this.action(req, res, head, null, r.action||p.action))
                    return true;
            }
        }
    }
    post(req, res, head, _res, hdrs_only){
        if (!this._post)
            return;
        const ctx = req.ctx;
        ctx.timeline.track('rules_post_start');
        let url = ctx.url;
        for (let i=0; i<this._post.length; i++)
        {
            let p = this._post[i];
            if (p.connect)
            {
                if (req.method!='CONNECT' || p.connect!=url)
                    continue;
            }
            else if (!p.url_re.test(url))
                continue;
            for (let j=0; j<p.res.length; j++)
            {
                let r = p.res[j];
                if (hdrs_only && !r.head)
                    continue;
                if (this.check_req_time_range(req, r)&&_res)
                {
                    if (this.action(req, res, head, _res, r.action||p.action))
                        return true;
                }
                if (r.ipban && _res)
                {
                    let tl = _res.hola_headers&&
                        _res.hola_headers['x-hola-timeline-debug']||
                        _res.headers&&_res.headers['x-hola-timeline-debug'];
                    if (tl)
                    {
                        let ip = tl.split(' ')[3];
                        if (this.luminati.banlist.has(ip) &&
                            this.action(req, res, head, _res,
                            r.action||p.action))
                        {
                            return true;
                        }
                    }
                }
                if (this.cmp(r.status, _res.statusCode))
                {
                    if (this.action(req, res, head, _res, r.action||p.action))
                        return true;
                }
                if (this.cmp(r.header, _res.headers))
                {
                    if (this.action(req, res, head, _res, r.action||p.action))
                        return true;
                }
            }
        }
        ctx.timeline.track('rules_post_end');
    }
    post_body(req, res, head, _res, body){
        if (!this._post)
            return;
        const ctx = req.ctx;
        ctx.timeline.track('rules_body_start');
        let _body = Buffer.concat(body), s;
        switch (_res.headers['content-encoding'])
        {
        case 'gzip':
            s = zlib.gunzipSync(_body, {finishFlush: zlib.Z_SYNC_FLUSH});
            break;
        case 'deflate': s = zlib.inflateSync(_body); break;
        default: s = _body; break;
        }
        _body = s.toString('utf8');
        let url = ctx.url;
        for (let i=0; i<this._post.length; i++)
        {
            let p = this._post[i];
            if (!p.need_body || !p.url_re.test(url))
                continue;
            for (let j=0; j<p.res.length; j++)
            {
                let r = p.res[j];
                if (this.cmp(r.status, _res.statusCode))
                {
                    if (this.action(req, res, head, _res, r.action||p.action))
                        return true;
                }
                if (!r.body)
                    continue;
                if (this.cmp(r.body, _body))
                {
                    if (this.action(req, res, head, _res, r.action||p.action))
                        return true;
                }
            }
        }
        ctx.timeline.track('rules_body_end');
    }
    post_need_body(req){
        if (!this._post)
            return;
        const ctx = req.ctx;
        let url = ctx.url;
        for (let i=0; i<this._post.length; i++)
        {
            let p = this._post[i];
            if (!p.url_re.test(url))
                continue;
            if (!p.need_body)
                continue;
            return true;
        }
        return false;
    }
    check_req_time_range(req, r){
        if (!r.max_req_time && !r.min_req_time)
            return false;
        let req_max = r.max_req_time ? this.get_time(r.max_req_time)
            : +Infinity;
        let req_min = r.min_req_time ? this.get_time(r.min_req_time) : 0;
        let req_time = Date.now()-req.ctx.timeline.req.create;
        return req_time<=req_max && req_time>=req_min;

    }
    retry(req, res, head, port){
        if (!req.retry)
            req.retry = 0;
        req.retry++;
        req.ctx.log.info('req retry %s %s', req.retry, req.ctx.url);
        let serv;
        if (port)
        {
            serv = this.luminati.get_other_port(port);
            delete req.ctx;
        }
        if (!serv)
            serv = this.luminati;
        serv._request(req, res, head);
        return true;
    }
    can_retry(req, response, action){
        let retry = req.retry||0;
        let ret = retry<20;
        let port;
        if (!ret)
        {
            ua.event('rules', 'max_retry', JSON.stringify({url: req.url_full,
                retry: req.retry, user: response&&response.proxy.username}));
        }
        if (action)
        {
            let action_retry = parseInt(action.retry);
            if (action.retry===false)
                action_retry = 0;
            else if (action.retry===true)
                action_retry = 20;
            else if (isNaN(action_retry))
                action_retry = 0;
            ret = !(!action.retry||action_retry<=retry||!ret);
            port = action.retry_port;
            if (port&&!this.luminati.get_other_port(port))
                ret = false;
        }
        return ret;
    }
    gen_session(){
        return 'rand'+Math.floor(Math.random()*9999999+1000000);
    }
    action(req, res, head, _res, action){
        const ctx = req.ctx;
        if (action.req_status_cnt)
            this.req_status(req, !!action.req_status_success);
        if (action.reserve_session)
            this.reserve_session(ctx.session);
        if (!this.can_retry(req, res, action))
            return false;
        if (action.ban_ip && _res)
        {
            let t = this.get_time(action.ban_ip)||1;
            let tl = _res.hola_headers&&
                _res.hola_headers['x-hola-timeline-debug']||
                _res.headers&&_res.headers['x-hola-timeline-debug'];
            if (tl)
                this.luminati.banlist.add(tl.split(' ')[3], t);
            req.session = this.gen_session();
        }
        else if (action.url && _res)
        {
            let url = action.url;
            if (url=='location')
                url = _res.headers.location;
            req.url = url;
        }
        else
            req.session = this.gen_session();
        ctx.timeline.track('rules_post_end');
        ctx.timeline.track('rules_body_end');
        this.retry(req, res, head, action.retry_port);
        return true;
    }
    req_status(req, success){
        req.ctx.track_success(success);
    }
    reserve_session(sess){
        this.luminati.session_mgr.reserve_session(sess);
    }
}
E.Rules = Rules;

class Timeline {
    constructor(){
        // XXX maximk: simplify handle retries differently
        this.create = Date.now();
        this.req = {create: this.create};
        this.req_chain = [this.req];
    }
    track(name, ts){
        this.req[name] = ts||Date.now();
    }
    get_delta(name1, name2, idx, total){
        if (typeof name2!='string'&&!Array.isArray(name2))
        {
            total = idx;
            idx = name2;
            name2 = 'create';
        }
        if (typeof idx=='boolean')
        {
            total = idx;
            idx = this.req_chain.length-1;
        }
        let metric1 = this.get(name1, idx);
        let metric2 = this.get(name2, total ? 0 : idx);
        if (!metric1||!metric2)
            return 0;
        return metric1-metric2;
    }
    get(name, idx, nofb){
        if (typeof idx != 'number')
            idx = this.req_chain.length-1;
        if (!Array.isArray(name))
            name = [name];
        for (let i=0; i<name.length; i++)
        {
            if (this.req_chain[idx][name[i]])
                return this.req_chain[idx][name[i]];
        }
        return null;
    }
    retry(){
        // XXX maximk: should handle retry with a new Timeline instead
        const now = Date.now();
        if (!this.req.end)
            this.req.end = now;
        this.req = {create: now};
        this.req_chain.push(this.req);
    }
    toString(){
        let parts = [`timeline: t:${this.get_delta('end', true)}ms`];
        const fmt_mtr = (name, delta)=>`${name}:${delta}ms`;
        parts = parts.concat(this.req_chain.map((r, i)=>[
            `R${i}`,
            fmt_mtr('t', this.get_delta('end', i)),
            fmt_mtr('q', this.get_delta('queue', i)),
            fmt_mtr('rl_pre', this.get_delta('rules_pre_end',
                'rules_pre_start', i)),
            fmt_mtr('c', this.get_delta('connect', ['queue', 'create'], i)),
            fmt_mtr('r', this.get_delta('response',
                ['connect', 'queue', 'create'], i)),
            fmt_mtr('rl_pst', this.get_delta('rules_post_end',
                'rules_post_start', i)),
            fmt_mtr('rl_pb', this.get_delta('rules_body_end',
                'rules_body_start', i)),
        ].join(' ')));
        return parts.join(' ');
    }
}
E.Timeline = Timeline;

