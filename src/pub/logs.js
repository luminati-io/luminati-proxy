// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true, es6:true*/
import React from 'react';
import Pure_component from '../../www/util/pub/pure_component.js';
import Har_viewer from './har_viewer.js';
import {withRouter} from 'react-router-dom';
import zurl from 'hutil/util/url';

export const Logs = withRouter(({location})=>{
    const qs_o = zurl.qs_parse((location.search||'').substr(1));
    return (
        <div className="lpm logs">
          <Har_viewer {...qs_o}/>
        </div>
    );
});

export const Dock_logs = ()=>(
    <div className="lpm dock_logs">
      <Har_viewer dock_mode/>
    </div>
);
