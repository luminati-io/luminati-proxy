#!/usr/bin/env node
// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/
const {EventEmitter} = require('events');
const Ip_cache = require('./ip_cache.js');
const cluster = require('cluster');
const logger = require('./logger.js');

class Proxy_port extends EventEmitter {
    constructor(opt, config){
        super();
        this.opt = opt;
        this.config = config;
        this.ready = 0;
        this.stopped = 0;
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
        else if (msg.code=='FIRST_LPM_ACTION')
            this.emit('first_lpm_action', msg.data);
        else if (msg.code=='SEND_RULE_MAIL')
            this.emit('send_rule_mail', msg.data);
        else
            logger.warn('unknown message from worker');
    }
    banip(ip, ms, domain){
        this.handle_banip({ip, ms, domain});
    }
    unbanip(ip){
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
        if (this.banlist.has(data.ip))
            return false;
        this.banlist.add(data.ip, data.ms, data.domain);
        Object.values(cluster.workers).forEach(w=>{
            w.send({code: 'BANIP', port: this.opt.port, data});
        });
        return true;
    }
    handle_unbanip(ip){
        if (!this.banlist.has(ip))
            return false;
        this.banlist.delete(ip);
        Object.values(cluster.workers).forEach(w=>{
            w.send({code: 'UNBANIP', port: this.opt.port, ip});
        });
        return true;
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
    update_default_whitelist_ips(opt){
        const ips = (this.config.whitelist_ips||[])
            .filter(ip=>!opt.prev.includes(ip));
        this.config.whitelist_ips = [...new Set(opt.curr.concat(ips))];
    }
    update_config(opt){
        if (opt.whitelist_ips && opt.whitelist_ips.default)
        {
            this.update_default_whitelist_ips(opt.whitelist_ips);
            opt = Object.assign({}, opt,
                {whitelist_ips: this.config.whitelist_ips});
        }
        Object.assign(this.opt, opt);
        Object.values(cluster.workers).forEach(w=>{
            w.send({code: 'UPDATE_CONFIG', port: this.opt.port, opt});
        });
    }
}

module.exports = Proxy_port;
