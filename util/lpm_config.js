// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/
const lpm_file = require('./lpm_file.js');
const file = require('./file.js');
const pkg = require('../package.json');
let conf = require('./lpm_config_static.js');

conf.version = pkg.version;
conf.hola_agent = 'proxy='+pkg.version+' node='+process.version
        +' platform='+process.platform;
conf.is_lum = file.exists(file.cyg2unix('/usr/local/hola/zon_config.sh'));
conf.work_dir = lpm_file.work_dir;
conf.first_actions = lpm_file.get_file_path(
    '.first_actions.json'.substr(conf.is_win ? 1 : 0));
Object.assign(conf.manager_default, {
    api_domain: process.env.LPM_API||pkg.api_domain,
    config: lpm_file.get_file_path(
        '.luminati.json'.substr(conf.is_win ? 1 : 0)),
    loki: lpm_file.get_file_path(
        '.luminati.db'.substr(conf.is_win ? 1 : 0)),
    cookie: lpm_file.get_file_path(
        '.luminati.jar'.substr(conf.is_win ? 1 : 0)),
});

Object.assign(module.exports, conf);
