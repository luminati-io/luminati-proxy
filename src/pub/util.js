// LICENSE_CODE ZON ISC
'use strict'; /*jslint browser:true, es6:true*/
import {Netmask} from 'netmask';

export const bytes_format = (bytes, number)=>{
    if (!bytes||isNaN(parseFloat(bytes))||!isFinite(bytes))
        return '';
    number = number!=undefined ?
        number : Math.floor(Math.log(bytes)/Math.log(1000));
    const precision = number ? 2 : 0;
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

export const user_agents = [{
    key: 'None',
    value: '',
}, {
    key: 'Chrome 58 Windows 10',
    value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.36',
}, {
    key: 'Chrome 58 Windows 7',
    value: 'Mozilla/5.0 (Windows NT 6.1; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.36',
}, {
    key: 'Chrome 58 Android 4',
    value: 'Mozilla/5.0 (Linux; Android 4.1.1; Nexus 7 Build/JRO03D) AppleWebKit/535.19 (KHTML, like Gecko) Chrome/58.0.1025.166 Safari/535.19',
}, {
    key: 'Chrome 58 OSX 10.12.4',
    value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.36',
}, {
    key: 'Chrome 58 Linux',
    value: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.36',
}, {
    key: 'Chrome 56 iOS 10.3',
    value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 10_3 like Mac OS X) AppleWebKit/602.1.50 (KHTML, like Gecko) CriOS/56.0.2924.75 Mobile/14E5239e Safari/602.1',
}, {
    key: 'Chrome 52 Samsung Galaxy S6',
    value: 'Mozilla/5.0 (Linux; Android 6.0.1; SM-G920V Build/MMB29K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/52.0.2743.98 Mobile Safari/537.36',
}, {
    key: 'Chromium 58 Linux',
    value: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Ubuntu Chromium/58.0.3029.110 Chrome/58.0.3029.110 Safari/537.36',
}, {
    key: 'Opera 45 Windows 10',
    value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.81 Safari/537.36 OPR/45.0.2552.812',
}, {
    key: 'Firefox 53 Windows 10',
    value: 'Mozilla/5.0 (Windows NT 10.0; WOW64; rv:53.0) Gecko/20100101 Firefox/53.0',
}, {
    key: 'Firefox 53 Windows 7',
    value: 'Mozilla/5.0 (Windows NT 6.1; WOW64; rv:53.0) Gecko/20100101 Firefox/53.0',
}, {
    key: 'Firefox 53 OSX 10.12',
    value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.12; rv:53.0) Gecko/20100101 Firefox/53.0',
}, {
    key: 'Firefox 53 Linux',
    value: 'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:53.0) Gecko/20100101 Firefox/53.0',
}, {
    key: 'Firefox 41 Android 4.4',
    value: 'Mozilla/5.0 (Android 4.4; Mobile; rv:41.0) Gecko/41.0 Firefox/41.0',
}, {
    key: 'Safari 10.1 MacOSX 10.12.4',
    value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_4) AppleWebKit/603.1.30 (KHTML, like Gecko) Version/10.1 Safari/603.1.30',
}, {
    key: 'Safari Mobile 10.0 Android 4.4',
    value: 'Mozilla/5.0 (Linux; U; Android 4.4; en-gb; GT-P1000 Build/FROYO) AppleWebKit/533.1 (KHTML, like Gecko) Version/10.0 Mobile Safari/533.1',
}, {
    key: 'Safari Mobile 10.0 iOS 8',
    value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 8_0_2 like Mac OS X) AppleWebKit/600.1.4 (KHTML, like Gecko) Version/10.0 Mobile/12A366 Safari/600.1.4',
}, {
    key: 'IE 11.0 for Desktop Windows 10',
    value: 'Mozilla/5.0 (Windows NT 10.0; WOW64; Trident/7.0; rv:11.0) like Gecko',
}, {
    key: 'Edge 15.0 Windows 10',
    value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/52.0.2743.116 Safari/537.36 Edge/15.15063',
}, {
    key: 'Samsung Browser 3.3 Samsung Galaxy Tab A',
    value: 'Mozilla/5.0 (Linux; Android 5.0.2; SAMSUNG SM-T550 Build/LRX22G) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/3.3 Chrome/38.0.2125.102 Safari/537.36',
}];

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
            opt.keep_alive = 45;
            opt.session = true;
        },
        clean: opt=>{},
        rules: [
            {field: 'pool_size', label: `Sets 'Pool size' to 1`},
            {field: 'pool_type', label: `Sequential pool type`},
        ],
        disabled: {
            sticky_ip: true,
            session_random: true,
            session: true,
            pool_type: true,
            seed: true,
            keep_alive: true,
            pool_size: true,
            max_requests: true,
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
            opt.session = '';
            opt.keep_alive = 45;
        },
        clean: opt=>{
            opt.sticky_ip = '';
            opt.keep_alive = 0;
            opt.max_requests = 0;
            opt.session_duration = 0;
        },
        rules: [
            {field: 'pool_size', label: `Sets 'Pool size' to 0`},
            {field: 'pool_type', label: `Sequential pool type`},
            {field: 'sticky_ip', label: `Enables 'Sticky Ip'`},
            {field: 'multiply', label: `Disables 'Multiply' options`},
        ],
        disabled: {
            multiply: true,
            multiply_ips: true,
            multiply_vips: true,
            sticky_ip: true,
            session_random: true,
            session: true,
            pool_type: true,
            seed: true,
            pool_size: true,
            keep_alive: true,
        },
    },
    round_robin: {
        title: 'Round-robin (IP) pool',
        subtitle: `Round-robin pool of pre-established sessions (IPs). For
            spreading requests across large number of IPs. Tweak pool_size,
            max_requests & proxy_count to optimize performance`,
        set: opt=>{
            opt.pool_size = 0;
            opt.pool_type = 'round-robin';
            opt.keep_alive = 45;
            opt.session = true;
        },
        clean: opt=>{
            opt.pool_size = 1;
            opt.keep_alive = 0;
            opt.max_requests = 0;
            opt.session_duration = 0;
        },
        rules: [
            {field: 'pool_size', label: `Sets 'Pool size' to 1`},
            {field: 'pool_type', label: `Round-robin pool type`},
            {field: 'multiply', label: `Disables 'Multiply' options`},
        ],
        disabled: {
            sticky_ip: true,
            session_random: true,
            session: true,
            multiply: true,
            multiply_ips: true,
            multiply_vips: true,
            pool_type: true,
            seed: true,
            keep_alive: true,
        },
    },
    high_performance: {
        title: 'High performance',
        subtitle: 'Maximum request speed',
        set: opt=>{
            opt.pool_size = 50;
            opt.keep_alive = 45;
            opt.pool_type = 'round-robin';
            opt.proxy_count = 20;
            opt.session_duration = 0;
            opt.use_proxy_cache = false;
            opt.race_reqs = 2;
            opt.session = true;
        },
        clean: opt=>{
            opt.pool_size = 1;
            opt.keep_alive = 0;
            opt.proxy_count = '';
            opt.race_reqs = '';
            opt.use_proxy_cache = true;
        },
        disabled: {
            sticky_ip: true,
            session_random: true,
            session: true,
            pool_type: true,
            seed: true,
            keep_alive: true,
            pool_size: true,
        },
        rules: [
            {field: 'pool_size', label: `Sets 'Pool size' to 50`},
            {field: 'pool_type', label: `Round-robin pool type`},
        ],
    },
    rnd_usr_agent_and_cookie_header: {
        title: 'Random User-Agent and cookie headers',
        subtitle: 'Rotate User-Agent and cookie on each request',
        set: opt=>{
            opt.session = true;
            opt.pool_size = 1;
            opt.pool_type = 'sequential';
            opt.keep_alive = 0;
            opt.session_duration = 0;
            opt.random_user_agent = true;
            opt.override_headers = true;
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
                header: true,
                name: 'User-Agent',
                random: 'user-agent',
                url: '**'
            }];
            opt.rules.post = opt.rules.post||[];
        },
        clean: opt=>{
            opt.rules.pre = [];
            opt.random_user_agent = '';
            opt.override_headers = false;
        },
        disabled: {
            random_user_agent: true,
            sticky_ip: true,
            session_random: true,
            session: true,
            pool_type: true,
            seed: true,
            keep_alive: true,
            pool_size: true,
            override_headers: true,
        },
    },
    shop: {
        title: 'Online shopping',
        subtitle: `Scrape data from shopping websites. This preset is
            configured for product pages but can be freely modified for any
            other use-cases`,
        chceck: opt=>true,
        set: opt=>{
            opt.session = true;
            opt.dns = 'remote';
            opt.random_user_agent = true;
            opt.override_headers = true;
            opt.ssl = true;
            opt.rules = opt.rules||{};
            opt.rules.post = opt.rules.post||[];
            if (opt.rules.post.find(r=>
                r.res[0]&&r.res[0].action&&r.res[0].action.process))
            {
                return;
            }
            opt.rules.post.push({
                res: [{
                    action: {
                        process: {
                            title: `$('#productTitle').text()`,
                            price: `$('#price_inside_buybox').text().trim()`,
                            bullets: `$('#featurebullets_feature_div li span')`
                                +`.map(function(){ return $(this).text() })`
                                +`.get()`,
                        },
                    },
                    action_type: 'process',
                    head: true,
                    trigger_type: 'url'
                }],
                url: 'luminati.io|dp\\/[A-Z0-9]{10}',
            });
        },
        clean: opt=>{
            opt.dns = '';
            opt.random_user_agent = false;
            if (!opt.rules||!opt.rules.post)
                return;
            opt.rules.post = opt.rules.post.filter(r=>
                !r.res[0]||!r.res[0].action||!r.res[0].action.process);
        },
        disabled: {
            random_user_agent: true,
            sticky_ip: true,
            session_random: true,
            session: true,
            seed: true,
            ssl: true,
        },
        rules: [
            {field: 'dns', label: `Sets DNS to resolve remotely`},
            {field: 'random_user_agent', label: `Generates random User-Agent
                for each request`},
            {field: 'trigger_type', label: `Creates an explanatory rule for
                post-processing each request to scrape data you need`},
            {field: 'ssl', label: `Enables SSL analyzing`},
        ],
    },
    custom: {
        title: 'Custom',
        subtitle: `Manually adjust all settings to your needs for advanced
            use cases`,
        set: function(opt){},
        clean: opt=>{
            opt.session = '';
            opt.pool_size = 1;
            opt.pool_type = null;
            opt.keep_alive = 0;
            opt.max_requests = 0;
            opt.session_duration = 0;
            opt.seed = '';
        },
    },
};
for (let k in presets)
    presets[k].key = k;
export {presets};

export const swagger_url = 'http://petstore.swagger.io/?url=https://'
+'raw.githubusercontent.com/luminati-io/luminati-proxy/master/lib/'
+'swagger.json#/Proxy';

export const swagger_link_tester_url = swagger_url
+'/get_proxies__port__link_test_json';

// XXX krzysztof: merge with validators in proxy_edit
export const normalizers = {
    ips_list: val=>{
        val = val.replace(/\s/g, '');
        const ips = val.split(',');
        const res = [];
        ips.forEach(ip=>{
            try {
                const netmask = new Netmask(ip);
                let to_add = netmask.base;
                if (netmask.bitmask!=32)
                    to_add += '/'+netmask.bitmask;
                res.push(to_add);
            } catch(e){ console.log('incorrect ip format'); }
        });
        return res.join(',');
    },
};

