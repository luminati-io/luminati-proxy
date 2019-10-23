#!/usr/bin/env node
// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/
const _ = require('lodash');
const events = require('events');
const fs = require('fs');
const path = require('path');
const os = require('os');
const dns = require('dns');
configure_dns();
const url = require('url');
const stringify = require('json-stable-stringify');
const express = require('express');
const compression = require('compression');
const body_parser = require('body-parser');
const open = require('open');
const request = require('request').defaults({gzip: true});
const http = require('http');
const util = require('util');
const semver = require('semver');
const {Netmask} = require('netmask');
const logger = require('./logger.js').child({category: 'MNGR'});
const http_shutdown = require('http-shutdown');
const consts = require('./consts.js');
const Proxy_port = require('./proxy_port.js');
const ssl = require('./ssl.js');
const pkg = require('../package.json');
const swagger = require('./swagger.json');
const zerr = require('../util/zerr.js');
const etask = require('../util/etask.js');
const string = require('../util/string.js');
const file = require('../util/file.js');
const date = require('../util/date.js');
const user_agent = require('../util/user_agent.js');
const lpm_config = require('../util/lpm_config.js');
const zurl = require('../util/url.js');
const cookie = require('cookie');
const cookie_filestore = require('tough-cookie-file-store');
const check_node_version = require('check-node-version');
const cities = require('./cities.js');
const perr = require('./perr.js');
const util_lib = require('./util.js');
const web_socket = require('ws');
const Tracer = require('./tracer.js');
const Loki = require('./loki.js');
const puppeteer = require('./puppeteer.js');
const {get_perm, is_static_proxy, is_mobile,
    get_password} = require('../util/zones.js');
const cluster = require('cluster');
const Config = require('./config.js');
const is_darwin = process.platform=='darwin';
let zos;
if (!lpm_config.is_win && !is_darwin)
    zos = require('../util/os.js');
let cookie_jar;
try {
    require('heapdump');
} catch(e){}

const qw = string.qw;
const E = module.exports = Manager;
swagger.info.version = pkg.version;
const is_pkg = typeof process.pkg!=='undefined';

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

E.default = Object.assign({}, lpm_config.manager_default);

const sanitize_argv = argv=>{
    argv = argv||{};
    argv.explicit_opt = argv.explicit_opt||{};
    // XXX krzysztof: to remove
    argv._ = argv._||[];
    return argv;
};

function Manager(argv){
    events.EventEmitter.call(this);
    try {
        this.proxy_ports = {};
        this.argv = sanitize_argv(argv);
        logger.notice('Manager started %s', pkg.version);
        this.mgr_opts = _.pick(argv, lpm_config.mgr_fields);
        this.opts = _.pick(argv, _.keys(lpm_config.proxy_fields));
        this.config = new Config(this, E.default, {filename: argv.config});
        const conf = this.config.get_proxy_configs();
        this._total_conf = conf;
        this._defaults = conf._defaults;
        this.proxies = conf.proxies;
        this.pending_www_ips = new Set();
        this.config.save();
        this.first_actions = this.get_first_actions_data();
        this.loki = new Loki(argv.loki);
        this.features = new Set();
        this.feature_used('start');
        this.timeout_ids = [];
        this.long_running_ets = [];
        this.async_reqs_queue = [];
        this.async_active = 0;
    } catch(e){
        logger.error('Manager constructor: %s', zerr.e2s(e));
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

util.inherits(Manager, events.EventEmitter);

E.prototype.handle_usage = function(data){
    if (!this.argv.www || this.argv.high_perf)
        return;
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
    data.content_type = get_content_type(data);
    data.success = +(data.status_code && (data.status_code=='unknown' ||
        consts.SUCCESS_STATUS_CODE_RE.test(data.status_code)));
    const proxy = this.proxy_ports[data.port];
    if (proxy && proxy.status!='ok' && data.success)
        this.proxy_ports[data.port].status = 'ok';
    if (proxy)
        proxy.update_last_ip(data.proxy_peer);
    if (this._defaults.request_stats)
        this.loki.stats_process(data);
    // XXX krzysztof: support keep alive requests in the logs
    if (data.context!='SESSION KEEP ALIVE')
        this.logs_process(data);
};

E.prototype.handle_usage_abort = function(uuid){
    if (!this.wss)
        return;
    this.wss.broadcast(uuid, 'har_viewer_abort');
};

E.prototype.handle_usage_start = function(data){
    if (data.context=='SESSION KEEP ALIVE')
        return;
    if (!this.wss || !Number(this._defaults.logs))
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
    this.wss.broadcast(req, 'har_viewer_start');
};

E.prototype.logs_process = function(data){
    const har_req = this.har([data]).log.entries[0];
    const max_logs = Number(this._defaults.logs);
    if (!max_logs)
        return this.emit('request_log', har_req);
    if (this.wss)
        this.wss.broadcast(har_req, 'har_viewer');
    this.emit('request_log', har_req);
    this.loki.request_process(data, max_logs);
};

E.prototype.get_first_actions_data = function(){
    const filename = lpm_config.first_actions;
    if (file.exists(filename))
    {
        try {
            const data = JSON.parse(fs.readFileSync(filename).toString());
            if (!data || !data.sent || !data.pending)
                return {sent: {}, sending: {}, pending: []};
            return Object.assign(data, {sending: {}});
        } catch(e){ logger.error('get first actions: %s', zerr.e2s(e)); }
    }
    return {sent: {}, sending: {}, pending: []};
};

E.prototype.save_first_actions = function(){
    fs.writeFileSync(lpm_config.first_actions,
        stringify(_.omit(this.first_actions, 'sending')));
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
    _.values(_this.proxy_ports).forEach(stop_server);
    if (_this.wss)
        _this.wss.close();
    yield etask.all(servers);
});

E.prototype.stop = etask._fn(
function*mgr_stop(_this, reason, force, restart){
    _this.timeout_ids.forEach(id=>clearTimeout(id));
    _this.long_running_ets.forEach(et=>et.return());
    yield _this.perr(restart ? 'restart' : 'exit', {reason});
    yield _this.loki.save();
    _this.loki.stop();
    if (reason!='config change')
        yield _this.config.save();
    if (reason instanceof Error)
        reason = zerr.e2s(reason);
    logger.notice('Manager stopped: %s', reason);
    yield _this.stop_servers();
    const task = this;
    cluster.disconnect(()=>{
        task.continue();
    });
    yield this.wait();
    if (!restart)
        _this.emit('stop', reason);
});

const headers_to_a = h=>_.toPairs(h).map(p=>({name: p[0], value: p[1]}));
E.prototype.har = function(entries){
    return {log: {
        version: '1.2',
        creator: {name: 'Luminati Proxy', version: pkg.version},
        pages: [],
        entries: entries.map(entry=>{
            const req = JSON.parse(entry.request_headers||'{}');
            const res = JSON.parse(entry.response_headers||'{}');
            const tl = (JSON.parse(entry.timeline)||[{}])[0];
            const timeline = JSON.parse(entry.timeline)||[{}];
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
                        blocked: t.create-start,
                        wait: t.connect-t.create||0,
                        receive: t.end-t.connect||t.end-t.create,
                        port: t.port,
                    })),
                    super_proxy: entry.super_proxy,
                    username: entry.username,
                    password: entry.password,
                    remote_address: entry.remote_address,
                    rules: entry.rules,
                },
                startedDateTime: new Date(tl.create||0).toISOString(),
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
                // XXX krzysztof: this is to be added. timeline is broken
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
    const zones = this.zones.map(z=>({
        name: z.zone,
        perm: z.perm,
        plan: z.plan || {},
        password: z.password,
    })).filter(p=>p.plan && !p.plan.disable);
    res.json({zones, def: this._defaults.zone});
};

E.prototype.get_consts_api = function(req, res){
    const proxy = _.mapValues(lpm_config.proxy_fields, desc=>({desc}));
    _.forOwn(E.default, (def, prop)=>{
        if (proxy[prop])
            proxy[prop].def = def;
    });
    if (proxy.zone)
        proxy.zone.def = this._defaults.zone;
    _.merge(proxy, {dns: {values: ['', 'local', 'remote']}});
    const ifaces = Object.keys(os.networkInterfaces())
        .map(iface=>({key: iface, value: iface}));
    ifaces.unshift({key: 'All', value: '0.0.0.0'});
    ifaces.unshift({key: 'Default (dynamic)', value: ''});
    proxy.iface.values = ifaces;
    const notifs = this.lum_conf && this.lum_conf.lpm_notifs || [];
    const logins = this.lum_conf && this.lum_conf.logins || [];
    res.json({proxy, notifs, logins});
};

E.prototype.enable_ssl_api = etask._fn(
function*mgr_enable_ssl(_this, req, res){
    const proxies = _this.proxies.slice();
    for (let i in proxies)
    {
        const p = proxies[i];
        if (p.port!=22225 && !p.ssl)
            yield _this.proxy_update(p, Object.assign(p, {ssl: true}));
    }
    res.send('ok');
});

E.prototype.update_ips_api = etask._fn(
function*mgr_update_ips(_this, req, res){
    const ips = req.body.ips||[];
    const vips = req.body.vips||[];
    const proxy = _this.proxies.find(p=>p.port==req.body.port);
    yield _this.proxy_update(proxy, Object.assign(proxy, {ips, vips}));
    res.send('ok');
});

E.prototype.update_notifs_api = etask._fn(
function*mgr_update_notif(_this, req, res){
    _this.lum_conf.lpm_notifs = _this.lum_conf.lpm_notifs || [];
    const notifs = req.body.notifs;
    notifs.forEach(updated_notif=>{
        const stored_notif = _this.lum_conf.lpm_notifs.find(
            n=>n._id==updated_notif.id);
        if (stored_notif)
            stored_notif.status = updated_notif.status;
    });
    const response = yield _this.api_request({
        method: 'POST',
        url: `${_this._defaults.api}/update_lpm_notifs`,
        form: {notifs},
    });
    res.json(response.body);
});

E.prototype.send_rule_mail = etask._fn(
function*mgr_send_rule_mail(_this, port, to, _url){
    const subject = `Luminati: Rule was triggered`;
    const text = `Hi,\n\nYou are getting this email because you asked to get `
    +`notified when Luminati rules are triggered.\n\n`
    +`Request URL: ${_url}\n`
    +`Port: ${port}\n\n`
    +`You can resign from receiving these notifications in the proxy port `
    +`configuration page in the Rule tab. If your LPM is running on localhost `
    +`you can turn it off here: `
    +`http://127.0.0.1:${_this.opts.www}/proxy/${port}/rules\n\n`
    +`Luminati`;
    const response = yield _this.api_request({
        method: 'POST',
        url: `${_this._defaults.api}/send_rule_mail`,
        form: {to, subject, text},
    });
    return response.body;
});

E.prototype.report_bug_api = etask._fn(
function*mgr_report_bug(_this, req, res){
    let log_file = '';
    const config_file = Buffer.from(_this.config.get_string())
        .toString('base64');
    const log_path = path.join(lpm_config.work_dir, 'luminati.log');
    if (file.exists(log_path))
    {
        let buffer = fs.readFileSync(log_path);
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
        url: `${_this._defaults.api}/report_bug`,
        form: {report: {config: config_file, log: log_file, har,
            desc: req.body.desc, lpm_v: pkg.version, os: os.platform(),
            browser, email: req.body.email}},
    });
    res.status(response.statusCode).json(response.body);
});

