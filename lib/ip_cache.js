// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true, evil: true*/

class Ip_cache {
    constructor(){
        this.cache = new Map();
    }
    _key(ip, domain){
        if (!domain)
            return ip;
        return `${ip}|${domain}`;
    }
    add(ip, ms, domain=''){
        const key = this._key(ip, domain);
        let c = this.cache.get(key);
        if (!c)
            c = this.cache.set(key, {ip, domain, key}).get(key);
        else
            clearTimeout(c.to);
        if (ms)
        {
            c.to = setTimeout(()=>this.cache.delete(c.key), ms);
            c.to_date = Date.now()+ms;
        }
    }
    delete(ip, domain){
        this.cache.delete(this._key(ip, domain));
    }
    clear(){
        this.cache.clear();
    }
    has(ip, domain){
        const key = this._key(ip, domain);
        return this.cache.has(ip)||this.cache.has(key);
    }
    clear_timeouts(){
        [...this.cache.values()].forEach(e=>clearTimeout(e.to));
    }
}

module.exports = Ip_cache;
