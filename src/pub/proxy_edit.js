// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true, es6:true*/
import React from 'react';
import Pure_component from '../../www/util/pub/pure_component.js';
import classnames from 'classnames';
import $ from 'jquery';
import _ from 'lodash';
import etask from '../../util/etask.js';
import ajax from '../../util/ajax.js';
import setdb from '../../util/setdb.js';
import zurl from '../../util/url.js';
import {Modal, Loader, Warnings, Link_icon, Checkbox, Tooltip,
    Pagination_panel, Loader_small, Note, Input,
    Labeled_controller, Remove_icon, Add_icon} from './common.js';
import Har_viewer from './har_viewer.js';
import * as util from './util.js';
import {Netmask} from 'netmask';
import {getContext, withContext} from 'recompose';
import PropTypes from 'prop-types';
import {withRouter} from 'react-router-dom';
import {tabs, all_fields} from './proxy_fields.js';
import filesaver from 'file-saver';

const presets = util.presets;
const provider = provide=>withContext({provide: PropTypes.object},
    ()=>({provide}));
const event_tracker = {};
const ga_event = (action, label, opt={})=>{
    const id = action+label;
    if (!event_tracker[id] || !opt.single)
    {
        event_tracker[id] = true;
        util.ga_event('proxy_edit', action, label);
    }
};

