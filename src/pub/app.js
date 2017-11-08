// LICENSE_CODE ZON ISC
'use strict'; /*jslint browser:true, es6:true*/
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
import req_stats from './stats/stats.js';
import status_codes from './stats/status_codes.js';
import status_codes_detail from './stats/status_codes_detail.js';
import domains from './stats/domains.js';
import domains_detail from './stats/domains_detail.js';
import protocols from './stats/protocols.js';
import intro from './intro/index.js';
import protocols_detail from './stats/protocols_detail.js';
import messages from './messages.js';
import util from './util.js';
import React from 'react';
import ReactDOM from 'react-dom';
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

const url_o = zurl.parse(document.location.href);
const qs_o = zurl.qs_parse((url_o.search||'').substr(1));

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
    $uibTooltipProvider.options({placement: 'bottom'});
    _analytics_provider.delayScriptTag(true);
    analytics_provider = _analytics_provider;

    $uiRouter.urlService.rules.otherwise({state: 'settings'});

    var state_registry = $uiRouter.stateRegistry;
    state_registry.register({
        name: 'app',
        redirectTo: 'settings',
        controller: 'root',
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
        template: `<div react-view=react_component state-props=code
        class=container></div>`,
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
        template: `<div react-view=react_component state-props=domain
        class=container></div>`,
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
        template: `<div react-view=react_component state-props=protocol
        class=container></div>`,
        controller: function($scope){
            $scope.react_component = protocols_detail; },
    });
    state_registry.register({
        name: 'intro',
        parent: 'app',
        url: '/intro',
        template: '<div react-view=react_component></div>',
        controller: function($scope){ $scope.react_component = intro; },
    });
}]);

module.run(function($rootScope, $http, $window, $transitions, $q, Analytics,
    $timeout)
{
    var logged_in_resolver = $q.defer();
    $rootScope.logged_in = logged_in_resolver.promise;
    $transitions.onBefore({to: function(state){
        $timeout(function(){
            $rootScope.hide_quickstart = !!(state.data||{}).hide_quickstart;
        });
        return !['app', 'faq'].includes(state.name);
    }}, function(transition){
        return $q(function(resolve, reject){
            $q.resolve($rootScope.logged_in).then(function(logged_in){
                if (logged_in)
                {
                    if (!$window.localStorage.getItem('quickstart-intro')
                        && $window.localStorage.getItem('quickstart')
                            !='dismissed')
                    {
                        $window.localStorage.setItem('quickstart-intro', true);
                        return resolve(transition.router.stateService.target(
                                'intro'));
                    }
                    if (transition.to().name!='settings')
                        return resolve(true);
                    return resolve(transition.router.stateService.target(
                            'proxies', undefined, {location: true}));
                }
                if (transition.to().name=='settings')
                    return resolve(true);
                return resolve(transition.router.stateService.target(
                    'settings', undefined, {location: false}));
            });
        });
    });
    $http.get('/api/mode').then(function(data){
        var logged_in = data.data.logged_in;
        logged_in_resolver.resolve(logged_in);
        if (logged_in)
            $window.localStorage.setItem('quickstart-creds', true);
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
        var get_status = function(force){
            var proxy = this;
            if (!proxy._status_call || force)
            {
                var url = '/api/proxy_status/'+proxy.port;
                if (proxy.proxy_type!='duplicate')
                    url += '?with_details';
                proxy._status_call = $http.get(url);
            }
            this._status_call.then(function(res){
                if (res.data.status=='ok')
                {
                    proxy._status = 'ok';
                    proxy._status_details = res.data.status_details||[];
                }
                else
                {
                    proxy._status = 'error';
                    var errors = res.data.status_details.filter(function(s){
                        return s.lvl=='err'; });
                    proxy._status_details = errors.length ? errors
                        : [{lvl: 'err', msg: res.data.status}];
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
            return proxies;
        });
    }
    function trigger(){
        listeners.forEach(function(cb){ cb(service.proxies); });
    }
}

module.factory('$www_lum', www_lum_factory);
www_lum_factory.$inject = ['$http', '$timeout'];

function www_lum_factory($http, $timeout){
    let conf = {};
    let is_listening = false;
    let get_timeout;
    const www_lum_poll_interval = 500000;
    poll();
    return {conf, listen, stop_listening, combine_presets};

    function listen(){
        if (is_listening)
            return;
        is_listening = true;
        poll();
    }

    function stop_listening(){
        is_listening = false;
        if (get_timeout)
            $timeout.cancel(get_timeout);
    }

    function combine_presets(_presets){
        let www_presets = (conf.presets||[])
        .reduce((prs, p)=>{
            let np = _.cloneDeep(p);
            np.set = opt=>_.extend(opt, p.set);
            np.check = ()=>true;
            prs[np.key] = np;
            return prs;
        }, _.cloneDeep(_presets));
        return www_presets;
    }

    function poll(){
        get_www_lum().then(res=>{
            _.extend(conf, res);
            get_timeout = $timeout(poll, www_lum_poll_interval);
        });
    }
    function get_www_lum(){
        return $http.get('/api/www_lpm')
        .then(res=>res.data);
    }
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
                p.success_rate = (rstat.total==0 ? 0
                    : rstat.success/rstat.total*100);
                p.success_rate = p.success_rate.toFixed(0);
                return p;
            });
            $proxies.trigger();
        });
    }
}

