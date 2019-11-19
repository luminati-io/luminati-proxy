// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true, evil: true*/
class Timeline {
    constructor(port){
        this.create = Date.now();
        this.req = {create: this.create, port};
        this.req_chain = [this.req];
    }
    track(name, ts){
        this.req[name] = ts||Date.now();
    }
    get_delta(name1, name2, idx, total){
        if (typeof name2!='string'&&!Array.isArray(name2))
        {
            total = idx;
            idx = name2;
            name2 = 'create';
        }
        if (typeof idx=='boolean')
        {
            total = idx;
            idx = this.req_chain.length-1;
        }
        let metric1 = this.get(name1, idx);
        let metric2 = this.get(name2, total ? 0 : idx);
        if (!metric1||!metric2)
            return 0;
        return metric1-metric2;
    }
    get(name, idx, nofb){
        if (typeof idx!='number')
            idx = this.req_chain.length-1;
        if (!Array.isArray(name))
            name = [name];
        for (let i=0; i<name.length; i++)
        {
            if (this.req_chain[idx][name[i]])
                return this.req_chain[idx][name[i]];
        }
        return null;
    }
    retry(port){
        const now = Date.now();
        if (!this.req.end)
            this.req.end = now;
        this.req = {create: now, port};
        this.req_chain.push(this.req);
    }
    // XXX krzysztof: not used: either remove or use
    refresh_ip(ip){
        this.refresh_req = {create: Date.now(), ip, port: 'Refreshing IP '+ip};
        this.req_chain.push(this.refresh_req);
    }
    // XXX krzysztof: not used: either remove or use
    finish_refresh_ip(ip){
        if (this.refresh_req)
            this.refresh_req.end = Date.now();
    }
    toString(){
        let parts = [`timeline: t:${this.get_delta('end', true)}ms`];
        const fmt_mtr = (name, delta)=>`${name}:${delta}ms`;
        parts = parts.concat(this.req_chain.map((r, i)=>[
            `R${i}`,
            fmt_mtr('t', this.get_delta('end', i)),
            fmt_mtr('q', this.get_delta('queue', i)),
            fmt_mtr('c', this.get_delta('connect', ['queue', 'create'], i)),
            fmt_mtr('r', this.get_delta('response',
                ['connect', 'queue', 'create'], i)),
        ].join(' ')));
        return parts.join(' ');
    }
}
module.exports = Timeline;
