// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true, es6:true*/
import React from 'react';
import _ from 'lodash4';
import {
    Modal,
    Tooltip,
    Button,
} from 'uikit';
import Pure_component from '/www/util/pub/pure_component.js';
import etask from '../../../util/etask.js';
import date from '../../../util/date.js';
import {
    Labeled_section,
    Warning,
} from '../common.js';
import {get_form_toggle_transform} from '../util.js';
import {main as Api} from '../api.js';
import {Input} from './controls.js';
import {T} from './i18n.js';
import Tab_group from './tab_group.js';
const {assign} = Object;
const remote_field = 'logs_settings';
const S3_DEF_TARGET = 'logs/pm/';
const {Popup} = Modal;

const Test_btn = ({on_test, tip='Test aggregator', t})=>
    <Tooltip tooltip={t(tip)}>
        <Button
            onFocus={e=>e.stopPropagation()}
            onClick={on_test}
            size="xs"
            text={t('Test')}
        />
    </Tooltip>;

const Webhook_tab = ({set, settings, test, t})=>{
    const {url, username, password, use_ssl} = settings;
    const ssl_disabled = !username || !password;
    if (ssl_disabled && use_ssl)
        set('use_ssl')(false);
    return <React.Fragment>
        <div className="inputs_container">
            <div className="aggr_url">
                <Input val={url} type="string"
                    placeholder={t('Logs aggregator url')}
                    on_change_wrapper={set('url')}
                />
            </div>
            <Test_btn tip="Test aggregator url" t={t} on_test={test}/>
        </div>
        <div className="inputs_container">
            <div className="cred_first">
                <Input val={username} placeholder={t('Username')}
                on_change_wrapper={set('username')} type="string" />
            </div>
            <div className="cred_second">
                <Input val={password} placeholder={t('Password')}
                type="password" on_change_wrapper={set('password')} />
            </div>
        </div>
        <div className="use_limit">
            <Labeled_section
                small
                label_variant="base"
                label={t('Use SSL')}
                tooltip={t('Use SSL to save logs')}
                type="toggle"
                on_change_wrapper={set('use_ssl')}
                val={use_ssl}
            />
        </div>
    </React.Fragment>;
};

const Datadog_tab = ({set, settings, test, t})=>{
    const {port, token, host, tags, source} = settings;
    return <React.Fragment>
        <div className="inputs_container">
            <div className="aggr_url">
                <Input val={token} placeholder={t(`Datadog API key or token`)}
                on_change_wrapper={set('token')} type="string" />
            </div>
            <Test_btn t={t} on_test={test}/>
        </div>
        <div className="inputs_container">
            <div className="input_main_sub">
                <Input val={host} type="string"
                placeholder={t('Host (optional)')}
                on_change_wrapper={set('host')} />
            </div>
            <div className="input_second">
                <Input placeholder={t('Port (optional)')} val={port}
                on_change_wrapper={set('Port')} type="string" />
            </div>
        </div>
        <div className="inputs_container">
            <div className="input_main_sub">
                <Input val={tags} placeholder={t('Tags')}
                on_change_wrapper={set('tags')} type="string" />
            </div>
            <div className="input_second">
                <Input placeholder={t('Integration name')} val={source}
                on_change_wrapper={set('source')} type="string" />
            </div>
        </div>
    </React.Fragment>;
};

const Logzio_tab = ({set, settings, test, t})=>
    <React.Fragment>
        <div className="inputs_container">
            <div className="aggr_url">
                <Input placeholder={t('Host, default listener.logz.io')}
                on_change_wrapper={set('host')} type="string"
                val={settings.host} />
            </div>
            <Test_btn t={t} on_test={test}/>
        </div>
        <div className="inputs_container">
            <div className="input_main">
                <Input val={settings.token} placeholder={t('Token')}
                on_change_wrapper={set('token')} type="string" />
            </div>
            <div className="input_second">
                <Input val={settings.port} on_change_wrapper={set('port')}
                placeholder={t('Port, default 8071')} type="number" />
            </div>
        </div>
        <div className="inputs_container">
            <div className="input_main_sub">
                <Input placeholder={t('Log type for parsing')}
                val={settings.source} on_change_wrapper={set('source')}
                type="string" />
            </div>
        </div>
    </React.Fragment>;

