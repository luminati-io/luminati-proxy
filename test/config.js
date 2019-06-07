// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, mocha:true*/
const assert = require('assert');
const {qw} = require('../util/string.js');
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
            _update: false,
        }];
        const conf_mgr = new Config(null, Manager.default);
        const s = conf_mgr.serialize(proxies, {});
        const config = JSON.parse(s);
        const proxy = config.proxies[0];
        qw`stats proxy_type zones _update www_whitelist_ips request_stats logs
        conflict version`.forEach(field=>
            assert.equal(proxy[field], undefined));
        assert.equal(proxy.port, 24000);
    });
});
