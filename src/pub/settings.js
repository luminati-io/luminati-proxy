// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true, es6:true*/
import Pure_component from '/www/util/pub/pure_component.js';
import React from 'react';
import {Labeled_controller, Nav, Loader_small} from './common.js';
import setdb from '../../util/setdb.js';
import ajax from '../../util/ajax.js';
import {report_exception} from './util.js';
import _ from 'lodash';
import {Select_zone, Pins} from './common/controls.js';
import './css/settings.less';

export default function Settings(){
    return <div className="settings">
          <Nav title="General settings"
            subtitle="Global configuration of Luminati Proxy Manager"/>
          <Form/>
        </div>;
}

const tooltips = {
    zone: `Default zone will be used automatically when creating a new
        port, if you don't specify any specific zone. This value can be
        overridden in each proxy port settings`,
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
    logs: `Specify how many requests you want to keep in database. The
        limit may be set as a number or maximum database size.`,
    har_limit: `Define the limit for the size of the response body to save in
        the logs`,
    log_level: `Define how much log you want to see in the terminal</br>
        <ul>
          <li><strong>error: </strong>only error messages</li>
          <li><strong>warn: </strong>all the above and warnings, potential
            unsuccessful operations</li>
          <li><strong>notice: </strong>all the above and the essential
            notifications like creating proxy ports, refreshing sessions</li>
          <li><strong>info: </strong>all the above and proxy requests, API
            calls</li>
          <li><strong>debug: </strong>all the above and debug info</li>
        </ul>`,
    sync_config: `All changes on LPMs with enabled config synchronization
        will be propagated and applied immediately.`,
};
for (let f in tooltips)
    tooltips[f] = tooltips[f].replace(/\s+/g, ' ').replace(/\n/g, ' ');

let har_limit_options = [
    {value: -1, label: 'Disabled'},
    {value: 1024, label: '1Kb (default)'},
    {value: 100*1024, label: '100Kb'},
    {value: 0, label: 'Unlimited'},
];

class Form extends Pure_component {
    state = {saving: false};
    logs_metric_opts = [
        {key: 'requests', value: 'requests'},
        {key: 'megabytes', value: 'megabytes'},
    ];
    log_level_opts = ['error', 'warn', 'notice', 'info', 'debug'];
    componentDidMount(){
        this.setdb_on('head.settings', settings=>{
            if (!settings)
                return;
            this.setState({settings: {...settings}});
        });
        this.setdb_on('head.save_settings', save_settings=>{
            this.save_settings = save_settings;
            if (save_settings && this.resave)
            {
                delete this.resave;
                this.save();
            }
        });
    }
    zone_change = val=>{
        this.setState(prev=>({settings: {...prev.settings, zone: val}}),
            this.debounced_save);
    };
    whitelist_ips_change = val=>{
        this.setState(
            ({settings})=>{
                const whitelist_ips = val.filter(
                    ip=>!settings.fixed_whitelist_ips.includes(ip));
                return {settings: {...settings, whitelist_ips}};
            },
            this.debounced_save);
    };
    www_whitelist_ips_change = val=>{
        this.setState(
            prev=>({settings: {...prev.settings, www_whitelist_ips: val}}),
            this.debounced_save);
    };
    logs_changed = val=>{
        this.setState(prev=>({settings: {...prev.settings, logs: +val}}),
            this.debounced_save);
    };
    har_limit_changed = val=>{
        this.setState(prev=>({settings: {...prev.settings, har_limit: +val}}),
            this.debounced_save);
    };
    log_level_changed = val=>{
        this.setState(prev=>({settings: {...prev.settings, log: val}}),
            this.debounced_save);
    };
    request_stats_changed = val=>{
        this.setState(
            prev=>({settings: {...prev.settings, request_stats: val}}),
            this.debounced_save);
    };
    sync_config_changed = val=>{
        this.setState(prev=>({settings: {...prev.settings, sync_config: val}}),
            this.debounced_save);
    };
    lock_nav = lock=>setdb.set('head.lock_navigation', lock);
    save = ()=>{
        if (this.saving || !this.save_settings)
        {
            this.resave = true;
            return;
        }
        this.lock_nav(true);
        this.setState({saving: true});
        this.saving = true;
        const _this = this;
        this.etask(function*(){
            this.on('uncaught', e=>_this.etask(function*(){
                yield report_exception(e, 'settings.Form.save');
            }));
            this.on('finally', ()=>{
                _this.setState({saving: false});
                _this.saving = false;
                _this.lock_nav(false);
                if (_this.resave)
                {
                    delete _this.resave;
                    _this.save();
                }
            });
            const body = {..._this.state.settings};
            yield _this.save_settings(body);
            const zones = yield ajax.json({url: '/api/zones'});
            setdb.set('ws.zones', zones);
            if (_this.state.settings.sync_config)
            {
                const proxies = yield ajax.json({url: '/api/proxies_running'});
                setdb.set('head.proxies_running', proxies);
            }
        });
    };
    debounced_save = _.debounce(this.save, 500);
    render(){
        const s = this.state.settings;
        if (!s)
            return null;
        const wl = s.fixed_whitelist_ips.concat(s.whitelist_ips);
        return <div className="settings_form">
              <Labeled_controller label="Default zone" tooltip={tooltips.zone}>
                <Select_zone val={s.zone} preview
                  on_change_wrapper={this.zone_change}/>
              </Labeled_controller>
              <Labeled_controller label="Admin whitelisted IPs"
                tooltip={tooltips.www_whitelist_ips}>
                <Pins val={s.www_whitelist_ips} pending={s.pending_www_ips}
                  on_change_wrapper={this.www_whitelist_ips_change}/>
              </Labeled_controller>
              <Labeled_controller type="pins" label="Proxy whitelisted IPs"
                tooltip={tooltips.whitelist_ips}>
                <Pins val={wl} pending={s.pending_ips}
                  disabled_ips={s.fixed_whitelist_ips}
                  on_change_wrapper={this.whitelist_ips_change}/>
              </Labeled_controller>
              <Labeled_controller val={s.request_stats}
                type="yes_no" on_change_wrapper={this.request_stats_changed}
                label="Enable recent stats" default={true}
                tooltip={tooltips.request_stats}/>
              <Labeled_controller val={s.logs}
                type="select_number" on_change_wrapper={this.logs_changed}
                data={[0, 100, 1000, 10000]}
                label="Limit for request logs" default
                tooltip={tooltips.logs}/>
              <Labeled_controller
                val={s.har_limit}
                type="select_number"
                on_change_wrapper={this.har_limit_changed}
                data={har_limit_options}
                disabled={s.zagent}
                label="Response limit to save"
                default={1024}
                tooltip={tooltips.har_limit}/>
              <Labeled_controller
                val={s.log}
                type="select"
                on_change_wrapper={this.log_level_changed}
                data={this.log_level_opts}
                disabled={s.zagent}
                label="Log level / API logs"
                tooltip={tooltips.log_level}/>
              <Labeled_controller val={s.sync_config}
                type="yes_no" on_change_wrapper={this.sync_config_changed}
                label="Sync configuration" default={false}
                tooltip={tooltips.sync_config} disabled={s.zagent}/>
              <Loader_small show={this.state.saving}/>
            </div>;
    }
}
