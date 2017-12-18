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
E.default = {
    port: 24000,
    iface: '0.0.0.0',
    customer: process.env.LUMINATI_CUSTOMER,
    password: process.env.LUMINATI_PASSWORD,
    zone: process.env.LUMINATI_ZONE||'static',
    log: 'error',
    proxy: 'zproxy.luminati.io',
    proxy_port: zproxy_port,
    proxy_count: 1,
    session_init_timeout: 5,
    allow_proxy_auth: false,
    pool_type: 'sequential',
    sticky_ip: false,
    insecure: false,
    secure_proxy: false,
    short_username: false,
    ssl: false,
    whitelist_ips: [],
    test_url: 'http://lumtest.com/myip.json',
    disable_color: false,
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

let reverse_lookup_dns = ip=>etask(function*resolve(){
    let domains = yield etask.nfn_apply(dns, '.reverse', [ip]);
    return domains&&domains.length ? domains[0] : ip;
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
    if (req.socket)
    {
        if (req.socket.remoteAddress)
            return req.socket.remoteAddress;
        if (req.socket.socket && req.socket.socket.remoteAddress)
            return req.socket.socket.remoteAddress;
    }
    return null;
};

const rand_range = (start=0, end=1)=>(
    Math.round(start+Math.random()*(end-start)));

const ip_re = /^(https?:\/\/)?(\d+\.\d+\.\d+\.\d+)([$/:?])/i;

const parse_ip_url = url=>{
    let match = url.match(ip_re);
    if (!match)
        return null;
    return {url: match[0]||'', protocol: match[1]||'', ip: match[2]||'',
        suffix: match[3]||''};
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
            id=id.replace(/-[0-9]*-/, `-${retry}`);
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

function Router(opt){
    events.EventEmitter.call(this);
    this._log = log(opt.listen_port, opt.log);
    this.opt = opt;
    if (opt.null_response)
        this.null_response = new RegExp(opt.null_response, 'i');
    if (opt.bypass_proxy)
        this.bypass_proxy = new RegExp(opt.bypass_proxy, 'i');
    if (opt.direct_include||opt.direct_exclude)
    {
        this.direct = {
            include: opt.direct_include && new RegExp(opt.direct_include, 'i'),
            exclude: opt.direct_exclude && new RegExp(opt.direct_exclude, 'i'),
        };
    }
    this.proxy_internal_bypass = opt.proxy_internal_bypass;
}

util.inherits(Router, events.EventEmitter);

Router.prototype.is_null_response = function(url){
    return this.null_response && this.null_response.test(url);
};

Router.prototype.send_null_response = function(req, res){
    const ctx = req.ctx;
    ctx.log.debug(`Returning null response: ${req.method}`
        +`${ctx.url}`);
    let status = req.method=='CONNECT' ? 501 : 200;
    write_http_reply(res, {statusCode: status, statusMessage: 'NULL'});
    res.end();
    ctx.timeline.track('end');
    ctx.response.status_code = status;
    ctx.response.status_message = 'NULL';
    this.emit('response', ctx.response);
};

Router.prototype.is_bypass_proxy = function bypass_proxy(req){
    let _url = req.ctx.url;
    let is_ssl = req.ctx.is_connect;
    let match_domain = (mask, hostname)=>{
        let mp = mask.split('.'), hp = hostname.split('.').slice(-mp.length);
        return mp.every((p, i)=>p=='*' || hp[i]==p);
    };
    if (this.bypass_proxy && this.bypass_proxy.test(_url))
        return true;
    let intern = this.proxy_internal_bypass, only = this.opt.only_bypass;
    if (!intern && !only)
        return false;
    let hostname = is_ssl ? _url.split(':')[0] : url.parse(_url).hostname;
    return intern && intern.some(x=>match_domain(x, hostname))
        || only && only.some(x=>match_domain(x, hostname));
};

Router.prototype.is_direct = function is_direct(_url){
    return this.direct && (
        this.direct.include && this.direct.include.test(_url) ||
        !(this.direct.exclude && this.direct.exclude.test(_url)));
};

const lpm_headers = qw`x-hola-context proxy-authorization x-hola-agent
    x-lpm-src-addr x-lpm-session x-hola-timeline-debug x-lpm-firewall-check
    x-lpm-reserved`;
const loopback_ip = '127.0.0.1';

function Context(req, lum, opt){
    this.opt = opt||{};
    this.lum = lum;
    this.rules = lum.rules;
    this.banlist = lum.banlist;
    this.agent = lum.protocol;
    this.port = opt.listen_port;
    this.log = log(this.port, opt.log);
    this.req = req;
    this.retry = -1;
    this.id = null;
    this.timeline = new Timeline();
    this.only = this.opt.only_bypass;
}

Context.wrap_req = function(req, lum, opt={}){
    req.ctx = req.ctx || new Context(req, lum, opt);
    req.ctx.request_start();
    return req.ctx;
};

Context.prototype.request_start = function(){
    this.responded = false;
    this.race_reqs = this.opt.race_reqs||0;
    this.retry = this.retry+1;
    this.req_timeout = this.req.timeout||0;
    this.sys_timeout = this.opt.timeout*1000 || 0;
    this.timeout = Math.min(this.sys_timeout, this.req_timeout);
    this.id = req_util.gen_id(this.id, this.retry);
    this.log = log(`${this.port} ${this.id}`, this.opt.log);
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
};

Context.prototype.process_headers = function(){
    this.headers = this.req.headers;
    this.raw_headers = this.req.rawHeaders;
    if (!this.saved_hdrs)
        this.saved_hdrs = Object.assign({}, this.headers);
    else
        this.headers = this.req.headers = Object.assign({}, this.saved_hdrs);
    lpm_headers.forEach(h=>{
        let v_name = 'h_'+h.replace(/^(x-hola-|x-lpm-)/, '').replace('-', '_');
        this[v_name] = this.headers[h]||null;
        delete this.headers[h];
    });
};

Context.prototype.init_response = function(req, res, head){
    this.headers = this.rules ? this.headers :
        restore_case(this.headers, this.raw_headers);
    this.response = {
        request: {
            method: req.method,
            url: this.req_url,
            headers: this.headers,
            raw_headers: this.raw_headers,
            body: '',
        },
        timeline: this.timeline,
        body_size: 0,
        context: this.h_context||'RESPONSE',
        body: [],
    };
    [req, res].forEach(r=>qw`data end`.forEach(e=>{
        let ev;
        if (r[ev = `_on${e}`])
        {
            r.removeListener(e, r[ev]);
            delete r[ev];
        }
    }));
    req.on('data', req._ondata = chunk=>{
        this.response.request.body += chunk; });
    // XXX ovidiu: remove this when eventemitter possible leak fixed
    res.setMaxListeners(45);
};


function Sess_mgr(lum, opt){
    events.EventEmitter.call(this);
    this.opt = opt;
    this._log = lum._log;
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
    this.session_init_timeout = opt.session_init_timeout*1000;
    this.seed = opt.seed||
        Math.ceil(Math.random()*Number.MAX_SAFE_INTEGER).toString(16);
    if ((opt.max_requests||opt.session_duration||this.keep_alive) &&
        !opt.pool_size&&!opt.sticky_ip&&opt.session!==true)
    {
        // XXX lee, gilad - can this warning be removed
        this._log.warn('empty pool_size, session flags are ignored');
    }

}

util.inherits(Sess_mgr, events.EventEmitter);

Sess_mgr.prototype.calculate_username = function(opt){
    opt = assign.apply({}, [this.opt, this, opt].map(o=>_.pick(o||{},
        qw`customer zone country state city session asn dns request_timeout
        cid ip raw direct debug password mobile vip`)));
    let opt_usr = _.omit(opt, qw`request_timeout password`);
    if (opt_usr.ip)
        opt_usr = _.omit(opt_usr, qw`session`);
    if (opt.request_timeout)
        opt_usr.timeout = opt.request_timeout;
    return {username: username.calc(opt_usr, this.opt.short_username),
        password: opt.password};
};

Sess_mgr.prototype.refresh_sessions = function(){
    this._log.info('Refreshing all sessions');
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
    if (pool.canceled||this.stopped)
        return;
    let host = this.lum.hosts.shift();
    this.lum.hosts.push(host);
    let session_id = `${prefix}_${this.session_id++}`;
    let ips = this.opt.ips||[];
    let vips = this.opt.vips||[];
    let vip = vips[this.session_id%vips.length];
    let ip = ips[this.session_id%ips.length];
    let cred = this.calculate_username({ip: ip, session: session_id,
        vip: vip});
    let session = {
        host: host,
        session: session_id,
        ip: ip,
        vip: vip,
        count: 0,
        bandwidth_max_downloaded: 0,
        created: Date.now(),
        stats: true,
        username: cred.username,
        pool: pool,
    };
    this._log.info(`new session added ${host}:${session_id}`);
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
    this._log.debug(`initialized pool - ${this.opt.pool_size}`);
    this.pool_ready = true;
};

Sess_mgr.prototype.update_session = etask._fn(function*(_this, session){
    const res = yield _this.info_request(session,
        (_this.opt.request_timeout||60)*1000, 'SESSION INFO');
    session.info = res.info;
});

Sess_mgr.prototype.update_all_sessions = etask._fn(function*(_this){
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

Sess_mgr.prototype.set_keep_alive = function(session, keep_alive){
    if (!this.keep_alive&&!keep_alive)
        return;
    this.stop_keep_alive(session);
    session.keep_alive = this.lum._timeout(this._keep_alive_handler.bind(this),
        this.keep_alive||keep_alive, session);
    this._log.debug(`Schedule keep alive ${session.host}:${session.session}`);
};

Sess_mgr.prototype._keep_alive_handler = function(session){
    if (session.pool.canceled || this.lum.stopped)
        return;
    const _this = this;
    this.set_keep_alive(session);
    this._log.info(`Keep alive ${session.host}:${session.session}`);
    this.info_request(session, this.opt.request_timeout*1000,
        'SESSION KEEP ALIVE')
    .then(res=>{
        if (session && (!res || res.err || !res.info))
        {
            if (_this.opt.proxy_switch)
            {
                _this.lum._check_proxy_response(session.host, res&&res.res ||
                     {statusCode: 502}, {from: 'keep alive', err: res.err});
            }
            else if (session.pool)
            {
                _this.stop_keep_alive(session);
                let sessions = _.isArray(session.pool) ? session.pool :
                    session.pool.sessions;
                _.remove(sessions, s=>s===session);
            }
            if (session.reserved)
                this.remove_reserved(session);
        }
        else if (session&&res && res.info && !(session.info&&session.info.ip))
        {
            if (session.info.ip!=res.info.ip)
                this.remove_reserved(session);
            session.info = res.info;
        }
    });
};

Sess_mgr.prototype.stop_keep_alive = function(session){
    if (!session.keep_alive)
        return;
    clearTimeout(session.keep_alive);
    session.keep_alive = null;
};

Sess_mgr.prototype.is_session_expired = function(session,
    check_only = false)
{
    if (!session)
        return true;
    if (check_only&&!session.pool&&session!=this.session&&!session.reserved)
        return this.stop_keep_alive(session);
    if (check_only)
        this.set_keep_alive(session);
    const now = Date.now();
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
        this._log.debug(`session ${session.host}:${session.session} expired`);
    }
    return expired;
};

Sess_mgr.prototype.info_request = etask._fn(
function*info_request(_this, session, timeout, context){
    let host = session.host || _this.lum.hosts[0];
    let cred = _this.calculate_username(session);
    let protocol = _this.opt.secure_proxy ? 'https' : 'http';
    let proxy_url = `${protocol}://${cred.username}:${cred.password}@${host}:${_this.opt.proxy_port}`;
    _this._log.debug('info_request via %s', proxy_url);
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
        if (res.status_code==200 && res.headers['content-type'].match(/\/json/))
            info = JSON.parse(res.body);
       _this.emit('response', res);
       _this._log.debug('info_request %O %O', res, info);
    } catch(e){
        err = e;
        res.status_code = 502;
        _this._log.warn('info_request '+zerr.e2s(err));
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
    if (ctx.only)
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
                stats: true,
                pool: this,
            };
        }
        let session = this.session;
        this.set_keep_alive(session);
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
    this._log.info('Adding session '+sess.session+' to reserved pool');
    this.reserved_sessions.push(sess);
    sess.reserved = true;
    this.set_keep_alive(sess, this.keep_alive||this.reserved_keep_alive);
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
    this._log.info('delete reserved session %O', session);
    _.delete(this.reserved_sessions, session);
    this.stop_keep_alive(session);
    session.reserved = false;
};

function Stats(hsts, opt){
    this.log = log('stats', opt.log);
    this.by_hsts = {};
    this.add_hosts(hsts);
}

Stats.prototype.reset_all = function(){
    for (let key in this.by_hsts)
        this.init_host(key);
};

Stats.prototype.init_host = function(host){
    this.log.debug(`adding host %s`, host);
    return this.by_hsts[host] = {total_requests: 0, total_inbound: 0,
        total_outbound: 0, active_requests: 0, max_requests: 0,
        status_code: {}, success: 0, fail: 0};
};

Stats.prototype.add_hosts = function(hsts){
    if (!hsts||!hsts.length)
        return;
    if (!Array.isArray(hsts))
        hsts = [hsts];
    hsts.filter(h=>!this.by_hsts[h]).forEach(h=>this.init_host(h));
};

Stats.prototype.init_req_stats = function(req, res){
    this.track_req_start(req);
    this.track_res(req, res);
    return this.get_req_stats(req);
};

Stats.prototype.track_req_start = function(req){
    const st = this.get_req_stats(req);
    st.active_requests++;
    st.max_requests = Math.max(st.max_requests, st.active_requests);
};

Stats.prototype.track_req_end = function(req, opt = {}){
    const st = this.get_req_stats(req);
    st.active_requests--;
    if (opt.status_code)
        st.status_code[opt.status_code] = (st.status_code||0)+1;
};

Stats.prototype.track_res = function(req, res){
    request_stats(req, res, rstats=>{
        const downloaded = rstats.res.bytes;
        const uploaded = rstats.req.bytes;
        this.track_bw(req, downloaded, uploaded);
        this.track_sess_bw(req, downloaded, uploaded);
    });
};

Stats.prototype.track_bw = function(req, downloaded, uploaded){
    const stats = this.get_req_stats(req);
    stats.total_inbound += downloaded;
    stats.total_outbound += uploaded;
};

Stats.prototype.track_sess_bw = function(req, downloaded, uploaded){
    const ctx = req.ctx;
    const sess = ctx.session;
    const elapsed = Date.now()-ctx.timeline.get('create');
    if (sess && sess.stats && downloaded>=sess.bandwidth_max_downloaded)
    {
        sess.bandwidth_max_downloaded = downloaded;
        sess.bandwidth = Math.round(downloaded*1000/elapsed);
    }
};

Stats.prototype.get_req_stats = function(req, gen){
    if (req.ctx.stats&&!gen)
        return req.ctx.stats;
    const host = req.ctx.host;
    return this.by_hsts[host]||this.init_host(host);
};

Stats.prototype.cnt_success = function(req, is_success){
    const stats = this.get_req_stats(req);
    const key = is_success ? 'success' : 'fail';
    stats[key]++;
};

function Luminati(opt, mgr){
    events.EventEmitter.call(this);
    this.mgr = mgr||null;
    opt.listen_port = opt.listen_port||opt.port;
    this._log = log(opt.listen_port, opt.log);
    this.http = opt.secure_proxy ? https : http;
    this.protocol = {
        http: new http.Agent({keepAlive: true, keepAliveMsecs: 5000}),
        https: new https.Agent({keepAlive: true, keepAliveMsecs: 5000,
            servername: 'zproxy.luminati.io'}),
    }[opt.secure_proxy ? 'https' : 'http'];
    this.req_status_cnt = {total: 0, success: 0};
    opt = this.opt = assign({}, E.default, opt);
    if (opt.rules)
    {
        this.rules = new Rules(this, opt.rules||{});
        this.banlist = new Ip_cache();
    }
    if (opt.timeout)
        this.timeout = opt.timeout*1000;
    this.router = new Router(opt);
    this.router.on('response', res=>this.emit('response', res));
    this.stats = new Stats(this, opt);
    this.active = 0;
    this.failure = {};
    this.requests_queue = [];
    this.throttle_queue = [];

    if (opt.socks)
    {
        this.socks_server = new Socks({local: opt.socks, remote: opt.port,
            iface: opt.iface, log: opt.log});
    }

    this.http_server = http.createServer((req, res, head)=>{
        if (req.headers.host=='trigger.domain' ||
            /^\/hola_trigger/.test(req.url))
        {
            return res.end();
        }
        if (!req.url.startsWith('http:'))
            req.url = 'http://'+req.headers.host+req.url;
        this._handler(req, res, head);
    }).on('connection', socket=>socket.setNoDelay());
    http_shutdown(this.http_server);
    if (opt.ssl)
    {
        this.authorization = {};
        this.req_remote_ip = {};
        this.https_server = https.createServer(
            assign({requestCert: false}, ssl()),
            (req, res, head)=>{
                let remote_ip = this.req_remote_ip[req.socket.remotePort];
                if (remote_ip && req.socket.remoteAddress=='127.0.0.1')
                {
                    this._log.info(`Request ip fixed`
                        +` ${remote_ip} ${req.url}`);
                    req.original_ip = remote_ip;
                }
                let authorization = this.authorization[req.socket.remotePort];
                if (authorization)
                    req.headers['proxy-authorization'] = authorization;
                this._handler(req, res, head);
            }
        ).on('connection', socket=>socket.setNoDelay());
        http_shutdown(this.https_server);
        this.http_server.on('connect', (req, res, head)=>{
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
            socket.on('error', err=>this._log.error(
                `Socket error: %O`, {
                authorization: authorization,
                error: err,
                port: (this.https_server.address()||{}).port
            }));
            res.pipe(socket).pipe(res);
            req.on('end', ()=>socket.end());
        });
    }
    else
        this.http_server.on('connect', this._handler.bind(this));

    if ((opt.history||opt.request_stats)&&opt.history_aggregator)
    {
        this.on('response', response=>{
            let headers = response.headers||{};
            let proxy_info = qw`x-hola-timeline-debug x-hola-unblocker-debug`
            .map(h=>headers[h]||'')
            .map(h=>h.match(/(\d+\.\d+\.\d+\.\d+) ([^ ]+)/))
            .find(i=>i)||['', '', ''];
            let node_latency = +((headers['x-hola-timeline-debug']||'')
            .match(/(\d+) ?ms/)||[0, response.timeline.get('response')])[1];
            this._timeout(()=>{
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
                opt.history_aggregator(data);
            }, 0);
        });
    }
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

E.prototype.get_other_port = function(port){
    if (!this.mgr)
        return null;
    return this.mgr.get_server(port);
};

E.prototype._timeout = function(func, time, param){
    return setTimeout(()=>{
        try { func.call(this, param); }
        catch(e){ this._log.error('Async error '+zerr.e2s(e)); }
    }, time);
};

E.prototype._handler = etask._fn(
function*_handler(_this, req, res, head){
    req._queued = Date.now();
    _this.active++;
    _this.emit('idle', false);
    this.finally(()=>{
        if (this.error)
        {
            if (!(this.error.message||'').includes('ECONNRESET'))
            {
                _this._log.error(
                    `${req.method} ${req.url} `
                    +zerr.e2s(this.error)
                );
            }
            if (!res.ended)
            {
                write_http_reply(res, {statusCode: 502, statusMessage:
                    'Bad Gateway', headers: {Connection: 'close'}});
            }
            res.end();
        }
        if (--_this.active)
        {
            if (_this.throttle_queue.length)
            {
                _this._log.debug('Taking request from throttle queue');
                _this.throttle_queue.shift().continue();
            }
            return;
        }
        _this.emit('idle', true);
    });
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
            _this._log.debug(`Request ip not in whitelist `
                +`${req.url} ${ip}`);
            write_http_reply(res, {statusCode: 403, statusMessage: 'Forbidden',
                headers: {Connection: 'close'}});
            res.end();
            return;
        }
    }
    this.info.url = req.url;
    if (_this.opt.throttle && _this.active>_this.opt.throttle)
    {
        _this._log.debug(`Placing request on throttle queue`);
        _this.throttle_queue.push(this);
        yield this.wait();
    }
    if (_this.opt.only_bypass || _this.hosts && _this.hosts.length)
        return yield _this._request(req, res, head);
    _this.requests_queue.push([req, res, head]);
});

E.prototype.error_handler = function error_handler(source, err){
    this._log.error(source+' error '+zerr.e2s(err));
    if (err.code=='EADDRINUSE')
    {
        err = new Error('There\'s already an application which runs on '
        +err.address+':'+err.port);
        err.raw = true;
    }
    if (this.listenerCount('error'))
        this.emit('error', err);
    else
        throw err;
};

E.prototype.listen = etask._fn(function*listen(_this, listen_port, hostname){
    _this.proxy = [].concat(_this.opt.proxy);
    _this.resolve_proxy();
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
    _this.port = !listen_port ? _http.address().port : _this.opt.port;
    if (_https)
    {
        _https.on('error', err=>_this.error_handler('HTTPS', err));
        yield etask.nfn_apply(_https, '.listen', [0, '127.0.0.1']);
        _this._log.debug('HTTPS port: '+_https.address().port);
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
    _this.stopped = true;
    let tasks = {};
    const stop_method = force ? '.forceShutdown' : '.shutdown';
    tasks.http = etask.nfn_apply(_this.http_server, stop_method, []);
    if (_this.https_server)
        tasks.https = etask.nfn_apply(_this.https_server, stop_method, []);
    if (_this.socks_server)
        tasks.socks = _this.socks_server.stop(force);
    yield etask.all(tasks);
    return _this;
});

E.prototype._check_proxy_response = etask._fn(
function*_check_proxy_response(_this, proxy, res, context){
    if (!_this.opt.proxy_switch)
        return;
    if (![403, 429, 502, 503].includes(res&&res.statusCode||0))
        return delete _this.failure[proxy];
    _this._log.warn('invalid proxy response %O',
        {host: proxy, code: res.statusCode, context: context});
    if ((_this.failure[proxy] =
        (_this.failure[proxy]||0)+1)<_this.opt.proxy_switch)
    {
        return;
    }
    _this._log.warn('removing failed proxy server %O', {host: proxy});
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
            _this._log.debug(`using super proxy ${proxy}`);
            hosts[proxy] = false;
            continue;
        }
        proxies.push(proxy);
        let domain = proxy;
        if (proxy.length==2)
            domain = 'zproxy.luminati.io';
        if (domain=='zproxy.luminati.io')
        {
            domain = `customer-${_this.opt.customer}-`
                +`session-${Date.now()}.${domain}`;
        }
        try {
            ips = ips || (yield etask.nfn_apply(dns, '.resolve', [domain]));
            _this._log.debug(`resolved ${proxy} (${domain}) %O`, ips);
            ips.forEach(ip=>hosts[ip] = proxy);
        } catch(e){
            _this._log.debug(`Failed to resolve ${proxy} (${domain}): ${e}`
                +zerr.e2s(e));
        }
    }
    _this.hosts = _.shuffle(Object.keys(hosts));
    if (_this.opt.proxy_cache)
        yield _this.opt.proxy_cache.add(_.toPairs(hosts).filter(p=>p[1]));
    if (!_this.hosts.length)
        _this._log.error('Failed to resolve any proxies');
    _this.stats.add_hosts(_this.hosts);
    _this.resolving_proxies = false;
    let queue = _this.requests_queue;
    _this.requests_queue = [];
    queue.forEach(args=>_this._request.apply(_this, args));
});

E.hola_headers = qw`proxy-connection proxy-authentication x-hola-agent
    x-hola-debug x-hola-tunnel-key x-hola-tunnel-ip x-hola-tunnel-session
    x-hola-auth x-hola-unblocker-debug x-hola-session x-hola-cid
    x-hola-country x-hola-forbid-peer x-hola-dst-ips x-hola-ip
    x-hola-immediate x-hola-dns-only x-hola-response x-hola-direct-first
    x-hola-direct-discover x-hola-blocked-response x-hola-conf
    x-hola-headers-only x-hola-unblocker-bext x-hola-dynamic-tunnels
    x-hola-context x-luminati-timeline`;

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
                if (r.ipban && _res)
                {
                    let tl = (_res.hola_headers&&
                        _res.hola_headers['x-hola-timeline-debug'])||
                        (_res.headers&&_res.headers['x-hola-timeline-debug']);
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
    retry(req, res, head, port){
        if (!req.retry)
            req.retry = 0;
        req.retry++;
        req.ctx.log.info(`${req.req_id}: req retry${req.retry}`
            +` ${req.ctx.url}`);
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
            let tl = (_res.hola_headers&&
                _res.hola_headers['x-hola-timeline-debug'])||
                (_res.headers&&_res.headers['x-hola-timeline-debug']);
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
        this.luminati.stats.cnt_success(req, success);
        req.ctx.response.success = success;
    }
    reserve_session(sess){
        this.luminati.session_mgr.reserve_session(sess);
    }
}
E.Rules = Rules;

E.prototype.get_req_host = function(req){
    const ctx = req.ctx;
    return ctx.session&&ctx.session.host
        || (ctx.only ? loopback_ip : this.hosts[0]);
};

E.prototype.reverse_lookup_url = etask._fn(function*(_this, url){
    let ip_url, rev_domain;
    if (!this.reverse_lookup || !(ip_url = parse_ip_url(url)))
        return url;
    rev_domain = yield _this.reverse_lookup(ip_url.ip);
    if (ip_url.url==rev_domain)
        return url;
    return url.replace(ip_url.url,
        `${ip_url.protocol}${rev_domain}${ip_url.suffix}`);
});

E.prototype._request = etask._fn(function*_request(_this, req, res, head){
    const ctx = Context.wrap_req(req, _this, _this.opt);
    res.x_hola_context = ctx.h_context;
    if (ctx.h_firewall_check)
        return res.end(JSON.stringify({pass: true}));
    ctx.log.info('starting request');
    if (ctx.rules)
        ctx.rules.pre(req); // XXX shachar: can it redirect from here?
    if (req._queued)
        ctx.timeline.track('queued', req._queued);
    ctx.headers = ctx.rules ? ctx.headers :
        restore_case(ctx.headers, ctx.raw_headers);
    ctx.init_response(req, res, head);
    ctx.url = yield _this.reverse_lookup_url(ctx.url);
    ctx.response.request.url_full = ctx.url;
    if (ctx.is_connect && parse_ip_url(ctx.url))
        ctx.log.warn(`HTTPS connection to IP: %s`, ctx.url);
    ctx.log.info(`${req.socket.remoteAddress}:`
        +`${req.socket.remotePort} - ${req.method} ${ctx.url}`);
    if (_this.router.is_null_response(ctx.url))
    {
        ctx.log.debug(`requested url ${ctx.url} matches `
            +`null_response filter `+_this.null_response);
        return _this.router.send_null_response(req, res);
    }
    if (!ctx.only && !_this.hosts.length)
    {
        if (_this.resolving_proxies)
            return _this.requests_queue.push([req, res, head]);
        return this.throw(new Error('No hosts when processing request'));
    }
    ctx.session = _this.session_mgr.request_session(req);
    ctx.host = _this.get_req_host(req);
    ctx.stats = _this.stats.init_req_stats(req, res);
    if (_this.router.is_bypass_proxy(req))
    {
        yield _this._proxy_bypass(this, req, res, head);
        return yield this.wait();
    }
    else if (ctx.only)
        return _this.router.send_null_response(req, res);
    ctx.cred = _this.session_mgr.get_req_cred(req);
    res.cred = ctx.cred.username;
    ctx.log.info(`requesting using ${ctx.cred.username}`);
    ctx.response.proxy = {
        host: ctx.host,
        username: ctx.cred.username,
    };
    ctx.connect_headers = {
        'proxy-authorization': 'Basic '+
            new Buffer(ctx.cred.username+':'+ctx.cred.password)
            .toString('base64'),
        'x-hola-agent': E.hola_agent,
    };
    _this._proxy_request(this, req, res, head, ctx.host);
    let hsts = _this.hosts.filter(h=>h!=ctx.host);
    if (ctx.race_reqs>1)
        ctx.log.info(`racing req with host ${ctx.host}`);
    for (let i=0; i<Math.min(hsts.length, ctx.race_reqs-1); i++)
    {
        ctx.log.info(`racing req with host ${hsts[i]}`);
        _this._proxy_request(this, req, res, head, hsts[i]);
    }
    yield this.wait();
});

E.prototype._proxy_request = function(task, req, res, head, host){
    if (req.ctx.is_ssl)
        return this._proxy_ssl_request(task, req, res, head, host);
    return this._proxy_http_request(task, req, res, head, host);
};

E.prototype._request_handler = etask._fn(
function*_request_handler(_this, task, req, res, proxy, head, _headers){
    const ctx = req.ctx;
    const config = _this.config||{};
    const thdl = _this._handle_proxy_timeout(req, res, proxy, head, task);
    if (ctx.timeout)
        proxy.setTimeout(ctx.timeout, thdl);
    proxy
    .on('response', _this._handle_proxy_resp(req, res, proxy, this, head,
        _headers))
    .on('connect', _this._handle_proxy_connect(req, res, proxy, this, head))
    .on('error', _this._handle_proxy_error(req, res, proxy, this, head));
    yield this.wait();
});

E.prototype._proxy_bypass = etask._fn(
function*(_this, task, req, res, head){
    const ctx = req.ctx;
    let proxy;
    if (ctx.is_connect)
    {
        const parts = ctx.url.split(':');
        ctx.response.request.url = `https://${ctx.url}/`;
        proxy = net.connect({host: parts[0], port: +parts[1]});
        proxy.on('connect', ()=>{
            ctx.timeline.track('direct_connect');
            ctx.lum.stats.track_req_end(req);
            ctx.log.debug(`${req.req_id}: DIRECT CONNECT - ${ctx.url}`);
            write_http_reply(res, {statusCode: 200, statusMessage: 'OK'});
            res.pipe(proxy).pipe(res);
        });
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
            ctx.lum.stats.track_req_end(req);
            _res.on('error', task.throw_fn());
            socket.on('error', task.throw_fn());
            ctx.log.debug(`DIRECT REQUEST - ${ctx.url}`);
        });
        // XXX jesse remove duplication of this block
        if (ctx.response.request.body)
            proxy.write(ctx.response.request.body);
        req.pipe(proxy);
    }
    proxy.on('close', ()=>{
        ctx.timeline.track('end');
        _this.emit('response', ctx.response);
        task.return();
    }).on('error', task.throw_fn());
    if (!ctx.is_connect)
        yield _this._request_handler(task, req, res, proxy, head);
});

