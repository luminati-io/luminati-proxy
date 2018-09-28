// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true, es6:true*/
import React from 'react';
import Pure_component from '../../../www/util/pub/pure_component.js';
import setdb from '../../../util/setdb.js';
import {Config} from './common.js';
import {Tooltip, Remove_icon, Add_icon, Input} from '../common.js';
import * as util from '../util.js';
import {withContext} from 'recompose';
import PropTypes from 'prop-types';
const provider = provide=>withContext({provide: PropTypes.object},
    ()=>({provide}));

export default provider({tab_id: 'headers'})(
class Headers extends Pure_component {
    first_header = {name: '', value: ''};
    state = {headers: [this.first_header]};
    set_field = setdb.get('head.proxy_edit.set_field');
    componentDidMount(){
        this.setdb_on('head.proxy_edit.form.headers', headers=>{
            if (headers&&headers.length)
                this.setState({headers});
            else
                this.setState({headers: [this.first_header]});
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
    render(){
        return <div>
              <Config type="select" id="user_agent" data={util.user_agents}
                disabled={this.props.form.random_user_agent}/>
              <Config type="yes_no" id="random_user_agent"
                on_change={this.random_user_agent_changed}/>
              <Config type="yes_no" id="override_headers"/>
              <div className="field_row headers">
                <div className="desc">
                  <Tooltip title="Custom headers">
                    <span>Headers</span>
                  </Tooltip>
                </div>
                <div className="list">
                  {this.state.headers.map((h, i)=>
                    <Header last={i+1==this.state.headers.length} key={i}
                      name={h.name} value={h.value} update={this.update(i)}
                      remove_clicked={this.remove}
                      add_clicked={this.add} idx={i}/>
                  )}
                </div>
              </div>
            </div>;
    }
});

const Header = ({name, value, idx, add_clicked, remove_clicked, last,
    update})=>
    <div className="single_header">
      <div className="desc">Name</div>
      <Input type="text" val={name} on_change_wrapper={update('name')}/>
      <div className="desc">Value</div>
      <Input type="text" val={value} on_change_wrapper={update('value')}/>
      <div className="action_icons">
        <Remove_icon tooltip="Remove header" click={()=>remove_clicked(idx)}/>
        {last && <Add_icon tooltip="Add header" click={add_clicked}/>}
      </div>
    </div>;
