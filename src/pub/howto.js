// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true, es6:true*/
import 'prismjs/themes/prism.css';
import React from 'react';
import prism from 'prismjs';
import instructions from './instructions.js';
import {Code, Tooltip, Nav_tabs} from './common.js';
import {ga_event, swagger_url} from './util.js';
import Pure_component from '../../www/util/pub/pure_component.js';
import classnames from 'classnames';
import {withRouter} from 'react-router-dom';

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
        return <div className="howto vbox">
              <div className="nav_header">
                <h3>How to use the Proxy Manager {cur_title}</h3>
              </div>
              <div className="howto_panel">
                <div className="panel_inner">
                  <Nav_tabs>
                    <Tab id="code" title="Code"
                      tooltip="Examples how to use LPM programatically"
                      on_click={this.choose_click} cur_tab={option}/>
                    <Tab id="browser" title="Browser"
                      tooltip="Examples how to inegrate LPM with the browser"
                      on_click={this.choose_click} cur_tab={option}/>
                  </Nav_tabs>
                  <Instructions>{this.props.children}</Instructions>
                </div>
                <Animated_instructions/>
              </div>
            </div>;
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

const Tab = withRouter(({id, on_click, title, cur_tab, tooltip, match})=>{
    const active = cur_tab==id;
    const btn_class = classnames('btn_tab', {active});
    return <Tooltip title={tooltip}>
          <div onClick={()=>on_click(id)} className={btn_class}>
            <div className={classnames('icon', id)}/>
            <div className="title">{title}</div>
            <div className="arrow"/>
          </div>
        </Tooltip>;
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
                <p>Choose browser</p>
                <select value={browser} onChange={this.browser_changed}>
                  <option value="chrome_win">Chrome Windows</option>
                  <option value="chrome_mac">Chrome Mac</option>
                  <option value="ie">Internet Explorer</option>
                  <option value="firefox">Firefox</option>
                  <option value="safari">Safari</option>
                </select>
              </div>
              <div className="instructions_well">
                <div className="instructions">
                  {instructions.browser(this.port)[browser]}
                </div>
              </div>
            </div>;
    }
});

export default Howto;
