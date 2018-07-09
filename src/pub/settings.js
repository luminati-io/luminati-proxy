// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true, es6:true*/
import Pure_component from '../../www/util/pub/pure_component.js';
import React from 'react';
import {Labeled_controller, Nav, Loader, Loader_small} from './common.js';
import setdb from '../../util/setdb.js';
import ajax from '../../util/ajax.js';
import {Netmask} from 'netmask';

export default class Settings extends Pure_component {
    render(){
        return <div className="settings">
              <Nav title="General settings"
                subtitle="Global configuration of Luminati Proxy Manager"/>
              <Form/>
            </div>;
    }
}

// XXX krzysztof: merge with validators in proxy_edit
const normalizers = {
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

class Form extends Pure_component {
    state = {saving: false};
    logs_opt = [
        {key: 'No', value: false},
        {key: 'Default (No)', value: ''},
        {key: 'Yes', value: true},
    ];
    tooltips = {
        logs: `Last 1K requests are automatically logged for easy debugging.
            Enable Logs to save all requests`,
        zone: `Default zone will be used automatically if you don't specify
            any specific zone. This value can be overriden in each proxy port
            settings`,
        whitelist_ips: `List of IPs that are allowed to access web UI
            (including all API endpoints at http://localhost:22999/api) and
            make changes. can also include ranges of ips like so 0.0.0.0/0.
            Default value is 127.0.0.1, which means that remote access from
            any other IP is blocked unless list of IPs are added in this
            field.`,
    };
    componentDidMount(){
        this.setdb_on('head.settings', settings=>{
            if (!settings||this.state.settings)
                return;
            const s = {...settings};
            s.www_whitelist_ips = s.www_whitelist_ips&&
                s.www_whitelist_ips.join(',')||'';
            this.setState({settings: s});
        });
        this.setdb_on('head.consts', consts=>{
            if (consts)
                this.setState({consts});
        });
    }
    zone_change = val=>{
        this.setState(prev=>({settings: {...prev.settings, zone: val}}),
            this.save);
    };
    logs_change = val=>{
        this.setState(prev=>({settings: {...prev.settings, logs: val}}),
            this.save);
    };
    whitelist_ips_change = val=>{
        this.setState(prev=>({
            settings: {...prev.settings, www_whitelist_ips: val}}));
    };
    whitelist_ips_blur = ({target: {value}})=>{
        const val = normalizers.ips_list(value);
        this.setState(prev=>({
            settings: {...prev.settings, www_whitelist_ips: val}}), this.save);
    };
    save = ()=>{
        this.setState({saving: true});
        const _this = this;
        this.etask(function*(){
            this.on('uncaught', e=>{
                console.log(e);
                _this.setState({saving: false});
            });
            const body = {..._this.state.settings};
            // XXX krzysztof: switch fetch->ajax
            const raw = yield window.fetch('/api/settings', {
                method: 'PUT',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(body),
            });
            const settings = yield raw.json();
            setdb.set('head.settings', settings);
            const zones = yield ajax.json({url: '/api/zones'});
            setdb.set('head.zones', zones);
            _this.setState({saving: false});
        });
    };
    render(){
        if (!this.state.settings)
            return null;
        // XXX krzysztof: clean up zones logic
        const zone_opt = this.state.consts && this.state.consts.proxy.zone
            .values.filter(z=>{
                const plan = z.plans && z.plans.slice(-1)[0] || {};
                return !plan.archive && !plan.disable;
            }).map(z=>z.value).filter(Boolean).map(z=>({key: z, value: z}));
        return <div className="settings_form">
              <Loader show={!this.state.consts}/>
              <Labeled_controller val={this.state.settings.zone} type="select"
                on_change_wrapper={this.zone_change} label="Default zone"
                tooltip={this.tooltips.zone} data={zone_opt}/>
              <Labeled_controller val={this.state.settings.logs} type="select"
                data={this.logs_opt} on_change_wrapper={this.logs_change}
                label="Enable logs" tooltip={this.tooltips.logs}/>
              <Labeled_controller val={this.state.settings.www_whitelist_ips}
                type="text" on_change_wrapper={this.whitelist_ips_change}
                label="Admin whitelisted IPs"
                placeholder="e.g. 1.1.1.1, 2.2.2.2"
                on_blur={this.whitelist_ips_blur}
                tooltip={this.tooltips.whitelist_ips}/>
              <Loader_small show={this.state.saving}/>
            </div>;
    }
}
