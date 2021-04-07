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

E.all_locations = mgr=>etask(function*(){
    yield E.ensure_data(mgr);
    return data;
});

const get_current_vipdb_data = mgr=>etask(function*(){
    let res = [];
    if (!mgr.server_conf || !mgr.server_conf.client.ccgi_ws_mux)
    {
        const api_resp = yield mgr.api_request({
            endpoint: '/lpm/vipdb/main',
            no_throw: 1,
            force: 1,
        });
        if (api_resp.statusCode!=200)
            throw new Error('vipdb main could not be fetched');
        else
            res = res.concat((api_resp.body||'').split('\n'));
    }
    else
    {
        const vipdb_data = yield mgr.lpm_f.get_vipdb();
        res = res.concat((vipdb_data||'').split('\n'));
    }
    if (!mgr.server_conf || !mgr.server_conf.client.ccgi_ws_mux)
    {
        const api_resp = yield mgr.api_request({
            endpoint: '/lpm/vipdb/small_geo',
            no_throw: 1,
            force: 1,
        });
        if (api_resp.statusCode!=200)
            throw new Error('vipdb small could not be fetched');
        else
            res = res.concat((api_resp.body||'').split('\n'));
    }
    return res.map(v=>v.split(';')[0]);
});

E.ensure_data = mgr=>etask(function*(){
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
    let current_vipdb_version;
    try {
        current_vipdb_version = yield mgr.lpm_f.get_vipdb_version();
    } catch(e){
        throw new Error('Unable to get current vipdb version: '+e.messsage);
    }
    if (!data || data.version!=current_vipdb_version)
    {
        logger.notice('Fetching vipdb data. New version %s available'
            +' (current is %s)', current_vipdb_version, data && data.version);
        const new_vipdb = yield get_current_vipdb_data(mgr);
        if (!new_vipdb)
            return;
        data = {vipdb: new_vipdb, version: current_vipdb_version};
        file.write_e(vipdb_path, JSON.stringify(data));
    }
    data = prepare_data(data && data.vipdb || []);
    pending.forEach(p=>p.continue());
    pending = null;
});
