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
    return hostname.replace(/\.hola\.org$/, '').replace(/\.localdomain$/, '')
        .replace(/\.home$/, '');
}

function init(){
    let filename = script_path;
    if (filename)
    {
        if (!file.exists(`${filename}.conf`) && file.is_symlink(filename))
            filename = file.readlink(filename);
        let text = file.read(`${filename}.conf`);
        if (text)
            Object.assign(env, parse(text));
    }
    if (env.ZERR)
        zerr.set_level();
    if (+env.HTTP_PARSER_JS)
    {
        let http_parser = process.binding('http_parser');
        let hc = require('_http_common');
        if (hc.HTTPParser && hc.HTTPParser!==http_parser.HTTPParser)
        {
            throw new Error('HTTP_PARSER_JS=1 requires --http-parser=legacy '
                +'in Node 12.x');
        }
        let http_parser_js = require('http-parser-js').HTTPParser;
        http_parser_js.encoding = 'utf-8';
        http_parser.HTTPParser = http_parser_js;
    }
}

init();

module.exports = {
    hostname: _hostname(),
    app: script_path && path.basename(script_path, '.js'),
    t: {parse},
};
