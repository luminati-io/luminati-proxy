// LICENSE_CODE ZON ISC
'use strict'; /*jslint browser:true*/
define(['angular', 'angular-material', 'util', '_css!css/cred'],
function(angular){

var module = angular.module('cred', ['ngMaterial', 'util']);

module.service('credentials', credentials_service);
credentials_service.$inject = ['get_json', '$http', '$q', '$mdDialog'];
function credentials_service(get_json, $http, $q, $mdDialog){
    var has_credentials = $q.defer();
    this.has_credentials = has_credentials.promise;
    this.$http = $http;
    this.$q = $q;
    this.$mdDialog = $mdDialog;
    this.get_json = get_json;
    this.get().then(function(creds){
        has_credentials.resolve(creds.customer&&creds.password); });
    return this;
}

credentials_service.prototype.get = function(){
    return this.get_json('/api/creds');
};

credentials_service.prototype.save = function(opt, $scope){
    var _this = this;
    $scope.saving = true;
    var req = this.$http.post('/api/creds', {
        customer: opt.customer,
        password: opt.password,
        proxy: opt.proxy,
        proxy_port: opt.proxy_port,
    }).error(function(){
        $scope.saving = false;
        _this.$mdDialog.show(
            _this.$mdDialog.alert()
            .parent(angular.element(document.querySelector('body')))
            .clickOutsideToClose(true)
            .title('Incorrect credentials')
            .textContent('The credentials you entered are incorrect. '
                +'Please provide correct credentials.')
            .ok('OK')
        );
    });
    req.then(function(){
        $scope.saving = false;
        _this.has_credentials = _this.$q.when(true);
    });
    return req;
};

module.controller('credentials', credentials_controller);
credentials_controller.$inject = ['credentials', '$state', '$scope'];
function credentials_controller(credentials, $state, $scope){
    var vm = this;
    vm.service = credentials;
    vm.$state = $state;
    vm.$scope = $scope;
    credentials.get().then(function(creds){
        vm.customer = creds.customer;
        vm.password = creds.password;
        vm.proxy = creds.proxy;
        vm.proxy_port = creds.proxy_port;
        vm.config = creds.config;
    });
}

credentials_controller.prototype.save = function(){
    var vm = this;
    vm.service.save({
        customer: this.customer.trim(),
        password: this.password.trim(),
        proxy: this.proxy,
        proxy_port: this.proxy_port,
    }, vm.$scope);
};

});
