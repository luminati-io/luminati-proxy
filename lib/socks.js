// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/
const _ = require('lodash');
const socks = require('socksv5');
const net = require('net');
const hutil = require('hutil');
const util = require('util');
const Luminati = require('./luminati.js');
const etask = hutil.etask;
module.exports = Socks;

function Socks(opt) {
    this.opt = opt;
    this.server = socks.createServer(this.handler.bind(this));
    this.server.useAuth(socks.auth.None());
    this.active_connections = {};
    this.next_connection_id = 0;
}

Socks.log_level = Luminati.log_level;
Socks.prototype._log = function(level, msg, extra){
    if (Socks.log_level[level]>Socks.log_level[this.opt.log])
        return;
    let args = [`${level}:${this.opt.local}-${this.opt.remote}: ${msg}`];
    if (extra)
        args.push(extra);
    console.log.apply(console, args);
};

Socks.prototype.handler = function(info, accept, deny){
    let dst, socket = accept(true);
    if (info.dstPort==80 || info.dstPort==443)
    {
        dst = net.connect(this.opt.remote, '127.0.0.1');
        if (info.dstPort==443)
        {
            this._log('DEBUG', 'Socks https connection', info);
            dst.on('connect', ()=>{
                dst.write(util.format('CONNECT %s:%d HTTP/1.1\r\n'+
                'Host: %s:%d\r\n\r\n', info.dstAddr, info.dstPort,
                info.dstAddr, info.dstPort));
                socket.pipe(dst);
            }).once('data', ()=>{ dst.pipe(socket); });
        }
        else
        {
            this._log('DEBUG', 'Socks http connection', info);
        }
    }
    else
    {
        this._log('DEBUG', 'Socks direct connection', info);
        dst = net.connect(info.dstPort, info.dstAddr);
    }
    this.add_connection(socket, dst);
    if (info.dstPort!=443)
    {
        socket.pipe(dst);
        dst.pipe(socket);
    }
};

Socks.prototype.add_connection = function(socket){
    const id = this.next_connection_id++;
    this.active_connections[id] = socket;
    socket.on('close', ()=>delete this.active_connections[id]);
    socket.on('error', error=>{
        this._log('ERROR', 'Socks connection error', {error, socket});
    });
};

Socks.prototype.start = etask._fn(function*start(_this){
    yield etask.cb_apply(_this.server, '.listen', [_this.opt.local]);
    _this.port = _this.server.address().port;
});

Socks.prototype.stop = etask._fn(function*stop(_this, force){
    let deferred = etask.nfn_apply(_this.server, '.close', []);
    if (force)
        _.values(_this.active_connections).forEach(c=>c.destroy());
    yield deferred;
});
