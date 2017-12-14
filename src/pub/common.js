// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true*/
import _ from 'lodash';
import $ from 'jquery';
import classnames from 'classnames';
import React from 'react';
import * as Bootstrap from 'react-bootstrap';
import regeneratorRuntime from 'regenerator-runtime';
import etask from 'hutil/util/etask';
import ajax from 'hutil/util/ajax';

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
    click_cancel(){ $('#'+this.props.id).modal('hide'); }
    click_ok(){
        const _this = this;
        etask(function*(){
            _this.click_cancel();
            if (_this.props.click_ok)
                yield _this.props.click_ok();
        });
    }
    render(){
        const footer = this.props.footer || (
            <Footer_default cancel_clicked={this.click_cancel.bind(this)}
              ok_clicked={this.click_ok.bind(this)}
              no_cancel_btn={this.props.no_cancel_btn}/>
        );
        return (
            <div id={this.props.id} tabIndex="-1"
              className={classnames('modal', 'fade', this.props.className)}>
              <div className="modal-dialog">
                <div className="modal-content">
                  <div className="modal-header">
                    <button className="close close_icon" data-dismiss="modal"
                        aria-label="Close">
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

const Footer_default = props=>(
    <div className="default_footer">
      <If when={!props.no_cancel_btn}>
        <button onClick={props.cancel_clicked}
          className="btn btn_lpm btn_lpm_default cancel">Cancel
        </button>
      </If>
      <button onClick={props.ok_clicked} className="btn btn_lpm ok">
        OK</button>
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

const If = ({when, children})=>when ? children : null;

const onboarding_steps = {
    WELCOME: 0,
    ADD_PROXY: 1,
    ADD_PROXY_DONE: 2,
    HOWTO: 3,
    HOWTO_DONE: 4,
};

const presets = {
    session_long: {
        title: 'Long single session (IP)',
        subtitle: `All requests share the same long session (IP) For
            connecting a browser to Luminati, maintaining the same IP for as
            long as possible`,
        check: function(opt){ return !opt.pool_size && !opt.sticky_ipo
            && opt.session===true && opt.keep_alive; },
        set: function(opt){
            opt.pool_size = 0;
            opt.ips = [];
            opt.keep_alive = opt.keep_alive || 50;
            opt.pool_type = undefined;
            opt.sticky_ip = false;
            opt.session = true;
            if (opt.session===true)
                opt.seed = false;
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
            session_ducation: true,
            max_requests: true,
        },
    },
    session: {
        title: 'Single session (IP)',
        subtitle: `All requests share the same active session (IP) For
            connecting a single app/browser that does not need to maintain IP
            on idle times`,
        check: function(opt){ return !opt.pool_size && !opt.sticky_ip
            && opt.session===true && !opt.keep_alive; },
        set: function(opt){
            opt.pool_size = 0;
            opt.ips = [];
            opt.keep_alive = 0;
            opt.pool_type = undefined;
            opt.sticky_ip = false;
            opt.session = true;
            if (opt.session===true)
                opt.seed = false;
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
        subtitle: `Each requesting machine will have its own session (IP)
            For connecting several computers to a single Luminati Proxy
            Manager, each of them having its own single session (IP)`,
        check: function(opt){ return !opt.pool_size && opt.sticky_ip; },
        set: function(opt){
            opt.pool_size = 0;
            opt.ips = [];
            opt.pool_type = undefined;
            opt.sticky_ip = true;
            opt.session = undefined;
            opt.multiply = undefined;
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
        subtitle: `Sequential pool of pre-established of sessions (IPs) For
            running groups of requests sharing the same IP to a target site
            Use refresh_sessions max_requests & session_duration to control
            session (IP) switching`,
        check: function(opt){ return opt.pool_size &&
            (!opt.pool_type || opt.pool_type=='sequential'); },
        set: function(opt){
            opt.pool_size = opt.pool_size || 1;
            opt.pool_type = 'sequential';
            opt.sticky_ip = undefined;
            opt.session = undefined;
        },
        rules: [
            {field: 'pool_size', label: `sets 'Pool size' to 1`},
            {field: 'pool_type', label: `sequential pool type`},
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
        subtitle: `Round-robin pool of pre-established sessions (IPs) For
            spreading requests across large number of IPs Tweak pool_size,
            max_requests & proxy_count to optimize performance`,
        check: function(opt){ return opt.pool_size
            && opt.pool_type=='round-robin' && !opt.multiply; },
        set: function(opt){
            opt.pool_size = opt.pool_size || 1;
            opt.pool_type = 'round-robin';
            opt.sticky_ip = undefined;
            opt.session = undefined;
            opt.multiply = undefined;
        },
        rules: [
            {field: 'pool_size', label: `sets 'Pool size' to 1`},
            {field: 'pool_type', label: `round-robin pool type`},
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
    custom: {
        title: 'Custom',
        subtitle: `Manually adjust all settings to your needs For advanced
            use cases`,
        check: function(opt){ return true; },
        set: function(opt){},
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
for (var k in presets)
{
    if (!presets[k].clean)
        presets[k].clean = opt=>opt;
    presets[k].key = k;
}

const combine_presets = data=>{
    let www_presets = (data.presets||[])
    .reduce((prs, np)=>{
        const set = _.cloneDeep(np.set);
        const clean = _.cloneDeep(np.clean);
        np.set = opt=>Object.assign(opt, set);
        np.clean = opt=>Object.assign(opt, clean);
        np.check = ()=>true;
        prs[np.key] = np;
        return prs;
    }, _.cloneDeep(presets));
    return www_presets;
};

export {Dialog, Code, If, Modal, Loader, onboarding_steps, combine_presets};
