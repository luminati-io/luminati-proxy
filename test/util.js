// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, mocha:true*/
const assert = require('assert');
const os = require('os');
const path = require('path');
const {Readable, Writable} = require('stream');
const sinon = require('sinon');
const pki = require('node-forge').pki;
const zerr = require('../util/zerr.js');
const lpm_file = require('../util/lpm_file.js');
const lpm_util = require('../util/lpm_util.js');
const Cert_gen = require('../util/cert_util.js');
const sanitizer_util = require('../util/js_sanitizer.js');
const mixin_core =require('../lib/mixins/core.js');
const date = require('../util/date.js');
const util = require('../lib/util.js');
const Server = require('../lib/server.js');
const Js_sanitizer = sanitizer_util.default;
const {
    Js_sanitizer_error,
    prop_name,
    member_name,
    call_name,
    new_name,
    is_identifier_reference,
} = sanitizer_util;

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
    describe('create_count_stream', ()=>{
        let t = (name, limit, chunks, expected)=>it(name, function(done){
            let resp = {body_size: 0, body: []};
            let $count = Server.create_count_stream(resp, limit);
            let src = new Readable({
                read(){ this.push('1234567890'); this.push(null); }
            });
            let dst = new Writable({
                write(chunk, encoding, callback){ callback(); },
            });
            src.pipe($count).pipe(dst).on('finish', ()=>{
                assert.equal(resp.body.length, chunks);
                if (chunks)
                    assert.equal(resp.body[0].length, expected);
                done();
            });
        });
        t('disabled', -1, 0, 0);
        t('cut', 5, 1, 5);
        t('enough', 15, 1, 10);
        t('unlimited', 0, 1, 10);
        t('undefined means unlimited', undefined, 1, 10);
    });
    describe('decode_body', ()=>{
        let t = (name, limit, expected)=>it(name, ()=>{
            let buffer = Buffer.from('1234567890');
            let body = util.decode_body([buffer], '', limit);
            assert.equal(body, expected);
        });
        t('disabled', -1, '');
        t('cut', 5, '12345');
        t('enough', 15, '1234567890');
        t('unlimited', 0, '1234567890');
        t('undefined means unlimited', undefined, '1234567890');
    });
    describe('mixins', ()=>{
        const label = 'test_mixin';
        const mixin_bp = {prototype: {}, static: {}};
        beforeEach('before each', ()=>mixin_core.flush());
        it('Should save new mixin', ()=>{
            mixin_core.new_mixin(label);
            assert.equal(mixin_core.as_array.length, 1, 'Doesnt save');
        });
        it('Should flush', ()=>{
            mixin_core.new_mixin(label);
            mixin_core.flush();
            assert.equal(mixin_core.as_array.length, 0, 'Doesnt flush');
        });
        it('Should create fixed interface', ()=>{
            let mixin = mixin_core.new_mixin(label);
            assert.deepStrictEqual(mixin, Object.assign({label}, mixin_bp),
                'wrong fields');
        });
        it('Should mix instance methods', ()=>{
            let mixin = mixin_core.new_mixin(label);
            mixin.prototype.test_method = ()=>true;
            class Test_class {}
            mixin_core.assign(Test_class, label);
            let test_instance = new Test_class();
            assert.ok(test_instance.test_method(),
                'Doesnt assign method to class proto');
        });
        it('Should mix static methods', ()=>{
            let mixin = mixin_core.new_mixin(label);
            mixin.static.test_method = ()=>true;
            class Test_class {}
            mixin_core.assign(Test_class, label);
            assert.ok(Test_class.test_method(),
                'Doesnt assign static method to class proto');
        });
    });
});

