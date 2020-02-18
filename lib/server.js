// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true, evil: true*/
const events = require('events');
const http = require('http');
const https = require('https');
const dns = require('dns');
const url = require('url');
const net = require('net');
const fs = require('fs');
const {Readable} = require('stream');
const stringify = require('json-stable-stringify');
const stream = require('stream');
const request = require('request');
const util = require('util');
const {Netmask} = require('netmask');
const username = require('./username.js');
const http_shutdown = require('http-shutdown');
const requester = require('./requester.js');
const Socks = require('./socks.js');
const Smtp = require('./smtp.js');
const ssl = require('./ssl.js');
const Ws = require('./ws.js');
const etask = require('../util/etask.js');
const zurl = require('../util/url.js');
const date = require('../util/date.js');
const {decode_body, write_http_reply, url2domain, find_iface, user_agent,
    ensure_socket_close, is_ws_upgrade_req, set_timeout, clear_timeouts,
    get_host_port
} = require('./util.js');
const zerr = require('../util/zerr.js');
const zfile = require('../util/file.js');
const lpm_config = require('../util/lpm_config.js');
const qw = require('../util/string.js').qw;
const sessions = require('./session.js');
const Context = require('./context.js');
const Router = require('./router.js');
const Rules = require('./rules.js');
const Ip_cache = require('./ip_cache.js');
const consts = require('./consts.js');
const Https_agent = require('./https_agent.js');

const {SEC} = date.ms;
const E = module.exports = Server;
E.default = Object.assign({}, lpm_config.server_default);
E.dropin = {
    port: E.default.proxy_port,
    listen_port: E.default.proxy_port,
};
const ip_re = /^(https?:\/\/)?(\d+\.\d+\.\d+\.\d+)([$/:?])/i;

const reverse_lookup_dns = ip=>etask(function*resolve(){
    try {
        let domains = yield etask.nfn_apply(dns, '.reverse', [ip]);
        return domains&&domains.length ? domains[0] : ip;
    } catch(e){ return ip; }
});

const reverse_lookup_values = values=>{
    const domains = {};
    for (let line of values)
    {
        const m = line.match(/^\s*(\d+\.\d+\.\d+\.\d+)\s+([^\s]+)/);
        if (m)
            domains[m[1]] = m[2];
    }
    return ip=>domains[ip]||ip;
};

const parse_ip_url = _url=>{
    let match = _url.match(ip_re);
    if (!match)
        return null;
    return {url: match[0]||'', protocol: match[1]||'', ip: match[2]||'',
        suffix: match[3]||''};
};

const create_count_stream = (resp, limit)=>new stream.Transform({
    transform(data, encoding, cb){
        if (!limit || resp.body_size<limit)
        {
            const chunk = limit ? limit-resp.body_size : Infinity;
            resp.body.push(data.slice(0, chunk));
        }
        resp.body_size += data.length;
        cb(null, data);
    },
});

const is_custom_error = e=>e.custom || e.message=='Authentication failed';

function Server(opt){
    events.EventEmitter.call(this);
    this.active = 0;
    this.throttle_queue = [];
    this.sp = etask(function*luminati_listen_constructor(){
        return yield this.wait();
    });
    opt.listen_port = opt.listen_port || opt.port || E.default.port;
    opt = this.opt = Object.assign({}, E.default, opt);
    this.rules = new Rules(this, opt.rules);
    this.banlist = new Ip_cache();
    this.ws_handler = new Ws(opt);
    this.socket2headers = new Map();
    if (opt.ssl)
        this.init_https_server();
    this.init_http_server(opt);
    this.socks_server = new Socks({
        port: opt.port || E.default.port,
        log: opt.log,
        serv: this,
    });
    this.smtp_server = new Smtp(this, {
        port: opt.port,
        log: opt.log,
        ips: opt.smtp,
    });
    this.init_tcp_server();
    this.on('response', resp=>this.usage(resp));
    this.update_config(opt);
    this.https_agent = new Https_agent({
        keepAlive: true,
        keepAliveMsecs: 5000,
    });
    this.setMaxListeners(30);
}

util.inherits(E, events.EventEmitter);

E.prototype.update_config = function(opt){
    // XXX krzysztof: move more logic here from the constructor
    if (this.session_mgr)
        this.session_mgr.stop();
    opt = this.opt = Object.assign({}, this.opt, opt);
    const logger = require('./logger.js');
    logger.set_level(this.opt.log);
    this.logger = logger.child({category: `[${opt.port}]`});
    if (opt.reverse_lookup_dns===true)
        this.reverse_lookup = reverse_lookup_dns;
    else if (opt.reverse_lookup_file && fs.existsSync(opt.reverse_lookup_file))
    {
        this.reverse_lookup = reverse_lookup_values(
            zfile.read_lines_e(opt.reverse_lookup_file));
    }
    else if (opt.reverse_lookup_values)
        this.reverse_lookup = reverse_lookup_values(opt.reverse_lookup_values);
    opt.whitelist_ips = opt.whitelist_ips || [];
    if (opt.ext_proxies)
        opt.session = true;
    this.hosts = (this.opt.hosts||[this.opt.proxy]).slice();
    this.requester = requester.create_requester(this.opt);
    this.router = new Router(opt);
    this.session_mgr = new sessions.Sess_mgr(this, opt);
    this.session_mgr.on('response', r=>this.emit('response', r));
};

E.prototype.get_req_remote_ip = function(req){
    if (req.original_ip)
        return req.original_ip;
    if (req.socket)
    {
        let ip;
        if (ip = this.socks_server.get_remote_ip(req.socket.remotePort))
            return ip;
        if (req.socket.remoteAddress)
            return req.socket.remoteAddress;
        if (req.socket.socket && req.socket.socket.remoteAddress)
            return req.socket.socket.remoteAddress;
    }
    return null;
};

E.prototype.bypass_intercepting = function(req_url){
    if (this.opt.smtp && this.opt.smtp.length)
        return true;
    const _url = zurl.parse(req_url);
    return parse_ip_url(req_url) || _url.port==43 || _url.port==80 ||
        _url.hostname=='app.multiloginapp.com';
};

