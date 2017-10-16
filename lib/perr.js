#!/usr/bin/env node
// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/
const hutil = require('hutil');
const {etask, zerr} = hutil;
const zutil = hutil.util;
const request = require('request');
const E = {};
const PERR_URL = 'https://perr.luminati.io/client_cgi/perr';
const perr_send = (id, info, opt)=>{
    opt = opt || {};
    return etask(request({url: PERR_URL+'/perr/?id=lpm_'+id,
        method: 'POST', timeout: 10000,
        json: {
            timestamp: Date.now(),
            info: info,
            filehead: opt.filehead,
            bt: opt.backtrace,
            c_ver: opt.client_version,
        }
    }));
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
};
