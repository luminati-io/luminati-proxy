#!/usr/bin/env node
// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/
const hostname = require('os').hostname();
const request = require('request').defaults({gzip: true});
const etask = require('../util/etask.js');
const date = require('../util/date.js');
const zerr = require('../util/zerr.js');
const logger = require('./logger.js').child({category: 'Cloud'});

class Cloud_mgr {
    constructor(mgr){
        this.mgr = mgr;
    }
    request(za, opt){
        let _this = this;
        return etask(function*_request(){
            const _url = `http://${za}.luminati.io:22999/api/${opt.endpoint}`;
            const method = opt.method||'GET';
            let lpm_token = (_this.mgr._defaults.lpm_token||'').split('|')[0];
            logger.debug('API: %s %s %s', method, _url,
                JSON.stringify(opt.qs||{}));
            const res = yield etask.nfn_apply(request, [{
                method,
                url: _url,
                qs: opt.qs,
                json: opt.json===false ? false : true,
                form: opt.form,
                timeout: opt.timeout||20*date.ms.SEC,
                headers: {
                    cookie: `lpm_token=${lpm_token}`,
                },
            }]);
            if (res.statusCode==502)
                throw new Error('Server unavailable');
            if (!/2../.test(res.statusCode) && !opt.no_throw)
            {
                let msg = `API call to ${_url} FAILED with status`
                    +' '+res.statusCode;
                if (res.body && res.statusCode!=404)
                    msg += ' '+(res.body.slice && res.body.slice(0, 40) || '');
                throw new Error(msg);
            }
            return res.body;
        });
    }
    get_instances(){
        let _this = this;
        return etask(function*_get_instances(){
            this.on('uncaught', e=>
                logger.error('Could not get instances: %s', zerr.e2s(e)));
            let res = yield _this.mgr.lpm_f.get_cloud_zagents();
            if (res.err)
                throw res.err;
            return res.zagents.filter(s=>s!=hostname);
        });
    }
    get_logs(qs){
        let _this = this;
        return etask(function*_get_logs(){
            this.on('uncaught', e=>
                logger.error('Could not get logs: %s', zerr.e2s(e)));
            let servers = yield _this.get_instances();
            if (!servers.length)
                return [];
            let opt = {endpoint: 'logs', qs};
            return yield etask.all(servers.map(s=>_this.request(s, opt)));
        });
    }
}

module.exports = Cloud_mgr;
