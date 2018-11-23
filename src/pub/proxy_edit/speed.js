// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true, es6:true*/
import React from 'react';
import Pure_component from '../../../www/util/pub/pure_component.js';
import $ from 'jquery';
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
            locations&&this.setState({locations});
        });
        this.setdb_on('head.proxy_edit.disabled_fields', disabled_fields=>{
            disabled_fields&&this.setState({disabled_fields});
        });
    }
    open_modal(){ $('#allocated_ips').modal('show'); }
    get_type(){
        const curr_plan = this.props.get_curr_plan();
        let type;
        if (curr_plan&&curr_plan.type=='static')
            type = 'ips';
        else if (curr_plan&&!!curr_plan.vip)
            type = 'vips';
        return type;
    }
    render(){
        if (!this.state.locations||!this.state.disabled_fields)
            return null;
        const form = this.props.form;
        const pool_size_disabled = form.ips.length||form.vips.length;
        const type = this.get_type();
        const render_modal = ['ips', 'vips'].includes(type);
        let pool_size_note;
        if (!this.state.disabled_fields.pool_size&&render_modal)
        {
            pool_size_note =
                <a className="link" onClick={()=>this.open_modal()}>
                  {'set from allocated '+(type=='ips' ? 'IPs' : 'vIPs')}
                </a>;
        }
        const zproxy = country_code=>
            `servercountry-${country_code}.zproxy.lum-superproxy.io`;
        const proxy_data = [this.def_value].concat(
            this.state.locations.countries
            .filter(c=>this.zagent_countries.includes(c.country_id))
            .map(c=>({key: c.country_name, value: zproxy(c.country_id)})));
        return <div>
              <Config type="select" id="proxy" data={proxy_data}/>
              <Config type="select" id="dns" data={dns_opt}/>
              <Config type="select_number" id="pool_size" allow_zero
                note={pool_size_note} disabled={pool_size_disabled}/>
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
