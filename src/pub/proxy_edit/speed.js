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

export default class Speed extends Pure_component {
    state = {};
    def_value = {key: 'Any (default)', value: ''};
    zagent_countries = ['au', 'cn', 'gb', 'in', 'nl', 'us', 'hk', 'de', 'sg',
        'ca'];
    componentDidMount(){
        this.setdb_on('head.locations', locations=>{
            locations && this.setState({locations});
        });
        this.setdb_on('head.proxy_edit.form', form=>{
            form && this.setState({form});
        });
    }
    render(){
        if (!this.state.locations)
            return null;
        if (!this.state.form)
            return null;
        const zproxy = country_code=>
            `servercountry-${country_code}.zproxy.lum-superproxy.io`;
        const proxy_data = [this.def_value].concat(
            this.state.locations.countries
            .filter(c=>this.zagent_countries.includes(c.country_id))
            .map(c=>({key: c.country_name, value: zproxy(c.country_id)})));
        return <div className="speed">
              <Tab_context.Provider value="speed">
                <Config type="select" id="proxy" data={proxy_data}/>
                <Config type="select" id="dns" data={dns_opt}/>
                <Config type="select_number" id="race_reqs"/>
                <Config type="select_number" id="proxy_count"/>
                <Config type="select_number" id="proxy_switch"/>
                <Config type="select_number" id="throttle"/>
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
