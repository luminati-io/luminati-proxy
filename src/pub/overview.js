// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true, es6:true*/
import React from 'react';
import Proxies from './proxies.js';
import Recent_stats from './stats/stats.js';
import Logs from './logs';
import Pure_component from '../../www/util/pub/pure_component.js';
import {If} from '/www/util/pub/react.js';
import {is_electron} from './common.js';
import zurl from 'hutil/util/url';
import $ from 'jquery';

class Overview extends Pure_component {
    constructor(props){
        super(props);
        this.state = {};
    }
    componentWillMount(){
        this.setdb_on('head.section', section=>{
            if (!section)
                return;
            const update = {section};
            if (section.name=='overview_multiplied')
            {
                update.master_port = window.location.pathname.split('/')
                .slice(-1)[0];
            }
            this.setState(update);
        });
    }
    render(){
        const title = this.state.master_port ?
            `Overview of multiplied port - ${this.state.master_port}` :
            'Overview';
        return (
            <div className="overview lpm">
              <Upgrade/>
              <div className="proxies nav_header">
                <h3>{title}</h3>
              </div>
              <div className="panels">
                <div className="proxies proxies_wrapper">
                  <Proxies master_port={this.state.master_port}/>
                </div>
                <div className="stats_wrapper">
                  <Recent_stats master_port={this.state.master_port}/>
                </div>
              </div>
              <div className="logs_wrapper">
                <Logs master_port={this.state.master_port}/>
              </div>
            </div>
        );
    }
}

class Upgrade extends Pure_component {
    constructor(props){
        super(props);
        this.state = {};
    }
    componentWillMount(){
        this.setdb_on('head.ver_last', ver_last=>this.setState({ver_last}));
        this.setdb_on('head.ver_node', ver_node=>this.setState({ver_node}));
        this.setdb_on('head.upgrading', upgrading=>this.setState({upgrading}));
        this.setdb_on('head.upgrade_error', upgrade_error=>
            this.setState({upgrade_error}));
    }
    upgrade(){ $('#upgrade_modal').modal(); }
    render(){
        const {upgrading, upgrade_error, ver_last, ver_node} = this.state;
        const is_upgradable = ver_last&&ver_last.newer;
        const electron = ver_node&&ver_node.is_electron||is_electron;
        if (!is_upgradable||!ver_node)
            return null;
        const disabled = upgrading||upgrade_error||!ver_node.satisfied&&
            !electron;
        return (
            <div className="warning warning_upgrade">
              <div className="warning_icon"/>
              <div>
                A new version <strong>{this.state.ver_last.version} </strong>
                is available.
              </div>
              <div className="buttons buttons_upgrade">
                <button className="btn btn_lpm btn_upgrade"
                  onClick={this.upgrade.bind(this)} disabled={disabled}>
                  {upgrading ? 'Upgrading...' :
                      (upgrade_error ? 'Error' : 'Upgrade')}
                </button>
              </div>
              <If when={ver_node&&!ver_node.satisfied&&!electron}>
                <div>
                  To upgrade Luminati Proxy Manager, you need to update Node.js
                  to version {this.state.ver_node.recommended}.
                </div>
              </If>
            </div>
        );
    }
}

export default Overview;
