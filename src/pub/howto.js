// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true, es6:true*/
import React from 'react';

class Howto extends React.Component {
    constructor(props){
        super(props);
        this.state = {};
    }
    choose_click(option){ this.setState({option}); }
    render(){
        let subheader;
        if (this.state.option)
            subheader = 'using '+this.state.option;
        return (
            <div className="intro lpm">
              <div className="howto">
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
                {this.state.option=='browser' ?
                  <Browser_instructions/> : null}
                {this.state.option=='code' ?
                  <Code_instructions/> : null}
              </div>
            </div>
        );
    }
}

const Subheader = props=>(
    props.value ? <h1 className="sub_header">{props.value}</h1> : null
);

const Lang_btn = props=>(
    <button className="btn btn_lpm btn_lpm_default btn_lpm_small btn_lang">
      {props.lang}</button>
);

const Code_instructions = ()=>(
    <div className="code_instructions">
      <div className="well header_well">
        <Lang_btn lang="Shell"/>
        <Lang_btn lang="Node.js"/>
        <Lang_btn lang="Java"/>
        <Lang_btn lang="C#"/>
        <Lang_btn lang="VB"/>
        <Lang_btn lang="PHP"/>
        <Lang_btn lang="Python"/>
        <Lang_btn lang="Ruby"/>
        <Lang_btn lang="Perl"/>
      </div>
      <div className="well instructions_well">
        todo
      </div>
    </div>
);

const Browser_instructions = ()=>(
    <div className="browser_instructions">
      <div className="well header_well">
        <p>Choose browser</p>
        <select>
          <option>Chrome Windows</option>
          <option>Chrome Mac</option>
          <option>Internet Explorer</option>
          <option>Firefox</option>
          <option>Safari</option>
        </select>
      </div>
      <div className="well instructions_well">
        <div className="instructions">
          <ol>
            <Instruction>
              Click the Tools button, and then click Internet
              options.
            </Instruction>
            <Instruction>
              Click the Connections tab.
            </Instruction>
            <Instruction>
              Enter "Address":
              <Code id="address">127.0.0.1</Code>
            </Instruction>
          </ol>
        </div>
      </div>
    </div>
);

const Instruction = props=>(
    <li>
      <div className="circle_wrapper">
        <div className="circle"></div>
      </div>
      <div className="single_instruction">{props.children}</div>
    </li>
);

// XXX krzysztof: consider making it a common component and share with lum
const Code = props=>{
    const copy = ()=>{
        const area = document.querySelector('#copy_'+props.id+'>textarea');
        area.select();
        try { document.execCommand('copy'); }
        catch(e){ console.log('Oops, unable to copy'); }
    };
    return (
        <code id={'copy_'+props.id}>
          {props.children}
          <textarea defaultValue={props.children}
            style={{position: 'fixed', top: '-1000px'}}/>
          <button onClick={copy}
            className="btn btn_lpm btn_lpm_default btn_copy">
            Copy</button>
        </code>
    );
};

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
