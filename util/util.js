// LICENSE_CODE ZON ISC
'use strict'; /*zlint node, br*/
(function(){
var define, node_util;
var is_node = typeof module=='object' && module.exports && module.children;
var is_rn = (typeof global=='object' && !!global.nativeRequire) ||
    (typeof navigator=='object' && navigator.product=='ReactNative');
var is_ff_addon = typeof module=='object' && module.uri
    && !module.uri.indexOf('resource://');
if (is_ff_addon)
    define = require('./require_node.js').define(module, '../');
else if (is_rn)
{
    define = require('./require_node.js').define(module, '../',
        require('/util/array.js'));
}
else if (!is_node)
    define = self.define;
else
{
    node_util = require('util');
    define = require('./require_node.js').define(module, '../');
}
define(['/util/array.js'], function(array){
var E = {};

E._is_mocha = undefined;
E.is_mocha = function(){
    if (E._is_mocha!==undefined)
        return E._is_mocha;
    if (typeof process!='undefined' && typeof process.env!='undefined')
        return E._is_mocha = process.env.IS_MOCHA||false;
    return E._is_mocha = false;
};

E.is_lxc = function(){ return is_node && +process.env.LXC; };

E.f_mset = function(flags, mask, bits){ return (flags &~ mask) | bits; };
E.f_lset = function(flags, bits, logic){
    return E.f_mset(flags, bits, logic ? bits : 0); };
E.f_meq = function(flags, mask, bits){ return (flags & mask)==bits; };
E.f_eq = function(flags, bits){ return (flags & bits)==bits; };
E.f_cmp = function(f1, f2, mask){ return (f1 & mask)==(f2 & mask); };
E.xor = function(a, b){ return !a != !b; };
E.div_ceil = function(a, b){ return Math.floor((a+b-1)/b); };
E.ceil_mul = function(a, b){ return E.div_ceil(a, b)*b; };
E.floor_mul = function(a, b){ return Math.floor(a/b)*b; };

E.range = function(x, a, b){ return x>=a && x<=b; };
E.range.ii = function(x, a, b){ return x>=a && x<=b; };
E.range.ie = function(x, a, b){ return x>=a && x<b; };
E.range.ei = function(x, a, b){ return x>a && x<=b; };
E.range.ee = function(x, a, b){ return x>a && x<b; };

E.clamp = function(lower_bound, value, upper_bound){
    if (value < lower_bound)
        return lower_bound;
    if (value < upper_bound)
        return value;
    return upper_bound;
};

E.revcmp = function(a, b){
    return a>b ? -1 : a<b ? 1 : 0; };

/* Union given objects, using fn to resolve conflicting keys */
E.union_with = function(fn /*[o1, [o2, [...]]]*/){
    var res = {}, args;
    if (arguments.length==2 && typeof arguments[1]=='object')
        args = arguments[1];
    else
        args = array.slice(arguments, 1);
    for (var i = 0; i < args.length; ++i)
    {
        for (var key in args[i])
        {
            var arg = args[i];
            res[key] = res.hasOwnProperty(key) ? fn(res[key], arg[key])
                : arg[key];
        }
    }
    return res;
};

function _clone_deep(obj){
    var i, n, ret;
    if (obj instanceof Array)
    {
        ret = new Array(obj.length);
        n = obj.length;
        for (i = 0; i < n; i++)
            ret[i] = obj[i] instanceof Object ? _clone_deep(obj[i]): obj[i];
        return ret;
    }
    else if (obj instanceof Date)
        return new Date(obj);
    else if (obj instanceof RegExp)
        return new RegExp(obj);
    else if (obj instanceof Function)
        return obj;
    ret = {};
    for (i in obj)
        ret[i] = obj[i] instanceof Object ? _clone_deep(obj[i]) : obj[i];
    return ret;
}

E.clone_deep = function(obj){
    if (!(obj instanceof Object))
        return obj;
    return _clone_deep(obj);
};

// prefer to normally Object.assign() instead of extend()
E.extend = function(obj){ // like _.extend
    for (var i=1; i<arguments.length; i++)
    {
        var source = arguments[i];
        if (!source)
            continue;
        for (var prop in source)
            obj[prop] = source[prop];
    }
    return obj;
};

function is_object(obj){
    return obj && obj.constructor==Object; }

E.extend_deep = function(obj){
    if (!is_object(obj))
        return obj;
    for (var i=1; i<arguments.length; i++)
    {
        var source = arguments[i];
        if (!source)
            continue;
        for (var prop in source)
        {
            if (is_object(source[prop]) && is_object(obj[prop]))
                E.extend_deep(obj[prop], source[prop]);
            else
                obj[prop] = source[prop];
        }
    }
    return obj;
};
E.extend_deep_del_null = function(obj){
    for (var i=1; i<arguments.length; i++)
    {
        var source = arguments[i];
        if (!source)
            continue;
        for (var prop in source)
        {
            if (is_object(source[prop]))
            {
                if (!is_object(obj[prop]))
                    obj[prop] = {};
                E.extend_deep_del_null(obj[prop], source[prop]);
            }
            else if (source[prop]==null)
                delete obj[prop];
            else
                obj[prop] = source[prop];
        }
    }
    return obj;
};

E.defaults = function(obj){ // like _.defaults
    if (!obj)
        obj = {};
    for (var i=1; i<arguments.length; i++)
    {
        var source = arguments[i];
        if (obj===undefined)
            continue;
        for (var prop in source)
        {
            if (obj[prop]===undefined)
                obj[prop] = source[prop];
        }
    }
    return obj;
};
E.defaults_deep = function(obj){
    if (obj!==undefined && !is_object(obj))
        return obj;
    for (var i=1; i<arguments.length; i++)
    {
        var source = arguments[i];
        if (obj===undefined)
            obj = E.clone_deep(source);
        else if (is_object(source))
        {
            for (var prop in source)
            {
                var s = source[prop], d = obj[prop];
                if (d===undefined)
                    obj[prop] = E.clone_deep(s);
                else
                    E.defaults_deep(d, s);
            }
        }
    }
    return obj;
};

E.clone = function(obj){ // like _.clone
    if (!(obj instanceof Object))
        return obj;
    if (obj instanceof Array)
    {
        var a = new Array(obj.length);
        for (var i=0; i<obj.length; i++)
            a[i] = obj[i];
        return a;
    }
    return E.extend({}, obj);
};

E.freeze_deep = function(obj){
    if (typeof obj=='object')
    {
        for (var prop in obj)
        {
            if (obj.hasOwnProperty(prop))
                E.freeze_deep(obj[prop]);
        }
    }
    return Object.freeze(obj);
};

// Limitations:
// We know that not every data type can be reliably compared for equivalence
// (other than with ===). In equal_deep, we try to be conservative, returning
// false when we cannot be sure. Functions, however, are compared by their
// string serializations, which can lead to conflation of distinct closures.
// Cyclic references are not supported (cause a stack overflow).
E.equal_deep = function(a, b){
    var i;
    if (a===b)
        return true;
    if (!a || !b || a.constructor!==b.constructor)
        return false;
    if (a instanceof Function || a instanceof RegExp)
        return a.toString()==b.toString();
    if (a instanceof Date)
        return +a == +b;
    if (Array.isArray(a))
    {
        if (a.length!=b.length)
            return false;
        for (i = 0; i<a.length; i++)
        {
            if (!E.equal_deep(a[i], b[i]))
                return false;
        }
        return true;
    }
    if (is_object(a))
    {
        var a_keys = Object.keys(a), b_keys = Object.keys(b);
        if (a_keys.length!=b_keys.length)
            return false;
        for (i = 0; i<a_keys.length; i++)
        {
            var key = a_keys[i];
            if (!E.equal_deep(a[key], b[key]))
                return false;
        }
        return true;
    }
    return false;
};

// like _.map() except returns object, not array
E.map_obj = function(obj, fn){
    var ret = {};
    for (var i in obj)
        ret[i] = fn(obj[i], i, obj);
    return ret;
};

// recursivelly recreate objects with keys added in order
E.sort_obj = function(obj, fn){
    if (obj instanceof Array || !(obj instanceof Object))
        return obj;
    var ret = {}, keys = Object.keys(obj).sort(fn);
    for (var i=0; i<keys.length; i++)
        ret[keys[i]] = E.sort_obj(obj[keys[i]], fn);
    return ret;
};

// an Object equivalent of Array.prototype.forEach
E.forEach = function(obj, fn, _this){
    for (var i in obj)
        fn.call(_this, obj[i], i, obj);
};
// an Object equivalent of Array.prototype.find
E.find = function(obj, fn, _this){
    for (var i in obj)
    {
        if (fn.call(_this, obj[i], i, obj))
            return obj[i];
    }
};
E.find_prop = function(obj, prop, val){
    return E.find(obj, function(o){ return o[prop]===val; }); };
E.isspace = function(c){ return /\s/.test(c); };
E.isdigit = function(c){ return c>='0' && c<='9'; };
E.isalpha = function(c){ return (c>='a' && c<='z') || (c>='A' && c<='Z'); };
E.isalnum = function(c){ return E.isdigit(c)||E.isalpha(c); };

E.obj_pluck = function(obj, prop){
    var val = obj[prop];
    delete obj[prop];
    return val;
};

// Object.keys() does not work on prototype
E.proto_keys = function(proto){
    var keys = [];
    for (var i in proto)
        keys.push(i);
    return keys;
};

E.values = function(obj){
    var values = [];
    for (var i in obj)
        values.push(obj[i]);
    return values;
};

E.path = function(path){
    if (Array.isArray(path))
        return path;
    path = ''+path;
    if (!path)
        return [];
    return path.split('.');
};
E.get = function(o, path, def){
    path = E.path(path);
    for (var i=0; i<path.length; i++)
    {
        // XXX vladimir/ron: decide on implementation without in operator
        if (!o || (typeof o!='object' && typeof o!='function') ||
            !(path[i] in o))
        {
            return def;
        }
        o = o[path[i]];
    }
    return o;
};
E.set = function(o, path, value){
    path = E.path(path);
    for (var i=0; i<path.length-1; i++)
    {
        var p = path[i];
        o = o[p] || (o[p] = {});
    }
    o[path[path.length-1]] = value;
};
E.unset = function(o, path){
    path = E.path(path);
    for (var i=0; i<path.length-1; i++)
    {
        var p = path[i];
        if (!o[p])
            return;
        o = o[p];
    }
    delete o[path[path.length-1]];
};
var has_unique = {};
E.has = function(o, path){ return E.get(o, path, has_unique)!==has_unique; };
E.own = function(o, prop){
    return Object.prototype.hasOwnProperty.call(o, prop); };

E.bool_lookup = function(a, split){
    var ret = {}, i;
    if (typeof a=='string')
        a = a.split(split||/\s/);
    for (i=0; i<a.length; i++)
        ret[a[i]] = true;
    return ret;
};

E.clone_inplace = function(dst, src){
    if (dst===src)
        return dst;
    if (Array.isArray(dst))
    {
        for (var i=0; i<src.length; i++)
            dst[i] = src[i];
        dst.splice(src.length);
    }
    else if (typeof dst=='object')
    {
        for (var k in src)
            dst[k] = src[k];
        for (k in dst)
        {
            if (!src.hasOwnProperty(k))
                delete dst[k];
        }
    }
    return dst;
};

if (node_util && node_util.inherits)
    E.inherits = node_util.inherits;
else
{
    // implementation from node.js 'util' module
    E.inherits = function inherits(ctor, superCtor){
        ctor.super_ = superCtor;
        ctor.prototype = Object.create(superCtor.prototype,
            {constructor: {value: ctor, enumerable: false, writable: true,
            configurable: true}});
    };
}

// ctor must only have one prototype level
// XXX vladislav: ES6 class is not supported for ctor
E.inherit_init = function(obj, ctor, params){
    var orig_proto = Object.getPrototypeOf(obj);
    var ctor_proto = Object.assign({}, ctor.prototype);
    Object.setPrototypeOf(ctor_proto, orig_proto);
    Object.setPrototypeOf(obj, ctor_proto);
    return ctor.apply(obj, params);
};

E.pick = function(obj){
    var i, o = {};
    for (i=1; i<arguments.length; i++)
    {
        if (E.own(obj, arguments[i]))
            o[arguments[i]] = obj[arguments[i]];
    }
    return o;
};

// subset of _.omit
E.omit = function(obj, omit){
    var i, o = {};
    obj = Object(obj);
    for (i in obj)
    {
        if (!omit.includes(i))
            o[i] = obj[i];
    }
    return o;
};

return E; }); }());
