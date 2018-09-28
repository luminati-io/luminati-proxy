// LICENSE_CODE ZON ISC
'use strict'; /*jslint browser:true, react:true, es6:true*/
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
import Whitelist_ips from './whitelist_ips.js';
import {Logs, Dock_logs} from './logs.js';
import {Enable_ssl_modal} from './common.js';
import React from 'react';
import ReactDOM from 'react-dom';
import {withRouter, Switch, BrowserRouter, Route} from 'react-router-dom';
import 'bootstrap';
import 'bootstrap/dist/css/bootstrap.css';
import './app.less';
import 'es6-shim';
import Pure_component from '../../www/util/pub/pure_component.js';

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
            const version = yield ajax.json({url: '/api/last_version'});
            setdb.set('head.ver_last', version);
        });
        this.etask(function*(){
            const defaults = yield ajax.json({url: '/api/defaults'});
            setdb.set('head.defaults', defaults);
            const socket = new WebSocket(
                `ws://${window.location.hostname}:${defaults.ws}`);
            setdb.set('head.ws', socket);
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
            const warnings = yield ajax.json({url: '/api/warnings'});
            setdb.set('head.warnings', warnings.warnings);
        });
    };
    render(){
        return <div className="page_wrapper">
              <Enable_ssl_modal/>
              <Switch>
                <Route path="/login" exact component={Login}/>
                <Route path="/whitelist_ips" exact component={Whitelist_ips}/>
                <Route path="/dock_logs" exact component={Dock_logs}/>
                <Route path="/" component={Page}/>
              </Switch>
            </div>;
    }
});

const Page = ()=>
    <div>
      <Nav/>
      <div className="page_body">
        <Switch>
          <Route path="/overview" exact component={Overview}/>
          <Route path="/overview/:master_port" exact component={Overview}/>
          <Route path="/proxy/:port/:tab?" exact component={Proxy_edit}/>
          <Route path="/howto" exact component={Howto}/>
          <Route path="/logs" exact component={Logs}/>
          <Route path="/proxy_tester" exact component={Proxy_tester}/>
          <Route path="/tracer" exact component={Tracer}/>
          <Route path="/config" exact component={Config}/>
          <Route path="/settings" exact component={Settings}/>
          <Route path="/" component={Overview}/>
        </Switch>
      </div>
    </div>;

const Root = ()=>
    <BrowserRouter>
      <App/>
    </BrowserRouter>;

ReactDOM.render(<Root/>, document.getElementById('react_root'));
