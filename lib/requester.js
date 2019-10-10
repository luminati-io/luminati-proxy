// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/
const socks = require('lum_socksv5');
const http = require('http');
const https = require('https');
const url = require('../util/url.js');
const etask = require('../util/etask.js');
const E = module.exports;
const https_servername = 'zproxy.luminati.io';

E.create_requester = opt=>{
    if (opt.proxy_connection_type=='https')
        return new Https_requester();
    if (opt.proxy_connection_type=='socks')
        return new Socks_requester();
    return new Http_requester();
};

function http_request(lib){
    return function _http_request(ctx, host, opt){
        return lib.request(Object.assign({
            host,
            port: ctx.proxy_port,
            agent: this.agents.default,
        }, opt));
    };
}

function*http_request_socket(_this, ctx, host, task, opt){
    const conn_req = _this.request(ctx, host, {
        method: 'CONNECT',
        path: ctx.domain+':443',
        headers: ctx.format_headers(ctx.connect_headers),
        rejectUnauthorized: !opt.insecure,
    })
    .on('connect', (res, socket, head)=>this.continue({res, socket, head}))
    .on('error', opt.on_error)
    .end();
    task.on('cancel', ()=>conn_req.end());
    return yield this.wait();
}

function destroy_agents(){
    Object.values(this.agents).forEach(a=>a.destroy());
}

function Https_requester(){
    this.agents = {
        default: new https.Agent({
            keepAlive: true,
            keepAliveMsecs: 5000,
            servername: https_servername,
        })
    };
}

Https_requester.prototype.request_socket = etask._fn(http_request_socket);
Https_requester.prototype.request = http_request(https);
Https_requester.prototype.stop = destroy_agents;

function Http_requester(){
    this.agents = {
        default: new http.Agent({
            keepAlive: true,
            keepAliveMsecs: 5000,
        })
    };
}

Http_requester.prototype.request_socket = etask._fn(http_request_socket);
Http_requester.prototype.request = http_request(http);
Http_requester.prototype.stop = destroy_agents;

function Socks_requester(){
    this.agents = {};
}

Socks_requester.prototype.request = function _socks_request(ctx, host, opt){
    const req_opt = url.parse(opt.path);
    const protocol =
        req_opt.protocol=='https:' || req_opt.port==443 ? 'https' : 'http';
    const agent_key = `${protocol}-${host}-${ctx.proxy_port}-`+
    `${ctx.cred.username}:${ctx.cred.password}`;
    if (!this.agents[agent_key])
    {
        const Agent = protocol=='https' ? socks.HttpsAgent : socks.HttpAgent;
        this.agents[agent_key] = new Agent({
            keepAlive: true,
            keepAliveMsecs: 5000,
            proxyHost: host,
            proxyPort: ctx.proxy_port,
            auths: [
                socks.auth.UserPassword(ctx.cred.username, ctx.cred.password),
            ],
        });
    }
    const lib = protocol=='https' ? https: http;
    return lib.request(Object.assign(opt, {
        host: req_opt.hostname,
        port: req_opt.port,
        path: req_opt.path,
        agent: this.agents[agent_key],
    }));
};

Socks_requester.prototype.request_socket = etask._fn(
function*socks_request_socket(_this, ctx, host, _, opt){
    socks.connect({
        host: ctx.domain,
        port: 443,
        proxyHost: host,
        proxyPort: ctx.proxy_port,
        auths: [socks.auth.UserPassword(ctx.cred.username, ctx.cred.password)],
    })
    .once('connect', socket=>{
        this.continue({socket});
    })
    .once('error', opt.on_error);
    return yield this.wait();
});

Socks_requester.prototype.stop = destroy_agents;

E.t = {Http_requester, Https_requester, Socks_requester};
