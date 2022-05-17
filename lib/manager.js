#!/usr/bin/env node
// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/
const events = require('events');
const fs = require('fs');
const path = require('path');
const os = require('os');
const dns = require('dns');
configure_dns();
const url = require('url');
const express = require('express');
const compression = require('compression');
const body_parser = require('body-parser');
const request = require('request').defaults({gzip: true});
const net = require('net');
const http = require('http');
const https = require('https');
const http_shutdown = require('http-shutdown');
const util = require('util');
const {Netmask} = require('netmask');
const cookie = require('cookie');
const check_node_version = require('check-node-version');
const pkg = require('../package.json');
const zconfig = require('../util/config.js');
const zerr = require('../util/zerr.js');
const etask = require('../util/etask.js');
const conv = require('../util/conv.js');
const {code2label, code2timezone} = require('../util/country.js');
const string = require('../util/string.js');
const file = require('../util/file.js');
const date = require('../util/date.js');
const user_agent = require('../util/user_agent.js');
const lpm_config = require('../util/lpm_config.js');
const zurl = require('../util/url.js');
const zutil = require('../util/util.js');
const zws = require('../util/ws.js');
const {Fetchable_FS_Cache} = require('../util/fs_cache.js');
const logger = require('./logger.js').child({category: 'MNGR'});
const consts = require('./consts.js');
const Proxy_port = require('./proxy_port.js');
const ssl = require('./ssl.js');
const cities = require('./cities.js');
const perr = require('./perr.js');
const util_lib = require('./util.js');
const Loki = require('./loki.js');
const Zagent_api = require('./zagent_api.js');
const Timeouts = require('./timeouts.js');
const Lpm_f = require('./lpm_f.js');
const Lpm_conn = require('./lpm_conn.js');
const get_cache = require('./cache.js');
const Cluster_mgr = require('./cluster_mgr.js');
const Cloud_mgr = require('./cloud_mgr.js');
const puppeteer = require('./puppeteer.js');
const Config = require('./config.js');
const Stat = require('./stat.js');
const Zones_mgr = require('./zones.js');
const is_darwin = process.platform=='darwin';
let zos;
if (!lpm_config.is_win && !is_darwin)
    zos = require('../util/os.js');
if (process.env.PMGR_DEBUG)
    require('longjohn');
try { require('heapdump'); } catch(e){}
zerr.set_level('CRIT');
let ws_lib = 'ws';
try {
    if (!lpm_config.is_win)
    {
        require('uws');
        ws_lib = 'uws';
    }
} catch(e){
    logger.notice('uws not available, using ws library');
}

const qw = string.qw;
const E = module.exports = Manager;

function configure_dns(){
    const google_dns = ['8.8.8.8', '8.8.4.4'];
    const original_dns = dns.getServers();
    const servers = google_dns.concat(original_dns.filter(
        d=>!google_dns.includes(d)));
    // dns.setServers cashes node if there is an in-flight dns resolution
    // should be done before any requests are made
    // https://github.com/nodejs/node/issues/14734
    dns.setServers(servers);
}

E.fields_to_preserve = ['zone'];
E.default = Object.assign({}, lpm_config.manager_default);

const check_running = argv=>etask(function*(){
    const tasks = yield util_lib.get_lpm_tasks();
    if (!tasks.length)
        return;
    if (!argv.dir)
    {
        logger.notice(`Proxy Manager is already running (${tasks[0].pid})`);
        logger.notice('You need to pass a separate path to the directory for '
            +'this Proxy Manager instance. Use --dir flag');
        process.exit();
    }
});

E.prototype.apply_argv_opts = function(_defaults){
    const args = zutil.clone_deep(this.argv.explicit_mgr_opt||{});
    const ips_fields = ['whitelist_ips', 'www_whitelist_ips', 'extra_ssl_ips'];
    ips_fields.forEach(f=>{
        if (args[f])
            args[f] = [...new Set([..._defaults[f]||[], ...args[f]||[]])];
    });
    return Object.assign(_defaults, args);
};

const empty_wss = {
    close: ()=>null,
    broadcast_json: data=>{
        logger.debug('wss is not ready, %s will not be emitted', data.msg);
    },
};

function Manager(argv, run_config={}){
    events.EventEmitter.call(this);
    logger.notice([
        `Running Proxy Manager`,
        `PID: ${process.pid}`,
        `Node: ${process.versions.node}`,
        `Version: ${pkg.version}`,
        `Build date: ${zconfig.CONFIG_BUILD_DATE}`,
        `Os version: ${os.platform()} ${os.arch()} ${os.release()}`,
        `Host name: ${os.hostname()}`,
    ].join('\n'));
    try {
        const _this = this;
        this.cluster_mgr = new Cluster_mgr(this);
        this.cloud_mgr = new Cloud_mgr(this);
        this.proxy_ports = {};
        this.zones_mgr = new Zones_mgr(this);
        this.argv = argv;
        this.mgr_opts = zutil.pick(argv, ...lpm_config.mgr_fields);
        this.config = new Config(this, E.default, {filename: argv.config});
        const conf = this.config.get_proxy_configs();
        this.opts = Object.assign(zutil.pick(argv,
            ...Object.keys(lpm_config.proxy_fields)),
            zutil.pick(conf._defaults, ...lpm_config.mgr_proxy_shared_fields));
        this._defaults = conf._defaults;
        this.proxies = conf.proxies;
        this.config_ts = conf.ts||date();
        this.pending_www_ips = new Set();
        this.pending_ips = new Set();
        this.config.save({skip_cloud_update: 1});
        this.loki = new Loki(argv.loki);
        this.timeouts = new Timeouts();
        this.ensure_socket_close = util_lib.ensure_socket_close.bind(null,
            this.timeouts);
        this.long_running_ets = [];
        this.async_reqs_queue = [];
        this.async_active = 0;
        this.tls_warning = false;
        this.lpm_users = [];
        this.conn = {};
        this.config_changes = [];
        this.wss = empty_wss;
        this.is_upgraded = run_config.is_upgraded;
        this.backup_exist = run_config.backup_exist;
        this.conflict_shown = false;
        this.lpm_conn = new Lpm_conn();
        this.lpm_f = new Lpm_f(this);
        this.lpm_f.on('server_conf', server_conf=>{
            logger.notice('Updated server configuration');
            this.server_conf = server_conf;
            if (zutil.is_mocha())
                return;
            let port = _this.check_proxy_port(server_conf.cloud);
            if (port && port != E.default.proxy_port)
                _this.change_default_proxy_port(port);
        });
        this.lpm_f.on('i18n_update_available', ()=>
            this.lang_cache.delete());
        this.stat = new Stat(this);
        this.cache = get_cache();
        this.lang_cache = new Fetchable_FS_Cache({
            path: path.join(os.tmpdir(), 'pmgr/i18n', 'all.json'),
            fetch: etask._fn(function*(){
                logger.info('fetching language resources');
                return yield _this.lpm_f.get_language_resources();
            }),
            on_data: langs=>{
                // removing unsupported langs
                Object.keys(langs).forEach(k=>{
                    if (!['zh-hans', 'ru'].includes(k))
                        delete langs[k];
                });
                return langs;
            },
        });
        this.on('error', (err, fatal)=>{
            let match;
            if (match = err.message.match(/EADDRINUSE.+:(\d+)/))
                return this.show_port_conflict(match[1], argv.force);
            const err_msg = err.raw ? err.message : 'Unhandled error: '+err;
            logger.error(err_msg);
            const handle_fatal = ()=>{
                if (fatal)
                    this.stop(err_msg);
            };
            if (!perr.enabled || err.raw)
                handle_fatal();
            else
            {
                let error = zerr.e2s(err);
                if (typeof error=='object')
                {
                    try { error = JSON.stringify(err); }
                    catch(e){ error = err && err.message || err; }
                }
                this.perr('crash', {error});
                handle_fatal();
            }
        });
    } catch(e){
        logger.error('constructor: %s', zerr.e2s(e));
        throw e;
    }
}

function get_content_type(data){
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
}

function format_json(json, spaces=2){
    return conv.JSON_stringify(json, {spaces});
}

function convert_bytes(bytes){
    if (bytes)
        return conv.scaled_bytes(bytes)+'B';
}

util.inherits(Manager, events.EventEmitter);

E.prototype.check_proxy_port = function(conf={}){
    let def = E.default.proxy_port;
    if (!conf)
        return def;
    if (this.is_reseller() && conf.reseller_proxy_port)
        return conf.reseller_proxy_port;
    if (!conf.proxy_ports || !this._defaults.account_id)
        return def;
    for (let port in conf.proxy_ports)
    {
        if (conf.proxy_ports[port].includes(this._defaults.account_id))
            return port;
    }
    return def;
};

E.prototype.change_default_proxy_port = function(port){
    E.default.proxy_port = port;
    if (!this.cluster_mgr.workers_running().length)
        return;
    this.cluster_mgr.broadcast('UPDATE_SERVERS_OPT', {proxy_port: port});
};

E.prototype.show_port_conflict = etask._fn(function*(_this, port, force){
    if (_this.conflict_shown)
        return;
    _this.conflict_shown = true;
    yield _this._show_port_conflict(port, force);
});

E.prototype._show_port_conflict = etask._fn(function*(_this, port, force){
    const tasks = yield util_lib.get_lpm_tasks();
    if (!tasks.length)
        return logger.error(`There is a conflict on port ${port}`);
    const pid = tasks[0].pid;
    logger.notice(`Proxy Manager is already running (${pid}) and uses port `
        +`${port}`);
    if (!force)
    {
        logger.notice('If you want to kill other instances use --force flag');
        return process.exit();
    }
    logger.notice('Trying to kill it and restart.');
    for (const t of tasks)
        process.kill(t.ppid, 'SIGTERM');
    _this.restart();
});

E.prototype.handle_usage = function(data){
    let url_parts;
    if (url_parts = data.url.match(/^([^/]+?):(\d+)$/))
    {
        data.protocol = url_parts[2]==443 ? 'https' : 'http';
        data.hostname = url_parts[1];
    }
    else
    {
        const {protocol, hostname} = url.parse(data.url);
        data.protocol = (protocol||'https:').slice(0, -1);
        data.hostname = hostname;
    }
    if (!data.hostname)
        this.perr('empty_hostname', data);
    data.hostname = zurl.get_root_domain(data.hostname||'');
    data.content_type = get_content_type(data);
    data.success = +(data.status_code && (data.status_code=='unknown' ||
        consts.SUCCESS_STATUS_CODE_RE.test(data.status_code)));
    const proxy = this.proxy_ports[data.port];
    if (proxy && proxy.status!='ok' && data.success)
        this.proxy_ports[data.port].status = 'ok';
    if (!this.argv.www || this.argv.high_perf)
        return;
    if (this._defaults.request_stats)
        this.loki.stats_process(data, zutil.get(proxy, 'opt.gb_cost', 0));
    this.logs_process(data);
};

E.prototype.handle_usage_abort = function(data){
    if (!this.argv.www || this.argv.high_perf)
        return;
    this.logs_process(data);
};

E.prototype.handle_usage_start = function(data){
    if (!Number(this._defaults.logs))
        return;
    const req = {
        uuid: data.uuid,
        details: {
            port: data.port,
            context: data.context,
            timestamp: data.timestamp,
            timeline: [],
        },
        request: {
            url: data.url,
            method: data.method,
            headers: headers_to_a(data.headers),
        },
        response: {content: {}},
    };
    this.wss.broadcast_json({msg: 'har_viewer_start', req});
};

E.prototype.logs_process = function(data){
    const har_req = this.har([data]).log.entries[0];
    const max_logs = Number(this._defaults.logs);
    if (!max_logs)
        return this.emit('request_log', har_req);
    this.wss.broadcast_json({msg: 'har_viewer', req: har_req});
    this.emit('request_log', har_req);
    this.loki.request_process(data, max_logs);
};

E.prototype.stop_servers = etask._fn(
function*mgr_stop_servers(_this){
    let servers = [];
    const stop_server = server=>servers.push(etask(function*mgr_stop_server(){
        try {
            yield server.stop();
        } catch(e){
            logger.error('Failed to stop server: %s', e.message);
        }
    }));
    if (_this.www_server)
        stop_server(_this.www_server);
    if (_this.zagent_server)
        stop_server(_this.zagent_server);
    Object.values(_this.proxy_ports).forEach(proxy_port=>{
        if (proxy_port.opt.proxy_type!='duplicate')
            stop_server(proxy_port);
    });
    _this.wss.close();
    yield etask.all(servers);
});

E.prototype.stop = etask._fn(
function*mgr_stop(_this, reason, force, restart){
    _this.timeouts.clear();
    _this.long_running_ets.forEach(et=>et.return());
    yield _this.perr(restart ? 'restart' : 'exit', {reason});
    yield _this.loki.save();
    _this.loki.stop();
    if (reason!='config change')
        _this.config.save({skip_cloud_update: 1});
    if (reason instanceof Error)
        reason = zerr.e2s(reason);
    logger.notice('Manager stopped: %s', reason);
    _this.lpm_f.close();
    _this.lpm_conn.close();
    yield _this.stop_servers();
    _this.cluster_mgr.kill_workers();
    if (!restart)
        _this.emit('stop', reason);
});

const headers_to_a = h=>Object.entries(h).map(p=>({name: p[0], value: p[1]}));
E.prototype.har = function(entries){
    return {log: {
        version: '1.2',
        creator: {name: 'Proxy Manager', version: pkg.version},
        pages: [],
        entries: entries.map(entry=>{
            const req = JSON.parse(entry.request_headers||'{}');
            const res = JSON.parse(entry.response_headers||'{}');
            const timeline = JSON.parse(entry.timeline||null)||[{}];
            entry.request_body = entry.request_body||'';
            const start = timeline[0].create;
            return {
                uuid: entry.uuid,
                details: {
                    context: entry.context,
                    out_bw: entry.out_bw,
                    in_bw: entry.in_bw,
                    bw: entry.bw||entry.out_bw+entry.in_bw,
                    proxy_peer: entry.proxy_peer,
                    protocol: entry.protocol,
                    port: entry.port,
                    timestamp: entry.timestamp,
                    content_type: entry.content_type,
                    success: entry.success,
                    timeline: timeline.map(t=>({
                        // first_byte: may be undefined when there was no body
                        // connect: may be undefined for http requests
                        blocked: t.create-start,
                        wait: t.connect-t.create||0,
                        ttfb: t.first_byte-(t.connect||start)||0,
                        receive: t.end-(t.first_byte||t.connect||start),
                        port: t.port,
                        session: t.session,
                    })),
                    super_proxy: entry.super_proxy,
                    username: entry.username,
                    password: entry.password,
                    remote_address: entry.remote_address,
                    rules: entry.rules,
                },
                startedDateTime: new Date(start||0).toISOString(),
                time: timeline.slice(-1)[0].end-start,
                request: {
                    method: entry.method,
                    url: entry.url,
                    host: entry.hostname,
                    httpVersion: 'unknown',
                    cookies: [],
                    headers: headers_to_a(req),
                    headersSize: -1,
                    postData: {
                        mimeType: req['content-type']||req['Content-Type']||'',
                        text: entry.request_body,
                    },
                    bodySize: entry.request_body.length||0,
                    queryString: [],
                },
                response: {
                    status: entry.status_code,
                    statusText: entry.status_message||'',
                    httpVersion: 'unknown',
                    cookies: [],
                    headers: headers_to_a(res),
                    content: {
                        size: entry.content_size||0,
                        mimeType: res['content-type']||'unknown',
                        text: entry.response_body||'',
                    },
                    headersSize: -1,
                    bodySize: entry.content_size,
                    redirectURL: '',
                },
                cache: {},
                // XXX krzysztof: check if can be removed and still be a
                // correct HAR file
                timings: {
                    blocked: 0,
                    dns: 0,
                    ssl: 0,
                    connect: 0,
                    send: 0,
                    wait: 0,
                    receive: 0,
                },
                serverIPAddress: entry.super_proxy,
                comment: entry.username,
            };
        }),
    }};
};

E.prototype.get_zones_api = function(req, res){
    res.json(this.zones_mgr.get_formatted());
};

