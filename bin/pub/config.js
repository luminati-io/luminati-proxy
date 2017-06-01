// LICENSE_CODE ZON ISC
'use strict'; /*jslint browser:true*/
/*global requirejs*/
(function(){

var config = {
    paths: {
        jquery: '/req/jquery/dist/jquery.min',
        bootstrap: '/req/bootstrap/dist/js/bootstrap.min',
       'bootstrap-datepicker':
           '/req/bootstrap-datepicker/dist/js/bootstrap-datepicker.min',
        moment: '/req/moment/min/moment.min',
        angular: '/req/angular/angular.min',
        'angular-sanitize': '/req/angular-sanitize/angular-sanitize.min',
        lodash: '/req/lodash/lodash.min',
        codemirror: '/req/codemirror',
        'angular-ui-bootstrap': '/req/angular-ui-bootstrap/dist/ui-bootstrap',
        'es6-shim': '/req/es6-shim/es6-shim',
        hutil: '/req/hutil',
        'angular-google-analytics': '/req/angular-google-analytics/dist/'
            +'angular-google-analytics.min',
    },
    shim: {
        angular: {exports: 'angular'},
        bootstrap: {deps: ['jquery']},
        'angular-sanitize': {deps: ['angular']},
        'angular-ui-bootstrap': {deps: ['angular']},
    },
    map: {
        '*': {
            _css: '/req/require-css/css.min.js',
        },
    },
};

requirejs.config(config);
requirejs(['app']);

}());
