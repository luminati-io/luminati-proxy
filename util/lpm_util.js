#!/usr/bin/env node
// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/
const _ = require('lodash');
const yargs = require('yargs');
const pkg = require('../package.json');
const analytics = require('../lib/analytics.js');
const lpm_config = require('./lpm_config.js');
const zerr = require('../util/zerr.js');
const E = module.exports;

const parse_env_params = (env, fields)=>{
    const params = {};
    for (const [field, value] of Object.entries(fields))
    {
        const key = 'LPM_'+field.toUpperCase();
        if (!env[key])
            continue;
        switch (value.type)
        {
        case 'string':
            if (value.pattern && !(new RegExp(value.pattern)).test(env[key]))
                zerr.zexit(key+' wrong value pattern '+value.pattern);
            params[field] = env[key];
            break;
        case 'integer':
            params[field] = Number.parseInt(env[key]);
            if (!Number.isInteger(params[field]))
                zerr.zexit(key+' not a number '+env[key]);
            break;
        case 'boolean':
            if (!['0', '1', 'false', 'true'].includes(env[key]))
                zerr.zexit(key+' wrong boolean value '+env[key]);
            params[field] = ['1', 'true'].includes(env[key]);
            break;
        case 'array':
            params[field] = env[key].split(';');
            break;
        case 'object':
            try { params[field] = JSON.parse(env[key]); }
            catch(e){ zerr.zexit(key+' contains invalid JSON: '+env[key]); }
            break;
        }
    }
    return params;
};
E.t = {parse_env_params};

E.init_args = args=>{
    const added_descriptions = {
        'no-www': 'Disable local web',
        'no-config': 'Working without a config file',
        'no-cookie': 'Working without a cookie file',
        daemon: 'Start as a daemon',
        'restart-daemon': 'Restart running daemon',
        'stop-daemon': 'Stop running daemon',
        'delete-daemon': 'Delete daemon instance',
        upgrade: 'Upgrade proxy manager',
        dir: 'Path to the directory with database and configuration files',
        status: 'Show proxy manager processes current status',
        'show-logs': 'Show logs of the currently running LPM instance',
    };
    const usage = ['Usage:\n  $0 [options] config1 config2 ...'];
    if (process.env.DOCKER)
    {
        usage.unshift('  docker run luminati/luminati-proxy '
            +'[docker port redirections]');
    }
    const alias = {
        help: ['h', '?'],
        port: 'p',
        daemon: ['d', 'start-daemon'],
        version: 'v',
    };
    const defaults = Object.assign({}, lpm_config.manager_default,
        parse_env_params(process.env, lpm_config.proxy_fields));
    args = (args||process.argv.slice(2)).map(String);
    const argv = yargs(args)
    .usage(usage.join(' \n'))
    .options(lpm_config.proxy_fields)
    .describe(added_descriptions)
    .number(lpm_config.numeric_fields)
    .default(defaults)
    .help()
    .strict()
    .version(pkg.version)
    .alias(alias)
    .argv;
    argv.native_args = args;
    argv.log = argv.log.toLowerCase();
    if (argv.session=='true')
        argv.session = true;
    argv.explicit_opt = _.pick(argv, [...lpm_config.proxy_params, 'test_url']
        .filter(p=>args.includes(`--${p}`)));
    if (args.includes('-p'))
        argv.explicit_opt.port = argv.port;
    argv.daemon_opt = args.filter(arg=>arg.includes('daemon')||arg=='-d')
    .map(arg=>{
        let match;
        if (arg=='-d'||arg=='--daemon')
            arg = '--start-daemon';
        if (!(match = arg.match(/--([^-]*)-daemon(=.*)?/)))
            return null;
        return {
            daemon: true,
            name: match[1],
            value: match[2],
        };
    })
    .reduce((acc, curr)=>{
        if (curr)
            acc[curr.name] = curr.value||true;
        return acc;
    }, {});
    analytics.enabled = !argv.no_usage_stats;
    return argv;
};
