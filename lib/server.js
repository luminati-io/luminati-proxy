// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true, evil: true*/
const _ = require('lodash');
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
const log = require('./log.js');
const username = require('./username.js');
const http_shutdown = require('http-shutdown');
const Socks = require('./socks.js');
const Smtp = require('./smtp.js');
const ssl = require('./ssl.js');
const Ws = require('./ws.js');
const etask = require('../util/etask.js');
const zurl = require('../util/url.js');
const date = require('../util/date.js');
const {decode_body, write_http_reply, url2domain, find_iface,
    user_agent, ensure_socket_close, is_ws_upgrade_req} = require('./util.js');
const zerr = require('../util/zerr.js');
const zfile = require('../util/file.js');
const lpm_config = require('../util/lpm_config.js');
const qw = require('../util/string.js').qw;
const uuid_v4 = require('uuid/v4');
const sessions = require('./session.js');
const Context = require('./context.js');
const Router = require('./router.js');
const Rules = require('./rules.js');
const Ip_cache = require('./ip_cache.js');
const consts = require('./consts.js');
const pkg = require('../package.json');
const {SEC} = date.ms;
const E = module.exports = Server;
E.https_servername = 'zproxy.luminati.io';
E.superproxy_domains = ['zproxy.lum-superproxy.io', 'zproxy.luminati.io',
    'zproxy.'+pkg.api_domain];
E.default = Object.assign({}, lpm_config.server_default);
E.dropin = {
    port: E.default.proxy_port,
    listen_port: E.default.proxy_port,
};
const ip_re = /^(https?:\/\/)?(\d+\.\d+\.\d+\.\d+)([$/:?])/i;
const is_superproxy_domain = d=>E.superproxy_domains.includes(d);

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

const create_count_stream = resp=>new stream.Transform({
    transform(data, encoding, cb){
        if (resp.body_size<1024)
            resp.body.push(data.slice(0, 1024-resp.body_size));
        resp.body_size += data.length;
        cb(null, data);
    },
});

function Server(opt){
    events.EventEmitter.call(this);
    this.agents = {
        https: new https.Agent({
            keepAlive: true,
            keepAliveMsecs: 5000,
            servername: E.https_servername,
        }),
        http: new http.Agent({
            keepAlive: true,
            keepAliveMsecs: 5000,
        }),
    };
    this.active = 0;
    this.failure = {};
    this.requests_queue = [];
    this.throttle_queue = [];
    this.sp = etask(function*luminati_listen_constructor(){
        return yield this.wait();
    });
    opt.listen_port = opt.listen_port || opt.port || E.default.port;
    this.log = log(opt.listen_port, opt.log);
    this.http = opt.secure_proxy ? https : http;
    this.protocol = this.agents[opt.secure_proxy ? 'https' : 'http'];
    opt = this.opt = Object.assign({}, E.default, opt);
    this.rules = new Rules(this, opt.rules);
    this.banlist = new Ip_cache();
    this.ws_handler = new Ws(opt);
    this.init_http_server(opt);
    this.socks_server = new Socks({
        port: opt.port || E.default.port,
        log: opt.log,
    });
    this.smtp_server = new Smtp(this, {
        port: opt.port,
        log: opt.log,
        ips: opt.smtp,
    });
    if (opt.ssl)
        this.init_https_server();
    this.init_tcp_server();
    this.on('response', resp=>this.usage(resp));
    this.update_config(opt);
}

util.inherits(E, events.EventEmitter);

E.prototype.update_config = function(opt){
    // XXX krzysztof: move more logic here from the constructor
    if (this.session_mgr)
        this.session_mgr.stop();
    opt = this.opt = Object.assign({}, this.opt, opt);
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
        this.http_server.on('connect', (req, res, head)=>{
            this.sp.spawn(this.handler(req, res, head));
        });
    }
};

