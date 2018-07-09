// LICENSE_CODE ZON ISC
'use strict'; /*jslint browser:true, react:true, es6:true*/
import React from 'react';
import Pure_component from '../../www/util/pub/pure_component.js';
import {Logo, Circle_li as Li} from './common.js';

export default class Whitelist_ips extends Pure_component {
    state = {};
    componentDidMount(){
        this.setdb_on('head.blocked_ip', ip=>this.setState({ip}));
    }
    render(){
        return <div className="whitelist_ips">
              <Logo/>
              <Instruction ip={this.state.ip}/>
            </div>;
    }
}

const Header = ({ip})=>
    <div className="whitelist_header">
      <h3>Connection from your IP ({ip}) is forbidden</h3>
    </div>;

const Instruction = ({ip})=>
    <div className="instruction">
      <Header ip={ip}/>
      <Steps ip={ip}/>
    </div>;

const Steps = ({ip})=>
    <div className="steps">
      <h3>How to setup 'Admin whitelisted IPs'?</h3>
      <div className="instructions">
        <ol>
          <Li>Go to your LPM's admin page while on root server:
            http://127.0.0.1/config</Li>
          <Li>Edit the config file and add inside "_defaults" new line
            "www_whitelist_ips": ["{ip}", ...[more IPs]]</Li>
          <Li>
            Edit the array in the example to represent all the IPs you
            wish to whitelist as admin(it can also be IP range e.g. 1.1.1.1/1)
          </Li>
          <Li>Save new configuration.</Li>
        </ol>
      </div>
      <div>
        <span>For more information on how to enable this feature see the
          related topic on our FAQ page: </span>
        <a className="link"
          href="https://luminati.io/faq#proxy-security">
          https://luminati.io/faq#proxy-security
        </a>
      </div>
    </div>;