E.prototype.init_http_server = function(opt){
    this.http_server = http.createServer((req, res)=>{
        if (req.headers.host=='trigger.domain' ||
            /^\/hola_trigger/.test(req.url))
        {
            return res.end();
        }
        if (!req.url.startsWith('http:'))
            req.url = 'http://'+req.headers.host+req.url;
        this.sp.spawn(this.handler(req, res));
    }).on('connection', socket=>socket.setNoDelay());
    this.http_server.on('error', e=>{
        this.emit('error', e);
    });
    if (!opt.ssl)
    {
        this.http_server.on('connect', (req, socket, head)=>{
            this.sp.spawn(this.handler(req, socket, head));
        });
        return;
    }
    this.http_server.on('connect', (req, socket, head)=>{
        if (this.bypass_intercepting(req.url))
            return this.sp.spawn(this.handler(req, socket, head));
        write_http_reply(socket, {statusCode: 200, statusMessage: 'OK'});
        const remote_ip = this.get_req_remote_ip(req);
        if (remote_ip)
            this.req_remote_ip[socket.remotePort] = remote_ip;
        const authorization = req.headers['proxy-authorization'];
        if (authorization)
            this.authorization[socket.remotePort] = authorization;
        socket.once('close', ()=>{
            delete this.authorization[socket.remotePort];
            delete this.req_remote_ip[socket.remotePort];
        });
        socket.once('error', e=>{
            // XXX krzysztof: consider canceling whole request here
            if (e.code=='ECONNRESET')
                return this.logger.info('Connection closed by the client');
            this.logger.error('https socket: %s', zerr.e2s(e));
        });
        socket.once('timeout', ()=>{
            ensure_socket_close(socket);
        });
        socket.setTimeout(120*SEC);
        req.once('end', ()=>socket.end());
        this.https_server.emit('connection', socket);
    });
};

E.prototype.init_https_server = function(){
    this.authorization = {};
    this.req_remote_ip = {};
    this.https_server = https.createServer(
        Object.assign({requestCert: false}, ssl()), (req, res, head)=>{
            const remote_ip = this.req_remote_ip[req.socket.remotePort];
            if (remote_ip && req.socket.remoteAddress=='127.0.0.1')
            {
                this.logger.debug('request ip fixed %s %s', remote_ip,
                    req.url);
                req.original_ip = remote_ip;
            }
            const auth = this.authorization[req.socket.remotePort];
            if (auth)
                req.headers['proxy-authorization'] = auth;
            this.sp.spawn(this.handler(req, res, head));
        }
    ).on('connection', socket=>socket.setNoDelay());
    this.https_server.on('error', e=>{
        this.emit('error', e);
    });
    this.https_server.on('tlsClientError', err=>{
        if (!/unknown ca/.test(err.message))
            return;
        this.logger.warn(consts.TLS_ERROR_MSG
            +`: ${this.opt.www_api}/faq#proxy-certificate`);
        this.emit('tls_error');
    });
    this.https_server.on('upgrade', (req, socket, head)=>{
        if (!is_ws_upgrade_req(req))
            return ensure_socket_close(socket);
        return this.sp.spawn(this.handler(req, socket, head));
    });
};

E.prototype.init_tcp_server = function(){
    this.tcp_server = new net.createServer(socket=>{
        this.tcp_server.running = true;
        socket.setTimeout(this.opt.socket_inactivity_timeout);
        socket.once('error', err=>null);
        socket.once('timeout', ()=>{
            ensure_socket_close(socket);
        });
        if (this.opt.smtp && this.opt.smtp.length)
            return this.smtp_server.connect(socket);
        socket.once('data', data=>{
            if (!this.tcp_server.running)
                return socket.end();
            socket.pause();
            let protocol_byte = data[0];
            // first byte of TLS handshake is 0x16 = 22 byte
            if (protocol_byte==22 && this.https_server)
                this.https_server.emit('connection', socket);
            // any non-control ASCII character
            else if (32<protocol_byte && protocol_byte<127)
                this.http_server.emit('connection', socket);
            // initial greeting from SOCKS5 client is 0x05 = 5 byte
            else if (protocol_byte==5)
                this.socks_server.connect(socket);
            else
                socket.end();
            socket.unshift(data);
            socket.resume();
        });
    });
    http_shutdown(this.tcp_server);
};

E.prototype.send_email = function(rule, _url){
    if (!rule.action || !rule.action.email)
        return;
    return this.emit('send_rule_mail', {port: this.port,
        email: rule.action.email, url: _url});
};

E.prototype.usage_start = function(req){
    const data = {
        uuid: req.ctx.uuid,
        port: this.port,
        url: req.url,
        method: req.method,
        headers: req.headers,
        timestamp: Date.now(),
        context: req.ctx.h_context,
    };
    this.emit('usage_start', data);
};

E.prototype.usage = function(response){
    if (!response)
        return;
    const headers = response.headers||{};
    const is_ssl = response.request.url.endsWith(':443') &&
        response.status_code=='200';
    const status_code = is_ssl ? 'unknown' : response.status_code || 'unknown';
    const encoding = response.headers && response.headers['content-encoding'];
    const response_body = is_ssl ?
        'unknown' : decode_body(response.body, encoding, this.opt.har_limit);
    const data = {
        uuid: response.uuid,
        port: this.port,
        url: response.request.url,
        method: response.request.method,
        request_headers: stringify(response.request.headers),
        request_body: response.request.body,
        response_headers: stringify(headers),
        response_body,
        status_code,
        status_message: response.status_message,
        timestamp: response.timeline.get('create'),
        elapsed: response.timeline.get_delta('end'),
        response_time: response.timeline.get_delta('response'),
        proxy_peer: headers['x-luminati-ip'],
        timeline: stringify(response.timeline.req_chain),
        content_size: response.body_size,
        context: response.context,
        remote_address: response.remote_address,
        rules: response.rules,
    };
    if (response.proxy)
    {
        data.super_proxy = response.proxy.host+':'+response.proxy.proxy_port;
        data.username = response.proxy.username;
        data.password = response.proxy.password;
    }
    if (response.success)
        data.success = +response.success;
    data.in_bw = response.in_bw;
    data.out_bw = response.out_bw;
    this.emit('usage', data);
};

