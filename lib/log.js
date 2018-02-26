// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/
const zerr = require('hutil').zerr;
const sprintf = require('hutil').sprintf;
const date = require('hutil').date;
const os = require('os');
const rfs = require('rotating-file-stream');
const E = module.exports = logger;

const log_file_name = '.luminati.log'.substr(
    process.platform=='win32' ? 1 : 0);
const log_file_path = os.homedir();
E.log_file_name = log_file_name;

const zerr_flush = zerr.flush;
const zerr_zexit = zerr.zexit;

const stdio_transport = (conf = {})=>{
    if (conf.buffer)
        zerr.set_log_buffer(1);
    else
        zerr.set_log_buffer(0);
    return {
        logger: (level, msg)=>{
            if (conf.filter && !conf.filter(msg, level))
                return;
            if ({EMERG: 1, ALERT: 1, CRIT: 2, ERR: 3}[zerr.LINV[level]])
                return console.error(msg);
            console.log(msg);
        }
    };
};

E.log_file_stream = null;

const file_transport = (conf = {})=>{
    if (!E.log_file_stream)
    {
        E.log_file_stream = rfs(log_file_name, {
            path: log_file_path,
            size: '300M',
            rotate: 10,
            compress: true,
        });
    }
    return {
        logger: (level, msg)=>{
            if (conf.filter && !conf.filter(msg, level))
                return;
            E.log_file_stream.write(msg+'\n');
        },
        zexit: ()=>{
            console.log('fileexit');
            E.log_file_stream.end();
        },
    };
};

const apply_transports = (fn, transports, ...args)=>{
    transports = transports||[];
    transports.forEach(t=>t[fn]&&t[fn].apply(t, args));
};

const create_log_formatter = ()=>{
    const msg_tpl = `${zerr.prefix}%s %s: %s`;
    const level_names = Object.keys(zerr.L);
    const hide_timestamp = zerr.hide_timestamp;
    return (level, msg)=>{
        let d = hide_timestamp ? '' : date.to_sql_ms();
        return sprintf(msg_tpl, d, level_names[level], msg);
    };
};

const create_zerr_logger = (id, transports = [])=>{
    const fmtr = create_log_formatter(id);
    return (level, msg)=>{
        apply_transports('logger', transports, level, fmtr(level, msg));
    };
};

const create_zexit_handler = transports=>()=>{
    apply_transports('zexit', transports);
    zerr_zexit();
};

const create_flush_handler = transports=>()=>{
    apply_transports('flush', transports);
    zerr_flush();
};

const destroy_logger = lgr=>{
    apply_transports('destroy', lgr.transports);
};

const create_log_iface = (id, transports)=>{
    id = id ? `${id} ` : '';
    const lgr = ['info', 'notice', 'warn', 'error', 'debug'].reduce((log, l)=>{
        let zfn = l=='error' ? 'err' : l;
        log[l] = (...args)=>{
            args[0] = id+args[0];
            zerr[zfn].apply(zerr, args);
        };
        return log;
    }, {});
    lgr.transports = transports;
    lgr.destroy = ()=>destroy_logger(lgr);
    return lgr;
};

function logger(id, conf){
    let level = typeof conf == 'object' ? conf.level : conf||'';
    level = level.toUpperCase();
    if (level=='ERR')
        level = 'ERROR';
    if (level=='NONE')
        level = 'CRIT';
    let buffer = E.log_level[level.toLowerCase()]>E.log_level.warn;
    const filter = (msg, level)=>{
        if (zerr.LINV[level] != 'DEBUG')
            return true;
        let filter_str = ['DEBUG: generator:', 'DEBUG: close:',
            'DEBUG: after:', 'DEBUG: then_wait:', 'DEBUG: all_a:'];
        for (let str of filter_str)
        {
            if (msg.includes(str))
                return false;
        }
        return true;
    };
    const transports = [stdio_transport({buffer, filter}),
        file_transport({filter})];
    zerr.flush = create_flush_handler(transports);
    zerr.zexit = create_zexit_handler(transports);
    zerr.set_logger(create_zerr_logger(id, transports));
    zerr.set_level(level);
    return create_log_iface(id, transports);
}

E.log_level = {none: -1, error: 0, warn: 1, info: 2, notice: 3, verbose: 4,
    debug: 5};
