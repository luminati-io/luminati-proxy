// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true, es6:true*/
import React from 'react';
import Har_viewer from './har_viewer.js';
import {withRouter} from 'react-router-dom';
import zurl from '../../util/url.js';
import Pure_component from '/www/util/pub/pure_component.js';
import './css/logs.less';

export const Logs = withRouter(class Logs extends Pure_component {
    state = {cur_tab: 'har'};
    set_tab = id=>this.setState({cur_tab: id});
    render(){
        const {location} = this.props;
        const qs_o = zurl.qs_parse((location.search||'').substr(1));
        return <div className="logs vbox"
                style={{height: '100%', width: '100%', padding: 15}}>
                <Har_viewer {...qs_o}/>
              </div>;
    }
});

export const Dock_logs = ()=>
    <div className="dock_logs">
      <Har_viewer dock_mode/>
    </div>;
