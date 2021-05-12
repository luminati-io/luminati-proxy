#!/usr/bin/env node
// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/
const _ = require('lodash');
const etask = require('../util/etask.js');
const logger = require('./logger.js').child({category: 'MNGR: stat'});

class Stat {
    constructor(mgr){
        this.mgr = mgr;
        this.flush_stats = this.flush_stats.bind(this);
        this.throttled_flush_stats = _.throttle(this.flush_stats, 1000);
        this.mgr.lpm_f.on('server_conf', server_conf=>{
            this.throttled_flush_stats.cancel();
            this.throttled_flush_stats = _.throttle(this.flush_stats,
                server_conf.client.send_stat_throttle||1000);
        });
        this._data = {domain: {}, port: {}};
        this.warning_shown = false;
    }
    process(data){
        const bw = (data.in_bw||0)+(data.out_bw||0);
        const domain = (data.hostname||'').replace(/\./g, '_');
        if (!valid_domain_name(domain))
            return logger.warn('invalid domain name: %s', data.hostname);
        this.inc_partial(domain, data.port, bw, data.lum_traffic);
        this.throttled_flush_stats();
    }
    inc_partial(domain, port, bw, lum){
        this.inc_key('domain', domain, bw, lum);
        this.inc_key('port', port, bw, lum);
    }
    inc_key(key, val, bw, lum){
        this._data[key][val] = this._data[key][val]||
            {bw: 0, reqs: 0, lum_bw: 0, lum_reqs: 0};
        this._data[key][val].bw += bw;
        this._data[key][val].reqs += 1;
        if (lum)
        {
            this._data[key][val].lum_bw += bw;
            this._data[key][val].lum_reqs += 1;
        }
    }
    flush_stats(){
        const data = this._data;
        this._data = {domain: {}, port: {}};
        const enable = _.get(this.mgr, 'server_conf.client.send_stat');
        if (!enable)
            return;
        if (enable%1)
        {
            if (Math.random()>enable)
                return;
        }
        const _this = this;
        return etask(function*flush_stats(){
            this.on('uncaught', e=>{
                if (_this.warning_shown)
                    return;
                logger.warn('failed updating stats %s', e.message);
                _this.warning_shown = true;
            });
            yield _this.mgr.lpm_f.send_stat(data);
        });
    }
}

const valid_domain_name = domain=>!domain.startsWith('$');

module.exports = Stat;
