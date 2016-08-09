#!/usr/bin/env node
// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/
const _ = require('lodash');
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const dns = require('dns');
const crypto = require('crypto');
const express = require('express');
const body_parser = require('body-parser');
const Luminati = require('../lib/luminati.js');
const ssl = require('./ssl.js');
const net = require('net');
const request = require('request');
const humanize = require('humanize');
const moment = require('moment');
const prompt = require('prompt');
const http = require('http');
const netmask = require('netmask');
const socket_io = require('socket.io');
const socks = require('socksv5');
const hutil = require('hutil');
const util = require('util');
const sqlite3 = require('sqlite3');
const stringify = require('json-stable-stringify');
const countries = require('country-data').countries;
const yargs = require('yargs/yargs');
const E = module.exports = {};
const etask = hutil.etask;
const ef = etask.ef;
const file = hutil.file;
const assign = Object.assign;
const is_win = process.platform=='win32';
const version = E.version = JSON.parse(fs.readFileSync(path.join(__dirname,
    '../package.json'))).version;
const proxy_fields = {
    port: 'Listening port',
    log: `Log level (${Object.keys(Luminati.log_level).join('|')})`,
    customer: 'Customer',
    password: 'Password',
    proxy: 'Super proxy ip or country (us|gb|nl)',
    proxy_count: 'Minimum number of super proxies to use',
    secure_proxy: 'Use SSL when accessing super proxy',
    sticky_ip: 'Use same session as much as possible to maintain IP',
    zone: 'Zone',
    country: 'Country',
    state: 'State',
    city: 'City',
    asn: 'ASN',
    dns: 'DNS resolving (local|remote)',
    pool_size: 'Pool size',
    ssl: 'Enable SSL sniffing',
    max_requests: 'Requests per session',
    proxy_switch: 'Automatically switch proxy on failure',
    session_timeout: 'Session establish timeout',
    'direct_include': 'Include pattern for direct requests',
    'direct_exclude': 'Exclude pattern for direct requests',
    null_response: 'Url pattern for null response',
    www: 'Local web port',
    socks: 'SOCKS5 port (local:remote)',
    history: 'Log history',
    database: 'Database path',
    resolve: 'Reverse DNS lookup file',
    config: 'Config file containing proxy definitions',
    iface: 'Interface or ip to listen on '
        +`(${Object.keys(os.networkInterfaces()).join(', ')})`,
};
const defs = E.defs = {
    port: 24000,
    log: 'ERROR',
    customer: process.env.LUMINATI_CUSTOMER,
    password: process.env.LUMINATI_PASSWORD,
    proxy: 'zproxy.luminati.io',
    zone: process.env.LUMINATI_ZONE||'gen',
    max_requests: 50,
    pool_size: 3,
    session_timeout: 5000,
    proxy_count: 1,
    proxy_switch: 5,
    www: 22999,
    config: path.join(os.homedir(), '.luminati.json'.substr(is_win?1:0)),
    database: path.join(os.homedir(), '.luminati.sqlite3'.substr(is_win?1:0)),
};
let argv, io, db, opts, www_server, proxies = {}, proxies_running = {},
    config = [];

const load_json = (filename, optional, def)=>{
    if (optional && !file.exists(filename))
        return def;
    try {
        let s = file.read_e(filename);
        return JSON.parse(s);
    } catch(e){}
    return def;
};

const log = (level, msg, extra)=>{
    if (Luminati.log_level[level]>Luminati.log_level[argv.log])
        return;
    let args = [`${level}: ${msg}`];
    if (extra)
        args.push(extra);
    console.log.apply(console, args);
};

const ensure_default = (_this, next)=>{
    _this.on('ensure', ()=>{
        if (_this.error)
        {
            log('ERROR', _this.error, _this.error.stack);
            return next(_this.error);
        }
    });
};

const terminate = E.terminate = done=>{
    if (!done)
        done = ()=>{};
    if (!module.parent)
        done = ()=>process.exit();
    if (www_server)
    {
        try {
            www_server.close(); // TODO lee turn into async
        } catch(e) {
            log('ERROR', 'Failed to stop www: '+e.message, {www: www_server,
                error: e});
        }
    }
    _.values(proxies_running).forEach(p=>{
        try {
            p.stop();
        } catch(e) {
            log('ERROR', 'Failed to stop proxy: '+e.message, {proxy: p,
                error: e});
        }
    });
    if (db)
        db.db.close(done);
    else
        done();
};

