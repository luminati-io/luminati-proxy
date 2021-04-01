// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/
const http = require('http');
const https = require('https');
const Https_agent = require('./https_agent.js');
const etask = require('../util/etask.js');
const date = require('../util/date.js');
const {get_host_port} = require('./util.js');
const E = module.exports;
const https_servername = 'zproxy.luminati.io';
let tls_connect;

E.create_requester = opt=>{
    if (opt.proxy_connection_type=='https')
        return new Https_requester();
    return new Http_requester();
};

function http_request(lib){
    return function _http_request(ctx, opt){
        return lib.request(Object.assign({
            host: ctx.host,
            port: ctx.proxy_port,
            agent: this.agent,
        }, opt));
    };
}

function*request_socket(_this, parent_task, ctx, opt){
    const task = this;
    const request = _this.request(ctx, {
        method: 'CONNECT',
        path: ctx.domain+':443',
        headers: ctx.format_headers(ctx.connect_headers),
        rejectUnauthorized: false,
        // option passed down to https_agent
        lpm_username: ctx.cred.username,
        host_port: get_host_port(ctx),
    });
    request.on('connect', (res, socket, head)=>task.spawn(etask(
    function*_on_custom_tls_connect(){
        this.alarm(60*date.ms.SEC, {throw: new Error('tls connect timeout')});
        this.on('uncaught', opt.on_error);
        ctx.timeline.track('connect');
        if (!opt.use_flex_tls)
            return task.continue({res, socket, head});
        if (!tls_connect)
            tls_connect = require('../../svc/lum/agent/client.js').tls_connect;
        const flex_tls_socket = yield tls_connect({
            host: ctx.domain,
            socket,
            use_flex_tls: 1,
            http1: true,
            ignore_throw_on_close: 1,
        });
        parent_task.once('cancel', ()=>flex_tls_socket.destroy());
        flex_tls_socket.once('error', opt.on_flex_tls_err);
        const conn_socket = flex_tls_socket.socket;
        conn_socket.once('agentRemove', ()=>{
            flex_tls_socket.emit('agentRemove');
        });
        conn_socket.once('close', ()=>{
            flex_tls_socket.unpipe();
            flex_tls_socket.end();
            flex_tls_socket.emit('agentRemove');
            flex_tls_socket.off('error', opt.on_flex_tls_err);
        });
        return task.continue({res, socket: flex_tls_socket, head});
    })));
    request.on('error', opt.on_error).end();
    return yield this.wait();
}

function destroy_agents(){
    this.agent.destroy();
}

function Https_requester(){
    this.agent = new Https_agent({
        keepAlive: true,
        keepAliveMsecs: 5000,
        servername: https_servername,
    });
}

Https_requester.prototype.request_socket = etask._fn(request_socket);
Https_requester.prototype.request = http_request(https);
Https_requester.prototype.stop = destroy_agents;

function Http_requester(){
    this.agent = new http.Agent({
        keepAlive: true,
        keepAliveMsecs: 5000,
    });
}

Http_requester.prototype.request_socket = etask._fn(request_socket);
Http_requester.prototype.request = http_request(http);
Http_requester.prototype.stop = destroy_agents;

E.t = {Http_requester, Https_requester};
