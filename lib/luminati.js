// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/
const _ = require('lodash');
const events = require('events');
const http = require('http');
const https = require('https');
const dns = require('dns');
const url = require('url');
const tls = require('tls');
const net = require('net');
const os = require('os');
const stream = require('stream');
const request = require('request');
const request_stats = require('request-stats');
const util = require('util');
const log = require('./log.js');
const parse_username = require('./parse_username.js');
const http_shutdown = require('http-shutdown');
const Socks = require('./socks.js');
const hutil = require('hutil');
const version = require('../package.json').version;
const etask = hutil.etask;
const qw = hutil.string.qw;
const assign = Object.assign;
module.exports = Luminati;
Luminati.default = {
    port: 24000,
    iface: '0.0.0.0',
    zone: process.env.LUMINATI_ZONE||'gen',
    log: 'ERROR',
    proxy: 'zproxy.luminati.io',
    proxy_port: 22225,
    proxy_count: 1,
    session_init_timeout: 5,
    allow_proxy_auth: false,
    pool_type: 'sequential',
};
let lumtest = {failures: 0};

let write_http_reply = (stream, res, headers)=>{
    headers = assign(headers||{}, res.headers||{});
    if (stream instanceof http.ServerResponse)
        return stream.writeHead(res.statusCode, res.statusMessage, headers);
    let head = `HTTP/1.1 ${res.statusCode} ${res.statusMessage}\r\n`;
    for (let field in headers)
        head += `${field}: ${headers[field]}\r\n`;
    stream.write(head+'\r\n');
};

let calculate_username = opt=>{
    let username = `lum-customer-${opt.customer}-zone-${opt.zone}`;
    if (opt.country)
        username += `-country-${opt.country}`;
    if (opt.state)
        username += `-state-${opt.state}`;
    if (opt.city)
        username += `-city-${opt.city}`;
    if (opt.session)
        username += `-session-${opt.session}`;
    if (opt.asn)
        username += `-asn-${opt.asn}`;
    if (opt.dns)
        username += `-dns-${opt.dns}`;
    if (opt.request_timeout)
        username += `-timeout-${opt.request_timeout}`;
    if (opt.cid)
        username += `-cid-${opt.cid}`;
    if (opt.ip)
        username += `-ip-${opt.ip}`;
    if (opt.raw)
        username += '-raw';
    if (opt.direct)
        username += '-direct';
    if (opt.debug)
        username += `-debug-${opt.debug}`;
    return username;
};

const parse_authorization = header=>{
    if (!header)
        return;
    let m = header.match(/^Basic (.*)/);
    if (!m)
        return;
    header = new Buffer(m[1], 'base64').toString('ascii');
    let parts = header.split(':');
    let auth = parse_username(parts[0]);
    auth.password = parts[1];
    return auth;
};

function Luminati(opt){
    events.EventEmitter.call(this);
    this.http = opt.secure_proxy ? https : http;
    this.protocol = {
        http: new http.Agent({keepAlive: true, keepAliveMsecs: 5000}),
        https: new https.Agent({keepAlive: true, keepAliveMsecs: 5000,
            servername: 'zproxy.luminati.io'}),
    }[opt.secure_proxy ? 'https' : 'http'];
    opt = this.opt = _.assign({}, Luminati.default, opt);
    if (opt.max_requests || opt.session_duration || opt.keep_alive)
        opt.pool_size = opt.pool_size||1;
    if (opt.session_duration)
    {
        this.session_duration = (''+opt.session_duration).split(':')
            .map(i=>+i*1000);
    }
    this._log = log(opt.port, opt.log);
    this.round_robin = opt.pool_type=='round-robin';
    this.stats = {};
    this.reset_total_stats = ()=>{
        for (var key in this.stats)
        {
            this.stats[key].total_requests = 0;
            this.stats[key].total_inbound = 0;
            this.stats[key].total_outbound = 0;
        }
    };
    this.active = 0;
    this.failure = {};
    this.requests_queue = [];
    this.throttle_queue = [];
    this.session_id = 1;
    this.sticky_sessions = {};
    this.keep_alive = opt.keep_alive && opt.keep_alive*1000;
    this.session_init_timeout = opt.session_init_timeout*1000;
    if (opt.socks)
    {
        this.socks_server = new Socks({local: opt.socks, remote: opt.port,
            log: opt.log});
    }
    const on_connection = socket=>socket.setNoDelay();
    this.http_server = http.createServer((req, res, head)=>{
        if (req.headers.host=='trigger.domain' ||
            /^\/hola_trigger/.test(req.url))
        {
            return res.end();
        }
        if (!req.url.startsWith('http:'))
            req.url = 'http://'+req.headers.host+req.url;
        this._handler(req, res, head);
    }).on('connection', on_connection);
    http_shutdown(this.http_server);
    if (this.opt.ssl)
    {
        this.authorization = {};
        this.https_server = https.createServer(this.opt.ssl,
            (req, res, head)=>{
                let authorization = this.authorization[req.socket.remotePort];
                if (authorization)
                    req.headers['proxy-authorization'] = authorization;
                this._handler(req, res, head);
            }
        ).on('connection', on_connection);
        http_shutdown(this.https_server);
        this.http_server.on('connect', (req, res, head)=>{
            write_http_reply(res, {statusCode: 200, statusMessage: 'OK'});
            const socket = net.connect({host: '127.0.0.1',
                port: this.https_server.address().port});
            on_connection(socket);
            socket.setNoDelay();
            let port, authorization = req.headers['proxy-authorization'];
            if (authorization)
            {
                socket.on('connect', ()=>{
                    port = socket.localPort;
                    this.authorization[port] = authorization;
                }).on('close', ()=>delete this.authorization[port]);
            }
            socket.on('error', err=>this._log('ERROR', 'Socket error:', {
                authorization: authorization,
                error: err,
                port: this.https_server.address().port
            }));
            res.pipe(socket).pipe(res);
            req.on('end', ()=>socket.end());
        });
    }
    else
        this.http_server.on('connect', this._handler.bind(this));
}

