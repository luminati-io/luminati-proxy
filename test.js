// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, mocha:true*/
const _ = require('lodash');
const spawn = require('child_process').spawn;
const assert = require('assert');
const http = require('http');
const https = require('https');
const net = require('net');
const url = require('url');
const path = require('path');
const os = require('os');
const fs = require('fs');
const ssl = require('./bin/ssl.js');
const hutil = require('hutil');
const request = require('request');
const etask = hutil.etask;
const Luminati = require('./lib/luminati.js');
const customer = 'abc';
const password = 'xyz';

const assert_has = (value, has, prefix)=>{
    prefix = prefix||'';
    if (value==has)
        return;
    if (Array.isArray(has))
    {
        if (value.length < has.length)
            throw new assert.AssertionError(`${prefix}.length is `
                +`${value.lengthi} should be at least ${has.length}`);
        for (let i = 0; i < has.length; ++i)
        {
            if (has[i]===undefined)
                continue;
            assert_has(value[i], has[i], `${prefix}[${i}]`);
        }
        return;
    }
    const keys = Object.keys(has);
    if (keys.length)
    {
        keys.forEach(k=>
            assert_has(value[k], has[k], `${prefix}.${k}`));
        return;
    }
    assert.equal(value, has, prefix);
};

let tmp_file_counter = 0;
const temp_file_path = (pre, ext)=>path.join(os.tmpdir(),
    `${pre||'test'}-${Date.now()}-${tmp_file_counter++}.${ext||'tmp'}`);

const temp_file = (content, pre, ext)=>{
    const path = temp_file_path(pre, ext);
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

describe('proxy', ()=>{
    let proxy;
    before(()=>etask(function*(){
        proxy = yield http_proxy();
        proxy.fake = true;
    }));
    after(()=>etask(function*(){
        yield proxy.close();
        proxy = null;
    }));
    const lum = opt=>etask(function*(){
        const l = new Luminati(_.assign({
            proxy: '127.0.0.1',
            customer: customer,
            password: password,
            log: 'NONE',
        }, opt||{}));
        l.test = etask._fn(function*(_this, opt){
            opt = opt||{};
            opt.url = opt.url||'http://test/';
            opt.json = true;
            return yield etask.nfn_apply(_this, '.request',
                [opt]);
        });
        yield l.listen(opt&&opt.port||24000);
        return l;
    });
    describe('options', ()=>{
        let l;
        beforeEach(()=>proxy.history = []);
        afterEach(()=>etask(function*(){
            if (!l)
                return;
            yield l.stop();
            l = null;
        }));
        it('pool', ()=>etask(function*(){
            l = yield lum({pool_size: 3});
            const res = yield l.test();
            assert(proxy.history.length==4);
            for (let i=0; i<3; i++)
            {
                assert.equal(proxy.history[i].url,
                    'http://lumtest.com/myip.json');
            }
            assert.equal(proxy.history[3].url, 'http://test/');
            assert.equal(l.sessions.length, 3);
            for (let i=0; i<3; i++)
            {
                assert.equal(l.sessions[i].proxy, '127.0.0.1');
                assert.equal(l.sessions[i].session, '24000_'+(i+1));
            }
            assert.equal(res.body.auth.session, '24000_1');
        }));
        it('passthrough', ()=>etask(function*(){
            l = yield lum({pool_size: 3});
            const res = yield l.test({headers: {
                'proxy-authorization': 'Basic '+
                    (new Buffer('lum-customer-user:pass')).toString('base64'),
            }});
            assert(!l.sessions);
            assert.equal(proxy.history.length, 1);
            assert.equal(res.body.auth.customer, 'user');
            assert.equal(res.body.auth.password, 'pass');
        }));
        it('max_requests', ()=>etask(function*(){
            l = yield lum({pool_size: 1, max_requests: 2});
            for (let session=1; session<=3; session++)
            {
                for (let i=0; i<l.opt.max_requests; i++)
                {
                    const res = yield l.test();
                    assert.equal(res.body.auth.session, '24000_'+session);
                }
            }
        }));
        it('null_response', ()=>etask(function*(){
            l = yield lum({null_response: 'match'});
            const res = yield l.test({url: 'http://match.com/'});
            assert.equal(proxy.history.length, 0);
            assert.equal(res.statusCode, 200);
            assert.equal(res.statusMessage, 'NULL');
            assert.equal(res.body, undefined);
            yield l.test();
            assert.equal(proxy.history.length, 1);
        }));
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
            const t = (name, target)=>it(name, ()=>etask(function*(){
                l = yield lum(_.assign({}, target, {}));
                const res = yield l.test();
                assert_has(res.body.auth, target);
            }));
            t('auth', {customer: 'a', password: 'p'});
            t('zone', {zone: 'abc'});
            t('country', {country: 'il'});
            t('city', {country: 'us', state: 'ny', city: 'newyork'});
            t('static', {zone: 'static', ip: '127.0.0.1'});
            t('ASN', {zone: 'asn', asn: 28133});
            t('DNS', {dns: 'local'});
        });
    });

    describe('config_load', ()=>{
        const start_app = args=>etask(function*start_app(){
            const app = spawn('bin/luminati.js', args,
                {stdio: [0, 'pipe', 2]});
            let admin, out = '';
            const app_start = data=>{
                out += data;
                const match = /admin is available at (https?:\/\/[^:]*:\d*)/
                    .exec(out);
                if (match)
                {
                    app.stdout.pipe(process.stdout);
                    app.stdout.removeListener('data', app_start);
                    admin = match[1];
                    this.continue();
                }
            };
            // app.stdout.pipe(process.stdout);
            app.stdout.on('data', app_start);
            yield this.wait();
            return {app, admin};
        });

        const stop_app = pm=>etask(function*stop_app(){
            pm.app.on('exit', this.continue_fn());
            pm.app.kill();
            yield this.wait();
        });

        const t = (name, config, expected)=>it(name, etask._fn(
        function*(_this){
            _this.timeout(5000);
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
            const config_file = temp_file(config.config||[]);
            args.push('--config');
            args.push(config_file.path);
            let temp_files = [config_file];
            if (config.files)
            {
                config.files.forEach(c=>{
                    const file = temp_file(c);
                    args.push(file.path);
                    temp_files.push(file);
                });
            }
            const pm = yield start_app(args);
            let proxies;
            try {
                let res = yield etask.nfn_apply(request, [{
                    url: pm.admin+'/api/proxies_running'
                }]);
                proxies = JSON.parse(res.body);
            } finally {
                yield stop_app(pm);
                temp_files.forEach(f=>f.done());
            }
            assert_has(proxies, expected, 'proxies');
        }));
        t.skip = it.skip;

        const simple_proxy = {
            customer: customer,
            password: password,
            port: 24024,
            //log: 'DEBUG',
        };
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
