// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/
const net = require('net');
const http = require('http');
const https = require('https');
const dns = require('dns');
const url = require('url');
const _ = require('lodash');
const hutil = require('hutil');
const {etask, string, date} = hutil;
const socks = require('@luminati-io/socksv5');
const username = require('./username.js');
const ssl = require('./ssl.js');
const request = require('request');
const util = require('./util.js');
const version = require('../package.json').version;
const qw = string.qw;
const lpm_headers = qw`x-hola-context proxy-authorization x-hola-agent
    x-lpm-src-addr x-lpm-session x-hola-timeline-debug x-lpm-firewall-check
    x-lpm-reserved`;
const hola_headers = qw`proxy-connection proxy-authentication x-hola-agent
    x-hola-debug x-hola-tunnel-key x-hola-tunnel-ip x-hola-tunnel-session
    x-hola-auth x-hola-unblocker-debug x-hola-session x-hola-cid
    x-hola-country x-hola-forbid-peer x-hola-dst-ips x-hola-ip
    x-hola-immediate x-hola-dns-only x-hola-response x-hola-direct-first
    x-hola-direct-discover x-hola-blocked-response x-hola-conf
    x-hola-headers-only x-hola-unblocker-bext x-hola-dynamic-tunnels
    x-hola-context x-luminati-timeline x-luminati-peer-timeline`;
const hola_agent = 'proxy='+version+' node='+process.version;
const loopback_ip = '127.0.0.1';
const zproxy_domain = 'zproxy.luminati.io';
const E = module.exports = {};
const defaults = E.defaults = {
    proxy: zproxy_domain
};
const pool_types = E.pool_types = {
    sequential: 0,
    round_robin: 1,
};

class Lmanger {
    constructor(opt){
        this.opt = opt;
        this.sp = etask('Lmanager', ()=>{});
        this.http_proxy = new Lhttp_proxy(opt);
        this.https_proxy = new Lhttps_proxy(opt);
        this.bypass_proxy = new Lproxy(opt);
        this.stats = new Lstats(opt);
        this.is_running = false;
        this.servers = [];
        this.agents = opt.agents;
        if (!this.agents)
        {
            this.agents = {
                http: new http.Agent({keepAlive: true, keepAliveMsecs: 5000}),
                https: new https.Agent({
                    keepAlive: true,
                    keepAliveMsecs: 5000,
                    servername: 'zproxy.luminati.io',
                }),
            };
        }
        (opt.proxies||[]).forEach(
            conf=>this.sp.spawn(this.add_server(conf)));
    }
    add_server(srv_config){
        const _this = this;
        return etask(function*(){
            let conf = _.pick(_this, ['http_proxy', 'https_proxy',
                'bypass_proxy', 'agents', 'stats']);
            const srv = new Lserver(Object.assign(srv_config, conf));
            _this.servers.push(srv);
            if (_this.is_running)
                yield srv.listen();
            return srv;
        });
    }
    remove_server(srv){
        const _this = this;
        return etask(function*(){
            if (srv.is_running)
                yield srv.stop();
            _.delete(_this.servers, srv);
            return srv;
        });
    }
    start(){
        this.is_running = true;
    }
    stop(){
        this.is_running = false;
        return etask(function*(){
            this.servers.forEach(srv=>{
                this.sp.spawn(srv.start());
            });
            yield this.wait_child('all');
        });
    }
    destroy(){
        this.is_running = false;
        this.sp.return();
        this.servers.forEach(srv=>srv.destroy());
        this.http_proxy.destroy();
        this.https_proxy.destroy();
        this.bypass_proxy.destroy();
        this.stats.destroy();
    }
}

E.Lmanger = Lmanger;

