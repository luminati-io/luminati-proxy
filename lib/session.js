// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true, evil: true*/
const _ = require('lodash');
const events = require('events');
const etask = require('../util/etask.js');
const url = require('url');
const util = require('util');
const username = require('./username.js');
const zerr = require('../util/zerr.js');
const E = module.exports;
const logger = require('./logger').child({category: 'SESS'});

function Sess_mgr(serv, opt){
    events.EventEmitter.call(this);
    this.sp = etask(function*sesssion_manager(){ yield this.wait(); });
    this.opt = opt;
    this.serv = serv;
    this.session_pools = new Map();
    this.setMaxListeners(Number.MAX_SAFE_INTEGER);
    this.session_id = 1;
    this.sticky_sessions = {};
    if (opt.session!==true && opt.session)
        opt.pool_size = 1;
    this.pool_prefill = !(this.opt.rules||[]).some(r=>
        r.action && r.action.reserve_session);
    this.init();
}

util.inherits(Sess_mgr, events.EventEmitter);

Sess_mgr.prototype.init = function(){
    this.sessions = {sessions: []};
    if (this.opt.ips)
        this.pool(this.opt.ips.length, {init: true});
};

Sess_mgr.prototype.add_to_pool = function(session={}){
    const ip = session.ip || session.last_res && session.last_res.ip;
    if (!ip || !this.opt.pool_size)
        return;
    if (this.sessions.sessions.length>=this.opt.pool_size)
        return;
    const curr_ips = this.sessions.sessions
        .map(s=>s.ip || s.last_res && s.last_res.ip);
    if (curr_ips.includes(ip))
        return;
    if (this.sessions.sessions.map(s=>s.session).includes(session.session))
        return;
    session.ip = ip;
    this.sessions.sessions.push(session);
    this.serv.emit('add_static_ip', ip);
};

Sess_mgr.prototype.refresh_sessions = function(){
    this.emit('refresh_sessions');
    if (this.opt.pool_size && this.sessions)
    {
        let session = this.sessions.sessions.shift();
        if (!session || !session.ip)
            this.pool_fetch();
        else
        {
            session.count = 0;
            this.sessions.sessions.push(session);
        }
    }
    if (this.opt.sticky_ip)
    {
        this.sticky_sessions.canceled = true;
        this.sticky_sessions = {};
    }
    if (this.opt.session==true && this.session)
        this.session = null;
};

Sess_mgr.prototype.establish_session = function(prefix, pool, opt={}){
    let session_id, asn, ip, vip, host, ext_proxy, proxy_port;
    if (pool && pool.canceled || this.stopped)
        return;
    const init_ips_pool = opt.init && this.opt.ips && this.opt.ips.length;
    const ips = (init_ips_pool || this.is_using_pool()) && this.opt.ips || [];
    const vips = this.opt.vips || [];
    const ext_proxies = this.opt.ext_proxies||[];
    if (this.opt.session!==true && this.opt.session)
        session_id = this.opt.session;
    else
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
        host = this.serv.hosts.shift();
        this.serv.hosts.push(host);
        vip = vips[this.session_id%vips.length];
        ip = ips[this.session_id%ips.length];
        if (Array.isArray(this.opt.asn))
            asn = this.opt.asn[this.session_id%this.opt.asn.length];
    }
    const cred = username.calculate_username(Object.assign({}, this.opt,
        {ip, session: session_id, vip, ext_proxy}));
    const now = Date.now();
    const session = {
        host,
        session: session_id,
        ip,
        vip,
        ext_proxy,
        count: 0,
        created: now,
        username: cred.username,
        pool,
        proxy_port,
    };
    if (asn)
        session.asn = asn;
    if (this.opt.rotate_session)
        session.rotate_session = this.opt.rotate_session;
    logger.debug('new session added %s:%s', host, session_id);
    return session;
};

Sess_mgr.prototype.pool_fetch = function(opt={}){
    try {
        if (opt.immediate===undefined)
            opt.immediate = true;
        const pref = this.serv.port+
            (this.opt.rotate_session ? '_'+this.opt.worker_id : '');
        const session = this.establish_session(pref, this.sessions, opt);
        if (session)
            this.sessions.sessions.push(session);
    } catch(e){
        logger.error(zerr.e2s(e));
    }
};

