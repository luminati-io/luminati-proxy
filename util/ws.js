// LICENSE_CODE ZON
'use strict'; /*jslint node:true, browser:true, es6:true*/
(function(){
let define;
let next_tick;
let is_node = typeof module=='object' && module.exports && module.children;
var is_rn = typeof global=='object' && !!global.nativeRequire ||
    typeof navigator=='object' && navigator.product=='ReactNative';
if (is_rn)
{
    define = require('./require_node.js').define(module, '../',
        require('/util/conv.js'), require('/util/etask.js'),
        require('/util/events.js'), require('/util/string.js'),
        require('/util/zerr.js'));
}
else if (!is_node)
{
    define = self.define;
    next_tick = (function(){
        var can_set_immediate = typeof window!=='undefined'
            && window.setImmediate;
        var can_post = typeof window!=='undefined'
            && window.postMessage && window.addEventListener;
        if (can_set_immediate)
            return function(f){ return window.setImmediate(f); };
        if (can_post)
        {
            var queue = [];
            window.addEventListener('message', function(ev){
                var source = ev.source;
                if ((source===window || source===null)
                    && ev.data==='process-tick')
                {
                    ev.stopPropagation();
                    if (queue.length>0)
                    {
                        var fn = queue.shift();
                        fn();
                    }
                }
            }, true);
            return function(fn){
                queue.push(fn);
                window.postMessage('process-tick', '*');
            };
        }
        return function(fn){ setTimeout(fn, 0); };
    })();
}
else
    define = require('./require_node.js').define(module, '../');
next_tick = next_tick || process.nextTick;
define(['/util/conv.js', '/util/etask.js', '/util/events.js',
    '/util/string.js', '/util/zerr.js'],
    function(conv, etask, events, string, zerr){

const ef = etask.ef, assign = Object.assign;
// for security reasons 'func' is disabled by default
const zjson_opt = {func: false, date: true, re: true};
const is_win = /^win/.test((is_node||is_rn) && process.platform);
const is_darwin = is_node && process.platform=='darwin';
const default_user_agent = is_node ? (()=>{
    const zconf = require('./config.js');
    const conf = require('./conf.js');
    return `Hola ${conf.app}/${zconf.ZON_VERSION}`;
})() : undefined;
const debug_str_len = 4096;
const default_win_size = 1048576;
const SEC = 1000, MIN = 60000, vfd_sz = 8;
let zcounter; // has to be lazy because zcounter.js itself uses this module
const net = is_node ? require('net') : null;

function noop(){}

class WS extends events.EventEmitter {
    constructor(opt){
        super();
        this.ws = undefined;
        this.data = opt.data;
        this.connected = false;
        this.reason = undefined;
        this.zc_rx = opt.zcounter=='rx' || opt.zcounter=='all';
        this.zc_tx = opt.zcounter=='tx' || opt.zcounter=='all';
        this.msg_log = assign({}, {treshold_size: null, print_size: 100},
            opt.msg_log);
        this.zc = opt.zcounter
            ? opt.label ? `${opt.label}_ws` : 'ws' : undefined;
        this.zjson_opt = assign({}, zjson_opt, opt.zjson_opt);
        this.zjson_opt_send = assign({}, this.zjson_opt, opt.zjson_opt_send);
        this.zjson_opt_receive = assign({}, this.zjson_opt,
            opt.zjson_opt_receive);
        this.label = opt.label;
        this.remote_label = undefined;
        this.local_addr = undefined;
        this.local_port = undefined;
        this.remote_addr = undefined;
        this.remote_port = undefined;
        this.remote_forwarded = false;
        this.status = 'disconnected';
        this.ping = is_node && opt.ping!=false;
        this.ping_interval = typeof opt.ping_interval=='function'
            ? opt.ping_interval() : opt.ping_interval || 60000;
        this.ping_timeout = typeof opt.ping_timeout=='function'
            ? opt.ping_timeout() : opt.ping_timeout || 10000;
        this.ping_timer = undefined;
        this.ping_last = undefined;
        this.idle_timeout = opt.idle_timeout;
        this.idle_timer = undefined;
        this.ipc = opt.ipc_client
            ? new IPC_client(this, opt.ipc_client, {zjson: opt.ipc_zjson,
                mux: opt.mux})
            : undefined;
        this.time_parse = opt.time_parse;
        if (opt.ipc_server)
        {
            new IPC_server(this, opt.ipc_server, {
                zjson: opt.ipc_zjson,
                sync: opt.ipc_sync,
                call_zerr: opt.ipc_call_zerr,
                mux: opt.mux
            });
        }
        this.mux = opt.mux ? new Mux(this, opt.backpressuring) : undefined;
        if (this.zc && !zcounter)
            zcounter = require('./zcounter.js');
    }
    send(msg){
        if (zerr.is.debug())
        {
            zerr.debug(typeof msg=='string'
                ? `${this}> str: ${string.trunc(msg, debug_str_len)}`
                : `${this}> buf: ${msg.length} bytes`);
        }
        if (!this.connected)
        {
            if (zerr.is.info())
                zerr.info(`${this}: sending failed: disconnected`);
            return false;
        }
        // workaround for ws library: the socket is already closing,
        // but a notification has not yet been emitted
        if (this.ws.readyState==2) // ws.CLOSING
        {
            if (zerr.is.info())
                zerr.info(`${this}: sending failed: socket closing`);
            return false;
        }
        this._update_idle();
        this.ws.send(msg);
        if (this.zc_tx)
        {
            zcounter.inc(`${this.zc}_tx_msg`);
            zcounter.inc(`${this.zc}_tx_bytes`, msg.length);
            zcounter.avg(`${this.zc}_tx_bytes_per_msg`, msg.length);
        }
        return true;
    }
    json(data){ return this.send(JSON.stringify(data)); }
    zjson(data){
        return this.send(conv.JSON_stringify(data, this.zjson_opt_send)); }
    _check_status(){
        let prev = this.status;
        this.status = this.ws
            ? this.connected ? 'connected' : 'connecting'
            : 'disconnected';
        if (this.status!=prev)
        {
            this.emit(this.status);
            this.emit('status', this.status);
            if (this.status=='disconnected')
                this._on_disconnected();
        }
    }
    _on_disconnected(){ this.emit('destroyed'); }
    _assign(ws){
        this.ws = ws;
        this.ws.onopen = this._on_open.bind(this);
        this.ws.onclose = this._on_close.bind(this);
        this.ws.onmessage = this._on_message.bind(this);
        this.ws.onerror = this._on_error.bind(this);
        if (is_node)
        {
            this.ws.on('upgrade', this._on_upgrade.bind(this));
            this.ws.on('unexpected-response',
                this._on_unexpected_response.bind(this));
        }
        if (this.ping)
            this.ws.on('pong', this._on_pong.bind(this));
    }
    abort(code, reason){
        this.reason = reason||code;
        let msg = `${this}: closed locally`;
        if (this.reason)
            msg += ` (${this.reason})`;
        // chrome and ff doesn't allow code outside 1000 and 3000-4999
        if (!is_node && !is_rn && !(code==1000 || code>=3000 && code<5000))
            code += 3000;
        this._close(true, code, reason);
        zerr.warn(msg);
        if (this.zc && code)
            zcounter.inc(`${this.zc}_err_${code}`);
        this._check_status();
    }
    _close(close, code, reason){
        if (!this.ws)
            return;
        if (this.ping)
        {
            clearTimeout(this.ping_timer);
            this.ping_timer = undefined;
            this.ping_last = undefined;
            this.ws.removeAllListeners('pong');
        }
        this.ws.onopen = undefined;
        this.ws.onclose = undefined;
        this.ws.onmessage = undefined;
        this.ws.onerror = noop;
        if (is_node)
        {
            this.ws.removeAllListeners('unexpected-response');
            this.ws.removeAllListeners('upgrade');
        }
        this.local_addr = undefined;
        this.local_port = undefined;
        this.remote_addr = undefined;
        this.remote_port = undefined;
        if (close)
        {
            if (this.ws.terminate && (!this.connected || code==-2))
            {
                zerr.notice(`${this}: ws.terminate`);
                this.ws.terminate();
            }
            else
            {
                zerr.notice(`${this}: ws.close`);
                this.ws.close(code, reason);
            }
        }
        this.ws = undefined;
        this.connected = false;
    }
    toString(){
        let res = this.label ? `${this.label} WS` : 'WS';
        if (this.remote_label || this.remote_addr)
            res += ' (';
        if (this.remote_label)
            res += this.remote_label;
        if (this.remote_label && this.remote_addr)
            res += ' ';
        if (this.remote_addr)
            res += this.remote_addr;
        if (this.remote_label || this.remote_addr)
            res += ')';
        return res;
    }
    _on_open(){
        if (this.connected)
            return;
        this.connected = true;
        let sock = this.ws._socket||{};
        // XXX pavlo: uws lib doesn't have these properties in _socket:
        // https://github.com/hola/uWebSockets-bindings/blob/master/nodejs/src/uws.js#L276
        // get them from upgrade request
        this.local_addr = sock.localAddress;
        this.local_port = sock.localPort;
        if (this.remote_addr==sock.remoteAddress)
            this.remote_forwarded = false;
        if (!this.remote_forwarded)
        {
            this.remote_addr = sock.remoteAddress;
            this.remote_port = sock.remotePort;
        }
        zerr.notice(`${this}: connected`);
        if (this.ping)
        {
            this.ping_timer = setTimeout(this._ping.bind(this),
                this.ping_interval);
        }
        this._check_status();
    }
    _on_close(event){
        this.reason = event.reason||event.code;
        zerr.notice(`${this}: closed by remote (${this.reason})`);
        this._close();
        this._check_status();
    }
    _on_error(event){
        this.reason = event.message||'Network error';
        zerr(`${this}: ${this.reason}`);
        if (this.zc)
            zcounter.inc(`${this.zc}_err`);
        this._close();
        this._check_status();
    }
    _on_unexpected_response(req, resp){
        this._on_error({message: 'unexpected response'});
        this.emit('unexpected-response');
    }
    _on_upgrade(resp){
        zerr.notice(`${this}: upgrade conn`);
    }
    _on_message(event){
        let msg = event.data, handled = false;
        if (msg instanceof ArrayBuffer)
            msg = Buffer.from(Buffer.from(msg)); // make a copy
        if (zerr.is.debug())
        {
            zerr.debug(typeof msg=='string'
                ? `${this}< str: ${string.trunc(msg, debug_str_len)}`
                : `${this}< buf: ${msg.length} bytes`);
        }
        if (this.zc_rx)
        {
            zcounter.inc(`${this.zc}_rx_msg`);
            zcounter.inc(`${this.zc}_rx_bytes`, msg.length);
            zcounter.avg(`${this.zc}_rx_bytes_per_msg`, msg.length);
            zcounter.max(`${this.zc}_rx_bytes_per_msg_max`, msg.length);
        }
        try {
            if (typeof msg=='string')
            {
                if (this._events.zjson)
                {
                    let parsed;
                    if (this.zc && this.time_parse)
                    {
                        let started = Date.now();
                        parsed = conv.JSON_parse(msg, this.zjson_opt_receive);
                        zcounter.inc(`${this.zc}_parse_zjson_ms`,
                            Date.now()-started);
                    }
                    else
                        parsed = conv.JSON_parse(msg, this.zjson_opt_receive);
                    this.emit('zjson', parsed);
                    handled = true;
                }
                if (this._events.json)
                {
                    let parsed, started;
                    if (this.zc && this.time_parse)
                        started = Date.now();
                    parsed = JSON.parse(msg);
                    if (this.zc && this.time_parse)
                    {
                        zcounter.inc(`${this.zc}_parse_json_ms`,
                            Date.now()-started);
                    }
                    this.emit('json', parsed);
                    handled = true;
                }
                if (this._events.text)
                {
                    this.emit('text', msg);
                    handled = true;
                }
                if (this.msg_log.treshold_size &&
                    msg.length>=this.msg_log.treshold_size)
                {
                     zerr.warn(`${this}: Message length treshold`
                         +` ${this.msg_log.treshold_size} exceeded:`
                         +` ${msg.substr(0, this.msg_log.print_size)}`);
                }
            }
            else
            {
                if (this._events.bin)
                {
                    this.emit('bin', msg);
                    handled = true;
                }
            }
            if (this._events.raw)
            {
                this.emit('raw', msg);
                handled = true;
            }
        } catch(e){ ef(e);
            zerr(`${this}: ${zerr.e2s(e)}`);
            return this.abort(1011, e.message);
        }
        if (!handled)
            this.abort(1003, 'Unexpected message');
        this._update_idle();
        if (this.ping_last)
        {
            clearTimeout(this.ping_timer);
            this.ping_timer = setTimeout(this._ping_expire.bind(this),
                this.ping_timeout);
        }
    }
    _on_pong(){
        clearTimeout(this.ping_timer);
        let rtt = Date.now()-this.ping_last;
        this.ping_last = undefined;
        this.ping_timer = setTimeout(this._ping.bind(this),
            Math.max(this.ping_interval-rtt, 0));
        if (zerr.is.debug())
            zerr.debug(`${this}< pong (rtt ${rtt}ms)`);
        if (this.zc)
            zcounter.avg(`${this.zc}_ping_ms`, rtt);
    }
    _ping(){
        // workaround for ws library: the socket is already closing,
        // but a notification has not yet been emitted
        if (this.ws.readyState==2) // ws.CLOSING
            return;
        this.ws.ping();
        this.ping_timer = setTimeout(this._ping_expire.bind(this),
            this.ping_timeout);
        this.ping_last = Date.now();
        if (zerr.is.debug())
            zerr.debug(`${this}> ping (max ${this.ping_timeout}ms)`);
    }
    _ping_expire(){ this.abort(1002, 'Ping timeout'); }
    _idle(){
        if (this.zc)
            zcounter.inc(`${this.zc}_idle_timeout`);
        this.emit('idle_timeout');
        this.abort(1002, 'Idle timeout');
    }
    _update_idle(){
        if (!this.idle_timeout)
            return;
        clearTimeout(this.idle_timer);
        this.idle_timer = setTimeout(this._idle.bind(this), this.idle_timeout);
    }
    close(code, reason){
        if (!this.ws)
            return;
        let msg = `${this}: closed locally`;
        if (reason||code)
            msg += ` (${reason||code})`;
        this._close(true, code, reason);
        zerr.notice(msg);
        if (this.zc && code)
            zcounter.inc(`${this.zc}_err_${code}`);
        this._check_status();
    }
    inspect(){
        return {
            class: this.constructor.name,
            label: this.toString(),
            status: this.status,
            reason: this.reason,
            local_addr: this.local_addr,
            local_port: this.local_port,
            remote_addr: this.remote_addr,
            remote_port: this.remote_port,
        };
    }
}

class Client extends WS {
    constructor(url, opt={}){
        if (opt.mux)
            opt.mux = assign({}, opt.mux);
        super(opt);
        this.status = 'connecting';
        this.impl = client_impl(opt);
        this.url = url;
        this.servername = opt.servername;
        this.retry_interval = opt.retry_interval||10000;
        this.retry_max = opt.retry_max||this.retry_interval;
        this.retry_random = opt.retry_random;
        this.next_retry = this.retry_interval;
        this.no_retry = opt.no_retry;
        this._retry_count = 0;
        this.lookup = opt.lookup;
        this.lookup_ip = opt.lookup_ip;
        this.fallback = opt.fallback &&
            assign({retry_threshold: 1, retry_mod: 5}, opt.fallback);
        if (is_node)
        {
            this.headers = assign(
                {'User-Agent': opt.user_agent||default_user_agent},
                opt.headers);
        }
        this.deflate = !!opt.deflate;
        if (opt.proxy)
        {
            let _lib = require('https-proxy-agent');
            this.agent = new _lib(opt.proxy);
        }
        else
            this.agent = opt.agent;
        this.reconnect_timer = undefined;
        this.handshake_timeout = opt.handshake_timeout===undefined
            ? 10000 : opt.handshake_timeout;
        this.handshake_timer = undefined;
        if (this.zc)
            zcounter.inc_level(`level_${this.zc}_online`, 0, 'sum');
        this._connect();
    }
    // we don't want WS to emit 'destroyed', Client controls it by itself,
    // because it supports reconnects
    _on_disconnected(){}
    _assign(ws){
        super._assign(ws);
        if (this.zc)
            zcounter.inc_level(`level_${this.zc}_online`, 1, 'sum');
    }
    _close(close, code, reason){
        if (this.zc && this.ws)
            zcounter.inc_level(`level_${this.zc}_online`, -1, 'sum');
        if (this.handshake_timer)
            this.handshake_timer = clearTimeout(this.handshake_timer);
        super._close(close, code, reason);
    }
    _connect(){
        this.reason = undefined;
        this.reconnect_timer = undefined;
        let opt = {headers: this.headers};
        let url = this.url, lookup_ip = this.lookup_ip, fb = this.fallback, v;
        if (fb && fb.url && this._retry_count%fb.retry_mod>fb.retry_threshold)
        {
            url = fb.url;
            lookup_ip = fb.lookup_ip;
        }
        if (!is_rn)
        {
            // XXX vladislavl: it won't work for uws out of box
            opt.agent = this.agent;
            opt.perMessageDeflate = this.deflate;
            opt.servername = this.servername;
            opt.lookup = this.lookup;
            if (lookup_ip && net && (v = net.isIP(lookup_ip)))
            {
                opt.lookup = (h, o, cb)=>{
                    cb = cb||o;
                    next_tick(()=>cb(undefined, lookup_ip, v));
                };
            }
        }
        if (this.zc)
            zcounter.set_level(`${this.zc}_fallback`, url==this.url ? 0 : 1);
        zerr.notice(`${this}: connecting to ${url}`);
        this._assign(new this.impl(url, undefined, opt));
        if (this.handshake_timeout)
        {
            this.handshake_timer = setTimeout(
                ()=>this.abort(1002, 'Handshake timeout'),
                this.handshake_timeout);
        }
        this._check_status();
    }
    _reconnect(){
        if (this.no_retry)
            return false;
        let delay = this.next_retry;
        if (typeof delay=='function')
            delay = delay();
        else
        {
            let coeff = this.retry_random ? 1+Math.random() : 2;
            this.next_retry = Math.min(Math.round(delay*coeff),
                typeof this.retry_max=='function'
                    ? this.retry_max() : this.retry_max);
        }
        if (zerr.is.info())
            zerr.info(`${this}: will retry in ${delay}ms`);
        this._retry_count++;
        this.reconnect_timer = setTimeout(()=>this._connect(), delay);
    }
    _on_open(){
        if (this.handshake_timer)
            this.handshake_timer = clearTimeout(this.handshake_timer);
        this.next_retry = this.retry_interval;
        this._retry_count = 0;
        super._on_open();
    }
    _on_close(event){
        this._reconnect();
        super._on_close(event);
    }
    _on_error(event){
        this._reconnect();
        super._on_error(event);
    }
    abort(code, reason){
        this._reconnect();
        super.abort(code, reason);
    }
    close(code, reason){
        if (this.ws)
            this.emit('destroyed');
        super.close(code, reason);
        if (this.reconnect_timer)
        {
            clearTimeout(this.reconnect_timer);
            this.reconnect_timer = undefined;
            this.emit('destroyed');
        }
    }
    inspect(){
        return assign(super.inspect(), {
            url: this.url,
            lookup_ip: this.lookup_ip,
            retry_interval: this.retry_interval,
            retry_max: this.retry_max,
            next_retry: this.next_retry,
            handshake_timeout: this.handshake_timeout,
            deflate: this.deflate,
            reconnecting: !!this.reconnect_timer,
            fallback: this.fallback,
        });
    }
}

class Server {
    constructor(opt={}, handler=undefined){
        if (opt.mux)
            opt.mux = assign({}, {dec_vfd: true}, opt.mux);
        this.handler = handler;
        let ws_opt = {
            server: opt.http_server,
            host: opt.host||'0.0.0.0',
            port: opt.port,
            noServer: !opt.http_server && !opt.port,
            path: opt.path,
            clientTracking: false,
            perMessageDeflate: !!opt.deflate,
        };
        if (opt.max_payload)
            ws_opt.maxPayload = opt.max_payload;
        if (opt.verify)
            ws_opt.verifyClient = opt.verify;
        this.ws_server = new (server_impl(opt))(ws_opt);
        this.opt = opt;
        this.label = opt.label;
        this.connections = new Set();
        if (opt.zcounter!=false)
            this.zc = opt.label ? `${opt.label}_ws` : 'ws';
        this.ws_server.addListener('connection', this.accept.bind(this));
        if (opt.port)
            zerr.notice(`${this}: listening on port ${opt.port}`);
        if (!zcounter)
            zcounter = require('./zcounter.js');
        // ensure the metric exists, even if 0
        if (this.zc)
            zcounter.inc_level(`level_${this.zc}_conn`, 0, 'sum');
    }
    toString(){ return this.label ? `${this.label} WS server` : 'WS server'; }
    upgrade(req, socket, head){
        this.ws_server.handleUpgrade(req, socket, head,
            ws=>this.accept(ws, req));
    }
    accept(ws, req=ws.upgradeReq){
        if (!ws._socket.remoteAddress)
        {
            ws.onerror = noop;
            return zerr.warn(`${this}: dead incoming connection`);
        }
        let headers = req && req.headers || {};
        if (this.opt.origin_whitelist)
        {
            if (!this.opt.origin_whitelist.includes(headers.origin))
            {
                if (ws._socket.destroy)
                    ws._socket.destroy();
                else if (ws.terminate)
                    ws.terminate();
                return zerr.notice('incoming conn from %s rejected',
                    headers.origin||'unknown origin');
            }
            zerr.notice('incoming conn from %s', headers.origin);
        }
        let zws = new WS(this.opt);
        if (this.opt.trust_forwarded)
        {
            let forwarded = headers['x-real-ip'];
            if (!forwarded)
            {
                forwarded = headers['x-forwarded-for'];
                if (forwarded)
                {
                    let ips = forwarded.split(',');
                    forwarded = ips[ips.length-1];
                }
            }
            if (forwarded)
            {
                zws.remote_addr = forwarded;
                zws.remote_forwarded = true;
            }
        }
        let ua = headers['user-agent'];
        let m = /^Hola (.+)$/.exec(ua);
        zws.remote_label = m ? m[1] : ua ? 'web' : undefined;
        zws._assign(ws);
        zws._on_open();
        this.connections.add(zws);
        if (this.zc)
        {
            zcounter.inc(`${this.zc}_conn`);
            zcounter.inc_level(`level_${this.zc}_conn`, 1, 'sum');
        }
        zws.addListener('disconnected', ()=>{
            this.connections.delete(zws);
            if (this.zc)
                zcounter.inc_level(`level_${this.zc}_conn`, -1, 'sum');
        });
        if (this.handler)
        {
            try {
                zws.data = this.handler(zws, req);
            } catch(e){ ef(e);
                zerr(zerr.e2s(e));
                return zws.close(1011, String(e));
            }
        }
        return zws;
    }
    broadcast(msg){
        if (zerr.is.debug())
        {
            zerr.debug(typeof msg=='string'
                ? `${this}> broadcast str: ${string.trunc(msg, debug_str_len)}`
                : `${this}> broadcast buf: ${msg.length} bytes`);
        }
        for (let zws of this.connections)
            zws.send(msg);
    }
    broadcast_json(data){
        if (this.connections.size)
            this.broadcast(JSON.stringify(data));
    }
    broadcast_zjson(data){
        if (this.connections.size)
            this.broadcast(conv.JSON_stringify(data, this.zjson_opt_send));
    }
    close(code, reason){
        zerr.notice(`${this}: closed`);
        this.ws_server.close();
        for (let zws of this.connections)
            zws.close(code, reason);
    }
    inspect(){
        let connections = [];
        for (let c of this.connections)
            connections.push(c.inspect());
        return {
            class: this.constructor.name,
            label: this.toString(),
            opt: this.opt,
            connections,
        };
    }
}

class IPC_client {
    constructor(zws, names, opt={}){
        if (opt.mux)
        {
            this._vfd = opt.mux.start_vfd==undefined && 2147483647 ||
                opt.mux.start_vfd;
            this.mux = opt.mux;
        }
        this._ws = zws;
        this._pending = new Map();
        this._ws.addListener(opt.zjson ? 'zjson' : 'json',
            this._on_resp.bind(this));
        this._ws.addListener('status', this._on_status.bind(this));
        this._ws.addListener('destroyed',
            this._on_status.bind(this, 'destroyed'));
        if (Array.isArray(names))
        {
            for (let name of names)
                this[name] = this._call.bind(this, opt, name);
        }
        else
        {
            for (let name in names)
            {
                let spec = names[name];
                if (typeof spec=='string')
                    spec = {type: spec};
                let _opt = assign({}, opt, spec);
                switch (_opt.type||'call')
                {
                case 'call':
                    this[name] = this._call.bind(this, _opt, name);
                    break;
                case 'post':
                    this[name] = this._post.bind(this, _opt, name);
                    break;
                case 'mux':
                    this[name] = this._mux.bind(this, _opt, name);
                    break;
                default:
                    zerr.zexit(
                        `${this._ws}: ${name}: Invalid IPC client spec`);
                }
            }
        }
    }
    _call(opt, cmd, ...arg){
        let _this = this;
        let timeout = opt.timeout||5*MIN;
        let send_retry_timeout = 3*SEC;
        return etask(function*IPC_client_call(){
            let req = {type: opt.type=='mux' && 'ipc_mux' || 'ipc_call', cmd,
                cookie: ++IPC_client._cookie};
            if (arg.length==1)
                req.msg = arg[0];
            else if (arg)
                req.arg = arg;
            this.info.label = ()=>_this._ws.toString();
            this.info.cmd = cmd;
            this.info.cookie = req.cookie;
            _this._pending.set(req.cookie, this);
            this.finally(()=>_this._pending.delete(req.cookie));
            this.alarm(timeout, ()=>{
                let e = new Error(`${cmd} timeout`);
                e.code = 'ipc_timeout';
                this.throw(e);
            });
            let res = {status: _this._ws.status}, prev;
            let send = _this._ws[opt.zjson ? 'zjson' : 'json'].bind(_this._ws);
            while (res.status)
            {
                let conn_closed_error = _this._ws.reason||'Connection closed';
                switch (res.status)
                {
                case 'disconnected':
                    if (opt.retry==false || !_this._ws.reconnect_timer)
                        throw new Error(conn_closed_error);
                    break;
                case 'connecting':
                    if (opt.retry==false)
                        throw new Error('Connection not ready');
                    break;
                case 'destroyed':
                    throw new Error(conn_closed_error);
                case 'connected':
                    while (!send(req))
                    {
                        if (opt.retry==false)
                            throw new Error(conn_closed_error);
                        yield etask.sleep(send_retry_timeout);
                    }
                    break;
                }
                do {
                    prev = res.status;
                    res = yield this.wait();
                } while (prev==res.status);
            }
            return res.value;
        });
    }
    _post(opt, cmd, ...arg){
        let req = {type: 'ipc_post', cmd};
        if (arg.length==1)
            req.msg = arg[0];
        else if (arg)
            req.arg = arg;
        if (opt.zjson)
            this._ws.zjson(req);
        else
            this._ws.json(req);
    }
    _mux(opt, cmd, ...args)
    {
        if (!this._ws.mux)
            throw new Error('Mux is not defined');
        let _this = this;
        let vfd = this.mux.dec_vfd ? --this._vfd : ++this._vfd;
        return etask(function*(){
            let stream = _this._ws.mux.open(vfd, _this.mux.bytes_allowed,
                _this.mux);
            stream.close = ()=>_this._ws.mux.close(vfd);
            args.unshift(vfd);
            yield _this._call(opt, cmd, ...args);
            return stream;
        });
    }
    _on_resp(msg){
        if (!msg || msg.type!='ipc_result' && msg.type!='ipc_error')
            return;
        let task = this._pending.get(msg.cookie);
        if (!task)
        {
            return zerr.info(`${this._ws}: `
                +`unexpected IPC cookie ${msg.cookie}`);
        }
        if (msg.type=='ipc_result')
            return void task.continue({value: msg.msg});
        let err = new Error(msg.msg);
        err.code = msg.err_code;
        err._ws = ''+this._ws;
        task.throw(err);
    }
    _on_status(status){
        for (let task of this._pending.values())
            task.continue({status});
    }
    pending_count(){
        return this._pending.size;
    }
}
IPC_client._cookie = 0;

class IPC_server {
    constructor(zws, methods, opt={}){
        this.ws = zws;
        if (Array.isArray(methods))
        {
            this.methods = {};
            for (let m of methods)
                this.methods[m] = true;
        }
        else
            this.methods = methods;
        Object.setPrototypeOf(this.methods, null);
        this.mux = opt.mux;
        this.zjson = !!opt.zjson;
        this.sync = !!opt.sync;
        this.call_zerr = !!opt.call_zerr;
        this.pending = this.sync ? undefined : new Set();
        this.ws.addListener(this.zjson ? 'zjson' : 'json',
            this._on_call.bind(this));
        if (!this.sync)
        {
            this.ws.addListener('disconnected',
                this._on_disconnected.bind(this));
        }
    }
    _on_call(msg){
        if (!msg || !msg.cmd)
            return;
        let type = msg.type||'ipc_call', cmd = msg.cmd;
        if (!['ipc_call', 'ipc_post', 'ipc_mux'].includes(type))
            return;
        let method = this.methods[cmd];
        if (method==true)
            method = this.ws.data[cmd];
        if (!method)
        {
            let err = `Method ${cmd} not defined`;
            if (type=='ipc_post')
                return zerr(`${this.ws}: ${err}`);
            return this.ws.json({
                type: 'ipc_error',
                cmd: cmd,
                cookie: msg.cookie,
                msg: err,
            });
        }
        const res_process = rv=>{
            if (type=='ipc_post' || type=='ipc_mux')
                return;
            const res = {
                type: 'ipc_result',
                cmd: cmd,
                cookie: msg.cookie,
                msg: rv,
            };
            if (this.zjson)
                this.ws.zjson(res);
            else
                this.ws.json(res);
        };
        const err_process = e=>{
            if (type=='ipc_call' && this.call_zerr)
                zerr(`${this.ws}: ${cmd}: ${zerr.e2s(e)}`);
            if (type=='ipc_post' || type=='ipc_mux')
                return zerr(`${this.ws}: ${cmd}: ${zerr.e2s(e)}`);
            this.ws.json({
                type: 'ipc_error',
                cmd: cmd,
                cookie: msg.cookie,
                msg: e.message || String(e),
                err_code: e.code,
            });
        };
        const arg = msg.arg || [msg.msg], ctx = this.ws.data||this.ws;
        if (type=='ipc_mux')
        {
            if (!this.ws.mux)
            {
                return this.ws.json({
                    type: 'ipc_error',
                    cmd: cmd,
                    cookie: msg.cookie,
                    msg: `Mux is not defined`,
                });
            }
            let vfd = arg.shift();
            let stream = this.ws.mux.open(vfd, this.mux.bytes_allowed,
                this.mux);
            stream.close = ()=>this.ws.mux.close(vfd);
            arg.unshift(stream);
            const res = {
                type: 'ipc_result',
                cmd: cmd,
                cookie: msg.cookie,
            };
            if (this.zjson)
                this.ws.zjson(res);
            else
                this.ws.json(res);
        }
        if (this.sync)
        {
            try { res_process(method.apply(ctx, arg)); }
            catch(e){ err_process(e); }
            return;
        }
        const _this = this;
        etask(function*IPC_server_on_call(){
            if (type=='ipc_post' || type=='ipc_mux')
            {
                _this.pending.add(this);
                this.finally(()=>_this.pending.delete(this));
            }
            this.info.label = ()=>_this.ws.toString();
            this.info.cmd = cmd;
            this.info.cookie = msg.cookie;
            try { res_process(yield method.apply(ctx, arg)); }
            catch(e){ err_process(e); }
        });
    }
    _on_disconnected(){
        for (let task of this.pending)
            task.return();
    }
}

// XXX vladislavl: remove _bp methods once ack version tested and ready
class Mux {
    constructor(zws, backpressuring=false){
        this.ws = zws;
        this.backpressuring = backpressuring;
        this.streams = new Map();
        this.ws.on('bin', this._on_bin.bind(this));
        this.ws.on('json', this._on_json.bind(this));
        this.ws.on('disconnected', this._on_disconnected.bind(this));
    }
    open(vfd, bytes_allowed=Infinity, opt={}){
        this.ignore_unexpected_acks = opt.ignore_unexpected_acks;
        return this.streams.get(vfd) || (opt.use_ack ?
            this.open_ack(vfd, opt) : this.open_bp(vfd, bytes_allowed, opt));
    }
    open_bp(vfd, bytes_allowed, opt={}){
        const _lib = require('stream');
        let _this = this, suspended;
        const stream = new _lib.Duplex(assign({
            read(size){},
            write(data, encoding, cb){
                if (bytes_allowed<=0)
                {
                    suspended = ()=>this._write(data, encoding, cb);
                    return;
                }
                if (zerr.is.debug())
                    zerr.debug(`${_this.ws}> vfd ${vfd}`);
                bytes_allowed -= data.length;
                let buf = Buffer.allocUnsafe(data.length+vfd_sz);
                buf.writeUInt32BE(vfd, 0);
                buf.writeUInt32BE(0, 4);
                data.copy(buf, vfd_sz);
                cb(_this.ws.send(buf) ? undefined
                    : new Error(_this.ws.reason || _this.ws.status));
                this.last_use_ts = Date.now();
            },
            destroy(err, cb){
                // XXX viktor: fix once it is clear what happens. ignore this
                // error and let real error from _http_client.js:441 throws
                try {
                    stream.push(null);
                } catch(e){
                    zerr.notice('DEBUG RECURSIVE DESTROY '+e);
                }
                stream.end();
                this.emit('_close');
                next_tick(cb, err);
            }
        }, opt));
        let _stacktrace = (new Error()).stack;
        stream.create_ts = Date.now();
        stream.prependListener('data', function(chunk){
            if (_this.backpressuring &&
                this.readableLength<=this.readableHighWaterMark>>1)
            {
                _this.remote_write_resume(vfd);
            }
            this.last_use_ts = Date.now();
            if (!this._httpMessage || this.parser && this.parser.socket===this
                || is_rn)
            {
                return;
            }
            // XXX sergey: in case we have a bug and parser freed before data
            // fully consumed, replace damaged parser with new one, but
            // instead of processing data return error, this will close socket
            // and emit error on request object
            const {parsers} = require('_http_common');
            zcounter.inc(`mux_no_parser`);
            zerr('\n--- assert failed, socketinfo:\n'+
                `DEBUG HEADER: ${this._httpMessage._header}\n`+
                `DEBUG mux.open(): ${_stacktrace}\n`+
                `DEBUG WS: ${_this.ws.remote_addr}:${_this.ws.remote_port}`);
            const old_parser = this.parser;
            const parser = this.parser = parsers.alloc();
            const old_execute = parser.execute;
            parser.socket = this;
            parser.execute = buf=>{
                parser.execute = old_execute;
                this.parser = old_parser;
                return new Error('Mux Duplex parser removed before data '+
                    'consumed');
            };
        });
        stream.allow = (bytes=Infinity)=>{
            bytes_allowed = bytes;
            if (bytes_allowed<=0 || !suspended)
                return;
            suspended();
            suspended = undefined;
        };
        // XXX vladimir: rm custom '_close' event
        // not using 'close' event due to confusion with socket close event
        // which is emitted async after handle closed
        stream.on('_close', ()=>{
            if (this.streams.delete(vfd))
            {
                zerr.info(`${this.ws}: vfd ${vfd} closed`);
                let zc = this.ws.zc;
                if (zc)
                    zcounter.inc_level(`level_${zc}_mux_vfd`, -1, 'sum');
            }
        });
        this.streams.set(vfd, stream);
        zerr.info(`${this.ws}: vfd ${vfd} open`);
        if (this.ws.zc)
            zcounter.inc_level(`level_${this.ws.zc}_mux_vfd`, 1, 'sum');
        return stream;
    }
    open_ack(vfd, opt={}){
        const _lib = require('stream');
        const _this = this;
        opt.fin_timeout = opt.fin_timeout||10*SEC;
        const w_log = (e, str)=>
            zerr.warn(`${_this.ws}: ${str}: ${vfd}-${zerr.e2s(e)}`);
        let pending, zfin_pending, send_ack_timeout, send_ack_ts = 0;
        const stream = new _lib.Duplex(assign({
            read(size){},
            write(data, encoding, cb){
                const {buf, buf_pending} = stream.process_data(data);
                if (buf)
                {
                    if (!_this.ws.send(buf))
                        return cb(new Error(_this.ws.reason||_this.ws.status));
                    stream.sent += buf.length-vfd_sz;
                    stream.last_use_ts = Date.now();
                }
                if (zerr.is.debug())
                {
                    zerr.debug(`${_this.ws}> vfd ${vfd} sent ${stream.sent} `
                        +`ack ${stream.ack} win_size ${stream.win_size}`);
                }
                if (!buf_pending)
                    return void cb();
                pending = etask(function*(){
                    yield this.wait();
                    pending = null;
                    stream._write(buf_pending, encoding, cb);
                });
            },
            destroy(err, cb){ return etask(function*(){
                if (stream.zdestroy)
                {
                    yield this.wait_ext(stream.zdestroy);
                    return next_tick(cb, err);
                }
                stream.zdestroy = this;
                if (stream._unused_tm)
                    clearTimeout(stream._unused_tm);
                // XXX vladislavl: hack-fix node bug (need remove on update)
                // https://github.com/nodejs/node/issues/26015
                stream.prependListener('error', ()=>{
                    if (stream._writableState)
                        stream._writableState.errorEmitted = true;
                });
                if (err) // don't try to end/finish stream gracefully if error
                    yield zfinish(false, false);
                else
                {
                    yield zfinish(true, false);
                    try { stream.push(null); } catch(e){}
                }
                next_tick(()=>{
                    cb(err);
                    stream.emit('_close');
                });
            }); },
        }, opt));
        // XXX vladislavl: support legacy version for peer side old mux streams
        // remove once no events
        stream.allow = size=>{
            if (stream.win_size_got)
                return;
            stream.win_size = size||Infinity;
            if (!size && _this.ws.zc)
                zcounter.inc('mux_legacy_allow_call');
        };
        stream.process_data = data=>{
            let bytes = Math.min(stream.win_size-(stream.sent-stream.ack),
                data.length);
            if (bytes<=0)
                return {buf_pending: data};
            const buf = Buffer.allocUnsafe(bytes+vfd_sz);
            buf.writeUInt32BE(vfd, 0);
            buf.writeUInt32BE(0, 4);
            data.copy(buf, vfd_sz, 0, bytes);
            if (bytes==data.length)
                return {buf};
            const buf_pending = Buffer.allocUnsafe(data.length-bytes);
            data.copy(buf_pending, 0, bytes);
            return {buf, buf_pending};
        };
        const zfinish = (end_write, wait_rmt)=>etask(function*_zfinish(){
            if (stream.zfin)
                return yield this.wait_ext(stream.zfin);
            stream.zfin = this;
            if (zerr.is.info())
            {
                zerr.info(`${_this.ws}:vfd:${vfd}:`
                    +`zfin:${end_write}:${wait_rmt}`);
            }
            // XXX vladislavl: use writableFinished from node v12
            if (end_write && (!stream._writableState ||
                !stream._writableState.finished))
            {
                if (pending)
                    pending.continue();
                stream.once('finish', this.continue_fn());
                try { yield this.wait(opt.fin_timeout/2); }
                catch(e){
                    stream.end();
                    try { yield this.wait(opt.fin_timeout/2); }
                    catch(e2){ w_log(e2, 'fin_wait2'); }
                }
            }
            if (pending && !etask.is_final(pending))
            {
                try {
                    pending.return();
                    pending = null;
                } catch(e){ w_log(e, 'destroy write pending'); }
                stream.emit('error', new Error('Fail to write pending data'));
            }
            stream.send_fin();
            if (wait_rmt && !stream.fin_got)
            {
                try { yield zfin_pending = this.wait(2*opt.fin_timeout); }
                catch(e){ w_log(e, 'zfin_pending'); }
            }
            // XXX vladislavl: remove condition once no need support node 6.X
            if (stream.destroy)
                stream.destroy();
        });
        stream.create_ts = Date.now();
        stream.win_size = default_win_size;
        stream.sent = stream.ack = stream.zread = 0;
        stream.prependListener('finish', ()=>zfinish(false, true));
        stream.prependListener('data', function(chunk){
            this.zread += chunk.length;
            this.send_ack();
            this.last_use_ts = Date.now();
            if (!this._httpMessage || this.parser && this.parser.socket===this
                || is_rn)
            {
                return;
            }
            // XXX sergey: in case we have a bug and parser freed before data
            // fully consumed, replace damaged parser with new one, but
            // instead of processing data return error, this will close socket
            // and emit error on request object
            const {parsers} = require('_http_common');
            const _stacktrace = (new Error()).stack;
            zcounter.inc(`mux_ack_no_parser`);
            zerr('\n--- assert failed, socketinfo:\n'+
                `DEBUG HEADER: ${this._httpMessage._header}\n`+
                `DEBUG mux.open(): ${_stacktrace}\n`+
                `DEBUG WS: ${_this.ws.remote_addr}:${_this.ws.remote_port}`);
            const old_parser = this.parser;
            const parser = this.parser = parsers.alloc();
            const old_execute = parser.execute;
            parser.socket = this;
            parser.execute = buf=>{
                parser.execute = old_execute;
                this.parser = old_parser;
                return new Error('Mux Duplex parser removed before data '+
                    'consumed');
            };
        });
        const throttle_ack = +opt.throttle_ack;
        const _send_ack = ()=>{
            _this.ws.json({vfd, ack: stream.zread});
            send_ack_ts = Date.now();
        };
        stream.send_ack = !throttle_ack ? _send_ack : ()=>{
            if (send_ack_timeout)
                return;
            const delta = Date.now()-send_ack_ts;
            if (delta>=throttle_ack)
                return _send_ack();
            send_ack_timeout = setTimeout(()=>{
                send_ack_timeout = null;
                _send_ack();
            }, throttle_ack-delta);
        };
        stream.on_ack = ack=>{
            stream.ack = ack;
            if (pending)
                pending.continue();
        };
        stream.send_win_size = ()=>{
            if (stream.win_size_sent)
                return;
            _this.ws.json({vfd, win_size: opt.win_size||default_win_size});
            stream.win_size_sent = true;
        };
        stream.on_win_size = size=>{
            stream.win_size = size;
            stream.win_size_got = true;
            if (pending)
                pending.continue();
        };
        stream.send_fin = ()=>{
            _this.ws.json({vfd, fin: 1});
            stream.fin_sent = true;
        };
        stream.on_fin = ()=>{
            stream.fin_got = true;
            const fn = ()=>next_tick(()=>zfin_pending ?
                zfin_pending.continue() : zfinish(true, false));
            etask(function*(){
                stream.once('end', this.continue_fn());
                try {
                    stream.push(null);
                    const state = stream._readableState;
                    // XXX vladislavl: use readableEnded from node v12
                    if (!stream.readableLength || state && state.endEmitted)
                        return fn();
                    yield this.wait(opt.fin_timeout);
                } catch(e){ w_log(e, 'ending'); }
                fn();
            });
        };
        stream.set_timeout = timeout=>{
            clearTimeout(stream._unused_tm);
            if (!timeout)
                return;
            stream._unused_tm_fn = ()=>{
                const delta = Date.now()-(stream.last_use_ts||0);
                if (delta>=timeout)
                    return stream.emit('timeout');
                stream._unused_tm = setTimeout(stream._unused_tm_fn,
                    timeout-delta);
            };
            stream._unused_tm = setTimeout(stream._unused_tm_fn, timeout);
        };
        // XXX vladislavl: rm custom '_close' event: svc_bridge uses it
        stream.on('_close', ()=>{
            if (!this.streams.delete(vfd))
                return;
            if (zerr.is.info())
                zerr.info(`${this.ws}: vfd ${vfd} closed`);
            let zc = this.ws.zc;
            if (zc)
                zcounter.inc_level(`level_${zc}_mux_ack_vfd`, -1, 'sum');
        });
        this.streams.set(vfd, stream);
        if (zerr.is.info())
            zerr.info(`${this.ws}: vfd ${vfd} open`);
        if (this.ws.zc)
            zcounter.inc_level(`level_${this.ws.zc}_mux_ack_vfd`, 1, 'sum');
        return stream;
    }
    close(vfd){
        let stream = this.streams.get(vfd);
        if (!stream)
            return false;
        if (stream.destroy)
            stream.destroy();
        else
        {
            // XXX vladimir: no destroy only for embedded node v6.10.0
            stream.push(null);
            stream.end();
            stream.emit('_close');
        }
        return true;
    }
    remote_write_pause(id){
        const stream = this.streams.get(id);
        if (!stream || stream.remote_write_paused)
            return;
        this.ws.json({stream_id: id, backpressure_cmd: 'write_pause',
            log: this.backpressuring.log});
        stream.remote_write_paused = true;
        if (this.ws.zc)
            zcounter.inc('mux_remote_write_pause');
    }
    remote_write_resume(id){
        const stream = this.streams.get(id);
        if (!stream || !stream.remote_write_paused)
            return;
        this.ws.json({stream_id: id, backpressure_cmd: 'write_resume',
            log: this.backpressuring.log});
        stream.remote_write_paused = false;
        if (this.ws.zc)
            zcounter.inc('mux_remote_write_resume');
    }
    _on_bin(buf){
        if (buf.length<vfd_sz)
            return zerr(`${this.ws}: malformed binary message`);
        let vfd = buf.readUInt32BE(0);
        if (zerr.is.debug())
            zerr.debug(`${this.ws}< vfd ${vfd}`);
        let stream = this.streams.get(vfd);
        if (!stream)
            return zerr(`${this.ws}: unexpected stream vfd ${vfd}`);
        if (stream.on_ack)
            this._on_bin_ack(stream, buf);
        else
            this._on_bin_bp(stream, buf, vfd);
    }
    _on_bin_bp(stream, buf, vfd){
        if (!stream.push(buf.slice(vfd_sz)) && this.backpressuring)
            this.remote_write_pause(vfd);
    }
    _on_bin_ack(stream, buf){
        try {
            stream.send_win_size();
            stream.push(buf.slice(vfd_sz));
        } catch(e){
            zerr(`${this.ws}: ${zerr.e2s(e)}`);
            throw e;
        }
    }
    _on_json(msg){
        if (msg && msg.backpressure_cmd)
            this._on_json_bp(msg);
        else
            this._on_json_ack(msg);
    }
    _on_json_bp(msg){
        const stream = this.streams.get(msg.stream_id);
        if (!stream || !msg.backpressure_cmd)
            return;
        if (msg.log)
            zerr.notice(`${this.ws}: ${msg.backpressure_cmd}`);
        switch (msg.backpressure_cmd)
        {
        case 'write_pause': return stream.allow(0);
        case 'write_resume': return stream.allow();
        }
    }
    _on_json_ack(msg){
        if (!msg || msg.vfd===undefined)
            return;
        const stream = this.streams.get(msg.vfd);
        if (!stream)
            return zerr.info(`${this.ws}: unexpected stream ID %O`, msg);
        if (msg.ack && stream.on_ack)
            return void stream.on_ack(msg.ack);
        if (msg.win_size && stream.on_win_size)
            return void stream.on_win_size(msg.win_size);
        if (msg.fin && stream.on_fin)
            return void stream.on_fin();
        stream.emit('unexpected_ack', msg);
        zerr(`${this.ws}: unexpected json_ack %O`, msg);
        if (this.ws.zc)
            zcounter.inc('mux_unexpected_ack');
    }
    _on_disconnected(){
        let err = new Error(this.ws.reason || 'disconnected');
        for (let stream of this.streams.values())
        {
            if (stream.destroy)
                stream.destroy(err);
            else
            {
                stream.emit('error', err);
                stream.emit('_close');
            }
        }
        this.streams.clear();
    }
}

function lib(impl){
    if (impl=='ws')
        return require('ws');
    if (impl=='uws' && !is_win)
        return require('uws');
    zerr.zexit(`WS library ${impl} is not available`);
}

function client_impl(opt){
    // WebSocket is global in react native
    if (is_rn)
        return WebSocket;
    if (!is_node && !opt.impl)
        return self.WebSocket;
    return lib(opt.impl || 'ws');
}

function server_impl(opt){
    if (!is_node)
        throw new Error(`WS server is not available`);
    return lib(opt.impl || (is_win || is_darwin ? 'ws' : 'uws')).Server;
}

return {Client, Server, IPC_client, IPC_server, Mux, t: {WS}};

}); }());
