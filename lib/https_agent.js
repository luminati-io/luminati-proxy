// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/
const https = require('https');
const util = require('util');
const E = module.exports = Https_agent;

function Https_agent(options){
    if (!(this instanceof Https_agent))
        return new Https_agent(options);
    https.Agent.call(this, options);
}

util.inherits(E, https.Agent);

E.prototype.getName = function(options){
    let name = https.Agent.prototype.getName.call(this, options);
    if (!options.lpm_username)
        return name;
    return `${name}:${options.lpm_username}`;
};
