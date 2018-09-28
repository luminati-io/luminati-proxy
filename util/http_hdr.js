// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true*/
require('./config.js');
const HTTPParser = process.binding('http_parser').HTTPParser;
const E = exports;

E.capitalize = function(headers){
    let res = {};
    for (let header in headers)
    {
        let new_header = header.split('-').map(word=>{
            return word.length ? word[0].toUpperCase()+word.substr(1) : '';
        }).join('-');
        res[new_header] = headers[header];
    }
    return res;
};

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

let parser = new HTTPParser(HTTPParser.REQUEST);
E.parse_request = buffer=>{
    let ret;
    parser[HTTPParser.kOnHeadersComplete] =
        (version_major, version_minor, raw_headers, method, url, status_code,
        status_message, upgrade, should_keep_alive)=>
        ret = {version_major, version_minor, raw_headers, method, url,
            upgrade, should_keep_alive};
    parser.reinitialize(HTTPParser.REQUEST);
    let exec_res = parser.execute(buffer);
    if (exec_res instanceof Error)
        throw exec_res;
    if (!ret)
        return;
    // ugly, not 100% accurate, but fast!
    ret.headers = {};
    for (let i=0; i<ret.raw_headers.length; i+=2)
        ret.headers[ret.raw_headers[i].toLowerCase()] = ret.raw_headers[i+1];
    return ret;
};
