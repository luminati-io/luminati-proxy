// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/
const cluster = require('cluster');
const {Writable} = require('stream');
const _ = require('lodash4');
const winston = require('winston');
const Transport = require('winston-transport');
const syslog = require('winston-syslog');
const logzio = require('winston-logzio');
const date = require('../util/date.js');
const zerr = require('../util/zerr.js');
const zurl = require('../util/url.js');
const lpm_config = require('../util/lpm_config.js');
const util_lib = require('./util.js');
const {printf, timestamp, combine, splat, json} = winston.format;
const DEFAULT_LEVEL = 'notice';
const REMOTE_OMIT_FIELDS = ['request_headers', 'request_body',
    'response_headers', 'response_body', 'context', 'rules'];
const LOGZIO_DEFAULTS = {
    host: 'listener.logz.io',
    port: '8071',
    protocol: 'https',
};
const CHLVL_REMOTE_RECREATE_TYPES = ['logzio'];
try {
    require('winston-daily-rotate-file');
} catch(e){
    console.log('no winston-daily-rotate-file');
}

const upper = winston.format(info=>{
    info.level = info.level.toUpperCase();
    return info;
});

const prepare_remote_log = winston.format(info=>{
    if (info.message)
        info.message = _.omit(info.message, REMOTE_OMIT_FIELDS);
    return info;
});

const remote_log_format = combine(prepare_remote_log(), json());

const format = printf(opt=>{
    const cat = opt.category ? opt.category+': ' : '';
    const ts = date.to_sql_ms(opt.timestamp);
    let pref = '';
    if (cluster.isWorker)
        pref = 'C'+cluster.worker.id+' ';
    return `${pref}${ts} ${opt.level}: ${cat}${opt.message}`;
});

const get_console_transport = (level=DEFAULT_LEVEL)=>
    new winston.transports.Console({
        level,
        format: combine(timestamp(), upper(), splat(), format),
        // transporting to stdout will cause workers to crash with EPERM, write
        // err on windows server 2012r2, this redirects lvls to stderr instead
        stderrLevels: lpm_config.is_win ? Object.keys(lpm_config.log_levels) :
            [],
    });

const get_file_transport = (level=DEFAULT_LEVEL)=>{
    if (process.env.AGENT_NUM)
        return null;
    let ft;
    try {
        ft = new winston.transports.DailyRotateFile({
            level,
            format: combine(timestamp(), upper(), splat(), format),
            dirname: lpm_config.work_dir,
            filename: 'luminati-%DATE%.log',
            maxSize: '50m',
            maxFiles: 2,
            zippedArchive: true,
        });
        ft.on('new', filename=>logger.lpm_filename = filename);
    } catch(e){
        console.log('Could not create file_transport', zerr.e2s(e));
        return null;
    }
    return ft;
};

const get_http_transport = (opt={})=>{
    const {url, username, password, use_ssl} = opt;
    const _url = zurl.parse(url);
    return new winston.transports.Http({
        level: 'info',
        format: remote_log_format,
        host: _url.hostname,
        port: _url.port,
        path: _url.path,
        auth: username && password ? {username, password} : null,
        ssl: !!use_ssl,
    });
};

const get_datadog_transport = (opt={})=>
    new datadog({
        level: 'info',
        format: remote_log_format,
        apiKey: opt.token,
        port: opt.port || null,
        host: opt.host || null,
        metadata: {
            ddsource: opt.source || null,
            ddtags: opt.tags || null,
            environment: 'prod'
        },
    });

const get_logzio_transport = (opt={})=>
    new logzio({
        level: 'info',
        format: remote_log_format,
        token: opt.token,
        type: opt.source,
        host: opt.host || LOGZIO_DEFAULTS.host,
        port: opt.port || LOGZIO_DEFAULTS.port,
        protocol: LOGZIO_DEFAULTS.protocol,
        debug: current_level == lpm_config.log_levels.debug,
        callback: err=>{
            if (err)
                logger.warn('Logzio delivery error: %s', err);
        },
    });