util.inherits(Luminati, events.EventEmitter);
Luminati.prototype._handler = etask._fn(
function*_handler(_this, req, res, head){
    _this.active++;
    _this.emit('idle', false);
    this.on('ensure', ()=>{
        if (this.error)
        {
            _this._log('ERROR', `${req.method} ${req.url} - ${this.error}`);
            if (!res.ended)
            {
                write_http_reply(res, {statusCode: 502, statusMessage:
                    'Bad Gateway', headers: {Connection: 'close'}});
            }
            res.end();
        }
        if (--_this.active)
        {
            if (_this.throttle_queue.length)
            {
                _this._log('DEBUG', 'Taking request from throttle queue');
                _this.throttle_queue.shift().continue();
            }
            return;
        }
        _this.emit('idle', true);
    });
    req.on('error', this.throw_fn());
    req.on('timeout', ()=>this.throw(new Error('request timeout')));
    this.info.url = req.url;
    if (_this.opt.throttle && _this.active>_this.opt.throttle)
    {
        _this._log('DEBUG', 'Placing request on throttle queue');
        _this.throttle_queue.push(this);
        yield this.wait();
    }
    if (_this.opt.pool_size && !req.headers['proxy-authorization'])
    {
        if (!_this.sessions)
        {
            _this.sessions = [];
            yield _this._pool(_this.opt.pool_size);
            _this._log('DEBUG', `initialized pool - ${_this.opt.pool_size}`);
            _this._pool_ready = true;
        }
        else
        {
            if (_this._pool_ready)
            {
                if (!_this.sessions.length)
                {
                    _this._log('WARNING', 'pool size is too small');
                    yield _this._pool(1);
                }
            }
            for (;; yield etask.sleep(1000))
            {
                if (!_this._pool_ready)
                    continue;
                if (_this.sessions.length)
                    break;
                _this._log('WARNING', 'pool size is too small');
                yield _this._pool(1);
                break;
            }
        }
    }
    if (_this.hosts.length)
        return yield _this._request(req, res, head);
    _this.requests_queue.push([req, res, head]);
});

const find_iface = iface=>{
    const ifaces = os.networkInterfaces();
    for (let name in ifaces)
    {
        if (name!=iface)
            continue;
        let addresses = ifaces[name].filter(data=>data.family=='IPv4');
        if (addresses.length)
            return addresses[0].address;
    }
    return iface;
};

Luminati.prototype.refresh_sessions = etask._fn(
function*refresh_sessions(_this){
    _this._log('INFO', 'Refreshing all sessions');
    _this.sessions = [];
    _this.sticky_sessions = {};
    yield _this._pool(_this.opt.pool_size);
});

