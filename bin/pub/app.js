// LICENSE_CODE ZON ISC
'use strict'; /*jslint browser:true*/
define(['angular', 'socket.io-client', 'lodash', 'moment', 'angular-chart',
    'jquery', 'bootstrap', 'bootstrap-datepicker', '_css!app'],
function(angular, io, _, moment){

var module = angular.module('app', []);

module.run(function($rootScope, $window){
    $window.Chart.defaults.global.colors = ['#803690', '#00ADF9', '#46BFBD',
        '#FDB45C', '#949FB1', '#4D5360'];
    var l = $window.location.pathname;
    if (l.match(/zones\/[^\/]+/))
    {
        $rootScope.section = 'zones';
        $rootScope.subsection = l.split('/').pop();
    }
    else
        $rootScope.section = l.split('/').pop();
});

module.factory('$proxies', $proxies);
$proxies.$inject = ['$http', '$window'];
function $proxies($http, $window){
    var service = {
        subscribe: subscribe,
        subscribe_stats: subscribe_stats,
        proxies: null,
        update: update_proxies
    };
    var listeners = [];
    var listeners_stats = [];
    service.update();
    io().on('stats', stats_event);
    return service;
    function subscribe(func){
        listeners.push(func);
        if (service.proxies)
            func(service.proxies);
    }
    function subscribe_stats(func){
        listeners_stats.push(func);
    }
    function update_proxies(){
        return $window.Promise.all([$http.get('/api/proxies_running'),
            $http.get('/api/proxies')]).then(function(data){
            var proxies = data[0].data;
            var config = data[1].data;
            var config_index = {};
            for (var i=0; i<config.length; i++)
                config_index[config[i].port] = config[i];
            proxies.forEach(function(proxy){
                proxy.stats = {
                    total: {
                        active_requests: [],
                        status: {codes: ['2xx'], values: [[]]},
                        max: {requests: 0, codes: 0},
                    },
                    ticks: [],
                };
                proxy.config = config_index[proxy.port];
                var data = _.values(proxy._stats);
                proxy.total_stats = {
                    requests: _.sumBy(data, 'total_requests'),
                    inbound: _.sumBy(data, 'total_inbound'),
                    outbound: _.sumBy(data, 'total_outbound'),
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
                    canvas.att_scope.$apply();
                }
            });
            listeners_stats.forEach(function(cb){ cb(stats_chunk); });
        }
    }
}

module.controller('root', root);
root.$inject = ['$rootScope', '$scope', '$http', '$window'];
function root($rootScope, $scope, $http, $window){
    $scope.sections = [
        {name: 'settings', title: 'Settings'},
        {name: 'proxies', title: 'Proxies'},
        {name: 'zones', title: 'Zones'},
        {name: 'tools', title: 'Tools'},
    ];
    for (var s in $scope.sections)
    {
        if ($scope.sections[s].name==$rootScope.section)
        {
            $scope.section = $scope.sections[s];
            break;
        }
    }
    $http.get('/api/creds').then(function(settings){
        $scope.settings = settings.data;
        if (!$scope.settings.customer&&$scope.section.name!='settings')
            $window.location = 'settings';
    });
    $http.get('/api/version').then(function(version){
        $scope.ver_cur = version.data.version;
    });
    $http.get('/api/last_version').then(function(version){
        $scope.ver_last = version.data.version;
    });
    $http.get('/api/consts').then(function(consts){
        $scope.consts = consts.data;
    });
}

module.controller('settings', settings);
settings.$inject = ['$scope', '$http'];
function settings($scope, $http){
    $http.get('/api/status').then(function(status){
        $scope.status = status.data;
    });
    $scope.save = function(){
        $scope.saving = true;
        $scope.error = false;
        $scope.saved = false;
        $http.post('/api/creds', {
            customer: $scope.$parent.settings.customer.trim(),
            password: $scope.$parent.settings.password.trim(),
            proxy: $scope.$parent.settings.proxy.trim(),
            proxy_port: $scope.$parent.settings.proxy_port,
        }).error(function(){
            $scope.saving = false;
            $scope.error = true;
        }).then(function(settings){
            $scope.$parent.settings = settings.data;
            $scope.saving = false;
            $scope.saved = true;
            $scope.status = {
                status: 'ok',
                description: 'Your proxy is up and running, but you might '
                    +' need to restart the application.',
            };
        });
    };
}

module.controller('zones', zones);
zones.$inject = ['$scope', '$http', '$filter'];
function zones($scope, $http, $filter){
    var today = new Date();
    var oneDayAgo = (new Date()).setDate(today.getDate()-1);
    var twoDaysAgo = (new Date()).setDate(today.getDate()-2);
    var oneMonthAgo = (new Date()).setMonth(today.getMonth()-1, 1);
    var twoMonthsAgo = (new Date()).setMonth(today.getMonth()-2, 1);
    $scope.times = [
        {title: moment(twoMonthsAgo).format('MMM-YYYY'), key: 'back_m2'},
        {title: moment(oneMonthAgo).format('MMM-YYYY'), key: 'back_m1'},
        {title: moment(today).format('MMM-YYYY'), key: 'back_m0'},
        {title: moment(twoDaysAgo).format('DD-MMM-YYYY'), key: 'back_d2'},
        {title: moment(oneDayAgo).format('DD-MMM-YYYY'), key: 'back_d1'},
        {title: moment(today).format('DD-MMM-YYYY'), key: 'back_d0'},
    ];
    var numberFilter = $filter('requests');
    var sizeFilter = $filter('bytes');
    $scope.fields = [
        {key: 'http_svc_req', title: 'HTTP', filter: numberFilter},
        {key: 'https_svc_req', title: 'HTTPS', filter: numberFilter},
        {key: 'bw_up', title: 'Upload', filter: sizeFilter},
        {key: 'bw_dn', title: 'Download', filter: sizeFilter},
        {key: 'bw_sum', title: 'Total Bandwidth', filter: sizeFilter}
    ];
    $http.get('/api/stats').then(function(stats){
        $scope.stats = stats.data;
        if (!Object.keys($scope.stats).length)
            $scope.error = true;
    })
    .catch(function(e){ $scope.error = true; });
    $http.get('/api/whitelist').then(function(whitelist){
        $scope.whitelist = whitelist.data;
    });
    $http.get('/api/recent_ips').then(function(recent_ips){
        $scope.recent_ips = recent_ips.data;
    });
}

module.controller('test', test);
test.$inject = ['$scope', '$http', '$filter', '$window'];
function test($scope, $http, $filter, $window){
    var preset = JSON.parse(decodeURIComponent(($window.location.search.match(
        /[?&]test=([^&]+)/)||['', 'null'])[1]));
    if (preset)
    {
        $scope.expand = true;
        $scope.proxy = ''+preset.port;
        $scope.url = preset.url;
        $scope.method = preset.method;
        $scope.body = preset.body;
    }
    $http.get('/api/proxies').then(function(proxies){
        $scope.proxies = [['0', 'No proxy']];
        for (var i=0; i<proxies.data.length; i++)
        {
            $scope.proxies.push(
                [''+proxies.data[i].port, ''+proxies.data[i].port]);
        }
    });
    $scope.methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'COPY', 'HEAD',
        'OPTIONS', 'LINK', 'UNLINK', 'PURGE', 'LOCK', 'UNLOCK', 'PROPFIND',
        'VIEW'];
    $scope.request = {};
    $scope.go = function(proxy, url, method, headers, body){
        var headers_obj = {};
        headers.forEach(function(h){ headers_obj[h.key] = h.value; });
        var req = {
            method: 'POST',
            url: '/api/test/'+proxy,
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
    $scope.headers = preset&&preset.headers ? Object.keys(preset.headers).map(
        function(h){
        return {key: h, value: preset.headers[h]};
    }) : [];
    $scope.add_header = function(){
        $scope.headers.push({key: '', value: ''});
    };
    $scope.remove_header = function(index){
        $scope.headers.splice(index, 1);
    };
    $scope.reset = function(){
        $scope.headers = [];
    };
}

module.controller('countries', countries);
countries.$inject = ['$scope', '$http', '$window'];
function countries($scope, $http, $window){
    $scope.url = '';
    $scope.ua = '';
    $scope.path = '';
    $scope.headers = [];
    $scope.started = 0;
    $scope.num_loading = 0;
    $scope.add_header = function(){
        $scope.headers.push({key: '', value: ''});
    };
    $scope.remove_header = function(index){
        $scope.headers.splice(index, 1);
    };
    var normalize_headers = function(headers){
        var result = {};
        for (var h in headers)
            result[headers[h].key] = headers[h].value;
        return result;
    };
    $scope.go = function(){
        var process = function(){
            $scope.started++;
            $scope.countries = [];
            var max_concur = 4;
            $scope.num_loading = 0;
            $scope.cur_index = 0;
            var progress = function(apply){
                while ($scope.cur_index<$scope.countries.length&&
                    $scope.num_loading<max_concur)
                {
                    if ($scope.countries[$scope.cur_index].status == 0)
                    {
                        $scope.countries[$scope.cur_index].status = 1;
                        $scope.countries[$scope.cur_index].img.src =
                        $scope.countries[$scope.cur_index].url;
                        $scope.num_loading++;
                    }
                    $scope.cur_index++;
                }
                if (apply)
                    $scope.$apply();
            };
            var nheaders = JSON.stringify(normalize_headers($scope.headers));
            for (var c_index in $scope.$parent.consts.proxy.country.values)
            {
                var c = $scope.$parent.consts.proxy.country.values[c_index];
                if (!c.value)
                    continue;
                var params = {
                    country: c.value,
                    url: $scope.url,
                    path: $scope.path,
                    ua: $scope.ua,
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
                    index: $scope.countries.length,
                };
                data.img.onerror = (function(data, started){
                    return function(){
                        if ($scope.started!=started)
                            return;
                        data.status = 3;
                        $scope.num_loading--;
                        progress(true);
                    };
                })(data, $scope.started);
                data.img.onload = (function(data, started){
                    return function(){
                        if ($scope.started!=started)
                            return;
                        data.status = 4;
                        $scope.num_loading--;
                        progress(true);
                    };
                })(data, $scope.started);
                $scope.countries.push(data);
            }
            progress(false);
        };
        if ($scope.started)
        {
            $scope.$parent.$parent.confirmation = {
                text: 'The currently made screenshots will be lost. '
                    +'Do you want to continue?',
                confirmed: process,
            };
            $window.$('#confirmation').modal();
        }
        else
            process();
    };
    $scope.view = function(country){
        $scope.screenshot = {
            country: country.name,
            url: country.url,
        };
        $window.$('#countries-screenshot').one('shown.bs.modal', function(){
            $window.$('#countries-screenshot .modal-body > div')
            .scrollTop(0).scrollLeft(0);
        }).modal();
    };
    $scope.cancel = function(country){
        if (country.status==0)
            country.status = 2;
        else if (country.status==1)
            country.img.src = '';
    };
    $scope.cancel_all = function(){
        $scope.$parent.$parent.confirmation = {
            text: 'Do you want to stop all the remaining countries?',
            confirmed: function(){
                    for (var c_i=$scope.countries.length-1; c_i>=0; c_i--)
                    {
                        var country = $scope.countries[c_i];
                        if (country.status<2)
                            $scope.cancel(country);
                    }
                },
            };
        $window.$('#confirmation').modal();
    };
    $scope.retry = function(country){
        if ($scope.cur_index>country.index)
        {
            country.status = 1;
            country.url = country.url.replace(/&\d+$/, '')
            +'&'+new Date().getTime();
            $scope.num_loading++;
            country.img.src = country.url;
        }
        else
            country.status = 0;
    };
}

module.controller('proxies', proxies);
proxies.$inject = ['$scope', '$http', '$proxies', '$window'];
function proxies($scope, $http, $proxies, $window){
    var opt_columns = [
        {
            key: 'port',
            title: 'Port',
            type: 'number',
            check: function(v){
                return v.match(/^\d+$/)&&v>=24000;
            },
        },
        {key: 'super_proxy', title: 'Host'},
        {
            key: 'zone',
            title: 'Zone',
            type: 'text',
            check: function(v){
                return v.trim();
            },
        },
        {key: 'socks', title: 'SOCKS'},
        {
            key: 'country',
            title: 'Country',
            type: 'options',
            options: function(){
                return $scope.$parent.consts.proxy.country.values;
            },
        },
        {key: 'state', title: 'State'},
        {key: 'city', title: 'City'},
        {key: 'asn', title: 'ASN'},
        {key: 'cid', title: 'Client ID'},
        {key: 'ip', title: 'IP'},
        {key: 'session_init_timeout', title: 'Session init timeout'},
        {key: 'dns', title: 'DNS'},
        {key: 'request_timeout', title: 'Request Timeout'},
        {key: 'resolve', title: 'Resolve'},
        {key: 'pool_size', title: 'Pool size'},
        {key: 'pool_type', title: 'Pool type'},
        {key: 'proxy_count', title: 'Minimum proxies count'},
        {
            key: 'sticky_ip',
            title: 'Sticky IP',
            type: 'boolean',
        },
        {key: 'keep_alive', title: 'Keep-alive'},
        {key: 'allow_proxy_auth', title: 'Allow request authentication'},
        {
            key: 'max_requests',
            title: 'Max requests',
            type: 'number',
            check: function(v){
                return v.match(/^\d+$/);
            },
        },
        {key: 'session_duration', title: 'Max session duration'},
        {key: 'throttle', title: 'Throttle concurrent connections'},
        {key: 'log', title: 'Log Level'},
        {key: 'debug', title: 'Luminati debug'},
    ];
    $scope.columns = opt_columns.filter(function(col){
        return ['port', 'zone', 'country', 'max_requests', 'sticky_ip']
        .indexOf(col.key)!=-1;
    });
    $proxies.subscribe(function(proxies){
        $scope.proxies = proxies;
        $scope.$apply();
    });
    $proxies.subscribe_stats(function(stats){
        if (!$scope.proxies)
            return;
        for (var i=0; i<$scope.proxies.length; i++)
        {
            var data = _.values(stats[$scope.proxies[i].port]);
            $scope.proxies[i].total_stats = {
                requests: _.sumBy(data, 'total_requests'),
                inbound: _.sumBy(data, 'total_inbound'),
                outbound: _.sumBy(data, 'total_outbound'),
            };
        }
        $scope.$apply();
    });
    $scope.delete_proxy = function(proxy){
        $scope.$parent.$parent.confirmation = {
            text: 'Are you sure you want to delete the proxy?',
            confirmed: function(){
                $http.delete('/api/proxies/'+proxy.port).then(function(){
                    $proxies.update();
                });
            },
        };
        $window.$('#confirmation').modal();
    };
    $scope.show_stats = function(proxy){
        $scope.selected_proxy = proxy;
        var stats = $scope.selected_proxy.stats;
        var total = stats.total;
        $scope.requests = [total.active_requests];
        $scope.requests_series = ['Active requests'];
        $scope.codes = total.status.values;
        $scope.codes_series = total.status.codes;
        $scope.labels = stats.ticks;
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
                canvas.att_chart = new $window.Chart(canvas, params);
                canvas.att_scope = $scope;
            });
        }, 0);
        $window.$('#stats').modal();
    };
    $scope.show_history = function(proxy){
        $scope.history_dialog = [{port: proxy.port}];
    };
    $scope.edit_proxy = function(proxy, duplicate){
        $scope.proxy_dialog = [{proxy: proxy||{}, duplicate: duplicate}];
    };
    $scope.inline_edit_click = function(proxy, col){
        if (!proxy.persist)
            return;
        switch (col.type)
        {
        case 'number':
        case 'text':
        case 'options': proxy.edited_field = col.key; break;
        case 'boolean':
            var config = _.cloneDeep(proxy.config);
            config[col.key] = !config[col.key];
            config.persist = true;
            $http.put('/api/proxies/'+proxy.port, {proxy: config}).then(
                function(){ $proxies.update(); });
            break;
        }
    };
    $scope.inline_edit_input = function(proxy, col, event){
        if (event.which==27)
            return $scope.inline_edit_blur(proxy);
        var v = event.currentTarget.value;
        var p = $window.$(event.currentTarget).closest('.proxies-table-input');
        if (col.check(v))
            p.removeClass('has-error');
        else
        {
            p.addClass('has-error');
            return;
        }
        if (event.which!=13)
            return;
        if (col.type=='number')
            v = +v;
        if (col.type=='text')
            v = v.trim();
        if (proxy.config[col.key]==v)
            return $scope.inline_edit_blur(proxy);
        var config = _.cloneDeep(proxy.config);
        config[col.key] = v;
        config.persist = true;
        $http.put('/api/proxies/'+proxy.port, {proxy: config}).then(
            function(){ $proxies.update(); });
    };
    $scope.inline_edit_select = function(proxy, col, event){
        if (event.which==27)
            return $scope.inline_edit_blur(proxy);
    };
    $scope.inline_edit_select_change = function(proxy, col, v){
        if (proxy.config[col.key]==v)
            return $scope.inline_edit_blur(proxy);
        var config = _.cloneDeep(proxy.config);
        config[col.key] = v;
        config.persist = true;
        $http.put('/api/proxies/'+proxy.port, {proxy: config}).then(
            function(){ $proxies.update(); });
    };
    $scope.inline_edit_blur = function(proxy){
        proxy.edited_field = '';
    };
    $scope.reset_total_stats = function(proxy){
        $http.put('/api/proxies/'+proxy.port, {reset_total_stats: true});
    };
}

