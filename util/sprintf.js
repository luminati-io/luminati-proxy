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
var E = sprintf;
E.sprintf = sprintf;
var has = Object.prototype.hasOwnProperty;
function sprintf(fmt /* args... */){
    if (has.call(E.cache, fmt))
        return E.cache[fmt](arguments);
    E.cache[fmt] = E.parse(fmt);
    E.cache_n++;
    if (E.cache_cb)
        E.cache_cb(fmt);
    return E.cache[fmt](arguments);
}
E.cache = {};
E.cache_n = 0;
E.to_int = function(num){
    return (num = +num)>=0 ? Math.floor(num) : -Math.floor(-num); };
E.thousand_grouping = function(num_s){
    var m = /^([-+])?(\d*)(\.\d*)?$/.exec(num_s);
    if (!m)
        return num_s;
    m[2] = (m[2]||'').replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1,');
    return (m[1]||'')+m[2]+(m[3]||'');
};

// non-throwing implementation of JSON.stringify(). main differences:
// - doesn't throw when a cycle is detected, instead inserts the string
//   '__CIRCULAR__' as value for the property with back-reference
// - ignores 'space' argument
// - doesn't throw when a getter throws, instead inserts the string
// '__ERROR__: XXX' where XXX is the error message
// mostly a line-by-line translation to JS of the spec omitting formatting
// https://www.ecma-international.org/ecma-262/6.0/#sec-json.stringify
E.stringify = function(value, replacer){
    if (is_array(replacer))
    {
        var r = {}, v;
        for (var i=0, l=replacer.length; i<l; i++)
        {
            v = value_of(replacer[i]);
            if (typeof v=='string' || typeof v=='number')
                r[v] = true;
        }
        replacer = r;
    }
    else if (typeof replacer!='function')
        replacer = undefined;
    return _stringify('', {'': value}, replacer, []);
};
function json_escape(str){ return JSON.stringify(str); }
function _stringify(key, holder, replacer, stack){
    var value;
    try { value = holder[key]; }
    catch(e){ value = '__ERROR__: '+e; }
    if (value && typeof value=='object' && typeof value.toJSON=='function')
        value = value.toJSON(key);
    if (typeof replacer=='function')
        value = replacer.call(holder, key, value);
    value = value_of(value);
    switch (typeof value)
    {
    case 'boolean': return value ? 'true' : 'false';
    case 'string': return json_escape(value);
    case 'number': return Number.isFinite(value) ? json_escape(value) : 'null';
    case 'object':
        if (value===null)
            return 'null';
        if (stack.indexOf(value)>=0)
            return '"__CIRCULAR__"';
        stack.push(value);
        var s, a = [], p, ret;
        if (is_array(value))
        {
            for (var i=0, l=value.length; i<l; i++)
            {
                s = _stringify(''+i, value, replacer, stack);
                a.push(s==null ? 'null' : s);
            }
            ret = '['+a.join(',')+']';
        }
        else
        {
            for (p in value)
            {
                if (!has.call(value, p))
                    continue;
                if (typeof replacer=='object' && !replacer[p])
                    continue;
                if ((s = _stringify(p, value, replacer, stack))!=null)
                    a.push(json_escape(p)+':'+s);
            }
            ret = '{'+a.join(',')+'}';
        }
        stack.pop();
        return ret;
    default: return undefined;
    }
}
function value_of(v){
    return typeof v=='object' &&
        (v instanceof Number || v instanceof String || v instanceof Boolean) ?
        v.valueOf() : v;
}
function is_array(a){
    return Object.prototype.toString.call(a)=='[object Array]'; }

function stringify(value){
    try { return JSON.stringify(value); }
    catch(e){ return E.stringify(value); }
}

