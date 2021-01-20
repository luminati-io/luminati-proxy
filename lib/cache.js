// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true, evil: true*/

class Cache {
    constructor(opt={}){
        this.opt = opt;
        this.space = 0;
        this.map = new Map();
    }
    set(url, res_data, headers, duration){
        if (duration)
            setTimeout(()=>this.map.delete(url), duration);
        this.map.set(url, {res_data, headers});
    }
    has(url){
        return this.map.has(url);
    }
    get(url){
        return this.map.get(url);
    }
}

module.exports = Cache;
