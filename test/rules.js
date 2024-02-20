// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, mocha:true*/
const assert = require('assert');
const request = require('request');
const {Netmask} = require('netmask');
const sinon = require('sinon');
const ssl = require('../lib/ssl.js');
const etask = require('../util/etask.js');
const {ms} = require('../util/date.js');
const Server = require('../lib/server.js');
const Manager = require('../lib/manager.js');
const {Timeline} = require('../lib/util.js');
const common = require('./common.js');
const {http_proxy, smtp_test_server, http_ping, init_lum} = common;
const test_url = {http: 'http://lumtest.com/test',
    https: 'https://lumtest.com/test'};
const TEST_SMTP_PORT = 10025;

describe('rules', ()=>{
    let proxy, ping, smtp, sandbox, lum, l;
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
        it('connection timeout', ()=>etask(function*(){
            l = yield lum({rules: [
                {action_type: 'retry', min_conn_time: 1,
                trigger_type: 'min_conn_time', action: {}}
            ]});
            l.on('retry', opt=>{
                // XXX: this.continue is not working here
                this.return();
            });
            sinon.stub(l.rules, 'can_retry').returns(true);
            // host which is unabled to connect
            yield l.test('http://127.0.0.1:3000');
            yield this.wait();
        }));
        it('connection timeout trigger suspended', ()=>etask(function*(){
            l = yield lum({rules: [
                {action_type: 'retry', min_conn_time: 100000,
                trigger_type: 'min_conn_time', action: {}}
            ]});
            let called;
            const handle_proxy_resp_org = l.handle_proxy_resp.bind(l);
            sinon.stub(l, 'handle_proxy_resp').callsFake((...args)=>
            _res=>{
                let req = args[0];
                req.min_conn_task.return();
                req.min_conn_task = {return(){ called=true; }};
                return handle_proxy_resp_org(...args)(_res);
            });
            yield l.test(ping.http.url);
            assert.ok(called);
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
