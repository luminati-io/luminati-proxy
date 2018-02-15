// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true, es6:true*/
import React from 'react';
import classnames from 'classnames';
import $ from 'jquery';
import _ from 'lodash';
import etask from 'hutil/util/etask';
import ajax from 'hutil/util/ajax';
import setdb from 'hutil/util/setdb';
import {If, Modal, Loader, Select, Input, Warning, Warnings, presets,
    onboarding, emitter} from './common.js';
import util from './util.js';
import zurl from 'hutil/util/url';
import {Typeahead} from 'react-bootstrap-typeahead';
import {Netmask} from 'netmask';
import Pure_component from '../../www/util/pub/pure_component.js';
import {getContext, withContext} from 'recompose';
import PropTypes from 'prop-types';

const provider = provide=>withContext({provide: PropTypes.object},
    ()=>({provide}));
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
                placeholder: 'Type in city name'
            },
            asn: {
                label: <span>
                    ASN (
                    <a
                      className="link"
                      href="http://bgp.potaroo.net/cidr/autnums.html"
                      target="_blank" rel="noopener noreferrer">
                      ASN list
                    </a>)
                    </span>,
                tooltip: 'Specific ASN provider',
                placeholder: 'ASN code e.g. 42793'
            },
            carrier: {
                label: 'Carrier',
                tooltip: 'Network provider company name',
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
            pool_size: {
                label: 'Pool size',
                tooltip: `Maintain number of IPs that will be pinged constantly
                    - must have keep_alive to work properly`,
            },
            request_timeout: {
                label: 'Timeout for requests on the super proxy',
                tooltip: `Kill requests to super proxy and try new one if
                    timeout is exceeded`,
            },
            session_init_timeout: {
                label: 'Session establish timeout',
                tooltip: `Time in seconds for the request to complete before
                    establishing connection to new peer`,
            },
            race_reqs: {
                label: 'Parallel race requests',
                tooltip: `Sends multiple requests in parallel via different
                    super proxies and uses the fastest request`,
                placeholder: 'Number of parallel requests'
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
        label: 'Rules',
        tooltip: 'Define custom action for specific rule',
        fields: {
            trigger_type: {
                label: 'Rule type',
                tooltip: `In every request the response will be analyzed.
                    if the configured Trigger rule is true, the Action
                    will be executed automatically`,
            },
            body_regex: {
                label: 'String to be scanned in body (Regex)',
                placeholder:`i.e. (captcha|robot)`
            },
            min_req_time: {
                label: 'Minimum request time',
                placeholder: '500',
            },
            max_req_time: {
                label: 'Maximum request time',
                placeholder: '500',
            },
            trigger_url_regex: {
                label: 'Apply only on specific domains (optional)',
                placeholder:`i.e. example.com`
            },
            status_code: {label: 'Status Code string to be scanned'},
            status_custom: {
                label: 'Custom Status Code(Regex)',
                placeholder:`i.e. (2..|3..|404)`
            },
            action: {
                label: 'Action type',
                tooltip: `The action to be executed when rule is met `,
            },
            retry_number: {label: 'Number of retries'},
            retry_port: {label: 'Retry using a different port'},
            ban_ip_duration: {label: 'Ban IP for'},
            ban_ip_custom: {label: 'Custom duration'},
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
                placeholder: 'insert IP value from your pool'
            },
            vip: {
                label: 'gIP',
                tooltip: `Choose specific gIP to ensure all requests are
                    executed using specific gIP. to view the pool of your gIPs
                    take a look at 'pool size' option`,
                placeholder: 'insert gIP id'
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
                placeholder: `e.g. 1.1.1.1,23.23.23.23`
            },
            session_random: {
                label: 'Random Session',
                tooltip: `Switch session ID on each request`,
            },
            session: {
                label: 'Explicit Session',
                tooltip: `Insert session ID to maintain the same ip
                    for as long as possible.`,
            },
            sticky_ip: {
                label: 'Sticky IP',
                tooltip: `When connecting to remote lpm server stick sessions
                    to each computer. each connected computer will receive
                    unique session`,
            },
            max_requests: {
                label: 'Max Requests',
                tooltip: `Change session based on number of requests can be a
                    range or a fixed number. when using browser it should be
                    taken into consideration that one page load will attempt
                    multiple requests under the hood`,
            },
            session_duration: {
                label: 'Session Duration (seconds)',
                tooltip: `Change session after fixed number of seconds`,
            },
            seed: {
                label: 'Session ID Seed',
                tooltip: `Seed used for random number generator in random
                    sessions`,
            }
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
                label: 'Multiply port',
                tooltip: `Create multiple identical ports`,
            },
            multiply_ips: {
                label: 'Multiply port per IP',
                tooltip: `Create proxy port for every selected IP from the
                    pool`
            },
            multiply_vips: {
                label: 'Multiply port per gIP',
                tooltip: `Create proxy port for every selected gIP from pool
                    of available gIPS in your zone`
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
                    response" without proxying (useful when users don't want
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
            allow_proxy_auth: {
                label: 'Allow request authentication',
                tooltip: `Pass auth data per request (use lpm like
                    api)`,
            },
        },
    },
};

