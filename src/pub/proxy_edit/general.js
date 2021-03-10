// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true, es6:true*/
import React from 'react';
import Pure_component from '/www/util/pub/pure_component.js';
import $ from 'jquery';
import setdb from '../../../util/setdb.js';
import {Config, Tab_context} from './common.js';
import {T} from '../common/i18n.js';
import Users_modal from './users_modal.js';
import {with_www_api, Note} from '../common.js';

const route_err_opt = [
    {key: 'pass_dyn (default)', value: 'pass_dyn'},
    {key: 'block', value: 'block'}
];

const debug_opt = [
    {key: 'Yes (default)', value: 'full'},
    {key: 'No', value: 'none'},
];

const Limit_zagent_note = with_www_api(({www_api})=>{
    const path = '/cp/lpm';
    const href = www_api+path;
    const display_url = new URL(www_api).hostname+path;
    return <T>{t=>
      <Note>
        <span>{t('This option is available only in the Cloud Proxy '
          +'Manager, read more on')}</span>{' '}
        <a className="link" href={href} target="_blank"
          rel="noopener noreferrer">{display_url}</a>
      </Note>
    }</T>;
});

export default class General extends Pure_component {
    state = {defaults: {}};
    get_curr_plan = setdb.get('head.proxy_edit.get_curr_plan');
    set_field = setdb.get('head.proxy_edit.set_field');
    proxy_connection_type_opt(t){
        return this.state.defaults.proxy_connection_type=='https' ? [
            {key: t('HTTPS (default)'), value: 'https'},
            {key: 'HTTP', value: 'http'}
        ] : [
            {key: t('HTTP (default)'), value: 'http'},
            {key: 'HTTPS', value: 'https'}
        ];
    }
    componentDidMount(){
        this.setdb_on('head.defaults',
            defaults=>this.setState({defaults: defaults||{}}));
        this.setdb_on('head.proxy_edit.form', form=>{
            form && this.setState({form});
        });
        this.setdb_on('head.consts', consts=>{
            consts && consts.proxy && this.setState({proxy: consts.proxy});
        });
        this.setdb_on('head.settings', settings=>{
            settings && this.setState({settings});
        });
    }
    multiply_users_changed = val=>{
        console.log('mult users changed');
        if (val)
            this.open_users_modal();
    };
    multiply_static_changed = val=>{
        const {form} = this.state;
        const size = Math.max(form.ips.length, form.vips.length);
        if (val)
        {
            this.set_field('pool_size', 1);
            this.set_field('multiply', size);
            this.open_static_modal();
            return;
        }
        this.set_field('pool_size', size);
        this.set_field('multiply', 1);
    };
    ssl_changed = val=>!val && this.set_field('flex_tls', false);
    open_static_modal = ()=>$('#allocated_ips').modal('show');
    open_users_modal = ()=>$('#users_modal').modal('show');
    render(){
        if (!this.state.form || !this.state.proxy || !this.state.settings)
            return null;
        const {zagent} = this.state.settings;
        // XXX krzysztof: cleanup type (index.js rotation.js general.js)
        const curr_plan = this.get_curr_plan();
        let type;
        if (curr_plan && (curr_plan.type||'').startsWith('static'))
            type = 'ips';
        else if (curr_plan && !!curr_plan.vip)
            type = 'vips';
        const form = this.state.form;
        const note_ips = form.multiply_ips ?
            <a className="link" onClick={this.open_static_modal}>
              Select IPs
            </a> : null;
        const note_vips = form.multiply_vips ?
            <a className="link" onClick={this.open_static_modal}>
              Select gIPs
            </a> : null;
        const disabled_wl = (this.state.settings.fixed_whitelist_ips||[])
            .concat(this.state.settings.whitelist_ips);
        const note_users = form.multiply_users ?
            <a className="link" onClick={this.open_users_modal}>
              <T>Select users</T>
            </a> : null;
        const flex_tls_note = !zagent && <Limit_zagent_note/>;
        return <div className="general">
              <Tab_context.Provider value="general">
                <Users_modal form={this.state.form}/>
                <Config type="text" id="internal_name"/>
                <Config type="number" id="port"/>
                <Config type="pins" id="whitelist_ips"
                  disabled_ips={disabled_wl}
                  no_any={zagent}/>
                <T>{t=><Config type="select"
                  disabled={zagent}
                  data={this.proxy_connection_type_opt(t)}
                  id="proxy_connection_type"/>}</T>
                <Config type="yes_no" id="ssl" on_change={this.ssl_changed}/>
                {form.ssl &&
                  <Config type="yes_no" id="flex_tls" disabled={!zagent}
                    note={flex_tls_note}/>
                }
                <Config type="select" data={route_err_opt} id="route_err"/>
                <Config type="select_number" id="multiply"
                  data={[0, 5, 20, 100, 500]}/>
                {type=='ips' &&
                  <Config type="yes_no" id="multiply_ips"
                    on_change={this.multiply_static_changed} note={note_ips}/>
                }
                {type=='vips' &&
                  <Config type="yes_no" id="multiply_vips"
                    on_change={this.multiply_static_changed} note={note_vips}/>
                }
                <Config type="yes_no" id="multiply_users"
                  on_change={this.multiply_users_changed} note={note_users}/>
                <Config type="select" id="iface"
                  data={this.state.proxy.iface.values}/>
                <Config type="pins" id="smtp" exact no_any/>
                <Config type="select" id="debug" data={debug_opt}/>
              </Tab_context.Provider>
            </div>;
    }
}
