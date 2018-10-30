// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true, es6:true*/
import React from 'react';
import Pure_component from '../../../www/util/pub/pure_component.js';
import classnames from 'classnames';
import $ from 'jquery';
import _ from 'lodash';
import etask from '../../../util/etask.js';
import ajax from '../../../util/ajax.js';
import setdb from '../../../util/setdb.js';
import zurl from '../../../util/url.js';
import {Modal, Loader, Warnings, Link_icon, Checkbox, Tooltip,
    Pagination_panel, Loader_small, Zone_description,
    Preset_description} from '../common.js';
import React_tooltip from 'react-tooltip';
import {tabs, all_fields} from './fields.js';
import Har_viewer from '../har_viewer.js';
import * as util from '../util.js';
import {withRouter} from 'react-router-dom';
import Rules from './rules.js';
import Targeting from './targeting.js';
import General from './general.js';
import Debug from './debug.js';
import Rotation from './rotation.js';
import Speed from './speed.js';
import Headers from './headers.js';

const presets = util.presets;
const event_tracker = {};
const ga_event = (action, label, opt={})=>{
    const id = action+label;
    if (!event_tracker[id] || !opt.single)
    {
        event_tracker[id] = true;
        util.ga_event('proxy_edit', action, label);
    }
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
            const port = this.props.match.params.port;
            const proxy = proxies.filter(p=>p.port==port)[0];
            if (!proxy)
                this.props.history.push('/overview');
            const form = Object.assign({}, proxy.config);
            this.apply_preset(form, form.last_preset_applied||'session_long');
            this.setState({proxies}, this.delayed_loader());
        });
        this.setdb_on('head.consts', consts=>
            this.setState({consts}, this.delayed_loader()));
        this.setdb_on('head.defaults', defaults=>
            this.setState({defaults}, this.delayed_loader()));
        this.setdb_on('head.callbacks', callbacks=>this.setState({callbacks}));
        this.setdb_on('head.proxy_edit.loading', loading=>
            this.setState({loading}));
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
        {
            const port = this.props.match.params.port;
            const pathname = `/proxy/${port}/${tab}`;
            this.props.history.push({pathname});
        }
    };
    set_field = (field_name, value, opt={})=>{
        this.setState(prev_state=>{
            const new_form = {...prev_state.form, [field_name]: value};
            return {form: new_form};
        }, opt.skip_save ? undefined : this.debounced_save);
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
        if (field_name=='country'&&plan.ip_alloc_preset=='shared_block')
            return true;
        if (field_name=='country'&&plan.type=='static')
            return false;
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
    apply_preset = (_form, preset)=>{
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
    };
    // XXX krzysztof: move this logic to rules module
    post_rule_map_to_form = rule=>{
        const result = {};
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
        if (res.action.email)
        {
            result.send_email = true;
            result.email = res.action.email;
        }
        return result;
    };
    pre_rule_map_to_form = rule=>{
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
        return res;
    };
    apply_rules = ({rules})=>{
        if (!rules)
            return;
        const post = (rules.post||[]).map(this.post_rule_map_to_form);
        const pre = (rules.pre||[]).map(this.pre_rule_map_to_form);
        const _rules = [].concat(post, pre).map((r, i)=>({...r, id: i}));
        setdb.set('head.proxy_edit.rules', _rules);
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
        const check_url = '/api/proxy_check/'+this.props.match.params.port;
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
            const update_url = '/api/proxies/'+_this.props.match.params.port;
            // XXX krzysztof: switch fetch->ajax
            yield window.fetch(update_url, {
                method: 'PUT',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({proxy: data}),
            });
            _this.setState({saving: false}, ()=>_this.lock_nav(false));
            _this.saving = false;
            if (_this.props.match.params.port!=_this.state.form.port)
            {
                const port = _this.state.form.port;
                const tab = _this.props.match.params.tab;
                _this.props.history.push({pathname: `/proxy/${port}/${tab}`});
            }
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
        for (let field in save_form)
        {
            let before_save;
            if (before_save = all_fields[field] &&
                all_fields[field].before_save)
            {
                save_form[field] = before_save(save_form[field]);
            }
            if (!this.is_valid_field(field)||save_form[field]===null)
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
        else
            save_form.whitelist_ips = [];
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
        // XXX krzysztof: use /api/zones instead od consts
        const zones = this.state.consts.proxy.zone.values;
        const curr_zone = zones.filter(p=>p.key==zone_name);
        let curr_plan;
        if (curr_zone.length)
            curr_plan = curr_zone[0].plans.slice(-1)[0];
        return curr_plan;
    };
    render(){
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
        const tab = this.props.match.params.tab||'logs';
        return <div className="proxy_edit">
              <Loader show={this.state.show_loader||this.state.loading}/>
              <div className="nav_wrapper">
                <div className="nav_header">
                  <Port_title port={this.props.match.params.port}
                    name={this.state.form.internal_name}/>
                  <Loader_small saving={this.state.saving}
                    std_msg="All changes saved in LPM"
                    std_tooltip="All changes are automatically saved to LPM"/>
                </div>
                <Nav zones={zones} default_zone={default_zone}
                  disabled={!!this.state.form.ext_proxies}
                  form={this.state.form}
                  on_change_preset={this.apply_preset}/>
                <Nav_tabs/>
              </div>
              <div className={classnames('main_window', {[tab]: true})}>
                {this.state.consts && this.state.defaults &&
                    this.state.proxies &&
                  <Main_window
                    proxy={this.state.consts&&this.state.consts.proxy}
                    defaults={this.state.defaults}
                    form={this.state.form}
                    get_curr_plan={this.get_curr_plan}/>
                }
              </div>
              <Modal className="warnings_modal" id="save_proxy_errors"
                title="Errors:" no_cancel_btn>
                <Warnings warnings={this.state.error_list}/>
              </Modal>
              <Alloc_modal type={type} form={this.state.form}
                zone={this.state.form.zone||default_zone} tab={tab}/>
            </div>;
    }
});

