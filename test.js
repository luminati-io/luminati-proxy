// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, mocha:true*/
const _ = require('lodash');
const assert = require('assert');
const http = require('http');
const https = require('https');
const net = require('net');
const url = require('url');
const path = require('path');
const os = require('os');
const fs = require('fs');
const socks = require('socksv5');
const ssl = require('./lib/ssl.js');
const hutil = require('hutil');
const request = require('request');
const etask = hutil.etask;
const restore_case = hutil.http_hdr.restore_case;
const qw = hutil.string.qw;
const assign = Object.assign;
const luminati = require('./index.js');
const Luminati = luminati.Luminati;
const Manager = luminati.Manager;
const pkg = require('./package.json');
const customer = 'abc';
const password = 'xyz';

const assert_has = (value, has, prefix)=>{
    prefix = prefix||'';
    if (value==has)
        return;
    if (Array.isArray(has) && Array.isArray(value))
    {
        assert.ok(value.length >= has.length, `${prefix}.length is `
                +`${value.length} should be at least ${has.length}`);
        has.forEach((h, i)=>assert_has(value[i], h, `${prefix}[${i}]`));
        return;
    }
    if (has instanceof Object && value instanceof Object)
    {
        Object.keys(has).forEach(k=>
            assert_has(value[k], has[k], `${prefix}.${k}`));
        return;
    }
    assert.equal(value, has, prefix);
};

let tmp_file_counter = 0;
const temp_file_path = (ext, pre)=>{
    const p = path.join(os.tmpdir(),
        `${pre||'test'}-${Date.now()}-${tmp_file_counter++}.${ext||'tmp'}`);
    const done = ()=>{
        if (this.path)
        {
            try {
                fs.unlinkSync(path);
            } catch(e){}
            this.path = null;
        }
    };
    return {path: p, done: done};
};

const temp_file = (content, ext, pre)=>{
    const temp = temp_file_path(ext, pre);
    fs.writeFileSync(temp.path, JSON.stringify(content));
    return temp;
};

const to_body = req=>({
    ip: '127.0.0.1',
    method: req.method,
    url: req.url,
    headers: restore_case(req.headers, req.rawHeaders),
});

