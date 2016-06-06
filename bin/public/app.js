define(['angular', 'angular-material', 'health_markers/health_markers',
    'proxies/proxies', 'css!/app'], function(angular){
    'use strict'; /*jslint browser:true*/
    var app = angular.module('lumLocal', ['ngMaterial',
        'lum-health-markers', 'lum-proxies']);
    angular.bootstrap(document, ['lumLocal']);
});