E.prototype.get_consts_api = function(req, res){
    const proxy = Object.entries(lpm_config.proxy_fields).reduce(
        (acc, [k, v])=>Object.assign(acc, {[k]: {desc: v}}), {});
    Object.getOwnPropertyNames(E.default)
        .filter(E.default.propertyIsEnumerable.bind(E.default))
        .forEach(k=>proxy[k] && Object.assign(proxy[k], {def: E.default[k]}));
    if (proxy.zone)
        proxy.zone.def = this._defaults.zone;
    proxy.dns.values = ['', 'local', 'remote'];
    const ifaces = Object.keys(os.networkInterfaces())
        .map(iface=>({key: iface, value: iface}));
    ifaces.unshift({key: 'All', value: '0.0.0.0'});
    ifaces.unshift({key: 'dynamic (default)', value: ''});
    proxy.iface.values = ifaces;
    res.json({proxy, consts});
};

E.prototype.enable_ssl_api = etask._fn(
function*mgr_enable_ssl(_this, req, res){
    const port = req.body.port;
    let proxies = _this.proxies.slice();
    if (port)
        proxies = proxies.filter(p=>p.port==port);
    for (let i in proxies)
    {
        const p = proxies[i];
        if (p.port!=_this._defaults.dropin_port && !p.ssl)
            yield _this.proxy_update(p, {ssl: true});
    }
    res.send('ok');
});

E.prototype.update_ips_api = etask._fn(
function*mgr_update_ips(_this, req, res){
    const ips = req.body.ips||[];
    const vips = req.body.vips||[];
    const proxy = _this.proxies.find(p=>p.port==req.body.port);
    yield _this.proxy_update(proxy, {ips, vips});
    res.send('ok');
});

E.prototype.report_bug_api = etask._fn(
function*mgr_report_bug(_this, req, res){
    let log_file = '';
    const config_file = Buffer.from(_this.config.get_string())
        .toString('base64');
    if (file.exists(logger.lpm_filename))
    {
        let buffer = fs.readFileSync(logger.lpm_filename);
        buffer = buffer.slice(buffer.length-50000);
        log_file = buffer.toString('base64');
    }
    const reqs = _this.filtered_get({query: {limit: 100}}).items.map(x=>({
        url: x.url,
        status_code: x.status_code,
    }));
    const har = JSON.stringify(reqs);
    const browser = user_agent.guess_browser(req.get('user-agent')).browser;
    const response = yield _this.api_request({
        method: 'POST',
        endpoint: '/lpm/report_bug',
        form: {report: {config: config_file, log: log_file, har,
            desc: req.body.desc, lpm_v: pkg.version, email: req.body.email,
            browser, os: util_lib.format_platform(os.platform())}},
    });
    res.status(response.statusCode).json(response.body);
});

E.prototype.get_fixed_whitelist = function(){
    return (this.opts.whitelist_ips||[]).concat(
        this._defaults.www_whitelist_ips||[]);
};

E.prototype.get_default_whitelist = function(){
    return this.get_fixed_whitelist().concat(this._defaults.whitelist_ips||[]);
};

E.prototype.set_www_whitelist_ips = function(ips){
    const prev = this.get_default_whitelist();
    ips = [...new Set(ips)];
    ips.forEach(ip=>this.pending_www_ips.delete(ip));
    if (!ips.length)
        delete this._defaults.www_whitelist_ips;
    else
        this._defaults.www_whitelist_ips = ips;
    this.set_whitelist_ips(this._defaults.whitelist_ips||[], prev);
};

E.prototype.set_whitelist_ips = function(ips, prev){
    const fixed_whitelist = this.get_fixed_whitelist();
    ips = [...new Set(ips)];
    ips.forEach(ip=>this.pending_ips.delete(ip));
    ips = ips.filter(ip=>!fixed_whitelist.includes(ip));
    prev = prev||this.get_default_whitelist();
    if (!ips.length)
        delete this._defaults.whitelist_ips;
    else
    {
        this._defaults.whitelist_ips = ips.map(ip=>{
            try {
                const _ip = new Netmask(ip);
                const mask = _ip.bitmask==32 ? '' : '/'+_ip.bitmask;
                return _ip.base+mask;
            } catch(e){ return null; }
        }).filter(ip=>ip!==null && ip!='127.0.0.1');
    }
    this.update_ports({
        whitelist_ips: {
            default: 1,
            prev,
            curr: this.get_default_whitelist(),
        },
    });
};

E.prototype.error_handler = function error_handler(source, err){
    if (!err.code && err.stack)
        logger.error(err.stack.split('\n').slice(0, 2).join('\n'));
    else if (err.code=='EMFILE')
        return logger.error('EMFILE: out of file descriptors');
    else
        logger.error(err.message);
    err.source = source;
    this.emit('error', err);
};

E.prototype.complete_proxy_config = function(conf){
    const c = Object.assign({}, E.default, this._defaults, conf);
    const zone = this.zones_mgr.get_obj(c.zone);
    const {plan, perm} = zone||{};
    c.ssl_perm = !!(plan && plan.ssl);
    c.state_perm = !!perm && perm.split(' ').includes('state');
    const lpm_user = this.lpm_users.find(u=>c.user && u.email==c.user);
    if (lpm_user)
        c.user_password = lpm_user.password;
    c.hosts = this.hosts;
    c.cn_hosts = this.cn_hosts;
    return c;
};

E.prototype.create_single_proxy = etask._fn(
function*mgr_create_single_proxy(_this, conf){
    conf = _this.complete_proxy_config(conf);
    logger.notice('Starting port %s', conf.port);
    const proxy = new Proxy_port(conf);
    proxy.on('tls_error', ()=>{
        if (_this.tls_warning)
            return;
        _this.tls_warning = true;
        _this.wss.broadcast_json({
            msg: 'update_path',
            payload: true,
            path: 'tls_warning',
        });
    });
    proxy.on('ready', ()=>{
        logger.notice('Port %s ready', conf.port);
    });
    proxy.on('stopped', ()=>{
        logger.notice('Port %s stopped', conf.port);
    });
    proxy.on('updated', ()=>{
        logger.notice('Port %s updated', conf.port);
    });
    proxy.on('usage_start', data=>{
        _this.handle_usage_start(data);
    });
    proxy.on('usage', data=>{
        _this.handle_usage(data);
    });
    proxy.on('usage_abort', data=>{
        _this.handle_usage_abort(data);
    });
    proxy.on('refresh_ip', data=>{
        _this.refresh_ip(data.ip, data.vip, data.port);
    });
    proxy.on('banip_global', opt=>{
        _this.banip(opt.ip, opt.domain, opt.ms);
    });
    proxy.on('save_config', ()=>{
        _this.config.save();
    });
    proxy.on('add_static_ip', data=>etask(function*(){
        const proxy_conf = _this.proxies.find(p=>p.port==data.port);
        const proxy_port = _this.proxy_ports[data.port];
        if ((proxy_conf.ips||[]).includes(data.ip))
            return;
        if (!proxy_conf.ips)
            proxy_conf.ips = [];
        if (!proxy_conf.pool_size)
            return;
        if (proxy_conf.ips.length>=proxy_conf.pool_size)
            return;
        proxy_conf.ips.push(data.ip);
        proxy_port.update_config({ips: proxy_conf.ips});
        _this.add_config_change('add_static_ip', data.port, data.ip);
        yield _this.config.save();
    }));
    proxy.on('remove_static_ip', data=>etask(function*(){
        const proxy_conf = _this.proxies.find(p=>p.port==data.port);
        const proxy_port = _this.proxy_ports[data.port];
        if (!(proxy_conf.ips||[]).includes(data.ip))
            return;
        proxy_conf.ips = proxy_conf.ips.filter(ip=>ip!=data.ip);
        proxy_port.update_config({ips: proxy_conf.ips});
        _this.add_config_change('remove_static_ip', data.port, data.ip);
        yield _this.config.save();
    }));
    proxy.on('add_pending_ip', ip=>{
        _this.pending_ips.add(ip);
    });
    proxy.on('error', err=>{
        _this.error_handler('Port '+conf.port, err);
    });
    _this.proxy_ports[conf.port] = proxy;
    proxy.start();
    const task = this;
    proxy.on('ready', task.continue_fn());
    proxy.on('error', task.continue_fn());
    yield this.wait();
    return proxy;
});

E.prototype.add_config_change = function(key, area, payload){
    this.config_changes.push({key, area, payload});
};

E.prototype.validate_proxy = function(proxy){
    const port_in_range = (port, multiply, taken)=>{
        multiply = multiply||1;
        return port<=taken && port+multiply-1>=taken;
    };
    if (this.argv.www &&
        port_in_range(proxy.port, proxy.multiply, this.argv.www))
    {
        return {msg: 'Proxy port conflict UI port', code: 409};
    }
    if (Object.values(this.proxy_ports).length+(proxy.multiply||1)>
        this._defaults.ports_limit)
    {
        return {msg: 'number of many proxy ports exceeding the limit: '
            +this._defaults.ports_limit, code: 406};
    }
    if (this.proxy_ports[proxy.port])
        return {msg: 'Proxy port already exists', code: 423};
};

E.prototype.update_proxy_fields = function(proxy){
    const zone_name = proxy.zone || this._defaults.zone;
    proxy.password = this.zones_mgr.get_password(proxy, zone_name) ||
        this.argv.password || this._defaults.password;
    proxy.gb_cost = this.zones_mgr.get_gb_cost(zone_name);
    proxy.whitelist_ips = [...new Set(
        this.get_default_whitelist().concat(proxy.whitelist_ips||[]))];
    const conf = Object.assign({}, proxy);
    lpm_config.numeric_fields.forEach(field=>{
        if (conf[field])
            conf[field] = +conf[field];
    });
    conf.static = this.zones_mgr.is_static_proxy(zone_name);
    conf.mobile = this.zones_mgr.is_mobile(zone_name);
    conf.unblock = this.zones_mgr.is_unblocker(zone_name);
    return conf;
};

E.prototype.handle_init_proxy_error = etask._fn(
function*mgr_handle_init_proxy_error(_this, proxy, {msg, code}){
    this.on('uncaught', e=>{
        logger.error('handle init proxy error: '+zerr.e2s(e));
        this.return(false);
    });
    if (code !== 423 || !_this.proxy_ports[proxy.port])
        return false;
    const old_proxy = _this.proxy_ports[proxy.port];
    logger.info(`Handling init proxy port ${proxy.port} error: ${msg}`);
    yield _this.proxy_delete(proxy.port, {skip_config_save: true});
    const et = etask.wait();
    old_proxy.once('stopped', et.continue_fn());
    return !_this.validate_proxy(proxy);
});

E.prototype.init_proxy = etask._fn(function*mgr_init_proxy(_this, proxy){
    const error = _this.validate_proxy(proxy);
    if (error && !(yield _this.handle_init_proxy_error(proxy, error)))
        return {proxy_port: proxy, proxy_err: error.msg};
    const conf = _this.update_proxy_fields(proxy);
    const proxies = _this.multiply_port(conf);
    const proxy_ports = yield etask.all(proxies.map(
        _this.create_single_proxy.bind(_this)));
    const proxy_port = proxy_ports[0];
    proxy_port.dups = proxy_ports.slice(1);
    return {proxy_port};
});

E.prototype.multiply_port = function(master){
    const multiply = master.multiply||1;
    const proxies = [master];
    const ips = master.ips||[];
    const vips = master.vips||[];
    const users = master.users||[];
    for (let i=1; i<multiply; i++)
    {
        const dup = Object.assign({}, master, {
            proxy_type: 'duplicate',
            master_port: master.port,
            port: master.port+i,
        });
        if (dup.multiply_ips)
        {
            dup.ip = ips[i%ips.length];
            // XXX krzysztof: get rid of this redundancy
            dup.ips = [dup.ip];
        }
        if (dup.multiply_vips)
        {
            dup.vip = vips[i%vips.length];
            // XXX krzysztof: get rid of this redundancy
            dup.vips = [dup.vip];
        }
        if (dup.multiply_users)
            dup.user = users[i%users.length];
        proxies.push(dup);
    }
    if (master.multiply_ips)
    {
        master.ip = ips[0];
        // XXX krzysztof: check why we need vips property
        master.ips = [master.ip];
    }
    if (master.multiply_vips)
    {
        master.vip = vips[0];
        // XXX krzysztof: check why we need vips property
        master.vips = [master.vip];
    }
    if (master.multiply_users)
        master.user = users[0];
    return proxies;
};

E.prototype.check_any_whitelisted_ips = function(){
    const get_not_whitelisted_payload = ()=>{
        if ((this._defaults.whitelist_ips||[]).some(util_lib.is_any_ip) ||
            (this._defaults.www_whitelist_ips||[]).some(util_lib.is_any_ip))
        {
            return {type: 'defaults'};
        }
        const proxy_port = this.proxies.find(p=>
            (p.whitelist_ips||[]).some(util_lib.is_any_ip));
        return proxy_port ? {type: 'proxy', port: proxy_port.port} : null;
    };
    this.wss.broadcast_json({
        msg: 'update_path',
        payload: get_not_whitelisted_payload(),
        path: 'not_whitelisted',
    });
};

E.prototype.create_new_proxy = etask._fn(function*(_this, conf){
    this.on('uncaught', e=>{
        logger.error('proxy create: '+zerr.e2s(e));
        this.throw(e);
    });
    if (!conf.proxy_type && conf.port!=_this._defaults.dropin_port)
        conf.proxy_type = 'persist';
    conf = util_lib.omit_by(conf, v=>!v && v!==0 && v!==false);
    const {proxy_port, proxy_err} = yield _this.init_proxy(conf);
    if (conf.proxy_type=='persist' && !proxy_err)
    {
        _this.proxies.push(conf);
        yield _this.config.save();
        if (conf.ext_proxies)
            yield _this.ext_proxy_created(conf.ext_proxies);
        _this.check_any_whitelisted_ips();
    }
    else if (proxy_err)
    {
        logger.warn('Could not create proxy port %s: %s', proxy_port.port,
            proxy_err);
    }
    return {proxy_port, proxy_err};
});

E.prototype.proxy_delete = etask._fn(function*_proxy_delete(_this, port, opt){
    opt = opt||{};
    const proxy = _this.proxy_ports[port];
    if (!proxy)
        throw new Error('this proxy does not exist');
    if (proxy.opt.proxy_type=='duplicate')
        throw new Error('cannot delete this port');
    if (proxy.deleting)
        throw new Error('this proxy is already being stopped and deleted');
    proxy.deleting = true;
    yield proxy.stop();
    [proxy, ...proxy.dups].forEach(p=>{
        // needed in order to prevent other APIs from getting orphan dups
        delete _this.proxy_ports[p.opt.port];
        p.destroy();
    });
    if (proxy.opt.proxy_type!='persist')
        return;
    const idx = _this.proxies.findIndex(p=>p.port==port);
    if (idx==-1)
        return;
    _this.proxies.splice(idx, 1);
    if (!opt.skip_config_save)
        yield _this.config.save(opt);
    _this.check_any_whitelisted_ips();
});

const get_free_port = proxies=>{
    const proxy_ports = Array.isArray(proxies) ?
        proxies.map(x=>x.port) : Object.keys(proxies);
    if (!proxy_ports.length)
        return 24000;
    return Math.max(...proxy_ports)+1;
};

E.prototype.proxy_dup_api = etask._fn(
function*mgr_proxy_dup_api(_this, req, res, next){
    this.on('uncaught', next);
    const port = req.body.port;
    const proxy = zutil.clone_deep(_this.proxies.filter(p=>p.port==port)[0]);
    proxy.port = get_free_port(_this.proxy_ports);
    yield _this.create_new_proxy(proxy);
    res.json({proxy});
});

