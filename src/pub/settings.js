// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true, es6:true*/
import Pure_component from '../../www/util/pub/pure_component.js';
import React from 'react';
import {Labeled_controller, Nav, Loader, Loader_small, Select, Tooltip,
    Select_number} from './common.js';
import setdb from '../../util/setdb.js';
import ajax from '../../util/ajax.js';
import {ga_event} from './util.js';
import _ from 'lodash';

export default function Settings(){
    return <div className="settings">
          <Nav title="General settings"
            subtitle="Global configuration of Luminati Proxy Manager"/>
          <Form/>
        </div>;
}

class Form extends Pure_component {
    state = {saving: false};
    tooltips = {
        zone: `Default zone will be used automatically when creating a new
            port, if you don't specify any specific zone. This value can be
            overriden in each proxy port settings`,
        www_whitelist_ips: `List of IPs that are allowed to access web UI
            (including all API endpoints at http://localhost:22999/api) and
            make changes. can also include ranges of ips like so 0.0.0.0/0.
            Default value is 127.0.0.1, which means that remote access from
            any other IP is blocked unless list of IPs are added in this
            field.`,
        whitelist_ips: `Default access grant for all proxies. Only those
            IPs will be able to send requests to all proxies by default. Can
            be changed per proxy`,
        request_stats: `Enable saving statistics to database`,
        logs_type: `Specify how many requests you want to keep in database. The
            limit may be set as a number or maximum database size. Set to 0 to
            disable saving logs to database`,
    };
    logs_metric_opts = [
        {key: 'requests', value: 'requests'},
        {key: 'megabytes', value: 'megabytes'},
    ];
    componentDidMount(){
        this.setdb_on('head.settings', settings=>{
            if (!settings||this.state.settings)
                return;
            const s = {...settings};
            s.www_whitelist_ips = s.www_whitelist_ips&&
                s.www_whitelist_ips.join(',')||'';
            s.whitelist_ips = s.whitelist_ips&&
                s.whitelist_ips.join(',')||'';
            s.logs_metric = s.logs.metric;
            s.logs_value = s.logs.value;
            this.setState({settings: s});
        });
        this.setdb_on('head.consts', consts=>{
            if (consts)
                this.setState({consts});
        });
    }
    zone_change = val=>{
        ga_event('settings', 'change_field', 'zone');
        this.setState(prev=>({settings: {...prev.settings, zone: val}}),
            this.debounced_save);
    };
    whitelist_ips_change = val=>{
        ga_event('settings', 'change_field', 'whitelist_ips');
        this.setState(
            prev=>({settings: {...prev.settings, whitelist_ips: val}}),
            this.debounced_save);
    };
    www_whitelist_ips_change = val=>{
        ga_event('settings', 'change_field', 'www_whitelist_ips');
        this.setState(
            prev=>({settings: {...prev.settings, www_whitelist_ips: val}}),
            this.debounced_save);
    };
    logs_metric_changed = val=>{
        ga_event('settings', 'change_field', 'logs_metric');
        this.setState(prev=>({settings: {
            ...prev.settings,
            logs_metric: val,
            logs_value: 1000,
        }}), this.debounced_save);
    };
    logs_value_changed = val=>{
        ga_event('settings', 'change_field', 'logs_value');
        this.setState(prev=>({settings: {...prev.settings, logs_value: +val}}),
            this.debounced_save);
    };
    request_stats_changed = val=>{
        ga_event('settings', 'change_field', 'request_stats');
        this.setState(
            prev=>({settings: {...prev.settings, request_stats: val}}),
            this.debounced_save);
    };
    lock_nav = lock=>setdb.set('head.lock_navigation', lock);
    save = ()=>{
        if (this.saving)
        {
            this.resave = true;
            return;
        }
        ga_event('settings', 'save', 'start');
        this.lock_nav(true);
        this.setState({saving: true});
        this.saving = true;
        const _this = this;
        this.etask(function*(){
            this.on('uncaught', e=>{
                console.log(e);
                ga_event('settings', 'save', 'failed');
            });
            this.on('finally', ()=>{
                _this.setState({saving: false});
                _this.saving = false;
                _this.lock_nav(false);
                ga_event('settings', 'save', 'successful');
                if (_this.resave)
                {
                    _this.resave = false;
                    _this.save();
                }
            });
            const body = {..._this.state.settings};
            body.logs = {metric: body.logs_metric, value: body.logs_value};
            const raw = yield window.fetch('/api/settings', {
                method: 'PUT',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(body),
            });
            const settings = yield raw.json();
            setdb.set('head.settings', settings);
            const zones = yield ajax.json({url: '/api/zones'});
            setdb.set('head.zones', zones);
        });
    };
    debounced_save = _.debounce(this.save, 500);
    render(){
        if (!this.state.settings)
            return null;
        // XXX krzysztof: clean up zones logic
        const zone_opt = this.state.consts && this.state.consts.proxy.zone
        .values.filter(z=>{
            const plan = z.plans && z.plans.slice(-1)[0] || {};
            return !plan.archive && !plan.disable;
        }).map(z=>z.value).filter(Boolean).map(z=>({key: z, value: z}));
        const note = this.state.settings.logs_value ?
            'Set to 0 to disable logs entirely' : 'Logs are disabled';
        return <div className="settings_form">
              <Loader show={!this.state.consts}/>
              <Labeled_controller val={this.state.settings.zone} type="select"
                on_change_wrapper={this.zone_change} label="Default zone"
                tooltip={this.tooltips.zone} data={zone_opt}/>
              <Labeled_controller val={this.state.settings.www_whitelist_ips}
                type="pins" label="Admin whitelisted IPs"
                on_change_wrapper={this.www_whitelist_ips_change}
                tooltip={this.tooltips.www_whitelist_ips}/>
              <Labeled_controller val={this.state.settings.whitelist_ips}
                type="pins" label="Proxy whitelisted IPs"
                on_change_wrapper={this.whitelist_ips_change}
                tooltip={this.tooltips.whitelist_ips}/>
              <Labeled_controller val={this.state.settings.request_stats}
                type="yes_no" on_change_wrapper={this.request_stats_changed}
                label="Enable recent stats" default
                tooltip={this.tooltips.request_stats}/>
              <div className="field_row">
                <div className="desc">
                  <Tooltip title={this.tooltips.logs_type}>
                    Enable logs for</Tooltip>
                </div>
                <div className="field">
                  <div className="inline_field">
                    <div className="double_field">
                      <Select_number val={this.state.settings.logs_value}
                        data={[0, 100, 1000, 10000]}
                        on_change_wrapper={this.logs_value_changed}/>
                      <Select val={this.state.settings.logs_metric}
                        on_change_wrapper={this.logs_metric_changed}
                        data={this.logs_metric_opts}/>
                    </div>
                    <div className="note">
                      <strong>Note: </strong>
                      {note}
                    </div>
                  </div>
                </div>
              </div>
              <Loader_small show={this.state.saving}/>
            </div>;
    }
}
