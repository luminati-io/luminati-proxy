// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/
const http = require('http');
const hutil = require('hutil');
const etask = hutil.etask;

class Tracer {
    trace(url){
        const _this = this;
        return etask(function*tracer_trace(){
            const res = yield _this.request(url);
            return res;
        });
    }
    request(url){
        const sp = etask(function*req_stats(){ yield this.wait(); });
        const req = http.request({
            host: '107.170.114.50',
            method: 'GET',
            port: 22225,
            path: 'http://lumtest.com/myip.json',
            headers: {
                'proxy-authorization': 'Basic xxx',
                'x-hola-agent': 'proxy=1.97.725 node=v8.11.2 platform=linux',
                host: 'lumtest.com',
                'accept-encoding': 'gzip, deflate',
                connection: 'close',
            },
        }, this.handler.bind(this, sp));
        req.on('error', e=>{
            console.error(`problem with request: ${e.message}`);
            sp.return('error');
        });
        req.end();
        return sp;
    }
    handler(sp, res){
        console.log(`STATUS: ${res.statusCode}`);
        console.log(`HEADERS: ${JSON.stringify(res.headers)}`);
        sp.return(res.statusCode);
    }
}

module.exports = Tracer;
