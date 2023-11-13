// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true, es6:true*/
import React from 'react';
import $ from 'jquery';
import _ from 'lodash4';
import moment from 'moment-timezone';
import Pure_component from '/www/util/pub/pure_component.js';
import setdb from '../../../util/setdb.js';
import zcountry from '../../../util/country.js';
import ztz from '../../../util/tz.js';
import {qw} from '../../../util/string.js';
import {T} from '../common/i18n.js';
import {Select_multiple} from '../common/controls.js';
import {Remove_icon, Field_row_raw, Warning, Note} from '../common.js';
import user_agents from '/www/util/pub/user_agent_gen.json';
import {is_local} from '../util.js';
import ws from '../ws.js';
import {main as Api} from '../api.js';
import Tooltip from '../common/tooltip.js';
import {Config, Tab_context} from './common.js';

const timezone_opt = [
    {key: 'Disabled (default)', value: ''},
    {key: 'Automatic', value: 'auto'},
    ...Object.entries(ztz.timezone||{}).map(([code, timezone])=>({
        key: `${zcountry.list[code]||timezone} `
            +`(GMT${moment.tz(timezone).format('Z')})`,
        value: timezone,
    })).sort((a, b)=>a.key.localeCompare(b.key)),
];

const browser_resolutions = qw`1024x600 1024x768 1280x720 1280x800 1280x1024
    1360x768 1366x768 1440x900 1536x864 1600x900 1680x1050 1920x1080
    1920x1200 2304x1440 2560x1440 2560x1600 2880x1800 4096x2304 5120x2880`;

const resolution_opt = [
    {key: 'Automatic (default)', value: ''},
    ...browser_resolutions.map(r=>({key: r, value: r})),
];

const webrtc_opt = [
    {key: 'Disabled (default)', value: ''},
    {key: 'Enabled', value: true},
];

export default class Browser extends Pure_component {
    first_header = {name: '', value: ''};
    state = {headers: [this.first_header], disabled_fields: {}, defaults: {},
        lock: false};
    goto_field = setdb.get('head.proxy_edit.goto_field');
    set_field = setdb.get('head.proxy_edit.set_field');
    get_curr_plan = setdb.get('head.proxy_edit.get_curr_plan');
    componentDidMount(){
        this.setdb_on('head.lock_navigation', lock=>this.setState({lock}));
        this.setdb_on('head.settings', settings=>this.setState({settings}));
        this.setdb_on('head.proxy_edit.form.headers', headers=>{
            if (!headers)
                return;
            headers = this.normalize_empty(headers);
            this.setState({headers});
        });
        this.setdb_on('head.proxy_edit.form', form=>{
            form && this.setState({form});
        });
        this.setdb_on('head.proxy_edit.disabled_fields', disabled_fields=>
            disabled_fields&&this.setState({disabled_fields}));
        this.setdb_on('head.defaults',
            defaults=>this.setState({defaults: defaults||{}}));
    }
    remove = idx=>{
        let new_headers = [
            ...this.state.headers.slice(0, idx),
            ...this.state.headers.slice(idx+1),
        ];
        new_headers = this.normalize_empty(new_headers);
        this.set_field('headers', new_headers);
    };
    normalize_empty = headers=>{
        if (!headers.length)
            return [this.first_header];
        if (!headers.filter(h=>!h.name).length)
            return [...headers, {name: '', value: ''}];
        return headers;
    };
    update = idx=>name=>value=>{
        let new_headers = this.state.headers.map((h, i)=>{
            if (i!=idx)
                return h;
            return {...h, [name]: value};
        });
        new_headers = this.normalize_empty(new_headers);
        this.set_field('headers', new_headers);
    };
    turn_ssl = ()=>this.set_field('ssl', true);
    open_browser = e=>{
        e.stopPropagation();
        const _this = this;
        ws.post_event('Browser Click');
        this.etask(function*(){
            const res = yield Api.get(`browser/${_this.state.form.port}`);
            if ((res||'').includes('Fetching'))
                $('#fetching_chrome_modal').modal();
        });
    };
    render(){
        if (!this.state.form || !this.state.settings)
            return null;
        const {ssl} = this.state.form;
        const {zagent} = this.state.settings;
        const def_ssl = this.state.defaults.ssl;
        const ssl_analyzing_enabled = ssl || ssl!==false && def_ssl;
        const is_unblocker = this.get_curr_plan().type=='unblocker';
        const headers_are_set = this.state.headers.some(h=>
            !_.isEqual(h, this.first_header));
        return <div className="browser">
          <Warning text={
            <div className="warning_container">
              <span>
                These options are applied <strong>ONLY</strong> when using a
                browser from the Proxy Manager.
                <br/>
                These settings alter the default behavior of the browser, such
                as proxy configuration and JavaScript environment.
              </span>
              {is_local() &&
                <T>{t=>
                  <Tooltip title={t('Open a browser configured with these '
                    +'settings')}>
                    <button
                      onClick={this.open_browser}
                      disabled={this.state.lock}
                      className="btn btn_lpm btn_lpm_primary">
                      {t(this.state.lock ? 'Saving settings' :
                        'Open a browser')}
                    </button>
                  </Tooltip>
                }</T>
              }
            </div>
          }/>
          <Tab_context.Provider value="browser">
            <Field_row_raw inner_class_name="headers">
              <div className="desc">
                <T>{t=><Tooltip title={t('Custom headers')}>
                    <span><T>Headers</T></span>
                  </Tooltip>
                }</T>
              </div>
              <div className="list">
                {this.state.headers.map((h, i)=>
                  <Header key={i}
                    name={h.name}
                    value={h.value}
                    update={this.update(i)}
                    remove_clicked={this.remove}
                    idx={i}/>
                )}
                {!ssl_analyzing_enabled && headers_are_set &&
                  <Note>
                    <span><T>Can be used only when</T></span>{' '}
                      <a className="link" onClick={this.turn_ssl}>
                        <T>SSL analyzing</T>
                      </a>{' '}
                    <span><T>is turned on.</T></span>
                  </Note>
                }
              </div>
            </Field_row_raw>
            <Config type="select" id="timezone" data={timezone_opt}
              disabled={zagent}/>
            <Config type="select" id="resolution" data={resolution_opt}
              disabled={zagent}/>
            <Config type="select" id="webrtc" data={webrtc_opt}
              disabled={zagent}/>
            {is_unblocker && <Config id="ua" type="yes_no"/>}
          </Tab_context.Provider>
        </div>;
    }
}

