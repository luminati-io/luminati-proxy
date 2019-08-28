#!/usr/bin/env node
// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/
const {EventEmitter} = require('events');
const Ip_cache = require('./ip_cache.js');
const cluster = require('cluster');
const log = require('./log.js');

class Proxy_port extends EventEmitter {
    constructor(opt){
        super();
        this.opt = opt;
        this.ready = 0;
        this.stopped = 0;
        this.log = log('proxy port '+opt.port, 'info');
        this.banlist = new Ip_cache();
        this.handle_message = this.handle_message.bind(this);
        Object.values(cluster.workers).forEach(w=>{
            w.on('message', this.handle_message);
        });
    }
    handle_message(msg){
        if (this.opt.port!=msg.port)
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
        else if (msg.code=='BANIP')
            this.handle_banip(msg.data);
        else if (msg.code=='UNBANIP')
            this.handle_unbanip(msg.ip);
        else if (msg.code=='REFRESH_IP')
            this.emit('refresh_ip', msg.data);
        else if (msg.code=='BANIP_GLOBAL')
            this.emit('banip_global', msg.data);
        else
            this.log.warn('unknown message from worker');
    }
    // same function signature as in Luminati
    banip(ip, ms, _, domain){
        this.handle_banip({ip, ms, domain});
    }
    unban(ip){
        this.handle_unbanip(ip);
    }
    start(){
        Object.values(cluster.workers).forEach(w=>{
            w.send({code: 'CREATE', opt: this.opt});
        });
    }
    stop_port(){
        Object.values(cluster.workers).forEach(w=>{
            w.send({code: 'STOP', port: this.opt.port});
        });
    }
    destroy(){
        Object.values(cluster.workers).forEach(w=>{
            w.removeListener('message', this.handle_message);
        });
    }
    refresh_sessions(){
        Object.values(cluster.workers).forEach(w=>{
            w.send({code: 'REFRESH_SESSIONS', port: this.opt.port});
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
    handle_banip(data){
        this.banlist.add(data.ip, data.ms, data.domain);
    }
    handle_unbanip(ip){
        if (!this.banlist.has(ip))
            return false;
        this.banlist.delete(ip);
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
