#!/usr/bin/env node
// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/
if (process.env.PMGR_DEBUG)
    require('longjohn');
const cluster = require('cluster');
const http = require('http');
const https = require('https');
const tls = require('tls');
const ssl = require('./ssl.js');
const date = require('../util/date.js');
const Server = require('./server.js');
const Cache = require('./cache.js');
const Socks = require('./socks.js');
const consts = require('./consts');
const logger = require('./logger.js').child({category: 'Worker'});
const zerr = require('../util/zerr.js');
const util = require('./util.js');
require('./perr.js').run({});
try { require('heapdump'); } catch(e){}

class Worker {
    constructor(){
        this.servers = {};
        this.cache = new Cache();
        this.socks_server = new Socks();
    }
    setup(msg){
        logger.set_level(msg.level);
        customer = msg.customer;
        this.init_http_server();
        this.init_https_server(msg.keys, msg.extra_ssl_ips);
        this.init_tls_server(msg.keys, msg.extra_ssl_ips);
        return this;
    }
    run(){
        process.on('message', this.handle_message.bind(this));
        ['SIGINT', 'uncaughtException'].forEach(sig=>{
            process.on(sig, ()=>{
                logger.info('terminating signal: %s', sig);
            });
        });
        const _this = this;
        this.cache.start_reporting();
        if (!cluster.isWorker)
            return this;
        cluster.worker.on('disconnect', function(){
            // XXX krzysztof: instead of hard exit we can gracefully shutdown
            // everything including a long running task in cache
            _this.socks_server.stop();
            process.exit();
        });
    }
    init_tls_server(keys, extra_ssl_ips){
        const options = Object.assign({requestCert: false},
            ssl(keys, extra_ssl_ips));
        this.tls_server = tls.createServer(options, socket=>{
            const serv = socket.ssl._parentWrap.lpm_server;
            socket.setNoDelay();
            socket.setTimeout(serv.opt.socket_inactivity_timeout);
            socket.once('timeout', ()=>serv.ensure_socket_close(socket));
            if (serv.opt.smtp && serv.opt.smtp.length)
                return serv.smtp_server.connect(socket);
            socket.once('data', data=>{
                socket.pause();
                socket.lpm_server = serv;
                this.http_server.emit('connection', socket);
                socket.unshift(data);
                socket.resume();
            });
        });
        this.tls_server.on('error', e=>{
            logger.error('tls_server: %s', zerr.e2s(e));
        });
    }
    init_https_server(keys, extra_ssl_ips){
        this.authorization = {};
        this.req_remote_ip = {};
        const options = Object.assign({requestCert: false},
            ssl(keys, extra_ssl_ips));
        this.https_server = https.createServer(options, (req, res, head)=>{
            const serv = res.socket.ssl._parentWrap.lpm_server;
            const remote_ip = this.req_remote_ip[req.socket.remotePort];
            if (remote_ip && req.socket.remoteAddress=='127.0.0.1')
                req.original_ip = remote_ip;
            const auth = this.authorization[req.socket.remotePort];
            if (auth)
                req.headers['proxy-authorization'] = auth;
            req.is_mitm_req = true;
            serv.sp.spawn(serv.handler(req, res, head));
        }).on('connection', socket=>socket.setNoDelay());
        this.https_server.on('error', e=>{
            logger.error('https_server: %s', zerr.e2s(e));
        });
        this.https_server.on('tlsClientError', err=>{
            if (!/(unknown ca|bad certificate)/.test(err.message))
                return;
            logger.warn(consts.TLS_ERROR_MSG);
            // serv.emit('tls_error');
        });
        this.https_server.on('upgrade', (req, socket, head)=>{
            const serv = socket.ssl._parentWrap.lpm_server;
            if (!util.is_ws_upgrade_req(req))
                return serv.ensure_socket_close(socket);
            return serv.sp.spawn(serv.handler(req, socket, head));
        });
    }
    init_http_server(){
        this.http_server = http.createServer((req, res)=>{
            const serv = res.socket.lpm_server;
            if (req.url.startsWith('https:'))
            {
                const message = 'Wrong protocol';
                return serv.send_error(req.method, req.url, res, message,
                    'lpm');
            }
            if (!req.url.startsWith('http:'))
                req.url = 'http://'+req.headers.host+req.url;
            serv.sp.spawn(serv.handler(req, res));
        });
        this.http_server.on('connection', socket=>socket.setNoDelay());
        this.http_server.on('error', e=>{
            logger.error('http_server: %s', zerr.e2s(e));
        });
        this.http_server.on('connect', (req, socket, head)=>{
            const serv = socket.lpm_server;
            if (!serv.opt.ssl || serv.bypass_intercepting(req.url))
            {
                return serv.sp &&
                    serv.sp.spawn(serv.handler(req, socket, head));
            }
            if (!serv.is_whitelisted(req))
                return serv.send_unauthorized(req, socket);
            util.write_http_reply(socket, {
                statusCode: 200,
                statusMessage: 'OK',
            }, {}, {debug: serv.opt.debug});
            const remote_ip = serv.get_req_remote_ip(req);
            if (remote_ip)
                this.req_remote_ip[socket.remotePort] = remote_ip;
            const authorization = req.headers['proxy-authorization'];
            if (authorization)
                this.authorization[socket.remotePort] = authorization;
            socket.once('close', ()=>{
                delete this.authorization[socket.remotePort];
                delete this.req_remote_ip[socket.remotePort];
            });
            socket.once('error', e=>{
                // XXX krzysztof: consider canceling whole request here
                if (e.code=='ECONNRESET')
                    return serv.logger.info('Connection closed by the client');
                serv.logger.error('https socket: %s', zerr.e2s(e));
            });
            socket.once('timeout', ()=>serv.ensure_socket_close(socket));
            socket.setTimeout(120*date.ms.SEC);
            req.once('end', ()=>socket.end());
            this.https_server.emit('connection', socket);
        });
    }
    handle_message(msg){
        if (msg.code=='CREATE')
        {
            const port = msg.opt.port;
            const opt = Object.assign({
                worker_id: cluster.worker.id,
                session_id: msg.session_id,
            }, msg.opt);
            const serv = new Server(opt, this);
            this.servers[opt.port] = serv;
            serv.on('ready', ()=>{
                process.send({code: 'READY', port});
            });
            serv.on('error', e=>{
                process.send({
                    code: 'ERROR',
                    e: {code: e.code, message: e.message},
                    port,
                });
            });
            serv.on('idle', data=>{
                process.send({code: 'IDLE', data, port});
            });
            serv.on('usage_start', data=>{
                process.send({code: 'USAGE_START', data, port});
            });
            serv.on('usage', data=>{
                process.send({code: 'USAGE', data, port});
            });
            serv.on('usage_abort', data=>{
                process.send({code: 'USAGE_ABORT', data, port});
            });
            serv.on('stopped', ()=>{
                process.send({code: 'STOPPED', port});
            });
            serv.on('banip', data=>{
                process.send({code: 'BANIP', data, port});
            });
            serv.on('unbanip', data=>{
                process.send({code: 'UNBANIP', data, port});
            });
            serv.on('refresh_ip', data=>{
                process.send({code: 'REFRESH_IP', data, port});
            });
            serv.on('retry', data=>{
                const other_serv = this.servers[data.port];
                if (!other_serv)
                {
                    return logger.error('retry failed: no server %s',
                        data.port);
                }
                other_serv.lpm_request(data.req, data.res, data.head,
                    data.post, data.opt);
            });
            serv.on('banip_global', data=>{
                process.send({code: 'BANIP_GLOBAL', data, port});
            });
            serv.on('refresh_sessions', ()=>{
                process.send({code: 'REFRESH_SESSIONS', data: {port}, port});
            });
            serv.on('add_static_ip', ip=>{
                process.send({code: 'ADD_STATIC_IP', data: {ip, port}, port});
            });
            serv.on('remove_static_ip', ip=>{
                process.send({code: 'REMOVE_STATIC_IP', data: {ip, port},
                    port});
            });
            serv.on('access_denied', ip=>{
                process.send({code: 'ADD_PENDING_IP', data: ip, port});
            });
            serv.on('tls_error', ()=>{
                process.send({code: 'TLS_ERROR', port});
            });
            serv.listen();
        }
        else if (msg.code=='STOP')
        {
            this.servers[msg.port].stop();
            delete this.servers[msg.port];
        }
        else if (msg.code=='REFRESH_SESSIONS')
        {
            this.servers[msg.port].session_mgr.refresh_sessions(
                msg.session_id);
        }
        else if (msg.code=='UPDATE_CONFIG')
            this.servers[msg.port].update_config(msg.opt);
        else if (msg.code=='UPDATE_HOSTS')
            this.servers[msg.port].update_hosts(msg.hosts, msg.cn_hosts);
        else if (msg.code=='BANIP')
        {
            this.servers[msg.port].banip(msg.data.ip, msg.data.ms, null,
                msg.data.domain);
        }
        else if (msg.code=='UNBANIP')
            this.servers[msg.port].unbanip(msg.data.ip, msg.data.domain);
        else if (msg.code=='UNBANIPS')
            this.servers[msg.port].unbanips();
        else if (msg.code=='SETUP')
            this.setup(msg);
        else
            logger.warn('unknown message: %s', msg.code);
    }
}

let customer;
process.on('uncaughtException', e=>{
    logger.error(zerr.e2s(e));
    if (e.code=='ECONNRESET')
    {
        return util.perr('error', {
            error: zerr.e2s(e),
            customer,
            ctx: 'worker uncaught exception',
        });
    }
    util.perr('crash_worker', {error: zerr.e2s(e), customer});
    setTimeout(()=>{
        process.exit();
    }, 3000);
});

process.on('exit', ()=>{
    logger.notice('process exited');
});

if (cluster.isWorker)
    new Worker().run();

module.exports = Worker;
