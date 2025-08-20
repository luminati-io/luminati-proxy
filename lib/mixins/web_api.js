// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true, evil: true, es9: true*/
const os = require('os');
const fs = require('fs');
const net = require('net');
const http = require('http');
const _ = require('lodash4');
const semver = require('semver');
const express = require('express');
const {Netmask} = require('netmask');
const cookie = require('cookie');
const pkg = require('../../package.json');
const request = require('../../util/lpm_request.js').defaults({gzip: true});
const zerr = require('../../util/zerr.js');
const etask = require('../../util/etask.js');
const date = require('../../util/date.js');
const lpm_config = require('../../util/lpm_config.js');
const zutil = require('../../util/util.js');
const file = require('../../util/file.js');
const user_agent = require('../../util/user_agent.js');
const zurl = require('../../util/url.js');
const logger = require('../logger.js').child({category: 'WEBAPI'});
const consts = require('../consts.js');
const ssl = require('../ssl.js');
const cities = require('../cities.js');
const util_lib = require('../util.js');
const mw = require('../middleware.js');
const puppeteer = require('../puppeteer.js');
const mixin_core = require('./core.js');
const {get_source, get_username, format_json, convert_bytes} = util_lib;
const {assign, keys, values, entries} = Object;

const MIXIN_LABEL = module.exports = 'mgr_web_api';

const E = mixin_core.new_mixin(MIXIN_LABEL);

E.default = assign({}, lpm_config.manager_default);

E.prototype.limit_zagent = function(req, res, next){
    if (this.argv.zagent)
        return res.status(403).send('This action is not allowed in Cloud');
    next();
};

E.prototype.lpm_token_auth_mw = function(req, res, next){
    const tokens = [(this._defaults.lpm_token||'').split('|')[0],
        this._defaults.token_auth].filter(Boolean);
    const auth_lpm_token = [cookie.parse(req.headers.cookie||'').lpm_token,
        req.headers.authorization, req.query.lpm_token].filter(Boolean)[0];
    const bypass = req.is_localhost || !this.logged_in;
    if (bypass || !tokens.length || tokens.includes(auth_lpm_token))
        return void next();
    logger.warn('[Token Auth] access denied for %s %s',
        util_lib.req_util.get_remote_ip(req), req.url);
    this.err2res({
        status: 403,
        headers: {'x-lpm-block-token': req.headers.authorization
            ||req.query.lpm_token||'no_token'},
        msg: 'Valid lpm_token required to use this API',
    }, res);
};

E.prototype.api_error_handler = function(err, req, res, next){
    this.perr('crash_api', {error: zerr.e2s(err)});
    logger.error('API error: %s %s %s', req.method, req.originalUrl,
        zerr.e2s(err));
    res.status(500).send('Server error: '+err.message);
};

