// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, mocha:true*/
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const https = require('https');
const net = require('net');
const url = require('url');
const zlib = require('zlib');
const request = require('request');
const http_shutdown = require('http-shutdown');
const {Netmask} = require('netmask');
const forge = require('node-forge');
const username = require('../lib/username.js');
const ssl = require('../lib/ssl.js');
const Server = require('../lib/server.js');
const Worker = require('../lib/worker.js');
const Manager = require('../lib/manager.js');
const consts = require('../lib/consts.js');
const etask = require('../util/etask.js');
const date = require('../util/date.js');
const zutil = require('../util/util.js');
const lpm_util = require('../util/lpm_util.js');
const restore_case = require('../util/takeup_util.js').restore_case;
const customer = 'abc';
const password = 'xyz';
const test_url = {http: 'http://lumtest.com/test',
    https: 'https://lumtest.com/test'};
const zone_auth_type_whitelist = [customer];
const E = module.exports = {};

E.keys = forge.pki.rsa.generateKeyPair(2048);
E.keys.privateKeyPem = forge.pki.privateKeyToPem(E.keys.privateKey);
E.keys.publicKeyPem = forge.pki.publicKeyToPem(E.keys.publicKey);

E.init_lum = proxy=>opt=>etask(function*(){
    opt = opt||{};
    if (opt.ssl===true)
        opt.ssl = Object.assign({requestCert: false}, ssl(E.keys));
    const l = new Server(Object.assign({
        proxy: '127.0.0.1',
        proxy_port: proxy.port,
        customer,
        password,
        zone_auth_type_whitelist,
        log: 'none',
        logs: 1000,
        port: 24000,
    }, opt), new Worker().run().setup({keys: E.keys}));
    l.test = etask._fn(function*(_this, req_opt){
        if (typeof req_opt=='string')
            req_opt = {url: req_opt};
        req_opt = req_opt||{};
        req_opt.url = req_opt.url || test_url.http;
        req_opt.json = true;
        req_opt.rejectUnauthorized = false;
        if (req_opt.fake)
        {
            req_opt.headers = {
                'x-lpm-fake': true,
                'x-lpm-fake-status': req_opt.fake.status,
                'x-lpm-fake-data': req_opt.fake.data,
            };
            if (req_opt.fake.headers)
            {
                req_opt.headers['x-lpm-fake-headers'] =
                    JSON.stringify(req_opt.fake.headers);
            }
            delete req_opt.fake;
        }
        if (!req_opt.skip_proxy)
        {
            req_opt.proxy = req_opt.proxy ||
                `http://127.0.0.1:${opt.port||'24000'}`;
        }
        let req = request(req_opt, (err, res)=>
            this.continue(etask.err_res(err, res)));
        if (req_opt.lb_data)
            req.on('socket', socket=>socket.write(req_opt.lb_data));
        if (req_opt.no_usage)
            return yield this.wait();
        const w = etask.wait();
        l.on('error', e=>w.throw(e));
        l.on('request_error', e=>w.throw(e));
        l.on('usage', ()=>w.continue());
        l.on('usage_abort', ()=>w.continue());
        l.on('switched', ()=>w.continue());
        const res = yield this.wait();
        yield w;
        return res;
    });
    yield l.listen();
    l.history = [];
    const lhpush = data=>l.history.push(data);
    l.on('usage', lhpush);
    l.on('usage_abort', lhpush);
    return l;
});

E.assert_has = (value, has, prefix)=>{
    prefix = prefix||'';
    if (value==has)
        return;
    if (Array.isArray(has) && Array.isArray(value))
    {
        assert.ok(value.length >= has.length, `${prefix}.length is `
                +`${value.length} should be at least ${has.length}`);
        has.forEach((h, i)=>E.assert_has(value[i], h, `${prefix}[${i}]`));
        return;
    }
    if (has instanceof Object && value instanceof Object)
    {
        Object.keys(has).forEach(k=>
            E.assert_has(value[k], has[k], `${prefix}.${k}`));
        return;
    }
    assert.equal(value, has, prefix);
};

