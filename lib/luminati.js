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
const stringify = require('json-stable-stringify');
const find_iface = require('./find_iface.js');
const stream = require('stream');
const request = require('request');
const util = require('util');
const log = require('./log.js');
const username = require('./username.js');
const http_shutdown = require('http-shutdown');
const Socks = require('./socks.js');
const ssl = require('./ssl.js');
const version = require('../package.json').version;
const etask = require('../util/etask.js');
const zurl = require('../util/url.js');
const date = require('../util/date.js');
const decode_body = require('./util.js').decode_body;
const zerr = require('../util/zerr.js');
const zfile = require('../util/file.js');
const lpm_config = require('../util/lpm_config.js');
const qw = require('../util/string.js').qw;
const child_process = require('child_process');
const uuid_v4 = require('uuid/v4');
const sessions = require('./sessions.js');
const Context = require('./context.js');
const Router = require('./router.js');
const Rules = require('./rules.js');
const assign = Object.assign, {SEC} = date.ms;
const E = module.exports = Luminati;
E.user_agent = 'luminati-proxy-manager/'+version;
E.hola_agent = 'proxy='+version+' node='+process.version
+' platform='+process.platform;
// should be similar to lpm certificate
E.https_servername = 'zproxy.luminati.io';
E.superproxy_domains = ['zproxy.lum-superproxy.io', 'zproxy.luminati.io',
    'zproxy.luminati-china.io'];
E.default = assign({}, lpm_config.luminati_default);
E.dropin = assign({}, E.default, {
    port: E.default.proxy_port,
    listen_port: E.default.proxy_port,
    multiply: false,
    sticky_ip: true,
    pool_size: 0,
    max_requests: 0,
    keep_alive: false,
    session_duration: 0,
    session: false,
    seed: false,
});
const ip_re = /^(https?:\/\/)?(\d+\.\d+\.\d+\.\d+)([$/:?])/i;

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

let is_superproxy_domain = d=>E.superproxy_domains.includes(d);

