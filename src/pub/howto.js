// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true, es6:true*/
import 'prismjs/themes/prism.css';
import React from 'react';
import prism from 'prismjs';
import instructions from './instructions.js';
import {Code} from './common.js';
import util from './util.js';

const ga_event = util.ga_event;

class Howto extends React.Component {
    constructor(props){
        super(props);
        this.state = {};
    }
    render_children(){
        return React.Children.map(this.props.children, child=>{
            return React.cloneElement(child, {
                on_click: child.props.on_click(this.state.option)});
        });
    }
    choose_click(option){
        ga_event('How-to-tab', 'select code/browser', option);
        this.setState({option});
    }
    render(){
        let subheader;
        if (this.state.option)
            subheader = 'using '+this.state.option;
        let Instructions = ()=>null;
        if (this.state.option=='browser')
            Instructions = Browser_instructions;
        else if (this.state.option=='code')
            Instructions = Code_instructions;
        return (
            <div className="howto lpm">
              <div className="howto_panel">
                <h1 className="header">Make your first request</h1>
                <Subheader value={subheader}/>
                <div className="choices">
                  <Choice option="Browser"
                    selected={this.state.option=='browser'}
                    on_click={()=>this.choose_click('browser')}/>
                  <div className="text_middle">or</div>
                  <Choice option="Code"
                    selected={this.state.option=='code'}
                    on_click={()=>this.choose_click('code')}/>
                </div>
                <Instructions>{this.props.children}</Instructions>
                {this.state.option ? this.render_children() : null}
              </div>
            </div>
        );
    }
}

const Subheader = props=>(
    props.value ? <h1 className="sub_header">{props.value}</h1> : null
);

const Lang_btn = props=>{
    const class_names = 'btn btn_lpm btn_lpm_default btn_lpm_small btn_lang'
    +(props.active ? ' active' : '');
    return <button className={class_names}>{props.text}</button>;
};

class Code_instructions extends React.Component {
    constructor(props){
        super(props);
        this.state = {lang: 'shell'};
    }
    click_lang(lang){
        this.setState({lang});
        ga_event('How-to-tab', 'select option', lang);
    }
    click_copy(lang){ ga_event('How-to-tab', 'click copy', lang); }
    render(){
        const Lang_btn_clickable = props=>(
            <span onClick={()=>this.click_lang(props.lang)}>
              <Lang_btn active={this.state.lang==props.lang} {...props}/>
            </span>
        );
        const tutorial_port = window.localStorage.getItem(
            'quickstart-first-proxy')||24000;
        const code = prism.highlight(
            instructions.code(tutorial_port)[this.state.lang],
            prism.languages.clike);
        return (
            <div className="code_instructions">
              <div className="well header_well">
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
                    <Code id={this.state.lang}
                      on_click={()=>this.click_copy(this.state.lang)}>
                      <div dangerouslySetInnerHTML={{__html:  code}}/></Code>
                  </code>
                </pre>
              </div>
            </div>
        );
    }
}

class Browser_instructions extends React.Component {
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
        return (
            <div className="browser_instructions">
              <div className="well header_well">
                <p>Choose browser</p>
                <select onChange={this.browser_changed.bind(this)}>
                  <option value="chrome_win">Chrome Windows</option>
                  <option value="chrome_mac">Chrome Mac</option>
                  <option value="ie">Internet Explorer</option>
                  <option value="firefox">Firefox</option>
                  <option value="safari">Safari</option>
                </select>
              </div>
              <div className="well instructions_well">
                <div className="instructions">
                  {instructions.browser(this.port)[this.state.browser]}
                </div>
              </div>
            </div>
        );
    }
}

const Choice = props=>{
    const c = 'choice'+(props.selected ? ' active' : '');
    return (
        <div className={c} onClick={props.on_click}>
          <div className="content">
            <div className="text_smaller">Using</div>
            <div className="text_bigger">{props.option}</div>
          </div>
        </div>
    );
};

export default Howto;