const build_s3_file_path = (target, compress, group_by_day)=>{
    const ext = compress ? '.gz' : '';
    const tgt = target || S3_DEF_TARGET;
    const slash = !tgt.endsWith('/') ? '/' : '';
    const file = group_by_day ? '%H:%M' : '%Y-%m-%d_%H:%M';
    const group = group_by_day ? '%Y-%m-%d/' : '';
    return date.strftime(`${tgt}${slash}${group}brd_test_${file}`
        +`.log${ext}`, date());
};

const S3_tab = ({set, settings, test, t})=>{
    const {bucket, access_key, secret_key, target, tag_type,
        tag_project, compress, encryption, group_by_day,
        rotation_hour} = settings;
    const test_msg = `Pleace check your bucket ${bucket} for file`
        +` ${build_s3_file_path(target, compress, group_by_day)}`;
    const target_tt = t('Target path in which the log is uploaded')
        +', default '+S3_DEF_TARGET;
    return <React.Fragment>
        <div className="inputs_container">
            <div className="aggr_url">
                <Input val={bucket} placeholder={t('AWS S3 Bucket name')}
                on_change_wrapper={set('bucket')} type="string" />
            </div>
            <Test_btn t={t} on_test={()=>test(test_msg)}/>
        </div>
        <div className="inputs_container">
            <div className="input_half">
                <Input val={access_key} placeholder={t('AWS access key')}
                on_change_wrapper={set('access_key')} type="string" />
            </div>
            <div className="input_half_sub">
                <Input val={secret_key} placeholder={t('AWS secret key')}
                on_change_wrapper={set('secret_key')} type="string" />
            </div>
        </div>
        <div className="inputs_container">
            <div className="input_full">
                <Input val={target} type="string"
                placeholder={target_tt}
                on_change_wrapper={set('target')} />
            </div>
        </div>
        <div className="inputs_container">
            <div className="input_half">
                <Input val={tag_type} placeholder={t('Tag type')}
                on_change_wrapper={set('tag_type')} type="string" />
            </div>
            <div className="input_half_sub">
                <Input val={tag_project} placeholder={t('Tag project')}
                on_change_wrapper={set('tag_project')} type="string" />
            </div>
        </div>
        <div className="use_limit">
            <Labeled_section
                w20
                label_variant="base"
                label={t('Group by day')}
                tooltip={t('Group objects by day')}
                type="toggle"
                on_change_wrapper={set('group_by_day')}
                val={group_by_day}
            />
        </div>
        <div className="use_limit">
            <Labeled_section
                w20
                label_variant="base"
                label={t('Rotate every hour')}
                tooltip={t(`Rotate objects every hour (default 10 min)`)}
                type="toggle"
                on_change_wrapper={set('rotation_hour')}
                val={rotation_hour}
            />
        </div>
        <div className="use_limit">
            <Labeled_section
                w20
                label_variant="base"
                label={t('Use compression')}
                tooltip={t(`Files will be gzipped before uploading`)}
                type="toggle"
                on_change_wrapper={set('compress')}
                val={compress}
            />
        </div>
        <div className="use_limit">
            <Labeled_section
                w20
                label_variant="base"
                label={t('Use encryption')}
                tooltip={t(`The server side encryption AES256 algorithm
                    used when storing objects`)}
                type="toggle"
                on_change_wrapper={set('encryption')}
                val={encryption}
            />
        </div>
    </React.Fragment>;
};

const all_tabs = [
    {
        id: 'custom',
        text: 'Webhook',
        element: Webhook_tab,
    },
    {
        id: 'datadog',
        text: 'Datadog',
        element: Datadog_tab,
    },
    {
        id: 'logzio',
        text: 'Logz.io',
        element: Logzio_tab,
    },
    {
        id: 's3',
        text: 'AWS S3',
        element: S3_tab,
    },
];

