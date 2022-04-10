// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, browser:true*/
(function(){
var define;
var is_node = typeof module=='object' && module.exports && module.children;
if (!is_node)
    define = self.define;
else
    define = require('./require_node.js').define(module, '../');
define(['/util/array.js'], function(array){
var E = {};

var is_jtest = false;
var jtest_vals = {};
var MAX_INT = 2147483647;
var MIN_INT = -MAX_INT-1;

function jtest_pop(s){
    var elm;
    if (s===undefined)
        return null;
    if ((elm = jtest_vals[s])===undefined)
        return null;
    return elm.shift();
}

E.rand = function(s){
    var ret;
    if (is_jtest && (ret = jtest_pop(s))!==null)
        return ret;
    return Math.random();
};

E.rand_int32 = function(s){
    var ret;
    if (is_jtest && (ret = jtest_pop(s))!==null)
        return ret;
    return Math.floor(Math.random()*(MAX_INT-MIN_INT+1))-MAX_INT;
};

// return a rand number from "min" to "max-1"
E.rand_range = function(min, max, s){
    var ret;
    if (is_jtest && (ret = jtest_pop(s))!==null)
        return ret;
    return Math.floor(Math.random()*(max-min))+min;
};

E.rand_element = function(a, s){
    if (a.length)
        return a[E.rand_range(0, a.length, s)];
};

E.rand_subset = function(a, size, s){
    // Fisher-Yates-Knuth shuffle
    var shuffled = a.slice(0);
    for (var i=0; i<size; i++)
    {
        var j = E.rand_range(i, shuffled.length, s);
        var tmp = shuffled[j];
        shuffled[j] = shuffled[i];
        shuffled[i] = tmp;
    }
    return shuffled.slice(0, size);
};

E.jtest_push = function(s, arr){
    if (!jtest_vals[s])
        jtest_vals[s] = [];
    if (Array.isArray(arr))
        array.push(jtest_vals[s], arr);
    else
        jtest_vals[s].push(arr);
};

E.jtest_init = function(){
    var i;
    is_jtest = true;
    jtest_vals = {};
    for (i=0; i<arguments.length; i++)
        E.jtest_push.apply(E, array.to_array(arguments[i]));
    return E.jtest_uninit.bind(E);
};

E.jtest_uninit = function(){
    is_jtest = false;
    jtest_vals = {};
};

E.basic_u32 = function(v){ return (1103515245*v+12345) >>> 0; };
E.basic_u31 = function(v){ return (1103515245*v+12345) & 0x7fffffff; };

return E; }); }());
