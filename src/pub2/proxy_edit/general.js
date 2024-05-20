// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true, es6:true*/
import React from 'react';
import Pure_component from '/www/util/pub/pure_component.js';
import $ from 'jquery';
import setdb from '../../../util/setdb.js';
import conv from '../../../util/conv.js';
import {T} from '../common/i18n.js';
import {with_www_api, Note} from '../common.js';
import {Config, Tab_context} from './common.js';
import Users_modal from './users_modal.js';
import Bw_limit_modal from './bw_limit_modal.js';

const route_err_opt = [
    {key: 'pass_dyn (default)', value: 'pass_dyn'},
    {key: 'block', value: 'block'},
];

const yes_no_select_opt = [
    {key: 'Yes', value: 'full'},
    {key: 'No', value: 'none'},
];

const tls_lib_opt = [
    {key: 'OpenSSL (default)', value: 'open_ssl'},
    {key: 'BoringSSL', value: 'flex_tls'},
];

const render_zones = ['unblocker', 'serp'];

const Limit_zagent_note = with_www_api(({www_api, prefix='This option'})=>{
    const path = '/cp/zones/lpm';
    const href = www_api+path;
    const display_url = new URL(www_api).hostname+path;
    return <T>{t=>
      <Note>
        <span>{t(prefix+' is available only in the Cloud Proxy '
          +'Manager, read more on')}</span>{' '}
        <a className="link" href={href} target="_blank"
          rel="noopener noreferrer">{display_url}</a>
      </Note>
    }</T>;
});

const Limit_zone_note = ({zones})=>{
  return <T>{t=>
    <Note>
      <span>
          {t(`This option is available only for ${zones.join(' or ')} zone`)}
      </span>
    </Note>
  }</T>;
};

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
        this.setdb_on('head.proxy_edit.form.bw_limit', ()=>this.forceUpdate());
    }
    multiply_users_changed = val=>{
        if (val)
            this.open_users_modal();
    };
    bw_limit_changed = val=>{
        if (val)
            return this.open_bw_limit_modal();
        this.set_field('bw_limit', false);
    };
    bw_limit_hide = ()=>{
        if (this.state.form.bw_limit!==true)
            return;
        this.set_field('bw_limit', false);
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
    ssl_changed = val=>{
        if (val)
            return;
        this.set_field('tls_lib', 'open_ssl');
        this.set_field('av_check', false);
    };
    open_static_modal = ()=>$('#allocated_ips').modal('show');
    open_users_modal = ()=>$('#users_modal').modal('show');
    open_bw_limit_modal = ()=>$('#bw_limit_modal').modal('show');
    render(){
        if (!this.state.form || !this.state.proxy || !this.state.settings)
            return null;
        const {zagent, av_server} = this.state.settings;
        // XXX krzysztof: cleanup type (index.js rotation.js general.js)
        const curr_plan = this.get_curr_plan();
        const is_render_plan = curr_plan.type=='unblocker' || !!curr_plan.serp;
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
        const get_bw_limit_str = ({bytes, days}={})=>{
            if (!+bytes || !+days)
                return '';
            return conv.scaled_bytes(bytes)+'B/'
                +(days>1 ? `${days} days` : 'day');
        };
        const bw_limit_str = get_bw_limit_str(form.bw_limit);
        const bw_limit_prefix = zagent && bw_limit_str ?
            <span className="bw_limit_str"><T>{bw_limit_str}</T></span> : null;
        const note_bw_limit = form.bw_limit ?
            <a className="link" onClick={this.open_bw_limit_modal}>
                <T>Set limit</T>
            </a> : null;
        return <div className="general">
          <Tab_context.Provider value="general">
            <Users_modal form={this.state.form}/>
            <Bw_limit_modal form={this.state.form} on_hide={this.bw_limit_hide}
              bw_limit_webhook_url={this.state.settings.bw_limit_webhook_url}
              bw_th_webhook_url={this.state.settings.bw_th_webhook_url}
            />
            <Config type="text" id="internal_name"/>
            <Config type="number" id="port"/>
            <Config
              type="pins"
              id="whitelist_ips"
              disabled_ips={disabled_wl}
              no_any={zagent}
              faq={{anchor: 'whitelisted_ips'}}
            />
            <T>{t=><Config type="select"
              disabled={zagent}
              data={this.proxy_connection_type_opt(t)}
              id="proxy_connection_type"
              faq={{anchor: 'https'}}
            />}</T>
            <Config
              type="yes_no"
              id="ssl"
              on_change={this.ssl_changed}
              faq={{anchor: 'ssl_analyzing'}}
            />
            {form.ssl &&
              <Config
                type="select"
                id="tls_lib"
                disabled={!zagent}
                note={!zagent && <Limit_zagent_note prefix='Boring SSL'/>}
                data={tls_lib_opt}
              />
            }
            {form.ssl && av_server &&
              <Config
                type="yes_no"
                id="av_check"
                note={!zagent && <Limit_zagent_note/>}
                disabled={!zagent}
              />
            }
            <Config type="select" data={route_err_opt} id="route_err"/>
            <Config type="select_number" id="multiply"
              data={[0, 5, 20, 100, 500]}/>
            {type=='ips' &&
              <Config
                type="yes_no"
                id="multiply_ips"
                on_change={this.multiply_static_changed}
                note={note_ips}
              />
            }
            {type=='vips' &&
              <Config
                type="yes_no"
                id="multiply_vips"
                on_change={this.multiply_static_changed}
                note={note_vips}
              />
            }
            <Config
              type="yes_no"
              id="multiply_users"
              on_change={this.multiply_users_changed}
              note={note_users}
            />
            <Config
              type="select"
              id="iface"
              data={this.state.proxy.iface.values}
            />
            <Config type="pins" id="smtp" exact no_any/>
            <Config
              type="select"
              id="debug"
              data={yes_no_select_opt}
              faq={{anchor: 'request_details'}}
            />
            <Config type="select" id="lpm_auth" data={yes_no_select_opt}/>
            <Config type="yes_no" id="const" />
            <Config
              type="yes_no"
              id="bw_limit"
              on_change={this.bw_limit_changed}
              prefix={bw_limit_prefix}
              disabled={!zagent}
              note={!zagent && <Limit_zagent_note/> || note_bw_limit}
              skip_save={true}
            />
            <Config
              type="yes_no"
              id="render"
              disabled={!is_render_plan}
              note={!is_render_plan && <Limit_zone_note zones={render_zones}/>}
            />
            <Config type="yes_no" id="follow_redirect" />
          </Tab_context.Provider>
        </div>;
    }
}
