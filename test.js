// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, mocha:true*/
const _ = require('lodash');
const analytics = require('./lib/analytics.js');
const assert = require('assert');
const http = require('http');
const https = require('https');
const net = require('net');
const url = require('url');
const path = require('path');
const os = require('os');
const fs = require('fs');
const socks = require('@luminati-io/socksv5');
const ssl = require('./lib/ssl.js');
const request = require('request');
const nock = require('nock');
const lolex = require('lolex');
const etask = require('./util/etask.js');
const restore_case = require('./util/http_hdr.js').restore_case;
const qw = require('./util/string.js').qw;
const assign = Object.assign;
const zerr = require('./util/zerr.js');
const sinon = require('sinon');
const zsinon = require('./util/sinon.js');
const lpm_config = require('./util/lpm_config.js');
const lpm_util = require('./util/lpm_util.js');
const lpm_file = require('./util/lpm_file.js');
const Luminati = require('./lib/luminati.js');
const Manager = require('./lib/manager.js');
const Timeline = require('./lib/timeline.js');
const pkg = require('./package.json');
const username = require('./lib/username.js');
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

const mock_json = status=>{
    return opt=>{
        return {status, body: {opt, mock: true}};
    };
};

const pre_rule = (type, regex)=>({
    rules: {pre: [{action: type, url: regex||'.*'}]},
});

