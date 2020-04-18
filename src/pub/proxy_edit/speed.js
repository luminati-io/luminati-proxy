// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true, es6:true*/
import React from 'react';
import Pure_component from '/www/util/pub/pure_component.js';
import {Config, Tab_context} from './common.js';

const reverse_lookup_opt = [
    {key: 'No', value: ''},
    {key: 'DNS', value: 'dns'},
    {key: 'File', value: 'file'},
    {key: 'Values', value: 'values'},
];

const dns_opt = [
    {key: 'Local (default) - resolved by the super proxy', value: 'local'},
    {key: 'Remote - resolved by peer', value: 'remote'},
];

const proxy_opt = [
    {key: 'Automatic (default)', value: ''},
    {key: 'China', value: `servercountry-cn.zproxy.lum-superproxy.io`},
];

export default class Speed extends Pure_component {
    state = {};
    componentDidMount(){
        this.setdb_on('head.proxy_edit.form', form=>{
            form && this.setState({form});
        });
    }
    render(){
        if (!this.state.form)
            return null;
        return <div className="speed">
              <Tab_context.Provider value="speed">
                <Config type="select" id="proxy" data={proxy_opt}/>
                <Config type="select_number" id="race_reqs"/>
                <Config type="select_number" id="throttle"/>
                <Config type="select" id="dns" data={dns_opt}/>
                <Config type="select" id="reverse_lookup"
                  data={reverse_lookup_opt}/>
                {this.state.form.reverse_lookup=='file' &&
                  <Config type="text" id="reverse_lookup_file"/>}
                {this.state.form.reverse_lookup=='values' &&
                  <Config type="textarea" id="reverse_lookup_values"/>}
              </Tab_context.Provider>
            </div>;
    }
}
