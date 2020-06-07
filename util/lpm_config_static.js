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
    'version', 'ask_sync_config');
conf.first_actions = '~/luminati_proxy_manager/.first_actions.json';
conf.proxy_params = Object.keys(swagger.definitions.proxy.properties);
conf.server_default = {
    debug: 'full',
    port: 24000,
    zone: 'static',
    customer: process.env.LUMINATI_CUSTOMER,
    password: process.env.LUMINATI_PASSWORD,
    sticky_ip: false,
    insecure: false,
    proxy_connection_type: 'http',
    ssl: false,
    test_url: 'http://lumtest.com/myip.json',
    proxy: 'zproxy.lum-superproxy.io',
    proxy_port: 22225,
    proxy_retry: 2,
    socket_inactivity_timeout: 120000,
    preset: 'session_long',
    route_err: 'pass_dyn',
    multiply_ips: false,
    max_ban_retries: 10,
    multiply_vips: false,
    multiply_users: false,
    multiply: 0,
    rotate_session: false,
    session: true,
    override_headers: true,
    bw_limit: 0,
    log: 'notice',
};
conf.manager_default = Object.assign({}, _.omit(conf.server_default, 'port'), {
    www: 22999,
    www_whitelist_ips: [],
    whitelist_ips: [],
    extra_ssl_ips: [],
    dropin: true,
    dropin_port: 22225,
    no_usage_stats: false,
    request_stats: true,
    logs: 1000,
    har_limit: 1024,
    reverse_lookup_dns: false,
    force: false,
    session_termination: false,
    high_perf: false,
    local_login: false,
    cluster: true,
    read_only: false,
    cloud: true,
    zagent: false,
    sync_config: false,
    sync_zones: true,
    sync_stats: true,
});
conf.log_levels = {
    error: 0,
    warn: 1,
    notice: 2,
    info: 3,
    debug: 4,
};

Object.assign(module.exports, conf);