module.controller('root', ['$rootScope', '$scope', '$http', '$window',
    '$state', '$transitions',
function($rootScope, $scope, $http, $window, $state, $transitions){
    $scope.messages = messages;
    $scope.sections = [
        {name: 'settings', title: 'Settings'},
        {name: 'proxies', title: 'Proxies'},
        {name: 'zones', title: 'Zones'},
        {name: 'tools', title: 'Tools'},
        {name: 'faq', title: 'FAQ'},
        {name: 'intro', Title: 'Intro'},
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
        if (!$rootScope.settings.request_disallowed&&
            !$rootScope.settings.customer)
        {
            if (!$window.localStorage.getItem('quickstart'))
                $window.localStorage.setItem('quickstart', 'show');
        }
    });
    $http.get('/api/ip').then(function(ip){
        $scope.ip = ip.data.ip;
    });
    $http.get('/api/version').then(function(version){
        $scope.ver_cur = version.data.version;
    });
    $http.get('/api/last_version').then(function(version){
        $scope.ver_last = version.data;
    });
    $http.get('/api/consts').then(function(consts){
        $rootScope.consts = consts.data;
        $scope.$broadcast('consts', consts.data);
    });
    $http.get('/api/node_version').then(function(node){
        $scope.ver_node = node.data;
    });
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
    $scope.is_upgradable = function(){
        if (!($scope.ver_node&&$scope.ver_node.is_electron)&&!is_electron
            &&$scope.ver_last&& $scope.ver_last.newer)
        {
            var version = $window.localStorage.getItem('dismiss_upgrade');
            return version ? $scope.ver_last.version>version : true;
        }
        return false;
    };
    $scope.dismiss_upgrade = function(){
        $window.localStorage.setItem('dismiss_upgrade',
            $scope.ver_last.version);
    };
    $scope.upgrade = function(){
        $scope.$root.confirmation = {
            text: 'The application will be upgraded and restarted.',
            confirmed: function(){
                $window.$('#upgrading').modal({backdrop: 'static',
                    keyboard: false});
                $scope.upgrading = true;
                $http.post('/api/upgrade').catch(function(){
                    $scope.upgrading = false;
                    $scope.upgrade_error = true;
                }).then(function(data){
                    $scope.upgrading = false;
                    $http.post('/api/restart').catch(function(){
                        // $scope.upgrade_error = true;
                        show_reload();
                        check_reload();
                    }).then(function(d){
                        show_reload();
                        check_reload();
                    });
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
    // XXX krzysztof/ovidiu: check if this is correct usage of promises
    $scope.logout = function(){
        $http.post('/api/logout').then(function cb(){
            $http.get('/api/config').catch(function(){ setTimeout(cb, 500); })
                .then(function(){ $window.location = '/'; });
        });
    };
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
    $scope.zone_click = function(name){
        ga_event('navbar', 'click', name);
    };
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
            $window.location.reload();
        }, function(){
            retry();
        });
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
            $window.$('#resolve-textarea').scrollTop(0).scrollLeft(0);
        }, 0);
    });
    $scope.cancel = function(){
        $window.$('#resolve-panel > .collapse').collapse('hide');
    };
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
    // XXX krzysztof/ovidiu: incorrect usage of promises
    var check_reload = function(){
        $http.get('/api/config').catch(
            function(){ setTimeout(check_reload, 500); })
        .then(function(){ $window.location.reload(); });
    };
    $scope.user_data = {username: '', password: ''};
    var token;
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
        $http.post('/api/creds_user', creds).then(function(d){
            if (d.data.customers)
            {
                $scope.saving_user = false;
                $scope.user_customers = d.data.customers;
                $scope.user_data.customer = $scope.user_customers[0];
            }
            else
                check_reload();
        }).catch(function(error){
            $scope.saving_user = false;
            $scope.user_error = error.data.error;
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
        $scope.whitelist = whitelist.data;
    });
    $http.get('/api/recent_ips').then(function(recent_ips){
        $scope.recent_ips = recent_ips.data;
    });
    $scope.edit_zone = function(zone){
        $window.location = 'https://luminati.io/cp/zones/'+zone;
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

module.controller('test', Test);
Test.$inject = ['$scope', '$http', '$filter', '$window'];
function Test($scope, $http, $filter, $window){
    if ($window.localStorage.getItem('quickstart-create-proxy'))
        $window.localStorage.setItem('quickstart-test-proxy', true);
    if (qs_o.action && qs_o.action=='test_proxy')
        $scope.expand = true;
    var preset = JSON.parse(decodeURIComponent(($window.location.search.match(
        /[?&]test=([^&]+)/)||['', 'null'])[1]));
    if (preset)
    {
        $scope.expand = true;
        $scope.proxy = ''+preset.port;
        $scope.url = preset.url;
        $scope.method = preset.method;
        $scope.body = preset.body;
    }
    else
    {
        $scope.method = 'GET';
        $scope.url = $scope.$root.settings.test_url;
    }
    $http.get('/api/proxies').then(function(proxies){
        $scope.proxies = [['0', 'No proxy']];
        proxies.data.sort(function(a, b){ return a.port>b.port ? 1 : -1; });
        for (var i=0; i<proxies.data.length; i++)
        {
            $scope.proxies.push(
                [''+proxies.data[i].port, ''+proxies.data[i].port]);
        }
        if (!$scope.proxy)
            $scope.proxy = $scope.proxies[1][0];
    });
    $scope.methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'COPY', 'HEAD',
        'OPTIONS', 'LINK', 'UNLINK', 'PURGE', 'LOCK', 'UNLOCK', 'PROPFIND',
        'VIEW'];
    $scope.request = {};
    $scope.go = function(proxy, url, method, headers, body){
        var headers_obj = {};
        headers.forEach(function(h){ headers_obj[h.key] = h.value; });
        var req = {
            method: 'POST',
            url: '/api/test/'+proxy,
            data: {
                url: url,
                method: method,
                headers: headers_obj,
                body: body,
            },
        };
        $scope.loading = true;
        $http(req).then(function(r){
            $scope.loading = false;
            r = r.data;
            if (!r.error)
            {
                r.response.headers = Object.keys(r.response.headers).sort()
                .map(function(key){
                    return [key, r.response.headers[key]];
                });
            }
            $scope.request = r;
        });
    };
    $scope.headers = preset&&preset.headers ? Object.keys(preset.headers).map(
        function(h){
        return {key: h, value: preset.headers[h]};
    }) : [];
    $scope.add_header = function(){
        $scope.headers.push({key: '', value: ''});
    };
    $scope.remove_header = function(index){
        $scope.headers.splice(index, 1);
    };
    $scope.reset = function(){
        $scope.headers = [];
    };
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
        if (!$scope.proxy)
            $scope.proxy = $scope.proxies[1][0];
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

var presets = {
    session_long: {
        title: 'Long single session (IP)',
        check: function(opt){ return !opt.pool_size && !opt.sticky_ipo
            && opt.session===true && opt.keep_alive; },
        set: function(opt){
            opt.pool_size = 0;
            opt.ips = [];
            opt.keep_alive = opt.keep_alive || 50;
            opt.pool_type = undefined;
            opt.sticky_ip = false;
            opt.session = true;
            if (opt.session===true)
                opt.seed = false;
        },
        support: {
            keep_alive: true,
            multiply: true,
            session_ducation: true,
            max_requests: true,
        },
    },
    session: {
        title: 'Single session (IP)',
        check: function(opt){ return !opt.pool_size && !opt.sticky_ip
            && opt.session===true && !opt.keep_alive; },
        set: function(opt){
            opt.pool_size = 0;
            opt.ips = [];
            opt.keep_alive = 0;
            opt.pool_type = undefined;
            opt.sticky_ip = false;
            opt.session = true;
            if (opt.session===true)
                opt.seed = false;
        },
        support: {
            multiply: true,
            session_duration: true,
            max_requests: true,
        },
    },
    sticky_ip: {
        title: 'Session (IP) per machine',
        check: function(opt){ return !opt.pool_size && opt.sticky_ip; },
        set: function(opt){
            opt.pool_size = 0;
            opt.ips = [];
            opt.pool_type = undefined;
            opt.sticky_ip = true;
            opt.session = undefined;
            opt.multiply = undefined;
        },
        support: {
            keep_alive: true,
            max_requests: true,
            session_duration: true,
            seed: true,
        },
    },
    sequential: {
        title: 'Sequential session (IP) pool',
        check: function(opt){ return opt.pool_size &&
            (!opt.pool_type || opt.pool_type=='sequential'); },
        set: function(opt){
            opt.pool_size = opt.pool_size || 1;
            opt.pool_type = 'sequential';
            opt.sticky_ip = undefined;
            opt.session = undefined;
        },
        support: {
            pool_size: true,
            keep_alive: true,
            max_requests: true,
            session_duration: true,
            multiply: true,
            seed: true,
        },
    },
    round_robin: {
        title: 'Round-robin (IP) pool',
        check: function(opt){ return opt.pool_size
            && opt.pool_type=='round-robin' && !opt.multiply; },
        set: function(opt){
            opt.pool_size = opt.pool_size || 1;
            opt.pool_type = 'round-robin';
            opt.sticky_ip = undefined;
            opt.session = undefined;
            opt.multiply = undefined;
        },
        support: {
            pool_size: true,
            keep_alive: true,
            max_requests: true,
            session_duration: true,
            seed: true,
        },
    },
    custom: {
        title: 'Custom',
        check: function(opt){ return true; },
        set: function(opt){},
        support: {
            session: true,
            sticky_ip: true,
            pool_size: true,
            pool_type: true,
            keep_alive: true,
            max_requests: true,
            session_duration: true,
            multiply: true,
            seed: true,
        },
    },
};
for (var k in presets)
    presets[k].key = k;

module.controller('proxies', Proxies);
Proxies.$inject = ['$scope', '$http', '$proxies', '$window', '$q', '$timeout',
    '$stateParams', '$success_rate', '$www_lum'];
function Proxies($scope, $http, $proxies, $window, $q, $timeout,
    $stateParams, $success_rate, $www_lum)
{
    var prepare_opts = function(opt){
        return opt.map(function(o){ return {key: o, value: o}; }); };
    $success_rate.listen();
    $www_lum.listen();
    $scope.$on('$destroy', function(){
        $success_rate.stop_listening();
        $www_lum.stop_listening();
    });
    var iface_opts = [], zone_opts = [];
    var country_opts = [], region_opts = {}, cities_opts = {};
    var pool_type_opts = [], dns_opts = [], log_opts = [], debug_opts = [];
    $scope.presets = presets;
    var opt_columns = [
        {
            key: 'port',
            title: 'Port',
            type: 'number',
            check: function(v, config){
                if (check_number(v) && v>=24000)
                {
                    var conflicts = $proxies.proxies.filter(function(proxy){
                        return proxy.port==v&&proxy.port!=config.port; });
                    return !conflicts.length;
                }
                return false;
            },
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
            key: 'state',
            title: 'State',
            type: 'options',
            options: function(proxy){ return load_regions(proxy.country); },
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
        state: true,
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
        zone_opts = data.zone.values;
        country_opts = data.country.values;
        pool_type_opts = data.pool_type.values;
        dns_opts = prepare_opts(data.dns.values);
        log_opts = data.log.values;
        debug_opts = data.debug.values;
    };
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
    $scope.refresh_sessions = function(proxy){
        $http.post('/api/refresh_sessions/'+proxy.port)
        .then(function(){ return $proxies.update(); });
    };
    $scope.show_history = function(proxy){
        $scope.history_dialog = [{port: proxy.port}];
    };
    $scope.show_pool = function(proxy){
        $scope.pool_dialog = [{
            port: proxy.port,
            sticky_ip: proxy.sticky_ip,
            pool_size: proxy.pool_size,
        }];
    };
    $scope.add_proxy = function(){
        $scope.proxy_dialog = [{proxy: {}}];
        ga_event('page: proxies', 'click', 'add proxy');
    };
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
    $scope.edit_proxy = function(duplicate, proxy){
        var port = proxy.port||$scope.get_selected_proxies()[0];
        proxy = proxy ? [proxy] : $scope.proxies.filter(function(p){
            return p.port==port; });
        $scope.proxy_dialog = [{proxy: proxy[0].config, duplicate: duplicate}];
        ga_event('page: proxies', 'click', 'edit proxy');
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
        ga_event('page: proxies', 'hover', 'success_rate', rate);
    };
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
        var proxies = $scope.get_selected_proxies()|| port ? [port] : [];
        if (!proxies.length)
            return false;
        if (action=='duplicate')
            return proxies.length==1;
        if (port)
            return port.proxy_type=='persist';
        return !$scope.proxies.some(function(sp){
            return $scope.selected_proxies[sp.port] &&
                sp.proxy_type!='persist';
        });
    };
    $scope.option_key = function(col, val){
        var opt = col.options().find(function(o){ return o.value==val; });
        return opt&&opt.key;
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
                return [i+1, $scope.columns.length-i+1];
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
        if (['state', 'city'].includes(col.key) &&
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
    var load_regions = function(country){
        if (!country||country=='*')
            return [];
        return region_opts[country] || (region_opts[country] =
            $http.get('/api/regions/'+country.toUpperCase()).then(function(r){
                return region_opts[country] = r.data; }));
    };
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
    if ($stateParams.add_proxy || qs_o.action && qs_o.action=='add_proxy')
        setTimeout($scope.add_proxy);
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

module.controller('proxy', Proxy);
Proxy.$inject = ['$scope', '$http', '$proxies', '$window', '$q', '$www_lum'];
function Proxy($scope, $http, $proxies, $window, $q, $www_lum){
    $scope.init = function(locals){
        var _presets = $www_lum.combine_presets(presets);
        var regions = {};
        var cities = {};
        $scope.consts = $scope.$root.consts.proxy;
        $scope.port = locals.duplicate ? '' : locals.proxy.port;
        var form = $scope.form = _.omit(_.cloneDeep(locals.proxy), 'rules');
        form.port = $scope.port;
        form.zone = form.zone||'';
        form.debug = form.debug||'';
        form.country = form.country||'';
        form.state = form.state||'';
        form.city = form.city||'';
        form.dns = form.dns||'';
        form.log = form.log||'';
        form.ips = form.ips||[];
        $scope.presets = _presets;
        if (_.isBoolean(form.rule))
            form.rule = {};
        $scope.extra = {
            reverse_lookup: '',
            reverse_lookup_dns: form.reverse_lookup_dns,
            reverse_lookup_file: form.reverse_lookup_file,
            reverse_lookup_values:
                (form.reverse_lookup_values||[]).join('\n'),
        };
        $scope.rule_actions = [{label: 'Retry request(up to 20 times)',
            value: 'retry', raw: {ban_ip: '60min', retry: true}}];
        $scope.rule_statuses = ['200 - Succeeded requests',
            '403 - Forbidden', '404 - Not found',
            '500 - Internal server error', '502 - Bad gateway',
            '503 - Service unavailable', '504 - Gateway timeout', 'Custom'];
        if (form.rule && form.rule.action)
        {
            form.rule.action = _.find($scope.rule_actions,
                {value: form.rule.action.value});
        }
        if ($scope.extra.reverse_lookup_dns)
            $scope.extra.reverse_lookup = 'dns';
        else if ($scope.extra.reverse_lookup_file)
            $scope.extra.reverse_lookup = 'file';
        else if ($scope.extra.reverse_lookup_values)
            $scope.extra.reverse_lookup = 'values';
        $scope.extra.whitelist_ips = (form.whitelist_ips||[]).join(',');
        $scope.status = {};
        var new_proxy = !form.port||form.port=='';
        if (new_proxy)
        {
            var port = 24000;
            var socks = form.socks;
            $scope.proxies.forEach(function(p){
                if (p.port >= port)
                    port = p.port+1;
                if (socks && p.socks==socks)
                    socks++;
            });
            form.port = port;
            form.socks = socks;
        }
        var def_proxy = form;
        if (new_proxy)
        {
            def_proxy = {};
            for (var key in $scope.consts)
            {
                if ($scope.consts[key].def!==undefined)
                    def_proxy[key] = $scope.consts[key].def;
            }
        }
        for (var p in _presets)
        {
            if (_presets[p].check(def_proxy))
            {
                form.preset = _presets[p];
                break;
            }
        }
        $scope.apply_preset = function(){
            form.applying_preset = true;
            form.preset.set(form);
            if (form.session===true)
            {
                form.session_random = true;
                form.session = '';
            }
            if (form.max_requests)
            {
                var max_requests = (''+form.max_requests).split(':');
                form.max_requests_start = +max_requests[0];
                form.max_requests_end = +max_requests[1];
            }
            if (!form.max_requests)
                form.max_requests_start = 0;
            if (form.session_duration)
            {
                var session_duration = (''+form.session_duration)
                    .split(':');
                form.duration_start = +session_duration[0];
                form.duration_end = +session_duration[1];
            }
            delete form.applying_preset;
        };
        $scope.apply_preset();
        $scope.form_errors = {};
        $scope.defaults = {};
        $http.get('/api/defaults').then(function(defaults){
            $scope.defaults = defaults.data;
        });
        $scope.regions = [];
        $scope.cities = [];
        $scope.beta_features = $scope.$root.beta_features;
        $scope.get_zones_names = function(){
            return Object.keys($scope.zones); };
        $scope.show_modal = function(){
            $window.$('#proxy').one('shown.bs.modal', function(){
                $window.$('#proxy-field-port').select().focus();
                $window.$('#proxy .panel-collapse').on('show.bs.collapse',
                    function(event){
                    var container = $window.$('#proxy .proxies-settings');
                    var opening = $window.$(event.currentTarget).closest(
                        '.panel');
                    var pre = opening.prevAll('.panel');
                    var top;
                    if (pre.length)
                    {
                        top = opening.position().top+container.scrollTop();
                        var closing = pre.find('.panel-collapse.in');
                        if (closing.length)
                            top -= closing.height();
                    }
                    else
                        top = 0;
                    container.animate({'scrollTop': top}, 250);
                });
            }).modal();
        };
        $scope.is_show_allocated_ips = function(){
            var zone = $scope.consts.zone.values.filter(function(z){
                return z.value==form.zone; })[0];
            var plan = (zone&&zone.plans||[]).slice(-1)[0];
            return (plan&&plan.type||zone&&zone.type)=='static';
        };
        $scope.show_allocated_ips = function(){
            var zone = form.zone;
            var keypass = form.password||'';
            var modals = $scope.$root;
            modals.allocated_ips = {
                ips: [],
                loading: true,
                random_ip: function(){
                    modals.allocated_ips.ips.forEach(function(item){
                        item.checked = false; });
                    form.ips = [];
                    form.pool_size = 0;
                },
                toggle_ip: function(item){
                    var index = form.ips.indexOf(item.ip);
                    if (item.checked && index<0)
                        form.ips.push(item.ip);
                    else if (!item.checked && index>-1)
                        form.ips.splice(index, 1);
                    form.pool_size = form.ips.length;
                },
                zone: zone,
            };
            $window.$('#allocated_ips').modal();
            $http.get('/api/allocated_ips?zone='+zone+'&key='+keypass)
            .then(function(res){
                form.ips = form.ips.filter(ip=>res.data.ips.includes(ip));
                modals.allocated_ips.ips = res.data.ips.map(function(ip_port){
                    var ip = ip_port.split(':')[0];
                    return {ip: ip, checked: form.ips.includes(ip)};
                });
                modals.allocated_ips.loading = false;
            });
        };
        $scope.binary_changed = function(proxy, field, value){
            proxy[field] = {'yes': true, 'no': false, 'default': ''}[value]; };
        var update_allowed_countries = function(){
            var countries = $scope.consts.country.values;
            $scope.allowed_countries = [];
            if (!countries)
                return;
            if (form.zone!='static')
                return $scope.allowed_countries = countries;
            $scope.allowed_countries = countries.filter(function(c){
                return ['', 'au', 'br', 'de', 'gb', 'us'].includes(c.value);
            });
        };
        $scope.update_regions_and_cities = function(is_init){
            if (!is_init)
                $scope.form.region = $scope.form.city = '';
            $scope.regions = [];
            $scope.cities = [];
            var country = ($scope.form.country||'').toUpperCase();
            if (!country||country=='*')
                return;
            if (regions[country])
                $scope.regions = regions[country];
            else
            {
                regions[country] = [];
                $http.get('/api/regions/'+country).then(function(res){
                    $scope.regions = regions[country] = res.data; });
            }
            if (cities[country])
                $scope.cities = cities[country];
            else
            {
                cities[country] = [];
                $http.get('/api/cities/'+country).then(function(res){
                    cities[country] = res.data.map(function(city){
                        if (city.region)
                            city.value = city.value+' ('+city.region+')';
                        return city;
                    });
                    $scope.cities = cities[country];
                    $scope.update_cities();
                });
            }
        };
        $scope.update_cities = function(){
            var country = $scope.form.country.toUpperCase();
            var state = $scope.form.state;
            if (state==''||state=='*')
            {
                $scope.form.city = '';
                $scope.cities = cities[country];
            }
            else
            {
                $scope.cities = cities[country].filter(function(item){
                    return !item.region || item.region==state; });
                var exist = $scope.cities.filter(function(item){
                    return item.key==$scope.form.city; }).length>0;
                if (!exist)
                    $scope.form.city = '';
            }
        };
        $scope.update_region_by_city = function(city){
            if (city.region)
                $scope.form.state = city.region;
            $scope.update_cities();
        };
        $scope.reset_rules = function(){
            $scope.form.rule = {};
            $scope.form.rules = {};
            $scope.form.delete_rules = true;
            ga_event('proxy_form', 'reset_rules');
        };
        $scope.$watch('form.zone', function(val, old){
            if (!$scope.consts || val==old)
                return;
            update_allowed_countries();
            var zone;
            if (zone = $scope.consts.zone.values.find(_.matches({zone: val})))
                form.password = zone.password;
        });
        $scope.$watchCollection('form', function(newv, oldv){
            function has_changed(f){
                var old = oldv&&oldv[f]||'';
                var val= newv&&newv[f]||'';
                return old!==val;
            }
            if (has_changed('preset'))
            {
                return ga_event('proxy_form', 'preset_change',
                    newv.preset.title);
            }
            if (newv.applying_preset)
                return;
            for (var f in _.extend({}, newv, oldv))
            {
                if (has_changed(f)&&f!='applying_preset'&&f!='rule')
                {
                    ga_event('proxy_form', f+'_change', f=='password'
                        ? 'redacted' : newv[f]);
                }
            }
        });
        $scope.$watchCollection('form.rule', function(newv, oldv){
            function has_changed(f){
                var old = oldv&&oldv[f]||'';
                var val= newv&&newv[f]||'';
                old = typeof old == 'object' ? old.value : old;
                val = typeof val == 'object' ? val.value : val;
                return old!==val;
            }
            if (_.isEmpty($scope.form.rule))
                return;
            var val;
            for (var f in _.extend({}, newv, oldv))
            {
                if (!has_changed(f))
                    continue;
                val = typeof newv[f] == 'object' ? newv[f].value: newv[f];
                ga_event('proxy_form', 'rule_'+f+'_change', val);
            }
        });
        $scope.save = function(model){
            var proxy = angular.copy(model);
            delete proxy.preset;
            for (var field in proxy)
            {
                if (!$scope.is_valid_field(field) || proxy[field]===null)
                    proxy[field] = '';
            }
            var make_int_range = function(start, end){
                var s = parseInt(start, 10)||0;
                var e = parseInt(end, 10)||0;
                return s&&e ? [s, e].join(':') : s||e;
            };
            var effective = function(prop){
                return proxy[prop]===undefined ?
                    $scope.defaults[prop] : proxy[prop];
            };
            if (proxy.session_random)
                proxy.session = true;
            proxy.max_requests = make_int_range(proxy.max_requests_start,
                proxy.max_requests_end);
            delete proxy.max_requests_start;
            delete proxy.max_requests_end;
            proxy.session_duration = make_int_range(proxy.duration_start,
                proxy.duration_end);
            delete proxy.duration_start;
            delete proxy.duration_end;
            proxy.history = effective('history');
            proxy.ssl = effective('ssl');
            proxy.max_requests = effective('max_requests');
            proxy.session_duration = effective('session_duration');
            proxy.keep_alive = effective('keep_alive');
            proxy.pool_size = effective('pool_size');
            proxy.proxy_type = 'persist';
            proxy.reverse_lookup_dns = '';
            proxy.reverse_lookup_file = '';
            proxy.reverse_lookup_values = '';
            if ($scope.extra.reverse_lookup=='dns')
                proxy.reverse_lookup_dns = true;
            if ($scope.extra.reverse_lookup=='file')
                proxy.reverse_lookup_file = $scope.extra.reverse_lookup_file;
            if ($scope.extra.reverse_lookup=='values')
            {
                proxy.reverse_lookup_values =
                    $scope.extra.reverse_lookup_values.split('\n');
            }
            proxy.whitelist_ips =
                $scope.extra.whitelist_ips.split(',').filter(Boolean);
            var reload;
            if (Object.keys(proxy.rule||{}).length)
            {
                if (!proxy.rule.url)
                    delete proxy.rule.url;
                proxy.rule = _.extend({
                    url: '**',
                    action: {}
                }, proxy.rule);
                var rule_status = proxy.rule.status == 'Custom'
                    ? proxy.rule.custom : proxy.rule.status;
                proxy.rules = {
                    post: [{
                        res: [{
                            head: true,
                            status: {
                                type: 'in',
                                arg: rule_status||''
                            },
                            action: proxy.rule.action.raw||{},
                        }],
                        url: proxy.rule.url+'/**'
                    }]
                };
                reload = true;
            }
            else
                delete proxy.rules;
            if (proxy.delete_rules)
                proxy.rules = {};
            delete proxy.delete_rules;
            model.preset.set(proxy);
            var edit = $scope.port&&!locals.duplicate;
            ga_event('proxy_form', 'proxy_'+(edit ? 'edit' : 'create'),
                'start');
            var save_inner = function(){
                $scope.status.type = 'warning';
                $scope.status.message = 'Saving the proxy...';
                var promise = edit
                    ? $http.put('/api/proxies/'+$scope.port, {proxy: proxy})
                    : $http.post('/api/proxies/', {proxy: proxy});
                var is_ok_cb = function(){
                    $window.$('#proxy').modal('hide');
                    $proxies.update();
                    if ($window.localStorage.getItem('quickstart-welcome'))
                    {
                        $window.localStorage.setItem('quickstart-'+
                            (edit ? 'edit' : 'create')+'-proxy', true);
                    }
                    ga_event('proxy_form', 'proxy_'+(edit ? 'edit' : 'create')
                        , 'ok');
                    return $http.post('/api/recheck')
                    .then(function(r){
                        if (r.data.login_failure)
                            $window.location = '/';
                    });
                };
                var is_not_ok_cb = function(res){
                    $scope.status.type = 'danger';
                    $scope.status.message = 'Error: '+res.data.status;
                    ga_event('proxy_form', 'proxy_'+(edit ? 'edit' : 'create')
                        , 'err');
                };
                promise
                    .then(function(){
                        if (reload)
                        {
                            $scope.status.type = 'warning';
                            $scope.status.message = 'Loading...';
                            return setTimeout(function(){
                                $window.location.reload(); }, 800);
                        }
                        $scope.status.type = 'warning';
                        $scope.status.message = 'Checking the proxy...';
                        return $http.get('/api/proxy_status/'+proxy.port);
                    })
                    .then(function(res){
                        if (res.data.status == 'ok')
                            return is_ok_cb(res);
                        return is_not_ok_cb(res);
                    });
            };
            var url = '/api/proxy_check'+(edit ? '/'+$scope.port : '');
            $http.post(url, proxy).then(function(res){
                $scope.form_errors = {};
                var warnings = [];
                angular.forEach(res.data, function(item){
                    if (item.lvl=='err')
                    {
                        var msg = item.msg;
                        if (item.field=='password' && msg==
                            'the provided password is not valid')
                        {
                            msg = 'Wrong password';
                        }
                        $scope.form_errors[item.field] = msg;
                    }
                    if (item.lvl=='warn')
                        warnings.push(item.msg);
                });
                if (Object.keys($scope.form_errors).length)
                    return;
                else if (warnings.length)
                {
                    $scope.$root.confirmation = {
                        text: 'Warning'+(warnings.length>1?'s':'')+':',
                        items: warnings,
                        confirmed: save_inner,
                    };
                    return $window.$('#confirmation').modal();
                }
                save_inner();
            });
        };
        $scope.is_valid_field = function(name){
            return is_valid_field($scope.form, name, $scope.consts.zone);
        };
        $scope.starts_with = function(actual, expected){
            return actual.toLowerCase().startsWith(expected.toLowerCase());
        };
        $scope.update_regions_and_cities(true);
        update_allowed_countries();
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
        scope: {view: '=reactView', props: '@stateProps'},
        link: function(scope, element, attrs){
            ReactDOM.render(React.createElement(scope.view,
                _.pick($state.params, (scope.props||'').split(' '))),
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