E.prototype.init_common_api = function(app){
    app.use(mw.security.headers);
    app.use(mw.rate_limit.default);
    app.use(this.authenticate_mw.bind(this));
    const limit_zagent = this.limit_zagent.bind(this);
    app.use(mw.logger.api(this.argv.www));
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
    app.put('/proxies/:port', mw.validator.port_conf,
        this.proxy_update_api.bind(this));
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
    app.get('/proxy_status/:port', this.proxy_status_get_api.bind(this));
    app.get('/browser/:port', this.open_browser_api.bind(this));
    app.get('/logs', this.logs_get_api.bind(this));
    app.get('/logs_cloud', this.logs_cloud_get_api.bind(this));
    app.get('/logs_har', this.logs_har_get_api.bind(this));
    app.post('/logs_resend', this.logs_resend_api.bind(this));
    app.get('/logs_suggestions', this.logs_suggestions_api.bind(this));
    app.put('/logs_reset', this.logs_reset_api.bind(this));
    app.post('/test_logs_remote', this.test_logs_remote.bind(this));
    app.get('/settings', this.get_settings_api.bind(this));
    app.put('/settings', mw.validator.settings,
        this.update_settings_api.bind(this));
    app.get('/tls_warning', (req, res)=>res.json(this.tls_warning));
    app.post('/creds_user', limit_zagent, this.creds_user_api.bind(this));
    app.post('/verify_two_step', limit_zagent,
        this.verify_two_token_api.bind(this));
    app.get('/config', this.config_get_api.bind(this));
    app.post('/config', limit_zagent, this.config_set_api.bind(this));
    app.get('/allocated_ips', this.allocated_ips_get_api.bind(this));
    app.get('/allocated_vips', this.allocated_vips_get_api.bind(this));
    app.get('/lpm_users', this.lpm_users_get_api.bind(this));
    app.post('/lpm_user', this.lpm_user_add_api.bind(this));
    app.post('/refresh_ip/:port', this.refresh_ip_api.bind(this));
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
    app.put('/whitelist_ip', this.add_www_whitelist_ip_api.bind(this));
    app.put('/wip', this.add_wip_api.bind(this));
    app.delete('/whitelist_ip', this.remove_www_whitelist_ip_api.bind(this));
    app.delete('/wip', this.remove_wip_api.bind(this));
    app.post('/perr', this.perr_api.bind(this));
    app.post('/emit_ws', this.emit_ws_api.bind(this));
    app.get('/general_logs', this.get_general_logs_api.bind(this));
    app.post('/log_level', this.set_log_level_api.bind(this));
    app.post('/cloud_auth', this.cloud_auth_api.bind(this));
    app.post('/cloud_unauth', this.cloud_unauth_api.bind(this));
    app.get('/lpm_stats', this.lpm_stats_api.bind(this));
    app.get('/server_conf', (req, res)=>res.json(this.server_conf));
    app.get('/bw_limit/:port', this.get_bw_limit_api.bind(this));
    app.put('/bw_limit/:port', this.set_bw_limit_api.bind(this));
    app.get('/bw_limit_stats/:port?', this.get_bw_limit_stats_api.bind(this));
    app.get('/i18n', this.get_lang_resources.bind(this));
    app.get('/collect_data', this.get_collect_data_api.bind(this));
};

E.prototype.create_api_v2 = function(){
    const app = express();
    app.use(this.lpm_token_auth_mw.bind(this));
    this.init_common_api(app);
    app.put('/kill_workers', this.kill_workers_api.bind(this));
    app.put('/run_workers', this.run_workers_api.bind(this));
    app.post('/gen_token', mw.rate_limit.gen, this.gen_token_api.bind(this));
    app.post('/gen_cert', mw.rate_limit.gen, this.gen_cert_api.bind(this));
    app.use(this.api_error_handler.bind(this));
    return app;
};

E.prototype.create_api = function(){
    const app = express();
    app.use(mw.deprecation.default());
    app.use(mw.deprecation.sunset('11-01-2023'));
    this.init_common_api(app);
    app.get('/logs_reset', this.logs_reset_api.bind(this));
    app.get('/kill_workers', this.kill_workers_api.bind(this));
    app.get('/run_workers', this.run_workers_api.bind(this));
    app.post('/add_whitelist_ip', this.add_www_whitelist_ip_api.bind(this));
    app.post('/add_wip', this.add_wip_api.bind(this));
    app.get('/refresh_sessions/:port', this.refresh_sessions_api.bind(this));
    app.get('/gen_token', mw.rate_limit.gen, this.gen_token_api.bind(this));
    app.get('/gen_cert', mw.rate_limit.gen, this.gen_cert_api.bind(this));
    app.use(this.api_error_handler.bind(this));
    return app;
};

