// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/

module.exports = username=>{
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
};
