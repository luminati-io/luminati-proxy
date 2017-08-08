// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true*/
import regeneratorRuntime from 'regenerator-runtime';
import React from 'react';
import ReactDOM from 'react-dom';
import {Col, Button} from 'react-bootstrap';
import {Dialog} from './common.js';
import etask from 'hutil/util/etask';

let mount, ga_event;
const E = {
    init_ga: ga=>ga_event = ga,
    install: mnt=>{ ReactDOM.render(<MessageList />, mount = mnt); },
    uninstall: ()=>{
        if (mount)
            ReactDOM.unmountComponentAtNode(mount);
        mount = null;
    },
};

const thumb_style = {float: 'left', width: '50px'};
const separator_style = {float: 'left', width: '25px', height: '30px',
    borderLeft: '1px solid #ccc'}

class Message extends React.Component {
    thumbs_up = ()=>this.props.on_thumbs_up(this.props.msg);
    thumbs_down = ()=>this.props.on_thumbs_down(this.props.msg);
    dismiss = ()=>this.props.on_dismiss(this.props.msg);
    render(){
        return <Col md={12} className="alert alert-info settings-alert">
              <Col md={8}>{this.props.msg.message}</Col>
              <Col md={4}>
                <div style={thumb_style}>
                  <a className="custom_link" onClick={this.thumbs_up} href="#">
                    <img src="img/ic_thumbs_up.svg"/></a>
                </div>
                <div style={separator_style}></div>
                <div style={thumb_style}>
                  <a className="custom_link" onClick={this.thumbs_down}
                    href="#">
                    <img src="img/ic_thumbs_down.svg"/>
                  </a>
                </div>
                <div style={separator_style}></div>
                <div>
                  <Button bsSize="small" bsStyle="link"
                    onClick={this.dismiss}>Dismiss</Button>
                </div>
              </Col>
            </Col>;
    }
}

class MessageList extends React.Component {
    constructor(props){
        super(props);
        this.state = {
            messages: [{message: `Are you using concurrent (parallel)
                connections?`, id: 'concurrent_connections'}]
                .filter(m=>!window.localStorage.getItem(m.id)),
        };
    }
    thumbs_up = msg=>{
        this.hide(msg);
        ga_event('message', msg.id, 'thumbs_up');
    };
    thumbs_down = msg=>{
        this.hide(msg);
        ga_event('message', msg.id, 'thumbs_down');
    };
    dismiss = msg=>{
        this.hide(msg);
        ga_event('message', msg.id, 'dismiss');
    };
    hide = etask._fn(function*(_this, msg){
        _this.setState({show_thank_you: true});
        window.localStorage.setItem(msg.id, JSON.stringify(msg));
        yield etask.sleep(2000);
        _this.setState({messages: _this.state.messages.filter(m=>m!=msg),
            show_thank_you: false});
    });
    render(){
        return <Col md={12} className="messages">
              {this.state.messages.map(m=>
                <Message msg={m} key={m.id} on_thumbs_up={this.thumbs_up}
                  on_thumbs_down={this.thumbs_down}
                  on_dismiss={this.dismiss} />)}
              <Dialog title="Thank you!" show={this.state.show_thank_you}>
                Thank you!
              </Dialog>
            </Col>;
    }
}

export default E;
