#!/usr/bin/env node
// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/
const _ = require('lodash');
const yargs = require('yargs');
const pkg = require('../package.json');
const lpm_config = require('./lpm_config.js');
const E = module.exports;

E.init_args = args=>{
    const added_descriptions = {
        'no-www': 'Disable local web',
        'no-config': 'Working without a config file',
        'no-cookie': 'Working without a cookie file',
        daemon: 'Start as a daemon',
        'stop-daemon': 'Stop running daemon',
        upgrade: 'Upgrade proxy manager',
    };
    let usage = ['Usage:\n  $0 [options] config1 config2 ...'];
    if (process.env.DOCKER)
    {
        usage.unshift('  docker run luminati/luminati-proxy '
            +'[docker port redirections]');
    }
    args = (args||process.argv.slice(2)).map(String);
    const argv = yargs(args).usage(usage.join(' \n'))
    .options(lpm_config.proxy_fields)
    .describe(added_descriptions)
    .number(lpm_config.numeric_fields)
    .default(lpm_config.manager_default)
    .help('h')
    .alias({'help': ['h', '?'], port: 'p', daemon: 'd', 'version': 'v'})
    .version(()=>`luminati-proxy version: ${pkg.version}`).argv;
    argv.native_args = args;
    if (argv.log instanceof Array)
        argv.log = argv.log.pop();
    argv.log = argv.log.toLowerCase();
    if (argv.session=='true')
        argv.session = true;
    argv.explicit_opt = _.pick(argv, [...lpm_config.proxy_params, 'test_url']
        .filter(p=>args.includes(`--${p}`)));
    if (args.includes('-p'))
        argv.explicit_opt.port = argv.port;
    argv.overlay_opt = _.omit(argv.explicit_opt, 'port');
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
    return argv;
};
