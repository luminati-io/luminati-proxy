// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true, es6:true*/
import Pure_component from '/www/util/pub/pure_component.js';
import {Route, withRouter, Link} from 'react-router-dom';
import React from 'react';
import $ from 'jquery';
import classnames from 'classnames';
import etask from '../../util/etask.js';
import ajax from '../../util/ajax.js';
import setdb from '../../util/setdb.js';
import {swagger_url} from './util.js';
import Schema from './schema.js';
import Notif from './notif_center.js';
import Report_bug_modal from './report_bug.js';
import Cpu_warning from './cpu_warning.js';
import Tooltip from './common/tooltip.js';
import {Modal} from './common/modals.js';
import {T} from './common/i18n.js';
import {Language} from './common/i18n.js';
import {with_www_api} from './common.js';
import './css/nav.less';

const Nav = ()=>
    <div className="nav">
      <Nav_top/>
      <Nav_left/>
      <Report_bug_modal/>
      <Upgrade_downgrade_modal action='upgrade'/>
      <Upgrade_downgrade_modal action='downgrade'/>
      <Shutdown_modal/>
    </div>;

const Nav_left = withRouter(class Nav_left extends Pure_component {
    state = {lock: false};
    componentDidMount(){
        this.setdb_on('head.lock_navigation', lock=>
            lock!==undefined&&this.setState({lock}));
    }
    render(){
        return <div className="nav_left">
              <div className={classnames('menu', {lock: this.state.lock})}>
                <Nav_link to="/overview" name="overview" label="Overview"/>
                <Nav_link to="/howto" name="howto" label="Instructions"/>
                <Nav_link to="/proxy_tester" name="proxy_tester"
                  label="Proxy tester"/>
                <Nav_link to="/logs" name="logs" label="Request logs"/>
                <Nav_link to="/settings" name="general_config"
                  label="General settings"/>
                <Nav_link to="/config" name="config"
                  label="Manual configuration"/>
              </div>
              <div className="menu_filler"/>
              <Footer/>
            </div>;
    }
});

const Nav_link = ({label, to, name})=>
    <Route path={to}>
      {({match})=>
        <Nav_link_inner label={label} to={to} name={name} match={match}/>}
    </Route>;

const Nav_link_inner = ({label, to, name, match})=>
    <Link to={to}>
      <div className={classnames('menu_item', {active: match})}>
        <T>{t=><Tooltip title={t(label)} placement="right">
          <div className={classnames('icon', name)}/>
        </Tooltip>}</T>
      </div>
    </Link>;

class Nav_top extends Pure_component {
    state = {ver: '', lock: false};
    componentDidMount(){
        this.setdb_on('head.lock_navigation', lock=>
            lock!==undefined && this.setState({lock}));
        this.setdb_on('head.version', ver=>this.setState({ver}));
    }
    render(){
        const {ver} = this.state;
        const tooltip = `Luminati Proxy Manager v.${ver}`;
        return <div className="nav_top">
              <Tooltip title={tooltip} placement="right">
                <div><Logo lock={this.state.lock}/></div>
              </Tooltip>
              <Nav_right/>
            </div>;
    }
}

const Footer = with_www_api(props=>
    <div className="footer">
      <div>
        <a href={`${props.www_api}/faq#proxy`} rel="noopener noreferrer"
          target="_blank" className="link"><T>FAQ</T></a>
      </div>
      <div>
        <a href="mailto:lpm@luminati.io" className="link">
          <T>Contact</T></a>
      </div>
      <div>
        <a rel="noopener noreferrer" target="_blank" href={swagger_url}
          className="link"><T>API</T></a>
      </div>
    </div>
);

const Logo = withRouter(({lock})=>
    <Link to="/overview" className={classnames('logo', {lock})}/>);

const Nav_right = ()=>
    <div className="nav_top_right">
      <div className="schema"><Schema/></div>
      <Cpu_warning/>
      <div className="notif_icon"><Notif/></div>
      <Patent/>
      <Language/>
      <Account/>
    </div>;

