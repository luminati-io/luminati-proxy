// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true, evil: true*/
const analytics = require('universal-analytics');
const E = module.exports;

E.get_ua = ()=>new AnalyticsWrapper();
E.analytics_available = false;

class AnalyticsWrapper {
    constructor(){
        this.ua = analytics('UA-60520689-2');
    }
    event(...args){
        this.ua.event.apply(this.ua, args);
        return this;
    }
    send(...args){
        if (E.analytics_available)
            this.ua.send.apply(this.ua, args);
    }
    set(...args){
        this.ua.set.apply(this.ua, args);
    }
}
