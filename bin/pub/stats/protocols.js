
// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true*/

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

define(['regenerator-runtime', 'lodash', 'react', 'react-dom', 'react-bootstrap', 'axios', '/util.js', 'hutil/etask', 'hutil/date', '/stats/common.js', '_css!animate'], function (rr, _, React, ReactDOM, RB, axios, util, etask, date, Common) {

    var mount = void 0;
    var E = {
        install: function install(mnt) {
            E.sp = etask('protocols', [function () {
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

    var ProtocolRow = function (_React$Component) {
        _inherits(ProtocolRow, _React$Component);

        function ProtocolRow() {
            _classCallCheck(this, ProtocolRow);

            return _possibleConstructorReturn(this, (ProtocolRow.__proto__ || Object.getPrototypeOf(ProtocolRow)).apply(this, arguments));
        }

        _createClass(ProtocolRow, [{
            key: 'render',
            value: function render() {
                return React.createElement(
                    'tr',
                    null,
                    React.createElement(
                        'td',
                        null,
                        this.props.stat.proto
                    ),
                    React.createElement(
                        'td',
                        { className: this.props.class_bw },
                        util.bytes_format(this.props.stat.bw)
                    ),
                    React.createElement(
                        'td',
                        { className: this.props.class_value },
                        this.props.stat.value
                    )
                );
            }
        }]);

        return ProtocolRow;
    }(React.Component);

    var ProtocolTable = function (_React$Component2) {
        _inherits(ProtocolTable, _React$Component2);

        function ProtocolTable() {
            _classCallCheck(this, ProtocolTable);

            return _possibleConstructorReturn(this, (ProtocolTable.__proto__ || Object.getPrototypeOf(ProtocolTable)).apply(this, arguments));
        }

        _createClass(ProtocolTable, [{
            key: 'render',
            value: function render() {
                return React.createElement(
                    Common.StatTable,
                    _extends({ row: ProtocolRow, path: '/protocols',
                        row_key: 'proto', title: 'All protocols' }, this.props),
                    React.createElement(
                        'tr',
                        null,
                        React.createElement(
                            'th',
                            null,
                            'Protocol'
                        ),
                        React.createElement(
                            'th',
                            { className: 'col-md-2' },
                            'Bandwidth'
                        ),
                        React.createElement(
                            'th',
                            { className: 'col-md-5' },
                            'Number of requests'
                        )
                    )
                );
            }
        }]);

        return ProtocolTable;
    }(React.Component);

    var Stats = function (_React$Component3) {
        _inherits(Stats, _React$Component3);

        function Stats(props) {
            _classCallCheck(this, Stats);

            var _this4 = _possibleConstructorReturn(this, (Stats.__proto__ || Object.getPrototypeOf(Stats)).call(this, props));

            _this4.state = { stats: [] };
            return _this4;
        }

        _createClass(Stats, [{
            key: 'componentDidMount',
            value: function componentDidMount() {
                var _this = this;
                E.sp.spawn(etask(regeneratorRuntime.mark(function _callee() {
                    var res, state;
                    return regeneratorRuntime.wrap(function _callee$(_context) {
                        while (1) {
                            switch (_context.prev = _context.next) {
                                case 0:
                                    _context.next = 2;
                                    return etask(function () {
                                        return axios.get('/api/request_stats/all');
                                    });

                                case 2:
                                    res = _context.sent;
                                    state = res.data.all.reduce(function (s, v, k) {
                                        var p = v.protocol;
                                        s[p] = s[p] || { proto: p, value: 0, bw: 0 };
                                        s[p].value += 1;
                                        s[p].bw += v.bw;
                                        return s;
                                    }, {});

                                    _this.setState({ stats: _(Object.values(state)).sortBy('value').reverse().value() });

                                case 5:
                                case 'end':
                                    return _context.stop();
                            }
                        }
                    }, _callee, this);
                })));
            }
        }, {
            key: 'render',
            value: function render() {
                return React.createElement(
                    'div',
                    null,
                    React.createElement(
                        'div',
                        { className: 'page-header' },
                        React.createElement(
                            'h3',
                            null,
                            'Protocols'
                        )
                    ),
                    React.createElement(
                        'div',
                        { className: 'page-body' },
                        React.createElement(ProtocolTable, { stats: this.state.stats })
                    )
                );
            }
        }]);

        return Stats;
    }(React.Component);

    E.Row = ProtocolRow;
    E.Table = ProtocolTable;
    return E;
});