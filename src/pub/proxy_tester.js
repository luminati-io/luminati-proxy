// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true, es6:true*/
import React from 'react';
import $ from 'jquery';
import {Row, Col} from 'react-bootstrap';
import {Input, Select, Loader, Modal, Warnings, Nav} from './common.js';
import classnames from 'classnames';
import etask from 'hutil/util/etask';
import {ga_event} from './util.js';
import ajax from 'hutil/util/ajax';
import setdb from 'hutil/util/setdb';
import zurl from 'hutil/util/url';
import Pure_component from '../../www/util/pub/pure_component.js';
import {If} from '/www/util/pub/react.js';
import JSON_viewer from './json_viewer.js';
import Preview from './har_preview.js';

class Proxy_tester extends Pure_component {
    state = {};
    title = 'Proxy Tester';
    subtitle = 'Emulate requests from your proxies to any target URL';
    update_response = response=>this.setState({response});
    clear_response = ()=>this.setState({response: undefined});
    render(){
        return (
            <div className="lpm proxy_tester vbox">
              <Nav title={this.title} subtitle={this.subtitle}/>
              <Request update_response={this.update_response}/>
              <Preview cur_preview={this.state.response}
                close_preview={this.clear_response}/>
            </div>
        );
    }
}

class Request extends Pure_component {
    first_header = {idx: 0, header: '', value: ''};
    default_state = {
        headers: [this.first_header],
        max_idx: 0,
        params: {url: 'http://lumtest.com/myip.json', method: 'GET'},
    };
    state = {...this.default_state, show_loader: false};
    componentDidMount(){
        setTimeout(()=>{
            const url_o = zurl.parse(document.location.href);
            const qs_o = zurl.qs_parse((url_o.search||'').substr(1));
            const url = qs_o.url||this.state.params.url;
            const method = qs_o.method||this.state.params.method;
            const port = qs_o.port||this.state.params.port;
            this.setdb_on('head.proxies_running', proxies=>{
                if (!proxies||!proxies.length)
                    return;
                this.setState({proxies});
                this.setState(prev_state=>{
                    const def_port = proxies[0].port;
                    this.default_state.params.proxy = def_port;
                    return {params: {...prev_state.params,
                        proxy: port||def_port, method, url}};
                });
            });
        });
        this.setdb_on('head.ws', ws=>{
            if (!ws||this.ws)
                return;
            this.ws = ws;
        });
    }
    on_message = event=>{
        const req = JSON.parse(event.data);
        if (this.last_port!=req.details.port)
            return;
        if (this.ws)
            this.ws.removeEventListener('message', this.on_message);
        this.props.update_response(req);
    };
    add_header = ()=>{
        ga_event('proxy-tester-tab', 'add header');
        this.setState(prev_state=>({
            headers: [...prev_state.headers, {idx: prev_state.max_idx+1,
                header: '', value: ''}],
            max_idx: prev_state.max_idx+1,
        }));
    };
    remove_header = idx=>{
        ga_event('proxy-tester-tab', 'remove header');
        if (this.state.headers.length==1)
            this.setState({headers: [this.first_header]});
        else
        {
            this.setState(prev_state=>
                ({headers: prev_state.headers.filter(h=>h.idx!=idx)}));
        }
    };
    update_header = (idx, field, value)=>{
        this.setState(prev_state=>({
            headers: prev_state.headers.map(h=>{
                if (h.idx!=idx)
                    return h;
                else
                    return {...h, [field]: value};
            }),
        }));
    };
    update_params = (field, value)=>{
        this.setState(prev_state=>({
            params: {...prev_state.params, [field]: value}}));
    };
    go = ()=>{
        ga_event('proxy-tester-tab', 'run test');
        this.ws.addEventListener('message', this.on_message);
        this.last_port = this.state.params.proxy;
        if (!this.state.params.proxy)
        {
            ga_event('proxy-tester-tab', 'no proxy chosen');
            this.setState({warnings:
                [{msg: 'You need to choose a proxy first'}]});
            $('#warnings_modal').modal();
            return;
        }
        const check_url = '/api/test/'+this.state.params.proxy;
        const body = {
            headers: this.state.headers.reduce((acc, el)=>{
                if (!el.header)
                    return acc;
                else
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
                ga_event('proxy-tester-tab', 'unexpected error', e.message);
            });
            const raw_check = yield window.fetch(check_url, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(body),
            });
            const json_check = yield raw_check.json();
            _this.setState({show_loader: false});
            if (json_check.error)
            {
                _this.setState({warnings: [{msg: json_check.error}]});
                $('#warnings_modal').modal();
                ga_event('proxy-tester-tab', 'response has errors',
                    json_check.error);
            }
            else
                ga_event('proxy-tester-tab', 'response successful');
        });
    };
    render() {
        return (
            <div className="panel no_border request">
              <Loader show={this.state.show_loader}/>
              <Modal className="warnings_modal" id="warnings_modal"
                title="Warnings:" no_cancel_btn>
                <Warnings warnings={this.state.warnings}/>
              </Modal>
              <div className="panel_body">
                <Request_params params={this.state.params}
                  update={this.update_params}
                  proxies={this.state.proxies}/>
                <Headers headers={this.state.headers}
                  clicked_remove={this.remove_header}
                  clicked_add={this.add_header}
                  update={this.update_header}/>
                <div className="footer_buttons">
                  <button onClick={this.go}
                    className="btn btn_lpm btn_lpm_primary">Go</button>
                </div>
              </div>
            </div>
        );
    }
}

