// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true, evil: true*/
const _ = require('lodash');
const events = require('events');
const date = require('../util/date.js');
const etask = require('../util/etask.js');
const url = require('url');
const util = require('util');
const username = require('./username.js');
const zerr = require('../util/zerr.js');
const qw = require('../util/string.js').qw;
const request = require('request');
const Timeline = require('./timeline.js');
const luminati = require('./luminati.js');
const assign = Object.assign, {SEC} = date.ms;
const E = module.exports;

E.pool_types = {
    sequential: 0,
    'round-robin': 1,
};
class Session_pool {
    constructor(key, name){
        this.key = key;
        this.name = name;
        this.sessions = [];
    }
    _insert(sess){ this.sessions.push(sess); }
    // XXX vladislavl: mvp - session_mgr temp send as parameter
    add(sess, session_mgr){
        if (sess.pool_keys && sess.pool_keys.has(this.key))
            return;
        zerr.info(`add session ${sess.session} to ${this.name} pool`);
        this._insert(sess);
        sess.pool_keys = sess.pool_keys||new Set();
        sess.pool_keys.add(this.key);
        session_mgr.sp.spawn(session_mgr.set_keep_alive(sess));
        return true;
    }
    get(){}
    _remove(sess){ _.remove(this.sessions, sess); }
    // XXX vladislavl: mvp - session_mgr temp send as parameter
    remove(sess, session_mgr){
        if (!sess.pool_keys || !sess.pool_keys.has(this.key))
            return;
        zerr.info(`delete session ${sess.session} from ${this.name} pool`);
        this._remove(sess);
        session_mgr.stop_keep_alive(sess);
        sess.pool_keys.delete(this.key);
    }
}
E.Session_pool = Session_pool;

class Reserve_session_pool extends Session_pool {
    constructor(key){ super(key, 'reserve'); }
    get(){
        const sess = this.sessions.shift();
        if (!sess)
            return void zerr.info(`no sessions in reserve pool`);
        this.sessions.push(sess);
        zerr.info(`get session ${sess.session} reserve pool`);
        return sess;
    }
}
E.Reserve_session_pool = Reserve_session_pool;

class Fast_session_pool extends Session_pool {
    constructor(key, size){
        super(key, 'fast');
        this.size = size||10;
        this.index = 0;
        this.direction = this.size>1 ? 1 : 0;
    }
    inc_index(){
        this.index = this.index+this.direction;
        if (this.index===0 || this.index==this.size-1)
            this.direction = -this.direction;
    }
    _insert(sess){
        this.sessions[this.index] = sess;
        this.inc_index();
    }
    get(){
        const sess = this.sessions[this.index];
        if (!sess)
            return;
        this.inc_index();
        zerr.info(`get session ${sess.session} from fast pool`);
        return sess;
    }
    _remove(sess){
        const i = this.sessions.indexOf(sess);
        if (i>=0)
            this.sessions[i] = undefined;
    }
}
E.Fast_session_pool = Fast_session_pool;

