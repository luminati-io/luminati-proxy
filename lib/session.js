// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true, evil: true*/
const _ = require('lodash');
const events = require('events');
const date = require('../util/date.js');
const etask = require('../util/etask.js');
const url = require('url');
const util = require('util');
const username = require('./username.js');
const {NO_PEERS_ERROR} = require('./consts.js');
const zerr = require('../util/zerr.js');
const request = require('request');
const lpm_config = require('../util/lpm_config.js');
const {SEC, HOUR} = date.ms;
const E = module.exports;
const logger = require('./logger');

function Sess_mgr(serv, opt){
    events.EventEmitter.call(this);
    this.sp = etask(function*sesssion_manager(){ yield this.wait(); });
    this.opt = opt;
    this.serv = serv;
    this.session_pools = new Map();
    this.setMaxListeners(Number.MAX_SAFE_INTEGER);
    if (opt.session_duration)
        this.session_duration = opt.session_duration*SEC;
    this.session_id = 1;
    this.sticky_sessions = {};
    if (opt.session!==true && opt.session)
        opt.pool_size = 1;
    if (Number(opt.keep_alive)===opt.keep_alive)
        this.keep_alive = opt.keep_alive;
    else
    {
        this.keep_alive = !!((opt.pool_size || opt.sticky_ip) &&
            !this.opt.static && opt.preset=='long_availability');
    }
    this.seed = Math.ceil(Math.random()*Number.MAX_SAFE_INTEGER).toString(16);
    this.pool_prefill = !(this.opt.rules||[]).some(r=>
        r.action && r.action.reserve_session);
    this.reset_idle_pool();
    this.init();
}

util.inherits(Sess_mgr, events.EventEmitter);

Sess_mgr.prototype.init = function(){
    this.sessions = {sessions: []};
    if (!this.serv.hosts)
        return;
    if (this.opt.ips && this.opt.static)
        this.pool(this.opt.ips.length, {init: true});
};

Sess_mgr.prototype.add_to_pool = function(session={}){
    const ip = session.ip || session.last_res && session.last_res.ip;
    if (!ip || this.sessions.sessions.length>=this.opt.pool_size)
        return;
    const curr_ips = this.sessions.sessions
        .map(s=>s.ip || s.last_res && s.last_res.ip);
    if (curr_ips.includes(ip))
        return;
    if (this.sessions.sessions.map(s=>s.session).includes(session.session))
        return;
    if (this.opt.static)
        session.ip = ip;
    this.sessions.sessions.push(session);
    if (this.opt.static)
        this.serv.emit('add_static_ip', ip);
};

