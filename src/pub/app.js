// LICENSE_CODE ZON ISC
'use strict'; /*jslint browser:true, react:true, es6:true*/
import 'ui-select/dist/select.css';
import 'bootstrap/dist/css/bootstrap.css';
import 'bootstrap-datepicker/dist/css/bootstrap-datepicker3.css';
import angular from 'angular';
import _ from 'lodash';
import setdb from 'hutil/util/setdb';
import ajax from 'hutil/util/ajax';
import Edit_proxy from './edit_proxy.js';
import Howto from './howto.js';
import Nav from './nav.js';
import Proxy_tester from './proxy_tester.js';
import Login from './login.js';
import Overview from './overview.js';
import Config from './config.js';
import {Logs, Dock_logs} from './logs.js';
import React from 'react';
import ReactDOM from 'react-dom';
import {withRouter, Switch, BrowserRouter, Route} from 'react-router-dom';
import $ from 'jquery';
import 'jquery';
import 'angular-sanitize';
import 'bootstrap';
import 'bootstrap-datepicker';
import './app.less';
import 'angular-ui-bootstrap';
import 'es6-shim';
import 'angular-google-analytics';
import 'ui-select';
import Pure_component from '../../www/util/pub/pure_component.js';

window.setdb = setdb;

const App = withRouter(class App extends Pure_component {
    componentDidMount(){
        const _this = this;
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
            const version = yield ajax.json({url: '/api/version'});
            setdb.set('head.version', version.version);
        });
        this.etask(function*(){
            const version = yield ajax.json({url: '/api/last_version'});
            setdb.set('head.ver_last', version.data);
        });
        this.etask(function*(){
            const defaults = yield ajax.json({url: '/api/defaults'});
            setdb.set('head.defaults', defaults);
            const socket = new WebSocket(
                `ws://${window.location.hostname}:${defaults.ws}`);
            setdb.set('head.ws', socket);
        });
        this.etask(function*(){
            const locations = yield ajax.json({url: '/api/all_locations'});
            locations.countries_by_code = locations.countries
            .reduce((acc, e)=>({...acc, [e.country_id]: e.country_name}), {});
            setdb.set('head.locations', locations);
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
            this.on('uncaught', e=>console.log(e));
            const data = yield ajax.json({url: '/api/mode'});
            const run_config = data.run_config;
            if (data.logged_in)
            {
                if (_this.props.location.pathname!='/login')
                    return;
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
    render(){
        return (
            <div className="page_wrapper">
              <Switch>
                <Route path="/login" exact component={Login}/>
                <Route path="/dock_logs" exact component={Dock_logs}/>
                <Route path="/" component={Page}/>
              </Switch>
            </div>
        );
    }
});

const Page = ()=>(
    <div>
      <Nav/>
      <div className="page_body">
        <Switch>
          <Route path="/overview" exact component={Overview}/>
          <Route path="/overview/:master_port" exact
            component={Overview}/>
          <Route path="/proxy/:port" exact component={Edit_proxy}/>
          <Route path="/howto" exact component={Howto}/>
          <Route path="/logs" exact component={Logs}/>
          <Route path="/proxy_tester" exact component={Proxy_tester}/>
          <Route path="/config" exact component={Config}/>
          <Route path="/" component={Overview}/>
        </Switch>
      </div>
    </div>
);

const Root = ()=>(
    <BrowserRouter>
      <App/>
    </BrowserRouter>
);

ReactDOM.render(<Root/>, document.getElementById('react_root'));
