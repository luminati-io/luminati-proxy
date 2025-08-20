// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true, es6:true*/
import Pure_component from '/www/util/pub/pure_component.js';
import React, {useState} from 'react';
import {Labeled_controller, Loader_small, Alert} from './common.js';
import setdb from '../../util/setdb.js';
import zurl from '../../util/url.js';
import {report_exception} from './util.js';
import _ from 'lodash4';
import $ from 'jquery';
import {Select_zone, Pins} from './common/controls.js';
import Warnings_modal from './common/warnings_modal.js';
import {Modal} from './common/modals.js';
import Logs_settings_modal from './common/logs_settings_modal.js';
import {Back_btn} from './proxy_edit/index.js';
import {tips} from './proxy_edit/fields.js';
import './css/settings.less';
import {T} from './common/i18n.js';
import {main as Api} from './api.js';

export default function Settings(props){
    const [show_alert, set_show_alert] = useState(false);
    const [show_conf, set_show_conf] = useState(false);
    const back_func = ()=>props.history.push({pathname: '/overview'});
    const btn_click = ()=>show_conf ? $('#settings_confirmation_modal')
        .modal('show') : back_func();
    return <div className="settings vbox">
          <div className="cp_panel vbox">
            <div className="cp_panel_header">
              {!props.zagent && <Back_btn click={btn_click}/>}
              <h2><T>General settings</T></h2>
            </div>
            <Form show_alert={set_show_alert}
              show_conf={set_show_conf}/>
          </div>
          {show_alert &&
            <Alert
              variant="success"
              dismissible
              text="Settings changes saved"
              on_close={()=>set_show_alert(false)}
            />
          }
          <Modal
            id="settings_confirmation_modal"
            title="You have unsaved settings changes"
            ok_btn_title="Yes"
            click_ok={back_func}>
            <h4>Are you sure you want to exit?</h4>
          </Modal>
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
    debug: `Default value for Bright Data request details like response
        timeline or peer IP that was used to send a final request`,
    lpm_auth: 'Default value for "Set x-lpm-authorization header" setting',
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
    bw_limit_webhook_url: `URL to send webhook messages to when BW limit is
        reached`,
    bw_th_webhook_url: `URL to send webhook messages to when BW limit threshold
        is reached`,
    socket_inactivity_timeout: 'The amount of milliseconds a socket can be'
        +' inactive before it times out and closes',
};

for (let f in tooltips)
    tooltips[f] = tooltips[f].replace(/\s+/g, ' ').replace(/\n/g, ' ');

let har_limit_options = [
    {value: -1, label: 'Disabled'},
    {value: 1024, label: '1Kb (default)'},
    {value: 100*1024, label: '100Kb'},
    {value: 0, label: 'Unlimited'},
];

let socket_timeout_options = [
  {value: 120000, label: 'Default'},
  {value: 240000, label: '240000'},
  {value: 480000, label: '480000'},
];