let reverse_lookup_dns = ip=>etask(function*resolve(){
    try {
        let domains = yield etask.nfn_apply(dns, '.reverse', [ip]);
        return domains&&domains.length ? domains[0] : ip;
    } catch(e){ return ip; }
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
    if (req.headers['x-lpm-src-addr'])
        return req.headers['x-lpm-src-addr'];
    if (req.socket)
    {
        if (req.socket.remoteAddress)
            return req.socket.remoteAddress;
        if (req.socket.socket && req.socket.socket.remoteAddress)
            return req.socket.socket.remoteAddress;
    }
    return null;
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

const ensure_socket_close = socket=>{
    if (!socket)
        return;
    socket.end();
    setTimeout(()=>{
        if (!socket.destroyed)
            socket.destroy();
    }, 10*SEC);
};

function Luminati(opt, mgr){
    events.EventEmitter.call(this);
    this.mgr = mgr||{send_rule_mail: function(){}};
    this.overload = false;
    this.rejected = 0;
    opt.listen_port = opt.listen_port||opt.port||E.default.port;
    this.log = log(opt.listen_port, opt.log);
    this.http = opt.secure_proxy ? https : http;
    let agents = mgr&&mgr.agents;
    if (!agents)
    {
        agents = {
            http: new http.Agent({keepAlive: true, keepAliveMsecs: 5000}),
            https: new https.Agent({keepAlive: true, keepAliveMsecs: 5000,
                servername: E.https_servername}),
        };
    }
    this.protocol = agents[opt.secure_proxy ? 'https' : 'http'];
    opt = this.opt = assign({}, E.default, opt);
    if (opt.rules)
        this.rules = new Rules(this, opt.rules||{});
    this.banlist = new Ip_cache();
    this.router = new Router(opt);
    this.router.on('response', res=>this.emit('response', res));
    this.active = 0;
    this.failure = {};
    this.requests_queue = [];
    this.throttle_queue = [];
    this.http_server = http.createServer((req, res, head)=>{
        if (this.is_overload())
            return this.send_overload(res, 'http_req');
        if (req.headers.host=='trigger.domain' ||
            /^\/hola_trigger/.test(req.url))
        {
            return res.end();
        }
        if (!req.url.startsWith('http:'))
            req.url = 'http://'+req.headers.host+req.url;
        this.sp.spawn(this._handler(req, res, head));
    }).on('connection', socket=>socket.setNoDelay());
    http_shutdown(this.http_server);
    this.socks_server = new Socks({port: opt.port||E.default.port,
        log: opt.log});
    if (opt.ssl)
    {
        this.authorization = {};
        this.req_remote_ip = {};
        this.https_server = https.createServer(
            assign({requestCert: false}, ssl()), (req, res, head)=>{
                if (this.is_overload())
                    return this.send_overload(res, 'https_req');
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
                this.sp.spawn(this._handler(req, res, head));
            }
        ).on('connection', socket=>socket.setNoDelay());
        http_shutdown(this.https_server);
        this.http_server.on('connect', (req, res, head)=>{
            if (this.is_overload())
                return this.send_overload(res, 'http_connect');
            if (parse_ip_url(req.url)||zurl.parse(req.url).port==43)
                return this.sp.spawn(this._handler(req, res, head));
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
            socket.on('error', err=>{
                if (this.is_overload(err))
                    return;
                this.log.error(`Socket error: %O`, {
                    authorization: authorization,
                    error: zerr.e2s(err),
                    port: (this.https_server.address()||{}).port
                });
            });
            res.pipe(socket).pipe(res);
            req.on('end', ()=>socket.end());
        });
    }
    else
    {
        this.http_server.on('connect', (req, res, head)=>this.sp.spawn(
            this._handler(req, res, head)));
    }
    this.tcp_server = new net.createServer(socket=>{
        this.tcp_server.running = true;
        const timeout = this.opt.socket_inactivity_timeout;
        // XXX krzysztof: errors are handled by http/https/socks
        socket.on('error', err=>null);
        socket.on('timeout', ()=>{
            zerr.debug(`No activity on socket ${socket.localAddress}:`
                +`${socket.localPort}-${socket.remoteAddress}:`
                +`${socket.remotePort} - close socket`);
            ensure_socket_close(socket);
        });
        socket.once('data', data=>{
            if (!this.tcp_server.running)
                return socket.end();
            socket.pause();
            const protocol_byte = data[0];
            if (protocol_byte==22)
                this.https_server.emit('connection', socket);
            else if (32<protocol_byte&&protocol_byte<127)
                this.http_server.emit('connection', socket);
            else if (protocol_byte==5)
                this.socks_server.connect(socket);
            else
                socket.end();
            socket.unshift(data);
            socket.resume();
        });
        socket.setTimeout(timeout);
    });
    http_shutdown(this.tcp_server);
    this.on('response', resp=>this._handle_usage(resp));
    if (opt.reverse_lookup_dns===true)
        this.reverse_lookup = reverse_lookup_dns;
    else if (opt.reverse_lookup_file && fs.existsSync(opt.reverse_lookup_file))
    {
        this.reverse_lookup = reverse_lookup_values(
            zfile.read_lines_e(opt.reverse_lookup_file));
    }
    else if (opt.reverse_lookup_values)
        this.reverse_lookup = reverse_lookup_values(opt.reverse_lookup_values);
    this.session_mgr = new sessions.Sess_mgr(this, opt);
    this.session_mgr.on('response', r=>this.emit('response', r));
}

util.inherits(E, events.EventEmitter);

E.prototype._send_rule_mail = function(to, trigger, action, _url){
    return this.mgr.send_rule_mail(this.port, to, trigger, action, _url);
};

E.prototype._handle_usage_start = function(req){
    const uuid = uuid_v4();
    req.ctx.uuid = uuid;
    if (!this.opt.handle_usage_start)
        return;
    const data = {
        uuid,
        port: this.port,
        url: req.url,
        method: req.method,
        headers: req.headers,
        timestamp: Date.now(),
        context: req.ctx.h_context,
    };
    this.opt.handle_usage_start(data);
};

E.prototype._handle_usage = function(response){
    if (!this.opt.handle_usage)
        return;
    if (!response||!response.timeline)
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
    const is_ssl = response.request.url.endsWith(':443')&&
        response.status_code=='200';
    const status_code = is_ssl ? 'unknown' : response.status_code||'unknown';
    const data = {
        uuid: response.uuid,
        port: this.port,
        url: response.request.url,
        method: response.request.method,
        request_headers: stringify(response.request.headers),
        request_body: response.request.body,
        response_headers: stringify(headers),
        response_body: decode_body(response.body,
            response.headers&&response.headers['content-encoding'], 1024),
        status_code,
        status_message: response.status_message,
        timestamp: response.timeline.get('create'),
        elapsed: response.timeline.get_delta('end'),
        response_time: response.timeline.get_delta('response'),
        proxy_peer: proxy_info[1]||headers['x-hola-ip'],
        country: proxy_info[2],
        timeline: stringify(response.timeline.req_chain),
        content_size: response.body_size,
        context: response.context,
        remote_address: response.remote_address,
    };
    if (response.proxy)
    {
        data.super_proxy = response.proxy.host;
        data.username = response.proxy.username;
        data.password = response.proxy.password;
    }
    if (response.success)
        data.success = +response.success;
    data.in_bw = response.in_bw;
    data.out_bw = response.out_bw;
    this.opt.handle_usage(data);
};

E.prototype.refresh_ip = etask._fn(function*lum_refresh_ip(_this, ctx, ip){
    if (!_this.opt.ips.includes(ip))
        return;
    _this.log.notice('Refreshing IP %s', ip);
    ctx.timeline.refresh_ip(ip);
    const allocated_ips = yield _this.mgr.request_allocated_ips(
        _this.opt.zone);
    const new_ips = yield _this.mgr.refresh_ips(_this.opt.zone,
        zurl.ip2num(ip));
    if (new_ips.error)
        return _this.log.warn('Refresgin IP failed: %s', new_ips.error);
    const ips_map = map_ips(allocated_ips.ips, new_ips.ips.map(i=>i.ip));
    _this.opt.ips = _this.opt.ips.map(_ip=>ips_map[_ip]);
    _this.config.ips = _this.opt.ips;
    _this.mgr.proxies.find(p=>p.port==_this.port).ips = _this.opt.ips;
    _this.mgr.save_config();
    _this.session_mgr.refresh_sessions();
    ctx.timeline.finish_refresh_ip();
    _this.log.notice('IP has been refreshed %s->%s', ip, ips_map[ip]);
});

function map_ips(old_ips, new_ips){
    if (old_ips.length!=new_ips.length)
    {
        throw new Error('Refreshing IPs Error. List length mismatch %s!=%s',
            old_ips.length, new_ips.length);
    }
    const map = {};
    for (let i in old_ips)
        map[old_ips[i]] = new_ips[i];
    return map;
}

E.prototype.get_other_port = function(port){
    if (!this.mgr)
        return null;
    return this.mgr.get_server(port);
};

E.prototype._handler = etask._fn(
function*_handler(_this, req, res, head){
    if (_this.is_overload())
        return _this.send_overload(res, 'handler');
    this.finally(()=>_this.complete_req(this.error, req, res));
    req.on('close', ()=>this.return());
    req.on('finish', ()=>this.return());
    try {
        req._queued = Date.now();
        _this.active++;
        _this.emit('idle', false);
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
                _this.log.debug('Request ip not in whitelist %s %s',
                    req.url, ip);
                write_http_reply(res, {
                    statusCode: 403,
                    statusMessage: 'Forbidden',
                    headers: {Connection: 'close'},
                });
                res.end();
                return;
            }
        }
        this.info.url = req.url;
        if (_this.opt.throttle && _this.active>_this.opt.throttle)
        {
            _this.log.debug('Placing request on throttle queue');
            _this.throttle_queue.push(this);
            yield this.wait();
        }
        if (_this.hosts&&_this.hosts.length)
            return yield _this._request(req, res, head);
        _this.requests_queue.push([req, res, head]);
    } catch(e){
        _this.log.debug('_handler error %s', zerr.e2s(e));
        throw e;
    }
});

