// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true, es6:true*/
import React from 'react';
import $ from 'jquery';
import _ from 'lodash4';
import classnames from 'classnames';
import {withRouter, Switch, Route, Redirect} from 'react-router-dom';
import React_tooltip from 'react-tooltip';
import Pure_component from '/www/util/pub/pure_component.js';
import etask from '../../../util/etask.js';
import setdb from '../../../util/setdb.js';
import {qw} from '../../../util/string.js';
import {Loader, Loader_small, Preset_description, Ext_tooltip,
    Checkbox, Faq_link, Alert} from '../common.js';
import {Nav_tabs, Nav_tab} from '../common/nav_tabs.js';
import presets from '../common/presets.js';
import Tooltip from '../common/tooltip.js';
import {Modal} from '../common/modals.js';
import {T} from '../common/i18n.js';
import {Select_zone} from '../common/controls.js';
import {report_exception, bind_all, is_local} from '../util.js';
import ws from '../ws.js';
import {main as Api} from '../api.js';
import Warnings_modal from '../common/warnings_modal.js';
import {Rules, map_rule_to_form} from './rules.js';
import Targeting from './targeting.js';
import General from './general.js';
import Rotation from './rotation.js';
import Browser from './browser.js';
import Logs from './logs.js';
import Alloc_modal from './alloc_modal.js';
import {tabs, all_fields, tips} from './fields.js';
import '../css/proxy_edit.less';

const mgr_proxy_shared_fields = ['debug', 'lpm_auth'];

