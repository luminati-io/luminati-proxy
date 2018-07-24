// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true, es6:true*/
import React from 'react';
import Pure_component from '../../www/util/pub/pure_component.js';
import Proxy_blank from './proxy_blank.js';
import {Input, Select, Loader, Nav, Loader_small, Tooltip,
    Circle_li as Li, Modal_dialog, Warning} from './common.js';
import {status_codes} from './util.js';
import classnames from 'classnames';

export default class Tracer extends Pure_component {
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
    execute = (url, port)=>{
        if (!/^https?:\/\//.test(url))
        {
            return void this.setState({log: null, filename: null,
                errors: 'It is not a valid URL to test'});
        }
        this.setState({log: null, filename: null, loading: true,
            tracing_url: null, traced: false});
        const data = {url, port};
        const _this = this;
        this.etask(function*(){
            this.on('uncaught', e=>{
                _this.setState({loading: false});
                console.log(e);
            });
            _this.ws.addEventListener('message', _this.on_message);
            // XXX krzysztof: switch fetch->ajax
            const raw_trace = yield window.fetch('/api/trace', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(data),
            });
            const json = yield raw_trace.json();
            _this.ws.removeEventListener('message', _this.on_message);
            _this.setState({...json, loading: false});
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
              <Result log={this.state.log} loading={this.state.loading}
                tracing_url={this.state.tracing_url}
                loading_page={this.state.loading_page}
                traced={this.state.traced} filename={this.state.filename}/>
              <Modal_dialog title="Error" open={this.state.errors}
                ok_clicked={this.dismiss_errors} no_cancel_btn>
                <Warning text={this.state.errors}/>
              </Modal_dialog>
            </div>;
    }
}

const Result = ({log, loading, tracing_url, filename, loading_page, traced})=>{
    if (!log)
        return null;
    return <div>
          <div className="results instructions">
            <ol>
              {log.map(l=>
                <Result_row key={l.url} url={l.url} code={l.code}/>
              )}
              {tracing_url && loading && <Result_row url={tracing_url}/>}
            </ol>
            {tracing_url && loading && <Loader_small show
                loading_msg="Loading..."/>
            }
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

class Request extends Pure_component {
    def_url = 'http://lumtest.com/myip.json';
    state = {url: this.def_url, port: ''};
    componentDidMount(){
        this.setdb_on('head.proxies_running', proxies=>{
            if (!proxies)
                return;
            const ports = proxies.map(p=>({key: p.port, value: p.port}));
            const port = ports[0]&&ports[0].key;
            this.setState({ports, port});
        });
    }
    url_changed = value=>this.setState({url: value});
    port_changed = port=>this.setState({port});
    go_clicked = ()=>this.props.execute(this.state.url, this.state.port);
    render(){
        if (!this.state.ports)
            return <Loader show/>;
        if (!this.state.ports.length)
            return <Proxy_blank/>;
        const port_tip = `Choose a proxy port that will be used for this
        test.`;
        const url_tip = `URL that will be used as a starting point. Following
        requests will be done based on 'Location' header of the response.`;
        return <div className="panel no_border request">
              <div className="fields">
                <Field title="Proxy port" tooltip={port_tip}>
                  <Select val={this.state.port} data={this.state.ports}
                    on_change_wrapper={this.port_changed}
                    disabled={this.props.loading}/>
                </Field>
                <Field title="URL" className="url" tooltip={url_tip}>
                  <Input type="text" val={this.state.url}
                    on_change_wrapper={this.url_changed}
                    disabled={this.props.loading}/>
                </Field>
              </div>
              <Go_button on_click={this.go_clicked}
                disabled={this.props.loading}/>
            </div>;
    }
}

const Go_button = ({on_click, disabled})=>
    <div className="go_btn_wrapper">
      <Tooltip title="Start testing redirections">
        <button onClick={on_click} className="btn btn_lpm btn_lpm_primary"
          disabled={disabled}>Go</button>
      </Tooltip>
    </div>;

const Field = ({children, title, className, tooltip})=>
    <Tooltip title={tooltip}>
      <div className={classnames('field', className)}>
        <div className="title">{title}</div>
        {children}
      </div>
    </Tooltip>;
