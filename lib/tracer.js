// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/
const http = require('http');
const https = require('https');
const hutil = require('hutil');
const etask = hutil.etask;
const zusername = require('./username.js');
const luminati = require('./luminati.js');
const url = require('url');

class Tracer {
    constructor(defaults, ws){
        this.zones = defaults.zones;
        this.customer = defaults.customer;
        this.ws = ws;
    }
    calc_auth(zone, country){
        const username = zusername.calc({zone, country,
            customer: this.customer});
        const password = this.zones[zone].password[0];
        const auth = new Buffer(username+':'+password).toString('base64');
        return `Basic ${auth}`;
    }
    trace(_url, zone, country){
        const _this = this;
        const log = [];
        return etask(function*tracer_trace(){
            let res;
            do {
                const broadcast = {log, loading: _url};
                _this.ws.broadcast(JSON.stringify(broadcast));
                res = yield _this.request(_url, zone, country);
                if (res.error)
                    return {log, err: true};
                log.push({_url, code: res.statusCode});
            } while (/3../.test(res.statusCode)&&
                (_url = res.headers&&res.headers.location));
            return {log, err: false};
        });
    }
    request(_url, zone, country){
        if (/^https:\/\//.test(_url))
            return this.https_request(_url, zone, country);
        return this.http_request(_url, zone, country);
    }
    https_request(_url, zone, country){
        const sp = etask(function*req_stats(){ yield this.wait(); });
        _url = url.parse(_url);
        const req = https.request({
            host: '107.170.35.49',
            port: 22225,
            method: 'CONNECT',
            path: _url.href+':443',
            headers: {
                'proxy-authorization': this.calc_auth(zone, country),
            },
            rejectUnauthorized: false,
        }, res=>sp.return(res));
        req.on('connect', (_res, socket, _head)=>{
            console.log('connected');
        });
        req.end();
    }
    http_request(_url, zone, country){
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
