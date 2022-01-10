// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, browser:true*/
(function(){
var is_node = typeof module=='object' && module.exports;
var define = !is_node ? self.define
    : require('./require_node.js').define(module, '../');
define(['cookie', '/util/util.js'], function(cookie, zutil){
var E = {};
var storage;

E.get = function(key, opt){
    return storage.getItem(key);
};

E.get_auto = function(key){
    var val = storage.getItem(key);
    if (val==null)
        return val;
    if (val=='undefined')
        return undefined;
    if (val=='null')
        return null;
    if (val=='true')
        return true;
    if (val=='false')
        return false;
    if (/^([+-])?(\d+)?(\.\d+)?$/.test(val))
        return +val;
    return val;
};

E.get_bool = function(key){
    var val = storage.getItem(key);
    return !(val==null || val==='' || val=='0' || val=='false' || val=='no');
};

E.get_num = function(key){
    var val = storage.getItem(key);
    return +val||0;
};

E.get_json = function(key){
    var val = E.get(key);
    if (val!=null)
    {
        try { return JSON.parse(val); }
        catch(e){ console.log('err', e); }
    }
    return null;
};

E.set = function(key, val){
    storage.setItem(key, val);
};

E.set_auto = function(key, val){
    if (val==null)
        return storage.removeItem(key);
    var str_val;
    if (typeof val=='string')
        str_val = val;
    else if (typeof val!='object')
        str_val = ''+val;
    else if (val instanceof Date)
        str_val = val.toISOString();
    else
        str_val = JSON.stringify(val);
    storage.setItem(key, str_val);
};

E.set_json = function(key, val){
    var json_val = val==null ? null : val;
    storage.setItem(key, JSON.stringify(json_val));
};

E.remove = function(key){
    storage.removeItem(key);
};

// (legacy)
E.get_int = E.get_number;
E.clr = E.remove;

// -- init/bootstrapping --

E.init = function(opt){
    opt = opt||{};
    var mode = resolve_mode(opt);
    storage = get_mode_storage(mode, opt);
    if (!is_node)
        window.zstorage = storage;
};

var get_mode_storage = function(mode, opt){
    if (mode=='local_storage')
        return window.localStorage;
    if (mode=='cookies')
    {
        var domain;
        if (!(domain = opt.domain))
        {
            try { domain = document.location.hostname; }
            catch(e){ domain = 'brightdata.com'; }
        }
        var cookie_opt = {domain: '.'+domain, path: '/', expires: 30};
        return {
            getItem: function(key){ return cookie.get(key); },
            setItem: function(key, val){ cookie.set(key, val, cookie_opt); },
            removeItem: function(key){ cookie.remove(key, cookie_opt); },
        };
    }
    if (mode=='fake')
    {
        E.t = {data: {}};
        return {
            getItem: function(k){ return E.t.data[k]; },
            setItem: function(k, v){ E.t.data[k] = ''+v; },
            removeItem: function(k){ delete E.t.data[k]; },
        };
    }
    throw new Error('Invalid mode: '+mode);
};

var resolve_mode = function(opt){
    if (opt.mode)
        return opt.mode;
    if (!is_node && is_local_storage_obj(window.localStorage))
        return 'local_storage';
    if (!is_node)
        return 'cookies';
    return 'fake';
};

var is_local_storage_obj = function(obj){
    try {
        if (obj.length)
            return true;
        obj.setItem('_', 0);
        obj.removeItem('_');
        return true;
    } catch(e){
        return false;
    }
};

E.init();

return E; }); })();