const find_iface = iface=>{
    const ifaces = os.networkInterfaces();
    for (let name in ifaces)
    {
        if (name!=iface)
            continue;
        let addresses = ifaces[name].filter(data=>data.family=='IPv4');
        if (addresses.length)
            return addresses[0].address;
    }
    return iface;
};

function sql(){
    const args = [].slice.call(arguments);
    log('DEBUG', 'SQL: '+args[0], args.slice(1));
    return etask(function*sql(){
        return yield etask.nfn_apply(db.db, '.all', args);
    });
}

const har = opt=>etask(function*har(){
    opt = opt||{};
    const where = ['1=1'];
    if (opt.range)
        where.push('timestamp>='+opt.range[0], 'timestamp<'+opt.range[1]);
    if (opt.code)
    {
        if (typeof opt.code=='number')
            opt.code = [opt.code, opt.code];
        const codes = [];
        while (opt.code.length)
        {
            let cond = [];
            cond.push('status_code>='+opt.code.shift());
            cond.push('status_code<='+opt.code.shift());
            codes.push('('+cond.join(' AND ')+')');
        }
        where.push(codes.join(' OR '));
    }
    if (opt.url)
    {
        if (typeof opt.url=='string')
            opt.url = [opt.url];
        where.push(opt.url.map(u=>'url LIKE \'%'+u+'%\'').join(' OR '));
    }
    if (opt.proxy)
    {
        if (typeof opt.proxy=='string')
            opt.proxy = [opt.proxy];
        where.push(opt.proxy.map(p=>'proxy=\''+p+'\'').join(' OR '));
    }
    const entries = yield sql('SELECT * FROM request WHERE '+
        where.map(cond=>'('+cond+')').join(' AND ')+' ORDER BY timestamp');
    return {log: {
        version: '1.2',
        creator: {name: 'Luminati Proxy', version: version},
        pages: [],
        entries: entries.map(entry=>{
            const req = JSON.parse(entry.request_headers);
            const res = JSON.parse(entry.response_headers);
            const timeline = JSON.parse(entry.timeline);
            const headers = headers=>Object.keys(headers).map(name=>{
                return {
                    name: name,
                    value: headers[name],
                };
            });
            return {
                startedDateTime: new Date(timeline.start).toISOString(),
                time: entry.elapsed,
                request: {
                    method: entry.method,
                    url: entry.url,
                    httpVersion: 'unknown',
                    cookies: [],
                    headers: headers(req),
                    headersSize: -1,
                    bodySize: -1,
                    queryString: [],
                },
                response: {
                    status: entry.status_code,
                    statusText: '',
                    httpVersion: 'unknown',
                    cookies: [],
                    headers: headers(res),
                    content: {
                        size: entry.content_size,
                        mimeType: res['content-type']||'unknown',
                    },
                    headersSize: -1,
                    bodySize: entry.content_size,
                    redirectURL: '',
                },
                cache: {},
                timings: {
                    send: 0,
                    wait: timeline.response,
                    receive: entry.elapsed-timeline.response,
                },
                serverIPAddress: entry.proxy,
                comment: entry.username,
            };
        }),
    }};
});

const load_config = (filename, optional)=>{
    let proxies = load_json(filename, optional, []);
    return [].concat(proxies.proxies || proxies);
};

const save_config = filename=>{
    let proxs = _.values(proxies).map(p=>_.omit(p, 'stats'))
        .filter(conf=>conf.persist);
    let s = stringify({proxies: proxs, _defaults: argv}, {space: '  '});
    fs.writeFileSync(filename||argv.config, s);
};