E.prototype.create_api_server = function(app){
    let http_server;
    let [https_server, https_err] = util_lib.create_ssl_server(app);
    if (https_err)
    {
        logger.warn('Could not start SSL server: %s', https_err.message);
        http_server = http.createServer(app);
        this.start_web_socket(http_server);
        return http_server;
    }
    logger.notice('Using SSL to the web interface');
    this.start_web_socket(https_server);
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
        let lb_transform_stream;
        if (this.lb_ips?.includes(socket.remoteAddress))
        {
            lb_transform_stream = new util_lib.Lb_transform();
            lb_transform_stream.on('parsed', ({remote_ip})=>{
                socket.lpm_forwarded_for = remote_ip;
            });
            socket.pipe(lb_transform_stream);
        }
        (lb_transform_stream||socket).once('data', data=>{
            if (lb_transform_stream)
                socket.unpipe(lb_transform_stream);
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

E.prototype.get_zones_api = function(req, res){
    res.json(this.zones_mgr.get_formatted());
};

E.prototype.get_consts_api = function(req, res){
    const proxy = entries(lpm_config.proxy_fields).reduce(
        (acc, [k, v])=>assign(acc, {[k]: {desc: v}}), {});
    Object.getOwnPropertyNames(E.default)
        .filter(E.default.propertyIsEnumerable.bind(E.default))
        .forEach(k=>proxy[k] && assign(proxy[k], {def: E.default[k]}));
    if (proxy.zone)
        proxy.zone.def = this._defaults.zone;
    proxy.dns.values = ['', 'local', 'remote'];
    const ifaces = keys(os.networkInterfaces())
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
        {
            yield _this.proxy_update(p, {ssl: true},
                {source: get_source(req),
                username: get_username(req)});
        }
    }
    res.send('ok');
});

E.prototype.update_ips_api = etask._fn(
function*mgr_update_ips(_this, req, res){
    const ips = req.body.ips||[];
    const vips = req.body.vips||[];
    const proxy = _this.proxies.find(p=>p.port==req.body.port);
    yield _this.proxy_update(proxy, {ips, vips},
        {source: get_source(req), username: get_username(req)});
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
            browser, os: util_lib.UOS}},
    });
    res.status(response.statusCode).json(response.body);
});

E.prototype.proxy_dup_api = etask._fn(
function*mgr_proxy_dup_api(_this, req, res, next){
    this.on('uncaught', next);
    const port = req.body.port;
    const proxy = zutil.clone_deep(_this.proxies.filter(p=>p.port==port)[0]);
    try { proxy.port = get_free_port(_this.proxy_ports, _this.argv.zagent); }
    catch(e){
        return res.status(400).json({errors: [{msg: e.message,
            field: 'port'}]});
    }
    yield _this.create_new_proxy(proxy);
    res.json({proxy});
});

const get_free_port = (proxies, zagent)=>{
    const proxy_ports = util_lib.get_ports(proxies);
    let port = Math.max(...proxy_ports, 23999)+1;
    if (zagent)
    {
        if (port<=32000)
            return port;
        return find_free_port(proxy_ports);
    }
    return port;
};

const find_free_port = ports=>{
    let port = 24000;
    while (ports.includes(String(port)) && port<=32000)
        port++;
    if (port<=32000)
        return port;
    throw new Error('No free ports');
};

