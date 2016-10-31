#!/usr/bin/env node
// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/
const _ = require('lodash');
const assert = require('assert');
const events = require('events');
const fs = require('fs');
const path = require('path');
const os = require('os');
const dns = require('dns');
const crypto = require('crypto');
const express = require('express');
const body_parser = require('body-parser');
const log = require('./log.js');
const http_shutdown = require('http-shutdown');
const Luminati = require('./luminati.js');
const Socks = require('./socks.js');
const ssl = require('./ssl.js');
const find_iface = require('./find_iface.js');
const pkg = require('../package.json');
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
const sudo_prompt = require('sudo-prompt');
const child_process = require('child_process');
const webpack = require('webpack');
const memoryfs = require('memory-fs');
const db_history = require('./db_history.js');
const check_node_version = require('check-node-version');
let phantomjs, webshot;
try {
    phantomjs = require('phantomjs-prebuilt');
    webshot = require('webshot');
} catch(e){}
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
    keep_alive: 'Generate request to keep alive every n seconds',
    zone: 'Zone',
    country: 'Country',
    state: 'State',
    city: 'City',
    asn: 'ASN',
    ip: 'Datacenter IP',
    dns: 'DNS resolving (local|remote)',
    debug: 'Luminati request debug info (none|full)',
    request_timeout: 'Timeout for request on the super proxy (seconds)',
    pool_size: 'Pool size',
    pool_type: 'Pool session iteration order (sequential|round-robin)',
    ssl: 'Enable SSL sniffing',
    insecure: 'Enable SSL connection/sniffing to insecure hosts',
    max_requests: 'Requests per session',
    session_duration: 'Maximum duration of session (seconds)',
    proxy_switch: 'Automatically switch super proxy on failure',
    session_init_timeout: 'Session establish timeout (seconds)',
    direct_include: 'Include pattern for direct requests',
    direct_exclude: 'Exclude pattern for direct requests',
    null_response: 'URL pattern for null response',
    bypass_proxy: 'URL pattern for bypassing the proxy and connect directly',
    throttle: 'Throttle requests above given number',
    allow_proxy_auth: 'Allow Luminati authentication per request',
    www: 'Local web port',
    'no-www': 'Disable local web',
    socks: 'SOCKS5 port',
    history: 'Log history',
    database: 'Database path',
    resolve: 'Reverse DNS lookup file',
    config: 'Config file containing proxy definitions',
    'no-config': 'Working without a config file',
    iface: 'Interface or ip to listen on '
        +`(${_.keys(os.networkInterfaces()).join('|')})`,
    no_dropin: 'Disable drop-in mode for migrating',
    daemon: 'Start as a daemon',
};
const string_fields = qw`password customer zone country state city ip proxy`;
const numeric_fields = qw`port session_init_timeout proxy_count pool_size
    max_requests request_timeout session_ducation throttle keep_alive asn`;
const boolean_fields = qw`history sticky_ip no_dropin ssl secure_proxy
    allow_proxy_auth insecure`;
