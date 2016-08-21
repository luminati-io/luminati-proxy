// LICENSE_CODE ZON ISC
'use strict'; /*jslint browser:true*/
define(['angular', 'socket.io-client', 'lodash', 'moment',
    'es6_shim', './util', './consts', 'angular-material', 'md-data-table',
    'angular-chart', './health_markers', '_css!css/proxies'],
    function(angular, io, _, moment){

var proxies = angular.module('lum-proxies', ['ngMaterial', 'md.data.table',
    'chart.js', 'lum-health-markers', 'lum-util', 'lum-consts']);

proxies.value('lumProxyWindowConfig', {
    refresh: 100,
    size: 25*1000,
    delay: 2*1000,
    history: 50*1000
});

proxies.service('lumProxyGraphOptions', ProxyGraphOptions);
ProxyGraphOptions.$inject = ['$interval', 'lumProxyWindowConfig'];
function ProxyGraphOptions($interval, win_config){
    this.$interval = $interval;
    this._config = win_config;
    this._time_options = {};
    this._usage_counter = 0;
    this._options = {
        animation: {duration: 0},
        elements: {
            line: {borderWidth: 0.5},
            point: {radius: 0},
        },
        fill: true,
        legend: {display: false},
        scales: {
            xAxes: [{
                display: false,
                type: 'time',
                time: this._time_options,
            }],
            yAxes: [{
                position: 'right',
                ticks: {
                    min: 0,
                    stepSize: 1,
                    suggestedMax: 1,
                    beginAtZero: true,
                    callback: function(value){
                        return Math.floor(value)==value ? value : ''; },
                }
            }],
            gridLines: {display: false},
        },
        tooltips: {enabled: false},
    };
    return this;
}

ProxyGraphOptions.prototype.calculate_window = function(){
    var end = Date.now() - this._config.delay;
    var start = end - this._config.size;
    this._time_options.min = start;
    this._time_options.max = end;
};

ProxyGraphOptions.prototype.get_options = function(){
    ++this._usage_counter;
    if (!this._interval)
    {
        this.calculate_window();
        // XXX lee - causes browser to show as if reloading
        this._interval = this.$interval(this.calculate_window.bind(this),
            this._config.refresh);
    }
    return this._options;
};

ProxyGraphOptions.prototype.release_options = function(){
    if (!--this._usage_counter)
    {
        this.$interval.cancel(this._interval);
        this._interval = null;
    }
};

proxies.factory('lumProxies', proxiesService);
proxiesService.$inject = ['$q', '$interval', 'lumProxyWindowConfig',
    'get_json'];
function proxiesService($q, $interval, win_config, get_json){
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

proxies.value('lumOptColumns', [
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
]);

proxies.controller('ProxiesTable', proxy_table);
proxy_table.$inject = ['lumProxies', 'lumOptColumns',
    'lumProxyGraphOptions', '$mdDialog', '$http', 'lumConsts', 'get_json'];
function proxy_table(lum_proxies, opt_columns, graph_options, $mdDialog, $http,
    consts, get_json)
{
    this.$mdDialog = $mdDialog;
    this.$http = $http;
    this.get_json = get_json;
    this.lum_proxies = lum_proxies;
    var $vm = this;
    $vm.consts = consts.proxy;
    $vm.resolved = false;
    $vm.proxies = [];
    $vm.columns = [];
    $vm.graph_options = graph_options.get_options();
    $vm._graph_options_provider = graph_options;
    lum_proxies.subscribe(function(proxies){
        $vm.resolved = true;
        $vm.proxies = proxies;
        var always = ['zone', 'session_timeout', 'pool_size'];
        $vm.columns = opt_columns.filter(function(col){
            var key = col.key;
            return always.indexOf(key)>-1 || _.some(proxies, key);
        });
    });
}

proxy_table.prototype.$onDestroy = function(){
    this._graph_options_provider.release_options(); };

proxy_table.prototype.edit_proxy = function(proxy_old){
    var _proxy = proxy_old ? _.cloneDeep(proxy_old) : null;
    var _this = this;
    this.$mdDialog.show({
        controller: edit_controller,
        templateUrl: '/inc/dialog_settings.html',
        parent: angular.element(document.body),
        clickOutsideToClose: true,
        locals: {proxy: _proxy, consts: this.consts},
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
        promise.then(function(){ _this.lum_proxies.update(); });
    });
};

proxy_table.prototype.show_stats = function(proxy){
    this.$mdDialog.show({
        controller: stats_controller,
        templateUrl: '/inc/dialog_stats.html',
        parent: angular.element(document.body),
        clickOutsideToClose: true,
        locals: {proxy: proxy},
        fullscreen: true
    });
};

proxy_table.prototype.show_history = function(proxy){
    this.$mdDialog.show({
        controller: history_controller,
        templateUrl: '/inc/dialog_history.html',
        parent: angular.element(document.body),
        clickOutsideToClose: true,
        locals: {port: proxy.port, get_json: this.get_json},
        fullscreen: true,
    });
};

proxy_table.prototype.delete_proxy = function(proxy){
    var _this = this;
    var confirm = this.$mdDialog.confirm({ok: 'ok', cancel: 'cancel',
        title: 'Are you sure you want to delete proxy?'});
    this.$mdDialog.show(confirm).then(function(){
        return _this.$http.delete('/api/proxies/'+proxy.port);
    }).then(function(){ _this.lum_proxies.update(); });
};

function edit_controller($scope, $mdDialog, locals){
    $scope.form = _.get(locals, 'proxy', {});
    $scope.consts = locals.consts;
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

function history_controller($scope, $filter, $mdDialog, locals){
    $scope.history_fields = [
        {field: 'url', title: 'Url'},
        {field: 'method', title: 'Method'},
        {field: 'status_code', title: 'Code'},
        {field: 'timestamp', title: 'Time'},
        {field: 'elapsed', title: 'Elapsed'},
        {field: 'proxy', title: 'Proxy'},
    ];
    $scope.history_sort_field = 'timestamp';
    $scope.history_sort_asc = false;
    $scope.history_filters = {
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
    $scope.history_page = 1;
    $scope.history_update = function(changing_page){
        if (!changing_page)
            $scope.history_page = 1;
        var params = {
            page: $scope.history_page,
            sort: $scope.history_sort_field,
        };
        if (!$scope.history_sort_asc)
            params.sort_desc = 1;
        if ($scope.history_filters.url)
            params.url = $scope.history_filters.url;
        if ($scope.history_filters.method)
            params.method = $scope.history_filters.method;
        if ($scope.history_filters.status_code)
            params.status_code = $scope.history_filters.status_code;
        if ($scope.history_filters.timestamp_min)
        {
            params.timestamp_min = $scope.history_filters.timestamp_min
            .getTime();
        }
        if ($scope.history_filters.timestamp_max)
        {
            params.timestamp_max = $scope.history_filters.timestamp_max
            .getTime();
        }
        if ($scope.history_filters.elapsed_min)
            params.elapsed_min = $scope.history_filters.elapsed_min;
        if ($scope.history_filters.elapsed_max)
            params.elapsed_max = $scope.history_filters.elapsed_max;
        if ($scope.history_filters.proxy)
            params.proxy = $scope.history_filters.proxy;
        var params_arr = [];
        for (var param in params)
            params_arr.push(param+'='+params[param]);
        var url = '/api/history/'+locals.port+'?'+params_arr.join('&');
        $scope.history_loading = new Date();
        locals.get_json(url).then(function(history){
            $scope.history_loading = null;
            $scope.history = history.rows;
            $scope.history_pages_cnt = history.pages;
            $scope.history_page = history.page;
            $scope.history_methods = history.methods;
            $scope.history_status_codes = history.status_codes;
        });
    };
    $scope.history_show_loader = function(){
        return $scope.history_loading&&new Date()-$scope.history_loading>500;
    };
    $scope.history_sort = function(field){
        if ($scope.history_sort_field==field)
            $scope.history_sort_asc = !$scope.history_sort_asc;
        else
        {
            $scope.history_sort_field = field;
            $scope.history_sort_asc = true;
        }
        $scope.history_update();
    };
    $scope.history_filter = function(field){
        var options;
        if (field=='method')
            options = $scope.history_methods;
        else if (field=='status_code')
            options = $scope.history_status_codes;
        $mdDialog.show({
            controller: filter_controller(field),
            templateUrl: '/inc/filter_'+field+'.html',
            parent: angular.element(document.body),
            clickOutsideToClose: true,
            skipHide: true,
            locals: {
                filters: $scope.history_filters,
                update: $scope.history_update,
                options: options,
            },
        });
    };
    $scope.history_details = function(row){
        $mdDialog.show({
            controller: details_controller,
            templateUrl: '/inc/dialog_history_details.html',
            parent: angular.element(document.body),
            clickOutsideToClose: true,
            skipHide: true,
            locals: {row: row, fields: $scope.history_fields},
        });
    };
    $scope.history_pages = function(){
        var result = [];
        for (var i = 1; i <= $scope.history_pages_cnt; i++)
            result.push(i);
        return result;
    };
    $scope.history_set_page = function(page){
        $scope.history_page = page;
        $scope.history_update(true);
    };
    $scope.hide = $mdDialog.hide.bind($mdDialog);
    $scope.history_update();
}

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

});
