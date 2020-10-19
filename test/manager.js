// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, mocha:true*/
const nock = require('nock');
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');
const request = require('request');
const sinon = require('sinon');
const winston = require('winston');
// needed to make lpm_file.js to set work dir to tmp dir
process.argv.push('--dir', os.tmpdir());
const Manager = require('../lib/manager.js');
const cities = require('../lib/cities');
sinon.stub(cities, 'ensure_data', ()=>null);
sinon.stub(process, 'exit');
const logger = require('../lib/logger.js');
const etask = require('../util/etask.js');
const zutil = require('../util/util.js');
const pkg = require('../package.json');
const qw = require('../util/string.js').qw;
const user_agent = require('../util/user_agent.js');
const lpm_util = require('../util/lpm_util.js');
const util_lib = require('../lib/util.js');
const puppeteer = require('../lib/puppeteer.js');
const customer = 'abc';
const password = 'xyz';
const {assert_has} = require('./common.js');
const api_base = 'https://'+pkg.api_domain;

describe('manager', ()=>{
    let app, temp_files, logger_stub, sandbox;
    // XXX krzysztof: make it configurable to show logs in tests
    const stub_logger = ()=>{
        logger.transports.forEach(t=>{ t.silent = true; });
        logger_stub = sinon.stub(logger, 'notice');
    };
    const unstub_logger = ()=>{
        logger_stub.restore();
        logger.transports.forEach(t=>{ t.silent = false; });
    };
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
        if (!only_explicit)
        {
            if (!get_param(args, '--proxy'))
                args = args.concat(['--proxy', '127.0.0.1']);
            if (!get_param(args, '--proxy_port'))
                args = args.concat(['--proxy_port', 24000]);
            if (!get_param(args, '--config')&&!get_param(args, '--no-config'))
                args.push('--no-config');
            if (!get_param(args, '--customer'))
                args = args.concat(['--customer', customer]);
            if (!get_param(args, '--password'))
                args = args.concat(['--password', password]);
            if (!get_param(args, '--dropin')&&!get_param(args, '--no-dropin'))
                args = args.concat(['--no-dropin']);
            if (!get_param(args, '--cookie')&&!get_param(args, '--no-cookie'))
                args.push('--no-cookie');
            if (!get_param(args, '--local_login') &&
                !get_param(args, '--no-local_login'))
            {
                args = args.concat(['--no-local_login']);
            }
            args = args.concat('--loki', '/tmp/testdb');
        }
        Manager.prototype.set_current_country = ()=>null;
        Manager.prototype.check_conn = ()=>null;
        Manager.prototype.lpm_users_get = ()=>null;
        Manager.prototype.init_lpm_f_ws = ()=>null;
        Manager.prototype.get_lpm_conf = function(){
            this.lum_conf = {_defaults: {zones: {
                static: {},
                foo: {},
            }}};
            return this.lum_conf;
        };
        manager = new Manager(lpm_util.init_args(args));
        yield manager.start();
        return {manager};
    });
    let tmp_file_counter = 0;
    const temp_file_path = (ext='tmp')=>{
        const p = path.join(os.tmpdir(),
            `test-${Date.now()}-${tmp_file_counter++}.${ext}`);
        const done = ()=>{
            if (this.path)
            {
                try {
                    fs.unlinkSync(path);
                } catch(e){
                    console.error(e.message);
                }
                this.path = null;
            }
        };
        return {path: p, done};
    };
    const temp_file = (content, ext)=>{
        const temp = temp_file_path(ext);
        fs.writeFileSync(temp.path, JSON.stringify(content));
        return temp;
    };
    const app_with_config = (opt={})=>etask(function*(){
        const args = [];
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
            if (Array.isArray(cli[k]))
                args.push(...cli[k]);
            else
                args.push(cli[k]);
        });
        if (opt.config)
        {
            const config_file = temp_file(opt.config, 'json');
            args.push('--config');
            args.push(config_file.path);
            temp_files.push(config_file);
        }
        return yield app_with_args(args, opt.only_explicit);
    });
    const app_with_proxies = (proxies, cli)=>etask(function*(){
        return yield app_with_config({config: {proxies}, cli});
    });
    const api = (_path, method, data, json, headers)=>etask(function*(){
        const admin = 'http://127.0.0.1:'+Manager.default.www;
        const opt = {
            url: admin+'/'+_path,
            method: method||'GET',
            json,
            body: data,
            headers: headers || {'x-lpm-fake': true},
        };
        return yield etask.nfn_apply(request, [opt]);
    });
    const api_json = (_path, opt={})=>etask(function*(){
        return yield api(_path, opt.method, opt.body, true, opt.headers);
    });
    const json = (_path, method, data)=>etask(function*(){
        const res = yield api(_path, method, data, true);
        assert.equal(res.statusCode, 200);
        return res.body;
    });
    const make_user_req = (port=24000, status=200)=>{
        return api_json('api/test/'+port, {
            method: 'POST',
            body: {
                url: 'http://lumtest.com/myip.json',
                headers: {'x-lpm-fake': true, 'x-lpm-fake-status': status},
            },
        });
    };
    before(stub_logger);
    afterEach('after manager', etask._fn(function*(_this){
        nock.cleanAll();
        if (!app)
            return;
        yield app.manager.stop(true);
        if (process.platform=='win32')
            yield etask.sleep(10);
        if (!app)
            return;
        app = null;
    }));
    beforeEach(()=>{
        temp_files = [];
        sandbox = sinon.sandbox.create();
        sandbox.stub(os, 'cpus').returns([1, 1]);
        nock(api_base).get('/').times(2).reply(200, {});
        nock(api_base).get('/lpm/server_conf').query(true).reply(200, {});
    });
    afterEach('after manager 2', ()=>{
        sandbox.verifyAndRestore();
        temp_files.forEach(f=>f.done());
    });
    describe('get_params', ()=>{
        const t = (name, _args, expected)=>it(name, etask._fn(function(_this){
            const mgr = new Manager(lpm_util.init_args(_args));
            assert.deepEqual(expected, mgr.get_params());
        }));
        const def = '--throttle 2';
        t('default', qw(def), ['--throttle', 2]);
        t('credentials', qw`${def} --customer test_user --password abcdefgh`,
            ['--throttle', 2]);
        t('credentials with no-config',
            ['--no-config', '--customer', 'usr', '--password', 'abc',
                '--zone', 'z'],
            ['--no-config', '--customer', 'usr', '--password', 'abc',
                '--zone', 'z']);
    });
    describe('config load', ()=>{
        const t = (name, config, expected)=>it(name, etask._fn(
        function*(_this){
            _this.timeout(6000);
            app = yield app_with_config(config);
            const proxies = yield json('api/proxies_running');
            assert.equal(proxies.length, expected.length);
            assert_has(proxies, expected, 'proxies');
        }));
        const simple_proxy = {port: 24024};
        t('cli only', {cli: simple_proxy, config: []},
            [Object.assign({proxy_type: 'persist'}, simple_proxy)]);
        t('main config only', {config: {proxies: [simple_proxy]}},
            [Object.assign({proxy_type: 'persist'}, simple_proxy)]);
        t('config file', {config: {proxies: [simple_proxy]}}, [simple_proxy]);
        describe('default zone', ()=>{
            const zone_static = {password: ['pass1']};
            const zone_foo = {password: ['pass2']};
            const zones = {
                static: Object.assign({}, zone_static),
                foo: Object.assign({}, zone_foo),
            };
            const t2 = (name, config, expected, _defaults={zone: 'static'})=>{
                t(name, zutil.set(config, 'cli.customer', 'testc1'), expected);
            };
            t2('from defaults', {config: {
                _defaults: {
                    zone: 'foo',
                    customer: 'testc1',
                    lpm_token: 'token',
                },
                proxies: [simple_proxy],
            }}, [Object.assign({zone: 'foo'}, simple_proxy)],
                {zone: 'static', zones});
            t2('keep default', {config: {
                _defaults: {
                    zone: 'foo',
                    customer: 'testc1',
                    lpm_token: 'token',
                },
                proxies: [simple_proxy]},
            }, [Object.assign({zone: 'foo'}, simple_proxy)]);
        });
        describe('args as default params for proxy ports', ()=>{
            it('should use proxy from args', etask._fn(function*(_this){
                _this.timeout(6000);
                app = yield app_with_args(['--proxy', '1.2.3.4',
                    '--proxy_port', '3939', '--dropin']);
                const dropin = app.manager.proxy_ports[22225];
                assert.equal(dropin.opt.proxy, '1.2.3.4');
                assert.equal(dropin.opt.proxy_port, 3939);
            }));
        });
        it('invalid reverse_lookup_values doesnt break running proxies',
        etask._fn(function*(_this){
            _this.timeout(6000);
            app = yield app_with_proxies([
                {
                    port: 24000,
                    har_limit: 9999,
                    reverse_lookup_values: ['1.1.1.1'],
                },
                {
                    port: 24001,
                    har_limit: 9999,
                    reverse_lookup_values: 'invalid_not_array',
                },
            ]);
            const proxies = yield json('api/proxies_running');
            const proxy = port=>proxies.find(p=>p.port==port);
            assert.equal(proxies.length, 2);
            assert.ok(proxy(24000).reverse_lookup_values);
            assert.deepEqual(proxy(24000).reverse_lookup_values, ['1.1.1.1']);
            assert.ok(!proxy(24001).reverse_lookup_values);
        }));
    });
    describe('default values', ()=>{
        it('default har_limit is 1024', ()=>etask(function*(){
            app = yield app_with_args(['--port', '24000']);
            assert.equal(app.manager.proxy_ports[24000].opt.har_limit, 1024);
        }));
        it('applies explicit mgr argv to defaults', ()=>etask(function*(){
            app = yield app_with_args(['--port', '24000', '--har_limit',
                '1337', '--api_domain', 'invalid_domain']);
            const {opt} = app.manager.proxy_ports[24000];
            assert.equal(app.manager._defaults.api_domain,
                pkg.api_domain_fallback);
            assert.equal(opt.har_limit, 1337);
            assert.equal(opt.api_domain, pkg.api_domain_fallback);
        }));
    });
    describe('report_bug', ()=>{
        // XXX krzysztof: get rid of this
        before(()=>{
            unstub_logger();
            const console_t = logger.transports.find(
                t=>t instanceof winston.transports.Console);
            console_t.silent = true;
        });
        after(stub_logger);
        // can't rm current log file because transports rely on it
        beforeEach(()=>fs.truncateSync(logger.lpm_filename, 0));
        it('should send logs, har and config', etask._fn(function*(_this){
            _this.timeout(6000);
            app = yield app_with_config({config: {}, cli: {log: 'notice'}});
            const desc = 'bug description', email = 'test@luminati.io';
            const ua = 'Mozilla/5.0 (Windows NT 6.1; Win64; x64; rv:47.0) '+
            'Gecko/20100101 Firefox/47.0';
            const req = {body: {desc, email}, get: ()=>ua};
            const res = {
                status: sinon.stub().returnsThis(),
                json: sinon.stub(),
            };
            const request_stub = sinon.stub(app.manager, 'api_request');
            request_stub.returns({statusCode: 200, body: 'ok'});
            yield app.manager.report_bug_api(req, res);
            const report = request_stub.firstCall.args[0].form.report;
            assert.ok(report.config);
            assert.ok(report.log);
            assert.ok(report.har);
            assert.equal(report.desc, desc);
            assert.equal(report.email, email);
            assert.equal(report.browser, user_agent.guess_browser(ua).browser);
            assert.equal(report.os, util_lib.format_platform(os.platform()));
            sinon.assert.calledWith(res.status, 200);
            sinon.assert.calledWith(res.json, 'ok');
        }));
    });
    describe('dropin', function(){
        this.timeout(6000);
        it('off', etask._fn(function*(_this){
            app = yield app_with_args(['--no-dropin']);
            assert.ok(!app.manager.proxy_ports[22225]);
        }));
        it('on', etask._fn(function*(_this){
            app = yield app_with_args(['--dropin']);
            assert.ok(!!app.manager.proxy_ports[22225]);
        }));
        it('dropin_port', etask._fn(function*(_this){
            app = yield app_with_args(['--dropin', '--dropin_port', '25000']);
            assert.ok(!!app.manager.proxy_ports[25000]);
            assert.ok(!app.manager.proxy_ports[22225]);
        }));
    });
    describe('api', ()=>{
        it('ssl', etask._fn(function*(_this){
            app = yield app_with_args();
            const res = yield api('ssl');
            assert_has(res.headers, {
                'content-type': 'application/x-x509-ca-cert',
                'content-disposition': 'filename=luminati.crt',
            }, 'headers');
            assert.equal(res.body, fs.readFileSync(path.join(__dirname,
                '../bin/ca.crt')), 'certificate');
        }));
        describe('version info', ()=>{
            it('current', ()=>etask(function*(){
                app = yield app_with_args();
                const body = yield json('api/version');
                assert.equal(body.version, pkg.version);
            }));
        });
        describe('proxies', ()=>{
            describe('get', ()=>{
                it('normal', etask._fn(function*(_this){
                    const proxies = [{port: 24023}, {port: 24024}];
                    app = yield app_with_proxies(proxies);
                    let res = yield json('api/proxies');
                    assert_has(res, proxies, 'proxies');
                    res = yield json('api/proxies_running');
                    assert_has(res, proxies, 'proxies_running');
                }));
            });
            describe('post', ()=>{
                it('normal persist', etask._fn(function*(_this){
                    let sample_proxy = {port: 24001};
                    const res_proxy = Object.assign({customer, password},
                        sample_proxy);
                    app = yield app_with_proxies([], {});
                    let res = yield json('api/proxies', 'post',
                        {proxy: sample_proxy});
                    assert_has(res, {data: res_proxy}, 'proxies');
                    res = yield json('api/proxies');
                    assert.equal(res.length, 1);
                }));
                it('conflict', etask._fn(function*(_this){
                    const sample_proxy = {port: 24000};
                    const proxies = [sample_proxy];
                    app = yield app_with_proxies(proxies, {});
                    const res = yield api_json('api/proxies',
                        {method: 'post', body: {proxy: sample_proxy}});
                    assert.equal(res.statusCode, 400);
                    assert_has(res.body, {errors: []}, 'proxies');
                }));
                const t = (name, status_code)=>it(name, ()=>etask(function*(){
                    const sample_proxy = {port: 24000,
                        ext_proxies: ['127.0.0.1:8888']};
                    nock(api_base).get('/cp/lum_local_conf').query(true)
                        .reply(200, {mock_result: true, _defaults: true});
                    nock(api_base).post('/ext_proxy_created').query(true)
                        .reply(status_code, {});
                    app = yield app_with_config();
                    let res = yield json('api/proxies', 'post',
                        {proxy: sample_proxy});
                    assert_has(res, {data: sample_proxy}, 'proxies');
                    res = yield json('api/proxies_running');
                    assert_has(res, [sample_proxy], 'proxies');
                }));
                t('external', 200);
                t('external, backend is down', 500);
            });
            describe('put', ()=>{
                it('normal', etask._fn(function*(_this){
                    const put_proxy = {port: 24001};
                    const proxies = [{port: 24000}];
                    app = yield app_with_proxies(proxies, {});
                    let res = yield json('api/proxies/24000', 'put',
                        {proxy: put_proxy});
                    assert_has(res, {data: put_proxy});
                    res = yield json('api/proxies_running');
                    assert_has(res, [put_proxy], 'proxies');
                }));
                it('inherit defaults', ()=>etask(function*(){
                    const put_proxy = {port: 24001};
                    const proxies = [{port: 24000}];
                    const res_proxy = Object.assign({}, {customer, password},
                        put_proxy);
                    app = yield app_with_proxies(proxies, {});
                    let res = yield json('api/proxies/24000', 'put',
                        {proxy: put_proxy});
                    assert_has(res, {data: res_proxy});
                }));
                it('conflict', etask._fn(function*(_this){
                    let proxies = [{port: 24000}, {port: 24001}];
                    app = yield app_with_proxies(proxies, {});
                    let res = yield api_json('api/proxies/24001',
                        {method: 'put', body: {proxy: {port: 24000}}});
                    assert.equal(res.statusCode, 400);
                    assert_has(res.body, {errors: []}, 'proxies');
                }));
            });
            describe('delete', ()=>{
                it('normal', etask._fn(function*(_this){
                    const proxies = [{port: 24000}];
                    app = yield app_with_proxies(proxies, {});
                    const res = yield api_json('api/proxies/24000',
                        {method: 'delete'});
                    assert.equal(res.statusCode, 204);
                }));
                it('cannot delete not existing', etask._fn(function*(_this){
                    app = yield app_with_args();
                    const res = yield api_json('api/proxies/24001',
                        {method: 'delete'});
                    assert.equal(res.statusCode, 500);
                    assert.equal(res.body,
                        'Server error: this proxy does not exist');
                }));
                it('cannot delete duplicated', etask._fn(function*(_this){
                    const proxies = [{port: 24000, multiply: 2}];
                    app = yield app_with_proxies(proxies, {});
                    const res = yield api_json('api/proxies/24001',
                        {method: 'delete'});
                    assert.equal(res.statusCode, 500);
                    assert.equal(res.body,
                        'Server error: cannot delete this port');
                }));
            });
            describe('banip', ()=>{
                let t = (name, body, status_code)=>it(name, etask._fn(
                function*(_this){
                    app = yield app_with_proxies([{port: 24000}], {});
                    let res = yield api_json('api/proxies/24000/banip',
                        {method: 'post', body});
                    assert.equal(res.statusCode, status_code);
                }));
                t('no ip', {}, 400);
                t('ip', {ip: '1.1.1.1'}, 204);
                t('no ip', {ip: 'r0123456789abcdef0123456789ABCDEF'}, 204);
            });
        });
        describe('har logs', function(){
            this.timeout(6000);
            beforeEach(()=>etask(function*(){
                app = yield app_with_args(['--customer', 'mock_user',
                    '--port', '24000']);
                app.manager.loki.requests_clear();
                app.manager.proxy_ports[24000].emit('usage', {
                    timeline: null,
                    url: 'http://bbc.com',
                    username: 'lum-customer-test_user-zone-static-session-qwe',
                    request: {url: 'http://bbc.com'},
                    response: {},
                });
            }));
            it('fetches all the logs', etask._fn(function*(_this){
                const res = yield api_json(`api/logs_har`);
                assert_has(res.body.log.entries[0],
                    {request: {url: 'http://bbc.com'}});
                assert.equal(res.body.log.entries.length, 1);
            }));
            it('search by url', etask._fn(function*(_this){
                const res = yield api_json('api/logs_har?search=bbc');
                assert_has(res.body.log.entries[0],
                    {request: {url: 'http://bbc.com'}});
                assert.equal(res.body.log.entries.length, 1);
            }));
            it('search by url, no results', etask._fn(function*(_this){
                const res = yield api_json('api/logs_har?search=bbcc');
                assert.equal(res.body.log.entries.length, 0);
            }));
            it('search by session', etask._fn(function*(_this){
                const res = yield api_json('api/logs_har?search=qwe');
                assert_has(res.body.log.entries[0],
                    {request: {url: 'http://bbc.com'}});
                assert.equal(res.body.log.entries.length, 1);
            }));
            it('search only by session', etask._fn(function*(_this){
                const res = yield api_json('api/logs_har?search=test_user');
                assert.equal(res.body.log.entries.length, 0);
            }));
        });
        describe('add_wip', ()=>{
            it('forbidden when token is not set',
            etask._fn(function*(_this){
                app = yield app_with_config({config: {}});
                const res = yield api_json('api/add_wip', {
                    method: 'POST',
                    headers: {Authorization: 'aaa'},
                });
                assert.equal(res.statusMessage, 'Forbidden');
                assert.equal(res.statusCode, 403);
            }));
            it('forbidden when token is not correct',
            etask._fn(function*(_this){
                const config = {_defaults: {token_auth: 'aaa'}};
                app = yield app_with_config({config});
                const res = yield api_json('api/add_wip', {method: 'POST'});
                assert.equal(res.statusMessage, 'Forbidden');
                assert.equal(res.statusCode, 403);
            }));
            it('bad requests if no IP is passed', etask._fn(function*(_this){
                const config = {_defaults: {token_auth: 'aaa'}};
                app = yield app_with_config({config});
                const res = yield api_json('api/add_wip', {
                    method: 'POST',
                    headers: {Authorization: 'aaa'},
                });
                assert.equal(res.statusMessage, 'Bad Request');
                assert.equal(res.statusCode, 400);
            }));
            it('adds IP without a mask', etask._fn(function*(_this){
                const config = {_defaults: {token_auth: 'aaa'}};
                app = yield app_with_config({config});
                const res = yield api_json('api/add_wip', {
                    method: 'POST',
                    headers: {Authorization: 'aaa'},
                    body: {ip: '1.1.1.1'},
                });
                assert.equal(res.statusCode, 200);
                assert.equal(app.manager._defaults.whitelist_ips.length, 1);
                assert.equal(app.manager._defaults.whitelist_ips[0],
                    '1.1.1.1');
            }));
            it('adds IP with a mask', etask._fn(function*(_this){
                const config = {_defaults: {token_auth: 'aaa'}};
                app = yield app_with_config({config});
                const res = yield api_json('api/add_wip', {
                    method: 'POST',
                    headers: {Authorization: 'aaa'},
                    body: {ip: '1.1.1.1/20'},
                });
                assert.equal(res.statusCode, 200);
                assert.equal(app.manager._defaults.whitelist_ips.length, 1);
                assert.equal(app.manager._defaults.whitelist_ips[0],
                    '1.1.0.0/20');
            }));
        });
        describe('open browser with custom opts', ()=>{
            let launch_stub, open_stub;
            beforeEach(()=>{
                launch_stub = sinon.stub(puppeteer, 'launch', ()=>null);
                open_stub = sinon.stub(puppeteer, 'open_page', ()=>null);
            });
            afterEach(()=>{
                [launch_stub, open_stub].forEach(stub=>sinon.restore(stub));
            });
            const t = (name, opt, arg, expected)=>it(name, etask._fn(
            function*(){
                app = yield app_with_proxies([Object.assign({port: 24000},
                    opt)]);
                yield api_json('api/browser/24000');
                const [[, , {[arg]: target_arg}]] = open_stub.args;
                assert.deepEqual(target_arg, expected);
            }));
            t('country is defined and timezone is auto',
                {country: 'as', timezone: 'auto'}, 'timezone',
                'Pacific/Pago_Pago');
            t('country is defined and timezone is defined',
                {country: 'us', timezone: 'Asia/Tokyo'}, 'timezone',
                'Asia/Tokyo');
            t('country is defined and timezone is disabled',
                {country: 'ca'}, 'timezone', undefined);
            t('country is any and timezone is defined',
                {timezone: 'America/Sao_Paulo'}, 'timezone',
                'America/Sao_Paulo');
            t('with custom resolution', {resolution: '800x600'},
                'resolution', {width: 800, height: 600});
        });
    });
    describe('flags', ()=>{
        it('exits immediately with version on -v', etask._fn(function*(_this){
            const exec = require('child_process').execFile;
            exec('node', ['./bin/index.js', '--version'], (err, res)=>{
                this.continue();
                assert.equal(res, pkg.version+'\n');
            });
            yield this.wait();
        }));
    });
    describe('banlist propagation on proxy changes', ()=>{
        let port, to_date, new_banlist;
        beforeEach(()=>etask(function*(){
            app = yield app_with_proxies([{port: 24000}]);
            port = app.manager.proxy_ports[24000];
            const {banlist} = port;
            const now_stub = sinon.stub(Date, 'now').returns(5000);
            const ms_left = 100;
            to_date = Date.now()+ms_left;
            const new_proxy = Object.assign({}, {port: 24000}, {});
            banlist.add('1.1.1.1', ms_left);
            banlist.add('1.1.1.1', ms_left, 'lumtest.com');
            new_banlist = (yield app.manager.proxy_update({port: 24000},
                new_proxy)).banlist.cache;
            now_stub.restore();
        }));
        it('sends updated banlist instance to workers via ipc', ()=>{
            assert.equal(new_banlist.size, 2);
            assert.equal(new_banlist.get('1.1.1.1').to_date, to_date);
            const stub_worker = {on: ()=>null, send: sinon.spy()};
            port.setup_worker(stub_worker);
            const worker_send_spy = stub_worker.send;
            const serialized_banlist = Object.keys(
                worker_send_spy.args[0][0].opt.banlist);
            assert.ok(worker_send_spy.called);
            assert.equal(serialized_banlist.length, 2);
        });
        it('deletes expired banned ips using timeouts', ()=>etask(function*(){
            const timeouts_exist = [...new_banlist.values()].every(({to={}})=>
                to._destroyed===false);
            assert.ok(timeouts_exist);
            yield etask.sleep(500);
            assert.ok(!new_banlist.size);
        }));
        it('doesnt delete indefinitely banned ips', ()=>etask(function*(){
            const {banlist} = port;
            const new_proxy = Object.assign({}, {port: 24000}, {});
            banlist.clear();
            banlist.add('1.2.3.4', 0);
            banlist.add('1.2.3.4', 0, 'lumtest.com');
            const {banlist: {cache}} = yield app.manager.proxy_update(
                {port: 24000}, new_proxy);
            assert.ok(cache.size==2);
        }));
    });
    describe('whitelisting', ()=>{
        let t = (name, proxies, default_calls, wh, cli, www_whitelist)=>
        it(name, etask._fn(function*(_this){
            _this.timeout(6000);
            const port = proxies[0].port;
            app = yield app_with_proxies(proxies, cli);
            app.manager.set_www_whitelist_ips(www_whitelist||[]);
            for (const c of default_calls)
                app.manager.set_whitelist_ips(c);
            const {whitelist_ips} = app.manager.proxy_ports[port].opt;
            assert.deepEqual(whitelist_ips, wh);
            const res = yield make_user_req();
            const whitelists = res.body.response.headers.find(
                h=>h.name=='x-lpm-whitelist');
            assert.ok(!!whitelists);
            assert.equal(whitelists.value, wh.join(' '));
        }));
        const p = [{port: 24000}];
        const p_w = [{port: 24000, whitelist_ips: ['1.1.1.1']}];
        const p_wi = [{port: 24000, whitelist_ips: ['1.1.1.1', '300/40']}];
        const w_cli = {whitelist_ips: ['1.2.3.4', '4.3.2.1']};
        t('invalid ips in config', p_wi, [], ['1.1.1.1']);
        t('sets from cmd', p, [], ['1.2.3.4', '4.3.2.1'], w_cli);
        t('sets from www', p, [], ['1.1.1.1'], null, ['1.1.1.1']);
        t('sets default', p, [['2.2.2.2']], ['2.2.2.2']);
        t('sets specific', p_w, [], ['1.1.1.1']);
        t('sets cmd and default', p, [['2.2.2.2']],
            ['1.2.3.4', '4.3.2.1', '2.2.2.2'], w_cli);
        t('sets cmd and specific', p_w, [], ['1.2.3.4', '4.3.2.1', '1.1.1.1'],
            w_cli);
        t('sets cmd and www', p, [], ['1.2.3.4', '4.3.2.1', '1.1.1.1'],
            w_cli, ['1.1.1.1']);
        t('sets default and specific', p_w, [['2.2.2.2']],
            ['2.2.2.2', '1.1.1.1']);
        t('sets default and www', p, [['2.2.2.2']],
            ['1.1.1.1', '2.2.2.2'], null, ['1.1.1.1']);
        t('sets cmd, default and specific', p_w, [['2.2.2.2']],
            ['1.2.3.4', '4.3.2.1', '2.2.2.2', '1.1.1.1'], w_cli);
        t('sets cmd, default, www and specific', p_w, [['2.2.2.2']],
            ['1.2.3.4', '4.3.2.1', '10.1.1.1', '2.2.2.2', '1.1.1.1'], w_cli,
            ['10.1.1.1']);
        t('removes IPs from proxy port config when removed in default ', p_w,
            [['2.2.2.2', '3.3.3.3'], []], ['1.2.3.4', '4.3.2.1', '1.1.1.1'],
            w_cli);
        it('updates proxy', ()=>etask(function*(){
            app = yield app_with_proxies(p);
            const whitelist_ips = ['1.1.1.1', '2.2.2.2', '3.0.0.0/8'];
            const new_proxy = Object.assign({}, p[0], {whitelist_ips});
            const opt = yield app.manager.proxy_update(p[0], new_proxy);
            assert.deepEqual(opt.whitelist_ips, whitelist_ips);
        }));
        t = (name, def, default_calls, expected)=>
        it(name, etask._fn(function*(_this){
            const proxies = [{port: 24000, whitelist_ips:
                w_cli.whitelist_ips.concat(def).concat(expected)}];
            app = yield app_with_proxies(proxies, w_cli);
            const m = app.manager;
            default_calls.forEach(d=>m.set_whitelist_ips(d));
            const s = m.config._serialize(m.proxies, m._defaults);
            const config = JSON.parse(s);
            const proxy = config.proxies[0];
            assert.equal(proxy.port, proxies[0].port);
            assert.deepEqual(proxy.whitelist_ips, expected);
        }));
        const def = ['3.3.3.3', '4.4.4.4'];
        t('should not save default/cmd whitelist', def, [def], ['7.8.9.10']);
        t('should rm from port after rm from default/cmd whitelist', def,
            [def, def.slice(1)], ['7.8.9.10']);
    });
    describe('pool ips', ()=>{
        let t = (name, proxies, expected)=>it(name, etask._fn(function*(_this){
            _this.timeout(6000);
            app = yield app_with_proxies(proxies);
            let data = {port: 24000, ip: '1.1.1.1'};
            app.manager.proxy_ports[24000].emit('add_static_ip', data);
            sinon.assert.match(app.manager.proxies,
                [sinon.match(expected)]);
        }));
        t('add ip', [{port: 24000, pool_size: 1}],
            {port: 24000, ips: ['1.1.1.1']});
        t('overloading', [{port: 24000, pool_size: 1, ips: ['2.2.2.2']}],
            {port: 24000, ips: ['2.2.2.2']});
    });
    xdescribe('migrating', ()=>{
        beforeEach(()=>{
            logger_stub.reset();
        });
        const t = (name, should_run_migrations, config={}, cli={})=>
        it(name, etask._fn(function*(_this){
            const notice = 'NOTICE: Migrating config file 1.116.387';
            const first_migration_match = sinon.match(notice);
            app = yield app_with_config({config, cli});
            if (should_run_migrations)
                sinon.assert.calledWith(logger_stub, first_migration_match);
            else
            {
                sinon.assert.neverCalledWith(logger_stub,
                    first_migration_match);
            }
        }));
        t('should run migrations if config file exists and version is old',
            true, {proxies: [{}]});
        t('should not run migrations if --no-config flag is passed',
            false, {proxies: [{}]}, {'no-config': true});
        t('should not run migrations if config does not exist', false);
        t('should not run migrations if config exists and version is new',
            false, {_defaults: {version: '1.120.0'}});
    });
    describe('stop', ()=>{
        afterEach(()=>{ app = null; });
        let t = name=>it(name, etask._fn(function*(_this){
            const proxies = [{port: 24000, multiply: 5}];
            let spies = [];
            app = yield app_with_proxies(proxies);
            Object.values(app.manager.proxy_ports).forEach(p=>{
                const spy = sinon.spy();
                const _stop_port = p.stop_port.bind(p);
                p.stop_port = ()=>{
                    spy();
                    _stop_port();
                };
                spies.push(spy);
            });
            yield app.manager.stop();
            spies.forEach(s=>sinon.assert.calledOnce(s));
        }));
        t('stop multiplied ports once');
    });
});