const prepare_config = args=>{
    args = args.map(p=>''+p); // TODO lee hack until yargs accept PR#46
    let _yargs = yargs(args);
    _yargs.usage('Usage: $0 [options] config1 config2 ...')
    .alias({h: 'help', p: 'port'})
    .describe(proxy_fields)
    .boolean(['history', 'sticky_ip'])
    .default(defs).help('h').version(()=>`luminati-proxy version: ${version}`);
    _yargs.config(load_json(_yargs.argv.config, true, {})._defaults||{});
    argv = _yargs.argv;
    opts = _.pick(argv, ['zone', 'country', 'state', 'city', 'asn',
        'max_requests', 'pool_size', 'session_timeout', 'direct',
        'direct_include', 'direct_exclude', 'null_response', 'dns', 'resolve',
        'cid', 'ip', 'log', 'proxy_switch']);
    if (opts.resolve)
    {
        if (typeof opts.resolve=='boolean')
        {
            opts.resolve = ip=>etask(function*resolve(){
                let domains = yield etask.nfn_apply(dns, '.reverse', [ip]);
                log('DEBUG', `dns resolve ${ip} => ${domains}`);
                return domains&&domains.length?domains[0]:ip;
            });
        }
        else
        {
            const domains = {};
            hutil.file.read_lines_e(opts.resolve).forEach(line=>{
                const m = line.match(/^\s*(\d+\.\d+\.\d+\.\d+)\s+([^\s]+)/);
                if (!m)
                    return;
                log('DEBUG', `dns entry: ${m[1]} => ${m[2]}`);
                domains[m[1]] = m[2];
            });
            opts.resolve = ip=>domains[ip]||ip;
        }
    }
    config = load_config(argv.config, true).map(conf=>assign(conf,
        {persist: true}));
    config = config.concat.apply(config, argv._.map(
        filename=>load_config(filename)));
    config = config.length && config || [{persist: true}];
    config.filter(conf=>!conf.port)
        .forEach((conf, i)=>assign(conf, {port: argv.port+i}));
    log('DEBUG', 'Config', config);
};

const json = opt=>etask(function*json(){
    if (typeof opt=='string')
        opt = {url: opt};
    opt.json = true;
    let res = yield etask.nfn_apply(request, [opt]);
    log('DEBUG', `GET ${opt.url} - ${res.statusCode}`);
    return res;
});

const check_credentials = ()=>etask(function*check_credentials(){
    prompt.message = 'Luminati credentials';
    let cred = {};
    for (let i=0; i<config.length; i++)
    {
        cred.customer = config[i].customer||cred.customer;
        cred.password = config[i].password||cred.password;
        if (cred.customer && cred.password)
            break;
    }
    cred.customer = argv.customer||cred.customer;
    cred.password = argv.password||cred.password;
    prompt.override = cred;
    prompt.start();
    return assign(argv, yield etask.nfn_apply(prompt, '.get', [[{
        name: 'customer',
        description: 'CUSTOMER',
        required: true,
    }, {
        name: 'password',
        description: 'PASSWORD',
        required: true,
    }]]));
});

const prepare_database = ()=>etask(function*prepare_database(){
    const sqlite = argv.log=='DEBUG' ? sqlite3.verbose() : sqlite3;
    db = {stmt: {}};
    yield etask.nfn_apply((fn, cb)=>db.db = new sqlite.Database(fn, cb), null,
        [argv.database]);
    const tables = {
        schema_info: {
            hash: 'TEXT',
            version: 'TEXT',
            timestamp: {type: 'INTEGER', default: 'CURRENT_TIMESTAMP'},
        },
        ip: {
            ip: {type: 'UNSIGNED INTEGER', primary: true},
            timestamp: {type: 'INTEGER', default: 'CURRENT_TIMESTAMP'},
        },
        request: {
            port: {type: 'INTEGER'},
            url: 'TEXT',
            method: 'TEXT',
            request_headers: 'TEXT',
            response_headers: 'TEXT',
            status_code: {type: 'INTEGER', index: true},
            timestamp: {type: 'INTEGER', index: true},
            elapsed: {type: 'INTEGER', index: true},
            timeline: 'TEXT',
            proxy: 'TEXT',
            username: 'TEXT',
            content_size: {type: 'INTEGER', index: true},
        },
    };
    const hash = crypto.createHash('md5').update(stringify(tables))
        .digest('hex');
    try {
        if ((yield sql('SELECT hash FROM schema_info LIMIT 1'))[0].hash==hash)
            return;
    } catch(e){ ef(e); }
    const prefix = `Archive_${Date.now()}_`;
    const archive = yield sql(`SELECT name FROM sqlite_master WHERE
        type='table' AND name IN ('${Object.keys(tables).join("','")}')`);
    if (archive.length)
    {
        for (let i=0; i<archive.length; i++)
        {
            const name = archive[i].name;
            yield sql(`ALTER TABLE ${name} RENAME TO ${prefix+name}`);
        }
        const indexes = yield sql(`SELECT name FROM sqlite_master WHERE
            type='index' AND sql IS NOT NULL`);
        for (let i=0; i<indexes.length; i++)
        {
            const name = indexes[i].name;
            yield sql(`DROP INDEX ${name}`);
        }
        console.log('DB contains data using an old luminati-proxy schema, '+
            `data was archived to the following tables: ${prefix}*`);
    }
    for (let table in tables)
    {
        const fields = [], queries = [];
        for (let field in tables[table])
        {
            let value = tables[table][field];
            if (typeof value=='string')
                value={type: value};
            value.primary = value.primary ? 'PRIMARY KEY' : '';
            value.default = value.default ? `DEFAULT ${value.default}` : '';
            fields.push(`${field} ${value.type} ${value.primary}
                ${value.default}`);
            if (value.index)
            {
                queries.push(`CREATE ${value.unique&&'UNIQUE'||''} INDEX
                    ${field} ON ${table}(${field})`);
            }
        }
        queries.unshift(`CREATE TABLE ${table}(${fields.join(', ')})`);
        for (let i=0; i<queries.length; i++)
            yield sql(queries[i]);
    }
    yield sql('INSERT INTO schema_info(hash, version) VALUES (?, ?)',
        hash, version);
});

