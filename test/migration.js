// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, mocha:true*/
const assert = require('assert');
const migrate = require('../lib/migration.js');
const migrations = migrate.migrations;
const {migrate_trigger} = require('../util/rules_util.js');
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

const t_rule = (v, _type='post')=>(name, rule, _rule)=>it(name, ()=>{
    const {proxies: [_proxy]} = migrations[v]({
        proxies: [{port: 24000, rules: {[_type]: [rule]}}]});
    assert.deepEqual(_proxy, {port: 24000, rules: {[_type]: [_rule]}});
});

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
        const t = t_rule(v);
        t('reduces status into single value', {url: '\\.(jpeg)$',
            type: 'after_hdr', status: {arg: '200 - Success', type: 'in'}},
            {url: '\\.(jpeg)$', type: 'after_hdr', status: 200});
        const status_rule = {type: 'after_hdr', status: 200};
        t('does not change status if it is already simple value', status_rule,
            status_rule);
        t('reduces body into single value', {url: '\\.(jpeg)$',
            type: 'after_body', body: {arg: 'captcha', type: 'in'}},
            {url: '\\.(jpeg)$', type: 'after_body', body: 'captcha'});
        const body_rule = {type: 'after_body', body: 'test123'};
        t('does not change body if it is already simple value', body_rule,
            body_rule);
    });
    describe_version('1.118.284', v=>{
        it('flatten logs object into value', ()=>{
            const _defaults = {atr: 1, logs: {metric: 'logs', value: 10}};
            const _conf = migrations[v]({proxies: [], _defaults});
            assert.equal(_conf._defaults.logs, 10);
        });
        it('does not change config if no logs', ()=>{
            const _defaults = {atr: 1};
            const _conf = migrations[v]({proxies: [], _defaults});
            assert.equal(_conf._defaults.logs, undefined);
        });
        it('does not change config if logs already simple value', ()=>{
            const _defaults = {atr: 1, logs: 100};
            const _conf = migrations[v]({proxies: [], _defaults});
            assert.equal(_conf._defaults.logs, 100);
        });
    });
    describe_version('1.118.308', v=>{
        const t = t_rule(v);
        t('transforms ban ip duration into ms', {action: {ban_ip: '55min'}},
            {action: {ban_ip: 55*60*1000}});
        t('transforms max_req_time into ms', {max_req_time: '500ms'},
            {max_req_time: 500});
        t('transforms min_req_time into ms', {min_req_time: '1000ms'},
            {min_req_time: 1000});
    });
    describe_version('1.118.309', v=>{
        const t = t_rule(v);
        t('transforms status into string', {status: 200}, {status: '200'});
        t('gets rid of status_custom', {status: '523', status_custom: true},
            {status: '523'});
    });
    describe_version('1.118.310', v=>{
        const t = t_rule(v);
        t('gets rid of type and trigger_code', {type: 'before_send',
            url: 'url', trigger_code: '--code--'}, {url: 'url'});
        t('does nothing', {url: 'url'}, {url: 'url'});
    });
    describe_version('1.118.985', v=>{
        const t = t_rule(v, 'pre');
        t('moves email and null_response into action object', {
            url: 'facebook',
            action: 'null_response',
            email: 'test@test.com',
        }, {
            url: 'facebook',
            action_type: 'null_response',
            action: {email: 'test@test.com', null_response: true},
        });
        t('moves bypass_proxy into action object',
            {url: 'facebook', action: 'bypass_proxy'},
            {url: 'facebook', action_type: 'bypass_proxy',
                action: {bypass_proxy: true}});
        t('moves direct into action object',
            {url: 'facebook', action: 'direct'},
            {url: 'facebook', action_type: 'direct', action: {direct: true}});
        t('switch_port -> retry_port', {
            url: 'facebook',
            action: 'switch_port',
            port: 24001,
            retry: 1,
        }, {
            url: 'facebook',
            action_type: 'retry_port',
            action: {retry_port: 24001},
        });
        t('switch_port -> retry_port with email', {
            email: 'test@test.com',
            url: 'facebook',
            action: 'switch_port',
            port: 24001,
            retry: 1,
        }, {
            url: 'facebook',
            action_type: 'retry_port',
            action: {retry_port: 24001, email: 'test@test.com'},
        });
    });
    describe_version('1.119.232', v=>{
        const t = (name, proxy, expected)=>it(name, ()=>{
            const {proxies: [_proxy]} = migrations[v]({proxies: [proxy]});
            assert.deepEqual(_proxy, expected);
        });
        t('merges pre and post arrays',
            {port: 24000, rules: {pre: [{a: 1}, {a: 2}], post: [{b: 1}]}},
            {port: 24000, rules: [{a: 1}, {a: 2}, {b: 1}]});
        t('takes only pre if post is undefined',
            {port: 24000, rules: {pre: [{a: 1}, {a: 2}]}},
            {port: 24000, rules: [{a: 1}, {a: 2}]});
        t('takes only post if pre is undefined',
            {port: 24000, rules: {post: [{a: 1}, {a: 2}]}},
            {port: 24000, rules: [{a: 1}, {a: 2}]});
        t('skips rules if both pre and post are skipped', {rules: {}}, {});
    });
    describe_version('1.119.617', v=>{
        const t = (name, rule, _rule)=>it(name, ()=>{
            const {proxies: [_proxy]} = migrations[v]({
                proxies: [{port: 24000, rules: [rule]}]});
            assert.deepEqual(_proxy, {port: 24000, rules: [_rule]});
        });
        t('delete url if its *', {url: '*', action: {null_response: true}},
            {action: {null_response: true}});
        t('delete url if its **', {url: '**', action: {null_response: true}},
            {action: {null_response: true}});
        t('does not change if url doesnt exists',
            {action: {null_response: true}}, {action: {null_response: true}});
        t('does not change if url is correct', {url: 'x',
            action: {null_response: true}}, {url: 'x',
            action: {null_response: true}});
    });
    describe('rule -> code transformation', ()=>{
        const t = (name, rule, code, _type)=>it(name, ()=>{
            const _rule = migrate_trigger(rule);
            assert.equal(_rule.trigger_code, code);
            assert.equal(_rule.type, _type);
        });
        t('simple', {}, `function trigger(opt){\n`
            +`  return true;\n}`, 'before_send');
        t('with url', {url: 'facebook'}, `function trigger(opt){\n`
            +`  if (!new RegExp(String.raw\`facebook\`).test(opt.url))\n`
            +`    return false;\n`
            +`  return true;\n}`, 'before_send');
        t('min_req_time / retry', {min_req_time: 200, action_type: 'retry',
            trigger_type: 'min_req_time'}, `function trigger(opt){\n`
            +`  opt.timeout = 200;\n`
            +`  return true;\n}`, 'timeout');
        t('min_req_time / retry_port + url', {trigger_type: 'min_req_time',
            min_req_time: 200, action_type: 'retry_port', url: 'facebook'},
            `function trigger(opt){\n`
            +`  opt.timeout = 200;\n`
            +`  if (!new RegExp(String.raw\`facebook\`).test(opt.url))\n`
            +`    return false;\n`
            +`  return true;\n}`, 'timeout');
        t('min_req_time ban_ip', {min_req_time: 100, action_type: 'ban_ip',
            trigger_type: 'min_req_time'}, `function trigger(opt){\n`
            +`  if (opt.time_passed<100)\n`
            +`    return false;\n`
            +`  return true;\n}`, 'after_hdr');
        t('status_code', {status: '200'},
            `function trigger(opt){\n`
            +`  if (!new RegExp(String.raw\`200\`).test(opt.status))\n`
            +`    return false;\n`
            +`  return true;\n}`, 'after_hdr');
        t('status_code with url', {status: '(4|5)..', url: 'facebook'},
            `function trigger(opt){\n`
            +`  if (!new RegExp(String.raw\`(4|5)..\`).test(opt.status))\n`
            +`    return false;\n`
            +`  if (!new RegExp(String.raw\`facebook\`).test(opt.url))\n`
            +`    return false;\n`
            +`  return true;\n}`, 'after_hdr');
        t('max_req_time', {max_req_time: 500}, `function trigger(opt){\n`
            +`  if (opt.time_passed>500)\n`
            +`    return false;\n`
            +`  return true;\n}`, 'after_hdr');
        t('http body', {body: 'captcha'}, `function trigger(opt){\n`
            +`  if (!new RegExp(String.raw\`captcha\`).test(opt.body))\n`
            +`    return false;\n`
            +`  return true;\n}`, 'after_body');
    });
    describe_version('1.136.76', v=>{
        it('should migrate preset round_robin -> rotating', ()=>{
            const conf = {proxies: [
                {port: 24000, field: 1, last_preset_applied: 'round_robin'},
                {port: 24001, last_preset_applied: 'other_preset'},
                {port: 24003},
            ]};
            const _conf = migrations[v](conf);
            assert.deepEqual(_conf, {proxies: [
                {port: 24000, field: 1, last_preset_applied: 'rotating'},
                {port: 24001, last_preset_applied: 'other_preset'},
                {port: 24003},
            ]});
        });
        it('should migrate pool_type round_robin, sequential -> default', ()=>{
            const conf = {proxies: [
                {port: 24000, field: 1, pool_type: 'round_robin'},
                {port: 24001, pool_type: 'sequential'},
                {port: 24002, pool_type: 'long_availability'},
                {port: 24003},
            ]};
            const _conf = migrations[v](conf);
            assert.deepEqual(_conf, {proxies: [
                {port: 24000, field: 1},
                {port: 24001},
                {port: 24002, pool_type: 'long_availability'},
                {port: 24003},
            ]});
        });
    });
    describe_version('1.148.122', v=>{
        it('should turn on proxy resolving when pool_size is >= 1', ()=>{
            const conf = {
                _defaults: {},
                proxies: [
                    {port: 24000, pool_size: 0},
                    {port: 24001, pool_size: 1},
                    {port: 24002, pool_size: 100, opt: true},
                    {port: 24003, opt: true},
                ],
            };
            const _conf = migrations[v](conf);
            assert.deepEqual(_conf, {
                _defaults: {},
                proxies: [
                    {port: 24000, pool_size: 0},
                    {port: 24001, pool_size: 1, proxy_resolve: true},
                    {port: 24002, pool_size: 100, opt: true,
                        proxy_resolve: true},
                    {port: 24003, opt: true},
                ],
            });
        });
    });
    describe_version('1.153.222', v=>{
        it('should change random user agent truthy values to desktop', ()=>{
            const conf = {
                _defaults: {},
                proxies: [
                    {port: 24000},
                    {port: 24001, random_user_agent: 1},
                    {port: 24002, random_user_agent: true},
                ],
            };
            const _conf = migrations[v](conf);
            assert.deepEqual(_conf, {
                _defaults: {},
                proxies: [
                    {port: 24000},
                    {port: 24001, random_user_agent: 'desktop'},
                    {port: 24002, random_user_agent: 'desktop'},
                ],
            });
        });
    });
    describe_version('1.153.629', v=>{
        it('should rename and change secure proxy truthy values to https',
        ()=>{
            const conf = {
                _defaults: {},
                proxies: [
                    {port: 24000},
                    {port: 24001, secure_proxy: 1},
                    {port: 24002, secure_proxy: true},
                ],
            };
            const _conf = migrations[v](conf);
            assert.deepEqual(_conf, {
                _defaults: {},
                proxies: [
                    {port: 24000},
                    {port: 24001, proxy_connection_type: 'https'},
                    {port: 24002, proxy_connection_type: 'https'},
                ],
            });
        });
    });
    describe_version('1.154.55', v=>{
        it('should not do anything if preset not set', ()=>{
            const conf = {
                _defaults: {},
                proxies: [
                    {port: 24000},
                    {port: 24001, last_preset_applied: 'rotating'},
                ],
            };
            const _conf = migrations[v](conf);
            assert.deepEqual(_conf, {
                _defaults: {},
                proxies: [
                    {port: 24000},
                    {port: 24001, preset: 'rotating'},
                ],
            });
        });
    });
    describe_version('1.154.56', v=>{
        it('should convert high_performance preset -> rotating', ()=>{
            const conf = {
                _defaults: {},
                proxies: [
                    {port: 24000},
                    {port: 24001, preset: 'high_performance'},
                    {port: 24002, preset: 'long_session'},
                ],
            };
            const _conf = migrations[v](conf);
            assert.deepEqual(_conf, {
                _defaults: {},
                proxies: [
                    {port: 24000},
                    {port: 24001, preset: 'rotating'},
                    {port: 24002, preset: 'long_session'},
                ],
            });
        });
    });
    describe_version('1.155.263', v=>{
        it('should merge random_user_agent and user_agent options', ()=>{
            const conf = {
                _defaults: {},
                proxies: [
                    {port: 24000},
                    {port: 24002, random_user_agent: 'desktop'},
                    {port: 24002, random_user_agent: 'mobile'},
                    {port: 24002, user_agent: 'Mozilla'},
                ],
            };
            const _conf = migrations[v](conf);
            assert.deepEqual(_conf, {
                _defaults: {},
                proxies: [
                    {port: 24000},
                    {port: 24002, user_agent: 'random_desktop'},
                    {port: 24002, user_agent: 'random_mobile'},
                    {port: 24002, user_agent: 'Mozilla'},
                ],
            });
        });
    });
    describe_version('1.155.264', v=>{
        it('should change preset to long availability if pool type set', ()=>{
            const conf = {
                _defaults: {},
                proxies: [
                    {port: 24000},
                    {port: 24001, preset: 'high_performance',
                        pool_type: 'long_availability'},
                    {port: 24002, preset: 'long_session'},
                ],
            };
            const _conf = migrations[v](conf);
            assert.deepEqual(_conf, {
                _defaults: {},
                proxies: [
                    {port: 24000},
                    {port: 24001, preset: 'long_availability'},
                    {port: 24002, preset: 'long_session'},
                ],
            });
        });
    });
    describe_version('1.171.624', v=>{
        it('remove extra fields from config', ()=>{
            const conf = {
                _defaults: {},
                proxies: [
                    {port: 24000, zone: 'z', ips: ['1.1.1.1'], ssl: true,
                        hosts: ['1.1.1.1'], mobile: true, static: true,
                        ssl_perm: true, unblock: true},
                ],
            };
            const _conf = migrations[v](conf);
            assert.deepEqual(_conf, {
                _defaults: {},
                proxies: [
                    {port: 24000, zone: 'z', ips: ['1.1.1.1'], ssl: true}],
            });
        });
    });
    describe_version('1.175.938', v=>{
        it('renames token -> google_token', ()=>{
            const conf = {
                _defaults: {customer: 'test', token: 'token123'},
                proxies: [],
            };
            const _conf = migrations[v](conf);
            assert.deepEqual(_conf, {
                _defaults: {customer: 'test', google_token: 'token123'},
                proxies: [],
            });
        });
        it('leaves config untouched if there is no token attribute', ()=>{
            const conf = {
                _defaults: {customer: 'test', password: 'pass'},
                proxies: [],
            };
            const _conf = migrations[v](conf);
            assert.deepEqual(_conf, {
                _defaults: {customer: 'test', password: 'pass'},
                proxies: [],
            });
        });
    });
    describe_version('1.177.584', v=>{
        it('removes preset if long_availability', ()=>{
            const conf = {
                _defaults: {customer: 'test', token: 'token123'},
                proxies: [
                    {port: 24000, preset: 'long_availability'},
                    {port: 24001, preset: 'another'},
                ],
            };
            const _conf = migrations[v](conf);
            assert.deepEqual(_conf, {
                _defaults: {customer: 'test', token: 'token123'},
                proxies: [{port: 24000}, {port: 24001, preset: 'another'}],
            });
        });
        it('rnd_usr_agent_and_cookie_header -> rotating', ()=>{
            const conf = {
                _defaults: {customer: 'test', token: 'token123'},
                proxies: [
                    {port: 24000, preset: 'rnd_usr_agent_and_cookie_header'},
                    {port: 24001, preset: 'another'},
                ],
            };
            const _conf = migrations[v](conf);
            assert.deepEqual(_conf, {
                _defaults: {customer: 'test', token: 'token123'},
                proxies: [
                    {port: 24000, preset: 'rotating'},
                    {port: 24001, preset: 'another'},
                ],
            });
        });
        it('max_requests -> rotate_session', ()=>{
            const conf = {
                _defaults: {customer: 'test', token: 'token123'},
                proxies: [
                    {port: 24000},
                    {port: 24001, max_requests: 0},
                    {port: 24001, max_requests: 1},
                    {port: 24001, max_requests: 10},
                ],
            };
            const _conf = migrations[v](conf);
            assert.deepEqual(_conf, {
                _defaults: {customer: 'test', token: 'token123'},
                proxies: [
                    {port: 24000},
                    {port: 24001, rotate_session: false},
                    {port: 24001, rotate_session: true},
                    {port: 24001, rotate_session: true},
                ],
            });
        });
    });
    describe_version('1.177.792', v=>{
        it('merges session per machine into long single session', ()=>{
            const conf = {
                _defaults: {},
                proxies: [
                    {port: 24000, preset: 'sticky_ip', sticky_ip: true},
                    {port: 24001, preset: 'another'},
                ],
            };
            const _conf = migrations[v](conf);
            assert.deepEqual(_conf, {
                _defaults: {},
                proxies: [
                    {port: 24000, sticky_ip: true},
                    {port: 24001, preset: 'another'},
                ],
            });
        });
    });
    describe_version('1.182.312', v=>{
        it('disables config sync and sets ask_sync_config', ()=>{
            const conf = {
                _defaults: {},
                proxies: [],
            };
            const _conf = migrations[v](conf);
            assert.deepEqual(_conf, {
                _defaults: {sync_config: false, ask_sync_config: true},
                proxies: [],
            });
        });
        it('keeps enabled config sync and not set ask_sync_config', ()=>{
            const conf = {
                _defaults: {sync_config: true},
                proxies: [],
            };
            const _conf = migrations[v](conf);
            assert.deepEqual(_conf, {
                _defaults: {sync_config: true},
                proxies: [],
            });
        });
    });
    describe_version('1.185.470', v=>{
        it('set sync_config to true if was undefined', ()=>{
            const conf = {
                _defaults: {},
                proxies: [],
            };
            const _conf = migrations[v](conf);
            assert.deepEqual(_conf, {
                _defaults: {sync_config: true},
                proxies: [],
            });
        });
        it('dont change if sync_config was disabled', ()=>{
            const conf = {
                _defaults: {sync_config: false},
                proxies: [],
            };
            const _conf = migrations[v](conf);
            assert.deepEqual(_conf, {
                _defaults: {sync_config: false},
                proxies: [],
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
