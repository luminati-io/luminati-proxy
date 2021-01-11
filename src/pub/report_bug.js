// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true, es6:true*/
import etask from '../../util/etask.js';
import React from 'react';
import {Loader} from './common.js';
import {get_last_versions, get_changes_tooltip} from './util.js';
import Pure_component from '/www/util/pub/pure_component.js';
import $ from 'jquery';
import Tooltip from './common/tooltip.js';
import {Modal} from './common/modals.js';
import {T} from './common/i18n.js';
import './css/report_bug.less';

class Index extends Pure_component {
    success_msg = `Your issue is being handled! We will be in touch as soon as
        possible.`;
    state = {desc: '', email: '', sending: false, no_upgrade: false};
    componentDidMount(){
        this.setdb_on('head.version', version=>this.setState({version}));
        this.setdb_on('head.ver_last', ver_last=>this.setState({ver_last}));
    }
    desc_changed = e=>this.setState({desc: e.target.value});
    email_changed = e=>this.setState({email: e.target.value});
    click_cancel = ()=>this.setState({desc: '', no_upgrade: false});
    click_no_upgrade = ()=>this.setState({no_upgrade: true});
    click_upgrade = ()=>$('#upgrade_modal').modal();
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
        const {no_upgrade, ver_last, version, email, desc} = this.state;
        let click_ok, click_cancel, content, ok_btn_title, cancel_btn_title,
            cancel_no_close;
        if (!no_upgrade && ver_last && ver_last.newer)
        {
            click_ok = this.click_upgrade;
            click_cancel = this.click_no_upgrade;
            ok_btn_title = 'Upgrade';
            cancel_btn_title = 'Report bug anyway';
            content = <Ask_upgrade version={version} ver_last={ver_last}/>;
            cancel_no_close = true;
        }
        else
        {
            click_ok = this.click_report;
            click_cancel = this.click_cancel;
            ok_btn_title = 'Report';
            cancel_btn_title = 'Cancel';
            content = <Report_bug desc={desc} desc_changed={this.desc_changed}
              email={email} email_changed={this.email_changed}/>;
            cancel_no_close = false;
        }
        return <div className="report_bug">
              <Loader show={this.state.sending}/>
              <Modal title="Report a bug" id="report_bug_modal"
                ok_btn_title={ok_btn_title} click_ok={click_ok}
                cancel_clicked={click_cancel} cancel_no_close={cancel_no_close}
                cancel_btn_title={cancel_btn_title}>
                {content}
              </Modal>
              <Finish_modal msg={this.state.modal_msg}/>
            </div>;
    }
}

const Ask_upgrade = props=>{
    const {versions, changes} = get_last_versions(props.version,
        props.ver_last);
    const tooltip = get_changes_tooltip(changes);
    return <Tooltip title={tooltip} placement="bottom">
          <div className="desc">
            <T>We keep improving the Proxy Manager. You are</T>{' '}
            <strong>{versions.length}</strong>{' '}
            <T>releases behind the newest version and it is possible that your
              issues has been already fixed.</T>
          </div>
        </Tooltip>;
};

const Report_bug = props=>{
    return <React.Fragment>
          <div className="desc"><T>Briefly describe your issue below and
            our support engineer will contact you shortly</T>:</div>
          <textarea placeholder="Describe your issue here"
            style={{width: '100%'}} value={props.desc}
            onChange={props.desc_changed}/>
          <div className="email_field">
            <span><T>Contact in the following address</T></span>
            <input type="email" value={props.email}
              onChange={props.email_changed}/>
          </div>
        </React.Fragment>;
};

const Finish_modal = props=>
    <Modal title="Your report has been sent" id="finish_modal" no_cancel_btn>
      <h4>{props.msg}</h4>
    </Modal>;

export default Index;
