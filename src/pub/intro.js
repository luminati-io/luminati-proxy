// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true, es6:true*/
import React from 'react';
import ajax from 'hutil/util/ajax';
import etask from 'hutil/util/etask';
import Howto from './howto.js';
import {onboarding_steps, Loader} from './common.js';
import util from './util.js';
import $ from 'jquery';

const ga_event = util.ga_event;
const steps = onboarding_steps;
const localhost = window.location.origin;

class Page extends React.Component {
    constructor(props){
        super(props);
        let step = JSON.parse(window.localStorage.getItem('quickstart-step'));
        if (!Object.values(steps).includes(Number(step)))
            step = steps.WELCOME;
        let loading = false;
        if (!$('#add_proxy_modal').length)
            loading = true;
        this.state = {step, loading};
        // XXX krzysztof: temporary hack; remove when zstore
        window.set_step = this.set_step.bind(this);
        window.constants_loaded = ()=>{ this.setState({loading: false}); };
    }
    set_step(step){
        if (step==steps.ADD_PROXY)
            ga_event('lpm-onboarding', '03 intro page next');
        if (step==steps.HOWTO)
        {
            ga_event('lpm-onboarding',
                '05 first request button clicked');
        }
        if (step==steps.HOWTO_DONE)
            window.location = '/proxies';
        window.localStorage.setItem('quickstart-step', step);
        this.setState({step});
    }
    render(){
        let Current_page;
        switch(this.state.step)
        {
        case steps.WELCOME: Current_page = Welcome; break;
        case steps.ADD_PROXY:
        case steps.HOWTO_DONE:
        case steps.ADD_PROXY_DONE: Current_page = List; break;
        case steps.HOWTO: Current_page = Howto_wrapper; break;
        default: Current_page = Welcome;
        }
        return (
            <div className="intro lpm">
              <Loader show={this.state.loading}/>
              <Current_page set_step={this.set_step.bind(this)}
                curr_step={this.state.step}/>
            </div>
        );
    }
}

const Done_btn = props=>(
    <button onClick={props.on_click} className="btn btn_lpm btn_done">
        Done</button>
);

const Howto_wrapper = props=>{
    const click_done = option=>()=>{
        props.set_step(steps.HOWTO_DONE);
        ga_event('lpm-onboarding', '07 click done', option);
    };
    return (
        <Howto ga_category="onboarding">
            <Done_btn on_click={click_done}/>
        </Howto>
    );
};

const Welcome = props=>(
    <div className="intro_panel">
      <div className="header">
        <h1>Welcome to Luminati Proxy Manager</h1>
      </div>
      <h2 className="sub_header">How it works</h2>
      <div className="sub_header">
        <h4>
          Create multiple proxy ports, each with its own unique configuration,
          for maximum performance and greater scalability
        </h4>
      </div>
      <div className="img_intro"></div>
      <button className="btn btn-primary btn_lpm btn_lpm_big btn_lets_go"
        onClick={()=>props.set_step(steps.ADD_PROXY)}>{"Let's go"}</button>
    </div>
);

class List extends React.Component {
    constructor(props){
        super(props);
        const create = window.localStorage.getItem('quickstart-create-proxy');
        const test = window.localStorage.getItem('quickstart-test-proxy');
        this.state = {create, test};
    }
    click_add_proxy(){ $('#add_proxy_modal').modal('show'); }
    skip_to_dashboard(){
        ga_event('lpm-onboarding', '04 tutorial skipped');
        window.location.href = localhost+'/proxies';
    }
    render(){
        return (
            <div>
              <h1 className="header">Welcome to Luminati Proxy Manager</h1>
              <div className="sub_header">
                <h4>
                  Configure a new port with specific proxy settings and use it
                  to browse the internet
                </h4>
              </div>
              <div className="section_list">
                <Section header="Configure new proxy port" img="1"
                  text="Specific proxy settings to be applied on this port"
                  on_click={this.click_add_proxy}/>
                <Section header="Make your first request" img="2"
                  text=""
                  on_click={()=>this.props.set_step(steps.HOWTO)}
                  disabled={this.props.curr_step<steps.ADD_PROXY_DONE}/>
                <a onClick={this.skip_to_dashboard.bind(this)}>
                  Skip to dashboard</a>
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

export default Page;
