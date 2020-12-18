#!/usr/bin/env node
// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/
if (process.env.LPM_DEBUG)
    require('longjohn');
const cluster = require('cluster');
const Server = require('./server.js');
const logger = require('./logger.js').child({category: 'Worker'});
const zerr = require('../util/zerr.js');
const util = require('./util.js');
require('./perr.js').run({});
try { require('heapdump'); } catch(e){}

class Worker {
    constructor(){
        this.servers = {};
    }
    run(){
        process.on('message', this.handle_message.bind(this));
        ['SIGTERM', 'SIGINT', 'uncaughtException'].forEach(sig=>{
            process.on(sig, ()=>{
                logger.info('terminating signal: %s', sig);
            });
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
            const serv = new Server(opt);
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
                    // XXX krzysztof: need to emit error
                    return logger.error('retry failed: no server %s',
                        data.port);
                }
                other_serv.lpm_request(data.req, data.res, data.head,
                    data.post);
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
        {
            logger.set_level(msg.level);
            customer = msg.customer;
        }
        else
            logger.warn('unknown message: %s', msg.code);
    }
}

let customer;
process.on('uncaughtException', e=>{
    logger.error(zerr.e2s(e));
    util.perr('crash_worker', {error: zerr.e2s(e), customer});
    setTimeout(()=>{
        process.exit();
    }, 3000);
});

process.on('exit', ()=>{
    logger.notice('process exited');
});

new Worker().run();
