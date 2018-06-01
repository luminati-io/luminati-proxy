// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/
const http = require('http');
const hutil = require('hutil');
const etask = hutil.etask;
const zusername = require('./username.js');
const luminati = require('./luminati.js');
const url = require('url');

class Tracer {
    constructor(defaults){
        this.zones = defaults.zones;
        this.customer = defaults.customer;
    }
    calc_auth(zone, country){
        const username = zusername.calc({zone, country,
            customer: this.customer});
        const password = this.zones[zone].password[0];
        const auth = new Buffer(username+':'+password).toString('base64');
        return `Basic ${auth}`;
    }
    trace(url, zone, country){
        const _this = this;
        const log = [];
        let cont;
        return etask(function*tracer_trace(){
            let res;
            do {
                res = yield _this.request(url, zone, country);
                if (res.error)
                    return {log, err: true};
                else
                    log.push({url, code: res.statusCode});
            } while (/3../.test(res.statusCode)&&
                (url = res.headers&&res.headers.location));
            return {log, err: false};
        });
    }
    request(_url, zone, country){
        const sp = etask(function*req_stats(){ yield this.wait(); });
        _url = url.parse(_url);
        const req = http.request({
            host: '107.170.114.50',
            method: 'GET',
            port: 22225,
            path: _url.href,
            headers: {
                'proxy-authorization': this.calc_auth(zone, country),
                'x-hola-agent': luminati.hola_agent,
                host: _url.host,
                'accept-encoding': 'gzip, deflate',
                connection: 'close',
            },
        }, res=>sp.return(res));
        req.on('error', e=>sp.return({error: e.message}));
        req.end();
        return sp;
    }
    handler(sp, res){ sp.return(res); }
}

module.exports = Tracer;
