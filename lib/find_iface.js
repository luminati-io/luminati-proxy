// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/
const os = require('os');

module.exports = iface=>{
    const is_ip = /^\d{1,3}(?:\.\d{1,3}){3}$/.test(iface);
    const ifaces = os.networkInterfaces();
    for (let name in ifaces)
    {
        if (name!=iface&&(!is_ip||!ifaces[name].some(d=>d.address==iface)))
            continue;
        let addresses = ifaces[name].filter(data=>data.family=='IPv4');
        if (addresses.length)
            return addresses[0].address;
    }
    return false;
};
