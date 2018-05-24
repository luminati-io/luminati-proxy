// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/
const path = require('path');
const hutil = require('hutil');
const etask = hutil.etask;
const fs = require('fs');
const readline = require('readline');
const csv = hutil.csv;
const vipdb_csv = path.resolve(__dirname, '../db/vipdb.csv');
const E = module.exports;

let data;
let pending;

const prepare_data = csv_data=>{
    console.log('preparing');
    const countries = {};
    const cities = {};
    const regions = {};
    const asns = {};
    csv_data.forEach(d=>{
        if (!d)
            return;
        const [country, asn, region, city, mob] = d[0].split('_');
        const m = {mob};
        countries[country] = m;
        regions[country] = regions[country]||{};
        regions[country][region] = m;
        cities[country+region+city] = m;
        asns[asn] = m;
    });
    return {countries, regions, cities, asns};
};

E.all_locations = ()=>etask(function*(){
    yield E.ensure_data();
    return data;
});

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
    readline.createInterface({input: fs.createReadStream(vipdb_csv)})
    .on('line', l=>csv_data.push(csv.to_arr(l)[0]))
    .on('close', this.continue_fn());
    yield this.wait();
    data = prepare_data(csv_data);
    pending.forEach(p=>p.continue());
    pending = null;
});
