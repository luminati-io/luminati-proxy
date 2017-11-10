// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true, es6:true*/
import React from 'react';

const localhost = 'http://127.0.0.1:22999';

class Welcome extends React.Component {
    constructor(props){
        super(props);
        const create = window.localStorage.getItem('quickstart-create-proxy');
        const test = window.localStorage.getItem('quickstart-test-proxy');
        this.state = {create, test};
    }
    click_add_proxy(){
        window.location.href = localhost+'/proxies?action=tutorial_add_proxy';
    }
    render(){
        return (
            <div>
              <div className="sub_header">
                <h4>
                  Configure a new port with specific proxy settings and use it
                  to browse the internet
                </h4>
              </div>
              <div className="section_list">
                <Section header="Configure new proxy port" img="1"
                  text="Specific proxy settings to be applied on this port"
                  on_click={this.click_add_proxy}/>
                <a href="http://127.0.0.1:22999/proxies">Skip to dashboard</a>
              </div>
            </div>
        );
    }
}

const Section = props=>{
    const img_class = 'img img_'+props.img+(props.disabled ? '' : '_active');
    const on_click = ()=>{
        if (props.disabled)
            return;
        props.on_click();
    };
    return (
        <div onClick={on_click}
          className={'section'+(props.disabled ? ' disabled' : '')}>
          <div className="img_block">
            <div className="circle_wrapper"/>
            <div className={img_class}/>
          </div>
          <div className="text_block">
            <div className="title">{props.header}</div>
            <div className="subtitle">{props.text}</div>
          </div>
          <div className="right_arrow"/>
        </div>
    );
};

export default Welcome;
