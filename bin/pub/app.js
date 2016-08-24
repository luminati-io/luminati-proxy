// LICENSE_CODE ZON ISC
'use strict'; /*jslint browser:true*/
define(['angular', 'angular-material', 'angular-ui-router', 'util',
    'proxies', 'info', 'version', 'cred', '_css!css/app', 'angular-chart',
    'angular-moment'],
function(angular){

var module = angular.module('lumLocal', ['ngMaterial', 'ui.router', 'lum-util',
    'lum-proxies', 'lum-info', 'lum-version', 'lum-cred', 'angularMoment']);
module.config(route_config);
function route_config($stateProvider, $urlRouterProvider){
    $urlRouterProvider.otherwise('/proxies');
    $stateProvider.state('proxies', {
        url: '/proxies',
        templateUrl: '/proxies.html',
    })
    .state('cred', {
        url: '/cred',
        templateUrl: '/cred.html',
    })
    .state('info', {
        url: '/info',
        templateUrl: '/info.html',
    });
}

module.config(function(ChartJsProvider){
    window.Chart.defaults.global.colors = ['#803690', '#00ADF9', '#46BFBD',
        '#FDB45C', '#949FB1', '#4D5360'];
});

module.run(function($rootScope, get_json, $state){
    get_json('/api/creds').then(function(auth){
        $rootScope.login = auth.customer;
    });
    $rootScope.$on('$stateChangeSuccess', function(event, current){
        $rootScope.current_state = current.name;
    });
});

angular.bootstrap(document, ['lumLocal']);

});
