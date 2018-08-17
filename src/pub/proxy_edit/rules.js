// LICENSE_CODE ZON
'use strict'; /*jslint react:true, es6:true*/
import React from 'react';
import Pure_component from '../../../www/util/pub/pure_component.js';
import ajax from '../../../util/ajax.js';
import setdb from '../../../util/setdb.js';
import {getContext, withContext} from 'recompose';
import {withRouter} from 'react-router-dom';
import {Labeled_controller, Note} from '../common.js';
import {validators} from './common.js';
import {tabs} from './fields.js';
import PropTypes from 'prop-types';
import filesaver from 'file-saver';
const provider = provide=>withContext({provide: PropTypes.object},
    ()=>({provide}));

const trigger_types = [
    {key: 'i.e. Status code', value: '', tooltip: `Choose a trigger type.
        For each request the system will check if the trigger is matching
        the response`},
    {key: 'URL', value: 'url', tooltip: `Trigger will be pulled for all
        requests to the selected URL`},
    {key: 'Status code', value: 'status', tooltip: `Trigger will be pulled
        for all the requests that returns the matching status code`},
    {key: 'HTML body element', value: 'body', tooltip: `Trigger will be
        pulled when the response <body> contain the selected string`},
    {key: 'Minimum request time', value: 'min_req_time', tooltip: `Trigger will
        be pulled when the request time is above the selected value`},
    {key: 'Maximum request time', value: 'max_req_time', tooltip: `Trigger
        will be pulled when the request time is below the selected value`},
];

const default_action = {key: 'Choose an action type', value: '',
    tooltip: `Select an action.  Once the trigger rule is met the selected
    action is executed automatically.`};
const action_types = [
    {key: 'Retry with new IP', value: 'retry', tooltip: `System will send the
        exact same request again with newly refreshed IP`},
    {key: 'Retry with new proxy port (Waterfall)', value: 'retry_port',
        tooltip: `System will send another request using different port
        from your port list. This can allow cost optimization by escalating the
        request between different types of networks according to the port
        configuration.`},
    {key: 'Ban IP', value: 'ban_ip', tooltip: `Will ban the IP for custom
        amount of time. usually used for failed request.`},
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
];

const pre_actions = action_types.filter(a=>a.type=='pre').map(a=>a.value);
const is_pre_rule = rule=>pre_actions.includes(rule.action);
const is_post_rule = rule=>!is_pre_rule(rule);

const status_types = [
    'i.e. 200 - Succeeded requests',
    '200 - Succeeded requests',
    '403 - Forbidden',
    '404 - Not found',
    '500 - Internal server error',
    '502 - Bad gateway',
    '503 - Service unavailable',
    '504 - Gateway timeout',
    'Custom',
].map(s=>({key: s, value: s}));

const ban_options = [
    {key: '10 minutes', value: '10min'},
    {key: '20 minutes', value: '20min'},
    {key: '30 minutes', value: '30min'},
    {key: '40 minutes', value: '40min'},
    {key: '50 minutes', value: '50min'},
    {key: 'Custom', value: 'custom'},
];

