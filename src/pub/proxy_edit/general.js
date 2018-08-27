// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true, es6:true*/
import React from 'react';
import $ from 'jquery';
import setdb from '../../../util/setdb.js';
import {Config} from './common.js';
import {normalizers} from '../util.js';
import {withContext} from 'recompose';
import PropTypes from 'prop-types';
const provider = provide=>withContext({provide: PropTypes.object},
    ()=>({provide}));

export default provider({tab_id: 'general'})(props=>{
    const set_field = setdb.get('head.proxy_edit.set_field');
    const open_modal = ()=>{ $('#allocated_ips').modal('show'); };
    const multiply_changed = val=>{
        const size = Math.max(props.form.ips.length, props.form.vips.length);
        if (val)
        {
            set_field('pool_size', 1);
            set_field('multiply', size);
            open_modal();
            return;
        }
        set_field('pool_size', size);
        set_field('multiply', 1);
    };
    // XXX krzysztof: cleanup type
    const curr_plan = props.get_curr_plan();
    let type;
    if (curr_plan&&curr_plan.type=='static')
        type = 'ips';
    else if (curr_plan&&!!curr_plan.vip)
        type = 'vips';
    const note_ips = props.form.multiply_ips ?
        <a className="link" onClick={open_modal}>Select IPs</a> : null;
    const note_vips = props.form.multiply_vips ?
        <a className="link" onClick={open_modal}>Select gIPs</a> : null;
    const mul_disabled = props.form.multiply_ips||props.form.multiply_vips;
    return <div>
          <Config type="text" id="internal_name"/>
          <Config type="number" id="port"/>
          <Config type="number" id="socks" disabled={true} val_id="port"/>
          <Config type="text" id="password"/>
          <Config type="text" id="whitelist_ips" save_on_blur
            validator={normalizers.ips_list}/>
          <Config type="yes_no" id="ssl"/>
          <Config type="select_number" id="multiply" disabled={mul_disabled}
            range="medium"/>
          {type=='ips' &&
            <Config type="yes_no" id="multiply_ips"
              on_change={multiply_changed} note={note_ips}/>
          }
          {type=='vips' &&
            <Config type="yes_no" id="multiply_vips"
              on_change={multiply_changed} note={note_vips}/>
          }
          <Config type="yes_no" id="secure_proxy"/>
          <Config type="yes_no" id="allow_proxy_auth"/>
          <Config type="select" id="iface" data={props.proxy.iface.values}/>
        </div>;
});
