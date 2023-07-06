#!/usr/bin/env node
// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/
const cluster = require('cluster');
const _ = require('lodash4');
const etask = require('../util/etask.js');
const cluster_ipc = require('../util/cluster_ipc.js');
const logger = require('./logger.js').child({category: 'MNGR: stat'});

class Stat {
    constructor(mgr){
        this._data = {domain: {}, port: {}};
        if (cluster.isWorker)
        {
            cluster_ipc.worker_on('get_stats',
                this._send_to_master.bind(this));
            return;
        }
        if (!mgr)
            return;
        this.mgr = mgr;
        this._default_interval = 10000;
        this.flush_stats = this.flush_stats.bind(this);
        this._agg_stats = this._agg_stats.bind(this);
        this.flush_stats_interval = etask.interval(this._default_interval,
            this.flush_stats);
        this.mgr.lpm_f.on('server_conf', server_conf=>{
            const interval = (this.mgr.argv.zagent && server_conf.cloud ||
                server_conf.client).send_stat_throttle||this._default_interval;
            this.flush_stats_interval.return();
            this.flush_stats_interval = etask.interval(interval,
                this.flush_stats);
        });
    }
    process(data={}){
        const {success, lum_traffic, port} = data;
        const bw = (data.in_bw||0)+(data.out_bw||0);
        const domain = (data.hostname||'').replace(/\./g, '_');
        if (!valid_domain_name(domain))
            return logger.warn('invalid domain name: %s', data.hostname);
        this.inc_partial(domain, port, bw, lum_traffic, success);
    }
    inc_partial(domain, port, bw, lum, success){
        this.inc_key('domain', domain, bw, lum, success);
        this.inc_key('port', port, bw, lum, success);
    }
    inc_key(key, val, bw, lum, success){
        this._data[key][val] = this._data[key][val]||
            {bw: 0, reqs: 0, lum_bw: 0, lum_reqs: 0, success: 0};
        this._data[key][val].bw += bw;
        this._data[key][val].reqs += 1;
        if (lum)
        {
            this._data[key][val].lum_bw += bw;
            this._data[key][val].lum_reqs += 1;
        }
        if (success)
            this._data[key][val].success += 1;
    }
    flush_stats(){
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
            try {
                let data = _this._agg_stats(yield etask.all({allow_fail: true},
                    cluster_ipc.call_all_workers('get_stats')));
                if (!data)
                    return;
                yield _this.mgr.lpm_f.send_stat(data);
            } catch(e){
                logger.warn('failed updating stats %s', e.message);
            }
        });
    }
    _send_to_master(){
        const data = this._data;
        this._data = {domain: {}, port: {}};
        return data;
    }
    _agg_stats(arr){
        let res;
        for (let data of arr)
        {
            if (!data || !data.domain || !Object.keys(data.domain).length)
                continue;
            res = merge(res||{}, data);
        }
        return res;
    }
}

const merge = (stat_a, stat_b)=>{
    return {
        domain: merge_bw_obj(stat_a.domain, stat_b.domain),
        port: merge_bw_obj(stat_a.port, stat_b.port),
    };
};

const empty_bw_obj = ()=>({bw: 0, reqs: 0, lum_bw: 0, lum_reqs: 0,
    success: 0});

const add_bw_obj = (obj_a, obj_b)=>{
    obj_a = obj_a||empty_bw_obj();
    obj_b = obj_b||empty_bw_obj();
    return {
        bw: obj_a.bw+obj_b.bw,
        reqs: obj_a.reqs+obj_b.reqs,
        lum_bw: obj_a.lum_bw+obj_b.lum_bw,
        lum_reqs: obj_a.lum_reqs+obj_b.lum_reqs,
        success: obj_a.success+obj_b.success,
    };
};

const merge_bw_obj = (obj_a={}, obj_b={})=>{
    for (let key of Object.keys(obj_b))
        obj_a[key] = add_bw_obj(obj_a[key], obj_b[key]);
    return obj_a;
};

const valid_domain_name = domain=>!domain.startsWith('$');

module.exports = Stat;