const to_body = req=>({
    ip: '127.0.0.1',
    method: req.method,
    url: req.url,
    headers: restore_case(req.headers, req.rawHeaders),
});

E.last_ip = new Netmask('1.1.1.0');
E.get_random_ip = ()=>{
    E.last_ip = E.last_ip.next();
    return E.last_ip.base;
};

E.http_proxy = port=>etask(function*(){
    const proxy = {history: [], full_history: []};
    const handler = (req, res, head)=>{
        if (proxy.fake)
        {
            const body = to_body(req);
            const auth = username.parse(body.headers['proxy-authorization']);
            if (auth)
                body.auth = auth;
            let status = 200;
            if (req.url=='http://lumtest.com/fail_url')
                status = 500;
            res.writeHead(status, {'content-type': 'application/json'});
            res.write(JSON.stringify(body));
            proxy.full_history.push(body);
            if (body.url!='http://lumtest.com/myip.json')
                proxy.history.push(body);
            return res.end();
        }
        req.pipe(request({
            host: req.headers.host,
            uri: req.url,
            method: req.method,
            path: url.parse(req.url).path,
            headers: zutil.omit(req.headers, 'proxy-authorization'),
        }).on('response', _res=>{
            res.writeHead(_res.statusCode, _res.statusMessage,
                Object.assign({'x-luminati-ip': E.get_random_ip()},
                    _res.headers));
            _res.pipe(res);
        }).on('error', this.throw_fn()));
    };
    proxy.http = http.createServer((req, res, head)=>{
        if (!proxy.connection)
            return handler(req, res, head);
        proxy.connection(()=>handler(req, res, head), req);
    });
    http_shutdown(proxy.http);
    const headers = {};
    ssl.load_ca();
    proxy.http.on('connect', (req, res, head)=>etask(function*(){
        let _url = req.url;
        if (proxy.fake)
        {
            if (!proxy.https)
            {
                proxy.https = https.createServer(
                    Object.assign({requestCert: false}, ssl(E.keys),
                    {minVersion: consts.MIN_TLS}),
                    (_req, _res, _head)=>{
                        zutil.defaults(_req.headers,
                            headers[_req.socket.remotePort]||{});
                        handler(_req, _res, _head);
                    }
                );
                http_shutdown(proxy.https);
                yield etask.nfn_apply(proxy.https, '.listen', [0]);
            }
            _url = '127.0.0.1:'+proxy.https.address().port;
        }
        let req_port;
        res.write(`HTTP/1.1 200 OK\r\nx-luminati-ip: ${to_body(req).ip}`
            +'\r\n\r\n');
        if (req.method=='CONNECT')
            proxy.full_history.push(to_body(req));
        const socket = net.connect({
            host: _url.split(':')[0],
            port: _url.split(':')[1]||443,
        });
        socket.setNoDelay();
        socket.on('connect', ()=>{
            req_port = socket.localPort;
            headers[req_port] = req.headers||{};
        }).on('close', ()=>delete headers[req_port]).on('error',
            this.throw_fn());
        res.pipe(socket).pipe(res);
        res.on('error', ()=>socket.end());
        req.on('end', ()=>socket.end());
    }));
    yield etask.nfn_apply(proxy.http, '.listen', [port||20001]);
    proxy.port = proxy.http.address().port;
    const onconnection = proxy.http._handle.onconnection;
    proxy.http._handle.onconnection = function(){
        if (!proxy.busy)
            return onconnection.apply(proxy.http._handle, arguments);
        let m = proxy.http.maxConnections;
        proxy.http.maxConnections = 1;
        proxy.http._connections++;
        onconnection.apply(proxy.http._handle, arguments);
        proxy.http.maxConnections = m;
        proxy.http._connections--;
    };
    proxy.stop = etask._fn(function*(_this){
        yield etask.nfn_apply(_this.http, '.shutdown', []);
        if (_this.https)
            yield etask.nfn_apply(_this.https, '.shutdown', []);
    });
    proxy.request = etask._fn(function*(_this, _url){
        return yield etask.nfn_apply(request, [{
            url: _url||'http://lumtest.com/myip',
            proxy: `http://${customer}:${password}@127.0.0.1:${proxy.port}`,
            strictSSL: false,
        }]);
    });
    return proxy;
});

