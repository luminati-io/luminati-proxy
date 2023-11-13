#!/usr/bin/env node
// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true, es9: true*/
const events = require('events');
const path = require('path');
const os = require('os');
const request = require('request').defaults({gzip: true});
const _ = require('lodash4');
const {Netmask} = require('netmask');
const cookie = require('cookie');
const winston = require('winston');
const pkg = require('../package.json');
const zconfig = require('../util/config.js');
const zerr = require('../util/zerr.js');
const etask = require('../util/etask.js');
const conv = require('../util/conv.js');
const {code2label} = require('../util/country.js');
const {code2timezone} = require('../util/tz.js');
const date = require('../util/date.js');
const lpm_config = require('../util/lpm_config.js');
const zutil = require('../util/util.js');
const {Fetchable_FS_Cache} = require('../util/fs_cache.js');
const Web_api_mixin = require('./mixins/web_api.js');
const Web_server_mixin = require('./mixins/web_server.js');
const Mgr_proxy_mixin = require('./mixins/mgr_proxy.js');
const Mgr_config_mixin = require('./mixins/mgr_config.js');
const mixin_core = require('./mixins/core.js');
const logger = require('./logger.js').child({category: 'MNGR'});
const consts = require('./consts.js');
const ssl = require('./ssl.js');
const cities = require('./cities.js');
const perr = require('./perr.js');
const util_lib = require('./util.js');
const Loki = require('./loki.js');
const Zagent_api = require('./zagent_api.js');
const Lpm_f = require('./lpm_f.js');
const Lpm_conn = require('./lpm_conn.js');
const get_cache = require('./cache.js');
const Cluster_mgr = require('./cluster_mgr.js');
const Cloud_mgr = require('./cloud_mgr.js');
const Config = require('./config.js');
const Stat = require('./stat.js');
const Zones_mgr = require('./zones.js');
const is_darwin = process.platform=='darwin';
const {assign, keys, values} = Object;

let zos;
if (!lpm_config.is_win && !is_darwin)
    zos = require('../util/os.js');
if (process.env.PMGR_DEBUG)
    require('longjohn');
try { require('heapdump'); } catch(e){}
zerr.set_level('CRIT');

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

const mgr_on_server_conf = function(server_conf){
    logger.system('Updated server configuration');
    let zone_auth_wl_diff = [];
    let super_proxy_ports_diff = [];
    let av_server_url_diff = !this.server_conf;
    let new_super_proxy_ports = this.get_super_proxy_ports(
        server_conf);
    let new_av_server_url = this.get_av_server_url(server_conf);
    if (this.server_conf)
    {
        zone_auth_wl_diff = _.xor(server_conf.zone_auth_type_whitelist,
            this.server_conf.zone_auth_type_whitelist);
        super_proxy_ports_diff = _.xor(new_super_proxy_ports,
            this.get_super_proxy_ports(this.server_conf));
        av_server_url_diff = this.get_av_server_url(this.server_conf)!=
            new_av_server_url;
    }
    this.server_conf = server_conf;
    let port = this.check_proxy_port(server_conf.cloud);
    if (port && port != E.default.proxy_port)
        this.change_default_proxy_port(port);
    if (zone_auth_wl_diff.length)
        this.update_zone_auth_wl();
    if (super_proxy_ports_diff.length)
        this.update_opt({super_proxy_ports: new_super_proxy_ports});
    if (av_server_url_diff)
        this.update_opt({av_server_url: new_av_server_url});
};

const mgr_on_error = function(err, fatal){
    let match;
    if (match = err.message.match(/EADDRINUSE.+:(\d+)/))
        return this.show_port_conflict(match[1], this.argv.force);
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
            catch(e){ error = err?.message||err; }
        }
        this.perr('crash', {error});
        handle_fatal();
    }
};

