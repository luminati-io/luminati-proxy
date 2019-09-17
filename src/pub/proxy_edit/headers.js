// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true, es6:true*/
import React from 'react';
import Pure_component from '/www/util/pub/pure_component.js';
import setdb from '../../../util/setdb.js';
import {Config, Tab_context} from './common.js';
import {Remove_icon, Add_icon, Field_row_raw, Note} from '../common.js';
import * as util from '../util.js';
import Tooltip from '../common/tooltip.js';
import {Input} from '../common/controls.js';
import {T} from '../common/i18n.js';

export default class Headers extends Pure_component {
    first_header = {name: '', value: ''};
    state = {headers: [this.first_header]};
    goto_field = setdb.get('head.proxy_edit.goto_field');
    set_field = setdb.get('head.proxy_edit.set_field');
    componentDidMount(){
        this.setdb_on('head.proxy_edit.form.headers', headers=>{
            if (headers&&headers.length)
                this.setState({headers});
            else
                this.setState({headers: [this.first_header]});
        });
        this.setdb_on('head.proxy_edit.form', form=>{
            form && this.setState({form});
        });
    }
    add = ()=>this.set_field('headers', [
        ...this.state.headers, {name: '', value: ''}]);
    remove = idx=>{
        let new_headers = [
            ...this.state.headers.slice(0, idx),
            ...this.state.headers.slice(idx+1),
        ];
        if (!new_headers.length)
            new_headers = [this.first_header];
        this.set_field('headers', new_headers);
    };
    update = idx=>name=>value=>this.set_field('headers',
        this.state.headers.map((h, i)=>{
            if (i!=idx)
                return h;
            return {...h, [name]: value};
        }));
    random_user_agent_changed = val=>{
        if (val)
            this.set_field('user_agent', '');
    };
    random_user_agent_types = ()=>[
        {key: 'No', value: ''},
        {key: 'Desktop', value: 'desktop'},
        {key: 'Mobile', value: 'mobile'},
    ];
    goto_ssl = ()=>this.goto_field('ssl');
    render(){
        if (!this.state.form)
            return null;
        return <div className="headers">
              {!this.state.form.ssl &&
                <Note>
                  <span><strong><T>Warning: </T></strong></span>
                  <span><T>these options are available only when using </T>
                    <a className="link" onClick={this.goto_ssl}>
                    <T>SSL analyzing</T></a></span>
                </Note>
              }
              <Tab_context.Provider value="headers">
                <Config type="select" id="user_agent" data={util.user_agents}
                  disabled={this.state.form.random_user_agent ||
                      !this.state.form.ssl}/>
                <Config type="select" id="random_user_agent"
                  data={this.random_user_agent_types()}
                  on_change={this.random_user_agent_changed}
                  disabled={!this.state.form.ssl}/>
                <Config type="yes_no" id="override_headers"
                  disabled={!this.state.form.ssl}/>
                <Field_row_raw inner_class_name="headers">
                  <div className="desc">
                    <Tooltip title="Custom headers">
                      <span>Headers</span>
                    </Tooltip>
                  </div>
                  <div className="list">
                    {this.state.headers.map((h, i)=>
                      <Header last={i+1==this.state.headers.length} key={i}
                        name={h.name} value={h.value} update={this.update(i)}
                        remove_clicked={this.remove} add_clicked={this.add}
                        idx={i} disabled={!this.state.form.ssl}/>
                    )}
                  </div>
                </Field_row_raw>
              </Tab_context.Provider>
            </div>;
    }
}

const Header = ({name, value, idx, add_clicked, remove_clicked, last,
    update, disabled})=>
    <div className="single_header">
      <div className="desc">Name</div>
      <Input type="text" val={name} on_change_wrapper={update('name')}
        disabled={disabled}/>
      <div className="desc">Value</div>
      <Input type="text" val={value} on_change_wrapper={update('value')}
        disabled={disabled}/>
      {!disabled && <div className="action_icons">
        <Remove_icon tooltip="Remove header" click={()=>remove_clicked(idx)}/>
        {last && <Add_icon tooltip="Add header" click={add_clicked}/>}
      </div>}
    </div>;
