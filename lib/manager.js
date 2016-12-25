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
const json2csv = require('json2csv');
const log = require('./log.js');
const http_shutdown = require('http-shutdown');
const Luminati = require('./luminati.js');
const Socks = require('./socks.js');
const ssl = require('./ssl.js');
const find_iface = require('./find_iface.js');
const pkg = require('../package.json');
const swagger = require('./swagger.json');
const request = require('request');
const http = require('http');
const netmask = require('netmask');
const hutil = require('hutil');
const util = require('util');
const is_win = process.platform=='win32';
const sqlite3 = require('sqlite3');
const stringify = require('json-stable-stringify');
const country_language = require('country-language');
const yargs = require('yargs/yargs');
const db_history = require('./db_history.json');
const check_node_version = require('check-node-version');
const semver = require('semver');
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
const E = module.exports = Manager;

const prop_by_type = (def, type)=>_.toPairs(def.properties)
    .filter(p=>p[1].type==type).map(p=>p[0]);

const proxy_fields = assign({}, swagger.definitions.proxy.properties,
    swagger.definitions.manager.properties);
const added_descriptions = {
    'no-www': 'Disable local web',
    'no-config': 'Working without a config file',
    daemon: 'Start as a daemon',
    'stop-daemon': 'Stop running daemon',
};
swagger.info.version = pkg.version;
const numeric_fields = prop_by_type(swagger.definitions.proxy, 'integer');
const boolean_fields = prop_by_type(swagger.definitions.proxy, 'boolean');
const _default = E.default = assign({}, Luminati.default, {
    max_requests: 50,
    pool_size: 3,
    proxy_switch: 5,
    www: 22999,
    config: path.resolve(os.homedir(),
        '.luminati.json'.substr(is_win ? 1 : 0)),
    database: path.resolve(os.homedir(),
        '.luminati.sqlite3'.substr(is_win ? 1 : 0)),
    history: false,
    mode: 'root',
});
const default_port = 22225;
const PROXY_INTERNAL_BYPASS = qw`google.com luminati.io`;
const PROXY_ONLY_BYPASS = qw`googleapis.com cdnjs.com gstatic.com google.co.*
    googleusercontent.com google.* luminati.io hwcdn.net lumtest.com`;

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

function Manager(args, run_config){
    events.EventEmitter.call(this);
    this.argv = {log: _default.log};
    this.run_config = run_config||{};
    if (!this.run_config.id)
        this.run_config.id = +new Date();
    this.db = {};
    this.proxies_running = {};
    this.socks_servers = {};
    this.config = [];
    args = args.map(String);
    let _yargs = yargs(args);
    _yargs.usage('Usage: $0 [options] config1 config2 ...')
    .options(proxy_fields)
    .describe(added_descriptions)
    .number(numeric_fields)
    .default(_default).help('h')
    .alias({'help': ['h', '?'], port: 'p', daemon: 'd', 'version': 'v'})
    .version(()=>`luminati-proxy version: ${pkg.version}`);
    this._defaults = load_json(_yargs.argv.config, true, {})._defaults||{};
    _yargs.config(this._defaults);
    this.mode = _yargs.argv.mode;
    if (!['root', 'normal', 'guest'].includes(this.mode))
    {
        console.log(`Unrecognized UI mode (${this.mode}); treating as guest`);
        this.mode = 'guest';
    }
    this.argv = _yargs.argv;
    this._log = log(this.argv.www||'MNGR', this.argv.log);
    this._log.info('Manager started', pkg.version);
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
    this.proxy_cache = {
        get: this.proxies_cache_get.bind(this),
        add: this.proxies_cache_add.bind(this),
        remove: this.proxies_cache_remove.bind(this),
    };
    this.history_aggregator = data=>{
        this._log.silly('Added to history', data);
        let row = {};
        for (let f in data)
            row['$'+f] = data[f];
        this.db.stmt.history.run(row);
    };
    this.config = load_config(this.argv.config, true).map(conf=>assign(conf,
        {proxy_type: 'persist'}));
    this.config = this.config.concat.apply(this.config, this.argv._.map(
        filename=>load_config(filename)).map(conf=>assign(conf,
        {proxy_type: 'config'})));
    this.config = this.config.length && this.config
        || [{proxy_type: 'persist'}];
    this.config.filter(conf=>!conf.port)
        .forEach((conf, i)=>assign(conf, {port: this.argv.port+i}));
    this._log.debug('Config', this.config);
}

util.inherits(Manager, events.EventEmitter);

E.prototype._api = function(f, roles){
    const _this = this;
    return (req, res, next)=>etask(function*_api(){
        _this._log.debug('API access', req.method, req.originalUrl, req.body);
        this.finally(()=>{
            if (this.error)
            {
                _this._log.warn('API error:',
                    {url: req.url, error: this.error});
                return next(this.error);
            }
        });
        if (roles&&!roles.includes(_this.mode))
            res.json({request_disallowed: true});
        else
            yield f.call(_this, req, res, next);
    });
};

E.prototype.stop_servers = etask._fn(function*(_this, force, www){
    _this._log.debug('Stopping servers');
    let servers = [];
    const stop_server = server=>servers.push(etask(function*(){
        try {
            yield server.stop(force);
        } catch(e){
            _this._log.error('Failed to stop server: '+e.message, {server:
                server, error: e});
        }
    }));
    if (www && _this.www_server)
        stop_server(_this.www_server);
    _.values(_this.socks_servers).forEach(stop_server);
    _.values(_this.proxies_running).forEach(stop_server);
    yield etask.all(servers);
    _this._log.debug('Servers stopped');
});

E.prototype.stop = etask._fn(
function*stop(_this, reason, force, restart){
    yield _this.stop_servers(force, true);
    if (_this.db)
    {
        _this.db.db.close(()=>this.continue());
        yield this.wait();
    }
    _this._log.info('Manager stopped', {reason, force, restart});
    if (!restart)
        _this.emit('stop', reason);
});

