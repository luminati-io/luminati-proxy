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
const log = require('./log.js');
const Luminati = require('./luminati.js');
const Socks = require('./socks.js');
const ssl = require('./ssl.js');
const version = require('./version.js');
const request = require('request');
const http = require('http');
const netmask = require('netmask');
const socket_io = require('socket.io');
const hutil = require('hutil');
const util = require('util');
const sqlite3 = require('sqlite3');
const stringify = require('json-stable-stringify');
const countries = require('country-data').countries;
const country_language = require('country-language');
const yargs = require('yargs/yargs');
const phantomjs = require('phantomjs-prebuilt');
const webshot = require('webshot');
const etask = hutil.etask;
const qw = hutil.string.qw;
const ef = etask.ef;
const file = hutil.file;
const assign = Object.assign;
const is_win = process.platform=='win32';
module.exports = Manager;
const proxy_fields = {
    port: 'Listening port',
    log: `Log level (${_.keys(log.log_level).join('|')})`,
    customer: 'Customer',
    password: 'Password',
    proxy: 'Super proxy ip or country (us|gb|nl)',
    proxy_port: 'Super proxy port',
    proxy_count: 'Minimum number of super proxies to use',
    secure_proxy: 'Use SSL when accessing super proxy',
    sticky_ip: 'Use same session as much as possible to maintain IP',
    zone: 'Zone',
    country: 'Country',
    state: 'State',
    city: 'City',
    asn: 'ASN',
    dns: 'DNS resolving (local|remote)',
    debug: 'Luminati request debug info (none|full)',
    request_timeout: 'Timeout for request on the super proxy (seconds)',
    pool_size: 'Pool size',
    ssl: 'Enable SSL sniffing',
    max_requests: 'Requests per session',
    session_duration: 'Maximum duration of session (seconds)',
    proxy_switch: 'Automatically switch super proxy on failure',
    session_init_timeout: 'Session establish timeout (seconds)',
    direct_include: 'Include pattern for direct requests',
    direct_exclude: 'Exclude pattern for direct requests',
    null_response: 'URL pattern for null response',
    www: 'Local web port',
    socks: 'SOCKS5 port',
    history: 'Log history',
    database: 'Database path',
    resolve: 'Reverse DNS lookup file',
    config: 'Config file containing proxy definitions',
    iface: 'Interface or ip to listen on '
        +`(${_.keys(os.networkInterfaces()).join('|')})`,
    no_dropin: 'Disable drop-in mode for migrating',
};
const numeric_fields = qw`port session_init_timeout proxy_count pool_size
    max_requests request_timeout session_ducation`;
const _default = Manager.default = _.assign({}, Luminati.default, {
    customer: process.env.LUMINATI_CUSTOMER,
    password: process.env.LUMINATI_PASSWORD,
    max_requests: 50,
    pool_size: 3,
    proxy_switch: 5,
    www: 22999,
    config: path.join(os.homedir(), '.luminati.json'.substr(is_win?1:0)),
    database: path.join(os.homedir(), '.luminati.sqlite3'.substr(is_win?1:0)),
});

const load_json = (filename, optional, def)=>{
    if (optional && !file.exists(filename))
        return def;
    try {
        let s = file.read_e(filename);
        return JSON.parse(s);
    } catch(e){}
    return def;
};

const load_config = (filename, optional)=>{
    let proxies = load_json(filename, optional, []);
    return [].concat(proxies.proxies || proxies);
};