E.prototype.init_https_server = function(){
    this.authorization = {};
    this.req_remote_ip = {};
    this.https_server = https.createServer(
        Object.assign({requestCert: false}, ssl()), (req, res, head)=>{
            const remote_ip = this.req_remote_ip[req.socket.remotePort];
            if (remote_ip && req.socket.remoteAddress=='127.0.0.1')
            {
                this.log.info('Request ip fixed %s %s', remote_ip,
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
    this.http_server.on('connect', (req, res, head)=>{
        const port = zurl.parse(req.url).port;
        if (parse_ip_url(req.url) || port==43 || port==80)
            return this.sp.spawn(this.handler(req, res, head));
        write_http_reply(res, {statusCode: 200, statusMessage: 'OK'});
        const remote_ip = this.get_req_remote_ip(req);
        if (remote_ip)
            this.req_remote_ip[res.remotePort] = remote_ip;
        const authorization = req.headers['proxy-authorization'];
        if (authorization)
            this.authorization[res.remotePort] = authorization;
        res.on('close', ()=>{
            delete this.authorization[res.remotePort];
            delete this.req_remote_ip[res.remotePort];
        });
        res.on('error', e=>{
            // XXX krzysztof: consider canceling whole request here
            if (e.code=='ECONNRESET')
                return this.log.info('Connection closed by the client');
            this.log.error('https socket: %s', zerr.e2s(e));
        });
        res.once('timeout', ()=>{
            ensure_socket_close(res);
        });
        res.setTimeout(120*SEC);
        req.on('end', ()=>res.end());
        this.https_server.emit('connection', res);
    });
    this.https_server.on('upgrade', (req, socket, head)=>{
        if (is_ws_upgrade_req(req))
            this.ws_handler.handle_connection(req, socket, head);
        else
            ensure_socket_close(socket);
    });
};

E.prototype.init_tcp_server = function(){
    this.tcp_server = new net.createServer(socket=>{
        this.tcp_server.running = true;
        socket.setTimeout(this.opt.socket_inactivity_timeout);
        socket.on('error', err=>null);
        socket.once('timeout', ()=>{
            ensure_socket_close(socket);
        });
        if (this.opt.smtp && this.opt.smtp.length)
            return this.smtp_server.connect(socket);
        socket.once('data', data=>{
            if (!this.tcp_server.running)
                return socket.end();
            socket.pause();
            const protocol_byte = data[0];
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

E.prototype.destroy = function(){
    // XXX krzysztof: an empty function to keep interface consistent with
    // Proxy Port
};

E.prototype.usage_start = function(req){
    if (!req.ctx.uuid)
        req.ctx.uuid = uuid_v4();
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
    if (!response || !response.timeline)
    {
        this.perr(new Error('invalid_response'));
        this.log.error('Invalid response %O', response);
        return;
    }
    const headers = response.headers||{};
    const proxy_info = qw`x-hola-timeline-debug x-hola-unblocker-debug`
        .map(h=>headers[h]||'')
        .map(h=>h.match(/(\d+\.\d+\.\d+\.\d+) ([^ ]+)/))
        .find(i=>i)||['', '', ''];
    const is_ssl = response.request.url.endsWith(':443') &&
        response.status_code=='200';
    const status_code = is_ssl ? 'unknown' : response.status_code || 'unknown';
    const encoding = response.headers && response.headers['content-encoding'];
    const response_body = is_ssl ?
        'unknown' : decode_body(response.body, encoding, 1024);
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
        proxy_peer: proxy_info[1] || headers['x-hola-ip'],
        country: proxy_info[2],
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
    // XXX krzysztof: use ctx to track timeline
    this.emit('refresh_ip', {ip, port: this.opt.port});
};

E.prototype.is_whitelisted = function(req){
    const ip = this.get_req_remote_ip(req);
    if (ip=='127.0.0.1')
        return true;
    let auth_header = req.headers['proxy-authorization'];
    if (auth_header)
    {
        auth_header = auth_header.replace('Basic ', '');
        const auth = Buffer.from(auth_header, 'base64').toString();
        const [user, pass] = auth.split(':');
        if (user=='token')
            delete req.headers['proxy-authorization'];
        if (user=='token' && this.opt.token_auth &&
            pass==this.opt.token_auth)
        {
            return true;
        }
    }
    return this.opt.whitelist_ips.map(_ip=>new Netmask(_ip)).some(_ip=>{
        try { return _ip.contains(ip); }
        catch(e){ return false; }
    });
};

E.prototype.handler = etask._fn(function*handler(_this, req, res, head){
    this.finally(()=>{
        _this.complete_req(this.error, req, res);
    });
    res.on('close', ()=>setTimeout(()=>{
        this.return();
    }));
    req.on('close', ()=>setTimeout(()=>{
        this.return();
    }));
    req.on('finish', ()=>setTimeout(()=>{
        this.return();
    }));
    try {
        req._queued = Date.now();
        _this.active++;
        _this.emit('idle', false);
        res.on('error', e=>{
            if (e.code=='ECONNRESET')
            {
                _this.log.info('Connection closed by the client');
                return this.return();
            }
            _this.log.error('client: %s', zerr.e2s(e));
        });
        req.once('timeout', ()=>this.throw(new Error('request timeout')));
        if (!_this.is_whitelisted(req))
        {
            return write_http_reply(res, {
                statusCode: 403,
                statusMessage: 'Forbidden',
                headers: {Connection: 'close'},
            }, undefined, {end: true});
        }
        this.info.url = req.url;
        if (_this.opt.throttle && _this.active>_this.opt.throttle)
        {
            _this.throttle_queue.push(this);
            yield this.wait();
        }
        if (_this.hosts && _this.hosts.length)
            return yield _this.lpm_request(req, res, head);
        _this.requests_queue.push([req, res, head]);
    } catch(e){
        _this.log.info('handler error %s', zerr.e2s(e));
        throw e;
    }
});

E.prototype.log_error = function(err, err_origin){
    let message;
    if (err.custom)
        message = err.message;
    else if (error_messages[err.code])
        message = error_messages[err.code];
    else
        message = err.stack.split('\n').slice(0, 2).join('\n');
    this.log.error('%s: %s', err_origin, message);

};

E.prototype.send_error = function(req, res, err, err_origin){
    this.log_error(err, err_origin);
    if (res.ended)
        return;
    const err_header = `x-${err_origin}-error`;
    const headers = {
        Connection: 'close',
        [err_header]: error_messages[err.code] || err.message,
    };
    try {
        write_http_reply(res, {
            statusCode: 502,
            headers,
            statusMessage: 'LPM - Bad Gateway',
        }, undefined, {end: true});
    } catch(e){
        this.log.error('could not send head: %s\n%s', e.message);
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
        {
            this.emit('idle', true);
            return;
        }
        if (this.throttle_queue.length)
            this.throttle_queue.shift().continue();
    } catch(e){
        this.log.error('unexpected error: %s', zerr.e2s(e));
    }
};

E.prototype.listen = etask._fn(function*listen(_this, listen_port, hostname){
    try {
        listen_port = listen_port || _this.opt.listen_port || 0;
        _this.proxy = [].concat(_this.opt.proxy);
        yield _this.resolve_proxy();
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
        _this.socks_server.on('error', e=>{
            this.throw(e);
        });
        yield _this.socks_server.set_tcp_server(_this.tcp_server);
        _this.tcp_server.on('error', e=>{
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
        _this.session_mgr.stop();
        _this.socks_server.stop();
        _this.ws_handler.stop();
        _this.protocol.destroy();
        _this.tcp_server.running = false;
        yield etask.nfn_apply(_this.tcp_server, '.forceShutdown', []);
        _this.emit('stopped');
        return _this;
    } catch(e){
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
    {
        delete this.failure[proxy];
        return false;
    }
    if (!this.opt.proxy_switch)
        return err;
    const failures = this.failure[proxy] = (this.failure[proxy]||0)+1;
    this.log.warn('invalid proxy response %s %s', err.code, err.message);
    if (failures>=this.opt.proxy_switch)
    {
        this.log.warn('removing failed proxy server %s', proxy);
        this.sp.spawn(this.remove_proxy(proxy));
    }
    return err;
};

E.prototype.remove_proxy = etask._fn(function*remove_proxy(_this, proxy){
    if (_this.hosts)
        _this.hosts = _this.hosts.filter(h=>h!=proxy);
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
    if (!_this.opt.proxy_resolve)
        return _this.hosts = [_this.opt.proxy];
    const hosts = {};
    const proxies = _this.proxy.slice();
    _this.resolving_proxies = true;
    [].concat(_this.hosts||[]).forEach(h=>hosts[h] = false);
    const timestamp = Date.now();
    proxies.forEach(p=>{
        if (/^\d+\.\d+\.\d+\.\d+$/.test(p))
            hosts[p] = true;
    });
    while (proxies.length && Object.keys(hosts).length<_this.opt.proxy_count &&
        Date.now()-timestamp<30*SEC)
    {
        const proxy = proxies.shift();
        if (hosts[proxy])
            continue;
        proxies.push(proxy);
        let domain = proxy;
        if (proxy.length==2)
            domain = lpm_config.default_superproxy_domain;
        if (_this.opt.customer && is_superproxy_domain(domain))
        {
            domain = `customer-${_this.opt.customer}-`
                +`session-${Date.now()}.${domain}`;
        }
        try {
            const ips = yield etask.nfn_apply(dns, '.resolve', [domain]);
            ips.forEach(ip=>hosts[ip] = proxy);
        } catch(e){
            _this.log.warn('Failed to resolve %s (%s): %s', proxy, domain,
                e.message);
        }
    }
    _this.hosts = _.shuffle(Object.keys(hosts));
    if (!_this.hosts.length)
        _this.log.error('Failed to resolve any proxies');
    _this.resolving_proxies = false;
    const queue = _this.requests_queue;
    _this.requests_queue = [];
    queue.forEach(args=>_this.lpm_request.apply(_this, args));
});

E.prototype.perr = function(err){
    return;
    // XXX krzysztof: turn on when logging is fixed
    // return zerr.perr(err, info);
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
    if (auth.tool)
    {
        delete auth.tool;
        delete auth.password;
    }
    const opt = {
        ext_proxy: ctx.session && ctx.session.ext_proxy,
        ip: ctx.session && ctx.session.ip || this.opt.ip,
        vip: ctx.session && ctx.session.vip || this.opt.vip,
        session: ctx.session && ctx.session.session,
        direct: ctx.is_direct,
        unblocker: ctx.opt.unblock,
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
    ctx.log.info('requesting using %s', ctx.cred.username);
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
    const headers = Object.assign({}, req.headers);
    const ua = headers['user-agent'];
    const is_user_req = ()=>ua != user_agent && !headers['x-lpm-keep-alive'];
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
        if (_this.refresh_task)
        {
            yield _this.refresh_task;
            _this.refresh_task = null;
            ctx.timeline.track('create');
        }
        if (req._queued)
            ctx.timeline.track('queued', req._queued);
        if (_this.reverse_lookup)
        {
            ctx.set_reverse_lookup_res(
                yield _this.reverse_lookup_url(ctx.url));
        }
        _this.add_headers(req);
        if (!ctx.h_keep_alive)
            _this.session_mgr.reset_idle_pool();
        ctx.init_response();
        if (ctx.is_connect && parse_ip_url(ctx.url))
            ctx.log.warn(`HTTPS to IP: %s is sent from super proxy`, ctx.url);
        _this.usage_start(req);
        let resp = _this.rules.pre(req, res, head);
        if (!resp && _this.opt.dns_check)
        {
            try {
                yield etask.nfn_apply(dns, '.resolve', [ctx.domain]);
            } catch(e){
                if (res.socket)
                    res.socket.destroy();
                resp = ctx.response;
                resp.status_code = 502;
                resp.status_message = 'Connection closed due to DNS error';
            }
        }
        if (!resp)
        {
            _this.init_proxy_req(req, res);
            resp = yield _this.route_req(req, res, head);
        }
        else if (resp!='switched' && !resp.body_size && _this.rules)
            _this.rules.post(req, res, head, resp);
        if (resp=='switched')
        {
            _this.emit('usage_abort', req.ctx.uuid);
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
        _this.log.warn('request err %s', e.message);
        if (e.message && e.message.match(/(invalid_response|hang up)/))
            _this.perr(e);
        const resp = ctx.response;
        resp.status_code = 502;
        resp.statusCode = 502;
        if (_this.rules.post(req, res, head, resp))
            return yield ctx.req_sp.wait();
        _this.prepare_resp(req, resp);
        resp.headers = {Connection: 'close', 'x-lpm-error': e.message};
        _this.emit('response', resp);
        return ctx.req_sp.throw(e);
    }
});

E.prototype.prepare_resp = function(req, resp){
    resp.remote_address = this.get_req_remote_ip(req);
    resp.uuid = req.ctx.uuid;
    const auth = username.parse(req.ctx.h_proxy_authorization);
    if (auth && auth.tool=='proxy_tester')
        resp.context = 'PROXY TESTER TOOL';
    if (auth && auth.tool=='link_tester')
        resp.context = 'LINK TESTER TOOL';
    resp.rules = req.ctx.get_rules_executed();
};

E.prototype.add_headers = function(req){
    const added_headers = {};
    if (this.opt.random_user_agent)
    {
        const ua_version = Math.floor(Math.random()*2240)+1000;
        const ua = `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_2`
        +`) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/63.0.`
        +`${ua_version}.132 Safari/537.36`;
        added_headers['user-agent'] = ua;
    }
    else if (this.opt.user_agent)
        added_headers['user-agent'] = this.opt.user_agent;
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
        _this.log.info('%s:%s - %s %s', req.socket.remoteAddress,
            req.socket.remotePort, req.method, req.ctx.url);
        req.setMaxListeners(30+(req.ctx.race_reqs||1));
        if (_this.opt.session_termination && (req.ctx.session||{}).terminated)
            return _this.router.send_internal_redirection(req, res);
        else if (_this.router.is_fake_request(req))
            this.spawn(_this.send_fake_request(this, req, res));
        else if (!_this.hosts.length)
        {
            if (_this.resolving_proxies)
                return _this.requests_queue.push([req, res, head]);
            return this.throw(new Error('No hosts when processing request'));
        }
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
    const ensure_end_task = ()=>setTimeout(()=>{
        if (etask.is_final(this))
            return;
        ctx.log.notice('closing long connection after 120 seconds');
        this.return(ctx && ctx.response);
    }, 120*SEC);
    this.on('cancel', ()=>_this.abort_proxy_req(req, proxy, this));
    if (proxy.setTimeout)
        proxy.setTimeout(ctx.timeout);
    proxy.on('response', _this.handle_proxy_resp(req, res, proxy, this,
        head, headers))
    .on('connect', _this.handle_proxy_connect(req, res, proxy, this, head))
    .on('error', _this.handle_proxy_error(req, res, proxy, this, head))
    .once('timeout', _this.handle_proxy_timeout(req, res, proxy, this))
    .on('close', ensure_end_task);
    return yield this.wait();
});

E.prototype.send_bypass_req = etask._fn(
function*send_bypass_req(_this, task, req, res, head){
    const ctx = req.ctx;
    task.on('cancel', ()=>this.return());
    let proxy;
    if (ctx.is_connect)
    {
        const parts = ctx.url.split(':');
        ctx.response.request.url = `https://${ctx.url}/`;
        proxy = net.connect({host: parts[0], port: +parts[1]});
        proxy.setTimeout(ctx.timeout);
        proxy.on('connect', ()=>{
            ctx.timeline.track('direct_connect');
            write_http_reply(res, {statusCode: 200, statusMessage: 'OK'});
            res.pipe(proxy).pipe(res);
            this.return(ctx.response);
        }).once('timeout',
            _this.handle_proxy_timeout(req, res, proxy, this));
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
        proxy.on('connect', (_res, socket)=>{
            if (etask.is_final(task))
                socket.end();
            ctx.timeline.track('direct_connect');
            _res.on('error', _this.log_throw_fn(this));
            socket.on('error', _this.log_throw_fn(this));
        });
        if (ctx.response.request.body)
            proxy.write(ctx.response.request.body);
        req.pipe(proxy);
    }
    task.on('cancel', ()=>{
        proxy.end();
    });
    proxy.on('close', ()=>{
        ctx.timeline.track('end');
        this.return(ctx.response);
    }).on('error', _this.log_throw_fn(this));
    if (!ctx.is_connect)
        return yield _this.request_handler(req, res, proxy, head);
    return yield this.wait();
});

E.prototype.log_throw_fn = function(task){
    return e=>{
        this.log.error('fn: '+e.message);
        task.throw(e);
    };
};

E.prototype.is_ip_banned = function(ip, domain){
    if (!ip)
        return false;
    return this.banlist.has(ip, domain);
};

E.prototype.send_proxy_req_ssl = etask._fn(
function*send_proxy_req_ssl(_this, task, req, res, head, host){
    const ctx = req.ctx;
    try {
        ctx.response.request.url = ctx.url;
        task.on('cancel', ()=>this.return());
        const conn_req = _this.http.request({
            host,
            port: ctx.proxy_port,
            method: 'CONNECT',
            path: ctx.domain+':443',
            headers: ctx.format_headers(ctx.connect_headers),
            agent: ctx.agent,
            rejectUnauthorized: !_this.opt.insecure,
        })
        .on('connect', (_res, socket, _head)=>{
            if (etask.is_final(task))
                socket.end();
            this.continue({res: _res, socket, head: _head});
        })
        .on('error', _this.log_throw_fn(this))
        .end();
        task.on('cancel', ()=>conn_req.end());
        const conn = yield this.wait();
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
        const tl = (conn.res.headers['x-hola-timeline-debug']||'').split(' ');
        const ip = tl && tl.length>=3 && tl[3];
        const domain = url2domain(req.url);
        if (_this.is_ip_banned(ip, domain))
        {
            ctx.log.info('ip_banned %s', ip);
            // XXX krzysztof: get rid of it
            req.session = gen_session();
            _this.rules.retry(req, res, head);
            return yield this.wait();
        }
        if (ctx.session && !ctx.h_keep_alive)
            _this.session_mgr.request_completed(ctx.session);
        ctx.timeline.track('connect');
        conn.res.on('error', _this.log_throw_fn(this));
        conn.socket.on('error', _this.log_throw_fn(this));
        const proxy_opt = {
            host: ctx.headers.host,
            method: req.method,
            path: req.url,
            headers: ctx.format_headers(ctx.headers),
            proxyHeaderWhiteList: E.hola_headers,
            proxyHeaderExclusiveList: E.hola_headers,
            socket: conn.socket,
            agent: false,
            rejectUnauthorized: !_this.opt.insecure,
        };
        if (_this.opt.unblock || _this.opt.ssl_perm)
            proxy_opt.ca = ssl.ca.cert;
        const proxy = https.request(proxy_opt);
        task.on('cancel', ()=>proxy.end());
        proxy.host = host;
        ctx.proxies.push(proxy);
        if (ctx.response.request.body)
            proxy.write(ctx.response.request.body);
        req.pipe(proxy);
        req.on('end', req._onend = ()=>{
            proxy.end();
        });
        return yield _this.request_handler(req, res, proxy, head,
            conn.res.headers);
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
            'x-hola-ip': ip,
            'x-hola-timeline-debug': `ztun 50ms z2 ${ip} x zg x.pool_route z2`,
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
        _this.log.error(zerr.e2s(e));
        return e;
    }
});

E.prototype.send_proxy_req_http = etask._fn(
function*send_proxy_req_http(_this, task, req, res, head, host){
    const ctx = req.ctx;
    try {
        task.on('cancel', ()=>this.return());
        const proxy = _this.http.request({
            host,
            port: ctx.proxy_port,
            method: req.method,
            path: ctx.url,
            agent: ctx.agent,
            headers: ctx.format_headers(Object.assign(ctx.connect_headers,
                ctx.headers)),
            proxyHeaderWhiteList: E.hola_headers,
            proxyHeaderExclusiveList: E.hola_headers,
            rejectUnauthorized: !_this.opt.insecure,
        });
        task.on('cancel', ()=>{
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
            req.on('end', req._onend = ()=>{
                if (!proxy.aborted)
                    proxy.end();
            });
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
        this.log.info('socket inactivity timeout: %s', ctx.url);
        task.return();
    };
};

E.prototype.handle_session_termination = function(req, res){
    if (req && req.ctx && req.ctx.session)
        req.ctx.session.terminated = true;
    if (req && res)
        return this.router.send_internal_redirection(req, res);
};

const gen_session = ()=>'rand'+Math.floor(Math.random()*9999999+1000000);

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
        ctx.proxies.forEach(p=>p!=proxy && this.abort_proxy_req(req, p));
        ctx.responded = true;
        const count$ = create_count_stream(ctx.response);
        try {
            ctx.timeline.track('response');
            this.check_proxy_response(ctx.host, proxy_res);
            ctx.log.info(`${req.method} ${ctx.url} - ${proxy_res.statusCode}`);
            const ip = proxy_res.headers['x-hola-ip'];
            const domain = url2domain(ctx.url);
            if (this.is_ip_banned(ip, domain) && (req.retry||0)<20)
            {
                ctx.log.info(`ip ${ip} is banned, retrying w/ new session id`);
                // XXX krzysztof: get rid of it, retry should take new session
                req.session = gen_session();
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
                    proxy_res.on('end', ()=>{
                        const rule_res = this.rules.post_body(req, res, head,
                            proxy_res, temp_data);
                        if (rule_res)
                            return this.abort_proxy_req(req, proxy);
                        const has_body = !!ctx.response.body.length;
                        ctx.response.body_size = has_body ?
                            ctx.response.body[0].length : 0;
                        for (let i=0; i<temp_data.length; i++)
                        {
                            if (ctx.response.body_size>=1024 || has_body)
                                break;
                            const l = 1024-ctx.response.body_size;
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
                        ctx.log.info(ctx.timeline.toString());
                        task.return(ctx.response);
                    }).on('error', this.log_throw_fn(task));
                    return;
                }
            }
            if (ctx.session && !ctx.h_keep_alive)
                this.session_mgr.request_completed(ctx.session);
            write_http_reply(res, proxy_res, _headers);
            proxy_res.pipe(count$).pipe(res);
            proxy_res.on('end', ()=>{
                ctx.timeline.track('end');
                Object.assign(ctx.response, {
                    status_code: proxy_res.statusCode,
                    status_message: proxy_res.statusMessage,
                    headers: Object.assign({}, proxy_res.headers,
                        _headers||{}),
                });
                task.return(ctx.response);
            }).on('error', this.log_throw_fn(task));
        } catch(e){
            task.throw(e);
        }
    };
};

E.prototype.handle_proxy_connect = function(req, res, proxy, task, head){
    return (proxy_res, socket, proxy_head)=>{
        if (proxy.aborted)
            return;
        const ctx = req.ctx;
        if (ctx.connected)
            return this.abort_proxy_req(req, proxy);
        ctx.proxies.forEach(p=>p!=proxy && this.abort_proxy_req(req, p));
        ctx.connected = true;
        const resp_counter = create_count_stream(ctx.response);
        const end_sock = socket.end.bind(socket);
        try {
            ctx.timeline.track('connect');
            const proxy_err = this.check_proxy_response(ctx.host, proxy_res);
            if (proxy_err)
                return task.throw(proxy_err);
            write_http_reply(res, proxy_res, {}, {debug: this.opt.debug});
            Object.assign(ctx.response, {
                status_code: proxy_res.statusCode,
                headers: proxy_res.headers,
            });
            if (proxy_res.statusCode!=200)
            {
                ctx.log.error('%s %s - %s', req.method, ctx.url,
                    proxy_res.statusCode);
                res.end();
                return task.return(ctx.response);
            }
            if (ctx.session && !ctx.h_keep_alive)
                this.session_mgr.request_completed(ctx.session);
            res.write(proxy_head);
            socket.write(head);
            socket.pipe(resp_counter).pipe(res).pipe(socket);
            proxy_res.on('error', e=>{
                this.session_mgr.removeListener('refresh_sessions', end_sock);
                task.throw(e);
            });
            socket.on('error', err=>{
                ctx.log.error('request socket: %s', zerr.e2s(err));
            }).on('end', ()=>{
                if (ctx.timeline.get('end'))
                    return task.return();
                if (ctx.url.endsWith(':25'))
                {
                    const applied = this.rules.post(req, res, head, proxy_res);
                    if (!applied && this.rules.post_need_body(req))
                    {
                        ctx.response._res = proxy_res;
                        proxy_res.on('data', data=>{
                            ctx.response.body.push(data);
                        });
                        proxy_res.on('end', ()=>{
                            if (this.rules.post_body(req, res, head, proxy_res,
                                ctx.response.body))
                            {
                                return this.abort_proxy_req(req, proxy);
                            }
                        });
                    }
                }
                ctx.timeline.track('end');
                task.return(ctx.response);
            }).on('close', ()=>{
                this.session_mgr.removeListener('refresh_sessions', end_sock);
            });
            this.session_mgr.once('refresh_sessions', end_sock);
        } catch(e){
            this.session_mgr.removeListener('refresh_sessions', end_sock);
            task.throw(e);
        }
    };
};

E.prototype.abort_proxy_req = function(req, proxy, task){
    req.unpipe(proxy);
    proxy.abort();
    proxy.destroy();
    if (task)
        task.return('abort');
    // XXX krzysztof: fix retry
    this.emit('usage_abort', req.ctx.uuid);
};

const error_messages = {
    'UNABLE_TO_VERIFY_LEAF_SIGNATURE': 'unable to verify the first '
        +'certificate: enable <insecure> option to ignore it',
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
            ctx.log.warn('error proxy response %s, retrying', ctx.host);
            this.rules.retry(req, res, head);
            this.abort_proxy_req(req, proxy);
            return;
        }
        this.abort_proxy_req(req, proxy);
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

E.prototype.banip = function(ip, ms, session, domain){
    this.banlist.add(ip, ms, domain);
    this.emit('banip', {ip, ms, domain});
    if (session)
        this.session_mgr.replace_session(session);
    return true;
};

E.prototype.unban = function(ip){
    if (!this.banlist.has(ip))
        return false;
    this.banlist.delete(ip);
    this.emit('unbanip', ip);
    return true;
};

E.hola_headers = qw`proxy-connection proxy-authentication x-hola-agent
    x-hola-debug x-hola-tunnel-key x-hola-tunnel-ip x-hola-tunnel-session
    x-hola-auth x-hola-unblocker-debug x-hola-session x-hola-cid
    x-hola-country x-hola-forbid-peer x-hola-dst-ips x-hola-ip x-hola-vip
    x-hola-immediate x-hola-dns-only x-hola-response x-hola-direct-first
    x-hola-direct-discover x-hola-blocked-response x-hola-conf
    x-hola-headers-only x-hola-unblocker-bext x-hola-dynamic-tunnels
    x-hola-context x-luminati-timeline x-luminati-peer-timeline`;
