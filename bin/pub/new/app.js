// LICENSE_CODE ZON ISC
'use strict'; /*jslint browser:true*/
define(['angular', '_css!app'],
function(angular){

var module = angular.module('app', []);

module.run(function($rootScope, $window){
    $rootScope.section = $window.location.pathname.split('/').pop();
});

module.controller('root', root);
root.$inject = ['$rootScope', '$scope', '$http', '$window'];
function root($rootScope, $scope, $http, $window){
    $scope.sections = [
        {name: 'settings', title: 'Settings'},
        {name: 'zones', title: 'Zones'},
    ];
    for (var s in $scope.sections)
    {
        if ($scope.sections[s].name==$rootScope.section)
        {
            $scope.section = $scope.sections[s];
            break;
        }
    }
    $http.get('/api/creds').then(function(settings){
        $scope.settings = settings.data;
        if (!$scope.settings.customer&&$scope.section.name!='settings')
            $window.location = 'settings';
    });
    $http.get('/api/version').then(function(version){
        $scope.ver_cur = version.data.version;
    });
    $http.get('https://raw.githubusercontent.com/luminati-io/'
        +'luminati-proxy/master/package.json').then(function(version){
        $scope.ver_last = version.data.version;
    });
}

module.controller('settings', settings);
settings.$inject = ['$scope', '$http'];
function settings($scope, $http){
    $scope.save = function(){
        $scope.saving = true;
        $scope.error = false;
        $scope.saved = false;
        $http.post('/api/creds', {
            customer: $scope.$parent.settings.customer,
            password: $scope.$parent.settings.password,
            proxy: $scope.$parent.settings.proxy,
            proxy_port: $scope.$parent.settings.proxy_port,
        }).error(function(){
            $scope.saving = false;
            $scope.error = true;
        }).then(function(){
            $scope.saving = false;
            $scope.saved = true;
        });
    };
}

module.controller('zones', zones);
zones.$inject = ['$scope', '$http', '$filter'];
function zones($scope, $http, $filter){
    var today = new Date();
    var twoDaysAgo = (new Date()).setDate(today.getDate()-2);
    var date_filter = $filter('date');
    var twoMonthsAgo = (new Date()).setMonth(today.getMonth()-2);
    $scope.times = [
        {title: 'Today', key: 'back_d0'},
        {title: 'Yesterday', key: 'back_d1'},
        {title: date_filter(twoDaysAgo, 'dd-MMM-yyyy'), key: 'back_d2'},
        {title: 'This Month', key: 'back_m0'},
        {title: 'Last Month', key: 'back_m1'},
        {title: date_filter(twoMonthsAgo, 'MMM-yyyy'), key: 'back_m2'},
    ];
    var numberFilter = $filter('requests');
    var sizeFilter = $filter('bytes');
    $scope.fields = [
        {key: 'http_svc_req', title: 'HTTP', filter: numberFilter},
        {key: 'https_svc_req', title: 'HTTPS', filter: numberFilter},
        {key: 'bw_up', title: 'Upload', filter: sizeFilter},
        {key: 'bw_dn', title: 'Download', filter: sizeFilter},
        {key: 'bw_sum', title: 'Total Bandwidth', filter: sizeFilter}
    ];
    $http.get('/api/stats').then(function(stats){
        $scope.stats = stats.data;
        if (!Object.keys($scope.stats).length)
            $scope.error = true;
    })
    .catch(function(e){ $scope.error = true; });
    $http.get('/api/whitelist').then(function(whitelist){
        $scope.whitelist = whitelist.data;
    });
    $http.get('/api/recent_ips').then(function(recent_ips){
        $scope.recent_ips = recent_ips.data;
    });
}

module.filter('requests', requestsFilter);
requestsFilter.$inject = ['$filter'];
function requestsFilter($filter){
    var numberFilter = $filter('number');
    return function(requests, precision){
        if (requests==0 || isNaN(parseFloat(requests))
            || !isFinite(requests))
        {
            return '-';
        }
        if (typeof precision==='undefined')
            precision = 0;
        return numberFilter(requests, precision);
    };
}

module.filter('bytes', bytesFilter);
bytesFilter.$inject = ['$filter'];
function bytesFilter($filter){
    var numberFilter = $filter('number');
    return function(bytes, precision){
        if (bytes==0 || isNaN(parseFloat(bytes)) || !isFinite(bytes))
            return '-';
        var number = Math.floor(Math.log(bytes) / Math.log(1024));
        if (typeof precision==='undefined')
            precision = number ? 2 : 0;
        return numberFilter(bytes / Math.pow(1024, Math.floor(number)),
            precision)+' '+['bytes', 'KB', 'MB', 'GB', 'TB', 'PB'][number];
    };
}

angular.bootstrap(document, ['app']);

});