const get_consts = (req, res)=>{
    let proxy = _.mapValues(proxy_fields, desc=>({desc: desc}));
    _.forOwn(defs, (def, prop)=>{
        if (proxy[prop])
            proxy[prop].def = def;
    });
    let countries_list = _.values(countries).filter(c=>c.status=='assigned')
        .map(c=>({value: c.alpha2.toLowerCase(), key: c.name.split(',')[0]}));
    countries_list = _.uniqBy(countries_list, 'value');
    countries_list.forEach(c=>c.key=`${c.value}: ${c.key}`);
    countries_list.unshift({key: '', value: ''});
    _.merge(proxy, {
        dns: {values: ['', 'local', 'remote']},
        iface: {values: [''].concat(_.keys(os.networkInterfaces()))},
        log: {def: opts.log, values: [''].concat(_.keys(Luminati.log_level))},
        country: {def: 'us', values: countries_list}
    });
    let data = {proxy: proxy};
    res.json(data);
};

const proxy_validator = conf=>{
    conf.customer = conf.customer||argv.customer;
    conf.password = conf.password||argv.password;
    conf.proxy_count = conf.proxy_count||argv.proxy_count;
    conf.proxy = [].concat(conf.proxy||argv.proxy);
    let numbers = ['port', 'session_timeout', 'proxy_count', 'pool_size',
        'max_requests'];
    numbers.forEach(field=>{
        if (conf[field])
            conf[field] = +conf[field];
    });
    // XXX stanislav: this workaround for command line only
    conf.direct = _.merge({}, conf.direct, {include: conf.direct_include,
        exclude: conf.direct_exclude});
    delete conf.direct_include;
    delete conf.direct_exclude;
};

const create_proxy = (proxy, iface)=>etask(function*create_proxy(){
    let conf = assign({}, _.omit(opts, 'port'), proxy);
    proxy_validator(conf);
    let server = new Luminati(assign(conf, {
        ssl: argv.ssl && assign(ssl(), {requestCert: false}),
        secure_proxy: argv.secure_proxy,
    }));
    server.on('response', res=>{
        log('DEBUG', util.inspect(res, {depth: null, colors: 1}));
        let req = res.request;
        if (argv.history)
        {
            let data = {port: server.port, url: req.url, method: req.method,
                request_headers: stringify(req.headers),
                response_headers: stringify(res.headers),
                status_code: res.status_code,
                timestamp: res.timeline.start,
                elapsed: res.timeline.end, timeline: stringify(res.timeline),
                proxy: res.proxy.host, username: res.proxy.username,
                content_size: res.body_size};
            if (io)
                io.emit(`history/${server.port}`, data);
            let row = _.values(data);
            db.stmt.history.run.apply(db.stmt.history, row);
        }
    }).on('error', this.throw_fn());
    let hostname = find_iface(iface||argv.iface);
    let port = conf.port;
    if (!port)
    {
        let ports = _.keys(proxies).map(p=>+p);
        port = ports.length ? _.max(ports)+1 : null;
    }
    yield server.listen(port, hostname);
    server.opt.port = server.port;
    proxy.port = server.port;
    log('DEBUG', 'local proxy', server.opt);
    proxies[server.port] = proxy;
    proxies_running[server.port] = server;
    server.stop = function(){
        delete proxies[this.port];
        delete proxies_running[this.port];
        return Luminati.prototype.stop.call(this);
    };
    return server;
});

const create_proxies = ()=>etask(function*create_proxies(){
    // TODO convert to use etask.all
    for (let c of config)
        try { yield create_proxy(c); } catch(e){ log('ERROR', e); }
});

