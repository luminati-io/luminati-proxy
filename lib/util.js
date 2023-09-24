// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/
const http = require('http');
const tls = require('tls');
const zlib = require('zlib');
const os = require('os');
const stream = require('stream');
const fs = require('fs');
const {exec} = require('child_process');
const check_invalid_header = require('_http_common')._checkInvalidHeaderChar;
const request = require('request').defaults({gzip: true});
const semver = require('semver');
const ps_list = require('ps-list');
const date = require('../util/date.js');
const file = require('../util/file.js');
const etask = require('../util/etask.js');
const zerr = require('../util/zerr.js');
const zutil = require('../util/util.js');
const lpm_config = require('../util/lpm_config.js');
const pkg = require('../package.json');
const swagger = require('./swagger.json');
const {SSL_OP_NO_TLSv1_1} = require('./consts.js');
const is_win = process.platform=='win32';
const is_darwin = process.platform=='darwin';
const ip_re = /^\d+\.\d+\.\d+\.\d+$/;
const eip_re = /^\w[0-9a-f]{32}$/i;
const ip_url_re = /^(https?:\/\/)?(\d+\.\d+\.\d+\.\d+)([$/:?])/i;
const E = module.exports = {};
const {assign, keys} = Object;
E.user_agent = 'luminati-proxy-manager/'+pkg.version;

E.noop = ()=>{};

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

E.sni_callback_fn = certs=>{
    let secure_ctx = {};
    for (let domain in certs)
    {
        let keypair = {
            key: file.read_e(certs[domain]+'.key', null),
            cert: file.read_e(certs[domain]+'.crt', null),
            secureOptions: SSL_OP_NO_TLSv1_1,
        };
        secure_ctx[domain] = tls.createSecureContext(keypair).context;
    }
    return (servername, cb)=>{
        let ctx = secure_ctx[servername]||
            secure_ctx[servername.split('.').slice(1).join('.')];
        cb(null, ctx);
    };
};

E.write_http_reply = (client_res, proxy_res, headers={}, opt={}, end=false)=>{
    headers = assign(headers, proxy_res.headers||{});
    const hide_sensitive_info = opt.zagent && opt.reseller &&
        !['ip', 'token', 'lpm_token'].includes(client_res.lpm_auth_type);
    if (client_res.x_hola_context)
        headers['x-hola-context'] = client_res.x_hola_context;
    if (opt.debug=='full')
    {
        if (client_res.port)
            headers['x-lpm-port'] = client_res.port;
    }
    if (opt.debug=='none' || hide_sensitive_info)
    {
        for (let k in headers)
        {
            if (['x-luminati', 'x-hola', 'x-lpm'].some(h=>k.includes(h)))
                delete headers[k];
        }
        delete headers['x-debug-bw-up'];
        delete headers['x-debug-bw-dn'];
    }
    if (opt.lpm_auth=='full' && client_res.cred && !hide_sensitive_info)
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
        if (end)
            client_res.end();
        return;
    }
    if (client_res.writableEnded)
        return;
    let head = `HTTP/1.1 ${proxy_res.statusCode} ${proxy_res.statusMessage}`
        +`\r\n`;
    for (let field in headers)
        head += `${field}: ${headers[field]}\r\n`;
    try {
        client_res.write(head+'\r\n', ()=>{
            if (end)
                client_res.end();
        });
    } catch(e){
        e.message = (e.message||'')+`\n${head}`;
        throw e;
    }
};

E.is_ip = domain=>!!ip_re.test(domain);

E.is_eip = ip=>!!eip_re.test(ip);

E.is_ip_url = url=>!!E.parse_ip_url(url);

E.parse_ip_url = url=>{
    let match = url.match(ip_url_re);
    if (!match)
        return null;
    return {url: match[0]||'', protocol: match[1]||'', ip: match[2]||'',
        suffix: match[3]||''};
};

