// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true, es6:true*/
import React from 'react';

const localhost = 'http://127.0.0.1:22999';
const ga_event = (cat, action, label)=>
    window.ga && window.ga('send', 'event', cat, action, label);

class Page extends React.Component {
    constructor(props){
        super(props);
        this.state = {btn_clicked:
            !!window.localStorage.getItem('quickstart-welcome')};
    }
    btn_go_click(){
        ga_event('lpm-onboarding', '03 intro page next');
        window.localStorage.setItem('quickstart-welcome', true);
        this.setState({btn_clicked: true});
    }
    render(){
        const CurrentPage = this.state.btn_clicked ? Welcome : Index;
        return (
            <div className="intro lpm">
              <h1 className="header">Welcome to Luminati Proxy Manager</h1>
              <CurrentPage btn_go_click={this.btn_go_click.bind(this)}/>
            </div>
        );
    }
}

const Index = props=>(
    <div className="header">
      <h2>How it works</h2>
      <div className="sub_header">
        <h4>
          Create multiple proxy ports, each with its own unique configuration,
          for maximum performance and greater scalability
        </h4>
      </div>
      <div className="img_intro"></div>
      <button className="btn btn-primary btn_lpm btn_lpm_big"
        onClick={props.btn_go_click}>{"Let's go"}</button>
    </div>
);

class Welcome extends React.Component {
    constructor(props){
        super(props);
        const create = window.localStorage.getItem('quickstart-create-proxy');
        const test = window.localStorage.getItem('quickstart-test-proxy');
        this.state = {create, test};
    }
    click_add_proxy(){
        window.location.href = localhost+'/proxies?action=tutorial_add_proxy';
    }
    skip_to_dashboard(){
        ga_event('lpm-onboarding', '04 tutorial skipped');
        window.location.href = 'http://127.0.0.1:22999/proxies';
    }
    render(){
        return (
            <div>
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