function Manager(args){
    this.argv = {log: _default.log};
    this.db = {};
    this.proxies = {};
    this.proxies_running = {};
    this.socks_servers = {};
    this.config = [];
    this.global_handlers = [];

    args = args.map(String);
    let _yargs = yargs(args);
    _yargs.usage('Usage: $0 [options] config1 config2 ...')
    .alias({h: 'help', p: 'port'})
    .describe(proxy_fields)
    .boolean(qw`history sticky_ip no_dropin ssl secure_proxy`)
    .number(numeric_fields)
    .default(_default).help('h')
    .version(()=>`luminati-proxy version: ${version}`);
    _yargs.config(load_json(_yargs.argv.config, true, {})._defaults||{});
    this.argv = _yargs.argv;
    this._log = log(this.argv.www||'MNGR', this.argv.log);
    this.opts = _.pick(this.argv, qw`zone country state city asn max_requests
        pool_size session_init_timeout direct idle_timeout request_timeout
        direct_include direct_exclude null_response dns resolve cid ip log
        proxy_switch sticky_ip proxy_port debug session_duration`);
    if (this.opts.resolve)
    {
        if (typeof this.opts.resolve=='boolean')
        {
            this.opts.resolve = ip=>etask(function*resolve(){
                let domains = yield etask.nfn_apply(dns, '.reverse', [ip]);
                this._log('DEBUG', `dns resolve ${ip} => ${domains}`);
                return domains&&domains.length?domains[0]:ip;
            });
        }
        else
        {
            const domains = {};
            hutil.file.read_lines_e(this.opts.resolve).forEach(line=>{
                const m = line.match(/^\s*(\d+\.\d+\.\d+\.\d+)\s+([^\s]+)/);
                if (!m)
                    return;
                this._log('DEBUG', `dns entry: ${m[1]} => ${m[2]}`);
                domains[m[1]] = m[2];
            });
            this.opts.resolve = ip=>domains[ip]||ip;
        }
    }
    this.config = load_config(this.argv.config, true).map(conf=>assign(conf,
        {persist: true}));
    this.config = this.config.concat.apply(this.config, this.argv._.map(
        filename=>load_config(filename)));
    this.config = this.config.length && this.config || [{persist: true}];
    this.config.filter(conf=>!conf.port)
        .forEach((conf, i)=>assign(conf, {port: this.argv.port+i}));
    this._log('DEBUG', 'Config', this.config);
    ['SIGTERM', 'SIGINT'].forEach(sig=>this.global_handlers.push({
        emitter: process,
        event: sig,
        handler: ()=>{
            this._log('INFO', `${sig} recieved`);
            this.stop(1000);
        },
    }));
    this.global_handlers.push({
        emitter: process,
        event: 'uncaughtException',
        handler: err=>{
            this._log('ERROR', `uncaughtException (${version}): ${err}`,
                err.stack);
            this.stop(1000);
        },
    });
    this.global_handlers.forEach(g=>g.emitter.on(g.event, g.handler));
}

const ensure_default = (etask, _this, next)=>{
    etask.on('ensure', ()=>{
        if (_this.error)
        {
            _this._log('ERROR', etask.error, etask.error.stack);
            return next(etask.error);
        }
    });
};

Manager.prototype.stop = etask._fn(function*stop(_this, done){
    if (!module.parent && !done)
        done = ()=>process.exit();
    if (!done)
        done = ()=>{};
    let servers = [];
    const stop_server = server=>servers.push(etask(function*(){
        try {
            yield server.stop(true);
        } catch(e) {
            _this._log('ERROR', 'Failed to stop server: '+e.message, {server:
                server, error: e});
        }
    }));
    if (_this.www_server)
        stop_server(_this.www_server);
    _.values(_this.socks_servers).forEach(stop_server);
    _.values(_this.proxies_running).forEach(stop_server);
    yield etask.all(servers);
    _this.global_handlers.forEach(g=>g.emitter.removeListener(g.event,
        g.handler));
    if (_this.db)
        _this.db.db.close(done);
    else
        done();
});

Manager.prototype.sql = function sql(){
    const args = [].slice.call(arguments);
    const db = this.db.db;
    this._log('DEBUG', 'SQL: '+args[0], args.slice(1));
    return etask(function*sql(){
        return yield etask.nfn_apply(db, '.all', args); });
};

Manager.prototype.har = function(entries){
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
};

Manager.prototype.save_config = function(filename){
    filename = filename||this.argv.config;
    if (!filename)
        return;
    let proxies = _.values(this.proxies)
        .map(p=>_.omit(p, 'stats'))
        .filter(conf=>conf.persist);
    let _defaults = _.pick(this.argv, qw`customer password max_requests socks
        no_dropin port proxy proxy_count proxy_switch proxy_port dns debug
        session_init_timeout request_timeout ssl sticky_ip www zone country
        state city ip session_duration idle_timeout`);
    let s = stringify({proxies, _defaults}, {space: '  '});
    if (fs.existsSync(filename))
        fs.renameSync(filename, filename+'.backup');
    fs.writeFileSync(filename, s);
};

