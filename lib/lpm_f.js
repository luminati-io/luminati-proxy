#!/usr/bin/env node
// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/
const _ = require('lodash');
const dns = require('dns');
const http = require('http');
const rand = require('../util/rand.js');
const etask = require('../util/etask.js');
const zws = require('../util/ws.js');
const date = require('../util/date.js');
const zerr = require('../util/zerr.js');
const logger = require('./logger.js').child({category: 'MNGR: lpm_f'});
const util_lib = require('./util.js');
const perr = require('./perr.js');

const Lpm_f = etask._class(class Lpm_f {
    constructor(mgr){
        this.mgr = mgr;
        this.argv = mgr.argv;
        this.errors = 0;
        this.ever_connected = false;
        this.sync_recent_stats = _.throttle(this.update_stats, date.ms.MIN);
    }
    init(){
        const uri_ws = `ws://zagent75.${this.mgr._defaults.api_domain}`;
        this.ws = new zws.Client(uri_ws, {
            label: 'lpm_f',
            agent: new http.Agent({
                lookup: (hostname, opt, cb)=>{
                    const _opt = Object.assign({}, opt,
                        {family: 4, all: true});
                    dns.lookup(hostname, _opt, (err, res)=>{
                        if (err)
                            return cb(err);
                        const {address, family=4} = rand.rand_element(res)||{};
                        cb(undefined, address, family);
                    });
                },
            }),
            ipc_client: {
                hello: 'post',
                reset_auth: 'post',
                auth: {type: 'call', timeout: 30*date.ms.SEC},
                update_conf: {type: 'call', timeout: 30*date.ms.SEC},
                get_conf: {type: 'call', timeout: 30*date.ms.SEC},
                update_stats: {type: 'call', timeout: 30*date.ms.SEC},
            },
        }).on('connected', ()=>{
            logger.notice('Connection established');
            this.ever_connected = true;
            let _this = this;
            return etask(function*(){
                yield _this.ws.ipc.hello();
                if (!_this.mgr._defaults.lpm_token)
                    return;
                yield _this.login({apply_cloud_config: 1}, ()=>
                    _this.sync_recent_stats());
            });
        }).on('json', d=>{
            if (!d || !d.msg)
                return;
            const _this = this;
            return etask(function*(){
                this.on('uncaught', e=>logger.error('json %s', zerr.e2s(e)));
                if (d.msg=='new_conf')
                    yield _this.mgr.apply_cloud_config(d.new_conf);
                else if (d.msg=='zones')
                    _this.mgr.apply_zones_config(d.zones);
            });
        }).on('disconnected', ()=>{
            logger.warn('Connection failed');
            this.errors++;
            if (this.errors>1 && !this.ever_connected)
            {
                logger.warn('Could not establish WS connection to '+uri_ws);
                this.ws.close();
            }
        });
    }
    close(){
        if (this.ws)
            this.ws.close();
        if (this.sync_recent_stats)
            this.sync_recent_stats.cancel();
    }
    connected(){
        return this.ws && this.ws.connected;
    }
    *login(_this, opt, cb){
        opt = opt||{};
        this.on('uncaught', e=>{
            logger.error('login %s', zerr.e2s(e));
            util_lib.perr('error', {error: zerr.e2s(e), ctx: 'lpm_f login'});
        });
        const lpm_token = _this.mgr._defaults.lpm_token;
        if (!_this.connected() || !lpm_token)
            return;
        const auth_res = yield _this.ws.ipc.auth({lpm_token});
        if (auth_res.err)
            return void logger.warn('Authentication failed: '+auth_res.err);
        logger.notice('Authentication success');
        if (opt.apply_cloud_config)
            yield _this.mgr.apply_cloud_config(auth_res.config);
        if (cb)
            yield cb();
        return auth_res;
    }
    *logout(_this){
        this.on('uncaught', e=>logger.error('logout %s', zerr.e2s(e)));
        if (!_this.connected())
            return;
        yield _this.ws.ipc.reset_auth();
    }
    *update_conf(_this, config, opt={}){
        this.on('uncaught', e=>logger.error('update_conf %s', zerr.e2s(e)));
        const lpm_token = _this.mgr._defaults.lpm_token;
        if (!_this.connected() || !lpm_token)
            return;
        const change = Object.assign({}, _this.mgr.config_changes);
        _this.mgr.config_changes = {};
        const resp = yield _this.ws.ipc.update_conf({
            lpm_token,
            config,
            change,
        });
        if (!opt.retried && resp && resp.err && resp.err=='not_authorized')
            yield _this.login({}, ()=>_this.update_conf(config, {retried: 1}));
    }
    *get_conf(_this, opt={}){
        this.on('uncaught', e=>logger.error('get_conf %s', zerr.e2s(e)));
        const lpm_token = _this.mgr._defaults.lpm_token;
        if (!_this.connected() || !lpm_token)
            return;
        const resp = yield _this.ws.ipc.get_conf({lpm_token});
        if (!opt.retried && resp && resp.err && resp.err=='not_authorized')
        {
            const auth_res = yield _this.login();
            return auth_res && auth_res.config || {};
        }
        return resp && resp.config || {};
    }
    *update_stats(_this, opt={}){
        this.on('uncaught', e=>{
            logger.error('update_stats %s', zerr.e2s(e));
        });
        if (!_this.argv.sync_stats)
            return;
        const stats = _this.mgr.loki.stats_get();
        const lpm_token = _this.mgr._defaults.lpm_token;
        if (!_this.connected() || !lpm_token)
            return;
        const resp = yield _this.ws.ipc.update_stats({
            lpm_token,
            stats,
            uuid: perr.uuid,
        });
        if (!opt.retried && resp && resp.err && resp.err=='not_authorized')
            yield _this.login({}, ()=>_this.update_stats({retried: 1}));
    }
});

module.exports = Lpm_f;
