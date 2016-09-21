// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/
const E = module.exports = parse_username;

function parse_username(username){
    let auth = {};
    let parts = username.split('-');
    while (parts.length)
    {
        let key = parts.shift();
        if (key=='lum')
            continue;
        auth[key] = {direct: true, raw: true}[key] || parts.shift();
    }
    return auth;
}