class Manager extends events.EventEmitter {
    constructor(argv, run_config={}){
        super();
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
            this.config = new Config(this, assign({},
                lpm_config.manager_default), {filename: argv.config});
            const conf = this.config.get_proxy_configs();
            this.opts = assign(zutil.pick(argv,
                ...keys(lpm_config.proxy_fields)),
                zutil.pick(conf._defaults,
                ...lpm_config.mgr_proxy_shared_fields));
            this._defaults = conf._defaults;
            this.proxies = conf.proxies;
            this.config_ts = conf.ts||date();
            this.pending_www_ips = new Set();
            this.pending_ips = new Set();
            this.config.save({skip_cloud_update: 1});
            this.loki = new Loki(argv.loki, Number(this._defaults.logs));
            this.timeouts = new util_lib.Timeouts();
            this.ensure_socket_close = util_lib.ensure_socket_close;
            this.long_running_ets = [];
            this.async_reqs_queue = [];
            this.async_active = 0;
            this.tls_warning = false;
            this.lpm_users = [];
            this.conn = {};
            this.config_changes = [];
            this.wss = this.empty_wss;
            this.is_upgraded = run_config.is_upgraded;
            this.backup_exist = run_config.backup_exist;
            this.conflict_shown = false;
            this.lpm_conn = new Lpm_conn();
            this.lpm_f = new Lpm_f(this);
            this.lpm_f.on('server_conf', mgr_on_server_conf.bind(this));
            this.lpm_f.on('i18n_update_available', ()=>
                this.lang_cache.delete());
            this.lpm_f.on('lb_ips', lb_ips=>{
                logger.notice('Updated lb ips');
                _this.lb_ips = lb_ips;
                _this.update_lb_ips(lb_ips);
            });
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
                    keys(langs).forEach(k=>{
                        if (!['zh-hans', 'ru'].includes(k))
                            delete langs[k];
                    });
                    return langs;
                },
            });
            this.on('error', mgr_on_error.bind(this));
        } catch(e){
            logger.error('constructor: %s', zerr.e2s(e));
            throw e;
        }
    }
}

const E = module.exports = Manager;

mixin_core.assign(E, Web_api_mixin, Web_server_mixin, Mgr_proxy_mixin,
    Mgr_config_mixin);

E.default = assign({}, lpm_config.manager_default);

E.prototype.empty_wss = {
    close: ()=>null,
    broadcast_json: data=>{
        logger.debug('wss is not ready, %s will not be emitted', data.msg);
    },
};

E.prototype.apply_argv_opts = function(_defaults){
    const args = zutil.clone_deep(this.argv.explicit_mgr_opt||{});
    const ips_fields = ['whitelist_ips', 'www_whitelist_ips', 'extra_ssl_ips'];
    ips_fields.forEach(f=>{
        if (args[f])
            args[f] = [...new Set([..._defaults[f]||[], ...args[f]||[]])];
    });
    return assign(_defaults, args);
};

E.prototype.check_proxy_port = function(conf={}){
    let def_port = E.default.proxy_port;
    let def_id = this._defaults.customer_id || this._defaults.account_id;
    let conf_def_port = lpm_config.manager_default.proxy_port;
    if (!conf)
        return def_port;
    if (this.is_reseller() && conf.reseller_proxy_port)
        return conf.reseller_proxy_port;
    if (!conf.proxy_ports || !def_id)
        return def_port;
    for (let port in conf.proxy_ports)
    {
        if (conf.proxy_ports[port].includes(this._defaults.customer_id)
            || conf.proxy_ports[port].includes(this._defaults.account_id))
        {
            return port;
        }
   }
    return conf_def_port;
};

E.prototype.change_default_proxy_port = function(port){
    E.default.proxy_port = port;
    if (!this.cluster_mgr.workers_running().length)
        return;
    this.cluster_mgr.broadcast('UPDATE_SERVERS_OPT', {proxy_port: port});
};

E.prototype.update_zone_auth_wl = function(whitelist){
    if (!this.cluster_mgr.workers_running().length)
        return;
    this.cluster_mgr.broadcast('UPDATE_SERVERS_OPT',
        {zone_auth_type_whitelist: this.server_conf.zone_auth_type_whitelist});
};

