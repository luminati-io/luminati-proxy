// LICENSE_CODE ZON ISC
'use strict'; /*jslint browser:true, es6:true*/

import user_agent_gen from '/www/util/pub/user_agent_gen.js';

export const bytes_format = (bytes, number)=>{
    if (!bytes||isNaN(parseFloat(bytes))||!isFinite(bytes))
        return '';
    number = number!=undefined ?
        number : Math.floor(Math.log(bytes)/Math.log(1000));
    const precision = number ? 2 : 0;
    let n = (bytes/Math.pow(1000, Math.floor(number))).toFixed(precision);
    if (+n===0)
        n = 0;
    return n+' '+['B', 'KB', 'MB', 'GB', 'TB', 'PB'][number];
};

export const ga_event = (category, action, label)=>{
    if (!window.ga)
        return;
    window.ga('send', 'event', category, action, label);
};

const formatted_user_agents = user_agent_gen.map(u=>({
    key: u.name,
    value: u.value,
}));

export const user_agents = [
    {key: 'None', value: ''},
    {key: 'Random (desktop)', value: 'random_desktop'},
    {key: 'Random (mobile)', value: 'random_mobile'},
    ...formatted_user_agents];

export const status_codes = {
    200: 'OK',
    201: 'Created',
    202: 'Accepted',
    203: 'Non-Authoritative Information',
    204: 'No Content',
    205: 'Reset Content',
    206: 'Partial Content',
    300: 'Multiple Choices',
    301: 'Moved Permanently',
    302: 'Found',
    303: 'See Other',
    304: 'Not Modified',
    305: 'Use Proxy',
    307: 'Temporary Redirect',
    400: 'Bad Request',
    401: 'Unauthorized',
    402: 'Payment Required',
    403: 'Forbidden',
    404: 'Not Found',
    405: 'Method Not Allowed',
    406: 'Not Acceptable',
    407: 'Proxy Authentication Required',
    408: 'Request Timeout',
    409: 'Conflict',
    410: 'Gone',
    411: 'Length Required',
    412: 'Precondition Failed',
    413: 'Request Entity Too Large',
    414: 'Request-URI Too Long',
    415: 'Unsupported Media Type',
    416: 'Requested Range Not Satisfiable',
    417: 'Expectation Failed',
    500: 'Internal Server Error',
    501: 'Not Implemented',
    502: 'Bad Gateway',
    503: 'Service Unavailable',
    504: 'Gateway Timeout',
    505: 'HTTP Version Not Supported',
};

export const get_static_country = (proxy, zones)=>{
    if (!proxy||!proxy.zone||!zones||!zones.zones)
        return false;
    const zone = zones.zones.find(z=>z.name==proxy.zone);
    if (!zone)
        return false;
    if (!zone.plan)
        return false;
    if (zone.plan.type=='static')
        return zone.plan.country||'any';
    if (['domain', 'domain_p'].includes(zone.plan.vips_type))
        return zone.plan.vip_country||'any';
    return false;
};

