// LICENSE_CODE ZON ISC
'use strict'; /*jslint browser:true, react:true, es6:true*/
import Pure_component from '/www/util/pub/pure_component.js';
import React from 'react';
import ReactDOM from 'react-dom';
import {withRouter, Switch, BrowserRouter, Route} from 'react-router-dom';
import 'bootstrap';
import 'bootstrap/dist/css/bootstrap.css';
import 'flag-icon-css/css/flag-icon.css';
import 'es6-shim';
import setdb from '../../util/setdb.js';
import ajax from '../../util/ajax.js';
import './css/app.less';
import Proxy_edit from './proxy_edit/index.js';
import Howto from './howto.js';
import Nav from './nav.js';
import Proxy_tester from './proxy_tester.js';
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
import ws from './ws.js';
import {report_exception} from './util.js';

window.setdb = setdb;
setdb.setMaxListeners(30);

const App = withRouter(class App extends Pure_component {
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
    }
    load_data = ()=>{
        this.etask(function*(){
            const locations = yield ajax.json({url: '/api/all_locations'});
            locations.countries_by_code = locations.countries
            .reduce((acc, e)=>({...acc, [e.country_id]: e.country_name}), {});
            setdb.set('head.locations', locations);
        });
        this.etask(function*(){
            const carriers = yield ajax.json({url: '/api/all_carriers'});
            setdb.set('head.carriers', carriers);
        });
        this.etask(function*(){
            const settings = yield ajax.json({url: '/api/settings'});
            setdb.set('head.settings', settings);
        });
        this.etask(function*(){
            const conn = yield ajax.json({url: '/api/conn'});
            setdb.set('head.conn', conn);
        });
        this.etask(function*(){
            const version = yield ajax.json({url: '/api/last_version'});
            setdb.set('head.ver_last', version);
        });
        this.etask(function*(){
            const defaults = yield ajax.json({url: '/api/defaults'});
            setdb.set('head.defaults', defaults);
            ws.set_location(window.location, defaults.www);
        });
        this.etask(function*(){
            const node = yield ajax.json({url: '/api/node_version'});
            setdb.set('head.ver_node', node);
        });
        this.etask(function*(){
            const proxies = yield ajax.json({url: '/api/proxies_running'});
            setdb.set('head.proxies_running', proxies);
        });
        this.etask(function*(){
            const consts = yield ajax.json({url: '/api/consts'});
            setdb.set('head.consts', consts);
        });
        this.etask(function*(){
            const zones = yield ajax.json({url: '/api/zones'});
            setdb.set('head.zones', zones);
        });
        this.etask(function*(){
            const w = yield ajax.json({url: '/api/tls_warning'});
            setdb.set('ws.tls_warning', w);
        });
    };
    save_settings = settings=>{
      return this.etask(function*(){
          const raw = yield window.fetch('/api/settings', {
              method: 'PUT',
              headers: {'Content-Type': 'application/json'},
              body: JSON.stringify(settings),
          });
          const new_settings = yield raw.json();
          setdb.set('head.settings', new_settings);
      });
    };
    render(){
        return <div className="page_wrapper">
              <Enable_ssl_modal/>
              <Api_url_modal/>
              <Old_modals/>
              <Switch>
                <Route path="/login" exact component={Login}/>
                <Route path="/whitelist_ips" exact component={Whitelist_ips}/>
                <Route path="/dock_logs" exact component={Dock_logs}/>
                <Route path="/" component={Page}/>
              </Switch>
            </div>;
    }
});

const Old_modals = ()=>
    <div className="old_modals">
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
      <div id="downgrading" className="modal fade" role="dialog">
        <div className="modal-dialog">
          <div className="modal-content">
            <div className="modal-header">
              <h4 className="modal-title">
                Luminati Proxy Manager is downgrading</h4>
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
      <Modal id="fetching_chrome_modal"
        title="Downloading Chromium. Please wait..." no_cancel_btn>
      </Modal>
    </div>;

const Page = ()=>
    <div>
      <Nav/>
      <Proxy_add/>
      <div className="page_body vbox">
        <Error_boundry>
          <Switch>
            <Route path="/overview" exact component={Overview}/>
            <Route path="/overview/:master_port" exact component={Overview}/>
            <Route path="/proxy/:port" component={Proxy_edit}/>
            <Route path="/howto/:option?/:suboption?" exact component={Howto}/>
            <Route path="/logs" exact component={Logs}/>
            <Route path="/proxy_tester" exact component={Proxy_tester}/>
            <Route path="/config" exact component={Config}/>
            <Route path="/settings" exact component={Settings}/>
            <Route path="/" component={Overview}/>
          </Switch>
        </Error_boundry>
      </div>
    </div>;

const Root = ()=>
    <BrowserRouter>
      <Switch>
        <Route path="/" component={App}/>
      </Switch>
    </BrowserRouter>;

ReactDOM.render(<Root/>, document.getElementById('react_root'));