class Header extends Pure_component {
    render(){
        const {name, value, idx, remove_clicked, update} = this.props;
        return <div className="single_header">
          <Header_name val={name} on_change={update('name')}/>
          <Header_value name={name} val={value} on_change={update('value')}/>
          <div className="action_icons">
            <Remove_icon
              tooltip="Remove header"
              click={()=>remove_clicked(idx)}/>
          </div>
        </div>;
    }
}

class Header_name extends Pure_component {
    state = {active: false};
    edit_mode = ()=>{
        this.setState({active: true});
    };
    on_blur = ()=>{
        this.setState({active: false});
    };
    render(){
        return <div className="header_name" onBlur={this.on_blur}>
          <Select_header_name
            val={this.props.val}
            on_change_wrapper={this.props.on_change}/>
          <span>:</span>
        </div>;
    }
}

class Header_value extends Pure_component {
    render(){
        return <div className="header_value">
          <Select_header_value
            name={this.props.name}
            val={this.props.val}
            on_change_wrapper={this.props.on_change}/>
        </div>;
    }
}

const headers = {
    'user-agent': [
        {label: 'Random (desktop)', value: 'random_desktop'},
        {label: 'Random (mobile)', value: 'random_mobile'},
        ...user_agents,
    ],
    'accept': [
        '*/*',
        'text/*, text/html, text/html;level=1, */*',
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,'
            +'image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
    ],
    'accept-encoding': [
        'gzip',
        'deflate, gzip;q=1.0, *;q=0.5',
        'gzip, deflate, br',
    ],
    'accept-language': [
        'en-US,en;q=0.9',
        'en-US,en;q=0.9,ja;q=0.8',
    ],
    'sec-fetch-site': ['none'],
    'sec-fetch-mode': ['navigate'],
    'sec-fetch-dest': ['document'],
};

class Select_header_name extends Pure_component {
    value_to_option = value=>{
        if (!value)
            return {value: '', label: '--Select or type--'};
        return {value, label: value};
    };
    on_change = e=>this.props.on_change_wrapper(e && e.value || '');
    render(){
        return <Select_multiple {...this.props}
          class_name="header_name"
          options={Object.keys(headers).map(v=>this.value_to_option(v))}
          on_change={this.on_change}
          validation={v=>!!v}
          value_to_option={this.value_to_option}
        />;
    }
}

class Select_header_value extends Pure_component {
    value_to_option = value=>{
        if (value.label && value.value)
            return value;
        if (!value)
            return {value: '', label: '--Select or type--'};
        return {value, label: value};
    };
    on_change = e=>this.props.on_change_wrapper(e && e.value || '');
    render(){
        const name = this.props.name;
        return <Select_multiple {...this.props}
          class_name="header_value"
          options={(headers[name]||[]).map(v=>this.value_to_option(v))}
          on_change={this.on_change}
          validation={v=>!!v}
          value_to_option={this.value_to_option}
        />;
    }
}
