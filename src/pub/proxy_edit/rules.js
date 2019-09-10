// LICENSE_CODE ZON
'use strict'; /*jslint react:true, es6:true*/
import React from 'react';
import {withRouter} from 'react-router-dom';
import _ from 'lodash';
import Pure_component from '/www/util/pub/pure_component.js';
import classnames from 'classnames';
import setdb from '../../../util/setdb.js';
import ajax from '../../../util/ajax.js';
import conv from '../../../util/conv.js';
import {migrate_trigger, migrate_action, trigger_types,
    action_types, default_action} from '../../../util/rules_util.js';
import {ms} from '../../../util/date.js';
import {Labeled_controller, Note, with_proxy_ports, Cm_wrapper,
    Field_row_raw} from '../common.js';
import {tabs} from './fields.js';
import {Tester} from '../proxy_tester.js';
import Tooltip from '../common/tooltip.js';
import {T} from '../common/i18n.js';

const rule_prepare = rule=>{
    const action = {};
    if (['retry', 'refresh_ip'].includes(rule.action))
        action.retry = true;
    if (rule.action=='retry' && rule.retry_number)
        action.retry = rule.retry_number;
    else if (rule.action=='retry_port')
        action.retry_port = Number(rule.retry_port);
    else if (rule.action=='ban_ip')
        action.ban_ip = (rule.ban_ip_duration||0)*ms.MIN;
    else if (rule.action=='ban_ip_global')
        action.ban_ip_global = (rule.ban_ip_duration||0)*ms.MIN;
    else if (rule.action=='ban_ip_domain')
        action.ban_ip_domain = (rule.ban_ip_duration||0)*ms.MIN;
    else if (rule.action=='refresh_ip')
        action.refresh_ip = true;
    else if (rule.action=='save_to_pool')
        action.reserve_session = true;
    else if (rule.action=='process')
    {
        try { action.process = JSON.parse(rule.process); }
        catch(e){ console.log('wrong process json'); }
    }
    else if (rule.action=='request_url')
    {
        action.request_url = {
            url: rule.request_url,
            method: rule.request_method,
        };
        try { action.request_url.payload = JSON.parse(rule.request_payload); }
        catch(e){ console.log('wrong payload json'); }
    }
    else if (rule.action=='null_response')
        action.null_response = true;
    else if (rule.action=='bypass_proxy')
        action.bypass_proxy = true;
    else if (rule.action=='direct')
        action.direct = true;
    if (rule.email)
        action.email = rule.email;
    let result = null;
    if (rule.trigger_type)
    {
        result = {
            action,
            action_type: rule.action,
            trigger_type: rule.trigger_type,
            url: rule.trigger_url_regex,
        };
    }
    if (rule.trigger_type=='status')
        result.status = rule.status||'';
    else if (rule.trigger_type=='body' && rule.body_regex)
        result.body = rule.body_regex;
    else if (rule.trigger_type=='min_req_time' && rule.min_req_time)
        result.min_req_time = rule.min_req_time;
    else if (rule.trigger_type=='max_req_time' && rule.max_req_time)
        result.max_req_time = rule.max_req_time;
    if (result && (rule.type || rule.trigger_code))
    {
        const {type, trigger_code} = migrate_trigger(result);
        if (rule.type!=type || rule.trigger_code!=trigger_code)
        {
            result.type = rule.type||type;
            result.trigger_code = rule.trigger_code||trigger_code;
        }
    }
    return result;
};
export const map_rule_to_form = rule=>{
    const result = {};
    result.status = rule.status;
    result.trigger_url_regex = rule.url;
    result.trigger_type = rule.trigger_type;
    result.body_regex = rule.body;
    result.min_req_time = rule.min_req_time;
    result.max_req_time = rule.max_req_time;
    result.action = rule.action_type;
    result.retry_port = rule.action.retry_port;
    result.retry_number = rule.action.retry;
    if (rule.action.request_url)
    {
        result.request_url = rule.action.request_url.url;
        result.request_method = rule.action.request_url.method;
        result.request_payload =
            JSON.stringify(rule.action.request_url.payload, null, '  ');
    }
    if (rule.action.ban_ip)
        result.ban_ip_duration = rule.action.ban_ip/ms.MIN;
    if (rule.action.ban_ip_global)
        result.ban_ip_duration = rule.action.ban_ip_global/ms.MIN;
    if (rule.action.ban_ip_domain)
        result.ban_ip_duration = rule.action.ban_ip_domain/ms.MIN;
    if (rule.action.process)
        result.process = JSON.stringify(rule.action.process, null, '  ');
    if (rule.action.email)
    {
        result.send_email = true;
        result.email = rule.action.email;
    }
    result.trigger_code = rule.trigger_code;
    result.type = rule.type;
    return result;
};