E.prototype.complete_req = function(err, req, res){
    if (err)
        this.log.debug('complete err %s', zerr.e2s(err));
    if (err&&this.is_overload(err))
        this.send_overload(res, 'complete');
    else if (err && err.proxy_error)
        this.send_proxy_error(req, res, err);
    else if (err)
        this.send_lpm_error(req, res, err);
    this.log.debug('complete req %s, active: %s', req.ctx.id, this.active);
    this.active--;
    if (!this.active)
    {
        this.emit('idle', true);
        return;
    }
    if (this.throttle_queue.length)
    {
        this.log.debug('Taking request from throttle queue');
        this.throttle_queue.shift().continue();
    }
};

E.prototype.error_handler = function error_handler(source, err){
    if (this.is_overload(err))
        return;
    this.log.error(source+' error '+zerr.e2s(err));
    let {code} = err;
    if (code=='EADDRINUSE')
    {
        err = new Error(`There's already an application which runs on `+
            `${err.address}:${err.port}`);
        err.raw = true;
        err.code = code;
    }
    err.lum_source = source;
    if (this.listenerCount('error'))
        this.emit('error', err);
    else
        throw err;
};

E.prototype.listen = etask._fn(function*listen(_this, listen_port, hostname){
    _this.proxy = [].concat(_this.opt.proxy);
    _this.session_mgr.start();
    _this.resolve_proxy();
    if (!_this.sp)
    {
        _this.sp = etask(function*luminati_listen(){
            return yield this.wait();
        });
    }
    _this.sp.spawn(_this.session_mgr.sp);
    listen_port = listen_port||_this.opt.listen_port||0;
    hostname = hostname||find_iface(_this.opt.iface);
    if (!hostname)
    {
        hostname = '0.0.0.0';
        _this.opt.iface = '0.0.0.0';
    }
    _this.port = listen_port;
    yield _this.socks_server.set_tcp_server(_this.tcp_server);
    yield etask.nfn_apply(_this.tcp_server, '.listen',
        [listen_port, hostname]);
    const _http = _this.http_server;
    const _https = _this.https_server;
    _http.on('error', err=>_this.error_handler('HTTP', err));
    if (_https)
    {
        _https.on('error', err=>_this.error_handler('HTTPS', err));
        yield etask.nfn_apply(_https, '.listen', [0, '127.0.0.1']);
        _this.log.debug('HTTPS port: '+_https.address().port);
    }
    _this.emit('ready');
    return _this;
});