E.prototype._proxy_ssl_request = function(task, req, res, head, host){
    const ctx = req.ctx;
    const _this = this;
    ctx.response.request.url = ctx.url;
    _this.http.request({
        host: host,
        port: _this.opt.proxy_port,
        method: 'CONNECT',
        path: ctx.headers.host+':443',
        headers: ctx.connect_headers,
        agent: ctx.agent,
        rejectUnauthorized: !_this.opt.insecure,
    }).on('connect', (_res, socket, _head)=>etask(function*(){
        if (_res.statusCode!=200)
        {
            if (ctx.rules && ctx.rules.can_retry(req))
            {
                ctx.log.warn(`error proxy response ${host}`);
                ctx.rules.retry(req, res, head);
                task.return();
                return;
            }
            _this._check_proxy_response(host,
                {statusCode: _res.statusCode}, {from:
                'error', error: _res.statusMessage});
            this.throw(_res.statusMessage);
            return;
        }
        if (ctx.banlist)
        {
            let tl = (_res.headers['x-hola-timeline-debug']||'')
                .split(' ');
            let ip = tl && tl.length>=3 && tl[3];
            if (ip && ctx.banlist.has(ip))
            {
                ctx.log.info(`ip_banned ${ip}`);
                req.session = ctx.rules.gen_session();
                ctx.rules.retry(req, res, head);
                task.return();
                return;
            }
        }
        if (ctx.session)
            _this.session_mgr.is_session_expired(ctx.session, true);
        ctx.timeline.track('connect');
        _res.on('error', this.throw_fn());
        socket.on('error', this.throw_fn());
        const proxy = https.request({
            host: ctx.headers.host,
            method: req.method,
            path: req.url,
            headers: ctx.headers,
            proxyHeaderWhiteList: E.hola_headers,
            proxyHeaderExclusiveList: E.hola_headers,
            socket: socket,
            agent: false,
            rejectUnauthorized: !_this.opt.insecure,
        });
        // XXX jesse remove duplication of this block
        if (ctx.response.request.body)
            proxy.write(ctx.response.request.body);
        req.pipe(proxy);
        req.on('end', req._onend = ()=>proxy.end());
        ctx.log.info(
            `timeline-debug ${_res.headers['x-hola-timeline-debug']}`);
        yield _this._request_handler(task, req, res, proxy, head,
            _res.headers);
        task.return();
    })).on('error', task.throw_fn()).end();
    return task.wait();
};

