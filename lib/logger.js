// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/
const cluster = require('cluster');
const winston = require('winston');
const Transport = require('winston-transport');
const date = require('../util/date.js');
const zerr = require('../util/zerr.js');
const lpm_config = require('../util/lpm_config.js');
const {printf, timestamp, combine, splat} = winston.format;
const DEFAULT_CONSOLE_LEVEL = 'notice';
try {
    require('winston-daily-rotate-file');
} catch(e){
    console.log('no winston-daily-rotate-file');
}
const syslog = require('winston-syslog');

const upper = winston.format(info=>{
    info.level = info.level.toUpperCase();
    return info;
});

const format = printf(opt=>{
    const cat = opt.category ? opt.category+': ' : '';
    const ts = date.to_sql_ms(opt.timestamp);
    let pref = '';
    if (cluster.isWorker)
        pref = 'C'+cluster.worker.id+' ';
    return `${pref}${ts} ${opt.level}: ${cat}${opt.message}`;
});

const get_console_transport = level=>
    new winston.transports.Console({
        level,
        format: combine(timestamp(), upper(), splat(), format),
        // transporting to stdout will cause workers to crash with EPERM, write
        // err on windows server 2012r2, this redirects lvls to stderr instead
        stderrLevels: lpm_config.is_win ? Object.keys(lpm_config.log_levels) :
            [],
    });

let current_level = DEFAULT_CONSOLE_LEVEL;
let console_transport = get_console_transport(current_level);

let file_transport;
if (!process.env.AGENT_NUM)
{
    try {
        file_transport = new winston.transports.DailyRotateFile({
            level: 'info',
            format: combine(timestamp(), upper(), splat(), format),
            dirname: lpm_config.work_dir,
            filename: 'luminati-%DATE%.log',
            maxSize: '50m',
            maxFiles: 2,
            zippedArchive: true,
        });
        file_transport.on('new', filename=>logger.lpm_filename = filename);
    } catch(e){
        console.log('Could not create file_transport', zerr.e2s(e));
    }
}

winston.loggers.add('default', {
    levels: lpm_config.log_levels,
    transports: [
        console_transport,
        file_transport,
    ].filter(Boolean),
});
const logger = winston.loggers.get('default');

logger.set_level = level=>{
    if (level==current_level)
        return;
    current_level = level;
    logger.remove(console_transport);
    console_transport = get_console_transport(current_level);
    logger.add(console_transport);
    logger.level = level;
};

const api_logger = logger.child({category: 'API'});
logger.get_api_mw = port=>(req, res, next)=>{
    api_logger.debug('[%s] %s %s', port, req.method, req.originalUrl);
    const start_time = Date.now();
    res.on('finish', ()=>{
        const elapsed_time = Date.now()-start_time;
        api_logger.info('[%s] %fms %s %s %s %s', port, elapsed_time,
            req.method, req.originalUrl, res.statusCode, res.statusMessage);
    });
    next();
};

module.exports = logger;

if (!winston.transports.Syslog)
    winston.transports.Syslog = syslog.Syslog;
const syslog_transport = new winston.transports.Syslog({
    level: 'info',
    app_name: 'lpm',
    localhost: null,
    protocol: 'unix',
    path: '/dev/log',
});

class Null_transport extends Transport {
    get name(){
        return 'null transport';
    }
    log(info, callback){
        callback(null, true);
    }
}

const null_transport = new Null_transport();

winston.loggers.add('reqs', {
    levels: lpm_config.log_levels,
    transports: [
        !process.env.CLOUD_LOG && null_transport,
        process.env.CLOUD_LOG && syslog_transport,
    ].filter(Boolean),
});
