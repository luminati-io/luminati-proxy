// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true, es6:true*/
import etask from 'hutil/util/etask';
import ajax from 'hutil/util/ajax';
import setdb from 'hutil/util/setdb';
import React from 'react';
import $ from 'jquery';
import classnames from 'classnames';
import {Modal, Loader, onboarding, presets, emitter} from './common.js';
import util from './util.js';
import Pure_component from '../../www/util/pub/pure_component.js';

const ga_event = util.ga_event;

class Add_proxy extends Pure_component {
    constructor(props){
        super(props);
        this.presets_opt = Object.keys(presets).map(p=>
            ({key: presets[p].title, value: p}));
        this.state = {zone: '', preset: 'sequential', show_loader: false};
    }
    componentWillMount(){
        this.setdb_on('head.consts', consts=>{
            if (!consts)
                return;
            const zones = (consts.proxy.zone.values||[]).filter(z=>{
                const plan = z.plans && z.plans.slice(-1)[0] || {};
                return !plan.archive && !plan.disable;
            });
            this.setState({consts, zones});
        });
    }
    persist(){
        const preset = this.state.preset;
        const form = {
            last_preset_applied: preset,
            zone: this.state.zone||this.state.consts.proxy.zone.def,
            proxy_type:'persist',
            max_requests:0,
            session_duration: 0,
            ips: [],
            vips: [],
            whitelist_ips: [],
        };
        const zone = this.state.zones.filter(z=>z.key==form.zone)[0]||{};
        form.password = zone.password;
        presets[preset].set(form);
        this.setState({show_loader: true});
        const _this = this;
        return etask(function*(){
            this.on('uncaught', e=>{
                console.log(e);
                ga_event('add-new-port', 'failed saved', e.message);
            });
            const proxies = yield ajax.json({url: '/api/proxies_running'});
            let port = 24000;
            proxies.forEach(p=>{
                if (p.port>=port)
                    port = p.port+1;
            });
            form.port = port;
            const raw_update = yield window.fetch('/api/proxies', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({proxy: form}),
            });
            ga_event('add-new-port', 'successfully saved');
            _this.setState({show_loader: false});
            return port;
        });
    }
    save(opt={}){
        const _this = this;
        this.etask(function*(){
            const port = yield _this.persist();
            onboarding.check_created_proxy();
            const callbacks = setdb.get('head.callbacks');
            yield callbacks.proxies.update();
            const tested_proxy = yield onboarding.has_tested_proxy();
            $('#add_proxy_modal').modal('hide');
            window.localStorage.setItem('quickstart-first-proxy', port);
            if (opt.redirect)
            {
                const state_opt = {port};
                if (opt.field)
                    state_opt.field = opt.field;
                return yield callbacks.state.go('edit_proxy', state_opt);
            }
            if (!tested_proxy)
            {
                emitter.emit('setup_guide:progress_modal',`Great! You have`
                    +` configured proxy on port ${port}`, 500);
            }
        });
    }
    rule_clicked(field){
        ga_event('add-new-port', 'rules clicked', field);
        this.save({redirect: true, field});
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
    render(){
        const Footer_wrapper = <Footer save_clicked={this.save.bind(this)}/>;
        if (!this.state.zones)
            return null;
        return (
            <div className="lpm">
              <Loader show={this.state.show_loader}/>
              <Modal id="add_proxy_modal" title="Add new proxy"
                footer={Footer_wrapper} className="add_proxy_modal">
                <div className="fields_wrapper">
                  <div className="fields">
                    <Field icon_class="zone_icon" val={this.state.zone}
                      options={this.state.zones} title="Choose Zone"
                      on_change={this.field_changed('zone').bind(this)}/>
                    <Field icon_class="preset_icon" val={this.state.preset}
                      options={this.presets_opt}
                      title="Select preset configuration"
                      on_change={this.field_changed('preset').bind(this)}/>
                  </div>
                </div>
                <div className="preview">
                  <div className="header">
                    {presets[this.state.preset].title}</div>
                  <div className="desc">
                    {presets[this.state.preset].subtitle}</div>
                  <ul>
                  {(presets[this.state.preset].rules||[]).map((r, i)=>(
                    <li key={i}>
                      <a onClick={()=>this.rule_clicked(r.field)}>
                        {r.label}</a>
                    </li>
                  ))}
                  </ul>
                </div>
              </Modal>
            </div>
        );
    }
}

const Field = props=>(
    <div className="field">
      <div className="field_header">
        <div className={classnames('icon', props.icon_class)}/>
        <h4>{props.title}</h4>
      </div>
      <select onChange={e=>props.on_change(e.target.value)} value={props.val}>
        {props.options.map((o, i)=>(
            <option key={i} value={o.value}>{o.key}</option>
        ))}
      </select>
    </div>
);

const Footer = props=>{
    const advanced_clicked = ()=>{
        ga_event('add-new-port', 'click save');
        props.save_clicked({redirect: true});
    };
    const save_clicked = ()=>{
        ga_event('add-new-port', 'click advanced');
        props.save_clicked();
    };
    return (
        <div>
          <button onClick={advanced_clicked}
            className="btn btn_lpm_default btn_lpm options">
            Advanced options</button>
          <button onClick={save_clicked} className="btn btn_lpm save">
            Save</button>
        </div>
    );
};

export default Add_proxy;
