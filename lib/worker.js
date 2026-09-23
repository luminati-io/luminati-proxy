#!/usr/bin/env node
// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true, es9: true*/
if (process.env.PMGR_DEBUG)
    require('longjohn');
const cluster = require('cluster');
const http = require('http');
const https = require('https');
const tls = require('tls');
const etask = require('../util/etask.js');
const zerr = require('../util/zerr.js');
const date = require('../util/date.js');
const ssl = require('./ssl.js');
const Server = require('./server.js');
const Cache_client = require('./cache_client.js');
const Socks = require('./socks.js');
const {TLS_ERROR_MSG, MIN_TLS} = require('./consts.js');
const logger = require('./logger.js').child({category: 'Worker'});
const util = require('./util.js');
const Stat = require('./stat.js');
const perr = require('./perr.js');
const {assign} = Object;
try { require('heapdump'); } catch(e){}
let cluster_cache, cache_client;
try {
    cluster_cache = process.env.CERT_GENERATOR_URL ?
        require('../../svc/cluster_cache/fasade.js') : undefined;
    cache_client = process.env.CERT_GENERATOR_URL ?
        require('../../svc/redis_client.js').v2 : undefined;
} catch(e){
    logger.info('cluster_cache not available');
}

const PORT_MESSAGES = ['STOP', 'UNBANIPS', 'REFRESH_SESSIONS', 'UPDATE_CONFIG',
    'UPDATE_BW_LIMIT', 'UPDATE_HOSTS', 'BANIP', 'UNBANIP', 'UPDATE_LB_IPS'];

let proxy_cert_req_id = 0;
const proxy_cert_pending = new Map();

const get_proxy_cert_ipc = (_keys, hostname, _alt_names)=>etask(function*(){
    if (proxy_cert_req_id === Number.MAX_SAFE_INTEGER)
        proxy_cert_req_id = 0;
    const id = ++proxy_cert_req_id;
    proxy_cert_pending.set(id, this);
    this.finally(()=>proxy_cert_pending.delete(id));
    this.alarm_throw(35*date.ms.SEC);
    process.send({code: 'GET_PROXY_CERT', id, hostname});
    return yield this.wait();
});

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
        this.ssl_keys = msg.keys;
        this.extra_ssl_ips = msg.extra_ssl_ips;
        this.zagent = msg.zagent;
        if (!msg.ca || !ssl.set_ca(ssl.buff_to_ca(msg.ca)))
            ssl.load_ca();
        this.init_cluster_cache(msg.cluster_cache);
        this.update_get_cert_fn(msg.new_proxy_cert);
        this.init_http_server();
        this.init_https_server(msg.keys, msg.extra_ssl_ips);
        this.init_tls_server(msg.keys, msg.extra_ssl_ips);
        return this;
    }
    update_ca(ca){
        ca = ssl.buff_to_ca(ca);
        if (!ca || !ssl.set_ca(ca))
            throw new Error('Invalid CA received from manager');
        const cert = ssl.gen_ip_cert(
            this.ssl_keys,
            this.extra_ssl_ips
        );
        const secure_context = {
            ...cert,
            minVersion: MIN_TLS,
        };
        this.https_server.setSecureContext(secure_context);
        this.tls_server.setSecureContext(secure_context);
    }
    update_get_cert_fn(new_proxy_cert){
        if (!this.zagent)
            return;
        this.new_proxy_cert = new_proxy_cert;
        ssl.set_gen_proxy_cert_fn(
            new_proxy_cert ? get_proxy_cert_ipc : null
        );
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
            cluster_cache?.uninit?.();
            process.exit();
        });
    }
    restore_lpm_headers(req){
        const lpm_headers = this.lpm_headers[req.socket.remotePort];
        if (!lpm_headers)
            return;
        for (const h of Object.keys(lpm_headers))
            req.headers[h] = lpm_headers[h];
    }
    preserve_lpm_headers(req, socket){
        const port = socket.remotePort;
        for (const [k, v] of Object.entries(req.headers||{}))
        {
            if (!k || !k.startsWith('x-lpm-'))
                continue;
            this.lpm_headers[port] = this.lpm_headers[port] || {};
            this.lpm_headers[port][k] = v;
        }
    }
    init_cluster_cache(conf){
        if (!conf || !cluster_cache || !cache_client)
            return;
        cluster_cache.init({cache_client, conf, log_fn: logger.notice});
        ssl.cluster_cache = cluster_cache;
    }
    init_tls_server(keys, extra_ssl_ips){
        const options = assign({requestCert: false}, ssl(keys, extra_ssl_ips),
            {minVersion: MIN_TLS});
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
        this.lpm_headers = {};
        const options = assign({requestCert: false}, ssl(keys, extra_ssl_ips),
            {minVersion: MIN_TLS});
        this.https_server = https.createServer(options, (req, res, head)=>{
            const serv = req.socket.ssl._parentWrap.lpm_server;
            const remote_ip = this.req_remote_ip[req.socket.remotePort];
            if (remote_ip && req.socket.remoteAddress=='127.0.0.1')
                req.original_ip = remote_ip;
            const auth = this.authorization[req.socket.remotePort];
            if (auth)
                req.headers['proxy-authorization'] = auth;
            this.restore_lpm_headers(req);
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
                const err = {message: 'Wrong protocol'};
                return serv.send_error(req.method, req.url, res, err, 'lpm');
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
            this.preserve_lpm_headers(req, socket);
            socket.once('close', ()=>{
                delete this.authorization[socket.remotePort];
                delete this.req_remote_ip[socket.remotePort];
                delete this.lpm_headers[socket.remotePort];
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
            const process_send = (code, payload={})=>
                process.send({code, port, ...payload});
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
            serv.on('tcp_request', ()=>{
                process_send('TCP_REQUEST');
            });
            serv.listen();
        }
        else if (msg.code=='SETUP')
            this.setup(msg);
        else if (msg.code=='GET_PROXY_CERT_RESULT')
        {
            const pending = proxy_cert_pending.get(msg.id);
            if (!pending)
                return logger.warn('Unknown proxy cert request: %s', msg.id);
            if (msg.error)
                pending.throw(new Error(msg.error));
            else
                pending.continue(msg.cert);
        }
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
        else if (msg.code=='UPDATE_CA')
        {
            this.update_get_cert_fn(msg.data.new_proxy_cert);
            this.update_ca(msg.data.ca);
        }
        else if (!(msg.type||'').startsWith('ipc_') &&
            !(msg.handler||'').startsWith('cache_') &&
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
