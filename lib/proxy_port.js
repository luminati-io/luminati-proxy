#!/usr/bin/env node
// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/
const {EventEmitter} = require('events');
const cluster = require('cluster');
const etask = require('../util/etask.js');
const date = require('../util/date.js');
const zerr = require('../util/zerr.js');
const logger = require('./logger.js');
const {Ip_cache, Cloud_ip_cache} = require('./ip_cache.js');

class Proxy_port extends EventEmitter {
    constructor(opt){
        super();
        this.opt = opt;
        this.session_id = 0;
        this.ready = 0;
        this.stopped = 0;
        this.deleting = false;
        if (opt.banlist_sync)
        {
            this.banlist = new Cloud_ip_cache(opt.banlist_sync,
                opt.customer_id+':'+opt.port);
            this.banlist.on('cmd', msg=>{
                Object.values(cluster.workers).forEach(w=>
                    this.send(w, {code: msg.cmd, port: this.opt.port,
                        data: msg.args}));
            });
            delete this.opt.banlist_sync;
        }
        else
            this.banlist = new Ip_cache((opt.banlist||{}).cache);
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
        else if (msg.code=='REFRESH_SESSIONS')
            this.refresh_sessions();
        else if (msg.code=='BANIP_GLOBAL')
            this.emit('banip_global', msg.data);
        else if (msg.code=='ADD_STATIC_IP')
            this.emit('add_static_ip', msg.data);
        else if (msg.code=='REMOVE_STATIC_IP')
            this.emit('remove_static_ip', msg.data);
        else if (msg.code=='ADD_PENDING_IP')
            this.emit('add_pending_ip', msg.data);
        else if (msg.code=='TLS_ERROR')
            this.emit('tls_error');
        else if (msg.code=='TCP_REQUEST')
            this.emit('tcp_request');
        else
            logger.warn('unknown message from worker');
    }
    send(worker, message){
        if (!worker)
            return logger.warn(`Skip send on null worker`);
        if (!worker.isConnected())
        {
            return logger.warn('Skip send %s: worker %s not connected',
                message.code||'NO_CODE', worker.id);
        }
        worker.send(message, undefined, undefined, e=>{
            if (e)
            {
                logger.error('Worker %s send error:\nPayload: %s\nErr: %s',
                    worker.id, JSON.stringify(message, null, 2), zerr.e2s(e));
            }
        });
    }
    banip(ip, ms, domain){
        return this.handle_banip({ip, ms, domain});
    }
    unbanip(ip, domain){
        this.handle_unbanip({ip, domain});
    }
    unbanips(){
        if (!this.banlist.cache.size)
            return false;
        this.banlist.clear();
        Object.values(cluster.workers).forEach(w=>
            this.send(w, {code: 'UNBANIPS', port: this.opt.port}));
        return true;
    }
    start(){
        const workers = Object.values(cluster.workers);
        if (!workers.length)
            return setTimeout(()=>this.emit('ready'));
        workers.forEach(this.setup_worker);
    }
    setup_worker(w){
        w.on('message', this.handle_message);
        const opt = Object.assign({}, this.opt,
            {banlist: this.banlist.serialize()});
        this.send(w, {code: 'CREATE', session_id: this.session_id, opt});
    }
    remove_worker(w){
        w.removeListener('message', this.handle_message);
    }
    stop(){
        const _this = this;
        return etask.all([etask(function*(){
            _this.stop_port();
            const et = etask.wait();
            _this.once('stopped', et.continue_fn());
            yield et;
        }), ...this.dups.map(d=>d && typeof d.stop == 'function' &&
            d.stop())]);
    }
    stop_port(){
        this.banlist.clear_timeouts();
        const workers = Object.values(cluster.workers);
        if (!workers.length)
            return setTimeout(()=>this.emit('stopped'));
        workers.forEach(w=>
            this.send(w, {code: 'STOP', port: this.opt.port}));
    }
    destroy(){
        Object.values(cluster.workers).forEach(w=>{
            w.removeListener('message', this.handle_message);
        });
    }
    refresh_sessions(){
        logger.notice('Refreshing sessions');
        this.session_id++;
        Object.values(cluster.workers).forEach(w=>{
            if (w.state!='listening' || this.deleting)
                return;
            this.send(w, {
                code: 'REFRESH_SESSIONS',
                port: this.opt.port,
                session_id: this.session_id,
            });
        });
        return this.session_id;
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
        Object.values(cluster.workers).forEach(w=>
            this.send(w, {code: 'BANIP', port: this.opt.port, data}));
        return true;
    }
    handle_unbanip(data){
        if (!this.banlist.has(data.ip, data.domain))
            return false;
        this.banlist.delete(data.ip, data.domain);
        Object.values(cluster.workers).forEach(w=>
            this.send(w, {code: 'UNBANIP', port: this.opt.port, data}));
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
    update_hosts(hosts, cn_hosts){
        Object.values(cluster.workers).forEach(w=>
            this.send(w, {
                code: 'UPDATE_HOSTS',
                port: this.opt.port,
                hosts,
                cn_hosts,
            })
        );
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
            this.send(w, {
                code: 'UPDATE_CONFIG',
                port: this.opt.port,
                opt: Object.assign({}, opt,
                    {banlist: this.banlist.serialize()}),
            });
        });
        this.emit('updated');
        return this.opt;
    }
    update_bw_limit(opt){
        Object.assign(this.opt, opt);
        Object.values(cluster.workers).forEach(w=>{
            this.send(w, {
                code: 'UPDATE_BW_LIMIT',
                port: this.opt.port,
                opt,
            });
        });
    }
    update_lb_ips(opt){
        Object.assign(this.opt, opt);
        Object.values(cluster.workers).forEach(w=>{
            this.send(w, {
                code: 'UPDATE_LB_IPS',
                port: this.opt.port,
                opt,
            });
        });
    }
}

module.exports = Proxy_port;
