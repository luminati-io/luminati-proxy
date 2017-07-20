// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true*/

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

define(['regenerator-runtime', 'lodash', 'react', 'react-dom', 'react-bootstrap', 'hutil/etask', '/stats/common.js', '/stats/status_codes.js', '/stats/protocols.js'], function (rr, _, React, ReactDOM, RB, etask, Common, StatusCode, Protocol) {

    var mount = void 0;
    var E = {
        install: function install(mnt, _ref) {
            var domain = _ref.domain;

            E.sp = etask('domains_detail', [function () {
                return this.wait();
            }]);
            ReactDOM.render(React.createElement(StatsDetails, { domain: domain }), mount = mnt);
        },
        uninstall: function uninstall() {
            if (E.sp) E.sp.return();
            if (mount) ReactDOM.unmountComponentAtNode(mount);
            mount = null;
        }
    };

    var StatsDetails = function (_React$Component) {
        _inherits(StatsDetails, _React$Component);

        function StatsDetails(props) {
            _classCallCheck(this, StatsDetails);

            var _this2 = _possibleConstructorReturn(this, (StatsDetails.__proto__ || Object.getPrototypeOf(StatsDetails)).call(this, props));

            _this2.state = {
                statuses: { stats: [] },
                protocols: { stats: [] }
            };
            return _this2;
        }

        _createClass(StatsDetails, [{
            key: 'componentDidMount',
            value: function componentDidMount() {
                var _this = this;
                E.sp.spawn(etask(regeneratorRuntime.mark(function _callee() {
                    var res;
                    return regeneratorRuntime.wrap(function _callee$(_context) {
                        while (1) {
                            switch (_context.prev = _context.next) {
                                case 0:
                                    _context.t0 = _this;
                                    _context.next = 3;
                                    return Common.StatsService.get(_this.props.domain);

                                case 3:
                                    _context.t1 = _context.sent;
                                    _context.t2 = {
                                        stats: _context.t1
                                    };

                                    _context.t0.setState.call(_context.t0, _context.t2);

                                    _context.next = 8;
                                    return Common.StatsService.get_top({ sort: 1, limit: 5 });

                                case 8:
                                    res = _context.sent;

                                    _this.setState(_.pick(res, ['statuses', 'protocols']));

                                case 10:
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
                var Col = RB.Col;

                return React.createElement(
                    Common.StatsDetails,
                    { stats: this.state.stats,
                        header: 'Domain name: ' + this.props.domain },
                    React.createElement(
                        Col,
                        { md: 6 },
                        React.createElement(
                            'h3',
                            null,
                            'Status codes'
                        ),
                        React.createElement(StatusCode.Table, { stats: this.state.statuses.stats })
                    ),
                    React.createElement(
                        Col,
                        { md: 6 },
                        React.createElement(
                            'h3',
                            null,
                            'Protocols'
                        ),
                        React.createElement(Protocol.Table, { stats: this.state.protocols.stats })
                    )
                );
            }
        }]);

        return StatsDetails;
    }(React.Component);

    return E;
});