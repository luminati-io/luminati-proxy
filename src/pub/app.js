// LICENSE_CODE ZON ISC
'use strict'; /*jslint browser:true, react:true, es6:true*/
import Pure_component from '/www/util/pub/pure_component.js';
import React from 'react';
import ReactDOM from 'react-dom';
import classnames from 'classnames';
import {withRouter, Switch, BrowserRouter, Route} from 'react-router-dom';
import 'bootstrap';
import 'bootstrap/dist/css/bootstrap.css';
import 'flag-icons/css/flag-icons.css';
import 'es6-shim';
import setdb from '../../util/setdb.js';
import ajax from '../../util/ajax.js';
import etask from '../../util/etask.js';
import zurl from '../../util/url.js';
import Proxy_edit from './proxy_edit/index.js';
import Howto from './howto.js';
import Nav from './nav.js';
import Login from './login.js';
import Overview from './overview.js';
import Config from './config.js';
import Settings from './settings.js';
import Proxy_add from './proxy_add.js';
import Whitelist_ips from './whitelist_ips.js';
import {Logs, Dock_logs} from './logs.js';
import Enable_ssl_modal from './common/ssl_modal.js';
import Api_url_modal from './common/api_url_modal.js';
import Error_boundry from './common/error_boundry.js';
import {Modal} from './common/modals.js';
import {report_exception, in_cp} from './util.js';
import {createGlobalStyle} from 'styled-components';
import i18n, {TranslationContext, is_except_path} from './common/i18n.js';
import './css/app.less';
import '../../www/util/pub/css/har.less';

window.setdb = setdb;
setdb.setMaxListeners(50);

