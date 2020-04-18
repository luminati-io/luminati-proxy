// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true, es6:true*/
import React from 'react';
import $ from 'jquery';
import Tooltip from './common/tooltip.js';
import {T} from './common/i18n.js';
import './css/proxy_blank.less';

const open_modal = ()=>{ $('#add_new_proxy_modal').modal(); };

const Proxy_blank = ()=>
    <div>
      <div className="no_proxies">
        <Tooltip title="Click to create your first proxy port">
          <button onClick={open_modal}
            className="btn btn_lpm btn_lpm_big btn_add_port">
            <T>Start</T>
          </button>
        </Tooltip>
      </div>
    </div>;

export default Proxy_blank;
