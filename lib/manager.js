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
const stream = require('stream');
const jos = require('json-object-stream');
const crypto = require('crypto');
const express = require('express');
const compression = require('compression');
const body_parser = require('body-parser');
const open = require('open');
const request = require('request').defaults({gzip: true});
const http = require('http');
const https = require('https');
const util = require('util');
const semver = require('semver');
const {Netmask} = require('netmask');
const prompt = require('prompt-sync')();
const analytics = require('../lib/analytics.js');
const ua = analytics.get_ua();
const log = require('./log.js');
const http_shutdown = require('http-shutdown');
const Luminati = require('./luminati.js');
const ssl = require('./ssl.js');
const find_iface = require('./find_iface.js');
const pkg = require('../package.json');
const swagger = require('./swagger.json');
const zerr = require('../util/zerr.js');
const etask = require('../util/etask.js');
const string = require('../util/string.js');
const file = require('../util/file.js');
const date = require('../util/date.js');
const zos = require('../util/os.js');
const zutil = require('../util/util.js');
const lpm_config = require('../util/lpm_config.js');
const is_win = process.platform=='win32';
const is_darwin = process.platform=='darwin';
const stringify = require('json-stable-stringify');
const cookie_filestore = require('tough-cookie-file-store');
const check_node_version = require('check-node-version');
const cities = require('./cities.js');
const perr = require('./perr.js');
const util_lib = require('./util.js');
const web_socket = require('ws');
const Tracer = require('./tracer.js');
const Loki = require('./loki.js');
const migrate = require('./migration.js');
const Ip_cache = require('./ip_cache.js');
const puppeteer = require('./puppeteer.js');
let posix, cookie_jar;
try {
    require('heapdump');
    posix = require('posix');
} catch(e){}

const qw = string.qw;
const ef = etask.ef;
const assign = Object.assign;
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

// XXX ovidiu: move to common node/browser lib
const get_zone_plan = plans=>{
    const d = date();
    plans = plans||[];
    for (let i=plans.length-1; i>=0; i--)
    {
        if (date(plans[i].start)<=d)
        {
            if (plans[i].end && d>=date(plans[i].end))
                return;
            return plans[i];
        }
    }
};
const get_zone_perm = zone=>{
    const plan = get_zone_plan(zone.plans);
    if (!plan || !plan.type)
        return zone.perm;
    const perm = {
        full: 'country state city g1 cid ip asn carrier pass_ip mobile '+
            'port_all port_whois',
        city: 'country state city vip',
        asn: 'country state asn carrier vip',
        g1: 'country g1 vip',
        static: 'country ip route_all route_dedicated',
        mobile: 'country mobile asn carrier state city vip',
    };
    let res = 'country vip';
    if (plan.type=='static')
        return perm.static;
    if (plan.mobile)
        res = perm.mobile;
    else if (plan.city && plan.asn)
        res = perm.city+' asn carrier';
    else if (plan.city)
        res = perm.city;
    else if (plan.asn)
        res = perm.asn;
    if (plan.vips_type=='domain_p')
        res += ' vip_all';
    if (plan.google_search)
        res += ' google_search';
    return res;
};

E.default = assign({}, lpm_config.manager_default);
const PROXY_INTERNAL_BYPASS = qw`luminati.io ${pkg.api_domain}`;

const sanitize_argv = argv=>{
    argv = argv||{};
    argv.explicit_opt = argv.explicit_opt||{};
    argv.overlay_opt = argv.overlay_opt||{};
    argv._ = argv._||[];
    return argv;
};

function Manager(argv, run_config){
    events.EventEmitter.call(this);
    this.init(argv, run_config);
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
    if (data.context=='SESSION KEEP ALIVE')
        return;
    let url_parts;
    if (url_parts = data.url.match(/^([^/]+?):(\d+)$/))
    {
        data.protocol = url_parts[2]==443 ? 'https' : 'http';
        data.hostname = url_parts[1];
    }
    else
    {
        assign(data, _.pick(url.parse(data.url), qw`protocol hostname`));
        data.protocol = (data.protocol||'https:').slice(0, -1);
    }
    data.success = +(data.status_code && (data.status_code=='unknown' ||
        /([23]..|404)/.test(data.status_code)));
    data.content_type = get_content_type(data);
    if (data.context!='STATUS CHECK' && this._defaults.request_stats &&
        data.url && !data.url.match(/lumtest\.com\/myip\.json/))
    {
        this.loki.stats_process(data);
    }
    this.logs_process(data);
};

E.prototype.handle_abort = function(uuid){
    if (!this.wss)
        return;
    this.wss.broadcast(uuid, 'har_viewer_abort');
};

E.prototype.handle_usage_start = function(data){
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

E.prototype.init = function(argv, run_config){
    this.run_config = run_config||{};
    if (!this.run_config.id)
        this.run_config.id = +new Date();
    this.proxies_running = {};
    this.argv = sanitize_argv(argv);
    this.agents = {
        http: new http.Agent({keepAlive: true, keepAliveMsecs: 5000}),
        https: new https.Agent({keepAlive: true, keepAliveMsecs: 5000,
            servername: argv.proxy}),
    };
    this._log = log(argv.www||'MNGR', argv.log);
    this._log.notice('Manager started %s', pkg.version);
    this.mgr_opts = _.pick(argv, lpm_config.mgr_fields);
    const conf = this._get_proxy_configs();
    this._total_conf = conf;
    this._defaults = conf._defaults;
    this.proxies = conf.proxies;
    this.loki = new Loki(argv.loki, argv.log);
    this.banlist = new Ip_cache();
    this.opts = _.pick(argv, _.keys(lpm_config.proxy_fields));
    // XXX krzysztof: get rid of GA in backend
    if (this.run_config.ua && this._defaults.customer)
    {
        this.run_config.ua.set('uid', this._defaults.customer);
        this.run_config.ua.set('cd1', this._defaults.customer);
    }
    if (!this.run_config.ua && !this.run_config.skip_ga)
    {
        ua.set('an', 'LPM-module');
        ua.set('av', `v${pkg.version}`);
        if (this._defaults.customer)
        {
            ua.set('uid', this._defaults.customer);
            ua.set('cd1', this._defaults.customer);
        }
    }
};

E.prototype.load_json = function(filename){
    let s;
    try {
        s = file.read_e(filename);
        s = s.replace(/^\uFEFF/, '');
        if (!s)
            return {};
        console.log(`\nLoaded config ${filename}`);
        console.log(`Running proxy configurations...`);
    } catch(e){ return {}; }
    try {
        const res = JSON.parse(s);
        return res;
    } catch(e){
        const msg = `Failed parsing json file ${filename}: ${e.message}`;
        console.warn(msg);
        let close = 'y';
        try {
            const question = `Do you want to reset the config file and`
            +` continue?`;
            close = prompt(`${question} [y/N]`);
        } catch(e){
            console.warn('propmpt failed');
            return {};
        }
        if (close=='y')
            return {};
        throw msg;
    }
};

E.prototype._config_from_file = function(fname){
    const conf = this.load_json(fname);
    let proxies = [];
    if (conf.proxies||conf.port)
        proxies = proxies.concat(conf.proxies||conf);
    proxies = proxies.map(c=>assign({proxy_type: 'persist'}, c));
    let _conf = {_defaults: conf._defaults||{}, proxies};
    if (conf._defaults || conf.proxies)
        _conf = migrate(_conf);
    return _conf;
};

E.prototype._get_proxy_configs = function(){
    const _this = this;
    let _defaults = assign({}, _.pick(E.default, lpm_config.default_fields));
    let proxies = [];
    lpm_config.numeric_fields.forEach(f=>{
        if (_this.argv.explicit_opt[f])
            _this.argv.explicit_opt[f] = +_this.argv.explicit_opt[f];
    });
    if (_this.mgr_opts.config)
    {
        const conf = _this._config_from_file(_this.mgr_opts.config);
        assign(_defaults, _.pick(conf._defaults, lpm_config.default_fields));
        proxies = proxies.concat(conf.proxies);
    }
    Luminati.default.request_stats = _this.mgr_opts.request_stats;
    if (qw`port`.some(k=>_this.argv.explicit_opt[k]))
    {
        qw`port`.filter(k=>_this.argv.explicit_opt[k])
        .forEach(k=>{
            proxies.filter(p=>p[k]==_this.argv.explicit_opt[k])
            .forEach((p, i)=>{
                _this._log.warn('Conflict between config Proxy #%s and '
                    +'explicit parameter "--%s %s". Proxy settings will be'
                    +' overridden by explicit parameters.', i, k,
                    _this.argv.explicit_opt[k]);
            });
        });
        let proxy = proxies.find(p=>qw`port`.some(k=>
            _this.argv.explicit_opt[k] && p[k]==_this.argv.explicit_opt[k]));
        if (!proxy)
            proxy = proxies.find(p=>!p.port || p.port==_this.argv.port);
        if (!proxy)
        {
            proxies.push(assign({proxy_type: 'persist'},
                _this.argv.explicit_opt));
        }
        else
        {
            assign(proxy, _this.argv.explicit_opt);
            if (!proxy.port)
                proxy.port = _this.argv.port;
        }
    }
    if (_this.mgr_opts.dropin && _defaults.dropin!==false)
    {
        Luminati.dropin.listen_port = _this.mgr_opts.dropin_port;
        proxies.push(assign({}, Luminati.dropin, _.pick(_defaults,
            qw`zone test_url`)));
    }
    assign(_defaults, _.pick(_this.argv.overlay_opt,
        lpm_config.default_fields));
    if (_this.argv.token)
        assign(_defaults, {token: _this.argv.token});
    const max_port = _this.argv.port||Luminati.default.port;
    const next = (max, key)=>{
        while (proxies.some(p=>p[key]==max))
            max++;
        return max;
    };
    proxies.filter(c=>!c.port)
        .forEach(c=>c.port = c.port||next(max_port, 'port'));
    return {_defaults, proxies};
};

E.prototype.stop_servers = etask._fn(
function*mgr_stop_servers(_this, force, www){
    let servers = [];
    const stop_server = server=>servers.push(etask(function*mgr_stop_server(){
        try {
            yield server.stop(force);
        } catch(e){
            _this._log.error('Failed to stop server: '+e.message+' %O',
                {server: server, error: e});
        }
    }));
    if (www && _this.www_server)
        stop_server(_this.www_server);
    _.values(_this.proxies_running).forEach(stop_server);
    if (_this.wss)
        _this.wss.close();
    yield etask.all(servers);
});

E.prototype.stop = etask._fn(
function*mgr_stop(_this, reason, force, restart){
    _this.is_running = false;
    yield _this.perr(restart ? 'restart' : 'exit', {reason});
    yield _this.loki.save();
    if (reason!='config change')
        yield _this.save_config();
    if (reason instanceof Error)
        reason = zerr.e2s(reason);
    _this._log.notice('Manager stopped %O', {reason, force, restart});
    yield _this.stop_servers(force, true);
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
                    rule: entry.rule,
                },
                startedDateTime: new Date(tl.create).toISOString(),
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
                    _blocked_queueing: 0,
                },
                serverIPAddress: entry.super_proxy,
                comment: entry.username,
            };
        }),
    }};
};

