// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/
const E = module.exports;
const {qw} = require('../util/string.js');
const zutil = require('../util/util.js');

E.get_perm = zone=>{
    const plan = zone.plan;
    if (!plan || !plan.type)
        return zone.perm;
    const perm = {
        city: qw`city`,
        asn: qw`asn carrier state`,
        static: qw`ip route_all route_dedicated`,
        mobile: qw`mobile asn carrier state city`,
        state: qw`state`,
    };
    if (plan.type=='static')
    {
        let static_res = ['country', ...perm.static];
        if (plan.city)
            static_res.push(...perm.city);
        return static_res.join(' ');
    }
    const plan_types = Object.keys(zutil.omit(perm, 'static'));
    const res = ['country', 'vip', ...plan_types.flatMap(t=>
        plan[t] ? perm[t] : [])];
    if (plan.vips_type=='domain_p')
        res.push('vip_all');
    return [...new Set(res)].join(' ');
};

E.get_password = (proxy, zone_name, zones)=>{
    const zone = zones.find(z=>z.zone==zone_name);
    if (zone && zone.password)
        return zone.password;
    if (proxy && proxy.password)
        return proxy.password;
};

E.get_gb_cost = (zone_name, zones)=>{
    const zone = zones.find(z=>z.zone==zone_name);
    return zone && zone.cost && zone.cost.gb || 0;
};

const get_plan = (zone_name, zones, type)=>{
    const zone = zones.find(z=>z.zone==zone_name);
    return zone && zone.plan || {};
};

E.is_static_proxy = (zone_name, zones)=>{
    const plan = get_plan(zone_name, zones);
    return plan.type=='static';
};

E.is_unblocker = (zone_name, zones)=>{
    const plan = get_plan(zone_name, zones);
    return plan.type=='unblocker' || plan.unblocker;
};

E.is_mobile = (zone_name, zones)=>{
    const plan = get_plan(zone_name, zones);
    return !!plan.mobile;
};

// XXX krzysztof: TODO
function Zones_mgr(){
}

E.Zones_mgr = Zones_mgr;