describe('js_sanitizer', ()=>{
    const reject = (san, code, msg)=>{
        assert.throws(()=>san.sanitize(code), e=>{
            assert.ok(e instanceof Js_sanitizer_error,
                'expected Js_sanitizer_error, got '+(e && e.name));
            assert.equal(e.code, 'CODE_UNSAFE');
            if (msg)
            {
                assert.ok(e.message.includes(msg),
                    `message "${e.message}" should include "${msg}"`);
            }
            return true;
        });
    };
    const accept = (san, code)=>{
        assert.equal(san.sanitize(code), true,
            `expected "${code}" to be accepted`);
    };
    it('throws on too many forbid/allow arguments', ()=>{
        const san = new Js_sanitizer();
        assert.throws(()=>san.forbid('A', 'B'), Js_sanitizer_error);
        assert.throws(()=>san.allow('A', 'B'), Js_sanitizer_error);
    });
    it('undefined spec is not treated as no-arg allow/forbid', ()=>{
        const san = new Js_sanitizer();
        assert.throws(()=>san.forbid(undefined), Js_sanitizer_error);
        assert.throws(()=>san.allow(undefined), Js_sanitizer_error);
    });
    describe('constructor', ()=>{
        it('builds with no options', ()=>{
            assert.doesNotThrow(()=>new Js_sanitizer());
        });
        it('rejects bad shape validator', ()=>{
            assert.throws(()=>new Js_sanitizer({validate_shape: 'nope'}),
                Js_sanitizer_error);
        });
        it('rejects bad node_validators', ()=>{
            assert.throws(()=>new Js_sanitizer({node_validators: 'nope'}),
                Js_sanitizer_error);
            assert.throws(
                ()=>new Js_sanitizer({node_validators: [()=>{}, 'x']}),
                Js_sanitizer_error);
        });
        it('rejects bad max_code_len', ()=>{
            assert.throws(()=>new Js_sanitizer({max_code_len: 0}),
                Js_sanitizer_error);
            assert.throws(()=>new Js_sanitizer({max_code_len: -5}),
                Js_sanitizer_error);
            assert.throws(()=>new Js_sanitizer({max_code_len: NaN}),
                Js_sanitizer_error);
        });
        it('does not mutate caller node_validators array', ()=>{
            const arr = [];
            const san = new Js_sanitizer({node_validators: arr});
            san.add_validator(()=>{});
            assert.equal(arr.length, 0, 'caller array must not be mutated');
        });
    });
    describe('contract: fresh instance imposes no built-in restrictions',
        ()=>{
        it('accepts arbitrary code with no policy set', ()=>{
            const san = new Js_sanitizer();
            accept(san, 'require("fs").readFileSync("/etc/passwd")');
            accept(san, 'process.exit(1)');
            accept(san, 'new Function("return 1")()');
            accept(san, 'a.b.c = function(){ while(1){} }');
        });
        it('runs only the supplied node validators', ()=>{
            let seen = 0;
            const san = new Js_sanitizer({node_validators: [
                (node, parent, gp, fail)=>{
                    seen++;
                    if (node.type=='CallExpression')
                        fail('no calls', node);
                },
            ]});
            accept(san, 'let x = 1');
            assert.ok(seen>0, 'validator should have run');
            reject(san, 'foo()', 'no calls');
        });
        it('runs validate_shape', ()=>{
            const san = new Js_sanitizer({validate_shape: (ast, fail)=>{
                if (ast.body.length>1)
                    fail('only one statement allowed');
            }});
            accept(san, 'let x = 1');
            reject(san, 'let x = 1; let y = 2', 'only one statement');
        });
    });
    describe('contract: forbid() blocks everything', ()=>{
        it('any code fails after forbid()', ()=>{
            const san = new Js_sanitizer().forbid();
            reject(san, '1');
            reject(san, 'let x = 1');
            reject(san, 'foo()');
            reject(san, '');
        });
        it('blocks the Program node itself', ()=>{
            const san = new Js_sanitizer().forbid();
            reject(san, '1', 'Program');
        });
    });
    describe('contract: allow() re-enables parts after forbid()', ()=>{
        it('allows listed node types only', ()=>{
            const san = new Js_sanitizer().forbid().allow([
                'Program', 'ExpressionStatement', 'Literal',
                'BinaryExpression',
            ]);
            accept(san, '1 + 2');
            reject(san, 'foo()', 'CallExpression');
        });
        it('allow() with no args re-opens all node types', ()=>{
            const san = new Js_sanitizer().forbid().allow();
            accept(san, 'foo(); let x = 1;');
        });
        it('only() restricts node types', ()=>{
            const san = new Js_sanitizer().only([
                'Program', 'ExpressionStatement', 'Literal',
            ]);
            accept(san, '1');
            reject(san, '1 + 2', 'BinaryExpression');
        });
    });
    describe('contract: forbid(params) partial blocking', ()=>{
        it('forbids identifiers', ()=>{
            const san = new Js_sanitizer().forbid({
                identifiers: ['require', 'process'],
            });
            accept(san, 'let a = 1');
            reject(san, 'require("fs")', 'identifiers require');
            reject(san, 'process.exit()', 'identifiers process');
        });
        it('forbids props', ()=>{
            const san = new Js_sanitizer().forbid({props: ['constructor']});
            accept(san, 'a.foo');
            reject(san, 'a.constructor', 'props constructor');
        });
        it('forbids node types via array short form', ()=>{
            const san = new Js_sanitizer().forbid(['WithStatement']);
            accept(san, 'let x = 1');
            reject(san, 'with(a){ b }', 'WithStatement');
        });
        it('forbids node types via string short form', ()=>{
            const san = new Js_sanitizer().forbid('WithStatement');
            reject(san, 'with(a){ b }', 'WithStatement');
        });
        it('forbids whole aspect with true', ()=>{
            const san = new Js_sanitizer().forbid({new_expr: true});
            accept(san, 'foo()');
            reject(san, 'new RegExp("x")', 'new_expr');
        });
        it('allow overrides a previous forbid for same value', ()=>{
            const san = new Js_sanitizer()
                .forbid({new_expr: true})
                .allow({new_expr: ['RegExp']});
            accept(san, 'new RegExp("x")');
            reject(san, 'new Function("x")', 'new_expr Function');
        });
    });
    describe('security: bypass attempts', ()=>{
        it('blocks computed constructor access', ()=>{
            const san = new Js_sanitizer().forbid({props: ['constructor']});
            reject(san, 'a.constructor');
            reject(san, 'a["con"+"structor"]', 'props');
            reject(san, 'a[x]', 'props');
        });
        it('blocks nested member path for forbidden identifier', ()=>{
            const san = new Js_sanitizer().forbid({
                identifiers: ['process'],
            });
            reject(san, 'process.env.SECRET', 'identifiers process');
        });
        it('blocks calls via full dotted path', ()=>{
            const san = new Js_sanitizer().forbid({
                calls: ['process.exit'],
            });
            reject(san, 'process.exit(1)', 'calls process.exit');
        });
        it('blocks optional call of forbidden function', ()=>{
            const san = new Js_sanitizer().forbid({calls: ['require']});
            reject(san, 'require?.("fs")', 'calls require');
        });
        it('blocks optional member call', ()=>{
            const san = new Js_sanitizer().forbid({calls: ['process.exit']});
            reject(san, 'process?.exit?.(1)', 'calls process.exit');
            reject(san, 'process.exit?.(1)', 'calls process.exit');
        });
        it('blocks dynamic import when ImportExpression forbidden', ()=>{
            const san = new Js_sanitizer({
                parse_opt: {ecmaVersion: 2020, sourceType: 'module'},
            }).forbid(['ImportExpression']);
            reject(san, 'import("fs")', 'ImportExpression');
        });
    });
    describe('external globals are read-only', ()=>{
        const san = ()=>new Js_sanitizer()
            .forbid({global_mutation: true, global_alias: true});

        it('blocks writing through external globals', ()=>{
            reject(san(), 'Object.keys = function(){}',
                'global_mutation Object');
            reject(san(), 'Object.prototype.x = 1',
                'global_mutation Object');
            reject(san(), 'globalThis.foo = 1',
                'global_mutation globalThis');
            reject(san(), 'delete Object.keys', 'global_mutation Object');
            reject(san(), 'Object.x++', 'global_mutation Object');
            reject(san(), 'foo = 1', 'global_mutation foo');
        });
        it('blocks deep member-chain mutation', ()=>{
            reject(san(), 'Object.a.b.c = 1', 'global_mutation Object');
        });
        it('blocks aliasing external globals', ()=>{
            reject(san(), 'var O = Object', 'global_alias Object');
            reject(san(), 'var k = Object.keys', 'global_alias Object');
            reject(san(), 'var a = [Object]', 'global_alias Object');
            reject(san(), 'var o = {x: Object}', 'global_alias Object');
            reject(san(), 'var t = {}; t.y = Object', 'global_alias Object');
        });
        it('blocks aliasing through function wrappers', ()=>{
            reject(san(), 'function f(){ return Object; }',
                'global_alias Object');
            reject(san(), 'var f = ()=>Object', 'global_alias Object');
            reject(san(), 'var f = ()=>{ return Object; }',
                'global_alias Object');
            reject(san(), 'var f = function(){ return Object; }',
                'global_alias Object');
        });
        it('treats a call argument as safe (not an alias)', ()=>{
            accept(san(), 'foo(Object)');
            accept(san(), 'Object.keys(opt)');
        });
        it('treats spread of a global as safe (copies values)', ()=>{
            accept(san(), 'var a = [...Object]');
            accept(san(), 'var o = {...Object}');
        });
        it('treats read / compare / typeof as safe', ()=>{
            accept(san(), 'Math.max(1, 2)');
            accept(san(), 'if (x instanceof Object) {}');
            accept(san(), 'typeof Object === "function"');
        });
        it('allows mutating / aliasing code-declared bindings', ()=>{
            accept(san(), 'var O = {}; O.x = 1; var P = O;');
            accept(san(), 'function f(){} f.x = 1;');
            accept(san(), 'let a = []; a[0] = 1; var b = a;');
        });
        it('allows mutating a bound function parameter', ()=>{
            accept(san(),
                'function trigger(opt){ opt.timeout = 200; return opt; }');
        });
        it('does not flag inner-function params as globals', ()=>{
            accept(san(),
                'function f(opt){ return ["a"].some(d=>opt.url'
                +'.includes(d)); }');
        });
        it('the two aspects are independent', ()=>{
            const mut = new Js_sanitizer().forbid({global_mutation: true});
            accept(mut, 'var O = Object');
            reject(mut, 'Object.keys = 0', 'global_mutation');

            const ali = new Js_sanitizer().forbid({global_alias: true});
            accept(ali, 'Object.keys = 0');
            reject(ali, 'var O = Object', 'global_alias');
        });
        it('not enforced on a fresh instance', ()=>{
            accept(new Js_sanitizer(), 'Object.keys = 0; var O = Object;');
        });
    });
    describe('identifier reference detection', ()=>{
        it('does not treat property names as identifiers', ()=>{
            const san = new Js_sanitizer().forbid({identifiers: ['foo']});
            accept(san, 'a.foo');
            reject(san, 'foo.a', 'identifiers foo');
        });
        it('does not treat object keys as identifiers', ()=>{
            const san = new Js_sanitizer().forbid({identifiers: ['foo']});
            accept(san, '({foo: 1})');
        });
        it('does not treat binding names as identifiers', ()=>{
            const san = new Js_sanitizer().forbid({identifiers: ['foo']});
            accept(san, 'let foo = 1');
            accept(san, 'function foo(){}');
            accept(san, 'function bar(foo){}');
        });
    });
    describe('operators', ()=>{
        it('forbids binary operators', ()=>{
            const san = new Js_sanitizer().forbid({binary_ops: ['+']});
            accept(san, '1 - 2');
            reject(san, '1 + 2', 'binary_ops +');
        });
        it('forbids unary operators', ()=>{
            const san = new Js_sanitizer().forbid({unary_ops: ['delete']});
            accept(san, '-1');
            reject(san, 'delete a.b', 'unary_ops delete');
        });
        it('forbids assignment operators', ()=>{
            const san = new Js_sanitizer()
                .forbid({assignment_ops: ['+=']});
            accept(san, 'a = 1');
            reject(san, 'a += 1', 'assignment_ops +=');
        });
        it('forbids update operators', ()=>{
            const san = new Js_sanitizer().forbid({update_ops: ['++']});
            reject(san, 'a++', 'update_ops ++');
        });
        it('forbids logical operators', ()=>{
            const san = new Js_sanitizer().forbid({logical_ops: ['||']});
            accept(san, 'a && b');
            reject(san, 'a || b', 'logical_ops ||');
        });
    });
    describe('reset()', ()=>{
        it('re-opens everything', ()=>{
            const san = new Js_sanitizer().forbid();
            reject(san, '1');
            san.reset();
            accept(san, 'require("fs"); a.constructor;');
        });
        it('clears global_* aspects', ()=>{
            const san = new Js_sanitizer()
                .forbid({global_mutation: true, global_alias: true});
            reject(san, 'var O = Object');
            san.reset();
            accept(san, 'var O = Object; Object.keys = 0;');
        });
    });
    describe('spec validation', ()=>{
        it('throws on unknown aspect', ()=>{
            const san = new Js_sanitizer();
            assert.throws(()=>san.forbid({bogus: ['x']}),
                Js_sanitizer_error);
        });
        it('throws on bad spec type', ()=>{
            const san = new Js_sanitizer();
            assert.throws(()=>san.forbid(123), Js_sanitizer_error);
        });
        it('throws on non-string values in list', ()=>{
            const san = new Js_sanitizer();
            assert.throws(()=>san.forbid({identifiers: [1, 2]}),
                Js_sanitizer_error);
        });
    });
    describe('parse safety', ()=>{
        it('rejects non-string code', ()=>{
            const san = new Js_sanitizer();
            reject(san, 42, 'code must be a string');
        });
        it('rejects code over max_code_len', ()=>{
            const san = new Js_sanitizer({max_code_len: 5});
            reject(san, 'let x = 12345', 'too large');
        });
        it('accepts code exactly at max_code_len', ()=>{
            const code = 'let x=1';
            const san = new Js_sanitizer({max_code_len: code.length});
            accept(san, code);
        });
        it('reports syntax errors as Js_sanitizer_error', ()=>{
            const san = new Js_sanitizer();
            reject(san, 'let = = =', 'syntax error');
        });
        it('handles CRLF line endings', ()=>{
            const san = new Js_sanitizer();
            accept(san, 'var a = 1;\r\nvar b = 2;\r\n');
        });
        it('rejects deeply nested input without RangeError', ()=>{
            const san = new Js_sanitizer({max_code_len: 100000});
            const deep = '('.repeat(20000)+'1'+')'.repeat(20000);
            assert.throws(()=>san.sanitize(deep), e=>{
                assert.ok(e instanceof Js_sanitizer_error,
                    'must be Js_sanitizer_error, not '+(e && e.name));
                return true;
            });
        });
    });
    describe('helpers', ()=>{
        const acorn = require('acorn');
        const parse1 = code=>acorn.parse(code,
            {ecmaVersion: 2020}).body[0].expression;
        it('prop_name', ()=>{
            const m = parse1('a.b');
            assert.equal(prop_name(m.property), 'b');
        });
        it('member_name resolves dotted path', ()=>{
            assert.equal(member_name(parse1('process.env.SECRET')),
                'process.env.SECRET');
        });
        it('member_name marks computed', ()=>{
            assert.equal(member_name(parse1('a[b]')), '<computed>');
        });
        it('call_name', ()=>{
            assert.equal(call_name(parse1('foo()')), 'foo');
            assert.equal(call_name(parse1('a.b()')), 'a.b');
        });
        it('new_name', ()=>{
            assert.equal(new_name(parse1('new Foo()')), 'Foo');
        });
        it('is_identifier_reference', ()=>{
            const ast = acorn.parse('a.b', {ecmaVersion: 2020});
            const expr = ast.body[0].expression;
            assert.ok(is_identifier_reference(expr.object, expr));
            assert.ok(!is_identifier_reference(expr.property, expr));
        });
    });
    describe('computed access', ()=>{
        it('resolves static string key like dotted access', ()=>{
            const san = new Js_sanitizer().forbid({props: ['constructor']});
            reject(san, 'a.constructor', 'props constructor');
            reject(san, 'a["constructor"]', 'props constructor');
        });
        it('blocks non-static computed key as opaque', ()=>{
            const san = new Js_sanitizer().forbid({props: ['constructor']});
            reject(san, 'a["con"+"structor"]', 'props');
            reject(san, 'a[`constructor`]', 'props');
            reject(san, 'var c="constructor"; a[c]', 'props');
            reject(san, 'a[key]', 'props');
        });
        it('blocks the Function-constructor bypass', ()=>{
            const san = new Js_sanitizer().forbid({props: ['constructor']});
            reject(san, 'a.constructor.constructor("return this")()',
                'props constructor');
            reject(san, 'a["constructor"]["constructor"]("return this")()',
                'props constructor');
        });
        it('allows safe computed string keys', ()=>{
            const san = new Js_sanitizer().forbid({props: ['constructor']});
            accept(san, 'a["url"]');
            accept(san, 'a._res.headers["verify"]');
            accept(san, 'a["url"].includes("x")');
        });
        it('does not block computed access without a props forbid-list',
            ()=>{
            const san = new Js_sanitizer();
            accept(san, 'a[key]');
            accept(san, 'a["con"+"structor"]');
            accept(san, 'a["constructor"]["constructor"]("x")()');
        });
    });
    describe('scope tracking', ()=>{
        it('tracks default parameter bindings', ()=>{
            const globals = [];
            const san = new Js_sanitizer({
                node_validators: [(node, parent, gp, fail, ctx)=>{
                    if (ctx.is_global_identifier_reference())
                        globals.push(node.name);
                }],
            });
            san.sanitize(`
                function drop_suffix(url, include_js = true){
                    if (include_js)
                        return url;
                    return '';
                }
            `);
            assert.deepStrictEqual(globals, []);
        });
        it('exposes scope helpers on ctx', ()=>{
            const seen = {};
            const san = new Js_sanitizer({
                node_validators: [(node, parent, gp, fail, ctx)=>{
                    if (node.type=='Identifier' && node.name=='opt')
                        seen.opt_bound = ctx.scope_has_binding('opt');
                    if (node.type=='Identifier' && node.name=='Object')
                    {
                        seen.obj_global =
                            ctx.is_global_identifier_reference();
                    }
                }],
            });
            san.sanitize(
                'function trigger(opt){ return Object.keys(opt); }');
            assert.equal(seen.opt_bound, true);
            assert.equal(seen.obj_global, true);
        });
    });
});
