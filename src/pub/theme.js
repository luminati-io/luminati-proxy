// LICENSE_CODE ZON ISC
'use strict'; /*jslint browser:true, react:true, es9:true*/
import React, {useState, useEffect, useContext} from 'react';
import _ from 'lodash4';

export const Theme_context = React.createContext();

const get_system_theme = ()=>window
    .matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';

const set_theme_attr = theme=>{
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.setAttribute('data-bs-theme', theme);
};

export const Theme_provider = ({children})=>{
    const [theme_preference, set_theme_preference] = useState(()=>
        localStorage.getItem('lpm_theme') || 'system');
    const [actual_theme, set_actual_theme] = useState(()=>{
        const pref = localStorage.getItem('lpm_theme') || 'system';
        return pref === 'system' ? get_system_theme() : pref;
    });
    const set_theme = new_preference=>{
        if (!theme_types.includes(new_preference))
            return console.warn('Unknown theme', new_preference);
        console.warn('Theme styling under development');
        console.log('Setting', new_preference, 'theme');
        set_theme_preference(new_preference);
        localStorage.setItem('lpm_theme', new_preference);
        const theme = new_preference === 'system' ? get_system_theme()
            : new_preference;
        set_actual_theme(theme);
        set_theme_attr(theme);
    };
    useEffect(()=>{
        set_theme_attr(actual_theme);
        const media_query = window.matchMedia('(prefers-color-scheme: dark)');
        const handle_change = e=>{
            if (theme_preference === 'system')
            {
                const new_theme = e.matches ? 'dark' : 'light';
                set_actual_theme(new_theme);
                set_theme_attr(new_theme);
            }
        };
        media_query.addEventListener('change', handle_change);
        return ()=>media_query.removeEventListener('change', handle_change);
    }, [theme_preference, actual_theme]);
    return (
        <Theme_context.Provider value={{theme_preference, theme: actual_theme,
            set_theme}}>
            {children}
        </Theme_context.Provider>
    );
};

export const use_theme = ()=>{
    const context = useContext(Theme_context);
    if (!context)
        throw new Error('use_theme must be used within Theme_provider');
    return context;
};

export const init_theme = ()=>{
    const preference = localStorage.getItem('lpm_theme') || 'system';
    const theme = preference === 'system' ? get_system_theme() : preference;
    set_theme_attr(theme);
    console.log('Init theme', preference);
    return {preference, theme};
};

export const theme_types = ['system', 'light', 'dark'];

export const Theme_nav = props=>{
    const {theme_preference, set_theme} = use_theme();
    if (props.hidden)
        return null;
    return <div className="dropdown">
        <a className="link dropdown-toggle" data-bs-toggle='dropdown'
            data-toggle="dropdown">
            {_.capitalize(theme_preference)+' theme'}
        </a>
        <ul className="dropdown-menu dropdown-menu-right">
        {theme_types.map(theme=>
            <li key={theme} onClick={set_theme.bind(this, theme)}>
                <a>{_.capitalize(theme)+' theme'}</a>
            </li>
        )}
        </ul>
    </div>;
};
