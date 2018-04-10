// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true*/
import _ from 'lodash';
import $ from 'jquery';
import classnames from 'classnames';
import React from 'react';
import * as Bootstrap from 'react-bootstrap';
import etask from 'hutil/util/etask';
import ajax from 'hutil/util/ajax';
import setdb from 'hutil/util/setdb';
import EventEmitter from 'events';
import {If} from '/www/util/pub/react.js';
import Pure_component from '../../www/util/pub/pure_component.js';

class Dialog extends React.Component {
    render(){
        return <Bootstrap.Modal {..._.omit(this.props,
              ['title', 'footer', 'children'])}>
              <Bootstrap.Modal.Header closeButton>
                <Bootstrap.Modal.Title>
                  {this.props.title}</Bootstrap.Modal.Title>
              </Bootstrap.Modal.Header>
              <Bootstrap.Modal.Body>
                {this.props.children}
              </Bootstrap.Modal.Body>
              <Bootstrap.Modal.Footer>
                {this.props.footer}
              </Bootstrap.Modal.Footer>
            </Bootstrap.Modal>;
    }
}

class Modal_dialog extends React.Component {
    componentDidMount(){
    }
    componentWillReceiveProps(new_props){
        if (this.props.open==new_props.open)
            return;
        if (new_props.open)
            $(this.ref).modal();
        else
            $(this.ref).modal('hide');
    }
    set_ref(e){ this.ref = e; }
    render(){
        return (
            <div tabIndex="-1"
              ref={this.set_ref.bind(this)}
              className={classnames('modal', 'fade', this.props.className)}>
              <div className="modal-dialog">
                <div className="modal-content">
                  <div className="modal-header">
                    <button className="close close_icon" data-dismiss="modal"
                        aria-label="Close"/>
                    <h4 className="modal-title">{this.props.title}</h4>
                  </div>
                  <div className="modal-body">{this.props.children}</div>
                  <div className="modal-footer">
                    <Footer_default ok_clicked={this.props.ok_clicked}
                      cancel_clicked={this.props.cancel_clicked}/>
                  </div>
                </div>
              </div>
            </div>
        );
    }
}

