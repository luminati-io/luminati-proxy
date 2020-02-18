#!/usr/bin/env node
// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/
if (process.env.LPM_DEBUG)
    require('longjohn');
const Server = require('./server.js');
const logger = require('./logger.js').child({category: 'Worker'});
const zerr = require('../util/zerr.js');

class Worker {
    constructor(){
        this.ports = {};
    }
    run(){
        process.on('message', this.handle_message.bind(this));
        ['SIGTERM', 'SIGINT', 'uncaughtException'].forEach(sig=>{
            process.on(sig, ()=>{ });
        });
    }
    handle_message(msg){
        if (msg.code=='CREATE')
        {
            const port = msg.opt.port;
            const serv = new Server(msg.opt);
            this.ports[msg.opt.port] = serv;
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
                const other_serv = this.ports[data.port];
                if (!other_serv)
                {
                    // XXX krzysztof: need to emit error
                    return logger.warn('retry failed: no server %s',
                        data.port);
                }
                other_serv.lpm_request(data.req, data.res, data.head);
                const cb = res=>{
                    if (data.req.ctx.uuid==res.uuid)
                    {
                        data.post(res);
                        other_serv.removeListener('response', cb);
                    }
                };
                other_serv.on('response', cb);
            });
            serv.on('banip_global', data=>{
                process.send({code: 'BANIP_GLOBAL', data, port});
            });
            serv.on('first_lpm_action', data=>{
                process.send({code: 'FIRST_LPM_ACTION', data, port});
            });
            serv.on('send_rule_mail', data=>{
                process.send({code: 'SEND_RULE_MAIL', data, port});
            });
            serv.on('request_session', ()=>{
                logger.error('requesting session');
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
            this.ports[msg.port].stop();
        else if (msg.code=='REFRESH_SESSIONS')
            this.ports[msg.port].session_mgr.refresh_sessions();
        else if (msg.code=='UPDATE_CONFIG')
            this.ports[msg.port].update_config(msg.opt);
        else if (msg.code=='BANIP')
        {
            this.ports[msg.port].banip(msg.data.ip, msg.data.ms, null,
                msg.data.domain);
        }
        else if (msg.code=='UNBANIP')
            this.ports[msg.port].unbanip(msg.data.ip, msg.data.domain);
        else
            logger.warn('unknown message: %s', msg.code);
    }
}

process.on('uncaughtException', e=>{
    logger.error(zerr.e2s(e));
});

new Worker().run();
