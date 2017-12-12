// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true, es6:true*/
import regeneratorRuntime from 'regenerator-runtime';
import React from 'react';
import classnames from 'classnames';
import $ from 'jquery';
import etask from 'hutil/util/etask';
import ajax from 'hutil/util/ajax';
import {presets} from './common.js';

const tabs = {
    target: {
        label: 'Targeting',
        tooltip: 'Select specific targeting for your proxy exit node',
        fields: {
            country: {
                label: 'Country',
                tooltip: 'Choose your exit country for your requests',
            },
            state: {
                label: 'State',
                tooltip: 'The city from which IP will be allocated',
            },
            city: {
                label: 'City',
                tooltip: 'Specifc ASN provider',
            },
            asn: {
                label: 'ASN',
                tooltip: 'Specific state in a given country',
            },
        },
    },
    speed: {
        label: 'Request Speed',
        tooltip: 'Control the speed of your request to improve performance',
        fields: {
            dns: {
                label: 'DNS Lookup',
                tooltip: 'Location of DNS resolve',
            },
            request_timeout: {
                label: 'Timeout for requests on the super proxy',
                tooltip: `Kill requests to super proxy and try new one if
                    timeout is exceeded`,
            },
            session_init_timeout: {
                label: 'Session establish timeout',
                tooltip: `Time in seconds for the request to complete before
                    estblishing connection to new peer`,
            },
            proxy_count: {
                label: 'Minimum number of super proxies to use',
                tooltip: `Number of super proxies to use in parallel`,
            },
            proxy_switch: {
                label: 'Automatically switch super proxy on failure',
                tooltip: `Number of failed requests(status 403, 429, 502, 503)
                    to switch to different super proxy`,
            },
            throttle: {
                label: 'Throttle requests above given number',
                tooltip: 'Allow maximum number of requests per unit of time',
            },
        },
    },
    zero: {
        label: 'Zero fail',
        tooltip: 'Configure rules to handle failed requests',
        fields: {
            trigger_type: {
                label: 'Create a rule including',
                tooltip: `What is the type of condition to trigger the rule
                    action`,
            },
            trigger_regex: {label: 'Apply for specific domains (regex)'},
            status_code: {label: 'Status Code'},
            status_custom: {label: 'Custom Status Code'},
            action: {
                label: 'Select action to be taken when the rule is met',
                tooltip: `The action to be exected when trigger pulled`,
            },
        },
    },
    rotation: {
        label: 'IP Control',
        tooltip: 'Set the conditions for which your IPs will change',
        fields: {
            ip: {
                label: 'Data center IP',
                tooltip: `Choose specific data center IP (when datacenter
                    zone`,
            },
            pool_size: {
                label: 'Pool size',
                tooltip: `Maintain number of IPs that will be pinged constantly
                    - must have keep_allive to work properly`,
            },
            pool_type: {
                label: 'Pool type',
                tooltip: `How to pull the IPs - roundrobin / sequential`,
            },
            keep_alive: {
                label: 'Keep-alive',
                tooltip: `Chosen number of sec to ping ip and keep it
                    connected. depending on peer availability.`,
            },
            whitelist_ips: {
                label: 'Whitelist IP access',
                tooltip: `Grant proxy access to specific IPs. only those
                    IPs will be able to send requests to this proxy Port`,
            },
            session_random: {
                label: 'Random Session',
                tooltip: `Switch session ID on each request`,
            },
            session: {
                label: 'Explicit Session',
                tooltip: `Insert session ID to maintain the same session`,
            },
            sticky_ip: {
                label: 'Sticky IP',
                tooltip: `When connecting to lpm server from different servers
                    stick sessions to client ips. in that case every connected
                    server will recieve unique session to avoid overriding
                    sessions between machines`,
            },
            max_requests: {
                label: 'Max Requests',
                tooltip: `Change session based on number of requests can be a
                    range or a fixed number`,
            },
            session_duration: {
                label: 'Session Duration (seconds)',
                tooltip: `Change session after fixed number of seconds`,
            },
            seed: {
                label: 'Session ID Seed',
                tooltip: `Seed used for random number generator in random
                    sessions`,
            },
            allow_req_auth: {
                label: 'Allow request authentication',
                tooltip: `Pass auth data per request (use lpm like
                    api)`,
            },
        },
    },
    debug: {
        label: 'Debugging',
        tooltip: 'Improve the info you receive from the Proxy Manager',
        fields: {
            history: {
                label: 'Log request history',
                tooltip: `Keep track of requests made through LPM, view
                    through UI or download from UI`,
            },
            ssl: {
                label: 'Enable SSL analyzing',
                tooltip: `Allow the proxy manager to read HTTPS requests`,
            },
            log: {
                label: 'Log level',
                tooltip: `Decide which data to show in logs`,
            },
            debug: {
                label: 'Luminati request debug info',
                tooltip: `Send debug info on every request`,
            },
        },
    },
    general: {
        label: 'General',
        tooltip: '',
        fields: {
            iface: {
                label: 'Interface',
                tooltip: `Specify a network interface for the machine to use`,
            },
            multiply: {
                label: 'Multiply',
                tooltip: `Create multiple identical ports`,
            },
            socks: {
                label: 'SOCKS 5 port',
                tooltip: `In addition to current port, creates a separate port
                    with a socks5 server (input should be the SOCKS port
                    number)`,
            },
            secure_proxy: {
                label: 'SSL to super proxy',
                tooltip: `Encrypt requests sent to super proxy to avoid
                    detection on DNS`,
            },
            null_response: {
                label: 'URL regex pattern for null response',
                tooltip: `on this url pattern, lpm will return a "null
                    response" without proxying (usefull when users don't want
                    to make a request, but a browser expects 200 response)`,
            },
            bypass_proxy: {
                label: `URL regex for bypassing the proxy manager and send
                    directly to host`,
                tooltip: `Insert URL pattern for which requests will be passed
                    directly to target site without any proxy
                    (super proxy or peer)`,
            },
            direct_include: {
                label: `URL regex for requests to be sent directly from super
                    proxy`,
                tooltip: `Insert URL pattern for which requests will be passed
                    through super proxy directly (not through peers)`,
            },
            direct_exclude: {
                label: `URL regex for requests to not be sent directly from
                    super proxy`,
                tooltip: `Insert URL pattern for which requests will NOT be
                    passed through super proxy`,
            },
        },
    },
};

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
            this.set_model(props.extra);
    }
    componentWillMount(){
        const _this = this;
        etask(function*(){
            const consts = yield ajax.json({url: '/api/consts'});
            const defaults = yield ajax.json({url: '/api/defaults'});
            _this.setState({consts, defaults});
        });
    }
    componentDidMount(){ $('[data-toggle="tooltip"]').tooltip(); }
    set_model(model){
        console.log(model);
        this.model = model;
    }
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
    default_opt(option){
        const default_label = !!this.state.defaults[option] ? 'Yes' : 'No';
        return [
            {key: 'No', value: false},
            {key: 'Default ('+default_label+')', value: ''},
            {key: 'Yes', value: true},
        ];
    }
    nav_field_changed(e){
        console.log('TO IMPLEMENT', e.target.value);
    }
    render(){
        let Main_window;
        switch (this.state.tab)
        {
        case 'target': Main_window = Target; break;
        case 'speed': Main_window = Speed; break;
        case 'zero': Main_window = To_implement; break;
        case 'rotation': Main_window = Rotation; break;
        case 'debug': Main_window = Debug; break;
        case 'general': Main_window = General; break;
        }
        return (
            <div className="lpm edit_proxy">
              <h3>Edit port {this.props.port}</h3>
              <Nav model={this.model} zones={Object.keys(this.model.zones)}
                on_field_change={this.nav_field_changed.bind(this)}/>
              <Nav_tabs curr_tab={this.state.tab} fields={this.state.fields}
                on_tab_click={this.click_tab.bind(this)}/>
              <Main_window {...this.state.consts} cities={this.state.cities}
                states={this.state.states} defaults={this.state.defaults}
                update_states_and_cities={this.update_states_and_cities.bind(this)}
                on_change_field={this.field_changed.bind(this)}
                fields={this.state.fields} model={this.model}
                default_opt={this.default_opt.bind(this)}/>
            </div>
        );
    }
}

