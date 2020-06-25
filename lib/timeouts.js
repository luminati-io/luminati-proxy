// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true, evil: true*/

class Timeouts {
    constructor(){
        this.timeouts = [];
    }
    set_timeout(cb, delay){
        const timeout = setTimeout(()=>{
            this.timeouts = this.timeouts.filter(t=>t!=timeout);
            cb();
        }, delay);
        this.timeouts.push(timeout);
    }
    set_interval(cb, delay){
        const interval = setInterval(()=>{
            this.timeouts = this.timeouts.filter(t=>t!=interval);
            cb();
        }, delay);
        this.timeouts.push(interval);
    }
    clear(){
        this.timeouts.forEach(clearTimeout);
        this.timeouts = [];
    }
}

module.exports = Timeouts;
