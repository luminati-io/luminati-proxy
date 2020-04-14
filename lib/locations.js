// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/
const path = require('path');
const etask = require('../util/etask.js');
const logger = require('./logger.js');
const lpm_file = require('../util/lpm_file.js');
const file = require('../util/file.js');
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

E.all_locations = api_request=>etask(function*(){
    yield E.ensure_data(api_request);
    return data;
});

const get_current_vipdb_data = api_request=>etask(function*(){
    let res = [];
    let main = yield api_request({
        endpoint: '/lpm/vipdb/main',
        no_throw: 1,
        force: 1,
    });
    if (main.statusCode!=200)
        logger.warn('Vipdb main could not be fetched');
    else
        res = res.concat((main.body||'').split('\n'));
    const small = yield api_request({
        endpoint: '/lpm/vipdb/small_geo',
        no_throw: 1,
        force: 1,
    });
    if (small.statusCode!=200)
        logger.warn('Vipdb small could not be fetched');
    else
        res = res.concat((small.body||'').split('\n'));
    return res.map(v=>v.split(';')[0]);
});

E.ensure_data = api_request=>etask(function*(){
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
            logger.error('Failed to parse vipdb %s', e.message);
    }
    const current_vipdb_version = yield api_request({
        endpoint: '/lpm/vipdb/version',
        no_throw: 1,
        force: 1,
    });
    if (!data && !current_vipdb_version)
        return logger.warn('Unable to get current vipdb version');
    if (!data || data.version!=current_vipdb_version)
    {
        logger.notice('Fetching vipdb data. New version %s available '
        +'(current is %s)', current_vipdb_version.body, data && data.version);
        const new_vipdb = yield get_current_vipdb_data(api_request);
        if (!new_vipdb)
            return;
        data = {vipdb: new_vipdb, version: current_vipdb_version.body};
        file.write_e(vipdb_path, JSON.stringify(data));
    }
    data = prepare_data(data && data.vipdb || []);
    pending.forEach(p=>p.continue());
    pending = null;
});
