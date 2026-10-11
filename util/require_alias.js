// LICENSE_CODE ZON
'use strict'; /*jslint node:true, esnext:true*/
const Module = require('node:module');
const path = require('path');

const origin_resolve_failename = Module._resolveFilename;
const aliases = {
  'cluster_ipc.js': path.join(__dirname, './cluster_ipc.js'),
};

Module._resolveFilename = function(request, parent, isMain, options){
  for (const [alias, alias_path] of Object.entries(aliases))
  {
    if (request.includes(alias))
      request = alias_path;
  }
  return origin_resolve_failename.call(this, request, parent, isMain, options);
};

