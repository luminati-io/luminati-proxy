// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true, es6:true*/
import React from 'react';
import Pure_component from '/www/util/pub/pure_component.js';
import setdb from '../../../util/setdb.js';
import {Note, Ext_tooltip, Faq_link, with_www_api} from '../common.js';
import {T} from '../common/i18n.js';
import {Config, Tab_context} from './common.js';

const carriers_note = (()=>{
    const subject = 'Add new carrier option';
    const n = '%0D%0A';
    const body = `Hi,${n}${n}Didn't find the carrier you're looking for?`
    +`${n}${n}Write here the carrier's name: __________${n}${n}We will add`
    +` it soon as possible!`;
    const mail = 'lumext@brightdata.com';
    const mailto = `mailto:${mail}?subject=${subject}&body=${body}`;
    return <a className="link" href={mailto}><T>More carriers</T></a>;
})();

export default with_www_api(class Targeting extends Pure_component {
    constructor(props){
        super(props);
        this.state = {};
        this.os_opt = [
            {key: 'Any (default)', value: ''},
            {key: 'Windows', value: 'win'},
            {key: 'MacOS', value: 'mac'},
            {key: 'Android', value: 'android'},
        ];
        this.set_field = setdb.get('head.proxy_edit.set_field');
        this.is_valid_field = setdb.get('head.proxy_edit.is_valid_field');
        this.get_curr_plan = setdb.get('head.proxy_edit.get_curr_plan');
    }
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
            carriers = carriers.map(c=>({id: c.value, label: c.label}));
            this.setState({carriers});
        });
        this.setdb_on('head.proxy_edit.form', form=>{
            if (!form)
                return;
            this.initial_zip = form.zip;
            this.setState({form});
        });
    }
    set_fields(val, fields=[]){
        fields.forEach(f=>this.set_field(f, val));
    }
    allowed_countries = ()=>{
        let res = this.state.locations.countries.map(c=>({
            label: c.country_name, id: c.country_id, mob: c.mob}));
        const curr_plan = this.get_curr_plan();
        let list = [];
        if (curr_plan && curr_plan.country)
        {
            let countries = curr_plan.country.split(' ');
            res = res.filter(r=>countries.includes(r.id));
        }
        else if (curr_plan && curr_plan.ip_alloc_preset=='shared_block')
        {
            res = res.filter(r=>
                (this.state.locations.shared_countries||[]).includes(r.id));
        }
        if (curr_plan && curr_plan.mobile)
            res = res.filter(r=>r.mob);
        return list.concat(res);
    };
    country_changed = ()=>this.set_fields('', ['city', 'state', 'carrier',
        'zip']);
    states = ()=>{
        const {country} = this.state.form;
        if (!country||country=='*')
            return [];
        const curr_plan = this.get_curr_plan();
        const res = (this.state.locations.regions[country]||[])
        .filter(r=>!curr_plan||!curr_plan.mobile||r.mob)
        .map(r=>({label: r.region_name, id: r.region_id}));
        return res;
    };
    state_changed = ()=>this.set_fields('', ['city', 'zip']);
    city_id = (c, region={})=>`${c.city_name}|${region.id||c.region_id}`;
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
            const r = regions.find(rg=>rg.id==c.region_id);
            return {label: c.city_name+' ('+r.id+')', id: this.city_id(c, r)};
        });
        return res;
    };
    zips = ()=>{
        const {country, city, state} = this.state.form;
        const city_name = city && city.split('|')[0];
        let zips = [];
        if (!country)
            return zips;
        zips = this.state.locations.cities
            .filter(c=>c.country_id==country&&c.zip&&c.zip.length);
        if (state)
            zips = zips.filter(c=>c.region_id==state);
        if (city_name)
            zips = zips.filter(c=>c.city_name==city_name);
        let zips_flat = zips.map(z=>z.zip).flat();
        if (this.initial_zip && !zips_flat.includes(this.initial_zip))
            zips_flat.push(this.initial_zip);
        this.initial_zip = null;
        return zips_flat.map(z=>({id: z, label: z}));
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
        return Object.keys(asns).map(a=>({id: Number(a), label: a}));
    };
    carriers = ()=>{
        const {locations, carriers, form: {country}} = this.state;
        const res = new Set(country && locations.carriers[country] ||
            Object.values(locations.carriers).reduce((acc, val)=>
            acc.concat(val), []));
        return carriers.filter(c=>res.has(c.label));
    };
    city_changed = e=>{
        if (e && this.is_valid_field('state'))
            this.set_field('state', e.split('|')[1]);
        let filed_to_empty = e ? 'zip' : 'state';
        this.set_field(filed_to_empty, '');
    };
    zip_changed = z=>{
        const {country} = this.state.form;
        let entry = this.state.locations.cities.find(c=>
            c.country_id==country&&c.zip&&c.zip.includes(z));
        if (entry && this.is_valid_field('city'))
            this.set_field('city', this.city_id(entry));
        if (entry && this.is_valid_field('state'))
            this.set_field('state', entry.region_id);
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
                        <T>This port is configured to use Data Center IPs.</T>
                      </div>
                      <span>
                        <T>To change Data Center country visit your</T>{' '}
                      </span>
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
                      href={`${this.props.www_api}/cp/zones`}>
                      <T>zone page</T>
                    </a>
                    <span>{' '}<T>and change your zone plan.</T></span>
                  </Note>
                }
                <Config type="typeahead" id="country"
                  data={this.allowed_countries()}
                  on_change={this.country_changed}/>
                <Config type="typeahead" id="state" data={this.states()}
                  on_change={this.state_changed}/>
                <Config type="typeahead" id="city" data={this.cities()}
                  on_change={this.city_changed}/>
                <Config type="typeahead" id="zip" data={this.zips()}
                  on_change={this.zip_changed} update_on_input/>
                <Config type="typeahead" id="asn" data={this.asns()}
                  disabled={!!this.state.form.carrier} update_on_input
                  filter_by={filter_by_asns}/>
                <Config type="typeahead" id="carrier" data={this.carriers()}
                  note={carriers_note} disabled={carrier_disabled}/>
                <Config type="select" id="os" data={this.os_opt}
                  disabled={is_static}/>
                <Note>
                  Read more about Targeting here
                  <Faq_link anchor="targeting"/>
                </Note>
              </Tab_context.Provider>
            </div>;
    }
});
