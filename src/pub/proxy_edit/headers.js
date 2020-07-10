// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true, es6:true*/
import React from 'react';
import Pure_component from '/www/util/pub/pure_component.js';
import setdb from '../../../util/setdb.js';
import {Config, Tab_context} from './common.js';
import {Remove_icon, Field_row_raw, Warning} from '../common.js';
import * as util from '../util.js';
import Tooltip from '../common/tooltip.js';
import {Select_multiple} from '../common/controls.js';
import {T} from '../common/i18n.js';

export default class Headers extends Pure_component {
    first_header = {name: '', value: ''};
    state = {headers: [this.first_header], disabled_fields: {}, defaults: {}};
    goto_field = setdb.get('head.proxy_edit.goto_field');
    set_field = setdb.get('head.proxy_edit.set_field');
    componentDidMount(){
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
    render(){
        if (!this.state.form)
            return null;
        let {ssl} = this.state.form, def_ssl = this.state.defaults.ssl;
        let ssl_analyzing_enabled = ssl || ssl!==false && def_ssl;
        if (!ssl_analyzing_enabled)
        {
            return <Warning text={
                <React.Fragment>
                  <span><T>These options are available only when using </T>
                  <a className="link" onClick={this.turn_ssl}>
                  <T>SSL analyzing</T></a></span>
                </React.Fragment>
            }/>;
        }
        return <div className="headers">
              <Tab_context.Provider value="headers">
                <Config type="yes_no" id="override_headers"/>
                <Field_row_raw inner_class_name="headers">
                  <div className="desc">
                    <T>{t=><Tooltip title={t('Custom headers')}>
                      <span><T>Headers</T></span>
                    </Tooltip>}</T>
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
                  </div>
                </Field_row_raw>
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
        ...util.formatted_user_agents,
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
              value_to_option={this.value_to_option}/>;
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
              value_to_option={this.value_to_option}/>;
    }
}