E.prototype.sql = function sql(){
    const args = [].slice.call(arguments);
    const db = this.db.db;
    this._log.debug('SQL: '+args[0], args.slice(1));
    return etask(function*sql(){
        return yield etask.nfn_apply(db, '.all', args); });
};

E.prototype.har = function(entries){
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

E.prototype.save_config = function(){
    let filename = this.argv.config;
    if (!filename)
        return;
    let proxies = this.config
        .map(p=>_.omit(p, qw`stats proxy_type`))
        .map(p=>_.omitBy(p, v=>!v && v!==0 && v!==false));
    let _defaults = _.pick(this._defaults, _.keys(proxy_fields)
        .filter(f=>f!='config'));
    let s = stringify({proxies, _defaults}, {space: '  '});
    if (fs.existsSync(filename))
        fs.renameSync(filename, filename+'.backup');
    fs.writeFileSync(filename, s);
};

E.prototype.json = etask._fn(function*json(_this, opt){
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

E.prototype.archive_prefix = timestamp=>`Archive_${timestamp}_`;

E.prototype.schema_hash = schema=>crypto.createHash('md5')
    .update(stringify(schema)).digest('hex');

E.prototype.archive_copy = etask._fn(
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
                let add = d.add&&d.add.request;
                if (add&&add.includes(dest_field))
                    omit = false;
                let remove = d.remove&&d.remove.request;
                if (remove&&remove.includes(dest_field))
                    omit = true;
                let rename = d.rename&&d.rename.request;
                if (rename&&rename[dest_field])
                    dest_field = d.rename.request[dest_field];
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
        try {
            yield _this.sql(`ALTER TABLE ${prefix+table}
                RENAME TO ${prefix+table}_backup`);
        } catch(e){ ef(e);
            _this._log.warn(`Was not able to rename old table ${prefix+table},`
                +' this may lead to duplication of that table data.');
            _this._log.silly(e, e.stack);
        }
    }
});

E.prototype.prepare_database = etask._fn(
function*prepare_database(_this){
    const sqlite = _this.argv.log=='DEBUG' ? sqlite3.verbose() : sqlite3;
    _this.db = {stmt: {}};
    yield etask.nfn_apply((fn, cb)=>_this.db.db = new sqlite.Database(fn, cb),
        null, [_this.argv.database]);
    let city_path = path.resolve(__dirname, '../db/city.db');
    if (file.exists(city_path))
    {
        yield etask.nfn_apply((fn, cb)=>_this.cities_db =
            new sqlite.Database(fn, cb), null, [city_path]);
    }
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
        yield _this.archive_copy(archive_timestamps[i], !i);
});

let get_countries = (db, cb)=>{
    let query = 'SELECT * FROM countries ORDER BY name';
    return void db.all(query, [], (err, rows)=>cb((rows||[]).map(x=>
        ({key: x.name, value: x.country_id.toLowerCase()}))));
};

E.prototype.get_consts = function(req, res){
    let proxy = _.mapValues(proxy_fields, desc=>({desc: desc})), _this = this;
    _.forOwn(_default, (def, prop)=>{
        if (proxy[prop])
            proxy[prop].def = def;
    });
    _.merge(proxy, {
        dns: {values: ['', 'local', 'remote']},
        pool_type: {values: [''].concat(_.keys(Luminati.pool_types))},
        debug: {values: ['', 'none', 'full']},
        iface: {values: [''].concat(_.keys(os.networkInterfaces()))},
        log: {def: this.opts.log, values: [''].concat(_.keys(
            log.log_level))},
    });
    get_countries(_this.cities_db, countries=>{
        countries.forEach(c=>c.key=`${c.key} (${c.value.toUpperCase()})`);
        countries.unshift({key: 'Any', value: '*'});
        countries.unshift({key: 'Default ('+(_this.opts.country||'Any')+')',
            value: ''});
        proxy.country = {values: countries};
        res.json({proxy: proxy});
    });
};

E.prototype.get_history_context = etask._fn(
function*get_history_context(_this, req, res){
    let $port = req.params.port;
    let contexts = yield _this.sql(`SELECT DISTINCT context FROM request
        WHERE context IS NOT NULL AND port = $port`, {$port})||[];
    res.json(contexts.map(c=>({key: c.context, value: c.context})));
});

E.prototype.proxy_validator = function(conf){
    conf.customer = conf.customer||this.argv.customer;
    conf.password = conf.password||this.argv.password;
    conf.proxy_count = conf.proxy_count||this.argv.proxy_count;
    conf.proxy = [].concat(conf.proxy||this.argv.proxy);
    numeric_fields.forEach(field=>{
        if (conf[field])
            conf[field] = +conf[field];
    });
};

E.prototype.error_handler = function error_handler(source, err){
    if (!err.raw)
    {
        this._log.error(source+' error', err);
        this._log.silly(err, err.stack);
    }
    this.emit('error', err);
};

E.prototype.create_single_proxy = etask._fn(
function*create_single_proxy(_this, conf){
    let server = new Luminati(conf);
    server.on('error', err=>_this.error_handler('Proxy '+conf.port, err));
    yield server.listen();
    _this._log.debug('local proxy', _.omit(server.opt, qw`proxy_cache
        history_aggregator`));
    _this.proxies_running[server.port] = server;
    return server;
});

const nop = ()=>{};

E.prototype.create_proxy = etask._fn(
function*create_proxy(_this, proxy){
    proxy = _.omitBy(proxy, v=>!v && v!==0 && v!==false);
    let conf =
        assign({
            proxy_cache: _this.proxy_cache,
            history_aggregator: _this.history_aggregator,
            proxy_internal_bypass: PROXY_INTERNAL_BYPASS,
        }, _.omit(_this.opts, qw`port socks`), proxy);
    if (!_this.logged_in)
    {
        conf.only_bypass = PROXY_ONLY_BYPASS;
        conf.pool_size = 0;
    }
    _this.proxy_validator(conf);
    let proxies = [conf];
    let multiply = conf.multiply || 1;
    for (let i=1; i < multiply; i++)
    {
        let dup = assign({}, conf, {
            proxy_type: 'duplicate',
            duplicate_index: i,
        });
        if (conf.port)
            dup.port = conf.port + i;
        if (conf.socks)
            dup.socks = conf.socks + i;
        proxies.push(dup);
    }
    let servers = yield etask.all(proxies.map(
        c=>_this.create_single_proxy(c)));
    let server = servers[0];
    server.duplicates = servers;
    servers.forEach(s=>s.stop = nop);
    server.stop = ()=>etask(function*(){
        const args = [].slice.call(arguments);
        _this._log.info('Stopping proxies', servers.map(s=>s.port));
        return yield etask.all(servers.map(s=>{
            delete _this.proxies_running[s.port];
            return Luminati.prototype.stop.apply(s, args);
        }));
    });
    return server;
});

E.prototype.proxy_create = etask._fn(function*proxy_create(_this, data){
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
    if (proxy.type = 'persist')
    {
        _this.config.push(proxy);
        _this.save_config();
    }
    return server;
});

E.prototype.proxy_delete = etask._fn(function*proxy_delete(_this, port){
    let server = _this.proxies_running[port];
    if (!server)
        return;
    if (server.timer)
        clearTimeout(server.timer);
    yield server.stop();
    if (server.opt.proxy_type == 'persist')
    {
        let idx = _this.config.findIndex(p=>p.port==port);
        if (idx==-1)
            return;
        _this.config.splice(idx, 1);
        _this.save_config();
    }
});

E.prototype.proxy_create_api = etask._fn(
function*proxy_create_api(_this, req, res){
    let port = +req.body.proxy.port;
    let errors = yield _this.proxy_check({port: port});
    if (errors.length)
        return res.status(400).json({errors: errors});
    let server = yield _this.proxy_create(req.body);
    res.json({data: server.opt});
});

E.prototype.proxy_update_api = etask._fn(
function*proxy_update_api(_this, req, res){
    let old_port = req.params.port;
    let old_proxy = _this.config.find(p=>p.port==old_port);
    if (!old_proxy)
        throw `No proxy at port ${old_port}`;
    if (req.body.reset_total_stats)
    {
        _this.proxies_running[old_port].reset_total_stats();
        return res.json({result: 'ok'});
    }
    if (old_proxy.proxy_type != 'persist')
        throw 'This proxy is read-only';
    let port = +req.body.proxy.port;
    if (port!==undefined)
    {
        let errors = yield _this.proxy_check({port: port}, old_port);
        if (errors.length)
            return res.status(400).json({errors: errors});
    }
    let proxy = assign({}, old_proxy, req.body.proxy);
    yield _this.proxy_delete(old_port);
    let server = yield _this.proxy_create({proxy: proxy});
    res.json({data: server.opt});
});

E.prototype.proxies_delete_api = etask._fn(
function*proxies_delete_api(_this, req, res){
    let ports = `${req.body.port||''}`.split(',');
    for (let p of ports)
        yield _this.proxy_delete(p.trim());
    res.status(204).end();
});

E.prototype.proxy_delete_api = etask._fn(
function*proxy_delete_api(_this, req, res){
    let port = req.params.port;
    yield _this.proxy_delete(port);
    res.status(204).end();
});

E.prototype.refresh_sessions = etask._fn(
function*refresh_sessions(_this, req, res){
    let port = req.params.port;
    let server = _this.proxies_running[port];
    if (!server)
        return res.status(400, 'Invalid proxy port').end();
    yield server.refresh_sessions();
    res.status(204).end();
});

E.prototype.proxy_status_get = etask._fn(
function*proxy_status_get(_this, req, res){
    const max_wait = 20;
    const period = 1000;
    let port = req.params.port;
    let proxy = _this.proxies_running[port];
    if (!proxy)
    {
        res.json({'status': 'Unknown proxy'});
        return;
    }
    if (proxy.status)
    {
        res.json({status: proxy.status});
        return;
    }
    if (proxy.status===null)
    {
        const limit = max_wait+2;
        let cnt = 0;
        let check = ()=>{
            if (proxy.status===null)
            {
                cnt++;
                if (cnt <= limit)
                    setTimeout(check, period);
                else
                    res.json({status: 'Unexpected lock on status check.'});
            }
            else
                res.json({status: proxy.status});
        };
        check();
    }
    else
    {
        proxy.status = null;
        let success = false;
        try {
            let r = yield _this.json({
                url: 'http://lumtest.com/myip.json',
                method: 'GET',
                proxy: `http://127.0.0.1:${port}`,
                timeout: max_wait*1000,
                headers: {
                    'x-hola-context': 'STATUS CHECK',
                }
            });
            success = r.statusCode==200;
        } catch(e){ ef(e); }
        proxy.status = success ? 'ok' : 'the proxy is not working properly';
        res.json({status: proxy.status});
    }
});

E.prototype.proxy_port_check = etask._fn(
function*proxy_port_check(_this, port, duplicate, old_port, old_duplicate){
    duplicate = duplicate || 1;
    let start = port;
    let end = port + duplicate -1;
    const old_end = old_port && old_port + (old_duplicate||1) -1;
    let ports = [];
    for (let p = start; p <= end; p++)
    {
        if (old_port && old_port <= p && p <= old_end)
            continue;
        if (p == _this.argv.www)
            return p + ' in use by the UI/API';
        if (_this.proxies_running[p])
            return p + ' in use by another proxy';
        if (_.values(_this.proxies_running).map(p=>p.opt.socks).includes(p))
            return p + ' in use by another proxy SOCKS port';
        if (_this.argv.socks && _this.argv.socks.map(s=>s.split(':'[0])
            .includes(p)))
        {
            return p + ' in use by SOCKS interface';
        }
        ports.push(p);
    }
    try {
        yield etask.all(ports.map(p=>etask(function*(){
            const server = http.createServer();
            server.on('error', e=>{
                if (/EADDRINUSE/i.test(e.message))
                    this.throw(new Error(p + ' in use by another app'));
                this.throw(new Error(e));
            });
            http_shutdown(server);
            server.listen(p, '127.0.0.1', this.continue_fn());
            yield this.wait();
            yield etask.nfn_apply(server, '.forceShutdown', []);
        })));
    } catch(e){ ef(e);
        return e.message;
    }
});

const check = v=>v!==undefined&&v!==0&&v!=='0';

E.prototype.proxy_check = etask._fn(
function*proxy_check(_this, new_proxy_config, old_proxy_port){
    let old_proxy = old_proxy_port && _this.proxies_running[old_proxy_port]
        && _this.proxies_running[old_proxy_port].opt || {};
    let info = [];
    let port = new_proxy_config.port;
    let debug = new_proxy_config.debug;
    let zone = new_proxy_config.zone;
    let password = new_proxy_config.password;
    let history = new_proxy_config.history;
    let ssl = new_proxy_config.ssl;
    let socks = new_proxy_config.socks;
    let multiply = new_proxy_config.multiply;
    let null_response = new_proxy_config.null_response;
    let bypass_proxy = new_proxy_config.bypass_proxy;
    let direct_include = new_proxy_config.direct_include;
    let direct_exclude = new_proxy_config.direct_exclude;
    let max_requests = check(new_proxy_config.max_requests);
    let session_duration = check(new_proxy_config.session_duration);
    let keep_alive = check(new_proxy_config.keep_alive);
    let pool_size = check(new_proxy_config.pool_size);
    let sticky_ip = new_proxy_config.sticky_ip;
    let session = check(new_proxy_config.session);
    if (port!==undefined)
    {
        if (!port)
            info.push({msg: 'invalid port', lvl: 'err', field: 'port'});
        else
        {
            let in_use = yield _this.proxy_port_check(port, multiply,
                old_proxy_port, old_proxy.multiply);
            if (in_use)
            {
                info.push({msg: 'port '+in_use, lvl: 'err',
                    field: 'port'});
            }
        }
    }
    let invalid_zone;
    let db_zone;
    if (zone!==undefined)
    {
        let info_length = info.length;
        // XXX dmitryk load actual zones from luminati.io
        let zones = yield _this.sql('SELECT * FROM zone');
        if (zones.length)
        {
            db_zone = zones.filter(i=>i.zone==zone)[0];
            if (!db_zone)
            {
                info.push({msg: 'the provided zone name is not valid.',
                    lvl: 'err', field: 'zone'});
            }
            else if (db_zone.ips==='')
            {
                info.push({msg: 'the zone has no IPs in whitelist',
                    lvl: 'err', field: 'zone'});
            }
            else if (db_zone.plans)
            {
                if (JSON.parse(db_zone.plans).pop().disable)
                {
                    info.push({msg: 'the zone is disabled',
                        lvl: 'err', field: 'zone'});
                }
            }
        }
        invalid_zone = info.length>info_length;
    }
    if (zone==='gen'&&password)
    {
        info.push({msg: 'the password field is absent for default zone',
            lvl: 'err', field: 'password'});
    }
    else if (zone!==undefined && password && !invalid_zone)
    {
        if (!(yield _this.check_credentials({zone, password})).result)
        {
            info.push({msg: 'the provided password is not valid',
                lvl: 'err', field: 'password'});
        }
    }
    if (!invalid_zone && db_zone)
    {
        let perms = db_zone.perm.split(' ');
        ['country', 'state', 'city', 'asn', 'ip'].forEach(field=>{
            if (new_proxy_config[field]!==undefined
                && new_proxy_config[field].length && !perms.includes(field))
            {
                info.push({msg: `the zone doesn't have permissions for `
                    +field+' field', lvl: 'err', field});
            }
        });
    }
    if (debug!==undefined)
    {
        if (!['', 'none', 'full'].includes(debug))
            info.push({msg: 'invalid value', lvl: 'err', field: 'debug'});
    }
    if (history!==undefined && ssl!==undefined && history && !ssl)
    {
        info.push({
            msg: 'history without SSL sniffing will not record '
            +'HTTPS requests in full, it will only record the CONNECT '
            +'request',
            lvl: 'warn',
        });
    }
    if (socks!==undefined && !_this.opts.resolve)
    {
        let in_use = yield _this.proxy_port_check(socks, multiply,
            old_proxy.socks, old_proxy.multiply);
        if (in_use)
        {
            info.push({msg: 'socks port '+in_use, lvl: 'err',
                field: 'socks'});
        }
        info.push({
            msg: 'SOCKS without using a resolve file will make '
            +'HTTPS requests from the super proxy and not from the '
            +'proxy peer',
            lvl: 'warn',
        });
    }
    if ((null_response||bypass_proxy||direct_include||direct_exclude) &&
        ssl!==undefined && !ssl)
    {
        info.push({
            msg: 'Special URL handling without SSL sniffing will '
            +'only be able to handle HTTPS domains, and not specific '
            +'URLs',
            lvl: 'warn',
        });
    }
    if ((max_requests||session_duration) && !pool_size && !sticky_ip)
    {
        info.push({
            msg: 'max_requests, session_duration will not take effect '
            +'without specifying pool_size or sticky_ip',
            lvl: 'warn',
        });
    }
    if (keep_alive && !pool_size && !sticky_ip && !session)
    {
        info.push({
            msg: 'keep_alive will not take effect without specifying '
            +'pool_size, sticky_ip or session',
            lvl: 'warn',
        });
    }
    if (pool_size && (sticky_ip || session))
    {
        info.push({
            msg: 'sticky_ip and session will not take effect when pool_size '
            +'is specified',
            lvl: 'warn',
        });
    }
    if (!pool_size && sticky_ip && session)
    {
        info.push({
            msg: 'session will take effect when sticky_ip is specified',
            lvl: 'warn',
        });
    }
    return info;
});

E.prototype.proxy_check_api = etask._fn(
function*proxy_check_put(_this, req, res){
    let info = yield _this.proxy_check(req.body, +req.params.port);
    res.json(info);
});

E.prototype.test = function(req, res){
    const opt = assign(_.pick(req.body, qw`url method headers body`), {
        followRedirect: false,
    });
    if (+req.params.port)
    {
        opt.proxy = 'http://127.0.0.1:'+req.params.port;
        if (this.proxies_running[req.params.port].opt.ssl)
            opt.ca = ssl.ca.cert;
        opt.headers = opt.headers||{};
        opt.headers['x-hola-context'] = opt.headers['x-hola-context']
            ||'PROXY TESTER TOOL';
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

E.prototype.proxy_ip = etask._fn(function*proxy_ip(_this, proxy){
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

E.prototype.country = etask._fn(function*country(_this, req, res){
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

E.prototype.archive_timestamps = etask._fn(function*archive_timestamps(_this){
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

E.prototype.history_get = etask._fn(function*history_get(_this, req, res){
    let result = yield _this.filtered_get(req);
    res.json(result);
});

E.prototype.get_regions = function(req, res){
    let c_id = req.params.country_id, _this = this;
    if (!c_id || !this.cities_db)
        return res.json([]);
    let query = 'SELECT * FROM regions WHERE (country_id = ?)'
        +' ORDER BY region_id ASC';
    this.cities_db.all(query, [c_id], (err, rows)=>{
        let d = (rows||[]).map(x=>{
            return {key: `${x.name} (${x.region_id.toUpperCase()})`,
                value: x.region_id};
        });
        d.unshift({key: 'Any', value: '*'});
        d.unshift({key: 'Default ('+(_this.opts.state||'Any')+')', value: ''});
        res.json(d);
    });
};

E.prototype.get_cities = function(req, res){
    let c_id = req.params.country_id, r_id = req.params.region_id;
    let _this = this;
    if (!c_id || !this.cities_db)
        return res.json([]);
    let where = 'country_id = ?'+(r_id ? ' AND region_id = ?' : '');
    let query = 'SELECT * FROM cities WHERE ('+where+') ORDER BY name ASC';
    this.cities_db.all(query, [c_id, r_id], (err, rows)=>{
        let d = (rows||[]).map(x=>({key: x.name, value: x.name,
            region: x.region_id}));
        d.unshift({key: 'Any', value: '*'});
        d.unshift({key: 'Default ('+(_this.opts.city||'Any')+')', value: ''});
        res.json(d);
    });
};

E.prototype.get_free_port = function(req, res){
    const server = http.createServer();
    server.listen(0, ()=>{
        res.send(server.address().port.toString());
        server.close();
    });
};

E.prototype.get_zones = etask._fn(function*get_zones(_this, req, res){
    const zones = {};
    (yield _this.sql('SELECT * FROM zone')).forEach(row=>{
        zones[row.zone] = {perm: row.perm};
    });
    res.send(zones);
});

E.prototype.history_har_get = etask._fn(
function*history_har_get(_this, req, res){
    res.setHeader('content-disposition', 'attachment; filename=data.har');
    res.setHeader('content-type', 'application/json');
    let result = yield _this.filtered_get(req);
    res.json(_this.har(result.items));
});

E.prototype.history_csv_get = etask._fn(
function*history_csv_get(_this, req, res){
    res.setHeader('content-disposition', 'attachment; filename=data.csv');
    res.setHeader('content-type', 'text/csv');
    let result = yield _this.filtered_get(req);
    res.send(json2csv({data: result.items}));
});

E.prototype.filtered_get = etask._fn(function*filtered_get(_this, req){
    var for_db = s=>(s||'').replace("'", "''");
    const skip = +req.query.skip||0;
    const limit = +req.query.limit||0;
    const wheres = [`port = '${for_db(req.params.port)}'`];
    if (req.query.url)
        wheres.push(`url LIKE '%${for_db(req.query.url)}%'`);
    if (req.query.method)
        wheres.push(`method = '${for_db(req.query.method)}'`);
    if (req.query.status_code)
        wheres.push(`status_code = '${for_db(req.query.status_code)}'`);
    if (req.query.timestamp_min)
        wheres.push(`timestamp >= '${for_db(req.query.timestamp_min)}'`);
    if (req.query.timestamp_max)
        wheres.push(`timestamp <= '${for_db(req.query.timestamp_max)}'`);
    if (req.query.elapsed_min)
        wheres.push(`elapsed >= '${for_db(req.query.elapsed_min)}'`);
    if (req.query.elapsed_max)
        wheres.push(`elapsed <= '${for_db(req.query.elapsed_max)}'`);
    if (req.query.country)
        wheres.push(`country = '${for_db(req.query.country)}'`);
    if (req.query.super_proxy)
        wheres.push(`super_proxy LIKE '%${for_db(req.query.super_proxy)}%'`);
    if (req.query.proxy_peer)
        wheres.push(`proxy_peer LIKE '%${for_db(req.query.proxy_peer)}%'`);
    if (req.query.context)
        wheres.push(`context LIKE '%${for_db(req.query.context)}%'`);
    let db_items = yield _this.sql(
        `SELECT * FROM request WHERE (${wheres.join(') AND (')})
        ORDER BY ${req.query.sort}${req.query.sort_desc ? ' DESC' : ''}`
        + (limit ? ` LIMIT ${limit} OFFSET ${skip}` : ''));
    let db_total = yield _this.sql(
        `SELECT COUNT(*) FROM request WHERE (${wheres.join(') AND (')})`);
    if (_this.mode!='root')
    {
        for (let row of db_items)
        {
            if (row.request_headers)
            {
                let h = JSON.parse(row.request_headers);
                for (let header of Luminati.hola_headers)
                {
                    if (h[header])
                        h[header] = '[hidden]';
                }
                row.request_headers = JSON.stringify(h);
            }
        }
    }
    return {
        total: db_total[0]['COUNT(*)'],
        skip: skip,
        limit: limit,
        items: db_items,
    };
});

E.prototype.sessions_get = etask._fn(function*sessions_get(_this, req, res){
    const port = req.params.port;
    if (req.query.refresh!==undefined)
        yield _this.proxies_running[port].update_all_sessions();
    let sessions = _this.proxies_running[port].sessions||[];
    res.json(sessions.map(s=>_.pick(s, qw`info count bandwidth created`)));
});

E.prototype.node_version = etask._fn(function*node_version(_this, req, res){
    const check = yield etask.nfn_apply(check_node_version,
        [{node: pkg.recomendedNode}]);
    res.json({
        current: check.node.version,
        satisfied: check.nodeSatisfied,
        recommended: pkg.recomendedNode,
    });
});

E.prototype.last_version = etask._fn(function*last_version(_this, req, res){
    const r = yield _this.json({
        url: 'https://raw.githubusercontent.com/luminati-io/luminati-proxy/'
            +'master/package.json',
    });
    const newer = semver.lt(pkg.version, r.body.version);
    res.json({version: r.body.version, newer: newer});
});

E.prototype.stats = etask._fn(function*stats(_this, req, res){
    const r = yield _this.json({
        url: 'https://luminati.io/api/get_customer_bw?details=1',
        headers: {'x-hola-auth': `lum-customer-${_this.argv.customer}`
            +`-zone-${_this.argv.zone}-key-${_this.argv.password}`},
    });
    const stats = r.body[_this.argv.customer];
    if (!stats)
        yield _this.logged_update();
    res.json(stats||{login_failure: _this.login_failure});
});

E.prototype.whitelist = etask._fn(function*whitelist(_this, req, res){
    const r = yield _this.json({
        url: 'https://luminati.io/api/get_whitelist?zones=*',
        headers: {'x-hola-auth': `lum-customer-${_this.argv.customer}`
            +`-zone-${_this.argv.zone}-key-${_this.argv.password}`},
    });
    res.json(r.body);
});

E.prototype.recent_ips = etask._fn(function*recent_ips(_this, req, res){
    const r = yield _this.json({
        url: 'https://luminati.io/api/get_recent_ips?zones=*',
        headers: {'x-hola-auth': `lum-customer-${_this.argv.customer}`
            +`-zone-${_this.argv.zone}-key-${_this.argv.password}`},
    });
    res.json(r.body);
});

E.prototype.get_params = function(){
    if (this.argv.config)
        return process.argv.slice(2);
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

E.prototype.get_settings = function(){
    return {
        customer: this._defaults.customer,
        zone: this._defaults.zone,
        password: this._defaults.password,
        config: this.argv.config,
        resolve: this._defaults.resolve,
        argv: this.get_params().join(' '),
    };
};

E.prototype.config_get = function(req, res){
    res.json({config: file.exists(this.argv.config) ?
        file.read_e(this.argv.config) : ''});
};

E.prototype.config_set = function(req, res){
    file.write_e(this.argv.config, req.body.config);
    res.json({result: 'ok'});
    this.emit('config_changed');
};

E.prototype.resolve_get = function(req, res){
    if (!file.exists(this.argv.resolve))
    {
        res.status(404).json({error: 'Resolution file does not exist'});
        return;
    }
    res.json({resolve: file.read_e(this.argv.resolve)});
};

E.prototype.resolve_set = function(req, res){
    if (!file.exists(this.argv.resolve))
    {
        res.status(500).json({error: 'Resolution file does not exist'});
        return;
    }
    file.write_e(this.argv.resolve, req.body.resolve);
    res.json({result: 'ok'});
    this.emit('config_changed');
};

E.prototype.resolve_host = etask._fn(
function*resolve_host(_this, req, res){
    let host = req.params.host;
    try {
        let ips = yield etask.nfn_apply(dns, '.resolve', [host]);
        res.json({ips: ips});
    } catch(e){ res.json({ips: null}); }
});

E.prototype.get_ip = etask._fn(
function*get_ip(_this){
    try {
        const result = yield _this.json('http://lumtest.com/myip');
        return result.body;
    } catch(e){ ef(e); return false; }
});

E.prototype.check_credentials = etask._fn(
function*check_credentials(_this, cred){
    if (_this.run_config.bypass_credentials_check)
        return {result: true, error: false};
    try {
        cred = _.pick(assign({}, _this.argv, cred), qw`customer zone
            password`);
        _this._log.debug('Testing credentials:', cred);
        let res = yield _this.json({
            url: `https://luminati.io/api/check_credentials`,
            headers: {'x-hola-auth':
                `lum-customer-${cred.customer}`
                +`-zone-${cred.zone}-key-${cred.password}`},
        });
        if (res.statusCode==200)
            return {result: true, error: false};
        // XXX marka: rm after lum-b would be update to return error text
        if (res.statusCode==401)
            return {result: false, error: res.body.text||res.body.error};
        return {result: false, error: 'invalid_creds'};
    } catch(e){ ef(e); return {result: false, error: 'unknown'}; }
});

E.prototype.creds_user_set = etask._fn(
function*creds_user_set(_this, req, res){
    let config = yield _this.check_user(req.body.token,
        req.body.username, req.body.password, req.body.customer);
    if (config.error)
    {
        res.status(401).json(config);
        return;
    }
    if (config.customers)
    {
        res.json({customers: config.customers});
        return;
    }
    yield _this.sql('DELETE FROM zone');
    let zones = config.defaults.zones;
    let query = 'INSERT INTO zone(zone, perm, ips, plans) VALUES (?, ?, ?, ?)';
    for (let zone in zones)
    {

        yield _this.sql(query, zone, zones[zone].perm, zones[zone].ips,
            JSON.stringify(zones[zone].plans));
    }
    let zone_autoupdate =
        config.defaults.zone && config.defaults.zone!=_this.argv.zone ?
        {zone: config.defaults.zone, prev: _this.argv.zone} : false;
    assign(_this._defaults, config.defaults);
    _this.save_config();
    res.json({result: 'ok'});
    _this.emit('config_changed', zone_autoupdate);
});

E.prototype.proxies_running_get = function(req, res){
    this.db.db.all('SELECT DISTINCT port FROM request', (err, rows)=>{
        let index = {};
        for (let row of rows)
            index[row.port] = true;
        res.json(_.values(this.proxies_running).map(p=>{
            let proxy = _.cloneDeep(p.opt);
            proxy._stats = p.stats;
            proxy._history = index[proxy.port]||false;
            proxy._status = p.status;
            return proxy;
        }));
    });
};

E.prototype.ip_get = etask._fn(function*ip_get(_this, req, res){
    const ip = yield _this.get_ip();
    res.json({ip: ip});
});

E.prototype.shutdown = function(req, res){
    res.json({result: 'ok'});
    this.stop(true);
};

E.prototype.logout = etask._fn(function*(_this, req, res){
    _this._defaults.customer = '';
    _this._defaults.password = '';
    _this._defaults.zone = '';
    _this.save_config();
    yield _this.sql('DELETE FROM zone');
    res.json({result: 'ok'});
    _this.emit('config_changed');
});

E.prototype.restart = function(req, res){
    this.emit('restart');
    res.json({result: 'ok'});
};

E.prototype.upgrade = etask._fn(function*upgrade(_this, req, res){
    if (_this.cities_db)
    {
        _this.cities_db.close(()=>this.continue());
        yield this.wait();
    }
    if (_this.db.db)
    {
        _this.db.db.close(()=>this.continue());
        yield this.wait();
    }
    _this.emit('upgrade', e=>e ? res.status(403).send(e)
        : res.json({result: 'ok'}));
});

E.prototype.block = etask._fn(function*block(_this, req, res){
    assert(req.body.ip, 'missing ip');
    let ips = [];
    [].concat(req.body.ip).forEach(ip=>{
        const block = new netmask.Netmask(ip);
        block.forEach((ip, long)=>ips.push(long));
    });
    yield _this.sql(`INSERT INTO ip(ip) VALUES(${ips.join(',')})`);
    res.json({count: ips.length});
});

E.prototype.recheck = etask._fn(function*recheck(_this, req, res){
    yield _this.logged_update();
    res.json({login_failure: _this.login_failure});
});

E.prototype.create_api_interface = function(){
    const app = express();
    app.get('/swagger', this._api((req, res)=>res.json(swagger)));
    app.get('/consts', this._api(this.get_consts));
    app.get('/history_context/:port', this._api(this.get_history_context));
    app.get('/hola_headers', this._api((req, res)=>res.json(
        Luminati.hola_headers.filter(h=>h!='x-hola-agent'))));
    app.get('/defaults', this._api((req, res)=>res.json(this.opts)));
    app.get('/version', this._api((req, res)=>res.json(
        {version: pkg.version})));
    app.get('/last_version', this._api(this.last_version));
    app.get('/node_version', this._api(this.node_version));
    app.get('/proxies_running', this._api(this.proxies_running_get));
    app.get('/proxies', this._api((req, res)=>res.json(
        this.config)));
    app.post('/proxies', this._api(this.proxy_create_api, ['root', 'normal']));
    app.put('/proxies/:port', this._api(
        this.proxy_update_api, ['root', 'normal']));
    app.delete('/proxies/:port', this._api(
        this.proxy_delete_api, ['root', 'normal']));
    app.post('/refresh_sessions/:port', this._api(
        this.refresh_sessions, ['root', 'normal']));
    app.post('/proxy_check', this._api(this.proxy_check_api));
    app.post('/proxy_check/:port', this._api(this.proxy_check_api));
    app.get('/proxy_status/:port', this._api(this.proxy_status_get));
    app.get('/history/:port', this._api(this.history_get));
    app.get('/history_har/:port', this._api(this.history_har_get));
    app.get('/history_csv/:port', this._api(this.history_csv_get));
    app.get('/sessions/:port', this._api(this.sessions_get));
    app.get('/stats', this._api(this.stats));
    app.get('/whitelist', this._api(this.whitelist));
    app.get('/recent_ips', this._api(this.recent_ips));
    app.get('/settings', this._api((req, res)=>res.json(this.get_settings()),
        ['root']));
    app.post('/creds_user', this._api(this.creds_user_set, ['root']));
    app.get('/config', this._api(this.config_get, ['root']));
    app.post('/config', this._api(this.config_set, ['root']));
    app.get('/resolve', this._api(this.resolve_get, ['root']));
    app.post('/resolve', this._api(this.resolve_set, ['root']));
    app.get('/resolve_host/:host', this._api(this.resolve_host));
    app.get('/mode', this._api((req, res)=>res.json({mode: this.mode,
        logged_in: this.logged_in, login_failure: this.login_failure,
        run_config: this.run_config})));
    app.get('/ip', this._api(this.ip_get, ['root']));
    app.post('/shutdown', this._api(this.shutdown, ['root']));
    app.post('/logout', this._api(this.logout));
    app.post('/upgrade', this._api(this.upgrade, ['root']));
    app.post('/restart', this._api(this.restart, ['root']));
    app.post('/block', this._api(this.block, ['root']));
    app.post('/recheck', this._api(this.recheck));
    app.get('/regions/:country_id', this._api(this.get_regions));
    app.get('/cities/:country_id/:region_id?', this._api(this.get_cities));
    app.get('/free_port', this._api(this.get_free_port));
    app.get('/zones', this._api(this.get_zones));
    app.post('/test/:port', this._api(this.test));
    app.get('/country', this._api(this.country));
    return app;
};

E.prototype.create_web_interface = etask._fn(
function*create_web_interface(_this){
    const app = express();
    const server = http.Server(app);
    http_shutdown(server);
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
    app.get(/^\/((|proxies|tools|faq)|zones(\/[^\/]+)?)$/,
        (req, res, next)=>{
        req.url = '/index.html';
        next('route');
    });
    app.use('/uib', express.static(path.resolve(__dirname,
        '../node_modules/angular-ui-bootstrap')));
    app.use(express.static(path.resolve(__dirname, '../bin/pub')));
    app.use('/req', express.static(path.resolve(__dirname,
        '../node_modules')));
    app.use(function(err, req, res, next){
        _this._log.error(err.stack);
        res.status(500).send('Server Error');
    });
    server.on('error', err=>_this.error_handler('WWW', err));
    server.stop = force=>etask(function*(){
        const stop_method = force ? '.forceShutdown' : '.shutdown';
        return yield etask.nfn_apply(server, stop_method, []);
    });
    yield etask.cb_apply(server, '.listen', [_this.argv.www,
        find_iface(_this.argv.iface)||'0.0.0.0']);
    let port = server.address().port;
    let address = server.address().address;
    if (address == '0.0.0.0')
        address = '127.0.0.1';
    server.url = `http://${address}:${port}`;
    swagger.host = `${address}:${port}`;
    return server;
});

E.prototype.create_socks_servers = etask._fn(
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
            if (c.port==ports.remote && (!c.socks||c.socks==ports.local))
            {
                c.socks = ports.local;
                _this._log.debug(
                    `Attaching socks ${ports.local} to proxy ${c.port}`);
                return false;
            }
        }
        return true;
    });
    _this.argv.socks = socks.map(o=>o.local+':'+o.remote);
    if (!_this.argv.socks.length)
        delete _this.argv.socks;
    return yield etask.all(socks.map(opt=>etask(function*(){
        let port, server = new Socks(opt)
        .on('error', err=>_this.error_handler('Socks '+port, err));
        yield server.start();
        port = server.port;
        _this.socks_servers[port] = server;
        console.log(`SOCKS5 is available at 127.0.0.1:${port}`);
    })));
});

E.prototype.init_proxies = etask._fn(function*init_proxies(_this){
    let proxies = _this.config.map(c=>_this.create_proxy(c));
    if (_this.argv.dropin)
    {
        proxies.push(_this.create_proxy({
            port: default_port,
            multiply: false,
            sticky_ip: true,
            allow_proxy_auth: true,
            socks: false,
            pool_size: 0,
            max_requests: 0,
            keep_alive: false,
            session_duration: 0,
            session: false,
            seed: false,
        }));
    }
    proxies = yield etask.all(proxies);
});

E.prototype.proxies_cache_get = etask._fn(
function*proxies_cache_get(_this, proxies){
    let where;
    if (proxies.length>1)
        where = `proxy IN ('${proxies.join("','")}')`;
    else
        where = `proxy = '${proxies[0]}'`;
    let hosts = yield _this.sql(`SELECT host FROM proxy_hosts WHERE ${where}`);
    return hosts.map(h=>h.host);
});

E.prototype.proxies_cache_add = etask._fn(
function*proxies_cache_add(_this, hosts){
    if (!hosts.length)
        return;
    return yield _this.sql('INSERT INTO proxy_hosts (host, proxy) '
        +hosts.map(p=>`SELECT '${p.join("','")}'`).join(' UNION ALL '));
});

E.prototype.proxies_cache_remove = etask._fn(
function*proxies_cache_remove(_this, $host){
    return yield _this.db.stmt.proxy_remove.run({$host});
});

E.prototype.logged_update = etask._fn(function*logged_update(_this){
    if (_this.argv.customer)
    {
        let auth = yield _this.check_credentials();
        _this.logged_in = auth.result;
        _this.login_failure = auth.error;
    }
    else
    {
        _this.logged_in = false;
        _this.login_failure = false;
    }
});

E.prototype.check_user = etask._fn(
function*check_user(_this, token, username, password, customer){
    const url = 'https://luminati.io';
    if (!token && (!_this.luminati_jar || _this.luminati_jar.password!=password
        || _this.luminati_jar.username!=username))
    {
        let jar = request.jar();
        yield etask.nfn_apply(request, [{url: url, jar: jar}]);
        const xsrf = jar.getCookies(url).find(e=>e.key=='XSRF-TOKEN').value;
        let response = yield etask.nfn_apply(request, [{
            method: 'POST',
            url: `${url}/users/auth/basic/check_credentials`,
            jar: jar,
            headers: {'X-XSRF-Token': xsrf},
            form: {username: username, password: password},
        }]);
        if (response.statusCode!=200)
        {
            if (response.body=='not_registered')
            {
                return {error: {
                    message: `The email address is not registered. `
                        +`<a href="${url}/?need_signup=1" target=_blank>`
                        +`Click here to sign up.</a>`,
                    email: true,
                }};
            }
            return {error: {
                message: `The password is incorrect. `
                    +`<a href="${url}/forgot_password?email=`
                    +`${encodeURIComponent(username)}" target=_blank>`
                    +`Forgot your password?</a>`,
                password: true,
            }};
        }
        _this.luminati_jar = {jar: jar, username: username,
            password: password};
    }
    let config = yield etask.nfn_apply(request, [{
        qs: {customer, token},
        url: `${url}/cp/lum_local_conf`,
        jar: _this.luminati_jar && _this.luminati_jar.jar,
    }]);
    if (config.statusCode!=200)
        return {error: {message: config.body}};
    let c = JSON.parse(config.body);
    if (customer)
    {
        yield etask.nfn_apply(request, [{
            method: 'POST',
            url: `${url}/api/whitelist/add`+(token ? '?token='+token : ''),
            jar: _this.luminati_jar && _this.luminati_jar.jar,
            json: true,
            body: {customer, zone: c._defaults.zone}
        }]);
    }
    return !customer && c.customers.length>1 ?
        {customers: c.customers.sort()} : {defaults: c._defaults};
});

E.prototype.start = etask._fn(function*start(_this){
    try {
        yield _this.prepare_database();
        _this.db.stmt.proxy_remove = _this.db.db.prepare(
            'DELETE FROM proxy_hosts WHERE host=$host');
        _this.db.stmt.history = _this.db.db.prepare(`INSERT INTO request (port,
            url, method, request_headers, request_body, response_headers,
            status_code, status_message, timestamp, elapsed, response_time,
            node_latency, country, timeline, super_proxy, proxy_peer, username,
            content_size, context)
            VALUES ($port, $url, $method, $request_headers, $request_body,
            $response_headers, $status_code, $status_message, $timestamp,
            $elapsed, $response_time, $node_latency, $country, $timeline,
            $super_proxy, $proxy_peer, $username, $content_size, $context)`);
        yield _this.logged_update();
        yield _this.create_socks_servers();
        yield _this.init_proxies();
        if (_this.argv.www)
        {
            _this.www_server = yield _this.create_web_interface();
            console.log('admin is available at '+_this.www_server.url);
        }
    } catch(e){ ef(e);
        if (e.message!='canceled')
            _this._log.error(e, e.stack);
        throw e;
    }
});
