#!/usr/bin/env node
// LICENSE_CODE ZON
'use strict'; /*jslint node:true*/
if (require.main===module)
    global.zon_config_fallback = {};
require('../util/config.js');
const changelog = require('../versions.json');

const change_types = ['star', 'sparkles', 'bug', 'boom'];

const is_valid_change = c=>change_types.includes(c.type) && c.text;

const validate = _changelog=>{
    const last_change = _changelog[0];
    if (!['stable', 'dev'].includes(last_change.type))
        throw Error(`Invalid changelog version type: ${last_change.type}`);
    if (!last_change.changes.length)
        throw Error(`Changes in the latest changelog should be specified`);
    if (!last_change.changes.every(is_valid_change))
        throw Error('There are invalid changes in the latest changelog');
};

const main = ()=>{
    try {
        validate(changelog);
        console.log('OK');
    } catch(e){
        console.log(`Error: ${e.message}`);
    }
};

if (require.main===module)
    main();

module.exports = {t: {validate}};
