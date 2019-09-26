// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/
const https = require('https');
const {ensure_socket_close, write_http_reply} = require('./util.js');
const logger = require('./logger.js').child({category: 'WS'});
module.exports = Ws;

function Ws(opt){
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
    const proxy_req = this.proxy_https(req);
    proxy_req.on('error', e=>{
        logger.error('could not connect to ws server %s', e.message);
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
    proxy_req.on('upgrade', (res, dst, head)=>{
        if (head && head.length)
            dst.unshift(head);
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
        logger.error('Ws connection error: %s', error.message);
    });
    dst.on('error', error=>{
        logger.error('Ws forward connection error: %s', error.message);
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
