// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/
const net = require('net');
const http = require('http');
const https = require('https');
const dns = require('dns');
const url = require('url');
const _ = require('lodash');
const hutil = require('hutil');
const {etask, string, date, zerr} = hutil;
const socks = require('@luminati-io/socksv5');
const log = require('./log.js');
const username = require('./username.js');
const ssl = require('./ssl.js');
const server_destroy = require('server-destroy');
const request = require('request');
const util = require('./util.js');
const qw = string.qw;
const E = module.exports = {};
const version = E.version = require('../package.json').version;
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
const hola_agent = E.hola_agent = 'proxy='+version+' node='+process.version
+' platform='+process.platform;
const loopback_ip = '127.0.0.1';
const zproxy_domain = 'zproxy.lum-superproxy.io';
const lserver_defaults = E.lserver_defaults = {
    proxy: zproxy_domain,
    proxy_count: 1,
    port: 24000,
    proxy_port: 22225,
    zone: process.env.LUMINATI_ZONE||'static',
    customer: process.env.LUMINATI_CUSTOMER,
    password: process.env.LUMINATI_PASSWORD,
    allow_proxy_auth: true,
    short_username: false,
};
const pool_types = E.pool_types = {
    sequential: 0,
    'round-robin': 1,
};

class Lmanger {
    constructor(opt){
        this.opt = opt;
        this.sp = etask(function*lmanager(){ return yield this.wait(); });
        this.log = log('Lmanager', opt.log);
        this.log.debug('create');
        this.http_proxy = new Lhttp_proxy(opt);
        this.https_proxy = new Lhttps_proxy(opt);
        this.bypass_proxy = new Lproxy(opt);
        this.stats = new Lstats(opt);
        this.is_running = false;
        this.servers = [];
        (opt.proxies||[]).forEach(
            conf=>this.sp.spawn(this.add_server(conf)));
    }
    add_server(srv_config){
        const _this = this;
        this.log.debug('add server %O', srv_config);
        return etask(function*lmanager_add_server(){
            let conf = _.pick(_this, ['http_proxy', 'https_proxy',
                'bypass_proxy', 'agents', 'stats']);
            conf.log = _this.opt.log;
            const srv = new Lserver(Object.assign(conf, srv_config));
            _this.servers.push(srv);
            if (_this.is_running)
                yield srv.start();
            return srv;
        });
    }
    remove_server(srv){
        const _this = this;
        this.log.debug('remove server %d', srv.port);
        return etask(function*lmanager_remove_server(){
            if (srv.is_running)
                yield srv.stop();
            _.delete(_this.servers, srv);
            return srv;
        });
    }
    start(){
        const _this = this;
        this.log.debug('starting...');
        this.starting = true;
        return etask(function*lmanager_start(){
            this.finally(()=>{
                _this.starting = false;
                if (this.error || !_this.is_running)
                {
                    // XXX maximk: handle start failure
                    _this.log.error('start error %s', zerr.e2s(this.error));
                    return;
                }
                _this.log.debug('running');
            });
            _this.servers.forEach(srv=>{
                _this.sp.spawn(srv.start());
            });
            yield this.wait_child('all');
            _this.is_running = true;
        });

    }
    stop(){
        const _this = this;
        this.stopping = true;
        return etask(function*lmanage_stop(){
            this.finally(()=>{
                _this.stopping = false;
                if (this.error || _this.is_running)
                {
                    // XXX maximk: handle stop error
                    _this.log.error('stop error %s', zerr.e2s(this.error));
                    return;
                }
                _this.log.debug('stopped');
            });
            _this.servers.forEach(srv=>{
                _this.sp.spawn(srv.stop());
            });
            yield this.wait_child('all');
            _this.is_running = false;
        });
    }
    destroy(){
        this.log.debug('destroy');
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
    constructor(opt = {}){
        opt = this.opt = Object.assign({}, lserver_defaults, opt);
        this.port = opt.port||lserver_defaults.port;
        this.sp = etask(function*lserver(){ yield this.wait(); });
        this.log = log(`${this.port} Lserver`, opt.log);
        this.log.debug('create');
        this.lreqs = new Map();
        this.ssl = opt.ssl;
        this.is_running = false;
        this.stopping = false;
        this.starting = false;
        this.sess_mgr = new Lsession_mgr(opt);
        this.srvs = {};
        this.srv = net.createServer(sock=>this.accept(sock));
        server_destroy(this.srv);
        this.reverse_lookup = new Lreverse_lookup(opt);
        this.stats = opt.stats;
        this.router = new Lreq_router(Object.assign({}, opt, {}));
    }
    accept(sock){
        this.log.debug('accept');
        sock.on('error', err=>this.log.error(zerr.e2s(err)));
        sock.once('data', this.route_sock(sock));
    }
    route_sock(sock){
        return buffer=>{
            sock.pause();
            let byte = buffer[0];
            this.log.debug('route_sock, first byte: %d', byte);
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
                this.log.error('route_sock, unknown protocol');
                return sock.end();
            }
            this.log.debug('route_sock, %s detected, forwarding', proto);
            let srv = this.get_srv(proto);
            sock.unshift(buffer);
            srv.accept(sock);
            sock.resume();
        };
    }
    handle_req(req, res, head){
        this.log.debug('handle req %s', req.url);
        this.sp.spawn(this.handle_lreq(
            new Lrequest(req, res, head, this.opt)));
    }
    handle_connect(req, sock, head){
        this.log.debug('handle_connect');
        let _head = `HTTP/1.1 200 OK\r\n`;
        sock.write(_head+'\r\n');
        this.accept(sock);
    }
    handle_lreq(lreq){
        const _this = this;
        this.log.debug('handle lreq %s', lreq.id);
        this.lreqs.set(lreq.id, lreq);
        return etask(function*lserver_handle_req(){
            let lres;
            this.finally(()=>_this.complete_lreq(this.error, lreq, lres));
            try {
                 _this.log.debug('before lookup');
                if (_this.reverse_lookup.should_lookup(lreq.hostname))
                {
                    _this.log.debug('reverse_lookup %s', lreq.hostname);
                    lreq.update_hostname(
                        yield _this.reverse_lookup.lookup(lreq.hostname));
                }
                _this.log.debug('before sess');
                if (_this.is_sess_required(lreq))
                {
                    _this.log.debug('searching for session');
                    lreq.set_sess(yield _this.sess_mgr.get_lreq_sess(lreq));
                }
                _this.log.debug('before send');
                lres = yield _this.router.send_lreq(lreq);
                if (lres)
                    yield _this.handle_lres(lreq, lres);
                return lres;
            } catch(e){ _this.log.error(zerr.e2s(e)); }
        });
    }
    get_srv(proto){
        if (this.srvs[proto])
            return this.srvs[proto];
        let srv = null;
        if (proto=='http')
        {
            srv = new Lhttp_server(this.opt, this.handle_req.bind(this),
                this.handle_connect.bind(this));
        }
        else if (proto=='https')
            srv = new Lhttps_server(this.opt, this.handle_req.bind(this));
        else if (proto=='socks')
            srv = new Lsocks_server(this.opt, this.srvs);
        if (srv)
            this.srvs[proto] = srv;
        return srv;
    }
    is_sess_required(lreq){
        return !this.is_no_proxy(lreq)&&!this.router.is_bypass_proxy(lreq);
    }
    is_no_proxy(lreq){
        return this.router.is_null_resp(lreq) || this.router.is_fw_chk(lreq)
            || this.router.only_bypass&&!this.router.is_bypass_proxy(lreq);
    }
    handle_lres(lreq){
        this.log.debug('handle lres');
        // XXX maximk: implement handle lres
    }
    complete_lreq(err, lreq, lres){
        try {
            this.log.debug('complete lreq');
            // lreq.res.end();
            this.lreqs.delete(lreq.id);
            lreq.destroy();
            // XXX maximk: implement lreq complete
        } catch(e){
            this.log.error('complete lreq error %s', zerr.e2s(e));
        }
    }
    start(){
        let _this = this;
        _this.starting = true;
        this.log.debug('starting...');
        return etask(function*lserver_start(){
            this.finally(()=>{
                _this.starting = false;
                if (this.error || !_this.is_running)
                {
                    // XXX maximk: handle Lserver start error
                    _this.log.debug('start error %s', zerr.e2s(this.error));
                    return;
                }
                _this.log.debug('running');
            });
            yield _this.sess_mgr.start();
            yield _this.srv.listen(_this.port);
            _this.is_running = true;
            return _this;
        });
    }
    stop(force){
        let _this = this;
        _this.stopping = true;
        this.log.debug('stopping...');
        return etask(function*lserver_stop(){
            this.finally(()=>{
                _this.stopping = false;
                if (this.error || _this.is_running)
                {
                    // XXX maximk: handle stop error
                    _this.log.debug('stop error', zerr.e2s(this.error));
                    return;
                }
                _this.log.debug('stopped');
            });
            if (force)
                _this.srv.destroy();
            yield etask.cb_apply(_this.srv, '.close', []);
            _this.is_running = false;
        });
    }
    destroy(){
        this.log.debug('destroy');
        this.sp.return();
        this.sp = null;
        // XXX maximk: handle retry to other Lserver (probably copy)
        this.lreqs.forEach(lreq=>lreq.destroy());
        this.lreqs.clear();
        this.sess_mgr.destroy();
        this.sess_mgr = null;
        this.router.destroy();
        this.router = null;
        this.reverse_lookup.destroy();
    }
}

