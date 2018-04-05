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
const crypto = require('crypto');
const express = require('express');
const compression = require('compression');
const body_parser = require('body-parser');
const json2csv = require('json2csv');
const log = require('./log.js');
const http_shutdown = require('http-shutdown');
const Luminati = require('./luminati.js');
const Socks = require('./socks.js');
const ssl = require('./ssl.js');
const find_iface = require('./find_iface.js');
const pkg = require('../package.json');
const swagger = require('./swagger.json');
const request = require('request').defaults({gzip: true});
const sequelize = require('sequelize');
const http = require('http');
const https = require('https');
const hutil = require('hutil');
const zerr = hutil.zerr;
const zutil = hutil.util;
const util = require('util');
const md5_util = require('./md5_util.js');
const is_win = process.platform=='win32';
const is_darwin = process.platform=='darwin';
const sqlite3 = require('sqlite3');
const stringify = require('json-stable-stringify');
const cookie_filestore = require('tough-cookie-file-store');
const country_language = require('country-language');
const yargs = require('yargs/yargs');
const db_history = require('./db_history.json');
const check_node_version = require('check-node-version');
const semver = require('semver');
const cities = require('./cities.js');
const perr = require('./perr.js');
const {Netmask} = require('netmask');
const util_lib = require('./util.js');
const uuid_v1 = require('uuid/v1');

let phantomjs, webshot, posix, cookie_jar, proxy_creds_check_cache = {};
try {
    phantomjs = require('phantomjs-prebuilt');
    webshot = require('webshot');
} catch(e){}
try {
    posix = require('posix');
    require('heapdump');
} catch(e){}

const etask = hutil.etask;
const qw = hutil.string.qw;
const ef = etask.ef;
const file = hutil.file;
const date = hutil.date;
const assign = Object.assign;
const E = module.exports = Manager;

const prop_by_type = (def, type)=>_.toPairs(def.properties)
    .filter(p=>p[1].type==type).map(p=>p[0]);

const proxy_fields = assign({}, swagger.definitions.proxy.properties,
    swagger.definitions.manager.properties);
const mgr_fields = _.keys(swagger.definitions.manager.properties);
const added_descriptions = {
    'no-www': 'Disable local web',
    'no-config': 'Working without a config file',
    'no-cookie': 'Working without a cookie file',
    daemon: 'Start as a daemon',
    'stop-daemon': 'Stop running daemon',
    upgrade: 'Upgrade proxy manager',
};
swagger.info.version = pkg.version;
const numeric_fields = prop_by_type(swagger.definitions.proxy, 'integer');
const boolean_fields = prop_by_type(swagger.definitions.proxy, 'boolean');
const credential_fields = qw`customer zone password token`;
const default_fields = [].concat(credential_fields, mgr_fields);
const proxy_params = _(swagger.definitions.proxy.properties)
    .pickBy(k=>!credential_fields.includes(k)).keys().value();

function configure_dns(){
    const google_dns = ['8.8.8.8', '8.8.4.4'];
    const original_dns = dns.getServers();
    let servers = google_dns.concat(original_dns.filter(
        d=>!google_dns.includes(d)));
    // dns.setServers cashes node if there is an in-flight dns resolution
    // should be done before any requests are made
    // https://github.com/nodejs/node/issues/14734
    dns.setServers(servers);
}

