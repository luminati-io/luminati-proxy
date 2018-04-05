// LICENSE_CODE ZON ISC
'use strict'; /*jslint browser:true, react:true, es6:true*/
import 'ui-select/dist/select.css';
import 'bootstrap/dist/css/bootstrap.css';
import 'bootstrap-datepicker/dist/css/bootstrap-datepicker3.css';
import angular from 'angular';
import _ from 'lodash';
import date from 'hutil/util/date';
import setdb from 'hutil/util/setdb';
import etask from 'hutil/util/etask';
import ajax from 'hutil/util/ajax';
import zedit_proxy from './edit_proxy.js';
import zhowto from './howto.js';
import Nav from './nav.js';
import zproxy_tester from './proxy_tester.js';
import Proxy_tester from './proxy_tester.js';
import zlogin from './login.js';
import zoverview from './overview.js';
import zconfig from './config.js';
import zlogs from './logs.js';
import util from './util.js';
import React from 'react';
import ReactDOM from 'react-dom';
import {Router, Switch} from 'react-router';
import {BrowserRouter, Route, Link} from 'react-router-dom';
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
import '@uirouter/angularjs';

var module = angular.module('app', ['ngSanitize', 'ui.bootstrap', 'ui.select',
    'angular-google-analytics', 'ui.router']);

let analytics_provider;
const ga_event = util.ga_event;
const login_page = 'login';

const Root = ()=>(
    <BrowserRouter>
      <div>
        <Nav/>
        <div className="page_body">
        </div>
      </div>
    </BrowserRouter>
);
//<Switch>
//  <Route exact path='/proxy_tester' component={Proxy_tester}/>
//</Switch>
ReactDOM.render(React.createElement(Root),
    document.getElementById('react_root'));

module.config(['$uiRouterProvider', '$locationProvider', 'AnalyticsProvider',
function($uiRouter, $location_provider, _analytics_provider){
    $location_provider.html5Mode(true);
    _analytics_provider.delayScriptTag(true);
    analytics_provider = _analytics_provider;

    $uiRouter.urlService.rules.otherwise({state: login_page});

    const state_registry = $uiRouter.stateRegistry;
    state_registry.register({
        name: 'app',
        redirectTo: login_page,
    });
    state_registry.register({
        name: 'login',
        parent: 'app',
        url: '/login',
        template: '<div react-view=react_component></div>',
        controller: $scope=>{ $scope.react_component = zlogin; },
    });
    state_registry.register({
        name: 'overview',
        parent: 'app',
        url: '/overview',
        template: '<div react-view=react_component></div>',
        controller: $scope=>{ $scope.react_component = zoverview; },
    });
    state_registry.register({
        name: 'overview_multiplied',
        parent: 'app',
        url: '/overview/{port:string}',
        template: '<div react-view=react_component></div>',
        controller: $scope=>{ $scope.react_component = zoverview; },
    });
    state_registry.register({
        name: 'howto',
        parent: 'app',
        url: '/howto',
        template: '<div react-view=react_component></div>',
        controller: $scope=>{ $scope.react_component = zhowto; },
    });
    state_registry.register({
        name: 'proxy_tester',
        parent: 'app',
        url: '/proxy_tester?url&port&method',
        template: '<div react-view=react_component></div>',
        controller: $scope=>{ $scope.react_component = zproxy_tester; },
    });
    state_registry.register({
        name: 'config',
        parent: 'app',
        url: '/config',
        template: '<div react-view=react_component></div>',
        controller: $scope=>{ $scope.react_component = zconfig; },
    });
    state_registry.register({
        name: 'edit_proxy',
        parent: 'app',
        url: '/proxy/{port:string}?field',
        template: `<div react-view=react_component state-props=port
            extra-props=field></div>`,
        controller: ($scope, $rootScope)=>{
            $scope.react_component = zedit_proxy; },
    });
    state_registry.register({
        name: 'logs',
        parent: 'app',
        url: '/logs?code&?domain&?port&?protocol',
        template: `<div react-view=react_component></div>`,
        controller: $scope=>{ $scope.react_component = zlogs; },
    });
}]);

