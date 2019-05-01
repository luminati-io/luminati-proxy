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

export const set_lang = lang=>{
    if (lang=='cn')
        setdb.set('i18n.translation', Cn);
    else if (lang=='ru')
        setdb.set('i18n.translation', Ru);
    else
        setdb.set('i18n.translation', null);
};

export const init = ()=>{
    // XXX krzysztof: TODO
};

export const langs = {
    cn: {name: '简体中文', flag: 'cn'},
    en: {name: 'English', flag: 'gb'},
    ru: {name: 'русский', flag: 'ru'}
};
