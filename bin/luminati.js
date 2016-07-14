#!/usr/bin/env node
// LICENSE_CODE ZON
'use strict'; /*jslint node:true, esnext:true*/
const _ = require('underscore');
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const dns = require('dns');
const tls = require('tls');
const crypto = require('crypto');
const express = require('express');
const body_parser = require('body-parser');
const Luminati = require('../lib/luminati.js');
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
const forge = require('node-forge');
const stringify = require('json-stable-stringify');
const pki = forge.pki;
const etask = hutil.etask;
const ef = etask.ef;
const file = hutil.file;
const assign = Object.assign;
const is_win = process.platform=='win32';
const version = JSON.parse(fs.readFileSync(path.join(__dirname,
    '../package.json'))).version;
const argv = require('yargs').usage('Usage: $0 [options] config1 config2 ...')
.alias({h: 'help', p: 'port'})
.describe({
    port: 'Listening port',
    log: `Log level (${Object.keys(Luminati.log_level).join('|')})`,
    customer: 'Customer',
    password: 'Password',
    proxy: 'Super proxy ip or country',
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
    session_timeout: 'Session establish timeout',
    direct_include: 'Include pattern for direct requests',
    direct_exclude: 'Exclude pattern for direct requests',
    www: 'Local web port',
    socks: 'SOCKS5 port (local:remote)',
    history: 'Log history',
    database: 'Database path',
    resolve: 'Reverse DNS lookup file',
    config: 'Config file containing proxy definitions',
    iface: `Interface or ip to listen on (${Object.keys(os.networkInterfaces()).join(', ')})`,
    dns_servers: 'Space separated list of IPs for DNS resolution',
})
.boolean(['history', 'sticky_ip'])
.default({
    port: 24000,
    log: 'WARNING',
    customer: process.env.LUMINATI_CUSTOMER,
    password: process.env.LUMINATI_PASSWORD,
    proxy: 'zproxy.luminati.io',
    zone: process.env.LUMINATI_ZONE||'gen',
    max_requests: 50,
    pool_size: 3,
    session_timeout: 5000,
    proxy_count: 1,
    www: 22999,
    config: path.join(os.homedir(), '.luminati.json'.substr(is_win?1:0)),
    database: path.join(os.homedir(), '.luminati.sqlite3'.substr(is_win?1:0)),
}).help('h').version(()=>`luminati-proxy version: ${version}`).argv;
const ssl = {
    ca: {
        cert: fs.readFileSync(path.join(__dirname, 'ca.crt')),
        key: fs.readFileSync(path.join(__dirname, 'ca.key')),
    },
    keys: pki.rsa.generateKeyPair(2048),
    hosts: {},
    cb: (name, cb)=>{
        if (ssl.hosts[name])
            return cb(null, ssl.hosts[name]);
        const cert = pki.createCertificate();
        cert.publicKey = ssl.keys.publicKey;
        cert.serialNumber = ''+Date.now();
        cert.validity.notBefore = new Date();
        cert.validity.notAfter = new Date(Date.now()+10*365*86400000);
        cert.setSubject([{name: 'commonName', value: name}]);
        cert.setIssuer(pki.certificateFromPem(ssl.ca.cert).issuer.attributes);
        cert.sign(pki.privateKeyFromPem(ssl.ca.key), forge.md.sha256.create());
        ssl.hosts[name] = tls.createSecureContext({
            key: pki.privateKeyToPem(ssl.keys.privateKey),
            cert: pki.certificateToPem(cert),
            ca: ssl.ca.cert,
        });
        cb(null, ssl.hosts[name]);
    },
};

const log = (level, msg, extra)=>{
    if (Luminati.log_level[level]>Luminati.log_level[argv.log])
        return;
    let args = [`${level}: ${msg}`];
    if (extra)
        args.push(extra);
    console.log.apply(console, args);
};

let opts = _.pick(argv, ['zone', 'country', 'state', 'city', 'asn',
    'max_requests', 'pool_size', 'session_timeout', 'direct_include',
    'direct_exclude', 'dns', 'resolve', 'cid', 'ip', 'log']);