E.prototype.proxy_create_api = etask._fn(
function*mgr_proxy_create_api(_this, req, res, next){
    this.on('uncaught', next);
    if (!req.body.proxy.port)
        req.body.proxy.port = get_free_port(_this.proxy_ports);
    const port = +req.body.proxy.port;
    if (req.body.proxy.users && req.body.proxy.users.length)
        req.body.proxy.users = req.body.proxy.users.map(x=>x.toLowerCase());
    if (req.body.proxy.multiply_users && req.body.create_users)
    {
        try { yield _this.add_lpm_users(req.body.proxy.users); }
        catch(e){
            return res.status(400).json({errors: [{msg: e.message,
                field: 'users'}]});
        }
    }
    const {ext_proxies} = req.body.proxy;
    const errors = yield _this.proxy_check({port, ext_proxies});
    if (errors.length)
        return res.status(400).json({errors});
    const proxy = Object.assign({}, req.body.proxy, {port});
    if (proxy.bw_limit)
        _this.update_bw_limits(_this, proxy);
    _this.add_config_change('create_proxy_port', port, req.body.proxy);
    const {proxy_port, proxy_err} = yield _this.create_new_proxy(proxy);
    if (proxy_err)
        return res.status(400).json({errors: [{msg: proxy_err}]});
    res.json({data: proxy_port.opt});
});

E.prototype.add_lpm_users = etask._fn(function*mgr_add_lpm_users(_this, users){
    if (!users || !users.length || !Array.isArray(users))
        return;
    const exists = (yield _this.lpm_users_get()).reduce((acc, c)=>
        acc.add(c.email), new Set());
    const add = users.filter(x=>!exists.has(x));
    if (!add.length)
        return;
    const res = yield _this.api_request({endpoint: '/lpm/lpm_users_add',
        method: 'POST', form: {worker: {email: add.join(',')}}, no_throw: 1});
    if (res.statusCode!=200)
        throw new Error(res.body);
    _this.update_lpm_users(yield _this.lpm_users_get());
});

E.prototype.proxy_update = etask._fn(
function*mgr_proxy_update(_this, old_proxy, new_proxy){
    const multiply_changed = new_proxy.multiply!==undefined &&
        new_proxy.multiply!=old_proxy.multiply ||
        new_proxy.multiply_users!==undefined &&
        new_proxy.multiply_users!=old_proxy.multiply_users;
    const port_changed = new_proxy.port && new_proxy.port!=old_proxy.port;
    const zone_changed = new_proxy.zone && old_proxy.zone!=new_proxy.zone;
    const proxy_has_render = new_proxy.render || old_proxy.render;
    if (zone_changed || proxy_has_render)
        _this.adjust_new_zone(_this, new_proxy, old_proxy);
    if (new_proxy.bw_limit)
        _this.update_bw_limits(_this, new_proxy, old_proxy);
    _this.add_config_change('update_proxy_port', old_proxy.port,
        Object.assign({}, new_proxy));
    if (port_changed || multiply_changed)
        return yield _this.proxy_remove_and_create(old_proxy, new_proxy);
    return yield _this.proxy_update_in_place(old_proxy.port, new_proxy,
        {origin: true});
});

E.prototype.update_bw_limits = function(_this, new_proxy, old_proxy={}){
    const fields = ['days', 'bytes', 'start', 'renewable'];
    new_proxy.bw_limit = Object.assign({},
        zutil.pick(old_proxy.bw_limit, ...fields),
        zutil.pick(new_proxy.bw_limit, ...fields));
    new_proxy.bw_limit.renewable = !!new_proxy.bw_limit.renewable;
    if (!new_proxy.bw_limit.start)
        new_proxy.bw_limit.start = date();
};

E.prototype.adjust_new_zone = function(_this, new_proxy, old_proxy={}){
    const zone = new_proxy.zone || old_proxy.zone;
    const is_render_plan = _this.zones_mgr.is_unblocker(zone) ||
        _this.zones_mgr.is_serp(zone);
    if (!is_render_plan && (new_proxy.render || old_proxy.render))
        new_proxy.render = false;
};

E.prototype.proxy_update_in_place = etask._fn(
function*(_this, port, new_proxy, opt={}){
    if (opt.origin && _this._defaults.sync_config)
        yield _this.lpm_f.proxy_update_in_place(port, new_proxy);
    const old_opt = _this.proxies.find(p=>p.port==port);
    new_proxy.zone = new_proxy.zone || old_opt.zone;
    new_proxy = _this.update_proxy_fields(new_proxy);
    Object.assign(old_opt, new_proxy);
    lpm_config.mgr_proxy_shared_fields.forEach(s=>{
        if (old_opt[s] && old_opt[s].startsWith('default'))
        {
            delete old_opt[s];
            new_proxy[s] = new_proxy[s].split('-')[1];
        }
    });
    yield _this.config.save({skip_cloud_update: !opt.origin,
        skip_broadcast: 1});
    for (let i=1; i<(old_opt.multiply||1); i++)
        _this.proxy_ports[port+i].update_config(new_proxy);
    const proxy_port = _this.proxy_ports[port];
    return {proxy_port: proxy_port.update_config(new_proxy)};
});

E.prototype.proxy_remove_and_create = etask._fn(
function*(_this, old_proxy, new_proxy){
    const old_server = _this.proxy_ports[old_proxy.port];
    const banlist = old_server.banlist;
    const old_opt = _this.proxies.find(p=>p.port==old_proxy.port);
    yield _this.proxy_delete(old_proxy.port, {skip_cloud_update: 1});
    const proxy = Object.assign({}, old_proxy, new_proxy, {banlist});
    const {proxy_port, proxy_err} = yield _this.create_new_proxy(proxy);
    if (proxy_err)
    {
        yield _this.create_new_proxy(old_opt);
        return {proxy_err};
    }
    proxy_port.banlist = banlist;
    return {proxy_port: proxy_port.opt};
});

E.prototype.proxy_update_api = etask._fn(
function*mgr_proxy_update_api(_this, req, res, next){
    this.on('uncaught', next);
    logger.info('proxy_update_api');
    const old_port = req.params.port;
    const old_proxy = _this.proxies.find(p=>p.port==old_port);
    if (!old_proxy)
    {
        return res.status(400).json(
            {errors: [{msg: `No proxy at port ${old_port}`}]});
    }
    if (old_proxy.proxy_type!='persist')
        return res.status(400).json({errors: [{msg: 'Proxy is read-only'}]});
    // XXX krzysztof: get rid of proxy check, move this logic inside
    // validate_proxy
    const errors = yield _this.proxy_check(Object.assign({}, old_proxy,
        req.body.proxy), old_port);
    if (errors.length)
        return res.status(400).json({errors});
    const {proxy_port, proxy_err} = yield _this.proxy_update(old_proxy,
        req.body.proxy);
    if (proxy_err)
        return res.status(400).json({errors: [{msg: proxy_err}]});
    res.json({data: proxy_port});
});

E.prototype.api_url_update_api = etask._fn(
function*mgr_api_url_update_api(_this, req, res){
    const api_domain = _this._defaults.api_domain =
        req.body.url.replace(/https?:\/\/(www\.)?/, '');
    _this.conn.domain = yield _this.check_domain();
    if (!_this.conn.domain)
        return void res.json({res: false});
    yield _this.logged_update();
    _this.add_config_change('update_api_domain', 'defaults', api_domain);
    yield _this.config.save();
    res.json({res: true});
});

E.prototype.proxy_banips_api = function(req, res){
    const port = req.params.port;
    const proxy = this.proxy_ports[port];
    if (!proxy)
        return res.status(400).send(`No proxy at port ${port}`);
    let {ips, domain, ms=0} = req.body||{};
    ips = (ips||[]).filter(ip=>util_lib.is_ip(ip) || util_lib.is_eip(ip));
    if (!ips.length)
        return res.status(400).send('No ips provided');
    ips.forEach(ip=>proxy.banip(ip, ms, domain));
    return res.status(204).end();
};

E.prototype.global_banip_api = function(req, res){
    const {ips, ip, domain, ms=0, ports} = req.body||{};
    if (ips)
    {
        ips.forEach(_ip=>this.banip(_ip, domain, ms, ports));
        return res.status(204).end();
    }
    if (!ip || !(util_lib.is_ip(ip) || util_lib.is_eip(ip)))
        return res.status(400).send('No IP provided');
    this.banip(ip, domain, ms, ports);
    return res.status(204).end();
};

E.prototype.banip = function(ip, domain, ms, ports){
    Object.values(this.proxy_ports).forEach(p=>{
        if (ports && !ports.includes(p.opt.port))
            return;
        p.banip(ip, ms, domain);
    });
};

E.prototype.proxy_banip_api = function(req, res){
    const port = req.params.port;
    const proxy = this.proxy_ports[port];
    if (!proxy)
        return res.status(400).send(`No proxy at port ${port}`);
    const {ip, domain, ms=0} = req.body||{};
    if (!ip || !(util_lib.is_ip(ip) || util_lib.is_eip(ip)))
        return res.status(400).send('No IP provided');
    proxy.banip(ip, ms, domain);
    return res.status(204).end();
};

E.prototype.proxy_unbanip_api = function(req, res){
    const port = req.params.port;
    const server = this.proxy_ports[port];
    if (!server)
        throw `No proxy at port ${port}`;
    const {ip, domain} = req.body;
    if (!ip || !(util_lib.is_ip(ip) || util_lib.is_eip(ip)))
        return res.status(400).send('No IP provided');
    const {ips: banned_ips} = this.get_banlist(server, true);
    if (!banned_ips.some(({ip: banned_ip})=>banned_ip==ip))
        return res.status(400).send('IP is not banned');
    server.unbanip(ip, domain);
    return res.json(this.get_banlist(server, true));
};

E.prototype.proxy_unbanips_api = function(req, res){
    const port = req.params.port;
    const server = this.proxy_ports[port];
    if (!server)
        throw `No proxy at port ${port}`;
    server.unbanips();
    return res.status(200).send('OK');
};

E.prototype.get_banlist = function(server, full){
    if (full)
    {
        return {ips: [...server.banlist.cache.values()].map(
            b=>({ip: b.ip, domain: b.domain, to: b.to_date}))};
    }
    return {ips: [...server.banlist.cache.keys()]};
};

E.prototype.get_banlist_api = function(req, res){
    const port = req.params.port;
    if (!port)
        return res.status(400).send('port number is missing');
    const server = this.proxy_ports[port];
    if (!server)
        return res.status(400).send('server does not exist');
    res.json(this.get_banlist(server, req.query.full));
};

E.prototype.get_sessions_api = function(req, res){
    const {port} = req.params;
    const server = this.proxy_ports[port];
    if (!server)
        return res.status(400).send('server does not exist');
    res.json({});
};

E.prototype.proxy_delete_wrapper = etask._fn(
function*mgr_proxy_delete_wrapper(_this, ports, opt={}){
    if (ports.length)
    {
        yield etask.all(ports.map(p=>_this.proxy_delete(p, opt), _this));
        if (opt.no_loki_clear)
            return;
        _this.loki.requests_clear(ports);
        _this.loki.stats_clear_by_ports(ports);
    }
});

E.prototype.proxy_delete_api = etask._fn(
function*mgr_proxy_delete_api(_this, req, res, next){
    this.on('uncaught', next);
    logger.info('proxy_delete_api');
    const port = +req.params.port;
    _this.add_config_change('remove_proxy_port', port);
    yield _this.proxy_delete_wrapper([port]);
    res.sendStatus(204);
});

E.prototype.proxies_delete_api = etask._fn(
function*mgr_proxies_delete_api(_this, req, res, next){
    this.on('uncaught', next);
    logger.info('proxies_delete_api');
    const ports = req.body.ports||[];
    ports.forEach(port=>_this.add_config_change('remove_proxy_port', port));
    yield _this.proxy_delete_wrapper(ports, {skip_cloud_update: 1});
    yield _this.config.save();
    res.sendStatus(204);
});

E.prototype.refresh_sessions_api = function(req, res){
    const port = req.params.port;
    const proxy_port = this.proxy_ports[port];
    if (!proxy_port || req.query.user && proxy_port.opt.user!=req.query.user)
        return res.status(400, 'Invalid proxy port').end();
    const session_id = this.refresh_server_sessions(port);
    if (proxy_port.opt.rotate_session)
        return res.status(204).end();
    res.json({session_id: `${port}_${session_id}`});
};

E.prototype.refresh_server_sessions = function(port){
    const proxy_port = this.proxy_ports[port];
    return proxy_port.refresh_sessions();
};

E.prototype.proxy_status_get_api = etask._fn(
function*mgr_proxy_status_get_api(_this, req, res, next){
    this.on('uncaught', next);
    const port = req.params.port;
    const proxy = _this.proxy_ports[port];
    if (!proxy)
        return res.json({status: 'Unknown proxy'});
    if (proxy.opt && proxy.opt.zone)
    {
        const db_zone = _this.zones_mgr.get_obj(proxy.opt.zone)||{};
        if ((db_zone.plan||{}).disable)
            return res.json({status: 'Disabled zone'});
    }
    if (proxy.opt && proxy.opt.smtp && proxy.opt.smtp.length)
        return res.json({status: 'ok', status_details: [{msg: 'SMTP proxy'}]});
    const force = req.query.force!==undefined
        && req.query.force!=='false' && req.query.force!=='0';
    const fields = ['status'];
    if (proxy.opt && proxy.opt.proxy_type=='persist')
    {
        fields.push('status_details');
        if (!proxy.status_details)
        {
            proxy.status_details = yield _this.proxy_check(proxy.opt,
                proxy.opt.port);
        }
    }
    if (force && proxy.status)
        proxy.status = undefined;
    for (let cnt=0; proxy.status===null && cnt<=22; cnt++)
        yield etask.sleep(date.ms.SEC);
    if (proxy.status===null)
        return res.json({status: 'Unexpected lock on status check.'});
    if (proxy.status)
        return res.json(zutil.pick(proxy, ...fields));
    yield _this.test_port(proxy, req.headers);
    res.json(zutil.pick(proxy, ...fields));
});

E.prototype.test_port = etask._fn(function*lum_test(_this, proxy, headers){
    proxy.status = null;
    let success = false;
    let error = '';
    try {
        const r = yield util_lib.json({
            url: _this._defaults.test_url,
            method: 'GET',
            proxy: `http://127.0.0.1:${proxy.opt.port}`,
            timeout: 20*date.ms.SEC,
            headers: {
                'x-hola-context': 'STATUS CHECK',
                'x-hola-agent': lpm_config.hola_agent,
                'user-agent': util_lib.user_agent,
                'x-lpm-fake': headers['x-lpm-fake'],
            },
        });
        success = r.statusCode==200;
        error = r.headers['x-luminati-error'] || r.headers['x-lpm-error'] ||
            !success && r.statusMessage;
        if (/ECONNREFUSED/.test(error))
        {
            error = 'connection refused (may have been caused due to firewall '
            +'settings)';
        }
    } catch(e){
        etask.ef(e);
        if (e.code=='ESOCKETTIMEDOUT')
            error = 'timeout (may have been caused due to firewall settings)';
    }
    proxy.status = error || (success ? 'ok' : 'error');
});

E.prototype.get_browser_opt = function(port){
    const proxy = this.proxy_ports[port]||{};
    const browser_opt = {};
    const proxy_opt = proxy.opt && zutil.pick(proxy.opt,
        qw`timezone country resolution webrtc`) || {};
    const {timezone, country, resolution, webrtc} = proxy_opt;
    if (timezone=='auto')
        browser_opt.timezone = country && code2timezone(`${country}`);
    else if (timezone)
        browser_opt.timezone = timezone;
    if (resolution)
    {
        const [width, height] = resolution.split('x').map(Number);
        browser_opt.resolution = {width, height};
    }
    if (webrtc)
        browser_opt.webrtc = webrtc;
    return browser_opt;
};

E.prototype.open_browser_api = etask._fn(
function*mgr_open_browser_api(_this, req, res, next){
    this.on('uncaught', next);
    if (!puppeteer)
        return res.status(400).send('Puppeteer not installed');
    let responded = false;
    if (!puppeteer.ready)
    {
        res.status(206).send('Fetching chromium');
        responded = true;
    }
    const {port} = req.params;
    try {
        const browser_opt = _this.get_browser_opt(port);
        yield puppeteer.open_page(_this._defaults.test_url, port, browser_opt);
    } catch(e){
        logger.error('open_browser_api: %s', e.message);
    }
    if (!responded)
        res.status(200).send('OK');
});