E.parse_fast = function(fmt){
    var _fmt = fmt, match = [], arg_names = 0, cursor = 1;
    var pad_chr, pad_chrs, arg_padded, f, s = stringify;
    f = 'var out = "", arg, arg_s, sign;\n';
    for (; _fmt; _fmt = _fmt.substring(match[0].length))
    {
        if (match = /^[^%]+/.exec(_fmt))
            f += 'out += '+s(match[0])+';\n';
        else if (match = /^%%/.exec(_fmt))
            f += 'out += "%";\n';
        else if ((match =
            /^%(?:([1-9]\d*)\$|\(([^\)]+)\))?(\+)?(0|'[^$])?(-)?(\d+)?(?:\.(\d+))?(')?([bcdefoOsuxX])/
            .exec(_fmt)))
        {
            var positional = match[1], keyword = match[2], sign = match[3];
            var pad_zero = match[4], pad_min = match[5], pad_max = match[6];
            var precision = match[7], thousand_grouping = match[8]=="'";
            var conversion = match[9], keyword_list = [];
            if (keyword)
            {
                arg_names |= 1;
                var _keyword = keyword, kmatch;
                if (!(kmatch = /^([a-z_][a-z_\d]*)/i.exec(_keyword)))
                    throw 'sprintf: invalid keyword property name '+_keyword;
                keyword_list.push(kmatch[1]);
                while (_keyword = _keyword.substring(kmatch[0].length))
                {
                    if (kmatch = /^\.([a-z_][a-z_\d]*)/i.exec(_keyword))
                        keyword_list.push(kmatch[1]);
                    else if (kmatch = /^\[(\d+)\]/.exec(_keyword))
                        keyword_list.push(kmatch[1]);
                    else
                        throw 'sprintf: invalid keyword format '+_keyword;
                }
            }
            else
                arg_names |= 2;
            if (arg_names===3)
            {
                throw 'sprintf: mixing positional and named placeholders is '
                    +'not (yet) supported';
            }
            f += 'sign = false;\n';
            if (keyword_list.length) // keyword argument
            {
                f += 'arg = argv['+cursor+']';
                for (var k = 0; k < keyword_list.length; k++)
                    f += '['+s(keyword_list[k])+']';
                f += ';\n';
            }
            else if (positional) // positional argument (explicit)
                f += 'arg = argv['+positional+'];\n';
            else // positional argument (implicit)
                f += 'arg = argv['+(cursor++)+'];\n';
            if (/[^sO]/.test(conversion))
                f += 'arg = +arg;\n';
            switch (conversion)
            {
            case 'b': f += 'arg_s = arg.toString(2);\n'; break;
            case 'c': f += 'arg_s = String.fromCharCode(arg);\n'; break;
            case 'd':
                f += 'arg = sprintf.to_int(arg); arg_s = ""+arg;\n';
                if (thousand_grouping)
                    f += 'arg_s = sprintf.thousand_grouping(arg_s);\n';
                break;
            case 'e':
                f += 'arg_s = arg.toExponential('
                +(precision ? s(precision) : '')+');\n';
                break;
            case 'f':
                if (precision)
                    f += 'arg_s = arg.toFixed('+precision+');\n';
                else
                    f += 'arg_s = ""+arg;\n';
                if (thousand_grouping)
                    f += 'arg_s = sprintf.thousand_grouping(arg_s);\n';
                break;
            case 'o': f += 'arg_s = arg.toString(8);\n'; break;
            case 'O': f += 'arg_s = stringify(arg);\n'; break;
            case 'u': f += 'arg = arg >>> 0; arg_s = ""+arg;\n'; break;
            case 'x': f += 'arg_s = arg.toString(16);\n'; break;
            case 'X': f += 'arg_s = arg.toString(16).toUpperCase();\n'; break;
            case 's':
                f += 'arg_s = ""+arg;\n';
                if (precision)
                    f += 'arg_s = arg_s.substring(0, '+precision+');\n';
                break;
            }
            if (/[def]/.test(conversion))
            {
                if (sign)
                    f += 'if (arg>=0) arg_s = "+"+arg_s;\n';
                f += 'sign = arg_s[0]=="-" || arg_s[0]=="+";\n';
            }
            pad_chr = !pad_zero ? ' ' : pad_zero=='0' ? '0' : pad_zero[1];
            pad_chrs = s(pad_chr)
                +'.repeat(Math.max('+(+pad_max)+'-arg_s.length, 0))';
            arg_padded = !pad_max ? 'arg_s' :
                pad_min ? 'arg_s+'+pad_chrs :
                /[def]/.test(conversion) && pad_chr=='0' ?
                '(sign ? arg_s[0]+'+pad_chrs+'+arg_s.slice(1) : '
                +pad_chrs+'+arg_s)' :
                pad_chrs+'+arg_s';
            f += 'out += '+arg_padded+';\n';
        }
        else
            throw 'sprintf invalid format '+_fmt;
    }
    f += 'return out;\n';
    return new Function(['sprintf', 'stringify', 'argv'], f)
        .bind(null, sprintf, stringify);
};

