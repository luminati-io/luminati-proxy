// LICENSE_CODE ZON
'use strict'; /*jslint react:true, es6:true*/
import React from 'react';
import {withRouter} from 'react-router-dom';
import Pure_component from '/www/util/pub/pure_component.js';
import classnames from 'classnames';
import setdb from '../../../util/setdb.js';
import ajax from '../../../util/ajax.js';
import conv from '../../../util/conv.js';
import {migrate_trigger, no_ssl_trigger_types, trigger_types,
    action_types, default_action, WWW_API} from '../../../util/rules_util.js';
import {ms} from '../../../util/date.js';
import zutil from '../../../util/util.js';
import {Labeled_controller, with_proxy_ports, Cm_wrapper,
    Warning} from '../common.js';
import {tabs} from './fields.js';
import Proxy_tester from '../proxy_tester.js';
import Tooltip from '../common/tooltip.js';
import {T} from '../common/i18n.js';
import Toggle_on_off from '../common/toggle_on_off.js';

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
    else if (rule.action=='request_url')
    {
        action.request_url = {
            url: /^https?:\/\//.test(rule.request_url) ?
                rule.request_url : 'http://'+rule.request_url,
            method: rule.request_method,
            payload: rule.request_payload && JSON.parse(rule.request_payload),
        };
    }
    else if (rule.action=='null_response')
        action.null_response = true;
    else if (rule.action=='bypass_proxy')
        action.bypass_proxy = true;
    else if (rule.action=='direct')
        action.direct = true;
    let result = null;
    if (rule.trigger_type)
    {
        result = {
            action,
            action_type: rule.action,
            trigger_type: rule.trigger_type,
            url: rule.trigger_url_regex,
        };
        if (rule.active===false)
            result.active = false;
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
    result.trigger_code = rule.trigger_code;
    result.type = rule.type;
    result.active = rule.active;
    return result;
};

export default class Rules extends Pure_component {
    state = {rules: [{id: 0}], max_id: 0, disabled_fields: {}, defaults: {}};
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
        this.setdb_on('head.proxy_edit.disabled_fields', disabled_fields=>
            disabled_fields&&this.setState({disabled_fields}));
        this.setdb_on('head.defaults',
            defaults=>this.setState({defaults: defaults||{}}));
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
    turn_ssl = ()=>this.set_field('ssl', true);
    rule_add = (rule={})=>{
        this.setState(prev=>{
            rule.id = prev.max_id+1;
            return {
                rules: [rule, ...prev.rules],
                max_id: prev.max_id+1,
            };
        }, this.rules_update);
    };
    rule_add_cb = ()=>{
        this.rule_add();
    };
    savebw_rule_exists = ()=>{
        return this.state.rules.some(r=>{
            return r.action=='bypass_proxy' &&
                (r.trigger_url_regex||'').includes('jpg');
        });
    };
    savebw_rule_add = ()=>{
        this.rule_add({
            action: 'bypass_proxy',
            trigger_type: 'url',
            trigger_url_regex: '\\.(png|jpg|jpeg|svg|gif|mp3|avi|mp4)$',
        });
    };
    retry_rule_exists = ()=>{
        return this.state.rules.some(r=>{
            return r.action=='retry' && r.status=='(4|5)..';
        });
    };
    retry_rule_add = ()=>{
        this.rule_add({
            action: 'retry',
            trigger_type: 'status',
            status: '(4|5)..',
            retry_number: 1,
        });
    };
    render(){
        const {form, rules, disabled_fields, www} = this.state;
        if (!form)
            return null;
        let {ssl} = form, def_ssl = this.state.defaults.ssl;
        let ssl_analyzing_enabled = ssl || ssl!==false && def_ssl;
        return <div className="rules">
              {!ssl_analyzing_enabled &&
                <Warning text={
                  <React.Fragment>
                    <span>
                      <T>
                        Most of the options here are available only when using
                      </T>
                      {' '}
                      <a className="link" onClick={this.turn_ssl}>
                      <T>SSL analyzing</T></a>
                    </span>
                  </React.Fragment>
                }/>
              }
              <New_rule_btn
                disabled={disabled_fields.rules}
                on_click={this.rule_add_cb}>
                <T>New custom rule</T>
              </New_rule_btn>
              <New_rule_btn
                disabled={disabled_fields.rules || this.savebw_rule_exists()}
                on_click={this.savebw_rule_add}>
                <T>Save bandwidth</T>
              </New_rule_btn>
              <New_rule_btn
                disabled={disabled_fields.rules || this.retry_rule_exists()}
                on_click={this.retry_rule_add}>
                <T>Retry failed requests</T>
              </New_rule_btn>
              {rules.map(r=>
                <Rule key={r.id}
                  rule={r}
                  rule_del={this.rule_del}
                  www={www} ssl={ssl_analyzing_enabled}
                  disabled={disabled_fields.rules}/>
              )}
              <Tester_wrapper/>
            </div>;
    }
}

const New_rule_btn = ({on_click, disabled, children})=>{
    return <button className="btn btn_lpm btn_lpm_small rule_add_btn"
          onClick={on_click} disabled={disabled}>
          {children}
          <i className="glyphicon glyphicon-plus"/>
        </button>;
};