E.prototype.save_config = function(){
    const filename = this.argv.config;
    if (!filename || !_.isString(filename))
        return;
    // XXX krzysztof: reimplement mechanism of defaults. it's a mess
    const proxies = this.proxies
        .filter(p=>p.proxy_type=='persist' && !p.conflict)
        .map(p=>_.omit(p, qw`stats proxy_type zones _update
            www_whitelist_ips request_stats logs conflict version`))
        .map(p=>_.omitBy(p, v=>!v && v!==0 && v!==false))
        .map(p=>_.omitBy(p, (v, k)=>{
            if (Array.isArray(v)&&!v.length)
                return true;
            const def = _.omit(this._defaults, 'zone')[k];
            if (typeof v=='object')
                return _.isEqual(v, def);
            return v===def;
        })).map(p=>_.omitBy(p, (v, k)=>v===E.default[k]))
        .map(p=>{
            if (p._vips)
            {
                p.vips = p._vips;
                delete p._vips;
            }
            if (p._ips)
            {
                p.ips = p._ips;
                delete p._ips;
            }
            return p;
        });
    const _defaults = _(this._defaults)
    .pick(lpm_config.default_fields.filter(f=>f!='config'))
    .omitBy((v, k)=>{
        if (typeof v=='object')
            return _.isEqual(v, E.default[k]);
        return v===E.default[k];
    });
    const s = stringify({proxies, _defaults}, {space: '  '});
    if (fs.existsSync(filename))
        fs.renameSync(filename, filename+'.backup');
    fs.writeFileSync(filename, s);
};

E.prototype.get_password = etask._fn(
function*mgr_get_password(_this, proxy, zone_name){
    try {
        if (proxy.password)
            return proxy.password;
        const zones = yield _this.get_zones();
        const zone = zones.find(z=>z.zone==zone_name);
        return zone && zone.password || _this.argv.password ||
            _this._defaults.password;
    } catch(e){
        _this._log.warn('could not fetch password for zone %s', zone_name);
        return 'xyz';
    }
});

E.prototype.get_zones = etask._fn(function*mgr_get_zones(_this){
    const config = yield _this.get_lum_local_conf();
    if (!config._defaults || !config._defaults.zones)
        return [];
    return _.map(config._defaults.zones, (v, k)=>{
        return {zone: k, perm: get_zone_perm(v), plans: v.plans,
            password: (v.password||[])[0]};
    });
});

E.prototype.get_zones_api = etask._fn(
function*mgr_get_zones_api(_this, req, res){
    const zones = (yield _this.get_zones()).map(z=>({
        name: z.zone,
        perm: z.perm,
        plan: z.plans&&z.plans.slice(-1)[0]||{},
        password: z.password,
    })).filter(p=>p.plan && !p.plan.disable);
    res.json({zones, def: _this._defaults.zone});
});

E.prototype.get_consts_api = etask._fn(
function*mgr_get_consts(_this, req, res){
    const proxy = _.mapValues(lpm_config.proxy_fields, desc=>({desc}));
    _.forOwn(E.default, (def, prop)=>{
        if (proxy[prop])
            proxy[prop].def = def;
    });
    if (proxy.zone)
        proxy.zone.def = _this._defaults.zone;
    _.merge(proxy, {dns: {values: ['', 'local', 'remote']}});
    const ifaces = Object.keys(os.networkInterfaces())
    .map(iface=>({key: iface, value: iface}));
    ifaces.unshift({key: 'All', value: '0.0.0.0'});
    ifaces.unshift({key: 'Default (dynamic)', value: ''});
    proxy.iface.values = ifaces;
    const zones = (yield _this.get_zones())
    .map(z=>assign({key: z.zone, value: z.zone, plans: []}, z));
    zones.unshift({key: `Default (${proxy.zone.def})`, value: ''});
    proxy.zone.values = zones;
    const notifs = _this.lum_conf.lpm_notifs||[];
    const logins = _this.lum_conf.logins||[];
    res.json({proxy, notifs, logins});
});

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
    const vips = (req.body.vips||[]).map(Number);
    const proxy = _this.proxies.find(p=>p.port==req.body.port);
    yield _this.proxy_update(proxy, Object.assign(proxy, {ips, vips}));
    res.send('ok');
});

E.prototype.update_notifs_api = etask._fn(
function*mgr_update_notif(_this, req, res){
    _this.lum_conf.lpm_notifs = _this.lum_conf.lpm_notifs||[];
    const notifs = req.body.notifs;
    notifs.forEach(updated_notif=>{
        const stored_notif = _this.lum_conf.lpm_notifs.find(
            n=>n._id==updated_notif.id);
        if (stored_notif)
            stored_notif.status = updated_notif.status;
    });
    const jar = _this.luminati_jar.jar;
    yield etask.nfn_apply(request, [{url: _this._defaults.api, jar}]);
    const xsrf = (jar.getCookies(_this._defaults.api).find(e=>
        e.key=='XSRF-TOKEN')||{}).value;
    const response = yield etask.nfn_apply(request, [{
        method: 'POST',
        url: `${_this._defaults.api}/update_lpm_notifs`,
        qs: assign(_.pick(_this._defaults, qw`customer token`)),
        jar,
        json: true,
        headers: {'X-XSRF-Token': xsrf},
        form: {notifs},
    }]);
    res.json(response.body);
});

