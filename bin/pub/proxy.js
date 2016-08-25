// LICENSE_CODE ZON ISC
'use strict'; /*jslint browser:true*/
define(['angular', 'socket.io-client', 'lodash', 'moment', 'es6_shim',
    'util', 'angular-material', 'md-data-table', 'angular-chart',
    'health', '_css!css/proxy'],
    function(angular, io, _, moment){

var module = angular.module('proxy', ['ngMaterial', 'md.data.table',
    'chart.js', 'health', 'util']);

module.factory('consts', consts_service);
consts_service.$inject = ['get_json'];
function consts_service(get_json){
    var data = {proxy: {}};
    get_json('/api/consts').then(function(res){ _.merge(data, res); });
    return data;
}

module.factory('proxies', proxies_service);
proxies_service.$inject = ['get_json'];
function proxies_service(get_json){
    var service = {
        subscribe: subscribe,
        proxies: null,
        update: update_proxies
    };
    var listeners = [];
    service.update();
    io().on('stats', stats_event);
    return service;
    function subscribe(func){
        listeners.push(func);
        if (service.proxies)
            func(service.proxies);
    }
    function update_proxies(){
        return get_json('/api/proxies').then(function(proxies){
            proxies.forEach(function(proxy){
                proxy.stats = {
                    total: {
                        active_requests: [],
                        status: {codes: ['2xx'], values: [[]]},
                        max: {requests: 0, codes: 0},
                    },
                    ticks: [],
                };
            });
            service.proxies = proxies;
            listeners.forEach(function(cb){ cb(proxies); });
            return proxies;
        });
    }
    function stats_event(stats_chunk){
        if (!service.proxies)
            return;
        var now = moment().format('hh:mm:ss');
        for (var port in stats_chunk)
        {
            var chunk = stats_chunk[port];
            var proxy = _.find(service.proxies, {port: +port});
            var data = _.values(chunk);
            var stats = proxy.stats;
            var status = stats.total.status;
            stats.ticks.push(now);
            var active_requests = _.sumBy(data, 'active_requests');
            stats.total.active_requests.push(active_requests);
            stats.total.max.requests = Math.max(stats.total.max.requests,
                active_requests);
            var codes = data.reduce(function(r, host){
                return r.concat(_.keys(host.status_code)); }, []);
            codes = _.uniq(codes);
            codes.forEach(function(code){
                var i = status.codes.indexOf(code);
                if (i==-1)
                {
                    status.codes.push(code);
                    i = status.codes.length-1;
                    status.values.push(new Array(stats.ticks.length-1));
                    _.fill(status.values[i], 0);
                }
                var total = _.sumBy(data, 'status_code.'+code);
                status.values[i].push(total);
                stats.total.max.codes = Math.max(stats.total.max.codes, total);
            });
            var len = stats.ticks.length;
            status.values.forEach(function(values){
                if (values.length<len)
                    values.push(0);
            });
            ['requests', 'codes'].forEach(function(chart){
                var canvas;
                if ((canvas = chart_container(chart)) && canvas.att_chart)
                {
                    canvas.att_chart.data.datasets = chart_data(
                        canvas.att_chart_pars).datasets;
                    canvas.att_chart.update();
                }
            });
        }
    }
}

var opt_columns = [
    {key: 'super_proxy', title: 'Host'},
    {key: 'zone', title: 'Zone'},
    {key: 'socks', title: 'SOCKS'},
    {key: 'country', title: 'Country'},
    {key: 'state', title: 'State'},
    {key: 'city', title: 'City'},
    {key: 'asn', title: 'ASN'},
    {key: 'cid', title: 'Client ID'},
    {key: 'ip', title: 'IP'},
    {key: 'session_timeout', title: 'Session timeout'},
    {key: 'dns', title: 'DNS'},
    {key: 'request_timeout', title: 'Request Timeout'},
    {key: 'resolve', title: 'Resolve'},
    {key: 'pool_size', title: 'Pool size'},
    {key: 'proxy_count', title: 'Minimum proxies count'},
    {key: 'sticky_ip', title: 'Sticky IP'},
    {key: 'max_requests', title: 'Max requests'},
    {key: 'log', title: 'Log Level'},
    {key: 'debug', title: 'Luminati debug'},
];

module.controller('proxy_table', proxy_table);
proxy_table.$inject = ['proxies', '$mdDialog', '$http', 'consts'];
function proxy_table(proxies, $mdDialog, $http, consts){
    this.$mdDialog = $mdDialog;
    this.$http = $http;
    this.proxies = proxies;
    var $vm = this;
    $vm.consts = consts.proxy;
    $vm.resolved = false;
    $vm.proxies = [];
    $vm.columns = [];
    proxies.subscribe(function(proxies){
        $vm.resolved = true;
        $vm.proxies = proxies;
        var always = ['zone', 'session_timeout', 'pool_size'];
        $vm.columns = opt_columns.filter(function(col){
            var key = col.key;
            return always.indexOf(key)>-1 || _.some(proxies, key);
        });
    });
}

proxy_table.prototype.edit_proxy = function(proxy_old){
    var _proxy = proxy_old ? _.cloneDeep(proxy_old) : null;
    var _this = this;
    this.$mdDialog.show({
        controller: edit_controller,
        templateUrl: '/settings.html',
        parent: angular.element(document.body),
        clickOutsideToClose: true,
        locals: {proxy: _proxy},
        fullscreen: true
    }).then(function(proxy){
        if (!proxy)
          return;
        proxy.persist = true;
        var data = {proxy: proxy};
        var promise;
        if (_proxy)
            promise = _this.$http.put('/api/proxies/'+proxy_old.port, data);
        else
            promise = _this.$http.post('/api/proxies', data);
        promise.then(function(){ _this.proxies.update(); });
    });
};

proxy_table.prototype.show_stats = function(proxy){
    this.$mdDialog.show({
        controller: stats_controller,
        templateUrl: '/stats.html',
        parent: angular.element(document.body),
        clickOutsideToClose: true,
        locals: {proxy: proxy},
        fullscreen: true
    });
};

proxy_table.prototype.show_history = function(proxy){
    this.$mdDialog.show({
        controller: history_controller,
        templateUrl: '/history.html',
        parent: angular.element(document.body),
        clickOutsideToClose: true,
        locals: {port: proxy.port},
        fullscreen: true,
    });
};

proxy_table.prototype.show_test = function(){
    this.$mdDialog.show({
        controller: test_controller,
        templateUrl: '/test.html',
        parent: angular.element(document.body),
        clickOutsideToClose: true,
        locals: {proxies: this.proxies},
        fullscreen: true,
    });
};

proxy_table.prototype.delete_proxy = function(proxy){
    var _this = this;
    var confirm = this.$mdDialog.confirm({ok: 'ok', cancel: 'cancel',
        title: 'Are you sure you want to delete proxy?'});
    this.$mdDialog.show(confirm).then(function(){
        return _this.$http.delete('/api/proxies/'+proxy.port);
    }).then(function(){ _this.proxies.update(); });
};

edit_controller.$inject = ['$scope', '$mdDialog', 'consts', 'locals'];
function edit_controller($scope, $mdDialog, consts, locals){
    $scope.form = _.get(locals, 'proxy', {});
    $scope.consts = consts.proxy;
    $scope.hide = $mdDialog.hide.bind($mdDialog);
    $scope.cancel = $mdDialog.cancel.bind($mdDialog);
    $scope.validate = function(data){
        data = data||{};
        $mdDialog.hide(data);
    };
}

function chart_container(chart){
    return document.getElementsByClassName('chart-'+chart)[0];
}

function chart_color(color){
    var rgba = function(color, alpha){
        return 'rgba('+color.concat(alpha).join(',')+')';
    };
    var hex = color.substr(1);
    var int = parseInt(hex, 16);
    var r = int>>16&255, g = int>>8&255, b = int&255;
    color = [r, g, b];
    return {
        backgroundColor: rgba(color, 0.2),
        pointBackgroundColor: rgba(color, 1),
        pointHoverBackgroundColor: rgba(color, 0.8),
        borderColor: rgba(color, 1),
        pointBorderColor: '#fff',
        pointHoverBorderColor: rgba(color, 1),
    };
}

function chart_data(params){
    return {
        labels: params.labels,
        datasets: params.data.map(function(item, i){
            return angular.extend({
                lineTension: 0,
                data: item,
                label: params.series[i],
            }, chart_color(window.Chart.defaults.global.colors[i]));
        }),
    };
}

function chart_mousemove(type, $event, x_ar, t_ar, labels){
    var rect = $event.currentTarget.getBoundingClientRect();
    var width = rect.right-rect.left;
    var x = $event.pageX;
    x -= rect.left;
    x -= window.pageXOffset;
    x = Math.max(0, Math.min(width-1, x));
    x_ar[type] = x;
    t_ar[type] = x/width;
}

function chart_indicator(labels, p){
    return labels[Math.round(p*(labels.length-1))];
}

stats_controller.$inject = ['$scope', '$mdDialog', 'locals'];
function stats_controller($scope, $mdDialog, locals){
    var stats = locals.proxy.stats;
    var total = stats.total;
    $scope.requests = [total.active_requests];
    $scope.requests_series = ['Active requests'];
    $scope.codes = total.status.values;
    $scope.codes_series = total.status.codes;
    $scope.labels = stats.ticks;
    $scope.hide = $mdDialog.hide.bind($mdDialog);
    $scope.options = {
        animation: {duration: 0},
        elements: {line: {borderWidth: 0.5}, point: {radius: 0}},
        scales: {
            xAxes: [{
                display: false,
            }],
            yAxes: [{
                position: 'right',
                gridLines: {display: false},
                ticks: {beginAtZero: true, suggestedMax: 6},
            }],
        },
    };
    $scope.codes_options = _.merge({elements: {line: {fill: false}},
        legend: {display: true, labels: {boxWidth: 6}},
        grindLines: {display: false}}, $scope.options);
    $scope.max_values = total.max;
    $scope.chart_indicator = chart_indicator;
    $scope.chart_mousemove = chart_mousemove;
    $scope.chart_x = {requests: 0, codes: 0};
    $scope.chart_time = {requests: 0, codes: 0};
    setTimeout(function(){
        var charts = [
            {
                name: 'requests',
                labels: $scope.labels,
                data: $scope.requests,
                series: $scope.requests_series,
                options: $scope.options,
            },
            {
                name: 'codes',
                labels: $scope.labels,
                data: $scope.codes,
                series: $scope.codes_series,
                options: $scope.codes_options,
            },
        ];
        charts.forEach(function(chart){
            var canvas = chart_container(chart.name);
            var params = {
                type: 'line',
                data: chart_data(chart),
                options: chart.options,
            };
            canvas.att_chart_pars = chart;
            canvas.att_chart = new window.Chart(canvas, params);
        });
    }, 0);
}

history_controller.$inject = ['$scope', '$filter', '$mdDialog', 'get_json',
    'locals'];
function history_controller($scope, $filter, $mdDialog, get_json, locals){
    $scope.fields = [
        {field: 'url', title: 'Url'},
        {field: 'method', title: 'Method'},
        {field: 'status_code', title: 'Code'},
        {field: 'timestamp', title: 'Time'},
        {field: 'elapsed', title: 'Elapsed'},
        {field: 'proxy', title: 'Proxy'},
    ];
    $scope.sort_field = 'timestamp';
    $scope.sort_asc = false;
    $scope.filters = {
        url: '',
        method: '',
        status_code: '',
        timestamp: '',
        timestamp_min: null,
        timestamp_max: null,
        elapsed: '',
        elapsed_min: '',
        elapsed_max: '',
        proxy: '',
    };
    $scope.page = 1;
    $scope.page_size = 10;
    $scope.update = function(preserving_page, export_type){
        if (!preserving_page)
            $scope.page = 1;
        var params = {
            count: export_type=='all' ? -1 : $scope.page*$scope.page_size,
            sort: $scope.sort_field,
        };
        if (!$scope.sort_asc)
            params.sort_desc = 1;
        if ($scope.filters.url)
            params.url = $scope.filters.url;
        if ($scope.filters.method)
            params.method = $scope.filters.method;
        if ($scope.filters.status_code)
            params.status_code = $scope.filters.status_code;
        if ($scope.filters.timestamp_min)
        {
            params.timestamp_min = $scope.filters.timestamp_min
            .getTime();
        }
        if ($scope.filters.timestamp_max)
        {
            params.timestamp_max = $scope.filters.timestamp_max
            .getTime();
        }
        if ($scope.filters.elapsed_min)
            params.elapsed_min = $scope.filters.elapsed_min;
        if ($scope.filters.elapsed_max)
            params.elapsed_max = $scope.filters.elapsed_max;
        if ($scope.filters.proxy)
            params.proxy = $scope.filters.proxy;
        var params_arr = [];
        for (var param in params)
            params_arr.push(param+'='+encodeURIComponent(params[param]));
        var url = '/api/'+(export_type ? 'har' : 'history')+'/'+locals.port
        +'?'+params_arr.join('&');
        if (export_type)
        {
            window.location = url;
        }
        else
        {
            $scope.loading = true;
            get_json(url).then(function(history){
                $scope.loading = false;
                $scope.loading_page = false;
                $scope.history = history;
            });
        }
    };
    $scope.show_loader = function(){
        return $scope.loading;
    };
    $scope.show_next = function(){
        return $scope.loading_page||$scope.history&&
        $scope.history.length>=$scope.page*$scope.page_size;
    };
    $scope.sort = function(field){
        if ($scope.sort_field==field)
            $scope.sort_asc = !$scope.sort_asc;
        else
        {
            $scope.sort_field = field;
            $scope.sort_asc = true;
        }
        $scope.update();
    };
    $scope.filter = function(field){
        var options;
        if (field=='method')
            options = ['', 'GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'COPY',
                'HEAD', 'OPTIONS', 'LINK', 'UNLINK', 'PURGE', 'LOCK', 'UNLOCK',
                'PROPFIND', 'VIEW', 'TRACE', 'CONNECT'];
        $mdDialog.show({
            controller: filter_controller(field),
            templateUrl: '/filter/'+field+'.html',
            parent: angular.element(document.body),
            clickOutsideToClose: true,
            skipHide: true,
            locals: {
                filters: $scope.filters,
                update: $scope.update,
                options: options,
            },
        });
    };
    $scope.details = function(row){
        $mdDialog.show({
            controller: details_controller,
            templateUrl: '/history_details.html',
            parent: angular.element(document.body),
            clickOutsideToClose: true,
            skipHide: true,
            locals: {row: row, fields: $scope.fields},
        });
    };
    $scope.next = function(){
        $scope.loading_page = true;
        $scope.page++;
        $scope.update(true);
    };
    $scope.export_type = 'visible';
    $scope.export = function(){
        $scope.update(true, $scope.export_type);
    };
    $scope.hide = $mdDialog.hide.bind($mdDialog);
    $scope.update();
}

filter_controller.$inject = ['field'];
function filter_controller(field){
    var range = field=='elapsed'||field=='timestamp';
    return function($scope, $filter, $mdDialog, locals){
        $scope.value = locals.filters[field];
        if (range)
        {
            $scope.value_min = locals.filters[field+'_min'];
            $scope.value_max = locals.filters[field+'_max'];
            if (field=='timestamp'&&$scope.value_max)
                $scope.value_max.setDate($scope.value_max.getDate()-1);
        }
        $scope.options = locals.options;
        $scope.keypress = function(event){
            if (event.which==13)
                $scope.apply();
        };
        $scope.apply = function(){
            if (range)
            {
                var display_min, display_max;
                if (field=='timestamp')
                {
                    display_min = moment($scope.value_min)
                    .format('YYYY/MM/DD');
                    display_max = moment($scope.value_max)
                    .format('YYYY/MM/DD');
                    if ($scope.value_max)
                        $scope.value_max.setDate($scope.value_max.getDate()+1);
                }
                else
                {
                    display_min = $scope.value_min;
                    display_max = $scope.value_max;
                }
                if ($scope.value_min&&$scope.value_max)
                    $scope.value = display_min+'-'+display_max;
                else if ($scope.value_min)
                    $scope.value = 'From '+display_min;
                else if ($scope.value_max)
                    $scope.value = 'Up to '+display_max;
                else
                    $scope.value = '';
                locals.filters[field+'_min'] = $scope.value_min;
                locals.filters[field+'_max'] = $scope.value_max;
            }
            if ($scope.value!=locals.filters[field])
            {
                locals.filters[field] = $scope.value;
                locals.update();
            }
            $mdDialog.hide();
        };
        $scope.hide = $mdDialog.hide.bind($mdDialog);
    };
}

details_controller.$inject = ['$scope', '$filter', '$mdDialog', 'locals'];
function details_controller($scope, $filter, $mdDialog, locals){
    $scope.row = locals.row;
    var request_headers = JSON.parse($scope.row.request_headers);
    $scope.request_headers = Object.keys(request_headers).map(function(key){
            return [key, request_headers[key]];
        });
    var response_headers = JSON.parse($scope.row.response_headers);
    $scope.response_headers = Object.keys(response_headers).map(function(key){
            return [key, response_headers[key]];
        });
    $scope.fields = locals.fields;
    $scope.hide = $mdDialog.hide.bind($mdDialog);
}

test_controller.$inject = ['$scope', '$filter', '$mdDialog', '$http',
    'locals'];
function test_controller($scope, $filter, $mdDialog, $http, locals){
    $scope.proxies = locals.proxies;
    $scope.methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'COPY', 'HEAD',
        'OPTIONS', 'LINK', 'UNLINK', 'PURGE', 'LOCK', 'UNLOCK', 'PROPFIND',
        'VIEW'];
    $scope.request = {};
    $scope.go = function(proxy, url, method, headers, body){
        var headers_obj = {};
        headers.forEach(function(h){ headers_obj[h.key] = h.value; });
        var req = {
            method: 'POST',
            url: '/api/test/'+(proxy||0),
            data: {
                url: url,
                method: method,
                headers: headers_obj,
                body: body,
            },
        };
        $scope.loading = true;
        $http(req).then(function(r){
            $scope.loading = false;
            r = r.data;
            if (!r.error)
            {
                r.response.headers = Object.keys(r.response.headers).sort()
                .map(function(key){
                    return [key, r.response.headers[key]];
                });
            }
            $scope.request = r;
        });
    };
    $scope.headers = [];
    $scope.add_header = function(){
        $scope.headers.push({key: '', value: ''});
    };
    $scope.remove_header = function(index){
        $scope.headers.splice(index, 1);
    };
    $scope.hide = $mdDialog.hide.bind($mdDialog);
}

});
