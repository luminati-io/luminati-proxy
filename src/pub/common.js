// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true*/
import _ from 'lodash';
import React from 'react';
import {Modal} from 'react-bootstrap';

class Dialog extends React.Component {
    render(){
        return <Modal {..._.omit(this.props, ['title', 'footer', 'children'])}>
              <Modal.Header closeButton>
                <Modal.Title>{this.props.title}</Modal.Title>
              </Modal.Header>
              <Modal.Body>
                {this.props.children}
              </Modal.Body>
              <Modal.Footer>
                {this.props.footer}
              </Modal.Footer>
            </Modal>;
    }
}

const Code = props=>{
    const copy = ()=>{
        if (props.on_click)
            props.on_click();
        const area = document.querySelector('#copy_'+props.id+'>textarea');
        const source = document.querySelector('#copy_'+props.id+'>.source');
        area.value = source.innerText;
        area.select();
        try { document.execCommand('copy'); }
        catch(e){ console.log('Oops, unable to copy'); }
    };
    const value = props.children.innerText
        ? props.children.innerText() : props.children;
    return (
        <code id={'copy_'+props.id}>
          <span className="source">{props.children}</span>
          <textarea defaultValue={value}
            style={{position: 'fixed', top: '-1000px'}}/>
          <button onClick={copy}
            className="btn btn_lpm btn_lpm_default btn_copy">
            Copy</button>
        </code>
    );
};

const onboarding_steps = {
    WELCOME: 0,
    ADD_PROXY: 1,
    ADD_PROXY_DONE: 2,
    HOWTO: 3,
    HOWTO_DONE: 4,
};

const presets = [
    {
        id: 'session_long',
        title: 'Long single session (IP)',
    },
    {
        id: 'session',
        title: 'Single session (IP)',
    },
    {
        id: 'sticky_ip',
        title: 'Session (IP) per machine',
    },
    {
        id: 'sequential',
        title: 'Sequential session (IP) pool',
    },
    {
        id: 'round_robin',
        title: 'Round-robin (IP) pool',
    },
    {
        id: 'custom',
        title: 'Custom',
    },
];

export {Dialog, Code, onboarding_steps, presets};
