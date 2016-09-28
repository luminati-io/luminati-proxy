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
        'socket.io-client': '/socket.io/socket.io',
        'angular-chart': '/req/angular-chart.js/dist/angular-chart.min',
        chart: '/req/chart.js/dist/Chart.bundle.min', // with moment.js
        lodash: '/req/lodash/lodash.min',
        codemirror: '/req/codemirror',
    },
    shim: {
        angular: {exports: 'angular'},
        chart: {exports: 'Chart'},
        bootstrap: {deps: ['jquery']},
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