const validators = {
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

const Index = withRouter(class Index extends Pure_component {
    constructor(props){
        super(props);
        this.state = {form: {zones: {}}, warnings: [], errors: {},
            show_loader: false, saving: false};
        this.debounced_save = _.debounce(this.save, 500);
        setdb.set('head.proxy_edit.set_field', this.set_field);
        setdb.set('head.proxy_edit.is_valid_field', this.is_valid_field);
        setdb.set('head.proxy_edit.goto_field', this.goto_field);
    }
    componentDidMount(){
        setdb.set('head.proxies_running', null);
        this.etask(function*(){
            const proxies_running = yield ajax.json(
                {url: '/api/proxies_running'});
            setdb.set('head.proxies_running', proxies_running);
        });
        this.setdb_on('head.proxies_running', proxies=>{
            if (!proxies||this.state.proxies)
                return;
            this.port = this.props.match.params.port;
            const proxy = proxies.filter(p=>p.port==this.port)[0].config;
            const form = Object.assign({}, proxy);
            const preset = this.guess_preset(form);
            this.apply_preset(form, preset);
            this.setState({proxies}, this.delayed_loader());
        });
        this.setdb_on('head.consts', consts=>
            this.setState({consts}, this.delayed_loader()));
        this.setdb_on('head.defaults', defaults=>
            this.setState({defaults}, this.delayed_loader()));
        this.setdb_on('head.callbacks', callbacks=>this.setState({callbacks}));
        this.setdb_on('head.proxy_edit.loading', loading=>
            this.setState({loading}));
        this.setdb_on('head.proxy_edit.tab', (tab='logs')=>
            this.setState({tab}));
        let state;
        if ((state = this.props.location.state)&&state.field)
            this.goto_field(state.field);
    }
    willUnmount(){
        setdb.set('head.proxy_edit.form', undefined);
        setdb.set('head.proxy_edit', undefined);
    }
    delayed_loader(){ return _.debounce(this.update_loader.bind(this)); }
    update_loader(){
        this.setState(state=>{
            const show_loader = !state.consts || !state.proxies ||
                !state.defaults;
            const zone_name = !show_loader &&
                (state.form.zone||state.consts.proxy.zone.def);
            setdb.set('head.proxy_edit.zone_name', zone_name);
            return {show_loader};
        });
    }
    goto_field = field=>{
        let tab;
        for (let [tab_id, tab_o] of Object.entries(tabs))
        {
            if (Object.keys(tab_o.fields).includes(field))
            {
                tab = tab_id;
                break;
            }
        }
        if (tab)
            setdb.set('head.proxy_edit.tab', tab);
    };
    guess_preset(form){
        let res;
        for (let p in presets)
        {
            const preset = presets[p];
            if (preset.check(form))
            {
                res = p;
                break;
            }
        }
        if (form.last_preset_applied && presets[form.last_preset_applied])
            res = form.last_preset_applied;
        return res;
    }
    set_field = (field_name, value)=>{
        this.setState(prev_state=>{
            const new_form = {...prev_state.form, [field_name]: value};
            return {form: new_form};
        }, this.debounced_save);
        setdb.set('head.proxy_edit.form.'+field_name, value);
        this.send_ga(field_name, value);
    };
    send_ga(id, value){
        if (id=='zone')
        {
            ga_event('edit zone', value);
            return;
        }
        ga_event('edit '+id, value, {single: true});
    }
    is_valid_field = field_name=>{
        const proxy = this.state.consts.proxy;
        const form = this.state.form;
        if (!proxy)
            return false;
        if (form.ext_proxies && all_fields[field_name] &&
            !all_fields[field_name].ext)
        {
            return false;
        }
        const zone = form.zone||proxy.zone.def;
        if (['city', 'state'].includes(field_name) &&
            (!form.country||form.country=='*'))
        {
            return false;
        }
        const details = proxy.zone.values.filter(z=>z.value==zone)[0];
        const permissions = details&&details.perm.split(' ')||[];
        const plan = details&&details.plans[details.plans.length-1]||{};
        if (field_name=='vip')
            return !!plan.vip;
        if (field_name=='country'&&plan.type=='static')
            return false;
        if (field_name=='country'&&plan.ip_alloc_preset=='shared_block')
            return true;
        if (['country', 'state', 'city', 'asn', 'ip'].includes(field_name))
            return permissions.includes(field_name);
        if (field_name=='country'&&(plan.type=='static'||
            ['domain', 'domain_p'].includes(plan.vips_type)))
        {
            return false;
        }
        if (field_name=='carrier')
            return permissions.includes('asn');
        return true;
    };
    apply_preset(_form, preset){
        const form = Object.assign({}, _form);
        const last_preset = form.last_preset_applied ?
            presets[form.last_preset_applied] : null;
        if (last_preset&&last_preset.key!=preset&&last_preset.clean)
            last_preset.clean(form);
        if (form.ext_proxies)
        {
            form.preset = '';
            form.zone = '';
            form.password = '';
        }
        else
        {
            form.preset = preset;
            form.last_preset_applied = preset;
            presets[preset].set(form);
            const disabled_fields = presets[preset].disabled||{};
            setdb.set('head.proxy_edit.disabled_fields', disabled_fields);
        }
        this.apply_rules(form);
        if (form.session===true)
        {
            form.session_random = true;
            form.session = '';
        }
        else
            form.session_random = false;
        if (form.reverse_lookup===undefined)
        {
            if (form.reverse_lookup_dns)
                form.reverse_lookup = 'dns';
            else if (form.reverse_lookup_file)
                form.reverse_lookup = 'file';
            else if (form.reverse_lookup_values)
            {
                form.reverse_lookup = 'values';
                form.reverse_lookup_values = form.reverse_lookup_values
                .join('\n');
            }
        }
        if (!form.ips)
            form.ips = [];
        if (!form.vips)
            form.vips = [];
        if (Array.isArray(form.whitelist_ips))
            form.whitelist_ips = form.whitelist_ips.join(',');
        if (form.city && !Array.isArray(form.city) && form.state)
        {
            form.city = [{id: form.city,
                label: form.city+' ('+form.state+')'}];
        }
        else if (!Array.isArray(form.city))
            form.city = [];
        if (form.asn && !Array.isArray(form.asn))
            form.asn = [{id: ''+form.asn, label: ''+form.asn}];
        else if (!Array.isArray(form.asn))
            form.asn = [];
        if (!this.original_form)
            this.original_form = form;
        form.country = (form.country||'').toLowerCase();
        form.state = (form.state||'').toLowerCase();
        this.setState({form});
        setdb.set('head.proxy_edit.form', form);
        for (let i in form)
            setdb.emit('head.proxy_edit.form.'+i, form[i]);
    }
    rule_map_to_form = (rule, id)=>{
        const result = {id};
        const res = rule.res[0];
        if (res.status)
        {
            if (!res.status_custom)
                result.status_code = res.status.arg;
            else
            {
                result.status_code = 'Custom';
                result.status_custom = res.status.arg;
            }
        }
        result.trigger_url_regex = rule.url;
        result.trigger_type = res.trigger_type;
        result.body_regex = res.body&&res.body.arg;
        if (res.min_req_time)
        {
            const min_req_time = res.min_req_time.match(/\d+/);
            result.min_req_time = Number(min_req_time&&min_req_time[0]);
        }
        if (res.max_req_time)
        {
            const max_req_time = res.max_req_time.match(/\d+/);
            result.max_req_time = Number(max_req_time&&max_req_time[0]);
        }
        result.action = res.action_type;
        result.retry_port = res.action.retry_port;
        result.retry_number = res.action.retry;
        if (res.action.fast_pool_session)
            result.fast_pool_size = res.action.fast_pool_size;
        if (res.action.ban_ip)
        {
            result.ban_ip_duration = 'custom';
            const minutes = res.action.ban_ip.match(/\d+/);
            result.ban_ip_custom = Number(minutes&&minutes[0]);
        }
        if (res.action.process)
            result.process = JSON.stringify(res.action.process, null, '\t');
        return result;
    };
    apply_rules = form=>{
        if (form.rules&&form.rules.post)
        {
            const rules = form.rules.post.map(this.rule_map_to_form);
            setdb.set('head.proxy_edit.rules', rules);
        }
    };
    default_opt = option=>{
        const default_label = this.state.defaults[option] ? 'Yes' : 'No';
        return [
            {key: 'No', value: false},
            {key: 'Default ('+default_label+')', value: ''},
            {key: 'Yes', value: true},
        ];
    };
    set_errors = _errors=>{
        const errors = _errors.reduce((acc, e)=>
            Object.assign(acc, {[e.field]: e.msg}), {});
        this.setState({errors, error_list: _errors});
    };
    update_proxies = ()=>{
        return etask(function*(){
            const proxies = yield ajax.json({url: '/api/proxies_running'});
            setdb.set('head.proxies_running', proxies);
        });
    };
    lock_nav = lock=>setdb.set('head.lock_navigation', lock);
    save = ()=>{
        if (this.saving)
        {
            this.resave = true;
            return;
        }
        const data = this.prepare_to_save();
        const check_url = '/api/proxy_check/'+this.port;
        this.saving = true;
        this.setState({saving: true}, ()=>this.lock_nav(true));
        const _this = this;
        this.etask(function*(){
            this.on('uncaught', e=>{
                console.log(e);
                ga_event('save failed', e.message);
                _this.setState({error_list: [{msg: 'Something went wrong'}],
                    saving: false}, ()=>_this.lock_nav(false));
                _this.saving = false;
                $('#save_proxy_errors').modal('show');
            });
            // XXX krzysztof: switch fetch->ajax
            const raw_check = yield window.fetch(check_url, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(data),
            });
            const json_check = yield raw_check.json();
            const errors = json_check.filter(e=>e.lvl=='err');
            _this.set_errors(errors);
            if (errors.length)
            {
                ga_event('save failed', JSON.stringify(errors));
                $('#save_proxy_errors').modal('show');
                _this.setState({saving: false}, ()=>_this.lock_nav(false));
                _this.saving = false;
                return;
            }
            const warnings = json_check.filter(w=>w.lvl=='warn');
            if (warnings.length)
                _this.setState({warnings});
            const update_url = '/api/proxies/'+_this.port;
            // XXX krzysztof: switch fetch->ajax
            yield window.fetch(update_url, {
                method: 'PUT',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({proxy: data}),
            });
            _this.setState({saving: false}, ()=>_this.lock_nav(false));
            _this.saving = false;
            if (_this.resave)
            {
                _this.resave = false;
                _this.save();
            }
            _this.update_proxies();
        });
    };
    prepare_to_save = ()=>{
        const save_form = Object.assign({}, this.state.form);
        delete save_form.zones;
        for (let field in save_form)
        {
            let before_save;
            if (before_save = all_fields[field] &&
                all_fields[field].before_save)
            {
                save_form[field] = before_save(save_form[field]);
            }
            if (!this.is_valid_field(field) || save_form[field]===null)
                save_form[field] = '';
        }
        const effective = attr=>{
            return save_form[attr]===undefined ?
                this.state.defaults[attr] : save_form[attr];
        };
        save_form.zone = save_form.zone||this.state.consts.proxy.zone.def;
        save_form.ssl = effective('ssl');
        save_form.max_requests = effective('max_requests');
        save_form.session_duration = effective('session_duration');
        save_form.keep_alive = effective('keep_alive');
        save_form.pool_size = effective('pool_size');
        save_form.proxy_type = 'persist';
        if (save_form.reverse_lookup=='dns')
            save_form.reverse_lookup_dns = true;
        else
            save_form.reverse_lookup_dns = '';
        if (save_form.reverse_lookup!='file')
            save_form.reverse_lookup_file = '';
        if (save_form.reverse_lookup=='values')
        {
            save_form.reverse_lookup_values =
                save_form.reverse_lookup_values.split('\n');
        }
        else
            save_form.reverse_lookup_values = '';
        delete save_form.reverse_lookup;
        if (save_form.whitelist_ips)
        {
            save_form.whitelist_ips = save_form.whitelist_ips.split(',')
                .filter(Boolean);
        }
        if (save_form.city.length)
            save_form.city = save_form.city[0].id;
        else
            save_form.city = '';
        if (save_form.asn.length)
            save_form.asn = Number(save_form.asn[0].id);
        else
            save_form.asn = '';
        if (!save_form.max_requests)
            save_form.max_requests = 0;
        delete save_form.preset;
        if (!save_form.session)
            save_form.session = false;
        if (save_form.session_random)
            save_form.session = true;
        delete save_form.session_random;
        if (save_form.headers)
            save_form.headers = save_form.headers.filter(h=>h.name&&h.value);
        return save_form;
    };
    get_curr_plan = ()=>{
        const zone_name = this.state.form.zone||
            this.state.consts.proxy.zone.def;
        const zones = this.state.consts.proxy.zone.values;
        const curr_zone = zones.filter(p=>p.key==zone_name);
        let curr_plan;
        if (curr_zone.length)
            curr_plan = curr_zone[0].plans.slice(-1)[0];
        return curr_plan;
    };
    render(){
        const tab = this.state.tab;
        // XXX krzysztof: transform support into disabled_fields
        const support = presets && this.state.form.preset &&
            presets[this.state.form.preset].support||{};
        let zones = this.state.consts&&
            this.state.consts.proxy.zone.values||[];
        zones = zones.filter(z=>{
            const plan = z.plans && z.plans.slice(-1)[0] || {};
            return !plan.archive && !plan.disable;
        });
        let sett = setdb.get('head.settings')||{}, def;
        if (zones[0] && !zones[0].value && (def = sett.zone||zones[0].key))
            zones[0] = {key: `Default (${def})`, value: ''};
        const default_zone=this.state.consts&&
            this.state.consts.proxy.zone.def;
        const curr_plan = this.state.consts&&this.get_curr_plan();
        let type;
        if (curr_plan&&curr_plan.type=='static')
            type = 'ips';
        else if (curr_plan&&!!curr_plan.vip)
            type = 'vips';
        const port = this.props.match.params.port;
        const show_main_window = this.state.consts&&this.state.defaults&&
            this.state.proxies;
        return <div className="proxy_edit">
              <Loader show={this.state.show_loader||this.state.loading}/>
              <div className="nav_wrapper">
                <div className="nav_header">
                  <h3>Proxy on port {this.port}</h3>
                  <Loader_small saving={this.state.saving}
                    std_msg="All changes saved in LPM"
                    std_tooltip="All changes are automatically saved to LPM"/>
                </div>
                <Nav zones={zones} default_zone={default_zone}
                  disabled={!!this.state.form.ext_proxies}
                  form={this.state.form}
                  on_change_preset={this.apply_preset.bind(this)}/>
                <Nav_tabs form={this.state.form} errors={this.state.errors}/>
              </div>
              <div className={classnames('main_window', {[tab]: true})}>
                <Main_window show={show_main_window} tab={tab} port={port}
                  proxy={this.state.consts&&this.state.consts.proxy}
                  defaults={this.state.defaults}
                  form={this.state.form} support={support}
                  default_opt={this.default_opt}
                  get_curr_plan={this.get_curr_plan}/>
              </div>
              <Modal className="warnings_modal" id="save_proxy_errors"
                title="Errors:" no_cancel_btn>
                <Warnings warnings={this.state.error_list}/>
              </Modal>
              <Alloc_modal type={type} form={this.state.form} support={support}
                zone={this.state.form.zone||default_zone}/>
            </div>;
    }
});

