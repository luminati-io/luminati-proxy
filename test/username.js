// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, mocha:true*/
const assert = require('assert');
const username = require('../lib/username.js');
const consts = require('../lib/consts.js');

describe('username', ()=>{
    describe('calculate_username', ()=>{
        const un =str=>{
            if (!str)
                return consts.USERNAME_PREFS[0];
            return `${consts.USERNAME_PREFS[0]}-${str}`;
        };
        it('should use password', ()=>{
            const opt = {country: 'us', password: 'pass'};
            const res = username.calculate_username(opt);
            assert.equal(res.password, 'pass');
        });
        it('should set mobile false if os and mobile are passed', ()=>{
            const opt = {country: 'us', mobile: true, os: 'win'};
            const res = username.calculate_username(opt);
            assert.equal(res.username, un('country-us-mobile-false-os-win'));
        });
        it('should skip mobile false if os and mobile are passed', ()=>{
            const opt = {country: 'us', mobile: false, os: 'win'};
            const res = username.calculate_username(opt);
            assert.equal(res.username, un('country-us-os-win'));
        });
        it('should use session if ip is not passed', ()=>{
            const opt = {country: 'us', session: 'sess123'};
            const res = username.calculate_username(opt);
            assert.equal(res.username, un('country-us-session-sess123'));
        });
        it('should skip session if ip is passed', ()=>{
            const opt = {country: 'us', ip: '1.1.1.1', session: 'sess123'};
            const res = username.calculate_username(opt);
            assert.equal(res.username, un('country-us-ip-1.1.1.1'));
        });
        describe('debug', ()=>{
            it('should apply debug if default', ()=>{
                const opt = {country: 'us', debug: 'full'};
                const res = username.calculate_username(opt);
                assert.equal(res.username, un('country-us-debug-full'));
            });
            it('should apply debug if not default', ()=>{
                const opt = {country: 'us', debug: 'none'};
                const res = username.calculate_username(opt);
                assert.equal(res.username, un('country-us-debug-none'));
            });
        });
        describe('route_err', ()=>{
            it('should skip route_err if default', ()=>{
                const opt = {country: 'us', route_err: 'pass_dyn'};
                const res = username.calculate_username(opt);
                assert.equal(res.username, un('country-us'));
            });
            it('should apply route_err if not default', ()=>{
                const opt = {country: 'us', route_err: 'block'};
                const res = username.calculate_username(opt);
                assert.equal(res.username, un('country-us-route_err-block'));
            });
        });
        describe('ua mobile', ()=>{
            const t = (name, opt, expected)=>it(name, ()=>{
                const res = username.calculate_username(opt);
                assert.equal(res.username, expected);
            });
            t('should skip when plan is not unblocker',
                {country: 'us', preset: 'unblocker', ua: true},
                un('country-us'));
            t('should set only if plan is unblocker',
                {country: 'us', ua: true, preset: 'unblocker', unblock: true},
                un('country-us-ua-mobile'));
            t('should not set anything if ua is not strictly true',
                {country: 'us', ua: false, unblock: true, preset: 'unblocker'},
                un('country-us'));
        });
        describe('unblocker', ()=>{
            const t = (name, opt, expected)=>it(name, ()=>{
                const res = username.calculate_username(opt);
                assert.equal(res.username, expected);
            });
            t('should skip unblocker when is false', {unblocker: false},
                un());
            t('should skip unblocker when is empty', {unblocker: ''}, un());
            t('should skip unblocker when is undefined',
                {unblocker: undefined}, un());
            t('should set unblocker when is true', {unblocker: true},
                un('unblocker'));
            t('should set render if unblocker is true', {unblocker: true,
                render: true}, un('unblocker-render'));
            t('should not set render if unblocker is false', {render: true},
                un());
        });
        describe('state', ()=>{
            const t = (name, opt, expected)=>it(name, ()=>{
                const res = username.calculate_username(opt);
                assert.equal(res.username, expected);
            });
            t('should skip state if permission is not granted',
                {country: 'us', city: 'california', state: 'md'},
                un('country-us-city-california'));
            t('attach state if state permission is granted', {country: 'us',
                city: 'california', state: 'md', state_perm: true},
                un('country-us-state-md-city-california'));
        });
        describe('zip', ()=>{
            const t = (name, opt, expected)=>it(name, ()=>{
                const res = username.calculate_username(opt);
                assert.equal(res.username, expected);
            });
            t('should skip zip if permission is not granted',
                {country: 'us', zip: 12345}, un('country-us'));
            t('attach zip if zip permission is granted',
                {country: 'us', zip: 12345, zip_perm: true},
                un('country-us-zip-12345'));
        });
    });
    describe('parse', ()=>{
        it('should not parse if not an auth header', ()=>{
            assert.equal(username.parse('wrong-header'), undefined);
        });
        const calc_header = (uname, password)=>
            'Basic '+Buffer.from(uname+':'+password).toString('base64');
        it('basic', ()=>{
            const header = calc_header('brd-customer-test-zone-static',
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
                'brd-customer-test-zone-static-ct-newyork',
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
                'brd-customer-test-zone-static-unblocker-direct',
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
                'brd-customer-test-zone-static-wrong', 'pass123');
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
                'brd-customer-test-zone-static');
            const parsed = username.parse(header);
            assert.deepEqual(parsed, {
                customer: 'test',
                zone: 'static',
                password: 'undefined',
            });
        });
    });
});
