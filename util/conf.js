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
        .replace(/\.local$/, '').replace(/\.home$/, '');
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
}

init();

module.exports = {
    hostname: _hostname(),
    app: env.CONFIG_APP || script_path&&path.basename(script_path, '.js'),
    t: {parse},
};
