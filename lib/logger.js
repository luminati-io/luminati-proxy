// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/
const date = require('../util/date.js');
const path = require('path');
const lpm_config = require('../util/lpm_config.js');
const winston = require('winston');
const {printf, timestamp, combine, splat} = winston.format;
require('winston-daily-rotate-file');

const upper = winston.format(info=>{
    info.level = info.level.toUpperCase();
    return info;
});

const format = printf(opt=>{
    const cat = opt.category ? opt.category+' ' : '';
    const ts = date.to_sql_ms(opt.timestamp);
    return `${ts} ${opt.level}: ${cat}${opt.message}`;
});

const levels = {
    error: 0,
    warn: 1,
    notice: 2,
    info: 3,
    debug: 4,
};

winston.addColors({notice: 'cyan'});

const create_logger = ()=>{
    const logger = winston.createLogger(get_opts());
    logger.set_level = level=>logger.configure(get_opts(level));
    return logger;
};

const get_opts = (level='notice')=>({
    levels,
    transports: [
        new winston.transports.Console({
            level,
            format: combine(timestamp(), upper(), splat(), format),
        }),
        new winston.transports.DailyRotateFile({
            level: 'info',
            format: combine(timestamp(), upper(), splat(), format),
            filename: path.join(lpm_config.work_dir, 'luminati-%DATE%.log'),
            maxSize: '10m',
            maxFiles: '3',
            createSymlink: true,
            symlinkName: 'luminati.log',
        }),
    ],
});

let logger;
const get_logger = ()=>{
    if (!logger)
        logger = create_logger();
    return logger;
};

module.exports = get_logger();
