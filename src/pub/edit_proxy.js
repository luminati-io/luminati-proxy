// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true, es6:true*/
import regeneratorRuntime from 'regenerator-runtime';
import React from 'react';
import classnames from 'classnames';
import $ from 'jquery';
import etask from 'hutil/util/etask';
import ajax from 'hutil/util/ajax';
import {If, Modal, Loader, combine_presets,
    onboarding_steps} from './common.js';
import util from './util.js';
import zurl from 'hutil/util/url';
import {Typeahead} from 'react-bootstrap-typeahead';

const event_tracker = {};
const ga_event = (category, action, label, opt={})=>{
    const id = category+action+label;
    if (!event_tracker[id] || !opt.single)
    {
        event_tracker[id] = true;
        util.ga_event(category, action, label);
    }
};
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
                tooltip: 'Specific state in a given country',
            },
            city: {
                label: 'City',
                tooltip: 'The city from which IP will be allocated',
            },
            asn: {
                label: <span>
                    ASN (
                    <a href="http://bgp.potaroo.net/cidr/autnums.html"
                      target="_blank" rel="noopener noreferrer">
                      ASN list
                    </a>)
                    </span>,
                tooltip: 'Specifc ASN provider',
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
            race_reqs: {
                label: 'Race requests',
                tooltip: `Race request via different super proxies and take the
                    fastest`,
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
            reverse_lookup: {
                label: 'Reverse resolve',
                tooltip: 'resolve DNS from IP to url',
            },
            reverse_lookup_file: {
                label: 'Path to file',
                placeholder: '/path/to/file',
            },
            reverse_lookup_values: {
                label: 'Values',
                placeholder: '1.1.1.1 example.com',
            },
        },
    },
    rules: {
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
                tooltip: `Choose specific data center IP. to ensure
                    all requests are executed using specific Data Center IP.
                    to view the pool of your IPs take a look at 'pool size'
                    option`,
            },
            vip: {
                label: 'vIP',
                tooltip: `Choose specific vIP to ensure all requests are
                    executed using specific vIP. to view the pool of your vIPs
                    take a look at 'pool size' option`,
            },
            pool_size: {
                label: 'Pool size',
                tooltip: `Maintain number of IPs that will be pinged constantly
                    - must have keep_allive to work properly`,
            },
            multiply_ips: {label: 'Multiply IPs'},
            multiply_vips: {label: 'Multiply vIPs'},
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
            port: {
                label: 'Port',
                tooltip: `The port number that will be used for the current
                    proxy configuration`,
            },
            password: {
                label: 'Password',
                tooltip: `Zone password as it appears in your zones page in
                    your Luminati's control panel http://luminati.io/cp/zones`,
            },
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
        this.sp = etask('Index', function*(){ yield this.wait(); });
        this.state = {tab: 'target', form: {zones: {}}, warnings: [],
            errors: {}, show_loader: false, consts: {}};
    }
    componentWillMount(){
        const url_o = zurl.parse(document.location.href);
        const qs_o = zurl.qs_parse((url_o.search||'').substr(1));
        if (qs_o.field)
            this.set_init_focus(qs_o.field);
        const _this = this;
        this.sp.spawn(etask(function*(){
            _this.setState({show_loader: true});
            const locations = yield ajax.json({url: '/api/all_locations'});
            let form, presets, consts, defaults;
            if (!_this.props.extra.proxy)
            {
                consts = yield ajax.json({url: '/api/consts'});
                defaults = yield ajax.json({url: '/api/defaults'});
                const proxies = yield ajax.json({url: '/api/proxies_running'});
                const www_presets = yield ajax.json({url: '/api/www_lpm'});
                presets = combine_presets(www_presets);
                const port = window.location.pathname.split('/').slice(-1)[0];
                form = proxies.filter(p=>p.port==port)[0].config;
            }
            else
            {
                let proxy = _this.props.extra.proxy;
                consts = _this.props.extra.consts;
                defaults = _this.props.extra.defaults;
                presets = _this.props.extra.presets;
                form = Object.assign({}, proxy);
            }
            const preset = _this.guess_preset(form, presets);
            _this.apply_preset(form, preset, presets);
            _this.setState({consts, defaults, show_loader: false,
                presets, locations});
        }));
    }
    componentDidMount(){ $('[data-toggle="tooltip"]').tooltip(); }
    componentWillUnmount(){ this.sp.return(); }
    set_init_focus(field){
        this.init_focus = field;
        let tab;
        for (let [tab_id, tab_o] of Object.entries(tabs))
        {
            if (Object.keys(tab_o.fields).includes(field))
            {
                tab = tab_id;
                break;
            }
        }
        if (tab)
            this.setState({tab});
    }
    guess_preset(form, presets){
        let res;
        for (let p in presets)
        {
            const preset = presets[p];
            if (preset.check(form))
            {
                res = p;
                break;
            }
        }
        if (form.last_preset_applied && presets[form.last_preset_applied])
            res = form.last_preset_applied;
        return res;
    }
    click_tab(tab){
        this.setState({tab});
        ga_event('categories', 'click', tab);
    }
    field_changed(field_name, value){
        this.setState(prev_state=>
            ({form: {...prev_state.form, [field_name]: value}}));
        this.send_ga(field_name);
    }
    send_ga(id){
        if (id=='zone')
        {
            ga_event('top bar', 'edit field', id);
            return;
        }
        let tab_label;
        for (let t in tabs)
        {
            if (Object.keys(tabs[t].fields).includes(id))
            {
                tab_label = tabs[t].label;
                break;
            }
        }
        ga_event(tab_label, 'edit field', id, {single: true});
    }
    is_valid_field(field_name){
        const proxy = this.state.consts.proxy;
        const form = this.state.form;
        if (!proxy)
            return false;
        const zone = form.zone||proxy.zone.def;
        if (['city', 'state'].includes(field_name) &&
            (!form.country||form.country=='*'))
        {
            return false;
        }
        const details = proxy.zone.values.filter(z=>z.value==zone)[0];
        const permissions = details&&details.perm.split(' ')||[];
        if (field_name=='vip')
        {
            const plan = details&&details.plans[details.plans.length-1]||{};
            return !!plan.vip;
        }
        if (['country', 'state', 'city', 'asn', 'ip'].includes(field_name))
            return permissions.includes(field_name);
        return true;
    }
    apply_preset(_form, preset, presets){
        const form = Object.assign({}, _form);
        const last_preset = form.last_preset_applied ?
            presets[form.last_preset_applied] : null;
        if (last_preset&&last_preset.clean)
            last_preset.clean(form);
        form.preset = preset;
        form.last_preset_applied = preset;
        presets[preset].set(form);
        if (form.session===true)
        {
            form.session_random = true;
            form.session = '';
        }
        else
            form.session_random = false;
        if (form.rule)
        {
            form.status_code = form.rule.status;
            form.status_custom = form.rule.custom;
            form.trigger_regex = form.rule.url;
            if (form.rule.action)
            {
                form.action = form.rule.action.value;
                form.trigger_type = 'status';
            }
            delete form.rule;
        }
        if (form.reverse_lookup===undefined)
        {
            if (form.reverse_lookup_dns)
                form.reverse_lookup = 'dns';
            else if (form.reverse_lookup_file)
                form.reverse_lookup = 'file';
            else if (form.reverse_lookup_values)
            {
                form.reverse_lookup = 'values';
                form.reverse_lookup_values = form.reverse_lookup_values
                .join('\n');
            }
        }
        if (!form.ips)
            form.ips = [];
        if (!form.vips)
            form.vips = [];
        form.whitelist_ips = (form.whitelist_ips||[]).join(',');
        if (form.city && !Array.isArray(form.city) && form.state)
            form.city = [{id: form.city,
                label: form.city+' ('+form.state+')'}];
        else if (!Array.isArray(form.city))
            form.city = [];
        this.setState({form});
    }
    default_opt(option){
        const default_label = !!this.state.defaults[option] ? 'Yes' : 'No';
        return [
            {key: 'No', value: false},
            {key: 'Default ('+default_label+')', value: ''},
            {key: 'Yes', value: true},
        ];
    }
    set_errors(_errors){
        const errors = _errors.reduce((acc, e)=>
            Object.assign(acc, {[e.field]: e.msg}), {});
        this.setState({errors, error_list: _errors});
    }
    save_from_modal(){
        const _this = this;
        return etask(function*(){
            const data = _this.prepare_to_save();
            yield _this.persist(data);
        });
    }
    persist(data){
        this.setState({show_loader: true});
        const update_url = '/api/proxies/'+this.props.port;
        const _this = this;
        return etask(function*(){
            // XXX krzysztof: update hutil on github and replace fetch with
            // ajax.json
            const raw_update = yield window.fetch(update_url, {
                method: 'PUT',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({proxy: data}),
            });
            const status = yield ajax.json({
                url: '/api/proxy_status/'+data.port});
            _this.setState({show_loader: false});
            if (status.status=='ok')
            {
                ga_event('top bar', 'click save', 'successful');
                const curr_step = JSON.parse(window.localStorage.getItem(
                    'quickstart-step'));
                if (curr_step==onboarding_steps.ADD_PROXY)
                {
                    window.localStorage.setItem('quickstart-step',
                        onboarding_steps.ADD_PROXY_DONE);
                    window.localStorage.setItem('quickstart-first-proxy',
                       data.port);
                    window.location = '/intro';
                }
                else
                    window.location = '/';
            }
            else
            {
                ga_event('top bar', 'click save', 'failed');
                _this.setState({error_list: [{msg: status.status}]});
                $('#save_proxy_errors').modal('show');
            }
        });
    }
    save(){
        const data = this.prepare_to_save();
        const check_url = '/api/proxy_check/'+this.props.port;
        this.setState({show_loader: true});
        const _this = this;
        this.sp.spawn(etask(function*(){
            this.on('uncaught', e=>{
                console.log(e);
                _this.setState({show_loader: false});
            });
            const raw_check = yield window.fetch(check_url, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(data),
            });
            const json_check = yield raw_check.json();
            const errors = json_check.filter(e=>e.lvl=='err');
            _this.set_errors(errors);
            _this.setState({show_loader: false});
            if (errors.length)
            {
                ga_event('top bar', 'click save', 'failed');
                $('#save_proxy_errors').modal('show');
                return;
            }
            const warnings = json_check.filter(w=>w.lvl=='warn');
            if (warnings.length)
            {
                _this.setState({warnings});
                $('#save_proxy_warnings').modal('show');
            }
            else
                yield _this.persist(data);
        }));
    }
    prepare_to_save(){
        const save_form = Object.assign({}, this.state.form);
        for (let field in save_form)
        {
            if (!this.is_valid_field(field) || save_form[field]===null)
                save_form[field] = '';
        }
        const effective = attr=>{
            return save_form[attr]===undefined ?
                this.state.defaults[attr] : save_form[attr];
        };
        save_form.zone = save_form.zone||this.state.consts.proxy.zone.def;
        if (save_form.session_random)
            save_form.session = true;
        save_form.history = effective('history');
        save_form.ssl = effective('ssl');
        save_form.max_requests = effective('max_requests');
        save_form.session_duration = effective('session_duration');
        save_form.keep_alive = effective('keep_alive');
        save_form.pool_size = effective('pool_size');
        save_form.proxy_type = 'persist';
        const action_raw = save_form.action=='retry' ?
            {ban_ip: "60min", retry: true} : {};
        save_form.action = {
            label: "Retry request(up to 20 times)",
            raw: action_raw,
            value: save_form.action,
        };
        const rule_status = save_form.status_code=='Custom'
            ? save_form.status_custom : save_form.status_code;
        if (save_form.trigger_type)
        {
            save_form.rule = {
                url: save_form.trigger_regex||'**',
                action: save_form.action||{},
                status: save_form.status_code,
            };
            if (save_form.rule.status=='Custom')
                save_form.rule.custom = save_form.status_custom;
            save_form.rules = {
                post: [{
                    res: [{
                        head: true,
                        status: {
                            type: 'in',
                            arg: rule_status||'',
                        },
                        action: action_raw,
                    }],
                    url: save_form.trigger_regex+'/**',
                }],
            };
        }
        else {
            delete save_form.rules;
            delete save_form.rule;
        }
        delete save_form.trigger_type;
        delete save_form.status_code;
        delete save_form.status_custom;
        delete save_form.trigger_regex;
        delete save_form.action;
        if (save_form.reverse_lookup=='dns')
            save_form.reverse_lookup_dns = true;
        else
            save_form.reverse_lookup_dns = '';
        if (save_form.reverse_lookup!='file')
            save_form.reverse_lookup_file = '';
        if (save_form.reverse_lookup=='values')
        {
            save_form.reverse_lookup_values =
                save_form.reverse_lookup_values.split('\n');
        }
        else
            save_form.reverse_lookup_values = '';
        delete save_form.reverse_lookup;
        save_form.whitelist_ips = save_form.whitelist_ips.split(',')
        .filter(Boolean);
        if (save_form.city.length)
            save_form.city = save_form.city[0].id;
        else
            save_form.city = '';
        if (!save_form.max_requests)
            save_form.max_requests = 0;
        this.state.presets[save_form.preset].set(save_form);
        delete save_form.preset;
        return save_form;
    }
    get_curr_plan(){
        const zone_name = this.state.form.zone||
            this.state.consts.proxy.zone.def;
        const zones = this.state.consts.proxy.zone.values;
        const curr_zone = zones.filter(p=>p.key==zone_name);
        let curr_plan;
        if (curr_zone.length)
            curr_plan = curr_zone[0].plans.slice(-1)[0];
        return curr_plan;
    }
    render(){
        let Main_window;
        switch (this.state.tab)
        {
        case 'target': Main_window = Targeting; break;
        case 'speed': Main_window = Speed; break;
        case 'rules': Main_window = Rules; break;
        case 'rotation': Main_window = Rotation; break;
        case 'debug': Main_window = Debug; break;
        case 'general': Main_window = General; break;
        }
        if (!this.state.consts.proxy)
            Main_window = ()=>null;
        const support = this.state.presets && this.state.form.preset &&
            this.state.presets[this.state.form.preset].support||{};
        const zones = this.state.consts.proxy&&
            this.state.consts.proxy.zone.values||[];
        const default_zone=this.state.consts.proxy&&
            this.state.consts.proxy.zone.def;
        return (
            <div className="lpm edit_proxy">
              <Loader show={this.state.show_loader}/>
              <h3>Edit port {this.props.port}</h3>
              <Nav zones={zones} default_zone={default_zone}
                form={this.state.form} presets={this.state.presets}
                on_change_field={this.field_changed.bind(this)}
                on_change_preset={this.apply_preset.bind(this)}
                save={this.save.bind(this)}/>
              <Nav_tabs curr_tab={this.state.tab} form={this.state.form}
                on_tab_click={this.click_tab.bind(this)}
                errors={this.state.errors}/>
              <Main_window proxy={this.state.consts.proxy}
                locations={this.state.locations}
                defaults={this.state.defaults} form={this.state.form}
                init_focus={this.init_focus}
                is_valid_field={this.is_valid_field.bind(this)}
                on_change_field={this.field_changed.bind(this)}
                support={support} errors={this.state.errors}
                default_opt={this.default_opt.bind(this)}
                get_curr_plan={this.get_curr_plan.bind(this)}/>
              <Modal className="warnings_modal" id="save_proxy_warnings"
                title="Warnings:" click_ok={this.save_from_modal.bind(this)}>
                <Warnings warnings={this.state.warnings}/>
              </Modal>
              <Modal className="warnings_modal" id="save_proxy_errors"
                title="Errors:" no_cancel_btn>
                <Warnings warnings={this.state.error_list}/>
              </Modal>
            </div>
        );
    }
}

