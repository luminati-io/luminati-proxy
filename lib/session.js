// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true, evil: true*/
const events = require('events');
const crypto = require('crypto');
const url = require('url');
const util = require('util');
const etask = require('../util/etask.js');
const username = require('./username.js');
const util_lib = require('./util.js');
const logger = require('./logger').child({category: 'SESS'});
const E = module.exports;

function Sess_mgr(serv, opt){
    events.EventEmitter.call(this);
    this.sp = etask(function*sesssion_manager(){ yield this.wait(); });
    this.opt = opt;
    this.serv = serv;
    this.setMaxListeners(Number.MAX_SAFE_INTEGER);
    this.session_id = opt.session_id||0;
    this.sticky_sessions = {};
    this.temp_ips = [];
    this.opt.num_workers = this.opt.num_workers||1;
    this.opt.worker_id = this.opt.worker_id||1;
    if (opt.session!==true && opt.session)
        opt.pool_size = 1;
    this.pool_prefill = !this.serv.rules.has_reserve_session_rules();
}

util.inherits(Sess_mgr, events.EventEmitter);

Sess_mgr.prototype.add_to_pool = function(session={}){
    const ip = session.ip || session.last_res && session.last_res.ip;
    if (!ip || !this.opt.pool_size)
        return;
    const ips = this.opt.ips||[];
    if (ips.length>=this.opt.pool_size || ips.includes(ip))
        return;
    if (this.temp_ips.length>=this.opt.pool_size || this.temp_ips.includes(ip))
        return;
    this.temp_ips.push(ip);
    this.serv.emit('add_static_ip', ip);
};

Sess_mgr.prototype.refresh_sessions = function(session_id){
    if (session_id)
        this.session_id = session_id;
    if (this.opt.sticky_ip)
    {
        this.sticky_sessions.canceled = true;
        this.sticky_sessions = {};
    }
    if (this.opt.session==true && this.session)
        this.session = this.establish_session(this.serv.port);
};

Sess_mgr.prototype.is_using_pool = function(){
    const curr_num = (this.opt.ips||this.opt.vips||[]).length;
    return this.opt.pool_size==curr_num;
};

Sess_mgr.prototype.establish_session = function(prefix, pool){
    let postfix = null;
    let session_id, asn, ip, vip, host, ext_proxy, proxy_port;
    if (pool && pool.canceled || this.stopped)
        return;
    const ips = this.is_using_pool() && this.opt.ips || [];
    const vips = this.is_using_pool() && this.opt.vips || [];
    const ext_proxies = this.opt.ext_proxies||[];
    let ord_id;
    if (this.opt.rotate_session)
    {
        ord_id = this.session_id*this.opt.num_workers+this.opt.worker_id-1;
        postfix = get_postfix();
    }
    else
        ord_id = this.session_id;
    this.session_id++;
    if (this.opt.session!==true && this.opt.session)
        session_id = this.opt.session;
    else
        session_id = `${prefix}_${ord_id}${postfix ? '_'+postfix : ''}`;
    ext_proxy = ext_proxies[ord_id%ext_proxies.length];
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
        vip = vips[ord_id%vips.length];
        ip = ips[ord_id%ips.length];
        if (Array.isArray(this.opt.asn))
            asn = this.opt.asn[ord_id%this.opt.asn.length];
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
        proxy_port,
    };
    if (asn)
        session.asn = asn;
    if (this.opt.rotate_session)
        session.rotate_session = this.opt.rotate_session;
    logger.debug('new session added %s:%s', ext_proxy && host || 'dyn_host',
        session_id);
    return session;
};

Sess_mgr.prototype.get_session_host = function(session){
    if (session && session.ext_proxy)
       return session.host;
    return this.serv.get_next_host(this.opt.proxy_country=='cn');
};

Sess_mgr.prototype.replace_session = function(session, err, opt={}){
    logger.debug('removing session %s: %s', session.session, err);
    session.canceled = true;
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
    let session = this.retrieve_session(ctx);
    if (session && (!session.session || ctx.h_session))
    {
        if (ctx.h_session && this.session)
            this.session = null;
        if (this.session)
            session = this.session;
    }
    if (session)
        session.count = (session.count||0)+1;
    return session;
};

const str2hash = str=>{
    let hash = 0;
    if (!str.length)
        return hash;
    for (let i=0; i<str.length; i++)
    {
        const char = str.charCodeAt(i);
        hash = (hash<<5)-hash+char;
        hash = hash&hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
};

Sess_mgr.prototype.retrieve_session = function(ctx){
    let hosts = this.serv.hosts;
    if (this.opt.proxy_country=='cn' && this.serv.cn_hosts.length)
        hosts = this.serv.cn_hosts;
    if (ctx.h_session)
    {
        const sess_hash = str2hash(ctx.h_session);
        return {
            session: ctx.h_session,
            host: hosts[sess_hash%hosts.length],
        };
    }
    if (this.opt.sticky_ip)
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
    if (!this.session || this.is_session_expired(this.session) ||
        this.is_session_banned(this.session))
    {
        this.session = this.establish_session(this.serv.port);
    }
    return this.session;
};

Sess_mgr.prototype.stop = function(){
    if (this.sp)
        this.sp.return();
};
E.Sess_mgr = Sess_mgr;

const parse_proxy_string = (_url, defaults)=>{
    if (!_url.match(/^(http|https|socks|socks5):\/\//))
        _url = `http://${_url}`;
    _url = Object.assign({}, defaults,
        util_lib.omit_by(url.parse(_url), v=>!v));
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

const get_postfix = ()=>crypto.randomBytes(8).toString('hex');