const Port_title = ({port, name})=>{
    if (name)
        port = port+` (${name})`;
    return <h3>Proxy on port {port}</h3>;
};

const Main_window = withRouter(({match: {params: {tab}}, ...props})=>{
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
});

class Nav extends Pure_component {
    state = {};
    set_field = setdb.get('head.proxy_edit.set_field');
    is_valid_field = setdb.get('head.proxy_edit.is_valid_field');
    componentDidMount(){
        this.setdb_on('head.zones', zones=>zones&&this.setState({zones}));
    }
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
        this.props.form.zone = zone_name;
        const zone = this.props.zones.filter(z=>z.key==zone_name)[0]||{};
        this.set_field('zone', val);
        this.set_field('password', zone.password);
        if (this.props.form.ips.length || this.props.form.vips.length)
            this.set_field('pool_size', 0);
        this._reset_fields();
        const save_form = Object.assign({}, this.props.form);
        for (let field in save_form)
        {
            if (!this.is_valid_field(field, zone_name))
            {
                let v = '';
                if (field=='city'||field=='asn')
                    v = [];
                this.set_field(field, v);
            }
        }
    };
    render(){
        if (!this.state.zones)
            return null;
        const presets_opt = Object.keys(presets).map(p=>{
            let key = presets[p].title;
            if (presets[p].default)
                key = `Default (${key})`;
            return {key, value: p};
        });
        const preset = this.props.form.preset;
        return <div className="nav">
              <Field on_change={this.update_zone} options={this.props.zones}
                value={this.props.form.zone} disabled={this.props.disabled}
                id="zone">
                <div className="zone_tooltip">
                  <Zone_description zones={this.state.zones}
                    zone_name={this.props.form.zone}/>
                </div>
              </Field>
              <Field on_change={this.update_preset} options={presets_opt}
                value={preset} disabled={this.props.disabled} id="preset">
                <Preset_description preset={preset} rule_clicked={()=>0}/>
              </Field>
            </div>;
    }
}

const Field = ({id, disabled, children, ...props})=>{
    const options = props.options||[];
    return <div className="field">
          <React_tooltip id={id+'tip'} type="light" effect="solid"
            place="bottom" delayHide={300} delayUpdate={300}>
            {children}
          </React_tooltip>
          <select data-tip data-for={id+'tip'} value={props.value}
            disabled={disabled} onChange={e=>props.on_change(e.target.value)}>
            {options.map(o=>
              <option key={o.key} value={o.value}>{o.key}</option>
            )}
          </select>
        </div>;
};

const Nav_tabs = ()=>
    <div className="nav_tabs">
      <Tab_btn id="logs"/>
      <Tab_btn id="target"/>
      <Tab_btn id="rules"/>
      <Tab_btn id="speed"/>
      <Tab_btn id="rotation"/>
      <Tab_btn id="debug"/>
      <Tab_btn id="headers"/>
      <Tab_btn id="general"/>
    </div>;

const Tab_btn = withRouter(class Tab_btn extends Pure_component {
    state = {};
    click = ()=>{
        const port = this.props.match.params.port;
        const pathname = `/proxy/${port}/${this.props.id}`;
        this.props.history.push({pathname});
    };
    render(){
        const cur_tab = this.props.match.params.tab;
        const active = cur_tab==this.props.id||!cur_tab&&this.props.id=='logs';
        const btn_class = classnames('btn_tab', {active});
        return <Tooltip title={tabs[this.props.id].tooltip}>
              <div onClick={this.click} className={btn_class}>
                <div className={classnames('icon', this.props.id)}/>
                <div className="title">{tabs[this.props.id].label}</div>
                <div className="arrow"/>
              </div>
            </Tooltip>;
    }
});

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
        if (this.props.tab=='general')
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

export default Index;
