// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true, evil: true, es9: true*/
const events = require('events');
const https = require('https');
const url = require('url');
const net = require('net');
const {Readable} = require('stream');
const {Netmask} = require('netmask');
const zerr = require('../../util/zerr.js');
const etask = require('../../util/etask.js');
const ssl = require('../ssl.js');
const lutil = require('../util.js');
const mixin_core = require('./core.js');
const {write_http_reply, get_host_port} = lutil;

const MIXIN_LABEL = module.exports = 'server_send';

const E = mixin_core.new_mixin(MIXIN_LABEL);

E.static.session_to_ip = {};
E.static.last_ip = new Netmask('1.1.1.0');

E.static.get_random_ip = ()=>{
    E.static.last_ip = E.static.last_ip.next();
    return E.static.last_ip.base;
};

E.prototype.send_unauthorized = function(req, res){
    const status_code = 407;
    const status_message = 'Proxy Authentication Required';
    this.log_req_without_res(req, res, status_code, status_message);
    const ip = this.get_req_remote_ip(req);
    this.emit('access_denied', ip);
    return write_http_reply(res, {
        statusCode: status_code,
        statusMessage: status_message,
        headers: {
            Connection: 'keep-alive',
            'Proxy-Authenticate': 'Basic realm="Proxy Manager"',
        },
    }, undefined, this.opt, true);
};

E.prototype.send_bw_limit_reached = function(req, res){
    const status_code = 502;
    const status_message = 'Proxy Manager - Port has reached bw limit';
    this.log_req_without_res(req, res, status_code, status_message);
    return write_http_reply(res, {
        statusCode: status_code,
        statusMessage: status_message,
    }, undefined, this.opt, true);
};

E.prototype.send_error = function(method, _url, res, msg, err_origin){
    const message = `[${err_origin}] ${msg}`;
    this.logger.info('%s %s 502 %s', method, _url, message);
    if (res.ended)
        return;
    const err_header = `x-${err_origin}-error`;
    const headers = {
        Connection: 'close',
        [err_header]: msg,
    };
    try {
        write_http_reply(res, {
            statusCode: 502,
            headers,
            statusMessage: 'Proxy Manager - Bad Gateway',
        }, undefined, this.opt, true);
    } catch(e){
        this.logger.error('could not send head: %s\n%s', e.message);
    }
};


E.prototype.send_proxy_req = function(task, req, res, head){
    if (req.ctx.is_ssl)
        return this.send_proxy_req_ssl(task, req, res, head);
    return this.send_proxy_req_http(task, req, res, head);
};

E.prototype.send_bypass_req = etask._fn(
function*send_bypass_req(_this, task, req, res, head){
    const ctx = req.ctx;
    task.once('cancel', ()=>this.return());
    let proxy;
    if (ctx.is_connect)
    {
        const parts = ctx.url.split(':');
        ctx.response.request.url = `https://${ctx.url}/`;
        ctx.response.request.url_full = ctx.response.request.url;
        proxy = net.connect({host: parts[0], port: +parts[1]});
        proxy.setTimeout(ctx.timeout);
        proxy.once('connect', ()=>{
            ctx.timeline.track('connect');
            write_http_reply(res, {statusCode: 200, statusMessage: 'OK'}, {},
                _this.opt);
            res.pipe(proxy).pipe(res);
            this.return(ctx.response);
        }).once('timeout', _this.handle_proxy_timeout(req, res, proxy, this));
    }
    else
    {
        proxy = lutil.native_request({
            uri: ctx.url,
            host: url.parse(ctx.url).hostname,
            method: req.method,
            path: ctx.req_url,
            headers: ctx.format_headers(ctx.headers),
            rejectUnauthorized: false,
            followRedirect: false,
        });
        proxy.once('connect', (_res, socket)=>{
            if (etask.is_final(task))
                socket.end();
            ctx.timeline.track('connect');
            _res.once('error', _this.log_throw_fn(this, ctx,
                'bypass, connect, _res'));
            socket.once('error', _this.log_throw_fn(this, ctx,
                'bypass, connect, socket'));
        });
        if (ctx.response.request.body)
            proxy.write(ctx.response.request.body);
        req.pipe(proxy);
    }
    task.once('cancel', ()=>{
        proxy.end();
    });
    proxy.once('close', ()=>{
        this.return(ctx.response);
    }).once('error', _this.log_throw_fn(this, ctx, 'bypass, proxy'));
    if (!ctx.is_connect)
        return yield _this.request_handler(req, res, proxy, head);
    return yield this.wait();
});