E.prototype.send_rule_mail = etask._fn(
function*mgr_send_rule_mail(_this, port, to, _url){
    const jar = _this.luminati_jar.jar;
    yield etask.nfn_apply(request, [{url: _this._defaults.api, jar}]);
    const xsrf = (jar.getCookies(_this._defaults.api).find(e=>
        e.key=='XSRF-TOKEN')||{}).value;
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
    const response = yield etask.nfn_apply(request, [{
        method: 'POST',
        url: `${_this._defaults.api}/send_rule_mail`,
        qs: assign(_.pick(_this._defaults, qw`customer token`)),
        jar,
        json: true,
        headers: {'X-XSRF-Token': xsrf},
        form: {to, subject, text},
    }]);
    return response.body;
});

E.prototype.report_bug_api = etask._fn(
function*mgr_report_bug(_this, req, res){
    let config_file = '', log_file = '';
    if (file.exists(_this.argv.config))
    {
        const buffer = fs.readFileSync(_this.argv.config);
        config_file = buffer.toString('base64');
    }
    const slash = process.platform=='win32' ? '\\' : '/';
    const log_path = log.log_dir+slash+log.log_file;
    if (file.exists(log_path))
    {
        let buffer = fs.readFileSync(log_path);
        buffer = buffer.slice(buffer.length-50000);
        log_file = buffer.toString('base64');
    }
    const jar = _this.luminati_jar.jar;
    const result = _this.filtered_get({query: {limit: 100}});
    const har = JSON.stringify(_this.har(result.items));
    yield etask.nfn_apply(request, [{url: _this._defaults.api, jar}]);
    const xsrf = (jar.getCookies(_this._defaults.api).find(e=>
        e.key=='XSRF-TOKEN')||{}).value;
    const response = yield etask.nfn_apply(request, [{
        method: 'POST',
        url: `${_this._defaults.api}/report_bug`,
        qs: assign(_.pick(_this._defaults, qw`customer token`)),
        jar,
        json: true,
        headers: {'X-XSRF-Token': xsrf},
        form: {report: {config: config_file, log: log_file, har,
            desc: req.body.desc, lpm_v: pkg.version, os: os.platform(),
            browser: req.body.browser, email: req.body.email}},
    }]);
    res.json(response.body);
});

E.prototype.proxy_validator = function(conf){
    conf.customer = conf.customer||this._defaults.customer;
    conf.proxy_count = conf.proxy_count||this.argv.proxy_count;
    conf.proxy = [].concat(conf.proxy||this.argv.proxy);
    if (conf.whitelist_ips && conf.whitelist_ips.length>0)
    {
        conf.whitelist_ips = conf.whitelist_ips
        .map(ip=>{
            try {
                const _ip = new Netmask(ip);
                const mask = _ip.bitmask==32 ? '' : '/'+_ip.bitmask;
                return _ip.base+mask;
            } catch(e){ return null; }
        }).filter(ip=>ip!==null && ip!='127.0.0.1');
        if (conf.whitelist_ips.length)
            conf.whitelist_ips.push('127.0.0.1');
    }
    lpm_config.numeric_fields.forEach(field=>{
        if (conf[field])
            conf[field] = +conf[field];
    });
};

E.prototype.error_handler = function error_handler(source, err){
    if (!err.raw)
        this._log.error(source+' error '+zerr.e2s(err));
    err.source = source;
    this.emit('error', err);
};

E.prototype._handle_mobile_perm = function(c){
    const zone = this._get_proxy_zone(c);
    if (zone)
        c.mobile = !!(get_zone_perm(zone)||'').includes('mobile');
    else
        c.mobile = false;
};

E.prototype._get_proxy_zone = function(c){
    const zones = ((this.lum_conf||{})._defaults||{}).zones;
    return zones&&zones[c.zone];
};

E.prototype._complete_proxy_config = function(conf){
    let c = assign({current_ip: this.opts.current_ip}, E.default,
        this._defaults, conf, _.omit(this.argv.overlay_opt, 'password'));
    let zone = c.zones&&c.zones[c.zone];
    let zone_plan = zone && get_zone_plan(zone.plans);
    c.unblock = !!(zone_plan&&zone_plan.unblocker);
    delete c.zones;
    if (this.argv.request_stats)
        delete c.request_stats;
    this._handle_mobile_perm(c);
    return c;
};

E.prototype.create_single_proxy = etask._fn(
function*mgr_create_single_proxy(_this, conf){
    conf = _this._complete_proxy_config(conf);
    const server = new Luminati(conf, _this);
    server.on('error', err=>{
        if (err.code=='EADDRINUSE')
            return _this.emit('error', err);
        _this.error_handler('Proxy '+conf.port, err);
    });
    _this._log.notice('Starting proxies %s', conf.port);
    yield server.listen();
    _this.proxies_running[server.opt.listen_port] = server;
    if (conf._update)
    {
        setImmediate(()=>{
            const proxy = _this.proxies.find(p=>p.port==conf.port);
            _this.proxy_update(proxy, proxy);
        });
    }
    return server;
});

E.prototype.create_proxy = etask._fn(
function*mgr_create_proxy(_this, proxy){
    if (proxy.conflict)
    {
        _this._log.error('Port %s is already in use by %s - skipped',
            proxy.port, proxy.conflict);
        return null;
    }
    delete proxy._update;
    proxy = assign({}, _.omit(_this._defaults, qw`zones password`),
        _.omitBy(proxy, v=>!v && v!==0 && v!==false));
    const conf = assign({
        proxy_internal_bypass: PROXY_INTERNAL_BYPASS,
        handle_usage_start: _this.handle_usage_start.bind(_this),
        handle_usage: _this.handle_usage.bind(_this),
        handle_abort: _this.handle_abort.bind(_this),
    }, proxy);
    // XXX krzysztof: check if it's needed
    if (_this.argv.request_stats)
        delete conf.request_stats;
    _this.proxy_validator(conf);
    conf.password = yield _this.get_password(proxy, conf.zone);
    proxy.password = conf.password;
    const proxies = yield _this._multiply_port(conf);
    const servers = yield etask.all(proxies.map(
        c=>_this.create_single_proxy(c)));
    const server = servers[0];
    server.duplicates = servers;
    servers.forEach(s=>{
        s.stop = ()=>{};
        s.config = proxy;
    });
    server.stop = ()=>etask(function*mgr_server_stop(){
        const args = [].slice.call(arguments);
        _this._log.notice('Stopping proxies %s', servers.map(s=>s.port||
            s.opt.listen_port||s.opt.port));
        return yield etask.all(servers.map(s=>{
            const port = s.port||s.opt.listen_port||s.opt.port;
            delete _this.proxies_running[port];
            return Luminati.prototype.stop.apply(s, args);
        }));
    });
    server.session_mgr._request_session({}, {init: true});
    return server;
});

