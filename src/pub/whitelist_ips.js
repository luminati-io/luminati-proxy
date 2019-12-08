// LICENSE_CODE ZON ISC
'use strict'; /*jslint browser:true, react:true, es6:true*/
import React from 'react';
import classnames from 'classnames';
import Pure_component from '/www/util/pub/pure_component.js';
import {Logo, Code, with_www_api} from './common.js';
import {Instructions, Li} from './common/bullets.js';
import './css/whitelist_ips.less';

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

const Admin_steps = ({ip})=>
    <div className="steps">
      <h3>How to whitelist your IP?</h3>
      <Instructions>
        <Li>
          Connect to the server where the Proxy Manager is
          running (using SSH).
        </Li>
        <Li>
          In your remote server's terminal, run:
          <Code>lpm_whitelist_ip {ip}</Code>
        </Li>
        <Li>Reload this page. Your IP should already be whitelisted.</Li>
      </Instructions>
    </div>;

const Guest_steps = ({ip})=>
    <div className="steps">
      <h3>How to get an access?</h3>
      <Instructions>
        <Li>Your IP has already been requested to be whitelisted</Li>
        <Li>
          Tell the administator of the server to accept your IP
          <Code>{ip}</Code>
        </Li>
        <Li>Wait until your IP gets whitelisted</Li>
      </Instructions>
    </div>;

const user_types = {
    admin: {
        title: 'Admin',
        desc: 'Use your Luminati account email & password.',
        steps: Admin_steps,
    },
    guest: {
        title: 'Company user',
        desc: 'Login to specific zone. Credentials can be obtain from your'
            +' system admin.',
        steps: Guest_steps,
    },
};

const Header = ({ip})=>
    <div className="whitelist_header">
      <h3>Connection from your IP ({ip}) is forbidden</h3>
    </div>;

class Instruction extends Pure_component {
    state = {};
    select_user = user=>{
        this.setState({user});
    };
    render(){
        return <div>
              <Header ip={this.props.ip}/>
              <User_choice select_user={this.select_user}
                cur_user={this.state.user}/>
              <Steps cur_user={this.state.user} ip={this.props.ip}/>
            </div>;
    }
}

const User_choice = ({select_user, cur_user})=>
    <div className="user_choice">
      <User type="admin" on_click={select_user} active={cur_user=='admin'}/>
      <User type="guest" on_click={select_user} active={cur_user=='guest'}/>
    </div>;

const User = ({type, on_click, active})=>
    <div className={classnames('user', {active: !!active})}
      onClick={()=>on_click(type)}>
      <div className="img_wrapper">
        <div className={classnames('img', type)}/>
      </div>
      <div className="user_title">{user_types[type].title}</div>
      <div className="user_desc">{user_types[type].desc}</div>
    </div>;

const Steps = with_www_api(({cur_user, ip, www_api})=>{
    if (!cur_user)
        return null;
    const User_steps = user_types[cur_user].steps;
    return <div>
          <User_steps ip={ip}/>
          <div>
            <span>For more information on how to enable this feature see the
              related topic on our FAQ page: </span>
            <a className="link"
              href={`${www_api}/faq#proxy-security`}>
              {`${www_api}/faq#proxy-security`}
            </a>
          </div>
        </div>;
});
