// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true, es6:true*/
import React from 'react';
import {Note} from '../common.js';
import {Config, Tab_context} from './common.js';
import {T} from '../common/i18n.js';
import Pure_component from '/www/util/pub/pure_component.js';
import $ from 'jquery';
import setdb from '../../../util/setdb.js';

const reverse_lookup_opt = [
    {key: 'No', value: ''},
    {key: 'DNS', value: 'dns'},
    {key: 'File', value: 'file'},
    {key: 'Values', value: 'values'},
];

const dns_opt = [
    {key: 'Local (default) - resolved by the super proxy', value: 'local'},
    {key: 'Remote - resolved by peer', value: 'remote'},
];

const proxy_opt = [
    {key: 'Automatic (default)', value: ''},
    {key: 'China', value: 'cn'},
];

export default class Rotation extends Pure_component {
    state = {};
    goto_field = setdb.get('head.proxy_edit.goto_field');
    set_field = setdb.get('head.proxy_edit.set_field');
    get_curr_plan = setdb.get('head.proxy_edit.get_curr_plan');
    componentDidMount(){
        this.setdb_on('head.proxy_edit.disabled_fields', disabled_fields=>{
            disabled_fields && this.setState({disabled_fields});
        });
        this.setdb_on('head.proxy_edit.form', form=>{
            form && this.setState({form});
        });
    }
    get_type = ()=>{
        // XXX krzysztof: cleanup type (index.js rotation.js general.js)
        const curr_plan = this.get_curr_plan();
        let type;
        if (curr_plan && (curr_plan.type||'').startsWith('static'))
            type = 'ips';
        else if (curr_plan&&!!curr_plan.vip)
            type = 'vips';
        return type;
    };
    open_modal = ()=>$('#allocated_ips').modal('show');
    set_ssl = ()=>this.set_field('ssl', true);
    render(){
        if (!this.state.disabled_fields)
            return null;
        const form = this.state.form;
        if (!form)
            return null;
        const type = this.get_type();
        const render_modal = ['ips', 'vips'].includes(type);
        let pool_size_note;
        if (!this.state.disabled_fields.pool_size && render_modal)
        {
            pool_size_note =
                <a className="link" onClick={this.open_modal}>
                  {'manage '+(type=='ips' ? 'IPs' : 'gIPs')}
                </a>;
        }
        const sess_note =
            <Note>
              <span><T>Can be used only when</T></span>{' '}
              <a className="link" onClick={this.set_ssl}>
                <T>SSL analyzing</T>
              </a>{' '}
              <span><T>is turned on.</T></span>
            </Note>;
        return <div className="rotation">
              <Tab_context.Provider value="rotation">
                <Config type="select_number" id="pool_size"
                  note={pool_size_note}/>
                <Config type="yes_no" id="rotate_session"
                  disabled={this.state.form.sticky_ip}/>
                <Config type="yes_no" id="sticky_ip"
                  disabled={this.state.form.rotate_session}/>
                <Config type="text" id="session"/>
                <Config type="yes_no" id="session_termination"
                  note={!this.state.form.ssl && sess_note || ''}
                  disabled={!this.state.form.ssl}/>
                <Config type="select" id="proxy_country" data={proxy_opt}/>
                <Config type="select" id="dns" data={dns_opt}/>
                <Config type="select" id="reverse_lookup"
                  data={reverse_lookup_opt}/>
                {this.state.form.reverse_lookup=='file' &&
                  <Config type="text" id="reverse_lookup_file"/>}
                {this.state.form.reverse_lookup=='values' &&
                  <Config type="textarea" id="reverse_lookup_values"/>}
                <Config type="select_number" id="throttle"
                  data={[0, 10, 100, 1000]}/>
              </Tab_context.Provider>
            </div>;
    }
}

