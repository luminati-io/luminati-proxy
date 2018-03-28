// LICENSE_CODE ZON ISC
'use strict'; /*jslint browser:true, react:true, es6:true*/
import 'ui-select/dist/select.css';
import 'bootstrap/dist/css/bootstrap.css';
import 'bootstrap-datepicker/dist/css/bootstrap-datepicker3.css';
import angular from 'angular';
import _ from 'lodash';
import moment from 'moment';
import date from 'hutil/util/date';
import zurl from 'hutil/util/url';
import setdb from 'hutil/util/setdb';
import etask from 'hutil/util/etask';
import ajax from 'hutil/util/ajax';
import zescape from 'hutil/util/escape';
import status_codes from './stats/status_codes.js';
import domains from './stats/domains.js';
import protocols from './stats/protocols.js';
import zreport_bug_modal from './report_bug.js';
import znotif_center from './notif_center.js';
import zedit_proxy from './edit_proxy.js';
import zhowto from './howto.js';
import zproxy_tester from './proxy_tester.js';
import zoverview from './overview.js';
import zconfig from './config.js';
import zlogs from './logs.js';
import zschema from './schema.js';
import util from './util.js';
import React from 'react';
import ReactDOM from 'react-dom';
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
import {presets} from './common.js';

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
        name: 'zones',
        parent: 'app',
        url: '/zones/{zone:string}',
        templateUrl: 'zones.html',
        params: {zone: {squash: true, value: null}},
    });
    state_registry.register({
        name: 'faq',
        parent: 'app',
        url: '/faq',
        templateUrl: 'faq.html',
    });
    state_registry.register({
        name: 'overview',
        parent: 'app',
        url: '/overview',
        template: '<div react-view=react_component></div>',
        controller: $scope=>{ $scope.react_component = zoverview; },
    });
    state_registry.register({
        name: 'status_codes',
        parent: 'app',
        url: '/status_codes',
        template: '<div react-view=react_component></div>',
        controller: $scope=>{ $scope.react_component = status_codes; },
    });
    state_registry.register({
        name: 'domains',
        parent: 'app',
        url: '/domains',
        template: '<div react-view=react_component></div>',
        controller: $scope=>{ $scope.react_component = domains; },
    });
    state_registry.register({
        name: 'protocols',
        parent: 'app',
        url: '/protocols',
        template: '<div react-view=react_component></div>',
        controller: $scope=>{ $scope.react_component = protocols; },
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
                if (transition.to().name!='settings')
                    return true;
                return transition.router.stateService.target(
                    'overview', undefined, {location: true});
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
            if (proxy.port==22225 && !(proxy.stats && proxy.stats.real_bw))
                return;
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
    const poll_interval = 2000;
    let sp, get_timeout;
    const _prepare_stats = data=>{
        return data.reduce((acc, el)=>{
            acc[el.port_id] = el;
            return acc;
        }, {});
    };
    const _track_stats = ()=>{
        if (!sp)
            return;
        sp.spawn(etask(function*(){
            const data = yield ajax.json({url: '/api/proxy_stats'});
            const stats_per_port = _prepare_stats(data.stats);
            $proxies.proxies = $proxies.proxies.map(p=>{
                if (''+p.port in stats_per_port)
                    p.stats = stats_per_port[p.port];
                else
                    p.stats = {bw: 0, real_bw: 0, reqs: 0};
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

module.controller('root', ['$rootScope', '$scope', '$http', '$window',
    '$state', '$transitions', '$timeout', '$proxies',
    ($rootScope, $scope, $http, $window, $state, $transitions, $timeout,
    $proxies)=>
{
    $scope.get_value = (proxy, key)=>_.get(proxy, key);
    $scope.sections = [
        {name: 'settings', title: 'Settings', navbar: false},
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
        $scope.subsection = section && section.name=='zones' &&
            transition.params().zone;
    });
    $scope.section = $scope.sections.find(function(s){
        return s.name==$state.$current.name; });
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
    etask(function*(){
        const locations = yield ajax.json({url: '/api/all_locations'});
        locations.countries_by_code = locations.countries
        .reduce((acc, e)=>({...acc, [e.country_id]: e.country_name}), {});
        setdb.set('head.locations', locations);
    });
    $http.get('/api/node_version').then(function(node){
        $scope.ver_node = node.data; });
    $proxies.update();
    setdb.set('head.callbacks.proxies.update', $proxies.update);
    setdb.set('head.callbacks.state.go', $state.go);
    $scope.$root.show_history = function(proxy){
        ga_event('page: proxies', 'click', 'show history');
        $scope.$root.history_dialog = [{port: proxy.port}];
    };
    setdb.set('head.callbacks.show_history', $scope.$root.show_history);
    setdb.set('head.root_scope', $scope.$root);
    window.setdb = setdb;
    window.to_state = $state.go;
    $scope.$root.presets = presets;
    $scope.$root.report_bug_modal = zreport_bug_modal;
    $scope.$root.schema_widget = zschema;
    $scope.$root.notif_center = znotif_center;
    const show_reload = function(){
        $('#restarting').modal({
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
        $('#confirmation').modal();
    };
    $scope.open_report_bug = ()=>{ $('#report_bug_modal').modal(); };
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
        $('#confirmation').modal();
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
                check_reload();
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

module.controller('history', History);
History.$inject = ['$scope', '$http', '$window', '$state'];
function History($scope, $http, $window, $state){
    $scope.hola_headers = [];
    $http.get('/api/hola_headers').then(h=>{ $scope.hola_headers = h.data; });
    $scope.init = function(locals){
        var loader_delay = 100;
        var timestamp_changed_by_select = false;
        $scope.initial_loading = true;
        $scope.port = locals.port;
        $scope.show_modal = function(){ $window.$('#history').modal(); };
        $http.get('/api/history_context/'+locals.port).then(c=>{
            $scope.history_context = c.data; });
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
        $scope.replay = req=>{
            $('.modal').modal('hide');
            setTimeout(()=>$state.go('proxy_tester',
                {url: req.url, port: req.port, method: req.method}), 500);
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

module.filter('bytes', ()=>util.bytes_format);

module.directive('customTooltip', ()=>({
    restrict: 'A',
    scope: {title: '@customTooltip'},
    link: (scope, element)=>{
        $(element).attr('title', scope.title).tooltip({container: 'body'});
        $(element).on('click', function(){ $(this).tooltip('hide'); });
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
