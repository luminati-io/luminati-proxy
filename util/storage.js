// LICENSE_CODE ZON ISC
'use strict'; /*zlint br*//*jslint node:true, browser:true*/
(function(){
var define;
var is_node = typeof module=='object' && module.exports;
if (!is_node)
    define = self.define;
else
    define = function(){};

define(['cookie', '/util/util.js'], function(cookie, zutil){
var E = {};
var storage;

function have_local_storage(){
    try {
        var _ = window.localStorage;
        if (_.length)
            return true;
        _.setItem('_', 0);
        _.removeItem('_');
        return true;
    } catch(e){}
}

function select_local_storage(){ storage = window.localStorage; }

function select_cookies(domain){
    var cookie_opt = {domain: '.'+domain, path: '/', expires: 30};
    storage = {getItem: cookie.get,
        setItem: function(key, val){ cookie.set(key, val, cookie_opt); },
        removeItem: function(key){ cookie.remove(key, cookie_opt); },
    };
}

E.init = function(opt){
    var domain;
    try { domain = document.location.hostname; }
    catch(e){ domain = 'luminati.io'; }
    if (typeof opt=='string')
        domain = opt;
    // XXX arik HACK: remove test_storage once all tests are fixed and we can
    // enable it
    if (E.is_test_storage = zutil.get(opt, 'test_storage') && zutil.is_mocha())
        return E.test_storage = {};
    if (have_local_storage())
        return select_local_storage();
    console.error('cannot use localStorage, using cookies instead');
    select_cookies(domain);
};
E.init();

E.on_err = function(){};

// XXX arik: add simple storage test
E.set = function(key, val){
    if (E.is_test_storage)
        return E.test_storage[key] = val;
    try { return storage.setItem(key, val); }
    catch(e){ E.on_err('storage_set', key, e); }
};

E.get = function(key){
    if (E.is_test_storage)
        return E.test_storage[key];
    try { return storage.getItem(key); }
    catch(e){ E.on_err('storage_get', key, e); }
};

E.get_int = function(key){ return +E.get(key)||0; };

E.clr = function(key){
    if (E.is_test_storage)
        return delete E.test_storage[key];
    try { storage.removeItem(key); }
    catch(e){ E.on_err('storage_clr', key, e); }
};

E.set_json = function(key, val){
    try { return E.set(key, JSON.stringify(val||null)); }
    catch(e){ E.on_err('storage_set_json', key, e); }
};

E.get_json = function(key){
    var val = E.get(key);
    if (!val)
        return val;
    try { val = JSON.parse(val); }
    catch(e){ console.log('err '+e); }
    return val;
};

return E; }); })();
