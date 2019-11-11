// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/
const {write_http_reply} = require('./util.js');
const logger = require('./logger.js').child({category: 'WS'});
module.exports = Ws;

function Ws(opt){
    this.opt = opt;
    this.connections = {};
    this.next_id = 0;
}

Ws.prototype.handle_connection = function(socket, proxy_res, proxy_socket){
    write_http_reply(socket, {
        statusCode: 101,
        statusMessage: 'Switching Protocols',
        headers: proxy_res.headers,
    });
    proxy_socket.pipe(socket).pipe(proxy_socket);
    this._handle_connection(socket, proxy_socket);
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
    socket.once('end', end);
    dst.once('end', end);
    socket.once('error', error=>{
        logger.error('Ws connection error: %s', error.message);
    });
    dst.once('error', error=>{
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
