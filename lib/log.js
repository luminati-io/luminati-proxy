// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/
const winston = require('winston');
const assign = Object.assign;
const E = module.exports = logger;
const container = new winston.Container();
E.log_level = assign({none: -1}, winston.config.npm.levels);

function logger(id, level){
    return container.add(id, {
        console: {
            level: level.toLowerCase(),
            colorize: true,
            timestamp: ()=>`${new Date().toISOString()} - ${id}`,
        }
    });
}