const http_proxy = port=>etask(function*(){
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
            res.writeHead(status,
                {'content-type': 'application/json', 'x-hola-response': 1});
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
                    (_req, _res, _head)=>{
                        _.defaults(_req.headers,
                            headers[_req.socket.remotePort]||{});
                        handler(_req, _res, _head);
                    }
                );
                yield etask.nfn_apply(proxy.https, '.listen', [0]);
            }
            _url = '127.0.0.1:'+proxy.https.address().port;
        }
        let req_port;
        res.write(`HTTP/1.1 200 OK\r\nx-hola-ip: ${to_body(req).ip}\r\n\r\n`);
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
        yield etask.nfn_apply(_this.http, '.close', []);
        if (_this.https)
            yield etask.nfn_apply(_this.https, '.close', []);
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
const http_ping = ()=>etask(function*(){
    let ping = {history: []};
    const handler = (req, res)=>{
        let body = to_body(req);
        ping.history.push(body);
        res.writeHead(200, 'PONG', {'content-type': 'application/json'});
        if (req.headers['content-length'])
            req.pipe(res);
        else
        {
            res.write(JSON.stringify(body));
            res.end();
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
    const _https = https.createServer(ssl(), handler);
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
after('after all', ()=>etask._fn(function*after(_this){
    _this.timeout(3000);
    if (proxy)
        yield proxy.stop();
    proxy = null;
    if (ping)
        yield ping.stop();
    ping = null;
}));
describe('proxy', ()=>{
    const test_url = {http: 'http://lumtest.com/test',
        https: 'https://lumtest.com/test'};
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
        }, opt), {send_rule_mail: function(){}, rmt_cfg: {get: ()=>({})}});
        l.test = etask._fn(function*(_this, req_opt){
            if (typeof req_opt=='string')
                req_opt = {url: req_opt};
            req_opt = req_opt||{};
            req_opt.url = req_opt.url||test_url.http;
            req_opt.json = true;
            req_opt.rejectUnauthorized = false;
            return yield etask.nfn_apply(_this, '.request',
                [req_opt]);
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
        if (req.url!=test_url.http)
            return next();
        waiting.push(next);
    };
    beforeEach(()=>{
        proxy.history = [];
        proxy.full_history = [];
        waiting = [];
        ping.history = [];
    });
    afterEach('after each', ()=>etask(function*(){
        if (!l)
            return;
        yield l.stop(true);
        l = null;
    }));
    describe('sanity', ()=>{
        const t = (name, req, opt)=>it(name, ()=>etask._fn(function*(_this){
            _this.timeout(5000);
            proxy.fake = false;
            req = req();
            l = yield lum(opt);
            let res = yield l.test(req);
            assert.equal(ping.history.length, 1);
            let expected = {statusCode: 200, statusMessage: 'PONG'};
            if (req.body)
                assign(expected, {body: req.body});
            assert_has(res, expected, 'res');
        }));
        t('http', ()=>ping.http.url);
        t('http post', ()=>{
            return {url: ping.http.url, method: 'POST', body: 'test body'};
        });
        t('https', ()=>ping.https.url, {ssl: false});
        t('https post', ()=>{
            return {url: ping.https.url, method: 'POST', body: 'test body'};
        }, {ssl: false});
        t('https sniffing', ()=>ping.https.url, {insecure: true});
        t('https sniffing post', ()=>{
            return {url: ping.https.url, method: 'POST', body: 'test body'};
        }, {insecure: true});
    });
    describe('headers', ()=>{
        describe('X-Hola-Agent', ()=>{
            it('added to super proxy request', ()=>etask(function*(){
                l = yield lum();
                yield l.test();
                assert.equal(proxy.history.length, 1);
                assert.equal(proxy.history[0].headers['x-hola-agent'],
                    'proxy='+lpm_config.version+' node='+process.version
                        +' platform='+process.platform);
            }));
            it('not added when accessing site directly', ()=>etask(function*(){
                l = yield lum(pre_rule('bypass_proxy'));
                let res = yield l.test(ping.http.url);
                assert.ok(!res.body.headers['x-hola-agent']);
            }));
        });
        describe('X-Hola-Context', ()=>{
            let history;
            const aggregator = data=>history.push(data);
            const t = (name, _url, opt, target, skip_res)=>it(name, ()=>etask(
            function*(){
                const context = 'context-1';
                history = [];
                l = yield lum(assign({handle_usage: aggregator}, opt));
                let res = yield l.test({
                    url: _url(),
                    headers: {'x-hola-context': context},
                });
                if (!skip_res)
                    assert.equal(res.headers['x-hola-context'], context);
                if (target)
                {
                    const target_req = target();
                    assert.equal(target_req['x-hola-context'], undefined);
                }
                yield etask.sleep(400);
                assert.equal(history.length, 1);
                assert.equal(history[0].context, context);
            }));
            t('bypass proxy', ()=>ping.http.url, pre_rule('bypass_proxy'),
                ()=>ping.history[0]);
            t('http', ()=>test_url.http, {}, ()=>proxy.history[0]);
            t('https sniffing', ()=>ping.https.url,
                {insecure: true, ssl: true}, ()=>proxy.history[0]);
            t('https connect', ()=>ping.https.url, {insecure: true, ssl: true},
                ()=>proxy.history[0]);
        });
        describe('keep letter caseing and order', ()=>{
            const t = (name, _url, opt)=>it(name, ()=>etask(function*(){
                const headers = {
                    'Keep-Alive': 'Close',
                    'X-Just-Testing': 'value',
                    'X-bizzare-Letter-cAsE': 'test',
                };
                l = yield lum(opt);
                const res = yield l.test({url: _url(), headers});
                const site_headers = _.omit(res.body.headers,
                    qw`proxy-authorization x-hola-agent`);
                assert_has(site_headers, headers, 'value');
                assert_has(Object.keys(site_headers), Object.keys(headers),
                    'order');
            }));
            t('http', ()=>test_url.http);
            t('https', ()=>ping.https.url, {ssl: false});
            t('https sniffing', ()=>ping.https.url, {insecure: true});
            t('bypass http', ()=>ping.http.url, pre_rule('bypass_proxy'));
            t('bypass https', ()=>ping.https.url, Object.assign(
                pre_rule('bypass_proxy'), {ssl: false}));
            t('bypass https sniffing', ()=>ping.https.url+'?match',
                Object.assign(pre_rule('bypass_proxy', 'match'),
                {insecure: true}));
        });
    });
    it('Listening without specifing port', ()=>etask(function*(){
        l = yield lum({port: false});
        yield l.test();
        assert.equal(proxy.history.length, 1);
    }));
    describe('options', ()=>{
        describe('passthrough', ()=>{
            it('authentication passed', ()=>etask(function*(){
                l = yield lum({pool_size: 3});
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
        describe('short_username', ()=>{
            const t = (name, user, short, expected)=>it(name, ()=>etask(
            function*(){
                l = yield lum({short_username: short});
                const res = yield l.test({headers: {
                    'proxy-authorization': 'Basic '+
                        (new Buffer(user+':pass'))
                        .toString('base64'),
                }});
                let m = res.body.headers['proxy-authorization']
                    .match(/^Basic (.*)/);
                let h = new Buffer(m[1], 'base64').toString('ascii');
                let parts = h.split(':');
                assert_has(res.body.auth, expected);
                if (short)
                    assert.ok(parts[0].length <= user.length);
                else
                    assert.ok(parts[0].length >= user.length);
            }));
            t(
                'short notation',
                'lum-cu-ttt-z-zzz-d-s-sss-to-5-dbg-full-cy-us-st-fl-ct-miami',
                true,
                {
                    customer: 'ttt',
                    zone: 'zzz',
                    direct: true,
                    session: 'sss',
                    debug: 'full',
                    country: 'us',
                    state: 'fl',
                    city: 'miami',
                }
            );
            t(
                'long notation',
                'lum-cu-ttt-z-zzz-d-s-sss-to-5-dbg-full-cy-us-st-fl-ct-miami',
                false,
                {
                    customer: 'ttt',
                    zone: 'zzz',
                    direct: true,
                    session: 'sss',
                    debug: 'full',
                    country: 'us',
                    state: 'fl',
                    city: 'miami',
                }
            );
        });
        describe('pool', ()=>{
            describe('pool_size', ()=>{
                const t = pool_size=>it(''+pool_size, ()=>etask(function*(){
                    l = yield lum({pool_size, pool_type: 'round-robin'});
                    yield l.test();
                    assert.equal(proxy.history.length, 1);
                    assert.equal(proxy.history[0].url, test_url.http);
                    assert.equal(proxy.full_history.length, 1);
                    assert.equal(l.session_mgr.sessions.sessions.length,
                        pool_size);
                    let sessions = {};
                    for (let i=0; i<pool_size; i++)
                    {
                        let s = l.session_mgr.sessions.sessions[i];
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
                        yield l.session_mgr.refresh_sessions();
                        let max_requests = l.session_mgr.sessions.sessions
                            .map(s=>s.max_requests);
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
                    assert.equal(l.session_mgr.max_requests, 0);
                }));
                const test_call = ()=>etask(function*(){
                    const res = yield l.test();
                    assert.ok(res.body);
                    assert.ok(res.body.auth);
                    return res.body.auth.session;
                });
                const t = (name, opt)=>it(name, etask._fn(function*(_this){
                    _this.timeout(12000);
                    const pool_size = opt.pool_size||1;
                    const max_requests = opt.max_requests;
                    l = yield lum(opt);
                    const sessions = [];
                    for (let i=0; i<pool_size; i++)
                    {
                        sessions[i] = sessions[i]||[];
                        for (let j=0; j<max_requests; j++)
                        {
                            const s = yield test_call();
                            sessions[i][j] = s;
                        }
                    }
                    for (let i=0; i<pool_size; i++)
                    {
                        const s = sessions[i][0];
                        for (let j=1; j<max_requests; j++)
                            assert.equal(s, sessions[i][j]);
                    }
                    for (let j=1; j<pool_size; j++)
                        assert.notEqual(sessions[j-1][0], sessions[j][0]);
                }));
                t('1, round-robin pool', {max_requests: 1, pool_size: 1,
                    pool_type: 'round-robin'});
                t('2, round-robin pool', {max_requests: 2, pool_size: 2,
                    pool_type: 'round-robin'});
                t('5, round-robin pool', {max_requests: 5, pool_size: 5,
                    pool_type: 'round-robin'});
                t('1, sequential pool', {max_requests: 1, pool_size: 1});
                t('2, sequential pool', {max_requests: 2, pool_size: 2});
                t('5, sequential pool', {max_requests: 5, pool_size: 5});
                t('1, sticky_ip', {max_requests: 1, sticky_ip: true});
                t('2, sticky_ip', {max_requests: 2, sticky_ip: true});
                t('5, sticky_ip', {max_requests: 5, sticky_ip: true});
                t('1, session using seed', {max_requests: 1, session: true});
                t('2, session using seed', {max_requests: 2, session: true});
                t('5, session using seed', {max_requests: 5, session: true});
                it('no pool size', etask._fn(function*(_this){
                    _this.timeout(4000);
                    l = yield lum({max_requests: 1, pool_size: 0,
                        session: true});
                    const s1 = yield test_call();
                    const s2 = yield test_call();
                    assert.notEqual(s1, s2);
                }));
            });
            describe('keep_alive', ()=>{
                const t = (name, opt)=>it(name, etask._fn(function*(_this){
                    _this.timeout(6000);
                    l = yield lum(assign({keep_alive: 1}, opt)); // actual 1sec
                    yield l.test();
                    const s_f = proxy.full_history.length;
                    const s_h = proxy.history.length;
                    yield etask.sleep(500);
                    assert.equal(proxy.full_history.length, 0 + s_f);
                    assert.equal(proxy.history.length, 0 + s_h);
                    yield l.test();
                    assert.equal(proxy.full_history.length, 1 + s_f);
                    assert.equal(proxy.history.length, 1 + s_h);
                    yield etask.sleep(1500);
                    assert.equal(proxy.full_history.length, 2 + s_f);
                    assert.equal(proxy.history.length, 1 + s_h);
                }));
                t('pool', {pool_size: 1});
                t('sticky_ip', {sticky_ip: true});
                t('session explicit', {session: 'test'});
                t('session using seed', {session: true, seed: 'seed'});
            });
            describe('session_duration', ()=>{
                describe('change after specified timeout', ()=>{
                    const t = (name, opt)=>it(name, etask._fn(function*(_this){
                        _this.timeout(4000);
                        l = yield lum(assign({session_duration: 1}, opt));
                        const initial = yield l.test();
                        yield etask.sleep(1500);
                        const second = yield l.test();
                        assert.notEqual(initial.body.auth.session,
                            second.body.auth.session);
                    }));
                    t('pool', {pool_size: 1});
                    t('sticky_ip', {sticky_ip: true});
                    t('session using seed', {session: true, seed: 'seed'});
                });
                describe('does not change before specified timeout', ()=>{
                    const t = (name, opt)=>it(name, etask._fn(function*(_this){
                        _this.timeout(4000);
                        l = yield lum(assign({session_duration: 1}, opt));
                        const initial = yield l.test();
                        yield etask.sleep(500);
                        const res1 = yield l.test();
                        const res2 = yield l.test();
                        assert.equal(initial.body.auth.session,
                            res1.body.auth.session);
                        assert.equal(initial.body.auth.session,
                            res2.body.auth.session);
                    }));
                    t('pool', {pool_size: 1});
                    t('sticky_ip', {sticky_ip: true});
                    t('session using seed', {session: true, seed: 'seed'});
                });
            });
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
        describe('luminati params', ()=>{
            const t = (name, target, expected)=>it(name, ()=>etask(function*(){
                expected = expected||target;
                l = yield lum(target);
                const res = yield l.test();
                assert_has(res.body.auth, expected);
            }));
            t('auth', {customer: 'a', password: 'p'});
            t('zone', {zone: 'abc'});
            t('country', {country: 'il'});
            t('city', {country: 'us', state: 'ny', city: 'newyork'});
            t('static', {zone: 'static', ip: '127.0.0.1'});
            t('ASN', {zone: 'asn', asn: 28133});
            t('mobile', {zone: 'mobile', mobile: 'true'});
            t('DNS', {dns: 'local'});
            t('debug', {debug: 'none'});
            t('raw', {raw: true});
            t('direct', pre_rule('direct'), {direct: true});
            t('session explicit', {session: 'test_session'});
            t('session using seed', {session: true, seed: 'seed'},
                {session: 'seed_1'});
            describe('lower case and spaces', ()=>{
                t('long', {state: 'NY', city: 'New York'},
                    {state: 'ny', city: 'newyork'});
                t('short',
                    {state: 'NY', city: 'New York', short_username: true},
                    {state: 'ny', city: 'newyork'});
            });
            it('explicit any', ()=>etask(function*(){
                const any_auth = {country: '*', state: '*', city: '*'};
                l = yield lum(any_auth);
                const res = yield l.test();
                const auth_keys = Object.keys(res.body.auth);
                Object.keys(any_auth).forEach(k=>
                    assert.ok(!auth_keys.includes(k)));
            }));
        });
        describe('socks', ()=>{
            const t = (name, _url)=>it(name, etask._fn(function*(_this){
                _this.timeout(30000);
                l = yield lum({port: 25000});
                let res = yield etask.nfn_apply(request, [{
                    agent: new socks.HttpAgent({
                        proxyHost: '127.0.0.1',
                        proxyPort: 25000,
                        auths: [socks.auth.None()],
                    }),
                    url: _url,
                }]);
                let body = JSON.parse(res.body);
                assert.equal(body.url, _url);
            }));
            t('http', test_url.http);
        });
        describe('throttle', ()=>{
            const t = throttle=>it(''+throttle, etask._fn(function*(_this){
                _this.timeout(3000);
                let requests = [];
                proxy.connection = hold_request;
                l = yield lum({throttle});
                repeat(2*throttle, ()=>requests.push(l.test()));
                yield etask.sleep(300);
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
            t(5);
        });
        describe('refresh_sessions', ()=>{
            const test_session = session=>etask(function*(){
                let res = yield l.test();
                let auth = res.body.auth;
                assert.ok(session.test(auth.session));
            });
            const t1 = (name, opt, before, after)=>it(name, ()=>etask(
            function*(){
                l = yield lum(opt);
                yield test_session(before);
                yield l.session_mgr.refresh_sessions();
                yield test_session(after);
            }));
            t1('pool', {pool_size: 1}, /24000_[0-9a-f]+_1/,
                /24000_[0-9a-f]+_2/);
            t1('sticky_ip', {sticky_ip: true}, /24000_127_0_0_1_[0-9a-f]+_1/,
                /24000_127_0_0_1_[0-9a-f]+_2/);
            t1('session using seed', {session: true, seed: 'seed'},
                /seed_1/, /seed_2/);
            const t2 = (name, opt, test)=>it(name, ()=>etask(function*(){
                l = yield lum(opt);
                assert.ok(!l.sessions);
                yield l.session_mgr.refresh_sessions();
                let pre =l.session_mgr.sessions.sessions.map(s=>s.session);
                yield l.session_mgr.refresh_sessions();
                let after =l.session_mgr.sessions.sessions.map(s=>s.session);
                test(pre, after);
            }));
            t2('round-robin', {pool_size: 3, pool_type: 'round-robin'},
                (pre, after)=>after.forEach(a=>pre.forEach(
                    p=>assert.notEqual(p, a))));
            t2('sequential', {pool_size: 3}, (pre, after)=>{
                let first = pre.shift();
                after.forEach(a=>assert.notEqual(a, first));
                assert_has(after, pre);
            });
        });
        describe('history aggregation', ()=>{
            let clock;
            before(()=>clock = lolex.install({shouldAdvanceTime: true,
                advanceTimeDelta: 10, toFake: qw`setTimeout clearTimeout
                setInterval clearInterval setImmediate clearImmediate`}));
            after('after history aggregation', ()=>clock.uninstall());
            let history;
            const aggregator = data=>history.push(data);
            beforeEach(()=>history = []);
            const t = (name, _url, expected, opt)=>it(name, ()=>etask(
            function*(){
                ping.headers = ping.headers||{};
                ping.headers.connection = 'close';
                l = yield lum(assign({history: true,
                    handle_usage: aggregator}, opt));
                assert.equal(history.length, 0);
                let res = yield l.test(_url());
                yield etask.sleep(400);
                res.socket.destroy();
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
                url: 'localhost:'+ping.https.port,
                method: 'CONNECT',
            }), {insecure: true, ssl: false});
            t('https sniffing', ()=>ping.https.url, ()=>({
                port: 24000,
                method: 'GET',
                url: ping.https.url,
            }), {insecure: true, ssl: true});
            t('bypass http', ()=>ping.http.url, ()=>({
                port: 24000,
                url: ping.http.url,
                method: 'GET',
                super_proxy: null,
            }), pre_rule('bypass_proxy'));
            t('bypass https', ()=>ping.https.url, ()=>({
                port: 24000,
                url: ping.https.url,
                method: 'CONNECT',
                super_proxy: null,
            }), Object.assign(pre_rule('bypass_proxy'),
                {insecure: true, ssl: false}));
            t('null_response', ()=>ping.http.url, ()=>({
                port: 24000,
                status_code: 200,
                status_message: 'NULL',
                super_proxy: null,
                content_size: 0,
            }), pre_rule('null_response'));
            it('pool', etask._fn(function*(_this){
                const one_each_aggregator = data=>{
                    if (!history.some(_.matches({context: data.context})))
                        history.push(data);
                };
                l = yield lum({pool_size: 1, keep_alive: 0.01,
                    handle_usage: one_each_aggregator});
                yield l.test();
                yield etask.sleep(400);
                assert_has(history, [
                    {context: 'RESPONSE'},
                    {context: 'SESSION KEEP ALIVE'},
                ]);
                assert.equal(history.length, 2);
            }));
        });
        describe('whitelist', ()=>{
            it('http', etask._fn(function*(){
                l = yield lum();
                let res = yield l.test({url: test_url.http});
                assert.equal(res.statusCode, 200);
            }));
            it('http reject', etask._fn(function*(){
                l = yield lum({whitelist_ips: ['1.1.1.1']});
                let res = yield l.test({url: test_url.http});
                assert.equal(res.statusCode, 403);
                assert.equal(res.body, undefined);
            }));
            it('https', etask._fn(function*(){
                l = yield lum();
                let res = yield l.test({url: test_url.https});
                assert.equal(res.statusCode, 200);
            }));
            it('https reject', etask._fn(function*(){
                l = yield lum({whitelist_ips: ['1.1.1.1']});
                let error;
                try {
                    yield l.test({url: test_url.https});
                } catch(e){ error = e.toString(); }
                assert(error.includes('tunneling socket could not be '
                +'established, statusCode=403'));
            }));
            it('socks http', etask._fn(function*(){
                l = yield lum();
                let res = yield etask.nfn_apply(request, [{
                    agent: new socks.HttpAgent({
                        proxyHost: '127.0.0.1',
                        proxyPort: l.port,
                        auths: [socks.auth.None()],
                    }),
                    rejectUnauthorized: false,
                    url: test_url.http,
                }]);
                assert.equal(res.statusCode, 200);
            }));
            it('socks http reject', etask._fn(function*(){
                l = yield lum({whitelist_ips: ['1.1.1.1']});
                let res = yield etask.nfn_apply(request, [{
                    agent: new socks.HttpAgent({
                        proxyHost: '127.0.0.1',
                        proxyPort: l.port,
                        auths: [socks.auth.None()],
                    }),
                    rejectUnauthorized: false,
                    url: test_url.http,
                }]);
                assert.equal(res.statusCode, 403);
            }));
            it('socks https', etask._fn(function*(){
                l = yield lum();
                let res = yield etask.nfn_apply(request, [{
                    agent: new socks.HttpsAgent({
                        proxyHost: '127.0.0.1',
                        proxyPort: l.port,
                        auths: [socks.auth.None()],
                    }),
                    rejectUnauthorized: false,
                    url: test_url.https,
                }]);
                assert.equal(res.statusCode, 200);
            }));
            it('socks https reject', etask._fn(function*(){
                l = yield lum({whitelist_ips: ['1.1.1.1']});
                let error;
                try {
                    yield etask.nfn_apply(request, [{
                        agent: new socks.HttpsAgent({
                            proxyHost: '127.0.0.1',
                            proxyPort: l.port,
                            auths: [socks.auth.None()],
                        }),
                        rejectUnauthorized: false,
                        url: test_url.https,
                    }]);
                } catch(e){ error = e.toString(); }
                assert(error.includes('Client network socket disconnected '
                +'before secure TLS connection was established'));
            }));
        });
    });
    describe('retry', ()=>{
        it('should set rules', ()=>etask(function*(){
            l = yield lum({rules: true, _rules: {res: {}}});
            assert.ok(l.rules);
        }));
        const t = (name, arg, rules=false, c=0)=>it(name,
        etask._fn(function*(_this){
            rules = rules||{post: [{res: [{
                    action: {ban_ip: '60min', retry: true},
                    head: true,
                    status: {arg, type: 'in'},
                }], url: 'lumtest.com'}],
            };
            l = yield lum({rules});
            let old_req = l._request;
            let retry_count = 0;
            l._request = function(req, res){
                if (req.retry)
                    retry_count++;
                return old_req.apply(l, arguments);
            };
            let r = yield l.test();
            yield etask.sleep(20);
            assert.equal(retry_count, c);
            return r;
        }));
        t('should retry when status match', '200 - Succeeded requests', null,
            1);
        t('should ignore rule when status does not match', null,
            '404 - Succeeded requests', 0);
        t('should prioritize', null, {post: [{res:
            [{action: {url: 'http://lumtest.com/fail_url'},
            head: true, status: {arg: '200', type: 'in'}}],
            url: 'lumtest.com/test'}, {res: [{action:
            {ban_ip: '60min', retry: true}, head: true, status: {arg: '200',
            type: 'in'}}], url: 'lumtest.com/test', priority: 1}]}, 1);
    });
    describe('rules', ()=>{
        it('should process data', ()=>etask(function*(){
            l = yield lum({rules: true, _rules: {res: {}}});
            const html = `
              <body>
                <div>
                  <p id="priceblock_ourprice">$12.99</p>
                </div>
              </body>`;
            const process_rules = {price: `$('#priceblock_ourprice').text()`};
            const req = {ctx: {response: {}}};
            const _res = {headers: {'content-encoding': 'gzip'}};
            l.rules.process_response(req, _res, process_rules, html, {});
            assert.ok(!_res.headers['content-encoding']);
            assert.equal(_res.headers['content-type'],
                'application/json; charset=utf-8');
            const new_body = JSON.parse(req.ctx.response.body.toString());
            assert.deepEqual(new_body, {price: '$12.99'});
        }));
        it('should process data with error', ()=>etask(function*(){
            l = yield lum({rules: true, _rules: {res: {}}});
            const html = `
              <body>
                <div>
                  <p id="priceblock_ourprice">$12.99</p>
                </div>
              </body>`;
            const process_rules = {price: 'a-b-v'};
            const req = {ctx: {response: {}}};
            const _res = {headers: {'content-encoding': 'gzip'}};
            l.rules.process_response(req, _res, process_rules, html, {});
            assert.ok(!_res.headers['content-encoding']);
            assert.equal(_res.headers['content-type'],
                'application/json; charset=utf-8');
            const new_body = JSON.parse(req.ctx.response.body.toString());
            assert.deepEqual(new_body, {price: {context: 'a-b-v',
                error: 'processing data', message: 'a is not defined'}});
        }));
        it('check cmp', ()=>etask(function*(){
            l = yield lum({rules: true, _rules: {res: {}}});
            const t = (rule, value, expected)=>{
                const r = l.rules.cmp(rule, value);
                assert.equal(r, expected);
            };
            t(null, null, false);
            t({type: '==', name: 'v', arg: 'test'}, {v: 'test'}, true);
            t({type: '==', name: 'v', arg: 'test'}, {v: 'not test'}, false);
            t({type: '!=', name: 'v', arg: 'test'}, {v: 'not test'}, true);
            t({type: '!=', name: 'v', arg: 'test'}, {v: 'test'}, false);
            t({type: '=~', name: 'v', arg: '^test$'}, {v: 'test'}, true);
            t({type: '=~', name: 'v', arg: '^test$'}, {v: 'not test'}, false);
            t({type: '!~', name: 'v', arg: '^test$'}, {v: 'not test'}, true);
            t({type: '!~', name: 'v', arg: '^test$'}, {v: 'test'}, false);
            t({type: 'in', name: 'v', arg: ['test']}, {v: 'test'}, true);
            t({type: 'in', name: 'v', arg: ['test']}, {v: 'not test'}, false);
            t({type: '!in', name: 'v', arg: ['test']}, {v: 'not test'}, true);
            t({type: '!in', name: 'v', arg: ['test']}, {v: 'test'}, false);
            t({type: 'invalid'}, null, false);
            t([{type: '==', name: 'v', arg: 'test'}, {type: '==', name: 'v',
              arg: 'test'}], {v: 'not test'}, false);
            t([{type: '==', name: 'v', arg: 'test'}, {type: '==', name: 'v2',
              arg: 'test'}], {v: 'not test', v2: 'test'}, true);
            t([{type: '==', name: 'v', arg: 'test'}, {type: '==', name: 'v2',
              arg: 'test'}, {type: '==', name: 'v', arg: 'test'}],
              {v: 'not test', v2: 'test'}, true);
        }));
        it('check get_time', ()=>etask(function*(){
            l = yield lum({rules: true, _rules: {res: {}}});
            const t = (_t, expected)=>{
                const r = l.rules.get_time(_t);
                assert.equal(r, expected);
            };
            t(undefined, 0);
            t(null, 0);
            t('', 0);
            t(123, 123);
            t(123.21, 0);
            t('0', 0);
            t('teststse', 0);
            t('123.21', 0);
            t('123', 123);
            t('121ms', 121);
            t('1sec', 1000);
            t('11min', 660000);
            t('12hr', 43200000);
            t('21day', 1814400000);
        }));
        it('check _url_regexp', ()=>etask(function*(){
            l = yield lum({rules: true, _rules: {res: {}}});
            const t = (reg, s, expected)=>{
                const r = l.rules._url_regexp(reg);
                assert.equal(r.test(s), expected);
            };
            t(undefined, '', true);
            t('*', '', true);
            t('**', '', true);
            t('[-]+', '', false);
            t('[-]+', '--', true);
            t('\\', '', false);
        }));
        it('check _can_retry', ()=>etask(function*(){
            l = yield lum({rules: true, _rules: {res: {}}});
            const t = (req, rule, expected)=>{
                const r = l.rules._can_retry(req, {}, rule);
                assert.equal(r, expected);
            };
            t({retry: 0}, {action: 'test'}, false);
            t({retry: 0}, {action: 'retry'}, true);
            t({retry: 0}, {action: 'retry_port'}, true);
            const port_stub = sinon.stub(l, 'get_other_port').returns(false);
            t({retry: 0}, {action: 'retry_port', retry_port: 1}, false);
            port_stub.returns(l);
            t({retry: 0}, {action: 'retry_port', retry_port: 1}, true);
            t({retry: 5}, {action: 'retry_port'}, false);
        }));
        it('check retry', ()=>etask(function*(){
            l = yield lum({rules: true, _rules: {res: {}}});
            sinon.stub(l, 'get_other_port').returns(l);
            const _req = {ctx: {response: {}, url: 'lumtest.com', log: l.log,
                proxies: []}};
            const req_stub = sinon.stub(l, '_request', req=>{
                assert.deepEqual(req, _req);
            });
            l.rules.retry(_req, {}, {}, l.port);
            assert.equal(_req.retry, 1);
            assert.ok(req_stub.called);
            l.rules.retry(_req, {}, {}, l.port);
            assert.equal(_req.retry, 2);
        }));
        it('check _action', ()=>etask(function*(){
            l = yield lum({rules: true, _rules: {res: {}}});
            sinon.stub(l.rules, 'gen_session').returns('test');
            const can_stub = sinon.stub(l.rules, '_can_retry').returns(false);
            const retry_stub = sinon.stub(l.rules, 'retry');
            const req = {};
            let r = l.rules._action(req, {}, {});
            assert.ok(!r);
            assert.notEqual(req.session, 'test');
            assert.ok(!retry_stub.called);
            can_stub.returns(true);
            r = l.rules._action(req, {}, {});
            assert.ok(r);
            assert.equal(req.session, 'test');
            assert.ok(retry_stub.called);
        }));
        it('check check_req_time_range', ()=>etask(function*(){
            let _date = '2013-08-13 14:00:00';
            zsinon.clock_set({now: _date});
            l = yield lum({rules: true, _rules: {res: {}}});
            const rs_stub = sinon.stub(l.session_mgr,
                'remove_session_from_pool');
            let r = l.rules.check_req_time_range({}, {});
            assert.ok(!r);
            assert.ok(!rs_stub.called);
            r = l.rules.check_req_time_range({ctx: {pool_key: 'test',
                timeline: {req: {create: Date.now() - 40}}}}, {
                max_req_time: 41});
            assert.ok(r);
            assert.ok(!rs_stub.called);
            r = l.rules.check_req_time_range({ctx: {pool_key: 'test',
                timeline: {req: {create: Date.now() - 40}}}}, {
                max_req_time: 39});
            assert.ok(!r);
            assert.ok(!rs_stub.called);
            r = l.rules.check_req_time_range({ctx: {pool_key: 'fast_pool',
                timeline: {req: {create: Date.now() - 40}}}}, {
                max_req_time: 39});
            assert.ok(!r);
            assert.ok(rs_stub.called);
            zsinon.clock_restore();
        }));
        it('check can_retry', ()=>etask(function*(){
            l = yield lum({rules: true, _rules: {res: {}}});
            sinon.stub(l, 'get_other_port').returns(l);
            let r = l.rules.can_retry({});
            assert.ok(r);
            r = l.rules.can_retry({retry: 2}, {}, {retry: 5});
            assert.ok(r);
            r = l.rules.can_retry({retry: 5});
            assert.ok(!r);
            r = l.rules.can_retry({retry: 3}, {}, {refresh_ip: false,
                retry: 5});
            assert.ok(r);
            r = l.rules.can_retry({retry: 3}, {}, {refresh_ip: false,
                retry: true});
            assert.ok(!r);
            r = l.rules.can_retry({retry: 3}, {}, {refresh_ip: true,
                retry: true});
            assert.ok(!r);
        }));
        it('check post_timeout', ()=>etask(function*(){
            l = yield lum({rules: {post: [
                {res: [{timeout: 1}], url: 'test'}]}});
            sinon.stub(l.rules, 'action').returns(true);
            const t = (req, expected)=>{
                const r = l.rules.post_timeout(req, {}, {});
                assert.equal(r, expected);
            };
            t({ctx: {h_context: 'STATUS CHECK'}}, undefined);
            t({ctx: {}, url: 'invalid'}, undefined);
            t({ctx: {}, url: 'test.com'}, true);
        }));
        it('check post_need_body', ()=>etask(function*(){
            l = yield lum({rules: {post: [
                {res: [], url: 'test'}]}});
            const t = (req, expected)=>{
                const r = l.rules.post_need_body(req);
                assert.equal(r, expected);
            };
            t({ctx: {url: 'invalid'}}, false);
            t({ctx: {url: 'test'}}, false);
            yield l.stop(true);
            l = yield lum({rules: {post: [
                {res: [{body: '1'}], url: 'test'}]}});
            t({ctx: {url: 'test'}}, true);
        }));
        it('check post_body', ()=>etask(function*(){
            l = yield lum({rules: {post: [{res: [{body: 'test',
                action: {process: true}}], url: 'test'}]}});
            const t = (req, _res, body, expected)=>{
                const r = l.rules.post_body(req, {}, {}, _res, body);
                assert.equal(r, expected);
            };
            sinon.stub(l.rules, 'action').returns(true);
            sinon.stub(l.rules, 'process_response');
            const cmp_stub = sinon.stub(l.rules, 'cmp')
                .returns(true);
            t({ctx: {h_context: 'STATUS CHECK'}});
            t({ctx: {url: 'test'}}, {headers: {}},
                '', true);
            cmp_stub.reset();
            cmp_stub.onFirstCall(false).returns(true);
            t({ctx: {url: 'test'}}, {headers: {}},
                '', true);
            cmp_stub.returns(false);
            t({ctx: {url: 'test'}}, {headers: {}},
                '', false);
        }));
        it('check post', ()=>etask(function*(){
            l = yield lum({rules: {post: [{res: [{trigger_type: 'test',
                ipban: true, status: {}}], url: 'test'}]}});
            const t = (req, _res, hdrs_only, expected)=>{
                const r = l.rules.post(req, {}, {}, _res, hdrs_only);
                assert.equal(r, expected);
            };
            t({ctx: {h_context: 'STATUS CHECK'}});
            t({ctx: {url: 'invalid'}});
            t({ctx: {url: 'test'}}, {}, true);
            const crtr_stub = sinon.stub(l.rules, 'check_req_time_range')
                .returns(true);
            sinon.stub(l.rules, 'action').returns(true);
            t({ctx: {url: 'test'}}, {}, false, true);
            crtr_stub.returns(false);
            const bh_stub = sinon.stub(l.banlist, 'has').returns(true);
            t({ctx: {url: 'test'}}, {hola_headers: {
                'x-hola-timeline-debug': '1 2 3'}}, false, true);
            bh_stub.reset();
            sinon.stub(l.rules, 'cmp').returns(true);
            t({ctx: {url: 'test'}}, {}, false, true);
        }));
        describe('action', ()=>{
            it('email, reserve_session, fast_pool_session', ()=>
            etask(function*(){
                l = yield lum({rules: true});
                const cr_stub = sinon.stub(l.rules, 'can_retry')
                    .returns(false);
                const email_stub = sinon.stub(l, '_send_rule_mail');
                const rps_stub = sinon.stub(l.session_mgr,
                    'add_reserve_pool_session');
                const fps_stub = sinon.stub(l.session_mgr,
                    'add_fast_pool_session');
                const r = l.rules.action({ctx: {}}, {}, {}, {}, {email: true,
                    reserve_session: true, fast_pool_session: true}, {
                    res: [{}]});
                assert.ok(!r);
                assert.ok(cr_stub.called);
                assert.ok(email_stub.called);
                assert.ok(rps_stub.called);
                assert.ok(fps_stub.called);
            }));
            it('ban_ip', ()=>etask(function*(){
                l = yield lum({rules: true});
                sinon.stub(l.rules, 'can_retry')
                    .returns(true);
                sinon.stub(l.rules, 'retry');
                sinon.stub(l.rules, 'gen_session').returns('test');
                const add_stub = sinon.stub(l.banlist, 'add').returns('test');
                const req = {ctx: {}};
                const r = l.rules.action(req, {}, {}, {hola_headers: {
                    'x-hola-timeline-debug': '1 2 3'}}, {ban_ip: '1d'});
                assert.ok(r);
                assert.ok(add_stub.called);
                assert.equal(req.session, 'test');

            }));
            it('refresh_ip', ()=>etask(function*(){
                l = yield lum({rules: true});
                sinon.stub(l.rules, 'can_retry')
                    .returns(true);
                sinon.stub(l.rules, 'retry');
                const ref_stub = sinon.stub(l, 'refresh_ip').returns('test');
                const req = {ctx: {}};
                const r = l.rules.action(req, {}, {}, {hola_headers: {
                    'x-hola-timeline-debug': '1 2 3'}}, {refresh_ip: true});
                assert.ok(r);
                assert.ok(ref_stub.called);
                assert.equal(l.refresh_task, 'test');
            }));
            it('url', ()=>etask(function*(){
                l = yield lum({rules: true});
                sinon.stub(l.rules, 'can_retry')
                    .returns(true);
                sinon.stub(l.rules, 'retry');
                const req = {ctx: {}};
                const r = l.rules.action(req, {}, {}, {headers:
                    {location: 'test'}}, {url: 'location'});
                assert.ok(r);
                assert.equal(req.url, 'test');
            }));
            it('session', ()=>etask(function*(){
                l = yield lum({rules: true});
                sinon.stub(l.rules, 'can_retry')
                    .returns(true);
                sinon.stub(l.rules, 'retry');
                sinon.stub(l.rules, 'gen_session').returns('test');
                const req = {ctx: {}};
                const r = l.rules.action(req, {}, {}, {}, {});
                assert.ok(r);
                assert.equal(req.session, 'test');
            }));
        });
        describe('pre', ()=>{
            it('action null_response', ()=>etask(function*(){
                l = yield lum({rules: {res: {}, pre: [
                    {url: '*', action: 'null_response', email: 'test@mail'}
                ]}});
                const send_stub = sinon.stub(l, '_send_rule_mail',
                    (to, trigger, action, _url)=>{
                        assert.equal(to, 'test@mail');
                        assert.deepEqual(trigger, {type: 'URL', value: '*'});
                        assert.equal(action, 'Null response');
                        assert.equal(_url, 'lumtest.com');
                    });
                const _req = {ctx: {response: {}, url: 'lumtest.com',
                    log: l.log, timeline: new Timeline(1)}};
                const _res = {end: sinon.stub(), write: sinon.stub()};
                const r = yield l.rules.pre(_req, _res, {});
                assert.ok(send_stub.called);
                assert.equal(r.status_code, 200);
                assert.equal(r.status_message, 'NULL');
            }));
            it('action direct', ()=>etask(function*(){
                l = yield lum({rules: {res: {}, pre: [
                    {url: '*', action: 'direct', email: 'test@mail'}
                ]}});
                const send_stub = sinon.stub(l, '_send_rule_mail',
                    (to, trigger, action, _url)=>{
                        assert.equal(to, 'test@mail');
                        assert.deepEqual(trigger, {type: 'URL', value: '*'});
                        assert.equal(action, 'Direct super proxy');
                        assert.equal(_url, 'lumtest.com');
                    });
                const _req = {ctx: {response: {}, url: 'lumtest.com',
                    log: l.log, timeline: new Timeline(1)}};
                const _res = {end: sinon.stub(), write: sinon.stub()};
                const r = yield l.rules.pre(_req, _res, {});
                assert.ok(send_stub.called);
                assert.equal(r, undefined);
                assert.ok(_req.ctx.is_direct);
            }));
            it('action switch_port', ()=>etask(function*(){
                l = yield lum({rules: {res: {}, pre: [
                    {url: '*', action: 'switch_port', email: 'test@mail',
                        port: 1}
                ]}});
                const _req = {ctx: {response: {}, url: 'lumtest.com',
                    log: l.log, timeline: new Timeline(1)}};
                const _res = {end: sinon.stub(), write: sinon.stub()};
                const _head = {};
                const get_port_stub = sinon.stub(l, 'get_other_port',
                    port=>{
                        assert.equal(port, 1);
                        return {_request: (req, res, head)=>{
                            assert.deepEqual(req, _req);
                            assert.deepEqual(res, _res);
                            assert.deepEqual(head, _head);
                        }};
                    });
                const r = yield l.rules.pre(_req, _res, _head);
                assert.ok(get_port_stub.called);
                assert.equal(r, 'switched');
            }));
        });
    });
    describe('reserve session', ()=>{
        let history;
        const aggregator = data=>history.push(data);
        let rules;
        beforeEach(etask._fn(function*(_this){
            rules = {post: [{res: [{action: {reserve_session: true, retry:
                false}, head: true, status: {arg: '200', type: 'in'}}],
                url: '**'}]};
            history = [];
            l = yield lum({handle_usage: aggregator, rules,
                session: true, max_requests: 1, reserved_keep_alive: 2});
        }));
        it('should use reserved_sessions', etask._fn(function*(_this){
            _this.timeout(6000);
            for (let i=0; i<5; i++)
            {
                yield l.test();
                yield etask.sleep(100);
            }
            yield l.test({headers: {'x-lpm-reserved': true}});
            yield etask.sleep(400);
            let unames = history.map(h=>h.username);
            assert.notEqual(unames[0], unames[2]);
            assert.equal(unames[unames.length-1], unames[0]);
        }));
        it('should keep reserved session alive', etask._fn(function*(_this){
            _this.timeout(6000);
            yield l.test();
            let hst = history.length;
            assert.ok(hst<=2);
            yield etask.sleep(3000);
            assert.ok(hst < history.length);
        }));
    });
});
describe('manager', ()=>{
    let app, temp_files;
    const get_param = (args, param)=>{
        let i = args.indexOf(param)+1;
        return i ? args[i] : null;
    };
    const app_with_args = (args, only_explicit)=>etask(function*(){
        let manager;
        this.finally(()=>{
            if (this.error && manager)
                return manager.stop(true);
        });
        args = args||[];
        let www = get_param(args, '--www')||Manager.default.www;
        let db_file = temp_file_path('sqlite3');
        if (!only_explicit)
        {
            let log = get_param(args, '--log');
            if (!log)
                args = args.concat(['--log', 'NONE']);
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
            if (!get_param(args, '--dropin'))
              args = args.concat(['--no-dropin']);
            if (!get_param(args, '--cookie')&&!get_param(args, '--no-cookie'))
                args.push('--no-cookie');
        }
        manager = new Manager(lpm_util.init_args(args),
            {bypass_credentials_check: true, skip_ga: true});
        manager.on('error', this.throw_fn());
        yield manager.start();
        let admin = 'http://127.0.0.1:'+www;
        return {manager, admin, db_file};
    });
    const app_with_config = opt=>etask(function*(){
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
        return yield app_with_args(args, opt.only_explicit);
    });
    const app_with_proxies = (proxies, cli)=>etask(function*(){
        return yield app_with_config({config: {proxies}, cli});
    });
    const api = (_path, method, data, json)=>etask(function*(){
        const opt = {
            url: app.admin+'/'+_path,
            method: method||'GET',
            json: json,
            body: data,
        };
        return yield etask.nfn_apply(request, [opt]);
    });
    const api_json = (_path, options)=>etask(function*(){
        let opt = options||{};
        return yield api(_path, opt.method, opt.body, true);
    });
    const json = (_path, method, data)=>etask(function*(){
        const res = yield api(_path, method, data, true);
        assert.equal(res.statusCode, 200);
        return res.body;
    });
    afterEach('after manager', ()=>etask(function*(){
        if (!app)
            return;
        yield app.manager.stop(true);
        if (process.platform=='win32')
            yield etask.sleep(10);
        app.db_file.done();
        app = null;
    }));
    beforeEach(()=>temp_files = []);
    afterEach('after manager 2', ()=>temp_files.forEach(f=>f.done()));
    describe('get_params', ()=>{
        const t = (name, _args, expected)=>it(name, etask._fn(function(_this){
            let mgr = new Manager(lpm_util.init_args(_args), {skip_ga: true});
            assert.deepEqual(expected, mgr.get_params());
        }));
        t('default', qw`--foo 1 --bar 2`, ['--foo', 1, '--bar', 2]);
        t('credentials',
            qw`--foo 1 --bar 2 --customer test_user --password abcdefgh`,
            ['--foo', 1, '--bar', 2]);
        t('credentials with no-config',
            qw`--no-config --customer usr --password abc --token t --zone z`,
            qw`--no-config --customer usr --password abc --token t --zone z`);
    });
    xdescribe('config load', ()=>{
        const t = (name, config, expected)=>it(name, etask._fn(
        function*(_this){
            _this.timeout(4000);
            app = yield app_with_config(config);
            let proxies = yield json('api/proxies_running');
            assert_has(proxies, expected, 'proxies');
        }));
        const simple_proxy = {port: 24024};
        t('cli only', {cli: simple_proxy, config: []},
            [assign({}, simple_proxy, {proxy_type: 'persist'})]);
        t('main config only', {config: simple_proxy},
            [assign({}, simple_proxy, {proxy_type: 'persist'})]);
        t('config file', {files: [simple_proxy]}, [simple_proxy]);
        t('config override cli', {cli: simple_proxy, config: {port: 24042}},
            [simple_proxy, {proxy_type: 'persist', port: 24042}]);
        const multiple_proxies = [
            assign({}, simple_proxy, {port: 25025}),
            assign({}, simple_proxy, {port: 26026}),
            assign({}, simple_proxy, {port: 27027}),
        ];
        t('multiple config files', {files: multiple_proxies},
            multiple_proxies);
        t('main + config files', {config: simple_proxy,
            files: multiple_proxies}, [].concat([assign({}, simple_proxy,
            {proxy_type: 'persist'})], multiple_proxies));
        describe('default zone', ()=>{
            const zone_static = {password: ['pass1']};
            const zone_gen = {password: ['pass2']};
            const zones = {static: assign({}, zone_static),
                gen: assign({}, zone_gen)};
            const t2 = (name, config, expected, _defaults={zone: 'static'})=>{
                nock('https://luminati-china.io').get('/').reply(200, {});
                nock('https://luminati-china.io').post('/update_lpm_stats')
                    .reply(200, {});
                nock('https://luminati-china.io').get('/cp/lum_local_conf')
                    .query({customer: 'testc1', proxy: pkg.version})
                    .reply(200, {_defaults});
                t(name, _.set(config, 'cli.customer', 'testc1'), expected);
            };
            t2('invalid', {config: {_defaults: {zone: 'foo'},
                proxies: [simple_proxy]}}, [assign({}, simple_proxy,
                {zone: 'static'})], {zone: 'static', zones});
            t2('keep default', {config: {_defaults: {zone: 'gen'},
                proxies: [simple_proxy]}}, [assign({}, simple_proxy,
                {zone: 'gen'})]);
            t2('default disabled', {config: {_defaults: {zone: 'gen'},
                proxies: [simple_proxy]}}, [assign({}, simple_proxy,
                {zone: 'static'})], {zone: 'static', zones: assign({}, zones,
                    {gen: {plans: [{disable: 1}]}})});
        });
    });
    xdescribe('dropin', ()=>{
        const t = (name, args, expected)=>it(name, etask._fn(
        function*(_this){
            _this.timeout(4000);
            app = yield app_with_args(args);
            let proxies = yield json('api/proxies_running');
            assert_has(proxies, expected, 'proxies');
        }));
        t('off', ['--no-dropin'], []);
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
        describe('recent_ips', ()=>{
            Manager.prototype.json = mock_json(200);
            const expect_opt = {
                url: 'https://luminati-china.io/api/get_recent_ips?zones=*',
                headers: {'x-hola-auth': `lum-customer-${customer}`
                    +`-zone-static-key-${password}`},
            };
            it('get', ()=>etask(function*(){
                app = yield app_with_args(
                    qw`--customer ${customer} --password ${password}`);
                const body = yield json('api/recent_ips');
                assert_has(body, {opt: expect_opt});
            }));
            it('get with config', ()=>etask(function*(){
                app = yield app_with_config({config: {_defaults:
                    {customer, password}}, only_explicit: true});
                const body = yield json('api/recent_ips');
                assert_has(body, {opt: expect_opt});
            }));
        });
        describe('proxies', ()=>{
            describe('get', ()=>{
                it('normal', ()=>etask(function*(){
                    let proxies = [{port: 24023}, {port: 24024}];
                    app = yield app_with_proxies(proxies);
                    let res = yield json('api/proxies');
                    assert_has(res, proxies, 'proxies');
                    res = yield json('api/proxies_running');
                    assert_has(res, proxies, 'proxies_running');
                }));
            });
            describe('post', ()=>{
                it('normal non-persist', ()=>etask(function*(){
                    let sample_proxy = {
                        port: 24001,
                        proxy_type: 'non-persist',
                    };
                    let proxies = [{port: 24000}];
                    app = yield app_with_proxies(proxies, {mode: 'root'});
                    let res = yield json('api/proxies', 'post',
                        {proxy: sample_proxy});
                    assert_has(res, {data: sample_proxy}, 'proxies');
                    res = yield json('api/proxies_running');
                    assert_has(res, [{}, sample_proxy], 'proxies');
                    res = yield json('api/proxies');
                    assert.equal(res.length, 1);
                }));
                it('normal persist', ()=>etask(function*(){
                    let sample_proxy = {port: 24001};
                    let proxies = [{port: 24000}];
                    app = yield app_with_proxies(proxies, {mode: 'root'});
                    let res = yield json('api/proxies', 'post',
                        {proxy: sample_proxy});
                    assert_has(res, {data: sample_proxy}, 'proxies');
                    res = yield json('api/proxies_running');
                    assert_has(res, [{}, sample_proxy], 'proxies');
                    res = yield json('api/proxies');
                    assert_has(res, [{}, sample_proxy], 'proxies');
                }));
                it('inherit defaults', ()=>etask(function*(){
                    let sample_proxy = {port: 24001, proxy_type:
                        'non-persist'};
                    let proxies = [{port: 24000}];
                    let res_proxy = assign({}, {customer, password},
                        sample_proxy);
                    app = yield app_with_proxies(proxies, {mode: 'root'});
                    let res = yield json('api/proxies', 'post',
                        {proxy: sample_proxy});
                    assert_has(res, {data: res_proxy}, 'proxies');
                    res = yield json('api/proxies_running');
                    assert_has(res, [{}, res_proxy], 'proxies');
                    res = yield json('api/proxies');
                    assert.equal(res.length, 1);
                }));
                it('conflict', ()=>etask(function*(){
                    let sample_proxy = {port: 24000};
                    let proxies = [sample_proxy];
                    app = yield app_with_proxies(proxies, {mode: 'root'});
                    let res = yield api_json('api/proxies',
                        {method: 'post', body: {proxy: sample_proxy}});
                    assert.equal(res.statusCode, 400);
                    assert_has(res.body, {errors: []}, 'proxies');
                }));
            });
            describe('put', ()=>{
                it('normal', ()=>etask(function*(){
                    let put_proxy = {port: 24001};
                    let proxies = [{port: 24000}];
                    app = yield app_with_proxies(proxies, {mode: 'root'});
                    let res = yield json('api/proxies/24000', 'put',
                        {proxy: put_proxy});
                    assert_has(res, {data: put_proxy});
                    res = yield json('api/proxies_running');
                    assert_has(res, [put_proxy], 'proxies');
                }));
                it('inherit defaults', ()=>etask(function*(){
                    let put_proxy = {port: 24001};
                    let proxies = [{port: 24000}];
                    let res_proxy = assign({}, {customer, password},
                        put_proxy);
                    app = yield app_with_proxies(proxies, {mode: 'root'});
                    let res = yield json('api/proxies/24000', 'put',
                        {proxy: put_proxy});
                    assert_has(res, {data: res_proxy});
                    res = yield json('api/proxies_running');
                    assert_has(res, [res_proxy], 'proxies');
                }));
                it('conflict', ()=>etask(function*(){
                    let proxies = [{port: 24000}, {port: 24001}];
                    app = yield app_with_proxies(proxies, {mode: 'root'});
                    let res = yield api_json('api/proxies/24001',
                        {method: 'put', body: {proxy: {port: 24000}}});
                    assert.equal(res.statusCode, 400);
                    assert_has(res.body, {errors: []}, 'proxies');
                }));
            });
            describe('delete', ()=>{
                it('normal', ()=>etask(function*(){
                    app = yield app_with_args(['--mode', 'root']);
                    let res = yield api_json('api/proxies/24000',
                        {method: 'delete'});
                    assert.equal(res.statusCode, 204);
                }));
            });
        });
        describe('user credentials', ()=>{
            it('success', ()=>etask(function*(){
                nock('https://luminati-china.io').get('/').reply(200, {});
                nock('https://luminati-china.io').post('/update_lpm_stats')
                    .reply(200, {});
                nock('https://luminati-china.io').post('/update_lpm_config')
                    .reply(200, {});
                nock('https://luminati-china.io').get('/cp/lum_local_conf')
                    .query({customer: 'mock_user', proxy: pkg.version})
                    .reply(200, {mock_result: true, _defaults: true});
                app = yield app_with_args(['--customer', 'mock_user']);
                let result = yield app.manager.get_lum_local_conf();
                assert_has(result, {mock_result: true});
            }));
            it('login required', ()=>etask(function*(){
                nock('https://luminati-china.io').get('/cp/lum_local_conf')
                    .query({customer: 'mock_user', token: '',
                        proxy: pkg.version})
                    .reply(403, 'login_required');
                nock('https://luminati-china.io').get('/cp/lum_local_conf')
                    .query({token: '', proxy: pkg.version})
                    .reply(403, 'login_required');
                app = yield app_with_args(['--customer', 'mock_user']);
                try {
                    yield app.manager.get_lum_local_conf(null, null, true);
                    assert.fail('should have thrown exception');
                } catch(e){
                    assert_has(e, {status: 403, message: 'login_required'});
                }
            }));
            it('update defaults', ()=>etask(function*(){
                let updated = {_defaults: {customer: 'updated'}};
                nock('https://luminati-china.io').get('/').reply(200, {});
                nock('https://luminati-china.io').post('/update_lpm_stats')
                    .query({customer: 'updated'}).reply(200, {});
                nock('https://luminati-china.io').post('/update_lpm_config')
                    .query({customer: 'updated'}).reply(200, {});
                nock('https://luminati-china.io').get('/cp/lum_local_conf')
                    .query({customer: 'mock_user', proxy: pkg.version})
                    .reply(200, updated);
                app = yield app_with_args(['--customer', 'mock_user']);
                let res = yield app.manager.get_lum_local_conf();
                assert_has(res, updated, 'result');
                assert_has(app.manager._defaults, res._defaults, '_defaults');
            }));
        });
        describe('recent_stats', ()=>{
            const t = (name, expected)=>
            it(name, etask._fn(function*(_this){
                _this.timeout(6000);
                nock('https://luminati-china.io').get('/cp/lum_local_conf')
                    .query({customer: 'mock_user', proxy: pkg.version})
                    .reply(200, {mock_result: true, _defaults: true});
                app = yield app_with_args(qw`--customer mock_user --port 24000
                    --request_stats --ssl false`);
                app.manager.loki.stats_clear();
                yield etask.nfn_apply(request, [{
                    proxy: 'http://127.0.0.1:24000',
                    url: 'http://linkedin.com/',
                    strictSSL: false,
                }]);
                yield etask.sleep(1500);
                const res = yield api_json(`api/recent_stats`);
                assert_has(res.body, expected);
            }));
            t('main', {
                status_code: [{key: '200', reqs: 1}],
                protocol: [{key: 'http', reqs: 1}],
                hostname: [{key: 'linkedin.com', reqs: 1}],
                ports: {24000: {
                    reqs: 1,
                    success: 1,
                    url: 'http://linkedin.com/',
                }},
                success: 1,
                total: 1,
            });
        });
    });
    it('disable analytics', ()=>{
        const ua = analytics.get_ua();
        const spy = sinon.stub(ua.ua, 'send', ()=>{});
        analytics.enabled = false;
        ua.send();
        assert(!spy.called);
        analytics.enabled = true;
        ua.send();
        assert(spy.called);
        spy.restore();
    });
    // XXX krzysztof: make it the other way
    xdescribe('crash on load error', ()=>{
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
        t('conflict with www', [{port: Manager.default.www}]);
    });
    describe('using passwords', ()=>{
        it('take password from provided zone', etask._fn(function*(_this){
            _this.timeout(5000);
            const config = {proxies: []};
            const _defaults = {zone: 'static', password: 'xyz',
                zones: {zone1: {password: ['zone1_pass']}}};
            app = yield app_with_config({config, cli: {mode: 'root'}});
            nock('https://luminati-china.io').get('/cp/lum_local_conf')
            .query({customer: 'abc', proxy: pkg.version, token: ''})
            .reply(200, {_defaults});
            const res = yield json('api/proxies', 'post',
                {proxy: {port: 24000, zone: 'zone1'}});
            assert.equal(res.data.password, 'zone1_pass');
        }));
        it('uses password from default zone', etask._fn(function*(_this){
            _this.timeout(5000);
            const config = {proxies: []};
            const _defaults = {zone: 'static', password: 'xyz',
                zones: {static: {password: ['static_pass']}}};
            app = yield app_with_config({config, cli: {mode: 'root'}});
            nock('https://luminati-china.io').get('/cp/lum_local_conf')
            .query({customer: 'abc', proxy: pkg.version, token: ''})
            .reply(200, {_defaults});
            const res = yield json('api/proxies', 'post',
                {proxy: {port: 24000, zone: 'static'}});
            assert.equal(res.data.password, 'static_pass');
        }));
    });
});

const util = require('./lib/util.js');

describe('util', ()=>{
    describe('param_rand_range', ()=>{
        const t = (arg, res, mult)=>{
            let name = JSON.stringify(arg)+(mult>0 ? ' mult:'+mult : '');
            it(name, ()=>{
                let rand_range = util.param_rand_range(arg, mult);
                assert.equal(rand_range, res);
            });
        };
        t('0:0', 0);
        t(0, 0);
        t('1', 1);
        t('5:1', 5);
        t('5:1', 500, 100);
        t([5, 1], 500, 100);
        t('test', 0);
        t(5, 5);
        it('in range 2:4', ()=>{
            let rand_range = util.param_rand_range('2:4');
            assert.ok(rand_range>=2 && rand_range<=4);
        });
        it('in range 2:4 mult 100', ()=>{
            let rand_range = util.param_rand_range('2:4', 100);
            assert.ok(rand_range>=200 && rand_range<=400);
        });
    });
    it('parse_env_params', ()=>{
        const t = (env, params, result, error)=>{
            if (error)
            {
                const spy = sinon.stub(zerr, 'zexit',
                    err=>assert.equal(err, error));
                lpm_util.t.parse_env_params(env, params);
                assert(spy.called);
                spy.restore();
            }
            else
            {
                assert.deepEqual(lpm_util.t.parse_env_params(env, params),
                    result);
            }
        };
        t({}, {port: {type: 'integer'}}, {});
        t({LPM_PORT: '11123'}, {port: {type: 'integer'}}, {port: 11123});
        t({LPM_PORT: 'asdasdasd'}, {port: {type: 'integer'}}, {},
            'LPM_PORT not a number asdasdasd');
        t({LPM_IP: '127.0.0.1'}, {ip: {type: 'string'}}, {ip: '127.0.0.1'});
        t({LPM_IP: '127.0.0.1'}, {ip: {type: 'string',
            pattern: '^(\\d+\\.\\d+\\.\\d+\\.\\d+)?$'}}, {ip: '127.0.0.1'});
        t({LPM_IP: 'notIp'}, {ip: {type: 'string',
            pattern: '^(\\d+\\.\\d+\\.\\d+\\.\\d+)?$'}}, {},
            'LPM_IP wrong value pattern ^(\\d+\\.\\d+\\.\\d+\\.\\d+)?$');
        t({LPM_IPS: '127.0.0.1'}, {ips: {type: 'array'}},
            {ips: ['127.0.0.1']});
        t({LPM_IPS: '127.0.0.1;192.168.1.1'}, {ips: {type: 'array'}},
            {ips: ['127.0.0.1', '192.168.1.1']});
        t({LPM_OBJECT: '[asdasd'}, {object: {type: 'object'}}, {},
            'LPM_OBJECT contains invalid JSON: [asdasd');
        t({LPM_OBJECT: '{"test": [1,2,3]}'}, {object: {type: 'object'}}, {
            object: {test: [1, 2, 3]}});
    });
    it('get_file_path', ()=>{
        const test_files = [
            ['test1.file'],
            ['test2.file', 'test2.file.backup'],
            ['test3.file', 'test3.file.0', 'test3.file.1'],
            ['test4.file', 'test4.file.0', 'test4.file.backup']];
        const create_file = filename=>fs.writeFileSync(
            path.resolve(os.homedir(), filename));
        const remove_file = filename=>{
            fs.unlinkSync(path.resolve(lpm_file.work_dir, filename));
        };
        const t = files=>{
            for (const file of files)
                create_file(file);
            lpm_file.get_file_path(files[0]);
            for (const file of files)
            {
                assert.equal(fs.existsSync(path.resolve(os.homedir(), file)),
                    false);
                assert.equal(fs.existsSync(path.resolve(
                    lpm_file.work_dir, file)), true);
            }
            for (const file of files)
                remove_file(file);
        };
        for (const files of test_files)
            t(files);
    });
});
