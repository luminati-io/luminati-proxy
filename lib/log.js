// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/
const zerr = require('../util/zerr.js');
const sprintf = require('../util/sprintf.js');
const date = require('../util/date.js');
const os = require('os');
const rfs = require('rotating-file-stream');
const E = module.exports = logger;

E.log_file = process.env.LPM_LOG_FILE||'luminati.log';
E.log_dir = process.env.LPM_LOG_DIR||os.homedir();
zerr.log = E._log = [];
E._log.max_size = 200;
const zerr_zexit = zerr.zexit;

const stdio_transport = (conf={})=>({
    logger: (level, msg)=>{
        E._log.push(msg);
        if (global.it && level>3)
            return;
        if (E._log.length > E._log.max_size)
            E._log.splice(0, Math.ceil(E._log.length-E._log.max_size/2));
        if ({EMERG: 1, ALERT: 1, CRIT: 2, ERR: 3}[zerr.LINV[level]])
            return console.error(msg);
        console.log(msg);
    }
});

const file_transport = ()=>{
    if (!E.log_file || !E.log_dir)
        throw new Error('log directory and file must be defined');
    const log_file_stream = rfs(E.log_file, {path: E.log_dir, size: '10M',
        rotate: 10, compress: true});
    return {
        logger: (level, msg)=>log_file_stream.write(msg+'\n'),
        zexit: ()=>{
            console.log('fileexit');
            log_file_stream.end();
        },
    };
};

const apply_transports = (fn, transports, ...args)=>{
    transports = transports||[];
    transports.forEach(t=>t[fn] && t[fn].apply(t, args));
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

const create_zerr_logger = (transports = [])=>{
    const fmtr = create_log_formatter();
    return (level, msg)=>{
        apply_transports('logger', transports, level, fmtr(level, msg));
    };
};

const create_zexit_handler = transports=>()=>{
    apply_transports('zexit', transports);
    zerr_zexit();
};

const destroy_logger = lgr=>apply_transports('destroy', lgr.transports);

const create_log_iface = (id, transports)=>{
    const id_prefix = '%s'+(id ? ' ' : '');
    const lgr = ['info', 'notice', 'warn', 'error', 'crit'].reduce((log, l)=>{
        const zfn = l=='error' ? 'err' : l;
        log[l] = (...args)=>{
            const params = args.slice(1);
            args = params.length ? [id_prefix+args[0], id].concat(params) :
                [id_prefix+'%s', id, args[0]];
            zerr[zfn].apply(zerr, args);
        };
        return log;
    }, {});
    lgr.transports = transports;
    lgr.destroy = ()=>destroy_logger(lgr);
    return lgr;
};

const transports = [stdio_transport(), file_transport()];
zerr.set_log_buffer(!global.it);
zerr.zexit = create_zexit_handler(transports);
zerr.set_logger(create_zerr_logger(transports));

function logger(id, conf){
    let level = typeof conf == 'object' ? conf.level : conf||'';
    if (level=='error')
        level = 'err';
    else if (!level||level=='none')
        level = 'crit';
    if (zerr.is[level])
        zerr.set_level(level.toUpperCase());
    return create_log_iface(id, transports);
}
