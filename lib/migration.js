#!/usr/bin/env node
// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/
const semver = require('semver');
const zerr = require('../util/zerr.js');
const pkg = require('../package.json');

const all_migrations = {
    '1.116.387': conf=>{
        conf.proxies = conf.proxies||[];
        const proxies = conf.proxies.map(p=>{
            p = Object.assign({}, p);
            if (p.socks)
                delete p.socks;
            ['null_response', 'bypass_proxy', 'direct_include']
            .forEach(option=>{
                const _option = option=='direct_include' ? 'direct' : option;
                if (p[option])
                {
                    p.rules = p.rules||{};
                    p.rules.pre = p.rules.pre||[];
                    p.rules.pre.push({trigger_type: 'url', url: p[option],
                        action: _option});
                    delete p[option];
                }
            });
            if (['session', 'sequential'].includes(p.last_preset_applied))
            {
                const opt = {session: 'session_long',
                    sequential: 'session_long'};
                p.last_preset_applied = opt[p.last_preset_applied];
            }
            if (p.session_duration)
                p.session_duration = +(''+p.session_duration).split(':')[0];
            return p;
        });
        return Object.assign({}, conf, {proxies});
    },
    '1.116.548': conf=>{
        conf.proxies = conf.proxies||[];
        const proxies = conf.proxies.map(p=>{
            const proxy = Object.assign({}, p);
            if (proxy.keep_alive)
                proxy.keep_alive = true;
            else
                delete proxy.keep_alive;
            return proxy;
        });
        return Object.assign({}, conf, {proxies});
    },
    '1.116.963': conf=>{
        const transform = r=>{
            if (!r.url)
                return r;
            if (typeof r.url=='string')
            {
                const url = r.url=='*'||r.url=='**' ? '' : r.url;
                let func;
                if (!url)
                    func = `function trigger(opt){\n  return true;\n}`;
                else
                {
                    func = `function trigger(opt){\n  `
                        +`return /${url}/.test(opt.url);\n}`;
                }
                return Object.assign({}, r, {url, trigger_code: func});
            }
            return Object.assign({}, r, {url: r.url.regexp,
                trigger_code: r.url.code});
        };
        conf.proxies = conf.proxies||[];
        const proxies = conf.proxies.map(p=>{
            p = Object.assign({}, p);
            if (!p.rules)
                return p;
            if (p.rules.post)
                p.rules.post = p.rules.post.map(transform);
            if (p.rules.pre)
                p.rules.pre = p.rules.pre.map(transform);
            return p;
        });
        return Object.assign({}, conf, {proxies});
    },
    '1.116.964': conf=>{
        conf.proxies = conf.proxies||[];
        const proxies = conf.proxies.map(p=>{
            p = Object.assign({}, p);
            if (!p.rules || !p.rules.post)
                return p;
            p.rules.post = p.rules.post.map(rule=>{
                if (!rule.res)
                    return rule;
                rule = Object.assign({}, rule, rule.res[0]);
                delete rule.res;
                return rule;
            });
            return p;
        });
        return Object.assign({}, conf, {proxies});
    },
};

const migrate = (conf, migrations=all_migrations)=>{
    conf = Object.assign({_defaults: {}, proxies: []}, conf);
    const version = conf._defaults.version||'0.0.0';
    for (let v in migrations)
    {
        if (semver.lt(v, version))
            continue;
        zerr.notice(`Migrating config file ${v}`);
        conf = migrations[v](conf);
    }
    conf._defaults.version = pkg.version;
    return conf;
};

const E = module.exports = migrate;
E.migrations = all_migrations;
