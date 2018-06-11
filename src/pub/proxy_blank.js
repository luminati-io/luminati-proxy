// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true, es6:true*/
import React from 'react';
import Proxy_add from './proxy_add.js';
import $ from 'jquery';

const open_modal = ()=>{ $('#add_new_proxy_modal').modal(); };

const Proxy_blank = ()=>
    <div>
      <Proxy_add/>
      <div className="no_proxies">
        <button onClick={open_modal}
          className="btn btn_lpm btn_lpm_big btn_add_port">
          Start
        </button>
      </div>
    </div>;

export default Proxy_blank;
