// LICENSE_CODE ZON ISC
'use strict'; /*jslint browser:true, react:true, es6:true*/
import _ from 'lodash4';
import Pure_component from '/www/util/pub/pure_component.js';
import React from 'react';
import ReactDOM from 'react-dom';
import classnames from 'classnames';
import {withRouter, Switch, BrowserRouter, Route} from 'react-router-dom';
import {createGlobalStyle} from 'styled-components';
import 'bootstrap';
import 'bootstrap/dist/css/bootstrap.css';
import 'flag-icons/css/flag-icons.css';
import 'es6-shim';
import setdb from '../../util/setdb.js';
import etask from '../../util/etask.js';
import zurl from '../../util/url.js';
import {App_new} from '../pub2/app.js';
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
import ws from './ws.js';
import {main as Api} from './api.js';
import CP_ipc from './cp_ipc.js';
import Enable_ssl_modal from './common/ssl_modal.js';
import Api_url_modal from './common/api_url_modal.js';
import Error_boundry from './common/error_boundry.js';
import {Modal} from './common/modals.js';
import {report_exception, in_cp, with_zagent_fn} from './util.js';
import i18n, {TranslationContext, is_except_path} from './common/i18n.js';
import './css/app.less';
import '../../www/util/pub/css/har.less';

window.setdb = setdb;
setdb.setMaxListeners(50);

const history_listener = _.debounce(
    ({pathname})=>CP_ipc.post('route_change', {pathname}),
    250
);

