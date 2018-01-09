// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true, es6:true*/
import React from 'react';
import ajax from 'hutil/util/ajax';
import etask from 'hutil/util/etask';
import setdb from 'hutil/util/setdb';
import {onboarding_steps, Loader, emitter, Modal} from './common.js';
import util from './util.js';
import $ from 'jquery';
import classnames from 'classnames';

const ga_event = util.ga_event;
const steps = onboarding_steps;
const localhost = window.location.origin;

class Setup_guide extends React.Component {
    render(){
        return (
            <div className="setup_guide lpm">
              <h1 className="header">Start using Luminati Proxy Manager</h1>
              <List/>
            </div>
        );
    }
}

class Progress_modal extends React.Component {
    constructor(props){
        super(props);
        this.state = {};
    }
    componentWillMount(){
        emitter.on('setup_guide:progress_modal', this.open_modal.bind(this)); }
    open_modal(title, timeout=0){
        this.setState({title});
        window.setTimeout(()=>$('#progress_modal').modal(), timeout);
    }
    render(){
        return (
            <div className="setup_guide lpm">
              <Modal id="progress_modal" title={this.state.title} no_footer>
                <List/>
              </Modal>
            </div>
        );
    }
}

class List extends React.Component {
    constructor(props){
        super(props);
        let step = JSON.parse(window.localStorage.getItem('quickstart-step'));
        if (!Object.values(steps).includes(Number(step)))
            step = steps.WELCOME;
        let loading = false;
        if (!$('#add_proxy_modal').length)
            loading = true;
        this.state = {step, loading};
    }
    componentWillMount(){
        emitter.on('setup_guide:set_step', this.set_step.bind(this));
        this.listeners = [
            setdb.on('head.consts', consts=>{
                if (consts)
                    this.setState({loading: false});
            }),
        ];
    }
    componentWillUnmount(){ this.listeners.forEach(l=>setdb.off(l)); }
    set_step(step){
        let curr = JSON.parse(window.localStorage.getItem('quickstart-step'));
        if (step>curr)
        {
            window.localStorage.setItem('quickstart-step', step);
            this.setState({step});
            $('#progress_modal').modal('hide');
        }
    }
    click_add_proxy(){
        ga_event('lpm-onboarding', '04 first request button clicked');
        this.set_step(steps.ADD_PROXY_STARTED);
        setdb.get('head.callbacks.state.go')('proxies');
        window.setTimeout(()=>$('#add_proxy_modal').modal('show'), 200);
    }
    click_test(){
        ga_event('lpm-onboarding', '05 proxy tester button clicked');
        this.set_step(steps.TEST_PROXY_CLICKED);
        setdb.get('head.callbacks.state.go')('proxy_tester');
    }
    click_make_request(){
        this.set_step(steps.HOWTO_CLICKED);
        ga_event('lpm-onboarding', '06 first request button clicked');
        setdb.get('head.callbacks.state.go')('howto');
    }
    render(){
        return (
            <div>
              <Loader show={this.state.loading}/>
              <div className="section_list">
                <Section header="Create new proxy" img="create"
                  text="This will configure your proxy settings"
                  on_click={this.click_add_proxy.bind(this)}
                  done={this.state.step>=steps.ADD_PROXY_DONE}/>
                <Section header="Test your proxy" img="test"
                  text="Verify your proxies are enabled and active"
                  on_click={this.click_test.bind(this)}
                  disabled={this.state.step<steps.ADD_PROXY_DONE}
                  done={this.state.step>=steps.TEST_PROXY_CLICKED}/>
                <Section header="Use your proxy" img="req"
                  text="Learn how to use your proxy port in any platform"
                  on_click={this.click_make_request.bind(this)}
                  disabled={this.state.step<steps.TEST_PROXY_CLICKED}
                  done={this.state.step>=steps.HOWTO_CLICKED}/>
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
    const on_click = ()=>{
        if (props.disabled)
            return;
        props.on_click();
    };
    return (
        <div onClick={on_click}
          className={'section'+(props.disabled ? ' disabled' : '')}>
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
