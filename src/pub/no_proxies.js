// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true, es6:true*/
import React from 'react';
import Add_proxy from './add_proxy.js';
import $ from 'jquery';

const open_modal = ()=>{ $('#add_new_proxy_modal').modal(); };

const No_proxies = ()=>(
    <div>
      <Add_proxy/>
      <div className="no_proxies">
        <button onClick={open_modal}
          className="btn btn_lpm btn_lpm_big btn_add_port">
          Start
        </button>
      </div>
    </div>
);

export default No_proxies;
