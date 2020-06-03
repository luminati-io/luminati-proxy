#!/usr/bin/env node
// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/
const express = require('express');
const https = require('https');
const http = require('http');
const http_shutdown = require('http-shutdown');
const body_parser = require('body-parser');
const etask = require('../util/etask.js');
const file = require('../util/file.js');
const zerr = require('../util/zerr.js');
const logger = require('./logger.js');
const consts = require('./consts.js');
const util_lib = require('./util.js');

const Zagent_api = etask._class(class Zagent_api {
    constructor(mgr){
        this.mgr = mgr;
    }
    *enable_api(_this, req, res){
        yield _this.mgr.apply_cloud_config(req.body.config, {force: 1});
        res.json({status: 'ok'});
    }
    disable_api(req, res){
        this.mgr.restart({cleanup: 1});
        res.json({status: 'ok'});
    }
    create_server(app){
        logger.notice('Starting up zagent API');
        let cert, key;
        if (process.env.SSL_CERT && process.env.SSL_KEY)
        {
            cert = file.read_e(process.env.SSL_CERT);
            key = file.read_e(process.env.SSL_KEY);
            return https.createServer({cert, key}, app);
        }
        logger.warn('Running zagent server without SSL encryption!');
        return http.createServer({cert, key}, app);
    }
    error_handler(err, req, res, next){
        logger.error('Zagent API error: %s %s %s', req.method, req.originalUrl,
            zerr.e2s(err));
        res.status(500).send('Server error: '+err.message);
    }
    *start(_this){
        const app = express();
        app.use(logger.get_api_mw(consts.ZAGENT_API_PORT));
        app.use(body_parser.urlencoded({extended: true, limit: '10mb'}));
        app.use(body_parser.json({limit: '10mb'}));
        app.post('/api/enable', _this.enable_api.bind(_this));
        app.post('/api/disable', _this.disable_api.bind(_this));
        app.use(_this.error_handler.bind(_this));
        _this.server = _this.create_server(app);
        _this.server.on('error', err=>{
            _this.mgr.error_handler('zagent API', err);
        });
        http_shutdown(_this.server);
        yield etask.cb_apply(_this.server, '.listen', [consts.ZAGENT_API_PORT,
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
            util_lib.perr('zagent_register', {error: zerr.e2s(e)});
        }
    }
});

module.exports = Zagent_api;
