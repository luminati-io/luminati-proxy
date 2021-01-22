// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true, evil: true*/
const cluster = require('cluster');

class Cache_report {
    constructor(){
        this.workers = {};
    }
    notify(id, space){
        this.workers[id] = space;
        this.cleanup();
    }
    cleanup(){
        for (let id of Object.keys(this.workers))
        {
            if (!cluster.workers[id])
                delete this.workers[id];
        }
    }
    get(){
        return Object.values(this.workers);
    }
}

module.exports = Cache_report;