E.prototype.proxy_port_check = etask._fn(
function*mgr_proxy_port_check(_this, port, duplicate, old_port, old_duplicate){
    duplicate = +duplicate || 1;
    port = +port;
    old_port = +old_port;
    let start = port;
    const end = port+duplicate-1;
    const old_end = old_port && old_port+(+old_duplicate||1)-1;
    const ports = [];
    for (let p = start; p <= end; p++)
    {
        if (old_port && old_port<=p && p<=old_end)
            continue;
        if (p==_this.argv.www)
            return p+' in use by the UI/API and UI/WebSocket';
        if (_this.proxy_ports[p])
            return p+' in use by another proxy';
        ports.push(p);
    }
    try {
        yield etask.all(ports.map(p=>etask(function*inner_check(){
            const server = http.createServer();
            server.on('error', e=>{
                if (e.code=='EADDRINUSE')
                    this.throw(new Error(p + ' in use by another app'));
                if (e.code=='EACCES')
                {
                    this.throw(new Error(p + ' cannot be used due to '
                    +'permission restrictions'));
                }
                this.throw(new Error(e));
            });
            http_shutdown(server);
            server.listen(p, '0.0.0.0', this.continue_fn());
            yield this.wait();
            yield etask.nfn_apply(server, '.forceShutdown', []);
        })));
    } catch(e){
        etask.ef(e);
        return e.message;
    }
});

E.prototype.proxy_check = etask._fn(
function*mgr_proxy_check(_this, new_proxy_config, old_proxy_port){
    const old_proxy = old_proxy_port && _this.proxy_ports[old_proxy_port]
        && _this.proxy_ports[old_proxy_port].opt || {};
    const info = [];
    const {port, zone, multiply, whitelist_ips, ext_proxies, bw_limit} =
        new_proxy_config;
    if (port!==undefined)
    {
        if (!port || +port<1000)
        {
            info.push({
                msg: 'Invalid port. It must be a number >= 1000',
                field: 'port',
            });
        }
        else
        {
            const in_use = yield _this.proxy_port_check(port, multiply,
                old_proxy_port, old_proxy.multiply);
            if (in_use)
                info.push({msg: 'port '+in_use, field: 'port'});
        }
    }
    if (zone!==undefined)
    {
        const zone_obj = _this.zones_mgr.get_obj(zone);
        if (!zone_obj)
        {
            info.push({msg: 'the provided zone name is not valid.',
                field: 'zone'});
        }
        else if (zone_obj.ips==='')
        {
            info.push({msg: 'the zone has no IPs in whitelist',
                field: 'zone'});
        }
        else if (!zone_obj.plan || zone_obj.plan.disable)
            info.push({msg: 'zone disabled', field: 'zone'});
    }
    if (whitelist_ips!==undefined)
    {
        if (_this.argv.zagent && whitelist_ips.some(util_lib.is_any_ip))
        {
            info.push({
                msg: 'Not allowed to set \'any\' or 0.0.0.0/0 as a '
                    +'whitelisted IP in Cloud Proxy Manager',
                field: 'whitelist_ips',
            });
        }
    }
    if (ext_proxies!==undefined)
    {
        if (_this.argv.zagent && ext_proxies.length>consts.MAX_EXT_PROXIES)
        {
            info.push({
                msg: 'Maximum external proxies size in Cloud Proxy Manager '
                    +`${consts.MAX_EXT_PROXIES} exceeded`,
                field: 'ext_proxies',
            });
        }
    }
    if (bw_limit)
    {
        for (let p of ['bytes', 'days'])
        {
            let value = +bw_limit[p];
            if (!value || value<0)
            {
                info.push({msg: `Invalid BW limit params, ${p} should be `
                    +`positive number`, field: 'bw_limit'});
            }
        }
        if (bw_limit.start)
        {
            const start = date(bw_limit.start);
            if (!(start instanceof Date) || isNaN(start.getTime()))
            {
                info.push({msg: `Invalid BW limit params, start should be `
                    +`date`, field: 'bw_limit'});
            }
        }
    }
    for (let field in new_proxy_config)
    {
        const val = new_proxy_config[field];
        if ((typeof val=='string' || val instanceof String) &&
            val.length>consts.MAX_STRING_LENGTH)
        {
            info.push({
                msg: 'Maximum string length exceeded',
                field,
            });
        }
    }
    return info;
});

E.prototype.proxy_tester_api = function(req, res){
    const port = req.params.port;
    const proxy = this.proxy_ports[port];
    if (!proxy)
        return res.status(500).send(`proxy port ${port} not found`);
    let response_sent = false;
    const handle_log = req_log=>{
        if (req_log.details.context!='PROXY TESTER TOOL')
            return;
        this.removeListener('request_log', handle_log);
        response_sent = true;
        res.json(req_log);
    };
    this.on('request_log', handle_log);
    const opt = Object.assign(zutil.pick(req.body, ...qw`url headers body`),
        {followRedirect: false});
    if (opt.body && typeof opt.body!='string')
        opt.body = JSON.stringify(opt.body);
    const password = proxy.opt.password;
    const user = 'tool-proxy_tester';
    const basic = Buffer.from(user+':'+password).toString('base64');
    opt.headers = opt.headers||{};
    opt.headers['proxy-authorization'] = 'Basic '+basic;
    opt.headers['user-agent'] = req.get('user-agent');
    if (+port)
    {
        opt.proxy = 'http://127.0.0.1:'+port;
        if (proxy.opt && proxy.opt.ssl)
            opt.ca = ssl.ca.cert;
        if (proxy.opt && proxy.opt.unblock)
            opt.rejectUnauthorized = false;
    }
    request(opt, err=>{
        if (!err)
            return;
        this.removeListener('request_log', handle_log);
        logger.error('proxy_tester_api: %s', err.message);
        if (!response_sent)
            res.status(500).send(err.message);
    });
};

E.prototype.get_all_locations_api = function(req, res){
    const data = cities.all_locations();
    res.json(data);
};

E.prototype.get_all_carriers_api = etask._fn(
function*mgr_get_all_carriers(_this, req, res, next){
    this.on('uncaught', next);
    const c_res = yield _this.api_request({
        endpoint: '/lpm/carriers',
        no_throw: 1,
        force: 1,
    });
    if (c_res.statusCode==200)
        return res.json(c_res.body);
    logger.warn('Unable to get carriers: %s %s %s', c_res.statusCode,
        c_res.statusMessage, c_res.body);
    res.json([]);
});

E.prototype.logs_suggestions_api = function(req, res){
    if (this.argv.high_perf)
        return res.json({ports: [], status_codes: [], protocols: []});
    const ports = this.loki.colls.port.chain().data().map(r=>r.key);
    const protocols = this.loki.colls.protocol.chain().data().map(r=>r.key);
    const status_codes = this.loki.colls.status_code.chain().data()
        .map(r=>r.key);
    const suggestions = {ports, status_codes, protocols};
    res.json(suggestions);
};

E.prototype.logs_reset_api = function(req, res){
    const ports = req.query.port && [+req.query.port] || undefined;
    this.loki.stats_clear();
    this.loki.requests_clear(ports);
    res.send('ok');
};

E.prototype.logs_cloud_get_api = etask._fn(
function*_logs_cloud_get_api(_this, req, res, next){
    this.on('uncaught', next);
    if (_this.argv.high_perf)
        return {};
    let result = _this.filtered_get(req);
    let orig = Object.assign({}, _this.har(result.items), {total: result.total,
        skip: result.skip, sum_out: result.sum_out, sum_in: result.sum_in});
    if (!_this.argv.zagent)
        return res.json(orig);
    let clogs = yield _this.cloud_mgr.get_logs(req.query);
    return res.json(_this.concat_logs(orig, ...clogs)||orig);
});

E.prototype.logs_get_api = function(req, res){
    if (this.argv.high_perf)
        return {};
    const result = this.filtered_get(req);
    res.json(Object.assign({}, this.har(result.items), {total: result.total,
        skip: result.skip, sum_out: result.sum_out, sum_in: result.sum_in}));
};

E.prototype.logs_har_get_api = function(req, res){
    res.setHeader('content-disposition', 'attachment; filename=data.har');
    const result = this.filtered_get(req);
    res.send(JSON.stringify(this.har(result.items), null, 4));
};

E.prototype.logs_resend_api = function(req, res){
    const ids = req.body.uuids;
    for (let i in ids)
    {
        const r = this.loki.request_get_by_id(ids[i]);
        let proxy;
        if (!(proxy = this.proxy_ports[r.port]))
            continue;
        const opt = {
            proxy: 'http://127.0.0.1:'+r.port,
            url: r.url,
            method: 'GET',
            headers: JSON.parse(r.request_headers),
            followRedirect: false,
        };
        if (proxy.opt.ssl)
            opt.ca = ssl.ca.cert;
        request(opt);
    }
    res.send('ok');
};

E.prototype.filtered_get = function(req){
    if (this.argv.high_perf)
        return {};
    const skip = +req.query.skip||0;
    const limit = +req.query.limit||0;
    const query = {};
    if (req.query.port_from && req.query.port_to)
        query.port = {'$between': [req.query.port_from, req.query.port_to]};
    if (req.query.search)
    {
        query.$or = [{url: {'$regex': RegExp(req.query.search)}},
            {username: {'$regex': RegExp('session-[^-]*'+req.query.search)}}];
    }
    let status_code;
    if (status_code = req.query.status_code)
    {
        if (/^\d\*\*$/.test(status_code))
            query.status_code = {'$regex': RegExp(`^${status_code[0]}`)};
        else
            query.status_code = +status_code;
    }
    ['port', 'content_type', 'protocol'].forEach(param=>{
        let val;
        if (val = req.query[param])
        {
            if (param=='port')
                val = +val;
            query[param] = val;
        }
    });
    const sort = {field: req.query.sort||'uuid', desc: !!req.query.sort_desc};
    const items = this.loki.requests_get(query, sort, limit, skip);
    const total = this.loki.requests_count(query);
    const sum_in = this.loki.requests_sum_in(query);
    const sum_out = this.loki.requests_sum_out(query);
    return {total, skip, limit, items, sum_in, sum_out};
};

E.prototype.check_logs = function(logs){
    return logs.length && logs.every(l=>l.log && Array.isArray(l.log.entries)
        && l.sum_in && l.sum_out && l.total);
};

E.prototype.concat_logs = function(...logs){
    if (!this.check_logs(logs))
        return null;
    let orig = logs.shift();
    logs.forEach(l=>{
        orig.total += l.total;
        orig.log.entries = orig.log.entries.concat(l.log.entries);
        orig.sum_in += l.sum_in;
        orig.sum_out += l.sum_out;
    });
    orig.log.entries = orig.log.entries.sort((a, b)=>
        new Date(a.startedDateTime) - new Date(b.startedDateTime));
    return orig;
};

E.prototype.node_version_api = etask._fn(
function*mgr_node_version(_this, req, res, next){
    this.on('uncaught', next);
    if (process.versions && !!process.versions.electron)
        return res.json({is_electron: true});
    const chk = yield etask.nfn_apply(check_node_version,
        [{node: pkg.recommendedNode}]);
    res.json({
        current: chk.versions.node.version,
        satisfied: chk.versions.node.isSatisfied,
        recommended: pkg.recommendedNode,
    });
});

E.prototype.last_version_api = etask._fn(
function*mgr_last_version(_this, req, res, next){
    this.on('uncaught', next);
    try {
        const r = yield util_lib.get_last_version(_this._defaults.api_domain);
        res.json({version: r.ver, newer: r.newer, versions: r.versions});
    } catch(e){
        logger.warn('could not fetch the latest version number %s', e.message);
        res.status(500).send(e.message);
    }
});

E.prototype.get_params = function(){
    const args = [];
    for (let k in this.argv)
    {
        const val = this.argv[k];
        if (qw`$0 h help version p ? v _ explicit_proxy_opt explicit_mgr_opt
            rules native_args daemon_opt`.includes(k))
        {
            continue;
        }
        if (lpm_config.credential_fields.includes(k))
            continue;
        if (typeof val=='object'&&zutil.equal_deep(val, E.default[k])||
            val===E.default[k])
        {
            continue;
        }
        if (lpm_config.boolean_fields.includes(k)||val===false)
        {
            args.push(`--${val?'':'no-'}${k}`);
            continue;
        }
        [].concat(val).forEach(v=>{
            if (k!='_')
                args.push('--'+k);
            args.push(v);
        });
    }
    if (!this.argv.config)
    {
        // must provide these as args to enable login w/o config
        for (let k of lpm_config.credential_fields.sort())
        {
            if (this._defaults[k])
                args.push(`--${k}`, this._defaults[k]);
        }
    }
    return args;
};

E.prototype.get_cloud_url_address = function(){
    const {_defaults: {account_id}} = this;
    return `pmgr-customer-${account_id}.zproxy.lum-superproxy.io`;
};

E.prototype.get_settings = function(){
    return {
        account_id: this._defaults.account_id,
        customer: this._defaults.customer,
        zone: this._defaults.zone,
        password: this._defaults.password,
        www_whitelist_ips: this._defaults.www_whitelist_ips||[],
        whitelist_ips: this._defaults.whitelist_ips||[],
        reverse_proxy_ips: this._defaults.reverse_proxy_ips||[],
        fixed_whitelist_ips: this.get_fixed_whitelist(),
        read_only: this.opts.read_only,
        config: this.argv.config,
        test_url: this._defaults.test_url,
        mail_domain: pkg.mail_domain,
        logs: this._defaults.logs,
        log: this._defaults.log,
        har_limit: this._defaults.har_limit,
        debug: this._defaults.debug,
        lpm_auth: this._defaults.lpm_auth,
        request_stats: this._defaults.request_stats,
        dropin: this._defaults.dropin,
        pending_ips: [...this.pending_ips],
        pending_www_ips: [...this.pending_www_ips],
        zagent: this.argv.zagent,
        reseller: this.is_reseller(),
        sync_config: this._defaults.sync_config,
        ask_sync_config: this._defaults.ask_sync_config,
        cache_report: [this.cache.space_taken],
        cache_limit: consts.CACHE_LIMIT,
        lpm_token: this._defaults.lpm_token,
        cloud_url_address: this.get_cloud_url_address(),
        server_conf: this.server_conf,
        proxy_port: E.default.proxy_port,
        username: this.last_username,
    };
};

// XXX krzysztof: improve mechanism for defaults values
E.prototype.update_settings_api =
etask._fn(function*mgr_update_settings_api(_this, req, res, next){
    this.on('uncaught', next);
    if (_this.argv.zagent && (
        (req.body.www_whitelist_ips||[]).some(util_lib.is_any_ip) ||
        (req.body.whitelist_ips||[]).some(util_lib.is_any_ip)))
    {
        return res.status(400).send('Not allowed to set \'any\' or 0.0.0.0/0 '
            +'as a whitelisted IP in Cloud Proxy Manager');
    }
    if (_this.argv.zagent && req.body.logs)
    {
        if (_this.is_reseller())
        {
            return res.status(400).send(`Request logs limit can't be set `
                +'for resellers');
        }
        if (req.body.logs>1000)
        {
            return res.status(400).send('Request logs limit can only have a '
                +'maximum value of 1000 in Cloud Proxy Manager');
        }
    }
    if (_this.argv.zagent && req.body.har_limit!==undefined &&
        ![-1, 1024].includes(req.body.har_limit))
    {
        return res.status(400).send('Response size limit can only be 1KB or '
            +'Disabled in Cloud Proxy Manager');
    }
    let skip_cloud_update;
    for (const field in req.body)
    {
        const val = req.body[field];
        switch (field)
        {
        case 'zone':
            _this._defaults[field] = val;
            _this.add_config_change('update_zone', 'defaults', val);
            break;
        case 'har_limit':
            _this._defaults[field] = val;
            _this.update_ports({har_limit: val});
            _this.add_config_change('update_har_limit', 'defaults', val);
            break;
        case 'debug':
            _this._defaults[field] = val;
            _this.opts[field] = val;
            _this.update_ports({debug: val});
            _this.add_config_change('update_debug', 'defaults', val);
            break;
        case 'lpm_auth':
            _this._defaults[field] = val;
            _this.opts[field] = val;
            _this.update_ports({lpm_auth: val});
            _this.add_config_change('update_lpm_auth', 'defaults', val);
            break;
        case 'logs':
            _this._defaults[field] = val;
            _this.loki.request_trunc(val);
            _this.add_config_change('update_logs', 'defaults', val);
            break;
        case 'log':
            _this._defaults[field] = val;
            _this.set_logger_level(val);
            _this.add_config_change('update_log_level', 'defaults', val);
            break;
        case 'request_stats':
            _this._defaults[field] = val===undefined||val==='' ? true : val;
            if (!_this._defaults.request_stats)
                _this.loki.stats_clear();
            break;
        case 'www_whitelist_ips':
            _this.add_config_change('update_www_whitelist_ips', 'defaults',
                val);
            _this.set_www_whitelist_ips(val);
            break;
        case 'whitelist_ips':
            _this.add_config_change('update_whitelist_ips', 'defaults', val);
            _this.set_whitelist_ips(val);
            break;
        case 'sync_config':
            delete _this._defaults.ask_sync_config;
            if (val && !_this._defaults.sync_config)
                skip_cloud_update = 1;
            _this._defaults[field] = val;
            if (skip_cloud_update)
            {
                const config = yield _this.lpm_f.get_conf();
                yield _this.apply_cloud_config(config||{}, {force: 1});
            }
            break;
        }
    }
    yield _this.config.save({skip_cloud_update});
    _this.check_any_whitelisted_ips();
    if (req.query.pretty!==undefined)
        return res.send(format_json(_this.get_settings()));
    res.json(_this.get_settings());
});

