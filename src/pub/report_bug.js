// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true, es6:true*/
import etask from '../../util/etask.js';
import React from 'react';
import {Loader} from './common.js';
import Pure_component from '/www/util/pub/pure_component.js';
import $ from 'jquery';
import {Modal} from './common/modals.js';
import './css/report_bug.less';

class Index extends Pure_component {
    success_msg = `Your issue is being handled! We will be in touch as soon as
        possible.`;
    state = {desc: '', email: '', sending: false};
    componentDidMount(){
        this.setdb_on('head.consts', consts=>{
            if (consts && consts.logins && consts.logins.length==1)
                this.setState({email: consts.logins[0]});
        });
    }
    desc_changed = e=>this.setState({desc: e.target.value});
    email_changed = e=>this.setState({email: e.target.value});
    click_cancel = ()=>this.setState({desc: ''});
    click_report = ()=>{
        const desc = this.state.desc;
        const _this = this;
        return etask(function*(){
            this.on('uncaught', ()=>{ _this.setState({sending: false}); });
            _this.setState({sending: true});
            const resp = yield window.fetch('/api/report_bug', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({desc, email: _this.state.email}),
            });
            _this.setState({sending: false});
            if (resp.status==200)
                _this.setState({modal_msg: _this.success_msg});
            else
            {
                const resp_json = yield resp.json();
                const modal_msg = `Something went wrong: [${resp_json}]`;
                _this.setState({modal_msg});
            }
            window.setTimeout(()=>$('#finish_modal').modal(), 500);
        });
    };
    render(){
        return <div className="report_bug">
              <Loader show={this.state.sending}/>
              <Modal title="Report a bug" id="report_bug_modal"
                ok_btn_title="Report"
                click_ok={this.click_report}
                cancel_clicked={this.click_cancel}>
                <div className="desc">Briefly describe your issue below and
                  our support engineer will contact you shortly:</div>
                <textarea placeholder="Describe your issue here"
                  style={{width: '100%'}} value={this.state.desc}
                  onChange={this.desc_changed}/>
                <div className="email_field">
                  <span>Contact in the following address</span>
                  <input type="email" value={this.state.email}
                    onChange={this.email_changed}/>
                </div>
              </Modal>
              <Finish_modal msg={this.state.modal_msg}/>
            </div>;
    }
}

const Finish_modal = props=>
    <Modal title="Your report has been sent" id="finish_modal" no_cancel_btn>
      <h4>{props.msg}</h4>
    </Modal>;

export default Index;
