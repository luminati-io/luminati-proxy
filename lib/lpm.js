// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/
const net = require('net');
const http = require('http');
const https = require('https');
const dns = require('dns');
const _ = require('lodash');
const {etask, string, date} = require('hutil');
const socks = require('@luminati-io/socksv5');
const username = require('./username.js');
const ssl = require('./ssl.js');
const util = require('./util.js');
const qw = string.qw;
const lpm_headers = qw`x-hola-context proxy-authorization x-hola-agent
    x-lpm-src-addr x-lpm-session x-hola-timeline-debug x-lpm-firewall-check
    x-lpm-reserved`;
const loopback_ip = '127.0.0.1';
const zproxy_domain = 'zproxy.luminati.io';
const E = module.exports = {};

const defaults = E.defaults = {
    proxy: zproxy_domain
};

class Lmanger {
    constructor(){
        this.servers = [];
    }
    start(){

    }
    stop(){

    }
}

E.Lmanger = Lmanger;

class Lserver {
    constructor(opt){
        this.opt = opt;
        this.sp = etask('Lserver', [()=>this.wait()]);
        this.lreqs = new Map();
        this.srvs = {};
        this.srv = net.createServer(sock=>this.accept(sock));
    }
    accept(sock){
        sock.on('error', err=>console.error(err));
        sock.once('data', this.req_router(sock));
    }
    route_req(sock){
        return buffer=>{
            sock.pause();
            let byte = buffer[0];
            let proto = null;
            if (byte==22)
                proto = 'https';
            else if (byte>32 && byte<127)
                proto = 'http';
            else if (byte==5)
                proto = 'socks';
            else
            {
                // XXX maximk: handle unknown protocol
                return sock.end();
            }
            let srv = this.get_srv(proto);
            sock.unshift(buffer);
            sock.resume();
            srv.accept(sock);
        };
    }
    handle_req(req, res, head){
        return this.handle_lreq(new Lrequest(req, res, head));
    }
    handle_lreq(lreq){
        const _this = this;
        let tsk = etask(function*(){
            let lres;
            this.finally(()=>_this.complete_lreq(this.err, lreq, lres));
            lreq.set_task(this);
            lreq.set_sess(yield _this.get_lreq_sess(lreq));
            lres = yield _this.send_req(lreq);
            yield _this.handle_lres(lreq, lres);
            return lres;
        });
        this.sp.spawn(tsk);
        return tsk;
    }
    get_srv(proto){
        if (this.srvs[proto])
            return this.srvs[proto];
        let srv = null;
        if (proto=='http')
            srv = new Lhttp_server(this._opt, this.handle_req.bind(this));
        else if (proto=='https')
            srv = new Lhttps_server(this._opt, this.handle_req.bind(this));
        else if (proto=='socks')
            srv = new Lsocks_server(this._opt, this.srvs);
        if (srv)
            this.srvs[proto] = srv;
        return srv;
    }
    handler_res(lreq){

    }
    complete_req(lreq){

    }
    listen(){
        let _this = this;
        return etask(function*(){
            yield _this.hosts.fetch();
            yield _this.srv.listen(this.opt.port);
        });
    }
    stop(){
        if (this.sp)
            this.sp.return();
        this.srv.stop();
    }
}

E.Lserver = Lserver;

class Lsession_mgr {
    constructor(opt){
        this.sp = etask('Session_mgr', ()=>this.wait());
        this.hosts = new Lhosts();
        // XXX maximk: choose pool from opt
        this.pool = null;
    }
    establish_session(prefix){
        let sp = etask([function(){

        }]);
        this.sp.spawn(sp);
        return sp;
    }
    get_lreq_sess(lreq){
        // XXX maximk: if allow proxy auth, get auth from headers
        // XXX maximk: handle x-lpm-session header
        // XXX maximk: handle reserved session header
        // XXX maximk: if pooling, get session from pool
        // XXX maximk: if sticky ip handler stick ip
        // XXX maximk: handle predefined session
        // XXX maximk: handle no session req
    }
}

E.Lsession_mgr = Lsession_mgr;

class Lhosts {
    constructor(opt){
        this.opt = opt;
        this.sp = etask('Lhosts', [()=>this.wait()]);
        this.hosts = [];
        this.host_sess = Map();
        this.proxy_count = opt.proxy_count;
        this.proxy_cache = opt._proxy_cache;
        this.conf_prxies = [].concat(opt.proxy||defaults.proxy);
        this.fetch_timeout = (opt.proxy_fetch_timeout||30)*date.ms.SEC;
        this.first_fetch = true;
        this.fetching = false;
    }
    fetch(){
        const _this = this;
        let sp = etask(function*(){
            let hosts, proxies = this.conf_prxies.slice(0), timeout = false;
            const tm = setTimeout(()=>{ timeout = true; }, this.fetch_timeout);
            this.finally(()=>_this.fetch_complete(this.error));
            let cached_hosts = _this.hosts;
            if (_this.first_fetch&&_this.proxy_cache)
            {
                cached_hosts = yield _this.proxy_cache.get(proxies)||[];
                _this.first_fetch = false;
            }
            hosts = cached_hosts.reduce((acc, h)=>acc.set(h, false),
                new Map());
            _this.fetching = true;
            while (proxies.length&&hosts.length<_this.proxy_count&&!timeout)
            {
                let proxy = proxies.shift();
                if (util.domain_is_ip(proxy))
                {
                    hosts.set(proxy, false);
                    continue;
                }
                proxies.push(proxy);
                let domain = proxy.length==2 ? zproxy_domain : proxy;
                try {
                    let ips = yield _this.fetch_from_dns(domain);
                    ips.forEach(ip=>hosts[ip] = proxy);
                } catch(e){
                    // XXX maximk: handle detach host from dns error
                }
            }
            clearTimeout(tm);
            _this.hosts = _.shuffle(Object.keys(hosts));
            if (_this.opt._proxy_cache)
                yield this.proxy_cache(_.toPairs(hosts).filter(p=>p[1]));
        });
        this.sp.spawn(sp);
        return sp;
    }
    fetch_complete(err){
        if (err||!this.hosts.length)
        {
            // XXX maximk: handle failed to resolve proxies
        }
        this.fetching = false;
    }
    fetch_from_dns(domain){
        const _this = this;
        if (domain==zproxy_domain)
            domain = `${this.calc_zproxy_uname()}.${domain}`;
        return etask.nfn_apply(dns, '.resolve', [domain]);
    }
    calc_zproxy_uname(){
        return `customer-${this.opt.customer}-session-${Date.now()}`;
    }
    has_next(){ return !!this.hosts.length; }
    next(){
        let hst = null;
        if (!this.has_next())
            return hst;
        hst = this.hosts.shift();
        this.hosts.push(hst);
        return hst;
    }
}