Luminati.prototype.listen = etask._fn(function*listen(_this, port, hostname){
    _this.proxy = [].concat(_this.opt.proxy);
    yield _this.resolve_proxy();
    let _http = _this.http_server, _https = _this.https_server;
    let _socks = _this.socks_server;
    port = port||_this.opt.port;
    hostname = hostname||find_iface(_this.opt.iface);
    yield etask.nfn_apply(_http, '.listen', [port, hostname]);
    _this.port = _http.address().port;
    if (_https)
    {
        _https.on('error', err=>{
            _https.removeAllListener('error');
            _this.emit('error', err);
            this.throw(err);
        });
        yield etask.nfn_apply(_https, '.listen', [0, '127.0.0.1']);
        _this._log('DEBUG', 'HTTPS port: '+_https.address().port);
    }
    if (_socks)
        yield _socks.start();
    _this.emit('ready');
    return _this;
});

Luminati.prototype.stop = etask._fn(function*stop(_this, force){
    let tasks = {};
    const stop_method = force ? '.forceShutdown' : '.shutdown';
    tasks.http = etask.nfn_apply(_this.http_server, stop_method, []);
    if (_this.https_server)
        tasks.https = etask.nfn_apply(_this.https_server, stop_method, []);
    if (_this.socks_server)
        tasks.socks = _this.socks_server.stop(force);
    yield etask.all(tasks);
    return _this;
});

Luminati.prototype._check_proxy_response = etask._fn(
function*_check_proxy_response(_this, proxy, res, context){
    if (!_this.opt.proxy_switch)
        return;
    if (![403, 429, 502, 503].includes(res&&res.statusCode||0))
        return delete _this.failure[proxy];
    _this._log('WARNING', 'invalid proxy response',
        {host: proxy, code: res.statusCode, context: context});
    if ((_this.failure[proxy] =
        (_this.failure[proxy]||0)+1)<_this.opt.proxy_switch)
    {
        return;
    }
    _this._log('WARNING', 'removing failed proxy server', {host: proxy});
    if (_this.hosts)
        _this.hosts = _this.hosts.filter(h=>h!=proxy);
    if (_this.sessions)
        _this.sessions = _this.sessions.filter(s=>s.proxy!=proxy);
    delete _this.failure[proxy];
    yield _this.resolve_proxy();
});

Luminati.prototype.resolve_proxy = etask._fn(function*resolve_proxy(_this){
    let hosts = {};
    [].concat(_this.hosts||[]).forEach(h=>hosts[h] = true);
    const timestamp = Date.now();
    while (Object.keys(hosts).length<_this.opt.proxy_count &&
        Date.now()-timestamp<30000)
    {
        let proxy = _this.proxy.shift();
        _this.proxy.push(proxy);
        if (/^\d+\.\d+\.\d+\.\d+$/.test(proxy))
        {
            _this._log('DEBUG', `using super proxy ${proxy}`);
            hosts[proxy] = true;
            continue;
        }
        let prefix = '';
        if (proxy.length==2)
        {
            prefix = `servercountry-${proxy}-`;
            proxy = 'zproxy.luminati.io';
        }
        let domain = `${prefix}session-${Date.now()}.${proxy}`;
        try {
            let ips = yield etask.nfn_apply(dns, '.resolve', [domain]);
            _this._log('DEBUG', `resolving ${domain}`, ips);
            ips.forEach(ip=>hosts[ip] = true);
        } catch(e){
            _this._log('DEBUG', `Failed to resolve ${domain}: ${e}`);
        }
    }
    _this.hosts = Object.keys(hosts);
    _this.hosts.forEach(h=>{
        if (_this.stats[h])
            return;
        _this.stats[h] = {
            total_requests: 0,
            total_inbound: 0,
            total_outbound: 0,
            active_requests: 0,
            max_requests: 0,
            status_code: {},
        };
        _this._log('INFO', 'adding proxy server', {host: h});
    });
    _this.requests_queue.forEach(args=>_this._request.apply(_this, args));
    _this.requests_queue = [];
});

const info_request = (proxy_url, timeout)=>etask(function*info_request(){
    let opt = {
        url: 'http://lumtest.com/myip.json',
        proxy: proxy_url,
        timeout: timeout,
    };
    let res, err, info;
    try {
        res = yield etask.nfn_apply(request, [opt]);
        if (res.statusCode==200 && res.headers['content-type'].match(/\/json/))
            info = JSON.parse(res.body);
    } catch(e){
        err = e;
        res = {statusCode: 502};
    }
    return {res, err, info};
});

