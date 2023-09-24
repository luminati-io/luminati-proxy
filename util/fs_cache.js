// LICENSE_CODE ZON
'use strict'; /*jslint node:true*/
const etask = require('./etask.js');
const fs = require('fs');
const path = require('path');

const E = exports;

class Fetchable_FS_Cache {
    constructor(conf){
        this.path = conf.path;
        this.folder = path.dirname(conf.path);
        this.expires = conf.expires || 0;
        this.fetch_fn = conf.fetch;
        this.on_data = conf.on_data;
        this.last_fetch = null;
        this.fetch_running = null;
    }
    set(data){
        const _this = this;
        return etask(function*(){
            yield fs.promises.mkdir(_this.folder, {recursive: true});
            yield fs.promises.writeFile(_this.path, JSON.stringify(data));
            _this.last_fetch = new Date();
        });
    }
    fetch(){
        const _this = this;
        return etask(function*(){
            this.finally(()=>_this.fetch_running = null);
            _this.fetch_running = this;
            const data = yield _this.fetch_fn();
            return yield _this.on_data ? _this.on_data(data) : data;
        });
    }
    get(){
        const _this = this;
        return etask(function*(){
            if (_this.fetch_running)
                return yield this.wait_ext(_this.fetch_running);
            let exists;
            try {
                yield fs.promises.access(_this.path,
                    fs.constants.R_OK);
                exists = true;
            } catch(e){ exists = false; }
            if (!_this.last_fetch || !exists ||
                _this.expires && new Date()-_this.last_fetch>_this.expires)
            {
                const data = yield _this.fetch();
                yield _this.set(data);
                return data;
            }
            const content = yield fs.promises.readFile(_this.path, 'utf-8');
            return yield JSON.parse(content);
        });
    }
    delete(){
        const _this = this;
        return etask(function*(){
            return yield fs.promises.rm(_this.folder, {recursive: true});
        });
    }
}

E.Fetchable_FS_Cache = Fetchable_FS_Cache;
