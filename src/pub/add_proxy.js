// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true, es6:true*/
import regeneratorRuntime from 'regenerator-runtime';
import etask from 'hutil/util/etask';
import ajax from 'hutil/util/ajax';
import React from 'react';
import $ from 'jquery';
import classnames from 'classnames';
import {If, Modal, Loader, onboarding_steps, presets} from './common.js';
import util from './util.js';

const ga_event = util.ga_event;

class Add_proxy extends React.Component {
    constructor(props){
        super(props);
        this.sp = etask('Add_proxy', function*(){ yield this.wait(); });
        this.zones = props.extra.consts.proxy.zone.values;
        this.presets_opt = Object.keys(presets).map(p=>
            ({key: presets[p].title, value: p}));
        this.state = {zone: '', preset: 'sequential', show_loader: false};
    }
    persist(){
        const preset = this.state.preset;
        const form = {
            last_preset_applied: preset,
            zone: this.state.zone||this.props.extra.consts.proxy.zone.def,
            proxy_type:'persist',
            max_requests:0,
            session_duration: 0,
            ips: [],
            vips: [],
            whitelist_ips: [],
        };
        const zone = this.zones.filter(z=>z.key==form.zone)[0]||{};
        form.password = zone.password;
        presets[preset].set(form);
        this.setState({show_loader: true});
        const _this = this;
        return etask(function*(){
            this.on('uncaught', e=>{
                console.log(e);
                ga_event('add-new-port', 'failed saved');
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
        this.sp.spawn(etask(function*(){
            const port = yield _this.persist();
            $('#add_proxy_modal').modal('hide');
            if (opt.redirect)
            {
                let url = '/proxy/'+port;
                if (opt.field)
                    url+='?field='+opt.field;
                window.location.href=url;
            }
            else if (window.location.pathname=='/intro')
            {
                const curr_step = JSON.parse(window.localStorage.getItem(
                    'quickstart-step'));
                window.localStorage.setItem('quickstart-first-proxy', port);
                // XXX krzysztof: temporary hack; remove when zstore
                if (curr_step==onboarding_steps.ADD_PROXY);
                    window.set_step(onboarding_steps.ADD_PROXY_DONE);
                return;
            }
            else
                window.location.href='/proxies';
        }));
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
        return (
            <div className="lpm">
              <Loader show={this.state.show_loader}/>
              <Modal id="add_proxy_modal" title="Add new proxy"
                footer={Footer_wrapper} className="add_proxy_modal">
                <div className="section">
                  <Field icon_class="zone_icon" val={this.state.zone}
                    options={this.zones} title="Choose Zone"
                    on_change={this.field_changed('zone').bind(this)}/>
                </div>
                <div className="section">
                  <Field icon_class="preset_icon" val={this.state.preset}
                    options={this.presets_opt}
                    title="Select preset configuration"
                    on_change={this.field_changed('preset').bind(this)}/>
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
                </div>
              </Modal>
            </div>
        );
    }
}

const Field = props=>(
    <div>
      <div className={classnames('icon', props.icon_class)}/>
      <h4>{props.title}</h4>
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
