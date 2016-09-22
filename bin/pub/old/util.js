// LICENSE_CODE ZON ISC
'use strict'; /*jslint browser:true*/
define(['angular'], function(angular){

var module = angular.module('util', ['ng']);

module.factory('get_json', get_json_service);
get_json_service.$inject = ['$q', '$http'];
function get_json_service($q, $http){
    return function get_json(url){
        var deferred = $q.defer();
        $http.get(url)
        .then(function(res){
            if (res.status==200)
                deferred.resolve(res.data);
            else
                deferred.reject(res);
        })
        .catch(function(e){ deferred.reject(e); });
        return deferred.promise;
    };
}

});
