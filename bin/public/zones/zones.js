// LICENSE_CODE ZON ISC
'use strict'; /*jslint browser:true*/
define(['angular', 'angular-material', 'md-data-table',
    'css!./zones'],
function(angular){

var zones = angular.module('lum-zones', ['ngMaterial']);

zones.controller('zones', ZonesController);
ZonesController.$inject = ['$filter', '$http', '$interval'];
function ZonesController($filter, $http, $interval){
    var vm = this;
    var today = new Date();
    var twoDaysAgo = (new Date()).setDate(today.getDate()-2);
    var date_filter = $filter('date');
    var twoMonthsAgo = (new Date()).setMonth(today.getMonth()-2);
    vm.times = [
        {title: 'Today', key: 'back_d0'},
        {title: 'Yesterday', key: 'back_d1'},
        {title: date_filter(twoDaysAgo, 'dd-MMM-yyyy'), key: 'back_d2'},
        {title: 'This Month', key: 'back_m0'},
        {title: 'Last Month', key: 'back_m1'},
        {title: date_filter(twoMonthsAgo, 'MMM-yyyy'), key: 'back_m2'},
    ];
    var numberFilter = $filter('requests');
    var sizeFilter = $filter('bytes');
    vm.fields = [
        {key: 'http_svc_req', title: 'HTTP', filter: numberFilter},
        {key: 'https_svc_req', title: 'HTTPS', filter: numberFilter},
        {key: 'bw_up', title: 'Upload', filter: sizeFilter},
        {key: 'bw_dn', title: 'Download', filter: sizeFilter},
        {key: 'bw_sum', title: 'Total Bandwidth', filter: sizeFilter}
    ];
    $http.get('/stats.json').then(function(stats){
        vm.stats = stats.data;
        if (!Object.keys(vm.stats).length)
            vm.error = true;
    })
    .catch(function(e){ vm.error = true; });
    return vm;
}

zones.filter('requests', requestsFilter);
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

var units = [' bytes', ' kB', ' MB', ' GB', ' TB', ' PB'];
zones.filter('bytes', bytesFilter);
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
            precision) + units[number];
    };
}

});