const Tester_wrapper = withRouter(class Tester_wrapper extends Pure_component {
    render(){
        return <div className="tester_wrapper">
              <div className="nav_header" style={{marginBottom: 5}}>
                <h3><T>Test rules</T></h3>
              </div>
              <Proxy_tester port={this.props.match.params.port} no_labels/>
            </div>;
    }
});

class Rule_config extends Pure_component {
    state = {disabled_fields: {}};
    componentDidMount(){
        this.setdb_on('head.proxy_edit.disabled_fields', disabled_fields=>
            disabled_fields&&this.setState({disabled_fields}));
    }
    value_change = value=>{
        if (this.props.on_change)
            this.props.on_change(value);
        setdb.emit('head.proxy_edit.update_rule', {field: this.props.id,
            rule_id: this.props.rule.id, value});
    };
    render(){
        const id = this.props.id;
        const tab_id = 'rules';
        const disabled = this.props.disabled||this.state.disabled_fields[id];
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
              disabled={disabled}
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
          <a className="link" onClick={goto_banlist}>
            <T>Currently banned IPs</T>
          </a>
        </span>;
});

class Rule extends Pure_component {
    state = {expanded: false};
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
    toggle_active = e=>{
        e.stopPropagation();
        const active = this.props.rule.active===undefined||
            this.props.rule.active;
        this.set_rule_field('active', !active);
    };
    expand = ()=>{
        this.setState({expanded: true});
    };
    collapse = ()=>{
        this.setState({expanded: false});
    };
    render(){
        let {rule_del, rule, ssl, disabled} = this.props;
        const active = rule.active===undefined||rule.active;
        const {ui_blocked} = this.state;
        const trigger = trigger_types.find(t=>t.value==rule.trigger_type);
        let trigger_label;
        if (rule.trigger_code)
            trigger_label = 'Custom code';
        else if (!trigger)
            trigger_label = 'Trigger not set';
        else
        {
            const tv = trigger && ': '+(rule[trigger.value] ?
                rule[trigger.value] : 'not set');
            trigger_label = trigger.key+tv;
        }
        const action = action_types.find(a=>a.value==rule.action);
        const action_label = action ? action.key : 'Action not set';
        let rule_label;
        if (!trigger && !action)
            rule_label = 'Empty rule - click to edit';
        else
            rule_label = trigger_label+' -> '+action_label;
        return <div>
          <div className={classnames('rule_wrapper',
            {collapsed: !this.state.expanded})}
            onClick={this.expand}>
            {this.state.expanded &&
              <React.Fragment>
                <Trigger rule={rule} ui_blocked={ui_blocked} ssl={ssl}
                  set_rule_field={this.set_rule_field} disabled={disabled}
                  change_ui_block={this.change_ui_block}/>
                <Action rule={rule} set_rule_field={this.set_rule_field}
                  change_ui_block={this.change_ui_block}/>
              </React.Fragment>
            }
            {!this.state.expanded &&
              <div className="ui">
                {rule_label}
              </div>
            }
            <Btn_rule_del on_click={()=>rule_del(rule.id)}/>
            <Btn_rule_toggle expanded={this.state.expanded}
              collapse={this.collapse} expand={this.expand}/>
            <Toggle_on_off val={active} on_click={this.toggle_active}/>
          </div>
        </div>;
    }
}

