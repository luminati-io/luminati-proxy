// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/
const path = require('path');
const _ = require('lodash');
const hutil = require('hutil');
const fs = require('fs');
const readline = require('readline');
const etask = hutil.etask;
const csv = hutil.csv;
const qw = hutil.string.qw;
const E = module.exports;
const cities_csv = path.resolve(__dirname, '../db/cities.csv');

const prepare_data = csv_data=>{
    csv_data.shift();
    const cities = [], structured = {};
    csv_data.forEach(d=>{
        if (!d)
            return;
        const r_id = d[1] && d[1].toLowerCase();
        const c_id = d[3].toLowerCase();
        if (!c_id)
            return;
        if (d[0])
        {
            cities.push({
                city_name: d[0],
                region_id: r_id,
                country_id: c_id,
            });
        }
        if (!structured[c_id])
        {
            structured[c_id] = {
                country_name: hutil.country.code2label(c_id),
                country_id: c_id,
                regions: {},
            };
        }
        if (r_id)
        {
            const regions = structured[c_id].regions;
            if (!regions[r_id])
            {
                regions[r_id] = {
                    region_id: r_id,
                    region_name: d[2],
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
        .map(c=>_.pick(c, qw`country_id country_name`))
        .sort((m, n)=>(m.country_name||'').localeCompare(n.country_name));
    return {cities, regions, countries};
};

let data;
let pending;

E.ensure_data = ()=>etask(function*(){
    if (data)
        return;
    if (pending)
    {
        pending.push(this);
        return yield this.wait();
    }
    pending = [];
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

E.countries = ()=>etask(function*(){
    yield E.ensure_data();
    return data.countries||[];
});

E.regions = country_id=>etask(function*(){
    if (!country_id)
        return [];
    yield E.ensure_data();
    return data.regions[country_id.toLowerCase()]||[];
});

E.cities = (country_id, region_id)=>etask(function*(){
    if (!country_id)
        return [];
    yield E.ensure_data();
    country_id = country_id.toLowerCase();
    region_id = region_id && region_id.toLowerCase();
    return data.cities.filter(c=>c.country_id == country_id &&
        (!region_id || c.region_id == region_id));
});
