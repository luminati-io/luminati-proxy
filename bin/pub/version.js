// LICENSE_CODE ZON ISC
'use strict'; /*jslint browser:true*/
define(['angular', 'angular-material', 'util', '_css!css/version'],
function(angular){

var module = angular.module('version', ['ngMaterial', 'util']);

module.factory('version', version_service);
version_service.$inject = ['get_json', '$q'];
function version_service(get_json, $q){
    return {
        current: get_json('/api/version'),
        latest: get_json('https://raw.githubusercontent.com/luminati-io/'+
            'luminati-proxy/master/package.json'),
    };
}

module.controller('version', version_controller);
version_controller.$inject = ['version', 'upgrade_instructions'];
function version_controller(version, upgrade_instructions){
    var vm = this;
    vm.upgrade_instructions = upgrade_instructions;
    version.current.then(function(current){
        vm.current = current.version;

        version.latest.then(function(latest){
            vm.latest = latest.version;
            vm.need_upgrade = vm.latest!=vm.current;
        });
    });
}

module.directive('version', version);
version.$inject = [];
function version(){
    return {
        restrict: 'E',
        controller: 'version',
        controllerAs: 'ver',
        templateUrl: '/version.html',
    };
}

module.factory('upgrade_instructions', upgrade_instructions);
upgrade_instructions.$inject = ['$mdDialog'];
function upgrade_instructions($mdDialog){
    return function(){
        $mdDialog.show({
            title: 'Upgrade Instructions',
            ariaTitle: 'Upgrade Instructions',
            templateUrl: '/upgrade.html',
            clickOutsideToClose: true,
            controllerAs: 'dialog',
            controller: function(){ return {hide: $mdDialog.hide}; },
        });
    };
}

    return module;
});
