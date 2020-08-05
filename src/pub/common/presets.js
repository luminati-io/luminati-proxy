// LICENSE_CODE ZON ISC
'use strict'; /*jslint browser:true, es6:true*/

const presets = {
    session_long: {
        title: 'Long single session (IP)',
        new_title: 'Browser (Puppeteer/Selenium)',
        subtitle: `Use this preset if you need full page loads. Connect from
            the browser manually (for example Chrome/Firefox) or
            programatically (for example Puppeteer/Selenium). All requests
            share the same IP. You can control when you refresh the IP from the
            UI or API.`,
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
        subtitle: `Use this preset if you want to get a fresh new IP on each
            single request. This preset also rotates the User-Agent header
            automatically. It's the best for scraping API when you don't load
            the full pages.`,
        set: (opt, old_opt)=>{
            opt.session = '';
            opt.rotate_session = true;
            opt.sticky_ip = false;
            opt.headers = (old_opt||opt).headers||[];
            opt.headers.push({name: 'user-agent', value: 'random_desktop'});
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
        },
        clean: opt=>{
            opt.rotate_session = false;
        },
        disabled: {
            pool_size: true,
            rotate_session: true,
            sticky_ip: true,
            session: true,
            session_termination: true,
            headers: true,
            rules: true,
            proxy: true,
            dns: true,
            reverse_lookup: true,
            smtp: true,
            trigger_type: true,
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
                key = `${key} (default)`;
            return {key, value: p};
        });
    },
    get: key=>presets[key],
    get_default: ()=>presets[default_preset],
};

export default E;