E.prototype.stop = etask._fn(function*stop(_this, force){
    if (_this.stopped)
        return;
    if (_this.sp)
    {
        _this.sp.return();
        _this.sp = null;
    }
    _this.session_mgr.stop();
    _this.stopped = true;
    _this.socks_server.stop(force);
    const tasks = {};
    if (_this.protocol)
        _this.protocol.destroy();
    const stop_method = force ? '.forceShutdown' : '.shutdown';
    const tcp = etask(function*(){
        this.on('uncaught', e=>_this.log.error(`Closing TCP: ${e.message}`));
        _this.tcp_server.running = false;
        try { yield etask.nfn_apply(_this.tcp_server, stop_method, []); }
        catch(e){
            _this.log.warn(`Closing TCP: ${e.message}`);
            _this.tcp_server.unref();
        }
    });
    if (_this.https_server)
        tasks.https = etask.nfn_apply(_this.https_server, stop_method, []);
    yield tcp;
    yield etask.all(tasks);
    return _this;
});

E.prototype._check_proxy_response = function _check_proxy_response(proxy,
    res, context)
{
    let err = new Error();
    let status_code = res.status_code || res.statusCode || 0;
    if (res.headers&&res.headers['x-luminati-error'])
    {
        err.message = res.headers['x-luminati-error'];
        err.code = status_code;
        err.retry = false;
        err.proxy_error = true;
        if (err.code == 502 && err.message.match(/^Proxy Error/))
            err.retry = true;
    }
    if (!err.message)
    {
        delete this.failure[proxy];
        return false;
    }
    if (!this.opt.proxy_switch)
        return err;
    let failures = this.failure[proxy] = (this.failure[proxy]||0)+1;
    this.log.warn('invalid proxy response %O',
        {host: proxy, code: status_code, context: context});
    if (failures>=this.opt.proxy_switch)
    {
        this.log.warn('removing failed proxy server %O', {host: proxy});
        this.sp.spawn(this.remove_proxy(proxy));
    }
    return err;
};

E.prototype.remove_proxy = etask._fn(function*remove_proxy(_this, proxy){
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
    const hosts = {};
    const proxies = _this.proxy.slice();
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
            _this.log.debug('using super proxy %s', proxy);
            hosts[proxy] = false;
            continue;
        }
        proxies.push(proxy);
        let domain = proxy;
        if (proxy.length==2)
            domain = lpm_config.default_superproxy_domain;
        if (is_superproxy_domain(domain))
        {
            domain = `customer-${_this.opt.customer}-`
                +`session-${Date.now()}.${domain}`;
        }
        try {
            _this.log.debug('resolving proxies from %s', domain);
            ips = ips || (yield etask.nfn_apply(dns, '.resolve', [domain]));
            _this.log.debug('resolved %s (%s) %O', proxy, domain, ips);
            ips.forEach(ip=>hosts[ip] = proxy);
        } catch(e){
            _this.log.debug('Failed to resolve %s (%s): %s', proxy, domain,
                zerr.e2s(e));
        }
    }
    _this.hosts = _.shuffle(Object.keys(hosts));
    if (_this.opt.proxy_cache)
        yield _this.opt.proxy_cache.add(_.toPairs(hosts).filter(p=>p[1]));
    if (!_this.hosts.length)
        _this.log.error('Failed to resolve any proxies');
    _this.resolving_proxies = false;
    let queue = _this.requests_queue;
    _this.requests_queue = [];
    queue.forEach(args=>_this._request.apply(_this, args));
});

E.prototype.get_req_host = etask._fn(function*get_req_host(_this, req){
    const {ctx} = req;
    // XXX maximk: watch for resolving hosts here
    if (!ctx.session || !ctx.session.host)
        yield true;
    return ctx.session&&ctx.session.host||_this.hosts[0];
});

