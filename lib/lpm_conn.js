#!/usr/bin/env node
// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/
const dns = require('dns');
const http = require('http');
const os = require('os');
const zws = require('../util/ws.js');
const etask = require('../util/etask.js');
const rand = require('../util/rand.js');
const zerr = require('../util/zerr.js');
const logger = require('./logger.js').child({category: 'MNGR: lpm_conn'});
const util_lib = require('./util.js');

const Lpm_conn = etask._class(class Lpm_conn {
    init(){
        this.ws = new zws.Client('ws://zs-lpm-conn.luminati.io:3360', {
            label: 'lpm_conn',
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
                report: 'post',
            },
        }).on('connected', ()=>{
            logger.notice('Connection established');
            this.ws.ipc.hello(`from ${os.hostname()}`);
        }).on('error', e=>{
            logger.error(zerr.e2s(e));
        }).on('disconnected', ()=>{
            logger.warn('Connnection failed');
        });
    }
    close(reason, code){
        if (this.ws)
            this.ws.close(code||1000, reason);
    }
    connected(){
        return this.ws && this.ws.connected;
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
});

module.exports = Lpm_conn;
