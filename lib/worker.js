#!/usr/bin/env node
// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/
const Luminati = require('./luminati.js');
const log = require('./log.js');

class Worker {
    constructor(){
        this.log = log('', 'notice');
    }
    run(){
        process.on('message', this.handle_message.bind(this));
    }
    handle_message(msg){
        if (msg.code=='CREATE')
        {
            const lum = new Luminati(msg.conf);
            lum.on('ready', ()=>{
                process.send({code: 'READY', port: msg.conf.port});
            });
            lum.on('error', e=>{
                process.send({
                    code: 'ERROR',
                    e: {code: e.code, message: e.message},
                    port: msg.conf.port,
                });
            });
            lum.on('usage_start', data=>{
                process.send({code: 'USAGE_START', data, port: msg.conf.port});
            });
            lum.on('usage', data=>{
                process.send({code: 'USAGE', data, port: msg.conf.port});
            });
            lum.on('usage_abort', data=>{
                process.send({code: 'USAGE_ABORT', data, port: msg.conf.port});
            });
            lum.listen();
        }
        else
            this.log.warn('unknown message: %s', msg.code);
    }
}

module.exports = Worker;
