// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true, es6:true*/
import React from 'react';
import {Note} from '../common.js';
import {Config, Tab_context} from './common.js';
import {T} from '../common/i18n.js';
import Pure_component from '/www/util/pub/pure_component.js';
import $ from 'jquery';
import setdb from '../../../util/setdb.js';

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
    move_to_ssl = ()=>this.goto_field('ssl');
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
              <span><T>Should be used only when</T></span>{' '}
              <a className="link" onClick={this.move_to_ssl}>
                <T>SSL analyzing</T>
              </a>{' '}
              <span><T>is turned on.</T></span>
            </Note>;
        return <div className="rotation">
              <Tab_context.Provider value="rotation">
                <Config type="select_number" id="pool_size"
                  note={pool_size_note}/>
                <Config type="select_number" id="max_requests"/>
                <T>{t=><Config type="select_number" id="session_duration"
                  sufix={t('seconds')}/>}</T>
                <Config type="yes_no" id="sticky_ip"/>
                <Config type="text" id="session"/>
                <Config type="yes_no" id="session_termination"
                  note={sess_note}/>
              </Tab_context.Provider>
            </div>;
    }
}

