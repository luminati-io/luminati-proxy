// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, mocha:true*/
const assert = require('assert');
const os = require('os');
const path = require('path');
const sinon = require('sinon');
const pki = require('node-forge').pki;
const zerr = require('../util/zerr.js');
const lpm_file = require('../util/lpm_file.js');
const lpm_util = require('../util/lpm_util.js');
const Cert_gen = require('../util/cert_util.js');
const date = require('../util/date.js');
const util = require('../lib/util.js');

describe('util', ()=>{
    describe('param_rand_range', ()=>{
        const t = (arg, res, mult)=>{
            let name = JSON.stringify(arg)+(mult>0 ? ' mult:'+mult : '');
            it(name, ()=>{
                let rand_range = util.param_rand_range(arg, mult);
                assert.equal(rand_range, res);
            });
        };
        t('0:0', 0);
        t(0, 0);
        t('1', 1);
        t('5:1', 5);
        t('5:1', 500, 100);
        t([5, 1], 500, 100);
        t('test', 0);
        t(5, 5);
        it('in range 2:4', ()=>{
            let rand_range = util.param_rand_range('2:4');
            assert.ok(rand_range>=2 && rand_range<=4);
        });
        it('in range 2:4 mult 100', ()=>{
            let rand_range = util.param_rand_range('2:4', 100);
            assert.ok(rand_range>=200 && rand_range<=400);
        });
    });
    it('parse_env_params', ()=>{
        const t = (env, params, result, error)=>{
            if (error)
            {
                const spy = sinon.stub(zerr, 'zexit').callsFake(
                    err=>assert.equal(err, error));
                lpm_util.t.parse_env_params(env, params);
                assert(spy.called);
                spy.restore();
            }
            else
            {
                assert.deepEqual(lpm_util.t.parse_env_params(env, params),
                    result);
            }
        };
        t({}, {port: {type: 'integer'}}, {});
        t({PMGR_PORT: '11123'}, {port: {type: 'integer'}}, {port: 11123});
        t({PMGR_PORT: 'asdasdasd'}, {port: {type: 'integer'}}, {},
            'PMGR_PORT not a number asdasdasd');
        t({PMGR_IP: '127.0.0.1'}, {ip: {type: 'string'}}, {ip: '127.0.0.1'});
        t({PMGR_IP: '127.0.0.1'}, {ip: {type: 'string',
            pattern: '^(\\d+\\.\\d+\\.\\d+\\.\\d+)?$'}}, {ip: '127.0.0.1'});
        t({PMGR_IP: 'notIp'}, {ip: {type: 'string',
            pattern: '^(\\d+\\.\\d+\\.\\d+\\.\\d+)?$'}}, {},
            'PMGR_IP wrong value pattern ^(\\d+\\.\\d+\\.\\d+\\.\\d+)?$');
        t({PMGR_IPS: '127.0.0.1'}, {ips: {type: 'array'}},
            {ips: ['127.0.0.1']});
        t({PMGR_IPS: '127.0.0.1;192.168.1.1'}, {ips: {type: 'array'}},
            {ips: ['127.0.0.1', '192.168.1.1']});
        t({PMGR_OBJECT: '[asdasd'}, {object: {type: 'object'}}, {},
            'PMGR_OBJECT contains invalid JSON: [asdasd');
        t({PMGR_OBJECT: '{"test": [1,2,3]}'}, {object: {type: 'object'}}, {
            object: {test: [1, 2, 3]}});
    });
    it('get_file_path', ()=>{
        const dir = path.resolve(os.homedir(), 'proxy_manager');
        const test_files = ['test1.file', 'test2.file'];
        const t = file=>{
            const p = lpm_file.get_file_path(file);
            assert.equal(p, dir+'/'+file);
        };
        for (const files of test_files)
            t(files);
    });
    describe('is_eip', ()=>{
        it('should accept any 32 long hexadecimal number with 1 char', ()=>{
            assert.ok(util.is_eip('r'+new Array(33).join('a')));
            assert.ok(util.is_eip('r'+new Array(33).join('1')));
        });
        it('should not accept strings wchich are not hexa numbers', ()=>{
            assert.ok(!util.is_eip('r'+new Array(33).join('.')));
            assert.ok(!util.is_eip('r'+new Array(33).join('G')));
        });
        it('should not accept shorter strings', ()=>{
            assert.ok(!util.is_eip('r'+new Array(32).join('A')));
        });
        it('should not accept longer string', ()=>{
            assert.ok(!util.is_eip('r'+new Array(34).join('A')));
        });
    });
    describe('cert_gen', ()=>{
        it('Should be valid certificate', ()=>{
            let ca = Cert_gen.create_root_ca();
            const ca_store = pki.createCaStore([ca.cert]);
            let ca_to_verify = pki.certificateFromPem(ca.cert);
            assert.ok(pki.verifyCertificateChain(ca_store, [ca_to_verify]),
                'Certificate is not valid');
        });
        it('Should have valid Public Key', ()=>{
            let ca = Cert_gen.create_root_ca();
            let crt = pki.certificateFromPem(ca.cert);
            assert.equal(crt.publicKey.n.toString(2).length, 2048,
                'Public Key is not valid');
        });
        it('Should have valid extensions', ()=>{
            let ca = Cert_gen.create_root_ca();
            let crt = pki.certificateFromPem(ca.cert);
            assert.ok(crt.getExtension('basicConstraints').cA,
                'basicConstraints.cA is not set');
            assert.ok(crt.getExtension('keyUsage').keyCertSign,
                'basicConstraints.keyCertSign is not set');
            assert.ok(crt.getExtension('keyUsage').cRLSign,
                'basicConstraints.cRLSign is not set');
        });
        it('Should have given attributes', ()=>{
            let country = 'Test C', state = 'Test ST', city = 'Test L';
            let common_name = 'Test PMGR CA', customer = 'Test cust';
            let cert_opt = {country, state, city, common_name, customer};
            let ca = Cert_gen.create_root_ca(cert_opt);
            let crt = pki.certificateFromPem(ca.cert);
            assert.equal(crt.issuer.getField('C').value, country,
                'Attribute countryName is not set');
            assert.equal(crt.issuer.getField('ST').value, state,
                'Attribute State is not set');
            assert.equal(crt.issuer.getField('L').value, city,
                'Attribute Locality is not set');
            assert.equal(crt.issuer.getField('CN').value, common_name,
                'Attribute commonName is not set');
            assert.equal(crt.issuer.getField('O').value, customer,
                'Attribute Organization is not set');
        });
        it('Validity should be instances of Date', ()=>{
            let {not_before, not_after} = Cert_gen.create_root_ca();
            assert.ok(not_before instanceof Date, 'not_before is not Date');
            assert.ok(not_after instanceof Date, 'not_after is not Date');
        });
        it('Should be valid not before then 2 days', ()=>{
            let {not_before} = Cert_gen.create_root_ca();
            assert.ok(not_before < date.add(date(), {day: -2, sec: 2}),
                'not_before is less then 2 days ago');
            assert.ok(not_before > date.add(date(), {day: -2, sec: -2}),
                'not_before is more then 2 days ago');

        });
        it('Should be valid not after then 20 years', ()=>{
            let {not_before, not_after} = Cert_gen.create_root_ca();
            assert.deepStrictEqual(not_after, date.add(not_before,
                {year: 20}), 'not_after is not 20 years in future');
        });
    });
});
