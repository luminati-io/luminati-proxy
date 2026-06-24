// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, mocha:true*/
const assert = require('assert');
const sinon = require('sinon');
const {Netmask} = require('../util/netmask.js');
const ssl = require('../lib/ssl.js');
const etask = require('../util/etask.js');
const {ms} = require('../util/date.js');
const lpm_request = require('../util/lpm_request.js');
const rules_util = require('../util/rules_util.js');
const {Js_sanitizer_error} = require('../util/js_sanitizer.js');
const Server = require('../lib/server.js');
const Manager = require('../lib/manager.js');
const {Timeline} = require('../lib/util.js');
const common = require('./common.js');
const {http_proxy, smtp_test_server, http_ping, init_lum} = common;
const test_url = {http: 'http://lumtest.com/test',
    https: 'https://lumtest.com/test'};
const TEST_SMTP_PORT = 10025;

describe('rules trigger_code sanitizer', ()=>{
    const normalize = code=>code.replace(/\r\n/g, '\n').trim();
    const preview = code=>normalize(code).replace(/\s+/g, ' ').slice(0, 200);
    const sanitizer = ()=>rules_util.get_sanitizer();
    const accept = (name, code)=>{
        assert.doesNotThrow(()=>sanitizer().sanitize(normalize(code)),
            `${name}: ${preview(code)}`);
    };
    const reject = (name, code, msg)=>{
        assert.throws(()=>sanitizer().sanitize(normalize(code)), e=>{
            assert.ok(e instanceof Js_sanitizer_error,
                `${name}: expected Js_sanitizer_error, got ${e && e.name}`);
            if (msg)
            {
                assert.ok(e.message.includes(msg),
                    `${name}: "${e.message}" should include "${msg}"`);
            }
            return true;
        }, `${name}: ${preview(code)}`);
    };
    describe('trigger function shape', ()=>{
        it('requires exactly one top-level trigger function', ()=>{
            accept('one trigger', `
                function trigger(opt){
                    return true;
                }
            `);
            reject('no trigger', `
                function check(opt){
                    return true;
                }
            `);
            reject('duplicate trigger', `
                function trigger(opt){
                    return true;
                }
                function trigger(opt){
                    return false;
                }
            `);
        });
        it('requires trigger(opt)', ()=>{
            reject('no params', `
                function trigger(){
                    return true;
                }
            `);
            reject('wrong param name', `
                function trigger(req){
                    return true;
                }
            `);
            reject('too many params', `
                function trigger(opt, req){
                    return true;
                }
            `);
            accept('correct param', `
                function trigger(opt){
                    return !!opt;
                }
            `);
        });
        it('rejects async and generator trigger functions', ()=>{
            reject('async trigger', `
                async function trigger(opt){
                    return true;
                }
            `);
            reject('generator trigger', `
                function* trigger(opt){
                    yield true;
                }
            `);
        });
    });
    describe('safe language features needed by real trigger_code', ()=>{
        const valid_cases = [
            {
                name: 'simple boolean trigger bodies',
                code: `
                    function trigger(opt){
                        return true;
                    }
                `,
            },
            {
                name: 'conditions over opt fields',
                code: `
                    function trigger(opt){
                        if (opt.status == 200)
                            return false;
                        if (opt.time_passed > 1000)
                            return true;
                        if (opt.domain === 'example.test')
                            return true;
                        if (opt.url && opt.body)
                            return true;
                        return false;
                    }
                `,
            },
            {
                name: 'RegExp usage',
                code: `function trigger(opt){
                    if (!new RegExp(String.raw\`(4|5)..\`).test(opt.status))
                        return false;
                    if (new RegExp(String.raw\`captcha\`, 'i').test(opt.body))
                        return true;
                    return /example/i.test(opt.url);
                }`,
            },
            {
                name: 'string methods',
                code: `
                    function trigger(opt){
                        const url = opt.url || '';
                        return url.includes('x')
                            || url.startsWith('http')
                            || url.endsWith('.js')
                            || url.toLowerCase().includes('asset');
                    }
                `,
            },
            {
                name: 'optional chaining',
                code: `
                    function trigger(opt){
                        if (opt.url?.includes('asset'))
                            return true;
                        if (opt._res?.headers?.location)
                            return true;
                        return false;
                    }
                `,
            },
            {
                name: 'nested and computed member access',
                code: `
                    function trigger(opt){
                        if (opt._res.headers.location)
                            return true;
                        if (opt._res.headers['content-type'])
                            return true;
                        return false;
                    }
                `,
            },
            {
                name: 'local variables',
                code: `
                    function trigger(opt){
                        const is_status = opt.status == 403;
                        const is_asset = /\\.(png|jpg|css|js)$/.test(opt.url);
                        return is_status || is_asset;
                    }
                `,
            },
            {
                name: 'array callbacks',
                code: `
                    function trigger(opt){
                        const domains = ['a.test', 'b.test'];
                        return domains.some(d=>opt.url.includes(d));
                    }
                `,
            },
            {
                name: 'helper function',
                code: `
                    function is_asset(url){
                        return /\\.(png|jpg|css|js)$/.test(url);
                    }

                    function trigger(opt){
                        return is_asset(opt.url);
                    }
                `,
            },
            {
                name: 'helper function with default parameter',
                code: `
                    function is_asset(url, include_js = true){
                        if (include_js)
                            return /\\.(png|jpg|css|js)$/.test(url);
                        return /\\.(png|jpg|css)$/.test(url);
                    }

                    function trigger(opt){
                        return is_asset(opt.url);
                    }
                `,
            },
            {
                name: 'top-level const',
                code: `
                    const DOMAINS = ['a.test', 'b.test'];

                    function trigger(opt){
                        return DOMAINS.some(d=>opt.url.includes(d));
                    }
                `,
            },
            {
                name: 'for loop',
                code: `
                    function trigger(opt){
                        for (let i = 0; i < 3; i++) {
                            if (i === opt.retry)
                                return true;
                        }
                        return false;
                    }
                `,
            },
            {
                name: 'assignment to opt fields',
                code: `
                    function trigger(opt){
                        opt.timeout = 5000;
                        opt.url = 'http://example.test/';
                        return true;
                    }
                `,
            },
            {
                name: 'JSON and builtins',
                code: `
                    function trigger(opt){
                        const data = JSON.parse(opt.body);
                        return !!data.result
                            || String(opt.status) === '200'
                            || Number('200') === opt.status
                            || Boolean(opt.status)
                            || Object.keys(opt).length >= 0
                            || Math.max(opt.status, 100) >= 100
                            || Array.isArray([1, 2, 3]);
                    }
                `,
            },
            {
                name: 'console diagnostics',
                code: `
                    function trigger(opt){
                        console.log('trigger opt', opt);
                        return opt.status == 403;
                    }
                `,
            },
        ];
        it('accepts all allowed trigger language features', ()=>{
            const failures = [];
            for (const {name, code} of valid_cases)
            {
                try {
                    sanitizer().sanitize(normalize(code));
                } catch(e){
                    failures.push(`${name}: ${e.message}\n${preview(code)}`);
                }
            }
            assert.equal(failures.length, 0,
                'Sanitizer rejected valid trigger_code feature classes:\n\n'
                +failures.join('\n\n'));
        });
    });
    describe('unsafe code must be rejected by sanitizer policy', ()=>{
        it('rejects dynamic code execution', ()=>{
            reject('eval', `
                function trigger(opt){ return eval('1 + 1'); }
            `, 'identifiers eval');
            reject('Function identifier', `
                function trigger(opt){ return Function('return true')(); }
            `, 'identifiers Function');
            reject('new Function', `
                function trigger(opt){
                    return new Function('return true')();
                }
            `, 'new_expr Function');
        });
        it('rejects prototype/constructor escape paths', ()=>{
            reject('constructor property', `
                function trigger(opt){ return opt.constructor; }
            `, 'props constructor');
            reject('computed constructor property', `
                function trigger(opt){ return opt['constructor']; }
            `, 'props constructor');
            reject('opaque computed property', `
                function trigger(opt){ return opt['con'+'structor']; }
            `, 'props');
            reject('__proto__ property', `
                function trigger(opt){ return opt.__proto__; }
            `, 'props __proto__');
            reject('prototype property', `
                function trigger(opt){ return opt.prototype; }
            `, 'props prototype');
            reject('constructor constructor escape', `
                function trigger(opt){
                    return opt.constructor.constructor('return process')();
                }
            `, 'props constructor');
        });
        it('rejects browser/network escape APIs', ()=>{
            reject('fetch', `
                function trigger(opt){ return fetch('http://x.test/'); }
            `, 'identifiers fetch');
            reject('XMLHttpRequest', `
                function trigger(opt){ return new XMLHttpRequest(); }
            `, 'new_expr XMLHttpRequest');
        });
        it('rejects unsupported module syntax and malformed code', ()=>{
            reject('dynamic import', `
                function trigger(opt){ return import('fs'); }
            `);
            reject('static import', `
                import fs from 'fs';
                function trigger(opt){ return true; }
            `);
            reject('syntax error', `
                function trigger(opt){
                    if (opt.url && || opt.status) return true;
                    return false;
                }
            `, 'syntax error');
        });
        it('rejects object literals (no action objects)', ()=>{
            reject('return action object', `
                function trigger(opt){
                    if (opt.status == 502)
                        return {schedule: 'beforeSend', retries: 3};
                    return false;
                }
            `, 'nodes ObjectExpression');
        });

    });
    describe('external globals cannot be mutated or aliased', ()=>{
        it('rejects host globals as references', ()=>{
            reject('require', `
                function trigger(opt){ return require('fs'); }
            `, 'identifiers require');
            reject('process', `
                function trigger(opt){ return process.env; }
            `, 'global_alias process');
            reject('global', `
                function trigger(opt){ return global.process; }
            `, 'global_alias global');
            reject('globalThis', `
                function trigger(opt){ return globalThis.process; }
            `, 'global_alias globalThis');
            reject('module', `
                function trigger(opt){ return module.exports; }
            `, 'global_alias module');
            reject('exports', `
                function trigger(opt){ return exports; }
            `, 'global_alias exports');
        });
        it('blocks mutating host globals', ()=>{
            reject('mutate Object', `
                function trigger(opt){ Object.keys = ()=>[]; return true; }
            `, 'global_mutation Object');
            reject('delete global member', `
                function trigger(opt){ delete Math.max; return true; }
            `, 'global_mutation Math');
            reject('assign to global member', `
                function trigger(opt){ Math.max = 0; return true; }
            `, 'global_mutation Math');
        });
        it('blocks aliasing host globals', ()=>{
            reject('alias to var', `
                var O = Object;
                function trigger(opt){ return true; }
            `, 'global_alias Object');
            reject('alias via return', `
                function trigger(opt){ return Object; }
            `, 'global_alias Object');
            reject('alias via arrow', `
                function trigger(opt){ var f = ()=>Object; return !!f; }
            `, 'global_alias Object');
            reject('alias a global method', `
                function trigger(opt){ var k = Object.keys; return !!k; }
            `, 'global_alias Object');
        });
        it('allows mutating opt and code-declared locals', ()=>{
            accept('mutate opt + locals', `
                function trigger(opt){
                    opt.timeout = 200;
                    let hit = opt.status === 200;
                    hit = hit || opt.status === 302;
                    return hit;
                }
            `);
        });
    });
    describe('Object static methods are narrowed', ()=>{
        it('allows keys/values/entries', ()=>{
            accept('Object.keys', `
                function trigger(opt){ return Object.keys(opt).length>0; }
            `);
            accept('Object.values', `
                function trigger(opt){ return Object.values(opt).length>0; }
            `);
            accept('Object.entries', `
                function trigger(opt){
                    return Object.entries(opt).length>0;
                }
            `);
        });
        it('blocks prototype/descriptor escape statics', ()=>{
            reject('getPrototypeOf', `
                function trigger(opt){ return Object.getPrototypeOf(opt); }
            `, 'Object.getPrototypeOf is not allowed');
            reject('defineProperty', `
                function trigger(opt){
                    Object.defineProperty(opt, 'x', {value: 1});
                    return true;
                }
            `, 'Object.defineProperty is not allowed');
            reject('setPrototypeOf', `
                function trigger(opt){
                    Object.setPrototypeOf(opt, {});
                    return true;
                }
            `, 'Object.setPrototypeOf is not allowed');
            reject('create', `
                function trigger(opt){ return Object.create(null); }
            `, 'Object.create is not allowed');
            reject('assign', `
                function trigger(opt){ return Object.assign({}, opt); }
            `, 'Object.assign is not allowed');
            reject('getOwnPropertyDescriptor', `
                function trigger(opt){
                    return Object.getOwnPropertyDescriptor(opt, 'x');
                }
            `, 'Object.getOwnPropertyDescriptor is not allowed');
        });
        it('blocks opaque computed Object access', ()=>{
            reject('Object opaque computed', `
                function trigger(opt){
                    return Object['ge'+'tPrototypeOf'](opt);
                }
            `, 'props <computed>');
        });

    });
    describe('only whitelisted globals are referenceable', ()=>{
        const blocked = ['process', 'require', 'global', 'globalThis',
            'Function', 'eval', 'fetch', 'Reflect', 'Proxy', 'setTimeout',
            'Buffer', 'Promise'];
        it('rejects unknown globals', ()=>{
            for (const g of blocked)
            {
                reject(g, `function trigger(opt){ `
                    +`return typeof ${g} === 'undefined'; }`,
                    `identifiers ${g} is not allowed`);
            }
        });
        it('allows whitelisted globals as references', ()=>{
            accept('RegExp/String/console', `
                function trigger(opt){
                    return new RegExp('x').test(String(opt.status))
                        || Boolean(console.log('x'));
                }
            `);
        });
    });
});

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
            _res.headers['x-brd-ip'] = ip_inj;
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
            const opt = {_res: {hola_headers: {'x-brd-ip': 'ip'}}};
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
                    hola_headers: {'x-brd-ip': '1.2.3.4'}}};
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
                req_stub = sinon.stub(lpm_request, 'request').callsFake(
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
                    {_res: {headers: {'x-brd-ip': ip}}});
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
                    headers: {'x-brd-ip': ip}});
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
                {action_type: 'retry', min_conn_time: 0.1,
                trigger_type: 'min_conn_time', action: {}}
            ]});
            l.on('retry', opt=>{
                this.return();
            });
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
        t_pre('direct', true);
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
