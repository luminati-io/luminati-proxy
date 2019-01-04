// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, mocha:true*/
const assert = require('assert');
const migrate = require('../lib/migration.js');
const migrations = migrate.migrations;
const migrate_rule = migrate.migrate_rule;
const pkg = require('../package.json');

const tests_run = {};

const assert_default = (a, b)=>{
    assert.deepEqual(a._default, b._default);
    assert.equal(a.proxies.length, b.proxies.length);
};

const test_edge_cases = v=>it('edge cases', ()=>{
    const migration = migrations[v];
    migration({});
    migration({proxies: []});
    migration({_defaults: {}});
});

const describe_version = function(name, tests){
    describe(name, function(){
        tests_run[this.title] = true;
        test_edge_cases(this.title);
        tests(this.title);
    });
};

describe('migration', ()=>{
    describe_version('1.116.387', v=>{
        it('deletes socks field', ()=>{
            const conf = {proxies: [{socks: 1234}, {}]};
            const _conf = migrations[v](conf);
            assert.equal(_conf.socks, undefined);
            assert_default(conf, _conf);
        });
        it('transforms rules', ()=>{
            const conf = {proxies: [
                {direct_include: 'amazon'},
                {null_response: 'facebook', bypass_proxy: 'google'},
            ]};
            const _conf = migrations[v](conf);
            assert.deepEqual(_conf.proxies[0], {rules: {pre: [{
                trigger_type: 'url',
                url: 'amazon',
                action: 'direct',
            }]}});
            assert.deepEqual(_conf.proxies[1], {rules: {pre: [{
                trigger_type: 'url',
                url: 'facebook',
                action: 'null_response',
            }, {
                trigger_type: 'url',
                url: 'google',
                action: 'bypass_proxy',
            }]}});
            assert_default(conf, _conf);
        });
        it('keep existing rules', ()=>{
            const rule = {};
            const conf = {proxies: [{
                null_response: 'facebook',
                rules: {pre: [rule]},
            }]};
            const _conf = migrations[v](conf);
            assert.equal(_conf.proxies[0].rules.pre.length, 2);
            assert.equal(_conf.proxies[0].rules.pre[0], rule);
            assert_default(conf, _conf);
        });
    });
    describe_version('1.116.548', v=>{
        it('transforms keep_alive from number into true', ()=>{
            const conf = {proxies: [
                {port: 24000, field: 1, keep_alive: 45},
                {port: 24001, keep_alive: 50},
                {port: 24002, keep_alive: 0},
                {port: 24003},
            ]};
            const _conf = migrations[v](conf);
            assert.deepEqual(_conf, {proxies: [
                {port: 24000, field: 1, keep_alive: true},
                {port: 24001, keep_alive: true},
                {port: 24002},
                {port: 24003},
            ]});
        });
    });
    describe_version('1.116.963', v=>{
        it('transforms url object into trigger_code for post', ()=>{
            const proxy = {rules: {post: [{
                res: [{trigger_type: 'url'}],
                url: {code: `code`, regexp: `\\.(svg|jpeg)$`},
            }]}};
            const _conf = migrations[v]({proxies: [proxy]});
            assert.deepEqual(_conf, {proxies: [
                {rules: {post: [{
                    res: [{trigger_type: 'url'}],
                    url: `\\.(svg|jpeg)$`,
                    trigger_code: `code`,
                }]}},
            ]});
        });
        it('transforms url object into trigger_code for pre', ()=>{
            const proxy = {rules: {pre: [{
                action: 'null_response',
                url: {code: `code`, regexp: `\\.(svg|jpeg|jpg)$`},
            }]}};
            const _conf = migrations[v]({proxies: [proxy]});
            assert.deepEqual(_conf, {proxies: [
                {rules: {pre: [{
                    action: 'null_response',
                    url: `\\.(svg|jpeg|jpg)$`,
                    trigger_code: `code`,
                }]}},
            ]});
        });
        it('transofrm flat string into trigger_code', ()=>{
            const proxy = {rules: {pre: [{
                action: 'null_response',
                url: 'facebook.com',
            }]}};
            const _conf = migrations[v]({proxies: [proxy]});
            assert.deepEqual(_conf, {proxies: [
                {rules: {pre: [{
                    action: 'null_response',
                    url: `facebook.com`,
                    trigger_code: `function trigger(opt){\n  `
                        +`return /facebook.com/.test(opt.url);\n}`,
                }]}},
            ]});
        });
        it('transofrm empty regex into trigger_code', ()=>{
            const proxy = {rules: {pre: [{
                action: 'null_response',
                url: '**',
            }]}};
            const _conf = migrations[v]({proxies: [proxy]});
            assert.deepEqual(_conf, {proxies: [
                {rules: {pre: [{
                    action: 'null_response',
                    url: '',
                    trigger_code: `function trigger(opt){\n  return true;\n}`,
                }]}},
            ]});
        });
    });
    describe_version('1.116.964', v=>{
        it('transforms array res into flat rule', ()=>{
            const proxy = {rules: {post: [{
                res: [{
                    trigger_type: 'url',
                    action: {ban_ip: '10min', retry: true},
                    action_type: 'ban_ip',
                }],
                trigger_code: `code`,
            }]}};
            const _conf = migrations[v]({proxies: [proxy]});
            assert.deepEqual(_conf, {proxies: [
                {rules: {post: [{
                    trigger_type: 'url',
                    trigger_code: `code`,
                    action_type: 'ban_ip',
                    action: {ban_ip: '10min', retry: true},
                }]}},
            ]});
        });
        it('does nothing to proxies without any rules', ()=>{
            const proxy = {port: 24000, param: 'a'};
            const _conf = migrations[v]({proxies: [proxy]});
            assert.deepEqual(_conf, {proxies: [proxy]});
        });
        it('does nothing to proxies without post rules', ()=>{
            const proxy = {port: 24000, rules: {pre: [{id: 'rule1'}]}};
            const _conf = migrations[v]({proxies: [proxy]});
            assert.deepEqual(_conf, {proxies: [proxy]});
        });
        it('does nothing to rules without res field', ()=>{
            const proxy = {port: 24000, rules: {post: [{id: 'rule1'}]}};
            const _conf = migrations[v]({proxies: [proxy]});
            assert.deepEqual(_conf, {proxies: [proxy]});
        });
    });
    describe_version('1.117.683', v=>{
        const t = (name, _type, rule, type)=>it(name, ()=>{
            const {proxies: [_proxy]} = migrations[v]({
                proxies: [{port: 24000, rules: {[_type]: [rule]}}]});
            assert.deepEqual(_proxy, {port: 24000, rules: {[_type]: [
                Object.assign({}, rule, {type}),
            ]}});
        });
        t('url -> before_send', 'pre',
            {action: 'null_response', url: '\\.(jpeg)$'}, 'before_send');
        t('min_req_time -> timeout', 'pre',
            {min_req_time: 500, url: '\\.(jpeg)$'}, 'timeout');
        t('max_req_time -> after_hdr', 'post',
            {max_req_time: 500, url: '\\.(jpeg)$'}, 'after_hdr');
        t('status -> after_hdr', 'post',
            {status: {}, url: '\\.(jpeg)$'}, 'after_hdr');
        t('body -> after_body', 'post',
            {body: {}, url: '\\.(jpeg)$'}, 'after_body');
        t('body -> after_body', 'post',
            {action_type: 'process', url: '\\.(jpeg)$'}, 'after_body');
    });
    describe_version('1.117.684', v=>{
        const t = (name, rule, obj)=>it(name, ()=>{
            const {proxies: [_proxy]} = migrations[v]({
                proxies: [{port: 24000, rules: {post: [rule]}}]});
            assert.deepEqual(_proxy, {port: 24000, rules: {post: [
                Object.assign({}, rule, obj),
            ]}});
        });
        t('reduces status into single value', {url: '\\.(jpeg)$',
            type: 'after_hdr', status: {arg: '200 - Success', type: 'in'}},
            {status: 200});
        t('does not change status if it is already simple value',
            {type: 'after_hdr', status: 200});
        t('reduces body into single value', {url: '\\.(jpeg)$',
            type: 'after_body', body: {arg: 'captcha', type: 'in'}},
            {body: 'captcha'});
        t('does not change body if it is already simple value',
            {type: 'after_body', body: 'test123'});
    });
    describe_version('x.rules_trigger', v=>{
        it('migrates correctly whole config', ()=>{
            const proxy = {port: 24000, rules: {pre: [{
                action: 'null_response',
                url: '\\.(jpeg)$',
            }]}};
            const _conf = migrations[v]({proxies: [proxy]});
            const expected_code = `function trigger(opt){\n`
            +`  if (!/\\.(jpeg)$/.test(opt.url))\n`
            +`    return false;\n`
            +`  return true;\n`
            +`}`;
            assert.deepEqual(_conf, {proxies: [{port: 24000, rules: {pre: [{
                action: 'null_response',
                url: '\\.(jpeg)$',
                trigger_code: expected_code,
                type: 'before_send',
            }]}}]});
        });
        describe('rule -> code transformation', ()=>{
            const t = (name, type, rule, code, _type)=>it(name, ()=>{
                const _rule = migrate_rule(type)(rule);
                assert.equal(_rule.trigger_code, code);
                assert.equal(_rule.type, _type);
            });
            describe('pre_rules', ()=>{
                t('simple', 'pre', {}, `function trigger(opt){\n`
                    +`  return true;\n}`, 'before_send');
                t('with url', 'pre', {url: 'facebook'},
                    `function trigger(opt){\n`
                    +`  if (!/facebook/.test(opt.url))\n`
                    +`    return false;\n`
                    +`  return true;\n}`, 'before_send');
                it('min_req_time / timeout');
            });
            describe('post_rules', ()=>{
                t('status_code', 'post', {status: {arg: '200 - Success',
                    type: 'in'}}, `function trigger(opt){\n`
                    +`  if (opt.status_code!=200)\n`
                    +`    return false;\n`
                    +`  return true;\n}`, 'after_hdr');
                t('status_code with url', 'post', {
                    status: {arg: '301 - Moved Pernamently', type: 'in'},
                    url: 'facebook'}, `function trigger(opt){\n`
                    +`  if (opt.status_code!=301)\n`
                    +`    return false;\n`
                    +`  if (!/facebook/.test(opt.url))\n`
                    +`    return false;\n`
                    +`  return true;\n}`, 'after_hdr');
                t('max_req_time', 'post', {max_req_time: 500},
                    `function trigger(opt){\n`
                    +`  if (opt.time_passed>500)\n`
                    +`    return false;\n`
                    +`  return true;\n}`, 'after_hdr');
                t('http body', 'post', {body: {arg: 'captcha', type: '=~'}},
                    `function trigger(opt){\n`
                    +`  if (!/captcha/.test(opt.body))\n`
                    +`    return false;\n`
                    +`  return true;\n}`, 'after_body');
            });
        });
    });
    it('ensures that each production migration has a test', ()=>{
        for (let v in migrations)
        {
            if (v.startsWith('x'))
                continue;
            assert.equal(tests_run[v], true);
        }
    });
});

