// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true*/

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

define(['regenerator-runtime', 'lodash', 'react', 'react-dom', 'react-bootstrap', '/util.js', 'hutil/etask', '/stats/common.js'], function (rr, _, React, ReactDOM, RB, util, etask, Common) {

    var mount = void 0;
    var E = {
        install: function install(mnt) {
            E.sp = etask('domains', [function () {
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

    var DomainRow = function (_React$Component) {
        _inherits(DomainRow, _React$Component);

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
                        React.createElement(
                            'a',
                            { href: this.props.path + '/' + this.props.stat.hostname },
                            this.props.stat.hostname
                        )
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

        return DomainRow;
    }(React.Component);

    var DomainTable = function (_React$Component2) {
        _inherits(DomainTable, _React$Component2);

        function DomainTable() {
            _classCallCheck(this, DomainTable);

            return _possibleConstructorReturn(this, (DomainTable.__proto__ || Object.getPrototypeOf(DomainTable)).apply(this, arguments));
        }

        _createClass(DomainTable, [{
            key: 'render',
            value: function render() {
                return React.createElement(
                    Common.StatTable,
                    _extends({ row: DomainRow, path: '/domains',
                        row_key: 'hostname', title: 'All domains' }, this.props),
                    React.createElement(
                        'tr',
                        null,
                        React.createElement(
                            'th',
                            null,
                            'Domain Host'
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

        return DomainTable;
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
                    var res;
                    return regeneratorRuntime.wrap(function _callee$(_context) {
                        while (1) {
                            switch (_context.prev = _context.next) {
                                case 0:
                                    _context.next = 2;
                                    return Common.StatsService.get_all({ sort: 1,
                                        by: 'hostname' });

                                case 2:
                                    res = _context.sent;

                                    _this.setState({ stats: res });

                                case 4:
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
                            'Domains'
                        )
                    ),
                    React.createElement(
                        'div',
                        { className: 'page-body' },
                        React.createElement(DomainTable, { stats: this.state.stats })
                    )
                );
            }
        }]);

        return Stats;
    }(React.Component);

    E.Row = DomainRow;
    E.Table = DomainTable;
    return E;
});