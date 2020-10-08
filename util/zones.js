// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/
const E = module.exports;

E.get_perm = zone=>{
    const plan = zone.plan;
    if (!plan || !plan.type)
        return zone.perm;
    const perm = {
        city: 'country state city vip',
        asn: 'country state asn carrier vip',
        static: 'country ip route_all route_dedicated',
        mobile: 'country mobile asn carrier state city vip',
    };
    let res = 'country vip';
    if (plan.type=='static')
    {
        let static_res = perm.static;
        if (plan.city)
            static_res += ' city';
        return static_res;
    }
    if (plan.mobile)
        res = perm.mobile;
    else if (plan.city && plan.asn)
        res = perm.city+' asn carrier';
    else if (plan.city)
        res = perm.city;
    else if (plan.asn)
        res = perm.asn;
    if (plan.vips_type=='domain_p')
        res += ' vip_all';
    if (plan.state)
        res += ' state';
    return res;
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

