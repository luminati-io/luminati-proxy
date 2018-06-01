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
    }
    url_changed = e=>{
        console.log(e.target.value);
    };
    zone_changed = e=>{
        console.log(e.target.value);
    };
    country_changed = e=>{
        console.log(e.target.value);
    };
    render(){
        return (
            <div className="panel no_boarder request">
              <div>
                <Input type="text" val={this.state.url}
                  onChange={this.url_changed}/>
                <Select val={this.state.zone} onChange={this.zone_changed}/>
                <Select val={this.state.country}
                  onChange={this.country_changed}/>
              </div>
            </div>
        );
    }
}
