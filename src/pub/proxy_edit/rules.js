// LICENSE_CODE ZON
'use strict'; /*jslint react:true, es6:true*/
import React from 'react';
import Pure_component from '../../../www/util/pub/pure_component.js';
import setdb from '../../../util/setdb.js';
import {migrate_trigger, migrate_action} from '../../../util/rules_util.js';
import {ms} from '../../../util/date.js';
import {withRouter} from 'react-router-dom';
import {Labeled_controller, Note, with_proxy_ports, Cm_wrapper,
    Field_row_raw, Tooltip} from '../common.js';
import {tabs} from './fields.js';

const trigger_types = [
    {key: '--Select--', value: '', tooltip: `Choose a trigger type.
        For each request the system will check if the trigger is matching
        the response`},
    {key: 'URL', value: 'url', tooltip: `Trigger will be pulled for all
        requests to the selected URL`},
    {key: 'Status code', value: 'status', tooltip: `Trigger will be pulled
        for all the requests that returns the matching status code`},
    {key: 'HTML body element', value: 'body', tooltip: `Trigger will be
        pulled when the response <body> contain the selected string`},
    {key: 'Request time more than', value: 'min_req_time',
        tooltip: `Triggers when the request time is above the selected value`,
        type: 'pre'},
    {key: 'Request time less than', value: 'max_req_time',
        tooltip: `Triggers when the request time is below the selected value`},
];

const default_action = {key: '--Select--', value: '', tooltip: `Select an
    action.  Once the trigger rule is met the selected action is executed
    automatically.`};
const action_types = [
    {key: 'Retry with new IP', value: 'retry', tooltip: `System will send the
        exact same request again with newly refreshed IP`,
        min_req_time: true},
    {key: 'Retry with new proxy port (Waterfall)', value: 'retry_port',
        tooltip: `System will send another request using different port
        from your port list. This can allow cost optimization by escalating the
        request between different types of networks according to the port
        configuration.`, min_req_time: true},
    {key: 'Ban IP', value: 'ban_ip', tooltip: `Will ban the IP for custom
        amount of time. Usually used for failed requests.`, min_req_time: true,
        type: 'post'},
    {key: 'Refresh IP', value: 'refresh_ip', tooltip: `Refresh the current
        Data Center IP with new allocated IP. This action contain
        additional charges. View the cost of IP refreshing in your zones
        page http://luminati.io/cp/zones`},
    {key: 'Save IP to reserved pool', value: 'save_to_pool', tooltip: `Save
        the current IP to a pool of reserved IPs.  you can then download all
        the IPs at a later time.`},
    {key: 'Save IP to fast pool', value: 'save_to_fast_pool', tooltip: `Save
        the current IP to fast IP pool to increase the speed of your requests.
        You will need to specify the size of this pool.`},
    {key: 'Null response', value: 'null_response', tooltip: `LPM will return a
        "null response" without proxying. It is useful when users do not want
        to make a request, but a browser expects 200 response.`, type: 'pre',
        only_url: true},
    {key: 'Bypass proxy', value: 'bypass_proxy', tooltip: `Requests will be
        passed directly to target site without any proxy (super proxy or
        peer).`, type: 'pre', only_url: true},
    {key: 'Direct super proxy', value: 'direct', tooltip: `Requests will be
        passed through super proxy (not through peers)`, type: 'pre',
        only_url: true},
    {key: 'Process data', value: 'process', only_url: true},
    {key: 'Switch port', value: 'switch_port', only_url: true, type: 'pre'},
];

const pre_actions = action_types.filter(a=>a.type=='pre').map(a=>a.value);
const post_actions = action_types.filter(a=>a.type=='post').map(a=>a.value);
const pre_trigger_types = trigger_types.filter(tt=>tt.type=='pre')
.map(tt=>tt.value);
const is_pre_rule = rule=>pre_actions.includes(rule.action)||
    pre_trigger_types.includes(rule.trigger_type)&&
    !post_actions.includes(rule.action);
