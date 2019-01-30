// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true, es6:true*/
import React from 'react';
import Pure_component from '/www/util/pub/pure_component.js';
import setdb from '../../../util/setdb.js';
import {Note, Ext_tooltip} from '../common.js';
import {Config, Tab_context} from './common.js';

const carriers = [
    {value: '', key: 'None'},
    {value: 'a1', key: 'A1 Austria'},
    {value: 'aircel', key: 'Aircel'},
    {value: 'airtel', key: 'Airtel'},
    {value: 'att', key: 'AT&T'},
    {value: 'vimpelcom', key: 'Beeline Russia'},
    {value: 'celcom', key: 'Celcom'},
    {value: 'chinamobile', key: 'China Mobile'},
    {value: 'claro', key: 'Claro'},
    {value: 'comcast', key: 'Comcast'},
    {value: 'cox', key: 'Cox'},
    {value: 'dt', key: 'Deutsche Telekom'},
    {value: 'digi', key: 'Digi Malaysia'},
    {value: 'docomo', key: 'Docomo'},
    {value: 'dtac', key: 'DTAC Trinet'},
    {value: 'etisalat', key: 'Etisalat'},
    {value: 'idea', key: 'Idea India'},
    {value: 'kyivstar', key: 'Kyivstar'},
    {value: 'meo', key: 'MEO Portugal'},
    {value: 'megafont', key: 'Megafon Russia'},
    {value: 'mtn', key: 'MTN - Mahanager Telephone'},
    {value: 'mtnza', key: 'MTN South Africa'},
    {value: 'mts', key: 'MTS Russia'},
    {value: 'optus', key: 'Optus'},
    {value: 'orange', key: 'Orange'},
    {value: 'qwest', key: 'Qwest'},
    {value: 'reliance_jio', key: 'Reliance Jio'},
    {value: 'robi', key: 'Robi'},
    {value: 'sprint', key: 'Sprint'},
    {value: 'telefonica', key: 'Telefonica'},
    {value: 'telstra', key: 'Telstra'},
    {value: 'tmobile', key: 'T-Mobile'},
    {value: 'tigo', key: 'Tigo'},
    {value: 'tim', key: 'TIM (Telecom Italia)'},
    {value: 'vodacomza', key: 'Vodacom South Africa'},
    {value: 'vodafone', key: 'Vodafone'},
    {value: 'verizon', key: 'Verizon'},
    {value: 'vivo', key: 'Vivo'},
    {value: 'zain', key: 'Zain'},
    {value: 'umobile', key: 'U-Mobile'},
    {value: 'proximus', key: 'Proximus'},
    {value: 'tele2', key: 'Tele2'},
    {value: 'mobitel', key: 'Mobitel'},
    {value: 'o2', key: 'O2'},
    {value: 'bsnl', key: 'BSNL'},
    {value: 'bouygues', key: 'Bouygues Telecom'},
    {value: 'free', key: 'Free'},
    {value: 'sfr', key: 'SFR'},
    {value: 'mobiltel', key: 'Mobiltel'},
    {value: 'sunrise', key: 'Sunrise Communications'},
    {value: 'digicel', key: 'Digicel'},
    {value: 'three', key: 'Three'},
    {value: 'windit', key: 'Wind'},
];

const carriers_note = (()=>{
    const subject = 'Add new carrier option';
    const n = '%0D%0A';
    const body = `Hi,${n}${n}Didn't find the carrier you're looking for?`
    +`${n}${n}Write here the carrier's name: __________${n}${n}We will add`
    +` it in less than 2 business days!`;
    const mail = 'lumext@luminati.io';
    const mailto = `mailto:${mail}?subject=${subject}&body=${body}`;
    return <a className="link" href={mailto}>More carriers</a>;
})();