Sess_mgr.prototype.pool = function(count, opt){
    if (!count)
        return;
    for (let i=0; i<count; i++)
        this.pool_fetch(opt);
};

Sess_mgr.prototype.replace_session = function(session, err, opt={}){
    logger.debug('removing session %s: %s', session.session, err);
    this.remove_session(session);
    if (this.opt.pool_size && this.pool_prefill)
        this.pool_fetch(Object.assign({immediate: false}, opt));
};

Sess_mgr.prototype.remove_session = function(session){
    session.canceled = true;
    for (let [, s_pool] of this.session_pools)
        s_pool.remove(session, this);
    if (!session.pool)
        return;
    const sessions = _.isArray(session.pool) ? session.pool :
        session.pool.sessions;
    _.remove(sessions, s=>s===session);
    if (session.ip && this.opt.ips &&
        this.opt.ips.includes(session.ip))
    {
        this.serv.emit('remove_static_ip', session.ip);
    }
};

Sess_mgr.prototype.is_session_banned = function(session){
    return session.last_res && this.serv.is_ip_banned(session.last_res.ip);
};

Sess_mgr.prototype.is_session_expired = function(session){
    if (!session || session.canceled || session.pool && session.pool.canceled)
        return true;
    return session.rotate_session && session.count;
};

Sess_mgr.prototype.request_session = function(req){
    const ctx = req.ctx;
    if (ctx.h_session)
        this.serv.emit('feature_used', 'h_session');
    let session = this._request_session(ctx);
    if (session && (!session.session || ctx.h_session))
    {
        if (ctx.h_session && this.session)
            this.session = null;
        if (this.session)
            session = this.session;
    }
    return session;
};

Sess_mgr.prototype.is_using_pool = function(){
    const sessions = this.sessions && this.sessions.sessions || [];
    return this.pool_prefill || this.opt.pool_size==sessions.length;
};

Sess_mgr.prototype._request_session = function(ctx, opt={}){
    if (ctx.h_session)
        return {session: ctx.h_session};
    // using sessions from the pool
    if (this.opt.pool_size && this.is_using_pool())
    {
        this.session = null;
        let sessions;
        if (!this.sessions)
        {
            sessions = this.sessions.sessions;
            let size = this.opt.pool_size;
            this.pool(size, opt);
        }
        else
        {
            sessions = this.sessions.sessions;
            if (sessions.length!=this.opt.pool_size)
                this.pool(this.opt.pool_size-(sessions.length||0), opt);
        }
        let session = sessions.shift();
        if (!opt.init)
            session.count++;
        if (!opt.init && (this.is_session_expired(session) ||
            this.is_session_banned(session)))
        {
            if (this.opt.pool_size>1 && !this.is_session_banned(session))
            {
                session.count = 0;
                sessions.push(session);
            }
            if (sessions.length<this.opt.pool_size)
                this.pool_fetch();
            session = this.sessions.sessions[0];
            session.count++;
        }
        else
            sessions.unshift(session);
        return session;
    }
    // sticky, session based on IP
    if (!opt.init && this.opt.sticky_ip)
    {
        const ip = ctx.src_addr && ctx.src_addr.replace(/\./g, '_');
        let session = this.sticky_sessions[ip];
        if (!session||this.is_session_expired(session)||
            this.is_session_banned(session))
        {
            session = this.sticky_sessions[ip] = this.establish_session(
                `${this.opt.port}_${ip}`, this.sticky_sessions);
        }
        return session;
    }
    // use default session per port
    if (this.opt.session===true && !this.opt.sticky_ip)
    {
        if (this.session && !opt.init)
            this.session.count++;
        if (!this.session || this.is_session_expired(this.session) ||
            this.is_session_banned(this.session))
        {
            const pref = this.serv.port+
                (this.opt.rotate_session ? '_'+this.opt.worker_id : '');
            this.session = this.establish_session(pref, this.sessions);
            if (!opt.init)
                this.session.count++;
        }
        return this.session;
    }
    return {session: false};
};

Sess_mgr.prototype.stop = function(){
    if (this.sp)
        this.sp.return();
};
E.Sess_mgr = Sess_mgr;

const parse_proxy_string = (_url, defaults)=>{
    if (!_url.match(/^(http|https|socks|socks5):\/\//))
        _url = `http://${_url}`;
    _url = Object.assign({}, defaults, _.omitBy(url.parse(_url), v=>!v));
    const proxy = {
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