const Main_window = ({show, tab, ...props})=>{
    if (!show)
        return null;
    let Comp;
    switch (tab)
    {
    case 'target': Comp = Targeting; break;
    case 'speed': Comp = Speed; break;
    case 'rules': Comp = Rules; break;
    case 'rotation': Comp = Rotation; break;
    case 'debug': Comp = Debug; break;
    case 'headers': Comp = Headers; break;
    case 'general': Comp = General; break;
    case 'logs':
    default: Comp = Har_viewer;
    }
    return <Comp {...props}/>;
};

class Nav extends Pure_component {
    set_field = setdb.get('head.proxy_edit.set_field');
    _reset_fields = ()=>{
        this.set_field('ips', []);
        this.set_field('vips', []);
        this.set_field('multiply_ips', false);
        this.set_field('multiply_vips', false);
        this.set_field('multiply', 1);
    };
    update_preset = val=>{
        this.props.on_change_preset(this.props.form, val);
        const disabled_fields = presets[val].disabled||{};
        setdb.set('head.proxy_edit.disabled_fields', disabled_fields);
        this._reset_fields();
        ga_event('edit preset', val);
    };
    update_zone = val=>{
        const zone_name = val||this.props.default_zone;
        setdb.set('head.proxy_edit.zone_name', zone_name);
        const zone = this.props.zones.filter(z=>z.key==zone_name)[0]||{};
        this.set_field('zone', val);
        this.set_field('password', zone.password);
        if (this.props.form.ips.length || this.props.form.vips.length)
            this.set_field('pool_size', 0);
        this._reset_fields();
    };
    render(){
        const presets_opt = Object.keys(presets).map(p=>{
            let key = presets[p].title;
            if (presets[p].default)
                key = `Default (${key})`;
            return {key, value: p};
        });
        const preset = this.props.form.preset;
        const preset_tooltip = preset&&presets[preset].subtitle
        +(presets[preset].rules&&
        '<ul>'+presets[preset].rules.map(r=>`<li>${r.label}</li>`).join('')
        +'</ul>');
        return <div className="nav">
              <Field on_change={this.update_zone} options={this.props.zones}
                tooltip="Zone" value={this.props.form.zone}
                disabled={this.props.disabled}/>
              <Field on_change={this.update_preset} tooltip={preset_tooltip}
                options={presets_opt} value={preset}
                disabled={this.props.disabled}/>
            </div>;
    }
}

