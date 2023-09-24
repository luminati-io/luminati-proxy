// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true, es6:true*/
import Pure_component from '/www/util/pub/pure_component.js';
import {Route, withRouter, Link} from 'react-router-dom';
import React from 'react';
import _ from 'lodash4';
import $ from 'jquery';
import classnames from 'classnames';
import etask from '../../util/etask.js';
import ajax from '../../util/ajax.js';
import setdb from '../../util/setdb.js';
import zurl from '../../util/url.js';
import Schema from './schema.js';
import Report_bug_modal from './report_bug.js';
import Cpu_warning from './cpu_warning.js';
import Tooltip from './common/tooltip.js';
import {Modal} from './common/modals.js';
import {T} from './common/i18n.js';
import {Language} from './common/i18n.js';
import {with_www_api} from './common.js';
import ws from './ws.js';
import {main as Api} from './api.js';
import './css/nav.less';

class Nav extends Pure_component {
    state = {lock: false};
    componentDidMount(){
        this.setdb_on('head.lock_navigation', lock=>
            lock!==undefined && this.setState({lock}));
        this.setdb_on('head.settings', settings=>this.setState({settings}));
    }
    render(){
        if (!this.state.settings)
            return null;
        return <div className="nav">
          <Nav_top/>
          <Nav_left zagent={this.state.settings.zagent}
            lock={this.state.lock}/>
          <Report_bug_modal username={this.state.settings.username}/>
          <Upgrade_downgrade_modal action='upgrade'/>
          <Upgrade_downgrade_modal action='downgrade'/>
          <Shutdown_modal/>
        </div>;
    }
}

const Nav_left = with_www_api(withRouter(props=>{
    if (props.zagent)
        return null;
    const faq_url = props.www_help+'/hc/en-us/sections/12571042542737'
        +'-Proxy-Manager';
    const api_url = props.www_help+'/hc/en-us/articles/13595498290065-API';
    const howto_click = ()=>ws.post_event('Howto Nav Left Click');
    return <div className="nav_left">
          <div className={classnames('menu', {lock: props.lock})}>
            <Nav_link to="/overview" name="overview" label="Overview" />
            <Nav_link to="/howto" name="howto" on_click={howto_click}
              label="How to use Proxy Manager"/>
            <Nav_link to="/logs" name="logs" label="Request logs" />
            <Nav_link to="/settings" name="general_config"
              label="General settings" />
            <Nav_link to="/config" name="config"
                label="Manual configuration" />
            <Nav_link ext to={api_url} name="api"
              label="API documentation" />
            <Nav_link ext to={faq_url} name="faq" label="FAQ" />
          </div>
          <div className="menu_filler"/>
        </div>;
}));

const Nav_link = ({label, to, name, ext, on_click})=>
    <Route path={to}>
      {({match})=>
        <Nav_link_inner label={label} to={to} name={name} match={match}
          ext={ext} on_click={on_click}/>}
    </Route>;

const Nav_link_inner = ({label, to, name, match, ext, on_click})=>{
    if (ext)
    {
        return <a href={to} target="_blank" rel="noopener noreferrer"
            onClick={on_click||_.noop}>
            <div className="menu_item">
                <T>{t=><Tooltip title={t(label)} placement="right">
                    <div className={classnames('icon', name)}/>
                </Tooltip>}</T>
            </div>
        </a>;
    }
    return <Link to={{pathname: to}} onClick={on_click||_.noop}>
        <div className={classnames('menu_item', {active: match})}>
            <T>{t=><Tooltip title={t(label)} placement="right">
                <div className={classnames('icon', name)}/>
            </Tooltip>}</T>
        </div>
    </Link>;
};

class Nav_top extends Pure_component {
    constructor(props){
        super(props);
        const url_o = zurl.parse(document.location.href);
        const qs_o = zurl.qs_parse((url_o.search||'').substr(1));
        this.state = {
            ver: '',
            lock: false,
            embedded: qs_o.embedded=='true' || window.self!=window.top,
        };
    }
    componentDidMount(){
        this.setdb_on('head.lock_navigation', lock=>
            lock!==undefined && this.setState({lock}));
        this.setdb_on('head.version', ver=>this.setState({ver}));
        this.setdb_on('head.settings', settings=>this.setState({settings}));
    }
    render(){
        const {ver, settings, embedded} = this.state;
        if (!settings)
            return null;
        const tooltip = `Proxy Manager v.${ver}`;
        return <div className="nav_top">
            {!settings.zagent &&
                <Tooltip title={tooltip} placement="right">
                    <div><Logo lock={this.state.lock}/></div>
                </Tooltip>
            }
            <Nav_right settings={settings} embedded={embedded}/>
        </div>;
    }
}

const Logo = withRouter(({lock})=>
    <Link to="/overview" className={classnames('logo', {lock})}/>);

const Nav_right = props=>
    <div className="nav_top_right">
      <div className="schema"><Schema/></div>
      {props.settings.use_custom_cert && <Custom_certificate />}
      {props.embedded && <Language hidden/>}
      {!props.embedded &&
        <React.Fragment>
          <Cpu_warning/>
          <Patent/>
          <Language/>
          <Account settings={props.settings}/>
        </React.Fragment>
      }
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

const Custom_certificate = ({custom})=>
  <Tooltip title="User certificate" placement="left" >
    <span className={classnames('glyphicon', 'glyphicon-certificate', 'cert',
      custom ? 'custom' : '')}/>
  </Tooltip>;

const show_reload = function(){
    $('#restarting').modal({
        backdrop: 'static',
        keyboard: false,
    });
};

class Upgrade_downgrade_modal extends Pure_component {
    missing_root_perm_err(e){ return (e.xhr_info.data||{}).code==126; }
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
                    if (_this.missing_root_perm_err(e))
                        $('#missing_root_perm').modal();
                    setdb.set('head.upgrade_error', e.message);
                    setdb.set('head.upgrading', false);
                }
            });
            const {action} = _this.props;
            setdb.set('head.upgrading', true);
            yield Api.post(action=='upgrade' ? 'upgrade' : 'downgrade');
            yield Api.post('restart');
            $(loading_modal).modal('hide');
            show_reload();
            if (action=='upgrade')
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
            yield Api.post('shutdown');
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
            yield Api.post('logout');
            _this.props.history.push('/login');
        });
    };
    render(){
        const zagent = this.props.settings.zagent;
        const is_upgradable = !zagent && this.state.ver_last &&
            this.state.ver_last.newer;
        const is_downgradable = !zagent && this.state.backup_exist;
        const {customer_id, customer} = this.props.settings;
        return <T>{t=><div className="dropdown">
              <a className="link dropdown-toggle" data-toggle="dropdown">
                <span>
                  {customer_id} ({customer})
                  <span style={{marginLeft: 5}} className="caret"/>
                </span>
              </a>
              <ul className="dropdown-menu dropdown-menu-right">
                {is_upgradable &&
                  <li><a onClick={this.upgrade}>{t('Upgrade')}</a></li>
                }
                {is_downgradable &&
                  <li><a onClick={this.downgrade}>{t('Downgrade')}</a></li>
                }
                <li>
                  <a onClick={this.open_report_bug}>{t('Report a bug')}</a>
                </li>
                {!zagent &&
                  <React.Fragment>
                    <li><a onClick={this.logout}>{t('Log out')}</a></li>
                    <li><a onClick={this.shutdown}>{t('Shut down')}</a></li>
                  </React.Fragment>
                }
              </ul>
            </div>}</T>;
    }
});

export default Nav;
