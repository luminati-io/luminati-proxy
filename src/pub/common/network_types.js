// LICENSE_CODE ZON ISC
'use strict'; /*jslint browser:true, es6:true*/

export const network_types = {
    static: {
        label: 'Data center',
        tooltip: 'Static IPs from various data centers located around '
            +'the globe',
    },
    resident: {
        label: 'Residential',
        tooltip: 'P2P residential network. Millions of IPs from real '
            +'devices',
    },
    custom: {
        label: 'Custom',
        tooltip: '3G and 4G network from real mobile devices',
    },
    static_res: {
        label: 'Static residential',
        tooltip: 'Static residential IPs',
    },
    unblocker: {
        label: 'Unblocker',
        tooltip: 'Clever proxy which automatically manages IPs, headers, '
            +'and network',
    },
};