const Warnings = props=>(
    <div>
      {(props.warnings||[]).map((w, i)=><Warning key={i} text={w.msg}/>)}
    </div>
);

const Warning = props=>(
    <div className="warning">
      <div className="warning_icon"/>
      <div className="text">{props.text}</div>
    </div>
);

const Nav = props=>{
    const update_preset = val=>{
        props.on_change_preset(props.form, val, props.presets);
        ga_event('top bar', 'edit field', 'preset');
    };
    const update_zone = val=>{
        const zone_name = val||props.default_zone;
        const zone = props.zones.filter(z=>z.key==zone_name)[0]||{};
        props.on_change_field('zone', val);
        props.on_change_field('password', zone.password);
        if (props.form.ips.length || props.form.vips.length)
            props.on_change_field('pool_size', 0);
        props.on_change_field('ips', []);
        props.on_change_field('vips', []);
        props.on_change_field('multiply_ips', false);
        props.on_change_field('multiply_vips', false);
        props.on_change_field('multiply', 1);
    };
    const presets_opt = Object.keys(props.presets||{}).map(p=>
        ({key: props.presets[p].title, value: p}));
    return (
        <div className="nav">
          <Field on_change={update_zone} options={props.zones} label="Zone"
            value={props.form.zone}/>
          <Field on_change={update_preset} label="Preset" options={presets_opt}
            value={props.form.preset}/>
          <Action_buttons save={props.save}/>
        </div>
    );
};

