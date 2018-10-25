// LICENSE_CODE ZON ISC
'use strict'; /*jslint browser:true, react:true, es6:true*/
import React from 'react';
import Pure_component from '../../www/util/pub/pure_component.js';
import {Logo, Circle_li as Li, Code} from './common.js';

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
      <h3>How to whitelist your IP?</h3>
      <div className="instructions">
        <ol>
          <Li>
            Connect to the server where the Proxy Manager is
            running (using SSH).
          </Li>
          <Li>
            In your remote server's terminal, run:
            <Code>lpm_whitelist_ip {ip}</Code>
          </Li>
          <Li>Reload this page. Your IP should already be whitelisted.</Li>
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
