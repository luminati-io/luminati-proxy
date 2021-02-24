// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/
const http = require('http');
const https = require('https');
const Https_agent = require('./https_agent.js');
const etask = require('../util/etask.js');
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
            port: ctx.serv.opt.proxy_port,
            agent: this.agent,
        }, opt));
    };
}

function*request_socket(_this, ctx, opt){
    const task = this;
    _this.request(ctx, {
        method: 'CONNECT',
        path: ctx.domain+':443',
        headers: ctx.format_headers(ctx.connect_headers),
        rejectUnauthorized: false,
        // option passed down to https_agent
        lpm_username: ctx.cred.username,
        host_port: get_host_port(ctx),
    })
    .on('connect', (res, socket, head)=>etask(function*(){
        ctx.timeline.track('connect');
        if (!opt.flex_tls)
            return task.continue({res, socket, head});
        if (!tls_connect)
            tls_connect = require('../../lum/agent/client.js').tls_connect;
        const tls_socket = yield tls_connect({
            host: ctx.host,
            socket,
            use_flex_tls: 1,
            http1: true,
        });
        return task.continue({res, socket: tls_socket, head});
    }))
    .on('error', opt.on_error)
    .end();
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
