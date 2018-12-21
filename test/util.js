// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, mocha:true*/
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const sinon = require('sinon');
const zerr = require('../util/zerr.js');
const lpm_file = require('../util/lpm_file.js');
const lpm_util = require('../util/lpm_util.js');
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
                const spy = sinon.stub(zerr, 'zexit',
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
        t({LPM_PORT: '11123'}, {port: {type: 'integer'}}, {port: 11123});
        t({LPM_PORT: 'asdasdasd'}, {port: {type: 'integer'}}, {},
            'LPM_PORT not a number asdasdasd');
        t({LPM_IP: '127.0.0.1'}, {ip: {type: 'string'}}, {ip: '127.0.0.1'});
        t({LPM_IP: '127.0.0.1'}, {ip: {type: 'string',
            pattern: '^(\\d+\\.\\d+\\.\\d+\\.\\d+)?$'}}, {ip: '127.0.0.1'});
        t({LPM_IP: 'notIp'}, {ip: {type: 'string',
            pattern: '^(\\d+\\.\\d+\\.\\d+\\.\\d+)?$'}}, {},
            'LPM_IP wrong value pattern ^(\\d+\\.\\d+\\.\\d+\\.\\d+)?$');
        t({LPM_IPS: '127.0.0.1'}, {ips: {type: 'array'}},
            {ips: ['127.0.0.1']});
        t({LPM_IPS: '127.0.0.1;192.168.1.1'}, {ips: {type: 'array'}},
            {ips: ['127.0.0.1', '192.168.1.1']});
        t({LPM_OBJECT: '[asdasd'}, {object: {type: 'object'}}, {},
            'LPM_OBJECT contains invalid JSON: [asdasd');
        t({LPM_OBJECT: '{"test": [1,2,3]}'}, {object: {type: 'object'}}, {
            object: {test: [1, 2, 3]}});
    });
    it('get_file_path', ()=>{
        const test_files = [
            ['test1.file'],
            ['test2.file', 'test2.file.backup'],
            ['test3.file', 'test3.file.0', 'test3.file.1'],
            ['test4.file', 'test4.file.0', 'test4.file.backup']];
        const create_file = filename=>fs.writeFileSync(
            path.resolve(os.homedir(), filename));
        const remove_file = filename=>{
            fs.unlinkSync(path.resolve(lpm_file.work_dir, filename));
        };
        const t = files=>{
            for (const file of files)
                create_file(file);
            lpm_file.get_file_path(files[0]);
            for (const file of files)
            {
                assert.equal(fs.existsSync(path.resolve(os.homedir(), file)),
                    false);
                assert.equal(fs.existsSync(path.resolve(
                    lpm_file.work_dir, file)), true);
            }
            for (const file of files)
                remove_file(file);
        };
        for (const files of test_files)
            t(files);
    });
});
