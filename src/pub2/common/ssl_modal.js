// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true*/
import React from 'react';
import Pure_component from '/www/util/pub/pure_component.js';
import {Loader, with_www_api} from '../common.js';
import {report_exception} from '../util.js';
import {main as Api} from '../api.js';
import {Modal} from './modals.js';

export default with_www_api(class Enable_ssl_modal extends Pure_component {
    state = {loading: false};
    enable_ssl = ()=>{
        const _this = this;
        this.etask(function*(){
            this.on('uncaught', e=>_this.etask(function*(){
                yield report_exception(e,
                    'ssl_modal.Enable_ssl_modal.enable_ssl');
            }));
            _this.setState({loading: true});
            yield Api.post('enable_ssl');
            _this.setState({loading: false});
        });
    };
    render(){
        return <React.Fragment>
            <Loader show={this.state.loading}/>
            <Modal id={this.props.id||'enable_ssl_modal'}
              title="Enable SSL analyzing for all proxies" no_cancel_btn
              no_ok_close click_ok={this.enable_ssl}
              ok_btn_title='Enable SSL analyzing' className="enable_ssl_modal">
            </Modal>
        </React.Fragment>;
    }
});
