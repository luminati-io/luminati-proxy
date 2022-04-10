// LICENSE_CODE ZON ISC
'use strict'; /*jslint browser:true, es6:true*/

// XXX azamat/krzysztof: copy pasted from lum/pub/plans.js, fix webpack loader
// and import it as a whole module
export const get_plan_network = plan=>{
    if (plan.disable)
        return 'disable';
    if (plan.type=='static')
        return plan.pool_ip_type=='static_res' && 'res_static' || 'dc';
    if ((plan.type=='resident' || plan.type=='unblocker') && plan.serp)
        return 'serp';
    if (!plan.type || plan.type=='resident')
        return plan.mobile && 'mobile' || 'res_rotating';
    if (plan.type=='static_res')
        return 'res_static';
    return plan.type;
};

export const network_types = {
    dc: {
        label: 'Data Center',
        tooltip: 'Static IPs from various data centers located around '
            +'the globe',
    },
    res_rotating: {
        label: 'Residential',
        tooltip: 'P2P residential network. Millions of IPs from real '
            +'devices',
    },
    mobile: {
        label: 'Mobile',
        tooltip: '3G and 4G network from real mobile devices',
    },
    res_static: {
        label: 'Static residential',
        tooltip: 'Static residential IPs',
    },
    unblocker: {
        label: 'Unblocker',
        tooltip: 'Clever proxy which automatically manages IPs, headers, '
            +'and network',
    },
    serp: {
        label: 'SERP',
        tooltip: 'Send Google search requests',
    },
    disable: {
        label: 'Disabled',
        tooltip: 'Disabled from control panel. Cannot be used for sending '
            +'traffic',
    },
};