Manager.prototype.json = etask._fn(function*json(_this, opt){
    if (typeof opt=='string')
        opt = {url: opt};
    opt.json = true;
    let res = yield etask.nfn_apply(request, [opt]);
    _this._log('DEBUG', `GET ${opt.url} - ${res.statusCode}`);
    return res;
});

Manager.prototype.prepare_database = etask._fn(
function*prepare_database(_this){
    const sqlite = _this.argv.log=='DEBUG' ? sqlite3.verbose() : sqlite3;
    _this.db = {stmt: {}};
    yield etask.nfn_apply((fn, cb)=>_this.db.db = new sqlite.Database(fn, cb),
        null, [_this.argv.database]);
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
            port: {type: 'INTEGER', index: true},
            url: {type: 'TEXT', index: true},
            method: {type: 'TEXT', index: true},
            request_headers: 'TEXT',
            response_headers: 'TEXT',
            status_code: {type: 'INTEGER', index: true},
            timestamp: {type: 'INTEGER', index: true},
            elapsed: {type: 'INTEGER', index: true},
            response_time: {type: 'INTEGER', index: true},
            node_latency: {type: 'INTEGER', index: true},
            country: {type: 'TEXT', index: true},
            timeline: 'TEXT',
            proxy: 'TEXT',
            username: 'TEXT',
            content_size: {type: 'INTEGER', index: true},
        },
    };
    const hash = crypto.createHash('md5').update(stringify(tables))
        .digest('hex');
    try {
        let existing_hash = (yield _this.sql(`SELECT hash FROM schema_info
            LIMIT 1`))[0].hash;
        if (existing_hash==hash)
            return;
    } catch(e){ ef(e); }
    const prefix = `Archive_${Date.now()}_`;
    const archive = yield _this.sql(`SELECT name FROM sqlite_master WHERE
        type='table' AND name IN ('${Object.keys(tables).join("','")}')`);
    if (archive.length)
    {
        for (let i=0; i<archive.length; i++)
        {
            const name = archive[i].name;
            yield _this.sql(`ALTER TABLE ${name} RENAME TO ${prefix+name}`);
        }
        const indexes = yield _this.sql(`SELECT name FROM sqlite_master WHERE
            type='index' AND sql IS NOT NULL`);
        for (let i=0; i<indexes.length; i++)
        {
            const name = indexes[i].name;
            yield _this.sql(`DROP INDEX ${name}`);
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
            yield _this.sql(queries[i]);
    }
    yield _this.sql('INSERT INTO schema_info(hash, version) VALUES (?, ?)',
        hash, version);
});

Manager.prototype.get_consts = function(req, res){
    let proxy = _.mapValues(proxy_fields, desc=>({desc: desc}));
    _.forOwn(_default, (def, prop)=>{
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
        debug: {values: ['', 'none', 'full']},
        iface: {values: [''].concat(_.keys(os.networkInterfaces()))},
        log: {def: this.opts.log, values: [''].concat(_.keys(
            log.log_level))},
        country: {def: 'us', values: countries_list}
    });
    let data = {proxy: proxy};
    res.json(data);
};