E.prototype.refresh_ip = function(ctx, ip){
    this.emit('refresh_ip', {ip, port: this.opt.port});
};

E.prototype.is_whitelisted = function(req){
    let auth_header = req.headers['proxy-authorization'];
    if (auth_header)
    {
        auth_header = auth_header.replace('Basic ', '');
        const auth = Buffer.from(auth_header, 'base64').toString();
        const [user, pass] = auth.split(':');
        if (user=='token'||user.includes(','))
            delete req.headers['proxy-authorization'];
        if (user=='token' && this.opt.token_auth &&
            pass==this.opt.token_auth)
        {
            return true;
        }
        if (user.replace(/,/, '@')==this.opt.user &&
            pass==this.opt.user_password)
        {
            return true;
        }
    }
    const ip = this.get_req_remote_ip(req);
    return this.is_whitelisted_ip(ip);
};

E.prototype.is_whitelisted_ip = function(ip){
    if (ip=='127.0.0.1')
        return true;
    return this.opt.whitelist_ips.map(_ip=>new Netmask(_ip)).some(_ip=>{
        try { return _ip.contains(ip); }
        catch(e){ return false; }
    });
};

E.prototype.handler = etask._fn(function*handler(_this, req, res, head){
    this.finally(()=>{
        _this.complete_req(this.error, req, res);
    });
    res.once('close', ()=>set_timeout(()=>{
        this.return();
    }));
    req.once('close', ()=>set_timeout(()=>{
        this.return();
    }));
    try {
        _this.active++;
        if (_this.active==1)
            _this.emit('idle', false);
        res.once('error', e=>{
            if (e.code=='ECONNRESET')
            {
                _this.logger.info('Connection closed by the client');
                return this.return();
            }
            _this.logger.warn('client: %s', e.message);
        });
        req.once('timeout', ()=>this.throw(new Error('request timeout')));
        if (!_this.is_whitelisted(req))
        {
            const ip = _this.get_req_remote_ip(req);
            _this.logger.warn('access denied: %s is not whitelisted', ip);
            _this.emit('access_denied', ip);
            return write_http_reply(res, {
                statusCode: 407,
                statusMessage: 'Proxy Authentication Required',
                headers: {
                    Connection: 'keep-alive',
                    'Proxy-Authenticate': 'Basic realm="LPM"',
                },
            }, undefined, {end: true});
        }
        this.info.url = req.url;
        if (_this.opt.throttle && _this.active>_this.opt.throttle)
        {
            _this.throttle_queue.push(this);
            yield this.wait();
        }
        return yield _this.lpm_request(req, res, head);
    } catch(e){
        _this.logger.warn('handler: %s %s %s', req.method,
            req.ctx.url, e.message);
        throw e;
    }
});

E.prototype.send_error = function(req, res, err, err_origin){
    const message = `[${err_origin}] ${err.message}`;
    this.logger.info('%s %s 502 %s', req.method, req.ctx.url, message);
    if (res.ended)
        return;
    const err_header = `x-${err_origin}-error`;
    const headers = {
        Connection: 'close',
        [err_header]: err.message,
    };
    try {
        write_http_reply(res, {
            statusCode: 502,
            headers,
            statusMessage: 'LPM - Bad Gateway',
        }, undefined, {end: true});
    } catch(e){
        this.logger.error('could not send head: %s\n%s', e.message);
    }
};

E.prototype.complete_req = function(err, req, res){
    try {
        if (err && err.proxy_error)
            this.send_error(req, res, err, 'luminati');
        else if (err)
            this.send_error(req, res, err, 'lpm');
        this.active--;
        if (!this.active)
            return this.emit('idle', true);
        if (this.throttle_queue.length)
            this.throttle_queue.shift().continue();
    } catch(e){
        this.logger.error('unexpected error: %s', zerr.e2s(e));
    }
};

E.prototype.listen = etask._fn(function*listen(_this, listen_port, hostname){
    try {
        listen_port = listen_port || _this.opt.listen_port || 0;
        if (!_this.sp)
        {
            _this.sp = etask(function*server_listen(){
                return yield this.wait();
            });
        }
        _this.sp.spawn(_this.session_mgr.sp);
        hostname = hostname || find_iface(_this.opt.iface);
        if (!hostname)
        {
            hostname = '0.0.0.0';
            _this.opt.iface = '0.0.0.0';
        }
        _this.port = listen_port;
        _this.socks_server.once('error', e=>{
            this.throw(e);
        });
        yield _this.socks_server.set_tcp_server(_this.tcp_server);
        _this.tcp_server.once('error', e=>{
            this.throw(e);
        });
        _this.tcp_server.listen(listen_port, hostname, this.continue_fn());
        yield this.wait();
        _this.session_mgr.init();
        _this.emit('ready');
        return _this;
    } catch(e){
        _this.emit('error', e);
    }
});

E.prototype.stop = etask._fn(function*stop(_this){
    try {
        if (_this.stopped)
            return;
        _this.stopped = true;
        if (_this.sp)
        {
            _this.sp.return();
            _this.sp = null;
        }
        clear_timeouts();
        _this.banlist.clear_timeouts();
        _this.session_mgr.stop();
        _this.socks_server.stop();
        _this.ws_handler.stop();
        _this.requester.stop();
        _this.https_agent.destroy();
        _this.tcp_server.running = false;
        yield etask.nfn_apply(_this.tcp_server, '.forceShutdown', []);
        _this.emit('stopped');
        return _this;
    } catch(e){
        if (e.code=='ERR_SERVER_NOT_RUNNING')
            _this.emit('stopped');
        else
            _this.emit('error', e);
    }
});

E.prototype.check_proxy_response = function(proxy, res){
    const err = new Error();
    const status_code = res.status_code || res.statusCode || 0;
    if (res.headers && res.headers['x-luminati-error'])
    {
        err.message = res.headers['x-luminati-error'];
        err.code = status_code;
        err.custom = true;
        err.proxy_error = true;
        err.retry = false;
        if (err.code==502 && err.message.match(/^Proxy Error/))
            err.retry = true;
    }
    if (!err.message)
        return false;
    return err;
};

