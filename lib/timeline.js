// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true, evil: true*/
class Timeline {
    constructor(port){
        this.req = {create: Date.now(), port};
        this.req_chain = [this.req];
    }
    track(name){
        this.req[name] = Date.now();
    }
    get_delta(name){
        let metric1 = this.get(name);
        let metric2 = this.get('create');
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
}
module.exports = Timeline;
