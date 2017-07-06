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
        'ui-select': '/req/ui-select/dist/select.min',
        'ui-router': '/req/@uirouter/angularjs/release/angular-ui-router.min',
        'es6-shim': '/req/es6-shim/es6-shim',
        'hutil': '/req/hutil/util',
        'angular-google-analytics': '/req/angular-google-analytics/dist/'
            +'angular-google-analytics.min',
        react: '/req/react/dist/react',
        'react-dom': '/req/react-dom/dist/react-dom',
        'react-bootstrap': '/req/react-bootstrap/dist/react-bootstrap',
        axios: '/req/axios/dist/axios.min',
        animate: '/req/animate.css/animate.min',
        'regenerator-runtime': '/req/regenerator-runtime/runtime',
    },
    shim: {
        angular: {exports: 'angular'},
        bootstrap: {deps: ['jquery']},
        'angular-sanitize': {deps: ['angular']},
        'angular-ui-bootstrap': {deps: ['angular']},
        'ui-select': {deps: ['angular']},
        'ui-router': {deps: ['angular']},
        'react-dom': {deps: ['react']},
        'react-bootstrap': {deps: ['react']},
    },
    map: {
        '*': {
            _css: '/req/require-css/css.min.js',
            '/util': '/req/hutil/util',
        },
    },
};

requirejs.config(config);
requirejs(['app']);

}());
