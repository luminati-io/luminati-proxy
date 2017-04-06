#!/usr/bin/env node
// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/
const _ = require('lodash');
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
const sequelize = require('sequelize');
const http = require('http');
const hutil = require('hutil');
const util = require('util');
const is_win = process.platform=='win32';
const sqlite3 = require('sqlite3');
const stringify = require('json-stable-stringify');
const cookie_filestore = require('tough-cookie-filestore');
const country_language = require('country-language');
const yargs = require('yargs/yargs');
const db_history = require('./db_history.json');
const check_node_version = require('check-node-version');
const semver = require('semver');
const cities = require('./cities.js');
const glob = require('glob-fs')({gitignore: true});
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
const lum_url = 'https://luminati.io';

const prop_by_type = (def, type)=>_.toPairs(def.properties)
    .filter(p=>p[1].type==type).map(p=>p[0]);

const proxy_fields = assign({}, swagger.definitions.proxy.properties,
    swagger.definitions.manager.properties);
const mgr_fields = _.keys(swagger.definitions.manager.properties);
const added_descriptions = {
    'no-www': 'Disable local web',
    'no-config': 'Working without a config file',
    daemon: 'Start as a daemon',
    'stop-daemon': 'Stop running daemon',
};
swagger.info.version = pkg.version;
const numeric_fields = prop_by_type(swagger.definitions.proxy, 'integer');
const boolean_fields = prop_by_type(swagger.definitions.proxy, 'boolean');
const credential_fields = qw`customer zone password token`;
const default_fields = [].concat(credential_fields, mgr_fields);
const proxy_params = _(swagger.definitions.proxy.properties)
    .pickBy(k=>!credential_fields.includes(k)).keys().value();
E.default = assign({}, Luminati.default, {
    max_requests: 50,
    pool_size: 3,
    proxy_switch: 5,
    www: 22999,
    config: path.resolve(os.homedir(),
        '.luminati.json'.substr(is_win ? 1 : 0)),
    database: path.resolve(os.homedir(),
        '.luminati.sqlite3'.substr(is_win ? 1 : 0)),
    mode: 'root',
    dropin: true,
    no_usage_stats: false,
    history: false,
    reverse_lookup_dns: false,
    rules: false,
});
const PROXY_INTERNAL_BYPASS = qw`google.com luminati.io`;
const PROXY_ONLY_BYPASS = qw`googleapis.com cdnjs.com gstatic.com google.co.*
    googleusercontent.com google.* luminati.io hwcdn.net lumtest.com`;

const load_json = (filename, optional, def)=>{
    if (optional && !file.exists(filename))
        return def;
    try {
        let s = file.read_e(filename);
        console.log(`Loaded config from ${filename}`);
        return JSON.parse(s);
    } catch(e){}
    return def;
};

function Manager(args, run_config){
    events.EventEmitter.call(this);
    this.run_config = run_config||{};
    if (!this.run_config.id)
        this.run_config.id = +new Date();
    this.db = {};
    this.proxies_running = {};
    this.socks_servers = {};
    args = args.map(String);
    let _yargs = yargs(args);
    let usage = ['  $0 [options] config1 config 2 ...'];
    if (process.env.DOCKER)
    {
        usage.unshift('  docker run luminati/luminati-proxy '
            +'[docker port redirections]');
    }
    _yargs.usage('Usage:\n' + usage.join(' \\\n'))
    .options(proxy_fields)
    .describe(added_descriptions)
    .number(numeric_fields)
    .default(E.default)
    .help('h')
    .alias({'help': ['h', '?'], port: 'p', daemon: 'd', 'version': 'v'})
    .version(()=>`luminati-proxy version: ${pkg.version}`);

    this.argv = _yargs.argv;
    if (this.argv.log instanceof Array)
        this.argv.log = this.argv.log.pop();
    this.argv.log = this.argv.log.toLowerCase();
    this._log = log(this.argv.www||'MNGR', this.argv.log);
    this._log.info('Manager started', pkg.version);
    this._log.silly('Effective args', this.argv);
    this.mgr_opts = _.pick(this.argv, mgr_fields);
    let conf = _get_proxy_configs(this, args);
    this._defaults = conf._defaults;
    this.proxies = conf.proxies;
    this.rules = conf.rules;
    this.mode = _yargs.argv.mode;
    if (!['root', 'normal', 'guest'].includes(this.mode))
    {
        console.log(`Unrecognized UI mode (${this.mode}); treating as guest`);
        this.mode = 'guest';
    }
    this.opts = _.pick(this.argv, _.keys(proxy_fields));
    this.proxy_cache = {
        get: this.proxies_cache_get.bind(this),
        add: this.proxies_cache_add.bind(this),
        remove: this.proxies_cache_remove.bind(this),
    };
    this.history_aggregator = data=>{
        this._log.silly('Added to history', data);
        if (this.db.history)
            this.db.history.models.request.create(data);
        else
        {
            let row = {};
            for (let f in data)
                row['$'+f] = data[f];
            this.db.main.stmt.history.run(row);
        }
    };
    if (this.run_config.ua)
    {
        args.filter(a=>a.indexOf('-')==0).forEach(
            v=>this.run_config.ua.event('manager', 'argv', v));
    }
}

