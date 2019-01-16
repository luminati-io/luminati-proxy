// LICENSE_CODE ZON
'use strict'; /*jslint react:true, es6:true*/
import React from 'react';
import Pure_component from '../../../www/util/pub/pure_component.js';
import setdb from '../../../util/setdb.js';
import {migrate_trigger, migrate_action, trigger_types,
    action_types, default_action} from '../../../util/rules_util.js';
import {ms} from '../../../util/date.js';
import {withRouter} from 'react-router-dom';
import {Labeled_controller, Note, with_proxy_ports, Cm_wrapper,
    Field_row_raw, Tooltip, Ext_tooltip} from '../common.js';
import {tabs} from './fields.js';
import {Tester} from '../proxy_tester.js';
import classnames from 'classnames';
import {Chrome_table} from '../chrome_widgets.js';

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
    else if (rule.action=='refresh_ip')
        action.refresh_ip = true;
    else if (rule.action=='save_to_pool')
        action.reserve_session = true;
    else if (rule.action=='save_to_fast_pool')
    {
        action.fast_pool_session = true;
        action.fast_pool_size = rule.fast_pool_size;
    }
    else if (rule.action=='process')
    {
        try { action.process = JSON.parse(rule.process); }
        catch(e){ console.log('wrong json'); }
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
    if (rule.action.fast_pool_session)
        result.fast_pool_size = rule.action.fast_pool_size;
    if (rule.action.ban_ip)
    {
        result.ban_ip_duration = rule.action.ban_ip/ms.MIN;
        if (result.ban_ip_domain = !!rule.action.ban_ip_domain_reqs)
        {
            result.ban_ip_domain_reqs = rule.action.ban_ip_domain_reqs;
            result.ban_ip_domain_time = rule.action.ban_ip_domain_time/ms.MIN;
        }
    }
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
        if (this.state.form.ext_proxies)
            return <Note><Ext_tooltip/></Note>;
        return <div className="rules">
              {!this.state.form.ssl &&
                <Note>
                  <span><strong>Warning: </strong></span>
                  <span>we can't apply rules to HTTPS requests unless </span>
                  <a onClick={this.goto_ssl} className="link">SSL proxy</a>
                  <span> is turned on</span>
                </Note>
              }
              {this.state.form.debug=='none' &&
                <Note>
                  <span><strong>Warning: </strong></span>
                  <span>some rules may not work correctly without </span>
                  <a onClick={this.goto_debug} className="link">
                    Request debug info</a>
                </Note>
              }
              <button className="btn btn_lpm btn_lpm_small rule_add_btn"
                onClick={this.rule_add}>
                New rule
                <i className="glyphicon glyphicon-plus"/>
              </button>
              {this.state.rules.map(r=>
                <Rule key={r.id} rule={r} rule_del={this.rule_del}
                   www={this.state.www}/>
              )}
              <Tester_wrapper/>
            </div>;
    }
}

const cols = [
    {id: 'trigger_type', title: 'Trigger'},
    {id: 'action', title: 'Action'},
];

// XXX krzysztof: WIP
//  <Rules_table rules={this.state.rules} rule_del={this.rule_del}
//    www={this.state.www}/>
class Rules_table extends Pure_component {
    data = ()=>{
        return this.props.rules;
    };
    render(){
        return <Chrome_table title="Rules" cols={cols}
              fetch_data={this.data}>
              {d=>
                <tr key={d.id}>
                  <td>{d.trigger_type}</td>
                  <td>{d.action}</td>
                </tr>
              }
            </Chrome_table>;
    }
}