class Form extends Pure_component {
    state = {saving: false, form: {}, pending_settings: {}};
    logs_metric_opts = [
        {key: 'requests', value: 'requests'},
        {key: 'megabytes', value: 'megabytes'},
    ];
    log_level_opts = ['error', 'warn', 'notice', 'info', 'debug'];
    default_yes_no_select_opts = [
        {key: 'No', value: 'none'},
        {key: 'Yes', value: 'full'}
    ];
    componentDidMount(){
        this.setdb_on('head.settings', settings=>{
            if (!settings)
                return;
            const c_settings = _.cloneDeep(settings);
            const res_settings = {...c_settings,
                ...this.state.pending_settings};
            this.setState({
                settings: res_settings, default_settings: c_settings,
                is_changed: !_.isEqual(c_settings, res_settings)});
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
    prepare_change = ({field, value, opt})=>{
      opt = opt||{};
      const {settings} = this.state;
      let val = value;
      if (field=='whitelist_ips')
          val = value.filter(ip=>!settings.fixed_whitelist_ips.includes(ip));
      if (opt.number)
          val = +val;
      return {field, value: val};
    };
    apply_changes = changes=>{
        const {settings, pending_settings, default_settings} = this.state;
        let changes_obj = changes.reduce((acc, ch)=>Object.assign(acc,
          {[ch.field]: ch.value}), {});
        const c_settings = {...settings, ...changes_obj};
        const is_changed = !_.isEqual(default_settings, c_settings);
        this.setState({
            settings: c_settings,
            pending_settings: {...pending_settings, ...changes_obj},
            is_changed
        });
        this.props.show_conf(is_changed);
    };
    on_change_handler = (field, opt)=>value=>
        this.on_multi_change_handler([{field, opt, value}]);
    on_multi_change_handler = changes=>
        this.apply_changes(changes.map(this.prepare_change));
    remote_logs_enabled = ()=>this.state.settings
        && this.state.settings.logs_settings
        && this.state.settings.logs_settings.type;
    logs_enabled = ()=>this.state.settings.logs || this.remote_logs_enabled();
    toggle_logs = ()=>{
      let settings = [
        {field: 'logs', value: 0, opt: {number: 1}},
        {field: 'logs_settings', value: {}},
      ];
      if (this.logs_enabled())
          return this.apply_changes(settings.map(this.prepare_change));
      settings[0].value = 1000;
      this.apply_changes(settings.map(this.prepare_change));
    };
    lock_nav = lock=>setdb.set('head.lock_navigation', lock);
    urls_valid = ()=>{
        const {bw_limit_webhook_url: limit_url,
            bw_th_webhook_url: th_url} = this.state.pending_settings;
        for (const url of [limit_url, th_url].filter(Boolean))
        {
            if (zurl.is_valid_url(url))
                continue;
            this.setState({error: [{msg: 'Invalid webhook url'}]},
                ()=>$('#upd_settings_error').modal('show'));
            return false;
        }
        return true;
    };
    save = ()=>{
        if (!this.urls_valid())
            return;
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
            let {err} = yield _this.save_settings(body);
            if (err)
            {
                err = Array.isArray(err) ? err : [err];
                return _this.setState({error: err.map(msg=>({msg}))}, ()=>
                    $('#upd_settings_error').modal('show'));
            }
            _this.setState({is_changed: false, pending_settings: {},
                default_settings: _this.state.settings});
            _this.props.show_alert(true);
            _this.props.show_conf(false);
            if (_this.state.settings.sync_config)
            {
                const proxies = yield Api.json.get('proxies_running');
                setdb.set('head.proxies_running', proxies);
            }
        });
    };
    open_logs_settings_modal = ()=>$('#logs_settings_modal').modal('show');
    debounced_save = _.debounce(this.save, 500);
    render(){
        const s = this.state.settings;
        if (!s)
            return null;
        const wl = s.fixed_whitelist_ips.concat(s.whitelist_ips);
        const logs_data = s.zagent ? [0, 1000] : [0, 100, 1000, 10000];
        const har_limit_data = s.zagent ? har_limit_options.filter(({value})=>
            [-1, 1024].includes(value)) : har_limit_options;
        const note_logs = this.logs_enabled() ?
            <a className="link" onClick={this.open_logs_settings_modal}>
                <T>Logs settings</T>
            </a> : null;
        return <div className="settings_form">
          <Warnings_modal
            id='upd_settings_error'
            warnings={this.state.error}
          />
          {this.logs_enabled() &&
              <Logs_settings_modal
                  tooltip={tooltips.logs}
                  logs_data={logs_data}
                  logs_disabled_num={logs_data[0]||0}
                  logs_enabled_num={logs_data[1]||1000}
                  settings={s.logs_settings}
                  on_save={this.on_multi_change_handler}
                  remote_enabled={this.remote_logs_enabled()}
              />
          }
          <Labeled_controller label="Default zone" tooltip={tooltips.zone}>
            <Select_zone
              val={s.zone}
              preview
              on_change_wrapper={this.on_change_handler('zone')}
            />
          </Labeled_controller>
          <Labeled_controller
            label="Admin whitelisted IPs"
            faq={{anchor: 'whitelisted_ips'}}
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
            faq={{anchor: 'whitelisted_ips'}}
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
          {!s.zagent && <Labeled_controller
            val={s.logs}
            type="select_number"
            on_change_wrapper={this.on_change_handler('logs', {number: 1})}
            data={logs_data}
            label="Limit for request logs"
            default tooltip={tooltips.logs}
          />}
          {s.zagent && <Labeled_controller
            val={this.logs_enabled()}
            type="yes_no"
            on_change_wrapper={this.toggle_logs}
            label="Enable request logs"
            default tooltip={tooltips.logs}
            note={note_logs}
          />}
          <Labeled_controller
            val={s.socket_inactivity_timeout}
            type="select_number"
            on_change_wrapper={this.on_change_handler(
                'socket_inactivity_timeout', {number: 1})}
            data={socket_timeout_options}
            label="Inactivity timeout"
            default={120000}
            tooltip={tooltips.socket_inactivity_timeout}
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
            faq={{anchor: 'request_details'}}
            on_change_wrapper={this.on_change_handler('debug')}
            data={this.default_yes_no_select_opts}
            label="Default requests details"
            tooltip={tooltips.debug}
          />
          <Labeled_controller
            val={s.lpm_auth}
            type="select"
            on_change_wrapper={this.on_change_handler('lpm_auth')}
            data={this.default_yes_no_select_opts}
            label="Default LPM auth. header"
            tooltip={tooltips.lpm_auth}
          />
          {!s.zagent && <Labeled_controller
            val={s.log}
            type="select"
            on_change_wrapper={this.on_change_handler('log')}
            data={this.log_level_opts}
            label="Log level / API logs"
            tooltip={tooltips.log_level}
            faq={{article: '13596408374417', anchor: 'gathering_logs'}}
          />}
          <Labeled_controller
            val={s.sync_config}
            type="yes_no"
            on_change_wrapper={this.on_change_handler('sync_config')}
            label="Sync configuration"
            default={!!s.zagent}
            tooltip={tooltips.sync_config}
            disabled={s.zagent}
            faq={{anchor: 'sync_configuration'}}
          />
          {s.zagent && <Labeled_controller
            val={s.bw_limit_webhook_url || ''}
            allow_empty_url
            allow_bad_url_change
            type="url"
            on_change_wrapper={this.on_change_handler('bw_limit_webhook_url')}
            label="BW limit webhook URL"
            tooltip={tooltips.bw_limit_webhook_url}
          />}
          {s.zagent && <Labeled_controller
            val={s.bw_th_webhook_url || ''}
            allow_empty_url
            allow_bad_url_change
            type="url"
            on_change_wrapper={this.on_change_handler('bw_th_webhook_url')}
            label="BW threshold webhook URL"
            tooltip={tooltips.bw_th_webhook_url}
          />}
          <Loader_small show={this.state.saving}/>
          <button className="btn btn_lpm btn_lpm_primary fit"
            onClick={()=>$('#save_settings_confirmation_modal').modal('show')}
            disabled={!this.state.is_changed || this.state.saving}>
            <T>Save changes</T>
          </button>
          <Modal
            id="save_settings_confirmation_modal"
            title="Accept save changes"
            ok_btn_title="Yes"
            click_ok={this.save}>
            {s.sync_config && !s.zagent && <span>
              {tips.sync_config_warn}
            </span>}
          </Modal>
        </div>;
    }
}
