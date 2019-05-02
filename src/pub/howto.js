// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true, es6:true*/
import 'prismjs/themes/prism.css';
import React from 'react';
import classnames from 'classnames';
import {withRouter} from 'react-router-dom';
import prism from 'prismjs';
import instructions from './instructions.js';
import {Code} from './common.js';
import {Nav_tabs, Nav_tab} from './common/nav_tabs.js';
import {T} from './common/i18n.js';
import {ga_event, swagger_url} from './util.js';
import Pure_component from '/www/util/pub/pure_component.js';

const Howto = withRouter(class Howto extends Pure_component {
    choose_click = option=>{
        ga_event('How-to-tab', 'select code/browser', option);
        const pathname = `/howto/${option}`;
        this.props.history.push({pathname});
    };
    render(){
        const option = this.props.match.params.option||'code';
        const cur_title = 'using '+option;
        let Instructions = ()=>null;
        if (option=='browser')
            Instructions = Browser_instructions;
        else if (option=='code')
            Instructions = Code_instructions;
        return <T>{t=><div className="howto vbox">
              <div className="nav_header">
                <h3>{t('How to use the Proxy Manager')} {t(cur_title)}</h3>
              </div>
              <div className="howto_panel">
                <div className="panel_inner">
                  <Nav_tabs set_tab={this.choose_click} cur_tab={option}>
                    <Nav_tab id="code" title="Code"
                      tooltip="Examples how to use LPM programmatically"/>
                    <Nav_tab id="browser" title="Browser"
                      tooltip="Examples how to integrate LPM with the
                      browser"/>
                  </Nav_tabs>
                  <Instructions>{this.props.children}</Instructions>
                </div>
                <Animated_instructions/>
              </div>
            </div>}</T>;
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

const Code_instructions = withRouter(
class Code_instructions extends Pure_component {
    click_lang = lang=>{
        ga_event('How-to-tab', 'select option', lang);
        const pathname = `/howto/code/${lang}`;
        this.props.history.push({pathname});
    };
    click_copy = lang=>ga_event('How-to-tab', 'click copy', lang);
    render(){
        const lang = this.props.match.params.suboption||'shell';
        const Lang_btn_clickable = props=>
            <span onClick={()=>this.click_lang(props.lang)}>
              <Lang_btn active={lang==props.lang} {...props}/>
            </span>;
        const tutorial_port = window.localStorage.getItem(
            'quickstart-first-proxy')||24000;
        const to_copy = instructions.code(tutorial_port)[lang];
        const code = prism.highlight(to_copy, prism.languages.clike);
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
                    <Code on_click={()=>this.click_copy(lang)}>
                      <div dangerouslySetInnerHTML={{__html: code}}/>
                    </Code>
                  </code>
                </pre>
              </div>
              <div>
                View available API endpoints
                <a className="link api_link" href={swagger_url}>here</a>
              </div>
            </div>;
    }
});

const Browser_instructions = withRouter(
class Browser_instructions extends Pure_component {
    port = window.localStorage.getItem('quickstart-first-proxy')||24000;
    browser_changed = e=>{
        const browser = e.target.value;
        ga_event('How-to-tab', 'select option', browser);
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
                {instructions.browser(this.port)[browser]}
              </div>
            </div>;
    }
});

export default Howto;
