// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true, es6:true*/
import React from 'react';
import Pure_component from '../../www/util/pub/pure_component.js';
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
    execute = (url, zone, country)=>{
        if (!/^https?:\/\//.test(url))
        {
            return void this.setState({log: null,
                errors: 'It is not a valid URL to test'});
        }
        this.setState({log: null, loading: true});
        const data = {url, zone, country};
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
        this.setState({log: res.log, next_url: res.loading});
    };
    dismiss_errors = ()=>this.setState({errors: undefined});
    render(){
        return (
            <div className="tracer">
              <Nav title={this.title} subtitle={this.subtitle}/>
              <Request execute={this.execute} set_result={this.set_result}
                loading={this.state.loading}/>
              <Result log={this.state.log} loading={this.state.loading}
                next_url={this.state.next_url}/>
              <Modal_dialog title="Error" open={this.state.errors}
                ok_clicked={this.dismiss_errors} no_cancel_btn>
                <Warning text={this.state.errors}/>
              </Modal_dialog>
            </div>
        );
    }
}

const Result = ({log, loading, next_url})=>{
    if (!log)
        return null;
    return (
        <div className="results instructions">
          <ol>
            {log.map(l=>(
              <Result_row key={l._url} url={l._url} code={l.code}/>
            ))}
            {next_url&&loading&&<Result_row url={next_url}/>}
          </ol>
          {loading&&<Loader_small show msg="Loading..."/>}
        </div>
    );
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
    def_url = 'http://luminati.io';
    state = {url: this.def_url, zone: '', country: ''};
    componentDidMount(){
        this.setdb_on('head.locations', locations=>{
            if (!locations)
                return;
            const def_c = {key: 'Any', value: ''};
            const countries = [def_c].concat(locations.countries.map(c=>
                ({key: c.country_name, value: c.country_id})));
            this.setState({countries});
        });
        this.setdb_on('head.zones', data=>{
            if (!data)
                return;
            const def_z = {key: `Default (${data.def})`, value: ''};
            const zones = data.zones.map(z=>
                ({key: z.name, value: z.name, ...z}));
            zones.unshift(def_z);
            this.setState({zones, def_zone: data.def});
        });
    }
    url_changed = value=>this.setState({url: value});
    zone_changed = zone=>{
        const countries_disabled = this.countries_disabled(zone);
        const diff = {zone, countries_disabled};
        if (countries_disabled)
            diff.country = '';
        this.setState(diff);
    };
    country_changed = country=>this.setState({country});
    go_clicked = ()=>{
        this.props.execute(this.state.url,
            this.state.zone||this.state.def_zone,
            this.state.country);
    };
    countries = ()=>{
        return this.state.countries;
    };
    countries_disabled = (zone_name)=>{
        const zone = this.state.zones.find(z=>z.name==zone_name)||
            this.state.zones.find(z=>z.name==this.state.def_zone);
        if (zone.plan.type=='static')
            return true;
        if (zone.plan.ip_alloc_preset=='shared_block')
            return false;
        const permissions = zone.perm.split(' ')||[];
        if (permissions.includes('country'))
            return false;
        if (zone.plan.type=='static'||
            ['domain', 'domain_p'].includes(zone.plan.vips_type))
        {
            return true;
        }
        return false;
    };
    render(){
        if (!this.state.countries||!this.state.zones)
            return <Loader show/>;
        const countries_disabled = this.props.loading||
            this.state.countries_disabled;
        return (
            <div className="panel no_border request">
              <div className="fields">
                <Field title="Zone">
                  <Select val={this.state.zone} data={this.state.zones}
                    on_change_wrapper={this.zone_changed}
                    disabled={this.props.loading}/>
                </Field>
                <Field title="Country">
                  <Select val={this.state.country} data={this.countries()}
                    on_change_wrapper={this.country_changed}
                    disabled={countries_disabled}/>
                </Field>
                <Field title="URL" className="url">
                  <Input type="text" val={this.state.url}
                    on_change_wrapper={this.url_changed}
                    disabled={this.props.loading}/>
                </Field>
              </div>
              <Go_button on_click={this.go_clicked}
                disabled={this.props.loading}/>
            </div>
        );
    }
}

const Go_button = ({on_click, disabled})=>
    <div className="go_btn_wrapper">
      <button onClick={on_click} className="btn btn_lpm btn_lpm_primary"
        disabled={disabled}>Go</button>
    </div>;

const Field = ({children, title, className})=>
    <div className={classnames('field', className)}>
      <div className="title">{title}</div>
      {children}
    </div>;
