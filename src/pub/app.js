// LICENSE_CODE ZON ISC
'use strict'; /*jslint browser:true, react:true, es6:true*/
import 'ui-select/dist/select.css';
import 'bootstrap/dist/css/bootstrap.css';
import 'bootstrap-datepicker/dist/css/bootstrap-datepicker3.css';
import 'codemirror/lib/codemirror.css';
import angular from 'angular';
import _ from 'lodash';
import moment from 'moment';
import codemirror from 'codemirror/lib/codemirror';
import date from 'hutil/util/date';
import csv from 'hutil/util/csv';
import zurl from 'hutil/util/url';
import setdb from 'hutil/util/setdb';
import etask from 'hutil/util/etask';
import ajax from 'hutil/util/ajax';
import zescape from 'hutil/util/escape';
import regeneratorRuntime from 'regenerator-runtime';
import req_stats from './stats/stats.js';
import status_codes from './stats/status_codes.js';
import status_codes_detail from './stats/status_codes_detail.js';
import domains from './stats/domains.js';
import domains_detail from './stats/domains_detail.js';
import protocols from './stats/protocols.js';
import zwelcome_modal from './welcome.js';
import {Progress_modal, Setup_guide} from './setup_guide.js';
import zadd_proxy from './add_proxy.js';
import zno_proxies from './no_proxies.js';
import znotif_center from './notif_center.js';
import zedit_proxy from './edit_proxy.js';
import zhowto from './howto.js';
import proxy_tester from './proxy_tester.js';
import protocols_detail from './stats/protocols_detail.js';
import util from './util.js';
import React from 'react';
import ReactDOM from 'react-dom';
import $ from 'jquery';
import 'codemirror/mode/javascript/javascript';
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
import filesaver from 'file-saver';
import {presets, onboarding} from './common.js';

const url_o = zurl.parse(document.location.href);
const qs_o = zurl.qs_parse((url_o.search||'').substr(1));

window.feature_flag = (flag, enable=true)=>{
    window.localStorage.setItem(flag, JSON.stringify(enable)); };

var is_electron = window.process && window.process.versions.electron;

var is_valid_field = function(proxy, name, zone_definition){
    var value = proxy.zone||zone_definition.def;
    if (name=='password')
        return value!='gen';
    if ({city: 1, state: 1}[name]&&(!proxy.country||proxy.country=='*'))
        return false;
    var details = zone_definition.values
    .filter(function(z){ return z.value==value; })[0];
    var permissions = details&&details.perm.split(' ')||[];
    if (name=='vip')
    {
        var plan = details&&details.plans[details.plans.length-1]||{};
        return !!plan.vip;
    }
    if (['country', 'state', 'city', 'asn', 'ip'].includes(name))
        return permissions.includes(name);
    return true;
};

var module = angular.module('app', ['ngSanitize', 'ui.bootstrap', 'ui.select',
    'angular-google-analytics', 'ui.router']);

let analytics_provider;
const ga_event = util.ga_event;

