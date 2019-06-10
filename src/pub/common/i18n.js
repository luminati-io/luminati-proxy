// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true*/
import React from 'react';
import Pure_component from '/www/util/pub/pure_component.js';
import Cn from '/www/lum/pub/locale/zh_CN.json';
import Ru from '/www/lum/pub/locale/ru.json';
import setdb from '../../../util/setdb.js';

const t = (key, translation)=>{
    if (!key || !translation)
        return key;
    if (!translation[key])
        console.info('missing translation for \'%s\'', key);
    return translation[key]||key;
};

// XXX krzysztof: try to reuse T from /www/locale/pub
export class T extends Pure_component {
    state = {};
    componentDidMount(){
        this.setdb_on('i18n.translation', translation=>{
            if (translation===undefined)
                return;
            this.setState({translation});
        });
    }
    render(){
        const {translation} = this.state;
        const {children} = this.props;
        if (typeof children=='function')
            return children(key=>t(key, translation));
        if (typeof children=='string')
            return t(children.replace(/\s+/g, ' '), translation);
        return null;
    }
}

export const with_tt = (keys, Component)=>class extends Pure_component {
    state = {};
    componentDidMount(){
        this.setdb_on('i18n.translation', translation=>{
            if (translation===undefined)
                return;
            this.setState({translation});
        });
    }
    render(){
        const {translation} = this.state;
        const {...props} = this.props;
        const translations = keys.reduce((acc, k)=>{
            const translated = t(k.replace(/\s+/g, ' '), translation);
            return {...acc, [k]: translated};
        }, {});
        return React.createElement(Component, {...props, t: translations});
    }
};

export const langs = {
    en: {name: 'English', flag: 'gb'},
    ru: {name: 'русский', flag: 'ru', t: Ru},
    cn: {name: '简体中文', flag: 'cn', t: Cn},
};

export const set_lang = lang=>{
    setdb.set('i18n.translation', langs[lang].t || null);
};

export class Language extends Pure_component {
    state = {};
    componentDidMount(){
        let lang = window.localStorage.getItem('lang');
        if (lang)
            return this.set_lang(lang);
        this.setdb_on('head.conn', conn=>{
            if (!conn)
                return;
            if (Object.keys(langs).includes(conn.current_country))
                lang = conn.current_country;
            else
                lang = 'en';
            this.set_lang(lang);
        });
    }
    set_lang = lang=>{
        this.setState({lang});
        set_lang(lang);
        let curr = window.localStorage.getItem('lang');
        if (curr!=lang)
            window.localStorage.setItem('lang', lang);
    };
    render(){
        if (!this.state.lang)
            return null;
        return <div className="dropdown">
              <a className="link dropdown-toggle" data-toggle="dropdown">
                <Lang_cell lang={this.state.lang}/>
              </a>
              <ul className="dropdown-menu dropdown-menu-right">
                {Object.keys(langs).map(lang=>
                  <Lang_row set_lang={this.set_lang} key={lang} lang={lang}/>
                )}
              </ul>
            </div>;
    }
}

const Lang_row = ({lang, set_lang})=>
    <li onClick={set_lang.bind(this, lang)}>
      <a><Lang_cell lang={lang}/></a>
    </li>;

const Lang_cell = ({lang})=>
    <React.Fragment>
      <span className={`flag-icon flag-icon-${langs[lang].flag}`}/>
      {langs[lang].name}
    </React.Fragment>;
