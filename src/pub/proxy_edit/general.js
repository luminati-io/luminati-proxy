// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true, es6:true*/
import React from 'react';
import $ from 'jquery';
import setdb from '../../../util/setdb.js';
import {Config} from './common.js';
import {withContext} from 'recompose';
import PropTypes from 'prop-types';
const provider = provide=>withContext({provide: PropTypes.object},
    ()=>({provide}));

const route_err_opt = [
    {key: 'Default (pass_dyn)', value: ''},
    {key: 'pass_dyn', value: 'pass_dyn'},
    {key: 'block', value: 'block'}
];

const debug_opt = [
    {key: `Default (full)`, value: ''},
    {key: 'none', value: 'none'},
    {key: 'full', value: 'full'},
];

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
          <Config type="text" id="password" disabled/>
          <Config type="pins" id="whitelist_ips"/>
          <Config type="yes_no" id="ssl"/>
          <Config type="select" data={route_err_opt} id="route_err"/>
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
          <Config type="select" id="iface" data={props.proxy.iface.values}/>
          <Config type="select" id="log" data={props.proxy.log.values}/>
          <Config type="select" id="debug" data={debug_opt}/>
        </div>;
});
