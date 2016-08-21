#!/usr/bin/env node
// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/
const fs = require('fs');
const path = require('path');
module.exports = JSON.parse(fs.readFileSync(path.join(__dirname,
    '../package.json'))).version;
