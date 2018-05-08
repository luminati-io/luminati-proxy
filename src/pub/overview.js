// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true, es6:true*/
import React from 'react';
import Proxies from './proxies.js';
import ajax from 'hutil/util/ajax';
import setdb from 'hutil/util/setdb';
import Stats from './stats.js';
import Har_viewer from './har_viewer';
import Pure_component from '../../www/util/pub/pure_component.js';
import {If} from '/www/util/pub/react.js';
import {is_electron} from './common.js';
import $ from 'jquery';

class Overview extends Pure_component {
    componentDidMount(){
        this.setdb_on('head.proxies_running', proxies=>
            this.setState({proxies}));
        this.setdb_on('head.consts', consts=>this.setState({consts}));
    }
    render(){
        const master_port = this.props.match.params.master_port;
        const title = master_port ?
            `Overview of multiplied proxy port - ${master_port}` : 'Overview';
        return (
            <div className="overview_page lpm">
              <Upgrade/>
              <div className="proxies nav_header">
                <h3>{title}</h3>
              </div>
              <div className="panels">
                <div className="proxies proxies_wrapper">
                  <Proxies master_port={master_port}/>
                </div>
                <div className="stats_wrapper">
                  <Stats master_port={master_port}/>
                </div>
              </div>
              <div className="logs_wrapper">
                <Har_viewer master_port={master_port}/>
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
