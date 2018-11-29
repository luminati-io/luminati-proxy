// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true, es6:true*/
import React from 'react';
import {Config} from './common.js';
import {Note} from '../common.js';
import Pure_component from '../../../www/util/pub/pure_component.js';
import {withContext} from 'recompose';
import $ from 'jquery';
import setdb from '../../../util/setdb.js';
import PropTypes from 'prop-types';
const provider = provide=>withContext({provide: PropTypes.object},
    ()=>({provide}));

const pool_type_opt = [
    {key: 'Default (Sequential)', value: ''},
    {key: 'Sequential', value: 'sequential'},
    {key: 'Round-robin', value: 'round-robin'},
    {key: 'Long Availability', value: 'long_availability'},
];

export default provider({tab_id: 'rotation'})(
class Rotation extends Pure_component {
    state = {};
    goto_field = setdb.get('head.proxy_edit.goto_field');
    componentDidMount(){
        this.setdb_on('head.proxy_edit.disabled_fields', disabled_fields=>{
            disabled_fields && this.setState({disabled_fields});
        });
    }
    get_type = ()=>{
        const curr_plan = this.props.get_curr_plan();
        let type;
        if (curr_plan&&curr_plan.type=='static')
            type = 'ips';
        else if (curr_plan&&!!curr_plan.vip)
            type = 'vips';
        return type;
    };
    open_modal = ()=>$('#allocated_ips').modal('show');
    move_to_ssl = ()=>this.goto_field('ssl');
    render(){
        if (!this.state.disabled_fields)
            return null;
        const form = this.props.form;
        const type = this.get_type();
        const render_modal = ['ips', 'vips'].includes(type);
        let pool_size_note;
        if (!this.state.disabled_fields.pool_size && render_modal)
        {
            pool_size_note =
                <a className="link" onClick={this.open_modal}>
                  {'set from allocated '+(type=='ips' ? 'IPs' : 'gIPs')}
                </a>;
        }
        const sess_note =
            <Note>
              <span>Should be used only when </span>
              <a className="link" onClick={this.move_to_ssl}>SSL analyzing</a>
              <span> is turned on.</span>
            </Note>;
        return <div>
              <Config type="select" id="pool_type" data={pool_type_opt}/>
              <Config type="select_number" id="pool_size" allow_zero
                note={pool_size_note}
                disabled={form.ips.length||form.vips.length}/>
              <Config type="select_number" id="keep_alive" sufix="seconds"
                data={[0, 45]}/>
              <Config type="select_number" id="max_requests"/>
              <Config type="select_number" id="session_duration"
                sufix="seconds"/>
              <Config type="yes_no" id="sticky_ip"/>
              <Config type="yes_no" id="session_random"
                disabled={form.sticky_ip}/>
              {!form.session_random && !form.sticky_ip &&
                <Config type="text" id="session"/>}
              <Config type="text" id="seed"/>
              <Config type="yes_no" id="session_termination" note={sess_note}/>
            </div>;
    }
});

