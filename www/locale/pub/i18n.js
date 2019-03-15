// LICENSE_CODE ZON
'use strict'; /*jslint node:true, react:true*/
var define;
var is_node = typeof module=='object' && module.exports;
if (is_node)
    define = require('../../../util/require_node.js').define(module, '..');
else
    define = self.define;

define(['/util/setdb.js', '/util/storage.js', '/www/util/pub/urlp.js'],
    (setdb, storage, zurlp)=>
{

// XXX saarya: change key once angular is removed
const storage_key = 'NG_TRANSLATE_LANG_KEY';
let path;
const init = (supported_lang, _path, def_lang, lang_map)=>{
    path = _path;
    setdb.set('i18n.config', {supported_lang, path: _path});
    const urlp = new zurlp.Urlp();
    const qs_hl = lang_map&&lang_map[urlp.qs.hl]||urlp.qs.hl;
    const lang = qs_hl||storage.get(storage_key)||def_lang;
    if (lang)
        set_curr_lang(lang);
};
const set_curr_lang = lang=>{
    storage.set(storage_key, lang);
    setdb.set('i18n.curr_lang', lang);
    require(['text!'+path+'/'+lang],
        translation=>setdb.set('i18n.translation', JSON.parse(translation)),
        ()=>{
            setdb.set('i18n.translation', null),
            console.error('error loading translation for '+lang);
        }
    );
};
const get_translation = (translation, key)=>{
    if (!translation || !key)
        return key;
    if (!translation[key]&&!mute_logging)
        console.info('missing translation for: "'+key+'"');
    return translation[key]||key;
};
const t = (key, translation)=>{
    if (!translation)
        translation = setdb.get('i18n.translation');
    return get_translation(translation, key);
};
const E = {t, init, set_curr_lang};
let mute_logging = false; // for development
E.mute_logging = ()=>mute_logging = true;
return E;

});
