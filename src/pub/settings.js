// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true, es6:true*/
import Pure_component from '/www/util/pub/pure_component.js';
import React from 'react';
import {Labeled_controller, Loader_small} from './common.js';
import setdb from '../../util/setdb.js';
import ajax from '../../util/ajax.js';
import etask from '../../util/etask.js';
import {report_exception} from './util.js';
import _ from 'lodash';
import $ from 'jquery';
import {Select_zone, Pins} from './common/controls.js';
import Warnings_modal from './common/warnings_modal.js';
import {Back_btn} from './proxy_edit/index.js';
import './css/settings.less';

export default function Settings(props){
    const btn_click = ()=>props.history.push({pathname: '/overview'});
    return <div className="settings">
          <div className="cp_panel">
            <div className="cp_panel_header">
              <Back_btn click={btn_click}/>
              <h2>General settings</h2>
            </div>
            <Form/>
          </div>
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
    debug: `Default value for luminati request details like response timeline
        or peer IP that was used to send a final request`,
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
    sync_config: `All changes on Proxy Manager instances with enabled config
        synchronization will be propagated and applied immediately.`,
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
    default_debug_opts = [
        {key: 'No', value: 'none'},
        {key: 'Yes', value: 'full'}
    ];
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
    on_change_handler = (field, opt)=>val=>{
        opt = opt||{};
        const {settings, pending_settings} = this.state;
        let value = val;
        if (field=='whitelist_ips')
            value = val.filter(ip=>!settings.fixed_whitelist_ips.includes(ip));
        if (opt.number)
            value = +value;
        this.setState({
            settings: {...settings, [field]: value},
            pending_settings: {...pending_settings, [field]: value},
        }, this.debounced_save);
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
            const body = {..._this.state.pending_settings};
            _this.setState({pending_settings: {}});
            const save_res = yield _this.save_settings(body);
            if (save_res.err)
            {
                return _this.setState({api_error: [{msg: save_res.err}]}, ()=>
                    $('#upd_settings_error').modal('show'));
            }
            etask(function*(){
                const defaults = yield ajax.json({url: '/api/defaults'});
                setdb.set('head.defaults', defaults);
            });
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
        const logs_data = s.zagent ? [0, 1000] : [0, 100, 1000, 10000];
        const har_limit_data = s.zagent ? har_limit_options.filter(({value})=>
            [-1, 1024].includes(value)) : har_limit_options;
        return <div className="settings_form">
          <Warnings_modal
            id='upd_settings_error'
            warnings={this.state.api_error}
          />
          <Labeled_controller label="Default zone" tooltip={tooltips.zone}>
            <Select_zone
              val={s.zone}
              preview
              on_change_wrapper={this.on_change_handler('zone')}
            />
          </Labeled_controller>
          <Labeled_controller
            label="Admin whitelisted IPs"
            faq_id="pmgr-whitelist-ui"
            tooltip={tooltips.www_whitelist_ips}>
            <Pins
              val={s.www_whitelist_ips}
              pending={s.pending_www_ips}
              no_any={s.zagent}
              on_change_wrapper={this.on_change_handler('www_whitelist_ips')}
            />
          </Labeled_controller>
          <Labeled_controller
            type="pins"
            faq_id="pmgr-whitelist-proxy"
            label="Proxy whitelisted IPs"
            tooltip={tooltips.whitelist_ips}>
            <Pins
              val={wl}
              pending={s.pending_ips}
              no_any={s.zagent}
              disabled_ips={s.fixed_whitelist_ips}
              on_change_wrapper={this.on_change_handler('whitelist_ips')}
            />
          </Labeled_controller>
          {!s.zagent &&
            <Labeled_controller
              val={s.request_stats}
              type="yes_no"
              on_change_wrapper={this.on_change_handler('request_stats')}
              label="Enable recent stats"
              default={true}
              tooltip={tooltips.request_stats}
            />
          }
          <Labeled_controller
            val={s.logs}
            type="select_number"
            on_change_wrapper={this.on_change_handler('logs', {number: 1})}
            data={logs_data}
            label="Limit for request logs"
            default tooltip={tooltips.logs}
          />
          <Labeled_controller
            val={s.har_limit}
            type="select_number"
            on_change_wrapper={this.on_change_handler('har_limit',
                {number: 1})}
            data={har_limit_data}
            label="Response limit to save"
            default={1024}
            tooltip={tooltips.har_limit}
          />
          <Labeled_controller
            val={s.debug}
            type="select"
            on_change_wrapper={this.on_change_handler('debug')}
            data={this.default_debug_opts}
            label="Default requests details"
            tooltip={tooltips.debug}
          />
          <Labeled_controller
            val={s.log}
            type="select"
            on_change_wrapper={this.on_change_handler('log')}
            data={this.log_level_opts}
            disabled={s.zagent}
            label="Log level / API logs"
            tooltip={tooltips.log_level}
            faq_id="pmgr-logging"
          />
          <Labeled_controller
            val={s.sync_config}
            type="yes_no"
            on_change_wrapper={this.on_change_handler('sync_config')}
            label="Sync configuration"
            default={!!s.zagent}
            tooltip={tooltips.sync_config}
            disabled={s.zagent}
            faq_id="pmgr-sync-config"
          />
          <Loader_small show={this.state.saving}/>
        </div>;
    }
}
