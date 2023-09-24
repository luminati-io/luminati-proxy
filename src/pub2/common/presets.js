// LICENSE_CODE ZON ISC
'use strict'; /*jslint browser:true, es6:true*/

const presets = {
    session_long: {
        title: 'Long single session (IP)',
        new_title: 'Browser (Puppeteer/Selenium)',
        subtitle: `Select to use the Browser preset if you need full page
            loads. You can connect directly from your browser or through
            programs like Puppeteer/Selenium. All requests share the same IP.
            Control IP refreshing from the UI or API.`,
        set: opt=>null,
        clean: opt=>null,
        disabled: {
            pool_size: true,
            session: true,
            rotate_session: true,
        },
    },
    rotating: {
        title: 'Rotating (IPs)',
        new_title: 'Scraper (Code/Fetching single resources)',
        subtitle: `Use the Scraper preset for a new IP with each single
            request. This preset also automatically rotates the User-Agent
            header. Best for scraping API without loading full pages.`,
        set: (opt, old_opt, is_new)=>{
            opt.session = '';
            opt.rotate_session = true;
            opt.sticky_ip = false;
            opt.headers = (old_opt||opt).headers||[];
            const rand_header = opt.headers.find(h=>
                h.name=='user-agent'&&h.value=='random_desktop');
            if (is_new && !rand_header)
            {
                opt.headers.push({name: 'user-agent',
                    value: 'random_desktop'});
            }
        },
        clean: opt=>{
            opt.rotate_session = false;
            opt.pool_size = 0;
            opt.headers = [];
        },
        disabled: {
            sticky_ip: true,
            session: true,
            rotate_session: true,
        },
    },
    unblocker: {
        title: 'Automatic (Unblocker)',
        new_title: 'Automatic (Unblocker)',
        subtitle: 'Unblocker handles IP management automatically',
        set: opt=>{
            opt.rotate_session = true;
            opt.ssl = true;
        },
        clean: opt=>{
            opt.rotate_session = false;
            opt.ua = false;
        },
        disabled: {
            pool_size: true,
            rotate_session: true,
            sticky_ip: true,
            session: true,
            session_termination: true,
            headers: true,
            proxy: true,
            dns: true,
            reverse_lookup: true,
            smtp: true,
            ssl: true,
        },
        hidden: true,
    },
    custom: {
        title: 'Custom',
        subtitle: `Manually adjust all settings to your needs for advanced
            use cases`,
        set: function(opt){},
        clean: opt=>{
            opt.pool_size = 0;
            opt.rotate_session = false;
            opt.session = '';
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
        return Object.entries(presets).map(([p, o])=>{
            if (!is_unblocker && o.hidden)
                return null;
            const key = o.default ? `${o.title} (default)` : o.title;
            return {key, value: p};
        }).filter(Boolean);
    },
    get: key=>presets[key],
    get_default: ()=>presets[default_preset],
};

export default E;