E.prototype.set_www_whitelist_ips = function(ips){
    ips = [...new Set(ips)];
    ips.forEach(ip=>this.pending_www_ips.delete(ip));
    if (!ips.length)
        return delete this._defaults.www_whitelist_ips;
    this._defaults.www_whitelist_ips = ips;
};

E.prototype.set_whitelist_ips = function(ips){
    const cmd_whitelist = this.opts.whitelist_ips||[];
    ips = [...new Set(ips)].filter(ip=>!cmd_whitelist.includes(ip));
    const get_default_wh = ()=>cmd_whitelist.concat(
        this._defaults.whitelist_ips||[]);
    const prev = get_default_wh();
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
    this.update_ports(
        {whitelist_ips: {default: 1, prev, curr: get_default_wh()}});
};

const error_messages = {
    'EMFILE': 'EMFILE: out of file descriptors',
};

E.prototype.error_handler = function error_handler(source, err){
    if (!err.code && err.stack)
        logger.error(err.stack.split('\n').slice(0, 2).join('\n'));
    else if (error_messages[err.code])
        return logger.error(error_messages[err.code]);
    else
        logger.error(err.message);
    err.source = source;
    this.emit('error', err);
};

E.prototype.complete_proxy_config = function(conf){
    const c = Object.assign({}, E.default, this._defaults, conf);
    c.whitelist_ips = [...new Set((this.opts.whitelist_ips||[]).concat(
        this._defaults.whitelist_ips||[], c.whitelist_ips||[]))];
    c.current_ip = this.opts.current_ip;
    const zone = this.zones.find(z=>z.zone==c.zone);
    const plan = zone && zone.plan;
    c.unblock = !!(plan && (plan.type=='unblocker' || plan.unblocker));
    c.ssl_perm = !!(plan && plan.ssl);
    return c;
};