E.prototype.get_settings_api = function(req, res){
    if (req.query.pretty!==undefined)
        return res.send(format_json(this.get_settings()));
    res.json(this.get_settings());
};

E.prototype.config_get_api = function(req, res){
    res.json({config: this.config.get_string()});
};

E.prototype.config_set_api = etask._fn(
function*mgr_set_config(_this, req, res, next){
    this.on('uncaught', next);
    yield _this.config.set_string(req.body.config);
    res.json({result: 'ok'});
    _this.emit('config_changed');
});

E.prototype.creds_user_api = etask._fn(
function*mgr_creds(_this, req, res, next){
    this.on('uncaught', next);
    _this._defaults.customer = req.body.customer || _this._defaults.customer;
    _this._defaults.google_token = req.body.token;
    const login_result = yield _this.login_user(req.body.username,
        req.body.password, req.body.two_step_token);
    if (login_result.error || login_result.body)
        return res.json(login_result.body || login_result);
    if (login_result.customers)
        return res.json({account_ids: login_result.account_ids});
    _this._defaults.lpm_token = login_result;
    const cloud_conf = yield _this.lpm_f.login();
    yield _this.logged_update();
    if (cloud_conf)
        yield _this.apply_cloud_config(cloud_conf);
    _this.update_lpm_users(yield _this.lpm_users_get());
    _this.add_first_whitelist(req.ip);
    if (_this._defaults.password)
        res.cookie('local-login', _this._defaults.password);
    res.json({result: 'ok'});
});

E.prototype.add_first_whitelist = function(ip){
    const whitelist_ips = this._defaults.www_whitelist_ips||[];
    const new_whitelist_ips = [...whitelist_ips];
    if (!this.argv.zagent && !new_whitelist_ips.length && ip!='127.0.0.1')
        new_whitelist_ips.push(ip);
    this.set_www_whitelist_ips(new_whitelist_ips);
};

E.prototype.update_proxies = function(){
    this.proxies.forEach(p=>{
        if (this.logged_in)
        {
            p.account_id = p.account_id || this._defaults.account_id;
            p.customer = p.customer || this._defaults.customer;
            p.zone = p.zone || this._defaults.zone;
            const zone = this.zones_mgr.get_obj(p.zone||this._defaults.zone);
            if (!zone)
                return;
            p.password = zone.password || p.password;
            p.gb_cost = this.zones_mgr.get_gb_cost(zone.zone);
            p.mobile = this.zones_mgr.is_mobile(zone.zone);
            p.unblock = this.zones_mgr.is_unblocker(zone.zone);
            if (p.unblock)
                p.ssl = true;
        }
        const proxy_port = this.proxy_ports[p.port];
        if (proxy_port)
            proxy_port.update_config(p);
    });
};

E.prototype.gen_token = function(){
    const length = 14;
    const charset = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let ret = '';
    for (let i=0, n=charset.length; i<length; i++)
        ret += charset.charAt(Math.floor(Math.random()*n));
    return ret;
};

E.prototype.gen_token_api = etask._fn(
function*gen_token_api(_this, req, res, next){
    this.on('uncaught', next);
    const token = _this.gen_token();
    _this._defaults.token_auth = token;
    _this.update_ports({token_auth: token});
    _this.add_config_change('generate_token', 'defaults', token);
    yield _this.config.save();
    res.json({token});
});

E.prototype.update_ports = function(opt){
    const indexed_proxies = this.proxies.reduce((acc, p)=>
        Object.assign(acc, {[p.port]: p}), {});
    Object.values(this.proxy_ports).forEach(p=>{
        const conf = indexed_proxies[p.opt.port];
        const override = {};
        lpm_config.mgr_proxy_shared_fields.forEach(s=>{
            if (opt[s]!==undefined && conf[s]!==undefined && conf[s]!=opt[s])
                override[s] = conf[s];
        });
        p.update_config(Object.assign({}, opt, override));
        if (conf)
            conf.whitelist_ips = p.opt.whitelist_ips;
    });
};

E.prototype.proxies_running_get_api = function(req, res){
    const proxies_running = [];
    const proxies_idx = new Map(this.proxies.map(p=>[p.port, p]));
    for (const p of Object.values(this.proxy_ports))
    {
        if (p.opt.port==this._defaults.dropin_port ||
            req.query.user && p.opt.user!=req.query.user)
        {
            continue;
        }
        const config = Object.assign({}, proxies_idx.get(p.opt.port) ||
            proxies_idx.get(p.opt.master_port));
        config.master_port = p.opt.master_port;
        if (config.master_port)
            qw`ips vips users whitelist_ips`.forEach(k=>delete config[k]);
        const p_opt_fields = qw`proxy_type port ip vip user zone`;
        p_opt_fields.forEach(prop=>config[prop] = p.opt[prop]);
        const p_fields = qw`status status_details`;
        p_fields.forEach(prop=>config[prop] = p[prop]);
        proxies_running.push(config);
    }
    const proxies_running_sorted = proxies_running.sort((a, b)=>a.port-b.port);
    if (req.query.pretty!==undefined)
        return res.send(format_json(proxies_running_sorted));
    res.json(proxies_running_sorted);
};

E.prototype.proxies_get_api = function(req, res){
    const port = req.params.port;
    if (!port)
        return res.json(this.proxies);
    const proxies = this.proxies.reduce((acc, p)=>
        Object.assign({}, acc, {[p.port]: p}), {});
    const port_conf = proxies[port];
    if (!port_conf)
        return res.status(400).send('invalid port number');
    return res.json(port_conf);
};

E.prototype.request_allocated_ips = etask._fn(
function*mgr_request_allocated_ips(_this, zone_name){
    const zone = _this.zones_mgr.get_obj(zone_name);
    if (!zone)
        throw new Error('specified zone does not exist');
    const res = yield _this.api_request({
        endpoint: '/lpm/alloc_ips',
        qs: {zone: zone_name},
    });
    return res.body;
});

E.prototype.request_allocated_vips = etask._fn(
function*mgr_request_allocated_vips(_this, zone_name){
    const zone = _this.zones_mgr.get_obj(zone_name);
    if (!zone)
        throw new Error('specified zone does not exist');
    const res = yield _this.api_request({
        endpoint: '/lpm/alloc_vips',
        qs: {zone: zone_name},
    });
    return res.body;
});

E.prototype.allocated_ips_get_api = etask._fn(
function*mgr_allocated_ips_get(_this, req, res, next){
    this.on('uncaught', next);
    try {
        res.send(yield _this.request_allocated_ips(req.query.zone));
    } catch(e){
        logger.warn('Could not get allocated IPs: %s', e.message);
        res.status(500).send(e.message);
    }
});

E.prototype.allocated_vips_get_api = etask._fn(
function*mgr_allocated_vips_get(_this, req, res, next){
    this.on('uncaught', next);
    try {
        res.send(yield _this.request_allocated_vips(req.query.zone));
    } catch(e){
        logger.warn('Could not get allocated gIPs: %s', e.message);
        res.status(500).send(e.message);
    }
});

E.prototype.lpm_users_get = etask._fn(function*mgr_lpm_users_get(_this){
    try {
        const response = yield _this.api_request({endpoint: '/lpm/lpm_users'});
        return response && response.body || [];
    } catch(e){
        logger.warn('failed to fetch lpm_users: %s', e.message);
        return [];
    }
});

E.prototype.update_lpm_users = function(users){
    users = users||[];
    this.lpm_users = users;
    Object.values(this.proxy_ports).forEach(proxy_port=>{
        if (!proxy_port.opt.user)
            return;
        const user = users.find(u=>u.email==proxy_port.opt.user);
        if (!user)
            return;
        proxy_port.update_config({user_password: user.password});
    });
};

E.prototype.lpm_user_add_api = etask._fn(
function*mgr_user(_this, req, res, next){
    this.on('uncaught', next);
    const _res = yield _this.api_request({
        endpoint: '/lpm/lpm_users_add',
        method: 'POST',
        form: {worker: {email: req.body.email}},
    });
    if (_res.statusCode!=200)
        return res.status(_res.statusCode).send(_res.body);
    res.send('ok');
});

E.prototype.lpm_users_get_api = etask._fn(
function*mgr_user(_this, req, res, next){
    this.on('uncaught', next);
    const users = yield _this.lpm_users_get();
    _this.update_lpm_users(users);
    if (req.query.pretty!==undefined)
        return res.send(format_json(users));
    res.json(users);
});

E.prototype.refresh_ip = etask._fn(
function*mgr_refresh_ip(_this, ip, vip, port){
    this.on('uncaught', e=>logger.error('refresh_ip: %s', zerr.e2s(e)));
    logger.notice('Refreshing IP %s %s', ip, vip);
    const proxy_port = _this.proxy_ports[port];
    const allocated_ips = yield _this.request_allocated_ips(
        proxy_port.opt.zone);
    let opt = vip ? {vips: vip} : {ips: conv.inet_addr(ip)};
    const new_ips = yield _this.refresh_ips(proxy_port.opt.zone, opt);
    if (new_ips.error)
        return logger.error('Refreshing IP failed: %s', new_ips.error);
    if (allocated_ips.length!=new_ips.length)
    {
        throw new Error('Refreshing IPs failed: list length mismatch %s!=%s',
            allocated_ips.length, new_ips.length);
    }
    const old_ips = new Set(allocated_ips.ips);
    const new_ip = (new_ips.ips.find(o=>!old_ips.has(o.ip))||{}).ip;
    if (!new_ip)
        throw new Error('Refreshed IP was not found in the new alloc ips');
    if ((proxy_port.opt.ips||[]).includes(ip))
    {
        const {master_port=port} = proxy_port.opt;
        const proxy_conf = _this.proxies.find(p=>p.port==master_port);
        const updated_ips = ([...ips])=>{
            let idx;
            if ((idx = ips.findIndex(_ip=>_ip==ip))!=-1)
                ips[idx] = new_ip;
            return ips;
        };
        proxy_conf.ips = updated_ips(proxy_conf.ips);
        const update = Object.assign({ips: updated_ips(proxy_port.opt.ips)},
            proxy_conf.multiply_ips && {ip: new_ip});
        proxy_port.update_config(update);
        _this.add_config_change('refresh_ip', port, new_ip);
        yield _this.config.save();
    }
    _this.refresh_server_sessions(port);
    logger.notice('IP has been refreshed %s -> %s', ip, new_ip);
});

E.prototype.refresh_ips = etask._fn(function*fresh_ips(_this, zone, opt){
    const response = yield _this.api_request({
        method: 'POST',
        endpoint: '/lpm/refresh_ips',
        form: Object.assign({zone}, opt),
        no_throw: true,
    });
    if (response.statusCode==200)
        return response.body;
    return {status: response.statusCode, error: response.body};
});

E.prototype.refresh_ips_api = etask._fn(
function*mgr_refresh_ips(_this, req, res, next){
    this.on('uncaught', next);
    const zone = req.body.zone;
    const vips = req.body.vips;
    let ips;
    if (req.body.ips && !Array.isArray(req.body.ips))
        return res.status(400).send('ips should be an array of IPs');
    else if (req.body.ips)
        ips = req.body.ips.map(ip=>zurl.ip2num(ip)).join(' ');
    const serv_res = yield _this.refresh_ips(zone, {vips, ips});
    return res.json(serv_res);
});

E.prototype.shutdown_api = function(req, res){
    res.json({result: 'ok'});
    this.stop();
};

E.prototype.logout = etask._fn(function*mgr_logout(_this){
    yield _this.api_request({
        endpoint: '/lpm/invalidate_session',
        method: 'POST',
        no_throw: 1,
    });
    for (let k of lpm_config.credential_fields)
        _this._defaults[k] = '';
    _this.proxies.forEach(p=>{
        for (const cred_field of lpm_config.credential_fields)
        {
            if (p.hasOwnProperty(cred_field))
                delete p[cred_field];
        }
    });
    _this.config.save({skip_cloud_update: 1});
    yield _this.logged_update();
    yield _this.lpm_f.logout();
});

E.prototype.logout_api = etask._fn(
function*mgr_logout_api(_this, req, res, next){
    this.on('uncaught', next);
    yield _this.logout();
    res.cookie('local-login', '');
    res.json({result: 'ok'});
});

E.prototype.restart_api = etask._fn(function*(_this, req, res, next){
    this.on('uncaught', next);
    yield _this.restart();
    res.json({result: 'ok'});
});

E.prototype.restart = etask._fn(function*mgr_restart(_this, opt={}){
    if (!opt.cleanup)
        yield _this.loki.save();
    _this.emit('restart', opt);
});

E.prototype.upgrade_api = etask._fn(
function*mgr_upgrade(_this, req, res, next){
    this.on('uncaught', next);
    yield _this.upgrade(e=>{
        if (e)
            res.status(403).send(e);
        else
            res.json({result: 'ok'});
    });
});

E.prototype.upgrade = etask._fn(function*mgr__upgrade(_this, cb){
    yield _this.loki.save();
    _this.emit('upgrade', cb);
});

E.prototype._downgrade = etask._fn(function*mgr__downgrade(_this, cb){
    yield _this.loki.save();
    _this.emit('downgrade', cb);
});

E.prototype.downgrade_api = etask._fn(
function*mgr_downgrade(_this, req, res, next){
    this.on('uncaught', next);
    yield _this._downgrade(e=>e ? res.status(403).send(e)
        : res.json({result: 'ok'}));
});

E.prototype.restart_when_idle = function(){
    logger.notice('Manager will be restarted when idle');
    this.timeouts.set_interval(()=>{
        const upgrade_idle_since = date.add(date(),
            {ms: -consts.UPGRADE_IDLE_PERIOD});
        if (Object.values(this.proxy_ports)
            .every(p=>p.is_idle_since(upgrade_idle_since)))
        {
            logger.notice('There is a new Proxy Manager version available! '
                +'Restarting...');
            this.restart({is_upgraded: 1});
        }
    }, consts.UPGRADE_CHECK_INTERVAL);
};

E.prototype.api_request = etask._fn(function*mgr_api_request(_this, opt){
    if (!_this.logged_in && !opt.force)
    {
        logger.notice('Skipping API call before auth: %s', opt.endpoint);
        return;
    }
    const headers = {'user-agent': util_lib.user_agent};
    const {customer, google_token, lpm_token} = _this._defaults;
    const _url = 'https://'+_this._defaults.api_domain+opt.endpoint;
    const method = opt.method||'GET';
    logger.debug('API: %s %s %s', method, _url, JSON.stringify(opt.qs||{}));
    const res = yield etask.nfn_apply(request, [{
        method,
        url: _url,
        qs: Object.assign(opt.qs||{}, {
            customer,
            token: google_token,
            lpm_token,
        }),
        json: opt.json===false ? false : true,
        headers,
        form: opt.form,
        timeout: opt.timeout||20*date.ms.SEC,
    }]);
    if (res.statusCode==502)
        throw new Error('Server unavailable');
    if (!/2../.test(res.statusCode) && !opt.no_throw)
    {
        let msg = `API call to ${_url} FAILED with status `+res.statusCode;
        if (res.body && res.statusCode!=404)
            msg += ' '+(res.body.slice && res.body.slice(0, 40) || '');
        throw new Error(msg);
    }
    return res;
});