E.prototype.update_opt = function(opt){
    values(this.proxy_ports).forEach(proxy_port=>
        proxy_port.update_config(opt));
};

E.prototype.update_lb_ips = function(lb_ips){
    values(this.proxy_ports).forEach(proxy_port=>
        proxy_port.update_lb_ips({lb_ips}));
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
    const proxy = this.proxy_ports[data.port];
    if (proxy?.status!='ok' && data.success)
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
            headers: util_lib.headers_to_a(data.headers),
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
    values(_this.proxy_ports).forEach(proxy_port=>{
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
    _this.lpm_f.close(reason);
    _this.lpm_conn.close(reason);
    yield _this.stop_servers();
    _this.cluster_mgr.kill_workers();
    if (!restart)
        _this.emit('stop', reason);
});

E.prototype.har = function(items){
    return {log: {
        version: '1.2',
        creator: {name: 'Proxy Manager', version: pkg.version},
        pages: [],
        entries: items.map(entry=>{
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
                    headers: util_lib.headers_to_a(req),
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
                    headers: util_lib.headers_to_a(res),
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

E.prototype.get_av_server_url = function(server_conf){
    if (!server_conf || !server_conf.cloud || !server_conf.cloud.av_server_url)
        return '127.0.0.1:1343';
    return server_conf.cloud.av_server_url;
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

E.prototype.banip = function(ip, domain, ms, ports){
    values(this.proxy_ports).forEach(p=>{
        if (!ports?.includes(p.opt.port))
            return;
        p.banip(ip, ms, domain);
    });
};

E.prototype.get_banlist = function(server, full){
    if (full)
    {
        return {ips: [...server.banlist.cache.values()].map(
            b=>({ip: b.ip, domain: b.domain, to: b.to_date}))};
    }
    return {ips: [...server.banlist.cache.keys()]};
};

E.prototype.refresh_server_sessions = function(port){
    const proxy_port = this.proxy_ports[port];
    return proxy_port.refresh_sessions();
};

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
        ['timezone', 'country', 'resolution', 'webrtc']) || {};
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

E.prototype.test_logs_remote = etask._fn(function*(_this, req, res, next){
    this.on('uncaught', e=>{
        logger.warn('Custom logs test fail: ' + e.message||e);
        res.send({error: e.message||e});
        next();
    });
    if (!_this.argv.zagent)
        return res.send({error: 'Available only in Cloud Proxy Manager'});
    let type = req.body.type;
   if (!type || !logger.remote_transports[type])
        return res.send({error: 'Bad parameters, unknown logger type: '+type});
    let test_logger = winston.loggers.get('test');
    let opt = assign({}, req.body, logger.remote_transports[type].test_opt);
    logger.remote_transports[type].validate(opt);
    let transport = logger.remote_transports[type].create_fn(opt);
    transport.on('warn', e=>{
        logger.warn('Logs transport test error: ' + e.message);
        this.continue(e.message);
    });
    transport.on('logged', ()=>this.continue());
    transport.on('error', e=>this.continue(e.message));
    test_logger.add(transport);
    test_logger.info({lpm_test: 'test message'});
    let test_res = yield this.wait(10*date.ms.SEC);
    test_logger.remove(transport);
    res.send({success: !test_res, error: test_res});
});

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
    this.loki.requests_trunc();
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

E.prototype.get_params = function(){
    const args = [];
    for (let k in this.argv)
    {
        const val = this.argv[k];
        if (['$0', 'h', 'help', 'version', 'p', '?', 'v', '_', 'native_args',
            'explicit_proxy_opt', 'explicit_mgr_opt', 'rules', 'daemon_opt']
            .includes(k))
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

const cuid = cid=>cid ? cid.split('_')[1]||cid : cid;

E.prototype.get_cloud_url_address = function(){
    const {_defaults: {account_id, customer_id}} = this;
    return `pmgr-customer-${cuid(customer_id||account_id)}.brd.superproxy.io`;
};

E.prototype.add_first_whitelist = function(ip){
    const whitelist_ips = this._defaults.www_whitelist_ips||[];
    const new_whitelist_ips = [...whitelist_ips];
    if (!this.argv.zagent && !new_whitelist_ips.length && ip!='127.0.0.1')
        new_whitelist_ips.push(ip);
    this.set_www_whitelist_ips(new_whitelist_ips);
};

E.prototype.gen_token = function(){
    const length = 14;
    const charset = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let ret = '';
    for (let i=0, n=charset.length; i<length; i++)
        ret += charset.charAt(Math.floor(Math.random()*n));
    return ret;
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

E.prototype.lpm_users_get = etask._fn(function*mgr_lpm_users_get(_this){
    try {
        const response = yield _this.api_request({endpoint: '/lpm/lpm_users'});
        return response?.body||[];
    } catch(e){
        logger.warn('failed to fetch lpm_users: %s', e.message);
        return [];
    }
});

E.prototype.update_lpm_users = function(users){
    logger.notice('Updating lpm users...');
    users = users||[];
    this.lpm_users = users;
    values(this.proxy_ports).forEach(proxy_port=>{
        if (!proxy_port.opt.user)
            return;
        const user = users.find(u=>u.email==proxy_port.opt.user);
        if (!user)
            return;
        proxy_port.update_config({user_password: user.password});
    });
};

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
        const update = assign({ips: updated_ips(proxy_port.opt.ips)},
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
        form: assign({zone}, opt),
        no_throw: true,
    });
    if (response.statusCode==200)
        return response.body;
    return {status: response.statusCode, error: response.body};
});

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

E.prototype.restart = etask._fn(function*mgr_restart(_this, opt={}){
    if (!opt.cleanup)
        yield _this.loki.save();
    else if (_this.argv.zagent && opt.cleanup)
        ssl.remove_ca(ssl.paths.cust);
    _this.emit('restart', opt);
});

E.prototype.upgrade = etask._fn(function*mgr__upgrade(_this, cb){
    yield _this.loki.save();
    _this.emit('upgrade', cb);
});

E.prototype._downgrade = etask._fn(function*mgr__downgrade(_this, cb){
    yield _this.loki.save();
    _this.emit('downgrade', cb);
});

E.prototype.restart_when_idle = function(){
    logger.notice('Manager will be restarted when idle');
    this.timeouts.set_interval(()=>{
        const upgrade_idle_since = date.add(date(),
            {ms: -consts.UPGRADE_IDLE_PERIOD});
        if (values(this.proxy_ports)
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
        qs: assign(opt.qs||{}, {
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
    yield _this.lpm_f.ext_proxy_created(proxy);
});

E.prototype.set_lpm_token_cookie = function(req, res){
    const lpm_token = (this._defaults.lpm_token||'').split('|')[0];
    const cookie_token = cookie.parse(req.headers.cookie||'').lpm_token;
    if (!lpm_token || cookie_token || !this.logged_in)
        return;
    res.cookie('lpm_token', lpm_token, {maxAge: consts.HL_TRANSPORT_MAX_AGE,
        httpOnly: true, sameSite: true});
};

E.prototype.err2res = function(err, res){
    if (err.status)
        res.status(err.status);
    if (err.headers)
        keys(err.headers).forEach(h=>res.set(h, err.headers[h]));
    if (err.msg)
        res.send(err.msg);
};

E.prototype.get_lang_resources = etask._fn(
function*get_lang_resources(_this, req, res, next){
    this.on('uncaught', next);
    logger.info('get_language_resources_api');
    res.json(yield _this.lang_cache.get());
});

E.prototype.login_user = etask._fn(
function*mgr_login_user(_this, opt={}){
    let {username, password, two_step_token, two_step_pending} = opt;
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
            os: util_lib.UOS,
            country: _this.conn.current_country,
            two_step_token,
            two_step_pending
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
        else if (err=='bad_token')
            return {error: {message: err}};
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
    logger.system('Checking the domain availability... %s',
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

E.prototype.recheck_domain = etask._fn(function*recheck_domain(_this){
    _this._defaults.api_domain = pkg.api_domain_fallback;
    logger.system('Checking the domain availability... %s',
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

E.prototype.get_ssl_ca = function(){
    return ssl.ca;
};

E.prototype.run_resolving_proxies = etask._fn(
function*run_resolving_proxies(_this){
    _this.long_running_ets.push(this);
    this.on('uncaught', e=>{
        logger.error('resolve_proxies: '+zerr.e2s(e));
        this.throw(e);
    });
    while (1)
    {
        let rp_interval = _this.server_conf.resolve_proxies_interval ||
            _this.config.defaults.resolve_proxies_interval;
        yield etask.sleep(rp_interval);
        yield _this.resolve_proxies();
        for (let proxy of _this.proxies)
        {
            for (let i=0; i<(proxy.multiply||1); i++)
            {
                let proxy_port = _this.proxy_ports[proxy.port+i];
                if (proxy_port)
                    proxy_port.update_hosts(_this.hosts, _this.cn_hosts);
            }
        }
    }
});

E.prototype.schedule_vipdb_reload =
function(timeout=consts.VIPDB_RELOAD_TIMEOUT){
    logger.system('Schedule vipdb reload in %s',
        date.describe_interval(timeout));
    this.timeouts.set_timeout(this.ensure_cities_data.bind(this, true),
        timeout);
};

E.prototype.ensure_cities_data = etask._fn(
function*_ensure_cities_data(_this, clear=false){
    yield cities.ensure_data(_this, clear);
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
            yield _this.lpm_f.get_lb_ips();
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
        {
            yield _this.apply_cloud_config(cloud_conf,
                {force: _this.argv.zagent});
        }
        _this.update_lpm_users(yield _this.lpm_users_get());
        yield _this.ensure_cities_data();
        yield _this.init_web_interface();
        if (!lpm_config.is_win && !is_darwin)
        {
            if (!_this.argv.zagent)
                _this.run_cpu_usage_monitoring();
        }
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

E.prototype.process_exit = etask._fn(function*(_this, reason, code=0){
    yield _this.stop(reason);
    process.exit(code);
});

E.prototype.run_stats_reporting = etask._fn(function*(_this){
    _this.long_running_ets.push(this);
    let i = 0, report_timeout = 2*date.ms.SEC;
    while (1)
    {
        try {
            const cu = zos.cpu_usage();
            const meminfo = zos.meminfo();
            const fd = yield util_lib.count_fd();
            const stats = {
                fd,
                workers_running: _this.cluster_mgr.workers_running().length,
                mem_usage: Math.round(
                    (meminfo.memtotal-meminfo.memfree_all)/1024/1024),
                mem_usage_p: Math.round(zos.mem_usage()*100),
                cpu_usage_p: Math.round(cu.all*100),
                cores: os.cpus().length,
                cache: [_this.cache.space_taken],
                ttl: report_timeout,
                orig_ts: Date.now(),
            };
            if (i%5==0)
            {
                stats.tcp_established = yield util_lib.count_tcp('ESTABLISHED',
                    E.default.proxy_port);
                stats.tcp_time_wait = yield util_lib.count_tcp('TIME_WAIT',
                    E.default.proxy_port);
                i = 0;
            }
            _this.cluster_mgr.health_check();
            if (_this.server_conf.client.cpu_reporting)
                yield _this.lpm_conn.report(stats);
            i++;
        } catch(e){
            const error = zerr.e2s(e);
            logger.error(error);
            _this.perr('error', {error, ctx: 'stats_reporting'});
        }
        yield etask.sleep(report_timeout);
    }
});

E.prototype.perr = function(id, info={}, opt={}){
    info.customer = this._defaults.customer;
    info.account_id = this._defaults.account_id;
    info.customer_id = this._defaults.customer_id;
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