describe('manager', ()=>{
    let executed;
    const fake_migrations = {
        '1.0.0': c=>{ executed['1.0.0'] = true; return c; },
        '2.0.0': c=>{ executed['2.0.0'] = true; return c; },
        '2.1.0': c=>{ executed['2.1.0'] = true; return c; },
        '2.2.0': c=>{ executed['2.2.0'] = true; return c; },
        'x.dev': c=>{ executed['x.dev'] = true; return c; },
    };
    beforeEach(()=>{
        executed = {};
    });
    it('adds the current version', ()=>{
        const conf = {};
        const _conf = migrate(conf);
        assert.equal(_conf._defaults.version, pkg.version);
    });
    it('runs all the migrations when version is empty', ()=>{
        const conf = {};
        migrate(conf, fake_migrations);
        assert.deepEqual(executed,
            {'1.0.0': true, '2.0.0': true, '2.1.0': true, '2.2.0': true});
    });
    it('runs migrations starting from specified version', ()=>{
        const conf = {_defaults: {version: '2.0.0'}};
        migrate(conf, fake_migrations);
        assert.deepEqual(executed,
            {'2.0.0': true, '2.1.0': true, '2.2.0': true});
    });
    it('runs migrations after specified version', ()=>{
        const conf = {_defaults: {version: '2.0.1'}};
        migrate(conf, fake_migrations);
        assert.deepEqual(executed, {'2.1.0': true, '2.2.0': true});
    });
    it('does not run migrations starting with x', ()=>{
        const conf = {};
        migrate(conf, fake_migrations);
        assert.equal(executed['x.dev'], undefined);
    });
    it('throws error if invalid version and not starting with x', ()=>{
        const _migrations = Object.assign({}, fake_migrations, {ver: c=>{
            executed.ver = true;
            return c;
        }});
        assert.throws(()=>migrate({}, _migrations), /Invalid Version/);
    });
});
