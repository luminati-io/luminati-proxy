// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true*/
import React from 'react';
import _ from 'lodash';
import setdb from '../../../util/setdb.js';

const E = {};

export const TranslationContext = React.createContext('en');

let top_origin, notify;
const origins = {
    cn: 'luminati-china.biz',
    lum: 'luminati.io',
    rest: 'brightdata.com',
};
const except_paths = ['/whitelist_ips'];
if (window != window.parent)
{
    if (!(top_origin = window.localStorage.getItem('cp_host'))) // dev purpose
    {
        const host = window.location.host;
        if (host.includes(origins.cn))
            top_origin = `https://${origins.cn}`;
        else if (host.includes(origins.lum) || host.includes(origins.rest))
            top_origin = `https://${origins.rest}`;
    }
    notify = !!top_origin;
}
const msgs = [];
const missing_cache = {};
const notify_missing_key = (key, lang)=>{
    if (!notify)
        return void (missing_cache[lang][key] = 1);
    console.info('missing translation for \'%s\'', key);
    let lpm_token = setdb.get('head.settings.lpm_token');
    if (!lpm_token)
    {
        const sp = new URLSearchParams(window.location.search);
        lpm_token = sp.get('lpm_token');
    }
    msgs.push(JSON.parse(JSON.stringify({
        type: 'pmgr.i18n_missing_key',
        key,
        lang,
        path: window.location.pathname,
        token: lpm_token.split('|')[0],
    })));
    missing_cache[lang][key] = 1;
    flushMessages();
};

let flushInterval = null;
const flushMessages = _.debounce(()=>{
    clearInterval(flushInterval);
    let msg;
    flushInterval = setInterval(()=>{
        if (!(msg = msgs.pop()))
            return clearInterval(flushInterval);
        window.parent.postMessage(msg, top_origin);
    }, 100);
}, 250);

export const t = (key, translation)=>{
    const curr_lang = get_curr_lang();
    if (!translation)
        translation = get_translations(curr_lang);
    if (curr_lang != 'en' && !missing_cache[curr_lang][key] &&
        !translation[key])
    {
        notify_missing_key(key, curr_lang);
    }
    return translation[key]||key;
};
E.t = t;

// XXX krzysztof: try to reuse T from /www/locale/pub
export const T = props=>{
    React.useContext(TranslationContext);
    const {children} = props;
    if (typeof children=='function')
        return children(t);
    if (typeof children=='string')
        return t(children.replace(/\s+/g, ' '));
    return null;
};
E.T = T;

export const langs = {
    en: {name: 'English', flag: 'gb', t: {}},
    ru: {name: 'русский', flag: 'ru', t: {}},
    'zh-hans': {name: '简体中文', flag: 'cn', t: {}},
};
E.langs = langs;
Object.keys(langs).forEach(l=>missing_cache[l] = {});

export const get_translations = lang=>langs[lang] && langs[lang].t || null;
export const get_curr_lang = ()=>window.localStorage.getItem('lang')||'en';
export const set_curr_lang = lang=>{
    lang = langs[lang] ? lang : 'en';
    window.localStorage.setItem('lang', lang);
    setdb.set('i18n.curr_lang', lang);
};
export const is_except_path = path=>except_paths.includes(path);
E.get_translations = get_translations;
E.get_curr_lang = get_curr_lang;
E.set_curr_lang = set_curr_lang;
E.is_except_path = is_except_path;

// so all customers before the lang code change
// transit without loss of the lang setting
if (get_curr_lang() == 'cn')
    set_curr_lang('zh-hans');

export const Language = props=>{
    const curr_lang = React.useContext(TranslationContext);
    if (!curr_lang || props.hidden)
        return null;
    return <div className="dropdown">
              <a className="link dropdown-toggle" data-toggle="dropdown">
                <Lang_cell lang={curr_lang}/>
              </a>
              <ul className="dropdown-menu dropdown-menu-right">
                {Object.keys(langs).map(lang=>
                  <Lang_row set_lang={set_curr_lang} key={lang} lang={lang}/>
                )}
              </ul>
            </div>;
};
E.Language = Language;

const Lang_row = ({lang, set_lang})=>
    <li onClick={set_lang.bind(this, lang)}>
      <a><Lang_cell lang={lang}/></a>
    </li>;

const Lang_cell = ({lang})=>
    <React.Fragment>
      <span className={`flag-icon flag-icon-${langs[lang].flag}`}/>
      {langs[lang].name}
    </React.Fragment>;

export default E;
