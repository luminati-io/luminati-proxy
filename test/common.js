// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, mocha:true*/
const assert = require('assert');
const http = require('http');
const https = require('https');
const http_shutdown = require('http-shutdown');
const net = require('net');
const url = require('url');
const zlib = require('zlib');
const request = require('request');
const {Netmask} = require('netmask');
const forge = require('node-forge');
const username = require('../lib/username.js');
const ssl = require('../lib/ssl.js');
const etask = require('../util/etask.js');
const date = require('../util/date.js');
const zutil = require('../util/util.js');
const restore_case = require('../util/http_hdr.js').restore_case;
const customer = 'abc';
const password = 'xyz';

const E = module.exports = {};

E.keys = forge.pki.rsa.generateKeyPair(2048);
E.keys.privateKeyPem = forge.pki.privateKeyToPem(E.keys.privateKey);
E.keys.publicKeyPem = forge.pki.publicKeyToPem(E.keys.publicKey);

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
                    Object.assign({requestCert: false}, ssl(E.keys)),
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