function _config_from_file(fname, proxy_type){
    let conf = load_json(fname, false, {});
    let defaults = conf._defaults||{};
    let proxies = [].concat(conf.proxies||conf);
    proxies = proxies.map(c=>assign({proxy_type}, c));
    return {_defaults: defaults, proxies, rules: conf.rules};
}

function _get_proxy_configs(_this, args){
    let _defaults = assign({}, _.pick(E.default, default_fields));
    let proxies = [], rules = {};
    // this.argv includes default values; we want only args explicitly given
    _this.argv_explicit = _.pick(_this.argv,
        proxy_params.filter(p=>args.includes(`--${p}`)));
    if (args.includes('-p'))
        _this.argv_explicit.port = _this.argv.port;
    _this.argv_overlay = _.omit(_this.argv_explicit, qw`socks port`);
    if (_this.mgr_opts.config)
    {
        let conf = _config_from_file(_this.mgr_opts.config, 'persist');
        assign(_defaults, _.pick(conf._defaults, default_fields));
        proxies = proxies.concat(conf.proxies);
        rules = conf.rules;
        if (_this.mgr_opts.rules)
            _this.mgr_opts._rules = conf.rules;
    }
    proxies = proxies.concat([].concat.apply([], _this.argv._
        .map(fname=>_config_from_file(fname, 'config').proxies)));
    if (_this.argv_explicit.port||_this.argv_explicit.socks||!proxies.length)
        proxies.push(assign({proxy_type: 'persist'}, _this.argv_explicit));
    if (_this.mgr_opts.rules)
    {
        _this.mgr_opts.dropin = true;
        Luminati.dropin._rules = _this.mgr_opts._rules;
        Luminati.dropin.ssl = true;
    }
    if (_this.mgr_opts.dropin)
        proxies.push(Luminati.dropin);
    // XXX lee - make sure no port conflicts are generated here
    proxies.filter(conf=>!conf.port)
        .forEach((conf, i)=>assign(conf, {port: _this.argv.port+i}));
    assign(_defaults, _.pick(_this.argv_overlay, default_fields));
    if (_this.argv.token)
        assign(_defaults, {token: _this.argv.token});
    proxies.forEach(c=>_this._log.debug('Config', c));
    _this._log.debug('_defaults', _defaults);
    return {_defaults, proxies, rules};
}

util.inherits(Manager, events.EventEmitter);

E.prototype._api = function(f, roles){
    const _this = this;
    return (req, res, next)=>etask(function*_api(){
        _this._log.debug('API', req.method, req.originalUrl);
        _this._log.silly('API req body', req.body);
        this.finally(()=>{
            if (this.error)
            {
                _this._log.warn('API error:', req.method, req.originalUrl,
                    this.error);
                if (this.error.stack)
                    _this._log.silly(this.error.stack, etask.ps());
                return next(this.error);
            }
        });
        let json = res.json.bind(res);
        res.json = o=>{
            _this._log.debug('API', req.method, req.originalUrl, 'resp',
                stringify(o));
            json(o);
        };
        if (roles&&!roles.includes(_this.mode))
            res.json({request_disallowed: true});
        else
            yield f.call(_this, req, res, next);
    });
};

