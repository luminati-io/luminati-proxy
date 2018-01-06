// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true, es6:true*/
import React from 'react';
import ajax from 'hutil/util/ajax';
import etask from 'hutil/util/etask';
import setdb from 'hutil/util/setdb';
import {onboarding_steps, Loader, emitter} from './common.js';
import util from './util.js';
import $ from 'jquery';

const ga_event = util.ga_event;
const steps = onboarding_steps;
const localhost = window.location.origin;

class Setup_guide extends React.Component {
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
        emitter.on('setup_guide:set_step', this.set_step.bind(this)),
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
        }
    }
    render(){
        return (
            <div className="setup_guide lpm">
              <Loader show={this.state.loading}/>
              <List set_step={this.set_step.bind(this)}
                curr_step={this.state.step}/>
            </div>
        );
    }
}

class List extends React.Component {
    click_add_proxy(){
        ga_event('lpm-onboarding', '04 first request button clicked');
        this.props.set_step(steps.ADD_PROXY_STARTED);
        $('#add_proxy_modal').modal('show');
    }
    click_test(){
        ga_event('lpm-onboarding', '05 proxy tester button clicked');
        setdb.get('head.callbacks.state.go')('proxy_tester');
        this.props.set_step(steps.TEST_PROXY_CLICKED);
    }
    click_make_request(){
        this.props.set_step(steps.HOWTO_CLICKED);
        ga_event('lpm-onboarding', '06 first request button clicked');
        setdb.get('head.callbacks.state.go')('howto');
    }
    render(){
        return (
            <div>
              <h1 className="header">Welcome to Luminati Proxy Manager</h1>
              <h4 className="sub_header">
                Configure a new port with specific proxy settings and use it
                to browse the internet
              </h4>
              <div className="section_list">
                <Section header="Configure new proxy port" img="1"
                  text="Specific proxy settings to be applied on this port"
                  on_click={this.click_add_proxy.bind(this)}/>
                <Section header="Test your new proxy" img="2"
                  text="Make sure your proxies are working properly"
                  on_click={this.click_test.bind(this)}
                  disabled={this.props.curr_step<steps.ADD_PROXY_DONE}/>
                <Section header="Make your first request" img="3"
                  text="Learn how to use your proxies in browser or code"
                  on_click={this.click_make_request.bind(this)}
                  disabled={this.props.curr_step<steps.TEST_PROXY_CLICKED}/>
              </div>
            </div>
        );
    }
}

const Section = props=>{
    const img_class = 'img img_'+props.img+(props.disabled ? '' : '_active');
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

export default Setup_guide;
