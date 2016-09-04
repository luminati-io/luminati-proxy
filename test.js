// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, mocha:true*/
const _ = require('lodash');
const assert = require('assert');
const http = require('http');
const https = require('https');
const net = require('net');
const url = require('url');
const path = require('path');
const os = require('os');
const fs = require('fs');
const socks = require('socksv5');
const ssl = require('./lib/ssl.js');
const hutil = require('hutil');
const request = require('request');
const etask = hutil.etask;
const luminati = require('./index.js');
const customer = 'abc';
const password = 'xyz';

const assert_has = (value, has, prefix)=>{
    prefix = prefix||'';
    if (value==has)
        return;
    if (Array.isArray(has) && Array.isArray(value))
    {
        if (value.length < has.length)
            throw new assert.AssertionError(`${prefix}.length is `
                +`${value.lengthi} should be at least ${has.length}`);
        has.forEach((h, i)=>assert_has(value[i], h, `${prefix}[${i}]`));
        return;
    }
    if (has instanceof Object && value instanceof Object)
    {
        Object.keys(has).forEach(k=>
            assert_has(value[k], has[k], `${prefix}.${k}`));
        return;
    }
    assert.equal(value, has, prefix);
};

let tmp_file_counter = 0;
const temp_file_path = (ext, pre)=>path.join(os.tmpdir(),
    `${pre||'test'}-${Date.now()}-${tmp_file_counter++}.${ext||'tmp'}`);

const temp_file = (content, ext, pre)=>{
    const path = temp_file_path(ext, pre);
    const done = ()=>fs.unlinkSync(path);
    fs.writeFileSync(path, JSON.stringify(content));
    return {path, done};
};

