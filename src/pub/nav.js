// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true, es6:true*/
import Pure_component from '/www/util/pub/pure_component.js';
import React from 'react';
import etask from '../../util/etask.js';
import ajax from '../../util/ajax.js';
import setdb from '../../util/setdb.js';
import classnames from 'classnames';
import {swagger_url} from './util.js';
import Schema from './schema.js';
import Notif from './notif_center.js';
import Report_bug_modal from './report_bug.js';
import $ from 'jquery';
import {Route, withRouter, Link} from 'react-router-dom';
import Tooltip from './common/tooltip.js';
import {Modal} from './common/modals.js';
import {T, langs, set_lang} from './common/i18n.js';

const Nav = ()=>
    <div className="nav">
      <Nav_top/>
      <Nav_left/>
      <Report_bug_modal/>
      <Upgrade_modal/>
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
                <Nav_link to="/tracer" name="tracer"
                  label="Test affiliate links"/>
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

const Footer = ()=>
    <div className="footer">
      <div>
        <a href="http://luminati.io/faq#proxy" rel="noopener noreferrer"
          target="_blank" className="link"><T>FAQ</T></a>
      </div>
      <div>
        <a href="mailto:lpm@luminati.io" className="link">
          <T>Contact</T></a>
      </div>
      <div>
        <a href={swagger_url} className="link"><T>API</T></a>
      </div>
    </div>;

const Logo = withRouter(({lock})=>
    <Link to="/overview" className={classnames('logo', {lock})}/>);

const Nav_right = ()=>
    <div className="nav_top_right">
      <div className="schema"><Schema/></div>
      <div className="notif_icon"><Notif/></div>
      <Patent/>
      <Language/>
      <Account/>
    </div>;

const Patent = ()=>
    <div className="patent_note">
      Patent:
      <a className="link" href="https://luminati.io/patent-marking"
        rel="noopener noreferrer" target="_blank">
        https://luminati.io/patent-marking
      </a>
    </div>;

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
        return <Modal id="upgrade_modal"
              click_ok={this.confirm.bind(this)}
              title="The application will be upgraded and restarted"/>;
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

class Language extends Pure_component {
    state = {};
    componentDidMount(){
        let lang = window.localStorage.getItem('lang');
        if (lang)
            return this.set_lang(lang);
        this.setdb_on('head.conn', conn=>{
            if (!conn)
                return;
            if (conn.current_country=='cn')
                lang = 'cn';
            else
                lang = 'en';
            this.set_lang(lang);
        });
    }
    set_lang = lang=>{
        this.setState({lang});
        set_lang(lang);
        let curr = window.localStorage.getItem('lang');
        if (curr!=lang)
            window.localStorage.setItem('lang', lang);
    };
    render(){
        if (!this.state.lang)
            return null;
        return <div className="dropdown">
              <a className="link dropdown-toggle" data-toggle="dropdown">
                <Lang_cell lang={this.state.lang}/>
              </a>
              <ul className="dropdown-menu dropdown-menu-right">
                <li onClick={this.set_lang.bind(this, 'cn')}><a>
                  <Lang_cell lang="cn"/>
                </a></li>
                <li onClick={this.set_lang.bind(this, 'en')}><a>
                  <Lang_cell lang="en"/>
                </a></li>
              </ul>
            </div>;
    }
}

const Lang_cell = ({lang})=>
    <React.Fragment>
      <span className={`flag-icon flag-icon-${langs[lang].flag}`}/>
      {langs[lang].name}
    </React.Fragment>;

const Account = withRouter(class Account extends Pure_component {
    state = {};
    componentWillMount(){
        this.setdb_on('head.settings', settings=>this.setState({settings}));
        this.setdb_on('head.ver_last', ver_last=>this.setState({ver_last}));
    }
    open_report_bug = ()=>$('#report_bug_modal').modal();
    upgrade = ()=>$('#upgrade_modal').modal();
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
        const is_upgradable = this.state.ver_last&&this.state.ver_last.newer;
        const tip = `You are currently logged in as
        ${this.state.settings.customer}`;
        return <div className="dropdown">
              <a className="link dropdown-toggle" data-toggle="dropdown">
                <Tooltip placement="bottom" title={tip}>
                  <span>
                    {this.state.settings.customer}
                    <span style={{marginLeft: 5}} className="caret"/>
                  </span>
                </Tooltip>
              </a>
              <ul className="dropdown-menu dropdown-menu-right">
                {is_upgradable &&
                  <li><a onClick={this.upgrade}>Upgrade</a></li>
                }
                <li><a onClick={this.open_report_bug}>Report a bug</a></li>
                <li><a onClick={this.logout}>Log out</a></li>
                <li><a onClick={this.shutdown}>Shut down</a></li>
              </ul>
            </div>;
    }
});

export default Nav;