E.prototype._multiply_port = etask._fn(
function*mgr__multiply_port(_this, port){
    let multiply = port.multiply||1;
    const proxies = [port];
    const zone = port.zone;
    const pass = port.password;
    let ips = port.ips||[];
    let vips = port.vips||[];
    if (port.multiply_ips=='dynamic')
    {
        ips = yield _this.request_allocated_ips(zone, pass);
        ips = ips.ips||[];
        multiply = ips.length;
    }
    if (port.multiply_vips=='dynamic')
    {
        vips = yield _this.request_allocated_vips(zone, pass);
        multiply = vips.length;
    }
    const dup_port = port.port+1;
    for (let i=1; i<multiply; i++)
    {
        const dup = assign({}, port, {
            proxy_type: 'duplicate',
            master_port: port.port,
        });
        dup.port = dup_port+i-1;
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
    if (port.multiply_ips)
    {
        port._ips = ips;
        port.ip = ips[0];
        port.ips = [port.ip];
    }
    if (port.multiply_vips)
    {
        port._vips = vips;
        port.vip = vips[0];
        port.vips = [port.vip];
    }
    return proxies;
});

E.prototype.proxy_create = etask._fn(function*mgr_proxy_create(_this, proxy){
    if (!proxy.proxy_type && proxy.port!=22225)
        proxy.proxy_type = 'persist';
    const server = yield _this.create_proxy(proxy);
    if (proxy.proxy_type=='persist')
    {
        _this.proxies.push(proxy);
        _this.save_config();
    }
    return server;
});

E.prototype.get_server = function(port){
    return this.proxies_running[''+port];
};

E.prototype.proxy_delete = etask._fn(function*mgr_proxy_delete(_this, port){
    const server = _this.proxies_running[port];
    if (!server)
        return;
    if (server.timer)
        clearTimeout(server.timer);
    yield server.stop();
    if (server.opt.proxy_type=='persist')
    {
        const idx = _this.proxies.findIndex(p=>p.port==port);
        if (idx==-1)
            return;
        _this.proxies.splice(idx, 1);
        _this.save_config();
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
    proxy.port = get_free_port(_this.proxies_running);
    yield _this.proxy_create(proxy);
    res.json({proxy});
});

E.prototype.proxy_create_api = etask._fn(
function*mgr_proxy_create_api(_this, req, res){
    let port;
    if (req.body.proxy.port=='auto')
        port = get_free_port(_this.proxies_running);
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
    let proxy = assign({}, req.body.proxy, {port});
    proxy = _.omitBy(proxy, v=>v==='');
    const server = yield _this.proxy_create(proxy);
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
    const old_server = _this.proxies_running[old_port];
    if (!old_server)
        throw 'Server does not exists';
    const stats = old_server.stats;
    const banlist = old_server.banlist;
    yield _this.proxy_delete(old_port);
    let proxy = assign({}, old_proxy, new_proxy);
    proxy = _.omitBy(proxy, v=>v==='');
    const server = yield _this.proxy_create(proxy);
    _this.proxies_running[new_proxy.port||old_port].stats = stats;
    _this.proxies_running[new_proxy.port||old_port].banlist = banlist;
    return server.opt;
});

E.prototype.proxy_update_api = etask._fn(
function*mgr_proxy_update_api(_this, req, res){
    const old_port = req.params.port;
    const old_proxy = _this.proxies.find(p=>p.port==old_port);
    if (!old_proxy)
        throw `No proxy at port ${old_port}`;
    if (old_proxy.proxy_type!='persist')
        throw 'This proxy is read-only';
    try {
        res.json({data: yield _this.proxy_update(old_proxy, req.body.proxy)});
    } catch(e){ res.status(400).json({errors: e.errors}); }
});

E.prototype.api_url_update_api = function(req, res){
    let new_url = 'https://'+req.body.url.replace(/https?:\/\/(www\.)?/, '');
    this._defaults.api = new_url;
    this.save_config();
    res.status(200).send('ok');
    this.emit('config_changed');
};

E.prototype.proxy_banips_api = function(req, res){
    const port = req.params.port;
    const proxy = this.proxies_running[port];
    if (!proxy)
        return res.status(400).send(`No proxy at port ${port}`);
    const {ips, ms=0} = req.body||{};
    if (!ips || !ips.length || !ips.every(util_lib.is_ip))
        return res.status(400).send('No ips provided');
    const success = ips.reduce((acc, ip)=>proxy.banip(ip, ms), true);
    if (success)
        return res.status(204).end();
    res.status(400).send('Failed to ban ips');
};

// XXX krzysztof: make a separate module for all the banips API
E.prototype.banip_api = function(req, res){
    const {ip, ms=0} = req.body||{};
    if (!ip || !util_lib.is_ip(ip))
        throw `No ip provided`;
    this.banlist.add(ip, ms);
    return res.status(204).end();
};

E.prototype.proxy_banip_api = function(req, res){
    const port = req.params.port;
    const proxy = this.proxies_running[port];
    if (!proxy)
        throw `No proxy at port ${port}`;
    const {ip, ms=0} = req.body||{};
    if (!ip || !util_lib.is_ip(ip))
        throw `No ip provided`;
    if (proxy.banip(ip, ms))
        return res.status(204).end();
    throw `Failed to ban ip`;
};

E.prototype.proxy_unbanip_api = etask._fn(
function*mgr_proxy_unbanip_api(_this, req, res){
    const port = req.params.port;
    const proxy = _this.proxies_running[port];
    if (!proxy)
        throw `No proxy at port ${port}`;
    const {ip} = req.body||{};
    if (!ip || !util_lib.is_ip(ip))
        throw `No ip provided`;
    if (yield proxy.unban(ip))
        return res.status(204).end();
    throw `Failed to unban ip`;
});

E.prototype.proxy_unblock_api = function(req, res){
    const port = req.params.port;
    const proxy = this.proxies_running[port];
    proxy.session_terminated = false;
    res.status(200).send('OK');
};

E.prototype.proxy_block_test_api = function(req, res){
    const port = req.params.port;
    const proxy = this.proxies_running[port];
    proxy.session_terminated = true;
    res.status(200).send('OK');
};

E.prototype.termination_info_api = function(req, res){
    const port = req.params.port;
    const proxy = this.proxies_running[port];
    res.json({terminated: !!proxy.session_terminated});
};

E.prototype.get_banlist_api = function(req, res){
    const port = req.params.port;
    let banlist;
    if (!port)
        banlist = this.banlist;
    else if (this.proxies_running[port])
        banlist = this.proxies_running[port].banlist;
    else
        throw 'Proxy does not exist';
    if (req.query.full)
    {
        return res.json({ips: [...banlist.cache.values()].map(
            b=>({ip: b.ip, domain: b.domain, to: b.to_date}))});
    }
    res.json({ips: [...banlist.cache.keys()]});
};

E.prototype.get_sessions_api = function(req, res){
    const {port} = req.params;
    const server = this.proxies_running[port];
    if (!server)
        return res.status(400).send('server does not exist');
    res.json(server.session_mgr.get_sessions());
};

E.prototype.get_reserved_api = function(req, res){
    const port = req.params.port;
    const server = this.proxies_running[port];
    const ips = server.session_mgr.get_reserved_sessions()
        .map(s=>s.last_res.ip);
    res.json({ips: [...new Set(ips)]});
};

E.prototype.get_fast_api = function(req, res){
    const {port} = req.params;
    const r = req.query.r||'';
    const server = this.proxies_running[port];
    const sessions = server.session_mgr.get_fast_sessions(r).map(s=>({
        ip: s.last_res && s.last_res.ip,
        host: s.host,
        session: s.session,
        username: s.username,
    }));
    res.json({sessions});
};

E.prototype.proxy_delete_api = etask._fn(
function*mgr_proxy_delete_api(_this, req, res){
    const port = +req.params.port;
    yield _this.proxy_delete(port);
    _this.loki.requests_clear({port});
    _this.loki.stats_clear_by_port(port);
    res.status(204).end();
});

E.prototype.refresh_sessions_api = function(req, res){
    const port = req.params.port;
    const server = this.proxies_running[port];
    if (!server)
        return res.status(400, 'Invalid proxy port').end();
    this.refresh_server_sessions(port);
    res.status(204).end();
};

E.prototype.refresh_server_sessions = function(port){
    const server = this.proxies_running[port];
    if (!server)
        return false;
    server.session_mgr.refresh_sessions();
    return true;
};

E.prototype.proxy_status_get_api = etask._fn(
function*mgr_proxy_status_get_api(_this, req, res){
    const port = req.params.port;
    const proxy = _this.proxies_running[port];
    if (!proxy)
        return res.json({status: 'Unknown proxy'});
    if (proxy.opt.smtp)
        return res.json({status: 'ok', status_details: [{msg: 'SMTP proxy'}]});
    const force = req.query.force!==undefined
        && req.query.force!=='false' && req.query.force!=='0';
    const with_details = req.query.with_details!==undefined
        && req.query.with_details!=='false' && req.query.with_details!=='0';
    const fields = ['status'];
    if (with_details)
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
    for (let cnt = 0; proxy.status===null && cnt<=22; cnt++)
        yield etask.sleep(date.ms.SEC);
    if (proxy.status===null)
        return res.json({status: 'Unexpected lock on status check.'});
    if (proxy.status)
        return res.json(_.pick(proxy, fields));
    yield _this.test_port(proxy);
    res.json(_.pick(proxy, fields));
});

E.prototype.test_port = etask._fn(function*lum_test(_this, proxy){
    proxy.status = null;
    let success = false;
    let error = '';
    try {
        const r = yield util_lib.json({
            url: _this._defaults.test_url,
            method: 'GET',
            proxy: `http://127.0.0.1:${proxy.port}`,
            timeout: 20*date.ms.SEC,
            headers: {
                'x-hola-context': 'STATUS CHECK',
                'x-hola-agent': lpm_config.hola_agent,
                'user-agent': Luminati.user_agent,
            },
        });
        success = r.statusCode==200;
        error = r.headers['x-luminati-error'];
    } catch(e){ ef(e); }
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
    } catch(e){ _this._log.error('open_browser_api: %s', e.message); }
    res.status(200).send('OK');
});

E.prototype.proxy_port_check = etask._fn(
function*mgr_proxy_port_check(_this, port, duplicate, old_port, old_duplicate){
    duplicate = +duplicate || 1;
    port = +port;
    let start = port;
    let end = port + duplicate -1;
    const old_end = old_port && old_port + (old_duplicate||1) -1;
    let ports = [];
    for (let p = start; p <= end; p++)
    {
        if (old_port && old_port <= p && p <= old_end)
            continue;
        if (p == _this.argv.www)
            return p + ' in use by the UI/API';
        if (_this.proxies_running[p])
            return p + ' in use by another proxy';
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
        ef(e);
        return e.message;
    }
});

E.prototype.proxy_check = etask._fn(
function*mgr_proxy_check(_this, new_proxy_config, old_proxy_port){
    const old_proxy = old_proxy_port && _this.proxies_running[old_proxy_port]
        && _this.proxies_running[old_proxy_port].opt || {};
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
    let db_zone, db_zone_plan;
    if (zone!==undefined)
    {
        const zones = yield _this.get_zones();
        if (zones.length)
        {
            db_zone = zones.filter(i=>i.zone==zone)[0];
            if (!db_zone)
                db_zone = zones.filter(i=>i.zone==effective_zone)[0];
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
            else if (db_zone.plans)
            {
                db_zone_plan = get_zone_plan(db_zone.plans);
                if (!db_zone_plan || db_zone_plan.disable)
                {
                    info.push({msg: 'the zone is disabled',
                        lvl: 'err', field: 'zone'});
                }
            }
        }
    }
    return info;
});

E.prototype.proxy_check_api = etask._fn(
function*mgr_proxy_check_put(_this, req, res){
    let info = yield _this.proxy_check(req.body, +req.params.port);
    res.json(info);
});

E.prototype.config_check_api = function(req, res){
    let errors;
    try { errors = this.config_check(JSON.parse(req.body.config)); }
    catch(e){
        ef(e);
        this._log.warn('Config parsing error '+zerr.e2s(e));
        errors = ['Config is not a valid JSON'];
    }
    res.json(errors);
};

E.prototype.config_check = function(config){
    if (!config.proxies)
        config = {proxies: [].concat(config)};
    if (!config._defaults)
        config._defaults = E.default;
    const ports = {};
    const conflicts = {};
    const chk_port = (port, desc)=>{
        if (ports[port])
        {
            if (!conflicts[port])
                conflicts[port] = [ports[port], desc];
            else
                conflicts[port].push(desc);
            return ports[port];
        }
        ports[port] = desc;
    };
    if (config._defaults.www)
        chk_port(config._defaults.www, 'UI/API');
    if (config._defaults.ws)
        chk_port(config._defaults.ws, 'UI/WebSocket');
    config.proxies.forEach((p, i)=>{
        const id = `Proxy #${i+1}`;
        const opt = assign({}, config._defaults, p);
        let conflict = chk_port(opt.port, id);
        const multiply = p.multiply||1;
        for (let d=1; d<multiply; d++)
            conflict = conflict||chk_port(opt.port+d, id+' Duplicate');
        if (conflict)
            p.conflict = conflict;
    });
    this.save_config();
    return _.toPairs(conflicts).map(c=>`Conflict on port ${c[0]} was found `
        +'with the folowing configurations: '+c[1].join(', '));
};

E.prototype.link_test_api = etask._fn(function*mgr_link_test(_this, req, res){
    const opt = assign(_.pick(req.query, qw`url country city state
        user_agent headers skip_full_page screenshot html`));
    opt.port = req.params.port;
    if (!_this.proxies_running[opt.port])
        return res.status(400).send('Wrong proxy port\n');
    if (!_this.proxies_running[opt.port].opt.ssl)
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
        catch(e){ _this._log.warn('wrong format of the headers'); }
    }
    if (req.body&&req.body.headers)
        opt.headers = req.body.headers;
    const tracer = new Tracer(_this, _this.wss, _this.proxies_running,
        _this._defaults.zones, _this.opts.log);
    const result = yield tracer.trace(opt);
    delete result.tracing_url;
    if (!result.err)
        delete result.err;
    res.json(result);
});

