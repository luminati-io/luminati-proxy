// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/
const crypto = require('crypto');
const path = require('path');
const _ = require('lodash4');
const express_rate_limit = require('express-rate-limit');
const express_session = require('express-session');
const loki_store = require('connect-loki')(express_session);
const helmet = require('helmet');
const date = require('../util/date.js');
const file = require('../util/file.js');
const lpm_file = require('../util/lpm_file.js');
const lpm_api_models = require('../util/lpm_api_models.js');
const lpm_util = require('./util.js');
const logger = require('./logger.js').child({category: 'MW'});
const {RL, HL_TRANSPORT_MAX_AGE} = require('./consts.js');
const {keys} = Object;
const E = module.exports;
const add_successor_header = (res, link)=>{
    if (link)
        res.set('Link', `<${link}>; rel="successor-version"`);
};

E.get_express_session_secret = ()=>{
    const secret_path = path.resolve(lpm_file.work_dir,
        'express_session.secret');
    try {
        const secret = file.read_e(secret_path).trim();
        if (/^[a-f0-9]{64}$/.test(secret))
        {
            logger.system('Loaded session secret file');
            return secret;
        }
        logger.system('Invalid session secret file');
        E.remove_express_session_secret();
    } catch(e){
        if (e.code!='ENOENT')
        {
            logger.system('Failed to read session secret file [%s]: %s',
                e.code||0, e.message);
        }
    }
    logger.system('Generating session secret file');
    const secret = crypto.randomBytes(32).toString('hex');
    try {
        file.write_e(secret_path, secret, {
            encoding: 'utf8',
            mode: 0o600,
            flag: 'wx',
        });
        return secret;
    } catch(e){
        logger.system('Failed to generate session secret file [%s]: %s',
            e.code||0, e.message);
    }
    logger.system('Using session secret fallback');
    return secret;
};

E.remove_express_session_secret = ()=>{
    const secret_path = path.resolve(lpm_file.work_dir,
        'express_session.secret');
    try {
        file.unlink_e(secret_path);
        logger.system('Session secret file removed');
    } catch(e){
        if (e.code!='ENOENT')
        {
            logger.system('Failed to remove session secret file [%s]: %s',
                e.code||0, e.message);
        }
    }
};

const make_rl = ({window, max_reqs})=>express_rate_limit({
    windowMs: window,
    max: max_reqs,
    message: `You have exceeded the ${max_reqs} requests in`
        +` ${date.describe_interval(window)} limit.`,
    statusCode: 429,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (req, res, next, opt)=>{
        logger.warn(req.ip+' reached rate limit on '+req.path);
        res.status(opt.statusCode).send(opt.message);
    },
    skipFailedRequests: false,
    requestWasSuccessful: (req, res)=>res.statusCode<400,
    keyGenerator: req=>express_rate_limit.ipKeyGenerator(req.ip)
        +req.method+req.originalUrl,
});

const make_csp = (source, override={})=>{
    const csp = source||helmet.contentSecurityPolicy.getDefaultDirectives();
    keys(override).forEach(directive=>{
        if (!override[directive])
            return delete csp[directive];
        csp[directive] = override[directive];
    });
    return csp;
};

E.rate_limit = {
    default: make_rl(RL.DEF),
    gen: make_rl(RL.GEN),
};

E.logger = {
    api: logger.get_api_mw,
};

E.security = {
    headers: helmet({
        strictTransportSecurity: {
            maxAge: HL_TRANSPORT_MAX_AGE,
        },
        contentSecurityPolicy: {
            useDefaults: false,
            directives: make_csp(null, {
                'upgrade-insecure-requests': false,
                'style-src': ['\'self\''],
            }),
        },
    }),
    cookies: session_path=>express_session({
        resave: true,
        saveUninitialized: false,
        cookie: {
            httpOnly: true,
            sameSite: true,
        },
        secret: E.get_express_session_secret(),
        store: new loki_store({
            path: session_path,
            logErrors: err=>logger.error(`Session storage error: ${err}`),
        }),
    })
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

const coerce_conf = (source, schema)=>keys(source).forEach(k=>{
    if (!schema[k] || !schema[k].type)
        return;
    const required = lpm_util.alias_type(schema[k].type);
    const actual = typeof source[k];
    if (actual != required)
        source[k] = lpm_util.get_coercer(actual, required)(source[k]);
    if (lpm_util.bool_str.includes(source[k]))
        source[k] = lpm_util.coercers.string.boolean(source[k]);
});

const empty_arrays = obj=>keys(obj).forEach(k=>{
    if (Array.isArray(obj[k]) && obj[k].length==1 && obj[k][0]==='')
        obj[k] = [];
});

const coerce_rules = source=>{
    if (!Array.isArray(source.rules))
        return;
    source.rules.forEach(rule=>lpm_util.try_int_r(rule));
};

E.validator = {
    port_conf: (req, res, next)=>{
        if (_.isEmpty(req.body) || _.isEmpty(req.body.proxy))
            return void next();
        coerce_conf(req.body.proxy, lpm_api_models.proxy_fields);
        empty_arrays(req.body.proxy);
        coerce_rules(req.body.proxy);
        next();
    },
    settings: (req, res, next)=>{
        if (_.isEmpty(req.body))
            return void next();
        coerce_conf(req.body, lpm_api_models.manager_fields);
        empty_arrays(req.body);
        next();
    },
};

E.preprocess = (req, res, next)=>{
    if (lpm_util.req_util.get_remote_ip(req)=='127.0.0.1')
        req.is_localhost = true;
    next();
};
