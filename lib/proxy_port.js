#!/usr/bin/env node
// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/
const {EventEmitter} = require('events');
const Ip_cache = require('./ip_cache.js');
const cluster = require('cluster');
const logger = require('./logger.js');
const etask = require('../util/etask.js');
const date = require('../util/date.js');

class Proxy_port extends EventEmitter {
    constructor(opt){
        super();
        this.opt = opt;
        this.ready = 0;
        this.stopped = 0;
        this.banlist = new Ip_cache();
        this.handle_message = this.handle_message.bind(this);
        this.setup_worker = this.setup_worker.bind(this);
        this.dups = [];
        this.idle_since = date();
    }
    handle_message(msg){
        if (this.opt.port!=msg.port)
            return;
        if (msg.code=='ERROR')
            this.handle_error(msg.e);
        else if (msg.code=='READY')
            this.handle_ready();
        else if (msg.code=='IDLE')
            this.handle_idle(msg.data);
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
            this.handle_unbanip(msg.data);
        else if (msg.code=='REFRESH_IP')
            this.emit('refresh_ip', msg.data);
        else if (msg.code=='BANIP_GLOBAL')
            this.emit('banip_global', msg.data);
        else if (msg.code=='FIRST_LPM_ACTION')
            this.emit('first_lpm_action', msg.data);
        else if (msg.code=='SEND_RULE_MAIL')
            this.emit('send_rule_mail', msg.data);
        else if (msg.code=='ADD_STATIC_IP')
            this.emit('add_static_ip', msg.data);
        else if (msg.code=='REMOVE_STATIC_IP')
            this.emit('remove_static_ip', msg.data);
        else if (msg.code=='ADD_PENDING_IP')
            this.emit('add_pending_ip', msg.data);
        else if (msg.code=='TLS_ERROR')
            this.emit('tls_error');
        else
            logger.warn('unknown message from worker');
    }
    banip(ip, ms, domain){
        this.handle_banip({ip, ms, domain});
    }
    unbanip(ip, domain){
        this.handle_unbanip({ip, domain});
    }
    unbanips(){
        if (!this.banlist.cache.size)
            return false;
        this.banlist.clear();
        Object.values(cluster.workers).forEach(w=>{
            w.send({code: 'UNBANIPS', port: this.opt.port});
        });
        return true;
    }
    start(){
        Object.values(cluster.workers).forEach(this.setup_worker);
    }
    setup_worker(w){
        w.on('message', this.handle_message);
        w.send({code: 'CREATE', opt: this.opt});
    }
    stop(){
        const _this = this;
        return etask.all([etask(function*(){
            _this.stop_port();
            const task = this;
            _this.once('stopped', ()=>{
                task.continue();
            });
            yield this.wait();
        }), ...this.dups.map(d=>d.stop())]);
    }
    stop_port(){
        this.banlist.clear_timeouts();
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
        logger.notice('Refreshing sessions');
        Object.values(cluster.workers).forEach(w=>{
            w.send({code: 'REFRESH_SESSIONS', port: this.opt.port});
        });
    }
    is_idle_since(when){
        return this.idle_since < when;
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
    handle_idle(idle){
        if (idle)
            this.idle_since = date();
        else
            delete this.idle_since;
    }
    handle_banip(data){
        if (this.banlist.has(data.ip, data.domain))
            return false;
        this.banlist.add(data.ip, data.ms, data.domain);
        Object.values(cluster.workers).forEach(w=>{
            w.send({code: 'BANIP', port: this.opt.port, data});
        });
        return true;
    }
    handle_unbanip(data){
        if (!this.banlist.has(data.ip, data.domain))
            return false;
        this.banlist.delete(data.ip, data.domain);
        Object.values(cluster.workers).forEach(w=>{
            w.send({code: 'UNBANIP', port: this.opt.port, data});
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
    update_config(opt){
        if (opt.whitelist_ips && opt.whitelist_ips.default)
        {
            const ips = (this.opt.whitelist_ips||[])
                .filter(ip=>!opt.whitelist_ips.prev.includes(ip));
            this.opt.whitelist_ips =
                [...new Set(opt.whitelist_ips.curr.concat(ips))];
            opt = Object.assign({}, opt,
                {whitelist_ips: this.opt.whitelist_ips});
        }
        Object.assign(this.opt, opt);
        Object.values(cluster.workers).forEach(w=>{
            w.send({code: 'UPDATE_CONFIG', port: this.opt.port, opt});
        });
    }
}

module.exports = Proxy_port;
