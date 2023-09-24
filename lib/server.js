// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true, evil: true*/
const events = require('events');
const https = require('https');
const dns = require('dns');
const url = require('url');
const net = require('net');
const fs = require('fs');
const {Readable} = require('stream');
const stream = require('stream');
const util = require('util');
const http_shutdown = require('http-shutdown');
const request = require('request');
const winston = require('winston');
const stringify = require('json-stable-stringify');
const {Netmask} = require('netmask');
const qw = require('../util/string.js').qw;
const lpm_config = require('../util/lpm_config.js');
const zfile = require('../util/file.js');
const zerr = require('../util/zerr.js');
const date = require('../util/date.js');
const etask = require('../util/etask.js');
const zutil = require('../util/util.js');
const zurl = require('../util/url.js');
const Smtp = require('./smtp.js');
const ssl = require('./ssl.js');
const Ws = require('./ws.js');
const lutil = require('./util.js');
const {write_http_reply, find_iface, ensure_socket_close, get_host_port,
    req_util, res_util, Timeouts, ensure_socket_emit_close,
    is_redirect_status, REDIRECT_PARTS} = lutil;
const requester = require('./requester.js');
const username = require('./username.js');
const sessions = require('./session.js');
const Context = require('./context.js');
const Router = require('./router.js');
const Rules = require('./rules.js');
const Ip_cache = require('./ip_cache.js');
const Throttle_mgr = require('./throttle_mgr.js');
const consts = require('./consts.js');
const Https_agent = require('./https_agent.js');
let hosts_cursor = 0, super_proxy_ports_cursor = 0, req_list = new Set();

const {SEC} = date.ms, MAX_REDIRECTS = 10;
const E = module.exports = Server;
E.default = Object.assign({}, lpm_config.server_default);
E.dropin = {
    port: E.default.proxy_port,
    listen_port: E.default.proxy_port,
};
const ip_re = /^(https?:\/\/)?(\d+\.\d+\.\d+\.\d+)([$/:?])/i;
const logs_remote_ignore_ctx = ['PROXY TESTER TOOL', 'STATUS CHECK'];

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

const get_content_type = data=>{
    if (data.response_body=='unknown')
        return 'unknown';
    let content_type;
    let res = 'other';
    try {
        const headers = JSON.parse(data.response_headers);
        content_type = headers['content-type']||'';
    } catch(e){ content_type = ''; }
    if (content_type.match(/json/))
        res = 'xhr';
    else if (content_type.match(/html/))
        res = 'html';
    else if (content_type.match(/javascript/))
        res = 'js';
    else if (content_type.match(/css/))
        res = 'css';
    else if (content_type.match(/image/))
        res = 'img';
    else if (content_type.match(/audio|video/))
        res = 'media';
    else if (content_type.match(/font/))
        res = 'font';
    return res;
};

E.create_count_stream = (resp, limit)=>new stream.Transform({
    transform(data, encoding, cb){
        if (limit!=-1 && (!limit || resp.body_size<limit))
        {
            const chunk = limit ? limit-resp.body_size : Infinity;
            resp.body.push(data.slice(0, chunk));
        }
        resp.body_size += data.length;
        cb(null, data);
    },
});

const is_custom_error = e=>e.custom || e.message=='Authentication failed';

function Server(opt, worker){
    events.EventEmitter.call(this);
    this.active = 0;
    this.sp = etask(function*server_listen_constructor(){
        return yield this.wait();
    });
    opt.listen_port = opt.listen_port || opt.port || E.default.port;
    opt = this.opt = Object.assign({}, E.default, opt);
    this.timeouts = new Timeouts();
    this.worker = worker;
    this.cache = worker.cache;
    this.ensure_socket_close = ensure_socket_close;
    this.ensure_socket_emit_close = ensure_socket_emit_close;
    this.ws_handler = new Ws();
    this.socket2headers = new Map();
    this.bw_limit_exp = false;
    this.init_tcp_server();
    this.on('response', resp=>this.usage(resp));
    this.https_agent = new Https_agent({
        keepAlive: true,
        keepAliveMsecs: 5000,
        maxFreeSockets: 50,
    });
    this.setMaxListeners(30);
    this.update_config(opt);
}

util.inherits(E, events.EventEmitter);

E.prototype.update_hosts = function(hosts, cn_hosts){
    this.hosts = (hosts||[this.opt.proxy]).slice();
    this.cn_hosts = (cn_hosts||[]).slice();
};

E.prototype.set_opt = function(opt){
    Object.assign(this.opt, opt);
};

E.prototype.update_config = function(opt){
    if (this.session_mgr)
        this.session_mgr.stop();
    opt = this.opt = Object.assign({}, this.opt, opt);
    this.logger = require('./logger.js').child({category: `[${opt.port}]`});
    this.logger.set_level(opt.log);
    this.req_logger = winston.loggers.get('reqs');
    if (opt.zagent && opt.logs_settings)
        this.remote_logger = this.logger.create_remote(opt.logs_settings);
    this.reverse_lookup = null;
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
    opt.use_flex_tls = opt.zagent && opt.tls_lib=='flex_tls';
    this.update_hosts(this.opt.hosts, this.opt.cn_hosts);
    this.requester = requester.create_requester(this.opt);
    this.router = new Router(opt);
    if (this.rules && this.rules.av_client)
        this.rules.close_av_client();
    this.rules = new Rules(this, opt.rules, opt.av_check && opt.av_server_url);
    this.session_mgr = new sessions.Sess_mgr(this, opt);
    this.banlist = new Ip_cache(opt.banlist);
    this.throttle_mgr = Throttle_mgr.init(this, opt.throttle);
    this.session_mgr.on('response', r=>this.emit('response', r));
    this.smtp_server = new Smtp(this, {
        port: opt.port,
        log: opt.log,
        ips: opt.smtp,
    });
    this.update_lb_ips(opt);
    this.update_bw_limit(opt);
};

E.prototype.update_bw_limit = function(opt){
    opt = this.opt = Object.assign({}, this.opt, opt);
    let bw_limit_exp = zutil.get(opt, `bw_limit.expires.${opt.port}`);
    bw_limit_exp = bw_limit_exp && date(bw_limit_exp);
    this.bw_limit_exp = opt.zagent && bw_limit_exp instanceof Date &&
        !isNaN(bw_limit_exp.getTime()) && bw_limit_exp;
    if (this.bw_limit_exp)
        this.close_all_reqs();
};

E.prototype.update_lb_ips = function(opt){
    this.opt = Object.assign(this.opt, opt);
    this.lb_ips = new Set(opt.lb_ips||[]);
};

