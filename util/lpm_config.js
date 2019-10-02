// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/
const _ = require('lodash');
const swagger = require('../lib/swagger.json');
const lpm_file = require('./lpm_file.js');
const pkg = require('../package.json');
const string = require('./string.js');
const date = require('./date.js');
const qw = string.qw;

const prop_by_type = (props, type)=>
    Object.keys(props).filter(k=>props[k].type==type);

const conf = {
    version: pkg.version,
    is_win: process.platform=='win32',
    work_dir: lpm_file.work_dir,
    is_electron: process.versions && !!process.versions.electron,
    proxy_fields: Object.assign({}, swagger.definitions.proxy.properties,
        swagger.definitions.manager.properties),
    mgr_fields: Object.keys(swagger.definitions.manager.properties),
    numeric_fields: prop_by_type(swagger.definitions.proxy.properties,
        'integer'),
    boolean_fields: prop_by_type(swagger.definitions.proxy.properties,
        'boolean'),
    credential_fields: qw`customer zone password token token_auth`,
    default_superproxy_domain: 'zproxy.lum-superproxy.io',
    hola_agent: 'proxy='+pkg.version+' node='+process.version
        +' platform='+process.platform,
};
conf.default_fields = [].concat(conf.credential_fields, conf.mgr_fields,
    'version');
conf.first_actions = lpm_file.get_file_path(
    '.first_actions.json'.substr(conf.is_win ? 1 : 0));
conf.proxy_params = Object.keys(swagger.definitions.proxy.properties);
conf.server_default = {
    port: 24000,
    zone: 'static',
    customer: process.env.LUMINATI_CUSTOMER,
    password: process.env.LUMINATI_PASSWORD,
    sticky_ip: false,
    insecure: false,
    proxy_connection_type: 'http',
    short_username: false,
    ssl: false,
    test_url: 'http://lumtest.com/myip.json',
    proxy: conf.default_superproxy_domain,
    proxy_port: 22225,
    socks_proxy_port: 22228,
    proxy_retry: 2,
    socket_inactivity_timeout: 120*date.ms.SEC,
    preset: 'session_long',
    multiply_ips: false,
    multiply_vips: false,
    multiply: 0,
    max_requests: 0,
    session_duration: 0,
    session: true,
    override_headers: true,
};
conf.manager_default = Object
.assign({}, _.omit(conf.server_default, 'port'), {
    api: 'https://'+pkg.api_domain,
    www: 22999,
    www_whitelist_ips: [],
    whitelist_ips: [],
    ws: 22998,
    dropin: true,
    dropin_port: 22225,
    no_usage_stats: false,
    request_stats: true,
    log: 'notice',
    logs: 1000,
    reverse_lookup_dns: false,
    force: false,
    session_termination: false,
    config: lpm_file.get_file_path(
        '.luminati.json'.substr(conf.is_win ? 1 : 0)),
    loki: lpm_file.get_file_path(
        '.luminati.db'.substr(conf.is_win ? 1 : 0)),
    cookie: lpm_file.get_file_path(
        '.luminati.jar'.substr(conf.is_win ? 1 : 0)),
    high_perf: false,
    local_login: false,
    cluster: 1,
});

Object.assign(module.exports, conf);
