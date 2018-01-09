// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true, es6:true*/
import React from 'react';
import util from './util.js';
import {Modal} from './common.js';
import $ from 'jquery';

const ga_event = util.ga_event;

const lets_go_clicked = ()=>{
    ga_event('lpm-onboarding', '03 intro page next');
    $('#welcome_modal').modal('hide');
};

const Welcome_modal = ()=>(
    <div className="lpm welcome">
      <Modal id="welcome_modal" title="Welcome to Luminati Proxy Manager"
        no_footer>
        <div className="welcome_panel">
          <div className="sub_header">
            <h4>
              Create multiple proxy ports, each with its own unique
              configuration, for maximum performance and greater scalability
            </h4>
          </div>
          <div className="img_welcome"></div>
          <button className="btn btn-primary btn_lpm btn_lpm_big btn_lets_go"
            onClick={lets_go_clicked}>{"Let's go"}</button>
        </div>
      </Modal>
    </div>
);

export default Welcome_modal;