E.is_any_ip = ip=>ip=='any'||ip=='0.0.0.0/0';

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
    assign(parsed, res.slice(1).map(h=>h.match(/(.*):(.*)/))
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

E.decode_body = (body, encoding, limit, body_size)=>{
    if (limit==-1 || body=='')
        return '';
    if (!Array.isArray(body))
        return body;
    const _body = Buffer.concat(body);
    let s;
    try {
        switch (encoding)
        {
        case 'gzip':
            s = zlib.gunzipSync(_body, {finishFlush: zlib.Z_SYNC_FLUSH});
            break;
        case 'br':
            if (body_size && limit && body_size>limit)
                return '';
            s = zlib.brotliDecompressSync(_body);
            break;
        case 'deflate':
            try {
                s = zlib.inflateSync(_body);
            } catch(e){
                s = zlib.inflateRawSync(_body);
            }
            break;
        default: s = _body; break;
        }
    } catch(e){
        throw new Error(`decoding body failed with encoding ${encoding}: `
            +e.message);
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
            opt.headers = assign({'user-agent': E.user_agent},
                opt.headers||{});
        }
        return yield etask.nfn_apply(request, [opt]);
    } catch(e){
        etask.ef(e);
        throw e;
    }
});

E.count_fd = ()=>etask(function*mgr_count_fd(){
    if (is_win || is_darwin)
        return 0;
    this.alarm(1000);
    let list;
    try {
        list = yield etask.nfn_apply(fs, '.readdir', ['/proc/self/fd']);
    } catch(e){ return 0; }
    return list.length;
});

E.count_tcp = (key='ESTABLISHED', port='22225')=>etask(function*_count_tcp(){
    if (is_win || is_darwin)
        return 0;
    this.alarm(1000);
    const cmd = `netstat -tnp | grep ":${port}" | grep ${key} | wc -l`;
    exec(cmd, (err, stdout, stderr)=>{
        if (err)
            return this.throw(err);
        try {
            this.continue(Number(stdout));
        } catch(e){
            this.throw(err);
        }
    });
    return yield this.wait();
});

E.ensure_socket_close = (sock, close, e)=>{
    if (sock instanceof http.ClientRequest ||
        sock instanceof http.ServerResponse)
    {
        sock = sock.socket;
    }
    // copy from util/net.js
    if (sock.writable || close)
        sock.end();
    const destroy = ()=>{
        if (!sock.destroyed && typeof sock.destroy == 'function')
            sock.destroy(e);
    };
    if (sock._writableState&&sock._writableState.finished)
        destroy();
    else if (!sock.destroyed_soon)
        setTimeout(destroy, 10*date.ms.SEC);
    sock.destroyed_soon = (sock.destroyed_soon|0)+1;
};

E.ensure_socket_emit_close = sock=>{
    sock.emitClose = true;
    if (sock._writableState)
        sock._writableState.emitClose = true;
    if (sock._readableState)
        sock._readableState.emitClose = true;
};

E.is_ws_upgrade_req = req=>{
    const headers = req && req.headers || {};
    const upgrade_h = keys(headers).find(h=>h.toLowerCase()=='upgrade');
    return req.method=='GET' && upgrade_h && headers[upgrade_h]=='websocket';
};

E.find_iface = iface=>{
    const is_ip = /^\d{1,3}(?:\.\d{1,3}){3}$/.test(iface);
    if (is_ip)
        return iface;
    let ifaces;
    try {
        ifaces = os.networkInterfaces();
    } catch(e){
        return false;
    }
    for (let name in ifaces)
    {
        if (name!=iface)
            continue;
        let addresses = ifaces[name].filter(data=>data.family=='IPv4');
        if (addresses.length)
            return addresses[0].address;
    }
    return false;
};

