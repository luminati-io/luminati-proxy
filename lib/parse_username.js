// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/
const E = module.exports = parse_username;
const boolean_keys = {
    direct: true,
    raw: true,
};

function parse_username(username){
    let auth = {};
    let parts = username.split('-');
    while (parts.length)
    {
        let key = parts.shift();
        if (key=='lum')
            continue;
        auth[key] = boolean_keys[key] || parts.shift();
    }
    return auth;
}
