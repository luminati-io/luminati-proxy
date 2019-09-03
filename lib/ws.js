// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/
const http = require('http');
const https = require('https');
const {ensure_socket_close, write_http_reply} = require('./util.js');
const log = require('./log.js');
const zerr = require('../util/zerr.js');
module.exports = Ws;

function Ws(opt){
    this._log = log(`ws:${opt.port}`, opt.log);
    this.opt = opt;
    this.connections = {};
    this.next_id = 0;
}

Ws.prototype.handle_connection = function(req, socket, head){
    socket.setNoDelay(true);
    if (head && head.length)
        socket.unshift(head);
    return this.handle(req, socket);
};

Ws.prototype.handle = function(req, socket){
    const is_https = !!req.connection.encrypted;
    const proxy_req = is_https ? this.proxy_https(req) : this.proxy_http(req);
    proxy_req.on('error', e=>{
        this._log.error('could not connect to ws server %s', zerr.e2s(e));
        ensure_socket_close(socket);
    });
    proxy_req.on('response', res=>{
        if (!res.upgrade)
        {
            write_http_reply(socket, {
                statusCode: res.statusCode,
                statusMessage: res.statusMessage,
                headers: res.headers,
            });
            res.pipe(socket);
        }
    });
    proxy_req.on('upgrade', (res, dst, _head)=>{
        if (_head && _head.length)
            dst.unshift(_head);
        write_http_reply(socket, {
            statusCode: 101,
            statusMessage: 'Switching Protocols',
            headers: res.headers,
        });
        dst.pipe(socket).pipe(dst);
        this._handle_connection(socket, dst);
    });
    return proxy_req.end();
};

Ws.prototype.proxy_https = function(req){
    return https.request({
        host: req.headers.host,
        path: req.url,
        headers: req.headers,
        agent: false,
        rejectUnauthorized: !this.opt.insecure,
    });
};

Ws.prototype.proxy_http = function(req){
    return http.request({
        host: req.headers.host,
        path: req.url,
        headers: req.headers,
    });
};

Ws.prototype._handle_connection = function(socket, dst){
    const id = this.next_id++;
    socket._connectionId = dst._connectionId = id;
    this.connections[id] = {socket, dst};
    const end = ()=>{
        const c = this.connections[id];
        if (c.socket.destroyed && c.dst.destroyed)
            delete this.connections[id];
    };
    socket.on('end', end);
    dst.on('end', end);
    socket.on('error', error=>{
        this._log.error('Ws connection error, %O', error);
    });
    dst.on('error', error=>{
        this._log.error('Ws forward connection error, %O', error);
    });
};

Ws.prototype.stop = function(){
    for (let k in this.connections)
    {
        const c = this.connections[k];
        c.socket.destroy();
        c.dst.destroy();
    }
};
