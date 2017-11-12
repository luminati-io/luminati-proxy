// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true, es6:true*/
import React from 'react';
import $ from 'jquery';

class AddProxy extends React.Component {
    render(){
        return (
            <div className="lpm">
              <Modal id="add_proxy_modal" title="Add new proxy">
                <div className="section">
                  <div className="icon zone_icon"/>
                  <h4>Choose Zone</h4>
                  <select>
                    <option value="1">Default (static)</option>
                    <option value="2">gen</option>
                    <option value="3">this is example</option>
                    <option value="4">residential</option>
                  </select>
                </div>
                <div className="section">
                  <div className="icon preset_icon"/>
                  <h4>Select preset configuration</h4>
                  <select>
                    <option value="1">Long session (keep session alive)
                      </option>
                    <option value="2">this is example</option>
                  </select>
                  <div className="preview">
                    <div className="header">
                      Long session – keep session alive
                    </div>
                    <div className="desc">
                      Lorem ipsum dolor sit amet, consectetur adipisicing
                      elit, sed do eiusmod tempor incididunt ut labore et
                      dolore magna aliqua. Ut enim ad minim veniam,
                      quis nostrud exercitation ullamco laboris nisi ut
                      aliquip ex ea commodo consequat. Duis aute irure dolor
                      in reprehenderit in voluptate velit esse cillum dolore
                      eu fugiat nulla pariatur. Excepteur sint occaecat
                      cupidatat non proident, sunt in
                    </div>
                    <ul>
                      <li>Rule 1</li>
                      <li>Rule 2</li>
                      <li>Rule 3</li>
                    </ul>
                  </div>
                </div>
              </Modal>
            </div>
        );
    }
}

const If = ({when, children})=>when ? children : null;

// XXX krzysztof: make modal a common component and share with
// pkg/www/lum/pub/zone.js
class Modal extends React.Component {
    click_btn(){
        if (this.props.click_btn())
            document.getElementById(this.props.id).modal('hide');
    }
    render(){
        return (
            <div id={this.props.id} className="modal fade add_proxy_modal"
              tabIndex="-1">
              <div className="modal-dialog">
                <div className="modal-content">
                  <div className="modal-header">
                    <button className="close close_icon" data-dismiss="modal"
                        aria-label="Close">
                    </button>
                    <h4 className="modal-title">{this.props.title}</h4>
                  </div>
                  <div className="modal-body">{this.props.children}</div>
                  <div className="modal-footer">
                    <button className="btn btn_lpm_default btn_lpm options">
                      Advanced options</button>
                    <button className="btn btn_lpm save">
                      Save</button>
                  </div>
                </div>
              </div>
            </div>
        );
    }
}

export default AddProxy;
