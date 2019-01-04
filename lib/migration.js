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
    '1.117.683': conf=>{
        const add_type = t=>rule=>{
            let type = '';
            if (rule.body || rule.action_type=='process')
                type = 'after_body';
            else if (rule.min_req_time)
                type = 'timeout';
            else if (t=='pre')
                type = 'before_send';
            else if (rule.status || rule.max_req_time)
                type = 'after_hdr';
            return Object.assign({}, rule, {type});
        };
        conf.proxies = conf.proxies||[];
        const proxies = conf.proxies.map(p=>{
            p = Object.assign({}, p);
            if (!p.rules)
                return p;
            if (p.rules.post)
                p.rules.post = p.rules.post.map(add_type('post'));
            if (p.rules.pre)
                p.rules.pre = p.rules.pre.map(add_type('pre'));
            return p;
        });
        return Object.assign({}, conf, {proxies});
    },
    '1.117.684': conf=>{
        const reduce_cmp = t=>rule=>{
            if (rule.status && rule.status.arg)
                rule.status = +rule.status.arg.match(/\d+/)[0];
            else if (typeof rule.status=='string')
                rule.status = +rule.status;
            if (rule.body && rule.body.arg)
                rule.body = rule.body.arg;
            return rule;
        };
        conf.proxies = conf.proxies||[];
        const proxies = conf.proxies.map(p=>{
            p = Object.assign({}, p);
            if (!p.rules)
                return p;
            if (p.rules.post)
                p.rules.post = p.rules.post.map(reduce_cmp('post'));
            if (p.rules.pre)
                p.rules.pre = p.rules.pre.map(reduce_cmp('pre'));
            return p;
        });
        return Object.assign({}, conf, {proxies});
    },
    'x.rules_trigger': conf=>{
        conf.proxies = conf.proxies||[];
        const proxies = conf.proxies.map(p=>{
            p = Object.assign({}, p);
            if (!p.rules)
                return p;
            if (p.rules.post)
                p.rules.post = p.rules.post.map(migrate_rule('post'));
            if (p.rules.pre)
                p.rules.pre = p.rules.pre.map(migrate_rule('pre'));
            return p;
        });
        return Object.assign({}, conf, {proxies});
    },
};

const gen_function = body=>{
    body = body.split('\n').map(l=>'  '+l).join('\n');
    return `function trigger(opt){\n${body}\n}`;
};

const migrate_rule = t=>rule=>{
    let body = '';
    let type;
    if (t=='pre')
        type = 'before_send';
    else if (t=='post' && rule.status)
    {
        const m = rule.status.arg.match(/\d+/);
        const status_code = m && m[0] || 200;
        body += `if (opt.status_code!=${status_code})\n`
        +`  return false;\n`;
        type = 'after_hdr';
    }
    else if (t=='post' && rule.max_req_time)
    {
        body += `if (opt.time_passed>${rule.max_req_time})\n`
        +`  return false;\n`;
        type = 'after_hdr';
    }
    else if (t=='post' && rule.body)
    {
        body += `if (!/${rule.body.arg}/.test(opt.body))\n`
        +`  return false;\n`;
        type = 'after_body';
    }
    if (rule.url)
    {
        body += `if (!/${rule.url}/.test(opt.url))\n`
        +`  return false;\n`;
    }
    body += `return true;`;
    return Object.assign({}, rule, {type, trigger_code: gen_function(body)});
};

const migrate = (conf, migrations=all_migrations)=>{
    conf = Object.assign({_defaults: {}, proxies: []}, conf);
    const version = conf._defaults.version||'0.0.0';
    for (let v in migrations)
    {
        if (v.startsWith('x') || semver.lt(v, version))
            continue;
        zerr.notice(`Migrating config file ${v}`);
        try { conf = migrations[v](conf); }
        catch(e){
            zerr.warn(`Could not migrate config file from version ${v}`);
        }
    }
    conf._defaults.version = pkg.version;
    return conf;
};

const E = module.exports = migrate;
E.migrations = all_migrations;
E.migrate_rule = migrate_rule;