export default class Logs_settings_modal extends Pure_component {
    constructor(props){
        super(props);
        this.state = {
            is_submit_disabled: false,
            use_limit: false,
            cur_tab: 'custom',
            logs_num: 0,
            error: '',
            remote: {},
            saved_type: '',
        };
        this.tabs = all_tabs
            .map(t=>({onClick: ()=>this.set_const('cur_tab', t.id), ...t}));
    }
    componentDidUpdate(prev_props){
        if (prev_props.show!=this.props.show)
            this.reset_state();
    }
    test_remote(msg){
        let _this = this, {cur_tab, remote} = this.state;
        return etask(function*(){
            const test_res = yield Api.json.post('test_logs_remote',
                assign({}, remote, {type: cur_tab}));
            if (!test_res?.success)
                return _this.setState({error: test_res.error});
            _this.setState({is_submit_disabled: false, info: msg||false});
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
    get set_def_state(){
        return {
            is_submit_disabled: this.state.use_limit,
            error: '',
            info: '',
        };
    }
    set_const = (field, val)=>this.set(field)(val);
    set = field=>val=>this.setState({[field]: val, ...this.set_def_state});
    set_remote = type=>field=>val=>this.setState({is_submit_disabled: true,
        remote: assign({}, this.state.remote, {[field]: val, type}),
        error: '', info: ''});
    ch_use_limit = val=>this.setState({use_limit: val,
        is_submit_disabled: val, error: '', info: '', logs_num: val ?
        this.props.logs_disabled_num : this.props.logs_enabled_num});
    save = ()=>{
        const s = this.state;
        let settings = [
            {field: 'logs', value: s.logs_num, opt: {number: 1}},
            {field: remote_field, value: {}},
        ];
        let sid = settings.findIndex(st=>st.field==remote_field);
        if (s.use_limit)
            settings[sid].value = assign({}, s.remote, {type: s.cur_tab});
        else if (this.props.settings?.type)
            settings[sid].value = assign({}, {disable: true});
        this.props.on_save(settings);
    };
    get_tab = _.memoize(cur_tab=>
        this.tabs.find(t=>t.id==cur_tab)||this.tabs[0]);
    get content(){
        const {logs_data} = this.props;
        const {use_limit, logs_num, cur_tab, error, remote, info} = this.state;
        return <T>{t=><>
            <div className="use_limit">
                <Labeled_section
                    short
                    label_variant="base"
                    label={t('Use remote logs aggregator')}
                    tooltip={t(`Save logs locally or use remote aggregator`)}
                    type="toggle"
                    on_change_wrapper={this.ch_use_limit}
                    val={use_limit}
                />
            </div>
            {use_limit && <div className='logs_settings_modal_tabs'>
                <Tab_group tabs={this.tabs} selected={cur_tab}
                    variant='contain' wide />
                {React.createElement(this.get_tab(cur_tab).element, {
                    set: this.set_remote(cur_tab),
                    settings: remote,
                    test: this.test_remote.bind(this),
                    t
                })}
            </div>}
            {!use_limit && <div className="inputs_container">
                <Labeled_section
                    short
                    label_variant="base"
                    label={t('Save request logs')}
                    tooltip={this.props.tooltip}
                    type="toggle"
                    toggle_transform={get_form_toggle_transform(logs_data)}
                    on_change_wrapper={this.set('logs_num')}
                    val={logs_num}
                />
            </div>}
            {info && <Warning text={info} />}
            {error && <Warning text={error} />}
        </>}</T>;
    }
    render(){
        return <Popup
            show={this.props.show}
            onOk={this.save}
            okLabel="Save"
            cancelLabel="Dismiss"
            okDisabled={this.state.is_submit_disabled}
            onCancel={this.props.on_hide}
            title="Logs settings"
            content={this.content}
            shadow="sm"
            size="lg"
        />;
    }
}