const App = withRouter(class App extends Pure_component {
    state = {i18n_loaded: false};
    componentDidMount(){
        setdb.set('head.save_settings', this.save_settings);
        const _this = this;
        this.etask(function*(){
            const version = yield ajax.json({url: '/api/version'});
            setdb.set('head.version', version.version);
            setdb.set('head.is_upgraded', version.is_upgraded);
            setdb.set('head.backup_exist', version.backup_exist);
            setdb.set('head.argv', version.argv);
        });
        this.etask(function*(){
            this.on('uncaught', e=>_this.etask(function*(){
                yield report_exception(e, 'app.App.componentDidMount');
            }));
            const url_o = zurl.parse(document.location.href);
            const qs_o = zurl.qs_parse((url_o.search||'').substr(1));
            if (qs_o.lpm_token)
            {
                yield window.fetch('/api/cloud_auth', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({
                        lpm_token: qs_o.lpm_token,
                        username: qs_o.user,
                    }),
                });
            }
            if (qs_o.lang)
                i18n.set_curr_lang(qs_o.lang);
            const mode = yield window.fetch('/api/mode');
            let block_ip;
            if (block_ip = mode.headers.get('x-lpm-block-ip'))
            {
                setdb.set('head.blocked_ip', block_ip);
                return _this.props.history.replace('/whitelist_ips');
            }
            _this.load_data();
            if (mode.headers.get('x-lpm-local-login'))
                return _this.props.history.replace('/login');
            const data = yield mode.json();
            if (data.logged_in)
            {
                if (!['/login', '/whitelist_ips'].includes(
                    _this.props.location.pathname))
                {
                    return;
                }
                return _this.props.history.replace('/overview');
            }
            if (_this.props.location.pathname=='/login')
                return;
            return _this.props.history.replace({
                pathname: '/login',
                search: _this.props.location.search,
            });
        });
        this.setdb_on('i18n_loaded', i18n_loaded=>{
            if (!i18n_loaded)
                return;
            this.setState({i18n_loaded});
        });
        this.setdb_on('head.settings', settings=>
            settings && this.setState({settings}));
        this.setdb_on('i18n.curr_lang', curr_lang=>
            curr_lang && this.setState({curr_lang}));
        this.setdb_on('head.conn', conn=>{
            let lang = window.localStorage.getItem('lang');
            if (lang)
                return void i18n.set_curr_lang(lang);
            if (!conn)
                return;
            if (Object.keys(i18n.langs).includes(conn.current_country))
                lang = conn.current_country;
            else
                lang = 'en';
            i18n.set_curr_lang(lang);
        });
    }
    load_data = ()=>this.etask(function*(){
        const errors = [];
        const err_handler = msg=>etask.fn(function*(e){
            errors.push(`${msg}: ${e.message}`);
            yield report_exception(e, 'app.App.componentDidMount.load_data');
        });
        this.spawn(etask(function*(){
            this.on('uncaught', err_handler('Error fetching locations'));
            const locations = yield ajax.json({url: '/api/all_locations'});
            setdb.set('head.locations', locations);
        }));
        this.spawn(etask(function*(){
            this.on('uncaught', err_handler('Error fetching carriers'));
            const carriers = yield ajax.json({url: '/api/all_carriers'});
            setdb.set('head.carriers', carriers);
        }));
        etask(function*(){
            this.on('uncaught', err_handler('Error fetching lang data'));
            this.finally(()=>setdb.set('i18n_loaded', true));
            const res = yield ajax.json({url: '/api/i18n'});
            Object.keys(res).forEach(lang_code=>{
                if (i18n.langs[lang_code])
                    i18n.langs[lang_code].t = res[lang_code];
            });
        });
        etask(function*(){
            const settings = yield ajax.json({url: '/api/settings'});
            setdb.set('head.settings', settings);
        });
        etask(function*(){
            const conn = yield ajax.json({url: '/api/conn'});
            setdb.set('head.conn', conn);
        });
        etask(function*(){
            const version = yield ajax.json({url: '/api/last_version'});
            setdb.set('head.ver_last', version);
        });
        etask(function*(){
            const defaults = yield ajax.json({url: '/api/defaults'});
            setdb.set('head.defaults', defaults);
        });
        etask(function*(){
            const node = yield ajax.json({url: '/api/node_version'});
            setdb.set('head.ver_node', node);
        });
        etask(function*(){
            const proxies = yield ajax.json({url: '/api/proxies_running'});
            setdb.set('head.proxies_running', proxies);
        });
        etask(function*(){
            const consts = yield ajax.json({url: '/api/consts'});
            setdb.set('head.consts', consts);
        });
        etask(function*(){
            const zones = yield ajax.json({url: '/api/zones'});
            setdb.set('ws.zones', zones);
        });
        etask(function*(){
            const w = yield ajax.json({url: '/api/tls_warning'});
            setdb.set('ws.tls_warning', w);
        });
        yield this.wait_child('all');
        if (errors.length)
            setdb.set('head.app_errors', errors);
    });
    save_settings = settings=>{
      return this.etask(function*(){
          const raw = yield window.fetch('/api/settings', {
              method: 'PUT',
              headers: {'Content-Type': 'application/json'},
              body: JSON.stringify(settings),
          });
          if (raw.status!=200)
              return {err: yield raw.text()};
          const new_settings = yield raw.json();
          setdb.set('head.settings', new_settings);
          return new_settings;
      });
    };
    render(){
      const {i18n_loaded, curr_lang} = this.state;
      if (!i18n_loaded && !is_except_path(this.props.location.pathname))
          return null;
      return <TranslationContext.Provider value={curr_lang}>
        <div className="page_wrapper">
          <Global_styles_brd/>
          <Enable_ssl_modal/>
          <Api_url_modal/>
          <Old_modals/>
          <Switch>
            <Route path="/login" exact component={Login}/>
            <Route path="/whitelist_ips" exact component={Whitelist_ips}/>
            <Route path="/dock_logs" exact component={Dock_logs}/>
            <Route path="/" component={Page}/>
          </Switch>
        </div>
      </TranslationContext.Provider>;
    }
});

