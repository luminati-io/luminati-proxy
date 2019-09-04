// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/
const E = module.exports;

E.get_perm = zone=>{
    const plan = zone.plan;
    if (!plan || !plan.type)
        return zone.perm;
    const perm = {
        full: 'country state city g1 cid ip asn carrier pass_ip mobile '+
            'port_all port_whois',
        city: 'country state city vip',
        asn: 'country state asn carrier vip',
        g1: 'country g1 vip',
        static: 'country ip route_all route_dedicated',
        mobile: 'country mobile asn carrier state city vip',
    };
    let res = 'country vip';
    if (plan.type=='static')
        return perm.static;
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
    if (plan.google_search)
        res += ' google_search';
    return res;
};

E.get_password = (proxy, zone_name, zones)=>{
    const zone = zones.find(z=>z.zone==zone_name);
    if (zone && zone.password)
        return zone.password;
    if (proxy && proxy.password)
        return proxy.password;
};

E.is_static_proxy = (zone_name, zones)=>{
    const zone = zones.find(z=>z.zone==zone_name);
    if (!zone)
        return false;
    return zone.plan && zone.plan.type=='static';
};

E.is_mobile = (zone_name, zones)=>{
    const zone = zones.find(z=>z.zone==zone_name);
    if (!zone)
        return false;
    return !!(zone.plan && zone.plan.mobile);
};

// XXX krzysztof: TODO
function Zones_mgr(){
}

E.Zones_mgr = Zones_mgr;