E.prototype.perr = function(id, info, opt){
    let rc = this.mgr.rmt_cfg.get();
    if (info instanceof Error)
        info = {error: info};
    info = Object.assign(
        {opt: this.opt, overloaded: this.is_overload()},
        info||{}
    );
    if (rc.send_proxy_perr)
    {
        if (this.mgr)
            return this.mgr.perr(id, info, opt);
        return zerr.perr(id, info, opt);
    }
    return false;
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

E.prototype.init_proxy_req = etask._fn(
function*init_proxy_req(_this, req, res){
    const {ctx} = req;
    ctx.init_stats();
    ctx.session = _this.session_mgr.request_session(req);
    ctx.host = yield _this.get_req_host(req);
    if (_this.router.is_bypass_proxy(req))
        return;
    ctx.proxy_port = ctx.session&&ctx.session.proxy_port || ctx.proxy_port;
    ctx.cred = _this.session_mgr.get_req_cred(req);
    res.cred = ctx.cred.username;
    ctx.log.info('requesting using %s', ctx.cred.username);
    ctx.response.proxy = {
        host: ctx.host,
        username: ctx.cred.username,
        password: ctx.cred.password,
    };
    ctx.connect_headers = {
        'proxy-authorization': 'Basic '+
            new Buffer(ctx.cred.username+':'+ctx.cred.password)
            .toString('base64'),
    };
    if (!ctx.ext_proxy)
    {
        let agent = E.hola_agent;
        const auth = username.parse(ctx.h_proxy_authorization);
        if (auth&&auth.tool)
            agent = agent+' tool='+auth.tool;
        ctx.connect_headers['x-hola-agent'] = agent;
    }
});

E.prototype._request = etask._fn(function*_request(_this, req, res, head){
    const ctx = Context.init_req_ctx(req, res, _this, _this.opt);
    this.finally(()=>ctx.complete_req());
    try {
        // XXX maximk: hack to track detached retry etasks
        if (ctx.req_sp)
            ctx.req_sp.spawn(this);
        if (!ctx.req_sp)
            ctx.req_sp = this;
        if (_this.is_overload())
            throw new Error('overload');
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
        ctx.init_response(req, res, head);
        if (ctx.is_connect && parse_ip_url(ctx.url))
        {
            ctx.log.warn(`HTTPS connection to IP: %s`, ctx.url);
            // XXX maximk: show only if no ip perm
            ctx.log.warn(
                'HTTPS connection to IP will be done from super agent');
        }
        const remote = req.socket.remoteAddress+':'+req.socket.remotePort;
        const netstat_cmd = `netstat -antp 2>/dev/null | grep "${remote}"`;
        let pid;
        if (!lpm_config.is_win && req.socket.remoteAddress=='127.0.0.1')
        {
            try {
                const stdout = child_process.execSync(netstat_cmd);
                pid = stdout.toString().split('\n').filter(Boolean)
                .map(s=>s.replace(/\s+/g, ' ').split(' '))
                .find(r=>r[3]==remote);
            } catch(e){ pid = ''; }
        }
        _this._handle_usage_start(req);
        let resp;
        if (ctx.rules)
            resp = yield ctx.rules.pre(req, res, head);
        if (!resp)
        {
            yield _this.init_proxy_req(req, res);
            resp = yield _this.route_req(req, res, head);
        }
        if (resp instanceof Error)
            throw resp;
        if (!resp)
            throw new Error('invalid_response');
        if (ctx.wait_bw)
            yield this.wait_ext(ctx.wait_bw);
        resp.remote_address = pid ? `${remote}, ${pid[6]}` : remote;
        resp.uuid = req.ctx.uuid;
        const auth = username.parse(ctx.h_proxy_authorization);
        if (auth&&auth.tool=='proxy_tester')
            resp.context = 'PROXY TESTER TOOL';
        _this.emit('response', resp);
        ctx.req_sp.return(resp);
    } catch(e){
        ctx.log.debug('_request err %s', zerr.e2s(e));
        if (e.message&&e.message.match(/(invalid_response|hang up)/))
            _this.perr(e);
        return ctx.req_sp.throw(e);
    }
});

E.prototype.add_headers = function(req){
    const added_headers = {};
    if (this.opt.random_user_agent)
    {
        const ua_version = Math.floor(Math.random()*2240)+1000;
        const user_agent = `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_2`
        +`) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/63.0.`
        +`${ua_version}.132 Safari/537.36`;
        added_headers['user-agent'] = user_agent;
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
        const {ctx} = req;
        ctx.log.info('%s:%s - %s %s', req.socket.remoteAddress,
            req.socket.remotePort, req.method, ctx.url);
        // XXX maximk: make sure this is handled in init function instead
        if (!_this.hosts.length)
        {
            if (_this.resolving_proxies)
                return _this.requests_queue.push([req, res, head]);
            return this.throw(new Error('No hosts when processing request'));
        }
        if (_this.router.is_bypass_proxy(req))
            this.spawn(_this.send_bypass_req(req, res, head));
        else
        {
            this.spawn(_this.send_proxy_req(this, req, res, head, ctx.host));
            for (let i=1; i<ctx.race_reqs; i++)
            {
                ctx.log.debug('racing req %s', i);
                this.spawn(
                    _this.send_proxy_req(this, req, res, head, ctx.host));
            }
        }
        let resp = yield this.wait_child('any');
        // XXX maximk: sometimes retval is not returned directly, why?
        if (resp && resp.child && resp.child.retval)
            return resp.child.retval;
        return resp;
    } catch(e){
        if (_this.is_overload(e))
            return new Error('overload');
        _this.log.debug('route req error %s', zerr.e2s(e));
        return e;
    }
});

E.prototype.send_proxy_req = function(task, req, res, head, host){
    if (req.ctx.is_ssl)
        return this.send_proxy_req_ssl(task, req, res, head, host);
    return this.send_proxy_req_http(task, req, res, head, host);
};

E.prototype._request_handler = etask._fn(
function*_request_handler(_this, req, res, proxy, head, _headers){
    const ctx = req&&req.ctx;
    const ensure_end_task = ()=>setTimeout(()=>{
        if (etask.is_final(this))
            return;
        _this.log.debug('_request_handler: force etask end: socket closed');
        this.return(ctx&&ctx.response);
    }, 10*SEC);
    try {
        this.on('cancel', ()=>_this._abort_proxy_req(req, proxy, this));
        if (proxy.setTimeout)
            proxy.setTimeout(ctx.timeout);
        proxy.on('response', _this._handle_proxy_resp(req, res, proxy, this,
            head, _headers))
        .on('connect', _this._handle_proxy_connect(req, res, proxy, this,
            head))
        .on('error', _this._handle_proxy_error(req, res, proxy, this, head))
        .on('timeout', _this._handle_proxy_timeout(req, res, proxy, head,
            this))
        .on('close', ensure_end_task);
        return yield this.wait();
    } catch(e){
        if (_this.is_overload(e))
            return new Error('overload');
        if (ctx && ctx.pool_key)
            _this.session_mgr.remove_session(ctx.session);
        _this.log.debug('request_handle error %s', zerr.e2s(e));
        return e;
    }
});

