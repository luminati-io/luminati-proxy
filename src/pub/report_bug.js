// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true, es6:true*/
import etask from '../../util/etask.js';
import ajax from '../../util/ajax.js';
import React from 'react';
import {Modal, Loader} from './common.js';
import Pure_component from '../../www/util/pub/pure_component.js';
import $ from 'jquery';

class Index extends Pure_component {
    state = {desc: '', email: '', sending: false};
    componentDidMount(){
        this.setdb_on('head.settings', settings=>{
            if (settings&&settings.email)
                this.setState({email: settings.email});
        });
    }
    desc_changed = e=>this.setState({desc: e.target.value});
    email_changed = e=>this.setState({email: e.target.value});
    click_cancel = ()=>this.setState({desc: ''});
    detect_browser = ()=>{
        let browser = 'unknown';
        if ((!!window.opr && !!window.opr.addons) || !!window.opera ||
            navigator.userAgent.indexOf(' OPR/')>=0)
        {
            browser = 'opera';
        }
        else if (typeof InstallTrigger!=='undefined')
            browser = 'firefox';
        else if (/*@cc_on!@*/false || !!document.documentMode)
            browser = 'IE';
        else if (!!window.StyleMedia)
            browser = 'Edge';
        else if (!!window.chrome && !!window.chrome.webstore)
            browser = 'chrome';
        return browser;
    };
    click_report = ()=>{
        const desc = this.state.desc;
        const _this = this;
        return etask(function*(){
            this.on('uncaught', ()=>{ _this.setState({sending: false}); });
            _this.setState({sending: true});
            // XXX krzysztof: switch fetch->ajax
            yield window.fetch('/api/report_bug', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({desc, email: _this.state.email,
                    browser: _this.detect_browser()}),
            });
            _this.setState({sending: false});
            window.setTimeout(()=>$('#thanks_modal').modal(), 500);
        });
    };
    render(){
        return (
            <div className="report_bug">
              <Loader show={this.state.sending}/>
              <Modal title="Report a bug" id="report_bug_modal"
                ok_btn_title="Report"
                click_ok={this.click_report}
                cancel_clicked={this.click_cancel}>
                <div className="desc">Briefly describe your issue below and
                  our support engineer will contact you shortly:</div>
                <textarea placeholder="Describe your issue here"
                  value={this.state.desc}
                  onChange={this.desc_changed}/>
                <div className="email_field">
                  <span>Contact in the following address</span>
                  <input type="email" value={this.state.email}
                    onChange={this.email_changed}/>
                </div>
              </Modal>
              <Thanks_modal/>
            </div>
        );
    }
}

const Thanks_modal = ()=>
    <Modal title="Report has been sent" id="thanks_modal" no_cancel_btn>
      <h4>You issue in being handled! We will be in touch as soon
        as possible.</h4>
    </Modal>;

export default Index;