const Field = ({disabled, tooltip, ...props})=>{
    const options = props.options||[];
    return <Tooltip title={tooltip} placement="bottom">
          <div className="field">
            <select value={props.value} disabled={disabled}
              onChange={e=>props.on_change(e.target.value)}>
              {options.map(o=>
                <option key={o.key} value={o.value}>{o.key}</option>
              )}
            </select>
          </div>
        </Tooltip>;
};

class Nav_tabs extends Pure_component {
    state = {};
    componentDidMount(){
        this.setdb_on('head.proxy_edit.tab', (tab='logs')=>
            this.setState({tab}));
    }
    render(){
        // XXX krzysztof: remove ...props
        return <div className="nav_tabs">
              <Tab_btn {...this.props} curr_tab={this.state.tab} id="logs"/>
              <Tab_btn {...this.props} curr_tab={this.state.tab} id="target"/>
              <Tab_btn {...this.props} curr_tab={this.state.tab} id="speed"/>
              <Tab_btn {...this.props} curr_tab={this.state.tab} id="rules"/>
              <Tab_btn {...this.props} curr_tab={this.state.tab}
                id="rotation"/>
              <Tab_btn {...this.props} curr_tab={this.state.tab} id="debug"/>
              <Tab_btn {...this.props} curr_tab={this.state.tab} id="headers"/>
              <Tab_btn {...this.props} curr_tab={this.state.tab} id="general"/>
            </div>;
    }
}

const Tab_btn = props=>{
    const btn_class = classnames('btn_tab',
        {active: props.curr_tab==props.id});
    const tab_fields = Object.keys(tabs[props.id].fields||{});
    let changes;
    if (props.id=='rules')
        changes = _.get(props, 'form.rules.post.length');
    else
    {
        changes = Object.keys(props.form).filter(f=>{
            const val = props.form[f];
            const is_empty_arr = Array.isArray(val) && !val[0];
            return tab_fields.includes(f) && val && !is_empty_arr;
        }).length;
    }
    if (props.id=='headers')
        changes = changes+(props.form.headers||[]).length;
    const errors = Object.keys(props.errors).filter(f=>tab_fields.includes(f));
    return <Tooltip title={tabs[props.id].tooltip}>
          <div onClick={()=>setdb.set('head.proxy_edit.tab', props.id)}
            className={btn_class}>
            <Tab_icon id={props.id} changes={changes}
              error={errors.length}/>
            <div className="title">{tabs[props.id].label}</div>
            <div className="arrow"/>
          </div>
        </Tooltip>;
};

const Tab_icon = props=>{
    const circle_class = classnames('circle_wrapper', {
        active: props.error||props.changes, error: props.error});
    const content = props.error ? '!' : props.changes;
    return <div className={classnames('icon', props.id)}>
          <div className={circle_class}>
            <div className="circle">{content}</div>
          </div>
        </div>;
};