module.controller('history', history);
history.$inject = ['$scope', '$http', '$filter', '$window'];
function history($scope, $http, $filter, $window){
    $scope.init = function(locals){
        var loader_delay = 100;
        $scope.initial_loading = true;
        $scope.port = locals.port;
        $scope.show_modal = function(){ $window.$('#history').modal(); };
        $scope.fields = [
            {
                field: 'url',
                title: 'Url',
                type: 'string',
                filter_label: 'URL or substring',
            },
            {
                field: 'method',
                title: 'Method',
                type: 'options',
                filter_label: 'Request method',
            },
            {
                field: 'status_code',
                title: 'Code',
                type: 'number',
                filter_label: 'Response code',
            },
            {
                field: 'timestamp',
                title: 'Time',
                type: 'daterange',
            },
            {
                field: 'elapsed',
                title: 'Elapsed',
                type: 'numrange',
            },
            {
                field: 'country',
                title: 'Country',
                type: 'options',
                filter_label: 'Node country',
            },
            {
                field: 'proxy',
                title: 'Proxy',
                type: 'string',
                filter_label: 'Proxy or substring',
            },
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
            country: '',
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
                params.timestamp_min = moment($scope.filters.timestamp_min,
                    'YYYY/MM/DD').valueOf();
            }
            if ($scope.filters.timestamp_max)
            {
                params.timestamp_max = moment($scope.filters.timestamp_max,
                    'YYYY/MM/DD').add(1, 'd').valueOf();
            }
            if ($scope.filters.elapsed_min)
                params.elapsed_min = $scope.filters.elapsed_min;
            if ($scope.filters.elapsed_max)
                params.elapsed_max = $scope.filters.elapsed_max;
            if ($scope.filters.country)
                params.country = $scope.filters.country;
            if ($scope.filters.proxy)
                params.proxy = $scope.filters.proxy;
            var params_arr = [];
            for (var param in params)
                params_arr.push(param+'='+encodeURIComponent(params[param]));
            var url = '/api/'+(export_type ? 'har' : 'history')+'/'+locals.port
            +'?'+params_arr.join('&');
            if (export_type)
                $window.location = url;
            else
            {
                $scope.loading = new Date().getTime();
                setTimeout(function(){ $scope.$apply(); }, loader_delay);
                $http.get(url).then(function(history){
                    history = history.data;
                    $scope.initial_loading = false;
                    $scope.loading = false;
                    $scope.loading_page = false;
                    $scope.history = history.map(function(r){
                        var alerts = [];
                        var disabled_alerts = [];
                        var add_alert = function(alert){
                            if (localStorage.getItem(
                                'request-alert-disabled-'+alert.type))
                            {
                                disabled_alerts.push(alert);
                            }
                            else
                                alerts.push(alert);
                        };
                        var request_headers = JSON.parse(r.request_headers);
                        if (!request_headers['user-agent'])
                        {
                            add_alert({
                                type: 'agent_empty',
                                title: 'Empty user agent',
                                description: 'The User-Agent header '
                                    +'is not set to any value.',
                            });
                        }
                        else if (!request_headers['user-agent'].match(
                            /^Mozilla\//))
                        {
                            add_alert({
                                type: 'agent_suspicious',
                                title: 'Suspicious user agent',
                                description: 'The User-Agent header is set to '
                                    +'a value not corresponding to any of the '
                                    +'major web browsers.',
                            });
                        }
                        if (!request_headers.accept)
                        {
                            add_alert({
                                type: 'accept_empty',
                                title: 'Empty accept types',
                                description: 'The Accept header is not set to '
                                    +'any value.',
                            });
                        }
                        if (!request_headers['accept-encoding'])
                        {
                            add_alert({
                                type: 'accept_encoding_empty',
                                title: 'Empty accept encoding',
                                description: 'The Accept-Encoding header is '
                                    +'not set to any value.',
                            });
                        }
                        if (!request_headers['accept-language'])
                        {
                            add_alert({
                                type: 'accept_language_empty',
                                title: 'Empty accept language',
                                description: 'The Accept-Language header is '
                                    +'not set to any value.',
                            });
                        }
                        if (request_headers.connection != 'keep-alive')
                        {
                            add_alert({
                                type: 'connection_suspicious',
                                title: 'Suspicious connection type',
                                description: 'The Connection header is not '
                                    +'set to "keep-alive".',
                            });
                        }
                        if (!r.url.match(/^https?:\/\/[^\/\?]+\/?$/)
                            &&!request_headers.referer)
                        {
                            add_alert({
                                type: 'referer_empty',
                                title: 'Empty referrer',
                                description: 'The Referer header is not set '
                                    +'even though the requested URL is not '
                                    +'the home page of the site.',
                            });
                        }
                        r.alerts = alerts;
                        r.disabled_alerts = disabled_alerts;
                        return r;
                    });
                    var history_cnt = $scope.history.length;
                    var timings = ['node_latency', 'response_time', 'elapsed'];
                    var timings_val = {};
                    var timing, i;
                    for (i=0; i<timings.length; i++)
                    {
                        timing = timings[i];
                        timings_val[timing] = {
                            min: Number.MAX_VALUE,
                            max: -1,
                            sum: 0,
                        };
                    }
                    $scope.history.forEach(function(r){
                        for (var i=0; i<timings.length; i++)
                        {
                            var timing = timings[i];
                            timings_val[timing].min = Math.min(
                                timings_val[timing].min, r[timing]);
                            timings_val[timing].max = Math.max(
                                timings_val[timing].max, r[timing]);
                            timings_val[timing].sum += r[timing];
                        }
                    });
                    $scope.timings = [];
                    for (i=0; i<timings.length; i++)
                    {
                        timing = timings[i];
                        $scope.timings.push([
                            timing.replace(/_/g, ' '),
                            timings_val[timing].min,
                            Math.round(timings_val[timing].sum/history_cnt),
                            timings_val[timing].max,
                        ]);
                    }
                });
            }
        };
        $scope.show_loader = function(){
            return $scope.loading
            &&new Date().getTime()-$scope.loading>=loader_delay;
        };
        $scope.show_next = function(){
            return $scope.loading_page||$scope.history&&
            $scope.history.length>=$scope.page*$scope.page_size;
        };
        $scope.sort = function(field){
            if ($scope.sort_field==field.field)
                $scope.sort_asc = !$scope.sort_asc;
            else
            {
                $scope.sort_field = field.field;
                $scope.sort_asc = true;
            }
            $scope.update();
        };
        $scope.filter = function(field){
            var options;
            if (field.field=='method')
            {
                options = ['', 'GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'COPY',
                    'HEAD', 'OPTIONS', 'LINK', 'UNLINK', 'PURGE', 'LOCK',
                    'UNLOCK', 'PROPFIND', 'VIEW', 'TRACE', 'CONNECT'].map(
                    function(e){ return {key: e, value: e}; }
                );
            }
            else if (field.field=='country')
                options = $scope.$parent.$parent.consts.proxy.country.values;
            $scope.filter_dialog = [{
                field: field,
                filters: $scope.filters,
                update: $scope.update,
                options: options,
            }];
            setTimeout(function(){
                $window.$('#history_filter').one('shown.bs.modal', function(){
                    $window.$('#history_filter .history-filter-autofocus')
                    .select().focus();
                }).modal();
            }, 0);
        };
        $scope.filter_cancel = function(field){
            if (field.field=='elapsed')
            {
                $scope.filters.elapsed_min = '';
                $scope.filters.elapsed_max = '';
            }
            if (field.field=='timestamp')
            {
                $scope.filters.timestamp_min = null;
                $scope.filters.timestamp_max = null;
            }
            $scope.filters[field.field] = '';
            $scope.update();
        };
        $scope.details = function(row){
            $scope.details_dialog = [{
                row: row,
                fields: $scope.fields,
                update: $scope.update,
            }];
            setTimeout(function(){
                $window.$('#history_details').modal();
            }, 0);
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
        $scope.update();
    };
}

module.controller('history_filter', history_filter);
history_filter.$inject = ['$scope', '$window'];
function history_filter($scope, $window){
    $scope.init = function(locals){
        $scope.field = locals.field;
        var field = locals.field.field;
        var range = field=='elapsed'||field=='timestamp';
        $scope.value = {composite: locals.filters[field]};
        if (range)
        {
            $scope.value.min = locals.filters[field+'_min'];
            $scope.value.max = locals.filters[field+'_max'];
        }
        $scope.options = locals.options;
        $scope.keypress = function(event){
            if (event.which==13)
            {
                $scope.apply();
                $window.$('#history_filter').modal('hide');
            }
        };
        $scope.daterange = function(event){
            $window.$(event.currentTarget).closest('.input-group')
            .datepicker({
                autoclose: true,
                format: 'yyyy/mm/dd',
            }).datepicker('show');
        };
        $scope.apply = function(){
            if (range)
            {
                var display_min, display_max;
                display_min = $scope.value.min;
                display_max = $scope.value.max;
                if ($scope.value.min&&$scope.value.max)
                    $scope.value.composite = display_min+'-'+display_max;
                else if ($scope.value.min)
                    $scope.value.composite = 'From '+display_min;
                else if ($scope.value.max)
                    $scope.value.composite = 'Up to '+display_max;
                else
                    $scope.value.composite = '';
                locals.filters[field+'_min'] = $scope.value.min;
                locals.filters[field+'_max'] = $scope.value.max;
            }
            if ($scope.value.composite!=locals.filters[field])
            {
                locals.filters[field] = $scope.value.composite;
                locals.update();
            }
        };
    };
}

module.controller('history_details', history_details);
history_details.$inject = ['$scope'];
function history_details($scope){
    $scope.init = function(locals){
        $scope.row = locals.row;
        var request_headers = JSON.parse($scope.row.request_headers);
        $scope.request_headers = Object.keys(request_headers).map(
            function(key){
                return [key, request_headers[key]];
            });
        var response_headers = JSON.parse($scope.row.response_headers);
        $scope.response_headers = Object.keys(response_headers).map(
            function(key){
                return [key, response_headers[key]];
            });
        $scope.timings = [
            ['Proxy peer latency', $scope.row.node_latency+' ms'],
            ['Response sent', $scope.row.response_time+' ms'],
            ['Response received', $scope.row.elapsed+' ms'],
        ];
        $scope.alerts = $scope.row.alerts;
        $scope.disabled_alerts = $scope.row.disabled_alerts;
        $scope.fields = locals.fields;
        $scope.disable_alert = function(type){
            localStorage.setItem('request-alert-disabled-'+type, 1);
            for (var i=0; i<$scope.alerts.length; i++)
            {
                if ($scope.alerts[i].type==type)
                {
                    $scope.disabled_alerts.push($scope.alerts[i]);
                    $scope.alerts.splice(i, 1);
                    break;
                }
            }
            locals.update();
        };
        $scope.enable_alert = function(type){
            localStorage.removeItem('request-alert-disabled-'+type);
            for (var i=0; i<$scope.disabled_alerts.length; i++)
            {
                if ($scope.disabled_alerts[i].type==type)
                {
                    $scope.alerts.push($scope.disabled_alerts[i]);
                    $scope.disabled_alerts.splice(i, 1);
                    break;
                }
            }
            locals.update();
        };
    };
}

module.controller('proxy', proxy);
proxy.$inject = ['$scope', '$http', '$proxies', '$window'];
function proxy($scope, $http, $proxies, $window){
    $scope.init = function(locals){
        $scope.port = locals.duplicate ? '' : locals.proxy.port;
        $scope.form = _.cloneDeep(locals.proxy);
        $scope.form.port = $scope.port;
        if (!$scope.form.port||$scope.form.port=='')
        {
            var port = 24000;
            $scope.proxies.forEach(function(p){
                if (p.port >= port)
                    port = p.port+1;
            });
            $scope.form.port = port;
        }
        $scope.consts = $scope.$parent.$parent.$parent.$parent.consts.proxy;
        $scope.show_modal = function(){
            $window.$('#proxy').one('shown.bs.modal', function(){
                $window.$('#proxy-field-port').select().focus();
                $window.$('#proxy .panel-collapse').on('show.bs.collapse',
                    function(event){
                    var container = $window.$('#proxy .proxies-settings');
                    var opening = $window.$(event.currentTarget).closest(
                        '.panel');
                    var pre = opening.prevAll('.panel');
                    var top;
                    if (pre.length)
                    {
                        top = opening.position().top+container.scrollTop();
                        var closing = pre.find('.panel-collapse.in');
                        if (closing.length)
                            top -= closing.height();
                    }
                    else
                        top = 0;
                    container.animate({'scrollTop': top}, 250);
                });
            }).modal();
        };
        $scope.save = function(proxy){
            $window.$('#proxy').modal('hide');
            proxy.persist = true;
            var data = {proxy: proxy};
            var promise;
            if ($scope.port&&!locals.duplicate)
                promise = $http.put('/api/proxies/'+$scope.port, data);
            else
                promise = $http.post('/api/proxies', data);
            promise.then(function(){ $proxies.update(); });
        };
    };
}

module.filter('timestamp', timestampFilter);
timestampFilter.$inject = [];
function timestampFilter(){
    return function(timestamp){
        return moment(timestamp).format('YYYY/MM/DD HH:mm');
    };
}

module.filter('requests', requestsFilter);
requestsFilter.$inject = ['$filter'];
function requestsFilter($filter){
    var numberFilter = $filter('number');
    return function(requests, precision){
        if (requests==0 || isNaN(parseFloat(requests))
            || !isFinite(requests))
        {
            return '';
        }
        if (typeof precision==='undefined')
            precision = 0;
        return numberFilter(requests, precision);
    };
}

module.filter('bytes', bytesFilter);
bytesFilter.$inject = ['$filter'];
function bytesFilter($filter){
    var numberFilter = $filter('number');
    return function(bytes, precision){
        if (bytes==0 || isNaN(parseFloat(bytes)) || !isFinite(bytes))
            return '';
        var number = Math.floor(Math.log(bytes) / Math.log(1024));
        if (typeof precision==='undefined')
            precision = number ? 2 : 0;
        return numberFilter(bytes / Math.pow(1024, Math.floor(number)),
            precision)+' '+['B', 'KB', 'MB', 'GB', 'TB', 'PB'][number];
    };
}

module.filter('request', requestFilter);
function requestFilter(){
    return function(r){
        return '/tools?test='+encodeURIComponent(JSON.stringify({
            port: r.port,
            url: r.url,
            method: r.method,
            body: r.request_body,
            headers: JSON.parse(r.request_headers),
        }));
    };
}

module.directive('initInputSelect', ['$window', function($window){
    return {
        restrict: 'A',
        link: function(scope, element, attrs){
            setTimeout(function(){
                element.select().focus();
            }, 100); // before changing check for input type=number in Firefox
        },
    };
}]);

module.directive('initSelectOpen', ['$window', function($window){
    return {
        restrict: 'A',
        link: function(scope, element, attrs){
            setTimeout(function(){
                element.focus();
                var event = new $window.MouseEvent('mousedown');
                element[0].dispatchEvent(event);
            }, 0);
        },
    };
}]);

angular.bootstrap(document, ['app']);

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

});
