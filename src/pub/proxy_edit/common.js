// LICENSE_CODE ZON
'use strict'; /*jslint react:true, es6:true*/
import React from 'react';
import Pure_component from '../../../www/util/pub/pure_component.js';
import {Netmask} from 'netmask';
import setdb from '../../../util/setdb.js';
import {tabs} from './fields.js';
import {Labeled_controller} from '../common.js';
import {getContext} from 'recompose';
import PropTypes from 'prop-types';

export const validators = {
    number: (min, max, req=false)=>val=>{
        val = Number(val);
        if (isNaN(val))
        {
            if (req)
                return min;
            return undefined;
        }
        else if (val < min)
            return min;
        else if (val > max)
            return max;
        return val;
    },
    ips_list: val=>{
        val = val.replace(/\s/g, '');
        const ips = val.split(',');
        const res = [];
        ips.forEach(ip=>{
            try { res.push(new Netmask(ip).base); }
            catch(e){ console.log('incorrect ip format'); }
        });
        return res.join(',');
    },
};

export const Config = getContext({provide: PropTypes.object})(
class Config extends Pure_component {
    state = {disabled_fields: {}};
    set_field = setdb.get('head.proxy_edit.set_field');
    is_valid_field = setdb.get('head.proxy_edit.is_valid_field');
    on_blur = ({target: {value}})=>{
        if (this.props.validator)
            this.set_field(this.props.id, this.props.validator(value));
    };
    on_input_change = val=>{
        if (this.props.update_on_input)
            this.set_field(this.props.id, [{id: val, label: val}]);
    };
    on_change_wrapper = (value, _id)=>{
        const opt = {};
        if (this.props.save_on_blur)
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
            defaults&&this.setState({defaults}));
    }
    render(){
        if (!this.state.show||!this.state.defaults)
            return null;
        const id = this.props.id;
        let _default;
        if (this.props.type=='yes_no')
        {
            if (this.props.default!==undefined)
                _default = this.props.default;
            else if (this.state.defaults[id]!==undefined)
                _default = this.state.defaults[id];
            else
                _default = false;
        }
        const tab_id = this.props.provide.tab_id;
        const disabled = this.props.disabled||!this.is_valid_field(id)||
            this.state.disabled_fields[id];
        return <Labeled_controller
              id={id}
              sufix={this.props.sufix}
              data={this.props.data}
              type={this.props.type}
              on_input_change={this.on_input_change}
              on_change_wrapper={this.on_change_wrapper}
              val={this.state.val===undefined ? '' : this.state.val}
              disabled={disabled}
              min={this.props.min}
              max={this.props.max}
              note={this.props.note}
              placeholder={tabs[tab_id].fields[id].placeholder||''}
              on_blur={this.on_blur}
              label={tabs[tab_id].fields[id].label}
              default={_default}
              range={this.props.range}
              tooltip={tabs[tab_id].fields[id].tooltip}/>;
    }
});