const get_s3_transport = (opt={})=>{
    util_lib.s3.prepare_opt(opt);
    let {bucket, instant, compress, rotation_hour, encryption} = opt;
    return new winston.transports.Stream({
        level: 'info',
        format: remote_log_format,
        stream: new s3_stream({
            config: util_lib.s3.get_config(opt),
            max_file_size: 20000000, // 20MB
            buffer_size: 200000, // 200KB
            region: 'us-east-1',
            bucket: bucket,
            folder: util_lib.s3.get_target(opt),
            upload_every: instant ? 1 : date.ms.MIN,
            rotate_every: rotation_hour ? date.ms.HOUR : 10*date.ms.MIN,
            compress: !!compress,
            storage_class: 'STANDARD_IA',
            name_format: util_lib.s3.get_name_format(opt),
            tags: util_lib.s3.get_tags(opt),
            server_side_encryption: !!encryption,
        })
    });
};

let current_level = DEFAULT_LEVEL;
let remote_settings = {
    type: null,
    opt: {},
};
let console_transport = get_console_transport(current_level);
let file_transport = get_file_transport(current_level);

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
    if (!process.env.AGENT_NUM)
    {
        logger.remove(file_transport);
        file_transport = get_file_transport(current_level);
        logger.add(file_transport);
    }
    logger.level = level;
    if (CHLVL_REMOTE_RECREATE_TYPES.includes(remote_settings.type))
        logger.create_remote(remote_settings.opt);
};

logger.create_remote = (opt={})=>{
    let type = opt.type;
    let new_transport = logger.remote_transports[type];
    if (!type || !new_transport)
        return null;
    new_transport.validate(opt);
    logger.debug('Creating remote logger %s', type);
    if (remote_settings.type)
    {
        let old_transport = logger.remote_transports[remote_settings.type];
        remote_logger.remove(old_transport.instance);
    }
    new_transport.instance = new_transport.create_fn(opt);
    new_transport.instance.on('warn', e=>logger.warn('Logs delivery error: %s',
        e.message));
    new_transport.instance.on('logged', r=>
        logger.debug('Logs %s delivered: %s', type, r));
    remote_logger.add(new_transport.instance);
    remote_settings = {type, opt};
    return remote_logger;
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

logger.remote_transports = {
    custom: {
        instance: new Null_transport(),
        create_fn: get_http_transport,
        test_opt: {},
        validate: util_lib.noop,
    },
    datadog: {
        instance: new Null_transport(),
        create_fn: get_datadog_transport,
        test_opt: {},
        validate: util_lib.noop,
    },
    logzio: {
        instance: new Null_transport(),
        create_fn: get_logzio_transport,
        test_opt: {},
        validate: util_lib.noop,
    },
    s3: {
        instance: new Null_transport(),
        create_fn: get_s3_transport,
        test_opt: {instant: true},
        validate: util_lib.s3.validate,
    }
};

let datadog, s3_stream;
if (process.env.AGENT_NUM)
{
    try {
        datadog = require('winston-datadog-logs-transport');
    } catch(e){
        datadog = Null_transport;
        console.log('no winston-datadog-logs-transport');
    }
    try {
        s3_stream = require('s3-streamlogger').S3StreamLogger;
    } catch(e){
        s3_stream = Writable;
        console.log('no s3-streamlogger');
    }
}
else
{
    datadog = Null_transport;
    s3_stream = Writable;
}

winston.loggers.add('remote', {
    levels: lpm_config.log_levels,
    transports: Object.values(logger.remote_transports)
        .map(t=>t.instance).filter(Boolean),
});
const remote_logger = winston.loggers.get('remote');

winston.loggers.add('test', {
    levels: lpm_config.log_levels,
    transports: [null_transport],
});
