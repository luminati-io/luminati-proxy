// LICENSE_CODE ZON ISC
'use strict'; /*jslint browser:true*/
define(['angular', 'angular-material', 'angular-ui-router', 'util',
    'proxies/proxies', 'zones/zones', 'version/version', 'css!/app'],
    function(angular){

var app = angular.module('lumLocal', ['ngMaterial', 'ui.router', 'lum-util',
    'lum-proxies', 'lum-zones', 'lum-version']);
app.config(route_config);
route_config.$inject = ['$stateProvider', '$urlRouterProvider'];
function route_config($stateProvider, $urlRouterProvider){
    $urlRouterProvider.otherwise('/cred');
    $stateProvider.state('proxies', {
        url: '/proxies',
        templateUrl: './proxies/'
    })
    .state('cred', {
        url: '/cred',
        templateUrl: './cred/'
    })
    .state('zones', {
        url: '/zones',
        templateUrl: './zones/'
    });
}

app.run(['$rootScope', '$http', '$location', '$state', 'get_json',
    function($scope, $http, $location, $state, get_json)
{
    get_json('/api/creds').then(function(res){
        var creds = res.data;
        if ($location.$$path=='/cred' && creds.password && creds.customer)
            $state.go('proxies');
    });
    $scope.save_creds = function(customer, password){
        $http.post('/api/creds', {customer: customer, password: password})
        .then(function(res){
            $state.go('proxies');
        }, function(res){});
    };
}]);

angular.bootstrap(document, ['lumLocal']);

});