module.config(['$uibTooltipProvider', '$uiRouterProvider', '$locationProvider',
    'AnalyticsProvider',
function($uibTooltipProvider, $uiRouter, $location_provider,
    _analytics_provider)
{
    $location_provider.html5Mode(true);
    $uibTooltipProvider.options({placement: 'top', container: 'body'});
    _analytics_provider.delayScriptTag(true);
    analytics_provider = _analytics_provider;

    $uiRouter.urlService.rules.otherwise({state: 'settings'});

    var state_registry = $uiRouter.stateRegistry;
    state_registry.register({
        name: 'app',
        redirectTo: 'settings',
    });
    state_registry.register({
        name: 'settings',
        parent: 'app',
        url: '/',
        templateUrl: 'settings.html',
    });
    state_registry.register({
        name: 'proxies',
        parent: 'app',
        url: '/proxies',
        params: {'add_proxy': false},
        templateUrl: 'proxies.html',
    });
    state_registry.register({
        name: 'zones',
        parent: 'app',
        url: '/zones/{zone:string}',
        templateUrl: 'zones.html',
        params: {zone: {squash: true, value: null}},
    });
    state_registry.register({
        name: 'tools',
        parent: 'app',
        url: '/tools',
        templateUrl: 'tools.html',
    });
    state_registry.register({
        name: 'faq',
        parent: 'app',
        url: '/faq',
        templateUrl: 'faq.html',
    });
    state_registry.register({
        name: 'status_codes',
        parent: 'app',
        url: '/status_codes',
        template: '<div react-view=react_component></div>',
        controller: function($scope){ $scope.react_component = status_codes; },
    });
    state_registry.register({
        name: 'status_codes_detail',
        parent: 'app',
        url: '/status_codes/{code:int}',
        template: `<div react-view=react_component state-props=code></div>`,
        controller: function($scope){
            $scope.react_component = status_codes_detail; },
    });
    state_registry.register({
        name: 'domains',
        parent: 'app',
        url: '/domains',
        template: '<div react-view=react_component></div>',
        controller: function($scope){ $scope.react_component = domains; },
    });
    state_registry.register({
        name: 'domains_detail',
        parent: 'app',
        url: '/domains/{domain:string}',
        template: `<div react-view=react_component state-props=domain></div>`,
        controller: function($scope){
            $scope.react_component = domains_detail; },
    });
    state_registry.register({
        name: 'protocols',
        parent: 'app',
        url: '/protocols',
        template: '<div react-view=react_component></div>',
        controller: function($scope){ $scope.react_component = protocols; },
    });
    state_registry.register({
        name: 'protocols_detail',
        parent: 'app',
        url: '/protocols/{protocol:string}',
        template: `<div react-view=react_component state-props=protocol>
        </div>`,
        controller: function($scope){
            $scope.react_component = protocols_detail; },
    });
    state_registry.register({
        name: 'setup_guide',
        parent: 'app',
        url: '/setup_guide',
        template: '<div react-view=react_component></div>',
        controller: function($scope){ $scope.react_component = Setup_guide; },
    });
    state_registry.register({
        name: 'howto',
        parent: 'app',
        url: '/howto',
        template: '<div react-view=react_component></div>',
        controller: function($scope){ $scope.react_component = zhowto; },
    });
    state_registry.register({
        name: 'proxy_tester',
        parent: 'app',
        url: '/proxy_tester',
        template: '<div react-view=react_component></div>',
        controller: function($scope){ $scope.react_component = proxy_tester; },
    });
    state_registry.register({
        name: 'edit_proxy',
        parent: 'app',
        url: '/proxy/{port:string}?field',
        template: `<div react-view=react_component state-props=port
            extra-props=field></div>`,
        controller: function($scope, $rootScope){
            $scope.react_component = zedit_proxy; },
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
                const seen_welcome = yield onboarding.has_seen_welcome();
                if (!seen_welcome)
                {
                    $timeout(()=>$('#welcome_modal').modal(), 1000);
                    onboarding.check_welcome();
                    return transition.router.stateService.target(
                        'setup_guide', undefined, {location: true});
                }
                if (transition.to().name!='settings')
                    return true;
                return transition.router.stateService.target(
                    'proxies', undefined, {location: true});
            }
            if (transition.to().name=='settings')
                return true;
            return transition.router.stateService.target(
                'settings', undefined, {location: false});
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

module.factory('$proxies', proxies_factory);
proxies_factory.$inject = ['$http', '$q'];
function proxies_factory($http, $q){
    var service = {
        subscribe: subscribe,
        proxies: null,
        trigger: trigger,
        update: update_proxies
    };
    var listeners = [];
    service.update();
    return service;
    function subscribe(func){
        listeners.push(func);
        if (service.proxies)
            func(service.proxies);
    }
    function update_proxies(){
        const get_status = function(force){
            const proxy = this;
            if (!proxy._status_call || force)
            {
                const params = {};
                if (proxy.proxy_type!='duplicate')
                    params.with_details = true;
                if (force)
                    params.force = true;
                const url = zescape.uri('/api/proxy_status/'+proxy.port,
                    params);
                proxy._status_call = ajax.json({url});
            }
            this._status_call.then(function(res){
                if (res.status=='ok')
                {
                    proxy._status = 'ok';
                    proxy._status_details = res.status_details||[];
                }
                else
                {
                    proxy._status = 'error';
                    const errors = res.status_details.filter(function(s){
                        return s.lvl=='err'; });
                    proxy._status_details = errors.length ? errors
                        : [{lvl: 'err', msg: res.status}];
                }
            }).catch(function(){
                proxy._status_call = null;
                proxy._status = 'error';
                proxy._status_details = [{lvl: 'warn',
                    msg: 'Failed to get proxy status'}];
            });
        };
        return $http.get('/api/proxies_running').then(function(res){
            var proxies = res.data;
            proxies.sort(function(a, b){ return a.port>b.port ? 1 : -1; });
            proxies.forEach(function(proxy){
                if (Array.isArray(proxy.proxy)&&proxy.proxy.length==1)
                    proxy.proxy = proxy.proxy[0];
                proxy.get_status = get_status;
                proxy._status_details = [];
            });
            service.proxies = proxies;
            listeners.forEach(function(cb){ cb(proxies); });
            setdb.set('head.proxies_running', proxies);
            return proxies;
        });
    }
    function trigger(){
        listeners.forEach(function(cb){ cb(service.proxies); });
    }
}

module.factory('$proxy_stats', proxy_stats_factory);
proxy_stats_factory.$inject = ['$proxies', '$timeout'];

function proxy_stats_factory($proxies, $timeout){
    const poll_interval = 1000;
    let sp, get_timeout;
    const _prepare_stats = data=>{
        return data.reduce((acc, el)=>{
            acc[el.port] = {bw: el.in_bw+el.out_bw, reqs: el.reqs};
            return acc;
        }, {});
    };
    const _track_stats = ()=>{
        if (!sp)
            return;
        sp.spawn(etask(function*(){
            const stats = yield ajax.json({url: '/api/proxy_stats'});
            const stats_per_port = _prepare_stats(stats);
            $proxies.proxies = $proxies.proxies.map(p=>{
                if (''+p.port in stats_per_port)
                    p.stats = stats_per_port[p.port];
                return p;
            });
            $proxies.trigger();
            get_timeout = $timeout(_track_stats, poll_interval);
        }));
    };
    const listen = ()=>{
        sp = etask('proxy_stats_factory', function*(){ yield this.wait(); });
        _track_stats();
    };
    const stop_listening = ()=>{
        if (get_timeout)
            $timeout.cancel(get_timeout);
        sp.return();
        sp = undefined;
    };
    return {listen, stop_listening};
}

module.factory('$success_rate', success_rate_factory);
success_rate_factory.$inject = ['$http', '$proxies', '$timeout'];

function success_rate_factory($http, $proxies, $timeout){
    let is_listening = false;
    let get_timeout = false;
    const poll_interval = 3000;
    return {listen, stop_listening};
    function listen(){
        if (is_listening)
            return;
        is_listening = true;
        poll();
        function poll(){
            get_request_rate().then(function(){
                if (!is_listening)
                    return;
                get_timeout = $timeout(poll, poll_interval);
            });
        }
    }
    function stop_listening(){
        is_listening = false;
        if (get_timeout)
            $timeout.cancel(get_timeout);
    }
    function get_request_rate(){
        return $http.get('/api/req_status').then(function(res){
            let rates = res.data;
            if (!$proxies.proxies)
                return;
            $proxies.proxies = $proxies.proxies.map(p=>{
                let rstat = {total: 0, success: 0};
                if (''+p.port in rates)
                    rstat = rates[p.port];
                p.success_rate = rstat.total==0 ? null
                    : (rstat.success/rstat.total*100).toFixed(0);
                return p;
            });
            $proxies.trigger();
        });
    }
}

module.controller('root', ['$rootScope', '$scope', '$http', '$window',
    '$state', '$transitions', '$timeout', '$proxies',
    ($rootScope, $scope, $http, $window, $state, $transitions, $timeout,
    $proxies)=>
{
    $scope.sections = [
        {name: 'setup_guide', title: 'Start using', navbar: true},
        {name: 'settings', title: 'Settings', navbar: false},
        {name: 'proxies', title: 'Proxies', navbar: true},
        {name: 'proxy_tester', title: 'Proxy Tester', navbar: true},
        {name: 'howto', title: 'Examples', navbar: true},
        {name: 'tools', title: 'Tools', navbar: true, children: [
            {name: 'howto', title: 'How to use', navbar: true},
            {name: 'proxy_tester', title: 'Proxy Tester', navbar: true},
        ]},
        {name: 'welcome', navbar: false},
    ];
    $transitions.onSuccess({}, function(transition){
        var state = transition.to(), section;
        $scope.section = section = $scope.sections.find(function(s){
            return s.name==state.name; });
        $scope.subsection = section && section.name=='zones' &&
            transition.params().zone;
    });
    $scope.section = $scope.sections.find(function(s){
        return s.name==$state.$current.name; });
    $http.get('/api/settings').then(function(settings){
        $rootScope.settings = settings.data;
        $rootScope.beta_features = settings.data.argv
            .includes('beta_features');
    });
    $http.get('/api/ip').then(function(ip){
        $scope.ip = ip.data.ip; });
    $http.get('/api/version').then(function(version){
        $scope.ver_cur = version.data.version; });
    $http.get('/api/last_version').then(function(version){
        $scope.ver_last = version.data; });
    $http.get('/api/consts').then(function(consts){
        setdb.set('head.consts', consts.data);
        $rootScope.consts = consts.data;
        $scope.$broadcast('consts', consts.data);
    });
    $http.get('/api/defaults').then(function(defaults){
        setdb.set('head.defaults', defaults.data);
        $scope.$root.defaults = defaults.data;
    });
    $http.get('/api/all_locations').then(function(locations){
        setdb.set('head.locations', locations.data);
        $scope.$root.all_locations = locations.data;
    });
    $http.get('/api/node_version').then(function(node){
        $scope.ver_node = node.data; });
    $proxies.update();
    setdb.set('head.callbacks.proxies.update', $proxies.update);
    setdb.set('head.callbacks.state.go', $state.go);
    window.setdb = setdb;
    $scope.$root.presets = presets;
    $scope.$root.add_proxy_modal = zadd_proxy;
    $scope.$root.no_proxies = zno_proxies;
    $scope.$root.progress_modal = Progress_modal;
    $scope.$root.welcome_modal = zwelcome_modal;
    $scope.$root.notif_center = znotif_center;
    var show_reload = function(){
        $window.$('#restarting').modal({
            backdrop: 'static',
            keyboard: false,
        });
    };
    $scope.is_upgradable = function(){
        if ($scope.ver_last&&$scope.ver_last.newer)
        {
            var version = $window.localStorage.getItem('dismiss_upgrade');
            return version ? $scope.ver_last.version>version : true;
        }
        return false;
    };
    $scope.is_electron = function(){
        return $scope.ver_node&&$scope.ver_node.is_electron||is_electron;
    };
    $scope.dismiss_upgrade = function(){
        $window.localStorage.setItem('dismiss_upgrade',
            $scope.ver_last.version);
    };
    $scope.upgrade = function(){
        $scope.$root.confirmation = {
            text: 'The application will be upgraded and restarted.',
            confirmed: function(){
                $timeout(()=>$('#upgrading').modal(), 500);
                $scope.upgrading = true;
                $http.post('/api/upgrade').then(()=>{
                    $http.post('/api/restart').then(()=>{
                        $scope.upgrading = false;
                        $('#upgrading').modal('hide');
                        show_reload();
                        setTimeout(function _check_reload(){
                            const retry_cb = ()=>{
                                setTimeout(_check_reload, 500); };
                            const ok_cb = ()=>{ $window.location = '/'; };
                            $http.get('/proxies').then(ok_cb, retry_cb);
                        }, 3000);
                    });
                }).catch(()=>{
                    $scope.upgrading = false;
                    $('#upgrading').modal('hide');
                });
            },
        };
        $window.$('#confirmation').modal();
    };
    $scope.shutdown = function(){
        $scope.$root.confirmation = {
            text: 'Are you sure you want to shut down the local proxies?',
            confirmed: function(){
                $http.post('/api/shutdown');
                setTimeout(function(){
                    $window.$('#shutdown').modal({
                        backdrop: 'static',
                        keyboard: false,
                    });
                }, 400);
            },
        };
        $window.$('#confirmation').modal();
    };
    $scope.logout = ()=>{
        $http.post('/api/logout').then(()=>{ $window.location = '/'; }); };
    $scope.warnings = function(){
        if (!$rootScope.run_config||!$rootScope.run_config.warnings)
            return [];
        var suppressed =
            $window.localStorage.getItem('suppressed_warnings').split('|||');
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
        var warnings =
            $window.localStorage.getItem('suppressed_warnings').split('|||');
        warnings.push(warning);
        $window.localStorage.setItem('suppressed_warnings',
            warnings.join('|||'));
    };
    $scope.zone_click = function(name){ ga_event('navbar', 'click', name); };
}]);

module.controller('config', Config);
Config.$inject = ['$scope', '$http', '$window'];
function Config($scope, $http, $window){
    $http.get('/api/config').then(function(config){
        $scope.config = config.data.config;
        setTimeout(function(){
            $scope.codemirror = codemirror.fromTextArea(
                $window.$('#config-textarea').get(0), {mode: 'javascript'});
        }, 0);
    });
    var show_reload = function(){
        $window.$('#restarting').modal({
            backdrop: 'static',
            keyboard: false,
        });
    };
    var check_reload = function(){
        const retry = ()=>{ setTimeout(check_reload, 500); };
        $http.get('/tools').then(function(res){
            $window.location.reload(); }, retry);
    };
    $scope.save = function(){
        $scope.errors = null;
        $http.post('/api/config_check', {config: $scope.codemirror.getValue()})
        .then(function(res){
            $scope.errors = res.data;
            if ($scope.errors.length)
                return;
            $scope.$root.confirmation = {
                text: 'Editing the configuration manually may result in your '
                    +'proxies working incorrectly. Do you still want to modify'
                    +' the configuration file?',
                confirmed: function(){
                    $scope.config = $scope.codemirror.getValue();
                    show_reload();
                    $http.post('/api/config', {config: $scope.config})
                    .then(setTimeout(check_reload, 3000));
                },
            };
            $window.$('#confirmation').modal();
        });
    };
    $scope.update = function(){
        $http.get('/api/config').then(function(config){
            $scope.config = config.data.config;
            $scope.codemirror.setValue($scope.config);
        });
    };
    $window.$('#config-panel')
    .on('hidden.bs.collapse', $scope.update)
    .on('show.bs.collapse', function(){
        setTimeout(function(){
            $scope.codemirror.scrollTo(0, 0);
            $scope.codemirror.refresh();
        }, 0);
    });
    $scope.cancel = function(){
        $window.$('#config-panel > .collapse').collapse('hide');
    };
}

module.controller('resolve', Resolve);
Resolve.$inject = ['$scope', '$http', '$window'];
function Resolve($scope, $http, $window){
    $scope.resolve = {text: ''};
    $scope.update = function(){
        $http.get('/api/resolve').then(function(resolve){
            $scope.resolve.text = resolve.data.resolve;
        });
    };
    $scope.update();
    var show_reload = function(){
        $window.$('#restarting').modal({
            backdrop: 'static',
            keyboard: false,
        });
    };
    // XXX krzysztof/ovidiu: incorrect usage of promises
    var check_reload = function(){
        $http.get('/api/config').catch(
            function(){ setTimeout(check_reload, 500); })
        .then(function(){ $window.location.reload(); });
    };
    $scope.save = function(){
        show_reload();
        $http.post('/api/resolve', {resolve: $scope.resolve.text})
        .then(check_reload);
    };
    $window.$('#resolve-panel')
    .on('hidden.bs.collapse', $scope.update)
    .on('show.bs.collapse', function(){
        setTimeout(function(){
            $window.$('#resolve-textarea').scrollTop(0).scrollLeft(0); }, 0);
    });
    $scope.cancel = function(){
        $window.$('#resolve-panel > .collapse').collapse('hide'); };
    $scope.new_host = function(){
        $window.$('#resolve_add').one('shown.bs.modal', function(){
            $window.$('#resolve_add input').select();
        }).modal();
    };
    $scope.add_host = function(){
        $scope.adding = true;
        $scope.error = false;
        var host = $scope.host.host.trim();
        $http.get('/api/resolve_host/'+host)
        .then(function(ips){
            $scope.adding = false;
            if (ips.data.ips&&ips.data.ips.length)
            {
                for (var i=0; i<ips.data.ips.length; i++)
                    $scope.resolve.text += '\n'+ips.data.ips[i]+' '+host;
                setTimeout(function(){
                    var textarea = $window.$('#resolve-textarea');
                    textarea.scrollTop(textarea.prop('scrollHeight'));
                }, 0);
                $scope.host.host = '';
                $scope.resolve_frm.$setPristine();
                $window.$('#resolve_add').modal('hide');
            }
            else
                $scope.error = true;
        });
    };
}

module.controller('settings', Settings);
Settings.$inject = ['$scope', '$http', '$window', '$sce', '$rootScope',
    '$state', '$location'];
function Settings($scope, $http, $window, $sce, $rootScope, $state, $location){
    var update_error = function(){
        if ($rootScope.relogin_required)
            return $scope.user_error = {message: 'Please log in again.'};
        if (!$rootScope.login_failure)
            return;
        switch ($rootScope.login_failure)
        {
        case 'eval_expired':
            $scope.user_error = {message: 'Evaluation expired!'
                +'<a href=https://luminati.io/#contact>Please contact your '
                +'Luminati rep.</a>'};
            break;
        case 'invalid_creds':
        case 'unknown':
            $scope.user_error = {message: 'Your proxy is not responding.<br>'
                +'Please go to the <a href=https://luminati.io/cp/zones/'
                +$rootScope.settings.zone+'>zone page</a> and verify that '
                +'your IP address '+($scope.$parent.ip ? '('+$scope.$parent.ip
                +')' : '')+' is in the whitelist.'};
            break;
        default:
            $scope.user_error = {message: $rootScope.login_failure};
        }
    };
    update_error();
    $scope.$on('error_update', update_error);
    $scope.parse_arguments = function(args){
        return args.replace(/(--password )(.+?)( --|$)/, '$1|||$2|||$3')
        .split('|||');
    };
    $scope.show_password = function(){ $scope.args_password = true; };
    var check_reload = function(){
        $http.get('/proxies').then(function(){
            $window.location.reload(); }, function(){
                setTimeout(check_reload, 500); });
    };
    $scope.user_data = {username: '', password: ''};
    let token;
    $scope.save_user = function(){
        var creds = {};
        if (token)
            creds = {token: token};
        else
        {
            var username = $scope.user_data.username;
            var password = $scope.user_data.password;
            if (!(username = username.trim()))
            {
                $scope.user_error = {
                    message: 'Please enter a valid email address.',
                    username: true};
                return;
            }
            if (!password)
            {
                $scope.user_error = {message: 'Please enter a password.',
                    password: true};
                return;
            }
            creds = {username: username, password: password};
        }
        $scope.saving_user = true;
        $scope.user_error = null;
        if ($scope.user_customers)
            creds.customer = $scope.user_data.customer;
        $http.post('/api/creds_user', creds).then(d=>{
            if (d.data.customers)
            {
                $scope.saving_user = false;
                $scope.user_customers = d.data.customers;
                $scope.user_data.customer = $scope.user_customers[0];
            }
            else
            {
                onboarding.check_login();
                check_reload();
            }
        }).catch(e=>{
            $scope.saving_user = false;
            $scope.user_error = e.data.error;
        });
    };
    $scope.google_click = function(e){
        var google = $window.$(e.currentTarget), l = $window.location;
        google.attr('href', google.attr('href')+'&state='+encodeURIComponent(
            l.protocol+'//'+l.hostname+':'+(l.port||80)+'?api_version=3'));
    };
    var m, qs_regex = /^([a-zA-Z0-9\+\/=]+)$/;
    if (m = ($location.search().t||'').replace(/\s+/g, '+').match(qs_regex))
    {
        $scope.google_login = true;
        token = m[1];
        $scope.save_user();
    }
}

module.controller('zones', Zones);
Zones.$inject = ['$scope', '$http', '$filter', '$window'];
function Zones($scope, $http, $filter, $window){
    var today = new Date();
    var one_day_ago = (new Date()).setDate(today.getDate()-1);
    var two_days_ago = (new Date()).setDate(today.getDate()-2);
    var one_month_ago = (new Date()).setMonth(today.getMonth()-1, 1);
    var two_months_ago = (new Date()).setMonth(today.getMonth()-2, 1);
    $scope.times = [
        {title: moment(two_months_ago).format('MMM-YYYY'), key: 'back_m2'},
        {title: moment(one_month_ago).format('MMM-YYYY'), key: 'back_m1'},
        {title: moment(today).format('MMM-YYYY'), key: 'back_m0'},
        {title: moment(two_days_ago).format('DD-MMM-YYYY'), key: 'back_d2'},
        {title: moment(one_day_ago).format('DD-MMM-YYYY'), key: 'back_d1'},
        {title: moment(today).format('DD-MMM-YYYY'), key: 'back_d0'},
    ];
    var number_filter = $filter('requests');
    var size_filter = $filter('bytes');
    $scope.fields = [
        {key: 'http_svc_req', title: 'HTTP', filter: number_filter},
        {key: 'https_svc_req', title: 'HTTPS', filter: number_filter},
        {key: 'bw_up', title: 'Upload', filter: size_filter},
        {key: 'bw_dn', title: 'Download', filter: size_filter},
        {key: 'bw_sum', title: 'Total Bandwidth', filter: size_filter}
    ];
    $http.get('/api/stats').then(function(stats){
        if (stats.data.login_failure)
        {
            $window.location = '/';
            return;
        }
        $scope.stats = stats.data;
        if (!Object.keys($scope.stats).length)
            $scope.error = true;
    })
    .catch(function(e){ $scope.error = true; });
    $http.get('/api/whitelist').then(function(whitelist){
        $scope.whitelist = whitelist.data; });
    $http.get('/api/recent_ips').then(function(recent_ips){
        $scope.recent_ips = recent_ips.data; });
    $scope.edit_zone = function(zone){
        $window.location = 'https://luminati.io/cp/zones/'+zone; };
    $scope.new_zone = function(){
        $window.location = 'https://luminati.io/cp/zones?add_new_zone=1';
        ga_event('page: zones', 'click', 'new zone');
    };
}

module.controller('faq', Faq);
Faq.$inject = ['$scope'];
function Faq($scope){
    $scope.questions = [
        {
            name: 'links',
            title: 'More info on the Luminati proxy manager',
        },
        {
            name: 'upgrade',
            title: 'How can I upgrade Luminati proxy manager tool?',
        },
        {
            name: 'ssl',
            title: 'How do I enable HTTPS analyzing?',
        },
    ];
}

module.controller('test-ports', ['$scope', '$http', '$filter', '$window',
function($scope, $http, $filter, $window){
    var preset = JSON.parse(decodeURIComponent(($window.location.search.match(
        /[?&]test-ports=([^&]+)/)||['', 'null'])[1]));
    if (preset)
        $scope.proxy = ''+preset.port;
    $http.get('/api/proxies').then(function(proxies){
        $scope.proxies = [['0', 'All proxies']];
        proxies.data.sort(function(a, b){ return a.port>b.port ? 1 : -1; });
        for (var i=0; i<proxies.data.length; i++)
        {
            $scope.proxies.push(
                [''+proxies.data[i].port, ''+proxies.data[i].port]);
        }
    });
    $scope.request = {};
    $scope.go = function(proxy){
        $scope.reset();
        var req = {
            method: 'GET',
            url: '/api/test-ports?ports='+(+proxy==0 ? $scope.proxies.map(
                function(p){ return +p[0]; }).filter(Boolean).join(',') :
                proxy),
        };
        $scope.loading = true;
        $http(req).then(function(r){
            $scope.loading = false;
            r = r.data;
            if (!r.error)
            {
                for (var port in r)
                    $scope.request[port] = r[port];
            }
            $scope.request.responses = [];
            for (var p in $scope.request)
            {
                if (!+p)
                    continue;
                var response = $scope.request[p].response ||
                    $scope.request[p].error;
                $scope.request.responses.push({
                    proxy: p,
                    body: response.body||{pass: false},
                    ts: response.ts||+new Date(),
                });
            }
        });
    };
    $scope.reset = function(){
        $scope.request = {};
    };
}]);

module.controller('countries', Countries);
Countries.$inject = ['$scope', '$http', '$window'];
function Countries($scope, $http, $window){
    $scope.url = '';
    $scope.ua = '';
    $scope.path = '';
    $scope.headers = [];
    $scope.started = 0;
    $scope.num_loading = 0;
    $scope.add_header = function(){
        $scope.headers.push({key: '', value: ''});
    };
    $scope.remove_header = function(index){
        $scope.headers.splice(index, 1);
    };
    var normalize_headers = function(headers){
        var result = {};
        for (var h in headers)
            result[headers[h].key] = headers[h].value;
        return result;
    };
    $scope.go = function(){
        var process = function(){
            $scope.started++;
            $scope.countries = [];
            var max_concur = 4;
            $scope.num_loading = 0;
            $scope.cur_index = 0;
            var progress = function(apply){
                while ($scope.cur_index<$scope.countries.length&&
                    $scope.num_loading<max_concur)
                {
                    if (!$scope.countries[$scope.cur_index].status)
                    {
                        $scope.countries[$scope.cur_index].status = 1;
                        $scope.countries[$scope.cur_index].img.src =
                            $scope.countries[$scope.cur_index].url;
                        $scope.num_loading++;
                    }
                    $scope.cur_index++;
                }
                if (apply)
                    $scope.$apply();
            };
            var nheaders = JSON.stringify(normalize_headers($scope.headers));
            for (var c_index in $scope.$root.consts.proxy.country.values)
            {
                var c = $scope.$root.consts.proxy.country.values[c_index];
                if (!c.value)
                    continue;
                var params = {
                    country: c.value,
                    url: $scope.url,
                    path: $scope.path,
                    ua: $scope.ua,
                    headers: nheaders,
                };
                var nparams = [];
                for (var p in params)
                    nparams.push(p+'='+encodeURIComponent(params[p]));
                var data = {
                    code: c.value,
                    name: c.key,
                    status: 0,
                    url: '/api/country?'+nparams.join('&'),
                    img: new Image(),
                    index: $scope.countries.length,
                };
                data.img.onerror = (function(started){
                    return function(){
                        if ($scope.started!=started)
                            return;
                        data.status = 3;
                        $scope.num_loading--;
                        progress(true);
                    };
                })($scope.started);
                data.img.onload = (function(started){
                    return function(){
                        if ($scope.started!=started)
                            return;
                        data.status = 4;
                        $scope.num_loading--;
                        progress(true);
                    };
                })($scope.started);
                $scope.countries.push(data);
            }
            progress(false);
        };
        if ($scope.started)
        {
            $scope.$root.confirmation = {
                text: 'The currently made screenshots will be lost. '
                    +'Do you want to continue?',
                confirmed: process,
            };
            $window.$('#confirmation').modal();
        }
        else
            process();
    };
    $scope.view = function(country){
        $scope.screenshot = {
            country: country.name,
            url: country.url,
        };
        $window.$('#countries-screenshot').one('shown.bs.modal', function(){
            $window.$('#countries-screenshot .modal-body > div')
            .scrollTop(0).scrollLeft(0);
        }).modal();
    };
    $scope.cancel = function(country){
        if (!country.status)
            country.status = 2;
        else if (country.status==1)
            country.img.src = '';
    };
    $scope.cancel_all = function(){
        $scope.$root.confirmation = {
            text: 'Do you want to stop all the remaining countries?',
            confirmed: function(){
                    for (var c_i=$scope.countries.length-1; c_i>=0; c_i--)
                    {
                        var country = $scope.countries[c_i];
                        if (country.status<2)
                            $scope.cancel(country);
                    }
                },
            };
        $window.$('#confirmation').modal();
    };
    $scope.retry = function(country){
        if ($scope.cur_index>country.index)
        {
            country.status = 1;
            // XXX colin/ovidiu: why not use urlencoding?
            country.url = country.url.replace(/&\d+$/, '')+'&'+(+date());
            $scope.num_loading++;
            country.img.src = country.url;
        }
        else
            country.status = 0;
    };
}

module.filter('startFrom', function(){
    return function(input, start){
        return input.slice(+start);
    };
});

function check_by_re(r, v){ return (v = v.trim()) && r.test(v); }
var check_number = check_by_re.bind(null, /^\d+$/);
function check_reg_exp(v){
    try { return (v = v.trim()) || new RegExp(v, 'i'); }
    catch(e){ return false; }
}

module.controller('proxies', Proxies);
Proxies.$inject = ['$scope', '$rootScope', '$http', '$proxies', '$window',
    '$q', '$timeout', '$stateParams', '$success_rate', '$state',
    '$proxy_stats'];
function Proxies($scope, $root, $http, $proxies, $window, $q, $timeout,
    $stateParams, $success_rate, $state, $proxy_stats)
{
    $scope.ratio_tooltip = 'Ratio of successful requests out of total'
    +' requests, where successful requests are calculated as 2xx, 3xx or 404'
    +' HTTP status codes';
    var prepare_opts = function(opt){
        return opt.map(function(o){ return {key: o, value: o}; }); };
    $success_rate.listen();
    $proxy_stats.listen();
    $scope.$on('$destroy', function(){
        $success_rate.stop_listening();
        $proxy_stats.stop_listening();
    });
    var iface_opts = [], zone_opts = [];
    var country_opts = [], cities_opts = {};
    var pool_type_opts = [], dns_opts = [], log_opts = [], debug_opts = [];
    var opt_columns = [
        {
            key: 'port',
            title: 'Port',
        },
        {
            key: '_status',
            title: 'Status',
            type: 'status',
        },
        {
            key: 'iface',
            title: 'Interface',
            type: 'options',
            options: function(){ return iface_opts; },
        },
        {
            key: 'multiply',
            title: 'Multiple',
            type: 'number',
        },
        {
            key: 'history',
            title: 'History',
            type: 'boolean',
        },
        {
            key: 'ssl',
            title: 'SSL analyzing',
            type: 'boolean',
        },
        {
            key: 'socks',
            title: 'SOCKS port',
            type: 'number',
            check: check_number,
        },
        {
            key: 'zone',
            title: 'Zone',
            type: 'options',
            options: function(){ return zone_opts; },
        },
        {
            key: 'secure_proxy',
            title: 'SSL for super proxy',
            type: 'boolean',
        },
        {
            key: 'country',
            title: 'Country',
            type: 'options',
            options: function(proxy){
                if (proxy&&proxy.zone=='static')
                {
                    return country_opts.filter(function(c){
                        return ['', 'br', 'de', 'gb', 'au', 'us']
                            .includes(c.value);
                    });
                }
                return country_opts;
            },
        },
        {
            key: 'city',
            title: 'City',
            type: 'autocomplete',
            check: function(){ return true; },
            options: function(proxy, view_val){
                var cities = load_cities(proxy);
                if (!view_val)
                    return cities;
                return cities.filter(function(c){
                    return c.value.toLowerCase().startsWith(
                        view_val.toLowerCase());
                });
            },
        },
        {
            key: 'asn',
            title: 'ASN',
            type: 'number',
            check: function(v){ return check_number(v) && v<400000; },
        },
        {
            key: 'ip',
            title: 'Datacenter IP',
            type: 'text',
            check: function(v){
                if (!(v = v.trim()))
                    return true;
                var m = v.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
                if (!m)
                    return false;
                for (var i = 1; i<=4; i++)
                {
                    if (m[i]!=='0' && m[i].charAt(0)=='0' || m[i]>255)
                        return false;
                }
                return true;
            },
        },
        {
            key: 'vip',
            title: 'VIP',
            type: 'number',
            check: function(v){ return true; },
        },
        {
            key: 'max_requests',
            title: 'Max requests',
            type: 'text',
            check: function(v){ return !v || check_by_re(/^\d+(:\d*)?$/, v); },
        },
        {
            key: 'session_duration',
            title: 'Session duration (sec)',
            type: 'text',
            check: function(v){ return !v || check_by_re(/^\d+(:\d*)?$/, v); },
        },
        {
            key: 'pool_size',
            title: 'Pool size',
            type: 'number',
            check: function(v){ return !v || check_number(v); },
        },
        {
            key: 'pool_type',
            title: 'Pool type',
            type: 'options',
            options: function(){ return pool_type_opts; },
        },
        {
            key: 'sticky_ip',
            title: 'Sticky IP',
            type: 'boolean',
        },
        {
            key: 'keep_alive',
            title: 'Keep-alive',
            type: 'number',
            check: function(v){ return !v || check_number(v); },
        },
        {
            key: 'seed',
            title: 'Seed',
            type: 'text',
            check: function(v){ return !v || check_by_re(/^[^\.\-]*$/, v); },
        },
        {
            key: 'session',
            title: 'Session',
            type: 'text',
            check: function(v){ return !v || check_by_re(/^[^\.\-]*$/, v); },
        },
        {
            key: 'allow_proxy_auth',
            title: 'Allow request authentication',
            type: 'boolean',
        },
        {
            key: 'session_init_timeout',
            title: 'Session init timeout (sec)',
            type: 'number',
            check: function(v){ return !v ||check_number(v); },
        },
        {
            key: 'proxy_count',
            title: 'Min number of super proxies',
            type: 'number',
            check: function(v){ return !v ||check_number(v); },
        },
        {
            key: 'race_reqs',
            title: 'Race request via different super proxies and take the'
            +' fastest',
            type: 'number',
            check: function(v){ return !v ||check_number(v); },
        },
        {
            key: 'dns',
            title: 'DNS',
            type: 'options',
            options: function(){ return dns_opts; },
        },
        {
            key: 'log',
            title: 'Log Level',
            type: 'options',
            options: function(){ return log_opts; },
        },
        {
            key: 'proxy_switch',
            title: 'Autoswitch super proxy on failure',
            type: 'number',
            check: function(v){ return !v || check_number(v); },
        },
        {
            key: 'throttle',
            title: 'Throttle concurrent connections',
            type: 'number',
            check: function(v){ return !v || check_number(v); },
        },
        {
            key: 'request_timeout',
            title: 'Request timeout (sec)',
            type: 'number',
            check: function(v){ return !v || check_number(v); },
        },
        {
            key: 'debug',
            title: 'Debug info',
            type: 'options',
            options: function(){ return debug_opts; },
        },
        {
            key: 'null_response',
            title: 'NULL response',
            type: 'text',
            check: check_reg_exp,
        },
        {
            key: 'bypass_proxy',
            title: 'Bypass proxy',
            type: 'text',
            check: check_reg_exp,
        },
        {
            key: 'direct_include',
            title: 'Direct include',
            type: 'text',
            check: check_reg_exp,
        },
        {
            key: 'direct_exclude',
            title: 'Direct exclude',
            type: 'text',
            check: check_reg_exp,
        },
        {
            key: 'success_rate',
            title: 'Success rate',
            type: 'success_rate',
        }
    ];
    var default_cols = {
        port: true,
        _status: true,
        zone: true,
        country: true,
        city: true,
        success_rate: true,
    };
    $scope.cols_conf = JSON.parse(
        $window.localStorage.getItem('columns'))||_.cloneDeep(default_cols);
    $scope.$watch('cols_conf', function(){
        $scope.columns = opt_columns.filter(function(col){
            return col.key.match(/^_/) || $scope.cols_conf[col.key]; });
    }, true);
    var apply_consts = function(data){
        iface_opts = data.iface.values;
        zone_opts = (data.zone.values||[]).filter(z=>{
            const plan = z.plans && z.plans.slice(-1)[0] || {};
            return !plan.archive && !plan.disable;
        });
        pool_type_opts = data.pool_type.values;
        dns_opts = prepare_opts(data.dns.values);
        log_opts = data.log.values;
        debug_opts = data.debug.values;
    };
    setdb.on('head.locations', locations=>{
        if (!locations)
            return;
        const countries = locations.countries.map(c=>(
            {key: c.country_name, value: c.country_id}));
        country_opts = [
            {key: 'Default (Any)', value: ''},
            {key: 'Any', value: '*'}
        ].concat(countries);
    });
    $scope.$on('consts', function(e, data){ apply_consts(data.proxy); });
    if ($scope.$root.consts)
        apply_consts($scope.$root.consts.proxy);
    $scope.zones = {};
    $scope.selected_proxies = {};
    $scope.showed_status_proxies = {};
    $scope.pagination = {page: 1, per_page: 10};
    $scope.set_page = function(){
        var page = $scope.pagination.page;
        var per_page = $scope.pagination.per_page;
        if (page < 1)
            page = 1;
        if (page*per_page>$scope.proxies.length)
            page = Math.ceil($scope.proxies.length/per_page);
        $scope.pagination.page = page;
    };
    $proxies.subscribe(function(proxies){
        $scope.proxies = proxies;
        $scope.set_page();
        proxies.forEach(function(p){
            $scope.showed_status_proxies[p.port] =
                $scope.showed_status_proxies[p.port]&&p._status_details.length;
        });
    });
    $scope.proxies_loading = function(){
        return !$scope.proxies || !$scope.consts || !$scope.defaults; };
    $scope.edit_proxy = proxy=>{
        $state.go('edit_proxy', {port: proxy.port}); };
    $scope.dup_proxies = proxy=>{
        $scope.$root.confirmation = {
            text: 'Are you sure you want to duplicate the proxy?',
            confirmed: ()=>{
                $http.post('/api/proxy_dup', {port: proxy.port}).then(()=>{
                    return $proxies.update();
                });
            },
        };
        $window.$('#confirmation').modal();
    };
    $scope.delete_proxies = function(proxy){
        $scope.$root.confirmation = {
            text: 'Are you sure you want to delete the proxy?',
            confirmed: function(){
                var selected = proxy ? [proxy] : $scope.get_selected_proxies();
                var promises = $scope.proxies
                    .filter(function(p){
                        return p.proxy_type=='persist'
                            && selected.includes(p.port);
                    }).map(function(p){
                        return $http.delete('/api/proxies/'+p.port); });
                $scope.selected_proxies = {};
                $q.all(promises).then(function(){ return $proxies.update(); });
            },
        };
        $window.$('#confirmation').modal();
        ga_event('page: proxies', 'click', 'delete proxy');
    };
    $scope.refresh_sessions = proxy=>{
        $http.post('/api/refresh_sessions/'+proxy.port)
        .then(function(){ return $proxies.update(); });
        proxy.get_status(true);
    };
    $scope.show_history = function(proxy){
        ga_event('page: proxies', 'click', 'show history');
        $scope.history_dialog = [{port: proxy.port}];
    };
    $scope.show_pool = function(proxy){
        ga_event('page: proxies', 'click', 'show pool');
        $scope.pool_dialog = [{
            port: proxy.port,
            sticky_ip: proxy.sticky_ip,
            pool_size: proxy.pool_size,
        }];
    };
    $scope.add_proxy_new = ()=>{ $('#add_proxy_modal').modal('show'); };
    $scope.get_static_country = function(proxy){
        var zone = proxy.zones[proxy.zone];
        if (!zone)
            return false;
        var plan = zone.plans[zone.plans.length-1];
        if (plan.type=='static')
            return plan.country||'any';
        if (plan.vip==1)
            return plan.vip_country||'any';
        return false;
    };
    $scope.edit_cols = function(){
        $scope.columns_dialog = [{
            columns: opt_columns.filter(function(col){
                return !col.key.match(/^_/);
            }),
            cols_conf: $scope.cols_conf,
            default_cols: default_cols,
        }];
        ga_event('page: proxies', 'click', 'edit columns');
    };
    $scope.download_csv = ()=>{
        const data = $scope.proxies.map(p=>['127.0.0.1:'+p.port]);
        ga_event('page: proxies', 'click', 'export_csv');
        filesaver.saveAs(csv.to_blob(data), 'proxies.csv');
    };
    $scope.success_rate_hover = function(rate){
        ga_event('page: proxies', 'hover', 'success_rate', rate); };
    $scope.inline_edit_click = function(proxy, col){
        if (proxy.proxy_type!='persist'
            || !$scope.is_valid_field(proxy, col.key)
            || $scope.get_static_country(proxy)&&col.key=='country')
        {
            return;
        }
        switch (col.type)
        {
        case 'number':
        case 'text':
        case 'autocomplete':
        case 'options': proxy.edited_field = col.key; break;
        case 'boolean':
            var config = _.cloneDeep(proxy.config);
            config[col.key] = !proxy[col.key];
            config.proxy_type = 'persist';
            $http.put('/api/proxies/'+proxy.port, {proxy: config}).then(
                function(){ $proxies.update(); });
            break;
        }
    };
    $scope.inline_edit_input = function(proxy, col, event){
        if (event.which==27)
            return $scope.inline_edit_blur(proxy, col);
        var v = event.currentTarget.value;
        var p = $window.$(event.currentTarget).closest('.proxies-table-input');
        if (col.check(v, proxy.config))
            p.removeClass('has-error');
        else
            return p.addClass('has-error');
        if (event.which!=13)
            return;
        v = v.trim();
        if (proxy.original&&proxy.original[col.key]!==undefined &&
            proxy.original[col.key].toString()==v)
        {
            return $scope.inline_edit_blur(proxy, col);
        }
        if (col.type=='number'&&v)
            v = +v;
        var config = _.cloneDeep(proxy.config);
        config[col.key] = v;
        config.proxy_type = 'persist';
        $http.post('/api/proxy_check/'+proxy.port, config)
        .then(function(res){
            var errors = res.data.filter(function(i){ return i.lvl=='err'; });
            if (!errors.length)
                return $http.put('/api/proxies/'+proxy.port, {proxy: config});
        })
        .then(function(res){
            if (res)
                $proxies.update();
        });
    };
    $scope.inline_edit_select = function(proxy, col, event){
        if (event.which==27)
            return $scope.inline_edit_blur(proxy, col);
    };
    $scope.inline_edit_set = function(proxy, col, v){
        if (proxy.original[col.key]===v||proxy.original[col.key]==v&&v!==true)
            return $scope.inline_edit_blur(proxy, col);
        var config = _.cloneDeep(proxy.config);
        config[col.key] = v;
        config.proxy_type = 'persist';
        if (col.key=='country')
            config.state = config.city = '';
        if (col.key=='state')
            config.city = '';
        if (col.key=='zone' && $scope.consts)
        {
            var zone;
            if (zone = $scope.consts.proxy.zone.values.find(
                _.matches({zone: v})))
            {
                config.password = zone.password;
                var plan = zone.plans[zone.plans.length-1];
                if (!plan.city)
                    config.state = config.city = '';
            }
        }
        $http.put('/api/proxies/'+proxy.port, {proxy: config}).then(
            function(){ $proxies.update(); });
    };
    $scope.inline_edit_blur = function(proxy, col){
        $timeout(function(){
            if (proxy.original)
                proxy.config[col.key] = proxy.original[col.key];
            if (proxy.edited_field == col.key)
                proxy.edited_field = '';
        }, 100);
    };
    $scope.inline_edit_start = function(proxy, col){
        if (!proxy.original)
            proxy.original = _.cloneDeep(proxy.config);
        if (col.key=='session'&&proxy.config.session===true)
            proxy.config.session='';
    };
    $scope.get_selected_proxies = function(){
        return Object.keys($scope.selected_proxies)
            .filter(function(p){ return $scope.selected_proxies[p]; })
            .map(function(p){ return +p; });
    };
    $scope.is_action_available = function(action, port){
        const proxies = $scope.get_selected_proxies()|| port ? [port] : [];
        if (!proxies.length)
            return false;
        if (port)
            return port.proxy_type=='persist';
        return !$scope.proxies.some(function(sp){
            return $scope.selected_proxies[sp.port] &&
                sp.proxy_type!='persist';
        });
    };
    $scope.option_key = (col, val)=>{
        const opt = col.options().find(o=>o.value==val);
        return opt&&opt.key;
    };
    $scope.get_country_state = (col, val, proxy)=>{
        const country = $scope.option_key(col, val);
        const state = proxy.state&&proxy.state.toUpperCase();
        if (!state)
            return country;
        return `${country} (${state})`;
    };
    $scope.toggle_proxy_status_details = function(proxy){
        if (proxy._status_details.length)
        {
            $scope.showed_status_proxies[proxy.port] =
                !$scope.showed_status_proxies[proxy.port];
        }
    };
    $scope.get_colspans = function(){
        for (var i = 0; i<$scope.columns.length; i++)
        {
            if ($scope.columns[i].key=='_status')
                return [i+1, $scope.columns.length-i+2];
        }
        return [0, 0];
    };
    $scope.get_column_tooltip = function(proxy, col){
        if (proxy.proxy_type != 'persist')
            return 'This proxy\'s settings cannot be changed';
        if (!$scope.is_valid_field(proxy, col.key))
        {
            return 'You don\'t have \''+ col.key+'\' permission.<br>'
            +'Please contact your success manager.';
        }
        if (col.key=='country'&&$scope.get_static_country(proxy))
        {
            return $scope.option_key(col, $scope.get_static_country(proxy))
                ||'Any country';
        }
        if (col.key=='country')
            return $scope.option_key(col, proxy[col.key]);
        if (col.key == 'session' && proxy.session === true)
                return 'Random';
        if (['city'].includes(col.key) &&
            [undefined, '', '*'].includes(proxy.country))
        {
            return 'Set the country first';
        }
        var config_val = proxy.config[col.key];
        var real_val = proxy[col.key];
        if (real_val&&real_val!==config_val)
            return 'Set non-default value';
        return 'Change value';
    };
    $scope.is_valid_field = function(proxy, name){
        if (!$scope.$root.consts)
            return true;
        return is_valid_field(proxy, name, $scope.$root.consts.proxy.zone);
    };
    $scope.starts_with = function(actual, expected){
        return expected.length>1 &&
            actual.toLowerCase().startsWith(expected.toLowerCase());
    };
    $scope.typeahead_on_select = function(proxy, col, item){
        if (col.key=='city')
        {
            var config = _.cloneDeep(proxy.config);
            if (item.value==''||item.value=='*')
                config.city = '';
            else
                config.city = item.key;
            config.state = item.region||'';
            $http.put('/api/proxies/'+proxy.port, {proxy: config}).then(
                function(){ $proxies.update(); });
        }
    };
    $scope.on_page_change = function(){
        $scope.selected_proxies = {}; };
    var load_cities = function(proxy){
        var country = proxy.country||''.toUpperCase();
        var state = proxy.state;
        if (!country||country=='*')
            return [];
        if (!cities_opts[country])
        {
            cities_opts[country] = [];
            $http.get('/api/cities/'+country).then(function(res){
                cities_opts[country] = res.data.map(function(city){
                    if (city.region)
                        city.value = city.value+' ('+city.region+')';
                    return city;
                });
                return cities_opts[country];
            });
        }
        var options = cities_opts[country];
        // XXX maximk: temporary disable filter by state
        if (0&&state&&state!='*')
        {
            options = options.filter(function(i){
                return i.region==state; });
        }
        return options;
    };
    $scope.react_component = req_stats;
    if ($stateParams.add_proxy ||
        qs_o.action && qs_o.action=='tutorial_add_proxy')
    {
        setTimeout($scope.add_proxy);
    }
}

module.controller('history', History);
History.$inject = ['$scope', '$http', '$window'];
function History($scope, $http, $window){
    $scope.hola_headers = [];
    $http.get('/api/hola_headers').then(function(h){
        $scope.hola_headers = h.data;
    });
    $scope.init = function(locals){
        var loader_delay = 100;
        var timestamp_changed_by_select = false;
        $scope.initial_loading = true;
        $scope.port = locals.port;
        $scope.show_modal = function(){ $window.$('#history').modal(); };
        $http.get('/api/history_context/'+locals.port).then(function(c){
            $scope.history_context = c.data;
        });
        $scope.periods = [
            {label: 'all time', value: '*'},
            {label: '1 year', value: {y: 1}},
            {label: '3 months', value: {M: 3}},
            {label: '2 months', value: {M: 2}},
            {label: '1 month', value: {M: 1}},
            {label: '1 week', value: {w: 1}},
            {label: '3 days', value: {d: 3}},
            {label: '1 day', value: {d: 1}},
            {label: 'custom', value: ''},
        ];
        $scope.fields = [
            {
                field: 'url',
                title: 'Url',
                type: 'string',
                filter_label: 'URL or substring',
            },
            {
                field: 'method',
                title: 'Method',
                type: 'options',
                filter_label: 'Request method',
            },
            {
                field: 'status_code',
                title: 'Code',
                type: 'number',
                filter_label: 'Response code',
            },
            {
                field: 'timestamp',
                title: 'Time',
                type: 'daterange',
            },
            {
                field: 'elapsed',
                title: 'Elapsed',
                type: 'numrange',
            },
            {
                field: 'country',
                title: 'Country',
                type: 'options',
                filter_label: 'Node country',
            },
            {
                field: 'super_proxy',
                title: 'Super Proxy',
                type: 'string',
                filter_label: 'Super proxy or substring',
            },
            {
                field: 'proxy_peer',
                title: 'Proxy Peer',
                type: 'string',
                filter_label: 'IP or substring',
            },
            {
                field: 'context',
                title: 'Context',
                type: 'options',
                filter_label: 'Request context',
            },
        ];
        $scope.sort_field = 'timestamp';
        $scope.sort_asc = false;
        $scope.virtual_filters = {period: $scope.periods[0].value};
        $scope.filters = {
            url: '',
            method: '',
            status_code: '',
            timestamp: '',
            timestamp_min: null,
            timestamp_max: null,
            elapsed: '',
            elapsed_min: '',
            elapsed_max: '',
            country: '',
            super_proxy: '',
            proxy_peer: '',
            context: '',
        };
        $scope.pagination = {
            page: 1,
            per_page: 10,
            total: 1,
        };
        $scope.update = function(export_type){
            var params = {sort: $scope.sort_field};
            if (!export_type)
            {
                params.limit = $scope.pagination.per_page;
                params.skip = ($scope.pagination.page-1)
                    *$scope.pagination.per_page;
            }
            if (!$scope.sort_asc)
                params.sort_desc = 1;
            if ($scope.filters.url)
                params.url = $scope.filters.url;
            if ($scope.filters.method)
                params.method = $scope.filters.method;
            if ($scope.filters.status_code)
                params.status_code = $scope.filters.status_code;
            if ($scope.filters.timestamp_min)
            {
                params.timestamp_min = moment($scope.filters.timestamp_min,
                    'YYYY/MM/DD').valueOf();
            }
            if ($scope.filters.timestamp_max)
            {
                params.timestamp_max = moment($scope.filters.timestamp_max,
                    'YYYY/MM/DD').add(1, 'd').valueOf();
            }
            if ($scope.filters.elapsed_min)
                params.elapsed_min = $scope.filters.elapsed_min;
            if ($scope.filters.elapsed_max)
                params.elapsed_max = $scope.filters.elapsed_max;
            if ($scope.filters.country)
                params.country = $scope.filters.country;
            if ($scope.filters.super_proxy)
                params.super_proxy = $scope.filters.super_proxy;
            if ($scope.filters.proxy_peer)
                params.proxy_peer = $scope.filters.proxy_peer;
            if ($scope.filters.context)
                params.context = $scope.filters.context;
            var params_arr = [];
            for (var param in params)
                params_arr.push(param+'='+encodeURIComponent(params[param]));
            var url = '/api/history';
            if (export_type=='har'||export_type=='csv')
                url += '_'+export_type;
            url += '/'+locals.port+'?'+params_arr.join('&');
            if (export_type)
                return $window.location = url;
            $scope.loading = +date();
            setTimeout(function(){ $scope.$apply(); }, loader_delay);
            $http.get(url).then(function(res){
                $scope.pagination.total_items = res.data.total;
                var history = res.data.items;
                $scope.initial_loading = false;
                $scope.loading = false;
                $scope.history = history.map(function(r){
                    var alerts = [];
                    var disabled_alerts = [];
                    var add_alert = function(alert){
                        if (localStorage.getItem(
                            'request-alert-disabled-'+alert.type))
                        {
                            disabled_alerts.push(alert);
                        }
                        else
                            alerts.push(alert);
                    };
                    var raw_headers = JSON.parse(r.request_headers);
                    var request_headers = {};
                    for (var h in raw_headers)
                        request_headers[h.toLowerCase()] = raw_headers[h];
                    r.request_headers = request_headers;
                    r.response_headers = JSON.parse(r.response_headers);
                    r.alerts = alerts;
                    r.disabled_alerts = disabled_alerts;
                    if (r.url
                        .match(/^(https?:\/\/)?\d+\.\d+\.\d+\.\d+[$\/\?:]/))
                    {
                        add_alert({
                            type: 'ip_url',
                            title: 'IP URL',
                            description: 'The url uses IP and not '
                                +'hostname, it will not be served from the'
                                +' proxy peer. It could mean a resolve '
                                +'configuration issue when using SOCKS.',
                        });
                    }
                    if (r.method=='CONNECT'
                        ||request_headers.host=='lumtest.com'
                        ||r.url.match(/^https?:\/\/lumtest.com[$\/\?]/))
                    {
                        return r;
                    }
                    if (!request_headers['user-agent'])
                    {
                        add_alert({
                            type: 'agent_empty',
                            title: 'Empty user agent',
                            description: 'The User-Agent header '
                                +'is not set to any value.',
                        });
                    }
                    else if (!request_headers['user-agent'].match(
                        /^Mozilla\//))
                    {
                        add_alert({
                            type: 'agent_suspicious',
                            title: 'Suspicious user agent',
                            description: 'The User-Agent header is set to '
                                +'a value not corresponding to any of the '
                                +'major web browsers.',
                        });
                    }
                    if (!request_headers.accept)
                    {
                        add_alert({
                            type: 'accept_empty',
                            title: 'Empty accept types',
                            description: 'The Accept header is not set to '
                                +'any value.',
                        });
                    }
                    if (!request_headers['accept-encoding'])
                    {
                        add_alert({
                            type: 'accept_encoding_empty',
                            title: 'Empty accept encoding',
                            description: 'The Accept-Encoding header is '
                                +'not set to any value.',
                        });
                    }
                    if (!request_headers['accept-language'])
                    {
                        add_alert({
                            type: 'accept_language_empty',
                            title: 'Empty accept language',
                            description: 'The Accept-Language header is '
                                +'not set to any value.',
                        });
                    }
                    if (request_headers.connection != 'keep-alive')
                    {
                        add_alert({
                            type: 'connection_suspicious',
                            title: 'Suspicious connection type',
                            description: 'The Connection header is not '
                                +'set to "keep-alive".',
                        });
                    }
                    if (r.method=='GET'
                        &&!r.url.match(/^https?:\/\/[^\/\?]+\/?$/)
                        &&!r.url.match(/[^\w]favicon[^\w]/)
                        &&!request_headers.referer)
                    {
                        add_alert({
                            type: 'referer_empty',
                            title: 'Empty referrer',
                            description: 'The Referer header is not set '
                                +'even though the requested URL is not '
                                +'the home page of the site.',
                        });
                    }
                    var sensitive_headers = [];
                    for (var i in $scope.hola_headers)
                    {
                        if (request_headers[$scope.hola_headers[i]])
                            sensitive_headers.push($scope.hola_headers[i]);
                    }
                    if (sensitive_headers.length)
                    {
                        add_alert({
                            type: 'sensitive_header',
                            title: 'Sensitive request header',
                            description: (sensitive_headers.length>1 ?
                                'There are sensitive request headers' :
                                'There is sensitive request header')
                                +' in the request: '
                                +sensitive_headers.join(', '),
                        });
                    }
                    return r;
                });
            });
        };
        $scope.show_loader = function(){
            return $scope.loading && date()-$scope.loading>=loader_delay; };
        $scope.sort = function(field){
            if ($scope.sort_field==field.field)
                $scope.sort_asc = !$scope.sort_asc;
            else
            {
                $scope.sort_field = field.field;
                $scope.sort_asc = true;
            }
            $scope.update();
        };
        $scope.filter = function(field){
            var options;
            if (field.field=='method')
            {
                options = ['', 'GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'COPY',
                    'HEAD', 'OPTIONS', 'LINK', 'UNLINK', 'PURGE', 'LOCK',
                    'UNLOCK', 'PROPFIND', 'VIEW', 'TRACE', 'CONNECT'].map(
                    function(e){ return {key: e, value: e}; }
                );
            }
            else if (field.field=='country')
                options = $scope.$root.consts.proxy.country.values;
            else if (field.field=='context')
                options = $scope.history_context;
            $scope.filter_dialog = [{
                field: field,
                filters: $scope.filters,
                update: $scope.update,
                options: options,
            }];
            setTimeout(function(){
                $window.$('#history_filter').one('shown.bs.modal', function(){
                    $window.$('#history_filter .history-filter-autofocus')
                    .select().focus();
                }).modal();
            }, 0);
        };
        $scope.filter_cancel = function(field){
            if (field.field=='elapsed')
            {
                $scope.filters.elapsed_min = '';
                $scope.filters.elapsed_max = '';
            }
            if (field.field=='timestamp')
            {
                $scope.filters.timestamp_min = null;
                $scope.filters.timestamp_max = null;
            }
            $scope.filters[field.field] = '';
            $scope.update();
        };
        $scope.toggle_prop = function(row, prop){
            row[prop] = !row[prop];
        };
        $scope.export_type = 'visible';
        $scope.disable_alert = function(row, alert){
            localStorage.setItem('request-alert-disabled-'+alert.type, 1);
            for (var i=0; i<row.alerts.length; i++)
            {
                if (row.alerts[i].type==alert.type)
                {
                    row.disabled_alerts.push(row.alerts.splice(i, 1)[0]);
                    break;
                }
            }
        };
        $scope.enable_alert = function(row, alert){
            localStorage.removeItem('request-alert-disabled-'+alert.type);
            for (var i=0; i<row.disabled_alerts.length; i++)
            {
                if (row.disabled_alerts[i].type==alert.type)
                {
                    row.alerts.push(row.disabled_alerts.splice(i, 1)[0]);
                    break;
                }
            }
        };
        $scope.on_period_change = function(){
            var period = $scope.virtual_filters.period;
            if (!period)
                return;
            if (period!='*')
            {
                var from = moment().subtract($scope.virtual_filters.period)
                .format('YYYY/MM/DD');
                var to = moment().format('YYYY/MM/DD');
                $scope.filters.timestamp_min = from;
                $scope.filters.timestamp_max = to;
                $scope.filters.timestamp = from+'-'+to;
            }
            else
            {
                $scope.filters.timestamp_min = null;
                $scope.filters.timestamp_max = null;
                $scope.filters.timestamp = '';
            }
            timestamp_changed_by_select = true;
            $scope.update();
        };
        $scope.$watch('filters.timestamp', function(after){
            if (!after)
                $scope.virtual_filters.period = '*';
            else if (!timestamp_changed_by_select)
                $scope.virtual_filters.period = '';
            timestamp_changed_by_select = false;
        });
        $scope.update();
    };
}

module.controller('history_filter', History_filter);
History_filter.$inject = ['$scope', '$window'];
function History_filter($scope, $window){
    $scope.init = function(locals){
        $scope.field = locals.field;
        var field = locals.field.field;
        var range = field=='elapsed'||field=='timestamp';
        $scope.value = {composite: locals.filters[field]};
        if (range)
        {
            $scope.value.min = locals.filters[field+'_min'];
            $scope.value.max = locals.filters[field+'_max'];
        }
        $scope.options = locals.options;
        $scope.keypress = function(event){
            if (event.which==13)
            {
                $scope.apply();
                $window.$('#history_filter').modal('hide');
            }
        };
        $scope.daterange = function(event){
            $window.$(event.currentTarget).closest('.input-group')
            .datepicker({
                autoclose: true,
                format: 'yyyy/mm/dd',
            }).datepicker('show');
        };
        $scope.apply = function(){
            if (range)
            {
                var display_min, display_max;
                display_min = $scope.value.min;
                display_max = $scope.value.max;
                if ($scope.value.min&&$scope.value.max)
                    $scope.value.composite = display_min+'-'+display_max;
                else if ($scope.value.min)
                    $scope.value.composite = 'From '+display_min;
                else if ($scope.value.max)
                    $scope.value.composite = 'Up to '+display_max;
                else
                    $scope.value.composite = '';
                locals.filters[field+'_min'] = $scope.value.min;
                locals.filters[field+'_max'] = $scope.value.max;
            }
            if ($scope.value.composite!=locals.filters[field])
            {
                locals.filters[field] = $scope.value.composite;
                locals.update();
            }
        };
    };
}

module.controller('pool', Pool);
Pool.$inject = ['$scope', '$http', '$window'];
function Pool($scope, $http, $window){
    $scope.init = function(locals){
        $scope.port = locals.port;
        $scope.pool_size = locals.pool_size;
        $scope.sticky_ip = locals.sticky_ip;
        $scope.pagination = {page: 1, per_page: 10};
        $scope.show_modal = function(){ $window.$('#pool').modal(); };
        $scope.update = function(refresh){
            $scope.pool = null;
            $http.get('/api/sessions/'+$scope.port+(refresh ? '?refresh' : ''))
            .then(function(res){
                $scope.pool = res.data.data;
            });
        };
        $scope.update();
    };
}

module.controller('columns', Columns);
Columns.$inject = ['$scope', '$window'];
function Columns($scope, $window){
    $scope.init = function(locals){
        $scope.columns = locals.columns;
        $scope.form = _.cloneDeep(locals.cols_conf);
        $scope.show_modal = function(){
            $window.$('#proxy-cols').modal();
        };
        $scope.save = function(config){
            $window.$('#proxy-cols').modal('hide');
            $window.localStorage.setItem('columns', JSON.stringify(config));
            for (var c in config)
                locals.cols_conf[c] = config[c];
        };
        $scope.all = function(){
            for (var c in $scope.columns)
                $scope.form[$scope.columns[c].key] = true;
        };
        $scope.none = function(){
            for (var c in $scope.columns)
                $scope.form[$scope.columns[c].key] = false;
        };
        $scope.default = function(){
            for (var c in $scope.columns)
            {
                $scope.form[$scope.columns[c].key] =
                    locals.default_cols[$scope.columns[c].key];
            }
        };
    };
}

module.filter('timestamp', timestamp_filter);
function timestamp_filter(){
    return function(timestamp){
        return moment(timestamp).format('YYYY/MM/DD HH:mm');
    };
}

module.filter('requests', requests_filter);
requests_filter.$inject = ['$filter'];
function requests_filter($filter){
    var number_filter = $filter('number');
    return function(requests, precision){
        if (!requests || isNaN(parseFloat(requests))
            || !isFinite(requests))
        {
            return '';
        }
        if (typeof precision==='undefined')
            precision = 0;
        return number_filter(requests, precision);
    };
}

module.filter('bytes', function(){
    return util.bytes_format;
});

module.filter('request', request_filter);
function request_filter(){
    return function(r){
        return '/tools?test='+encodeURIComponent(JSON.stringify({
            port: r.port,
            url: r.url,
            method: r.method,
            body: r.request_body,
            headers: r.request_headers,
        }));
    };
}

module.directive('customTooltip', ()=>({
    restrict: 'A',
    scope: {title: '@customTooltip'},
    link: (scope, element)=>{
        $(element).attr('title', scope.title).tooltip('fixTitle');
    },
}));

module.directive('initInputSelect', ['$window', function($window){
    return {
        restrict: 'A',
        link: function(scope, element, attrs){
            setTimeout(function(){
                element.select().focus();
            }, 100); // before changing check for input type=number in Firefox
        },
    };
}]);

module.directive('initSelectOpen', ['$window', function($window){
    return {
        restrict: 'A',
        link: function(scope, element, attrs){
            setTimeout(function(){
                element.focus();
            }, 100);
        },
    };
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

module.filter('shorten', shorten_filter);
shorten_filter.$inject = ['$filter'];
function shorten_filter($filter){
    return function(s, chars){
        if (s.length<=chars+2)
            return s;
        return s.substr(0, chars)+'...';
    };
}

angular.bootstrap(document, ['app']);
