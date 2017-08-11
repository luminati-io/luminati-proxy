// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/
const winston = require('winston');
const date = require('hutil').date;
const os = require('os');
const path = require('path');
const assign = Object.assign;
const container = new winston.Container({emitErrs: false});
const E = module.exports = logger;

function logger(id, conf){
    const formatter = options=>options.timestamp()+' '
        +(options.colorize ? winston.config.colorize(options.level,
            options.level.toUpperCase()) : options.level.toUpperCase())+': '
        +id+' '+(options.message ? options.message : '')
        +(options.meta && Object.keys(options.meta).length ?
            ' '+JSON.stringify(options.meta) : '');
    const timestamp = ()=>date.to_sql_ms();
    let log_file_level = 'info';
    const transport = {timestamp, formatter, emitErrs: false};
    if (typeof conf=='string')
    {
        let level = conf.toLowerCase();
        log_file_level = E.log_level[level]>E.log_level[log_file_level] ?
            level : log_file_level;
        conf = {
            transports: [new winston.transports.Console(assign({
                level,
                colorize: true,
            }, transport))],
        };
    }
    conf.transports = conf.transports||[];
    const filename = path.resolve(os.homedir(),
        '.luminati'.substr(process.platform=='win32' ? 1 : 0));
    const file_transport = assign({
        json: false,
        maxsize: 15*1024*1024,
        maxFiles: 3,
        tailable: true,
        zippedArchive: true,
    }, transport);
    conf.transports.push(new winston.transports.File(assign({
        name: 'file_error',
        level: 'error',
        filename: `${filename}_error.log`,
    }, file_transport)), new winston.transports.File(assign({
        name: 'file_log',
        level: log_file_level,
        filename: `${filename}.log`,
    }, file_transport)));
    const log = container.add(id, conf);
    log.emitErrs = false;
    return log;
}

E.log_level = {none: -1, error: 0, warn: 1, info: 2, verbose: 3, debug: 4};