// slow version for Firefox extention where new Function() is not allowed
E.parse_slow = function(fmt){
    var _fmt = fmt, match = [], arg_names = 0, cursor = 1;
    var _f = [], out, arg, arg_s, argv, sign;
    function f(fn){ _f.push(fn); }
    for (; _fmt; _fmt = _fmt.substring(match[0].length))
    {
        (function(){
            if (match = /^[^%]+/.exec(_fmt))
            {
                var _match = match;
                f(function(){ return out += _match[0]; });
            }
            else if (match = /^%%/.exec(_fmt))
                f(function(){ return out += '%'; });
            else if ((match =
                /^%(?:([1-9]\d*)\$|\(([^\)]+)\))?(\+)?(0|'[^$])?(-)?(\d+)?(?:\.(\d+))?(')?([bcdefoOsuxX])/
                .exec(_fmt)))
            {
                var positional = match[1], keyword = match[2], sign = match[3];
                var pad_zero = match[4], pad_min = match[5];
                var pad_max = match[6];
                var precision = match[7], thousand_grouping = match[8]=="'";
                var conversion = match[9], keyword_list = [], _cursor = cursor;
                if (keyword)
                {
                    arg_names |= 1;
                    var _keyword = keyword, kmatch;
                    if (!(kmatch = /^([a-z_][a-z_\d]*)/i.exec(_keyword)))
                    {
                        throw 'sprintf: invalid keyword property name '
                            +_keyword;
                    }
                    keyword_list.push(kmatch[1]);
                    while (_keyword = _keyword.substring(kmatch[0].length))
                    {
                        if (kmatch = /^\.([a-z_][a-z_\d]*)/i.exec(_keyword))
                            keyword_list.push(kmatch[1]);
                        else if (kmatch = /^\[(\d+)\]/.exec(_keyword))
                            keyword_list.push(kmatch[1]);
                        else
                            throw 'sprintf: invalid keyword format '+_keyword;
                    }
                }
                else
                    arg_names |= 2;
                if (arg_names===3)
                {
                    throw 'sprintf: mixing positional and named placeholders'
                        +' is not (yet) supported';
                }
                f(function(){ sign = false; });
                if (keyword_list.length) // keyword argument
                {
                    f(function(){
                        arg = argv[_cursor];
                        for (var k = 0; k < keyword_list.length && arg!=null;
                            k++)
                        {
                            arg = arg[keyword_list[k]];
                        }
                    });
                }
                else if (positional) // positional argument (explicit)
                    f(function(){ arg = argv[positional]; });
                else // positional argument (implicit)
                {
                    f(function(){ arg = argv[_cursor]; });
                    cursor++;
                }
                if (/[^sO]/.test(conversion))
                    f(function(){ return arg = +arg; });
                switch (conversion)
                {
                case 'b': f(function(){ arg_s = arg.toString(2); }); break;
                case 'c':
                      f(function(){ arg_s = String.fromCharCode(arg); });
                      break;
                case 'd':
                    f(function(){
                        arg = sprintf.to_int(arg); arg_s = ''+arg; });
                    if (thousand_grouping)
                    {
                        f(function(){
                            arg_s = sprintf.thousand_grouping(arg_s); });
                    }
                    break;
                case 'e':
                    f(function(){ arg_s = arg.toExponential(
                        precision ? precision : undefined); });
                    break;
                case 'f':
                    if (precision)
                        f(function(){ arg_s = arg.toFixed(precision); });
                    else
                        f(function(){ arg_s = ''+arg; });
                    if (thousand_grouping)
                    {
                        f(function(){
                            arg_s = sprintf.thousand_grouping(arg_s); });
                    }
                    break;
                case 'o': f(function(){ arg_s = arg.toString(8); }); break;
                case 'O': f(function(){ arg_s = stringify(arg); }); break;
                case 'u': f(function(){ arg = arg >>> 0; arg_s = ''+arg; });
                          break;
                case 'x': f(function(){ arg_s = arg.toString(16); }); break;
                case 'X':
                    f(function(){ arg_s = arg.toString(16).toUpperCase(); });
                    break;
                case 's':
                    f(function(){ arg_s = ''+arg; });
                    if (precision)
                    {
                        f(function(){
                            arg_s = arg_s.substring(0, precision); });
                    }
                    break;
                }
                if (/[def]/.test(conversion))
                {
                    if (sign)
                    {
                        f(function(){
                            if (arg>=0)
                                arg_s = '+'+arg_s; });
                    }
                    f(function(){ sign = arg_s[0]=='-' || arg_s[0]=='+'; });
                }
                var pad_chr = !pad_zero ? ' ' : pad_zero=='0' ? '0' :
                    pad_zero[1];
                f(function(){
                    var pad_chrs = pad_chr.repeat(
                        Math.max(+pad_max-arg_s.length, 0));
                    var arg_padded = !pad_max ? arg_s :
                        pad_min ? arg_s+pad_chrs :
                        sign && pad_chr[0]=='0' ?
                        arg_s[0]+pad_chrs+arg_s.slice(1) :
                        pad_chrs+arg_s;
                    out += arg_padded;
                });
            }
            else
                throw 'sprintf invalid format '+_fmt;
        })();
    }
    return function(_argv){
        argv = _argv;
        out = '';
        for (var i=0; i<_f.length; i++)
            _f[i](argv);
        return out;
    };
};
E.parse = (function(){
    try {
        if (new Function('return 1')()==1)
            return E.parse_fast;
    } catch(e){}
    return E.parse_slow; // capp does not support new Function()
})();

E.vsprintf = function(fmt, argv, opt){
    if (opt)
    {
        if (opt.fast)
            return E.parse_fast(fmt)([fmt].concat(argv));
        if (opt.slow)
            return E.parse_slow(fmt)([fmt].concat(argv));
    }
    return E.sprintf.apply(null, [fmt].concat(argv));
};

return E; }); }());
