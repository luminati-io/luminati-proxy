// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true, evil: true, es9: true*/
const dns = require('dns');
const http = require('http');
const http_shutdown = require('http-shutdown');
const _ = require('lodash4');
const zerr = require('../../util/zerr.js');
const etask = require('../../util/etask.js');
const date = require('../../util/date.js');
const lpm_config = require('../../util/lpm_config.js');
const zutil = require('../../util/util.js');
const logger = require('../logger.js').child({category: 'MGRPR'});
const consts = require('../consts.js');
const Proxy_port = require('../proxy_port.js');
const util_lib = require('../util.js');
const mixin_core = require('./core.js');
const {assign, keys, values, entries} = Object;

const MIXIN_LABEL = module.exports = 'mgr_proxy';

const E = mixin_core.new_mixin(MIXIN_LABEL);

E.updatable_fields = ['whitelist_ips'];
E.default = assign({}, lpm_config.manager_default);

E.prototype.get_super_proxy_ports = function(server_conf){
    if (!server_conf || !server_conf.cloud)
        return [];
    const proxy_ports = server_conf.cloud.proxy_ports||{};
    return entries(proxy_ports).reduce((ports, [port, cust_ids])=>{
        if (cust_ids.includes(this._defaults.account_id)
            || cust_ids.includes(this._defaults.customer_id))
        {
            ports.push(port);
        }
        return ports;
    }, []);
};