E.prototype.send_bypass_req = etask._fn(
function*send_bypass_req(_this, req, res, head){
    const ctx = req.ctx;
    let proxy;
    if (ctx.is_connect)
    {
        const parts = ctx.url.split(':');
        ctx.response.request.url = `https://${ctx.url}/`;
        proxy = net.connect({host: parts[0], port: +parts[1]});
        proxy.setTimeout(ctx.timeout);
        proxy.on('connect', ()=>{
            ctx.timeline.track('direct_connect');
            ctx.log.debug('DIRECT CONNECT - %s', ctx.url);
            write_http_reply(res, {statusCode: 200, statusMessage: 'OK'});
            res.pipe(proxy).pipe(res);
            this.return(ctx.response);
        }).on('timeout',
            _this._handle_proxy_timeout(req, res, proxy, head, this));
        ctx.log.debug('direct proxy CONNECT');
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
            ctx.timeline.track('direct_connect');
            _res.on('error', this.throw_fn());
            socket.on('error', this.throw_fn());
            ctx.log.debug('DIRECT REQUEST - %s', ctx.url);
        });
        // XXX jesse remove duplication of this block
        if (ctx.response.request.body)
            proxy.write(ctx.response.request.body);
        req.pipe(proxy);
        ctx.log.debug('direct proxy');
    }
    proxy.on('close', ()=>{
        ctx.timeline.track('end');
        this.return(ctx.response);
    }).on('error', this.throw_fn());
    if (!ctx.is_connect)
        return yield _this._request_handler(req, res, proxy, head);
    return yield this.wait();
});

E.prototype.send_proxy_req_ssl = etask._fn(
function*send_proxy_req_ssl(_this, task, req, res, head, host){
    const ctx = req.ctx;
    try {
        ctx.response.request.url = ctx.url;
        _this.http.request({
            host: host,
            port: ctx.proxy_port,
            method: 'CONNECT',
            path: ctx.domain+':443',
            headers: ctx.format_headers(ctx.connect_headers),
            agent: ctx.agent,
            rejectUnauthorized: !_this.opt.insecure,
        })
        .on('connect', (_res, socket, _head)=>{
            this.continue({res: _res, socket, head: _head});
        })
        .on('error', this.throw_fn())
        .end();
        const conn = yield this.wait();
        if (conn.res.statusCode!=200)
        {
            let proxy_err = _this._check_proxy_response(host, conn.res,
                {from: 'error', error: new Error(conn.res.statusMessage)});
            let can_retry = ctx.rules && ctx.rules.can_retry(
                req, ctx.response, {retry: ctx.proxy_retry});
            if (can_retry && proxy_err && proxy_err.retry)
            {
                ctx.log.warn('error proxy %s response, status: %s, retrying',
                    host, conn.res.statusCode);
                ctx.rules.retry(req, res, head);
                return yield this.wait();
            }
            if (proxy_err)
            {
                req.ctx.log.warn('proxy api err %s: %s', proxy_err.code,
                    proxy_err.message);
                throw proxy_err;
            }
        }
        if (ctx.banlist)
        {
            let tl = (conn.res.headers['x-hola-timeline-debug']||'')
                .split(' ');
            let ip = tl && tl.length>=3 && tl[3];
            if (ip && ctx.banlist.has(ip))
            {
                ctx.log.info('ip_banned %s', ip);
                req.session = ctx.rules.gen_session();
                ctx.rules.retry(req, res, head);
                return yield this.wait();
            }
        }
        if (ctx.session)
            _this.session_mgr.is_session_expired(ctx.session, true);
        ctx.timeline.track('connect');
        conn.res.on('error', this.throw_fn());
        conn.socket.on('error', this.throw_fn());
        const proxy = https.request({
            host: ctx.headers.host,
            method: req.method,
            path: req.url,
            headers: ctx.format_headers(ctx.headers),
            proxyHeaderWhiteList: E.hola_headers,
            proxyHeaderExclusiveList: E.hola_headers,
            socket: conn.socket,
            agent: false,
            rejectUnauthorized: !_this.opt.insecure,
        });
        proxy.host = host;
        ctx.proxies.push(proxy);
        // XXX jesse remove duplication of this block
        if (ctx.response.request.body)
            proxy.write(ctx.response.request.body);
        req.pipe(proxy);
        req.on('end', req._onend = ()=>proxy.end());
        if (conn.res.headers['x-hola-timeline-debug'])
        {
            ctx.log.info('timeline-debug %s',
                conn.res.headers['x-hola-timeline-debug']);
        }
        return yield _this._request_handler(req, res, proxy, head,
            conn.res.headers);
    } catch(e){
        if (_this.is_overload(e))
            return new Error('overload');
        _this.log.error('send proxy ssl error %s', zerr.e2s(e));
        return e;
    }
});