E.Lhosts = Lhosts;

class Lrequest {
    constructor(req, res, head){
    }
}

E.Lrequest = Lrequest;

class Lsession {
    constructor(opt){
        this.created = Date.now();
        this.opt = opt;
        this.duration = util.param_rand_range(opt.session_duration, 1000);
        this.max_requests = util.param_rand_range(opt.max_requests);
        this.count = 0;
    }
    calculate_username(){ return username.calc(this.opt); }
    is_expired(){
        return this.max_requests&&this.count>=this.max_requests
            ||this.duration && Date.now()-this.created>this.duration;
    }
}

E.Lsession = Lsession;

class Lround_robin_pool {
    constructor(itm_constr, size){
        this.sp = etask('Round_robin_pool', [()=>this.wait()]);
        this.itm_constr = itm_constr;
        this.itms = [];
        this.size = size;
        this.populate_sp = null;
        this.ready = false;
    }
    populate(){
        let _this = this;
        if (this.populate_sp)
            return this.populate_sp;
        let sp = etask(function*(){
            _this.populate_sp = this;
            let sess_sp = [];
            this.finally(()=>{
                // XXX maximk: handle populate errors
                if (!_this.ready && _this.itms.length>0)
                    _this.ready = true;
                _this.populate_sp = null;
            });
            _this.ready = false;
            for (let i=_this.itms.length; i<_this.size; i++)
                sess_sp.push(_this.itm_constr());
            (yield etask.all(sess_sp)).forEach(s=>_this.itms.push(s));
            _this.ready = true;
        });
        this.sp.spawn(sp);
        return sp;
    }
    has_next(){
        return !!this.itms.length;
    }
    clean_expired(itm){
        return _.remove(this.itms, (itm)=>itm.is_expired());
    }
    next(){
        let itm = null;
        if (!this.has_next())
            return itm;
        itm = this.itms.shift();
        this.itms.push(itm);
        return itm;
    }
    destroy(){
        this.sp.return();
        this.sp = null;
        this.itms = null;
        this.ready = false;
    }
}

E.Lround_robin_pool = Lround_robin_pool;

class Lseq_pool extends Lround_robin_pool {
    constructor(itm_constr){
        super(itm_constr, 1);
        if (this.sp)
            this.sp.return();
        this.sp = etask('Sequintial_pool', [()=>this.wait()]);
    }
}

E.Lseq_pool = Lseq_pool;

class Lrules {

}

E.Lrules = Lrules;

class Ltimeline {

}

E.Ltimeline = Ltimeline;

class Lsocks_server {
    constructor(opt, servers){
        this.opt = opt;
        this.srvs = servers;
        this.srv = null;
    }
    init(){
        this.srv = socks.createServer(this.handle_conn());
        this.srv.useAuth(socks.auth.None());
    }
    handle_conn(){
        return (info, accept, deny)=>{
            if (info.dstPort==80 && this.srvs.http)
                return this.srvs.http.accept_connection(accept(true));
            if (info.dstPort==443 && this.srvs.https)
                return this.srvs.https.accept_connection(accept(true));
            accept();
        };
    }
    accept(sock){
        if (!this.srv)
            this.init();
        this.srv._onConnection(sock);
    }
}

E.Lsocks_server = Lsocks_server;

class Lhttps_server {
    constructor(opt, on_req){
        this.opt = opt;
        this.on_req = on_req;
        this.ssl = opt.ssl;
        this.srv = null;
    }
    init(){
        const conf = this.ssl ? Object.assign({requestCert: false}, ssl())
            : {};
        this.srv = https.createServer(conf);
        this.srv.on('connection', this.handle_conn());
        this.srv.on('request', this.handle_req());
    }
    handle_conn(){ return sock=>sock.setNoDelay(); }
    handle_req(){ return (req, res, head)=>this.on_req(req, res, head); }
    accept(sock){
        if (!this.srv)
            this.init();
        this.srv.emit('connection', sock);
    }
}

E.Lhttps_server = Lhttps_server;

class Lhttp_server {
    constructor(opt, on_req){
        this.opt = opt;
        this.on_req = on_req;
        this.srv = null;
    }
    init(){
        this.srv = http.createServer();
        this.srv.on('connection', this.handle_conn());
        this.srv.on('request', this.handle_req());
    }
    handle_conn(){ return sock=>sock.setNoDelay(); }
    handle_req(){ return (req, res, head)=>this.on_req(req, res, head); }
    accept(sock){
        if (!this.srv)
            this.init();
        this.srv.emit('connection', sock);
    }
}

E.Lhttp_server = Lhttp_server;
