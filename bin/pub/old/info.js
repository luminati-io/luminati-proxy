// LICENSE_CODE ZON ISC
'use strict'; /*jslint browser:true*/
define(['angular', 'angular-material', 'md-data-table', 'util',
    '_css!css/info'],
function(angular){

var module = angular.module('info', ['ngMaterial', 'util']);

module.controller('info', info_controller);
info_controller.$inject = ['$filter', 'get_json', '$interval'];
function info_controller($filter, get_json, $interval){
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
    get_json('/api/stats').then(function(stats){
        vm.stats = stats;
        if (!Object.keys(vm.stats).length)
            vm.error = true;
    })
    .catch(function(e){ vm.error = true; });
    get_json('/api/whitelist').then(function(whitelist){
        vm.whitelist = whitelist;
    });
    get_json('/api/recent_ips').then(function(recent_ips){
        vm.recent_ips = recent_ips;
    });
    return vm;
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

var units = [' bytes', ' kB', ' MB', ' GB', ' TB', ' PB'];
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
            precision) + units[number];
    };
}

});
