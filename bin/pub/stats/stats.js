// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true*/

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

define(['regenerator-runtime', 'lodash', 'react', 'react-dom', 'react-bootstrap', 'axios', '/util.js', 'hutil/etask', 'hutil/date', '/stats/common.js', '/stats/status_codes.js', '/stats/domains.js', '/stats/protocols.js', '_css!animate'], function (rr, _, React, ReactDOM, RB, axios, util, etask, date, Common, StatusCode, Domain, Protocol) {

    var mount = void 0,
        ga_event = void 0;
    var E = {
        init_ga: function init_ga(ga) {
            return ga_event = ga;
        },
        install: function install(mnt) {
            E.sp = etask('stats', [function () {
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
                return React.createElement(StatusCode.Row, _extends({ class_value: this.state.class_value,
                    class_bw: this.state.class_bw }, this.props));
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
                return React.createElement(Domain.Row, _extends({ class_value: this.state.class_value,
                    class_bw: this.state.class_bw }, this.props));
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
                return React.createElement(Protocol.Row, _extends({ class_value: this.state.class_value,
                    class_bw: this.state.class_bw }, this.props));
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
                var Table = this.props.table || Common.StatTable;
                return React.createElement(
                    'div',
                    { onMouseEnter: this.enter, onMouseLeave: this.leave },
                    React.createElement(Table, this.props)
                );
            }
        }]);

        return StatTable;
    }(React.Component);

    var CertificateButton = function (_React$Component3) {
        _inherits(CertificateButton, _React$Component3);

        function CertificateButton() {
            _classCallCheck(this, CertificateButton);

            return _possibleConstructorReturn(this, (CertificateButton.__proto__ || Object.getPrototypeOf(CertificateButton)).apply(this, arguments));
        }

        _createClass(CertificateButton, [{
            key: 'render',
            value: function render() {
                return React.createElement(
                    'div',
                    { className: 'col-md-6 col-md-offset-3 text-center' },
                    React.createElement(
                        Button,
                        { className: 'btn btn-success' },
                        'Enable HTTPS statistics'
                    )
                );
            }
        }]);

        return CertificateButton;
    }(React.Component);

    var Stats = function (_React$Component4) {
        _inherits(Stats, _React$Component4);

        function Stats(props) {
            _classCallCheck(this, Stats);

            var _this9 = _possibleConstructorReturn(this, (Stats.__proto__ || Object.getPrototypeOf(Stats)).call(this, props));

            _this9.get_stats = etask._fn(regeneratorRuntime.mark(function _callee2(_this) {
                var res, state, _arr, _i, k;

                return regeneratorRuntime.wrap(function _callee2$(_context2) {
                    while (1) {
                        switch (_context2.prev = _context2.next) {
                            case 0:
                                if (!true) {
                                    _context2.next = 13;
                                    break;
                                }

                                _context2.next = 3;
                                return etask(function () {
                                    return axios.get('/api/request_stats/top');
                                });

                            case 3:
                                res = _context2.sent;
                                state = _.reduce(res.data.top, function (s, v, k) {
                                    if (_.isInteger(+k)) return s.statuses.stats.push({ code: k, value: v.count,
                                        bw: v.bw }) && s;
                                    if (['http', 'https'].includes(k)) {
                                        return s.protocols.stats.push({ proto: k, bw: v.bw,
                                            value: v.count }) && s;
                                    }
                                    return s.domains.stats.push({ hostname: k, value: v.count,
                                        bw: v.bw }) && s;
                                }, { statuses: { stats: [] }, domains: { stats: [] },
                                    protocols: { stats: [] } });

                                if (!state.protocols.stats.some(_.matches({ proto: 'https' }))) state.protocols.stats.push({ proto: 'https', bw: 0, value: 0 });
                                _arr = ['statuses', 'domains', 'protocols'];
                                for (_i = 0; _i < _arr.length; _i++) {
                                    k = _arr[_i];

                                    state[k] = {
                                        show_more: state[k].stats.length > 5,
                                        stats: _(state[k].stats).sortBy('value').take(5).reverse().value()
                                    };
                                }
                                _this.setState(state);
                                _context2.next = 11;
                                return etask.sleep(date.ms.SEC);

                            case 11:
                                _context2.next = 0;
                                break;

                            case 13:
                            case 'end':
                                return _context2.stop();
                        }
                    }
                }, _callee2, this);
            }));

            _this9.close = function () {
                return _this9.setState({ show_reset: false });
            };

            _this9.confirm = function () {
                return _this9.setState({ show_reset: true });
            };

            _this9.reset_stats = function () {
                if (_this9.state.resetting) return;
                _this9.setState({ resetting: true });
                var _this = _this9;
                E.sp.spawn(etask(regeneratorRuntime.mark(function _callee3() {
                    return regeneratorRuntime.wrap(function _callee3$(_context3) {
                        while (1) {
                            switch (_context3.prev = _context3.next) {
                                case 0:
                                    _context3.next = 2;
                                    return etask(function () {
                                        return axios.get('/api/request_stats/reset');
                                    });

                                case 2:
                                    _this.setState({ resetting: undefined });
                                    _this.close();

                                case 4:
                                case 'end':
                                    return _context3.stop();
                            }
                        }
                    }, _callee3, this);
                })));
            };

            _this9.state = {
                statuses: { stats: [] },
                domains: { stats: [] },
                protocols: { stats: [] }
            };
            return _this9;
        }

        _createClass(Stats, [{
            key: 'componentDidMount',
            value: function componentDidMount() {
                E.sp.spawn(this.get_stats());
            }
        }, {
            key: 'render',
            value: function render() {
                var Button = RB.Button,
                    ButtonToolbar = RB.ButtonToolbar,
                    Row = RB.Row,
                    Col = RB.Col,
                    Panel = RB.Panel,
                    Modal = RB.Modal;

                return React.createElement(
                    Panel,
                    { header: React.createElement(
                            Row,
                            null,
                            React.createElement(
                                Col,
                                { md: 6 },
                                'Recent statistics'
                            ),
                            React.createElement(
                                Col,
                                { md: 6, className: 'text-right' },
                                React.createElement(
                                    Button,
                                    { bsSize: 'xsmall', onClick: this.confirm },
                                    'Reset'
                                )
                            )
                        ) },
                    React.createElement(StatTable, { table: StatusCode.Table, row: StatusCodeRow,
                        title: 'Top ' + (_.min([5, this.state.statuses.stats.length]) || '') + '\n                    status codes', dataType: 'status_codes',
                        stats: this.state.statuses.stats,
                        show_more: this.state.statuses.show_more }),
                    React.createElement(StatTable, { table: Domain.Table, row: DomainRow,
                        dataType: 'domains', stats: this.state.domains.stats,
                        show_more: this.state.domains.show_more,
                        title: 'Top ' + (_.min([5, this.state.domains.stats.length]) || '') + '\n                    domains' }),
                    React.createElement(StatTable, { table: Protocol.Table, row: ProtoRow,
                        dataType: 'protocols', stats: this.state.protocols.stats,
                        show_more: this.state.protocols.show_more }),
                    React.createElement(
                        Modal,
                        { show: this.state.show_reset, onHide: this.close },
                        React.createElement(
                            Modal.Header,
                            { closeButton: true },
                            React.createElement(
                                Modal.Title,
                                null,
                                'Reset stats'
                            )
                        ),
                        React.createElement(
                            Modal.Body,
                            null,
                            React.createElement(
                                'h4',
                                null,
                                'Are you sure you want to reset stats?'
                            )
                        ),
                        React.createElement(
                            Modal.Footer,
                            null,
                            React.createElement(
                                ButtonToolbar,
                                null,
                                React.createElement(
                                    Button,
                                    { bsStyle: 'primary', onClick: this.reset_stats,
                                        disabled: this.state.resetting },
                                    this.state.resetting ? 'Resetting...' : 'OK'
                                ),
                                React.createElement(
                                    Button,
                                    { onClick: this.close },
                                    'Cancel'
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