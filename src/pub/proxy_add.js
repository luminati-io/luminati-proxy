// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true, es6:true*/
import etask from '../../util/etask.js';
import ajax from '../../util/ajax.js';
import setdb from '../../util/setdb.js';
import React from 'react';
import $ from 'jquery';
import classnames from 'classnames';
import {Modal, Loader, Textarea, Tooltip, Warnings} from './common.js';
import {ga_event, presets} from './util.js';
import Pure_component from '../../www/util/pub/pure_component.js';
import {withRouter} from 'react-router-dom';

const Proxy_add = withRouter(class Proxy_add extends Pure_component {
    presets_opt = Object.keys(presets).map(p=>{
        let key = presets[p].title;
        if (presets[p].default)
            key = `Default (${key})`;
        return {key, value: p};
    });
    state = {
        zone: '',
        preset: 'session_long',
        show_loader: false,
        cur_tab: 'proxy_lum',
        error_list: [],
    };
    componentWillMount(){
        this.setdb_on('head.settings', settings=>{
            if (!settings)
                return;
            this.setdb_on('head.consts', consts=>{
                if (consts)
                    this.prepare(consts, settings);
            });
        });
    }
    // XXX krzysztof: clean up zones and plans logic; use /api/zones
    prepare = (consts, settings)=>{
        const zones = (consts.proxy.zone.values||[]).filter(z=>{
            const plan = z.plans && z.plans.slice(-1)[0] || {};
            return !plan.archive && !plan.disable;
        });
        let def;
        if (zones[0] && !zones[0].value && (def = settings.zone||zones[0].key))
            zones[0] = {key: `Default (${def})`, value: ''};
        this.setState({consts, zones, def});
    };
    persist = ()=>{
        const preset = this.state.preset;
        let form;
        if (this.state.cur_tab=='proxy_lum')
        {
            form = {
                last_preset_applied: preset,
                zone: this.state.zone||this.state.def,
                proxy_type: 'persist',
            };
            const zone = this.state.zones.filter(z=>z.key==form.zone)[0]||{};
            form.password = zone.password;
            presets[preset].set(form);
        }
        else
        {
            form = {
                proxy_type: 'persist',
                ext_proxies: this.state.parsed_ips_list,
                // XXX krzysztof: move it to backend session: true
                session: true,
            };
        }
        const _this = this;
        return etask(function*(){
            this.on('uncaught', e=>{
                console.log(e);
                ga_event('add-new-port', 'failed saved', e.message);
                _this.setState({show_loader: false});
            });
            const proxies = yield ajax.json({url: '/api/proxies_running'});
            let port = 24000;
            proxies.forEach(p=>{
                if (p.port>=port)
                    port = p.port+1;
            });
            form.port = port;
            // XXX krzysztof: switch fetch->ajax
            const raw_resp = yield window.fetch('/api/proxies', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({proxy: form}),
            });
            const resp = yield raw_resp.json();
            if (resp.errors)
                return resp;
            ga_event('add-new-port', 'successfully saved');
            return {port};
        });
    };
    save(opt={}){
        const _this = this;
        this.etask(function*(){
            this.on('uncaught', e=>{ console.log(e); });
            _this.setState({show_loader: true});
            const resp = yield _this.persist();
            if (resp.errors)
            {
                _this.setState({error_list: resp.errors});
                $('#add_proxy_errors').modal('show');
            }
            $('#add_new_proxy_modal').modal('hide');
            yield etask.sleep(500);
            _this.setState({show_loader: false});
            if (!resp.errors)
            {
                const proxies = yield ajax.json({url: '/api/proxies_running'});
                setdb.set('head.proxies_running', proxies);
                window.localStorage.setItem('quickstart-first-proxy',
                    resp.port);
                if (opt.redirect)
                {
                    const state_opt = {};
                    if (opt.field)
                        state_opt.field = opt.field;
                    _this.props.history.push({pathname: `/proxy/${resp.port}`,
                        state: state_opt});
                }
            }
        });
    }
    rule_clicked(field){
        ga_event('add-new-port', 'rules clicked', field);
        this.save({redirect: true, field});
    }
    advanced_clicked(){
        ga_event('add-new-port', 'click save');
        this.save({redirect: true});
    }
    field_changed = id=>value=>{
        this.setState({[id]: value});
        if (id=='zone')
            ga_event('add-new-port', 'zone selected', value);
        else if (id=='preset')
        {
            ga_event('add-new-port', 'preset selected',
                `${this.state.preset}_${value}`);
        }
    };
    change_tab(id){
        ga_event('add-new-port', 'changed proxy type', id);
        this.setState({cur_tab: id});
    }
    render(){
        const disabled = this.state.cur_tab=='proxy_ext'&&
            !this.state.valid_json;
        const Footer_wrapper = <Footer save_clicked={this.save.bind(this)}
          disabled={disabled}/>;
        if (!this.state.zones)
            return null;
        let content;
        if (this.state.cur_tab=='proxy_lum')
        {
            content = <Lum_proxy
                  zone={this.state.zone}
                  zones={this.state.zones}
                  on_field_change={this.field_changed.bind(this)}
                  preset={this.state.preset}
                  rule_clicked={this.rule_clicked.bind(this)}
                  advanced_clicked={this.advanced_clicked.bind(this)}
                  presets_opt={this.presets_opt}/>;
        }
        else if (this.state.cur_tab=='proxy_ext')
        {
            content = <Ext_proxy
                  parse_error={this.state.parse_error}
                  ips_list={this.state.ips_list}
                  on_field_change={this.field_changed.bind(this)}/>;
        }
        return <div className="lpm">
              <Loader show={this.state.show_loader}/>
              <Modal id="add_new_proxy_modal" no_header no_close
                footer={Footer_wrapper} className="add_proxy_modal">
                <Nav_tabs change_tab={this.change_tab.bind(this)}
                  cur_tab={this.state.cur_tab}/>
                {content}
              </Modal>
              <Modal className="warnings_modal" id="add_proxy_errors"
                title="Errors:" no_cancel_btn>
                <Warnings warnings={this.state.error_list}/>
              </Modal>
            </div>;
    }
});

