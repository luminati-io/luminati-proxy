#!/usr/bin/env node
// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/
const Luminati = require('./luminati.js');
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
            const lum = new Luminati(msg.opt);
            this.ports[msg.opt.port] = lum;
            lum.on('ready', ()=>{
                process.send({code: 'READY', port});
            });
            lum.on('error', e=>{
                process.send({
                    code: 'ERROR',
                    e: {code: e.code, message: e.message},
                    port,
                });
            });
            lum.on('usage_start', data=>{
                process.send({code: 'USAGE_START', data, port});
            });
            lum.on('usage', data=>{
                process.send({code: 'USAGE', data, port});
            });
            lum.on('usage_abort', data=>{
                process.send({code: 'USAGE_ABORT', data, port});
            });
            lum.on('stopped', ()=>{
                process.send({code: 'STOPPED', port});
            });
            lum.on('banip', data=>{
                process.send({code: 'BANIP', data, port});
            });
            lum.on('unbanip', ip=>{
                process.send({code: 'UNBANIP', ip, port});
            });
            lum.on('refresh_ip', data=>{
                process.send({code: 'REFRESH_IP', data, port});
            });
            lum.on('retry', data=>{
                const serv = this.ports[data.port];
                if (!serv)
                {
                    // XXX krzysztof: need to emit error
                    return zerr.warn('retry failed: no server %s',
                        data.port);
                }
                serv.lpm_request(data.req, data.res, data.head);
                serv.once('response', data.post);
            });
            lum.on('banip_global', data=>{
                process.send({code: 'BANIP_GLOBAL', data, port});
            });
            lum.on('first_lpm_action', data=>{
                process.send({code: 'FIRST_LPM_ACTION', data, port});
            });
            lum.listen();
        }
        else if (msg.code=='STOP')
            this.ports[msg.port].stop();
        else if (msg.code=='REFRESH_SESSIONS')
            this.ports[msg.port].session_mgr.refresh_sessions();
        else
            zerr.warn('unknown message: %s', msg.code);
    }
}

new Worker().run();
