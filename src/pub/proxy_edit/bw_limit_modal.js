// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true, es6:true*/
import React from 'react';
import Pure_component from '/www/util/pub/pure_component.js';
import $ from 'jquery';
import setdb from '../../../util/setdb.js';
import {Modal} from '../common/modals.js';
import Tooltip from '../common/tooltip.js';
import {Input, Yes_no} from '../common/controls.js';
import {T} from '../common/i18n.js';

export default class BW_limit_modal extends Pure_component {
    set_field = setdb.get('head.proxy_edit.set_field');
    bytes_tip = 'The number of bytes that can be used in the period';
    days_tip = 'Number of days in the period';
    renewable_tip = 'Renew limit of bytes each period or use single period '
        +'and stop usage once last day of period is reached';
    state = {bytes: '', days: '', is_submit_disabled: true, renewable: true};
    componentDidMount(){
        $('#bw_limit_modal').on('hidden.bs.modal', this.on_hide);
        this.reset_state();
    }
    componentWillUnmount(){
        $('#bw_limit_modal').off('hidden.bs.modal', this.on_hide);
    }
    reset_state = ()=>{
        const form_bw_limit = this.props.form.bw_limit||{};
        this.setState({
            bytes: +form_bw_limit.bytes||'',
            days: +form_bw_limit.days||'',
            renewable: !!form_bw_limit.renewable,
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
    renewable_changed = value=>
        this.setState({renewable: !!value}, this.toggle_submit_btn);
    toggle_submit_btn = ()=>{
        const form_bw_limit = this.props.form.bw_limit||{};
        let bytes = +this.state.bytes;
        let days = +this.state.days;
        let renewable = !!this.state.renewable;
        let old_bytes = +form_bw_limit.bytes||'';
        let old_days = +form_bw_limit.days||'';
        let old_renewable = !!form_bw_limit.renewable;
        this.setState({is_submit_disabled: !bytes || !days || bytes<0 ||
            days<0 || bytes==old_bytes && days==old_days &&
            renewable==old_renewable});
    };
    save = ()=>{
        this.set_field('bw_limit', {bytes: this.state.bytes,
            days: this.state.days, renewable: this.state.renewable});
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
          <div className="renewable_container">
            <Tooltip title={t(this.renewable_tip)}>
                <div className="renewable_container_tooltip">
                    {t('Renewable')}</div>
            </Tooltip>
            <Yes_no val={this.state.renewable}
              on_change_wrapper={this.renewable_changed}/>
          </div>
        </Modal>}</T>;
    }
}
