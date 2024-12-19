// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true, es9: true*/
const {Agent: https_agent} = require('https');
const {Agent: http_agent} = require('http');
const _ = require('lodash4');
const etask = require('./etask.js');
const url = require('./url.js');
const esm_loader = require('./lpm_esm_loader.js');
let got = esm_loader.require('got').got.extend({
    hooks: {
        beforeRequest: [
            opt=>{
                if (!is_valid_domain(opt.url.hostname))
                    throw new Error('Invalid hostname');
            },
        ],
    },
});

const is_valid_domain = domain=>url.is_ip(domain)
    || url.is_valid_domain(domain) || domain=='localhost';

const mk_http_agent = (target, proxy)=>new http_agent({
    host: proxy.hostname,
    port: proxy.port,
    path: `${target.hostname}:${target.port}`,
    setHost: false,
    agent: false,
    timeout: 0,
});

const mk_https_agent = (target, proxy)=>new https_agent({
    host: proxy.hostname,
    port: proxy.port,
    method: 'CONNECT',
    path: `${target.hostname}:${target.port}`,
    setHost: false,
    agent: false,
    timeout: 0,
});

const mk_got_agent_opt = (target, proxy)=>{
    const target_url = new URL(target);
    const proxy_url = new URL(proxy);
    if (target_url.protocol.startsWith('http:'))
        return {http: mk_http_agent(target_url, proxy_url)};
    return {https: mk_https_agent(target_url, proxy_url)};
};

const mk_opt_from_agent = agent=>agent instanceof https_agent ?
    {https: agent} : {http: agent};

const to_got_options = orig=>{
    const got_opt = _.omit(orig, ['qs', 'timeout', 'json', 'gzip', 'ca',
        'rejectUnauthorized', 'proxy', 'host', 'uri', 'path', 'agent']);
    got_opt.throwHttpErrors = false;
    got_opt.responseType = 'text';
    got_opt.https = {};
    if (orig.qs)
        got_opt.searchParams = orig.qs;
    if (orig.timeout)
        got_opt.timeout = {request: orig.timeout};
    if ('json' in orig && orig.json!==false)
    {
        got_opt.json = _.isObject(orig.json) ? orig.json : orig.body;
        got_opt.responseType = 'json';
        delete got_opt.body;
    }
    if (orig.form)
        delete got_opt.body;
    if (orig.gzip)
        got_opt.decompress = orig.gzip;
    if ('rejectUnauthorized' in orig)
        got_opt.https.rejectUnauthorized = !!orig.rejectUnauthorized;
    if ('ca' in orig)
        got_opt.https.certificateAuthority = orig.ca;
    if ('agent' in orig)
        got_opt.agent = mk_opt_from_agent(orig.agent);
    else if ('proxy' in orig)
        got_opt.agent = mk_got_agent_opt(orig.url, orig.proxy);
    if (_.isEmpty(got_opt.https))
        got_opt.https = undefined;
    return got_opt;
};

const def_callback = (err, res)=>{
    if (err instanceof Error)
        throw err;
    if (err)
        throw new Error(err);
    return res;
};

const E = module.exports = (opt, callback)=>E.request(opt, callback);

E.request = (opt, callback)=>etask(function*(){
    this.on('uncaught', callback);
    if (typeof callback != 'function')
        callback = def_callback;
    const res = yield got(to_got_options(opt));
    return callback(null, res);
});

E.defaults = opt=>{
    got = got.extend(to_got_options(opt));
    return E;
};