E.prototype.proxy_create_api = etask._fn(
function*mgr_proxy_create_api(_this, req, res, next){
    this.on('uncaught', next);
    if (!req.body.proxy.port)
    {
        try {
            req.body.proxy.port = get_free_port(_this.proxy_ports,
                _this.argv.zagent);
        } catch(e){
            return res.status(400).json({errors: [{msg: e.message,
                field: 'port'}]});
        }
    }
    const port = +req.body.proxy.port;
    if (req.body.proxy?.users?.length)
        req.body.proxy.users = req.body.proxy.users.map(x=>x.toLowerCase());
    if (req.body.proxy.multiply_users && req.body.create_users)
    {
        try { yield _this.add_lpm_users(req.body.proxy.users); }
        catch(e){
            return res.status(400).json({errors: [{msg: e.message,
                field: 'users'}]});
        }
    }
    const {ext_proxies, multiply} = req.body.proxy;
    const errors = yield _this.proxy_check({port, ext_proxies, multiply});
    if (errors.length)
        return res.status(400).json({errors});
    const proxy = assign({}, req.body.proxy, {port});
    if (proxy.bw_limit)
        _this.update_bw_limits(_this, proxy);
    _this.add_config_change('create_proxy_port', port, req.body.proxy,
        get_source(req), get_username(req));
    const {proxy_port, proxy_err} = yield _this.create_new_proxy(proxy);
    if (proxy_err)
        return res.status(400).json({errors: [{msg: proxy_err}]});
    res.json({data: proxy_port.opt});
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
    const errors = yield _this.proxy_check(assign({}, old_proxy,
        req.body.proxy), old_port);
    if (errors.length)
        return res.status(400).json({errors});
    if (!req.body.proxy)
    {
        return res.status(400).json({errors: [{
            msg: `Request body should contain 'proxy' field`,
            body: JSON.stringify(req.body),
        }]});
    }
    const {proxy_port, proxy_err} = yield _this.proxy_update(old_proxy,
        req.body.proxy, {source: get_source(req),
        username: get_username(req)});
    if (proxy_err)
        return res.status(400).json({errors: [{msg: proxy_err}]});
    res.json({data: proxy_port});
});

