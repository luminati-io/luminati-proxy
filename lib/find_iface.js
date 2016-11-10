// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/
const os = require('os');

module.exports = iface=>{
    const ifaces = os.networkInterfaces();
    for (let name in ifaces)
    {
        if (name!=iface)
            continue;
        let addresses = ifaces[name].filter(data=>data.family=='IPv4');
        if (addresses.length)
            return addresses[0].address;
    }
    return false;
};