const Nav = props=>{
    return (
        <div className="nav">
          <Field on_change={props.on_field_change} options={props.zones}
            label="Zone" value={props.model.zone}/>
          <Field on_change={props.on_field_change}
            label="Preset" options={presets.map(p=>p.title)}/>
          <Action_buttons/>
        </div>
    );
};

const Field = props=>{
    const options = props.options||[];
    return (
        <div className="field">
          <div className="title">{props.label}</div>
          <select value={props.value} onChange={props.on_change}>
            {options.map(o=>(
              <option key={o} value={o}>{o}</option>
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
          <Tab_btn {...props} id="speed"/>
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
    const changes = Object.keys(props.fields).filter(f=>{
        const val = props.fields[f];
        const tab_fields = Object.keys(tabs[props.id].fields);
        return tab_fields.includes(f) && val && val!='*';
    }).length;
    return (
        <div onClick={()=>props.on_tab_click(props.id)}
          className={btn_class}>
          <Tab_icon id={props.id} error={props.error} changes={changes}/>
          <div className="title">{tabs[props.id].label}</div>
          <div className="arrow"/>
          <Tooltip_icon title={tabs[props.id].tooltip}/>
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
                  {tabs[this.props.tab_id].fields[this.props.id].tooltip}
                </div>
              </div>
            </div>
        );
    }
}

const Select = props=>(
    <select value={props.val} onChange={props.on_change_wrapper}>
      {(props.data||[]).map((c, i)=>(
        <option key={i} value={c.value}>{c.key}</option>
      ))}
    </select>
);

const Input = props=>(
    <input type={props.type} value={props.val}
      onChange={e=>props.on_change_wrapper(e, props.id)}
      className={props.className}/>
);

const Double_number = props=>{
    const vals = (''+props.val).split(':');
    const update = (start, end)=>{
        props.on_change_wrapper({target: {value: [start, end].join(':')}}); };
    return (
        <span className="double_field">
          <Input {...props} val={vals[0]} id={props.id+'_start'}
            type="number"
            on_change_wrapper={e=>update(e.target.value, vals[1])}/>
          <span className="divider">÷</span>
          <Input {...props} val={vals[1]} id={props.id+'_end'} type="number"
            on_change_wrapper={e=>update(vals[0], e.target.value)}/>
        </span>
    );
};

const Input_boolean = props=>(
    <div className="radio_buttons">
      <div className="option">
        <input type="radio" checked={props.val=='1'}
          onChange={props.on_change_wrapper} id="enable"
          name={props.id} value="1"/>
        <div className="checked_icon"/>
        <label htmlFor="enable">Enabled</label>
      </div>
      <div className="option">
        <input type="radio" checked={props.val=='0'}
          onChange={props.on_change_wrapper} id="disable"
          name={props.id} value="0"/>
        <div className="checked_icon"/>
        <label htmlFor="disable">Disabled</label>
      </div>
    </div>
);

const Section_field = props=>{
    const {id, fields, on_change, on_change_field, data, type, tab_id,
        sufix, model} = props;
    const on_change_wrapper = (e, _id)=>{
        const curr_id = _id||id;
        if (on_change)
            on_change(e);
        on_change_field(curr_id, e.target.value);
    };
    let Comp;
    switch (type)
    {
    case 'select': Comp = Select; break;
    case 'text':
    case 'number': Comp = Input; break;
    case 'boolean': Comp = Input_boolean; break;
    case 'double_number': Comp = Double_number; break;
    }
    const val = fields[id]||model[id]||'';
    return (
        <Section correct={fields[id] && fields[id]!='*'} id={id}
          tab_id={tab_id}>
          <div className="desc">{tabs[tab_id].fields[id].label}</div>
          <div className="field">
            <Comp fields={fields} id={id} data={data} type={type}
              on_change_wrapper={on_change_wrapper} val={val}/>
            {sufix ? <span className="sufix">{sufix}</span> : null}
          </div>
        </Section>
    );
};

class With_data extends React.Component {
    wrapped_children(){
        return React.Children.map(this.props.children, child=>{
            return React.cloneElement(child, this.props); });
    }
    render(){ return <div>{this.wrapped_children()}</div>; }
}

class Target extends React.Component {
    constructor(props){
        super(props);
        const {fields, model} = this.props;
        const country = fields.country||model.country;
        if (country)
            this.load_names(country);
    }
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
    load_names(country){
        const _this = this;
        etask(function*(){
            const cities = yield ajax.json({url: '/api/cities/'+country});
            const states = yield ajax.json({url: '/api/regions/'+country});
            _this.props.update_states_and_cities(country, states, cities);
        });
    }
    country_changed(e){
        const country = e.target.value;
        if (this.props.cities[country])
            return;
        this.load_names(country);
        this.props.on_change_field('city', '');
        this.props.on_change_field('state', '');
    }
    states(){
        const {fields, model, states} = this.props;
        const country = fields.country||model.country;
        return country&&states&&states[country]||[];
    }
    state_changed(e){ this.props.on_change_field('city', ''); }
    cities(){
        const {country, state} = Object.assign({}, this.props.model,
            this.props.fields);
        const cities = country&&this.props.cities[country]||[];
        if (state)
            return cities.filter(c=>c.region==state||!c.region||c.region=='*');
        else
            return cities;
    }
    render(){
        return (
            <With_data fields={this.props.fields} tab_id="target"
              on_change_field={this.props.on_change_field}
              model={this.props.model}>
              <Section_field type="select" id="country"
                data={this.allowed_countries()}
                on_change={this.country_changed.bind(this)}/>
              <Section_field type="select" id="state" data={this.states()}
                on_change={this.state_changed.bind(this)} />
              <Section_field type="select" id="city" data={this.cities()}/>
              <Section_field type="number" id="asn"/>
            </With_data>
        );
    }
}


class Speed extends React.Component {
    constructor(props){
        super(props);
        this.dns_options = [
            {key: 'Local (default) - resolved by the super proxy',
                value: 'local'},
            {key: 'Remote - resolved by peer', value: 'remote'},
        ];
    }
    render(){
        return (
            <With_data fields={this.props.fields} tab_id="speed"
              on_change_field={this.props.on_change_field}
              model={this.props.model}>
              <Section_field type="select" id="dns"
                data={this.dns_options}/>
              <Section_field type="number" id="request_timeout"
                sufix="seconds"/>
              <Section_field type="number" id="session_init_timeout"
                sufix="seconds"/>
              <Section_field type="number" id="proxy_count"/>
              <Section_field type="number" id="proxy_switch"/>
              <Section_field type="number" id="throttle"/>
            </With_data>
        );
    }
}

class Rotation extends React.Component {
    render() {
        return (
            <With_data fields={this.props.fields} tab_id="rotation"
              on_change_field={this.props.on_change_field}
              model={this.props.model}>
              <Section_field type="text" id="ip"/>
              <Section_field type="number" id="pool_size"/>
              <Section_field type="select" id="pool_type"
                data={this.props.proxy.pool_type.values}/>
              <Section_field type="number" id="keep_alive"/>
              <Section_field type="text" id="whitelist_ips"/>
              <Section_field type="boolean" id="session_random"/>
              <Section_field type="text" id="session"/>
              <Section_field type="select" id="sticky_ip"
                data={this.props.default_opt('sticky_ip')}/>
              <Section_field type="double_number" id="max_requests"/>
              <Section_field type="double_number" id="session_duration"/>
              <Section_field type="text" id="seed"/>
              <Section_field type="select" id="allow_req_auth"
                data={this.props.default_opt('allow_proxy_auth')}/>
            </With_data>
        );
    }
}

class Debug extends React.Component {
    render(){
        return (
            <With_data fields={this.props.fields} tab_id="debug"
              on_change_field={this.props.on_change_field}
              model={this.props.model}>
              <Section_field type="select" id="history"
                data={this.props.default_opt('history')}/>
              <Section_field type="select" id="ssl"
                data={this.props.default_opt('ssl')}/>
              <Section_field type="select" id="log"
                data={this.props.proxy.log.values}/>
              <Section_field type="select" id="debug"
                data={this.props.proxy.debug.values}/>
            </With_data>
        );
    }
}

const Ips_alloc_modal = props=>(
    <Modal id="allocated_ips" title="Select IPs: static">
      <p>{props.ips}</p>
    </Modal>
);

class Rotation extends React.Component {
    constructor(props){
        super(props);
        this.state = {ips: []};
    }
    open_modal(){
        $('#allocated_ips').modal('show'); }
    render() {
        const {proxy, support, form, default_opt} = this.props;
        const pool_size_disabled = !support.pool_size ||
            (form.ips && form.ips.length);
        const pool_size_note = <a onClick={this.open_modal.bind(this)}>
            set from allocated IPs</a>;
        return (
            <With_data {...this.props} tab_id="rotation">
              <Ips_alloc_modal ips={this.state.ips}/>
              <Section_with_fields type="text" id="ip"/>
              <Section_with_fields type="number" id="pool_size" min="0"
                disabled={pool_size_disabled} note={pool_size_note}/>
              <Section_with_fields type="select" id="pool_type"
                data={proxy.pool_type.values}
                disabled={!support.pool_type}/>
              <Section_with_fields type="number" id="keep_alive" min="0"
                disabled={!support.keep_alive}/>
              <Section_with_fields type="text" id="whitelist_ips"/>
              <Section_with_fields type="boolean" id="session_random"
                disabled={!support.session}/>
              <Section_with_fields type="text" id="session"
                disabled={form.session_random &&
                !support.session}/>
              <Section_with_fields type="select" id="sticky_ip"
                data={default_opt('sticky_ip')}
                disabled={!support.sticky_ip}/>
              <Section_with_fields type="double_number" id="max_requests"
                disabled={!support.max_requests}/>
              <Section_with_fields type="double_number" id="session_duration"
                disabled={!support.session_duration}/>
              <Section_with_fields type="text" id="seed"
                disabled={!support.seed}/>
              <Section_with_fields type="select" id="allow_req_auth"
                data={default_opt('allow_proxy_auth')}/>
            </With_data>
        );
    }
}

const Debug = props=>(
    <With_data {...props} tab_id="debug">
      <Section_with_fields type="select" id="history"
        data={props.default_opt('history')}/>
      <Section_with_fields type="select" id="ssl"
        data={props.default_opt('ssl')}/>
      <Section_with_fields type="select" id="log"
        data={props.proxy.log.values}/>
      <Section_with_fields type="select" id="debug"
        data={props.proxy.debug.values}/>
    </With_data>
);

const To_implement = ()=>(
    <div>To implement</div>
);

export default Index;
