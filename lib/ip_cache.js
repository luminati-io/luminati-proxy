// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true, evil: true*/

class Ip_cache {
    constructor(obj){
        this.cache = typeof obj=='object' ? this.deserialize(obj) : new Map();
    }
    create_timeouts(cache = new Map()){
        const is_ban_indefinite = ({to, to_date})=>
            to===undefined && to_date===undefined;
        const should_add_timeout = (obj, ms_left)=>
            (obj.to && obj.to._destroyed===true || !obj.to) && ms_left>0;
        for (const [k, v] of cache)
        {
            if (is_ban_indefinite(v))
                continue;
            const ms_left = v.to_date-Date.now();
            if (should_add_timeout(v, ms_left))
                v.to = setTimeout(()=>cache.delete(k), ms_left);
            else
                cache.delete(k);
        }
    }
    serialize(){
        let serialized = this.cache;
        if (serialized instanceof Map)
        {
            serialized = [...serialized].reduce((o, [k, v])=>
                Object.assign(o, {[k]: v}), {});
        }
        for (const ip in serialized)
        {
            serialized[ip] = Object.assign({}, serialized[ip]);
            delete serialized[ip].to;
        }
        return serialized;
    }
    deserialize(obj={}){
        const cache = new Map(Object.entries(obj));
        this.create_timeouts(cache);
        return cache;
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
