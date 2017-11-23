// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true, es6:true*/
import regeneratorRuntime from 'regenerator-runtime';
import React from 'react';
import classnames from 'classnames';
import $ from 'jquery';
import etask from 'hutil/util/etask';
import ajax from 'hutil/util/ajax';
import {presets} from './common.js';

class Index extends React.Component {
    constructor(props){
        super(props);
        this.state = {tab: 'target', cities: {}, fields: {}};
        if (!props.extra)
        {
            window.location.href='/';
            this.proxy = {zones: {}};
        }
        else
            this.proxy = props.extra;
    }
    componentWillMount(){
        const _this = this;
        etask(function*(){
            const consts = yield ajax.json({url: '/api/consts'});
            _this.setState({consts});
        });
    }
    componentDidMount(){ $('[data-toggle="tooltip"]').tooltip(); }
    click_tab(tab){ this.setState({tab}); }
    update_states_and_cities(country, states, cities){
        this.setState(prev_state=>({
            states: Object.assign({}, prev_state.states, {[country]: states}),
            cities: Object.assign({}, prev_state.cities, {[country]: cities}),
        }));
    }
    field_changed(field_name, value){
        this.setState(prev_state=>({fields:
            Object.assign({}, prev_state.fields, {[field_name]: value})}));
    }
    render(){
        let Main_window;
        switch (this.state.tab)
        {
        case 'target': Main_window = Target; break;
        case 'speed': Main_window = To_implement; break;
        case 'zero': Main_window = To_implement; break;
        case 'rotation': Main_window = To_implement; break;
        case 'debug': Main_window = To_implement; break;
        case 'general': Main_window = To_implement; break;
        }
        return (
            <div className="lpm edit_proxy">
              <h3>Edit port {this.props.port}</h3>
              <Nav zones={Object.keys(this.proxy.zones)}/>
              <Nav_tabs curr_tab={this.state.tab} fields={this.state.fields}
                on_tab_click={this.click_tab.bind(this)}/>
              <Main_window {...this.state.consts} cities={this.state.cities}
                states={this.state.states}
                update_states_and_cities={this.update_states_and_cities.bind(this)}
                on_change_field={this.field_changed.bind(this)}
                fields={this.state.fields}/>
            </div>
        );
    }
}

const Nav = props=>{
    return (
        <div className="nav">
          <Field options={props.zones} label="Zone"/>
          <Field options={presets.map(p=>p.title)} label="Preset"/>
          <Action_buttons/>
        </div>
    );
};

const Field = props=>{
    const options = props.options||[];
    return (
        <div className="field">
          <div className="title">{props.label}</div>
          <select>
            {options.map(o=>(
              <option key={o} value="">{o}</option>
            ))}
          </select>
        </div>
    );
};

const Action_buttons = ()=>(
    <div className="action_buttons">
      <button className="btn btn_lpm btn_lpm_normal btn_cancel">Cancel</button>
      <button className="btn btn_lpm btn_save">Save</button>
    </div>
);

const Nav_tabs = props=>{
    return (
        <div className="nav_tabs">
          <Tab_btn {...props} id="target"/>
          <Tab_btn {...props} error id="speed"/>
          <Tab_btn {...props} id="zero"/>
          <Tab_btn {...props} id="rotation"/>
          <Tab_btn {...props} id="debug"/>
          <Tab_btn {...props} id="general"/>
        </div>
    );
};

const Tab_btn = props=>{
    const btn_class = classnames('btn_tab',
        {active: props.curr_tab==props.id});
    const labels = {
        target: 'Targeting',
        speed: 'Request Speed',
        zero: 'Zero fail',
        rotation: 'IP Control',
        debug: 'Debugging',
        general: 'General',
    };
    const tooltips = {
        target: 'Select specific targeting for your proxy exit node',
        speed: 'Control the speed of your request to improve performance',
        zero: 'Configure rules to handle failed requests',
        rotation: 'Set the conditions for which your IPs will change',
        debug: 'Improve the info you receive from the Proxy Manager',
        general: '',
    };
    const fields = {
        target: ['country', 'city', 'state', 'asn'],
        speed: [],
        zero: [],
        rotation: [],
        debug: [],
        general: [],
    };
    const changes = Object.keys(props.fields).filter(f=>{
        const val = props.fields[f];
        return fields[props.id].includes(f) && val && val!='*';
    }).length;
    return (
        <div onClick={()=>props.on_tab_click(props.id)}
          className={btn_class}>
          <Tab_icon id={props.id} error={props.error} changes={changes}/>
          <div className="title">{labels[props.id]}</div>
          <div className="arrow"/>
          <Tooltip_icon title={tooltips[props.id]}/>
        </div>
    );
};

