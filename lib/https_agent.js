// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/
const https = require('https');
const util = require('util');
const E = module.exports = Https_agent;

function Https_agent(options){
    if (!(this instanceof Https_agent))
        return new Https_agent(options);
    https.Agent.call(this, options);
}

util.inherits(E, https.Agent);

E.prototype.getName = function(options){
    let name = https.Agent.prototype.getName.call(this, options);
    if (options.lpm_username)
        return name+':'+options.lpm_username;
    return options.host_port ? name+':'+options.host_port : name;
};

const create_conn_cb = (cb, err, sock)=>{
    if (typeof cb=='function')
        return void process.nextTick(cb, err, sock);
    if (err)
        return;
    return sock;
};

E.prototype.createConnection = function(options, cb){
    if (!options.lpm_socket)
        return https.Agent.prototype.createConnection.call(this, options, cb);
    const socket = options.lpm_socket;
    delete options.lpm_socket;
    if (!socket.destroyed)
        return create_conn_cb(cb, null, socket);
    return create_conn_cb(cb, new Error('create_conn_socket_destroyed'));
};