E.prototype.get_req_host = function(req){
    return req.ctx.session && req.ctx.session.host || this.hosts[0];
};

E.prototype.get_req_cred = function(req){
    const ctx = req.ctx;
    const auth = username.parse(ctx.h_proxy_authorization) || {};
    if (!auth.password)
        delete auth.password;
    if (ctx.h_session)
        auth.session = ctx.h_session;
    if (ctx.h_country)
        auth.country = ctx.h_country;
    if (ctx.h_state)
        auth.state = ctx.h_state;
    if (ctx.h_city)
        auth.city = ctx.h_city;
    if (auth.tool)
    {
        delete auth.tool;
        delete auth.password;
    }
    const opt = {
        ext_proxy: ctx.session && ctx.session.ext_proxy,
        ip: ctx.h_ip || ctx.session && ctx.session.ip || this.opt.ip,
        vip: ctx.session && ctx.session.vip || this.opt.vip,
        session: ctx.session && ctx.session.session,
        direct: ctx.is_direct,
        unblocker: ctx.opt.unblock,
        debug: ctx.opt.debug,
    };
    if (ctx.session && ctx.session.asn)
        opt.asn = ctx.session.asn;
    return username.calculate_username(Object.assign({}, this.opt, opt, auth));
};

E.prototype.init_proxy_req = function(req, res){
    const {ctx} = req;
    ctx.init_stats();
    ctx.session = this.session_mgr.request_session(req);
    ctx.host = this.get_req_host(req);
    if (this.router.is_bypass_proxy(req))
        return;
    ctx.proxy_port = ctx.session && ctx.session.proxy_port ||
        this.opt.proxy_port;
    ctx.cred = this.get_req_cred(req);
    res.cred = ctx.cred.username;
    this.logger.debug('requesting using %s', ctx.cred.username);
    ctx.response.proxy = {
        host: ctx.host,
        proxy_port: ctx.proxy_port,
        username: ctx.cred.username,
        password: ctx.cred.password,
    };
    ctx.connect_headers = {
        'proxy-authorization': 'Basic '+
            Buffer.from(ctx.cred.username+':'+ctx.cred.password)
            .toString('base64'),
    };
    if (!ctx.session || !ctx.session.ext_proxy)
    {
        let agent = lpm_config.hola_agent;
        const auth = username.parse(ctx.h_proxy_authorization);
        if (auth && auth.tool)
            agent = agent+' tool='+auth.tool;
        ctx.connect_headers['x-hola-agent'] = agent;
    }
};

E.prototype.reverse_lookup_url = etask._fn(
function*reverse_lookup_url(_this, _url){
    let ip_url, rev_domain;
    if (!_this.reverse_lookup || !(ip_url = parse_ip_url(_url)))
        return false;
    rev_domain = yield _this.reverse_lookup(ip_url.ip);
    if (ip_url.ip==rev_domain)
        return false;
    return {
        url: _url.replace(ip_url.url,
            `${ip_url.protocol}${rev_domain}${ip_url.suffix}`),
        hostname: rev_domain,
    };
});

E.prototype.lpm_request = etask._fn(
function*lpm_request(_this, req, res, head){
    req.once('aborted', ()=>_this.usage_abort(req));
    const headers = Object.assign({}, req.headers);
    const ua = headers['user-agent'];
    const is_user_req = ()=>ua!=user_agent && !headers['x-lpm-keep-alive'];
    if (is_user_req())
        _this.emit('first_lpm_action', {action: 'send_request', ua});
    const ctx = Context.init_req_ctx(req, res, _this, _this.opt);
    this.finally(()=>{
        ctx.complete_req();
    });
    try {
        if (ctx.req_sp)
            ctx.req_sp.spawn(this);
        if (!ctx.req_sp)
            ctx.req_sp = this;
        _this.add_headers(req);
        ctx.init_response();
        if (_this.refresh_task)
        {
            yield _this.refresh_task;
            _this.refresh_task = null;
            ctx.timeline.track('create');
        }
        if (_this.reverse_lookup)
        {
            ctx.set_reverse_lookup_res(
                yield _this.reverse_lookup_url(ctx.url));
        }
        if (!ctx.h_keep_alive)
            _this.session_mgr.reset_idle_pool();
        if (ctx.is_connect && parse_ip_url(ctx.url))
        {
            _this.logger.warn(`HTTPS to IP: %s is sent from super proxy`,
                ctx.url);
        }
        _this.usage_start(req);
        let resp = _this.rules.pre(req, res, head);
        if (!resp)
        {
            _this.init_proxy_req(req, res);
            resp = yield _this.route_req(req, res, head);
        }
        else if (resp!='switched' && !resp.body_size && _this.rules)
            _this.rules.post(req, res, head, resp);
        if (resp=='switched')
        {
            _this.usage_abort(req);
            yield this.wait();
        }
        if (resp instanceof Error)
            throw resp;
        if (!resp)
            throw new Error('invalid_response');
        if (ctx.wait_bw)
            yield this.wait_ext(ctx.wait_bw);
        _this.prepare_resp(req, resp);
        if (is_user_req() &&
            consts.SUCCESS_STATUS_CODE_RE.test(resp.status_code))
        {
            _this.emit('first_lpm_action',
                {action: 'send_request_successful', ua});
        }
        _this.emit('response', resp);
        ctx.req_sp.return(resp);
    } catch(e){
        const resp = ctx.response;
        resp.status_code = 502;
        resp.statusCode = 502;
        if (_this.rules.post(req, res, head, resp))
            return yield ctx.req_sp.wait();
        _this.prepare_resp(req, resp);
        resp.headers = {Connection: 'close', 'x-lpm-error': e.message};
        _this.emit('response', resp);
        if (_this.handle_custom_error(e, req, res, ctx))
            return ctx.req_sp.return();
        return ctx.req_sp.throw(e);
    }
});

E.prototype.handle_custom_error = function(e, req, res, ctx){
    if (!is_custom_error(e))
        return;
    if (e.message=='Authentication failed')
    {
        this.logger.info('%s %s 502 %s', req.method, ctx.url, e.message);
        write_http_reply(res, {
            statusCode: 502,
            statusMessage: 'LPM - Authentication failed',
        }, undefined, {end: true});
    }
    return true;
};

