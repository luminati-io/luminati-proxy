// LICENSE_CODE ZON
'use strict'; /*jslint node: true, es9: true*/
require('./config.js');
const string = require('./string.js');
const E = exports;

E.Netmask = class Netmask {
    // XXX dmitriie: netLong -> base_int, maskLong -> mask_int
    constructor(net, mask){
        if (typeof net!='string')
            throw new Error('Missing "net" parameter');
        // try to find the mask in the net
        // (i.e.: 1.2.3.4/24 or 1.2.3.4/255.255.255.0)
        if (!mask)
            [net, mask] = net.split('/', 2);
        if (!mask)
            mask = 32;
        // Compute bitmask, the netmask as a number of bits in the network
        // portion of the address for this block (eg.: 24)
        if (typeof mask=='string' && mask.includes('.'))
        {
            try {
                this.mask_int = E.ip2long(mask);
            } catch(e){
                throw new Error(`Invalid mask: ${mask}`);
            }
            for (let i = 32; i >= 0; --i)
            {
                if (this.mask_int === 0xffffffff << 32-i >>> 0)
                {
                    this.bitmask = i;
                    break;
                }
            }
        }
        // The mask was passed as bitmask, compute the mask as long from it
        else if (mask || mask===0)
        {
            this.bitmask = parseInt(mask, 10);
            this.mask_int = 0;
            if (this.bitmask > 0)
                this.mask_int = 0xffffffff << 32-this.bitmask >>> 0;
        }
        else
            throw new Error('Invalid mask: empty');
        try {
            this.base_int = (E.ip2long(net) & this.mask_int) >>> 0;
        } catch(e){
            throw new Error(`Invalid net address: ${net}`);
        }
        if (!(this.bitmask <= 32))
            throw new Error(`Invalid mask for ip4: ${mask}`);
        const is_capacious = this.bitmask <= 30;
        // The number of IP address in the block (eg.: 254)
        this.size = Math.pow(2, 32 - this.bitmask);
        this.hostmask_int = ~this.mask_int;
        this.first_int = this.base_int+(is_capacious ? 1 : 0);
        this.last_int = this.base_int+this.size-(is_capacious ? 2 : 1);
        this.broadcast_int = is_capacious ? this.base_int+this.size-1
            : undefined;
        this.cache = {};
    }
    // The address of the network block as a string (eg.: 216.240.32.0)
    get base(){ return this.lazy_long2ip('base_int'); }
    // The netmask as a string (eg.: 255.255.255.0)
    get mask(){ return this.lazy_long2ip('mask_int'); }
    // The host mask, the opposite of the netmask (eg.: 0.0.0.255)
    get hostmask(){ return this.lazy_long2ip('hostmask_int'); }
    // The first usable address of the block
    get first(){ return this.lazy_long2ip('first_int'); }
    // The last  usable address of the block
    get last(){ return this.lazy_long2ip('last_int'); }
    // The block's broadcast address: the last address of the block
    // (eg.: 192.168.1.255)
    get broadcast(){ return this.lazy_long2ip('broadcast_int'); }
    // Returns true if the given ip or netmask is contained in the block
    contains(ip){
        if (typeof ip=='string')
        {
            ip = ip.includes('/') || string.count(ip, '.')!=3
                ? new Netmask(ip) : E.ip2long(ip);
        }
        if (ip instanceof Netmask)
        {
            return this.contains(ip.base_int)
                && this.contains(ip.broadcast_int || ip.last_int);
        }
        return (ip&this.mask_int) >>> 0
            == (this.base_int&this.mask_int) >>> 0;
    }
    // Returns the Netmask object for the block which follow this one
    next(count=1){
        return new Netmask(E.long2ip(this.size*count+this.base_int),
            this.mask);
    }
    forEach(cb){
        for (let i=0, long=this.first_int; long<=this.last_int; ++i, ++long)
            cb(E.long2ip(long), long, i);
    }
    // Returns the complete netmask formatted as `base/bitmask`
    toString(){
        return this.base+'/'+this.bitmask;
    }
    lazy_long2ip(prop){
        if (!this.cache.hasOwnProperty(prop))
        {
            this.cache[prop] = this[prop]!==undefined ? E.long2ip(this[prop])
                : undefined;
        }
        return this.cache[prop];
    }
};

E.long2ip = long=>{
    return ((long & 0xff000000)>>>24)+'.'+((long & 0xff0000)>>>16)+'.'
        +((long & 0xff00)>>>8)+'.'+(long & 0xff);
};

E.ip2long = ip=>{
    const b = [];
    for (let i=0; i<=3; ++i)
    {
        if (ip.length==0)
            break;
        if (i > 0)
        {
            if (ip[0]!='.')
                throw new Error('Invalid IP');
            ip = ip.substring(1);
        }
        const [n, c] = atob(ip);
        ip = ip.substring(c);
        b.push(n);
    }
    if (ip.length!=0)
        throw new Error('Invalid IP');
    switch (b.length)
    {
    case 1:
        // Long input notation
        if (b[0] > 0xFFFFFFFF)
            throw new Error('Invalid IP');
        return b[0] >>> 0;
    case 2:
        // Class A notation
        if (b[0] > 0xFF || b[1] > 0xFFFFFF)
            throw new Error('Invalid IP');
        return (b[0] << 24 | b[1]) >>> 0;
    case 3:
        // Class B notation
        if (b[0] > 0xFF || b[1] > 0xFF || b[2] > 0xFFFF)
            throw new Error('Invalid IP');
        return (b[0] << 24 | b[1] << 16 | b[2]) >>> 0;
    case 4:
        // Dotted quad notation
        if (b[0] > 0xFF || b[1] > 0xFF || b[2] > 0xFF || b[3] > 0xFF)
            throw new Error('Invalid IP');
        return (b[0] << 24 | b[1] << 16 | b[2] << 8 | b[3]) >>> 0;
    }
    throw new Error('Invalid IP');
};

const atob = s=>{
    let n = 0;
    let base = 10;
    let dmax = '9';
    let i = 0;
    if (s.length > 1 && s[i]=='0')
    {
        if (s[i+1]=='x' || s[i+1]=='X')
        {
            i += 2;
            base = 16;
        }
        else if ('0' <= s[i+1] && s[i+1] <= '9')
        {
            i++;
            base = 8;
            dmax = '7';
        }
    }
    const start = i;
    while (i < s.length)
    {
        if ('0' <= s[i] && s[i] <= dmax)
            n = n * base + (chr(s[i]) - chr_0) >>> 0;
        else if (base === 16)
        {
            if ('a' <= s[i] && s[i] <= 'f')
                n = n * base + (10 + chr(s[i]) - chr_a) >>> 0;
            else if ('A' <= s[i] && s[i] <= 'F')
                n = n * base + (10 + chr(s[i]) - chr_A) >>> 0;
            else
                break;
        }
        else
            break;
        if (n > 0xFFFFFFFF)
            throw new Error('too large');
        i++;
    }
    if (i==start)
        throw new Error('empty octet');
    return [n, i];
};

const chr = b=>b.charCodeAt(0);
const chr_0 = chr('0');
const chr_a = chr('a');
const chr_A = chr('A');
