// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/
const lokijs = require('lokijs');
const lfsa = require('lokijs/src/loki-fs-structured-adapter.js');
const etask = require('../util/etask.js');
const string = require('../util/string.js');
const file = require('../util/file.js');
const qw = string.qw;
const log = require('./log.js');

const E = module.exports = Loki;

function Loki(path, log_lvl){
    this.path = path;
    this.colls = {};
    this.db_names = qw`port status_code hostname protocol`;
    this.log = log('loki', log_lvl);
}

E.prototype.prepare = etask._fn(function*loki_prepare(_this){
    if (file.is_file(_this.path)&&!file.size_e(_this.path))
        file.rm_rf_e(_this.path+'*');
    const adapter = new lfsa();
    _this.loki = new lokijs(_this.path, {
        adapter: adapter,
        autoload: true,
        autoloadCallback: ()=>this.continue(),
        autosave: true,
        autosaveInterval: 60000,
    });
    yield this.wait();
    _this.db_names.forEach(db=>{
        if (!_this.loki.getCollection(db))
            _this.loki.addCollection(db, {unique: [db], indices: ['reqs']});
        _this.colls[db] = _this.loki.getCollection(db);
    });
});

E.prototype.save = etask._fn(function*loki_save(_this){
    const et = this;
    _this.log.notice('Saving stats to the file');
    _this.loki.saveDatabase(function(err){
        if (!err)
            return et.continue(true);
        _this.log.error(err);
        et.continue(err);
    });
    yield this.wait();
});

E.prototype.stats_clear = function(){
    this.db_names.forEach(db=>this.colls[db].findAndRemove());
};

E.prototype.stats_clear_by_port = function(port){
    this.colls.port.findAndRemove({key: port});
};

E.prototype.stats_process = function(data){
    if (!data.out_bw && !data.in_bw)
        return;
    data.in_bw = data.in_bw||0;
    data.out_bw = data.out_bw||0;
    this.db_names.forEach(f=>{
        if (!data[f])
            return;
        const search_opt = {key: data[f]};
        const s = this.colls[f].findOne(search_opt)||{in_bw: 0, out_bw: 0,
            reqs: 0, success: 0};
        this.colls[f].findAndRemove(search_opt);
        this.colls[f].insert({
            key: data[f],
            in_bw: s.in_bw+data.in_bw,
            out_bw: s.out_bw+data.out_bw,
            reqs: s.reqs+1,
            success: s.success+data.success,
        });
    });
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

E.prototype.stats_group_by = function(group_by, count=20){
    if (!count)
        count = undefined;
    try {
        return this.colls[group_by].chain().simplesort('reqs', true)
        .limit(count).data({removeMeta: true});
    } catch(e){ return []; }
};