E.prototype.link_test_ui_api = etask._fn(function*mgr_trace(_this, req, res){
    const opt = assign(_.pick(req.body, qw`url port uid`), {screenshot: true});
    let user_agent;
    if (user_agent = req.headers['user-agent'])
        opt.user_agent = user_agent;
    if (!_this.proxies_running[opt.port])
        return res.status(400).send('Wrong proxy port');
    if (!_this.proxies_running[opt.port].opt.ssl)
        return res.status(422).send('Proxy port needs to have SSL analyzing');
    opt.live = true;
    const tracer = new Tracer(_this, _this.wss, _this.proxies_running,
        _this._defaults.zones, _this.opts.log);
    const result = yield tracer.trace(opt);
    res.json(result);
});

E.prototype.proxy_tester_api = function(req, res){
    const port = req.params.port;
    let response_sent = false;
    const handle_log = req_log=>{
        if (req_log.details.context!='PROXY TESTER TOOL')
            return;
        this.removeListener('request_log', handle_log);
        response_sent = true;
        res.json(req_log);
    };
    this.on('request_log', handle_log);
    const opt = assign(_.pick(req.body, qw`url headers body`), {
        followRedirect: false,
    });
    const password = this.proxies_running[port].config.password;
    const user = 'tool-proxy_tester';
    const basic = Buffer.from(user+':'+password).toString('base64');
    opt.headers = opt.headers||{};
    opt.headers['proxy-authorization'] = 'Basic '+basic;
    if (+port)
    {
        opt.proxy = 'http://127.0.0.1:'+port;
        if (this.proxies_running[port].opt.ssl)
            opt.ca = ssl.ca.cert;
        if (this.proxies_running[port].opt.unblock)
            opt.rejectUnauthorized = false;
        opt.headers = opt.headers||{};
    }
    request(opt, err=>{
        if (!err)
            return;
        this.removeListener('request_log', handle_log);
        this._log.error('proxy_tester_api: %s', err.message);
        if (!response_sent)
            res.status(500).send(err.message);
    });
};

E.prototype.proxy_ip = etask._fn(function*mgr_proxy_ip(_this, proxy){
    if (/^\d+\.\d+\.\d+\.\d+$/.test(proxy))
        return proxy;
    if (proxy.length==2)
        proxy = `servercountry-${proxy}.${_this.argv.proxy}`;
    try {
        const ips = yield etask.nfn_apply(dns, '.resolve', [proxy]);
        return ips[0];
    } catch(e){
        _this._log.error('Failed to resolve proxy domain name: '+proxy+' '
            +zerr.e2s(e));
        return null;
    }
});

E.prototype.get_all_locations_api = etask._fn(
function*mgr_get_all_locations(_this, req, res){
    const data = yield cities.all_locations();
    const shared_countries = yield util_lib.json({
        url: `${_this._defaults.api}/users/zone/shared_block_countries`});
    res.json(Object.assign(data, {shared_countries: shared_countries.body}));
});

E.prototype.logs_suggestions_api = function(req, res){
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
        if (!(proxy = this.proxies_running[r.port]))
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
        current: chk.node.version,
        satisfied: chk.node.isSatisfied||is_pkg,
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
    return assign({newer, versions: versions.body}, r.body);
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
        if (qw`$0 h help version p ? v _ explicit_opt overlay_opt
            rules native_args daemon_opt`.includes(k))
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
        www_whitelist_ips: this._defaults.www_whitelist_ips,
        whitelist_ips: this._defaults.whitelist_ips,
        config: this.argv.config,
        resolve: this._defaults.resolve,
        argv: this.get_params().join(' '),
        test_url: this._defaults.test_url,
        api: this._defaults.api,
        mail_domain: pkg.mail_domain,
        logs: this._defaults.logs,
        request_stats: this._defaults.request_stats,
        dropin: this._defaults.dropin,
    };
};

