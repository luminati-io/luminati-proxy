// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true*/
import React from 'react';
import Pure_component from '/www/util/pub/pure_component.js';
import $ from 'jquery';
import classnames from 'classnames';
import {Instructions, Li} from '/www/util/pub/bullets.js';
import etask from '../../../util/etask.js';
import {Loader, Labeled_controller} from '../common.js';
import {main as Api} from '../api.js';
import '../css/api_url_modal.less';
import {Modal_dialog} from './modals.js';

export default class Api_url_modal extends Pure_component {
    state = {url: '', saving: false};
    componentDidMount(){
        this.setdb_on('head.conn', conn=>{
            if (!conn)
                return;
            this.setState({conn});
        });
        this.setdb_on('head.settings', settings=>{
            if (!settings)
                return;
            this.setState({settings});
        });
    }
    click_ok = ()=>{
        const _this = this;
        this.etask(function*(){
            this.on('finally', ()=>{
                _this.setState({saving: false});
            });
            _this.setState({saving: true});
            let resp = yield Api.put('api_url', {url: _this.state.url});
            if (!resp.res)
                return _this.setState({error: true});
            $('#restarting').modal({backdrop: 'static', keyboard: false});
            yield _this.check_reload();
        });
    };
    check_reload(){
        const _this = this;
        const retry = ()=>{ setTimeout(_this.check_reload.bind(_this), 500); };
        return etask(function*(){
            this.on('uncaught', retry);
            yield Api.json.get('proxies_running');
            window.location.reload();
        });
    }
    url_changed = val=>this.setState({url: val.trim()});
    valid_url = ()=>{
        return !!this.state.url;
    };
    render(){
        if (!this.state.settings)
            return null;
        const open = this.state.conn && !this.state.conn.domain;
        const phone_link = 'https://zingaya.com/widget/680d22dda1bf4092ab04c1d'
            +'9a7062b0a';
        const mail_domain = this.state.settings.mail_domain;
        const mail_link = `mailto:support@${mail_domain}`;
        return <React.Fragment>
              <Loader show={this.state.saving}/>
              <Modal_dialog open={open}
                title="Cannot connect to Bright Data"
                ok_clicked={this.click_ok} ok_disabled={!this.valid_url()}
                no_cancel_btn>
                <div className="api_url_modal">
                <Instructions>
                  <Li>
                    Please contact Bright Data support to receive an
                    alternative domain
                    <Contact_btn href={phone_link} type="fas" id="phone">
                      +1-888-538-9204
                    </Contact_btn>
                    <Contact_btn href="//web.whatsapp.com" type="fab"
                      id="whatsapp-square">
                      +972-54-353-6332
                    </Contact_btn>
                    <Contact_btn href="//web.wechat.com" type="fab"
                      id="weixin">
                      brightdata
                    </Contact_btn>
                    <Contact_btn href={mail_link} type="fas" id="envelope">
                      support@{mail_domain}
                    </Contact_btn>
                    <Contact_btn href="http://w.qq.com" type="fab" id="qq">
                      3426730462
                    </Contact_btn>
                    <Contact_btn href="https://twitter.com/brightdata"
                      type="fab" id="twitter">
                      brightdata
                    </Contact_btn>
                    <Contact_btn href="" type="fas" id="home">
                      Head office
                    </Contact_btn>
                  </Li>
                  <Li>
                    <div>Paste the new domain inside the field below</div>
                    <Labeled_controller id="url" label="Alternative domain"
                      val={this.state.url} type="text"
                      placeholder="New domain url"
                      on_change_wrapper={this.url_changed}/>
                    {this.state.error && <span className="text-danger">
                      failed to connect, try another domain
                    </span>}
                  </Li>
                  <Li>
                    Click OK to save and wait till the Proxy Manager restarts
                  </Li>
                </Instructions>
                </div>
              </Modal_dialog>
            </React.Fragment>;
    }
}

const Contact_btn = props=>
    <a href={props.href} className="btn btn_lpm btn_support">
      <div className={classnames('icon', props.type, `fa-${props.id}`)}/>
      {props.children}
    </a>;
