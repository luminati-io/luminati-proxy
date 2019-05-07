// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/
const events = require('events');
const log = require('./log.js');
const util = require('util');
const net = require('net');

module.exports = Smtp;

function Smtp(lum, opt){
    events.EventEmitter.call(this);
    this.lum = lum;
    this.log = log(`smtp:${opt.port}`, opt.log);
    this.opt = opt;
}

util.inherits(Smtp, events.EventEmitter);

Smtp.prototype.connect = function(socket){
    const ips = this.opt.ips;
    const address = ips[Math.floor(Math.random()*ips.length)];
    let [ip, port] = address.split(':');
    port = Number(port)||25;
    const http_socket = net.connect(this.lum.http_server.address().port,
        '127.0.0.1');
    http_socket.setNoDelay();
    socket.pipe(http_socket).pipe(socket);
    http_socket.on('connect', function(){
        http_socket.write(`CONNECT ${ip}:${port} HTTP/1.1\r\n\r\n`);
    });
};

