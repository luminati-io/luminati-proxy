// LICENSE_CODE ZON
'use strict'; /*jslint node:true*/
require('./config.js');
const zerr = require('./zerr.js');
const file = require('./file.js');
const path = require('path');
const os = require('os');
const env = process.env;

// XXX: embedded Node now has a regular command line, revisit
// XXX: rm process.zon from hutil
let script_path = !(process.zon && process.zon.main) && process.argv[1] ?
    file.normalize(process.argv[1]) : undefined;

function parse(conf){
    const iniparser = require('iniparser');
    let c = iniparser.parseString(conf);
    for (let i in c)
        c[i] = c[i].replace(/^"([^"]*)"$/, '$1');
    return c;
}

function _hostname(){
    let hostname = env.CONFIG_HOSTNAME || os.hostname();
    return hostname.replace(/\.hola\.org$/, '').replace(/\.localdomain$/, '');
}

function init(){
    if (script_path)
    {
        let text = file.read(script_path+'.conf');
        if (text)
            Object.assign(env, parse(text));
    }
    if (env.ZERR)
        zerr.set_level();
    if (+env.HTTP_PARSER_JS)
    {
        process.binding('http_parser').HTTPParser =
            require('http-parser-js').HTTPParser;
    }
}

init();

module.exports = {
    hostname: _hostname(),
    app: script_path && path.basename(script_path, '.js'),
    t: {parse},
};
