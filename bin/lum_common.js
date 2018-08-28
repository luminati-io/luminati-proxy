#!/usr/bin/env node
// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/
const lpm_config = require('../util/lpm_config.js');
const config = require('../util/config.js');
const zerr = require('../util/zerr.js');
const os = require('os');

class Lum {
    constructor(argv){
        this.argv = argv;
        this.proc_name = 'luminati_proxy_manager';
    }
    init_log(){
        // XXX vladislavl: temp old way for params transfer
        process.env.LPM_LOG_FILE = `${this.proc_name}.log`;
        process.env.LPM_LOG_DIR = lpm_config.work_dir;
        require('../lib/log.js')('', this.argv.log);
        zerr.notice([
            `\nTag: ${config.ZON_VERSION}`,
            `Build date: ${config.CONFIG_BUILD_DATE}`,
            `Make flags: ${config.CONFIG_MAKEFLAGS}`,
            `Os version: ${os.platform()} ${os.arch()} ${os.release()}`,
            `Host name: ${os.hostname()}`,
        ].join('\n'));
    }
}
module.exports = Lum;