const Action = with_proxy_ports(withRouter(
class Action extends Pure_component {
    state = {ports: []};
    componentDidMount(){
        this.setdb_on('head.defaults', defaults=>{
            if (defaults)
                this.setState({defaults});
        });
        this.setdb_on('head.settings', settings=>{
            if (settings)
                this.setState({settings});
        });
        this.setdb_on('ws.zones', zones=>{
            if (zones)
                this.setState({zones});
        });
        this.setdb_on('head.proxy_edit.zone_name', curr_zone=>{
            if (curr_zone)
                this.setState({curr_zone}, this.load_refresh_cost);
        });
    }
    load_refresh_cost = ()=>{
        if (!this.should_show_refresh())
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
    };
    request_method_changed = val=>{
        if (val=='GET')
            delete this.props.rule.request_payload;
    };
    goto_tester = ()=>{
        this.props.history.push({pathname: `/proxy_tester`, state: {
            url: `${this.state.defaults.www_api}/lpm/templates/product`,
            port: this.props.match.params.port,
        }});
    };
    should_show_refresh = ()=>{
        const {zones, curr_zone} = this.state;
        const zone = (zones.zones||[]).find(z=>z.name==curr_zone);
        const plan = zone && zone.plan || {};
        if (['static', 'static_res'].includes(plan.type))
            return plan.ips>0;
        if (plan.type=='resident')
            return plan.vips>0;
        return false;
    };
    request_methods = ()=>
        ['GET', 'POST', 'PUT', 'DELETE'].map(m=>({key: m, value: m}));
    action_types_with_updated_domain = ()=>{
        const _action_types = zutil.clone_deep(action_types);
        _action_types.forEach(at=>at.tooltip = (at.tooltip||'')
            .replace(WWW_API, this.state.defaults.www_api));
        return _action_types;
    };
    render(){
        const {rule, match, ports_opt} = this.props;
        const {defaults, settings, zones, curr_zone,
            refresh_cost} = this.state;
        if (!rule.trigger_type || !settings || !defaults)
            return null;
        if (!zones || !curr_zone)
            return null;
        let _action_types = this.action_types_with_updated_domain()
            .filter(at=>rule.trigger_type=='url' && at.url ||
                rule.trigger_type!='url' && !at.only_url)
            .filter(at=>rule.trigger_type!='min_req_time' ||
                at.min_req_time);
        if (this.should_show_refresh())
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
        _action_types = [default_action].concat(_action_types);
        const current_port = match.params.port;
        const ports = ports_opt.filter(p=>p.value!=current_port);
        ports.unshift({key: '--Select--', value: ''});
        const ban_action = ['ban_ip', 'ban_ip_domain', 'ban_ip_global']
            .includes(rule.action);
        return <React.Fragment>
              <div className="action ui">
                {rule.trigger_type &&
                  <Rule_config id="action" type="select" data={_action_types}
                    on_change={this.action_changed} rule={rule}/>
                }
                {rule.action=='retry' &&
                  <Rule_config id="retry_number" type="select_number"
                    rule={rule}/>
                }
                {rule.action=='retry_port' &&
                  <Rule_config id="retry_port" type="select" data={ports}
                    rule={rule}/>
                }
                {rule.action=='switch_port' &&
                  <Rule_config id="switch_port" type="select" data={ports}
                    rule={rule}/>
                }
                {ban_action &&
                  <Rule_config id="ban_ip_duration" type="select_number"
                    data={[0, 1, 5, 10, 30, 60]} sufix="minutes" rule={rule}
                    note={<Ban_ips_note/>}/>
                }
                {rule.action=='request_url' &&
                  <div>
                    <Rule_config id="request_url" type="url" rule={rule}/>
                    <Rule_config id="request_method" type="select" rule={rule}
                        data={this.request_methods()}
                        on_change={this.request_method_changed}/>
                    {rule.request_method && rule.request_method!='GET' &&
                      <Rule_config id="request_payload" type="json"
                        rule={rule}/>
                    }
                  </div>
                }
              </div>
            </React.Fragment>;
    }
}));

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
        const {rule, ui_blocked, change_ui_block, ssl, disabled} = this.props;
        let tip = ' ';
        if (ui_blocked)
        {
            tip = `Trigger function was modified. Click 'restore' to generate
                it based on your selections.`;
        }
        return <React.Fragment>
              <div className="trigger ui" onFocus={e=>e.stopPropagation()}>
                <Tooltip title={tip}>
                <div className={classnames('mask', {active: ui_blocked})}>
                  <button className="btn btn_lpm btn_lpm_small reset_btn"
                    onClick={()=>change_ui_block(false)}>
                    Restore
                  </button>
                </div>
                </Tooltip>
                <Rule_config id="trigger_type" type="select"
                  data={ssl ? trigger_types : no_ssl_trigger_types}
                  on_change={this.trigger_changed} rule={rule}/>
                {rule.trigger_type=='body' &&
                  <Rule_config id="body_regex" type="regex_text" rule={rule}
                    field_row_inner_style={{paddingBottom: '1em'}}
                    style={{borderRadius: '4px'}}
                    />}
                {rule.trigger_type=='min_req_time' &&
                  <Rule_config id="min_req_time" type="select_number"
                    range="ms" sufix="milliseconds" rule={rule}/>
                }
                {rule.trigger_type=='max_req_time' &&
                  <Rule_config id="max_req_time" type="select_number"
                    range="ms" sufix="milliseconds" rule={rule}/>
                }
                {rule.trigger_type=='status' &&
                  <Rule_config id="status" type="select_status" rule={rule}/>
                }
                {rule.trigger_type &&
                  <Rule_config id="trigger_url_regex" type="regex"
                    rule={rule} style={{width: '100%'}}
                    field_row_inner_style={{paddingBottom: '1em'}}/>}
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
                on_change={type_changed}/>
              <Cm_wrapper on_change={trigger_code_changed}
                val={this.state.trigger_code} readonly={disabled}/>
            </div>;
    }
}

const Btn_rule_del = ({on_click})=>
    <Tooltip title="Delete">
      <button tabIndex={-1} className="btn_rule del" onClick={on_click}
        onFocus={e=>e.stopPropagation()}/>
    </Tooltip>;

const Btn_rule_toggle = ({expanded, expand, collapse})=>{
    const on_click = e=>{
        e.stopPropagation();
        if (expanded)
            return collapse();
        expand();
    };
    const tip = expanded ? 'Collapse' : 'Expand';
    return <Tooltip title={tip}>
        <div tabIndex={-1}
        className="btn_rule toggle"
        onClick={on_click}
        onFocus={e=>e.stopPropagation()}>
          <button className={classnames({expanded, collapsed: !expanded})}/>
        </div>
      </Tooltip>;
};
