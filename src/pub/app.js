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
import Proxy_edit from './proxy_edit/index.js';
import Howto from './howto.js';
import Nav from './nav.js';
import Proxy_tester from './proxy_tester.js';
import Login from './login.js';
import Overview from './overview.js';
import Config from './config.js';
import Settings from './settings.js';
import Tracer from './tracer.js';
import Proxy_add from './proxy_add.js';
import Whitelist_ips from './whitelist_ips.js';
import {Logs, Dock_logs} from './logs.js';
import Enable_ssl_modal from './common/ssl_modal.js';
import Api_url_modal from './common/api_url_modal.js';
import Error_boundry from './common/error_boundry.js';
import './app.less';
import ws from './ws.js';

window.setdb = setdb;
setdb.setMaxListeners(30);

const App = withRouter(class App extends Pure_component {
    componentDidMount(){
        const _this = this;
        this.etask(function*(){
            const version = yield ajax.json({url: '/api/version'});
            setdb.set('head.version', version.version);
        });
        this.etask(function*(){
            this.on('uncaught', e=>console.log(e));
            const mode = yield window.fetch('/api/mode');
            let block_ip;
            if (block_ip = mode.headers.get('x-lpm-block-ip'))
            {
                setdb.set('head.blocked_ip', block_ip);
                return _this.props.history.replace('/whitelist_ips');
            }
            _this.load_data();
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
            const settings = yield ajax.json({url: '/api/settings'});
            setdb.set('head.settings', settings);
            window.ga('set', 'dimension1', settings.customer);
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
            ws.set_location(window.location.hostname, defaults.ws);
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
            <Route path="/tracer" exact component={Tracer}/>
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
        <Route path="/api_app/confirm_session/:port/:url" exact
          component={Api_app}/>
        <Route path="/" component={App}/>
      </Switch>
    </BrowserRouter>;

const Api_app = withRouter(class Api_app extends Pure_component {
    state = {loaded: false};
    componentDidMount(){
        const port = this.props.match.params.port;
        const _this = this;
        this.etask(function*(){
            const url = `api/proxies/${port}/termination_info`;
            const res = yield ajax.json({url});
            const terminated = res.terminated;
            if (!terminated)
            {
                const next = decodeURIComponent(_this.props.match.params.url);
                return window.location = next;
            }
            _this.setState({loaded: true, terminated});
        });
    }
    refresh = ()=>{
        const port = this.props.match.params.port;
        const _this = this;
        this.etask(function*(){
            yield ajax({url: `/api/proxies/${port}/unblock`, method: 'POST'});
            const next = decodeURIComponent(_this.props.match.params.url);
            window.location = next;
        });
    };
    goto_lpm = ()=>this.props.history.push('/');
    render(){
        const next_url = decodeURIComponent(this.props.match.params.url);
        if (!this.state.loaded)
            return null;
        if (!this.state.terminated)
            return 'Redirecting...';
        return <div className="api_app">
              <h1>The session has expired</h1>
              <p>
                <span>Do you want to refresh it? You will be </span>
                <span>
                  redirected to <strong>{next_url}</strong> with new IP.
                </span>
              </p>
              <button onClick={this.goto_lpm}>Go to LPM</button>
              <button onClick={this.refresh}>Refresh</button>
            </div>;
    }
});

ReactDOM.render(<Root/>, document.getElementById('react_root'));
