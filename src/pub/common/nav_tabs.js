// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true, es6:true*/
import React from 'react';
import classnames from 'classnames';
import {withRouter, Route} from 'react-router-dom';
import Tooltip from './tooltip.js';
import {T} from './i18n.js';
import '../css/nav_tabs.less';

export const Nav_tabs = ({children, narrow, set_tab, cur_tab})=>
    <div className={classnames('nav_tabs', {narrow})}>
      {
        React.Children.map(children, c=>
          React.cloneElement(c, {set_tab, cur_tab, narrow}))
      }
    </div>;

export const Nav_tab = withRouter(props=>{
    const {id} = props;
    return <Route path={`${props.match.path}/${id}`}>{({match})=>{
        const active = props.cur_tab==id||!!match;
        const {disabled} = props;
        const btn_class = classnames('btn_tab', {active, disabled});
        return <T>{t=><Tooltip title={t(props.tooltip)}>
              <div onClick={()=>!disabled && props.set_tab(id)}
                className={btn_class}>
                {!props.narrow && <div className={classnames('icon', id)}/>}
                <div className="title"><T>{props.title}</T></div>
                <div className="arrow"/>
              </div>
            </Tooltip>}</T>;
    }}
    </Route>;
});
