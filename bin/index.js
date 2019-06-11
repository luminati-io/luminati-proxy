#!/usr/bin/env node
// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/
const lpm_util = require('../util/lpm_util.js');
const lpm_config = require('../util/lpm_config.js');
const Lum_node_index = require('./lum_node_index.js');
const Lum_electron_index = require('./lum_electron_index.js');
const argv = lpm_util.init_args();
const lum = lpm_config.is_electron ?
    new Lum_electron_index(argv) :
    new Lum_node_index(argv);
lum.run();