const App = withRouter(class App extends Pure_component {
    constructor(props){
        super(props);
        this.state = {i18n_loaded: false};
    }
    componentDidMount(){
        console.log('Mount APP');
        ws.connect();
        this.rm_history_listener = this.props.history.listen(history_listener);
        this.rm_change_route_listener = CP_ipc.listen('change_route',
            ({mode})=>mode&&this.props.history.replace('/'+mode));
        setdb.set('head.save_settings', this.save_settings);
        const _this = this;
        this.etask(function*(){
            const version = yield Api.json.get('version');
            setdb.set('head.version', version.version);
            setdb.set('head.is_upgraded', version.is_upgraded);
            setdb.set('head.backup_exist', version.backup_exist);
            setdb.set('head.argv', version.argv);
        });
        this.etask(function*(){
            this.on('uncaught', e=>_this.etask(function*(){
                console.error('App mount error', e);
                yield report_exception(e, 'app.App.componentDidMount');
            }));
            const url_o = zurl.parse(document.location.href);
            const qs_o = zurl.qs_parse((url_o.search||'').substr(1));
            if (qs_o.lpm_token)
            {
                yield Api.json.post('cloud_auth', {
                    lpm_token: qs_o.lpm_token,
                    username: qs_o.user,
                });
            }
            if (qs_o.lang)
                i18n.set_curr_lang(qs_o.lang);
            const mode = yield Api.json.get('mode', {safe: true,
                exp_hdr: ['x-lpm-block-ip', 'x-lpm-local-login']});
            let block_ip;
            if (block_ip = mode.headers['x-lpm-block-ip'])
            {
                setdb.set('head.blocked_ip', block_ip);
                return _this.props.history.replace('/whitelist_ips');
            }
            _this.load_data();
            if (mode.headers['x-lpm-local-login'])
                return _this.props.history.replace('/login');
            if (mode.data.logged_in)
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
        ws.addEventListener('settings_updated', this.on_settings_updated);
    }
    willUnmount(){
        console.log('Unmount APP');
        ws.removeEventListener('settings_updated', this.on_settings_updated);
        if (typeof this.rm_history_listener == 'function')
            this.rm_history_listener();
        if (typeof this.rm_change_route_listener == 'function')
            this.rm_change_route_listener();
        ws.disconnect();
    }
    on_settings_updated = ({data})=>{
        setdb.set('head.settings', data.settings);
        setdb.set('head.defaults', data.defaults);
    };
    load_data = ()=>this.etask(function*(){
        const errors = [];
        const err_handler = (type, no_throw=false)=>etask.fn(function*(e){
            const msg = `Error fetching ${type}: ${e.message}`;
            if (!no_throw)
                errors.push(msg);
            console.error(msg);
            yield report_exception(e, 'app.App.componentDidMount.load_data');
        });
        this.spawn(etask(function*(){
            this.on('uncaught', err_handler('locations'));
            const locations = yield Api.json.get('all_locations');
            setdb.set('head.locations', locations);
        }));
        this.spawn(etask(function*(){
            this.on('uncaught', err_handler('carriers'));
            const carriers = yield Api.json.get('all_carriers');
            setdb.set('head.carriers', carriers);
        }));
        etask(function*(){
            this.on('uncaught', err_handler('lang data'));
            this.finally(()=>setdb.set('i18n_loaded', true));
            const res = yield Api.json.get('i18n');
            Object.keys(res).forEach(lang_code=>{
                if (i18n.langs[lang_code])
                    i18n.langs[lang_code].t = res[lang_code];
            });
        });
        etask(function*(){
            this.on('uncaught', err_handler('settings'));
            const settings = yield Api.json.get('settings');
            setdb.set('head.settings', settings);
        });
        etask(function*(){
            this.on('uncaught', err_handler('conn'));
            const conn = yield Api.json.get('conn');
            setdb.set('head.conn', conn);
        });
        etask(function*(){
            this.on('uncaught', err_handler('last_version', true));
            const version = yield Api.json.get('last_version');
            setdb.set('head.ver_last', version);
        });
        etask(function*(){
            this.on('uncaught', err_handler('defaults'));
            const defaults = yield Api.json.get('defaults');
            setdb.set('head.defaults', defaults);
        });
        etask(function*(){
            this.on('uncaught', err_handler('node_version'));
            const node = yield Api.json.get('node_version');
            setdb.set('head.ver_node', node);
        });
        etask(function*(){
            this.on('uncaught', err_handler('proxies_running'));
            const proxies = yield Api.json.get('proxies_running');
            setdb.set('head.proxies_running', proxies);
        });
        etask(function*(){
            this.on('uncaught', err_handler('consts'));
            const consts = yield Api.json.get('consts');
            setdb.set('head.consts', consts);
        });
        etask(function*(){
            this.on('uncaught', err_handler('zones'));
            const zones = yield Api.json.get('zones');
            setdb.set('ws.zones', zones);
        });
        etask(function*(){
            this.on('uncaught', err_handler('tls_warning'));
            const w = yield Api.json.get('tls_warning');
            setdb.set('ws.tls_warning', w);
        });
        yield this.wait_child('all');
        if (errors.length)
            setdb.set('head.app_errors', errors);
    });
    save_settings = settings=>{
        return this.etask(function*(){
            this.on('uncaught', e=>{
                console.error('Settings save error', e);
                this.return({err: new_settings || e.message});
            });
            const new_settings = yield Api.json.put('settings', settings);
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
    --cp-white: #FFFFFF;
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
        const with_zagent = with_zagent_fn(zagent);
        return <div>
          <Nav/>
          <Proxy_add settings={settings}/>
          <div className={classnames('page_body vbox', {zagent})}>
            <Error_boundry>
              <Validator zagent={zagent}/>
              <Switch>
                <Route path="/overview" exact render={with_zagent(Overview)} />
                <Route path="/proxy/:port" render={with_zagent(Proxy_edit)} />
                <Route path="/howto/:option?/:suboption?" exact
                  render={with_zagent(Howto)} />
                <Route path="/logs" exact render={with_zagent(Logs)} />
                <Route path="/config" exact render={with_zagent(Config)} />
                <Route path="/settings" exact render={with_zagent(Settings)} />
                <Route path="/" render={with_zagent(Overview)} />
              </Switch>
            </Error_boundry>
          </div>
        </div>;
    }
}

const Validator = ({zagent})=>{
    // eslint-disable-next-line
    if (!ENV_DEV && zagent && !in_cp())
        throw 'cp_required';
    return <React.Fragment></React.Fragment>;
};

class Root extends Pure_component {
    constructor(props){
        super(props);
        this.state = {
            use_new_ui: false,
        };
    }
    componentDidMount(){
        const url_o = zurl.parse(document.location.href);
        const qs_o = zurl.qs_parse((url_o.search||'').substr(1));
        if (+qs_o.new_ui && !this.state.use_new_ui)
        {
            console.log('qs ui switch');
            this.setState({use_new_ui: true});
        }
        this.rm_change_ui_app_listener = CP_ipc.listen('ui_state', msg=>{
            console.log('CP ipc ui switch');
            this.handle_ui_state_event(msg);
        });
        this.setdb_on('head.settings', ({new_ui}={})=>{
            if (!new_ui || this.state.use_new_ui)
                return;
            console.log('settings ui switch');
            this.handle_ui_state_event({new_ui});
        });
    }
    willUnmount(){
        if (typeof this.rm_change_ui_app_listener == 'function')
            this.rm_change_ui_app_listener();
    }
    handle_ui_state_event = ({new_ui})=>
        this.setState({use_new_ui: !!+new_ui});
    render(){
        let app_comp = this.state.use_new_ui ? App_new : App;
        return <BrowserRouter>
            <Switch>
                <Route path="/" component={app_comp}/>
            </Switch>
        </BrowserRouter>;
    }
}

ReactDOM.render(<Root/>, document.getElementById('react_root'));
