// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/
const _ = require('lodash4');
const express_rate_limit = require('express-rate-limit');
const express_session = require('express-session');
const loki_store = require('connect-loki')(express_session);
const helmet = require('helmet');
const date = require('../util/date.js');
const lpm_api_models = require('../util/lpm_api_models.js');
const lpm_util = require('./util.js');
const logger = require('./logger.js').child({category: 'MW'});
const {RL_MAX_REQS, RL_WINDOW, HL_TRANSPORT_MAX_AGE} = require('./consts.js');
const E = module.exports;

const add_successor_header = (res, link)=>{
    if (link)
        res.set('Link', `<${link}>; rel="successor-version"`);
};

E.rate_limit = {
    default: express_rate_limit({
        windowMs: RL_WINDOW,
        max: RL_MAX_REQS,
        message: `You have exceeded the ${RL_MAX_REQS} requests in`
            +` ${date.describe_interval(RL_WINDOW)} limit.`,
        statusCode: 429,
        standardHeaders: true,
        legacyHeaders: false,
        handler: (req, res, next, opt)=>{
            logger.warn(`${req.ip} reached default rate limit on ${req.path}`);
            res.status(opt.statusCode).send(opt.message);
        },
        keyGenerator: req=>req.ip+req.method+req.originalUrl,
    }),
};

E.logger = {
    api: logger.get_api_mw,
};

E.security = {
    headers: helmet({
        strictTransportSecurity: {
            maxAge: HL_TRANSPORT_MAX_AGE,
        },
    }),
    cookies: (secret, session_path)=>{
        if (!secret)
            secret = 'lpm_secret';
        return express_session({
            resave: true,
            saveUninitialized: false,
            cookie: {
                httpOnly: true,
                sameSite: true,
            },
            secret,
            store: new loki_store({
                path: session_path,
                logErrors: err=>logger.error(`Session storage error: ${err}`),
            }),
        });
    },
};

E.deprecation = {
    default: successor_link=>(req, res, next)=>{
        res.set('Deprecation', true);
        add_successor_header(res, successor_link);
        next();
    },
    from: (from, successor_link)=>(req, res, next)=>{
        res.set('Deprecation', date.to_jdate(from));
        add_successor_header(res, successor_link);
        next();
    },
    sunset: from=>(req, res, next)=>{
        res.set('Sunset', date.to_jdate(date.add(from, {day: 1, sec: -1})));
        next();
    },
};

const coerce_conf = (source, schema)=>Object.keys(source).forEach(k=>{
    if (!schema[k] || !schema[k].type)
        return;
    const required = lpm_util.alias_type(schema[k].type);
    const actual = typeof source[k];
    if (actual != required)
        source[k] = lpm_util.get_coercer(actual, required)(source[k]);
});

E.validator = {
    port_conf: (req, res, next)=>{
        if (_.isEmpty(req.body) || _.isEmpty(req.body.proxy))
            return void next();
        coerce_conf(req.body.proxy, lpm_api_models.proxy_fields);
        next();
    },
    settings: (req, res, next)=>{
        if (_.isEmpty(req.body))
            return void next();
        coerce_conf(req.body, lpm_api_models.manager_fields);
        next();
    },
};

E.preprocess = (req, res, next)=>{
    if (lpm_util.req_util.get_remote_ip(req)=='127.0.0.1')
        req.is_localhost = true;
    next();
};
