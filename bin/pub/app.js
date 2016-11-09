// LICENSE_CODE ZON ISC
'use strict'; /*jslint browser:true*/
define(['angular', 'socket.io-client', 'lodash', 'moment',
    'codemirror/lib/codemirror', 'codemirror/mode/javascript/javascript',
    'angular-chart', 'jquery', 'angular-sanitize', 'bootstrap',
    'bootstrap-datepicker', '_css!app'],
function(angular, io, _, moment, codemirror){

var module = angular.module('app', ['ngSanitize']);

module.run(function($rootScope, $http, $window){
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
    $http.get('/api/mode').then(function(mode){
        $rootScope.mode = mode.data.mode;
    });
});

module.factory('$proxies', $proxies);
$proxies.$inject = ['$http', '$q'];
function $proxies($http, $q){
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
        return $q.all([$http.get('/api/proxies_running'),
            $http.get('/api/proxies')]).then(function(data){
            var proxies = data[0].data;
            proxies.sort(function(a, b){ return a.port>b.port ? 1 : -1; });
            var config = data[1].data;
            config.sort(function(a, b){ return a.port>b.port ? 1 : -1; });
            var config_index = {};
            for (var i=0; i<config.length; i++)
                config_index[config[i].port] = config[i];
            proxies.forEach(function(proxy){
                if (Array.isArray(proxy.proxy)&&proxy.proxy.length==1)
                    proxy.proxy = proxy.proxy[0];
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
    $scope.quickstart = function(){
        return $window.localStorage.getItem('quickstart')=='show';
    };
    $scope.quickstart_completed = function(s){
        return $window.localStorage.getItem('quickstart-'+s);
    };
    $scope.quickstart_dismiss = function(){
        var mc = $window.$('body > .main-container-qs');
        var qs = $window.$('body > .quickstart');
        var w = qs.outerWidth();
        mc.animate({marginLeft: 0, width: '100%'});
        qs.animate({left: -w}, {done: function(){
            $window.localStorage.setItem('quickstart', 'dismissed');
            $scope.$apply();
        }});
    };
    $scope.sections = [
        {name: 'settings', title: 'Settings'},
        {name: 'proxies', title: 'Proxies'},
        {name: 'zones', title: 'Zones'},
        {name: 'tools', title: 'Tools'},
        {name: 'faq', title: 'FAQ'},
    ];
    for (var s in $scope.sections)
    {
        if ($scope.sections[s].name==$rootScope.section)
        {
            $scope.section = $scope.sections[s];
            break;
        }
    }
    $http.get('/api/settings').then(function(settings){
        $scope.settings = settings.data;
        if (!$scope.settings.request_disallowed&&!$scope.settings.customer)
        {
            if ($scope.section.name!='settings')
                $window.location = 'settings';
            else if (!$window.localStorage.getItem('quickstart'))
                $window.localStorage.setItem('quickstart', 'show');
        }
    });
    $http.get('/api/ip').then(function(ip){
        $scope.ip = ip.data.ip;
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
    $http.get('/api/node_version').then(function(node){
        $scope.ver_node = node.data;
    });
    var show_reload = function(){
        $window.$('#restarting').modal({
            backdrop: 'static',
            keyboard: false,
        });
    };
    var check_reload = function(){
        $http.get('/api/config').error(
            function(){ setTimeout(check_reload, 500); })
        .then(function(){ $window.location.reload(); });
    };
    $scope.upgrade = function(){
        $scope.confirmation = {
            text: 'The application will be upgraded and restarted.',
            confirmed: function(){
                $scope.upgrading = true;
                $http.post('/api/upgrade').error(function(){
                    $scope.upgrading = false;
                    $scope.upgrade_error = true;
                }).then(function(data){
                    $scope.upgrading = false;
                    show_reload();
                    check_reload();
                });
            },
        };
        $window.$('#confirmation').modal();
    };
}

module.controller('config', config);
config.$inject = ['$scope', '$http', '$window'];
function config($scope, $http, $window){
    $http.get('/api/config').then(function(config){
        $scope.config = config.data.config;
        setTimeout(function(){
            $scope.codemirror = codemirror.fromTextArea(
                $window.$('#config-textarea').get(0), {mode: 'javascript'});
        }, 0);
    });
    var show_reload = function(){
        $window.$('#restarting').modal({
            backdrop: 'static',
            keyboard: false,
        });
    };
    var check_reload = function(){
        $http.get('/api/config').error(
            function(){ setTimeout(check_reload, 500); })
        .then(function(){ $window.location.reload(); });
    };
    $scope.save = function(){
        $scope.$parent.$parent.$parent.confirmation = {
            text: 'Editing the configuration manually may result in your '
                +'proxies working incorrectly. Do you still want to modify '
                +'the configuration file?',
            confirmed: function(){
                $scope.config = $scope.codemirror.getValue();
                show_reload();
                $http.post('/api/config', {config: $scope.config})
                .then(check_reload);
            },
        };
        $window.$('#confirmation').modal();
    };
    $scope.update = function(){
        $http.get('/api/config').then(function(config){
            $scope.config = config.data.config;
            $scope.codemirror.setValue($scope.config);
        });
    };
    $window.$('#config-panel')
    .on('hidden.bs.collapse', $scope.update)
    .on('show.bs.collapse', function(){
        setTimeout(function(){
            $scope.codemirror.scrollTo(0, 0);
            $scope.codemirror.refresh();
        }, 0);
    });
    $scope.cancel = function(){
        $window.$('#config-panel > .collapse').collapse('hide');
    };
}

module.controller('resolve', resolve);
resolve.$inject = ['$scope', '$http', '$window'];
function resolve($scope, $http, $window){
    $scope.resolve = {text: ''};
    $scope.update = function(){
        $http.get('/api/resolve').then(function(resolve){
            $scope.resolve.text = resolve.data.resolve;
        });
    };
    $scope.update();
    var show_reload = function(){
        $window.$('#restarting').modal({
            backdrop: 'static',
            keyboard: false,
        });
    };
    var check_reload = function(){
        $http.get('/api/config').error(
            function(){ setTimeout(check_reload, 500); })
        .then(function(){ $window.location.reload(); });
    };
    $scope.save = function(){
        show_reload();
        $http.post('/api/resolve', {resolve: $scope.resolve.text})
        .then(check_reload);
    };
    $window.$('#resolve-panel')
    .on('hidden.bs.collapse', $scope.update)
    .on('show.bs.collapse', function(){
        setTimeout(function(){
            $window.$('#resolve-textarea').scrollTop(0).scrollLeft(0);
        }, 0);
    });
    $scope.cancel = function(){
        $window.$('#resolve-panel > .collapse').collapse('hide');
    };
    $scope.new_host = function(){
        $window.$('#resolve_add').one('shown.bs.modal', function(){
            $window.$('#resolve_add input').select();
        }).modal();
    };
    $scope.add_host = function(){
        $scope.adding = true;
        $scope.error = false;
        var host = $scope.host.host.trim();
        $http.get('/api/resolve_host/'+host)
        .then(function(ips){
            $scope.adding = false;
            if (ips.data.ips&&ips.data.ips.length)
            {
                for (var i=0; i<ips.data.ips.length; i++)
                    $scope.resolve.text += '\n'+ips.data.ips[i]+' '+host;
                setTimeout(function(){
                    var textarea = $window.$('#resolve-textarea');
                    textarea.scrollTop(textarea.prop('scrollHeight'));
                }, 0);
                $scope.host.host = '';
                $scope.resolve_frm.$setPristine();
                $window.$('#resolve_add').modal('hide');
            }
            else
                $scope.error = true;
        });
    };
}

module.controller('settings', settings);
settings.$inject = ['$scope', '$http', '$window', '$sce'];
function settings($scope, $http, $window, $sce){
    $http.get('/api/status').then(function(status){
        $scope.status = status.data;
        $scope.status.description =
            $sce.trustAsHtml($scope.status.description);
    });
    $scope.ssl_missing =
        $scope.$parent.settings.history&&!$scope.$parent.settings.ssl;
    $scope.resolve_missing =
        !$scope.$parent.settings.resolve&&$scope.$parent.settings.socks;
    var parse_username = function(username){
        var values = {};
        username = username.split('-');
        username.shift();
        var p = 0;
        while (p+1 < username.length)
        {
            values[username[p]] = username[p+1];
            p += 2;
        }
        return values;
    };
    $scope.parse_arguments = function(args){
        return args.replace(/(--password )(.+?)( --|$)/, '$1|||$2|||$3')
        .split('|||');
    };
    $scope.show_password = function(){
        $scope.args_password = true;
    };
    $scope.fix_username = function(){
        var customer = ($scope.$parent.settings.customer||'').trim();
        var zone = ($scope.$parent.settings.zone||'').trim();
        if (!customer.match(/^lum-/))
            return false;
        var values = parse_username(customer);
        if (!values.customer)
            return false;
        $scope.$parent.settings.customer = values.customer;
        if (!values.zone||values.zone==zone)
            return true;
        $scope.$parent.$parent.confirmation = {
            text: 'It appears you have entered a composite username which '
                +'contains a zone name. Do you want "'+values.zone+'" to be '
                +'your default zone?',
            confirmed: function(){
                $scope.$parent.settings.zone = values.zone;
            },
        };
        $window.$('#confirmation').modal();
        return true;
    };
    var modals_time = 400;
    var show_reload = function(){
        $window.$('#restarting').modal({
            backdrop: 'static',
            keyboard: false,
        });
    };
    var check_reload = function(){
        $http.get('/api/config').error(
            function(){ setTimeout(check_reload, 500); })
        .then(function(){ $window.location.reload(); });
    };
    $scope.save = function(){
        if ($scope.fix_username())
            return;
        $scope.saving = true;
        $http.post('/api/creds', {
            customer: $scope.$parent.settings.customer.trim(),
            zone: $scope.$parent.settings.zone.trim(),
            password: $scope.$parent.settings.password.trim(),
        }).then(function(){
            $scope.saving = false;
            $window.localStorage.setItem('quickstart-creds', true);
            show_reload();
            check_reload();
        });
    };
    $scope.shutdown = function(){
        $scope.$parent.$parent.confirmation = {
            text: 'Are you sure you want to shut down the local proxies?',
            confirmed: function(){
                $http.post('/api/shutdown');
                setTimeout(function(){
                    $window.$('#shutdown').modal({
                        backdrop: 'static',
                        keyboard: false,
                    });
                }, modals_time);
            },
        };
        $window.$('#confirmation').modal();
    };
    $window.$('#creds-popover').popover({html: true});
    $window.$($window.document).on('click', function(e){
        $window.$('[data-toggle="popover"], [data-original-title]').each(
            function(){
            if (!$window.$(this).is(e.target) &&
                $window.$(this).has(e.target).length==0 &&
                $window.$('.popover').has(e.target).length==0)
            {
                (($window.$(this).popover('hide').data('bs.popover')||{})
                    .inState||{}).click = false;
            }
        });
    });
}

module.controller('zones', zones);
zones.$inject = ['$scope', '$http', '$filter', '$window'];
function zones($scope, $http, $filter, $window){
    $window.localStorage.setItem('quickstart-zones-tools', true);
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
    $scope.edit_zone = function(zone){
        $window.location = 'https://luminati.io/cp/zones/'+zone;
    };
}

module.controller('faq', faq);
faq.$inject = ['$scope'];
function faq($scope){
    $scope.questions = [
        {
            name: 'upgrade',
            title: 'How can I upgrade Luminati proxy manager tool?',
        },
        {
            name: 'ssl',
            title: 'How do I enable HTTPS sniffing?',
        },
    ];
}

module.controller('test', test);
test.$inject = ['$scope', '$http', '$filter', '$window'];
function test($scope, $http, $filter, $window){
    $window.localStorage.setItem('quickstart-zones-tools', true);
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
    else
        $scope.method = 'GET';
    $http.get('/api/proxies').then(function(proxies){
        $scope.proxies = [['0', 'No proxy']];
        proxies.data.sort(function(a, b){ return a.port>b.port ? 1 : -1; });
        for (var i=0; i<proxies.data.length; i++)
        {
            $scope.proxies.push(
                [''+proxies.data[i].port, ''+proxies.data[i].port]);
        }
        if (!$scope.proxy)
            $scope.proxy = $scope.proxies[1][0];
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

module.filter('startFrom', function(){
    return function(input, start){
        return input.slice(+start);
    };
});

module.controller('proxies', proxies);
proxies.$inject = ['$scope', '$http', '$proxies', '$window'];
function proxies($scope, $http, $proxies, $window){
    var prepare_opts = function(opts){
        var res = [];
        for (var i=0; i<opts.length; i++)
            res.push({key: opts[i], value: opts[i]});
        return res;
    };
    var iface_opts = prepare_opts($scope.$parent.consts.proxy.iface.values);
    var country_opts = $scope.$parent.consts.proxy.country.values;
    var pool_type_opts = prepare_opts(
        $scope.$parent.consts.proxy.pool_type.values);
    var dns_opts = prepare_opts($scope.$parent.consts.proxy.dns.values);
    var log_opts = prepare_opts($scope.$parent.consts.proxy.log.values);
    var opt_columns = [
        {
            key: 'port',
            title: 'Port',
            type: 'number',
            check: function(v){
                return v.match(/^\d+$/)&&v>=24000;
            },
        },
        {
            key: 'iface',
            title: 'Interface',
            type: 'options',
            options: function(){
                return iface_opts;
            },
        },
        {
            key: 'ssl',
            title: 'SSL sniffing',
            type: 'boolean',
        },
        {
            key: 'socks',
            title: 'SOCKS port',
            type: 'number',
            check: function(v){
                return v.trim()==''||v.trim().match(/^\d+$/);
            },
        },
        {
            key: 'zone',
            title: 'Zone',
            type: 'text',
            check: function(v){
                return true;
            },
        },
        {
            key: 'secure_proxy',
            title: 'SSL for super proxy',
            type: 'boolean',
        },
        {
            key: 'country',
            title: 'Country',
            type: 'options',
            options: function(){
                return country_opts;
            },
        },
        {
            key: 'state',
            title: 'State',
            type: 'text',
            check: function(v){
                return true;
            },
        },
        {
            key: 'city',
            title: 'City',
            type: 'text',
            check: function(v){
                return true;
            },
        },
        {
            key: 'asn',
            title: 'ASN',
            type: 'number',
            check: function(v){
                return v.trim()==''||v.trim().match(/^\d+$/)&&v<400000;
            },
        },
        {
            key: 'ip',
            title: 'Datacenter IP',
            type: 'text',
            check: function(v){
                v = v.trim();
                if (v=='')
                    return true;
                var m = v.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
                if (!m)
                    return false;
                for (var i=1; i<=4; i++)
                {
                    if (m[i]!=='0'&&m[i].charAt(0)=='0'||m[i]>255)
                        return false;
                }
                return true;
            },
        },
        {
            key: 'max_requests',
            title: 'Max requests',
            type: 'number',
            check: function(v){
                return v.trim()==''||v.trim().match(/^\d+$/);
            },
        },
        {
            key: 'session_duration',
            title: 'Session duration (sec)',
            type: 'number',
            check: function(v){
                return v.trim()==''||v.trim().match(/^\d+$/);
            },
        },
        {
            key: 'pool_size',
            title: 'Pool size',
            type: 'number',
            check: function(v){
                return v.trim()==''||v.trim().match(/^\d+$/);
            },
        },
        {
            key: 'pool_type',
            title: 'Pool type',
            type: 'options',
            options: function(){
                return pool_type_opts;
            },
        },
        {
            key: 'sticky_ip',
            title: 'Sticky IP',
            type: 'boolean',
        },
        {
            key: 'keep_alive',
            title: 'Keep-alive',
            type: 'number',
            check: function(v){
                return v.trim()==''||v.trim().match(/^\d+$/);
            },
        },
        {
            key: 'allow_proxy_auth',
            title: 'Allow request authentication',
            type: 'boolean',
        },
        {
            key: 'session_init_timeout',
            title: 'Session init timeout (sec)',
            type: 'number',
            check: function(v){
                return v.trim()==''||v.trim().match(/^\d+$/);
            },
        },
        {
            key: 'proxy_count',
            title: 'Min number of super proxies',
            type: 'number',
            check: function(v){
                return v.trim()==''||v.trim().match(/^\d+$/);
            },
        },
        {
            key: 'dns',
            title: 'DNS',
            type: 'options',
            options: function(){
                return dns_opts;
            },
        },
        {
            key: 'log',
            title: 'Log Level',
            type: 'options',
            options: function(){
                return log_opts;
            },
        },
        {
            key: 'proxy_switch',
            title: 'Autoswitch super proxy on failure',
            type: 'number',
            check: function(v){
                return v.trim()==''||v.trim().match(/^\d+$/);
            },
        },
        {
            key: 'throttle',
            title: 'Throttle concurrent connections',
            type: 'number',
            check: function(v){
                return v.trim()==''||v.trim().match(/^\d+$/);
            },
        },
        {
            key: 'request_timeout',
            title: 'Request timeout (sec)',
            type: 'number',
            check: function(v){
                return v.trim()==''||v.trim().match(/^\d+$/);
            },
        },
        {
            key: 'proxy',
            title: 'Super proxy IP or country',
            type: 'text',
            check: function(v){
                v = v.trim();
                if (v==''||v.match(/^[a-z][a-z]$/))
                    return true;
                var m = v.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
                if (!m)
                    return false;
                for (var i=1; i<=4; i++)
                {
                    if (m[i]!=='0'&&m[i].charAt(0)=='0'||m[i]>255)
                        return false;
                }
                return true;
            },
        },
        {
            key: 'debug',
            title: 'Debug info',
            type: 'text',
            check: function(v){
                return v.trim()==''||v.trim().match(/^(none|full)$/);
            },
        },
    ];
    var default_cols = {
        port: true,
        zone: true,
        country: true,
        max_requests: true,
        sticky_ip: true,
    };
    $scope.cols_conf = JSON.parse(
        $window.localStorage.getItem('columns'))||_.cloneDeep(default_cols);
    $scope.page_size = 50;
    $scope.page = 1;
    $scope.set_page = function(p){
        if (p < 1)
            p = 1;
        if (p*$scope.page_size>$scope.proxies.length)
            p = Math.ceil($scope.proxies.length/$scope.page_size);
        $scope.page = p;
    };
    $scope.columns = function(){
        return opt_columns.filter(function(col){
            return $scope.cols_conf[col.key];
        });
    };
    $proxies.subscribe(function(proxies){
        $scope.proxies = proxies;
        $scope.set_page($scope.page);
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
    $scope.refresh_sessions = function(proxy){
        $http.post('/api/refresh_sessions/'+proxy.port).then(function(){
            $proxies.update();
        });
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
    $scope.show_pool = function(proxy){
        $scope.pool_dialog = [{port: proxy.port}];
    };
    $scope.show_iface_ips = function(proxy){
        $scope.iface_ips_dialog = [{port: proxy.port, ips: proxy._iface_ips}];
    };
    $scope.edit_proxy = function(proxy, duplicate){
        $scope.proxy_dialog = [{proxy: proxy||{}, duplicate: duplicate}];
    };
    $scope.edit_cols = function(){
        $scope.columns_dialog = [{
            columns: opt_columns,
            cols_conf: $scope.cols_conf,
            default_cols: default_cols,
        }];
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
            config[col.key] = !proxy[col.key];
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
            v = v.trim()=='' ? null : +v;
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
    $scope.hola_headers = [];
    $http.get('/api/hola_headers').then(function(h){
        $scope.hola_headers = h.data;
    });
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
                field: 'super_proxy',
                title: 'Super Proxy',
                type: 'string',
                filter_label: 'Super proxy or substring',
            },
            {
                field: 'proxy_peer',
                title: 'Proxy Peer',
                type: 'string',
                filter_label: 'IP or substring',
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
            super_proxy: '',
            proxy_peer: '',
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
            if ($scope.filters.super_proxy)
                params.super_proxy = $scope.filters.super_proxy;
            if ($scope.filters.proxy_peer)
                params.proxy_peer = $scope.filters.proxy_peer;
            if ($scope.archive>-1)
                params.archive = $scope.archive_timestamps[$scope.archive];
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
                            if (r.method=='CONNECT'
                                ||request_headers.host=='lumtest.com')
                            {
                                return;
                            }
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
                        if (r.method=='GET'
                            &&!r.url.match(/^https?:\/\/[^\/\?]+\/?$/)
                            &&!r.url.match(/[^\w]favicon[^\w]/)
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
                        if (r.url
                            .match(/^https?:\/\/\d+\.\d+\.\d+\.\d+[$\/\?]/))
                        {
                            add_alert({
                                type: 'ip_url',
                                title: 'IP URL',
                                description: 'The url uses IP and not '
                                    +'hostname, it will not be served from the'
                                    +' proxy peer. It could mean a resolve '
                                    +'configuration issue when using SOCKS.',
                            });
                        }
                        var sensitive_headers = [];
                        for (var i in $scope.hola_headers)
                        {
                            if (request_headers[$scope.hola_headers[i]])
                                sensitive_headers.push($scope.hola_headers[i]);
                        }
                        if (sensitive_headers.length)
                        {
                            add_alert({
                                type: 'sensitive_header',
                                title: 'Sensitive request header',
                                description: (sensitive_headers.length>1 ?
                                    'There are sensitive request headers' :
                                    'There is sensitive request header')
                                    +' in the request: '
                                    +sensitive_headers.join(', '),
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
        $scope.archive = -1;
        $http.get('/api/archive_timestamps').then(function(timestamps){
            $scope.archive_timestamps = timestamps.data.timestamps;
        });
        $scope.archive_name = function(index){
            if (!$scope.archive_timestamps)
                return '';
            var date = function(index){
                return moment($scope.archive_timestamps[index])
                .format('YYYY/MM/DD');
            };
            if (index==$scope.archive_timestamps.length-1)
                return 'Up to '+date(index);
            return 'From '+date(index+1)+' until '
            +(index==-1 ? 'now' : date(index));
        };
        $scope.show_archives = function(){
            var sel = $window.$('#history_archives select');
            sel.val($scope.archive);
            $window.$('#history_archives').one('shown.bs.modal', function(){
                sel.focus();
            }).modal();
        };
        $scope.archive_apply = function(){
            var val = +$window.$('#history_archives select').val();
            if ($scope.archive!=val)
            {
                $scope.archive = val;
                $scope.update();
            }
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

module.controller('pool', pool);
pool.$inject = ['$scope', '$http', '$window'];
function pool($scope, $http, $window){
    $scope.init = function(locals){
        $scope.port = locals.port;
        $scope.show_modal = function(){ $window.$('#pool').modal(); };
        $scope.update = function(refresh){
            $scope.pool = null;
            $http.get('/api/sessions/'+$scope.port+(refresh ? '?refresh' : ''))
            .then(function(pool){
                $scope.pool = pool.data;
            });
        };
        $scope.update();
    };
}

module.controller('iface_ips', iface_ips);
iface_ips.$inject = ['$scope', '$window'];
function iface_ips($scope, $window){
    $scope.init = function(locals){
        $scope.port = locals.port;
        $scope.ips = locals.ips;
        $scope.show_modal = function(){ $window.$('#iface_ips').modal(); };
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
            var socks = $scope.form.socks;
            $scope.proxies.forEach(function(p){
                if (p.port >= port)
                    port = p.port+1;
                if (socks && p.socks==socks)
                    socks++;
            });
            $scope.form.port = port;
            $scope.form.socks = socks;
        }
        $scope.consts = $scope.$parent.$parent.$parent.$parent.consts.proxy;
        $scope.defaults = {};
        $http.get('/api/defaults').then(function(defaults){
            $scope.defaults = defaults.data;
        });
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
        $scope.binary_changed = function(proxy, field, value){
            proxy[field] = {'yes': true, 'no': false, 'default': ''}[value];
        };
        $scope.save = function(proxy){
            $window.$('#proxy').modal('hide');
            proxy.persist = true;
            var data = {proxy: proxy};
            var promise;
            var edit = $scope.port&&!locals.duplicate;
            if (edit)
                promise = $http.put('/api/proxies/'+$scope.port, data);
            else
                promise = $http.post('/api/proxies', data);
            promise.then(function(){
                $proxies.update();
                $window.localStorage.setItem('quickstart-'+
                    (edit ? 'edit' : 'create')+'-proxy', true);
            });
        };
    };
}

module.controller('columns', columns);
columns.$inject = ['$scope', '$window'];
function columns($scope, $window){
    $scope.init = function(locals){
        $scope.columns = locals.columns;
        $scope.form = _.cloneDeep(locals.cols_conf);
        $scope.show_modal = function(){
            $window.$('#proxy-cols').modal();
        };
        $scope.save = function(config){
            $window.$('#proxy-cols').modal('hide');
            $window.localStorage.setItem('columns', JSON.stringify(config));
            for (var c in config)
                locals.cols_conf[c] = config[c];
        };
        $scope.all = function(){
            for (var c in $scope.columns)
                $scope.form[$scope.columns[c].key] = true;
        };
        $scope.none = function(){
            for (var c in $scope.columns)
                $scope.form[$scope.columns[c].key] = false;
        };
        $scope.default = function(){
            for (var c in $scope.columns)
            {
                $scope.form[$scope.columns[c].key] =
                    locals.default_cols[$scope.columns[c].key];
            }
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
        var number = Math.floor(Math.log(bytes) / Math.log(1000));
        if (typeof precision==='undefined')
            precision = number ? 2 : 0;
        return numberFilter(bytes / Math.pow(1000, Math.floor(number)),
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

module.filter('actualizeZone', actualizeZoneFilter);
actualizeZoneFilter.$inject = ['$sce'];
function actualizeZoneFilter($sce){
    return function(input, zone){
        return $sce.trustAsHtml($sce.valueOf(input).replace('[[zone]]', zone));
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
            }, 100);
        },
    };
}]);

module.filter('shorten', shortenFilter);
shortenFilter.$inject = ['$filter'];
function shortenFilter($filter){
    return function(s, chars){
        if (s.length<=chars+2)
            return s;
        return s.substr(0, chars)+'...';
    };
}

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