const Request_params = ({params, update, proxies})=>{
    proxies = (proxies||[]).map(p=>({key: p.port, value: p.port}));
    const methods = [{key: 'GET', value: 'GET'}, {key: 'POST', value: 'POST'}];
    return (
        <div className="request_params">
          <Field params={params} update={update} name="proxy" type="select"
            data={proxies}/>
          <Field params={params} update={update} name="url" type="text"/>
          <Field params={params} update={update} name="method" type="select"
            data={methods}/>
        </div>
    );
};

const Field = ({type, update, name, params, ...props})=>{
    const fields = {proxy: 'Proxy port', url: 'URL', method: 'Method'};
    const on_change_wrapper = val=>{
        if (name!='url')
            ga_event('proxy-tester-tab', 'edit '+name);
        update(name, val);
    };
    const on_blur = ()=>{
        if (name=='url')
            ga_event('proxy-tester-tab', 'edit url');
    };
    let Comp;
    if (type=='select')
        Comp = Select;
    else
        Comp = Input;
    const title = fields[name];
    return (
        <div className={classnames('field', name)}>
          <If when={title}>
            <div className="title">{fields[name]}</div>
          </If>
          <Comp on_change_wrapper={on_change_wrapper} type={type}
            val={params[name]} {...props} on_blur={on_blur}/>
        </div>
    );
};

const Headers = ({headers, clicked_remove, clicked_add, update})=>(
    <div className="headers">
      {headers.map((h, i)=>
        <New_header_params clicked_remove={clicked_remove}
          last={i+1==headers.length} clicked_add={clicked_add} header={h}
          key={h.idx} update={update}/>
      )}
    </div>
);

const New_header_params = ({clicked_add, clicked_remove, update, header,
    last})=>
{
    const input_changed = field=>value=>{
        update(header.idx, field, value); };
    return (
        <div className="header_line">
          <Input val={header.header}
            on_change_wrapper={input_changed('header')}
            type="text" placeholder="Header" className="header_input"/>
          <Input val={header.value}
            on_change_wrapper={input_changed('value')}
            type="text" placeholder="Value" className="value_input"/>
          <div className="action_icons">
            <span className="link icon_link top"
              onClick={()=>clicked_remove(header.idx)}>
              <i className="glyphicon glyphicon-trash"/>
            </span>
            <If when={last}>
              <Add_icon click={clicked_add}/>
            </If>
          </div>
        </div>
    );
};

const Add_icon = ({click})=>(
    <span className="link icon_link top right add_header"
      onClick={click}>
      <i className="glyphicon glyphicon-plus"/>
    </span>
);

export default Proxy_tester;
