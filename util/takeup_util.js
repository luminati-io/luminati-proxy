// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true*/
require('./config.js');
const E = exports;

// Copy from util/http_hdr.js
// original_raw should be the untransformed value of rawHeaders from the
// Node.js HTTP request or response
E.restore_case = function(headers, original_raw){
    if (!original_raw)
        return headers;
    const names = {};
    for (let i = 0; i<original_raw.length; i += 2)
    {
        const name = original_raw[i];
        names[name.toLowerCase()] = [name];
    }
    for (let orig_name in headers)
    {
        const name = orig_name.toLowerCase();
        if (names[name])
            names[name].push(orig_name);
        else
            names[name] = [orig_name];
    }
    const res = {};
    for (let name in names)
    {
        const value = names[name].map(n=>headers[n]).filter(v=>v)[0];
        if (value!==undefined)
            res[names[name][0]] = value;
    }
    return res;
};
