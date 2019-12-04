// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/
const date = require('../util/date.js');
const lpm_config = require('../util/lpm_config.js');
const winston = require('winston');
const cluster = require('cluster');
const {printf, timestamp, combine, splat} = winston.format;
const DEFAULT_CONSOLE_LEVEL = 'notice';
require('winston-daily-rotate-file');

const upper = winston.format(info=>{
    info.level = info.level.toUpperCase();
    return info;
});

const format = printf(opt=>{
    const cat = opt.category ? opt.category+' ' : '';
    const ts = date.to_sql_ms(opt.timestamp);
    let pref = '';
    if (cluster.isWorker)
        pref = 'C'+cluster.worker.id+' ';
    return `${pref}${ts} ${opt.level}: ${cat}${opt.message}`;
});

const levels = {
    error: 0,
    warn: 1,
    notice: 2,
    info: 3,
    debug: 4,
};

winston.addColors({notice: 'cyan'});

const get_console_transport = (level=DEFAULT_CONSOLE_LEVEL)=>
    new winston.transports.Console({
        level,
        format: combine(timestamp(), upper(), splat(), format),
    });

let console_transport = get_console_transport();

const file_transport = new winston.transports.DailyRotateFile({
    level: 'info',
    format: combine(timestamp(), upper(), splat(), format),
    dirname: lpm_config.work_dir,
    filename: 'luminati-%DATE%.log',
    maxSize: '10m',
    maxFiles: '3',
});
file_transport.on('new', filename=>logger.lpm_filename = filename);

const logger = winston.createLogger({
    levels,
    transports: [console_transport, file_transport],
});

logger.set_level = level=>{
    logger.remove(console_transport);
    console_transport = get_console_transport(level);
    logger.add(console_transport);
};

module.exports = logger;