const http_proxy = port=>etask(function*(){
    const proxy = {history: []};
    const handler = (req, res, head)=>{
        if (proxy.fake)
        {
            const body = _.pick(req, 'method', 'url', 'headers');
            const auth = body.headers['proxy-authorization'];
            if (auth)
            {
                const cred = (new Buffer(auth.split(' ')[1], 'base64'))
                    .toString('ascii').split(':');
                body.auth = {password: cred[1]};
                for (let args=cred[0].split('-'); args.length;)
                {
                    const key = args.shift();
                    if (key=='lum')
                        continue;
                    if (key=='direct')
                    {
                        body.auth.direct = true;
                        continue;
                    }
                    body.auth[key] = args.shift();
                }
            }
            res.writeHead(200, {'content-type': 'application/json'});
            res.write(JSON.stringify(body));
            proxy.history.push(body);
            return res.end();
        }
        req.pipe(http.request({
            host: req.headers.host,
            port: url.parse(req.url).port||80,
            method: req.method,
            path: url.parse(req.url).path,
            headers: _.omit(req.headers, 'proxy-authorization'),
        }).on('response', _res=>{
            res.writeHead(_res.statusCode, _res.statusMessage, _res.headers);
            _res.pipe(res);
        }));
    };
    proxy.http = http.createServer(handler);
    const headers = {};
    proxy.http.on('connect', (req, res, head)=>etask(function*(){
        let _url = req.url;
        if (proxy.fake)
        {
            if (!proxy.https)
            {
                proxy.https = https.createServer(ssl(), (req, res, head)=>{
                    _.defaults(req.headers,
                        headers[req.socket.remotePort]||{});
                    handler(req, res, head);
                });
                yield etask.nfn_apply(proxy.https, '.listen', [0]);
            }
            _url = '127.0.0.1:'+proxy.https.address().port;
        }
        let port;
        const socket = net.connect({
            host: _url.split(':')[0],
            port: _url.split(':')[1]||443,
        }).on('connect', ()=>{
            port = socket.localPort;
            headers[port] = req.headers||{};
            res.write('HTTP/1.1 200 OK\r\n\r\n');
            res.pipe(socket).pipe(res);
        }).on('close', ()=>delete headers[port]);
    }));
    yield etask.nfn_apply(proxy.http, '.listen', [port||22225]);
    proxy.port = proxy.http.address().port;
    const onconnection = proxy.http._handle.onconnection;
    proxy.http._handle.onconnection = function(){
        if (!proxy.busy)
            return onconnection.apply(proxy.http._handle, arguments);
        let m = proxy.http.maxConnections;
        proxy.http.maxConnections = 1;
	proxy.http._connections++;
        onconnection.apply(proxy.http._handle, arguments);
        proxy.http.maxConnections = m;
	proxy.http._connections--;
    };
    proxy.close = proxy.stop = etask._fn(function*(_this){
        yield etask.nfn_apply(_this.http, '.close', []);
        if (_this.https)
            yield etask.nfn_apply(_this.https, '.close', []);
    });
    proxy.request = etask._fn(function*(_this, url){
        return yield etask.nfn_apply(request, [{
            url: url||'http://lumtest.com/myip',
            proxy: `http://${customer}:${password}@127.0.0.1:${proxy.port}`,
            strictSSL: false,
        }]);
    });
    return proxy;
});
let proxy;
before(()=>etask(function*(){
    proxy = yield http_proxy();
    proxy.fake = true;
}));
after(()=>etask(function*(){
    yield proxy.close();
    proxy = null;
}));
describe('proxy', ()=>{
    const test_url = 'http://lumtest.com/test';
    const lum = opt=>etask(function*(){
        opt = opt||{};
        if (opt.ssl===true)
            opt.ssl = _.assign(ssl(), {requestCert: false});
        const l = new luminati.Luminati(_.assign({
            proxy: '127.0.0.1',
            customer: customer,
            password: password,
            log: 'NONE',
        }, opt));
        l.test = etask._fn(function*(_this, opt){
            opt = opt||{};
            opt.url = opt.url||test_url;
            opt.json = true;
            opt.rejectUnauthorized = false;
            return yield etask.nfn_apply(_this, '.request',
                [opt]);
        });
        yield l.listen(opt.port||24000);
        return l;
    });

    let l;
    beforeEach(()=>proxy.history = []);
    afterEach(()=>etask(function*(){
        if (!l)
            return;
        yield l.stop(true);
        l = null;
    }));
    it('X-Hola-Agent', ()=>etask(function*(){
        l = yield lum();
        yield l.test();
        assert.equal(proxy.history.length, 1);
        assert.equal(proxy.history[0].headers['x-hola-agent'],
            luminati.version);
    }));
    describe('options', ()=>{
        it('pool', ()=>etask(function*(){
            l = yield lum({pool_size: 3});
            const res = yield l.test();
            assert.equal(proxy.history.length, 4);
            for (let i=0; i<3; i++)
            {
                assert.equal(proxy.history[i].url,
                    'http://lumtest.com/myip.json');
            }
            assert.equal(proxy.history[3].url, test_url);
            assert.equal(l.sessions.length, 3);
            for (let i=0; i<3; i++)
            {
                assert.equal(l.sessions[i].proxy, '127.0.0.1');
                assert.equal(l.sessions[i].session, '24000_'+(i+1));
            }
            assert.equal(res.body.auth.session, '24000_1');
        }));
        it('passthrough_disabled', ()=>etask(function*(){
            l = yield lum({pool_size: 3});
            const res = yield l.test({headers: {
                'proxy-authorization': 'Basic '+
                    (new Buffer('lum-customer-user-zone-zzz:pass'))
                    .toString('base64'),
            }});
            assert(!l.sessions);
            assert.equal(proxy.history.length, 1);
            assert.equal(res.body.auth.customer, customer);
            assert.equal(res.body.auth.password, password);
            assert.equal(res.body.auth.zone, 'gen');
        }));
        it('passthrough_enabled', ()=>etask(function*(){
            l = yield lum({pool_size: 3, allow_proxy_auth: true});
            const res = yield l.test({headers: {
                'proxy-authorization': 'Basic '+
                    (new Buffer('lum-customer-user-zone-zzz:pass'))
                    .toString('base64'),
            }});
            assert(!l.sessions);
            assert.equal(proxy.history.length, 1);
            assert.equal(res.body.auth.customer, customer);
            assert.equal(res.body.auth.password, password);
            assert.equal(res.body.auth.zone, 'zzz');
        }));
        describe('max_requests', ()=>{
            const t = (name, opt)=>it(name, ()=>etask(function*(){
                l = yield lum(opt);
                const pool_size = l.opt.pool_size || 1;
                for (let r=0; r<3; r++)
                {
                    for (let p=1; p<=pool_size; p++)
                    {
                        for (let i=0; i<l.opt.max_requests; i++)
                        {
                            const res = yield l.test();
                            assert.equal(res.body.auth.session,
                                '24000_'+(r*pool_size+p),
                                `trial/request/pool ${r}/${i}/${p}`);
                        }
                    }
                }
            }));
            t('1, pool 3', {max_requests: 1, pool_size: 3});
            t('2, pool 3', {max_requests: 2, pool_size: 3});
            t('5, pool 3', {max_requests: 5, pool_size: 3});
            t('10, pool 3', {max_requests: 10, pool_size: 3});
            t('1, no pool', {max_requests: 1});
            t('2, no pool', {max_requests: 2});
            t('5, no pool', {max_requests: 5});
            t('10, no pool', {max_requests: 10});
        });
        describe('null_response', ()=>{
            const t = (name, ssl)=>it(name, ()=>etask(function*(){
                l = yield lum({null_response: 'echo\.json', ssl: ssl});
                let protocol = ssl?'https':'http';
                let url = protocol+'://lumtest.com/echo.json';
                const res = yield l.test({url});
                assert.equal(proxy.history.length, 0);
                assert.equal(res.statusCode, 200);
                assert.equal(res.statusMessage, 'NULL');
                assert.equal(res.body, undefined);
                yield l.test({url: protocol+'://lumtest.com/myip.json'});
                assert.equal(proxy.history.length, 1);
            }));
            t('http');
            // t('https sniffing', true); // TODO lee fix
            it('https connect', ()=>etask(function*(){
                l = yield lum({null_response: 'match', log: 'DEBUG'});
                try {
                    yield l.test({url: 'https://match.com'});
                } catch(err) {
                    assert(/statusCode=501/.test(err.message));
                }
                yield l.test();
                assert.equal(proxy.history.length, 1);
            }));
        });
        describe('direct', ()=>{
            const t = (name, expected)=>it(name, ()=>etask(function*(){
                var direct = {};
                direct[name] = 'match';
                l = yield lum({direct});
                const match = yield l.test({url: 'http://match.com'});
                assert.equal(!!match.body.auth.direct, expected);
                const no_match = yield l.test({url: 'http://m-a-t-c-h.com'});
                assert.notEqual(!!no_match.body.auth.direct, expected);
            }));
            t('include', true);
            t('exclude', false);
        });
        describe('luminati params', ()=>{
            const t = (name, target, expected)=>it(name, ()=>etask(function*(){
                expected = expected||target;
                l = yield lum(_.assign({}, target, {}));
                const res = yield l.test();
                assert_has(res.body.auth, expected);
            }));
            t('auth', {customer: 'a', password: 'p'});
            t('zone', {zone: 'abc'});
            t('country', {country: 'il'});
            t('city', {country: 'us', state: 'ny', city: 'newyork'});
            t('static', {zone: 'static', ip: '127.0.0.1'});
            t('ASN', {zone: 'asn', asn: 28133});
            t('DNS', {dns: 'local'});
            t('debug', {debug: 'none'});
            t('request_timeout', {request_timeout: 10}, {timeout: 10});
        });
        describe('socks', ()=>{
            const t = (name, url)=>it(name, ()=>etask(function*(){
                l = yield lum({socks: 25000});
                yield etask.nfn_apply(request, [{
                    agent: new socks.HttpAgent({
                        proxyHost: '127.0.0.1',
                        proxyPort: 25000,
                        auths: [socks.auth.None()],
                    }),
                    url: url,
                }]);
                assert.equal(proxy.history.length, 1);
                assert.equal(proxy.history[0].url, url);
            }));
            t('http', test_url);
        });
    });
});
describe('manager', ()=>{
    let app, temp_files;

    const get_param = (args, param)=>{
        let i = args.indexOf(param)+1;
        return i?args[i]:null;
    };

    const start_app = args=>etask(function*start_app(){
        args = args||[];
        let www = get_param(args, '--www')||luminati.Manager.defs.www;
        let log = get_param(args, '--log');
        if (!log)
            args = args.concat(['--log', 'NONE']);
        let db_file = temp_file_path('.sqlite3');
        if (!get_param(args, '--database'))
            args = args.concat(['--database', db_file]);
        if (!get_param(args, '--proxy'))
            args = args.concat(['--proxy', '127.0.0.1']);
        if (!get_param(args, '--config'))
        {
            const config_file = temp_file([], 'json');
            args.push('--config');
            args.push(config_file.path);
            temp_files.push(config_file);
        }
        if (!get_param(args, '--customer'))
          args = args.concat(['--customer', customer]);
        if (!get_param(args, '--password'))
          args = args.concat(['--password', password]);
        args.push('--no_dropin');
        let manager = new luminati.Manager(args||[]);
        yield manager.start();
        let admin = 'http://127.0.0.1:'+www;
        return {manager, admin, db_file};
    });

    afterEach(()=>etask(function*(){
        if (!app)
            return;
        yield app.manager.stop();
        fs.unlink(app.db_file);
        app = null;
    }));
    beforeEach(()=>temp_files = []);
    afterEach(()=>temp_files.forEach(f=>f.done()));
    describe('socks', ()=>{
        beforeEach(()=>proxy.fake = false);
        afterEach(()=>proxy.fake = true);
        const t = (name, url, expected)=>it(name, ()=>etask(function*(){
            let args = [
                '--socks', '25000:24000',
            ];
            app = yield start_app(args);
            let res = yield etask.nfn_apply(request, [{
                agent: new socks.HttpAgent({
                    proxyHost: '127.0.0.1',
                    proxyPort: 25000,
                    auths: [socks.auth.None()],
                }),
                url: url,
            }]);
            let body = JSON.parse(res.body);
            assert_has(body, expected);
        }));
        t('http', 'http://lumtest.com/echo.json', {method: 'GET',
            url: '/echo.json'});
    });
    describe('config load', ()=>{
        const t = (name, config, expected)=>it(name, ()=>etask(function*(){
            let args = [];
            const cli = config.cli||{};
            Object.keys(cli).forEach(k=>{
                if (typeof cli[k]=='boolean')
                {
                    if (cli[k])
                        args.push('--'+k);
                    else
                        args.push('--no-'+k);
                    return;
                }
                args.push('--'+k);
                args.push(cli[k]);
            });
            const config_file = temp_file(config.config||[], 'json');
            args.push('--config');
            args.push(config_file.path);
            temp_files.push(config_file);
            if (config.files)
            {
                config.files.forEach(c=>{
                    const file = temp_file(c, 'json');
                    args.push(file.path);
                    temp_files.push(file);
                });
            }
            app = yield start_app(args);
            let res = yield etask.nfn_apply(request, [{
                url: app.admin+'/api/proxies_running',
            }]);
            let proxies = JSON.parse(res.body);
            assert_has(proxies, expected, 'proxies');
        }));
        t.skip = it.skip;

        const simple_proxy = {port: 24024};
        t('cli only', {cli: simple_proxy, config: []},
            [_.assign({}, simple_proxy, {persist: true})]);
        t('main config only', {config: simple_proxy},
            [_.assign({}, simple_proxy, {persist: true})]);
        t('config file', {files: [simple_proxy]}, [simple_proxy]);
        t('config override cli', {cli: simple_proxy, config: {port: 49049}},
            [_.assign({}, simple_proxy, {persist: true, port: 49049})]);
        const multiple_proxies = [
            _.assign({}, simple_proxy, {port: 25025}),
            _.assign({}, simple_proxy, {port: 26026}),
            _.assign({}, simple_proxy, {port: 27027}),
        ];
        t('multiple config files', {files: multiple_proxies},
            multiple_proxies);
        t('main + config files', {config: simple_proxy,
            files: multiple_proxies}, [].concat([_.assign({}, simple_proxy,
            {persist: true})], multiple_proxies));
    });
});
