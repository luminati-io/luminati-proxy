// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true, es6:true*/
import React from 'react';
import Proxies from './proxies.js';
import Stats from './stats.js';
import Har_viewer from './har_viewer';
import Pure_component from '/www/util/pub/pure_component.js';
import $ from 'jquery';
import semver from 'semver';
import {T} from './common/i18n.js';
import {Warning, Warnings, with_www_api, Loader_small} from './common.js';
import {perr} from './util.js';
import Tooltip from './common/tooltip.js';
import setdb from '../../util/setdb.js';
import './css/overview.less';

class Overview extends Pure_component {
    state = {show_logs: null, tls_warning: false};
    componentDidMount(){
        this.setdb_on('head.settings', settings=>settings &&
            this.setState({show_logs: settings.logs>0}));
        this.setdb_on('ws.tls_warning', tls_warning=>tls_warning!==undefined &&
            this.setState({tls_warning}));
        this.setdb_on('head.save_settings', save_settings=>
            this.save_settings = save_settings);
    }
    toggle_logs = val=>{
        const _this = this;
        this.setState({show_logs: null});
        this.etask(function*(){
            const settings = Object.assign({}, setdb.get('head.settings'));
            settings.logs = val;
            yield _this.save_settings(settings);
        });
    };
    render(){
        const {show_logs} = this.state;
        const master_port = this.props.match.params.master_port;
        const panels_style = {maxHeight: show_logs ? '50vh' : undefined};
        const title = master_port ?
            <span>
              <T>Overview of multiplied proxy port</T> - {master_port}
            </span> : <T>Overview</T>;
        return <div className="overview_page">
              <div className="warnings">
                <Upgrade/>
                <Upgrade_warning/>
                <Tls_warning show={this.state.tls_warning}/>
                <Warnings warnings={this.state.warnings}/>
              </div>
              <div className="proxies nav_header">
                <h3>{title}</h3>
              </div>
              <div className="panels" style={panels_style}>
                <div className="proxies proxies_wrapper">
                  <Proxies master_port={master_port}/>
                </div>
                <Stats/>
              </div>
              {show_logs===null &&
                <Loader_small show loading_msg="Loading..."/>}
              {show_logs &&
                <div className="logs_wrapper">
                  <Har_viewer master_port={master_port}/>
                </div>}
              {show_logs===false &&
                <Logs_off_btn turn_on={()=>this.toggle_logs(1000)}/>}
            </div>;
    }
}

const Logs_off_btn = props=>
  <Tooltip title="Logs are disabled. Click here to turn it on again">
    <button className="enable_btn enable_btn_logs" onClick={props.turn_on}>
      <i className="glyphicon glyphicon-chevron-up"/>
    </button>
  </Tooltip>;

const Tls_warning = with_www_api(props=>{
    const faq_url = props.www_api+'/faq#proxy-certificate';
    if (!props.show)
        return null;
    return <Warning id="tls_warning">
          <span>
            <strong>TLS errors have been detected. </strong>
            <span>
              Your browser or crawler has to install the certificate. </span>
            <a target="_blank" rel="noopener noreferrer" className="link"
              onClick={()=>perr('tls.check_instructions')} href={faq_url}>
              Check the instructions.
            </a>
          </span>
        </Warning>;
});

class Upgrade extends Pure_component {
    state = {};
    componentDidMount(){
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
        if (!ver_cur || !this.state.ver_last)
            return [];
        const changelog = this.state.ver_last.versions
            .filter(v=>semver.lt(ver_cur, v.ver));
        return changelog;
    };
    render(){
        const {upgrading, upgrade_error, ver_last, ver_node} = this.state;
        if (!ver_last)
            return null;
        const is_upgradable = ver_last && ver_last.newer;
        const is_electron = window.process && window.process.versions.electron;
        const electron = ver_node && ver_node.is_electron || is_electron;
        if (!is_upgradable || !ver_node)
            return null;
        const disabled = upgrading || upgrade_error || !ver_node.satisfied &&
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
        return <Warning tooltip={tooltip} id={this.state.ver_last.version}>
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
            {ver_node && !ver_node.satisfied && !electron &&
              <div>
                To upgrade Luminati Proxy Manager, you need to update Node.js
                to version {this.state.ver_node.recommended}.
              </div>
            }
        </Warning>;
    }
}

class Upgrade_warning extends Pure_component {
    state = {is_upgraded: false};
    componentDidMount(){
        this.setdb_on('head.version', ver=>this.setState({ver}));
        this.setdb_on('head.is_upgraded', is_upgraded=>
            this.setState({is_upgraded}));
    }
    on_click(){
        $('#downgrade_modal').modal();
    }
    render(){
        const {is_upgraded, ver} = this.state;
        if (!is_upgraded||!ver)
            return null;
        return <Warning id={'upgrade_alert'+ver}>
              <span>
                <strong><T>LPM was upgraded in the background. </T></strong>
                <T>Click here to </T>
                <a className="link"
                  onClick={this.on_click.bind(this)}><T>downgrade.</T></a>
              </span>
            </Warning>;
    }
}

export default Overview;
