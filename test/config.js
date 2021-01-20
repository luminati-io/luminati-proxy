// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, mocha:true*/
const assert = require('assert');
const fs = require('fs');
const sinon = require('sinon');
const {qw} = require('../util/string.js');
const file = require('../util/file.js');
const etask = require('../util/etask.js');
const Manager = require('../lib/manager.js');
const Config = require('../lib/config.js');
const logger = require('../lib/logger.js');
const consts = require('../lib/consts.js');

describe('config', ()=>{
    it('proxies should not include unwanted fields', ()=>{
        const proxies = [{
            port: 24000,
            www_whitelist_ips: ['1.2.3.4'],
            proxy_type: 'persist',
            zones: [{name: 'static'}, {name: 'dynamic'}],
            conflict: false,
            version: '1.2.3.',
            request_stats: true,
            stats: false,
            customer: 'wrong_cust',
            banlist: {cache: {}},
            error: 'my_error',
        }];
        const conf_mgr = new Config(new Manager({}), Manager.default);
        const s = conf_mgr._serialize(proxies, {});
        const config = JSON.parse(s);
        const proxy = config.proxies[0];
        qw`stats proxy_type zones www_whitelist_ips request_stats logs conflict
        version customer banlist error`.forEach(field=>
            assert.equal(proxy[field], undefined));
        assert.equal(proxy.port, 24000);
    });
    it('should not save file on read only mode', ()=>{
        const conf = new Config(new Manager({read_only: true}),
            Manager.default, {filename: '.luminati.json'});
        const write_sync_stub = sinon.stub(fs, 'writeFileSync');
        const write_e_sync = sinon.stub(file, 'write_e');
        conf.save();
        conf.set_string('');
        sinon.assert.notCalled(fs.writeFileSync);
        sinon.assert.notCalled(file.write_e);
        write_sync_stub.restore();
        write_e_sync.restore();
    });
    describe('limiting specific manager _defaults in cloud zagents', ()=>{
        let notice_stub;
        before(()=>{ notice_stub = sinon.stub(logger, 'notice'); });
        after(()=>{ notice_stub.restore(); });
        const t = (name, _defaults, arg, expected)=>it(name, ()=>{
            const conf = new Config(new Manager({zagent: true}),
                Manager.default, {cloud_config: {_defaults}});
            const {_defaults: {[arg]: target}} = conf.get_proxy_configs();
            assert.equal(target, expected);
        });
        t('logs is limited to 1000', {logs: 9999}, 'logs', 1000);
        t('logs is repsected when below the limit', {logs: 500}, 'logs', 500);
        t('har_limit max is 1KB', {har_limit: 100*1024}, 'har_limit', 1024);
        t('har_limit cant be unlimited', {har_limit: 0}, 'har_limit', 1024);
    });
    describe('_prepare_proxy', ()=>{
        let warn_stub, conf_mgr;
        beforeEach(()=>{
            warn_stub = sinon.stub(logger, 'warn');
            conf_mgr = new Config(new Manager({}), Manager.default);
        });
        afterEach(()=>{
            warn_stub.restore();
            conf_mgr = null;
        });
        it('should remove rules and warn if it exists and not an array', ()=>{
            const res = conf_mgr._prepare_proxy({rules: {}});
            sinon.assert.called(logger.warn);
            assert.ok(!res.rules);
        });
        it('should not warn if rules do not exist', ()=>{
            conf_mgr._prepare_proxy({});
            sinon.assert.notCalled(logger.warn);
        });
        it('should leave rules without warning if an array', ()=>{
            const res = conf_mgr._prepare_proxy({rules: [1, 2]});
            sinon.assert.notCalled(logger.warn);
            assert.deepEqual(res.rules, [1, 2]);
        });
        it('should remove ext proxies when exceeding the limit', ()=>{
            const ext_proxies = Array(consts.MAX_EXT_PROXIES+1).fill()
                .map((_, i)=>`${++i}`);
            const res = conf_mgr._prepare_proxy({ext_proxies});
            sinon.assert.called(logger.warn);
            assert.ok(!res.ext_proxies);
        });
        it('should not touch ext proxies if within the limit', ()=>{
            const res = conf_mgr._prepare_proxy({ext_proxies: ['1.2.3.4']});
            sinon.assert.notCalled(logger.warn);
            assert.deepEqual(res.ext_proxies, ['1.2.3.4']);
        });
    });
    describe('upload', ()=>{
        it('doesnt throw on "not_authorized" err from update_conf', etask.fn(
        function*(){
            const conf = new Config(new Manager({}), Manager.default,
                {cloud_config: {_defaults: {}}});
            const serialized_conf = conf._serialize([], {});
            sinon.stub(conf.mgr, 'skip_config_sync').returns(false);
            let update_conf_stub = sinon.stub(conf.mgr.lpm_f, 'update_conf')
                .throws(new Error('not_authorized'));
            try { yield conf.upload(serialized_conf); }
            catch(e){ assert.fail('"not_authorized" Should not be thrown'); }
            update_conf_stub.restore();
            update_conf_stub = sinon.stub(conf.mgr.lpm_f, 'update_conf')
                .throws(new Error('should_be_thrown'));
            yield assert.rejects(()=>conf.upload(serialized_conf),
                /should_be_thrown/);
        }));
    });
});