E.smtp_test_server = port=>etask(function*(){
    let smtp = net.createServer(socket=>{
        smtp.last_connection = socket;
        if (!smtp.silent)
            socket.write('220 smtp-tester ESMTP is glad to see you!\n');
        socket.on('data', chunk=>{
            switch (chunk.toString())
            {
            case 'QUIT':
                socket.end('221 Bye\n');
                break;
            default:
                socket.write('500 Error: command not recognized\n');
            }
        })
        .setTimeout(20*date.ms.SEC, ()=>socket.end());
    });
    smtp.listen(port, ()=>this.continue());
    yield this.wait();
    return smtp;
});

E.http_ping = ()=>etask(function*(){
    let ping = {history: []};
    const handler = (req, res)=>{
        let body = to_body(req);
        ping.history.push(body);
        if (req.headers['content-length'])
        {
            res.writeHead(200, 'PONG', {'content-type': 'application/json'});
            req.pipe(res);
        }
        else
        {
            let headers = {'content-type': 'application/json'};
            switch (req.headers['accept-encoding'])
            {
            case 'gzip':
                headers['content-encoding'] = 'gzip';
                body = zlib.gzipSync(JSON.stringify(body));
                break;
            case 'deflate':
                headers['content-encoding'] = 'deflate';
                body = zlib.deflateSync(JSON.stringify(body));
                break;
            case 'deflate-raw':
                headers['content-encoding'] = 'deflate';
                body = zlib.deflateRawSync(JSON.stringify(body));
                break;
            default:
                body = JSON.stringify(body);
            }
            res.writeHead(200, 'PONG', headers);
            res.end(body);
        }
    };
    const _http = http.createServer(handler);
    yield etask.nfn_apply(_http, '.listen', [0]);
    _http.on('error', this.throw_fn());
    ping.http = {
        server: _http,
        port: _http.address().port,
        url: `http://127.0.0.1:${_http.address().port}/`,
    };
    const _https = https.createServer(ssl(E.keys), handler);
    yield etask.nfn_apply(_https, '.listen', [0]);
    _https.on('error', this.throw_fn());
    ping.https = {
        server: _https,
        port: _https.address().port,
        url: `https://localhost:${_https.address().port}/`,
    };
    ping.stop = etask._fn(function*(_this){
        yield etask.nfn_apply(_this.http.server, '.close', []);
        yield etask.nfn_apply(_this.https.server, '.close', []);
    });
    return ping;
});

const get_param = (args, param)=>{
    let i = args.indexOf(param)+1;
    return i ? args[i] : null;
};

