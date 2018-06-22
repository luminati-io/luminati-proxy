// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true, es6:true*/
import Pure_component from '../../www/util/pub/pure_component.js';
import React from 'react';
import {Labeled_controller, Nav, Loader, Loader_small} from './common.js';
import setdb from '../../util/setdb.js';
import ajax from '../../util/ajax.js';

export default class Settings extends Pure_component {
    render(){
        return <div className="settings">
              <Nav title="General settings"
                subtitle="Global configuration of Luminati Proxy Manager"/>
              <Form/>
            </div>;
    }
}

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
    };
    componentDidMount(){
        this.setdb_on('head.settings', settings=>{
            if (settings && !this.state.settings)
                this.setState({settings});
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
    save = ()=>{
        this.setState({saving: true});
        const _this = this;
        this.etask(function*(){
            this.on('uncaught', e=>{
                console.log(e);
                _this.setState({saving: false});
            });
            // XXX krzysztof: switch fetch->ajax
            const raw = yield window.fetch('/api/settings', {
                method: 'PUT',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(_this.state.settings),
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
              <Loader_small show={this.state.saving}/>
            </div>;
    }
}
