// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true, es6:true*/
import React from 'react';
import Pure_component from '/www/util/pub/pure_component.js';
import $ from 'jquery';
import setdb from '../../../util/setdb.js';
import {Config, Tab_context} from './common.js';

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

const log_level_opt = [
    {key: `Default (error)`, value: ''},
    {key: `none`, value: 'none'},
    {key: `error`, value: 'error'},
    {key: `warn`, value: 'warn'},
    {key: `verbose`, value: 'verbose'},
];

export default class General extends Pure_component {
    state = {};
    get_curr_plan = setdb.get('head.proxy_edit.get_curr_plan');
    set_field = setdb.get('head.proxy_edit.set_field');
    componentDidMount(){
        this.setdb_on('head.proxy_edit.form', form=>{
            form && this.setState({form});
        });
        this.setdb_on('head.consts', consts=>{
            consts && consts.proxy && this.setState({proxy: consts.proxy});
        });
    }
    multiply_changed = val=>{
        const {form} = this.state;
        const size = Math.max(form.ips.length, form.vips.length);
        if (val)
        {
            this.set_field('pool_size', 1);
            this.set_field('multiply', size);
            this.open_modal();
            return;
        }
        this.set_field('pool_size', size);
        this.set_field('multiply', 1);
    };
    open_modal = ()=>$('#allocated_ips').modal('show');
    render(){
        if (!this.state.form)
            return null;
        if (!this.state.proxy)
            return null;
        // XXX krzysztof: cleanup type
        const curr_plan = this.get_curr_plan();
        let type;
        if (curr_plan&&curr_plan.type=='static')
            type = 'ips';
        else if (curr_plan&&!!curr_plan.vip)
            type = 'vips';
        const form = this.state.form;
        const note_ips = form.multiply_ips ?
            <a className="link" onClick={this.open_modal}>Select IPs</a> :
            null;
        const note_vips = form.multiply_vips ?
            <a className="link" onClick={this.open_modal}>Select gIPs</a> :
            null;
        return <div className="general">
              <Tab_context.Provider value="general">
                <Config type="text" id="internal_name"/>
                <Config type="number" id="port"/>
                <Config type="number" id="socks" disabled={true}
                  val_id="port"/>
                <Config type="text" id="password" disabled/>
                <Config type="pins" id="whitelist_ips"/>
                <Config type="yes_no" id="ssl"/>
                <Config type="select" data={route_err_opt} id="route_err"/>
                <Config type="select_number" id="multiply" range="medium"
                  disabled={form.multiply_ips||form.multiply_vips}/>
                {type=='ips' &&
                  <Config type="yes_no" id="multiply_ips"
                    on_change={this.multiply_changed} note={note_ips}/>
                }
                {type=='vips' &&
                  <Config type="yes_no" id="multiply_vips"
                    on_change={this.multiply_changed} note={note_vips}/>
                }
                <Config type="yes_no" id="secure_proxy"/>
                <Config type="select" id="iface"
                  data={this.state.proxy.iface.values}/>
                <Config type="select" id="log" data={log_level_opt}/>
                <Config type="select" id="debug" data={debug_opt}/>
              </Tab_context.Provider>
            </div>;
    }
}