if (opts.resolve)
{
    if (typeof opts.resolve=='boolean')
    {
        opts.resolve = ip=>etask(function*(){
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
if (is_win)
{
    const readline = require('readline');
    readline.createInterface({input: process.stdin, output: process.stdout})
        .on('SIGINT', ()=>process.emit('SIGINT'));
}

let db;
const terminate = ()=>db?db.db.close(()=>process.exit()):process.exit();

process.on('SIGINT', ()=>{
    log('INFO', 'SIGINT recieved');
    terminate();
});
process.on('uncaughtException', err=>{
    log('ERROR', `uncaughtException (${version}): ${err}`, err.stack);
    terminate();
});

const dot2num = dot=>{
    const d = dot.split('.');
    return ((((((+d[0])*256)+(+d[1]))*256)+(+d[2]))*256)+(+d[3]);
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

const load_config = (filename, optional)=>{
    if (optional && !file.exists(filename))
        return [];
    return [].concat(JSON.parse(file.read_e(filename)))
        .map(conf=>assign({}, opts, conf));
};

const proxies = {};
const save_config = filename=>{
    fs.writeFileSync(filename||argv.config,
        stringify(proxies.map(proxy=>proxy.opt).filter(conf=>conf.persist)));
};

if (argv.dns_servers)
    dns.setServers(argv.dns_servers.split(' '));
let config = load_config(argv.config, true).map(conf=>assign(conf,
    {persist: true}));
argv._.forEach(filename=>config.push.apply(config, load_config(filename)));
config = config.length && config || [opts];
config.filter(conf=>!conf.port)
    .forEach((conf, i)=>assign(conf, {port: argv.port+i}));
log('DEBUG', 'Config', config);

const json = opt=>etask(function*(){
    if (typeof opt=='string')
        opt = {url: opt};
    opt.json = true;
    let res = yield etask.nfn_apply(request, [opt]);
    log('DEBUG', `GET ${opt.url} - ${res.statusCode}`);
    return res;
});

const check_credentials = ()=>etask(function*(){
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
    const sqlite = (argv.log=='DEBUG') ? sqlite3.verbose() : sqlite3;
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

const create_proxy = (conf, port, hostname)=>etask(function*(){
    if (conf.direct_include || conf.direct_exclude)
    {
        conf.direct = {};
        if (conf.direct_include)
            conf.direct.include = new RegExp(conf.direct_include, 'i');
        if (conf.direct_exclude)
            conf.direct.exclude = new RegExp(conf.direct_exclude, 'i');
        delete conf.direct_include;
        delete conf.direct_exclude;
    }
    conf.customer = conf.customer||argv.customer;
    conf.password = conf.password||argv.password;
    conf.proxy = [].concat(conf.proxy||argv.proxy);
    conf.proxy_count = conf.proxy_count||argv.proxy_count;
    const server = new Luminati(assign(conf, {
        ssl: argv.ssl && {requestCert: false, SNICallback: ssl.cb},
        secure_proxy: argv.secure_proxy,
    }));
    server.on('response', res=>{
        log('DEBUG', util.inspect(res, {depth: null, colors: 1}));
        const req = res.request;
        if (argv.history)
        {
            db.stmt.history.run(req.url, req.method,
                JSON.stringify(req.headers), JSON.stringify(res.headers),
                res.status_code, Math.floor(res.timeline.start/1000),
                res.timeline.end, JSON.stringify(res.timeline), res.proxy.host,
                res.proxy.username, res.body_size);
        }
    });
    yield server.listen(port, hostname);
    log('DEBUG', 'local proxy', server.opt);
    proxies[server.port] = server;
    server.stop = function(){
        delete proxies[this.port];
        return Luminati.prototype.stop.call(this);
    };
    return server;
});

const create_proxies = ()=>{
    return etask.all(config.map(conf=>create_proxy(conf, conf.port,
        find_iface(argv.iface))));
};

const create_api_interface = ()=>{
    const app = express();
    app.get('/version', (req, res)=>res.json({version: version}));
    app.get('/proxies', (req, res)=>{
        const r = _.values(proxies)
            .sort((a, b)=>a.port-b.port)
            .map(proxy=>assign({port: proxy.port}, proxy.opt));
        res.json(r);
    });
    app.get('/stats', (req, res)=>etask(function*(){
        const r = yield json({
            url: 'https://luminati.io/api/get_customer_bw?details=1',
            headers: {'x-hola-auth':
                `lum-customer-${argv.customer}-zone-gen-key-${argv.password}`},
        });
        res.json(r.body[argv.customer]||{});
    }));
    app.get('/creds', (req, res)=>{
        res.json({customer: argv.customer, password: argv.password}); });
    app.post('/creds', (req, res)=>{
        argv.customer = req.body.customer||argv.customer;
        argv.password = req.body.password||argv.password;
        res.sendStatus(200);
    });
    app.post('/create', (req, res, next)=>etask(function*(){
        this.on('ensure', ()=>{
            if (this.error)
            {
                log('ERROR', this.error, this.error.stack);
                return next(this.error);
            }
        });
        req.body.proxy = argv.proxy;
        req.body.persist = +req.body.persist||0;
        const server = yield create_proxy(_.omit(req.body, 'timeout'),
	    +req.body.port||0, find_iface(req.body.iface||argv.iface));
        if (req.body.timeout)
        {
            server.on('idle', idle=>{
                if (server.timer)
                {
                    clearTimeout(server.timer);
                    delete server.timer;
                }
                if (!idle)
                    return;
                server.timer = setTimeout(()=>server.stop(),
                    +req.body.timeout);
            });
        }
        if (req.body.persist)
            save_config();
        res.json({port: server.port});
    }));
    app.post('/delete', (req, res, next)=>etask(function*(){
        this.on('ensure', ()=>{
            if (this.error)
            {
                log('ERROR', this.error, this.error.stack);
                return next(this.error);
            }
        });
        const ports = (req.body.port||'').split(',');
        let save;
        for (let i=0; i<ports.length; i++)
        {
            const server = proxies[ports[i].trim()];
            if (!server)
                continue;
            if (server.timer)
                clearTimeout(server.timer);
            yield server.stop();
            save |= server.opt.persist;
        }
        if (save)
            save_config();
        res.status(204).end();
    }));
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
    const timestamp = Date.now();
    const app = express();
    const server = http.Server(app);
    const io = socket_io(server);
    assign(app.locals, {humanize: humanize, moment: moment});
    app.use(body_parser.urlencoded({extended: true}));
    app.use(body_parser.json());
    app.use('/api', create_api_interface());
    app.get('/ssl', (req, res)=>{
        res.set('Content-Type', 'application/x-x509-ca-cert');
        res.set('Content-Disposition', 'filename=luminati.pem');
        res.send(ssl.ca.cert);
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
                    `lum-customer-${argv.customer}-zone-gen`
                    +`-key-${argv.password}`,
            }});
            notify('credentials', res.statusCode!=407);
        } catch(e){ ef(e); notify('credentials', false); }
    })).on('error', err=>log('ERROR', 'SocketIO error', {error: err}));
    setInterval(()=>{
        const stats = {};
        for (let port in proxies)
            stats[port] = proxies[port].stats;
        io.emit('stats', stats);
    }, 1000);
    server.on('error', err=>this.ethrow(err));
    yield etask.cb_apply(server, '.listen', [argv.www]);
    return server;
});

const create_socks_server = (local, remote)=>etask(function*(){
    const server = socks.createServer((info, accept, deny)=>{
        if (info.dstPort==80)
        {
            info.dstAddr = '127.0.0.1';
            info.dstPort = remote;
	    log('DEBUG', 'Socks http connection: ', info);
            return accept();
        }
        if (info.dstPort==443)
        {
            const socket = accept(true);
            const dst = net.connect(remote, '127.0.0.1');
	    log('DEBUG', 'Socks https connection: ', info);
            dst.on('connect', ()=>{
                dst.write(util.format('CONNECT %s:%d HTTP/1.1\r\n'+
                    'Host: %s:%d\r\n\r\n', info.dstAddr, info.dstPort,
                    info.dstAddr, info.dstPort));
                socket.pipe(dst);
            }).on('error', err=>{
                log('ERROR', 'Socks connection error', {error: err,
                    port: local});
                this.ethrow(err);
            });
            return dst.once('data', ()=>{ dst.pipe(socket); });
        }
	log('DEBUG', 'Socks connection: ', info);
        accept();
    });
    server.useAuth(socks.auth.None());
    yield etask.cb_apply(server, '.listen', [local]);
    return server;
});

etask(function*(){
    try {
        yield check_credentials();
        yield prepare_database();
        const proxies = yield create_proxies();
        if (argv.history)
        {
            db.stmt.history = db.db.prepare('INSERT INTO request (url, method,'
                +'request_headers, response_headers, status_code, timestamp,'
                +'elapsed, timeline, proxy, username, content_size) VALUES (?,'
                +'?,?,?,?,?,?,?,?,?,?)');
        }
        if (argv.www)
        {
            const server = yield create_web_interface();
            let port = server.address().port;
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
