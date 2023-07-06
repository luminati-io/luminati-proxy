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
        require('/util/zerr.js'), require('/util/util.js'));
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
    '/util/string.js', '/util/zerr.js', '/util/util.js'],
    function(conv, etask, events, string, zerr, zutil){

const ef = etask.ef, assign = Object.assign;
// for security reasons 'func' is disabled by default
const zjson_opt_default = {func: false, date: true, re: true};
const is_win = /^win/.test((is_node||is_rn) && process.platform);
const is_darwin = is_node && process.platform=='darwin';
const default_user_agent = is_node ? (()=>{
    const zconf = require('./config.js');
    const conf = require('./conf.js');
    return `Hola ${conf.app}/${zconf.ZON_VERSION}`;
})() : undefined;
const internalize = string.internalize_pool();
const DEBUG_STR_LEN = 4096, DEFAULT_WIN_SIZE = 1048576;
const SEC = 1000, MIN = 60*SEC, VFD_SZ = 8, VFD_BIN_SZ = 12;
let zcounter; // has to be lazy because zcounter.js itself uses this module
const net = is_node ? require('net') : null;
const SERVER_NO_MASK_SUPPORT = 'server_no_mask_support';
const BUFFER_CONTENT = 10;
const BUFFER_IPC_CALL = 11;
let SnappyStream, UnsnappyStream;
const EventEmitter = is_node ? require('events').EventEmitter
    : events.EventEmitter;
const json_event = flag=>flag ? 'zjson' : 'json';

function noop(){}

const BUFFER_MESSAGES_CONTENT = 20;
const BUFFER_MESSAGES_TYPE_BIN = 0;
const BUFFER_MESSAGES_TYPE_STRING = 1;
const BUFFER_MESSAGES_TYPE_JSON = 2;
const BUFFER_MESSAGES_BIN_SZ = 4;
const BUFFER_MESSAGES_MAX_LENGTH = Math.pow(2, 32)-1;

class Buffers_array {
    static is_buffer(buf){
        if (!(buf instanceof Buffer) || buf.length<3*BUFFER_MESSAGES_BIN_SZ)
            return false;
        let prefix = buf.readUInt32BE(0);
        let msg_type = buf.readUInt32BE(BUFFER_MESSAGES_BIN_SZ);
        let length = buf.readUInt32BE(BUFFER_MESSAGES_BIN_SZ*2);
        return prefix===0 && length==buf.length
            && msg_type==BUFFER_MESSAGES_CONTENT;
    }
    static parse(buf){
        let offset = 3*BUFFER_MESSAGES_BIN_SZ, messages = [];
        while (offset<buf.length)
        {
            let msg_type = buf.readUInt8(offset);
            let msg_len = buf.readUInt32BE(offset+1);
            let msg_value = buf.slice(offset+1+BUFFER_MESSAGES_BIN_SZ,
                offset+1+BUFFER_MESSAGES_BIN_SZ+msg_len);
            if (msg_type==BUFFER_MESSAGES_TYPE_STRING
                || msg_type==BUFFER_MESSAGES_TYPE_JSON)
            {
                msg_value = msg_value.toString();
            }
            messages.push(msg_value);
            offset = offset+1+BUFFER_MESSAGES_BIN_SZ+msg_len;
        }
        return messages;
    }
    constructor(){
        this.clean();
    }
    push(value){
        let type;
        if (value instanceof Buffer)
            type = BUFFER_MESSAGES_TYPE_BIN;
        else if (typeof value=='string')
        {
            type = BUFFER_MESSAGES_TYPE_STRING;
            value = Buffer.from(value);
        }
        else
        {
            type = BUFFER_MESSAGES_TYPE_JSON;
            value = Buffer.from(JSON.stringify(value));
        }
        let new_bytes_size = this._bytes_size+1+BUFFER_MESSAGES_BIN_SZ
            +value.length;
        if (new_bytes_size>BUFFER_MESSAGES_MAX_LENGTH)
            throw `Buffers_array overflow ${new_bytes_size}`;
        this._bytes_size += 1+BUFFER_MESSAGES_BIN_SZ+value.length;
        this._buffer.push({type, value});
    }
    clean(){
        this._buffer = [];
        this._bytes_size = 3*BUFFER_MESSAGES_BIN_SZ;
    }
    get_buffer(){
        let buf = Buffer.allocUnsafe(this._bytes_size);
        buf.writeUInt32BE(0, 0);
        buf.writeUInt32BE(BUFFER_MESSAGES_CONTENT, BUFFER_MESSAGES_BIN_SZ);
        buf.writeUInt32BE(this._bytes_size, BUFFER_MESSAGES_BIN_SZ*2);
        let offset = 3*BUFFER_MESSAGES_BIN_SZ;
        for (let {type, value} of this._buffer)
        {
            buf.writeUInt8(type, offset);
            buf.writeUInt32BE(value.length, offset+1);
            value.copy(buf, offset = offset+1+BUFFER_MESSAGES_BIN_SZ);
            offset += value.length;
        }
        return buf;
    }
}

const make_ipc_server_class = ws_opt=>{
    if (ws_opt.ipc_server && !ws_opt.ipc_server_class)
        ws_opt.ipc_server_class = IPC_server_base.build(ws_opt);
};
const make_ipc_client_class = ws_opt=>{
    if (ws_opt.ipc_client && !ws_opt.ipc_client_class)
        ws_opt.ipc_client_class = IPC_client_base.build(ws_opt);
};

const counter_cache = {};
const make_counter = opt=>{
    const zcounter_glob = opt && opt.zcounter_glob;
    const cache_key = zcounter_glob ? 'glob_counter' : 'local_counter';
    if (counter_cache[cache_key])
        return counter_cache[cache_key];
    const counter = {};
    ['inc', 'inc_level', 'avg', 'max', 'min', 'set_level'].forEach(m=>{
        counter[m] = zcounter_glob ? zcounter[`glob_${m}`] : zcounter[m];
        counter[m] = counter[m].bind(zcounter);
    });
    counter_cache[cache_key] = counter;
    return counter;
};

class WS extends EventEmitter {
    constructor(opt){
        super();
        make_ipc_server_class(opt);
        make_ipc_client_class(opt);
        this.ws = undefined;
        this.data = opt.data;
        this.connected = false;
        this.reason = undefined;
        this.listen_bin_throttle = opt.listen_bin_throttle;
        this.zc_rx = opt.zcounter=='rx' || opt.zcounter=='all';
        this.zc_tx = opt.zcounter=='tx' || opt.zcounter=='all';
        this.zc_tx_per_cmd = this.zc_tx && opt.zcounter_tx_per_cmd;
        this.zc_mux = opt.zcounter=='mux' || opt.zcounter=='all';
        this.msg_log = assign({}, {treshold_size: null, print_size: 100},
            opt.msg_log);
        this.zc = opt.zc_label || (opt.zcounter ?
            opt.label ? internalize(`${opt.label}_ws`) : 'ws' : undefined);
        const zjson_opt = assign({}, zjson_opt_default, opt.zjson_opt);
        this.zjson_opt_send = assign({}, zjson_opt, opt.zjson_opt_send);
        this.zjson_opt_receive = assign({}, zjson_opt, opt.zjson_opt_receive);
        this.label = opt.label;
        this.remote_label = undefined;
        this.local_addr = undefined;
        this.local_port = undefined;
        this.remote_addr = undefined;
        this.remote_port = undefined;
        this.remote_forwarded = false;
        this.status = 'disconnected';
        if (this.ping = is_node && opt.ping!=false)
        {
            this.ping_interval = typeof opt.ping_interval=='function'
                ? opt.ping_interval() : opt.ping_interval || 60000;
            this.ping_timeout = typeof opt.ping_timeout=='function'
                ? opt.ping_timeout() : opt.ping_timeout || 10000;
            this.ping_timer = undefined;
            this.ping_expire_timer = undefined;
            this.ping_last = 0;
        }
        this.pong_received = true;
        this.refresh_ping_on_msg = opt.refresh_ping_on_msg!==false;
        this.idle_timeout = opt.idle_timeout;
        this.idle_timer = undefined;
        this.ipc = opt.ipc_client_class ? new opt.ipc_client_class(this)
            : undefined;
        if (opt.ipc_server_class)
            new opt.ipc_server_class(this);
        this.bin_methods = opt.bin_methods || this.ipc && this.ipc.bin_methods;
        this.time_parse = opt.time_parse;
        this.mux = opt.mux ? new Mux(this) : undefined;
        if ((this.zc || this.zc_mux) && !zcounter)
            zcounter = require('./zcounter.js');
        if (zcounter)
            this._counter = make_counter(opt);
        this._send_throttle_t = undefined;
        this._buffers = undefined;
    }
    _clean_throttle(){
        if (this._send_throttle_t)
        {
            clearTimeout(this._send_throttle_t);
            this._send_throttle_t = undefined;
        }
        this._buffers = undefined;
    }
    _send_throttle(msg, throttle_ts){
        this._buffers = this._buffers || new Buffers_array();
        this._buffers.push(msg);
        this._send_throttle_t = this._send_throttle_t || setTimeout(()=>{
            this._send_throttle_t = undefined;
            this.ws.send(this._buffers.get_buffer());
            this._buffers.clean();
        }, throttle_ts);
    }
    send(msg, opt){
        if (zerr.is.debug())
        {
            zerr.debug(typeof msg=='string'
                ? `${this}> str: ${string.trunc(msg, DEBUG_STR_LEN)}`
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
        if (opt && opt.bin_throttle)
            this._send_throttle(msg, opt.bin_throttle);
        else
            this.ws.send(msg, opt);
        if (this.zc_tx)
        {
            this._counter.inc(`${this.zc}_tx_msg`);
            this._counter.inc(`${this.zc}_tx_bytes`, msg.length);
            this._counter.avg(`${this.zc}_tx_bytes_per_msg`, msg.length);
        }
        if (this.zc_tx_per_cmd && opt && opt.cmd)
        {
            this._counter.inc(`${this.zc}.${opt.cmd}_tx_msg`);
            this._counter.inc(`${this.zc}.${opt.cmd}_tx_bytes`, msg.length);
            this._counter.avg(`${this.zc}.${opt.cmd}_tx_bytes_per_msg`,
                msg.length);
        }
        return true;
    }
    bin(data){
        data.msg = data.msg||Buffer.alloc(0);
        let cmd = data.cmd;
        let buf = Buffer.alloc(16 + cmd.length + data.msg.length);
        // [0|BUFFER_IPC_CALL|cookie|cmd length|...cmd bin|...cmd result bin]
        buf.writeUInt32BE(0, 0);
        buf.writeUInt32BE(BUFFER_IPC_CALL, 4);
        buf.writeUInt32BE(data.cookie, 8);
        buf.writeUInt32BE(cmd.length, 12);
        buf.write(cmd, 16);
        data.msg.copy(buf, 16+cmd.length);
        return this.send(buf, {cmd: data.cmd});
    }
    json(data){ return this.send(JSON.stringify(data), {cmd: data.cmd}); }
    zjson(data){
        return this.send(conv.JSON_stringify(data, this.zjson_opt_send),
            {cmd: data.cmd});
    }
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
            this._counter.inc(`${this.zc}_err_${code}`);
        this._check_status();
    }
    _close(close, code, reason){
        if (!this.ws)
            return;
        if (this.ping)
        {
            clearTimeout(this.ping_timer);
            clearTimeout(this.ping_expire_timer);
            this.ping_timer = undefined;
            this.ping_expire_timer = undefined;
            this.ping_last = 0;
            this.pong_received = true;
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
                zerr.info(`${this}: ws.terminate`);
                this.ws.terminate();
            }
            else
            {
                zerr.info(`${this}: ws.close`);
                this.ws.close(code, reason);
            }
        }
        this.ws = undefined;
        this.connected = false;
        this._clean_throttle();
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
        this.local_addr = internalize(sock.localAddress);
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
            this.pong_received = true; // skip first ping expiration
            this.ping_timer = setTimeout(()=>this._ping(), this.ping_interval);
            this.ping_expire_timer = setTimeout(()=>this._ping_expire(),
                this.ping_timeout);
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
            this._counter.inc(`${this.zc}_err`);
        this._close();
        this._check_status();
    }
    _on_unexpected_response(req, resp){
        this._on_error({message: 'unexpected response'});
        this.emit('unexpected-response');
    }
    _on_upgrade(resp){ zerr.debug(`${this}: upgrade conn`); }
    _on_message(event){
        let msg = event.data;
        if (msg instanceof ArrayBuffer)
            msg = Buffer.from(Buffer.from(msg)); // make a copy
        if (!this.listen_bin_throttle || !Buffers_array.is_buffer(msg))
            return this._on_message_base(msg);
        const messages = Buffers_array.parse(msg);
        for (let data of messages)
            this._on_message_base(data);
    }
    _on_message_base(msg){
        let handled = false, is_bin, bin_event;
        if (this.bin_methods && msg instanceof Buffer &&
            msg.readUInt32BE(0)===0 && msg.readUInt32BE(4)==BUFFER_CONTENT)
        {
            is_bin = true;
            let bin_event_len = msg.readUInt32BE(VFD_SZ);
            bin_event = JSON.parse(msg.slice(VFD_BIN_SZ,
                VFD_BIN_SZ+bin_event_len).toString());
            bin_event.msg = msg.slice(VFD_BIN_SZ+bin_event_len);
        }
        if (this.bin_methods && msg instanceof Buffer &&
            msg.readUInt32BE(0)===0 && msg.readUInt32BE(4)==BUFFER_IPC_CALL)
        {
            is_bin = true;
            let cookie = msg.readUInt32BE(8);
            let cmd_length = msg.readUInt32BE(12);
            let cmd = msg.slice(16, 16+cmd_length).toString();
            let res = msg.slice(16+cmd_length, msg.length - 16+cmd_length + 1);
            bin_event = {type: 'ipc_call', cookie, cmd, msg: res, bin: true};
        }
        if (zerr.is.debug())
        {
            zerr.debug(typeof msg=='string'
                ? `${this}< str: ${string.trunc(msg, DEBUG_STR_LEN)}`
                : `${this}< buf: ${msg.length} bytes`);
        }
        if (this.zc_rx)
        {
            this._counter.inc(`${this.zc}_rx_msg`);
            this._counter.inc(`${this.zc}_rx_bytes`, msg.length);
            this._counter.avg(`${this.zc}_rx_bytes_per_msg`, msg.length);
            this._counter.max(`${this.zc}_rx_bytes_per_msg_max`, msg.length);
        }
        try {
            if (is_bin)
            {
                this.emit('json', bin_event);
                handled = true;
            }
            if (typeof msg=='string')
            {
                let parsed;
                if (this._events.zjson)
                {
                    if (this.zc && this.time_parse)
                    {
                        const t = Date.now();
                        parsed = conv.JSON_parse(msg, this.zjson_opt_receive);
                        this._counter.inc(`${this.zc}_parse_zjson_ms`,
                            Date.now()-t);
                    }
                    else
                        parsed = conv.JSON_parse(msg, this.zjson_opt_receive);
                    this.emit('zjson', parsed);
                    handled = true;
                }
                if (this._events.json)
                {
                    if (this.zc && this.time_parse)
                    {
                        const t = Date.now();
                        parsed = parsed||JSON.parse(msg);
                        this._counter.inc(`${this.zc}_parse_json_ms`,
                            Date.now()-t);
                    }
                    else
                        parsed = parsed||JSON.parse(msg);
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
        if (this.refresh_ping_on_msg)
            this._refresh_ping_timers();
    }
    _on_pong(){
        this.pong_received = true;
        if (zerr.is.debug())
            zerr.debug(`${this}< pong (rtt ${Date.now()-this.ping_last}ms)`);
        if (this.zc)
            this._counter.avg(`${this.zc}_ping_ms`, Date.now()-this.ping_last);
    }
    _ping(){
        // don't send new ping if ping_timeout > ping_interval (weird case)
        if (!this.pong_received)
            return;
        this.pong_received = false;
        // workaround for ws library: the socket is already closing,
        // but a notification has not yet been emitted
        if (!this.connected || this.ws.readyState==2) // ws.CLOSING
            return;
        try { this.ws.ping(); }
        catch(e){ // rarer case: don't crash - post more logs
            return zerr('Ping attempt fail, for'
                +` ${JSON.stringify(this.inspect())} ${zerr.e2s(e)}`);
        }
        this._refresh_ping_timers();
        this.ping_last = Date.now();
        if (zerr.is.debug())
            zerr.debug(`${this}> ping (max ${this.ping_timeout}ms)`);
    }
    _ping_expire(){
        if (this.pong_received)
            return;
        this.abort(1002, 'Ping timeout');
    }
    _refresh_ping_timers(){
        if (!this.ping_timer || !this.ping_expire_timer)
            return;
        if (zutil.is_timer_refresh)
        {
            this.ping_timer.refresh();
            this.ping_expire_timer.refresh();
            return;
        }
        clearTimeout(this.ping_timer);
        this.ping_timer = setTimeout(()=>this._ping(), this.ping_interval);
        clearTimeout(this.ping_expire_timer);
        this.ping_expire_timer = setTimeout(()=>this._ping_expire(),
            this.ping_timeout);
    }
    _idle(){
        if (this.zc)
            this._counter.inc(`${this.zc}_idle_timeout`);
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
            this._counter.inc(`${this.zc}_err_${code}`);
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
        this.retry_chances = opt.retry_chances;
        this._retry_count = 0;
        this.lookup = opt.lookup;
        this.lookup_ip = opt.lookup_ip;
        this.fallback = opt.fallback &&
            assign({retry_threshold: 1, retry_mod: 5}, opt.fallback);
        this.headers = undefined;
        this.deflate = !!opt.deflate;
        this.agent = opt.agent;
        if (opt.e1008_exit_reason)
        {
            this.e1008_exit_reason = opt.e1008_exit_reason;
            this.e1008_ts_start = Date.now();
        }
        this.reason = undefined;
        this.reconnect_timer = undefined;
        this.server_no_mask_support = false;
        this.handshake_timeout = opt.handshake_timeout===undefined
            ? 50000 : opt.handshake_timeout;
        this.handshake_timer = undefined;
        if (this.zc)
            this._counter.inc_level(`level_${this.zc}_online`, 0, 'sum');
        if (opt.proxy)
        {
            let _lib = require('https-proxy-agent');
            this.agent = new _lib(opt.proxy);
        }
        if (is_node)
        {
            this.headers = assign(
                {'User-Agent': opt.user_agent||default_user_agent},
                opt.headers,
                {'client-no-mask-support': 1});
        }
        this._connect();
    }
    // we don't want WS to emit 'destroyed', Client controls it by itself,
    // because it supports reconnects
    _on_disconnected(){}
    send(msg){
        return super.send(msg,
            this.server_no_mask_support ? {mask: false} : undefined);
    }
    _on_message(ev){
        if (!this.server_no_mask_support && ev.data===SERVER_NO_MASK_SUPPORT)
        {
            this.server_no_mask_support = true;
            return void this.emit(SERVER_NO_MASK_SUPPORT);
        }
        return super._on_message(ev);
    }
    _assign(ws){
        super._assign(ws);
        if (this.zc)
            this._counter.inc_level(`level_${this.zc}_online`, 1, 'sum');
    }
    _close(close, code, reason){
        if (this.zc && this.ws)
            this._counter.inc_level(`level_${this.zc}_online`, -1, 'sum');
        if (this.handshake_timer)
            this.handshake_timer = clearTimeout(this.handshake_timer);
        super._close(close, code, reason);
    }
    _connect(){
        this.reason = undefined;
        this.reconnect_timer = undefined;
        this.server_no_mask_support = false;
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
            this._counter.inc(`${this.zc}_fallback`, url==this.url ? 0 : 1);
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
        if (this.retry_chances && this._retry_count >= this.retry_chances-1)
        {
            this.close();
            this.emit('out_of_retries');
            return false;
        }
        this.emit('reconnecting');
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
    _handle_e1008(event){
        if (!this.e1008_exit_reason)
            return;
        if (event.code != 1008 || this.e1008_exit_reason != event.reason)
            return;
        if (!this.no_retry && Date.now()-this.e1008_ts_start < 60000)
            return;
        zerr.zexit(`Got '${event.reason}' from ${event.target.url}`);
    }
    _on_close(event){
        this._handle_e1008(event);
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
        make_ipc_server_class(opt);
        make_ipc_client_class(opt);
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
        const impl = server_impl(opt);
        this.ws_server = new impl.Server(ws_opt);
        this.server_no_mask_support = impl.server_no_mask_support;
        this.opt = opt;
        this.label = opt.label;
        this.connections = new Set();
        this.zc = opt.zcounter!=false ? opt.label ? `${opt.label}_ws` : 'ws'
            : undefined;
        this.ws_server.addListener('connection', this.accept.bind(this));
        if (opt.port)
            zerr.notice(`${this}: listening on port ${opt.port}`);
        if (!zcounter)
            zcounter = require('./zcounter.js');
        this._counter = make_counter(opt);
        // ensure the metric exists, even if 0
        if (this.zc)
            this._counter.inc_level(`level_${this.zc}_conn`, 0, 'sum');
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
        if (this.opt.conn_max_event_listeners!==undefined)
            zws.setMaxListeners(this.opt.conn_max_event_listeners);
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
        if (this.server_no_mask_support && headers['client-no-mask-support'])
            zws.send(SERVER_NO_MASK_SUPPORT);
        this.connections.add(zws);
        if (this.zc)
        {
            this._counter.inc(`${this.zc}_conn`);
            this._counter.inc_level(`level_${this.zc}_conn`, 1, 'sum');
        }
        zws.addListener('disconnected', ()=>{
            this.connections.delete(zws);
            if (this.zc)
                this._counter.inc_level(`level_${this.zc}_conn`, -1, 'sum');
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
                ? `${this}> broadcast str: ${string.trunc(msg, DEBUG_STR_LEN)}`
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

let ipc_clients_cookie = 0;
const ERROR_CODES = {bad_ipc_call_attempt: 'bad_ipc_call_attempt'};
class IPC_client_base {
    static build(ws_opt){
        const ipc_opt = {
            zjson: ws_opt.ipc_zjson,
            mux: ws_opt.mux,
        };
        class IPC_client extends IPC_client_base {
            constructor(zws){
                super(zws, ipc_opt);
            }
        }
        if (Array.isArray(ws_opt.ipc_client))
        {
            for (const name of ws_opt.ipc_client)
            {
                Object.defineProperty(IPC_client.prototype, name, {value:
                    function(...arg){ return this._call(ipc_opt, name, arg); },
                    writable: true});
            }
            return IPC_client;
        }
        for (const [name, spec] of Object.entries(ws_opt.ipc_client))
        {
            const opt = assign({}, ipc_opt,
                typeof spec=='string' ? {type: spec} : spec);
            // ability to transfer Buffer as is, without JSON conversion
            if ((opt.bin||opt.send_bin) && !IPC_client.prototype.bin_methods)
            {
                Object.defineProperty(IPC_client.prototype, 'bin_methods',
                    {value: true});
            }
            let fn;
            switch (opt.type||'call')
            {
            case 'call':
                fn = function(...arg){ return this._call(opt, name, arg); };
                break;
            case 'post':
                fn = function(...arg){ return this._post(opt, name, arg); };
                break;
            case 'mux':
                fn = function(...arg){ return this._mux(opt, name, arg); };
                break;
            default:
                zerr.zexit(`${ws_opt.label} ${name}: Invalid IPC client spec`);
            }
            Object.defineProperty(IPC_client.prototype, name,
                {value: fn, writable: true});
        }
        return IPC_client;
    }
    constructor(zws, opt){
        this.mux = opt.mux;
        this._vfd = opt.mux ? opt.mux.start_vfd==undefined ? 2147483647
            : opt.mux.start_vfd : 0;
        this._ws = zws;
        this._pending = new Map();
        this._ws.addListener(json_event(opt.zjson), this._on_resp.bind(this));
        this._ws.addListener('status', this._on_status.bind(this));
        this._ws.addListener('destroyed',
            this._on_status.bind(this, 'destroyed'));
    }
    pending_count(){
        return this._pending.size;
    }
    _call(opt, cmd, arg){
        const _this = this;
        const send_retry_timeout = 3*SEC;
        let timeout;
        if (opt.timeout!==null)
        {
            timeout = typeof opt.timeout=='function' ? opt.timeout()
                : opt.timeout||5*MIN;
        }
        return etask(function*IPC_client_call(){
            let req = {
                type: opt.type=='mux' ? 'ipc_mux' : 'ipc_call',
                cmd,
                cookie: ++ipc_clients_cookie,
                bin: opt.bin ? 1 : undefined
            };
            _this._req_set_arg(req, arg);
            this.info.label = ()=>_this._ws.toString();
            this.info.cmd = cmd;
            this.info.cookie = req.cookie;
            _this._pending.set(req.cookie, this);
            this.finally(()=>_this._pending.delete(req.cookie));
            if (timeout)
            {
                this.alarm(timeout, ()=>{
                    let e = new Error(`${cmd} timeout`);
                    e.code = 'ipc_timeout';
                    this.throw(e);
                });
            }
            let res = {status: _this._ws.status}, prev;
            while (res.status)
            {
                switch (res.status)
                {
                case 'disconnected':
                    if (opt.retry==false || !_this._ws.reconnect_timer)
                        throw _this._err_ipc_call();
                    break;
                case 'connecting':
                    if (opt.retry==false)
                        throw _this._err_ipc_call('Connection not ready');
                    break;
                case 'destroyed':
                    throw _this._err_ipc_call();
                case 'connected':
                    while (!_this._send(opt, req))
                    {
                        if (opt.retry==false)
                            throw _this._err_ipc_call();
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
    _post(opt, cmd, arg){
        let req = {type: 'ipc_post', cmd};
        this._req_set_arg(req, arg);
        this._send(opt, req);
    }
    _mux(opt, cmd, arg)
    {
        if (!this._ws.mux)
            throw new Error('Mux is not defined');
        const _this = this;
        const vfd = this.mux.dec_vfd ? --this._vfd : ++this._vfd;
        return etask(function*IPC_client__mux(){
            let stream = _this._ws.mux.open(vfd, _this.mux.bytes_allowed,
                _this.mux);
            stream.close = ()=>_this._ws.mux.close(vfd);
            arg.unshift(vfd);
            yield _this._call(opt, cmd, arg);
            return stream;
        });
    }
    _req_set_arg(req, arg){
        if (arg.length==1)
            req.msg = arg[0];
        else if (arg)
            req.arg = arg;
    }
    _send(opt, req){
        if (opt.send_bin)
            return this._ws.bin(req);
        if (opt.zjson)
            return this._ws.zjson(req);
        return this._ws.json(req);
    }
    _err_ipc_call(msg = this._ws.reason||'Connection closed'){
        let e = new Error(msg);
        e.code = ERROR_CODES.bad_ipc_call_attempt;
        return e;
    }
    _on_resp(msg){
        if (!msg || msg.type!='ipc_result' && msg.type!='ipc_error')
            return;
        let task = this._pending.get(msg.cookie);
        if (!task)
        {
            this._ws.emit('ipc_resp_miss', msg);
            if (zerr.is.info())
                zerr.info(`${this._ws}: unexpected IPC cookie ${msg.cookie}`);
            return;
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
}

class IPC_server_base {
    static build(ws_opt){
        const ipc_opt = {
            zjson: ws_opt.ipc_zjson,
            sync: ws_opt.ipc_sync,
            call_zerr: ws_opt.ipc_call_zerr,
            mux: ws_opt.mux,
        };
        const specs = Array.isArray(ws_opt.ipc_server)
            ? ws_opt.ipc_server.reduce((o, name)=>(o[name] = true, o), {})
            : ws_opt.ipc_server;
        class IPC_server_methods {
            constructor(zws){
                this._zws = zws;
            }
        }
        Object.setPrototypeOf(IPC_server_methods.prototype, null);
        for (const name in specs)
        {
            const value = specs[name]===true
                ? function(arg){ return this._zws.data[name]
                    .apply(this._zws.data||this._zws, arg); }
                : function(arg){ return specs[name]
                    .apply(this._zws.data||this._zws, arg); };
            Object.defineProperty(IPC_server_methods.prototype, name,
                {value, writable: true});
        }
        return class IPC_server extends IPC_server_base {
            constructor(zws){
                super(zws, ipc_opt);
                this.methods = new IPC_server_methods(zws);
            }
        };
    }
    constructor(zws, opt){
        this.ws = zws;
        this.mux = opt.mux;
        this.zjson = !!opt.zjson;
        this.sync = !!opt.sync;
        this.call_zerr = !!opt.call_zerr;
        this.pending = this.sync ? undefined : new Set();
        if (this.sync)
            zws.addListener(json_event(this.zjson), v=>this._on_call_sync(v));
        else
        {
            zws.addListener(json_event(this.zjson), v=>this._on_call_async(v));
            zws.addListener('disconnected', this._on_disconnected.bind(this));
        }
    }
    _on_call_sync(msg){
        if (!msg || !msg.cmd)
            return;
        if (!msg.type || msg.type=='ipc_call')
            return void new IPC_server_resp_call_sync(this, msg);
        if (msg.type=='ipc_post')
            return void new IPC_server_resp_post_sync(this, msg);
        if (msg.type=='ipc_mux')
            return void new IPC_server_resp_mux_sync(this, msg);
    }
    _on_call_async(msg){
        if (!msg || !msg.cmd)
            return;
        if (!msg.type || msg.type=='ipc_call')
            return void new IPC_server_resp_call_async(this, msg);
        if (msg.type=='ipc_post')
            return void new IPC_server_resp_post_async(this, msg);
        if (msg.type=='ipc_mux')
            return void new IPC_server_resp_mux_async(this, msg);
    }
    _on_disconnected(){
        for (let task of this.pending)
            task.return();
    }
}
class IPC_server_resp {
    constructor(ipc, msg){
        this.ipc = ipc;
        this.msg = msg;
        if (typeof ipc.methods[msg.cmd] != 'function')
            return void this.no_method(`Method ${msg.cmd} not defined`);
        this.arg = msg.arg||[msg.msg];
        this.pre_handle();
        this.handle();
    }
    pre_handle(){}
    handle(){}
    add_pending(et){}
    response(rv){}
    fail(e){
        if (is_node && +process.env.WS_ZEXIT_ON_TYPEERROR && zerr.on_exception)
            zerr.on_exception(e);
        if (this.ipc.call_zerr)
            zerr(`${this.ipc.ws}: ${this.msg.cmd}: ${zerr.e2s(e)}`);
        this.ipc.ws.json({
            type: 'ipc_error',
            cmd: this.msg.cmd,
            cookie: this.msg.cookie,
            msg: e.message || String(e),
            err_code: e.code,
        });
    }
    json(res){
        if (this.ipc.zjson)
            return void this.ipc.ws.zjson(res);
        this.ipc.ws.json(res);
    }
}
class IPC_server_resp_sync extends IPC_server_resp {
    handle(){
        try { this.response(this.ipc.methods[this.msg.cmd](this.arg)); }
        catch(e){ this.fail(e); }
    }
}
class IPC_server_resp_async extends IPC_server_resp {
    handle(){ const _this = this; etask(function*IPC_server_handle(){
        _this.add_pending(this);
        this.info.label = ()=>_this.ipc.ws.toString();
        this.info.cmd = _this.msg.cmd;
        this.info.cookie = _this.msg.cookie;
        try { _this.response(
            yield _this.ipc.methods[_this.msg.cmd](_this.arg)); }
        catch(e){ _this.fail(e); }
    }); }
}
const ipcsr_call_make = parent=>class IPC_server_call extends parent {
    no_method(err){
        this.ipc.ws.json({
            type: 'ipc_error',
            cmd: this.msg.cmd,
            cookie: this.msg.cookie,
            msg: err,
        });
    }
    response(rv){
        if (this.msg.bin && rv instanceof Buffer)
            return void this.response_buf(rv);
        this.json({
            type: 'ipc_result',
            cmd: this.msg.cmd,
            cookie: this.msg.cookie,
            msg: rv,
        });
    }
    response_buf(rv){
        const res_buf = Buffer.from(JSON.stringify({
            type: 'ipc_result',
            cmd: this.msg.cmd,
            cookie: this.msg.cookie,
        }));
        // [0|BUFFER_CONTENT|cmd length|...cmd bin|...cmd result bin]
        const buf = Buffer.allocUnsafe(rv.length+VFD_BIN_SZ+res_buf.length);
        buf.writeUInt32BE(0, 0);
        buf.writeUInt32BE(BUFFER_CONTENT, 4);
        buf.writeUInt32BE(res_buf.length, VFD_SZ);
        res_buf.copy(buf, VFD_BIN_SZ);
        rv.copy(buf, VFD_BIN_SZ+res_buf.length);
        this.ipc.ws.send(buf);
    }
};
const IPC_server_resp_call_sync = ipcsr_call_make(IPC_server_resp_sync);
const IPC_server_resp_call_async = ipcsr_call_make(IPC_server_resp_async);
const ipcsr_post_make = parent=>class IPC_server_post extends parent {
    no_method(err){
        zerr(`${this.ipc.ws}: ${err}`);
    }
    add_pending(et){
        this.ipc.pending.add(et);
        et.finally(()=>this.ipc.pending.delete(et));
    }
    fail(e){
        zerr(`${this.ipc.ws}: ${this.msg.cmd}: ${zerr.e2s(e)}`);
    }
};
const IPC_server_resp_post_sync = ipcsr_post_make(IPC_server_resp_sync);
const IPC_server_resp_post_async = ipcsr_post_make(IPC_server_resp_async);
const ipcsr_mux_make = parent=>class IPC_server_mux extends parent {
    no_method(err){
        this.ipc.ws.json({
            type: 'ipc_error',
            cmd: this.msg.cmd,
            cookie: this.msg.cookie,
            msg: err,
        });
    }
    pre_handle(){
        if (!this.ipc.ws.mux)
        {
            return this.ipc.ws.json({
                type: 'ipc_error',
                cmd: this.msg.cmd,
                cookie: this.msg.cookie,
                msg: 'Mux is not defined',
            });
        }
        const vfd = this.arg.shift();
        const stream = this.ipc.ws.mux.open(vfd, this.ipc.mux.bytes_allowed,
            this.ipc.mux);
        stream.close = ()=>this.ipc.ws.mux.close(vfd);
        this.arg.unshift(stream);
        this.json({
            type: 'ipc_result',
            cmd: this.msg.cmd,
            cookie: this.msg.cookie,
        });
    }
    add_pending(et){
        this.ipc.pending.add(et);
        et.finally(()=>this.ipc.pending.delete(et));
    }
};
const IPC_server_resp_mux_sync = ipcsr_mux_make(IPC_server_resp_sync);
const IPC_server_resp_mux_async = ipcsr_mux_make(IPC_server_resp_async);

// XXX vladislavl: remove _bp methods once ack version tested and ready
class Mux {
    constructor(zws){
        this.ws = zws;
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
                let buf = Buffer.allocUnsafe(data.length+VFD_SZ);
                buf.writeUInt32BE(vfd, 0);
                buf.writeUInt32BE(0, 4);
                data.copy(buf, VFD_SZ);
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
        stream.create_ts = Date.now();
        stream.prependListener('data', function(chunk){
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
            zerr('\n--- assert failed, socketinfo:\n'+
                `DEBUG HEADER: ${this._httpMessage._header}\n`+
                `DEBUG WS: ${_this.ws.remote_addr}:${_this.ws.remote_port}`);
            const old_parser = this.parser;
            const parser = this.parser = parsers.alloc();
            const old_execute = parser.execute;
            parser.socket = this;
            parser.execute = buf=>{
                parser.execute = old_execute;
                this.parser = old_parser;
                return Object.assign(new Error('Mux Duplex parser removed '+
                    'before data consumed'),
                    {code: 'ws_mutex.parsed_removed'});
            };
        });
        stream.allow = (bytes=Infinity)=>{
            bytes_allowed = bytes;
            if (bytes_allowed<=0 || !suspended)
                return;
            suspended();
            suspended = undefined;
        };
        stream.setNoDelay = ()=>{};
        // XXX vladimir: rm custom '_close' event
        // not using 'close' event due to confusion with socket close event
        // which is emitted async after handle closed
        stream.on('_close', ()=>{
            if (this.streams.delete(vfd))
            {
                zerr.info(`${this.ws}: vfd ${vfd} closed`);
                let zc = this.ws.zc;
                if (zc)
                {
                    this.ws._counter.inc_level(`level_${zc}_mux_vfd`,
                        -1, 'sum');
                }
            }
        });
        this.streams.set(vfd, stream);
        zerr.info(`${this.ws}: vfd ${vfd} open`);
        if (this.ws.zc)
        {
            this.ws._counter.inc_level(`level_${this.ws.zc}_mux_vfd`,
                1, 'sum');
        }
        return stream;
    }
    open_ack(vfd, opt={}){
        const _lib = require('stream');
        const _this = this;
        const bin_throttle_opt = opt && opt.bin_throttle ?
            {bin_throttle: opt.bin_throttle} : null;
        opt.fin_timeout = opt.fin_timeout||10*SEC;
        const zasync = opt.zasync && is_node || false;
        const w_log = (e, str)=>
            zerr.warn(`${_this.ws}: ${str}: ${vfd}-${zerr.e2s(e)}`);
        let pending, zfin_pending, send_ack_timeout, send_ack_ts = 0;
        const stream = new _lib.Duplex(assign({
            read(size){},
            write(data, encoding, cb){
                const {buf, buf_pending} = stream.process_data(data);
                if (buf)
                {
                    if (!_this.ws.send(buf, bin_throttle_opt))
                        return cb(new Error(_this.ws.reason||_this.ws.status));
                    stream.sent += buf.length-VFD_SZ;
                    stream.last_use_ts = Date.now();
                }
                if (zerr.is.debug())
                {
                    zerr.debug(`${_this.ws}> vfd ${vfd} sent ${stream.sent} `
                        +`ack ${stream.ack} win_size ${stream.win_size}`);
                }
                if (!buf_pending || !buf_pending.length)
                    return void (zasync ? setImmediate(cb) : cb());
                pending = etask(function*_mux_stream_pending(){
                    yield this.wait();
                    pending = null;
                    stream._write(buf_pending, encoding, cb);
                });
            },
            // only Buffer chuncks supported
            writev: opt.decodeStrings===false ? null : function(chunks, cb){
                stream._write(Buffer.concat(chunks.map(item=>item.chunk)),
                    null, cb);
            },
            destroy(err, cb){ return etask(function*_mux_stream_destroy(){
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
                if (zfin_pending)
                    zfin_pending.continue();
                if (err) // don't try to end/finish stream gracefully if error
                    yield zfinish(false, false, err);
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
            if (!stream.win_size_got)
                stream.win_size = size||Infinity;
        };
        stream.process_data = data=>{
            let bytes = Math.min(stream.win_size-(stream.sent-stream.ack),
                data.length);
            if (bytes<=0)
                return {buf_pending: data};
            const buf = Buffer.allocUnsafe(bytes+VFD_SZ);
            buf.writeUInt32BE(vfd, 0);
            buf.writeUInt32BE(0, 4);
            data.copy(buf, VFD_SZ, 0, bytes);
            if (bytes==data.length)
                return {buf};
            const buf_pending = Buffer.allocUnsafe(data.length-bytes);
            data.copy(buf_pending, 0, bytes);
            return {buf, buf_pending};
        };
        const zfinish = (end_write, wait_rmt, err)=>etask(function*_zfinish(){
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
                    catch(_e){ w_log(_e, 'fin_wait2'); }
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
            stream.send_fin(opt.emit_socket_error ? err : undefined);
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
        stream.win_size = DEFAULT_WIN_SIZE;
        stream.sent = stream.ack = stream.zread = 0;
        stream.fin_got = false;
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
            zerr('\n--- assert failed, socketinfo:\n'+
                `DEBUG HEADER: ${this._httpMessage._header}\n`+
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
            _this.ws.send(`{"vfd":${vfd},"ack":${stream.zread}}`,
                bin_throttle_opt);
            send_ack_ts = Date.now();
        };
        stream.send_ack = !throttle_ack ? _send_ack : ()=>{
            if (send_ack_timeout)
                return;
            // XXX igors: send ack in throttle ms
            if (!send_ack_ts && opt.delayed_ack)
                send_ack_ts = Date.now();
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
            if (_this.ws.zc_mux)
                this.ws._counter.inc(`${_this.ws.zc||'unknown'}_mux_on_ack`);
        };
        stream.send_win_size = ()=>{
            if (stream.win_size_sent)
                return;
            _this.ws.send(
                `{"vfd":${vfd},"win_size":${opt.win_size||DEFAULT_WIN_SIZE}}`,
                bin_throttle_opt);
            stream.win_size_sent = true;
        };
        stream.on_win_size = size=>{
            stream.win_size = size;
            stream.win_size_got = true;
            if (pending)
                pending.continue();
        };
        stream.send_fin = error=>{
            if (send_ack_timeout)
            {
                clearTimeout(send_ack_timeout);
                _send_ack();
            }
            if (bin_throttle_opt)
            {
                _this.ws.send(error ? {vfd, fin: 1, error}
                    : `{"vfd":${vfd},"fin":1}`, bin_throttle_opt);
            }
            else if (error)
                _this.ws.json({vfd, fin: 1, error});
            else
                _this.ws.send(`{"vfd":${vfd},"fin":1}`);
            stream.fin_sent = true;
        };
        stream.on_fin = msg=>{
            stream.fin_got = true;
            if (_this.ws.zc_mux)
                this.ws._counter.inc(`${_this.ws.zc||'unknown'}_mux_on_fin`);
            const fn = ()=>next_tick(()=>zfin_pending ?
                zfin_pending.continue() : zfinish(true, false));
            etask(function*_mux_stream_on_fin(){
                stream.once('end', this.continue_fn());
                try {
                    if (opt.emit_socket_error && msg && msg.error)
                        stream.emit('error', msg.error);
                    else
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
            if (!timeout || stream.zdestroy)
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
        stream.setNoDelay = ()=>{};
        // XXX vladislavl: rm custom '_close' event: svc_bridge uses it
        stream.on('_close', ()=>{
            if (!this.streams.delete(vfd))
                return;
            if (zerr.is.info())
                zerr.info(`${this.ws}: vfd ${vfd} closed`);
            let zc = this.ws.zc;
            if (zc)
                this.ws._counter.inc_level(`level_${zc}_mux`, -1, 'sum');
        });
        this.streams.set(vfd, stream);
        if (zerr.is.info())
            zerr.info(`${this.ws}: vfd ${vfd} open`);
        if (this.ws.zc)
            this.ws._counter.inc_level(`level_${this.ws.zc}_mux`, 1, 'sum');
        if (opt.compress || opt.decompress)
        {
            if (!SnappyStream || !UnsnappyStream)
                ({SnappyStream, UnsnappyStream} = require('snappystream'));
            const snappy_s = opt.compress ? new SnappyStream() :
                new UnsnappyStream();
            const ensure_snappy_destroyed = ()=>{
                if (snappy_s.destroyed)
                    return;
                setTimeout(()=>snappy_s.destroy(), 30*SEC);
            };
            stream.pipe(snappy_s).pipe(stream);
            snappy_s.once('close', ()=>this.ws.mux.close(vfd));
            stream.once('close', ensure_snappy_destroyed);
            return snappy_s;
        }
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
    _on_bin(buf){
        if (this.ws.bin_methods && buf.readUInt32BE(0)===0 &&
            buf.readUInt32BE(4)==BUFFER_CONTENT)
        {
            return;
        }
        if (this.listen_bin_throttle && Buffers_array.is_buffer(buf))
            return zerr(`${this.ws}: unexpected Buffers_array on bin event`);
        if (buf.length<VFD_SZ)
            return zerr(`${this.ws}: malformed binary message`);
        let vfd = buf.readUInt32BE(0);
        if (zerr.is.debug())
            zerr.debug(`${this.ws}< vfd ${vfd}`);
        let stream = this.streams.get(vfd);
        if (!stream)
            return zerr(`${this.ws}: unexpected stream vfd ${vfd}`);
        if (!stream.on_ack)
            return stream.push(buf.slice(VFD_SZ));
        try {
            stream.send_win_size();
            stream.push(buf.slice(VFD_SZ));
        } catch(e){
            zerr(`${this.ws}: ${zerr.e2s(e)}`);
            throw e;
        }
    }
    _on_json(msg){
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
            return void stream.on_fin(msg);
        stream.emit('unexpected_ack', msg);
        zerr(`${this.ws}: unexpected json_ack %O`, msg);
        if (this.ws.zc)
            this.ws._counter.inc('mux_unexpected_ack');
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
    const impl = opt.impl || (is_win || is_darwin ? 'ws' : 'uws');
    const l = lib(impl);
    // XXX mikhailpo: disabled due to SIGSEGV err
    l.server_no_mask_support = false; // l.server_no_mask_support||impl=='ws';
    return l;
}

return {Client, Server, Mux, t: {WS, IPC_server_base}, ERROR_CODES};

}); }());
