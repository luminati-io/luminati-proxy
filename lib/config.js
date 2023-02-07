#!/usr/bin/env node
// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/
const fs = require('fs');
const file = require('../util/file.js');
const date = require('../util/date.js');
const etask = require('../util/etask.js');
const zerr = require('../util/zerr.js');
const {qw} = require('../util/string.js');
const lpm_config = require('../util/lpm_config.js');
const zutil = require('../util/util.js');
const stringify = require('json-stable-stringify');
const Server = require('./server.js');
const migrate = require('./migration.js');
const logger = require('./logger.js').child({category: 'CONF'});
const {Netmask} = require('netmask');
const pkg = require('../package.json');
const util_lib = require('./util.js');
const consts = require('./consts.js');
let prompt;
try {
    prompt = require('prompt-sync')();
} catch(e){
    console.log('prompt-sync does not exist');
}

class Config {
    constructor(mgr, defaults, opt){
        this.mgr = mgr;
        this.defaults = defaults;
        this.opt = opt;
    }
    // XXX krzysztof: to implement
    prepare_proxy(proxy){
        return proxy;
    }
    save({skip_cloud_update, skip_broadcast}={}){
        if (this.is_read_only())
            return;
        if (!skip_cloud_update)
            this.mgr.config_ts = date();
        const config = this._serialize(this.mgr.proxies, this.mgr._defaults,
            this.mgr.config_ts);
        try {
            if (fs.existsSync(this.opt.filename))
                fs.renameSync(this.opt.filename, this.opt.filename+'.backup');
            fs.writeFileSync(this.opt.filename, config);
        } catch(e){
            logger.error('Could not save config %s: %s', this.opt.filename,
                e.message);
        }
        if (!skip_cloud_update)
            return this.upload(config, {skip_broadcast});
    }
    upload(config, opt={}){
        if (this.mgr.skip_config_sync())
            return;
        let _this = this;
        return etask(function*(){
            this.on('uncaught', e=>
                logger.error('Could not upload config: %s', zerr.e2s(e)));
            const parsed_config = JSON.parse(config);
            parsed_config._defaults = zutil.omit(parsed_config._defaults||{},
                qw`customer account_id lpm_token version sync_config
                    ask_sync_config cluster customer_id`);
            try { yield _this.mgr.lpm_f.update_conf(parsed_config, opt); }
            catch(e){
                logger.warn('upload: %s', e.message);
                if (e.message!='not_authorized')
                    throw e;
            }
        });
    }
    get_string(){
        if (file.exists(this.opt.filename))
        {
            const buffer = fs.readFileSync(this.opt.filename);
            let raw_config = buffer.toString();
            try {
                let parsed_config = JSON.parse(raw_config);
                delete parsed_config.ts;
                raw_config = stringify(parsed_config, {space: '  '});
            } catch(e){}
            return raw_config;
        }
        return '';
    }
    set_string(content, {skip_cloud_update}={}){
        if (this.is_read_only())
            return;
        let conf = content;
        if (!skip_cloud_update)
        {
            this.mgr.config_ts = date();
            try {
                let parsed_conf = JSON.parse(content);
                parsed_conf.ts = this.mgr.config_ts;
                conf = stringify(parsed_conf, {space: '  '});
            } catch(e){ conf = content; }
        }
        file.write_e(this.opt.filename, conf);
        if (!skip_cloud_update)
            return this.upload(conf);
    }
    get_proxy_configs(){
        const {explicit_proxy_opt={}, port, zagent} = this.mgr.argv;
        const {dropin, dropin_port} = this.mgr.mgr_opts;
        const _defaults = Object.assign({}, zutil.pick(this.defaults,
            ...lpm_config.default_fields));
        let proxies = [];
        let ts;
        lpm_config.numeric_fields.forEach(f=>{
            if (explicit_proxy_opt[f])
                explicit_proxy_opt[f] = +explicit_proxy_opt[f];
        });
        if (this.opt.filename || this.opt.cloud_config)
        {
            logger.notice(`Loaded config ${this.opt.cloud_config ?
                'from cloud' : this.opt.filename}`);
            const conf = this._load_config();
            Object.assign(_defaults, zutil.pick(conf._defaults,
                ...lpm_config.default_fields));
            proxies = proxies.concat(conf.proxies);
            ts = conf.ts;
        }
        if (explicit_proxy_opt.port)
        {
            proxies.filter(p=>p.port==explicit_proxy_opt.port)
                .forEach((p, i)=>{
                    logger.warn('Conflict between config Proxy #%s and '
                        +'explicit parameter "--%s %s". Proxy settings will '
                        +'be overridden by explicit parameters.', i, 'port',
                        explicit_proxy_opt.port);
                });
            let proxy = proxies.find(p=>qw`port`.some(k=>
                explicit_proxy_opt[k] && p[k]==explicit_proxy_opt[k]));
            if (!proxy)
                proxy = proxies.find(p=>!p.port || p.port==port);
            if (!proxy)
            {
                proxies.push(Object.assign({proxy_type: 'persist'},
                    explicit_proxy_opt));
            }
            else
            {
                Object.assign(proxy, explicit_proxy_opt);
                if (!proxy.port)
                    proxy.port = port;
            }
        }
        if (dropin && _defaults.dropin!==false)
        {
            Server.dropin.listen_port = dropin_port;
            Server.dropin.port = dropin_port;
            proxies.push(Object.assign({}, Server.dropin, zutil.pick(_defaults,
                ...qw`zone test_url`)));
        }
        Object.assign(_defaults, explicit_proxy_opt);
        const max_port = port || Server.default.port;
        const next = (max, key)=>{
            while (proxies.some(p=>p[key]==max))
                max++;
            return max;
        };
        proxies.filter(c=>!c.port)
            .forEach(c=>c.port = c.port || next(max_port, 'port'));
        proxies = proxies.map(this._prepare_proxy.bind(this));
        if (zagent)
        {
            const {logs, har_limit} = _defaults;
            _defaults.logs = Math.min(logs, this.defaults.logs);
            _defaults.har_limit = [-1, 1024].includes(har_limit) ?
                har_limit : this.defaults.har_limit;
        }
        return {_defaults: this.mgr.apply_argv_opts(_defaults), proxies, ts};
    }
    get_config(){
        return JSON.parse(this._serialize(this.mgr.proxies, this.mgr._defaults,
            this.mgr.config_ts));
    }
    _prepare_proxy(proxy){
        const {zagent} = this.mgr.argv;
        if (zagent)
            proxy.proxy_connection_type = this.defaults.proxy_connection_type;
        if (Array.isArray(proxy.whitelist_ips))
        {
            proxy.whitelist_ips = proxy.whitelist_ips.filter(ip=>{
                try {
                    new Netmask(ip);
                    return true;
                } catch(e){
                    logger.warn(`Invalid netmask ${ip} removed`);
                    return false;
                }
            });
        }
        if (proxy.rules && !Array.isArray(proxy.rules))
        {
            logger.warn('[%s] Removed invalid rules, should be an array',
                proxy.port);
            delete proxy.rules;
        }
        if (proxy.reverse_lookup_values &&
            !Array.isArray(proxy.reverse_lookup_values))
        {
            logger.warn('[%s] Removed invalid reverse lookup values, should '
                +'be an array', proxy.port);
            delete proxy.reverse_lookup_values;
        }
        if (proxy.ext_proxies && (!Array.isArray(proxy.ext_proxies) ||
            proxy.ext_proxies.length>consts.MAX_EXT_PROXIES) && zagent)
        {
            logger.warn('[%s] Removed invalid external proxies value, should '
                +'be an array with a max size of %s', proxy.port,
                consts.MAX_EXT_PROXIES);
            delete proxy.ext_proxies;
        }
        if (typeof proxy.session=='string' && !proxy.session)
            delete proxy.session;
        return proxy;
    }
    _serialize(proxies, _defaults, ts){
        proxies = proxies.filter(p=>p.proxy_type=='persist' && !p.conflict);
        proxies = proxies.map(p=>zutil.omit(p, qw`stats proxy_type zones
            www_whitelist_ips logs conflict version customer gb_cost banlist
            error static mobile unblock`));
        const default_wl = this.mgr.get_default_whitelist();
        if (default_wl.length)
        {
            proxies.forEach(p=>{
                p.whitelist_ips = (p.whitelist_ips||[]).filter(
                    ip=>!default_wl.includes(ip));
            });
        }
        const all_defaults = Object.assign({}, this.defaults, _defaults);
        delete all_defaults.zone;
        proxies = proxies.map(p=>util_lib.omit_defaults(p, all_defaults));
        const omitted = qw`config no_usage_stats force zagent`;
        const filtered_defaults = zutil.pick(_defaults,
            ...lpm_config.default_fields.filter(f=>!omitted.includes(f)));
        _defaults = util_lib.omit_defaults(filtered_defaults, this.defaults);
        return stringify({proxies, _defaults, ts}, {space: '  '});
    }
    _load_json(){
        const pure_config = {_defaults: {version: pkg.version}};
        let s;
        try {
            s = file.read_e(this.opt.filename);
            s = s.replace(/^\uFEFF/, '');
            if (!s)
                return pure_config;
        } catch(e){
            logger.error(`${this.opt.filename} has not been found`);
            return pure_config;
        }
        try {
            const res = JSON.parse(s);
            return res;
        } catch(e){
            const msg = `Failed parsing json file ${this.opt.filename}: `
                +`${e.message}`;
            console.warn(msg);
            let close = 'y';
            try {
                const question = `Do you want to reset the config file and`
                    +` continue?`;
                close = prompt(`${question} [y/N]`);
            } catch(_e){
                console.warn('propmpt failed');
                return pure_config;
            }
            if (close=='y')
                return pure_config;
            throw msg;
        }
    }
    _load_config(){
        const conf = this.opt.cloud_config &&
            zutil.clone_deep(this.opt.cloud_config) || this._load_json();
        conf.proxies = conf.proxies||[];
        conf._defaults = conf._defaults||{};
        if (this.opt.cloud_config)
        {
            const {lpm_token, customer, account_id, customer_id, sync_config} =
                this.mgr._defaults||{};
            conf._defaults = Object.assign({
                lpm_token,
                customer,
                account_id,
                customer_id,
                sync_config,
                version: pkg.version,
            }, conf._defaults);
        }
        conf.proxies.forEach(p=>Object.assign(p, {proxy_type: 'persist'}));
        return migrate(zutil.pick(conf, ...qw`_defaults proxies ts`));
    }
    save_local_backup(){
        if (this.is_read_only())
            return;
        try {
            if (file.exists(this.opt.filename+'.local_backup'))
                return;
            file.copy_e(this.opt.filename, this.opt.filename+'.local_backup');
        } catch(e){
            logger.error('Could not save config backup %s: %s',
                this.opt.filename, e.message);
        }
    }
    is_read_only(){
        return !this.opt.filename || typeof this.opt.filename != 'string' ||
            this.mgr.opts.read_only;
    }
}

module.exports = Config;
