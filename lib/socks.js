// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/
const socks = require('socksv5');
const net = require('net');
const hutil = require('hutil');
const util = require('util');
const events = require('events');
const log = require('./log.js');
const find_iface = require('./find_iface.js');
const etask = hutil.etask;
module.exports = Socks;

function Socks(opt){
    events.EventEmitter.call(this);
    this._log = log(`${opt.local}-${opt.remote}`, opt.log);
    this.opt = opt;
    this.server = socks.createServer(this.handler.bind(this));
    this.server.useAuth(socks.auth.None());
    this.connections = {};
    this.next_id = 0;
    this.server.on('error', err=>{
        this._log.warn(err);
        this.emit('error', err);
    });
}

util.inherits(Socks, events.EventEmitter);

Socks.prototype.handler = function(info, accept, deny){
    let dst, socket = accept(true);
    const id = this.next_id++;
    if (info.dstPort==80 || info.dstPort==443)
    {
        dst = net.connect(this.opt.remote, '127.0.0.1');
        let src_addr = info.srcAddr.replace('::ffff:', '');
        if (info.dstPort==443)
        {
            this._log.debug('Socks https connection', info);
            dst.on('connect', ()=>{
                dst.write(
                    `CONNECT ${info.dstAddr}:${info.dstPort} HTTP/1.1\r\n`+
                    `Host: ${info.dstAddr}:${info.dstPort}\r\n`+
                    `x-lpm-src-addr: ${src_addr}\r\n\r\n`);
                socket.pipe(dst);
            }).once('data', ()=>{ dst.pipe(socket); });
        }
        else
        {
            this._log.debug('Socks http connection', info);
            socket.once('data', data=>{
                let d = data.toString().split('\r\n');
                d.splice(d.indexOf(''), 0, 'x-lpm-src-addr: '+src_addr);
                dst.write(d.join('\r\n'));
                socket.pipe(dst).pipe(socket);
            });
        }
    }
    else
    {
        this._log.debug('Socks direct connection', info);
        dst = net.connect(info.dstPort, info.dstAddr);
        socket.pipe(dst).pipe(socket);
    }
    socket._connectionId = dst._connectionId = id;
    this.connections[id] = {socket, dst};
    const end = ()=>delete this.connections[id];
    socket.on('end', end);
    dst.on('end', end);
    socket.on('error', error=>{
        this._log.warn('Socks connection error', {error, socket});
    });
    dst.on('error', error=>{
        this._log.warn('Socks forward connection error', {error, dst});
    });
};

Socks.prototype.start = etask._fn(function*start(_this){
    let args = [_this.opt.local, find_iface(_this.opt.iface || '0.0.0.0')];
    _this._log.debug('Socks starting:', args);
    yield etask.cb_apply(_this.server, '.listen', args);
    _this.port = _this.server.address().port;
    _this._log.silly('Socks started');
});

Socks.prototype.stop = etask._fn(function*stop(_this, force){
    _this._log.silly('Socks stopping');
    if (force)
    {
        for (let k in _this.connections)
        {
            let c = _this.connections[k];
            c.socket.destroy();
            c.dst.destroy();
        }
    }
    yield etask.nfn_apply(_this.server, '.close', []);
    _this._log.debug('Socks stopped');
});
