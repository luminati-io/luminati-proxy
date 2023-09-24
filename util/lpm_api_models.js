// LICENSE_CODE ZON
'use strict'; /*jslint node:true, react:true*/
let is_node = typeof module=='object' && module.exports;
let define;
if (is_node)
{
    try {
        define = require('./require_node.js').define(module, '..');
    } catch(e){
        define = require('../../util/require_node.js').define(module, '..');
    }
}
else
    define = self.define;
define([], ()=>{
const E = {};
E.proxy_fields = {
    port: {type: 'integer', desc: 'Port for the HTTP proxy'},
    proxy_type: {type: 'string', desc: 'Set to "persist" to save proxy into '
        +'the configuration file.', values: 'persist'},
    multiply: {type: 'integer', desc: 'Multiply the port definition given '
        +'number of times', value: 0},
    multiply_users: {type: 'boolean'},
    users: {type: 'array', desc: 'List of users. This option has to be used '
        +'along with "multiply_users"', params: {user: {type: 'string'}}},
    ssl: {type: 'boolean', desc: 'Enable SSL analyzing'},
    tls_lib: {type: 'string', desc: 'SSL library',
        values: 'open_ssl|flex_tls'},
    av_check: {type: 'boolean', desc: 'Enable antivirus check'},
    iface: {type: 'string', desc: 'Interface or IP to listen on'},
    customer: {type: 'string', desc: 'Customer name'},
    zone: {type: 'string', desc: 'Zone name'},
    password: {type: 'string', desc: 'Zone password'},
    proxy: {type: 'string', desc: 'Hostname or IP of super proxy'},
    proxy_port: {type: 'integer', desc: 'Super proxy port'},
    proxy_connection_type: {type: 'string', desc: 'Determines what kind of '
        +'connection will be used between Proxy Manager and Super Proxy',
        values: 'http|https|socks'},
    proxy_retry: {type: 'integer', desc: 'Automatically retry on super '
        +'proxy failure'},
    insecure: {type: 'boolean', desc: 'Enable SSL connection/analyzing '
        +'to insecure hosts'},
    country: {type: 'string', desc: 'Country'},
    state: {type: 'string', desc: 'State'},
    city: {type: 'string', desc: 'City'},
    zip: {type: 'string', desc: 'Zip code'},
    asn: {type: 'string', desc: 'ASN'},
    ip: {type: 'string', desc: 'Data Center IP'},
    vip: {type: 'integer', desc: 'gIP'},
    ext_proxies: {type: 'array', desc: 'A list of proxies from external '
        +'vendors. Format: [username:password@]ip[:port]',
        params: {proxy: {type: 'string'}}},
    ext_proxy_username: {type: 'string', desc: 'Default username for '
        +'external vendor ips'},
    ext_proxy_password: {type: 'string', desc: 'Default password for '
        +'external vendor ips'},
    ext_proxy_port: {type: 'integer', desc: 'Default port for external '
        +'vendor ips'},
    dns: {type: 'string', desc: 'DNS resolving', values: 'local|remote'},
    reverse_lookup_dns: {type: 'boolean', desc: 'Process reverse lookup '
        +'via DNS'},
    reverse_lookup_file: {type: 'string', desc: 'Process reverse lookup '
        +'via file'},
    reverse_lookup_values: {type: 'array', desc: 'Process reverse lookup '
        +'via value'},
    session: {type: 'string', desc: 'Session for all proxy requests',
        values: '^[^\\.\\-]*$'},
    sticky_ip: {type: 'boolean', desc: 'Use session per requesting host to '
        +'maintain IP per host'},
    pool_size: {type: 'integer'},
    rotate_session: {type: 'boolean', desc: 'Session pool size'},
    throttle: {type: 'integer', desc: 'Throttle requests above given number'},
    rules: {type: 'array', desc: 'Proxy request rules', values: '{...}'},
    route_err: {type: 'string', desc: 'Block or allow requests to be '
        +'automatically sent through super proxy on error'},
    smtp: {type: 'array'},
    override_headers: {type: 'boolean', values: '[string]'},
    os: {type: 'string', desc: 'Operating System of the Peer IP'},
    headers: {type: 'array', desc: 'Request headers',
        params: {name: {type: 'string'}, value: {type: 'string'}}},
    debug: {type: 'string', desc: 'Request debug info',
        values: 'full|none'},
    lpm_auth: {type: 'string', desc: 'x-lpm-authorization header'},
    const: {type: 'boolean'},
    socket_inactivity_timeout: {type: 'integer'},
    multiply_ips: {type: 'boolean'},
    multiply_vips: {type: 'boolean'},
    max_ban_retries: {type: 'integer'},
    preset: {type: 'string'},
    ua: {type: 'boolean', desc: 'Unblocker Mobile UA'},
    timezone: {type: 'string', desc: 'Timezone ID to be used by the browser'},
    resolution: {type: 'string', desc: 'Browser screen size'},
    webrtc: {type: 'string', desc: 'WebRTC plugin behavior in the browser'},
    bw_limit: {type: 'object', desc: 'BW limit params',
        params: {
            days: {type: 'integer'},
            bytes: {type: 'integer'},
            renewable: {type: 'boolean', desc: 'Renew limit of bytes each '
                +'period or use single period and stop usage once last day '
                +'of period is reached. Default is true'}
        }
    },
    follow_redirect: {type: 'boolean', desc: 'Auto redirect requests'},
};

E.manager_fields = {
    whitelist_ips: {type: 'array', desc: 'Default for all proxies whitelist '
        +'ip list for granting access to them'},
    www_whitelist_ips: {type: 'array', desc: 'Whitelist ip list for granting '
        +'access to browser admin UI'},
    www: {type: 'integer', desc: 'HTTP and WebSocket port used for browser '
        +'admin UI and request logs'},
    config: {type: 'string', desc: 'Config file containing proxy definitions'},
    mode: {type: 'string', desc: 'Defines a set of permissible operations '
        +'within the UI/API'},
    dropin: {type: 'boolean', desc: 'Create dropin mode proxy port (default: '
        +'22225)'},
    dropin_port: {type: 'integer', desc: 'Port for dropin mode'},
    no_usage_stats: {type: 'boolean', desc: 'Disable collection of usage '
        +'statistics'},
    lpm_token: {type: 'string', desc: 'An authorization token'},
    high_perf: {type: 'boolean'},
    zagent: {type: 'boolean'},
    reseller: {type: 'boolean'},
    cluster: {type: 'string'},
    sync_config: {type: 'boolean', desc: 'Synchronize Proxy Manager '
        +'configuration with the cloud'},
    sync_zones: {type: 'boolean'},
    sync_stats: {type: 'boolean'},
    request_stats: {type: 'boolean', desc: 'Enable requests statistics'},
    test_url: {type: 'string', desc: 'Url for testing proxy'},
    log: {type: 'string', desc: 'Log level'},
    logs: {type: 'number', desc: 'Number of request logs to store'},
    logs_settings: {type: 'object', desc: 'Settings for logs remote delivery'},
    har_limit: {type: 'number', desc: 'Number of bytes to store'},
    debug: {type: 'string', desc: 'Request debug info default value'},
    lpm_auth: {type: 'string', desc: 'x-lpm-authorization header'},
    ports_limit: {type: 'integer', desc: 'Limit the numer of open proxy ports '
        +'at the same time'},
    ui_ws: {type: 'boolean', desc: 'Enable live logs preview and other live '
        +'data communication on the UI'},
    force: {type: 'boolean', desc: 'Kill other instances of Proxy Manager if '
        +'there are any'},
    session_termination: {type: 'boolean', desc: 'Stop sending new requests '
        +'when the peer IP becomes unavailable and redirect to confimration '
        +'page before new IP is taken'},
    api: {type: 'string', desc: 'Alternative url to luminati API'},
    api_domain: {type: 'string', desc: 'Alternative domain url to luminati '
        +'API'},
    pmgr_domain: {type: 'string', desc: 'Alternative domain url to Proxy '
        +'Manager'},
    local_login: {type: 'boolean', desc: 'Requires each browser to '
        +'authenticate against Proxy Manager'},
    read_only: {type: 'boolean', desc: 'Avoid saving current config in the '
        +'config file'},
    extra_ssl_ips: {type: 'array', desc: 'List of IPs to add to SSL '
        +'certificate'},
    bw_limit_webhook_url: {type: 'string', desc: 'URL to send webhook '
        +'messages to when BW limit is reached'},
    bw_th_webhook_url: {type: 'string', desc: 'URL to send webhook messages '
        +'to when BW limit threshold is reached'},
    new_ui: {type: 'boolean', desc: 'Enable UiKit UI'},
};
return E; }); // eslint-disable-line
