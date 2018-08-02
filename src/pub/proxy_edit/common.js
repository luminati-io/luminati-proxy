// LICENSE_CODE ZON
'use strict'; /*jslint react:true, es6:true*/
import {Netmask} from 'netmask';

export const validators = {
    number: (min, max, req=false)=>val=>{
        val = Number(val);
        if (isNaN(val))
        {
            if (req)
                return min;
            return undefined;
        }
        else if (val < min)
            return min;
        else if (val > max)
            return max;
        return val;
    },
    ips_list: val=>{
        val = val.replace(/\s/g, '');
        const ips = val.split(',');
        const res = [];
        ips.forEach(ip=>{
            try { res.push(new Netmask(ip).base); }
            catch(e){ console.log('incorrect ip format'); }
        });
        return res.join(',');
    },
};

