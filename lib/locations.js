// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/
const path = require('path');
const fs = require('fs');
const readline = require('readline');
const etask = require('../util/etask.js');
const csv = require('../util/csv.js');
const vipdb_csv = path.resolve(__dirname, '../db/vipdb.csv');
const vipdb_small_csv = path.resolve(__dirname, '../db/vipdb_small_geo.csv');
const E = module.exports;

let data;
let pending;

const prepare_data = csv_data=>{
    const locations = {};
    const asns = {};
    csv_data.forEach(d=>{
        if (!d)
            return;
        const [country, asn, region, city, mob] = d[0].split('_');
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
        asns[asn] = {_mob: !!mob};
    });
    return {locations, asns};
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
    readline.createInterface({input: fs.createReadStream(vipdb_small_csv)})
    .on('line', l=>csv_data.push(csv.to_arr(l)[0]))
    .on('close', this.continue_fn());
    yield this.wait();
    data = prepare_data(csv_data);
    pending.forEach(p=>p.continue());
    pending = null;
});