export default class Rules extends Pure_component {
    state = {rules: [{id: 0}], max_id: 0};
    set_field = setdb.get('head.proxy_edit.set_field');
    goto_field = setdb.get('head.proxy_edit.goto_field');
    componentDidMount(){
        this.setdb_on('head.proxy_edit.form', form=>{
            form && this.setState({form});
        });
        this.setdb_on('head.proxy_edit.rules', rules=>{
            if (!rules||!rules.length)
                return;
            this.setState({rules, max_id: Math.max(...rules.map(r=>r.id))});
        });
        this.setdb_on('head.proxy_edit.update_rule', this.update_rule);
    }
    update_rule = rule=>{
        if (!rule)
            return;
        this.setState(prev=>({
            rules: prev.rules.map(r=>{
                if (r.id!=rule.rule_id)
                    return r;
                return {...r, [rule.field]: rule.value};
            }),
        }), this.rules_update);
    };
    rule_add = ()=>{
        this.setState(prev=>({
            rules: [{id: prev.max_id+1}, ...prev.rules],
            max_id: prev.max_id+1,
        }));
    };
    rule_del = id=>{
        this.setState(prev=>{
            const new_state = {rules: prev.rules.filter(r=>r.id!=id)};
            if (!new_state.rules.length)
            {
                new_state.rules.push({id: prev.max_id+1});
                new_state.max_id = prev.max_id+1;
            }
            return new_state;
        }, this.rules_update);
    };
    rules_update = ()=>{
        setdb.set('head.proxy_edit.rules', this.state.rules);
        const rules = this.state.rules.map(rule_prepare).filter(Boolean);
        this.set_field('rules', rules);
    };
    goto_ssl = ()=>this.goto_field('ssl');
    goto_debug = ()=>this.goto_field('debug');
    render(){
        if (!this.state.form)
            return null;
        return <div className="rules">
              {!this.state.form.ssl &&
                <Note>
                  <span><strong><T>Warning: </T></strong></span>
                  <span><T>these options are available only when using </T>
                    <a className="link" onClick={this.goto_ssl}>
                    <T>SSL analyzing</T></a></span>
                </Note>
              }
              {this.state.form.debug=='none' &&
                <Note>
                  <span><strong><T>Warning:</T></strong></span>
                  <span><T>some rules may not work correctly without </T>
                  </span>
                  <a onClick={this.goto_debug} className="link">
                    <T>Request debug info</T></a>
                </Note>
              }
              <button className="btn btn_lpm btn_lpm_small rule_add_btn"
                onClick={this.rule_add} disabled={!this.state.form.ssl}>
                <T>New rule</T>
                <i className="glyphicon glyphicon-plus"/>
              </button>
              {this.state.rules.map(r=>
                <Rule key={r.id} rule={r} rule_del={this.rule_del}
                   www={this.state.www} disabled={!this.state.form.ssl}/>
              )}
              <Tester_wrapper/>
            </div>;
    }
}

const Tester_wrapper = withRouter(class Tester_wrapper extends Pure_component {
    render(){
        return <div className="tester_wrapper">
              <div className="nav_header" style={{marginBottom: 5}}>
                <h3><T>Test rules</T></h3>
              </div>
              <Tester port={this.props.match.params.port} no_labels/>
            </div>;
    }
});

class Rule_config extends Pure_component {
    value_change = value=>{
        if (this.props.on_change)
            this.props.on_change(value);
        setdb.emit('head.proxy_edit.update_rule', {field: this.props.id,
            rule_id: this.props.rule.id, value});
    };
    render(){
        const id = this.props.id;
        const tab_id = 'rules';
        return <Labeled_controller
              id={id}
              style={this.props.style}
              desc_style={this.props.desc_style}
              field_row_inner_style={this.props.field_row_inner_style}
              sufix={this.props.sufix}
              data={this.props.data}
              type={this.props.type}
              range={this.props.range}
              on_change_wrapper={this.value_change}
              val={this.props.val||this.props.rule[id]||''}
              disabled={this.props.disabled}
              note={this.props.note}
              placeholder={tabs[tab_id].fields[id].placeholder||''}
              on_blur={this.on_blur}
              label={tabs[tab_id].fields[id].label}
              tooltip={tabs[tab_id].fields[id].tooltip}/>;
    }
}

