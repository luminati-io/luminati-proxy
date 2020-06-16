// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true, es6:true*/
import React from 'react';
import Pure_component from '/www/util/pub/pure_component.js';
import $ from 'jquery';
import _ from 'lodash';
import etask from '../../../util/etask.js';
import ajax from '../../../util/ajax.js';
import setdb from '../../../util/setdb.js';
import {qw} from '../../../util/string.js';
import {Loader, Warnings, Loader_small, Preset_description, Ext_tooltip,
    Checkbox} from '../common.js';
import {Nav_tabs, Nav_tab} from '../common/nav_tabs.js';
import React_tooltip from 'react-tooltip';
import {tabs, all_fields} from './fields.js';
import presets from '../common/presets.js';
import {withRouter, Switch, Route, Redirect} from 'react-router-dom';
import Rules from './rules.js';
import Targeting from './targeting.js';
import General from './general.js';
import Rotation from './rotation.js';
import Speed from './speed.js';
import Headers from './headers.js';
import Logs from './logs.js';
import Alloc_modal from './alloc_modal.js';
import {map_rule_to_form} from './rules.js';
import Tooltip from '../common/tooltip.js';
import {Modal} from '../common/modals.js';
import {T} from '../common/i18n.js';
import {Select_zone} from '../common/controls.js';
import {report_exception} from '../util.js';
import '../css/proxy_edit.less';