// XXX ovidiu: move to common node/browser lib
let get_zone_plan = plans=>{
    let d = date();
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
let get_zone_perm = zone=>{
    let plan = get_zone_plan(zone.plans);
    if (!plan || !plan.type)
        return zone.perm;
    let perm = {
        full: 'country state city g1 cid ip asn pass_ip',
        city: 'country state city',
        asn: 'country state asn',
        g1: 'country g1',
        static: 'country ip route_all',
        mobile: 'country state mobile asn city',
    };
    if (plan.mobile)
        return perm.mobile;
    if (plan.type=='static')
        return perm.static+' route_dedicated';
    if (plan.city && plan.asn)
        return perm.city+' asn';
    for (let p of qw`city asn`)
    {
        if (plan[p])
            return perm[p];
    }
    return 'country';
};

const default_rule = {res: [{action: {req_status_cnt: true,
    req_status_success: true, retry: false}, head: true, status:
    {arg: '([23]..|404)', type: '=~'}}, {action: {req_status_cnt: true,
    req_status_success: false, retry: false}, head: true, status:
    {arg: '([23]..|404)', type: '!~'}}], url: '**', tag: 'req_status'};
E.default = assign({}, _.omit(Luminati.default, 'port'), {
    max_requests: 50,
    pool_size: 3,
    proxy_switch: 5,
    www: 22999,
    config: path.resolve(os.homedir(),
        '.luminati.json'.substr(is_win ? 1 : 0)),
    database: path.resolve(os.homedir(),
        '.luminati.sqlite3'.substr(is_win ? 1 : 0)),
    cookie: path.resolve(os.homedir(),
        '.luminati.jar'.substr(is_win ? 1 : 0)),
    mode: 'root',
    dropin: true,
    dropin_port: 22225,
    no_usage_stats: false,
    request_stats: true,
    history: false,
    reverse_lookup_dns: false,
    proxy_creds_check: true,
    beta_features: false,
    test_url: 'http://lumtest.com/myip.json',
    disable_color: false,
    rules: {post: [default_rule]},
    use_proxy_cache: true,
    max_logs: 1000,
});
const PROXY_INTERNAL_BYPASS = qw`google.com luminati.io luminati-china.io
    luminati.io`;
const PROXY_ONLY_BYPASS = qw`googleapis.com cdnjs.com gstatic.com google.co.*
    googleusercontent.com google.* luminati.io luminati-china.io luminati.io
    hwcdn.net lumtest.com`;
const port_test_results_file = path.resolve(os.homedir(),
    '.luminati_port_tester.json'.substr(is_win ? 1 : 0));

const load_json = (filename, optional, def, opt = {})=>{
    if (_.isObject(optional))
    {
        opt = optional;
        optional = opt.optional;
    }
    if (optional && !file.exists(filename))
        return def;
    let s;
    try {
        s = file.read_e(filename);
        s = s.replace(/^\uFEFF/, '');
        if (!opt.silent)
            console.log('');
            console.log(`Loaded config ${filename}`);
            console.log(`Running proxy configurations...`);
    } catch(e){ return def; }
    try { return JSON.parse(s); }
    catch(e){
        if (!opt.silent)
            console.warn(`Failed parsing json file ${filename}: ${e.message}`);
    }
    return def;
};

function Manager(args, run_config){
    events.EventEmitter.call(this);
    this.rmt_cfg = new Rmt_lpm_cnf(this);
    this.run_config = run_config||{};
    if (!this.run_config.id)
        this.run_config.id = +new Date();
    this.db = {};
    this.proxies_running = {};
    this.socks_servers = {};
    this.request_stats = {};
    args = args.map(String);
    let _yargs = yargs(args);
    let usage = ['  $0 [options] config1 config 2 ...'];
    if (process.env.DOCKER)
    {
        usage.unshift('  docker run luminati/luminati-proxy '
            +'[docker port redirections]');
    }
    _yargs.usage('Usage:\n' + usage.join(' \\\n'))
    .options(proxy_fields)
    .describe(added_descriptions)
    .number(numeric_fields)
    .default(E.default)
    .help('h')
    .alias({'help': ['h', '?'], port: 'p', daemon: 'd', 'version': 'v'})
    .version(()=>`luminati-proxy version: ${pkg.version}`);
    this.argv = _yargs.argv;
    this.agents = {
        http: new http.Agent({keepAlive: true, keepAliveMsecs: 5000}),
        https: new https.Agent({keepAlive: true, keepAliveMsecs: 5000,
            servername: this.argv.proxy}),
    };
    if (this.argv.log instanceof Array)
        this.argv.log = this.argv.log.pop();
    this.argv.log = this.argv.log.toLowerCase();
    this._log = log(this.argv.www||'MNGR', this.argv.log,
        this.argv.disable_color);
    this._log.notice('Manager started %s', pkg.version);
    if (this.argv.session=='true')
        this.argv.session = true;
    this._log.debug('Effective args %O', this.argv);
    this.mgr_opts = _.pick(this.argv, mgr_fields);
    let conf = _get_proxy_configs(this, args);
    this._total_conf = conf;
    this._defaults = conf._defaults;
    this.proxies = conf.proxies;
    this.mode = _yargs.argv.mode;
    if (!['root', 'normal', 'guest'].includes(this.mode))
    {
        console.log(`Unrecognized UI mode (${this.mode}); treating as guest`);
        this.mode = 'guest';
    }
    this.opts = _.pick(this.argv, _.keys(proxy_fields));
    if (this.mgr_opts.use_proxy_cache)
    {
        this.proxy_cache = {
            get: this.proxies_cache_get.bind(this),
            add: this.proxies_cache_add.bind(this),
            remove: this.proxies_cache_remove.bind(this),
        };
    }
    this.regenerate_stats = stat=>{
        if (!stat.out_bw||!stat.in_bw)
            return;
        if (stat.response_body)
            stat.response_body = stat.response_body.toString();
        let code = stat.status_code, protocol = stat.protocol;
        let domain = stat.hostname;
        let ss = this.request_stats[protocol] =
            this.request_stats[protocol]||{stats: []};
        ss.stats.push(stat);
        if (code)
        {
            ss[code] = ss[code]||{stats: []};
            ss[code].stats.push(stat);
        }
        let top = this.request_stats.top = this.request_stats.top||{};
        for (let k of [code, protocol, domain].filter(Boolean))
        {
            top[k] = top[k]||{count: 0, out_bw: 0, in_bw: 0, 'success': 0};
            top[k].count++;
            top[k].out_bw += stat.out_bw||0;
            top[k].in_bw += stat.in_bw||0;
            top[k].success += stat.success;
        }
        let all;
        if ((all = this.request_stats.all) && all.stats.length>1000)
        {
            let rm = all.stats.shift();
            code = rm.status_code;
            protocol = rm.protocol;
            domain = rm.hostname;
            if (this.request_stats[protocol])
                this.request_stats[protocol].stats.shift();
            if (code && this.request_stats[protocol][code])
                this.request_stats[protocol][code].stats.shift();
        }
    };
    this.stats_aggregator = data=>{
        try {
            if (data.context=='SESSION KEEP ALIVE'
                ||data.context=='STATUS CHECK')
            {
                return;
            }
            let stat = _.pick(data, qw`response_headers request_headers
                status_message response_time url proxy_peer success timeline
                method content_size port status_code`);
            stat.uuid = uuid_v1();
            stat.response_body = data.response_body.slice(0, 2048);
            let url_parts;
            if (url_parts = data.url.match(/^([^\/]+?):(\d+)$/))
            {
                stat.protocol = url_parts[2]==443 ? 'https' : 'http';
                stat.hostname = url_parts[1];
            }
            else
            {
                assign(stat, _.pick(url.parse(data.url),
                    qw`protocol hostname`));
                stat.protocol = (stat.protocol||'https:').slice(0, -1);
            }
            if (stat.hostname)
            {
                stat.in_bw = data.in_bw;
                stat.out_bw = data.out_bw;
                this.request_stats.all = this.request_stats.all||{stats: []};
                this.request_stats.all.stats.push(stat);
                setImmediate(()=>this.regenerate_stats(stat));
            }
            setImmediate(()=>this.handle_usage(data));
            data.protocol = stat.protocol;
            data.hostname = stat.hostname;
            let proxy;
            const full_logs = this.argv.history ||
            (proxy = this.proxies_running[data.port]) && proxy.opt.history;
            setImmediate(()=>this.history_aggregator(data, {full_logs}));
        } catch(e){
            // XXX maximk: buffer failed aggregations
            this._log.error('stats aggregator %s', zerr.e2s(e));
        }
    };
    this.handle_usage = etask._fn(function*mgr_handle_usage(_this, data){
        try {
            if (!data.out_bw && !data.in_bw)
                return;
            let curr = yield _this.sql(`SELECT bw, real_bw, reqs FROM usage`
                +` WHERE port_id = ${data.port}`);
            curr = curr[0]||{};
            const bw = (data.out_bw||0)+(data.in_bw||0);
            let real_bw = 0;
            if (!/lumtest\.com/.test(data.url))
                real_bw = 1;
            yield _this.sql(`INSERT OR REPLACE INTO usage(port_id, bw,`
                +` real_bw, reqs) VALUES(${data.port}, ${(curr.bw||0)+bw},`
                +` ${(curr.real_bw||real_bw)}, ${(curr.reqs||0)+1})`);
        } catch(e){
            // XXX maximk: buffer failed aggregations
            this._log.error('handle usage %s', zerr.e2s(e));
        }
    });
    this.history_aggregator = (data, opt={})=>{
        try {
            data.response_body = data.response_body.toString();
            const _this = this;
            etask(function*(){
                const curr_count = yield _this.sql(`SELECT COUNT(*) AS count
                    FROM request WHERE port = ${data.port}`);
                if (!opt.full_logs && curr_count[0].count>=E.default.max_logs)
                    return;
                let row = {};
                for (let f in data)
                    row['$'+f] = data[f];
                _this.db.main.stmt.history.run(row);
            });
        } catch(e){
            // XXX maximk: buffer failed aggregations
            this._log.error('history aggregator %s', zerr.e2s(e));
        }
    };
    if (this.run_config.ua && this._defaults.customer)
    {
        this.run_config.ua.set('uid', this._defaults.customer);
        this.run_config.ua.set('cd1', this._defaults.customer);
    }
    if (!this.run_config.ua && !this.run_config.skip_ga)
    {
        const analytics = require('universal-analytics');
        const ua = analytics('UA-60520689-2');
        ua.set('an', 'LPM-module');
        ua.set('av', `v${pkg.version}`);
        if (this._defaults.customer)
        {
            ua.set('uid', this._defaults.customer);
            ua.set('cd1', this._defaults.customer);
        }
        ua.event('manager', 'use_as_module').send();
    }
}

function _config_from_file(fname, proxy_type){
    let conf = load_json(fname, false, {});
    let defaults = conf._defaults||{};
    let proxies = [];
    if (conf.proxies||conf.port)
        proxies = proxies.concat(conf.proxies||conf);
    proxies = proxies.map(c=>assign({proxy_type}, c));
    return {_defaults: defaults, proxies};
}

function _get_proxy_configs(_this, args){
    let _defaults = assign({}, _.pick(E.default, default_fields));
    let proxies = [];
    // this.argv includes default values; we want only args explicitly given
    _this.argv_explicit = _.pick(_this.argv,
        [...proxy_params, 'test_url'].filter(p=>args.includes(`--${p}`)));
    if (args.includes('-p'))
        _this.argv_explicit.port = _this.argv.port;
    numeric_fields.forEach(f=>{
        if (_this.argv_explicit[f])
            _this.argv_explicit[f] = +_this.argv_explicit[f];
    });
    _this._log.debug('argv_explicit %O', _this.argv_explicit);
    _this.argv_overlay = _.omit(_this.argv_explicit, qw`socks port`);
    if (_this.mgr_opts.config)
    {
        let conf = _config_from_file(_this.mgr_opts.config, 'persist');
        assign(_defaults, _.pick(conf._defaults, default_fields));
        proxies = proxies.concat(conf.proxies);
    }
    Luminati.default.request_stats = _this.mgr_opts.request_stats;
    proxies = proxies.concat([].concat.apply([], _this.argv._
        .map(fname=>_config_from_file(fname, 'config').proxies)));
    if (qw`port socks`.some(k=>_this.argv_explicit[k]))
    {
        qw`port socks`.filter(k=>_this.argv_explicit[k])
        .forEach(k=>{
            proxies.filter(p=>p[k]==_this.argv_explicit[k])
            .forEach((p, i)=>{
                _this._log.warn('Conflict between config Proxy #%s and '
                    +'explicit parameter "--%s %s". Proxy settings will be'
                    +' overriden by explicit parameters.', i, k,
                    _this.argv_explicit[k]);
            });
        });
        let proxy = proxies.find(p=>qw`port socks`.some(k=>
            _this.argv_explicit[k] && p[k]==_this.argv_explicit[k]));
        if (!proxy)
            proxy = proxies.find(p=>!p.port || p.port==_this.argv.port);
        if (!proxy)
            proxies.push(assign({proxy_type: 'persist'}, _this.argv_explicit));
        else
        {
            assign(proxy, _this.argv_explicit);
            if (!proxy.port)
                proxy.port = _this.argv.port;
        }
    }
    if (_this.mgr_opts.dropin)
    {
        Luminati.dropin.listen_port = _this.mgr_opts.dropin_port;
        proxies.push(assign({}, Luminati.dropin, _.pick(_defaults,
            qw`zone test_url`)));
    }
    assign(_defaults, _.pick(_this.argv_overlay, default_fields));
    if (_this.argv.token)
        assign(_defaults, {token: _this.argv.token});
    let max_port = _this.argv.port||Luminati.default.port;
    let next = (max, key)=>{
        while (proxies.some(p=>p[key]==max))
            max++;
        return max;
    };
    proxies.filter(c=>!c.port)
        .forEach(c=>c.port = c.port||next(max_port, 'port'));
    proxies.forEach(c=>_this._log.debug('Config %O', c));
    _this._log.debug('_defaults %O', _defaults);
    return {_defaults, proxies};
}

util.inherits(Manager, events.EventEmitter);

E.prototype._api = function(f, roles){
    const _this = this;
    return (req, res, next)=>etask(function*mgr__api(){
        _this._log.debug('API %s %s', req.method, req.originalUrl);
        this.finally(()=>{
            if (this.error)
            {
                _this._log.warn('API error: %s %s %s', req.method,
                        req.originalUrl, zerr.e2s(this.error));
                return next(this.error);
            }
        });
        let json = res.json.bind(res);
        res.json = o=>{
            _this._log.debug('API %s %s %s %s', req.method, req.originalUrl,
                'resp', stringify(o));
            json(o);
        };
        if (roles&&!roles.includes(_this.mode))
            res.json({request_disallowed: true});
        else
            yield f.call(_this, req, res, next);
    });
};

E.prototype.stop_servers = etask._fn(
function*mgr_stop_servers(_this, force, www){
    _this._log.debug('Stopping servers');
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
    _.values(_this.socks_servers).forEach(stop_server);
    _.values(_this.proxies_running).forEach(stop_server);
    yield etask.all(servers);
    _this._log.debug('Servers stopped');
});

E.prototype.stop_dbs = etask._fn(function*mgr_stop_dbs(_this){
    this.on('uncaught', e=>_this._log.error('stop db %s', zerr.e2s(e)));
    if (!this.db)
        return;
    for (let db in _this.db)
    {
        if (db.stmt)
        {
            for (let st of db.stmt)
                st.finalize();
        }
        yield etask.nfn_apply(db, '.close', []);
    }
    _this.db = null;
});

E.prototype.stop = etask._fn(
function*mgr_stop(_this, reason, force, restart){
    yield _this.perr(restart ? 'restart' : 'exit', {reason});
    _this.is_running = false;
    yield _this.stop_servers(force, true);
    yield _this.stop_dbs();
    if (reason!='config change')
        yield _this.save_config();
    if (_this.ulimit_mgr)
        _this.ulimit_mgr.stop();
    _this.rmt_cfg.stop();
    if (reason instanceof Error)
        reason = zerr.e2s(reason);
    _this._log.notice('Manager stopped %O', {reason, force, restart});
    if (!restart)
        _this.emit('stop', reason);
});

E.prototype.sql = etask._fn(function*sql(_this){
    try {
        const args = [].slice.call(arguments, 1);
        _this._log.debug(`SQL: %O`, args);
        let res = yield etask.nfn_apply(_this.db.main, '.all', args);
        return res;
    } catch(e){
        _this._log.debug('SQL Error %s', zerr.e2s(e));
        throw e;
    }
});

E.prototype.har = function(entries){
    return {log: {
        version: '1.2',
        creator: {name: 'Luminati Proxy', version: pkg.version},
        pages: [],
        entries: entries.map(entry=>{
            const req = JSON.parse(entry.request_headers);
            const res = JSON.parse(entry.response_headers);
            const tl = (JSON.parse(entry.timeline)||[{}])[0];
            const headers = h=>_.toPairs(h).map(p=>({
                name: p[0],
                value: p[1],
            }));
            const elapsed = entry.elapsed||entry.response_time||0;
            const blocked = tl.create-tl.queued;
            const wait = tl.response-tl.create;
            const receive = elapsed-(tl.response-tl.create);
            entry.request_body = entry.request_body||'';
            return {
                uuid: entry.uuid||entry.timestamp,
                details: {
                    bw: entry.bw||entry.in_bw+entry.out_bw,
                    proxy_peer: entry.proxy_peer,
                    protocol: entry.protocol,
                    port: entry.port,
                },
                startedDateTime: new Date(tl.create).toISOString(),
                time: elapsed+blocked,
                request: {
                    method: entry.method,
                    url: entry.url,
                    host: entry.hostname,
                    httpVersion: 'unknown',
                    cookies: [],
                    headers: headers(req),
                    headersSize: -1,
                    postData: {
                        mimeType: req['content-type']||'',
                        text: entry.request_body,
                    },
                    bodySize: entry.request_body.length,
                    queryString: [],
                },
                response: {
                    status: entry.status_code,
                    statusText: entry.status_message||'',
                    httpVersion: 'unknown',
                    cookies: [],
                    headers: headers(res),
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
                timings: {blocked, send: 0, wait, receive},
                serverIPAddress: entry.super_proxy,
                comment: entry.username,
            };
        }),
    }};
};

E.prototype.save_config = function(){
    let filename = this.argv.config;
    if (!filename || !_.isString(filename))
        return;
    let proxies = this.proxies
        .filter(p=>p.proxy_type=='persist')
        .map(p=>_.omit(p, qw`stats proxy_type zones _update`))
        .map(p=>_.omitBy(p, v=>!v && v!==0 && v!==false))
        .map(p=>_.omitBy(p, (v, k)=>v===this._defaults[k]))
        .map(p=>_.omitBy(p, (v, k)=>v===E.default[k]))
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
            if (!p.zone)
                p.zone = this._defaults.zone;
            return p;
        });
    let _defaults = _(this._defaults)
        .pick(default_fields.filter(f=>f!='config'))
        .omitBy((v, k)=>v===E.default[k]);
    let s = stringify({proxies, _defaults}, {space: '  '});
    this._log.debug('Saving config to %s', filename);
    if (fs.existsSync(filename))
        fs.renameSync(filename, filename+'.backup');
    fs.writeFileSync(filename, s);
};

E.prototype.json = etask._fn(function*mgr_json(_this, opt){
    try {
        if (typeof opt=='string')
            opt = {url: opt};
        opt.json = true;
        let res = yield etask.nfn_apply(request, [opt]);
        _this._log.debug('GET %s - %s', opt.url, res.statusCode);
        return res;
    } catch(e){ ef(e);
        _this._log.debug('GET %s - %s', opt.url, zerr.e2s(e));
        throw e;
    }
});

E.prototype.archive_prefix = timestamp=>`Archive_${timestamp}_`;

E.prototype.schema_hash = schema=>crypto.createHash('md5')
    .update(stringify(schema)).digest('hex');

E.prototype.archive_copy = etask._fn(
function*archive_copy(_this, timestamp, copy_ip){
    let prefix = _this.archive_prefix(timestamp);
    if (copy_ip)
    {
        yield _this.sql(`INSERT INTO ip(ip, timestamp) `
            +`SELECT ip, timestamp FROM ${prefix}ip`);
    }
    let existing_hash = '';
    try {
        existing_hash = (yield _this.sql(
            `SELECT hash FROM ${prefix}schema_info LIMIT 1`))[0].hash;
    } catch(e){ ef(e); }
    let current = -1;
    for (let index in db_history)
    {
        if (existing_hash==_this.schema_hash(db_history[index].schema))
        {
            current = index;
            break;
        }
    }
    if (current!=-1)
    {
        let src_fields = [], dest_fields = [];
        for (let field in db_history[current].schema.request)
        {
            let src_field = field;
            let dest_field = field;
            let omit = false;
            for (let c = current-1; c>=0; c--)
            {
                let d = db_history[c];
                let add = d.add&&d.add.request;
                if (add&&add.includes(dest_field))
                    omit = false;
                let remove = d.remove&&d.remove.request;
                if (remove&&remove.includes(dest_field))
                    omit = true;
                let rename = d.rename&&d.rename.request;
                if (rename&&rename[dest_field])
                    dest_field = d.rename.request[dest_field];
            }
            if (omit)
                continue;
            src_fields.push(src_field);
            dest_fields.push(dest_field);
        }
        yield _this.sql(`INSERT INTO request(${dest_fields.join(',')}) `
            +`SELECT ${src_fields.join(',')} FROM ${prefix}request`);
    }
    for (let table of ['schema_info', 'ip', 'request'])
    {
        try {
            yield _this.sql(`ALTER TABLE ${prefix+table}
                RENAME TO ${prefix+table}_backup`);
        } catch(e){ ef(e);
            _this._log.warn(`Was not able to rename old table ${prefix+table},`
                +' this may lead to duplication of that table data.');
        }
    }
});