E.prototype.ext_proxy_created = etask._fn(
function*ext_proxy_created(_this, proxy){
    this.on('uncaught', e=>{
        logger.error('ext_proxy_created: '+e.message);
        this.return();
    });
    yield _this.api_request({
        endpoint: '/lpm/ext_proxy_created',
        method: 'POST',
        form: {proxy},
    });
});

E.prototype.stats_get_api = function(req, res){
    const stats = this.loki.stats_get();
    const enable = !!Object.values(this.proxy_ports)
        .filter(p=>!p.opt.ssl && p.opt.port!=this._defaults.dropin_port)
        .length;
    let _https;
    if ((_https = stats.protocol.find(p=>p.key=='https')) && _https.reqs>0)
        stats.ssl_warning = enable;
    stats.ssl_enable = enable;
    const stats_ports = this.loki.stats_group_by('port', 0);
    const ports = stats_ports.reduce((acc, el)=>
        Object.assign({}, acc, {[el.key]: el}), {});
    res.json(Object.assign({ports}, stats));
};

E.prototype.lpm_stats_api = function(req, res){
    const days = req.query.days||5;
    const query = {hostname: {$ne: 'lumtest.com'}};
    const reqs = this.loki.requests_count(query);
    const recent_reqs = this.loki.requests_count(Object.assign({},
        query, {timestamp: {$gt: +date.add(date(), {day: -days})}}));
    res.json({total_requests: reqs, recent_requests: recent_reqs});
};

E.prototype.add_www_whitelist_ip_api = etask._fn(
function*add_www_whitelist_ip_api(_this, req, res, next){
    this.on('uncaught', next);
    let ip;
    if (!(ip=req.body.ip))
        return res.status(400).send('You need to pass an IP to add\n');
    try { ip = new Netmask(ip).base; }
    catch(e){ return res.status(422).send('Wrong format\n'); }
    const new_ips = [...new Set(_this._defaults.www_whitelist_ips).add(ip)];
    _this.set_www_whitelist_ips(new_ips);
    _this.add_config_change('add_www_whitelist_ip', 'defaults', ip);
    yield _this.config.save();
    _this.wss.broadcast_json({msg: 'whitelisted', ip});
    res.send('OK');
});

E.prototype.cloud_unauth_api = function(req, res){
    const expires = (new Date(date.ms.DAY+Date.now())).toUTCString();
    const set_cookie = `lpm_token=deleted; Max-Age=43200; Path=/; `
        +`Expires=${expires}; Secure; SameSite=None`;
    res.header('Set-Cookie', set_cookie);
    res.send('OK');
};

E.prototype.cloud_auth_api = function(req, res){
    const lpm_token = (this._defaults.lpm_token||'').split('|')[0];
    if (!lpm_token || lpm_token!=req.body.lpm_token)
        return res.status(403).send('Forbidden');
    // generating the cookie manually as express 4.16 does not support
    // sameSite in cookies generation and util/node_modules uses 4.16
    const expires = (new Date(date.ms.DAY+Date.now())).toUTCString();
    const set_cookie = `lpm_token=${lpm_token}; Max-Age=43200; Path=/; `
        +`Expires=${expires}; Secure; SameSite=None`;
    res.header('Set-Cookie', set_cookie);
    if (!(this._defaults.whitelist_ips||[]).length)
    {
        const new_ips = [...new Set(this._defaults.whitelist_ips).add(req.ip)];
        this.set_whitelist_ips(new_ips);
    }
    res.send('OK');
};

E.prototype.add_wip_api = etask._fn(
function*add_wip_api(_this, req, res, next){
    this.on('uncaught', next);
    const token_auth = _this._defaults.token_auth;
    if (!token_auth || token_auth!=req.headers.authorization)
        return res.status(403).send('Forbidden');
    let ip;
    if (!(ip=req.body.ip))
        return res.status(400).send('You need to pass an IP to add\n');
    try {
        const _ip = new Netmask(ip);
        const mask = _ip.bitmask==32 ? '' : '/'+_ip.bitmask;
        ip = _ip.base+mask;
    } catch(e){ return res.status(422).send('Wrong format\n'); }
    if (_this.argv.zagent && util_lib.is_any_ip(ip))
    {
        return res.status(400).send('Not allowed to set any whitelisted IP in '
            +'Cloud Proxy Manager');
    }
    const new_ips = [...new Set(_this._defaults.whitelist_ips).add(ip)];
    _this.set_whitelist_ips(new_ips);
    _this.add_config_change('add_whitelist_ip', 'defaults', ip);
    yield _this.config.save();
    res.send('OK');
});

E.prototype.user_auth = function(query){
    const {user, password} = query;
    return user && password && this.lpm_users.some(u=>
        user==u.email && password==u.password);
};

E.prototype.whitelist_auth = function(ip){
    const whitelist_blocks = [...new Set([
        ...this._defaults.www_whitelist_ips||[],
        ...this.mgr_opts.www_whitelist_ips||[],
        '127.0.0.1',
    ])].map(wl=>{
        try {
            return new Netmask(wl);
        } catch(e){}
    }).filter(Boolean);
    const empty = !this._defaults || !this._defaults.password &&
        !this.proxies.map(p=>p.password).filter(Boolean).length;
    const can_skip = empty && !this.argv.zagent;
    return can_skip || whitelist_blocks.some(wb=>{
        try {
            return wb.contains(ip);
        } catch(e){ return false; }
    });
};

E.prototype.authenticate = function(req, res, next){
    // XXX krzysztof user_auth should have an access only to proxies_running
    // and stats
    const bypass = ['/version', '/add_wip', '/cloud_auth',
        '/lpm_stats', '/i18n'].includes(req.url);
    const cookies = cookie.parse(req.headers.cookie||'');
    const lpm_token = (this._defaults.lpm_token||'').split('|')[0];
    const is_cloud_auth = lpm_token && cookies.lpm_token==lpm_token;
    if (!this.whitelist_auth(req.ip) && !bypass && !is_cloud_auth &&
        !this.user_auth(req.query))
    {
        res.status(403);
        if (req.query.user && req.query.password)
            return void res.send('Auth Failed');
        res.set('x-lpm-block-ip', req.ip);
        this.pending_www_ips.add(req.ip);
        logger.warn('Access denied for %s %s', req.ip, req.url);
        return void res.send(`Connection from your IP is forbidden. If you`
            +` want to access this site ask the administrator to add`
            +` ${req.ip} to the whitelist. for more info visit`
            +` ${this._defaults.www_api}/faq#lpm_whitelist_admin`);
    }
    const reseller_user_api = ['/bw_limit_stats/', '/refresh_sessions/',
        '/generate_proxies/'];
    if (this.argv.zagent && this.is_reseller() && this.user_auth(req.query) &&
        !reseller_user_api.some(x=>req.url.startsWith(x)))
    {
        res.status(403);
        return void res.send('Auth Failed');
    }
    const passwd = Array.isArray(this._defaults.password) ?
        this._defaults.password[0] : this._defaults.password;
    const is_local_authenticated = this.user_auth(req.query) ||
        !this.argv.local_login || passwd && cookies['local-login']==passwd;
    if (!is_local_authenticated && !['/version', '/creds_user', '/defaults',
        '/node_version', '/last_version', '/conn', '/all_locations',
        '/last_version', '/lpm_stats'].includes(req.url))
    {
        res.status(403);
        res.set('x-lpm-local-login', 'Unauthorized');
        return void res.send('This Proxy Manager instance is running in '
            +'local_login mode. You need to sign in to get an access to this '
            +'resource');
    }
    next();
};

E.prototype.limit_zagent = function(req, res, next){
    if (this.argv.zagent)
        return res.status(403).send('This action is not allowed in Cloud');
    next();
};

E.prototype.version_api = function(req, res){
    return res.json({
        version: pkg.version,
        argv: this.get_params().join(' '),
        is_upgraded: this.is_upgraded,
        backup_exist: this.backup_exist,
    });
};

E.prototype.get_bw_limit_api = function(req, res){
    logger.info('get_bw_limit_api');
    if (!this.argv.zagent)
    {
        return res.status(403).send('Not allowed to use BW limit in '
            +'Proxy Manager on premise');
    }
    const proxy_port = this.proxy_ports[+req.params.port];
    const port = zutil.get(proxy_port, 'opt.master_port', +req.params.port);
    const proxy = this.proxies.find(p=>p.port==port);
    if (!proxy)
        return res.status(400).send('Invalid port number');
    if (req.query.pretty!==undefined && proxy.bw_limit)
    {
        const {bytes, days, start, renewable} = proxy.bw_limit;
        const limit = convert_bytes(bytes);
        return res.send(format_json({limit, days, start, renewable}));
    }
    res.json(zutil.pick(proxy.bw_limit,
        'bytes', 'days', 'start', 'renewable'));
};

E.prototype.set_bw_limit_api = etask._fn(
function*set_bw_limit_api(_this, req, res, next){
    this.on('uncaught', next);
    logger.info('set_bw_limit_api');
    if (!_this.argv.zagent)
    {
        return res.status(403).send('Not allowed to use BW limit in '
            +'Proxy Manager on premise');
    }
    const old_proxy_port = _this.proxy_ports[+req.params.port];
    const port = zutil.get(old_proxy_port, 'opt.master_port',
        +req.params.port);
    const proxy = _this.proxies.find(p=>p.port==port);
    if (!proxy)
        return res.status(400).send('Invalid port number');
    if (proxy.proxy_type!='persist')
        return res.status(400).send('Proxy is read-only');
    const bw_limit = Object.keys(req.body).length && req.body || false;
    if (bw_limit)
    {
        bw_limit.renewable = bw_limit.renewable===undefined
            ? true : !!bw_limit.renewable;
    }
    const err = yield _this.proxy_check(Object.assign({}, proxy, {bw_limit}),
        port);
    if (err.length)
        return res.status(400).send(err[0].msg);
    let {proxy_port, proxy_err} = yield _this.proxy_update(proxy, {bw_limit});
    if (proxy_err)
        return res.status(400).send(proxy_err);
    if (req.query.pretty!==undefined && proxy_port.bw_limit)
    {
        const {days, bytes, renewable, start} = proxy_port.bw_limit;
        const limit = convert_bytes(bytes);
        return res.send(format_json({limit, days, renewable, start}));
    }
    res.json(proxy_port.bw_limit||{});
});

E.prototype.get_bw_limit_stats_api = etask._fn(
function*get_bw_limit_stats_api(_this, req, res, next){
    this.on('uncaught', next);
    logger.info('get_bw_limit_stats_api');
    if (!_this.argv.zagent)
    {
        return res.status(403).send('Not allowed to use BW limit in '
            +'Proxy Manager on premise');
    }
    const port = req.params.port;
    const proxy_port = port && _this.proxy_ports[+port];
    if (port && !proxy_port || req.query.user && (!proxy_port ||
        proxy_port.opt.user!=req.query.user))
    {
        return res.status(400).send('Invalid port number');
    }
    const response = yield _this.api_request({endpoint: '/lpm/bw_limit_stats',
        qs: {port: +port||undefined}});
    if (response.statusCode!=200)
        return res.status(response.statusCode).send(response.body);
    if (req.query.pretty!==undefined)
    {
        for (const key_port of Object.keys(response.body))
        {
            if (response.body[key_port].usage)
            {
                response.body[key_port].usage.limit = convert_bytes(
                    response.body[key_port].usage.limit);
                response.body[key_port].usage.used = convert_bytes(
                    response.body[key_port].usage.used);
            }
        }
        return res.send(format_json(response.body));
    }
    res.json(response.body);
});

E.prototype.get_reverse_proxy_ips_api = function(req, res){
    logger.info('get_reverse_proxy_ips_api');
    res.json(this._defaults.reverse_proxy_ips||[]);
};

E.prototype.add_reverse_proxy_ip_api = etask._fn(
function*add_reverse_proxy_ip_api(_this, req, res, next){
    this.on('uncaught', next);
    logger.info('add_reverse_proxy_ip_api');
    let ip;
    if (!(ip=req.body.ip))
        return res.status(400).send('You need to pass an IP to add\n');
    try {
        const _ip = new Netmask(ip);
        const mask = _ip.bitmask==32 ? '' : '/'+_ip.bitmask;
        ip = _ip.base+mask;
    } catch(e){ return res.status(422).send('Wrong format\n'); }
    if (util_lib.is_any_ip(ip))
        return res.status(422).send('Not allowed to add 0.0.0.0/0\n');
    const ips = _this._defaults.reverse_proxy_ips||[];
    const new_ips = [...new Set(ips).add(ip)];
    if (ips.length!=new_ips.length)
    {
        _this._defaults.reverse_proxy_ips = new_ips;
        _this.add_config_change('add_reverse_proxy_ip', 'defaults', ip);
        yield _this.config.save();
        _this.update_ports({reverse_proxy_ips: new_ips});
    }
    res.send('OK');
});

E.prototype.delete_reverse_proxy_ip_api = etask._fn(
function*delete_reverse_proxy_ip_api(_this, req, res, next){
    this.on('uncaught', next);
    logger.info('delete_reverse_proxy_ip_api');
    let ip;
    if (!(ip=req.body.ip))
        return res.status(400).send('You need to pass an IP to add\n');
    try { ip = new Netmask(ip).base; }
    catch(e){ return res.status(422).send('Wrong format\n'); }
    const ips = _this._defaults.reverse_proxy_ips||[];
    const new_ips = ips.filter(x=>x!=ip);
    if (ips.length!=new_ips.length)
    {
        _this._defaults.reverse_proxy_ips = new_ips;
        _this.add_config_change('add_reverse_proxy_ip', 'defaults', ip);
        yield _this.config.save();
        _this.update_ports({reverse_proxy_ips: new_ips});
    }
    res.send('OK');
});

E.prototype.get_lang_resources = etask._fn(
function*get_lang_resources(_this, req, res, next){
    this.on('uncaught', next);
    logger.info('get_language_resources_api');
    res.json(yield _this.lang_cache.get());
});

let proxies_counter = Math.floor(Math.random()*1e6);
E.prototype.generate_proxies_api = function(req, res){
    const port = req.params.port;
    const proxy_port = port && this.proxy_ports[+port];
    if (port && !proxy_port || req.query.user && (!proxy_port ||
        proxy_port.opt.user!=req.query.user))
    {
        return res.status(400).send('Invalid port number');
    }
    const domain = this._defaults.pmgr_domain||this.get_cloud_url_address();
    let proxy = `${domain}:${port}`;
    let usr = proxy_port.opt.user;
    if (!usr)
        return res.status(400).send('No user assigned to port');
    let pass = proxy_port.opt.user_password;
    let {country, city, asn, sessions} = req.query;
    if (country)
        usr += `-country-${country.toLowerCase()}`;
    if (city)
        usr += `-city-${city.toLowerCase()}`;
    if (+asn)
        usr += `-asn-${asn}`;
    if (!sessions)
    {
        return res.json([`${proxy}:${Buffer.from(usr, 'utf8')
            .toString('hex')}:${pass}`]);
    }
    let arr = [];
    for (let i = 0; i<+sessions; i++)
    {
        let s = (++proxies_counter%1e9).toString(16);
        arr.push(`${proxy}:${Buffer.from(usr+'-session-'+s, 'utf8')
            .toString('hex')}:${pass}`);
    }
    res.json(arr);
};

