#!/usr/bin/env node
// LICENSE_CODE ZON
'use strict'; /*jslint node:true*/

const fs = require('fs');
const yauzl = require('yauzl');
const request = require('request');
const StringDecoder = require('string_decoder').StringDecoder;

const DB_URL = 'http://geolite.maxmind.com/download/geoip/database/GeoLite2-City-CSV.zip';
const FILE_REGEX = /\/GeoLite2-City-Locations-en.csv$/;

let unzip_file = (buf, mask, cb)=>{
    yauzl.fromBuffer(buf, {lazyEntries: true}, (error, zip)=>{
        if (error)
            throw error;
        zip.readEntry();
        zip.on('entry', entry=>{
            if (!mask.test(entry.fileName))
            {
                zip.readEntry();
                return;
            }
            zip.openReadStream(entry, (err, stream)=>{
                if (err)
                    throw err;
                let decoder = new StringDecoder('utf8'), s = '';
                stream.on('data', chunk=>{ s += decoder.write(chunk); });
                stream.on('end', ()=>cb(s));
            });
        });
    });
};

let process_city_csv = s=>{
    console.log('+ csv with cities extracted');
    let countries = {}, regions = {};
    let lines = s.split('\n');
    lines.shift();
    let csv_data = lines.reduce((arr, l)=>{
        let d = [], re = /(?!\s*$)\s*(?:'([^'\\]*(?:\\[\S\s][^'\\]*)*)'|"([^"\\]*(?:\\[\S\s][^"\\]*)*)"|([^,'"\s\\]*(?:\s+[^,'"\s\\]+)*))\s*(?:,|$)/g;
        l.replace(re, (m0, m1, m2, m3)=>d.push(m1 ? m1.replace(/\\'/g, "'") :
            m2 ? m2.replace(/\\"/g, '"') : m3));
        if (!d.length || !d[10])
           return arr;
        arr.push(d);
        let c_id = d[4], r_id = d[6];
        if (!countries[c_id])
        {
            regions[c_id] = {};
            countries[c_id] = d[5];
        }
        if (!regions[c_id][r_id])
            regions[c_id][r_id] = d[7];
        return arr;
    }, []);
    console.log('+ csv parsed');
    let data = [], for_db = str=>str.replace(/'/g, "''");
    data.push('BEGIN TRANSACTION;');
    data.push('CREATE TABLE cities (name VARCHAR, region_id CHAR(3), '+
        'country_id CHAR(2));');
    csv_data.forEach(rec=>{
        let name = for_db(rec[10]);
        let r_id = for_db(rec[6]);
        let c_id = for_db(rec[4]);
        data.push(
            `INSERT INTO "cities" VALUES('${name}','${r_id}','${c_id}');`);
    });
    console.log('+ '+csv_data.length+' records of cities added');
    data.push('CREATE TABLE countries (country_id CHAR(2), name VARCHAR, '+
        'PRIMARY KEY (country_id));');
    for (let country_id in countries)
    {
        let id = for_db(country_id);
        let name = for_db(countries[country_id]);
        data.push(`INSERT INTO "countries" VALUES('${id}','${name}');`);
    }
    console.log(
        '+ '+Object.keys(countries).length+' records of countries added');
    let c = 0;
    data.push('CREATE TABLE regions (region_id CHAR(3), name VARCHAR, '+
        'country_id CHAR(2));');
    for (let country_id in regions)
    {
        for (let region_id in regions[country_id])
        {
            let id = for_db(region_id);
            let name = for_db(regions[country_id][region_id]);
            let c_id = for_db(country_id);
            data.push(
                `INSERT INTO "regions" VALUES('${id}','${name}','${c_id}');`);
            c++;
        }
    }
    console.log('+ '+c+' records of regions added');
    data.push('CREATE INDEX region_country_id ON regions(country_id);');
    data.push('CREATE INDEX city_region_id ON cities(region_id);');
    data.push('CREATE INDEX city_country_id ON cities(country_id);');
    data.push('COMMIT;');
    data.push('');
    fs.writeFileSync('./city.sql', data.join('\n'));
};

request(DB_URL, {encoding: null}, (err, res, body)=>{
    if (err)
        return console.log('Download data error: '+err);
    if (res.statusCode!=200)
        return console.log('Download data error, code: '+res.statusCode);
    console.log('+ db downloaded');
    unzip_file(body, FILE_REGEX, process_city_csv);
});

