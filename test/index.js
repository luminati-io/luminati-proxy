// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, mocha:true*/
const _ = require('lodash');
const assert = require('assert');
const dns = require('dns');
const net = require('net');
const https = require('https');
const socks = require('lum_socksv5');
const {Netmask} = require('netmask');
const {Readable, Writable} = require('stream');
const ssl = require('../lib/ssl.js');
const request = require('request');
const lolex = require('lolex');
const etask = require('../util/etask.js');
const {ms} = require('../util/date.js');
const sinon = require('sinon');
const lpm_config = require('../util/lpm_config.js');
const Server = require('../lib/server.js');
const requester = require('../lib/requester.js');
const Timeline = require('../lib/timeline.js');
const Ip_cache = require('../lib/ip_cache.js');
const Config = require('../lib/config.js');
const lutil = require('../lib/util.js');
const consts = require('../lib/consts.js');
const common = require('./common.js');
const {assert_has, http_proxy, smtp_test_server, http_ping} = common;
const qw = require('../util/string.js').qw;
const test_url = {http: 'http://lumtest.com/test',
    https: 'https://lumtest.com/test'};
const customer = 'abc';
const password = 'xyz';

const TEST_SMTP_PORT = 10025;

const pre_rule = (type, regex)=>({
    rules: [{action: {[type]: true}, url: regex}],
});
describe('proxy', ()=>{
    let proxy, ping, smtp, sandbox;
    const lum = opt=>etask(function*(){
        opt = opt||{};
        if (opt.ssl===true)
            opt.ssl = Object.assign({requestCert: false}, ssl());
        const mgr = {config: new Config()};
        const l = new Server(Object.assign({
            proxy: '127.0.0.1',
            proxy_port: proxy.port,
            customer,
            password,
            log: 'none',
            port: 24000,
        }, opt), mgr);
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
            return yield etask.nfn_apply(_this, '.request', [req_opt]);
        });
        yield l.listen();
        l.session_mgr._request_session({}, {init: true});
        l.history = [];
        l.on('usage', data=>l.history.push(data));
        l.on('usage_abort', data=>l.history.push(data));
        return l;
    });
    let l, waiting;
    const repeat = (n, action)=>{
        while (n--)
            action();
    };
    const release = n=>repeat(n||1, ()=>waiting.shift()());
    const hold_request = (next, req)=>{
        if (req.url!=test_url.http)
            return next();
        waiting.push(next);
    };
    before(etask._fn(function*before(_this){
        _this.timeout(30000);
        console.log('Start prep', new Date());
        proxy = yield http_proxy();
        smtp = yield smtp_test_server(TEST_SMTP_PORT);
        ping = yield http_ping();
        console.log('End prep', new Date());
    }));
    after('after all', etask._fn(function*after(_this){
        _this.timeout(3000);
        if (proxy)
            yield proxy.stop();
        proxy = null;
        smtp.close();
        if (ping)
            yield ping.stop();
        ping = null;
    }));
    beforeEach(()=>{
        Server.session_to_ip = {};
        Server.last_ip = new Netmask('1.1.1.0');
        common.last_ip = new Netmask('1.1.1.0');
        sandbox = sinon.sandbox.create();
        proxy.fake = true;
        proxy.connection = null;
        proxy.history = [];
        proxy.full_history = [];
        smtp.silent = false;
        waiting = [];
        ping.history = [];
    });
    afterEach('after each', ()=>etask(function*(){
        if (!l)
            return;
        yield l.stop(true);
        l = null;
        sandbox.verifyAndRestore();
    }));
    describe('sanity', ()=>{
        if (!('NODE_TLS_REJECT_UNAUTHORIZED' in process.env))
            process.env.NODE_TLS_REJECT_UNAUTHORIZED = 1;
        const t = (name, tls, req, opt)=>it(name+(tls ? ' tls' : ''),
            etask._fn(
        function*(_this){
            _this.timeout(5000);
            proxy.fake = false;
            opt = opt||{};
            l = yield lum(opt);
            req = req();
            if (tls)
            {
                sandbox.stub(process.env, 'NODE_TLS_REJECT_UNAUTHORIZED', 0);
                if (typeof req=='string')
                    req = {url: req};
                req.agent = new https.Agent({servername: 'localhost'});
                req.proxy = `https://localhost:${l.port}`;
            }
            const res = yield l.test(req);
            assert.equal(ping.history.length, 1);
            const expected = {statusCode: 200, statusMessage: 'PONG'};
            if (req.body)
                Object.assign(expected, {body: req.body});
            assert_has(res, expected, 'res');
        }));
        for (let tls of [false, true])
        {
            t('http', tls, ()=>ping.http.url);
            t('http post', tls, ()=>{
                return {url: ping.http.url, method: 'POST', body: 'test body'};
            });
            t('https', tls, ()=>ping.https.url, {ssl: false});
            t('https post', tls,
                ()=>({url: ping.https.url, method: 'POST', body: 'test body'}),
                {ssl: false});
            t('https sniffing', tls, ()=>ping.https.url, {insecure: true});
            t('https sniffing post', tls,
                ()=>({url: ping.https.url, method: 'POST', body: 'test body'}),
                {insecure: true});
        }
    });
    describe('encoding', ()=>{
        const t = (name, encoding)=>it(name, etask._fn(function*(_this){
            _this.timeout(5000);
            proxy.fake = false;
            l = yield lum();
            let req = {url: ping.http.url,
                headers: {'accept-encoding': encoding}};
            let w = etask.wait();
            l.on('usage', ()=>w.continue());
            l.on('usage_abort', ()=>w.continue());
            yield l.test(req);
            yield w;
            sinon.assert.match(JSON.parse(l.history[0].response_body),
                sinon.match({url: '/'}));
        }));
        t('gzip', 'gzip');
        t('deflate', 'deflate');
        t('raw deflate', 'deflate-raw');
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
                const res = yield l.test(ping.http.url);
                assert.ok(!res.body.headers['x-hola-agent']);
            }));
        });
        describe('X-Hola-Context', ()=>{
            const t = (name, _url, opt, target, skip_res)=>it(name, ()=>etask(
            function*(){
                const context = 'context-1';
                l = yield lum(opt);
                const res = yield l.test({
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
                assert.equal(l.history.length, 1);
                assert.equal(l.history[0].context, context);
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
                    'Connection': 'keep-alive',
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
        describe('added headers in request', ()=>{
            it('should set User-Agent only when user_agent field is set',
            ()=>etask(function*(){
                const req = {headers: {'user-agent': 'from_req'}};
                l = yield lum({override_headers: true});
                l.add_headers(req);
                assert.ok(req.headers['user-agent']=='from_req');
            }));
        });
    });
    it('should listen without specifying port number', ()=>etask(function*(){
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
                        Buffer.from('lum-customer-user-zone-zzz:pass')
                        .toString('base64'),
                }});
                assert.ok(!l.sessions);
                assert.equal(proxy.history.length, 1);
                assert.equal(res.body.auth.customer, 'user');
                assert.equal(res.body.auth.password, 'pass');
                assert.equal(res.body.auth.zone, 'zzz');
            }));
        });
        describe('password is optional', ()=>{
            it('should use default password if skipped', ()=>etask(function*(){
                l = yield lum();
                const res = yield l.test({headers: {
                    'proxy-authorization': 'Basic '+
                        Buffer.from('country-es').toString('base64'),
                }});
                assert.equal(res.body.auth.country, 'es');
                assert.equal(res.body.auth.password, 'xyz');
            }));
            it('should use provided password if passed', ()=>etask(function*(){
                l = yield lum();
                const res = yield l.test({headers: {
                    'proxy-authorization': 'Basic '+
                        Buffer.from('country-es:abc').toString('base64'),
                }});
                assert.equal(res.body.auth.country, 'es');
                assert.equal(res.body.auth.password, 'abc');
            }));
        });
        describe('pool', ()=>{
            describe('pool_size', ()=>{
                const t = pool_size=>it(''+pool_size, ()=>etask(function*(){
                    l = yield lum({pool_size});
                    yield l.test({fake: 1});
                    assert.equal(proxy.history.length, 0);
                    assert.equal(proxy.full_history.length, 0);
                    assert.equal(l.session_mgr.sessions.sessions.length,
                        pool_size);
                    const sessions = {};
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
            describe('rotate_session', ()=>{
                it('disabled', ()=>etask(function*(){
                    l = yield lum({rotate_session: false});
                    assert.equal(l.session_mgr.opt.rotate_session, false);
                }));
                const test_call = ()=>etask(function*(){
                    const res = yield l.test({fake: 1});
                    assert.ok(res.body);
                    return res.body;
                });
                it('off, default', ()=>etask(function*(){
                    l = yield lum({rotate_session: false});
                    const session_a = yield test_call();
                    const session_b = yield test_call();
                    assert.equal(session_a, session_b);
                }));
                it('on, default', ()=>etask(function*(){
                    l = yield lum({rotate_session: true});
                    const session_a = yield test_call();
                    const session_b = yield test_call();
                    assert.notEqual(session_a, session_b);
                }));
                // t('on, sticky_ip', {rotate_session: true, sticky_ip: true});
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
                // broken t(2);
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
            t('raw', {raw: true});
            t('direct', pre_rule('direct'), {direct: true});
            t('session explicit', {session: 'test_session'});
            describe('lower case and spaces', ()=>{
                t('long', {state: 'NY', city: 'New York'},
                    {state: 'ny', city: 'newyork'});
                t('short',
                    {state: 'NY', city: 'New York'},
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
                const res = yield l.test();
                const auth = res.body.auth;
                assert.ok(session.test(auth.session));
            });
            const t1 = (name, opt, before, after)=>it(name, ()=>etask(
            function*(){
                l = yield lum(opt);
                yield test_session(before);
                yield l.session_mgr.refresh_sessions();
                yield test_session(after);
            }));
            t1('pool', {pool_size: 1}, /24000_1/, /24000_2/);
            t1('sticky_ip', {sticky_ip: true}, /24000_127_0_0_1_1/,
                /24000_127_0_0_1_2/);
            it('default', ()=>etask(function*(){
                // XXX krzysztof: should it refresh all the sessions or one?
                l = yield lum({pool_size: 3});
                assert.ok(!l.sessions);
                yield l.session_mgr.refresh_sessions();
                const pre = l.session_mgr.sessions.sessions.map(s=>s.session);
                yield l.session_mgr.refresh_sessions();
                const after = l.session_mgr.sessions.sessions
                    .map(s=>s.session);
                const first = pre.shift();
                after.forEach(a=>assert.notEqual(a, first));
                assert_has(after, pre);
            }));
        });
        describe('history aggregation', ()=>{
            let clock;
            before(()=>clock = lolex.install({
                shouldAdvanceTime: true,
                advanceTimeDelta: 10,
                toFake: qw`setTimeout clearTimeout setInterval clearInterval
                    setImmediate clearImmediate`,
            }));
            after('after history aggregation', ()=>clock.uninstall());
            const t = (name, _url, expected, opt)=>it(name, ()=>etask(
            function*(){
                ping.headers = ping.headers||{};
                ping.headers.connection = 'close';
                l = yield lum(Object.assign({history: true}, opt));
                assert.equal(l.history.length, 0);
                const res = yield l.test(_url());
                yield etask.sleep(400);
                res.socket.destroy();
                assert.equal(l.history.length, 1);
                assert_has(l.history[0], expected());
            }));
            t('http', ()=>ping.http.url, ()=>({
                port: 24000,
                url: ping.http.url,
                method: 'GET',
                super_proxy: '127.0.0.1:20001'
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
        });
        describe('whitelist', ()=>{
            it('http', etask._fn(function*(){
                l = yield lum();
                let res = yield l.test({url: test_url.http});
                assert.equal(res.statusCode, 200);
            }));
            it('http reject', etask._fn(function*(){
                l = yield lum({whitelist_ips: ['1.1.1.1']});
                sinon.stub(l, 'is_whitelisted').onFirstCall().returns(false);
                let res = yield l.test({url: test_url.http});
                assert.equal(res.statusCode, 407);
                assert.equal(res.body, undefined);
            }));
            it('https', etask._fn(function*(){
                l = yield lum();
                let res = yield l.test({url: test_url.https});
                assert.equal(res.statusCode, 200);
            }));
            it('https reject', etask._fn(function*(){
                l = yield lum({whitelist_ips: ['1.1.1.1']});
                sinon.stub(l, 'is_whitelisted').onFirstCall().returns(false);
                let error;
                try {
                    yield l.test({url: test_url.https});
                } catch(e){ error = e.toString(); }
                assert(error.includes('tunneling socket could not be '
                +'established, statusCode=407'));
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
                sinon.stub(l, 'is_whitelisted').onFirstCall().returns(false);
                let res = yield etask.nfn_apply(request, [{
                    agent: new socks.HttpAgent({
                        proxyHost: '127.0.0.1',
                        proxyPort: l.port,
                        auths: [socks.auth.None()],
                    }),
                    rejectUnauthorized: false,
                    url: test_url.http,
                }]);
                assert.equal(res.statusCode, 407);
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
                sinon.stub(l, 'is_whitelisted').onFirstCall().returns(false);
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
        describe('proxy_resolve', ()=>{
            const dns_resolve = dns.resolve;
            before(()=>{
                dns.resolve = (domain, cb)=>{
                    cb(null, ['1.1.1.1', '2.2.2.2', '3.3.3.3']);
                };
            });
            after(()=>{
                dns.resolve = dns_resolve;
            });
            it('should not resolve proxy by default', etask._fn(function*(){
                l = yield lum({proxy: 'domain.com'});
                assert.equal(l.hosts.length, 1);
                assert.deepEqual(l.hosts[0], 'domain.com');
            }));
            it('should not resolve if it is IP', etask._fn(function*(){
                l = yield lum({proxy: '1.2.3.4'});
                assert.equal(l.hosts.length, 1);
                assert.deepEqual(l.hosts[0], '1.2.3.4');
            }));
        });
        describe('request IP choice', ()=>{
            it('should use IP sent in x-lpm-ip header', ()=>etask(function*(){
                l = yield lum();
                const ip = '1.2.3.4';
                const r = yield l.test({headers: {'x-lpm-ip': ip}});
                assert.ok(
                    r.headers['x-lpm-authorization'].includes(`ip-${ip}`));
            }));
        });
        describe('request country choice', ()=>{
            it('should use country sent in x-lpm-country header',
                ()=>etask(function*(){
                    l = yield lum();
                    const country = 'us';
                    const r = yield l.test({headers:
                        {'x-lpm-country': country}});
                    assert.ok(r.headers['x-lpm-authorization']
                        .includes(`country-${country}`));
                }));
        });
        describe('request state choice', ()=>{
            it('should use state sent in x-lpm-state header',
                ()=>etask(function*(){
                    l = yield lum();
                    const state = 'us';
                    const r = yield l.test({headers: {'x-lpm-state': state}});
                    assert.ok(r.headers['x-lpm-authorization']
                        .includes(`state-${state}`));
                }));
        });
        describe('request city choice', ()=>{
            it('should use city sent in x-lpm-city header',
                ()=>etask(function*(){
                    l = yield lum();
                    const city = 'washington';
                    const r = yield l.test({headers: {'x-lpm-city': city}});
                    assert.ok(r.headers['x-lpm-authorization']
                        .includes(`city-${city}`));
                }));
            it('should use escaped city sent in x-lpm-city header',
                ()=>etask(function*(){
                    l = yield lum();
                    const city = 'New-York';
                    const r = yield l.test({headers: {'x-lpm-city': city}});
                    assert.ok(r.headers['x-lpm-authorization']
                        .includes(`city-newyork`));
                }));
        });
        describe('user_agent', ()=>{
            it('should use User-Agent header',
            ()=>etask(function*(){
                l = yield lum({user_agent: 'Mozilla'});
                const r = yield l.test();
                assert.ok(r.body.headers['user-agent']=='Mozilla');
            }));
            it('should use random desktop User-Agent header',
            ()=>etask(function*(){
                l = yield lum({user_agent: 'random_desktop'});
                const r = yield l.test();
                assert.ok(r.body.headers['user-agent'].includes('Windows NT'));
            }));
            it('should use random mobile User-Agent header',
            ()=>etask(function*(){
                l = yield lum({user_agent: 'random_mobile'});
                const r = yield l.test();
                assert.ok(r.body.headers['user-agent'].includes('iPhone'));
            }));
        });
        describe('proxy_connection_type', ()=>{
            const t = (name, options, type)=>it(name, ()=>etask(function*(){
                l = yield lum(options);
                assert.ok(l.requester instanceof type);
            }));
            t('should default to HTTP requester', {},
                requester.t.Http_requester);
            t('should use HTTPS requester when specified',
                {proxy_connection_type: 'https'}, requester.t.Https_requester);
        });
        describe('har_limit', ()=>{
            it('should save whole the response', ()=>etask(function*(){
                l = yield lum();
                yield l.test({fake: {data: 100}});
                assert.equal(l.history[0].response_body.length, 100);
            }));
            it('should save part of the response', ()=>etask(function*(){
                l = yield lum({har_limit: 3});
                yield l.test({fake: {data: 100}});
                assert.equal(l.history[0].response_body.length, 3);
            }));
            // XXX krzysztof: add https with tests first support fake requests
        });
    });
    describe('retry', ()=>{
        it('should set rules', ()=>etask(function*(){
            l = yield lum({rules: []});
            assert.ok(l.rules);
        }));
        const t = (name, status, rules=false, c=0)=>it(name,
        etask._fn(function*(_this){
            rules = rules || [{
                action: {ban_ip: 60*ms.MIN, retry: true},
                status,
                url: 'lumtest.com'
            }];
            l = yield lum({rules});
            let retry_count = 0;
            l.on('retry', opt=>{
                if (opt.req.retry)
                    retry_count++;
                l.lpm_request(opt.req, opt.res, opt.head, opt.post);
            });
            let r = yield l.test();
            assert.equal(retry_count, c);
            return r;
        }));
        t('should retry when status match', 200, null, 1);
        t('should ignore rule when status does not match', 404, null, 0);
        t('should prioritize', null, [{
            action: {url: 'http://lumtest.com/fail_url'},
            status: '200',
            url: 'lumtest.com'
        }, {
            action: {ban_ip: 60*ms.MIN, retry: true},
            status: '200',
            url: 'lumtest.com',
        }], 1);
        it('retry post', ()=>etask(function*(){
            proxy.fake = false;
            let rules = [{action: {retry: true}, status: 200}];
            l = yield lum({rules});
            let retry_count = 0;
            l.on('retry', opt=>{
                if (opt.req.retry)
                    retry_count++;
                l.lpm_request(opt.req, opt.res, opt.head, opt.post);
            });
            let opt = {url: ping.http.url, method: 'POST', body: 'test'};
            let r = yield l.test(opt);
            assert.equal(retry_count, 1);
            assert.equal(r.body, 'test', 'body was sent on retry');
        }));
    });
    describe('rules', ()=>{
        const inject_headers = (li, ip, ip_alt)=>{
            ip = ip||'ip';
            let call_count = 0;
            const handle_proxy_resp_org = li.handle_proxy_resp.bind(li);
            return sinon.stub(li, 'handle_proxy_resp', (...args)=>_res=>{
                const ip_inj = ip_alt && call_count++%2 ? ip_alt : ip;
                _res.headers['x-luminati-ip'] = ip_inj;
                return handle_proxy_resp_org(...args)(_res);
            });
        };
        const make_process_rule_req=(proxy_res, html, res)=>etask(function*(){
            const req = {ctx: {response: {}, proxies: [],
                timeline: {track: ()=>null, req: {create: Date.now()}},
                log: {info: ()=>null}, skip_rule: ()=>false}};
            Object.assign(proxy_res, {
                end: ()=>null, pipe: ()=>({pipe: ()=>null}),
                on: function(event, fn){
                    if (event=='data')
                    {
                        fn(Buffer.from(html));
                        fn(Buffer.from('random data'));
                    }
                    return this;
                },
                once: function(event, fn){
                    if (event=='end')
                        fn();
                    return this;
                }
            });
            res.end = ()=>null;
            const et = etask.wait();
            l.handle_proxy_resp(req, res, {}, et)(proxy_res);
            return yield et;
        });
        it('should process data', ()=>etask(function*(){
            const process = {price: `$('#priceblock_ourprice').text()`};
            l = yield lum({rules: [{action: {process}, type: 'after_body'}]});
            const html = `
              <body>
                <div>
                  <p id="priceblock_ourprice">$12.99</p>
                </div>
              </body>`;
            const proxy_res = {headers: {'content-encoding': 'text'}};
            const res = {write: sinon.spy()};
            const response = yield make_process_rule_req(proxy_res, html, res);
            assert.ok(!proxy_res.headers['content-encoding']);
            assert.equal(proxy_res.headers['content-type'],
                'application/json; charset=utf-8');
            const new_body = JSON.parse(
                lutil.decode_body(response.body).toString());
            assert.deepEqual(new_body, {price: '$12.99'});
            sinon.assert.calledWith(res.write, response.body[0]);
        }));
        it('should process data with error', ()=>etask(function*(){
            const process = {price: 'a-b-v'};
            l = yield lum({rules: [{action: {process}, type: 'after_body'}]});
            const html = `
              <body>
                <div>
                  <p id="priceblock_ourprice">$12.99</p>
                </div>
              </body>`;
            const proxy_res = {headers: {'content-encoding': 'text'}};
            const res = {write: sinon.spy()};
            const response = yield make_process_rule_req(proxy_res, html, res);
            assert.ok(!proxy_res.headers['content-encoding']);
            assert.equal(proxy_res.headers['content-type'],
                'application/json; charset=utf-8');
            const new_body = JSON.parse(response.body.toString());
            assert.deepEqual(new_body, {price: {context: 'a-b-v',
                error: 'processing data', message: 'a is not defined'}});
            sinon.assert.calledWith(res.write, response.body[0]);
        }));
        it('check Trigger', ()=>{
            const Trigger = require('../lib/rules').t.Trigger;
            const t = (code, _url, expected)=>{
                const cond = new Trigger({trigger_code: code});
                assert.equal(cond.test({url: _url}), expected);
            };
            t('function trigger(opt){ return false; }', '', false);
            t('function trigger(opt){ return false; }', 'http://google.com',
                false);
            t('function trigger(opt){ return true; }', '', true);
            t('function trigger(opt){ return true; }', 'http://google.com',
                true);
            t(`function trigger(opt){
                return opt.url.includes('facebook.com'); }`, '', false);
            t(`function trigger(opt){
                return opt.url.includes('facebook.com'); }`,
                'http://google.com', false);
            t(`function trigger(opt){
                return opt.url.includes('facebook.com'); }`,
                'http://facebook.com', true);
            t('function trigger(opt){ return true; }', 'http://google.com',
                true);
            t('function trigger(opt){ throw Error(\'error\') }', '', false);
        });
        it('check can_retry', ()=>etask(function*(){
            l = yield lum({rules: []});
            const t = (req, rule, expected)=>{
                const r = l.rules.can_retry(req, rule);
                assert.equal(r, expected);
            };
            t({retry: 0}, {test: true}, false);
            t({retry: 0}, {retry: 1}, true);
            t({retry: 0}, {retry_port: 24001}, true);
            t({retry: 5}, {retry: 1}, false);
        }));
        it('check retry', ()=>etask(function*(){
            l = yield lum({rules: []});
            const _req = {ctx: {response: {}, url: 'lumtest.com', log: l.log,
                proxies: []}};
            let called = false;
            l.on('retry', opt=>{
                assert.deepEqual(opt.req, _req);
                called = true;
            });
            l.rules.retry(_req, {}, {}, l.port);
            assert.equal(_req.retry, 1);
            assert.ok(called);
            l.rules.retry(_req, {}, {}, l.port);
            assert.equal(_req.retry, 2);
        }));
        it('check check_req_time_range', ()=>{
            // XXX krzysztof: to implement
        });
        it('check can_retry', ()=>etask(function*(){
            l = yield lum({rules: []});
            assert.ok(!l.rules.can_retry({}));
            assert.ok(l.rules.can_retry({retry: 2}, {retry: 5}));
            assert.ok(!l.rules.can_retry({retry: 5}));
            assert.ok(l.rules.can_retry({retry: 3}, {refresh_ip: false,
                retry: 5}));
            assert.ok(!l.rules.can_retry({retry: 3}, {refresh_ip: false,
                retry: true}));
            assert.ok(!l.rules.can_retry({retry: 3}, {refresh_ip: true,
                retry: true}));
            assert.ok(l.rules.can_retry({retry: 1}, {retry_port: 24001,
                retry: true}));
        }));
        it('check post_need_body', ()=>etask(function*(){
            l = yield lum({rules: [{url: 'test'}]});
            const t = (req, expected)=>{
                const r = l.rules.post_need_body(req);
                assert.equal(r, expected);
            };
            t({ctx: {url: 'invalid'}}, false);
            t({ctx: {url: 'test'}}, false);
            yield l.stop(true);
            l = yield lum({rules: [{type: 'after_body', body: '1',
                url: 'test'}]});
            t({ctx: {url: 'test'}}, true);
        }));
        it('check post_body', ()=>etask(function*(){
            l = yield lum({rules: [{
                body: 'test',
                action: {process: {}},
                url: 'test',
            }]});
            const t = (req, _res, body, expected)=>{
                const r = l.rules.post_body(req, {}, {}, _res, body);
                assert.equal(r, expected);
            };
            sinon.stub(l.rules, 'action').returns(true);
            sinon.stub(l.rules, 'process_response');
            t({ctx: {h_context: 'STATUS CHECK'}});
        }));
        it('check post', ()=>etask(function*(){
            l = yield lum({rules: [{url: 'test'}]});
            const t = (req, _res, expected)=>{
                req.ctx = Object.assign({skip_rule: ()=>false}, req.ctx);
                const r = l.rules.post(req, {}, {}, _res||{});
                assert.equal(r, expected);
            };
            t({ctx: {h_context: 'STATUS CHECK'}});
            t({ctx: {url: 'invalid'}});
            sinon.stub(l.rules, 'action').returns(true);
            t({ctx: {url: 'test'}}, {}, undefined);
        }));
        describe('action', ()=>{
            describe('ban_ip', ()=>{
                it('ban_ip', ()=>etask(function*(){
                    l = yield lum({rules: []});
                    sinon.stub(l.rules, 'can_retry').returns(true);
                    sinon.stub(l.rules, 'retry');
                    const refresh_stub = sinon.stub(l.session_mgr,
                        'refresh_sessions');
                    const add_stub = sinon.stub(l, 'banip');
                    const req = {ctx: {}};
                    const opt = {_res: {
                        hola_headers: {'x-luminati-ip': '1.2.3.4'}}};
                    const r = l.rules.action(req, {}, {},
                        {action: {ban_ip: 1000}}, opt);
                    assert.ok(r);
                    assert.ok(add_stub.called);
                    assert.ok(refresh_stub.called);
                }));
                let t = (name, req, fake, is_ssl)=>it(name, ()=>etask(
                    function*()
                {
                    proxy.fake = !!fake;
                    sandbox.stub(Server, 'get_random_ip', ()=>'1.1.1.1');
                    sandbox.stub(common, 'get_random_ip', ()=>'1.1.1.1');
                    l = yield lum({rules: [{
                        action: {ban_ip: 0},
                        action_type: 'ban_ip',
                        status: '200',
                        trigger_type: 'status',
                    }], insecure: true, ssl: is_ssl});
                    l.on('retry', opt=>{
                        l.lpm_request(opt.req, opt.res, opt.head, opt.post);
                    });
                    for (let i=0; i<2; i++)
                    {
                        let w = etask.wait();
                        l.on('usage', data=>w.return(data));
                        let res = yield l.test(req());
                        let usage = yield w;
                        assert.equal(res.statusCode, 200);
                        assert.deepStrictEqual(usage.rules, [{
                            action: {ban_ip: 0}, action_type: 'ban_ip',
                            status: '200', trigger_type: 'status',
                            type: 'after_hdr'}]);
                    }
                }));
                t('ban_ip fake', ()=>({fake: 1}), false, true);
                t('ban_ip http', ()=>({url: ping.http.url}), false, true);
                t('ban_ip https', ()=>({url: ping.https.url}), true, false);
                t('ban_ip https ssl', ()=>({url: ping.https.url}), true, true);
            });
            describe('request_url', ()=>{
                let req, req_stub;
                beforeEach(()=>etask(function*(){
                    l = yield lum({rules: []});
                    req = {ctx: {}};
                    req_stub = sinon.stub(request, 'Request',
                        ()=>({on: ()=>null, end: ()=>null}));
                }));
                afterEach(()=>{
                    req_stub.restore();
                });
                it('does nothing on invalid urls', ()=>{
                    const r = l.rules.action(req, {}, {},
                        {action: {request_url: {url: 'blabla'}}}, {});
                    assert.ok(!r);
                    sinon.assert.notCalled(req_stub);
                });
                it('sends request with http', ()=>{
                    const url = 'http://lumtest.com';
                    const r = l.rules.action(req, {}, {},
                        {action: {request_url: {url}}}, {});
                    assert.ok(!r);
                    sinon.assert.calledWith(req_stub, sinon.match({url}));
                });
                it('sends request with https', ()=>{
                    const url = 'https://lumtest.com';
                    const r = l.rules.action(req, {}, {},
                        {action: {request_url: {url}}}, {});
                    assert.ok(!r);
                    sinon.assert.calledWith(req_stub, sinon.match({url}));
                });
                it('sends request with custom method', ()=>{
                    const url = 'http://lumtest.com';
                    const r = l.rules.action(req, {}, {},
                        {action: {request_url: {url, method: 'POST'}}}, {});
                    assert.ok(!r);
                    sinon.assert.calledWith(req_stub, sinon.match({url}));
                });
                it('sends request with custom payload', ()=>{
                    const url = 'http://lumtest.com';
                    const payload = {a: 1, b: 'str'};
                    const payload_str = JSON.stringify(payload);
                    const rule = {url, method: 'POST', payload};
                    const r = l.rules.action(req, {}, {},
                        {action: {request_url: rule}}, {});
                    assert.ok(!r);
                    const headers = {
                        'Content-Type': 'application/json',
                        'Content-Length': Buffer.byteLength(payload_str),
                    };
                    sinon.assert.calledWith(req_stub, sinon.match({
                        url,
                        method: 'POST',
                        headers,
                        body: payload_str
                    }));
                });
                it('does not send payload in GET requests', ()=>{
                    const url = 'http://lumtest.com';
                    const payload = {a: 1, b: 'str'};
                    const rule = {url, method: 'GET', payload};
                    const r = l.rules.action(req, {}, {},
                        {action: {request_url: rule}}, {});
                    assert.ok(!r);
                    sinon.assert.calledWith(req_stub, sinon.match({
                        url,
                        method: 'GET'
                    }));
                });
                it('sends request with custom payload with IP', ()=>{
                    const url = 'http://lumtest.com';
                    const payload = {a: 1, b: '$IP'}, ip = '1.1.1.1';
                    const actual_payload = {a: 1, b: ip};
                    const payload_str = JSON.stringify(actual_payload);
                    const rule = {url, method: 'POST', payload};
                    const r = l.rules.action(req, {}, {},
                        {action: {request_url: rule}},
                        {_res: {headers: {'x-luminati-ip': ip}}});
                    assert.ok(!r);
                    const headers = {
                        'Content-Type': 'application/json',
                        'Content-Length': Buffer.byteLength(payload_str),
                    };
                    sinon.assert.calledWith(req_stub, sinon.match({
                        url,
                        method: 'POST',
                        headers,
                        body: payload_str
                    }));
                });
            });
            describe('retry', ()=>{
                it('retry should refresh the session', ()=>etask(function*(){
                    l = yield lum({
                        pool_size: 1,
                        rules: [{action: {retry: true}, status: '200'}],
                    });
                    l.on('retry', opt=>{
                        l.lpm_request(opt.req, opt.res, opt.head, opt.post);
                    });
                    let session_a = l.session_mgr.sessions.sessions[0].session;
                    yield l.test({fake: 1});
                    let session_b = l.session_mgr.sessions.sessions[0].session;
                    assert.notEqual(session_a, session_b);
                }));
                it('retry should rotate the session if it has ip',
                    ()=>etask(
                function*(){
                    l = yield lum({pool_size: 2, ips: ['1.1.1.1', '1.1.1.2'],
                        rules: [
                            {action: {reserve_session: true},
                                action_type: 'save_to_pool', status: '201'},
                            {action: {retry: true}, status: '200'}]});
                    l.on('retry', opt=>{
                        l.lpm_request(opt.req, opt.res, opt.head, opt.post);
                    });
                    let [sb1, sb2] = l.session_mgr.sessions.sessions;
                    yield l.test({fake: 1});
                    let [sa1, sa2] = l.session_mgr.sessions.sessions;
                    assert.equal(sb1.session, sa2.session);
                    assert.equal(sb1.ip, sa2.ip);
                    assert.equal(sb2.session, sa1.session);
                    assert.equal(sb2.ip, sa1.ip);
                    assert.equal(sa2.count, 0);
                }));
                it('retry should not add session if pool is not full',
                    ()=>etask(
                function*(){
                    l = yield lum({pool_size: 2, ips: ['1.1.1.1'],
                        rules: [
                            {action: {reserve_session: true},
                                action_type: 'save_to_pool', status: '201'},
                            {action: {retry: 2}, status: '200'}]});
                    l.on('retry', opt=>{
                        l.lpm_request(opt.req, opt.res, opt.head, opt.post);
                    });
                    let [sb1, sb2] = l.session_mgr.sessions.sessions;
                    let res = yield l.test({fake: 1});
                    assert.equal(res.body, '1.1.1.3');
                    let [sa1, sa2] = l.session_mgr.sessions.sessions;
                    assert.equal(sb1.session, sa1.session);
                    assert.equal(sb1.ip, sa1.ip);
                    assert.equal(sa1.count, 0);
                    assert.equal(sb2, undefined);
                    assert.equal(sa2, undefined);
                }));
            });
            it('retry_port should update context port', ()=>etask(function*(){
                l = yield lum({
                    rules: [{action: {retry_port: 24001}, status: '200'}],
                });
                const l2 = yield lum({port: 24001});
                let p1, p2;
                l.on('retry', opt=>{
                    p1 = opt.req.ctx.port;
                    l2.lpm_request(opt.req, opt.res, opt.head, opt.post);
                    p2 = opt.req.ctx.port;
                });
                yield l.test({fake: 1});
                assert.notEqual(p1, p2);
                l2.stop(true);
            }));
            xdescribe('dc pool', ()=>{
                it('adds to pool when prefill turned off and gathering',
                ()=>etask(function*(){
                    const ips = ['2.3.4.5'];
                    l = yield lum({
                        rules: [{
                            action: {reserve_session: true},
                            action_type: 'save_to_pool',
                            status: '200',
                        }],
                        pool_size: 2,
                        static: true,
                        ips,
                    });
                    inject_headers(l, '1.2.3.4');
                    l.mgr.proxies = [{port: 24000, ips}];
                    sinon.stub(l.mgr.config, 'save');
                    yield l.test();
                    assert.ok(l.opt.ips.includes('1.2.3.4'));
                }));
                it('does not add to pool when pool is full',
                ()=>etask(function*(){
                    const ips = ['2.3.4.5', '3.4.5.6'];
                    l = yield lum({
                        rules: [{
                            action: {reserve_session: true},
                            action_type: 'save_to_pool',
                            status: '200',
                        }],
                        pool_size: 2,
                        static: true,
                        ips,
                    });
                    inject_headers(l, '1.2.3.4');
                    l.mgr.proxies = [{port: 24000, ips}];
                    yield l.test();
                    assert.ok(!l.opt.ips.includes('1.2.3.4'));
                }));
                it('removes from pool on ban', ()=>etask(function*(){
                    l = yield lum({
                        rules: [{
                            action_type: 'ban_ip',
                            status: '200',
                            action: {ban_ip: 0},
                        }],
                        pool_size: 2,
                        ips: ['1.2.3.4', '2.3.4.5'],
                    });
                    inject_headers(l, '1.2.3.4');
                    const stub = sinon.stub(l.mgr.config, 'save');
                    assert.ok(l.opt.ips.includes('1.2.3.4'));
                    yield l.test();
                    sinon.assert.calledOnce(stub);
                    assert.ok(!l.opt.ips.includes('1.2.3.4'));
                }));
                it('does not replace session on remove', ()=>etask(function*(){
                    l = yield lum({
                        rules: [{
                            action_type: 'ban_ip',
                            status: '200',
                            action: {ban_ip: 0},
                        }],
                        pool_size: 2,
                        ips: ['1.2.3.4', '2.3.4.5'],
                    });
                    inject_headers(l, '1.2.3.4');
                    const stub = sinon.stub(l.mgr.config, 'save');
                    assert.equal(l.session_mgr.sessions.sessions.length, 2);
                    yield l.test();
                    sinon.assert.calledOnce(stub);
                    assert.equal(l.session_mgr.sessions.sessions.length, 1);
                }));
            });
            describe('ban_ip per domain', ()=>{
                const ban_period = 1000, domain = 'abc.com', ip = '10.0.0.2';
                let ban_spy;
                beforeEach(()=>etask(function*(){
                    l = yield lum({rules: [{action_type: 'ban_ip_domain',
                        status: '200', action: {ban_ip_domain: ban_period},
                        trigger_type: 'status', url: domain}]});
                    ban_spy = sinon.spy(l, 'banip');
                }));
                const t = (name, url, ban_count=0)=>it(name, ()=>{
                    const session = {session: 'sess1'};
                    const req = {ctx: {url, skip_rule: ()=>false, session}};
                    l.rules.post(req, {}, {}, {status_code: 200,
                        headers: {'x-luminati-ip': ip}});
                    sinon.assert.callCount(ban_spy, ban_count);
                    if (ban_count)
                    {
                        sinon.assert.calledWith(ban_spy, ip, ban_period,
                            session, domain);
                    }
                });
                t('does not trigger on diff domains',
                    'http://lumtest.com/test');
                t('triggers', `http://${domain}/test`, 1);
            });
            describe('ip_cache', ()=>{
                let ip_cache;
                beforeEach(()=>ip_cache = new Ip_cache());
                afterEach(()=>ip_cache.clear_timeouts());
                it('has added entries', ()=>{
                    ip_cache.add('10.0.0.1', 1000);
                    ip_cache.add('10.0.0.2', 1000, 'lumtest.com');
                    assert.ok(ip_cache.has('10.0.0.1'));
                    assert.ok(ip_cache.has('10.0.0.2', 'lumtest.com'));
                    assert.ok(!ip_cache.has('10.0.0.3'));
                });
                it('has IP/domain entry when IP entry exists', ()=>{
                    ip_cache.add('10.0.0.2', 1000);
                    assert.ok(ip_cache.has('10.0.0.2', 'lumtest.com'));
                });
                it('does not have IP entry when IP/domain entry exists', ()=>{
                    ip_cache.add('10.0.0.2', 1000, 'lumtest.com');
                    assert.ok(!ip_cache.has('10.0.0.2'));
                });
            });
            it('refresh_ip', ()=>etask(function*(){
                l = yield lum({rules: []});
                sinon.stub(l.rules, 'can_retry').returns(true);
                sinon.stub(l.rules, 'retry');
                const ref_stub = sinon.stub(l, 'refresh_ip').returns('test');
                const req = {ctx: {}};
                const opt = {_res: {hola_headers: {'x-luminati-ip': 'ip'}}};
                const r = l.rules.action(req, {}, {},
                    {action: {refresh_ip: true}}, opt);
                assert.ok(r);
                assert.ok(ref_stub.called);
                assert.equal(l.refresh_task, 'test');
            }));
        });
        describe('pre', ()=>{
            it('action null_response', ()=>etask(function*(){
                l = yield lum({rules: [{action: {null_response: true}}]});
                const _req = {ctx: {response: {}, url: 'lumtest.com',
                    log: l.log, timeline: new Timeline(1)}};
                const _res = {end: sinon.stub(), write: sinon.stub()};
                const r = l.rules.pre(_req, _res, {});
                assert.equal(r.status_code, 200);
                assert.equal(r.status_message, 'NULL');
            }));
            it('action direct', ()=>etask(function*(){
                l = yield lum({rules: [{url: '', action: {direct: true}}]});
                const _req = {ctx: {response: {}, url: 'lumtest.com',
                    log: l.log, timeline: new Timeline(1)}};
                const _res = {end: sinon.stub(), write: sinon.stub()};
                const r = l.rules.pre(_req, _res, {});
                assert.equal(r, undefined);
                assert.ok(_req.ctx.is_direct);
            }));
            it('action retry_port', ()=>etask(function*(){
                l = yield lum({rules: [{action: {retry_port: 1,
                    email: 'test@mail'}}]});
                let called = false;
                l.on('retry', opt=>{
                    called = true;
                    assert.deepEqual(opt.port, 1);
                    assert.deepEqual(opt.req, _req);
                    assert.deepEqual(opt.res, _res);
                    assert.deepEqual(opt.head, _head);
                });
                const _req = {ctx: {
                    response: {},
                    url: 'lumtest.com',
                    log: l.log,
                    timeline: new Timeline(1),
                    rule_executed: ()=>0,
                }};
                const _res = {end: sinon.stub(), write: sinon.stub()};
                const _head = {};
                const r = yield l.rules.pre(_req, _res, _head);
                assert.ok(called);
                assert.equal(r, 'switched');
            }));
        });
        describe('call post after pre', ()=>{
            const t = action=>it(action, ()=>etask(function*(){
                l = yield lum({rules: [{
                    action: {[action]: true},
                    url: '.*'},
                ]});
                yield l.test(ping.http.url);
            }));
            t('null_response');
            t('bypass_proxy');
            t('direct');
            it('retry_port', ()=>etask(function*(){
                l = yield lum({rules: [{action: {retry: true,
                    retry_port: 24001}}]});
                const l2 = yield lum({port: 24001});
                let called = false;
                l.on('retry', opt=>{
                    called = true;
                    assert.equal(opt.port, 24001);
                    l2.lpm_request(opt.req, opt.res, opt.head, opt.post);
                });
                yield l.test(ping.http.url);
                assert.ok(called);
                l2.stop(true);
            }));
        });
        describe('banip combined with', ()=>{
            const get_banip_rule = (t=10)=>({
                action: {ban_ip: t*ms.MIN},
                action_type: 'ban_ip',
                status: '200',
            });
            const get_retry_rule = (retry_port=24001)=>({
                action: {retry: true, retry_port},
                action_type: 'retry_port',
                status: '200',
            });
            const t_pre = (action, ban)=>it(action, ()=>etask(function*(){
                l = yield lum({rules: [{action: {[action]: true}},
                    get_banip_rule()]});
                inject_headers(l);
                const ban_stub = sinon.stub(l, 'banip');
                yield l.test(ping.http.url);
                assert.equal(ban_stub.called, +ban);
            }));
            t_pre('null_response', false);
            // XXX krzysztof: broken test t_pre('bypass_proxy', false);
            t_pre('direct', true);
            // XXX krzysztof: this test is not relevant here
            // it tests multiple servers, should be moved to manager
            it('retry_port', ()=>etask(function*(){
                l = yield lum({rules: [
                    {action: {retry_port: 24001}},
                    get_banip_rule(),
                ]});
                const l2 = yield lum({
                    port: 24001,
                    rules: [get_banip_rule(30)],
                });
                l.on('retry', opt=>{
                    l2.lpm_request(opt.req, opt.res, opt.head, opt.post);
                });
                inject_headers(l2);
                const ban_stub = sinon.stub(l, 'banip');
                const ban_stub_l2 = sinon.stub(l2, 'banip');
                yield l.test(ping.http.url);
                sinon.assert.calledWith(ban_stub, 'ip', 600000);
                sinon.assert.calledWith(ban_stub_l2, 'ip', 1800000);
                l2.stop(true);
            }));
            it('waterfall', ()=>etask(function*(){
                l = yield lum({rules: [get_banip_rule(), get_retry_rule()]});
                const l2 = yield lum({port: 24001,
                    rules: [get_banip_rule(30)]});
                l.on('retry', opt=>{
                    l2.lpm_request(opt.req, opt.res, opt.head, opt.post);
                });
                const header_stub = inject_headers(l);
                const header_stub_l2 = inject_headers(l2, 'ip2');
                const ban_stub = sinon.stub(l, 'banip');
                const ban_stub_l2 = sinon.stub(l2, 'banip');
                yield l.test(ping.http.url);
                sinon.assert.calledWith(ban_stub, 'ip', 600000);
                sinon.assert.calledWith(ban_stub_l2, 'ip2', 1800000);
                header_stub.restore();
                header_stub_l2.restore();
                inject_headers(l, 'ip3');
                inject_headers(l2, 'ip4');
                yield l.test(ping.http.url);
                sinon.assert.calledWith(ban_stub, 'ip3', 600000);
                sinon.assert.calledWith(ban_stub_l2, 'ip4', 1800000);
                l2.stop(true);
            }));
            it('waterfall first', ()=>etask(function*(){
                l = yield lum({rules: [get_retry_rule(), get_banip_rule()]});
                const l2 = yield lum({port: 24001,
                    rules: [get_banip_rule(30)]});
                l.on('retry', opt=>{
                    l2.lpm_request(opt.req, opt.res, opt.head, opt.post);
                });
                inject_headers(l);
                inject_headers(l2);
                const ban_stub = sinon.stub(l, 'banip');
                const ban_stub_l2 = sinon.stub(l2, 'banip');
                yield l.test(ping.http.url);
                sinon.assert.calledWith(ban_stub, 'ip', 600000);
                sinon.assert.calledWith(ban_stub_l2, 'ip', 1800000);
                l2.stop(true);
            }));
            describe('existing session', ()=>{
                const prepare_lum = opt=>etask(function*(){
                    opt = opt||{};
                    l = yield lum(Object.assign({
                        rules: [get_banip_rule()],
                        pool_size: 1,
                        sticky_ip: false,
                    }, opt));
                });
                const t = (desc, opt)=>it(desc, ()=>etask(function*(){
                    yield prepare_lum(opt);
                    yield l.test({fake: 1});
                    const first_session = l.session_mgr.sessions.sessions[0];
                    yield l.test({fake: 1});
                    const second_session = l.session_mgr.sessions.sessions[0];
                    assert.ok(first_session!=second_session);
                }));
                t('long session');
                t('random user agent', {user_agent: 'random_desktop'});
                t('custom', {session: false});
                it('default pool', ()=>etask(function*(){
                    yield prepare_lum({pool_size: 0});
                    yield l.test({fake: 1});
                    const first_session = l.session_mgr.session;
                    yield l.test({fake: 1});
                    const second_session = l.session_mgr.session;
                    assert.ok(first_session!=second_session);
                }));
                it('per machine', ()=>etask(function*(){
                    yield prepare_lum({session: false, pool_size: 0,
                        sticky_ip: true});
                    yield l.test({fake: 1});
                    const sticky_sessions = l.session_mgr.sticky_sessions;
                    const first_session = Object.values(sticky_sessions)[0];
                    yield l.test({fake: 1});
                    const second_session = Object.values(sticky_sessions)[0];
                    assert.ok(first_session!=second_session);
                }));
                it('default pool', ()=>etask(function*(){
                    yield prepare_lum({pool_size: 2, rotate_session: true});
                    yield l.test({fake: 1});
                    const first_session = l.session_mgr.sessions.sessions[0];
                    yield l.test({fake: 1});
                    const second_session = l.session_mgr.sessions.sessions[1];
                    assert.ok(first_session!=second_session);
                }));
                it('high performance', ()=>etask(function*(){
                    yield prepare_lum({pool_size: 2});
                    yield l.test({fake: 1});
                    const first_sessions = l.session_mgr.sessions.sessions
                        .map(s=>s.session);
                    yield l.test({fake: 1});
                    const second_sessions = l.session_mgr.sessions.sessions
                        .map(s=>s.session);
                    assert.notDeepEqual(first_sessions, second_sessions);
                }));
            });
        });
    });
    describe('gather and consume', ()=>{
        it('should not add duplicated sessions', etask._fn(function*(_this){
            const rules = [{status: '200', action: {reserve_session: true}}];
            l = yield lum({pool_size: 3, static: true, rules});
            const ips = [];
            l.on('add_static_ip', data=>ips.push(data));
            yield l.test({fake: 1});
            yield l.test({fake: 1});
            assert.equal(ips.length, 1);
        }));
        it('should not add sessions when pool_size is not defined', etask._fn(
        function*(_this){
            const rules = [{status: '200', action: {reserve_session: true}}];
            l = yield lum({static: true, rules});
            const ips = [];
            l.on('add_static_ip', data=>ips.push(data));
            yield l.test({fake: 1});
            assert.equal(ips.length, 0);
        }));
    });
    describe('session_termination', ()=>{
        describe('http', ()=>{
            it('should terminate session', etask._fn(function*(_this){
                l = yield lum({pool_size: 1, session_termination: true});
                const r = yield l.test({fake: {
                    status: 502,
                    headers: {'x-luminati-error': consts.NO_PEERS_ERROR},
                }});
                assert.equal(r.body, consts.SESSION_TERMINATED_BODY);
                assert.equal(r.statusCode, 400);
                assert.ok(l.session_mgr.sessions.sessions[0].terminated);
            }));
            it('should not terminate when rotating', etask._fn(function*(){
                l = yield lum({pool_size: 0, rotate_session: true,
                    session_termination: true});
                yield l.test({fake: {
                    status: 502,
                    headers: {'x-luminati-error': consts.NO_PEERS_ERROR},
                }});
                const r = yield l.test({fake: 1});
                assert.equal(r.statusCode, 200);
            }));
            it('should not send requests on terminated', etask._fn(function*(){
                l = yield lum({pool_size: 1, session_termination: true});
                l.session_mgr.sessions.sessions[0].terminated = true;
                const r = yield l.test({fake: 1});
                assert.equal(r.body, consts.SESSION_TERMINATED_BODY);
                assert.equal(r.statusCode, 400);
            }));
            it('should unblock when session refreshed', etask._fn(function*(){
                l = yield lum({pool_size: 1, session_termination: true});
                l.session_mgr.sessions.sessions[0].terminated = true;
                l.session_mgr.refresh_sessions();
                const r = yield l.test({fake: 1});
                assert.equal(r.statusCode, 200);
            }));
        });
        describe('https', ()=>{
            // XXX krzysztof: to implement this test when better mocking for
            // https is built
        });
    });
    describe('smtp rules', function(){
        const t = (name, config, expected_status, expected_rules, opt)=>
            it(name, etask._fn(
        function*(_this){
            opt = opt||{};
            smtp.silent = !!opt.silent_timeout;
            proxy.fake = false;
            l = yield lum(Object.assign({history: true}, config));
            let socket = net.connect(24000, '127.0.0.1');
            socket.on('connect', ()=>{
                if (opt.abort)
                    socket.end();
                if (opt.silent_timeout)
                    setTimeout(()=>socket.end(), 20);
            });
            socket.on('data', ()=>{
                if (opt.close)
                    socket.end('QUIT');
                if (opt.smtp_close)
                    smtp.last_connection.end();
            });
            l.on('retry', _opt=>{
                l.lpm_request(_opt.req, _opt.res, _opt.head, _opt.post);
            });
            l.on('usage', ()=>this.continue());
            l.on('usage_abort', ()=>this.continue());
            yield this.wait();
            assert.equal(_.get(l, 'history.0.status_code'), expected_status);
            assert.equal(_.get(l, 'history.0.rules.length'), expected_rules);
        }));
        let config = {smtp: ['127.0.0.1:'+TEST_SMTP_PORT]};
        let rules = [{action: {ban_ip: 0}, action_type: 'ban_ip',
            body: '220', trigger_type: 'body'}];
        t('rules is triggered regular req',
            _.assign({}, config, {rules}), 200, 1, {close: true});
        t('rules is triggered when server ends connection',
            _.assign({}, config, {rules}), 200, 1, {smtp_close: true});
        // XXX viktor: fix code for test to pass
        // rules = [{action: {ban_ip: 0}, action_type: 'ban_ip',
        //     body: '^$', trigger_type: 'body'}];
        // t('rules is triggered on abort',
        //     _.assign({}, config, {rules}), 'canceled', 0, {abort: true});
        // XXX viktor: fix code for test to pass
        // rules = [{action: {retry: 2}, action_type: 'retry',
        //     body: '^$', trigger_type: 'body'}];
        // t('retry rule on timeout', _.assign({}, config, {rules}),
        //     'canceled', 1, {silent_timeout: true});
    });
    describe('util', ()=>{
        describe('create_count_stream', ()=>{
            let t = (name, limit, chunks, expected)=>it(name, function(done){
                let resp = {body_size: 0, body: []};
                let $count = Server.create_count_stream(resp, limit);
                let src = new Readable({
                    read(){ this.push('1234567890'); this.push(null); }
                });
                let dst = new Writable({
                    write(chunk, encoding, callback){ callback(); },
                });
                src.pipe($count).pipe(dst).on('finish', ()=>{
                    assert.equal(resp.body.length, chunks);
                    if (chunks)
                        assert.equal(resp.body[0].length, expected);
                    done();
                });
            });
            t('disabled', -1, 0, 0);
            t('cut', 5, 1, 5);
            t('enough', 15, 1, 10);
            t('unlimited', 0, 1, 10);
            t('undefined means unlimited', undefined, 1, 10);
        });
        describe('decode_body', ()=>{
            let t = (name, limit, expected)=>it(name, ()=>{
                let buffer = Buffer.from('1234567890');
                let body = lutil.decode_body([buffer], '', limit);
                assert.equal(body, expected);
            });
            t('disabled', -1, '');
            t('cut', 5, '12345');
            t('enough', 15, '1234567890');
            t('unlimited', 0, '1234567890');
            t('undefined means unlimited', undefined, '1234567890');
        });
    });
});