const Index = withRouter(class Index extends Pure_component {
    constructor(props){
        super(props);
        this.state = {form: {}, errors: {}, show_loader: false,
            saving: false, is_changed: false, default_form: {},
            show_alert: false};
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
            const proxies_running = yield Api.json.get('proxies_running');
            setdb.set('head.proxies_running', proxies_running);
        });
        this.setdb_on('head.proxies_running', proxies=>{
            if (!proxies||this.state.proxies)
                return;
            const port = this.props.match.params.port;
            const proxy = proxies.filter(p=>p.port==port)[0];
            if (!proxy)
                return this.props.history.push('/overview');
            const form = Object.assign({}, proxy);
            this.apply_preset(form, undefined, true);
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
        this.setdb_on('head.settings', s=>this.setState({global_settings: s}));
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
    isEmpty = value=>{
        const type = typeof value;
        switch (type)
        {
            case 'boolean':
            case 'number':
                return !value;
            case 'string':
                return !value.trim();
            case 'object':
                if (value.hasOwnProperty('length'))
                {
                    if (value.length)
                        return value.every(v=>this.isEmpty(v));
                    return true;
                }
                return this.isEmpty(Object.values(value));
        }
    };
    has_changes = (new_obj, old_obj)=>{
        const is_changed = _.intersection(Object.keys(new_obj),
            Object.keys(old_obj)).some(k=>!_.isEqual(new_obj[k], old_obj[k]));
        const diffs = _.xor(Object.keys(new_obj), Object.keys(old_obj))
            .filter(k=>!mgr_proxy_shared_fields.includes(k))
            .some(k=>!this.isEmpty(new_obj[k]));
        return is_changed || diffs;
    };
    set_field = (field_name, value, opt={})=>{
        this.setState(prev_state=>{
            const new_form = {...prev_state.form, [field_name]: value};
            const pending_form = {...prev_state.pending_form,
                [field_name]: value};
            const is_changed = this.has_changes(new_form,
                this.state.default_form);
            return {form: new_form, pending_form, is_changed};
        });
        setdb.set('head.proxy_edit.form.'+field_name, value);
    };
    start_saving = ()=>{
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
        if (['city', 'state', 'zip'].includes(field_name) &&
            (!form.country||form.country=='*'))
        {
            return false;
        }
        const zone = zones.zones.find(z=>z.name==(form.zone||zones.def));
        if (!zone || !zone.plan)
            return false;
        const permissions = zone.perm.split(' ') || [];
        const perm_fields = ['country', 'state', 'city', 'asn', 'ip', 'zip'];
        if (field_name=='vip')
            return !!zone.plan.vip;
        if (field_name=='country' && zone.plan.ip_alloc_preset=='shared_block')
            return true;
        if (field_name=='country' && zone.plan.type=='static')
            return zone.plan.country || zone.plan.ip_alloc_preset;
        if (perm_fields.includes(field_name))
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
    set_default_mgr_proxy_shared_fields = form=>{
        mgr_proxy_shared_fields.forEach(k=>{
            if (!form.hasOwnProperty(k) && this.state.defaults[k])
                form[k] = `default-${this.state.defaults[k]}`;
        });
    };
    apply_preset = (_form, preset, is_mount)=>{
        const form_upd = {};
        const form = Object.assign({}, _form);
        if (!preset)
            preset = form.preset;
        if (!presets.get(preset))
            preset = presets.get_default().key;
        const last_preset = form.preset ? presets.get(form.preset) : null;
        if (last_preset && last_preset.key!=preset && last_preset.clean)
            last_preset.clean(form_upd);
        if (!is_mount)
            form_upd.preset = preset;
        presets.get(preset)
            .set(form_upd, form, !last_preset || last_preset.key!=preset);
        const disabled_fields = presets.get(preset).disabled||{};
        setdb.set('head.proxy_edit.disabled_fields', disabled_fields);
        this.apply_rules(form);
        if (form.reverse_lookup===undefined)
        {
            if (form.reverse_lookup_dns)
                form_upd.reverse_lookup = 'dns';
            else if (form.reverse_lookup_file)
                form_upd.reverse_lookup = 'file';
            else if (form.reverse_lookup_values)
            {
                form_upd.reverse_lookup = 'values';
                form_upd.reverse_lookup_values = form.reverse_lookup_values
                .join('\n');
            }
        }
        if (!form.ips)
            form.ips = [];
        if (!form.vips)
            form.vips = [];
        if (!form.users)
            form.users = [];
        qw`country state`.forEach(k=>{
            form[k] = (form[k]||'').toLowerCase();
        });
        if (form.city && !form.city.includes('|') && form.state)
            form.city = form.city+'|'+form.state;
        Object.assign(form, form_upd);
        if (!this.original_form)
            this.original_form = form;
        if (form.session==='true'||form.session===true)
        {
            delete form.session;
            delete form_upd.session;
        }
        this.setState({form, pending_form: form_upd});
        if (is_mount)
        {
            const default_form = _.cloneDeep(form);
            this.set_default_mgr_proxy_shared_fields(default_form);
            this.setState({default_form});
        }
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
            const proxies = yield Api.json.get('proxies_running');
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
        return this.etask(function*(){
            this.on('uncaught', e=>_this.etask(function*(){
                yield report_exception(e, 'proxy_edit/index.Index.save');
                _this.setState({error_list: [{msg: 'Something went wrong'}]});
                $('#save_proxy_errors').modal('show');
            }));
            this.on('finally', ()=>{
                _this.setState({saving: false}, ()=>_this.lock_nav(false));
                _this.saving = false;
            });
            const update_url = `proxies/${_this.props.match.params.port}`;
            const resp = yield Api.json.put(update_url, {proxy: data});
            if (resp.errors)
            {
                _this.set_errors(resp.errors);
                $('#save_proxy_errors').modal('show');
                return resp.errors;
            }
            const c_form = _.cloneDeep(_this.state.form);
            _this.set_default_mgr_proxy_shared_fields(c_form);
            _this.setState({default_form: c_form,
                is_changed: false, show_alert: true, pending_form: {}});
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
        const save_form = Object.assign({}, this.state.pending_form);
        for (let field in save_form)
        {
            if (!this.is_valid_field(field)||save_form[field]===null)
                save_form[field] = '';
            if (field=='reverse_lookup')
            {
                qw`dns file values`.forEach(f=>{
                    if (save_form[field]!=f)
                        save_form[field+'_'+f] = '';
                });
                if (save_form[field]=='dns')
                    save_form.reverse_lookup_dns = true;
                if (save_form[field]=='values')
                {
                    save_form.reverse_lookup_values =
                        (save_form.reverse_lookup_values||'').split(' ');
                }
                delete save_form.reverse_lookup;
            }
            if (field=='reverse_lookup_values')
            {
                let values;
                if (Array.isArray(values = save_form.reverse_lookup_values) &&
                    !values.length)
                {
                    save_form.reverse_lookup = '';
                    delete save_form.reverse_lookup_values;
                }
                else if (values && !Array.isArray(values))
                    save_form.reverse_lookup_values = values.split(' ');
            }
            if (field=='smtp' && save_form[field])
            {
                save_form.smtp = save_form.smtp ?
                    save_form.smtp.filter(Boolean) : [];
            }
            if (field=='city' && save_form[field])
            {
                const [city, state] = save_form.city.split('|');
                save_form.city = city;
                if (state)
                    save_form.state = state;
            }
            if (field=='asn' && save_form[field])
                save_form.asn = Number(save_form.asn);
            if (field=='headers' && save_form[field])
            {
                save_form.headers = save_form.headers.filter(h=>
                    h.name&&h.value);
            }
            if (field=='session' && typeof save_form[field]=='string')
            {
                const {session} = save_form;
                if (!session.trim())
                    save_form.session = true;
                else
                    save_form.session = session.replace(/(-| )/g, '');
            }
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
    back_func = ()=>this.props.history.push({pathname: '/overview'});
    on_back_click = ()=>{
        ws.post_event('Back to Overview Click',
            {settings_changed: this.state.is_changed});
        return this.state.is_changed ? $('#port_confirmation_modal').modal()
            : this.back_func();
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
        const gs = this.state.global_settings || {};
        return <div className="proxy_edit vbox">
          <div className="cp_panel vbox">
            <Loader show={this.state.show_loader||this.state.loading}/>
            <div>
              <Header
                match={this.props.match}
                internal_name={this.state.form.internal_name}
                is_saving={this.state.saving}
                on_back_click={this.on_back_click}
              />
              <Nav
                disabled={!!this.state.form.ext_proxies}
                form={this.state.form}
                plan={curr_plan}
                on_change_preset={this.apply_preset}
                is_changed={this.state.is_changed}
                saving={this.state.saving}
                save={()=>$('#save_port_confirmation_modal').modal()}
              />
              <Nav_tabs_wrapper/>
            </div>
            {this.state.zones && <Main_window/>}
            <Warnings_modal id="save_proxy_errors"
              warnings={this.state.error_list}/>
            <Alloc_modal
              type={type}
              form={this.state.form}
              zone={zone}
              zones={this.state.zones}
              plan={curr_plan}
            />
          </div>
          {this.state.show_alert &&
            <Alert
              variant="success"
              dismissible
              text="Port changes saved"
              on_close={()=>this.setState({show_alert: false})}
            />
          }
          <Modal
            id="port_confirmation_modal"
            title="Would you like to save your changes?"
            ok_btn_title="Save"
            click_ok={()=>{
              let _this = this;
              etask(function*(){
                _this.setState({saving: true}, ()=>_this.lock_nav(true));
                const errs = yield _this.save();
                if (!errs)
                    _this.back_func();
              });
            }}
            cancel_clicked={this.back_func}>
            <h4>Looks like you did not save the changes you made to port
                &nbsp;{this.props.match.params.port}.
                Would you like to save them?</h4>
            {gs.sync_config && !gs.zagent && <span>
              {tips.sync_config_warn}
            </span>}
          </Modal>
          <Modal
            id="save_port_confirmation_modal"
            title="Accept save changes"
            ok_btn_title="Yes"
            click_ok={this.start_saving}>
            {gs.sync_config && !gs.zagent && <span>
              {tips.sync_config_warn}
            </span>}
          </Modal>
        </div>;
    }
});

const Nav_tabs_wrapper = withRouter(
class Nav_tabs_wrapper extends Pure_component {
    tabs = ['logs', 'target', 'rotation', 'rules', 'browser', 'general'];
    set_tab = id=>{
        ws.post_event('Tab Click', {tab: id});
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

const Header = props=>
  <T>{t=>
    <div className="cp_panel_header">
      <Back_btn click={props.on_back_click}/>
      <Port_title port={props.match.params.port}
        name={props.internal_name} t={t}/>
      <Loader_small saving={props.is_saving}
        std_msg={t('All changes saved in Proxy Manager')}
        std_tooltip=
        {t('All changes are automatically saved to Proxy Manager')}/>
    </div>
  }</T>;

export class Back_btn extends Pure_component {
    state = {lock: false};
    componentDidMount(){
        this.setdb_on('head.lock_navigation', lock=>
            lock!==undefined && this.setState({lock}));
    }
    render(){
        const {lock} = this.state;
        return <div className={classnames('back_wrapper', {lock})}
          onClick={this.props.click}>
          <div className="cp_icon back"/>
          <span><T>Back to overview</T></span>
        </div>;
    }
}

const Port_title = ({port, name, t})=>{
    if (name)
        port = port+` (${name})`;
    return <h2>{t('Proxy on port')} {port}</h2>;
};

class Open_browser_btn extends Pure_component {
    open_browser = ()=>{
        const _this = this;
        ws.post_event('Browser Click');
        this.etask(function*(){
            const res = yield Api.get(`browser/${_this.props.port}`);
            if ((res||'').includes('Fetching'))
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
        <Route path={`${match.path}/rules`} component={Rules}/>
        <Route path={`${match.path}/rotation`} component={Rotation}/>
        <Route path={`${match.path}/browser`} component={Browser}/>
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
                this.set_field(field, '');
        }
    };
    is_unblocker = zone_name=>{
        if (!this.state.zones)
            return;
        const {plan} = this.state.zones.zones.find(z=>z.name==zone_name)||{};
        return (plan||{}).type=='unblocker';
    };
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
        const preset_disabled = this.props.disabled;
        return <div className="nav">
          <Select_zone
            val={this.props.form.zone}
            on_change_wrapper={val=>
              this.confirm_update(()=>this.update_zone(val))}
            disabled={this.props.disabled}
            preview
          />
          <Field
            i18n
            options={opts}
            on_change={val=>this.confirm_update(()=>
              this.update_preset(val))}
            value={preset}
            disabled={preset_disabled}
            ext_tooltip={!is_unblocker}
            id="preset"
            tooltip={
              <Preset_description preset={preset} rule_clicked={()=>0}/>
            }
            faq={{article: '12583049659025', anchor: 'preset'}}
          />
          {is_local() &&
            <Open_browser_btn port={this.props.form.port}/>
          }
          <button className="btn btn_lpm btn_lpm_primary"
            onClick={this.props.save}
            disabled={!this.props.is_changed || this.props.saving}>
            <T>Save changes</T>
          </button>
          <Confirmation_modal on_ok={this.state.confirm_action}/>
        </div>;
    }
}

class Confirmation_modal extends Pure_component {
    constructor(props){
        super(props);
        this.state = {no_confirm: false};
        bind_all(this, qw`toggle_dismiss handle_ok handle_dismiss`);
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
        {props.faq && <Faq_link article={props.faq.article}
            anchor={props.faq.anchor}/>}
    </div>}</T>;
};

export default Index;
