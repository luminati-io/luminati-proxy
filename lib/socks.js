// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/
const socks = require('@luminati-io/socksv5');
const net = require('net');
const lutil = require('./util.js');
const util = require('util');
const events = require('events');
const log = require('./log.js');
const etask = require('../util/etask.js');
const zerr = require('../util/zerr.js');
module.exports = Socks;

function Socks(opt){
    events.EventEmitter.call(this);
    this._log = log(`socks:${opt.port}-${opt.port}`, opt.log);
    this.opt = opt;
    this.server = socks.createServer(this.handler.bind(this));
    this.server.useAuth(socks.auth.None());
    this.connections = {};
    this.next_id = 0;
    this.server.on('error', err=>{
        this._log.error('server error %O', err);
        this.emit('error', err);
    });
}

util.inherits(Socks, events.EventEmitter);

Socks.prototype.handler = function(info, accept, deny){
    if (info.dstPort==80)
        return this.proxy_http(info, accept, deny);
    if (info.dstPort==443||info.dstPort==43)
        return this.proxy_https(info, accept, deny);
    this.bypass(info, accept, deny);
};

Socks.prototype.get_src_header = function(info){
    return 'x-lpm-src-addr: '+info.srcAddr.replace('::ffff:', '');
};

Socks.prototype.lpm_connect = function(){
    return net.connect(this.server._srv.address().port, '127.0.0.1');
};

Socks.prototype.proxy_https = function(info, accept, deny){
    let dst = this.lpm_connect();
    this._log.debug('Socks https connection %O', info);
    dst.on('connect', ()=>{
        dst.write(
            `CONNECT ${info.dstAddr}:${info.dstPort} HTTP/1.1\r\n`+
            `Host: ${info.dstAddr}:${info.dstPort}\r\n`+
            `${this.get_src_header(info)}\r\n\r\n`);

        dst.once('data', d=>{
            let res;
            try {
                res = lutil.parse_http_res(d.toString('utf8'));
            } catch(e){
                this._log.error('could not parse http resp %s', zerr.e2s(e));
                dst.end();
                deny();
                return;
            }
            if (res.headers['x-lpm-error'])
            {
                this._log.error('connection error %s:%s %s %s: %s',
                    info.dstAddr, info.dstPort, res.status_code,
                    res.status_message, res.headers['x-lpm-error']||'');
            }
            let socket = accept(true);
            if (!socket)
            {
                this._log.warn('connection closed by client %O', info);
                dst.end();
                return;
            }
            socket.pipe(dst).pipe(socket);
            this._handle_connection(socket, dst);
        });
    });
};

Socks.prototype.proxy_http = function(info, accept, deny){
    let dst = this.lpm_connect();
    let socket = accept(true);

    if(!socket) {
        this._log.warn(' 11111  connection closed by client %O', info);
        dst.end();
        return;
    }

    this._log.debug('Socks http connection %O', info);
    socket.once('data', data=>{
        let d = data.toString().split('\r\n');
        d.splice(d.indexOf(''), 0, this.get_src_header(info));
        dst.write(d.join('\r\n'));
        socket.pipe(dst).pipe(socket);
    });
    return this._handle_connection(socket, dst);
};

Socks.prototype.bypass = function(info, accept, deny){
    let socket = accept(true);
    let dst = net.connect(info.dstPort, info.dstAddr);

    if(!socket) {
        this._log.warn('22222 connection closed by client %O', info);
        dst.end();
        return;
    }

    this._log.debug('Socks direct connection %O', info);
    socket.pipe(dst).pipe(socket);
    this._handle_connection(socket, dst);
};

Socks.prototype._handle_connection = function(socket, dst){
    const id = this.next_id++;
    socket._connectionId = dst._connectionId = id;
    this.connections[id] = {socket, dst};
    const end = src=>()=>{
        this._log.debug('connection end %s connid:%s', src, id);
        delete this.connections[id];
    };
    socket.on('end', end('socket'));
    dst.on('end', end('dst'));
    socket.on('error', error=>{
        this._log.error('Socks connection error, %O', error);
    });
    dst.on('error', error=>{
        this._log.error('Socks forward connection error, %O', error);
    });
};

Socks.prototype.connect = function(socket){
    this.server._onConnection(socket);
};

Socks.prototype.set_tcp_server = etask._fn(
function*set_tcp_server(_this, tcp_server){
    const sp = etask(function*close_def_srv(){ return yield this.wait(); });
    _this.server._srv.close(function(){ sp.continue(); });
    yield sp;
    _this.server._srv = tcp_server;
    _this.server._srv.on('error', err=>_this.server.emit('error', err))
    .on('listening', ()=>_this.server.emit('listening'))
    .on('close', ()=>_this.server.emit('close'));
});

Socks.prototype.stop = function(force){
    this._log.debug('Socks stopping');
    if (force)
    {
        for (let k in this.connections)
        {
            let c = this.connections[k];
            c.socket.destroy();
            c.dst.destroy();
        }
    }
    this._log.debug('Socks stopped');
};
