// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true, es6:true*/
import 'prismjs/themes/prism.css';
import React from 'react';
import prism from 'prismjs';
import instructions from './instructions.js';
import {Code} from './common.js';
import {ga_event} from './util.js';
import Pure_component from '../../www/util/pub/pure_component.js';
import classnames from 'classnames';

class Howto extends Pure_component {
    state = {option: 'code'};
    choose_click(option){
        this.setState({option});
        ga_event('How-to-tab', 'select code/browser', option);
    }
    render(){
        let cur_title;
        if (this.state.option)
            cur_title = 'using '+this.state.option;
        let Instructions = ()=>null;
        if (this.state.option=='browser')
            Instructions = Browser_instructions;
        else if (this.state.option=='code')
            Instructions = Code_instructions;
        return <div className="howto">
              <div className="nav_header">
                <h3>How to use the Proxy Manager {cur_title}</h3>
              </div>
              <div className="howto_panel">
                <div className="panel_inner">
                  <div className="nav_tabs tabs">
                    <Tab id="code" title="Code"
                      on_click={this.choose_click.bind(this)}
                      cur_tab={this.state.option}/>
                    <Tab id="browser" title="Browser"
                      on_click={this.choose_click.bind(this)}
                      cur_tab={this.state.option}/>
                  </div>
                  <Instructions>{this.props.children}</Instructions>
                </div>
              </div>
            </div>;
    }
}

const Tab = ({id, on_click, title, cur_tab})=>{
    const active = cur_tab==id;
    const btn_class = classnames('btn_tab', {active});
    return <div onClick={()=>on_click(id)} className={btn_class}>
          <div className={classnames('icon', id)}/>
          <div className="title">{title}</div>
          <div className="arrow"/>
        </div>;
};

const Lang_btn = props=>{
    const class_names = 'btn btn_lpm btn_lpm_small btn_lang'
    +(props.active ? ' active' : '');
    return <button className={class_names}>{props.text}</button>;
};

class Code_instructions extends Pure_component {
    state = {lang: 'shell'};
    swagger_url = 'http://petstore.swagger.io/?url=https://'
    +'raw.githubusercontent.com/luminati-io/luminati-proxy/master/lib/'
    +'swagger.json#/Proxy';
    click_lang(lang){
        this.setState({lang});
        ga_event('How-to-tab', 'select option', lang);
    }
    click_copy(lang){ ga_event('How-to-tab', 'click copy', lang); }
    render(){
        const Lang_btn_clickable = props=>
            <span onClick={()=>this.click_lang(props.lang)}>
              <Lang_btn active={this.state.lang==props.lang} {...props}/>
            </span>;
        const tutorial_port = window.localStorage.getItem(
            'quickstart-first-proxy')||24000;
        const to_copy = instructions.code(tutorial_port)[this.state.lang];
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
                    <Code on_click={()=>this.click_copy(this.state.lang)}>
                      <div dangerouslySetInnerHTML={{__html: code}}/>
                    </Code>
                  </code>
                </pre>
              </div>
              <div>
                View available API endpoints
                <a className="link api_link" href={this.swagger_url}>here</a>
              </div>
            </div>;
    }
}

class Browser_instructions extends Pure_component {
    constructor(props){
        super(props);
        this.state = {browser: 'chrome_win'};
        this.port = window.localStorage.getItem(
            'quickstart-first-proxy')||24000;
    }
    browser_changed(e){
        const browser = e.target.value;
        this.setState({browser});
        ga_event('How-to-tab', 'select option', browser);
    }
    render(){
        return <div className="browser_instructions">
              <div className="header_well">
                <p>Choose browser</p>
                <select onChange={this.browser_changed.bind(this)}>
                  <option value="chrome_win">Chrome Windows</option>
                  <option value="chrome_mac">Chrome Mac</option>
                  <option value="ie">Internet Explorer</option>
                  <option value="firefox">Firefox</option>
                  <option value="safari">Safari</option>
                </select>
              </div>
              <div className="instructions_well">
                <div className="instructions">
                  {instructions.browser(this.port)[this.state.browser]}
                </div>
              </div>
            </div>;
    }
}

export default Howto;