function Sess_mgr(lum, opt){
    events.EventEmitter.call(this);
    this.opt = opt;
    this.log = lum.log;
    this.lum = lum;
    this.session_pools = new Map();
    this.setMaxListeners(Number.MAX_SAFE_INTEGER);
    // XXX krzysztof: to delete since session_duration and max_requests is not
    // a range anymore
    if (opt.session_duration)
    {
        this.session_duration = (''+opt.session_duration).split(':')
        .map(i=>+i*SEC);
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
    this.keep_alive = opt.keep_alive && opt.keep_alive*SEC;
    this.reserved_keep_alive =
        (opt.keep_alive||opt.reserved_keep_alive||50)*SEC;
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

// XXX vladislavl: temp for back compatibility - should be refactored
Sess_mgr.prototype.get_reserved_sessions = function(){
    const r_sess_pool = this.session_pools.get('reserve_session');
    return r_sess_pool && r_sess_pool.sessions || [];
};

Sess_mgr.prototype.add_fast_pool_session = function(session, pool_key, size){
    if (!session || !pool_key)
        return;
    const s_pool = this.session_pools.get(pool_key)
        || new Fast_session_pool(pool_key, size);
    s_pool.add(session, this);
    this.session_pools.set(s_pool.key, s_pool);
};

Sess_mgr.prototype.add_reserve_pool_session = function(session, pool_key){
    if (!session || !pool_key)
        return;
    const s_pool = this.session_pools.get(pool_key)
        || new Reserve_session_pool(pool_key);
    s_pool.add(session, this);
    this.session_pools.set(s_pool.key, s_pool);
};

Sess_mgr.prototype.remove_session_from_pool = function(session, pool_key){
    const s_pool = this.session_pools.get(pool_key);
    if (!session || !s_pool)
        return;
    s_pool.remove(session, this);
};

Sess_mgr.prototype.calculate_username = function(opt){
    opt = assign.apply({}, [this.opt, this, opt].map(o=>_.pick(o||{},
        qw`customer zone country state city session asn dns override_password
        cid ip raw direct debug password mobile vip carrier ext_proxy`)));
    opt.password = opt.override_password||opt.password;
    if (opt.ext_proxy)
    {
        return Object.assign({password: opt.password},
            _.pick(opt.ext_proxy, 'username', 'password'));
    }
    let opt_usr = _.omit(opt, qw`password`);
    if (opt_usr.ip)
        opt_usr = _.omit(opt_usr, qw`session`);
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
    // XXX krzysztof: to delete since max_requests is not a range anymore
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

Sess_mgr.prototype.set_keep_alive = etask._fn(
function*set_keep_alive(_this, session){
    let keep_alive = session.pool_keys&&session.pool_keys.size ?
        _this.reserved_keep_alive : _this.keep_alive;
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
    _this.log.warn('session %s: keep alive ended', session.session);
});

Sess_mgr.prototype._keep_alive_handler = etask._fn(
function*_keep_alive_handler(_this, session){
    if ((!session.pool_keys||!session.pool_keys.size)
        && _this.is_session_expired(session) || _this.lum.stopped)
    {
        return false;
    }
    _this.log.info('Keep alive %s:%s', session.host, session.session);
    let res = yield _this.info_request(session, 'SESSION KEEP ALIVE');
    let info = res.info;
    let sess_info = session.info;
    if (!res)
        res = {res: {status_code: 502}, err: 'Unknown Error'};
    let proxy_err = _this.lum._check_proxy_response(session.host, res,
        {from: 'keep alive', error: res.err});
    if (proxy_err||res.err||!info)
    {
        _this.log.warn('session %s: keep alive failed, removing session',
            session.session);
        _this.remove_session(session);
        return proxy_err||res;
    }
    if (!sess_info||!sess_info.ip)
        sess_info = info;
    if (info.ip!=sess_info.ip)
    {
        _this.log.warn('session %s: ip change %s -> %s',
            session.session, sess_info.ip, info.ip);
    }
    session.info = sess_info;
    return res;
});

Sess_mgr.prototype.remove_session = function(session){
    session.canceled = true;
    this.stop_keep_alive(session);
    for (let [, s_pool] of this.session_pools)
        s_pool.remove(session, this);
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
    if (!session||session.canceled||session.pool&&session.pool.canceled)
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
    if (check_only && !session.pool && session!=this.session
        && (!session.pool_keys || !session.pool_keys.size))
    {
        return this.stop_keep_alive(session);
    }
    if (check_only)
        this.sp.spawn(this.set_keep_alive(session));
    // XXX krzysztof: to delete since session_duration is not range anymore
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
    if (expired && (!session.pool_keys || !session.pool_keys.size))
    {
        this.stop_keep_alive(session);
        this.log.debug('session %s:%s expired', session.host, session.session);
    }
    return expired;
};

Sess_mgr.prototype.info_request = etask._fn(
function*info_request(_this, session, context){
    let host = session.host || _this.lum.hosts[0];
    let cred = _this.calculate_username(session);
    let protocol = _this.opt.secure_proxy ? 'https' : 'http';
    let proxy_url = `${protocol}://${cred.username}:${cred.password}@${host}:${_this.opt.proxy_port}`;
    _this.log.debug('info_request via %s', proxy_url);
    let opt = {
        url: _this.opt.test_url,
        proxy: proxy_url,
        headers: {
            'x-hola-agent': luminati.hola_agent,
            host: 'zproxy.hola.org',
        },
        proxyHeaderWhiteList: luminati.hola_headers,
        proxyHeaderExclusiveList: luminati.hola_headers,
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
        }).on('finish', ()=>{
            timeline.track('end');
            this.continue();
        }).on('close', ()=>{
            timeline.track('end');
            this.continue();
        });
        const __this = this;
        let finished;
        _this.sp.spawn(etask(function*timeout_info_request(){
            yield etask.sleep(5000);
            if (!finished)
                __this.continue();
        }));
        yield this.wait();
        finished = true;
        if (err)
            throw err;
        res.body_size = res.body.length;
        let ct;
        if (res.status_code==200&&(ct = res.headers&&
            res.headers['content-type'])&&
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
    const ctx = req.ctx;
    const rules = ctx.rules;
    let session = this._request_session(req);
    const authorization = username.parse(ctx.h_proxy_authorization);
    if (authorization)
    {
        ctx.log.debug(`Using request authorization %O`, authorization);
        if (ctx.h_session)
            authorization.session = ctx.h_session;
        delete authorization.tool;
        session.authorization = authorization;
    }
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
    if (ctx.h_session)
        return {session: ctx.h_session};
    if (ctx.pool_key)
    {
        let s_pool = this.session_pools.get(ctx.pool_key), p_sess;
        if (p_sess = s_pool&&s_pool.get())
            return p_sess;
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
        direct: ctx.is_direct,
        vip: ctx.session&&ctx.session.vip||this.opt.vip,
    };
    return this.calculate_username(assign({}, opt, auth));
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

