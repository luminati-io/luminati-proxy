// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/
const Luminati = require('./lib/luminati.js');
const Manager = require('./lib/manager.js');
const version = require('./package.json').version;
module.exports = {Luminati, Manager, version};
