// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, mocha:true*/
const assert = require('assert');
const dns = require('dns');
const net = require('net');
const https = require('https');
const http = require('http');
const tls = require('tls');
const request = require('request');
const socks = require('lum_socksv5');
const {Netmask} = require('netmask');
const lolex = require('lolex');
const sinon = require('sinon');
const ssl = require('../lib/ssl.js');
const etask = require('../util/etask.js');
const {ms} = require('../util/date.js');
const zutil = require('../util/util.js');
const lpm_config = require('../util/lpm_config.js');
const qw = require('../util/string.js').qw;
const Server = require('../lib/server.js');
const Manager = require('../lib/manager.js');
const requester = require('../lib/requester.js');
const consts = require('../lib/consts.js');
const common = require('./common.js');
const {assert_has, http_proxy, smtp_test_server, http_ping, init_lum} = common;
const test_url = {http: 'http://lumtest.com/test',
    https: 'https://lumtest.com/test'};
const customer = 'abc';
const customer_out_of_zone_auth_whitelist = customer+'d';

const TEST_SMTP_PORT = 10025;

const pre_rule = (type, regex)=>({
    rules: [{action: {[type]: true}, url: regex}],
});
describe('proxy', ()=>{
    let proxy, ping, smtp, sandbox, lum, l, waiting;
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
        yield ssl.load_ca(new Manager({}));
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
        sandbox = sinon.createSandbox();
        proxy.fake = true;
        proxy.connection = null;
        proxy.history = [];
        proxy.full_history = [];
        smtp.silent = false;
        waiting = [];
        ping.history = [];
        lum = init_lum(proxy);
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
        const t = (name, use_tls, req, opt)=>it(name+(use_tls ? ' tls' : ''),
            etask._fn(
        function*(_this){
            _this.timeout(5000);
            proxy.fake = false;
            opt = opt||{};
            l = yield lum(opt);
            req = req();
            if (use_tls)
            {
                sandbox.stub(process.env, 'NODE_TLS_REJECT_UNAUTHORIZED')
                    .value(0);
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
        for (let use_tls of [false, true])
        {
            t('http', use_tls, ()=>ping.http.url);
            t('http post', use_tls, ()=>{
                return {url: ping.http.url, method: 'POST', body: 'test body'};
            });
            t('https', use_tls, ()=>ping.https.url, {ssl: false});
            t('https post', use_tls,
                ()=>({url: ping.https.url, method: 'POST', body: 'test body'}),
                {ssl: false});
            t('https sniffing', use_tls, ()=>ping.https.url);
            t('https sniffing post', use_tls, ()=>({
                url: ping.https.url, method: 'POST', body: 'test body'}));
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
                assert.ok(!res.toJSON().headers['x-hola-agent']);
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
            t('https sniffing', ()=>ping.https.url, {ssl: true},
                ()=>proxy.history[0]);
            t('https connect', ()=>ping.https.url, {ssl: true},
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
                const site_headers = zutil.omit(res.body.headers,
                    qw`proxy-authorization x-hola-agent`);
                assert_has(site_headers, headers, 'value');
                assert_has(Object.keys(site_headers), Object.keys(headers),
                    'order');
            }));
            t('http', ()=>test_url.http);
            t('https', ()=>ping.https.url, {ssl: false});
            t('https sniffing', ()=>ping.https.url);
            t('bypass http', ()=>ping.http.url, pre_rule('bypass_proxy'));
            t('bypass https', ()=>ping.https.url, Object.assign(
                pre_rule('bypass_proxy'), {ssl: false}));
            t('bypass https sniffing', ()=>ping.https.url+'?match',
                Object.assign(pre_rule('bypass_proxy', 'match')));
        });
        describe('added headers in request', ()=>{
            it('should set User-Agent only when user_agent field is set',
            ()=>etask(function*(){
                const req = {headers: {'user-agent': 'from_req'}};
                l = yield lum({});
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
            const check_auth = function(prefix){
                return etask(function*(){
                    l = yield lum({pool_size: 3});
                    const res = yield l.test({headers: {
                            'proxy-authorization': 'Basic '+
                                Buffer.from(prefix
                                    +'-customer-abc-zone-static:xyz')
                                    .toString('base64'),
                        }});
                    assert.ok(!l.sessions);
                    assert.equal(proxy.history.length, 1);
                    assert.equal(res.body.auth.customer, 'abc');
                    assert.equal(res.body.auth.password, 'xyz');
                    assert.equal(res.body.auth.zone, 'static');
                });
            };
            it('authentication passed brd', ()=>check_auth('brd'));
            it('no zone auth if cust out of whitelist brd', ()=>
            etask(function*(){
                let cust = customer_out_of_zone_auth_whitelist;
                l = yield lum({proxy_type: 'persist'});
                const res = yield l.test({no_usage: 1, headers: {
                    'proxy-authorization': 'Basic '+
                        Buffer.from(`brd-customer-${cust}-zone-static:xyz`)
                            .toString('base64'),
                }});
                assert.equal(res.statusCode, 407);
            }));
            it('zone auth allowed for dropin', ()=>
            etask(function*(){
                l = yield lum();
                const res = yield l.test({no_usage: 1, headers: {
                    'proxy-authorization': 'Basic '+
                        Buffer.from(`lum-customer-abc-zone-static:xyz`)
                            .toString('base64'),
                }});
                assert.equal(res.statusCode, 200);
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
        describe('session control', ()=>{
            it('disabled', ()=>etask(function*(){
                l = yield lum({rotate_session: false});
                assert.equal(l.session_mgr.opt.rotate_session, false);
            }));
            const test_call = ()=>etask(function*(){
                const res = yield l.test({fake: 1});
                assert.ok(res.body);
                return res.body;
            });
            it('single session, default', ()=>etask(function*(){
                l = yield lum({});
                const session_a = yield test_call();
                const session_b = yield test_call();
                assert.equal(session_a, session_b);
            }));
            it('rotate_session', ()=>etask(function*(){
                l = yield lum({rotate_session: true});
                const session_a = yield test_call();
                const session_b = yield test_call();
                assert.notEqual(session_a, session_b);
            }));
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
            t('city', {country: 'us', city: 'newyork'});
            t('state', {state_perm: true, country: 'us', city: 'newyork',
                state: 'ny'}, {country: 'us', city: 'newyork', state: 'ny'});
            t('static', {zone: 'static', ip: '127.0.0.1'});
            t('ASN', {zone: 'asn', asn: 28133});
            t('mobile', {zone: 'mobile', mobile: 'true'});
            t('DNS', {dns: 'remote'});
            t('raw', {raw: true});
            t('direct', pre_rule('direct'), {direct: true});
            t('session explicit', {session: 'test_session'});
            describe('lower case and spaces', ()=>{
                t('long', {state_perm: true, state: 'NY', city: 'New York'},
                    {state: 'ny', city: 'newyork'});
                t('short',
                    {state_perm: true, state: 'NY', city: 'New York'},
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
        describe('throttle', ()=>{
            const get_throttled = domain=>
                l.throttle_mgr.throttled.get(domain)||[];
            const get_active = domain=>l.throttle_mgr.active.get(domain)||0;
            const t = throttle=>it(''+throttle, etask._fn(function*(_this){
                _this.timeout(3000);
                proxy.connection = hold_request;
                const requests = [];
                const domain = 'lumtest.com';
                const total_reqs = 2*throttle;
                l = yield lum({throttle});
                repeat(total_reqs, ()=>requests.push(l.test()));
                yield etask.sleep(300);
                assert.equal(waiting.length, throttle);
                const active = get_active(domain);
                assert.equal(active, total_reqs);
                const throttled_tasks = get_throttled(domain);
                assert.equal(throttled_tasks.length, total_reqs-throttle);
                for (let i=0; i<throttle; i++)
                {
                    release(1);
                    yield etask.sleep(200);
                    assert.equal(get_active(domain), total_reqs-i-1);
                    assert.equal(get_throttled(domain).length, throttle-i-1);
                }
                assert.equal(get_active(domain), throttle);
                assert.equal(l.throttle_mgr.throttled.size, 0);
                release(throttle);
                yield etask.all(requests);
                assert.ok(!get_active(domain));
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
            const t = (name, opt, before, after)=>it(name, ()=>etask(
            function*(){
                l = yield lum(opt);
                yield test_session(before);
                yield l.session_mgr.refresh_sessions();
                yield test_session(after);
            }));
            t('pool', {pool_size: 1}, /24000_0/, /24000_1/);
            t('sticky_ip', {sticky_ip: true}, /24000_127_0_0_1_0/,
                /24000_127_0_0_1_1/);
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
            }), {ssl: false});
            t('https sniffing', ()=>ping.https.url, ()=>({
                port: 24000,
                method: 'GET',
                url: ping.https.url,
            }), {ssl: true});
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
                {ssl: false}));
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
            it('http through lb', etask._fn(function*(){
                l = yield lum({whitelist_ips: ['1.1.1.1'],
                    lb_ips: ['127.0.0.1']});
                let res = yield l.test({url: test_url.http, no_usage: true,
                    lb_data: 'PROXY TCP4 1.1.1.1\r\n'});
                assert.equal(res.statusCode, 200);
            }));
            it('http reject', etask._fn(function*(){
                l = yield lum({whitelist_ips: ['1.1.1.1']});
                sinon.stub(l, 'is_whitelisted').onFirstCall().returns(false);
                let res = yield l.test({url: test_url.http, no_usage: true});
                assert.equal(res.statusCode, 407);
                assert.equal(res.body, undefined);
            }));
            it('http through lb reject', etask._fn(function*(){
                l = yield lum({whitelist_ips: ['1.1.1.1'],
                    lb_ips: ['127.0.0.1']});
                let res = yield l.test({url: test_url.http, no_usage: true,
                    lb_data: 'PROXY TCP4 1.1.1.2\r\n'});
                assert.equal(res.statusCode, 407);
                assert.equal(res.body, undefined);
            }));
            it('https', etask._fn(function*(){
                l = yield lum();
                let res = yield l.test({url: test_url.https});
                assert.equal(res.statusCode, 200);
            }));
            it('https through lb', etask._fn(function*(){
                l = yield lum({whitelist_ips: ['1.1.1.1'],
                    lb_ips: ['127.0.0.1']});
                let socket = net.connect(24000, '127.0.0.1');
                socket.on('error', e=>this.throw(e));
                socket.on('timeout', e=>this.throw(new Error('timeout')));
                socket.on('connect', ()=>this.continue());
                yield this.wait();
                socket.write('PROXY TCP4 1.1.1.1\r\n');
                let r = http.request({method: 'CONNECT', path: 'lumtest.com',
                    createConnection: ()=>socket}).end();
                r.on('error', e=>this.throw(e));
                r.on('connect', res=>this.continue(res));
                r = yield this.wait();
                let tls_socket = tls.connect({host: 'lumtest.com',
                    socket, servername: 'lumtest.com',
                    rejectUnauthorized: false}, ()=>this.continue());
                tls_socket.on('error', e=>this.throw(e));
                yield this.wait();
                const agent = new https.Agent({rejectUnauthorized: false});
                agent.createConnection = ()=>tls_socket;
                let req = {url: test_url.https, skip_proxy: 1,
                    agent};
                let res = yield l.test(req);
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
            it('https through lb reject', etask._fn(function*(){
                l = yield lum({whitelist_ips: ['1.1.1.1'],
                    lb_ips: ['127.0.0.1']});
                let socket = net.connect(24000, '127.0.0.1');
                socket.on('error', e=>this.throw(e));
                socket.on('timeout', e=>this.throw(new Error('timeout')));
                socket.on('connect', ()=>this.continue());
                yield this.wait();
                socket.write('PROXY TCP4 1.1.1.2\r\n');
                let r = http.request({method: 'CONNECT', path: 'lumtest.com',
                    createConnection: ()=>socket}).end();
                r.on('error', e=>this.throw(e));
                r.on('connect', res=>this.continue(res));
                r = yield this.wait();
                assert.equal(r.statusCode, 407);
            }));
            describe('socks', ()=>{
                it('http', etask._fn(function*(_this){
                    _this.timeout(30000);
                    l = yield lum({port: 25000});
                    let res = yield etask.nfn_apply(request, [{
                        agent: new socks.HttpAgent({
                            proxyHost: '127.0.0.1',
                            proxyPort: 25000,
                            auths: [socks.auth.None()],
                        }),
                        url: test_url.http,
                    }]);
                    let body = JSON.parse(res.body);
                    assert.equal(body.url, test_url.http);
                }));
                it('http through lb', etask._fn(function*(_this){
                    _this.timeout(30000);
                    l = yield lum({port: 25000, lb_ips: ['127.0.0.1'],
                        whitelist_ips: ['1.1.1.1']});
                    const _on_connect = socks.Client.prototype._onConnect;
                    sandbox.stub(socks.Client.prototype, '_onConnect')
                    .callsFake(function(){
                        l.update_lb_ips({lb_ips: []});
                        this._sock.write('PROXY TCP4 1.1.1.1\r\n');
                        _on_connect.apply(this, arguments);
                    });
                    let w = etask.wait();
                    l.on('usage', data=>w.return(data));
                    let res = yield etask.nfn_apply(request, [{
                        agent: new socks.HttpAgent({
                            proxyHost: '127.0.0.1',
                            proxyPort: 25000,
                            auths: [socks.auth.None()],
                        }),
                        url: test_url.http,
                    }]);
                    assert.equal(res.statusCode, 200);
                    let usage = yield w;
                    assert.equal(usage.remote_address, '1.1.1.1');
                    let body = JSON.parse(res.body);
                    assert.equal(body.url, test_url.http);
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
                    let body = JSON.parse(res.body);
                    assert.equal(body.url, test_url.http);
                }));
                it('socks http through lb', etask._fn(function*(){
                    l = yield lum({lb_ips: ['127.0.0.1'],
                        whitelist_ips: ['1.1.1.1']});
                    const _on_connect = socks.Client.prototype._onConnect;
                    sandbox.stub(socks.Client.prototype, '_onConnect')
                    .callsFake(function(){
                        l.update_lb_ips({lb_ips: []});
                        this._sock.write('PROXY TCP4 1.1.1.1\r\n');
                        _on_connect.apply(this, arguments);
                    });
                    let w = etask.wait();
                    l.on('usage', data=>w.return(data));
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
                    let usage = yield w;
                    assert.equal(usage.remote_address, '1.1.1.1');
                    let body = JSON.parse(res.body);
                    assert.equal(body.url, test_url.http);
                }));
                it('socks http reject', etask._fn(function*(){
                    l = yield lum({whitelist_ips: ['1.1.1.1']});
                    sinon.stub(l, 'is_whitelisted').onFirstCall()
                        .returns(false);
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
                it('socks http through lb reject', etask._fn(function*(){
                    l = yield lum({lb_ips: ['127.0.0.1'],
                        whitelist_ips: ['1.1.1.1']});
                    const _on_connect = socks.Client.prototype._onConnect;
                    sandbox.stub(socks.Client.prototype, '_onConnect')
                    .callsFake(function(){
                        l.update_lb_ips({lb_ips: []});
                        this._sock.write('PROXY TCP4 1.1.1.2\r\n');
                        _on_connect.apply(this, arguments);
                    });
                    let error = '';
                    try {
                        yield etask.nfn_apply(request, [{
                            agent: new socks.HttpAgent({
                                proxyHost: '127.0.0.1',
                                proxyPort: l.port,
                                auths: [socks.auth.None()],
                            }),
                            rejectUnauthorized: false,
                            url: test_url.http,
                        }]);
                    } catch(e){ error = e.toString(); }
                    assert(error.includes('not allowed by ruleset'));
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
                    let body = JSON.parse(res.body);
                    assert.equal(body.url, '/test');
                }));
                it('socks https through lb', etask._fn(function*(){
                    l = yield lum({lb_ips: ['127.0.0.1'],
                        whitelist_ips: ['1.1.1.1']});
                    const _on_connect = socks.Client.prototype._onConnect;
                    sandbox.stub(socks.Client.prototype, '_onConnect')
                    .callsFake(function(){
                        l.update_lb_ips({lb_ips: []});
                        this._sock.write('PROXY TCP4 1.1.1.1\r\n');
                        _on_connect.apply(this, arguments);
                    });
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
                    let body = JSON.parse(res.body);
                    assert.equal(body.url, '/test');
                }));
                it('socks https reject', etask._fn(function*(){
                    l = yield lum({whitelist_ips: ['1.1.1.1']});
                    sinon.stub(l, 'is_whitelisted').onFirstCall()
                        .returns(false);
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
                it('socks https through lb reject', etask._fn(function*(){
                    l = yield lum({lb_ips: ['127.0.0.1'],
                        whitelist_ips: ['1.1.1.1']});
                    const _on_connect = socks.Client.prototype._onConnect;
                    sandbox.stub(socks.Client.prototype, '_onConnect')
                    .callsFake(function(){
                        l.update_lb_ips({lb_ips: []});
                        this._sock.write('PROXY TCP4 1.1.1.2\r\n');
                        _on_connect.apply(this, arguments);
                    });
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
                    assert(error.includes('not allowed by ruleset'));
                }));
            });
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
                l = yield lum({debug: 'full', lpm_auth: 'full'});
                const ip = '1.2.3.4';
                const r = yield l.test({headers: {'x-lpm-ip': ip}});
                assert.ok(
                    r.headers['x-lpm-authorization'].includes(`ip-${ip}`));
            }));
        });
        describe('request details', ()=>{
            const debug_headers = ['x-lpm-authorization', 'x-lpm-port'];
            it('includes debug response headers', ()=>etask(function*(){
                l = yield lum({debug: 'full', lpm_auth: 'full'});
                const r = yield l.test();
                debug_headers.forEach(hdr=>assert.ok(r.headers[hdr]));
            }));
            it('excludes debug response headers', ()=>etask(function*(){
                l = yield lum({debug: 'none'});
                const r = yield l.test();
                debug_headers.forEach(hdr=>assert.ok(!r.headers[hdr]));
            }));
        });
        describe('request country choice', ()=>{
            it('should use country sent in x-lpm-country header',
                ()=>etask(function*(){
                    l = yield lum({debug: 'full', lpm_auth: 'full'});
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
                    l = yield lum({state_perm: true, debug: 'full',
                        lpm_auth: 'full'});
                    const state = 'us';
                    const r = yield l.test({headers: {'x-lpm-state': state}});
                    assert.ok(r.headers['x-lpm-authorization']
                        .includes(`state-${state}`));
                }));
        });
        describe('request city choice', ()=>{
            it('should use city sent in x-lpm-city header',
                ()=>etask(function*(){
                    l = yield lum({debug: 'full', lpm_auth: 'full'});
                    const city = 'washington';
                    const r = yield l.test({headers: {'x-lpm-city': city}});
                    assert.ok(r.headers['x-lpm-authorization']
                        .includes(`city-${city}`));
                }));
            it('should use escaped city sent in x-lpm-city header',
                ()=>etask(function*(){
                    l = yield lum({debug: 'full', lpm_auth: 'full'});
                    const city = 'New-York';
                    const r = yield l.test({headers: {'x-lpm-city': city}});
                    assert.ok(r.headers['x-lpm-authorization']
                        .includes(`city-newyork`));
                }));
        });
        describe('user_agent', ()=>{
            it('should use User-Agent header',
            ()=>etask(function*(){
                l = yield lum({headers:
                    [{name: 'user-agent', value: 'Mozilla'}]});
                const r = yield l.test();
                assert.ok(r.body.headers['user-agent']=='Mozilla');
            }));
            it('should use random desktop User-Agent header',
            ()=>etask(function*(){
                l = yield lum({headers:
                    [{name: 'user-agent', value: 'random_desktop'}]});
                const r = yield l.test();
                assert.ok(r.body.headers['user-agent'].includes('Windows NT'));
            }));
            it('should use random mobile User-Agent header',
            ()=>etask(function*(){
                l = yield lum({headers:
                    [{name: 'user-agent', value: 'random_mobile'}]});
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
        // XXX mikhailpo: bw limit tests
        describe('reseller', ()=>{
            const debug_headers = ['x-lpm-authorization', 'x-lpm-port'];
            const opts = {debug: 'full', lpm_auth: 'full', user: 't1',
                user_password: 't2', zagent: 1, reseller: 1};
            it('lpm_user_hide_headers', ()=>etask(function*(){
                l = yield lum(opts);
                const auth = 'Basic '+Buffer.from('t1:t2').toString('base64');
                let r = yield l.test({headers: {'proxy-authorization': auth}});
                assert.equal(r.statusCode, 200);
                debug_headers.forEach(hdr=>assert.ok(!r.headers[hdr]));
            }));
            it('non_reseller_lpm_user_show_headers', ()=>etask(function*(){
                l = yield lum(Object.assign({}, opts, {reseller: 0}));
                const auth = 'Basic '+Buffer.from('t1:t2').toString('base64');
                let r = yield l.test({headers: {'proxy-authorization': auth}});
                assert.equal(r.statusCode, 200);
                debug_headers.forEach(hdr=>assert.ok(r.headers[hdr]));
            }));
            it('brd_user_hide_headers_brd', ()=>etask(function*(){
                l = yield lum(opts);
                const auth = 'Basic '+Buffer
                    .from('brd-customer-abc-zone-static:t2')
                    .toString('base64');
                let r = yield l.test({headers: {'proxy-authorization': auth}});
                assert.equal(r.statusCode, 200);
                debug_headers.forEach(hdr=>assert.ok(!r.headers[hdr]));
            }));
            it('wrong_auth_hide_headers', ()=>etask(function*(){
                l = yield lum(opts);
                sinon.stub(l, 'is_whitelisted').onFirstCall().returns(false);
                let r = yield l.test({url: test_url.http, no_usage: true});
                assert.equal(r.statusCode, 407);
                debug_headers.forEach(hdr=>assert.ok(!r.headers[hdr]));
            }));
            it('ip_auth_show_headers', ()=>etask(function*(){
                l = yield lum(opts);
                let r = yield l.test();
                assert.equal(r.statusCode, 200);
                debug_headers.forEach(hdr=>assert.ok(r.headers[hdr]));
            }));
        });
    });
    describe('ext_proxies', ()=>{
        it('should use host and proxy from config', ()=>etask(function*(){
            l = yield lum({ext_proxies: ['1.1.1.1:123']});
            yield l.test({fake: 1});
            assert.equal(l.history[0].super_proxy, '1.1.1.1:123');
        }));
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
        it('should retry if got a banned ip', ()=>etask(function*(){
            l = yield lum();
            let retry_count = 0;
            l.on('retry', opt=>{
                if (opt.req.retry)
                    retry_count++;
                l.lpm_request(opt.req, opt.res, opt.head, opt.post);
            });
            l.banlist.add('1.1.1.1');
            const resp = yield l.test({fake: 1});
            assert.notEqual(resp.statusCode, 502);
            assert.equal(retry_count, 1);
        }));
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
                assert.ok(l.session_mgr.session.terminated);
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
                yield l.test({fake: 1});
                l.session_mgr.session.terminated = true;
                const r = yield l.test({fake: 1});
                assert.equal(r.body, consts.SESSION_TERMINATED_BODY);
                assert.equal(r.statusCode, 400);
            }));
            it('should unblock when session refreshed', etask._fn(function*(){
                l = yield lum({pool_size: 1, session_termination: true});
                yield l.test({fake: 1});
                l.session_mgr.session.terminated = true;
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
            if (opt.lb_data)
                socket.write(opt.lb_data);
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
            assert.equal(zutil.get(l, 'history.0.status_code'),
                expected_status);
            assert.equal(zutil.get(l, 'history.0.rules.length'),
                expected_rules);
        }));
        let config = {smtp: ['127.0.0.1:'+TEST_SMTP_PORT]};
        let rules = [{
            action: {ban_ip: 0},
            action_type: 'ban_ip',
            body: '220',
            trigger_type: 'body',
        }];
        t('rules is triggered regular req',
            Object.assign({}, config, {rules}), 200, 1, {close: true});
        t('rules is triggered when server ends connection',
            Object.assign({}, config, {rules}), 200, 1, {smtp_close: true});
        t('rules is triggered regular req through lb',
            Object.assign({}, config, {rules, lb_ips: ['127.0.0.1']}),
            200, 1, {close: true, lb_data: 'PROXY TCP4 127.0.0.1\r\n'});
        t('rules is triggered when server ends connection through lb',
            Object.assign({}, config, {rules, lb_ips: ['127.0.0.1']}),
            200, 1, {smtp_close: true, lb_data: 'PROXY TCP4 127.0.0.1\r\n'});
    });
    describe('multiple super proxy ports', ()=>{
        const default_super_proxy_port = 20001;
        const super_proxy_port_2 = 20002;
        const single_port = [default_super_proxy_port];
        const multiple_ports = [default_super_proxy_port, super_proxy_port_2];
        let proxy2;
        before(etask._fn(function*before(_this){
            _this.timeout(3000);
            proxy2 = yield http_proxy(super_proxy_port_2);
        }));
        after(etask._fn(function*after(_this){
            _this.timeout(3000);
            if (proxy2)
                yield proxy2.stop();
            proxy2 = null;
        }));
        const get_super_proxy_port = usage=>+usage.super_proxy.split(':')[1];
        const assert_round_robin = ports=>etask(function*(){
            let w = etask.wait();
            l.on('usage', data=>w.return(data));
            const expected_ports = [];
            const actual_ports = [];
            let usage;
            for (let i = 0; i < ports.length*2; i++)
            {
                yield l.test({url: ping.http.url});
                usage = yield w;
                assert.equal(usage.success, 1);
                expected_ports.push(ports[i%ports.length]);
                actual_ports.push(get_super_proxy_port(usage));
            }
            assert.deepEqual(expected_ports, actual_ports, 'round robin ports '
                +'are incorrect.\nExpected: '+expected_ports+'\nActual: '
                +actual_ports+'\n');
        });
        it('default', ()=>etask(function*(){
            l = yield lum({super_proxy_ports: multiple_ports});
            assert.deepEqual(l.opt.super_proxy_ports, multiple_ports);
            yield assert_round_robin(multiple_ports);
        }));
        it('no ports', ()=>etask(function*(){
            l = yield lum();
            assert.ok(!l.opt.super_proxy_ports, 'server.opt.super_proxy_ports '
                +'is truthy');
            yield assert_round_robin(single_port);
        }));
        it('works after set_opt', ()=>etask(function*(){
            l = yield lum();
            assert.ok(!l.opt.super_proxy_ports, 'server.opt.super_proxy_ports '
                +'is truthy');
            yield assert_round_robin(single_port);
            l.set_opt({super_proxy_ports: multiple_ports});
            assert.deepEqual(l.opt.super_proxy_ports, multiple_ports);
            yield assert_round_robin(multiple_ports);
        }));
    });
});
