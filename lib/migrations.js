#!/usr/bin/env node
// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/
const semver = require('semver');

// XXX krzysztof: WIP
const migrations = {
    '1.116.387': config=>{
        let socks_warning = false;
        let rules_warning = false;
        let warnings = [];
        config.proxies.forEach(p=>{
            if (p.socks)
            {
                delete p.socks;
                socks_warning = true;
            }
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
                    rules_warning = true;
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
        });
        if (socks_warning)
        {
            warnings.push({type: 'socks', msg: 'SOCKS 5 port has been'
                +' merged with the main proxy port. You can use the same port'
                +' for HTTP/HTTPS/SOCKS 5 requests'});
        }
        if (rules_warning)
        {
            warnings.push({type: 'rules', msg: `Configs from General tab:
                'URL for null response', 'URL for bypass proxy', and 'URL for
                super proxy' have been merged with Rules`});
        }
        return warnings;
    },
};

class Migrations_mgr {
    constructor(config){
        this.config = config;
    }
    migrate(){
        const warnings = [];
        const version = this.config.version||'0.0.0';
        for (let v in migrations)
        {
            if (semver.gt(version, v))
                break;
            const res = migrations[v](this.config);
            warnings.push(...res);
        }
    }
}

const E = module.exports = Migrations_mgr;
E.migrations = migrations;
