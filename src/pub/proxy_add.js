// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true, es6:true*/
import etask from '../../util/etask.js';
import ajax from '../../util/ajax.js';
import setdb from '../../util/setdb.js';
import React from 'react';
import $ from 'jquery';
import classnames from 'classnames';
import {Modal, Loader, Textarea, Tooltip, Warnings, Code,
    Zone_description, Preset_description} from './common.js';
import {ga_event, presets} from './util.js';
import Pure_component from '../../www/util/pub/pure_component.js';
import {withRouter} from 'react-router-dom';
import prism from 'prismjs';
import instructions from './instructions.js';

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
    componentDidMount(){
        this.setdb_on('head.zones', zones=>{
            if (!zones)
                return;
            this.setState({zones, zone: zones.def});
        });
        this.setdb_on('head.proxies_running', proxies_running=>{
            if (!proxies_running)
                return;
            this.setState({proxies_running});
        });
    }
    persist = ()=>{
        const preset = this.state.preset;
        let form;
        if (this.state.cur_tab=='proxy_lum')
        {
            form = {
                last_preset_applied: preset,
                zone: this.state.zone||this.state.zones.def,
                proxy_type: 'persist',
            };
            const zone = this.state.zones.zones.find(z=>z.key==form.zone)||{};
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
    save = (opt={})=>{
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
            if (resp.port)
                _this.setState({show_loader: false});
            if (resp.port&&!_this.state.proxies_running.length)
                _this.setState({created_port: resp.port});
            else
                $('#add_new_proxy_modal').modal('hide');
            if (!resp.errors)
            {
                const proxies = yield ajax.json({url: '/api/proxies_running'});
                setdb.set('head.proxies_running', proxies);
                window.localStorage.setItem('quickstart-first-proxy',
                    resp.port);
                if (opt.redirect)
                {
                    yield etask.sleep(500);
                    $('#add_new_proxy_modal').modal('hide');
                    const state_opt = {};
                    if (opt.field)
                        state_opt.field = opt.field;
                    _this.props.history.push({pathname: `/proxy/${resp.port}`,
                        state: state_opt});
                }
            }
        });
    };
    rule_clicked(field){
        ga_event('add-new-port', 'rules clicked', field);
        this.save({redirect: true, field});
    }
    advanced_clicked = ()=>{
        if (this.state.proxies_running.length==1)
        {
            $('#add_new_proxy_modal').modal('hide');
            this.props.history.push({pathname: '/howto/code'});
            return;
        }
        if (this.state.created_port)
        {
            $('#add_new_proxy_modal').modal('hide');
            this.props.history.push(
                {pathname: `/proxy/${this.state.created_port}`});
            return;
        }
        ga_event('add-new-port', 'click save');
        this.save({redirect: true});
    };
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
    change_tab = id=>{
        ga_event('add-new-port', 'changed proxy type', id);
        this.setState({cur_tab: id});
    };
    on_hidden = ()=>this.setState({created_port: null});
    render(){
        const disabled = this.state.cur_tab=='proxy_ext'&&
            !this.state.valid_json;
        const Footer_wrapper = <Footer save_clicked={this.save}
            advanced_clicked={this.advanced_clicked} disabled={disabled}
            created_port={this.state.created_port}/>;
        if (!this.state.zones||!this.state.proxies_running)
            return null;
        let content;
        if (this.state.cur_tab=='proxy_lum')
        {
            content = <Lum_proxy
                  created_port={this.state.created_port}
                  zone={this.state.zone}
                  zones={this.state.zones}
                  on_field_change={this.field_changed.bind(this)}
                  preset={this.state.preset}
                  rule_clicked={this.rule_clicked.bind(this)}
                  presets_opt={this.presets_opt}/>;
        }
        else if (this.state.cur_tab=='proxy_ext')
        {
            content = <Ext_proxy
                  parse_error={this.state.parse_error}
                  ips_list={this.state.ips_list}
                  on_field_change={this.field_changed.bind(this)}/>;
        }
        const anim_classes = classnames('proxy_form', 'animated', {
            proxy_created: this.state.created_port,
            fadeOutUp: this.state.created_port,
        });
        return <div className="lpm">
              <Loader show={this.state.show_loader}/>
              <Modal id="add_new_proxy_modal" no_header no_close
                on_hidden={this.on_hidden} footer={Footer_wrapper}
                className="add_proxy_modal">
                <div className={anim_classes}>
                  <Nav_tabs change_tab={this.change_tab}
                    cur_tab={this.state.cur_tab}/>
                  {content}
                </div>
                <Created_port port={this.state.created_port}/>
              </Modal>
              <Modal className="warnings_modal" id="add_proxy_errors"
                title="Errors:" no_cancel_btn>
                <Warnings warnings={this.state.error_list}/>
              </Modal>
            </div>;
    }
});

