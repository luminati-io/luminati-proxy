// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/
const date = require('../util/date.js');
const lpm_config = require('../util/lpm_config.js');
const yargs = require('yargs');
const winston = require('winston');
const cluster = require('cluster');
const {printf, timestamp, combine, splat} = winston.format;
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


const get_opts = (transports, level='notice')=>({
    levels,
    transports: [
        new winston.transports.Console({
            level,
            format: combine(timestamp(), upper(), splat(), format),
        }),
        ...transports,
    ],
});

const argv_level = yargs.parse(process.argv.slice(2).map(String)).log;
const transport = new winston.transports.DailyRotateFile({
    level: 'info',
    format: combine(timestamp(), upper(), splat(), format),
    dirname: lpm_config.work_dir,
    filename: 'luminati-%DATE%.log',
    maxSize: '10m',
    maxFiles: '3',
});
const logger = winston.createLogger(get_opts([transport], argv_level));
transport.on('new', filename=>logger.lpm_filename = filename);

logger.set_level = level=>{
    logger.notice('Setting level to %s', level);
};

module.exports = logger;