const is_post_rule = rule=>!is_pre_rule(rule);
const post_rule_prepare = rule=>{
    const action_raw = {};
    if (['retry', 'retry_port'].includes(rule.action))
        action_raw.retry = true;
    if (rule.action=='retry' && rule.retry_number)
        action_raw.retry = rule.retry_number;
    else if (rule.action=='retry_port')
        action_raw.retry_port = Number(rule.retry_port);
    else if (rule.action=='ban_ip')
        action_raw.ban_ip = (rule.ban_ip_duration||0)*ms.MIN;
    else if (rule.action=='refresh_ip')
        action_raw.refresh_ip = true;
    else if (rule.action=='save_to_pool')
        action_raw.reserve_session = true;
    else if (rule.action=='save_to_fast_pool')
    {
        action_raw.fast_pool_session = true;
        action_raw.fast_pool_size = rule.fast_pool_size;
    }
    else if (rule.action=='process')
    {
        try { action_raw.process = JSON.parse(rule.process); }
        catch(e){ console.log('wrong json'); }
    }
    if (rule.email)
        action_raw.email = rule.email;
    let result = null;
    if (rule.trigger_type)
    {
        result = {
            action: action_raw,
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
    if (result)
        result = migrate_trigger('post')(result);
    return result;
};
const pre_rule_prepare = rule=>{
    let res = {
        url: rule.trigger_url_regex,
        action: rule.action,
        trigger_type: rule.trigger_type,
    };
    if (rule.email)
        res.email = rule.email;
    if (rule.action=='retry_port')
        res.retry_port = rule.retry_port;
    if (rule.min_req_time)
        res.min_req_time = rule.min_req_time;
    if (rule.switch_port)
        res.port = +rule.switch_port;
    res.retry = rule.retry_number||1;
    res = migrate_trigger('pre')(res);
    return res;
};
export const pre_rule_map_to_form = rule=>{
    const res = {
        trigger_url_regex: rule.url,
        action: rule.action,
        trigger_type: rule.trigger_type,
    };
    if (rule.email)
    {
        res.send_email = true;
        res.email = rule.email;
    }
    if (rule.retry_port)
        res.retry_port = rule.retry_port;
    if (rule.min_req_time)
        res.min_req_time = rule.min_req_time;
    if (rule.port)
        res.switch_port = rule.port;
    res.retry_number = rule.retry||1;
    return res;
};
export const post_rule_map_to_form = rule=>{
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
            result.ban_ip_domain_time =
                rule.action.ban_ip_domain_time/ms.MIN;
        }
    }
    if (rule.action.process)
        result.process = JSON.stringify(rule.action.process, null, '  ');
    if (rule.action.email)
    {
        result.send_email = true;
        result.email = rule.action.email;
    }
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
            rules: [...prev.rules, {id: prev.max_id+1}],
            max_id: prev.max_id+1,
        }));
    };
    rule_del = id=>{
        if (this.state.rules.length==1)
            this.setState({rules: [{id: 0}], max_id: 0}, this.rules_update);
        else
        {
            this.setState(prev=>({rules: prev.rules.filter(r=>r.id!=id)}),
                this.rules_update);
        }
    };
    rules_update = ()=>{
        setdb.set('head.proxy_edit.rules', this.state.rules);
        const clean = r=>{
            delete r.type;
            delete r.trigger_code;
            return r;
        };
        const post = this.state.rules.filter(is_post_rule)
            .map(post_rule_prepare).filter(Boolean).map(clean);
        const pre = this.state.rules.filter(is_pre_rule)
            .map(pre_rule_prepare).filter(Boolean).map(clean);
        let rules = this.state.form.rules||{};
        if (post.length)
            rules.post = post;
        else
            delete rules.post;
        if (pre.length)
            rules.pre = pre;
        else
            delete rules.pre;
        if (!rules.post && !rules.pre)
            rules = null;
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
              {this.state.rules.map(r=>
                <Rule key={r.id} rule={r} rule_del={this.rule_del}
                   www={this.state.www}/>
              )}
              <button className="btn btn_lpm btn_lpm_small rule_add_btn"
                onClick={this.rule_add}>
                New rule
                <i className="glyphicon glyphicon-plus"/>
              </button>
            </div>;
    }
}

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
        .filter(at=>rule.trigger_type=='url' && at.only_url ||
            rule.trigger_type!='url' && !at.only_url)
        .filter(at=>rule.trigger_type!='min_req_time' ||
            at.min_req_time));
        const current_port = match.params.port;
        const ports = ports_opt.filter(p=>p.value!=current_port);
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
        let prepared;
        if (is_pre_rule(props.rule))
            prepared = pre_rule_prepare(props.rule);
        else if (is_post_rule(props.rule))
            prepared = post_rule_prepare(props.rule);
        const {action_code} = migrate_action(prepared)||{};
        return {action_code};
    }
    render(){
        return <div className="action code">
              {false && <Cm_wrapper on_change={this.on_change}
                val={this.state.action_code}/>}
            </div>;
    }
}

class Trigger extends Pure_component {
    set_rule_field = (field, value)=>{
        setdb.emit('head.proxy_edit.update_rule', {rule_id: this.props.rule.id,
            field, value});
    };
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
    render(){
        const {rule} = this.props;
        return <React.Fragment>
              <div className="trigger ui">
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
              <Trigger_code rule={rule}/>
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
        let prepared;
        if (is_pre_rule(props.rule))
            prepared = pre_rule_prepare(props.rule);
        else if (is_post_rule(props.rule))
            prepared = post_rule_prepare(props.rule);
        const {trigger_code, type} = prepared||{};
        return {trigger_code, type};
    }
    on_change = val=>{
        console.log(val);
    };
    render(){
        if (!this.state.trigger_code)
            return null;
        const tip = 'See the trigger as JavaScript function. Currently it is'
        +' Read-only. We are working on support for editing.';
        return <Tooltip title={tip}>
                <div className="trigger code">
                  <Rule_config id="_type" type="select" data={this.type_opt}
                    disabled rule={this.props.rule} val={this.state.type}
                    desc_style={{width: 'auto', minWidth: 'initial'}}
                    field_row_inner_style={{paddingBottom: 6}}/>
                  <Cm_wrapper on_change={this.on_change}
                    val={this.state.trigger_code}/>
                </div>
              </Tooltip>;
    }
}

const Email_note = ({www})=><div>
      <span>You can manage the list of available emails </span>
      <a target="_blank" rel="noopener noreferrer" href={`${www}/cp/settings`}>
        here</a>
    </div>;

const Btn_rule_del = ({on_click})=><Note>
      <div className="btn_rule_del" onClick={on_click}/>
    </Note>;
