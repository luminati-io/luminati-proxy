#!/usr/bin/env node
// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/
const Server = require('./server.js');
const logger = require('./logger.js').child({category: 'Worker'});
const zerr = require('../util/zerr.js');
try {
    require('heapdump');
} catch(e){}

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
            serv.on('unbanip', ip=>{
                process.send({code: 'UNBANIP', ip, port});
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
                other_serv.once('response', data.post);
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
            serv.listen();
        }
        else if (msg.code=='STOP')
            this.ports[msg.port].stop();
        else if (msg.code=='REFRESH_SESSIONS')
            this.ports[msg.port].session_mgr.refresh_sessions();
        else if (msg.code=='UPDATE_CONFIG')
            this.ports[msg.port].update_config(msg.opt);
        else if (msg.code=='UPDATE_LAST_IP')
            this.ports[msg.port].session_mgr.update_last_ip(msg.ip);
        else if (msg.code=='BANIP')
        {
            this.ports[msg.port].banip(msg.data.ip, msg.data.ms, null,
                msg.data.domain);
        }
        else if (msg.code=='UNBANIP')
            this.ports[msg.port].unbanip(msg.ip);
        else
            logger.warn('unknown message: %s', msg.code);
    }
}

process.on('uncaughtException', e=>{
    logger.error(zerr.e2s(e));
});

new Worker().run();
