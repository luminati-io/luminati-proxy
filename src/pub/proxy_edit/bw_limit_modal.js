// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true, es6:true*/
import React from 'react';
import Pure_component from '/www/util/pub/pure_component.js';
import $ from 'jquery';
import setdb from '../../../util/setdb.js';
import {Modal} from '../common/modals.js';
import Tooltip from '../common/tooltip.js';
import {Input} from '../common/controls.js';
import {T} from '../common/i18n.js';

export default class BW_limit_modal extends Pure_component {
    set_field = setdb.get('head.proxy_edit.set_field');
    bytes_tip = 'The number of bytes that can be used in the period';
    days_tip = 'Number of days in the period';
    state = {bytes: '', days: '', is_submit_disabled: true};
    componentDidMount(){
        $('#bw_limit_modal').on('hidden.bs.modal', this.on_hide);
        this.reset_state();
    }
    componentWillUnmount(){
        $('#bw_limit_modal').off('hidden.bs.modal', this.on_hide);
    }
    reset_state = ()=>{
        this.setState({
            bytes: +(this.props.form.bw_limit||{}).bytes||'',
            days: +(this.props.form.bw_limit||{}).days||'',
            is_submit_disabled: true,
        });
    };
    on_hide = ()=>{
        this.reset_state();
        if (this.props.on_hide)
            this.props.on_hide();
    };
    input_changed = name=>value=>{
        if (value)
            value = Math.round(value)||this.state[name];
        this.setState({[name]: value||''}, this.toggle_submit_btn);
    };
    toggle_submit_btn = ()=>{
        let bytes = +this.state.bytes;
        let days = +this.state.days;
        let old_bytes = +(this.props.form.bw_limit||{}).bytes||'';
        let old_days = +(this.props.form.bw_limit||{}).days||'';
        this.setState({is_submit_disabled: !bytes || !days || bytes<0 ||
            days<0 || bytes==old_bytes && days==old_days});
    };
    save = ()=>{
        this.set_field('bw_limit', {bytes: this.state.bytes,
            days: this.state.days});
        this.setState({is_submit_disabled: true});
    };
    render(){
        return <T>{t=><Modal id="bw_limit_modal" className="bw_limit_modal"
          title="BW limit" ok_disabled={this.state.is_submit_disabled}
          click_ok={this.save}>
          <div className="inputs_container">
          <Tooltip title={t(this.bytes_tip)}>
            <div className="bytes_input">
              <Input val={this.state.bytes} type="number"
                placeholder={t('Bytes')}
                on_change_wrapper={this.input_changed('bytes')}/>
            </div>
          </Tooltip>
          <Tooltip title={t(this.days_tip)}>
            <div className="days_input">
              <Input val={this.state.days} type="number"
                placeholder={t('Days')}
                on_change_wrapper={this.input_changed('days')}
              />
            </div>
          </Tooltip>
          </div>
        </Modal>}</T>;
    }
}