const Ban_ips_note = withRouter(({match, history})=>{
    const goto_banlist = ()=>{
        const port = match.params.port;
        history.push({pathname: `/proxy/${port}/logs/banned_ips`});
    };
    return <span>
          <a className="link" onClick={goto_banlist}>Currently banned IPs</a>
        </span>;
});

class Rule extends Pure_component {
    state = {};
    componentDidMount(){
        const rule = this.props.rule;
        if (rule && (rule.trigger_code || rule.type))
            this.setState({ui_blocked: true});
    }
    set_rule_field = (field, value)=>{
        setdb.emit('head.proxy_edit.update_rule', {rule_id: this.props.rule.id,
            field, value});
    };
    change_ui_block = blocked=>{
        if (blocked)
            this.setState({ui_blocked: true});
        else
        {
            this.set_rule_field('trigger_code', undefined);
            this.set_rule_field('type', undefined);
            this.setState({ui_blocked: false});
        }
    };
    render(){
        const {rule_del, rule, disabled} = this.props;
        const {ui_blocked} = this.state;
        return <div>
          <div className="rule_wrapper">
            <Trigger rule={rule} ui_blocked={ui_blocked} disabled={disabled}
              set_rule_field={this.set_rule_field}
              change_ui_block={this.change_ui_block}/>
            <Action rule={rule} disabled={disabled}
              set_rule_field={this.set_rule_field}
              change_ui_block={this.change_ui_block}/>
            <Btn_rule_del on_click={()=>rule_del(rule.id)}
              disabled={disabled}/>
          </div>
        </div>;
    }
}

