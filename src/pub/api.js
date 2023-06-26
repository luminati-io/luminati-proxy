// LICENSE_CODE ZON ISC
'use strict'; /*jslint browser:true, react:true, es6:true*/
import _ from 'lodash4';
import etask from '../../util/etask.js';
import ajax from '../../util/ajax.js';
import date from '../../util/date.js';
const {assign, keys} = Object;

const process_payload = payload=>{
    if (!payload || _.isEmpty(payload))
        return payload;
    let new_pl = _.cloneDeep(payload);
    keys(new_pl).forEach(k=>{
        // jquery omit empty arrays in req body payload
        if (Array.isArray(new_pl[k]) && !new_pl[k].length)
            new_pl[k] = [''];
    });
    return new_pl;
};

const Requester = etask._class(class Requester {
    constructor(json, base_url, qs, headers){
        this.json = json || false;
        this.base_url = base_url || '';
        this.defaults = {
            qs: qs||{},
            headers: headers||{},
        };
    }
    request(url='/', method='GET', body={}, opt={}){
        const {qs={}, headers={}, exp_hdr=false, safe=false,
            timeout=30*date.ms.SEC} = opt;
        let _qs = assign({}, this.defaults.qs, qs);
        let _headers = assign({}, this.defaults.headers, headers);
        if (!url.startsWith('/'))
            url = '/'+url;
        if (!url.startsWith(this.base_url))
            url = this.base_url+url;
        let _this = this;
        return etask(function*(){
            this.on('uncaught', e=>{
                console.error('Api requester error', {url, method, _qs,
                _headers, body, json: !!_this.json, exp_hdr}, e);
                throw e;
            });
            return yield ajax({
                url,
                method,
                qs: _qs,
                headers: _headers,
                data: process_payload(body),
                json: !!_this.json,
                timeout,
                return_headers: exp_hdr,
                no_throw: safe,
            });
        });
    }
    *get(_this, url, opt){
        return yield _this.request(url, 'GET', null, opt);
    }
    *post(_this, url, body, opt){
        return yield _this.request(url, 'POST', body, opt);
    }
    *put(_this, url, body, opt){
        return yield _this.request(url, 'PUT', body, opt);
    }
    *delete(_this, url, body, opt){
        return yield _this.request(url, 'DELETE', body, opt);
    }
});

const Api = etask._class(class Api {
    constructor(){
        this.base_url = '';
        this.base_qs = {};
        this.base_headers = {};
    }
    get json(){
        this.init();
        return this.json_requester;
    }
    #get_requester(json=false){
        return new Requester(json, this.base_url, this.base_qs,
            this.base_headers);
    }
    init(force){
        if (!this.requester || force)
            this.requester = this.#get_requester();
        if (!this.json_requester || force)
            this.json_requester = this.#get_requester(true);
    }
    *request(_this, method, ...args){
        _this.init();
        return yield _this.requester[method](...args);
    }
    *get(_this, url, opt){
        return yield _this.request('get', url, opt);
    }
    *post(_this, url, body, opt){
        return yield _this.request('post', url, body, opt);
    }
    *put(_this, url, body, opt){
        return yield _this.request('put', url, body, opt);
    }
    *delete(_this, url, body, opt){
        return yield _this.request('delete', url, body, opt);
    }
});

const Api_v1 = etask._class(class Api_v1 extends Api {
    constructor(){
        super();
        this.base_url = '/api';
    }
});

const Api_v2 = etask._class(class Api_v2 extends Api {
    constructor(){
        super();
        this.base_url = '/api/v2';
    }
});

export const v1 = new Api_v1();

export const v2 = new Api_v2();

export const main = v1;
