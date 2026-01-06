// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true, es9: true*/
const lokijs = require('lum_lokijs');
const lfsa = require('lum_lokijs/src/loki-fs-structured-adapter.js');
const etask = require('../util/etask.js');
const string = require('../util/string.js');
const file = require('../util/file.js');
const qw = string.qw;
const logger = require('./logger.js').child({category: 'LOKI'});

const E = module.exports = Loki;

class Lpm_lokijs extends lokijs {
    constructor(path, options){
        super(path, options);
        this.beforeSave = typeof options.beforeSave == 'function' ?
            options.beforeSave : null;
    }
    // eslint-disable-next-line
    saveDatabase(callback){
        if (this.beforeSave)
            this.beforeSave();
        super.saveDatabase(callback);
    }
}

function Loki(path, max_logs){
    this.path = path;
    this.colls = {};
    this.stats_db_names = qw`port status_code hostname protocol`;
    this.db_names = [].concat(this.stats_db_names, 'request');
    this.ready = false;
    this.max_logs = max_logs || 0;
}

E.prototype.ensure_db_files = function(){
    if (file.is_file(this.path) && !file.size_e(this.path))
        file.rm_rf_e(this.path+'*');
    if (!file.is_file(this.path))
        return;
    this.db_names.forEach((db, i)=>{
        const db_path = this.path+'.'+i;
        if (!file.exists(db_path))
            file.touch_e(db_path);
    });
};

E.prototype.prepare = etask._fn(function*loki_prepare(_this){
    _this.ensure_db_files();
    const adapter = new lfsa();
    _this.loki = new Lpm_lokijs(_this.path, {
        adapter: adapter,
        autoload: true,
        autoloadCallback: ()=>this.continue(),
        autosave: true,
        autosaveInterval: 60000,
        beforeSave: _this.requests_trunc.bind(_this),
    });
    yield this.wait();
    _this.db_names.forEach(db=>{
        if (!_this.loki.getCollection(db))
            _this.loki.addCollection(db, {unique: [db], indices: ['reqs']});
        _this.colls[db] = _this.loki.getCollection(db);
    });
    _this.ready = true;
    logger.debug('loki db ready');
});

E.prototype.save = etask._fn(function*loki_save(_this){
    if (!_this.loki)
        return;
    const et = this;
    logger.notice('Saving stats to the file');
    _this.loki.saveDatabase(function(err){
        if (!err)
            return et.continue(true);
        logger.error(err);
        et.continue(err);
    });
    yield this.wait();
});

E.prototype.stats_clear = function(){
    this.stats_db_names.forEach(db=>this.colls[db].findAndRemove());
};

E.prototype.stats_clear_by_ports = function(ports){
    this.colls.port.findAndRemove({key: {$in: ports}});
};

E.prototype.requests_trunc = function(max_logs){
    if (!this.ready)
        return;
    max_logs = max_logs || this.max_logs;
    const count = this.colls.request.count();
    const rm = count-max_logs;
    if (rm>0)
        this.colls.request.chain().simplesort('timestamp').limit(rm).remove();
};

E.prototype.request_process = function(data, max_logs){
    data.in_bw = data.in_bw||0;
    data.out_bw = data.out_bw||0;
    data.bw = data.in_bw+data.out_bw;
    this.max_logs = max_logs;
    try {
        this.colls.request.insert(data);
    } catch(e){
        logger.error('request_process: %s', e.message);
    }
};

E.prototype.requests_count = function(query){
    if (!Object.keys(query).length)
        query = undefined;
    return this.colls.request.count(query);
};

E.prototype.request_get_by_id = function(uuid){
    return this.colls.request.findOne({uuid});
};

E.prototype.requests_get = function(query, sort, limit, skip){
    if (!limit)
        limit = undefined;
    return this.colls.request.chain()
        .find(query)
        .simplesort(sort.field, sort.desc)
        .offset(skip)
        .limit(limit)
        .data({removeMeta: true});
};

E.prototype.requests_clear = function(ports){
    const query = ports ? {port: {$in: ports}} : undefined;
    this.colls.request.findAndRemove(query);
};

E.prototype.requests_sum_in = function(query){
    return this.colls.request.chain().find(query).mapReduce(
        r=>r.in_bw, arr=>arr.reduce((acc, el)=>acc+el, 0));
};

E.prototype.requests_sum_out = function(query){
    return this.colls.request.chain().find(query).mapReduce(
        r=>r.out_bw, arr=>arr.reduce((acc, el)=>acc+el, 0));
};

E.prototype.stats_process = function(data, gb_cost){
    if (!data.out_bw && !data.in_bw)
        return;
    data.in_bw = data.in_bw||0;
    data.out_bw = data.out_bw||0;
    data.bypass_bw = 0;
    data.bypass_cost = 0;
    if (!data.lum_traffic)
    {
        data.bypass_bw = data.in_bw+data.out_bw;
        data.bypass_cost = data.bypass_bw*gb_cost/1e9;
    }
    let operations = [];
    this.stats_db_names.forEach(f=>{
        let key = data[f];
        if (!key)
            return;
        const record = this.colls[f].findOne({key});
        if (record)
        {
            record.in_bw += data.in_bw || 0;
            record.out_bw += data.out_bw || 0;
            record.bypass_bw = (record.bypass_bw||0)+data.bypass_bw;
            record.bypass_cost = (record.bypass_cost||0)+data.bypass_cost;
            record.reqs++;
            record.success += data.success;
            return operations.push(()=>this.colls[f].update(record));
        }
        operations.push(()=>this.colls[f].insert({
            key,
            in_bw: data.in_bw || 0,
            out_bw: data.out_bw || 0,
            bypass_bw: data.bypass_bw || 0,
            bypass_cost: data.bypass_cost || 0,
            reqs: 1,
            success: data.success,
        }));
    });
    setImmediate(()=>operations.forEach(op=>op()));
};

E.prototype.stats_get = function(){
    const protocol = this.stats_group_by('protocol');
    const s = protocol.reduce(
        (acc, el)=>({reqs: acc.reqs+el.reqs, success: acc.success+el.success}),
        {reqs: 0, success: 0});
    return {
        status_code: this.stats_group_by('status_code'),
        hostname: this.stats_group_by('hostname'),
        protocol,
        total: s.reqs,
        success: s.success,
    };
};

E.prototype.is_empty_coll = function(coll){
    return !this.colls[coll] || !this.colls[coll].data
        || !this.colls[coll].data.length;
};

E.prototype.stats_group_by = function(group_by, count=20){
    if (!this.ready || this.is_empty_coll(group_by))
        return [];
    if (!count)
        count = undefined;
    try {
        return this.colls[group_by].chain().simplesort('reqs', true)
        .limit(count).data({removeMeta: true});
    } catch(e){
        logger.error('stats_group_by: %s', e.message);
        return [];
    }
};

E.prototype.stop = function(){
    if (this.loki)
        this.loki.autosaveDisable();
};
