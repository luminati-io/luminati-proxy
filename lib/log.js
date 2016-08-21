// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/
const E = module.exports = log;
const log_level = E.log_level = {
    NONE: -1,
    ERROR: 0,
    WARNING: 1,
    INFO: 2,
    DEBUG: 3,
};

function log(id, level) {
    const from_level = log_level[level];
    return (level, msg, extra)=>{
        if (log_level[level]>from_level)
            return;
        let args = [`${level}:${id}: ${msg}`];
        if (extra)
            args.push(extra);
        console.log.apply(console, args);
    };
}

