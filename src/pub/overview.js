// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true, es6:true*/
import React from 'react';
import Proxies from './proxies.js';
import Stats from './stats.js';
import Har_viewer from './har_viewer';
import Pure_component from '../../www/util/pub/pure_component.js';
import $ from 'jquery';
import semver from 'semver';
import {Tooltip} from './common.js';

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
        return <div className="overview_page">
              <div className="warnings">
                <Upgrade/>
              </div>
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
            </div>;
    }
}

class Upgrade extends Pure_component {
    state = {};
    componentWillMount(){
        this.setdb_on('head.version', version=>this.setState({version}));
        this.setdb_on('head.ver_last', ver_last=>this.setState({ver_last}));
        this.setdb_on('head.ver_node', ver_node=>this.setState({ver_node}));
        this.setdb_on('head.upgrading', upgrading=>this.setState({upgrading}));
        this.setdb_on('head.upgrade_error', upgrade_error=>
            this.setState({upgrade_error}));
    }
    upgrade = ()=>{ $('#upgrade_modal').modal(); };
    new_versions = ()=>{
        const ver_cur = this.state.version;
        if (!ver_cur)
            return [];
        const changelog = this.state.ver_last.versions
            .filter(v=>semver.lt(ver_cur, v.ver));
        return changelog;
    };
    render(){
        const {upgrading, upgrade_error, ver_last, ver_node} = this.state;
        const is_upgradable = ver_last&&ver_last.newer;
        const is_electron = window.process && window.process.versions.electron;
        const electron = ver_node&&ver_node.is_electron||is_electron;
        if (!is_upgradable||!ver_node)
            return null;
        const disabled = upgrading||upgrade_error||!ver_node.satisfied&&
            !electron;
        const versions = this.new_versions();
        const changes = versions.reduce((acc, ver)=>{
            return acc.concat(ver.changes);
        }, []);
        let tooltip = '';
        if (changes.length)
        {
            const list = changes.map(c=>`<li>${c.text}</li>`).join('\n');
            tooltip = `Changes: <ul>${list}</ul>`;
        }
        const major = versions.some(v=>v.type=='dev');
        const upgrade_type = major ? 'major' : 'minor';
        return <Tooltip className="wide" title={tooltip} placement="bottom">
            <div className="warning">
              <div className="warning_icon"/>
              <div>
                A new <strong>{upgrade_type}</strong> version <strong>
                {this.state.ver_last.version} </strong>
                is available. You are <strong>{versions.length}
                </strong> releases behind the newest version.
              </div>
              <div className="buttons buttons_upgrade">
                <button className="btn btn_lpm btn_upgrade"
                  onClick={this.upgrade} disabled={disabled}>
                  {upgrading ? 'Upgrading...' :
                      upgrade_error ? 'Error' : 'Upgrade'}
                </button>
              </div>
              {ver_node&&!ver_node.satisfied&&!electron&&
                <div>
                  To upgrade Luminati Proxy Manager, you need to update Node.js
                  to version {this.state.ver_node.recommended}.
                </div>
              }
            </div>
            </Tooltip>;
    }
}

export default Overview;