const Action = with_proxy_ports(withRouter(
class Action extends Pure_component {
    state = {ports: []};
    componentDidMount(){
        this.setdb_on('head.consts', consts=>{
            if (consts && consts.logins)
                this.setState({logins: consts.logins});
        });
        this.setdb_on('head.defaults', defaults=>{
            if (defaults)
                this.setState({defaults});
        });
        this.setdb_on('head.settings', settings=>{
            if (settings)
                this.setState({settings});
        });
        this.setdb_on('head.zones', zones=>{
            if (zones)
                this.setState({zones});
        });
        this.setdb_on('head.proxy_edit.zone_name', curr_zone=>{
            if (curr_zone)
                this.setState({curr_zone}, this.load_refresh_cost);
        });
    }
    load_refresh_cost = ()=>{
        const plan = this.get_curr_zone_plan();
        if (!this.is_curr_zone_static(plan) || !plan.ips)
            return;
        const _this = this;
        this.etask(function*(){
            const response = yield ajax.json({url: '/api/refresh_cost',
                qs: {zone: _this.state.curr_zone}});
            _this.setState({refresh_cost: response.cost});
        });
    };
    action_changed = val=>{
        const {ports_opt, match, rule, set_rule_field,
            change_ui_block} = this.props;
        if (val=='retry_port'||val=='switch_port')
        {
            const def_port = ports_opt.find(p=>p.value!=match.params.port);
            set_rule_field(val, def_port && def_port.value || '');
        }
        if (val=='ban_ip' || val=='ban_ip_domain' || val=='ban_ip_global')
        {
            if (rule.trigger_type=='url' && !rule.type)
            {
                set_rule_field('type', 'after_hdr');
                change_ui_block(true);
            }
        }
        else
            set_rule_field('ban_ip_duration', '');
        if (!val)
        {
            set_rule_field('email', '');
            set_rule_field('send_email', false);
        }
    };
    send_email_changed = val=>{
        if (!val)
            return this.props.set_rule_field('email', '');
        if (!this.state.logins)
            return;
        return this.props.set_rule_field('email', this.state.logins[0]);
    };
    request_method_changed = val=>{
        if (val=='GET')
            delete this.props.rule.request_payload;
    };
    goto_tester = ()=>{
        this.props.history.push({pathname: `/proxy_tester`, state: {
            url: 'https://luminati.io/lpm/templates/product',
            port: this.props.match.params.port,
        }});
    };
    get_curr_zone_plan = ()=>{
        const {zones, curr_zone} = this.state;
        const zone = (zones.zones||[]).find(z=>z.name==curr_zone);
        return zone && zone.plan || {};
    };
    is_curr_zone_static = plan=>{
        plan = plan||this.get_curr_zone_plan();
        return ['static', 'static_res'].includes(plan.type);
    };
    request_methods = ()=>
        ['GET', 'POST', 'PUT', 'DELETE'].map(m=>({key: m, value: m}));
    render(){
        const {rule, match, ports_opt, disabled} = this.props;
        const {logins, defaults, settings, zones, curr_zone,
            refresh_cost} = this.state;
        if (!rule.trigger_type || !settings)
            return null;
        if (!zones || !curr_zone)
            return null;
        let _action_types = [default_action].concat(_.cloneDeep(action_types)
        .filter(at=>rule.trigger_type=='url' && at.url ||
            rule.trigger_type!='url' && !at.only_url)
        .filter(at=>rule.trigger_type!='min_req_time' ||
            at.min_req_time));
        if (this.is_curr_zone_static())
        {
            const refresh_ip_at = _action_types.find(
                at=>at.value=='refresh_ip');
            if (refresh_ip_at)
            {
                refresh_ip_at.key += refresh_cost ?
                    ` (${conv.fmt_currency(refresh_cost)})` : '';
            }
        }
        else
            _action_types = _action_types.filter(at=>at.value!='refresh_ip');
        const current_port = match.params.port;
        const ports = ports_opt.filter(p=>p.value!=current_port);
        ports.unshift({key: '--Select--', value: ''});
        const ban_action = ['ban_ip', 'ban_ip_domain', 'ban_ip_global']
            .includes(rule.action);
        return <React.Fragment>
              <div className="action ui">
                {rule.trigger_type &&
                  <Rule_config id="action" type="select" data={_action_types}
                    on_change={this.action_changed} rule={rule}
                    disabled={disabled}/>
                }
                {rule.action=='retry' &&
                  <Rule_config id="retry_number" type="select_number"
                    rule={rule} disabled={disabled}/>
                }
                {rule.action=='retry_port' &&
                  <Rule_config id="retry_port" type="select" data={ports}
                    rule={rule} disabled={disabled}/>
                }
                {rule.action=='switch_port' &&
                  <Rule_config id="switch_port" type="select" data={ports}
                    rule={rule} disabled={disabled}/>
                }
                {ban_action &&
                  <Rule_config id="ban_ip_duration" type="select_number"
                    data={[0, 1, 5, 10, 30, 60]} sufix="minutes" rule={rule}
                    note={<Ban_ips_note/>} disabled={disabled}/>
                }
                {rule.action=='process' &&
                  <div>
                    <Rule_config id="process" type="json" rule={rule}
                      disabled={disabled}/>
                    <Field_row_raw disabled={disabled}>
                      Test data processing in
                      <a onClick={this.goto_tester} className="link api_link">
                        proxy tester</a>
                    </Field_row_raw>
                  </div>
                }
                {rule.action=='request_url' &&
                  <div>
                    <Rule_config id="request_url" type="url" rule={rule}
                        disabled={disabled}/>
                    <Rule_config id="request_method" type="select" rule={rule}
                        data={this.request_methods()} disabled={disabled}
                        on_change={this.request_method_changed}/>
                    {rule.request_method != 'GET' &&
                    <Rule_config id="request_payload" type="json" rule={rule}
                      disabled={disabled}/>}
                  </div>
                }
                {rule.action &&
                  <Rule_config id="send_email" type="yes_no" rule={rule}
                    on_change={this.send_email_changed} disabled={disabled}/>
                }
                {rule.send_email && logins &&
                  logins.length==1 &&
                  <Rule_config id="email" type="text" rule={rule} disabled/>
                }
                {rule.send_email && logins && logins.length>1 &&
                  <Rule_config id="email" type="select" rule={rule}
                    data={logins.map(l=>({key: l, value: l}))}
                    note={<Email_note www={defaults.www_api}/>}
                    disabled={disabled}/>
                }
              </div>
              <Action_code rule={rule} disabled={disabled}/>
            </React.Fragment>;
    }
}));

class Action_code extends Pure_component {
    state = {};
    on_change = val=>{
        console.log(val);
    };
    static getDerivedStateFromProps(props, state){
        const prepared = rule_prepare(props.rule);
        const {action_code} = migrate_action(prepared)||{};
        return {action_code};
    }
    render(){
        const content = <div className="action code">
          <Cm_wrapper on_change={this.on_change} readonly
            val={this.state.action_code}/>
        </div>;
        if (this.props.disabled)
            return content;
        const tip = 'See the action as JavaScript function. Currently it '
        +'is Read-only. We are working on support for editing.';
        return <Tooltip title={tip}>{content}</Tooltip>;
    }
}