class Modal extends React.Component {
    click_cancel(){
        if (this.props.cancel_clicked)
            this.props.cancel_clicked();
        $('#'+this.props.id).modal('hide');
    }
    click_ok(){
        $('#'+this.props.id).modal('hide');
        const _this = this;
        etask(function*(){
            if (_this.props.click_ok)
                yield _this.props.click_ok();
        });
    }
    on_dismiss(){
        if (this.props.on_dismiss)
            this.props.on_dismiss();
    }
    render(){
        let footer = null;
        if (!this.props.no_footer)
        {
            footer = this.props.footer || (
                <Footer_default cancel_clicked={this.click_cancel.bind(this)}
                  ok_clicked={this.click_ok.bind(this)}
                  ok_btn_title={this.props.ok_btn_title}
                  ok_btn_classes={this.props.ok_btn_classes}
                  no_cancel_btn={this.props.no_cancel_btn}/>
            );
        }
        const header_classes = classnames('modal-header',
            {no_header: this.props.no_header});
        return (
            <div id={this.props.id} tabIndex="-1"
              className={classnames('modal', 'fade', this.props.className)}>
              <div className="modal-dialog">
                <div className="modal-content">
                  <div className={header_classes}>
                    <button className="close close_icon" data-dismiss="modal"
                        aria-label="Close"
                        onClick={this.on_dismiss.bind(this)}>
                    </button>
                    <If
                      when={!this.props.no_header&&!this.props.custom_header}>
                      <h4 className="modal-title">{this.props.title}</h4>
                    </If>
                    <If when={this.props.custom_header}>
                      {this.props.custom_header}
                    </If>
                  </div>
                  <div className="modal-body">{this.props.children}</div>
                  <div className="modal-footer">{footer}</div>
                </div>
              </div>
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


const Footer_default = props=>(
    <div className="default_footer">
      <If when={!props.no_cancel_btn}>
        <button onClick={props.cancel_clicked} className="btn btn_lpm cancel">
          Cancel</button>
      </If>
      <button onClick={props.ok_clicked}
        className={props.ok_btn_classes||'btn btn_lpm ok'}>
        {props.ok_btn_title||'OK'}</button>
    </div>
);

const Loader = ({show})=>(
    <If when={show}>
      <div className="loader_wrapper">
        <div className="mask"/>
        <div className="loader">
          <div className="spinner"/>
        </div>
      </div>
    </If>
);

const Loader_small = ({show})=>(
    <div className={classnames('loader_small', {hide: !show})}>
      <div className="spinner"/>
      <div className="saving_label">Saving...</div>
    </div>
);

class Code extends Pure_component {
    componentDidMount(){
        $(this.ref).find('.btn_copy').tooltip('show')
        .attr('title', 'Copy to clipboard').tooltip('fixTitle');
    }
    set_ref(e){ this.ref = e; }
    copy(){
        if (this.props.on_click)
            this.props.on_click();
        const area = $(this.ref).children('textarea')[0];
        const source = $(this.ref).children('.source')[0];
        area.value = source.innerText;
        area.select();
        try {
            document.execCommand('copy');
            $(this.ref).find('.btn_copy').attr('title', 'Copied!')
            .tooltip('fixTitle')
            .tooltip('show').attr('title', 'Copy to clipboard')
            .tooltip('fixTitle');
        }
        catch(e){ console.log('Oops, unable to copy'); }
    }
    render(){
        return (
            <code ref={this.set_ref.bind(this)}>
              <span className="source">{this.props.children}</span>
              <textarea style={{position: 'fixed', top: '-1000px'}}/>
              <button onClick={this.copy.bind(this)} data-container="body"
                className="btn btn_lpm btn_lpm_small btn_copy">
                Copy</button>
            </code>
        );
    }
}

const Textarea = props=>{
    return (
        <textarea value={props.val} rows={props.rows||3}
          placeholder={props.placeholder}
          onChange={e=>props.on_change_wrapper(e.target.value)}/>
    );
};

const Select = props=>{
    const update = val=>{
        if (val=='true')
            val = true;
        else if (val=='false')
            val = false;
        if (props.on_change_wrapper)
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

const Input = props=>{
    const update = val=>{
        if (props.type=='number' && val)
            val = Number(val);
        if (props.on_change_wrapper)
            props.on_change_wrapper(val, props.id);
    };
    return (
        <input type={props.type} value={props.val} disabled={props.disabled}
          onChange={e=>update(e.target.value)} className={props.className}
          min={props.min} max={props.max} placeholder={props.placeholder}
          onBlur={props.on_blur}/>
    );
};

const Checkbox = props=>(
  <div className="form-check">
    <label className="form-check-label">
      <input className="form-check-input" type="checkbox" value={props.value}
        onChange={e=>props.on_change(e)} checked={props.checked}/>
        {props.text}
    </label>
  </div>
);

const Nav = ({title, subtitle, warning})=>(
    <div className="nav_header">
      <h3>{title}</h3>
      <div className="subtitle">{subtitle}</div>
      <Warning_msg warning={warning}/>
    </div>
);

const Warning_msg = ({warning})=>{
    if (!warning)
        return null;
    return <Warning text={warning}/>;
};

const Pagination_panel = ({entries, items_per_page, cur_page, page_change,
    children, top, bottom, update_items_per_page, max_buttons, total})=>
{
    total = total||entries&&entries.length||0;
    let pagination = null;
    if (total>items_per_page)
    {
        let next = false;
        let pages = Math.ceil(total/items_per_page);
        if (cur_page+1<pages)
            next = 'Next';
        pagination = (
            <Bootstrap.Pagination next={next} boundaryLinks
              activePage={cur_page+1}
              bsSize="small" onSelect={page_change}
              items={pages} maxButtons={max_buttons||5}/>
        );
    }
    let buttons = null;
    if (top)
        buttons = <div className="table_buttons">{children}</div>;
    const display_options = [10, 20, 50, 100, 200, 500, 1000].map(v=>({
        key: v, value: v}));
    const from = Math.min(cur_page*items_per_page+1, total);
    const to = Math.min((cur_page+1)*items_per_page, total);
    return (
        <div className={classnames('pagination_panel', {top, bottom})}>
          {pagination}
          <div className="numbers">
            <strong>{from}-{to}</strong> of <strong>{total}</strong>
          </div>
          <Select val={items_per_page} data={display_options}
            on_change_wrapper={update_items_per_page}/>
          {buttons}
        </div>
    );
};

class Tooltip extends Pure_component {
    componentDidMount(){
        if (!this.ref)
            return;
        $(this.ref).tooltip();
    }
    componentWillUnmount(){ $(this.ref).tooltip('destroy'); }
    componentDidUpdate(prev){
        if (!this.ref||prev.title==this.props.title)
            return;
        $(this.ref).tooltip('destroy');
        $(this.ref).tooltip();
    }
    on_mouse_leave(){
        if (!this.ref)
            return;
        $(this.ref).tooltip('hide');
    }
    set_ref(e){ this.ref = e; }
    render(){
        if (!this.props.children)
            return null;
        if (!this.props.title)
            return this.props.children;
        const props = {
            'data-toggle': 'tooltip',
            'data-placement': this.props.placement||'top',
            'data-container': 'body',
            'data-html': true,
            title: this.props.title,
            ref: this.set_ref.bind(this),
            onMouseLeave: this.on_mouse_leave.bind(this),
        };
        return React.Children.map(this.props.children, c=>{
            if (typeof c=='number')
                c = ''+c;
            if (typeof c=='string')
                return React.createElement('span', props, c);
            return React.cloneElement(c, props);
        });
    }
}

const Link_icon = ({tooltip, on_click, id, classes, disabled, invisible,
    small})=>
{
    if (invisible)
        tooltip = '';
    if (disabled||invisible)
        on_click = ()=>null;
    classes = classnames(classes, {small});
    return (
        <Tooltip title={tooltip}>
          <span className={classnames('link', 'icon_link', classes)}
            onClick={on_click}>
            <i className={classnames('glyphicon', 'glyphicon-'+id)}/>
          </span>
        </Tooltip>
    );
};

const presets = {
    sequential: {
        default: true,
        title: 'Sequential session IP pool',
        subtitle: `Sequential pool of pre-established of sessions (IPs). For
            running groups of requests sharing the same IP to a target site.
            Use refresh_sessions max_requests & session_duration to control
            session (IP) switching`,
        check: function(opt){ return opt.pool_size &&
            (!opt.pool_type || opt.pool_type=='sequential'); },
        set: opt=>{
            opt.pool_size = 1;
            opt.pool_type = 'sequential';
            opt.keep_alive = opt.keep_alive||45;
            opt.sticky_ip = null;
            opt.session = '';
        },
        clean: opt=>{
            opt.pool_size = 0;
            opt.keep_alive = 0;
            opt.max_requests = 0;
            opt.session_duration = 0;
            opt.seed = '';
        },
        rules: [
            {field: 'pool_size', label: `sets 'Pool size' to 1`},
            {field: 'pool_type', label: `sequential pool type`},
            {field: 'keep_alive', label: `sets Keep-alive to 45 seconds`},
            {field: 'sticky_ip', label: `disables 'Sticky Ip'`},
            {field: 'session', label: `disables 'Random Session'`},
        ],
        support: {
            keep_alive: true,
            max_requests: true,
            session_duration: true,
            multiply: true,
            seed: true,
        },
    },
    session_long: {
        title: 'Long single session (IP)',
        subtitle: `All requests share the same long session (IP). For
            connecting a browser to Luminati, maintaining the same IP for as
            long as possible`,
        check: function(opt){ return !opt.pool_size && !opt.sticky_ipo
            && opt.session===true && opt.keep_alive; },
        set: opt=>{
            opt.pool_size = 0;
            opt.keep_alive = opt.keep_alive||50;
            opt.pool_type = null;
            opt.sticky_ip = false;
            opt.session = true;
            opt.seed = false;
        },
        clean: opt=>{
            opt.keep_alive = 0;
            opt.session = '';
            opt.session_duration = 0;
            opt.max_requests = 0;
            opt.seed = '';
        },
        rules: [
            {field: 'pool_size', label: `sets 'Pool size' to 0`},
            {field: 'keep_alive', label: `sets 'Keep-alive' to 50 seconds`},
            {field: 'pool_type', label: `sequential pool type`},
            {field: 'sticky_ip', label: `disables 'Sticky Ip'`},
            {field: 'session', label: `enables 'Random Session'`},
            {field: 'seed', label: `disables 'Session ID Seed'`},
        ],
        support: {
            keep_alive: true,
            multiply: true,
            session_duration: true,
            max_requests: true,
        },
    },
    session: {
        title: 'Single session (IP)',
        subtitle: `All requests share the same active session (IP). For
            connecting a single app/browser that does not need to maintain IP
            on idle times`,
        check: function(opt){ return !opt.pool_size && !opt.sticky_ip
            && opt.session===true && !opt.keep_alive; },
        set: function(opt){
            opt.pool_size = 0;
            opt.keep_alive = 0;
            opt.pool_type = null;
            opt.sticky_ip = false;
            opt.session = true;
            opt.seed = false;
        },
        clean: opt=>{
            opt.session = '';
            opt.session_duration = 0;
            opt.max_requests = 0;
            opt.seed = '';
        },
        rules: [
            {field: 'pool_size', label: `sets 'Pool size' to 0`},
            {field: 'keep_alive', label: `sets 'Keep-alive' to 0 seconds`},
            {field: 'pool_type', label: `sequential pool type`},
            {field: 'sticky_ip', label: `disables 'Sticky Ip'`},
            {field: 'session', label: `enables 'Random Session'`},
            {field: 'seed', label: `disables 'Session ID Seed'`},
        ],
        support: {
            multiply: true,
            session_duration: true,
            max_requests: true,
        },
    },
    sticky_ip: {
        title: 'Session (IP) per machine',
        subtitle: `Each requesting machine will have its own session (IP).
            For connecting several computers to a single Luminati Proxy
            Manager, each of them having its own single session (IP)`,
        check: function(opt){ return !opt.pool_size && opt.sticky_ip; },
        set: function(opt){
            opt.pool_size = 0;
            opt.pool_type = null;
            opt.sticky_ip = true;
            opt.session = '';
        },
        clean: opt=>{
            opt.sticky_ip = null;
            opt.keep_alive = 0;
            opt.max_requests = 0;
            opt.session_duration = 0;
            opt.seed = '';
        },
        rules: [
            {field: 'pool_size', label: `sets 'Pool size' to 0`},
            {field: 'pool_type', label: `sequential pool type`},
            {field: 'sticky_ip', label: `enables 'Sticky Ip'`},
            {field: 'session', label: `disables 'Random Session'`},
            {field: 'multiply', label: `disables 'Multiply' option`},
        ],
        support: {
            keep_alive: true,
            max_requests: true,
            session_duration: true,
            seed: true,
        },
    },
    round_robin: {
        title: 'Round-robin (IP) pool',
        subtitle: `Round-robin pool of pre-established sessions (IPs). For
            spreading requests across large number of IPs. Tweak pool_size,
            max_requests & proxy_count to optimize performance`,
        check: function(opt){ return opt.pool_size
            && opt.pool_type=='round-robin' && !opt.multiply; },
        set: opt=>{
            opt.pool_size = opt.pool_size||1;
            opt.pool_type = 'round-robin';
            opt.keep_alive = opt.keep_alive||45;
            opt.sticky_ip = null;
            opt.session = '';
        },
        clean: opt=>{
            opt.pool_size = 1;
            opt.keep_alive = 0;
            opt.max_requests = 0;
            opt.session_duration = 0;
            opt.seed = '';
        },
        rules: [
            {field: 'pool_size', label: `sets 'Pool size' to 1`},
            {field: 'pool_type', label: `round-robin pool type`},
            {field: 'keep_alive', label: `sets Keep-alive to 45 seconds`},
            {field: 'sticky_ip', label: `disables 'Sticky Ip'`},
            {field: 'session', label: `disables 'Random Session'`},
            {field: 'multiply', label: `disables 'Multiply' options`},
        ],
        support: {
            pool_size: true,
            keep_alive: true,
            max_requests: true,
            session_duration: true,
            seed: true,
        },
    },
    high_performance: {
        title: 'High performance',
        subtitle: 'Maximum request speed',
        check: opt=>true,
        set: opt=>{
            opt.pool_size = 50;
            opt.keep_alive = 40;
            opt.max_requests = 0;
            opt.pool_type = 'round-robin';
            opt.seed = false;
            opt.proxy_count = 20;
            opt.session_duration = 0;
            opt.session_random = false;
            opt.use_proxy_cache = false;
            opt.race_reqs = 2;
        },
        clean: opt=>{
            opt.pool_size = 1;
            opt.keep_alive = 0;
            opt.proxy_count = '';
            opt.race_reqs = '';
            opt.use_proxy_cache = true;
        },
        rules: [
            {field: 'pool_size', label: "sets 'Pool size' to 50"},
            {field: 'keep_alive', label: "sets 'Keep-alive' to 40"},
            {field: 'pool_type', label: "round-robin pool type"},
            {field: 'seed', label: "disables 'Session ID Seed'"},
        ],
        support: {max_requests: true, multiply: true},
    },
    rnd_usr_agent_and_cookie_header: {
        title: 'Random User-Agent and cookie headers',
        subtitle: 'Rotate User-Agent and cookie on each request',
        check: opt=>true,
        set: opt=>{
            opt.session = '';
            opt.sticky_ip = false;
            opt.pool_size = 1;
            opt.pool_type = 'sequential';
            opt.keep_alive = 0;
            opt.max_requests = 0;
            opt.session_duration = 0;
            opt.seed = false;
            opt.rules = opt.rules||{};
            opt.rules.pre = [{
                alphabet: 'wertyuiop;lkjhgfdQWERTYUJBVCF5467',
                header: true,
                name: 'cookie',
                prefix: 'v=',
                random: 'string',
                size: 8,
                suffix: 'end of cookie',
                url: '**'
            },
            {
                arg: [
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebkit/537.36 (KHTML, like Gecko) Chrome/42.0.2311.135 Safari/537.36 Edge/12.246',
                'Mozilla/5.0 (X11; CrOS x86_64 8172.45.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/51.0.2704.64 Safari/537.36',
                'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_2) AppleWebKit/601.3.9 (KHTML, like Gecko) Version/9.0.2 Safari/601.3.9',
                'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/47.0.2526.111 Safari/537.36',
                'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:15.0) Gecko/20100101 Firefox/15.0.1',
                'Mozilla/5.0 (X11; Linux x86_64; rv:2.0b4) Gecko/20100818 Firefox/4.0b4',
                'Mozilla/5.0 (Windows NT 6.1; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/62.0.3202.62 Safari/537.36',
                'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_10_2) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/40.0.2214.38 Safari/537.36',
                'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/51.0.2704.103 Safari/537.36',
                'Mozilla/5.0 (Windows NT 10.0; WOW64; Trident/7.0; rv:11.0) like Gecko'],
                header: true,
                name: 'User-Agent',
                random: 'list',
                url: '**'
            }];
            opt.rules.post = opt.rules.post||[];
        },
        clean: opt=>{ },
        support: {
            multiply: true,
            max_requests: true,
        },
    },
    custom: {
        title: 'Custom',
        subtitle: `Manually adjust all settings to your needs For advanced
            use cases`,
        check: function(opt){ return true; },
        set: function(opt){},
        clean: opt=>{
            opt.session = '';
            opt.sticky_ip = null;
            opt.pool_size = 1;
            opt.pool_type = null;
            opt.keep_alive = 0;
            opt.max_requests = 0;
            opt.session_duration = 0;
            opt.seed = '';
        },
        support: {
            session: true,
            sticky_ip: true,
            pool_size: true,
            pool_type: true,
            keep_alive: true,
            max_requests: true,
            session_duration: true,
            multiply: true,
            seed: true,
        },
    },
};
for (let k in presets)
    presets[k].key = k;

const emitter = new EventEmitter();

const is_electron = window.process && window.process.versions.electron;

const get_static_country = proxy=>{
    if (!proxy||!proxy.zone||!proxy.zones)
        return false;
    const zone = proxy.zones[proxy.zone];
    if (!zone)
        return false;
    const plan = zone.plans[zone.plans.length-1];
    if (plan.type=='static')
        return plan.country||'any';
    if (['domain', 'domain_p'].includes(plan.vips_type))
        return plan.vip_country||'any';
    return false;
};

const status_codes = {
    200: 'OK',
    201: 'Created',
    202: 'Accepted',
    203: 'Non-Authoritative Information',
    204: 'No Content',
    205: 'Reset Content',
    206: 'Partial Content',
    300: 'Multiple Choices',
    301: 'Moved Permanently',
    302: 'Found',
    303: 'See Other',
    304: 'Not Modified',
    305: 'Use Proxy',
    307: 'Temporary Redirect',
    400: 'Bad Request',
    401: 'Unauthorized',
    402: 'Payment Required',
    403: 'Forbidden',
    404: 'Not Found',
    405: 'Method Not Allowed',
    406: 'Not Acceptable',
    407: 'Proxy Authentication Required',
    408: 'Request Timeout',
    409: 'Conflict',
    410: 'Gone',
    411: 'Length Required',
    412: 'Precondition Failed',
    413: 'Request Entity Too Large',
    414: 'Request-URI Too Long',
    415: 'Unsupported Media Type',
    416: 'Requested Range Not Satisfiable',
    417: 'Expectation Failed',
    500: 'Internal Server Error',
    501: 'Not Implemented',
    502: 'Bad Gateway',
    503: 'Service Unavailable',
    504: 'Gateway Timeout',
    505: 'HTTP Version Not Supported',
};

export {Dialog, Code, Modal, Loader, Select, Input, Warnings, Warning, Nav,
    Checkbox, presets, emitter, Pagination_panel, Link_icon, Tooltip,
    Textarea, get_static_country, Loader_small, is_electron, status_codes,
    Modal_dialog};
