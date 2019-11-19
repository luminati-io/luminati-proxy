// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/
const path = require('path');
const etask = require('../util/etask.js');
const logger = require('./logger.js');
const lpm_file = require('../util/lpm_file.js');
const file = require('../util/file.js');
const util = require('./util.js');
const E = module.exports;

let data;
let pending;

const prepare_data = locs=>{
    const locations = {};
    const asns = {};
    locs.forEach(d=>{
        if (!d)
            return;
        const [country, asn, region, city, mob] = d.split('_');
        if (!locations[country])
            locations[country] = {_mob: !!mob};
        locations[country]._mob = locations[country]._mob||!!mob;
        if (!locations[country][region])
            locations[country][region] = {_mob: !!mob};
        locations[country][region]._mob =
            locations[country][region]._mob||!!mob;
        if (!locations[country][region][city])
            locations[country][region][city] = {_mob: !!mob};
        locations[country][region][city]._mob =
            locations[country][region][city]._mob||!!mob;
        if (!asns[country])
            asns[country] = {};
        if (!asns[country][asn])
            asns[country][asn] = {_mob: !!mob};
        asns[country][asn]._mob = asns[country][asn]._mob||!!mob;
    });
    return {locations, asns};
};

E.all_locations = www_domain=>etask(function*(){
    yield E.ensure_data(www_domain);
    return data;
});

const get_current_vipdb_version = domain=>etask(function*(){
    const res = yield util.fetch(`http://client.${domain}/api/vipdb/version`);
    if (res.statusCode==200)
        return res.body;
    logger.warn('unable to get current vipdb version');
});

const get_current_vipdb_data = domain=>etask(function*(){
    let res = [];
    let main = yield util.fetch(`http://client.${domain}/api/vipdb/main`);
    if (main.statusCode!=200)
        logger.warn('vipdb main could not be fetched');
    else
        res = res.concat(main.body.split('\n'));
    const small = yield util.fetch(
        `http://client.${domain}/api/vipdb/small_geo`);
    if (small.statusCode!=200)
        logger.warn('vipdb small could not be fetched');
    else
        res = res.concat(small.body.split('\n'));
    return res.map(v=>v.split(';')[0]);
});

E.ensure_data = www_domain=>etask(function*(){
    if (data || data===null)
        return;
    if (pending)
    {
        pending.push(this);
        return yield this.wait();
    }
    pending = [];
    const vipdb_path = path.resolve(lpm_file.work_dir, 'vipdb.csv');
    try { data = JSON.parse(file.read_e(vipdb_path)); }
    catch(e){
        if (e.code!='ENOENT')
            logger.error('failed to parse vipdb %s', e.message);
    }
    const current_vipdb_version = yield get_current_vipdb_version(www_domain);
    if (!current_vipdb_version)
        return;
    if (!data || data.version!=current_vipdb_version)
    {
        logger.notice('fetching vipdb data. New version %s available '
        +'(current is %s)', current_vipdb_version, data && data.version);
        const new_vipdb = yield get_current_vipdb_data(www_domain);
        if (!new_vipdb)
            return;
        data = {vipdb: new_vipdb, version: current_vipdb_version};
        file.write_e(vipdb_path, JSON.stringify(data));
    }
    data = prepare_data(data && data.vipdb || []);
    pending.forEach(p=>p.continue());
    pending = null;
});
