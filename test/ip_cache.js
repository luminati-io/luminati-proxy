// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, mocha:true*/
const assert = require('assert');
const sinon = require('sinon');
const {Ip_cache} = require('../lib/ip_cache.js');
const etask = require('../util/etask.js');

describe('ip_cache', ()=>{
    let ip_cache;
    beforeEach(()=>ip_cache = new Ip_cache());
    afterEach(()=>ip_cache.clear_timeouts());
    it('should serialize', ()=>{
        const now_stub = sinon.stub(Date, 'now').returns(5000);
        ip_cache.add('1.1.1.1', 1000);
        ip_cache.add('1.1.1.1', 1000, 'lumtest.com');
        const serialized = ip_cache.serialize();
        const to_date = Date.now()+1000;
        const expected = {
            '1.1.1.1': {ip: '1.1.1.1', domain: '', key: '1.1.1.1', to_date},
            '1.1.1.1|lumtest.com': {domain: 'lumtest.com', ip: '1.1.1.1',
                key: '1.1.1.1|lumtest.com', to_date},
        };
        now_stub.restore();
        assert.deepEqual(serialized, expected);
    });
    it('should deserialize', ()=>etask(function*(){
        const timeout_exists = deserialized=>
            [...deserialized.values()].every(({to})=>
                to.constructor.name=='Timeout' && to._destroyed===false);
        const now_stub = sinon.stub(Date, 'now').returns(5000);
        const to_date = Date.now()+10;
        const serialized = {
            '1.1.1.1': {ip: '1.1.1.1', domain: '', key: '1.1.1.1', to_date},
            '1.1.1.1|lumtest.com': {domain: 'lumtest.com', ip: '1.1.1.1',
                key: '1.1.1.1|lumtest.com', to_date},
        };
        const deserialized = ip_cache.deserialize(serialized);
        const expected_ips = Object.keys(serialized);
        const deserialized_ips = [...deserialized.keys()];
        assert.ok(timeout_exists(deserialized));
        assert.deepEqual(expected_ips.length, deserialized_ips.length);
        now_stub.restore();
        yield etask.sleep(50);
        assert.deepEqual(deserialized, new Map());
    }));
    it('has added entries', ()=>{
        ip_cache.add('10.0.0.1', 1000);
        ip_cache.add('10.0.0.2', 1000, 'lumtest.com');
        assert.ok(ip_cache.has('10.0.0.1'));
        assert.ok(ip_cache.has('10.0.0.2', 'lumtest.com'));
        assert.ok(!ip_cache.has('10.0.0.3'));
    });
    it('has IP/domain entry when IP entry exists', ()=>{
        ip_cache.add('10.0.0.2', 1000);
        assert.ok(ip_cache.has('10.0.0.2', 'lumtest.com'));
    });
    it('does not have IP entry when IP/domain entry exists', ()=>{
        ip_cache.add('10.0.0.2', 1000, 'lumtest.com');
        assert.ok(!ip_cache.has('10.0.0.2'));
    });
});
