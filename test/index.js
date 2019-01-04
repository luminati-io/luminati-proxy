// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, mocha:true*/
const _ = require('lodash');
const assert = require('assert');
const socks = require('@luminati-io/socksv5');
const ssl = require('../lib/ssl.js');
const request = require('request');
const lolex = require('lolex');
const etask = require('../util/etask.js');
const sinon = require('sinon');
const zsinon = require('../util/sinon.js');
const lpm_config = require('../util/lpm_config.js');
const Luminati = require('../lib/luminati.js');
const Timeline = require('../lib/timeline.js');
const {assert_has, http_proxy, http_ping} = require('./common.js');
const qw = require('../util/string.js').qw;
const test_url = {http: 'http://lumtest.com/test',
    https: 'https://lumtest.com/test'};
const customer = 'abc';
const password = 'xyz';

const pre_rule = (type, regex)=>({
    rules: {pre: [{action: type, url: regex||'.*'}]},
});
describe('proxy', ()=>{
    let proxy, ping;
    const lum = opt=>etask(function*(){
        opt = opt||{};
        if (opt.ssl===true)
            opt.ssl = Object.assign({requestCert: false}, ssl());
        const l = new Luminati(Object.assign({
            proxy: '127.0.0.1',
            proxy_port: proxy.port,
            customer,
            password,
            log: 'none',
            port: 24000,
        }, opt), {send_rule_mail: function(){}, rmt_cfg: {get: ()=>({})}});
        l.test = etask._fn(function*(_this, req_opt){
            if (typeof req_opt=='string')
                req_opt = {url: req_opt};
            req_opt = req_opt||{};
            req_opt.url = req_opt.url||test_url.http;
            req_opt.json = true;
            req_opt.rejectUnauthorized = false;
            return yield etask.nfn_apply(_this, '.request', [req_opt]);
        });
        yield l.listen();
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
            let res = yield l.test(req);
            assert.equal(ping.history.length, 1);
            let expected = {statusCode: 200, statusMessage: 'PONG'};
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
                l = yield lum(Object.assign({handle_usage: aggregator}, opt));
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
            describe('pool_size', ()=>{
                const t = pool_size=>it(''+pool_size, ()=>etask(function*(){
                    l = yield lum({pool_size, pool_type: 'round-robin'});
                    yield l.test();
                    assert.equal(proxy.history.length, 1);
                    assert.equal(proxy.history[0].url, test_url.http);
                    assert.equal(proxy.full_history.length, 1);
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
                describe('range', ()=>{
                    const pool = 50;
                    const t = (name, start, end)=>
                    it(name, etask._fn(function*(){
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
                    l = yield lum(Object.assign({keep_alive: 0.15}, opt));
                    yield l.test();
                    const s_f = proxy.full_history.length;
                    const s_h = proxy.history.length;
                    assert.equal(proxy.full_history.length, 0+s_f);
                    assert.equal(proxy.history.length, 0+s_h);
                    yield l.test();
                    assert.equal(proxy.full_history.length, 1+s_f);
                    assert.equal(proxy.history.length, 1+s_h);
                    yield etask.sleep(300);
                    assert.equal(proxy.full_history.length, 2+s_f);
                    assert.equal(proxy.history.length, 1+s_h);
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
                        l = yield lum(Object.assign({session_duration: 1},
                            opt));
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
                        l = yield lum(Object.assign({session_duration: 1},
                            opt));
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
            before(()=>clock = lolex.install({
                shouldAdvanceTime: true,
                advanceTimeDelta: 10,
                toFake: qw`setTimeout clearTimeout setInterval clearInterval
                    setImmediate clearImmediate`,
            }));
            after('after history aggregation', ()=>clock.uninstall());
            let history;
            const aggregator = data=>history.push(data);
            beforeEach(()=>history = []);
            const t = (name, _url, expected, opt)=>it(name, ()=>etask(
            function*(){
                ping.headers = ping.headers||{};
                ping.headers.connection = 'close';
                l = yield lum(Object.assign({history: true,
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
            l = yield lum({rules: true, _rules: {}});
            assert.ok(l.rules);
        }));
        const t = (name, status, rules=false, c=0)=>it(name,
        etask._fn(function*(_this){
            rules = rules || {post: [{
                    action: {ban_ip: '60min', retry: true},
                    head: true,
                    status,
                    url: 'lumtest.com'
            }]};
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
        t('should retry when status match', 200, null, 1);
        t('should ignore rule when status does not match', null, 404, 0);
        t('should prioritize', null, {post: [{
            action: {url: 'http://lumtest.com/fail_url'},
            head: true,
            status: 200,
            url: 'lumtest.com/test'
        }, {
            action: {ban_ip: '60min', retry: true},
            head: true,
            status: 200,
            url: 'lumtest.com/test',
        }]}, 1);
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
            l = yield lum({rules: true, _rules: {}});
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
        it('check get_time', ()=>etask(function*(){
            l = yield lum({rules: true, _rules: {}});
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
        it('check Trigger', ()=>{
            const Trigger = require('../lib/rules').Trigger;
            const t = (code, _url, expected)=>{
                const cond = new Trigger({trigger_code: code});
                assert.equal(cond.test({url: _url}), expected);
            };
            t(undefined, '', true);
            t('', '', true);
            t('', 'http://facebook.com', true);
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
        it('check _can_retry', ()=>etask(function*(){
            l = yield lum({rules: true, _rules: {}});
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
            l = yield lum({rules: true, _rules: {}});
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
            l = yield lum({rules: true, _rules: {}});
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
            l = yield lum({rules: true, _rules: {}});
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
            l = yield lum({rules: true, _rules: {}});
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
            r = l.rules.can_retry({retry: 1}, {},
                {retry_port: 24001, retry: true});
            assert.ok(r);
        }));
        it('check post_need_body', ()=>etask(function*(){
            l = yield lum({rules: {post: [{url: 'test'}]}});
            const t = (req, expected)=>{
                const r = l.rules.post_need_body(req);
                assert.equal(r, expected);
            };
            t({ctx: {url: 'invalid'}}, false);
            t({ctx: {url: 'test'}}, false);
            yield l.stop(true);
            l = yield lum({rules: {post: [{type: 'after_body', body: '1',
                url: 'test'}]}});
            t({ctx: {url: 'test'}}, true);
        }));
        it('check post_body', ()=>etask(function*(){
            l = yield lum({rules: {post: [{
                body: 'test',
                action: {process: true},
                url: 'test',
            }]}});
            const t = (req, _res, body, expected)=>{
                const r = l.rules.post_body(req, {}, {}, _res, body);
                assert.equal(r, expected);
            };
            sinon.stub(l.rules, 'action').returns(true);
            sinon.stub(l.rules, 'process_response');
            sinon.stub(l.rules, 'cmp').returns(true);
            t({ctx: {h_context: 'STATUS CHECK'}});
        }));
        it('check post', ()=>etask(function*(){
            l = yield lum({rules: {post: [{
                ipban: true,
                url: 'test',
            }]}});
            const t = (req, _res, expected)=>{
                req.ctx = Object.assign({skip_rule: ()=>false}, req.ctx);
                const r = l.rules.post(req, {}, {}, _res);
                assert.equal(r, expected);
            };
            t({ctx: {h_context: 'STATUS CHECK'}});
            t({ctx: {url: 'invalid'}});
            sinon.stub(l.rules, 'action').returns(true);
            t({ctx: {url: 'test'}}, {}, undefined);
            const crtr_stub = sinon.stub(l.rules, 'check_req_time_range')
                .returns(true);
            t({ctx: {url: 'test'}}, {}, true);
            crtr_stub.returns(false);
            const bh_stub = sinon.stub(l.banlist, 'has').returns(true);
            t({ctx: {url: 'test'}}, {hola_headers: {
                'x-hola-timeline-debug': '1 2 3'}}, true);
            bh_stub.reset();
            sinon.stub(l.rules, 'cmp').returns(true);
            t({ctx: {url: 'test'}}, {}, true);
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
                const r = l.rules.action({ctx: {set_rule: ()=>null}}, {}, {},
                    {}, {email: true, reserve_session: true,
                        fast_pool_session: true},
                    {}, {type: 'max_req_time', value: '200ms'});
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
                const r = l.rules.action(req, {}, {},
                    {hola_headers: {'x-hola-timeline-debug': '1 2 3'}},
                    {ban_ip: '1d'});
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
                const r = l.rules.action(req, {}, {},
                    {hola_headers: {'x-hola-timeline-debug': '1 2 3'}},
                    {refresh_ip: true});
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
                l = yield lum({rules: {pre: [
                    {url: '', action: 'null_response', email: 'test@mail'},
                ]}});
                const send_stub = sinon.stub(l, '_send_rule_mail',
                    (to, trigger, action, _url)=>{
                        assert.equal(to, 'test@mail');
                        assert.deepEqual(trigger, {type: 'URL', value: ''});
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
                l = yield lum({rules: {pre: [
                    {url: '', action: 'direct', email: 'test@mail'},
                ]}});
                const send_stub = sinon.stub(l, '_send_rule_mail',
                    (to, trigger, action, _url)=>{
                        assert.equal(to, 'test@mail');
                        assert.deepEqual(trigger, {type: 'URL', value: ''});
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
                l = yield lum({rules: {pre: [
                    {url: '', action: 'switch_port', email: 'test@mail',
                        port: 1},
                ]}});
                const _req = {ctx: {response: {}, url: 'lumtest.com',
                    log: l.log, timeline: new Timeline(1)}};
                const _res = {end: sinon.stub(), write: sinon.stub()};
                const _head = {};
                const get_port_stub = sinon.stub(l, 'get_other_port',
                    port=>{
                        assert.equal(port, 1);
                        return {once: ()=>null, _request: (req, res, head)=>{
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
        describe('call post after pre', ()=>{
            const t = action=>it(action, ()=>etask(function*(){
                l = yield lum({rules: {pre: [{action, url: '.*'}]}});
                const post_stub = sinon.stub(l.rules, 'post');
                yield l.test(ping.http.url);
                sinon.assert.calledOnce(post_stub);
            }));
            t('null_response');
            t('bypass_proxy');
            t('direct');
            it('switch_port', ()=>etask(function*(){
                l = yield lum({rules: {pre: [{action: 'switch_port', url: '.*',
                    port: 24001}]}});
                const l2 = yield lum({port: 24001});
                sinon.stub(l, 'get_other_port', ()=>l2);
                const post_stub = sinon.stub(l.rules, 'post');
                yield l.test(ping.http.url);
                sinon.assert.calledOnce(post_stub);
                l2.stop(true);
            }));
            it('switch_port invalid port', ()=>etask(function*(){
                l = yield lum({rules: {pre: [{action: 'switch_port', url: '.*',
                    port: 24002}]}});
                sinon.stub(l, 'get_other_port', ()=>null);
                const post_stub = sinon.stub(l.rules, 'post');
                yield l.test(ping.http.url);
                sinon.assert.calledOnce(post_stub);
            }));
        });
        describe('banip combined with', ()=>{
            const get_banip_rule = (t=10)=>({
                action: {ban_ip: `${t}min`},
                action_type: 'ban_ip',
                status: 200,
            });
            const get_retry_rule = (retry_port=24001)=>({
                action: {retry: true, retry_port},
                action_type: 'retry_port',
                status: 200,
            });
            const inject_headers = (li, ip='ip')=>{
                const handle_proxy_resp_org = li._handle_proxy_resp.bind(li);
                return sinon.stub(li, '_handle_proxy_resp', (...args)=>_res=>{
                    _res.headers['x-hola-timeline-debug'] = `1 2 3 ${ip}`;
                    _res.headers['x-hola-ip'] = ip;
                    return handle_proxy_resp_org(...args)(_res);
                });
            };
            const t_pre = (action, ban)=>it(action, ()=>etask(function*(){
                l = yield lum({rules: {
                    pre: [{action, url: '.*'}],
                    post: [get_banip_rule()],
                }});
                if (action=='bypass_proxy')
                    sinon.stub(l, 'send_bypass_req');
                else
                    inject_headers(l);
                const ban_stub = sinon.stub(l.banlist, 'add');
                yield l.test(ping.http.url);
                assert.equal(ban_stub.called, +ban);
            }));
            t_pre('null_response', false);
            t_pre('bypass_proxy', false);
            t_pre('direct', true);
            it('switch_port', ()=>etask(function*(){
                l = yield lum({rules: {pre: [{action: 'switch_port',
                    url: '.*'}], post: [get_banip_rule()]}});
                const l2 = yield lum({port: 24001, rules: {post:
                    [get_banip_rule(30)]}});
                inject_headers(l2);
                sinon.stub(l, 'get_other_port', ()=>l2);
                const ban_stub = sinon.stub(l.banlist, 'add');
                const ban_stub_l2 = sinon.stub(l2.banlist, 'add');
                yield l.test(ping.http.url);
                sinon.assert.calledWith(ban_stub, 'ip', 600000);
                sinon.assert.calledWith(ban_stub_l2, 'ip', 1800000);
                l2.stop(true);
            }));
            it('waterfall', ()=>etask(function*(){
                l = yield lum({rules: {post: [get_banip_rule(),
                    get_retry_rule()]}});
                const l2 = yield lum({port: 24001, rules: {post: [
                    get_banip_rule(30)]}});
                const header_stub = inject_headers(l);
                const header_stub_l2 = inject_headers(l2, 'ip2');
                sinon.stub(l, 'get_other_port', ()=>l2);
                const ban_stub = sinon.stub(l.banlist, 'add');
                const ban_stub_l2 = sinon.stub(l2.banlist, 'add');
                yield l.test(ping.http.url);
                sinon.assert.calledWith(ban_stub, 'ip', 600000);
                sinon.assert.calledWith(ban_stub, 'ip2', 600000);
                sinon.assert.calledWith(ban_stub_l2, 'ip2', 1800000);
                header_stub.restore();
                header_stub_l2.restore();
                inject_headers(l, 'ip3');
                inject_headers(l2, 'ip4');
                yield l.test(ping.http.url);
                sinon.assert.calledWith(ban_stub, 'ip3', 600000);
                sinon.assert.calledWith(ban_stub, 'ip4', 600000);
                sinon.assert.calledWith(ban_stub_l2, 'ip4', 1800000);
                l2.stop(true);
            }));
            it('waterfall first', ()=>etask(function*(){
                l = yield lum({rules: {post: [get_retry_rule(),
                    get_banip_rule()]}});
                const l2 = yield lum({port: 24001, rules: {post: [
                    get_banip_rule(30)]}});
                inject_headers(l2);
                sinon.stub(l, 'get_other_port', ()=>l2);
                const ban_stub = sinon.stub(l.banlist, 'add');
                const ban_stub_l2 = sinon.stub(l2.banlist, 'add');
                yield l.test(ping.http.url);
                sinon.assert.calledWith(ban_stub, 'ip', 600000);
                sinon.assert.calledWith(ban_stub_l2, 'ip', 1800000);
                l2.stop(true);
            }));
            describe('existing session', ()=>{
                let ban_stub;
                afterEach(()=>{
                    sinon.assert.calledWith(ban_stub, 'ip', 600000);
                });
                const build_options = opt=>{
                    opt = opt||{};
                    return Object.assign({
                        rules: {post: [get_banip_rule()]},
                        session: true,
                        pool_type: 'sequential',
                        pool_size: 1,
                        keep_alive: true,
                        max_requests: 0,
                        session_duration: 0,
                        sticky_ip: false,
                        random_user_agent: false,
                    }, opt);
                };
                const prepare_ban = ()=>{
                    inject_headers(l);
                    const banlist_add_orig = l.banlist.add.bind(l.banlist);
                    ban_stub = sinon.stub(l.banlist, 'add',
                        (i, t)=>banlist_add_orig(i, t));
                };
                const t = (desc, opt)=>it(desc, ()=>etask(function*(){
                    l = yield lum(build_options(opt));
                    prepare_ban();
                    yield l.test(ping.http.url);
                    const first_session = l.session_mgr.sessions.sessions[0];
                    yield l.test(ping.http.url);
                    const second_session = l.session_mgr.sessions.sessions[0];
                    assert.ok(first_session!=second_session);
                }));
                t('long session');
                t('random UA/online shopping', {keep_alive: false,
                    random_user_agent: true});
                t('custom', {session: false, keep_alive: false});
                it('sequential', ()=>etask(function*(){
                    l = yield lum(build_options({pool_size: 0}));
                    prepare_ban();
                    yield l.test(ping.http.url);
                    const first_session = l.session_mgr.session;
                    yield l.test(ping.http.url);
                    const second_session = l.session_mgr.session;
                    assert.ok(first_session!=second_session);
                }));
                it('per machine', ()=>etask(function*(){
                    l = yield lum(build_options({session: false,
                        pool_size: 0, sticky_ip: true}));
                    prepare_ban();
                    yield l.test(ping.http.url);
                    const sticky_sessions = l.session_mgr.sticky_sessions;
                    const first_session = Object.values(sticky_sessions)[0];
                    yield l.test(ping.http.url);
                    const second_session = Object.values(sticky_sessions)[0];
                    assert.ok(first_session!=second_session);
                }));
                it('round robin', ()=>etask(function*(){
                    l = yield lum(build_options({pool_type: 'round-robin',
                        pool_size: 2, max_requests: 1}));
                    prepare_ban();
                    yield l.test(ping.http.url);
                    const first_session = l.session_mgr.sessions.sessions[0];
                    yield l.test(ping.http.url);
                    const second_session = l.session_mgr.sessions.sessions[1];
                    assert.ok(first_session!=second_session);
                }));
                it('high performance', ()=>etask(function*(){
                    l = yield lum(build_options({pool_type: 'round-robin',
                        pool_size: 2}));
                    prepare_ban();
                    yield l.test(ping.http.url);
                    const first_sessions = l.session_mgr.sessions.sessions
                        .map(s=>s.session);
                    yield l.test(ping.http.url);
                    const second_sessions = l.session_mgr.sessions.sessions
                        .map(s=>s.session);
                    assert.notDeepEqual(first_sessions, second_sessions);
                }));
            });
        });
    });
    describe('reserve session', ()=>{
        let history;
        const aggregator = data=>history.push(data);
        beforeEach(etask._fn(function*(_this){
            const rules = {post: [{
                action: {reserve_session: true},
                head: true,
                status: 200,
            }]};
            history = [];
            l = yield lum({handle_usage: aggregator, rules,
                session: true, max_requests: 1, keep_alive: 2});
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
            assert.notEqual(unames[0], unames[2]);
            assert.equal(unames[unames.length-1], unames[0]);
        }));
        it('should keep reserved session alive', etask._fn(function*(_this){
            _this.timeout(6000);
            yield l.test();
            const hst = history.length;
            assert.ok(hst<=2);
            yield etask.sleep(3000);
            assert.ok(hst<history.length);
        }));
    });
});
