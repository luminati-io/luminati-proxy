// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, mocha:true*/
const assert = require('assert');
const dns = require('dns');
const net = require('net');
const https = require('https');
const http = require('http');
const tls = require('tls');
const {Readable, Writable} = require('stream');
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
const Worker = require('../lib/worker.js');
const Manager = require('../lib/manager.js');
const requester = require('../lib/requester.js');
const {Timeline, decode_body} = require('../lib/util.js');
const consts = require('../lib/consts.js');
const common = require('./common.js');
const {assert_has, http_proxy, smtp_test_server, http_ping, keys} = common;
const test_url = {http: 'http://lumtest.com/test',
    https: 'https://lumtest.com/test'};
const customer = 'abc';
const password = 'xyz';
const zone_auth_type_whitelist = [customer];
const customer_out_of_zone_auth_whitelist = customer+'d';

const TEST_SMTP_PORT = 10025;

const pre_rule = (type, regex)=>({
    rules: [{action: {[type]: true}, url: regex}],
});
describe('proxy', ()=>{
    let proxy, ping, smtp, sandbox;
    const lum = opt=>etask(function*(){
        opt = opt||{};
        if (opt.ssl===true)
            opt.ssl = Object.assign({requestCert: false}, ssl(keys));
        const l = new Server(Object.assign({
            proxy: '127.0.0.1',
            proxy_port: proxy.port,
            customer,
            password,
            zone_auth_type_whitelist,
            log: 'none',
            logs: 1000,
            port: 24000,
        }, opt), new Worker().run().setup({keys}));
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
            it('authentication passed lum', ()=>check_auth('lum'));
            it('no zone auth if cust out of whitelist lum', ()=>
            etask(function*(){
                let cust = customer_out_of_zone_auth_whitelist;
                l = yield lum({proxy_type: 'persist'});
                const res = yield l.test({no_usage: 1, headers: {
                    'proxy-authorization': 'Basic '+
                        Buffer.from(`lum-customer-${cust}-zone-static:xyz`)
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
            it('lum_user_hide_headers_lum', ()=>etask(function*(){
                l = yield lum(opts);
                const auth = 'Basic '+Buffer
                    .from('lum-customer-abc-zone-static:t2')
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
    describe('rules', ()=>{
        const get_retry_rule = (retry_port=24001)=>({
            action: {retry: true, retry_port},
            action_type: 'retry_port',
            status: '200',
        });
        const make_cred_spy = _l=>sinon.spy(_l, 'get_req_cred');
        const get_username = spy=>spy.returnValues[0].username;
        const inject_headers = (li, ip, ip_alt)=>{
            ip = ip||'ip';
            let call_count = 0;
            const handle_proxy_resp_org = li.handle_proxy_resp.bind(li);
            return sinon.stub(li, 'handle_proxy_resp').callsFake((...args)=>
            _res=>{
                const ip_inj = ip_alt && call_count++%2 ? ip_alt : ip;
                _res.headers['x-luminati-ip'] = ip_inj;
                return handle_proxy_resp_org(...args)(_res);
            });
        };
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
            l.rules.retry(_req, {}, {}, {retry_port: l.port});
            assert.equal(_req.retry, 1);
            assert.ok(called);
            l.rules.retry(_req, {}, {}, {retry_port: l.port});
            assert.equal(_req.retry, 2);
        }));
        it('check can_retry', ()=>etask(function*(){
            l = yield lum({rules: []});
            assert.ok(!l.rules.can_retry({}));
            assert.ok(l.rules.can_retry({retry: 2}, {retry: 5}));
            assert.ok(!l.rules.can_retry({retry: 5}));
            assert.ok(l.rules.can_retry({retry: 2}, {refresh_ip: false,
                retry: 3}));
            assert.ok(!l.rules.can_retry({retry: 2}, {refresh_ip: false,
                retry: true}));
            assert.ok(!l.rules.can_retry({retry: 2}, {refresh_ip: true,
                retry: true}));
            assert.ok(l.rules.can_retry({retry: 1}, {retry_port: 24001,
                retry: true}));
        }));
        it('check post_need_body', ()=>etask(function*(){
            l = yield lum({rules: [{url: 'test'}]});
            const t = (req, expected)=>etask(function*(){
                const r = yield l.rules.post_need_body(req);
                assert.equal(r, expected);
            });
            yield t({ctx: {url: 'invalid'}}, false);
            yield t({ctx: {url: 'test'}}, false);
            yield l.stop(true);
            l = yield lum({rules: [{type: 'after_body', body: '1',
                url: 'test'}]});
            yield t({ctx: {url: 'test'}}, true);
        }));
        it('check post', ()=>etask(function*(){
            l = yield lum({rules: [{url: 'test'}]});
            const t = (req, _res, expected)=>etask(function*(){
                req.ctx = Object.assign({skip_rule: ()=>false}, req.ctx);
                const r = yield l.rules.post(req, {}, {}, _res||{});
                assert.equal(r, expected);
            });
            yield t({ctx: {h_context: 'STATUS CHECK'}});
            yield t({ctx: {url: 'invalid'}});
            sinon.stub(l.rules, 'action').returns(true);
            yield t({ctx: {url: 'test'}}, {}, undefined);
        }));
        describe('action', ()=>{
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
                yield l.test({fake: 1, no_usage: true});
                assert.notEqual(p1, p2);
                l2.stop(true);
            }));
            it('refresh_ip', ()=>etask(function*(){
                l = yield lum({rules: []});
                sinon.stub(l.rules, 'can_retry').returns(true);
                sinon.stub(l.rules, 'retry');
                const ref_stub = sinon.stub(l, 'refresh_ip').returns('test');
                const req = {ctx: {}};
                const opt = {_res: {hola_headers: {'x-luminati-ip': 'ip'}}};
                const r = yield l.rules.action(req, {}, {},
                    {action: {refresh_ip: true}}, opt);
                assert.ok(r);
                assert.ok(ref_stub.called);
                assert.equal(l.refresh_task, 'test');
            }));
            describe('ban_ip', ()=>{
                it('ban_ip', ()=>etask(function*(){
                    l = yield lum({rules: []});
                    sinon.stub(l.rules, 'can_retry').returns(false);
                    const add_stub = sinon.stub(l, 'banip');
                    const req = {ctx: {}};
                    const opt = {_res: {
                        hola_headers: {'x-luminati-ip': '1.2.3.4'}}};
                    const retried = yield l.rules.action(req, {}, {},
                        {action: {ban_ip: 1000}}, opt);
                    assert.ok(!retried);
                    assert.ok(add_stub.called);
                }));
                const t = (name, req)=>it(name, ()=>etask(function*(){
                    proxy.fake = true;
                    sandbox.stub(Server, 'get_random_ip').returns('1.1.1.1');
                    sandbox.stub(common, 'get_random_ip').returns('1.1.1.1');
                    l = yield lum({rules: [{
                        action: {ban_ip: 0},
                        action_type: 'ban_ip',
                        status: '200',
                        trigger_type: 'status',
                    }]});
                    l.on('retry', opt=>{
                        l.lpm_request(opt.req, opt.res, opt.head, opt.post);
                    });
                    for (let i=0; i<2; i++)
                    {
                        let w = etask.wait();
                        l.on('usage', data=>w.return(data));
                        let res = yield l.test(req);
                        let usage = yield w;
                        assert.equal(res.statusCode, 200);
                        assert.deepStrictEqual(usage.rules, [{
                            action: {ban_ip: 0}, action_type: 'ban_ip',
                            status: '200', trigger_type: 'status',
                            type: 'after_hdr'}]);
                    }
                }));
                t('ban_ip http', {url: test_url.http});
                t('ban_ip https', {url: test_url.https});
            });
            describe('request_url', ()=>{
                let req, req_stub;
                beforeEach(()=>etask(function*(){
                    l = yield lum({rules: []});
                    req = {ctx: {}};
                    req_stub = sinon.stub(request, 'Request').callsFake(
                        ()=>({on: ()=>null, end: ()=>null}));
                }));
                afterEach(()=>{
                    req_stub.restore();
                });
                it('does nothing on invalid urls', ()=>etask(function*(){
                    const r = yield l.rules.action(req, {}, {},
                        {action: {request_url: {url: 'blabla'}}}, {});
                    assert.ok(!r);
                    sinon.assert.notCalled(req_stub);
                }));
                it('sends request with http', ()=>etask(function*(){
                    const url = 'http://lumtest.com';
                    const r = yield l.rules.action(req, {}, {},
                        {action: {request_url: {url}}}, {});
                    assert.ok(!r);
                    sinon.assert.calledWith(req_stub, sinon.match({url}));
                }));
                it('sends request with https', ()=>etask(function*(){
                    const url = 'https://lumtest.com';
                    const r = yield l.rules.action(req, {}, {},
                        {action: {request_url: {url}}}, {});
                    assert.ok(!r);
                    sinon.assert.calledWith(req_stub, sinon.match({url}));
                }));
                it('sends request with custom method', ()=>etask(function*(){
                    const url = 'http://lumtest.com';
                    const r = yield l.rules.action(req, {}, {},
                        {action: {request_url: {url, method: 'POST'}}}, {});
                    assert.ok(!r);
                    sinon.assert.calledWith(req_stub, sinon.match({url}));
                }));
                it('sends request with custom payload', ()=>etask(function*(){
                    const url = 'http://lumtest.com';
                    const payload = {a: 1, b: 'str'};
                    const payload_str = JSON.stringify(payload);
                    const rule = {url, method: 'POST', payload};
                    const r = yield l.rules.action(req, {}, {},
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
                }));
                it('does not send payload in GET requests', ()=>
                   etask(function*(){
                    const url = 'http://lumtest.com';
                    const payload = {a: 1, b: 'str'};
                    const rule = {url, method: 'GET', payload};
                    const r = yield l.rules.action(req, {}, {},
                        {action: {request_url: rule}}, {});
                    assert.ok(!r);
                    sinon.assert.calledWith(req_stub, sinon.match({
                        url,
                        method: 'GET'
                    }));
                }));
                it('sends request with custom payload with IP', ()=>
                   etask(function*(){
                    const url = 'http://lumtest.com';
                    const payload = {a: 1, b: '$IP'}, ip = '1.1.1.1';
                    const actual_payload = {a: 1, b: ip};
                    const payload_str = JSON.stringify(actual_payload);
                    const rule = {url, method: 'POST', payload};
                    const r = yield l.rules.action(req, {}, {},
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
                }));
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
                    const session_a = l.session_mgr.session;
                    yield l.test({fake: 1});
                    const session_b = l.session_mgr.session;
                    assert.notEqual(session_a, session_b);
                }));
                it('retry should rotate the session if it has ip', ()=>etask(
                function*(){
                    l = yield lum({pool_size: 2, ips: ['1.1.1.1', '1.1.1.2'],
                        rules: [
                            {action: {reserve_session: true},
                                action_type: 'save_to_pool', status: '201'},
                            {action: {retry: true}, status: '200'}]});
                    l.on('retry', opt=>{
                        l.lpm_request(opt.req, opt.res, opt.head, opt.post);
                    });
                    const session_a = l.session_mgr.session;
                    yield l.test({fake: 1});
                    const session_b = l.session_mgr.session;
                    assert.notEqual(session_a, session_b);
                }));
            });
            describe('waterfall', ()=>{
                it('emits usage events once', ()=>etask(function*(){
                    l = yield lum({rules: [get_retry_rule()], logs: 1});
                    const l2 = yield lum({port: 24001, logs: 1});
                    let usage_start_counter = 0;
                    let usage_counter = 0;
                    let usage_abort_counter = 0;
                    l.on('usage_start', ()=>usage_start_counter++);
                    l.on('usage', ()=>usage_counter++);
                    l.on('usage_abort', ()=>usage_abort_counter++);
                    l2.on('usage_start', ()=>usage_start_counter++);
                    l2.on('usage', ()=>usage_counter++);
                    l2.on('usage_abort', ()=>usage_abort_counter++);
                    l.on('retry', opt=>{
                        l2.lpm_request(opt.req, opt.res, opt.head, opt.post);
                    });
                    const w = etask.wait();
                    l2.on('usage', ()=>w.continue());
                    yield l.test({fake: 1, no_usage: 1});
                    yield w;
                    l2.stop(true);
                    assert.equal(usage_start_counter, 1);
                    assert.equal(usage_counter, 1);
                    assert.equal(usage_abort_counter, 0);
                }));
            });
            describe('retry_port combined with unblocker', ()=>{
                const has_unblocker_flag = u=>u.includes('-unblocker');
                const sessions_are_unique = (...users)=>{
                    const sess_id = u=>u.match(/(?<=session-)(.*?)(?=$|-)/)[1];
                    return new Set(users.map(sess_id)).size==users.length;
                };
                it('waterfall to & from ub adjusts unblocker flag correctly',
                ()=>etask(function*(){
                    l = yield lum({rules: [get_retry_rule()], unblock: true});
                    const l2 = yield lum({port: 24001,
                        rules: [get_retry_rule(24002)]});
                    const l3 = yield lum({port: 24002, unblock: true});
                    l.on('retry', opt=>{
                        l2.lpm_request(opt.req, opt.res, opt.head, opt.post);
                    });
                    l2.on('retry', opt=>{
                        l3.lpm_request(opt.req, opt.res, opt.head, opt.post);
                    });
                    const cred_spies = [l, l2, l3].map(make_cred_spy);
                    yield l.test({fake: 1, no_usage: true});
                    const [u1, u2, u3] = cred_spies.map(get_username);
                    assert.ok(has_unblocker_flag(u1));
                    assert.ok(!has_unblocker_flag(u2));
                    assert.ok(has_unblocker_flag(u3));
                    assert.ok(sessions_are_unique(u1, u2, u3));
                    l2.stop(true);
                    l3.stop(true);
                }));
                it('ub to non-ub, followed by no retry', ()=>etask(function*(){
                    l = yield lum({rules: [get_retry_rule()]});
                    const l2 = yield lum({port: 24001, unblock: true});
                    l.on('retry', opt=>{
                        l2.lpm_request(opt.req, opt.res, opt.head, opt.post);
                    });
                    let non_retry_u;
                    l.on('usage', ({username})=>{ non_retry_u = username; });
                    const cred_spies = [l, l2].map(make_cred_spy);
                    yield l.test({fake: 1, no_usage: true});
                    const [u1, u2] = cred_spies.map(get_username);
                    assert.ok(!has_unblocker_flag(u1));
                    assert.ok(has_unblocker_flag(u2));
                    l.rules.rules.pop();
                    l.session_mgr.refresh_sessions();
                    yield l.test({fake: 1});
                    assert.ok(!has_unblocker_flag(non_retry_u));
                    assert.ok(sessions_are_unique(u1, non_retry_u));
                    l2.stop(true);
                }));
                it('non-ub to ub, followed by no retry', ()=>etask(function*(){
                    l = yield lum({rules: [get_retry_rule()], unblock: true});
                    const l2 = yield lum({port: 24001});
                    l.on('retry', opt=>{
                        l2.lpm_request(opt.req, opt.res, opt.head, opt.post);
                    });
                    let non_retry_u;
                    l.on('usage', ({username})=>{ non_retry_u = username; });
                    const cred_spies = [l, l2].map(make_cred_spy);
                    yield l.test({fake: 1, no_usage: true});
                    const [u1, u2] = cred_spies.map(get_username);
                    assert.ok(has_unblocker_flag(u1));
                    assert.ok(!has_unblocker_flag(u2));
                    l.rules.rules.pop();
                    l.session_mgr.refresh_sessions();
                    yield l.test({fake: 1});
                    assert.ok(has_unblocker_flag(non_retry_u));
                    assert.ok(sessions_are_unique(u1, non_retry_u));
                    l2.stop(true);
                }));
                it('waterfall from ub to ub keeps unblocker flag intact',
                ()=>etask(function*(){
                    l = yield lum({rules: [get_retry_rule()], unblock: true});
                    const l2 = yield lum({port: 24001, unblock: true});
                    l.on('retry', opt=>{
                        l2.lpm_request(opt.req, opt.res, opt.head, opt.post);
                    });
                    const cred_spies = [l, l2].map(make_cred_spy);
                    yield l.test({fake: 1, no_usage: true});
                    const [u1, u2] = cred_spies.map(get_username);
                    assert.ok(has_unblocker_flag(u1));
                    assert.ok(has_unblocker_flag(u2));
                    l2.stop(true);
                }));
            });
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
                const t = (name, url, ban_count=0)=>it(name,
                    etask._fn(function*(){
                    const session = {session: 'sess1'};
                    const req = {ctx: {url, skip_rule: ()=>false, session}};
                    yield l.rules.post(req, {}, {}, {status_code: 200,
                        headers: {'x-luminati-ip': ip}});
                    sinon.assert.callCount(ban_spy, ban_count);
                    if (ban_count)
                    {
                        sinon.assert.calledWith(ban_spy, ip, ban_period,
                            session, domain);
                    }
                }));
                t('does not trigger on diff domains',
                    'http://lumtest.com/test');
                t('triggers', `http://${domain}/test`, 1);
            });
        });
        describe('pre', ()=>{
            it('action null_response', ()=>etask(function*(){
                l = yield lum({rules: [{action: {null_response: true}}]});
                const _req = {ctx: {response: {}, url: 'lumtest.com',
                    log: l.log, timeline: new Timeline(1),
                    init_stats: ()=>null,
                }};
                const _res = {end: sinon.stub(), write: sinon.stub()};
                const r = yield l.rules.pre(_req, _res, {});
                assert.equal(r.status_code, 200);
                assert.equal(r.status_message, 'NULL');
            }));
            it('action direct', ()=>etask(function*(){
                l = yield lum({rules: [{url: '', action: {direct: true}}]});
                const _req = {ctx: {response: {}, url: 'lumtest.com',
                    log: l.log, timeline: new Timeline(1),
                    init_stats: ()=>null,
                }};
                const _res = {end: sinon.stub(), write: sinon.stub()};
                const r = yield l.rules.pre(_req, _res, {});
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
                yield l.test({url: ping.http.url, no_usage: true});
                sinon.assert.calledWith(ban_stub, 'ip', 600000);
                sinon.assert.calledWith(ban_stub_l2, 'ip2', 1800000);
                header_stub.restore();
                header_stub_l2.restore();
                inject_headers(l, 'ip3');
                inject_headers(l2, 'ip4');
                yield l.test({url: ping.http.url, no_usage: true});
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
                yield l.test({url: ping.http.url, no_usage: true});
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
                it('default pool', ()=>etask(function*(){
                    yield prepare_lum({pool_size: 0});
                    yield l.test({fake: 1});
                    const first_session = l.session_mgr.session;
                    yield l.test({fake: 1});
                    const second_session = l.session_mgr.session;
                    assert.ok(first_session!=second_session);
                }));
                it('per machine', ()=>etask(function*(){
                    yield prepare_lum({session: true, sticky_ip: true});
                    yield l.test({fake: 1});
                    const sticky_sessions = l.session_mgr.sticky_sessions;
                    const first_session = Object.values(sticky_sessions)[0];
                    yield l.test({fake: 1});
                    const second_session = Object.values(sticky_sessions)[0];
                    assert.ok(first_session!=second_session);
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
    // XXX krzysztof/vitkor: move to util.js
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
                let body = decode_body([buffer], '', limit);
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