Luminati.prototype._pool = etask._fn(function*pool(_this, count, retries){
    let fetch = tryout=>etask(function*pool_fetch(){
        for (;; tryout++)
        {
            if (lumtest.ts && lumtest.failures>100 &&
                Date.now()-lumtest.ts>60000)
            {
                _this._log('ERROR', 'delaying pool for 10 seconds...');
                yield etask.sleep(10000);
            }
            let session_id = `${_this.port}_${_this.session_id++}`;
            let username = calculate_username(assign({session: session_id},
                _.pick(_this.opt, qw`customer zone country state city asn cid
                    ip raw dns debug request_timeout`)));
            let proxy = _this.hosts.shift();
            _this.hosts.push(proxy);
            let proxy_url = `http://${username}:${_this.opt.password}@${proxy}:${_this.opt.proxy_port}`;
            let res = yield info_request(proxy_url,
                _this.session_init_timeout);
            try {
                yield _this._check_proxy_response(proxy, res.res, {from:
                    'session_init', error: res.err});
                if (res.info)
                {
                    _this._log('INFO',
                        `new session added ${proxy}:${session_id}`,
                        {ip: res.info.ip});
                    let session = {proxy: proxy, session: session_id, count: 0,
                        info: res.info, proxy_url: proxy_url};
                    _this.set_keep_alive(session);
                    _this.sessions.push(session);
                    lumtest = {failures: 0};
                    return;
                }
            } catch(e){ res.err = e; }
            lumtest.failures++;
            lumtest.ts = lumtest.ts||Date.now();
            _this._log('WARNING',
                `Failed to establish session ${proxy}:${session_id}`, {
                    error: res.err,
                    code: res.res.statusCode,
                    headers: res.res.headers,
                    body: res.res.body,
                });
            if (retries && tryout>=retries)
                return this.throw(new Error('could not establish a session'));
        }
    });
    for (let i=0; i<count; i++)
        this.spawn(fetch(1));
    yield this.wait_child('all');
});

Luminati.prototype.set_keep_alive = function(session){
    if (!this.keep_alive)
        return;
    this.stop_keep_alive(session);
    session.keep_alive = setInterval(this._keep_alive.bind(this),
        this.keep_alive, session);
    this._log('DEBUG',
        `Schedule keep alive ${session.proxy}:${session.session}`);
};

Luminati.prototype._keep_alive = function(session){
    this.set_keep_alive(session);
    this._log('INFO', `Keep alive ${session.proxy}:${session.session}`);
    info_request(session.proxy_url, this.opt.request_timeout)
        .then(res=>{
            if (res.info)
                session.info = res.info;
        });
};

Luminati.prototype.stop_keep_alive = function(session){
    if (!session.keep_alive)
        return;
    clearInterval(session.keep_alive);
    session.keep_alive = null;
};

function is_null_response(s, url){
    if (!s)
        return false;
    let r = new RegExp(s, 'i');
    return r.test(url);
}

function is_direct(direct, url){
    if (!direct)
        return false;
    let include = direct.include ? new RegExp(direct.include, 'i') : null;
    let exclude = direct.exclude ? new RegExp(direct.exclude, 'i') : null;
    if (include && include.test(url))
        return true;
    if (exclude && !exclude.test(url))
        return true;
    return false;
}