const Ext_proxy = ({ips_list, on_field_change, parse_error})=>{
    const json_example = '[\'1.1.1.2\', \'username:password@1.2.3.4:8888\']';
    const placeholder = 'List of IPs to the external proxies in the following '
        +'format: [username:password@]ip[:port], example:\n'+json_example;
    const on_change_list = val=>{
        on_field_change('ips_list')(val);
        try {
            const parsed = JSON.parse(val.replace(/'/g, '"'));
            if (!Array.isArray(parsed))
                throw {message: 'Proxies list has to be an array'};
            if (!parsed.length)
                throw {message: 'Proxies list array can not be empty'};
            parsed.forEach(ip=>{
                if (typeof ip!='string')
                    throw {message: 'Wrong format of proxies list'};
                if (!ip)
                    throw {message: 'Proxy IP can not be an empty string'};
            });
            on_field_change('parsed_ips_list')(parsed);
            on_field_change('parse_error')(null);
            on_field_change('valid_json')(true);
        } catch(e){
            on_field_change('parse_error')(e.message);
            on_field_change('valid_json')(false);
        }
    };
    return <div className="ext_proxy">
          <Textarea rows={6} val={ips_list}
            placeholder={placeholder}
            on_change_wrapper={on_change_list}/>
          <div className="json_example">
              <strong>Example: </strong>{json_example}
          </div>
          <div className="json_error">{parse_error}</div>
        </div>;
};

const Lum_proxy = ({zone, zones, on_field_change, preset, rule_clicked,
    presets_opt, advanced_clicked})=>
{
    const preset_tip = `Presets is a set of preconfigured configurations
    for specific purposes`;
    const zone_tip = `Zone that will be used by this proxy port`;
    const rule_tip = `Click to save a proxy port and move to this
    configuration`;
    return <div className="lum_proxy">
          <div className="fields_wrapper">
            <div className="fields">
              <Field icon_class="zone_icon" val={zone} options={zones}
                title="Zone" on_change={on_field_change('zone')}
                tooltip={zone_tip}/>
              <Field icon_class="preset_icon" val={preset}
                options={presets_opt} title="Preset configuration"
                on_change={on_field_change('preset')} tooltip={preset_tip}/>
            </div>
          </div>
          <div className="preview">
            <div className="header">{presets[preset].title}</div>
            <div className="desc">{presets[preset].subtitle}</div>
            <ul>
            {(presets[preset].rules||[]).map(r=>
              <li key={r.field}>
                <Tooltip title={rule_tip}>
                  <a className="link" onClick={()=>rule_clicked(r.field)}>
                    {r.label}</a>
                </Tooltip>
              </li>
            )}
            </ul>
            <Tooltip
              title="Creates a proxy port and moves to the configuration page">
              <a onClick={advanced_clicked} className="link">
                Advanced options</a>
            </Tooltip>
          </div>
        </div>;
};

const Nav_tabs = ({change_tab, cur_tab})=>
    <div className="nav_tabs tabs">
      <Tab on_click={change_tab} title="Luminati" id="proxy_lum"
        cur_tab={cur_tab}
        tooltip="Proxy port using your Luminati account"/>
      <Tab on_click={change_tab} title="External" id="proxy_ext"
        cur_tab={cur_tab}
        tooltip="Proxy port configured with external IP and credentials"/>
    </div>;

const Tab = ({id, on_click, title, cur_tab, tooltip})=>{
    const active = cur_tab==id;
    const btn_class = classnames('btn_tab', {active});
    return <Tooltip title={tooltip}>
          <div onClick={()=>on_click(id)} className={btn_class}>
            <div className={classnames('icon', id)}/>
            <div className="title">{title}</div>
            <div className="arrow"/>
          </div>
        </Tooltip>;
};

const Field = props=>
    <Tooltip title={props.tooltip}>
      <div className="field">
        <div className="field_header">
          <div className={classnames('icon', props.icon_class)}/>
          <h4>{props.title}</h4>
        </div>
        <select onChange={e=>props.on_change(e.target.value)}
          value={props.val}>
          {props.options.map((o, i)=>
            <option key={i} value={o.value}>{o.key}</option>)}
        </select>
      </div>
    </Tooltip>;

const Footer = props=>{
    const save_clicked = ()=>{
        ga_event('add-new-port', 'click advanced');
        if (props.disabled)
            return;
        props.save_clicked();
    };
    const classes = classnames('btn', 'btn_lpm', 'btn_lpm_primary',
        {disabled: props.disabled});
    return <button onClick={save_clicked} className={classes}>Save</button>;
};

export default Proxy_add;