const http_proxy = port=>etask(function*(){
    const proxy = {history: []};
    const handler = (req, res, head)=>{
        if (proxy.fake)
        {
            const body = to_body(req);
            const auth = body.headers['proxy-authorization'];
            if (auth)
            {
                const cred = (new Buffer(auth.split(' ')[1], 'base64'))
                    .toString('ascii').split(':');
                body.auth = {password: cred[1]};
                for (let args=cred[0].split('-'); args.length;)
                {
                    const key = args.shift();
                    if (key=='lum')
                        continue;
                    body.auth[key] = args.shift();
                }
            }
            res.writeHead(200, {'content-type': 'application/json'});
            res.write(JSON.stringify(body));
            proxy.history.push(body);
            return res.end();
        }
        req.pipe(request({
            host: req.headers.host,
            uri: req.url,
            method: req.method,
            path: url.parse(req.url).path,
            headers: _.omit(req.headers, 'proxy-authorization'),
        }).on('response', _res=>{
            res.writeHead(_res.statusCode, _res.statusMessage,
                _res.headers);
            _res.pipe(res);
        }).on('error', this.throw_fn()));
    };
    proxy.http = http.createServer((req, res, head)=>{
        if (!proxy.connection)
            return handler(req, res, head);
        proxy.connection(()=>handler(req, res, head), req);
    });
    const headers = {};
    proxy.http.on('connect', (req, res, head)=>etask(function*(){
        let _url = req.url;
        if (proxy.fake)
        {
            if (!proxy.https)
            {
                proxy.https = https.createServer(
                    assign({requestCert: false}, ssl()),
                    (req, res, head)=>{
                        _.defaults(req.headers,
                            headers[req.socket.remotePort]||{});
                        handler(req, res, head);
                    }
                );
                yield etask.nfn_apply(proxy.https, '.listen', [0]);
            }
            _url = '127.0.0.1:'+proxy.https.address().port;
        }
        let port;
        res.write('HTTP/1.1 200 OK\r\n\r\n');
        const socket = net.connect({
            host: _url.split(':')[0],
            port: _url.split(':')[1]||443,
        });
        socket.setNoDelay();
        socket.on('connect', ()=>{
            port = socket.localPort;
            headers[port] = req.headers||{};
        }).on('close', ()=>delete headers[port]).on('error', this.throw_fn());
        res.pipe(socket).pipe(res);
        req.on('end', ()=>socket.end());
    }));
    yield etask.nfn_apply(proxy.http, '.listen', [port||22225]);
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
        yield etask.nfn_apply(_this.http, '.close', []);
        if (_this.https)
            yield etask.nfn_apply(_this.https, '.close', []);
    });
    proxy.request = etask._fn(function*(_this, url){
        return yield etask.nfn_apply(request, [{
            url: url||'http://lumtest.com/myip',
            proxy: `http://${customer}:${password}@127.0.0.1:${proxy.port}`,
            strictSSL: false,
        }]);
    });
    return proxy;
});
const http_ping = ()=>etask(function*http_ping(){
    let ping = {history: []};
    const handler = (req, res)=>{
        let body = to_body(req);
        ping.history.push(body);
        res.writeHead(200, 'PONG', {'content-type': 'application/json'});
        res.write(JSON.stringify(body));
        res.end();
    };
    const _http = http.createServer(handler);
    yield etask.nfn_apply(_http, '.listen', [0]);
    _http.on('error', this.throw_fn());
    ping.http = {
        server: _http,
        port: _http.address().port,
        url: `http://127.0.0.1:${_http.address().port}/`,
    };
    const _https = https.createServer(ssl(), handler);
    yield etask.nfn_apply(_https, '.listen', [0]);
    _https.on('error', this.throw_fn());
    ping.https = {
        server: _https,
        port: _https.address().port,
        url: `https://127.0.0.1:${_https.address().port}/`,
    };
    ping.stop = etask._fn(function*(_this){
        yield etask.nfn_apply(_this.http.server, '.close', []);
        yield etask.nfn_apply(_this.https.server, '.close', []);
    });
    return ping;
});
let proxy, ping;
before(etask._fn(function*before(_this){
    _this.timeout(30000);
    console.log('Start prep', new Date());
    proxy = yield http_proxy();
    ping = yield http_ping();
    console.log('End prep', new Date());
}));
beforeEach(()=>{
    proxy.fake = true;
    proxy.connection = null;
});
after(()=>etask(function*after(){
    if (proxy)
        yield proxy.stop();
    proxy = null;
    if (ping)
        yield ping.stop();
    ping = null;
}));
describe('proxy', ()=>{
    const test_url = 'http://lumtest.com/test';
    const lum = opt=>etask(function*(){
        opt = opt||{};
        if (opt.ssl===true)
            opt.ssl = assign({requestCert: false}, ssl());
        const l = new Luminati(assign({
            proxy: '127.0.0.1',
            proxy_port: proxy.port,
            customer: customer,
            password: password,
            log: 'NONE',
            port: 24000,
        }, opt));
        l.test = etask._fn(function*(_this, opt){
            if (typeof opt=='string')
                opt = {url: opt};
            opt = opt||{};
            opt.url = opt.url||test_url;
            opt.json = true;
            opt.rejectUnauthorized = false;
            return yield etask.nfn_apply(_this, '.request',
                [opt]);
        });
        yield l.listen();
        return l;
    });
    let l, waiting;
    const repeat =(n, action)=>{
        while (n--)
            action();
    };
    const release = n=>repeat(n||1, ()=>waiting.shift()());
    const hold_request = (next, req)=>{
        if (req.url!=test_url)
            return next();
        waiting.push(next);
    };

    beforeEach(()=>{
        proxy.history = [];
        waiting = [];
        ping.history = [];
    });
    afterEach(()=>etask(function*(){
        if (!l)
            return;
        yield l.stop(true);
        l = null;
    }));
    describe('sanity', ()=>{
        const t = (name, url, opt)=>it(name, ()=>etask(function*(){
            proxy.fake = false;
            const _url = url();
            l = yield lum(opt);
            let res = yield l.test(_url);
            assert.equal(ping.history.length, 1);
            assert_has(res, {
                statusCode: 200,
                statusMessage: 'PONG',
            });
        }));
        t('http', ()=>ping.http.url);
        t('https', ()=>ping.https.url);
        t('https sniffing', ()=>ping.https.url, {ssl: true, insecure: true});
    });
    describe('headers', ()=>{
        describe('X-Hola-Agent', ()=>{
            it('added to super proxy request', ()=>etask(function*(){
                l = yield lum();
                yield l.test();
                assert.equal(proxy.history.length, 1);
                assert.equal(proxy.history[0].headers['x-hola-agent'],
                    'proxy='+luminati.version+' node='+process.version
                        +' platform='+process.platform);
            }));
            it('not added when accessing site directly', ()=>etask(function*(){
                l = yield lum({bypass_proxy: '.*'});
                let res = yield l.test(ping.http.url);
                assert.ok(!res.body.headers['x-hola-agent']);
            }));
        });
        describe('X-Hola-Context', ()=>{
            let history;
            const aggregator = data=>history.push(data);
            const t = (name, url, opt, target, skip_res)=>it(name, ()=>etask(
            function*(){
                const context = 'context-1';
                history = [];
                l = yield lum(assign({history: true, history_aggregator:
                    aggregator}, opt));
                let res = yield l.test({
                    url: url(),
                    headers: {'x-hola-context': context},
                });
                if (!skip_res)
                    assert.equal(res.headers['x-hola-context'], context);
                if (target)
                {
                    const target_req = target();
                    assert.equal(target_req['x-hola-context'], undefined);
                }
                yield etask.sleep(10);
                assert.equal(history.length, 1);
                assert.equal(history[0].context, context);
            }));
            t('null response', ()=>ping.http.url, {null_response: '.*'});
            t('bypass proxy', ()=>ping.http.url, {bypass_proxy: '.*'},
                ()=>ping.history[0]);
            t('http', ()=>test_url, {}, ()=>proxy.history[0]);
            t('https sniffing', ()=>ping.https.url,
                {ssl: true, insecure: true}, ()=>proxy.history[0]);
            t('https connect', ()=>ping.https.url, {ssl: true, insecure: true},
                ()=>proxy.history[0]);
        });
        describe('keep letter caseing and order', ()=>{
            const t = (name, url, opt)=>it(name, ()=>etask(function*(){
                const headers = {
                    'Keep-Alive': 'Close',
                    'X-Just-Testing': 'value',
                    'X-bizzare-Letter-cAsE': 'test',
                };
                l = yield lum(opt);
                const res = yield l.test({url: url(), headers: headers});
                const site_headers = _.omit(res.body.headers,
                    qw`proxy-authorization x-hola-agent`);
                assert_has(site_headers, headers, 'value');
                assert_has(Object.keys(site_headers), Object.keys(headers),
                    'order');
            }));
            t('http', ()=>test_url);
            t('https', ()=>ping.https.url);
            t('https sniffing', ()=>ping.https.url,
                {ssl: true, insecure: true});
            t('bypass http', ()=>ping.http.url, {bypass_proxy: '.*'});
            t('bypass https', ()=>ping.https.url, {bypass_proxy: '.*'});
            t('bypass https sniffing', ()=>ping.https.url+'?match',
                {bypass_proxy: 'match', ssl: true, insecure: true});
        });
    });
    it('Listening without specifing port', ()=>etask(function*(){
        l = yield lum({port: false});
        yield l.test();
        assert.equal(proxy.history.length, 1);
    }));
    describe('options', ()=>{
        describe('passthrough (allow_proxy_auth)', ()=>{
            it('disabled', ()=>etask(function*(){
                l = yield lum({pool_size: 3});
                const res = yield l.test({headers: {
                    'proxy-authorization': 'Basic '+
                        (new Buffer('lum-customer-user-zone-zzz:pass'))
                        .toString('base64'),
                }});
                assert.ok(l.sessions);
                assert.equal(proxy.history.length, 4);
                assert.equal(res.body.auth.customer, customer);
                assert.equal(res.body.auth.password, password);
                assert.equal(res.body.auth.zone, 'gen');
            }));
            it('enabled', ()=>etask(function*(){
                l = yield lum({pool_size: 3, allow_proxy_auth: true});
                const res = yield l.test({headers: {
                    'proxy-authorization': 'Basic '+
                        (new Buffer('lum-customer-user-zone-zzz:pass'))
                        .toString('base64'),
                }});
                assert.ok(!l.sessions);
                assert.equal(proxy.history.length, 1);
                assert.equal(res.body.auth.customer, 'user');
                assert.equal(res.body.auth.password, 'pass');
                assert.equal(res.body.auth.zone, 'zzz');
            }));
        });
        describe('pool', ()=>{
            describe('pool_size', ()=>{
                const t = pool_size=>it(''+pool_size, ()=>etask(function*(){
                    l = yield lum({pool_size});
                    yield l.test();
                    assert.equal(proxy.history.length, pool_size+1);
                    for (let i=0; i<pool_size; i++)
                    {
                        assert.equal(proxy.history[i].url,
                            'http://lumtest.com/myip.json');
                    }
                    assert.equal(proxy.history[pool_size].url, test_url);
                    assert.equal(l.sessions.length, pool_size);
                    let sessions = {};
                    for (let i=0; i<pool_size; i++)
                    {
                        let s = l.sessions[i];
                        assert.equal(s.host, '127.0.0.1');
                        assert.ok(!sessions[s.session]);
                        sessions[s.session] = true;
                    }
                }));
                t(1);
                t(3);
                t(10);
            });
            describe('max_requests', ()=>{
                describe('range', ()=>{
                    const pool = 50;
                    const t=(name, start, end)=>it(name, ()=>etask(function*(){
                        l = yield lum({max_requests: start+':'+end,
                            pool_size: pool});
                        yield l.refresh_sessions();
                        let max_requests = l.sessions.map(s=>s.max_requests);
                        let count = {};
                        max_requests.forEach(m=>{
                            if (!start || !end)
                                assert.equal(m, start || end);
                            else
                                assert.ok(start<=m && m<=end);
                            count[m] = count[m] ? count[m]+1 : 1;
                        });
                        if (start && end && start!=end)
                        {
                            for (let c in count)
                                assert.notEqual(count[c], pool);
                        }
                    }));
                    t('valid', 60, 70);
                    t('same', 50, 50);
                    t('only end', '', 30);
                    t('only start', 15, '');
                });
                it('disabled', ()=>etask(function*(){
                    l = yield lum({max_requests: '0'});
                    assert.equal(l.max_requests, 0);
                }));

                const test_call = ()=>etask(function*(){
                    const res = yield l.test();
                    assert.ok(res.body);
                    assert.ok(res.body.auth);
                    return res.body.auth.session;
                });

                const t = (name, opt)=>it(name, etask._fn(function*(_this){
                    _this.timeout(10000);
                    const trials = 3;
                    l = yield lum(opt);
                    let sessions = [];
                    for (let t=0; t<trials; t++)
                    {
                        sessions[t] = [];
                        if (opt.pool_type=='round-robin')
                        {
                            for (let req=0; req<opt.max_requests; req++)
                            {
                                for (let s=0; s<opt.pool_size; s++)
                                {
                                    sessions[t][s] = sessions[t][s]||[];
                                    sessions[t][s][req] = yield test_call();
                                }
                            }
                        }
                        else
                        {
                            for (let s=0; s<opt.pool_size; s++)
                            {
                                sessions[t][s] = [];
                                for (let req=0; req<opt.max_requests; req++)
                                    sessions[t][s][req] = yield test_call();
                            }
                        }
                    }
                    let used = [];
                    for (let t=0; t<trials; t++)
                    {
                        for (let s=0; s<opt.pool_size; s++)
                        {
                            let id = sessions[t][s][0];
                            used.forEach(u=>assert.notEqual(id, u));
                            used.push(id);
                            sessions[t][s].forEach(req=>assert.equal(req, id));
                        }
                    }
                }));
                t('1, round-robin pool', {max_requests: 1, pool_size: 1,
                    pool_type: 'round-robin'});
                t('2, round-robin pool', {max_requests: 2, pool_size: 2,
                    pool_type: 'round-robin'});
                t('5, round-robin pool', {max_requests: 5, pool_size: 5,
                    pool_type: 'round-robin'});
                t('10, round-robin pool', {max_requests: 10, pool_size: 10,
                    pool_type: 'round-robin'});
                t('1, sequential pool', {max_requests: 1, pool_size: 1});
                t('2, sequential pool', {max_requests: 2, pool_size: 2});
                t('5, sequential pool', {max_requests: 5, pool_size: 5});
                t('10, sequential pool', {max_requests: 10, pool_size: 10});
            });
            it('keep_alive', etask._fn(function*(_this){
                _this.timeout(6000);
                l = yield lum({keep_alive: 1, pool_size: 1}); // actual 1sec
                yield l.test();
                const start = proxy.history.length;
                assert.equal(proxy.history.length, start);
                yield etask.sleep(500);
                assert.equal(proxy.history.length, start);
                yield l.test();
                assert.equal(proxy.history.length, 1+start);
                yield etask.sleep(1500);
                assert.equal(proxy.history.length, 2+start);
            }));
            describe('fastest', ()=>{
                const t = size=>it(''+size, etask._fn(function*(_this){
                    proxy.connection = hold_request;
                    l = yield lum({pool_type: 'fastest', pool_size: size});
                    for (let i = 0; i < size; ++i)
                    {
                        assert.equal(waiting.length, 0);
                        let req = l.test();
                        yield etask.sleep(100);
                        assert.equal(waiting.length, size);
                        waiting.splice(i, 1)[0]();
                        yield req;
                        if (waiting.length)
                            release(waiting.length);
                        yield etask.sleep(100);
                    }
                }));
                t(1);
                // t(2);
            });
        });
        const match_test = url=>etask(function*(){
            yield etask.sleep(10);
            let before = proxy.history.length;
            let res = yield l.test(url);
            yield etask.sleep(10);
            let after = proxy.history.length;
            return {before, after, res};
        });
        describe('null_response', ()=>{
            const t =
                (name, null_response, no_match_url, match_url, ssl, code)=>it(
                    name, ()=>etask(function*(){
                        l = yield lum({
                            null_response: null_response,
                            ssl: ssl,
                            insecure: ssl,
                        });
                        let no_match = yield match_test(no_match_url);
                        let match = yield match_test(match_url);
                        // XXX lee - info for finding out why we have periodic crushes of tests
                        console.log({match_before: match.before, match_after:
                            match.after, no_match_before: no_match.before,
                            no_match_after: no_match.after, history: proxy.history});
                        assert.notEqual(no_match.after, no_match.before);
                        assert.equal(match.after, match.before);
                        assert.equal(match.res.statusCode, 200);
                        assert.equal(match.res.statusMessage, 'NULL');
                        assert.equal(match.res.body, undefined);
                    }));
                    t('http', 'echo\\.json', 'http://lumtest.com/myip.json',
                        'http://lumtest.com/echo.json');
                    t('https sniffing by path', 'echo\\.json',
                        'https://lumtest.com/myip.json',
                        'https://lumtest.com/echo.json', true);
                    t('https sniffing by domain', 'lumtest\.com',
                        'https://httpsbin.org/ip',
                        'http://lumtest.com/myip.json',
                        true);
                    it('https connect', ()=>etask(function*(){
                        l = yield lum({null_response: 'match', log: 'DEBUG'});
                        try {
                            yield l.test('https://match.com');
                        } catch(err){
                            assert(/statusCode=501/.test(err.message));
                        }
                        yield l.test();
                        assert.ok(proxy.history.length>0);
                    }));
                }
            );
        describe('bypass_proxy', ()=>{
            const t = (name, match_url, no_match_url, opt)=>it(name, ()=>etask(
            function*(){
                l = yield lum(assign({bypass_proxy: 'match'},
                    opt));
                yield l.test();
                let missmatch = yield match_test(no_match_url());
                let match = yield match_test(match_url());
                assert.equal(match.after, match.before);
                assert.notEqual(missmatch.after, missmatch.before);
            }));
            t('http', ()=>ping.http.url+'match',
                ()=>ping.http.url+'n-o--m-a-t-c-h');
            t('https sniffing', ()=>ping.https.url+'match',
                ()=>ping.https.url+'n-o--m-a-t-c-h',
                {ssl: true, insecure: true});
            it('https connect', ()=>'https://match.com/', ()=>ping.https.url,
                {insecure: true});
        });
        describe('luminati params', ()=>{
            const t = (name, target, expected)=>it(name, ()=>etask(function*(){
                expected = expected||target;
                l = yield lum(assign({}, target, {}));
                const res = yield l.test();
                assert_has(res.body.auth, expected);
            }));
            t('auth', {customer: 'a', password: 'p'});
            t('zone', {zone: 'abc'});
            t('country', {country: 'il'});
            t('city', {country: 'us', state: 'ny', city: 'newyork'});
            t('static', {zone: 'static', ip: '127.0.0.1'});
            t('ASN', {zone: 'asn', asn: 28133});
            t('DNS', {dns: 'local'});
            t('debug', {debug: 'none'});
            t('request_timeout', {request_timeout: 10}, {timeout: 10});
        });
        describe('socks', ()=>{
            const t = (name, url)=>it(name, etask._fn(function*(_this){
                _this.timeout(30000);
                l = yield lum({socks: 25000});
                let res = yield etask.nfn_apply(request, [{
                    agent: new socks.HttpAgent({
                        proxyHost: '127.0.0.1',
                        proxyPort: 25000,
                        auths: [socks.auth.None()],
                    }),
                    url: url,
                }]);
                let body = JSON.parse(res.body);
                assert.equal(body.url, url);
            }));
            t('http', test_url);
        });
        describe('throttle', ()=>{
            const t = throttle=>it(''+throttle, etask._fn(function*(_this){
                _this.timeout(3000);
                let requests = [];
                const request = n=>repeat(n, ()=>requests.push(l.test()));
                proxy.connection = hold_request;
                l = yield lum({throttle});
                request(2*throttle);
                yield etask.sleep(100);
                assert.equal(waiting.length, throttle);
                for (let i=0; i < throttle; ++i)
                {
                    release(1);
                    yield etask.sleep(100);
                    assert.equal(waiting.length, throttle);
                }
                release(throttle);
                yield etask.all(requests);
            }));
            t(1);
            t(3);
            t(10);
        });
        describe('refresh_session', ()=>{
            it('pool', ()=>etask(function*(){
                const test_session = session=>etask(function*(){
                    let res = yield l.test();
                    let auth = res.body.auth;
                    assert(auth.session, session);
                });
                l = yield lum({pool_size: 1, max_requests: 10});
                yield test_session('24000_1');
                yield l.refresh_sessions();
                yield test_session('24000_2');
            }));
        });
        describe('history aggregation', ()=>{
            let history;
            const aggregator = data=>history.push(data);
            beforeEach(()=>history = []);
            const t = (name, url, expected, opt)=>it(name, ()=>etask(
            function*(){
                ping.headers = ping.headers||{};
                ping.headers.connection = 'close';
                l = yield lum(assign({history: true,
                    history_aggregator: aggregator}, opt));
                assert.equal(history.length, 0);
                let res = yield l.test(url());
                res.socket.destroy();
                yield etask.sleep(10);
                assert.equal(history.length, 1);
                assert_has(history[0], expected());
            }));
            t('http', ()=>ping.http.url, ()=>({
                port: 24000,
                url: ping.http.url,
                method: 'GET',
                super_proxy: '127.0.0.1'
            }));
            t('https connect', ()=>ping.https.url, ()=>({
                port: 24000,
                url: '127.0.0.1:'+ping.https.port,
                method: 'CONNECT',
            }), {insecure: true});
            t('https sniffing', ()=>ping.https.url, ()=>({
                port: 24000,
                method: 'GET',
                url: ping.https.url,
            }), {ssl: true, insecure: true});
            t('bypass http', ()=>ping.http.url, ()=>({
                port: 24000,
                url: ping.http.url,
                method: 'GET',
                super_proxy: null,
            }), {bypass_proxy: '.*'});
            t('bypass https', ()=>ping.https.url, ()=>({
                port: 24000,
                url: ping.https.url,
                method: 'CONNECT',
                super_proxy: null,
            }), {bypass_proxy: '.*', insecure: true});
            t('null_response', ()=>ping.http.url, ()=>({
                port: 24000,
                status_code: 200,
                status_message: 'NULL',
                super_proxy: null,
                content_size: 0,
            }), {null_response: '.*'});
            it('pool', etask._fn(function*(_this){
                _this.timeout(4000);
                l = yield lum({pool_size: 1, keep_alive: 1, history: true,
                    history_aggregator: aggregator});
                l.refresh_sessions();
                yield etask.sleep(1200);
                l.update_all_sessions();
                yield etask.sleep(10);
                assert.equal(history.length, 3);
                assert_has(history, [
                    {context: 'SESSION INIT'},
                    {context: 'SESSION KEEP ALIVE'},
                    {context: 'SESSION INFO'},
                ]);
            }));
        });
    });
});
describe('manager', ()=>{
    let app, temp_files;

    const get_param = (args, param)=>{
        let i = args.indexOf(param)+1;
        return i?args[i]:null;
    };

    const app_with_args = args=>etask(function*app_with_args(){
        let manager;
        this.finally(()=>{
            if (this.error && manager)
                return manager.stop(true);
        });
        args = args||[];
        let www = get_param(args, '--www')||Manager.default.www;
        let log = get_param(args, '--log');
        if (!log)
            args = args.concat(['--log', 'NONE']);
        let db_file = temp_file_path('.sqlite3');
        if (!get_param(args, '--database'))
            args = args.concat(['--database', db_file.path]);
        if (!get_param(args, '--proxy'))
            args = args.concat(['--proxy', '127.0.0.1']);
        if (!get_param(args, '--proxy_port'))
            args = args.concat(['--proxy_port', proxy.port]);
        if (!get_param(args, '--config')&&!get_param(args, '--no-config'))
            args.push('--no-config');
        if (!get_param(args, '--customer'))
          args = args.concat(['--customer', customer]);
        if (!get_param(args, '--password'))
          args = args.concat(['--password', password]);
        if (!get_param(args, '--mode'))
          args = args.concat(['--mode', 'guest']);
        manager = new Manager(args, {bypass_credentials_check: true});
        manager.on('error', this.throw_fn());
        yield manager.start();
        let admin = 'http://127.0.0.1:'+www;
        return {manager, admin, db_file};
    });
    const app_with_config = opt=>etask(function*app_with_config(){
        let args = [];
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
            args.push(cli[k]);
        });
        if (opt.config)
        {
            const config_file = temp_file(opt.config||[], 'json');
            args.push('--config');
            args.push(config_file.path);
            temp_files.push(config_file);
        }
        (opt.files||[]).forEach(c=>{
            const file = temp_file(c, 'json');
            args.push(file.path);
            temp_files.push(file);
        });
        return yield app_with_args(args);
    });
    const app_with_proxies = (proxies, cli)=>etask(function*app_with_proxies(){
        return yield app_with_config({config: {proxies}, cli: cli});
    });
    const api = (path, method, data, json)=>etask(function*api(){
        const opt = {
            url: app.admin+'/'+path,
            method: method||'GET',
            json: json,
            body: data,
        };
        return yield etask.nfn_apply(request, [opt]);
    });
    const json = (path, method, data)=>etask(function*json(){
        const res = yield api(path, method, data, true);
        assert.equal(res.statusCode, 200);
        return res.body;
    });

    afterEach(()=>etask(function*(){
        if (!app)
            return;
        yield app.manager.stop(true);
        if (process.platform=='win32')
            yield etask.sleep(10);
        app.db_file.done();
        app = null;
    }));
    beforeEach(()=>temp_files = []);
    afterEach(()=>temp_files.forEach(f=>f.done()));
    describe('socks', ()=>{
        const t = (name, url)=>it(name, etask._fn(function*(_this){
            _this.timeout(30000);
            let args = [
                '--socks', '25000:24000',
            ];
            app = yield app_with_args(args);
            let res = yield etask.nfn_apply(request, [{
                agent: new socks.HttpAgent({
                    proxyHost: '127.0.0.1',
                    proxyPort: 25000,
                    auths: [socks.auth.None()],
                }),
                url: url,
            }]);
            let body = JSON.parse(res.body);
            assert.equal(body.url, url);
        }));
        t('http', 'http://lumtest.com/echo.json');
    });
    describe('config load', ()=>{
        const t = (name, config, expected)=>it(name, etask._fn(
        function*(_this){
            _this.timeout(4000);
            app = yield app_with_config(config);
            let proxies = yield json('api/proxies_running');
            assert_has(proxies, expected, 'proxies');
        }));

        const simple_proxy = {port: 24024};
        t('cli only', {cli: simple_proxy, config: []},
            [assign({}, simple_proxy, {persist: true})]);
        t('main config only', {config: simple_proxy},
            [assign({}, simple_proxy, {persist: true})]);
        t('config file', {files: [simple_proxy]}, [simple_proxy]);
        t('config override cli', {cli: simple_proxy, config: {port: 24042}},
            [assign({}, simple_proxy, {persist: true, port: 24042})]);
        const multiple_proxies = [
            assign({}, simple_proxy, {port: 25025}),
            assign({}, simple_proxy, {port: 26026}),
            assign({}, simple_proxy, {port: 27027}),
        ];
        t('multiple config files', {files: multiple_proxies},
            multiple_proxies);
        t('main + config files', {config: simple_proxy,
            files: multiple_proxies}, [].concat([assign({}, simple_proxy,
            {persist: true})], multiple_proxies));
    });
    describe('dropin', ()=>{
        const t = (name, args, expected)=>it(name, etask._fn(
        function*(_this){
            _this.timeout(4000);
            app = yield app_with_args(args);
            let proxies = yield json('api/proxies_running');
            assert_has(proxies, expected, 'proxies');
        }));

        t('default', [], [{port: 24000}]);
        t('off', ['--no-dropin'], [{port: 24000}]);
        it('on', ()=>etask(function*(){
            try {
                app = yield app_with_args(['--dropin']);
                let proxies = yield json('api/proxies_running');
                assert_has(proxies, [{port: 22225}, {port: 24000}], 'proxies');
            } catch(e){
                if (e instanceof assert.AssertionError)
                    throw e;
            }
        }));
    });
    describe('api', ()=>{
        it('ssl', ()=>etask(function*(){
            app = yield app_with_args();
            let res = yield api('ssl');
            assert_has(res.headers, {
                'content-type': 'application/x-x509-ca-cert',
                'content-disposition': 'filename=luminati.crt',
            }, 'headers');
            assert.equal(res.body, fs.readFileSync(path.join(__dirname,
                'bin/ca.crt')), 'certificate');
        }));
        describe('version info', ()=>{
            it('current', ()=>etask(function*(){
                app = yield app_with_args();
                const body = yield json('api/version');
                assert.equal(body.version, pkg.version);
            }));
        });
        describe('proxies', ()=>{
            it('new', ()=>etask(function*(){
                app = yield app_with_args(['--mode', 'root']);
                const before = yield json('api/proxies_running');
                assert.equal(before.length, 1);
                const proxy = {port: 24001};
                const res = yield json('api/proxies', 'POST', {proxy});
                assert_has(res, proxy, 'proxies');
                const after = yield json('api/proxies_running');
                assert.equal(after.length, 2);
                assert_has(after[1], proxy, 'proxies_running');
            }));
        });
    });
    describe('crash on load error', ()=>{
        const t = (name, proxies)=>it(name, ()=>etask(function*(){
            try {
                app = yield app_with_proxies(proxies);
                assert.fail('Should crash');
            } catch(e){
                if (e instanceof assert.AssertionError)
                    throw e;
            }
        }));
        t('conflict proxy port', [
            {port: 24024},
            {port: 24024},
        ]);
        t('conflict socks port', [
            {port: 24000, socks: 25000},
            {port: 24001, socks: 25000},
        ]);
        t('conflict with www', [{port: Manager.default.www}]);
    });
});
