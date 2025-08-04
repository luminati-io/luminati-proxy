// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true es9:true*//*global BigInt*/
const cluster = require('cluster');
const uuid = require('uuid');
const cluster_ipc = require('../util/cluster_ipc.js');
const etask = require('../util/etask.js');
const zerr = require('../util/zerr.js');

class Perf_item {
    constructor(label, val, logger){
        this.label = label;
        this.val = BigInt(val);
        this.last_start = null;
        this.fix_count = 0;
        this.logger = logger || zerr;
    }
    get int(){
        return parseInt(this.val);
    }
    get ms(){
        return Math.round(this.int/1e6);
    }
    get avg_ns(){
        if (!this.fix_count)
            return 0;
        return this.int/this.fix_count;
    }
    get avg_ms(){
        if (!this.fix_count)
            return 0;
        return Math.round(this.avg_ns/1e6);
    }
    get ipc_payload(){
        return {label: this.label, val: this.int};
    }
    start(){
        this.last_start = process.hrtime.bigint();
    }
    fix(log){
        if (!this.last_start)
            return;
        const val = process.hrtime.bigint()-this.last_start;
        this.val += val;
        if (log)
            this.logger.notice('%s benchmark took %sms', this.label, val);
        this.last_start = null;
        this.fix_count++;
        if (cluster.isMaster)
            return;
        cluster_ipc.post_master('perf_item_fix', {label: this.label,
            val: parseInt(val)});
    }
    fix_ext(val){
        this.val += BigInt(val);
        this.fix_count++;
    }
}

class Instance {
    static inst = null;
    static get instance(){
        if (this.inst)
            return this.inst;
        this.inst = new this({});
        return this.inst;
    }
}

class Perf_mgr extends Instance {
    constructor(logger){
        super();
        this.times = {};
        this.logger = logger || zerr;
        if (cluster.isMaster)
        {
            this.uninit();
            cluster_ipc.master_on('perf_item_fix', msg=>
                this.get_item(msg.label).fix_ext(msg.val));
        }
    }
    get_item(label){
        if (label && !this.times[label])
            this.times[label] = new Perf_item(label, 0, this.logger);
        return this.times[label];
    }
    with_perf(fn, label, log){
        label = label || fn.name || uuid.v4();
        return (...args)=>{
            this.get_item(label).start();
            const res = fn(...args);
            this.get_item(label).fix(log);
            return res;
        };
    }
    with_perf_et(fn, label, log){
        label = label || fn.name || uuid.v4();
        let _this = this;
        return (...args)=>etask(function*(){
            _this.get_item(label).start();
            const res = yield fn(...args);
            _this.get_item(label).fix(log);
            return res;
        });
    }
    dump(clean){
        Object.entries(this.times).forEach(([label, time])=>{
            if (!time.val)
                return;
            this.logger.notice('Perf_mgr dump %s %sms, %sns, avg %sms %sns',
                label, time.ms, time.int, time.avg_ms, time.avg_ns);
        });
        if (clean===true)
            this.times = {};
    }
    start_dump_interval(interval, clean){
        this.stop_dump_interval();
        this.logger.notice('start Perf_mgr dump interval %s', interval);
        this.dump_int = setInterval(this.dump.bind(this, clean), interval);
    }
    stop_dump_interval(){
        if (!this.dump_int)
            return;
        this.logger.notice('stop Perf_mgr dump interval');
        clearInterval(this.dump_int);
        this.dump_int = null;
    }
    uninit(){
        this.stop_dump_interval();
        if (cluster.isMaster)
            cluster_ipc.master_off('perf_item_fix');
    }
}

module.exports = Perf_mgr;
