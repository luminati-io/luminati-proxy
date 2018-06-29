// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true, es6:true*/
import React from 'react';
import ReactDOM from 'react-dom';
import {Modal, Tooltip} from './common.js';
import $ from 'jquery';
import {ga_event} from './util.js';
import Pure_component from '../../www/util/pub/pure_component.js';
import classnames from 'classnames';

class Notif_center extends Pure_component {
    constructor(props){
        super(props);
        this.state = {loaded: false, notifs: []};
    }
    componentWillMount(){
        this.setdb_on('head.version', ver=>this.setState({ver}));
        this.setdb_on('head.consts', consts=>{
            if (!consts||!consts.notifs)
                return;
            const notifs = consts.notifs.filter(
                n=>!n.version||this.state.ver>=n.version);
            this.setState({notifs, loaded: true});
        });
    }
    componentDidMount(){
        const _this = this;
        $('#notif_modal').on('hidden.bs.modal', ()=>{
            _this.mark_read_local(); });
    }
    mark_read_local(){
        const all_read = this.state.notifs.map(n=>{
            if (n.status=='new')
                n.status = 'read';
            return n;
        });
        this.setState({notifs: all_read});
    }
    mark_read(){
        const _this = this;
        this.etask(function*(){
            const updated = _this.state.notifs.filter(n=>n.status=='new')
            .map(u=>({id: u._id, status: 'read'}));
            // XXX krzysztof: switch fetch->ajax
            yield window.fetch('/api/update_notifs', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({notifs: updated}),
            });
        });
    }
    open(){
        if (this.state.loaded)
        {
            ga_event('notif-center', 'open');
            this.mark_read();
            $('#notif_modal').modal();
        }
    }
    message_clicked(message){
        ga_event('notif-center', 'notif-clicked', message.title);
        this.etask(function*(){
            // XXX krzysztof: switch fetch->ajax
            yield window.fetch('/api/update_notifs', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(
                    {notifs: [{id: message._id, status: 'clicked'}]}),
            });
        });
        if (message.code)
        {
            $('#notif_modal').modal('hide');
            setTimeout(()=>eval(message.code), 500);
        }
    }
    render(){
        const number = this.state.notifs.filter(n=>n.status=='new').length;
        const tip = 'Notification center: you will receive updates on new'
        +' features in LPM here';
        return <div className="notif">
              <Modal_portal>
                <div className="notif_modal">
                  <Modal id="notif_modal" title="Messages:"
                    no_cancel_btn>
                    <div className="notifs">
                      {!this.state.notifs.length && <No_messages/>}
                      {this.state.notifs.length &&
                        <Messages notifs={this.state.notifs}
                          on_click={this.message_clicked.bind(this)}/>
                      }
                    </div>
                  </Modal>
                </div>
              </Modal_portal>
              <Tooltip title={tip} placement="bottom">
                <div onClick={this.open.bind(this)} className="icon">
                  <Circle_icon number={number}/>
                </div>
              </Tooltip>
            </div>;
    }
}

const Circle_icon = ({number})=>{
    if (!number)
        return null;
    return <div className="circle_wrapper">
          <div className="circle">{number}</div>
        </div>;
};

const No_new_messages = ()=>
    <h4 className="no_messages">You have no new messages.</h4>;

const No_messages = ()=>
    <h4 className="no_messages">You don't have any messages yet.</h4>;

const Messages = ({notifs, on_click})=>{
    const new_messages = notifs.filter(n=>n.status=='new').length;
    return <div>
          {!new_messages && <No_new_messages/>}
          {notifs.map(m=>
            <Message on_click={()=>on_click(m)} clickable={!!m.code}
              key={m.msg_id} {...m}/>
          )}
        </div>;
};

const Message = ({title, message, status, clickable, on_click})=>{
    const classes = classnames('message', {unread: status=='new', clickable});
    if (status=='new')
        title = 'NEW! '+title;
    return <div onClick={on_click} className={classes}>
          <div className="subject">{title}</div>
          <div className="text">{message}</div>
        </div>;
};

class Modal_portal extends Pure_component {
    render(){
        return ReactDOM.createPortal(this.props.children,
            document.getElementById('notif_react_modal'));
    }
}

export default Notif_center;