// XXX krzysztof: improve mechanism for defaults values
E.prototype.update_settings_api = etask._fn(
function*update_settings_mgr(_this, req, res){
    if (req.body.zone!==undefined)
        _this._defaults.zone = req.body.zone;
    _this._defaults.logs = req.body.logs;
    _this.loki.request_trunc(_this._defaults.logs);
    _this._defaults.request_stats = req.body.request_stats;
    if (_this._defaults.request_stats===undefined||
        _this._defaults.request_stats==='')
    {
        _this._defaults.request_stats = true;
    }
    if (!_this._defaults.request_stats)
        _this.loki.stats_clear();
    let ips;
    if ((ips=req.body.www_whitelist_ips)!==undefined)
    {
        if (ips==='')
            delete _this._defaults.www_whitelist_ips;
        else
            _this._defaults.www_whitelist_ips = ips.split(',');
    }
    if ((ips=req.body.whitelist_ips)!==undefined)
    {
        if (ips==='')
            delete _this._defaults.whitelist_ips;
        else
            _this._defaults.whitelist_ips = ips.split(',');
    }
    yield etask.all(_this.proxies.map(p=>_this.proxy_update(p, p)));
    _this.save_config();
    res.json(_this.get_settings());
});

E.prototype.config_get_api = function(req, res){
    res.json({config: file.exists(this.argv.config) ?
        file.read_e(this.argv.config) : ''});
};

E.prototype.config_set_api = function(req, res){
    file.write_e(this.argv.config, req.body.config);
    res.json({result: 'ok'});
    this.emit('config_changed');
};

E.prototype.creds_user_set_api = etask._fn(
function*mgr_creds_user_set(_this, req, res){
    const remote_ip = req.ip;
    const config = yield _this.login_user(req.body.token,
        req.body.username, req.body.password,
        req.body.customer || _this._defaults.customer);
    if (config.error)
    {
        res.json(config);
        return;
    }
    if (config.customers)
    {
        res.json({customers: config.customers});
        return;
    }
    assign(_this._defaults, config.defaults);
    let wips = _this._defaults.whitelist_ips||[];
    if (!wips.length && remote_ip!='127.0.0.1')
    {
        _this._defaults.whitelist_ips = [remote_ip];
        yield etask.all(_this.proxies.map(p=>_this.proxy_update(p, p)));
    }
    _this.save_config();
    yield _this.logged_update();
    yield _this.sync_recent_stats();
    yield _this.sync_config_file();
    res.json({result: 'ok'});
});

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
    this.save_config();
    res.json({token});
};

E.prototype.proxies_running_get_api = function(req, res){
    res.header('Content-Type', 'application/json');
    res.header('Access-Control-Allow-Origin', '*');
    const res_stream = req.init_json_stream();
    for (let p in this.proxies_running)
    {
        const port = this.proxies_running[p];
        if (port.port==22225)
            continue;
        const proxy = _.clone(port.opt);
        proxy.status = port.status;
        proxy.status_details = port.status_details;
        proxy.config = port.config;
        res_stream.push(proxy);
    }
    res_stream.push(null);
};

E.prototype.request_allocated_ips = etask._fn(
function*mgr_request_allocated_ips(_this, zone, password){
    const r = yield util_lib.json({
        url: `${_this._defaults.api}/users/zone/alloc_ips`,
        headers: {'x-hola-auth': `lum-customer-${_this._defaults.customer}`
        +`-zone-${zone}-key-${password||_this._defaults.password}`},
    });
    return r.body;
});

E.prototype.request_allocated_vips = etask._fn(
function*mgr_request_allocated_vips(_this, zone, password){
    const r = yield util_lib.json({
        url: `${_this._defaults.api}/api/get_route_vips`,
        headers: {'x-hola-auth': `lum-customer-${_this._defaults.customer}`
        +`-zone-${zone}-key-${password||_this._defaults.password}`},
    });
    return r.body;
});

E.prototype.allocated_ips_get_api = etask._fn(
function*mgr_allocated_ips_get(_this, req, res){
    res.send(yield _this.request_allocated_ips(req.query.zone, req.query.key));
});

E.prototype.allocated_vips_get_api = etask._fn(
function*mgr_allocated_vips_get(_this, req, res){
    res.send(yield _this.request_allocated_vips(req.query.zone,
        req.query.key));
});

