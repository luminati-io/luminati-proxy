#!/usr/bin/env node
// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/

function empty_metrics(){
    return {sum: new Map(), avg: new Map()};
}

module.exports = {
    type: empty_metrics(),
    inc(name, by=1){
        const entry = this.type.sum[name] = this.type.sum[name]||{v: 0};
        entry.v += by;
    },
    glob_inc(name, by=1){
        this.inc('glob/'+name, by);
    },
    avg(name, val){
        const entry = this.type.avg[name] = this.type.avg[name]||{v: 0, w: 0};
        entry.v += val;
        entry.w += 1;
    },
    glob_avg(name, val){
        this.avg('glob/'+name, val);
    },
    clear(){
        this.type = empty_metrics();
    }
};