const proxy_create = data=>etask(function*proxy_create(){
    let proxy = data.proxy;
    let server = yield create_proxy(proxy, data.iface);
    let timeout = data.timeout;
    if (timeout)
    {
        server.on('idle', idle=>{
            if (server.timer)
            {
                clearTimeout(server.timer);
                delete server.timer;
            }
            if (!idle)
                return;
            server.timer = setTimeout(()=>server.stop(), +timeout);
        });
    }
    if (proxy.persist)
        save_config();
    return server;
});

const proxy_delete = port=>etask(function*proxy_delete(){
    let server = proxies_running[port];
    if (!server)
        return;
    if (server.timer)
        clearTimeout(server.timer);
    yield server.stop();
    if (server.opt.persist)
        save_config();
});

const proxy_create_api = (req, res, next)=>etask(function*proxy_create_api(){
    ensure_default(this, next);
    let server = yield proxy_create(req.body);
    res.json({port: server.port});
});

const proxy_update = (req, res, next)=>etask(function*proxy_update(){
    ensure_default(this, next);
    let port = req.params.port;
    let old_proxy = proxies[port];
    if (!old_proxy)
        throw `No proxy at port ${port}`;
    let proxy = assign({}, old_proxy, req.body.proxy);
    yield proxy_delete(port);
    let server = yield proxy_create({proxy: proxy});
    res.json({proxy: server.opts});
});

const proxies_delete_api = (req, res, next)=>etask(
function*proxies_delete_api(){
    ensure_default(this, next);
    let ports = (req.body.port||'').split(',');
    for (let p of ports)
        yield proxy_delete(p.trim());
    res.status(204).end();
});

const proxy_delete_api = (req, res, next)=>etask(
function*proxy_delete_api(){
    ensure_default(this, next);
    let port = req.params.port;
    yield proxy_delete(port);
    res.status(204).end();
});

const history_get = (req, res)=>{
    let port = req.params.port;
    db.stmt.query_history.all([port], (err, rows)=>res.json(rows));
};

const create_api_interface = ()=>{
    const app = express();
    app.get('/proxies_running', (req, res)=>
        res.json(_.values(proxies_running).map(p=>p.opt)));
    app.get('/version', (req, res)=>res.json({version: version}));
    app.get('/consts', get_consts);
    app.get('/proxies', (req, res)=>{
        let r = _.values(proxies)
            .sort((a, b)=>a.port-b.port); // TODO the sorting should be in UI
        res.json(r);
    });
    // XXX stanislav: can be removed in favor of post('proxies')
    app.post('/create', proxy_create_api);
    app.post('/proxies', proxy_create_api);
    app.put('/proxies/:port', proxy_update);
    app.post('/delete', proxies_delete_api);
    app.delete('/proxies/:port', proxy_delete_api);
    app.get('/history/:port', history_get);
    app.get('/stats', (req, res)=>etask(function*(){
        const r = yield json({
            url: 'https://luminati.io/api/get_customer_bw?details=1',
            headers: {'x-hola-auth': `lum-customer-${argv.customer}`
                +`-zone-${argv.zone}-key-${argv.password}`},
        });
        res.json(r.body[argv.customer]||{});
    }));
    app.get('/creds', (req, res)=>{
        res.json({customer: argv.customer, password: argv.password}); });
    app.post('/creds', (req, res)=>{
        argv.customer = req.body.customer||argv.customer;
        argv.password = req.body.password||argv.password;
        save_config();
        res.sendStatus(200);
    });
    app.post('/block', (req, res, next)=>etask(function*(){
        this.on('ensure', ()=>{
            if (this.error)
                return next(this.error);
        });
        assert(req.body.ip, 'missing ip');
        let ips = [];
        [].concat(req.body.ip).forEach(ip=>{
            const block = new netmask.Netmask(ip);
            block.forEach((ip, long)=>{
                ips.push(long);
            });
        });
        yield sql(`INSERT INTO ip(ip) VALUES(${ips.join(',')})`);
        res.json({count: ips.length});
    }));
    return app;
};