E.prototype.prepare_resp = function(req, resp){
    resp.remote_address = this.get_req_remote_ip(req);
    const auth = username.parse(req.ctx.h_proxy_authorization);
    if (auth && auth.tool=='proxy_tester')
        resp.context = 'PROXY TESTER TOOL';
    resp.rules = req.ctx.get_rules_executed();
};

E.prototype.get_user_agent = function(){
    if (!this.opt.user_agent)
        return;
    if (!this.opt.user_agent.startsWith('random'))
        return this.opt.user_agent;
    const ua_version = Math.floor(Math.random()*2240)+1000;
    if (this.opt.user_agent=='random_mobile')
    {
        return `Mozilla/5.0 (Linux; Android 6.0.1; SM-G532G Build/MMB29T`
        +`) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/63.0.`
        +`${ua_version}.132 Mobile Safari/537.36`;
    }
    return `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_2`
    +`) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/63.0.`
    +`${ua_version}.132 Safari/537.36`;
};

E.prototype.add_headers = function(req){
    const added_headers = {};
    const ua = this.get_user_agent();
    if (ua)
        added_headers['user-agent'] = ua;
    (this.opt.headers||[]).forEach(header=>{
        added_headers[header.name] = header.value;
    });
    if (this.opt.override_headers)
        Object.assign(req.headers, added_headers);
    else
    {
        for (let h in added_headers)
        {
            if (!req.headers[h])
                req.headers[h] = added_headers[h];
        }
    }
};

E.prototype.route_req = etask._fn(function*route_req(_this, req, res, head){
    try {
        _this.logger.debug('%s:%s - %s %s', req.socket.remoteAddress,
            req.socket.remotePort, req.method, req.ctx.url);
        req.setMaxListeners(30+(req.ctx.race_reqs||1));
        if (_this.opt.session_termination && (req.ctx.session||{}).terminated)
            return _this.router.send_internal_redirection(req, res);
        else if (_this.router.is_fake_request(req))
            this.spawn(_this.send_fake_request(this, req, res));
        else if (!_this.hosts.length)
            return this.throw(new Error('No hosts when processing request'));
        else if (_this.router.is_bypass_proxy(req))
            this.spawn(_this.send_bypass_req(this, req, res, head));
        else
        {
            this.spawn(_this.send_proxy_req(this, req, res, head,
                req.ctx.host));
            for (let i=1; i<req.ctx.race_reqs; i++)
            {
                this.spawn(
                    _this.send_proxy_req(this, req, res, head, req.ctx.host));
            }
        }
        const resp = yield this.wait_child('any');
        if (resp && resp.child && resp.child.retval)
            return resp.child.retval;
        return resp;
    } catch(e){
        return e;
    }
});

E.prototype.send_proxy_req = function(task, req, res, head, host){
    if (req.ctx.is_ssl)
        return this.send_proxy_req_ssl(task, req, res, head, host);
    return this.send_proxy_req_http(task, req, res, head, host);
};

E.prototype.request_handler = etask._fn(
function*request_handler(_this, req, res, proxy, head, headers){
    const ctx = req && req.ctx;
    this.once('cancel', ()=>{
        _this.abort_proxy_req(req, proxy, this);
    });
    if (proxy.setTimeout)
        proxy.setTimeout(ctx.timeout);
    proxy.once('response', _this.handle_proxy_resp(req, res, proxy, this,
        head, headers))
    .once('connect', _this.handle_proxy_connect(req, res, proxy, this, head))
    .once('upgrade', _this.handle_proxy_upgrade(req, res, proxy, this, head))
    .once('error', _this.handle_proxy_error(req, res, proxy, this, head))
    .once('timeout', _this.handle_proxy_timeout(req, res, proxy, this));
    return yield this.wait();
});

E.prototype.send_bypass_req = etask._fn(
function*send_bypass_req(_this, task, req, res, head){
    const ctx = req.ctx;
    task.once('cancel', ()=>this.return());
    let proxy;
    if (ctx.is_connect)
    {
        const parts = ctx.url.split(':');
        ctx.response.request.url = `https://${ctx.url}/`;
        proxy = net.connect({host: parts[0], port: +parts[1]});
        proxy.setTimeout(ctx.timeout);
        proxy.once('connect', ()=>{
            ctx.timeline.track('connect');
            write_http_reply(res, {statusCode: 200, statusMessage: 'OK'});
            res.pipe(proxy).pipe(res);
            this.return(ctx.response);
        }).once('timeout', _this.handle_proxy_timeout(req, res, proxy, this));
    }
    else
    {
        proxy = request({
            uri: ctx.url,
            host: url.parse(ctx.url).hostname,
            method: req.method,
            path: ctx.req_url,
            headers: ctx.format_headers(ctx.headers),
            rejectUnauthorized: !_this.opt.insecure,
        });
        proxy.once('connect', (_res, socket)=>{
            if (etask.is_final(task))
                socket.end();
            ctx.timeline.track('connect');
            _res.once('error', _this.log_throw_fn(this));
            socket.once('error', _this.log_throw_fn(this));
        });
        if (ctx.response.request.body)
            proxy.write(ctx.response.request.body);
        req.pipe(proxy);
    }
    task.once('cancel', ()=>{
        proxy.end();
    });
    proxy.once('close', ()=>{
        ctx.timeline.track('end');
        this.return(ctx.response);
    }).once('error', _this.log_throw_fn(this));
    if (!ctx.is_connect)
        return yield _this.request_handler(req, res, proxy, head);
    return yield this.wait();
});

E.prototype.log_throw_fn = function(task){
    return e=>{
        if (!is_custom_error(e))
            this.logger.error('fn: '+e.message);
        task.throw(e);
    };
};

E.prototype.is_ip_banned = function(ip, domain){
    if (!ip)
        return false;
    return this.banlist.has(ip, domain);
};

