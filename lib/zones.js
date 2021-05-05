// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/
const {qw} = require('../util/string.js');
const zutil = require('../util/util.js');

const get_perm = zone=>{
    const plan = zone.plan;
    if (!plan || !plan.type)
        return zone.perm;
    const perm = {
        city: qw`state city`,
        asn: qw`asn carrier state`,
        static: qw`ip route_all route_dedicated`,
        mobile: qw`mobile asn carrier state city`,
        state: qw`state`,
    };
    if (plan.type=='static')
    {
        let static_res = ['country', ...perm.static];
        if (plan.city)
            static_res.push(...perm.city.filter(p=>p!='state'));
        return static_res.join(' ');
    }
    const plan_types = Object.keys(zutil.omit(perm, 'static'));
    const res = ['country', 'vip', ...plan_types.flatMap(t=>
        plan[t] ? perm[t] : [])];
    if (plan.vips_type=='domain_p')
        res.push('vip_all');
    return [...new Set(res)].join(' ');
};

const zones_from_conf = zones=>{
    if (!zones)
        return [];
    return Object.keys(zones).map(zone_name=>{
        const zone = zones[zone_name];
        return {
            zone: zone_name,
            perm: get_perm(zone),
            plan: zone.plan,
            password: (zone.password||[])[0],
            cost: zone.cost,
            refresh_cost: zone.refresh_cost,
        };
    });
};

class Zones_mgr {
    constructor(mgr){
        this.mgr = mgr;
        this.zones = [];
    }
    set_from_conf(zones){
        this.zones = zones_from_conf(zones);
    }
    reset(){
        this.zones = [];
    }
    get_obj(zname){
        return this.zones.find(z=>z.zone==zname);
    }
    get_plan(zname){
        const obj = this.get_obj(zname);
        return obj && obj.plan || {};
    }
    get_formatted(){
        const zones = this.zones.map(z=>({
            name: z.zone,
            perm: z.perm,
            plan: z.plan || {},
            password: z.password,
            refresh_cost: z.refresh_cost,
        })).filter(p=>p.plan);
        return {zones, def: this.mgr._defaults.zone};
    }
    is_static_proxy(zname){
        const plan = this.get_plan(zname, this.zones);
        return plan.type=='static';
    }
    is_unblocker(zname){
        const plan = this.get_plan(zname, this.zones);
        return plan.type=='unblocker' || !!plan.unblocker;
    }
    is_mobile(zname){
        const plan = this.get_plan(zname, this.zones);
        return !!plan.mobile;
    }
    get_gb_cost(zname){
        const zone = this.zones.find(z=>z.zone==zname);
        return zone && zone.cost && zone.cost.gb || 0;
    }
    get_password(proxy, zname){
        const zone = this.zones.find(z=>z.zone==zname);
        if (zone && zone.password)
            return zone.password;
        if (proxy && proxy.password)
            return proxy.password;
    }
    validate_default_zone(){
        const all_zones = new Set(this.zones.map(z=>z.zone));
        const enabled_zones = new Set(this.zones.filter(z=>!z.plan.disable)
            .map(z=>z.zone));
        if (!enabled_zones.has(this.mgr._defaults.zone))
        {
            if (enabled_zones.size)
                this.mgr._defaults.zone = [...enabled_zones][0];
            else
                delete this.mgr._defaults.zone;
        }
        this.mgr.proxies.forEach(p=>{
             if (!all_zones.has(p.zone))
                 delete p.zone;
        });
        this.mgr.config.save({skip_cloud_update: 1});
    }
}

module.exports = Zones_mgr;