const open_db = _path=>etask(function*open_db(_this){
    let db;
    try {
        yield etask.nfn_apply((p, cb)=>db = new sqlite3.Database(p, cb),
            null, [_path]);
    } catch(e){
        _this._log.error('open db %s', zerr.e2s(e));
    }
    return db;
});

E.prototype.prepare_database = etask._fn(
function*mgr_prepare_database(_this){
    this.on('uncaught', e=>_this._log.error('prepare db %s', zerr.e2s(e)));
    if (_this.argv.log=='debug')
        sqlite3.verbose();
    _this.db = {};
    _this.db.main = yield open_db(_this.argv.database);
    let now = Date.now();
    let rows = yield _this.sql(
        'SELECT name FROM sqlite_master WHERE type="table"');
    let backup_expire = 30*86400*1000;
    for (let r of rows)
    {
        let m = r.name.match(/^Archive_(\d+)_.+_backup$/);
        if (m&&now-m[1]>backup_expire)
            yield _this.sql(`DROP TABLE ${r.name}`);
    }
    const tables = db_history[0].schema;
    const hash = _this.schema_hash(tables);
    try {
        let existing_hash = (yield _this.sql(`SELECT hash FROM schema_info
            LIMIT 1`))[0].hash;
        if (existing_hash==hash)
            return;
    } catch(e){ ef(e); }
    const prefix = _this.archive_prefix(now);
    const archive = yield _this.sql(`SELECT name FROM sqlite_master WHERE
        type='table' AND name IN ('${Object.keys(tables).join("','")}')`);
    if (archive.length)
    {
        for (let i=0; i<archive.length; i++)
        {
            const name = archive[i].name;
            yield _this.sql(`ALTER TABLE ${name} RENAME TO ${prefix+name}`);
        }
        const indexes = yield _this.sql(`SELECT name FROM sqlite_master WHERE
            type='index' AND sql IS NOT NULL`);
        for (let i=0; i<indexes.length; i++)
        {
            const name = indexes[i].name;
            yield _this.sql(`DROP INDEX ${name}`);
        }
    }
    for (let table in tables)
    {
        const fields = [], queries = [];
        for (let field in tables[table])
        {
            let value = assign({}, tables[table][field]);
            if (typeof value=='string')
                value = {type: value};
            value.primary = value.primary ? 'PRIMARY KEY' : '';
            value.default = value.default ? `DEFAULT ${value.default}` : '';
            fields.push(`${field} ${value.type} ${value.primary}
                ${value.default}`);
            if (value.index)
            {
                queries.push(`CREATE ${value.unique&&'UNIQUE'||''} INDEX
                    ${field} ON ${table}(${field})`);
            }
        }
        queries.unshift(`CREATE TABLE ${table}(${fields.join(', ')})`);
        for (let i=0; i<queries.length; i++)
            yield _this.sql(queries[i]);
    }
    yield _this.sql('INSERT INTO schema_info(hash, version) VALUES (?, ?)',
        hash, pkg.version);
    let archive_timestamps = yield _this.archive_timestamps();
    for (let i in archive_timestamps)
        yield _this.archive_copy(archive_timestamps[i], !i);
});

E.prototype.get_zones = etask._fn(function*mgr_get_zones(_this){
    let config = yield _this.get_lum_local_conf();
    if (!config._defaults || !config._defaults.zones)
        return [];
    return _.map(config._defaults.zones, (v, k)=>{
        return {zone: k, perm: get_zone_perm(v), plans: v.plans,
            password: (v.password||[])[0]};
    });
});

E.prototype.get_zones_api = etask._fn(
function*mgr_get_zones_api(_this, req, res){
    res.json(yield _this.get_zones());
});

E.prototype.get_consts = etask._fn(function*mgr_get_consts(_this, req, res){
    let proxy = _.mapValues(proxy_fields, desc=>({desc: desc}));
    _.forOwn(E.default, (def, prop)=>{
        if (proxy[prop])
            proxy[prop].def = def;
    });
    if (proxy.zone)
        proxy.zone.def = _this._defaults.zone;
    _.merge(proxy, {dns: {values: ['', 'local', 'remote']}});
    let ifaces = Object.keys(os.networkInterfaces())
    .map(iface=>({key: iface, value: iface}));
    ifaces.unshift({key: 'All', value: '0.0.0.0'});
    ifaces.unshift({key: 'Default (All)', value: ''});
    proxy.iface.values = ifaces;
    let zones = (yield _this.get_zones())
        .map(z=>assign({key: z.zone, value: z.zone, plans: []}, z));
    zones.unshift({key: `Default (${proxy.zone.def})`, value: ''});
    proxy.zone.values = zones;
    let pool_types = Object.keys(Luminati.pool_types).map(pool_type=>{
        return {key: pool_type, value: pool_type};
    });
    pool_types.unshift({key: `Default (${proxy.pool_type.def})`, value: ''});
    proxy.pool_type.values = pool_types;
    let log_levels = Object.keys(log.log_level).map(log_level=>{
        return {key: log_level, value: log_level};
    });
    log_levels.unshift({key: `Default (${_this.opts.log})`, value: ''});
    proxy.log.values = log_levels;
    proxy.country = {values: yield _this.get_countries()};
    proxy.debug.values = [
        {key: `Default (${proxy.debug.def})`, value: ''},
        {key: 'none', value: 'none'},
        {key: 'full', value: 'full'},
    ];
    const notifs = _this.lum_conf.lpm_notifs||[];
    res.json({proxy: proxy, notifs});
});

E.prototype.update_notifs = etask._fn(
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
    yield etask.nfn_apply(request, [{url: _this.argv.api, jar}]);
    const xsrf = (jar.getCookies(_this.argv.api).find(e=>
        e.key=='XSRF-TOKEN')||{}).value;
    const response = yield etask.nfn_apply(request, [{
        method: 'POST',
        url: `${_this.argv.api}/update_lpm_notifs`,
        qs: assign(_.pick(_this._defaults, qw`customer token`)),
        jar,
        json: true,
        headers: {'X-XSRF-Token': xsrf},
        form: {notifs},
    }]);
    res.json(response.body);
});

E.prototype.report_bug = etask._fn(function*mgr_report_bug(_this, req, res){
    let config_file = '', log_file = '';
    if (file.exists(_this.argv.config))
    {
        const buffer = fs.readFileSync(_this.argv.config);
        config_file = buffer.toString('base64');
    }
    const slash = process.platform=='win32' ? '\\' : '/';
    const log_path = os.homedir()+slash+log.log_file_name;
    if (file.exists(log_path))
    {
        let buffer = fs.readFileSync(log_path);
        buffer = buffer.slice(buffer.length - 50000);
        log_file = buffer.toString('base64');
    }
    const jar = _this.luminati_jar.jar;
    yield etask.nfn_apply(request, [{url: _this.argv.api, jar}]);
    const xsrf = (jar.getCookies(_this.argv.api).find(e=>
        e.key=='XSRF-TOKEN')||{}).value;
    const response = yield etask.nfn_apply(request, [{
        method: 'POST',
        url: `${_this.argv.api}/report_bug`,
        qs: assign(_.pick(_this._defaults, qw`customer token`)),
        jar,
        json: true,
        headers: {'X-XSRF-Token': xsrf},
        form: {report: {config: config_file, log: log_file,
            desc: req.body.desc, lpm_v: pkg.version, os: os.platform(),
            browser: req.body.browser}},
    }]);
    res.json(response.body);
});

E.prototype.get_history_context = etask._fn(
function*mgr_get_history_context(_this, req, res){
    let $port = req.params.port;
    let contexts = yield _this.sql(`SELECT DISTINCT context FROM request
        WHERE context IS NOT NULL AND port = $port`, {$port})||[];
    res.json(contexts.map(c=>({key: c.context, value: c.context})));
});

E.prototype.proxy_validator = function(conf){
    conf.customer = conf.customer||this._defaults.customer;
    conf.password = conf.password||this._defaults.password;
    conf.proxy_count = conf.proxy_count||this.argv.proxy_count;
    conf.proxy = [].concat(conf.proxy||this.argv.proxy);
    if (conf.whitelist_ips&&conf.whitelist_ips.length>0)
    {
        conf.whitelist_ips = conf.whitelist_ips
        .map(ip=>{
            try { return new Netmask(ip).base; }
            catch(e){ return null; }
        })
        .filter(ip=>ip!=null&&ip!='127.0.0.1');
        if (conf.whitelist_ips.length)
            conf.whitelist_ips.push('127.0.0.1');
    }
    numeric_fields.forEach(field=>{
        if (conf[field])
            conf[field] = +conf[field];
    });
};

E.prototype.error_handler = function error_handler(source, err){
    if (!err.raw)
        this._log.error(source+' error '+zerr.e2s(err));
    console.log('error_handler', err, zerr.e2s(err));
    this.emit('error', err);
};

E.prototype._fix_rules = function(rules){
    const _rules = _.cloneDeep(rules);
    if (rules===false)
        return false;
    if (typeof rules != 'object')
        return E.default.rules;
    if (!rules.post)
        return rules;
    if (!_.find(_rules.post, {tag: 'req_status'}))
        _rules.post.unshift(default_rule);
    return _rules;
};

E.prototype._fix_internal_bypass = function(c){
    let zone = this._get_proxy_zone(c);
    let plan = zone && get_zone_plan(zone.plans);
    let bypass_list = c.proxy_internal_bypass;
    if (plan && plan.type=='static' && plan.ips_type=='selective'
        && (plan.domain_whitelist||'').includes('google.com'))
    {
        bypass_list = c.proxy_internal_bypass
        .filter(d=>!/google\.com/.test(d));
        this._log.debug('google domain removed from bypass');
    }
    return bypass_list;
};

E.prototype._handle_mobile_perm = function(c){
    let zone = this._get_proxy_zone(c);
    if (zone)
        c.mobile = !!(get_zone_perm(zone)||'').includes('mobile');
    else
        c.mobile = false;
    return c;
};

E.prototype._get_proxy_zone = function(c){
    let zones = c.zones || ((this.lum_conf||{})._defaults||{}).zones;
    return zones&&zones[c.zone];
};

E.prototype._complete_proxy_config = function(conf){
    let c = assign({}, E.default, this._defaults, conf, this.argv_overlay);
    if (this.argv.request_stats)
        delete c.request_stats;
    c = this._handle_mobile_perm(c);
    c.proxy_internal_bypass = this._fix_internal_bypass(c);
    c.rules = this._fix_rules(c.rules);
    if (c.zone==this._defaults.zone && this._defaults.password)
    {
        c.password = this._defaults.password;
        // XXX jesse: get rid of this at end of April once configs are clean
        let proxy = this.proxies.find(p=>p.port==c.port);
        if (proxy)
            delete proxy.password;
    }
    return c;
};

E.prototype.create_single_proxy = etask._fn(
function*mgr_create_single_proxy(_this, conf){
    conf = _this._complete_proxy_config(conf);
    let server = new Luminati(conf, _this);
    server.on('error', err=>_this.error_handler('Proxy '+conf.port, err));
    _this._log.notice('Starting proxies %s', conf.socks ?
        `${conf.port}:${conf.socks}` : conf.port);
    yield server.listen();
    _this._log.debug('local proxy %O', _.omit(server.opt, qw`proxy_cache
        history_aggregator`));
    _this.proxies_running[server.port] = server;
    if (conf._update)
    {
        setImmediate(()=>{
            let proxy = _this.proxies.find(p=>p.port==conf.port);
            _this.proxy_update(proxy, proxy);
        });
    }
    return server;
});

const nop = ()=>{};