E.prototype.pmgr_domain_update_api = etask._fn(
function*pmgr_domain_update_api(_this, req, res, next){
    this.on('uncaught', next);
    logger.info('pmgr_domain_update_api');
    if (!req.body.domain)
        return res.status(400).send('You need to pass a domain name\n');
    if (!zurl.is_valid_domain(req.body.domain))
        return res.status(422).send('Invalid domain\n');
    _this._defaults.pmgr_domain = req.body.domain;
    _this.add_config_change('pmgr_domain_update_api', 'defaults',
        req.body.domain);
    yield _this.config.save();
    res.send('OK');
});

E.prototype.api_error_handler = function(err, req, res, next){
    this.perr('crash_api', {error: zerr.e2s(err)});
    logger.error('API error: %s %s %s', req.method, req.originalUrl,
        zerr.e2s(err));
    res.status(500).send('Server error: '+err.message);
};

E.prototype.create_api = function(){
    const app = express();
    app.use(this.authenticate.bind(this));
    const limit_zagent = this.limit_zagent.bind(this);
    app.use(logger.get_api_mw(this.argv.www));
    app.get('/consts', this.get_consts_api.bind(this));
    app.get('/defaults', (req, res)=>res.json(this.opts));
    app.get('/version', this.version_api.bind(this));
    app.get('/last_version', this.last_version_api.bind(this));
    app.get('/node_version', this.node_version_api.bind(this));
    app.get('/mode', (req, res)=>res.json({logged_in: this.logged_in}));
    app.get('/conn', (req, res)=>res.json(this.conn));
    app.put('/api_url', this.api_url_update_api.bind(this));
    app.put('/pmgr_domain', this.pmgr_domain_update_api.bind(this));
    app.get('/proxies_running', this.proxies_running_get_api.bind(this));
    app.get('/proxies/:port?', this.proxies_get_api.bind(this));
    app.post('/proxies', this.proxy_create_api.bind(this));
    app.post('/proxies/delete', this.proxies_delete_api.bind(this));
    app.put('/proxies/:port', this.proxy_update_api.bind(this));
    app.delete('/proxies/:port', this.proxy_delete_api.bind(this));
    app.post('/proxy_dup', this.proxy_dup_api.bind(this));
    app.post('/proxies/:port/banip', this.proxy_banip_api.bind(this));
    app.post('/proxies/:port/banips', this.proxy_banips_api.bind(this));
    app.post('/proxies/:port/unbanip', this.proxy_unbanip_api.bind(this));
    app.post('/proxies/:port/unbanips', this.proxy_unbanips_api.bind(this));
    app.get('/generate_proxies/:port', this.generate_proxies_api.bind(this));
    app.get('/banlist/:port', this.get_banlist_api.bind(this));
    app.post('/banip', this.global_banip_api.bind(this));
    app.get('/sessions/:port', this.get_sessions_api.bind(this));
    app.post('/refresh_sessions/:port', this.refresh_sessions_api.bind(this));
    app.get('/refresh_sessions/:port', this.refresh_sessions_api.bind(this));
    app.get('/proxy_status/:port', this.proxy_status_get_api.bind(this));
    app.get('/browser/:port', this.open_browser_api.bind(this));
    app.get('/logs', this.logs_get_api.bind(this));
    app.get('/logs_cloud', this.logs_cloud_get_api.bind(this));
    app.get('/logs_har', this.logs_har_get_api.bind(this));
    app.post('/logs_resend', this.logs_resend_api.bind(this));
    app.get('/logs_suggestions', this.logs_suggestions_api.bind(this));
    app.get('/logs_reset', this.logs_reset_api.bind(this));
    app.get('/settings', this.get_settings_api.bind(this));
    app.put('/settings', this.update_settings_api.bind(this));
    app.get('/tls_warning', (req, res)=>res.json(this.tls_warning));
    app.post('/creds_user', limit_zagent, this.creds_user_api.bind(this));
    app.post('/verify_two_step', limit_zagent,
        this.verify_two_token_api.bind(this));
    app.get('/gen_token', this.gen_token_api.bind(this));
    app.get('/config', this.config_get_api.bind(this));
    app.post('/config', limit_zagent, this.config_set_api.bind(this));
    app.get('/allocated_ips', this.allocated_ips_get_api.bind(this));
    app.get('/allocated_vips', this.allocated_vips_get_api.bind(this));
    app.get('/lpm_users', this.lpm_users_get_api.bind(this));
    app.post('/lpm_user', this.lpm_user_add_api.bind(this));
    app.post('/refresh_ips', this.refresh_ips_api.bind(this));
    app.post('/shutdown', limit_zagent, this.shutdown_api.bind(this));
    app.post('/logout', limit_zagent, this.logout_api.bind(this));
    app.post('/upgrade', limit_zagent, this.upgrade_api.bind(this));
    app.post('/downgrade', limit_zagent, this.downgrade_api.bind(this));
    app.post('/restart', limit_zagent, this.restart_api.bind(this));
    app.get('/all_locations', this.get_all_locations_api.bind(this));
    app.get('/all_carriers', this.get_all_carriers_api.bind(this));
    app.post('/test/:port', this.proxy_tester_api.bind(this));
    app.get('/recent_stats', this.stats_get_api.bind(this));
    app.post('/report_bug', this.report_bug_api.bind(this));
    app.post('/enable_ssl', this.enable_ssl_api.bind(this));
    app.post('/update_ips', this.update_ips_api.bind(this));
    app.get('/zones', this.get_zones_api.bind(this));
    app.post('/add_whitelist_ip', this.add_www_whitelist_ip_api.bind(this));
    app.post('/add_wip', this.add_wip_api.bind(this));
    app.post('/perr', this.perr_api.bind(this));
    app.post('/emit_ws', this.emit_ws_api.bind(this));
    app.get('/kill_workers', this.kill_workers_api.bind(this));
    app.get('/run_workers', this.run_workers_api.bind(this));
    app.get('/gen_cert', this.gen_cert_api.bind(this));
    app.get('/general_logs', this.get_general_logs_api.bind(this));
    app.post('/log_level', this.set_log_level_api.bind(this));
    app.post('/cloud_auth', this.cloud_auth_api.bind(this));
    app.post('/cloud_unauth', this.cloud_unauth_api.bind(this));
    app.get('/lpm_stats', this.lpm_stats_api.bind(this));
    app.get('/server_conf', (req, res)=>res.json(this.server_conf));
    app.get('/bw_limit/:port', this.get_bw_limit_api.bind(this));
    app.put('/bw_limit/:port', this.set_bw_limit_api.bind(this));
    app.get('/bw_limit_stats/:port?', this.get_bw_limit_stats_api.bind(this));
    app.get('/reverse_proxy_ips', this.get_reverse_proxy_ips_api.bind(this));
    app.post('/reverse_proxy_ip', this.add_reverse_proxy_ip_api.bind(this));
    app.delete('/reverse_proxy_ip',
        this.delete_reverse_proxy_ip_api.bind(this));
    app.get('/i18n', this.get_lang_resources.bind(this));
    app.use(this.api_error_handler.bind(this));
    return app;
};

E.prototype.create_web_interface = etask._fn(function*(_this){
    const app = express();
    const main_page = (req, res, next)=>{
        res.header('Cache-Control',
            'private, no-cache, no-store, must-revalidate');
        res.header('Expires', '-1');
        res.header('Pragma', 'no-cache');
        res.sendFile(path.join(__dirname+'/../bin/pub/index.html'));
    };
    app.use(compression());
    app.use(body_parser.urlencoded({extended: true,
        limit: _this.argv.api_body_limit}));
    app.use(body_parser.json({limit: _this.argv.api_body_limit}));
    app.use('/api', _this.create_api());
    app.get('/ssl', (req, res)=>{
        res.set('content-type', 'application/x-x509-ca-cert');
        res.set('content-disposition', 'filename=luminati.crt');
        res.send(ssl.ca.cert);
    });
    app.get('/', main_page);
    app.use(express.static(path.resolve(__dirname, '../bin/pub')));
    app.get('*', main_page);
    app.use(function(err, req, res, next){
        logger.error(zerr.e2s(err));
        res.status(500).send('Server Error');
    });
    const server = _this.create_api_server(app);
    http_shutdown(server);
    server.on('error', err=>_this.error_handler('WWW', err));
    server.stop = force=>etask(function*mgr_server_stop(){
        server.running = false;
        const stop_method = force ? '.forceShutdown' : '.shutdown';
        return yield etask.nfn_apply(server, stop_method, []);
    });
    yield etask.cb_apply(server, '.listen', [_this.argv.www,
        util_lib.find_iface(_this.argv.iface)||'0.0.0.0']);
    const port = server.address().port;
    let address = server.address().address;
    if (address=='0.0.0.0')
        address = '127.0.0.1';
    server.url = `http://${address}:${port}`;
    return server;
});

E.prototype.create_api_server = function(app){
    let http_server;
    let https_server;
    if (process.env.SSL_CERT && process.env.SSL_KEY)
    {
        try {
            const https_opts = {
                cert: file.read_e(process.env.SSL_CERT),
                key: file.read_e(process.env.SSL_KEY),
            };
            if (process.env.SNI_CERTS)
            {
                const certs = cookie.parse(process.env.SNI_CERTS);
                https_opts.SNICallback = util_lib.sni_callback_fn(certs);
            }
            logger.notice('Using SSL to the web interface');
            https_server = https.createServer(https_opts, app);
            this.start_web_socket(https_server);
        } catch(e){
            logger.warn('Could not find SSL certificates: %s', e.message);
        }
    }
    if (!https_server)
    {
        http_server = http.createServer(app);
        this.start_web_socket(http_server);
        return http_server;
    }
    http_server = http.createServer((req, res)=>{
        let location = 'https://'+req.headers.host+req.url;
        res.writeHead(301, {location});
        res.end();
    });
    const tcp_server = net.createServer(socket=>{
        tcp_server.running = true;
        socket.setTimeout(this.argv.socket_inactivity_timeout);
        socket.once('error', err=>null);
        socket.once('timeout', ()=>this.ensure_socket_close(socket));
        socket.once('data', data=>{
            if (!tcp_server.running)
                return socket.end();
            socket.pause();
            let protocol_byte = data[0];
            if (protocol_byte==22)
                https_server.emit('connection', socket);
            else
                http_server.emit('connection', socket);
            socket.unshift(data);
            socket.resume();
        });
    });
    return tcp_server;
};

E.prototype.init_proxies = etask._fn(function*mgr_init_proxies(_this){
    logger.notice('Running proxy configurations...');
    const proxies = _this.proxies.map(c=>_this.init_proxy(c));
    try {
        const proxy_ports = yield etask.all(proxies);
        const failed_ports = proxy_ports.filter(p=>p.proxy_err);
        for (const {proxy_port, proxy_err: err} of failed_ports)
        {
            const {port} = proxy_port;
            logger.error(`Failed initializing proxy port ${port}: ${err}`);
            const idx = _this.proxies.findIndex(p=>
                zutil.equal_deep(p, proxy_port));
            _this.proxies.splice(idx, 1);
            logger.error(`Removed uninitialized proxy port ${port}`);
        }
    } catch(e){
        logger.error('Failed to initialize proxy ports: %s', e.message);
    }
});

E.prototype.skip_config_sync = function(){
    return !this.argv.zagent && !this._defaults.sync_config;
};

E.prototype.apply_cloud_config =
etask._fn(function*mgr_apply_cloud_config(_this, config, opt){
    if (_this.skip_config_sync() || !_this.argv.config)
        return;
    opt=opt||{};
    if (!config || !Object.keys(config).length)
        return yield _this.config.save();
    if (opt.ca)
        yield ssl.apply_cloud_ca(opt.ca);
    const is_old_config = !config.ts ||
        _this.config_ts && date(config.ts)<date(_this.config_ts);
    if (!opt.force && is_old_config)
        return;
    if (_this.applying_cloud_config)
        return _this.pending_cloud_config = {config, opt};
    _this.applying_cloud_config = 1;
    this.finally(()=>{
        _this.applying_cloud_config = 0;
        if (!_this.pending_cloud_config)
            return;
        const {config: new_config, opt: new_opt} = _this.pending_cloud_config;
        delete _this.pending_cloud_config;
        return _this.apply_cloud_config(new_config, new_opt);
    });
    _this.config.save_local_backup();
    _this.cluster_mgr.kill_workers();
    yield etask.sleep(1);
    if (!opt.no_proxy_delete)
    {
        yield _this.proxy_delete_wrapper(_this.proxies.map(p=>p.port),
        {skip_config_save: 1, no_loki_clear: 1});
    }
    _this.config = new Config(_this, E.default, {
        filename: _this.argv.config,
        cloud_config: config,
    });
    const conf = _this.config.get_proxy_configs();
    const old_defaults = _this._defaults;
    _this._defaults = conf._defaults;
    _this.proxies = conf.proxies;
    _this.config_ts = conf.ts;
    _this.config.save({skip_cloud_update: 1});
    _this.set_logger_level(_this._defaults.log, true);
    const should_login = zutil.get(config, '_defaults.customer') &&
        zutil.get(config, '_defaults.lpm_token');
    if (should_login)
    {
        yield _this.lpm_f.login();
        yield _this.logged_update();
    }
    _this.update_lpm_users(yield _this.lpm_users_get());
    if (old_defaults.ui_ws!=_this._defaults.ui_ws)
    {
        yield _this.www_server.stop();
        _this.wss.close();
        _this.wss = empty_wss;
        yield _this.init_web_interface();
    }
    if (_this.argv.zagent)
    {
        if (_this._defaults.www_whitelist_ips)
        {
            _this._defaults.www_whitelist_ips =
                _this._defaults.www_whitelist_ips.filter(ip=>
                    !util_lib.is_any_ip(ip));
        }
        if (_this._defaults.whitelist_ips)
        {
            _this._defaults.whitelist_ips = _this._defaults.whitelist_ips
                .filter(ip=>!util_lib.is_any_ip(ip));
        }
        if (_this._defaults.reverse_proxy_ips)
        {
            _this._defaults.reverse_proxy_ips = _this._defaults
                .reverse_proxy_ips.filter(ip=>!util_lib.is_any_ip(ip));
        }
    }
    _this.check_any_whitelisted_ips();
    yield _this.init_proxies();
    _this.cluster_mgr.run_workers();
});

E.prototype.apply_zones_config = function(zones){
    if (!this.argv.sync_zones)
        return;
    logger.notice('zones update');
    this.zones_mgr.set_from_conf(zones);
    this.zones_mgr.validate_default_zone();
    this.update_proxies();
    this.wss.broadcast_json({
        msg: 'update_path',
        payload: this.zones_mgr.get_formatted(),
        path: 'zones',
    });
};

E.prototype.apply_bw_limits =
etask._fn(function*mgr_apply_bw_limits(_this, limits){
    logger.notice('apply bw limits');
    if (!Array.isArray(limits))
        return;
    let update_conf = false;
    for (let limit of limits)
    {
        const {port, expires, ts} = limit||{};
        const proxy = _this.proxies.find(p=>p.port==port);
        if (!proxy)
            continue;
        update_conf = true;
        const bw_limit = Object.assign({}, proxy.bw_limit, {expires, ts});
        if (!expires)
            delete bw_limit.expires;
        proxy.bw_limit = bw_limit;
        const multiply = proxy.multiply||1;
        for (let i = 0; i<multiply; i++)
        {
            const proxy_port = _this.proxy_ports[port+i];
            if (!proxy_port)
                continue;
            logger.notice('Port %s set bw limit expires to %s', port+i,
                expires||'null');
            proxy_port.update_bw_limit({bw_limit});
        }
    }
    if (update_conf)
        yield _this.config.save({skip_cloud_update: 1, skip_broadcast: 1});
});

E.prototype.remove_preserved_fields = function(conf){
    if (!conf || !conf._defaults)
        return;
    for (let field of E.fields_to_preserve)
    {
        if (this._defaults[field])
            delete conf._defaults[field];
    }
};

