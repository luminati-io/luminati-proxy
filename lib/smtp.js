// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/
const events = require('events');
const logger = require('./logger.js').child({category: 'SMTP'});
const util = require('util');

module.exports = Smtp;

function Smtp(serv, opt){
    events.EventEmitter.call(this);
    this.serv = serv;
    this.opt = opt;
}

util.inherits(Smtp, events.EventEmitter);

Smtp.prototype.get_host = function(){
    const ips = this.opt.ips;
    const address = ips[Math.floor(Math.random()*ips.length)];
    let [ip, port] = address.split(':');
    port = Number(port)||25;
    return `${ip}:${port}`;
};

Smtp.prototype.connect = function(socket){
    const host = this.get_host();
    socket.unshift(Buffer.from(`CONNECT ${host} HTTP/1.1\r\n\r\n`, 'utf8'));
    socket.lpm_onconnect = res=>{
        if (res.headers['x-lpm-error'])
        {
            logger.error('connection error %s %s: %s', res.status_code,
                res.status_message, res.headers['x-lpm-error']||'');
            socket.end();
            return false;
        }
        return true;
    };
    this.serv.http_server.emit('connection', socket);
    socket.on('error', e=>{
        logger.error('error: %s', e.message);
    });
};