E.prototype.send_proxy_req_http = etask._fn(
function*send_proxy_req_http(_this, task, req, res, head, host){
    try {
        const ctx = req.ctx;
        const proxy = _this.http.request({
            host: host,
            port: ctx.proxy_port,
            method: req.method,
            path: ctx.url,
            agent: ctx.agent,
            headers: ctx.format_headers(assign(ctx.connect_headers,
                ctx.headers)),
            proxyHeaderWhiteList: E.hola_headers,
            proxyHeaderExclusiveList: E.hola_headers,
            rejectUnauthorized: !_this.opt.insecure,
        });
        proxy.host = host;
        ctx.proxies.push(proxy);
        if (ctx.is_connect)
            proxy.end();
        else
        {
            // XXX jesse remove duplication of this block
            if (ctx.response.request.body)
                proxy.write(ctx.response.request.body);
            req.pipe(proxy);
            req.on('end', req._onend = ()=>!proxy.aborted&&proxy.end());
        }
        return yield _this._request_handler(req, res, proxy, head);
    } catch(e){
        _this.log.debug('send_proxy_req error %s', zerr.e2s(e));
        return e;
    }
});

E.prototype._handle_proxy_timeout = function(req, res, proxy, head, task){
    return ()=>{
        const ctx = req.ctx;
        ctx.log.debug('handle_proxy_timeout');
        ensure_socket_close(proxy);
        task.throw(new Error(`${req.method} ${ctx.url} - socket inactivity`
            +` timeout ${ctx.timeout}ms`));
        if (ctx.rules && !res.resp_written && ctx.rules.can_retry(req))
            ctx.rules.post_timeout(req, res, head);
    };
};

