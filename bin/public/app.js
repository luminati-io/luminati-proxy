'use strict'; /*jslint browser:true*/
/*global requirejs*/
var angular_path = '//ajax.googleapis.com/ajax/libs/angularjs/1.5.5/';
requirejs.config({
    paths: {
        angular: angular_path+'angular.min',
        'angular-animate': angular_path+'angular-animate.min',
        'angular-aria': angular_path+'angular-aria.min',
        'angular-messages': angular_path+'angular-messages.min',
        'angular-material':
            '//ajax.googleapis.com/ajax/libs/angular_material/1.1.0-rc2/'
            +'angular-material.min',
        'angular-material-table':
            '//cdnjs.cloudflare.com/ajax/libs/'
            +'angular-material-data-table/0.10.8/md-data-table.min',
        'socket.io-client': '/socket.io/socket.io'
    },
    shim: {
        angular: {exports: 'angular'},
        'angular-animate': {deps: ['angular'],
            exports: 'angular.module("ngAnimate")'},
        'angular-aria': {deps: ['angular'], exports: 'angular'},
        'angular-messages': {deps: ['angular'], exports: 'angular'},
        'angular-material': {deps: ['angular', 'angular-messages',
            'angular-aria', 'angular-animate'], exports: 'angular'},
        'angular-material-table': {deps: ['angular-material'],
            exports: 'angular'}
     },
    map: {
        '*': {
            css: '//cdnjs.cloudflare.com/ajax/libs/require-css/0.1.8/'
            +'css.min.js'
        }
    }
});
requirejs(['angular', 'angular-material', 'health_markers/health_markers',
    'proxies/proxies', 'css!/app'],
function(angular){
    var app = angular.module('lumLocal', ['ngMaterial', 'lum-health-markers',
        'lum-proxies']);
    angular.bootstrap(document, ['lumLocal']);
});
