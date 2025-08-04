// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true, evil: true, es9: true*/
const path = require('path');
const http_shutdown = require('http-shutdown');
const _ = require('lodash4');
const {Netmask} = require('netmask');
const cookie = require('cookie');
const body_parser = require('body-parser');
const compression = require('compression');
const express = require('express');
const pkg = require('../../package.json');
const zerr = require('../../util/zerr.js');
const etask = require('../../util/etask.js');
const zws = require('../../util/ws.js');
const logger = require('../logger.js').child({category: 'WEBSRV'});
const ssl = require('../ssl.js');
const mw = require('../middleware.js');
const util_lib = require('../util.js');
const mixin_core = require('./core.js');

const MIXIN_LABEL = module.exports = 'mgr_web_server';

const E = mixin_core.new_mixin(MIXIN_LABEL);

E.prototype.user_auth = function(query){
    const {user, password} = query;
    return user && password && this.lpm_users.some(u=>
        user==u.email && password==u.password);
};

E.prototype.whitelist_auth = function(ip){
    const whitelist_blocks = [...new Set([
        ...this._defaults.www_whitelist_ips||[],
        ...this.mgr_opts.www_whitelist_ips||[],
        '127.0.0.1',
    ])].map(wl=>{
        try {
            return new Netmask(wl);
        } catch(e){}
    }).filter(Boolean);
    const empty = !this._defaults || !this._defaults.password &&
        !this.proxies.map(p=>p.password).filter(Boolean).length;
    const can_skip = empty && !this.argv.zagent;
    return can_skip || whitelist_blocks.some(wb=>{
        try {
            return wb.contains(ip);
        } catch(e){ return false; }
    });
};

E.prototype.authenticate_ws = function({req}, cb){
    req.remote_ip = util_lib.req_util.get_remote_ip(req);
    req.query = {};
    let err = this.authenticate(req, false);
    if (!err)
        return void cb(true);
    logger.warn(`WS connection from ${req.remote_ip} rejected.`);
    cb(false, err.status, err.msg);
};

E.prototype.authenticate_mw = function(req, res, next){
    req.remote_ip = util_lib.req_util.get_remote_ip(req);
    let err = this.authenticate(req, true);
    if (!err)
        return void next();
    logger.warn('Access denied for %s %s', req.remote_ip, req.url);
    this.err2res(err, res);
};

E.prototype.authenticate = function(req, allow_bypass){
    const err = {}, [endpoint] = req.url?.split('?') || ['/'];
    const bypass = allow_bypass && ['/version', '/add_wip', '/cloud_auth',
        '/lpm_stats', '/i18n'].includes(endpoint);
    const cookies = cookie.parse(req.headers.cookie||'');
    const lpm_token = (this._defaults.lpm_token||'').split('|')[0];
    const is_cloud_auth = lpm_token && cookies.lpm_token==lpm_token;
    if (!this.whitelist_auth(req.remote_ip) && !bypass && !is_cloud_auth &&
        !this.user_auth(req.query))
    {
        err.status = 403;
        if (req.query.user && req.query.password)
        {
            err.msg = 'Auth Failed';
            return err;
        }
        err.headers = {'x-lpm-block-ip': req.remote_ip};
        this.pending_www_ips.add(req.remote_ip);
        err.msg = `Connection from your IP is forbidden. If you`
            +` want to access this site ask the administrator to add`
            +` ${req.remote_ip} to the whitelist. for more info visit`
            +` ${this._defaults.www_help}/hc/en-us/articles/13594866940945`
            +`-Security#heading-1`;
        return err;
    }
    const reseller_user_api = ['/bw_limit_stats/', '/refresh_sessions/',
        '/generate_proxies/'];
    if (this.argv.zagent && this.is_reseller() && this.user_auth(req.query)
        && !reseller_user_api.some(x=>endpoint.startsWith(x)))
    {
        err.status = 403;
        err.msg = 'Auth Failed';
        return err;
    }
    const passwd = Array.isArray(this._defaults.password) ?
        this._defaults.password[0] : this._defaults.password;
    const is_local_authenticated = this.user_auth(req.query) ||
        !this.argv.local_login || passwd && cookies['local-login']==passwd;
    if (!is_local_authenticated && !['/version', '/creds_user', '/defaults',
        '/node_version', '/last_version', '/conn', '/all_locations',
        '/last_version', '/lpm_stats'].includes(endpoint))
    {
        err.status = 403;
        err.headers = {'x-lpm-local-login': 'Unauthorized'};
        err.msg = 'This Proxy Manager instance is running in '
        +'local_login mode. You need to sign in to get an access to this '
        +'resource';
        return err;
    }
};

