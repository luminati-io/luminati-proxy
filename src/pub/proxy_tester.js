// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true, es6:true*/
import React from 'react';
import Pure_component from '../../www/util/pub/pure_component.js';
import $ from 'jquery';
import {Input, Select, Loader, Modal, Warnings, Nav, with_proxy_ports,
    Tooltip, Add_icon, Remove_icon} from './common.js';
import classnames from 'classnames';
import ajax from '../../util/ajax.js';
import {ga_event} from './util.js';
import Preview from './har_preview.js';
import Proxy_blank from './proxy_blank.js';
import {withRouter} from 'react-router-dom';

class Proxy_tester extends Pure_component {
    state = {};
    title = 'Proxy Tester';
    subtitle = 'Emulate requests from your proxies to any target URL';
    update_response = response=>this.setState({response});
    clear_response = ()=>this.setState({response: undefined});
    render(){
        return <div className="proxy_tester vbox">
              <Nav title={this.title} subtitle={this.subtitle}/>
              <Request update_response={this.update_response}/>
              <Preview cur_preview={this.state.response}
                close_preview={this.clear_response}/>
            </div>;
    }
}

const Request = with_proxy_ports(withRouter(
class Request extends Pure_component {
    first_header = {idx: 0, header: '', value: ''};
    state = {
        headers: [this.first_header],
        max_idx: 0,
        params: {url: 'http://lumtest.com/myip.json', method: 'GET'},
        show_loader: false,
    };
    componentDidMount(){
        const params = this.props.history.location.state||{};
        const url = params.url||this.state.params.url;
        const port = params.port;
        this.setState({params: {url, port}});
    }
    add_header = ()=>{
        ga_event('proxy_tester', 'add header');
        this.setState(prev_state=>({
            headers: [...prev_state.headers, {idx: prev_state.max_idx+1,
                header: '', value: ''}],
            max_idx: prev_state.max_idx+1,
        }));
    };
    remove_header = idx=>{
        ga_event('proxy_tester', 'remove header');
        if (this.state.headers.length==1)
            return this.setState({headers: [this.first_header]});
        this.setState(prev_state=>(
            {headers: prev_state.headers.filter(h=>h.idx!=idx)}));
    };
    update_header = (idx, field, value)=>{
        this.setState(prev_state=>({
            headers: prev_state.headers.map(h=>{
                if (h.idx!=idx)
                    return h;
                return {...h, [field]: value};
            }),
        }));
    };
    update_params = (field, value)=>{
        this.setState(prev_state=>({
            params: {...prev_state.params, [field]: value}}));
    };
    go = ()=>{
        ga_event('proxy_tester', 'run test');
        const port = this.state.params.port||this.props.def_port;
        const url = '/api/test/'+port;
        const data = {
            headers: this.state.headers.reduce((acc, el)=>{
                if (!el.header)
                    return acc;
                return {...acc, [el.header]: el.value};
            }, {}),
            method: this.state.params.method,
            url: this.state.params.url,
        };
        this.setState({show_loader: true});
        const _this = this;
        this.etask(function*(){
            this.on('uncaught', e=>{
                console.error(e);
                _this.setState({show_loader: false});
                ga_event('proxy_tester', 'unexpected error', e.message);
            });
            const resp = yield ajax.json({method: 'POST', url, data,
                timeout: 60000});
            _this.setState({show_loader: false});
            if (resp.error)
            {
                _this.setState({warnings: [{msg: resp.error}]});
                $('#warnings_modal').modal();
                ga_event('proxy_tester', 'response has errors',
                    resp.error);
            }
            else
            {
                ga_event('proxy_tester', 'response successful');
                _this.props.update_response(resp);
            }
        });
    };
    render(){
        if (!this.props.ports.length)
            return <Proxy_blank/>;
        return <div className="panel no_border request">
              <Loader show={this.state.show_loader}/>
              <Modal className="warnings_modal" id="warnings_modal"
                title="Warnings:" no_cancel_btn>
                <Warnings warnings={this.state.warnings}/>
              </Modal>
              <div>
                <Request_params params={this.state.params}
                  update={this.update_params}
                  port_select={this.props.port_select}/>
                <Headers headers={this.state.headers}
                  clicked_remove={this.remove_header}
                  clicked_add={this.add_header}
                  update={this.update_header}/>
                <div className="footer_buttons">
                  <Tooltip title="Send a test request">
                    <button onClick={this.go}
                      className="btn btn_lpm btn_lpm_primary">Go</button>
                  </Tooltip>
                </div>
              </div>
            </div>;
    }
}));