const Created_port = ({port})=>{
    if (!port)
        return null;
    const to_copy = instructions.code(port).shell;
    const code = prism.highlight(to_copy, prism.languages.clike);
    return <div className="howto animated fadeInUp">
          <h3 style={{marginBottom: 15, marginTop: -20}}>
            Congratulation! You just created a port {port}</h3>
          <span>
            You can start using the port by running the following command:
          </span>
          <div className="well instructions_well">
            <pre>
              <Code>
                <div dangerouslySetInnerHTML={{__html: code}}/>
              </Code>
            </pre>
          </div>
        </div>;
};

const Ext_proxy = ({ips_list, on_field_change, parse_error})=>{
    const json_example = '[\'1.1.1.2\', '
        +'\'my_username:my_password@1.2.3.4:8888\']';
    const placeholder = 'List of IPs to the external proxies in the following '
        +'format: [username:password@]ip[:port]';
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
    presets_opt, created_port})=>
{
    const preset_tip = `Presets is a set of preconfigured configurations
    for specific purposes`;
    const zone_tip = `Zone that will be used by this proxy port`;
    const zones_opt = zones.zones.map(z=>{
        if (z.name==zones.def)
            return {key: `Default (${z.name})`, value: z.name};
        return {key: z.name, value: z.name};
    });
    return <div className="lum_proxy">
          <div className="group">
            <Field icon_class="zone_icon" val={zone} options={zones_opt}
              title="Zone" on_change={on_field_change('zone')}
              tooltip={zone_tip}/>
            <Preview title={zones_opt.find(z=>z.value==zone).key}>
              <Zone_description zones={zones} zone_name={zone}/>
              <a className="link" href="https://luminati.io/cp/zones"
                target="_blank" rel="noopener noreferrer">Edit zone</a>
            </Preview>
          </div>
          <div className="group">
            <Field icon_class="preset_icon" val={preset}
              options={presets_opt} title="Preset configuration"
              on_change={on_field_change('preset')} tooltip={preset_tip}/>
            <Preview title={presets_opt.find(p=>p.value==preset).key}>
              <Preset_description preset={preset} rule_clicked={rule_clicked}/>
            </Preview>
          </div>
        </div>;
};

const Preview = ({title, children})=>{
    return <div className="preview">
          <div className="header">{title}</div>
          {children}
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
    <div className="field">
      <div className="field_header">
        <div className={classnames('icon', props.icon_class)}/>
        <h4>{props.title}:</h4>
      </div>
      <Tooltip title={props.tooltip}>
        <select onChange={e=>props.on_change(e.target.value)}
          value={props.val}>
          {props.options.map((o, i)=>
            <option key={i} value={o.value}>{o.key}</option>)}
        </select>
      </Tooltip>
    </div>;

const Footer = props=>{
    const save_clicked = ()=>{
        ga_event('add-new-port', 'click advanced');
        if (props.disabled)
            return;
        props.save_clicked();
    };
    const ok_clicked = ()=>{
        $('#add_new_proxy_modal').modal('hide');
    };
    const classes = classnames('btn', 'btn_lpm', 'btn_lpm_primary',
        {disabled: props.disabled});
    const adv_tip = 'Creates a proxy port and moves to the configuration page';
    return <div className="footer">
          <Tooltip title={adv_tip}>
            <a onClick={props.advanced_clicked} className="link"
              style={{float: 'left'}}>Advanced options</a>
          </Tooltip>
          {!props.created_port &&
            <button onClick={save_clicked} className={classes}>Save</button>}
          {!!props.created_port &&
            <button onClick={ok_clicked} className={classes}>OK</button>}
        </div>;
};

export default Proxy_add;
