#!/usr/bin/env node
// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/
if (process.env.PMGR_DEBUG)
    require('longjohn');
const cluster = require('cluster');
const http = require('http');
const https = require('https');
const tls = require('tls');
const zerr = require('../util/zerr.js');
const ssl = require('./ssl.js');
const Server = require('./server.js');
const Cache_client = require('./cache_client.js');
const Socks = require('./socks.js');
const {SSL_OP_NO_TLSv1_1, TLS_ERROR_MSG} = require('./consts.js');
const logger = require('./logger.js').child({category: 'Worker'});
const util = require('./util.js');
const Stat = require('./stat.js');
const perr = require('./perr.js');
const {assign} = Object;
try { require('heapdump'); } catch(e){}

const PORT_MESSAGES = ['STOP', 'UNBANIPS', 'REFRESH_SESSIONS', 'UPDATE_CONFIG',
    'UPDATE_BW_LIMIT', 'UPDATE_HOSTS', 'BANIP', 'UNBANIP', 'UPDATE_LB_IPS'];

class Worker {
    constructor(){
        this.servers = {};
        this.cache = new Cache_client();
        this.socks_server = new Socks();
        this.stat = new Stat();
    }
    setup(msg){
        perr.run({enabled: !msg.no_usage_stats, zagent: msg.zagent});
        logger.set_level(msg.level);
        customer = msg.customer;
        if (!msg.ca || !ssl.set_ca(ssl.buff_to_ca(msg.ca)))
            ssl.load_ca();
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
        if (!cluster.isWorker)
            return this;
        cluster.worker.on('disconnect', function(){
            logger.info(`C${cluster.worker.id} pid:`
                +` ${cluster.worker.process.pid} disconnected`);
            // XXX krzysztof: instead of hard exit we can gracefully shutdown
            // everything including a long running task in cache
            _this.socks_server.stop();
            process.exit();
        });
    }
    init_tls_server(keys, extra_ssl_ips){
        const options = assign({requestCert: false}, ssl(keys, extra_ssl_ips),
            {secureOptions: SSL_OP_NO_TLSv1_1});
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
        const options = assign({requestCert: false}, ssl(keys, extra_ssl_ips),
            {secureOptions: SSL_OP_NO_TLSv1_1});
        this.https_server = https.createServer(options, (req, res, head)=>{
            const serv = req.socket.ssl._parentWrap.lpm_server;
            const remote_ip = this.req_remote_ip[req.socket.remotePort];
            if (remote_ip && req.socket.remoteAddress=='127.0.0.1')
                req.original_ip = remote_ip;
            const auth = this.authorization[req.socket.remotePort];
            if (auth)
                req.headers['proxy-authorization'] = auth;
            req.is_mitm_req = true;
            serv.sp.spawn(serv.handler(req, res, head));
        }).on('connection', socket=>socket.setNoDelay());
        this.https_server.on('secureConnection', tls_socket=>{
            const serv = tls_socket._parent.lpm_server;
            tls_socket.setTimeout(serv.opt.socket_inactivity_timeout, ()=>serv
                .ensure_socket_close(tls_socket));
        });
        this.https_server.on('error', e=>{
            logger.error('https_server: %s', zerr.e2s(e));
        });
        this.https_server.on('tlsClientError', err=>{
            if (!/(unknown ca|bad certificate)/.test(err.message))
                return;
            logger.warn(TLS_ERROR_MSG);
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
            const serv = req.socket.lpm_server;
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
            }, {}, serv.opt);
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
            socket.setTimeout(serv.opt.socket_inactivity_timeout);
            this.https_server.emit('connection', socket);
        });
    }
    handle_message(msg){
        if (msg.code=='CREATE')
        {
            const port = msg.opt.port;
            const opt = assign({
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
            serv.on('usage_stats', data=>{
                this.stat.process(data);
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
        else if (msg.code=='SETUP')
            this.setup(msg);
        else if (msg.code=='UPDATE_SERVERS_OPT')
            this.update_servers_opt(msg.data);
        else if (PORT_MESSAGES.includes(msg.code) &&
            !(this.servers[msg.port] instanceof Server))
        {
            return logger.warn('message %s for uninitialized port: %s',
                msg.code, msg.port);
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
        else if (msg.code=='UPDATE_BW_LIMIT')
            this.servers[msg.port].update_bw_limit(msg.opt);
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
        else if (msg.code=='UPDATE_LB_IPS')
            this.servers[msg.port].update_lb_ips(msg.opt);
        else if (!(msg.handler||'').startsWith('cache_') &&
            msg.handler!='get_stats')
        {
            logger.warn('unknown message: %s', msg);
        }
    }
    update_servers_opt(data){
        let _this = this;
        Object.keys(this.servers).forEach(port=>{
            _this.servers[port].set_opt(data);
        });
    }
}

let customer;
process.on('uncaughtException', e=>{
    logger.error('UNCAUGHT %s', zerr.e2s(e));
    if (e.code=='ECONNRESET')
    {
        return util.perr('error', {
            error: zerr.e2s(e),
            customer,
            ctx: 'worker uncaught exception',
        });
    }
    const perr_send = util.perr('crash_worker',
        {error: zerr.e2s(e), customer});
    if (perr_send)
    {
        perr_send.catch(err=>logger.error(zerr.e2s(err)))
        .finally(process.exit);
    }
    else
        process.exit();
});

process.on('beforeExit', code=>{
    logger.notice(`process will be exited with code ${code}`);
});

process.on('exit', code=>{
    logger.notice(`process exited with code ${code}`);
});

if (cluster.isWorker)
    new Worker().run();

module.exports = Worker;
