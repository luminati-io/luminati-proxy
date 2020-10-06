// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/
const date = require('../util/date.js');
const lpm_config = require('../util/lpm_config.js');
const winston = require('winston');
const cluster = require('cluster');
const {printf, timestamp, combine, splat} = winston.format;
const DEFAULT_CONSOLE_LEVEL = 'notice';
try {
    require('winston-daily-rotate-file');
} catch(e){
    console.log('no winston-daily-rotate-file');
}

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
try {
    file_transport = new winston.transports.DailyRotateFile({
        level: 'info',
        format: combine(timestamp(), upper(), splat(), format),
        dirname: lpm_config.work_dir,
        filename: 'luminati-%DATE%.log',
        maxSize: '10m',
        maxFiles: 3,
    });
    file_transport.on('new', filename=>logger.lpm_filename = filename);
} catch(e){
    console.log('did not create file transport');
}

const logger = winston.createLogger({
    levels: lpm_config.log_levels,
    transports: [console_transport, file_transport].filter(Boolean),
});

logger.set_level = level=>{
    if (level==current_level)
        return;
    current_level = level;
    logger.remove(console_transport);
    console_transport = get_console_transport(current_level);
    logger.add(console_transport);
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