E.prototype.create_single_proxy = etask._fn(
function*mgr_create_single_proxy(_this, proxy_config, conf){
    conf = _this.complete_proxy_config(conf);
    proxy_config.whitelist_ips = conf.whitelist_ips;
    logger.notice('Starting proxies %s', conf.port);
    const proxy = new Proxy_port(conf, proxy_config);
    proxy.on('error', err=>{
        _this.error_handler('Proxy port '+conf.port, err);
    });
    proxy.on('ready', ()=>{
        logger.notice('Proxy %s ready', conf.port);
    });
    proxy.on('stopped', ()=>{
        logger.notice('Port %s stopped', conf.port);
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
    proxy.on('send_rule_mail', data=>{
        _this.send_rule_mail(data.port, data.email, data.url);
    });
    proxy.on('first_lpm_action', data=>{
        _this.first_lpm_action(data.action, data.ua);
    });
    proxy.on('refresh_ip', data=>{
        _this.refresh_ip(data.ip, data.port);
    });
    proxy.on('banip_global', opt=>{
        _this.banip(opt.ip, opt.domain, opt.ms);
    });
    proxy.on('save_config', ()=>{
        _this.config.save();
    });
    proxy.on('feature_used', feature=>{
        _this.feature_used(feature);
    });
    proxy.on('add_static_ip', data=>{
        // XXX krzysztof: may not work correctly in cluster
        const proxy_conf = _this.proxies.find(p=>p.port==data.port);
        const serv = _this.proxy_ports[data.port];
        if (!serv.opt.static || (proxy_conf.ips||[]).includes(data.ip))
            return;
        if (!proxy_conf.ips)
            proxy_conf.ips = [];
        proxy_conf.ips.push(data.ip);
        serv.update_config({ips: proxy_conf.ips});
        _this.config.save();
    });
    _this.proxy_ports[conf.port] = proxy;
    proxy.start();
    const task = this;
    proxy.on('ready', ()=>{
        task.continue();
    });
    yield this.wait();
    return proxy;
});

E.prototype.monitor_proxy_rules = function(rules){
    rules = rules||[];
    for (const rule of rules)
    {
        if (rule.trigger_type)
            this.feature_used(`trigger.${rule.trigger_type}`);
        if (rule.action_type)
            this.feature_used(`action.${rule.action_type}`);
    }
};

E.should_resolve_proxy = conf=>{
    const max_requests = conf.max_requests||0;
    if (conf.preset=='rotating' && max_requests<=1)
        return false;
    return true;
};

E.prototype.create_proxy = etask._fn(
    function*mgr_create_proxy(_this, proxy, ua){
    if (proxy.conflict)
    {
        logger.error('Port %s is already in use by %s - skipped',
            proxy.port, proxy.conflict);
        return null;
    }
    if (proxy.proxy_type=='persist')
        _this.first_lpm_action('create_proxy_port', ua);
    proxy = _.omitBy(proxy, v=>!v && v!==0 && v!==false);
    _this.monitor_proxy_rules(proxy.rules);
    const zone_name = proxy.zone || _this._defaults.zone;
    proxy.password = get_password(proxy, zone_name, _this.zones) ||
        _this.argv.password || _this._defaults.password;
    const conf = Object.assign({}, proxy);
    lpm_config.numeric_fields.forEach(field=>{
        if (conf[field])
            conf[field] = +conf[field];
    });
    conf.static = is_static_proxy(zone_name, _this.zones);
    conf.mobile = is_mobile(zone_name, _this.zones);
    conf.proxy_resolve = E.should_resolve_proxy(conf);
    const proxies = _this.multiply_port(conf);
    const servers = yield etask.all(proxies.map(
        _this.create_single_proxy.bind(_this, proxy)));
    const server = servers[0];
    server.dups = servers.slice(1);
    if (!_this.argv.cluster)
        server.session_mgr._request_session({}, {init: true});
    return server;
});

E.prototype.multiply_port = function(conf){
    const multiply = conf.multiply||1;
    const proxies = [conf];
    const ips = conf.ips||[];
    const vips = conf.vips||[];
    for (let i=1; i<multiply; i++)
    {
        const dup = Object.assign({}, conf, {
            proxy_type: 'duplicate',
            master_port: conf.port,
            port: conf.port+i,
        });
        if (dup.multiply_ips)
        {
            dup.ip = ips[i];
            dup.ips = [dup.ip];
        }
        if (dup.multiply_vips)
        {
            dup.vip = vips[i];
            dup.vips = [dup.vip];
        }
        proxies.push(dup);
    }
    if (conf.multiply_ips)
    {
        conf.ip = ips[0];
        conf.ips = [conf.ip];
    }
    if (conf.multiply_vips)
    {
        conf.vip = vips[0];
        conf.vips = [conf.vip];
    }
    return proxies;
};

E.prototype.proxy_create = etask._fn(
    function*mgr_proxy_create(_this, proxy, ua){
    this.on('uncaught', e=>{
        logger.error('proxy create: '+zerr.e2s(e));
    });
    if (!proxy.proxy_type && proxy.port!=22225)
        proxy.proxy_type = 'persist';
    const server = yield _this.create_proxy(proxy, ua);
    if (proxy.proxy_type=='persist')
    {
        _this.proxies.push(proxy);
        _this.config.save();
    }
    return server;
});

E.prototype.proxy_delete = etask._fn(function*mgr_proxy_delete(_this, port){
    this.on('uncaught', e=>{
        logger.error('proxy delete: '+zerr.e2s(e));
    });
    const proxy = _this.proxy_ports[port];
    if (!proxy)
        return;
    const ports = [proxy.opt.port, ...proxy.dups.map(d=>d.opt.port)];
    // needed in order to prevent other APIs from getting orphan dups
    ports.forEach(p=>delete _this.proxy_ports[p]);
    proxy.stop();
    proxy.once('stopped', this.continue_fn());
    yield this.wait();
    proxy.destroy();
    if (proxy.opt.proxy_type=='persist')
    {
        const idx = _this.proxies.findIndex(p=>p.port==port);
        if (idx==-1)
            return;
        _this.proxies.splice(idx, 1);
        _this.config.save();
    }
});

const get_free_port = proxies=>{
    if (Array.isArray(proxies))
        proxies = proxies.map(x=>x.port);
    else
        proxies = Object.keys(proxies);
    if (!proxies.length)
        return 24000;
    return +_.max(proxies)+1;
};

E.prototype.proxy_dup_api = etask._fn(
function*mgr_proxy_dup_api(_this, req, res){
    const port = req.body.port;
    const proxy = _.cloneDeep(_this.proxies.filter(p=>p.port==port)[0]);
    proxy.port = get_free_port(_this.proxy_ports);
    yield _this.proxy_create(proxy);
    res.json({proxy});
});

E.prototype.proxy_create_api = etask._fn(
function*mgr_proxy_create_api(_this, req, res){
    logger.info('proxy_create_api');
    let port;
    if (req.body.proxy.port=='auto')
        port = get_free_port(_this.proxy_ports);
    else
        port = +req.body.proxy.port;
    do {
        let errors = yield _this.proxy_check({port});
        if (errors.length && req.body.proxy.port=='auto' &&
            errors.some(e=>e.msg.includes('in use')) && port<65535)
        {
            port++;
            continue;
        }
        else if (errors.length)
            return res.status(400).json({errors});
        break;
    } while (true);
    const proxy = Object.assign({}, req.body.proxy, {port});
    const server = yield _this.proxy_create(proxy, req.get('user-agent'));
    res.json({data: server.opt});
});

E.prototype.proxy_update = etask._fn(
function*mgr_proxy_update(_this, old_proxy, new_proxy){
    const old_port = old_proxy.port;
    const port = new_proxy.port;
    if (port!==undefined)
    {
        const errors = yield _this.proxy_check({port: +port}, old_port);
        if (errors.length)
            throw {errors};
    }
    const old_server = _this.proxy_ports[old_port];
    if (!old_server)
        throw 'Server does not exists';
    const banlist = old_server.banlist;
    yield _this.proxy_delete(old_port);
    let proxy = Object.assign({}, old_proxy, new_proxy);
    proxy = _.omitBy(proxy, v=>v==='');
    const server = yield _this.proxy_create(proxy);
    server.banlist = banlist;
    return server.opt;
});

E.prototype.proxy_update_api = etask._fn(
function*mgr_proxy_update_api(_this, req, res){
    logger.info('proxy_update_api');
    const old_port = req.params.port;
    const old_proxy = _this.proxies.find(p=>p.port==old_port);
    if (!old_proxy)
        throw `No proxy at port ${old_port}`;
    if (old_proxy.proxy_type!='persist')
        throw 'This proxy is read-only';
    try {
        const data = yield _this.proxy_update(old_proxy, req.body.proxy);
        res.json({data});
    } catch(e){
        res.status(400).json({errors: e.errors});
    }
});

E.prototype.api_url_update_api = function(req, res){
    let new_url = 'https://'+req.body.url.replace(/https?:\/\/(www\.)?/, '');
    this._defaults.api = new_url;
    this.config.save();
    res.status(200).send('ok');
    this.emit('config_changed');
};

E.prototype.proxy_banips_api = function(req, res){
    const port = req.params.port;
    const proxy = this.proxy_ports[port];
    if (!proxy)
        return res.status(400).send(`No proxy at port ${port}`);
    const {ips, domain, ms=0} = req.body||{};
    if (!ips || !ips.length || !ips.every(util_lib.is_ip))
        return res.status(400).send('No ips provided');
    ips.every(ip=>proxy.banip(ip, ms, domain));
    return res.status(204).end();
};

// XXX krzysztof: make a separate module for all the banips API
E.prototype.banip_api = function(req, res){
    const {ip, domain, ms=0} = req.body||{};
    if (!ip || !util_lib.is_ip(ip))
        return res.status(400).send('No IP provided');
    this.banip(ip, domain, ms);
    return res.status(204).end();
};

E.prototype.banip = function(ip, domain, ms){
    Object.values(this.proxy_ports).forEach(p=>{
        p.banip(ip, ms, domain);
    });
};

E.prototype.proxy_banip_api = function(req, res){
    const port = req.params.port;
    const proxy = this.proxy_ports[port];
    if (!proxy)
        return res.status(400).send(`No proxy at port ${port}`);
    const {ip, domain, ms=0} = req.body||{};
    if (!ip || !util_lib.is_ip(ip))
        return res.status(400).send('No IP provided');
    proxy.banip(ip, ms, domain);
    return res.status(204).end();
};

E.prototype.proxy_unbanip_api = function(req, res){
    const port = req.params.port;
    const server = this.proxy_ports[port];
    if (!server)
        throw `No proxy at port ${port}`;
    const {ip} = req.body;
    if (!util_lib.is_ip(ip))
        throw `No ip provided`;
    server.unbanip(ip);
    return res.json(this.get_banlist(server, true));
};

E.prototype.proxy_unbanip_delete_api = function(req, res){
    this.perr('warn.unban_delete');
    return res.status(301).send('Use POST request instead of DELETE');
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
function*mgr_proxy_delete_wrapper(_this, ports){
    if (ports.length)
    {
        yield etask.all(ports.map(_this.proxy_delete, _this));
        _this.loki.requests_clear({port: {$in: ports}});
        _this.loki.stats_clear_by_ports(ports);
    }
});

E.prototype.proxy_delete_api = etask._fn(
function*mgr_proxy_delete_api(_this, req, res){
    logger.info('proxy_delete_api');
    const port = +req.params.port;
    yield _this.proxy_delete_wrapper([port]);
    res.sendStatus(204);
});

E.prototype.proxies_delete_api = etask._fn(
function*mgr_proxies_delete_api(_this, req, res){
    logger.info('proxies_delete_api');
    const ports = req.body.ports||[];
    yield _this.proxy_delete_wrapper(ports);
    res.sendStatus(204);
});

E.prototype.refresh_sessions_api = function(req, res){
    const port = req.params.port;
    if (!this.proxy_ports[port])
        return res.status(400, 'Invalid proxy port').end();
    this.refresh_server_sessions(port);
    res.status(204).end();
};

E.prototype.refresh_server_sessions = function(port){
    const proxy_port = this.proxy_ports[port];
    return proxy_port.refresh_sessions();
};

E.prototype.proxy_status_get_api = etask._fn(
function*mgr_proxy_status_get_api(_this, req, res){
    const port = req.params.port;
    const proxy = _this.proxy_ports[port];
    if (!proxy)
        return res.json({status: 'Unknown proxy'});
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
            proxy.status_details = yield _this.proxy_check(proxy.config,
                proxy.config.port);
        }
    }
    if (force && proxy.status)
        proxy.status = undefined;
    for (let cnt=0; proxy.status===null && cnt<=22; cnt++)
        yield etask.sleep(date.ms.SEC);
    if (proxy.status===null)
        return res.json({status: 'Unexpected lock on status check.'});
    if (proxy.status)
        return res.json(_.pick(proxy, fields));
    yield _this.test_port(proxy, req.headers);
    res.json(_.pick(proxy, fields));
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
        error = r.headers['x-luminati-error'] || r.headers['x-lpm-error'];
        if (/ECONNREFUSED/.test(error))
        {
            error = 'connection refused (may have been caused due to firewall '
            +'settings)';
        }
    } catch(e){
        etask.ef(e);
        if (e.code=='ESOCKETTIMEDOUT')
        {
            const detail = {
                msg: 'timeout (may have been caused due to firewall settings)',
                lvl: 'err',
                field: 'port',
            };
            if (proxy.status_details)
                proxy.status_details.push(detail);
            else
                proxy.status_details = [detail];
        }
    }
    proxy.status = error || (success ? 'ok' : 'error');
});

E.prototype.open_browser_api = etask._fn(
function*mgr_open_browser_api(_this, req, res){
    if (!puppeteer)
        return res.status(400).send('Puppeteer not installed');
    const {port} = req.params;
    try {
        const browser = yield puppeteer.launch({headless: false,
            ignoreHTTPSErrors: true,
            args: [`--proxy-server=127.0.0.1:${port}`]});
        const page = (yield browser.pages())[0] || (yield browser.newPage());
        yield page.goto(_this._defaults.test_url);
        yield browser.disconnect();
    } catch(e){ logger.error('open_browser_api: %s', e.message); }
    res.status(200).send('OK');
});

