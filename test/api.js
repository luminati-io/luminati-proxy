// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, mocha:true*/
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const sinon = require('sinon');
const nock = require('nock');
// needed to make lpm_file.js to set work dir to tmp dir
process.argv.push('--dir', os.tmpdir());
const lpm_file = require('../util/lpm_file.js');
const cities = require('../lib/cities');
sinon.stub(cities, 'ensure_data').returns(null);
const etask = require('../util/etask.js');
const pkg = require('../package.json');
const puppeteer = require('../lib/puppeteer.js');
const consts = require('../lib/consts.js');
const {assert_has, app_with_args, init_app_with_config, api_json, json,
    init_app_with_proxies, api} = require('./common.js');
const api_base = 'https://'+pkg.api_domain;

describe('api', function(){
    this.timeout(6000);
    let app, temp_files, sb, app_with_config, app_with_proxies;
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
        nock(api_base).get('/').times(2).reply(200, {});
        nock(api_base).get('/lpm/server_conf').query(true).reply(200, {});
        app_with_config = init_app_with_config(temp_files);
        app_with_proxies = init_app_with_proxies(app_with_config);
    });
    afterEach('after manager 2', ()=>{
        sb.verifyAndRestore();
        temp_files.forEach(f=>f.done());
    });
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
    // XXX igors: remove after migration
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