E.prototype.api_url_update_api = etask._fn(
function*mgr_api_url_update_api(_this, req, res){
    const old_domain = _this._defaults.api_domain;
    const api_domain = _this._defaults.api_domain =
        req.body.url.replace(/https?:\/\/(www\.)?/, '');
    _this.conn.domain = yield _this.check_domain();
    if (!_this.conn.domain)
        return void res.json({res: false});
    yield _this.logged_update();
    _this.add_config_change('update_api_domain', 'defaults', api_domain,
        get_source(req), get_username(req), old_domain);
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
    ips.forEach(ip=>proxy.banip(ip, +ms, domain));
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
    this.banip(ip, domain, +ms, ports);
    return res.status(204).end();
};

E.prototype.proxy_banip_api = function(req, res){
    const port = req.params.port;
    const proxy = this.proxy_ports[port];
    if (!proxy)
        return res.status(400).send(`No proxy at port ${port}`);
    const {ip, domain, ms=0} = req.body||{};
    if (!ip || !(util_lib.is_ip(ip) || util_lib.is_eip(ip)))
        return res.status(400).send('No IP provided');
    proxy.banip(ip, +ms, domain);
    return res.status(204).end();
};

E.prototype.proxy_unbanip_api = function(req, res){
    const port = req.params.port;
    const server = this.proxy_ports[port];
    if (!server)
        throw new Error(`No proxy at port ${port}`);
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
        throw new Error(`No proxy at port ${port}`);
    server.unbanips();
    return res.status(200).send('OK');
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

E.prototype.proxy_delete_api = etask._fn(
function*mgr_proxy_delete_api(_this, req, res, next){
    this.on('uncaught', next);
    logger.info('proxy_delete_api');
    const port = +req.params.port;
    _this.add_config_change('remove_proxy_port', port, undefined,
        get_source(req), get_username(req));
    yield _this.proxy_delete_wrapper([port]);
    res.sendStatus(204);
});

E.prototype.proxies_delete_api = etask._fn(
function*mgr_proxies_delete_api(_this, req, res, next){
    this.on('uncaught', next);
    logger.info('proxies_delete_api');
    const ports = req.body.ports||[];
    ports.forEach(port=>_this.add_config_change('remove_proxy_port', port,
        undefined, get_source(req), get_username(req)));
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

E.prototype.proxy_status_get_api = etask._fn(
function*mgr_proxy_status_get_api(_this, req, res, next){
    this.on('uncaught', next);
    const port = req.params.port;
    const proxy = _this.proxy_ports[port];
    if (!proxy)
        return res.json({status: 'Unknown proxy'});
    if (proxy?.opt?.zone)
    {
        const db_zone = _this.zones_mgr.get_obj(proxy.opt.zone)||{};
        if ((db_zone.plan||{}).disable)
            return res.json({status: 'Disabled zone'});
    }
    if (proxy?.opt?.smtp?.length)
        return res.json({status: 'ok', status_details: [{msg: 'SMTP proxy'}]});
    const force = req.query.force!==undefined
        && req.query.force!=='false' && req.query.force!=='0';
    const fields = ['status'];
    if (proxy?.opt?.proxy_type=='persist')
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
    const opt = assign(zutil.pick(req.body, ...['url', 'headers', 'body']),
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
    if (this.argv.high_perf || !this._defaults.request_stats)
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
    this.lpm_f.event('Clear HAR', get_source(req), get_username(req));
    res.send('ok');
};

E.prototype.logs_cloud_get_api = etask._fn(
function*_logs_cloud_get_api(_this, req, res, next){
    this.on('uncaught', next);
    if (_this.argv.high_perf)
        return {};
    let result = _this.filtered_get(req);
    let orig = assign({}, _this.har(result.items), {total: result.total,
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
    res.json(assign({}, this.har(result.items), {total: result.total,
        skip: result.skip, sum_out: result.sum_out, sum_in: result.sum_in}));
};

E.prototype.logs_har_get_api = function(req, res){
    this.lpm_f.event('Download HAR', get_source(req), get_username(req));
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

E.prototype.node_version_api = function(req, res){
    if (process.versions && !!process.versions.electron)
        return res.json({is_electron: true});
    const current_node = process?.versions?.node||'undefined';
    res.json({
        current: current_node,
        satisfied: semver.satisfies(current_node, pkg.recommendedNode),
        recommended: pkg.recommendedNode,
    });
};

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
        if (_this._defaults.logs_settings && req.body.logs>0
            && _this._defaults.logs_settings.type && !req.body.logs_settings)
        {
            return res.status(400).send('Request logs limit can not be'
                +' changed while remote logs delivery enabled');
        }
    }
    if (_this.argv.zagent && req.body.har_limit!==undefined &&
        ![-1, 1024].includes(req.body.har_limit))
    {
        return res.status(400).send('Response size limit can only be 1KB or '
            +'Disabled in Cloud Proxy Manager');
    }
    if (req.body.logs_settings && !_this.argv.zagent)
        return res.status(400).send('Available only in Cloud Proxy Manager');
    yield _this.update_settings(req.body, {origin: 1,
        source: get_source(req), username: get_username(req)});
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
    _this.add_config_change(undefined, undefined, undefined,
        get_source(req), get_username(req));
    yield _this.config.set_string(req.body.config);
    res.json({result: 'ok'});
    _this.emit('config_changed');
});

E.prototype.creds_user_api = etask._fn(
function*mgr_creds(_this, req, res, next){
    this.on('uncaught', next);
    _this._defaults.customer = req.body.customer || _this._defaults.customer;
    _this._defaults.google_token = req.body.token;
    const login_result = yield _this.login_user(assign({}, req.body));
    if (login_result.error || login_result.body)
        return res.json(login_result.body || login_result);
    if (login_result.customers)
        return res.json({customer_ids: login_result.account_ids});
    _this._defaults.lpm_token = login_result;
    const cloud_conf = yield _this.lpm_f.login();
    yield _this.logged_update();
    if (cloud_conf)
        yield _this.apply_cloud_config(cloud_conf);
    _this.update_lpm_users(yield _this.lpm_users_get());
    _this.add_first_whitelist(req.remote_ip);
    if (_this._defaults.password)
        res.cookie('local-login', _this._defaults.password);
    _this.lpm_f.get_server_conf();
    res.json({result: 'ok'});
});

E.prototype.gen_token_api = etask._fn(
function*gen_token_api(_this, req, res, next){
    this.on('uncaught', next);
    const token = _this.gen_token();
    _this._defaults.token_auth = token;
    _this.update_ports({token_auth: token});
    _this.add_config_change('generate_token', 'defaults', token,
        get_source(req), get_username(req));
    yield _this.config.save();
    res.json({token});
});

E.prototype.proxies_running_get_api = function(req, res){
    const proxies_running = [];
    const proxies_idx = new Map(this.proxies.map(p=>[p.port, p]));
    for (const p of values(this.proxy_ports))
    {
        if (p.opt.port==this._defaults.dropin_port ||
            req.query.user && p.opt.user!=req.query.user)
        {
            continue;
        }
        const config = assign({}, proxies_idx.get(p.opt.port) ||
            proxies_idx.get(p.opt.master_port));
        config.master_port = p.opt.master_port;
        if (config.master_port)
        {
            ['ips', 'vips', 'users', 'whitelist_ips'].forEach(k=>
                delete config[k]);
        }
        const p_opt_fields = ['proxy_type', 'port', 'ip', 'vip', 'user', 'dns',
            'zone', 'tls_lib', 'route_err', 'proxy_connection_type'];
        p_opt_fields.forEach(prop=>config[prop] = p.opt[prop]);
        const p_fields = ['status', 'status_details'];
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
        assign({}, acc, {[p.port]: p}), {});
    const port_conf = proxies[port];
    if (!port_conf)
        return res.status(400).send('invalid port number');
    return res.json(port_conf);
};

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

E.prototype.refresh_ip_api = etask._fn(
function*mgr_refresh_ip_api(_this, req, res, next){
    this.on('uncaught', next);
    const {port} = req.params;
    if (!port)
        return res.status(400).send('Port number is missing');
    const proxy = _this.proxies.find(p=>p.port==port);
    if (!proxy)
        return res.status(400).send('Invalid port number');
    let {ip, vip} = req.body;
    if (ip && vip || !ip && !vip)
        return res.status(400).send('Provide either IP or gIP');
    if (ip && !util_lib.is_ip(ip))
        return res.status(400).send('Invalid IP provided');
    const serv_res = yield _this.refresh_ip(ip, vip, port);
    return res.json(serv_res);
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
    if (Array.isArray(serv_res.vips))
    {
        serv_res.vips = serv_res.vips
            .map(v=>({...v, vip: _.isString(v.vip) ? v.vip : v.id}));
    }
    return res.json(serv_res);
});

E.prototype.shutdown_api = function(req, res){
    res.json({result: 'ok'});
    this.stop();
};

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

E.prototype.downgrade_api = etask._fn(
function*mgr_downgrade(_this, req, res, next){
    this.on('uncaught', next);
    yield _this._downgrade(e=>e ? res.status(403).send(e)
        : res.json({result: 'ok'}));
});

E.prototype.stats_get_api = function(req, res){
    this.loki.requests_trunc();
    const stats = this.loki.stats_get();
    const enable = !!values(this.proxy_ports)
        .filter(p=>!p.opt.ssl && p.opt.port!=this._defaults.dropin_port)
        .length;
    let _https;
    if ((_https = stats.protocol.find(p=>p.key=='https')) && _https.reqs>0)
        stats.ssl_warning = enable;
    stats.ssl_enable = enable;
    const stats_ports = this.loki.stats_group_by('port', 0);
    const ports = stats_ports.reduce((acc, el)=>
        assign({}, acc, {[el.key]: el}), {});
    res.json(assign({ports}, stats));
};

E.prototype.lpm_stats_api = function(req, res){
    const days = req.query.days||5;
    const query = {hostname: {$nin: ['lumtest.com', 'brdtest.com',
        'geo.brdtest.com']}};
    this.loki.requests_trunc();
    const reqs = this.loki.requests_count(query);
    const recent_reqs = this.loki.requests_count(assign({},
        query, {timestamp: {$gt: +date.add(date(), {day: -days})}}));
    res.json({total_requests: reqs, recent_requests: recent_reqs});
};

E.prototype.add_www_whitelist_ip_api = etask._fn(
function*add_www_whitelist_ip_api(_this, req, res, next){
    this.on('uncaught', next);
    let ip;
    if (!(ip = req.body.ip))
        return res.status(400).send('You need to pass an IP to add\n');
    try { ip = new Netmask(ip).base; }
    catch(e){ return res.status(422).send('Wrong format\n'); }
    const {www_whitelist_ips=[]} = _this._defaults;
    if (www_whitelist_ips.includes(ip))
        return res.send('OK');
    const new_ips = www_whitelist_ips.concat([ip]);
    _this.set_www_whitelist_ips(new_ips);
    _this.add_config_change('add_www_whitelist_ip', 'defaults', ip,
        get_source(req), get_username(req));
    yield _this.config.save();
    _this.wss.broadcast_json({msg: 'whitelisted', ip});
    res.send('OK');
});

E.prototype.remove_www_whitelist_ip_api = etask._fn(
function*remove_www_whitelist_ip_api(_this, req, res, next){
    this.on('uncaught', next);
    let ip;
    if (!(ip = req.body.ip))
        return res.status(400).send('You need to pass an IP to add\n');
    try { ip = new Netmask(ip).base; }
    catch(e){ return res.status(422).send('Wrong format\n'); }
    let old_ips = new Set(_this._defaults.www_whitelist_ips||[]);
    if (!old_ips.has(ip))
        return res.status(404).send('IP is not whitelisted\n');
    old_ips.delete(ip);
    const new_ips = Array.from(old_ips);
    _this.set_www_whitelist_ips(new_ips);
    _this.add_config_change('remove_www_whitelist_ip', 'defaults', ip,
        get_source(req), get_username(req));
    yield _this.config.save();
    res.send('OK');
});

E.prototype.cloud_unauth_api = function(req, res){
    const expires = date(date.ms.DAY+Date.now()).toUTCString();
    const set_cookie = `lpm_token=deleted; Max-Age=43200; Path=/; `
        +`Expires=${expires}; Secure; SameSite=None`;
    res.header('Set-Cookie', set_cookie);
    res.send('OK');
};

E.prototype.cloud_auth_api = function(req, res){
    const lpm_token = (this._defaults.lpm_token||'').split('|')[0];
    if (!lpm_token || lpm_token!=req.body.lpm_token)
        return res.status(403).send('Token required');
    // generating the cookie manually as express 4.16 does not support
    // sameSite in cookies generation and util/node_modules uses 4.16
    const expires = date(date.ms.DAY+Date.now()).toUTCString();
    const set_cookie = `lpm_token=${lpm_token}; Max-Age=43200; Path=/; `
        +`Expires=${expires}; Secure; SameSite=None`;
    const username_cookie = `username=${req.body.username}; Max-Age=43200; `
        +`Path=/; Expires=${expires}; Secure; SameSite=None`;
    res.header('Set-Cookie', [set_cookie, username_cookie]);
    const {whitelist_ips=[]} = this._defaults;
    if (!whitelist_ips.length)
        this.set_whitelist_ips([...new Set(whitelist_ips).add(req.remote_ip)]);
    res.send('OK');
};

E.prototype.add_wip_api = etask._fn(
function*add_wip_api(_this, req, res, next){
    this.on('uncaught', next);
    const token_auth = _this._defaults.token_auth;
    if (!token_auth || token_auth!=req.headers.authorization)
        return res.status(403).send('Token required');
    let ip;
    if (!(ip = req.body.ip))
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
    const {whitelist_ips=[]} = _this._defaults;
    if (whitelist_ips.includes(ip))
        return res.send('OK');
    _this.set_whitelist_ips(whitelist_ips.concat([ip]));
    _this.add_config_change('add_whitelist_ip', 'defaults', ip,
        get_source(req), get_username(req));
    yield _this.config.save();
    res.send('OK');
});

E.prototype.remove_wip_api = etask._fn(
function*remove_wip_api(_this, req, res, next){
    this.on('uncaught', next);
    const token_auth = _this._defaults.token_auth;
    if (!token_auth || token_auth!=req.headers.authorization)
        return res.status(403).send('Forbidden');
    let ip;
    if (!(ip = req.body.ip))
        return res.status(400).send('You need to pass an IP to remove\n');
    try {
        const _ip = new Netmask(ip);
        const mask = _ip.bitmask==32 ? '' : '/'+_ip.bitmask;
        ip = _ip.base+mask;
    } catch(e){ return res.status(422).send('Wrong format\n'); }
    let old_ips = new Set(_this._defaults.whitelist_ips||[]);
    if (!old_ips.has(ip))
        return res.status(404).send('IP is not whitelisted\n');
    old_ips.delete(ip);
    const new_ips = Array.from(old_ips);
    _this.set_whitelist_ips(new_ips);
    _this.add_config_change('remove_whitelist_ip', 'defaults', ip,
        get_source(req), get_username(req));
    yield _this.config.save();
    res.send('OK');
});

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
        const {bytes, days, start, renewable, use_limit_webhook,
            th_webhook_value} = proxy.bw_limit;
        const limit = convert_bytes(bytes);
        return res.send(format_json({limit, days, start, renewable,
            use_limit_webhook, th_webhook_value}));
    }
    res.json(zutil.pick(proxy.bw_limit, 'bytes', 'days', 'start',
        'renewable', 'use_limit_webhook', 'th_webhook_value'));
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
    const bw_limit = keys(req.body).length && req.body || false;
    if (bw_limit)
    {
        bw_limit.renewable = bw_limit.renewable===undefined
            ? true : !!bw_limit.renewable;
    }
    const err = yield _this.proxy_check(assign({}, proxy, {bw_limit}),
        port);
    if (err.length)
        return res.status(400).send(err[0].msg);
    let {proxy_port, proxy_err} = yield _this.proxy_update(proxy, {bw_limit},
        {source: get_source(req), username: get_username(req)});
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
        for (const key_port of keys(response.body))
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
    let old_domain = _this._defaults.pmgr_domain;
    _this._defaults.pmgr_domain = req.body.domain;
    _this.add_config_change('pmgr_domain_update_api', 'defaults',
        req.body.domain, get_source(req), get_username(req), old_domain);
    yield _this.config.save();
    res.send('OK');
});

E.prototype.get_collect_data_api = etask._fn(
function*get_collect_data_api(_this, req, res, next){
    this.on('uncaught', next);
    const {return_data} = req.body;
    const api = n=>etask(function*(){
        return yield etask.nfn_apply(request, [{
            url: `${_this.www_server.url}/api/${n}`,
            method: 'GET',
            rejectUnauthorized: false,
            json: true,
        }]);
    });
    const data_map_names = {
        carriers: 'all_carriers',
        i18n: 'i18n',
        version: 'last_version',
        node: 'node_version',
        proxies: 'proxies_running',
        consts: 'consts',
    };
    const result = {};
    const errs = {};
    for (let name in data_map_names)
    {
        const response = yield api(data_map_names[name]);
        if (response.statusCode==200)
            result[name] = response.body;
        else
        {
            errs[name] = response.body;
            if (!return_data)
                break;
        }
    }
    if (keys(errs).length && !return_data)
    {
        const [k, v] = entries(errs)[0];
        return res.status(500).send(k+': '+v);
    }
    if (!return_data)
        return res.status(200).send('ok');
    return res.json({result: assign({
            locations: cities.all_locations(),
            settings: _this.get_settings(),
            conn: _this.conn,
            defaults: _this.opts,
            zones: _this.zones_mgr.get_formatted(),
            tls_warning: _this.tls_warning,
        }, result), errs});
});

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

E.prototype.kill_workers_api = function(req, res){
    this.cluster_mgr.kill_workers();
    res.status(200).send('ok');
};

E.prototype.run_workers_api = function(req, res){
    this.cluster_mgr.run_workers();
    res.status(200).send('ok');
};

E.prototype.emit_ws_api = function(req, res){
    this.wss.broadcast_json(req.body);
    res.send('ok');
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

E.prototype.set_log_level_api = function(req, res){
    this.set_logger_level(req.body.level);
    res.send('OK');
};
