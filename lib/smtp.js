// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/
const events = require('events');
const log = require('./log.js');
const util = require('util');
const net = require('net');
const lutil = require('./util.js');
const zerr = require('../util/zerr.js');

module.exports = Smtp;

function Smtp(lum, opt){
    events.EventEmitter.call(this);
    this.lum = lum;
    this.log = log(`smtp:${opt.port}`, opt.log);
    this.opt = opt;
}

util.inherits(Smtp, events.EventEmitter);

Smtp.prototype.lpm_connect = function(){
    return net.connect(this.lum.http_server.address().port, '127.0.0.1');
};

Smtp.prototype.get_url = function(){
    const ips = this.opt.ips;
    const address = ips[Math.floor(Math.random()*ips.length)];
    let [ip, port] = address.split(':');
    port = Number(port)||25;
    return `${ip}:${port}`;
};

Smtp.prototype.connect = function(socket){
    const dst = this.lpm_connect();
    dst.setNoDelay();
    dst.on('connect', ()=>{
        const url = this.get_url();
        dst.write(`CONNECT ${url} HTTP/1.1\r\n\r\n`);
        dst.once('data', d=>{
            let res;
            try {
                res = lutil.parse_http_res(d.toString('utf8'));
            } catch(e){
                this.log.error('could not parse http resp %s', zerr.e2s(e));
                dst.end();
                socket.end();
                return;
            }
            if (res.headers['x-lpm-error'])
            {
                this.log.error('connection error %s %s: %s', res.status_code,
                    res.status_message, res.headers['x-lpm-error']||'');
                dst.end();
                socket.end();
            }
            socket.pipe(dst).pipe(socket);
        });
    });
};

