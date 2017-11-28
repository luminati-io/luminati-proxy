// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/
const zerr = require('hutil').zerr;
const date = require('hutil').date;
const E = module.exports = logger;

function logger(id, conf){
    zerr.set_log_buffer(1);
    conf = conf.toUpperCase();
    if (conf=='ERR')
        conf = 'ERROR';
    zerr.set_level(conf);
    zerr.error = zerr.err;
    zerr.set_logger((level, msg)=>{
        let k = Object.keys(zerr.L);
        let prefix = zerr.hide_timestamp ? ''
            : zerr.prefix+date.to_sql_ms()+' ';
        if ({EMERG: 1, ALERT: 1, CRIT: 2, ERR: 3}[level])
            return console.error(prefix+k[level]+': '+msg);
        console.log(prefix+k[level]+': '+msg);
    });
    return zerr;
}

E.log_level = {none: -1, error: 0, warn: 1, info: 2, verbose: 3, debug: 4};
