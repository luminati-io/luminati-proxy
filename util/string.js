// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, browser:true*/
(function(){
var define;
var is_node_ff = typeof module=='object' && module.exports;
var is_rn = typeof global=='object' && !!global.nativeRequire ||
    typeof navigator=='object' && navigator.product=='ReactNative';
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
    return new TextEncoder().encode(s).buffer; };
E.from_array_buffer = function(buf, enc){
    return new TextDecoder(enc||'utf8').decode(buf); };
E.capitalize = function(s){
    s = ''+s;
    return (s[0]||'').toUpperCase()+s.slice(1);
};
E.trunc = function(s, len){
    if ((s||'').toString().length<=len)
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
/**
 * @deprecated use es6_str_template instead
 */
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
E.es6_str_template = function(parts){
    if (!Array.isArray(parts))
        return parts;
    var s = parts[0];
    for (var i = 1; i<parts.length; i++)
        s += arguments[i] + parts[i];
    return s;
};

var ALIGN_REGEXP = {
    first_or_empty_line: /^\n|(?<=^|\n)[\t ]+(?=(\n|$))/g,
    line_start_spaces: /(?<=(^|\n))[\t ]*(?=[^\t\n ])/g,
};
// align paragraph to the left
E.align = function(){
    var str = E.es6_str_template.apply(null, arguments)
        .replace(ALIGN_REGEXP.first_or_empty_line, '');
    var spaces = str.match(ALIGN_REGEXP.line_start_spaces);
    if (spaces == null)
        return str;
    var min_length = Infinity;
    for (var i=0; i<spaces.length; i++)
    {
        if (spaces[i].length<min_length)
        {
            min_length = spaces[i].length;
            if (!min_length)
                return str;
        }
    }
    return E.dedent(min_length)(str);
};
// merge lines
E.nl2sp = function(){ return E.es6_str(arguments).replace(/\n\s*/g, ' '); };
// join lines
E.nl2jn = function(){ return E.es6_str(arguments).replace(/\n\s*/g, ''); };
// split lines (html)
E.nl2br = function(){ return E.es6_str(arguments).replace(/\n\s*/g, '<br>'); };

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

var def_alphabet = '0123456789abcdefghijklmnopqrstuvwxyz';
E.generate = function(len, alphabet){
    len = len||12;
    alphabet = alphabet||def_alphabet;
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

// trims newlines, nbsp, zwnj
E.trim = function(s){
    return (''+s).replace(/^[\s\u00a0\u200c]*/g, '')
        .replace(/[\s\u00a0\u200c]*$/g, '');
};

E.object_to_str = function(obj){
    return Object.entries(obj)
    .map(function(entry){
        if (entry[1]!=null)
            return entry[0]+'='+entry[1];
    })
    .filter(Boolean)
    .join(' ');
};

var snake_case_regex = /(([A-Z](?![^A-Z]))+|[A-Z])[^A-Z]*|[^A-Z]+/g;
E.to_snake_case = function(str){
    return Array.from((str||'').matchAll(snake_case_regex))
        .map(function(m){ return m[0].toLowerCase(); }).join('_');
};

/* eslint-disable-next-line no-control-regex*/
E.str_rm_null = function(s){ return (s||'').replace(/\u0000/g, ''); };

E.count = function(s, p){
    if (!p || !p.toString || (p=p.toString()).length<1 || p.length>s.length)
        return 0;
    var c, i;
    for (c=-1, i=-1-p.length; i!=-1; ++c, i=s.indexOf(p, i+p.length));
    return c;
};

E.internalize_pool = typeof Map=='function' ? function(){
    var pool = new Map(); // jshint ignore:line
    return function internalize_string(str){
        var v = pool.get(str);
        if (v===undefined)
            pool.set(str, v = str);
        return v;
    };
} : function(v){ return v; };

E.wrap = function wrap(str, width, nbsp_to_space){
    nbsp_to_space = nbsp_to_space!==false;
    var lines = str.split('\n');
    if (lines.length>1)
    {
        return lines.map(function(line){
            return wrap(line, width);
        }).join('\n');
    }
    var words = str.split(' ');
    var output = '';
    var cur_line = '';
    for (var i = 0; i < words.length; i++)
    {
        var word = words[i];
        var possible_line = cur_line ? cur_line+' '+word : word;
        if (possible_line[width])
        {
            output += cur_line+'\n';
            cur_line = word;
        }
        else
            cur_line = possible_line;
    }
    output += cur_line;
    return nbsp_to_space ? output.replace(/\u00A0/g, ' ') : output;
};
E.sp2nbsp = function(){
    return E.es6_str(arguments).replace(/ /g, '\u00A0');
};

var INDENT_REGEXP = /(?<=^|\n)(?=[\t ]*[^\s])/g;
E.indent = function(space_amount){
    if (space_amount<1)
        return E.es6_str_template;
    var template = new Array(space_amount+1).join(' ');
    return function(){
        var str = E.es6_str_template.apply(null, arguments);
        return str.replace(INDENT_REGEXP, template);
    };
};
E.dedent = function(space_amount){
    if (space_amount<1)
        return E.es6_str_template;
    var dedent_regexp = new RegExp('(?<=^|\n)[\\t ]{1,'+space_amount+'}', 'g');
    return function(){
        var str = E.es6_str_template.apply(null, arguments);
        return str.replace(dedent_regexp, '');
    };
};

var SDK_UUID_REGEXP = /^sdk-[a-z]*-[0-9a-f]{32}$/;
E.is_uuid = function(str){
    return SDK_UUID_REGEXP.test(str);
};

function logfmt_escape(str){ return str.replace(/"/g, '\\"'); }
function logfmt_format(val){
    if (typeof val=='number'||typeof val=='boolean'||val==null)
        return val;
    if (typeof val=='object')
        return '"'+logfmt_escape(JSON.stringify(val))+'"';
    var str = logfmt_escape(''+val);
    return /[\s=]/.test(str) ? '"'+str+'"' : str;
}
E.logfmt = function logfmt(obj){
    return Object.keys(obj).map(function(k){
        return logfmt_format(k)+'='+logfmt_format(obj[k]);
    }).join(' ');
};

return E;
});
})();
