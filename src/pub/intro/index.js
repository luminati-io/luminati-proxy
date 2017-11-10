// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true, es6:true*/
import React from 'react';
import WelcomePage from './welcome.js';

const ga_event = (cat, action, label)=>
    window.ga && window.ga('send', 'event', cat, action, label);

class Page extends React.Component {
    constructor(props){
        super(props);
        this.state = {btn_clicked:
            !!window.localStorage.getItem('quickstart-welcome')};
    }
    btn_go_click(){
        window.ga('lpm-onboarding', '03 intro page next');
        window.localStorage.setItem('quickstart-welcome', true);
        this.setState({btn_clicked: true});
    }
    render(){
        const CurrentPage = this.state.btn_clicked ? WelcomePage : Index;
        return (
            <div className="intro">
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

export default Page;
