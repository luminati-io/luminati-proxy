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
import {If} from '/www/util/pub/react_util.js';

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

class Modal extends React.Component {
    click_cancel(){
        if (this.props.cancel_clicked)
            this.props.cancel_clicked();
        $('#'+this.props.id).modal('hide');
    }
    click_ok(){
        const _this = this;
        etask(function*(){
            _this.click_cancel();
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
        return (
            <div id={this.props.id} tabIndex="-1"
              className={classnames('modal', 'fade', this.props.className)}>
              <div className="modal-dialog">
                <div className="modal-content">
                  <div className="modal-header">
                    <button className="close close_icon" data-dismiss="modal"
                        aria-label="Close"
                        onClick={this.on_dismiss.bind(this)}>
                    </button>
                    <h4 className="modal-title">{this.props.title}</h4>
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
        <button onClick={props.cancel_clicked}
          className="btn btn_lpm btn_lpm_default cancel">Cancel
        </button>
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

const Code = props=>{
    const copy = ()=>{
        if (props.on_click)
            props.on_click();
        const area = document.querySelector('#copy_'+props.id+'>textarea');
        const source = document.querySelector('#copy_'+props.id+'>.source');
        area.value = source.innerText;
        area.select();
        try { document.execCommand('copy'); }
        catch(e){ console.log('Oops, unable to copy'); }
    };
    const value = props.children.innerText
        ? props.children.innerText() : props.children;
    return (
        <code id={'copy_'+props.id}>
          <span className="source">{props.children}</span>
          <textarea defaultValue={value}
            style={{position: 'fixed', top: '-1000px'}}/>
          <button onClick={copy}
            className="btn btn_lpm btn_lpm_default btn_copy">
            Copy</button>
        </code>
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

const onboarding = {
    _is_checked(step){
        if (!setdb.get('head.onboarding.steps') &&
            !setdb.get('head.onboarding.loading'))
        {
            setdb.set('head.onboarding.loading', true);
            etask(function*(){
                const steps = yield ajax.json({url: '/api/get_onboarding'});
                if (steps.done)
                {
                    steps.first_login = true;
                    steps.welcome_modal = true;
                    steps.created_proxy = true;
                    steps.tested_proxy = true;
                    steps.seen_examples = true;
                }
                setdb.set('head.onboarding.steps', steps);
                setdb.set('head.onboarding.loading', false);
            });
        }
        const et = etask.wait();
        const listener = setdb.on('head.onboarding.steps', steps=>{
            if (!steps)
                return;
            setdb.off(listener);
            et.return(!!steps[step]||!!steps.done);
        });
        return et;
    },
    _check(step){
        setdb.set('head.onboarding.steps.'+step, true);
        return window.fetch('/api/update_onboarding', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({lpm_onboarding: {[step]: 1}}),
        });
    },
    has_dismissed(){ return this._is_checked('dismissed'); },
    has_logged(){ return this._is_checked('first_login'); },
    has_seen_welcome(){ return this._is_checked('welcome_modal'); },
    has_created_proxy(){ return this._is_checked('created_proxy'); },
    has_tested_proxy(){ return this._is_checked('tested_proxy'); },
    has_seen_examples(){ return this._is_checked('seen_examples'); },
    check_dismiss(){ this._check('dismissed'); },
    check_login(){ this._check('first_login'); },
    check_welcome(){ this._check('welcome_modal'); },
    check_created_proxy(){ this._check('created_proxy'); },
    check_tested_proxy(){ this._check('tested_proxy'); },
    check_seen_examples(){ this._check('seen_examples'); },
    is_all_done(){
        const _this = this;
        return etask(function*(){
            const proxy = yield _this.has_created_proxy();
            const test = yield _this.has_tested_proxy();
            const examples = yield _this.has_seen_examples();
            return proxy && test && examples;
        });
    },
};

const presets = {
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
    sequential: {
        title: 'Sequential session (IP) pool',
        subtitle: `Sequential pool of pre-established of sessions (IPs). For
            running groups of requests sharing the same IP to a target site.
            Use refresh_sessions max_requests & session_duration to control
            session (IP) switching`,
        check: function(opt){ return opt.pool_size &&
            (!opt.pool_type || opt.pool_type=='sequential'); },
        set: function(opt){
            opt.pool_size = opt.pool_size||1;
            opt.pool_type = 'sequential';
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
            {field: 'pool_type', label: `sequential pool type`},
            {field: 'keep_alive', label: `sets Keep-alive to 45 seconds`},
            {field: 'sticky_ip', label: `disables 'Sticky Ip'`},
            {field: 'session', label: `disables 'Random Session'`},
        ],
        support: {
            pool_size: true,
            keep_alive: true,
            max_requests: true,
            session_duration: true,
            multiply: true,
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
        set: function(opt){
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
            opt.session_init_timeout = 5;
            opt.race_reqs = 5;
        },
        clean: opt=>{
            opt.pool_size = 1;
            opt.keep_alive = 0;
            opt.proxy_count = '';
            opt.session_init_timeout = '';
            opt.race_reqs = '';
        },
        rules: [
            {field: 'pool_size', label: "sets 'Pool size' to 50"},
            {field: 'keep_alive', label: "sets 'Keep-alive' to 40"},
            {field: 'pool_type', label: "round-robin pool type"},
            {field: 'seed', label: "disables 'Session ID Seed'"},
        ],
        support: {multiply: true},
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
        support: {multiply: true},
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

export {Dialog, Code, Modal, Loader, Select, Input, Warnings,
    Warning, Nav, onboarding, presets, emitter};
