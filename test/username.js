// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, mocha:true*/
const assert = require('assert');
const username = require('../lib/username.js');

describe('username', ()=>{
    it('should use password', ()=>{
        const opt = {country: 'us', password: 'pass'};
        const res = username.calculate_username(opt);
        assert.equal(res.password, 'pass');
    });
    it('should set mobile false if os and mobile are passed', ()=>{
        const opt = {country: 'us', mobile: true, os: 'win'};
        const res = username.calculate_username(opt);
        assert.equal(res.username, 'lum-country-us-mobile-false-os-win');
    });
    it('should skip mobile false if os and mobile are passed', ()=>{
        const opt = {country: 'us', mobile: false, os: 'win'};
        const res = username.calculate_username(opt);
        assert.equal(res.username, 'lum-country-us-os-win');
    });
    it('should use session if ip is not passed', ()=>{
        const opt = {country: 'us', session: 'sess123'};
        const res = username.calculate_username(opt);
        assert.equal(res.username, 'lum-country-us-session-sess123');
    });
    it('should skip session if ip is passed', ()=>{
        const opt = {country: 'us', ip: '1.1.1.1', session: 'sess123'};
        const res = username.calculate_username(opt);
        assert.equal(res.username, 'lum-country-us-ip-1.1.1.1');
    });
    describe('debug', ()=>{
        it('should skip debug if default', ()=>{
            const opt = {country: 'us', debug: 'full'};
            const res = username.calculate_username(opt);
            assert.equal(res.username, 'lum-country-us');
        });
        it('should apply debug if not default', ()=>{
            const opt = {country: 'us', debug: 'none'};
            const res = username.calculate_username(opt);
            assert.equal(res.username, 'lum-country-us-debug-none');
        });
    });
    describe('route_err', ()=>{
        it('should skip route_err if default', ()=>{
            const opt = {country: 'us', route_err: 'pass_dyn'};
            const res = username.calculate_username(opt);
            assert.equal(res.username, 'lum-country-us');
        });
        it('should apply route_err if not default', ()=>{
            const opt = {country: 'us', route_err: 'block'};
            const res = username.calculate_username(opt);
            assert.equal(res.username, 'lum-country-us-route_err-block');
        });
    });
    describe('ua mobile', ()=>{
        const t = (name, opt, expected)=>it(name, ()=>{
            const res = username.calculate_username(opt);
            assert.equal(res.username, expected);
        });
        t('should skip when plan is not unblocker',
            {country: 'us', preset: 'unblocker', ua: true}, 'lum-country-us');
        t('should skip when preset is not unblocker',
            {country: 'us', unblock: true, ua: true}, 'lum-country-us');
        t('should set only if plan & preset are unblocker',
            {country: 'us', ua: true, preset: 'unblocker', unblock: true},
            'lum-country-us-ua-mobile');
        t('should not set anything if ua is not strictly true', {country: 'us',
            ua: false, unblock: true, preset: 'unblocker'}, 'lum-country-us');
    });
});
