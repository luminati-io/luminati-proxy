// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/
const string = require('../util/string.js');
const zutil = require('../util/util.js');
const lpm_config = require('../util/lpm_config.js');
const diacritic = require('diacritic');
const qw = string.qw;

const boolean_part = {
    raw: true,
    direct: true,
    unblocker: true,
};
const abbr = {
    cu: 'customer',
    z: 'zone',
    k: 'key',
    d: 'direct',
    s: 'session',
    cy: 'country',
    st: 'state',
    ct: 'city',
    ub: 'unblocker',
    unblock: 'unblocker',
};
const fields = qw`customer zone country state city session asn dns
    cid ip raw direct mobile vip carrier route_err unblocker debug os ua`;

// XXX krzysztof: copied from /protocol. try to import and reuse
const escape_geo = val=>
    diacritic.clean(val).toLowerCase().replace(/[^a-z0-9]/g, '');

const parse = header=>{
    if (!header)
        return;
    let m = header.match(/^Basic (.*)/);
    if (!m)
        return;
    header = Buffer.from(m[1], 'base64').toString('ascii');
    let cred = header.split(':');
    let auth = {};
    let parts = cred[0].split('-');
    while (parts.length)
    {
        let key = parts.shift();
        if (key=='lum')
            continue;
        if (abbr[key])
            key = abbr[key];
        auth[key] = boolean_part[key] || parts.shift();
    }
    auth.password = cred[1];
    return auth;
};

const _calc = opt=>{
    const parts = ['lum'];
    for (let key in zutil.pick(opt, ...fields))
    {
        let val = opt[key];
        if (val==='' || val=='*' || val==undefined)
            continue;
        if (key=='city')
            val = escape_geo(val);
        parts.push(key);
        if (!boolean_part[key])
            parts.push((''+val).toLowerCase().replace(/ /g, '_'));
    }
    return parts.join('-');
};

const calculate_username = function(opt){
    if (opt.ext_proxy)
    {
        return Object.assign({password: opt.password},
            zutil.pick(opt.ext_proxy, 'username', 'password'));
    }
    const opt_usr = Object.assign({}, opt);
    if (opt_usr.debug && opt_usr.debug==lpm_config.server_default.debug)
        delete opt_usr.debug;
    if (opt_usr.route_err &&
        opt_usr.route_err==lpm_config.server_default.route_err)
    {
        delete opt_usr.route_err;
    }
    if (opt_usr.ip)
        delete opt_usr.session;
    if (!opt_usr.mobile)
        delete opt_usr.mobile;
    if (opt_usr.mobile && opt_usr.os)
        opt_usr.mobile = false;
    else if (opt_usr.os)
        delete opt_usr.mobile;
    if (opt_usr.ua===true && opt_usr.unblock && opt_usr.preset=='unblocker')
        opt_usr.ua = 'mobile';
    else
        delete opt_usr.ua;
    if (!opt_usr.state_perm && opt_usr.state)
        delete opt_usr.state;
    return {
        username: _calc(opt_usr),
        password: opt.password,
    };
};


module.exports = {parse, calculate_username};