E.prototype.get_reused_conn = function(ctx){
    const socket_name = ctx.get_socket_name();
    if (this.https_agent.freeSockets[socket_name])
    {
        this.logger.debug('reusing socket: %s %s', ctx.domain,
            ctx.cred.username);
        const headers = this.socket2headers.get(socket_name);
        const socket = this.https_agent.freeSockets[socket_name][0];
        return {socket, res: {headers: Object.assign({}, headers)}};
    }
};

E.prototype.request_new_socket = etask._fn(
function*_request_new_socket(_this, task, req, res, head, host){
    const ctx = req.ctx;
    task.once('cancel', ()=>this.return());
    const conn = yield _this.requester.request_socket(ctx, host, {
        insecure: _this.opt.insecure,
        on_error: _this.log_throw_fn(this),
    });
    const socket_name = ctx.get_socket_name();
    _this.socket2headers.set(socket_name, Object.assign({}, conn.res.headers));
    conn.socket.once('close', ()=>{
        _this.socket2headers.delete(socket_name);
    });
    if (etask.is_final(task))
        conn.socket.end();
    if (_this.opt.session_termination && conn.res.statusCode==502 &&
            conn.res.statusMessage==consts.NO_PEERS_ERROR_SSL)
    {
        return _this.handle_session_termination(req, res);
    }
    if (conn.res.statusCode!=200)
    {
        const proxy_err = _this.check_proxy_response(host, conn.res);
        const can_retry = _this.rules.can_retry(req,
            {retry: ctx.proxy_retry});
        if (can_retry && proxy_err && proxy_err.retry)
        {
            _this.rules.retry(req, res, head);
            return yield this.wait();
        }
        if (proxy_err)
            throw proxy_err;
    }
    const domain = url2domain(req.url);
    const ip = conn.res.headers['x-luminati-ip'];
    if (_this.is_ip_banned(ip, domain))
    {
        _this.session_mgr.refresh_sessions();
        _this.rules.retry(req, res, head);
        return yield this.wait();
    }
    conn.res.once('error', _this.log_throw_fn(this));
    conn.socket.once('error', _this.log_throw_fn(this));
    return conn;
});

E.prototype.send_proxy_req_ssl = etask._fn(
function*send_proxy_req_ssl(_this, task, req, res, head, host){
    const ctx = req.ctx;
    try {
        ctx.response.request.url = ctx.url;
        let conn = _this.get_reused_conn(ctx);
        if (!conn)
            conn = yield _this.request_new_socket(task, req, res, head, host);
        if (!conn.socket)
            return conn;
        if (ctx.session && !ctx.h_keep_alive)
            _this.session_mgr.request_completed(ctx.session);
        const proxy_opt = {
            host: ctx.headers.host,
            method: req.method,
            path: req.url,
            headers: ctx.format_headers(ctx.headers),
            proxyHeaderWhiteList: E.hola_headers,
            proxyHeaderExclusiveList: E.hola_headers,
            // option passed down to https_agent
            lpm_username: ctx.cred.username,
            host_port: get_host_port(ctx),
            socket: conn.socket,
            agent: _this.https_agent,
            rejectUnauthorized: !_this.opt.insecure,
        };
        if (_this.opt.unblock || _this.opt.ssl_perm)
            proxy_opt.ca = ssl.ca.cert;
        const proxy = https.request(proxy_opt);
        task.once('cancel', ()=>proxy.end());
        proxy.host = host;
        ctx.proxies.push(proxy);
        if (ctx.response.request.body)
            proxy.write(ctx.response.request.body);
        req.pipe(proxy);
        const cb = ()=>proxy.end();
        ctx.end_listeners.push(cb);
        req.once('end', cb);
        return yield _this.request_handler(req, res, proxy, head,
            conn.res && conn.res.headers);
    } catch(e){
        return e;
    }
});

const session_to_ip = {};
let last_ip;

E.prototype.send_fake_request = etask._fn(
function*send_fake_request(_this, task, req, res){
    try {
        const get_random_ip = ()=>{
            if (!last_ip)
                last_ip = new Netmask('1.1.1.1');
            else
                last_ip = last_ip.next();
            return last_ip.base;
        };
        const get_ip = (session={})=>{
            if (session.ip)
                return session.ip;
            if (!session_to_ip[session.session])
                session_to_ip[session.session] = get_random_ip();
            return session_to_ip[session.session];
        };
        const fake_proxy = new events.EventEmitter();
        fake_proxy.abort = fake_proxy.destroy = ()=>null;
        const _res = new Readable({
            read(){}
        });
        _res.statusCode = req.headers['x-lpm-fake-status'] || 200;
        const ip = req.headers['x-lpm-fake-peer-ip'] ||
            get_ip(req.ctx.session);
        _res.headers = {
            'x-luminati-ip': ip,
            'x-lpm-authorization': 'auth',
            'content-type': 'text/plain; charset=utf-8',
            'x-lpm-whitelist': _this.opt.whitelist_ips.join(' '),
        };
        const fake_headers = req.headers['x-lpm-fake-headers'];
        Object.assign(_res.headers, JSON.parse(fake_headers||null));
        let fake_data;
        if (fake_data = Number(req.headers['x-lpm-fake-data']))
        {
            _res.headers['content-length'] = fake_data;
            _res.push(Buffer.alloc(fake_data, 'S').toString());
        }
        else
        {
            _res.headers['content-length'] = ip.length;
            _res.push(ip);
        }
        _res.push(null);
        const ms = Number(req.headers['x-lpm-sleep']) || 50;
        this.spawn(etask(function*(){
            yield etask.sleep(ms);
            fake_proxy.emit('response', _res);
        }));
        return yield _this.request_handler(req, res, fake_proxy, undefined,
            _res.headers);
    } catch(e){
        _this.logger.error(zerr.e2s(e));
        return e;
    }
});