const Tester_wrapper = withRouter(class Tester_wrapper extends Pure_component {
    render(){
        return <div className="tester_wrapper">
              <div className="nav_header" style={{marginBottom: 5}}>
                <h3>Test rules</h3>
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

const Fast_pool_note = ({port, r})=>{
    return <span>
          <span>Check fast pool sessions by fetching </span>
          <a href={window.location.origin+'/api/fast/'+port+'?r='+r}
            target="_blank" className="link" rel="noopener noreferrer">
            /api/fast/{port}?r={r}
          </a>
        </span>;
};

const Ban_ips_note = withRouter(({match, history})=>{
    const goto_banlist = ()=>{
        const port = match.params.port;
        history.push({pathname: `/proxy/${port}/logs/banned_ips`});
    };
    return <span>
          <a className="link" onClick={goto_banlist}>Currently banned IPs</a>
        </span>;
});

const Rule = ({rule_del, rule})=>
    <div>
      <div className="rule_wrapper">
        <Trigger rule={rule}/>
        <Action rule={rule}/>
        <Btn_rule_del on_click={()=>rule_del(rule.id)}/>
      </div>
    </div>;

const Action = with_proxy_ports(withRouter(
class Action extends Pure_component {
    state = {ports: []};
    componentDidMount(){
        this.setdb_on('head.consts', consts=>{
            if (consts && consts.logins)
                this.setState({logins: consts.logins});
        });
        this.setdb_on('head.defaults', defaults=>{
            if (defaults && defaults.www_api)
                this.setState({www: defaults.www_api});
        });
    }
    set_rule_field = (field, value)=>{
        setdb.emit('head.proxy_edit.update_rule', {rule_id: this.props.rule.id,
            field, value});
    };
    action_changed = val=>{
        if (val=='retry_port'||val=='switch_port')
        {
            const def_port = this.props.ports_opt.filter(p=>
                p.value!=this.props.match.params.port)[0];
            this.set_rule_field(val, def_port && def_port.value || '');
        }
        if (val!='ban_ip')
            this.set_rule_field('ban_ip_duration', '');
        if (!val)
        {
            this.set_rule_field('email', '');
            this.set_rule_field('send_email', false);
        }
    };
    send_email_changed = val=>{
        if (!val)
            return this.set_rule_field('email', '');
        if (!this.state.logins)
            return;
        return this.set_rule_field('email', this.state.logins[0]);
    };
    goto_tester = ()=>{
        this.props.history.push({pathname: `/proxy_tester`, state: {
            url: 'https://luminati.io/lpm/templates/product',
            port: this.props.match.params.port,
        }});
    };
    render(){
        const {rule, match, ports_opt} = this.props;
        const {logins, www} = this.state;
        const _action_types = [default_action].concat(action_types
        .filter(at=>at.value!='save_to_fast_pool' ||
            rule.trigger_type=='max_req_time')
        .filter(at=>rule.trigger_type=='url' && at.url ||
            rule.trigger_type!='url' && !at.only_url)
        .filter(at=>rule.trigger_type!='min_req_time' ||
            at.min_req_time));
        const current_port = match.params.port;
        const ports = ports_opt.filter(p=>p.value!=current_port);
        ports.unshift({key: '--Select--', value: ''});
        const fast_pool_note = <Fast_pool_note port={current_port}
          r={rule.trigger_url_regex}/>;
        if (!rule.trigger_type)
            return null;
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
                {rule.action=='ban_ip' &&
                  <Rule_config id="ban_ip_duration" type="select_number"
                    data={[0, 1, 5, 10, 30, 60]} sufix="minutes" rule={rule}
                    note={<Ban_ips_note/>}/>
                }
                {rule.action=='save_to_fast_pool' &&
                  <Rule_config id="fast_pool_size" type="select_number"
                    rule={rule} note={fast_pool_note}/>
                }
                {rule.action=='process' &&
                  <div>
                    <Rule_config id="process" type="json" rule={rule}/>
                    <Field_row_raw>
                      Test data processing in
                      <a onClick={this.goto_tester} className="link api_link">
                        proxy tester</a>
                    </Field_row_raw>
                  </div>
                }
                {rule.action &&
                  <Rule_config id="send_email" type="yes_no" rule={rule}
                    on_change={this.send_email_changed}/>
                }
                {rule.send_email && logins &&
                  logins.length==1 &&
                  <Rule_config id="email" type="text" rule={rule} disabled/>
                }
                {rule.send_email && logins && logins.length>1 &&
                  <Rule_config id="email" type="select" rule={rule}
                    data={logins.map(l=>({key: l, value: l}))}
                    note={<Email_note www={www}/>}/>
                }
              </div>
              <Action_code rule={rule}/>
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
        const tip = 'See the action as JavaScript function. Currently it is'
        +' Read-only. We are working on support for editing.';
        return <Tooltip title={tip}>
              <div className="action code">
                <Cm_wrapper on_change={this.on_change} readonly
                  val={this.state.action_code}/>
              </div>
            </Tooltip>;
    }
}

class Trigger extends Pure_component {
    state = {};
    set_rule_field = (field, value)=>{
        setdb.emit('head.proxy_edit.update_rule', {rule_id: this.props.rule.id,
            field, value});
    };
    componentDidMount(){
        const rule = this.props.rule;
        if (rule && (rule.trigger_code || rule.type))
            this.setState({ui_blocked: true});
    }
    trigger_changed = val=>{
        if (this.props.rule.trigger_type=='url' && val!='url' ||
            this.props.rule.trigger_type!='url' && val=='url' || !val)
        {
            this.set_rule_field('action', '');
        }
        if (val!='status')
            this.set_rule_field('status', '');
        if (val!='body')
            this.set_rule_field('body_regex', '');
        if (val!='min_req_time')
            this.set_rule_field('min_req_time', '');
        if (val!='max_req_time')
        {
            this.set_rule_field('max_req_time', '');
            if (this.props.rule.action=='save_to_fast_pool')
            {
                this.set_rule_field('action', '');
                this.set_rule_field('fast_pool_size', '');
            }
        }
        if (!val)
            this.set_rule_field('trigger_url_regex', '');
    };
    trigger_code_changed = val=>{
        this.setState({ui_blocked: true});
        this.set_rule_field('trigger_code', val);
    };
    type_changed = val=>{
        this.setState({ui_blocked: true});
    };
    unblock_ui = ()=>{
        this.set_rule_field('trigger_code', undefined);
        this.set_rule_field('type', undefined);
        this.setState({ui_blocked: false});
    };
    render(){
        const {rule} = this.props;
        const {ui_blocked} = this.state;
        let tip = ' ';
        if (ui_blocked)
        {
            tip = `Trigger funciton was modified. Click 'restore' to generate
                it based on your selections.`;
        }
        return <React.Fragment>
              <div className="trigger ui">
                <Tooltip title={tip}>
                <div className={classnames('mask', {active: ui_blocked})}>
                  <button className="btn btn_lpm btn_lpm_small reset_btn"
                    onClick={this.unblock_ui}>
                    Restore
                  </button>
                </div>
                </Tooltip>
                <Rule_config id="trigger_type" type="select"
                  data={trigger_types} on_change={this.trigger_changed}
                  rule={rule}/>
                {rule.trigger_type=='body' &&
                  <Rule_config id="body_regex" type="text" rule={rule}/>}
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
                    rule={rule} style={{width: '100%'}}/>}
              </div>
              <Trigger_code rule={rule} type_changed={this.type_changed}
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
        if (!this.state.trigger_code)
            return null;
        return <div className="trigger code">
              <Rule_config id="type" type="select" data={this.type_opt}
                rule={this.props.rule} val={this.state.type}
                desc_style={{width: 'auto', minWidth: 'initial'}}
                on_change={this.props.type_changed}
                field_row_inner_style={{paddingBottom: 6}}/>
              <Cm_wrapper on_change={this.props.trigger_code_changed}
                val={this.state.trigger_code}/>
            </div>;
    }
}

const Email_note = ({www})=>
    <div>
      <span>You can manage the list of available emails </span>
      <a target="_blank" rel="noopener noreferrer" href={`${www}/cp/settings`}>
        here</a>
    </div>;

const Btn_rule_del = ({on_click})=>
    <div className="btn_rule_del" onClick={on_click}/>;