class Lserver {
    constructor(opt){
        this.opt = opt;
        this.sp = etask('Lserver', [()=>this.wait()]);
        this.lreqs = new Map();
        this.is_running = false;
        this.sess_mgr = new Lsession_mgr(opt);
        this.srvs = {};
        this.srv = net.createServer(sock=>this.accept(sock));
        this.reverse_lookup = new Lreverse_lookup(opt);
        this.stats = opt.stats;
        this.router = new Lreq_router(Object.assing({}, opt, {}));
    }
    accept(sock){
        sock.on('error', err=>console.error(err));
        sock.once('data', this.route_sock(sock));
    }
    route_sock(sock){
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
        this.sp.spawn(this.handle_lreq(new Lrequest(req, res, head)));
    }
    handle_lreq(lreq){
        const _this = this;
        return etask(function*(){
            let lres;
            this.finally(()=>_this.complete_lreq(this.error, lreq, lres));
            this.spawn(lreq.sp);
            if (_this.reverse_lookup.should_lookup(lreq.hostname))
            {
                lreq.update_hostname(
                    yield _this.reverse_lookup.lookup(lreq.hostname));
            }
            yield lreq.init();
            if (_this.is_sess_required(lreq))
                lreq.set_sess(yield _this.sess_mgr.get_lreq_sess(lreq));
            lres = yield _this.router.send_lreq(lreq);
            if (lres)
                yield _this.handle_lres(lreq, lres);
            return lres;
        });
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
    is_sess_required(lreq){
        return !this.is_no_proxy(lreq)&&!this.bypass_proxy.match(lreq);
    }
    is_no_proxy(lreq){
        return this.null_resp.matches(lreq) || this.fw_chk_resp.matches(lreq)
            || this.only_bypass&&!this.bypass_proxy.match(lreq);
    }
    handle_lres(lreq){
        this.stats.track_lreq(lreq, this);
    }
    complete_lreq(lreq){

    }
    listen(){
        let _this = this;
        return etask(function*(){
            this.is_running = true;
            yield _this.hosts.fetch();
            yield _this.srv.listen(this.opt.port);
        });
    }
    stop(){
        this.is_running = false;
        this.srv.stop();
    }
    destroy(){
        this.sp.return();
    }
}

E.Lserver = Lserver;

class Lsession_mgr {
    constructor(opt){
        this.sp = etask('Session_mgr', ()=>this.wait());
        this.hosts = new Lhosts();
        this.password = opt.password;
        this.session_id = 0;
        this.vips = opt.vips||[];
        this.ips = opt.ips||[];
        const sess_constr = sess_opt=>this.establish_session(sess_opt);
        if (this.should_use_seq_pool(opt))
            this.pool = new Lseq_pool(sess_constr);
        else if (opt.pool_type==pool_types.round_robin)
            this.pool = new Lround_robin_pool(sess_constr, opt.pool_size);
        if (opt.sticky_ip)
            this.sticky_sess = new Lsess_map({key: 'src_addr'});
        if (opt.allow_proxy_auth)
            this.auth_sess = new Lsess_map({key: 'h_proxy_authorization'});
        this.general_sess = new Lsess_map();
    }
    should_use_seq_pool(opt){
        return opt.session==true || opt.pool_type==pool_types.sequintial
            || opt.pool_type==pool_types.round_robin&&opt.pool_size<1;
    }
    establish_session(opt = {}){
        const _this = this;
        let {session, ip, vip, host, ips, vips} = opt;
        if (!session)
        {
            this.session_id++;
            session = 'sess-'+this.session_id;
        }
        if (!ip&&ips)
            ip = ips[this.session_id%ips.length];
        if (!vip&&vips)
            vip = vips[this.session_id%vips.length];
        return etask(function*(){
            if (!host&&!_this.hosts.has_next())
            {
                yield _this.hosts.fetch();
                host = _this.hosts.next();
            }
            opt = Object.assign({password: opt.password},
                {session, ip, vip, host}, opt);
            return new Lsession(opt);
        });
    }
    get_lreq_sess(lreq){
        const _this = this;
        return etask(function*(){
            if (_this.opt.allow_proxy_auth && lreq.authorization)
                return yield _this.authorization_session(lreq);
            if (lreq.h_session)
            {
                return yield _this.constant_session(lreq, 'h_session',
                    lreq.h_session);
            }
            if (_this.opt.session&&_this.opt.session!==true)
            {
                return yield _this.constant_session(lreq, 'constant',
                    this.opt.session);
            }
            if (!_this.pool)
                return yield _this.constant_session(lreq, 'constant', false);
            if (_this.sticky_sess && _this.sticky_sess.has(lreq))
                return _this.sticky_sess.get(lreq);
            let sess = yield _this.pool.ensure_populated_next(lreq);
            if (sess&&_this.opt.sticky_ip)
                _this.sticky_sess.set(lreq, sess);
            return sess;
        });
    }
    authorization_session(lreq){
        let _this = this;
        if (this.auth_sess && this.auth_sess.get(lreq))
        {
            let auth_sess = this.auth_sess.get(lreq);
            if (lreq.h_session && lreq.h_session == auth_sess.session)
                return auth_sess;
        }
        return etask(function*(){
            let sess_opt = _.extend({}, lreq.authorization);
            if (sess_opt.timeout)
                sess_opt.request_timeout = sess_opt.timeout;
            if (lreq.h_session)
                sess_opt.session = lreq.h_session;
            let sess = yield _this.establish_session(sess_opt);
            _this.auth_sess.set(lreq, sess);
            return sess;
        });
    }
    constant_session(lreq, name, val){
        let _this = this;
        let sess;
        if (this.general_sess.has(name))
        {
            sess = this.general_sess.get(name);
            if (val === false && !sess.hasOwnPropery('session'))
                return sess;
            // XXX maximk: should clean up sessions with different val
            if (sess.session == val)
                return sess;
        }
        return etask(function*(){
            let sess_opt = {session: val};
            sess = yield _this.establish_session(sess_opt);
            _this.general_sess.set(name, sess);
            return sess;
        });
    }
}

E.Lsession_mgr = Lsession_mgr;

class Lsess_map {
    constructor(opt={}){
        this.opt = _.defaults(opt, {key: false, validate: true});
        this.sessions = Map();
    }
    resolve_key(lreq){
        if (this.opt.key)
            return lreq[this.opt.key];
        return lreq;
    }
    is_valid(sess){
        if (!this.opt.validate)
            return true;
        return !sess || !this.is_expired();
    }
    get(lreq){
        let key = this.resolve_key(lreq);
        let sess = this.sessions.get();
        if (!this.is_valid(sess))
        {
            this.sessions.delete(key);
            sess = null;
        }
        return sess;
    }
    set(lreq, sess){
        if (!this.is_valid(sess))
            return false;
        this.sessions.set(this.resolve_key(lreq), sess);
        return true;
    }
}

E.sess_map = Lsess_map;

class Lrequest {
    constructor(id, req, res, head, opt){
        this.id = util.gen_id();
        this.req = req;
        this.res = res;
        this.head = head;
        this.opt = opt;
        this.sp = etask('Lrequest', function*(){ yield this.wait(); });
        this.sess = null;
        this.is_ssl = util.req_is_ssl(this.req);
        this.is_connect = util.req_is_connect(this.req);
        this.insecure = opt.insecure;
        this.sys_timeout = this.opt.timeout;
        this.req_timeout = this.req.timeout;
        this.timeout = Math.min(this.sys_timeout, this.req_timeout);
        this.proxy_port = opt.proxy_port;
        this.init_headers();
        this.req_url = req.url;
        this.update_url(req.url);
        if (this.opt.allow_proxy_auth)
            this.init_authorization();
    }
    init(){
        const _this = this;
        return etask(function*(){
            // XXX maximk: implement
            return yield true;
        });
    }
    init_headers(){
        this.headers = Object.asssign({}, this.req.headers);
        this.raw_headers = Object.assing({}, this.req.rawHeaders);
        lpm_headers.forEach(h=>{
            let v_name = 'h_'+h.replace(/^(x-hola-|x-lpm-)/, '')
            .replace('-', '_');
            this[v_name] = this.headers[h]||null;
            delete this.headers[h];
        });
    }
    init_authorization(){
        if (!this.h_proxy_authorization)
            return;
        this.authorization = username.parse(this.h_proxy_authorization);
    }
    set_sess(sess){
        this.sess = sess;
    }
    get_connect_headers(){
        const headers = {'x-hola-agent': hola_agent};
        if (!this.sess)
            return headers;
        const cred = this.session.get_creds();
        headers['proxy-authorization'] = 'Basic ' + new Buffer(cred.username
            +':'+cred.password).toString('base64');
        return headers;
    }
    get_proxy(){
        return this.session.host;
    }
    update_hostname(hostname){
        if (!hostname || this.hostname==hostname)
            return null;
        let _url = this.parsed_url;
        _url.hostname = hostname;
        _url.host = hostname+(_url.port ? `:${_url.port}` : '');
        return this.update_url(_url);
    }
    pipe(pipe){
        return this.req.pipe(pipe);
    }
    unpipe(pipe){
        return this.req.unpipe(pipe);
    }
    update_url(_url){
        if (!_url)
            return null;
        if (typeof _url == 'string')
            _url = url.parse(_url);
        this.parsed_url = _url;
        this.url = _url.format();
        this.hostname = _url.hostname;
        this.host = _url.host;
        return _url;
    }
    destroy(){
        this.sp.return();
    }
}

E.Lrequest = Lrequest;

class Lresponse {
    constructor(lreq, opt){
        this.lreq = lreq;
        this.headers = opt.headers;
        this.pipe_res = opt.res;
        this.status_code = opt.status_code;
        this.status_meessage = opt.status_message;
        if (this.pipe_res)
        {
            this.status_code = this.status_code || this.pipe_res.statusCode;
            this.status_message = this.status_message
                || this.pipe_res.statusMessage;
            this.headers = this.headers || this.pipe_res.headers;
        }
        this.res = lreq.res;
    }
    write_head(headers = {}, opt = {}){
        const lreq = this.lreq;
        headers = Object.assign({}, this.headers, headers);
        // XXX maximk: revisit context and auth response headers
        if (lreq)
            headers['x-hola-context'] = lreq.h_context;
        const creds = lreq.get_creds();
        if (creds)
            headers['x-lpm-authorization'] = creds.username;
        this.res.resp_written = true;
        this.res.writeHead(
            opt.status_code || this.status_code,
            this.status_message || this.status_message,
            headers
        );
    }
    write(buf){
        return this.res.write(buf);
    }
    send(body){
        return this.res.end(body);
    }
    pipe(socket, dual){
        socket.pipe(this.res);
        if (dual)
            this.res.pipe(socket);
    }
}

E.Lresponse = Lresponse;

class Lsession {
    constructor(opt){
        this.created = Date.now();
        this.opt = opt;
        this.duration = util.param_rand_range(opt.session_duration, 1000);
        this.max_requests = util.param_rand_range(opt.max_requests);
        this.count = 0;
    }
    calculate_username(){ return username.calc(this.opt); }
    get_creds(){
        return {
            username: this.calculate_username(),
            password: this.opt.password,
        };
    }
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
        etask(function*(){
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
    }
    has_next(){
        return !!this.itms.length;
    }
    clean_expired(){
        return _.remove(this.itms, itm=>itm.is_expired());
    }
    next(){
        let itm = null;
        if (!this.has_next())
            return itm;
        itm = this.itms.shift();
        this.itms.push(itm);
        return itm;
    }
    ensure_populated_next(){
        const _this = this;
        return etask(function*(){
            _this.clean_expired();
            if (!_this.has_next())
                yield _this.populate();
            else
                _this.populate();
            return _this.next();
        });
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
        etask(function*(){
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
                if (util.is_ip(proxy))
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
    }
    fetch_complete(err){
        if (err||!this.hosts.length)
        {
            // XXX maximk: handle failed to resolve proxies
        }
        this.fetching = false;
    }
    fetch_from_dns(domain){
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

class Lreq_router {
    constructor(opt){
        this.opt = opt;
        if (opt.bypass_proxy)
            this.bypass_re = new RegExp(opt.bypass_proxy, 'i');
        if (opt.proxy_internal_bypass)
            this.internal = opt.proxy_internal_bypass;
        if (opt.null_response)
            this.null_re = new RegExp(opt.null_response, 'i');
        if (opt.only_bypass)
            this.only_bypass = opt.only_bypass;
        this.race_reqs = opt.race_reqs || 0;
        this.only_bypass = opt.only_bypass;
        this.http_proxy = opt.http_proxy_server;
        this.https_proxy = opt.https_proxy_server;
        this.bypass_proxy = opt.bypass_proxy_server;
    }
    match_lst(lst, lreq){
        if (!Array.isArray(lst))
            return false;
        return lst.only_bypass.some(x=>this.match_domain(x, lreq.hostname));
    }
    match_domain(mask, hostname){
        let mp = mask.split('.');
        let hp = hostname.split('.').slice(-mp.length);
        return mp.every((p, i)=>p=='*' || hp[i]==p);
    }
    is_fw_chk(lreq){
        return !!lreq.h_firewall_check;
    }
    send_fw_chk_resp(lreq){
        const lres = new Lresponse(lreq);
        lres.send(JSON.stringify({pass: true}));
        return lres;
    }
    is_null_resp(lreq){
        return !!this.null_re&&this.null_re.test(lreq.url);
    }
    send_null_resp(lreq){
        const status_code = lreq.is_connect ? 501 : 200;
        const status_message = 'NULL';
        const lres = new Lresponse(lreq, {status_code, status_message});
        lres.write_head();
        lres.send();
        return lres;
    }
    is_bypass_proxy(lreq){
        if (this.bypass_re&&this.bypass_re.test(lreq.url))
            return true;
        if (this.match_lst(this.internal, this.lreq))
            return true;
        if (this.match_lst(this.only_bypass, lreq))
            return true;
        return false;
    }
    send_lreq(lreq){
        const _this = this;
        if (this.is_fw_chk(lreq))
            return this.send_fw_chk_resp(lreq);
        if (this.is_null_resp(lreq))
            return this.send_null_resp(lreq);
        if (this.only_bypass&&!this.is_bypass_proxy(lreq))
            return this.null_resp.send(lreq);
        return etask(function*(){
            if (_this.is_bypass_proxy(lreq))
                return yield _this.bypass_proxy.send(lreq);
            let lproxy = _this.http_proxy;
            if (lreq.is_ssl)
                lproxy = _this.https_proxy;
            return yield _this.send_to_lproxy(lreq, lproxy);
        });
    }
    send_to_lproxy(lreq, lproxy){
        const _this = this;
        return etask(function*(){
            let race_reqs = _this.race_reqs || 1;
            for (let rep=0; rep<race_reqs; rep++)
                this.spawn(lproxy.send(lreq));
            yield this.wait_child('any');
        });
    }
}

class Lfw_chk_resp {
    matches(lreq){
        return !!lreq.h_firewall_check;
    }
    send(lreq){
        const lres = new Lresponse(lreq);
        lres.send(JSON.stringify({pass: true}));
        return lres;
    }
}

E.Lfw_chk_resp = Lfw_chk_resp;

class Lproxy {
    constructor(opt){
        this.agents = opt.agents;
        this.sp = etask('Lproxy', function*(){ yield this.wait(); });
    }
    get_net_ctx(lreq){
        if (lreq.is_secure)
            return {client: https, agent: this.agents.https};
        return {client: http, agent: this.agents.http};
    }
    send(lreq){
        let _this = this;
        return etask(function*(){
            let pipe = null;
            let lres = new Lresponse(lreq);
            if (lreq.is_connect)
            {
                pipe = net.connect({host: lreq.hostname, port: lreq.port});
                pipe.on('connect', ()=>{
                    lres.write_head({}, {status_code: 200,
                        status_message: 'OK'});
                    lres.pipe(pipe, true);
                });
            }
            else
            {
                pipe = request({
                    uri: lreq.url,
                    host: lreq.hostname,
                    method: lreq.method,
                    path: lreq.req_url,
                    headers: lreq.headers,
                    rejectUnauthorized: !lreq.insecure,
                    followRedirect: false,
                });
                pipe.on('connect', (res, socket)=>{
                    res.on('error', this.throw_fn());
                    socket.on('error', this.throw_fn());
                });
                if (lreq.body)
                    pipe.write(lreq.body);
                lreq.pipe(pipe);
            }
            pipe.on('close', ()=>{ this.return(lres); })
            .on('error', this.throw_fn());
            if (!lreq.is_connect)
                return yield _this.handle_pipe(lreq, pipe);
            return this.wait();
        });
    }
    handle_pipe(lreq, pipe, headers){
        const _this = this;
        return etask(function*(){
            if (lreq.timeout)
            {
                pipe.setTimeout(lreq.timeout,
                    _this.handle_timeout(lreq, pipe, this));
            }
            pipe.on('response', _this.handle_resp(lreq, pipe, this, headers));
            pipe.on('connect', _this.handle_connect(lreq, pipe, this));
            pipe.on('error', _this.handle_error(lreq, pipe, this));
            yield this.wait();
        });
    }
    handle_timeout(lreq, pipe, sp){
        return ()=>{
            sp.throw(new Error(`timeout ${lreq.timeout}`));
            // XXX maximk: implement rule timeout handling
        };
    }
    handle_connect(lreq, pipe, sp){
        return (res, socket, head)=>{
            try {
                const lres = new Lresponse(lreq, {res});
                lres.write_head();
                if (res.statusCode!=200)
                {
                    // XXX maximk: handle error from proxy
                    lres.send();
                    return sp.return(lres);
                }
                socket.write(lreq.head);
                lres.write(head);
                // XXX maximk: handle body_count (count_stream)
                lres.pipe(socket, true);
            } catch(e){
                sp.throw(e);
            }
        };
    }
    handle_resp(lreq, pipe, sp, headers){
        return res=>{
            if (pipe.aborted)
                return;
            try {
                const lres = new Lresponse(lreq, {res});
                // XXX maximk: handle peer ip collection for banip
                // XXX maximk: handle rules
                lres.write_head(headers);
                // XXX maximk: handle body_count (count_stream)
                lres.pipe(res);
                res.on('end', ()=>{
                    // XXX maximk: check proxy response
                    if (res.statusCode>=400)
                    {
                        return sp.throw(new Error(
                            `${res.statusCode} ${res.statusMessage}`));
                    }
                    sp.return(lres);
                })
                .on('error', sp.throw_fn());
            } catch(e){
                sp.throw(e);
            }
        };
    }
    handle_error(lreq, pipe, sp){
        return err=>{
            // XXX maximk: check if responded and connected flags needed
            if (pipe.aborted)
                return;
            // XXX maximk: handle retry rules
            // XXX maximk: check proxy response
            sp.throw(err);
        };
    }
    abort(lreq, pipe){
        lreq.unpipe(pipe);
        pipe.abort();
    }
    destry(){
        this.sp.return();
    }
}

E.Lproxy = Lproxy;

class Lhttp_proxy extends Lproxy {
    send(lreq){
        const nctx = this.get_net_ctx(lreq);
        return etask(function*(){
            const headers = Object.assign({}, lreq.get_connect_headers(),
                lreq.headers);
            const pipe_req = nctx.client.request({
                host: lreq.host,
                port: lreq.proxy_port,
                path: lreq.url,
                agent: nctx.agent,
                headers,
                proxyHeaderWhiteList: hola_headers,
                proxyHeaderExclusiveList: hola_headers,
                rejectUnauthorized: !lreq.insecure
            });
            if (lreq.is_connect)
                pipe_req.end();
            else
            {
                if (lreq.body)
                    pipe_req.write(lreq.body);
                lreq.pipe(pipe_req);
            }
            return yield this.handle_pipe(lreq, pipe_req);
        });
    }
}

E.Lhttp_proxy = Lhttp_proxy;

class Lhttps_proxy extends Lproxy {
    send(lreq){
        const _this = this;
        return etask(function*(){
            const pipe_conn = yield _this.send_connect(lreq);
            const pipe = https.request({
                host: lreq.headers.host,
                method: lreq.host,
                path: lreq.url,
                headers: lreq.headers,
                proxyHeaderWhiteList: hola_headers,
                proxyHeaderExclusiveList: hola_headers,
                socket: pipe_conn.socket,
                agent: false,
                rejectUnauthorized: !lreq.insecure,
            });
            if (lreq.body)
                pipe.write(lreq.body);
            lreq.pipe(pipe);
            lreq.req.on('close', ()=>pipe.abort());
            return yield _this.handle_pipe(lreq, pipe, pipe_conn.headers);
        });
    }
    send_connect(lreq){
        const nctx = this.get_net_ctx();
        return etask(function*(){
            nctx.client.request({
                host: lreq.get_proxy(),
                port: lreq.proxy_port,
                method: 'CONNECT',
                headers: lreq.get_connect_headers(),
                agent: nctx.agent,
                rejectUnauthorized: !lreq.insecure,
            })
            .on('connect', (res, socket, head)=>{
                this.return({res, socket, head, headers: res.headers});
            })
            .on('error', this.throw_fn())
            .end();
            yield this.wait();
        });
    }
}

E.Lhttps_proxy = Lhttps_proxy;

class Lstats {
    track_lreq(){

    }
}

E.Lstats = Lstats;

class Lreverse_lookup {
    constructor(opt = {}){
        this.opt = opt;
        this.sp = etask('Lreverse_lookup', [()=>this.wait()]);
        if (opt.reverse_lookup_dns)
            this.dns_enabled = true;
        if (opt.reverse_lookup_file)
        {
            this.add_domains(Lreverse_lookup.read_vals_file(
                opt.reverse_lookup_file));
        }
        if (opt.reverse_lookup_values)
        {
            this.add_domains(Lreverse_lookup.parse_vals(
                opt.reverse_lookup_values));
        }
    }
    should_lookup(hostname){
        return this.lookup&&util.is_ip(hostname);
    }
    add_domains(domains = {}){
        this.domains = Object.assign({}, this.domains, domains||{});
        this.lookup = this.dns_enabled||!_.is_empty(this.domains);
    }
    clear_domains(){
        this.domains = {};
        this.lookup = this.dns_enabled;
    }
    enable_dns(enabled = true){
        this.dns_enabled = enabled;
    }
    lookup(ip, one = true){
        if (!this.lookup)
            return null;
        if (this.domains && this.domains[ip])
            return one ? this.domains[ip] : [this.domains[ip]];
        if (!this.dns_enabled)
            return null;
        return etask(function*(){
            let domains = yield etask.nfn_apply(dns, '.reverse', [ip]);
            if (!domains || !domains.length)
                return null;
            return one ? domains[0] : domains;
        });
    }
    static parse_vals(vals){
        const domains = {};
        const ns_re = /^\s*(\d+\.\d+\.\d+\.\d+)\s+([^\s#]+)([\s]*#.*)?$/;
        for (let line of vals)
        {
            const m = line.match(ns_re);
            if (m&&m.length>=2)
                domains[m[1]] = m[2];
        }
        return domains;
    }
    static read_vals_file(file){
        return Lreverse_lookup.parse_vals(hutil.file.read_lines_e(file));
    }
}

E.Lreverse_lookup = Lreverse_lookup;

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