export default class Targeting extends Pure_component {
    state = {};
    def_value = {key: 'Any (default)', value: ''};
    set_field = setdb.get('head.proxy_edit.set_field');
    get_curr_plan = setdb.get('head.proxy_edit.get_curr_plan');
    componentDidMount(){
        this.setdb_on('head.locations', locations=>{
            if (!locations)
                return;
            const asns = Object.keys(locations.asns)
                .map(a=>({id: a, label: a}));
            this.setState({locations, asns});
        });
        this.setdb_on('head.proxy_edit.form', form=>{
            form && this.setState({form});
        });
    }
    allowed_countries = ()=>{
        let res = this.state.locations.countries.map(c=>({
            key: c.country_name, value: c.country_id, mob: c.mob}));
        const curr_plan = this.get_curr_plan();
        if (curr_plan&&curr_plan.ip_alloc_preset=='shared_block')
        {
            res = res.filter(r=>
                this.state.locations.shared_countries.includes(r.value));
        }
        if (curr_plan&&curr_plan.mobile)
            res = res.filter(r=>r.mob);
        return [this.def_value, ...res];
    };
    country_changed = ()=>{
        this.set_field('city', []);
        this.set_field('state', '');
    };
    states = ()=>{
        const country = this.state.form.country;
        if (!country||country=='*')
            return [];
        const curr_plan = this.get_curr_plan();
        const res = (this.state.locations.regions[country]||[])
        .filter(r=>!curr_plan||!curr_plan.mobile||r.mob)
        .map(r=>({key: r.region_name, value: r.region_id}));
        return [this.def_value, ...res];
    };
    state_changed = ()=>this.set_field('city', []);
    cities = ()=>{
        const {country, state} = this.state.form;
        let res;
        if (!country)
            return [];
        const curr_plan = this.get_curr_plan();
        res = this.state.locations.cities
        .filter(c=>c.country_id==country)
        .filter(c=>!curr_plan||!curr_plan.mobile||c.mob);
        if (state)
            res = res.filter(c=>c.region_id==state);
        const regions = this.states();
        res = res.map(c=>{
            const region = regions.filter(r=>r.value==c.region_id)[0];
            return {label: c.city_name+' ('+region.value+')', id: c.city_name,
                region: region.value};
        });
        return res;
    };
    city_changed = e=>{
        if (e&&e.length)
            this.set_field('state', e[0].region);
    };
    render(){
        if (!this.state.locations)
            return null;
        if (!this.state.form)
            return null;
        if (this.state.form.ext_proxies)
            return <Note><Ext_tooltip/></Note>;
        const curr_plan = this.get_curr_plan();
        const show_dc_note = curr_plan&&curr_plan.type=='static';
        const show_vips_note = curr_plan&&
            (curr_plan.vips_type=='domain'||curr_plan.vips_type=='domain_p');
        const carrier_disabled = !!this.state.form.asn &&
            !! this.state.form.asn.length;
        return <div className="target">
              <Tab_context.Provider value="target">
                {(show_dc_note||show_vips_note) &&
                  <Note>
                    {show_dc_note &&
                      <span>
                      <div>
                        This port is configured to use Data Center IPs.</div>
                      <span>To change Data Center country visit your </span>
                      </span>
                    }
                    {show_vips_note &&
                      <span>
                      <div>
                        This port is configured to use exclusive Residential
                        IPs.
                      </div>
                      <span> To change Exclusive gIP country visit your </span>
                      </span>
                    }
                    <a className="link" target="_blank"
                      rel="noopener noreferrer"
                      href="https://luminati.io/cp/zones">zone page</a>
                    <span> and change your zone plan.</span>
                  </Note>
                }
                <Config type="select" id="country"
                  data={this.allowed_countries()}
                  on_change={this.country_changed}/>
                <Config type="select" id="state" data={this.states()}
                  on_change={this.state_changed}/>
                <Config type="typeahead" id="city" data={this.cities()}
                  on_change={this.city_changed}/>
                <Config type="typeahead" id="asn" data={this.state.asns}
                  disabled={!!this.state.form.carrier} update_on_input
                  depend_a={this.state.form.zone}/>
                <Config type="select" id="carrier" data={carriers}
                  note={carriers_note} disabled={carrier_disabled}
                  depend_a={this.state.form.zone}/>
              </Tab_context.Provider>
            </div>;
    }
}
