'use strict'; /*jslint browser:true*/
/*global requirejs*/
(function(){

var google_cdn = '//ajax.googleapis.com/ajax/libs/';
var angular_cdn = google_cdn+'angularjs/1.5.5/';
var cdnjs = '//cdnjs.cloudflare.com/ajax/libs/';
requirejs.config({
    paths: {
        angular: angular_cdn+'angular.min',
        'angular-animate': angular_cdn+'angular-animate.min',
        'angular-aria': angular_cdn+'angular-aria.min',
        'angular-messages': angular_cdn+'angular-messages.min',
        'angular-material':
            google_cdn+'angular_material/1.1.0-rc2/angular-material.min',
        'angular-material-table':
            cdnjs+'angular-material-data-table/0.10.8/md-data-table.min',
        'angular-ui-router':
            cdnjs+'angular-ui-router/0.3.1/angular-ui-router.min',
        'socket.io-client': '/socket.io/socket.io',
        'angular-chart':
            cdnjs+'angular-chart.js/1.0.0-alpha6/angular-chart.min',
        chart: cdnjs+'Chart.js/2.1.4/Chart.bundle.min' // with moment.js
    },
    shim: { // XXX lee validate that module is loaded into angular
        angular: {exports: 'angular'},
        'angular-animate': {deps: ['angular'], exports: 'angular'},
        'angular-aria': {deps: ['angular'], exports: 'angular'},
        'angular-messages': {deps: ['angular'], exports: 'angular'},
        'angular-material': {deps: ['angular', 'angular-messages',
            'angular-aria', 'angular-animate'], exports: 'angular'},
        'angular-material-table': {deps: ['angular-material'],
            exports: 'angular'},
        'angular-ui-router': {deps: ['angular'], exports: 'angular'},
        chart: {exports: 'Chart'}
     },
    map: {
        '*': {
            css: '//cdnjs.cloudflare.com/ajax/libs/require-css/0.1.8/'
            +'css.min.js'
        }
    }
});
requirejs(['./app']);

}());
