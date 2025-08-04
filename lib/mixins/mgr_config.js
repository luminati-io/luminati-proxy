// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true, evil: true, es9: true*/
const _ = require('lodash4');
const pkg = require('../../package.json');
const request = require('../../util/lpm_request.js').defaults({gzip: true});
const etask = require('../../util/etask.js');
const date = require('../../util/date.js');
const zutil = require('../../util/util.js');
const lpm_config = require('../../util/lpm_config.js');
const logger = require('../logger.js').child({category: 'MNGCONF'});
const consts = require('../consts.js');
const ssl = require('../ssl.js');
const util_lib = require('../util.js');
const Config = require('../config.js');
const mixin_core = require('./core.js');
const {assign, keys} = Object;

const MIXIN_LABEL = module.exports = 'mgr_config';

const E = mixin_core.new_mixin(MIXIN_LABEL);

const change_omit_fields = ['rules'];

E.fields_to_preserve = ['zone'];
E.default = assign({}, lpm_config.manager_default);

E.prototype.add_config_change = function(key, area, payload, source, username,
    old_val)
{
    this.config_changes.push({key, area, payload, source, username});
    let ev_new = change_omit_fields.some(f=>payload?.[f]) ?
        _.omit(payload, change_omit_fields) : payload;
    let ev_old = old_val && change_omit_fields.some(f=>old_val[f]) ?
        _.omit(old_val, change_omit_fields) : old_val;
    if ((!ev_new || _.isEmpty(ev_new)) && (!ev_old || _.isEmpty(ev_old)))
        return;
    let ev_payload = ev_old ? {new: ev_new, old: ev_old} : ev_new;
    this.lpm_f.event(key, source, username, assign(ev_payload||{}, {area}));
};

E.prototype.get_mgr_proxy_port = function(){
    const opts_pp = this.opts.proxy_port;
    const def_pp = E.default.proxy_port;
    return !opts_pp || def_pp==opts_pp ? def_pp : opts_pp;
};

E.prototype.get_settings = function(){
    return {
        account_id: this._defaults.account_id,
        customer_id: this._defaults.customer_id,
        customer: this._defaults.customer,
        zone: this._defaults.zone,
        password: this._defaults.password,
        www_whitelist_ips: this._defaults.www_whitelist_ips||[],
        whitelist_ips: this._defaults.whitelist_ips||[],
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
        av_server: this.argv.av_server,
        reseller: this.is_reseller(),
        sync_config: this._defaults.sync_config,
        ask_sync_config: this._defaults.ask_sync_config,
        cache_report: [this.cache.space_taken],
        cache_limit: consts.CACHE_LIMIT,
        lpm_token: this._defaults.lpm_token,
        cloud_url_address: this.get_cloud_url_address(),
        server_conf: this.server_conf,
        proxy_port: this.get_mgr_proxy_port(),
        username: this.last_username,
        logs_settings: this._defaults.logs_settings,
        bw_limit_webhook_url: this._defaults.bw_limit_webhook_url,
        bw_th_webhook_url: this._defaults.bw_th_webhook_url,
        use_custom_cert: ssl.use_custom_cert,
        socket_inactivity_timeout: this._defaults.socket_inactivity_timeout
            ||E.default.socket_inactivity_timeout,
        new_ui: this.argv.new_ui,
    };
};

E.prototype.get_ui_ver = function(){
    // XXX sergeyba: change to return strict value 2 once new ui is the main
    return this.argv.new_ui ? 2 : 1;
};