const presets = {
    session_long: {
        default: true,
        title: 'Long single session (IP)',
        subtitle: `All requests share the same long session (IP). For
            connecting a browser to Luminati, maintaining the same IP for as
            long as possible`,
        set: opt=>{
            opt.pool_size = 1;
            opt.session = '';
        },
        clean: opt=>{
            opt.pool_size = 0;
        },
        rules: [
            {field: 'pool_size', label: `Sets 'Pool size' to 1`},
        ],
        disabled: {
            sticky_ip: true,
            session: true,
            max_requests: true,
            session_duration: true,
        },
    },
    rotating: {
        title: 'Rotating (IPs)',
        subtitle: 'For changing the IP on each request',
        set: opt=>{
            opt.session = '';
            if (!opt.session_duration)
                opt.max_requests = opt.max_requests||1;
        },
        clean: opt=>{
            opt.max_requests = 0;
            opt.session_duration = 0;
            opt.pool_size = 0;
        },
        rules: [
            {field: 'max_requests', label: `Sets 'Max requests' to 1. It makes
                sense to choose any other positive number`},
        ],
        disabled: {
            sticky_ip: true,
            session: true,
        },
    },
    long_availability: {
        title: 'Long availability',
        subtitle: `Creates a pool of IPs and always uses the most stable IP
            from the pool`,
        set: opt=>{
            opt.pool_size = 20;
            opt.session = '';
        },
        clean: opt=>{
            opt.pool_size = 0;
        },
        rules: [
            {field: 'pool_size', label: `Sets 'Pool size' to 20`},
        ],
        disabled: {
            sticky_ip: true,
            session: true,
            session_duration: true,
        },
    },
    sticky_ip: {
        title: 'Session (IP) per machine',
        subtitle: `Each requesting machine will have its own session (IP).
            For connecting several computers to a single Luminati Proxy
            Manager, each of them having its own single session (IP)`,
        set: function(opt){
            opt.pool_size = 0;
            opt.sticky_ip = true;
        },
        clean: opt=>{
            opt.max_requests = 0;
            opt.session_duration = 0;
            opt.sticky_ip = false;
        },
        rules: [
            {field: 'pool_size', label: `Sets 'Pool size' to 0`},
            {field: 'sticky_ip', label: `Enables 'Sticky Ip'`},
            {field: 'multiply', label: `Disables 'Multiply' options`},
        ],
        disabled: {
            multiply: true,
            multiply_ips: true,
            multiply_vips: true,
            sticky_ip: true,
            session: true,
            session_duration: true,
            pool_size: true,
        },
    },
    rnd_usr_agent_and_cookie_header: {
        title: 'Random User-Agent',
        subtitle: 'Rotate User-Agent on each request',
        set: opt=>{
            opt.session_duration = 0;
            opt.user_agent = 'random_desktop';
            opt.session = '';
            opt.random_user_agent = true;
            opt.override_headers = true;
        },
        clean: opt=>{
            opt.pool_size = 0;
            opt.user_agent = '';
            opt.override_headers = false;
        },
        disabled: {
            user_agent: 'random_desktop',
            sticky_ip: true,
            session: true,
            override_headers: true,
        },
    },
    shop: {
        title: 'Online shopping',
        subtitle: `Scrape data from shopping websites. This preset is
            configured for product pages but can be freely modified for any
            other use-cases`,
        set: opt=>{
            opt.session = '';
            opt.dns = 'remote';
            opt.user_agent = 'random_desktop';
            opt.override_headers = true;
            opt.ssl = true;
            opt.rules = opt.rules||[];
            if (opt.rules.find(r=>r.action && r.action.process))
                return;
            opt.rules.push({
                action: {
                    process: {
                        title: `$('#productTitle').text()`,
                        price: `$('#priceblock_ourprice').text().trim()`,
                        bullets: `$('#featurebullets_feature_div li span')`
                            +`.map(function(){ return $(this).text() })`
                            +`.get()`,
                    },
                },
                action_type: 'process',
                trigger_type: 'url',
                url: 'luminati.io|dp\\/[A-Z0-9]{10}',
            });
        },
        clean: opt=>{
            opt.dns = '';
            opt.user_agent = '';
            if (!opt.rules)
                return;
            opt.rules = opt.rules.filter(r=>!r.action || !r.action.process);
        },
        disabled: {
            user_agent: 'random_desktop',
            sticky_ip: true,
            session: true,
            ssl: true,
        },
        rules: [
            {field: 'dns', label: `Sets DNS to resolve remotely`},
            {field: 'user_agent',
                label: 'Generates random User-Agent for each request'},
            {field: 'trigger_type', label: 'Creates an explanatory rule for '
                +'post-processing each request to scrape data you need'},
            {field: 'ssl', label: `Enables SSL analyzing`},
        ],
    },
    custom: {
        title: 'Custom',
        subtitle: `Manually adjust all settings to your needs for advanced
            use cases`,
        set: function(opt){},
        clean: opt=>{
            opt.pool_size = 0;
            opt.max_requests = 0;
            opt.session_duration = 0;
        },
    },
};
for (let k in presets)
{
    presets[k].key = k;
    presets[k].subtitle = presets[k].subtitle.replace(/\s+/g, ' ')
    .replace(/\n/g, ' ');
}
export {presets};

export const swagger_url = 'http://petstore.swagger.io/?url=https://'
+'raw.githubusercontent.com/luminati-io/luminati-proxy/master/lib/'
+'swagger.json#/Proxy';

export const swagger_link_tester_url = swagger_url
+'/get_proxies__port__link_test_json';
