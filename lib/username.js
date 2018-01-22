// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/
const _ = require('lodash');
const {string} = require('hutil');
const qw = string.qw;

const boolean_part = {
    raw: true,
    direct: true,
};
const abbr = {
    cu: 'customer',
    z: 'zone',
    k: 'key',
    d: 'direct',
    s: 'session',
    to: 'timeout',
    dbg: 'debug',
    cy: 'country',
    st: 'state',
    ct: 'city',
};
const fields = qw`customer zone country state city session asn dns
    cid ip raw direct debug mobile vip carrier timeout`;

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
    header = new Buffer(m[1], 'base64').toString('ascii');
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
    const parts = ['lum'];
    for (let key in _.pick(opt, fields))
    {
        let val = opt[key], bool = boolean_part[key];
        if (!val || val=='*')
            continue;
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

module.exports = {parse, calc, fields};
