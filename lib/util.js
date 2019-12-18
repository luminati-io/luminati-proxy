// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/
const http = require('http');
const tls = require('tls');
const zlib = require('zlib');
const os = require('os');
const ps_list = require('ps-list');
const check_invalid_header = require('_http_common')._checkInvalidHeaderChar;
const request = require('request').defaults({gzip: true});
const date = require('../util/date.js');
const etask = require('../util/etask.js');
const logger = require('../lib/logger.js');
const pkg = require('../package.json');
const fs = require('fs');
const semver = require('semver');
const is_win = process.platform=='win32';
const is_darwin = process.platform=='darwin';
const ip_re = /^\d+\.\d+\.\d+\.\d+$/;
const ip_url_re = /^(https?:\/\/)?(\d+\.\d+\.\d+\.\d+)([$/:?])/i;
let posix;
try { posix = require('posix'); } catch(e){}
const E = module.exports = {};
E.user_agent = 'luminati-proxy-manager/'+pkg.version;

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

E.write_http_reply = (client_res, proxy_res, headers={}, opt={})=>{
    headers = Object.assign(headers, proxy_res.headers||{});
    if (client_res.x_hola_context)
        headers['x-hola-context'] = client_res.x_hola_context;
    if (client_res.cred)
        headers['x-lpm-authorization'] = client_res.cred;
    client_res.resp_written = true;
    if (client_res instanceof http.ServerResponse)
    {
        try {
            client_res.writeHead(proxy_res.statusCode,
                proxy_res.statusMessage, headers);
        } catch(e){
            if (e.code!='ERR_INVALID_CHAR')
                throw e;
            remove_invalid_headers(headers);
            client_res.writeHead(proxy_res.statusCode,
                proxy_res.statusMessage, headers);
        }
        if (opt.end)
            client_res.end();
        return;
    }
    let head = `HTTP/1.1 ${proxy_res.statusCode} ${proxy_res.statusMessage}`
        +`\r\n`;
    for (let field in headers)
        head += `${field}: ${headers[field]}\r\n`;
    try {
        client_res.write(head+'\r\n', ()=>{
            if (opt.end)
                client_res.end();
        });
    } catch(e){
        e.message = (e.message||'')+`\n${head}`;
        throw e;
    }
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
    const url = req.url.replace(/^(https?:\/\/[^/]+)?\//,
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
    case 'deflate':
        try {
            s = zlib.inflateSync(_body);
        } catch(e){
            logger.warn(`failed decoding deflate body: ${e.message}`);
            s = _body;
        }
        break;
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
        if (opt.url.includes(pkg.api_domain))
        {
            opt.headers = Object.assign({'user-agent': E.user_agent},
                opt.headers||{});
        }
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

// when using this function, make sure to call E.clear_timeouts to avoid leaks
E.ensure_socket_close = socket=>{
    if (socket instanceof http.ClientRequest ||
        socket instanceof http.ServerResponse)
    {
        socket = socket.socket;
    }
    if (!socket || socket.destroyed)
        return;
    socket.end();
    E.set_timeout(()=>{
        if (!socket.destroyed)
            socket.destroy();
    }, 10*date.ms.SEC);
};

E.is_ws_upgrade_req = req=>{
    const headers = req && req.headers || {};
    const upgrade_h = Object.keys(headers).find(h=>h.toLowerCase()=='upgrade');
    return req.method=='GET' && upgrade_h && headers[upgrade_h]=='websocket';
};

E.find_iface = iface=>{
    const is_ip = /^\d{1,3}(?:\.\d{1,3}){3}$/.test(iface);
    let ifaces;
    try {
        ifaces = os.networkInterfaces();
    } catch(e){
        return false;
    }
    for (let name in ifaces)
    {
        if (name!=iface && (!is_ip || !ifaces[name].some(d=>d.address==iface)))
            continue;
        let addresses = ifaces[name].filter(data=>data.family=='IPv4');
        if (addresses.length)
            return addresses[0].address;
    }
    return false;
};

let timeouts = [];
E.set_timeout = (cb, delay)=>{
    const timeout = setTimeout(()=>{
        timeouts = timeouts.filter(t=>t!=timeout);
        cb();
    }, delay);
    timeouts.push(timeout);
};

E.set_interval = (cb, delay)=>{
    const interval = setInterval(()=>{
        timeouts = timeouts.filter(t=>t!=interval);
        cb();
    }, delay);
    timeouts.push(interval);
};

E.clear_timeouts = ()=>{
    timeouts.forEach(clearTimeout);
    timeouts = [];
};

E.get_lpm_tasks = (opt={})=>etask(function*(){
    const regex = opt.all_processes ? /.*(lum_local|luminati-proxy).*/ :
        /.*lum_node\.js.*/;
    const tasks = yield ps_list();
    const compare_pid = t=>{
        if (opt.current_pid)
            return t.ppid==process.pid || t.pid==process.pid;
        return t.ppid!=process.pid && t.pid!=process.pid;
    };
    return tasks.filter(t=>t.name.includes('node') && regex.test(t.cmd) &&
        compare_pid(t));
});

E.fetch = endpoint=>etask(function*(){
    let res;
    try {
        const headers = {'user-agent': E.user_agent};
        res = yield E.json(endpoint, {headers, timeout: 20*date.ms.SEC});
    } catch(e){
        res = {};
    }
    return res;
});

E.get_last_version = api=>etask(function*(){
    const api_opt = {
        url: `${api}/lpm_config.json`,
        qs: {md5: pkg.lpm.md5, ver: pkg.version},
    };
    const github_url = 'https://raw.githubusercontent.com/luminati-io/'
    +'luminati-proxy/master/versions.json';
    const gh_opt = {url: github_url};
    const [r, versions] = yield etask.all([E.json(api_opt), E.json(gh_opt)]);
    const newer = r.body.ver && semver.lt(pkg.version, r.body.ver);
    return Object.assign({newer, versions: versions.body}, r.body);
});

E.get_status_tasks_msg = tasks=>{
    let msg = '';
    const fmt_num = n=>
        (+n).toLocaleString('en-GB', {maximumFractionDigits: 2});
    const total_mem_mb = os.totalmem() / 1000000;
    const get_task_str = (prefix, t)=>`${prefix} = CPU: ${fmt_num(t.cpu)}%, `
    +`Memory used: ${fmt_num(t.memory/100*total_mem_mb)}MB`;
    const manager = tasks.find(t=>t.cmd.includes('lum_node.js'));
    const workers = tasks.filter(t=>t.cmd.includes('worker.js'));
    msg += `PID: ${manager.pid}\n`;
    msg += `${get_task_str('Manager (lum_node.js)', manager)}`;
    workers.forEach((w, i)=>
        msg += `\n${get_task_str(`Worker ${i} (worker.js)`, w)}`);
    return msg;
};

E.get_host_port = ctx=>`${ctx.host}:${ctx.proxy_port}`;

E.format_platform = platform=>{
    return {win32: 'windows', darwin: 'mac'}[platform] || platform;
};