Manager.prototype.proxy_validator = function(conf){
    conf.customer = conf.customer||this.argv.customer;
    conf.password = conf.password||this.argv.password;
    conf.proxy_count = conf.proxy_count||this.argv.proxy_count;
    conf.proxy = [].concat(conf.proxy||this.argv.proxy);
    numeric_fields.forEach(field=>{
        if (conf[field])
            conf[field] = +conf[field];
    });
    // XXX stanislav: this workaround for command line only
    conf.direct = _.merge({}, conf.direct, {include: conf.direct_include,
        exclude: conf.direct_exclude});
    delete conf.direct_include;
    delete conf.direct_exclude;
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

Manager.prototype.create_proxy = etask._fn(
function*create_proxy(_this, proxy, iface){
    let conf = assign({}, _.omit(_this.opts, 'port'), proxy);
    _this.proxy_validator(conf);
    let server = new Luminati(assign(conf, {
        ssl: _this.argv.ssl && assign(ssl(), {requestCert: false}),
        secure_proxy: _this.argv.secure_proxy,
    }));
    server.on('response', res=>{
        _this._log('DEBUG', util.inspect(res, {depth: null, colors: 1}));
        let req = res.request;
        if (_this.argv.history)
        {
            let data = {
                port: server.port,
                url: req.url,
                method: req.method,
                request_headers: stringify(req.headers),
                response_headers: stringify(res.headers),
                status_code: res.status_code,
                timestamp: res.timeline.start,
                elapsed: res.timeline.end,
                response_time: res.timeline.response,
                node_latency: +((res.headers['x-hola-timeline-debug']||'')
                    .match(/(\d+) ?ms/)||[0, res.timeline.response])[1],
                country: ((res.headers['x-hola-unblocker-debug']||'')
                    .match(/\d+\.\d+\.\d+\.\d+ ([^ ]+)/)||['', ''])[1],
                timeline: stringify(res.timeline),
                proxy: res.proxy.host,
                username: res.proxy.username,
                content_size: res.body_size,
            };
            if (_this.io)
                _this.io.emit(`history/${server.port}`, data);
            let row = {};
            for (let f in data)
                row['$'+f] = data[f];
            _this.db.stmt.history.run(row);
        }
    }).on('error', this.throw_fn());
    let hostname = find_iface(iface||_this.argv.iface);
    let port = conf.port;
    if (!port)
    {
        let ports = _.keys(_this.proxies).map(p=>+p);
        port = ports.length ? _.max(ports)+1 : null;
    }
    yield server.listen(port, hostname);
    server.opt.port = server.port;
    proxy.port = server.port;
    _this._log('DEBUG', 'local proxy', server.opt);
    _this.proxies[server.port] = proxy;
    _this.proxies_running[server.port] = server;
    server.stop = etask._fn(function(){
        delete _this.proxies[server.port];
        delete _this.proxies_running[server.port];
        return Luminati.prototype.stop.call(server);
    });
    return server;
});

Manager.prototype.create_proxies = etask._fn(function*create_proxies(_this){
    for (let c of _this.config)
        yield _this.create_proxy(c);
});

Manager.prototype.proxy_create = etask._fn(function*proxy_create(_this, data){
    let proxy = data.proxy;
    let server = yield _this.create_proxy(proxy, data.iface);
    let timeout = data.idle_timeout;
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
        _this.save_config();
    return server;
});

Manager.prototype.proxy_delete = etask._fn(function*proxy_delete(_this, port){
    let server = _this.proxies_running[port];
    if (!server)
        return;
    if (server.timer)
        clearTimeout(server.timer);
    yield server.stop();
    if (server.opt.persist)
        _this.save_config();
});

Manager.prototype.proxy_create_api = etask._fn(
function*proxy_create_api(_this, req, res, next){
    ensure_default(this, _this, next);
    let server = yield _this.proxy_create(req.body);
    res.json({port: server.port});
});

Manager.prototype.proxy_update = etask._fn(
function*proxy_update(_this, req, res, next){
    ensure_default(this, _this, next);
    let port = req.params.port;
    let old_proxy = _this.proxies[port];
    if (!old_proxy)
        throw `No proxy at port ${port}`;
    if (!old_proxy.persist)
        throw 'This proxy is read-only';
    let proxy = assign({}, old_proxy, req.body.proxy);
    yield _this.proxy_delete(port);
    let server = yield _this.proxy_create({proxy: proxy});
    res.json({proxy: server.opts});
});

Manager.prototype.proxies_delete_api = etask._fn(
function*proxies_delete_api(_this, req, res, next){
    ensure_default(this, _this, next);
    let ports = `${req.body.port||''}`.split(',');
    for (let p of ports)
        yield _this.proxy_delete(p.trim());
    res.status(204).end();
});

Manager.prototype.proxy_delete_api = etask._fn(
function*proxy_delete_api(_this, req, res, next){
    ensure_default(this, _this, next);
    let port = req.params.port;
    yield _this.proxy_delete(port);
    res.status(204).end();
});

Manager.prototype.test = function(req, res){
    const opt = {
        uri: req.body.url,
        method: req.body.method,
        headers: req.body.headers,
        body: req.body.body,
        followRedirect: false,
    };
    if (+req.params.port)
        opt.proxy = 'http://127.0.0.1:'+req.params.port;
    request(opt, (err, http_res)=>{
        res.json(err ? {error: ''+err} : {
            request: {
                url: opt.url,
                method: opt.method,
                headers: opt.headers,
                body: opt.body,
                version: req.httpVersion,
            },
            response: {
                version: http_res.httpVersion,
                status_code: http_res.statusCode,
                status_message: http_res.statusMessage,
                headers: http_res.headers,
                body: http_res.body,
            },
        });
    });
};

Manager.prototype.country = etask._fn(
function*country(_this, req, res){
    const c = req.query.country;
    const url = req.query.url;
    const path = req.query.path||phantomjs.path;
    if (!fs.existsSync(path))
    {
        res.status(502).send('The provided path to PhantomJS is incorrect');
        return;
    }
    const ua = req.query.ua;
    const headers = JSON.parse(req.query.headers||'{}');
    if (!headers['Accept-Language'])
    {
        const get_locales = ()=>new Promise(resolve=>{
            country_language.getCountryMsLocales(c, function(e, locales){
                resolve(locales);
            });
        });
        const locales = yield get_locales();
        const lang = l=>`${l},${l.substr(0, 2)};q=0.8`;
        headers['Accept-Language'] = lang(
            locales[0] ? locales[0].langCultureName : 'en-US');
    }
    try {
        webshot(url, '', {
            shotSize: {width: 'all', height: 'all'},
            phantomPath: path,
            phantomConfig: {
                proxy: `${_this.argv.proxy}:${_this.argv.proxy_port}`,
                'proxy-auth': `lum-customer-${_this.argv.customer}-zone-`
                    +`${_this.argv.zone}-country-${c}:${_this.argv.password}`,
            },
            customHeaders: headers,
            userAgent: ua,
        }).pipe(res);
    } catch(e){ res.status(502).send('An error occurred'); }
});

Manager.prototype.history_get = function(req, res){
    this.filtered_get(req, res, this.db.db, (err, rows)=>res.json(rows));
};

Manager.prototype.har_get = function(req, res){
    res.setHeader('content-disposition', 'attachment; filename=data.har');
    res.setHeader('content-type', 'application/json');
    this.filtered_get(req, res, this.db.db,
        (err, rows)=>res.json(this.har(rows)));
};

Manager.prototype.filtered_get = function(req, res, db, callback){
    const port = req.params.port;
    const wheres = [];
    const vars = {};
    wheres.push('port = $port');
    vars.$port = +port;
    if (req.query.url)
    {
        wheres.push('url LIKE $url');
        vars.$url = `%${req.query.url}%`;
    }
    if (req.query.method)
    {
        wheres.push('method = $method');
        vars.$method = req.query.method;
    }
    if (req.query.status_code)
    {
        wheres.push('status_code = $status_code');
        vars.$status_code = +req.query.status_code;
    }
    if (req.query.timestamp_min)
    {
        wheres.push('timestamp >= $timestamp_min');
        vars.$timestamp_min = +req.query.timestamp_min;
    }
    if (req.query.timestamp_max)
    {
        wheres.push('timestamp <= $timestamp_max');
        vars.$timestamp_max = +req.query.timestamp_max;
    }
    if (req.query.elapsed_min)
    {
        wheres.push('elapsed >= $elapsed_min');
        vars.$elapsed_min = +req.query.elapsed_min;
    }
    if (req.query.elapsed_max)
    {
        wheres.push('elapsed <= $elapsed_max');
        vars.$elapsed_max = +req.query.elapsed_max;
    }
    if (req.query.country)
    {
        wheres.push('country = $country');
        vars.$country = req.query.country;
    }
    if (req.query.proxy)
    {
        wheres.push('proxy LIKE $proxy');
        vars.$proxy = `%${req.query.proxy}%`;
    }
    let query = `SELECT * FROM request WHERE (${wheres.join(') AND (')}) `
    +`ORDER BY ${req.query.sort}${req.query.sort_desc ? ' DESC' : ''} `
    +`LIMIT ${+req.query.count}`;
    db.all(query, vars, callback);
};

Manager.prototype.stats = etask._fn(
function*stats(_this, req, res){
    const r = yield _this.json({
        url: 'https://luminati.io/api/get_customer_bw?details=1',
        headers: {'x-hola-auth': `lum-customer-${_this.argv.customer}`
            +`-zone-${_this.argv.zone}-key-${_this.argv.password}`},
    });
    res.json(r.body[_this.argv.customer]||{});
});

Manager.prototype.whitelist = etask._fn(
function*whitelist(_this, req, res){
    const r = yield _this.json({
        url: 'https://luminati.io/api/get_whitelist?zones=*',
        headers: {'x-hola-auth': `lum-customer-${_this.argv.customer}`
            +`-zone-${_this.argv.zone}-key-${_this.argv.password}`},
    });
    res.json(r.body);
});

Manager.prototype.recent_ips = etask._fn(
function*recent_ips(_this, req, res){
    const r = yield _this.json({
        url: 'https://luminati.io/api/get_recent_ips?zones=*',
        headers: {'x-hola-auth': `lum-customer-${_this.argv.customer}`
            +`-zone-${_this.argv.zone}-key-${_this.argv.password}`},
    });
    res.json(r.body);
});

Manager.prototype.creds_get = function(req, res){
    res.json({
        customer: this.argv.customer,
        password: this.argv.password,
        proxy: this.argv.proxy,
        proxy_port: this.argv.proxy_port,
        config: this.argv.config,
    });
};

Manager.prototype.creds_set = etask._fn(
function*creds_set(_this, req, res){
    let proxy_res;
    try {
        proxy_res = yield _this.json({
            url: `http://${req.body.proxy}:${req.body.proxy_port}`,
            headers: {'x-hola-auth': `lum-customer-${req.body.customer}`
                +`-zone-${_this.argv.zone}-key-${req.body.password}`},
        });
    } catch(e) {
        ef(e);
        res.sendStatus(404);
        res.send('wrong server');
        return;
    }
    if (proxy_res.statusCode == 407)
    {
        res.sendStatus(407);
        res.send('wrong credentials');
        return;
    }
    _this.argv.customer = req.body.customer;
    _this.argv.password = req.body.password;
    _this.argv.proxy = req.body.proxy;
    _this.argv.proxy_port = req.body.proxy_port;
    _this.save_config();
    yield _this.init_proxies();
    res.sendStatus(200);
});

Manager.prototype.create_api_interface = function(){
    const app = express();
    app.get('/proxies_running', (req, res)=>
        res.json(_.values(this.proxies_running).map(p=>p.opt)));
    app.get('/version', (req, res)=>res.json({version: version}));
    app.get('/consts', this.get_consts.bind(this));
    app.get('/proxies', (req, res)=>{
        let r = _.values(this.proxies)
            .sort((a, b)=>a.port-b.port); // TODO the sorting should be in UI
        res.json(r);
    });
    // XXX stanislav: can be removed in favor of post('proxies')
    const proxy_create_api = this.proxy_create_api.bind(this);
    app.post('/create', proxy_create_api);
    app.post('/proxies', proxy_create_api);
    app.put('/proxies/:port', this.proxy_update.bind(this));
    app.post('/delete', this.proxies_delete_api.bind(this));
    app.delete('/proxies/:port', this.proxy_delete_api.bind(this));
    app.post('/test/:port', this.test.bind(this));
    app.get('/country', this.country.bind(this));
    app.get('/history/:port', this.history_get.bind(this));
    app.get('/har/:port', this.har_get.bind(this));
    app.get('/stats', this.stats.bind(this));
    app.get('/whitelist', this.whitelist.bind(this));
    app.get('/recent_ips', this.recent_ips.bind(this));
    app.get('/creds', this.creds_get.bind(this));
    app.post('/creds', this.creds_set.bind(this));
    app.post('/block', (req, res, next)=>etask(function*block(){
        this.on('ensure', ()=>{
            if (this.error)
                return next(this.error);
        });
        assert(req.body.ip, 'missing ip');
        let ips = [];
        [].concat(req.body.ip).forEach(ip=>{
            const block = new netmask.Netmask(ip);
            block.forEach((ip, long)=>ips.push(long));
        });
        yield this.sql(`INSERT INTO ip(ip) VALUES(${ips.join(',')})`);
        res.json({count: ips.length});
    }));
    return app;
};

Manager.prototype.create_web_interface = etask._fn(
function*create_web_interface(_this){
    const app = express();
    const server = http.Server(app);
    _this.io = socket_io(server);
    app.use(body_parser.urlencoded({extended: true}));
    app.use(body_parser.json());
    app.use('/api', _this.create_api_interface());
    app.get('/ssl', (req, res)=>{
        res.set('Content-Type', 'application/x-x509-ca-cert');
        res.set('Content-Disposition', 'filename=luminati.pem');
        res.send(fs.readFileSync(path.join(__dirname, '../bin/ca.crt')));
    });
    app.use((req, res, next)=>{
        res.locals.path = req.path;
        next();
    });
    app.use(express.static(path.join(__dirname, '../bin/pub')));
    app.use((err, req, res, next)=>{
        _this._log('ERROR', err.stack);
        res.status(500).send('Server Error');
    });
    _this.io.on('connection', socket=>etask(function*(){
        const notify = (name, value)=>{
            const data = {};
            data[name] = value;
            _this.io.emit('health', data);
        };
        try {
            yield _this.json('http://lumtest.com/myip');
            notify('network', true);
        } catch(e){ ef(e); notify('network', false); }
        try {
            yield _this.json(
                `http://${_this.argv.proxy}:${_this.argv.proxy_port}/`);
            notify('firewall', true);
        } catch(e){ ef(e); notify('firewall', false); }
        try {
            let res = yield _this.json({
                url: `http://${_this.argv.proxy}:${_this.argv.proxy_port}/`,
                headers: {'x-hola-auth':
                    `lum-customer-${_this.argv.customer}`+
                    `-zone-${_this.argv.zone}-key-${_this.argv.password}`,
            }});
            notify('credentials', res.statusCode!=407);
        } catch(e){ ef(e); notify('credentials', false); }
    })).on('error', err=>_this._log('ERROR', 'SocketIO error', {error: err}));
    setInterval(()=>{
        let stats = _.mapValues(_this.proxies_running, 'stats');
        _this.io.emit('stats', stats);
    }, 1000);
    server.on('error', this.throw_fn());
    server.active_connections = {};
    let next_connection_id = 0;
    server.on('connection', connection=>{
        const id = next_connection_id++;
        server.active_connections[id] = connection;
        connection.on('close', ()=>delete server.active_connections[id]);
    });
    server.stop = force=>etask(function*(){
        let defered = etask.nfn_apply(server, '.close', []);
        if (force)
            _.values(server.active_connections).forEach(c=>c.destroy());
        yield defered;
    });
    yield etask.cb_apply(server, '.listen', [_this.argv.www]);
    return server;
});

Manager.prototype.create_socks_servers = etask._fn(
function*create_socks_servers(_this){
    const socks = [].concat(_this.argv.socks||[]).map(ports=>{
        ports = (''+ports).split(':');
        return {
            local: +ports[0],
            remote: +ports[1]||_this.argv.port,
            log: _this.argv.log,
        };
    }).filter(ports=>{
        for (let c of _this.config)
        {
            if (c.port==ports.remote)
            {
                c.socks = ports.local;
                _this._log('DEBUG',
                    `Attaching socks ${ports.local} to proxy ${c.port}`);
                return false;
            }
        }
        return true;
    });
    return yield etask.all(socks.map(opt=>etask(function*(){
        const server = new Socks(opt);
        yield server.start();
        let port = server.port;
        _this.socks_servers[port] = server;
        console.log(`SOCKS5 is available at 127.0.0.1:${port}`);
    })));
});

Manager.prototype.init_proxies = etask._fn(function*init_proxies(_this){
    yield _this.create_proxies();
    if (!_this.argv.no_dropin)
    {
        _this.proxies_running['22225'] = yield _this.create_proxy({port:
            22225, sticky_ip: true, allow_proxy_auth: true});
    }
});

Manager.prototype.start = etask._fn(function*start(_this){
    try {
        yield _this.prepare_database();
        yield _this.create_socks_servers();
        if (_this.argv.customer)
            yield _this.init_proxies();
        if (_this.argv.history)
        {
            _this.db.stmt.history = _this.db.db.prepare(`INSERT INTO request (
                port, url, method, request_headers, response_headers,
                status_code, timestamp, elapsed, response_time, node_latency,
                country, timeline, proxy, username, content_size) VALUES
                ($port, $url, $method, $request_headers, $response_headers,
                $status_code, $timestamp, $elapsed, $response_time,
                $node_latency, $country, $timeline, $proxy, $username,
                $content_size)`);
        }
        if (_this.argv.www)
        {
            _this.www_server = yield _this.create_web_interface();
            let port = _this.www_server.address().port;
            console.log(`admin is available at http://127.0.0.1:${port}`);
        }
    } catch(e){ ef(e);
        if (e.message!='canceled')
            _this._log('ERROR', e, e.stack);
    }
});
