// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true, evil: true*/

class Timeouts {
    constructor(){
        this.timeouts = new Set();
    }
    set_timeout(cb, delay){
        const timeout = setTimeout(()=>{
            this.timeouts.delete(timeout);
            cb();
        }, delay);
        this.timeouts.add(timeout);
    }
    set_interval(cb, delay){
        const interval = setInterval(()=>{
            this.timeouts.delete(interval);
            cb();
        }, delay);
        this.timeouts.add(interval);
    }
    clear(){
        this.timeouts.forEach(clearTimeout);
        this.timeouts.clear();
    }
}

module.exports = Timeouts;