E.prototype._proxy_http_request = etask._fn(
function*(_this, task, req, res, head, host){
    const ctx = req.ctx;
    const proxy = _this.http.request({
        host: host,
        port: _this.opt.proxy_port,
        method: req.method,
        path: ctx.url,
        agent: ctx.agent,
        headers: assign(ctx.connect_headers, ctx.headers),
        proxyHeaderWhiteList: E.hola_headers,
        proxyHeaderExclusiveList: E.hola_headers,
        rejectUnauthorized: !_this.opt.insecure,
    });
    if (ctx.is_connect)
        proxy.end();
    else
    {
        // XXX jesse remove duplication of this block
        if (ctx.response.request.body)
            proxy.write(ctx.response.request.body);
        req.pipe(proxy);
        req.on('end', req._onend = ()=>proxy.end());
    }
    yield _this._request_handler(task, req, res, proxy, head);
    task.return();
});

E.prototype._handle_proxy_timeout = function(req, res, proxy, head, task){
    return ()=>{
        const ctx = req.ctx;
        if (ctx.sys_timeout)
            task.throw(new Error(`timeout ${ctx.sys_timeout}`));
        if (!ctx.rules)
            return;
        ctx.log.debug(
            `${req.method} ${ctx.url} - timeout ${ctx.req_timeout}`);
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
        if (ctx.responded)
            return this._abort_proxy_req(req, proxy, task);
        ctx.responded = true;
        const count$ = create_count_stream(ctx.response);
        try {
            ctx.timeline.track('response');
            let code = `${_res.statusCode}`.replace(/(?!^)./g, 'x');
            ctx.lum.stats.track_req_end(req, {status_code: code});
            ctx.log.info(`${req.method} ${ctx.url} - ${_res.statusCode}`);
            if (ctx.rules)
            {
                _res.hola_headers = _headers;
                if (res.resp_written || !ctx.rules.can_retry(req));
                else if (ctx.rules.post(req, res, head, _res, true))
                    return this._abort_proxy_req(req, proxy, task);
                else if (ctx.rules.post_need_body(req))
                {
                    ctx.response.body_wait = true;
                    ctx.response._res = _res;
                    _res.on('data', data=>ctx.response.body.push(data));
                    _res.on('end', ()=>{
                        if (ctx.rules.post_body(req, res, head, _res,
                            ctx.response.body))
                        {
                            this._abort_proxy_req(req, proxy, task);
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
                        this.emit('response', ctx.response);
                        this._check_proxy_response(ctx.host, _res,
                            'response');
                        this.return();
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
                this.emit('response', ctx.response);
                this._check_proxy_response(ctx.host, _res, 'response');
                if (_res.statusCode>=400)
                {
                    task.throw(new Error(
                        `${_res.statusCode} ${_res.statusMessage}`));
                }
                task.return();
            }).on('error', task.throw_fn());
        } catch(e){ task.throw(e); }
    };
};

E.prototype._handle_proxy_connect = function(req, res, proxy, task, head){
    return (_res, socket, _head)=>{
        if (proxy.aborted)
            return;
        const ctx = req.ctx;
        const count$ = create_count_stream(ctx.response);
        let end_socket;
        try {
            ctx.timeline.track('connect');
            ctx.lum.stats.track_req_end(req);
            write_http_reply(res, _res);
            assign(ctx.response, {
                status_code: _res.statusCode,
                headers: _res.headers,
            });
            if (_res.statusCode!=200)
            {
                ctx.log.error(
                    `${req.method} ${ctx.url} - ${_res.statusCode}`);
                res.end();
                this.emit('response', ctx.response);
                this._check_proxy_response(ctx.host, _res, 'connect');
                return task.return();
            }
            ctx.log.debug(`CONNECT - ${_res.statusCode}`);
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
                ctx.log.error(`Request socket error ${zerr.e2s(err)}`);
                this.session_mgr
                    .removeListener('refresh_sessions', end_socket);
            }).on('end', ()=>{
                if (!ctx.timeline.get('end'))
                {
                    ctx.timeline.track('end');
                    this.emit('response', ctx.response);
                }
                this.session_mgr
                    .removeListener('refresh_sessions', end_socket);
                task.return();
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
    task.return();
};

E.prototype._handle_proxy_error= function(req, res, proxy, task, head){
    return err=>{
        const ctx = req.ctx;
        if (proxy.aborted)
            return;
        if (ctx.rules && ctx.rules.can_retry(req))
        {
            ctx.log.warn(`error proxy response ${ctx.host}`);
            ctx.rules.retry(req, res, head);
            this._abort_proxy_req(req, proxy, task);
            return;
        }
        this._check_proxy_response(ctx.host, {statusCode: 502}, {from:
            'error', error: err});
        task.throw(err);
    };
};

E.prototype.request = function(){
    const args = [].slice.call(arguments);
    if (typeof args[0]=='string')
        args[0] = {url: args[0]};
    args[0].proxy = args[0].proxy||`http://127.0.0.1:${this.port}`;
    return request.apply(null, args);
};

function Timeline(){
    this.create = Date.now();
    this.req = {create: this.create};
    this.req_chain = [this.req];
}

Timeline.prototype.track = function(name, ts){
    this.req[name] = ts||Date.now();
};

Timeline.prototype.get_delta = function(name1, name2, idx, total){
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
};

Timeline.prototype.get = function(name, idx, nofb){
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
};

Timeline.prototype.retry = function(){
    const now = Date.now();
    if (!this.req.end)
        this.req.end = now;
    this.req = {create: now};
    this.req_chain.push(this.req);
};

Timeline.prototype.toString = function(){
    let parts = [`timeline: t:${this.get_delta('end', true)}ms`];
    const fmt_mtr = (name, delta)=>`${name}:${delta}ms`;
    parts = parts.concat(this.req_chain.map((r, i)=>([
        `R${i}`,
        fmt_mtr('t', this.get_delta('end', i)),
        fmt_mtr('q', this.get_delta('queue', i)),
        fmt_mtr('rl_pre', this.get_delta('rules_pre_end', 'rules_pre_start',
            i)),
        fmt_mtr('c', this.get_delta('connect', ['queue', 'create'], i)),
        fmt_mtr('r', this.get_delta('response', ['connect', 'queue', 'create'],
            i)),
        fmt_mtr('rl_pst', this.get_delta('rules_post_end', 'rules_post_start',
            i)),
        fmt_mtr('rl_pb', this.get_delta('rules_body_end', 'rules_body_start',
            i)),
    ].join(' '))));
    return parts.join(' ');
};

