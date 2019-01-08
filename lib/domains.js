// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true, evil:true*/

class Domains {
    constructor(opt){
        opt = opt||{};
        this.max_requests = opt.ban_ip_domain_reqs;
        this.expiration_time = opt.ban_ip_domain_time;
        this.domains = new Domains_map();
    }
    update(url){
        const requests = this._remove_expired(this.domains.get(url));
        requests.push(Date.now());
        this.domains.set(url, requests);
        return this;
    }
    _remove_expired(requests){
        requests = requests||[];
        if (!this.expiration_time)
            return requests;
        requests = requests.filter(r=>Date.now()-r < this.expiration_time);
        return requests;
    }
    reached_limit(url){
        return (this.domains.get(url)||[]).length >= this.max_requests;
    }
}

module.exports = Domains;

class Domains_map {
    constructor(){
        this.map = new Map();
    }
    extract_domain(url){
        return /^(?:https?:\/\/)?(?:[^@\n]+@)?(?:www\.)?([^:/\n?]+)/img
            .exec(url)[1];
    }
    set(url, value){
        this.map.set(this.extract_domain(url), value);
    }
    get(url){
        return this.map.get(this.extract_domain(url));
    }
}
