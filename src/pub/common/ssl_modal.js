// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true*/
import React from 'react';
import Pure_component from '/www/util/pub/pure_component.js';
import ajax from '../../../util/ajax.js';
import {Instructions, Li} from './bullets.js';
import {Loader} from '../common.js';
import {Modal} from './modals.js';

export default class Enable_ssl_modal extends Pure_component {
    state = {loading: false};
    faq_cert_url = 'https://luminati.io/faq#proxy-certificate';
    enable_ssl = ()=>{
        const _this = this;
        this.etask(function*(){
            this.on('uncaught', e=>console.log(e));
            _this.setState({loading: true});
            yield ajax({url: '/api/enable_ssl', method: 'POST'});
            _this.setState({loading: false});
        });
    };
    render(){
        return <React.Fragment>
            <Loader show={this.state.loading}/>
            <Modal id={this.props.id||'enable_ssl_modal'}
              title="Enable SSL analyzing for all proxies" no_cancel_btn
              no_ok_close click_ok={this.enable_ssl} ok_href="/ssl"
              ok_btn_title='Download certificate' className="enable_ssl_modal">
              <p className="cert_info">
                You will also need to add a certificate file to browsers.
                Gathering stats for HTTPS requests requires setting a
                certificate key.
              </p>
              <Instructions>
                <Li>Download our free certificate key
                  <a href="/ssl" target="_blank" download> here</a>
                </Li>
                <Li>
                  Add the certificate to your browser.
                  You can find more detailed
                  instructions <a className="link" href={this.faq_cert_url}
                    rel="noopener noreferrer" target="_blank">here</a>
                </Li>
                <Li>Refresh the page</Li>
              </Instructions>
            </Modal>
        </React.Fragment>;
    }
}
