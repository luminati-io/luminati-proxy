// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/
const http = require('http');
const tls = require('tls');
const zlib = require('zlib');
const check_invalid_header = require('_http_common')._checkInvalidHeaderChar;
const request = require('request').defaults({gzip: true});
const etask = require('../util/etask.js');
const fs = require('fs');
const is_win = process.platform=='win32';
const is_darwin = process.platform=='darwin';
const ip_re = /^\d+\.\d+\.\d+\.\d+$/;
const ip_url_re = /^(https?:\/\/)?(\d+\.\d+\.\d+\.\d+)([$/:?])/i;
let posix;
try { posix = require('posix'); } catch(e){}
const E = module.exports = {};

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

const remove_invalid_headers = headers=>{
    for (let key in headers)
    {
        if (Array.isArray(headers[key]))
        {
            headers[key] = headers[key].filter(v=>!check_invalid_header(v));
            if (!headers[key].length)
                delete headers[key];
        }
        else if (check_invalid_header(headers[key]))
            delete headers[key];
    }
};

E.write_http_reply = (_stream, res, headers={}, opt={})=>{
    headers = Object.assign(headers, res.headers||{});
    if (_stream.x_hola_context && opt.debug!='none')
        headers['x-hola-context'] = _stream.x_hola_context;
    if (_stream.cred && opt.debug!='none')
        headers['x-lpm-authorization'] = _stream.cred;
    _stream.resp_written = true;
    if (_stream instanceof http.ServerResponse)
    {
        try {
            return _stream.writeHead(res.statusCode, res.statusMessage,
                headers);
        } catch(e){
            if (e.code!='ERR_INVALID_CHAR')
                throw e;
            remove_invalid_headers(headers);
            return _stream.writeHead(res.statusCode, res.statusMessage,
                headers);
        }
    }
    let head = `HTTP/1.1 ${res.statusCode} ${res.statusMessage}\r\n`;
    for (let field in headers)
        head += `${field}: ${headers[field]}\r\n`;
    _stream.write(head+'\r\n', ()=>{
        if (opt.end)
            _stream.end();
    });
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
    const url = req.url.replace(/^(https?:\/\/[^\/]+)?\//,
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
        status_message: '',
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

E.decode_body = (body, encoding, limit)=>{
    if (!Array.isArray(body))
        return body;
    const _body = Buffer.concat(body);
    let s;
    switch (encoding)
    {
    case 'gzip':
        s = zlib.gunzipSync(_body, {finishFlush: zlib.Z_SYNC_FLUSH});
        break;
    case 'deflate': s = zlib.inflateSync(_body); break;
    default: s = _body; break;
    }
    const res = s.toString('utf8').trim();
    if (limit)
        return res.slice(0, limit);
    return res;
};

E.url2domain = url=>{
    const r = /^(?:https?:\/\/)?(?:[^@\n]+@)?(?:www\.)?([^:/\n?]+)/img;
    const res = r.exec(url);
    return res && res[1] || '';
};

E.json = etask._fn(function*util_json(_this, opt){
    try {
        if (typeof opt=='string')
            opt = {url: opt};
        opt.json = true;
        return yield etask.nfn_apply(request, [opt]);
    } catch(e){
        etask.ef(e);
        throw e;
    }
});

E.count_fd = ()=>etask(function*mgr_count_fd(){
    if (is_win || is_darwin || !posix)
        return 0;
    this.alarm(1000);
    let list;
    try {
        list = yield etask.nfn_apply(fs, '.readdir', ['/proc/self/fd']);
    } catch(e){ return 0; }
    return list.length;
});
