// LICENSE_CODE ZON ISC
'use strict'; /*jslint browser:true*/
define(['angular', 'angular-material', 'util', '_css!css/countries'],
function(angular){

var module = angular.module('countries', ['ngMaterial', 'util']);

module.controller('countries', countries);
countries.$inject = ['$scope', '$mdDialog', 'consts'];
function countries($scope, $mdDialog, consts){
    var _this = this;
    this.url = '';
    this.ua = '';
    this.path = '';
    this.headers = [];
    this.started = 0;
    this.add_header = function(){
        _this.headers.push({key: '', value: ''});
    };
    this.remove_header = function(index){
        _this.headers.splice(index, 1);
    };
    var normalize_headers = function(headers){
        var result = {};
        for (var h in headers)
            result[headers[h].key] = headers[h].value;
        return result;
    };
    this.go = function(){
        var process = function(){
            _this.started++;
            _this.countries = [];
            var max_concur = 4;
            var cur_concur = 0;
            var cur_index = 0;
            var progress = function(apply){
                while (cur_index<_this.countries.length&&cur_concur<max_concur)
                {
                    _this.countries[cur_index].status = 1;
                    _this.countries[cur_index].img.src =
                    _this.countries[cur_index].url;
                    cur_index++;
                    cur_concur++;
                }
                if (apply)
                    $scope.$apply();
            };
            var nheaders = JSON.stringify(normalize_headers(_this.headers));
            for (var c_index in consts.proxy.country.values)
            {
                var c = consts.proxy.country.values[c_index];
                if (!c.value)
                    continue;
                var params = {
                    country: c.value,
                    url: _this.url,
                    path: _this.path,
                    ua: _this.ua,
                    headers: nheaders,
                };
                var nparams = [];
                for (var p in params)
                    nparams.push(p+'='+encodeURIComponent(params[p]));
                var data = {
                    code: c.value,
                    name: c.key,
                    status: 0,
                    url: '/api/country?'+nparams.join('&'),
                    img: new Image(),
                };
                data.img.onerror = (function(data, started){
                    return function(){
                        if (_this.started!=started)
                            return;
                        data.status = 2;
                        cur_concur--;
                        progress(true);
                    };
                })(data, _this.started);
                data.img.onload = (function(data, started){
                    return function(){
                        if (_this.started!=started)
                            return;
                        data.status = 3;
                        cur_concur--;
                        progress(true);
                    };
                })(data, _this.started);
                _this.countries.push(data);
            }
            progress(false);
        };
        if (_this.started)
        {
            var confirm = $mdDialog.confirm({
                ok: 'ok',
                cancel: 'cancel',
                title: 'The currently made screenshots will be lost. '
                    +'Do you want to continue?',
                onComplete: function(scope, el){
                    el.find('button').eq(0).focus();
                },
            });
            $mdDialog.show(confirm).then(process);
        }
        else
            process();
    };
    this.view = function(country, url){
        $mdDialog.show({
            controller: screenshot_controller,
            templateUrl: '/screenshot.html',
            parent: angular.element(document.body),
            clickOutsideToClose: true,
            locals: {country: country, url: url},
            fullscreen: true,
        });
    };
}

screenshot_controller.$inject = ['$scope', '$mdDialog', 'locals'];
function screenshot_controller($scope, $mdDialog, locals){
    $scope.country = locals.country;
    $scope.url = locals.url;
    $scope.hide = $mdDialog.hide.bind($mdDialog);
}

});