E.prototype.stop_servers = etask._fn(function*stop_servers(_this, force, www){
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

E.prototype.stop_dbs = etask._fn(function*stop_dbs(_this){
    if (!this.db)
        return;
    for (let db in _this.db)
    {
        if (db.stmt)
        {
            for (let st of db.stmt)
                st.finalize();
        }
        yield etask.nfn_apply(db, '.close', []);
    }
    _this.db = null;
});

E.prototype.stop = etask._fn(
function*stop(_this, reason, force, restart){
    yield _this.stop_servers(force, true);
    yield _this.stop_dbs();
    yield _this.save_config();
    _this._log.info('Manager stopped', {reason, force, restart});
    if (!restart)
        _this.emit('stop', reason);
});

E.prototype.sql = etask._fn(function*sql(_this){
    try {
        const args = [].slice.call(arguments, 1);
        _this._log.debug(`SQL: `, args);
        let res = yield etask.nfn_apply(_this.db.main, '.all', args);
        _this._log.silly('SQL result length', res && res.length);
        return res;
    } catch(e){
        _this._log.debug('SQL Error', e);
        _this._log.silly(e.stack, etask.ps());
        throw e;
    }
});

E.prototype.har = function(entries){
    return {log: {
        version: '1.2',
        creator: {name: 'Luminati Proxy', version: pkg.version},
        pages: [],
        entries: entries.map(entry=>{
            const req = JSON.parse(entry.request_headers);
            const res = JSON.parse(entry.response_headers);
            const timeline = JSON.parse(entry.timeline);
            const headers = h=>_.toPairs(h).map(p=>({
                name: p[0],
                value: p[1],
            }));
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
    let proxies = this.proxies
        .filter(p=>p.proxy_type=='persist')
        .map(p=>_.omit(p, qw`stats proxy_type`))
        .map(p=>_.omitBy(p, v=>!v && v!==0 && v!==false))
        .map(p=>_.omitBy(p, (v, k)=>v===this._defaults[k]))
        .map(p=>_.omitBy(p, (v, k)=>v===E.default[k]));
    let _defaults = _(this._defaults)
        .pick(default_fields.filter(f=>f!='config'))
        .omitBy((v, k)=>v===E.default[k]);
    let rules = this.rules;
    let s = stringify({proxies, _defaults, rules}, {space: '  '});
    this._log.debug('Saving config to ', filename);
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
            _this._log.silly(e, e.stack, etask.ps());
        }
    }
});

const open_db = _path=>etask(function*(){
    let db;
    yield etask.nfn_apply((p, cb)=>db = new sqlite3.Database(p, cb),
        null, [_path]);
    return db;
});

E.prototype.prepare_database = etask._fn(
function*prepare_database(_this){
    if (_this.argv.log=='debug'||_this.argv.log=='silly')
        sqlite3.verbose();
    _this.db = {};
    _this.db.main = yield open_db(_this.argv.database);
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

E.prototype.get_zones = etask._fn(function*get_zones(_this){
    let config = yield _this.get_lum_local_conf();
    return _.map(config._defaults.zones, (v, k)=>{
        return {zone: k, perm: v.perm, plans: v.plan,
            password: (v.password||[])[0]};
    });
});

E.prototype.get_zones_api = etask._fn(function*get_zones_api(_this, req, res){
    res.json(yield _this.get_zones());
});

E.prototype.get_consts = etask._fn(function*get_consts(_this, req, res){
    let proxy = _.mapValues(proxy_fields, desc=>({desc: desc}));
    _.forOwn(E.default, (def, prop)=>{
        if (proxy[prop])
            proxy[prop].def = def;
    });
    _.merge(proxy, {dns: {values: ['', 'local', 'remote']}});
    let ifaces = Object.keys(os.networkInterfaces())
    .map(iface=>({key: iface, value: iface}));
    ifaces.unshift({key: 'All', value: '0.0.0.0'});
    ifaces.unshift({key: 'Default (All)', value: ''});
    proxy.iface.values = ifaces;
    let zones = (yield _this.get_zones())
        .map(z=>assign({key: z.zone, value: z.zone, plans: []}, z));
    zones.unshift({key: `Default (${proxy.zone.def})`, value: ''});
    proxy.zone.values = zones;
    let pool_types = Object.keys(Luminati.pool_types).map(pool_type=>{
        return {key: pool_type, value: pool_type};
    });
    pool_types.unshift({key: `Default (${proxy.pool_type.def})`, value: ''});
    proxy.pool_type.values = pool_types;
    let log_levels = Object.keys(log.log_level).map(log_level=>{
        return {key: log_level, value: log_level};
    });
    log_levels.unshift({key: `Default (${_this.opts.log})`, value: ''});
    proxy.log.values = log_levels;
    proxy.country = {values: yield _this.get_countries()};
    proxy.debug.values = [
        {key: `Default (${proxy.debug.def})`, value: ''},
        {key: 'none', value: 'none'},
        {key: 'full', value: 'full'},
    ];
    res.json({proxy: proxy});
});

E.prototype.get_history_context = etask._fn(
function*get_history_context(_this, req, res){
    let $port = req.params.port;
    let contexts = yield _this.sql(`SELECT DISTINCT context FROM request
        WHERE context IS NOT NULL AND port = $port`, {$port})||[];
    res.json(contexts.map(c=>({key: c.context, value: c.context})));
});

E.prototype.proxy_validator = function(conf){
    conf.customer = conf.customer||this._defaults.customer;
    conf.password = conf.password||this._defaults.password;
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
        this._log.silly(err, err.stack, etask.ps());
    }
    this.emit('error', err);
};

E.prototype._complete_proxy_config = function(conf){
    const c = assign({}, E.default, this._defaults, conf, this.argv_overlay,
        {_rules: this.rules});
    if (c.zone==this._defaults.zone && this._defaults.password)
    {
        c.password = this._defaults.password;
        // XXX jesse: get rid of this at end of April once configs are clean
        let proxy = this.proxies.find(p=>p.port==c.port);
        if (proxy)
            delete proxy.password;
    }
    return c;
};

E.prototype.create_single_proxy = etask._fn(
function*create_single_proxy(_this, conf){
    conf = _this._complete_proxy_config(conf);
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
    proxy = assign({}, _this._defaults,
        _.omitBy(proxy, v=>!v && v!==0 && v!==false));
    let conf =
        assign({
            proxy_cache: _this.proxy_cache,
            history_aggregator: _this.history_aggregator,
            proxy_internal_bypass: PROXY_INTERNAL_BYPASS,
        }, proxy);
    let valid_creds = yield _this.check_proxy_creds(conf.zone, conf.password);
    if (!valid_creds && !conf.allow_proxy_auth)
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
    servers.forEach(s=>{
        s.stop = nop;
        s.config = proxy;
    });
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
    if (proxy.proxy_type == 'persist')
    {
        _this.proxies.push(proxy);
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
        let idx = _this.proxies.findIndex(p=>p.port==port);
        if (idx==-1)
            return;
        _this.proxies.splice(idx, 1);
        _this.save_config();
    }
});

E.prototype.proxy_create_api = etask._fn(
function*proxy_create_api(_this, req, res){
    let port = +req.body.proxy.port;
    let errors = yield _this.proxy_check({port: port});
    if (errors.length)
        return res.status(400).json({errors: errors});
    let proxy = assign({}, req.body.proxy);
    proxy = _.omitBy(proxy, v=>v==='');
    let server = yield _this.proxy_create({proxy: proxy});
    res.json({data: server.opt});
});

E.prototype.proxy_update_api = etask._fn(
function*proxy_update_api(_this, req, res){
    let old_port = req.params.port;
    let old_proxy = _this.proxies.find(p=>p.port==old_port);
    if (!old_proxy)
        throw `No proxy at port ${old_port}`;
    if (old_proxy.proxy_type != 'persist')
        throw 'This proxy is read-only';
    let port = +req.body.proxy.port;
    if (port!==undefined)
    {
        let errors = yield _this.proxy_check({port}, old_port);
        if (errors.length)
            return res.status(400).json({errors});
    }
    yield _this.proxy_delete(old_port);
    let proxy = assign({}, old_proxy, req.body.proxy); // XXX lee - ???
    proxy = _.omitBy(proxy, v=>v==='');
    let server = yield _this.proxy_create({proxy});
    res.json({data: server.opt});
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
    let force = req.query.force!==undefined
        && req.query.force!=='false' && req.query.force!=='0';
    let with_details = req.query.with_details!==undefined
        && req.query.with_details!=='false' && req.query.with_details!=='0';
    let proxy = _this.proxies_running[port];
    if (!proxy)
    {
        res.json({status: 'Unknown proxy'});
        return;
    }
    let fields = ['status'];
    if (with_details)
    {
        fields.push('status_details');
        if (!proxy.status_details)
        {
            proxy.status_details = yield _this.proxy_check(proxy.config,
                proxy.config.port);
        }
    }
    if (force && proxy.status)
        proxy.status = undefined;
    for (let cnt = 0; proxy.status===null && cnt<= max_wait+2; cnt++)
        yield etask.sleep(period);
    if (proxy.status===null)
        return res.json({status: 'Unexpected lock on status check.'});
    if (proxy.status)
        return res.json(_.pick(proxy, fields));
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
                'x-hola-agent': Luminati.hola_agent,
                'user-agent': Luminati.user_agent
            }
        });
        success = r.statusCode==200;
    } catch(e){ ef(e); }
    proxy.status = success ? 'ok' : 'The proxy is not working properly';
    res.json(_.pick(proxy, fields));
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
        if (_.values(_this.proxies_running).map(x=>x.opt.socks).includes(p))
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

const check = v=>v!==undefined&&v!==0&&v!=='0'&&v!==false;

E.prototype.proxy_check = etask._fn(
function*proxy_check(_this, new_proxy_config, old_proxy_port){
    let old_proxy = old_proxy_port && _this.proxies_running[old_proxy_port]
        && _this.proxies_running[old_proxy_port].opt || {};
    let info = [];
    let port = new_proxy_config.port;
    let debug = new_proxy_config.debug;
    let zone = new_proxy_config.zone;
    let effective_zone = zone||E.default.zone;
    let password = new_proxy_config.password;
    let history = new_proxy_config.history;
    let _ssl = new_proxy_config.ssl;
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
    let reverse_lookup_dns = new_proxy_config.reverse_lookup_dns;
    let reverse_lookup_file = new_proxy_config.reverse_lookup_file;
    let reverse_lookup_values = new_proxy_config.reverse_lookup_values;
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
        let zones = yield _this.get_zones();
        if (zones.length)
        {
            db_zone = zones.filter(i=>i.zone==zone)[0];
            if (!db_zone)
                db_zone = zones.filter(i=>i.zone==effective_zone)[0];
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
                let plans = JSON.parse(db_zone.plans);
                if (plans.length && plans.pop().disable)
                {
                    info.push({msg: 'the zone is disabled',
                        lvl: 'err', field: 'zone'});
                }
            }
        }
        invalid_zone = info.length>info_length;
    }
    if (zone==_this._defaults.zone && password!=_this._defaults.password
        && _this._defaults.password)
    {
        info.push({msg: 'provided password overridden by default password for'+
            ' zone '+zone, lvl: 'warn', field: 'password'});
    }
    if (zone!==undefined && password && !invalid_zone)
    {
        if (!(yield _this.check_proxy_creds({zone, password})).result)
        {
            info.push({msg: 'the provided password is not valid',
                lvl: 'err', field: 'password'});
        }
    }
    else if (effective_zone==='gen'&&password)
    {
        info.push({msg: 'the password field should be absent for default zone',
            lvl: 'warn', field: 'password'});
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
    if (history && _ssl!==undefined && !_ssl)
    {
        info.push({
            msg: 'history without SSL sniffing will not record '
            +'HTTPS requests in full, it will only record the CONNECT '
            +'request',
            lvl: 'warn',
        });
    }
    if (history && debug=='none')
    {
        info.push({
            msg: 'history without debug info will not record '
            +'peer information per request',
            lvl: 'warn',
        });
    }
    if (socks!==undefined)
    {
        let in_use = yield _this.proxy_port_check(socks, multiply,
            old_proxy.socks, old_proxy.multiply);
        if (in_use)
            info.push({msg: 'socks port '+in_use, lvl: 'err', field: 'socks'});
    }
    if (socks)
    {
        let r_dns = reverse_lookup_dns===undefined ?
            old_proxy.reverse_lookup_dns : reverse_lookup_dns;
        let r_file = reverse_lookup_file===undefined ?
            old_proxy.reverse_lookup_file : reverse_lookup_file;
        let r_values = reverse_lookup_values===undefined ?
            old_proxy.reverse_lookup_values : reverse_lookup_values;
        if (!r_dns && !r_file && !r_values)
        {
            info.push({
                msg: 'SOCKS without \'Reverse DNS resolve\' will make '
                +'HTTPS requests from the super proxy and not from the '
                +'proxy peer',
                lvl: 'warn',
            });
        }
    }
    if ((null_response||bypass_proxy||direct_include||direct_exclude) &&
        _ssl!==undefined && !_ssl)
    {
        info.push({
            msg: 'Special URL handling without SSL sniffing will '
            +'only be able to handle HTTPS domains, and not specific '
            +'URLs',
            lvl: 'warn',
        });
    }
    if ((max_requests||session_duration) && !pool_size && !sticky_ip
        && new_proxy_config.session!==true)
    {
        info.push({
            msg: 'max_requests, session_duration will not take effect '
            +'without specifying pool_size, sticky_ip or random session',
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
    if (keep_alive && (new_proxy_config.keep_alive>60
        || new_proxy_config.keep_alive<0))
    {
        info.push({
            msg: 'keep_alive value is outside the effective range of 0-60',
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
            msg: 'session will not take effect when sticky_ip is specified',
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

E.prototype.config_check_api = function(req, res){
    let errors;
    try {
        errors = this.config_check(JSON.parse(req.body.config));
    } catch(e){ ef(e);
        this._log.debug('Config parsing error', e);
        errors = ['Config is not a valid JSON'];
    }
    res.json(errors);
};

E.prototype.config_check = function(config){
    if (!config.proxies)
        config = {proxies: [].concat(config)};
    if (!config._defaults)
        config._defaults = E.default;
    if (!config.proxies.length)
        config.proxies.push(config._defaults);
    const ports = {};
    const conflicts = {};
    const chk_port = (port, desc)=>{
        if (ports[port])
        {
            if (!conflicts[port])
                conflicts[port] = [ports[port], desc];
            else
                conflicts[port].push(desc);
        }
        else
            ports[port] = desc;
    };
    if (config._defaults.www)
        chk_port(config._defaults.www, 'UI/API');
    config.proxies.forEach((p, i)=>{
        const id = `Proxy #${i+1}`;
        const opt = assign({}, config._defaults, p);
        chk_port(opt.port, id);
        if (opt.socks)
            chk_port(opt.socks, id+' SOCKS');
        let multiply = p.multiply||1;
        for (let d = 1; d<multiply; ++d)
        {
            chk_port(opt.port+d, id+' Duplicate');
            if (opt.socks)
                chk_port(opt.socks+d, id+' Duplicate SOCKS');
        }
    });
    // XXX lee - add check for SOCKS tunnels and auto assigned ports
    return _.toPairs(conflicts).map(c=>`Conflict on port ${c[0]} was found `
        +'with the folowing configurations: '+c[1].join(', '));
};

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
    const _path = req.query.path||phantomjs.path;
    if (!fs.existsSync(_path))
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
            phantomPath: _path,
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

E.prototype.get_countries = etask._fn(function*get_countries(_this){
    let countries = yield cities.countries();
    countries = countries.map(c=>({
        key: c.country_name,
        value: c.country_id.toLowerCase(),
    }));
    countries.forEach(c=>c.key=`${c.key} (${c.value.toUpperCase()})`);
    countries.unshift({key: 'Any', value: '*'});
    countries.unshift({key: 'Default ('+(_this.opts.country||'Any')+')',
        value: ''});
    return countries;
});

E.prototype.get_regions = etask._fn(function*(_this, req, res){
    let regions = yield cities.regions(req.params.country_id);
    regions = regions.map(r=>({
        key: `${r.region_name} (${r.region_id.toUpperCase()})`,
        value: r.region_id,
    }));
    regions.unshift({key: 'Any', value: '*'});
    regions.unshift({key: 'Default ('+(_this.opts.state||'Any')+')',
        value: ''});
    res.json(regions);
});

E.prototype.get_cities = etask._fn(function*(_this, req, res){
    const c_id = req.params.country_id;
    const r_id = req.params.region_id;
    if (!c_id)
        return res.json([]);
    let _cities = yield cities.cities(c_id, r_id);
    _cities = _cities.map(c=>({
            key: c.city_name,
            value: c.city_name,
            region: c.region_id,
        }));
    _cities.unshift({key: 'Any', value: '*'});
    _cities.unshift({key: 'Default ('+(_this.opts.city||'Any')+')',
        value: ''});
    res.json(_cities);
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
    const for_db = s=>(s||'').replace("'", "''");
    const skip = +req.query.skip||0;
    const limit = +req.query.limit||0;
    let items, total;
    if (_this.db.history)
    {
        const where = {port: req.params.port};
        if (req.query.url)
            where.url = {$like: `%${req.query.url}%`};
        if (req.query.method)
            where.method = req.query.method;
        if (req.query.status_code)
            where.status_code = req.query.status_code;
        if (req.query.timestamp_min)
            where.timestamp = {$gte: req.query.timestamp};
        if (req.query.timestamp_max)
            where.timestamp = {$lte: req.query.timestamp};
        if (req.query.elapsed_min)
            where.elapsed = {$gte: req.query.elapsed};
        if (req.query.elapsed_max)
            where.elapsed = {$lte: req.query.elapsed};
        if (req.query.country)
            where.country = req.query.country;
        if (req.query.super_proxy)
            where.super_proxy = {$like: `%${req.query.super_proxy}%`};
        if (req.query.proxy_peer)
            where.proxy_peer = {$like: `%${req.query.proxy_peer}%`};
        if (req.query.context)
            where.context = {$like: `%${req.query.context}%`};
        const res = yield _this.db.history.models.request.findAndCountAll(
            {where, limit, offset: skip, raw: true});
        total = res.count;
        items = res.rows;
    }
    else
    {
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
        items = yield _this.sql(
            `SELECT * FROM request WHERE (${wheres.join(') AND (')})
            ORDER BY ${req.query.sort}${req.query.sort_desc ? ' DESC' : ''}`
            + (limit ? ` LIMIT ${limit} OFFSET ${skip}` : ''));
        let where = wheres.join(') AND (');
        total = (yield _this.sql(
            `SELECT COUNT(*) FROM request WHERE (${where})`))[0]['COUNT(*)'];
    }
    if (_this.mode!='root')
    {
        for (let row of items)
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
        total: total,
        skip: skip,
        limit: limit,
        items: items,
    };
});

E.prototype.sessions_get = etask._fn(function*sessions_get(_this, req, res){
    let port = req.params.port;
    let server = _this.proxies_running[port];
    if (!server)
    {
        return res.status(400)
        .json({errors: [{msg: `No proxy at port ${port}`}]});
    }
    if (req.query.refresh!==undefined)
        yield server.update_all_sessions();
    let sess;
    if (!server.opt.pool_size && server.opt.sticky_ip)
        sess = _.values(server.sticky_sessions||{});
    else if (server.opt.session)
        sess = [server.session];
    else
        sess = server.sessions||[];
    sess = sess.map(s=>_.pick(s, qw`info count bandwidth created host`));
    res.json({data: sess});
});

E.prototype.node_version = etask._fn(function*node_version(_this, req, res){
    const chk = yield etask.nfn_apply(check_node_version,
        [{node: pkg.recomendedNode}]);
    res.json({
        current: chk.node.version,
        satisfied: chk.nodeSatisfied,
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
        headers: {'x-hola-auth': `lum-customer-${_this._defaults.customer}`
            +`-zone-${_this._defaults.zone}-key-${_this._defaults.password}`},
    });
    const _stats = r.body[_this._defaults.customer];
    if (!_stats)
        yield _this.logged_update();
    res.json(_stats||{login_failure: _this.login_failure});
});

E.prototype.whitelist = etask._fn(function*whitelist(_this, req, res){
    const r = yield _this.json({
        url: 'https://luminati.io/api/get_whitelist?zones=*',
        headers: {'x-hola-auth': `lum-customer-${_this._defaults.customer}`
            +`-zone-${_this._defaults.zone}-key-${_this._defaults.password}`},
    });
    res.json(r.body);
});

E.prototype.recent_ips = etask._fn(function*recent_ips(_this, req, res){
    const r = yield _this.json({
        url: 'https://luminati.io/api/get_recent_ips?zones=*',
        headers: {'x-hola-auth': `lum-customer-${_this._defaults.customer}`
            +`-zone-${_this._defaults.zone}-key-${_this._defaults.password}`},
    });
    res.json(r.body);
});

E.prototype.get_params = function(){
    const args = [];
    for (let k in this.argv)
    {
        if (qw`$0 h help version p ? v`.includes(k))
            continue;
        if (credential_fields.includes(k))
            continue;
        if (this.argv[k]==E.default[k])
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
    if (!this.argv.config)
    {
        // must provide these as args to enable login w/o config
        for (let k of credential_fields.sort())
        {
            if (this._defaults[k])
                args.push(`--${k}`, this._defaults[k]);
        }
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
        const result = yield _this.json({
            url: 'http://lumtest.com/myip.json',
            method: 'GET',
            headers: {
                'x-hola-agent': Luminati.hola_agent,
                'user-agent': Luminati.user_agent,
            }
        });
        return result.body;
    } catch(e){ ef(e); return false; }
});

E.prototype.check_proxy_creds = etask._fn(
function*check_proxy_creds(_this, cred){
    if (_this.run_config.bypass_credentials_check)
        return {result: true, error: false};
    try {
        cred = _.pick(assign({}, _this._defaults, cred), credential_fields);
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
    let config = yield _this.login_user(req.body.token,
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
    let zone_autoupdate =
        config.defaults.zone && config.defaults.zone!=_this.argv.zone ?
        {zone: config.defaults.zone, prev: _this.argv.zone} : false;
    assign(_this._defaults, config.defaults);
    _this.save_config();
    res.json({result: 'ok'});
    _this.emit('config_changed', zone_autoupdate);
});

E.prototype.proxies_running_get = etask._fn(
function*proxies_running_get(_this, req, res){
    let rows = yield _this.sql('SELECT DISTINCT port FROM request');
    let index = {};
    for (let row of rows)
        index[row.port] = true;
    res.json(_.values(_this.proxies_running).map(p=>{
        let proxy = _.cloneDeep(p.opt);
        proxy._stats = p.stats;
        proxy._history = p.opt.history||index[proxy.port]||false;
        proxy._status = p.status;
        proxy.config = p.config;
        return proxy;
    }));
});

E.prototype.ip_get = etask._fn(function*ip_get(_this, req, res){
    const ip = yield _this.get_ip();
    res.json({ip: ip});
});

E.prototype.allocated_ips_get = etask._fn(function*(_this, req, res){
    const r = yield _this.json({
        url: 'https://luminati.io/users/zone/alloc_ips',
        headers: {'x-hola-auth': `lum-customer-${_this._defaults.customer}`
        +`-zone-${req.query.zone}-key-`
        +(req.query.key||_this._defaults.password)},
    });
    res.send(r.body);
});

E.prototype.shutdown = function(req, res){
    res.json({result: 'ok'});
    this.stop(true);
};

E.prototype.logout = function(req, res){
    for (let k of credential_fields)
        this._defaults[k] = '';
    this.save_config();
    res.json({result: 'ok'});
    this.emit('config_changed');
};

E.prototype.restart = function(req, res){
    this.emit('restart');
    res.json({result: 'ok'});
};

E.prototype.upgrade = etask._fn(function*upgrade(_this, req, res){
    yield _this.stop_dbs();
    _this.emit('upgrade', e=>e ? res.status(403).send(e)
        : res.json({result: 'ok'}));
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
    app.get('/proxies', this._api((req, res)=>res.json(this.proxies)));
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
    app.post('/config_check', this._api(this.config_check_api, ['root']));
    app.get('/resolve', this._api(this.resolve_get, ['root']));
    app.post('/resolve', this._api(this.resolve_set, ['root']));
    app.get('/resolve_host/:host', this._api(this.resolve_host));
    app.get('/mode', this._api((req, res)=>res.json({mode: this.mode,
        logged_in: this.logged_in, login_failure: this.login_failure,
        run_config: this.run_config})));
    app.get('/ip', this._api(this.ip_get, ['root']));
    app.get('/allocated_ips', this._api(this.allocated_ips_get, ['root']));
    app.post('/shutdown', this._api(this.shutdown, ['root']));
    app.post('/logout', this._api(this.logout));
    app.post('/upgrade', this._api(this.upgrade, ['root']));
    app.post('/restart', this._api(this.restart, ['root']));
    app.post('/recheck', this._api(this.recheck));
    app.get('/regions/:country_id', this._api(this.get_regions));
    app.get('/cities/:country_id/:region_id?', this._api(this.get_cities));
    app.get('/zones', this._api(this.get_zones_api));
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
    app.get(/^\/((|proxies|tools|faq)|zones(\/[^\/]+)?)$/, _this._api(
        (req, res, next)=>{
            setInterval(()=>etask(function*(){
                try {
                    yield cities.ensure_data();
                } catch(e){ ef(e);
                    _this._log.error('Failed to load cities data', e);
                    _this._log.silly(e.stack);
                }
            }), 0);
            req.url = '/index.html';
            next('route');
        }
    ));
    app.use(express.static(path.resolve(__dirname, '../bin/pub')));
    app.use('/uib', express.static(path.resolve(__dirname,
        '../node_modules/angular-ui-bootstrap')));
    app.use('/req', express.static(path.resolve(__dirname,
        '../node_modules')));
    app.use((req, res, next)=>{
        if (req.accepts('html'))
            return res.redirect(301, '/');
        res.status(404);
        if (req.accepts('json'))
            return res.send({ error: 'Not found' });
        res.type('txt').send('Not found');
    });
    app.use(function(err, req, res, next){
        _this._log.error(err.message, err.stack);
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
        for (let p of _this.proxies)
        {
            if (p.port==ports.remote && (!p.socks||p.socks==ports.local))
            {
                p.socks = ports.local;
                _this._log.debug(
                    `Attaching socks ${ports.local} to proxy ${p.port}`);
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
    let proxies = _this.proxies.map(c=>_this.create_proxy(c));
    yield etask.all(proxies);
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
    return yield _this.db.main.stmt.proxy_remove.run({$host});
});

E.prototype.logged_update = etask._fn(function*logged_update(_this){
    if (_this._defaults.customer)
    {
        let auth = yield _this.check_user();
        _this.logged_in = auth.result;
        _this.login_failure = auth.error;
    }
    else
    {
        _this.logged_in = false;
        _this.login_failure = false;
    }
});

E.prototype._get_cookie_jar = function(){
    const jarpath = path.resolve(os.homedir(),
        '.luminati.jar'.substr(is_win ? 1 : 0));
    if (!fs.existsSync(jarpath))
        fs.writeFileSync(jarpath, '');
    try { return request.jar(new cookie_filestore(jarpath)); }
    catch(e){
        this._log.debug('Error accessing cookie jar: '+e);
        fs.unlinkSync(jarpath);
        fs.writeFileSync(jarpath, '');
    }
    try { return request.jar(new cookie_filestore(jarpath)); }
    catch(e){ return request.jar(); }
};

E.prototype.get_lum_local_conf = etask._fn(
function*get_lum_local_conf(_this, customer, token){
    customer = customer||_this._defaults.customer;
    token = token||_this._defaults.token;
    if (!_this.lum_conf)
        _this.lum_conf = {ts: 0};
    let now = Date.now();
    if (_this.lum_conf._defaults && now-_this.lum_conf.ts < 60*1000)
        return _this.lum_conf;
    if (!_this.luminati_jar)
        _this.luminati_jar = {jar: _this._get_cookie_jar()};
    _this._log.silly('Login attempt with ', {customer, token});
    let config = yield etask.nfn_apply(request, [{
        qs: {customer, token},
        url: `${lum_url}/cp/lum_local_conf`,
        jar: _this.luminati_jar.jar,
    }]);
    if (config.statusCode!=200)
        throw {status: config.statusCode, message: config.body};
    _this.lum_conf = JSON.parse(config.body);
    _this.lum_conf.ts = now;
    if (_this.lum_conf._defaults &&
        (_this.lum_conf._defaults.customer != _this._defaults.customer ||
        _this.lum_conf._defaults.zone != _this._defaults.zone ||
        _this.lum_conf._defaults.password != _this._defaults.password))
    {
        assign(_this._defaults, _this.lum_conf._defaults);
    }
    if (token)
        assign(_this._defaults, {token});
    return _this.lum_conf;
});

E.prototype.check_user = etask._fn(
function*check_user(_this){
    try {
        yield _this.get_lum_local_conf();
        return {result: true, error: ''};
    } catch(e){
        return {result: false, error: 'You are not logged in.'};
    }
});

E.prototype.login_user = etask._fn(
function*login_user(_this, token, username, password, customer){
    let config;
    try { config = yield _this.get_lum_local_conf(customer, token); }
    catch(e){
        if (!e.status)
            throw e;
    }
    if (config&&!config.customers)
        return {defaults: config._defaults};
    if (!token && (_this.luminati_jar.password!=password
        || _this.luminati_jar.username!=username))
    {
        let jar = _this.luminati_jar.jar;
        yield etask.nfn_apply(request, [{url: lum_url, jar: jar}]);
        let xsrf = jar.getCookies(lum_url).find(e=>e.key=='XSRF-TOKEN').value;
        let response = yield etask.nfn_apply(request, [{
            method: 'POST',
            url: `${lum_url}/users/auth/basic/check_credentials`,
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
                        +`<a href="${lum_url}/?need_signup=1" target=_blank>`
                        +`Click here to sign up.</a>`,
                    email: true,
                }};
            }
            return {error: {
                message: `The password is incorrect. `
                    +`<a href="${lum_url}/forgot_password?email=`
                    +`${encodeURIComponent(username)}" target=_blank>`
                    +`Forgot your password?</a>`,
                password: true,
            }};
        }
        _this.luminati_jar = {jar: jar, username: username,
            password: password};
    }
    config = yield _this.get_lum_local_conf(customer, token);
    if (customer)
    {
        yield etask.nfn_apply(request, [{
            method: 'POST',
            url: `${lum_url}/api/whitelist/add`+(token ? '?token='+token : ''),
            jar: _this.luminati_jar && _this.luminati_jar.jar,
            json: true,
            body: {customer, zone: config._defaults.zone}
        }]);
    }
    return !customer && config.customers.length>1 ?
        {customers: config.customers.sort()} : {defaults: config._defaults};
});

E.prototype.start = etask._fn(function*start(_this){
    try {
        let errors = _this.config_check({_defaults: _this.argv,
            proxies: _this.proxies});
        if (errors.length)
        {
            _this.emit('error', {message: 'Config errors', errors: errors});
            throw new Error('Config errors: ' + JSON.stringify(errors));
        }
        yield _this.prepare_database();
        _this.db.main.stmt = {
            proxy_remove: _this.db.main.prepare(`DELETE FROM proxy_hosts
                WHERE host=$host`),
            history: _this.db.main.prepare(`INSERT INTO request (port, url,
                method, request_headers, request_body, response_headers,
                status_code, status_message, timestamp, elapsed, response_time,
                node_latency, country, timeline, super_proxy, proxy_peer,
                username, content_size, context) VALUES ($port, $url, $method,
                $request_headers, $request_body, $response_headers,
                $status_code, $status_message, $timestamp, $elapsed,
                $response_time, $node_latency, $country, $timeline,
                $super_proxy, $proxy_peer, $username, $content_size,
                $context)`),
        };
        if (_this.argv.database_history)
        {
            _this.db.history = new sequelize(
                _this.argv.database_history, {logging: false});
            _this.db.history.define('request', {
                port: sequelize.INTEGER,
                url: sequelize.TEXT,
                method: sequelize.TEXT,
                request_headers: sequelize.TEXT,
                request_body: sequelize.TEXT,
                response_headers: sequelize.TEXT,
                status_code: sequelize.INTEGER,
                status_message: sequelize.TEXT,
                timestamp: sequelize.INTEGER,
                elapsed: sequelize.INTEGER,
                response_time: sequelize.INTEGER,
                node_latency: sequelize.INTEGER,
                proxy_peer: sequelize.TEXT,
                country: sequelize.TEXT,
                timeline: sequelize.TEXT,
                super_proxy: sequelize.TEXT,
                username: sequelize.TEXT,
                content_size: sequelize.INTEGER,
                context: sequelize.TEXT,
            });
            yield _this.db.history.sync();
        }
        yield _this.logged_update();
        yield _this.create_socks_servers();
        yield _this.init_proxies();
        if (_this.argv.www)
        {
            _this.www_server = yield _this.create_web_interface();
            _this.emit('www_ready', _this.www_server.url);
            console.log('admin is available at '+_this.www_server.url);
        }
    } catch(e){ ef(e);
        if (e.message!='canceled')
            _this._log.error('start error', e, e.stack);
        throw e;
    }
});

E.md5_files = function(files){
    files = files||glob.readdirSync('**/*');
    let hash = crypto.createHash('md5');
    files.forEach(f=>{
        if (fs.lstatSync(f).isFile())
            hash.update(fs.readFileSync(f));
    });
    return hash.digest('hex');
};
