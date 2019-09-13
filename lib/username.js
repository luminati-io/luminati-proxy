// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/
const _ = require('lodash');
const string = require('../util/string.js');
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
    dbg: 'debug',
    cy: 'country',
    st: 'state',
    ct: 'city',
    ub: 'unblocker',
    unblock: 'unblocker',
};
const fields = qw`customer zone country state city session asn dns
    cid ip raw direct debug mobile vip carrier route_err unblocker`;

// XXX krzysztof: copied from /protocol. try to import and reuse
const escape_geo = val=>
    diacritic.clean(val).toLowerCase().replace(/[^a-z0-9]/g, '');

// XXX colin/ovidiu: remove this function and us from util if possible
let short = {};
for (let key in abbr)
    short[abbr[key]] = key;

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

const calc = (opt, make_short)=>{
    // XXX krzysztof: check if anybody uses make_short
    const parts = ['lum'];
    for (let key in _.pick(opt, fields))
    {
        let val = opt[key], bool = boolean_part[key];
        if (!val || val=='*')
            continue;
        if (key=='city')
            val = escape_geo(val);
        if (make_short && short[key])
            key = short[key];
        parts.push(key);
        if (!bool)
        {
            parts.push((''+val).toLowerCase()
                .replace(/ /g, make_short ? '' : '_'));
        }
    }
    return parts.join('-');
};

// XXX krzysztof: merge with calc
const calculate_username = function(opt){
    if (opt.ext_proxy)
    {
        return Object.assign({password: opt.password},
            _.pick(opt.ext_proxy, 'username', 'password'));
    }
    let opt_usr = _.omit(opt, qw`password`);
    if (opt_usr.ip)
        opt_usr = _.omit(opt_usr, qw`session`);
    return {
        username: calc(opt_usr),
        password: opt.password,
    };
};


module.exports = {parse, calc, fields, calculate_username};
