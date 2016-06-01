define(['angular', 'socket.io-client', 'angular-material-table'],
function(angular, io){
    'use strict'; /*jslint browser:true*/
    var proxies = angular.module('lum-proxies', ['ngMaterial',
        'md.data.table']);

    proxies.factory('lumProxies', proxiesService);
    proxiesService.$inject = ['$q'];
    function proxiesService($q){
        var deffered = $q.defer();
        io().on('proxies', function(proxies){
            deffered.resolve(proxies); });
        return deffered.promise;
    }

    proxies.value('lumOptColumns', [
        {key: 'super_proxy', title: 'Host'},
        {key: 'zone', title: 'Zone'},
        {key: 'country', title: 'Country'},
        {key: 'state', title: 'State'},
        {key: 'city', title: 'City'},
        {key: 'session_timeout', title: 'Session timeout'},
        {key: 'dns', title: 'DNS'},
        {key: 'resolve', title: 'Resolve'},
        {key: 'pool_size', title: 'Pool size'},
        {key: 'max_requests', title: 'Max requests'},
        {key: 'log', title: 'Log'}
    ]);

    proxies.controller('ProxiesTable', ProxiesTableController);
    ProxiesTableController.$inject=['lumProxies', 'lumOptColumns'];
    function ProxiesTableController(lum_proxies, opt_columns){
        var $vm = this;
        $vm.resolved = false;
        $vm.proxies = [];
        $vm.opt_columns = [];
        lum_proxies.then(function(proxies){
            $vm.resolved = true;
            $vm.proxies = proxies;
            $vm.opt_columns = opt_columns.filter(function(col){
                return proxies.some(function(p){ return p.opt[col.key]; }); });
        });
    }

    proxies.directive('proxiesTable', function(){
        return {
            restrict: 'E',
            scope: {},
            templateUrl: '/proxies/proxies_table.html',
            controller: 'ProxiesTable',
            controllerAs: '$vm'
        };
    });
});
