// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true*/

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

define(['regenerator-runtime', 'lodash', 'react', 'react-bootstrap', 'axios', 'hutil/etask', '/util.js'], function (rr, _, React, RB, axios, etask, util) {

    var E = {};

    var StatTable = function (_React$Component) {
        _inherits(StatTable, _React$Component);

        function StatTable() {
            _classCallCheck(this, StatTable);

            return _possibleConstructorReturn(this, (StatTable.__proto__ || Object.getPrototypeOf(StatTable)).apply(this, arguments));
        }

        _createClass(StatTable, [{
            key: 'render',
            value: function render() {
                var _this3 = this;

                var Row = this.props.row,
                    Table = RB.Table;
                return React.createElement(
                    'div',
                    null,
                    React.createElement(
                        'h4',
                        null,
                        this.props.title,
                        this.props.show_more && React.createElement(
                            'small',
                            null,
                            '\xA0',
                            React.createElement(
                                'a',
                                { href: this.props.path },
                                'show all'
                            )
                        )
                    ),
                    React.createElement(
                        Table,
                        { bordered: true, condensed: true },
                        React.createElement(
                            'thead',
                            null,
                            this.props.children
                        ),
                        React.createElement(
                            'tbody',
                            null,
                            this.props.stats.map(function (s) {
                                return React.createElement(Row, { stat: s, key: s[_this3.props.row_key || 'key'],
                                    path: _this3.props.path });
                            })
                        )
                    )
                );
            }
        }]);

        return StatTable;
    }(React.Component);

    var StatsService = function StatsService() {
        _classCallCheck(this, StatsService);
    };

    StatsService.base = '/api/request_stats';
    StatsService.get_top = etask._fn(regeneratorRuntime.mark(function _callee(_this) {
        var opt = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

        var res, assign, state, _arr, _i, k;

        return regeneratorRuntime.wrap(function _callee$(_context) {
            while (1) {
                switch (_context.prev = _context.next) {
                    case 0:
                        _context.next = 2;
                        return _this.get('top');

                    case 2:
                        res = _context.sent;
                        assign = Object.assign;

                        opt = assign({ reverse: true }, opt);
                        state = _.reduce(res, function (s, v, k) {
                            if (_.isInteger(+k)) return s.statuses.stats.push(assign({ status_code: k,
                                value: v.count, bw: v.bw }, v)) && s;
                            if (['http', 'https'].includes(k)) {
                                return s.protocols.stats.push(assign({ protocol: k, bw: v.bw,
                                    value: v.count }, v)) && s;
                            }
                            return s.domains.stats.push(assign({ hostname: k, value: v.count,
                                bw: v.bw }, v)) && s;
                        }, { statuses: { stats: [] }, domains: { stats: [] },
                            protocols: { stats: [] } });

                        if (!state.protocols.stats.some(_.matches({ protocol: 'https' }))) state.protocols.stats.push({ protocol: 'https', bw: 0, value: 0 });
                        if (opt.sort || opt.limit) {
                            _arr = ['statuses', 'domains', 'protocols'];

                            for (_i = 0; _i < _arr.length; _i++) {
                                k = _arr[_i];

                                state[k] = {
                                    has_more: state[k].stats.length > (opt.limit || Infinity),
                                    stats: _(state[k].stats)
                                };
                                if (opt.sort) {
                                    state[k].stats = state[k].stats.sortBy(_.isString(opt.sort) && opt.sort || 'value');
                                }
                                if (opt.limit) {
                                    state[k].stats = state[k].stats['take' + (opt.reverse && 'Right' || '')](opt.limit);
                                }
                                if (opt.reverse) state[k].stats = state[k].stats.reverse();
                                state[k].stats = state[k].stats.value();
                            }
                        }
                        return _context.abrupt('return', state);

                    case 9:
                    case 'end':
                        return _context.stop();
                }
            }
        }, _callee, this);
    }));
    StatsService.get_all = etask._fn(regeneratorRuntime.mark(function _callee2(_this) {
        var opt = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
        var res;
        return regeneratorRuntime.wrap(function _callee2$(_context2) {
            while (1) {
                switch (_context2.prev = _context2.next) {
                    case 0:
                        opt = Object.assign({ reverse: 1 }, opt);
                        _context2.next = 3;
                        return _this.get('all');

                    case 3:
                        res = _context2.sent;

                        if (opt.by) {
                            res = _(Object.values(res.reduce(function (s, v, k) {
                                var c = v[opt.by];
                                s[c] = s[c] || Object.assign({ value: 0, bw: 0 }, v);
                                s[c].value += 1;
                                s[c].bw += v.bw;
                                return s;
                            }, {})));
                        } else res = _(res);
                        if (opt.sort) res = res.sortBy(_.isString(opt.sort) && opt.sort || 'value');
                        if (opt.reverse) res = res.reverse();
                        return _context2.abrupt('return', res.value());

                    case 8:
                    case 'end':
                        return _context2.stop();
                }
            }
        }, _callee2, this);
    }));
    StatsService.reset = etask._fn(regeneratorRuntime.mark(function _callee3(_this) {
        return regeneratorRuntime.wrap(function _callee3$(_context3) {
            while (1) {
                switch (_context3.prev = _context3.next) {
                    case 0:
                        _context3.next = 2;
                        return _this.get('reset');

                    case 2:
                        return _context3.abrupt('return', _context3.sent);

                    case 3:
                    case 'end':
                        return _context3.stop();
                }
            }
        }, _callee3, this);
    }));
    StatsService.get = etask._fn(regeneratorRuntime.mark(function _callee4(_, stats) {
        var res;
        return regeneratorRuntime.wrap(function _callee4$(_context4) {
            while (1) {
                switch (_context4.prev = _context4.next) {
                    case 0:
                        _context4.next = 2;
                        return etask(function () {
                            return axios.get(StatsService.base + '/' + stats);
                        });

                    case 2:
                        res = _context4.sent;
                        return _context4.abrupt('return', res.data[stats]);

                    case 4:
                    case 'end':
                        return _context4.stop();
                }
            }
        }, _callee4, this);
    }));

    var StatsDetails = function (_React$Component2) {
        _inherits(StatsDetails, _React$Component2);

        function StatsDetails(props) {
            _classCallCheck(this, StatsDetails);

            var _this4 = _possibleConstructorReturn(this, (StatsDetails.__proto__ || Object.getPrototypeOf(StatsDetails)).call(this, props));

            _this4.page_change = function (page) {
                _this4.paginate(page - 1);
            };

            _this4.state = {
                stats: [],
                all_stats: props.stats || [],
                cur_page: 0,
                items_per_page: props.items_per_page || 10
            };
            return _this4;
        }

        _createClass(StatsDetails, [{
            key: 'componentWillReceiveProps',
            value: function componentWillReceiveProps(props) {
                var _this5 = this;

                var update = {};
                if (props.items_per_page != this.props.items_per_page) Object.assign(update, { items_per_page: props.items_per_page });
                if (props.stats != this.props.stats) Object.assign(update, { all_stats: props.stats });
                if (Object.keys(update).length) this.setState(update, function () {
                    return _this5.paginate();
                });
            }
        }, {
            key: 'componentDidMount',
            value: function componentDidMount() {
                this.paginate();
            }
        }, {
            key: 'paginate',
            value: function paginate() {
                var page = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : -1;

                page = page > -1 ? page : this.state.cur_page;
                var stats = this.state.all_stats;
                var cur_page = _.min([Math.ceil(stats.length / this.state.items_per_page), page]);
                this.setState({
                    all_stats: stats,
                    stats: stats.slice(cur_page * this.state.items_per_page, (cur_page + 1) * this.state.items_per_page),
                    cur_page: cur_page
                });
            }
        }, {
            key: 'render',
            value: function render() {
                var Col = RB.Col,
                    Table = RB.Table,
                    Pagination = RB.Pagination;

                return React.createElement(
                    'div',
                    null,
                    React.createElement(
                        'div',
                        { className: 'page-header' },
                        React.createElement(
                            'h3',
                            null,
                            this.props.header
                        )
                    ),
                    React.createElement(
                        'div',
                        { className: 'page-body' },
                        this.props.title,
                        React.createElement(
                            'h3',
                            null,
                            'Requests'
                        ),
                        React.createElement(
                            Table,
                            { bordered: true, className: 'table-fixed' },
                            React.createElement(
                                'thead',
                                null,
                                React.createElement(
                                    'tr',
                                    null,
                                    React.createElement(
                                        'th',
                                        { className: 'col-sm-8' },
                                        'URL'
                                    ),
                                    React.createElement(
                                        'th',
                                        null,
                                        'Bandwidth'
                                    ),
                                    React.createElement(
                                        'th',
                                        null,
                                        'Response time'
                                    ),
                                    React.createElement(
                                        'th',
                                        null,
                                        'IP used'
                                    )
                                )
                            ),
                            React.createElement(
                                'tbody',
                                null,
                                this.state.stats.map(function (s, i) {
                                    return React.createElement(
                                        'tr',
                                        { key: i },
                                        React.createElement(
                                            'td',
                                            { className: 'nowrap overflow-ellipsis' },
                                            s.url
                                        ),
                                        React.createElement(
                                            'td',
                                            null,
                                            util.bytes_format(s.bw)
                                        ),
                                        React.createElement(
                                            'td',
                                            null,
                                            s.response_time,
                                            ' ms'
                                        ),
                                        React.createElement(
                                            'td',
                                            null,
                                            s.proxy_peer
                                        )
                                    );
                                })
                            )
                        ),
                        React.createElement(
                            Col,
                            { md: 12, className: 'text-center' },
                            React.createElement(Pagination, { prev: true, next: true, activePage: this.state.cur_page + 1,
                                bsSize: 'small', onSelect: this.page_change,
                                items: Math.ceil(this.state.all_stats.length / this.state.items_per_page), maxButtons: 5 })
                        ),
                        this.props.children
                    )
                );
            }
        }]);

        return StatsDetails;
    }(React.Component);

    E.StatsDetails = StatsDetails;
    E.StatTable = StatTable;
    E.StatsService = StatsService;

    return E;
});