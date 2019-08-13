#!/usr/bin/env node
// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/
const Luminati = require('./luminati.js');
const log = require('./log.js');

class Worker {
    constructor(){
        this.log = log('Worker '+process.pid, 'info');
        this.ports = {};
    }
    run(){
        process.on('message', this.handle_message.bind(this));
    }
    handle_message(msg){
        if (msg.code=='CREATE')
        {
            const lum = new Luminati(msg.opt);
            this.ports[msg.opt.port] = lum;
            lum.on('ready', ()=>{
                process.send({code: 'READY', port: msg.opt.port});
            });
            lum.on('error', e=>{
                process.send({
                    code: 'ERROR',
                    e: {code: e.code, message: e.message},
                    port: msg.opt.port,
                });
            });
            lum.on('usage_start', data=>{
                process.send({code: 'USAGE_START', data, port: msg.opt.port});
            });
            lum.on('usage', data=>{
                process.send({code: 'USAGE', data, port: msg.opt.port});
            });
            lum.on('usage_abort', data=>{
                process.send({code: 'USAGE_ABORT', data, port: msg.opt.port});
            });
            lum.on('stopped', ()=>{
                process.send({code: 'STOPPED', port: msg.opt.port});
            });
            lum.on('banip', data=>{
                process.send({code: 'BANIP', data, port: msg.opt.port});
            });
            lum.on('unbanip', ip=>{
                process.send({code: 'UNBANIP', ip});
            });
            lum.on('refresh_ip', data=>{
                process.send({code: 'REFRESH_IP', data});
            });
            lum.listen();
        }
        else if (msg.code=='STOP')
            this.ports[msg.port].stop();
        else if (msg.code=='REFRESH_SESSIONS')
            this.ports[msg.port].session_mgr.refresh_sessions();
        else
            this.log.warn('unknown message: %s', msg.code);
    }
}

module.exports = Worker;
