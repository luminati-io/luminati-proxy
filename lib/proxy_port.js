#!/usr/bin/env node
// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/
const {EventEmitter} = require('events');
const cluster = require('cluster');

class Proxy_port extends EventEmitter {
    constructor(conf){
        super();
        this.conf = conf;
        this.ready = 0;
        this.stopped = 0;
        Object.values(cluster.workers).forEach(w=>{
            w.on('message', msg=>{
                if (this.conf.port!=msg.port)
                    return;
                if (msg.code=='ERROR')
                    this.handle_error(msg.e);
                else if (msg.code=='READY')
                    this.handle_ready();
                else if (msg.code=='USAGE_START')
                    this.emit('usage_start', msg.data);
                else if (msg.code=='USAGE')
                    this.emit('usage', msg.data);
                else if (msg.code=='USAGE_ABORT')
                    this.emit('usage_abort', msg.data);
                else if (msg.code=='STOPPED')
                    this.handle_stopped();
                else
                    console.log('unknown message from worker');
            });
        });
    }
    start(){
        Object.values(cluster.workers).forEach(w=>{
            w.send({code: 'CREATE', conf: this.conf});
        });
    }
    stop_port(){
        Object.values(cluster.workers).forEach(w=>{
            w.send({code: 'STOP', port: this.conf.port});
        });
    }
    handle_ready(){
        this.ready++;
        if (Object.values(cluster.workers).length==this.ready)
            this.emit('ready');
    }
    handle_stopped(){
        this.stopped++;
        if (Object.values(cluster.workers).length==this.stopped)
            this.emit('stopped');
    }
    handle_error(e){
        if (e.code=='EADDRINUSE')
        {
            if (this.addr_in_use)
                return;
            this.addr_in_use = true;
        }
        this.emit('error', e);
    }
}

module.exports = Proxy_port;
