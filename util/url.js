// LICENSE_CODE ZON ISC
'use strict'; /*zlint node, br*/
(function(){
var define;
var is_node = typeof module=='object' && module.exports && module.children;
var is_rn = (typeof global=='object' && !!global.nativeRequire) ||
    (typeof navigator=='object' && navigator.product=='ReactNative');
var is_ff_addon = typeof module=='object' && module.uri
    && !module.uri.indexOf('resource://');
var qs;

if (is_rn)
    define = require('./require_node.js').define(module, '../');
else if (!is_node)
    define = self.define;
else
{
    define = require('./require_node.js').define(module, '../');
    // XXX arik HACK: react-native bundler will try to require querystring
    // even thoguh it never reaches this if (it is done in pre-processing)
    // so we fool him
    var _require = require;
    qs = _require('querystring');
}
define([], function(){
var assign = Object.assign;
var E = {};

function replace_slashes(url){ return url.replace(/\\/g, '/'); }

E.add_proto = function(url){
    if (!url.match(/^([a-z0-9]+:)?\/\//i))
        url = 'http://'+url;
    return url;
};

E.rel_proto_to_abs = function(url){
    var proto = is_node ? 'http:' : location.protocol;
    return url.replace(/^\/\//, proto+'//');
};

E.get_top_level_domain = function(host){
    var n = host.match(/\.([^.]+)$/);
    return n ? n[1] : '';
};

E.get_host = function(url){
    var n = replace_slashes(url).match(/^(https?:)?\/\/([^\/]+)\/.*$/);
    return n ? n[2] : '';
};

E.get_host_without_tld = function(host){
    return host.replace(/^([^.]+)\.[^.]{2,3}(\.[^.]{2,3})?$/, '$1');
};

var generic_2ld = {com: 1, biz: 1, net: 1, org: 1, xxx: 1, edu: 1, gov: 1,
    ac: 1, co: 1, or: 1, ne: 1, kr: 1, jp: 1, jpn: 1, cn: 1};

E.get_root_domain = function(domain){
    if (E.is_ip(domain))
        return domain;
    var s = domain.split('.'), root = s, len = s.length;
    if (len>2) // www.abc.com abc.com.tw www.abc.com.tw,...
    {
        var hd = 0;
        if (s[len-1]=='hola')
        {
            hd = 2; // domain.us.hola
            if (s[len-2].match(/^\d+$/))
                hd = 3; // domain.us.23456.hola
        }
        if (generic_2ld[s[len-2-hd]])
            root = s.slice(-3-hd, len-hd); // abc.com.tw
        else
            root = s.slice(-2-hd, len-hd); // abc.com
    }
    return root.join('.');
};

// XXX josh: move to email.js:get_domain
E.get_domain_email = function(email){
    var match = email.toLowerCase().match(/^[a-z0-9_.\-+*]+@(.*)$/);
    return match && match[1];
};

// XXX josh: move to email.js:get_root_domain or remove and let developer
// combine email.js:get_domain with url.js:get_root_domain
E.get_root_domain_email = function(email){
    var domain = E.get_domain_email(email);
    return domain && E.get_root_domain(domain);
};

E.get_path = function(url){
    var n = url.match(/^https?:\/\/[^\/]+(\/.*$)/);
    return n ? n[1] : '';
};

E.get_proto = function(url){
    var n = url.match(/^([a-z0-9]+):\/\//);
    return n ? n[1] : '';
};

E.get_host_gently = function(url){
    var n = replace_slashes(url).match(/^(?:(?:[a-z0-9]+?:)?\/\/)?([^\/]+)/);
    return n ? n[1] : '';
};

E.is_ip = function(host){
    var m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
    if (!m)
        return false;
    for (var i=1; i<=4; i++)
    {
        if (+m[i]>255)
            return false;
    }
    return true;
};

E.is_ip_mask = function(host){
    var m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
    if (!m)
        return false;
    if (E.ip2num(host)==0)
        return false;
    var final = false;
    var check_num_mask = function(num){
        var arr = (num >>> 0).toString(2).split(''), _final = false;
        for (var i=0; i<arr.length; i++)
        {
            if (_final && arr[i]=='1')
                return false;
            if (!_final && arr[i]=='0')
                _final = true;
        }
        return true;
    };
    for (var i=1; i<=4; i++)
    {
        if (+m[i]>255)
            return false;
        if (final && +m[i]>0)
            return false;
        if (!final && +m[i]<255)
        {
            if (!check_num_mask(+m[i]))
                return false;
            final = true;
        }
    }
    return !!final;
};

E.ip2num = function(ip){
    var num = 0;
    ip.split('.').forEach(function(octet){
        num <<= 8;
        num += +octet;
    });
    return num>>>0;
};

E.num2ip = function(num){
    return (num>>>24)+'.'+(num>>16 & 255)+'.'+(num>>8 & 255)+'.'+(num & 255);
};

E.is_ip_subnet = function(host){
    var m = /(.+?)\/(\d+)$/.exec(host);
    return m && E.is_ip(m[1]) && +m[2]<=32;
};

E.is_ip_netmask = function(host){
    var ips = host.split('/');
    if (ips.length!=2 || !E.is_ip(ips[0]) || !E.is_ip_mask(ips[1]))
        return false;
    return true;
};

E.is_ip_range = function(host){
    var ips = host.split('-');
    if (ips.length!=2 || !E.is_ip(ips[0]) || !E.is_ip(ips[1]))
        return false;
    return E.ip2num(ips[0])<E.ip2num(ips[1]);
};

E.is_ip_port = function(host){
    var m = /(.+?)(?::(\d{1,5}))?$/.exec(host);
    return m && E.is_ip(m[1]) && !(+m[2]>65535);
};

/* basic url validation to prevent script injection like 'javascript:....' */
E.is_valid_url = function(url){
    return /^(https?:\/\/)?([a-z0-9-]+\.)+[a-z0-9-]+(:\d+)?(\/.*)?$/i
    .test(url);
};

E.is_valid_domain = function(domain){
    return /^([a-z0-9]([a-z0-9-_]*[a-z0-9])?\.)+[a-z]{2,63}$/.test(domain); };

// XXX josh: move to email.js:is_valid
E.is_valid_email = function(email, is_signup){
    if (!email)
        return false;
    var re = /^[a-z0-9_\-+*]+(?:\.[a-z0-9_\-+*]+)*@(.*)$/;
    var n = email.toLowerCase().match(re);
    if ((n&&is_signup&&email.split('@')[0].match(/\+/g)||[]).length>1)
        return false;
    return !!(n && E.is_valid_domain(n[1]));
};

E.get_first_valid_email = function(email){
    return email.split(/\s+/).find(E.is_valid_email); };

// XXX dmitriie: move to email.js:is_alias
E.is_alias_email = function(email){
    if (!E.is_valid_email(email))
        return false;
    var n = email.toLowerCase().match(/^([a-z0-9_.\-+*]+)@.*$/);
    return !!(n && /.+\+.+/.test(n[1]));
};

// XXX vadimr: move to email.js:is_need_sanitize
E.is_email_need_sanitize = function(email){
    var valid_domains = ['gmail.com', 'googlemail.com', 'yahoo.com',
        'yahoo.fr', 'yahoo.co.uk', 'yahoo.com.br', 'yahoo.co.in', 'yahoo.es',
        'yahoo.it', 'yahoo.de', 'yahoo.in', 'yahoo.ca', 'yahoo.com.au',
        'yahoo.co.jp', 'yahoo.com.ar', 'yahoo.com.mx', 'yahoo.co.id',
        'yahoo.com.sg', 'protonmail.ch', 'protonmail.com'];
    return valid_domains.indexOf(E.get_domain_email(email)) !== -1;
};

// XXX vadimr: move to email.js:sanitize
E.sanitize_email = function(email){
    var main = E.get_main_email(email);
    if(!main)
        return;
    var sp = main.split('@');
    return sp[0].replace(/\.*/g, '')+'@'+sp[1];
};

// XXX dmitriie: move to email.js:get_main
E.get_main_email = function(email){
    if (!E.is_valid_email(email))
        return;
    if (E.is_alias_email(email))
        return email.replace(/\+.+@/, '@');
    return email;
};

E.is_ip_in_range = function(ips_range, ip){
    if (!E.is_ip_range(ips_range) || !E.is_ip(ip))
        return false;
    var ips = ips_range.split('-');
    var min_ip = E.ip2num(ips[0]), max_ip = E.ip2num(ips[1]);
    var num_ip = E.ip2num(ip);
    return num_ip>=min_ip && num_ip<=max_ip;
};

E.is_ip_local = function(ip){
    return E.is_ip_in_range('10.0.0.0-10.255.255.255', ip) ||
        E.is_ip_in_range('172.16.0.0-172.31.255.255', ip) ||
        E.is_ip_in_range('192.168.0.0-192.168.255.255', ip) ||
        E.is_ip_in_range('169.254.0.0-169.254.255.255', ip);
};

E.host_lookup = function(lookup, host){
    var pos;
    while (1)
    {
        if (host in lookup)
            return lookup[host];
        if ((pos = host.indexOf('.'))<0)
            return;
        host = host.slice(pos+1);
    }
};

// more-or-less compatible with NodeJS url API
E.uri_obj_href = function(uri){
    return (uri.protocol||'')+(uri.slashes ? '//' : '')
        +(uri.host ? (uri.auth ? uri.auth+'@' : '')+uri.host : '')
        +uri.path
        +(uri.hash||'');
};

var protocol_re = /^((?:about|http|https|file|ftp|ws|wss):)?(\/\/)?/i;
var host_section_re = /^(.*?)(?:[\/?#]|$)/;
var host_re = /^(?:(([^:@]*):?([^:@]*))?@)?([a-zA-Z0-9._+-]*)(?::(\d*))?/;
var path_section_re = /^([^?#]*)(\?[^#]*)?(#.*)?$/;
var path_re_loose = /^(\/(?:.(?![^\/]*\.[^\/.]+$))*\/?)?([^\/]*?(?:\.([^.]+))?)$/;
var path_re_strict = /^(\/(?:.(?![^\/]*(?:\.[^\/.]+)?$))*\/?)?([^\/]*?(?:\.([^.]+))?)$/;

E.parse = function(url, strict){
    function re(expr, str){
        var m;
        try { m = expr.exec(str); } catch(e){ m = null; }
        if (!m)
            return m;
        for (var i=0; i<m.length; i++)
            m[i] = m[i]===undefined ? null : m[i];
        return m;
    }
    url = url||location.href;
    var uri = {orig: url};
    url = replace_slashes(url);
    var m, remaining = url;
    // protocol
    if (!(m = re(protocol_re, remaining)))
        return {};
    uri.protocol = m[1];
    if (uri.protocol!==null)
        uri.protocol = uri.protocol.toLowerCase();
    uri.slashes = !!m[2];
    if (!uri.protocol && !uri.slashes)
    {
        uri.protocol = 'http:';
        uri.slashes = true;
    }
    remaining = remaining.slice(m[0].length);
    // host
    if (!(m = re(host_section_re, remaining)))
        return {};
    uri.authority = m[1];
    remaining = remaining.slice(m[1].length);
    // host elements
    if (!(m = re(host_re, uri.authority)))
        return {};
    uri.auth = m[1];
    uri.user = m[2];
    uri.password = m[3];
    uri.hostname = m[4];
    uri.port = m[5];
    if (uri.hostname!==null)
    {
        uri.hostname = uri.hostname.toLowerCase();
        uri.host = uri.hostname+(uri.port ? ':'+uri.port : '');
    }
    // path
    if (!(m = re(path_section_re, remaining)))
        return {};
    uri.relative = m[0];
    uri.pathname = m[1];
    uri.search = m[2];
    uri.query = uri.search ? uri.search.substring(1) : null;
    uri.hash = m[3];
    // path elements
    if (!(m = re(strict ? path_re_strict : path_re_loose, uri.pathname)))
        return {};
    uri.directory = m[1];
    uri.file = m[2];
    uri.ext = m[3];
    if (uri.file=='.'+uri.ext)
        uri.ext = null;
    // finals
    if (!uri.pathname)
        uri.pathname = '/';
    uri.path = uri.pathname+(uri.search||'');
    uri.href = E.uri_obj_href(uri);
    return uri;
};

E.qs_parse = function(q, bin, safe){
    var obj = {};
    q = q.length ? q.split('&') : [];
    var len = q.length;
    var unescape_val = bin ? function(val){
        return qs.unescapeBuffer(val, true).toString('binary');
    } : safe ? function(val){
        try { return decodeURIComponent(val.replace(/\+/g, ' ')); }
        catch(e){ return val; }
    } : function(val){
        return decodeURIComponent(val.replace(/\+/g, ' '));
    };
    for (var i = 0; i<len; ++i)
    {
        var x = q[i];
        var idx = x.indexOf('=');
        var kstr = idx>=0 ? x.substr(0, idx) : x;
        var vstr = idx>=0 ? x.substr(idx + 1) : '';
        var k = unescape_val(kstr);
        var v = unescape_val(vstr);
        if (obj[k]===undefined)
            obj[k] = v;
        else if (Array.isArray(obj[k]))
            obj[k].push(v);
        else
            obj[k] = [obj[k], v];
    }
    return obj;
};

function token_regex(s, end){ return end ? '^'+s+'$' : s; }

E.http_glob_host = function(host, end){
    var port = '';
    var parts = host.split(':');
    host = parts[0];
    if (parts.length>1)
        port = ':'+parts[1].replace('*', '[0-9]+');
    var n = host.match(/^(|.*[^*])(\*+)$/);
    if (n)
    {
        host = E.http_glob_host(n[1])
        +(n[2].length==1 ? '[^./]+' : '[^/]'+(n[1] ? '*' : '+'));
        return token_regex(host+port, end);
    }
    /* '**' replace doesn't use '*' in output to avoid conflict with '*'
     * replace following it */
    host = host.replace(/\*\*\./, '**').replace(/\*\./, '*')
    .replace(/\./g, '\\.').replace(/\*\*/g, '(([^./]+\\.)+)?')
    .replace(/\*/g, '[^./]+\\.');
    return token_regex(host+port, end);
};

E.http_glob_path = function(path, end){
    if (path[0]=='*')
        return E.http_glob_path('/'+path, end);
    var n = path.match(/^(|.*[^*])(\*+)([^*^\/]*)$/);
    if (n)
    {
        path = E.http_glob_path(n[1])+(n[2].length==1 ? '[^/]+' : '.*')+
            E.http_glob_path(n[3]);
        return token_regex(path, end);
    }
    path = path.replace(/\*\*\//, '**').replace(/\*\//, '*')
    .replace(/\//g, '\\/').replace(/\./g, '\\.')
    .replace(/\*\*/g, '(([^/]+\\/)+)?').replace(/\*/g, '[^/]+\\/');
    return token_regex(path, end);
};

E.http_glob_url = function(url, end){
    var n = url.match(/^((.*):\/\/)?([^\/]+)(\/.*)?$/);
    if (!n)
        return null;
    var prot = n[1] ? n[2] : '*';
    var host = n[3];
    var path = n[4]||'**';
    if (prot=='*')
        prot = 'https?';
    host = E.http_glob_host(host);
    path = E.http_glob_path(path);
    return token_regex(prot+':\\/\\/'+host+path, end);
};

E.root_url_cmp = function(a, b){
    var a_s = a.match(/^[*.]*([^*]+)$/);
    var b_s = b.match(/^[*.]*([^*]+)$/);
    if (!a_s && !b_s)
        return false;
    var re, s;
    if (a_s && b_s && a_s[1].length>b_s[1].length || a_s && !b_s)
    {
        s = a_s[1];
        re = b;
    }
    else
    {
        s = b_s[1];
        re = a;
    }
    s = E.add_proto(s)+'/';
    if (!(re = E.http_glob_url(re, 1)))
        return false;
    try { re = new RegExp(re); }
    catch(e){ return false; }
    return re.test(s);
};

E.qs_strip = function(url){ return /^[^?#]*/.exec(url)[0]; };

// mini-implementation of zescape.qs to avoid dependency of escape.js
E.qs_str = function(qs){
    var q = [];
    for (var k in qs)
    {
        (Array.isArray(qs[k]) ? qs[k] : [qs[k]]).forEach(function(v){
            q.push(encodeURIComponent(k)+'='+encodeURIComponent(v)); });
    }
    return q.join('&');
};

E.qs_add = function(url, qs){
    var u = E.parse(url), q = assign(u.query ? E.qs_parse(u.query) : {}, qs);
    u.path = u.pathname+'?'+E.qs_str(q);
    return E.uri_obj_href(u);
};

E.qs_parse_url = function(url){
    return E.qs_parse(url.replace(/(^.*\?)|(^[^?]*$)/, ''));
};

return E; }); }());
