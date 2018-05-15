// LICENSE_CODE ZON ISC
'use strict'; /*jslint browser:true, es6:true*/

export const bytes_format = (bytes, precision)=>{
    if (!bytes||isNaN(parseFloat(bytes))||!isFinite(bytes))
        return '';
    let number = Math.floor(Math.log(bytes)/Math.log(1000));
    if (typeof precision==='undefined')
        precision = number ? 2 : 0;
    let number_format = Intl.NumberFormat('en-US',
        {maximumFractionDigits: precision});
    return number_format.format(bytes/Math.pow(1000, Math.floor(number)))+' '
        +['B', 'KB', 'MB', 'GB', 'TB', 'PB'][number];
};

export const ga_event = (category, action, label)=>{
    if (!window.ga)
        return;
    window.ga('send', 'event', category, action, label);
};

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

export const get_static_country = proxy=>{
    if (!proxy||!proxy.zone||!proxy.zones)
        return false;
    const zone = proxy.zones[proxy.zone];
    if (!zone)
        return false;
    const plan = zone.plans[zone.plans.length-1];
    if (plan.type=='static')
        return plan.country||'any';
    if (['domain', 'domain_p'].includes(plan.vips_type))
        return plan.vip_country||'any';
    return false;
};

const presets = {
    sequential: {
        default: true,
        title: 'Sequential session IP pool',
        subtitle: `Sequential pool of pre-established of sessions (IPs). For
            running groups of requests sharing the same IP to a target site.
            Use refresh_sessions max_requests & session_duration to control
            session (IP) switching`,
        check: function(opt){ return opt.pool_size &&
            (!opt.pool_type || opt.pool_type=='sequential'); },
        set: opt=>{
            opt.pool_size = 1;
            opt.pool_type = 'sequential';
            opt.keep_alive = opt.keep_alive||45;
            opt.sticky_ip = null;
            opt.session = '';
        },
        clean: opt=>{
            opt.pool_size = 0;
            opt.keep_alive = 0;
            opt.max_requests = 0;
            opt.session_duration = 0;
            opt.seed = '';
        },
        rules: [
            {field: 'pool_size', label: `sets 'Pool size' to 1`},
            {field: 'pool_type', label: `sequential pool type`},
            {field: 'keep_alive', label: `sets Keep-alive to 45 seconds`},
            {field: 'sticky_ip', label: `disables 'Sticky Ip'`},
            {field: 'session', label: `disables 'Random Session'`},
        ],
        support: {
            keep_alive: true,
            max_requests: true,
            session_duration: true,
            multiply: true,
            seed: true,
        },
    },
    session_long: {
        title: 'Long single session (IP)',
        subtitle: `All requests share the same long session (IP). For
            connecting a browser to Luminati, maintaining the same IP for as
            long as possible`,
        check: function(opt){ return !opt.pool_size && !opt.sticky_ipo
            && opt.session===true && opt.keep_alive; },
        set: opt=>{
            opt.pool_size = 0;
            opt.keep_alive = opt.keep_alive||50;
            opt.pool_type = null;
            opt.sticky_ip = false;
            opt.session = true;
            opt.seed = false;
        },
        clean: opt=>{
            opt.keep_alive = 0;
            opt.session = '';
            opt.session_duration = 0;
            opt.max_requests = 0;
            opt.seed = '';
        },
        rules: [
            {field: 'pool_size', label: `sets 'Pool size' to 0`},
            {field: 'keep_alive', label: `sets 'Keep-alive' to 50 seconds`},
            {field: 'pool_type', label: `sequential pool type`},
            {field: 'sticky_ip', label: `disables 'Sticky Ip'`},
            {field: 'session', label: `enables 'Random Session'`},
            {field: 'seed', label: `disables 'Session ID Seed'`},
        ],
        support: {
            keep_alive: true,
            multiply: true,
            session_duration: true,
            max_requests: true,
        },
    },
    session: {
        title: 'Single session (IP)',
        subtitle: `All requests share the same active session (IP). For
            connecting a single app/browser that does not need to maintain IP
            on idle times`,
        check: function(opt){ return !opt.pool_size && !opt.sticky_ip
            && opt.session===true && !opt.keep_alive; },
        set: function(opt){
            opt.pool_size = 0;
            opt.keep_alive = 0;
            opt.pool_type = null;
            opt.sticky_ip = false;
            opt.session = true;
            opt.seed = false;
        },
        clean: opt=>{
            opt.session = '';
            opt.session_duration = 0;
            opt.max_requests = 0;
            opt.seed = '';
        },
        rules: [
            {field: 'pool_size', label: `sets 'Pool size' to 0`},
            {field: 'keep_alive', label: `sets 'Keep-alive' to 0 seconds`},
            {field: 'pool_type', label: `sequential pool type`},
            {field: 'sticky_ip', label: `disables 'Sticky Ip'`},
            {field: 'session', label: `enables 'Random Session'`},
            {field: 'seed', label: `disables 'Session ID Seed'`},
        ],
        support: {
            multiply: true,
            session_duration: true,
            max_requests: true,
        },
    },
    sticky_ip: {
        title: 'Session (IP) per machine',
        subtitle: `Each requesting machine will have its own session (IP).
            For connecting several computers to a single Luminati Proxy
            Manager, each of them having its own single session (IP)`,
        check: function(opt){ return !opt.pool_size && opt.sticky_ip; },
        set: function(opt){
            opt.pool_size = 0;
            opt.pool_type = null;
            opt.sticky_ip = true;
            opt.session = '';
        },
        clean: opt=>{
            opt.sticky_ip = null;
            opt.keep_alive = 0;
            opt.max_requests = 0;
            opt.session_duration = 0;
            opt.seed = '';
        },
        rules: [
            {field: 'pool_size', label: `sets 'Pool size' to 0`},
            {field: 'pool_type', label: `sequential pool type`},
            {field: 'sticky_ip', label: `enables 'Sticky Ip'`},
            {field: 'session', label: `disables 'Random Session'`},
            {field: 'multiply', label: `disables 'Multiply' option`},
        ],
        support: {
            keep_alive: true,
            max_requests: true,
            session_duration: true,
            seed: true,
        },
    },
    round_robin: {
        title: 'Round-robin (IP) pool',
        subtitle: `Round-robin pool of pre-established sessions (IPs). For
            spreading requests across large number of IPs. Tweak pool_size,
            max_requests & proxy_count to optimize performance`,
        check: function(opt){ return opt.pool_size
            && opt.pool_type=='round-robin' && !opt.multiply; },
        set: opt=>{
            opt.pool_size = opt.pool_size||1;
            opt.pool_type = 'round-robin';
            opt.keep_alive = opt.keep_alive||45;
            opt.sticky_ip = null;
            opt.session = '';
        },
        clean: opt=>{
            opt.pool_size = 1;
            opt.keep_alive = 0;
            opt.max_requests = 0;
            opt.session_duration = 0;
            opt.seed = '';
        },
        rules: [
            {field: 'pool_size', label: `sets 'Pool size' to 1`},
            {field: 'pool_type', label: `round-robin pool type`},
            {field: 'keep_alive', label: `sets Keep-alive to 45 seconds`},
            {field: 'sticky_ip', label: `disables 'Sticky Ip'`},
            {field: 'session', label: `disables 'Random Session'`},
            {field: 'multiply', label: `disables 'Multiply' options`},
        ],
        support: {
            pool_size: true,
            keep_alive: true,
            max_requests: true,
            session_duration: true,
            seed: true,
        },
    },
    high_performance: {
        title: 'High performance',
        subtitle: 'Maximum request speed',
        check: opt=>true,
        set: opt=>{
            opt.pool_size = 50;
            opt.keep_alive = 40;
            opt.pool_type = 'round-robin';
            opt.seed = false;
            opt.proxy_count = 20;
            opt.session_duration = 0;
            opt.session_random = false;
            opt.use_proxy_cache = false;
            opt.race_reqs = 2;
        },
        clean: opt=>{
            opt.pool_size = 1;
            opt.keep_alive = 0;
            opt.proxy_count = '';
            opt.race_reqs = '';
            opt.use_proxy_cache = true;
        },
        rules: [
            {field: 'pool_size', label: "sets 'Pool size' to 50"},
            {field: 'keep_alive', label: "sets 'Keep-alive' to 40"},
            {field: 'pool_type', label: "round-robin pool type"},
            {field: 'seed', label: "disables 'Session ID Seed'"},
        ],
        support: {max_requests: true, multiply: true},
    },
    rnd_usr_agent_and_cookie_header: {
        title: 'Random User-Agent and cookie headers',
        subtitle: 'Rotate User-Agent and cookie on each request',
        check: opt=>true,
        set: opt=>{
            opt.session = '';
            opt.sticky_ip = false;
            opt.pool_size = 1;
            opt.pool_type = 'sequential';
            opt.keep_alive = 0;
            opt.session_duration = 0;
            opt.seed = false;
            opt.rules = opt.rules||{};
            opt.rules.pre = [{
                alphabet: 'wertyuiop;lkjhgfdQWERTYUJBVCF5467',
                header: true,
                name: 'cookie',
                prefix: 'v=',
                random: 'string',
                size: 8,
                suffix: 'end of cookie',
                url: '**'
            },
            {
                arg: [
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebkit/537.36 (KHTML, like Gecko) Chrome/42.0.2311.135 Safari/537.36 Edge/12.246',
                'Mozilla/5.0 (X11; CrOS x86_64 8172.45.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/51.0.2704.64 Safari/537.36',
                'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_2) AppleWebKit/601.3.9 (KHTML, like Gecko) Version/9.0.2 Safari/601.3.9',
                'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/47.0.2526.111 Safari/537.36',
                'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:15.0) Gecko/20100101 Firefox/15.0.1',
                'Mozilla/5.0 (X11; Linux x86_64; rv:2.0b4) Gecko/20100818 Firefox/4.0b4',
                'Mozilla/5.0 (Windows NT 6.1; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/62.0.3202.62 Safari/537.36',
                'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_10_2) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/40.0.2214.38 Safari/537.36',
                'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/51.0.2704.103 Safari/537.36',
                'Mozilla/5.0 (Windows NT 10.0; WOW64; Trident/7.0; rv:11.0) like Gecko'],
                header: true,
                name: 'User-Agent',
                random: 'list',
                url: '**'
            }];
            opt.rules.post = opt.rules.post||[];
        },
        clean: opt=>{ },
        support: {
            multiply: true,
            max_requests: true,
        },
    },
    custom: {
        title: 'Custom',
        subtitle: `Manually adjust all settings to your needs For advanced
            use cases`,
        check: function(opt){ return true; },
        set: function(opt){},
        clean: opt=>{
            opt.session = '';
            opt.sticky_ip = null;
            opt.pool_size = 1;
            opt.pool_type = null;
            opt.keep_alive = 0;
            opt.max_requests = 0;
            opt.session_duration = 0;
            opt.seed = '';
        },
        support: {
            session: true,
            sticky_ip: true,
            pool_size: true,
            pool_type: true,
            keep_alive: true,
            max_requests: true,
            session_duration: true,
            multiply: true,
            seed: true,
        },
    },
};
for (let k in presets)
    presets[k].key = k;
export {presets};
