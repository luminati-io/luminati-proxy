#!/usr/bin/env node
// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/
const etask = require('../util/etask.js');
const zerr = require('../util/zerr.js');
const file = require('../util/file.js');
const zutil = require('../util/util.js');
const request = require('request');
const pkg = require('../package.json');
const os = require('os');
const path = require('path');
const E = module.exports = {start_time: -1};
const uuid_v4 = require('uuid/v4');
const PERR_URL = process.env.PERR_LXC
    ? 'http://1.1.1.28:3312/client_cgi/perr'
    : (process.env.PERR_URL||'https://perr.luminati-china.io/client_cgi/perr');
const uuid_file = path.join(os.homedir(), '.luminati.uuid'.substr(
    process.platform=='win32' ? 1 : 0));

let uuid;

try {
    uuid = file.read_line_e(uuid_file).trim().substr(0, 40);
} catch(e){
    uuid = uuid_v4();
    file.write_e(uuid_file, uuid);
}

const perr_send = (id, info, opt)=>{
    if (zutil.is_mocha())
        return;
    if (id instanceof Error)
    {
        info = Object.assign({}, info, {error: id});
        id = id.code||'error';
    }
    if (info instanceof Error)
        info = {error: info};
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
    if (info.error)
    {
        opt.filehead = opt.filehead || zerr.log_tail();
        opt.backtrace = opt.backtrace || zerr.e2s(info.error);
        info.error_msg = info.error.message;
        delete info.error;
    }
    return etask.nfn_apply(request, [{
        url: `${PERR_URL}/?id=lpm_${id}`,
        method: 'POST', timeout: 10000,
        json: {
            timestamp: curr_time,
            info: info,
            filehead: opt.filehead,
            bt: opt.backtrace,
            ver: pkg.version,
            uuid: uuid,
        },
    }]);
};

E.perr_install = (perr_orig, pending)=>{
    while (pending.length)
        perr_send.apply(null, pending.shift());
    return (id, info, opt)=>{
        // XXX maximk: print perrs only on debug
        if (0&&!zutil.is_mocha())
            perr_orig.apply(null, [id, info, opt]);
        return perr_send(id, info, opt);
    };
};

E.run = opt=>{
    if (!opt.no_usage_stats)
        zerr.perr_install(E.perr_install);
    else
        zerr.perr_install(()=>()=>{});
    E.start_time = Date.now();
};
