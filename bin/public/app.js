// LICENSE_CODE ZON ISC
'use strict'; /*jslint browser:true*/
define(['angular', 'angular-material', 'angular-ui-router', 'util',
    'proxies/proxies', 'zones/zones', 'css!/app'],
    function(angular){

var app = angular.module('lumLocal', ['ngMaterial', 'ui.router', 'lum-util',
    'lum-proxies', 'lum-zones']);
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
    .state('create', {
        url: '/create',
        templateUrl: './create/'
    })
    .state('zones', {
        url: '/zones',
        templateUrl: './zones/'
    });
}

app.factory('version', VersionService);
VersionService.$inject = ['get_json', '$q'];
function VersionService(get_json, $q){
    return {
        current: get_json('/version.json'),
        latest: get_json('https://raw.githubusercontent.com/luminati-io/'+
            'luminati-proxy/master/package.json')
    };
}

app.controller('version', VersionController);
VersionController.$inject = ['version'];
function VersionController(version){
    var vm = this;
    version.current.then(function(current){
        vm.current = current.version;

        version.latest.then(function(latest){
            vm.latest = latest.version;
            vm.need_upgrade = (vm.latest!=vm.current);
        });
    });
}

app.run(['$rootScope', '$http', '$location', '$state', 'get_json',
    function($scope, $http, $location, $state, get_json)
{
    get_json('/api/creds').then(function(res){
        var creds = res.data;
        if ($location.$$path=='/cred' && creds.password &&
            creds.customer)
        {
            $state.go('create');
        }
    });
    $scope.save_creds = function(customer, password){
        $http.post('/api/creds', {customer: customer, password: password})
        .then(function(res){
            $state.go('create');
        }, function(res){});
    };
    $scope.form_data = {};
    $scope.submit = function(){
        $http.post('/api/create', $scope.form_data)
        .then(function(res){ $state.go('proxies'); });
    };
}]);

angular.bootstrap(document, ['lumLocal']);

});