const Index = withRouter(class Index extends Pure_component {
    constructor(props){
        super(props);
        this.state = {form: {}, errors: {}, show_loader: false,
            saving: false};
        this.debounced_save = _.debounce(this.save, 500);
        this.debounced = [];
        setdb.set('head.proxy_edit.set_field', this.set_field);
        setdb.set('head.proxy_edit.is_valid_field', this.is_valid_field);
        setdb.set('head.proxy_edit.is_disabled_ext_proxy',
            this.is_disabled_ext_proxy);
        setdb.set('head.proxy_edit.goto_field', this.goto_field);
        setdb.set('head.proxy_edit.get_curr_plan', this.get_curr_plan);
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
                return this.props.history.push('/overview');
            const form = Object.assign({}, proxy.config);
            this.apply_preset(form, form.preset||'session_long');
            this.setState({proxies}, this.delayed_loader());
        });
        this.setdb_on('ws.zones', zones=>{
            if (zones)
                this.setState({zones}, this.delayed_loader());
        });
        this.setdb_on('head.defaults', defaults=>
            this.setState({defaults}, this.delayed_loader()));
        this.setdb_on('head.callbacks', callbacks=>this.setState({callbacks}));
        this.setdb_on('head.proxy_edit.loading', loading=>
            this.setState({loading}));
        let state;
        if ((state = this.props.location.state) && state.field)
            this.goto_field(state.field);
    }
    willUnmount(){
        setdb.set('head.proxy_edit.form', undefined);
        setdb.set('head.proxy_edit', undefined);
        this.debounced.forEach(d=>d.cancel());
    }
    update_loader = ()=>{
        this.setState(state=>{
            const show_loader = !state.proxies || !state.defaults ||
                !state.zones;
            const zone_name = !show_loader &&
                (state.form.zone || state.zones.def);
            setdb.set('head.proxy_edit.zone_name', zone_name);
            return {show_loader};
        });
    };
    delayed_loader = ()=>{
        const fn = _.debounce(this.update_loader);
        this.debounced.push(fn);
        return fn;
    };
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
            this.props.history.push({pathname, state: {field}});
        }
    };
    set_field = (field_name, value, opt={})=>{
        this.setState(prev_state=>{
            const new_form = {...prev_state.form, [field_name]: value};
            return {form: new_form};
        }, this.start_saving.bind(null, opt));
        setdb.set('head.proxy_edit.form.'+field_name, value);
    };
    start_saving = opt=>{
        if (opt.skip_save)
            return;
        this.setState({saving: true}, ()=>this.lock_nav(true));
        this.debounced_save();
    };
    is_valid_field = field_name=>{
        const zones = this.state.zones;
        const form = this.state.form;
        if (!zones)
            return false;
        if (form.ext_proxies && all_fields[field_name] &&
            !all_fields[field_name].ext)
        {
            return false;
        }
        if (['city', 'state'].includes(field_name) &&
            (!form.country||form.country=='*'))
        {
            return false;
        }
        const zone = zones.zones.find(z=>z.name==(form.zone||zones.def));
        if (!zone || !zone.plan)
            return false;
        const permissions = zone.perm.split(' ') || [];
        if (field_name=='vip')
            return !!zone.plan.vip;
        if (field_name=='country' && zone.plan.ip_alloc_preset=='shared_block')
            return true;
        if (field_name=='country' && zone.plan.type=='static')
            return zone.plan.country || zone.plan.ip_alloc_preset;
        if (['country', 'state', 'city', 'asn', 'ip'].includes(field_name))
            return permissions.includes(field_name);
        if (field_name=='country' && (zone.plan.type=='static'||
            ['domain', 'domain_p'].includes(zone.plan.vips_type)))
        {
            return false;
        }
        if (field_name=='carrier')
            return permissions.includes('asn');
        return true;
    };
    is_disabled_ext_proxy = field_name=>{
        const form = this.state.form;
        if (form.ext_proxies && all_fields[field_name] &&
            !all_fields[field_name].ext)
        {
            return true;
        }
        return false;
    };
    apply_preset = (_form, preset)=>{
        const form = Object.assign({}, _form);
        const last_preset = form.preset ? presets.get(form.preset) : null;
        if (last_preset && last_preset.key!=preset && last_preset.clean)
            last_preset.clean(form);
        form.preset = preset;
        presets.get(preset).set(form);
        const disabled_fields = presets.get(preset).disabled||{};
        setdb.set('head.proxy_edit.disabled_fields', disabled_fields);
        this.apply_rules(form);
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
        if (!form.users)
            form.users = [];
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
        if (form.session==='true'||form.session===true)
            delete form.session;
        this.setState({form});
        setdb.set('head.proxy_edit.form', form);
        for (let i in form)
            setdb.emit('head.proxy_edit.form.'+i, form[i]);
    };
    apply_rules = ({rules})=>{
        if (!rules)
            return;
        const _rules = rules.map(map_rule_to_form)
        .map((r, i)=>({...r, id: i}));
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
        this.saving = true;
        const _this = this;
        this.etask(function*(){
            this.on('uncaught', e=>_this.etask(function*(){
                yield report_exception(e, 'proxy_edit/index.Index.save');
                _this.setState({error_list: [{msg: 'Something went wrong'}]});
                $('#save_proxy_errors').modal('show');
            }));
            this.on('finally', ()=>{
                _this.setState({saving: false}, ()=>_this.lock_nav(false));
                _this.saving = false;
            });
            const update_url = '/api/proxies/'+_this.props.match.params.port;
            const raw_resp = yield window.fetch(update_url, {
                method: 'PUT',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({proxy: data}),
            });
            const json_resp = yield raw_resp.json();
            if (json_resp.errors)
            {
                _this.set_errors(json_resp.errors);
                return $('#save_proxy_errors').modal('show');
            }
            if (_this.props.match.params.port!=_this.state.form.port)
            {
                const port = _this.state.form.port;
                _this.props.history.push({pathname: `/proxy/${port}/general`});
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
        save_form.zone = save_form.zone || this.state.zones.def;
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
        // XXX krzysztof: extract the logic of mapping specific fields
        if (save_form.smtp)
            save_form.smtp = save_form.smtp.filter(Boolean);
        else
            save_form.smtp = [];
        if (save_form.city.length)
            save_form.city = save_form.city[0].id;
        else
            save_form.city = '';
        if (save_form.asn.length==1)
            save_form.asn = Number(save_form.asn[0].id);
        else if (!save_form.asn.length)
            save_form.asn = '';
        if (save_form.headers)
            save_form.headers = save_form.headers.filter(h=>h.name&&h.value);
        if (save_form.session && save_form.session.replace)
        {
            save_form.session = save_form.session.replace(/-/g, '')
                .replace(/ /g, '');
        }
        return save_form;
    };
    get_curr_plan = ()=>{
        if (!this.state.zones)
            return {};
        const zone_name = this.state.form.zone || this.state.zones.def;
        const zone = this.state.zones.zones.find(p=>p.name==zone_name) || {};
        return zone.plan || {};
    };
    render(){
        // XXX krzysztof: cleanup type (index.js rotation.js general.js)
        const curr_plan = this.get_curr_plan();
        let type;
        if ((curr_plan.type||'').startsWith('static'))
            type = 'ips';
        else if (curr_plan.vip)
            type = 'vips';
        const zone = this.state.form.zone ||
            this.state.zones && this.state.zones.def;
        return <T>{t=><div className="proxy_edit">
              <Loader show={this.state.show_loader||this.state.loading}/>
              <div className="nav_wrapper">
                <div className="nav_header">
                  <Port_title port={this.props.match.params.port}
                    name={this.state.form.internal_name} t={t}/>
                  <Loader_small saving={this.state.saving}
                    std_msg={t('All changes saved in LPM')}
                    std_tooltip=
                    {t('All changes are automatically saved to LPM')}/>
                </div>
                <Nav disabled={!!this.state.form.ext_proxies}
                  form={this.state.form} plan={curr_plan}
                  on_change_preset={this.apply_preset}/>
                <Nav_tabs_wrapper/>
              </div>
              {this.state.zones && <Main_window/>}
              <Modal className="warnings_modal" id="save_proxy_errors"
                style={{zIndex: 10000}} title={t('Error')} no_cancel_btn>
                <Warnings warnings={this.state.error_list}/>
              </Modal>
              <Alloc_modal type={type} form={this.state.form} zone={zone}
                plan={curr_plan}/>
            </div>}</T>;
    }
});

const Nav_tabs_wrapper = withRouter(
class Nav_tabs_wrapper extends Pure_component {
    tabs = ['logs', 'target', 'rotation', 'speed', 'rules', 'headers',
        'general'];
    set_tab = id=>{
        const port = this.props.match.params.port;
        const pathname = `/proxy/${port}/${id}`;
        this.props.history.push({pathname});
    };
    render(){
        return <Nav_tabs set_tab={this.set_tab}>
              {this.tabs.map(t=><Nav_tab key={t} id={t} title={tabs[t].label}
                tooltip={tabs[t].tooltip}/>)}
            </Nav_tabs>;
    }
});

const Port_title = ({port, name, t})=>{
    if (name)
        port = port+` (${name})`;
    return <h3>{t('Proxy on port')} {port}</h3>;
};

class Open_browser_btn extends Pure_component {
    open_browser = ()=>{
        const _this = this;
        this.etask(function*(){
            const url = `/api/browser/${_this.props.port}`;
            const res = yield window.fetch(url);
            if (res.status==206)
                $('#fetching_chrome_modal').modal();
        });
    };
    render(){
        return <T>{t=>
              <Tooltip title={t('Open browser configured with this port')}
                placement="bottom">
                <button className="btn btn_lpm btn_browse"
                  onClick={this.open_browser}>
                  {t('Browse')}
                  <div className="icon browse_icon"></div>
                </button>
              </Tooltip>
            }</T>;
    }
}

const Main_window = withRouter(({match})=>
    <div className="main_window">
      <Switch>
        <Route path={`${match.path}/target`} component={Targeting}/>
        <Route path={`${match.path}/speed`} component={Speed}/>
        <Route path={`${match.path}/rules`} component={Rules}/>
        <Route path={`${match.path}/rotation`} component={Rotation}/>
        <Route path={`${match.path}/headers`} component={Headers}/>
        <Route path={`${match.path}/general`} component={General}/>
        <Route path={`${match.path}/logs`} component={Logs}/>
        <Route exact path={match.path} component={({location})=>
          <Redirect to={`${location.pathname}/logs`}/>}/>
      </Switch>
    </div>
);

class Nav extends Pure_component {
    state = {};
    set_field = setdb.get('head.proxy_edit.set_field');
    is_valid_field = setdb.get('head.proxy_edit.is_valid_field');
    componentDidMount(){
        this.setdb_on('ws.zones', zones=>zones && this.setState({zones}));
    }
    _reset_fields = ()=>{
        this.set_field('ips', []);
        this.set_field('vips', []);
        this.set_field('users', []);
        this.set_field('multiply_ips', false);
        this.set_field('multiply_vips', false);
        this.set_field('multiply_users', false);
        this.set_field('multiply', 0);
    };
    update_preset = val=>{
        this.props.on_change_preset(this.props.form, val);
        const disabled_fields = presets.get(val).disabled||{};
        setdb.set('head.proxy_edit.disabled_fields', disabled_fields);
        this._reset_fields();
    };
    update_zone = new_zone=>{
        let new_preset;
        const curr_zone = this.props.form.zone;
        if (this.is_unblocker(curr_zone) && !this.is_unblocker(new_zone))
            new_preset = presets.get_default().key;
        else if (!this.is_unblocker(curr_zone) && this.is_unblocker(new_zone))
            new_preset = 'unblocker';
        if (this.props.form.ips.length || this.props.form.vips.length)
            this.set_field('pool_size', 0);
        if (new_preset)
            this.update_preset(new_preset);
        else
            this._reset_fields();
        setdb.set('head.proxy_edit.zone_name', new_zone);
        this.set_field('zone', new_zone);
        const save_form = Object.assign({}, this.props.form);
        for (let field in save_form)
        {
            if (!this.is_valid_field(field, new_zone))
            {
                let v = '';
                if (field=='city'||field=='asn')
                    v = [];
                this.set_field(field, v);
            }
        }
    };
    is_unblocker(zone_name){
        const get_curr_plan = setdb.get('head.proxy_edit.get_curr_plan');
        return get_curr_plan && get_curr_plan().type=='unblocker';
    }
    confirm_update(cb){
        let no_confirm = localStorage.getItem('no-confirm-zone-preset');
        if (no_confirm && JSON.parse(no_confirm))
            return cb();
        this.setState({confirm_action: cb}, ()=>$('#confirm_modal').modal());
    }
    render(){
        const opts = presets.opts(this.is_unblocker(this.props.form.zone));
        const preset = this.props.form.preset;
        const is_unblocker = this.props.plan.type=='unblocker';
        const preset_disabled = this.props.disabled || is_unblocker;
        const href = window.location.href;
        const is_local = href.includes('localhost')||
            href.includes('127.0.0.1');
        return <div className="nav">
              <Select_zone val={this.props.form.zone} on_change_wrapper={val=>
                  this.confirm_update(()=>this.update_zone(val))}
                disabled={this.props.disabled} preview/>
              <Field i18n options={opts}
                on_change={val=>this.confirm_update(()=>
                  this.update_preset(val))}
                value={preset} disabled={preset_disabled}
                ext_tooltip={!is_unblocker} id="preset"
                tooltip={
                  <Preset_description preset={preset} rule_clicked={()=>0}/>
                }/>
              {is_local &&
                <Open_browser_btn port={this.props.form.port}/>
              }
              <Confirmation_modal on_ok={this.state.confirm_action}/>
            </div>;
    }
}

class Confirmation_modal extends Pure_component {
    constructor(props){
        super(props);
        this.state = {no_confirm: false};
        _.bindAll(this, qw`toggle_dismiss handle_ok handle_dismiss`);
    }
    componentDidMount(){
        let no_confirm = localStorage.getItem('no-confirm-zone-preset');
        this.setState({no_confirm: !!no_confirm && JSON.parse(no_confirm)});
    }
    toggle_dismiss(){
        this.setState({no_confirm: !this.state.no_confirm});
    }
    handle_ok(){
        localStorage.setItem('no-confirm-zone-preset', this.state.no_confirm);
        this.props.on_ok();
    }
    handle_dismiss(){
        this.setState({no_confirm: false});
    }
    render(){
        let left_item = <Checkbox text="Don't show this message again"
            value={this.state.no_confirm} checked={!!this.state.no_confirm}
            on_change={this.toggle_dismiss}/>;
        return <Modal title="Confirm changing preset or zone"
            id="confirm_modal" click_ok={this.handle_ok} ok_btn_title="Yes"
            left_footer_item={left_item} on_hidden={this.handle_dismiss}>
            <h4>Changing preset or zone may reset some other options. Are you
              sure you want to continue?</h4>
          </Modal>;
    }
}


const Field = ({id, disabled, children, i18n, ext_tooltip, ...props})=>{
    const options = props.options||[];
    return <T>{t=><div className="field" data-tip data-for={id+'tip'}>
          <React_tooltip id={id+'tip'} type="light" effect="solid"
            place="bottom" delayHide={0} delayUpdate={300}>
            {disabled && ext_tooltip ? <Ext_tooltip/> : props.tooltip}
          </React_tooltip>
          <select value={props.value} disabled={disabled}
            onChange={e=>props.on_change(e.target.value)}>
            {options.map(o=>
              <option key={o.key} value={o.value}>
                {i18n ? t(o.key) : o.key}
              </option>
            )}
          </select>
        </div>}</T>;
};

export default Index;
