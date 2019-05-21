// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/
const date = require('../util/date.js');
const E = module.exports;

E.get_plan = plans=>{
    const d = date();
    plans = plans||[];
    for (let i=plans.length-1; i>=0; i--)
    {
        if (date(plans[i].start)<=d)
        {
            if (plans[i].end && d>=date(plans[i].end))
                return;
            return plans[i];
        }
    }
};

E.get_perm = zone=>{
    const plan = E.get_plan(zone.plans);
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

// XXX krzysztof: TODO
function Zones_mgr(){
}

Zones_mgr.prototype.get_zone = function(zone_name){
};

E.Zones_mgr = Zones_mgr;

E.get_zone = function(c){
    const zones = ((this.lum_conf||{})._defaults||{}).zones;
    return zones && zones[c.zone];
};