E.prototype._handle_proxy_resp = function(req, res, proxy, task, head,
    _headers)
{
    return _res=>{
        if (proxy.aborted)
            return;
        const ctx = req.ctx;
        ctx.log.debug('handle_proxy_resp');
        if (ctx.responded)
            return this._abort_proxy_req(req, proxy, task);
        ctx.proxies.forEach(p=>p!=proxy&&this._abort_proxy_req(req, p));
        ctx.responded = true;
        const count$ = create_count_stream(ctx.response);
        try {
            ctx.timeline.track('response');
            ctx.log.info(`${req.method} ${ctx.url} - ${_res.statusCode}`);
            if (ctx.session)
            {
                ctx.session.last_res = {ts: Date.now(), ip:
                    _res.headers['x-hola-ip'], session: ctx.session.session};
            }
            if (ctx.rules)
            {
                _res.hola_headers = _headers;
                if (res.resp_written || !ctx.rules.can_retry(req));
                else if (ctx.rules.post(req, res, head, _res, true))
                    return this._abort_proxy_req(req, proxy);
                else if (ctx.rules.post_need_body(req))
                {
                    ctx.response.body_wait = true;
                    ctx.response._res = _res;
                    _res.on('data', data=>ctx.response.body.push(data));
                    _res.on('end', ()=>{
                        if (ctx.rules.post_body(req, res, head, _res,
                            ctx.response.body))
                        {
                            return this._abort_proxy_req(req, proxy);
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
                        task.return(ctx.response);
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
                task.return(ctx.response);
            }).on('error', task.throw_fn());
        } catch(e){ task.throw(e); }
    };
};

E.prototype._handle_proxy_connect = function(req, res, proxy, task, head){
    return (_res, socket, _head)=>{
        if (proxy.aborted)
            return;
        const ctx = req.ctx;
        ctx.log.debug('handle_proxy_connect');
        if (ctx.connected)
            return this._abort_proxy_req(req, proxy);
        ctx.proxies.forEach(p=>p!=proxy&&this._abort_proxy_req(req, p));
        ctx.connected = true;
        const count$ = create_count_stream(ctx.response);
        const end_sock = socket.end.bind(socket);
        try {
            ctx.timeline.track('connect');
            ctx.log.debug('CONNECT - %s', _res.statusCode);
            let proxy_err = this._check_proxy_response(ctx.host, _res,
                'connect');
            if (proxy_err)
            {
                req.ctx.log.warn('proxy api err %s: %s', proxy_err.code,
                    proxy_err.message);
                return task.throw(proxy_err);
            }
            write_http_reply(res, _res);
            assign(ctx.response, {
                status_code: _res.statusCode,
                headers: _res.headers,
            });
            if (_res.statusCode!=200)
            {
                ctx.log.error('%s %s - %s', req.method, ctx.url,
                    _res.statusCode);
                res.end();
                return task.return(ctx.response);
            }
            if (ctx.session)
                this.session_mgr.is_session_expired(ctx.session, true);
            socket.write(head);
            res.write(_head);
            socket.pipe(count$).pipe(res).pipe(socket);
            _res.on('error', e=>{
                this.session_mgr.removeListener('refresh_sessions', end_sock);
                task.throw(e);
            });
            socket.on('error', err=>{
                ctx.log.error('Request socket error %s', zerr.e2s(err));
                if (this.is_overload({code: _res.statusMessage},
                    _res.statusCode))
                {
                    return task.throw(new Error('overload'));
                }
            }).on('end', ()=>{
                if (ctx.timeline.get('end'))
                    return task.return();
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

E.prototype._abort_proxy_req = function(req, proxy, task){
    req.unpipe(proxy);
    proxy.abort();
    proxy.destroy();
    if (task)
        task.return('abort');
    // XXX krzysztof: fix waterfall
    if (this.opt.handle_abort)
        this.opt.handle_abort(req.ctx.uuid);
};

E.prototype.is_overload = function(err, status){
    const overload_errors = ['EMFILE', 'overload'];
    if (err)
    {
        if (typeof err == 'string')
            err = {message: err};
        for (let i=0; i<overload_errors.length; i++)
        {
            let oerr = overload_errors[i];
            if ((err.code||'') == oerr)
                return true;
            if ((err.message||'').includes(oerr))
                return true;
            if ((err.error||'').includes(oerr))
                return true;
        }
    }
    if (status == 503)
        return true;
    if (!err && this.overload)
        return true;
    return false;
};

E.prototype.send_overload = function(res, context){
    this.rejected++;
    this.log.info('%s, overloaded, rejected %d', context, this.rejected);
    write_http_reply(res, {statusCode: 503, statusMessage: 'LPM - Overloaded',
        headers: {Connection: 'close'}});
    res.end();
    if (res.destroy)
        res.destroy();
    if (res.socket)
        res.socket.destroy();
};

E.prototype.send_proxy_error = function(req, res, err){
    if (!res.ended)
    {
        write_http_reply(res, {statusCode: 502, statusMessage:
            'LPM - Proxy Error', headers: {Connection: 'close',
            'x-lpm-error': err.message}});
    }
    res.end();
};

E.prototype.send_lpm_error = function(req, res, err){
    if (!(err.code||'').includes('ECONNRESET'))
    {
        this.log.warn(`complete req %s %s %s`, req.method,
            req.url, err.message);
    }
    if (!res.ended)
    {
        write_http_reply(res, {statusCode: 502, statusMessage:
            'LPM - Bad Gateway', headers: {Connection: 'close',
            'x-lpm-error': err.message}});
    }
    res.end();
};

E.prototype._handle_proxy_error= function(req, res, proxy, task, head){
    return err=>{
        const ctx = req.ctx;
        ctx.log.debug('handle_proxy_err %s', zerr.e2s(err));
        if (proxy.aborted||ctx.responded||ctx.connected)
            return;
        if (this.is_overload(err))
        {
            this._abort_proxy_req(req, proxy);
            return task.throw(new Error('overload'));
        }
        let proxy_err = this._check_proxy_response(ctx.host,
            res||{statusCode: 502}, {from: 'error', error: err});
        let can_retry = ctx.rules && ctx.rules.can_retry(req, ctx.response, {
            retry: ctx.proxy_retry});
        if (proxy_err && proxy_err.can_retry && can_retry)
        {
            ctx.log.warn('error proxy response %s, retrying', ctx.host);
            ctx.rules.retry(req, res, head);
            this._abort_proxy_req(req, proxy);
            return;
        }
        this._abort_proxy_req(req, proxy);
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

E.prototype.banip = function(ip, ms){
    if (!this.banlist)
        return false;
    this.banlist.add(ip, ms);
    return true;
};

E.prototype.unban = function(ip, ms){
    if (!this.banlist)
        return false;
    if (!this.banlist.has(ip))
        return false;
    this.banlist.delete(ip);
    return true;
};

E.prototype.set_overload = function(overload){
    this.overload = overload;
    this.rejected = 0;
};

E.hola_headers = qw`proxy-connection proxy-authentication x-hola-agent
    x-hola-debug x-hola-tunnel-key x-hola-tunnel-ip x-hola-tunnel-session
    x-hola-auth x-hola-unblocker-debug x-hola-session x-hola-cid
    x-hola-country x-hola-forbid-peer x-hola-dst-ips x-hola-ip x-hola-vip
    x-hola-immediate x-hola-dns-only x-hola-response x-hola-direct-first
    x-hola-direct-discover x-hola-blocked-response x-hola-conf
    x-hola-headers-only x-hola-unblocker-bext x-hola-dynamic-tunnels
    x-hola-context x-luminati-timeline x-luminati-peer-timeline`;

class Ip_cache {
    constructor(){ this.cache = new Map(); }
    add(ip, ms){
        let cache = this.cache, c = cache.get(ip);
        if (!c)
            c = cache.set(ip, {ip: ip}).get(ip);
        else
            clearTimeout(c.to);
        if (ms)
            c.to = setTimeout(()=>cache.delete(c.ip), ms);
    }
    delete(ip){ this.cache.delete(ip); }
    has(ip){ return this.cache.has(ip); }
}
E.Ip_cache = Ip_cache;