Luminati.prototype._request = etask._fn(function*(_this, req, res, head){
    if (!_this.hosts.length)
    {
        _this._log('ERROR', 'invalid host!!!');
        process.exit();
    }
    let _url = req.url;
    if (req.method=='CONNECT')
    {
        // TODO lee shouldn't this be moved to socks?
        let parts = _url.split(':');
        if (parts[0].match(/^\d+\.\d+\.\d+\.\d+$/) && _this.opt.resolve)
            parts[0] = yield _this.opt.resolve(parts[0])||parts[0];
        _url = parts.join(':');
        if (parts[0].match(/^\d+\.\d+\.\d+\.\d+$/))
            _this._log('WARNING', 'HTTPS connection to IP: ', _url);
    }
    _this._log('INFO', `${req.method} ${_url}`);
    if (is_null_response(_this.opt.null_response, _url))
    {
        _this._log('DEBUG', `Returning null response: ${req.method} ${_url}`);
        let status = req.method=='CONNECT' ? 501 : 200;
        write_http_reply(res, {statusCode: status, statusMessage: 'NULL'});
        res.end();
        return;
    }
    let authorization = _this.opt.allow_proxy_auth &&
        parse_authorization(req.headers['proxy-authorization']);
    delete req.headers['proxy-authorization'];
    let session;
    if (!authorization && _this.sessions)
    {
        session = _this.sessions[0];
        _this.set_keep_alive(session);
        if (_this.round_robin)
            _this.sessions.push(_this.sessions.shift());
    }
    if (session)
    {
        const now = Date.now();
        const duration = _this.session_duration;
        session.count++;
        if (duration && !session.expire)
        {
            session.expire = now+duration[0];
            if (duration.length>1)
            {
                session.expire += Math.floor(Math.random()*
                    (duration[1]-duration[0]+1));
            }
        }
        if (_this.opt.max_requests && session.count>=_this.opt.max_requests ||
            session.expire && now>session.expire)
        {
            if (_this.round_robin)
                _this.sessions.pop();
            else
                _this.sessions.shift();
            _this.stop_keep_alive(session);
            _this._log('DEBUG', `switching session ${session.session}`);
            yield _this._pool(1);
        }
    }
    else if (_this.opt.sticky_ip && !authorization)
    {
        const ip = req.connection.remoteAddress||'';
        if (!_this.sticky_sessions[ip])
        {
            _this.sticky_sessions[ip] = {
                proxy: _this.hosts[0],
                session: `${_this.port}_${ip}`,
            };
        }
        session = _this.sticky_sessions[ip];
        session.authorization = session.authorization||authorization;
    }
    else if (_this.opt.session)
        session = {session: _this.opt.session};
    let host = session&&session.proxy||_this.hosts[0];
    let username = calculate_username(assign({}, _this.opt, {
        session: session&&session.session,
        direct: is_direct(_this.opt.direct, _url) || false,
    }, authorization||{}, _.pick(_this.opt, 'customer')));
    let password = _this.opt.password ||
        authorization && authorization.password;
    let stats = _this.stats[host];
    if (!stats)
    {
        _this._log('ERROR', 'invalid host!!!');
        process.exit();
    }
    request_stats(req, res, rstats=>{
        stats.total_requests++;
        stats.total_inbound += rstats.res.bytes;
        stats.total_outbound += rstats.req.bytes;
    });
    stats.active_requests++;
    stats.max_requests = Math.max(stats.max_requests, stats.active_requests);
    _this._log('DEBUG', `requesting using ${username}`);
    const timeline = {start: Date.now()};
    const response = {
        request: {
            method: req.method,
            url: _url,
            headers: req.headers,
            body: '',
        },
        proxy: {
            host: host,
            username: username,
        },
        timeline: timeline,
        body_size: 0,
    };
    req.on('data', function(chunk){
        response.request.body += chunk;
    });
    const handler = (proxy, headers)=>etask(function*(){
        const count = new stream.Transform({
            transform(data, encoding, cb){
                response.body_size += data.length;
                cb(null, data);
            },
        });
        proxy.on('response', _res=>{
            try {
                timeline.response = Date.now()-timeline.start;
                stats.active_requests--;
                let code = `${_res.statusCode}`.replace(/(?!^)./g, 'x');
                stats.status_code[code] = (stats.status_code[code]||0)+1;
                _this._log('DEBUG',
                    `${req.method} ${_url} - ${_res.statusCode}`);
                write_http_reply(res, _res, headers);
                _res.pipe(count).pipe(res);
                _res.on('end', ()=>{
                    timeline.end = Date.now()-timeline.start;
                    _this.emit('response', Object.assign(response, {
                        status_code: _res.statusCode,
                        headers: Object.assign({}, _res.headers, headers||{}),
                    }));
                    _this._check_proxy_response(host, _res, 'response');
                    this.return();
                }).on('error', this.throw_fn());
            }
            catch(e){ this.throw(e); }
        }).on('connect', (_res, socket, _head)=>{
            try {
                timeline.connect = Date.now()-timeline.start;
                stats.active_requests--;
                write_http_reply(res, _res);
                Object.assign(response, {
                    status_code: _res.statusCode,
                    headers: _res.headers,
                });
                if (_res.statusCode!=200)
                {
                    _this._log('ERROR',
                        `${req.method} ${_url} - ${_res.statusCode}`);
                    res.end();
                    _this.emit('response', response);
                    _this._check_proxy_response(host, _res, 'connect');
                    return this.return();
                }
                _this._log('DEBUG', `CONNECT - ${_res.statusCode}`);
                socket.write(head);
                res.write(_head);
                socket.pipe(count).pipe(res).pipe(socket);
                socket.on('error', err=>_this._log('ERROR',
                    'Request socket error', {error: err, proxy})
                ).on('end', ()=>{
                    timeline.end = Date.now()-timeline.start;
                    _this.emit('response', response);
                    this.return();
                });
            }
            catch(e){ this.throw(e); }
        }).on('error', err=>{
            _this._check_proxy_response(host, {statusCode: 502}, {from:
                'error', error: err});
            this.throw(err);
        });
        yield this.wait();
    });
    if (_this.opt.fake)
    {
        const ssl = req.method=='CONNECT';
        const socket = net.connect({
            host: ssl ? _url.split(':')[0] : url.parse(_url).hostname,
            port: +(ssl ? _url.split(':')[1] : url.parse(_url).port || 80),
        }).on('connect', ()=>{
            timeline.direct_connect = Date.now()-timeline.start;
            stats.active_requests--;
            _this._log('DEBUG', `DIRECT CONNECT - ${_url}`);
            if (ssl)
                write_http_reply(res, {statusCode: 200, statusMessage: 'OK'});
            else
            {
                let head = `${req.method} ${url.parse(_url).path} `
                    +`HTTP/${req.httpVersion}\r\n`;
                for (let field in req.headers)
                    head += `${field}: ${req.headers[field]}\r\n`;
                socket.write(head+'\r\n');
            }
            res.pipe(socket).pipe(res);
        }).on('close', ()=>{
            timeline.end = Date.now()-timeline.start;
            _this.emit('response', response);
            this.return();
        }).on('error', this.throw_fn());
        socket.setNoDelay();
        return yield this.wait();
    }
    const headers = {
        'proxy-authorization': 'Basic '+
            new Buffer(username+':'+password).toString('base64'),
    };
    if (req.socket instanceof tls.TLSSocket)
    {
        let _etask = this;
        response.request.url = `https://${req.headers.host}${req.url}`;
        _this.http.request({
            host: host,
            port: _this.opt.proxy_port,
            method: 'CONNECT',
            path: req.headers.host+':443',
            headers: headers,
            agent: _this.protocol,
            rejectUnauthorized: !_this.insecure,
        }).on('connect', (_res, socket, _head)=>etask(function*(){
            timeline.connect = Date.now()-timeline.start;
            const proxy = https.request({
                host: req.headers.host,
                method: req.method,
                path: req.url,
                headers: req.headers,
                socket: socket,
                agent: false,
                rejectUnauthorized: !_this.insecure,
            });
            req.pipe(proxy);
            yield handler(proxy, _res.headers);
            _etask.return();
        })).on('error', this.throw_fn()).end();
        return yield this.wait();
    }
    const proxy = _this.http.request({
        host: host,
        port: _this.opt.proxy_port,
        method: req.method,
        path: _url,
        agent: _this.protocol,
        headers: assign(headers, req.headers),
        rejectUnauthorized: !_this.insecure,
    });
    if (req.method=='CONNECT')
        proxy.end();
    else
    {
        req.pipe(proxy);
        req.on('end', ()=>proxy.end());
    }
    yield handler(proxy);
});

