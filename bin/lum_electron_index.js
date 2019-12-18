#!/usr/bin/env node
// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/

class Lum_electron_index {
    constructor(argv){
        this.argv = argv;
    }
    run(){
        require('./lum_electron.js').run(this.argv);
    }
}
module.exports = Lum_electron_index;