E.app_with_args = (args, opt={})=>etask(function*(){
    let manager, {only_explicit, start_manager, server_conf} = opt;
    this.finally(()=>{
        if (this.error && manager)
            return manager.stop(true);
    });
    args = args||[];
    if (!only_explicit)
    {
        if (!get_param(args, '--proxy'))
            args = args.concat(['--proxy', '127.0.0.1']);
        if (!get_param(args, '--proxy_port'))
            args = args.concat(['--proxy_port', 24000]);
        if (!get_param(args, '--config')&&!get_param(args, '--no-config'))
            args.push('--no-config');
        if (!get_param(args, '--customer'))
            args = args.concat(['--customer', customer]);
        if (!get_param(args, '--password'))
            args = args.concat(['--password', password]);
        if (!get_param(args, '--dropin')&&!get_param(args, '--no-dropin'))
            args = args.concat(['--no-dropin']);
        if (!get_param(args, '--local_login') &&
            !get_param(args, '--no-local_login'))
        {
            args = args.concat(['--no-local_login']);
        }
        args = args.concat('--loki', '/tmp/testdb');
    }
    Manager.prototype.lpm_users_get = ()=>null;
    manager = new Manager(lpm_util.init_args(args));
    manager.lpm_conn.init = ()=>null;
    manager.lpm_f.init = ()=>null;
    manager.lpm_f.get_meta_conf = ()=>({
        _defaults: {
            account_id: 'c_123',
            customer_id: 'hl_123',
            customer: 'test_cust',
            password: 'pass123',
            debug: 'full',
            zone: 'static',
            zones: {
                static: {
                    ips: 'any',
                    password: ['pass1'],
                    plan: {
                        type: 'resident',
                        city: 1,
                    },
                    perm: 'country',
                    kw: {},
                    cost: {'precommit': 1000, 'gb': 24},
                    refresh_cost: null,
                },
                foo: {
                    ips: 'any',
                    password: ['pass2'],
                    plan: {
                        type: 'resident',
                        city: 1,
                    },
                    perm: 'country city',
                    kw: {},
                    cost: {'precommit': 500, 'gb': 32},
                    refresh_cost: 0.5,
                },
            },
        },
        customers: ['test_cust'],
        logins: [],
    });
    manager.lpm_f.get_server_conf = ()=>{
        manager.lpm_f.emit('server_conf', Object.assign({client: {}},
            server_conf));
    };
    manager.lpm_f.get_lb_ips = ()=>{
        manager.lpm_f.emit('lb_ips', []);
    };
    if (start_manager!==false)
        yield manager.start();
    return {manager};
});

let tmp_file_counter = 0;

E.temp_file_path = (ext='tmp')=>({
    path: path.join(os.tmpdir(),
        `test-${Date.now()}-${tmp_file_counter++}.${ext}`),
    done(){
        if (!this.path)
            return;
        try { fs.unlinkSync(this.path); }
        catch(e){ console.error(e.message); }
        this.path = null;
    },
});

E.temp_file = (content, ext)=>{
    const temp = E.temp_file_path(ext);
    fs.writeFileSync(temp.path, JSON.stringify(content));
    return temp;
};

E.init_app_with_config = temp_files=>(opt={})=>etask(function*(){
    const args = [];
    const cli = opt.cli||{};
    Object.keys(cli).forEach(k=>{
        if (typeof cli[k]=='boolean')
        {
            if (cli[k])
                args.push('--'+k);
            else
                args.push('--no-'+k);
            return;
        }
        args.push('--'+k);
        if (Array.isArray(cli[k]))
            args.push(...cli[k]);
        else
            args.push(cli[k]);
    });
    if (opt.config)
    {
        const config_file = E.temp_file(opt.config, 'json');
        args.push('--config');
        args.push(config_file.path);
        temp_files.push(config_file);
    }
    return yield E.app_with_args(args, opt);
});

E.init_app_with_proxies = app_with_config=>(proxies, cli)=>etask(function*(){
    return yield app_with_config({config: {proxies}, cli});
});

E.api = (_path, method, data, json, headers)=>etask(function*(){
    const admin = 'http://127.0.0.1:'+Manager.default.www;
    const opt = {
        url: admin+'/'+_path,
        method: method||'GET',
        json,
        body: data,
        headers: headers || {'x-lpm-fake': true},
    };
    return yield etask.nfn_apply(request, [opt]);
});

E.api_json = (_path, opt={})=>etask(function*(){
    return yield E.api(_path, opt.method, opt.body, true, opt.headers);
});

E.json = (_path, method, data)=>etask(function*(){
    const res = yield E.api(_path, method, data, true);
    assert.equal(res.statusCode, 200);
    return res.body;
});

E.make_user_req = (port=24000, status=200)=>{
    return E.api_json('api/test/'+port, {
        method: 'POST',
        body: {
            url: 'http://lumtest.com/myip.json',
            headers: {'x-lpm-fake': true, 'x-lpm-fake-status': status},
        },
    });
};