module.run(function($rootScope, $http, $window, $transitions, $q, Analytics,
    $timeout)
{
    const logged_in_resolver = $q.defer();
    $rootScope.logged_in = logged_in_resolver.promise;
    $transitions.onBefore({to: function(state){
        return !['app', 'faq'].includes(state.name);
    }}, function(transition){
        return etask(function*(){
            const logged_in = yield $q.resolve($rootScope.logged_in);
            if (logged_in)
            {
                if (transition.to().name!=login_page)
                    return true;
                return transition.router.stateService.target(
                    'overview', undefined, {location: true});
            }
            if (transition.to().name==login_page)
                return true;
            return transition.router.stateService.target(
                login_page, undefined, {location: false});
        });
    });
    $http.get('/api/mode').then(function(data){
        var logged_in = data.data.logged_in;
        logged_in_resolver.resolve(logged_in);
        $rootScope.mode = data.data.mode;
        $rootScope.run_config = data.data.run_config;
        var ua;
        if (ua = data.data.run_config.ua)
        {
            if (data.data.no_usage_stats)
                analytics_provider.disableAnalytics(true);
            analytics_provider.setAccount({
                tracker: ua.tid,
                set: {forceSSL: true},
                trackEvent: true,
            });
            Analytics.registerScriptTags();
            Analytics.registerTrackers();
            _.each(ua._persistentParams, (v, k)=>Analytics.set(`&${k}`, v));
            Analytics.set('&an', `${ua._persistentParams.an||'LPM'} - UI`);
        }
        analytics_provider = null;
        util.init_ga(Analytics);
        if ($window.localStorage.getItem('last_run_id')!=
            $rootScope.run_config.id)
        {
            $window.localStorage.setItem('last_run_id',
                $rootScope.run_config.id);
            $window.localStorage.setItem('suppressed_warnings', '');
        }
        $rootScope.login_failure = data.data.login_failure;
        $rootScope.$broadcast('error_update');
        if (logged_in)
        {
            var p = 60*60*1000;
            var recheck = function(){
                $http.post('/api/recheck').then(function(r){
                    if (r.data.login_failure)
                        $window.location = '/';
                });
                setTimeout(recheck, p);
            };
            var t = +date();
            setTimeout(recheck, p-t%p);
        }
    });
});

module.controller('root', ['$rootScope', '$scope', '$http', '$window',
    '$state', '$transitions', '$timeout',
    ($rootScope, $scope, $http, $window, $state, $transitions, $timeout)=>
{
    $scope.sections = [
        {name: 'login', title: 'Login', navbar: false},
        {name: 'overview_multiplied', title: 'Overview', navbar: false},
        {name: 'overview', title: 'Overview', navbar: true},
        {name: 'proxy_tester', title: 'Proxy Tester', navbar: true},
        {name: 'howto', title: 'Examples', navbar: true},
        {name: 'logs', title: 'Logs', navbar: true},
        {name: 'config', title: 'Configuration', navbar: true},
    ];
    $transitions.onSuccess({}, function(transition){
        var state = transition.to(), section;
        $scope.section = section = $scope.sections.find(function(s){
            return s.name==state.name; });
        setdb.set('head.section', section);
    });
    let section;
    $scope.section = section = $scope.sections.find(function(s){
        return s.name==$state.$current.name; });
    setdb.set('head.section', section);
    $http.get('/api/settings').then(function(settings){
        $rootScope.settings = settings.data;
        setdb.set('head.settings', settings.data);
        $rootScope.beta_features = settings.data.argv
            .includes('beta_features');
    });
    $http.get('/api/ip').then(function(ip){
        $scope.ip = ip.data.ip; });
    $http.get('/api/version').then(version=>{
        $scope.ver_cur = version.data.version;
        setdb.set('head.version', version.data.version);
    });
    $http.get('/api/last_version').then(version=>{
        $scope.ver_last = version.data;
        setdb.set('head.ver_last', version.data);
    });
    $http.get('/api/consts').then(function(consts){
        setdb.set('head.consts', consts.data);
        $rootScope.consts = consts.data;
        $scope.$broadcast('consts', consts.data);
    });
    $http.get('/api/defaults').then(function(defaults){
        setdb.set('head.defaults', defaults.data);
        $scope.$root.defaults = defaults.data;
    });
    etask(function*(){
        const locations = yield ajax.json({url: '/api/all_locations'});
        locations.countries_by_code = locations.countries
        .reduce((acc, e)=>({...acc, [e.country_id]: e.country_name}), {});
        setdb.set('head.locations', locations);
    });
    $http.get('/api/node_version').then(node=>{
        $scope.ver_node = node.data;
        setdb.set('head.ver_node', node.data);
    });
    setdb.set('head.callbacks.state.go', $state.go);
    window.setdb = setdb;
    window.to_state = $state.go;
    $scope.warnings = function(){
        if (!$rootScope.run_config||!$rootScope.run_config.warnings)
            return [];
        var suppressed =
            window.localStorage.getItem('suppressed_warnings').split('|||');
        var warnings = [];
        for (var i=0; i<$rootScope.run_config.warnings.length; i++)
        {
            var w = $rootScope.run_config.warnings[i];
            if (!suppressed.includes(w))
                warnings.push(w);
        }
        return warnings;
    };
    $scope.dismiss_warning = function(warning){
        const warnings =
            window.localStorage.getItem('suppressed_warnings').split('|||');
        warnings.push(warning);
        window.localStorage.setItem('suppressed_warnings',
            warnings.join('|||'));
    };
    $scope.zone_click = function(name){ ga_event('navbar', 'click', name); };
}]);

module.directive('reactView', ['$state', function($state){
    return {
        scope: {view: '=reactView', props: '@stateProps',
            extra_props: '=extraProps'},
        link: function(scope, element, attrs){
            const props = _.pick($state.params, (scope.props||'').split(' '));
            Object.assign(props, {extra: scope.extra_props});
            ReactDOM.render(React.createElement(scope.view, props),
                element[0]);
            element.on('$destroy', ()=>{
                ReactDOM.unmountComponentAtNode(element[0]); });
        },
    };
}]);

angular.bootstrap(document, ['app']);
