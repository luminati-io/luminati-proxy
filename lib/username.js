// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/

const boolean_part = {
    raw: true,
    direct: true,
};

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
        auth[key] = boolean_part[key] || parts.shift();
    }
    auth.password = cred[1];
    return auth;
};

const calc = opt=>{
    const parts = ['lum'];
    for(let key in opt) {
        if (!opt[key])
            continue;
        parts.push(key);
        if (!boolean_part[key])
            parts.push(opt[key]);
    }
    return parts.join('-');
};

module.exports = {parse, calc};