const print_ui_running = _url=>{
    const boxed_line = str=>{
        const repeat = 50;
        const box = '=';
        const wall = '|';
        if (!str)
            str = box.repeat(repeat-2);
        const ws = Math.max(0, (repeat-2-str.length)/2);
        const ws1 = ' '.repeat(Math.ceil(ws));
        const ws2 = ' '.repeat(Math.floor(ws));
        return wall+ws1+str+ws2+wall;
    };
    logger.system([
        `Proxy Manager is running`,
        boxed_line(),
        boxed_line(' '),
        boxed_line(' '),
        boxed_line('Open admin browser:'),
        boxed_line(_url),
        boxed_line('ver. '+pkg.version),
        boxed_line(' '),
        boxed_line('Do not close the process while using the'),
        boxed_line('Proxy Manager                           '),
        boxed_line(' '),
        boxed_line(' '),
        boxed_line(),
    ].join('\n'));
};

E.prototype.create_web_interface = etask._fn(function*(_this){
    const app = express();
    app.disable('x-powered-by');
    const main_page = (req, res, next)=>{
        res.header('Cache-Control',
            'private, no-cache, no-store, must-revalidate');
        res.header('Expires', '-1');
        res.header('Pragma', 'no-cache');
        if (_this.whitelist_auth(util_lib.req_util.get_remote_ip(req)))
            _this.set_lpm_token_cookie(req, res);
        res.sendFile(path.join(__dirname+'/../../bin/pub/index.html'));
    };
    app.use(mw.preprocess);
    app.use(mw.security.cookies(_this._defaults.lpm_token,
        _this.argv.session_path));
    app.use(compression());
    app.use(body_parser.urlencoded({
        extended: true,
        limit: _this.argv.api_body_limit,
        parameterLimit: _this.argv.api_parameter_limit,
    }));
    app.use(body_parser.json({
        limit: _this.argv.api_body_limit,
        parameterLimit: _this.argv.api_parameter_limit,
    }));
    app.use('/api/v2', _this.create_api_v2());
    app.use('/api', _this.create_api());
    app.get('/ssl', (req, res)=>{
        res.set('content-type', 'application/x-x509-ca-cert');
        res.set('content-disposition', 'filename=luminati.crt');
        res.send(ssl.ca.cert);
    });
    app.get('/', main_page);
    app.use(express.static(path.resolve(__dirname, '../../bin/pub')));
    app.get('*', main_page);
    app.use(function(err, req, res, next){
        logger.error(zerr.e2s(err));
        res.status(500).send('Server Error');
    });
    const server = _this.create_api_server(app);
    http_shutdown(server);
    server.on('error', err=>_this.error_handler('WWW', err));
    server.stop = force=>etask(function*mgr_server_stop(){
        server.running = false;
        const stop_method = force ? '.forceShutdown' : '.shutdown';
        return yield etask.nfn_apply(server, stop_method, []);
    });
    yield etask.cb_apply(server, '.listen', [_this.argv.www,
        util_lib.find_iface(_this.argv.iface)||'0.0.0.0']);
    const port = server.address().port;
    let address = server.address().address;
    if (address=='0.0.0.0')
        address = '127.0.0.1';
    server.url = `http://${address}:${port}`;
    return server;
});

E.prototype.init_web_interface = etask._fn(function*(_this){
    if (!_this.argv.www)
        return logger.notice('Web interface will not be created');
    logger.system('Creating web interface...');
    _this.www_server = yield _this.create_web_interface();
    print_ui_running(_this.www_server.url);
    _this.emit('www_ready', _this.www_server.url);
});

E.prototype.start_web_socket = function(server){
    if (!server || this.argv.high_perf || !this._defaults.ui_ws)
        return;
    class Frontend_ws {
        constructor(conn, mgr){
            this.conn = conn;
            this.mgr = mgr;
        }
        hello(msg){
            logger.notice('hello msg %s', msg);
        }
        ui_event(msg){
            let username = cookie.parse(msg.cred||'').username
                || this.mgr.last_username;
            this.mgr.lpm_f.event(msg.name, 'UI', username, {
                ui_ver: this.mgr.get_ui_ver(),
                ..._.omit(msg, ['name', 'cred']),
            });
        }
    }
    this.wss = new zws.Server({
        impl: 'ws',
        http_server: server,
        verify: this.authenticate_ws.bind(this),
        ipc_server: ['hello', 'ui_event'],
    }, conn=>new Frontend_ws(conn, this));
};