E.prototype.create_proxy = etask._fn(
function*mgr_create_proxy(_this, proxy){
    delete proxy._update;
    proxy = assign({}, _.omit(_this._defaults, 'zone'),
        _.omitBy(proxy, v=>!v && v!==0 && v!==false));
    let conf =
        assign({
            proxy_cache: _this.proxy_cache,
            history_aggregator: _this.argv.request_stats ?
                _this.stats_aggregator : _this.history_aggregator,
            proxy_internal_bypass: PROXY_INTERNAL_BYPASS,
        }, proxy);
    if (_this.argv.request_stats)
        delete conf.request_stats;
    let valid_creds = yield _this.check_proxy_creds(_.pick(conf,
        credential_fields));
    if (!valid_creds && !conf.allow_proxy_auth)
    {
        conf.only_bypass = PROXY_ONLY_BYPASS;
        conf.pool_size = 0;
    }
    _this.proxy_validator(conf);
    let proxies = yield _this._multiply_port(conf);
    let servers = yield etask.all(proxies.map(
        c=>_this.create_single_proxy(c)));
    let server = servers[0];
    server.duplicates = servers;
    servers.forEach(s=>{
        s.stop = nop;
        s.config = proxy;
    });
    server.stop = ()=>etask(function*mgr_server_stop(){
        const args = [].slice.call(arguments);
        _this._log.notice('Stopping proxies %s', servers.map(s=>s.port));
        return yield etask.all(servers.map(s=>{
            delete _this.proxies_running[s.port];
            return Luminati.prototype.stop.apply(s, args);
        }));
    });
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
        let dup = assign({}, port, {
            proxy_type: 'duplicate',
            duplicate_index: i,
        });
        dup.port = dup_port+i-1;
        if (port.socks)
            dup.socks = port.socks + i;
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

E.prototype.proxy_create = etask._fn(function*mgr_proxy_create(_this, data){
    let proxy = data.proxy;
    let server = yield _this.create_proxy(proxy);
    let timeout = data.idle_timeout;
    if (timeout)
    {
        server.on('idle', idle=>{
            if (server.timer)
            {
                clearTimeout(server.timer);
                delete server.timer;
            }
            if (!idle)
                return;
            server.timer = setTimeout(()=>server.stop(), +timeout);
        });
    }
    if (proxy.proxy_type == 'persist')
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
    let server = _this.proxies_running[port];
    if (!server)
        return;
    if (server.timer)
        clearTimeout(server.timer);
    yield server.stop();
    if (server.opt.proxy_type == 'persist')
    {
        let idx = _this.proxies.findIndex(p=>p.port==port);
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
    yield _this.proxy_create({proxy});
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
    let server = yield _this.proxy_create({proxy});
    res.json({data: server.opt});
});

E.prototype.proxy_update = etask._fn(
function*mgr_proxy_update(_this, old_proxy, new_proxy){
    let old_port = old_proxy.port;
    let port = new_proxy.port;
    if (port!==undefined)
    {
        let errors = yield _this.proxy_check({port: +port}, old_port);
        if (errors.length)
            throw {errors};
    }
    const stats = _this.proxies_running[old_port].stats;
    yield _this.proxy_delete(old_port);
    let proxy = assign({}, old_proxy, new_proxy); // XXX lee - ???
    proxy = _.omitBy(proxy, v=>v==='');
    let server = yield _this.proxy_create({proxy});
    _this.proxies_running[new_proxy.port||old_port].stats = stats;
    return server.opt;
});

E.prototype.proxy_update_api = etask._fn(
function*mgr_proxy_update_api(_this, req, res){
    let old_port = req.params.port;
    let old_proxy = _this.proxies.find(p=>p.port==old_port);
    if (!old_proxy)
        throw `No proxy at port ${old_port}`;
    if (old_proxy.proxy_type != 'persist')
        throw 'This proxy is read-only';
    try {
        res.json({data: yield _this.proxy_update(old_proxy, req.body.proxy)});
    } catch(e){ res.status(400).json({errors: e.errors}); }
});

E.prototype.proxy_banip_api = etask._fn(
function*mgr_proxy_banip_api(_this, req, res){
    let port = req.params.port;
    let proxy = _this.proxies_running[port];
    if (!proxy)
        throw `No proxy at port ${port}`;
    let {ip, ms = date.ms.HOUR} = req.body||{};
    if (!ip || !util_lib.is_ip(ip))
        throw `No ip provided`;
    if (yield proxy.banip(ip, ms))
        return res.status(204).end();
    throw `Failed to ban ip`;

});

E.prototype.proxy_unbanip_api = etask._fn(
function*mgr_proxy_unbanip_api(_this, req, res){
    let port = req.params.port;
    let proxy = _this.proxies_running[port];
    if (!proxy)
        throw `No proxy at port ${port}`;
    let {ip} = req.body||{};
    if (!ip || !util_lib.is_ip(ip))
        throw `No ip provided`;
    if (yield proxy.unbanip(ip))
        return res.status(204).end();
        throw `Failed to unban ip`;
});

E.prototype.proxy_delete_api = etask._fn(
function*mgr_proxy_delete_api(_this, req, res){
    let port = req.params.port;
    yield _this.proxy_delete(port);
    res.status(204).end();
});

E.prototype.refresh_sessions = function(req, res){
    let port = req.params.port;
    let server = this.proxies_running[port];
    if (!server)
        return res.status(400, 'Invalid proxy port').end();
    server.session_mgr.refresh_sessions();
    res.status(204).end();
};

E.prototype.proxy_status_get = etask._fn(
function*mgr_proxy_status_get(_this, req, res){
    const max_wait = 20;
    const period = 1000;
    let port = req.params.port;
    let force = req.query.force!==undefined
        && req.query.force!=='false' && req.query.force!=='0';
    let with_details = req.query.with_details!==undefined
        && req.query.with_details!=='false' && req.query.with_details!=='0';
    let proxy = _this.proxies_running[port];
    if (!proxy)
    {
        res.json({status: 'Unknown proxy'});
        return;
    }
    let fields = ['status'];
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
    for (let cnt = 0; proxy.status===null && cnt<= max_wait+2; cnt++)
        yield etask.sleep(period);
    if (proxy.status===null)
        return res.json({status: 'Unexpected lock on status check.'});
    if (proxy.status)
        return res.json(_.pick(proxy, fields));
    proxy.status = null;
    let success = false;
    try {
        let r = yield _this.json({
            url: _this._defaults.test_url,
            method: 'GET',
            proxy: `http://127.0.0.1:${port}`,
            timeout: max_wait*1000,
            headers: {
                'x-hola-context': 'STATUS CHECK',
                'x-hola-agent': Luminati.hola_agent,
                'user-agent': Luminati.user_agent
            }
        });
        success = r.statusCode==200;
    } catch(e){ ef(e); }
    proxy.status = success ? 'ok' : 'The proxy is not working properly';
    res.json(_.pick(proxy, fields));
});

E.prototype.proxy_port_check = etask._fn(
function*mgr_proxy_port_check(_this, port, duplicate, old_port, old_duplicate){
    duplicate = duplicate || 1;
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
        if (_.values(_this.proxies_running).map(x=>x.opt.socks).includes(p))
            return p + ' in use by another proxy SOCKS port';
        if (_this.argv.socks && _this.argv.socks.map(s=>s.split(':'[0])
            .includes(p)))
        {
            return p + ' in use by SOCKS interface';
        }
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

const check = v=>v!==undefined&&v!==0&&v!=='0'&&v!==false;

E.prototype.proxy_check = etask._fn(
function*mgr_proxy_check(_this, new_proxy_config, old_proxy_port){
    let old_proxy = old_proxy_port && _this.proxies_running[old_proxy_port]
        && _this.proxies_running[old_proxy_port].opt || {};
    let info = [];
    let port = new_proxy_config.port;
    let debug = new_proxy_config.debug;
    let zone = new_proxy_config.zone;
    let effective_zone = zone||E.default.zone;
    let password = new_proxy_config.password;
    let history = new_proxy_config.history;
    let _ssl = new_proxy_config.ssl;
    let socks = new_proxy_config.socks;
    let multiply = new_proxy_config.multiply;
    let null_response = new_proxy_config.null_response;
    let bypass_proxy = new_proxy_config.bypass_proxy;
    let direct_include = new_proxy_config.direct_include;
    let direct_exclude = new_proxy_config.direct_exclude;
    let max_requests = check(new_proxy_config.max_requests);
    let session_duration = check(new_proxy_config.session_duration);
    let keep_alive = check(new_proxy_config.keep_alive);
    let pool_size = check(new_proxy_config.pool_size);
    let sticky_ip = new_proxy_config.sticky_ip;
    let session = check(new_proxy_config.session);
    let reverse_lookup_dns = new_proxy_config.reverse_lookup_dns;
    let reverse_lookup_file = new_proxy_config.reverse_lookup_file;
    let reverse_lookup_values = new_proxy_config.reverse_lookup_values;
    if (port!==undefined)
    {
        if (!port)
            info.push({msg: 'invalid port', lvl: 'err', field: 'port'});
        else
        {
            let in_use = yield _this.proxy_port_check(port, multiply,
                old_proxy_port, old_proxy.multiply);
            if (in_use)
            {
                info.push({msg: 'port '+in_use, lvl: 'err',
                    field: 'port'});
            }
        }
    }
    let invalid_zone;
    let db_zone, db_zone_plan;
    if (zone!==undefined)
    {
        let info_length = info.length;
        let zones = yield _this.get_zones();
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
        invalid_zone = info.length>info_length;
    }
    if (zone==_this._defaults.zone && _this._defaults.password &&
        encodeURIComponent(password)!=
        encodeURIComponent(_this._defaults.password) &&
        !new_proxy_config.ext_proxies)
    {
        info.push({msg: 'provided password overridden by default password for'+
            ' zone '+zone, lvl: 'warn', field: 'password'});
    }
    if (zone!==undefined && password && !invalid_zone)
    {
        if (!(yield _this.check_proxy_creds({zone,
            password: encodeURIComponent(password)})).result)
        {
            info.push({msg: 'the provided password is not valid',
                lvl: 'err', field: 'password'});
        }
    }
    else if (effective_zone==='gen'&&password)
    {
        info.push({msg: 'the password field should be absent for default zone',
            lvl: 'warn', field: 'password'});
    }
    if (!invalid_zone && db_zone)
    {
        let perms = get_zone_perm(db_zone).split(' ');
        ['country', 'state', 'city', 'asn', 'ip'].forEach(field=>{
            if (new_proxy_config[field]!==undefined
                && new_proxy_config[field].length && !perms.includes(field))
            {
                info.push({msg: `the zone doesn't have permissions for `
                    +field+' field', lvl: 'err', field});
            }
        });
    }
    if (debug!==undefined)
    {
        if (!['', 'none', 'full'].includes(debug))
            info.push({msg: 'invalid value', lvl: 'err', field: 'debug'});
    }
    if (history && _ssl!==undefined && !_ssl)
    {
        info.push({
            msg: 'Logs without SSL Logs will not record '
            +'HTTPS requests in full, it will only record the CONNECT '
            +'request',
            lvl: 'warn',
        });
    }
    if (history && debug=='none')
    {
        info.push({
            msg: 'history without debug info will not record '
            +'peer information per request',
            lvl: 'warn',
        });
    }
    if (socks!=undefined)
    {
        let in_use = yield _this.proxy_port_check(socks, multiply,
            old_proxy.socks, old_proxy.multiply);
        if (in_use)
            info.push({msg: 'socks port '+in_use, lvl: 'err', field: 'socks'});
    }
    if (socks)
    {
        let r_dns = reverse_lookup_dns===undefined ?
            old_proxy.reverse_lookup_dns : reverse_lookup_dns;
        let r_file = reverse_lookup_file===undefined ?
            old_proxy.reverse_lookup_file : reverse_lookup_file;
        let r_values = reverse_lookup_values===undefined ?
            old_proxy.reverse_lookup_values : reverse_lookup_values;
        if (!r_dns && !r_file && !r_values)
        {
            info.push({
                msg: 'SOCKS without \'Reverse DNS resolve\' will make '
                +'HTTPS requests from the super proxy and not from the '
                +'proxy peer',
                lvl: 'warn',
            });
        }
    }
    if ((null_response||bypass_proxy||direct_include||direct_exclude) &&
        _ssl!==undefined && !_ssl)
    {
        info.push({
            msg: 'Special URL handling without SSL Log will '
            +'only be able to handle HTTPS domains, and not specific '
            +'URLs',
            lvl: 'warn',
        });
    }
    if ((max_requests||session_duration) && !pool_size && !sticky_ip
        && new_proxy_config.session!==true)
    {
        info.push({
            msg: 'max_requests, session_duration will not take effect '
            +'without specifying pool_size, sticky_ip or random session',
            lvl: 'warn',
        });
    }
    if (keep_alive && !pool_size && !sticky_ip && !session)
    {
        info.push({
            msg: 'keep_alive will not take effect without specifying '
            +'pool_size, sticky_ip or session',
            lvl: 'warn',
        });
    }
    if (keep_alive && (new_proxy_config.keep_alive>60
        || new_proxy_config.keep_alive<0))
    {
        info.push({
            msg: 'keep_alive value is outside the effective range of 0-60',
            lvl: 'warn',
        });
    }
    if (pool_size && (sticky_ip || session))
    {
        info.push({
            msg: 'sticky_ip and session will not take effect when pool_size '
            +'is specified',
            lvl: 'warn',
        });
    }
    if (!pool_size && sticky_ip && session)
    {
        info.push({
            msg: 'session will not take effect when sticky_ip is specified',
            lvl: 'warn',
        });
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
    try {
        errors = this.config_check(JSON.parse(req.body.config));
    } catch(e){ ef(e);
        this._log.debug('Config parsing error '+zerr.e2s(e));
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
        }
        else
            ports[port] = desc;
    };
    if (config._defaults.www)
        chk_port(config._defaults.www, 'UI/API');
    config.proxies.forEach((p, i)=>{
        const id = `Proxy #${i+1}`;
        const opt = assign({}, config._defaults, p);
        chk_port(opt.port, id);
        if (p.socks)
            chk_port(p.socks, id+' SOCKS');
        let multiply = p.multiply||1;
        for (let d = 1; d<multiply; ++d)
        {
            chk_port(opt.port+d, id+' Duplicate');
            if (p.socks)
                chk_port(p.socks+d, id+' Duplicate SOCKS');
        }
    });
    // XXX lee - add check for SOCKS tunnels and auto assigned ports
    return _.toPairs(conflicts).map(c=>`Conflict on port ${c[0]} was found `
        +'with the folowing configurations: '+c[1].join(', '));
};

E.prototype.test = function(req, res){
    const opt = assign(_.pick(req.body, qw`url method headers body`), {
        followRedirect: false,
    });
    if (+req.params.port)
    {
        opt.proxy = 'http://127.0.0.1:'+req.params.port;
        if (this.proxies_running[req.params.port].opt.ssl)
            opt.ca = ssl.ca.cert;
        opt.headers = opt.headers||{};
        opt.headers['x-hola-context'] = opt.headers['x-hola-context']
            ||'PROXY TESTER TOOL';
    }
    request(opt, (err, http_res)=>{
        res.json(err ? {error: ''+err} : {
            request: {
                url: opt.url,
                method: opt.method,
                headers: opt.headers,
                body: opt.body,
                version: req.httpVersion,
            },
            response: {
                version: http_res.httpVersion,
                status_code: http_res.statusCode,
                status_message: http_res.statusMessage,
                headers: http_res.headers,
                body: http_res.body,
            },
        });
    });
};

E.prototype.test_ports = etask._fn(function*mgr_test_ports(_this, req, res){
    if (!req.query.ports)
        return res.status(400).end();
    res.setTimeout(0);
    const response = load_json(port_test_results_file, {silent: true})||{};
    const ports = req.query.ports.split(',').map(p=>+p).filter(p=>p&&
        !(response[p]&&response[p].response&&response[p].response.body.pass));
    let _reqs = [];
    let tasks = ports.map(p=>etask(function*mgr_test_port(){
        _reqs.push(request({
                url: `${_this.argv.api}/cp/lum_local_firewall_check`,
                qs: assign(_.pick(_this._defaults, qw`customer token`),
                    {port: p}),
                jar: _this.luminati_jar.jar,
                json: true,
                timeout: 60*date.ms.SEC,
            },
            (err, http_res)=>{
                response[p]= err ? {error: ''+err} : {
                    response: {
                        status_code: http_res.statusCode,
                        status_message: http_res.statusMessage,
                        body: http_res.body,
                        ts: +new Date(),
                    },
                };
                this.continue();
            }
        ));
        yield this.wait();
    }));
    res.on('close', ()=>_reqs.forEach(r=>r.abort()));
    yield etask.all(tasks);
    setImmediate(()=>{
        try { file.write_e(port_test_results_file, JSON.stringify(response)); }
        catch(e){ }
    });
    res.json(_.pick(response, req.query.ports.split(',')));
});

E.prototype.proxy_ip = etask._fn(function*mgr_proxy_ip(_this, proxy){
    if (/^\d+\.\d+\.\d+\.\d+$/.test(proxy))
        return proxy;
    if (proxy.length==2)
        proxy = `servercountry-${proxy}.${_this.argv.proxy}`;
    try {
        _this._log.debug('Resolving proxy domain: %s', proxy);
        let ips = yield etask.nfn_apply(dns, '.resolve', [proxy]);
        return ips[0];
    } catch(e){
        _this._log.error('Failed to resolve proxy domain name: '+proxy+' '
            +zerr.e2s(e));
        return null;
    }
});

E.prototype.country = etask._fn(function*mgr_country(_this, req, res){
    if (!phantomjs)
    {
        res.status(500).send('PhantomJS package is not installed');
        return;
    }
    const c = req.query.country;
    const _url = req.query.url;
    const _path = req.query.path||phantomjs.path;
    if (!fs.existsSync(_path))
    {
        res.status(500).send('The provided path to PhantomJS is incorrect');
        return;
    }
    const ua = req.query.ua;
    const headers = JSON.parse(req.query.headers||'{}');
    if (!headers['Accept-Language'])
    {
        const get_locales = ()=>new Promise(resolve=>{
            country_language.getCountryMsLocales(c, function(e, locales){
                resolve(locales);
            });
        });
        const locales = yield get_locales();
        const lang = l=>`${l},${l.substr(0, 2)};q=0.8`;
        headers['Accept-Language'] = lang(
            locales&&locales[0] ? locales[0].langCultureName : 'en-US');
    }
    try {
        let proxy = yield _this.proxy_ip(_this.argv.proxy);
        const cust = _this.argv.customer||_this._defaults.customer;
        const key = _this.argv.password||_this._defaults.password;
        const zone = _this.argv.zone||_this._defaults.zone;
        webshot(_url, '', {
            shotSize: {width: 'all', height: 'all'},
            phantomPath: _path,
            phantomConfig: {
                proxy: `${proxy}:${_this.argv.proxy_port}`,
                'proxy-auth': `lum-customer-${cust}-zone-`
                    +`${zone}-country-${c}:${key}`,
            },
            customHeaders: headers,
            userAgent: ua,
        }).pipe(res);
    } catch(e){ res.status(502).send('An error occurred'); }
});

E.prototype.archive_timestamps = etask._fn(
function*mgr_archive_timestamps(_this){
    let rows = yield _this.sql(
        'SELECT name FROM sqlite_master WHERE type="table"');
    let timestamps = [];
    for (let r of rows)
    {
        let m = r.name.match(/^Archive_(\d+)_request$/);
        if (m)
            timestamps.push(+m[1]);
    }
    timestamps.sort().reverse();
    return timestamps;
});

E.prototype.history_get = etask._fn(function*mgr_history_get(_this, req, res){
    let result = yield _this.filtered_get(req);
    res.json(result);
});

E.prototype.get_countries = etask._fn(function*mgr_get_countries(_this){
    let countries = yield cities.countries();
    countries = countries.map(c=>({
        key: c.country_name,
        value: c.country_id.toLowerCase(),
    }));
    countries.forEach(c=>c.key=`${c.key} (${c.value.toUpperCase()})`);
    countries.unshift({key: 'Any', value: '*'});
    countries.unshift({key: 'Default ('+(_this.opts.country||'Any')+')',
        value: ''});
    return countries;
});

E.prototype.get_all_locations = etask._fn(
function*mgr_get_all_locations(_this, req, res){
    let data = yield cities.all_locations();
    res.json(data);
});

E.prototype.get_regions = etask._fn(function*mgr_get_regions(_this, req, res){
    let regions = yield cities.regions(req.params.country_id);
    regions = regions.map(r=>({
        key: `${r.region_name} (${r.region_id.toUpperCase()})`,
        value: r.region_id,
    }));
    regions.unshift({key: 'Any', value: '*'});
    regions.unshift({key: 'Default ('+(_this.opts.state||'Any')+')',
        value: ''});
    res.json(regions);
});

E.prototype.get_cities = etask._fn(function*mgr_get_cities(_this, req, res){
    const c_id = req.params.country_id;
    const r_id = req.params.region_id;
    if (!c_id)
        return res.json([]);
    let _cities = yield cities.cities(c_id, r_id);
    _cities = _cities.map(c=>({
            key: c.city_name,
            value: c.city_name,
            region: c.region_id,
        }));
    _cities.unshift({key: 'Any', value: '*'});
    _cities.unshift({key: 'Default ('+(_this.opts.city||'Any')+')',
        value: ''});
    res.json(_cities);
});

E.prototype.logs_suggestions = etask._fn(
function*logs_suggestions(_this, req, res){
    const ports = yield _this.sql(`SELECT DISTINCT port as val FROM request`);
    const domains = yield _this.sql(`SELECT DISTINCT hostname as val FROM
        request`);
    const protocols = yield _this.sql(`SELECT DISTINCT protocol as val FROM
        request`);
    const codes = yield _this.sql(`SELECT DISTINCT status_code as val FROM
        request`);
    const suggestions = {
        ports: ports.map(v=>v.val),
        domains: domains.map(v=>v.val),
        codes: codes.map(v=>v.val),
        protocols: protocols.map(v=>v.val),
    };
    res.json(suggestions);
});

E.prototype.logs_get = etask._fn(function*mgr_history_get(_this, req, res){
    let result = yield _this.filtered_get(req);
    res.json(Object.assign({}, _this.har(result.items), {total: result.total,
        skip: result.skip}));
});

E.prototype.logs_har_get = etask._fn(
function*mgr_history_har_get(_this, req, res){
    res.setHeader('content-disposition', 'attachment; filename=data.har');
    res.setHeader('content-type', 'application/json');
    let result = yield _this.filtered_get(req);
    res.json(_this.har(result.items));
});

E.prototype.history_har_get = etask._fn(
function*mgr_history_har_get(_this, req, res){
    res.setHeader('content-disposition', 'attachment; filename=data.har');
    res.setHeader('content-type', 'application/json');
    let result = yield _this.filtered_get(req);
    res.json(_this.har(result.items));
});

E.prototype.history_csv_get = etask._fn(
function*mgr_history_csv_get(_this, req, res){
    res.setHeader('content-disposition', 'attachment; filename=data.csv');
    res.setHeader('content-type', 'text/csv');
    let result = yield _this.filtered_get(req);
    res.send(json2csv({data: result.items}));
});

E.prototype.filtered_get = etask._fn(function*mgr_filtered_get(_this, req){
    this.on('uncaught', e=>_this._log.error('filtered get %s', zerr.e2s(e)));
    const for_db = s=>(s||'').replace("'", "''");
    const skip = +req.query.skip||0;
    const limit = +req.query.limit||0;
    let items, total;
    req.query.status_code = req.query.code;
    req.query.hostname = req.query.domain;
    const wheres = ['port', 'hostname', 'protocol', 'status_code'].map(param=>{
        if (!req.query[param])
            return null;
        return req.query[param].split(',').map(v=>`${param} = '${for_db(v)}'`)
            .join(' OR ');
    }).filter(Boolean).join(') AND (');
    const where = wheres ? 'WHERE ('+wheres+')' : '';
    const order_by = req.query.sort ? `ORDER BY ${req.query.sort}
        ${req.query.sort_desc ? 'DESC' : ''}` : '';
    items = yield _this.sql(
        `SELECT in_bw+out_bw as bw, * FROM request ${where} ${order_by}`
        + (limit ? ` LIMIT ${limit} OFFSET ${skip}` : ''));
    total = (yield _this.sql(`SELECT COUNT(*) FROM request ${where}`))[0]
    ['COUNT(*)'];
    if (_this.mode!='root')
    {
        for (let row of items)
        {
            if (row.request_headers)
            {
                let h = JSON.parse(row.request_headers);
                for (let header of Luminati.hola_headers)
                {
                    if (h[header])
                        h[header] = '[hidden]';
                }
                row.request_headers = JSON.stringify(h);
            }
        }
    }
    return {
        total: total,
        skip: skip,
        limit: limit,
        items: items,
    };
});

E.prototype.sessions_get = etask._fn(
function*mgr_sessions_get(_this, req, res){
    let port = req.params.port;
    let server = _this.proxies_running[port];
    if (!server)
    {
        return res.status(400)
        .json({errors: [{msg: `No proxy at port ${port}`}]});
    }
    if (req.query.refresh!==undefined)
        yield server.session_mgr.update_all_sessions();
    let sess;
    if (server.opt.pool_size)
    {
        sess = server.session_mgr.sessions
            &&server.session_mgr.sessions.sessions||[];
    }
    else if (server.opt.sticky_ip)
        sess = _.values(server.session_mgr.sticky_sessions||{});
    else if (server.session_mgr.session)
        sess = [server.session_mgr.session];
    sess = (sess||[]).map(s=>_.pick(s, qw`info count bandwidth created host`));
    res.json({data: sess});
});

E.prototype.node_version = etask._fn(
function*mgr_node_version(_this, req, res){
    if (process.versions && !!process.versions.electron)
        return res.json({is_electron: true});
    const chk = yield etask.nfn_apply(check_node_version,
        [{node: pkg.recomendedNode}]);
    res.json({
        current: chk.node.version,
        satisfied: chk.node.isSatisfied,
        recommended: pkg.recomendedNode,
    });
});

E.prototype._last_version = etask._fn(function*mgr__last_version(_this){
    const r = yield _this.json({
        url: 'http://client.hola.org/client_cgi/lpm_config.json',
        qs: {customer: _this._defaults.customer, md5: pkg.lpm.md5,
            ver: pkg.version},
    });
    const newer = r.body.ver && semver.lt(pkg.version, r.body.ver);
    return assign({newer}, r.body);
});

E.prototype.last_version = etask._fn(
function*mgr_last_version(_this, req, res){
    const r = yield _this._last_version();
    res.json({version: r.ver, newer: r.newer});
});

E.prototype.stats = etask._fn(function*mgr_stats(_this, req, res){
    const r = yield _this.json({
        url: `${_this.argv.api}/api/get_customer_bw?details=1`,
        headers: {'x-hola-auth': `lum-customer-${_this._defaults.customer}`
            +`-zone-${_this._defaults.zone}-key-${_this._defaults.password}`},
    });
    const _stats = r.body[_this._defaults.customer];
    if (!_stats)
        yield _this.logged_update();
    res.json(_stats||{login_failure: _this.login_failure});
});

E.prototype.whitelist = etask._fn(function*mgr_whitelist(_this, req, res){
    const r = yield _this.json({
        url: `${_this.argv.api}/api/get_whitelist?zones=*`,
        headers: {'x-hola-auth': `lum-customer-${_this._defaults.customer}`
            +`-zone-${_this._defaults.zone}-key-${_this._defaults.password}`},
    });
    res.json(r.body);
});

E.prototype.recent_ips = etask._fn(function*mgr_recent_ips(_this, req, res){
    const r = yield _this.json({
        url: `${_this.argv.api}/api/get_recent_ips?zones=*`,
        headers: {'x-hola-auth': `lum-customer-${_this._defaults.customer}`
            +`-zone-${_this._defaults.zone}-key-${_this._defaults.password}`},
    });
    res.json(r.body);
});

E.prototype.get_params = function(){
    const args = [];
    for (let k in this.argv)
    {
        if (qw`$0 h help version p ? v`.includes(k))
            continue;
        if (credential_fields.includes(k))
            continue;
        if (this.argv[k]==E.default[k])
            continue;
        if (boolean_fields.includes(k)||this.argv[k]===false)
        {
            args.push(`--${this.argv[k]?'':'no-'}${k}`);
            continue;
        }
        [].concat(this.argv[k]).forEach(v=>{
            if (k!='_')
                args.push('--'+k);
            args.push(v);
        });
    }
    if (!this.argv.config)
    {
        // must provide these as args to enable login w/o config
        for (let k of credential_fields.sort())
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
        config: this.argv.config,
        resolve: this._defaults.resolve,
        argv: this.get_params().join(' '),
        test_url: this._defaults.test_url,
        api: this.argv.api,
    };
};

E.prototype.config_get = function(req, res){
    res.json({config: file.exists(this.argv.config) ?
        file.read_e(this.argv.config) : ''});
};

E.prototype.config_set = function(req, res){
    file.write_e(this.argv.config, req.body.config);
    res.json({result: 'ok'});
    this.emit('config_changed');
};

E.prototype.resolve_get = function(req, res){
    if (!file.exists(this.argv.resolve))
    {
        res.status(404).json({error: 'Resolution file does not exist'});
        return;
    }
    res.json({resolve: file.read_e(this.argv.resolve)});
};

E.prototype.resolve_set = function(req, res){
    if (!file.exists(this.argv.resolve))
    {
        res.status(500).json({error: 'Resolution file does not exist'});
        return;
    }
    file.write_e(this.argv.resolve, req.body.resolve);
    res.json({result: 'ok'});
    this.emit('config_changed');
};

E.prototype.resolve_host = etask._fn(
function*mgr_resolve_host(_this, req, res){
    let host = req.params.host;
    try {
        let ips = yield etask.nfn_apply(dns, '.resolve', [host]);
        res.json({ips: ips});
    } catch(e){ res.json({ips: null}); }
});

E.prototype.get_ip = etask._fn(
function*mgr_get_ip(_this){
    try {
        const result = yield _this.json({
            url: 'http://lumtest.com/myip.json',
            method: 'GET',
            headers: {
                'x-hola-agent': Luminati.hola_agent,
                'user-agent': Luminati.user_agent,
            }
        });
        return result.body;
    } catch(e){ ef(e); return false; }
});

E.prototype.check_proxy_creds = etask._fn(
function*mgr_check_proxy_creds(_this, cred){
    cred = _.pick(assign({}, _this._defaults, cred), credential_fields);
    let cc_key = cred.customer+cred.zone+cred.password;
    let cc_cache = proxy_creds_check_cache;
    if (_this.run_config.bypass_credentials_check||
        !_this.argv.proxy_creds_check || cc_cache[cc_key])
    {
        return cc_cache[cc_key] || {result: true, error: false};
    }
    try {
        _this._log.debug('Testing credentials: %O', cred);
        let res = yield _this.json({
            url: `${_this.argv.api}/api/is_valid_cred?`
                +Luminati.hola_agent.split(' ')[0],
            headers: {'x-hola-auth':
                `lum-customer-${cred.customer}`
                +`-zone-${cred.zone}-key-${cred.password}`},
        });
        return cc_cache[cc_key] = {result: res.body.ret,
            error: !res.body.ret && 'invalid creds'};
    } catch(e){ ef(e); return {result: false, error: 'unknown'}; }
});

E.prototype.creds_user_set = etask._fn(
function*mgr_creds_user_set(_this, req, res){
    let config = yield _this.login_user(req.body.token,
        req.body.username, req.body.password, req.body.customer||
        _this._defaults.customer);
    if (config.error)
    {
        res.status(401).json(config);
        return;
    }
    if (config.customers)
    {
        res.json({customers: config.customers});
        return;
    }
    assign(_this._defaults, config.defaults);
    _this.save_config();
    yield _this.logged_update();
    res.json({result: 'ok'});
});

E.prototype.proxies_running_get = etask._fn(
function*mgr_proxies_running_get(_this, req, res){
    const rows = yield _this.sql('SELECT DISTINCT port FROM request');
    const usage = yield _this.sql('SELECT * FROM usage');
    let index = {};
    for (let row of rows)
        index[row.port] = true;
    let stats = {};
    for (let u of usage)
        stats[u.port_id] = u;
    res.json(Object.values(_this.proxies_running).map(p=>{
        let proxy = _.cloneDeep(p.opt);
        proxy._stats = p.stats;
        proxy._history = p.opt.history||index[proxy.port]||false;
        proxy._status = p.status;
        proxy._status_details = p.status_details;
        proxy.config = p.config;
        proxy.stats = stats[proxy.port];
        return proxy;
    }).filter(p=>p.port!=22225||p.stats&&p.stats.real_bw));
});

E.prototype.ip_get = etask._fn(function*mgr_ip_get(_this, req, res){
    const ip = yield _this.get_ip();
    res.json({ip: ip});
});

E.prototype.request_allocated_ips = etask._fn(
function*mgr_request_allocated_ips(_this, zone, password){
    const r = yield _this.json({
        url: `${_this.argv.api}/users/zone/alloc_ips`,
        headers: {'x-hola-auth': `lum-customer-${_this._defaults.customer}`
        +`-zone-${zone}-key-`
        +(password||_this._defaults.password)},
    });
    return r.body;
});

E.prototype.request_allocated_vips = etask._fn(
function*mgr_request_allocated_vips(_this, zone, password){
    const r = yield _this.json({
        url: `${_this.argv.api}/api/get_route_vips`,
        headers: {'x-hola-auth': `lum-customer-${_this._defaults.customer}`
        +`-zone-${zone}-key-`
        +(password||_this._defaults.password)},
    });
    return r.body;
});

E.prototype.allocated_ips_get = etask._fn(
function*mgr_allocated_ips_get(_this, req, res){
    res.send(yield _this.request_allocated_ips(req.query.zone, req.query.key));
});

E.prototype.allocated_vips_get = etask._fn(
function*mgr_allocated_vips_get(_this, req, res){
    res.send(yield _this.request_allocated_vips(req.query.zone,
        req.query.key));
});

E.prototype.shutdown = function(req, res){
    res.json({result: 'ok'});
    this.stop(true);
};

E.prototype.logout = etask._fn(function*mgr_logout(_this, req, res){
    for (let k of credential_fields)
        _this._defaults[k] = '';
    _this.save_config();
    _this.lum_conf = undefined;
    cookie_jar = undefined;
    const jarpath = _this.argv.cookie;
    if (fs.existsSync(jarpath))
        fs.writeFileSync(jarpath, '');
    _this.luminati_jar = undefined;
    yield _this.logged_update();
    res.json({result: 'ok'});
});

E.prototype.restart = function(req, res){
    this.emit('restart');
    res.json({result: 'ok'});
};

E.prototype._upgrade = etask._fn(function*mgr__upgrade(_this, cb){
    yield _this.stop_dbs();
    _this.emit('upgrade', cb);
});

E.prototype.upgrade = etask._fn(function*mgr_upgrade(_this, req, res){
    yield _this._upgrade(e=>e ? res.status(403).send(e)
        : res.json({result: 'ok'}));
});

E.prototype.check_upgrade = etask._fn(function*mgr_check_upgrade(_this){
    if (_this.upgrading)
        return;
    const root = path.resolve(__dirname, '..'), lpm = pkg.lpm||{};
    _this.code_md5 = _this.code_md5 ||
        md5_util.md5_files(lpm.files||[], {root});
    if (_this.code_md5!=lpm.md5)
    {
        return _this._log.debug('pkg md5 %s differs from code md5 %s',
            pkg.lpm.md5, _this.code_md5);
    }
    _this.upgrading = true;
    const res = yield etask.fn_apply(request, [{
        url: 'http://client.hola.org/client_cgi/lpm_config.json',
        qs: {ver: pkg.version, md5: _this.code_md5},
        json: true,
    }]);
    if (!res || !res.ver)
        return _this.upgrading = false;
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

E.prototype.start_ulimit = function(){
    this.ulimit_mgr = new Ulimit_manager(this, {
        log: this.argv.log,
        chk_fd: true,
    });
    return this.ulimit_mgr.start();
};

E.prototype.recheck = etask._fn(function*mgr_recheck(_this, req, res){
    yield _this.logged_update();
    res.json({login_failure: _this.login_failure});
});

E.prototype.proxy_stats_get = etask._fn(
function*mgr_proxy_stats_get(_this, req, res){
    const stats = yield _this.sql(`SELECT * FROM usage`);
    res.json({stats});
});

E.prototype.proxy_stats_reset = etask._fn(
function*mgr_proxy_stats_reset(_this, req, res){
    yield _this.sql('UPDATE usage SET reqs=0, bw=0');
    return res.end();
});

E.prototype.request_stats_har = function(req, res){
    res.setHeader('content-type', 'application/json');
    this.request_stats.all = this.request_stats.all||{stats: []};
    res.json(this.har(this.request_stats.all.stats));
};

E.prototype.request_stats_get = function(req, res){
    let type = req.params.type||'top';
    if (!this.request_stats)
        return res.json({[type]: {}});
    let results;
    if (qw`top all http https`.includes(type))
        results = this.request_stats[type];
    else if (/^\d+$/.test(type))
    {
        results = {
            stats: _(((this.request_stats.http||{})[type]||{stats: []}).stats)
            .concat(((this.request_stats.https||{})[type]||{stats: []}).stats)
            .filter(_.matches({status_code: +type})).value(),
        };
    }
    else
    {
        results = {stats: (this.request_stats.all||{stats: []}).stats
            .filter(_.matches({hostname: type}))};
    }
    // show last request first
    if (results && results.stats)
        results.stats.reverse();
    res.json({[type]: results && results.stats || results});
};

E.prototype.request_stats_reset = function(req, res){
    if (this.request_stats)
        this.request_stats = {};
    res.end();
};

E.prototype.get_req_status_cnt = function get_req_status_cnt(){
    const proxies = Object.keys(this.proxies_running).map(key=>({key,
        value: this.proxies_running[key].stats}));
    return proxies.reduce((acc, proxy)=>{
        const ps = {total: 0, success: 0, bw_down: 0, bw_up: 0, real_reqs: 0};
        const hsts = proxy.value.by_hsts;
        for (let h in hsts)
        {
            ps.total += hsts[h].success+hsts[h].fail||0;
            ps.success += hsts[h].success||0;
            ps.bw_down += hsts[h].real_inbound||0;
            ps.bw_up += hsts[h].real_outbound||0;
            ps.real_reqs += hsts[h].real_reqs||0;
        }
        acc.total += ps.total;
        acc.success += ps.success;
        acc.bw_down += ps.bw_down;
        acc.bw_up += ps.bw_up;
        acc.real_reqs += ps.real_reqs;
        acc[proxy.key] = ps;
        return acc;
    }, {total: 0, success: 0, bw_down: 0, bw_up: 0, real_reqs: 0});
};

E.prototype.reset_req_status_cnt_api = function(req, res){
    Object.values(this.proxies_running).forEach(proxy=>{
        proxy.stats.reset_all(); });
    res.end();
};

E.prototype.get_req_status_cnt_api = function(req, res){
    let port = req.params.port;
    let cnt = this.get_req_status_cnt();
    if (port)
    {
        return res.json(cnt[port]||
            {total: 0, success: 0, bw_down: 0, bw_up: 0, real_reqs: 0});
    }
    return res.json(cnt);
};

E.prototype.create_api_interface = function(){
    const app = express();
    app.get('/swagger', this._api((req, res)=>res.json(swagger)));
    app.get('/consts', this._api(this.get_consts));
    app.get('/history_context/:port', this._api(this.get_history_context));
    app.get('/hola_headers', this._api((req, res)=>res.json(
        Luminati.hola_headers.filter(h=>h!='x-hola-agent'))));
    app.get('/defaults', this._api((req, res)=>res.json(this.opts)));
    app.get('/version', this._api((req, res)=>res.json(
        {version: pkg.version})));
    app.get('/last_version', this._api(this.last_version));
    app.get('/node_version', this._api(this.node_version));
    app.get('/proxies_running', this._api(this.proxies_running_get));
    app.get('/proxies', this._api((req, res)=>res.json(this.proxies)));
    app.post('/proxies', this._api(this.proxy_create_api, ['root', 'normal']));
    app.post('/proxy_dup', this._api(this.proxy_dup_api));
    app.post('/proxies/:port/banip', this._api(
        this.proxy_banip_api, ['root', 'normal']));
    app.delete('/proxies/:port/banip', this._api(
        this.proxy_unbanip_api, ['root', 'normal']));
    app.put('/proxies/:port', this._api(
        this.proxy_update_api, ['root', 'normal']));
    app.delete('/proxies/:port', this._api(
        this.proxy_delete_api, ['root', 'normal']));
    app.post('/refresh_sessions/:port', this._api(
        this.refresh_sessions, ['root', 'normal']));
    app.post('/proxy_check', this._api(this.proxy_check_api));
    app.post('/proxy_check/:port', this._api(this.proxy_check_api));
    app.get('/req_status/reset', this._api(this.reset_req_status_cnt_api));
    app.get('/req_status', this._api(this.get_req_status_cnt_api));
    app.get('/req_status/:port', this._api(this.get_req_status_cnt_api));
    app.get('/proxy_status/:port', this._api(this.proxy_status_get));
    app.get('/history/:port', this._api(this.history_get));
    app.get('/logs', this._api(this.logs_get));
    app.get('/logs_har', this._api(this.logs_har_get));
    app.get('/logs_suggestions', this._api(this.logs_suggestions));
    app.get('/history_har/:port', this._api(this.history_har_get));
    app.get('/history_csv/:port', this._api(this.history_csv_get));
    app.get('/sessions/:port', this._api(this.sessions_get));
    app.get('/stats', this._api(this.stats));
    app.get('/whitelist', this._api(this.whitelist));
    app.get('/recent_ips', this._api(this.recent_ips));
    app.get('/settings', this._api((req, res)=>res.json(this.get_settings()),
        ['root']));
    app.post('/creds_user', this._api(this.creds_user_set, ['root']));
    app.get('/config', this._api(this.config_get, ['root']));
    app.post('/config', this._api(this.config_set, ['root']));
    app.post('/config_check', this._api(this.config_check_api, ['root']));
    app.get('/resolve', this._api(this.resolve_get, ['root']));
    app.post('/resolve', this._api(this.resolve_set, ['root']));
    app.get('/resolve_host/:host', this._api(this.resolve_host));
    app.get('/mode', this._api((req, res)=>res.json(assign({mode: this.mode,
        logged_in: this.logged_in, login_failure: this.login_failure,
        run_config: this.run_config}, this.argv.no_usage_stats ?
        {no_usage_stats: true} : {}))));
    app.get('/ip', this._api(this.ip_get, ['root']));
    app.get('/allocated_ips', this._api(this.allocated_ips_get, ['root']));
    app.get('/allocated_vips', this._api(this.allocated_vips_get, ['root']));
    app.post('/shutdown', this._api(this.shutdown, ['root']));
    app.post('/logout', this._api(this.logout));
    app.post('/upgrade', this._api(this.upgrade, ['root']));
    app.post('/restart', this._api(this.restart, ['root']));
    app.post('/recheck', this._api(this.recheck));
    app.get('/all_locations', this._api(this.get_all_locations));
    app.get('/regions/:country_id', this._api(this.get_regions));
    app.get('/cities/:country_id/:region_id?', this._api(this.get_cities));
    app.get('/zones', this._api(this.get_zones_api));
    app.post('/test/:port', this._api(this.test));
    app.get('/test-ports', this._api(this.test_ports));
    app.get('/country', this._api(this.country));
    app.get('/request_stats/reset', this._api(this.request_stats_reset));
    app.get('/request_stats/har', this._api(this.request_stats_har));
    app.get('/request_stats/:type?', this._api(this.request_stats_get));
    app.get('/proxy_stats/reset/:port?', this._api(this.proxy_stats_reset));
    app.get('/proxy_stats/:port?', this._api(this.proxy_stats_get));
    app.post('/report_bug', this._api(this.report_bug));
    app.post('/update_notifs', this._api(this.update_notifs));
    return app;
};

E.prototype.create_web_interface = etask._fn(
function*mgr_create_web_interface(_this){
    const app = express();
    const server = http.Server(app);
    http_shutdown(server);
    app.use(compression());
    app.use(body_parser.urlencoded({extended: true, limit: '2mb'}));
    app.use(body_parser.json({limit: '2mb'}));
    app.use('/api', _this.create_api_interface());
    app.get('/ssl', _this._api((req, res)=>{
        res.set('content-type', 'application/x-x509-ca-cert');
        res.set('content-disposition', 'filename=luminati.crt');
        res.send(ssl.ca.cert);
    }));
    app.use((req, res, next)=>{
        res.locals.path = req.path;
        next();
    });
    app.get(/^\/((|login|howto|proxy_tester|logs|config|overview)|(status_codes|domains|protocols|proxy)(\/[^\/]+)?)$/,
        _this._api(
        (req, res, next)=>{
            setTimeout(()=>etask(function*mgr_cities_ensure_data(){
                try { yield cities.ensure_data(); }
                catch(e){
                    ef(e);
                    _this._log.error('Failed to load cities data '
                        +zerr.e2s(e));
                }
            }), 0);
            req.url = '/index.html';
            next('route');
        }
    ));
    app.use(express.static(path.resolve(__dirname, '../bin/pub')));
    app.use('/uib', express.static(path.resolve(__dirname,
        '../node_modules/angular-ui-bootstrap')));
    app.use('/req', express.static(path.resolve(__dirname,
        '../node_modules')));
    app.use((req, res, next)=>{
        if (req.accepts('html'))
            return res.redirect(301, '/');
        res.status(404);
        if (req.accepts('json'))
            return res.send({error: 'Not found'});
        res.type('txt').send('Not found');
    });
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
    let port = server.address().port;
    let address = server.address().address;
    if (address == '0.0.0.0')
        address = '127.0.0.1';
    server.url = `http://${address}:${port}`;
    swagger.host = `${address}:${port}`;
    return server;
});

E.prototype.create_socks_servers = etask._fn(
function*mgr_create_socks_servers(_this){
    const socks = [].concat(_this.argv.socks||[]).map(ports=>{
        ports = (''+ports).split(':');
        return {
            local: +ports[0],
            remote: +ports[1]||_this.argv.port,
            iface: _this.argv.iface,
            log: _this.argv.log,
        };
    }).filter(ports=>{
        for (let p of _this.proxies)
        {
            if (p.port==ports.remote && (!p.socks||p.socks==ports.local))
            {
                p.socks = ports.local;
                _this._log.debug('Attaching socks %s to proxy %s', ports.local,
                    p.port);
                return false;
            }
        }
        return true;
    });
    _this.argv.socks = socks.map(o=>o.local+':'+o.remote);
    if (!_this.argv.socks.length)
        delete _this.argv.socks;
    return yield etask.all(socks.map(opt=>etask(
    function*mgr_create_socks_server(){
        let port, server = new Socks(opt)
        .on('error', err=>_this.error_handler('Socks '+port, err));
        yield server.start();
        port = server.port;
        _this.socks_servers[port] = server;
        _this._log.debug('SOCKS5 is available at port %s', port);
    })));
});

E.prototype.init_proxies = etask._fn(function*mgr_init_proxies(_this){
    let proxies = _this.proxies.map(c=>_this.create_proxy(c));
    yield etask.all(proxies);
});

E.prototype.proxies_cache_get = etask._fn(
function*mgr_proxies_cache_get(_this, proxies){
    let where;
    if (proxies.length>1)
        where = `proxy IN ('${proxies.join("','")}')`;
    else
        where = `proxy = '${proxies[0]}'`;
    let hosts = yield _this.sql(`SELECT host FROM proxy_hosts WHERE ${where}`);
    return hosts.map(h=>h.host);
});

E.prototype.proxies_cache_add = etask._fn(
function*mgr_proxies_cache_add(_this, hosts){
    if (!hosts.length)
        return;
    return yield _this.sql('INSERT INTO proxy_hosts (host, proxy) '
        +hosts.map(p=>`SELECT '${p.join("','")}'`).join(' UNION ALL '));
});

E.prototype.proxies_cache_remove = etask._fn(
function*mgr_proxies_cache_remove(_this, $host){
    this.on('uncaught', e=>_this._log.error('cache remove %s', zerr.e2s(e)));
    return yield _this.db.main.stmt.proxy_remove.run({$host});
});

E.prototype.logged_update = etask._fn(function*mgr_logged_update(_this){
    if (_this._defaults.customer)
    {
        let auth = yield _this.check_user();
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
        this._log.debug('Error accessing cookie jar: '+zerr.e2s(e));
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
    let now = Date.now();
    if (_this.lum_conf._defaults && now-_this.lum_conf.ts < 60*1000 ||
        _this.use_local_lum_conf&&!force_login)
    {
        return _this.lum_conf;
    }
    if (!_this.luminati_jar)
        _this.luminati_jar = {jar: _this._get_cookie_jar()};
    let cookie = !!token ||
        (_this.luminati_jar.jar.getCookies(_this.argv.api)||[])
        .some(c=>c && c.value && c.expires>=Date.now());
    if (!cookie && !_this.run_config.bypass_credentials_check)
    {
        if (!force_login)
            return (_this.use_local_lum_conf = true) && _this.lum_conf;
        throw {status: 403};
    }
    let config = yield etask.nfn_apply(request, [{
        qs: {customer, token},
        url: `${_this.argv.api}/cp/lum_local_conf?`
            +Luminati.hola_agent.split(' ')[0],
        jar: _this.luminati_jar.jar,
    }]);
    if (config.statusCode!=200)
    {
        config = yield etask.nfn_apply(request, [{
            qs: {token},
            url: `${_this.argv.api}/cp/lum_local_conf?`
                +Luminati.hola_agent.split(' ')[0],
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
    let hash = _this.lum_conf&&_this.lum_conf.hash;
    _this.lum_conf = JSON.parse(config.body);
    _this.lum_conf.ts = now;
    _this.lum_conf.hash = _this.lum_conf._defaults && crypto.createHash('md5')
        .update(stringify(_this.lum_conf._defaults)).digest('hex');
    if (hash!=_this.lum_conf.hash)
        yield _this.fix_config(_this.lum_conf);
    if (_this._defaults.customer&&_this.run_config.ua)
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
            let errors = yield _this.proxy_check({zone: _this._defaults.zone,
                password: zone_password = def_zone.password&&
                    encodeURIComponent(def_zone.password)});
            invalid = errors.some(e=>e.lvl=='err');
        }
        if (invalid)
            assign(_this._defaults, new_conf._defaults);
        else if (zone_password)
            _this._defaults.password = zone_password;
    }
    yield etask.all(_this.proxies.map(p=>etask(function*mgr_fix_proxy_config(){
        if (_this.mgr_opts.dropin &&
            p.port==(Luminati.dropin.listen_port||Luminati.dropin.port)
            ||!p.zone||p.zone==_this._defaults.zone)
        {
            delete p.zone;
            delete p.password;
        }
        let cp;
        if (cp = new_conf._defaults.zones[p.zone||_this._defaults.zone])
        {
            if (p.zone)
            {
                p.password = cp.password && encodeURIComponent(cp.password)||
                    p.password;
            }
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
    if (config&&!config.customers)
        return {defaults: config._defaults};
    if (login_failed)
    {
        let jar = _this.luminati_jar.jar;
        yield etask.nfn_apply(request, [{url: _this.argv.api, jar: jar}]);
        let xsrf = jar.getCookies(_this.argv.api).find(e=>e.key=='XSRF-TOKEN')
        .value;
        let response = yield etask.nfn_apply(request, [{
            method: 'POST',
            url: `${_this.argv.api}/users/auth/basic/check_credentials`,
            jar: jar,
            headers: {'X-XSRF-Token': xsrf},
            form: {username: username, password: password},
        }]);
        if (response.statusCode!=200)
        {
            if (response.body=='not_registered')
            {
                return {error: {
                    message: `The email address is not registered. `
                        +`If you signed up with Google signup button, you`
                        +` should login with Google login button.`
                        +` <a href="${_this.argv.api}/?need_signup=1"`
                        +` target=_blank>`
                        +`Click here to sign up.</a>`,
                    email: true,
                }};
            }
            return {error: {
                message: `The password is incorrect. `
                    +`<a href="${_this.argv.api}/forgot_password?email=`
                    +`${encodeURIComponent(username)}" target=_blank>`
                    +`Forgot your password?</a>`,
                password: true,
            }};
        }
        _this.luminati_jar = {jar: jar, username: username,
            password: password};
    }
    try { config = yield _this.get_lum_local_conf(customer, token, true); }
    catch(e){
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
        if (!config&&e.status!=200)
        {
            let msg = e.message;
            if (msg=='Your account is not active')
            {
                msg = `Your account is disabled.`
                +`<a href='${_this.argv.api}/cp/billing'>`
                +`Click here to change your account status</a>`;
            }
            return {error: {
                message: msg||'Something went wrong. Please contact support.',
            }};
        }
    }
    if (customer)
    {
        yield etask.nfn_apply(request, [{
            method: 'POST',
            url: `${_this.argv.api}/api/whitelist/add`
                +(token ? '?token='+token : ''),
            jar: _this.luminati_jar && _this.luminati_jar.jar,
            json: true,
            body: {customer, zone: config._defaults.zone}
        }]);
    }
    return !customer && config.customers.length>1 ?
        {customers: config.customers.sort()} : {defaults: config._defaults};
});

E.prototype.start = etask._fn(function*mgr_start(_this){
    this.on('uncaught', e=>_this.log.error('start %s', zerr.e2s(e)));
    try {
        perr.run({no_usage_stats: _this.argv.no_usage_stats});
        yield _this.rmt_cfg.start();
        let errors = _this.config_check({_defaults: _this.argv,
            proxies: _this.proxies});
        if (errors.length)
        {
            _this.emit('error', {message: 'Config errors', errors: errors});
            throw new Error('Config errors: ' + JSON.stringify(errors));
        }
        yield _this.prepare_database();
        _this.db.main.stmt = {
            proxy_remove: _this.db.main.prepare(`DELETE FROM proxy_hosts
                WHERE host=$host`),
            history: _this.db.main.prepare(`INSERT INTO request (port, url,
                method, request_headers, request_body, response_headers,
                status_code, status_message, timestamp, elapsed, response_time,
                node_latency, country, timeline, super_proxy, proxy_peer,
                username, content_size, context, success, out_bw, in_bw,
                response_body, protocol, hostname)
                VALUES ($port, $url, $method, $request_headers, $request_body,
                $response_headers, $status_code, $status_message, $timestamp,
                $elapsed, $response_time, $node_latency, $country, $timeline,
                $super_proxy, $proxy_peer, $username, $content_size,
                $context, $success, $out_bw, $in_bw, $response_body,
                $protocol, $hostname)`),
        };
        yield _this.logged_update();
        yield _this.create_socks_servers();
        yield _this.init_proxies();
        if (_this.argv.www)
        {
            _this.www_server = yield _this.create_web_interface();
            _this.emit('www_ready', _this.www_server.url);
            if (!zutil.is_mocha())
            {
                const boxed_line = (repeat, str = null, box = '=')=>{
                    if (!str)
                        str = box.repeat(repeat-2);
                    let ws = Math.max(0, (repeat-2-str.length)/2);
                    let ws1 = ' '.repeat(Math.ceil(ws));
                    let ws2 = ' '.repeat(Math.floor(ws));
                    return `${box}${ws1}${str}${ws2}${box}`;
                };
                const bs = 50;
                console.log(boxed_line(bs));
                console.log(boxed_line(bs, ' '));
                console.log(boxed_line(bs,
                    'Local proxy manager client is running'));
                console.log(boxed_line(bs, ' '));
                console.log(boxed_line(bs, 'Open admin browser:'));
                console.log(boxed_line(bs, ' '));
                console.log(boxed_line(bs, _this.www_server.url));
                console.log(boxed_line(bs, ' '));
                console.log(boxed_line(bs, ' '));
                console.log(boxed_line(bs,
                    'Do not close the process while using the'));
                console.log(boxed_line(bs,
                    'Proxy Manager                           '));
                console.log(boxed_line(bs, ' '));
                console.log(boxed_line(bs));
            }
        }
        _this.start_auto_update();
        if (!is_win&&!is_darwin&&posix)
            yield _this.start_ulimit();
        _this.is_running = true;
        _this.perr('start_success');
        _this.run_stats_reporting();
    } catch(e){ ef(e);
        if (e.message!='canceled')
        {
            _this._log.error('start error '+zerr.e2s(e));
            _this.perr('start_error', {}, {error: e});
        }
        throw e;
    }
});

E.prototype.run_stats_reporting = etask._fn(
function*mgr_run_stats_reporting(_this){
    while (_this.is_running)
    {
        yield etask.sleep(10*date.ms.MIN);
        _this.perr('stats');
    }
});

E.prototype.gen_success_rate_report = function(){
    let stats = (this.request_stats.all||{}).stats||[];
    return stats.map(r=>({
        hostname: r.hostname,
        success: r.success,
        status: r.status_code,
        protocol: r.protocol
    })).reduce((acc, r)=>{
        if (r.success === undefined)
            return acc;
        [false, 'hostname', 'status', 'protocol'].forEach(k=>{
            let st = {total: 0, success: 0};
            if (!k)
                st = acc;
            else
                acc[k][r[k]] = st = acc[k][r[k]]||st;
            st.success += r.success;
            st.total++;
        });
        return acc;
    }, {hostname: {}, status: {}, protocol: {}, total: 0, success: 0});
};

E.prototype.perr = function(id, info, opt){
    info = info||{};
    info.rules_enalbed = this._defaults.rules!==false;
    const conf = _.cloneDeep(this._total_conf);
    conf._defaults = _.omit(conf._defaults, 'zones');
    conf.proxies = (conf.proxies||[]).map(p=>_.omit(p, 'zones'));
    info.config = conf;
    if (this._defaults.customer)
        info.customer_name = this._defaults.customer;
    if (conf||conf._defaults&&conf._defaults.customer)
        info.customer_name = conf._defaults.customer;
    info.stats = this.gen_success_rate_report();
    return zerr.perr(id, info, opt);
};

class Rmt_lpm_cnf {
    constructor(mgr, opt = {}){
        this.opt = opt;
        this.mgr = mgr;
        this.max_age = opt.max_age||5*date.ms.MIN;
        this.itv = opt.itv || this.max_age;
        if (opt.itv === false)
            this.itv = false;
        this.log = log('rmt_lpm_cfg', opt.log);
        this.log.debug('create');
        this.sp = etask(function*rmt_lpm_cfg(){
            return yield this.wait();
        });
        this.itv_sp = null;
        this.running = false;
        this.config = null;
        this.ts = 0;
    }
    start(){
        const _this = this;
        return etask(function*rmt_lpm_cfg_start(){
            _this.log.debug('start');
            _this.running = true;
            if (_this.itv)
                _this.sp.spawn(_this.start_itv_fetch());
            return yield _this.fetch();
        });
    }
    start_itv_fetch(){
        const _this = this;
        this.itv_sp = etask(function*rmt_lpm_cfg_itv(){
            while (_this.running)
            {
                yield etask.sleep(_this.itv);
                yield _this.fetch();
            }
        });
        return this.itv_sp;
    }
    stop_itv_fetch(){
        if (this.itv_sp)
        {
            this.itv_sp.return();
            this.itv_sp = null;
        }
    }
    stop(){
        this.log.debug('stop');
        this.running = false;
        this.stop_itv_fetch();
    }
    has_expired(){
        return Date.now()-this.ts>this.max_age;
    }
    fetch(){
        const _this = this;
        const mgr = this.mgr;
        return etask(function*rmt_lpm_cfg_fetch(){
            let jar = mgr.luminati_jar ? mgr.luminati_jar.jar : null;
            try {
                let res = yield etask.nfn_apply(request, [{
                    url: `${_this.argv.api}/www_lum/lpm`,
                    qs: assign(_.pick(mgr._defaults, qw`customer token`)),
                    jar,
                    json: true,
                    timeout: 60*date.ms.SEC,
                }]);
                _this.log.debug('fetch success');
                return res.body;
            } catch(e){
                _this.log.debug('fetch error %s', zerr.e2s(e));
            }
        });
    }
    get(){
        return this.config||{};
    }
    destroy(){
        this.stop_ivl_fetch();
        this.sp.return();
    }
}

class Ulimit_manager {
    constructor(mgr, opt){
        this.opt = Object.assign({chk_fd_itv: 500, log: 'warn'}, opt||{});
        this.log = log('ulimit', this.opt.log);
        this.sp = etask('ulimit_mgr', function*(){ yield this.wait(); });
        this.desired_fd_limit = (Object.keys(mgr.proxies_running).length||1)
            *5000;
        this.desired_fd_limit = Math.min(this.desired_fd_limit, 1000000);
        this.warn_high_usage = true;
        this.warn_overflow = true;
        this.raise_failed = false;
        this.mgr = mgr;
    }
    start(){
        const _this = this;
        return etask(function*(){
            _this.limit = _this.get_limit();
            if (_this.limit<_this.desired_fd_limit&&!_this.raise_failed)
                _this.raise_limit();
            if (_this.limit<_this.desired_fd_limit)
            {
                // _this.limit_agents();
                _this.mgr.perr('low_ulimit');
            }
            if (!_this.opt.chk_fd)
                return;
            yield _this.check_fd();
            _this.sp.spawn(etask.interval(_this.opt.chk_fd_itv, ()=>{
                _this.sp.spawn(_this.check_fd());
            }));
        });
    }
    check_fd(){
        const _this = this;
        return etask(function*ulimit_mgr_check_fd(){
            try {
                _this.fd = yield _this.count_fd();
            } catch(e){
                _this.fd = _this.limit;
            }
            let ratio = _this.fd/_this.limit;
            if (ratio>0.97)
                return _this.handle_overflow();
            if (ratio>0.8)
                return _this.handle_high_usage();
            return _this.handle_normal_level();
        });
    }
    count_fd(){
        return etask(function*ulimit_mgr_count_fd(){
            this.alarm(1000);
            let list = yield etask.nfn_apply(fs, '.readdir',
                ['/proc/self/fd']);
            return list.length;
        });
    }
    raise_limit(){
        try {
            this.set_limit(this.desired_fd_limit);
            this.limit = this.get_limit();
            if (this.limit<this.desired_fd_limit)
                throw new Error('limit raise failed');
            this.log.notice('successfully raised fd limit to %d', this.limit);
            return true;
        } catch(e){
            this.raise_failed = true;
            this.log.warn(`failed to raise. Raise fd limit OR
                run Proxy Manager as root`);
        }
        return false;
    }
    limit_agents(limit){
        let agents = this.mgr.agents;
        for (let a in agents)
        {
            agents[a].maxFreeSockets = 5;
            agents[a].maxSockets = 10;
            this.log.warn('Setting limits on %s throughput, please'
                +' raise fd limit to avoid this', a);
        }
    }
    handle_high_usage(){
        if (this.warn_high_usage)
        {
            this.log.warn('You are running out of file descriptors'
                +' please raise limits');
            this.warn_high_usage = false;
        }
    }
    handle_overflow(){
        if (this.warn_overflow)
        {
            this.log.crit('Too match files open, please raise limits');
            this.warn_overflow = false;
            this.mgr.perr('overload');
            Object.keys(this.mgr.proxies_running)
            .forEach(s=>this.mgr.proxies_running[s].set_overload(true));
        }
    }
    handle_normal_level(){
        if (!this.warn_high_usage||!this.warn_overflow)
        {
            this.warn_high_usage = this.warn_overflow = true;
            this.log.notice('Number of open files is back to normal levels');
            Object.keys(this.mgr.proxies_running)
            .forEach(s=>this.mgr.proxies_running[s].set_overload(false));
        }
    }
    get_limit(){
        return posix.getrlimit('nofile').hard;
    }
    set_limit(limit){
        posix.setrlimit('nofile', {soft: limit, hard: limit});
    }
    stop(){
        this.sp.return();
    }
}