E.prototype.complete_proxy_config = function(conf){
    const c = assign({}, E.default, this._defaults, conf);
    const zone = this.zones_mgr.get_obj(c.zone);
    const {plan, perm} = zone||{};
    const perms = perm?.split(' ');
    c.ssl_perm = !!plan?.ssl;
    c.state_perm = perms?.includes('state');
    c.zip_perm = perms?.includes('zip');
    const lpm_user = this.lpm_users.find(u=>u.email==c?.user);
    if (lpm_user)
        c.user_password = lpm_user.password;
    c.hosts = this.hosts;
    c.cn_hosts = this.cn_hosts;
    c.zone_auth_type_whitelist = this.server_conf.zone_auth_type_whitelist;
    c.lb_ips = this.lb_ips;
    c.banlist_sync = this.banlist_sync;
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
    if (values(this.proxy_ports).length+(proxy.multiply||1)>
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
    const conf = assign({}, proxy);
    lpm_config.numeric_fields.forEach(field=>{
        if (conf[field])
            conf[field] = +conf[field];
    });
    conf.static = this.zones_mgr.is_static_proxy(zone_name);
    conf.mobile = this.zones_mgr.is_mobile(zone_name);
    conf.unblock = this.zones_mgr.is_unblocker(zone_name);
    conf.super_proxy_ports = this.get_super_proxy_ports(this.server_conf);
    conf.av_server_url = this.get_av_server_url(this.server_conf);
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
    logger.notice(`Handling init proxy port ${proxy.port} error: ${msg}`);
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
        const dup = assign({}, master, {
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

E.prototype.create_new_proxy = etask._fn(function*(_this, conf, opt={}){
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
        yield _this.config.save(opt);
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

E.prototype.preserve_updatable_fields = function(old_proxy, new_proxy){
    if (!old_proxy || !new_proxy)
        return;
    for (let field of E.updatable_fields)
    {
        if (!new_proxy[field] && old_proxy[field])
            new_proxy[field] = old_proxy[field];
    }
};

E.prototype.proxy_update = etask._fn(
function*mgr_proxy_update(_this, old_proxy, new_proxy, opt={}){
    const multiply_altered = (_old, _new)=>_new.multiply!==undefined &&
        _new.multiply!=_old.multiply;
    const multiply_users_altered = (_old, _new)=>
        _new.multiply_users!==undefined &&
        _new.multiply_users!=_old.multiply_users
        || _new.users!==undefined && !_.isEqual(_new.users, _old.users);
    const multiply_changed = multiply_altered(old_proxy, new_proxy)
        || multiply_users_altered(old_proxy, new_proxy);
    const port_changed = new_proxy.port && new_proxy.port!=old_proxy.port;
    const zone_changed = new_proxy.zone && old_proxy.zone!=new_proxy.zone;
    const rules_changed = new_proxy.rules && !_.isEqual(new_proxy.rules,
        old_proxy.rules);
    const proxy_has_render = new_proxy.render || old_proxy.render;
    const ov = _.sortBy(old_proxy.vips||[]), nv = _.sortBy(new_proxy.vips||[]);
    const oi = _.sortBy(old_proxy.ips||[]), ni = _.sortBy(new_proxy.ips||[]);
    const ips_changed = !_.isEqual(ov, nv) || !_.isEqual(oi, ni);
    if (rules_changed)
    {
        _this.lpm_f.event('Rules Change', opt.source, opt.username,
            {area: new_proxy.port||old_proxy.port, old: old_proxy.rules,
            new: new_proxy.rules});
    }
    if (zone_changed || proxy_has_render)
        _this.adjust_new_zone(_this, new_proxy, old_proxy);
    if (new_proxy.bw_limit)
        _this.update_bw_limits(_this, new_proxy, old_proxy);
    _this.add_config_change('update_proxy_port', old_proxy.port,
        assign({}, new_proxy), opt.source, opt.username,
        _.pick(old_proxy, keys(new_proxy)));
    if (port_changed || multiply_changed || ips_changed)
    {
        return yield _this.proxy_remove_and_create(old_proxy, new_proxy,
            {origin: true});
    }
    _this.preserve_updatable_fields(old_proxy, new_proxy);
    return yield _this.proxy_update_in_place(old_proxy.port, new_proxy,
        {origin: true});
});

E.prototype.update_bw_limits = function(_this, new_proxy, old_proxy={}){
    const fields = ['days', 'bytes', 'start', 'renewable', 'use_limit_webhook',
        'th_webhook_value'];
    new_proxy.bw_limit = assign({},
        zutil.pick(old_proxy.bw_limit, ...fields),
        zutil.pick(new_proxy.bw_limit, ...fields));
    new_proxy.bw_limit.renewable = !!new_proxy.bw_limit.renewable;
    new_proxy.bw_limit.th_webhook_value = new_proxy.bw_limit.th_webhook_value
        ||undefined;
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
    assign(old_opt, new_proxy);
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
function*(_this, old_proxy, new_proxy, opt={}){
    if (opt.origin && _this._defaults.sync_config)
        yield _this.lpm_f.proxy_remove_and_create(old_proxy, new_proxy);
    const old_server = _this.proxy_ports[old_proxy.port];
    const banlist = old_server.banlist;
    const old_opt = _this.proxies.find(p=>p.port==old_proxy.port);
    yield _this.proxy_delete(old_proxy.port, {skip_cloud_update: 1});
    const proxy = assign({}, old_proxy, new_proxy, {banlist});
    const {proxy_port, proxy_err} = yield _this.create_new_proxy(proxy,
        {skip_cloud_update: !opt.origin, skip_broadcast: 1});
    if (proxy_err)
    {
        yield _this.create_new_proxy(old_opt,
            {skip_cloud_update: !opt.origin, skip_broadcast: 1});
        return {proxy_err};
    }
    proxy_port.banlist = banlist;
    return {proxy_port: proxy_port.opt};
});

const get_nearest_port = (proxies, port)=>{
    const ports = util_lib.get_ports(proxies);
    do
        port++;
    while (!ports.includes(String(port)) && port<=32000);
    return port;
};

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
            // XXX mikhailpo: remove checking after moving all custs to range
            const check_range = !old_proxy_port ||
                old_proxy_port>=24000 && old_proxy_port<=32000;
            if (in_use)
                info.push({msg: 'port '+in_use, field: 'port'});
            else if (_this.argv.zagent && check_range)
            {
                const rest_ports_count = get_nearest_port(_this.proxies,
                    +port)-port-1;
                // 1 is master port
                const max_multiply_value = rest_ports_count+1;
                if (+port<24000 || +port>32000)
                {
                    info.push({
                        msg: 'Invalid port. It must be a number between 24000'
                            +' and 32000 in Cloud Proxy Manager.',
                        field: 'port',
                    });
                }
                else if (max_multiply_value<multiply)
                {
                    info.push({
                        msg: `Invalid multiply value. Only ${rest_ports_count}`
                            +` free ports for port ${port} `
                            +`with multiply ${multiply}. `
                            +`The biggest value of multiply, that You can set `
                            +`is ${max_multiply_value}.`,
                        field: 'multiply',
                    });
                }
            }
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
        for (let [p, m] of [['bytes', Number.MAX_SAFE_INTEGER], ['days', 1e5]])
        {
            let value = +bw_limit[p];
            if (!value || value<0 || value>m)
            {
                info.push({msg: `Invalid BW limit params, ${p} should be `
                +`positive number no greater than ${m}`, field: 'bw_limit'});
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
        if ('use_limit_webhook' in bw_limit &&
            typeof bw_limit.use_limit_webhook!='boolean')
        {
            info.push({msg: `Invalid BW limit params, use_limit_webhook `
                +`should be true or false`, field: 'bw_limit'});
        }
        if ('th_webhook_value' in bw_limit && bw_limit.th_webhook_value!=='' &&
            bw_limit.th_webhook_value!==undefined)
        {
            const th = bw_limit.th_webhook_value;
            if (typeof th!='number' || th<=0 || th>=100)
            {
                info.push({msg: `Invalid BW limit params, th_webhook_value `
                    +`should be a number between 0 and 99`,
                    field: 'bw_limit'});
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

E.prototype.update_proxies = function(){
    this.proxies.forEach(p=>{
        if (this.logged_in)
        {
            p.account_id = p.account_id || this._defaults.account_id;
            p.customer = p.customer || this._defaults.customer;
            p.customer_id = p.customer_id || this._defaults.customer_id;
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

E.prototype.init_proxies = etask._fn(function*mgr_init_proxies(_this){
    logger.system('Running proxy configurations...');
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


E.prototype.has_created_proxy_port = function(){
    return values(this.proxy_ports).some(p=>
        p.opt.proxy_type=='persist');
};

E.prototype.resolve_proxies = etask._fn(function*resolve_proxies(_this){
    const superproxy_domains = [
        'brd.superproxy.io',
        'brd.'+_this._defaults.api_domain,
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

E.prototype.update_ports = function(opt, proxy_ports){
    const indexed_proxies = this.proxies.reduce((acc, p)=>
        assign(acc, {[p.port]: p}), {});
    values(proxy_ports || this.proxy_ports).forEach(p=>{
        const conf = indexed_proxies[p.opt.port] || {};
        const override = {};
        lpm_config.mgr_proxy_shared_fields.forEach(s=>{
            if (opt[s]!==undefined && conf[s]!==undefined && conf[s]!=opt[s])
                override[s] = conf[s];
        });
        p.update_config(assign({}, opt, override));
        if (conf)
            conf.whitelist_ips = p.opt.whitelist_ips;
    });
};

