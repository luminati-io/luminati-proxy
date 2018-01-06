// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true, es6:true*/
import regeneratorRuntime from 'regenerator-runtime';
import React from 'react';
import ReactDOM from 'react-dom';
import etask from 'hutil/util/etask';
import setdb from 'hutil/util/setdb';
import ajax from 'hutil/util/ajax';
import {Modal, If} from './common.js';
import $ from 'jquery';
import util from './util.js';

const ga_event = util.ga_event;

class Notif_center extends React.Component {
    constructor(props){
        super(props);
        this.state = {loaded: false, messages: []};
    }
    componentWillMount(){
        this.sp = etask('Notif', function*(){ yield this.wait(); });
        const _this = this;
        this.sp.spawn(etask(function*(){
            const www_lpm = yield ajax.json({url: 'api/www_lpm'});
            _this.setState({messages: www_lpm.messages, loaded: true});
        }));
    }
    componentWillUnmount(){ this.sp.return(); }
    open(){
        if (this.state.loaded)
        {
            ga_event('notif-center', 'open');
            $('#notif_modal').modal();
        }
    }
    render(){
        if (window.location.pathname=='/')
            return null;
        return (
            <div className="notif">
              <Modal_portal>
                <div className="lpm notif_modal">
                  <Modal id="notif_modal" title="Messages:"
                    no_cancel_btn>
                    <div className="messages">
                      {this.state.messages.map((m, idx)=>(
                        <Message key={idx} {...m}/>
                      ))}
                    </div>
                  </Modal>
                </div>
              </Modal_portal>
              <div onClick={this.open.bind(this)} className="icon">
                <If when={this.state.loaded}>
                  <div className="circle_wrapper">
                    <div className="circle">{this.state.messages.length}</div>
                  </div>
                </If>
              </div>
            </div>
        );
    }
}

const Message = ({subject, text})=>{
    const click = ()=>{ ga_event('notif-center', 'notif-clicked', subject); };
    return (
        <div onClick={click} className="message">
          <div className="subject">{subject}</div>
          <div className="text">{text}</div>
        </div>
    );
};


class Modal_portal extends React.Component {
    render(){
        return ReactDOM.createPortal(this.props.children,
            document.getElementById('notif_react_modal'));
    }
}

export default Notif_center;