E.prototype.send_proxy_req_http = etask._fn(
function*send_proxy_req_http(_this, task, req, res, head, host){
    const ctx = req.ctx;
    try {
        task.once('cancel', ()=>{
            this.return();
        });
        const proxy = _this.requester.request(ctx, host, {
            method: req.method,
            path: ctx.url,
            headers: ctx.format_headers(Object.assign(ctx.connect_headers,
                ctx.headers)),
            proxyHeaderWhiteList: E.hola_headers,
            proxyHeaderExclusiveList: E.hola_headers,
            rejectUnauthorized: !_this.opt.insecure,
        });
        task.once('cancel', ()=>{
            proxy.end();
        });
        proxy.host = host;
        ctx.proxies.push(proxy);
        if (ctx.is_connect)
            proxy.end();
        else
        {
            if (ctx.response.request.body)
                proxy.write(ctx.response.request.body);
            req.pipe(proxy);
            const cb = ()=>{
                if (!proxy.aborted)
                    proxy.end();
            };
            ctx.end_listeners.push(cb);
            req.once('end', cb);
        }
        return yield _this.request_handler(req, res, proxy, head);
    } catch(e){
        return e;
    }
});

E.prototype.handle_proxy_timeout = function(req, res, proxy, task){
    return ()=>{
        const ctx = req.ctx;
        ensure_socket_close(proxy);
        this.logger.debug('socket inactivity timeout: %s', ctx.url);
        task.return();
    };
};

E.prototype.handle_session_termination = function(req, res){
    if (req && req.ctx && req.ctx.session)
        req.ctx.session.terminated = true;
    if (req && res)
        return this.router.send_internal_redirection(req, res);
};

E.prototype.handle_proxy_resp = function(req, res, proxy, task, head,
    _headers)
{
    return proxy_res=>{
        if (this.opt.session_termination && proxy_res.statusCode==502 &&
            proxy_res.headers &&
            proxy_res.headers['x-luminati-error']==consts.NO_PEERS_ERROR)
        {
            const resp = this.handle_session_termination(req, res);
            task.return(resp);
        }
        if (proxy.aborted)
            return;
        const ctx = req.ctx;
        if (req.min_req_task)
        {
            req.min_req_task.return();
            req.min_req_task = null;
        }
        if (ctx.responded)
            return this.abort_proxy_req(req, proxy, task);
        if (ctx.response.proxy && proxy.socket)
            ctx.response.proxy.host = proxy.socket.remoteAddress;
        ctx.proxies.forEach(p=>p!=proxy && this.abort_proxy_req(req, p));
        ctx.responded = true;
        const count$ = create_count_stream(ctx.response, this.opt.har_limit);
        try {
            ctx.timeline.track('response');
            this.check_proxy_response(ctx.host, proxy_res);
            const message = proxy_res.headers['x-luminati-error'] ||
                proxy_res.statusMessage;
            this.logger.info('%s %s %s %s', req.method, ctx.url,
                proxy_res.statusCode, message);
            const ip = proxy_res.headers['x-luminati-ip'];
            const domain = url2domain(ctx.url);
            if (this.is_ip_banned(ip, domain) && (req.retry||0)<20)
            {
                this.session_mgr.refresh_sessions();
                return this.rules.retry(req, res, head);
            }
            if (ctx.session)
            {
                ctx.session.last_res = {ts: Date.now(), ip,
                    session: ctx.session.session};
            }
            if (!res.resp_written)
            {
                proxy_res.hola_headers = _headers;
                if (this.rules.post(req, res, head, proxy_res))
                    return this.abort_proxy_req(req, proxy);
                else if (this.rules.post_need_body(req))
                {
                    ctx.response._res = proxy_res;
                    const temp_data = [];
                    proxy_res.on('data', data=>{
                        temp_data.push(data);
                    });
                    proxy_res.once('end', ()=>{
                        const rule_res = this.rules.post_body(req, res, head,
                            proxy_res, temp_data);
                        if (rule_res)
                            return this.abort_proxy_req(req, proxy);
                        const has_body = !!ctx.response.body.length;
                        ctx.response.body_size = has_body ?
                            ctx.response.body[0].length : 0;
                        const har_limit = this.opt.har_limit;
                        for (let i=0; i<temp_data.length; i++)
                        {
                            if (ctx.response.body_size>=har_limit || has_body)
                                break;
                            const l = har_limit-ctx.response.body_size;
                            ctx.response.body.push(temp_data[i].slice(0, l));
                            ctx.response.body_size += l;
                        }
                        write_http_reply(res, proxy_res, _headers);
                        const res_data = has_body ?
                            ctx.response.body : temp_data;
                        for (let i=0; i<res_data.length; i++)
                            res.write(res_data[i]);
                        res.end();
                        ctx.timeline.track('end');
                        Object.assign(ctx.response, {
                            status_code: proxy_res.statusCode,
                            status_message: proxy_res.statusMessage,
                            headers: Object.assign({}, proxy_res.headers,
                            _headers||{}),
                        });
                        task.return(ctx.response);
                    }).once('error', this.log_throw_fn(task));
                    return;
                }
            }
            if (ctx.session && !ctx.h_keep_alive)
                this.session_mgr.request_completed(ctx.session);
            write_http_reply(res, proxy_res, _headers);
            proxy_res.pipe(count$).pipe(res);
            proxy_res.once('end', ()=>{
                ctx.timeline.track('end');
                Object.assign(ctx.response, {
                    status_code: proxy_res.statusCode,
                    status_message: proxy_res.statusMessage,
                    headers: Object.assign({}, proxy_res.headers,
                        _headers||{}),
                });
                task.return(ctx.response);
            }).once('error', this.log_throw_fn(task));
        } catch(e){
            task.throw(e);
        }
    };
};

