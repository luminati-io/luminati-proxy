// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/
const http = require('http');
const tls = require('tls');
const E = module.exports = {};
const ip_re = /^\d+\.\d+\.\d+\.\d+$/;
const ip_url_re = /^(https?:\/\/)?(\d+\.\d+\.\d+\.\d+)([$/:?])/i;

E.param_rand_range = (range=0, mult=1)=>{
    if (!Array.isArray(range))
        range = (''+range).split(':');
    range = range.map(r=>(+r||0)*mult);
    if (range.length<2)
        return range[0];
    if (range[1]<=range[0])
        return range[0];
    return E.rand_range(range[0], range[1]);
};

E.rand_range = (start=0, end=1)=>Math.round(
    start+Math.random()*(end-start));

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

E.is_ip = domain=>!!ip_re.test(domain);

E.is_ip_url = url=>!!E.parse_ip_url(url);

E.parse_ip_url = url=>{
    let match = url.match(ip_url_re);
    if (!match)
        return null;
    return {url: match[0]||'', protocol: match[1]||'', ip: match[2]||'',
        suffix: match[3]||''};
};

E.req_is_ssl = req=>req.socket instanceof tls.TLSSocket;

E.req_is_connect = req=>req.method=='CONNECT';

E.req_full_url = req=>{
    if (!E.req_is_ssl(req))
        return req.url;
    let url = req.url.replace(/^(https?:\/\/[^\/]+)?\//,
        req.headers.host+'/');
    return `https://${url}`;
};

E.gen_id = (id, ind=0, prefix='r')=>{
    if (id&&ind)
        id=id.replace(/-[0-9]*-/, `-${ind}`);
    if (!id)
        id = `${prefix}-${ind}-${E.rand_range(1, 1000000)}`;
    return id;
};

E.wrp_sp_err = (sp, fn)=>(...args)=>{
    try {
        return fn.apply(null, args);
    } catch(e){
        console.error('wrap sp err', e);
        sp.throw(e);
    }
};

E.parse_http_res = res=>{
    let parsed = {
        head: '',
        body: '',
        headers: {},
        rawHeaders: {},
        status_code: 0,
        status_message: ''
    };
    res = (res||'').split('\r\n\r\n');
    parsed.head = res[0];
    parsed.body = res[1]||'';
    res = parsed.head.split('\r\n');
    Object.assign(parsed, res.slice(1).map(h=>h.match(/(.*):(.*)/))
    .reduce((acc, curr, ind)=>{
        if (!curr)
            return acc;
        acc.headers[curr[1].toLowerCase()] = curr[2]||'';
        acc.rawHeaders[curr[1].toLowerCase()] = curr[2]||'';
        return acc;
    }, {headers: parsed.headers, rawHeaders: parsed.rawHeaders}));
    res = res[0].match(/(\d\d\d) (.*)/);
    if (res)
    {
        parsed.status_code = res[1];
        parsed.status_message = res[2]||'';
    }
    return parsed;
};