const Config = getContext({provide: PropTypes.object})(
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
        const curr_id = _id||this.props.id;
        if (this.props.on_change)
            this.props.on_change(value);
        this.set_field(curr_id, value);
    };
    componentDidMount(){
        const val_id = this.props.val_id ? this.props.val_id : this.props.id;
        this.setdb_on('head.proxy_edit.form.'+val_id, val=>
            this.setState({val, show: true}));
        this.setdb_on('head.proxy_edit.disabled_fields', disabled_fields=>
            disabled_fields&&this.setState({disabled_fields}));
    }
    render(){
        if (!this.state.show)
            return null;
        const id = this.props.id;
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
              tooltip={tabs[tab_id].fields[id].tooltip}/>;
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

const Targeting = provider({tab_id: 'target'})(
class Targeting extends Pure_component {
    constructor(props){
        super(props);
        this.state = {};
        this.def_value = {key: 'Any (default)', value: ''};
        this.init_carriers();
        this.set_field = setdb.get('head.proxy_edit.set_field');
    }
    componentDidMount(){
        this.setdb_on('head.locations', locations=>{
            if (!locations)
                return;
            const asns = Object.keys(locations.asns)
                .map(a=>({id: a, label: a}));
            this.setState({locations, asns});
        });
    }
    init_carriers(){
        const subject = 'Add new carrier option';
        const n = '%0D%0A';
        const body = `Hi,${n}${n}Didn't find the carrier you're looking for?`
        +`${n}${n}Write here the carrier's name: __________${n}${n}We will add`
        +` it in less than 2 business days!`;
        const mail = 'lumext@luminati.io';
        const mailto = `mailto:${mail}?subject=${subject}&body=${body}`;
        this.carriers_note = <a className="link" href={mailto}>
            More carriers</a>;
        this.carriers = [
            {value: '', key: 'None'},
            {value: 'a1', key: 'A1 Austria'},
            {value: 'aircel', key: 'Aircel'},
            {value: 'airtel', key: 'Airtel'},
            {value: 'att', key: 'AT&T'},
            {value: 'vimpelcom', key: 'Beeline Russia'},
            {value: 'celcom', key: 'Celcom'},
            {value: 'chinamobile', key: 'China Mobile'},
            {value: 'claro', key: 'Claro'},
            {value: 'comcast', key: 'Comcast'},
            {value: 'cox', key: 'Cox'},
            {value: 'dt', key: 'Deutsche Telekom'},
            {value: 'digi', key: 'Digi Malaysia'},
            {value: 'docomo', key: 'Docomo'},
            {value: 'dtac', key: 'DTAC Trinet'},
            {value: 'etisalat', key: 'Etisalat'},
            {value: 'idea', key: 'Idea India'},
            {value: 'kyivstar', key: 'Kyivstar'},
            {value: 'meo', key: 'MEO Portugal'},
            {value: 'megafont', key: 'Megafon Russia'},
            {value: 'mtn', key: 'MTN - Mahanager Telephone'},
            {value: 'mtnza', key: 'MTN South Africa'},
            {value: 'mts', key: 'MTS Russia'},
            {value: 'optus', key: 'Optus'},
            {value: 'orange', key: 'Orange'},
            {value: 'qwest', key: 'Qwest'},
            {value: 'reliance_jio', key: 'Reliance Jio'},
            {value: 'robi', key: 'Robi'},
            {value: 'sprint', key: 'Sprint'},
            {value: 'telefonica', key: 'Telefonica'},
            {value: 'telstra', key: 'Telstra'},
            {value: 'tmobile', key: 'T-Mobile'},
            {value: 'tigo', key: 'Tigo'},
            {value: 'tim', key: 'TIM (Telecom Italia)'},
            {value: 'vodacomza', key: 'Vodacom South Africa'},
            {value: 'vodafone', key: 'Vodafone'},
            {value: 'verizon', key: 'Verizon'},
            {value: 'vivo', key: 'Vivo'},
            {value: 'zain', key: 'Zain'},
            {value: 'umobile', key: 'U-Mobile'},
        ];
    }
    allowed_countries = ()=>{
        let res = this.state.locations.countries.map(c=>({
            key: c.country_name, value: c.country_id, mob: c.mob}));
        const curr_plan = this.props.get_curr_plan();
        if (curr_plan&&curr_plan.ip_alloc_preset=='shared_block')
        {
            res = res.filter(r=>
                this.state.locations.shared_countries.includes(r.value));
        }
        if (curr_plan&&curr_plan.mobile)
            res = res.filter(r=>r.mob);
        return [this.def_value, ...res];
    };
    country_changed = ()=>{
        this.set_field('city', []);
        this.set_field('state', '');
    };
    states = ()=>{
        const country = this.props.form.country;
        if (!country||country=='*')
            return [];
        const curr_plan = this.props.get_curr_plan();
        const res = (this.state.locations.regions[country]||[])
            .filter(r=>!curr_plan||!curr_plan.mobile||r.mob)
            .map(r=>({key: r.region_name, value: r.region_id}));
        return [this.def_value, ...res];
    };
    state_changed = ()=>this.set_field('city', []);
    cities = ()=>{
        const {country, state} = this.props.form;
        let res;
        if (!country)
            return [];
        const curr_plan = this.props.get_curr_plan();
        res = this.state.locations.cities
            .filter(c=>c.country_id==country)
            .filter(c=>!curr_plan||!curr_plan.mobile||c.mob);
        if (state)
            res = res.filter(c=>c.region_id==state);
        const regions = this.states();
        res = res.map(c=>{
            const region = regions.filter(r=>r.value==c.region_id)[0];
            return {label: c.city_name+' ('+region.value+')', id: c.city_name,
                region: region.value};
        });
        return res;
    };
    city_changed = e=>{
        if (e&&e.length)
            this.set_field('state', e[0].region);
    };
    render(){
        if (!this.state.locations)
            return null;
        const curr_plan = this.props.get_curr_plan();
        const show_dc_note = curr_plan&&curr_plan.type=='static';
        const show_vips_note = curr_plan&&
            (curr_plan.vips_type=='domain'||curr_plan.vips_type=='domain_p');
        return <div>
              {(show_dc_note || show_vips_note) &&
                <Note>
                  {show_dc_note &&
                    <span>To change Data Center country visit your </span>
                  }
                  {show_vips_note &&
                    <span>To change Exclusive gIP country visit your </span>
                  }
                  <a className="link" target="_blank" rel="noopener noreferrer"
                    href="https://luminati.io/cp/zones">zone page</a>
                  <span> and change your zone plan.</span>
                </Note>
              }
              <Config type="select" id="country"
                data={this.allowed_countries()}
                on_change={this.country_changed}/>
              <Config type="select" id="state" data={this.states()}
                on_change={this.state_changed}/>
              <Config type="typeahead" id="city" data={this.cities()}
                on_change={this.city_changed}/>
              <Config type="typeahead" id="asn" data={this.state.asns}
                disabled={this.props.form.carrier} update_on_input/>
              <Config type="select" id="carrier" data={this.carriers}
                note={this.carriers_note}
                disabled={this.props.form.asn&&this.props.form.asn.length}/>
            </div>;
    }
});

const Headers = provider({tab_id: 'headers'})(
class Headers extends Pure_component {
    first_header = {name: '', value: ''};
    state = {headers: [this.first_header]};
    boolean_opt = [{key: 'No (Default)', value: ''},
      {key: 'Yes', value: 'true'}];
    set_field = setdb.get('head.proxy_edit.set_field');
    componentDidMount(){
        this.setdb_on('head.proxy_edit.form.headers', headers=>{
            if (headers&&headers.length)
                this.setState({headers});
            else
                this.setState({headers: [this.first_header]});
        });
    }
    add = ()=>this.set_field('headers', [
        ...this.state.headers, {name: '', value: ''}]);
    remove = idx=>{
        let new_headers = [
            ...this.state.headers.slice(0, idx),
            ...this.state.headers.slice(idx+1),
        ];
        if (!new_headers.length)
            new_headers = [this.first_header];
        this.set_field('headers', new_headers);
    };
    update = idx=>name=>value=>this.set_field('headers',
        this.state.headers.map((h, i)=>{
            if (i!=idx)
                return h;
            return {...h, [name]: value};
        }));
    random_user_agent_changed = val=>{
        if (val)
            this.set_field('user_agent', '');
    };
    render(){
        return <div>
              <Config type="select" id="user_agent" data={util.user_agents}
                disabled={this.props.form.random_user_agent}/>
              <Config type="select" id="random_user_agent"
                on_change={this.random_user_agent_changed}
                data={this.boolean_opt}/>
              <Config type="select" id="override_headers"
                data={this.boolean_opt}/>
              <div className="field_row headers">
                <div className="desc">
                  <Tooltip title="Custom headers">
                    <span>Headers</span>
                  </Tooltip>
                </div>
                <div className="list">
                  {this.state.headers.map((h, i)=>
                    <Header last={i+1==this.state.headers.length} key={i}
                      name={h.name} value={h.value} update={this.update(i)}
                      remove_clicked={this.remove}
                      add_clicked={this.add} idx={i}/>
                  )}
                </div>
              </div>
            </div>;
    }
});

const Header = ({name, value, idx, add_clicked, remove_clicked, last,
    update})=>
    <div className="single_header">
      <div className="desc">Name</div>
      <Input type="text" val={name} on_change_wrapper={update('name')}/>
      <div className="desc">Value</div>
      <Input type="text" val={value} on_change_wrapper={update('value')}/>
      <div className="action_icons">
        <Remove_icon tooltip="Remove header" click={()=>remove_clicked(idx)}/>
        {last && <Add_icon tooltip="Add header" click={add_clicked}/>}
      </div>
    </div>;

const Speed = provider({tab_id: 'speed'})(
class Speed extends Pure_component {
    constructor(props){
        super(props);
        this.dns_options = [
            {key: 'Local (default) - resolved by the super proxy',
                value: 'local'},
            {key: 'Remote - resolved by peer', value: 'remote'},
        ];
        this.reverse_lookup_options = [{key: 'No', value: ''},
            {key: 'DNS', value: 'dns'}, {key: 'File', value: 'file'},
            {key: 'Values', value: 'values'}];
    }
    open_modal(){ $('#allocated_ips').modal('show'); }
    get_type(){
        const curr_plan = this.props.get_curr_plan();
        let type;
        if (curr_plan&&curr_plan.type=='static')
            type = 'ips';
        else if (curr_plan&&!!curr_plan.vip)
            type = 'vips';
        return type;
    }
    render(){
        const {form, support} = this.props;
        const pool_size_disabled = !support.pool_size ||
            form.ips.length || form.vips.length;
        const type = this.get_type();
        const render_modal = ['ips', 'vips'].includes(type);
        let pool_size_note;
        if (this.props.support.pool_size&&render_modal)
        {
            pool_size_note =
                <a className="link" onClick={()=>this.open_modal()}>
                  {'set from allocated '+(type=='ips' ? 'IPs' : 'vIPs')}
                </a>;
        }
        return <div>
              <Config type="select" id="dns" data={this.dns_options}/>
              <Config type="number" id="pool_size" min="0"
                note={pool_size_note} disabled={pool_size_disabled}/>
              <Config type="number" id="request_timeout" sufix="seconds"
                min="0"/>
              <Config type="number" id="race_reqs" min="1" max="3"/>
              <Config type="number" id="proxy_count" min="1"/>
              <Config type="number" id="proxy_switch" min="0"/>
              <Config type="number" id="throttle" min="0"/>
              <Config type="select" id="reverse_lookup"
                data={this.reverse_lookup_options}/>
              {this.props.form.reverse_lookup=='file' &&
                <Config type="text" id="reverse_lookup_file"/>
              }
              {this.props.form.reverse_lookup=='values' &&
                <Config type="textarea" id="reverse_lookup_values"/>
              }
            </div>;
    }
});

const Rules = provider({tab_id: 'rules'})(
class Rules extends Pure_component {
    set_field = setdb.get('head.proxy_edit.set_field');
    goto_field = setdb.get('head.proxy_edit.goto_field');
    state = {rules: [{id: 0}], max_id: 0};
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
    rule_prepare = rule=>{
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
    rules_update = ()=>{
        setdb.set('head.proxy_edit.rules', this.state.rules);
        const post = this.state.rules.map(this.rule_prepare).filter(Boolean);
        let rules = this.state.form.rules||{};
        if (post.length)
            rules.post = post;
        else
            delete rules.post;
        if (!rules.post&&(!rules.pre||!rules.pre.length))
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
              <Ips_lists/>
            </div>;
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
    trigger_types = [
        {key: 'i.e. Status code', value: ''},
        {key: 'URL', value: 'url'},
        {key: 'Status code', value: 'status'},
        {key: 'HTML body element', value: 'body'},
        {key: 'Minimum request time', value: 'min_req_time'},
        {key: 'Maximum request time', value: 'max_req_time'},
    ];
    action_types = [
        {key: 'i.e. Retry with new IP', value: ''},
        {key: 'Retry with new IP', value: 'retry'},
        {key: 'Retry with new proxy port (Waterfall)',
            value: 'retry_port'},
        {key: 'Ban IP', value: 'ban_ip'},
        {key: 'Refresh IP', value: 'refresh_ip'},
        {key: 'Save IP to reserved pool', value: 'save_to_pool'},
        {key: 'Save IP to fast pool', value: 'save_to_fast_pool'},
        {key: 'Process data', value: 'process'},
    ];
    ban_options = [
        {key: '10 minutes', value: '10min'},
        {key: '20 minutes', value: '20min'},
        {key: '30 minutes', value: '30min'},
        {key: '40 minutes', value: '40min'},
        {key: '50 minutes', value: '50min'},
        {key: 'Custom', value: 'custom'},
    ];
    status_types = [
        'i.e. 200 - Succeeded requests',
        '200 - Succeeded requests',
        '403 - Forbidden', '404 - Not found',
        '500 - Internal server error', '502 - Bad gateway',
        '503 - Service unavailable', '504 - Gateway timeout', 'Custom'
    ].map(s=>({key: s, value: s}));
    componentDidMount(){
        this.setdb_on('head.proxies_running', proxies=>{
            const cur_port = this.props.match.params.port;
            const ports = (proxies||[])
                .filter(p=>p.port!=cur_port)
                .map(p=>({key: p.port, value: p.port}));
            this.setState({ports});
        });
    }
    set_rule_field = (field, value)=>{
        setdb.emit('head.proxy_edit.update_rule', {rule_id: this.props.rule.id,
            field, value});
    };
    trigger_change = val=>{
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
    render(){
        const rule = this.props.rule;
        const action_types = this.action_types.filter(at=>
            at.value!='save_to_fast_pool'||rule.trigger_type=='max_req_time');
        return <div className="rule_wrapper">
              <Btn_rule_del
                on_click={()=>this.props.rule_del(this.props.rule.id)}/>
              <Rule_config id="trigger_type" type="select"
                data={this.trigger_types} on_change={this.trigger_change}
                rule={this.props.rule}/>
              {rule.trigger_type=='body' &&
                <Rule_config id="body_regex" type="text"
                  rule={this.props.rule}/>
              }
              {rule.trigger_type=='min_req_time' &&
                <Rule_config id="min_req_time" type="number"
                  sufix="milliseconds" rule={this.props.rule}/>
              }
              {rule.trigger_type=='max_req_time' &&
                <Rule_config id="max_req_time" type="number"
                  sufix="milliseconds" rule={this.props.rule}/>
              }
              {rule.trigger_type=='status' &&
                <Rule_config id="status_code" type="select"
                  data={this.status_types} on_change={this.status_changed}
                  rule={this.props.rule}/>
              }
              {rule.status_code=='Custom' &&
                <Rule_config id="status_custom" type="text"
                  rule={this.props.rule}/>
              }
              <Rule_config id="trigger_url_regex" type="text"
                rule={this.props.rule}/>
              <Rule_config id="action" type="select" data={action_types}
                on_change={this.action_changed} rule={this.props.rule}/>
              {this.props.rule.action=='retry' &&
                <Rule_config id="retry_number" type="number" min="0" max="20"
                  validator={validators.number(0, 20)} rule={this.props.rule}/>
              }
              {this.props.rule.action=='retry_port' &&
                <Rule_config id="retry_port" type="select"
                  data={this.state.ports} rule={this.props.rule}/>
              }
              {this.props.rule.action=='ban_ip' &&
                <Rule_config id="ban_ip_duration" type="select"
                  data={this.ban_options} rule={this.props.rule}/>
              }
              {this.props.rule.action=='save_to_fast_pool' &&
                <Rule_config id="fast_pool_size" type="number" min="1"
                  max="50" validator={validators.number(1, 50)}
                  rule={this.props.rule}/>
              }
              {this.props.rule.ban_ip_duration=='custom' &&
                <Rule_config id="ban_ip_custom" type="number" sufix="minutes"
                  rule={this.props.rule}/>
              }
              {this.props.rule.action=='process' &&
                <Rule_config id="process" type="json" rule={this.props.rule}/>}
            </div>;
    }
});

const Btn_rule_del = ({on_click})=>
    <div className="btn_rule_del" onClick={on_click}/>;

class Alloc_modal extends Pure_component {
    set_field = setdb.get('head.proxy_edit.set_field');
    state = {
        available_list: [],
        displayed_list: [],
        cur_page: 0,
        items_per_page: 20,
    };
    componentDidMount(){
        this.setdb_on('head.proxy_edit.zone_name', zone_name=>
            this.setState({available_list: []}));
        this.setdb_on('head.proxy_edit.tab', tab=>
            this.setState({curr_tab: tab}));
        this.setdb_on('head.proxies_running', proxies=>
            proxies&&this.setState({proxies}));
        $('#allocated_ips').on('show.bs.modal', this.load);
    }
    close = ()=>$('#allocated_ips').modal('hide');
    load = ()=>{
        if (this.state.available_list.length)
            return;
        this.loading(true);
        const key = this.props.form.password||'';
        let endpoint;
        if (this.props.type=='ips')
            endpoint = '/api/allocated_ips';
        else
            endpoint = '/api/allocated_vips';
        const url = zurl.qs_add(window.location.host+endpoint,
            {zone: this.props.zone, key});
        const _this = this;
        this.etask(function*(){
            this.on('uncaught', e=>{
                console.log(e);
                _this.loading(false);
            });
            const res = yield ajax.json({url});
            let available_list;
            if (_this.props.type=='ips')
                available_list = res.ips;
            else
                available_list = res;
            _this.setState({available_list, cur_page: 0},
                _this.sync_selected_vals);
            _this.loading(false);
        });
    };
    sync_selected_vals = ()=>{
        const curr_vals = this.props.form[this.props.type];
        const new_vals = curr_vals.filter(v=>
            this.state.available_list.includes(v));
        this.set_field(this.props.type, new_vals);
        this.update_multiply_and_pool_size(new_vals.length);
        this.paginate();
    };
    paginate = (page=-1)=>{
        page = page>-1 ? page : this.state.cur_page;
        const pages = Math.ceil(
            this.state.available_list.length/this.state.items_per_page);
        const cur_page = Math.min(pages, page);
        const displayed_list = this.state.available_list.slice(
            cur_page*this.state.items_per_page,
            (cur_page+1)*this.state.items_per_page);
        this.setState({displayed_list, cur_page});
    };
    loading = loading=>{
        setdb.set('head.proxy_edit.loading', loading);
        this.setState({loading});
    };
    checked = row=>(this.props.form[this.props.type]||[]).includes(row);
    reset = ()=>{
        this.set_field(this.props.type, []);
        this.set_field('pool_size', '');
        this.set_field('multiply', 1);
    };
    toggle = e=>{
        let {value, checked} = e.target;
        const {type, form} = this.props;
        if (type=='vips')
            value = Number(value);
        let new_alloc;
        if (checked)
            new_alloc = [...form[type], value];
        else
            new_alloc = form[type].filter(r=>r!=value);
        this.set_field(type, new_alloc);
        this.update_multiply_and_pool_size(new_alloc.length);
    };
    select_all = ()=>{
        this.set_field(this.props.type, this.state.available_list);
        this.update_multiply_and_pool_size(this.state.available_list.length);
    };
    refresh = ()=>{
        const _this = this;
        this.etask(function*(){
            this.on('uncaught', e=>{
                console.log(e);
                _this.loading(false);
            });
            _this.loading(true);
            const data = {zone: _this.props.zone};
            let url;
            if (_this.props.type=='ips')
            {
                data.ips = _this.props.form.ips.map(zurl.ip2num).join(' ');
                url = '/api/refresh_ips';
            }
            else
            {
                data.vips = _this.props.form.vips;
                url = '/api/refresh_vips';
            }
            const res = yield ajax.json({method: 'POST', url, data});
            if (res.error||!res.ips&&!res.vips)
            {
                console.log(`error: ${res.error}`);
                return;
            }
            const new_vals = _this.props.type=='ips' ?
                res.ips.map(i=>i.ip) : res.vips.map(v=>v.vip);
            const map = _this.map_vals(_this.state.available_list, new_vals);
            const new_ips = _this.props.form.ips.map(val=>map[val]);
            const new_vips = _this.props.form.vips.map(val=>map[val]);
            _this.setState({available_list: new_vals}, _this.paginate);
            _this.set_field('ips', new_ips);
            _this.set_field('vips', new_vips);
            yield _this.update_other_proxies(map);
            _this.loading(false);
        });
    };
    update_other_proxies = map=>{
        const _this = this;
        return this.etask(function*(){
            const proxies_to_update = _this.state.proxies.filter(p=>
                p.zone==_this.props.zone&&p.port!=_this.props.form.port&&
                p.proxy_type=='persist');
            for (let i=0; i<proxies_to_update.length; i++)
            {
                const proxy = proxies_to_update[i];
                const new_vals = proxy[_this.props.type].map(v=>map[v]);
                const data = {port: proxy.port, [_this.props.type]: new_vals};
                yield ajax({method: 'POST', url: '/api/update_ips', data});
            }
        });
    };
    map_vals = (old_vals, new_vals)=>{
        if (old_vals.length!=new_vals.length)
        {
            console.log('error ips/vips length mismatch');
            return;
        }
        const map = {};
        for (let i=0; i<old_vals.length; i++)
            map[old_vals[i]] = new_vals[i];
        return map;
    };
    update_multiply_and_pool_size = size=>{
        if (!this.props.form.multiply_ips && !this.props.form.multiply_vips)
            this.set_field('pool_size', size);
        else
        {
            this.set_field('pool_size', 1);
            this.set_field('multiply', size);
        }
    };
    update_items_per_page = items_per_page=>
        this.setState({items_per_page}, ()=>this.paginate(0));
    page_change = page=>this.paginate(page-1);
    render(){
        const type_label = this.props.type=='ips' ? 'IPs' : 'vIPs';
        let title;
        if (this.state.curr_tab=='general')
        {
            title = 'Select the '+type_label+' to multiply ('
            +this.props.zone+')';
        }
        else
            title = 'Select the '+type_label+' ('+this.props.zone+')';
        const Footer = <div className="default_footer">
              <button onClick={this.refresh} className="btn btn_lpm">
                Refresh</button>
              <button onClick={this.close}
                className="btn btn_lpm btn_lpm_primary">OK</button>
            </div>;
        return <Modal id="allocated_ips" className="allocated_ips_modal"
              title={title} footer={Footer}>
              <Pagination_panel
                entries={this.state.available_list}
                items_per_page={this.state.items_per_page}
                cur_page={this.state.cur_page}
                page_change={this.page_change} top
                update_items_per_page={this.update_items_per_page}>
                <Link_icon tooltip="Unselect all"
                  on_click={this.reset} id="unchecked"/>
                <Link_icon tooltip="Select all" on_click={this.select_all}
                  id="check"/>
              </Pagination_panel>
              {this.state.displayed_list.map(row=>
                <Checkbox on_change={this.toggle} key={row}
                  text={row} value={row} checked={this.checked(row)}/>
              )}
              <Pagination_panel
                entries={this.state.available_list}
                items_per_page={this.state.items_per_page}
                cur_page={this.state.cur_page}
                page_change={this.page_change} bottom
                update_items_per_page={this.update_items_per_page}>
                <Link_icon tooltip="Unselect all"
                  on_click={this.reset} id="unchecked"/>
                <Link_icon tooltip="Select all"
                  on_click={this.select_all.bind(this)} id="check"/>
              </Pagination_panel>
            </Modal>;
    }
}

const Rotation = provider({tab_id: 'rotation'})(props=>{
    const {support, form, proxy} = props;
    return <div>
          <Config type="text" id="ip"/>
          <Config type="text" id="vip"/>
          <Config type="select" id="pool_type" data={proxy.pool_type.values}
            disabled={!support.pool_type}/>
          <Config type="number" id="keep_alive" min="0"
            disabled={!support.keep_alive}/>
          <Config type="text" id="whitelist_ips"
            validator={validators.ips_list}/>
          <Config type="select" id="session_random"
            data={props.default_opt('session_random')}/>
          <Config type="text" id="session"
            disabled={form.session_random && !support.session}/>
          <Config type="select" id="sticky_ip"
            data={props.default_opt('sticky_ip')}
            disabled={!support.sticky_ip}/>
          <Config type="double_number" id="max_requests"
            disabled={!support.max_requests}/>
          <Config type="double_number" id="session_duration"
            disabled={!support.session_duration}/>
          <Config type="text" id="seed" disabled={!support.seed}/>
        </div>;
});

const Debug = provider({tab_id: 'debug'})(props=>
    <div>
      <Config type="select" id="log" data={props.proxy.log.values}/>
      <Config type="select" id="debug" data={props.proxy.debug.values}/>
    </div>);

const General = provider({tab_id: 'general'})(props=>{
    const set_field = setdb.get('head.proxy_edit.set_field');
    const open_modal = ()=>{ $('#allocated_ips').modal('show'); };
    const multiply_changed = val=>{
        const size = Math.max(props.form.ips.length, props.form.vips.length);
        if (val)
        {
            set_field('pool_size', 1);
            set_field('multiply', size);
            open_modal();
            return;
        }
        set_field('pool_size', size);
        set_field('multiply', 1);
    };
    // XXX krzysztof: cleanup type
    const curr_plan = props.get_curr_plan();
    let type;
    if (curr_plan&&curr_plan.type=='static')
        type = 'ips';
    else if (curr_plan&&!!curr_plan.vip)
        type = 'vips';
    const note_ips = props.form.multiply_ips ?
        <a className="link" onClick={open_modal}>Select IPs</a> : null;
    const note_vips = props.form.multiply_vips ?
        <a className="link" onClick={open_modal}>Select gIPs</a> : null;
    const mul_disabled = !props.support.multiply||props.form.multiply_ips||
        props.form.multiply_vips;
    return <div>
          <Config type="number" id="port"/>
          <Config type="number" id="socks" disabled={true} val_id="port"/>
          <Config type="text" id="password"/>
          <Config type="select" id="ssl" data={props.default_opt('ssl')}/>
          <Config type="number" id="multiply" min="1" disabled={mul_disabled}/>
          {type=='ips' &&
            <Config type="select" id="multiply_ips"
              on_change={multiply_changed} note={note_ips}
              data={props.default_opt('multiply_ips')}/>
          }
          {type=='vips' &&
            <Config type="select" id="multiply_vips"
              on_change={multiply_changed} note={note_vips}
              data={props.default_opt('multiply_vips')}/>
          }
          <Config type="select" id="secure_proxy"
            data={props.default_opt('secure_proxy')}/>
          <Config type="text" id="null_response"/>
          <Config type="text" id="bypass_proxy"/>
          <Config type="text" id="direct_include"/>
          <Config type="select" id="allow_proxy_auth"
            data={props.default_opt('allow_proxy_auth')}/>
          <Config type="select" id="iface"
            data={props.proxy.iface.values}/>
        </div>;
});

export default Index;
