// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true, es6:true*/
import React from 'react';
import setdb from 'hutil/util/setdb';
import util from './util.js';

const ga_event = util.ga_event;

const lets_go_clicked = ()=>{
    ga_event('lpm-onboarding', '03 intro page next');
    const state = setdb.get('head.callbacks.state');
    state.go('setup_guide');
};

const Welcome = ()=>(
    <div className="lpm welcome">
      <div className="welcome_panel">
        <div className="header">
          <h1>Welcome to Luminati Proxy Manager</h1>
        </div>
        <h2 className="sub_header">How it works</h2>
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
    </div>
);

export default Welcome;
