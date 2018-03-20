// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true, es6:true*/
import React from 'react';
import $ from 'jquery';

const open_modal = ()=>{ $('#add_new_proxy_modal').modal(); };

const No_proxies = ()=>(
    <div className="lpm no_proxies">
      <div className="attention_img"></div>
      <div className="header">
        <h1>There are no proxies configured</h1></div>
      <button onClick={open_modal} className="btn btn_lpm btn_add_port">
        Create new proxy port</button>
    </div>
);

export default No_proxies;
