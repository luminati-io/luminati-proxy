// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, browser:true, es6:true*/
(function(){
var define, node_util;
var is_node = typeof module=='object' && module.exports && module.children &&
    typeof __webpack_require__!='function';
var is_rn = typeof global=='object' && !!global.nativeRequire ||
    typeof navigator=='object' && navigator.product=='ReactNative';
if (is_rn)
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

E.f_mset = function(flags, mask, bits){ return flags&~mask | bits; };
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
E.union_with = function(fn /* [o1, [o2, [...]]]*/){
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
    else if (obj instanceof URL)
        return new URL(obj);
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

E.is_object = function(obj){
    return obj && obj.constructor==Object;
};

E.extend_deep = function(obj){
    if (!E.is_object(obj))
        return obj;
    for (var i=1; i<arguments.length; i++)
    {
        var source = arguments[i];
        if (!source)
            continue;
        for (var prop in source)
        {
            if (E.is_object(source[prop]) && E.is_object(obj[prop]))
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
            if (E.is_object(source[prop]))
            {
                if (!E.is_object(obj[prop]))
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
    if (obj!==undefined && !E.is_object(obj))
        return obj;
    for (var i=1; i<arguments.length; i++)
    {
        var source = arguments[i];
        if (obj===undefined)
            obj = E.clone_deep(source);
        else if (E.is_object(source))
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
    if (E.is_object(a))
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
E.isalpha = function(c){ return c>='a'&&c<='z' || c>='A'&&c<='Z'; };
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
        if (!o || typeof o!='object'&&typeof o!='function' || !(path[i] in o))
            return def;
        o = o[path[i]];
    }
    return o;
};
E.set = function(o, path, value){
    var orig = o;
    path = E.path(path);
    for (var i=0; i<path.length-1; i++)
    {
        var p = path[i];
        o = o[p] || (o[p] = {});
    }
    o[path[path.length-1]] = value;
    return orig;
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
    return o!=null && Object.prototype.hasOwnProperty.call(o, prop); };

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
        var k;
        for (k in src)
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
    var i, j, o = {};
    for (i=1; i<arguments.length; i++)
    {
        var fields = E.ensure_array(arguments[i]);
        for (j=0; j<fields.length; j++)
        {
            if (E.own(obj, fields[j]))
                o[fields[j]] = obj[fields[j]];
        }
    }
    return o;
};

// like _.pickBy
E.pick_by = function(obj, cb){
    var k, o = {};
    for (k in obj)
    {
        if (typeof obj[k] == 'object' && !Array.isArray(obj[k]))
            o[k] = E.pick_by(obj[k], cb);
        else if (cb(obj[k], k))
            o[k] = obj[k];
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

E.if_set = function(val, o, name){
    if (val!==undefined)
        o[name] = val;
};

E.escape_dotted_keys = function(obj, repl){
    if (!Array.isArray(obj) && !E.is_object(obj))
        return obj;
    repl = repl||'_';
    for (var prop in obj)
    {
        if (E.own(obj, prop))
        {
            var new_prop = prop.replace(/\./g, repl);
            if (prop != new_prop)
            {
                obj[new_prop] = obj[prop];
                delete obj[prop];
            }
            if (Array.isArray(obj[new_prop]))
            {
                obj[new_prop].forEach(function(e){
                    E.escape_dotted_keys(e, repl);
                });
            }
            else if (E.is_object(obj[new_prop]))
                E.escape_dotted_keys(obj[new_prop], repl);
        }
    }
};

E.ensure_array = function(v, split){
    if (v==null || Array.isArray(v))
        return v||[];
    if (split && typeof v=='string')
        return v.split(split==true ? /[\s,]+/ : split).filter(Boolean);
    return [v];
};

E.reduce_obj = function(coll, key_cb, val_cb, merge_cb){
    if (coll==null)
        return {};
    if (val_cb===undefined && key_cb!=null && (key_cb.key||key_cb.value))
    {
        merge_cb = key_cb.merge;
        val_cb = key_cb.value;
        key_cb = key_cb.key;
    }
    key_cb = get_map_fn(key_cb);
    val_cb = get_map_fn(val_cb);
    var obj = {};
    if (Array.isArray(coll))
    {
        coll.forEach(function(item, i){
            var k = key_cb(item, i), v = val_cb(item, i);
            if (k===undefined || v===undefined)
                return;
            if (obj[k]!==undefined && merge_cb)
                v = merge_cb(obj[k], v);
            obj[k] = v;
        });
    }
    else if (typeof coll=='object')
    {
        Object.keys(coll).forEach(function(i){
            var k = key_cb(coll[i], i), v = val_cb(coll[i], i);
            if (k===undefined || v===undefined)
                return;
            if (obj[k]!==undefined && merge_cb)
                v = merge_cb(obj[k], v);
            obj[k] = v;
        });
    }
    return obj;
};

E.group_by = function(coll, key_cb, val_cb){
    var inner_val_cb = get_map_fn(val_cb);
    val_cb = function(it){ return [inner_val_cb(it)]; };
    var merge_cb = function(a, b){ return a.concat(b); };
    return E.reduce_obj(coll, key_cb, val_cb, merge_cb);
};

E.flatten_obj = function(obj){
    if (!E.is_object(obj) && !Array.isArray(obj))
        return obj;
    var res = {}, k, keys = Object.keys(obj);
    for (var i = 0; i < keys.length; i++)
    {
        k = keys[i];
        if (!E.is_object(obj[k]) && !Array.isArray(obj[k]))
            res[k] = obj[k];
        else
        {
            var o = E.flatten_obj(obj[k]), _keys = Object.keys(o);
            for (var j = 0; j < _keys.length; j++)
                res[k+'_'+_keys[j]] = o[_keys[j]];
        }
    }
    return res;
};

E.pairwise = function(coll, opt){
    if (!Array.isArray(coll) || coll.length<2)
        return;
    opt = opt||{};
    var res = [];
    for (var i = 0; i < coll.length; i++)
    {
        for (var j = i+1; j < coll.length; j++)
        {
            if (opt.balanced)
                res.push((i+j)%2 ? [coll[i], coll[j]] : [coll[j], coll[i]]);
            else
                res.push([coll[i], coll[j]]);
        }
    }
    return res;
};

E.stackless_error = function(msg, extra, Err_f){
    if (!Err_f && typeof extra=='function')
    {
        Err_f = extra;
        extra = undefined;
    }
    Err_f = Err_f || Error;
    const old_lmt = Error.stackTraceLimit;
    Error.stackTraceLimit = 0;
    const err = Object.assign(new Err_f(msg), extra);
    Error.stackTraceLimit = old_lmt;
    return err;
};

E.omit_falsy_props = function(o){
    return Object.fromEntries(Object.entries(o).filter(function(arg){
        return ![null, undefined, ''].includes(arg[1]);
    }));
};

// XXX: drop once jshint version supports BigInt (esversion >= 11)
/* jshint -W119 */
E.object_sizeof = obj=>Buffer.byteLength(
    JSON.stringify(obj, (_k, v)=>typeof v=='bigint' ? Number(v) : v));
/* jshint +W119 */

function get_map_fn(v){
    if (v==null)
        return function(it){ return it; };
    if (typeof v=='function')
        return v;
    var path = E.path(v);
    if (!path.length)
        return function(it){ return it; };
    if (path.length==1)
        return function(it){ return it==null ? it : it[path[0]]; };
    return function(it){ return E.get(it, path); };
}

return E; }); }());
