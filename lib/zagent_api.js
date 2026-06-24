#!/usr/bin/env node
// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/
const http = require('http');
const express = require('express');
const http_shutdown = require('http-shutdown');
const body_parser = require('body-parser');
const etask = require('../util/etask.js');
const date = require('../util/date.js');
const {e2s} = require('../util/zerr.js');
const zutil = require('../util/util.js');
const {WWW_API} = require('../util/rules_util.js');
const logger = require('./logger.js').child({category: 'MNGR: zagent API'});
const {ZAGENT_API_PORT} = require('./consts.js');
const util_lib = require('./util.js');
const middleware = require('./middleware.js');

const Zagent_api = etask._class(class Zagent_api {
    constructor(mgr){
        this.mgr = mgr;
        this.started_at = date();
    }
    *enable_api(_this, req, res){
        try {
            const {customer, account_id, lpm_token} = zutil.get(req,
                'body.config._defaults', {});
            logger.info('enable_api: customer=%s account_id=%s lpm_token=%s',
                customer, account_id, lpm_token);
            yield _this.mgr.apply_cloud_config(req.body.config, {force: 1});
            res.json({status: 'ok'});
        } catch(e){
            logger.error('error during enable_api: %s', e2s(e));
            util_lib.perr('error', {error: e2s(e), ctx: 'enable_api'});
        }
    }
    update_token_api(req, res){
        const {lpm_token} = zutil.get(req, 'body', {});
        if (!lpm_token)
            return res.status(403).json({error: 'missing lpm_token'});
        logger.info('update_token_api: lpm_token=%s', lpm_token);
        this.mgr._defaults.lpm_token = lpm_token;
        this.mgr.config.save({skip_cloud_update: 1});
        this.mgr.restart();
        res.json({status: 'ok'});
    }
    disable_api(req, res){
        logger.info('disable_api: %s', req.body.reason);
        this.mgr.restart({cleanup: 1});
        res.json({status: 'ok'});
    }
    restart_api(req, res){
        logger.info('restart_api');
        this.mgr.restart();
        res.set('Access-Control-Allow-Origin', WWW_API).json({status: 'ok'});
    }
    info_api(req, res){
        res.json({
            customer: this.mgr._defaults.customer,
            lpm_token: this.mgr._defaults.lpm_token,
            started_at: this.started_at,
        });
    }
    *stress_test_ws(_this, req, res){
        try {
            yield _this.mgr.lpm_f.get_vipdb();
            res.json({status: 'ok'});
        } catch(e){
            res.status(500).json({error: e2s(e)});
        }
    }
    create_server(app){
        let [https_server, err] = util_lib.create_ssl_server(app,
            this.mgr.lpm_conn.certs);
        if (https_server)
            return https_server;
        logger.warn('running server without SSL encryption! %s', err.message);
        return http.createServer(app);
    }
    error_handler(err, req, res, next){
        logger.error('error: %s %s %s', req.method, req.originalUrl, e2s(err));
        res.status(500).send('Server error: '+err.message);
    }
    *start(_this){
        const app = express();
        app.disable('x-powered-by');
        app.use(middleware.rate_limit.default);
        app.use(middleware.logger.api(ZAGENT_API_PORT));
        app.use(body_parser.urlencoded({extended: true, limit: '10mb'}));
        app.use(body_parser.json({limit: '10mb'}));
        app.post('/api/enable', _this.enable_api.bind(_this));
        app.post('/api/disable', _this.disable_api.bind(_this));
        app.post('/api/restart', _this.restart_api.bind(_this));
        app.post('/api/update_token', _this.update_token_api.bind(_this));
        app.get('/api/info', _this.info_api.bind(_this));
        app.get('/api/stress_test_ws', _this.stress_test_ws.bind(_this));
        app.use(_this.error_handler.bind(_this));
        _this.server = _this.create_server(app);
        _this.server.on('error', err=>{
            _this.mgr.error_handler('zagent API', err);
        });
        http_shutdown(_this.server);
        yield etask.cb_apply(_this.server, '.listen', [ZAGENT_API_PORT,
            '0.0.0.0']);
        return _this.server;
    }
    *stop(_this, force){
        const stop_method = force ? '.forceShutdown' : '.shutdown';
        return yield etask.nfn_apply(_this.server, stop_method, []);
    }
    *register_online(_this){
        try {
            yield _this.mgr.api_request({
                endpoint: '/lpm/register_zagent',
                method: 'POST',
                force: 1,
            });
        } catch(e){
            logger.warn('could not register zagent %s', e.message);
            util_lib.perr('error', {error: e2s(e), ctx: 'zagent_reg'});
        }
    }
    *bootstrap(_this){
        logger.notice('bootstrap');
        yield _this.start();
        yield _this.register_online();
        logger.notice('done');
    }
});

module.exports = Zagent_api;
