// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true, es6:true*/
import React from 'react';
import Pure_component from '../../www/util/pub/pure_component.js';
import {Input, Select, Loader, Nav} from './common.js';
import classnames from 'classnames';

export default class Tracer extends Pure_component {
    title = 'Test affiliate links';
    subtitle = 'Trace links and see all the redirections';
    render(){
        return (
            <div className="tracer">
              <Nav title={this.title} subtitle={this.subtitle}/>
              <Request/>
            </div>
        );
    }
}

class Request extends Pure_component {
    state = {url: '', zone: '', country: ''};
    componentDidMount(){
        this.setdb_on('head.locations', locations=>{
            if (!locations)
                return;
            const countries = locations.countries.map(c=>
                ({key: c.country_name, value: c.country_id}));
            this.setState({countries});
        });
        this.setdb_on('head.consts', consts=>{
            if (!consts)
                return;
            const zones = consts.proxy.zone.values.map(({plans, ...z})=>{
                if (!z.value)
                    return z;
                if (!plans||!plans.length)
                    return null;
                return {...z, plan: plans.slice(-1)[0]};
            }).filter(Boolean);
            this.setState({zones});
        });
    }
    url_changed = value=>this.setState({url: value});
    zone_changed = zone=>this.setState({zone});
    country_changed = country=>this.setState({country});
    go_clicked = ()=>{
        const _this = this;
        this.etask(function*(){
            const {url, zone, country} = _this.state;
            const data = {url, zone, country};
            const raw_trace = yield window.fetch('/api/trace', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(data),
            });
            const json = yield raw_trace.json();
            console.log(json);
        });
    };
    render(){
        if (!this.state.countries||!this.state.zones)
            return <Loader show/>;
        return (
            <div className="panel no_border request">
              <div className="fields">
                <Field title="Zone">
                  <Select val={this.state.zone} data={this.state.zones}
                    on_change_wrapper={this.zone_changed}/>
                </Field>
                <Field title="Country">
                  <Select val={this.state.country} data={this.state.countries}
                    on_change_wrapper={this.country_changed}/>
                </Field>
                <Field title="URL" className="url">
                  <Input type="text" val={this.state.url}
                    on_change_wrapper={this.url_changed}/>
                </Field>
              </div>
              <Go_button on_click={this.go_clicked}/>
            </div>
        );
    }
}

const Go_button = ({on_click})=>(
    <div className="go_btn_wrapper">
      <button onClick={on_click} className="btn btn_lpm btn_lpm_primary">
        Go</button>
    </div>
);

const Field = ({children, title, className})=>(
    <div className={classnames('field', className)}>
      <div className="title">{title}</div>
      {children}
    </div>
);