const Field = props=>{
    const options = props.options||[];
    return (
        <div className="field">
          <div className="title">{props.label}</div>
          <select value={props.value}
            onChange={e=>props.on_change(e.target.value)}>
            {options.map(o=>(
              <option key={o.key} value={o.value}>{o.key}</option>
            ))}
          </select>
        </div>
    );
};

class Action_buttons extends React.Component {
    cancel_clicked(){ ga_event('top bar', 'cancel'); }
    save_clicked(){ this.props.save(); }
    render(){
        return (
            <div className="action_buttons">
              <a href="/proxies" onClick={this.cancel_clicked.bind(this)}
                className="btn btn_lpm btn_lpm_normal btn_cancel">
                Cancel
              </a>
              <button className="btn btn_lpm btn_save"
                onClick={this.save_clicked.bind(this)}>Save</button>
            </div>
        );
    }
}

const Nav_tabs = props=>(
    <div className="nav_tabs">
      <Tab_btn {...props} id="target"/>
      <Tab_btn {...props} id="speed"/>
      <Tab_btn {...props} id="rules"/>
      <Tab_btn {...props} id="rotation"/>
      <Tab_btn {...props} id="debug"/>
      <Tab_btn {...props} id="general"/>
    </div>
);

const Tab_btn = props=>{
    const btn_class = classnames('btn_tab',
        {active: props.curr_tab==props.id});
    const tab_fields = Object.keys(tabs[props.id].fields);
    const changes = Object.keys(props.form).filter(f=>{
        const val = props.form[f];
        const is_empty_arr = Array.isArray(val) && !val[0];
        return tab_fields.includes(f) && val && !is_empty_arr;
    }).length;
    const errors = Object.keys(props.errors).filter(f=>tab_fields.includes(f));
    return (
        <div onClick={()=>props.on_tab_click(props.id)}
          className={btn_class}>
          <Tab_icon id={props.id} changes={changes}
            error={errors.length}/>
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

const Section_header = props=>{
    return props.text ? <div className="header">{props.text}</div> : null;
};

class Section extends React.Component {
    constructor(props){
        super(props);
        this.state = {focused: false};
    }
    on_focus(){
        if (!this.props.disabled)
            this.setState({focused: true});
    }
    on_blur(){ this.setState({focused: false}); }
    render(){
        const error = !!this.props.error_msg;
        const dynamic_class = {
            error,
            correct: this.props.correct && !error,
            active: this.state.focused && !error,
            disabled: this.props.disabled,
        };
        const message = this.props.error_msg
            ? this.props.error_msg
            : tabs[this.props.tab_id].fields[this.props.id].tooltip;
        return (
            <div tabIndex="0" onFocus={this.on_focus.bind(this)} autoFocus
              onBlur={this.on_blur.bind(this)} className="section_wrapper">
              <div className={classnames('outlined', dynamic_class)}>
                <Section_header text={this.props.header}/>
                <div className="section_body">
                  {this.props.children}
                </div>
                <div className="icon"/>
                <div className="arrow"/>
              </div>
              <div className="message_wrapper">
                <div className={classnames('message', dynamic_class)}>
                  {message}
                </div>
              </div>
            </div>
        );
    }
}

const Select = props=>{
    const update = val=>{
        if (val=='true')
            val = true;
        else if (val=='false')
            val = false;
        props.on_change_wrapper(val);
    };
    return (
        <select value={''+props.val}
          onChange={e=>update(e.target.value)} disabled={props.disabled}>
          {(props.data||[]).map((c, i)=>(
            <option key={i} value={c.value}>{c.key}</option>
          ))}
        </select>
    );
};

const Textarea = props=>{
    return (
        <textarea value={props.val} rows="3" placeholder={props.placeholder}
          onChange={e=>props.on_change_wrapper(e.target.value)}/>
    );
};

const Input = props=>{
    const update = val=>{
        if (props.type=='number' && val)
            val = Number(val);
        props.on_change_wrapper(val, props.id);
    };
    return (
        <input type={props.type} value={props.val} disabled={props.disabled}
          onChange={e=>update(e.target.value)} className={props.className}
          min={props.min} max={props.max} placeholder={props.placeholder}/>
    );
};

const Double_number = props=>{
    const vals = (''+props.val).split(':');
    const update = (start, end)=>{
        props.on_change_wrapper([start||0, end].join(':')); };
    return (
        <span className="double_field">
          <Input {...props} val={vals[0]||''} id={props.id+'_start'}
            type="number" disabled={props.disabled}
            on_change_wrapper={val=>update(val, vals[1])}/>
          <span className="divider">÷</span>
          <Input {...props} val={vals[1]||''} id={props.id+'_end'}
            type="number" disabled={props.disabled}
            on_change_wrapper={val=>update(vals[0], val)}/>
        </span>
    );
};

const Input_boolean = props=>{
    const update = val=>{
        val = val=='true';
        props.on_change_wrapper(val);
    };
    return (
        <div className="radio_buttons">
          <div className="option">
            <input type="radio" checked={props.val==true}
              onChange={e=>update(e.target.value)} id={props.id+'_enable'}
              name={props.id} value="true" disabled={props.disabled}/>
            <div className="checked_icon"/>
            <label htmlFor={props.id+'_enable'}>Enabled</label>
          </div>
          <div className="option">
            <input type="radio" checked={props.val==false}
              onChange={e=>update(e.target.value)} id={props.id+'_disable'}
              name={props.id} value="false" disabled={props.disabled}/>
            <div className="checked_icon"/>
            <label htmlFor={props.id+'_disable'}>Disabled</label>
          </div>
        </div>
    );
};

const Typeahead_wrapper = props=>(
    <Typeahead options={props.data} maxResults={10}
      minLength={1} disabled={props.disabled} selectHintOnEnter
      onChange={props.on_change_wrapper} selected={props.val}/>
);

const Section_with_fields = props=>{
    const {id, form, tab_id, header, errors, init_focus} = props;
    const disabled = props.disabled || !props.is_valid_field(id);
    const is_empty_arr = Array.isArray(form[id]) && !form[id][0];
    const correct = form[id] && form[id]!='*' && !is_empty_arr;
    const error_msg = errors[id];
    return (
        <Section correct={correct} disabled={disabled} id={id} tab_id={tab_id}
          header={header} error_msg={error_msg} init_focus={init_focus}>
          <Section_field {...props} disabled={disabled} correct={correct}/>
        </Section>
    );
};

const Section_field = props=>{
    const {tab_id, id, form, sufix, note, type, disabled, data, on_change,
        on_change_field, min, max} = props;
    const on_change_wrapper = (value, _id)=>{
        const curr_id = _id||id;
        if (on_change)
            on_change(value);
        on_change_field(curr_id, value);
    };
    let Comp;
    switch (type)
    {
    case 'select': Comp = Select; break;
    case 'boolean': Comp = Input_boolean; break;
    case 'double_number': Comp = Double_number; break;
    case 'typeahead': Comp = Typeahead_wrapper; break;
    case 'textarea': Comp = Textarea; break;
    default: Comp = Input;
    }
    const val = form[id]===undefined ? '' : form[id];
    const placeholder = tabs[tab_id].fields[id].placeholder||'';
    return (
        <div className={classnames('field_row', {disabled})}>
          <div className="desc">{tabs[tab_id].fields[id].label}</div>
          <div className="field">
            <div className="inline_field">
              <Comp form={form} id={id} data={data} type={type}
                on_change_wrapper={on_change_wrapper} val={val}
                disabled={disabled} min={min} max={max}
                placeholder={placeholder}/>
              {sufix ? <span className="sufix">{sufix}</span> : null}
            </div>
            {note ? <Note>{note}</Note> : null}
          </div>
        </div>
    );
};

class With_data extends React.Component {
    wrapped_children(){
        const props = Object.assign({}, this.props);
        delete props.children;
        return React.Children.map(this.props.children, child=>{
            return React.cloneElement(child, props); });
    }
    render(){ return <div>{this.wrapped_children()}</div>; }
}

class Targeting extends React.Component {
    constructor(props){
        super(props);
        this.def_value = {key: 'Any (default)', value: ''};
    }
    allowed_countries(){
        const res = this.props.locations.countries.map(c=>
            ({key: c.country_name, value: c.country_id}));
        return [this.def_value, ...res];
    }
    country_changed(){
        this.props.on_change_field('city', []);
        this.props.on_change_field('state', '');
    }
    states(){
        const country = this.props.form.country;
        if (!country)
            return [];
        const res = this.props.locations.regions[country].map(r=>
            ({key: r.region_name, value: r.region_id}));
        return [this.def_value, ...res];
    }
    state_changed(){ this.props.on_change_field('city', []); }
    cities(){
        const {country, state} = this.props.form;
        let res;
        if (!country)
            return [];
        res = this.props.locations.cities.filter(c=>c.country_id==country);
        if (state)
            res = res.filter(c=>c.region_id==state);
        const regions = this.states();
        res = res.map(c=>{
            const region = regions.filter(r=>r.value==c.region_id)[0];
            return {label: c.city_name+' ('+region.value+')', id: c.city_name,
                region: region.value};
        });
        return res;
    }
    city_changed(e){
        if (e&&e.length)
            this.props.on_change_field('state', e[0].region);
    }
    country_disabled(){
        const curr_plan = this.props.get_curr_plan();
        return curr_plan&&curr_plan.type=='static';
    }
    render(){
        return (
            <With_data {...this.props} tab_id="target">
              <Note>
                <span>To change Data Center country visit your </span>
                <a target="_blank" rel="noopener noreferrer"
                  href="https://luminati.io/cp/zones">zone page</a>
                <span> and change your zone plan.</span>
              </Note>
              <Section_with_fields type="select" id="country"
                data={this.allowed_countries()}
                on_change={this.country_changed.bind(this)}
                disabled={this.country_disabled()}/>
              <Section_with_fields type="select" id="state"
                data={this.states()}
                on_change={this.state_changed.bind(this)}/>
              <Section_with_fields type="typeahead" id="city"
                data={this.cities()}
                on_change={this.city_changed.bind(this)}/>
              <Section_with_fields type="number" id="asn"/>
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
        this.reverse_lookup_options = [{key: 'No', value: ''},
            {key: 'DNS', value: 'dns'}, {key: 'File', value: 'file'},
            {key: 'Values', value: 'values'}];
    }
    render(){
        return (
            <With_data {...this.props} tab_id="speed">
              <Section_with_fields type="select" id="dns"
                data={this.dns_options}/>
              <Section_with_fields type="number" id="request_timeout"
                sufix="seconds" min="0"/>
              <Section_with_fields type="number" id="session_init_timeout"
                sufix="seconds" min="0"/>
              <Section_with_fields type="number" id="race_reqs" min="1"
                max="3"/>
              <Section_with_fields type="number" id="proxy_count" min="1"/>
              <Section_with_fields type="number" id="proxy_switch" min="0"/>
              <Section_with_fields type="number" id="throttle" min="0"/>
              <Section id="reverse_lookup">
                <Section_field type="select" id="reverse_lookup" tab_id="speed"
                  {...this.props} data={this.reverse_lookup_options}/>
                <If when={this.props.form.reverse_lookup=='file'}>
                  <Section_field type="text" id="reverse_lookup_file"
                    tab_id="speed" {...this.props}/>
                </If>
                <If when={this.props.form.reverse_lookup=='values'}>
                  <Section_field type="textarea" id="reverse_lookup_values"
                    tab_id="speed" {...this.props}/>
                </If>
              </Section>
            </With_data>
        );
    }
}

const Note = props=>(
    <div className="note">
      <span className="highlight">Note:</span>
      <span>{props.children}</span>
    </div>
);

class Rules extends React.Component {
    constructor(props){
        super(props);
        this.state={show_statuses: this.props.form.trigger_type=='status',
            show_custom: this.props.form.status_code=='Custom'};
    }
    type_changed(val){
        if (val=='status')
            this.setState({show_statuses: true});
        else
        {
            this.setState({show_statuses: false, show_custom: false});
            this.props.on_change_field('status_code', '');
            this.props.on_change_field('status_custom', '');
        }
        if (!val)
            this.props.on_change_field('trigger_regex', '');
    }
    status_changed(val){
        this.setState({show_custom: val=='Custom'});
        if (val!='Custom')
            this.props.on_change_field('status_custom', '');
    }
    render(){
        const trigger_types = [
            {key:'', value: ''},
            {key: 'Status-code', value: 'status'},
        ];
        const action_types = [
            {key: '', value: ''},
            {key: 'Retry request (up to 20 times)', value: 'retry'},
        ];
        const status_types = ['', '200 - Succeeded requests',
            '403 - Forbidden', '404 - Not found',
            '500 - Internal server error', '502 - Bad gateway',
            '503 - Service unavailable', '504 - Gateway timeout', 'Custom']
            .map(s=>({key: s, value: s}));
        const {form, on_change_field} = this.props;
        const trigger_correct = form.trigger_type||form.trigger_regex;
        return (
            <div>
              <div className="tab_header">
                Define custom action for specific request response</div>
              <Note>
                Rules will apply when 'SSL analyzing' enabled (See 'Debugging'
                section)
              </Note>
              <With_data {...this.props} tab_id="rules">
                <Section id="trigger_type" header="Trigger Type"
                  correct={trigger_correct}>
                  <Section_field tab_id="rules" id="trigger_type"
                    form={form} type="select" data={trigger_types}
                    on_change_field={on_change_field}
                    on_change={this.type_changed.bind(this)}/>
                  <If when={this.state.show_statuses}>
                    <Section_field tab_id="rules" id="status_code"
                      form={form} type="select" data={status_types}
                      on_change_field={on_change_field}
                      on_change={this.status_changed.bind(this)}/>
                  </If>
                  <If when={this.state.show_custom}>
                    <Section_field tab_id="rules" id="status_custom"
                      form={form} type="text" data={status_types}
                      on_change_field={on_change_field}/>
                  </If>
                  <Section_field tab_id="rules" id="trigger_regex"
                    form={form} type="text"
                    on_change_field={on_change_field}/>
                </Section>
                <Section_with_fields type="select" id="action" header="Action"
                  note="IP will change for every entry" data={action_types}
                  on_change_field={on_change_field}/>
              </With_data>
            </div>
        );
    }
}

const Checkbox = props=>(
  <div className="form-check">
    <label className="form-check-label">
      <input className="form-check-input" type="checkbox" value={props.value}
        onChange={e=>props.on_change(e)} checked={props.checked}/>
        {props.text}
    </label>
  </div>
);

const Alloc_modal = props=>{
    if (!props.type)
        return null;
    const type_label = props.type=='ips' ? 'IPs' : 'vIPs';
    const title = 'Select '+type_label+': '+props.zone_name;
    const checked = row=>props.form[props.type].includes(row);
    const reset = ()=>{
        props.on_change_field(props.type, []);
        props.on_change_field('pool_size', '');
    };
    return (
        <Modal id="allocated_ips" className="allocated_ips_modal"
          title={title} no_cancel_btn>
          <button onClick={reset}
            className="btn btn_lpm btn_lpm_normal random_ips_btn">
            Random {type_label}
          </button>
          {props.list.map(row=>
            <Checkbox on_change={props.toggle(props.type)} key={row}
              text={row} value={row} checked={checked(row)}/>
          )}
        </Modal>
    );
};

class Rotation extends React.Component {
    constructor(props){
        super(props);
        this.state = {list: [], loading: false};
        this.sp = etask('Rotation', function*(){ yield this.wait(); });
    }
    componentWillUnmount(){ this.sp.return(); }
    toggle(type){
        return e=>{
            let {value, checked} = e.target;
            if (type=='vips')
                value = Number(value);
            const {form, on_change_field} = this.props;
            let new_alloc;
            if (checked)
                new_alloc = [...form[type], value];
            else
                new_alloc = form[type].filter(r=>r!=value);
            on_change_field(type, new_alloc);
            if (!form.multiply_ips && !form.multiply_vips)
                on_change_field('pool_size', new_alloc.length);
            else
                on_change_field('multiply', new_alloc.length);
        };
    }
    open_modal(type){
        if (!this.props.support.pool_size)
            return;
        const {form} = this.props;
        this.setState({loading: true});
        const zone = form.zone||this.props.proxy.zone.def;
        const keypass = form.password||'';
        let base_url;
        if (type=='ips')
            base_url = '/api/allocated_ips';
        else
            base_url = '/api/allocated_vips';
        const url = base_url+'?zone='+zone+'&key='+keypass;
        const _this = this;
        this.sp.spawn(etask(function*(){
            this.on('uncaught', e=>{
                console.log(e);
                _this.setState({loading: false});
            });
            const res = yield ajax.json({url});
            let list;
            if (type=='ips')
                list = res.ips;
            else
                list = res.slice(0, 100);
            _this.setState({list, loading: false});
            $('#allocated_ips').modal('show');
        }));
    }
    multiply_changed(val){
        const {on_change_field, form} = this.props;
        const size = Math.max(form.ips.length, form.vips.length);
        if (val)
        {
            on_change_field('pool_size', 0);
            on_change_field('multiply', size);
            return;
        }
        on_change_field('pool_size', size);
        on_change_field('multiply', 1);
    }
    render() {
        const {proxy, support, form, default_opt} = this.props;
        const pool_size_disabled = !support.pool_size ||
            form.ips.length || form.vips.length;
        const curr_plan = this.props.get_curr_plan();
        let type;
        if (curr_plan&&curr_plan.type=='static')
            type = 'ips';
        else if (curr_plan&&!!curr_plan.vip)
            type = 'vips';
        const render_modal = ['ips', 'vips'].includes(type);
        let pool_size_note;
        if (this.props.support.pool_size&&render_modal)
        {
            pool_size_note = <a onClick={()=>this.open_modal(type)}>
              {'set from allocated '+(type=='ips' ? 'IPs' : 'vIPs')}
            </a>;
        }
        return (
            <With_data {...this.props} tab_id="rotation">
              <Loader show={this.state.loading}/>
              <Alloc_modal list={this.state.list} type={type}
                zone_name={form.zone||this.props.proxy.zone.def}
                loading={this.state.loading} toggle={this.toggle.bind(this)}/>
              <Section_with_fields type="text" id="ip"/>
              <Section_with_fields type="text" id="vip"/>
              <Section id="pool_size" correct={this.props.form.pool_size}
                disabled={pool_size_disabled}>
                <Section_field {...this.props} type="number" id="pool_size"
                  tab_id="rotation" note={pool_size_note} min="0"
                  disabled={pool_size_disabled}/>
                <If when={type=='ips'}>
                  <Section_field {...this.props} type="boolean"
                    id="multiply_ips" tab_id="rotation"
                    on_change={this.multiply_changed.bind(this)}/>
                </If>
                <If when={type=='vips'}>
                  <Section_field {...this.props} type="boolean"
                    id="multiply_vips" tab_id="rotation"
                    on_change={this.multiply_changed.bind(this)}/>
                </If>
              </Section>
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

const General = props=>(
    <With_data {...props} tab_id="general">
      <Section_with_fields type="number" id="port"/>
      <Section_with_fields type="password" id="password"/>
      <Section_with_fields type="select" id="iface"
        data={props.proxy.iface.values}/>
      <Section_with_fields type="number" id="multiply" min="1"
        disabled={!props.support.multiply}/>
      <Section_with_fields type="number" id="socks" min="0"/>
      <Section_with_fields type="select" id="secure_proxy"
        data={props.default_opt('secure_proxy')}/>
      <Section_with_fields type="text" id="null_response"/>
      <Section_with_fields type="text" id="bypass_proxy"/>
      <Section_with_fields type="text" id="direct_include"/>
      <Section_with_fields type="text" id="direct_exclude"/>
    </With_data>
);

export default Index;
