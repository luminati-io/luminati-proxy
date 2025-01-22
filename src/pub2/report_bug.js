// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true, es6:true*/
import React from 'react';
import $ from 'jquery';
import etask from '../../util/etask.js';
import {Loader} from './common.js';
import {main as Api} from './api.js';
import {get_last_versions, get_changes_tooltip} from './util.js';
import Pure_component from '/www/util/pub/pure_component.js';
import Tooltip from './common/tooltip.js';
import {Modal} from './common/modals.js';
import {T} from './common/i18n.js';
import './css/report_bug.less';

class Index extends Pure_component {
    success_msg = `Your issue is being handled! We will be in touch as soon as
        possible.`;
    state = {desc: '', email: this.props.username||'', sending: false,
        no_upgrade: false};
    componentDidMount(){
        this.setdb_on('head.version', version=>this.setState({version}));
        this.setdb_on('head.ver_last', ver_last=>this.setState({ver_last}));
    }
    desc_changed = e=>this.setState({desc: e.target.value});
    email_changed = e=>this.setState({email: e.target.value});
    click_cancel = ()=>this.setState({desc: '', no_upgrade: false});
    click_no_upgrade = ()=>this.setState({no_upgrade: true});
    click_upgrade = ()=>$('#upgrade_modal').modal('show');
    click_report = ()=>{
        const desc = this.state.desc;
        const _this = this;
        return etask(function*(){
            this.on('uncaught', e=>_this.setState({sending: false,
                modal_msg: `Something went wrong: [${resp||e.message}]`}));
            _this.setState({sending: true});
            const report = {desc, email: _this.state.email};
            const resp = yield Api.json.post('report_bug', report);
            _this.setState({sending: false, modal_msg: _this.success_msg});
            window.setTimeout(()=>$('#finish_modal').modal('show'), 500);
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
