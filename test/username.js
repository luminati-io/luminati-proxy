// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, mocha:true*/
const assert = require('assert');
const username = require('../lib/username.js');

describe('username', ()=>{
    describe('calculate_username', ()=>{
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
                {country: 'us', preset: 'unblocker', ua: true},
                'lum-country-us');
            t('should set only if plan is unblocker',
                {country: 'us', ua: true, preset: 'unblocker', unblock: true},
                'lum-country-us-ua-mobile');
            t('should not set anything if ua is not strictly true',
                {country: 'us', ua: false, unblock: true, preset: 'unblocker'},
                'lum-country-us');
        });
        describe('state', ()=>{
            const t = (name, opt, expected)=>it(name, ()=>{
                const res = username.calculate_username(opt);
                assert.equal(res.username, expected);
            });
            t('should skip state if permission is not granted',
                {country: 'us', city: 'california', state: 'md'},
                'lum-country-us-city-california');
            t('attach state if state permission is granted', {country: 'us',
                city: 'california', state: 'md', state_perm: true},
                'lum-country-us-state-md-city-california');
        });
    });
    describe('parse', ()=>{
        it('should not parse if not an auth header', ()=>{
            assert.equal(username.parse('wrong-header'), undefined);
        });
        const calc_header = (uname, password)=>
            'Basic '+Buffer.from(uname+':'+password).toString('base64');
        it('basic', ()=>{
            const header = calc_header('lum-customer-test-zone-static',
                'pass123');
            const parsed = username.parse(header);
            assert.deepEqual(parsed, {
                customer: 'test',
                zone: 'static',
                password: 'pass123',
            });
        });
        it('with abbr', ()=>{
            const header = calc_header(
                'lum-customer-test-zone-static-ct-newyork',
                'pass123');
            const parsed = username.parse(header);
            assert.deepEqual(parsed, {
                customer: 'test',
                zone: 'static',
                city: 'newyork',
                password: 'pass123',
            });
        });
        it('with boolean flags', ()=>{
            const header = calc_header(
                'lum-customer-test-zone-static-unblocker-direct',
                'pass123');
            const parsed = username.parse(header);
            assert.deepEqual(parsed, {
                customer: 'test',
                zone: 'static',
                unblocker: true,
                direct: true,
                password: 'pass123',
            });
        });
        it('with incorrect flags', ()=>{
            const header = calc_header(
                'lum-customer-test-zone-static-wrong', 'pass123');
            const parsed = username.parse(header);
            assert.deepEqual(parsed, {
                customer: 'test',
                zone: 'static',
                password: 'pass123',
                wrong: undefined,
            });
        });
        it('without password', ()=>{
            const header = calc_header(
                'lum-customer-test-zone-static');
            const parsed = username.parse(header);
            assert.deepEqual(parsed, {
                customer: 'test',
                zone: 'static',
                password: 'undefined',
            });
        });
    });
});
