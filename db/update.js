#!/usr/bin/env node
// LICENSE_CODE ZON
'use strict'; /*jslint node:true*/

const yauzl = require('yauzl');
const request = require('request');
const hutil = require('hutil');
const StringDecoder = require('string_decoder').StringDecoder;
const sqlite3 = require('sqlite3');
const file = hutil.file;

const DB_URL = 'http://geolite.maxmind.com/download/geoip/database/GeoLite2-City-CSV.zip';
const FILE_REGEX = /\/GeoLite2-City-Locations-en.csv$/;

let unzip_file = (buf, mask, cb)=>{
    yauzl.fromBuffer(buf, {lazyEntries: true}, (err, zip)=>{
        if (err)
            throw err;
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
    if (file.exists('./city.db'))
        file.unlink_e('./city.db');
    let db = new sqlite3.Database('./city.db');
    db.serialize(()=>{
        let fallback = function(err){
            if (err)
                throw err;
        };
        db.run('BEGIN TRANSACTION', [], fallback);
        db.run('CREATE TABLE cities (name VARCHAR, region_id CHAR(3), '+
            'country_id CHAR(2))', [], fallback);
        db.run('CREATE TABLE countries (country_id CHAR(2), name VARCHAR, '+
            'PRIMARY KEY (country_id))', [], fallback);
        db.run('CREATE TABLE regions (region_id CHAR(3), name VARCHAR, '+
            'country_id CHAR(2))', [], fallback);
        db.run('CREATE INDEX region_country_id ON regions(country_id)', [],
            fallback);
        db.run('CREATE INDEX city_region_id ON cities(region_id)', [],
            fallback);
        db.run('CREATE INDEX city_country_id ON cities(country_id)', [],
            fallback);
        console.log('+ schema created');
        let stmt, c = 0;
        db.parallelize(()=>{
            stmt = db.prepare('INSERT INTO countries VALUES (?, ?)', [],
                fallback);
            for (let country_id in countries)
            {
                stmt.run(country_id, countries[country_id], fallback);
                c++;
            }
            console.log('+ '+c+' records in table "countries" added');
        });
        stmt.finalize();
        db.parallelize(()=>{
            c = 0;
            stmt = db.prepare('INSERT INTO regions VALUES (?, ?, ?)', [],
                fallback);
            for (let country_id in regions)
            {
                for (let region_id in regions[country_id])
                {
                    stmt.run(region_id, regions[country_id][region_id],
                        country_id, fallback);
                    c++;
                }
            }
            console.log('+ '+c+' records in table "regions" added');
        });
        stmt.finalize();
        db.parallelize(()=>{
            stmt = db.prepare('INSERT INTO cities VALUES (?, ?, ?)', [],
                fallback);
            csv_data.forEach(rec=>stmt.run(rec[10], rec[6], rec[4], fallback));
            console.log('+ '+csv_data.length+' records in table cities added');
        });
        stmt.finalize();
        db.run('END TRANSACTION', [], fallback);
    });
    db.close();
};

request(DB_URL, {encoding: null}, (err, res, body)=>{
    if (err)
        return console.log('Download data error: '+err);
    if (res.statusCode!=200)
        return console.log('Download data error, code: '+res.statusCode);
    console.log('+ db downloaded');
    unzip_file(body, FILE_REGEX, process_city_csv);
});

