// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true, es6:true*/
import React from 'react';
import ajax from 'hutil/util/ajax';
import setdb from 'hutil/util/setdb';
import {Loader, emitter, Modal, onboarding} from './common.js';
import util from './util.js';
import $ from 'jquery';
import classnames from 'classnames';
import Pure_component from '../../www/util/pub/pure_component.js';

const ga_event = util.ga_event;
const localhost = window.location.origin;

const click_add_proxy = ()=>{
    ga_event('lpm-onboarding', '04 first request button clicked');
    setdb.get('head.callbacks.state.go')('proxies');
    window.setTimeout(()=>$('#add_proxy_modal').modal('show'), 200);
    $('#progress_modal').modal('hide');
};
const click_test = ()=>{
    ga_event('lpm-onboarding', '05 proxy tester button clicked');
    const port = localStorage.getItem('quickstart-first-proxy');
    setdb.get('head.callbacks.state.go')('proxy_tester', {port});
    $('#progress_modal').modal('hide');
};
const click_make_request = ()=>{
    ga_event('lpm-onboarding', '06 first request button clicked');
    setdb.get('head.callbacks.state.go')('howto');
    $('#progress_modal').modal('hide');
};

const Setup_guide = ()=>(
    <div className="setup_guide lpm">
      <h1 className="header">Start using Luminati Proxy Manager</h1>
      <List/>
    </div>
);

class Progress_modal extends Pure_component {
    constructor(props){
        super(props);
        this.state = {};
        this.open_modal = this.open_modal.bind(this);
    }
    componentWillMount(){
        emitter.on('setup_guide:progress_modal', this.open_modal);
        this.setdb_on('head.onboarding.steps',
            steps=>this.setState({steps}));
    }
    willUnmount(){
        emitter.removeListener('setup_guide:progress_modal', this.open_modal);
    }
    open_modal(title, timeout=0){
        if (this.state.steps&&this.state.steps.dismissed)
            return;
        this.setState({title});
        window.setTimeout(()=>$('#progress_modal').modal(), timeout);
    }
    dismiss_clicked(){
        $('#progress_modal').modal('hide');
        setTimeout(()=>$('#dismiss_progress_modal').modal(), 500);
    }
    close_dismiss_modal(){ $('#dismiss_progress_modal').modal('hide'); }
    dismiss_forever(){
        onboarding.check_dismiss();
        this.close_dismiss_modal();
    }
    render(){
        return (
            <div className="setup_guide lpm">
              <Modal id="progress_modal" title={this.state.title}
                className="progress_modal" no_footer
                on_dismiss={this.dismiss_clicked.bind(this)}>
                <List/>
              </Modal>
              <Modal id="dismiss_progress_modal" title="Are you sure?"
                no_footer className="dismiss_progress_modal">
                <div className="buttons">
                  <button onClick={this.close_dismiss_modal.bind(this)}
                    className="btn btn_lpm btn_lpm_default btn_remind">
                    No, remind me later
                  </button>
                  <button onClick={this.dismiss_forever.bind(this)}
                    className="btn btn_lpm">Yes, exit</button>
                </div>
              </Modal>
            </div>
        );
    }
}

class List extends Pure_component {
    constructor(props){
        super(props);
        let loading = false;
        if (!$('#add_proxy_modal').length)
            loading = true;
        this.state = {loading, steps: {}};
    }
    componentWillMount(){
        this.setdb_on('head.consts', consts=>{
            if (consts)
                this.setState({loading: false});
        });
        this.setdb_on('head.onboarding.steps', steps=>{
            if (steps)
                this.setState({steps: {...steps}});
        });
    }
    render(){
        return (
            <div>
              <Loader show={this.state.loading}/>
              <div className="section_list">
                <Create_proxy_section steps={this.state.steps}/>
                <div className="vertical_line"/>
                <Test_proxy_section steps={this.state.steps}/>
                <div className="vertical_line"/>
                <Examples_section steps={this.state.steps}/>
              </div>
            </div>
        );
    }
}

const Create_proxy_section = props=>(
    <Section header="Create new proxy" img="create"
      text="This will configure your proxy settings"
      on_click={click_add_proxy} done={props.steps.created_proxy}/>
);

const Test_proxy_section = props=>(
    <Section header="Test your proxy" img="test"
      text="Verify your proxies are enabled and active"
      on_click={click_test} disabled={!props.steps.created_proxy}
      done={props.steps.tested_proxy}/>
);

const Examples_section = props=>(
    <Section header="Use your proxy" img="req"
      text="Learn how to use your proxy port in any platform"
      on_click={click_make_request} disabled={!props.steps.tested_proxy}
      done={props.steps.seen_examples}/>
);

const Section = props=>{
    const img_class = classnames('img', {
        [props.img]: !props.done && !props.disabled,
        [`${props.img}_disabled`]: !props.done && props.disabled,
        done: props.done,
    });
    const section_class = classnames('section', {
        disabled: props.disabled,
        done: props.done,
    });
    const on_click = ()=>{
        if (props.disabled)
            return;
        props.on_click();
    };
    return (
        <div onClick={on_click} className={section_class}>
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

export {Setup_guide, Progress_modal};
