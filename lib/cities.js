// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/
const path = require('path');
const _ = require('lodash');
const fs = require('fs');
const readline = require('readline');
const etask = require('../util/etask.js');
const csv = require('../util/csv.js');
const qw = require('../util/string.js').qw;
const zcountry = require('../util/country.js');
const E = module.exports;
const cities_csv = path.resolve(__dirname, '../db/cities.csv');
const locations = require('./locations.js');
const diacritic = require('diacritic');

let data;
let pending;
let vipdb_data;

const prepare_data = csv_data=>{
    csv_data.shift();
    const cities = [], structured = {};
    csv_data.forEach(d=>{
        if (!d)
            return;
        const r_id = d[1] && d[1].toLowerCase();
        const c_id = d[3].toLowerCase();
        const city_id = diacritic.clean(d[0]).toLowerCase()
            .replace(/[^a-z0-9]/g, '');
        if (!c_id)
            return;
        const city_vip = _.get(vipdb_data,
            `locations.${c_id}.${r_id}.${city_id}`);
        if (d[0]&&city_vip)
        {
            cities.push({
                city_name: d[0],
                region_id: r_id,
                country_id: c_id,
                mob: city_vip._mob,
            });
        }
        if (!structured[c_id]&&vipdb_data.locations[c_id])
        {
            structured[c_id] = {
                country_name: zcountry.code2label(c_id),
                country_id: c_id,
                mob: vipdb_data.locations[c_id]._mob,
                regions: {},
            };
        }
        const region_vip = _.get(vipdb_data, `locations.${c_id}.${r_id}`);
        if (r_id&&region_vip)
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
    const regions = _.fromPairs(_.toPairs(structured).map(p=>[
        p[0],
        _.values(p[1].regions).sort(
            (m, n)=>m.region_name.localeCompare(n.region_name)),
    ]));
    const countries = _.values(structured)
        .map(c=>_.pick(c, qw`country_id country_name mob`))
        .sort((m, n)=>(m.country_name||'').localeCompare(n.country_name));
    return {cities, regions, countries, asns: vipdb_data.asns};
};

E.ensure_data = ()=>etask(function*(){
    if (data)
        return;
    if (pending)
    {
        pending.push(this);
        return yield this.wait();
    }
    pending = [];
    vipdb_data = yield locations.all_locations();
    const csv_data = [];
    readline.createInterface({input: fs.createReadStream(cities_csv)})
    .on('line', l=>csv_data.push(csv.to_arr(l)[0]))
    .on('close', this.continue_fn());
    yield this.wait();
    data = prepare_data(csv_data);
    pending.forEach(p=>p.continue());
    pending = null;
});

E.all_locations = ()=>etask(function*(){
    yield E.ensure_data();
    return data;
});
