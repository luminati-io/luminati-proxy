#!/usr/bin/env node
// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/
const lpm_config = require('../util/lpm_config.js');

class Lum_electron_index {
    constructor(argv){
        this.argv = argv;
    }
    init_log(){
        process.env.LPM_LOG_FILE = 'luminati_proxy_manager.log';
        process.env.LPM_LOG_DIR = lpm_config.work_dir;
    }
    run(){
        this.init_log();
        require('./lum_electron.js').run(this.argv);
    }
}
module.exports = Lum_electron_index;
