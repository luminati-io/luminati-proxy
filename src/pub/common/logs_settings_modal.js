// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true, es6:true*/
import React from 'react';
import $ from 'jquery';
import Pure_component from '/www/util/pub/pure_component.js';
import etask from '../../../util/etask.js';
import {Labeled_controller, Warning} from '../common.js';
import {main as Api} from '../api.js';
import {Nav_tabs, Nav_tab} from '../common/nav_tabs.js';
import {Modal} from './modals.js';
import Tooltip from './tooltip.js';
import {Input, Yes_no} from './controls.js';
import {T} from './i18n.js';
const {entries, assign} = Object;
const remote_field = 'logs_settings';

const Custom_tab = ({set, settings, test, t})=>{
    const {url, username, password, use_ssl} = settings;
    const ssl_disabled = !username || !password;
    if (ssl_disabled && use_ssl)
        set('use_ssl')(false);
    return <React.Fragment>
        <div className="inputs_container">
            <Tooltip title={t('Logs aggregator url')}>
                <div className="aggr_url">
                    <Input val={url} type="string" placeholder={t('URL')}
                    on_change_wrapper={set('url')}/>
                </div>
            </Tooltip>
            <Tooltip title={t('Test aggregator url')}>
                <div>
                    <button tabIndex={-1} onClick={test}
                    className="btn btn_lpm btn_test"
                    onFocus={e=>e.stopPropagation()}>{t('Test')}</button>
                </div>
            </Tooltip>
        </div>
        <div className="inputs_container">
            <Tooltip title={t('Logs username')}>
                <div className="aggr_url">
                    <Input val={username} placeholder={t('Username')}
                    on_change_wrapper={set('username')} type="string" />
                </div>
            </Tooltip>
            <Tooltip title={t('Logs password')}>
                <div className="aggr_url">
                    <Input val={password} placeholder={t('Password')}
                    type="password" on_change_wrapper={set('password')} />
                </div>
            </Tooltip>
        </div>
        <div className="use_limit">
            <Tooltip title={t('Use SSL to save logs')}>
                <div className="use_limit_tooltip">{t('Use SSL')}</div>
            </Tooltip>
            <Yes_no val={use_ssl} disabled={ssl_disabled}
            on_change_wrapper={set('use_ssl')}/>
        </div>
    </React.Fragment>;
};

const Datadog_tab = ({set, settings, test, t})=>{
    const {port, token, host, tags, source} = settings;
    return <React.Fragment>
        <div className="inputs_container">
            <Tooltip title={t('Datadog API key or client token')}>
                <div className="aggr_url">
                    <Input val={token} placeholder={t('Key')}
                    on_change_wrapper={set('token')} type="string" />
                </div>
            </Tooltip>
            <Tooltip title={t('Test aggregator')}>
                <div>
                    <button tabIndex={-1} className="btn btn_lpm btn_test"
                    onClick={test} onFocus={e=>e.stopPropagation()}>
                        {t('Test')}
                    </button>
                </div>
            </Tooltip>
        </div>
        <div className="inputs_container">
            <Tooltip title={t('Optional host, "tcp-intake.logs.datadoghq.eu" '
                +' is for EU region host')}>
                <div className="input_main_dub">
                    <Input val={host} type="string"
                    placeholder={t('Host (optional)')}
                    on_change_wrapper={set('host')} />
                </div>
            </Tooltip>
            <Tooltip title={t('Optional port, 443 is for EU region'
                +' secure port')}>
                <div className="input_second">
                    <Input placeholder={t('Port (optional)')} val={port}
                    on_change_wrapper={set('Port')} type="string" />
                </div>
            </Tooltip>
        </div>
        <div className="inputs_container">
            <Tooltip title={t('Tags associated with your logs')}>
                <div className="input_main_dub">
                    <Input val={tags} placeholder={t('Tags')}
                    on_change_wrapper={set('tags')} type="string" />
                </div>
            </Tooltip>
            <Tooltip title={t('The integration name associated to your log')}>
                <div className="input_second">
                    <Input placeholder={t('Source')} val={source}
                    on_change_wrapper={set('source')} type="string" />
                </div>
            </Tooltip>
        </div>
    </React.Fragment>;
};

const Logzio_tab = ({set, settings, test, t})=>
    <React.Fragment>
        <div className="inputs_container">
            <Tooltip title={t('Optional host, default listener.logz.io')}>
                <div className="aggr_url">
                    <Input val={settings.host} placeholder={t('Host')}
                    on_change_wrapper={set('host')} type="string" />
                </div>
            </Tooltip>
            <Tooltip title={t('Test aggregator')}>
                <div>
                    <button tabIndex={-1} onClick={test}
                    className="btn btn_lpm btn_test"
                    onFocus={e=>e.stopPropagation()}>{t('Test')}</button>
                </div>
            </Tooltip>
        </div>
        <div className="inputs_container">
            <Tooltip title={t('Token of the account to ship logs to')}>
                <div className="input_main">
                    <Input val={settings.token} placeholder={t('Token')}
                    on_change_wrapper={set('token')} type="string" />
                </div>
            </Tooltip>
            <Tooltip title={t('Optional port, default 8071')}>
                <div className="input_second">
                    <Input val={settings.port} placeholder={t('Port')}
                    on_change_wrapper={set('port')} type="number" />
                </div>
            </Tooltip>
        </div>
        <div className="inputs_container">
            <Tooltip title={t('Your log type for parsing purposes')}>
                <div className="input_main_sub">
                    <Input val={settings.source} placeholder={t('Type')}
                    on_change_wrapper={set('source')} type="string" />
                </div>
            </Tooltip>
        </div>
    </React.Fragment>;

