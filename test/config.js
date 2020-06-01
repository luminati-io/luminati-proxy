// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, mocha:true*/
const assert = require('assert');
const fs = require('fs');
const sinon = require('sinon');
const {qw} = require('../util/string.js');
const file = require('../util/file.js');
const Manager = require('../lib/manager.js');
const Config = require('../lib/config.js');

describe('config', ()=>{
    it('should not include mgr fields', ()=>{
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
        }];
        const conf_mgr = new Config(new Manager({}), Manager.default);
        const s = conf_mgr._serialize(proxies, {});
        const config = JSON.parse(s);
        const proxy = config.proxies[0];
        qw`stats proxy_type zones www_whitelist_ips request_stats logs conflict
        version customer`.forEach(field=>
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
});
