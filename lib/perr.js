#!/usr/bin/env node
// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/
const hutil = require('hutil');
const {etask, zerr} = hutil;
const zutil = hutil.util;
const request = require('request');
const pkg = require('../package.json');
const os = require('os');
const E = module.exports = {start_time: -1};
const PERR_URL = 'https://perr.luminati.io/client_cgi/perr';

const perr_send = (id, info, opt)=>{
    const curr_time = Date.now();
    const start_time = E.start_time || Date.now();
    opt = opt || {};
    info = Object.assign({}, info, {
        c_ts: curr_time,
        c_up_ts: start_time,
        uptime: curr_time-start_time,
        c_ver: pkg.version,
        n_ver: process.version,
        electron: (process.versions||{}).electron,
        platform: os.platform(),
        platform_release: os.release(),
    });
    return etask.nfn_apply(request, [{
        url: `${PERR_URL}/?id=lpm_${id}`,
        method: 'POST', timeout: 10000,
        json: {
            timestamp: curr_time,
            info: info,
            filehead: opt.filehead,
            bt: opt.backtrace,
            c_ver: pkg.version,
        },
    }]);
};

E.perr_install = (perr_orig, pending)=>{
    while (pending.length)
        perr_send.apply(null, pending.shift());
    return (id, info, opt)=>{
        if (!zutil.is_mocha)
            perr_orig.apply(null, arguments);
        return perr_send(id, info, opt);
    };
};

E.run = ()=>{
    zerr.perr_install(E.perr_install);
    E.start_time = Date.now();
};
