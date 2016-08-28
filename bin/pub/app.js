// LICENSE_CODE ZON ISC
'use strict'; /*jslint browser:true*/
define(['angular', 'angular-material', 'angular-ui-router', 'util',
    'proxy', 'info', 'version', 'cred', '_css!css/app', 'angular-chart',
    'angular-moment'],
function(angular){

var module = angular.module('app', ['ngMaterial', 'ui.router', 'util', 'proxy',
    'info', 'version', 'cred', 'angularMoment']);
module.config(route_config);
function route_config($stateProvider, $urlRouterProvider){
    $urlRouterProvider.otherwise('/cred');
    $stateProvider.state('proxy', {
        url: '/proxy',
        templateUrl: '/proxy.html',
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
    var check_creds = function(){
        get_json('/api/creds').then(function(auth){
            $rootScope.login = auth.customer;
            if (!$rootScope.login)
                setTimeout(check_creds, 2000);
            else
                setTimeout(function(){ window.location = '#proxy'; }, 1000);
        });
    };
    check_creds();
    $rootScope.$on('$stateChangeSuccess', function(event, current){
        $rootScope.current_state = current.name;
    });
});

angular.bootstrap(document, ['app']);

});
