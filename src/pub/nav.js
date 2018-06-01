// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true, es6:true*/
import Pure_component from '../../www/util/pub/pure_component.js';
import React from 'react';
import ajax from 'hutil/util/ajax';
import etask from 'hutil/util/etask';
import setdb from 'hutil/util/setdb';
import classnames from 'classnames';
import {Tooltip, Modal} from './common.js';
import Schema from './schema.js';
import Notif from './notif_center.js';
import Report_bug_modal from './report_bug.js';
import $ from 'jquery';
import {If} from '/www/util/pub/react.js';
import {Route, withRouter, Link} from 'react-router-dom';

const Nav = ()=>(
    <div className="nav">
      <Nav_top/>
      <Nav_left/>
      <Report_bug_modal/>
      <Upgrade_modal/>
      <Shutdown_modal/>
      <Old_modals/>
    </div>
);

const Old_modals = ()=>(
    <div>
      <div id="restarting" className="modal fade" role="dialog">
        <div className="modal-dialog">
          <div className="modal-content">
            <div className="modal-header">
              <h4 className="modal-title">Restarting...</h4>
            </div>
            <div className="modal-body">
              Please wait. The page will be reloaded automatically
              once the application has restarted.
            </div>
            <div className="modal-footer"/>
          </div>
        </div>
      </div>
      <div id="upgrading" className="modal fade" role="dialog">
        <div className="modal-dialog">
          <div className="modal-content">
            <div className="modal-header">
              <h4 className="modal-title">
                Luminati Proxy Manager is upgrading</h4>
            </div>
            <div className="modal-body">
              Please wait...
            </div>
            <div className="modal-footer"/>
          </div>
        </div>
      </div>
      <div id="shutdown" className="modal fade" role="dialog">
        <div className="modal-dialog">
          <div className="modal-content">
            <div className="modal-header">
              <h4 className="modal-title">Shutdown</h4>
            </div>
            <div className="modal-body">
              The application has been shut down. To restart,
              please run it manually and reload this page.
            </div>
            <div className="modal-footer"/>
          </div>
        </div>
      </div>
    </div>
);

const Nav_left = withRouter(class Nav_left extends Pure_component {
    state = {};
    componentDidMount(){
        this.setdb_on('feature.tracer', tracer=>{
            this.setState({tracer});
        });
    }
    render(){
        return (
            <div className="nav_left">
              <div className="menu">
                <Nav_link to="/overview" name="overview" label="Overview"/>
                <Nav_link to="/howto" name="howto" label="Instructions"/>
                <Nav_link to="/proxy_tester" name="proxy_tester"
                  label="Proxy tester"/>
                {this.state.tracer &&
                  <Nav_link to="/tracer" name="tracer"
                    label="Test affiliate links"/>
                }
                <Nav_link to="/logs" name="logs" label="Logs"/>
                <Nav_link to="/settings" name="general_config"
                  label="General settings"/>
                <Nav_link to="/config" name="config"
                  label="Manual configuration"/>
              </div>
              <div className="menu_filler"/>
              <Footer/>
            </div>
        );
    }
});

const Nav_link = ({label, to, name})=>(
    <Route path={to} exact>
      {({match})=>
        <Nav_link_inner label={label} to={to} name={name} match={match}/>}
    </Route>

);

const Nav_link_inner = ({label, to, name, match})=>(
    <Link to={to}>
      <div className={classnames('menu_item', {active: match})}>
        <Tooltip title={label} placement="right">
          <div className={classnames('icon', name)}/>
        </Tooltip>
      </div>
    </Link>
);

class Nav_top extends Pure_component {
    constructor(props){
        super(props);
        this.state = {ver: ''};
    }
    componentWillMount(){
        this.setdb_on('head.version', ver=>this.setState({ver})); }
    render(){
        const tooltip = 'Luminati Proxy Manager V'+this.state.ver;
        return (
            <div className="nav_top">
              <Tooltip title={tooltip} placement="right">
                <div><Logo/></div>
              </Tooltip>
              <Nav_right/>
            </div>
        );
    }
}

