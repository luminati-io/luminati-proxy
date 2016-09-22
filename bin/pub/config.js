// LICENSE_CODE ZON ISC
'use strict'; /*jslint browser:true*/
/*global requirejs*/
(function(){

var config = {
    paths: {
        jquery: '/jquery/jquery.min',
        bootstrap: '/bootstrap/js/bootstrap.min',
       'bootstrap-datepicker':
           '/bootstrap-datepicker/js/bootstrap-datepicker.min',
        moment: '/moment/moment.min',
        angular: '/angular.min',
        'socket.io-client': '/socket.io/socket.io',
        'angular-chart': '/angular-chartjs/angular-chart.min',
        chart: '/chartjs/Chart.bundle.min', // with moment.js
        lodash: '/lodash.min',
    },
    shim: {
        angular: {exports: 'angular'},
        chart: {exports: 'Chart'},
        bootstrap: {deps: ['jquery']},
    },
    map: {
        '*': {
            _css: '/css.min.js',
        },
    },
};

requirejs.config(config);
requirejs(['app']);

}());
