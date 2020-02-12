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
});