E.prototype.proxy_port_check = etask._fn(
function*mgr_proxy_port_check(_this, port, duplicate, old_port, old_duplicate){
    duplicate = +duplicate || 1;
    port = +port;
    let start = port;
    const end = port+duplicate-1;
    const old_end = old_port && old_port + (old_duplicate||1) -1;
    const ports = [];
    for (let p = start; p <= end; p++)
    {
        if (old_port && old_port <= p && p <= old_end)
            continue;
        if (p==_this.argv.www)
            return p+' in use by the UI/API';
        if (p==_this.argv.ws)
            return p+' in use by the UI/Web Socket';
        if (_this.proxy_ports[p])
            return p+' in use by another proxy';
        ports.push(p);
    }
    try {
        yield etask.all(ports.map(p=>etask(function*proxy_port_check(){
            const server = http.createServer();
            server.on('error', e=>{
                if (/EADDRINUSE/i.test(e.message))
                    this.throw(new Error(p + ' in use by another app'));
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
    const port = new_proxy_config.port;
    const zone = new_proxy_config.zone;
    const effective_zone = zone||E.default.zone;
    const multiply = new_proxy_config.multiply;
    if (port!==undefined)
    {
        if (!port)
            info.push({msg: 'invalid port', lvl: 'err', field: 'port'});
        else
        {
            const in_use = yield _this.proxy_port_check(port, multiply,
                old_proxy_port, old_proxy.multiply);
            if (in_use)
            {
                info.push({msg: 'port '+in_use, lvl: 'err',
                    field: 'port'});
            }
        }
    }
    if (zone!==undefined)
    {
        if (_this.zones.length)
        {
            let db_zone = _this.zones.filter(i=>i.zone==zone)[0];
            if (!db_zone)
                db_zone = _this.zones.filter(i=>i.zone==effective_zone)[0];
            if (!db_zone)
            {
                info.push({msg: 'the provided zone name is not valid.',
                    lvl: 'err', field: 'zone'});
            }
            else if (db_zone.ips==='')
            {
                info.push({msg: 'the zone has no IPs in whitelist',
                    lvl: 'err', field: 'zone'});
            }
            else if (!db_zone.plan || db_zone.plan.disable)
                info.push({msg: 'zone disabled', lvl: 'err', field: 'zone'});
        }
    }
    return info;
});

E.prototype.proxy_check_api = etask._fn(
function*mgr_proxy_check_put(_this, req, res){
    const info = yield _this.proxy_check(req.body, +req.params.port);
    res.json(info);
});

E.prototype.config_check_api = function(req, res){
    let errors;
    try { errors = this.config.check(JSON.parse(req.body.config)); }
    catch(e){
        etask.ef(e);
        logger.warn('Config parsing error '+zerr.e2s(e));
        errors = ['Config is not a valid JSON'];
    }
    res.json(errors);
};

E.prototype.refresh_zones_api = etask._fn(
function*refresh_zones(_this, req, res){
    _this.feature_used('refresh_zones');
    const logged = yield _this.logged_update(req.get('user-agent'));
    if (logged)
        return res.status(200).send('OK');
    res.status(400).send('You need to log in again');
});

E.prototype.feature_used = function(key){
    this.features.add(key);
};

E.prototype.link_test_api = etask._fn(function*mgr_link_test(_this, req, res){
    _this.feature_used('link_tester_api');
    const opt = Object.assign(_.pick(req.query, qw`url country city state
        carrier user_agent headers skip_full_page screenshot html`));
    opt.port = req.params.port;
    if (!_this.proxy_ports[opt.port])
        return res.status(400).send('Wrong proxy port\n');
    if (!_this.proxy_ports[opt.port].opt.ssl)
    {
        return res.status(422).send('Proxy port needs to have turned on SSL'+
            ' logs. Check proxy port configuration under General tab.\n');
    }
    if (opt.html==='false')
        delete opt.html;
    if (opt.screenshot==='false')
        delete opt.screenshot;
    if (opt.headers)
    {
        try { opt.headers = JSON.parse(decodeURIComponent(opt.headers)); }
        catch(e){ logger.warn('wrong format of the headers'); }
    }
    if (req.body && req.body.headers)
        opt.headers = req.body.headers;
    const tracer = new Tracer(_this, _this.wss, _this.proxy_ports,
        _this._defaults.zones, _this.opts.log);
    const result = yield tracer.trace(opt);
    delete result.tracing_url;
    if (!result.err)
        delete result.err;
    res.json(result);
});

E.prototype.link_test_ui_api = etask._fn(function*mgr_trace(_this, req, res){
    _this.feature_used('link_tester_ui');
    const opt = Object.assign(_.pick(req.body, qw`url port uid`),
        {screenshot: true});
    let ua;
    if (ua = req.headers['user-agent'])
        opt.user_agent = ua;
    if (!_this.proxy_ports[opt.port])
        return res.status(400).send('Wrong proxy port');
    if (!_this.proxy_ports[opt.port].opt.ssl)
        return res.status(422).send('Proxy port needs to have SSL analyzing');
    opt.live = true;
    const tracer = new Tracer(_this, _this.wss, _this.proxy_ports,
        _this._defaults.zones, _this.opts.log);
    const result = yield tracer.trace(opt);
    res.json(result);
});

E.prototype.async_req_api = function(req, res){
    if (!req.body.url)
        return res.status(400).send(`url is required parameter`);
    if (!req.body.callback_url)
        return res.status(400).send(`callback_url is required parameter`);
    const port = req.params.port;
    const proxy = this.proxy_ports[port];
    if (!proxy)
        return res.status(500).send(`proxy port ${port} not found`);
    const make_callback = (_url, method, body, status_code, metadata,
        is_err)=>
    {
        const params = {metadata};
        if (is_err)
            params.error = body;
        else
            params.response = {body, status_code};
        method = method||'POST';
        const _opt = {url: _url, method};
        if (method=='GET')
            _opt.qs = params;
        else
            _opt.form = params;
        request(_opt, (err, response, _body)=>{
            if (err)
                logger.error('async_req_api (callback): %s', err.message);
            this.async_active--;
            if (!this.async_reqs_queue.length)
                return;
            const {req_opt, cb_opt} = this.async_reqs_queue.shift();
            make_request(req_opt, cb_opt);
        });
    };
    const make_request = (req_opt, cb_opt)=>{
        this.async_active++;
        request(req_opt, (err, response, body)=>{
            if (err)
            {
                logger.error('async_req_api (proxy req): %s', err.message);
                return make_callback(cb_opt.url, cb_opt.method, err.message, 0,
                    cb_opt.metadata, true);
            }
            make_callback(cb_opt.url, cb_opt.method, body, response.statusCode,
                cb_opt.metadata, false);
        });
    };
    const req_opt = {
        proxy: 'http://127.0.0.1:'+port,
        followRedirect: false,
        timeout: 20*date.ms.SEC,
        url: req.body.url,
        method: req.body.method||'GET',
        headers: req.body.headers,
    };
    if (proxy.opt.ssl)
        req_opt.ca = ssl.ca.cert;
    if (proxy.opt.unblock)
        req_opt.rejectUnauthorized = false;
    const cb_opt = {
        url: req.body.callback_url,
        method: req.body.callback_method,
        metadata: req.body.metadata,
    };
    if (this.async_active>=100)
    {
        this.async_reqs_queue.push({req_opt, cb_opt});
        res.status(200).send(`Request scheduled`);
    }
    else
    {
        make_request(req_opt, cb_opt);
        res.status(200).send(`Request sent`);
    }
};

E.prototype.proxy_tester_api = function(req, res){
    this.feature_used('proxy_tester');
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
    const opt = Object.assign(_.pick(req.body, qw`url headers body`), {
        followRedirect: false,
    });
    if (opt.body && typeof opt.body != 'string')
        opt.body = JSON.stringify(opt.body);
    const password = proxy.config.password;
    const user = 'tool-proxy_tester';
    const basic = Buffer.from(user+':'+password).toString('base64');
    opt.headers = opt.headers||{};
    opt.headers['proxy-authorization'] = 'Basic '+basic;
    opt.headers['user-agent'] = req.get('user-agent');
    if (+port)
    {
        opt.proxy = 'http://127.0.0.1:'+port;
        if (proxy.opt && proxy.opt.ssl || proxy.config.ssl)
            opt.ca = ssl.ca.cert;
        if (proxy.opt && proxy.opt.unblock || proxy.config.unblock)
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

E.prototype.get_all_locations_api = etask._fn(
function*mgr_get_all_locations(_this, req, res){
    const data = yield cities.all_locations();
    const shared_countries = yield _this.api_request({
        url: `${_this._defaults.api}/users/zone/shared_block_countries`});
    res.json(Object.assign(data,
        {shared_countries: shared_countries && shared_countries.body}));
});

E.prototype.get_all_carriers_api = etask._fn(
function*mgr_get_all_carriers(_this, req, res){
    const c_res = yield etask.nfn_apply(request, [{
        url: 'http://client.luminati.io/api/carriers',
        headers: {'user-agent': util_lib.user_agent},
        json: true,
    }]);
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
    this.loki.stats_clear();
    this.loki.requests_clear();
    res.send('ok');
};

E.prototype.logs_get_api = function(req, res){
    if (this.argv.high_perf)
        return {};
    const result = this.filtered_get(req);
    res.json(Object.assign({}, this.har(result.items), {total: result.total,
        skip: result.skip, sum_out: result.sum_out, sum_in: result.sum_in}));
};

E.prototype.logs_har_get_api = function(req, res){
    res.setHeader('content-disposition', 'attachment; filename=data.har');
    res.setHeader('content-type', 'application/json');
    const result = this.filtered_get(req);
    res.json(this.har(result.items));
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
        query.url = {'$regex': RegExp(req.query.search)};
    ['port', 'content_type', 'status_code', 'protocol'].forEach(param=>{
        let val;
        if (val = req.query[param])
        {
            if (param=='port' || param=='status_code')
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

E.prototype.node_version_api = etask._fn(
function*mgr_node_version(_this, req, res){
    if (process.versions && !!process.versions.electron)
        return res.json({is_electron: true});
    const chk = yield etask.nfn_apply(check_node_version,
        [{node: pkg.recomendedNode}]);
    res.json({
        current: chk.versions.node.version,
        satisfied: chk.versions.node.isSatisfied||is_pkg,
        recommended: pkg.recomendedNode,
    });
});

E.prototype._last_version = etask._fn(function*mgr__last_version(_this){
    const r = yield util_lib.json({
        url: `${_this._defaults.api}/lpm_config.json`,
        qs: {md5: pkg.lpm.md5, ver: pkg.version},
    });
    const github_url = 'https://raw.githubusercontent.com/luminati-io/'
    +'luminati-proxy/master/versions.json';
    const versions = yield util_lib.json({url: github_url});
    const newer = r.body.ver && semver.lt(pkg.version, r.body.ver);
    return Object.assign({newer, versions: versions.body}, r.body);
});

E.prototype.last_version_api = etask._fn(
function*mgr_last_version(_this, req, res){
    const r = yield _this._last_version();
    res.json({version: r.ver, newer: r.newer, versions: r.versions});
});

E.prototype.get_params = function(){
    const args = [];
    for (let k in this.argv)
    {
        const val = this.argv[k];
        if (qw`$0 h help version p ? v _ explicit_opt rules native_args
            daemon_opt`.includes(k))
        {
            continue;
        }
        if (lpm_config.credential_fields.includes(k))
            continue;
        if (typeof val=='object'&&_.isEqual(val, E.default[k])||
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

E.prototype.get_settings = function(){
    return {
        customer: this._defaults.customer,
        zone: this._defaults.zone,
        password: this._defaults.password,
        www_whitelist_ips: this._defaults.www_whitelist_ips||[],
        whitelist_ips: this._defaults.whitelist_ips||[],
        cmd_whitelist_ips: this.opts.whitelist_ips||[],
        read_only: this.opts.read_only,
        config: this.argv.config,
        test_url: this._defaults.test_url,
        api: this._defaults.api,
        mail_domain: pkg.mail_domain,
        logs: this._defaults.logs,
        log: this._defaults.log,
        request_stats: this._defaults.request_stats,
        dropin: this._defaults.dropin,
        pending_www_ips: [...this.pending_www_ips],
    };
};

// XXX krzysztof: improve mechanism for defaults values
E.prototype.update_settings_api = function(req, res){
    if (req.body.zone!==undefined)
        this._defaults.zone = req.body.zone;
    this._defaults.logs = req.body.logs;
    this.loki.request_trunc(this._defaults.logs);
    this._defaults.request_stats = req.body.request_stats;
    if (this._defaults.request_stats===undefined||
        this._defaults.request_stats==='')
    {
        this._defaults.request_stats = true;
    }
    if (!this._defaults.request_stats)
        this.loki.stats_clear();
    let ips;
    if ((ips=req.body.www_whitelist_ips)!==undefined)
        this.set_www_whitelist_ips(ips);
    if ((ips=req.body.whitelist_ips)!==undefined)
        this.set_whitelist_ips(ips);
    this.config.save();
    res.json(this.get_settings());
};

E.prototype.config_get_api = function(req, res){
    res.json({config: this.config.get_string()});
};

E.prototype.config_set_api = function(req, res){
    this.config.set_string(req.body.config);
    res.json({result: 'ok'});
    this.emit('config_changed');
};

E.prototype.creds_user_api = etask._fn(function*mgr_creds(_this, req, res){
    const remote_ip = req.ip;
    const config = yield _this.login_user(req.body.token, req.body.username,
        req.body.password, req.body.customer || _this._defaults.customer);
    if (config.error || config.body)
        return res.json(config.body||config);
    if (config.customers)
        return res.json({customers: config.customers});
    Object.assign(_this._defaults, config.defaults);
    const wips = _this._defaults.whitelist_ips || [];
    if (!wips.length && remote_ip!='127.0.0.1')
        _this.set_whitelist_ips([remote_ip]);
    const www_whitelist_ips = _this._defaults.www_whitelist_ips || [];
    if (!www_whitelist_ips.length && remote_ip!='127.0.0.1')
        _this.set_www_whitelist_ips([remote_ip]);
    _this.config.save();
    yield _this.logged_update(req.get('user-agent'));
    yield _this.sync_recent_stats();
    yield _this.sync_config_file();
    if (_this._defaults.password)
        res.cookie('local-login', _this._defaults.password);
    res.json({result: 'ok'});
});

E.prototype.update_proxies = function(){
    this.proxies.forEach(p=>{
        p.customer = p.customer || this._defaults.customer;
        p.zone = p.zone || this._defaults.zone;
        const zone = this.zones.find(z=>z.zone==(p.zone||this._defaults.zone));
        if (!zone)
            return;
        p.password = zone.password || p.password;
        const server = this.proxy_ports[p.port];
        if (server)
            server.update_config(p);
    });
};

E.prototype.gen_token = function(){
    const length = 12;
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
    +'0123456789';
    let ret = '';
    for (let i=0, n=charset.length; i<length; i++)
        ret += charset.charAt(Math.floor(Math.random()*n));
    return ret;
};

E.prototype.gen_token_api = function(req, res){
    const token = this.gen_token();
    this._defaults.token_auth = token;
    this.update_ports({token_auth: token});
    this.config.save();
    res.json({token});
};

E.prototype.update_ports = function(opt){
    Object.values(this.proxy_ports).forEach(p=>p.update_config(opt));
};

E.prototype.proxies_running_get_api = function(req, res){
    const proxies = Object.values(this.proxy_ports).map(p=>{
        return Object.assign({
            status: p.status,
            status_details: p.status_details,
        }, p.opt, {config: p.config});
    }).filter(p=>p.port!=22225);
    return res.json(proxies);
};

E.prototype.request_allocated_ips = etask._fn(
function*mgr_request_allocated_ips(_this, zone_name){
    const zone = _this.zones.find(z=>z.zone==zone_name);
    const password = zone && zone.password;
    const r = yield util_lib.json({
        url: `${_this._defaults.api}/users/zone/alloc_ips`,
        headers: {'x-hola-auth': `lum-customer-${_this._defaults.customer}`
            +`-zone-${zone_name}-key-${password}`},
    });
    return r.body;
});

E.prototype.request_allocated_vips = etask._fn(
function*mgr_request_allocated_vips(_this, zone_name){
    const zone = _this.zones.find(z=>z.zone==zone_name);
    const password = zone && zone.password;
    const r = yield util_lib.json({
        url: `${_this._defaults.api}/api/get_route_vips`,
        headers: {'x-hola-auth': `lum-customer-${_this._defaults.customer}`
            +`-zone-${zone_name}-key-${password}`},
    });
    return r.body;
});

E.prototype.allocated_ips_get_api = etask._fn(
function*mgr_allocated_ips_get(_this, req, res){
    res.send(yield _this.request_allocated_ips(req.query.zone));
});

E.prototype.allocated_vips_get_api = etask._fn(
function*mgr_allocated_vips_get(_this, req, res){
    res.send(yield _this.request_allocated_vips(req.query.zone));
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

E.prototype.refresh_ip = etask._fn(
function*mgr_refresh_ip(_this, ip, port){
    const server = _this.proxy_ports[port];
    logger.notice('Refreshing IP %s', ip);
    const allocated_ips = yield _this.request_allocated_ips(server.opt.zone);
    const new_ips = yield _this.refresh_ips(server.opt.zone, zurl.ip2num(ip));
    if (new_ips.error)
        return logger.warn('Refreshing IP failed: %s', new_ips.error);
    const ips_map = map_ips(allocated_ips.ips, new_ips.ips.map(i=>i.ip));
    if ((server.opt.ips||[]).includes(ip))
    {
        server.config.ips = server.config.ips.map(_ip=>ips_map[_ip]);
        server.opt.ips = server.opt.ips.map(_ip=>ips_map[_ip]);
        _this.proxies.find(p=>p.port==server.opt.port).ips = server.config.ips;
        _this.config.save();
    }
    _this.refresh_server_sessions(server.opt.port);
    logger.notice('IP has been refreshed %s->%s', ip, ips_map[ip]);
});

E.prototype.refresh_ips = etask._fn(function*fresh_ips(_this, zone, ips){
    const response = yield _this.api_request({
        method: 'POST',
        url: `${_this._defaults.api}/users/zone/refresh_ips`,
        form: {customer: _this._defaults.customer, zone, ips, cn: 1},
    });
    if (response.statusCode==200)
        return response.body;
    return {error: response.body};
});

E.prototype.refresh_ips_api = etask._fn(
function*mgr_refresh_ips(_this, req, res){
    const zone = req.body.zone;
    const ips = req.body.ips;
    const r = yield _this.refresh_ips(zone, ips);
    res.json(r);
});

E.prototype.refresh_vips_api = etask._fn(
function*mgr_refresh_vips(_this, req, res){
    const zone = req.body.zone;
    const vips = req.body.vips;
    const response = yield _this.api_request({
        method: 'POST',
        url: `${_this._defaults.api}/users/zone/refresh_vips`,
        form: {customer: _this._defaults.customer, zone, vips},
    });
    if (response.statusCode==200)
        return res.json(response.body);
    return res.json({error: response.body});
});

E.prototype.shutdown_api = function(req, res){
    res.json({result: 'ok'});
    this.stop(true);
};

E.prototype.logout = etask._fn(function*mgr_logout(_this){
    for (let k of lpm_config.credential_fields)
        _this._defaults[k] = '';
    _this.config.save();
    _this.lum_conf = undefined;
    cookie_jar = undefined;
    const jarpath = _this.argv.cookie;
    if (fs.existsSync(jarpath))
        fs.writeFileSync(jarpath, '');
    _this.luminati_jar = undefined;
    yield _this.logged_update();
});

E.prototype.logout_api = etask._fn(function*mgr_logout_api(_this, req, res){
    yield _this.logout();
    res.cookie('local-login', '');
    res.json({result: 'ok'});
});

E.prototype.restart_api = function(req, res){
    this.emit('restart');
    res.json({result: 'ok'});
};

E.prototype._upgrade = etask._fn(function*mgr__upgrade(_this, cb){
    yield _this.loki.save();
    _this.emit('upgrade', cb);
});

E.prototype.upgrade_api = etask._fn(function*mgr_upgrade(_this, req, res){
    yield _this._upgrade(e=>e ? res.status(403).send(e)
        : res.json({result: 'ok'}));
});

E.prototype.start_auto_update = function(){
    let cb, tm = 10*date.ms.MIN;
    const id = setTimeout(cb = etask._fn(function*mgr_start_auto_update(_this){
        const v = yield _this._last_version();
        if (v.newer && v.auto_update)
            _this._upgrade();
        else
           _this.timeout_ids.push(setTimeout(cb, tm));
    }).bind(this), tm);
    this.timeout_ids.push(id);
};

E.prototype.api_request = etask._fn(function*mgr_api_request(_this, opt){
    if (!_this.logged_in && !opt.force)
        return;
    const jar = _this.luminati_jar.jar;
    const headers = {'user-agent': util_lib.user_agent};
    yield etask.nfn_apply(request, [{url: _this._defaults.api, jar, headers}]);
    const xsrf = (jar.getCookies(_this._defaults.api).find(e=>
        e.key=='XSRF-TOKEN')||{}).value;
    const {customer, token} = _this._defaults;
    const res = yield etask.nfn_apply(request, [{
        method: opt.method||'GET',
        url: opt.url,
        qs: Object.assign(opt.qs||{}, {customer, token}),
        jar,
        json: true,
        headers: Object.assign(headers, {'X-XSRF-Token': xsrf}),
        form: opt.form,
    }]);
    if (res.statusCode!=200)
    {
        logger.warn('API call to %s FAILED with status %s', opt.url,
            res.statusCode);
    }
    return res;
});

E.prototype.sync_config_file = etask._fn(function*mgr_sync_config(_this){
    yield _this.api_request({
        url: `${_this._defaults.api}/update_lpm_config`,
        method: 'POST',
        form: {config: {proxies: _this.proxies.slice(0, 20),
            defaults: _.omit(_this._defaults, 'zones')}},
    });
});

E.prototype.sync_recent_stats = etask._fn(function*mgr_sync_stats(_this){
    yield _this.api_request({
        url: `${_this._defaults.api}/update_lpm_stats`,
        method: 'POST',
        form: {stats: _this.loki.stats_get()},
    });
});

E.prototype.stats_get_api = function(req, res){
    const stats = this.loki.stats_get();
    const enable = !!Object.values(this.proxy_ports)
        .filter(p=>!p.config.ssl && p.config.port!=22225).length;
    let _https;
    if (!(_https = stats.protocol.find(p=>p.key=='https')))
        stats.protocol.push({key: 'https', out_bw: 0, in_bw: 0, reqs: 0});
    else if (_https.reqs>0)
        stats.ssl_warning = enable;
    stats.ssl_enable = enable;
    const stats_ports = this.loki.stats_group_by('port', 0);
    const ports = stats_ports.reduce((acc, el)=>
        Object.assign({}, acc, {[el.key]: el}), {});
    res.json(Object.assign({ports}, stats));
};

E.prototype.add_www_whitelist_ip_api = function(req, res){
    let ip;
    if (!(ip=req.body.ip))
        return res.status(400).send('You need to pass an IP to add\n');
    try { ip = new Netmask(ip).base; }
    catch(e){ return res.status(422).send('Wrong format\n'); }
    this.set_www_whitelist_ips((
        this._defaults.www_whitelist_ips||[]).concat(ip));
    this.config.save();
    res.send('OK');
};

E.prototype.add_wip_api = function(req, res){
    const token_auth = this._defaults.token_auth;
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
    const new_ips = [...new Set(this._defaults.whitelist_ips).add(ip)];
    this.set_whitelist_ips(new_ips);
    this.config.save();
    res.send('OK');
};

E.prototype.authenticate = function(req, res, next){
    const whitelist_blocks = [
        ...this._defaults.www_whitelist_ips||[],
        ...this.mgr_opts.www_whitelist_ips||[],
        '127.0.0.1',
    ].map(wl=>{
        try {
            return new Netmask(wl);
        } catch(e){}
    }).filter(Boolean);
    const empty = !this._defaults || !this._defaults.password &&
        !this.proxies.map(p=>p.password).filter(Boolean).length;
    const is_whitelisted = empty || whitelist_blocks.some(wb=>{
        try {
            return wb.contains(req.ip);
        } catch(e){ return false; }
    });
    if (!is_whitelisted && !['/version', '/add_wip'].includes(req.url))
    {
        res.status(403);
        res.set('x-lpm-block-ip', req.ip);
        this.pending_www_ips.add(req.ip);
        return void res.send(`Connection from your IP is forbidden. If you`
            +` want to access this site ask the administrator to add`
            +` ${req.ip} to the whitelist. for more info visit`
            +` https://luminati.io/faq#lpm_whitelist_admin`);
    }
    const cookies = cookie.parse(req.headers.cookie||'');
    const passwd = Array.isArray(this._defaults.password) ?
        this._defaults.password[0] : this._defaults.password;
    const is_local_authenticated = !this.argv.local_login ||
        passwd && cookies['local-login']==passwd;
    if (!is_local_authenticated && !['/version', '/creds_user', '/defaults',
        '/node_version', '/last_version', '/conn', '/all_locations',
        '/last_version'].includes(req.url))
    {
        res.status(403);
        res.set('x-lpm-local-login', 'Unauthorized');
        return void res.send('This LPM instance is running in local_login'
            +' mode. You need to log in to get an access to this resource');
    }
    next();
};

E.prototype._api = function(f){
    const _this = this;
    return (req, res, next)=>etask(function*mgr__api(){
        this.finally(()=>{
            if (this.error)
            {
                logger.warn('API error: %s %s %s', req.method,
                    req.originalUrl, zerr.e2s(this.error));
                return next(this.error);
            }
        });
        // XXX krzysztof: to check and remove. it does nothing?
        const json = res.json.bind(res);
        res.json = o=>json(o);
        yield f.call(_this, req, res, next);
    });
};

E.prototype.create_api_interface = function(){
    const app = express();
    app.use(this.authenticate.bind(this));
    app.get('/swagger', this._api((req, res)=>res.json(swagger)));
    app.get('/consts', this._api(this.get_consts_api));
    app.get('/defaults', this._api((req, res)=>res.json(this.opts)));
    app.get('/version', this._api((req, res)=>res.json(
        {version: pkg.version, argv: this.get_params().join(' ')})));
    app.get('/last_version', this._api(this.last_version_api));
    app.get('/node_version', this._api(this.node_version_api));
    app.get('/mode', this._api((req, res)=>
        res.json({logged_in: this.logged_in})));
    app.get('/conn', this._api((req, res)=>res.json(this.conn)));
    app.put('/api_url', this._api(this.api_url_update_api));
    app.get('/proxies_running', this._api(this.proxies_running_get_api));
    app.get('/proxies', this._api((req, res)=>res.json(this.proxies)));
    app.post('/proxies', this._api(this.proxy_create_api));
    app.post('/proxies/delete', this._api(this.proxies_delete_api));
    app.put('/proxies/:port', this._api(this.proxy_update_api));
    app.delete('/proxies/:port', this._api(this.proxy_delete_api));
    app.post('/proxy_dup', this._api(this.proxy_dup_api));
    app.post('/proxies/:port/banip', this._api(this.proxy_banip_api));
    app.post('/proxies/:port/banips', this._api(this.proxy_banips_api));
    app.post('/proxies/:port/unbanip', this._api(this.proxy_unbanip_api));
    app.delete('/proxies/:port/banip',
        this._api(this.proxy_unbanip_delete_api));
    app.get('/banlist/:port', this._api(this.get_banlist_api));
    app.post('/banip', this._api(this.banip_api));
    app.get('/sessions/:port', this._api(this.get_sessions_api));
    app.post('/refresh_sessions/:port', this._api(this.refresh_sessions_api));
    app.get('/refresh_sessions/:port', this._api(this.refresh_sessions_api));
    app.get('/proxies/:port/link_test.json', this._api(this.link_test_api));
    app.post('/proxies/:port/link_test.json', this._api(this.link_test_api));
    app.post('/proxy_check/:port', this._api(this.proxy_check_api));
    app.get('/proxy_status/:port', this._api(this.proxy_status_get_api));
    app.get('/browser/:port', this._api(this.open_browser_api));
    app.get('/logs', this._api(this.logs_get_api));
    app.get('/logs_har', this._api(this.logs_har_get_api));
    app.post('/logs_resend', this._api(this.logs_resend_api));
    app.get('/logs_suggestions', this._api(this.logs_suggestions_api));
    app.get('/logs_reset', this._api(this.logs_reset_api));
    app.get('/settings', this._api((req, res)=>res.json(this.get_settings())));
    app.put('/settings', this._api(this.update_settings_api));
    app.post('/creds_user', this._api(this.creds_user_api));
    app.post('/verify_two_step', this._api(this.verify_two_token_api));
    app.post('/send_two_step_email', this._api(this.send_two_step_email_api));
    app.get('/gen_token', this._api(this.gen_token_api));
    app.get('/config', this._api(this.config_get_api));
    app.post('/config', this._api(this.config_set_api));
    app.post('/config_check', this._api(this.config_check_api));
    app.post('/refresh_zones', this._api(this.refresh_zones_api));
    app.get('/allocated_ips', this._api(this.allocated_ips_get_api));
    app.get('/allocated_vips', this._api(this.allocated_vips_get_api));
    app.post('/refresh_ips', this._api(this.refresh_ips_api));
    app.post('/refresh_vips', this._api(this.refresh_vips_api));
    app.post('/shutdown', this._api(this.shutdown_api));
    app.post('/logout', this._api(this.logout_api));
    app.post('/upgrade', this._api(this.upgrade_api));
    app.post('/restart', this._api(this.restart_api));
    app.get('/all_locations', this._api(this.get_all_locations_api));
    app.get('/all_carriers', this._api(this.get_all_carriers_api));
    app.post('/test/:port', this._api(this.proxy_tester_api));
    app.post('/trace', this._api(this.link_test_ui_api));
    app.get('/recent_stats', this._api(this.stats_get_api));
    app.post('/report_bug', this._api(this.report_bug_api));
    app.post('/update_notifs', this._api(this.update_notifs_api));
    app.post('/enable_ssl', this._api(this.enable_ssl_api));
    app.post('/update_ips', this._api(this.update_ips_api));
    app.get('/zones', this._api(this.get_zones_api));
    app.use('/tmp', express.static(Tracer.screenshot_dir));
    app.post('/add_whitelist_ip', this._api(this.add_www_whitelist_ip_api));
    app.post('/add_wip', this._api(this.add_wip_api));
    app.post('/react_error', this._api(this.react_error_api));
    app.post('/emit_ws', this._api(this.emit_ws_api));
    app.post('/async_req/:port', this._api(this.async_req_api));
    app.get('/refresh_cost', this._api(this.get_refresh_cost));
    return app;
};

E.prototype.create_web_interface = etask._fn(
function*mgr_create_web_interface(_this){
    const app = express();
    const server = http.Server(app);
    http_shutdown(server);
    const main_page = _this._api((req, res, next)=>{
        res.header('Cache-Control',
            'private, no-cache, no-store, must-revalidate');
        res.header('Expires', '-1');
        res.header('Pragma', 'no-cache');
        res.sendFile(path.join(__dirname+'/../bin/pub/index.html'));
    });
    app.use(compression());
    app.use(body_parser.urlencoded({extended: true, limit: '2mb'}));
    app.use(body_parser.json({limit: '2mb'}));
    app.use('/api', _this.create_api_interface());
    app.get('/ssl', _this._api((req, res)=>{
        res.set('content-type', 'application/x-x509-ca-cert');
        res.set('content-disposition', 'filename=luminati.crt');
        res.send(ssl.ca.cert);
    }));
    app.get('/', main_page);
    app.use(express.static(path.resolve(__dirname, '../bin/pub')));
    app.get('*', main_page);
    app.use(function(err, req, res, next){
        logger.error(zerr.e2s(err));
        res.status(500).send('Server Error');
    });
    server.on('error', err=>_this.error_handler('WWW', err));
    server.stop = force=>etask(function*mgr_server_stop(){
        const stop_method = force ? '.forceShutdown' : '.shutdown';
        return yield etask.nfn_apply(server, stop_method, []);
    });
    yield etask.cb_apply(server, '.listen', [_this.argv.www,
        util_lib.find_iface(_this.argv.iface)||'0.0.0.0']);
    const port = server.address().port;
    let address = server.address().address;
    if (address == '0.0.0.0')
        address = '127.0.0.1';
    server.url = `http://${address}:${port}`;
    swagger.host = `${address}:${port}`;
    return server;
});

E.prototype.init_proxies = etask._fn(function*mgr_init_proxies(_this){
    const proxies = _this.proxies.map(c=>_this.create_proxy(c));
    yield etask.all(proxies);
});

const zones_from_conf = config=>{
    if (!config._defaults || !config._defaults.zones)
        return [];
    return Object.keys(config._defaults.zones).map(zone_name=>{
        const zone = config._defaults.zones[zone_name];
        return {
            zone: zone_name,
            perm: get_perm(zone),
            plan: zone.plan,
            password: (zone.password||[])[0],
        };
    });
};

E.prototype.logged_update = etask._fn(function*mgr_logged_update(_this, ua){
    if (!_this._defaults.customer)
        return _this.logged_in = false;
    try {
        const conf = yield _this.get_lum_local_conf(null, null);
        _this.zones = zones_from_conf(conf);
        _this.update_proxies();
        _this.logged_in = true;
        yield _this.first_lpm_action('login', ua);
    } catch(e){
        if (!e.status)
            throw e;
        _this._defaults.token = '';
        const jarpath = _this.argv.cookie;
        if (fs.existsSync(jarpath))
            fs.writeFileSync(jarpath, '');
        _this.luminati_jar = undefined;
        _this.logged_in = false;
    }
    return _this.logged_in;
});

E.prototype.retry_failed_first_actions = etask._fn(
function*mgr_retry_failed_first_actions(_this){
    const pending = _this.first_actions.pending.slice();
    for (const data of pending)
        yield _this.first_lpm_action(data.action, data.ua, true);
});

E.prototype.has_created_proxy_port = function(){
    return Object.values(this.proxy_ports).some(p=>
        p.opt.proxy_type=='persist');
};

E.prototype.first_lpm_action = etask._fn(
function*mgr_first_lpm_action(_this, action, ua, no_retry){
    if (!_this.logged_in || _this.first_actions.sent[action] ||
        _this.first_actions.sending[action] || action == 'create_proxy_port' &&
        _this.first_actions.sent.create_proxy_port_def)
    {
        return;
    }
    _this.first_actions.sending[action] = 1;
    const pending = _this.first_actions.pending.find(d=>d.action == action);
    if (pending)
        ua = pending.ua;
    const proxy_port_not_sent =
        !_this.first_actions.sent.create_proxy_port &&
        !_this.first_actions.pending.find(
            d=>d.action.startsWith('create_proxy_port'));
    if (action == 'send_request' && proxy_port_not_sent)
    {
        if (_this.has_created_proxy_port())
            yield _this.first_lpm_action('create_proxy_port', ua);
        else
            yield _this.first_lpm_action('create_proxy_port_def', ua);
    }
    if (action=='login' && proxy_port_not_sent &&
        _this.has_created_proxy_port())
    {
        yield _this.first_lpm_action('create_proxy_port', ua);
    }
    try {
        const browser = user_agent.guess_browser(ua).browser||null;
        yield _this.perr(`first_${action}`, {
            customer: _this._defaults.customer,
            country: _this.current_country,
            docker: +!!process.env.DOCKER,
            browser,
        });
        _this.first_actions.sent[action] = 1;
        _this.first_actions.pending =
            _this.first_actions.pending.filter(d=>d.action != action);
        if (!no_retry)
            yield _this.retry_failed_first_actions();
    } catch(e){
        if (!_this.first_actions.sent[action] &&
            !_this.first_actions.pending.find(d=>d.action == action))
        {
            _this.first_actions.pending.push({action, ua, msg: e.message});
        }
    }
    delete _this.first_actions.sending[action];
    _this.save_first_actions();
});

E.prototype.get_cookie_jar = function(){
    const jarpath = this.argv.cookie;
    if (!jarpath)
        return cookie_jar = cookie_jar||request.jar();
    if (!fs.existsSync(jarpath))
        fs.writeFileSync(jarpath, '');
    try { return request.jar(new cookie_filestore(jarpath)); }
    catch(e){
        logger.warn('Error accessing cookie jar: '+zerr.e2s(e));
        fs.unlinkSync(jarpath);
        fs.writeFileSync(jarpath, '');
    }
    try { return request.jar(new cookie_filestore(jarpath)); }
    catch(e){ return request.jar(); }
};

E.prototype.verify_two_token_api = etask._fn(
function*verify_two_token_api(_this, req, res){
    const response = yield _this.api_request({
        method: 'POST',
        url: `${_this._defaults.api}/users/auth/two_step/verify_token`,
        form: {token: req.body.token},
        force: true,
    });
    if ([200, 204].includes(response.statusCode))
        return res.sendStatus(200);
    if (response.body == 'token expired')
        yield _this.send_two_step_email();
    res.status(response.statusCode).send(response.body);
});

E.prototype.send_two_step_email_api = etask._fn(
function*send_two_step_email_api(_this, req, res){
    yield _this.send_two_step_email();
    res.sendStatus(200);
});

E.prototype.send_two_step_email = etask._fn(
function*mgr_send_two_step_email(_this){
    return yield _this.api_request({
        method: 'POST',
        url: `${_this._defaults.api}/users/auth/two_step/send_email`,
        force: true,
    });
});

E.prototype.get_lum_local_conf = etask._fn(
function*mgr_get_lum_local_conf(_this, customer, token){
    this.on('uncaught', e=>{
        if (!e.status)
            logger.error('get_lum_local_conf: '+e.message);
    });
    customer = customer || _this._defaults.customer;
    token = token || _this._defaults.token;
    if (!_this.lum_conf)
        _this.lum_conf = {};
    if (!_this.luminati_jar)
        _this.luminati_jar = {jar: _this.get_cookie_jar()};
    const _cookie = !!token ||
        (_this.luminati_jar.jar.getCookies(_this._defaults.api)||[])
        .some(c=>c && c.value && c.expires>=Date.now());
    if (!_cookie)
        throw {status: 403};
    let config = yield etask.nfn_apply(request, [{
        qs: {customer, token, no_save: !_this.logged_in},
        url: `${_this._defaults.api}/cp/lum_local_conf?`
            +lpm_config.hola_agent.split(' ')[0],
        jar: _this.luminati_jar.jar,
        headers: {'user-agent': util_lib.user_agent},
    }]);
    if (config.statusCode==403 && config.body &&
        config.body.startsWith('You have not signed'))
    {
        throw {status: 403, message: config.body};
    }
    if (config.statusCode==403 &&
        config.body=='2-Step Verification not verified')
    {
        throw {status: 403, body: {ask_two_step: true}};
    }
    if (config.statusCode!=200)
    {
        config = yield etask.nfn_apply(request, [{
            qs: {token, no_save: !_this.logged_in},
            url: `${_this._defaults.api}/cp/lum_local_conf?`
                +lpm_config.hola_agent.split(' ')[0],
            jar: _this.luminati_jar.jar,
            headers: {'user-agent': util_lib.user_agent},
        }]);
    }
    if (config.statusCode!=200)
    {
        _this.use_local_lum_conf = true;
        if (config.body=='2-Step Verification not verified')
            throw {status: 403, body: {ask_two_step: true}};
        throw {status: config.statusCode, message: config.body};
    }
    _this.use_local_lum_conf = false;
    _this.lum_conf = JSON.parse(config.body);
    if (token)
        _this._defaults.token = token;
    return _this.lum_conf;
});

E.prototype.login_user = etask._fn(
function*mgr_login_user(_this, token, username, password, customer){
    let config;
    let login_failed;
    try {
        config = yield _this.get_lum_local_conf(customer, token);
    } catch(e){
        if (!e.status)
            throw e;
        login_failed = true;
    }
    if (config && !config.customers)
        return {defaults: config._defaults};
    if (login_failed)
    {
        const jar = _this.luminati_jar.jar;
        yield etask.nfn_apply(request, [{url: _this._defaults.api, jar: jar}]);
        const xsrf = jar.getCookies(_this._defaults.api)
            .find(e=>e.key=='XSRF-TOKEN')||{};
        const headers = {
            'X-XSRF-Token': xsrf.value,
            'user-agent': util_lib.user_agent,
        };
        const response = yield etask.nfn_apply(request, [{
            method: 'POST',
            url: `${_this._defaults.api}/users/auth/basic/check_credentials`,
            jar,
            headers,
            form: {username, password},
        }]);
        if (response.statusCode!=200)
        {
            if (response.body=='not_registered')
            {
                return {error: {
                    message: `The email address is not registered. `
                        +`If you signed up with Google signup button, you`
                        +` should login with Google login button.`
                        +` <a href="${_this.opts.www_api}/?need_signup=1"`
                        +` target=_blank>`
                        +`Click here to sign up.</a>`,
                }};
            }
            else if (response.body=='unauthorized')
            {
                return {error: {
                    message: `The password is incorrect. `
                        +`<a href="${_this.opts.www_api}/forgot_password`
                        +`?email=${encodeURIComponent(username)}" `
                        +`target=_blank>`
                        +`Forgot your password?</a>`,
                }};
            }
            return {error: {
                message: 'Something went wrong. Please contact support.',
            }};
        }
        // needed to get get correct session and apply 2-Step requirements
        const login_resp = yield etask.nfn_apply(request, [{
            url: `${_this._defaults.api}/users/auth/basic/login`,
            jar,
            headers,
        }]);
        if (login_resp.statusCode != 200)
            return {error: {message: login_resp.body}};
        _this.luminati_jar = {jar, username, password};
        try {
            config = yield _this.get_lum_local_conf(customer, token);
        } catch(e){
            if (!e.status)
                throw e;
            if (e.status==403)
            {
                if (e.message=='Your account is not active' || e.message
                    && e.message.startsWith('No customer'))
                {
                    try {
                        delete _this._defaults.customer;
                        config = yield _this.get_lum_local_conf(null, token);
                        customer = null;
                    } catch(e){
                        if (customer)
                            _this._defaults.customer = customer;
                    }
                }
                if (e.body)
                    return {body: e.body};
            }
            if (!config && e.status!=200)
            {
                let message = e.message ||
                    'Something went wrong. Please contact support.';
                if (message=='Your account is not active')
                {
                    message = `Your account is disabled.`
                    +`<a href='${_this.opts.www_api}/cp/billing'>`
                    +`Click here to change your account status</a>`;
                }
                return {error: {message}};
            }
        }
    }
    if (customer && !config._defaults)
    {
        yield _this.logout();
        return {error: {message: 'You don\'t have any zone enabled'}};
    }
    if (customer)
    {
        yield etask.nfn_apply(request, [{
            method: 'POST',
            url: `${_this._defaults.api}/api/whitelist/add`
                +(token ? '?token='+token : ''),
            jar: _this.luminati_jar && _this.luminati_jar.jar,
            json: true,
            body: {customer, zone: config._defaults.zone},
            headers: {'user-agent': util_lib.user_agent},
        }]);
    }
    return !customer && config.customers.length>1 ?
        {customers: config.customers.sort()} : {defaults: config._defaults};
});

E.prototype.get_ip = etask._fn(function*mgr_set_location(_this){
    _this.opts.www_api = 'https://luminati.io';
    const res = yield etask.nfn_apply(request, [{
        url: 'http://lumtest.com/myip.json',
        json: true,
        timeout: 20*date.ms.SEC,
        headers: {'user-agent': util_lib.user_agent},
    }]);
    _this.current_country = (res.body.country||'').toLowerCase();
    if (!_this.current_country || _this.current_country=='cn')
        _this.opts.www_api = 'https://'+pkg.api_domain;
    _this.opts.current_ip = res.body.ip;
});

E.prototype.check_domain = etask._fn(function*mgr_check_domain(_this){
    const jar = _this.get_cookie_jar();
    const _url = `${_this._defaults.api}/lpm_config.json?ver=${pkg.version}`;
    try {
        const res = yield etask.nfn_apply(request, [{
            url: _url,
            jar,
            timeout: 10*date.ms.SEC,
            headers: {'user-agent': util_lib.user_agent},
        }]);
        return res.statusCode==200;
    } catch(e){
        logger.error('could not access %s: %s', _this._defaults.api,
            e.message);
        return false;
    }
});

E.prototype.check_internet = etask._fn(function*mgr_check_internet(_this){
    try { yield etask.nfn_apply(request, [{
        url: 'http://1.1.1.1',
        timeout: 10*date.ms.SEC,
    }]); }
    catch(e){ return false; }
    return true;
});

E.prototype.check_conn = etask._fn(function*mgr_check_conn(_this){
    const internet = yield _this.check_internet();
    const domain = yield _this.check_domain();
    _this.conn = {domain, internet, current_country: _this.current_country};
});

E.prototype.run_cluster = function(){
    const cores = os.cpus().length;
    const num_workers = this.argv.cluster===true ?
        cores : Number(this.argv.cluster)||1;
    logger.notice('Master cluster setting up '+num_workers+' workers');
    cluster.setupMaster({exec: __dirname+'/worker.js'});
    for (let i=0; i<num_workers; i++)
    {
        const worker = cluster.fork();
        worker.setMaxListeners(0);
    }
    cluster.on('online', worker=>{ });
};

E.prototype.start = etask._fn(function*mgr_start(_this){
    this.on('uncaught', e=>logger.error('start %s', zerr.e2s(e)));
    try {
        perr.run();
        yield _this.get_ip();
        yield _this.check_conn();
        // XXX krzysztof: to remove check here
        _this.config.check({_defaults: _this.argv, proxies: _this.proxies});
        if (_this.argv.www && !_this.argv.high_perf)
            yield _this.loki.prepare();
        _this.zones = [];
        yield _this.logged_update();
        yield _this.retry_failed_first_actions();
        yield _this.sync_recent_stats();
        yield _this.sync_config_file();
        _this.run_cluster();
        yield _this.init_proxies();
        yield cities.ensure_data();
        if (_this.argv.www)
        {
            if (!_this.argv.high_perf)
                _this.start_web_socket();
            _this.www_server = yield _this.create_web_interface();
            _this.emit('www_ready', _this.www_server.url);
            print_ui_running(_this.www_server.url);
            if (is_pkg)
                yield open(`http://127.0.0.1:${_this.argv.www}`);
        }
        _this.start_auto_update();
        _this.perr('start_success');
        // os.cpu_usage and os.meminfo are broken for MacOS
        if (lpm_config.is_win || is_darwin)
            return;
        // reset previous CPU usage reads
        zos.cpu_usage();
        _this.run_stats_reporting();
        _this.run_cpu_usage_monitoring();
    } catch(e){
        etask.ef(e);
        if (e.message!='canceled')
        {
            logger.error('start error '+zerr.e2s(e));
            _this.perr('start_error', {}, {error: e});
        }
        throw e;
    }
});

const print_ui_running = _url=>{
    if (global.it)
        return;
    const boxed_line = (str=null, repeat=50)=>{
        const box = '=';
        if (!str)
            str = box.repeat(repeat-2);
        const ws = Math.max(0, (repeat-2-str.length)/2);
        const ws1 = ' '.repeat(Math.ceil(ws));
        const ws2 = ' '.repeat(Math.floor(ws));
        return `${box}${ws1}${str}${ws2}${box}`;
    };
    logger.notice([
        `Local proxy manager client is running`,
        boxed_line(),
        boxed_line(' '),
        boxed_line(' '),
        boxed_line('Open admin browser:'),
        boxed_line(_url),
        boxed_line(' '),
        boxed_line(' '),
        boxed_line('Do not close the process while using the'),
        boxed_line('Proxy Manager                           '),
        boxed_line(' '),
        boxed_line(' '),
        boxed_line(),
    ].join('\n'));
};

E.prototype.start_web_socket = function(){
    this.wss = new web_socket.Server({port: this.argv.ws});
    this.wss.broadcast = function(data, type){
        data = JSON.stringify({data, type});
        this.clients.forEach(function(client){
            if (client.readyState===web_socket.OPEN)
                client.send(data);
        });
    };
};

E.prototype.emit_ws_api = function(req, res){
    if (!this.wss)
        res.status(400).send('ws does not exist');
    this.wss.broadcast({payload: req.body.payload, path: req.body.path},
        'global');
    res.send('ok');
};

E.prototype.run_stats_reporting = etask._fn(
function*mgr_run_stats_reporting(_this){
    _this.long_running_ets.push(this);
    while (1)
    {
        let stats = {};
        try {
            const cu = zos.cpu_usage();
            const meminfo = zos.meminfo();
            const fd = yield util_lib.count_fd();
            stats = {
                stats: _this.loki.stats_get(),
                mem_usage: Math.round(
                    (meminfo.memtotal-meminfo.memfree_all)/1024/1024),
                mem_usage_p: Math.round(zos.mem_usage()*100),
                cpu_usage_p: Math.round(cu.all*100),
                fd,
            };
        } catch(e){ stats.error = e.message; }
        yield _this.perr('stats_mgr', stats);
        yield _this.perr('features', {features: [..._this.features]});
        _this.features.clear();
        yield etask.sleep(15*date.ms.MIN);
    }
});

E.prototype.run_cpu_usage_monitoring = etask._fn(
function*mgr_run_cpu_usage_monitoring(_this){
    _this.long_running_ets.push(this);
    while (1)
    {
        const usage = Math.round(zos.cpu_usage().all*100);
        const level = usage >= 98 ? 'error' : usage >= 75 ? 'warn' : null;
        if (_this.wss)
            _this.wss.broadcast({usage, level}, 'cpu_usage');
        if (level)
            logger[level]('High CPU usage: '+usage);
        yield etask.sleep(15*date.ms.SEC);
    }
});

E.prototype.get_info = function(){
    const info = {};
    const conf = _.cloneDeep(this._total_conf);
    conf._defaults = _.omit(conf._defaults, 'zones');
    conf.proxies = (conf.proxies||[]).map(p=>_.omit(p, 'zones'));
    info.config = conf;
    if (this._defaults.customer)
        info.customer_name = this._defaults.customer;
    if (conf._defaults && conf._defaults.customer)
        info.customer_name = conf._defaults.customer;
    return info;
};

E.prototype.perr = function(id, info={}, opt={}){
    const _info = Object.assign({}, info, this.get_info());
    if (global.it)
        return;
    return zerr.perr(id, _info, opt);
};

E.prototype.react_error_api = etask._fn(
function*mgr_react_error(_this, req, res){
    const {backtrace, message, stack} = req.body;
    const info = Object.assign({message}, _this.get_info());
    yield zerr.perr('react', info, {backtrace: stack+'\n\n'+backtrace});
    res.send('OK');
});

E.prototype.get_refresh_cost = etask._fn(
function*mgr_get_refresh_cost(_this, req, res){
    const zone = req.query.zone;
    if (!_this.zones.find(z=>z.zone==zone))
        return res.status(400).send('Invalid zone');
    const response = yield _this.api_request({
        url: `${_this._defaults.api}/refresh_cost`, qs: {zone}});
    res.send(response.body);
});
