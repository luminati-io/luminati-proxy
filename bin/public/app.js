define(['angular', 'angular-material', 'angular-ui-router',
    'proxies/proxies', 'zones/zones', 'css!/app'],
function(angular){
    'use strict'; /*jslint browser:true*/
    var app = angular.module('lumLocal', ['ngMaterial', 'ui.router',
        'lum-proxies', 'lum-zones']);

    app.config(routeConfig);
    routeConfig.$inject = ['$stateProvider', '$urlRouterProvider'];
    function routeConfig($stateProvider, $urlRouterProvider){
        $urlRouterProvider.otherwise('/proxies');
        $stateProvider.state('proxies', {
            url: '/proxies',
            templateUrl: './proxies/'
        })
        .state('zones', {
            url: '/zones',
            templateUrl: './zones/'
        });
    }

    angular.bootstrap(document, ['lumLocal']);
});
