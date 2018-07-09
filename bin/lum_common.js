#!/usr/bin/env node
// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/
const lpm_config = require('../util/lpm_config.js');

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
    }
}
module.exports = Lum;
