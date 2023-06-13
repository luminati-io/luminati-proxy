// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/
const path = require('path');
const _ = require('lodash4');
const etask = require('../util/etask.js');
const lpm_file = require('../util/lpm_file.js');
const file = require('../util/file.js');
const date = require('../util/date.js');
const logger = require('./logger.js').child({category: 'LOCATIONS'});
const E = module.exports;

let data;
let pending;

const prepare_data = (locs, zipcodes={})=>{
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
        if (zipcodes[country] && zipcodes[country][city])
            locations[country][region][city].zip = zipcodes[country][city];
        if (!asns[country])
            asns[country] = {};
        if (!asns[country][asn])
            asns[country][asn] = {_mob: !!mob};
        asns[country][asn]._mob = asns[country][asn]._mob||!!mob;
    });
    return {locations, asns};
};

E.all_locations = (mgr, clear=false)=>etask(function*(){
    yield E.ensure_data(mgr, clear);
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

const schedule_reload = (mgr, err_message, ret_val={})=>{
    if (err_message)
        logger.error(err_message);
    mgr.schedule_vipdb_reload();
    return ret_val;
};

const get_zipcodes = mgr=>etask(function*(){
    this.on('uncaught', e=>this.return(schedule_reload(mgr,
        `Error while loading zipcodes: ${e.message}`)));
    if (mgr.argv.high_perf)
        return void logger.notice('Skip loading zipcodes');
    const api_resp = yield mgr.api_request({
        endpoint: '/zipcodes',
        no_throw: 1,
        force: 1,
        json: 1,
    });
    // eslint-disable-next-line
    let {statusCode: sc, statusMessage: msg} = api_resp;
    if (sc!=200)
        return schedule_reload(mgr, `Failed to load zipcodes ${sc} ${msg}`);
    if (!api_resp.body || _.isEmpty(api_resp.body))
        return schedule_reload(mgr, 'Got empty zipcodes responce');
    logger.notice('Zipcodes loaded in %s',
        date.describe_interval(Date.now()-this.tm_create));
    return api_resp.body;
});

E.ensure_data = (mgr, clear)=>etask(function*(){
    if (clear)
        data = undefined;
    if (data || data===null)
        return;
    if (pending)
    {
        pending.push(this);
        return yield this.wait();
    }
    pending = [];
    const vipdb_path = path.resolve(lpm_file.work_dir, 'vipdb.csv');
    try {
        data = JSON.parse(file.read_e(vipdb_path));
        data.vipdb = Array.isArray(data.vipdb) && data.vipdb.filter(Boolean);
    } catch(e){
        if (e.code!='ENOENT')
            logger.error('Failed to parse vipdb %s', e.message);
    }
    let current_vipdb_version;
    try {
        current_vipdb_version = yield mgr.lpm_f.get_vipdb_version();
    } catch(e){
        throw new Error('Unable to get current vipdb version: '+e.messsage);
    }
    if (!data || data.version!=current_vipdb_version || !data.vipdb.length)
    {
        logger.notice('Fetching vipdb data. New version %s available'
            +' (current is %s)', current_vipdb_version, data && data.version);
        const new_vipdb = yield get_current_vipdb_data(mgr);
        if (!new_vipdb || !new_vipdb.filter(Boolean).length)
            return;
        data = {vipdb: new_vipdb, version: current_vipdb_version};
        file.write_e(vipdb_path, JSON.stringify(data));
    }
    const zipcodes = yield get_zipcodes(mgr);
    data = prepare_data(data && data.vipdb || [], zipcodes);
    pending.forEach(p=>p.continue());
    pending = null;
});
