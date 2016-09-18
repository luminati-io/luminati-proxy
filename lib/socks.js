// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/
const _ = require('lodash');
const socks = require('socksv5');
const net = require('net');
const hutil = require('hutil');
const util = require('util');
const log = require('./log.js');
const etask = hutil.etask;
module.exports = Socks;

function Socks(opt) {
    this._log = log(`${opt.local}-${opt.remote}`, opt.log);
    this.opt = opt;
    this.server = socks.createServer(this.handler.bind(this));
    this.server.useAuth(socks.auth.None());
    this.connections = {};
    this.next_id = 0;
}

Socks.prototype.handler = function(info, accept, deny){
    let dst, socket = accept(true);
    const id = this.next_id++;
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
    socket._connectionId = dst._connectionId = id;
    this.connections[id] = {socket, dst};
    const end = ()=>delete this.connections[id];
    socket.on('end', end);
    dst.on('end', end);
    socket.on('error', error=>{
        this._log('ERROR', 'Socks connection error', {error, socket});
    });
    dst.on('error', error=>{
        this._log('ERROR', 'Socks forward connection error', {error, dst});
    });
    if (info.dstPort!=443)
    {
        socket.pipe(dst);
        dst.pipe(socket);
    }
};

Socks.prototype.start = etask._fn(function*start(_this){
    yield etask.cb_apply(_this.server, '.listen', [_this.opt.local]);
    _this.port = _this.server.address().port;
});

Socks.prototype.stop = etask._fn(function*stop(_this, force){
    let task = etask.nfn_apply(_this.server, '.close', []);
    _.values(_this.connections).forEach(c=>{
        if (force)
        {
            c.socket.destroy();
            c.dst.destroy();
        }
    });
    yield task;
});
