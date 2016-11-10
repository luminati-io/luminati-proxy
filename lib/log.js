// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/
const winston = require('winston');
const assign = Object.assign;
const container = new winston.Container();
const E = module.exports = logger;

function logger(id, level){
    return container.add(id, {console: {
        level: level.toLowerCase(),
        colorize: true,
        timestamp: ()=>`${new Date().toISOString()} - ${id}`,
    }});
}

E.log_level = assign({none: -1}, winston.config.npm.levels);
