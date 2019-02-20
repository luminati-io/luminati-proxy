// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true, es6:true*/
import Pure_component from '/www/util/pub/pure_component.js';
import React from 'react';
import {withRouter} from 'react-router-dom';
import classnames from 'classnames';
import etask from '../../util/etask.js';
import Proxy_blank from './proxy_blank.js';
import {Loader, Nav, Loader_small, Warning,
    with_proxy_ports} from './common.js';
import {swagger_link_tester_url} from './util.js';
import Preview from './har_preview.js';
import ws from './ws.js';
import {Instructions, Li} from './common/bullets.js';
import Tooltip from './common/tooltip.js';
import {Input} from './common/controls.js';
import {Modal_dialog} from './common/modals.js';

export default withRouter(class Tracer extends Pure_component {
    state = {loading: false};
    title = 'Test affiliate links';
    subtitle = 'Trace links and see all the redirections';
    willUnmount(){
        ws.removeEventListener('message', this.on_message);
    }
    set_result = res=>this.setState(res);
    execute = ({url, port, uid}, def_port)=>{
        url = url.trim();
        port = port||def_port;
        if (!/^https?:\/\//.test(url))
        {
            return void this.setState({redirects: null, filename: null,
                errors: 'It is not a valid URL to test'});
        }
        this.setState({redirects: null, filename: null, loading: true,
            tracing_url: null, traced: false});
        const _this = this;
        this.etask(function*(){
            this.on('finally', e=>{
                ws.removeEventListener('message', _this.on_message);
                _this.setState({loading: false});
            });
            this.on('uncaught', e=>console.log(e));
            ws.addEventListener('message', _this.on_message);
            const raw_trace = yield window.fetch('/api/trace', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({url, port, uid}),
            });
            if (raw_trace.status==200)
            {
                const json = yield raw_trace.json();
                _this.setState({...json});
            }
            else if (raw_trace.status==422)
            {
                _this.setState({errors: <Error_ssl_off port={port}
                    goto_ssl={_this.goto_ssl.bind(_this, port)}/>});
            }
        });
    };
    goto_ssl = port=>{
        const _this = this;
        this.etask(function*(){
            _this.dismiss_errors();
            yield etask.sleep(500);
            _this.props.history.push({pathname: `/proxy/${port}`,
                state: {field: 'ssl'}});
        });
    };
    on_message = event=>{
        const json = JSON.parse(event.data);
        if (json.type!='tracer')
            return;
        const res = json.data;
        this.setState(res);
    };
    dismiss_errors = ()=>this.setState({errors: undefined});
    render(){
        return <div className="tracer">
              <Nav title={this.title} subtitle={this.subtitle}/>
              <Request execute={this.execute} set_result={this.set_result}
                loading={this.state.loading}/>
              <div>
                View the documentation of the API endpoint
                <a className="link api_link" href={swagger_link_tester_url}
                  target="_blank" rel="noopener noreferrer">here</a>
              </div>
              <Result redirects={this.state.redirects}
                loading={this.state.loading}
                tracing_url={this.state.tracing_url}
                traced={this.state.traced} filename={this.state.filename}/>
              <Modal_dialog title="Error" open={this.state.errors}
                ok_clicked={this.dismiss_errors} no_cancel_btn>
                <Warning text={this.state.errors}/>
              </Modal_dialog>
            </div>;
    }
});

const Error_ssl_off = ({port, goto_ssl})=>
    <span>
      <span>Running Link Tester on proxy port <strong>{port}</strong> requires
        enabling SSL analyzing in </span>
      <a className="link" onClick={goto_ssl}>General tab</a>
      <span> in the proxy port configuration page.</span>
    </span>;

const Result = props=>{
    const {redirects, loading, tracing_url, filename, traced} = props;
    if (!redirects)
        return null;
    return <div>
          <Instructions>
            {redirects.map(l=>
              <Result_row key={l.url} url={l.url} log={l.req_log}/>
            )}
            {tracing_url && loading &&
              <Result_row loading url={tracing_url}/>
            }
            {tracing_url && loading &&
              <Loader_small show loading_msg="Loading..."/>
            }
          </Instructions>
          {traced &&
            <div className="live_preview">
              <Loader show={loading}/>
              {filename && <img src={`api/tmp/${filename}`}/>}
            </div>
          }
        </div>;
};

class Result_row extends Pure_component {
    state = {open: false};
    toggle = ()=>this.setState(prev=>({open: !prev.open}));
    render(){
        const tip = 'click to '+(this.state.open ? 'hide' : 'show details');
        const {log} = this.props;
        const code = log && log.response.status;
        const open = this.state.open;
        const classes = classnames('step_title', {open, expandable: !!log});
        return <Li>
              <Tooltip key={this.props.url+tip} title={log ? tip : ''}
                placement="right">
                <span className={classes} onClick={this.toggle}>
                  {this.props.url}
                  {code && <strong className="status_code">({code})</strong>}
                </span>
              </Tooltip>
              {!!log &&
                <div className={classnames('preview_wrapper', 'vbox',
                  {closed: !open, open})}>
                  <Preview cur_preview={log} close={this.toggle}/>
                </div>
              }
            </Li>;
    }
}

const Request = with_proxy_ports(class Request extends Pure_component {
    def_url = 'http://lumtest.com/myip.json';
    state = {url: this.def_url, port: '', uid: ''};
    url_changed = value=>this.setState({url: value});
    port_changed = port=>this.setState({port});
    uid_changed = uid=>this.setState({uid});
    go_clicked = ()=>this.props.execute(this.state, this.props.def_port);
    key_up = e=>{
        if (e.keyCode==13)
            this.go_clicked();
    };
    render(){
        if (!this.props.ports.length)
            return <Proxy_blank/>;
        const port_tip = `Choose a proxy port that will be used for this
            test.`;
        const url_tip = `URL that will be used as a starting point. Following
            requests will be done based on 'Location' header of the response.`;
        const uid_tip = `Add unique tracking parameter inside a request header.
            It can be used for your future analysis.`;
        const Port_select = this.props.port_select;
        return <div className="panel no_border request">
              <div className="fields">
                <Field title="Proxy port" tooltip={port_tip}>
                  <Port_select val={this.state.port}
                    on_change={this.port_changed}
                    disabled={this.props.loading}/>
                </Field>
                <Field title="URL" className="url" tooltip={url_tip}>
                  <Input type="text" val={this.state.url}
                    on_change_wrapper={this.url_changed}
                    disabled={this.props.loading} on_key_up={this.key_up}/>
                </Field>
                <Field title="X-Unique-Id header (optional)" tooltip={uid_tip}
                  className="uid">
                  <Input type="text" val={this.state.uid}
                    on_change_wrapper={this.uid_changed}
                    disabled={this.props.loading}/>
                </Field>
              </div>
              <Send_button on_click={this.go_clicked}
                disabled={this.props.loading}/>
            </div>;
    }
});

const Send_button = ({on_click, disabled})=>
    <div className="go_btn_wrapper">
      <Tooltip key={''+disabled} title="Start testing redirections">
        <button onClick={on_click} className="btn btn_lpm btn_lpm_primary"
          disabled={disabled}>Test</button>
      </Tooltip>
    </div>;

const Field = ({children, title, className, tooltip})=>
    <Tooltip title={tooltip}>
      <div className={classnames('field', className)}>
        <div className="title">{title}</div>
        {children}
      </div>
    </Tooltip>;
