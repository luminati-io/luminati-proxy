// LICENSE_CODE ZON ISC
'use strict'; /*zlint node, br*/
(function(){
var define;
var is_node_ff = typeof module=='object' && module.exports;
var is_rn = (typeof global=='object' && !!global.nativeRequire) ||
    (typeof navigator=='object' && navigator.product=='ReactNative');
if (is_rn)
{
    define = require('./require_node.js').define(module, '../',
        require('/util/array.js'));
}
else if (is_node_ff)
    define = require('./require_node.js').define(module, '../');
else
    define = self.define;
define(['/util/array.js'], function(array){
var E = {};

E.rm_empty_last = function(a){
    if (a[a.length-1]==='')
        a.pop();
    return a;
};
E.split_trim = function(s, sep, limit){
    return array.compact_self(s.split(sep, limit)); };
E.split_ws = function(s){ return E.split_trim(s, /\s+/); };
E.qw = function(s){
    if (Array.isArray(s) && !s.raw)
        return s;
    return E.split_ws(!Array.isArray(s) ? s : E.es6_str(arguments));
};
E.chomp = function(s){ return s.replace(/\n$/, ''); };
E.split_crlf = function(s){
    return E.rm_empty_last(s.split(/\r?\n/)); };
E.split_nl = function(s){
    return E.rm_empty_last(s.split('\n')); };
E.to_array_buffer = function(s){
    var buf = new ArrayBuffer(s.length), buf_view = new Uint8Array(buf), i;
    for (i=0; i<s.length; i++)
        buf_view[i] = s.charCodeAt(i);
    return buf;
};
E.from_array_buffer = function(buf){
    return String.fromCharCode.apply(null, new Uint8Array(buf)); };
E.capitalize = function(s){
    s = ''+s;
    return (s[0]||'').toUpperCase()+s.slice(1);
};
E.trunc = function(s, len){
    if (s.length<=len)
        return s;
    return s.slice(0, len)+'...';
};
// es6 template
E.template = function(strings){
    var keys = Array.prototype.slice.call(arguments, 1);
    return function(){
        var values = arguments;
        var dict = values[values.length-1]||{};
        var result = [strings[0]];
        keys.forEach(function(key, i){
            var value = Number.isInteger(key) ? values[key] : dict[key];
            result.push(value, strings[i+1]);
        });
        return result.join('');
    };
};
E.es6_str = function(args){
    var parts = args[0], s = '';
    if (!Array.isArray(parts))
        return parts;
    s += parts[0];
    for (var i = 1; i<parts.length; i++)
    {
        s += args[i];
        s += parts[i];
    }
    return s;
};

// align paragraph to the left
E.align = function(){
    var str = E.es6_str(arguments), lines = str.split('\n');
    if (!lines[0])
        lines.shift();
    var spaces = Infinity;
    for (var i=0; i<lines.length; i++)
    {
        var space = lines[i].match(/^\s*/)[0];
        if (space.length==lines[i].length)
            space = lines[i] = '';
        else
            spaces = Math.min(spaces, space.length);
    }
    if (spaces>0 && spaces!=Infinity)
        lines = array.sed(lines, new RegExp('^ {'+spaces+'}'), '');
    return lines.join('\n');
};
// merge lines
E.nl2sp = function(){ return E.es6_str(arguments).replace(/\n\s*/g, ' '); };

// V8 often keeps large strings in memory when only a short substring is
// referenced, see https://bugs.chromium.org/p/v8/issues/detail?id=2869
// This function forces V8 to make a copy and release the parent string.
E.detach = function(s){ return (' '+s).slice(1); };

E.hash = function(s){
    var hash = 0;
    for (var i = 0, l = s.length; i<l; i++)
        hash = (hash<<5) - hash + s.charCodeAt(i) >>> 0;
    return hash;
};

var alphabet = '0123456789abcdefghijklmnopqrstuvwxyz';
E.generate = function(len){
    len = len||12;
    var ret = '';
    for (var i=0; i<len; i++)
        ret += alphabet[Math.random()*alphabet.length|0];
    return ret;
};

// longest string among arguments
E.longest = function(){
    var i, s;
    for (i=0; i<arguments.length; i++)
        s = (arguments[i]||'').length>(s||'').length ? arguments[i] : s;
    return s;
};

return E; }); }());