E.Lserver = Lserver;

class Lsession_mgr {
    constructor(opt){
        this.sp = etask(function*lsession_mgr(){ yield this.wait(); });
        this.log = log(`${opt.port||''} Session_mgr`, opt.log);
        this.log.debug('create');
        this.opt = opt;
        this.hosts = new Lhosts(opt);
        this.session_id = 0;
        this.vips = opt.vips||[];
        this.ips = opt.ips||[];
        this.ready = false;
        const sess_constr = sess_opt=>this.establish_session(sess_opt);
        if (this.should_use_seq_pool(opt))
            this.pool = new Lseq_pool(sess_constr, {log: opt.log});
        else if (opt.pool_type==pool_types.round_robin)
        {
            this.pool = new Lround_robin_pool(sess_constr, {size: opt.pol_size,
                log: opt.log});
        }
        if (opt.sticky_ip)
            this.sticky_sess = new Lsess_map({key: 'src_addr', log: opt.log});
        if (opt.allow_proxy_auth)
        {
            this.auth_sess = new Lsess_map({key: 'h_proxy_authorization',
                log: opt.log});
        }
        this.general_sess = new Lsess_map({log: opt.log});
    }
    start(){
        let _this = this;
        this.log.debug('starting...');
        this.starting = true;
        return etask(function*lsession_mgr_start(){
            this.finally(()=>{
                if (this.error || !_this.running)
                {
                    // XXX maximk: handle sess mgr start error
                    _this.log.error('start error %s', zerr.e2s(this.error));
                    return;
                }
                _this.starting = false;
                _this.log.debug('running');
            });
            yield _this.hosts.fetch();
            if (_this.pool)
                yield _this.pool.populate();
            _this.running = true;
        });
    }
    should_use_seq_pool(opt){
        return opt.session==true || opt.pool_type==pool_types.sequintial
            || opt.pool_type==pool_types.round_robin&&opt.pool_size<1;
    }
    establish_session(opt = {}){
        const _this = this;
        this.log.debug('establish session %O', opt);
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
        return etask(function*lsession_mgr_establish_session(){
            if (!host)
            {
                if (!_this.hosts.has_next())
                    yield _this.hosts.fetch();
                host = _this.hosts.next();
            }
            opt = Object.assign({}, _this.opt, {session, ip, vip, host},
                opt);
            let sess = new Lsession(opt);
            _this.log.notice('established new session %s', sess.to_string());
            return sess;
        });
    }
    get_lreq_sess(lreq){
        const _this = this;
        this.log.debug('get lreq sess %s', lreq.id);
        return etask(function*lsession_mgr_get_lreq_sess(){
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
        this.log.debug('authorization session');
        if (this.auth_sess && this.auth_sess.get(lreq))
        {
            let auth_sess = this.auth_sess.get(lreq);
            if (lreq.h_session && lreq.h_session == auth_sess.session)
                return auth_sess;
        }
        return etask(function*lsession_mgr_authorization_session(){
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
        return etask(function*lsession_mgr_constant_session(){
            let sess_opt = {session: val};
            sess = yield _this.establish_session(sess_opt);
            _this.general_sess.set(name, sess);
            return sess;
        });
    }
    destroy(){
        this.log.debug('destroy');
        this.hosts.destroy();
        if (this.pool)
            this.pool.destroy();
        if (this.sticky_sess)
            this.sticky_sess.destroy();
        if (this.auth_sess)
            this.auth_sess.destroy();
        this.general_sess.destroy();
    }
}

E.Lsession_mgr = Lsession_mgr;

class Lsess_map {
    constructor(opt={}){
        this.opt = _.defaults(opt, {key: false, validate: true});
        this.log = log('Lsess_map', opt.log);
        this.log.debug('create');
        this.sessions = new Map();
    }
    resolve_key(lreq){
        if (this.opt.key)
            return lreq[this.opt.key];
        return lreq;
    }
    is_valid(sess){
        if (!this.opt.validate)
            return true;
        return !sess || !sess.is_expired();
    }
    has(lreq){
        return !!this.get(lreq);
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
        {
            this.log.debug('setting invalid session');
            return false;
        }
        this.sessions.set(this.resolve_key(lreq), sess);
        return true;
    }
    destroy(){
        this.log.debug('destroy');
        this.sessions.forEach(sess=>sess.destroy());
        this.sessions.clear();
        this.session = null;
    }
}

E.sess_map = Lsess_map;

class Lrequest {
    constructor(req, res, head, opt){
        this.id = util.gen_id();
        this.log = log(`Lrequest ${this.id}`, opt.log);
        this.log.debug('create');
        this.req = req;
        this.res = res;
        this.head = head;
        this.opt = opt;
        this.method = req.method;
        this.sp = etask('Lrequest sp', function*(){ yield this.wait(); });
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
        this.full_url = util.req_full_url(req);
        this.update_url(req.url);
        if (this.opt.allow_proxy_auth)
            this.init_authorization();
    }
    init(){
        const _this = this;
        return etask(function*lrequest_init(){
            // XXX maximk: implement
            return yield true;
        });
    }
    init_headers(){
        this.headers = Object.assign({}, this.req.headers);
        this.raw_headers = Object.assign({}, this.req.rawHeaders);
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
        this.log.debug('set session');
        this.sess = sess;
    }
    get_creds(){
        return this.sess ? this.sess.get_creds() : null;
    }
    get_connect_headers(){
        const headers = {'x-hola-agent': hola_agent};
        if (!this.sess)
            return headers;
        const cred = this.get_creds();
        headers['proxy-authorization'] = 'Basic ' + new Buffer(cred.username
            +':'+cred.password).toString('base64');
        return headers;
    }
    get_proxy(){
        return this.sess.host;
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
        this.log.debug('pipe');
        if (this.body)
            pipe.write(this.body);
        return this.req.pipe(pipe);
    }
    unpipe(pipe){
        this.log.debug('unpipe');
        return this.req.unpipe(pipe);
    }
    update_url(_url){
        if (!_url)
            return null;
        if (typeof _url == 'string')
            _url = url.parse(_url);
        if (!_url.hostname&&this.headers.host)
            _url = url.parse(this.full_url);
        this.parsed_url = _url;
        this.url = _url.format();
        this.hostname = _url.hostname;
        this.host = _url.host;
        return _url;
    }
    destroy(){
        // XXX maximk: implement destroy
        this.log.debug('destroy');
        this.sp.return();
    }
}

E.Lrequest = Lrequest;

class Lresponse {
    constructor(lreq, opt){
        this.lreq = lreq;
        this.log = log('Lresponse', lreq.opt.log);
        this.log.debug('create');
        this.headers = opt.headers;
        this.pipe_res = opt.res;
        this.status_code = opt.status_code;
        this.status_message = opt.status_message;
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
        this.log.debug('wrote head');
        headers = Object.assign({}, this.headers, headers);
        // XXX maximk: revisit context and auth response headers
        if (lreq)
            headers['x-hola-context'] = lreq.h_context;
        const creds = lreq.get_creds();
        if (creds)
            headers['x-lpm-authorization'] = creds.username;
        let res = this.res;
        this.resp_written = true;
        if (res instanceof http.ServerResponse)
        {
            return res.writeHead(
                opt.status_code || this.status_code,
                opt.status_message || this.status_message,
                headers
            );
        }
        let head = `HTTP/1.1 ${this.status_code} ${this.status_message}\r\n`;
        for (let field in headers)
            head += `${field}: ${headers[field]}\r\n`;
        res.write(head+'\r\n');
    }
    write(buf){
        this.log.debug('write buf');
        return this.res.write(buf);
    }
    send(body){
        this.log.debug('send');
        this.res.end(body);
    }
    pipe(socket, dual){
        this.log.debug('pipe'+(dual ? ' dual': ''));
        socket.pipe(this.res);
        if (dual)
            this.res.pipe(socket);
    }
    destroy(){
        // XXX maximk: implement destroy
        this.log.debug('destroy');
    }
}

E.Lresponse = Lresponse;

class Lsession {
    constructor(opt){
        this.created = Date.now();
        this.opt = opt;
        this.host = opt.host;
        this.duration = util.param_rand_range(opt.session_duration, 1000);
        this.max_requests = util.param_rand_range(opt.max_requests);
        this.count = 0;
    }
    calculate_username(){
        return username.calc(this.opt, this.opt.short_username);
    }
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
    to_string(){
        return `user: ${this.calculate_username()}, host: ${this.host}`;
    }
    destroy(){
        // XXX maximk: implement destroy
    }
}

E.Lsession = Lsession;

class Lround_robin_pool {
    constructor(itm_constr, opt={}){
        this.sp = etask(function*sess_pool(){ yield this.wait(); });
        this.itm_constr = itm_constr;
        this.log = log('Pool', opt.log);
        this.log.debug('create');
        this.itms = [];
        this.size = opt.size;
        this.populate_sp = null;
        this.ready = false;
    }
    populate(){
        this.log.debug('populate');
        let _this = this;
        if (this.populate_sp)
            return this.populate_sp;
        return etask(function*sess_pool_populate(){
            _this.populate_sp = this;
            let sess_sp = [];
            this.finally(()=>{
                if (this.error)
                {
                    _this.log.debug('populate error %s', zerr.e2s(this.error));
                }
                // XXX maximk: handle populate errors
                if (!_this.ready && _this.itms.length>0)
                    _this.ready = true;
                _this.populate_sp = null;
                _this.log.debug('populated');
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
        this.log.debug('clean expired');
        return _.remove(this.itms, itm=>itm.is_expired());
    }
    next(){
        this.log.debug('next');
        let itm = null;
        if (!this.has_next())
            return itm;
        itm = this.itms.shift();
        this.itms.push(itm);
        return itm;
    }
    ensure_populated_next(){
        const _this = this;
        return etask(function*sess_pool_ensure_populated(){
            _this.clean_expired();
            if (!_this.has_next())
                yield _this.populate();
            else
                _this.populate();
            return _this.next();
        });
    }
    destroy(){
        this.log.debug('destroy');
        this.sp.return();
        this.sp = null;
        this.itms.forEach(itm=>itm.destroy());
        this.itms = null;
        this.ready = false;
    }
}

E.Lround_robin_pool = Lround_robin_pool;

class Lseq_pool extends Lround_robin_pool {
    constructor(itm_constr, opt){
        super(itm_constr, Object.assign({}, opt, {size: 1}));
    }
}

E.Lseq_pool = Lseq_pool;

class Lhosts {
    constructor(opt = {}){
        this.opt = opt;
        this.log = log('Lhosts', opt.log);
        this.log.debug('create');
        this.sp = etask(function*lhosts(){ yield this.wait(); });
        this.hosts = [];
        this.proxy_count = opt.proxy_count;
        this.proxy_cache = opt._proxy_cache;
        this.conf_proxies = [].concat(opt.proxy);
        this.fetch_timeout = (opt.proxy_fetch_timeout||30)*date.ms.SEC;
        this.first_fetch = true;
        this.fetching = false;
    }
    fetch(){
        const _this = this;
        this.log.debug('fetching....');
        return etask(function*lhosts_fetch(){
            let hosts, proxies = _this.conf_proxies.slice(0), timeout = false;
            // XXX maximk: simplify all of it, get read of setTimeout
            _this.tm = setTimeout(()=>{ timeout = true; },
                _this.fetch_timeout);
            this.finally(()=>_this.fetch_complete(this));
            let cached_hosts = _this.hosts;
            if (_this.first_fetch&&_this.proxy_cache)
                cached_hosts = yield _this.proxy_cache.get(proxies)||[];
             _this.first_fetch = false;
            hosts = cached_hosts.reduce((acc, h)=>acc.set(h, false),
                new Map());
            _this.fetching = true;
            while (proxies.length&&hosts.size<_this.proxy_count&&!timeout)
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
                    ips.forEach(ip=>hosts.set(ip, proxy));
                } catch(e){
                    _this.log.error('host from dns error %s', zerr.e2s(e));
                    // XXX maximk: handle detach host from dns error
                }
            }
            clearTimeout(_this.tm);
            _this.hosts = _.shuffle(Array.from(hosts.keys()));
            if (_this.opt._proxy_cache)
            {
                let cache = Array.from(hosts.entries()).filter(p=>p[1]);
                _this.log.debug('save to cache %O', cache);
                yield _this.proxy_cache(cache);
            }
        });
    }
    fetch_complete(sp){
        this.fetching = false;
        if (sp.error||!this.hosts.length)
        {
            // XXX maximk: handle failed to resolve proxies
            this.log.debug('fetch error %s', zerr.e2s(sp.error));
            return sp.throw(sp.error||new Error('Error fetching hosts'));
        }
        this.log.notice('fetched %O', this.hosts);
    }
    fetch_from_dns(domain){
        this.log.debug('fetching dns for %s', domain);
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
    destroy(){
        this.log.debug('destroy');
        this.hosts = null;
        this.sp.return();
    }
}

E.Lhosts = Lhosts;

class Lreq_router {
    constructor(opt){
        this.opt = opt;
        this.log = log('Lreq_router', opt.log);
        this.sp = etask(function*lreq_router(){ yield this.wait(); });
        this.log.debug('create');
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
        if (!this.http_proxy)
            this.http_proxy = new Lhttp_proxy(opt);
        this.https_proxy = opt.https_proxy_server;
        if (!this.https_proxy)
            this.https_proxy = new Lhttps_proxy(opt);
        this.bypass_proxy = opt.bypass_proxy_server;
        if (!this.bypass_proxy)
            this.bypass_proxy = new Lproxy(opt);
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
        lres.write_head({headers: {Connection: 'close'}});
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
        _this.log.debug('routing lreq %s', lreq.id);
        if (this.is_fw_chk(lreq))
            return this.send_fw_chk_resp(lreq);
        if (this.is_null_resp(lreq))
            return this.send_null_resp(lreq);
        if (this.only_bypass&&!this.is_bypass_proxy(lreq))
            return this.null_resp.send(lreq);
        return etask(function*lreq_router_send_req(){
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
         this.log.debug('sending to lproxy');
        return etask(function*lreq_router_send_to_lproxy(){
            let race_reqs = _this.race_reqs || 1;
            // return yield lproxy.send(lreq);
            for (let rep=0; rep<race_reqs; rep++)
                this.spawn(lproxy.send(lreq));
            return yield this.wait_child('any');
        });
    }
    destroy(){
        // XXX maximk implement destroy
        this.log.debug('destroy');
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
        this.sp = etask(function*lproxy(){ yield this.wait(); });
        this.log = log('Lproxy', opt.log);
        this.log.debug('create');
    }
    get_net_ctx(lreq){
        if (lreq.is_secure)
            return {client: https, agent: this.agents.https};
        return {client: http, agent: this.agents.http};
    }
    send(lreq){
        let _this = this, lres;
        lreq.log.debug('bypass send');
        return etask(function*lproxy_send(){
            let pipe = null;
            try {
                // XXX  maximk: reorganize this function
                if (lreq.is_connect)
                {
                    pipe = net.connect({host: lreq.hostname, port: lreq.port});
                    lres = new Lresponse(lreq, {res: pipe});
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
                    lreq.pipe(pipe);
                }
                // XXX maximk: what happens on !is_connect ?
                pipe.on('close', ()=>{ this.return(lres); })
                .on('error', this.throw_fn());
                if (!lreq.is_connect)
                    return yield _this.handle_pipe(lreq, pipe);
                return yield this.wait();
            } catch(e){
                _this.log.error('send error %s', zerr.e2s(e));

            }
        });
    }
    handle_pipe(lreq, pipe, headers){
        const _this = this;
        lreq.log.debug('pipe created');
        return etask(function*lproxy_handle_pipe(){
            try {
                if (lreq.timeout)
                {
                    pipe.setTimeout(lreq.timeout,
                        _this.handle_timeout(lreq, pipe, this));
                }
                pipe.on('response',
                    _this.handle_resp(lreq, pipe, this, headers));
                pipe.on('connect', _this.handle_connect(lreq, pipe, this));
                pipe.on('error', _this.handle_error(lreq, pipe, this));
                yield this.wait();
            } catch(e){
                _this.log.debug('handle pipe %s', zerr.e2s(e));
                throw e;
            }
        });
    }
    handle_timeout(lreq, pipe, sp){
        return ()=>{
            lreq.log.debug('timeout');
            sp.throw(new Error(`timeout ${lreq.timeout}`));
            // XXX maximk: implement rule timeout handling
        };
    }
    handle_connect(lreq, pipe, sp){
        return util.wrp_sp_err(sp, (res, socket, head)=>{
            lreq.log.debug('pipe connect');
            const lres = new Lresponse(lreq, {res: res});
            lres.write_head();
            if (res.statusCode!=200)
            {
                // XXX maximk: handle error from proxy
                this.log.debug('connect error from proxy');
                lres.send();
                return sp.return(lres);
            }
            socket.write(lreq.head);
            lres.write(head);
            // XXX maximk: handle body_count (count_stream)
            lres.pipe(socket, true);
        });
    }
    handle_resp(lreq, pipe, sp, headers){
        return util.wrp_sp_err(sp, res=>{
            if (pipe.aborted)
                return;
            lreq.log.debug('pipe resp');
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
        });
    }
    handle_error(lreq, pipe, sp){
        return util.wrp_sp_err(sp, err=>{
            // XXX maximk: check if responded and connected flags needed
            if (pipe.aborted)
                return;
            // XXX maximk: handle retry rules
            // XXX maximk: check proxy response
            lreq.log.debug('pipe error %s', zerr.e2s(err));
            sp.throw(err);
        });
    }
    abort(lreq, pipe){
        lreq.log.debug('pipe abort');
        lreq.unpipe(pipe);
        pipe.abort();
    }
    destry(){
        this.log.debug('destroy');
        this.sp.return();
    }
}

E.Lproxy = Lproxy;

class Lhttp_proxy extends Lproxy {
    send(lreq){
        const _this = this;
        const nctx = this.get_net_ctx(lreq);
        lreq.log.debug('http send via %s', lreq.get_proxy());
        return etask(function*lhttp_proxy_send(){
            try {
                const headers = Object.assign({}, lreq.get_connect_headers(),
                    lreq.headers);
                const pipe = nctx.client.request({
                    host: lreq.get_proxy(),
                    port: lreq.proxy_port,
                    method: lreq.method,
                    path: lreq.url,
                    agent: nctx.agent,
                    headers,
                    proxyHeaderWhiteList: hola_headers,
                    proxyHeaderExclusiveList: hola_headers,
                    rejectUnauthorized: !lreq.insecure
                });
                if (lreq.is_connect)
                    pipe.end();
                else
                    lreq.pipe(pipe);
                return yield _this.handle_pipe(lreq, pipe);
            } catch(e){
                _this.log.debug('http send error %s', zerr.e2s(e));
            }
        });
    }
}

E.Lhttp_proxy = Lhttp_proxy;

class Lhttps_proxy extends Lproxy {
    send_connect(lreq){
        const _this = this;
        const nctx = this.get_net_ctx(lreq);
        lreq.log.debug('https send connect');
        return etask(function*lhttps_proxy_send_connect(){
            try {
                nctx.client.request({
                    host: lreq.get_proxy(),
                    port: lreq.proxy_port,
                    method: 'CONNECT',
                    path: lreq.hostname+':443',
                    headers: lreq.get_connect_headers(),
                    agent: nctx.agent,
                    rejectUnauthorized: !lreq.insecure,
                })
                .on('connect', (res, socket, head)=>{
                    lreq.log.debug('https connection established');
                    this.return({res, socket, head, headers: res.headers});
                })
                .on('error', this.throw_fn())
                .end();
                yield this.wait();
            } catch(e){
                _this.log.debug('error connect %s', zerr.e2s(e));
            }
        });
    }
    send(lreq){
        const _this = this;
        lreq.log.debug('https send');
        return etask(function*lhttps_proxy_send(){
            try {
                const conn = yield _this.send_connect(lreq);
                lreq.log.debug('https send req');
                if (conn.res.statusCode!=200)
                {
                    lreq.log.debug('conn status code %s', conn.res.statusCode);
                    throw new Error(conn.res.statusMessage);
                }
                const pipe = https.request({
                    host: lreq.host,
                    method: lreq.method,
                    path: lreq.req_url,
                    headers: lreq.headers,
                    proxyHeaderWhiteList: hola_headers,
                    proxyHeaderExclusiveList: hola_headers,
                    socket: conn.socket,
                    agent: false,
                    rejectUnauthorized: !lreq.insecure,
                });
                lreq.pipe(pipe);
                lreq.req.on('end', lreq.req._onend = ()=>pipe.end());
                lreq.req.on('close', ()=>pipe.abort());
                return yield _this.handle_pipe(lreq, pipe, conn.headers);
            } catch(e){
                _this.log.debug('error send request %s', zerr.e2s(e));
            }
        });
    }
}

E.Lhttps_proxy = Lhttps_proxy;

class Lstats {
    track_lreq(){

    }
    destroy(){
        // XXX maximkL implement destroy
    }
}

E.Lstats = Lstats;

class Lreverse_lookup {
    constructor(opt = {}){
        this.opt = opt;
        this.sp = etask('Lreverse_lookup sp', function*(){
            yield this.wait(); });
        this.log = log('Lreverse_lookup', opt.log);
        this.log.debug('create');
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
        return this.lookup_enabled&&util.is_ip(hostname);
    }
    add_domains(domains = {}){
        this.domains = Object.assign({}, this.domains, domains||{});
        this.lookup_enabled = this.dns_enabled||!_.is_empty(this.domains);
    }
    clear_domains(){
        this.domains = {};
        this.lookup_enabled = this.dns_enabled;
    }
    enable_dns(enabled = true){
        this.dns_enabled = enabled;
    }
    lookup(ip, one = true){
        if (!this.lookup_enabled)
            return null;
        this.log.debug('lookup');
        if (this.domains && this.domains[ip])
            return one ? this.domains[ip] : [this.domains[ip]];
        if (!this.dns_enabled)
            return null;
        return etask(function*reverse_lookup(){
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
    destroy(){
        this.log.debug('destroy');
        if (this.sp)
            this.sp.return();
        this.domains = {};
        this.dns_enabled = false;
        this.lookup_enabled = false;
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
        this.log = log('Lsocks_server', opt.log);
        this.log.debug('creaete');
        this.srvs = servers;
        this.srv = null;
    }
    init(){
        this.srv = socks.createServer(this.handle_connection());
        this.srv.useAuth(socks.auth.None());
    }
    handle_connection(){
        return (info, accept, deny)=>{
            this.log.debug('connection');
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
    destroy(){
        // XXX maximk: implement destroy
        this.log.debug('destroy');
    }
}

E.Lsocks_server = Lsocks_server;

class Lhttps_server {
    constructor(opt, on_req){
        this.opt = opt;
        this.log = log('Lhttps_server', opt.log);
        this.log.debug('create, ssl: %s', opt.ssl);
        this.on_req = on_req;
        this.ssl = opt.ssl;
        this.srv = null;
    }
    init(){
        const conf = this.ssl ? Object.assign({requestCert: false}, ssl())
            : {};
        this.srv = https.createServer(conf);
        let connev = this.srv._events.connection;
        if (typeof connev == 'function')
            this._connev = connev ;
        else
            this._connev = connev[connev.length-1];
        this.srv.on('connection', this.handle_connection());
        this.srv.on('connect', this.handle_connect());
        this.srv.on('request', this.handle_req());
        this.srv.on('clientError', err=>this.log.debug('client error %s',
            zerr.e2s(err)));
    }
    handle_connection(){
        return sock=>{
            this.log.debug('connection');
        };
    }
    handle_connect(){
        return sock=>{
            this.log.debug('handle_connect');
            let _head = `HTTP/1.1 200 OK\r\n`;
            sock.write(_head+'\r\n');
        };
    }
    handle_req(){
        return (req, res, head)=>{
            this.log.debug('request %s', req.url);
            this.on_req(req, res, head);
        };
    }
    accept(sock){
        if (!this.srv)
            this.init();
        this._connev.call(this.srv, sock);
    }
    destroy(){
        // XXX maximk: implement destroy
        this.log.debug('destroy');
    }
}

E.Lhttps_server = Lhttps_server;

class Lhttp_server {
    constructor(opt, on_req, on_conn){
        this.opt = opt;
        this.on_req = on_req;
        this.ssl = opt.ssl;
        this.on_conn = on_conn;
        this.srv = null;
        this.log = log('Lhttp_server', opt.log);
        this.log.debug('create');
    }
    init(){
        this.srv = http.createServer();
        this.srv.on('connection', this.handle_connection());
        this.srv.on('connect', this.handle_connect());
        this.srv.on('request', this.handle_req());
    }
    handle_connection(){
        return sock=>{
            this.log.debug('connection');
            sock.setNoDelay();
        };
    }
    handle_connect(){
        if (!this.ssl)
            return this.handle_req();
        return (req, socket, head)=>{
            this.on_conn(req, socket, head);
        };
    }
    handle_req(){
        return (req, res, head)=>{
            this.log.debug('request %s', req.url);
            this.on_req(req, res, head);
        };
    }
    accept(sock){
        if (!this.srv)
            this.init();
        http._connectionListener.call(this.srv, sock);
    }
    destroy(){
        // XXX maximk: implement destroy
        this.log.debug('destroy');
    }
}

E.Lhttp_server = Lhttp_server;
