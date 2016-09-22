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
    this.num_loading = 0;
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
            _this.num_loading = 0;
            _this.cur_index = 0;
            var progress = function(apply){
                while (_this.cur_index<_this.countries.length&&
                    _this.num_loading<max_concur)
                {
                    if (_this.countries[_this.cur_index].status == 0)
                    {
                        _this.countries[_this.cur_index].status = 1;
                        _this.countries[_this.cur_index].img.src =
                        _this.countries[_this.cur_index].url;
                        _this.num_loading++;
                    }
                    _this.cur_index++;
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
                    index: _this.countries.length,
                };
                data.img.onerror = (function(data, started){
                    return function(){
                        if (_this.started!=started)
                            return;
                        data.status = 3;
                        _this.num_loading--;
                        progress(true);
                    };
                })(data, _this.started);
                data.img.onload = (function(data, started){
                    return function(){
                        if (_this.started!=started)
                            return;
                        data.status = 4;
                        _this.num_loading--;
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
    this.view = function(country){
        $mdDialog.show({
            controller: screenshot_controller,
            templateUrl: '/old/screenshot.html',
            parent: angular.element(document.body),
            clickOutsideToClose: true,
            locals: {country: country.name, url: country.url},
            fullscreen: true,
        });
    };
    this.cancel = function(country){
        if (country.status==0)
            country.status = 2;
        else if (country.status==1)
            country.img.src = '';
    };
    this.cancel_all = function(){
        var confirm = $mdDialog.confirm({
            ok: 'ok',
            cancel: 'cancel',
            title: 'Do you want to cancel all the remaining countries?',
            onComplete: function(scope, el){
                el.find('button').eq(0).focus();
            },
        });
        $mdDialog.show(confirm).then(function(){
            for (var c_index=_this.countries.length-1; c_index>=0; c_index--)
            {
                var country = _this.countries[c_index];
                if (country.status<2)
                    _this.cancel(country);
            }
        });
    };
    this.retry = function(country){
        if (_this.cur_index>country.index)
        {
            country.status = 1;
            country.url = country.url.replace(/&\d+$/, '')
            +'&'+new Date().getTime();
            _this.num_loading++;
            country.img.src = country.url;
        }
        else
            country.status = 0;
    };
}

screenshot_controller.$inject = ['$scope', '$mdDialog', 'locals'];
function screenshot_controller($scope, $mdDialog, locals){
    $scope.country = locals.country;
    $scope.url = locals.url;
    $scope.hide = $mdDialog.hide.bind($mdDialog);
}

});
