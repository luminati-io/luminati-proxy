// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, mocha:true*/
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const request = require('request');
const sinon = require('sinon');
const winston = require('winston');
const nock = require('nock');
// needed to make lpm_file.js to set work dir to tmp dir
process.argv.push('--dir', os.tmpdir());
const lpm_file = require('../util/lpm_file.js');
const Manager = require('../lib/manager.js');
const Proxy_port = require('../lib/proxy_port.js');
const cities = require('../lib/cities');
sinon.stub(cities, 'ensure_data').returns(null);
const logger = require('../lib/logger.js');
const etask = require('../util/etask.js');
const zutil = require('../util/util.js');
const pkg = require('../package.json');
const qw = require('../util/string.js').qw;
const date = require('../util/date.js');
const user_agent = require('../util/user_agent.js');
const lpm_util = require('../util/lpm_util.js');
const util_lib = require('../lib/util.js');
const puppeteer = require('../lib/puppeteer.js');
const consts = require('../lib/consts.js');
const customer = 'abc';
const password = 'xyz';
const {assert_has, http_proxy} = require('./common.js');
const api_base = 'https://'+pkg.api_domain;
const {SEC} = date.ms;

describe('manager', function(){
    this.timeout(5000);
    let app, temp_files, logger_stub, sb, os_cpus_stub;
    const get_param = (args, param)=>{
        let i = args.indexOf(param)+1;
        return i ? args[i] : null;
    };
    const app_with_args = (args, opt={})=>etask(function*(){
        let manager, {only_explicit, start_manager, server_conf} = opt;
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
            if (!get_param(args, '--local_login') &&
                !get_param(args, '--no-local_login'))
            {
                args = args.concat(['--no-local_login']);
            }
            args = args.concat('--loki', '/tmp/testdb');
        }
        Manager.prototype.set_current_country = ()=>null;
        Manager.prototype.lpm_users_get = ()=>null;
        manager = new Manager(lpm_util.init_args(args));
        manager.lpm_conn.init = ()=>null;
        manager.lpm_f.init = ()=>null;
        manager.lpm_f.get_meta_conf = ()=>({
            _defaults: {
                account_id: 'c_123',
                customer_id: 'hl_123',
                customer: 'test_cust',
                password: 'pass123',
                debug: 'full',
                zone: 'static',
                zones: {
                    static: {
                        ips: 'any',
                        password: ['pass1'],
                        plan: {
                            type: 'resident',
                            city: 1,
                        },
                        perm: 'country',
                        kw: {},
                        cost: {'precommit': 1000, 'gb': 24},
                        refresh_cost: null,
                    },
                    foo: {
                        ips: 'any',
                        password: ['pass2'],
                        plan: {
                            type: 'resident',
                            city: 1,
                        },
                        perm: 'country city',
                        kw: {},
                        cost: {'precommit': 500, 'gb': 32},
                        refresh_cost: 0.5,
                    },
                },
            },
            customers: ['test_cust'],
            logins: [],
        });
        manager.lpm_f.get_server_conf = ()=>{
            manager.lpm_f.emit('server_conf', Object.assign({client: {}},
                server_conf));
        };
        manager.lpm_f.get_lb_ips = ()=>{
            manager.lpm_f.emit('lb_ips', []);
        };
        if (start_manager!==false)
            yield manager.start();
        return {manager};
    });
    let tmp_file_counter = 0;
    const temp_file_path = (ext='tmp')=>({
        path: path.join(os.tmpdir(),
            `test-${Date.now()}-${tmp_file_counter++}.${ext}`),
        done(){
            if (!this.path)
                return;
            try { fs.unlinkSync(this.path); }
            catch(e){ console.error(e.message); }
            this.path = null;
        },
    });
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
        return yield app_with_args(args, opt);
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
        const cust_crts = [lpm_file.get_file_path('lpm.crt'),
            lpm_file.get_file_path('lpm.key')];
        cust_crts.forEach(c=>{
            if (fs.existsSync(c))
                fs.unlinkSync(c);
        });
    }));
    beforeEach(()=>{
        temp_files = [];
        sb = sinon.createSandbox();
        os_cpus_stub = sb.stub(os, 'cpus').returns([1, 1]);
        nock(api_base).get('/').times(2).reply(200, {});
        nock(api_base).get('/lpm/server_conf').query(true).reply(200, {});
    });
    afterEach('after manager 2', ()=>{
        sb.verifyAndRestore();
        os_cpus_stub = null;
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
    describe('init proxy', ()=>{
        it('proxy_port is returned in the correct format', etask._fn(
        function*(_this){
            app = yield app_with_proxies([{port: 24000}]);
            const new_proxy = {port: 24001};
            const res = yield app.manager.init_proxy(new_proxy);
            assert.ok(Object.keys(res).length, 1);
            assert_has(res.proxy_port.opt, new_proxy, 'proxy_port.opt');
        }));
        it('"error" should not be saved to the proxy', etask._fn(
        function*(_this){
            app = yield app_with_proxies([{port: 24000}]);
            sinon.stub(app.manager, 'validate_proxy').returns(
                {msg: 'my_error', code: 0});
            const new_proxy = {port: 24001};
            const res = yield app.manager.init_proxy(new_proxy);
            assert_has(res, {proxy_port: new_proxy, proxy_err: 'my_error'});
            assert.ok(!res.proxy_port.error);
            app.manager.validate_proxy.restore();
        }));
    });
    describe('config load', ()=>{
        const t = (name, config, expected)=>it(name, etask._fn(
        function*(_this){
            _this.timeout(20000);
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
            const t2 = (name, config, expected)=>{
                t(name, zutil.set(config, 'cli.customer', 'testc1'), expected);
            };
            t2('from defaults', {config: {
                _defaults: {
                    zone: 'foo',
                    customer: 'testc1',
                    lpm_token: 'token',
                    sync_config: true,
                },
                proxies: [simple_proxy],
            }}, [Object.assign({zone: 'static'}, simple_proxy)]);
            t2('keep default', {config: {
                _defaults: {
                    zone: 'foo',
                    customer: 'testc1',
                    lpm_token: 'token',
                    sync_config: true,
                },
                proxies: [simple_proxy]},
            }, [Object.assign({zone: 'static'}, simple_proxy)]);
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
        it('default har_limit is 1024', etask._fn(function*(_this){
            _this.timeout(6000);
            app = yield app_with_args(['--port', '24000']);
            assert.equal(app.manager.proxy_ports[24000].opt.har_limit, 1024);
        }));
        it('applies explicit mgr argv to defaults', etask._fn(function*(_this){
            _this.timeout(15000);
            app = yield app_with_args(['--port', '24000', '--har_limit',
                '1337', '--api_domain', 'invalid_domain']);
            const {opt} = app.manager.proxy_ports[24000];
            assert.equal(app.manager._defaults.api_domain,
                pkg.api_domain_fallback);
            assert.equal(opt.har_limit, 1337);
            assert.equal(opt.api_domain, pkg.api_domain_fallback);
        }));
    });
    describe('cloud config synchronization', ()=>{
        it('argv is re-applied when applying a new cloud conf', ()=>etask(
        function*(){
            const cli = {zagent: true};
            app = yield app_with_config({cli, config: []});
            const mgr = app.manager;
            sinon.stub(mgr, 'skip_config_sync').returns(false);
            const argv_spy = sinon.spy(mgr, 'apply_argv_opts');
            const cloud_conf = {_defaults: {logs: '123'}};
            yield mgr.apply_cloud_config(cloud_conf, {force: 1});
            assert(argv_spy.calledOnce);
            assert_has(mgr._defaults,
                Object.assign({}, cloud_conf._defaults, cli));
        }));
    });
    describe('set bw_limit', ()=>{
        it('set limit', etask._fn(function*(_this){
            const cli = {zagent: true};
            app = yield app_with_proxies([{port: 24000},
                {port: 24001, multiply: 3}], cli);
            const res = yield api_json('api/bw_limit/24000', {
                method: 'put', body: {days: 90, bytes: 1000}});
            const get_res = yield api_json('api/bw_limit/24000',
                {method: 'get'});
            assert.equal(res.statusCode, 200);
            assert.deepEqual(res.body, get_res.body);
        }));
        it('zagent false', etask._fn(function*(_this){
            app = yield app_with_proxies([{port: 24000}, {port: 24001,
                multiply: 3}]);
            let res = yield api_json('api/bw_limit/24000', {
                method: 'put', body: {days: 90, bytes: 1000}});
            assert.equal(res.body, 'Not allowed to use BW limit in '
                +'Proxy Manager on premise');
            assert.equal(res.statusMessage, 'Forbidden');
            assert.equal(res.statusCode, 403);
            }));
        it('false port', etask._fn(function*(_this){
            const cli = {zagent: true};
            app = yield app_with_proxies([{port: 24000}, {port: 24001,
                    multiply: 3}], cli);
            let res = yield api_json('api/bw_limit/24', {
                method: 'put', body: {days: 90, bytes: 1000}});
            assert.equal(res.body, 'Invalid port number');
            assert.equal(res.statusMessage, 'Bad Request');
            assert.equal(res.statusCode, 400);
                }));
        it('read-only', etask._fn(function*(_this){
            const cli = {zagent: true};
            app = yield app_with_proxies([{port: 24000},
                {port: 24001, multiply: 3}], cli);
            app.manager.proxies[0].proxy_type = 'duplicate';
            let res = yield api_json('api/bw_limit/24000', {
                    method: 'put', body: {days: 90, bytes: 1000}});
            assert.equal(res.body, 'Proxy is read-only');
            assert.equal(res.statusMessage, 'Bad Request');
            assert.equal(res.statusCode, 400);
        }));
        it('too many days', etask._fn(function*(_this){
            const cli = {zagent: true};
            app = yield app_with_proxies([{port: 24000},
                {port: 24001, multiply: 3}], cli);
            const res = yield api_json('api/bw_limit/24000', {
                method: 'put', body: {days: 1e6, bytes: 1000}});
            yield api_json('api/bw_limit/24000', {method: 'get'});
            assert.equal(res.statusCode, 400);
            assert.equal(res.body, 'Invalid BW limit params, days should be '
                +'positive number no greater than 100000');
            assert.equal(res.statusMessage, 'Bad Request');
        }));
        it('too many bytes', etask._fn(function*(_this){
            const cli = {zagent: true};
            app = yield app_with_proxies([{port: 24000},
                {port: 24001, multiply: 3}], cli);
            const res = yield api_json('api/bw_limit/24000', {
                method: 'put', body: {days: 1e6, bytes: Infinity}});
            yield api_json('api/bw_limit/24000', {method: 'get'});
            assert.equal(res.statusCode, 400);
            assert.equal(res.body, 'Invalid BW limit params, bytes should be '
                +'positive number no greater than '+Number.MAX_SAFE_INTEGER);
            assert.equal(res.statusMessage, 'Bad Request');
        }));
        it('threshold', etask._fn(function*(_this){
            const cli = {zagent: true};
            const port = 24000;
            app = yield app_with_proxies([{port}], cli);
            const error_msg = 'Invalid BW limit params, th_webhook_value '
                +'should be a number between 0 and 99';
            const t = (th_webhook_value, is_correct)=>etask(function*(){
                const res = yield api_json('api/bw_limit/'+port, {
                    method: 'put', body: {bytes: 10000, days: 10,
                        th_webhook_value}});
                if (is_correct)
                    assert.equal(res.statusCode, 200);
                else
                {
                    assert.equal(res.statusCode, 400);
                    assert.equal(res.body, error_msg);
                    assert.equal(res.statusMessage, 'Bad Request');
                }
            });
            t(-1, false);
            t(0, false);
            t(100, false);
            t(10000, false);
            t(null, false);
            t(1, true);
            t(99, true);
            t('', true);
        }));
        it('invalid use_webhook_limit value', etask._fn(function*(_this){
            const cli = {zagent: true};
            const port = 24000;
            app = yield app_with_proxies([{port}], cli);
            for (const use_limit_webhook of [0, null, 1])
            {
                const res = yield api_json('api/bw_limit/'+port, {
                    method: 'put', body: {bytes: 10000, days: 10,
                        use_limit_webhook}});
                assert.equal(res.statusCode, 400);
                assert.equal(res.body, 'Invalid BW limit params, '
                    +'use_limit_webhook should be true or false');
                assert.equal(res.statusMessage, 'Bad Request');
            }
        }));
    });
    describe('bw_limit', ()=>{
        let config_save_spy;
        beforeEach(()=>etask(function*(){
            app = yield app_with_proxies([{port: 24000}, {port: 24001,
                multiply: 3}]);
            config_save_spy = sb.spy(app.manager.config, 'save');
        }));
        it('missing limits', etask._fn(function*(_this){
            yield app.manager.apply_bw_limits();
            assert.equal(app.manager.proxies[0].bw_limit, undefined);
            assert.equal(app.manager.proxies[1].bw_limit, undefined);
            sinon.assert.notCalled(config_save_spy);
        }));
        it('wrong limits type', etask._fn(function*(_this){
            yield app.manager.apply_bw_limits({test: 1});
            assert.equal(app.manager.proxies[0].bw_limit, undefined);
            assert.equal(app.manager.proxies[1].bw_limit, undefined);
            sinon.assert.notCalled(config_save_spy);
        }));
        it('wrong port', etask._fn(function*(_this){
            yield app.manager.apply_bw_limits([{port: 24010}]);
            assert.equal(app.manager.proxies[0].bw_limit, undefined);
            assert.equal(app.manager.proxies[1].bw_limit, undefined);
            sinon.assert.notCalled(config_save_spy);
        }));
        it('set expires', etask._fn(function*(_this){
            let expires_2400 = {24000: '2021-04-22T15:06:14.691Z'};
            let expires_2401 = {24001: '2021-04-22T15:07:14.691Z'};
            let ts = '2021-04-22T15:06:14.692Z';
            yield app.manager.apply_bw_limits([{port: 24000,
                expires: expires_2400, ts}]);
            assert.deepEqual(app.manager.proxies[0].bw_limit, {
                expires: expires_2400, ts});
            assert.equal(app.manager.proxies[1].bw_limit, undefined);
            assert.equal(app.manager.proxy_ports[24001].opt.bw_limit,
                undefined);
            assert.equal(app.manager.proxy_ports[24002].opt.bw_limit,
                undefined);
            assert.equal(app.manager.proxy_ports[24003].opt.bw_limit,
                undefined);
            yield app.manager.apply_bw_limits([{port: 24001,
                expires: expires_2401, ts}]);
            assert.deepEqual(app.manager.proxies[0].bw_limit, {
                expires: expires_2400, ts});
            assert.deepEqual(app.manager.proxies[1].bw_limit, {
                expires: expires_2401, ts});
            assert.deepEqual(app.manager.proxy_ports[24001].opt.bw_limit, {
                expires: expires_2401, ts});
            assert.deepEqual(app.manager.proxy_ports[24002].opt.bw_limit, {
                expires: expires_2401, ts});
            assert.deepEqual(app.manager.proxy_ports[24003].opt.bw_limit, {
                expires: expires_2401, ts});
            sinon.assert.calledTwice(config_save_spy);
        }));
    });
    describe('report_bug', ()=>{
        // XXX krzysztof: get rid of this
        before(()=>{
            const console_t = logger.transports.find(
                t=>t instanceof winston.transports.Console);
            console_t.silent = true;
        });
        // can't rm current log file because transports rely on it
        beforeEach(()=>fs.truncateSync(logger.lpm_filename, 0));
        it('should send logs, har and config', etask._fn(function*(_this){
            _this.timeout(6000);
            app = yield app_with_config({config: {}, cli: {log: 'notice'}});
            const desc = 'bug description', email = 'test@brightdata.com';
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
    describe('api', function(){
        this.timeout(6000);
        it('ssl', etask._fn(function*(_this){
            const cust_crt = lpm_file.get_file_path('lpm.crt');
            const sys_crt = path.join(__dirname, '../bin/ca.crt');
            const crt_path = fs.existsSync(cust_crt) ? cust_crt : sys_crt;
            app = yield app_with_args();
            const res = yield api('ssl');
            assert_has(res.headers, {
                'content-type': 'application/x-x509-ca-cert',
                'content-disposition': 'filename=luminati.crt',
            }, 'headers mismatch');
            assert.equal(res.body, fs.readFileSync(crt_path),
                'certificate mismatch');
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
                    const proxies = [{port: 24024}];
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
                    const res_proxy = Object.assign({
                        customer: 'test_cust',
                        password: 'pass1',
                    }, sample_proxy);
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
                it('external over the limit in cloud', etask._fn(
                function*(_this){
                    const cli = {zagent: true};
                    app = yield app_with_proxies([{port: 24000}], cli);
                    const ext_proxies = Array(consts.MAX_EXT_PROXIES+1).fill()
                        .map((_, i)=>`${++i}`);
                    const res = yield api_json('api/proxies', {method: 'post',
                        body: {proxy: {port: 24001, ext_proxies}}});
                    assert.equal(res.statusCode, 400);
                    assert.ok(!!res.body.errors.length);
                }));
                it('external over the limit on premice', etask._fn(
                function*(_this){
                    app = yield app_with_proxies([{port: 24000}]);
                    const ext_proxies = Array(consts.MAX_EXT_PROXIES+1).fill()
                        .map((_, i)=>`${++i}`);
                    const res = yield api_json('api/proxies', {method: 'post',
                        body: {proxy: {port: 24001, ext_proxies}}});
                    assert.equal(res.statusCode, 200);
                    assert.ok(!res.body.errors);
                    assert.ok(!!res.body.data.ext_proxies.length);
                    assert.deepEqual(res.body.data.ext_proxies, ext_proxies);
                }));
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
                    const res_proxy = Object.assign({}, {
                        customer: 'test_cust',
                        zone: 'static',
                        password: 'pass1',
                    }, put_proxy);
                    app = yield app_with_proxies(proxies, {});
                    const res = yield json('api/proxies/24000', 'put',
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
                it('updates password recreating', etask._fn(function*(_this){
                    const proxies = [{port: 24000}];
                    app = yield app_with_proxies(proxies, {});
                    const body = {proxy: {port: 24001, zone: 'foo'}};
                    const res = yield api_json('api/proxies/24000',
                        {method: 'put', body});
                    assert.equal(res.body.data.password, 'pass2');
                }));
                it('updates password in place', etask._fn(function*(_this){
                    const proxies = [{port: 24000}];
                    app = yield app_with_proxies(proxies, {});
                    const lpm_f_stub = sinon.stub(app.manager.lpm_f,
                        'proxy_update_in_place').returns(true);
                    app.manager._defaults.sync_config = true;
                    const body = {proxy: {zone: 'foo'}};
                    const res = yield api_json('api/proxies/24000',
                        {method: 'put', body});
                    assert.equal(res.body.data.password, 'pass2');
                    sinon.assert.calledOnce(lpm_f_stub);
                }));
                it('updates password no zone passed',
                etask._fn(function*(_this){
                    const proxies = [{port: 24000, zone: 'foo'}];
                    app = yield app_with_proxies(proxies, {});
                    const lpm_f_stub = sinon.stub(app.manager.lpm_f,
                        'proxy_update_in_place').returns(true);
                    app.manager._defaults.sync_config = true;
                    const body = {proxy: {ssl: true}};
                    const res = yield api_json('api/proxies/24000',
                        {method: 'put', body});
                    assert.equal(res.body.data.password, 'pass2');
                    sinon.assert.calledOnce(lpm_f_stub);
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
            describe('duplicate port', ()=>{
                it('works after updating port', etask._fn(function*(_this){
                    app = yield app_with_proxies([{port: 24000}], {});
                    const put_proxy = {port: 24001};
                    yield json('api/proxies/24000', 'put', {proxy: put_proxy});
                    const res = yield api_json('api/proxy_dup',
                        {method: 'post', body: {port: 24001}});
                    assert.equal(res.statusCode, 200);
                }));
                it('does not hang on errors', etask._fn(function*(_this){
                    app = yield app_with_proxies([{port: 24000}], {});
                    const stub = sinon.stub(app.manager, 'create_new_proxy')
                        .callsFake(()=>{
                            throw new Error('error creating proxy');
                        });
                    const res = yield api_json('api/proxy_dup',
                        {method: 'post', body: {port: 24000}});
                    assert.equal(res.statusCode, 500);
                    assert.equal(res.body,
                        'Server error: error creating proxy');
                    stub.restore();
                }));
            });
            describe('refresh_sessions', ()=>{
                const t = (name, opt, eq)=>it(name, etask.fn(function*(){
                    const proxy = Object.assign({port: 24000}, opt);
                    app = yield app_with_proxies([proxy], {});
                    const refresh_sessions_res =
                        yield api_json(`api/refresh_sessions/${proxy.port}`,
                        {method: 'post'});
                    assert.equal(refresh_sessions_res.statusCode, eq.code);
                    assert.deepEqual(refresh_sessions_res.body, eq.body);
                }));
                t('returns session_id when not rotating', null,
                    {code: 200, body: {session_id: '24000_1'}});
                t('does not return session_id when rotating',
                    {rotate_session: true}, {code: 204});
            });
        });
        // XXX arkadii: remove after migration
        const har_log_tests = function(_this, prefix){
            _this.timeout(6000);
            beforeEach(()=>etask(function*(){
                app = yield app_with_args(['--customer', 'mock_user',
                    '--port', '24000']);
                app.manager.loki.requests_clear();
                app.manager.proxy_ports[24000].emit('usage', {
                    timeline: null,
                    url: 'http://bbc.com',
                    username: prefix
                        +'-customer-test_user-zone-static-session-qwe',
                    request: {url: 'http://bbc.com'},
                    response: {},
                });
            }));
            it('fetches all the logs', etask._fn(function*(){
                const res = yield api_json(`api/logs_har`);
                assert_has(res.body.log.entries[0],
                    {request: {url: 'http://bbc.com'}});
                assert.equal(res.body.log.entries.length, 1);
            }));
            it('search by url', etask._fn(function*(){
                const res = yield api_json('api/logs_har?search=bbc');
                assert_has(res.body.log.entries[0],
                    {request: {url: 'http://bbc.com'}});
                assert.equal(res.body.log.entries.length, 1);
            }));
            it('search by url, no results', etask._fn(function*(){
                const res = yield api_json('api/logs_har?search=bbcc');
                assert.equal(res.body.log.entries.length, 0);
            }));
            it('search by session', etask._fn(function*(){
                const res = yield api_json('api/logs_har?search=qwe');
                assert_has(res.body.log.entries[0],
                    {request: {url: 'http://bbc.com'}});
                assert.equal(res.body.log.entries.length, 1);
            }));
            it('search only by session', etask._fn(function*(){
                const res = yield api_json('api/logs_har?search=test_user');
                assert.equal(res.body.log.entries.length, 0);
            }));
        };
        describe('har logs[brd]', etask._fn(function*(_this){
            yield har_log_tests(_this, 'brd');
        }));
        describe('har logs[lum]', etask._fn(function*(_this){
            yield har_log_tests(_this, 'lum');
        }));
        describe('wip', ()=>{
            it('forbidden when token is not set',
            etask._fn(function*(_this){
                app = yield app_with_config({config: {}});
                const res = yield api_json('api/wip', {
                    method: 'PUT',
                    headers: {Authorization: 'aaa'},
                });
                assert.equal(res.statusMessage, 'Forbidden');
                assert.equal(res.statusCode, 403);
            }));
            it('forbidden when token is not correct',
            etask._fn(function*(_this){
                const config = {_defaults: {token_auth: 'aaa'}};
                app = yield app_with_config({config});
                const res = yield api_json('api/wip', {method: 'PUT'});
                assert.equal(res.statusMessage, 'Forbidden');
                assert.equal(res.statusCode, 403);
            }));
            it('bad requests if no IP is passed', etask._fn(function*(_this){
                const config = {_defaults: {token_auth: 'aaa'}};
                app = yield app_with_config({config});
                const res = yield api_json('api/wip', {
                    method: 'PUT',
                    headers: {Authorization: 'aaa'},
                });
                assert.equal(res.statusMessage, 'Bad Request');
                assert.equal(res.statusCode, 400);
            }));
            it('adds IP without a mask', etask._fn(function*(_this){
                const config = {_defaults: {token_auth: 'aaa'}};
                app = yield app_with_config({config});
                const res = yield api_json('api/wip', {
                    method: 'PUT',
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
                const res = yield api_json('api/wip', {
                    method: 'PUT',
                    headers: {Authorization: 'aaa'},
                    body: {ip: '1.1.1.1/20'},
                });
                assert.equal(res.statusCode, 200);
                assert.equal(app.manager._defaults.whitelist_ips.length, 1);
                assert.equal(app.manager._defaults.whitelist_ips[0],
                    '1.1.0.0/20');
            }));
            it('not found on remove if IP is not whitelsited',
            etask._fn(function*(_this){
                const config = {_defaults: {token_auth: 'aaa',
                    whitelist_ips: ['1.1.1.2']}};
                app = yield app_with_config({config});
                const res = yield api_json('api/wip', {
                    method: 'DELETE',
                    headers: {Authorization: 'aaa'},
                    body: {ip: '1.1.1.1'},
                });
                assert.equal(res.statusMessage, 'Not Found');
                assert.equal(res.statusCode, 404);
            }));
            it('removes IP without a mask', etask._fn(function*(_this){
                const config = {_defaults: {token_auth: 'aaa',
                    whitelist_ips: ['1.1.1.1', '1.1.1.2']}};
                app = yield app_with_config({config});
                const res = yield api_json('api/wip', {
                    method: 'DELETE',
                    headers: {Authorization: 'aaa'},
                    body: {ip: '1.1.1.1'},
                });
                assert.equal(res.statusCode, 200);
                assert.equal(app.manager._defaults.whitelist_ips.length, 1);
            }));
            it('removes IP with a mask', etask._fn(function*(_this){
                const config = {_defaults: {token_auth: 'aaa',
                    whitelist_ips: ['1.1.0.0/20', '1.2.0.0/20']}};
                app = yield app_with_config({config});
                const res = yield api_json('api/wip', {
                    method: 'DELETE',
                    headers: {Authorization: 'aaa'},
                    body: {ip: '1.1.1.1/20'},
                });
                assert.equal(res.statusCode, 200);
                assert.equal(app.manager._defaults.whitelist_ips.length, 1);
            }));
        });
        describe('add_wip', ()=>{
            it('adds deprecation header',
            etask._fn(function*(_this){
                const config = {_defaults: {token_auth: 'aaa'}};
                app = yield app_with_config({config});
                const res = yield api_json('api/add_wip', {
                    method: 'POST',
                    headers: {Authorization: 'aaa'},
                    body: {ip: '1.1.1.1'},
                });
                assert.equal(res.statusCode, 200);
                assert(res.headers.deprecation);
            }));
        });
        describe('open browser with custom opts', ()=>{
            let launch_stub, open_stub;
            beforeEach(()=>{
                launch_stub = sinon.stub(puppeteer, 'launch').returns(null);
                open_stub = sinon.stub(puppeteer, 'open_page').returns(null);
            });
            afterEach(()=>{
                [launch_stub, open_stub].forEach(stub=>stub.restore());
            });
            const t = (name, opt, arg, expected)=>it(name, etask._fn(
            function*(_this){
                _this.timeout(6000);
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
            t('webrtc is enabled', {webrtc: true}, 'webrtc', true);
        });
    });
    describe('proxy_update', ()=>{
        it('return value format is consistent', etask._fn(function*(_this){
            const [p1, p2] = [{port: 24000}, {port: 24001}];
            app = yield app_with_proxies([p1, p2]);
            const lpm_f_stub_update = sinon.stub(app.manager.lpm_f,
                'proxy_update_in_place').returns(true);
            const lpm_f_stub_recreate = sinon.stub(app.manager.lpm_f,
                'proxy_remove_and_create').returns(true);
            app.manager._defaults.sync_config = true;
            const recreate = yield app.manager.proxy_update(p1, {port: 24500});
            const in_place = yield app.manager.proxy_update(p2,
                {port: 24001, ssl: true});
            [recreate, in_place].forEach(res=>{
                assert.equal(Object.keys(res).length, 1);
                assert.ok(res.proxy_port);
            });
            sinon.assert.calledOnce(lpm_f_stub_update);
            sinon.assert.calledOnce(lpm_f_stub_recreate);
        }));
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
            const now_stub = sinon.stub(Date, 'now').returns(5000);
            app = yield app_with_proxies([{port: 24000}]);
            const lpm_f_stub = sinon.stub(app.manager.lpm_f,
                'proxy_update_in_place').returns(true);
            app.manager._defaults.sync_config = true;
            port = app.manager.proxy_ports[24000];
            const {banlist} = port;
            const ms_left = 100;
            to_date = Date.now()+ms_left;
            const new_proxy = Object.assign({}, {port: 24000}, {});
            banlist.add('1.1.1.1', ms_left);
            banlist.add('1.1.1.1', ms_left, 'lumtest.com');
            const update_spy = sinon.spy();
            port.on('updated', update_spy);
            yield app.manager.proxy_update({port: 24000}, new_proxy);
            sinon.assert.calledOnce(update_spy);
            new_banlist = app.manager.proxy_ports[24000].banlist.cache;
            now_stub.restore();
            sinon.assert.calledOnce(lpm_f_stub);
        }));
        it('sends updated banlist instance to workers via ipc', ()=>{
            assert.equal(new_banlist.size, 2);
            assert.equal(new_banlist.get('1.1.1.1').to_date, to_date);
            const stub_worker = {on: ()=>null, send: sinon.spy(),
                isConnected: ()=>true};
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
            let {banlist} = port;
            banlist.clear();
            banlist.add('1.2.3.4', 0);
            banlist.add('1.2.3.4', 0, 'lumtest.com');
            const new_proxy = Object.assign({port: 24000});
            yield app.manager.proxy_update({port: 24000}, new_proxy);
            ({banlist} = app.manager.proxy_ports[24000]);
            assert.ok(banlist.cache.size==2);
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
            const lpm_f_stub = sinon.stub(app.manager.lpm_f,
                'proxy_update_in_place').returns(true);
            app.manager._defaults.sync_config = true;
            const whitelist_ips = ['1.1.1.1', '2.2.2.2', '3.0.0.0/8'];
            const new_proxy = Object.assign({}, p[0], {whitelist_ips});
            const {proxy_port} = yield app.manager.proxy_update(p[0],
                new_proxy);
            assert.deepEqual(proxy_port.whitelist_ips, whitelist_ips);
            sinon.assert.calledOnce(lpm_f_stub);
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
    describe('refresh_ip', ()=>{
        it('refreshes ip & sessions and updates proxy port', etask._fn(
        function*(_this){
            const alloc_ip = '1.1.1.1';
            const alloc_inet_addr = 16843009;
            const new_ip = '2.2.2.2';
            const proxy = {port: 24000, zone: 'static', ips: [alloc_ip]};
            app = yield app_with_proxies([proxy]);
            const mgr = app.manager;
            sb.stub(mgr, 'request_allocated_ips').returns({ips: [alloc_ip]});
            const refresh_ips = sb.stub(mgr, 'refresh_ips')
                .returns({ips: [{ip: new_ip}]});
            const proxy_port = mgr.proxy_ports[proxy.port];
            const proxy_conf = mgr.proxies.find(p=>p.port==proxy.port);
            const refresh_sessions = sb.spy(proxy_port, 'refresh_sessions');
            const expected_refresh_args = [proxy.zone, {ips: alloc_inet_addr}];
            yield mgr.refresh_ip(alloc_ip, null, proxy.port);
            assert.ok(refresh_ips.calledWithExactly(...expected_refresh_args));
            assert.ok(refresh_sessions.called);
            assert.deepEqual(proxy_port.opt.ips, [new_ip]);
            assert.deepEqual(proxy_conf.ips, [new_ip]);
        }));
    });
    describe('lpm_f', function(){
        this.timeout(6*SEC);
        const server_meta_conf = {config: {_defaults: {
            customer: 'abc',
            account_id: 'abc',
            customer_id: 'hl_abc',
        }}};
        const get_local_conf = ts=>({
            _defaults: {
                lpm_token: '123|test_cust',
                customer: 'test_cust',
                sync_config: true,
            },
            proxies: [{port: 24000}],
            ts,
        });
        const get_server_conf = ts=>({
            _defaults: {log: 'debug'},
            proxies: [{port: 25000}, {port: 25001}],
            ts,
        });
        const spy_obj_methods = (obj, ...methods)=>
            Object.fromEntries(methods.map(m=>[m, sb.spy(obj, m)]));
        describe('config on server is newer', ()=>{
            let local_conf, server_conf, acc_opt = {force: false};
            beforeEach(()=>{
                local_conf = get_local_conf(date.add(date(), {day: -1}));
                server_conf = get_server_conf(date());
            });
            afterEach(()=>local_conf = server_conf = null);
            it('starts with valid lpm_token and customer', etask.fn(
            function*(){
                app = yield app_with_config({config: local_conf,
                    start_manager: false});
                const mgr = app.manager;
                sb.stub(mgr.lpm_f, 'init');
                sb.stub(mgr.lpm_f, 'get_conf').returns(server_conf);
                const mgr_methods = qw`logged_update apply_cloud_config perr`;
                const mgr_spies = spy_obj_methods(mgr, ...mgr_methods);
                const {logged_update, apply_cloud_config, perr} = mgr_spies;
                yield mgr.start();
                sinon.assert.calledWith(perr, 'start_success');
                sinon.assert.calledWithExactly(apply_cloud_config,
                    server_conf, acc_opt);
                const logged_in = logged_update.returnValues[0].retval;
                assert.strictEqual(logged_in, true);
                assert.equal(+mgr.config_ts, +server_conf.ts);
                assert_has(mgr, {
                    _defaults: server_conf._defaults,
                    proxies: server_conf.proxies,
                }, 'app.manager');
            }));
            it('starts with invalid lpm_token', etask.fn(function*(){
                app = yield app_with_config({config: local_conf,
                    start_manager: false});
                const mgr = app.manager;
                sb.stub(mgr.lpm_f, 'init');
                sb.stub(mgr.lpm_f, 'get_conf').returns(false);
                const get_meta_conf = sb.stub(mgr.lpm_f, 'get_meta_conf');
                get_meta_conf.onCall(0).throws(new Error('not_authorized'));
                get_meta_conf.onCall(1).returns(server_meta_conf);
                const mgr_methods = qw`apply_cloud_config logged_update`;
                const {apply_cloud_config, logged_update} =
                    spy_obj_methods(mgr, ...mgr_methods);
                yield mgr.start();
                const logged_in = logged_update.returnValues[0].retval;
                assert.strictEqual(logged_in, false);
                assert.strictEqual(mgr._defaults.lpm_token, '123|test_cust');
                sinon.assert.notCalled(apply_cloud_config);
                assert_has(mgr, {
                    _defaults: zutil.omit(local_conf._defaults, 'lpm_token'),
                    proxies: local_conf.proxies,
                }, 'app.manager');
                sb.stub(mgr.lpm_f, 'login').returns(server_conf);
                sb.stub(mgr, 'login_user').returns('123|abc');
                yield api_json('api/creds_user', {method: 'post', body: {
                    customer: 'abc',
                    token: '123',
                }});
                sinon.assert.calledWithExactly(apply_cloud_config,
                    server_conf);
                const logged_in_2 = logged_update.returnValues[1].retval;
                assert.strictEqual(logged_in_2, true);
                assert_has(mgr, {
                    _defaults: server_conf._defaults,
                    proxies: server_conf.proxies,
                }, 'app.manager');
            }));
        });
        describe('local config is newer', ()=>{
            let local_conf, server_conf, acc_opt = {force: false};
            beforeEach(()=>{
                local_conf = get_local_conf(date());
                server_conf = get_server_conf(date.add(date(), {day: -1}));
            });
            afterEach(()=>local_conf = server_conf = null);
            it('starts with valid lpm_token and customer', etask.fn(
            function*(){
                app = yield app_with_config({config: local_conf,
                    start_manager: false});
                const mgr = app.manager;
                sb.stub(mgr.lpm_f, 'init');
                sb.stub(mgr.lpm_f, 'get_conf').returns(server_conf);
                const mgr_methods = qw`logged_update apply_cloud_config perr`;
                const mgr_spies = spy_obj_methods(mgr, ...mgr_methods);
                const {logged_update, apply_cloud_config, perr} = mgr_spies;
                yield mgr.start();
                sinon.assert.calledWith(perr, 'start_success');
                sinon.assert.calledWithExactly(apply_cloud_config,
                    server_conf, acc_opt);
                const logged_in = logged_update.returnValues[0].retval;
                assert.strictEqual(logged_in, true);
                assert_has(mgr, {
                    _defaults: local_conf._defaults,
                    proxies: local_conf.proxies,
                }, 'app.manager');
            }));
            it('synchronizes configs with the server after local change',
            etask.fn(function*(){
                app = yield app_with_config({config: local_conf,
                    start_manager: false});
                const mgr = app.manager;
                sb.stub(mgr.lpm_f, 'update_settings').returns(true);
                sb.stub(mgr.lpm_f, 'init');
                sb.stub(mgr.lpm_f, 'get_conf').returns(server_conf);
                yield mgr.start();
                assert.deepEqual(date(mgr.config_ts), date(local_conf.ts));
                let local_update_ts;
                sb.stub(mgr.lpm_f, 'update_conf').callsFake(
                ({_defaults, ts})=>{
                    local_update_ts = date(ts);
                    zutil.extend_deep(server_conf, {_defaults, ts});
                });
                yield json('api/settings', 'put', {har_limit: 123});
                const api_settings_pretty = yield json('api/settings?pretty');
                assert.ok(api_settings_pretty);
                assert.deepEqual(local_update_ts, mgr.config_ts);
                let new_server_ts;
                zutil.extend_deep(server_conf, {
                    _defaults: {logs: 456},
                    ts: new_server_ts = date.add(date(server_conf.ts), {s: 1}),
                });
                yield mgr.apply_cloud_config(server_conf);
                const expected_defaults = {har_limit: 123, logs: 456};
                assert_has(mgr, {_defaults: expected_defaults}, 'app.manager');
                assert.deepEqual(mgr.config_ts, new_server_ts);
            }));
            it('starts with invalid lpm_token', etask.fn(function*(){
                app = yield app_with_config({config: local_conf,
                    start_manager: false});
                const mgr = app.manager;
                sb.stub(mgr.lpm_f, 'init');
                sb.stub(mgr.lpm_f, 'get_conf').returns(false);
                const get_meta_conf = sb.stub(mgr.lpm_f, 'get_meta_conf');
                get_meta_conf.onCall(0).throws(new Error('not_authorized'));
                get_meta_conf.onCall(1).returns(server_meta_conf);
                const mgr_methods = qw`apply_cloud_config logged_update`;
                const {apply_cloud_config, logged_update} =
                    spy_obj_methods(mgr, ...mgr_methods);
                yield mgr.start();
                const logged_in = mgr.logged_update.returnValues[0].retval;
                assert.strictEqual(logged_in, false);
                assert.strictEqual(mgr._defaults.lpm_token, '123|test_cust');
                sinon.assert.notCalled(apply_cloud_config);
                assert_has(mgr, {
                    _defaults: zutil.omit(local_conf._defaults, 'lpm_token'),
                    proxies: local_conf.proxies,
                }, 'app.manager');
                sb.stub(mgr.lpm_f, 'login').returns(server_conf);
                sb.stub(mgr, 'login_user').returns('123|test_cust');
                yield api_json('api/creds_user', {method: 'post', body: {
                    customer: 'abc',
                    token: '123',
                }});
                sinon.assert.calledWithExactly(mgr.apply_cloud_config,
                    server_conf);
                const logged_in_2 = logged_update.returnValues[1].retval;
                assert.strictEqual(logged_in_2, true);
                assert_has(mgr, {
                    _defaults: local_conf._defaults,
                    proxies: local_conf.proxies,
                }, 'app.manager');
            }));
        });
    });
    describe('multiple super proxy ports', ()=>{
        const PORT = 24000;
        const get_mgr = (server_conf={})=>etask(function*(){
            const super_proxy_ports = server_conf.cloud &&
                server_conf.cloud.proxy_ports &&
                Object.keys(server_conf.cloud.proxy_ports).map(Number)||[];
            const proxy_port_start_spy = sb.spy(Proxy_port.prototype, 'start');
            const config = {
                _defaults: {log: 'info'},
                proxies: [{port: PORT}],
                ts: date(),
            };
            app = yield app_with_config({config, server_conf});
            const mgr = app.manager;
            sb.stub(mgr.lpm_f, 'init');
            sb.stub(mgr.lpm_f, 'get_conf').returns(config);
            assert.deepEqual(
                proxy_port_start_spy.firstCall.thisValue.opt.super_proxy_ports,
                super_proxy_ports);
            return mgr;
        });
        const all_super_proxies = [20001, 20002, 20003];
        const server_conf = {cloud: {proxy_ports: {20001: ['c_123'],
            20002: ['c_123']}}};
        let proxies = [];
        before(etask._fn(function*before(){
            for (const port of all_super_proxies)
                proxies.push(yield http_proxy(port));
        }));
        after(etask._fn(function*after(){
            for (const proxy of proxies)
                yield proxy.stop();
        }));
        beforeEach(()=>{
            os_cpus_stub.returns([1]);
        });
        const assert_round_robin = (mgr, ports, index=0)=>etask(function*(){
            mgr.loki.requests_clear();
            const expected_ports = [];
            for (let i = index; i < ports.length*2+index; i++)
            {
                yield make_user_req();
                expected_ports.push(ports[i%ports.length]);
            }
            const res = yield api_json('api/logs_har');
            const actual_ports = res.body.log.entries
                .sort((a, b)=>date(a.startedDateTime)-date(b.startedDateTime))
                .map(e=>+e.serverIPAddress.split(':')[1]);
            assert.deepEqual(expected_ports, actual_ports, 'round robin ports '
                +'are incorrect.\nExpected: '+expected_ports+'\nActual: '
                +actual_ports+'\n');
        });
        const update_server_conf = (mgr, new_server_conf)=>etask(function*(){
            mgr.lpm_f.get_server_conf = ()=>{
                mgr.lpm_f.emit('server_conf', Object.assign({client: {}},
                    new_server_conf));
            };
            yield mgr.lpm_f.get_server_conf();
        });
        it('default', ()=>etask(function*(){
            const mgr = yield get_mgr(server_conf);
            yield assert_round_robin(mgr, [20001, 20002]);
        }));
        it('start without ports then add them', ()=>etask(function*(){
            const mgr = yield get_mgr();
            yield assert_round_robin(mgr, [PORT]);
            yield update_server_conf(mgr, server_conf);
            assert.deepEqual(mgr.proxy_ports[PORT].opt.super_proxy_ports,
                [20001, 20002]);
            yield assert_round_robin(mgr, [20001, 20002]);
        }));
        it('start with ports then delete them', ()=>etask(function*(){
            const mgr = yield get_mgr(server_conf);
            yield assert_round_robin(mgr, [20001, 20002]);
            yield update_server_conf(mgr, undefined);
            assert.deepEqual(mgr.proxy_ports[PORT].opt.super_proxy_ports,
                []);
            yield assert_round_robin(mgr, [PORT]);
        }));
        it('start with ports then change server_conf', ()=>etask(function*(){
        const mgr = yield get_mgr(server_conf);
            yield assert_round_robin(mgr, [20001, 20002]);
            // Set new config and update
            const new_server_conf = {cloud: {proxy_ports: {20001: ['c_123'],
                20002: ['c_123'], 20003: ['c_123']}}};
            yield update_server_conf(mgr, new_server_conf);
            assert.deepEqual(mgr.proxy_ports[PORT].opt.super_proxy_ports,
                [20001, 20002, 20003]);
            yield assert_round_robin(mgr, [20001, 20002, 20003], 2);
        }));
    });
    it('get_super_proxy_ports', ()=>{
        const account_id = 'c_123', customer_id = 'hl_123';
        const mgr = {_defaults: {account_id, customer_id}};
        const func = Manager.prototype.get_super_proxy_ports.bind(mgr);
        const t = (server_conf, expected)=>{
            assert.deepEqual(func(server_conf), expected);
        };
        t(undefined, []);
        t({}, []);
        t({cloud: {}}, []);
        t({cloud: {proxy_ports: {}}}, []);
        t({cloud: {proxy_ports: {20001: ['cust1'], 20002: ['cust2']}}},
            []);
        t({cloud: {proxy_ports: {20001: ['cust1', account_id], 20002: [],
            20003: [account_id]}}}, [20001, 20003]);
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
