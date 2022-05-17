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
    render: true,
    unblocker: true,
    info: true,
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
    cid ip raw direct mobile vip carrier route_err unblocker debug os ua
    info const render`;

// XXX krzysztof: copied from /protocol. try to import and reuse
const escape_geo = val=>
    diacritic.clean(val).toLowerCase().replace(/[^a-z0-9]/g, '');

const fix_parts = parts=>{
    let last_ok = 0, search = false, res = [];
    const known_fields = ['lpm_user'].concat(fields);
    for (let i = 0; i < parts.length; i++)
    {
        if (known_fields.includes(parts[i]))
        {
            if (search)
            {
                let val = parts.slice(last_ok + 2, i).join('-');
                res[res.length-1] = `${res[res.length-1]}-${val}`;
            }
            res.push(parts[i]);
            last_ok = i;
            search = false;
            if (boolean_part[parts[i]])
                continue;
            res.push(parts[i+1]);
            i++;
            continue;
        }
        search = true;
    }
    return res;
};

const parse = header=>{
    if (!header)
        return;
    const m = header.match(/^Basic (.*)/);
    if (!m)
        return;
    header = Buffer.from(m[1], 'base64').toString('ascii');
    const cred = header.split(':');
    const auth = parse_opt(cred[0]);
    auth.password = cred[1];
    return auth;
};

const parse_opt = username=>{
    const obj = {};
    if (!username)
        return obj;
    let parts = username.split('-');
    if (parts[0] == 'lpm_user')
        parts = fix_parts(parts);
    while (parts.length)
    {
        let key = parts.shift();
        if (key=='lum')
            continue;
        if (abbr[key])
            key = abbr[key];
        obj[key] = boolean_part[key] || parts.shift();
    }
    return obj;
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
        if (!boolean_part[key] || val)
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
    const opt_usr = opt;
    const plan = opt.zones && opt.zone && opt.zones[opt.zone] &&
        opt.zones[opt.zone].plan;
    const is_render_plan = opt.unblocker || plan && (plan.type=='unblocker' ||
        !!plan.unblocker || !!plan.serp);
    if (opt_usr.const!==undefined &&
        opt_usr.const==lpm_config.server_default.const)
    {
        delete opt_usr.const;
    }
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
    if (opt_usr.ua===true && opt_usr.unblock)
        opt_usr.ua = 'mobile';
    else
        delete opt_usr.ua;
    if (!opt_usr.state_perm && opt_usr.state)
        delete opt_usr.state;
    if (!opt_usr.info)
        delete opt_usr.info;
    if (!is_render_plan || !opt_usr.render)
        delete opt_usr.render;
    return {
        username: _calc(opt_usr),
        password: opt.password,
    };
};

module.exports = {parse_opt, parse, calculate_username};
