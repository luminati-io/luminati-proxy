// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true*/
require('./config.js');
const string = require('./string.js');
const {qw} = string;
const HTTPParser = process.binding('http_parser').HTTPParser;
const E = exports;

const special_case_words = {
    te: 'TE',
    etag: 'ETag',
};

E.capitalize = function(headers){
    let res = {};
    for (let header in headers)
    {
        let new_header = header.toLowerCase().split('-').map(word=>{
            return special_case_words[word] ||
                (word.length ? word[0].toUpperCase()+word.substr(1) : '');
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

// default chrome headers
// XXX andreish: support other browsers
// XXX josh: upgrade-insecure-requests might not be needed on 2nd request
// onwards
E.browser_defaults = ()=>({
    connection: 'keep-alive',
    accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3',
    'upgrade-insecure-requests': '1',
    'accept-encoding': 'gzip, deflate, br',
    'accept-language': 'en-US,en;q=0.9',
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/74.0.3729.131 Safari/537.36',
});

E.like_browser_case_and_order = function(headers){
    let ordered_headers = {};
    const header_keys = qw`host connection cache-control
        upgrade-insecure-requests user-agent accept accept-encoding
        accept-language cookie`;
    for (let header of header_keys)
    {
        let value = headers[header];
        if (value)
            ordered_headers[header] = value;
    }
    for (let header in headers)
    {
        if (!header_keys.includes(header))
            ordered_headers[header] = headers[header];
    }
    return E.capitalize(ordered_headers);
};

// XXX josh/andreish: these are correct for chrome, need to set header order
// per-browser for firefox/safari/edge
// XXX josh: cache-control header might not be in the right order
E.browser_default_headers_http2 = qw`:method :authority :scheme :path
    upgrade-insecure-requests user-agent accept referer
    accept-encoding accept-language cookie cache-control`;

E.like_browser_case_and_order_http2 = function(headers){
    let ordered_headers = {};
    const header_keys = E.browser_default_headers_http2;
    let req_headers = {};
    for (let h in headers)
        req_headers[h.toLowerCase()] = headers[h];
    for (let h of header_keys)
    {
        if (req_headers[h])
            ordered_headers[h] = req_headers[h];
    }
    for (let h in req_headers)
    {
        if (!header_keys.includes(h))
           ordered_headers[h] = req_headers[h];
    }
    return ordered_headers;
};

let parser = new HTTPParser(HTTPParser.REQUEST), parser_usages = 0;
E.parse_request = buffer=>{
    let ret;
    parser[HTTPParser.kOnHeadersComplete] =
        (version_major, version_minor, raw_headers, method, url, status_code,
        status_message, upgrade, should_keep_alive)=>
        ret = {version_major, version_minor, raw_headers, method, url,
            upgrade, should_keep_alive};
    parser.reinitialize(HTTPParser.REQUEST, !!parser_usages);
    parser_usages++;
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
