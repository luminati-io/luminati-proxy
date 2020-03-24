// LICENSE_CODE ZON ISC
'use strict'; /*jslint browser:true, es6:true*/

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
            pool_size: true,
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
    unblocker: {
        title: 'Automatic (Unblocker)',
        subtitle: 'Unblocker handles IP management automatically',
        set: opt=>{
            opt.session = '';
            opt.max_requests = 1;
            opt.insecure = true;
        },
        clean: opt=>{
            opt.max_requests = 0;
            opt.insecure = false;
        },
        disabled: {
            pool_size: true,
            max_requests: true,
            sticky_ip: true,
            session_duration: true,
            session: true,
            session_termination: true,
            headers: true,
            rules: true,
            proxy: true,
            dns: true,
            reverse_lookup: true,
            insecure: true,
            smtp: true,
            trigger_type: true,
            user_agent: true,
            override_headers: true,
        },
        hidden: true,
    },
    long_availability: {
        title: 'Long availability',
        subtitle: `Creates a pool of IPs and always uses the most stable IP
            from the pool`,
        set: opt=>{
            if (!opt.pool_size || opt.pool_size==1)
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
            max_requests: true,
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
            opt.max_requests = 0;
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
            max_requests: true,
        },
    },
    rnd_usr_agent_and_cookie_header: {
        title: 'Random User-Agent',
        subtitle: 'Rotate User-Agent on each request',
        set: opt=>{
            opt.session_duration = 0;
            opt.user_agent = 'random_desktop';
            opt.session = '';
            opt.ssl = true;
            opt.override_headers = true;
        },
        clean: opt=>{
            opt.pool_size = 0;
            opt.user_agent = '';
        },
        disabled: {
            user_agent: 'random_desktop',
            sticky_ip: true,
            session: true,
            override_headers: true,
        },
        rules: [
            {field: 'user_agent',
                label: 'Generates random User-Agent for each request'},
            {field: 'ssl', label: `Enables SSL analyzing`},
        ],
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
export default presets;
