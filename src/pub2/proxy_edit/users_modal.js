// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true, es6:true*/
import React from 'react';
import Pure_component from '/www/util/pub/pure_component.js';
import $ from 'jquery';
import setdb from '../../../util/setdb.js';
import {Modal} from '../common/modals.js';
import {Chrome_table} from '../chrome_widgets.js';
import {Checkbox} from '../common.js';
import {report_exception} from '../util.js';
import {main as Api} from '../api.js';

export default class Users_modal extends Pure_component {
    set_field = setdb.get('head.proxy_edit.set_field');
    state = {
        users: [],
        selected: (this.props.form.users||[]).reduce((acc, u)=>
            Object.assign(acc, {[u]: true}), {}),
        selected_all: false,
    };
    componentDidMount(){
        $('#users_modal').on('show.bs.modal', this.load);
    }
    static getDerivedStateFromProps(props, state){
        if (!state.users.length)
            return null;
        const selected = Object.keys(state.selected)
            .filter(s=>state.selected[s]);
        return {
            selected_all: selected.length==state.users.length,
        };
    }
    close = ()=>$('#users_modal').modal('hide');
    load = ()=>{
        const _this = this;
        this.etask(function*(){
            this.on('finally', ()=>{
                // XXX krzysztof: add loader and finish it here
            });
            this.on('uncaught', e=>_this.etask(function*(){
                yield report_exception(e, 'users_modal.Users_modal.load');
            }));
            const users = yield Api.json.get('lpm_users');
            _this.setState({users});
        });
    };
    toggle = id=>{
        this.setState(prev=>{
            return {
                selected: {
                    ...prev.selected,
                    [id]: !prev.selected[id],
                },
            };
        }, this.save);
    };
    toggle_all = ()=>{
        this.setState(prev=>{
            const selected = prev.users.reduce((acc, u)=>
                Object.assign(acc, {[u.email]: !prev.selected_all}), {});
            return {selected};
        }, this.save);
    };
    save = ()=>{
        const selected = Object.keys(this.state.selected)
            .filter(s=>this.state.selected[s]);
        if (selected.length>(this.props.form.multiply||0))
            this.set_field('multiply', selected.length);
        this.set_field('users', selected);
    };
    cols = [
        {id: 'email', title: 'Email'},
        {id: 'password', title: 'Password'},
    ];
    render(){
        return <Modal id="users_modal" title="Proxy Manager users">
          <Chrome_table
            cols={this.cols}
            class_name="in_modal_table"
            selectable
            selected_all={this.state.selected_all}
            toggle_all={this.toggle_all}>
            {this.state.users.map(d=>
              <tr key={d.email}>
                <td>
                  <Checkbox checked={!!this.state.selected[d.email]}
                    on_change={()=>this.toggle(d.email)}/>
                </td>
                <td>{d.email}</td>
                <td>{d.password}</td>
              </tr>
            )}
          </Chrome_table>
        </Modal>;
    }
}
