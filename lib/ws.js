// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/
const logger = require('./logger.js').child({category: 'WS'});
module.exports = Ws;

function Ws(opt){
    this.opt = opt;
    this.connections = {};
    this.next_id = 0;
}

Ws.prototype.handle_connection = function(socket, dst){
    dst.pipe(socket).pipe(dst);
    const id = this.next_id++;
    socket._connectionId = dst._connectionId = id;
    this.connections[id] = {socket, dst};
    const close = ()=>{
        const c = this.connections[id];
        if (c && c.socket.destroyed && c.dst.destroyed)
            delete this.connections[id];
    };
    socket.once('close', close);
    dst.once('close', close);
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
