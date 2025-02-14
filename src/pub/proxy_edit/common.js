// LICENSE_CODE ZON
'use strict'; /*jslint react:true, es6:true*/
import React from 'react';
import {withRouter} from 'react-router-dom';
import Pure_component from '/www/util/pub/pure_component.js';
import setdb from '../../../util/setdb.js';
import {Labeled_controller, Ext_tooltip} from '../common.js';
import {tabs} from './fields.js';

export const Tab_context = React.createContext('logs');
const mgr_proxy_shared_fields = ['debug', 'lpm_auth',
    'socket_inactivity_timeout'];

export const Config = withRouter(class Config extends Pure_component {
    state = {disabled_fields: {}};
    set_field = setdb.get('head.proxy_edit.set_field');
    is_valid_field = setdb.get('head.proxy_edit.is_valid_field');
    is_disabled_ext_proxy = setdb.get('head.proxy_edit.is_disabled_ext_proxy');
    on_blur = ({target: {value}})=>{
        if (this.props.validator)
            this.set_field(this.props.id, this.props.validator(value));
    };
    on_input_change = val=>{
        if (this.props.update_on_input)
            this.set_field(this.props.id, val);
    };
    on_change_wrapper = (value, _id)=>{
        const opt = {};
        if (this.props.save_on_blur||this.props.skip_save)
            opt.skip_save = true;
        const curr_id = _id||this.props.id;
        if (this.props.on_change)
            this.props.on_change(value);
        this.set_field(curr_id, value, opt);
    };
    componentDidMount(){
        const val_id = this.props.val_id ? this.props.val_id : this.props.id;
        this.setdb_on('head.proxy_edit.form.'+val_id, val=>{
            this.setState({val, show: true});
        });
        this.setdb_on('head.proxy_edit.disabled_fields', disabled_fields=>
            disabled_fields&&this.setState({disabled_fields}));
        this.setdb_on('head.defaults', defaults=>
            defaults && this.setState({defaults}));
    }
    render(){
        if (!this.state.show||!this.state.defaults)
            return null;
        const id = this.props.id;
        let _default;
        if (this.props.default!==undefined)
            _default = this.props.default;
        else if (this.state.defaults[id]!==undefined)
        {
            _default = mgr_proxy_shared_fields.includes(id) ?
                `default-${this.state.defaults[id]}` : this.state.defaults[id];
        }
        else if (this.props.type=='yes_no')
            _default = false;
        const tab_id = this.context;
        const disabled = this.props.disabled||!this.is_valid_field(id)||
            this.state.disabled_fields[id];
        let state;
        let animated = false;
        if ((state = this.props.location.state)&&state.field)
            animated = state.field==id;
        const data = [];
        if (mgr_proxy_shared_fields.includes(id))
        {
            const default_option = this.props.data.find(d=>
                d.value==this.state.defaults[id])||{};
            data.push({key: `Default (${default_option.key})`,
                value: `default-${default_option.value}`});
        }
        return <Labeled_controller
              id={id}
              animated={animated}
              prefix={this.props.prefix}
              sufix={this.props.sufix}
              data={data.concat(this.props.data)}
              type={this.props.type}
              on_key_up={this.on_key_up}
              on_input_change={this.on_input_change}
              on_change_wrapper={this.on_change_wrapper}
              val={this.state.val===undefined ? '' : this.state.val}
              disabled={disabled}
              disabled_ips={this.props.disabled_ips}
              note={this.props.note||tabs[tab_id].fields[id].note}
              placeholder={tabs[tab_id].fields[id].placeholder||''}
              on_blur={this.on_blur}
              label={tabs[tab_id].fields[id].label}
              default={_default}
              range={this.props.range}
              tooltip={tabs[tab_id].fields[id].tooltip}
              field_tooltip={disabled && this.is_disabled_ext_proxy(id) &&
                  <Ext_tooltip/>}
              exact={this.props.exact}
              filter_by={this.props.filter_by}
              faq={this.props.faq}
              no_any={this.props.no_any}/>;
    }
});
Config.WrappedComponent.contextType = Tab_context;
