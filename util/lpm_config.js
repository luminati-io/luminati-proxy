// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/
const _ = require('lodash');
const swagger = require('../lib/swagger.json');
const lpm_file = require('./lpm_file.js');
const pkg = require('../package.json');
const string = require('./string.js');
const date = require('./date.js');
const qw = string.qw;

const prop_by_type = (def, type)=>_.toPairs(def.properties)
    .filter(p=>p[1].type==type).map(p=>p[0]);

const conf = {
    version: pkg.version,
    is_win: process.platform == 'win32',
    work_dir: lpm_file.work_dir,
    is_electron: process.versions && !!process.versions.electron,
    proxy_fields: Object.assign({}, swagger.definitions.proxy.properties,
        swagger.definitions.manager.properties),
    mgr_fields: _.keys(swagger.definitions.manager.properties),
    numeric_fields: prop_by_type(swagger.definitions.proxy, 'integer'),
    boolean_fields: prop_by_type(swagger.definitions.proxy, 'boolean'),
    credential_fields: qw`customer zone password token token_auth`,
    default_superproxy_domain: 'zproxy.lum-superproxy.io',
    hola_agent: 'proxy='+pkg.version+' node='+process.version
        +' platform='+process.platform,
};
conf.default_fields = [].concat(conf.credential_fields, conf.mgr_fields,
    'version');
conf.proxy_params = _(swagger.definitions.proxy.properties).pickBy(
    k=>!conf.credential_fields.includes(k)).keys().value();
conf.luminati_default = {
    port: 24000,
    zone: 'static',
    customer: process.env.LUMINATI_CUSTOMER,
    password: process.env.LUMINATI_PASSWORD,
    log: 'error',
    proxy: conf.default_superproxy_domain,
    proxy_port: 22225,
    proxy_count: 1,
    pool_type: 'sequential',
    sticky_ip: false,
    insecure: false,
    secure_proxy: false,
    short_username: false,
    ssl: false,
    test_url: 'http://lumtest.com/myip.json',
    proxy_retry: 2,
    proxy_switch: 2,
    socket_inactivity_timeout: 120*date.ms.SEC,
    last_preset_applied: 'session_long',
    multiply_ips: false,
    multiply_vips: false,
    multiply: 1,
};
conf.manager_default = Object
.assign({}, _.omit(conf.luminati_default, 'port'), {
    api: 'https://'+pkg.api_domain,
    www: 22999,
    www_whitelist_ips: [],
    ws: 22998,
    dropin: true,
    dropin_port: 22225,
    no_usage_stats: false,
    request_stats: true,
    logs: 1000,
    reverse_lookup_dns: false,
    proxy_creds_check: true,
    force: false,
    session_termination: false,
    config: lpm_file.get_file_path(
        '.luminati.json'.substr(conf.is_win ? 1 : 0)),
    loki: lpm_file.get_file_path(
        '.luminati.db'.substr(conf.is_win ? 1 : 0)),
    cookie: lpm_file.get_file_path(
        '.luminati.jar'.substr(conf.is_win ? 1 : 0)),
});

Object.assign(module.exports, conf);
