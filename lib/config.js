#!/usr/bin/env node
// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/
const _ = require('lodash');
const fs = require('fs');
const file = require('../util/file.js');
const {qw} = require('../util/string.js');
const lpm_config = require('../util/lpm_config.js');
const stringify = require('json-stable-stringify');

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
        proxies = proxies.map(p=>_.omit(p, qw`stats proxy_type zones _update
            www_whitelist_ips request_stats logs conflict version`));
        proxies = proxies.map(p=>_.omitBy(p, v=>!v && v!==0 && v!==false));
        proxies = proxies.map(p=>_.omitBy(p, (v, k)=>{
            if (Array.isArray(v) && !v.length)
                return true;
            const def = _.omit(_defaults, 'zone')[k];
            if (typeof v=='object')
                return _.isEqual(v, def);
            return v===def;
        }));
        proxies = proxies.map(p=>_.omitBy(p, (v, k)=>v===this.defaults[k]));
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
        if (!this.opt.filename || !_.isString(this.opt.filename))
            return;
        const config = this.serialize(this.mgr.proxies, this.mgr._defaults);
        if (fs.existsSync(this.opt.filename))
            fs.renameSync(this.opt.filename, this.opt.filename+'.backup');
        fs.writeFileSync(this.opt.filename, config);
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
        file.write_e(this.opt.filename, content);
    }
}

module.exports = Config;
