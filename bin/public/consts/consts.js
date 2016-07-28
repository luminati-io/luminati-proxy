// LICENSE_CODE ZON ISC
'use strict'; /*jslint browser:true*/
define(['angular', 'lodash'],
function(angular, _){
var module = angular.module('lum-consts', ['lum-util']);

module.factory('lumConsts', ['get_json', '$q', consts_service]);
function consts_service(get_json, $q){
    var data = {proxy: {}};
    get_json('/api/consts').then(function(res){ _.merge(data, res); });
    return data;
}

return module;
});
