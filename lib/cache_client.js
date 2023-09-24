// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true, evil: true*/
const etask = require('../util/etask.js');
const cluster_ipc = require('../util/cluster_ipc.js');

class Cache_client {
    set(url, res_data, headers){
        return etask(function*_set(){
            return yield cluster_ipc.call_master('cache_set',
                {url, res_data, headers});
        });
    }
    has(url){
        return etask(function*_has(){
            return yield cluster_ipc.call_master('cache_has', {url});
        });
    }
    get(url){
        return etask(function*_get(){
            const res = yield cluster_ipc.call_master('cache_get', {url});
            if (res && res.res_data)
                res.res_data = res.res_data.map(d=>Buffer.from(d.data));
            return res;
        });
    }
}

module.exports = Cache_client;
