#!/usr/bin/env node
// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/
const _ = require('lodash');
const fs = require('fs');
const file = require('../util/file.js');
const {qw} = require('../util/string.js');
const lpm_config = require('../util/lpm_config.js');
const stringify = require('json-stable-stringify');
const Server = require('./server.js');
const migrate = require('./migration.js');
const prompt = require('prompt-sync')();
const logger = require('./logger.js');

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
    serialize(proxies, _defaults){
        proxies = proxies.filter(p=>p.proxy_type=='persist' && !p.conflict);
        proxies = proxies.map(p=>_.omit(p, qw`stats proxy_type zones
            www_whitelist_ips logs conflict version customer`));
        proxies = proxies.map(p=>_.omitBy(p, v=>!v && v!==0 && v!==false));
        const default_wl = this.mgr.get_default_whitelist();
        if (default_wl.length)
        {
            proxies.forEach(p=>{
                p.whitelist_ips = (p.whitelist_ips||[]).filter(
                    ip=>!default_wl.includes(ip));
            });
        }
        proxies = proxies.map(p=>_.omitBy(p, (v, k)=>{
            if (Array.isArray(v) && !v.length)
                return true;
            const def = _.omit(_defaults, 'zone')[k];
            if (typeof v=='object')
                return _.isEqual(v, def);
            return v===def;
        }));
        proxies = proxies.map(p=>_.omitBy(p,
            (v, k)=>k!='zone' && v===this.defaults[k]));
        _defaults = _(_defaults)
        .pick(lpm_config.default_fields.filter(f=>f!='config'))
        .omitBy((v, k)=>{
            if (typeof v=='object')
                return _.isEqual(v, this.defaults[k]);
            return v===this.defaults[k];
        });
        return stringify({proxies, _defaults}, {space: '  '});
    }
    save(){
        if (!this.opt.filename || !_.isString(this.opt.filename) ||
            this.mgr.opts.read_only)
        {
            return;
        }
        const config = this.serialize(this.mgr.proxies, this.mgr._defaults);
        try {
            if (fs.existsSync(this.opt.filename))
                fs.renameSync(this.opt.filename, this.opt.filename+'.backup');
            fs.writeFileSync(this.opt.filename, config);
        } catch(e){
            logger.error('Could not save config %s: %s', this.opt.filename,
                e.message);
        }
    }
    get_string(){
        if (file.exists(this.opt.filename))
        {
            const buffer = fs.readFileSync(this.opt.filename);
            return buffer.toString();
        }
        return '';
    }
    set_string(content){
        if (!this.mgr.opts.read_only)
            file.write_e(this.opt.filename, content);
    }
    get_proxy_configs(){
        const {explicit_opt, token, port} = this.mgr.argv;
        const {dropin, dropin_port} = this.mgr.mgr_opts;
        const _defaults = Object.assign({}, _.pick(this.defaults,
            lpm_config.default_fields));
        let proxies = [];
        lpm_config.numeric_fields.forEach(f=>{
            if (explicit_opt[f])
                explicit_opt[f] = +explicit_opt[f];
        });
        if (this.opt.filename)
        {
            const conf = this.from_file();
            Object.assign(_defaults, _.pick(conf._defaults,
                lpm_config.default_fields));
            proxies = proxies.concat(conf.proxies);
        }
        if (explicit_opt.port)
        {
            proxies.filter(p=>p.port==explicit_opt.port).forEach((p, i)=>{
                logger.warn('Conflict between config Proxy #%s and '
                    +'explicit parameter "--%s %s". Proxy settings will be'
                    +' overridden by explicit parameters.', i, 'port',
                    explicit_opt.port);
            });
            let proxy = proxies.find(p=>qw`port`.some(k=>
                explicit_opt[k] && p[k]==explicit_opt[k]));
            if (!proxy)
                proxy = proxies.find(p=>!p.port || p.port==port);
            if (!proxy)
            {
                proxies.push(Object.assign({proxy_type: 'persist'},
                    explicit_opt));
            }
            else
            {
                Object.assign(proxy, explicit_opt);
                if (!proxy.port)
                    proxy.port = port;
            }
        }
        if (dropin && _defaults.dropin!==false)
        {
            Server.dropin.listen_port = dropin_port;
            proxies.push(Object.assign({}, Server.dropin, _.pick(_defaults,
                qw`zone test_url`)));
        }
        Object.assign(_defaults, explicit_opt);
        if (token)
            _defaults.token = token;
        const max_port = port || Server.default.port;
        const next = (max, key)=>{
            while (proxies.some(p=>p[key]==max))
                max++;
            return max;
        };
        proxies.filter(c=>!c.port)
            .forEach(c=>c.port = c.port || next(max_port, 'port'));
        return {_defaults, proxies};
    }
    check(config){
        if (!config.proxies)
            config = {proxies: []};
        if (!config._defaults)
            config._defaults = this.defaults;
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
            const opt = Object.assign({}, config._defaults, p);
            let conflict = chk_port(opt.port, id);
            const multiply = p.multiply||1;
            for (let d = 1; d < multiply; d++)
                conflict = conflict || chk_port(opt.port+d, id+' Duplicate');
            if (conflict)
                p.conflict = conflict;
        });
        return _.toPairs(conflicts).map(c=>`Conflict on port ${c[0]} was `
            +'found with the folowing configurations: '+c[1].join(', '));
    }
    load_json(){
        let s;
        try {
            s = file.read_e(this.opt.filename);
            s = s.replace(/^\uFEFF/, '');
            if (!s)
                return {};
            logger.notice(`Loaded config ${this.opt.filename}`);
            logger.notice(`Running proxy configurations...`);
        } catch(e){
            logger.error(`Config ${this.opt.filename} has not been found`);
            return {};
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
            } catch(e){
                console.warn('propmpt failed');
                return {};
            }
            if (close=='y')
                return {};
            throw msg;
        }
    }
    from_file(){
        const conf = this.load_json();
        let proxies = [];
        if (conf.proxies || conf.port)
            proxies = proxies.concat(conf.proxies || conf);
        proxies = proxies.map(c=>Object.assign({proxy_type: 'persist'}, c));
        let _conf = {_defaults: conf._defaults || {}, proxies};
        if (conf._defaults || conf.proxies)
            _conf = migrate(_conf);
        return _conf;
    }
}

module.exports = Config;
