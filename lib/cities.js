// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/
const path = require('path');
const _ = require('lodash');
const hutil = require('hutil');
const file = hutil.file;
const csv = hutil.csv;
const qw = hutil.string.qw;
const E = module.exports;
const cities_csv = path.resolve(__dirname, '../db/cities.csv');

const prepare_data = csv_data=>{
    csv_data.shift();
    const cities = [], structured = {};
    csv_data.forEach(d=>{
        const r_id = d[1].toLowerCase();
        const c_id = d[3].toLowerCase();
        cities.push({
            city_name: d[0],
            region_id: r_id,
            country_id: c_id,
        });
        if (!structured[c_id])
        {
            structured[c_id] = {
                country_name: d[4],
                country_id: c_id,
                regions: {},
            };
        }
        const regions = structured[c_id].regions;
        if (!regions[r_id])
        {
            regions[r_id] = {
                region_id: r_id,
                region_name: d[2],
            };
        }
    });
    const regions = _.fromPairs(_.toPairs(structured).map(p=>[
        p[0],
        _.values(p[1].regions).sort(
            (m,n)=>m.region_name.localeCompare(n.region_name)),
    ]));
    const countries = _.values(structured)
        .map(c=>_.pick(c, qw`country_id country_name`))
        .sort((m,n)=>m.country_name.localeCompare(n.country_name));
    return {cities, regions, countries};
};

var data;

const ensure_data = ()=>{
    if (data)
        return;
    data = prepare_data(csv.to_arr(file.read_e(cities_csv)));
};

E.countries = ()=>{
    ensure_data();
    return data.countries||[];
};

E.regions = country_id=>{
    if (!country_id)
        return [];
    ensure_data();
    return data.regions[country_id.toLowerCase()]||[];
};

E.cities = (country_id, region_id)=>{
    if (!country_id)
        return [];
    ensure_data();
    country_id = country_id.toLowerCase();
    region_id = region_id && region_id.toLowerCase();
    return data.cities.filter(c=>c.country_id == country_id &&
        (!region_id || c.region_id == region_id));
};