E.prototype.get_req_remote_ip = function(req){
    if (req.original_ip)
        return req.original_ip;
    if (req.socket)
    {
        let ip;
        if (ip = this.worker.socks_server.get_remote_ip(req.socket.remotePort))
            return ip;
        if (req.socket._parent && req.socket._parent.lpm_forwarded_for)
            return req.socket._parent.lpm_forwarded_for;
        if (req.socket.lpm_forwarded_for)
            return req.socket.lpm_forwarded_for;
        if (req.socket.socket && req.socket.socket.lpm_forwarded_for)
            return req.socket.socket.lpm_forwarded_for;
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

E.prototype.init_tcp_server = function(){
    this.tcp_server = new net.createServer(socket=>{
        this.tcp_server.running = true;
        socket.setTimeout(this.opt.socket_inactivity_timeout);
        socket.once('error', err=>null);
        socket.once('timeout', ()=>this.ensure_socket_close(socket));
        const is_lb_req = this.lb_ips.has(socket.remoteAddress);
        const is_smtp_req = this.opt.smtp && this.opt.smtp.length;
        if (!is_lb_req && is_smtp_req)
            return this.smtp_server.connect(socket);
        let lb_transform_stream;
        if (is_lb_req)
        {
            lb_transform_stream = new lutil.Lb_transform();
            lb_transform_stream.on('parsed', ({remote_ip})=>{
                socket.lpm_forwarded_for = remote_ip;
                if (is_smtp_req)
                {
                    socket.unpipe(lb_transform_stream);
                    this.smtp_server.connect(socket);
                    socket.resume();
                }
            });
            socket.pipe(lb_transform_stream);
            if (is_smtp_req)
                return;
        }
        else if (is_smtp_req)
            return this.smtp_server.connect(socket);
        (lb_transform_stream||socket).once('data', data=>{
            if (lb_transform_stream)
                socket.unpipe(lb_transform_stream);
            if (!this.tcp_server.running)
                return socket.end();
            socket.pause();
            const protocol_byte = data[0];
            socket.lpm_server = this;
            // first byte of TLS handshake is 0x16 = 22 byte
            if (protocol_byte==22)
                this.worker.tls_server.emit('connection', socket);
            // any non-control ASCII character
            else if (32<protocol_byte && protocol_byte<127)
                this.worker.http_server.emit('connection', socket);
            // initial greeting from SOCKS5 client is 0x05 = 5 byte
            else if (protocol_byte==5)
            {
                this.worker.socks_server.connect(socket, {
                    port: this.opt.port,
                    remote_ip: socket.lpm_forwarded_for||socket.remoteAddress,
                    is_whitelisted_ip: this.is_whitelisted_ip.bind(this),
                });
            }
            else
                socket.end();
            socket.unshift(data);
            socket.resume();
        });
    });
    http_shutdown(this.tcp_server);
};

E.prototype.process_x_ports_header = req=>{
    let header = req.headers && req.headers['x-lpm-ports'];
    if (!header)
        return;
    delete req.headers['x-lpm-ports'];
    let meta = null;
    try {
        meta = JSON.parse(header);
    } catch(e){
        return `Parse failed: ${header}; ${zerr.e2s(e)}`;
    }
    let every_key_is_num = Object.keys(meta).every(k=>!isNaN(parseInt(k)));
    let every_val_is_array = Object.values(meta).every(v=>Array.isArray(v));
    if (!every_key_is_num || !every_val_is_array)
        return 'Failed parse x-lpm-ports - wrong format';
    req.headers_orig = Object.assign({}, req.headers);
    req.ports_meta = meta;
};

E.prototype.usage_start = function(req){
    if (!Number(this.opt.logs))
        return;
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

E.prototype.refresh_sessions = function(){
    this.emit('refresh_sessions');
    this.session_mgr.refresh_sessions();
};

const get_hostname = _url=>{
    let url_parts;
    if (url_parts = _url.match(/^([^/]+?):(\d+)$/))
        return url_parts[1];
    return url.parse(_url).hostname;
};

E.prototype.send_stats = function(lum_traffic, hostname, in_bw, out_bw, scs){
    let stats = {hostname: zurl.get_root_domain(hostname||''),
        in_bw, out_bw, port: this.port, lum_traffic, success: !!scs};
    this.emit('usage_stats', stats);
};

E.prototype.log_req = function(_url, method, remote_address, hostname, headers,
    lb_ip, in_bw, out_bw, sp, user, password, auth_type, status_code,
    status_message, start_time, req_chain)
{
    const opts = username.parse_opt(user);
    const bw = in_bw+out_bw;
    const auth = user && user+(this.opt.zagent ? '' : ':'+password)||'no_auth';
    const time = Date.now()-start_time;
    const timing = (req_chain||[]).map(t=>({
        blocked: t.create-start_time,
        wait: t.connect-t.create||0,
        ttfb: t.first_byte-(t.connect||start_time)||0,
        receive: t.end-(t.first_byte||t.connect||start_time)
    }));
    let str = `${remote_address}${lb_ip ? '('+lb_ip+')' : ''} ${method} `
        +`${_url} ${status_code} ${status_message} ${time}ms ${bw} `
        +`${sp||'no_proxy'} ${auth} ${auth_type||'no_auth_type'} `
        +`${timing.length ? JSON.stringify(timing) : ''}`;
    if (this.logger.level=='debug')
        str+=` ${JSON.stringify(headers)}`;
    this.logger.info(str);
    let message = {
        ts: date(),
        customer: this.opt.customer_id||this.opt.account_id||this.opt.customer,
        zone: opts.zone,
        method,
        host: hostname,
        status_code,
        sp,
        bw,
        port: this.port,
        time,
        auth_type,
        ip: remote_address,
    };
    if (lb_ip)
        message.lb_ip = lb_ip;
    if (message.status_code!=200)
        message.status_message = status_message;
    this.req_logger.log({level: 'info', message});
};

const extract_log_data = (res, req)=>{
    const headers = res.headers||{};
    const in_bw = Math.max(Number(headers['x-debug-bw-dn'])||0,
        res.in_bw||0);
    const out_bw = Math.max(Number(headers['x-debug-bw-up'])||0,
        res.out_bw||0);
    req = req||res.request;
    let _url = req.url_full||req.url||'';
    const hostname = get_hostname(_url);
    const auth_type = res.lpm_auth_type;
    if (_url.length>consts.MAX_URL_LENGTH)
        _url = _url.slice(0, consts.MAX_URL_LENGTH);
    return {headers, in_bw, out_bw, _url, hostname, auth_type};
};

E.prototype.usage = function(response){
    if (!response)
        return;
    // XXX mikhailpo: ugly hack for prevent double logging of a single request
    response.usage_logged = true;
    const {headers, in_bw, out_bw, _url, hostname,
        auth_type} = extract_log_data(response);
    let stat_success = +(response.status_code &&
        (response.status_code=='unknown' || consts.SUCCESS_STATUS_CODE_RE
        .test(response.status_code)));
    this.send_stats(response.lum_traffic, hostname, in_bw, out_bw,
        stat_success);
    let user, super_proxy, password, url_parts;
    if (response.proxy)
    {
        super_proxy = response.proxy.host+':'+response.proxy.proxy_port;
        user = response.proxy.username;
        password = response.proxy.password;
    }
    this.log_req(_url, response.request.method, response.remote_address,
        hostname, headers, response.lp_ip, in_bw, out_bw, super_proxy, user,
        password, auth_type, response.status_code, response.status_message,
        response.request.start_time, response.timeline.req_chain);
    if (!Number(this.opt.logs) && !this.remote_logger
        && response.context!='PROXY TESTER TOOL')
    {
        return;
    }
    const is_ssl = response.request.url.endsWith(':443') &&
        response.status_code=='200';
    const status_code = is_ssl ? 'unknown' : response.status_code || 'unknown';
    const encoding = response.headers && response.headers['content-encoding'];
    const response_body = is_ssl ? 'unknown' :
        lutil.decode_body(response.body, encoding, this.opt.har_limit,
            response.body_size);
    const data = {
        uuid: response.uuid,
        port: this.port,
        url: _url,
        method: response.request.method,
        request_headers: JSON.stringify(response.request.headers),
        request_body: response.request.body,
        response_headers: stringify(headers),
        response_body,
        status_code,
        status_message: response.status_message,
        timestamp: response.timeline.get('create'),
        elapsed: response.timeline.get_delta('end'),
        proxy_peer: headers['x-luminati-ip'],
        timeline: stringify(response.timeline.req_chain),
        content_size: response.body_size,
        context: response.context,
        remote_address: response.remote_address,
        rules: response.rules,
        lum_traffic: response.lum_traffic,
        in_bw,
        out_bw,
        super_proxy,
        username: user,
    };
    if (!this.opt.zagent)
        data.password = password;
    if (response.success)
        data.success = +response.success;
    if (url_parts = data.url.match(/^([^/]+?):(\d+)$/))
    {
        data.protocol = url_parts[2]==443 ? 'https' : 'http';
        data.hostname = url_parts[1];
    }
    else
    {
        const {protocol, hostname: hn} = url.parse(data.url);
        data.protocol = (protocol||'https:').slice(0, -1);
        data.hostname = hn;
    }
    if (!data.hostname)
        this.perr('empty_hostname', data);
    data.hostname = zurl.get_root_domain(data.hostname||'');
    data.content_type = get_content_type(data);
    data.success = +(data.status_code && (data.status_code=='unknown' ||
        consts.SUCCESS_STATUS_CODE_RE.test(data.status_code)));
    if (this.remote_logger && !logs_remote_ignore_ctx.includes(data.context))
        this.remote_logger.info(data);
    else
        this.emit('usage', data);
};

E.prototype.refresh_ip = function(ctx, ip, vip){
    this.emit('refresh_ip', {ip, vip, port: this.opt.port});
};

E.prototype.is_whitelisted = function(req){
    const auth_header = req.headers['proxy-authorization'];
    if (auth_header)
    {
        const auth = Buffer.from(auth_header.replace('Basic ', ''), 'base64')
        .toString();
        const [user, pass] = auth.split(':');
        const lpm_token = (this.opt.lpm_token||'').split('|')[0];
        if (user=='lpm'||user=='token'||user.includes(','))
            delete req.headers['proxy-authorization'];
        if (user=='token' && this.opt.token_auth && pass==this.opt.token_auth)
        {
            req.lpm_auth_type = 'token';
            return true;
        }
        if (user=='lpm' && lpm_token && pass==lpm_token)
        {
            req.lpm_auth_type = 'lpm_token';
            return true;
        }
        let lpm_user_opt;
        if (pass==this.opt.user_password &&
            (user.replace(/,/, '@')==this.opt.user ||
                (lpm_user_opt = username.parse_opt(`lpm_user-${user}`)) &&
                lpm_user_opt.lpm_user==this.opt.user ||
                (lpm_user_opt = username.parse_opt(
                    `lpm_user-${Buffer.from(user, 'hex').toString('utf8')}`))&&
                lpm_user_opt.lpm_user==this.opt.user))
        {
            delete req.headers['proxy-authorization'];
            if (lpm_user_opt)
            {
                const h_fields = ['session', 'country', 'state', 'city', 'asn',
                    'zip'];
                for (let p of h_fields)
                {
                    if (!req.headers['x-lpm-'+p] && lpm_user_opt[p])
                        req.headers['x-lpm-'+p] = lpm_user_opt[p];
                }
            }
            req.lpm_auth_type = 'lpm_user';
            return true;
        }
        if (consts.USERNAME_PREFS.some(p=>user.startsWith(p+'-')))
        {
            // proxy_type is undefined for dropin port
            const ignore = !this.opt.zagent && !this.opt.proxy_type;
            const parsed_auth = username.parse(auth_header);
            const right_customer = this.opt.account_id==parsed_auth.customer
                || this.opt.customer_id==parsed_auth.customer
                || this.opt.customer==parsed_auth.customer;
           const right_zone_password = this.opt.zone==parsed_auth.zone &&
                parsed_auth.password;
            if (parsed_auth.customer && parsed_auth.zone &&
                parsed_auth.password)
            {
                let whitelist = this.opt.zone_auth_type_whitelist || [];
                const success = right_customer && right_zone_password &&
                    whitelist.includes(parsed_auth.customer)
                    || ignore;
                req.lpm_auth_type = success ? 'zone' : undefined;
                return success;
            }
            if (parsed_auth.auth=='token' && parsed_auth.password)
            {
                const success = parsed_auth.password==this.opt.token_auth
                    || parsed_auth.password==lpm_token;
                req.lpm_auth_type = success ? 'lum_token' : undefined;
                return success;
            }
        }
    }
    const ip_whitelisted = this.is_whitelisted_ip(this.get_req_remote_ip(req));
    if (ip_whitelisted)
        req.lpm_auth_type = 'ip';
    return ip_whitelisted;
};

E.prototype.is_whitelisted_ip = function(ip){
    if (ip=='127.0.0.1')
        return true;
    return this.opt.whitelist_ips.map(_ip=>new Netmask(_ip)).some(_ip=>{
        try { return _ip.contains(ip); }
        catch(e){ return false; }
    });
};

E.prototype.log_req_without_res = function(req, res, status_code,
    status_message)
{
    const {headers, in_bw, out_bw, _url, hostname,
        auth_type} = extract_log_data(res, req);
    const remote_address = res.remote_address||this.get_req_remote_ip(req);
    const req_chain = res.timeline ? res.timeline.req_chain : [];
    let super_proxy, user, password;
    this.log_req(_url, req.method, remote_address, hostname, headers,
        res.lp_ip, in_bw, out_bw, super_proxy, user, password, auth_type,
        status_code, status_message, req.start_time, req_chain);
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

E.prototype.close_req_socket = function(req){
    if (!req_list.has(req))
        return;
    req_list.delete(req);
    this.ensure_socket_close(req.socket);
};

E.prototype.close_all_reqs = function(){
    req_list.forEach(this.close_req_socket.bind(this));
};

E.prototype.store_request = function(req){
    const socket = req.socket, p_socket = socket._parent;
    if (req_list.has(req) || req.destroyed || socket.destroyed
        || p_socket&&p_socket.destroyed)
    {
        return;
    }
    this.ensure_socket_emit_close(socket);
    req_list.add(req);
    socket.setMaxListeners(socket.getMaxListeners()+1);
    socket.once('close', ()=>this.close_req_socket(req));
    if (!p_socket)
        return;
    this.ensure_socket_emit_close(p_socket);
    p_socket.setMaxListeners(p_socket.getMaxListeners()+1);
    p_socket.once('close', ()=>this.close_req_socket(req));
};

E.prototype.handler = etask._fn(function*handler(_this, req, res, head){
    res.once('close', ()=>{
        _this.timeouts.set_timeout(()=>{
            this.return();
        });
    });
    req.once('close', ()=>{
        if (req.readableAborted)
            _this.timeouts.set_timeout(()=>this.return());
    });
    try {
        req.start_time = Date.now();
        if (!_this.is_whitelisted(req))
            return _this.send_unauthorized(req, res);
        if (_this.bw_limit_exp)
        {
            if (_this.bw_limit_exp>date())
                return _this.send_bw_limit_reached(req, res);
            _this.bw_limit_exp = false;
        }
        this.finally(()=>{
            _this.complete_req(this.error, req, res, this.info);
        });
        // to close ongoing requests once bw limit is reached
        _this.store_request(req);
        _this.active++;
        if (_this.active==1)
            _this.emit('idle', false);
        req.once('timeout', ()=>this.throw(new Error('request timeout')));
        let x_ports_error = _this.process_x_ports_header(req);
        if (x_ports_error)
            _this.logger.warn('X-LPM-PORTS Error: %s', x_ports_error);
        this.info.url = req.url;
        this.info.req = req;
        if (_this.opt.throttle)
            yield _this.throttle_mgr.throttle(this, req.url);
        return yield _this.lpm_request(req, res, head);
    } catch(e){
        _this.logger.warn('handler: %s %s %s', req.method,
            req_util.full_url(req), e.message);
        _this.emit('request_error', e);
        throw e;
    }
});

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

E.prototype.complete_req = function(err, req, res, et_info){
    if (!req.ctx)
    {
        this.logger.warn('ctx does not exist');
        req.ctx = {};
    }
    try {
        if (err && err.proxy_error)
        {
            this.send_error(req.method, req.ctx.url, res, err.message,
                'luminati');
        }
        else if (err)
            this.send_error(req.method, req.ctx.url, res, err.message, 'lpm');
        if (this.opt.throttle)
            this.throttle_mgr.release(req.url, et_info);
        this.active--;
        if (!this.active)
            return this.emit('idle', true);
    } catch(e){
        this.logger.error('unexpected error: %s', zerr.e2s(e));
    }
};

E.prototype.listen = etask._fn(function*listen(_this){
    try {
        if (!_this.sp)
        {
            _this.sp = etask(function*server_listen(){
                return yield this.wait();
            });
        }
        _this.sp.spawn(_this.session_mgr.sp);
        let hostname = find_iface(_this.opt.iface);
        if (!hostname)
        {
            hostname = '0.0.0.0';
            _this.opt.iface = '0.0.0.0';
        }
        _this.port = _this.opt.listen_port;
        _this.tcp_server.once('error', e=>{
            this.throw(e);
        });
        _this.tcp_server.listen(_this.opt.listen_port, hostname,
            this.continue_fn());
        yield this.wait();
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
        _this.timeouts.clear();
        _this.banlist.clear_timeouts();
        _this.session_mgr.stop();
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

E.prototype.check_proxy_response = function(res){
    const message = res.headers && res.headers['x-luminati-error'];
    if (!message)
        return false;
    const err = new Error();
    err.message = message;
    err.code = res.status_code || res.statusCode || 0;
    err.custom = true;
    err.proxy_error = true;
    err.retry = false;
    if (err.code==502 && err.message.match(/^Proxy Error/))
        err.retry = true;
    return err;
};

E.prototype.get_next_host = function(is_cn){
    let _hosts = this.hosts;
    if (is_cn && (this.cn_hosts||[]).length)
        _hosts = this.cn_hosts;
    if (!_hosts.length)
        throw new Error('No hosts available');
    if (!_hosts[hosts_cursor])
        hosts_cursor = 0;
    return _hosts[hosts_cursor++];
};

E.prototype.get_req_cred = function(req){
    const ctx = req.ctx;
    const auth = username.parse(ctx.h_proxy_authorization) || {};
    if (!auth.password || auth.auth)
        delete auth.password;
    delete auth.auth;
    if (ctx.h_session)
        auth.session = ctx.h_session;
    if (ctx.h_country)
        auth.country = ctx.h_country;
    if (ctx.h_state)
        auth.state = ctx.h_state;
    if (ctx.h_city)
        auth.city = ctx.h_city;
    if (ctx.h_zip)
        auth.zip = ctx.h_zip;
    if (ctx.h_asn)
        auth.asn = ctx.h_asn;
    if (auth.tool)
    {
        delete auth.tool;
        delete auth.password;
    }
    if (ctx.retry)
    {
        delete auth.zone;
        delete auth.password;
        delete auth.customer;
    }
    const opt = {
        ext_proxy: ctx.session && ctx.session.ext_proxy,
        ip: ctx.h_ip || ctx.session && ctx.session.ip || this.opt.ip,
        vip: ctx.session && ctx.session.vip || this.opt.vip,
        session: ctx.session && ctx.session.session,
        direct: ctx.is_direct,
        unblocker: this.opt.unblock,
        debug: ctx.opt.debug,
        const: ctx.opt.const,
        customer: this.opt.customer_id||this.opt.account_id||this.opt.customer,
    };
    if (ctx.session && ctx.session.asn)
        opt.asn = ctx.session.asn;
    return username.calculate_username(Object.assign({}, this.opt, opt, auth));
};

E.prototype.get_proxy_port = function(){
    const {super_proxy_ports} = this.opt;
    if (!super_proxy_ports || super_proxy_ports.length<2)
        return this.opt.proxy_port;
    if (!super_proxy_ports[super_proxy_ports_cursor])
        super_proxy_ports_cursor = 0;
    return super_proxy_ports[super_proxy_ports_cursor++];
};

E.prototype.init_proxy_req = function(req, res){
    const {ctx} = req;
    ctx.init_stats();
    ctx.host = this.session_mgr.get_session_host(ctx.session);
    if (this.router.is_bypass_proxy(req))
        return;
    ctx.proxy_port = ctx.session && ctx.session.proxy_port ||
        this.get_proxy_port();
    ctx.cred = this.get_req_cred(req);
    res.cred = ctx.cred.username;
    res.port = ctx.port;
    res.lpm_auth_type = req.lpm_auth_type;
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
    if (ctx.session && ctx.session.ext_proxy)
        return;
    let agent = lpm_config.hola_agent;
    const auth = username.parse(ctx.h_proxy_authorization);
    if (auth && auth.tool)
        agent = agent+' tool='+auth.tool;
    if (this.opt.zagent)
    {
        agent = agent+' lpm_port='+this.opt.port;
        if (this.opt.user)
            ctx.connect_headers['x-lpm-user'] = this.opt.user;
    }
    ctx.connect_headers['x-hola-agent'] = agent;
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
function*lpm_request(_this, req, res, head, post, opt){
    req.setMaxListeners(req.getMaxListeners() + 1);
    req.once('aborted', ()=>{
        _this.usage_abort(req);
        req.setMaxListeners(Math.max(req.getMaxListeners() - 1, 0));
    });
    res.once('error', e=>{
        _this.logger.error(zerr.e2s(e));
        _this.usage_abort(req);
    });
    _this.restore_ports_meta(req);
    const ctx = Context.init_req_ctx(req, res, _this,
        Object.assign(_this.opt, opt));
    this.finally(()=>{
        ctx.complete_req();
    });
    try {
        if (ctx.req_sp)
            ctx.req_sp.spawn(this);
        if (!ctx.req_sp)
            ctx.req_sp = this;
        _this.add_headers(req);
        _this.apply_ports_meta(req);
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
        if (ctx.is_connect && parse_ip_url(ctx.url))
        {
            _this.logger.warn('HTTPS to IP: %s is sent from super proxy',
                ctx.url);
        }
        if (!req.ctx.retry)
            _this.usage_start(req);
        let resp = yield _this.rules.pre(req, res, head);
        if (!resp)
        {
            _this.init_proxy_req(req, res);
            resp = yield _this.route_req(req, res, head);
        }
        else if (resp!='switched' && !resp.body_size && _this.rules)
            yield _this.rules.post(req, res, head, resp);
        if (resp=='switched')
        {
            _this.emit('switched');
            yield this.wait();
        }
        if (resp instanceof Error)
            throw resp;
        if (!resp)
            throw new Error('invalid_response');
        if (ctx.wait_bw)
            yield this.wait_ext(ctx.wait_bw);
        _this.prepare_resp(req, resp);
        _this.emit('response', resp);
        if (post)
            yield post(resp);
        return ctx.req_sp.return(resp);
    } catch(e){
        const resp = ctx.response;
        resp.status_code = 502;
        resp.statusCode = 502;
        resp.hola_headers = Object.assign({}, e.payload && e.payload.headers,
            resp.hola_headers);
        if (yield _this.rules.post(req, res, head, resp))
            return yield ctx.req_sp.wait();
        _this.prepare_resp(req, resp);
        resp.headers = {Connection: 'close', 'x-lpm-error': e.message};
        _this.emit('response', resp);
        if (post)
            yield post(resp);
        if (_this.handle_custom_error(e, req, res, ctx))
            return ctx.req_sp.return();
        return ctx.req_sp.throw(e);
    }
});

E.prototype.over_max_redirects = function(req){
    if (!req.ctx)
        return false;
    req.ctx.n_redirects = (req.ctx.n_redirects||0)+1;
    return req.ctx.n_redirects>MAX_REDIRECTS;
};

E.prototype.update_req_redirect = function(req, location){
    let prev_url = req_util.full_url(req);
    req.parts = req.parts || new URL(prev_url);
    if (!location)
        throw new Error('Redirect without location');
    let safe_location = /[^\u0021-\u00ff]/.test(location)
        ? encodeURI(location) : location;
    let new_url = url.resolve(prev_url, safe_location);
    new_url = new URL(new_url);
    for (let k of REDIRECT_PARTS)
        new_url[k] = new_url[k]||req.parts[k];
    this.logger.info('Redirect %s->%s', prev_url, new_url);
    req.headers = Object.assign({}, req.headers, {referer: prev_url});
    req.url = url.format(new_url);
    if (req.method!='HEAD')
        req.method = 'GET';
};

E.prototype.should_redirect = function(req, proxy_res){
    let status = proxy_res.status_code || proxy_res.statusCode;
    return this.opt.follow_redirect && is_redirect_status(status) &&
        !this.over_max_redirects(req) && !!proxy_res.headers.location;
};

E.prototype.redirect_req =
etask._fn(function*redirect_req(_this, req, res, head, proxy, proxy_res){
    let location = proxy_res.headers.location;
    _this.update_req_redirect(req, location);
    let {rule, opt} = _this.rules.get_fake_retry(req, proxy_res);
    if (yield _this.rules.action(req, res, head, rule, opt))
        return _this.abort_proxy_req(req, proxy);
});

E.prototype.handle_custom_error = function(e, req, res, ctx){
    if (!is_custom_error(e))
        return;
    if (e.message=='Authentication failed')
    {
        this.logger.info('%s %s 502 %s', req.method, ctx.url, e.message);
        write_http_reply(res, {
            statusCode: 502,
            statusMessage: 'Proxy Manager - Authentication failed',
        }, undefined, this.opt, true);
        return true;
    }
};

E.prototype.prepare_resp = function(req, resp){
    req.ctx.timeline.track('end');
    resp.remote_address = this.get_req_remote_ip(req);
    if (req.socket && this.lb_ips.has(req.socket.remoteAddress))
        resp.lb_ip = req.socket.remoteAddress;
    const auth = username.parse(req.ctx.h_proxy_authorization);
    if (auth && auth.tool=='proxy_tester')
        resp.context = 'PROXY TESTER TOOL';
    resp.rules = req.ctx.get_rules_executed();
    resp.lum_traffic = !req.ctx.is_bypass_proxy && !this.opt.ext_proxies &&
        !req.ctx.is_from_cache && !req.ctx.is_null_response &&
        !req.ctx.is_malware;
    resp.lpm_auth_type = req.lpm_auth_type;
};

E.prototype.get_user_agent = function(){
    const ua = (this.opt.headers||[]).find(f=>
        f.name.toLowerCase()=='user-agent');
    if (!ua || !ua.value)
        return;
    if (!ua.value.startsWith('random'))
        return ua.value;
    const ua_version = Math.floor(Math.random()*2240)+1800;
    if (ua.value=='random_mobile')
    {
        return `Mozilla/5.0 (iPhone; CPU iPhone OS 13_2 like Mac OS X)`
        +` AppleWebKit/605.1.15 (KHTML, like Gecko)`
        +` CriOS/80.0.${ua_version}.95 Mobile/15E148 Safari/604.1`;
    }
    return `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36`
    +` (KHTML, like Gecko) Chrome/80.0.${ua_version}.122 Safari/537.36`;
};

E.prototype.add_headers = function(req){
    const added_headers = {};
    (this.opt.headers||[]).forEach(header=>{
        added_headers[header.name] = header.value;
    });
    const ua = this.get_user_agent();
    if (ua)
        added_headers['user-agent'] = ua;
    Object.assign(req.headers, added_headers);
};

E.prototype.restore_ports_meta = function(req){
    Object.assign(req.headers, req.headers_orig||{});
};

E.prototype.apply_ports_meta = function(req){
    if (!req.ports_meta || !req.ports_meta[this.opt.port])
        return;
    req.ports_meta[this.opt.port].forEach(h=>
        delete req.headers[h.toLowerCase()]);
};

E.prototype.route_req = etask._fn(function*route_req(_this, req, res, head){
    try {
        _this.logger.debug('%s:%s - %s %s', req.socket.remoteAddress,
            req.socket.remotePort, req.method, req.ctx.url);
        req.setMaxListeners(30);
        if (_this.opt.session_termination && (req.ctx.session||{}).terminated)
            return _this.router.send_internal_redirection(req, res);
        else if (_this.router.is_fake_request(req))
            return yield _this.send_fake_request(this, req, res);
        else if (!_this.hosts.length)
            throw new Error('No hosts when processing request');
        else if (_this.router.is_bypass_proxy(req))
            return yield _this.send_bypass_req(this, req, res, head);
        else
            return yield _this.send_proxy_req(this, req, res, head);
    } catch(e){
        return e;
    }
});

E.prototype.send_proxy_req = function(task, req, res, head){
    if (req.ctx.is_ssl)
        return this.send_proxy_req_ssl(task, req, res, head);
    return this.send_proxy_req_http(task, req, res, head);
};

E.prototype.request_handler = etask._fn(
function*request_handler(_this, req, res, proxy, head, headers){
    const ctx = req && req.ctx;
    const ensure_end_task = ()=>_this.timeouts.set_timeout(()=>{
        if (etask.is_final(this))
            return;
        _this.logger.debug('closing long connection after 15 seconds');
        this.return(ctx && ctx.response);
    }, 15*SEC);
    this.once('cancel', ()=>_this.abort_proxy_req(req, proxy, this));
    if (proxy.setTimeout)
        proxy.setTimeout(ctx.timeout);
    proxy.once('response', _this.handle_proxy_resp(req, res, proxy, this,
        head, headers))
    .once('connect', _this.handle_proxy_connect(req, res, proxy, this, head))
    .once('upgrade', _this.handle_proxy_upgrade(req, res, proxy, this, head))
    .once('error', _this.handle_proxy_error(req, res, proxy, this, head,
        headers))
    .once('timeout', _this.handle_proxy_timeout(req, res, proxy, this))
    .once('close', ensure_end_task);
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
        proxy = request({
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

E.prototype.perr = function(id, info){
    Object.assign(info, {
        customer: this.opt.customer,
        account_id: this.opt.account_id,
        customer_id: this.opt.customer_id,
    });
    this.logger.info('sending perr: %s', JSON.stringify(info));
    lutil.perr(id, info);
};

E.prototype.log_fn = function(e, ctx, source){
    if (!is_custom_error(e))
        this.logger.error('fn: %s %s', e.message, ctx.url);
    if (!this.opt.zagent)
        return;
    const msg = e && e.message || '';
    let perr_id = 'conn_unknown';
    if (msg=='socket hang up')
        perr_id = 'conn_socket_hang_up';
    else if (msg=='read ECONNRESET')
        perr_id = 'conn_read_connreset';
    else if (msg.startsWith('connect ETIMEDOUT'))
        perr_id = 'conn_connect_etimedout';
    else if (msg.startsWith('connect ECONNREFUSED'))
        perr_id= 'conn_connect_econnrefused';
    else if (msg=='BAD_DECRYPT')
        perr_id = 'conn_flex_tls_bad_decrypt';
    else if (msg=='Cannot call write after a stream was destroyed')
        perr_id = 'conn_flex_tls_err_stream_destroyed';
    else if (msg=='SSLV3_ALERT_CLOSE_NOTIFY')
        perr_id = 'conn_flex_tls_sslv3_alert_close_notify';
    else if (msg.startsWith('flex_tls_reuse_destroyed_socket'))
        perr_id = 'conn_flex_tls_reuse_destroyed_socket';
    else if (msg.includes('flex_tls') || (source||'').includes('flex_tls'))
        perr_id = 'conn_flex_tls_unknown';
    this.perr(perr_id, {
        error: zerr.e2s(e),
        ctx: source,
        url: ctx.url,
        cred: ctx.cred,
        headers: ctx.headers,
        host: ctx.host,
        port: ctx.port,
    });
};

E.prototype.log_throw_fn = function(task, ctx, source){
    return e=>{
        this.log_fn(e, ctx, source);
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
function*_request_new_socket(_this, task, req, res, head){
    const ctx = req.ctx;
    task.once('cancel', ()=>this.return());
    const conn = yield _this.requester.request_socket(task, ctx, {
        on_error: _this.log_throw_fn(this, ctx, 'request_new_socket'),
        use_flex_tls: _this.opt.use_flex_tls,
        on_flex_tls_err: _this.log_throw_fn(this, ctx,
            'flex_tls, conn.socket'),
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
        const proxy_err = _this.check_proxy_response(conn.res);
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
    const domain = req_util.get_domain(req);
    const ip = conn.res.headers['x-luminati-ip'];
    if (_this.is_ip_banned(ip, domain) &&
        (req.retry||0)<_this.opt.max_ban_retries)
    {
        _this.refresh_sessions();
        _this.rules.retry(req, res, head);
        return yield this.wait();
    }
    else if (_this.is_ip_banned(ip, domain))
        throw new Error('Too many banned IPs');
    conn.res.once('error', _this.log_throw_fn(this, ctx,
        'request_new_socket, conn.res'));
    conn.socket.once('error', _this.log_throw_fn(this, ctx,
        'request_new_socket, conn.socket'));
    return conn;
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

E.session_to_ip = {};
E.last_ip = new Netmask('1.1.1.0');

E.get_random_ip = ()=>{
    E.last_ip = E.last_ip.next();
    return E.last_ip.base;
};

E.prototype.send_fake_request = etask._fn(
function*send_fake_request(_this, task, req, res){
    try {
        const get_ip = (session={})=>{
            if (session.ip)
                return session.ip;
            if (!E.session_to_ip[session.session])
                E.session_to_ip[session.session] = E.get_random_ip();
            return E.session_to_ip[session.session];
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

E.prototype.handle_proxy_timeout = function(req, res, proxy, task){
    return ()=>{
        const ctx = req.ctx;
        this.ensure_socket_close(proxy);
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
    let _this = this;
    return etask._fn(function*(_that, proxy_res){
        if (_this.opt.session_termination && proxy_res.statusCode==502 &&
            proxy_res.headers &&
            proxy_res.headers['x-luminati-error']==consts.NO_PEERS_ERROR)
        {
            const resp = _this.handle_session_termination(req, res);
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
            return _this.abort_proxy_req(req, proxy, task);
        if (ctx.response.proxy && proxy.socket)
            ctx.response.proxy.host = proxy.socket.remoteAddress;
        ctx.proxies.forEach(p=>p!=proxy && _this.abort_proxy_req(req, p));
        ctx.responded = true;
        const har_limit = res_util.is_one_of_types(proxy_res,
            ['image', 'javascript', 'css']) ? -1 : _this.opt.har_limit;
        const count_stream = E.create_count_stream(ctx.response, har_limit);
        try {
            ctx.timeline.track('response');
            _this.check_proxy_response(proxy_res);
            const ip = proxy_res.headers['x-luminati-ip'];
            const domain = req_util.get_domain(req);
            if (_this.is_ip_banned(ip, domain) &&
                (req.retry||0)<_this.opt.max_ban_retries)
            {
                _this.refresh_sessions();
                return _this.rules.retry(req, res, head);
            }
            else if (_this.is_ip_banned(ip, domain))
                throw new Error('Too many banned IPs');
            if (ctx.session)
            {
                ctx.session.last_res = {ts: Date.now(), ip,
                    session: ctx.session.session};
            }
            if (!res.resp_written)
            {
                proxy_res.hola_headers = _headers;
                if (_this.should_redirect(req, proxy_res))
                {
                    return yield _this.redirect_req(req, res, head, proxy,
                        proxy_res);
                }
                if (yield _this.rules.post(req, res, head, proxy_res))
                    return _this.abort_proxy_req(req, proxy);
                else if (_this.rules.post_need_body(req, proxy_res))
                {
                    const temp_data = [];
                    let temp_data_size = 0;
                    proxy_res.once('data', data=>{
                        ctx.timeline.track('first_byte');
                    });
                    proxy_res.on('data', data=>{
                        temp_data.push(data);
                        temp_data_size += data.length;
                    });
                    proxy_res.once('end', etask._fn(function*(){
                        const rule_res = yield _this.rules.post_body(req, res,
                            head, proxy_res, temp_data);
                        if (rule_res)
                            return _this.abort_proxy_req(req, proxy);
                        const has_body = !!ctx.response.body.length;
                        ctx.response.body_size = has_body ?
                            ctx.response.body[0].length : 0;
                        for (let i=0; i<temp_data.length; i++)
                        {
                            if (ctx.response.body_size>=har_limit || has_body)
                                break;
                            const l = har_limit-ctx.response.body_size;
                            const new_piece = temp_data[i].slice(0, l);
                            ctx.response.body.push(new_piece);
                            ctx.response.body_size += new_piece.length;
                        }
                        ctx.response.body_size = temp_data_size;
                        write_http_reply(res, proxy_res, _headers, _this.opt);
                        const res_data = has_body ?
                            ctx.response.body : temp_data;
                        for (let i=0; i<res_data.length; i++)
                            res.write(res_data[i]);
                        res.end();
                        Object.assign(ctx.response, {
                            status_code: proxy_res.statusCode,
                            status_message: proxy_res.statusMessage,
                            headers: Object.assign({}, proxy_res.headers,
                            _headers||{}),
                        });
                        task.return(ctx.response);
                    })).once('error', _this.log_throw_fn(task, ctx,
                        'handle_proxy_resp, proxy_res'));
                    return;
                }
            }
            write_http_reply(res, proxy_res, _headers, _this.opt);
            proxy_res.pipe(count_stream).pipe(res);
            proxy_res.once('data', data=>{
                ctx.timeline.track('first_byte');
            });
            proxy_res.once('end', ()=>{
                Object.assign(ctx.response, {
                    status_code: proxy_res.statusCode,
                    status_message: proxy_res.statusMessage,
                    headers: Object.assign({}, proxy_res.headers,
                        _headers||{}),
                });
                task.return(ctx.response);
            }).once('error', _this.log_throw_fn(task, ctx, 'proxy_res'));
        } catch(e){
            _this.logger.error('handle_proxy_resp error: %s', zerr.e2s(e));
            task.throw(e);
        }
    });
};

E.prototype.handle_proxy_connect = function(req, res, proxy, task, head){
    let _this = this;
    return etask._fn(function*(_that, proxy_res, proxy_socket, proxy_head){
        if (proxy.aborted)
            return;
        const ctx = req.ctx;
        if (ctx.connected)
            return _this.abort_proxy_req(req, proxy);
        if (ctx.response.proxy && proxy.socket)
            ctx.response.proxy.host = proxy.socket.remoteAddress;
        ctx.proxies.forEach(p=>p!=proxy && _this.abort_proxy_req(req, p));
        ctx.connected = true;
        const har_limit = _this.opt.smtp ? _this.opt.har_limit : -1;
        const resp_counter = E.create_count_stream(ctx.response, har_limit);
        try {
            ctx.timeline.track('connect');
            const proxy_err = _this.check_proxy_response(proxy_res);
            if (proxy_err)
            {
                return !proxy_err.code || proxy_err.code==502 ?
                    task.throw(proxy_err) : write_http_reply(res, proxy_res,
                    {}, _this.opt, true);
            }
            if (_this.should_redirect(req, proxy_res))
            {
                return yield _this.redirect_req(req, res, head, proxy,
                    proxy_res);
            }
            if (yield _this.rules.post(req, res, head, proxy_res))
                return _this.abort_proxy_req(req, proxy);
            if (res.lpm_onconnect)
                res.lpm_onconnect(proxy_res);
            else
                write_http_reply(res, proxy_res, {}, _this.opt);
            Object.assign(ctx.response, {
                status_code: proxy_res.statusCode,
                status_message: proxy_res.statusMessage,
                headers: proxy_res.headers,
            });
            if (proxy_res.statusCode!=200)
            {
                res.end();
                return task.return(ctx.response);
            }
            res.write(proxy_head);
            proxy_socket.write(head);
            proxy_socket.pipe(resp_counter).pipe(res).pipe(proxy_socket);
            proxy_socket.once('data', data=>{
                ctx.timeline.track('first_byte');
            });
            // for https requests 'unpipe' might happen before 'Close Notify'
            // is received so need to drain socket for 'end' to be emitted
            res.on('unpipe', ()=>{
                res.resume();
            });
            proxy_res.on('error', e=>{
                task.throw(e);
            });
            res.on('error', e=>{
                task.throw(e);
            });
            res.once('end', etask._fn(function*(){
                if (yield _this.handle_smtp_rules(req, res, head, proxy_res,
                        proxy))
                {
                    return;
                }
                task.return(ctx.response);
            }));
            proxy_socket.once('error', err=>{
                _this.logger.warn('error on proxy_socket: %s', err.message);
            }).once('end', ()=>{
                if (ctx.timeline.get('end'))
                    return task.return();
            });
        } catch(e){
            _this.logger.error('handle_proxy_connect error: %s', zerr.e2s(e));
            task.throw(e);
        }
    });
};

E.prototype.handle_smtp_rules = etask._fn(
function*_handle_smtp_rules(_this, req, res, head, proxy_res, proxy){
    if (!(_this.opt.smtp&&_this.opt.smtp.length ||
          req.ctx.url.endsWith(':25')))
    {
        return false;
    }
    const applied = yield _this.rules.post(req, res, head, proxy_res);
    if (!applied && _this.rules.post_need_body(req))
    {
        if (yield _this.rules.post_body(req, res, head, proxy_res,
          req.ctx.response.body))
        {
            return _this.abort_proxy_req(req, proxy);
        }
    }
    return applied;
});

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
            this.ensure_socket_close(socket);
            this.ensure_socket_close(proxy_socket);
            return task.return(ctx.response);
        }
        write_http_reply(socket, proxy_res, {}, this.opt);
        socket.once('end', ()=>{
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

E.prototype.usage_abort = etask._fn(function*(_this, req){
    const response = req.ctx.response;
    if (response.usage_logged)
        return;
    if (req.ctx.wait_bw)
        yield this.wait_ext(req.ctx.wait_bw);
    if (!response.timeline.get('end'))
        _this.prepare_resp(req, response);
    const in_bw = response.in_bw||0;
    const out_bw = response.out_bw||0;
    let _url = response.request.url_full||response.request.url||'';
    const hostname = get_hostname(_url);
    const auth_type = req.lpm_auth_type;
    _this.send_stats(response.lum_traffic, hostname, in_bw, out_bw, false);
    if (_url.length>consts.MAX_URL_LENGTH)
        _url = _url.slice(0, consts.MAX_URL_LENGTH);
    let user, super_proxy, password;
    if (response.proxy)
    {
        super_proxy = response.proxy.host+':'+response.proxy.proxy_port;
        user = response.proxy.username;
        password = response.proxy.password;
    }
    _this.log_req(response, _url, hostname, in_bw, out_bw, super_proxy, user,
        password, auth_type, 499, 'aborted');
    if (!Number(_this.opt.logs) && !_this.remote_logger
        && response.context!='PROXY TESTER TOOL')
    {
        return;
    }
    const data = {
        uuid: response.uuid,
        port: _this.port,
        url: response.request.url,
        method: response.request.method,
        request_headers: JSON.stringify(response.request.headers),
        request_body: response.request.body,
        status_code: 'canceled',
        timestamp: response.timeline.get('create'),
        elapsed: response.timeline.get_delta('end'),
        timeline: stringify(response.timeline.req_chain),
        context: response.context,
        remote_address: _this.get_req_remote_ip(req),
        rules: req.ctx.get_rules_executed(),
    };
    if (response.proxy)
    {
        data.super_proxy = response.proxy.host+':'+response.proxy.proxy_port;
        data.username = response.proxy.username;
        data.password = response.proxy.password;
    }
    if (_this.opt.zagent)
        delete data.password;
    if (_this.remote_logger && !logs_remote_ignore_ctx.includes(data.context))
        _this.remote_logger.info(data);
    else
        _this.emit('usage_abort', data);
});

E.prototype.handle_proxy_error = function(req, res, proxy, task, head,
    headers)
{
    return err=>{
        const ctx = req.ctx;
        if (proxy.aborted||ctx.responded||ctx.connected)
            return;
        const proxy_err = this.check_proxy_response(res || {statusCode: 502});
        this.log_fn(proxy_err||err, ctx, 'handle_proxy_error');
        const can_retry = this.rules.can_retry(req,
            {retry: ctx.proxy_retry});
        if (proxy_err && proxy_err.can_retry && can_retry)
        {
            this.rules.retry(req, res, head);
            this.abort_proxy_req(req, proxy);
            return;
        }
        this.abort_proxy_req(req, proxy);
        err = proxy_err||err;
        err.payload = {headers};
        return ctx.req_sp.throw(err);
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

E.prototype.unbanips = function(){
    if (!this.banlist.cache.size)
        return false;
    this.banlist.clear();
    return true;
};

E.hola_headers = qw`proxy-connection proxy-authentication x-hola-agent
    x-hola-context x-luminati-timeline x-luminati-peer-timeline
    x-luminati-error x-lpm-error x-lpm-authorization x-luminati-ip
    x-lpm-user`;