E.get_lpm_tasks = (opt={})=>etask(function*(){
    const regex = opt.all_processes
        ? /.*(lpm|luminati-proxy|pmgr|proxy-manager).*/
        : /.*lum_node\.js.*/;
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

E.get_last_version = api_domain=>etask(function*(){
    const api_opt = {
        url: `https://${api_domain}/lpm/server_conf`,
        qs: {md5: pkg.lpm.md5, ver: pkg.version},
    };
    const github_url = 'https://raw.githubusercontent.com/'
    +lpm_config.github_repo+'/master/versions.json';
    const gh_opt = {url: github_url};
    const [r, versions] = yield etask.all([E.json(api_opt), E.json(gh_opt)]);
    const newer = r.body.ver && semver.lt(pkg.version, r.body.ver);
    return assign({newer, versions: versions.body}, r.body);
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
        msg += '\n'+get_task_str(`Worker ${i} (worker.js)`, w));
    return msg;
};

E.get_host_port = ctx=>`${ctx.host}:${ctx.proxy_port}`;

E.format_platform = platform=>{
    return {win32: 'windows', darwin: 'mac'}[platform] || platform;
};

E.perr = function(id, info={}, opt={}){
    const _info = assign({zagent: os.hostname()}, info);
    if (global.it)
        return;
    return zerr.perr(id, _info, opt);
};

E.omit_by = (obj, fn)=>
    zutil.reduce_obj(obj, (v, k)=>k, (v, k)=>fn(v, k) ? undefined : v);

E.omit_defaults = (obj, defaults)=>E.omit_by(obj, (v, k)=>{
    if (Array.isArray(v) && !v.length)
        return true;
    if (typeof v=='object')
        return zutil.equal_deep(v, defaults[k]);
    return !lpm_config.mgr_proxy_shared_fields.includes(k) && v===defaults[k];
});
const rand_range = (start=0, end=1)=>Math.round(
    start+Math.random()*(end-start));
E.req_util = {
    is_ssl: req=>!!req.is_mitm_req,
    is_connect: req=>req.method=='CONNECT',
    full_url: req=>{
        if (!E.req_util.is_ssl(req))
            return req.url;
        const {servername} = req.client, {host} = req.headers;
        const port = host.match(/:\d+/) || [''];
        let _host = servername ? servername + port[0] : host;
        const _url = req.url.replace(/^(https?:\/\/[^/]+)?\//, _host+'/');
        return `https://${_url}`;
    },
    gen_id: (id, retry)=>{
        if (!id)
            id = 'r-0-'+rand_range(1, 1000000);
        if (retry)
            id = id.replace(/-[0-9]*-/, `-${retry}-`);
        return id;
    },
    get_domain: req=>{
        let domain = E.url2domain(req.url);
        if (domain)
            return domain;
        if (req.ctx && req.ctx.domain)
            return req.ctx.domain;
        if (req.ctx && req.ctx.url)
            return E.url2domain(req.ctx.url);
        return domain;
    },
    get_remote_ip: req=>{
        if (req.socket)
        {
            if (req.socket._parent && req.socket._parent.lpm_forwarded_for)
                return req.socket._parent.lpm_forwarded_for;
            if (req.socket.lpm_forwarded_for)
                return req.socket.lpm_forwarded_for;
            if (req.socket.socket && req.socket.socket.lpm_forwarded_for)
                return req.socket.socket.lpm_forwarded_for;
            if (req.socket.remoteAddress)
                return req.socket.remoteAddress;
            if (req.socket.socket && req.socket.socket.remoteAddress)
                return req.socket.socket.remoteAddress;
        }
        return null;
    },
};
E.res_util = {
    is_one_of_types: (res, types)=>{
        const headers = res.headers||{};
        const content_type = headers['content-type']||'';
        return types.some(type=>content_type.includes(type));
    },
};
E.swagger_util = {
    get_ep: req=>swagger.paths[req.url] &&
        swagger.paths[req.url][req.method.toLowerCase()],
};

// http://www.haproxy.org/download/1.8/doc/proxy-protocol.txt v1
class Lb_transform extends stream.Transform {
    constructor(){
        super({});
        this.lb_data = new Buffer.alloc(0);
        this.finished = false;
    }
    _transform(chunk, encoding, cb){
        if (this.finished)
            this.push(chunk);
        else
        {
            this.lb_data = Buffer.concat([this.lb_data, chunk]);
            let length;
            if (~(length = this.lb_data.indexOf('\r\n')))
            {
                this.finished = true;
                let client_data = this.lb_data.toString().slice(0, length)
                    .split(' ');
                if (client_data[0]!='PROXY' || client_data[1]=='UNKNOWN')
                    return this.destroy('Malformed proxy protocol');
                this.emit('parsed', {remote_ip: client_data[2]});
                if (this.lb_data.length>length+2)
                    this.push(this.lb_data.slice(length+2));
            }
            else if (this.lb_data.length>=108)
                return this.destroy('Malformed proxy protocol');
        }
        cb();
    }
}

E.Lb_transform = Lb_transform;

class Timeouts {
    constructor(){
        this.timeouts = new Set();
    }
    set_timeout(cb, delay){
        const timeout = setTimeout(()=>{
            this.timeouts.delete(timeout);
            cb();
        }, delay);
        this.timeouts.add(timeout);
    }
    set_interval(cb, delay){
        const interval = setInterval(()=>{
            this.timeouts.delete(interval);
            cb();
        }, delay);
        this.timeouts.add(interval);
    }
    clear(){
        this.timeouts.forEach(clearTimeout);
        this.timeouts.clear();
    }
}

E.Timeouts = Timeouts;

class Timeline {
    constructor(){
        this.req_chain = [];
    }
    track(name){
        this.req[name] = Date.now();
    }
    get_delta(name){
        let metric1 = this.get(name);
        let metric2 = this.get('create');
        if (!metric1||!metric2)
            return 0;
        return metric1-metric2;
    }
    get(name, idx, nofb){
        if (typeof idx!='number')
            idx = this.req_chain.length-1;
        if (!Array.isArray(name))
            name = [name];
        for (let i=0; i<name.length; i++)
        {
            if (this.req_chain[idx][name[i]])
                return this.req_chain[idx][name[i]];
        }
        return null;
    }
    add(port, session={}){
        const now = Date.now();
        if (this.req && !this.req.end)
            this.req.end = now;
        this.req = {create: now, port, session: session.session||'no session'};
        this.req_chain.push(this.req);
    }
}

E.Timeline = Timeline;

E.coercers = {
    number: {
        boolean: v=>{
            if (v===0)
                return false;
            if (v===1)
                return true;
            return v;
        },
        date: v=>date(v),
    },
    string: {
        boolean: v=>{
            if (v==='')
                return false;
            if (v=='false' || v=='0')
                return false;
            if (v=='true' || v=='1')
                return true;
            return v;
        },
        number: v=>{
            if (v==='')
                return 0;
            if (/^[+-]?\.?[0-9]/.test(v) && !/[^0-9.+-]/.test(v))
                return Number.parseFloat(v);
            return v;
        },
        array: v=>{
            if (v==='')
                return [];
            return v.split(/[\s,]+/).filter(x=>!!x);
        },
        date: v=>{
            let parsed;
            if (v==='')
                parsed = null;
            else if (/^[+-]?\.?[0-9]/.test(v) && !/[^0-9.+-]/.test(v))
                parsed = date(Number.parseFloat(v));
            else
                parsed = date(v);
            if (parsed && Number.isFinite(+parsed))
                return parsed;
            return v;
        },
    },
    default: to_type=>value=>{
        switch (to_type)
        {
        case 'number':
            return Number(value);
        case 'string':
            return String(value);
        case 'boolean':
            return Boolean(value);
        case 'array':
            return Array.from(value);
        case 'date':
            return date(value);
        default:
            return value;
        }
    },
};

E.alias_type = type=>{
    switch (type.toLowerCase())
    {
    case 'integer':
        return 'number';
    case 'array':
        return 'object';
    default:
        return type;
    }
};

E.get_coercer = (from, to)=>E.coercers[from] && E.coercers[from][to]
    || E.coercers.default(to);


E.try_int_r = obj=>keys(obj).forEach(k=>{
    if (Array.isArray(obj[k]))
        return obj[k].forEach(item=>E.try_int_r(item));
    if (typeof obj[k] == 'object')
        return E.try_int_r(obj[k]);
    let int = parseInt(obj[k]);
    if (!isNaN(int))
        obj[k] = int;
});

E.bool_str = ['true', 'false'];

E.s3 = {
    default_target: 'logs/pm/',
    required_fields: ['bucket', 'access_key', 'secret_key'],
    get_name_format: ({instant, compress, group_by_day})=>{
        const ext = compress ? '.gz' : '';
        const sub = instant ? 'test_' : '';
        const name = group_by_day ? '%H:%M' : '%Y-%m-%d_%H:%M';
        const group = group_by_day ? '%Y-%m-%d/' : '';
        return `${group}brd_${sub}${name}.log${ext}`;
    },
    get_tags: ({tag_type, tag_project})=>assign({}, tag_type ?
        {type: tag_type} : {}, tag_project ? {project: tag_project} : {}),
    get_target: ({target=E.s3.default_target})=>{
        if (target.startsWith('/'))
            target = target.substring(1);
        if (!target.endsWith('/'))
            target += '/';
        return target;
    },
    get_config: ({access_key, secret_key})=>({
        credentials: {
            accessKeyId: access_key,
            secretAccessKey: secret_key,
        }
    }),
    validate: opt=>E.s3.required_fields.forEach(field=>{
        if (!opt[field])
            throw new Error(`${field} is required`);
    }),
    prepare_opt: opt=>keys(opt).forEach(k=>{
        if (E.bool_str.includes(opt[k]))
            opt[k] = E.coercers.string.boolean(opt[k]);
    }),
};

const REDIRECT_STATUSES = [301, 302, 303, 307, 308];
E.REDIRECT_PARTS = ['protocol', 'hostname', 'pathname', 'port'];
E.is_redirect_status = status=>REDIRECT_STATUSES.includes(status);
