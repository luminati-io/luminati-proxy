// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/
const http = require('http');
const https = require('https');
const Https_agent = require('./https_agent.js');
const etask = require('../util/etask.js');
const {get_host_port} = require('./util.js');
const E = module.exports;
const https_servername = 'zproxy.luminati.io';

E.create_requester = opt=>{
    if (opt.proxy_connection_type=='https')
        return new Https_requester();
    return new Http_requester();
};

function http_request(lib){
    return function _http_request(ctx, host, opt){
        return lib.request(Object.assign({
            host,
            port: ctx.proxy_port,
            agent: this.agent,
        }, opt));
    };
}

function*http_request_socket(_this, ctx, host, opt){
    _this.request(ctx, host, {
        method: 'CONNECT',
        path: ctx.domain+':443',
        headers: ctx.format_headers(ctx.connect_headers),
        rejectUnauthorized: !opt.insecure,
        // option passed down to https_agent
        lpm_username: ctx.cred.username,
        host_port: get_host_port(ctx),
    })
    .on('connect', (res, socket, head)=>this.continue({res, socket, head}))
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

Https_requester.prototype.request_socket = etask._fn(http_request_socket);
Https_requester.prototype.request = http_request(https);
Https_requester.prototype.stop = destroy_agents;

function Http_requester(){
    this.agent = new http.Agent({
            keepAlive: true,
            keepAliveMsecs: 5000,
    });
}

Http_requester.prototype.request_socket = etask._fn(http_request_socket);
Http_requester.prototype.request = http_request(http);
Http_requester.prototype.stop = destroy_agents;

E.t = {Http_requester, Https_requester};
