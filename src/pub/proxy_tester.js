// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true, es6:true*/
import React from 'react';
import Pure_component from '/www/util/pub/pure_component.js';
import $ from 'jquery';
import {Loader, Warnings, with_proxy_ports, Add_icon,
    Remove_icon} from './common.js';
import {Input} from './common/controls.js';
import classnames from 'classnames';
import ajax from '../../util/ajax.js';
import Preview from './har_preview.js';
import Proxy_blank from './proxy_blank.js';
import {withRouter} from 'react-router-dom';
import Tooltip from './common/tooltip.js';
import {Modal} from './common/modals.js';
import date from '../../util/date.js';
import {T} from './common/i18n.js';
import {report_exception} from './util.js';
import './css/proxy_tester.less';
const {SEC} = date.ms;

export default class Proxy_tester extends Pure_component {
    state = {};
    update_response = response=>this.setState({response});
    clear_response = ()=>this.setState({response: undefined});
    render(){
        return <div className="proxy_tester vbox">
              <Request update_response={this.update_response}
                no_labels={this.props.no_labels}
                port={this.props.port} hide_port={!!this.props.port}/>
              <Preview cur_preview={this.state.response}
                close={this.clear_response}/>
            </div>;
    }
}

const Request = with_proxy_ports(withRouter(
class Request extends Pure_component {
    first_header = {idx: 0, header: '', value: ''};
    state = {
        headers: [this.first_header],
        max_idx: 0,
        params: {url: 'http://lumtest.com/myip.json'},
        show_loader: false,
        lock: false,
    };
    componentDidMount(){
        const params = this.props.history.location.state||{};
        const url = params.url||this.state.params.url;
        const port = this.props.port||params.port;
        this.setState({params: {url, port}});
        this.setdb_on('head.lock_navigation', lock=>this.setState({lock}));
    }
    add_header = ()=>{
        this.setState(prev_state=>({
            headers: [...prev_state.headers, {idx: prev_state.max_idx+1,
                header: '', value: ''}],
            max_idx: prev_state.max_idx+1,
        }));
    };
    remove_header = idx=>{
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
    key_up = e=>{
        if (e.keyCode==13)
            this.go();
    };
    go = ()=>{
        const port = this.state.params.port||this.props.def_port;
        const url = '/api/test/'+port;
        const data = {
            headers: this.state.headers.reduce((acc, el)=>{
                if (!el.header)
                    return acc;
                return {...acc, [el.header]: el.value};
            }, {}),
            url: this.state.params.url,
        };
        this.setState({show_loader: true});
        const _this = this;
        this.etask(function*(){
            this.on('uncaught', e=>_this.etask(function*(){
                yield report_exception(e, 'proxy_tester.Request.go');
            }));
            this.on('finally', ()=>_this.setState({show_loader: false}));
            const resp = yield ajax.json({method: 'POST', url, data,
                timeout: 120*SEC});
            if (resp.error)
            {
                _this.setState({warnings: [{msg: resp.error}]});
                $('#warnings_modal').modal();
            }
            else
                _this.props.update_response(resp);
        });
    };
    render(){
        if (!this.props.ports.length)
            return <Proxy_blank/>;
        return <T>{t=><div className="panel no_border request">
              <Loader show={this.state.show_loader}/>
              <Modal className="warnings_modal" id="warnings_modal"
                title="Warnings:" no_cancel_btn>
                <Warnings warnings={this.state.warnings}/>
              </Modal>
              <div>
                <Request_params params={this.state.params}
                  no_labels={this.props.no_labels}
                  update={this.update_params}
                  key_up={this.key_up}
                  hide_port={this.props.hide_port}
                  port_select={this.props.port_select}/>
                <Headers headers={this.state.headers}
                  clicked_remove={this.remove_header}
                  clicked_add={this.add_header}
                  update={this.update_header}/>
                <div className="footer_buttons">
                  <Tooltip title={t('Send a test request')}>
                    <button onClick={this.go} disabled={this.state.lock}
                      className="btn btn_lpm btn_lpm_primary">
                      {this.state.lock ? t('Saving proxy') : t('Test')}
                    </button>
                  </Tooltip>
                </div>
              </div>
            </div>}</T>;
    }
}));

const Request_params = ({params, update, ...props})=>{
    const port_changed = port=>{
        update('port', port);
    };
    const Port_select = props.port_select;
    return <T>{t=><div className="request_params">
          {!props.hide_port &&
            <Tooltip
              title={t('Choose a proxy port that will be used for this test')}>
              <div className={classnames('field', 'proxy')}>
                <div className="title">{t('Proxy port')}</div>
                <Port_select val={params.port} on_change={port_changed}/>
              </div>
            </Tooltip>
          }
          <Url_input params={params} update={update} name="url" type="text"
            tooltip="URL that Proxy Tester will use to send a test request"
            on_key_up={props.key_up} no_labels={props.no_labels}/>
        </div>}</T>;
};

// XXX krzysztof: refactoring needed
const Url_input = ({name, ...props})=>{
    const on_change_wrapper = val=>{
        props.update(name, val);
    };
    return <T>{t=><Tooltip title={t(props.tooltip)}>
          <div className={classnames('field', name)}>
            {!props.no_labels && <div className="title">{t('URL')}</div>}
            <Input on_change_wrapper={on_change_wrapper} type={props.type}
              val={props.params[name]} {...props}/>
          </div>
        </Tooltip>}</T>;
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
    header_tip = 'Header name that will be sent along with the request';
    value_tip = 'Value of the header that will be sent along with the request';
    render(){
        const {clicked_add, clicked_remove, header, last} = this.props;
        return <T>{t=><div className="header_line">
              <Tooltip title={t(this.header_tip)}>
                <div className="header_input">
                  <Input val={header.header} type="text"
                    placeholder={t('Header')}
                    on_change_wrapper={this.input_changed('header')}/>
                </div>
              </Tooltip>
              <Tooltip title={t(this.value_tip)}>
                <div className="value_input">
                  <Input val={header.value} type="text"
                    placeholder={t('Value')}
                    on_change_wrapper={this.input_changed('value')}/>
                </div>
              </Tooltip>
              <div className="action_icons">
                <Remove_icon tooltip={t('Remove header')}
                  click={()=>clicked_remove(header.idx)}/>
                {last &&
                  <Add_icon tooltip={t('Add header')} click={clicked_add}/>
                }
              </div>
            </div>}</T>;
    }
}
