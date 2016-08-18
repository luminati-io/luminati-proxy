// LICENSE_CODE ZON ISC
'use strict'; /*jslint browser:true*/
define(['angular', 'socket.io-client', '_css!css/health_marker'],
function(angular, io){

var health = angular.module('lum-health-markers', ['ngMaterial']);

health.service('healthStatus', HealthStatusService);
HealthStatusService.$inject = ['$q'];
function HealthStatusService($q){
    var _this = this;
    _this.q = $q;
    _this.states = {};
    _this.pending = {};
    _this.io = io().on('health', function(health){
        _this._updateState(health); });
}

HealthStatusService.prototype.getState = function(key){
    if (this.states[key])
        return this.q.when(this.states[key]);
    if (!this.pending[key])
        this.pending[key] = this.q.defer();
    return this.pending[key].promise;
};

HealthStatusService.prototype._updateState = function(health){
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

health.controller('HealthMarker', HealthMarkerController);
HealthMarkerController.$inject=['$attrs', 'healthStatus'];
function HealthMarkerController($attrs, healthStatus){
    var $marker = this;
    $marker.stateName = 'pending';
    $marker.resolved = false;
    $marker.state = healthStatus.getState($attrs.for);
    $marker.state.then(function(val){
        $marker.resolved = true;
        $marker.stateName = val?'done':'error';
    });
}

health.directive('healthMarker', function(){
    return {
        restrict: 'E',
        scope: {},
        templateUrl: '/inc/health_marker.html',
        controller: 'HealthMarker',
        controllerAs: '$marker',
        transclude: true
    };
});

});
