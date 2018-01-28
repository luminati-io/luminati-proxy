// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true, es6:true*/
import React from 'react';
import ajax from 'hutil/util/ajax';
import setdb from 'hutil/util/setdb';
import {Loader, emitter, Modal, onboarding} from './common.js';
import util from './util.js';
import $ from 'jquery';
import classnames from 'classnames';

const ga_event = util.ga_event;
const localhost = window.location.origin;

const Setup_guide = ()=>(
    <div className="setup_guide lpm">
      <h1 className="header">Start using Luminati Proxy Manager</h1>
      <List/>
    </div>
);

class Progress_modal extends React.Component {
    constructor(props){
        super(props);
        this.state = {};
        this.open_modal = this.open_modal.bind(this);
        this.dismiss_clicked = this.dismiss_clicked.bind(this);
    }
    componentWillMount(){
        emitter.on('setup_guide:progress_modal', this.open_modal);
        this.listener = setdb.on('head.onboarding.steps',
            steps=>this.setState({steps}));
    }
    componentWillUnmount(){
        emitter.removeListener('setup_guide:progress_modal', this.open_modal);
        setdb.off(this.listener);
    }
    open_modal(title, timeout=0){
        if (this.state.steps&&this.state.steps.dismissed)
            return;
        this.setState({title});
        window.setTimeout(()=>$('#progress_modal').modal(), timeout);
    }
    dismiss_clicked(){ onboarding.check_dismiss(); }
    render(){
        return (
            <div className="setup_guide lpm">
              <Modal id="progress_modal" title={this.state.title}
                no_cancel_btn ok_btn_title="I will do it later"
                ok_btn_classes="link ok"
                click_ok={this.dismiss_clicked}>
                <List/>
              </Modal>
            </div>
        );
    }
}

class List extends React.Component {
    constructor(props){
        super(props);
        let loading = false;
        if (!$('#add_proxy_modal').length)
            loading = true;
        this.state = {loading, steps: {}};
    }
    componentWillMount(){
        const _this = this;
        this.listeners = [
            setdb.on('head.consts', consts=>{
                if (consts)
                    this.setState({loading: false});
            }),
            setdb.on('head.onboarding.steps', steps=>{
                if (steps)
                    this.setState({steps});
            }),
        ];
    }
    componentWillUnmount(){ this.listeners.forEach(l=>setdb.off(l)); }
    click_add_proxy(){
        ga_event('lpm-onboarding', '04 first request button clicked');
        setdb.get('head.callbacks.state.go')('proxies');
        window.setTimeout(()=>$('#add_proxy_modal').modal('show'), 200);
        $('#progress_modal').modal('hide');
    }
    click_test(){
        ga_event('lpm-onboarding', '05 proxy tester button clicked');
        setdb.get('head.callbacks.state.go')('proxy_tester');
        $('#progress_modal').modal('hide');
    }
    click_make_request(){
        ga_event('lpm-onboarding', '06 first request button clicked');
        setdb.get('head.callbacks.state.go')('howto');
        $('#progress_modal').modal('hide');
    }
    render(){
        return (
            <div>
              <Loader show={this.state.loading}/>
              <div className="section_list">
                <Section header="Create new proxy" img="create"
                  text="This will configure your proxy settings"
                  on_click={this.click_add_proxy.bind(this)}
                  done={this.state.steps.created_proxy}/>
                <div className="vertical_line"/>
                <Section header="Test your proxy" img="test"
                  text="Verify your proxies are enabled and active"
                  on_click={this.click_test.bind(this)}
                  disabled={!this.state.steps.created_proxy}
                  done={this.state.steps.tested_proxy}/>
                <div className="vertical_line"/>
                <Section header="Use your proxy" img="req"
                  text="Learn how to use your proxy port in any platform"
                  on_click={this.click_make_request.bind(this)}
                  disabled={!this.state.steps.tested_proxy}
                  done={this.state.steps.seen_examples}/>
              </div>
            </div>
        );
    }
}

const Section = props=>{
    const img_class = classnames('img', {
        [props.img]: !props.done && !props.disabled,
        [`${props.img}_disabled`]: !props.done && props.disabled,
        done: props.done,
    });
    const section_class = classnames('section', {
        disabled: props.disabled,
        done: props.done,
    });
    const on_click = ()=>{
        if (props.disabled)
            return;
        props.on_click();
    };
    return (
        <div onClick={on_click} className={section_class}>
          <div className="img_block">
            <div className="circle_wrapper"/>
            <div className={img_class}/>
          </div>
          <div className="text_block">
            <div className="title">{props.header}</div>
            <div className="subtitle">{props.text}</div>
          </div>
          <div className="right_arrow"/>
        </div>
    );
};

export {Setup_guide, Progress_modal};