E.prototype.send_proxy_req_ssl = etask._fn(
function*send_proxy_req_ssl(_this, task, req, res, head){
    const ctx = req.ctx;
    try {
        ctx.response.request.url = ctx.url;
        let conn = _this.get_reused_conn(ctx);
        if (conn)
            ctx.timeline.track('connect');
        else
            conn = yield _this.request_new_socket(task, req, res, head);
        if (!conn || !conn.socket)
            return conn;
        const proxy_opt = {
            // XXX krzysztof: host is null, use Host or remove
            host: ctx.headers.host,
            method: req.method,
            path: req.url,
            headers: ctx.format_headers(ctx.headers),
            proxyHeaderWhiteList: E.hola_headers,
            proxyHeaderExclusiveList: E.hola_headers,
            // option passed down to https_agent
            lpm_username: ctx.cred.username,
            host_port: get_host_port(ctx),
            agent: _this.https_agent,
            rejectUnauthorized: false,
        };
        if (!_this.opt.use_flex_tls)
            proxy_opt.socket = conn.socket;
        else
        {
            const conn_socket = conn.socket.socket;
            if (!conn_socket || conn_socket.destroyed)
            {
                const err = new Error('flex_tls_reuse_destroyed_socket: '
                    +ctx.get_socket_name());
                _this.log_fn(err, ctx, 'flex_tls, conn.socket');
                throw err;
            }
            _this.https_agent.createConnection = ()=>conn.socket;
        }
        if (_this.opt.unblock || _this.opt.ssl_perm)
            proxy_opt.ca = ssl.ca.cert;
        const proxy = https.request(proxy_opt);
        task.once('cancel', ()=>proxy.end());
        proxy.host = ctx.host;
        ctx.proxies.push(proxy);
        if (ctx.response.request.body)
            proxy.write(ctx.response.request.body);
        req.pipe(proxy);
        const cb = ()=>{
            if (req.destroyed)
                proxy.end();
        };
        ctx.end_listeners.push(cb);
        req.once('end', cb);
        return yield _this.request_handler(req, res, proxy, head,
            conn.res && conn.res.headers);
    } catch(e){
        let err_str = `[${e.code||'no_code'}] Error: ${e.message}`;
        _this.logger.error('send_proxy_req_ssl error: %s', err_str);
        return e;
    }
});

E.prototype.send_fake_request = etask._fn(
function*send_fake_request(_this, task, req, res){
    try {
        const grip = E.static.get_random_ip;
        const get_ip = (session={})=>{
            if (session.ip)
                return session.ip;
            if (!E.static.session_to_ip[session.session])
                E.static.session_to_ip[session.session] = grip();
            return E.static.session_to_ip[session.session];
        };
        const fake_proxy = new events.EventEmitter();
        fake_proxy.abort = fake_proxy.destroy = ()=>null;
        const _res = new Readable({
            read(){},
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
        this.spawn(etask(function*fake_proxy_emit(){
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
function*send_proxy_req_http(_this, task, req, res, head){
    const ctx = req.ctx;
    try {
        task.once('cancel', ()=>this.return());
        const proxy = _this.requester.request(ctx, {
            method: req.method,
            path: ctx.url,
            headers: ctx.format_headers(Object.assign(ctx.connect_headers,
                ctx.headers)),
            proxyHeaderWhiteList: E.hola_headers,
            proxyHeaderExclusiveList: E.hola_headers,
            rejectUnauthorized: false,
        });
        task.once('cancel', ()=>proxy.end());
        proxy.host = req.ctx.host;
        ctx.proxies.push(proxy);
        if (ctx.is_connect)
            proxy.end();
        else
        {
            if (ctx.response.request.body)
                proxy.write(ctx.response.request.body);
            req.pipe(proxy);
            const cb = ()=>{
                if (req.destroyed)
                    proxy.end();
            };
            ctx.end_listeners.push(cb);
            req.once('end', cb);
        }
        return yield _this.request_handler(req, res, proxy, head);
    } catch(e){
        let err_str = `[${e.code||'no_code'}] Error: ${e.message}`;
        _this.logger.error('send_proxy_req_http error: %s', err_str);
        return e;
    }
});
