// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, browser:true*//*global Map*/
(function(){
var define, hash, assert, zerr, vm;
var is_node = typeof module=='object' && module.exports && module.children;
var is_rn = typeof global=='object' && !!global.nativeRequire ||
    typeof navigator=='object' && navigator.product=='ReactNative';
if (!is_node)
{
    if (is_rn)
    {
        define = require('./require_node.js').define(module, '../',
            require('/util/util.js'));
    }
    else
        define = self.define;
    assert = function(){}; // XXX romank: add proper assert
    // XXX romank: use zerr.js
    if (!is_rn && self.hola && self.hola.zerr)
        zerr = self.hola.zerr;
    else
    {
        // IE8 does not support console.log.bind(console)
        zerr = function(){ console.log.apply(console, arguments); };
        zerr.perr = zerr;
    }
}
else
{
    require('./config.js');
    zerr = require('./zerr.js');
    hash = require('crypto');
    assert = require('assert');
    vm = require('vm');
    define = require('./require_node.js').define(module, '../');
}
define(['/util/util.js', '/util/date.js'], function(zutil, date){
var E = {};

var has_map = typeof Map=='function' && Map.prototype.get && Map.prototype.set;
has_map = 0; // XXX: unit-test and remove
E.cache_str_map_fn = function(fn){
    var cache = new Map();
    return function(s){
        s = ''+s;
        var v = cache.get(s);
        if (v!==undefined || cache.has(s))
            return v;
        cache.set(s, v = fn(s));
        return v;
    };
};
E.cache_str_obj_fn = function(fn){
    var cache = {};
    return function(s){
        if (s in cache)
            return cache[s];
        return cache[s] = fn(s);
    };
};
E.cache_str_fn = has_map ? E.cache_str_map_fn : E.cache_str_obj_fn;

E.cache_str_fn2 = function(fn){
    var cache = {};
    return function(s1, s2){
        var cache2 = cache[s1] = cache[s1]||{};
        if (s2 in cache2)
            return cache2[s2];
        return cache2[s2] = fn(s1, s2);
    };
};

E.o = function(oct_str){ return parseInt(oct_str, 8); };

// XXX vladimir: only nodejs
E.hash = function(buf, hash_len, encoding, type){
    type = type||'sha256';
    // update() ignores encoding if buf is a Buffer
    return hash.createHash(type).update(buf, encoding||'utf8')
    .digest('hex').slice(0, hash_len);
};

E.encode_base64_shift = function(data, charset){
    charset = charset||'ascii';
    data = Buffer.from(data, charset).toString('base64');
    if (!data.endsWith('='))
        data = data.substr(3)+data.substr(0, 3);
    else
    {
        var i = data.indexOf('=');
        data = data.substring(3, i)+data.substr(0, 3)+data.substr(i);
    }
    return data;
};

E.md5 = function(buf, hash_len, encoding){
    return E.hash(buf, hash_len, encoding, 'md5');
};
E.md5_zero = function(key, hash_len){
    assert(hash_len<=32, 'invalid hash len'+hash_len);
    if (!key || !key.length)
        return '0'.repeat(hash_len);
    return E.md5(key, hash_len);
};
E.md5_etag = function(buf){ return E.md5(buf, 8); };

E.inet_ntoa_t = function(ip){
    return ((ip & 0xff000000)>>>24)+'.'+((ip & 0xff0000)>>>16)+'.'
    +((ip & 0xff00)>>>8)+'.'+(ip & 0xff);
};

E.inet_addr = function(ip){
    var code, res = 0, shift = 24, num = undefined;
    ip = ''+ip;
    for (var i = 0, l = ip.length; i<l; ++i)
    {
        code = ip.charCodeAt(i);
        if (code>47&&code<58)
        {
            num = (num||0)*10+code-48;
            continue;
        }
        if (code==46)
        {
            if (num==undefined||num>255)
                return null;
            res += num<<shift;
            num = undefined;
            shift -= 8;
            continue;
        }
        return null;
    }
    return shift==0 && num!=undefined && num<256 ? res+(num|0)>>>0 : null;
};

function flags_to_str_once(flags, conv){
    var f = 'var s = "";\n';
    f += 'if (!flags) return "";\n';
    for (var i in conv)
    {
        if (!conv.hasOwnProperty(i))
            continue;
        f += 'if (flags & '+conv[i]+') '
            +'{ s += '+JSON.stringify(i.toLowerCase())+'+" "; '
            +'flags &= ~'+conv[i]+'; }\n';
    }
    f += 'if (flags && conv.__conv_to_str.err) '
        +'conv.__conv_to_str.err(flags, conv);\n';
    f += 'return s.slice(0, -1);\n';
    var func = new Function(['flags', 'conv'], f);
    Object.defineProperty(conv, '__conv_to_str',
        {enumerable: false, writable: true});
    conv.__conv_to_str = func;
    func.err = function(_flags, _conv){
        zerr.perr('flags_str_invalid', 'flags '+_flags+' '
            +JSON.stringify(_conv).slice(0, 30));
    };
    return conv.__conv_to_str(flags, conv);
}

E.flags_to_str = function(flags, conv){
    if (conv.__conv_to_str)
        return conv.__conv_to_str(flags, conv);
    return flags_to_str_once(flags, conv);
};

function flags_from_str_once(s, conv){
    var f = 'var flags = 0, a, i;\n';
    f += 'if (!s) return 0;\n';
    f += 's = s.toUpperCase();\n';
    f += 'a = s.split(",");\n';
    f += 'for (i=0; i<a.length; i++)\n';
    f += '{\n';
    f += '    if (!conv[a[i]])\n';
    f += '    {\n';
    f += '        if (flags && conv.__conv_from_str.err) '
        +'conv.__conv_from_str.err(flags, conv);\n';
    f += '        return -1;\n';
    f += '    }\n';
    f += '    flags |= conv[a[i]];\n';
    f += '}\n';
    f += 'return flags;\n';
    var func = new Function(['s', 'conv'], f);
    Object.defineProperty(conv, '__conv_from_str',
        {enumerable: false, writable: true});
    conv.__conv_from_str = func;
    func.err = function(_s, _conv){
        zerr.perr('flags_str_invalid', 'flags '+_s+' '
            +JSON.stringify(_conv).slice(0, 30));
    };
    return conv.__conv_from_str(s, conv);
}

E.flags_from_str = function(s, conv){
    if (conv.__conv_from_str)
        return conv.__conv_from_str(s, conv);
    return flags_from_str_once(s, conv);
};

E.scale_vals = {
    si: [
        {s: '', n: 1},
        {s: 'K', n: 1e3},
        {s: 'M', n: 1e6},
        {s: 'G', n: 1e9},
        {s: 'T', n: 1e12},
        {s: 'P', n: 1e15},
    ],
    $: [
        {s: '', n: 1},
        {s: 'K', n: 1e3},
        {s: 'M', n: 1e6},
        {s: 'G', n: 1e9},
    ],
    1024: [
        {s: '', n: 1},
        {s: 'K', n: 1024},
        {s: 'M', n: Math.pow(1024, 2)},
        {s: 'G', n: Math.pow(1024, 3)},
        {s: 'T', n: Math.pow(1024, 4)},
        {s: 'P', n: Math.pow(1024, 5)},
    ],
};
E.scale_vals['1000'] = E.scale_vals.si;

E.scaled_number = function(num, opt){
    opt = opt||{};
    var sign = '', per = opt.per, scale = opt.scale;
    var base = opt.base==1024 ? 1024 : 1000, ratio = opt.ratio||1;
    var units = opt.units===undefined||opt.units;
    function _per(){ return per ? E.fmt_per(per) : ''; }
    if (num<0)
    {
        sign = '-';
        num = -num;
    }
    if (num===undefined)
        return '';
    if (isNaN(num))
        return opt.nan||'x';
    if (num==Infinity)
        return sign+'\u221e';
    var scale_vals = E.scale_vals[base], i = 0;
    if (scale==null)
        for (; i<scale_vals.length-1 && num>=scale_vals[i+1].n*ratio; i++);
    else
        i = scale_vals.findIndex(function(_scale){ return _scale.s==scale; });
    if (per=='ms' && i)
    {
        per = 's';
        i--;
        num = num/1000;
    }
    scale = scale_vals[i];
    if (opt.is_scale)
        return scale.n;
    num /= scale.n;
    if (num<0.001)
        return '0'+_per();
    if (num>=base-1)
        num = Math.trunc(num);
    var str = num.toFixed(opt.decimals!=null ? opt.decimals
        : num<1 ? 3 : num<10 ? 2 : num<100 ? 1 : 0);
    return sign+str.replace(/((\.\d*[1-9])|\.)0*$/, '$2')
        +(units ? (opt.space ? ' ' : '')+scale.s : '')+_per();
};

E.scaled_bytes = function(num, opt){
    return E.scaled_number(num, Object.assign({base: 1000}, opt)); };

E.fmt_currency = function(amount, digits, currency_sign){
    return E.fmt_num(amount, {style: 'currency', max_digits: digits,
        unit: currency_sign});
};

// opt:
// - style:str (default: guessed based on unit, 'decimal' if unable to guess)
// - unit:str (default: '')
// - spaced_unit:bool (default: unit.length>3)
// - scaling:bool (default: style-dependent)
// - min_digits:int (default: null, or 2 for currencies)
// - max_digits:int (default: null, or 2 for currencies)
// - digits:int (default: null)
// - delta:bool (default: false)
//   => when true, show '+' sign for positive numbers
// - rm_digits_all_zero:bool (default: false)
//   => when true, removes digits that are all zeroes (e.g. 12.000)
// - grouping:bool (default: true)
// - nan:str (default:'NaN')
//   => what to return for non-numbers
// fmt_num(1234, '$')
// fmt_num(1234, '$', {digits: 1})
// fmt_num(1234, {unit: '$', digits: 1})
E.fmt_num = function(num, unit_or_opt, opt){
    opt = Object.assign({},
        typeof unit_or_opt=='string' ? {unit: unit_or_opt} : unit_or_opt, opt);
    if (num==null)
        return num;
    if (typeof num=='string' && num_regex.test(num))
        num = +num;
    if (!Number.isFinite(num))
        return opt.nan||'NaN';
    // resolve options
    var style = opt.style;
    if (style===undefined && opt.unit)
    {
        style = Object.keys(num_styles).find(function(s){
            return num_styles[s].units.includes(opt.unit); });
    }
    if (!num_styles[style])
        style = 'decimal';
    var unit = opt.unit;
    if (unit===undefined)
        unit = num_styles[style].units[0];
    if (typeof unit!='string')
        unit = unit==null||unit==false ? '' : ''+unit;
    var scaling = opt.scaling;
    if (scaling===undefined)
        scaling = num_styles[style].default_scaling;
    if (scaling==true)
        scaling = num_styles[style].vanilla_scaling;
    var max_digits = opt.max_digits;
    if (max_digits===undefined)
    {
        if (opt.digits!==undefined)
            max_digits = opt.digits;
        else if (style=='currency')
            max_digits = scaling&&1 || 2;
        else
            max_digits = scaling&&2 || 3;
    }
    if (max_digits===null || max_digits===false || max_digits>12)
        max_digits = 12;
    var min_digits = opt.min_digits;
    if (min_digits===undefined)
    {
        if (opt.digits!==undefined)
            min_digits = opt.digits;
        else if (style=='currency')
            min_digits = max_digits>=2&&2 || undefined;
    }
    if (min_digits===null || min_digits===false)
        min_digits = 0;
    var rm_digits_all_zero = opt.rm_digits_all_zero;
    if (rm_digits_all_zero===undefined)
        rm_digits_all_zero = opt.digits==null && opt.min_digits==null;
    var plural = opt.plural;
    if (plural===undefined)
        plural = num_styles[style].default_plural;
    if (plural==true && unit.endsWith('s'))
        unit = unit.slice(0, -1);
    // apply scaling
    var scale_str = '';
    if (scaling=='%')
        num *= 100;
    else if (E.scale_vals[scaling])
    {
        var scale_vals = E.scale_vals[scaling], i;
        var abs_num = Math.abs(num), mult = 1;
        if (style=='bytes' && unit!='B' && unit!='Bs')
        {
            var needle = unit.replace(/s$/, '');
            for (i=0; i<scale_vals.length; i++)
            {
                if (scale_vals[i].s+'B'==needle)
                {
                    mult *= scale_vals[i].n;
                    break;
                }
            }
            abs_num *= mult;
            unit = 'B';
        }
        for (i=scale_vals.length-1; i>=0; i--)
        {
            if (abs_num>=scale_vals[i].n)
            {
                mult /= scale_vals[i].n;
                scale_str = scale_vals[i].s;
                break;
            }
        }
        num *= mult;
    }
    // render
    var sign = num<0&&'-' || opt.delta&&'+' || '';
    var num_str = Math.abs(num).toLocaleString('en-GB', {
        useGrouping: opt.grouping!=false,
        maximumFractionDigits: max_digits,
        minimumFractionDigits: min_digits,
    });
    if (rm_digits_all_zero && num_str.endsWith('0'))
        num_str = num_str.replace(/\.0+$/, '');
    var unit_sep = '';
    if (opt.spaced_unit || opt.spaced_unit==null&&unit.length>3)
        unit_sep = ' ';
    if (plural && unit!=='' && !/^1(\.0+)?$/.test(num_str))
        unit = typeof plural=='string' ? plural : unit+'s';
    return style=='currency' ? sign+unit+num_str+scale_str
        : sign+num_str+unit_sep+scale_str+unit;
};

var num_styles = {
    decimal: {units: [''], vanilla_scaling: 'si'},
    percent: {units: ['%'], vanilla_scaling: '%', default_scaling: 1},
    currency: {units: ['$'], vanilla_scaling: '$'},
    bytes: {
        units: ['B', 'Bs', 'KB', 'KBs', 'MB', 'MBs', 'GB', 'GBs', 'TB', 'TBs',
            'PB', 'PBs', 'byte', 'bytes'],
        vanilla_scaling: 'si',
        default_scaling: 1,
        default_plural: 1,
    },
};

var num_regex = /^\s*[+-]?((\d+(\.\d*)?)|(\.\d+))\s*$/;

E.fmt_per = function(per){
    if (!per)
        return '';
    switch (per)
    {
    case 's': case 'ms': return per;
    case '%': case '%%': return '%';
    default: return '/'+per[0];
    }
};

// Takes a function or its string serialization (f.toString()), returns object:
//     name: declared name or null
//     args: array of declared argument names
//     body: function body excluding the outermost braces
// XXX: when necessary, add support for comments inside argument list,
// arrow functions, generator functions, rest parameters, default parameters,
// destructuring parameters
E.parse_function = function(f){
    var m = /^function\s*([\w$]+)?\s*\(\n?([\s\w$,]*?)(\s*\/\*`*\*\/)?\)\s*\{\n?([\s\S]*?)\n?\}$/
        .exec(f);
    return {
        name: m[1]||null,
        args: m[2] ? m[2].split(/\s*,\s*/) : [],
        body: m[4],
    };
};

function date_stringify(d){ return {__ISODate__: d.toISOString()}; }

var pos_inf = {__Infinity__: 1};
var neg_inf = {__Infinity__: -1};
function replace_inf(k, v){
    switch (v)
    {
    case Infinity: return pos_inf;
    case -Infinity: return neg_inf;
    default: return v;
    }
}

E.JSON_stringify = function(obj, opt){
    var s, prev_date, _date, prev_func, prev_re;
    var date_class, func_class, re_class;
    opt = opt||{};
    if (opt.date)
        _date = typeof opt.date=='function' ? opt.date : date_stringify;
    if (opt.mongo||opt.mongoku)
        _date = date_stringify;
    if (_date)
    {
        date_class = opt.vm_context ?
            vm.runInContext('Date', opt.vm_context) : Date;
        prev_date = date_class.prototype.toJSON;
        date_class.prototype.toJSON = function(){ return _date(this); };
    }
    if (opt.func)
    {
        func_class = opt.vm_context ?
            vm.runInContext('Function', opt.vm_context) : Function;
        prev_func = func_class.prototype.toJSON;
        func_class.prototype.toJSON = function(){
            return {__Function__: this.toString()}; };
    }
    if (opt.re)
    {
        re_class = opt.vm_context ?
            vm.runInContext('RegExp', opt.vm_context) : RegExp;
        prev_re = re_class.prototype.toJSON;
        Object.defineProperty(re_class.prototype, 'toJSON', {
            value: function(){ return {__RegExp__: this.toString()}; },
            writable: true,
        });
    }
    var opt_replacer = opt.replacer;
    var replacer = opt_replacer;
    if (opt.inf)
    {
        if (opt_replacer && typeof opt_replacer=='function')
        {
            replacer = function(k, v){
                if (this==pos_inf || this==neg_inf)
                    return v;
                // http://es5.github.io/#x15.12.3 replacer.call(this, k, v)
                return opt_replacer.call(this, k,
                    replace_inf.call(this, k, v));
            };
        }
        else if (opt_replacer && Array.isArray(opt_replacer))
        {
            replacer = function(k, v){
                // when replacer is an array - original object SHOULD be kept
                if (v==obj || this==pos_inf || this==neg_inf)
                    return v;
                if (opt_replacer.includes(k))
                    return replace_inf.call(this, k, v);
            };
        }
        else
            replacer = replace_inf;
    }
    if (opt.circular)
    {
        var ignore_circular = opt.circular=='ignore';
        var orig_replacer = replacer, keys = [], stack = [];
        replacer = function(k, v){
            if (stack.length)
            {
                var pos = stack.indexOf(this);
                if (pos>=0)
                {
                    stack.splice(pos+1);
                    keys.splice(pos, keys.length, k);
                }
                else
                {
                    stack.push(this);
                    keys.push(k);
                }
                pos = stack.indexOf(v);
                if (pos>=0)
                {
                    v = ignore_circular ? undefined :
                        {__Ref__: keys.slice(0, pos).join('.')};
                }
            }
            else
                stack.push(v);
            return orig_replacer ? orig_replacer.call(this, k, v) : v;
        };
    }
    try { s = JSON.stringify(obj, replacer, opt.spaces); }
    finally {
        if (_date)
            date_class.prototype.toJSON = prev_date;
        if (opt.func)
            func_class.prototype.toJSON = prev_func;
        if (opt.re)
            re_class.prototype.toJSON = prev_re;
    }
    if (opt.mongo||opt.mongoku)
    {
        s = s.replace(/\{"__ISODate__":("[0-9TZ:.-]+")\}/g,
            opt.mongoku ? 'Date($1)' : 'ISODate($1)');
    }
    return s;
};

function parse_leaf(v, opt){
    if (!v || typeof v!='object' || Object.keys(v).length!=1)
        return v;
    if (v.__ISODate__ && opt.date)
        return new Date(v.__ISODate__);
    if (v.__Function__ && opt.func)
    {
        if (vm)
            return vm.runInThisContext('"use strict";('+v.__Function__+')');
        // fallback for browser environment
        return new Function('', '"use strict";return ('+v.__Function__+');')();
    }
    if (v.__RegExp__ && opt.re)
    {
        var parsed = /^\/(.*)\/(\w*)$/.exec(v.__RegExp__);
        if (!parsed)
            throw new Error('failed parsing regexp');
        return new RegExp(parsed[1], parsed[2]);
    }
    if (v.__Infinity__ && opt.inf)
        return v.__Infinity__ < 0 ? -Infinity : Infinity;
    if (v.__ObjectId__ && typeof opt.object_id=='function')
        return opt.object_id(v.__ObjectId__);
    return v;
}

function parse_obj(v, opt){
    if (!v || typeof v!='object')
        return v;
    if (Array.isArray(v))
    {
        for (var i = 0; i<v.length; i++)
            v[i] = parse_obj(v[i], opt);
        return v;
    }
    var v2 = parse_leaf(v, opt);
    if (v2!==v)
        return v2;
    for (var key in v)
        v[key] = parse_obj(v[key], opt);
    return v;
}

function traverse_obj(obj, key, parent, cb){
    cb(obj, key, parent);
    if (!obj || typeof obj!='object')
        return;
    for (var k in obj)
        traverse_obj(obj[k], k, obj, cb);
}

function deref_obj(obj){
    traverse_obj(obj, null, null, function(v, key, parent){
        if (v && typeof v.__Ref__=='string')
            parent[key] = zutil.get(obj, v.__Ref__);
    });
}

E.JSON_parse = function(s, opt){
    opt = Object.assign({date: true, re: true, func: true, inf: true,
        circular: true}, opt);
    var has_circular, ret = {};
    var reviver = function(k, v){
        v = parse_leaf(v, opt);
        if (v && typeof v.__Ref__=='string')
            has_circular = true;
        return v;
    };
    try {
        ret = JSON.parse(s, reviver);
    } catch(e){
        if (!opt.date)
            throw e;
        ret = JSON.parse(JSON.stringify(s), reviver);
    }
    if (has_circular && opt.circular)
        deref_obj(ret);
    return ret;
};

E.JSON_parse_obj = function(v, opt){
    opt = Object.assign({date: true, re: true, func: true, inf: true}, opt);
    return parse_obj(v, opt);
};

E.mongo_funcs_to_conv_json = function(str){
    str = str.replace(/ISODate\(['"]([^'"]+)['"]\)/g, function(x, v){
        if (!date.is_date_like(v))
            return x;
        return '{__ISODate__:"'+date(v).toISOString()+'"}';
    });
    str = str.replace(/ObjectId\(['"]([^'"]+)['"]\)/g, function(x, v){
        return '{__ObjectId__:"'+v+'"}';
    });
    return str;
};

E.hex2bin = function(hex, opt){
    var byte_array = opt && opt.byte_array;
    var bin = byte_array ? new Uint8Array() : [];
    var re = /('.)|([0-9a-f][0-9a-f]?)|\s+|[.-]|(.)/gi;
    var m, v;
    for (re.lastIndex = 0; m = re.exec(hex);)
    {
        if (m[1])
            v = m[1].charCodeAt(1);
        else if (m[2])
            v = parseInt(m[2], 16);
        else if (m[3])
            return null; // throw new Error('invalid hex code');
        else
            continue;
        bin.push(v);
    }
    return bin;
};

E.bin2hex = function(arr){
    var s = '', v, i;
    for (i=0; i<arr.length; i++)
    {
        v = (arr[i]&0xff).toString(16).toUpperCase();
        s += (v.length<2 ? '0' : '')+v+' ';
    }
    return s.trim();
};

E.str2bin = function(s, offset){
    var len;
    if (!s || !(len = s.length))
        return;
    offset = offset||0;
    var arr = new Uint8Array(len-offset);
    for (var i=offset, j=0; i<len; i++, j++)
        arr[j] = s.charCodeAt(i);
    return arr;
};

E.tab2sp = function(line){
     var added = 0;
     return line.replace(/\t/g, function(m, offset, str){
         var insert = 8-(added+offset)%8;
         added += insert-1;
         return ' '.repeat(insert);
     });
};

E.str2utf8bin = function(s){
    if (!s||!s.length)
        return;
    var arr = new Uint8Array(s.length*3);
    var len = s.length, i = 0, j = 0, c, extra;
    while (i<len)
    {
        c = s.charCodeAt(i++);
        if (c >= 0xD800 && c <= 0xDBFF && i < len)
        {
            extra = s.charCodeAt(i++);
            if ((extra & 0xFC00) == 0xDC00)
                c = ((c & 0x3FF) << 10) + (extra & 0x3FF) + 0x10000;
            else
                i--;
        }
        if ((c & 0xFFFFFF80) == 0)
            arr[j++] = c;
        else
        {
            if ((c & 0xFFFFF800) == 0)
                arr[j++] = c >> 6 & 0x1F | 0xC0;
            else if ((c & 0xFFFF0000) == 0)
            {
                arr[j++] = c >> 12 & 0x0F | 0xE0;
                arr[j++] = c >> 6 & 0x3F | 0x80;
            }
            else if ((c & 0xFFE00000) == 0)
            {
                arr[j++] = c >> 18 & 0x07 | 0xF0;
                arr[j++] = c >> 12 & 0x3F | 0x80;
                arr[j++] = c >> 6 & 0x3F | 0x80;
            }
            arr[j++] = c & 0x3F | 0x80;
        }
    }
    return arr.slice(0, j);
};

E.utf8bin2str = function(arr, offset, len){
    if (arr.byteLength&&!arr.length)
        arr = new Uint8Array(arr);
    var out = '', i = offset||0, cp;
    var c, char2, char3, char4;
    len = len ? i+len : arr.length;
    while (i<len)
    {
        c = arr[i++];
        switch (c >> 4)
        {
        case 0: case 1: case 2: case 3: case 4: case 5: case 6: case 7:
            // 0xxxxxxx
            out += String.fromCharCode(c);
            break;
        case 12: case 13:
            // 110x xxxx   10xx xxxx
            char2 = arr[i++];
            out += String.fromCharCode((c & 0x1F) << 6 | char2 & 0x3F);
            break;
        case 14:
            // 1110 xxxx  10xx xxxx  10xx xxxx
            char2 = arr[i++];
            char3 = arr[i++];
            out += String.fromCharCode((c & 0x0F) << 12 |
                (char2 & 0x3F) << 6 |
                (char3 & 0x3F) << 0);
            break;
        case 15:
            char2 = arr[i++];
            char3 = arr[i++];
            char4 = arr[i++];
            cp = (c & 0x03) << 18 | (char2 & 0x3F) << 12 |
                (char3 & 0x3F) << 6 | char4 & 0x3F;
            cp -= 0x10000;
            out += String.fromCharCode(0xD800|cp>>10);
            out += String.fromCharCode(0xDC00|cp&0x3ff);
            break;
        }
    }
    return out;
};

E.mask_uuid = function(s){
    return s.substring(0, s.length-32)+s.substring(s.length-8);
};

return E; }); }());
