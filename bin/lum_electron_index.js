#!/usr/bin/env node
// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/
const Lum_common = require('./lum_common.js');

class Lum_electron_index extends Lum_common {
    run(){
        this.init_log();
        require('./lum_electron.js').run(this.argv);
    }
}
module.exports = Lum_electron_index;
