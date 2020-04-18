// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/
const path = require('path');
const _ = require('lodash');
const fs = require('fs');
const readline = require('readline');
const etask = require('../util/etask.js');
const csv = require('../util/csv.js');
const qw = require('../util/string.js').qw;
const file = require('../util/file.js');
const zerr = require('../util/zerr.js');
const lpm_file = require('../util/lpm_file.js');
const zcountry = require('../util/country.js');
const locations = require('./locations.js');
const logger = require('./logger.js');
const diacritic = require('diacritic');
const E = module.exports;

let data;
let pending;

const get_asn_carrier_map = api_request=>etask(function*(){
    const carriers_path = path.resolve(lpm_file.work_dir, 'carriers.json');
    let carrier2asn = {};
    try { carrier2asn = JSON.parse(file.read_e(carriers_path)); }
    catch(e){
        if (e.code!='ENOENT')
            logger.warn('Failed to parse carriers %s', zerr.e2s(e));
    }
    let current_carrier_version;
    try {
        const res = yield api_request({endpoint: '/lpm/carriers/version',
            force: 1});
        current_carrier_version = res.body;
    } catch(e){
        logger.warn('Unable to get current carriers version: %s', e.message);
        return {};
    }
    if (carrier2asn.version!=current_carrier_version)
    {
        logger.notice('Fetching carriers data. New version %s available',
            current_carrier_version);
        let carrier_data;
        try {
            const res = yield api_request({endpoint: '/lpm/carriers/asns',
                force: 1});
            carrier_data = res.body;
        } catch(e){
            logger.warn('Unable to get current carrier data');
            return {};
        }
        carrier2asn = {data: carrier_data, version: current_carrier_version};
        file.write_e(carriers_path, JSON.stringify(carrier2asn));
    }
    const asn2carrier = {};
    for (const carrier in carrier2asn.data)
    {
        for (const asn of carrier2asn.data[carrier])
        {
            if (asn2carrier[asn] && asn2carrier[asn]!=carrier)
            {
                logger.warn('conflict on asn %s, %s, %s', asn,
                    asn2carrier[asn], carrier);
            }
            asn2carrier[asn] = carrier;
        }
    }
    return asn2carrier;
});

const prepare_data = (csv_data, vipdb_data, asn2carrier)=>{
    csv_data.shift();
    const cities = [], structured = {};
    if (vipdb_data)
    {
        csv_data.forEach(d=>{
            if (!d)
                return;
            const r_id = d[1] && d[1].toLowerCase();
            const c_id = d[3] && d[3].toLowerCase();
            const city_id = diacritic.clean(d[0]).toLowerCase()
                .replace(/[^a-z0-9]/g, '');
            if (!c_id)
                return;
            const city_vip = _.get(vipdb_data,
                `locations.${c_id}.${r_id}.${city_id}`);
            if (d[0] && city_vip)
            {
                cities.push({
                    city_name: d[0],
                    region_id: r_id,
                    country_id: c_id,
                    mob: city_vip._mob,
                });
            }
            if (!structured[c_id] && vipdb_data.locations[c_id])
            {
                structured[c_id] = {
                    country_name: zcountry.code2label(c_id),
                    country_id: c_id,
                    mob: vipdb_data.locations[c_id]._mob,
                    regions: {},
                    asns: vipdb_data.asns[c_id],
                    carriers: [...new Set(Object.keys(vipdb_data.asns[c_id])
                        .map(asn=>asn2carrier[asn]).filter(Boolean))],
                };
            }
            const region_vip = _.get(vipdb_data, `locations.${c_id}.${r_id}`);
            if (r_id && region_vip)
            {
                const regions = structured[c_id].regions;
                if (!regions[r_id])
                {
                    regions[r_id] = {
                        region_id: r_id,
                        region_name: d[2],
                        mob: region_vip._mob,
                    };
                }
            }
        });
    }
    const regions = _.fromPairs(_.toPairs(structured).map(p=>[
        p[0],
        _.values(p[1].regions).sort(
            (m, n)=>m.region_name.localeCompare(n.region_name)),
    ]));
    const carriers = Object.keys(structured).reduce(
        (acc, el)=>Object.assign(acc, {[el]: structured[el].carriers}), {});
    const countries = _.values(structured)
        .map(c=>_.pick(c, qw`country_id country_name mob`))
        .sort((m, n)=>(m.country_name||'').localeCompare(n.country_name));
    const asns = vipdb_data && vipdb_data.asns || {};
    return {cities, regions, countries, asns, carriers};
};

E.ensure_data = api_request=>etask(function*(){
    if (data)
        return;
    if (pending)
    {
        pending.push(this);
        return yield this.wait();
    }
    pending = [];
    const [vipdb_data, asn2carrier] = yield etask.all([
        locations.all_locations(api_request),
        get_asn_carrier_map(api_request),
    ]);
    const csv_data = [];
    const cities_csv = path.resolve(__dirname, '../db/cities.csv');
    readline.createInterface({input: fs.createReadStream(cities_csv)})
    .on('line', l=>csv_data.push(csv.to_arr(l)[0]))
    .on('close', this.continue_fn());
    yield this.wait();
    data = prepare_data(csv_data, vipdb_data, asn2carrier);
    pending.forEach(p=>p.continue());
    pending = null;
});

E.all_locations = ()=>etask(function*(){
    yield E.ensure_data();
    return data;
});
