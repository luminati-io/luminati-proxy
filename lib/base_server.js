// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/
const util = require('util');
const events = require('events');
module.exports = BaseServer;

function BaseServer(){
}

util.inherits(BaseServer, events.EventEmitter);

BaseServer.log_level = {
    NONE: -1,
    ERROR: 0,
    WARNING: 1,
    INFO: 2,
    DEBUG: 3,
};

BaseServer.prototype._log = function(level, msg, extra){
    if (BaseServer.log_level[level]>BaseServer.log_level[this.log])
        return;
    let args = [`${level}:${this.id}: ${msg}`];
    if (extra)
        args.push(extra);
    console.log.apply(console, args);
};

