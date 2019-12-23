// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true, es6:true*/
import React from 'react';
import Pure_component from '/www/util/pub/pure_component.js';
import setdb from '../../../util/setdb.js';
import {Note, Ext_tooltip, with_www_api} from '../common.js';
import {Config, Tab_context} from './common.js';
import {T} from '../common/i18n.js';

const carriers_note = (()=>{
    const subject = 'Add new carrier option';
    const n = '%0D%0A';
    const body = `Hi,${n}${n}Didn't find the carrier you're looking for?`
    +`${n}${n}Write here the carrier's name: __________${n}${n}We will add`
    +` it in less than 2 business days!`;
    const mail = 'lumext@luminati.io';
    const mailto = `mailto:${mail}?subject=${subject}&body=${body}`;
    return <a className="link" href={mailto}><T>More carriers</T></a>;
})();

export default with_www_api(class Targeting extends Pure_component {
    state = {};
    def_value = {key: 'Any (default)', value: ''};
    os_opt = [
        this.def_value,
       {key: 'Windows', value: 'win'},
       {key: 'MacOS', value: 'mac'},
       {key: 'Android', value: 'android'},
   ];
    set_field = setdb.get('head.proxy_edit.set_field');
    get_curr_plan = setdb.get('head.proxy_edit.get_curr_plan');
    componentDidMount(){
        this.setdb_on('head.locations', locations=>{
            if (!locations)
                return;
            this.setState({locations});
        });
        this.setdb_on('head.defaults', defaults=>{
            if (!defaults)
                return;
            this.setState({defaults});
        });
        this.setdb_on('head.carriers', carriers=>{
            if (!carriers)
                return;
            carriers = carriers.map(c=>({value: c.value, key: c.label}));
            this.setState({carriers});
        });
        this.setdb_on('head.proxy_edit.form', form=>{
            form && this.setState({form});
        });
    }
    allowed_countries = ()=>{
        let res = this.state.locations.countries.map(c=>({
            key: c.country_name, value: c.country_id, mob: c.mob}));
        const curr_plan = this.get_curr_plan();
        if (curr_plan && curr_plan.country)
        {
            res = res.filter(r=>
                curr_plan.country.split(' ').includes(r.value));
        }
        else if (curr_plan && curr_plan.ip_alloc_preset=='shared_block')
        {
            res = res.filter(r=>
                this.state.locations.shared_countries.includes(r.value));
        }
        if (curr_plan && curr_plan.mobile)
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
    asns = ()=>{
        const {country} = this.state.form;
        const {locations} = this.state;
        let asns;
        if (!country)
        {
            asns = Object.values(locations.asns)
                .reduce((acc, el)=>Object.assign(acc, el), {});
        }
        else
            asns = locations.asns[country]||{};
        return Object.keys(asns).map(a=>({id: a, label: a}));
    };
    carriers = ()=>{
        const {country} = this.state.form;
        const {locations, carriers} = this.state;
        let res;
        if (!country)
        {
            res = Object.values(locations.carriers).reduce(
                (acc, el)=>[...acc, ...el], []);
        }
        else
            res = locations.carriers[country];
        return [
            {value: '', key: 'None'},
            ...carriers.filter(c=>(res||[]).includes(c.value)),
        ];
    };
    city_changed = e=>{
        if (e && e.length)
            this.set_field('state', e[0].region);
    };
    render(){
        if (!this.state.locations || !this.state.carriers || !this.state.form)
            return null;
        if (this.state.form.ext_proxies)
            return <Note><Ext_tooltip/></Note>;
        const curr_plan = this.get_curr_plan();
        const is_static = curr_plan && curr_plan.type=='static';
        const show_vips_note = curr_plan &&
            (curr_plan.vips_type=='domain'||curr_plan.vips_type=='domain_p');
        const carrier_disabled = !!this.state.form.asn &&
            !!this.state.form.asn.length;
        const filter_by_asns = (option, props)=>{
            let low_text = props.text.toLowerCase();
            if (low_text=='a'||low_text=='as')
                return false;
            if (low_text.startsWith('as'))
                low_text = low_text.substr(2);
            if (option.label.startsWith(low_text))
                return true;
            return false;
        };
        return <div className="target">
              <Tab_context.Provider value="target">
                {(is_static || show_vips_note) &&
                  <Note>
                    {is_static &&
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
                      href={`${this.props.www_api}/cp/zones`}>zone page</a>
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
                {!this.state.form.asn || !this.state.form.asn[1] &&
                  <Config type="typeahead" id="asn" data={this.asns()}
                    disabled={!!this.state.form.carrier} update_on_input
                    depend_a={this.state.form.zone}
                    filter_by={filter_by_asns}/>
                }
                <Config type="select" id="carrier" data={this.carriers()}
                  note={carriers_note} disabled={carrier_disabled}
                  depend_a={this.state.form.zone}/>
                <Config type="select" id="os" data={this.os_opt}
                  disabled={is_static}/>
              </Tab_context.Provider>
            </div>;
    }
});
