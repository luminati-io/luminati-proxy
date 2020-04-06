// LICENSE_CODE ZON ISC
'use strict'; /*jslint browser:true, es6:true*/

const presets = {
    session_long: {
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
            session: true,
            rotate_session: true,
            session_duration: true,
        },
    },
    rotating: {
        title: 'Rotating (IPs)',
        subtitle: 'For changing the IP on each request',
        set: opt=>{
            opt.session = '';
            opt.rotate_session = true;
            opt.sticky_ip = false;
            opt.user_agent = 'random_desktop';
        },
        clean: opt=>{
            opt.rotate_session = false;
            opt.session_duration = 0;
            opt.pool_size = 0;
            opt.user_agent = '';
        },
        rules: [
            {field: 'rotate_session', label: 'Turns on session rotation'},
        ],
        disabled: {
            sticky_ip: true,
            session: true,
            rotate_session: true,
            user_agent: true,
        },
    },
    unblocker: {
        title: 'Automatic (Unblocker)',
        subtitle: 'Unblocker handles IP management automatically',
        set: opt=>{
            opt.session = '';
            opt.rotate_session = true;
            opt.insecure = true;
        },
        clean: opt=>{
            opt.rotate_session = false;
            opt.insecure = false;
        },
        disabled: {
            pool_size: true,
            rotate_session: true,
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
            opt.rotate_session = false;
            opt.session_duration = 0;
        },
    },
};
const default_preset = 'session_long';
presets[default_preset].default = true;
for (let k in presets)
{
    presets[k].key = k;
    presets[k].subtitle = presets[k].subtitle.replace(/\s+/g, ' ')
    .replace(/\n/g, ' ');
}

const E = {
    opts: is_unblocker=>{
        if (is_unblocker)
            return [{key: presets.unblocker.title, value: 'unblocker'}];
        return Object.keys(presets).filter(p=>!presets[p].hidden).map(p=>{
            let key = presets[p].title;
            if (presets[p].default)
                key = `Default (${key})`;
            return {key, value: p};
        });
    },
    get: key=>presets[key],
    get_default: ()=>presets[default_preset],
};

export default E;
