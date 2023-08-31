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
    no_webhook_url_tip = 'Set webhook URL in general settings before '
        +'enabling this option';
    bw_limit_webhook_tip = 'Send webhook on reaching BW limit';
    th_webhook_tip = 'Send webhook on reaching BW limit threshold';
    th_input_tip = 'Percentage threshold for sending BW limit webhook, the '
        +'value should be between 1 and 99';
    state = {bytes: '', days: '', is_submit_disabled: true, renewable: true,
        use_limit_webhook: false, use_th_webhook: false, th_webhook_value: ''};
    has_limit_webhook_url = !!this.props.bw_limit_webhook_url;
    has_th_webhook_url = !!this.props.bw_th_webhook_url;
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
            use_limit_webhook: this.has_limit_webhook_url &&
                !!form_bw_limit.use_limit_webhook,
            use_th_webhook: this.has_th_webhook_url &&
                !!form_bw_limit.th_webhook_value,
            th_webhook_value: this.has_th_webhook_url &&
                +form_bw_limit.th_webhook_value || '',
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
    use_limit_webhook_changed = value=>
        this.setState({use_limit_webhook: !!value}, this.toggle_submit_btn);
    use_th_webhook_changed = value=>{
        this.setState({use_th_webhook: !!value, th_webhook_value: ''},
            this.toggle_submit_btn);
    };
    toggle_submit_btn = ()=>{
        const form_bw_limit = this.props.form.bw_limit||{};
        let bytes = +this.state.bytes;
        let days = +this.state.days;
        let renewable = !!this.state.renewable;
        let use_limit_webhook = !!this.state.use_limit_webhook;
        let th_webhook_value = +this.state.th_webhook_value||'';
        let use_th_webhook = !!this.state.use_th_webhook;
        let old_bytes = +form_bw_limit.bytes||'';
        let old_days = +form_bw_limit.days||'';
        let old_renewable = !!form_bw_limit.renewable;
        let old_use_limit_webhook = !!form_bw_limit.use_limit_webhook;
        let old_th_webhook_value = +form_bw_limit.th_webhook_value||'';
        const th_valid = !use_th_webhook
            || this.is_threshold_valid(th_webhook_value);
        this.setState({is_submit_disabled: !bytes || !days || bytes<0 ||
            days<0 || !th_valid || bytes==old_bytes && days==old_days &&
            renewable==old_renewable &&
            th_webhook_value==old_th_webhook_value &&
            use_limit_webhook==old_use_limit_webhook});
    };
    save = ()=>{
        this.set_field('bw_limit', {bytes: this.state.bytes,
            days: this.state.days, renewable: this.state.renewable,
            use_limit_webhook: this.state.use_limit_webhook,
            th_webhook_value: this.state.th_webhook_value});
        this.setState({is_submit_disabled: true});
    };
    is_threshold_valid =val=>val>0&&val<100;
    render(){
        return <T>{t=><Modal id="bw_limit_modal" className="bw_limit_modal"
          title="BW limit" ok_disabled={this.state.is_submit_disabled}
          click_ok={this.save}>
          <div className="field_container inputs_container">
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
          <div className="field_container">
            <Tooltip title={t(this.renewable_tip)}>
                <div className="field_container_title">
                    {t('Renewable')}</div>
            </Tooltip>
            <Yes_no val={this.state.renewable}
              on_change_wrapper={this.renewable_changed}/>
          </div>
          <div className="field_container">
            <Tooltip title={t(this.has_limit_webhook_url
                ? this.bw_limit_webhook_tip
                : this.no_webhook_url_tip)}>
                <div className="field_container_title">
                    {t('Send BW limit webhook')}</div>
            </Tooltip>
            <Yes_no val={this.state.use_limit_webhook}
              on_change_wrapper={this.use_limit_webhook_changed}
              disabled={!this.has_limit_webhook_url}/>
          </div>
          <div className="field_container">
            <Tooltip title={t(this.has_th_webhook_url
              ? this.th_webhook_tip
              : this.no_webhook_url_tip)}>
              <div className="field_container_title">
                {t('Send BW limit threshold webhook')}</div>
            </Tooltip>
            <Yes_no val={this.state.use_th_webhook}
              on_change_wrapper={this.use_th_webhook_changed}
              disabled={!this.has_th_webhook_url}/>
          </div>
          {this.state.use_th_webhook &&
            <div className="field_container">
              <Tooltip title={t(this.th_input_tip)}>
                <div className="field_container_title">
                  {t('BW limit threshold')}</div>
              </Tooltip>
              <Input val={this.state.th_webhook_value} type="number"
                disabled={!this.has_th_webhook_url} placeholder="85%"
                on_change_wrapper={this.input_changed('th_webhook_value')}
                className={!this.state.th_webhook_value ||
                  this.is_threshold_valid(this.state.th_webhook_value)
                  ? ''
                  : 'error'}
              />
            </div>
          }
        </Modal>}</T>;
    }
}