const create_web_interface = ()=>etask(function*(){
    const app = express();
    const server = http.Server(app);
    io = socket_io(server);
    assign(app.locals, {humanize: humanize, moment: moment});
    app.use(body_parser.urlencoded({extended: true}));
    app.use(body_parser.json());
    app.use('/api', create_api_interface());
    app.get('/ssl', (req, res)=>{
        res.set('Content-Type', 'application/x-x509-ca-cert');
        res.set('Content-Disposition', 'filename=luminati.pem');
        res.send(fs.readFileSync(path.join(__dirname, 'ca.crt')));
    });
    app.use((req, res, next)=>{
        res.locals.path = req.path;
        next();
    });
    app.use(express.static(path.join(__dirname, 'public')));
    app.use((err, req, res, next)=>{
        log('ERROR', err.stack);
        res.status(500).send('Server Error');
    });
    io.on('connection', socket=>etask(function*(){
        const notify = (name, value)=>{
            const data = {};
            data[name] = value;
            io.emit('health', data);
        };
        try {
            yield json('http://lumtest.com/myip');
            notify('network', true);
        } catch(e){ ef(e); notify('network', false); }
        try {
            yield json('http://zproxy.luminati.io:22225/');
            notify('firewall', true);
        } catch(e){ ef(e); notify('firewall', false); }
        try {
            let res = yield json({
                url: 'http://zproxy.luminati.io:22225/',
                headers: {'x-hola-auth':
                    `lum-customer-${argv.customer}-zone-${argv.zone}`
                    +`-key-${argv.password}`,
            }});
            notify('credentials', res.statusCode!=407);
        } catch(e){ ef(e); notify('credentials', false); }
    })).on('error', err=>log('ERROR', 'SocketIO error', {error: err}));
    setInterval(()=>{
        let stats = _.mapValues(proxies_running, 'stats');
        io.emit('stats', stats);
    }, 1000);
    server.on('error', this.throw_fn());
    yield etask.cb_apply(server, '.listen', [argv.www]);
    return server;
});

const create_socks_server = (local, remote)=>etask(function*(){
    const server = socks.createServer((info, accept, deny)=>{
        if (info.dstPort==80)
        {
            info.dstAddr = '127.0.0.1';
            info.dstPort = remote;
	    log('DEBUG', `${local} Socks http connection`, info);
            return accept();
        }
        if (info.dstPort==443)
        {
            const socket = accept(true);
            const dst = net.connect(remote, '127.0.0.1');
	    log('DEBUG', `${local} Socks https connection`, info);
            dst.on('connect', ()=>{
                dst.write(util.format('CONNECT %s:%d HTTP/1.1\r\n'+
                    'Host: %s:%d\r\n\r\n', info.dstAddr, info.dstPort,
                    info.dstAddr, info.dstPort));
                socket.pipe(dst);
            }).on('error', err=>{
                log('ERROR', `${local} Socks connection error`, {error: err,
                    port: local});
                this.throw(err);
            });
            return dst.once('data', ()=>{ dst.pipe(socket); });
        }
	log('DEBUG', `${local} Socks connection`, info);
        accept();
    });
    server.useAuth(socks.auth.None());
    yield etask.cb_apply(server, '.listen', [local]);
    return server;
});

const main = E.main = args=>etask(function*main(){
    try {
        prepare_config(args);
        yield check_credentials();
        yield prepare_database();
        yield create_proxies();
        if (argv.history)
        {
            db.stmt.history = db.db.prepare('INSERT INTO request (port, url,'
                +'method, request_headers, response_headers, status_code,'
                +'timestamp, elapsed, timeline, proxy, username, content_size)'
                +' VALUES (?,?,?,?,?,?,?,?,?,?,?,?)');
        }
        db.stmt.query_history = db.db.prepare('SELECT * FROM request WHERE '
            +'port = ? ORDER BY timestamp DESC LIMIT 1000');
        if (argv.www)
        {
            www_server = yield create_web_interface();
            let port = www_server.address().port;
            console.log(`admin is available at http://127.0.0.1:${port}`);
        }
        [].concat(argv.socks||[]).forEach(ports=>etask(function*(){
            ports = ports.split(':');
            const server = yield create_socks_server(+ports[0], +ports[1]);
            let port = server.address().port;
            console.log(`SOCKS5 is available at 127.0.0.1:${port}`);
        }));
    } catch(e){ ef(e);
        if (e.message!='canceled')
            log('ERROR', e, e.stack);
    }
});

if (is_win)
{
    const readline = require('readline');
    readline.createInterface({input: process.stdin, output: process.stdout})
        .on('SIGINT', ()=>process.emit('SIGINT'));
}

['SIGTERM', 'SIGINT'].forEach(sig=>process.on(sig, ()=>{
    log('INFO', `${sig} recieved`);
    terminate();
}));

process.on('uncaughtException', err=>{
    log('ERROR', `uncaughtException (${version}): ${err}`, err.stack);
    terminate();
});

if (!module.parent)
   main(process.argv.slice(2));