const Global_styles_brd = createGlobalStyle`
  html {
    --first-color: #526373;
    --first-odd: #526373;
    --cp-border: rgba(82,99,115,0.1);
    --cp-border-dark: rgba(82,99,115,0.2);
    --cp-dark: #EDEFF1;
    --cp-second: rgba(82,99,115,0.5);
    --cp-third: rgba(82,99,115,0.7);

    --btn-lpm-border-radius: 100px;
    --border-radius-round: 100px;
    --btn-lpm-font-weight: 500;

    --login-logo: url(img/brd_logo_large.svg);
    --login-logo-width: 125px;
    --login-logo-version-top: 28px;
    --login-logo-version-left: -55px;
    --logo-icon: url(img/brd_logo_letter.svg);
    --logo-bg-size: 38px;

    body {
        font-family: "Gibson";
    }
  }
`;

const general_modals_info = [
    {
        id: 'restarting',
        title: 'Restarting...',
        body: 'Please wait. The page will be reloaded automatically once the '
            +'application has restarted.',
    },
    {
        id: 'missing_root_perm',
        title: 'Proxy Manager process is not running with root permissions',
        body: "You can't upgrade Proxy Manager from the UI because it's not "
            +'running with root permission. You have to close the process in '
            +'the terminal and run <code>sudo luminati --upgrade</code>',
    },
    {
        id: 'upgrading',
        title: 'Proxy Manager is upgrading',
        body: 'Please wait...',
    },
    {
        id: 'downgrading',
        title: 'Proxy Manager is downgrading',
        body: 'Please wait...',
    },
    {
        id: 'shutdown',
        title: 'Shutdown',
        body: 'The application has been shut down. To restart, please run it '
            +'manually and reload this page.',
    },
];

const General_old_modals = ()=>
    general_modals_info.map(({id, title, body: __html})=>
        <div key={id} id={id} className="modal fade" role="dialog">
          <div className="modal-dialog">
          <div className="modal-content">
            <div className="modal-header">
              <h4 className="modal-title">{title}</h4>
            </div>
            <div className="modal-body" dangerouslySetInnerHTML={{__html}}/>
            <div className="modal-footer"/>
          </div>
          </div>
        </div>);

const Old_modals = ()=>
    <div className="old_modals">
      <General_old_modals/>
      <Modal id="fetching_chrome_modal"
        title="Downloading Chromium. Please wait..." no_cancel_btn>
      </Modal>
      <Modal id="applying_config"
        title="Synchronizing Proxy Manager configuration. Please wait..."
        no_cancel_btn>
      </Modal>
    </div>;

class Page extends Pure_component {
    state = {settings: {}};
    componentDidMount(){
        this.setdb_on('head.settings', settings=>
            settings && this.setState({settings}));
    }
    render(){
        const {settings} = this.state;
        const {zagent} = settings;
        return <div>
          <Nav/>
          <Proxy_add settings={settings}/>
          <div className={classnames('page_body vbox', {zagent})}>
            <Error_boundry>
              <Validator zagent={zagent}/>
              <Switch>
                <Route path="/overview" exact component={Overview}/>
                <Route path="/proxy/:port" component={Proxy_edit}/>
                <Route path="/howto/:option?/:suboption?" exact
                  component={Howto}/>
                <Route path="/logs" exact component={Logs}/>
                <Route path="/config" exact component={Config}/>
                <Route path="/settings" exact component={Settings}/>
                <Route path="/" component={Overview}/>
              </Switch>
            </Error_boundry>
          </div>
        </div>;
    }
}

const Validator = ({zagent})=>{
    if (zagent && !in_cp())
        throw 'cp_required';
    return <React.Fragment></React.Fragment>;
};

const Root = ()=>
    <BrowserRouter>
      <Switch>
        <Route path="/" component={App}/>
      </Switch>
    </BrowserRouter>;

ReactDOM.render(<Root/>, document.getElementById('react_root'));
