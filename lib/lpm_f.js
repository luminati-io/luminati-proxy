#!/usr/bin/env node
// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/
const events = require('events');
const cli_progress = require('cli-progress');
const etask = require('../util/etask.js');
const zws = require('../util/ws.js');
const date = require('../util/date.js');
const zerr = require('../util/zerr.js');
const logger = require('./logger.js').child({category: 'MNGR: lpm_f'});
const util_lib = require('./util.js');

const domains = [
    'lum-superproxy.io',
    'luminati.io',
];
let curr_idx = 0;
const get_next_domain = ()=>
    domains[Math.floor(curr_idx++/2)%2%domains.length];
const get_ws_url = domain=>'wss://lpm_f.zproxy.'+domain+':443';

const Lpm_f = etask._class(class Lpm_f extends events.EventEmitter {
    constructor(mgr){
        super();
        this.mgr = mgr;
        this.argv = mgr.argv;
        this.ever_connected = false;
        this.lost_config = false;
    }
    *init(_this){
        const ua = _this.argv.zagent ? 'Hola cloud_pmgr' : 'Hola premise_pmgr';
        const url = get_ws_url(get_next_domain());
        const SEC_30 = 30*date.ms.SEC;
        _this.ws = new zws.Client(url, {
            mux: {use_ack: true},
            user_agent: ua,
            label: 'lpm_f',
            ipc_client: {
                hello: 'post',
                reset_auth: 'post',
                auth: {type: 'call', timeout: SEC_30},
                update_conf: {type: 'call', timeout: SEC_30},
                get_conf: {type: 'call', timeout: SEC_30},
                get_meta_conf: {type: 'call', timeout: SEC_30},
                get_server_conf: {type: 'call', timeout: SEC_30},
                send_stat: {type: 'call', timeout: SEC_30},
                resolve_proxies: {type: 'call', timeout: SEC_30},
                get_shared_block_cn: {type: 'call', timeout: SEC_30},
                get_vipdb_version: {type: 'call', timeout: SEC_30},
                get_vipdb: {type: 'mux', timeout: SEC_30},
                get_carriers_version: {type: 'call', timeout: SEC_30},
                get_carriers_asns: {type: 'call', timeout: SEC_30},
                get_alloc_ips: {type: 'call', timeout: SEC_30},
                request_token: {type: 'call', timeout: SEC_30},
                proxy_update_in_place: {type: 'call', timeout: SEC_30},
                get_language_resources: {type: 'call', timeout: SEC_30},
                get_cloud_zagents: {type: 'call', timeout: SEC_30},
                get_ca: {type: 'call', timeout: SEC_30},
                save_ca: {type: 'call', timeout: SEC_30},
            },
        })
        .on('connected', ()=>_this.on_connected(this))
        .on('disconnected', _this.on_disconnected.bind(_this))
        .on('json', _this.on_json.bind(_this));
        yield this.wait();
        _this.ever_connected = true;
    }
    *on_connected(_this, et){
        this.on('uncaught', e=>{
            logger.error('on_connected: %s', zerr.e2s(e));
            et.throw(e);
        });
        logger.notice('Connection established');
        yield _this.ws.ipc.hello();
        let lpm_token = _this.mgr._defaults.lpm_token;
        if (_this.ever_connected || !lpm_token)
        {
            let auth_conf = yield _this.login();
            if (_this.lost_config)
            {
                let conf = yield _this.get_conf();
                yield _this.mgr.apply_cloud_config(conf, {no_proxy_delete: 1});
                _this.lost_config = false;
                _this.mgr.restart();
            }
            else if (auth_conf)
                yield _this.mgr.apply_cloud_config(auth_conf);
        }
        et.continue();
    }
    *on_json(_this, data){
        this.on('uncaught', e=>logger.error('json %s', zerr.e2s(e)));
        if (!data || !data.msg)
            return;
        if (data.msg=='new_conf')
        {
            yield _this.mgr.apply_cloud_config(data.new_conf,
                {ca: data.new_ca});
        }
        else if (data.msg=='proxy_update_in_place' &&
            _this.mgr._defaults.sync_config)
        {
            logger.notice('received proxy update %s', data.port);
            _this.mgr.proxy_update_in_place(data.port, data.conf, {origin: 0});
        }
        else if (data.msg=='zones')
            _this.mgr.apply_zones_config(data.zones);
        else if (data.msg=='bw_limits')
            _this.mgr.apply_bw_limits(data.limits);
        else if (data.msg=='server_conf' && data.server_conf)
            _this.emit('server_conf', data.server_conf);
        else if (data.msg=='ip_alloc')
            _this.emit('ip_alloc', data);
        else if (data.msg=='i18n')
            _this.emit('i18n_update_available');
    }
    on_disconnected(){
        const next_domain = get_next_domain();
        logger.warn('Connection failed... trying %s', next_domain);
        this.ws.url = get_ws_url(next_domain);
        util_lib.perr('error', {ctx: 'lpm_f disconnected'});
    }
    close(){
        if (this.ws)
            this.ws.close();
    }
    connected(){
        return this.ws && this.ws.connected;
    }
    *login(_this){
        this.on('uncaught', e=>{
            logger.error('login %s', zerr.e2s(e));
            util_lib.perr('error', {error: zerr.e2s(e), ctx: 'lpm_f login'});
        });
        let lpm_token = _this.mgr._defaults.lpm_token;
        if (!_this.connected())
            return;
        if (!lpm_token && _this.argv.zagent)
        {
            let {token, cname, err} = yield _this.request_token();
            if (token && cname && !err)
            {
                lpm_token = `${token}|${cname}`;
                _this.mgr._defaults.lpm_token = lpm_token;
                _this.lost_config = true;
            }
        }
        if (!lpm_token)
            return;
        const auth_res = yield _this.ws.ipc.auth({lpm_token});
        if (auth_res.err)
        {
            logger.warn('Authentication failed: '+auth_res.err);
            return false;
        }
        logger.notice('Authentication success');
        yield _this.mgr.remove_tmp_ca();
        return auth_res.config;
    }
    *logout(_this){
        this.on('uncaught', e=>logger.error('logout %s', zerr.e2s(e)));
        if (!_this.connected())
            return;
        yield _this.ws.ipc.reset_auth();
    }
    *update_conf(_this, config, opt={}){
        this.on('uncaught', e=>logger.warn('update_conf %s', e.message));
        const lpm_token = _this.mgr._defaults.lpm_token;
        if (!_this.connected() || !lpm_token)
            return;
        const changes = _this.mgr.config_changes;
        _this.mgr.config_changes = [];
        const resp = yield _this.ws.ipc.update_conf({
            lpm_token,
            user: _this.mgr.get_username(),
            config,
            changes,
            skip_broadcast: !!opt.skip_broadcast,
        });
        if (resp && resp.err)
            throw new Error(resp.err);
    }
    *get_conf(_this, opt={}){
        this.on('uncaught', e=>logger.error('get_conf %s', zerr.e2s(e)));
        const lpm_token = _this.mgr._defaults.lpm_token;
        if (!_this.connected() || !lpm_token)
            return;
        const resp = yield _this.ws.ipc.get_conf({lpm_token});
        if (!opt.retried && resp && resp.err=='not_authorized')
        {
            const auth_conf = yield _this.login();
            return auth_conf||{};
        }
        return resp && resp.config || {};
    }
    *get_meta_conf(_this){
        if (!_this.connected())
            throw new Error('no_lpm_f_conn');
        const opt = {zagent: _this.argv.zagent};
        const resp = yield _this.ws.ipc.get_meta_conf(opt);
        if (!resp || !resp.config)
            throw new Error(resp && resp.err || 'unknown err from lpm_f');
        return resp.config;
    }
    *get_server_conf(_this){
        if (!_this.connected())
            throw new Error('no_lpm_f_conn');
        const resp = yield _this.ws.ipc.get_server_conf();
        if (!resp || !resp.server_conf)
            throw new Error(resp && resp.err || 'unknown err from lpm_f');
        _this.emit('server_conf', resp.server_conf);
    }
    *handler(_this, method, ...args){
        if (!_this.connected())
            throw new Error('no_lpm_f_conn');
        const resp = yield _this.ws.ipc[method](...args);
        if (resp && resp.err && resp.err == 'not_authorized')
        {
            yield _this.login();
            return yield _this.handler_retry(method, ...args);
        }
        if (resp && resp.err)
            throw new Error(resp.err);
        return resp;
    }
    *handler_retry(_this, method, ...args){
        const resp = yield _this.ws.ipc[method](...args);
        if (resp && resp.err)
            throw new Error(resp.err);
        return resp;
    }
    get_shared_block_cn(){
        return this.handler('get_shared_block_cn');
    }
    get_vipdb_version(){
        return this.handler('get_vipdb_version');
    }
    get_language_resources(){
        return this.handler('get_language_resources');
    }
    get_carriers_version(){
        return this.handler('get_carriers_version');
    }
    get_carriers_asns(){
        return this.handler('get_carriers_asns');
    }
    get_alloc_ips(zone){
        return this.handler('get_alloc_ips', zone);
    }
    proxy_update_in_place(port, conf){
        return this.handler('proxy_update_in_place', port, conf);
    }
    *get_vipdb(_this){
        this.on('uncaught', e=>{
            logger.error('get_vipdb %s', e.message);
            this.return('');
        });
        if (!_this.connected())
            throw new Error('no_lpm_f_conn');
        const stream = yield _this.ws.ipc.get_vipdb();
        const data = yield stream2data(stream);
        return data.toString();
    }
    request_token(){
        return this.handler('request_token');
    }
    *get_ca(_this){
        try {
            return yield _this.handler('get_ca');
        } catch(e){
            return {err: e.message};
        }
    }
    *save_ca(_this, ca, keep_existed=false){
        try {
            let payload = {
                key: ca.key.toString(),
                cert: ca.cert.toString(),
            };
            return yield _this.handler('save_ca', payload, keep_existed);
        } catch(e){
            return {err: e.message};
        }
    }
    get_cloud_zagents(){
        return this.handler('get_cloud_zagents');
    }
    *send_stat(_this, data){
        if (!_this.connected())
            throw new Error('no_lpm_f_conn');
        const resp = yield _this.ws.ipc.send_stat({data});
        if (resp && resp.err)
            throw new Error(resp.err);
        return resp;
    }
    *resolve_proxies(_this, opt={}){
        this.on('uncaught', e=>{
            logger.error('resolve_proxies %s', zerr.e2s(e));
            this.return([]);
        });
        const resp = yield _this.ws.ipc.resolve_proxies({
            limit: 20,
            cn: !!opt.cn,
        });
        if (!resp || !resp.proxies)
            throw new Error(resp && resp.err || 'unknown err from lpm_f');
        return resp.proxies;
    }
});

const stream2data = (stream, opt)=>etask(function*(){
    opt = Object.assign({}, opt);
    this.alarm(opt.timeout||5*date.ms.MIN,
        {throw: new Error('stream2data timeout')});
    const bar = new cli_progress.SingleBar({},
        cli_progress.Presets.shades_classic);
    let current_size = 0;
    const total_size = 7000000;
    bar.start(total_size, 0);
    let chunks = [];
    stream.on('data', chunk=>{
        current_size += chunk.length;
        bar.update(Math.min(current_size, total_size));
        chunks.push(chunk);
    });
    stream.on('error', this.throw_fn());
    stream.on('end', this.continue_fn());
    yield this.wait();
    stream.end();
    bar.update(total_size);
    bar.stop();
    return Buffer.concat(chunks);
});

module.exports = Lpm_f;