E.prototype.logged_update = etask._fn(function*mgr_logged_update(_this){
    if (_this._defaults.lpm_token)
    {
        const cust = _this._defaults.lpm_token.split('|')[1];
        if (cust)
            _this._defaults.customer = cust;
    }
    if (!_this._defaults.customer)
    {
        _this.zones_mgr.reset();
        _this.logged_in = false;
        _this.update_proxies();
        return false;
    }
    try {
        const conf = yield _this.lpm_f.get_meta_conf();
        if (_this.skip_config_sync())
            _this.remove_preserved_fields(conf);
        Object.assign(_this._defaults, conf._defaults);
        _this.zones_mgr.set_from_conf(zutil.get(conf, '_defaults.zones'));
        _this.zones_mgr.validate_default_zone();
        _this.logged_in = true;
        _this.update_proxies();
    } catch(e){
        if (e.message=='no_lpm_f_conn')
            return;
        logger.notice('Proxy Manager is not logged in: %s', e.message);
        _this.logged_in = false;
    }
    return _this.logged_in;
});

E.prototype.has_created_proxy_port = function(){
    return Object.values(this.proxy_ports).some(p=>
        p.opt.proxy_type=='persist');
};

E.prototype.verify_two_token_api = etask._fn(
function*verify_two_token_api(_this, req, res){
    try {
        const response = yield _this.api_request({
            method: 'POST',
            endpoint: '/lpm/verify_two_step',
            form: {token: req.body.token},
            force: true,
        });
        if ([200, 204].includes(response.statusCode))
            return res.sendStatus(200);
        logger.warn('2-Step Verification failed: %s %s', res.statusCode,
            res.body);
        res.status(response.statusCode).send(response.body);
    } catch(e){
        logger.warn('2-Step Verification failed: %s', e.message);
        res.status(403).send(e.message);
    }
});

E.prototype.login_user = etask._fn(
function*mgr_login_user(_this, username, password, two_step_token){
    if (two_step_token && !username && !password)
    {
        username = _this.last_username;
        password = _this.last_password;
    }
    else if (username && password)
    {
        _this.last_username = username;
        _this.last_password = password;
    }
    const response = yield _this.api_request({
        method: 'POST',
        endpoint: '/lpm/check_credentials',
        form: {
            username,
            password,
            os: util_lib.format_platform(os.platform()),
            country: _this.conn.current_country,
            two_step_token,
        },
        no_throw: true,
        force: true,
    });
    if (response.statusCode!=200)
    {
        const err = response.body && response.body.error || 'unknown';
        logger.warn('Authentication failed: %s %s', response.statusCode, err);
        const api_url = _this._defaults.www_api;
        if (['unauthorized', 'not_registered'].includes(err))
        {
            return {error: {
                message: `The email address or password is incorrect. `
                    +`If you signed up with Google signup button, you`
                    +` should login with Google login button.`
                    +` <a href="${api_url}/?hs_signup=1"`
                    +` target=_blank>`
                    +`Click here to sign up.</a>`,
            }};
        }
        if (err=='no_customer')
        {
            delete _this._defaults.customer;
            return {error: {
                message: 'The requested customer does not exist. Try again.',
            }};
        }
        return {error: {
            message: 'Something went wrong. Please contact support. '+err,
        }};
    }
    if (response.body.two_step_pending)
    {
        logger.notice('2-Step Verification required');
        return {body: {ask_two_step: true}};
    }
    return response.body;
});

E.prototype.set_current_country = etask._fn(function*mgr_set_location(_this){
    _this._defaults.www_domain = 'brightdata.com';
    try {
        const res = yield etask.nfn_apply(request, [{
            url: _this._defaults.test_url,
            json: true,
            timeout: 20*date.ms.SEC,
            headers: {'user-agent': util_lib.user_agent},
        }]);
        _this.conn.current_country = (res.body.country||'').toLowerCase();
        _this.conn.current_state = (res.body.geo||{}).region_name||'';
        _this.conn.current_city = (res.body.geo||{}).city||'';
        if (!_this.conn.current_country)
            _this._defaults.www_domain = _this._defaults.api_domain;
        if (_this.conn.current_country=='cn')
        {
            _this._defaults.www_domain = 'luminati-china.biz';
            E.default.proxy_connection_type = 'https';
            _this.opts.proxy_connection_type = 'https';
            _this._defaults.proxy_connection_type = 'https';
            _this.config.defaults.proxy_connection_type = 'https';
        }
    } catch(e){
        logger.error(e.message);
        logger.warn('Could not fetch your IP and adjust Proxy Manager');
    } finally {
        _this._defaults.www_api = _this._defaults.api ||
            'https://'+_this._defaults.www_domain;
    }
});

E.prototype.get_current_info = function(){
    let {current_country, current_state, current_city} = this.conn;
    return {
        country: current_country ? code2label(current_country) : null,
        state: current_state||null,
        city: current_city||null,
        customer: this._defaults.customer||null,
    };
};

E.prototype.check_domain = etask._fn(function*mgr_check_domain(_this){
    logger.notice('Checking the domain availability... %s',
        _this._defaults.api_domain);
    try {
        const res = yield _this.api_request({
            endpoint: '/lpm/server_conf',
            force: true,
            timeout: 10*date.ms.SEC,
        });
        return res.statusCode==200;
    } catch(e){
        logger.error('Could not access %s: %s', _this._defaults.api_domain,
            e.message);
        return yield _this.recheck_domain();
    }
});

E.prototype.remove_tmp_ca = etask._fn(function*_remove_tmp_ca(_this){
    if (ssl.remove_tmp_ca())
        yield ssl.load_ca(_this);
});

E.prototype.recheck_domain = etask._fn(function*recheck_domain(_this){
    _this._defaults.api_domain = pkg.api_domain_fallback;
    logger.notice('Checking the domain availability... %s',
        _this._defaults.api_domain);
    try {
        const _res = yield _this.api_request({
            endpoint: '/lpm/server_conf',
            force: true,
            timeout: 10*date.ms.SEC,
        });
        return _res.statusCode==200;
    } catch(e){
        logger.error('Could not access %s: %s', _this._defaults.api_domain,
            e.message);
        if (_this.conn.current_country == 'cn')
            return yield _this.recheck_domain_cn();
        return false;
    }
});

E.prototype.recheck_domain_cn = etask._fn(function*recheck_domain(_this){
    _this._defaults.api_domain = pkg.api_domain_fallback_cn;
    logger.notice('Checking the domain availability... %s',
        _this._defaults.api_domain);
    try {
        const _res = yield _this.api_request({
            endpoint: '/lpm/server_conf',
            force: true,
            timeout: 10*date.ms.SEC,
        });
        return _res.statusCode==200;
    } catch(e){
        logger.error('Could not access %s: %s', _this._defaults.api_domain,
            e.message);
        return false;
    }
});

E.prototype.kill_workers_api = function(req, res){
    this.cluster_mgr.kill_workers();
    res.status(200).send('ok');
};

E.prototype.run_workers_api = function(req, res){
    this.cluster_mgr.run_workers();
    res.status(200).send('ok');
};

E.prototype.run_resolving_proxies = etask._fn(
function*run_resolving_proxies(_this){
    _this.long_running_ets.push(this);
    while (1)
    {
        let rp_interval = _this.server_conf.resolve_proxies_interval ||
            _this.config.defaults.resolve_proxies_interval;
        yield etask.sleep(rp_interval);
        yield _this.resolve_proxies();
        _this.proxies.forEach(p=>{
            const proxy_port = _this.proxy_ports[p.port];
            if (proxy_port)
                proxy_port.update_hosts(_this.hosts, _this.cn_hosts);
        });
    }
});

E.prototype.resolve_proxies = etask._fn(function*resolve_proxies(_this){
    const superproxy_domains = [
        'zproxy.lum-superproxy.io',
        'zproxy.luminati.io',
        'zproxy.'+_this._defaults.api_domain,
    ];
    const is_superproxy_domain = d=>superproxy_domains.includes(d);
    if (!is_superproxy_domain(_this.opts.proxy))
        _this.hosts = [_this.opts.proxy];
    else
        _this.hosts = yield _this.lpm_f.resolve_proxies();
    if (!_this.hosts.length)
        _this.hosts = yield _this.dns_resolve_proxies();
    if (_this.conn.current_country=='cn' || _this.argv.cn)
        _this.cn_hosts = yield _this.lpm_f.resolve_proxies({cn: 1});
});

E.prototype.dns_resolve_proxies = etask._fn(
function*dns_resolve_proxies(_this){
    try {
        const ips = yield etask.nfn_apply(dns, '.resolve', [_this.opts.proxy]);
        logger.debug('Resolved %s proxies from dns', ips.length);
        return ips;
    } catch(e){
        logger.warn('Failed to resolve %s: %s', _this.opts.proxy, e.message);
        return [];
    }
});

E.prototype.start = etask._fn(function*mgr_start(_this){
    this.on('uncaught', e=>{
        logger.error('start %s', zerr.e2s(e));
        _this.perr('error', {error: zerr.e2s(e), ctx: 'start'});
    });
    try {
        perr.run();
        _this.set_logger_level(_this._defaults.log, true);
        yield check_running(_this.argv);
        yield _this.set_current_country();
        _this.conn.domain = yield _this.check_domain();
        yield _this.lpm_f.init();
        yield _this.lpm_f.get_server_conf();
        if (_this.argv.www && !_this.argv.high_perf)
            yield _this.loki.prepare();
        if (_this.argv.zagent)
        {
            _this.zagent_server = new Zagent_api(_this);
            yield _this.zagent_server.start();
            yield _this.zagent_server.register_online();
            if (_this.server_conf.client.lpm_conn)
            {
                _this.lpm_conn.init();
                _this.run_stats_reporting();
            }
        }
        yield _this.resolve_proxies();
        _this.run_resolving_proxies();
        const cloud_conf = yield _this.lpm_f.get_conf();
        yield _this.logged_update();
        yield ssl.load_ca(_this);
        _this.cluster_mgr.run();
        yield _this.init_proxies();
        if (cloud_conf)
            yield _this.apply_cloud_config(cloud_conf);
        _this.update_lpm_users(yield _this.lpm_users_get());
        yield cities.ensure_data(_this);
        yield _this.init_web_interface();
        if (lpm_config.is_win || is_darwin)
            return;
        if (!_this.argv.zagent)
            _this.run_cpu_usage_monitoring();
        _this.perr('start_success');
    } catch(e){
        etask.ef(e);
        if (e.message!='canceled')
        {
            logger.error('start error '+zerr.e2s(e));
            _this.perr('start_error', {error: e});
        }
        throw e;
    }
});

E.prototype.init_web_interface = etask._fn(function*(_this){
    if (!_this.argv.www)
        return logger.notice('Web interface will not be created');
    logger.notice('Creating web interface...');
    _this.www_server = yield _this.create_web_interface();
    print_ui_running(_this.www_server.url);
    _this.emit('www_ready', _this.www_server.url);
});

const print_ui_running = _url=>{
    const boxed_line = str=>{
        const repeat = 50;
        const box = '=';
        const wall = '|';
        if (!str)
            str = box.repeat(repeat-2);
        const ws = Math.max(0, (repeat-2-str.length)/2);
        const ws1 = ' '.repeat(Math.ceil(ws));
        const ws2 = ' '.repeat(Math.floor(ws));
        return `${wall}${ws1}${str}${ws2}${wall}`;
    };
    logger.notice([
        `Proxy Manager is running`,
        boxed_line(),
        boxed_line(' '),
        boxed_line(' '),
        boxed_line('Open admin browser:'),
        boxed_line(_url),
        boxed_line('ver. '+pkg.version),
        boxed_line(' '),
        boxed_line('Do not close the process while using the'),
        boxed_line('Proxy Manager                           '),
        boxed_line(' '),
        boxed_line(' '),
        boxed_line(),
    ].join('\n'));
};

E.prototype.start_web_socket = function(server){
    if (!server || this.argv.high_perf || !this._defaults.ui_ws)
        return;
    class Frontend_ws {
        constructor(conn){
            this.conn = conn;
        }
        hello(msg){
            logger.notice('hello msg %s', msg);
        }
    }
    this.wss = new zws.Server({
        impl: ws_lib,
        http_server: server,
        ipc_server: qw`hello`,
    }, conn=>new Frontend_ws(conn));
};

E.prototype.emit_ws_api = function(req, res){
    this.wss.broadcast_json(req.body);
    res.send('ok');
};

E.prototype.run_stats_reporting = etask._fn(function*(_this){
    _this.long_running_ets.push(this);
    let i = 0;
    while (1)
    {
        try {
            const cu = zos.cpu_usage();
            const meminfo = zos.meminfo();
            const fd = yield util_lib.count_fd();
            const stats = {
                mem_usage: Math.round(
                    (meminfo.memtotal-meminfo.memfree_all)/1024/1024),
                mem_usage_p: Math.round(zos.mem_usage()*100),
                cpu_usage_p: Math.round(cu.all*100),
                fd,
                cores: os.cpus().length,
                workers_running: _this.cluster_mgr.workers_running().length,
                cache: [_this.cache.space_taken],
            };
            if (i%5==0)
            {
                stats.tcp_established = yield util_lib.count_tcp();
                stats.tcp_time_wait = yield util_lib.count_tcp('TIME_WAIT');
            }
            if (_this.server_conf.client.cpu_reporting)
                yield _this.lpm_conn.report(stats);
            i++;
        } catch(e){
            const error = zerr.e2s(e);
            logger.error(error);
            _this.perr('error', {error, ctx: 'stats_reporting'});
        }
        yield etask.sleep(2*date.ms.SEC);
    }
});

E.prototype.perr = function(id, info={}, opt={}){
    info.customer = this._defaults.customer;
    info.account_id = this._defaults.account_id;
    util_lib.perr(id, info, opt);
};

E.prototype.run_cpu_usage_monitoring = etask._fn(
function*mgr_run_cpu_usage_monitoring(_this){
    _this.long_running_ets.push(this);
    // CPU usage is high right after starting proxy ports. Wait some time
    yield etask.sleep(10*date.ms.SEC);
    while (1)
    {
        const usage = Math.round(zos.cpu_usage().all*100);
        const level = usage>=consts.HIGH_CPU_THRESHOLD ? 'error' : null;
        _this.wss.broadcast_json({msg: 'cpu_usage', usage, level});
        if (usage>=consts.HIGH_CPU_THRESHOLD)
        {
            _this.timeouts.set_timeout(()=>etask(function*(){
                const _usage = Math.round(zos.cpu_usage().all*100);
                if (_usage>=consts.HIGH_CPU_THRESHOLD)
                {
                    let msg = `High CPU usage: ${_usage}%. Contact support to `
                    +'understand how to optimize Proxy Manager\n';
                    const tasks = yield util_lib.get_lpm_tasks(
                        {all_processes: true, current_pid: true});
                    msg += util_lib.get_status_tasks_msg(tasks);
                    logger.error(msg);
                }
            }), 10*date.ms.SEC);
        }
        yield etask.sleep(15*date.ms.SEC);
    }
});

E.prototype.is_reseller = function(){
    // XXX mikhailpo: rm _defaults checking once we added dedicated pool
    return this.argv.reseller || this._defaults.reseller;
};

E.prototype.perr_api = etask._fn(
function*mgr_error(_this, req, res){
    const {type, message, stack, context} = req.body;
    yield _this.perr(type, {message, context}, {backtrace: stack});
    res.send('OK');
});

E.prototype.gen_cert_api = function(req, res){
    ssl.gen_cert();
    res.send('OK');
};

E.prototype.get_general_logs_api = function(req, res){
    const logs = fs.readFileSync(logger.lpm_filename);
    const limit = req.query.limit||100;
    const print = logs.toString().split('\n').slice(-1*limit).join('\n');
    res.send(print);
};

E.prototype.set_logger_level = function(level, from_argv){
    // XXX krzysztof: temp disable this feature for win due to crashing
    // from this place
    if (lpm_config.is_win)
        return;
    level = this.get_logger_level(level, from_argv);
    logger.set_level(level);
    this.cluster_mgr.workers_running().forEach(w=>{
        try {
            this.cluster_mgr.send_worker_setup(w, level);
        } catch(e){
            this.perr('error', {error: zerr.e2s(e), ctx: 'ipc_broken'});
        }
    });
};

E.prototype.get_logger_level = function(level, from_argv){
    if (from_argv && this.argv.log!=lpm_config.manager_default.log)
         return this.argv.log;
    return level;
};

E.prototype.set_log_level_api = function(req, res){
    this.set_logger_level(req.body.level);
    res.send('OK');
};