const tabs = {
    custom: {
        label: 'Custom',
        tooltip: 'Use HTTP Log aggregator',
        element: Custom_tab,
    },
    datadog: {
        label: 'Datadog',
        tooltip: 'Use Datadog Log Manager',
        element: Datadog_tab
    },
    logzio: {
        label: 'Logz.io',
        tooltip: 'Use Logz.io platform',
        element: Logzio_tab
    },
};

export default class Logs_settings_modal extends Pure_component {
    state = {is_submit_disabled: false, use_limit: false, cur_tab: 'custom',
        logs_num: 0, error: '', remote: {}, saved_type: ''};
    componentDidMount(){
        $('#logs_settings_modal').on('hidden.bs.modal',
            this.on_hide.bind(this));
        $('#logs_settings_modal').on('show.bs.modal',
            this.reset_state.bind(this));
    }
    componentWillUnmount(){
        $('#logs_settings_modal').off('hidden.bs.modal',
            this.on_hide.bind(this));
    }
    on_hide(){
        if (this.props.on_hide)
            this.props.on_hide();
        this.reset_state();
    }
    test_remote(){
        let _this = this, {cur_tab, remote} = this.state;
        return etask(function*(){
            const test_res = yield Api.post('test_logs_remote',
                assign({}, remote, {type: cur_tab}));
            if (test_res != 'ok')
                return _this.setState({error: test_res});
            _this.setState({is_submit_disabled: false});
        });
    }
    reset_state = ()=>{
        const {remote_enabled, logs_disabled_num, logs_enabled_num,
            settings} = this.props;
        const logs_settings = settings||{};
        this.setState({
            saved_type: logs_settings.type,
            logs_num: remote_enabled ? logs_disabled_num : logs_enabled_num,
            use_limit: remote_enabled,
            is_submit_disabled: remote_enabled,
            remote: logs_settings,
            cur_tab: logs_settings.type || 'custom',
        });
    };
    set = field=>val=>this.setState({[field]: val, error: '',
        is_submit_disabled: this.state.use_limit});
    set_remote = type=>field=>val=>this.setState({is_submit_disabled: true,
        remote: assign({}, this.state.remote, {[field]: val, type}),
        error: ''});
    ch_use_limit = val=>this.setState({use_limit: val,
        is_submit_disabled: val, error: '', logs_num: val ?
        this.props.logs_disabled_num : this.props.logs_enabled_num});
    save = ()=>{
        const s = this.state;
        let settings = [
            {field: 'logs', value: s.logs_num, opt: {number: 1}},
            {field: remote_field, value: {}},
        ];
        if (s.use_limit)
        {
            let sid = settings.findIndex(st=>st.field==remote_field);
            settings[sid].value = assign({}, s.remote, {type: s.cur_tab});
        }
        this.props.on_save(settings);
    };
    render(){
        let {use_limit, logs_num, is_submit_disabled, cur_tab,
            error, remote} = this.state;
        return <T>{t=><Modal id="logs_settings_modal" title="Logs settings"
          className="logs_settings_modal" click_ok={this.save}
          ok_disabled={is_submit_disabled}>
          <div className="use_limit">
            <Tooltip title={t('Save logs locally or use remote aggregator')}>
                <div className="use_limit_tooltip">
                    {t('Use remote logs aggregator')}
                </div>
            </Tooltip>
            <Yes_no val={use_limit} on_change_wrapper={this.ch_use_limit}/>
          </div>
          {use_limit && <div className='logs_settings_modal_tabs'>
            <Nav_tabs set_tab={this.set('cur_tab')} cur_tab={cur_tab} narrow>
                {entries(tabs).map(([tp, {label, tooltip}])=><Nav_tab key={tp}
                    id={tp} title={label} tooltip={tooltip}/>)}
            </Nav_tabs>
            {React.createElement(tabs[cur_tab].element, {
                set: this.set_remote(cur_tab),
                settings: remote,
                test: this.test_remote.bind(this),
                t
            })}
          </div>}
          {!use_limit && <div className="inputs_container">
            <Labeled_controller
                val={logs_num}
                type="select_number"
                on_change_wrapper={this.set('logs_num')}
                data={this.props.logs_data}
                label="Limit for request logs"
                default={true}
                tooltip={this.props.tooltip}
            />
          </div>}
          {error && <Warning text={error} />}
        </Modal>}</T>;
    }
}
