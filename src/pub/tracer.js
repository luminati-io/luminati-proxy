// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true, es6:true*/
import React from 'react';
import etask from '../../util/etask.js';
import Pure_component from '/www/util/pub/pure_component.js';
import Proxy_blank from './proxy_blank.js';
import {Input, Loader, Nav, Loader_small, Tooltip, Circle_li as Li,
    Modal_dialog, Warning, with_proxy_ports} from './common.js';
import {status_codes, swagger_link_tester_url} from './util.js';
import classnames from 'classnames';
import {withRouter} from 'react-router-dom';

export default withRouter(class Tracer extends Pure_component {
    state = {loading: false};
    title = 'Test affiliate links';
    subtitle = 'Trace links and see all the redirections';
    componentDidMount(){
        this.setdb_on('head.ws', ws=>{
            if (!ws||this.ws)
                return;
            this.ws = ws;
        });
    }
    willUnmount(){
        if (this.ws)
            this.ws.removeEventListener('message', this.on_message);
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
                _this.ws.removeEventListener('message', _this.on_message);
                _this.setState({loading: false});
            });
            this.on('uncaught', e=>console.log(e));
            _this.ws.addEventListener('message', _this.on_message);
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
                loading_page={this.state.loading_page}
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

const Result = ({redirects, loading, tracing_url, filename, loading_page,
    traced})=>
{
    if (!redirects)
        return null;
    return <div>
          <div className="results instructions">
            <ol>
              {redirects.map(l=>
                <Result_row key={l.url} url={l.url} code={l.code}/>
              )}
              {tracing_url && loading && <Result_row url={tracing_url}/>}
            </ol>
            {tracing_url && loading && <Loader_small show
                loading_msg="Loading..."/>}
          </div>
          {traced &&
            <div className="live_preview">
              <Loader show={loading}/>
              {filename && <img src={`api/tmp/${filename}`}/>}
            </div>
          }
        </div>;
};

const Result_row = ({url, code})=>
    <Li>
      {url+' '}
      {code &&
        <Tooltip title={code+' - '+status_codes[code]}>
          <strong>({code})</strong>
        </Tooltip>
      }
    </Li>;

const Request = with_proxy_ports(class Request extends Pure_component {
    def_url = 'http://lumtest.com/myip.json';
    state = {url: this.def_url, port: '', uid: ''};
    url_changed = value=>this.setState({url: value});
    port_changed = port=>this.setState({port});
    uid_changed = uid=>this.setState({uid});
    go_clicked = ()=>this.props.execute(this.state, this.props.def_port);
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
                    disabled={this.props.loading}/>
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
      <Tooltip title="Start testing redirections">
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
