// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/
const net = require('net');
const http = require('http');
const https = require('https');
const hutil = require('hutil');
const socks = require('@luminati-io/socksv5');
const username = require('./username.js');
const ssl = require('./ssl.js');
const util = require('./util.js');
const qw = hutil.string.qw;
const lpm_headers = qw`x-hola-context proxy-authorization x-hola-agent
    x-lpm-src-addr x-lpm-session x-hola-timeline-debug x-lpm-firewall-check
    x-lpm-reserved`;
const loopback_ip = '127.0.0.1';

class Lpm {
    constructor(){
        this._servers = [];
    }
    start(){

    }
    stop(){

    }
}

class Proxy_server {
    constructor(opt){
        this._opt = opt;
        this._session_pool = new Session_pool(opt);
        this._servers = {};
        this._srv = null;
        this._create_servers();
    }
    _create_servers(){
        // XXX maximk: instantiate servers properly
        this._servers.https = new Https_server(this._opt, this.handle_req());
        this._servers.http = new Http_server(this._opt, this.handle_req());
        this._servers.socks = new Socks_server(this._opt, this._servers);
        this._srv = net.createServer(this._handle_net_conn);
    }
    _handle_net_conn(){
        return socket=>{
            const handle_socket_err = err=>console.error(err);
            socket.on('error', handle_socket_err);
            socket.once('data', this._route_net_req(socket));
        };
    }
    _route_net_req(socket){
        return buffer=>{
            socket.pause();
            let byte = buffer[0];
            let protocol = null;
            if (byte==22)
                protocol = 'https';
            else if (byte>32 && byte<127)
                protocol = 'http';
            else if (byte==5)
                protocol = 'socks';
            let server = this._servers[protocol];
            if (!server)
                return socket.end();
            socket.unshift(buffer);
            socket.resume();
            server.accept_connection(socket);
        };
    }
    handle_req(){
        return (req, res, head)=>{
            res.end(JSON.stringify({pass: true}));
        };
    }
    listen(){
        this._srv.listen(this._opt.port);
    }
    stop(){
        this._srv.stop();
    }
}

class Socks_server {
    constructor(opt, servers) {
        this._opt = opt;
        this._srvs = servers;
        this._srv = socks.createServer(this.handle_conn());
        this._srv.useAuth(socks.auth.None());
    }
    handle_conn(){
        return (info, accept, deny)=>{
            if (info.dstPort==80 && this._srvs.http)
                return this._srvs.http.accept_connection(accept(true));
            if (info.dstPort==443 && this._srvs.https)
                return this._srvs.https.accept_connection(accept(true));
            accept();
        };
    }
    accept_connection(socket){
        this._srv._onConnection(socket);
    }
}

class Https_server {
    constructor(opt, on_req){
        this._opt = opt;
        this._on_req = on_req;
        this._analize_ssl = !!opt.ssl;
        const conf = this._analize_ssl ?
            Object.assign({requestCert: false}, ssl()) : {};
        this._srv = https.createServer(conf);
        this._srv.on('connection', this.handle_conn());
        this._srv.on('request', this.handle_req());
    }
    handle_conn(){ return socket=>socket.setNoDelay(); }
    handle_req(){
        return (req, res, head)=>{
            this._on_req(req, res, head);
        };
    }
    accept_connection(socket){
        this._srv.emit('connection', socket);
    }
}

class Http_server {
    constructor(opt, on_req){
        this._opt = opt;
        this._on_req = on_req;
        this._srv = http.createServer();
        this._srv.on('connection', this.handle_conn());
        this._srv.on('request', this.handle_req());
    }
    handle_conn(){ return socket=>socket.setNoDelay(); }
    handle_req(){
        return (req, res, head)=>{
            this._on_req(req, res, head);
        };
    }
    accept_connection(socket){
        this._srv.emit('connection', socket);
    }
}

class Request {

}

class Session {
    constructor(opt){
        this._created = Date.now();
        this._opt = opt;
        this._duration = util.param_rand_range(opt.session_duration, 1000);
        this._max_requests = util.param_rand_range(opt.max_requests);
        this._count = 0;
    }
    calculate_username(){
        return username.calc(this._opt);
    }
    is_expired(){
        return this._max_requests&&this._count>=this._max_requests
            || this._duration && Date.now()-this._created > this._duration;
    }
}

class Session_pool {
    constructor(){
        this._available = [];
        this._in_use = [];
    }
    populate_pool(){

    }
    create_pooled_session(){

    }
    get_session(){

    }
    release_session(sess){
        this.clean_up(sess);

    }
    clean_up(sess){}
}

class Rules {

}

class Timeline {

}

module.exports = {Session};

function main(){
    let proxy = new Proxy_server({port: 8880, ssl: true});
    proxy.listen();
}