const Patent = with_www_api(props=>
    <div className="patent_note">
      Patent:
      <a className="link" href={`${props.www_api}/patent-marking`}
        rel="noopener noreferrer" target="_blank">
        {`${props.www_api}/patent-marking`}
      </a>
    </div>
);

const show_reload = function(){
    $('#restarting').modal({
        backdrop: 'static',
        keyboard: false,
    });
};

class Upgrade_downgrade_modal extends Pure_component {
    confirm(){
        const loading_modal = this.props.action=='upgrade' ?
            '#upgrading' : '#downgrading';
        window.setTimeout(()=>$(loading_modal).modal(), 500);
        const _this = this;
        this.etask(function*(){
            this.on('uncaught', e=>{
                $(loading_modal).modal('hide');
                if (_this.props.action=='upgrade')
                {
                    setdb.set('head.upgrade_error', e.message);
                    setdb.set('head.upgrading', false);
                }
            });
            setdb.set('head.upgrading', true);
            if (_this.props.action=='upgrade')
            {
                yield ajax({url: '/api/upgrade', method: 'POST',
                    timeout: 600000});
            }
            else
            {
                yield ajax({url: '/api/downgrade', method: 'POST',
                    timeout: 100000});
            }
            yield ajax({url: '/api/restart', method: 'POST'});
            $(loading_modal).modal('hide');
            show_reload();
            if (_this.props.action=='upgrade')
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
        const action = this.props.action=='upgrade' ?
            'upgraded' : 'downgraded';
        const id = this.props.action=='upgrade' ?
            'upgrade_modal' : 'downgrade_modal';
        return <Modal id={id} click_ok={this.confirm.bind(this)}
              title={'The application will be '+action+' and restarted'}/>;
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
        return <Modal id="shutdown_modal"
              click_ok={this.confirm.bind(this)}
              title="Are you sure you want to shut down the local proxies?"/>;
    }
}

const Account = withRouter(class Account extends Pure_component {
    state = {};
    componentDidMount(){
        this.setdb_on('head.settings', settings=>this.setState({settings}));
        this.setdb_on('head.ver_last', ver_last=>this.setState({ver_last}));
        this.setdb_on('head.backup_exist', backup_exist=>
            this.setState({backup_exist}));
    }
    open_report_bug = ()=>$('#report_bug_modal').modal();
    upgrade = ()=>$('#upgrade_modal').modal();
    downgrade = ()=>$('#downgrade_modal').modal();
    shutdown = ()=>$('#shutdown_modal').modal();
    logout = ()=>{
        const _this = this;
        this.etask(function*(){
            yield ajax({url: '/api/logout', method: 'POST'});
            _this.props.history.push('/login');
        });
    };
    render(){
        if (!this.state.settings)
            return null;
        const is_upgradable = this.state.ver_last && this.state.ver_last.newer;
        const customer = this.state.settings.customer;
        return <T>{t=><div className="dropdown">
              <a className="link dropdown-toggle" data-toggle="dropdown">
                <Tooltip placement="bottom"
                  title={t('You are currently logged in as')+' '+customer}>
                  <span>
                    {customer}
                    <span style={{marginLeft: 5}} className="caret"/>
                  </span>
                </Tooltip>
              </a>
              <ul className="dropdown-menu dropdown-menu-right">
                {is_upgradable &&
                  <li><a onClick={this.upgrade}>{t('Upgrade')}</a></li>
                }
                {!!this.state.backup_exist &&
                    <li><a onClick={this.downgrade}>{t('Downgrade')}</a></li>
                }
                <li>
                  <a onClick={this.open_report_bug}>{t('Report a bug')}</a>
                </li>
                <li><a onClick={this.logout}>{t('Log out')}</a></li>
                <li><a onClick={this.shutdown}>{t('Shut down')}</a></li>
              </ul>
            </div>}</T>;
    }
});

export default Nav;
