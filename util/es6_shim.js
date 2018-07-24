// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, browser:true, -W103*/
(function(){
var define;
var is_node_ff = typeof module=='object' && module.exports;
if (!is_node_ff)
    define = self.define;
else
    define = function(setup){ module.exports = setup(); };
define(function(){
var E = {t: {}};
// shim for ES6/7. Need to support >=IE9 (including IE9 quirks mode),
// Chrome, FF, Safari, Opera, and old android browsers.
function add_prop(obj, prop, fn){
    if (obj[prop])
        return;
    Object.defineProperty(obj, prop,
        {enumerable: false, writable: true, configurable: true, value: fn});
}

E.t.object_assign = function(obj){
    for (var i=1; i<arguments.length; i++)
    {
        var source = arguments[i];
        if (!source)
            continue;
        for (var prop in source)
        {
            if (source.hasOwnProperty(prop))
                obj[prop] = source[prop];
        }
    }
    return obj;
};
add_prop(Object, 'assign', E.t.object_assign);
E.t.object_values = function(obj){
    if (obj==null)
        throw new TypeError('Cannot convert undefined or null to object');
    var res = [];
    for (var prop in obj)
    {
        if (obj.hasOwnProperty(prop))
            res.push(obj[prop]);
    }
    return res;
};
add_prop(Object, 'values', E.t.object_values);
E.t.object_entries = function(obj){
    if (obj==null)
        throw new TypeError('Cannot convert undefined or null to object');
    var res = [];
    for (var prop in obj)
    {
        if (obj.hasOwnProperty(prop))
            res.push([prop, obj[prop]]);
    }
    return res;
};
add_prop(Object, 'entries', E.t.object_entries);
var can_set_proto = {__proto__: []} instanceof Array;
E.t.object_setPrototypeOf = function(obj, proto){
    if (can_set_proto)
        obj.__proto__ = proto;
    else // IE9/IE10
    {
        for (var prop in proto)
            obj[prop] = proto[prop];
    }
    return true;
};
add_prop(Object, 'setPrototypeOf', E.t.object_setPrototypeOf);

E.t.string_startsWith = function(head){
    head = ''+head;
    return !head || this.slice(0, head.length)===head;
};
add_prop(String.prototype, 'startsWith', E.t.string_startsWith);
E.t.string_endsWith = function(tail){
    tail = ''+tail;
    return !tail || this.slice(-tail.length)==tail;
};
add_prop(String.prototype, 'endsWith', E.t.string_endsWith);
E.t.string_includes = function(search, index){
    return this.indexOf(search, index)>=0; };
add_prop(String.prototype, 'includes', E.t.string_includes);
E.t.string_repeat = function(n){
    var s = '';
    for (var i=0; i<n; i++)
        s += this;
    return s;
};
add_prop(String.prototype, 'repeat', E.t.string_repeat);
E.t.string_trimLeft = function(){ return this.replace(/^\s+/, ''); };
add_prop(String.prototype, 'trimLeft', E.t.string_trimLeft);
E.t.string_trimRight = function(){ return this.replace(/\s+$/, ''); };
add_prop(String.prototype, 'trimRight', E.t.string_trimRight);
E.t.string_padStart = function(len, val){
    val = val||' ';
    var l = len-this.length;
    return l<=0 ? this : val.repeat(Math.ceil(l/val.length)).slice(0, l)+this;
};
add_prop(String.prototype, 'padStart', E.t.string_padStart);
E.t.string_padEnd = function(len, val){
    val = val||' ';
    var l = len-this.length;
    return l<=0 ? this : this+val.repeat(Math.ceil(l/val.length)).slice(0, l);
};
add_prop(String.prototype, 'padEnd', E.t.string_padEnd);

E.t.array_includes = function(search, index){
    return this.indexOf(search, index)>=0; };
add_prop(Array.prototype, 'includes', E.t.array_includes);
E.t.array_find = function(fn, this_arg){
    var a = this, value;
    for (var i=0; i<a.length; i++)
    {
        value = a[i];
        if (i in a && fn.call(this_arg, value, i, a))
            return value;
    }
};
add_prop(Array.prototype, 'find', E.t.array_find);
E.t.array_findIndex = function(fn, this_arg){
    var a = this, value;
    for (var i=0; i<a.length; i++)
    {
        value = a[i];
        if (i in a && fn.call(this_arg, value, i, a))
            return i;
    }
    return -1;
};
add_prop(Array.prototype, 'findIndex', E.t.array_findIndex);
E.t.array_of = function(){ return Array.prototype.slice.call(arguments); };
add_prop(Array, 'of', E.t.array_of);
E.t.array_from = function(a, fn, _this){
    a = Array.prototype.slice.call(a);
    return !fn ? a : a.map(fn, _this);
};
add_prop(Array, 'from', E.t.array_from);

E.t.arraybuffer_slice = function(begin, end){
    begin = begin|0;
    end = (end==null ? this.byteLength : end)|0;
    if (begin<0)
        begin += this.byteLength;
    if (end<0)
        end += this.byteLength;
    begin = Math.min(Math.max(0, begin), this.byteLength);
    end = Math.min(Math.max(0, end), this.byteLength);
    if (end-begin<=0)
        return new ArrayBuffer(0);
    var result = new ArrayBuffer(end-begin);
    var resultBytes = new Uint8Array(result);
    var sourceBytes = new Uint8Array(this, begin, end-begin);
    resultBytes.set(sourceBytes);
    return result;
};
if (typeof ArrayBuffer!='undefined')
    add_prop(ArrayBuffer.prototype, 'slice', E.t.arraybuffer_slice);

add_prop(Number, 'EPSILON', Math.pow(2, -52));
E.t.number_isFinite = function(x){ return typeof x=='number' && isFinite(x); };
add_prop(Number, 'isFinite', E.t.number_isFinite); // missing in IE (<edge)
E.t.math_sign = function(x){
    x = +x;
    return x!==x ? NaN : !x ? x : x<0 ? -1 : 1;
};
add_prop(Math, 'sign', E.t.math_sign);
E.t.math_trunc = function(x){
    x = +x;
    return x!==x ? NaN : x<0 ? Math.ceil(x) : Math.floor(x);
};
add_prop(Math, 'trunc', E.t.math_trunc);
E.t.math_imul = function(x, y){
    var hix = (x>>>16)&0xffff;
    var lox = x&0xffff;
    var hiy = (y>>>16)&0xffff;
    var loy = y&0xffff;
    return lox*loy+(((hix*loy + lox*hiy)<<16)>>>0)|0;
};
add_prop(Math, 'imul', E.t.math_imul);

function ie9_console(){
    if (typeof window!='object')
        return;
    if (window.console)
    {
        if (!window.console.debug) // ie9 has no debug() in native console
            window.console.debug = window.console.info;
        return;
    }
    var console = window.console = {};
    ['assert', 'clear', 'count', 'debug', 'dir', 'dirxml',
        'error', 'exception', 'group', 'groupCollapsed', 'groupEnd', 'info',
        'log', 'markTimeline', 'profile', 'profiles', 'profileEnd', 'show',
        'table', 'time', 'timeEnd', 'timeline', 'timelineEnd', 'timeStamp',
        'trace', 'warn'
    ].forEach(function(p){ console[p] = function(){}; });
    ['memory'].forEach(function(p){ console[p] = {}; });
}
ie9_console();

function ie9_location_origin(){
    if (typeof window!='object' || !window.location ||
        'origin' in window.location)
    {
        return;
    }
    var location = window.location;
    var default_ports = {'http:': 80, 'https:': 443};
    var port = location.port;
    if (default_ports[location.protocol]==port) // omit default protocol port
        port = null;
    location.origin = location.protocol+'//'+location.hostname+
        (port ? ':'+port : '');
}
ie9_location_origin();

function element_matches(){
    if (typeof Element!='object' && typeof Element!='function' ||
        Element.prototype.matches)
    {
        return;
    }
    Element.prototype.matches = Element.prototype.matchesSelector ||
        Element.prototype.mozMatchesSelector ||
        Element.prototype.msMatchesSelector ||
        Element.prototype.oMatchesSelector ||
        Element.prototype.webkitMatchesSelector;
    if (Element.prototype.matches)
        return;
    Element.prototype.matches = function(s){
        var matches = (this.document||this.ownerDocument).querySelectorAll(s);
        var i = matches.length;
        while (--i>=0 && matches.item(i)!==this);
        return i>-1;
    };
}
element_matches();

function ie_edge_closest(){
    if (typeof Element!='object' && typeof Element!='function' ||
        Element.prototype.closest)
    {
        return;
    }
    Element.prototype.closest = function(selector){
        var el = this;
        while (el)
        {
            if (el.matches(selector))
                return el;
            el = el.parentElement;
        }
        return null;
    };
}
ie_edge_closest();

E.t.function_name = function(){
    // toString() on IE is very fast compared to chrome ~260k/s vs 26k/s on
    // a small function.
    // the regex is faster than a simple loop to extract non whitespace
    // between 'function ' and '('
    var n = this.toString().match(/^function\s+([^\s(]+)/);
    return (n && n[1])||'';
};
function ie_function_name(){
    if (ie_function_name.name=='ie_function_name')
        return;
    // IE doesn't support function.name (Edge does)
    Object.defineProperty(Function.prototype, 'name', {enumerable: false,
        configurable: false, get: E.t.function_name});
}
ie_function_name();

// android api 18 and below
function android18_animFrame(){
    if (typeof window!='object' || window.requestAnimationFrame)
        return;
    var start = Date.now();
    window.requestAnimationFrame = function(cb){
        setTimeout(function(){ cb(Date.now()-start); }, 16); };
}
android18_animFrame();

return E; }); }());