// XXX lee - header manipulation should be moved to the _request to be handled by all requests
const hola_headers = qw`proxy-connection
    proxy-authentication x-hola-agent x-hola-debug x-hola-tunnel-key
    x-hola-tunnel-ip x-hola-tunnel-session x-hola-auth x-hola-unblocker-debug
    x-hola-session x-hola-cid x-hola-country x-hola-forbid-peer x-hola-dst-ips
    x-hola-ip x-hola-immediate x-hola-dns-only x-hola-response
    x-hola-direct-first x-hola-direct-discover x-hola-blocked-response
    x-hola-conf x-hole-headers-only x-hola-unblocker-bext
    x-hola-dynamic-tunnels`;

Luminati.prototype.request = function(){
    const args = [].slice.call(arguments);
    if (typeof args[0]=='string')
        args[0] = {url: args[0]};
    args[0].proxy = args[0].proxy||`http://127.0.0.1:${this.port}`;
    args[0].headers = args[0].headers||{};
    args[0].headers['x-hola-agent'] = version;
    args[0].proxyHeaderWhiteList = [].concat(
        args[0].proxyHeaderWhiteList||[], hola_headers);
    args[0].proxyHeaderExclusiveList = [].concat(
        args[0].proxyHeaderExclusiveList||[], hola_headers);
    return request.apply(null, args);
};

Luminati.prototype.update_creds = function(customer, password){
    this.opt.customer = customer;
    this.opt.password = password;
};
