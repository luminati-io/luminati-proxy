// LICENSE_CODE ZON ISC
'use strict'; /*jslint browser:true*/
define(['angular', 'angular-material', 'angular-ui-router', 'util',
    'proxies/proxies', 'zones/zones', 'version/version', 'cred/cred',
    'consts/consts', 'css!/app'],
function(angular){

var module = angular.module('lumLocal', ['ngMaterial', 'ui.router', 'lum-util',
    'lum-proxies', 'lum-zones', 'lum-version', 'lum-cred']);
module.config(route_config);
route_config.$inject = ['$stateProvider', '$urlRouterProvider'];
function route_config($stateProvider, $urlRouterProvider){
    $urlRouterProvider.otherwise('/proxies');
    $stateProvider.state('proxies', {
        url: '/proxies',
        templateUrl: './proxies/',
    })
    .state('cred', {
        url: '/cred',
        templateUrl: './cred/',
    })
    .state('zones', {
        url: '/zones',
        templateUrl: './zones/',
    });
}

angular.bootstrap(document, ['lumLocal']);

});
