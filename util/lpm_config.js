// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/
const pkg = require('../package.json');
const lpm_file = require('./lpm_file.js');
const file = require('./file.js');
let conf = require('./lpm_config_static.js');

const is_zagent = process.argv.some((a, idx, src)=>
    a=='--zagent'&&src[idx+1]!='false');
conf.version = pkg.version;
conf.hola_agent = 'proxy='+pkg.version+' node='+process.version
    +' platform='+process.platform+(is_zagent ? ' cloud_lpm=1' : '');
conf.is_lum = file.exists(file.cyg2unix('/usr/local/hola/zon_config.sh'));
conf.work_dir = lpm_file.work_dir;
Object.assign(conf.manager_default, {
    api_domain: process.env.PMGR_API||pkg.api_domain,
    config: lpm_file.get_file_path(
        '.luminati.json'.slice(conf.is_win ? 1 : 0)),
    loki: lpm_file.get_file_path(
        '.luminati.db'.slice(conf.is_win ? 1 : 0)),
    session_path: lpm_file.get_file_path(
        '.sessions.db'.slice(conf.is_win ? 1 : 0)),
});

Object.assign(module.exports, conf);