const Tab_icon = props=>{
    const circle_class = classnames('circle_wrapper', {
        active: props.error||props.changes, error: props.error});
    const content = props.error ? '!' : props.changes;
    return (
        <div className={classnames('icon', props.id)}>
          <div className={circle_class}>
            <div className="circle">{content}</div>
          </div>
        </div>
    );
};

const Tooltip_icon = props=>props.title ? (
    <div className="info" data-toggle="tooltip"
      data-placement="bottom" title={props.title}/>) : null;

class Section extends React.Component {
    constructor(props){
        super(props);
        this.state = {focused: false};
        this.tooltip = {
            country: 'Choose your exit country for your requests',
            city: 'The city from which IP will be allocated',
            asn: 'Specifc ASN provider',
            state: 'Specific state in a given country',
        };
    }
    on_focus(){ this.setState({focused: true}); }
    on_blur(){ this.setState({focused: false}); }
    render(){
        const dynamic_class = {
            error: this.props.error,
            correct: this.props.correct,
            active: this.props.active||this.state.focused,
        };
        return (
            <div tabIndex="0" onFocus={this.on_focus.bind(this)}
              onBlur={this.on_blur.bind(this)} className="section_wrapper">
              <div className={classnames('section', dynamic_class)}>
                {this.props.children}
                <div className="icon"/>
                <div className="arrow"/>
              </div>
              <div className="message_wrapper">
                <div className={classnames('message', dynamic_class)}>
                  {this.tooltip[this.props.id]}
                </div>
              </div>
            </div>
        );
    }
}

class Target extends React.Component {
    allowed_countries(){
        let countries = this.props.proxy && this.props.proxy.country.values
            || [];
        if (this.props.zone=='static')
        {
            countries = this.props.proxy.countries.filter(c=>
                ['', 'au', 'br', 'de', 'gb', 'us'].includes(c.value));
        }
        return countries;
    }
    country_changed(e){
        const country = e.target.value;
        if (this.props.cities[country])
            return;
        const _this = this;
        etask(function*(){
            const cities = yield ajax.json({url: '/api/cities/'+country});
            const states = yield ajax.json({url: '/api/regions/'+country});
            _this.props.update_states_and_cities(country, states, cities);
        });
        this.props.on_change_field('city', '');
        this.props.on_change_field('state', '');
        this.props.on_change_field('country', country);
    }
    states(){
        const country = this.props.fields.country;
        return country&&this.props.states&&this.props.states[country]||[];
    }
    state_changed(e){
        this.props.on_change_field('city', '');
        this.props.on_change_field('state', e.target.value);
    }
    cities(){
        const country = this.props.fields.country;
        const state = this.props.fields.state;
        const cities = country&&this.props.cities[country]||[];
        if (state)
            return cities.filter(c=>c.region==state||!c.region||c.region=='*');
        else
            return cities;
    }
    render(){
        // XXX krzysztof: make a generic component for Sections that wrapps
        // common logic like setting new values, validation
        return (
            <div>
              <Section correct={this.props.fields.country &&
                this.props.fields.country!='*'} id="country">
                <div className="desc">Country</div>
                <select value={this.props.fields.country}
                  onChange={this.country_changed.bind(this)}>
                  {this.allowed_countries().map((c, i)=>(
                    <option key={i} value={c.value}>{c.key}</option>
                  ))}
                </select>
              </Section>
              <Section correct={this.props.fields.state &&
                this.props.fields.state!='*'} id="state">
                <div className="desc">State</div>
                <select value={this.props.fields.state}
                  onChange={this.state_changed.bind(this)}>
                  {this.states().map((c, i)=>(
                    <option key={i} value={c.value}>{c.key}</option>
                  ))}
                </select>
              </Section>
              <Section correct={this.props.fields.city &&
                this.props.fields.city!='*'} id="city">
                <div className="desc">City</div>
                <select value={this.props.fields.city}
                  onChange={e=>this.props.on_change_field('city', e.target.value)}>
                  {this.cities().map((c, i)=>(
                    <option key={i} value={c.value}>{c.key}</option>
                  ))}
                </select>
              </Section>
              <Section correct={this.props.fields.asn &&
                this.props.fields.asn!='*'} id="asn">
                <div className="desc">ASN</div>
                <input type="number" value={this.props.fields.asn}
                  onChange={e=>this.props.on_change_field('asn', e.target.value)}/>
              </Section>
            </div>
        );
    }
}

const To_implement = ()=>(
    <div>
      <Section>
        <div className="desc">
          Normal field with text that takes more than one line</div>
        <input type="number"/>
      </Section>
      <Section correct>
        <div className="desc">Correctly chosen option</div>
        <select>
          <option>United States</option>
        </select>
      </Section>
      <Section error>
        <div className="desc">Option with an error</div>
        <select>
          <option>Warsaw</option>
        </select>
      </Section>
      <Section active>
        <div className="desc">Currently focused option by user</div>
        <input type="text"/>
      </Section>
    </div>
);

export default Index;