const validators = {
    number: (min, max, req=false)=>val=>{
        val = Number(val);
        if (isNaN(val))
        {
            if (req)
                return min;
            else
                return undefined;
        }
        else if (val < min)
            return min;
        else if (val > max)
            return max;
        else
            return val;
    },
    ips_list: val=>{
        val = val.replace(/\s/g, '');
        const ips = val.split(',');
        const res = [];
        ips.forEach(ip=>{
            try { res.push(new Netmask(ip).base); }
            catch(e){ console.log('incorrect ip format'); }
        });
        return res.join(',');
    },
};

class Index extends React.Component {
    constructor(props){
        super(props);
        this.sp = etask('Index', function*(){ yield this.wait(); });
        this.state = {tab: 'target', form: {zones: {}}, warnings: [],
            errors: {}, show_loader: false};
    }
    componentWillMount(){
        this.listeners = [
            setdb.on('head.proxies_running', proxies=>{
                if (!proxies||this.state.proxies)
                    return;
                this.port = window.location.pathname.split('/').slice(-1)[0];
                const proxy = proxies.filter(p=>p.port==this.port)[0].config;
                const form = Object.assign({}, proxy);
                const preset = this.guess_preset(form);
                this.apply_preset(form, preset);
                this.setState({proxies}, this.delayed_loader());
            }),
            setdb.on('head.consts',
                consts=>this.setState({consts}, this.delayed_loader())),
            setdb.on('head.defaults',
                defaults=>this.setState({defaults}, this.delayed_loader())),
            setdb.on('head.locations',
                locations=>this.setState({locations}, this.delayed_loader())),
            setdb.on('head.callbacks', callbacks=>this.setState({callbacks})),
            setdb.on('edit_proxy.loading', loading=>this.setState({loading})),
            setdb.on('edit_proxy.tab', (tab='target')=>this.setState({tab})),
        ];
    }
    componentDidMount(){
        setTimeout(()=>{
            const url_o = zurl.parse(document.location.href);
            const qs_o = zurl.qs_parse((url_o.search||'').substr(1));
            if (qs_o.field)
                this.goto_field(qs_o.field);
        });
    }
    componentWillUnmount(){
        this.sp.return();
        this.listeners.forEach(l=>setdb.off(l));
    }
    componentDidUpdate(){ $('[data-toggle="tooltip"]').tooltip(); }
    delayed_loader(){ return _.debounce(this.update_loader.bind(this)); }
    update_loader(){
        this.setState(state=>{
            const show_loader = !state.consts || !state.locations ||
                !state.proxies || !state.defaults;
            const zone_name = !show_loader&&
                (state.form.zone||state.consts.proxy.zone.def);
            setdb.set('edit_proxy.zone_name', zone_name);
            return {show_loader};
        });
    }
    goto_field(field){
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
            this.click_tab(tab);
    }
    guess_preset(form){
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
        setdb.set('edit_proxy.tab', tab);
        ga_event('categories', 'click', tab);
    }
    is_dirty(form){
        for (let key in form)
        {
            if (form[key]===false||form[key]||this.original_form[key]
                ||this.original_form[key]===false)
            {
                if (typeof form[key]=='object' &&
                    !_.isEqual(form[key], this.original_form[key]))
                {
                    return true;
                }
                else if (typeof form[key]!='object' &&
                    form[key]!==this.original_form[key])
                {
                    return true;
                }
            }
        }
        return false;
    }
    field_changed(field_name, value){
        this.setState(prev_state=>{
            const new_form = {...prev_state.form, [field_name]: value};
            return {form: new_form, dirty: this.is_dirty(new_form)};
        });
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
        if (field_name=='carrier')
            return permissions.includes('asn');
        return true;
    }
    apply_preset(_form, preset){
        const form = Object.assign({}, _form);
        const last_preset = form.last_preset_applied ?
            presets[form.last_preset_applied] : null;
        if (last_preset&&last_preset.key!=preset&&last_preset.clean)
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
            form.trigger_url_regex = form.rule.url;
            form.trigger_type = form.rule.trigger_type;
            form.body_regex = form.rule.body_regex;
            if (form.rule.min_req_time)
            {
                const min_req_time = form.rule.min_req_time.match(/\d+/);
                form.min_req_time = Number(min_req_time&&min_req_time[0]);
            }
            if (form.rule.max_req_time)
            {
                const max_req_time = form.rule.max_req_time.match(/\d+/);
                form.max_req_time = Number(max_req_time&&max_req_time[0]);
            }
            if (form.rule.action)
            {
                form.action = form.rule.action.value;
                form.retry_port = form.rule.action.raw.retry_port;
                form.retry_number = form.rule.action.raw.retry;
                if (form.rule.action.raw.ban_ip)
                {
                    form.ban_ip_duration = 'custom';
                    const minutes = form.rule.action.raw.ban_ip.match(/\d+/);
                    form.ban_ip_custom = Number(minutes&&minutes[0]);
                }
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
        if (Array.isArray(form.whitelist_ips))
            form.whitelist_ips = form.whitelist_ips.join(',');
        if (form.city && !Array.isArray(form.city) && form.state)
            form.city = [{id: form.city,
                label: form.city+' ('+form.state+')'}];
        else if (!Array.isArray(form.city))
            form.city = [];
        if (!this.original_form)
            this.original_form = form;
        else
            this.setState({dirty: this.is_dirty(form)});
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
        const update_url = '/api/proxies/'+this.port;
        const _this = this;
        return etask(function*(){
            const tested_proxy = yield onboarding.has_tested_proxy();
            const raw_update = yield window.fetch(update_url, {
                method: 'PUT',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({proxy: data}),
            });
            const status = yield ajax.json({
                url: '/api/proxy_status/'+data.port});
            yield _this.state.callbacks.proxies.update();
            _this.setState({show_loader: false});
            if (status.status=='ok')
            {
                ga_event('top bar', 'successfully saved');
                onboarding.check_created_proxy();
                if (!tested_proxy)
                {
                    emitter.emit('setup_guide:progress_modal',`Great! You have`
                        +` configured proxy on port ${data.port}`, 1500);
                }
                _this.state.callbacks.state.go('proxies');
            }
            else
            {
                ga_event('top bar', 'failed save', status.status);
                _this.setState({error_list: [{msg: status.status}]});
                $('#save_proxy_errors').modal('show');
            }
        });
    }
    save(){
        const data = this.prepare_to_save();
        const check_url = '/api/proxy_check/'+this.port;
        this.setState({show_loader: true});
        const _this = this;
        this.sp.spawn(etask(function*(){
            this.on('uncaught', e=>{
                console.log(e);
                ga_event('top bar', 'click save', 'failed');
                _this.setState({error_list: [{msg: 'Something went wrong'}],
                    show_loader: false});
                $('#save_proxy_errors').modal('show');
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
    prepare_rules(form){
        const action_raw = {};
        if (['retry', 'retry_port', 'ban_ip'].includes(form.action))
            action_raw.retry = true;
        if (form.action=='retry' && form.retry_number)
            action_raw.retry = form.retry_number;
        else if (form.action=='retry_port')
            action_raw.retry_port = form.retry_port;
        else if (form.action=='ban_ip')
        {
            if (form.ban_ip_duration!='custom')
                action_raw.ban_ip = form.ban_ip_duration||'10min';
            else
                action_raw.ban_ip = form.ban_ip_custom+'min';
        }
        else if (form.action=='save_to_pool')
            action_raw.reserve_session = true;
        if (!form.rules)
            form.rules = {};
        if (form.trigger_type)
        {
            form.rules.post = [{
                res: [{
                    head: true,
                    action: action_raw,
                }],
                url: (form.trigger_url_regex||'**'),
            }];
            form.rule = {
                url: form.trigger_url_regex||'**',
                action: {raw: action_raw, value: form.action},
                trigger_type: form.trigger_type,
            };
        }
        else
            form.rule = null;
        if (form.trigger_type=='status')
        {
            let rule_status = form.status_code=='Custom'
                ? form.status_custom : form.status_code;
            rule_status = rule_status||'';
            form.rules.post[0].res[0].status = {type: 'in', arg: rule_status};
            form.rule.status = form.status_code;
            if (form.rule.status=='Custom')
                form.rule.custom = form.status_custom;
        }
        else if (form.trigger_type=='body'&&form.body_regex)
        {
            form.rules.post[0].res[0].body = {type: '=~',
                arg: form.body_regex};
            form.rule.body_regex = form.body_regex;
        }
        else if (form.trigger_type=='min_req_time'&&form.min_req_time)
        {
            form.rules.post[0].res[0].min_req_time = form.min_req_time+'ms';
            form.rule.min_req_time = form.min_req_time+'ms';
        }
        else if (form.trigger_type=='max_req_time'&&form.max_req_time)
        {
            form.rules.post[0].res[0].max_req_time = form.max_req_time+'ms';
            form.rule.max_req_time = form.max_req_time+'ms';
        }
        else if (!form.rules.post && !form.rules.pre)
            form.rules = null;
        delete form.trigger_type;
        delete form.min_req_time;
        delete form.max_req_time;
        delete form.status_code;
        delete form.status_custom;
        delete form.body_regex;
        delete form.action;
        delete form.trigger_url_regex;
        delete form.retry_number;
        delete form.retry_port;
        delete form.ban_ip_duration;
        delete form.ban_ip_custom;
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
        save_form.history = effective('history');
        save_form.ssl = effective('ssl');
        save_form.max_requests = effective('max_requests');
        save_form.session_duration = effective('session_duration');
        save_form.keep_alive = effective('keep_alive');
        save_form.pool_size = effective('pool_size');
        save_form.proxy_type = 'persist';
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
        if (save_form.whitelist_ips)
            save_form.whitelist_ips = save_form.whitelist_ips.split(',')
        .filter(Boolean);
        if (save_form.city.length)
            save_form.city = save_form.city[0].id;
        else
            save_form.city = '';
        if (!save_form.max_requests)
            save_form.max_requests = 0;
        delete save_form.rules;
        presets[save_form.preset].set(save_form);
        this.prepare_rules(save_form);
        delete save_form.preset;
        if (!save_form.session)
            save_form.session = false;
        if (save_form.session_random)
            save_form.session = true;
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
        if (!this.state.consts||!this.state.defaults||!this.state.locations||
            !this.state.proxies)
        {
            Main_window = ()=>null;
        }
        const support = presets && this.state.form.preset &&
            presets[this.state.form.preset].support||{};
        let zones = this.state.consts&&
            this.state.consts.proxy.zone.values||[];
        zones = zones.filter(z=>{
            const plan = z.plans && z.plans.slice(-1)[0] || {};
            return !plan.archive && !plan.disable;
        });
        const default_zone=this.state.consts&&
            this.state.consts.proxy.zone.def;
        const warning_dirty = (<span>
            You have unsaved changes. Сlick
            <strong> 'Save' </strong>
            to apply the changes
        </span>);
        // XXX krzysztof: cleanup
        const curr_plan = this.state.consts&&this.get_curr_plan();
        let type;
        if (curr_plan&&curr_plan.type=='static')
            type = 'ips';
        else if (curr_plan&&!!curr_plan.vip)
            type = 'vips';
        return (
            <div className="lpm edit_proxy">
              <Loader show={this.state.show_loader||this.state.loading}/>
              <div className="nav_wrapper">
                <div className="nav_header">
                  <h3>Port {this.port}</h3>
                  <div className="warning_wrapper">
                    <If when={this.state.dirty}>
                      <Warning text={warning_dirty}/>
                    </If>
                  </div>
                </div>
                <Nav zones={zones} default_zone={default_zone}
                  form={this.state.form}
                  on_change_field={this.field_changed.bind(this)}
                  on_change_preset={this.apply_preset.bind(this)}
                  save={this.save.bind(this)} dirty={this.state.dirty}/>
                <Nav_tabs curr_tab={this.state.tab} form={this.state.form}
                  on_tab_click={this.click_tab.bind(this)}
                  errors={this.state.errors}/>
              </div>
              <div className="main_window">
                <Main_window proxy={this.state.consts&&this.state.consts.proxy}
                  locations={this.state.locations}
                  defaults={this.state.defaults} form={this.state.form}
                  init_focus={this.init_focus}
                  is_valid_field={this.is_valid_field.bind(this)}
                  on_change_field={this.field_changed.bind(this)}
                  support={support} errors={this.state.errors}
                  default_opt={this.default_opt.bind(this)}
                  get_curr_plan={this.get_curr_plan.bind(this)}
                  goto_field={this.goto_field.bind(this)}/>
              </div>
              <Modal className="warnings_modal" id="save_proxy_warnings"
                title="Warnings:" click_ok={this.save_from_modal.bind(this)}>
                <Warnings warnings={this.state.warnings}/>
              </Modal>
              <Modal className="warnings_modal" id="save_proxy_errors"
                title="Errors:" no_cancel_btn>
                <Warnings warnings={this.state.error_list}/>
              </Modal>
              <Alloc_modal type={type} form={this.state.form} support={support}
                zone={this.state.form.zone||default_zone}
                on_change_field={this.field_changed.bind(this)}/>
            </div>
        );
    }
}

const Nav = props=>{
    const reset_fields = ()=>{
        // XXX krzysztof: this should be moved in more generic place
        props.on_change_field('ips', []);
        props.on_change_field('vips', []);
        props.on_change_field('multiply_ips', false);
        props.on_change_field('multiply_vips', false);
        props.on_change_field('multiply', 1);
    };
    const update_preset = val=>{
        props.on_change_preset(props.form, val);
        reset_fields();
        ga_event('top bar', 'edit field', 'preset');
    };
    const update_zone = val=>{
        const zone_name = val||props.default_zone;
        setdb.set('edit_proxy.zone_name', zone_name);
        const zone = props.zones.filter(z=>z.key==zone_name)[0]||{};
        props.on_change_field('zone', val);
        props.on_change_field('password', zone.password);
        if (props.form.ips.length || props.form.vips.length)
            props.on_change_field('pool_size', 0);
        reset_fields();
    };
    const presets_opt = Object.keys(presets).map(p=>
        ({key: presets[p].title, value: p}));
    let {preset} = props.form;
    let preset_tooltip = preset&&presets[preset].subtitle||'';
    preset_tooltip = preset_tooltip.replace(/\s\s+/g, ' ');
    return (
        <div className="nav">
          <Field on_change={update_zone} options={props.zones} label="Zone"
            value={props.form.zone}/>
          <div className="preset_field">
            <Field on_change={update_preset} label="Preset"
              options={presets_opt} value={preset}/>
            <Tooltip_icon id={preset} title={preset_tooltip}/>
          </div>
          <Action_buttons save={props.save} dirty={props.dirty}/>
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
    save_clicked(){
        if (this.props.dirty)
            this.props.save();
    }
    render(){
        const save_btn_class = classnames('btn btn_lpm btn_save',
            {disabled: !this.props.dirty});
        return (
            <div className="action_buttons">
              <If when={this.props.dirty}>
                <a href="/proxies" onClick={this.cancel_clicked.bind(this)}
                  className="btn btn_lpm btn_lpm_normal btn_cancel">Cancel
                </a>
                <button className={save_btn_class}
                  onClick={this.save_clicked.bind(this)}>Save</button>
              </If>
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

class Tooltip_icon extends React.Component {
    componentDidUpdate(){
        $(this.el).attr('title', this.props.title).tooltip('fixTitle'); }
    save_ref(e){ this.el = e; }
    render(){
        return this.props.title ?
            <div className="info_icon" data-toggle="tooltip"
              data-placement="top" title={this.props.title}
              data-container="body" ref={this.save_ref.bind(this)}/> : null;
    }
}

const Section_header = props=>{
    return props.text ? <div className="header">{props.text}</div> : null;
};

class Section_raw extends React.Component {
    constructor(props){
        super(props);
        this.state = {focused: false};
    }
    on_focus(){
        if (!this.props.disabled)
            this.setState({focused: true});
    }
    on_blur(){ this.setState({focused: false}); }
    on_mouse_enter(){ this.setState({hovered: true}); }
    on_mouse_leave(){ this.setState({hovered: false}); }
    render(){
        const error = !!this.props.error_msg;
        const dynamic_class = {
            error,
            correct: this.props.correct && !error,
            active: this.state.focused && !error,
            hovered: this.state.hovered,
            disabled: this.props.disabled,
        };
        const message = this.props.error_msg
            ? this.props.error_msg
            : tabs[this.props.provide.tab_id].fields[this.props.id].tooltip;
        return (
            <div tabIndex="0" onFocus={this.on_focus.bind(this)}
              onBlur={this.on_blur.bind(this)} className="section_wrapper"
              onMouseEnter={this.on_mouse_enter.bind(this)}
              onMouseLeave={this.on_mouse_leave.bind(this)}>
              <div className={classnames('outlined', dynamic_class)}>
                <Section_header text={this.props.header}/>
                <div className="section_body">
                  {this.props.children}
                </div>
                <div className="icon"/>
              </div>
            </div>
        );
    }
}
const Section = getContext({provide: PropTypes.object})(Section_raw);

const Textarea = props=>{
    return (
        <textarea value={props.val} rows="3" placeholder={props.placeholder}
          onChange={e=>props.on_change_wrapper(e.target.value)}/>
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
          <span className="divider">:</span>
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
    const on_click_on = props.on_boolean_clicked||(()=>{});
    return (
        <div className="radio_buttons">
          <div className="option">
            <input type="radio" checked={props.val==true}
              onClick={on_click_on}
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
    const {id, form, header, errors, init_focus} = props;
    const disabled = props.disabled || !props.is_valid_field(id);
    const is_empty_arr = Array.isArray(form[id]) && !form[id][0];
    const correct = form[id] && form[id]!='*' && !is_empty_arr;
    const error_msg = errors[id];
    return (
        <Section correct={correct} disabled={disabled} id={id}
          header={header} error_msg={error_msg} init_focus={init_focus}>
          <Section_field {...props} disabled={disabled} correct={correct}/>
        </Section>
    );
};

let Section_field = props=>{
    const {id, form, sufix, note, type, disabled, data, on_change,
        on_change_field, min, max, validator, on_boolean_clicked} = props;
    const {tab_id} = props.provide;
    const on_blur = e=>{
        if (validator)
            on_change_field(id, validator(e.target.value));
    };
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
    const tooltip = tabs[tab_id].fields[id].tooltip;
    return (
        <div className={classnames('field_row', {disabled, note})}>
          <div className="desc">
            <span data-toggle="tooltip" data-placement="top"
              data-container="body"
              title={tooltip}>
              {tabs[tab_id].fields[id].label}
              <If when={!!tooltip}>
                <div className="info_icon"/>
              </If>
            </span>
          </div>
          <div className="field">
            <div className="inline_field">
              <Comp form={form} id={id} data={data} type={type}
                on_change_wrapper={on_change_wrapper} val={val}
                disabled={disabled} min={min} max={max}
                placeholder={placeholder} on_blur={on_blur}
                on_boolean_clicked={on_boolean_clicked}/>
              {sufix ? <span className="sufix">{sufix}</span> : null}
            </div>
            {note ? <Note>{note}</Note> : null}
          </div>
        </div>
    );
};
Section_field = getContext({provide: PropTypes.object})
    (Section_field);

class With_data extends React.Component {
    wrapped_children(){
        const props = Object.assign({}, this.props);
        delete props.children;
        return React.Children.map(this.props.children, child=>{
            return React.cloneElement(child, props); });
    }
    render(){ return <div>{this.wrapped_children()}</div>; }
}

class Targeting_raw extends React.Component {
    constructor(props){
        super(props);
        this.def_value = {key: 'Any (default)', value: ''};
        this.init_carriers();
    }
    init_carriers(){
        const subject = 'Add new carrier option';
        const n = '%0D%0A';
        const body = `Hi,${n}${n}Didn't find the carrier you're looking for?`
        +`${n}${n}Write here the carrier's name: __________${n}${n}We will add`
        +` it in less than 2 business days!`;
        const mail = 'lumext@luminati.io';
        const mailto = `mailto:${mail}?subject=${subject}&body=${body}`;
        this.carriers_note = <a className="link"
                                href={mailto}>More carriers</a>;
        this.carriers = [
            {value: '', key: 'None'},
            {value: 'aircel', key: 'Aircel'},
            {value: 'airtel', key: 'Airtel'},
            {value: 'att', key: 'AT&T'},
            {value: 'chinamobile', key: 'China Mobile'},
            {value: 'claro', key: 'Claro'},
            {value: 'comcast', key: 'Comcast'},
            {value: 'cox', key: 'Cox'},
            {value: 'dt', key: 'Deutsche Telekom'},
            {value: 'docomo', key: 'Docomo'},
            {value: 'dtac', key: 'DTAC Trinet'},
            {value: 'etisalat', key: 'Etisalat'},
            {value: 'mtn', key: 'MTN - Mahanager Telephone'},
            {value: 'optus', key: 'Optus'},
            {value: 'orange', key: 'Orange'},
            {value: 'qwest', key: 'Qwest'},
            {value: 'reliance_jio', key: 'Reliance Jio'},
            {value: 'sprint', key: 'Sprint'},
            {value: 'telefonica', key: 'Telefonica'},
            {value: 'telstra', key: 'Telstra'},
            {value: 'tmobile', key: 'T-Mobile'},
            {value: 'tigo', key: 'Tigo'},
            {value: 'vodafone', key: 'Vodafone'},
            {value: 'verizon', key: 'Verizon'},
        ];
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
        if (!country||country=='*')
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
        return curr_plan&&(curr_plan.type=='static'||
            ['domain', 'domain_p'].includes(curr_plan.vips_type));
    }
    render(){
        const curr_plan = this.props.get_curr_plan();
        const show_dc_note = curr_plan&&curr_plan.type=='static';
        const show_vips_note = curr_plan&&
            (curr_plan.vips_type=='domain'||curr_plan.vips_type=='domain_p');
        return (
            <With_data {...this.props}>
              <If when={show_dc_note||show_vips_note}>
                <Note>
                  <If when={show_dc_note}>
                    <span>To change Data Center country visit your </span>
                  </If>
                  <If when={show_vips_note}>
                    <span>To change Exclusive gIP country visit your </span>
                  </If>
                  <a className="link" target="_blank" rel="noopener noreferrer"
                    href="https://luminati.io/cp/zones">zone page</a>
                  <span> and change your zone plan.</span>
                </Note>
              </If>
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
              <Section_with_fields type="number" id="asn"
                disabled={this.props.form.carrier}/>
              <Section_with_fields type="select" id="carrier"
                data={this.carriers} note={this.carriers_note}
                disabled={this.props.form.asn}/>
            </With_data>
        );
    }
}
const Targeting = provider({tab_id: 'target'})(Targeting_raw);

class Speed_raw extends Pure_component {
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
        const {form, support} = this.props;
        const pool_size_disabled = !support.pool_size ||
            form.ips.length || form.vips.length;
        const type = this.get_type();
        const render_modal = ['ips', 'vips'].includes(type);
        let pool_size_note;
        if (this.props.support.pool_size&&render_modal)
        {
            pool_size_note = (
                <a className="link"
                  onClick={()=>this.open_modal()}>
                  {'set from allocated '+(type=='ips' ? 'IPs' : 'vIPs')}
                </a>
            );
        }
        return (
            <With_data {...this.props}>
              <Section_with_fields type="select" id="dns"
                data={this.dns_options}/>
              <Section_with_fields type="number" id="pool_size"
                min="0" note={pool_size_note} disabled={pool_size_disabled}/>
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
                <Section_field type="select" id="reverse_lookup"
                  {...this.props} data={this.reverse_lookup_options}/>
                <If when={this.props.form.reverse_lookup=='file'}>
                  <Section_field type="text" id="reverse_lookup_file"
                    {...this.props}/>
                </If>
                <If when={this.props.form.reverse_lookup=='values'}>
                  <Section_field type="textarea" id="reverse_lookup_values"
                    {...this.props}/>
                </If>
              </Section>
            </With_data>
        );
    }
}
const Speed = provider({tab_id: 'speed'})(Speed_raw);

const Note = props=>(
    <div className="note">
      <span>{props.children}</span>
    </div>
);

class Rules_raw extends React.Component {
    constructor(props){
        super(props);
        this.port = window.location.pathname.split('/').slice(-1)[0];
        this.state={
            show_statuses: this.props.form.trigger_type=='status',
            show_body_regex: this.props.form.trigger_type=='body',
            show_min_time: this.props.form.trigger_type=='min_req_time',
            show_max_time: this.props.form.trigger_type=='max_req_time',
            show_custom_status: this.props.form.status_code=='Custom',
        };
    }
    componentWillMount(){
        this.listener = setdb.on('head.proxies_running', proxies=>{
            const ports = (proxies||[]).filter(p=>p.port!=this.port)
            .map(p=>({key: p.port, value: p.port}));
            this.setState({ports});
        });
    }
    componentWillUnmount(){ setdb.off(this.listener); }
    type_changed(val){
        if (val=='status')
            this.setState({show_statuses: true});
        else
        {
            this.setState({show_statuses: false, show_custom_status: false});
            this.props.on_change_field('status_code', '');
            this.props.on_change_field('status_custom', '');
        }
        if (val=='body')
            this.setState({show_body_regex: true});
        else
        {
            this.setState({show_body_regex: false});
            this.props.on_change_field('body_regex', '');
        }
        if (val=='min_req_time')
            this.setState({show_min_time: true});
        else
        {
            this.setState({show_min_time: false});
            this.props.on_change_field('min_req_time', '');
        }
        if (val=='max_req_time')
            this.setState({show_max_time: true});
        else
        {
            this.setState({show_max_time: false});
            this.props.on_change_field('max_req_time', '');
        }
        if (!val)
            this.props.on_change_field('trigger_url_regex', '');
    }
    action_changed(val){
        if (val=='retry_port')
        {
            const def_port = this.state.ports.length&&this.state.ports[0].key;
            this.props.on_change_field(val, def_port||'');
        }
    }
    status_changed(val){
        this.setState({show_custom_status: val=='Custom'});
        if (val!='Custom')
            this.props.on_change_field('status_custom', '');
    }
    render(){
        const trigger_types = [
            {key:'Select condition type for your Trigger rule', value: ''},
            {key: 'Status code', value: 'status'},
            {key: 'HTML body element', value: 'body'},
            {key: 'Minimum request time', value: 'min_req_time'},
            {key: 'Maximum request time', value: 'max_req_time'},
        ];
        const action_types = [
            {key: 'Select the Action to execute when Trigger pulled',
                value: ''},
            {key: 'Retry with new IP', value: 'retry'},
            {key: 'Retry with new port (Waterfall)', value: 'retry_port'},
            {key: 'Ban IP', value: 'ban_ip'},
            {key: 'Save IP to reserved pool', value: 'save_to_pool'},
        ];
        const ban_options = [
            {key: '10 minutes', value: '10min'},
            {key: '20 minutes', value: '20min'},
            {key: '30 minutes', value: '30min'},
            {key: '40 minutes', value: '40min'},
            {key: '50 minutes', value: '50min'},
            {key: 'Custom', value: 'custom'},
        ];
        const status_types = ['', '200 - Succeeded requests',
            '403 - Forbidden', '404 - Not found',
            '500 - Internal server error', '502 - Bad gateway',
            '503 - Service unavailable', '504 - Gateway timeout', 'Custom']
            .map(s=>({key: s, value: s}));
        const {form, on_change_field} = this.props;
        const trigger_correct = form.trigger_type||form.trigger_url_regex;
        return (
            <div>
              <div className="tab_header">
                Configure an action to be taken in response to a given Trigger
              </div>
              <With_data {...this.props}>
                <Section id="trigger_type" header="Trigger"
                  correct={trigger_correct}>
                  <Section_field id="trigger_type"
                    form={form} type="select" data={trigger_types}
                    on_change_field={on_change_field}
                    on_change={this.type_changed.bind(this)}/>
                  <If when={this.state.show_body_regex}>
                    <Section_field id="body_regex"
                      type="text" {...this.props}/>
                  </If>
                  <If when={this.state.show_min_time}>
                    <Section_field id="min_req_time" type="number"
                    {...this.props} sufix="milliseconds"/>
                  </If>
                  <If when={this.state.show_max_time}>
                    <Section_field id="max_req_time" type="number"
                    {...this.props} sufix="milliseconds"/>
                  </If>
                  <If when={this.state.show_statuses}>
                    <Section_field id="status_code"
                      form={form} type="select" data={status_types}
                      on_change_field={on_change_field}
                      on_change={this.status_changed.bind(this)}/>
                  </If>
                  <If when={this.state.show_custom_status}>
                    <Section_field id="status_custom"
                      form={form} type="text" data={status_types}
                      on_change_field={on_change_field}/>
                  </If>
                  <Section_field id="trigger_url_regex"
                    form={form} type="text"
                    on_change_field={on_change_field}/>
                </Section>
                <Section id="action" header="Action"
                  note="IP will change for every entry"
                  on_change_field={on_change_field}>
                  <Section_field id="action"
                    type="select" data={action_types} {...this.props}
                    on_change={this.action_changed.bind(this)}/>
                  <If when={this.props.form.action=='retry'}>
                    <Section_field id="retry_number"
                      type="number" {...this.props} min="0" max="20"
                      validator={validators.number(0, 20)}/>
                  </If>
                  <If when={this.props.form.action=='retry_port'}>
                    <Section_field id="retry_port"
                      type="select" data={this.state.ports} {...this.props}/>
                  </If>
                  <If when={this.props.form.action=='ban_ip'}>
                    <Section_field id="ban_ip_duration"
                      type="select" data={ban_options} {...this.props}/>
                    <If when={this.props.form.ban_ip_duration=='custom'}>
                      <Section_field id="ban_ip_custom"
                        type="number" {...this.props} sufix="minutes"/>
                    </If>
                  </If>
                </Section>
              </With_data>
            </div>
        );
    }
}
const Rules = provider({tab_id: 'rules'})(Rules_raw);

const Checkbox = props=>(
  <div className="form-check">
    <label className="form-check-label">
      <input className="form-check-input" type="checkbox" value={props.value}
        onChange={e=>props.on_change(e)} checked={props.checked}/>
        {props.text}
    </label>
  </div>
);

class Alloc_modal extends Pure_component {
    constructor(props){
        super(props);
        this.state = {available_list: []};
    }
    componentDidMount(){
        this.setdb_on('edit_proxy.zone_name', zone_name=>
            this.setState({available_list: []}));
        this.setdb_on('edit_proxy.tab', tab=>this.setState({curr_tab: tab}));
        $('#allocated_ips').on('show.bs.modal', this.load.bind(this));
    }
    load(){
        if (this.state.available_list.length)
            return;
        this.loading(true);
        const {form} = this.props;
        const key = form.password||'';
        let endpoint;
        if (this.props.type=='ips')
            endpoint = '/api/allocated_ips';
        else
            endpoint = '/api/allocated_vips';
        const url = zurl.qs_add(window.location.host+endpoint,
            {zone: this.props.zone, key});
        const _this = this;
        this.etask(function*(){
            this.on('uncaught', e=>{
                console.log(e);
                _this.loading(false);
            });
            const res = yield ajax.json({url});
            let available_list;
            if (_this.props.type=='ips')
                available_list = res.ips;
            else
                available_list = res.slice(0, 100);
            _this.setState({available_list});
            _this.loading(false);
        });
    }
    loading(loading){
        setdb.set('edit_proxy.loading', loading);
        this.setState({loading});
    }
    checked(row){ return this.props.form[this.props.type].includes(row); }
    reset(){
        this.props.on_change_field(this.props.type, []);
        this.props.on_change_field('pool_size', '');
        this.props.on_change_field('multiply', 1);
    }
    toggle(e){
        let {value, checked} = e.target;
        const {type, form, on_change_field} = this.props;
        if (type=='vips')
            value = Number(value);
        let new_alloc;
        if (checked)
            new_alloc = [...form[type], value];
        else
            new_alloc = form[type].filter(r=>r!=value);
        on_change_field(type, new_alloc);
        this.update_multiply_and_pool_size(new_alloc.length);
    }
    select_all(){
        const {type, on_change_field} = this.props;
        on_change_field(type, this.state.available_list);
        this.update_multiply_and_pool_size(this.state.available_list.length);
    }
    update_multiply_and_pool_size(size){
        const {form, on_change_field} = this.props;
        if (!form.multiply_ips && !form.multiply_vips)
            on_change_field('pool_size', size);
        else
        {
            on_change_field('pool_size', 1);
            on_change_field('multiply', size);
        }
    }
    render(){
        const type_label = this.props.type=='ips' ? 'IPs' : 'vIPs';
        let title;
        if (this.state.curr_tab=='general')
        {
            title = 'Select the '+type_label+' to multiply ('
            +this.props.zone+')';
        }
        else
            title = 'Select the '+type_label+' ('+this.props.zone+')';
        return (
            <Modal id="allocated_ips" className="allocated_ips_modal"
              title={title} no_cancel_btn>
              <div className="action_buttons">
                <button onClick={this.reset.bind(this)}
                  className="btn btn_lpm btn_lpm_normal">
                  Reset
                </button>
                <button onClick={this.select_all.bind(this)}
                  className="btn btn_lpm btn_lpm_normal">
                  Select all
                </button>
              </div>
              {this.state.available_list.map(row=>
                <Checkbox on_change={this.toggle.bind(this)} key={row}
                  text={row} value={row} checked={this.checked(row)}/>
              )}
            </Modal>
        );
    }
}

let Rotation = props=>{
    const {support, form, proxy} = props;
    return (
        <With_data {...props}>
          <Section_with_fields type="text" id="ip"/>
          <Section_with_fields type="text" id="vip"/>
          <Section_with_fields type="select" id="pool_type"
            data={proxy.pool_type.values} disabled={!support.pool_type}/>
          <Section_with_fields type="number" id="keep_alive" min="0"
            disabled={!support.keep_alive}/>
          <Section_with_fields type="text" id="whitelist_ips"
            validator={validators.ips_list}/>
          <Section_with_fields type="boolean" id="session_random"
            disabled={!support.session}/>
          <Section_with_fields type="text" id="session"
            disabled={form.session_random && !support.session}/>
          <Section_with_fields type="select" id="sticky_ip"
            data={props.default_opt('sticky_ip')}
            disabled={!support.sticky_ip}/>
          <Section_with_fields type="double_number" id="max_requests"
            disabled={!support.max_requests}/>
          <Section_with_fields type="double_number" id="session_duration"
            disabled={!support.session_duration}/>
          <Section_with_fields type="text" id="seed" disabled={!support.seed}/>
        </With_data>
    );
};
Rotation = provider({tab_id: 'rotation'})(Rotation);

let Debug = props=>(
    <With_data {...props}>
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
Debug = provider({tab_id: 'debug'})(Debug);

let General = props=>{
    const open_modal = ()=>{ $('#allocated_ips').modal('show'); };
    const multiply_changed = val=>{
        const {on_change_field, form} = props;
        const size = Math.max(form.ips.length, form.vips.length);
        if (val)
        {
            on_change_field('pool_size', 1);
            on_change_field('multiply', size);
            return;
        }
        on_change_field('pool_size', size);
        on_change_field('multiply', 1);
    };
    // XXX krzysztof: cleanup type
    const curr_plan = props.get_curr_plan();
    let type;
    if (curr_plan&&curr_plan.type=='static')
        type = 'ips';
    else if (curr_plan&&!!curr_plan.vip)
        type = 'vips';
    return (
        <With_data {...props}>
          <Section_with_fields type="number" id="port"/>
          <Section_with_fields type="password" id="password"/>
          <Section_with_fields type="number" id="multiply" min="1"
            disabled={!props.support.multiply}/>
          <If when={type=='ips'}>
            <Section_with_fields {...props}
              type="boolean" id="multiply_ips" on_boolean_clicked={open_modal}
              on_change={multiply_changed}/>
          </If>
          <If when={type=='vips'}>
            <Section_with_fields {...props}
              type="boolean" id="multiply_vips" on_boolean_clicked={open_modal}
              on_change={multiply_changed}/>
          </If>
          <Section_with_fields type="number" id="socks" min="0"/>
          <Section_with_fields type="select" id="secure_proxy"
            data={props.default_opt('secure_proxy')}/>
          <Section_with_fields type="text" id="null_response"/>
          <Section_with_fields type="text" id="bypass_proxy"/>
          <Section_with_fields type="text" id="direct_include"/>
          <Section_with_fields type="text" id="direct_exclude"/>
          <Section_with_fields type="select" id="allow_proxy_auth"
            data={props.default_opt('allow_proxy_auth')}/>
          <Section_with_fields type="select" id="iface"
            data={props.proxy.iface.values}/>
        </With_data>
    );
};
General = provider({tab_id: 'general'})(General);

export default Index;
