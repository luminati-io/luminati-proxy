// LICENSE_CODE ZON ISC
'use strict'; /*jslint browser:true*/
/*global requirejs*/
(function(){

var google_cdn = '//ajax.googleapis.com/ajax/libs/';
var angular_cdn = google_cdn+'angularjs/1.5.5/';
var cdnjs = '//cdnjs.cloudflare.com/ajax/libs/';
var hutil = '//cdn.rawgit.com/hola/hutil/0.1.4/util/';
var config = {
    paths: {
        es6_shim: hutil+'es6_shim',
        moment: cdnjs+'moment.js/2.14.1/moment.min',
        angular: angular_cdn+'angular.min',
        'socket.io-client': '/socket.io/socket.io',
        'angular-chart':
            cdnjs+'angular-chart.js/1.0.0/angular-chart.min',
        'angular-moment':
            cdnjs+'angular-moment/0.10.3/angular-moment.min',
        chart: cdnjs+'Chart.js/2.1.4/Chart.bundle.min', // with moment.js
        lodash: cdnjs+'lodash.js/4.13.1/lodash.min',
    },
    shim: {
        angular: {exports: 'angular'},
        chart: {exports: 'Chart'},
    },
    map: {
        '*': {
            css: '//cdnjs.cloudflare.com/ajax/libs/require-css/0.1.8/'
            +'css.min.js',
        },
    },
};

var add_angular_module = function(opt){
    if (!opt.deps)
        opt.deps = ['angular'];
    else
        opt.deps.unshift('angular');
    var name = /\/([^\/]*?)(.min)?$/.exec(opt.url)[1];
    config.paths[name] = opt.url;
    config.shim[name] = {
        deps: opt.deps,
        exports: 'angular',
        init: function(angular){ return angular.module(opt.module); }
    };
};

add_angular_module({module: 'ui.router',
    url: cdnjs+'angular-ui-router/0.3.1/angular-ui-router.min'});
add_angular_module({module: 'ngAnimate',
    url: angular_cdn+'angular-animate.min'});
add_angular_module({module: 'ngAria',
    url: angular_cdn+'angular-aria.min'});
add_angular_module({module: 'ngMessages',
    url: angular_cdn+'angular-messages.min'});
add_angular_module({
    module: 'ngMaterial',
    url: google_cdn+'angular_material/1.1.0-rc.5/angular-material.min',
    deps: ['angular-aria', 'angular-messages', 'angular-animate']
});
add_angular_module({
    module: 'md.data.table',
    url: cdnjs+'angular-material-data-table/0.10.8/md-data-table.min',
    deps: ['angular-material']
});
requirejs.config(config);
requirejs(['./app']);

}());