Sess_mgr.prototype.refresh_sessions = function(){
    this.emit('refresh_sessions');
    if (this.opt.pool_size && this.sessions)
    {
        this.stop_keep_alive(this.sessions.sessions.shift());
        this.pool_fetch();
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
    if (this.session_duration)
        session.expire = now+this.session_duration;
    if (this.opt.max_requests)
        session.max_requests = this.opt.max_requests;
    logger.debug('new session added %s:%s', host, session_id);
    return session;
};

Sess_mgr.prototype.pool_fetch = function(opt={}){
    try {
        if (opt.immediate===undefined)
            opt.immediate = true;
        const session = this.establish_session(
            `${this.serv.port}_${this.seed}`, this.sessions, opt);
        if (session)
        {
            this.sessions.sessions.push(session);
            this.sp.spawn(this.set_keep_alive(session, opt));
        }
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

Sess_mgr.prototype.reset_idle_pool = function(){
    const offset = Number.isInteger(this.opt.idle_pool) ?
        this.opt.idle_pool : HOUR;
    this.idle_date = +date()+offset;
};

Sess_mgr.prototype.set_keep_alive = etask._fn(
function*set_keep_alive(_this, session, opt={}){
    try {
        if (!_this.keep_alive)
            return;
        _this.stop_keep_alive(session);
        session.keep_alive = this;
        const keep_alive_sec = _this.keep_alive===true ? 45 : _this.keep_alive;
        if (!opt.immediate)
            yield etask.sleep(keep_alive_sec*SEC);
        let idle = false;
        while (!idle && session.keep_alive && session.keep_alive==this)
        {
            yield _this.keep_alive_handler(session);
            yield etask.sleep(keep_alive_sec*SEC);
            idle = +date()>_this.idle_date;
        }
        logger.debug('session %s: keep alive ended', session.session);
    } catch(e){
        logger.error(zerr.e2s(e));
    }
});

Sess_mgr.prototype.keep_alive_handler = etask._fn(
function*keep_alive_handler(_this, session){
    // XXX krzysztof: double check if this is needed. why not removing session
    if (_this.is_session_expired(session) || _this.serv.stopped)
        return;
    logger.debug('Keep alive %s:%s', session.host, session.session);
    const res = yield _this.send_info_request(session);
    const proxy_err = _this.serv.check_proxy_response(session.host, res.res,
        'SESSION KEEP ALIVE');
    let err;
    const curr_ips = _this.sessions &&
        _this.sessions.sessions.map(s=>s.info && s.info.ip) || [];
    const this_ip = session.info && session.info.ip;
    if (proxy_err || res.err || !res.info)
        err = 'keep alive failed';
    else if (res.info.ip!=this_ip && curr_ips.includes(res.info.ip))
        err = `IP ${res.info.ip} already in the pool`;
    else if (_this.serv.is_ip_banned(res.info.ip))
        err = `IP ${res.info.ip} is banned`;
    if (err)
    {
        if (_this.opt.session_termination && res.res &&
            res.res.statusCode==502 && res.res.statusMessage==NO_PEERS_ERROR)
        {
            _this.serv.handle_session_termination();
        }
        return _this.replace_session(session, err);
    }
    let sess_info = session.info;
    if (!sess_info || !sess_info.ip)
        sess_info = res.info;
    if (res.info.ip!=sess_info.ip)
    {
        logger.debug('session %s: ip change %s -> %s', session.session,
            sess_info.ip, res.info.ip);
        if (_this.opt.session_termination)
            _this.serv.handle_session_termination();
    }
    session.info = res.info;
    session.last_res = {ts: Date.now(), ip: res.info.ip,
        session: session.session};
});

Sess_mgr.prototype.replace_session = function(session, err, opt={}){
    logger.debug('removing session %s: %s', session.session, err);
    this.remove_session(session);
    if (this.opt.pool_size && this.pool_prefill)
        this.pool_fetch(Object.assign({immediate: false}, opt));
};

Sess_mgr.prototype.serialize_session = function(session){
    return {
        session: session.session,
        ip: session.ip || session.last_res && session.last_res.ip,
        host: session.host,
        username: session.username,
        created: session.created,
    };
};

Sess_mgr.prototype.get_sessions = function(){
    return (this.sessions && this.sessions.sessions || []).reduce((acc, s)=>
        Object.assign({}, acc, {[s.session]: this.serialize_session(s)}), {});
};

Sess_mgr.prototype.remove_session = function(session){
    session.canceled = true;
    this.stop_keep_alive(session);
    for (let [, s_pool] of this.session_pools)
        s_pool.remove(session, this);
    if (!session.pool)
        return;
    const sessions = _.isArray(session.pool) ? session.pool :
        session.pool.sessions;
    _.remove(sessions, s=>s===session);
    if (this.opt.static && session.ip && this.opt.ips &&
        this.opt.ips.includes(session.ip))
    {
        this.serv.emit('remove_static_ip', session.ip);
    }
};

Sess_mgr.prototype.stop_keep_alive = function(session){
    if (!session || !session.keep_alive)
        return;
    session.keep_alive.return();
    session.keep_alive = null;
};

Sess_mgr.prototype.request_completed = function(session){
    if (!session || session.canceled || session.pool && session.pool.canceled)
        return true;
    if (!session.pool && session!=this.session)
        return this.stop_keep_alive(session);
    this.sp.spawn(this.set_keep_alive(session));
};

Sess_mgr.prototype.is_session_banned = function(session){
    return session.last_res && this.serv.is_ip_banned(session.last_res.ip);
};

Sess_mgr.prototype.is_session_expired = function(session){
    if (!session || session.canceled || session.pool && session.pool.canceled)
        return true;
    const expired = session.max_requests && session.count>session.max_requests
        || session.expire && Date.now()>session.expire;
    if (expired)
        this.stop_keep_alive(session);
    return expired;
};

Sess_mgr.prototype.send_info_request = etask._fn(
function*send_info_request(_this, session){
    const opt = {
        url: _this.opt.test_url,
        proxy: 'http://127.0.0.1:'+_this.opt.port,
        headers: {
            'x-hola-agent': lpm_config.hola_agent,
            'x-lpm-keep-alive': session.session,
        },
    };
    let res, err, info;
    try {
        request(opt, (error, _res)=>{
            if (error)
                err = error;
            else
                this.continue(_res);
        });
        res = yield this.wait();
        const ct = res.headers && res.headers['content-type'];
        if (res.statusCode==200 && ct && ct.match(/\/json/))
            info = JSON.parse(res.body);
    } catch(e){
        err = e;
        logger.warn(zerr.e2s(e));
    }
    return {res, info, err};
});

Sess_mgr.prototype.request_session = function(req){
    const ctx = req.ctx;
    if (ctx.h_session)
        this.serv.emit('feature_used', 'h_session');
    const sessions = this.sessions && this.sessions.sessions || [];
    if (ctx.h_keep_alive)
        return sessions.find(s=>s.session==ctx.h_keep_alive);
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

Sess_mgr.prototype._get_oldest_session = function(){
    return this.sessions.sessions.sort((a, b)=>a.created-b.created)[0];
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
        if (this.opt.preset=='long_availability')
            return this._get_oldest_session();
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
            if (this.session_duration)
                session.expire = Date.now()+this.session_duration;
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
                `${this.opt.port}_${ip}_${this.seed}`, this.sticky_sessions);
        }
        return session;
    }
    // use default random session
    if (this.opt.session===true && !this.opt.sticky_ip)
    {
        if (this.session && !opt.init)
            this.session.count++;
        if (!this.session || this.is_session_expired(this.session) ||
            this.is_session_banned(this.session))
        {
            this.session = this.establish_session(this.seed, this.sessions);
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
