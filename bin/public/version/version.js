// LICENSE_CODE ZON ISC
'use strict'; /*jslint browser:true*/
define(['angular', 'angular-material', '../util', 'css!./version'],
function(angular){

var module = angular.module('lum-version', ['ngMaterial', 'lum-util']);

module.factory('version', VersionService);
VersionService.$inject = ['get_json', '$q'];
function VersionService(get_json, $q){
    return {
        current: get_json('/version.json'),
        latest: get_json('https://raw.githubusercontent.com/luminati-io/'+
            'luminati-proxy/master/package.json')
    };
}

module.controller('version', VersionController);
VersionController.$inject = ['version', 'lum_upgrade_instructions'];
function VersionController(version, lum_upgrade_instructions){
    var vm = this;
    vm.upgrade_instructions = lum_upgrade_instructions;
    version.current.then(function(current){
        vm.current = current.version;

        version.latest.then(function(latest){
            vm.latest = latest.version;
            vm.need_upgrade = (vm.latest!=vm.current);
        });
    });
}

module.directive('lumVersionDisplay', VersionDisplay);
VersionDisplay.$inject = [];
function VersionDisplay(){
    return {
        restrict: 'E',
        controller: 'version',
        controllerAs: 'ver',
        templateUrl: '/version/version_display.html'
    };
}

module.factory('lum_upgrade_instructions', lum_upgrade_instructions);
lum_upgrade_instructions.$inject = ['$mdDialog'];
function lum_upgrade_instructions($mdDialog){
    return function() {
        $mdDialog.show({
            title: 'Upgrade Instructions',
            ariaTitle: 'Upgrade Instructions',
            templateUrl: '/version/upgrade_instructions_dialog.html',
            clickOutsideToClose: true,
            controllerAs: 'dialog',
            controller: function () { return { hide: $mdDialog.hide }; }
        });
    };
}

    return module;
});
