// LICENSE_CODE ZON
'use strict'; /*jslint node:true*/
require('./config.js');
const _ = require('lodash');
const E = exports;

E.find_matches = (all_rules, selector)=>
    (all_rules||[]).filter(x=>matches_rule(x.match, selector));

E.select_rules = (all_rules, selector, overrides=[])=>{
    let matches = E.find_matches(all_rules, selector);
    return _.merge({}, ...matches.map(x=>x.rules), ...overrides, (dest, src)=>{
        if (Array.isArray(src))
            return src;
    });
};

function matches_rule(rule, data){
    for (let k in rule)
    {
        if (k=='version_min')
        {
            if ((rule[k]||0)>(data.version||0))
                return false;
        }
        else if (!E.rule_value_match(rule[k], data[k]))
            return false;
    }
    return true;
}

E.rule_value_match = (rule_v, v)=>{
    if (Array.isArray(rule_v))
        return rule_v.some(_rule_v=>E.rule_value_match(_rule_v, v));
    if (!_.isObject(rule_v))
        return rule_v==v;
    if (rule_v.test)
        return rule_v.test(v||'');
    return _.every(rule_v,
        (_rule_v, k)=>E.rule_value_match(_rule_v, v && v[k]));
};
