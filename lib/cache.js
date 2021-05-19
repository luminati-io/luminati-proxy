// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true, evil: true*/
const etask = require('../util/etask.js');
const date = require('../util/date.js');
const logger = require('./logger.js').child({category: 'Cache'});
const {CACHE_LIMIT} = require('./consts.js');

const Cache = etask._class(class Cache {
    constructor(opt={}){
        this.opt = opt;
        this.space_taken = 0;
        this.map = new Map();
    }
    set(url, res_data, headers){
        const duration = date.ms.HOUR;
        const space = this.calc_size(res_data, headers);
        if (this.space_taken+space>=CACHE_LIMIT)
            return logger.warn('limit %s reached', CACHE_LIMIT);
        if (duration)
        {
            setTimeout(()=>{
                this.space_taken -= space;
                this.map.delete(url);
            }, duration);
        }
        this.map.set(url, {res_data, headers});
        this.space_taken += space;
    }
    has(url){
        return this.map.has(url);
    }
    get(url){
        return this.map.get(url);
    }
    calc_size(res_data, headers){
        const data_size = res_data.reduce((acc, el)=>acc+el.length, 0);
        let headers_size = 0;
        for (let key in headers)
            headers_size += key.length+headers[key].length;
        return data_size+headers_size;
    }
    *start_reporting(_this){
        this.on('uncaught', e=>{
            logger.error(e.message);
        });
        while (1)
        {
            if (process.send)
                process.send({code: 'CACHE_REPORT', space: _this.space_taken});
            yield etask.sleep(2*date.ms.SEC);
        }
    }
});

module.exports = Cache;
