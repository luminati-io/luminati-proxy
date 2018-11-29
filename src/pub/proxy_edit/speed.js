// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true, es6:true*/
import React from 'react';
import Pure_component from '../../../www/util/pub/pure_component.js';
import {Config} from './common.js';
import {withContext} from 'recompose';
import PropTypes from 'prop-types';
const provider = provide=>withContext({provide: PropTypes.object},
    ()=>({provide}));

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

export default provider({tab_id: 'speed'})(
class Speed extends Pure_component {
    state = {};
    def_value = {key: 'Any (default)', value: ''};
    zagent_countries = ['au', 'cn', 'gb', 'in', 'nl', 'us'];
    componentDidMount(){
        this.setdb_on('head.locations', locations=>{
            locations && this.setState({locations});
        });
    }
    render(){
        if (!this.state.locations)
            return null;
        const zproxy = country_code=>
            `servercountry-${country_code}.zproxy.lum-superproxy.io`;
        const proxy_data = [this.def_value].concat(
            this.state.locations.countries
            .filter(c=>this.zagent_countries.includes(c.country_id))
            .map(c=>({key: c.country_name, value: zproxy(c.country_id)})));
        return <div>
              <Config type="select" id="proxy" data={proxy_data}/>
              <Config type="select" id="dns" data={dns_opt}/>
              <Config type="select_number" id="race_reqs" allow_zero/>
              <Config type="select_number" id="proxy_count" allow_zero/>
              <Config type="select_number" id="proxy_switch" allow_zero/>
              <Config type="select_number" id="throttle" allow_zero/>
              <Config type="select" id="reverse_lookup"
                data={reverse_lookup_opt}/>
              {this.props.form.reverse_lookup=='file' &&
                <Config type="text" id="reverse_lookup_file"/>}
              {this.props.form.reverse_lookup=='values' &&
                <Config type="textarea" id="reverse_lookup_values"/>}
            </div>;
    }
});