const Footer = ()=>(
    <div className="footer">
      <div>
        <a href="http://luminati.io/faq#proxy"
          rel="noopener noreferrer" target="_blank"
          className="link">
          FAQ
        </a>
      </div>
      <div>
        <a href="mailto:lpm@luminati.io" className="link">
          Contact</a>
      </div>
      <div>
        <a href="http://petstore.swagger.io/?url=https://raw.githubusercontent.com/luminati-io/luminati-proxy/master/lib/swagger.json#/Proxy"
          className="link">
          API
        </a>
      </div>
    </div>
);

const Logo = withRouter(()=><Link to="/overview" className="logo"/>);

const Nav_right = ()=>(
    <div className="nav_top_right">
      <div className="schema"><Schema/></div>
      <div className="notif_icon"><Notif/></div>
      <Dropdown/>
    </div>
);

const show_reload = function(){
    $('#restarting').modal({
        backdrop: 'static',
        keyboard: false,
    });
};

class Upgrade_modal extends Pure_component {
    confirm(){
        window.setTimeout(()=>$('#upgrading').modal(), 500);
        this.etask(function*(){
            this.on('uncaught', e=>{
                $('#upgrading').modal('hide');
                setdb.set('head.upgrade_error', e.message);
                setdb.set('head.upgrading', false);
            });
            setdb.set('head.upgrading', true);
            yield ajax({url: '/api/upgrade', method: 'POST', timeout: 600000});
            yield ajax({url: '/api/restart', method: 'POST'});
            $('#upgrading').modal('hide');
            show_reload();
            setdb.set('head.upgrading', false);
            setTimeout(function _check_reload(){
                const retry_cb = ()=>{ setTimeout(_check_reload, 500); };
                etask(function*(){
                    this.on('uncaught', e=>retry_cb());
                    yield ajax({url: '/overview'});
                    window.location = '/';
                });
            }, 3000);
        });
    }
    render(){
        return (
            <Modal id="upgrade_modal"
              click_ok={this.confirm.bind(this)}
              title="The application will be upgraded and restarted"/>
        );
    }
}

class Shutdown_modal extends Pure_component {
    confirm(){
        this.etask(function*(){
            yield ajax({url: '/api/shutdown', method: 'POST'});
            window.setTimeout(()=>{
                $('#shutdown').modal({
                    backdrop: 'static',
                    keyboard: false,
                });
            }, 400);
        });
    }
    render(){
        return (
            <Modal id="shutdown_modal"
              click_ok={this.confirm.bind(this)}
              title="Are you sure you want to shut down the local proxies?"/>
        );
    }
}

const Dropdown = withRouter(class Dropdown extends Pure_component {
    constructor(props){
        super(props);
        this.state = {};
    }
    componentWillMount(){
        this.setdb_on('head.settings', settings=>this.setState({settings}));
        this.setdb_on('head.ver_last', ver_last=>this.setState({ver_last}));
    }
    open_report_bug(){ $('#report_bug_modal').modal(); }
    upgrade(){ $('#upgrade_modal').modal(); }
    shutdown(){ $('#shutdown_modal').modal(); }
    logout(){
        const _this = this;
        this.etask(function*(){
            yield ajax({url: '/api/logout', method: 'POST'});
            _this.props.history.push('/login');
        });
    }
    render(){
        if (!this.state.settings)
            return null;
        const is_upgradable = this.state.ver_last&&this.state.ver_last.newer;
        return (
            <div className="dropdown">
              <a className="link dropdown-toggle"
                data-toggle="dropdown">
                {this.state.settings.customer}
                <span className="caret"/>
              </a>
              <ul className="dropdown-menu dropdown-menu-right">
                <If when={is_upgradable}>
                  <li>
                    <a onClick={this.upgrade.bind(this)}>Upgrade</a>
                  </li>
                </If>
                <li>
                  <a onClick={this.open_report_bug.bind(this)}>
                    Report a bug</a>
                </li>
                <li>
                  <a onClick={this.logout.bind(this)}>Log out</a>
                </li>
                <li>
                  <a onClick={this.shutdown.bind(this)}>Shut down</a>
                </li>
              </ul>
            </div>
        );
    }
});

export default Nav;