const _default = Manager.default = assign({}, Luminati.default, {
    customer: process.env.LUMINATI_CUSTOMER,
    password: process.env.LUMINATI_PASSWORD,
    max_requests: 50,
    pool_size: 3,
    proxy_switch: 5,
    www: 22999,
    config: path.resolve(os.homedir(),
        '.luminati.json'.substr(is_win ? 1 : 0)),
    database: path.resolve(os.homedir(),
        '.luminati.sqlite3'.substr(is_win ? 1 : 0)),
    history: false,
    ssl: false,
    no_dropin: false,
});
const default_port = 22225;

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
    events.EventEmitter.call(this);
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
    .alias({h: 'help', p: 'port', d: 'daemon'})
    .describe(proxy_fields)
    .boolean(boolean_fields)
    .number(numeric_fields)
    .string(string_fields)
    .default(_default).help('h')
    .version(()=>`luminati-proxy version: ${pkg.version}`);
    _yargs.config(load_json(_yargs.argv.config, true, {})._defaults||{});
    this.argv = _yargs.argv;
    this._log = log(this.argv.www||'MNGR', this.argv.log);
    this.opts = _.pick(this.argv, _.keys(proxy_fields));
    if (this.opts.resolve)
    {
        if (typeof this.opts.resolve=='boolean')
        {
            this.opts.resolve = ip=>etask(function*resolve(){
                let domains = yield etask.nfn_apply(dns, '.reverse', [ip]);
                this._log.debug(`dns resolve ${ip} => ${domains}`);
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
                this._log.debug(`dns entry: ${m[1]} => ${m[2]}`);
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
    this._log.debug('Config', this.config);
    ['SIGTERM', 'SIGINT'].forEach(sig=>this.global_handlers.push({
        emitter: process,
        event: sig,
        handler: ()=>{
            this._log.info(`${sig} received`);
            this.stop(true);
        },
    }));
    this.global_handlers.push({
        emitter: process,
        event: 'uncaughtException',
        handler: err=>{
            this._log.error(`uncaughtException (${pkg.version}): ${err}`,
                err.stack);
            this.stop(true);
        },
    });
    this.global_handlers.forEach(g=>g.emitter.on(g.event, g.handler));
}

util.inherits(Manager, events.EventEmitter);

Manager.prototype._api = function(f){
    const _this = this;
    return (req, res, next)=>etask(function*_api(){
        this.on('ensure', ()=>{
            if (this.error)
                return next(this.error);
        });
        yield f.call(_this, req, res, next);
    });
};

Manager.prototype.stop = etask._fn(function*stop(_this, force, cb, restart){
    const done = ()=>{
        if (!restart)
            _this.emit('stop');
        if (cb)
            cb();
    };
    let servers = [];
    _this._log.info('Stopping servers');
    const stop_server = server=>servers.push(etask(function*(){
        try {
            yield server.stop(force);
        } catch(e){
            _this._log.error('Failed to stop server: '+e.message, {server:
                server, error: e});
        }
    }));
    if (_this.www_server)
        stop_server(_this.www_server);
    _.values(_this.socks_servers).forEach(stop_server);
    _.values(_this.proxies_running).forEach(stop_server);
    yield etask.all(servers);
    _this._log.info('Servers stopped');
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
    this._log.debug('SQL: '+args[0], args.slice(1));
    return etask(function*sql(){
        return yield etask.nfn_apply(db, '.all', args); });
};

Manager.prototype.har = function(entries){
    return {log: {
        version: '1.2',
        creator: {name: 'Luminati Proxy', version: pkg.version},
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
                    postData: {
                        mimeType: req['content-type']||'',
                        text: entry.request_body,
                    },
                    bodySize: entry.request_body.length,
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
                serverIPAddress: entry.super_proxy,
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
        .filter(p=>p.persist)
        .map(p=>_.omit(p, qw`stats persist`))
        .map(p=>_.omitBy(p, v=>!v&&v!==0&&v!==false));
    let _defaults = _.pick(this.argv, _.keys(proxy_fields)
        .filter(f=>f!='config'));
    let s = stringify({proxies, _defaults}, {space: '  '});
    if (fs.existsSync(filename))
        fs.renameSync(filename, filename+'.backup');
    fs.writeFileSync(filename, s);
};

Manager.prototype.json = etask._fn(function*json(_this, opt){
    try {
        if (typeof opt=='string')
            opt = {url: opt};
        opt.json = true;
        let res = yield etask.nfn_apply(request, [opt]);
        _this._log.debug(`GET ${opt.url} - ${res.statusCode}`);
        return res;
    } catch(e){ ef(e);
        _this._log.debug(`GET ${opt.url} - ${e}`);
        throw e;
    }
});

Manager.prototype.archive_prefix = timestamp=>`Archive_${timestamp}_`;

Manager.prototype.schema_hash = schema=>crypto.createHash('md5')
.update(stringify(schema)).digest('hex');

Manager.prototype.archive_copy = etask._fn(
function*archive_copy(_this, timestamp, copy_ip){
    let prefix = _this.archive_prefix(timestamp);
    if (copy_ip)
    {
        yield _this.sql(`INSERT INTO ip(ip, timestamp) `
            +`SELECT ip, timestamp FROM ${prefix}ip`);
    }
    let existing_hash = '';
    try {
        existing_hash = (yield _this.sql(
            `SELECT hash FROM ${prefix}schema_info LIMIT 1`))[0].hash;
    } catch(e){ ef(e); }
    let current = -1;
    for (let index in db_history)
    {
        if (existing_hash==_this.schema_hash(db_history[index].schema))
        {
            current = index;
            break;
        }
    }
    if (current!=-1)
    {
        let src_fields = [], dest_fields = [];
        for (let field in db_history[current].schema.request)
        {
            let src_field = field;
            let dest_field = field;
            let omit = false;
            for (let c = current-1; c>=0; c--)
            {
                let d = db_history[c];
                if (d&&d.remove&&d.remove.request
                    &&d.remove.request[dest_field])
                {
                    omit = true;
                    break;
                }
                if (d&&d.rename&&d.rename.request
                    &&d.rename.request[dest_field])
                {
                    dest_field = d.rename.request[dest_field];
                }
            }
            if (omit)
                continue;
            src_fields.push(src_field);
            dest_fields.push(dest_field);
        }
        yield _this.sql(`INSERT INTO request(${dest_fields.join(',')}) `
            +`SELECT ${src_fields.join(',')} FROM ${prefix}request`);
    }
    for (let table of ['schema_info', 'ip', 'request'])
    {
        yield _this.sql(
            `ALTER TABLE ${prefix+table} RENAME TO ${prefix+table}_backup`);
    }
});

Manager.prototype.prepare_database = etask._fn(
function*prepare_database(_this){
    const sqlite = _this.argv.log=='DEBUG' ? sqlite3.verbose() : sqlite3;
    _this.db = {stmt: {}};
    yield etask.nfn_apply((fn, cb)=>_this.db.db = new sqlite.Database(fn, cb),
        null, [_this.argv.database]);
    let now = Date.now();
    let rows = yield _this.sql(
        'SELECT name FROM sqlite_master WHERE type="table"');
    let backup_expire = 30*86400*1000;
    for (let r of rows)
    {
        let m = r.name.match(/^Archive_(\d+)_.+_backup$/);
        if (m&&now-m[1]>backup_expire)
            yield _this.sql(`DROP TABLE ${r.name}`);
    }
    const tables = db_history[0].schema;
    const hash = _this.schema_hash(tables);
    try {
        let existing_hash = (yield _this.sql(`SELECT hash FROM schema_info
            LIMIT 1`))[0].hash;
        if (existing_hash==hash)
            return;
    } catch(e){ ef(e); }
    const prefix = _this.archive_prefix(now);
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
    }
    for (let table in tables)
    {
        const fields = [], queries = [];
        for (let field in tables[table])
        {
            let value = assign({}, tables[table][field]);
            if (typeof value=='string')
                value = {type: value};
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
        hash, pkg.version);
    let archive_timestamps = yield _this.archive_timestamps();
    for (let i in archive_timestamps)
        yield _this.archive_copy(archive_timestamps[i], i==0);
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
        pool_type: {values: ['', 'sequential', 'round-robin']},
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

Manager.prototype.create_proxy = etask._fn(
function*create_proxy(_this, proxy, iface){
    proxy = _.omitBy(proxy, v=>!v&&v!==0&&v!==false);
    let conf = assign({}, _.omit(_this.opts, 'port'), proxy);
    _this.proxy_validator(conf);
    let server = new Luminati(conf);
    server.on('response', res=>{
        server._log.debug(util.inspect(res, {depth: null, colors: 1}));
        let req = res.request;
        if (_this.argv.history)
        {
            let headers = res.headers||{};
            let proxy_info = qw`x-hola-timeline-debug x-hola-unblocker-debug`
                .map(h=>headers[h]||'')
                .map(h=>h.match(/(\d+\.\d+\.\d+\.\d+) ([^ ]+)/))
                .find(i=>i)||['', '', ''];
            let data = {
                port: server.port,
                url: req.url,
                method: req.method,
                request_headers: stringify(req.headers),
                request_body: req.body,
                response_headers: stringify(res.headers),
                status_code: res.status_code,
                timestamp: res.timeline.start,
                elapsed: res.timeline.end,
                response_time: res.timeline.response,
                node_latency: +((headers['x-hola-timeline-debug']||'')
                    .match(/(\d+) ?ms/)||[0, res.timeline.response])[1],
                proxy_peer: proxy_info[1],
                country: proxy_info[2],
                timeline: stringify(res.timeline),
                content_size: res.body_size,
            };
            if (res.proxy)
            {
                data.super_proxy = res.proxy.host;
                data.username = res.proxy.username;
            }
            if (_this.io)
                _this.io.emit(`history/${server.port}`, data);
            let row = {};
            for (let f in data)
                row['$'+f] = data[f];
            _this.db.stmt.history.run(row);
        }
    }).on('error', this.throw_fn());
    yield server.listen();
    proxy.port = server.port;
    _this._log.debug('local proxy', server.opt);
    _this.proxies[server.port] = proxy;
    _this.proxies_running[server.port] = server;
    server.stop = function(){
        const args = [].slice.call(arguments);
        delete _this.proxies[server.port];
        delete _this.proxies_running[server.port];
        return Luminati.prototype.stop.apply(server, args);
    };
    return server;
});

Manager.prototype.proxy_create = etask._fn(function*proxy_create(_this, data){
    let proxy = data.proxy;
    let server = yield _this.create_proxy(proxy);
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
    let server = yield _this.proxy_create(req.body);
    res.json({port: server.port});
});

Manager.prototype.proxy_update = etask._fn(
function*proxy_update(_this, req, res, next){
    let port = req.params.port;
    let old_proxy = _this.proxies[port];
    if (!old_proxy)
        throw `No proxy at port ${port}`;
    if (req.body.reset_total_stats)
    {
        _this.proxies_running[port].reset_total_stats();
        res.json({result: 'ok'});
        return;
    }
    if (!old_proxy.persist)
        throw 'This proxy is read-only';
    let proxy = assign({}, old_proxy, req.body.proxy);
    yield _this.proxy_delete(port);
    let server = yield _this.proxy_create({proxy: proxy});
    res.json({proxy: server.opts});
});

Manager.prototype.proxies_delete_api = etask._fn(
function*proxies_delete_api(_this, req, res, next){
    let ports = `${req.body.port||''}`.split(',');
    for (let p of ports)
        yield _this.proxy_delete(p.trim());
    res.status(204).end();
});

Manager.prototype.proxy_delete_api = etask._fn(
function*proxy_delete_api(_this, req, res, next){
    let port = req.params.port;
    yield _this.proxy_delete(port);
    res.status(204).end();
});

Manager.prototype.refresh_sessions = etask._fn(
function*refresh_sessions(_this, req, res, next){
    let port = req.params.port;
    let server = _this.proxies_running[port];
    if (!server)
        return res.status(400, 'Invalid proxy port').end();
    yield server.refresh_sessions();
    res.status(204).end();
});

Manager.prototype.test = function(req, res){
    const opt = assign(_.pick(req.body, qw`url method headers body`), {
        followRedirect: false,
    });
    if (+req.params.port)
    {
        opt.proxy = 'http://127.0.0.1:'+req.params.port;
        if (this.proxies_running[req.params.port].opt.ssl)
            opt.ca = fs.readFileSync(path.resolve(__dirname, '../bin/ca.crt'));
    }
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

Manager.prototype.proxy_ip = etask._fn(function*proxy_ip(_this, proxy){
    if (/^\d+\.\d+\.\d+\.\d+$/.test(proxy))
        return proxy;
    if (proxy.length==2)
        proxy = `servercountry-${proxy}.zproxy.luminati.io`;
    try {
        _this._log.debug('Resolving proxy domain: ', proxy);
        let ips = yield etask.nfn_apply(dns, '.resolve', [proxy]);
        return ips[0];
    } catch(e){
        _this._log.error('Failed to resolve proxy domain name: '+proxy, e);
        return null;
    }
});

Manager.prototype.country = etask._fn(
function*country(_this, req, res){
    if (!phantomjs)
    {
        res.status(500).send('PhantomJS package is not installed');
        return;
    }
    const c = req.query.country;
    const url = req.query.url;
    const path = req.query.path||phantomjs.path;
    if (!fs.existsSync(path))
    {
        res.status(500).send('The provided path to PhantomJS is incorrect');
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
        let proxy = yield _this.proxy_ip(_this.argv.proxy);
        webshot(url, '', {
            shotSize: {width: 'all', height: 'all'},
            phantomPath: path,
            phantomConfig: {
                proxy: `${proxy}:${_this.argv.proxy_port}`,
                'proxy-auth': `lum-customer-${_this.argv.customer}-zone-`
                    +`${_this.argv.zone}-country-${c}:${_this.argv.password}`,
            },
            customHeaders: headers,
            userAgent: ua,
        }).pipe(res);
    } catch(e){ res.status(502).send('An error occurred'); }
});

Manager.prototype.archive_timestamps = etask._fn(
function*archive_timestamps(_this){
    let rows = yield _this.sql(
        'SELECT name FROM sqlite_master WHERE type="table"');
    let timestamps = [];
    for (let r of rows)
    {
        let m = r.name.match(/^Archive_(\d+)_request$/);
        if (m)
            timestamps.push(+m[1]);
    }
    timestamps.sort().reverse();
    return timestamps;
});

Manager.prototype.archive_timestamps_get = etask._fn(
function*archive_timestamps_get(_this, req, res){
    let timestamps = yield _this.archive_timestamps();
    res.json({timestamps: timestamps});
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
    const table =
    (req.query.archive ? this.archive_prefix(req.query.archive) : '')
    +'request';
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
    if (req.query.super_proxy)
    {
        wheres.push('super_proxy LIKE $super_proxy');
        vars.$super_proxy = `%${req.query.super_proxy}%`;
    }
    if (req.query.proxy_peer)
    {
        wheres.push('proxy_peer LIKE $proxy_peer');
        vars.$proxy_peer = `%${req.query.proxy_peer}%`;
    }
    let query = `SELECT * FROM ${table} WHERE (${wheres.join(') AND (')})
        ORDER BY ${req.query.sort}${req.query.sort_desc ? ' DESC' : ''}
        LIMIT ${+req.query.count}`;
    db.all(query, vars, callback);
};

Manager.prototype.sessions_get = etask._fn(
function*sessions_get(_this, req, res){
    const port = req.params.port;
    if (req.query.refresh!==undefined)
        yield _this.proxies_running[port].update_all_sessions();
    let sessions = _this.proxies_running[port].sessions||[];
    res.json(sessions.map(s=>_.pick(s, qw`info count bandwidth created`)));
});

Manager.prototype.node_version = etask._fn(
function*node_version(_this, req, res){
    const check = yield etask.nfn_apply(check_node_version,
        [{node: pkg.recomendedNode}]);
    res.json({
        current: check.node.version,
        satisfied: check.nodeSatisfied,
        recommended: pkg.recomendedNode,
    });
});

Manager.prototype.last_version = etask._fn(
function*last_version(_this, req, res){
    const r = yield _this.json({
        url: 'https://raw.githubusercontent.com/luminati-io/'
            +'luminati-proxy/master/package.json',
    });
    res.json({version: r.body.version});
});

Manager.prototype.status = etask._fn(
function*status(_this, req, res){
    _this._log.debug('Testing proxy status');
    if (!_this.argv.customer)
    {
        return res.json({
            status: 'error',
            description: 'You need to provide your credentials.',
        });
    }
    let proxy = yield _this.proxy_ip(_this.argv.proxy);
    if (!proxy)
    {
        return res.json({
            status: 'error',
            description: `Failed to resolve proxy for ${_this.argv.proxy}.`,
            description_list: [
                'check your Internet connection',
            ],
       });
    }
    if (yield _this.check_credentials({proxy}))
    {
        return res.json({
            status: 'ok',
            description: 'Your proxy is up and running.',
        });
    }
    const ip = yield _this.get_ip();
    if (ip)
    {
        return res.json({
            status: 'error',
            description: 'Your proxy is not responding. '
                +'Please do the following:',
            description_list: [
                'check your credentials and make sure they are up to date',
                `check that your IP address (${ip}) is in the whitelist`,
            ],
        });
    }
    res.json({
        status: 'error',
        description: 'You do not have access to the Internet.',
    });
});

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

Manager.prototype.get_params = function(){
    const args = [];
    for (let k in this.argv)
    {
        if (qw`$0 h help version p`.includes(k))
            continue;
        if (this.argv[k]==_default[k])
            continue;
        if (boolean_fields.includes(k)||this.argv[k]===false)
        {
            args.push(`--${this.argv[k]?'':'no-'}${k}`);
            continue;
        }
        [].concat(this.argv[k]).forEach(v=>{
            if (k!='_')
                args.push('--'+k);
            args.push(v);
        });
    }
    return args;
};

Manager.prototype.get_settings = function(){
    return {
        customer: this.argv.customer,
        zone: this.argv.zone,
        password: this.argv.password,
        config: this.argv.config,
        resolve: this.argv.resolve,
        socks: !!_.values(this.proxies_running).find(p=>p.opt.socks),
        argv: (this.argv.config ? process.argv.slice(2) : this.get_params())
            .join(' '),
        history: this.argv.history,
        ssl: !!_.values(this.proxies_running).find(p=>p.opt.ssl),
    };
};

Manager.prototype.settings_get = function(req, res){
    res.json(this.get_settings());
};

Manager.prototype.config_get = function(req, res){
    res.json({config: file.exists(this.argv.config) ?
        file.read_e(this.argv.config) : ''});
};

Manager.prototype.config_set = function(req, res){
    file.write_e(this.argv.config, req.body.config);
    res.json({result: 'ok'});
    this.emit('config_changed');
};

Manager.prototype.resolve_get = function(req, res){
    if (!file.exists(this.argv.resolve))
    {
        res.status(404).json({error: 'Resolution file does not exist'});
        return;
    }
    res.json({resolve: file.read_e(this.argv.resolve)});
};

Manager.prototype.resolve_set = function(req, res){
    if (!file.exists(this.argv.resolve))
    {
        res.status(500).json({error: 'Resolution file does not exist'});
        return;
    }
    file.write_e(this.argv.resolve, req.body.resolve);
    res.json({result: 'ok'});
    this.emit('config_changed');
};

Manager.prototype.resolve_host = etask._fn(
function*resolve_host(_this, req, res){
    let host = req.params.host;
    try {
        let ips = yield etask.nfn_apply(dns, '.resolve', [host]);
        res.json({ips: ips});
    } catch(e){ res.json({ips: null}); }
});

Manager.prototype.get_ip = etask._fn(
function*get_ip(_this){
    try {
        const result = yield _this.json('http://lumtest.com/myip');
        return result.body;
    } catch(e){ ef(e); return false; }
});

Manager.prototype.check_credentials = etask._fn(
function*check_credentials(_this, cred){
    try {
        cred = assign({}, _this.argv, cred);
        _this._log.debug('Testing credentials:', cred);
        let res = yield _this.json({
            url: 'http://lumtest.com/myip.json',
            method: 'GET',
            proxy: `http://127.0.0.1:${default_port}`,
            timeout: 15000,
        });
        return res.statusCode==200;
    } catch(e){ ef(e); return false; }
});

Manager.prototype.creds_set = function(req, res){
    let cred = req.body;
    assign(this.argv, cred);
    this.save_config();
    res.json({result: 'ok'});
    this.emit('config_changed');
};

Manager.prototype.proxies_running_get = function(req, res){
    let ifaces = os.networkInterfaces();
    let iface_ips = {'0.0.0.0': []};
    for (let iface in ifaces)
    {
        iface_ips[iface] = [];
        for (let item of ifaces[iface])
        {
            if (item.family=='IPv4'&&!item.internal)
            {
                let info = {iface: iface, ip: item.address};
                iface_ips[iface].push(info);
                iface_ips['0.0.0.0'].push(info);
            }
        }
    }
    res.json(_.values(this.proxies_running).map(p=>{
        let proxy = _.cloneDeep(p.opt);
        proxy._stats = p.stats;
        proxy._iface_ips = iface_ips[proxy.iface]||[];
        return proxy;
    }));
};

Manager.prototype.create_api_interface = function(){
    const app = express();
    app.get('/proxies_running', this._api(this.proxies_running_get));
    app.get('/version', this._api((req, res)=>res.json(
        {version: pkg.version})));
    app.get('/last_version', this._api(this.last_version));
    app.get('/node_version', this._api(this.node_version));
    app.get('/consts', this._api(this.get_consts));
    app.get('/defaults', this._api((req, res)=>res.json(this.opts)));
    app.get('/proxies', this._api((req, res)=>res.json(
        _.values(this.proxies))));
    // XXX stanislav: can be removed in favor of post('proxies')
    const proxy_create_api = this._api(this.proxy_create_api);
    app.post('/create', proxy_create_api);
    app.post('/proxies', proxy_create_api);
    app.put('/proxies/:port', this._api(this.proxy_update));
    app.post('/delete', this._api(this.proxies_delete_api));
    app.delete('/proxies/:port', this._api(this.proxy_delete_api));
    app.post('/refresh_sessions/:port', this._api(this.refresh_sessions));
    app.post('/test/:port', this._api(this.test));
    app.get('/country', this._api(this.country));
    app.get('/archive_timestamps', this._api(this.archive_timestamps_get));
    app.get('/history/:port', this._api(this.history_get));
    app.get('/har/:port', this._api(this.har_get));
    app.get('/sessions/:port', this._api(this.sessions_get));
    app.get('/status', this._api(this.status));
    app.get('/stats', this._api(this.stats));
    app.get('/whitelist', this._api(this.whitelist));
    app.get('/recent_ips', this._api(this.recent_ips));
    app.get('/settings', this._api(this.settings_get));
    app.post('/creds', this._api(this.creds_set));
    app.get('/config', this._api(this.config_get));
    app.post('/config', this._api(this.config_set));
    app.get('/resolve', this._api(this.resolve_get));
    app.post('/resolve', this._api(this.resolve_set));
    app.get('/resolve_host/:host', this._api(this.resolve_host));
    app.post('/shutdown', this._api((req, res)=>{
        res.json({result: 'ok'});
        this.stop(true);
    }));
    app.post('/upgrade', this._api((req, res)=>{
        sudo_prompt.exec(
            'npm install -g luminati-io/luminati-proxy'
            +(is_win ? ' && luminati-proxy' : ''),
            {name: 'Luminati Proxy Manager'}, function(error){
            if (error)
                res.status(500).json({error: error});
            else
            {
                child_process.fork(process.argv[1], process.argv.slice(2),
                    {detached: true});
                res.json({result: 'ok'});
                process.exit();
            }
        });
        if (is_win)
        {
            setTimeout(function(){
                res.json({result: 'ok'});
                process.exit();
            }, 5000);
        }
    }));
    app.post('/block', this._api((req, res, next)=>etask(function*block(){
        assert(req.body.ip, 'missing ip');
        let ips = [];
        [].concat(req.body.ip).forEach(ip=>{
            const block = new netmask.Netmask(ip);
            block.forEach((ip, long)=>ips.push(long));
        });
        yield this.sql(`INSERT INTO ip(ip) VALUES(${ips.join(',')})`);
        res.json({count: ips.length});
    })));
    return app;
};

Manager.prototype.create_web_interface = etask._fn(
function*create_web_interface(_this){
    const app = express();
    const server = http.Server(app);
    http_shutdown(server);
    _this.io = socket_io(server);
    app.use(body_parser.urlencoded({extended: true}));
    app.use(body_parser.json());
    app.use('/api', _this.create_api_interface());
    app.get('/ssl', _this._api((req, res)=>{
        res.set('content-type', 'application/x-x509-ca-cert');
        res.set('content-disposition', 'filename=luminati.crt');
        res.send(ssl.ca.cert);
    }));
    app.use((req, res, next)=>{
        res.locals.path = req.path;
        next();
    });
    app.get(/^\/?$/, (req, res)=>{
        res.redirect('/settings');
    });
    app.get(/^\/((settings|proxies|tools|faq)|zones(\/[^\/]+)?)$/,
        (req, res, next)=>{
        req.url = '/index.html';
        next('route');
    });
    let files;
    app.get('/react', (req, res, next)=>{
        if (req.url=='/react')
            return res.redirect('/react/');
        next();
    });
    app.use('/react', express()
        .get('/app.js', _this._api((req, res, next)=>etask(function*(){
            if (!files)
            {
                files = new memoryfs();
                const compiler = webpack({
                    entry: {app: path.resolve(__dirname,
                        '../bin/pub/react/app.jsx')},
                    output: {
                        path: '/',
                        chunkFilename: '[name].js',
                        filename: '[name].js',
                    },
                    module: {loaders: [
                        {test: /\.jsx?$/, exclude: /node_modules/,
                            loader: 'babel', query: {
                                presets: ['react', 'es2015', 'stage-2'],
                                plugins: ['transform-class-properties',
                                    'transform-decorators-legacy'],
                            },
                        },
                        {test: /\.css$/, loader: 'style-loader!css-loader'},
                        {test: /\.eot(\?v=\d+\.\d+\.\d+)?$/, loader: 'file'},
                        {test: /\.(woff|woff2)$/,
                            loader: 'url?prefix=font/&limit=5000'},
                        {test: /\.ttf(\?v=\d+\.\d+\.\d+)?$/,
                            loader: 'url?limit=10000&mimetype='+
                                'application/octet-stream'},
                        {test: /\.svg(\?v=\d+\.\d+\.\d+)?$/,
                            loader: 'url?limit=10000&mimetype=image/svg+xml'},
                    ]},
                    plugins: [
                        new webpack.DefinePlugin({'process.env.NODE_ENV':
                            '"production"'}),
                        new webpack.ProvidePlugin({React: 'react'}),
                        new webpack.optimize.UglifyJsPlugin({warnings: false}),
                    ],
                    resolve: {alias: {
                        react: 'react-lite',
                        'react-dom': 'react-lite',
                    }},
                });
                compiler.outputFileSystem = files;
                const stats = yield etask.nfn_apply(compiler, '.run', []);
                if (stats.hasErrors())
                    throw new Error(stats.toString('normal'));
            }
            res.set('Content-Type', 'application/javascript');
            res.send(files.readFileSync('/app.js'));
        })))
        .get('*', (req, res, next)=>res.sendFile(path.resolve(__dirname,
            '../bin/pub/react/index.html')))
    );
    app.use(express.static(path.resolve(__dirname, '../bin/pub')));
    app.use('/req', express.static(path.resolve(__dirname,
        '../node_modules')));
    app.use(function(err, req, res, next){
        _this._log.error(err.stack);
        res.status(500).send('Server Error');
    });
    _this.io.on('error',
        err=>_this._log.error('SocketIO error', {error: err}));
    setInterval(()=>{
        let stats = _.mapValues(_this.proxies_running, 'stats');
        _this.io.emit('stats', stats);
    }, 1000);
    server.on('error', err=>{
        _this.emit('error', err);
        this.throw(err);
    });
    server.stop = force=>etask(function*(){
        const stop_method = force ? '.forceShutdown' : '.shutdown';
        return yield etask.nfn_apply(server, stop_method, []);
    });
    yield etask.cb_apply(server, '.listen', [_this.argv.www,
        find_iface(_this.argv.iface)||'0.0.0.0']);
    return server;
});

Manager.prototype.create_socks_servers = etask._fn(
function*create_socks_servers(_this){
    const socks = [].concat(_this.argv.socks||[]).map(ports=>{
        ports = (''+ports).split(':');
        return {
            local: +ports[0],
            remote: +ports[1]||_this.argv.port,
            iface: _this.argv.iface,
            log: _this.argv.log,
        };
    }).filter(ports=>{
        for (let c of _this.config)
        {
            if (c.port==ports.remote)
            {
                c.socks = ports.local;
                _this._log.debug(
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
    let proxies = _this.config.map(c=>_this.create_proxy(c));
    if (!_this.argv.no_dropin)
    {
        proxies.push(_this.create_proxy({port: default_port, sticky_ip: true,
            allow_proxy_auth: true, socks: false}));
    }
    yield etask.all(proxies);
});

Manager.prototype.start = etask._fn(function*start(_this){
    try {
        yield _this.prepare_database();
        if (_this.argv.history)
        {
            _this.db.stmt.history = _this.db.db.prepare(`INSERT INTO request (
                port, url, method, request_headers, request_body,
                response_headers, status_code, timestamp, elapsed,
                response_time, node_latency, country, timeline, super_proxy,
                proxy_peer, username, content_size) VALUES
                ($port, $url, $method, $request_headers, $request_body,
                $response_headers, $status_code, $timestamp, $elapsed,
                $response_time, $node_latency, $country, $timeline,
                $super_proxy, $proxy_peer, $username, $content_size)`);
        }
        yield _this.create_socks_servers();
        if (_this.argv.customer)
            yield _this.init_proxies();
        if (_this.argv.www)
        {
            _this.www_server = yield _this.create_web_interface();
            let port = _this.www_server.address().port;
            console.log(`admin is available at http://127.0.0.1:${port}`);
        }
    } catch(e){ ef(e);
        if (e.message!='canceled')
            _this._log.error(e, e.stack);
    }
});
