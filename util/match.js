// LICENSE_CODE ZON ISC
'use strict'; /*zlint node, br*/
(function(){
var define;
var is_node_ff = typeof module=='object' && module.exports;
if (!is_node_ff)
    define = self.define;
else
    define = require('./require_node.js').define(module, '../');
define(['/util/escape.js', '/util/util.js'], function(zescape, zutil){
var E = {};

E.glob_to_regex_str = function(glob){
    return '^('
    +glob.replace(/(\?|\*\*|\*)|([^?*]+)/g, function(m){
        return m=='?' ? '[^/]' : m=='**' ? '.*' : m=='*' ? '[^/]*' :
            zescape.regex(m); })
    +')$';
};
E.glob_to_regex = function(glob){
    return new RegExp(E.glob_to_regex_str(glob)); };
E.glob_fn = function(glob){
    var re = E.glob_to_regex(glob);
    return function(s){ return re.test(s); };
};
E.glob = function(glob, value){ return E.glob_fn(glob)(value); };

function eat_group(arr, start){
    for (var c = 0, i = start; i < arr.length; i++)
    {
        if (arr[i].depth)
            c += arr[i].depth;
        if (!c)
            return arr.splice(start, i-start+1).slice(1, -1);
    }
    throw new Error('unbalanced group');
}
function parse_arr_to_tree(arr, join){
    function is_join(el){ return el.join && Object.keys(el).length==1; }
    function clean(el){
        if (!Array.isArray(el.elm))
            delete el.join;
        return el;
    }
    function pass(fn){
        for (var i = 0; i < arr.length; i++)
        {
            var change;
            if (change = fn(arr[i], arr[i+1], i))
                i += change;
        }
    }
    pass(function(el, next, i){
        if (el.depth)
            arr.splice(i, 0, parse_arr_to_tree(eat_group(arr, i), join));
    });
    pass(function(el, next, i){
        if (el.fn && !el.elm)
            el.elm = arr.splice(i+1, 1)[0];
    });
    pass(function(el, next, i){
        if (is_join(el))
        {
            arr[i-1] = {join: el.join, elm: [arr[i-1], next].map(clean)};
            arr.splice(i, 2);
            return -1;
        }
        if (next && next.join=='&&' && !is_join(next))
        {
            arr[i] = {join: '&&', elm: [el, next].map(clean)};
            arr.splice(i+1, 1);
        }
    });
    if (arr.length<=1)
        return arr[0];
    return {join: join,
        elm: [arr[0], parse_arr_to_tree(arr.slice(1), join), ].map(clean)};
}

E.match_parse = function(filter, opt){
    var res = [], o = {s: filter}, cmp = [], match, i, _plugin;
    var eat_token = zescape.parse.eat_token;
    opt = opt||{};
    var plugin = opt.plugin||[];
    var join = opt.join||'||'; // default join operator
    var logical = opt.logical===undefined || opt.logical;
    token:
    while (o.s.length)
    {
        if (opt.eat_white!==false && eat_token(o, /^\s+/))
            continue;
        for (i=0; i<plugin.length; i++)
        {
            _plugin = plugin[i];
            if (match = eat_token(o, _plugin.re))
            {
                cmp.push({plugin: _plugin, m: match});
                continue token;
            }
        }
        if (match = eat_token(o, /^\/((\\.|[^\\/])+)\/([i]?)(\s|$)/))
        {
            cmp.push({re: match[1], re_opt: match[3]});
            continue;
        }
        if (match = eat_token(o, /^\S+/))
        {
            var m = match[0], l;
            var _logical = {'&&': {join: '&&'}, '||': {join: '||'},
                '!': {fn: '!'}, '+': {join: '||'},
                '-': {fn: '!', join: '&&', wrap_join: true},
                '(': {fn: '(', depth: 1},
                ')': {fn: ')', depth: -1, join: ''}};
            if (logical && (l = _logical[m]))
            {
                if (l.wrap_join)
                {
                    var depth = 0;
                    for (i=cmp.length; i>=0 && depth>=0; i--)
                        depth += -(l.depth||0);
                    i++;
                    if (i<cmp.length)
                    {
                        cmp.splice(i, 0, _logical['(']);
                        cmp.push(_logical[')']);
                    }
                    delete l.wrap_join;
                }
                cmp.push(l);
            }
            else if (opt.glob && /[\[\]*?{}]/.test(m))
            {
                cmp.push(opt.glob=='re' ?
                    {re: E.glob_to_regex_str(m)} : {glob: m});
            }
            else
                cmp.push({eq: m});
            continue;
        }
        E.match_last_error = new Error('invalid token '+o.s);
    }
    var have_val = false;
    cmp.forEach(function(c){
        var _join = have_val && join;
        if (c.eq!==undefined || c.re!==undefined ||
            c.glob!==undefined || c.plugin)
        {
            have_val = true;
        }
        else
        {
            if (c.join!==undefined)
                _join = c.join;
            have_val = false;
        }
        if (_join)
            c.join = _join;
        else
            delete c.join;
    });
    return opt.tree ? parse_arr_to_tree(cmp, join) : cmp;
};
E.match_fn = function(filter, opt){
    opt = opt||{};
    var cmp = E.match_parse(filter, opt), func = 'return ', i;
    for (i=0; i<cmp.length; i++)
    {
        var c = cmp[i];
        if (c.join)
            func += c.join+' ';
        if (c.re!==undefined)
        {
            try {
                var re = new RegExp(c.re, c.re_opt);
                c = function(s){ return this.test(s); }.bind(re);
            } catch(e){
                c = function(){ return false; };
                E.match_last_error = e;
            }
        }
        else if (c.glob!==undefined)
            c = E.glob_fn(c.glob);
        else if (c.eq!==undefined)
            c = function(s){ return s===this; }.bind(c.eq);
        else if (c.plugin)
        {
            c = c.plugin.cmp ? c.plugin.cmp.bind(null, c.m) :
                c.plugin.cmp_fn(c.m);
        }
        cmp[i] = c;
        if (typeof c=='function')
            func += 'cmp['+i+'](s, extra) ';
        else if (c instanceof Object)
            func += c.fn ? c.fn+' ' : '';
        else
            throw new Error();
    }
    if (!cmp.length)
        func += 'false ';
    func += ';';
    return new Function(['cmp', 's', 'extra'], func).bind(null, cmp);
};
E.match = function(filter, value, opt){
    return E.match_fn(filter, opt)(value, opt && opt.extra); };

E.cmp_norm = function(cmp){ return cmp>0 ? 1 : cmp<0 ? -1 : 0; };
// XXX alexey: move to util.js, change name to non-string-related
E.strcmp = function(a, b){ return a>b ? 1 : a<b ? -1 : 0; };
E.strverscmp = function(a, b){
    var _a, _b, diff, skip_digit = 0;
    for (_a=0, _b=0; _a<a.length && _b<b.length; _a++, _b++)
    {
        if (a[_a]==b[_b] && !zutil.isdigit(a[_b])) // fast-path
            continue;
        if (skip_digit)
            skip_digit--;
        if (zutil.isdigit(a[_a]) && zutil.isdigit(b[_b]))
        {
            var ma = a.substr(_a).match(/\d+/)[0];
            var mb = b.substr(_b).match(/\d+/)[0];
            if (diff = +ma - +mb)
                return diff;
            skip_digit = ma.length;
        }
        if (diff = a[_a].charCodeAt()-b[_b].charCodeAt())
            return diff;
    }
    return a.length-b.length;
};

E.regexp_merge = function(a){
    var re = [], i;
    for (i=0; i<a.length; i++)
        re.push(a[i] instanceof RegExp ? a[i].source : zescape.regex(''+a[i]));
    return new RegExp('('+re.join(')|(')+')');
};
return E; }); }());
