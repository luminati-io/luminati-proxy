// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true, evil: true*/

class Ip_cache {
    constructor(){ this.cache = new Map(); }
    add(ip, ms){
        let c = this.cache.get(ip);
        if (!c)
            c = this.cache.set(ip, {ip: ip}).get(ip);
        else
            clearTimeout(c.to);
        if (ms)
        {
            c.to = setTimeout(()=>this.cache.delete(c.ip), ms);
            c.to_date = Date.now()+ms;
        }
    }
    delete(ip){ this.cache.delete(ip); }
    has(ip){ return this.cache.has(ip); }
}

module.exports = Ip_cache;