E.prototype.refresh_ips = etask._fn(function*fresh_ips(_this, zone, ips){
    const jar = _this.luminati_jar.jar;
    yield etask.nfn_apply(request, [{url: _this._defaults.api, jar}]);
    const xsrf = (jar.getCookies(_this._defaults.api).find(e=>
        e.key=='XSRF-TOKEN')||{}).value;
    const response = yield etask.nfn_apply(request, [{
        method: 'POST',
        url: `${_this._defaults.api}/users/zone/refresh_ips`,
        qs: assign(_.pick(_this._defaults, qw`customer token`)),
        jar,
        json: true,
        headers: {'X-XSRF-Token': xsrf},
        form: {customer: _this._defaults.customer, zone, ips, cn: 1},
    }]);
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
    const jar = _this.luminati_jar.jar;
    yield etask.nfn_apply(request, [{url: _this._defaults.api, jar}]);
    const xsrf = (jar.getCookies(_this._defaults.api).find(e=>
        e.key=='XSRF-TOKEN')||{}).value;
    const response = yield etask.nfn_apply(request, [{
        method: 'POST',
        url: `${_this._defaults.api}/users/zone/refresh_vips`,
        qs: assign(_.pick(_this._defaults, qw`customer token`)),
        jar,
        json: true,
        headers: {'X-XSRF-Token': xsrf},
        form: {customer: _this._defaults.customer, zone, vips},
    }]);
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
    _this.save_config();
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
    setTimeout(cb = etask._fn(function*mgr_start_auto_update(_this){
        const v = yield _this._last_version();
        if (v.newer && v.auto_update)
            _this._upgrade();
        else
           setTimeout(cb, tm);
    }).bind(this), tm);
};

E.prototype.api_request = etask._fn(function*mgr_api_request(_this, opt){
    if (!_this.logged_in)
        return;
    const jar = _this.luminati_jar.jar;
    yield etask.nfn_apply(request, [{url: _this._defaults.api, jar}]);
    const xsrf = (jar.getCookies(_this._defaults.api).find(e=>
        e.key=='XSRF-TOKEN')||{}).value;
    const res = yield etask.nfn_apply(request, [{
        method: opt.method||'GET',
        url: opt.url,
        qs: assign(_.pick(_this._defaults, qw`customer token`)),
        jar,
        json: true,
        headers: {'X-XSRF-Token': xsrf},
        form: opt.form,
    }]);
    if (res.statusCode!=200)
    {
        _this._log.warn('API call to %s FAILED with status %s', opt.url,
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
    const enable = !!Object.values(this.proxies_running)
    .filter(p=>!p.config.ssl && p.port!=22225).length;
    let _https;
    if (!(_https = stats.protocol.find(p=>p.key=='https')))
    {
        stats.protocol.push({key: 'https', out_bw: 0, in_bw: 0, reqs: 0});
        stats.ssl_enable = enable;
    }
    else if (_https.reqs>0)
    {
        stats.ssl_warning = enable;
        stats.ssl_enable = enable;
    }
    const stats_ports = this.loki.stats_group_by('port', 0);
    const ports = stats_ports.reduce((acc, el)=>
        Object.assign({}, acc, {[el.key]: el}), {});
    res.json(Object.assign({ports}, stats));
};

E.prototype.add_whitelist_ip_api = function(req, res){
    if (req.ip!='127.0.0.1')
        res.status(403).send('This endpoint works only on localhost\n');
    let ip;
    if (!(ip=req.body.ip))
        return res.status(400).send('You need to pass an IP to add\n');
    try { ip = new Netmask(ip).base; }
    catch(e){ return res.status(422).send('Wrong format\n'); }
    this._defaults.www_whitelist_ips = [...new Set(
        this._defaults.www_whitelist_ips).add(ip)];
    this.save_config();
    res.send('OK');
};

E.prototype.add_wip_api = etask._fn(function*(_this, req, res){
    const token_auth = _this._defaults.token_auth;
    if (!token_auth || token_auth!=req.headers.authorization)
        return res.status(403).send('Forbidden');
    let ip;
    if (!(ip=req.body.ip))
        return res.status(400).send('You need to pass an IP to add\n');
    try { ip = new Netmask(ip).base; }
    catch(e){ return res.status(422).send('Wrong format\n'); }
    _this._defaults.whitelist_ips = [...new Set(
        _this._defaults.whitelist_ips).add(ip)];
    _this.save_config();
    yield etask.all(_this.proxies.map(p=>_this.proxy_update(p, p)));
    res.send('OK');
});

E.prototype.authenticate = function(req, res, next){
    // XXX krzysztof: copied from another place, simplify it
    const _defaults = assign({}, _.pick(E.default,
        lpm_config.default_fields));
    const whitelist_blocks = (_defaults.www_whitelist_ips||[])
    .concat(this._defaults.www_whitelist_ips)
    .concat(this.mgr_opts.www_whitelist_ips||[], '127.0.0.1')
    .map(wl=>{ try { return new Netmask(wl); } catch(e){} })
    .filter(wl=>!!wl);
    const is_whitelisted_ip = (whitelist_blocks||[]).some(wb=>{
        try { return wb.contains(req.ip); } catch(e){ return false; }
    });
    if (!is_whitelisted_ip && !['/version', '/add_wip'].includes(req.url))
    {
        res.status(403);
        res.set('x-lpm-block-ip', req.ip);
        return void res.send(`Connection from your IP is forbidden. If you`
            +` want to access this site ask the administrator to add`
            +` ${req.ip} to the whitelist. for more info visit`
            +` https://luminati.io/faq#lpm_whitelist_admin`);
    }
    req.init_json_stream = ()=>{
        const readable = new stream.Readable({objectMode: true});
        readable._read = ()=>{};
        readable.pipe(jos.stringify()).pipe(res);
        return readable;
    };
    next();
};

E.prototype._api = function(f){
    const _this = this;
    return (req, res, next)=>etask(function*mgr__api(){
        this.finally(()=>{
            if (this.error)
            {
                _this._log.warn('API error: %s %s %s', req.method,
                        req.originalUrl, zerr.e2s(this.error));
                return next(this.error);
            }
        });
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
        {version: pkg.version})));
    app.get('/last_version', this._api(this.last_version_api));
    app.get('/node_version', this._api(this.node_version_api));
    app.get('/mode', this._api((req, res)=>
        res.json({logged_in: this.logged_in})));
    app.get('/conn', this._api((req, res)=>res.json(this.conn)));
    app.put('/api_url', this._api(this.api_url_update_api));
    app.get('/proxies_running', this._api(this.proxies_running_get_api));
    app.get('/proxies', this._api((req, res)=>res.json(this.proxies)));
    app.post('/proxies', this._api(this.proxy_create_api));
    app.post('/proxy_dup', this._api(this.proxy_dup_api));
    app.post('/proxies/:port/banip', this._api(this.proxy_banip_api));
    app.post('/proxies/:port/banips', this._api(this.proxy_banips_api));
    app.delete('/proxies/:port/banip', this._api(this.proxy_unbanip_api));
    app.post('/proxies/:port/unblock', this._api(this.proxy_unblock_api));
    app.get('/proxies/:port/block', this._api(this.proxy_block_test_api));
    app.get('/proxies/:port/termination_info',
        this._api(this.termination_info_api));
    app.get('/banlist/:port?', this._api(this.get_banlist_api));
    app.post('/banip', this._api(this.banip_api));
    app.get('/reserved/:port', this._api(this.get_reserved_api));
    app.get('/fast/:port', this._api(this.get_fast_api));
    app.get('/sessions/:port', this._api(this.get_sessions_api));
    app.put('/proxies/:port', this._api(this.proxy_update_api));
    app.delete('/proxies/:port', this._api(this.proxy_delete_api));
    app.post('/refresh_sessions/:port', this._api(this.refresh_sessions_api));
    app.get('/proxies/:port/link_test.json', this._api(this.link_test_api));
    app.post('/proxies/:port/link_test.json', this._api(this.link_test_api));
    app.post('/proxy_check', this._api(this.proxy_check_api));
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
    app.post('/creds_user', this._api(this.creds_user_set_api));
    app.get('/gen_token', this._api(this.gen_token_api));
    app.get('/config', this._api(this.config_get_api));
    app.post('/config', this._api(this.config_set_api));
    app.post('/config_check', this._api(this.config_check_api));
    app.get('/allocated_ips', this._api(this.allocated_ips_get_api));
    app.get('/allocated_vips', this._api(this.allocated_vips_get_api));
    app.post('/refresh_ips', this._api(this.refresh_ips_api));
    app.post('/refresh_vips', this._api(this.refresh_vips_api));
    app.post('/shutdown', this._api(this.shutdown_api));
    app.post('/logout', this._api(this.logout_api));
    app.post('/upgrade', this._api(this.upgrade_api));
    app.post('/restart', this._api(this.restart_api));
    app.get('/all_locations', this._api(this.get_all_locations_api));
    app.post('/test/:port', this._api(this.proxy_tester_api));
    app.post('/trace', this._api(this.link_test_ui_api));
    app.get('/recent_stats', this._api(this.stats_get_api));
    app.post('/report_bug', this._api(this.report_bug_api));
    app.post('/update_notifs', this._api(this.update_notifs_api));
    app.post('/enable_ssl', this._api(this.enable_ssl_api));
    app.post('/update_ips', this._api(this.update_ips_api));
    app.get('/zones', this._api(this.get_zones_api));
    app.use('/tmp', express.static(Tracer.screenshot_dir));
    app.post('/add_whitelist_ip', this._api(this.add_whitelist_ip_api));
    app.post('/add_wip', this._api(this.add_wip_api));
    app.post('/react_error', this._api(this.react_error_api));
    app.post('/emit_ws', this._api(this.emit_ws_api));
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
        _this._log.error(zerr.e2s(err));
        res.status(500).send('Server Error');
    });
    server.on('error', err=>_this.error_handler('WWW', err));
    server.stop = force=>etask(function*mgr_server_stop(){
        const stop_method = force ? '.forceShutdown' : '.shutdown';
        return yield etask.nfn_apply(server, stop_method, []);
    });
    yield etask.cb_apply(server, '.listen', [_this.argv.www,
        find_iface(_this.argv.iface)||'0.0.0.0']);
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

E.prototype.logged_update = etask._fn(function*mgr_logged_update(_this){
    if (_this._defaults.customer)
    {
        const auth = yield _this.check_user();
        _this.logged_in = auth.result;
        _this.login_failure = auth.error;
    }
    else
    {
        _this.logged_in = false;
        _this.login_failure = false;
    }
});

E.prototype._get_cookie_jar = function(){
    const jarpath = this.argv.cookie;
    if (!jarpath)
        return cookie_jar = cookie_jar||request.jar();
    if (!fs.existsSync(jarpath))
        fs.writeFileSync(jarpath, '');
    try { return request.jar(new cookie_filestore(jarpath)); }
    catch(e){
        this._log.warn('Error accessing cookie jar: '+zerr.e2s(e));
        fs.unlinkSync(jarpath);
        fs.writeFileSync(jarpath, '');
    }
    try { return request.jar(new cookie_filestore(jarpath)); }
    catch(e){ return request.jar(); }
};

E.prototype.get_lum_local_conf = etask._fn(
function*mgr_get_lum_local_conf(_this, customer, token, force_login){
    customer = customer||_this._defaults.customer;
    token = token||_this._defaults.token;
    if (!_this.lum_conf)
        _this.lum_conf = {ts: 0};
    const now = Date.now();
    if (_this.lum_conf._defaults && now-_this.lum_conf.ts < 60*1000 ||
        _this.use_local_lum_conf && !force_login)
    {
        return _this.lum_conf;
    }
    if (!_this.luminati_jar)
        _this.luminati_jar = {jar: _this._get_cookie_jar()};
    let cookie = !!token ||
        (_this.luminati_jar.jar.getCookies(_this._defaults.api)||[])
        .some(c=>c && c.value && c.expires>=Date.now());
    if (!cookie && !_this.run_config.bypass_credentials_check)
    {
        if (!force_login)
            return (_this.use_local_lum_conf = true) && _this.lum_conf;
        throw {status: 403};
    }
    let config = yield etask.nfn_apply(request, [{
        qs: {customer, token},
        url: `${_this._defaults.api}/cp/lum_local_conf?`
            +lpm_config.hola_agent.split(' ')[0],
        jar: _this.luminati_jar.jar,
    }]);
    if (config.statusCode==403 && config.body &&
        config.body.startsWith('You have not signed'))
    {
        throw {status: 403, message: config.body};
    }
    if (config.statusCode!=200)
    {
        config = yield etask.nfn_apply(request, [{
            qs: {token},
            url: `${_this._defaults.api}/cp/lum_local_conf?`
                +lpm_config.hola_agent.split(' ')[0],
            jar: _this.luminati_jar.jar,
        }]);
    }
    if (config.statusCode!=200)
    {
        _this.use_local_lum_conf = true;
        if (!force_login)
            return _this.lum_conf;
        throw {status: config.statusCode, message: config.body};
    }
    _this.use_local_lum_conf = false;
    let hash = _this.lum_conf && _this.lum_conf.hash;
    _this.lum_conf = JSON.parse(config.body);
    _this.lum_conf.ts = now;
    _this.lum_conf.hash = _this.lum_conf._defaults && crypto.createHash('md5')
        .update(stringify(_this.lum_conf._defaults)).digest('hex');
    if (hash!=_this.lum_conf.hash)
        yield _this.fix_config(_this.lum_conf);
    if (_this._defaults.customer && _this.run_config.ua)
    {
        _this.run_config.ua.set('uid', _this._defaults.customer);
        _this.run_config.ua.set('cd1', _this._defaults.customer);
    }
    if (token)
        assign(_this._defaults, {token});
    return _this.lum_conf;
});

E.prototype.fix_config = etask._fn(
function*mgr_fix_config(_this, new_conf){
    if (!new_conf._defaults)
        return;
    _this._defaults.customer = new_conf._defaults.customer;
    if (_this._defaults.zone==new_conf._defaults.zone)
        assign(_this._defaults, new_conf._defaults);
    else if (new_conf._defaults.zones)
    {
        _this._defaults.zones = new_conf._defaults.zones;
        let def_zone = new_conf._defaults.zones[_this._defaults.zone];
        let invalid = !def_zone, zone_password;
        if (def_zone)
        {
            const errors = yield _this.proxy_check({
                zone: _this._defaults.zone,
                password: zone_password = def_zone.password,
            });
            invalid = errors.some(e=>e.lvl=='err');
        }
        if (invalid)
            assign(_this._defaults, new_conf._defaults);
        else if (zone_password)
            _this._defaults.password = zone_password;
    }
    yield etask.all(_this.proxies.map(p=>etask(function*mgr_fix_proxy_config(){
        // XXX krzysztof: clean it up! make sure it doesn't crash as dropin may
        // not exists
        if (_this.mgr_opts.dropin &&
            p.port==(Luminati.dropin.listen_port||Luminati.dropin.port)
            ||!p.zone)
        {
            delete p.zone;
            delete p.password;
        }
        let cp;
        if (cp = new_conf._defaults.zones[p.zone||_this._defaults.zone])
        {
            if (p.zone)
                p.password = p.password||cp.password;
            p._update = true;
            if (_this.proxies_running[p.port])
                yield _this.proxy_update(p, p);
        }
    })));
});

E.prototype.check_user = etask._fn(
function*mgr_check_user(_this){
    try {
        yield _this.get_lum_local_conf(null, null, true);
        return {result: true, error: ''};
    } catch(e){
        _this._defaults.token = '';
        const jarpath = _this.argv.cookie;
        if (fs.existsSync(jarpath))
            fs.writeFileSync(jarpath, '');
        _this.luminati_jar = undefined;
        return {result: false, error: 'You are not logged in.'};
    }
});

E.prototype.login_user = etask._fn(
function*mgr_login_user(_this, token, username, password, customer){
    let config, login_failed;
    try { config = yield _this.get_lum_local_conf(customer, token, true); }
    catch(e){
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
        let response = yield etask.nfn_apply(request, [{
            method: 'POST',
            url: `${_this._defaults.api}/users/auth/basic/check_credentials`,
            jar,
            headers: {'X-XSRF-Token': xsrf.value},
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
        _this.luminati_jar = {jar, username, password};
    }
    try {
        if (login_failed)
            config = yield _this.get_lum_local_conf(customer, token, true);
    } catch(e){
        if (!e.status)
            throw e;
        if (e.status==403 && (e.message=='Your account is not active' ||
            e.message && e.message.startsWith('No customer')))
        {
            try {
                delete _this._defaults.customer;
                config = yield _this.get_lum_local_conf(null, token, true);
                customer = null;
            } catch(e){
                if (customer)
                    _this._defaults.customer = customer;
            }
        }
        if (!config && e.status!=200)
        {
            let msg = e.message;
            if (msg=='Your account is not active')
            {
                msg = `Your account is disabled.`
                +`<a href='${_this.opts.www_api}/cp/billing'>`
                +`Click here to change your account status</a>`;
            }
            return {error: {
                message: msg||'Something went wrong. Please contact support.',
            }};
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
            body: {customer, zone: config._defaults.zone}
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
    }]);
    _this.current_country = (res.body.country||'').toLowerCase();
    if (!_this.current_country || _this.current_country=='cn')
        _this.opts.www_api = 'https://'+pkg.api_domain;
    _this.opts.current_ip = res.body.ip;
});

E.prototype.check_domain = etask._fn(function*mgr_check_domain(_this){
    const jar = _this._get_cookie_jar();
    const _url = `${_this._defaults.api}/lpm_config.json?ver=${pkg.version}`;
    try {
        const res = yield etask.nfn_apply(request, [{url: _url, jar}]);
        return res.statusCode==200;
    } catch(e){ return false; }
});

E.prototype.check_internet = etask._fn(function*mgr_check_internet(_this){
    try { yield etask.nfn_apply(request, [{url: 'http://1.1.1.1'}]); }
    catch(e){ return false; }
    return true;
});

E.prototype.check_conn = etask._fn(function*mgr_check_conn(_this){
    const internet = yield _this.check_internet();
    const domain = yield _this.check_domain();
    _this.conn = {domain, internet, current_country: _this.current_country};
});

E.prototype.start = etask._fn(function*mgr_start(_this){
    this.on('uncaught', e=>_this.log.error('start %s', zerr.e2s(e)));
    try {
        perr.run();
        yield _this.get_ip();
        yield _this.check_conn();
        _this.config_check({_defaults: _this.argv, proxies: _this.proxies});
        if (_this.argv.www && !_this.argv.high_perf)
            yield _this.loki.prepare();
        yield _this.logged_update();
        yield _this.sync_recent_stats();
        yield _this.sync_config_file();
        yield _this.init_proxies();
        yield cities.ensure_data();
        if (_this.argv.www)
        {
            _this.start_web_socket();
            _this.www_server = yield _this.create_web_interface();
            _this.emit('www_ready', _this.www_server.url);
            print_ui_running(_this.www_server.url);
            if (is_pkg)
                yield open(`http://127.0.0.1:${_this.argv.www}`);
        }
        _this.is_running = true;
        _this.start_auto_update();
        _this.perr('start_success');
        _this.run_stats_reporting();
    } catch(e){
        ef(e);
        if (e.message!='canceled')
        {
            _this._log.error('start error '+zerr.e2s(e));
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
    console.log(boxed_line());
    console.log(boxed_line(' '));
    console.log(boxed_line('Local proxy manager client is running'));
    console.log(boxed_line(' '));
    console.log(boxed_line('Open admin browser:'));
    console.log(boxed_line(' '));
    console.log(boxed_line(_url));
    console.log(boxed_line(' '));
    console.log(boxed_line(' '));
    console.log(boxed_line('Do not close the process while using the'));
    console.log(boxed_line('Proxy Manager                           '));
    console.log(boxed_line(' '));
    console.log(boxed_line());
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
    this.wss.broadcast({payload: req.body.payload, path: req.body.path},
        'global');
    res.send('ok');
};

E.prototype.run_stats_reporting = etask._fn(
function*mgr_run_stats_reporting(_this){
    const count_fd = ()=>etask(function*mgr_count_fd(){
        if (is_win || is_darwin || !posix)
            return 0;
        this.alarm(1000);
        let list;
        try {
            list = yield etask.nfn_apply(fs, '.readdir', ['/proc/self/fd']);
        } catch(e){ return 0; }
        return list.length;
    });
    while (_this.is_running)
    {
        let stats = {};
        try {
            const cu = zos.cpu_usage();
            const meminfo = zos.meminfo();
            const fd = yield count_fd();
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
        yield etask.sleep(15*date.ms.MIN);
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
    if (conf._defaults&&conf._defaults.customer)
        info.customer_name = conf._defaults.customer;
    return info;
};

E.prototype.perr = function(id, info={}, opt={}){
    const _info = Object.assign({}, info, this.get_info());
    if (zutil.is_mocha())
        return;
    return zerr.perr(id, _info, opt);
};

E.prototype.react_error_api = etask._fn(
function*mgr_react_error(_this, req, res){
    const {backtrace, message, stack} = req.body;
    const info = Object.assign({message, stack}, _this.get_info());
    yield zerr.perr('react', info, {backtrace});
    res.send('OK');
});