E.prototype.handle_proxy_connect = function(req, res, proxy, task, head){
    return (proxy_res, proxy_socket, proxy_head)=>{
        if (proxy.aborted)
            return;
        const ctx = req.ctx;
        if (ctx.connected)
            return this.abort_proxy_req(req, proxy);
        if (ctx.response.proxy && proxy.socket)
            ctx.response.proxy.host = proxy.socket.remoteAddress;
        ctx.proxies.forEach(p=>p!=proxy && this.abort_proxy_req(req, p));
        ctx.connected = true;
        this.logger.info('%s %s %s %s', req.method, ctx.url,
            proxy_res.statusCode, proxy_res.statusMessage);
        const resp_counter = create_count_stream(ctx.response,
            this.opt.har_limit);
        const end_sock = proxy_socket.end.bind(proxy_socket);
        try {
            ctx.timeline.track('connect');
            const proxy_err = this.check_proxy_response(ctx.host, proxy_res);
            if (proxy_err)
                return task.throw(proxy_err);
            if (res.lpm_onconnect)
                res.lpm_onconnect(proxy_res);
            else
                write_http_reply(res, proxy_res, {});
            Object.assign(ctx.response, {
                status_code: proxy_res.statusCode,
                headers: proxy_res.headers,
            });
            if (proxy_res.statusCode!=200)
            {
                res.end();
                return task.return(ctx.response);
            }
            if (ctx.session && !ctx.h_keep_alive)
                this.session_mgr.request_completed(ctx.session);
            res.write(proxy_head);
            proxy_socket.write(head);
            proxy_socket.pipe(resp_counter).pipe(res).pipe(proxy_socket);
            proxy_res.once('error', e=>{
                this.session_mgr.removeListener('refresh_sessions', end_sock);
                task.throw(e);
            });
            res.once('end', ()=>{
                if (this.handle_smtp_rules(req, res, head, proxy_res, proxy))
                    return;
                ctx.timeline.track('end');
                task.return(ctx.response);
            });
            proxy_socket.once('error', err=>{
                this.logger.warn('error on proxy_socket: %s', err.message);
            }).once('end', ()=>{
                if (ctx.timeline.get('end'))
                    return task.return();
            }).once('close', ()=>{
                this.session_mgr.removeListener('refresh_sessions', end_sock);
            });
            this.session_mgr.once('refresh_sessions', end_sock);
        } catch(e){
            this.session_mgr.removeListener('refresh_sessions', end_sock);
            task.throw(e);
        }
    };
};

E.prototype.handle_smtp_rules = function(req, res, head, proxy_res, proxy){
    if (!(this.opt.smtp&&this.opt.smtp.length || req.ctx.url.endsWith(':25')))
        return false;
    const applied = this.rules.post(req, res, head, proxy_res);
    if (!applied && this.rules.post_need_body(req))
    {
        if (this.rules.post_body(req, res, head, proxy_res,
            req.ctx.response.body))
        {
            return this.abort_proxy_req(req, proxy);
        }
    }
    return applied;
};

E.prototype.handle_proxy_upgrade = function(req, socket, proxy, task, head){
    return (proxy_res, proxy_socket, proxy_head)=>{
        if (proxy.aborted)
            return;
        const ctx = req.ctx;
        if (ctx.upgraded)
            return this.abort_proxy_req(req, proxy);
        ctx.proxies.forEach(p=>p!=proxy && this.abort_proxy_req(req, p));
        ctx.upgraded = true;
        this.logger.info('Upgrade: %s %s %s %s', req.method, ctx.url,
            proxy_res.statusCode, proxy_res.statusMessage);
        if (head && head.length)
            socket.unshift(head);
        if (proxy_head && proxy_head.length)
            proxy_socket.unshift(proxy_head);
        Object.assign(ctx.response, {
            status_code: proxy_res.statusCode,
            headers: proxy_res.headers,
        });
        ctx.timeline.track('connect');
        if (!socket.writable)
        {
            ensure_socket_close(socket);
            ensure_socket_close(proxy_socket);
            ctx.timeline.track('end');
            return task.return(ctx.response);
        }
        write_http_reply(socket, proxy_res);
        socket.once('end', ()=>{
            ctx.timeline.track('end');
            task.return(ctx.response);
        });
        this.ws_handler.handle_connection(socket, proxy_socket);
    };
};

E.prototype.abort_proxy_req = function(req, proxy, task){
    req.unpipe(proxy);
    proxy.abort();
    proxy.destroy();
    if (task)
        task.return('abort');
};

E.prototype.usage_abort = function(req){
    const response = req.ctx.response;
    response.timeline.track('end');
    const data = {
        uuid: response.uuid,
        port: this.port,
        url: response.request.url,
        method: response.request.method,
        request_headers: stringify(response.request.headers),
        request_body: response.request.body,
        status_code: 'canceled',
        timestamp: response.timeline.get('create'),
        elapsed: response.timeline.get_delta('end'),
        timeline: stringify(response.timeline.req_chain),
        context: response.context,
        remote_address: this.get_req_remote_ip(req),
        rules: req.ctx.get_rules_executed(),
    };
    if (response.proxy)
    {
        data.super_proxy = response.proxy.host+':'+response.proxy.proxy_port;
        data.username = response.proxy.username;
        data.password = response.proxy.password;
    }
    this.emit('usage_abort', data);
};

E.prototype.handle_proxy_error = function(req, res, proxy, task, head){
    return err=>{
        const ctx = req.ctx;
        if (proxy.aborted||ctx.responded||ctx.connected)
            return;
        const proxy_err = this.check_proxy_response(ctx.host,
            res || {statusCode: 502});
        const can_retry = this.rules.can_retry(req,
            {retry: ctx.proxy_retry});
        if (proxy_err && proxy_err.can_retry && can_retry)
        {
            this.rules.retry(req, res, head);
            this.abort_proxy_req(req, proxy);
            return;
        }
        this.abort_proxy_req(req, proxy);
        return ctx.req_sp.throw(proxy_err||err);
    };
};

E.prototype.request = function(){
    const args = [].slice.call(arguments);
    if (typeof args[0]=='string')
        args[0] = {url: args[0]};
    args[0].proxy = args[0].proxy||`http://127.0.0.1:${this.port}`;
    return request.apply(null, args);
};

E.prototype.banip = function(ip, ms, session, domain){
    this.banlist.add(ip, ms, domain);
    this.emit('banip', {ip, ms, domain});
    if (session)
        this.session_mgr.replace_session(session);
    return true;
};

E.prototype.unbanip = function(ip, domain){
    if (!this.banlist.has(ip, domain))
        return false;
    this.banlist.delete(ip, domain);
    this.emit('unbanip', {ip, domain});
    return true;
};

E.hola_headers = qw`proxy-connection proxy-authentication x-hola-agent
    x-hola-context x-luminati-timeline x-luminati-peer-timeline
    x-luminati-error x-lpm-error x-lpm-authorization x-luminati-ip`;
