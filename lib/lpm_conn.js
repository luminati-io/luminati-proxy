#!/usr/bin/env node
// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true, es9: true*/
const dns = require('dns');
const https = require('https');
const os = require('os');
const zws = require('../util/ws.js');
const etask = require('../util/etask.js');
const date = require('../util/date.js');
const rand = require('../util/rand.js');
const zerr = require('../util/zerr.js');
const logger = require('./logger.js').child({category: 'MNGR: lpm_conn'});
const util_lib = require('./util.js');

const Lpm_conn = etask._class(class Lpm_conn {
    constructor(mgr){
        this.mgr = mgr;
        this.certs;
    }
    init(){
        this.ws = new zws.Client('wss://zs-lpm-conn.brightdata.com:3371', {
            label: 'lpm_conn',
            agent: new https.Agent({
                lookup: (hostname, opt, cb)=>{
                    const _opt = {family: 4, all: true, hints: opt.hints};
                    dns.lookup(hostname, _opt, (err, res)=>{
                        if (err)
                            return cb(err);
                        const {address, family=4} = rand.rand_element(res)||{};
                        if (opt.all)
                            cb(undefined, [{address, family}]);
                        else
                            cb(undefined, address, family);
                    });
                },
            }),
            ipc_client: {
                hello: 'post',
                report: 'post',
            },
            ipc_server: {
                server_certs: this.handle_server_certs.bind(this),
            },
        }).on('connected', ()=>{
            logger.notice('connected');
            this.ws.ipc.hello(`from ${os.hostname()}`);
        }).on('error', e=>{
            logger.error(zerr.e2s(e));
        }).on('disconnected', ()=>{
            logger.warn('disconnected');
        });
    }
    close(reason, code){
        this.ws?.close(code||1000, reason);
    }
    connected(){
        return this.ws?.connected;
    }
    *report(_this, stats){
        this.on('uncaught', e=>{
            logger.error('report %s', zerr.e2s(e));
            util_lib.perr('error', {error: zerr.e2s(e),
                ctx: 'lpm_conn report'});
        });
        if (!_this.connected())
            return;
        yield _this.ws.ipc.report({stats, id: os.hostname()});
    }
    handle_server_certs(data){
        logger.notice('received server certs');
        this.certs = data;
        if (!this.server_cert_et)
            return;
        this.server_cert_et.return();
        this.server_cert_et = null;
    }
    *wait_certs(_this){
        if (_this.certs || _this.server_cert_et)
                return;
        _this.server_cert_et = this;
        try {
            yield this.wait(5*date.ms.SEC);
        } catch(e){
            logger.warn('wait_certs %s', e.message||e);
        }
    }
    *bootstrap(_this){
        if (!_this.mgr.server_conf.client.lpm_conn)
            return void logger.notice('skip bootstrap');
        logger.notice('bootstrap');
        _this.init();
        _this.mgr.run_stats_reporting();
        yield _this.wait_certs();
        logger.notice('done');
    }
});

module.exports = Lpm_conn;