export default provider({tab_id: 'rules'})(
class Rules extends Pure_component {
    state = {rules: [{id: 0}], max_id: 0};
    set_field = setdb.get('head.proxy_edit.set_field');
    goto_field = setdb.get('head.proxy_edit.goto_field');
    componentDidMount(){
        this.setdb_on('head.proxy_edit.form', form=>this.setState({form}));
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
    post_rule_prepare = rule=>{
        const action_raw = {};
        if (['retry', 'retry_port', 'ban_ip', 'refresh_ip'].includes(
            rule.action))
        {
            action_raw.retry = true;
        }
        if (rule.action=='retry' && rule.retry_number)
            action_raw.retry = rule.retry_number;
        else if (rule.action=='retry_port')
            action_raw.retry_port = rule.retry_port;
        else if (rule.action=='ban_ip')
        {
            if (rule.ban_ip_duration!='custom')
                action_raw.ban_ip = rule.ban_ip_duration||'10min';
            else
                action_raw.ban_ip = rule.ban_ip_custom+'min';
        }
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
                res: [{
                    head: true,
                    action: action_raw,
                    action_type: rule.action,
                    trigger_type: rule.trigger_type,
                }],
                url: rule.trigger_url_regex||'**',
            };
        }
        if (rule.trigger_type=='status')
        {
            let rule_status = rule.status_code=='Custom' ?
                rule.status_custom : rule.status_code;
            rule_status = rule_status||'';
            result.res[0].status = {type: 'in', arg: rule_status};
            result.res[0].status_custom = rule.status_code=='Custom';
        }
        else if (rule.trigger_type=='body'&&rule.body_regex)
            result.res[0].body = {type: '=~', arg: rule.body_regex};
        else if (rule.trigger_type=='min_req_time'&&rule.min_req_time)
            result.res[0].min_req_time = rule.min_req_time+'ms';
        else if (rule.trigger_type=='max_req_time'&&rule.max_req_time)
            result.res[0].max_req_time = rule.max_req_time+'ms';
        return result;
    };
    pre_rule_prepare = rule=>{
        const res = {
            url: rule.trigger_url_regex||'**',
            action: rule.action,
            trigger_type: rule.trigger_type,
        };
        if (rule.email)
            res.email = rule.email;
        return res;
    };
    rules_update = ()=>{
        setdb.set('head.proxy_edit.rules', this.state.rules);
        const post = this.state.rules.filter(is_post_rule)
            .map(this.post_rule_prepare).filter(Boolean);
        const pre = this.state.rules.filter(is_pre_rule)
            .map(this.pre_rule_prepare).filter(Boolean);
        let rules = this.state.form.rules||{};
        if (post.length)
            rules.post = post;
        else
            delete rules.post;
        if (pre.length)
            rules.pre = pre;
        else
            delete rules.pre;
        if (!rules.post&&!rules.pre)
            rules = null;
        this.set_field('rules', rules);
    };
    goto_ssl = ()=>this.goto_field('ssl');
    render(){
        return <div>
              {!this.props.form.ssl &&
                <Note>
                  <span><strong>Warning: </strong></span>
                  <span>we can't apply rules to HTTPS requests unless </span>
                  <a onClick={this.goto_ssl} className="link">SSL proxy</a>
                  <span> is turned on</span>
                </Note>
              }
              {this.state.rules.map(r=>
                <Rule key={r.id} rule={r} rule_del={this.rule_del}/>
              )}
              <button className="btn btn_lpm btn_lpm_small rule_add_btn"
                onClick={this.rule_add}>
                New rule
                <i className="glyphicon glyphicon-plus"/>
              </button>
            </div>;
    }
});

const Rule_config = getContext({provide: PropTypes.object})(
class Rule_config extends Pure_component {
    value_change = value=>{
        if (this.props.on_change)
            this.props.on_change(value);
        setdb.emit('head.proxy_edit.update_rule', {field: this.props.id,
            rule_id: this.props.rule.id, value});
    };
    render(){
        const id = this.props.id;
        const tab_id = this.props.provide.tab_id;
        return <Labeled_controller
              id={id}
              sufix={this.props.sufix}
              data={this.props.data}
              type={this.props.type}
              on_change_wrapper={this.value_change}
              val={this.props.rule[id]||''}
              disabled={this.props.disabled}
              min={this.props.min}
              max={this.props.max}
              note={this.props.note}
              placeholder={tabs[tab_id].fields[id].placeholder||''}
              on_blur={this.on_blur}
              label={tabs[tab_id].fields[id].label}
              tooltip={tabs[tab_id].fields[id].tooltip}/>;
    }
});

class Ips_lists extends Pure_component {
    state = {};
    componentDidMount(){
        this.setdb_on('head.proxy_edit.form.port', port=>
            port&&this.setState({port}));
    }
    banned_ips = ()=>this.download_data('banlist');
    reserved_ips = ()=>this.download_data('reserved');
    download_data = type=>{
        const _this = this;
        this.etask(function*(){
            const data = yield ajax.json({
                url: `/api/${type}/${_this.state.port}`});
            const blob = new Blob([data.ips],
                {type: 'text/plain;charset=utf-8'});
            filesaver.saveAs(blob, `${type}_${_this.state.port}.json`);
        });
    };
    render(){
        return <div>
              <div><a onClick={this.banned_ips} className="link">
                Download banned IPs</a></div>
              <div><a onClick={this.reserved_ips} className="link">
                Download reserved IPs</a></div>
            </div>;
    }
}

