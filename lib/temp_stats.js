#!/usr/bin/env node
// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/
const _ = require('lodash');
const url_lib = require('url');
const zerr = require('../util/zerr.js');

class Temp_stats {
    constructor(){
        this._data = {};
        this.throttled_flush_stats = _.throttle(this.flush_stats.bind(this),
            1000);
    }
    inc_partial(customer, url, port, bw, lum){
        const domain = this._calc_domain(url);
        if (!domain)
            return zerr.warn('no domain %s %s', url, customer);
        this._data[customer] = this._data[customer]||{domain: {}, port: {}};
        this.inc_key(customer, 'domain', domain, bw, lum);
        this.inc_key(customer, 'port', port, bw, lum);
    }
    inc_key(customer, key, val, bw, lum){
        this._data[customer][key][val] = this._data[customer][key][val]
            ||{bw: 0, reqs: 0, lum_bw: 0, lum_reqs: 0};
        this._data[customer][key][val].bw += bw;
        this._data[customer][key][val].reqs += 1;
        if (lum)
        {
            this._data[customer][key][val].lum_bw += bw;
            this._data[customer][key][val].lum_reqs += 1;
        }
    }
    clear(){
        this._data = {};
    }
    get_data(){
        return this._data;
    }
    flush_stats(){
        // XXX krzysztof: to implement sending recent stats over lpm_f
    }
    _is_ip(str){
        const ip_re = /^\d+\.\d+\.\d+\.\d+$/;
        return !!ip_re.test(str||'');
    }
    _calc_domain(url){
        let url_parts;
        let domain;
        if (url_parts = url.match(/^([^/]+?):(\d+)$/))
            domain = url_parts[1];
        else
            domain = url_lib.parse(url).hostname;
        if (!this._is_ip(domain))
            domain = (domain||'').split('.').slice(-2).join('.');
        return (domain||'').replace(/\./g, '_');
    }
}

module.exports = Temp_stats;