E.prototype.update_settings =
etask._fn(function*(_this, settings, opt={}){
    let skip_cloud_update;
    let ports_with_def_zone;
    let current_config;
    let emit_zone_updated;
    const {origin, source, username} = opt;
    const get_add_config_change_fn = (new_v, old_v)=>origin ?
        (key, area)=>_this.add_config_change(key, area, new_v, source,
        username, old_v) : _.noop;
    if (origin && _this._defaults.sync_config)
        yield _this.lpm_f.update_settings(settings);
    for (const field in settings)
    {
        const val = settings[field];
        const old_val = _this._defaults[field];
        const add_config_change = get_add_config_change_fn(val, old_val);
        switch (field)
        {
        case 'zone':
            current_config = _this.config.get_config();
            ports_with_def_zone = current_config.proxies
                .filter(p=>!p.hasOwnProperty('zone')).map(p=>p.port);
            _this._defaults[field] = val;
            // should update zone at ports with default zone value
            if (ports_with_def_zone.length)
            {
                _this.update_ports({zone: val},
                    _.pick(_this.proxy_ports, ports_with_def_zone));
            }
            add_config_change('update_zone', 'defaults');
            emit_zone_updated = 1;
            break;
        case 'har_limit':
            _this._defaults[field] = val;
            _this.update_ports({har_limit: val});
            add_config_change('update_har_limit', 'defaults');
            break;
        case 'debug':
            _this._defaults[field] = val;
            _this.opts[field] = val;
            _this.update_ports({debug: val});
            add_config_change('update_debug', 'defaults');
            break;
        case 'lpm_auth':
            _this._defaults[field] = val;
            _this.opts[field] = val;
            _this.update_ports({lpm_auth: val});
            add_config_change('update_lpm_auth', 'defaults');
            break;
        case 'logs':
            _this._defaults[field] = val;
            _this.loki.requests_trunc(val);
            add_config_change('update_logs', 'defaults');
            break;
        case 'log':
            _this._defaults[field] = val;
            _this.set_logger_level(val);
            add_config_change('update_log_level', 'defaults');
            break;
        case 'request_stats':
            _this._defaults[field] = val===undefined||val==='' ? true : val;
            if (!_this._defaults.request_stats)
                _this.loki.stats_clear();
            break;
        case 'www_whitelist_ips':
            add_config_change('update_www_whitelist_ips', 'defaults');
            _this.set_www_whitelist_ips(val);
            break;
        case 'whitelist_ips':
            add_config_change('update_whitelist_ips', 'defaults');
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
        case 'logs_settings':
            _this._defaults[field] = val?.disable ? undefined : val;
            add_config_change('update_logs_settings', 'defaults');
            _this.update_ports({logs_settings: val});
            break;
        case 'socket_inactivity_timeout':
            _this._defaults[field] = val==E.default.socket_inactivity_timeout ?
                undefined : val;
            add_config_change('update_socket_inactivity_timeout', 'defaults');
            _this.update_ports({socket_inactivity_timeout: val});
            break;
        case 'bw_limit_webhook_url':
        case 'bw_th_webhook_url':
            _this._defaults[field] = val;
            add_config_change('update_'+field, 'defaults');
            break;
        }
    }
    yield _this.config.save({skip_cloud_update: skip_cloud_update || !origin,
        skip_broadcast: 1});
    _this.check_any_whitelisted_ips();
    if (_this._defaults.sync_config)
    {
        _this.wss.broadcast_json({
            msg: 'settings_updated',
            settings: assign({}, _this.get_settings()),
            defaults: assign({}, _this.opts),
        });
        if (emit_zone_updated)
        {
            _this.wss.broadcast_json({
                msg: 'update_path',
                payload: _this.zones_mgr.get_formatted(),
                path: 'zones',
            });
        }
    }
});

E.prototype.skip_config_sync = function(){
    return !this.argv.zagent && !this._defaults.sync_config;
};

E.prototype.apply_cloud_config =
etask._fn(function*mgr_apply_cloud_config(_this, config, opt){
    if (_this.skip_config_sync() || !_this.argv.config)
        return;
    opt = opt||{};
    if (!config || !keys(config).length)
        return yield _this.config.save();
    if (opt.ca)
        yield ssl.apply_cloud_ca(opt.ca);
    const is_old_config = !config.ts ||
        _this.config_ts && date(config.ts)<=date(_this.config_ts);
    if (!opt.force && is_old_config)
        return;
    if (_this.applying_cloud_config)
        return _this.pending_cloud_config = {config, opt};
    _this.applying_cloud_config = this;
    this.finally(()=>{
        _this.applying_cloud_config = null;
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
    _this._defaults = assign(conf._defaults, _.pick(old_defaults,
        ['www_api', 'www_help', 'www_domain', 'api']));
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
        _this.wss = _this.empty_wss;
        yield _this.init_web_interface();
    }
    if (_this.argv.zagent)
    {
        if (_this._defaults.www_whitelist_ips)
        {
            _this._defaults.www_whitelist_ips =
                _this._defaults.www_whitelist_ips
                    .filter(ip=>!util_lib.is_any_ip(ip));
        }
        if (_this._defaults.whitelist_ips)
        {
            _this._defaults.whitelist_ips = _this._defaults.whitelist_ips
                .filter(ip=>!util_lib.is_any_ip(ip));
        }
    }
    _this.check_any_whitelisted_ips();
    yield _this.init_proxies();
    _this.cluster_mgr.run_workers();
    yield _this.lpm_f.get_server_conf();
    yield _this.lpm_f.get_lb_ips();
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
        const bw_limit = assign({}, proxy.bw_limit, {expires, ts});
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
        _this.banlist_sync = conf.banlist_sync;
        if (_this.skip_config_sync())
            _this.remove_preserved_fields(conf);
        assign(_this._defaults, conf._defaults);
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
            _this._defaults.www_domain = 'www.bright.cn';
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
        _this._defaults.www_help = 'https://help.'+_this._defaults.www_domain;
    }
});