const Rule = withRouter(class Rule extends Pure_component {
    state = {ports: []};
    componentDidMount(){
        this.setdb_on('head.proxies_running', proxies=>{
            const cur_port = this.props.match.params.port;
            const ports = (proxies||[])
            .filter(p=>p.port!=cur_port)
            .map(p=>({key: p.port, value: p.port}));
            this.setState({ports});
        });
        this.setdb_on('head.consts', consts=>{
            if (consts&&consts.logins)
                this.setState({logins: consts.logins});
        });
    }
    set_rule_field = (field, value)=>{
        setdb.emit('head.proxy_edit.update_rule', {rule_id: this.props.rule.id,
            field, value});
    };
    trigger_change = val=>{
        if (this.props.rule.trigger_type=='url'&&val!='url'||
            this.props.rule.trigger_type!='url'&&val=='url')
        {
            this.set_rule_field('action', '');
        }
        if (val!='status')
        {
            this.set_rule_field('status_code', '');
            this.set_rule_field('status_custom', '');
        }
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
    action_changed = val=>{
        if (val=='retry_port')
        {
            const def_port = this.state.ports.length&&this.state.ports[0].key;
            this.set_rule_field(val, def_port||'');
        }
        if (val!='ban_ip')
        {
            this.set_rule_field('ban_ip_duration', '');
            this.set_rule_field('ban_ip_custom', '');
        }
    };
    status_changed = val=>{
        if (val!='Custom')
            this.set_rule_field('status_custom', '');
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
        const rule = this.props.rule;
        const _action_types = [default_action].concat(action_types
        .filter(at=>at.value!='save_to_fast_pool'||
            rule.trigger_type=='max_req_time')
        .filter(at=>rule.trigger_type=='url'&&at.only_url||
            rule.trigger_type!='url'&&!at.only_url));
        return <div className="rule_wrapper">
              <Btn_rule_del on_click={()=>this.props.rule_del(rule.id)}/>
              <Rule_config id="trigger_type" type="select"
                data={trigger_types} on_change={this.trigger_change}
                rule={rule}/>
              {rule.trigger_type=='body' &&
                <Rule_config id="body_regex" type="text" rule={rule}/>}
              {rule.trigger_type=='min_req_time' &&
                <Rule_config id="min_req_time" type="number"
                  sufix="milliseconds" rule={rule}/>
              }
              {rule.trigger_type=='max_req_time' &&
                <Rule_config id="max_req_time" type="number"
                  sufix="milliseconds" rule={rule}/>
              }
              {rule.trigger_type=='status' &&
                <Rule_config id="status_code" type="select"
                  data={status_types} on_change={this.status_changed}
                  rule={rule}/>
              }
              {rule.status_code=='Custom' &&
                <Rule_config id="status_custom" type="text" rule={rule}/>}
              {rule.trigger_type &&
                <Rule_config id="trigger_url_regex" type="regex" rule={rule}/>}
              {rule.trigger_type &&
                <Rule_config id="action" type="select" data={_action_types}
                  on_change={this.action_changed} rule={rule}/>
              }
              {rule.action=='retry' &&
                <Rule_config id="retry_number" type="number" min="0" max="20"
                  validator={validators.number(0, 20)} rule={rule}/>
              }
              {rule.action=='retry_port' &&
                <Rule_config id="retry_port" type="select"
                  data={this.state.ports} rule={rule}/>
              }
              {rule.action=='ban_ip' &&
                <Rule_config id="ban_ip_duration" type="select"
                  data={ban_options} rule={rule}/>
              }
              {rule.action=='save_to_fast_pool' &&
                <Rule_config id="fast_pool_size" type="number" min="1"
                  max="50" validator={validators.number(1, 50)} rule={rule}/>
              }
              {rule.ban_ip_duration=='custom' &&
                <Rule_config id="ban_ip_custom" type="number" sufix="minutes"
                  rule={rule}/>
              }
              {rule.action=='process' &&
                <div>
                  <Rule_config id="process" type="json" rule={rule}/>
                  <div className="field_row">
                    Test data processing in
                    <a onClick={this.goto_tester} className="link api_link">
                      proxy tester</a>
                  </div>
                </div>
              }
              {rule.action &&
                <Rule_config id="send_email" type="yes_no" rule={rule}
                  on_change={this.send_email_changed}/>
              }
              {rule.send_email && this.state.logins &&
                this.state.logins.length==1 &&
                <Rule_config id="email" type="text" rule={rule} disabled/>
              }
              {rule.send_email && this.state.logins &&
                this.state.logins.length>1 &&
                <Rule_config id="email" type="select" rule={rule}
                  data={this.state.logins.map(l=>({key: l, value: l}))}/>
              }
            </div>;
    }
});

const Btn_rule_del = ({on_click})=>
    <div className="btn_rule_del" onClick={on_click}/>;
