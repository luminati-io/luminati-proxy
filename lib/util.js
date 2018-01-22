// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/
const http = require('http');
const E = module.exports = {};

E.param_rand_range = (range=0, mult=1)=>{
    if (!Array.isArray(range))
        range = (''+range).split(':');
    range = range.map(r=>(+r||0)*mult);
    console.log(range);
    if (range.length<2)
        return range[0];
    if (range[1]<=range[0])
        return range[0];
    return Math.floor(Math.random()*(range[1]-range[0])+range[0]);
};


E.write_http_reply = (_stream, res, headers)=>{
    headers = Object.assign(headers||{}, res.headers||{});
    if (_stream.x_hola_context)
        headers['x-hola-context'] = _stream.x_hola_context;
    if (_stream.cred)
        headers['x-lpm-authorization'] = _stream.cred;
    _stream.resp_written = true;
    if (_stream instanceof http.ServerResponse)
        return _stream.writeHead(res.statusCode, res.statusMessage, headers);
    let head = `HTTP/1.1 ${res.statusCode} ${res.statusMessage}\r\n`;
    for (let field in headers)
        head += `${field}: ${headers[field]}\r\n`;
    _stream.write(head+'\r\n');
};
