// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true, es6:true*/
import 'prismjs/themes/prism.css';
import React from 'react';
import classnames from 'classnames';
import {withRouter} from 'react-router-dom';
import prism from 'prismjs';
import instructions from './instructions.js';
import Proxy_tester from './proxy_tester.js';
import {Code, with_www_api} from './common.js';
import {Nav_tabs, Nav_tab} from './common/nav_tabs.js';
import {T} from './common/i18n.js';
import Pure_component from '/www/util/pub/pure_component.js';
import {Back_btn} from './proxy_edit/index.js';

const cloud_url_address = cname=>
    `lpm-customer-${cname}.zproxy.lum-superproxy.io`;

const Howto = withRouter(class Howto extends Pure_component {
    state = {settings: {}};
    componentDidMount(){
        this.setdb_on('head.settings', settings=>
            settings && this.setState({settings}));
    }
    choose_click = option=>{
        const pathname = `/howto/${option}`;
        this.props.history.push({pathname});
    };
    option_to_text = {
        code: 'from custom code',
        browser: 'using browser',
        proxy_tester: 'instantly from here',
    };
    back_btn_click = ()=>this.props.history.push({pathname: '/overview'});
    render(){
        const {zagent, customer, lpm_token} = this.state.settings;
        const option = this.props.match.params.option||'code';
        const cur_title = this.option_to_text[option];
        const hostname = zagent ? cloud_url_address(customer) : undefined;
        const lpm_token_value = (lpm_token||'').split('|')[0];
        let Instructions = ()=>null;
        if (option=='browser')
            Instructions = Browser_instructions;
        else if (option=='code')
            Instructions = Code_instructions;
        else if (option=='proxy_tester')
            Instructions = Proxy_tester;
        return <T>{t=><div className="howto">
            <div className="cp_panel vbox">
              <div className="cp_panel_header">
                <Back_btn click={this.back_btn_click}/>
                <h2>{t('How to use LPM')} {t(cur_title)}</h2>
              </div>
              <div className="panel_inner vbox">
                <Nav_tabs set_tab={this.choose_click} cur_tab={option}>
                  <Nav_tab id="code" title="Code"
                    tooltip="Examples how to use LPM programmatically"/>
                  <Nav_tab id="browser" title="Browser"
                    tooltip="Examples how to integrate LPM with the
                    browser"/>
                  <Nav_tab id="proxy_tester" title="Web tester"
                    tooltip="Send example requests from here"/>
                </Nav_tabs>
                <Instructions hostname={hostname} lpm_token={lpm_token_value}>
                  {this.props.children}
                </Instructions>
              </div>
              {false && <Animated_instructions/>}
            </div></div>}</T>;
    }
});

const Animated_instructions = withRouter(props=>{
    const option = props.match.params.option||'code';
    const browser = props.match.params.suboption||'chrome_win';
    if (option!='browser')
        return null;
    return <div className="gifs_inner vbox">
          <div className={classnames('gif', browser)}/>
        </div>;
});

const Lang_btn = props=>{
    const class_names = 'btn btn_lpm btn_lpm_small btn_lang'
    +(props.active ? ' active' : '');
    return <button className={class_names}>{props.text}</button>;
};

const Code_instructions = with_www_api(withRouter(
class Code_instructions extends Pure_component {
    click_lang = lang=>{
        const pathname = `/howto/code/${lang}`;
        this.props.history.push({pathname});
    };
    render(){
        const lang = this.props.match.params.suboption||'shell';
        const Lang_btn_clickable = props=>
            <span onClick={()=>this.click_lang(props.lang)}>
              <Lang_btn active={lang==props.lang} {...props}/>
            </span>;
        const tutorial_port = window.localStorage.getItem(
            'quickstart-first-proxy')||22225;
        const to_copy = instructions.code(tutorial_port, this.props.lpm_token,
            this.props.hostname)[lang];
        const code = prism.highlight(to_copy, prism.languages.clike);
        const api_url = this.props.www_api+'/doc/api#lpm_endpoints';
        return <div className="code_instructions">
              <div className="options">
                <Lang_btn_clickable lang="shell" text="Shell"/>
                <Lang_btn_clickable lang="node" text="Node.js"/>
                <Lang_btn_clickable lang="java" text="Java"/>
                <Lang_btn_clickable lang="csharp" text="C#"/>
                <Lang_btn_clickable lang="vb" text="VB"/>
                <Lang_btn_clickable lang="php" text="PHP"/>
                <Lang_btn_clickable lang="python" text="Python"/>
                <Lang_btn_clickable lang="ruby" text="Ruby"/>
                <Lang_btn_clickable lang="perl" text="Perl"/>
              </div>
              <div className="well instructions_well">
                <pre>
                  <code>
                    <Code>
                      <div dangerouslySetInnerHTML={{__html: code}}/>
                    </Code>
                  </code>
                </pre>
              </div>
              <div>
                <T>To view available API endpoints</T>
                <a rel="noopener noreferrer" target="_blank"
                  className="link api_link" href={api_url}>
                  <T>click here</T>
                </a>
              </div>
            </div>;
    }
}));

const Browser_instructions = withRouter(
class Browser_instructions extends Pure_component {
    port = window.localStorage.getItem('quickstart-first-proxy')||22225;
    browser_changed = e=>{
        const browser = e.target.value;
        const pathname = `/howto/browser/${browser}`;
        this.props.history.push({pathname});
    };
    render(){
        const browser = this.props.match.params.suboption||'chrome_win';
        return <div className="browser_instructions">
              <div className="header_well">
                <p><T>Choose browser</T></p>
                <select value={browser} onChange={this.browser_changed}>
                  <option value="chrome_win">Chrome Windows</option>
                  <option value="chrome_mac">Chrome Mac</option>
                  <option value="ie">Internet Explorer</option>
                  <option value="firefox">Firefox</option>
                  <option value="safari">Safari</option>
                </select>
              </div>
              <div className="instructions_well">
                {instructions.browser(this.port, this.props.lpm_token,
                    this.props.hostname)[browser]}
              </div>
            </div>;
    }
});

export default Howto;