class Trigger extends Pure_component {
    trigger_changed = val=>{
        const {rule, set_rule_field} = this.props;
        if (rule.trigger_type=='url' && val!='url' ||
            rule.trigger_type!='url' && val=='url' || !val)
        {
            set_rule_field('action', '');
        }
        if (val!='status')
            set_rule_field('status', '');
        if (val!='body')
            set_rule_field('body_regex', '');
        if (val!='min_req_time')
            set_rule_field('min_req_time', '');
        if (val!='max_req_time')
            set_rule_field('max_req_time', '');
        if (!val)
            set_rule_field('trigger_url_regex', '');
    };
    trigger_code_changed = val=>{
        this.props.change_ui_block(true);
        this.props.set_rule_field('trigger_code', val);
    };
    render(){
        const {rule, disabled, ui_blocked, change_ui_block} = this.props;
        let tip = ' ';
        if (ui_blocked)
        {
            tip = `Trigger function was modified. Click 'restore' to generate
                it based on your selections.`;
        }
        return <React.Fragment>
              <div className="trigger ui">
                <Tooltip title={tip}>
                <div className={classnames('mask', {active: ui_blocked})}>
                  <button className="btn btn_lpm btn_lpm_small reset_btn"
                    onClick={()=>change_ui_block(false)} disabled={disabled}>
                    Restore
                  </button>
                </div>
                </Tooltip>
                <Rule_config id="trigger_type" type="select"
                  data={trigger_types} on_change={this.trigger_changed}
                  rule={rule} disabled={disabled}/>
                {rule.trigger_type=='body' &&
                  <Rule_config id="body_regex" type="text" rule={rule}
                    disabled={disabled}/>}
                {rule.trigger_type=='min_req_time' &&
                  <Rule_config id="min_req_time" type="select_number"
                    range="ms" sufix="milliseconds" rule={rule}
                    disabled={disabled}/>
                }
                {rule.trigger_type=='max_req_time' &&
                  <Rule_config id="max_req_time" type="select_number"
                    range="ms" sufix="milliseconds" rule={rule}
                    disabled={disabled}/>
                }
                {rule.trigger_type=='status' &&
                  <Rule_config id="status" type="select_status" rule={rule}
                    disabled={disabled}/>
                }
                {rule.trigger_type &&
                  <Rule_config id="trigger_url_regex" type="regex"
                    rule={rule} style={{width: '100%'}}
                    disabled={disabled}/>}
              </div>
              <Trigger_code rule={rule} disabled={disabled}
                type_changed={()=>change_ui_block(true)}
                trigger_code_changed={this.trigger_code_changed}/>
            </React.Fragment>;
    }
}

class Trigger_code extends Pure_component {
    type_opt = [
        {key: 'Before send', value: 'before_send'},
        {key: 'After headers', value: 'after_hdr'},
        {key: 'After body', value: 'after_body'},
        {key: 'Timeout', value: 'timeout'},
    ];
    state = {};
    static getDerivedStateFromProps(props, state){
        const rule = props.rule;
        let prepared = rule_prepare(rule);
        if (!prepared)
            return {trigger_code: null};
        let {trigger_code, type} = migrate_trigger(prepared);
        if (rule && rule.type)
            type = rule.type;
        if (rule && rule.trigger_code)
            trigger_code = rule.trigger_code;
        return {trigger_code, type};
    }
    render(){
        const {rule, type_changed, trigger_code_changed,
            disabled} = this.props;
        if (!this.state.trigger_code)
            return null;
        return <div className="trigger code">
              <Rule_config id="type" type="select" data={this.type_opt}
                rule={rule} val={this.state.type}
                desc_style={{width: 'auto', minWidth: 'initial'}}
                field_row_inner_style={{paddingBottom: 6}}
                on_change={type_changed} disabled={disabled}/>
              <Cm_wrapper on_change={trigger_code_changed}
                val={this.state.trigger_code} readonly={disabled}/>
            </div>;
    }
}

const Email_note = ({www})=>
    <div>
      <span>You can manage the list of available emails </span>
      <a target="_blank" rel="noopener noreferrer" href={`${www}/cp/settings`}>
        here</a>
    </div>;

const Btn_rule_del = ({on_click, disabled})=>
    <button className="btn_rule_del" onClick={on_click} disabled={disabled}/>;
