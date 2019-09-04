// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, mocha:true*/
const _ = require('lodash');
const assert = require('assert');
const dns = require('dns');
const socks = require('lum_socksv5');
const ssl = require('../lib/ssl.js');
const request = require('request');
const lolex = require('lolex');
const etask = require('../util/etask.js');
const {ms} = require('../util/date.js');
const sinon = require('sinon');
const zsinon = require('../util/sinon.js');
const lpm_config = require('../util/lpm_config.js');
const Server = require('../lib/server.js');
const Timeline = require('../lib/timeline.js');
const Config = require('../lib/config.js');
const {decode_body} = require('../lib/util.js');
const consts = require('../lib/consts.js');
const {assert_has, http_proxy, http_ping} = require('./common.js');
const qw = require('../util/string.js').qw;
const test_url = {http: 'http://lumtest.com/test',
    https: 'https://lumtest.com/test'};
const customer = 'abc';
const password = 'xyz';

const pre_rule = (type, regex)=>({
    rules: [{action: {[type]: true}, url: regex}],
});
describe('proxy', ()=>{
    let proxy, ping;
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
        ping = yield http_ping();
        console.log('End prep', new Date());
    }));
    after('after all', ()=>etask._fn(function*after(_this){
        _this.timeout(3000);
        if (proxy)
            yield proxy.stop();
        proxy = null;
        if (ping)
            yield ping.stop();
        ping = null;
    }));
    beforeEach(()=>{
        proxy.fake = true;
        proxy.connection = null;
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
            const res = yield l.test(req);
            assert.equal(ping.history.length, 1);
            const expected = {statusCode: 200, statusMessage: 'PONG'};
            if (req.body)
                Object.assign(expected, {body: req.body});
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
                const res = yield l.test(ping.http.url);
                assert.ok(!res.body.headers['x-hola-agent']);
            }));
            it('not added when using external proxy', ()=>etask(function*(){
                l = yield lum({ext_proxies: ['username:password@1.1.1.1']});
                // XXX krzysztof: this needs completely new logic for testing
                // const stub = sinon.stub(l.http, 'request').returns({});
                // request that stubbs connection to the internet
                // const res = yield l.test(ping.http.url);
                // assert.ok(!res.body.headers['x-hola-agent']);
            }));
        });
        describe('X-Hola-Context', ()=>{
            const t = (name, _url, opt, target, skip_res)=>it(name, ()=>etask(
            function*(){
                const context = 'context-1';
                l = yield lum(opt);
                const history = [];
                l.on('usage', data=>history.push(data));
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
        describe('short_username', ()=>{
            const t = (name, user, short, expected)=>it(name, ()=>etask(
            function*(){
                l = yield lum({short_username: short});
                const res = yield l.test({headers: {
                    'proxy-authorization': 'Basic '+
                        Buffer.from(user+':pass').toString('base64'),
                }});
                const m = res.body.headers['proxy-authorization']
                .match(/^Basic (.*)/);
                const h = Buffer.from(m[1], 'base64').toString('ascii');
                const parts = h.split(':');
                assert_has(res.body.auth, expected);
                if (short)
                    assert.ok(parts[0].length <= user.length);
                else
                    assert.ok(parts[0].length >= user.length);
            }));
            t('short notation',
                'lum-cu-ttt-z-zzz-d-s-sss-to-5-dbg-full-cy-us-st-fl-ct-miami',
                true, {
                customer: 'ttt',
                zone: 'zzz',
                direct: true,
                session: 'sss',
                debug: 'full',
                country: 'us',
                state: 'fl',
                city: 'miami',
            });
            t('long notation',
                'lum-cu-ttt-z-zzz-d-s-sss-to-5-dbg-full-cy-us-st-fl-ct-miami',
                false, {
                customer: 'ttt',
                zone: 'zzz',
                direct: true,
                session: 'sss',
                debug: 'full',
                country: 'us',
                state: 'fl',
                city: 'miami',
            });
        });
        describe('pool', ()=>{
            describe('idle_pool', ()=>{
                it('should idle', etask._fn(function*(_this){
                    l = yield lum({pool_size: 1, idle_pool: 500,
                        keep_alive: 0.2});
                    yield etask.sleep(900);
                    assert.equal(proxy.full_history.length, 3);
                }));
                it('should not idle', etask._fn(function*(_this){
                    l = yield lum({pool_size: 1, idle_pool: false,
                        keep_alive: 0.1});
                    yield etask.sleep(490);
                    assert.equal(proxy.full_history.length, 5);
                }));
                it('should call reset idle pool on each connection', etask._fn(
                function*(_this){
                    l = yield lum({pool_size: 1});
                    const spy = sinon.spy(l.session_mgr, 'reset_idle_pool');
                    yield l.test({fake: 1});
                    sinon.assert.calledOnce(spy);
                }));
                it('should set idle time correctly', etask._fn(
                function*(_this){
                    l = yield lum({pool_size: 1});
                    let offset = l.session_mgr.idle_date-Date.now();
                    assert.ok(Math.abs(offset-ms.HOUR)<100);
                    yield etask.sleep(500);
                    yield l.test({fake: 1});
                    offset = l.session_mgr.idle_date-Date.now();
                    assert.ok(Math.abs(offset-ms.HOUR)<100);
                }));
            });
            describe('pool_size', ()=>{
                const t = pool_size=>it(''+pool_size, ()=>etask(function*(){
                    l = yield lum({pool_size});
                    yield l.test({fake: 1});
                    assert.equal(proxy.history.length, 0);
                    assert.equal(proxy.full_history.length, pool_size);
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
            describe('max_requests', ()=>{
                it('disabled', ()=>etask(function*(){
                    l = yield lum({max_requests: '0'});
                    assert.equal(l.session_mgr.opt.max_requests, 0);
                }));
                const test_call = ()=>etask(function*(){
                    const res = yield l.test({fake: 1});
                    assert.ok(res.body);
                    return res.body;
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
                t('1, default pool', {max_requests: 1, pool_size: 1});
                t('2, default pool', {max_requests: 2, pool_size: 2});
                t('5, default pool', {max_requests: 5, pool_size: 5});
                t('1, sticky_ip', {max_requests: 1, sticky_ip: true});
                t('2, sticky_ip', {max_requests: 2, sticky_ip: true});
                t('5, sticky_ip', {max_requests: 5, sticky_ip: true});
                t('1, session using seed', {max_requests: 1});
                t('2, session using seed', {max_requests: 2});
                t('5, session using seed', {max_requests: 5});
                it('no pool size', etask._fn(function*(_this){
                    _this.timeout(4000);
                    l = yield lum({max_requests: 1, pool_size: 0});
                    const s1 = yield test_call();
                    const s2 = yield test_call();
                    assert.notEqual(s1, s2);
                }));
            });
            describe('keep_alive', ()=>{
                const assert_keep_alive = num=>assert.equal(
                    proxy.full_history.length-proxy.history.length, num);
                const t = (name, opt, ex)=>it(name, etask._fn(function*(_this){
                    l = yield lum(Object.assign({keep_alive: 0.15}, opt));
                    yield etask.sleep(50);
                    assert.equal(proxy.history.length, 0);
                    assert_keep_alive(ex[0]);
                    yield l.test();
                    assert.equal(proxy.history.length, 1);
                    assert_keep_alive(ex[1]);
                    yield etask.sleep(0.2*ms.SEC);
                    assert.equal(proxy.history.length, 1);
                    assert_keep_alive(ex[2]);
                }));
                t('pool', {pool_size: 1}, [1, 1, 2]);
                t('sticky_ip', {sticky_ip: true}, [0, 0, 1]);
                t('session explicit', {session: 'test'}, [1, 1, 2]);
                t('session using seed', {seed: 'seed'}, [0, 0, 1]);
            });
            describe('session_duration', ()=>{
                describe('change after specified timeout', ()=>{
                    const t = (name, opt)=>it(name, etask._fn(function*(_this){
                        l = yield lum(Object.assign({session_duration: 0.1},
                            opt));
                        const initial = yield l.test({fake: 1});
                        yield etask.sleep(100);
                        const second = yield l.test({fake: 1});
                        assert.notEqual(initial.body, second.body);
                    }));
                    t('pool', {pool_size: 1});
                    t('sticky_ip', {sticky_ip: true});
                    t('session using seed', {seed: 'seed'});
                });
                describe('does not change before specified timeout', ()=>{
                    const t = (name, opt)=>it(name, etask._fn(function*(_this){
                        l = yield lum(Object.assign({session_duration: 1},
                            opt));
                        const initial = yield l.test({fake: 1});
                        const res1 = yield l.test({fake: 1});
                        const res2 = yield l.test({fake: 1});
                        assert.equal(initial.body, res1.body);
                        assert.equal(initial.body, res2.body);
                    }));
                    t('sticky_ip', {sticky_ip: true});
                    t('session using seed', {seed: 'seed'});
                    t('pool 1', {pool_size: 1});
                    it('pool 3', etask._fn(function*(_this){
                        l = yield lum({session_duration: 0.1, pool_size: 3});
                        yield etask.sleep(150);
                        const res1 = yield l.test({fake: 1});
                        const res2 = yield l.test({fake: 1});
                        assert.equal(res1.body, res2.body);
                    }));
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
            t('debug', {debug: 'none'});
            t('raw', {raw: true});
            t('direct', pre_rule('direct'), {direct: true});
            t('session explicit', {session: 'test_session'});
            t('session using seed', {seed: 'seed'}, {session: 'seed_1'});
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
            t1('pool', {pool_size: 1}, /24000_[0-9a-f]+_1/,
                /24000_[0-9a-f]+_2/);
            t1('sticky_ip', {sticky_ip: true},
                /24000_127_0_0_1_[0-9a-f]+_1/, /24000_127_0_0_1_[0-9a-f]+_2/);
            t1('session using seed', {seed: 'seed'},
                /seed_1/, /seed_2/);
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
            let history;
            beforeEach(()=>history = []);
            const t = (name, _url, expected, opt)=>it(name, ()=>etask(
            function*(){
                ping.headers = ping.headers||{};
                ping.headers.connection = 'close';
                l = yield lum(Object.assign({history: true}, opt));
                l.on('usage', data=>history.push(data));
                assert.equal(history.length, 0);
                const res = yield l.test(_url());
                yield etask.sleep(400);
                res.socket.destroy();
                assert.equal(history.length, 1);
                assert_has(history[0], expected());
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
            it('pool', etask._fn(function*(_this){
                l = yield lum({pool_size: 1, keep_alive: 0.3});
                l.on('usage', data=>history.push(data));
                yield l.test();
                yield etask.sleep(400);
                assert_has(history, [
                    {context: 'SESSION KEEP ALIVE'},
                    {context: 'RESPONSE'},
                    {context: 'SESSION KEEP ALIVE'},
                ]);
                assert.equal(history.length, 3);
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
                sinon.stub(l, 'is_whitelisted').onFirstCall().returns(false);
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
                sinon.stub(l, 'is_whitelisted').onFirstCall().returns(false);
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
            const ips = ['1.1.1.1', '2.2.2.2', '3.3.3.3'];
            before(()=>{
                dns.resolve = (domain, cb)=>{
                    cb(null, ips);
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
            it('should resolve if it is turned on', etask._fn(function*(){
                l = yield lum({proxy: 'domain.com', proxy_resolve: true});
                assert.equal(l.hosts.length, 3);
                assert.deepEqual(l.hosts.sort(), ips);
            }));
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
                l.lpm_request(opt.req, opt.res, opt.head);
                l.once('response', opt.post);
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
    });
    describe('rules', ()=>{
        const inject_headers = (li, ip, ip_alt)=>{
            ip = ip||'ip';
            let call_count = 0;
            const handle_proxy_resp_org = li.handle_proxy_resp.bind(li);
            return sinon.stub(li, 'handle_proxy_resp', (...args)=>_res=>{
                const ip_inj = ip_alt && call_count++%2 ? ip_alt : ip;
                _res.headers['x-hola-timeline-debug'] = `1 2 3 ${ip_inj}`;
                _res.headers['x-hola-ip'] = ip_inj;
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
                    else if (event=='end')
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
            const new_body = JSON.parse(decode_body(response.body).toString());
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
            const Trigger = require('../lib/rules').Trigger;
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
        it('check check_req_time_range', ()=>etask(function*(){
            const _date = '2013-08-13 14:00:00';
            zsinon.clock_set({now: _date});
            l = yield lum({rules: []});
            const rs_stub = sinon.stub(l.session_mgr,
                'remove_session_from_pool');
            assert.ok(!l.rules.check_req_time_range({}, {}));
            assert.ok(!rs_stub.called);
            assert.ok(l.rules.check_req_time_range({ctx: {pool_key: 'test',
                timeline: {req: {create: Date.now()-40}}}}, {
                max_req_time: 41}));
            assert.ok(!rs_stub.called);
            assert.ok(!l.rules.check_req_time_range({ctx: {pool_key: 'test',
                timeline: {req: {create: Date.now()-40}}}}, {
                max_req_time: 39}));
            assert.ok(!rs_stub.called);
            assert.ok(!l.rules.check_req_time_range({ctx: {
                pool_key: 'fast_pool',
                timeline: {req: {create: Date.now()-40}}}}, {
                max_req_time: 39}));
            assert.ok(rs_stub.called);
            assert.ok(!l.rules.check_req_time_range({ctx: {pool_key: 'test',
                timeline: {req: {create: Date.now()-40}}}}, {
                    max_req_time: 50, min_req_time: 45}));
            assert.ok(l.rules.check_req_time_range({ctx: {pool_key: 'test',
                timeline: {req: {create: Date.now()-40}}}}, {
                    max_req_time: 50, min_req_time: 39}));
            assert.ok(l.rules.check_req_time_range({ctx: {pool_key: 'test',
                timeline: {req: {create: Date.now()-40}}}}, {
                    min_req_time: 39}));
            assert.ok(!l.rules.check_req_time_range({ctx: {pool_key: 'test',
                timeline: {req: {create: Date.now()-40}}}}, {
                    min_req_time: 45}));
            zsinon.clock_restore();
        }));
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
            it('email, reserve_session, fast_pool_session', ()=>
            etask(function*(){
                l = yield lum({rules: []});
                const cr_stub = sinon.stub(l.rules, 'can_retry')
                    .returns(false);
                const email_stub = sinon.stub(l, 'send_email');
                const rps_stub = sinon.stub(l.session_mgr,
                    'add_reserve_pool_session');
                const fps_stub = sinon.stub(l.session_mgr,
                    'add_fast_pool_session');
                const r = l.rules.action({ctx: {set_rule: ()=>null}}, {}, {},
                    {max_req_time: 1000, action: {email: true,
                    reserve_session: true, fast_pool_session: true}}, {});
                assert.ok(!r);
                assert.ok(cr_stub.called);
                assert.ok(email_stub.called);
                assert.ok(rps_stub.called);
                assert.ok(fps_stub.called);
            }));
            it('ban_ip', ()=>etask(function*(){
                l = yield lum({rules: []});
                sinon.stub(l.rules, 'can_retry').returns(true);
                sinon.stub(l.rules, 'retry');
                const refresh_stub = sinon.stub(l.session_mgr,
                    'refresh_sessions');
                const add_stub = sinon.stub(l, 'banip');
                const req = {ctx: {}};
                const opt = {_res: {
                    hola_headers: {'x-hola-timeline-debug': '1 2 3 1.2.3.4'}}};
                const r = l.rules.action(req, {}, {}, {action: {ban_ip: 1000}},
                    opt);
                assert.ok(r);
                assert.ok(add_stub.called);
                assert.ok(refresh_stub.called);
            }));
            it('retry should refresh the session', ()=>etask(function*(){
                l = yield lum({
                    pool_size: 1,
                    rules: [{action: {retry: true}, status: '200'}],
                });
                l.on('retry', opt=>{
                    l.lpm_request(opt.req, opt.res, opt.head);
                });
                const session_a = l.session_mgr.sessions.sessions[0].session;
                yield l.test({fake: 1});
                const session_b = l.session_mgr.sessions.sessions[0].session;
                assert.notEqual(session_a, session_b);
            }));
            xdescribe('dc pool', ()=>{
                it('adds to pool when prefill turned off and gathering',
                ()=>etask(function*(){
                    const ips = ['2.3.4.5'];
                    l = yield lum({
                        pool_prefill: false,
                        keep_alive: 0,
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
                        pool_prefill: false,
                        keep_alive: 0,
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
                        keep_alive: 0,
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
                        pool_prefill: false,
                        keep_alive: 0,
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
            xdescribe('ban_ip per domain', ()=>{
                let ban_spy;
                const t = (url, expected, ban_count=0)=>{
                    const req = {ctx: {url, skip_rule: ()=>false}};
                    l.rules.post(req, {}, {}, {status_code: 200,
                        headers: {'x-hola-timeline-debug': '1 2 3 ip'}});
                    Object.entries(expected).forEach(([d, c])=>{
                        const req_count = l.rules._post[0].domains.domains
                            .get(d).length;
                        assert.equal(req_count, c);
                    });
                    sinon.assert.callCount(ban_spy, ban_count);
                };
                beforeEach(()=>etask(function*(){
                    l = yield lum({rules: [{action_type: 'ban_ip',
                        status: '200', action: {ban_ip: 10*ms.MIN,
                        ban_ip_domain_reqs: 4, ban_ip_domain_time: 200}}]});
                    ban_spy = sinon.spy(l, 'banip');
                }));
                it('group requests by domain', ()=>{
                    t('http://lumtest.com/test', {'lumtest.com': 1});
                    t('http://lumtest.com/another', {'lumtest.com': 2});
                    t('http://anotherdomain.com/test', {'lumtest.com': 2,
                        'anotherdomain.com': 1});
                    t('http://lumtest.com/test', {'lumtest.com': 3,
                        'anotherdomain.com': 1});
                    t('http://anotherdomain.com/test', {'lumtest.com': 3,
                        'anotherdomain.com': 2});
                });
                it('remove expired requests', ()=>etask(function*(){
                    t('http://lumtest.com/test', {'lumtest.com': 1});
                    yield etask.sleep(100);
                    t('http://lumtest.com/test', {'lumtest.com': 2});
                    yield etask.sleep(100);
                    t('http://lumtest.com/test', {'lumtest.com': 2});
                    yield etask.sleep(200);
                    t('http://lumtest.com/test', {'lumtest.com': 1});
                }));
                it('ban when reach limit', ()=>{
                    t('http://lumtest.com/test', {'lumtest.com': 1});
                    t('http://lumtest.com/test', {'lumtest.com': 2});
                    t('http://anotherdomain.com/test', {'lumtest.com': 2,
                        'anotherdomain.com': 1});
                    t('http://lumtest.com/test', {'lumtest.com': 3,
                        'anotherdomain.com': 1});
                    t('http://anotherdomain.com/test', {'lumtest.com': 3,
                        'anotherdomain.com': 2});
                    t('http://lumtest.com/test', {'lumtest.com': 4,
                        'anotherdomain.com': 2}, 1);
                    t('http://anotherdomain.com/test', {'lumtest.com': 4,
                        'anotherdomain.com': 3}, 1);
                    t('http://anotherdomain.com/test', {'lumtest.com': 4,
                        'anotherdomain.com': 4}, 2);
                });
            });
            it('refresh_ip', ()=>etask(function*(){
                l = yield lum({rules: []});
                sinon.stub(l.rules, 'can_retry').returns(true);
                sinon.stub(l.rules, 'retry');
                const ref_stub = sinon.stub(l, 'refresh_ip').returns('test');
                const req = {ctx: {}};
                const opt = {_res:
                    {hola_headers: {'x-hola-timeline-debug': '1 2 3 ip'}}};
                const r = l.rules.action(req, {}, {},
                    {action: {refresh_ip: true}}, opt);
                assert.ok(r);
                assert.ok(ref_stub.called);
                assert.equal(l.refresh_task, 'test');
            }));
        });
        describe('pre', ()=>{
            it('action null_response', ()=>etask(function*(){
                l = yield lum({rules: [{action: {null_response: true,
                    email: 'test@mail'}}]});
                l.on('send_rule_mail', data=>{
                    assert.equal(data.port, 24000);
                    assert.equal(data.email, 'test@mail');
                    assert.equal(data.url, 'lumtest.com');
                });
                const _req = {ctx: {response: {}, url: 'lumtest.com',
                    log: l.log, timeline: new Timeline(1)}};
                const _res = {end: sinon.stub(), write: sinon.stub()};
                const r = l.rules.pre(_req, _res, {});
                assert.equal(r.status_code, 200);
                assert.equal(r.status_message, 'NULL');
            }));
            it('action direct', ()=>etask(function*(){
                l = yield lum({rules: [{url: '', action: {direct: true,
                    email: 'test@mail'}}]});
                l.on('send_rule_mail', data=>{
                    assert.equal(data.port, 24000);
                    assert.equal(data.email, 'test@mail');
                    assert.equal(data.url, 'lumtest.com');
                });
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
                    l2.lpm_request(opt.req, opt.res, opt.head);
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
                    l2.lpm_request(opt.req, opt.res, opt.head);
                    l2.once('response', opt.post);
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
                    l2.lpm_request(opt.req, opt.res, opt.head);
                    l2.once('response', opt.post);
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
                    l2.lpm_request(opt.req, opt.res, opt.head);
                    l2.once('response', opt.post);
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
                t('random user agent', {random_user_agent: true});
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
                    yield prepare_lum({pool_size: 2, max_requests: 1});
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
    describe('reserve session', ()=>{
        let history;
        beforeEach(etask._fn(function*(_this){
            const rules = [{action: {reserve_session: true}, status: '200'}];
            history = [];
            l = yield lum({rules, keep_alive: 0, max_requests: 1,
                pool_size: 2});
            l.on('usage', data=>history.push(data));
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
            const unames = history.map(h=>h.username);
            assert.notEqual(unames[0], unames[1]);
            assert.equal(unames[unames.length-1], unames[0]);
        }));
        xit('should keep reserved session alive', etask._fn(function*(_this){
            _this.timeout(6000);
            yield l.test();
            const hst = history.length;
            assert.ok(hst<=2);
            yield etask.sleep(3000);
            assert.ok(hst<history.length);
        }));
    });
    xdescribe('long_availability', ()=>{
        it('should keep the number of sessions', etask._fn(function*(_this){
            _this.timeout(6000);
            l = yield lum({pool_type: 'long_availability', pool_size: 10});
            yield l.test();
            assert.equal(l.session_mgr.sessions.sessions.length, 10);
            const initial_sessions = l.session_mgr.sessions.sessions;
            assert.ok(initial_sessions[0].session.endsWith('1'));
            assert.ok(initial_sessions[9].session.endsWith('10'));
            l.session_mgr.send_info_request = ()=>null;
            yield etask.sleep(1500);
            const new_sessions = l.session_mgr.sessions.sessions;
            assert.equal(new_sessions.length, 10);
            assert.ok(new_sessions[0].session.endsWith('11'));
            assert.ok(new_sessions[9].session.endsWith('20'));
        }));
    });
    describe('gather and consume', ()=>{
        it('should not add duplicated sessions', etask._fn(function*(_this){
            const rules = [{status: '200', action: {reserve_session: true}}];
            l = yield lum({pool_size: 3, rules, pool_prefill: false});
            const ips = {};
            l.on('add_static_ip', data=>{
                if (ips[data.ip])
                    throw 'duplicate';
                ips[data.ip] = true;
            });
            yield l.test({fake: 1});
            yield l.test({fake: 1});
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
                l = yield lum({pool_size: 0, max_requests: 1,
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
});
