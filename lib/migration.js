#!/usr/bin/env node
// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/
const semver = require('semver');
const {DAY, HOUR, MIN, SEC} = require('../util/date.js').ms;
const pkg = require('../package.json');
const logger = require('./logger.js');

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
    '1.118.284': conf=>{
        conf.proxies = conf.proxies||[];
        conf._defaults = conf._defaults||{};
        if (conf._defaults.logs && conf._defaults.logs.value)
            conf._defaults.logs = conf._defaults.logs.value;
        return conf;
    },
    '1.118.308': conf=>{
        const map_time = rule=>{
            const time_to_ms = t=>{
                const n = (''+t).match(/^(\d+)(ms|sec|min|hr|day)?$/);
                if (!n)
                    return 0;
                t = +n[1];
                switch (n[2])
                {
                case 'day': t *= DAY; break;
                case 'hr': t *= HOUR; break;
                case 'min': t *= MIN; break;
                case 'sec': t *= SEC; break;
                case 'ms': break;
                }
                return t;
            };
            if (rule.max_req_time)
                rule.max_req_time = time_to_ms(rule.max_req_time);
            if (rule.min_req_time)
                rule.min_req_time = time_to_ms(rule.min_req_time);
            if (rule.action && rule.action.ban_ip)
                rule.action.ban_ip = time_to_ms(rule.action.ban_ip);
            return rule;
        };
        conf.proxies = conf.proxies||[];
        const proxies = conf.proxies.map(p=>{
            p = Object.assign({}, p);
            if (!p.rules)
                return p;
            if (p.rules.post)
                p.rules.post = p.rules.post.map(map_time);
            if (p.rules.pre)
                p.rules.pre = p.rules.pre.map(map_time);
            return p;
        });
        return Object.assign({}, conf, {proxies});
    },
    '1.118.309': conf=>{
        const map_status = rule=>{
            if (rule.status_custom)
                delete rule.status_custom;
            if (rule.status)
                rule.status = ''+rule.status;
            return rule;
        };
        conf.proxies = conf.proxies||[];
        const proxies = conf.proxies.map(p=>{
            p = Object.assign({}, p);
            if (!p.rules)
                return p;
            if (p.rules.post)
                p.rules.post = p.rules.post.map(map_status);
            if (p.rules.pre)
                p.rules.pre = p.rules.pre.map(map_status);
            return p;
        });
        return Object.assign({}, conf, {proxies});
    },
    '1.118.310': conf=>{
        const clean = rule=>{
            delete rule.trigger_code;
            delete rule.type;
            return rule;
        };
        conf.proxies = conf.proxies||[];
        const proxies = conf.proxies.map(p=>{
            p = Object.assign({}, p);
            if (!p.rules)
                return p;
            if (p.rules.post)
                p.rules.post = p.rules.post.map(clean);
            if (p.rules.pre)
                p.rules.pre = p.rules.pre.map(clean);
            return p;
        });
        return Object.assign({}, conf, {proxies});
    },
    '1.118.985': conf=>{
        const transform_action = rule=>{
            if (typeof rule.action=='object')
                return rule;
            const action = {};
            if (rule.action=='null_response')
                action.null_response = true;
            else if (rule.action=='bypass_proxy')
                action.bypass_proxy = true;
            else if (rule.action=='direct')
                action.direct = true;
            else if (rule.action=='switch_port')
                action.retry_port = rule.port;
            if (rule.email)
                action.email = rule.email;
            rule.action_type = rule.action;
            if (rule.action_type=='switch_port')
                rule.action_type = 'retry_port';
            rule.action = action;
            delete rule.retry;
            delete rule.email;
            delete rule.port;
            return rule;
        };
        conf.proxies = conf.proxies||[];
        const proxies = conf.proxies.map(p=>{
            p = Object.assign({}, p);
            if (!p.rules)
                return p;
            if (p.rules.pre)
                p.rules.pre = p.rules.pre.map(transform_action);
            return p;
        });
        return Object.assign({}, conf, {proxies});
    },
    '1.119.232': conf=>{
        conf.proxies = conf.proxies||[];
        const proxies = conf.proxies.map(p=>{
            p = Object.assign({}, p);
            if (!p.rules)
                return p;
            p.rules = [].concat(p.rules.pre||[], p.rules.post||[]);
            if (!p.rules.length)
                delete p.rules;
            return p;
        });
        return Object.assign({}, conf, {proxies});
    },
    '1.119.617': conf=>{
        const fix_url = rule=>{
            if (rule.url=='*' || rule.url=='**')
                delete rule.url;
            return rule;
        };
        conf.proxies = conf.proxies||[];
        const proxies = conf.proxies.map(p=>{
            p = Object.assign({}, p);
            if (!p.rules)
                return p;
            p.rules = p.rules.map(fix_url);
            return p;
        });
        return Object.assign({}, conf, {proxies});
    },
    '1.136.76': conf=>{
        conf.proxies = conf.proxies||[];
        const proxies = conf.proxies.map(p=>{
            p = Object.assign({}, p);
            if (p.last_preset_applied=='round_robin')
                p.last_preset_applied = 'rotating';
            if (['sequential', 'round_robin'].includes(p.pool_type))
                delete p.pool_type;
            return p;
        });
        return Object.assign({}, conf, {proxies});
    },
    '1.148.122': conf=>{
        conf.proxies = conf.proxies||[];
        const proxies = conf.proxies.map(p=>{
            if (p.pool_size)
                p.proxy_resolve = true;
            return p;
        });
        return Object.assign({}, conf, {proxies});
    },
    '1.153.222': conf=>{
        conf.proxies = conf.proxies||[];
        const proxies = conf.proxies.map(p=>{
            if (p.random_user_agent)
                p.random_user_agent = 'desktop';
            return p;
        });
        return Object.assign({}, conf, {proxies});
    },
    '1.153.629': conf=>{
        conf.proxies = conf.proxies||[];
        const proxies = conf.proxies.map(p=>{
            if (p.secure_proxy)
                p.proxy_connection_type = 'https';
            delete p.secure_proxy;
            return p;
        });
        return Object.assign({}, conf, {proxies});
    },
    '1.154.55': conf=>{
        conf.proxies = conf.proxies||[];
        const proxies = conf.proxies.map(p=>{
            if (p.last_preset_applied)
            {
                p.preset = p.last_preset_applied;
                delete p.last_preset_applied;
            }
            return p;
        });
        return Object.assign({}, conf, {proxies});
    },
    '1.154.56': conf=>{
        conf.proxies = conf.proxies||[];
        const proxies = conf.proxies.map(p=>{
            if (p.preset=='high_performance')
                p.preset = 'rotating';
            return p;
        });
        return Object.assign({}, conf, {proxies});
    },
    '1.155.263': conf=>{
        conf.proxies = conf.proxies||[];
        const proxies = conf.proxies.map(p=>{
            if (p.random_user_agent)
            {
                p.user_agent = `random_${p.random_user_agent}`;
                delete p.random_user_agent;
            }
            return p;
        });
        return Object.assign({}, conf, {proxies});
    },
    '1.155.264': conf=>{
        conf.proxies = conf.proxies||[];
        const proxies = conf.proxies.map(p=>{
            if (p.pool_type=='long_availability')
            {
                p.preset = 'long_availability';
                delete p.pool_type;
            }
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
        if (v.startsWith('x') || semver.lt(v, version))
            continue;
        logger.notice(`Migrating config file ${v}`);
        try { conf = migrations[v](conf); }
        catch(e){
            logger.warn(`Could not migrate config file from version ${v}`);
        }
    }
    conf._defaults.version = pkg.version;
    return conf;
};

const E = module.exports = migrate;
E.migrations = all_migrations;
