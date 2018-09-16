// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/
const _ = require('lodash');
const lokijs = require('lokijs');
const lfsa = require('lokijs/src/loki-fs-structured-adapter.js');
const etask = require('../util/etask.js');
const string = require('../util/string.js');
const qw = string.qw;

const E = module.exports = Loki;

function Loki(path){
    this.path = path;
    this.colls = {};
}

E.prototype.prepare = etask._fn(function*loki_prepare(_this){
    //this.on('uncaught', e=>_this._log.error('prepare loki %s', zerr.e2s(e)));
    const adapter = new lfsa();
    _this.loki = new lokijs(_this.path, {
        adapter: adapter,
        autoload: true,
        autoloadCallback: ()=>this.continue(),
        autosave: true,
        autosaveInterval: 4000,
    });
    yield this.wait();
    const stats = _this.loki.getCollection('stats');
    if (!stats)
        _this.loki.addCollection('stats');
    _this.colls.stats = _this.loki.getCollection('stats');
});

E.prototype.stats_clear = function(opt={}){
    this.colls.stats.findAndRemove(opt);
};

E.prototype.stats_all = function(){
    return this.colls.stats.find();
};

E.prototype.stats_process = function(data){
    //this.on('uncaught', e=>_this._log.error('loki process %s', zerr.e2s(e)));
    if (!data.out_bw && !data.in_bw)
        return;
    data.in_bw = data.in_bw||0;
    data.out_bw = data.out_bw||0;
    const and = ['port', 'status_code', 'hostname', 'protocol'].map(param=>{
        if (!data[param])
            return null;
        return {[param]: data[param]};
    }).filter(Boolean);
    const s = this.colls.stats.findOne({'$and': and})||{in_bw: 0, out_bw: 0,
        reqs: 0, success: 0};
    this.colls.stats.findAndRemove({'$and': and});
    this.colls.stats.insert({
        port: data.port,
        status_code: data.status_code,
        hostname: data.hostname,
        protocol: data.protocol,
        in_bw: s.in_bw+data.in_bw,
        out_bw: s.out_bw+data.out_bw,
        reqs: s.reqs+1,
        success: s.success+data.success,
    });
};

E.prototype.stats_get_success_rate = function(){
    return this.colls.stats.chain().mapReduce(row=>row, rows=>{
        return rows.reduce((acc, el)=>{
            acc.success += el.success;
            acc.total += el.reqs;
            return acc;
        }, {success: 0, total: 0});
    });
};

E.prototype.stats_get = function(){
    const success_rate = this.stats_get_success_rate();
    return {
        status_code: this.stats_group_by('status_code'),
        hostname: this.stats_group_by('hostname'),
        protocol: this.stats_group_by('protocol'),
        total: success_rate.total,
        success: success_rate.success,
    };
};

E.prototype.stats_group_by = function(group_by){
    const fields = qw`in_bw out_bw reqs success`;
    const obj = this.colls.stats.chain().mapReduce(row=>row, rows=>{
        return rows.reduce((res, el)=>{
            if (!res[el[group_by]])
            {
                return Object.assign(res, {[el[group_by]]: _.pick(el,
                    fields)});
            }
            const new_obj = fields.reduce((entry, f)=>
                Object.assign({}, entry, {[f]: res[el[group_by]][f]+el[f]}),
            {});
            return Object.assign({}, res, {[el[group_by]]: new_obj});
        }, {});
    });
    return Object.keys(obj).map(k=>Object.assign(obj[k], {key: k}));
};
