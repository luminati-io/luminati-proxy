// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, browser:true*/
(function(){
var define;
var is_node_ff = typeof module=='object' && module.exports;
if (!is_node_ff)
    define = self.define;
else
    define = require('./require_node.js').define(module, '../');
define([], function(){
var E = {};

var proto_slice = Array.prototype.slice;
E.copy = function(a){
    switch (a.length)
    {
    case 0: return [];
    case 1: return [a[0]];
    case 2: return [a[0], a[1]];
    case 3: return [a[0], a[1], a[2]];
    case 4: return [a[0], a[1], a[2], a[3]];
    case 5: return [a[0], a[1], a[2], a[3], a[4]];
    default: return proto_slice.call(a);
    }
};

E.push = function(a){
    for (var i=1; i<arguments.length; i++)
    {
        var arg = arguments[i];
        if (Array.isArray(arg))
            a.push.apply(a, arg);
        else
            a.push(arg);
    }
    return a.length;
};
E.unshift = function(a){
    for (var i=arguments.length-1; i>0; i--)
    {
        var arg = arguments[i];
        if (Array.isArray(arg))
            a.unshift.apply(a, arg);
        else
            a.unshift(arg);
    }
    return a.length;
};

E.slice = function(args, from, to){
    return Array.prototype.slice.call(args, from, to); };

E.compact = function(a){ return E.compact_self(a.slice()); };
E.compact_self = function(a){
    var i, j, n = a.length;
    for (i=0; i<n && a[i]; i++);
    if (i==n)
        return a;
    for (j=i; i<n; i++)
    {
        if (!a[i])
            continue;
        a[j++] = a[i];
    }
    a.length = j;
    return a;
};

// same as _.flatten(a, true)
E.flatten_shallow = function(a){ return Array.prototype.concat.apply([], a); };
E.flatten = function(a){
    var _a = [], i;
    for (i=0; i<a.length; i++)
    {
        if (Array.isArray(a[i]))
            Array.prototype.push.apply(_a, E.flatten(a[i]));
        else
            _a.push(a[i]);
    }
    return _a;
};
E.flat_map = function(a, cb){
    if (a.flatMap)
        return a.flatMap(cb);
    return Array.prototype.concat.apply([], a.map(cb));
};

E.unique = function(a){
    var _a = [];
    for (var i=0; i<a.length; i++)
    {
        if (!_a.includes(a[i]))
            _a.push(a[i]);
    }
    return _a;
};
E.to_nl = function(a, sep){
    if (!a || !a.length)
        return '';
    if (sep===undefined)
        sep = '\n';
    return a.join(sep)+sep;
};
E.sed = function(a, regex, replace){
    var _a = new Array(a.length), i;
    for (i=0; i<a.length; i++)
        _a[i] = a[i].replace(regex, replace);
    return _a;
};
E.grep = function(a, regex, replace){
    var _a = [], i;
    for (i=0; i<a.length; i++)
    {
        // don't use regex.test() since with //g sticky tag it does not reset
        if (a[i].search(regex)<0)
            continue;
        if (replace!==undefined)
            _a.push(a[i].replace(regex, replace));
        else
            _a.push(a[i]);
    }
    return _a;
};

E.rm_elm = function(a, elm){
    var i = a.indexOf(elm);
    if (i<0)
        return;
    a.splice(i, 1);
    return elm;
};

E.rm_elm_tail = function(a, elm){
    var i = a.length-1;
    if (elm===a[i]) // fast-path
    {
        a.pop();
        return elm;
    }
    if ((i = a.lastIndexOf(elm, i-1))<0)
        return;
    a.splice(i, 1);
    return elm;
};

E.add_elm = function(a, elm){
    if (a.includes(elm))
        return;
    a.push(elm);
    return elm;
};

E.split_every = function(a, n){
    var ret = [];
    for (var i=0; i<a.length; i+=n)
        ret.push(a.slice(i, i+n));
    return ret;
};

E.split_at = function(a, delim){
    var ret = [];
    delim = delim||'';
    for (var i=0; i<a.length; i++)
    {
        var chunk = [];
        for (; i<a.length && a[i]!=delim; i++)
            chunk.push(a[i]);
        if (chunk.length)
            ret.push(chunk);
    }
    return ret;
};

E.rotate = function(a, n){
    if (a && a.length>1 && (n = n%a.length))
        E.unshift(a, a.splice(n));
    return a;
};

E.move = function(a, from, to, n){
    return Array.prototype.splice.apply(a, [to, n]
        .concat(a.slice(from, from+n)));
};

E.to_array = function(v){ return Array.isArray(v) ? v : v==null ? [] : [v]; };

var proto = {};
proto.sed = function(regex, replace){
    return E.sed(this, regex, replace); };
proto.grep = function(regex, replace){
    return E.grep(this, regex, replace); };
proto.to_nl = function(sep){ return E.to_nl(this, sep); };
proto.push_a = function(){
    return E.push.apply(null, [this].concat(Array.from(arguments))); };
proto.unshift_a = function(){
    return E.unshift.apply(null, [this].concat(Array.from(arguments))); };
var installed;
E.prototype_install = function(){
    if (installed)
        return;
    installed = true;
    for (var i in proto)
    {
        Object.defineProperty(Array.prototype, i,
            {value: proto[i], configurable: true, enumerable: false,
            writable: true});
    }
};
E.prototype_uninstall = function(){
    if (!installed)
        return;
    installed = false;
    // XXX sergey: store orig proto, then load it back
    for (var i in proto)
        delete Array.prototype[i];
};
return E; }); }());
