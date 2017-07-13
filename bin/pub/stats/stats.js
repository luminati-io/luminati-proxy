// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true*/

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

define(['regenerator-runtime', 'lodash', 'react', 'react-dom', 'react-bootstrap', 'axios', '/util.js', 'hutil/etask', 'hutil/date', '_css!animate'], function (rr, _, React, ReactDOM, RB, axios, util, etask, date) {

    var mount = void 0,
        ga_event = void 0;
    var E = {
        init_ga: function init_ga(ga) {
            return ga_event = ga;
        },
        install: function install(mnt) {
            E.sp = etask('lpm_stats', [function () {
                return this.wait();
            }]);
            ReactDOM.render(React.createElement(Stats, null), mount = mnt);
        },
        uninstall: function uninstall() {
            if (E.sp) E.sp.return();
            if (mount) ReactDOM.unmountComponentAtNode(mount);
            mount = null;
        }
    };

    var StatRow = function (_React$Component) {
        _inherits(StatRow, _React$Component);

        function StatRow(props) {
            _classCallCheck(this, StatRow);

            var _this2 = _possibleConstructorReturn(this, (StatRow.__proto__ || Object.getPrototypeOf(StatRow)).call(this, props));

            _this2.state = {};
            return _this2;
        }

        _createClass(StatRow, [{
            key: 'componentWillReceiveProps',
            value: function componentWillReceiveProps(props) {
                var _this3 = this;

                _.each(props.stat, function (v, k) {
                    if (!_this3.state['class_' + k] && _this3.props.stat[k] != v) {
                        _this3.setState(_defineProperty({}, 'class_' + k, 'stats_row_change'));
                        setTimeout(function () {
                            return _this3.setState(_defineProperty({}, 'class_' + k, undefined));
                        }, 1000);
                    }
                });
            }
        }]);

        return StatRow;
    }(React.Component);

    var StatusCodeRow = function (_StatRow) {
        _inherits(StatusCodeRow, _StatRow);

        function StatusCodeRow() {
            _classCallCheck(this, StatusCodeRow);

            return _possibleConstructorReturn(this, (StatusCodeRow.__proto__ || Object.getPrototypeOf(StatusCodeRow)).apply(this, arguments));
        }

        _createClass(StatusCodeRow, [{
            key: 'render',
            value: function render() {
                // XXX ranl/ovidiu: add tooltip in first td of each row.
                return React.createElement(
                    'tr',
                    null,
                    React.createElement(
                        'td',
                        null,
                        this.props.stat.code
                    ),
                    React.createElement('td', { className: 'hidden' }),
                    React.createElement(
                        'td',
                        { className: this.state.class_value },
                        this.props.stat.value
                    )
                );
            }
        }]);

        return StatusCodeRow;
    }(StatRow);

    var DomainRow = function (_StatRow2) {
        _inherits(DomainRow, _StatRow2);

        function DomainRow() {
            _classCallCheck(this, DomainRow);

            return _possibleConstructorReturn(this, (DomainRow.__proto__ || Object.getPrototypeOf(DomainRow)).apply(this, arguments));
        }

        _createClass(DomainRow, [{
            key: 'render',
            value: function render() {
                return React.createElement(
                    'tr',
                    null,
                    React.createElement(
                        'td',
                        null,
                        this.props.stat.hostname
                    ),
                    React.createElement('td', { className: 'hidden' }),
                    React.createElement(
                        'td',
                        { className: this.state.class_value },
                        this.props.stat.value
                    )
                );
            }
        }]);

        return DomainRow;
    }(StatRow);

    var ProtoRow = function (_StatRow3) {
        _inherits(ProtoRow, _StatRow3);

        function ProtoRow() {
            _classCallCheck(this, ProtoRow);

            return _possibleConstructorReturn(this, (ProtoRow.__proto__ || Object.getPrototypeOf(ProtoRow)).apply(this, arguments));
        }

        _createClass(ProtoRow, [{
            key: 'render',
            value: function render() {
                return React.createElement(
                    'tr',
                    null,
                    React.createElement(
                        'td',
                        null,
                        this.props.stat.proto.toUpperCase()
                    ),
                    React.createElement(
                        'td',
                        { className: this.state.class_bw },
                        util.bytes_format(this.props.stat.bw)
                    ),
                    React.createElement(
                        'td',
                        { className: this.state.class_value },
                        this.props.stat.value
                    )
                );
            }
        }]);

        return ProtoRow;
    }(StatRow);

    var StatTable = function (_React$Component2) {
        _inherits(StatTable, _React$Component2);

        function StatTable() {
            var _ref;

            var _temp, _this7, _ret;

            _classCallCheck(this, StatTable);

            for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
                args[_key] = arguments[_key];
            }

            return _ret = (_temp = (_this7 = _possibleConstructorReturn(this, (_ref = StatTable.__proto__ || Object.getPrototypeOf(StatTable)).call.apply(_ref, [this].concat(args))), _this7), _this7.enter = function () {
                var dt = _this7.props.dataType;
                E.sp.spawn(_this7.sp = etask(regeneratorRuntime.mark(function _callee() {
                    return regeneratorRuntime.wrap(function _callee$(_context) {
                        while (1) {
                            switch (_context.prev = _context.next) {
                                case 0:
                                    _context.next = 2;
                                    return etask.sleep(2 * date.ms.SEC);

                                case 2:
                                    ga_event('stats panel', 'hover', dt);

                                case 3:
                                case 'end':
                                    return _context.stop();
                            }
                        }
                    }, _callee, this);
                })));
            }, _this7.leave = function () {
                _this7.sp.return();
            }, _temp), _possibleConstructorReturn(_this7, _ret);
        }

        _createClass(StatTable, [{
            key: 'render',
            value: function render() {
                var _this8 = this;

                var Row = this.props.row;
                // XXX ranl/ovidiu: unhide small tag when rows are > 5
                // XXX ranl/ovidiu: link to main inner page by section
                return React.createElement(
                    'div',
                    { onMouseEnter: this.enter, onMouseLeave: this.leave },
                    React.createElement(
                        'h4',
                        null,
                        this.props.title,
                        ' ',
                        React.createElement(
                            'small',
                            { className: 'hidden' },
                            React.createElement(
                                'a',
                                { href: '#' },
                                'show all'
                            )
                        )
                    ),
                    React.createElement(
                        'table',
                        { className: 'table table-condensed table-bordered' },
                        React.createElement(
                            'thead',
                            null,
                            this.props.children
                        ),
                        React.createElement(
                            'tbody',
                            null,
                            this.props.stats.map(function (s) {
                                return React.createElement(Row, { stat: s, key: s[_this8.props.row_key || 'key'],
                                    path: _this8.props.path });
                            })
                        )
                    )
                );
            }
        }]);

        return StatTable;
    }(React.Component);

    var Stats = function (_React$Component3) {
        _inherits(Stats, _React$Component3);

        function Stats(props) {
            _classCallCheck(this, Stats);

            var _this9 = _possibleConstructorReturn(this, (Stats.__proto__ || Object.getPrototypeOf(Stats)).call(this, props));

            _this9.get_stats = etask._fn(regeneratorRuntime.mark(function _callee2(_this) {
                var _this10 = this;

                var _loop;

                return regeneratorRuntime.wrap(function _callee2$(_context3) {
                    while (1) {
                        switch (_context3.prev = _context3.next) {
                            case 0:
                                _loop = regeneratorRuntime.mark(function _loop() {
                                    var res, state;
                                    return regeneratorRuntime.wrap(function _loop$(_context2) {
                                        while (1) {
                                            switch (_context2.prev = _context2.next) {
                                                case 0:
                                                    _context2.next = 2;
                                                    return etask(function () {
                                                        return axios.get('/api/request_stats/top');
                                                    });

                                                case 2:
                                                    res = _context2.sent;
                                                    state = _.reduce(res.data.top, function (s, v, k) {
                                                        if (_.isInteger(+k)) return s.statuses.push({ code: k, value: v }) && s;
                                                        if (['http', 'https'].includes(k)) {
                                                            return s.protocols.push({ proto: k, bw: v.bw,
                                                                value: v.count }) && s;
                                                        }
                                                        return s.domains.push({ hostname: k, value: v }) && s;
                                                    }, { statuses: [], domains: [], protocols: [] });

                                                    if (!state.protocols.some(_.matches({ proto: 'https' }))) state.protocols.push({ proto: 'https', bw: 0, value: 0 });
                                                    ['statuses', 'domains', 'protocols'].forEach(function (k) {
                                                        return state[k] = _(state[k]).sortBy('value').take(5).reverse().value();
                                                    });
                                                    _this.setState(state);
                                                    _context2.next = 9;
                                                    return etask.sleep(date.ms.SEC);

                                                case 9:
                                                case 'end':
                                                    return _context2.stop();
                                            }
                                        }
                                    }, _loop, _this10);
                                });

                            case 1:
                                if (!true) {
                                    _context3.next = 5;
                                    break;
                                }

                                return _context3.delegateYield(_loop(), 't0', 3);

                            case 3:
                                _context3.next = 1;
                                break;

                            case 5:
                            case 'end':
                                return _context3.stop();
                        }
                    }
                }, _callee2, this);
            }));

            _this9.state = { statuses: [], domains: [], protocols: [] };
            return _this9;
        }

        _createClass(Stats, [{
            key: 'componentDidMount',
            value: function componentDidMount() {
                E.sp.spawn(this.get_stats());
            }
        }, {
            key: 'confirm',
            value: function confirm() {
                window.confirm("Are you sure?");
            }
        }, {
            key: 'render',
            value: function render() {
                var Button = RB.Button;
                return React.createElement(
                    'div',
                    { className: 'panel panel-default' },
                    React.createElement(
                        'div',
                        { className: 'panel-heading' },
                        React.createElement(
                            'div',
                            { className: 'row' },
                            React.createElement(
                                'div',
                                { className: 'col-md-6' },
                                'Recent statistics'
                            ),
                            React.createElement(
                                'div',
                                { className: 'col-md-6 text-right' },
                                React.createElement(
                                    'button',
                                    { type: 'button',
                                        className: 'btn btn-default btn-xs hidden',
                                        onClick: this.confirm },
                                    'Reset'
                                )
                            )
                        )
                    ),
                    React.createElement(
                        'div',
                        { className: 'panel-body' },
                        React.createElement(
                            StatTable,
                            { row: StatusCodeRow, path: '/status_codes',
                                row_key: 'code', title: 'Top ' + (_.min([5, this.state.statuses.length]) || '') + ' status codes',
                                stats: this.state.statuses, dataType: 'status_codes' },
                            React.createElement(
                                'tr',
                                null,
                                React.createElement(
                                    'th',
                                    { className: 'col-md-4' },
                                    'Status Code'
                                ),
                                React.createElement(
                                    'th',
                                    { className: 'hidden' },
                                    'Bandwidth'
                                ),
                                React.createElement(
                                    'th',
                                    null,
                                    'Number of requests'
                                )
                            )
                        ),
                        React.createElement(
                            StatTable,
                            { row: DomainRow, path: '/domains', row_key: 'hostname',
                                stats: this.state.domains, title: 'Top ' + (_.min([5, this.state.domains.length]) || '') + ' domains',
                                dataType: 'domains' },
                            React.createElement(
                                'tr',
                                null,
                                React.createElement(
                                    'th',
                                    { className: 'col-md-4' },
                                    'Domain Host'
                                ),
                                React.createElement(
                                    'th',
                                    { className: 'hidden' },
                                    'Bandwidth'
                                ),
                                React.createElement(
                                    'th',
                                    null,
                                    'Number of requests'
                                )
                            )
                        ),
                        React.createElement(
                            StatTable,
                            { row: ProtoRow, path: '/protocols', row_key: 'proto',
                                stats: this.state.protocols, title: 'Protocols',
                                dataType: 'protocols' },
                            React.createElement(
                                'tr',
                                null,
                                React.createElement(
                                    'th',
                                    { className: 'col-md-2' },
                                    'Type'
                                ),
                                React.createElement(
                                    'th',
                                    { className: 'col-md-2' },
                                    'Bandwidth'
                                ),
                                React.createElement(
                                    'th',
                                    null,
                                    'Number of Requests'
                                )
                            )
                        )
                    )
                );
            }
        }]);

        return Stats;
    }(React.Component);

    return E;
});