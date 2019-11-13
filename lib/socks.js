// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/
const socks = require('lum_socksv5');
const net = require('net');
const lutil = require('./util.js');
const util = require('util');
const events = require('events');
const logger = require('./logger.js').child({category: 'SOCKS'});
const etask = require('../util/etask.js');
const zerr = require('../util/zerr.js');
module.exports = Socks;

function Socks(opt){
    events.EventEmitter.call(this);
    this.opt = opt;
    this.server = socks.createServer(this.handler.bind(this));
    this.server.useAuth(socks.auth.None());
    this.connections = {};
    this.next_id = 0;
    this.server.on('error', err=>{
        if (err.message)
            err.message = 'SOCKS '+err.message;
        this.emit('error', err);
    });
}

util.inherits(Socks, events.EventEmitter);

Socks.prototype.handler = function(info, accept, deny){
    let ip = info.srcAddr;
    if (!this.opt.serv.is_whitelisted_ip(ip))
    {
        logger.warn('access denied: %s is not whitelisted', ip);
        this.opt.serv.emit('access_denied', ip);
        return deny();
    }
    if (info.dstPort==80)
        return this.proxy_http(info, accept, deny);
    return this.proxy_https(info, accept, deny);
};

Socks.prototype.get_src_header = function(info){
    return 'x-lpm-src-addr: '+info.srcAddr.replace('::ffff:', '');
};

Socks.prototype.lpm_connect = function(){
    return net.connect(this.server._srv.address().port, '127.0.0.1');
};

Socks.prototype.proxy_https = function(info, accept, deny){
    const dst = this.lpm_connect();
    dst.on('connect', ()=>{
        dst.write(
            `CONNECT ${info.dstAddr}:${info.dstPort} HTTP/1.1\r\n`+
            `Host: ${info.dstAddr}:${info.dstPort}\r\n\r\n`);
        dst.once('data', d=>{
            let res;
            try {
                res = lutil.parse_http_res(d.toString('utf8'));
            } catch(e){
                logger.error('could not parse http resp %s', zerr.e2s(e));
                dst.end();
                deny();
                return;
            }
            if (res.headers['x-lpm-error'])
            {
                logger.warn('connection error %s:%s %s %s: %s',
                    info.dstAddr, info.dstPort, res.status_code,
                    res.status_message, res.headers['x-lpm-error']||'');
            }
            const socket = accept(true);
            if (!socket)
            {
                logger.warn('connection closed by client %s:%s', info.dstAddr,
                    info.dstPort);
                dst.end();
                return;
            }
            socket.pipe(dst).pipe(socket);
            this.handle_connection(info, socket, dst);
        });
    });
};

Socks.prototype.proxy_http = function(info, accept, deny){
    const dst = this.lpm_connect();
    const socket = accept(true);
    if (!socket)
    {
        logger.warn('connection closed by client %s:%s', info.dstAddr,
            info.dstPort);
        dst.end();
        return;
    }
    socket.pipe(dst).pipe(socket);
    return this.handle_connection(info, socket, dst);
};

Socks.prototype.get_remote_ip = function(port){
    const connection = Object.values(this.connections)
        .find(c=>c.dst.localPort==port);
    return connection && connection.remote_ip;
};

Socks.prototype.handle_connection = function(info, socket, dst){
    const id = this.next_id++;
    socket._connectionId = dst._connectionId = id;
    this.connections[id] = {socket, dst, remote_ip: socket.remoteAddress};
    const close = ()=>{
        const c = this.connections[id];
        if (c && c.socket.destroyed && c.dst.destroyed)
            delete this.connections[id];
    };
    socket.once('close', close);
    dst.once('close', close);
    socket.once('error', error=>{
        logger.warn('Socks connection error, %s', error.message);
    });
    dst.once('error', error=>{
        logger.warn('Socks forward connection error, %s', error.message);
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
    _this.server._srv.on('error', err=>{
        _this.server.emit('error', err);
    })
    .on('listening', ()=>_this.server.emit('listening'))
    .on('close', ()=>_this.server.emit('close'));
});

Socks.prototype.stop = function(){
    for (let k in this.connections)
    {
        const c = this.connections[k];
        c.socket.destroy();
        c.dst.destroy();
    }
};