const Request_params = ({port_select, params, update})=>{
    const methods = [{key: 'GET', value: 'GET'}, {key: 'POST', value: 'POST'}];
    const method_tip = `Method of a test request. Leave GET if you don't know
    what to choose`;
    const port_changed = port=>{
        ga_event('proxy_tester', 'edit port', port);
        update('port', port);
    };
    const Port_select = port_select;
    return <div className="request_params">
          <Tooltip title="Choose a proxy port that will be used for this test">
            <div className={classnames('field', 'proxy')}>
              <div className="title">Proxy port</div>
              <Port_select val={params.port} on_change={port_changed}/>
            </div>
          </Tooltip>
          <Field params={params} update={update} name="url" type="text"
            tooltip="URL that Proxy Tester will use to send a test request"/>
          <Field params={params} update={update} name="method" type="select"
            data={methods} tooltip={method_tip}/>
        </div>;
};

// XXX krzysztof: Refactor it the same as link tester, field should take
// children. This is too generic and complex
const Field = ({type, update, name, params, tooltip, ...props})=>{
    const fields = {port: 'Proxy port', url: 'URL', method: 'Method'};
    const on_change_wrapper = val=>{
        if (name!='url')
            ga_event('proxy_tester', 'edit '+name);
        update(name, val);
    };
    const on_blur = ()=>{
        if (name=='url')
            ga_event('proxy_tester', 'edit url');
    };
    let Comp;
    if (type=='select')
        Comp = Select;
    else
        Comp = Input;
    const title = fields[name];
    return <Tooltip title={tooltip}>
          <div className={classnames('field', name)}>
            {title && <div className="title">{fields[name]}</div>}
            <Comp on_change_wrapper={on_change_wrapper} type={type}
              val={params[name]} {...props} on_blur={on_blur}/>
          </div>
        </Tooltip>;
};

const Headers = ({headers, clicked_remove, clicked_add, update})=>
    <div className="headers">
      {headers.map((h, i)=>
        <New_header_params clicked_remove={clicked_remove}
          last={i+1==headers.length} clicked_add={clicked_add} header={h}
          key={h.idx} update={update}/>
      )}
    </div>;

class New_header_params extends Pure_component {
    input_changed = field=>value=>
        this.props.update(this.props.header.idx, field, value);
    header_tip = `Header name that will be sent along with the request`;
    value_tip = `Value of the header that will be sent along with the request`;
    render(){
        const {clicked_add, clicked_remove, header, last} = this.props;
        return <div className="header_line">
              <Tooltip title={this.header_tip}>
                <div className="header_input">
                  <Input val={header.header} type="text" placeholder="Header"
                    on_change_wrapper={this.input_changed('header')}/>
                </div>
              </Tooltip>
              <Tooltip title={this.value_tip}>
                <div className="value_input">
                  <Input val={header.value} type="text" placeholder="Value"
                    on_change_wrapper={this.input_changed('value')}/>
                </div>
              </Tooltip>
              <div className="action_icons">
                <Remove_icon tooltip="Remove header"
                  click={()=>clicked_remove(header.idx)}/>
                {last && <Add_icon tooltip="Add header" click={clicked_add}/>}
              </div>
            </div>;
    }
}

export default Proxy_tester;
