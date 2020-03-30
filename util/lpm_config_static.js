// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/
const _ = require('lodash');
const swagger = require('../lib/swagger.json');

const prop_by_type = (props, type)=>
    Object.keys(props).filter(k=>props[k].type==type);

const conf = {
    version: undefined,
    is_win: process.platform=='win32',
    is_lum: undefined,
    daemon_name: 'luminati_proxy_manager',
    work_dir: '',
    is_electron: process.versions && !!process.versions.electron,
    proxy_fields: Object.assign({}, swagger.definitions.proxy.properties,
        swagger.definitions.manager.properties),
    mgr_fields: Object.keys(swagger.definitions.manager.properties),
    numeric_fields: prop_by_type(swagger.definitions.proxy.properties,
        'integer'),
    boolean_fields: prop_by_type(swagger.definitions.proxy.properties,
        'boolean'),
    credential_fields: ['customer', 'zone', 'password', 'token_auth',
        'lpm_token'],
    default_superproxy_domain: 'zproxy.lum-superproxy.io',
    hola_agent: undefined,
    args: {
        added_descriptions: {
            'no-www': 'Disable local web',
            'no-config': 'Working without a config file',
            'no-cookie': 'Working without a cookie file',
            daemon: 'Start as a daemon',
            'restart-daemon': 'Restart running daemon',
            'stop-daemon': 'Stop running daemon',
            'delete-daemon': 'Delete daemon instance',
            upgrade: 'Upgrade proxy manager',
            downgrade: 'Downgrade proxy manager (if backup exists on disk)',
            dir: 'Path to the directory with database and configuration files',
            status: 'Show proxy manager processes current status',
            'gen-cert': 'Generate cert',
            'auto-upgrade': 'Enable auto upgrade',
            'start-upgrader': 'Install CRON process that checks upgrades',
            'stop-upgrader': 'Removes CRON process that checks upgrades',
        },
        alias: {
            help: ['h', '?'],
            port: 'p',
            daemon: ['d', 'start-daemon'],
            version: 'v',
        },
    },
};
conf.default_fields = [].concat(conf.credential_fields, conf.mgr_fields,
    'version');
conf.first_actions = '~/luminati_proxy_manager/.first_actions.json';
conf.proxy_params = Object.keys(swagger.definitions.proxy.properties);
conf.server_default = {
    port: 24000,
    zone: 'static',
    customer: process.env.LUMINATI_CUSTOMER,
    password: process.env.LUMINATI_PASSWORD,
    sticky_ip: false,
    insecure: false,
    proxy_connection_type: 'http',
    ssl: false,
    test_url: 'http://lumtest.com/myip.json',
    proxy: conf.default_superproxy_domain,
    proxy_port: 22225,
    proxy_retry: 2,
    socket_inactivity_timeout: 120000,
    preset: 'session_long',
    multiply_ips: false,
    max_ban_retries: 10,
    multiply_vips: false,
    multiply_users: false,
    multiply: 0,
    max_requests: 0,
    session_duration: 0,
    session: true,
    override_headers: true,
    bw_limit: 0,
    log: 'notice',
    har_limit: 1024,
};
conf.manager_default = Object.assign({}, _.omit(conf.server_default, 'port'), {
    api_domain: undefined,
    // XXX krzysztof: get rid of api and leave only api_domain
    api: undefined,
    www: 22999,
    www_whitelist_ips: [],
    whitelist_ips: [],
    dropin: true,
    dropin_port: 22225,
    no_usage_stats: false,
    request_stats: true,
    logs: 1000,
    reverse_lookup_dns: false,
    force: false,
    session_termination: false,
    config: '~/luminati_proxy_manager/.luminati.json',
    loki: '~/luminati_proxy_manager/.luminati.db',
    cookie: '~/luminati_proxy_manager/.luminati.jar',
    high_perf: false,
    local_login: false,
    cluster: true,
    read_only: false,
    cloud: true,
});
conf.log_levels = {
    error: 0,
    warn: 1,
    notice: 2,
    info: 3,
    debug: 4,
};

Object.assign(module.exports, conf);
