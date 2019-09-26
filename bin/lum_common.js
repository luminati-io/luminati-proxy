#!/usr/bin/env node
// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/
const lpm_config = require('../util/lpm_config.js');
const config = require('../util/config.js');
const os = require('os');
const logger = require('../lib/logger.js');

class Lum {
    constructor(argv){
        this.argv = argv;
    }
    init_log(){
        process.env.LPM_LOG_FILE = 'luminati_proxy_manager.log';
        process.env.LPM_LOG_DIR = lpm_config.work_dir;
        logger.notice([
            `Running Luminati Proxy Manager`,
            `PID: ${process.pid}`,
            `Tag: ${config.ZON_VERSION}`,
            `Build date: ${config.CONFIG_BUILD_DATE}`,
            `Make flags: ${config.CONFIG_MAKEFLAGS}`,
            `Os version: ${os.platform()} ${os.arch()} ${os.release()}`,
            `Host name: ${os.hostname()}`,
        ].join('\n'));
    }
}
module.exports = Lum;
