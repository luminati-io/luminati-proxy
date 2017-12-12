// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/
const zerr = require('hutil').zerr;
const date = require('hutil').date;
const E = module.exports = logger;
zerr.set_logger((level, msg)=>{
    let k = Object.keys(zerr.L);
    let prefix = zerr.hide_timestamp ? ''
        : zerr.prefix+date.to_sql_ms()+' ';
    if ({EMERG: 1, ALERT: 1, CRIT: 2, ERR: 3}[level])
        return console.error(prefix+k[level]+': '+msg);
    console.log(prefix+k[level]+': '+msg);
});

function logger(id, conf){
    conf = conf.toUpperCase();
    if (conf=='ERR')
        conf = 'ERROR';
    if (E.log_level[conf.toLowerCase()]>E.log_level.warn)
        zerr.set_log_buffer(1);
    else
        zerr.set_log_buffer(0);
    zerr.set_level(conf);
    return ['info', 'warn', 'error', 'debug'].reduce((log, l)=>{
        let zfn = l=='error' ? 'err' : l;
        log[l] = function(){
            arguments[0] = `${id ? id+' ' : ''}${arguments[0]}`;
            zerr[zfn].apply(zerr, arguments);
        };
        return log;
    }, {});
}

E.log_level = {none: -1, error: 0, warn: 1, info: 2, verbose: 3, debug: 4};
