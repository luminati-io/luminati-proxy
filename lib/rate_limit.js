// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/
const express_rate_limit = require('express-rate-limit');
const date = require('../util/date.js');
const logger = require('./logger.js').child({category: 'RL'});
const {RL_MAX_REQS, RL_WINDOW} = require('./consts.js');
const E = module.exports;

E.default = express_rate_limit({
    windowMs: RL_WINDOW,
    max: RL_MAX_REQS,
    message: `You have exceeded the ${RL_MAX_REQS} requests in`
        +` ${date.describe_interval(RL_WINDOW)} limit.`,
    statusCode: 429,
    skipFailedRequests: true,
    standardHeaders: true,
	legacyHeaders: false,
    handler: (req, res, next, opt)=>{
        logger.warn(`${req.ip} reached default rate limit on ${req.path}`);
        res.status(opt.statusCode).send(opt.message);
    },
    skip: req=>req.method=='GET',
});
