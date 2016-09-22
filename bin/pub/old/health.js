// LICENSE_CODE ZON ISC
'use strict'; /*jslint browser:true*/
define(['angular', 'socket.io-client', '_css!css/health'],
function(angular, io){

var module = angular.module('health', ['ngMaterial']);

module.service('health', health_service);
health_service.$inject = ['$q'];
function health_service($q){
    var _this = this;
    _this.q = $q;
    _this.states = {};
    _this.pending = {};
    _this.io = io().on('health', function(health){
        _this._update(health); });
}

health_service.prototype.state = function(key){
    if (this.states[key])
        return this.q.when(this.states[key]);
    if (!this.pending[key])
        this.pending[key] = this.q.defer();
    return this.pending[key].promise;
};

health_service.prototype._update = function(health){
    for (var key in health)
    {
        var state = health[key];
        if (this.pending[key])
        {
            this.pending[key].resolve(state);
            this.states[key] = this.pending[key];
            delete this.pending[key];
        }
        else
            this.states[key] = this.q.when(state);
    }
};

module.controller('health', health_controller);
health_controller.$inject=['$attrs', 'health'];
function health_controller($attrs, health){
    var $health = this;
    $health.stateName = 'pending';
    $health.resolved = false;
    $health.state = health.state($attrs.for);
    $health.state.then(function(val){
        $health.resolved = true;
        $health.stateName = val?'done':'error';
    });
}

module.directive('health', function(){
    return {
        restrict: 'E',
        scope: {},
        templateUrl: '/old/health.html',
        controller: 'health',
        controllerAs: '$health',
        transclude: true
    };
});

});
