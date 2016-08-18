// LICENSE_CODE ZON ISC
'use strict'; /*jslint browser:true*/
define(['angular', 'angular-material', 'util', '_css!css/cred'],
function(angular){

var module = angular.module('lum-cred', ['ngMaterial', 'lum-util']);

module.service('credentials', CredentialsService);
CredentialsService.$inject = ['get_json', '$http', '$q'];
function CredentialsService(get_json, $http, $q){
    var has_credentials = $q.defer();
    this.has_credentials = has_credentials.promise;
    this.$http = $http;
    this.$q = $q;
    this.get_json = get_json;
    this.get().then(function(creds){
        has_credentials.resolve(creds.customer&&creds.password); });
    return this;
}

CredentialsService.prototype.get = function(){
    return this.get_json('/api/creds');
};

CredentialsService.prototype.save = function(opt){
    var _this = this;
    var req = this.$http.post('/api/creds', {
        customer: opt.customer,
        password: opt.password,
    });
    req.then(function(){ _this.has_credentials = _this.$q.when(true); });
    return req;
};

module.controller('credentials', CredentialsController);
CredentialsController.$inject = ['credentials', '$state'];
function CredentialsController(credentials, $state){
    var vm = this;
    vm.service = credentials;
    vm.$state = $state;
    credentials.get().then(function(creds){
        vm.customer = creds.customer;
        vm.password = creds.password;
    });
}

CredentialsController.prototype.save = function(){
    var vm = this;
    vm.service.save({
        customer: this.customer,
        password: this.password,
    });
};

});
