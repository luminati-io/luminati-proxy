#!/usr/bin/env node
// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/
const Luminati = require('./luminati.js');
const log = require('./log.js');

class Worker {
    constructor(){
        this.proxy_ports = {};
        this.log = log('', 'notice');
    }
    run(){
        process.on('message', this.handle_message.bind(this));
    }
    handle_message(msg){
        if (msg.code=='CREATE')
        {
            const lum = new Luminati(msg.conf);
            lum.listen();
            lum.on('ready', ()=>{
                this.log.notice('Port %s ready', msg.conf.port);
            });
            lum.on('error', e=>{
                this.log.warn('could not create port on worker %s: %s',
                    msg.conf.port, e.message);
            });
        }
        else
            this.log.warn('unknown message: %s', msg.code);
    }
}

module.exports = Worker;
