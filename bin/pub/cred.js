// LICENSE_CODE ZON ISC
'use strict'; /*jslint browser:true*/
define(['angular', 'angular-material', 'util', '_css!css/cred'],
function(angular){

var module = angular.module('cred', ['ngMaterial', 'util']);

module.service('credentials', credentials_service);
credentials_service.$inject = ['get_json', '$http', '$q'];
function credentials_service(get_json, $http, $q){
    var has_credentials = $q.defer();
    this.has_credentials = has_credentials.promise;
    this.$http = $http;
    this.$q = $q;
    this.get_json = get_json;
    this.get().then(function(creds){
        has_credentials.resolve(creds.customer&&creds.password); });
    return this;
}

credentials_service.prototype.get = function(){
    return this.get_json('/api/creds');
};

credentials_service.prototype.save = function(opt){
    var _this = this;
    var req = this.$http.post('/api/creds', {
        customer: opt.customer,
        password: opt.password,
    });
    req.then(function(){ _this.has_credentials = _this.$q.when(true); });
    return req;
};

module.controller('credentials', credentials_controller);
credentials_controller.$inject = ['credentials', '$state'];
function credentials_controller(credentials, $state){
    var vm = this;
    vm.service = credentials;
    vm.$state = $state;
    credentials.get().then(function(creds){
        vm.customer = creds.customer;
        vm.password = creds.password;
    });
}

credentials_controller.prototype.save = function(){
    var vm = this;
    vm.service.save({
        customer: this.customer,
        password: this.password,
    });
};

});
