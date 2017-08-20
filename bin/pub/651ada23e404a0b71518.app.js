webpackJsonp([1],{

/***/ 109:
/***/ (function(module, exports, __webpack_require__) {

"use strict";
// LICENSE_CODE ZON ISC
 /*jslint react:true*/

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.DomainTable = exports.DomainRow = undefined;

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _regeneratorRuntime = __webpack_require__(31);

var _regeneratorRuntime2 = _interopRequireDefault(_regeneratorRuntime);

var _react = __webpack_require__(0);

var _react2 = _interopRequireDefault(_react);

var _etask = __webpack_require__(40);

var _etask2 = _interopRequireDefault(_etask);

var _util = __webpack_require__(53);

var _util2 = _interopRequireDefault(_util);

var _common = __webpack_require__(54);

var _common2 = _interopRequireDefault(_common);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var E = {
    install: function install() {
        return E.sp = (0, _etask2.default)('domains', [function () {
            return this.wait();
        }]);
    },
    uninstall: function uninstall() {
        if (E.sp) E.sp.return();
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
            return _react2.default.createElement(
                'tr',
                null,
                _react2.default.createElement(
                    'td',
                    null,
                    _react2.default.createElement(
                        'a',
                        { href: this.props.path + '/' + this.props.stat.hostname },
                        this.props.stat.hostname
                    )
                ),
                _react2.default.createElement(
                    'td',
                    { className: this.props.class_bw },
                    _util2.default.bytes_format(this.props.stat.bw)
                ),
                _react2.default.createElement(
                    'td',
                    { className: this.props.class_value },
                    this.props.stat.value
                )
            );
        }
    }]);

    return DomainRow;
}(_react2.default.Component);

var DomainTable = function (_React$Component2) {
    _inherits(DomainTable, _React$Component2);

    function DomainTable() {
        _classCallCheck(this, DomainTable);

        return _possibleConstructorReturn(this, (DomainTable.__proto__ || Object.getPrototypeOf(DomainTable)).apply(this, arguments));
    }

    _createClass(DomainTable, [{
        key: 'render',
        value: function render() {
            return _react2.default.createElement(
                _common2.default.StatTable,
                _extends({ row: DomainRow, path: '/domains',
                    row_key: 'hostname', title: 'All domains' }, this.props),
                _react2.default.createElement(
                    'tr',
                    null,
                    _react2.default.createElement(
                        'th',
                        null,
                        'Domain Host'
                    ),
                    _react2.default.createElement(
                        'th',
                        { className: 'col-md-2' },
                        'Bandwidth'
                    ),
                    _react2.default.createElement(
                        'th',
                        { className: 'col-md-5' },
                        'Number of requests'
                    )
                )
            );
        }
    }]);

    return DomainTable;
}(_react2.default.Component);

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
            E.install();
            var _this = this;
            E.sp.spawn((0, _etask2.default)(_regeneratorRuntime2.default.mark(function _callee() {
                var res;
                return _regeneratorRuntime2.default.wrap(function _callee$(_context) {
                    while (1) {
                        switch (_context.prev = _context.next) {
                            case 0:
                                _context.next = 2;
                                return _common2.default.StatsService.get_all({ sort: 1,
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
        key: 'componentWillUnmount',
        value: function componentWillUnmount() {
            E.uninstall();
        }
    }, {
        key: 'render',
        value: function render() {
            return _react2.default.createElement(
                'div',
                null,
                _react2.default.createElement(
                    'div',
                    { className: 'page-header' },
                    _react2.default.createElement(
                        'h3',
                        null,
                        'Domains'
                    )
                ),
                _react2.default.createElement(
                    'div',
                    { className: 'page-body' },
                    _react2.default.createElement(DomainTable, { stats: this.state.stats })
                )
            );
        }
    }]);

    return Stats;
}(_react2.default.Component);

exports.DomainRow = DomainRow;
exports.DomainTable = DomainTable;
exports.default = Stats;

/***/ }),

/***/ 110:
/***/ (function(module, exports, __webpack_require__) {

"use strict";
// LICENSE_CODE ZON ISC
 /*jslint react:true*/

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.ProtocolTable = exports.ProtocolRow = undefined;

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _regeneratorRuntime = __webpack_require__(31);

var _regeneratorRuntime2 = _interopRequireDefault(_regeneratorRuntime);

var _react = __webpack_require__(0);

var _react2 = _interopRequireDefault(_react);

var _reactBootstrap = __webpack_require__(33);

var _etask = __webpack_require__(40);

var _etask2 = _interopRequireDefault(_etask);

var _util = __webpack_require__(53);

var _util2 = _interopRequireDefault(_util);

var _common = __webpack_require__(54);

var _common2 = _interopRequireDefault(_common);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var E = {
    install: function install() {
        return E.sp = (0, _etask2.default)('protocols', [function () {
            return this.wait();
        }]);
    },
    uninstall: function uninstall() {
        if (E.sp) E.sp.return();
    }
};

var CertificateButton = function (_React$Component) {
    _inherits(CertificateButton, _React$Component);

    function CertificateButton() {
        _classCallCheck(this, CertificateButton);

        return _possibleConstructorReturn(this, (CertificateButton.__proto__ || Object.getPrototypeOf(CertificateButton)).apply(this, arguments));
    }

    _createClass(CertificateButton, [{
        key: 'render',
        value: function render() {
            return _react2.default.createElement(
                _reactBootstrap.Button,
                { bsStyle: 'success', bsSize: 'xsmall',
                    onClick: this.props.onClick },
                'Enable HTTPS statistics'
            );
        }
    }]);

    return CertificateButton;
}(_react2.default.Component);

var ProtocolRow = function (_React$Component2) {
    _inherits(ProtocolRow, _React$Component2);

    function ProtocolRow() {
        _classCallCheck(this, ProtocolRow);

        return _possibleConstructorReturn(this, (ProtocolRow.__proto__ || Object.getPrototypeOf(ProtocolRow)).apply(this, arguments));
    }

    _createClass(ProtocolRow, [{
        key: 'render',
        value: function render() {
            return _react2.default.createElement(
                'tr',
                null,
                _react2.default.createElement(
                    'td',
                    null,
                    _react2.default.createElement(
                        'a',
                        { href: this.props.path + '/' + this.props.stat.protocol },
                        this.props.stat.protocol
                    )
                ),
                _react2.default.createElement(
                    'td',
                    { className: this.props.class_bw },
                    _util2.default.bytes_format(this.props.stat.bw)
                ),
                _react2.default.createElement(
                    'td',
                    { className: this.props.class_value },
                    this.props.stat.value
                )
            );
        }
    }]);

    return ProtocolRow;
}(_react2.default.Component);

var ProtocolTable = function (_React$Component3) {
    _inherits(ProtocolTable, _React$Component3);

    function ProtocolTable() {
        _classCallCheck(this, ProtocolTable);

        return _possibleConstructorReturn(this, (ProtocolTable.__proto__ || Object.getPrototypeOf(ProtocolTable)).apply(this, arguments));
    }

    _createClass(ProtocolTable, [{
        key: 'render',
        value: function render() {
            return _react2.default.createElement(
                _common2.default.StatTable,
                _extends({ row: ProtocolRow, path: '/protocols',
                    row_key: 'protocol', title: _react2.default.createElement(
                        _reactBootstrap.Row,
                        null,
                        _react2.default.createElement(
                            _reactBootstrap.Col,
                            { md: 6 },
                            'All protocols'
                        ),
                        this.props.show_enable_https_button && _react2.default.createElement(
                            _reactBootstrap.Col,
                            { md: 6, className: 'text-right' },
                            _react2.default.createElement(CertificateButton, {
                                onClick: this.props.enable_https_button_click })
                        )
                    )
                }, this.props),
                _react2.default.createElement(
                    'tr',
                    null,
                    _react2.default.createElement(
                        'th',
                        null,
                        'Protocol'
                    ),
                    _react2.default.createElement(
                        'th',
                        { className: 'col-md-2' },
                        'Bandwidth'
                    ),
                    _react2.default.createElement(
                        'th',
                        { className: 'col-md-5' },
                        'Number of requests'
                    )
                )
            );
        }
    }]);

    return ProtocolTable;
}(_react2.default.Component);

var Stats = function (_React$Component4) {
    _inherits(Stats, _React$Component4);

    function Stats(props) {
        _classCallCheck(this, Stats);

        var _this5 = _possibleConstructorReturn(this, (Stats.__proto__ || Object.getPrototypeOf(Stats)).call(this, props));

        _this5.state = { stats: [] };
        return _this5;
    }

    _createClass(Stats, [{
        key: 'componentDidMount',
        value: function componentDidMount() {
            E.install();
            var _this = this;
            E.sp.spawn((0, _etask2.default)(_regeneratorRuntime2.default.mark(function _callee() {
                var res;
                return _regeneratorRuntime2.default.wrap(function _callee$(_context) {
                    while (1) {
                        switch (_context.prev = _context.next) {
                            case 0:
                                _context.next = 2;
                                return _common2.default.StatsService.get_all({ sort: 1,
                                    by: 'protocol' });

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
        key: 'componentWillUnmount',
        value: function componentWillUnmount() {
            E.uninstall();
        }
    }, {
        key: 'render',
        value: function render() {
            return _react2.default.createElement(
                'div',
                null,
                _react2.default.createElement(
                    'div',
                    { className: 'page-header' },
                    _react2.default.createElement(
                        'h3',
                        null,
                        'Protocols'
                    )
                ),
                _react2.default.createElement(
                    'div',
                    { className: 'page-body' },
                    _react2.default.createElement(ProtocolTable, { stats: this.state.stats })
                )
            );
        }
    }]);

    return Stats;
}(_react2.default.Component);

exports.ProtocolRow = ProtocolRow;
exports.ProtocolTable = ProtocolTable;
exports.default = Stats;

/***/ }),

/***/ 183:
/***/ (function(module, exports, __webpack_require__) {

var __WEBPACK_AMD_DEFINE_ARRAY__, __WEBPACK_AMD_DEFINE_RESULT__;
var module;
// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, browser:true*/
(function(){

var is_node = typeof module=='object' && module.exports && module.children;
var is_node_ff = typeof module=='object' && module.exports;
if (!is_node_ff)
    ;
else
    ;
!(__WEBPACK_AMD_DEFINE_ARRAY__ = [], __WEBPACK_AMD_DEFINE_RESULT__ = function(){
var E = date_get;

function pad(num, size){ return ('000'+num).slice(-size); }

E.ms_to_dur = function(_ms){
    var s = '';
    var sec = Math.floor(_ms/1000);
    if (sec<0)
    {
	s += '-';
	sec = -sec;
    }
    var days = Math.floor(sec/(60*60*24));
    sec -= days*60*60*24;
    var hours = Math.floor(sec/(60*60));
    sec -= hours*60*60;
    var mins = Math.floor(sec/60);
    sec -= mins*60;
    if (days)
	s += days + ' ' + (days>1 ? 'Days' : 'Day') + ' ';
    return s+pad(hours, 2)+':'+pad(mins, 2)+':'+pad(sec, 2);
};

E.dur_to_str = function(duration, opt){
    opt = opt||{};
    var parts = [];
    duration = +duration;
    function chop(period, name){
        if (duration<period)
            return;
        var number = Math.floor(duration/period);
        parts.push(number+name);
        duration -= number*period;
    }
    chop(ms.YEAR, 'y');
    chop(ms.MONTH, 'mo');
    if (opt.week)
        chop(ms.WEEK, 'w');
    chop(ms.DAY, 'd');
    chop(ms.HOUR, 'h');
    chop(ms.MIN, 'min');
    chop(ms.SEC, 's');
    if (duration)
        parts.push(duration+'ms');
    if (!parts.length)
        return '0s';
    return parts.slice(0, opt.units||parts.length).join(opt.sep||'');
};

E.monotonic = undefined;
E.init = function(){
    var adjust, last;
    if (typeof window=='object' && window.performance
        && window.performance.now)
    {
        // 10% slower than Date.now, but always monotonic
        adjust = Date.now()-window.performance.now();
        E.monotonic = function(){ return window.performance.now()+adjust; };
    }
    else if (is_node && !global.mocha_running)
    {
        // brings libuv monotonic time since process start
        var timer = process.binding('timer_wrap').Timer;
        adjust = Date.now()-timer.now();
        E.monotonic = function(){ return timer.now()+adjust; };
    }
    else
    {
        last = adjust = 0;
        E.monotonic = function(){
            var now = Date.now()+adjust;
            if (now>=last)
                return last = now;
            adjust += last-now;
            return last;
        };
    }
};
E.init();

E.str_to_dur = function(str, opt){
    opt = opt||{};
    var month = 'mo|mon|months?';
    if (opt.short_month)
        month +='|m';
    var m = str.replace(/ /g, '').match(new RegExp('^(([0-9]+)y(ears?)?)?'
    +'(([0-9]+)('+month+'))?(([0-9]+)w(eeks?)?)?(([0-9]+)d(ays?)?)?'
    +'(([0-9]+)h(ours?)?)?(([0-9]+)(min|minutes?))?'
    +'(([0-9]+)s(ec|econds?)?)?(([0-9]+)ms(ec)?)?$'));
    if (!m)
        return;
    return ms.YEAR*(+m[2]||0)+ms.MONTH*(+m[5]||0)+ms.WEEK*(+m[8]||0)
    +ms.DAY*(+m[11]||0)+ms.HOUR*(+m[14]||0)+ms.MIN*(+m[17]||0)
    +ms.SEC*(+m[20]||0)+(+m[23]||0);
};

E.months_long = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
E.months_short = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug',
    'Sep', 'Oct', 'Nov', 'Dec'];
var months_short_lc = E.months_short.map(function(m){
    return m.toLowerCase(); });
E.days_long = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday',
    'Friday', 'Saturday'];
E.days_short = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
var days_short_lc = E.days_short.map(function(d){ return d.toLowerCase(); });
E.locale = {months_long: E.months_long, months_short: E.months_short,
    days_long: E.days_long, days_short: E.days_short, AM: 'AM', PM: 'PM'};
E.get = date_get;
function date_get(d, _new){
    var y, mon, day, H, M, S, _ms;
    if (d===undefined)
	return new Date();
    if (d==null)
	return new Date(null);
    if (d instanceof Date)
	return _new ? new Date(d) : d;
    if (typeof d=='string')
    {
	var m;
        d = d.trim();
	// check for ISO/SQL/JDate date
	if (m = /^((\d\d\d\d)-(\d\d)-(\d\d)|(\d\d?)-([A-Za-z]{3})-(\d\d(\d\d)?))\s*([\sT](\d\d):(\d\d)(:(\d\d)(\.(\d\d\d))?)?Z?)?$/
	    .exec(d))
	{
            H = +m[10]||0; M = +m[11]||0; S = +m[13]||0; _ms = +m[15]||0;
            if (m[2]) // SQL or ISO date
            {
                y = +m[2]; mon = +m[3]; day = +m[4];
                if (!y && !mon && !day && !H && !M && !S && !_ms)
                    return new Date(NaN);
                return new Date(Date.UTC(y, mon-1, day, H, M, S, _ms));
            }
            if (m[5]) // jdate
            {
                y = +m[7];
                mon = months_short_lc.indexOf(m[6].toLowerCase())+1;
                day = +m[5];
                if (m[7].length==2)
                {
                    y = +y;
                    y += y>=70 ? 1900 : 2000;
                }
                return new Date(Date.UTC(y, mon-1, day, H, M, S, _ms));
            }
            // cannot reach here
        }
        // check for string timestamp
        if (/^\d+$/.test(d))
            return new Date(+d);
        // else might be parsed as non UTC!
        return new Date(d);
    }
    if (typeof d=='number')
	return new Date(d);
    throw new TypeError('invalid date '+d);
}

E.to_sql_ms = function(d){
    d = E.get(d);
    if (isNaN(d))
        return '0000-00-00 00:00:00.000';
    return pad(d.getUTCFullYear(), 4)+'-'+pad(d.getUTCMonth()+1, 2)
    +'-'+pad(d.getUTCDate(), 2)
    +' '+pad(d.getUTCHours(), 2)+':'+pad(d.getUTCMinutes(), 2)
    +':'+pad(d.getUTCSeconds(), 2)
    +'.'+pad(d.getUTCMilliseconds(), 3);
};
E.to_sql_sec = function(d){ return E.to_sql_ms(d).slice(0, -4); };
E.to_sql = function(d){
    return E.to_sql_ms(d).replace(/( 00:00:00)?....$/, ''); };
E.from_sql = E.get;

E.to_month_short = function(d){
    d = E.get(d);
    return E.months_short[d.getUTCMonth()];
};
// timestamp format (used by tickets, etc). dates before 2000 not supported
E.to_jdate = function(d){
    d = E.get(d);
    return (pad(d.getUTCDate(), 2)+'-'+E.months_short[d.getUTCMonth()]
	+'-'+pad(d.getUTCFullYear()%100, 2)+' '+pad(d.getUTCHours(), 2)+
	':'+pad(d.getUTCMinutes(), 2)+':'+pad(d.getUTCSeconds(), 2))
    .replace(/( 00:00)?:00$/, '');
};
// used in log file names
E.to_log_file = function(d){
    d = E.get(d);
    return d.getUTCFullYear()+pad(d.getUTCMonth()+1, 2)+pad(d.getUTCDate(), 2)
    +'_'+pad(d.getUTCHours(), 2)+pad(d.getUTCMinutes(), 2)
    +pad(d.getUTCSeconds(), 2);
};
E.from_log_file = function(d){
    var m = d.match(/^(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})$/);
    if (!m)
        return;
    return new Date(Date.UTC(m[1], m[2]-1, m[3], m[4], m[5], m[6]));
};
// zerr compatible timestamp format
E.to_log_ms = function(d){ return E.to_sql_ms(d).replace(/-/g, '.'); };
E.from_rcs = function(d){
    var m = d.match(/^(\d{4})\.(\d{2})\.(\d{2})\.(\d{2})\.(\d{2})\.(\d{2})$/);
    if (!m)
        return;
    return new Date(Date.UTC(m[1], m[2]-1, m[3], m[4], m[5], m[6]));
};
E.to_rcs = function(d){ return E.to_sql_sec(d).replace(/[-: ]/g, '.'); };

E.sec = {
    MS: 0.001,
    SEC: 1,
    MIN: 60,
    HOUR: 60*60,
    DAY: 24*60*60,
    WEEK: 7*24*60*60,
    MONTH: 30*24*60*60,
    YEAR: 365*24*60*60,
};
E.ms = {};
for (var key in E.sec)
    E.ms[key] = E.sec[key]*1000;
var ms = E.ms;

E.align = function(d, align){
    d = E.get(d, 1);
    switch (align.toUpperCase())
    {
    case 'MS': break;
    case 'SEC': d.setUTCMilliseconds(0); break;
    case 'MIN': d.setUTCSeconds(0, 0); break;
    case 'HOUR': d.setUTCMinutes(0, 0, 0); break;
    case 'DAY': d.setUTCHours(0, 0, 0, 0); break;
    case 'WEEK':
        d.setUTCDate(d.getUTCDate()-d.getUTCDay());
        d.setUTCHours(0, 0, 0, 0);
        break;
    case 'MONTH': d.setUTCDate(1); d.setUTCHours(0, 0, 0, 0); break;
    case 'YEAR': d.setUTCMonth(0, 1); d.setUTCHours(0, 0, 0, 0); break;
    default: throw new Error('invalid align '+align);
    }
    return d;
};

E.add = function(d, duration){
    d = E.get(d, 1);
    if (duration.year)
        d.setUTCFullYear(d.getUTCFullYear()+duration.year);
    if (duration.month)
        d.setUTCMonth(d.getUTCMonth()+duration.month);
    ['day', 'hour', 'min', 'sec', 'ms'].forEach(function(key){
        if (duration[key])
            d.setTime(+d+duration[key]*ms[key.toUpperCase()]);
    });
    return d;
};

E.describe_interval = function(_ms){
    if (_ms<2*ms.MIN)
        return Math.round(_ms/ms.SEC)+' sec';
    if (_ms<2*ms.HOUR)
        return Math.round(_ms/ms.MIN)+' min';
    if (_ms<2*ms.DAY)
        return Math.round(_ms/ms.HOUR)+' hours';
    if (_ms<2*ms.WEEK)
        return Math.round(_ms/ms.DAY)+' days';
    if (_ms<2*ms.MONTH)
        return Math.round(_ms/ms.WEEK)+' weeks';
    if (_ms<2*ms.YEAR)
        return Math.round(_ms/ms.MONTH)+' months';
    return Math.round(_ms/ms.YEAR)+' years';
};

E.time_ago = function(d, until_date){
    var _ms = E.get(until_date)-E.get(d);
    if (_ms<ms.SEC)
        return 'right now';
    return E.describe_interval(_ms)+' ago';
};

E.ms_to_str = function(_ms){
    var s = ''+_ms;
    return s.length<=3 ? s+'ms' : s.slice(0, -3)+'.'+s.slice(-3)+'s';
};

E.parse = function(text, opt){
    opt = opt||{};
    if (opt.fmt)
        return E.strptime(text, opt.fmt);
    var d, a, i, v, _v, dir, _dir, amount, now = opt.now;
    now = !now ? new Date() : new Date(now);
    text = text.replace(/\s+/g, ' ').trim().toLowerCase();
    if (!text)
        return;
    if (text=='now')
        return now;
    if (!isNaN(d = E.get(text)))
        return d;
    d = now;
    a = text.split(' ');
    dir = a.includes('ago') ? -1 : a.includes('last') ? -1 :
        a.includes('next') ? 1 : undefined;
    for (i=0; i<a.length; i++)
    {
        v = a[i];
        if (/^(ago|last|next)$/.test(v));
        else if (v=='today')
            d = E.align(d, 'DAY');
        else if (v=='yesterday')
            d = E.align(+d-ms.DAY, 'DAY');
        else if (v=='tomorrow')
            d = E.align(+d+ms.DAY, 'DAY');
        else if ((_v = days_short_lc.indexOf(v))>=0)
            d = new Date(+E.align(d, 'WEEK')+_v*ms.DAY+(dir||0)*ms.WEEK);
        else if (_v = /^([+-]?\d+)(?:([ymoinwdhs]+)(\d.*)?)?$/.exec(v))
        {
            if (amount!==undefined)
                return;
            amount = dir!==undefined ? Math.abs(+_v[1]) : +_v[1];
            if (_v[2])
            {
                a.splice(i+1, 0, _v[2]);
                if (_v[3])
                    a.splice(i+2, 0, _v[3]);
            }
            continue;
        }
        else if (/^([ywdhs]|years?|months?|mon?|weeks?|days?|hours?|minutes?|min|seconds?|sec)$/.test(v))
        {
            _v = v[0]=='m' && v[1]=='i' ? ms.MIN :
                v[0]=='y' ? ms.YEAR : v[0]=='m' && v[1]=='o' ? ms.MONTH :
                v[0]=='w' ? ms.WEEK :
                v[0]=='d' ? ms.DAY : v[0]=='h' ? ms.HOUR : ms.SEC;
            amount = amount===undefined ? 1 : amount;
            _dir = dir===undefined ? opt.dir||1 : dir;
            if (_v==ms.MONTH)
                d.setUTCMonth(d.getUTCMonth()+_dir*amount);
            else if (_v==ms.YEAR)
                d.setUTCFullYear(d.getUTCFullYear()+_dir*amount);
            else
                d = new Date(+d+_v*amount*_dir);
            amount = undefined;
        }
        else
            return;
        if (amount!==undefined)
            return;
    }
    if (amount!==undefined)
        return;
    return d;
};

E.strptime = function(str, fmt){
    function month(m){ return months_short_lc.indexOf(m.toLowerCase()); }
    var parse = {
        '%': ['%', function(){}, 0],
        a: ['[a-z]+', function(m){}, 0],
        A: ['[a-z]+', function(m){}, 0],
        b: ['[a-z]+', function(m){ d.setUTCMonth(month(m)); }, 2],
        B: ['[a-z]+', function(m){
            d.setUTCMonth(month(m.toLowerCase())); }, 2],
        y: ['[0-9]{2}', function(m){
            d.setUTCFullYear(+m+(m<70 ? 2000 : 1900)); }, 1],
        Y: ['[0-9]{4}', function(m){ d.setUTCFullYear(+m); }, 1],
        m: ['[0-9]{0,2}', function(m){ d.setUTCMonth(+m-1); }, 2],
        d: ['[0-9]{0,2}', function(m){ d.setUTCDate(+m); }, 3],
        H: ['[0-9]{0,2}', function(m){ d.setUTCHours(+m); }, 4],
        M: ['[0-9]{0,2}', function(m){ d.setUTCMinutes(+m); }, 5],
        S: ['[0-9]{0,2}', function(m){ d.setUTCSeconds(+m); }, 6],
        s: ['[0-9]+', function(m){ d = new Date(+m); }, 0],
        L: ['[0-9]{0,3}', function(m){ d.setUTCMilliseconds(+m); }, 7],
        z: ['[+-][0-9]{4}', function(m){
            var timezone = +m.slice(0, 3)*3600+m.slice(3, 5)*60;
            d = new Date(d.getTime()-timezone*1000);
        }, 8],
        Z: ['[a-z]{0,3}[+-][0-9]{2}:?[0-9]{2}|[a-z]{1,3}', function(m){
            m = /^([a-z]{0,3})(?:([+-][0-9]{2}):?([0-9]{2}))?$/i.exec(m);
            if (m[1]=='Z' || m[1]=='UTC')
                return;
            var timezone = +m[2]*3600+m[3]*60;
            d = new Date(d.getTime()-timezone*1000);
        }, 8],
        I: ['[0-9]{0,2}', function(m){ d.setUTCHours(+m); }, 4],
        p: ['AM|PM', function(m){
            if (d.getUTCHours()==12)
                d.setUTCHours(d.getUTCHours()-12);
            if (m.toUpperCase()=='PM')
                d.setUTCHours(d.getUTCHours()+12);
        }, 9],
    };
    var ff = [];
    var ff_idx = [];
    var re = new RegExp('^\\s*'+fmt.replace(/%(?:([a-zA-Z%]))/g,
        function(_, fd)
    {
        var d = parse[fd];
        if (!d)
            throw Error('Unknown format descripter: '+fd);
        ff_idx[d[2]] = ff.length;
        ff.push(d[1]);
        return '('+d[0]+')';
    })+'\\s*$', 'i');
    var matched = str.match(re);
    if (!matched)
        return;
    var d = new Date(0);
    for (var i=0; i<ff_idx.length; i++)
    {
        var idx = ff_idx[i];
        var fun = ff[idx];
        if (fun)
            fun(matched[idx+1]);
    }
    return d;
};

var utc_local = {
    local: {
	getSeconds: function(d){ return d.getSeconds(); },
	getMinutes: function(d){ return d.getMinutes(); },
	getHours: function(d){ return d.getHours(); },
	getDay: function(d){ return d.getDay(); },
	getDate: function(d){ return d.getDate(); },
	getMonth: function(d){ return d.getMonth(); },
	getFullYear: function(d){ return d.getFullYear(); },
	getYearBegin: function(d){ return new Date(d.getFullYear(), 0, 1); }
    },
    utc: {
	getSeconds: function(d){ return d.getUTCSeconds(); },
	getMinutes: function(d){ return d.getUTCMinutes(); },
	getHours: function(d){ return d.getUTCHours(); },
	getDay: function(d){ return d.getUTCDay(); },
	getDate: function(d){ return d.getUTCDate(); },
	getMonth: function(d){ return d.getUTCMonth(); },
	getFullYear: function(d){ return d.getUTCFullYear(); },
	getYearBegin: function(d){ return new Date(Date.UTC(
            d.getUTCFullYear(), 0, 1)); }
    }
};

E.strftime = function(fmt, d, opt){
    function hours12(hours){
        return hours==0 ? 12 : hours>12 ? hours-12 : hours; }
    function ord_str(n){
        var i = n % 10, ii = n % 100;
        if (ii>=11 && ii<=13 || i==0 || i>=4)
            return 'th';
        switch (i)
        {
        case 1: return 'st';
        case 2: return 'nd';
        case 3: return 'rd';
        }
    }
    function week_num(l, d, first_weekday){
        // This works by shifting the weekday back by one day if we
        // are treating Monday as the first day of the week.
        var wday = l.getDay(d);
        if (first_weekday=='monday')
            wday = wday==0 /* Sunday */ ? wday = 6 : wday-1;
        var yday = (d-l.getYearBegin(d))/ms.DAY;
        return Math.floor((yday + 7 - wday)/7);
    }
    // Default padding is '0' and default length is 2, both are optional.
    function padx(n, padding, length){
        // padx(n, <length>)
        if (typeof padding=='number')
        {
            length = padding;
            padding = '0';
        }
        // Defaults handle padx(n) and padx(n, <padding>)
        if (padding===undefined)
            padding = '0';
        length = length||2;
        var s = ''+n;
        // padding may be an empty string, don't loop forever if it is
        if (padding)
            for (; s.length<length; s = padding + s);
        return s;
    }
    opt = opt||{};
    d = E.get(d);
    var locale = opt.locale||E.locale;
    var formats = locale.formats||{};
    var tz = opt.timezone;
    var utc = opt.utc!==undefined ? opt.utc :
	opt.local!==undefined ? !opt.local :
	true;
    if (tz!=null)
    {
	utc = true;
	// ISO 8601 format timezone string, [-+]HHMM
	// Convert to the number of minutes and it'll be applied to the date
	// below.
	if (typeof tz=='string')
	{
	    var sign = tz[0]=='-' ? -1 : 1;
	    var hours = parseInt(tz.slice(1, 3), 10);
	    var mins = parseInt(tz.slice(3, 5), 10);
	    tz = sign*(60*hours+mins);
	}
        if (typeof tz=='number')
	    d = new Date(+d+tz*60000);
    }
    var l = utc ? utc_local.utc : utc_local.local;
    // Most of the specifiers supported by C's strftime, and some from Ruby.
    // Some other syntax extensions from Ruby are supported: %-, %_, and %0
    // to pad with nothing, space, or zero (respectively).
    function replace(fmt){ return fmt.replace(/%([-_0]?.)/g, function(_, c){
	var mod, padding, day;
	if (c.length==2)
	{
	    mod = c[0];
	    if (mod=='-') // omit padding
		padding = '';
	    else if (mod=='_') // pad with space
		padding = ' ';
	    else if (mod=='0') // pad with zero
		padding = '0';
	    else // unrecognized, return the format
		return _;
	    c = c[1];
	}
	switch (c)
	{
	// Examples for new Date(0) in GMT
	case 'A': return locale.days_long[l.getDay(d)]; // 'Thursday'
	case 'a': return locale.days_short[l.getDay(d)]; // 'Thu'
	case 'B': return locale.months_long[l.getMonth(d)]; // 'January'
	case 'b': return locale.months_short[l.getMonth(d)]; // 'Jan'
	case 'C': // '19'
	    return padx(Math.floor(l.getFullYear(d)/100), padding);
	case 'D': return replace(formats.D || '%m/%d/%y'); // '01/01/70'
	case 'd': return padx(l.getDate(d), padding); // '01'
	case 'e': return l.getDate(d); // '01'
	case 'F': return replace(formats.F || '%Y-%m-%d'); // '1970-01-01'
	case 'H': return padx(l.getHours(d), padding); // '00'
	case 'h': return locale.months_short[l.getMonth(d)]; // 'Jan'
	case 'I': return padx(hours12(l.getHours(d)), padding); // '12'
	case 'j': // '000'
	    day = Math.ceil((+d-l.getYearBegin(d))/(1000*60*60*24));
	    return pad(day, 3);
	case 'k': // ' 0'
	    return padx(l.getHours(d), padding===undefined ? ' ' : padding);
	case 'L': return pad(Math.floor(d.getMilliseconds()), 3); // '000'
	case 'l': // '12'
	    return padx(hours12(l.getHours(d)),
		padding===undefined ? ' ' : padding);
	case 'M': return padx(l.getMinutes(d), padding); // '00'
	case 'm': return padx(l.getMonth(d)+1, padding); // '01'
	case 'n': return '\n'; // '\n'
	case 'o': return ''+l.getDate(d)+ord_str(l.getDate(d)); // '1st'
	case 'P': // 'am'
            return (l.getHours(d)<12 ? locale.AM : locale.PM).toLowerCase();
	case 'p': return l.getHours(d)<12 ? locale.AM : locale.PM; // 'AM'
	case 'R': return replace(formats.R || '%H:%M'); // '00:00'
	case 'r': return replace(formats.r || '%I:%M:%S %p'); // '12:00:00 AM'
	case 'S': return padx(l.getSeconds(d), padding); // '00'
	case 's': return Math.floor(+d/1000); // '0'
	case 'T': return replace(formats.T || '%H:%M:%S'); // '00:00:00'
	case 't': return '\t'; // '\t'
	case 'U': return padx(week_num(l, d, 'sunday'), padding); // '00'
	case 'u': // '4'
	    day = l.getDay(d);
	    // 1 - 7, Monday is first day of the week
	    return day==0 ? 7 : day;
	case 'v': return replace(formats.v || '%e-%b-%Y'); // '1-Jan-1970'
	case 'W': return padx(week_num(l, d, 'monday'), padding); // '00'
	case 'w': return l.getDay(d); // '4'. 0 Sunday - 6 Saturday
	case 'Y': return l.getFullYear(d); // '1970'
	case 'y': return (''+l.getFullYear(d)).slice(-2); // '70'
	case 'Z': // 'GMT'
	    if (utc)
	        return 'GMT';
	    var tz_string = d.toString().match(/\((\w+)\)/);
	    return tz_string && tz_string[1] || '';
	case 'z': // '+0000'
	    if (utc)
	        return '+0000';
	    var off = typeof tz=='number' ? tz : -d.getTimezoneOffset();
	    return (off<0 ? '-' : '+')+pad(Math.abs(off/60), 2)+pad(off%60, 2);
	default: return c;
	}
    }); }
    return replace(fmt);
};

return E; }.apply(exports, __WEBPACK_AMD_DEFINE_ARRAY__),
				__WEBPACK_AMD_DEFINE_RESULT__ !== undefined && (module.exports = __WEBPACK_AMD_DEFINE_RESULT__)); }());


/***/ }),

/***/ 262:
/***/ (function(module, exports, __webpack_require__) {

var __WEBPACK_AMD_DEFINE_ARRAY__, __WEBPACK_AMD_DEFINE_RESULT__;
var module;
// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, browser:true*/
(function(){

var is_node_ff = typeof module=='object' && module.exports;
if (!is_node_ff)
    ;
else
    ;
!(__WEBPACK_AMD_DEFINE_ARRAY__ = [], __WEBPACK_AMD_DEFINE_RESULT__ = function(){
var E = {};

var proto_slice = Array.prototype.slice;
E.copy = function(a){
    switch (a.length)
    {
    case 0: return [];
    case 1: return [a[0]];
    case 2: return [a[0], a[1]];
    case 3: return [a[0], a[1], a[2]];
    case 4: return [a[0], a[1], a[2], a[3]];
    case 5: return [a[0], a[1], a[2], a[3], a[4]];
    default: return proto_slice.call(a);
    }
};

E.push = function(a){
    for (var i=1; i<arguments.length; i++)
    {
        var arg = arguments[i];
        if (Array.isArray(arg))
            a.push.apply(a, arg);
        else
            a.push(arg);
    }
    return a.length;
};
E.unshift = function(a){
    for (var i=arguments.length-1; i>0; i--)
    {
        var arg = arguments[i];
        if (Array.isArray(arg))
            a.unshift.apply(a, arg);
        else
            a.unshift(arg);
    }
    return a.length;
};

E.slice = function(args, from, to){
    return Array.prototype.slice.call(args, from, to); };

E.compact = function(a){ return E.compact_self(a.slice()); };
E.compact_self = function(a){
    var i, j, n = a.length;
    for (i=0; i<n && a[i]; i++);
    if (i==n)
	return a;
    for (j=i; i<n; i++)
    {
	if (!a[i])
	    continue;
	a[j++] = a[i];
    }
    a.length = j;
    return a;
};

// same as _.flatten(a, true)
E.flatten_shallow = function(a){ return Array.prototype.concat.apply([], a); };
E.flatten = function(a){
    var _a = [], i;
    for (i=0; i<a.length; i++)
    {
        if (Array.isArray(a[i]))
            Array.prototype.push.apply(_a, E.flatten(a[i]));
        else
            _a.push(a[i]);
    }
    return _a;
};
E.unique = function(a){
    var _a = [];
    for (var i=0; i<a.length; i++)
    {
        if (!_a.includes(a[i]))
            _a.push(a[i]);
    }
    return _a;
};
E.to_nl = function(a, sep){
    if (!a || !a.length)
	return '';
    if (sep===undefined)
	sep = '\n';
    return a.join(sep)+sep;
};
E.sed = function(a, regex, replace){
    var _a = new Array(a.length), i;
    for (i=0; i<a.length; i++)
	_a[i] = a[i].replace(regex, replace);
    return _a;
};
E.grep = function(a, regex, replace){
    var _a = [], i;
    for (i=0; i<a.length; i++)
    {
	// dont use regex.test() since with //g sticky tag it does not reset
	if (a[i].search(regex)<0)
	    continue;
	if (replace!==undefined)
	    _a.push(a[i].replace(regex, replace));
	else
	    _a.push(a[i]);
    }
    return _a;
};

E.rm_elm = function(a, elm){
    var i = a.indexOf(elm);
    if (i<0)
	return;
    a.splice(i, 1);
    return elm;
};

E.rm_elm_tail = function(a, elm){
    var i = a.length-1;
    if (elm===a[i]) // fast-path
    {
	a.pop();
	return elm;
    }
    if ((i = a.lastIndexOf(elm, i-1))<0)
	return;
    a.splice(i, 1);
    return elm;
};

E.add_elm = function(a, elm){
    if (a.includes(elm))
        return;
    a.push(elm);
    return elm;
};

E.split_every = function(a, n){
    var ret = [];
    for (var i=0; i<a.length; i+=n)
        ret.push(a.slice(i, i+n));
    return ret;
};

E.split_at = function(a, delim){
    var ret = [];
    delim = delim||'';
    for (var i=0; i<a.length; i++)
    {
        var chunk = [];
        for (; i<a.length && a[i]!=delim; i++)
            chunk.push(a[i]);
        if (chunk.length)
            ret.push(chunk);
    }
    return ret;
};

E.rotate = function(a, n){
    if (a && a.length>1 && (n = n%a.length))
        E.unshift(a, a.splice(n));
    return a;
};

E.move = function(a, from, to, n){
    return Array.prototype.splice.apply(a, [to, n]
        .concat(a.slice(from, from+n)));
};

E.to_array = function(v){ return Array.isArray(v) ? v : v==null ? [] : [v]; };

var proto = {};
proto.sed = function(regex, replace){
    return E.sed(this, regex, replace); };
proto.grep = function(regex, replace){
    return E.grep(this, regex, replace); };
proto.to_nl = function(sep){ return E.to_nl(this, sep); };
proto.push_a = function(){
    return E.push.apply(null, [this].concat(Array.from(arguments))); };
proto.unshift_a = function(){
    return E.unshift.apply(null, [this].concat(Array.from(arguments))); };
var installed;
E.prototype_install = function(){
    if (installed)
        return;
    installed = true;
    for (var i in proto)
    {
        Object.defineProperty(Array.prototype, i,
            {value: proto[i], configurable: true, enumerable: false,
            writable: true});
    }
};
E.prototype_uninstall = function(){
    if (!installed)
        return;
    installed = false;
    // XXX sergey: store orig proto, then load it back
    for (var i in proto)
        delete Array.prototype[i];
};
return E; }.apply(exports, __WEBPACK_AMD_DEFINE_ARRAY__),
				__WEBPACK_AMD_DEFINE_RESULT__ !== undefined && (module.exports = __WEBPACK_AMD_DEFINE_RESULT__)); }());


/***/ }),

/***/ 269:
/***/ (function(module, exports, __webpack_require__) {

"use strict";
// LICENSE_CODE ZON ISC
 /*jslint react:true*/

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Dialog = undefined;

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _lodash = __webpack_require__(41);

var _lodash2 = _interopRequireDefault(_lodash);

var _react = __webpack_require__(0);

var _react2 = _interopRequireDefault(_react);

var _reactBootstrap = __webpack_require__(33);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var Dialog = function (_React$Component) {
  _inherits(Dialog, _React$Component);

  function Dialog() {
    _classCallCheck(this, Dialog);

    return _possibleConstructorReturn(this, (Dialog.__proto__ || Object.getPrototypeOf(Dialog)).apply(this, arguments));
  }

  _createClass(Dialog, [{
    key: 'render',
    value: function render() {
      return _react2.default.createElement(
        _reactBootstrap.Modal,
        _lodash2.default.omit(this.props, ['title', 'footer', 'children']),
        _react2.default.createElement(
          _reactBootstrap.Modal.Header,
          { closeButton: true },
          _react2.default.createElement(
            _reactBootstrap.Modal.Title,
            null,
            this.props.title
          )
        ),
        _react2.default.createElement(
          _reactBootstrap.Modal.Body,
          null,
          this.props.children
        ),
        _react2.default.createElement(
          _reactBootstrap.Modal.Footer,
          null,
          this.props.footer
        )
      );
    }
  }]);

  return Dialog;
}(_react2.default.Component);

exports.Dialog = Dialog;

/***/ }),

/***/ 309:
/***/ (function(module, exports, __webpack_require__) {

"use strict";
// LICENSE_CODE ZON ISC
 /*jslint browser:true, es6:true*/

__webpack_require__(176);

__webpack_require__(177);

__webpack_require__(179);

__webpack_require__(180);

var _angular = __webpack_require__(74);

var _angular2 = _interopRequireDefault(_angular);

var _lodash = __webpack_require__(41);

var _lodash2 = _interopRequireDefault(_lodash);

var _moment = __webpack_require__(182);

var _moment2 = _interopRequireDefault(_moment);

var _codemirror = __webpack_require__(112);

var _codemirror2 = _interopRequireDefault(_codemirror);

var _date = __webpack_require__(183);

var _date2 = _interopRequireDefault(_date);

var _stats = __webpack_require__(320);

var _stats2 = _interopRequireDefault(_stats);

var _status_codes = __webpack_require__(87);

var _status_codes2 = _interopRequireDefault(_status_codes);

var _status_codes_detail = __webpack_require__(580);

var _status_codes_detail2 = _interopRequireDefault(_status_codes_detail);

var _domains = __webpack_require__(109);

var _domains2 = _interopRequireDefault(_domains);

var _domains_detail = __webpack_require__(581);

var _domains_detail2 = _interopRequireDefault(_domains_detail);

var _protocols = __webpack_require__(110);

var _protocols2 = _interopRequireDefault(_protocols);

var _protocols_detail = __webpack_require__(582);

var _protocols_detail2 = _interopRequireDefault(_protocols_detail);

var _messages = __webpack_require__(583);

var _messages2 = _interopRequireDefault(_messages);

var _util = __webpack_require__(53);

var _util2 = _interopRequireDefault(_util);

var _react = __webpack_require__(0);

var _react2 = _interopRequireDefault(_react);

var _reactDom = __webpack_require__(24);

var _reactDom2 = _interopRequireDefault(_reactDom);

__webpack_require__(271);

__webpack_require__(21);

__webpack_require__(301);

__webpack_require__(302);

__webpack_require__(303);

__webpack_require__(636);

__webpack_require__(304);

__webpack_require__(305);

__webpack_require__(306);

__webpack_require__(307);

__webpack_require__(308);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var is_electron = window.process && window.process.versions.electron;

var is_valid_field = function is_valid_field(proxy, name, zone_definition) {
    var value = proxy.zone || zone_definition.def;
    if (name == 'password') return value != 'gen';
    var details = zone_definition.values.filter(function (z) {
        return z.value == value;
    })[0];
    var permissions = details && details.perm.split(' ') || [];
    if (['country', 'state', 'city', 'asn', 'ip'].includes(name)) return permissions.includes(name);
    return true;
};

var _module = _angular2.default.module('app', ['ngSanitize', 'ui.bootstrap', 'ui.select', 'angular-google-analytics', 'ui.router']);

var analytics_provider = void 0;
var ga_event = _util2.default.ga_event;

_module.config(['$uibTooltipProvider', '$uiRouterProvider', '$locationProvider', 'AnalyticsProvider', function ($uibTooltipProvider, $uiRouter, $location_provider, _analytics_provider) {
    $location_provider.html5Mode(true);
    $uibTooltipProvider.options({ placement: 'bottom' });
    _analytics_provider.delayScriptTag(true);
    analytics_provider = _analytics_provider;

    $uiRouter.urlService.rules.otherwise({ state: 'settings' });

    var state_registry = $uiRouter.stateRegistry;
    state_registry.register({
        name: 'app',
        redirectTo: 'settings',
        controller: 'root'
    });
    state_registry.register({
        name: 'settings',
        parent: 'app',
        url: '/',
        templateUrl: 'settings.html'
    });
    state_registry.register({
        name: 'proxies',
        parent: 'app',
        url: '/proxies',
        templateUrl: 'proxies.html'
    });
    state_registry.register({
        name: 'zones',
        parent: 'app',
        url: '/zones/{zone:string}',
        templateUrl: 'zones.html',
        params: { zone: { squash: true, value: null } }
    });
    state_registry.register({
        name: 'tools',
        parent: 'app',
        url: '/tools',
        templateUrl: 'tools.html'
    });
    state_registry.register({
        name: 'faq',
        parent: 'app',
        url: '/faq',
        templateUrl: 'faq.html'
    });
    state_registry.register({
        name: 'stats',
        template: '<div class=col-md-12>\n              <button ng-if=has_back ng-click=go_back()\n                class="btn btn-default">Back</button>\n              <ui-view></ui-view>\n            </div>',
        controller: function controller($scope, $transition$, $window) {
            if ($transition$.from().name == 'proxies') $scope.has_back = true;
            $scope.go_back = function () {
                $window.history.back();
            };
        }
    });
    state_registry.register({
        name: 'status_codes',
        parent: 'stats',
        url: '/status_codes',
        template: '<div react-view=react_component></div>',
        controller: function controller($scope) {
            $scope.react_component = _status_codes2.default;
        }
    });
    state_registry.register({
        name: 'status_codes_detail',
        parent: 'stats',
        url: '/status_codes/{code:int}',
        template: '<div react-view=react_component state-props=code></div>',
        controller: function controller($scope) {
            $scope.react_component = _status_codes_detail2.default;
        }
    });
    state_registry.register({
        name: 'domains',
        parent: 'stats',
        url: '/domains',
        template: '<div react-view=react_component></div>',
        controller: function controller($scope) {
            $scope.react_component = _domains2.default;
        }
    });
    state_registry.register({
        name: 'domains_detail',
        parent: 'stats',
        url: '/domains/{domain:string}',
        template: '<div react-view=react_component state-props=domain></div>',
        controller: function controller($scope) {
            $scope.react_component = _domains_detail2.default;
        }
    });
    state_registry.register({
        name: 'protocols',
        parent: 'stats',
        url: '/protocols',
        template: '<div react-view=react_component></div>',
        controller: function controller($scope) {
            $scope.react_component = _protocols2.default;
        }
    });
    state_registry.register({
        name: 'protocols_detail',
        parent: 'stats',
        url: '/protocols/{protocol:string}',
        template: '<div react-view=react_component state-props=protocol>\n            </div>',
        controller: function controller($scope) {
            $scope.react_component = _protocols_detail2.default;
        }
    });
}]);

_module.run(function ($rootScope, $http, $window, $transitions, $q, Analytics) {
    var logged_in_resolver = $q.defer();
    $rootScope.logged_in = logged_in_resolver.promise;
    $transitions.onBefore({ to: function to(state) {
            return !['app', 'faq'].includes(state.name);
        } }, function (transition) {
        return $q(function (resolve, reject) {
            $q.resolve($rootScope.logged_in).then(function (logged_in) {
                if (logged_in) {
                    if (transition.to().name != 'settings') return resolve(true);
                    return resolve(transition.router.stateService.target('proxies', undefined, { location: true }));
                }
                if (transition.to().name == 'settings') return resolve(true);
                return resolve(transition.router.stateService.target('settings', undefined, { location: false }));
            });
        });
    });
    $http.get('/api/mode').then(function (data) {
        var logged_in = data.data.logged_in;
        logged_in_resolver.resolve(logged_in);
        if (logged_in) $window.localStorage.setItem('quickstart-creds', true);
        $rootScope.mode = data.data.mode;
        $rootScope.run_config = data.data.run_config;
        var ua;
        if (ua = data.data.run_config.ua) {
            if (data.data.no_usage_stats) analytics_provider.disableAnalytics(true);
            analytics_provider.setAccount({
                tracker: ua.tid,
                set: { forceSSL: true },
                trackEvent: true
            });
            Analytics.registerScriptTags();
            Analytics.registerTrackers();
            _lodash2.default.each(ua._persistentParams, function (v, k) {
                return Analytics.set('&' + k, v);
            });
            Analytics.set('&an', (ua._persistentParams.an || 'LPM') + ' - UI');
        }
        analytics_provider = null;
        _util2.default.init_ga(Analytics);
        if ($window.localStorage.getItem('last_run_id') != $rootScope.run_config.id) {
            $window.localStorage.setItem('last_run_id', $rootScope.run_config.id);
            $window.localStorage.setItem('suppressed_warnings', '');
        }
        $rootScope.login_failure = data.data.login_failure;
        $rootScope.$broadcast('error_update');
        if (logged_in) {
            var p = 60 * 60 * 1000;
            var recheck = function recheck() {
                $http.post('/api/recheck').then(function (r) {
                    if (r.data.login_failure) $window.location = '/';
                });
                setTimeout(recheck, p);
            };
            var t = +(0, _date2.default)();
            setTimeout(recheck, p - t % p);
        }
    });
});

_module.factory('$proxies', proxies_factory);
proxies_factory.$inject = ['$http', '$q'];
function proxies_factory($http, $q) {
    var service = {
        subscribe: subscribe,
        proxies: null,
        update: update_proxies
    };
    var listeners = [];
    service.update();
    return service;
    function subscribe(func) {
        listeners.push(func);
        if (service.proxies) func(service.proxies);
    }
    function update_proxies() {
        var get_status = function get_status(force) {
            var proxy = this;
            if (!proxy._status_call || force) {
                var url = '/api/proxy_status/' + proxy.port;
                if (proxy.proxy_type != 'duplicate') url += '?with_details';
                proxy._status_call = $http.get(url);
            }
            this._status_call.then(function (res) {
                if (res.data.status == 'ok') {
                    proxy._status = 'ok';
                    proxy._status_details = res.data.status_details || [];
                } else {
                    proxy._status = 'error';
                    var errors = res.data.status_details.filter(function (s) {
                        return s.lvl == 'err';
                    });
                    proxy._status_details = errors.length ? errors : [{ lvl: 'err', msg: res.data.status }];
                }
            }).catch(function () {
                proxy._status_call = null;
                proxy._status = 'error';
                proxy._status_details = [{ lvl: 'warn',
                    msg: 'Failed to get proxy status' }];
            });
        };
        return $http.get('/api/proxies_running').then(function (res) {
            var proxies = res.data;
            proxies.sort(function (a, b) {
                return a.port > b.port ? 1 : -1;
            });
            proxies.forEach(function (proxy) {
                if (Array.isArray(proxy.proxy) && proxy.proxy.length == 1) proxy.proxy = proxy.proxy[0];
                proxy.get_status = get_status;
                proxy._status_details = [];
            });
            service.proxies = proxies;
            listeners.forEach(function (cb) {
                cb(proxies);
            });
            return proxies;
        });
    }
}

_module.controller('root', ['$rootScope', '$scope', '$http', '$window', '$state', '$transitions', function ($rootScope, $scope, $http, $window, $state, $transitions) {
    $scope.messages = _messages2.default;
    $scope.quickstart = function () {
        return $window.localStorage.getItem('quickstart') == 'show';
    };
    $scope.quickstart_completed = function (s) {
        return $window.localStorage.getItem('quickstart-' + s);
    };
    $scope.quickstart_dismiss = function () {
        var mc = $window.$('body > .main-container-qs');
        var qs = $window.$('body > .quickstart');
        var w = qs.outerWidth();
        mc.animate({ marginLeft: 0, width: '100%' });
        qs.animate({ left: -w }, { done: function done() {
                $window.localStorage.setItem('quickstart', 'dismissed');
                $scope.$apply();
            } });
    };
    $scope.quickstart_mousedown = function (mouse_dn) {
        var qs = $window.$('#quickstart');
        var container = $window.$('.main-container-qs');
        var width = qs.outerWidth();
        var body_width = $window.$('body').width();
        var cx = mouse_dn.pageX;
        var mousemove = function mousemove(mouse_mv) {
            var new_width = Math.min(Math.max(width + mouse_mv.pageX - cx, 150), body_width - 250);
            qs.css('width', new_width + 'px');
            container.css('margin-left', new_width + 'px');
        };
        $window.$('body').on('mousemove', mousemove).one('mouseup', function () {
            $window.$('body').off('mousemove', mousemove).css('cursor', '');
        }).css('cursor', 'col-resize');
    };
    $scope.sections = [{ name: 'settings', title: 'Settings' }, { name: 'proxies', title: 'Proxies' }, { name: 'zones', title: 'Zones' }, { name: 'tools', title: 'Tools' }, { name: 'faq', title: 'FAQ' }];
    $transitions.onSuccess({}, function (transition) {
        var state = transition.to(),
            section;
        $scope.section = section = $scope.sections.find(function (s) {
            return s.name == state.name;
        });
        $scope.subsection = section && section.name == 'zones' && transition.params().zone;
    });
    $scope.section = $scope.sections.find(function (s) {
        return s.name == $state.$current.name;
    });
    $http.get('/api/settings').then(function (settings) {
        $rootScope.settings = settings.data;
        $rootScope.beta_features = settings.data.argv.includes('beta_features');
        if (!$rootScope.settings.request_disallowed && !$rootScope.settings.customer) {
            if (!$window.localStorage.getItem('quickstart')) $window.localStorage.setItem('quickstart', 'show');
        }
    });
    $http.get('/api/ip').then(function (ip) {
        $scope.ip = ip.data.ip;
    });
    $http.get('/api/version').then(function (version) {
        $scope.ver_cur = version.data.version;
    });
    $http.get('/api/last_version').then(function (version) {
        $scope.ver_last = version.data;
    });
    $http.get('/api/consts').then(function (consts) {
        $rootScope.consts = consts.data;
        $scope.$broadcast('consts', consts.data);
    });
    $http.get('/api/node_version').then(function (node) {
        $scope.ver_node = node.data;
    });
    var show_reload = function show_reload() {
        $window.$('#restarting').modal({
            backdrop: 'static',
            keyboard: false
        });
    };
    var check_reload = function check_reload() {
        $http.get('/api/config').catch(function () {
            setTimeout(check_reload, 500);
        }).then(function () {
            $window.location.reload();
        });
    };
    $scope.is_upgradable = function () {
        if (!is_electron && $scope.ver_last && $scope.ver_last.newer) {
            var version = $window.localStorage.getItem('dismiss_upgrade');
            return version ? $scope.ver_last.version > version : true;
        }
        return false;
    };
    $scope.dismiss_upgrade = function () {
        $window.localStorage.setItem('dismiss_upgrade', $scope.ver_last.version);
    };
    $scope.upgrade = function () {
        $scope.$root.confirmation = {
            text: 'The application will be upgraded and restarted.',
            confirmed: function confirmed() {
                $window.$('#upgrading').modal({ backdrop: 'static',
                    keyboard: false });
                $scope.upgrading = true;
                $http.post('/api/upgrade').catch(function () {
                    $scope.upgrading = false;
                    $scope.upgrade_error = true;
                }).then(function (data) {
                    $scope.upgrading = false;
                    $http.post('/api/restart').catch(function () {
                        // $scope.upgrade_error = true;
                        show_reload();
                        check_reload();
                    }).then(function (d) {
                        show_reload();
                        check_reload();
                    });
                });
            }
        };
        $window.$('#confirmation').modal();
    };
    $scope.shutdown = function () {
        $scope.$root.confirmation = {
            text: 'Are you sure you want to shut down the local proxies?',
            confirmed: function confirmed() {
                $http.post('/api/shutdown');
                setTimeout(function () {
                    $window.$('#shutdown').modal({
                        backdrop: 'static',
                        keyboard: false
                    });
                }, 400);
            }
        };
        $window.$('#confirmation').modal();
    };
    $scope.logout = function () {
        $http.post('/api/logout').then(function cb() {
            $http.get('/api/config').catch(function () {
                setTimeout(cb, 500);
            }).then(function () {
                $window.location = '/';
            });
        });
    };
    $scope.warnings = function () {
        if (!$rootScope.run_config || !$rootScope.run_config.warnings) return [];
        var suppressed = $window.localStorage.getItem('suppressed_warnings').split('|||');
        var warnings = [];
        for (var i = 0; i < $rootScope.run_config.warnings.length; i++) {
            var w = $rootScope.run_config.warnings[i];
            if (!suppressed.includes(w)) warnings.push(w);
        }
        return warnings;
    };
    $scope.dismiss_warning = function (warning) {
        var warnings = $window.localStorage.getItem('suppressed_warnings').split('|||');
        warnings.push(warning);
        $window.localStorage.setItem('suppressed_warnings', warnings.join('|||'));
    };
    $scope.zone_click = function (name) {
        ga_event('navbar', 'click', name);
    };
}]);

_module.controller('config', Config);
Config.$inject = ['$scope', '$http', '$window'];
function Config($scope, $http, $window) {
    $http.get('/api/config').then(function (config) {
        $scope.config = config.data.config;
        setTimeout(function () {
            $scope.codemirror = _codemirror2.default.fromTextArea($window.$('#config-textarea').get(0), { mode: 'javascript' });
        }, 0);
    });
    var show_reload = function show_reload() {
        $window.$('#restarting').modal({
            backdrop: 'static',
            keyboard: false
        });
    };
    var check_reload = function check_reload() {
        $http.get('/api/config').catch(function () {
            setTimeout(check_reload, 500);
        }).then(function () {
            $window.location.reload();
        });
    };
    $scope.save = function () {
        $scope.errors = null;
        $http.post('/api/config_check', { config: $scope.codemirror.getValue() }).then(function (res) {
            $scope.errors = res.data;
            if ($scope.errors.length) return;
            $scope.$root.confirmation = {
                text: 'Editing the configuration manually may result in your ' + 'proxies working incorrectly. Do you still want to modify' + ' the configuration file?',
                confirmed: function confirmed() {
                    $scope.config = $scope.codemirror.getValue();
                    show_reload();
                    $http.post('/api/config', { config: $scope.config }).then(check_reload);
                }
            };
            $window.$('#confirmation').modal();
        });
    };
    $scope.update = function () {
        $http.get('/api/config').then(function (config) {
            $scope.config = config.data.config;
            $scope.codemirror.setValue($scope.config);
        });
    };
    $window.$('#config-panel').on('hidden.bs.collapse', $scope.update).on('show.bs.collapse', function () {
        setTimeout(function () {
            $scope.codemirror.scrollTo(0, 0);
            $scope.codemirror.refresh();
        }, 0);
    });
    $scope.cancel = function () {
        $window.$('#config-panel > .collapse').collapse('hide');
    };
}

_module.controller('resolve', Resolve);
Resolve.$inject = ['$scope', '$http', '$window'];
function Resolve($scope, $http, $window) {
    $scope.resolve = { text: '' };
    $scope.update = function () {
        $http.get('/api/resolve').then(function (resolve) {
            $scope.resolve.text = resolve.data.resolve;
        });
    };
    $scope.update();
    var show_reload = function show_reload() {
        $window.$('#restarting').modal({
            backdrop: 'static',
            keyboard: false
        });
    };
    var check_reload = function check_reload() {
        $http.get('/api/config').catch(function () {
            setTimeout(check_reload, 500);
        }).then(function () {
            $window.location.reload();
        });
    };
    $scope.save = function () {
        show_reload();
        $http.post('/api/resolve', { resolve: $scope.resolve.text }).then(check_reload);
    };
    $window.$('#resolve-panel').on('hidden.bs.collapse', $scope.update).on('show.bs.collapse', function () {
        setTimeout(function () {
            $window.$('#resolve-textarea').scrollTop(0).scrollLeft(0);
        }, 0);
    });
    $scope.cancel = function () {
        $window.$('#resolve-panel > .collapse').collapse('hide');
    };
    $scope.new_host = function () {
        $window.$('#resolve_add').one('shown.bs.modal', function () {
            $window.$('#resolve_add input').select();
        }).modal();
    };
    $scope.add_host = function () {
        $scope.adding = true;
        $scope.error = false;
        var host = $scope.host.host.trim();
        $http.get('/api/resolve_host/' + host).then(function (ips) {
            $scope.adding = false;
            if (ips.data.ips && ips.data.ips.length) {
                for (var i = 0; i < ips.data.ips.length; i++) {
                    $scope.resolve.text += '\n' + ips.data.ips[i] + ' ' + host;
                }setTimeout(function () {
                    var textarea = $window.$('#resolve-textarea');
                    textarea.scrollTop(textarea.prop('scrollHeight'));
                }, 0);
                $scope.host.host = '';
                $scope.resolve_frm.$setPristine();
                $window.$('#resolve_add').modal('hide');
            } else $scope.error = true;
        });
    };
}

_module.controller('settings', Settings);
Settings.$inject = ['$scope', '$http', '$window', '$sce', '$rootScope', '$state', '$location'];
function Settings($scope, $http, $window, $sce, $rootScope, $state, $location) {
    var update_error = function update_error() {
        if ($rootScope.relogin_required) return $scope.user_error = { message: 'Please log in again.' };
        if (!$rootScope.login_failure) return;
        switch ($rootScope.login_failure) {
            case 'eval_expired':
                $scope.user_error = { message: 'Evaluation expired!' + '<a href=https://luminati.io/#contact>Please contact your ' + 'Luminati rep.</a>' };
                break;
            case 'invalid_creds':
            case 'unknown':
                $scope.user_error = { message: 'Your proxy is not responding.<br>' + 'Please go to the <a href=https://luminati.io/cp/zones/' + $rootScope.settings.zone + '>zone page</a> and verify that ' + 'your IP address ' + ($scope.$parent.ip ? '(' + $scope.$parent.ip + ')' : '') + ' is in the whitelist.' };
                break;
            default:
                $scope.user_error = { message: $rootScope.login_failure };
        }
    };
    update_error();
    $scope.$on('error_update', update_error);
    $scope.parse_arguments = function (args) {
        return args.replace(/(--password )(.+?)( --|$)/, '$1|||$2|||$3').split('|||');
    };
    $scope.show_password = function () {
        $scope.args_password = true;
    };
    var check_reload = function check_reload() {
        $http.get('/api/config').catch(function () {
            setTimeout(check_reload, 500);
        }).then(function () {
            $window.location.reload();
        });
    };
    $scope.user_data = { username: '', password: '' };
    var token;
    $scope.save_user = function () {
        var creds = {};
        if (token) creds = { token: token };else {
            var username = $scope.user_data.username;
            var password = $scope.user_data.password;
            if (!(username = username.trim())) {
                $scope.user_error = {
                    message: 'Please enter a valid email address.',
                    username: true };
                return;
            }
            if (!password) {
                $scope.user_error = { message: 'Please enter a password.',
                    password: true };
                return;
            }
            creds = { username: username, password: password };
        }
        $scope.saving_user = true;
        $scope.user_error = null;
        if ($scope.user_customers) creds.customer = $scope.user_data.customer;
        $http.post('/api/creds_user', creds).then(function (d) {
            if (d.data.customers) {
                $scope.saving_user = false;
                $scope.user_customers = d.data.customers;
                $scope.user_data.customer = $scope.user_customers[0];
            } else check_reload();
        }).catch(function (error) {
            $scope.saving_user = false;
            $scope.user_error = error.data.error;
        });
    };
    $scope.google_click = function (e) {
        var google = $window.$(e.currentTarget),
            l = $window.location;
        google.attr('href', google.attr('href') + '&state=' + encodeURIComponent(l.protocol + '//' + l.hostname + ':' + (l.port || 80) + '?api_version=3'));
    };
    var m,
        qs_regex = /^([a-zA-Z0-9\+\/=]+)$/;
    if (m = ($location.search().t || '').replace(/\s+/g, '+').match(qs_regex)) {
        $scope.google_login = true;
        token = m[1];
        $scope.save_user();
    }
}

_module.controller('zones', Zones);
Zones.$inject = ['$scope', '$http', '$filter', '$window'];
function Zones($scope, $http, $filter, $window) {
    $window.localStorage.setItem('quickstart-zones-tools', true);
    var today = new Date();
    var one_day_ago = new Date().setDate(today.getDate() - 1);
    var two_days_ago = new Date().setDate(today.getDate() - 2);
    var one_month_ago = new Date().setMonth(today.getMonth() - 1, 1);
    var two_months_ago = new Date().setMonth(today.getMonth() - 2, 1);
    $scope.times = [{ title: (0, _moment2.default)(two_months_ago).format('MMM-YYYY'), key: 'back_m2' }, { title: (0, _moment2.default)(one_month_ago).format('MMM-YYYY'), key: 'back_m1' }, { title: (0, _moment2.default)(today).format('MMM-YYYY'), key: 'back_m0' }, { title: (0, _moment2.default)(two_days_ago).format('DD-MMM-YYYY'), key: 'back_d2' }, { title: (0, _moment2.default)(one_day_ago).format('DD-MMM-YYYY'), key: 'back_d1' }, { title: (0, _moment2.default)(today).format('DD-MMM-YYYY'), key: 'back_d0' }];
    var number_filter = $filter('requests');
    var size_filter = $filter('bytes');
    $scope.fields = [{ key: 'http_svc_req', title: 'HTTP', filter: number_filter }, { key: 'https_svc_req', title: 'HTTPS', filter: number_filter }, { key: 'bw_up', title: 'Upload', filter: size_filter }, { key: 'bw_dn', title: 'Download', filter: size_filter }, { key: 'bw_sum', title: 'Total Bandwidth', filter: size_filter }];
    $http.get('/api/stats').then(function (stats) {
        if (stats.data.login_failure) {
            $window.location = '/';
            return;
        }
        $scope.stats = stats.data;
        if (!Object.keys($scope.stats).length) $scope.error = true;
    }).catch(function (e) {
        $scope.error = true;
    });
    $http.get('/api/whitelist').then(function (whitelist) {
        $scope.whitelist = whitelist.data;
    });
    $http.get('/api/recent_ips').then(function (recent_ips) {
        $scope.recent_ips = recent_ips.data;
    });
    $scope.edit_zone = function (zone) {
        $window.location = 'https://luminati.io/cp/zones/' + zone;
    };
}

_module.controller('faq', Faq);
Faq.$inject = ['$scope'];
function Faq($scope) {
    $scope.questions = [{
        name: 'links',
        title: 'More info on the Luminati proxy manager'
    }, {
        name: 'upgrade',
        title: 'How can I upgrade Luminati proxy manager tool?'
    }, {
        name: 'ssl',
        title: 'How do I enable HTTPS sniffing?'
    }];
}

_module.controller('test', Test);
Test.$inject = ['$scope', '$http', '$filter', '$window'];
function Test($scope, $http, $filter, $window) {
    $window.localStorage.setItem('quickstart-zones-tools', true);
    var preset = JSON.parse(decodeURIComponent(($window.location.search.match(/[?&]test=([^&]+)/) || ['', 'null'])[1]));
    if (preset) {
        $scope.expand = true;
        $scope.proxy = '' + preset.port;
        $scope.url = preset.url;
        $scope.method = preset.method;
        $scope.body = preset.body;
    } else {
        $scope.method = 'GET';
        $scope.url = $scope.$root.settings.test_url;
    }
    $http.get('/api/proxies').then(function (proxies) {
        $scope.proxies = [['0', 'No proxy']];
        proxies.data.sort(function (a, b) {
            return a.port > b.port ? 1 : -1;
        });
        for (var i = 0; i < proxies.data.length; i++) {
            $scope.proxies.push(['' + proxies.data[i].port, '' + proxies.data[i].port]);
        }
        if (!$scope.proxy) $scope.proxy = $scope.proxies[1][0];
    });
    $scope.methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'COPY', 'HEAD', 'OPTIONS', 'LINK', 'UNLINK', 'PURGE', 'LOCK', 'UNLOCK', 'PROPFIND', 'VIEW'];
    $scope.request = {};
    $scope.go = function (proxy, url, method, headers, body) {
        var headers_obj = {};
        headers.forEach(function (h) {
            headers_obj[h.key] = h.value;
        });
        var req = {
            method: 'POST',
            url: '/api/test/' + proxy,
            data: {
                url: url,
                method: method,
                headers: headers_obj,
                body: body
            }
        };
        $scope.loading = true;
        $http(req).then(function (r) {
            $scope.loading = false;
            r = r.data;
            if (!r.error) {
                r.response.headers = Object.keys(r.response.headers).sort().map(function (key) {
                    return [key, r.response.headers[key]];
                });
            }
            $scope.request = r;
        });
    };
    $scope.headers = preset && preset.headers ? Object.keys(preset.headers).map(function (h) {
        return { key: h, value: preset.headers[h] };
    }) : [];
    $scope.add_header = function () {
        $scope.headers.push({ key: '', value: '' });
    };
    $scope.remove_header = function (index) {
        $scope.headers.splice(index, 1);
    };
    $scope.reset = function () {
        $scope.headers = [];
    };
}

_module.controller('test-ports', ['$scope', '$http', '$filter', '$window', function ($scope, $http, $filter, $window) {
    $window.localStorage.setItem('quickstart-zones-tools', true);
    var preset = JSON.parse(decodeURIComponent(($window.location.search.match(/[?&]test-ports=([^&]+)/) || ['', 'null'])[1]));
    if (preset) $scope.proxy = '' + preset.port;
    $http.get('/api/proxies').then(function (proxies) {
        $scope.proxies = [['0', 'All proxies']];
        proxies.data.sort(function (a, b) {
            return a.port > b.port ? 1 : -1;
        });
        for (var i = 0; i < proxies.data.length; i++) {
            $scope.proxies.push(['' + proxies.data[i].port, '' + proxies.data[i].port]);
        }
        if (!$scope.proxy) $scope.proxy = $scope.proxies[1][0];
    });
    $scope.request = {};
    $scope.go = function (proxy) {
        $scope.reset();
        var req = {
            method: 'GET',
            url: '/api/test-ports?ports=' + (+proxy == 0 ? $scope.proxies.map(function (p) {
                return +p[0];
            }).filter(Boolean).join(',') : proxy)
        };
        $scope.loading = true;
        $http(req).then(function (r) {
            $scope.loading = false;
            r = r.data;
            if (!r.error) {
                for (var port in r) {
                    $scope.request[port] = r[port];
                }
            }
            $scope.request.responses = [];
            for (var p in $scope.request) {
                if (!+p) continue;
                var response = $scope.request[p].response || $scope.request[p].error;
                $scope.request.responses.push({
                    proxy: p,
                    body: response.body || { pass: false },
                    ts: response.ts || +new Date()
                });
            }
        });
    };
    $scope.reset = function () {
        $scope.request = {};
    };
}]);

_module.controller('countries', Countries);
Countries.$inject = ['$scope', '$http', '$window'];
function Countries($scope, $http, $window) {
    $scope.url = '';
    $scope.ua = '';
    $scope.path = '';
    $scope.headers = [];
    $scope.started = 0;
    $scope.num_loading = 0;
    $scope.add_header = function () {
        $scope.headers.push({ key: '', value: '' });
    };
    $scope.remove_header = function (index) {
        $scope.headers.splice(index, 1);
    };
    var normalize_headers = function normalize_headers(headers) {
        var result = {};
        for (var h in headers) {
            result[headers[h].key] = headers[h].value;
        }return result;
    };
    $scope.go = function () {
        var process = function process() {
            $scope.started++;
            $scope.countries = [];
            var max_concur = 4;
            $scope.num_loading = 0;
            $scope.cur_index = 0;
            var progress = function progress(apply) {
                while ($scope.cur_index < $scope.countries.length && $scope.num_loading < max_concur) {
                    if (!$scope.countries[$scope.cur_index].status) {
                        $scope.countries[$scope.cur_index].status = 1;
                        $scope.countries[$scope.cur_index].img.src = $scope.countries[$scope.cur_index].url;
                        $scope.num_loading++;
                    }
                    $scope.cur_index++;
                }
                if (apply) $scope.$apply();
            };
            var nheaders = JSON.stringify(normalize_headers($scope.headers));
            for (var c_index in $scope.$root.consts.proxy.country.values) {
                var c = $scope.$root.consts.proxy.country.values[c_index];
                if (!c.value) continue;
                var params = {
                    country: c.value,
                    url: $scope.url,
                    path: $scope.path,
                    ua: $scope.ua,
                    headers: nheaders
                };
                var nparams = [];
                for (var p in params) {
                    nparams.push(p + '=' + encodeURIComponent(params[p]));
                }var data = {
                    code: c.value,
                    name: c.key,
                    status: 0,
                    url: '/api/country?' + nparams.join('&'),
                    img: new Image(),
                    index: $scope.countries.length
                };
                data.img.onerror = function (started) {
                    return function () {
                        if ($scope.started != started) return;
                        data.status = 3;
                        $scope.num_loading--;
                        progress(true);
                    };
                }($scope.started);
                data.img.onload = function (started) {
                    return function () {
                        if ($scope.started != started) return;
                        data.status = 4;
                        $scope.num_loading--;
                        progress(true);
                    };
                }($scope.started);
                $scope.countries.push(data);
            }
            progress(false);
        };
        if ($scope.started) {
            $scope.$root.confirmation = {
                text: 'The currently made screenshots will be lost. ' + 'Do you want to continue?',
                confirmed: process
            };
            $window.$('#confirmation').modal();
        } else process();
    };
    $scope.view = function (country) {
        $scope.screenshot = {
            country: country.name,
            url: country.url
        };
        $window.$('#countries-screenshot').one('shown.bs.modal', function () {
            $window.$('#countries-screenshot .modal-body > div').scrollTop(0).scrollLeft(0);
        }).modal();
    };
    $scope.cancel = function (country) {
        if (!country.status) country.status = 2;else if (country.status == 1) country.img.src = '';
    };
    $scope.cancel_all = function () {
        $scope.$root.confirmation = {
            text: 'Do you want to stop all the remaining countries?',
            confirmed: function confirmed() {
                for (var c_i = $scope.countries.length - 1; c_i >= 0; c_i--) {
                    var country = $scope.countries[c_i];
                    if (country.status < 2) $scope.cancel(country);
                }
            }
        };
        $window.$('#confirmation').modal();
    };
    $scope.retry = function (country) {
        if ($scope.cur_index > country.index) {
            country.status = 1;
            // XXX colin/ovidiu: why not use urlencoding?
            country.url = country.url.replace(/&\d+$/, '') + '&' + +(0, _date2.default)();
            $scope.num_loading++;
            country.img.src = country.url;
        } else country.status = 0;
    };
}

_module.filter('startFrom', function () {
    return function (input, start) {
        return input.slice(+start);
    };
});

function check_by_re(r, v) {
    return (v = v.trim()) && r.test(v);
}
var check_number = check_by_re.bind(null, /^\d+$/);
function check_reg_exp(v) {
    try {
        return (v = v.trim()) || new RegExp(v, 'i');
    } catch (e) {
        return false;
    }
}

var presets = {
    session_long: {
        title: 'Long single session (IP)',
        check: function check(opt) {
            return !opt.pool_size && !opt.sticky_ipo && opt.session === true && opt.keep_alive;
        },
        set: function set(opt) {
            opt.pool_size = 0;
            opt.ips = [];
            opt.keep_alive = opt.keep_alive || 50;
            opt.pool_type = undefined;
            opt.sticky_ip = false;
            opt.session = true;
            if (opt.session === true) opt.seed = false;
        },
        support: {
            keep_alive: true,
            multiply: true,
            session_ducation: true,
            max_requests: true
        }
    },
    session: {
        title: 'Single session (IP)',
        check: function check(opt) {
            return !opt.pool_size && !opt.sticky_ip && opt.session === true && !opt.keep_alive;
        },
        set: function set(opt) {
            opt.pool_size = 0;
            opt.ips = [];
            opt.keep_alive = 0;
            opt.pool_type = undefined;
            opt.sticky_ip = false;
            opt.session = true;
            if (opt.session === true) opt.seed = false;
        },
        support: {
            multiply: true,
            session_duration: true,
            max_requests: true
        }
    },
    sticky_ip: {
        title: 'Session (IP) per machine',
        check: function check(opt) {
            return !opt.pool_size && opt.sticky_ip;
        },
        set: function set(opt) {
            opt.pool_size = 0;
            opt.ips = [];
            opt.pool_type = undefined;
            opt.sticky_ip = true;
            opt.session = undefined;
            opt.multiply = undefined;
        },
        support: {
            keep_alive: true,
            max_requests: true,
            session_duration: true,
            seed: true
        }
    },
    sequential: {
        title: 'Sequential session (IP) pool',
        check: function check(opt) {
            return opt.pool_size && (!opt.pool_type || opt.pool_type == 'sequential');
        },
        set: function set(opt) {
            opt.pool_size = opt.pool_size || 1;
            opt.pool_type = 'sequential';
            opt.sticky_ip = undefined;
            opt.session = undefined;
        },
        support: {
            pool_size: true,
            keep_alive: true,
            max_requests: true,
            session_duration: true,
            multiply: true,
            seed: true
        }
    },
    round_robin: {
        title: 'Round-robin (IP) pool',
        check: function check(opt) {
            return opt.pool_size && opt.pool_type == 'round-robin' && !opt.multiply;
        },
        set: function set(opt) {
            opt.pool_size = opt.pool_size || 1;
            opt.pool_type = 'round-robin';
            opt.sticky_ip = undefined;
            opt.session = undefined;
            opt.multiply = undefined;
        },
        support: {
            pool_size: true,
            keep_alive: true,
            max_requests: true,
            session_duration: true,
            seed: true
        }
    },
    custom: {
        title: 'Custom',
        check: function check(opt) {
            return true;
        },
        set: function set(opt) {},
        support: {
            session: true,
            sticky_ip: true,
            pool_size: true,
            pool_type: true,
            keep_alive: true,
            max_requests: true,
            session_duration: true,
            multiply: true,
            seed: true
        }
    }
};
for (var k in presets) {
    presets[k].key = k;
}_module.controller('proxies', Proxies);
Proxies.$inject = ['$scope', '$http', '$proxies', '$window', '$q', '$timeout'];
function Proxies($scope, $http, $proxies, $window, $q, $timeout) {
    var prepare_opts = function prepare_opts(opt) {
        return opt.map(function (o) {
            return { key: o, value: o };
        });
    };
    var iface_opts = [],
        zone_opts = [];
    var country_opts = [],
        region_opts = {},
        cities_opts = {};
    var pool_type_opts = [],
        dns_opts = [],
        log_opts = [],
        debug_opts = [];
    $scope.presets = presets;
    var opt_columns = [{
        key: 'port',
        title: 'Port',
        type: 'number',
        check: function check(v, config) {
            if (check_number(v) && v >= 24000) {
                var conflicts = $proxies.proxies.filter(function (proxy) {
                    return proxy.port == v && proxy.port != config.port;
                });
                return !conflicts.length;
            }
            return false;
        }
    }, {
        key: '_status',
        title: 'Status',
        type: 'status'
    }, {
        key: 'iface',
        title: 'Interface',
        type: 'options',
        options: function options() {
            return iface_opts;
        }
    }, {
        key: 'multiply',
        title: 'Multiple',
        type: 'number'
    }, {
        key: 'history',
        title: 'History',
        type: 'boolean'
    }, {
        key: 'ssl',
        title: 'SSL sniffing',
        type: 'boolean'
    }, {
        key: 'socks',
        title: 'SOCKS port',
        type: 'number',
        check: check_number
    }, {
        key: 'zone',
        title: 'Zone',
        type: 'options',
        options: function options() {
            return zone_opts;
        }
    }, {
        key: 'secure_proxy',
        title: 'SSL for super proxy',
        type: 'boolean'
    }, {
        key: 'country',
        title: 'Country',
        type: 'options',
        options: function options(proxy) {
            if (proxy && proxy.zone == 'static') {
                return country_opts.filter(function (c) {
                    return ['', 'br', 'de', 'gb', 'au', 'us'].includes(c.value);
                });
            }
            return country_opts;
        }
    }, {
        key: 'state',
        title: 'State',
        type: 'options',
        options: function options(proxy) {
            return load_regions(proxy.country);
        }
    }, {
        key: 'city',
        title: 'City',
        type: 'autocomplete',
        check: function check() {
            return true;
        },
        options: function options(proxy) {
            return load_cities(proxy);
        }
    }, {
        key: 'asn',
        title: 'ASN',
        type: 'number',
        check: function check(v) {
            return check_number(v) && v < 400000;
        }
    }, {
        key: 'ip',
        title: 'Datacenter IP',
        type: 'text',
        check: function check(v) {
            if (!(v = v.trim())) return true;
            var m = v.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
            if (!m) return false;
            for (var i = 1; i <= 4; i++) {
                if (m[i] !== '0' && m[i].charAt(0) == '0' || m[i] > 255) return false;
            }
            return true;
        }
    }, {
        key: 'max_requests',
        title: 'Max requests',
        type: 'text',
        check: function check(v) {
            return !v || check_by_re(/^\d+(:\d*)?$/, v);
        }
    }, {
        key: 'session_duration',
        title: 'Session duration (sec)',
        type: 'text',
        check: function check(v) {
            return !v || check_by_re(/^\d+(:\d*)?$/, v);
        }
    }, {
        key: 'pool_size',
        title: 'Pool size',
        type: 'number',
        check: function check(v) {
            return !v || check_number(v);
        }
    }, {
        key: 'pool_type',
        title: 'Pool type',
        type: 'options',
        options: function options() {
            return pool_type_opts;
        }
    }, {
        key: 'sticky_ip',
        title: 'Sticky IP',
        type: 'boolean'
    }, {
        key: 'keep_alive',
        title: 'Keep-alive',
        type: 'number',
        check: function check(v) {
            return !v || check_number(v);
        }
    }, {
        key: 'seed',
        title: 'Seed',
        type: 'text',
        check: function check(v) {
            return !v || check_by_re(/^[^\.\-]*$/, v);
        }
    }, {
        key: 'session',
        title: 'Session',
        type: 'text',
        check: function check(v) {
            return !v || check_by_re(/^[^\.\-]*$/, v);
        }
    }, {
        key: 'allow_proxy_auth',
        title: 'Allow request authentication',
        type: 'boolean'
    }, {
        key: 'session_init_timeout',
        title: 'Session init timeout (sec)',
        type: 'number',
        check: function check(v) {
            return !v || check_number(v);
        }
    }, {
        key: 'proxy_count',
        title: 'Min number of super proxies',
        type: 'number',
        check: function check(v) {
            return !v || check_number(v);
        }
    }, {
        key: 'dns',
        title: 'DNS',
        type: 'options',
        options: function options() {
            return dns_opts;
        }
    }, {
        key: 'log',
        title: 'Log Level',
        type: 'options',
        options: function options() {
            return log_opts;
        }
    }, {
        key: 'proxy_switch',
        title: 'Autoswitch super proxy on failure',
        type: 'number',
        check: function check(v) {
            return !v || check_number(v);
        }
    }, {
        key: 'throttle',
        title: 'Throttle concurrent connections',
        type: 'number',
        check: function check(v) {
            return !v || check_number(v);
        }
    }, {
        key: 'request_timeout',
        title: 'Request timeout (sec)',
        type: 'number',
        check: function check(v) {
            return !v || check_number(v);
        }
    }, {
        key: 'debug',
        title: 'Debug info',
        type: 'options',
        options: function options() {
            return debug_opts;
        }
    }, {
        key: 'null_response',
        title: 'NULL response',
        type: 'text',
        check: check_reg_exp
    }, {
        key: 'bypass_proxy',
        title: 'Bypass proxy',
        type: 'text',
        check: check_reg_exp
    }, {
        key: 'direct_include',
        title: 'Direct include',
        type: 'text',
        check: check_reg_exp
    }, {
        key: 'direct_exclude',
        title: 'Direct exclude',
        type: 'text',
        check: check_reg_exp
    }];
    var default_cols = {
        port: true,
        _status: true,
        zone: true,
        country: true,
        city: true,
        state: true,
        sticky_ip: true
    };
    $scope.cols_conf = JSON.parse($window.localStorage.getItem('columns')) || _lodash2.default.cloneDeep(default_cols);
    $scope.$watch('cols_conf', function () {
        $scope.columns = opt_columns.filter(function (col) {
            return col.key.match(/^_/) || $scope.cols_conf[col.key];
        });
    }, true);
    var apply_consts = function apply_consts(data) {
        iface_opts = data.iface.values;
        zone_opts = data.zone.values;
        country_opts = data.country.values;
        pool_type_opts = data.pool_type.values;
        dns_opts = prepare_opts(data.dns.values);
        log_opts = data.log.values;
        debug_opts = data.debug.values;
    };
    $scope.$on('consts', function (e, data) {
        apply_consts(data.proxy);
    });
    if ($scope.$root.consts) apply_consts($scope.$root.consts.proxy);
    $scope.zones = {};
    $scope.selected_proxies = {};
    $scope.showed_status_proxies = {};
    $scope.pagination = { page: 1, per_page: 10 };
    $scope.set_page = function () {
        var page = $scope.pagination.page;
        var per_page = $scope.pagination.per_page;
        if (page < 1) page = 1;
        if (page * per_page > $scope.proxies.length) page = Math.ceil($scope.proxies.length / per_page);
        $scope.pagination.page = page;
    };
    $proxies.subscribe(function (proxies) {
        $scope.proxies = proxies;
        $scope.set_page();
        proxies.forEach(function (p) {
            $scope.showed_status_proxies[p.port] = $scope.showed_status_proxies[p.port] && p._status_details.length;
        });
    });
    $scope.delete_proxies = function () {
        $scope.$root.confirmation = {
            text: 'Are you sure you want to delete the proxy?',
            confirmed: function confirmed() {
                var selected = $scope.get_selected_proxies();
                var promises = $scope.proxies.filter(function (p) {
                    return p.proxy_type == 'persist' && selected.includes(p.port);
                }).map(function (p) {
                    return $http.delete('/api/proxies/' + p.port);
                });
                $scope.selected_proxies = {};
                $q.all(promises).then(function () {
                    return $proxies.update();
                });
            }
        };
        $window.$('#confirmation').modal();
        ga_event('page: proxies', 'click', 'delete proxy');
    };
    $scope.refresh_sessions = function (proxy) {
        $http.post('/api/refresh_sessions/' + proxy.port).then(function () {
            return $proxies.update();
        });
    };
    $scope.show_history = function (proxy) {
        $scope.history_dialog = [{ port: proxy.port }];
    };
    $scope.show_pool = function (proxy) {
        $scope.pool_dialog = [{
            port: proxy.port,
            sticky_ip: proxy.sticky_ip,
            pool_size: proxy.pool_size
        }];
    };
    $scope.add_proxy = function () {
        $scope.proxy_dialog = [{ proxy: {} }];
        ga_event('page: proxies', 'click', 'add proxy');
    };
    $scope.edit_proxy = function (duplicate) {
        var port = $scope.get_selected_proxies()[0];
        var proxy = $scope.proxies.filter(function (p) {
            return p.port == port;
        });
        $scope.proxy_dialog = [{ proxy: proxy[0].config, duplicate: duplicate }];
        ga_event('page: proxies', 'click', 'edit proxy');
    };
    $scope.edit_cols = function () {
        $scope.columns_dialog = [{
            columns: opt_columns.filter(function (col) {
                return !col.key.match(/^_/);
            }),
            cols_conf: $scope.cols_conf,
            default_cols: default_cols
        }];
        ga_event('page: proxies', 'click', 'edit columns');
    };
    $scope.inline_edit_click = function (proxy, col) {
        if (proxy.proxy_type != 'persist' || !$scope.is_valid_field(proxy, col.key)) {
            return;
        }
        switch (col.type) {
            case 'number':
            case 'text':
            case 'autocomplete':
            case 'options':
                proxy.edited_field = col.key;break;
            case 'boolean':
                var config = _lodash2.default.cloneDeep(proxy.config);
                config[col.key] = !proxy[col.key];
                config.proxy_type = 'persist';
                $http.put('/api/proxies/' + proxy.port, { proxy: config }).then(function () {
                    $proxies.update();
                });
                break;
        }
    };
    $scope.inline_edit_input = function (proxy, col, event) {
        if (event.which == 27) return $scope.inline_edit_blur(proxy, col);
        var v = event.currentTarget.value;
        var p = $window.$(event.currentTarget).closest('.proxies-table-input');
        if (col.check(v, proxy.config)) p.removeClass('has-error');else return p.addClass('has-error');
        if (event.which != 13) return;
        v = v.trim();
        if (proxy.original[col.key] !== undefined && proxy.original[col.key].toString() == v) {
            return $scope.inline_edit_blur(proxy, col);
        }
        if (col.type == 'number' && v) v = +v;
        var config = _lodash2.default.cloneDeep(proxy.config);
        config[col.key] = v;
        config.proxy_type = 'persist';
        $http.post('/api/proxy_check/' + proxy.port, config).then(function (res) {
            var errors = res.data.filter(function (i) {
                return i.lvl == 'err';
            });
            if (!errors.length) return $http.put('/api/proxies/' + proxy.port, { proxy: config });
        }).then(function (res) {
            if (res) $proxies.update();
        });
    };
    $scope.inline_edit_select = function (proxy, col, event) {
        if (event.which == 27) return $scope.inline_edit_blur(proxy, col);
    };
    $scope.inline_edit_set = function (proxy, col, v) {
        if (proxy.original[col.key] === v || proxy.original[col.key] == v && v !== true) return $scope.inline_edit_blur(proxy, col);
        var config = _lodash2.default.cloneDeep(proxy.config);
        config[col.key] = v;
        config.proxy_type = 'persist';
        if (col.key == 'country') config.state = config.city = '';
        if (col.key == 'state') config.city = '';
        if (col.key == 'zone' && $scope.consts) {
            var zone;
            if (zone = $scope.consts.proxy.zone.values.find(_lodash2.default.matches({ zone: v }))) {
                config.password = zone.password;
            }
        }
        $http.put('/api/proxies/' + proxy.port, { proxy: config }).then(function () {
            $proxies.update();
        });
    };
    $scope.inline_edit_blur = function (proxy, col) {
        $timeout(function () {
            proxy.config[col.key] = proxy.original[col.key];
            if (proxy.edited_field == col.key) proxy.edited_field = '';
        }, 100);
    };
    $scope.inline_edit_start = function (proxy, col) {
        if (!proxy.original) proxy.original = _lodash2.default.cloneDeep(proxy.config);
        if (col.key == 'session' && proxy.config.session === true) proxy.config.session = '';
    };
    $scope.get_selected_proxies = function () {
        return Object.keys($scope.selected_proxies).filter(function (p) {
            return $scope.selected_proxies[p];
        }).map(function (p) {
            return +p;
        });
    };
    $scope.is_action_available = function (action) {
        var proxies = $scope.get_selected_proxies() || [];
        if (!proxies.length) return false;
        if (action == 'duplicate') return proxies.length == 1;
        return !$scope.proxies.some(function (sp) {
            return $scope.selected_proxies[sp.port] && sp.proxy_type != 'persist';
        });
    };
    $scope.option_key = function (col, val) {
        var opt = col.options().find(function (o) {
            return o.value == val;
        });
        return opt && opt.key;
    };
    $scope.toggle_proxy_status_details = function (proxy) {
        if (proxy._status_details.length) {
            $scope.showed_status_proxies[proxy.port] = !$scope.showed_status_proxies[proxy.port];
        }
    };
    $scope.get_colspans = function () {
        for (var i = 0; i < $scope.columns.length; i++) {
            if ($scope.columns[i].key == '_status') return [i + 1, $scope.columns.length - i + 1];
        }
        return [0, 0];
    };
    $scope.get_column_tooltip = function (proxy, col) {
        if (proxy.proxy_type != 'persist') return 'This proxy\'s settings cannot be changed';
        if (!$scope.is_valid_field(proxy, col.key)) {
            return 'You don\'t have \'' + col.key + '\' permission.<br>' + 'Please contact your success manager.';
        }
        if (col.key == 'country') return $scope.option_key(col, proxy[col.key]);
        if (col.key == 'session' && proxy.session === true) return 'Random';
        if (['state', 'city'].includes(col.key) && [undefined, '', '*'].includes(proxy.country)) {
            return 'Set the country first';
        }
        var config_val = proxy.config[col.key];
        var real_val = proxy[col.key];
        if (real_val && real_val !== config_val) return 'Set non-default value';
        return 'Change value';
    };
    $scope.is_valid_field = function (proxy, name) {
        if (!$scope.$root.consts) return true;
        return is_valid_field(proxy, name, $scope.$root.consts.proxy.zone);
    };
    $scope.starts_with = function (actual, expected) {
        return expected.length > 1 && actual.toLowerCase().startsWith(expected.toLowerCase());
    };
    $scope.typeahead_on_select = function (proxy, col, item) {
        if (col.key == 'city') {
            var config = _lodash2.default.cloneDeep(proxy.config);
            config.city = item.key;
            config.state = item.region || '';
            $http.put('/api/proxies/' + proxy.port, { proxy: config }).then(function () {
                $proxies.update();
            });
        }
    };
    $scope.on_page_change = function () {
        $scope.selected_proxies = {};
    };
    var load_regions = function load_regions(country) {
        if (!country || country == '*') return [];
        return region_opts[country] || (region_opts[country] = $http.get('/api/regions/' + country.toUpperCase()).then(function (r) {
            return region_opts[country] = r.data;
        }));
    };
    var load_cities = function load_cities(proxy) {
        var country = proxy.country.toUpperCase();
        var state = proxy.state;
        if (!country || country == '*') return [];
        if (!cities_opts[country]) {
            cities_opts[country] = [];
            $http.get('/api/cities/' + country).then(function (res) {
                return cities_opts[country] = res.data.map(function (city) {
                    if (city.region) city.value = city.value + ' (' + city.region + ')';
                    return city;
                });
            });
        }
        var options = cities_opts[country];
        if (state && state != '*') options = options.filter(function (i) {
            return i.region == state;
        });
        return options;
    };
    $scope.react_component = _stats2.default;
}

_module.controller('history', History);
History.$inject = ['$scope', '$http', '$window'];
function History($scope, $http, $window) {
    $scope.hola_headers = [];
    $http.get('/api/hola_headers').then(function (h) {
        $scope.hola_headers = h.data;
    });
    $scope.init = function (locals) {
        var loader_delay = 100;
        var timestamp_changed_by_select = false;
        $scope.initial_loading = true;
        $scope.port = locals.port;
        $scope.show_modal = function () {
            $window.$('#history').modal();
        };
        $http.get('/api/history_context/' + locals.port).then(function (c) {
            $scope.history_context = c.data;
        });
        $scope.periods = [{ label: 'all time', value: '*' }, { label: '1 year', value: { y: 1 } }, { label: '3 months', value: { M: 3 } }, { label: '2 months', value: { M: 2 } }, { label: '1 month', value: { M: 1 } }, { label: '1 week', value: { w: 1 } }, { label: '3 days', value: { d: 3 } }, { label: '1 day', value: { d: 1 } }, { label: 'custom', value: '' }];
        $scope.fields = [{
            field: 'url',
            title: 'Url',
            type: 'string',
            filter_label: 'URL or substring'
        }, {
            field: 'method',
            title: 'Method',
            type: 'options',
            filter_label: 'Request method'
        }, {
            field: 'status_code',
            title: 'Code',
            type: 'number',
            filter_label: 'Response code'
        }, {
            field: 'timestamp',
            title: 'Time',
            type: 'daterange'
        }, {
            field: 'elapsed',
            title: 'Elapsed',
            type: 'numrange'
        }, {
            field: 'country',
            title: 'Country',
            type: 'options',
            filter_label: 'Node country'
        }, {
            field: 'super_proxy',
            title: 'Super Proxy',
            type: 'string',
            filter_label: 'Super proxy or substring'
        }, {
            field: 'proxy_peer',
            title: 'Proxy Peer',
            type: 'string',
            filter_label: 'IP or substring'
        }, {
            field: 'context',
            title: 'Context',
            type: 'options',
            filter_label: 'Request context'
        }];
        $scope.sort_field = 'timestamp';
        $scope.sort_asc = false;
        $scope.virtual_filters = { period: $scope.periods[0].value };
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
            context: ''
        };
        $scope.pagination = {
            page: 1,
            per_page: 10,
            total: 1
        };
        $scope.update = function (export_type) {
            var params = { sort: $scope.sort_field };
            if (!export_type) {
                params.limit = $scope.pagination.per_page;
                params.skip = ($scope.pagination.page - 1) * $scope.pagination.per_page;
            }
            if (!$scope.sort_asc) params.sort_desc = 1;
            if ($scope.filters.url) params.url = $scope.filters.url;
            if ($scope.filters.method) params.method = $scope.filters.method;
            if ($scope.filters.status_code) params.status_code = $scope.filters.status_code;
            if ($scope.filters.timestamp_min) {
                params.timestamp_min = (0, _moment2.default)($scope.filters.timestamp_min, 'YYYY/MM/DD').valueOf();
            }
            if ($scope.filters.timestamp_max) {
                params.timestamp_max = (0, _moment2.default)($scope.filters.timestamp_max, 'YYYY/MM/DD').add(1, 'd').valueOf();
            }
            if ($scope.filters.elapsed_min) params.elapsed_min = $scope.filters.elapsed_min;
            if ($scope.filters.elapsed_max) params.elapsed_max = $scope.filters.elapsed_max;
            if ($scope.filters.country) params.country = $scope.filters.country;
            if ($scope.filters.super_proxy) params.super_proxy = $scope.filters.super_proxy;
            if ($scope.filters.proxy_peer) params.proxy_peer = $scope.filters.proxy_peer;
            if ($scope.filters.context) params.context = $scope.filters.context;
            var params_arr = [];
            for (var param in params) {
                params_arr.push(param + '=' + encodeURIComponent(params[param]));
            }var url = '/api/history';
            if (export_type == 'har' || export_type == 'csv') url += '_' + export_type;
            url += '/' + locals.port + '?' + params_arr.join('&');
            if (export_type) return $window.location = url;
            $scope.loading = +(0, _date2.default)();
            setTimeout(function () {
                $scope.$apply();
            }, loader_delay);
            $http.get(url).then(function (res) {
                $scope.pagination.total_items = res.data.total;
                var history = res.data.items;
                $scope.initial_loading = false;
                $scope.loading = false;
                $scope.history = history.map(function (r) {
                    var alerts = [];
                    var disabled_alerts = [];
                    var add_alert = function add_alert(alert) {
                        if (localStorage.getItem('request-alert-disabled-' + alert.type)) {
                            disabled_alerts.push(alert);
                        } else alerts.push(alert);
                    };
                    var raw_headers = JSON.parse(r.request_headers);
                    var request_headers = {};
                    for (var h in raw_headers) {
                        request_headers[h.toLowerCase()] = raw_headers[h];
                    }r.request_headers = request_headers;
                    r.response_headers = JSON.parse(r.response_headers);
                    r.alerts = alerts;
                    r.disabled_alerts = disabled_alerts;
                    if (r.url.match(/^(https?:\/\/)?\d+\.\d+\.\d+\.\d+[$\/\?:]/)) {
                        add_alert({
                            type: 'ip_url',
                            title: 'IP URL',
                            description: 'The url uses IP and not ' + 'hostname, it will not be served from the' + ' proxy peer. It could mean a resolve ' + 'configuration issue when using SOCKS.'
                        });
                    }
                    if (r.method == 'CONNECT' || request_headers.host == 'lumtest.com' || r.url.match(/^https?:\/\/lumtest.com[$\/\?]/)) {
                        return r;
                    }
                    if (!request_headers['user-agent']) {
                        add_alert({
                            type: 'agent_empty',
                            title: 'Empty user agent',
                            description: 'The User-Agent header ' + 'is not set to any value.'
                        });
                    } else if (!request_headers['user-agent'].match(/^Mozilla\//)) {
                        add_alert({
                            type: 'agent_suspicious',
                            title: 'Suspicious user agent',
                            description: 'The User-Agent header is set to ' + 'a value not corresponding to any of the ' + 'major web browsers.'
                        });
                    }
                    if (!request_headers.accept) {
                        add_alert({
                            type: 'accept_empty',
                            title: 'Empty accept types',
                            description: 'The Accept header is not set to ' + 'any value.'
                        });
                    }
                    if (!request_headers['accept-encoding']) {
                        add_alert({
                            type: 'accept_encoding_empty',
                            title: 'Empty accept encoding',
                            description: 'The Accept-Encoding header is ' + 'not set to any value.'
                        });
                    }
                    if (!request_headers['accept-language']) {
                        add_alert({
                            type: 'accept_language_empty',
                            title: 'Empty accept language',
                            description: 'The Accept-Language header is ' + 'not set to any value.'
                        });
                    }
                    if (request_headers.connection != 'keep-alive') {
                        add_alert({
                            type: 'connection_suspicious',
                            title: 'Suspicious connection type',
                            description: 'The Connection header is not ' + 'set to "keep-alive".'
                        });
                    }
                    if (r.method == 'GET' && !r.url.match(/^https?:\/\/[^\/\?]+\/?$/) && !r.url.match(/[^\w]favicon[^\w]/) && !request_headers.referer) {
                        add_alert({
                            type: 'referer_empty',
                            title: 'Empty referrer',
                            description: 'The Referer header is not set ' + 'even though the requested URL is not ' + 'the home page of the site.'
                        });
                    }
                    var sensitive_headers = [];
                    for (var i in $scope.hola_headers) {
                        if (request_headers[$scope.hola_headers[i]]) sensitive_headers.push($scope.hola_headers[i]);
                    }
                    if (sensitive_headers.length) {
                        add_alert({
                            type: 'sensitive_header',
                            title: 'Sensitive request header',
                            description: (sensitive_headers.length > 1 ? 'There are sensitive request headers' : 'There is sensitive request header') + ' in the request: ' + sensitive_headers.join(', ')
                        });
                    }
                    return r;
                });
            });
        };
        $scope.show_loader = function () {
            return $scope.loading && (0, _date2.default)() - $scope.loading >= loader_delay;
        };
        $scope.sort = function (field) {
            if ($scope.sort_field == field.field) $scope.sort_asc = !$scope.sort_asc;else {
                $scope.sort_field = field.field;
                $scope.sort_asc = true;
            }
            $scope.update();
        };
        $scope.filter = function (field) {
            var options;
            if (field.field == 'method') {
                options = ['', 'GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'COPY', 'HEAD', 'OPTIONS', 'LINK', 'UNLINK', 'PURGE', 'LOCK', 'UNLOCK', 'PROPFIND', 'VIEW', 'TRACE', 'CONNECT'].map(function (e) {
                    return { key: e, value: e };
                });
            } else if (field.field == 'country') options = $scope.$root.consts.proxy.country.values;else if (field.field == 'context') options = $scope.history_context;
            $scope.filter_dialog = [{
                field: field,
                filters: $scope.filters,
                update: $scope.update,
                options: options
            }];
            setTimeout(function () {
                $window.$('#history_filter').one('shown.bs.modal', function () {
                    $window.$('#history_filter .history-filter-autofocus').select().focus();
                }).modal();
            }, 0);
        };
        $scope.filter_cancel = function (field) {
            if (field.field == 'elapsed') {
                $scope.filters.elapsed_min = '';
                $scope.filters.elapsed_max = '';
            }
            if (field.field == 'timestamp') {
                $scope.filters.timestamp_min = null;
                $scope.filters.timestamp_max = null;
            }
            $scope.filters[field.field] = '';
            $scope.update();
        };
        $scope.toggle_prop = function (row, prop) {
            row[prop] = !row[prop];
        };
        $scope.export_type = 'visible';
        $scope.disable_alert = function (row, alert) {
            localStorage.setItem('request-alert-disabled-' + alert.type, 1);
            for (var i = 0; i < row.alerts.length; i++) {
                if (row.alerts[i].type == alert.type) {
                    row.disabled_alerts.push(row.alerts.splice(i, 1)[0]);
                    break;
                }
            }
        };
        $scope.enable_alert = function (row, alert) {
            localStorage.removeItem('request-alert-disabled-' + alert.type);
            for (var i = 0; i < row.disabled_alerts.length; i++) {
                if (row.disabled_alerts[i].type == alert.type) {
                    row.alerts.push(row.disabled_alerts.splice(i, 1)[0]);
                    break;
                }
            }
        };
        $scope.on_period_change = function () {
            var period = $scope.virtual_filters.period;
            if (!period) return;
            if (period != '*') {
                var from = (0, _moment2.default)().subtract($scope.virtual_filters.period).format('YYYY/MM/DD');
                var to = (0, _moment2.default)().format('YYYY/MM/DD');
                $scope.filters.timestamp_min = from;
                $scope.filters.timestamp_max = to;
                $scope.filters.timestamp = from + '-' + to;
            } else {
                $scope.filters.timestamp_min = null;
                $scope.filters.timestamp_max = null;
                $scope.filters.timestamp = '';
            }
            timestamp_changed_by_select = true;
            $scope.update();
        };
        $scope.$watch('filters.timestamp', function (after) {
            if (!after) $scope.virtual_filters.period = '*';else if (!timestamp_changed_by_select) $scope.virtual_filters.period = '';
            timestamp_changed_by_select = false;
        });
        $scope.update();
    };
}

_module.controller('history_filter', History_filter);
History_filter.$inject = ['$scope', '$window'];
function History_filter($scope, $window) {
    $scope.init = function (locals) {
        $scope.field = locals.field;
        var field = locals.field.field;
        var range = field == 'elapsed' || field == 'timestamp';
        $scope.value = { composite: locals.filters[field] };
        if (range) {
            $scope.value.min = locals.filters[field + '_min'];
            $scope.value.max = locals.filters[field + '_max'];
        }
        $scope.options = locals.options;
        $scope.keypress = function (event) {
            if (event.which == 13) {
                $scope.apply();
                $window.$('#history_filter').modal('hide');
            }
        };
        $scope.daterange = function (event) {
            $window.$(event.currentTarget).closest('.input-group').datepicker({
                autoclose: true,
                format: 'yyyy/mm/dd'
            }).datepicker('show');
        };
        $scope.apply = function () {
            if (range) {
                var display_min, display_max;
                display_min = $scope.value.min;
                display_max = $scope.value.max;
                if ($scope.value.min && $scope.value.max) $scope.value.composite = display_min + '-' + display_max;else if ($scope.value.min) $scope.value.composite = 'From ' + display_min;else if ($scope.value.max) $scope.value.composite = 'Up to ' + display_max;else $scope.value.composite = '';
                locals.filters[field + '_min'] = $scope.value.min;
                locals.filters[field + '_max'] = $scope.value.max;
            }
            if ($scope.value.composite != locals.filters[field]) {
                locals.filters[field] = $scope.value.composite;
                locals.update();
            }
        };
    };
}

_module.controller('pool', Pool);
Pool.$inject = ['$scope', '$http', '$window'];
function Pool($scope, $http, $window) {
    $scope.init = function (locals) {
        $scope.port = locals.port;
        $scope.pool_size = locals.pool_size;
        $scope.sticky_ip = locals.sticky_ip;
        $scope.pagination = { page: 1, per_page: 10 };
        $scope.show_modal = function () {
            $window.$('#pool').modal();
        };
        $scope.update = function (refresh) {
            $scope.pool = null;
            $http.get('/api/sessions/' + $scope.port + (refresh ? '?refresh' : '')).then(function (res) {
                $scope.pool = res.data.data;
            });
        };
        $scope.update();
    };
}

_module.controller('proxy', Proxy);
Proxy.$inject = ['$scope', '$http', '$proxies', '$window', '$q'];
function Proxy($scope, $http, $proxies, $window, $q) {
    $scope.init = function (locals) {
        var regions = {};
        var cities = {};
        $scope.consts = $scope.$root.consts.proxy;
        $scope.port = locals.duplicate ? '' : locals.proxy.port;
        var form = $scope.form = _lodash2.default.cloneDeep(locals.proxy);
        form.port = $scope.port;
        form.zone = form.zone || '';
        form.debug = form.debug || '';
        form.country = form.country || '';
        form.state = form.state || '';
        form.city = form.city || '';
        form.dns = form.dns || '';
        form.log = form.log || '';
        form.ips = form.ips || [];
        if (_lodash2.default.isBoolean(form.rules)) form.rules = {};
        $scope.extra = {
            reverse_lookup: '',
            reverse_lookup_dns: form.reverse_lookup_dns,
            reverse_lookup_file: form.reverse_lookup_file,
            reverse_lookup_values: (form.reverse_lookup_values || []).join('\n')
        };
        if ($scope.extra.reverse_lookup_dns) $scope.extra.reverse_lookup = 'dns';else if ($scope.extra.reverse_lookup_file) $scope.extra.reverse_lookup = 'file';else if ($scope.extra.reverse_lookup_values) $scope.extra.reverse_lookup = 'values';
        $scope.extra.whitelist_ips = (form.whitelist_ips || []).join(',');
        $scope.status = {};
        var new_proxy = !form.port || form.port == '';
        if (new_proxy) {
            var port = 24000;
            var socks = form.socks;
            $scope.proxies.forEach(function (p) {
                if (p.port >= port) port = p.port + 1;
                if (socks && p.socks == socks) socks++;
            });
            form.port = port;
            form.socks = socks;
        }
        var def_proxy = form;
        if (new_proxy) {
            def_proxy = {};
            for (var key in $scope.consts) {
                if ($scope.consts[key].def !== undefined) def_proxy[key] = $scope.consts[key].def;
            }
        }
        for (var p in presets) {
            if (presets[p].check(def_proxy)) {
                form.preset = presets[p];
                break;
            }
        }
        $scope.apply_preset = function () {
            form.preset.set(form);
            if (form.session === true) {
                form.session_random = true;
                form.session = '';
            }
            if (form.max_requests) {
                var max_requests = ('' + form.max_requests).split(':');
                form.max_requests_start = +max_requests[0];
                form.max_requests_end = +max_requests[1];
            }
            if (!form.max_requests) form.max_requests_start = 0;
            if (form.session_duration) {
                var session_duration = ('' + form.session_duration).split(':');
                form.duration_start = +session_duration[0];
                form.duration_end = +session_duration[1];
            }
        };
        $scope.apply_preset();
        $scope.form_errors = {};
        $scope.defaults = {};
        $http.get('/api/defaults').then(function (defaults) {
            $scope.defaults = defaults.data;
        });
        $scope.regions = [];
        $scope.cities = [];
        $scope.beta_features = $scope.$root.beta_features;
        $scope.get_zones_names = function () {
            return Object.keys($scope.zones);
        };
        $scope.show_modal = function () {
            $window.$('#proxy').one('shown.bs.modal', function () {
                $window.$('#proxy-field-port').select().focus();
                $window.$('#proxy .panel-collapse').on('show.bs.collapse', function (event) {
                    var container = $window.$('#proxy .proxies-settings');
                    var opening = $window.$(event.currentTarget).closest('.panel');
                    var pre = opening.prevAll('.panel');
                    var top;
                    if (pre.length) {
                        top = opening.position().top + container.scrollTop();
                        var closing = pre.find('.panel-collapse.in');
                        if (closing.length) top -= closing.height();
                    } else top = 0;
                    container.animate({ 'scrollTop': top }, 250);
                });
            }).modal();
        };
        $scope.is_show_allocated_ips = function () {
            var zone = $scope.consts.zone.values.filter(function (z) {
                return z.value == form.zone;
            })[0];
            var plan = (zone && zone.plans || []).slice(-1)[0];
            return (plan && plan.type || zone && zone.type) == 'static';
        };
        $scope.show_allocated_ips = function () {
            var zone = form.zone;
            var keypass = form.password || '';
            var modals = $scope.$root;
            modals.allocated_ips = {
                ips: [],
                loading: true,
                random_ip: function random_ip() {
                    modals.allocated_ips.ips.forEach(function (item) {
                        item.checked = false;
                    });
                    form.ips = [];
                    form.pool_size = 0;
                },
                toggle_ip: function toggle_ip(item) {
                    var index = form.ips.indexOf(item.ip);
                    if (item.checked && index < 0) form.ips.push(item.ip);else if (!item.checked && index > -1) form.ips.splice(index, 1);
                    form.pool_size = form.ips.length;
                },
                zone: zone
            };
            $window.$('#allocated_ips').modal();
            $http.get('/api/allocated_ips?zone=' + zone + '&key=' + keypass).then(function (res) {
                form.ips = form.ips.filter(function (ip) {
                    return res.data.ips.includes(ip);
                });
                modals.allocated_ips.ips = res.data.ips.map(function (ip_port) {
                    var ip = ip_port.split(':')[0];
                    return { ip: ip, checked: form.ips.includes(ip) };
                });
                modals.allocated_ips.loading = false;
            });
        };
        $scope.binary_changed = function (proxy, field, value) {
            proxy[field] = { 'yes': true, 'no': false, 'default': '' }[value];
        };
        var update_allowed_countries = function update_allowed_countries() {
            var countries = $scope.consts.country.values;
            $scope.allowed_countries = [];
            if (!countries) return;
            if (form.zone != 'static') return $scope.allowed_countries = countries;
            $scope.allowed_countries = countries.filter(function (c) {
                return ['', 'au', 'br', 'de', 'gb', 'us'].includes(c.value);
            });
        };
        $scope.update_regions_and_cities = function (is_init) {
            if (!is_init) $scope.form.region = $scope.form.city = '';
            $scope.regions = [];
            $scope.cities = [];
            var country = ($scope.form.country || '').toUpperCase();
            if (!country || country == '*') return;
            if (regions[country]) $scope.regions = regions[country];else {
                regions[country] = [];
                $http.get('/api/regions/' + country).then(function (res) {
                    $scope.regions = regions[country] = res.data;
                });
            }
            if (cities[country]) $scope.cities = cities[country];else {
                cities[country] = [];
                $http.get('/api/cities/' + country).then(function (res) {
                    cities[country] = res.data.map(function (city) {
                        if (city.region) city.value = city.value + ' (' + city.region + ')';
                        return city;
                    });
                    $scope.cities = cities[country];
                    $scope.update_cities();
                });
            }
        };
        $scope.update_cities = function () {
            var country = $scope.form.country.toUpperCase();
            var state = $scope.form.state;
            if (state == '' || state == '*') {
                $scope.form.city = '';
                $scope.cities = cities[country];
            } else {
                $scope.cities = cities[country].filter(function (item) {
                    return !item.region || item.region == state;
                });
                var exist = $scope.cities.filter(function (item) {
                    return item.key == $scope.form.city;
                }).length > 0;
                if (!exist) $scope.form.city = '';
            }
        };
        $scope.update_region_by_city = function (city) {
            if (city.region) $scope.form.state = city.region;
            $scope.update_cities();
        };
        $scope.$watch('form.zone', function (val, old) {
            if (!$scope.consts || val == old) return;
            update_allowed_countries();
            var zone;
            if (zone = $scope.consts.zone.values.find(_lodash2.default.matches({ zone: val }))) form.password = zone.password;
        });
        $scope.save = function (model) {
            var proxy = _angular2.default.copy(model);
            delete proxy.preset;
            for (var field in proxy) {
                if (!$scope.is_valid_field(field) || proxy[field] === null) proxy[field] = '';
            }
            var make_int_range = function make_int_range(start, end) {
                var s = parseInt(start, 10) || 0;
                var e = parseInt(end, 10) || 0;
                return s && e ? [s, e].join(':') : s || e;
            };
            var effective = function effective(prop) {
                return proxy[prop] === undefined ? $scope.defaults[prop] : proxy[prop];
            };
            if (proxy.session_random) proxy.session = true;
            proxy.max_requests = make_int_range(proxy.max_requests_start, proxy.max_requests_end);
            delete proxy.max_requests_start;
            delete proxy.max_requests_end;
            proxy.session_duration = make_int_range(proxy.duration_start, proxy.duration_end);
            delete proxy.duration_start;
            delete proxy.duration_end;
            proxy.history = effective('history');
            proxy.ssl = effective('ssl');
            proxy.max_requests = effective('max_requests');
            proxy.session_duration = effective('session_duration');
            proxy.keep_alive = effective('keep_alive');
            proxy.pool_size = effective('pool_size');
            proxy.proxy_type = 'persist';
            proxy.reverse_lookup_dns = '';
            proxy.reverse_lookup_file = '';
            proxy.reverse_lookup_values = '';
            if ($scope.extra.reverse_lookup == 'dns') proxy.reverse_lookup_dns = true;
            if ($scope.extra.reverse_lookup == 'file') proxy.reverse_lookup_file = $scope.extra.reverse_lookup_file;
            if ($scope.extra.reverse_lookup == 'values') {
                proxy.reverse_lookup_values = $scope.extra.reverse_lookup_values.split('\n');
            }
            proxy.whitelist_ips = $scope.extra.whitelist_ips.split(',').filter(Boolean);
            var reload;
            if (Object.keys(proxy.rules || {}).length) {
                proxy.rules = {
                    pre: { browser: 'firefox' },
                    post: {
                        res: {
                            head: true,
                            status: Object.assign({ type: 'in' }, proxy.rules.post.res.status),
                            action: proxy.rules.post.res.action
                        },
                        url: proxy.rules.post.url
                    }
                };
                if (!proxy.rules.post.res.action || proxy.rules.post.res.action.value == 'retry') {
                    proxy.rules.post.res.action = { ban_ip: '60min',
                        retry: true };
                }
                if (proxy.rules.post.url) proxy.rules.pre.url = proxy.rules.post.url += '/**';else delete proxy.rules.post.url;
                proxy.rules.post.res = [proxy.rules.post.res];
                proxy.rules.pre = [proxy.rules.pre];
                proxy.rules.post = [proxy.rules.post];
                reload = true;
            } else delete proxy.rules;
            model.preset.set(proxy);
            var edit = $scope.port && !locals.duplicate;
            var save_inner = function save_inner() {
                $scope.status.type = 'warning';
                $scope.status.message = 'Saving the proxy...';
                var promise = edit ? $http.put('/api/proxies/' + $scope.port, { proxy: proxy }) : $http.post('/api/proxies/', { proxy: proxy });
                var is_ok_cb = function is_ok_cb() {
                    $window.$('#proxy').modal('hide');
                    $proxies.update();
                    $window.localStorage.setItem('quickstart-' + (edit ? 'edit' : 'create') + '-proxy', true);
                    return $http.post('/api/recheck').then(function (r) {
                        if (r.data.login_failure) $window.location = '/';
                    });
                };
                var is_not_ok_cb = function is_not_ok_cb(res) {
                    $scope.status.type = 'danger';
                    $scope.status.message = 'Error: ' + res.data.status;
                };
                promise.then(function () {
                    if (reload) {
                        $scope.status.type = 'warning';
                        $scope.status.message = 'Loading...';
                        return setTimeout(function () {
                            $window.location.reload();
                        }, 800);
                    }
                    $scope.status.type = 'warning';
                    $scope.status.message = 'Checking the proxy...';
                    return $http.get('/api/proxy_status/' + proxy.port);
                }).then(function (res) {
                    if (res.data.status == 'ok') return is_ok_cb(res);
                    return is_not_ok_cb(res);
                });
            };
            var url = '/api/proxy_check' + (edit ? '/' + $scope.port : '');
            $http.post(url, proxy).then(function (res) {
                $scope.form_errors = {};
                var warnings = [];
                _angular2.default.forEach(res.data, function (item) {
                    if (item.lvl == 'err') {
                        var msg = item.msg;
                        if (item.field == 'password' && msg == 'the provided password is not valid') {
                            msg = 'Wrong password';
                        }
                        $scope.form_errors[item.field] = msg;
                    }
                    if (item.lvl == 'warn') warnings.push(item.msg);
                });
                if (Object.keys($scope.form_errors).length) return;else if (warnings.length) {
                    $scope.$root.confirmation = {
                        text: 'Warning' + (warnings.length > 1 ? 's' : '') + ':',
                        items: warnings,
                        confirmed: save_inner
                    };
                    return $window.$('#confirmation').modal();
                }
                save_inner();
            });
        };
        $scope.is_valid_field = function (name) {
            return is_valid_field($scope.form, name, $scope.consts.zone);
        };
        $scope.starts_with = function (actual, expected) {
            return actual.toLowerCase().startsWith(expected.toLowerCase());
        };
        $scope.update_regions_and_cities(true);
        update_allowed_countries();
    };
}

_module.controller('columns', Columns);
Columns.$inject = ['$scope', '$window'];
function Columns($scope, $window) {
    $scope.init = function (locals) {
        $scope.columns = locals.columns;
        $scope.form = _lodash2.default.cloneDeep(locals.cols_conf);
        $scope.show_modal = function () {
            $window.$('#proxy-cols').modal();
        };
        $scope.save = function (config) {
            $window.$('#proxy-cols').modal('hide');
            $window.localStorage.setItem('columns', JSON.stringify(config));
            for (var c in config) {
                locals.cols_conf[c] = config[c];
            }
        };
        $scope.all = function () {
            for (var c in $scope.columns) {
                $scope.form[$scope.columns[c].key] = true;
            }
        };
        $scope.none = function () {
            for (var c in $scope.columns) {
                $scope.form[$scope.columns[c].key] = false;
            }
        };
        $scope.default = function () {
            for (var c in $scope.columns) {
                $scope.form[$scope.columns[c].key] = locals.default_cols[$scope.columns[c].key];
            }
        };
    };
}

_module.filter('timestamp', timestamp_filter);
function timestamp_filter() {
    return function (timestamp) {
        return (0, _moment2.default)(timestamp).format('YYYY/MM/DD HH:mm');
    };
}

_module.filter('requests', requests_filter);
requests_filter.$inject = ['$filter'];
function requests_filter($filter) {
    var number_filter = $filter('number');
    return function (requests, precision) {
        if (!requests || isNaN(parseFloat(requests)) || !isFinite(requests)) {
            return '';
        }
        if (typeof precision === 'undefined') precision = 0;
        return number_filter(requests, precision);
    };
}

_module.filter('bytes', function () {
    return _util2.default.bytes_format;
});

_module.filter('request', request_filter);
function request_filter() {
    return function (r) {
        return '/tools?test=' + encodeURIComponent(JSON.stringify({
            port: r.port,
            url: r.url,
            method: r.method,
            body: r.request_body,
            headers: r.request_headers
        }));
    };
}

_module.directive('initInputSelect', ['$window', function ($window) {
    return {
        restrict: 'A',
        link: function link(scope, element, attrs) {
            setTimeout(function () {
                element.select().focus();
            }, 100); // before changing check for input type=number in Firefox
        }
    };
}]);

_module.directive('initSelectOpen', ['$window', function ($window) {
    return {
        restrict: 'A',
        link: function link(scope, element, attrs) {
            setTimeout(function () {
                element.focus();
            }, 100);
        }
    };
}]);

_module.directive('reactView', ['$state', function ($state) {
    return {
        scope: { view: '=reactView', props: '@stateProps' },
        link: function link(scope, element, attrs) {
            _reactDom2.default.render(_react2.default.createElement(scope.view, _lodash2.default.pick($state.params, (scope.props || '').split(' '))), element[0]);
            element.on('$destroy', function () {
                _reactDom2.default.unmountComponentAtNode(element[0]);
            });
        }
    };
}]);

_module.filter('shorten', shorten_filter);
shorten_filter.$inject = ['$filter'];
function shorten_filter($filter) {
    return function (s, chars) {
        if (s.length <= chars + 2) return s;
        return s.substr(0, chars) + '...';
    };
}

_angular2.default.bootstrap(document, ['app']);

/***/ }),

/***/ 320:
/***/ (function(module, exports, __webpack_require__) {

"use strict";
// LICENSE_CODE ZON ISC
 /*jslint react:true*/

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _regeneratorRuntime = __webpack_require__(31);

var _regeneratorRuntime2 = _interopRequireDefault(_regeneratorRuntime);

var _lodash = __webpack_require__(41);

var _lodash2 = _interopRequireDefault(_lodash);

var _react = __webpack_require__(0);

var _react2 = _interopRequireDefault(_react);

var _reactBootstrap = __webpack_require__(33);

var _util = __webpack_require__(53);

var _util2 = _interopRequireDefault(_util);

var _etask = __webpack_require__(40);

var _etask2 = _interopRequireDefault(_etask);

var _date = __webpack_require__(183);

var _date2 = _interopRequireDefault(_date);

var _common = __webpack_require__(54);

var _common2 = _interopRequireDefault(_common);

var _status_codes = __webpack_require__(87);

var _domains = __webpack_require__(109);

var _protocols = __webpack_require__(110);

var _common3 = __webpack_require__(269);

__webpack_require__(270);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var E = {
    install: function install() {
        return E.sp = (0, _etask2.default)('stats', [function () {
            return this.wait();
        }]);
    },
    uninstall: function uninstall() {
        if (E.sp) E.sp.return();
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

            _lodash2.default.each(props.stat, function (v, k) {
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
}(_react2.default.Component);

var SRow = function (_StatRow) {
    _inherits(SRow, _StatRow);

    function SRow() {
        _classCallCheck(this, SRow);

        return _possibleConstructorReturn(this, (SRow.__proto__ || Object.getPrototypeOf(SRow)).apply(this, arguments));
    }

    _createClass(SRow, [{
        key: 'render',
        value: function render() {
            return _react2.default.createElement(_status_codes.StatusCodeRow, _extends({ class_value: this.state.class_value,
                class_bw: this.state.class_bw }, this.props));
        }
    }]);

    return SRow;
}(StatRow);

var DRow = function (_StatRow2) {
    _inherits(DRow, _StatRow2);

    function DRow() {
        _classCallCheck(this, DRow);

        return _possibleConstructorReturn(this, (DRow.__proto__ || Object.getPrototypeOf(DRow)).apply(this, arguments));
    }

    _createClass(DRow, [{
        key: 'render',
        value: function render() {
            return _react2.default.createElement(_domains.DomainRow, _extends({ class_value: this.state.class_value,
                class_bw: this.state.class_bw }, this.props));
        }
    }]);

    return DRow;
}(StatRow);

var PRow = function (_StatRow3) {
    _inherits(PRow, _StatRow3);

    function PRow() {
        _classCallCheck(this, PRow);

        return _possibleConstructorReturn(this, (PRow.__proto__ || Object.getPrototypeOf(PRow)).apply(this, arguments));
    }

    _createClass(PRow, [{
        key: 'render',
        value: function render() {
            return _react2.default.createElement(_protocols.ProtocolRow, _extends({ class_value: this.state.class_value,
                class_bw: this.state.class_bw }, this.props));
        }
    }]);

    return PRow;
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
            E.sp.spawn(_this7.sp = (0, _etask2.default)(_regeneratorRuntime2.default.mark(function _callee() {
                return _regeneratorRuntime2.default.wrap(function _callee$(_context) {
                    while (1) {
                        switch (_context.prev = _context.next) {
                            case 0:
                                _context.next = 2;
                                return _etask2.default.sleep(2 * _date2.default.ms.SEC);

                            case 2:
                                _util2.default.ga_event('stats panel', 'hover', dt);

                            case 3:
                            case 'end':
                                return _context.stop();
                        }
                    }
                }, _callee, this);
            })));
        }, _this7.leave = function () {
            if (_this7.sp) _this7.sp.return();
        }, _temp), _possibleConstructorReturn(_this7, _ret);
    }

    _createClass(StatTable, [{
        key: 'render',
        value: function render() {
            var Table = this.props.table || _common2.default.StatTable;
            return _react2.default.createElement(
                'div',
                { onMouseEnter: this.enter, onMouseLeave: this.leave },
                _react2.default.createElement(Table, this.props)
            );
        }
    }]);

    return StatTable;
}(_react2.default.Component);

var Stats = function (_React$Component3) {
    _inherits(Stats, _React$Component3);

    function Stats(props) {
        _classCallCheck(this, Stats);

        var _this8 = _possibleConstructorReturn(this, (Stats.__proto__ || Object.getPrototypeOf(Stats)).call(this, props));

        _this8.get_stats = _etask2.default._fn(_regeneratorRuntime2.default.mark(function _callee2(_this) {
            return _regeneratorRuntime2.default.wrap(function _callee2$(_context2) {
                while (1) {
                    switch (_context2.prev = _context2.next) {
                        case 0:
                            this.catch(function (e) {
                                return console.log(e);
                            });

                        case 1:
                            if (false) {
                                _context2.next = 11;
                                break;
                            }

                            _context2.t0 = _this;
                            _context2.next = 5;
                            return _common2.default.StatsService.get_top({ sort: 'value',
                                limit: 5 });

                        case 5:
                            _context2.t1 = _context2.sent;

                            _context2.t0.setState.call(_context2.t0, _context2.t1);

                            _context2.next = 9;
                            return _etask2.default.sleep(_date2.default.ms.SEC);

                        case 9:
                            _context2.next = 1;
                            break;

                        case 11:
                        case 'end':
                            return _context2.stop();
                    }
                }
            }, _callee2, this);
        }));

        _this8.close = function () {
            return _this8.setState({ show_reset: false });
        };

        _this8.confirm = function () {
            return _this8.setState({ show_reset: true });
        };

        _this8.reset_stats = function () {
            if (_this8.state.resetting) return;
            _this8.setState({ resetting: true });
            var _this = _this8;
            E.sp.spawn((0, _etask2.default)(_regeneratorRuntime2.default.mark(function _callee3() {
                return _regeneratorRuntime2.default.wrap(function _callee3$(_context3) {
                    while (1) {
                        switch (_context3.prev = _context3.next) {
                            case 0:
                                _context3.next = 2;
                                return _common2.default.StatsService.reset();

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
            _util2.default.ga_event('stats panel', 'click', 'reset btn');
        };

        _this8.enable_https_statistics = function () {
            _this8.setState({ show_certificate: true });
            _util2.default.ga_event('stats panel', 'click', 'enable https stats');
        };

        _this8.close_certificate = function () {
            _this8.setState({ show_certificate: false });
        };

        _this8.state = {
            statuses: { stats: [] },
            domains: { stats: [] },
            protocols: { stats: [] }
        };
        return _this8;
    }

    _createClass(Stats, [{
        key: 'componentDidMount',
        value: function componentDidMount() {
            E.install();
            E.sp.spawn(this.get_stats());
        }
    }, {
        key: 'componentWillUnmount',
        value: function componentWillUnmount() {
            E.uninstall();
        }
    }, {
        key: 'render',
        value: function render() {
            return _react2.default.createElement(
                _reactBootstrap.Panel,
                { header: _react2.default.createElement(
                        _reactBootstrap.Row,
                        null,
                        _react2.default.createElement(
                            _reactBootstrap.Col,
                            { md: 6 },
                            'Recent statistics'
                        ),
                        _react2.default.createElement(
                            _reactBootstrap.Col,
                            { md: 6, className: 'text-right' },
                            _react2.default.createElement(
                                _reactBootstrap.Button,
                                { bsSize: 'xsmall', onClick: this.confirm },
                                'Reset'
                            )
                        )
                    ) },
                _react2.default.createElement(StatTable, { table: _status_codes.StatusCodeTable, row: SRow,
                    title: 'Top ' + (_lodash2.default.min([5, this.state.statuses.stats.length]) || '') + '\n                  status codes', dataType: 'status_codes',
                    stats: this.state.statuses.stats,
                    show_more: this.state.statuses.has_more }),
                _react2.default.createElement(StatTable, { table: _domains.DomainTable, row: DRow,
                    dataType: 'domains', stats: this.state.domains.stats,
                    show_more: this.state.domains.has_more,
                    title: 'Top ' + (_lodash2.default.min([5, this.state.domains.stats.length]) || '') + '\n                  domains' }),
                _react2.default.createElement(StatTable, { table: _protocols.ProtocolTable, row: PRow,
                    dataType: 'protocols', stats: this.state.protocols.stats,
                    show_more: this.state.protocols.has_more,
                    show_enable_https_button: true,
                    enable_https_button_click: this.enable_https_statistics }),
                _react2.default.createElement(
                    _common3.Dialog,
                    { show: this.state.show_reset, onHide: this.close,
                        title: 'Reset stats', footer: _react2.default.createElement(
                            _reactBootstrap.ButtonToolbar,
                            null,
                            _react2.default.createElement(
                                _reactBootstrap.Button,
                                { bsStyle: 'primary', onClick: this.reset_stats,
                                    disabled: this.state.resetting },
                                this.state.resetting ? 'Resetting...' : 'OK'
                            ),
                            _react2.default.createElement(
                                _reactBootstrap.Button,
                                { onClick: this.close },
                                'Cancel'
                            )
                        ) },
                    _react2.default.createElement(
                        'h4',
                        null,
                        'Are you sure you want to reset stats?'
                    )
                ),
                _react2.default.createElement(
                    _common3.Dialog,
                    { show: this.state.show_certificate,
                        onHide: this.close_certificate,
                        title: 'Add certificate file to browsers',
                        footer: _react2.default.createElement(
                            _reactBootstrap.Button,
                            { onClick: this.close_certificate },
                            'Close'
                        ) },
                    'Gathering stats for HTTPS requests requires setting a certificate key.',
                    _react2.default.createElement(
                        'ol',
                        null,
                        _react2.default.createElement(
                            'li',
                            null,
                            'Download our free certificate key',
                            _react2.default.createElement(
                                'a',
                                { href: '/ssl', target: '_blank', download: true },
                                ' here'
                            )
                        ),
                        _react2.default.createElement(
                            'li',
                            null,
                            'Add the certificate to your browser'
                        ),
                        _react2.default.createElement(
                            'li',
                            null,
                            'Refresh the page'
                        )
                    )
                )
            );
        }
    }]);

    return Stats;
}(_react2.default.Component);

exports.default = Stats;

/***/ }),

/***/ 40:
/***/ (function(module, exports, __webpack_require__) {

var __WEBPACK_AMD_DEFINE_ARRAY__, __WEBPACK_AMD_DEFINE_RESULT__;
var module;
// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, browser:true*/
(function(){
var  process, zerr, assert;
var is_node = typeof module=='object' && module.exports && module.children;
var is_ff_addon = typeof module=='object' && module.uri
    && !module.uri.indexOf('resource://');
if (!is_node)
{
    if (is_ff_addon)
        ;
    else
        ;
    process = {
        nextTick: function(fn){ setTimeout(fn, 0); },
        env: {},
    };
    assert = function(){}; // XXX romank: add proper assert
    // XXX romank: use zerr.js
    // XXX bahaa: require bext/pub/zerr.js for extensions
    if (!is_ff_addon && self.hola && self.hola.zerr)
        zerr = self.hola.zerr;
    else
    {
        zerr = function(){ console.log.apply(console, arguments); };
        zerr.perr = zerr;
        zerr.debug = function(){};
        zerr.is = function(){ return false; };
        zerr.L = {DEBUG: 0};
    }
    if (!zerr.is)
        zerr.is = function(){ return false; };
}
else
{
    require('./config.js');
    process = global.process||require('_process');
    zerr = require('./zerr.js');
    assert = require('assert');
    ;
}
// XXX yuval: /util/events.js -> events when node 6 (support prependListener)
// is here
!(__WEBPACK_AMD_DEFINE_ARRAY__ = [__webpack_require__(559), __webpack_require__(262), __webpack_require__(560)], __WEBPACK_AMD_DEFINE_RESULT__ = function(events, array, zutil){
var E = Etask;
var etask = Etask;
var env = process.env, assign = Object.assign;
E.use_bt = +env.ETASK_BT;
E.root = [];
E.assert_extra = +env.ETASK_ASSERT_EXTRA; // to debug internal etask bugs
E.nextTick = process.nextTick;
// XXX arik/romank: hack, rm set_zerr, get zerzerrusing require
E.set_zerr = function(_zerr){ zerr = _zerr; };
E.events = new events();
var cb_pre, cb_post, longcb_ms, perf_enable;
E.perf_stat = {};
function _cb_pre(et){ return {start: Date.now()}; }
function _cb_post(et, ctx){
    var ms = Date.now()-ctx.start;
    if (longcb_ms && ms>longcb_ms)
    {
        zerr('long cb '+ms+'ms: '+et.get_name()+', '
            +et.run_state.f.toString().slice(0, 128));
    }
    if (perf_enable)
    {
        var name = et.get_name();
        var perf = E.perf_stat[name]||(E.perf_stat[name] = {ms: 0, n: 0});
        perf.ms += ms;
        perf.n++;
    }
}
function cb_set(){
    if (longcb_ms || perf_enable)
    {
        cb_pre = _cb_pre;
        cb_post = _cb_post;
    }
    else
        cb_pre = cb_post = undefined;
}
E.longcb = function(ms){
    longcb_ms = ms;
    cb_set();
};
E.perf = function(enable){
    perf_enable = enable;
    cb_set();
};
E.longcb(+env.LONGCB);
E.perf(+env.ETASK_PERF);

function stack_get(){
    // new Error(): 200K per second
    // http://jsperf.com/error-generation
    // Function.caller (same as arguments.callee.caller): 2M per second
    // http://jsperf.com/does-function-caller-affect-preformance
    // http://jsperf.com/the-arguments-object-s-effect-on-speed/2
    var prev = Error.stackTraceLimit, err;
    Error.stackTraceLimit = 4;
    err = new Error();
    Error.stackTraceLimit = prev;
    return err;
}

function Etask(opt, states){
    if (!(this instanceof Etask))
        return new Etask(opt, states);
    if (Array.isArray(opt) || typeof opt=='function')
    {
        states = opt;
        opt = undefined;
    }
    opt = (typeof opt=='string' && {name: opt})||opt||{};
    if (typeof states=='function')
    {
        if (states.constructor.name=='GeneratorFunction')
            return E._generator(null, states, opt);
        states = [states];
    }
    // performance: set all fields to undefined
    this.cur_state = this.states = this._finally = this.error =
    this.at_return = this.next_state = this.use_retval = this.running =
    this.at_continue = this.cancel = this.wait_timer = this.retval =
    this.run_state = this._stack = this.down = this.up = this.child =
    this.name = this._name = this.parent = this.cancelable =
    this.tm_create = this._alarm = this.tm_completed = this.parent_type =
    this.info = this.then_waiting = this.free = this.parent_guess =
    this.child_guess = this.wait_retval = undefined;
    // init fields
    this.name = opt.name;
    this._name = this.name===undefined ? 'noname' : this.name;
    this.cancelable = opt.cancel;
    this.then_waiting = [];
    this.child = [];
    this.child_guess = [];
    this.cur_state = -1;
    this.states = [];
    this._stack = Etask.use_bt ? stack_get() : undefined;
    this.tm_create = Date.now();
    this.info = {};
    var idx = this.states.idx = {};
    for (var i=0; i<states.length; i++)
    {
        var pstate = states[i], t;
        if (typeof pstate!='function')
            assert(0, 'invalid state type');
        t = this._get_func_type(pstate);
        var state = {f: pstate, label: t.label, try_catch: t.try_catch,
            catch: t.catch, finally: t.finally, cancel: t.cancel,
            sig: undefined};
        if (i==0 && opt.state0_args)
        {
            state.f = state.f.bind.apply(state.f,
                [this].concat(opt.state0_args));
        }
        if (state.label)
            idx[state.label] = i;
        assert((state.catch||state.try_catch?1:0)
            +(state.finally?1:0)+(state.cancel?1:0)<=1,
            'invalid multiple state types');
        state.sig = state.finally||state.cancel;
        if (state.finally)
        {
            assert(this._finally===undefined, 'more than 1 finally$');
            this._finally = i;
        }
        if (state.cancel)
        {
            assert(this.cancel===undefined, 'more than 1 cancel$');
            this.cancel = i;
        }
        this.states[i] = state;
    }
    var _this = this;
    E.root.push(this);
    var in_run = E.in_run_top();
    if (opt.spawn_parent)
        this.spawn_parent(opt.spawn_parent);
    else if (opt.up)
        opt.up._set_down(this);
    else if (in_run)
        this._spawn_parent_guess(in_run);
    if (opt.init)
        opt.init.call(this);
    if (opt.async)
    {
        var wait_retval = this._set_wait_retval();
        E.nextTick(function(){
            if (_this.running!==undefined)
                return;
            _this._got_retval(wait_retval);
        });
    }
    else
        this._next_run();
    return this;
}
zutil.inherits(Etask, events.EventEmitter);

E.prototype._root_remove = function(){
    assert(!this.parent, 'cannot remove from root when has parent');
    if (!array.rm_elm_tail(E.root, this))
        assert(0, 'etask not in root\n'+E.ps({MARK: this}));
};

E.prototype._parent_remove = function(){
    if (this.up)
    {
        var up = this.up;
        this.up = this.up.down = undefined;
        if (up.tm_completed)
            up._check_free();
        return;
    }
    if (this.parent_guess)
        this._parent_guess_remove();
    if (!this.parent)
        return this._root_remove();
    if (!array.rm_elm_tail(this.parent.child, this))
    {
        assert(0, 'etask child not in parent\n'
            +E.ps({MARK: [['child', this], ['parent', this.parent]]}));
    }
    if (this.parent.tm_completed)
        this.parent._check_free();
    this.parent = undefined;
};

E.prototype._check_free = function(){
    if (this.down || this.child.length)
        return;
    this._parent_remove();
    this.free = true;
};

E.prototype._call_err = function(e){
    E.ef(e);
    // XXX derry: add assert(0, 'etask err in signal: '+e);
};
E.prototype.emit_safe = function(){
    try { this.emit.apply(this, arguments); }
    catch(e){ this._call_err(e); }
};
E.prototype._call_safe = function(state_fn){
    try { return state_fn.call(this); }
    catch(e){ this._call_err(e); }
};
E.prototype._complete = function(){
    if (zerr.is(zerr.L.DEBUG))
        zerr.debug(this._name+': close');
    this.tm_completed = Date.now();
    this.parent_type = this.up ? 'call' : 'spawn';
    if (this.error)
        this.emit_safe('uncaught', this.error);
    if (this._finally!==undefined)
    {
        var ret = this._call_safe(this.states[this._finally].f);
        if (E.is_err(ret))
            this._set_retval(ret);
    }
    this.emit_safe('finally');
    this.emit_safe('ensure');
    if (this.error && !this.up && !this.parent && !this.parent_guess)
        E.events.emit('uncaught', this);
    if (this.parent)
        this.parent.emit('child', this);
    if (this.up && (this.down || this.child.length))
    {
        var up = this.up;
        this.up = this.up.down = undefined;
        this.parent = up;
        up.child.push(this);
    }
    this._check_free();
    this._del_wait_timer();
    this.del_alarm();
    this._ecancel_child();
    this.emit_safe('finally1');
    while (this.then_waiting.length)
        this.then_waiting.pop()();
};
E.prototype._next = function(rv){
    if (this.tm_completed)
        return true;
    rv = rv||{ret: undefined, err: undefined};
    var states = this.states;
    var state = this.at_return ? states.length :
        this.next_state!==undefined ? this.next_state :
        this.cur_state+1;
    this.retval = rv.ret;
    this.error = rv.err;
    if (rv.err!==undefined)
    {
        if (zerr.on_exception)
            zerr.on_exception(rv.err);
        if (this.run_state.try_catch)
        {
            this.use_retval = true;
            for (; state<states.length && states[state].sig; state++);
        }
        else
            for (; state<states.length && !states[state].catch; state++);
    }
    else
    {
        for (; state<states.length &&
            (states[state].sig || states[state].catch); state++);
    }
    this.cur_state = state;
    this.run_state = states[state];
    this.next_state = undefined;
    if (this.cur_state<states.length)
        return false;
    this._complete();
    return true;
};

E.prototype._next_run = function(rv){
    if (this._next(rv))
        return;
    this._run();
};
E.prototype._handle_rv = function(rv){
    var wait_retval, _this = this, ret = rv.ret;
    if (ret===this.retval); // fast-path: retval already set
    else if (!ret);
    else if (ret instanceof Etask)
    {
        if (!ret.tm_completed)
        {
            this._set_down(ret);
            wait_retval = this._set_wait_retval();
            ret.then_waiting.push(function(){
                _this._got_retval(wait_retval, E.err_res(ret.error,
                    ret.retval));
            });
            return true;
        }
        rv.err = ret.error;
        rv.ret = ret.retval;
    }
    else if (ret instanceof Etask_err)
    {
        rv.err = ret.error;
        rv.ret = undefined;
    }
    else if (typeof ret.then=='function') // promise
    {
        wait_retval = this._set_wait_retval();
        ret.then(function(ret){ _this._got_retval(wait_retval, ret); },
            function(err){ _this._got_retval(wait_retval, E.err(err)); });
        return true;
    }
    // generator
    else if (typeof ret.next=='function' && typeof ret.throw=='function')
    {
        rv.ret = E._generator(ret, this.states[this.cur_state]);
        return this._handle_rv(rv);
    }
    return false;
};
E.prototype._set_retval = function(ret){
    if (ret===this.retval && !this.error); // fast-path retval already set
    else if (!ret)
    {
        this.retval = ret;
        this.error = undefined;
    }
    else if (ret instanceof Etask)
    {
        if (ret.tm_completed)
        {
            this.retval = ret.retval;
            this.error = ret.error;
        }
    }
    else if (ret instanceof Etask_err)
    {
        this.retval = undefined;
        this.error = ret.error;
    }
    else if (typeof ret.then=='function'); // promise
    // generator
    else if (typeof ret.next=='function' && typeof ret.throw=='function');
    else
    {
        this.retval = ret;
        this.error = undefined;
    }
    return ret;
};

E.prototype._set_wait_retval = function(){
    return this.wait_retval = new Etask_wait(this, 'wait_int'); };
E.in_run = [];
E.in_run_top = function(){ return E.in_run[E.in_run.length-1]; };
E.prototype._run = function(){
    var rv = {ret: undefined, err: undefined};
    while (1)
    {
        var cb_ctx;
        var arg = this.error && !this.use_retval ? this.error : this.retval;
        this.use_retval = false;
        this.running = true;
        rv.ret = rv.err = undefined;
        E.in_run.push(this);
        if (zerr.is(zerr.L.DEBUG))
            zerr.debug(this._name+':S'+this.cur_state+': running');
        if (cb_pre)
            cb_ctx = cb_pre(this);
        try { rv.ret = this.run_state.f.call(this, arg); }
        catch(e){
            rv.err = e;
            if (rv.err instanceof Error)
                rv.err.etask = this;
        }
        if (cb_post)
            cb_post(this, cb_ctx);
        this.running = false;
        E.in_run.pop();
        for (; this.child_guess.length;
            this.child_guess.pop().parent_guess = undefined);
        if (rv.ret instanceof Etask_wait)
        {
            var wait_completed = false, wait = rv.ret;
            if (!this.at_continue && !wait.ready)
            {
                this.wait_retval = wait;
                if (wait.op=='wait_child')
                     wait_completed = this._set_wait_child(wait);
                if (wait.timeout)
                    this._set_wait_timer(wait.timeout);
                if (!wait_completed)
                    return;
                this.wait_retval = undefined;
            }
            rv.ret = this.at_continue ? this.at_continue.ret :
                wait.ready && !wait.completed ? wait.ready.ret : undefined;
            wait.completed = true;
        }
        this.at_continue = undefined;
        if (this._handle_rv(rv))
            return;
        if (this._next(rv))
            return;
    }
};

E.prototype._set_down = function(down){
    if (this.down)
        assert(0, 'caller already has a down\n'+this.ps());
    if (down.parent_guess)
        down._parent_guess_remove();
    assert(!down.parent, 'returned etask already has a spawn parent');
    assert(!down.up, 'returned etask already has a caller parent');
    down._parent_remove();
    this.down = down;
    down.up = this;
};

var func_type_cache = {};
E.prototype._get_func_type = function(func, on_fail){
    var name = func.name;
    var type = func_type_cache[name];
    if (type)
        return type;
    type = func_type_cache[name] = {name: undefined, label: undefined,
        try_catch: undefined, catch: undefined, finally: undefined,
        cancel: undefined};
    if (!name)
        return type;
    type.name = name;
    var n = name.split('$');
    if (n.length==1)
    {
        type.label = n[0];
        return type;
    }
    if (n.length>2)
        return type;
    if (n[1].length)
        type.label = n[1];
    var f = n[0].split('_');
    for (var j=0; j<f.length; j++)
    {
        if (f[j]=='try')
        {
            type.try_catch = true;
            if (f[j+1]=='catch')
                j++;
        }
        else if (f[j]=='catch')
            type['catch'] = true;
        else if (f[j]=='finally' || f[j]=='ensure')
            type.finally = true;
        else if (f[j]=='cancel')
            type.cancel = true;
        else
        {
            return void (on_fail||assert.bind(null, false))(
                'unknown func name '+name);
        }
    }
    return type;
};

E.prototype.spawn = function(child, replace){
    if (!(child instanceof Etask) && child && typeof child.then=='function')
    {
        var promise = child;
        child = etask([function(){ return promise; }]);
    }
    if (!(child instanceof Etask)) // promise already completed?
    {
        this.emit('child', child);
        return;
    }
    if (!replace && child.parent)
        assert(0, 'child already has a parent\n'+child.parent.ps());
    child.spawn_parent(this);
};

E.prototype._spawn_parent_guess = function(parent){
    this.parent_guess = parent;
    parent.child_guess.push(this);
};
E.prototype._parent_guess_remove = function(){
    if (!array.rm_elm_tail(this.parent_guess.child_guess, this))
        assert(0, 'etask not in parent_guess\n'+E.ps({MARK: this}));
    this.parent_guess = undefined;
};
E.prototype.spawn_parent = function(parent){
    if (this.up)
        assert(0, 'child already has an up\n'+this.up.ps());
    if (this.tm_completed && !this.parent)
        return;
    this._parent_remove();
    if (parent && parent.free)
        parent = undefined;
    if (!parent)
        return void E.root.push(this);
    parent.child.push(this);
    this.parent = parent;
};

E.prototype.set_state = function(name){
    var state = this.states.idx[name];
    assert(state!==undefined, 'named func "'+name+'" not found');
    return this.next_state = state;
};

E.prototype.finally = function(cb){
    this.prependListener('finally', cb);
};
E.prototype.goto_fn = function(name){
    return this.goto.bind(this, name); };
E.prototype.goto = function(name, promise){
    this.set_state(name);
    var state = this.states[this.next_state];
    assert(!state.sig, 'goto to sig');
    return this.continue(promise);
};

E.prototype.loop = function(promise){
    this.next_state = this.cur_state;
    return promise;
};

E.prototype._set_wait_timer = function(timeout){
    var _this = this;
    this.wait_timer = setTimeout(function(){
        _this.wait_timer = undefined;
        _this._next_run({ret: undefined, err: 'timeout'});
    }, timeout);
};
E.prototype._del_wait_timer = function(){
    if (this.wait_timer)
        this.wait_timer = clearTimeout(this.wait_timer);
    this.wait_retval = undefined;
};
E.prototype._get_child_running = function(from){
    var i, child = this.child;
    for (i=from||0; i<child.length && child[i].tm_completed; i++);
    return i>=child.length ? -1 : i;
};
E.prototype._set_wait_child = function(wait_retval){
    var i, _this = this, child = wait_retval.child;
    var cond = wait_retval.cond, wait_on;
    assert(!cond || child=='any', 'condition supported only for "any" '+
        'option, you can add support if needed');
    if (child=='any')
    {
        if (this._get_child_running()<0)
            return true;
        wait_on = function(){
            _this.once('child', function(child){
                if (!cond || cond.call(child, child.retval))
                    return _this._got_retval(wait_retval, {child: child});
                if (_this._get_child_running()<0)
                    return _this._got_retval(wait_retval);
                wait_on();
            });
        };
        wait_on();
    }
    else if (child=='all')
    {
        if ((i = this._get_child_running())<0)
            return true;
        wait_on = function(child){
            _this.once('child', function(child){
                var i;
                if ((i = _this._get_child_running())<0)
                    return _this._got_retval(wait_retval);
                wait_on(_this.child[i]);
            });
        };
        wait_on(this.child[i]);
    }
    else
    {
        assert(child, 'no child provided');
        assert(this===child.parent, 'child does not belong to parent');
        if (child.tm_completed)
            return true;
        child.once('finally', function(){
            return _this._got_retval(wait_retval, {child: child}); });
    }
    this.emit_safe('wait_on_child');
};

E.prototype._got_retval = function(wait_retval, res){
    if (this.wait_retval!==wait_retval || wait_retval.completed)
        return;
    wait_retval.completed = true;
    this._next_run(E._res2rv(res));
};
E.prototype.continue_fn = function(){
    return this.continue.bind(this); };
E.continue_depth = 0;
E.prototype.continue = function(promise, sync){
    this.wait_retval = undefined;
    this._set_retval(promise);
    if (this.tm_completed)
        return promise;
    if (this.down)
        this.down._ecancel();
    this._del_wait_timer();
    var rv = {ret: promise, err: undefined};
    if (this.running)
    {
        this.at_continue = rv;
        return promise;
    }
    if (this._handle_rv(rv))
        return rv.ret;
    var _this = this;
    if (E.is_final(promise) &&
        (!E.continue_depth && !E.in_run.length || sync))
    {
        E.continue_depth++;
        this._next_run(rv);
        E.continue_depth--;
    }
    else // avoid high stack depth
        E.nextTick(function(){ _this._next_run(rv); });
    return promise;
};

E.prototype._ecancel = function(){
    if (this.tm_completed)
        return this;
    this.emit_safe('cancel');
    if (this.cancel!==undefined)
        return this._call_safe(this.states[this.cancel].f);
    if (this.cancelable)
        return this.return();
};

E.prototype._ecancel_child = function(){
    if (!this.child.length)
        return;
    // copy array, since ecancel has side affects and can modify array
    var child = Array.from(this.child);
    for (var i=0; i<child.length; i++)
        child[i]._ecancel();
};

E.prototype.return_fn = function(){
    return this.return.bind(this); };
E.prototype.return = function(promise){
    if (this.tm_completed)
        return this._set_retval(promise);
    this.at_return = true;
    this.next_state = undefined;
    return this.continue(promise, true);
};

E.prototype.del_alarm = function(){
    var a = this._alarm;
    if (!a)
        return;
    clearTimeout(a.id);
    if (a.cb)
        this.removeListener('sig_alarm', a.cb);
    this._alarm = undefined;
};

E.prototype.alarm_left = function(){
    var a = this._alarm;
    if (!a)
        return 0;
    return a.start-Date.now();
};

E.prototype._operation_opt = function(opt){
    if (opt.goto)
        return {ret: this.goto(opt.goto, opt.ret)};
    if (opt.throw)
        return {ret: this.throw(opt.throw)};
    if (opt.return!==undefined)
        return {ret: this.return(opt.return)};
    if (opt.continue!==undefined)
        return {ret: this.continue(opt.continue)};
};

E.prototype.alarm = function(ms, cb){
    var _this = this, opt, a;
    if (cb && typeof cb!='function')
    {
        opt = cb;
        cb = function(){
            var v;
            if (!(v = _this._operation_opt(opt)))
                assert(0, 'invalid alarm cb opt');
            return v.ret;
        };
    }
    this.del_alarm();
    a = this._alarm = {ms: ms, cb: cb, start: Date.now()};
    a.id = setTimeout(function(){
        _this._alarm = undefined;
        _this.emit('sig_alarm');
    }, a.ms);
    if (cb)
        this.once('sig_alarm', cb);
};

function Etask_wait(et, op, timeout){
    this.timeout = timeout;
    this.et = et;
    this.op = op;
    this.child = this.at_child = this.cond = undefined;
    this.ready = this.completed = undefined;
}
Etask_wait.prototype.continue = function(res){
    if (this.completed)
        return;
    if (!this.et.wait_retval)
        return void(this.ready = {ret: res});
    if (this!==this.et.wait_retval)
        return;
    this.et.continue(res);
};
Etask_wait.prototype.continue_fn = function(){
    return this.continue.bind(this); };
Etask_wait.prototype.throw = function(err){
    return this.continue(E.err(err)); };
Etask_wait.prototype.throw_fn = function(){
    return this.throw.bind(this); };
E.prototype.wait = function(timeout){
    return new Etask_wait(this, 'wait', timeout); };
E.prototype.wait_child = function(child, timeout, cond){
    if (typeof timeout=='function')
    {
        cond = timeout;
        timeout = 0;
    }
    var wait = new Etask_wait(this, 'wait_child', timeout);
    wait.child = child;
    wait.at_child = null;
    wait.cond = cond;
    return wait;
};

E.prototype.throw_fn = function(err){
    return err ? this.throw.bind(this, err) : this.throw.bind(this); };
E.prototype.throw = function(err){
    return this.continue(E.err(err)); };

E.prototype.get_name = function(flags){
    /* anon: Context.<anonymous> (/home/yoni/zon1/pkg/util/test.js:1740:7)
     * with name: Etask.etask1_1 (/home/yoni/zon1/pkg/util/test.js:1741:11) */
    var stack = this._stack instanceof Error ? this._stack.stack.split('\n') :
        undefined;
    var caller;
    flags = flags||{};
    if (stack)
    {
        caller = /^    at (.*)$/.exec(stack[4]);
        caller = caller ? caller[1] : undefined;
    }
    var names = [];
    if (this.name)
        names.push(this.name);
    if (caller && !(this.name && flags.SHORT_NAME))
        names.push(caller);
    if (!names.length)
        names.push('noname');
    return names.join(' ');
};

E.prototype.state_str = function(){
    return this.cur_state+(this.next_state ? '->'+this.next_state : ''); };

E.prototype.get_depth = function(){
    var i=0, et = this;
    for (; et; et = et.up, i++);
    return i;
};

function trim_space(s){
    if (s[s.length-1]!=' ')
        return s;
    return s.slice(0, -1);
}
function ms_to_str(ms){ // from date.js
    var s = ''+ms;
    return s.length<=3 ? s+'ms' : s.slice(0, -3)+'.'+s.slice(-3)+'s';
}
E.prototype.get_time_passed = function(){
    return ms_to_str(Date.now()-this.tm_create); };
E.prototype.get_time_completed = function(){
    return ms_to_str(Date.now()-this.tm_completed); };
E.prototype.get_info = function(){
    var info = this.info, s = '', _i;
    if (!info)
        return '';
    for (var i in info)
    {
        _i = info[i];
        if (!_i)
            continue;
        if (s!=='')
            s += ' ';
        if (typeof _i=='function')
            s += _i();
        else
            s += _i;
    }
    return trim_space(s);
};

// light-weight efficient etask/promise error value
function Etask_err(err){ this.error = err || new Error(); }
E.Etask_err = Etask_err;
E.err = function(err){ return new Etask_err(err); };
E.is_err = function(v){
    return (v instanceof Etask && v.error!==undefined) ||
        v instanceof Etask_err;
};
E.err_res = function(err, res){ return err ? E.err(err) : res; };
E._res2rv = function(res){
    return E.is_err(res) ? {ret: undefined, err: res.error}
        : {ret: res, err: undefined};
};
E.is_final = function(v){
    return !v || typeof v.then!='function' || v instanceof Etask_err ||
        (v instanceof Etask && !!v.tm_completed);
};

// promise compliant .then() implementation for Etask and Etask_err.
// for unit-test comfort, also .otherwise(), .catch(), .ensure(), resolve() and
// reject() are implemented.
E.prototype.then = function(on_res, on_err){
    var _this = this;
    function on_done(){
        if (!_this.error)
            return !on_res ? _this.retval : on_res(_this.retval);
        return !on_err ? E.err(_this.error) : on_err(_this.error);
    }
    if (this.tm_completed)
        return etask('then_completed', [function(){ return on_done(); }]);
    var then_wait = etask('then_wait', [function(){ return this.wait(); }]);
    this.then_waiting.push(function(){
        try { then_wait.continue(on_done()); }
        catch(e){ then_wait.throw(e); }
    });
    return then_wait;
};
E.prototype.otherwise = E.prototype.catch = function(on_err){
    return this.then(null, on_err); };
E.prototype.ensure = function(on_ensure){
    return this.then(function(res){ on_ensure(); return res; },
        function(err){ on_ensure(); throw err; });
};
Etask_err.prototype.then = function(on_res, on_err){
    var _this = this;
    return etask('then_err', [function(){
        return !on_err ? E.err(_this.error) : on_err(_this.error);
    }]);
};
Etask_err.prototype.otherwise = Etask_err.prototype.catch = function(on_err){
    return this.then(null, on_err); };
Etask_err.prototype.ensure = function(on_ensure){
    this.then(null, function(){ on_ensure(); });
    return this;
};
E.resolve = function(res){ return etask([function(){ return res; }]); };
E.reject = function(err){ return etask([function(){ throw err; }]); };

E.prototype.wait_ext = function(promise){
    if (!promise || typeof promise.then!='function')
        return promise;
    var wait = this.wait();
    promise.then(wait.continue_fn(), wait.throw_fn());
    return wait;
};

E.prototype.longname = function(flags){
    flags = flags||{TIME: 1};
    var s = '', _s;
    if (this.running)
        s += 'RUNNING ';
    s += this.get_name(flags)+(!this.tm_completed ? '.'+this.state_str() : '')
        +' ';
    if (this.tm_completed)
        s += 'COMPLETED'+(flags.TIME ? ' '+this.get_time_completed() : '')+' ';
    if (flags.TIME)
        s += this.get_time_passed()+' ';
    if (_s = this.get_info())
        s += _s+' ';
    return trim_space(s);
};
E.prototype.stack = function(flags){
    var et = this, s = '';
    flags = assign({STACK: 1, RECURSIVE: 1, GUESS: 1}, flags);
    while (et)
    {
        var _s = et.longname(flags)+'\n';
        if (et.up)
            et = et.up;
        else if (et.parent)
        {
            _s = (et.parent_type=='call' ? 'CALL' : 'SPAWN')+' '+_s;
            et = et.parent;
        }
        else if (et.parent_guess && flags.GUESS)
        {
            _s = 'SPAWN? '+_s;
            et = et.parent_guess;
        }
        else
            et = undefined;
        if (flags.TOPDOWN)
            s = _s+s;
        else
            s += _s;
    }
    return s;
};
E.prototype._ps = function(pre_first, pre_next, flags){
    var i, s = '', task_trail, et = this, child_guess;
    if (++flags.limit_n>=flags.LIMIT)
        return flags.limit_n==flags.LIMIT ? '\nLIMIT '+flags.LIMIT+'\n': '';
    /* get top-most et */
    for (; et.up; et = et.up);
    /* print the sp frames */
    for (var first = 1; et; et = et.down, first = 0)
    {
        s += first ? pre_first : pre_next;
        first = 0;
        if (flags.MARK && (i = flags.MARK.sp.indexOf(et))>=0)
            s += (flags.MARK.name[i]||'***')+' ';
        s += et.longname(flags)+'\n';
        if (flags.RECURSIVE)
        {
            var stack_trail = et.down ? '.' : ' ';
            var child = et.child;
            if (flags.GUESS)
                child = child.concat(et.child_guess);
            for (i = 0; i<child.length; i++)
            {
                task_trail = i<child.length-1 ? '|' : stack_trail;
                child_guess = child[i].parent_guess ? '\\? ' :
                    child[i].parent_type=='call' ? '\\> ' : '\\_ ';
                s += child[i]._ps(pre_next+task_trail+child_guess,
                    pre_next+task_trail+'   ', flags);
            }
        }
    }
    return s;
};
function ps_flags(flags){
    var m, _m;
    if (m = flags.MARK)
    {
        if (!Array.isArray(m))
            _m = {sp: [m], name: []};
        else if (!Array.isArray(flags.MARK[0]))
            _m = {sp: m, name: []};
        else
        {
            _m = {sp: [], name: []};
            for (var i=0; i<m.length; i++)
            {
                _m.name.push(m[i][0]);
                _m.sp.push(m[i][1]);
            }
        }
        flags.MARK = _m;
    }
}
E.prototype.ps = function(flags){
    flags = assign({STACK: 1, RECURSIVE: 1, LIMIT: 10000000, TIME: 1,
        GUESS: 1}, flags, {limit_n: 0});
    ps_flags(flags);
    return this._ps('', '', flags);
};
E._longname_root = function(){
    return (zerr.prefix ? zerr.prefix+'pid '+process.pid+' ' : '')+'root'; };
E.ps = function(flags){
    var i, s = '', task_trail;
    flags = assign({STACK: 1, RECURSIVE: 1, LIMIT: 10000000, TIME: 1,
        GUESS: 1}, flags, {limit_n: 0});
    ps_flags(flags);
    s += E._longname_root()+'\n';
    var child = E.root;
    if (flags.GUESS)
    {
        child = [];
        for (i=0; i<E.root.length; i++)
        {
            if (!E.root[i].parent_guess)
                child.push(E.root[i]);
        }
    }
    for (i=0; i<child.length; i++)
    {
        task_trail = i<child.length-1 ? '|' : ' ';
        s += child[i]._ps(task_trail+'\\_ ', task_trail+'   ', flags);
    }
    return s;
};

function assert_tree_unique(a){
    var i;
    for (i=0; i<a.length-1; i++)
        assert(!a.includes(a[i], i+1));
}
E.prototype._assert_tree = function(opt){
    var i, et;
    opt = opt||{};
    assert_tree_unique(this.child);
    assert(this.parent);
    if (this.down)
    {
        et = this.down;
        assert(et.up===this);
        assert(!et.parent);
        assert(!et.parent_guess);
        this.down._assert_tree(opt);
    }
    for (i=0; i<this.child.length; i++)
    {
        et = this.child[i];
        assert(et.parent===this);
        assert(!et.parent_guess);
        assert(!et.up);
        et._assert_tree(opt);
    }
    if (this.child_guess.length)
        assert(E.in_run.includes(this));
    for (i=0; i<this.child_guess.length; i++)
    {
        et = this.child_guess[i];
        assert(et.parent_guess===this);
        assert(!et.parent);
        assert(!et.up);
    }
};
E._assert_tree = function(opt){
    var i, et, child = E.root;
    opt = opt||{};
    assert_tree_unique(E.root);
    for (i=0; i<child.length; i++)
    {
        et = child[i];
        assert(!et.parent);
        assert(!et.up);
        et._assert_tree(opt);
    }
};
E.prototype._assert_parent = function(){
    if (this.up)
        return assert(!this.parent && !this.parent_guess);
    assert(this.parent && this.parent_guess,
        'parent_guess together with parent');
    if (this.parent)
    {
        var child = this.parent ? this.parent.child : E.root;
        assert(child.includes(this),
            'cannot find in parent '+(this.parent ? '' : 'root'));
    }
    else if (this.parent_guess)
    {
        assert(this.parent_guess.child_guess.includes(this),
            'cannot find in parent_guess');
        assert(E.in_run.includes(this.parent_guess));
    }
};

E.prototype.return_child = function(){
    // copy array, since return() has side affects and can modify array
    var child = Array.from(this.child);
    for (var i=0; i<child.length; i++)
        child[i].return();
};

E.sleep = function(ms){
    var timer;
    ms = ms||0;
    return etask({name: 'sleep', cancel: true}, [function(){
        this.info.ms = ms+'ms';
        timer = setTimeout(this.continue_fn(), ms);
        return this.wait();
    }, function finally$(){
        clearTimeout(timer);
    }]);
};

var ebreak_obj = {ebreak: 1};
E.prototype.break = function(ret){
    return this.throw({ebreak: ebreak_obj, ret: ret}); };
E.for = function(cond, inc, opt, states){
    if (Array.isArray(opt) || typeof opt=='function')
    {
        states = opt;
        opt = {};
    }
    if (typeof states=='function')
        states = [states];
    opt = opt||{};
    return etask({name: 'for', cancel: true, init: opt.init_parent},
    [function loop(){
        return !cond || cond.call(this);
    }, function try_catch$(res){
        if (!res)
            return this.return();
        return etask({name: 'for_iter', cancel: true, init: opt.init},
            states||[]);
    }, function(){
        if (this.error)
        {
            if (this.error.ebreak===ebreak_obj)
                return this.return(this.error.ret);
            return this.throw(this.error);
        }
        return inc && inc.call(this);
    }, function(){
        return this.goto('loop');
    }]);
};
E.for_each = function(obj, states){
    var keys = Object.keys(obj);
    var iter = {obj: obj, keys: keys, i: 0, key: undefined, val: undefined};
    function init_iter(){ this.iter = iter; }
    return E.for(function(){
            this.iter = this.iter||iter;
            iter.key = keys[iter.i];
            iter.val = obj[keys[iter.i]];
            return iter.i<keys.length;
        },
        function(){ return iter.i++; },
        {init: init_iter, init_parent: init_iter},
        states);
};
E.while = function(cond, states){ return E.for(cond, null, states); };

// all([opt, ]a_or_o)
E.all = function(a_or_o, ao2){
    var i, j, opt = {};
    if (ao2)
    {
        opt = a_or_o;
        a_or_o = ao2;
    }
    if (Array.isArray(a_or_o))
    {
        var a = Array.from(a_or_o);
        i = 0;
        return etask({name: 'all_a', cancel: true}, [function(){
            for (j=0; j<a.length; j++)
                this.spawn(a[j]);
        }, function try_catch$loop(){
            if (i>=a.length)
                return this.return(a);
            this.info.at = 'at '+i+'/'+a.length;
            var _a = a[i];
            if (_a instanceof Etask)
                _a.spawn_parent();
            return _a;
        }, function(res){
            if (this.error)
            {
                if (!opt.allow_fail)
                    return this.throw(this.error);
                res = E.err(this.error);
            }
            a[i] = res;
            i++;
            return this.goto('loop');
        }]);
    }
    else if (a_or_o instanceof Object)
    {
        var keys = Object.keys(a_or_o), o = {};
        i = 0;
        return etask({name: 'all_o', cancel: true}, [function(){
            for (j=0; j<keys.length; j++)
                this.spawn(a_or_o[keys[j]]);
        }, function try_catch$loop(){
            if (i>=keys.length)
                return this.return(o);
            var _i = keys[i], _a = a_or_o[_i];
            this.info.at = 'at '+_i+' '+i+'/'+keys.length;
            if (_a instanceof Etask)
                _a.spawn_parent();
            return _a;
        }, function(res){
            if (this.error)
            {
                if (!opt.allow_fail)
                    return this.throw(this.error);
                res = E.err(this.error);
            }
            o[keys[i]] = res;
            i++;
            return this.goto('loop');
        }]);
    }
    else
        assert(0, 'invalid type');
};

E.all_limit = function(limit, arr_iter, cb){
    var at = 0;
    var iter = !Array.isArray(arr_iter) ? arr_iter : function(){
        if (at<arr_iter.length)
            return cb.call(this, arr_iter[at++]);
    };
    return etask({name: 'all_limit', cancel: true}, [function(){
        var next;
        if (!(next = iter.call(this)))
            return this.goto('done');
        this.spawn(next);
        this.loop();
        if (this.child.length>=limit)
            return this.wait_child('any');
    }, function done(){
        return this.wait_child('all');
    }]);
};

// _apply(opt, func[, _this], args)
// _apply(opt, object, method, args)
E._apply = function(opt, func, _this, args){
    var func_name;
    if (typeof _this=='string') // class with '.method' string call
    {
        assert(_this[0]=='.', 'invalid method '+_this);
        var method = _this.slice(1), _class = func;
        func = _class[method];
        _this = _class;
        assert(_this instanceof Object, 'invalid method .'+method);
        func_name = method;
    }
    else if (Array.isArray(_this) && !args)
    {
        args = _this;
        _this = null;
    }
    opt.name = opt.name||func_name||func.name;
    return etask(opt, [function(){
        var et = this, ret_sync, returned = 0;
        args = Array.from(args);
        args.push(function cb(err, res){
            if (typeof opt.ret_sync=='string' && !returned)
            {
                // hack to wait for result
                var a = arguments;
                returned++;
                return void E.nextTick(function(){ cb.apply(null, a); });
            }
            var nfn = opt.nfn===undefined || opt.nfn ? 1 : 0;
            if (opt.ret_o)
            {
                var o = {}, i;
                if (Array.isArray(opt.ret_o))
                {
                    for (i=0; i<opt.ret_o.length; i++)
                        o[opt.ret_o[i]] = arguments[i+nfn];
                }
                else if (typeof opt.ret_o=='string')
                    o[opt.ret_o] = array.slice(arguments, nfn);
                else
                    assert(0, 'invalid opt.ret_o');
                if (typeof opt.ret_sync=='string')
                    o[opt.ret_sync] = ret_sync;
                res = o;
            }
            else if (opt.ret_a)
                res = array.slice(arguments, nfn);
            else if (!nfn)
                res = err;
            et.continue(nfn ? E.err_res(err, res) : res);
        });
        ret_sync = func.apply(_this, args);
        if (Array.isArray(opt.ret_sync))
            opt.ret_sync[0][opt.ret_sync[1]] = ret_sync;
        returned++;
        return this.wait();
    }]);
};

// nfn_apply([opt, ]object, method, args)
// nfn_apply([opt, ]func, this, args)
E.nfn_apply = function(opt, func, _this, args){
    var _opt = {nfn: 1};
    if (typeof opt=='function' || typeof func=='string')
    {
        args = _this;
        _this = func;
        func = opt;
        opt = _opt;
    }
    else
        opt = assign(_opt, opt);
    return E._apply(opt, func, _this, args);
};
// cb_apply([opt, ]object, method, args)
// cb_apply([opt, ]func, this, args)
E.cb_apply = function(opt, func, _this, args){
    var _opt = {nfn: 0};
    if (typeof opt=='function' || typeof func=='string')
    {
        args = _this;
        _this = func;
        func = opt;
        opt = _opt;
    }
    else
        opt = assign(_opt, opt);
    return E._apply(opt, func, _this, args);
};

E.prototype.continue_nfn = function(){
    return function(err, res){ this.continue(E.err_res(err, res)); }
    .bind(this);
};

E.augment = function(_prototype, method, e_method){
    var i, opt = {};
    if (method instanceof Object && !Array.isArray(method))
    {
        assign(opt, method);
        method = arguments[2];
        e_method = arguments[3];
    }
    if (Array.isArray(method))
    {
        if (e_method)
            opt.prefix = e_method;
        for (i=0; i<method.length; i++)
            E.augment(_prototype, opt, method[i]);
        return;
    }
    opt.prefix = opt.prefix||'e_';
    if (!e_method)
        e_method = opt.prefix+method;
    var fn = _prototype[method];
    _prototype[e_method] = function(){
        return etask._apply({name: e_method, nfn: 1}, fn, this, arguments); };
};

E.wait = function(timeout){
    return etask({name: 'wait', cancel: true},
        [function(){ return this.wait(timeout); }]);
};
E.to_nfn = function(promise, cb, opt){
    return etask({name: 'to_nfn', async: true}, [function try_catch$(){
        return promise;
    }, function(res){
        var ret = [this.error];
        if (opt && opt.ret_a)
            ret = ret.concat(res);
        else
            ret.push(res);
        cb.apply(null, ret);
    }]);
};
function etask_fn(opt, states, push_this){
    if (Array.isArray(opt) || typeof opt=='function')
    {
        states = opt;
        opt = undefined;
    }
    return function(){
        var _opt = assign({}, opt);
        _opt.state0_args = Array.from(arguments);
        if (push_this)
            _opt.state0_args.unshift(this);
        return etask(_opt, states);
    };
}
E.fn = function(opt, states){ return etask_fn(opt, states, false); };
E._fn = function(opt, states){ return etask_fn(opt, states, true); };
E._generator = function(gen, ctor, opt){
    opt = opt||{};
    opt.name = opt.name||(ctor && ctor.name)||'generator';
    if (opt.cancel===undefined)
        opt.cancel = true;
    var done;
    return etask(opt, [function(){
        this.generator = gen = gen||ctor.apply(this, opt.state0_args||[]);
        this.generator_ctor = ctor;
        return {ret: undefined, err: undefined};
    }, function try_catch$loop(rv){
        var res;
        try { res = rv.err ? gen.throw(rv.err) : gen.next(rv.ret); }
        catch(e){ return this.return(E.err(e)); }
        if (res.done)
        {
            done = true;
            return this.return(res.value);
        }
        return res.value;
    }, function(ret){
        return this.goto('loop', this.error ?
            {ret: undefined, err: this.error} : {ret: ret, err: undefined});
    }, function finally$(){
        // https://kangax.github.io/compat-table/es6/#test-generators_%GeneratorPrototype%.return
        // .return() supported only in node>=6.x.x
        if (!done && gen.return)
            try { gen.return(); } catch(e){}
    }]);
};
E.ef = function(err){ // error filter
    if (zerr.on_exception)
        zerr.on_exception(err);
    return err;
};
// similar to setInterval
// opt==10000 (or opt.ms==10000) - call states every 10 seconds
// opt.mode=='smart' - default mode, like setInterval. If states take
//   longer than 'ms' to execute, next execution is delayed.
// opt.mode=='fixed' - always sleep 10 seconds between states
// opt.mode=='spawn' - spawn every 10 seconds
E.interval = function(opt, states){
    if (typeof opt=='number')
        opt = {ms: opt};
    if (opt.mode=='fixed')
    {
        return E.for(null, function(){ return etask.sleep(opt.ms); },
            states);
    }
    if (opt.mode=='smart' || !opt.mode)
    {
        var now;
        return E.for(function(){ now = Date.now(); return true; },
            function(){
                var delay = zutil.clamp(0, now+opt.ms-Date.now(), Infinity);
                return etask.sleep(delay);
            }, states);
    }
    if (opt.mode=='spawn')
    {
        var stopped = false;
        return etask([function loop(){
            etask([function try_catch$(){
                return etask(states);
            }, function(res){
                if (!this.error)
                    return;
                if (this.error.ebreak!==ebreak_obj)
                    return this.throw(this.error);
                stopped = true;
            }]);
        }, function(){
            if (stopped)
                return this.return();
            return etask.sleep(opt.ms);
        }, function(){
            if (stopped) // stopped during sleep by prev long iteration
                return this.return();
            return this.goto('loop');
        }]);
    }
    throw new Error('unexpected mode '+opt.mode);
};

return Etask; }.apply(exports, __WEBPACK_AMD_DEFINE_ARRAY__),
				__WEBPACK_AMD_DEFINE_RESULT__ !== undefined && (module.exports = __WEBPACK_AMD_DEFINE_RESULT__)); }());


/***/ }),

/***/ 53:
/***/ (function(module, exports, __webpack_require__) {

"use strict";
// LICENSE_CODE ZON ISC
 /*jslint browser:true, es6:true*/

Object.defineProperty(exports, "__esModule", {
    value: true
});
var E = {};

E.bytes_format = function (bytes, precision) {
    if (!bytes || isNaN(parseFloat(bytes)) || !isFinite(bytes)) return '';
    var number = Math.floor(Math.log(bytes) / Math.log(1000));
    if (typeof precision === 'undefined') precision = number ? 2 : 0;
    var number_format = Intl.NumberFormat('en-US', { maximumFractionDigits: precision });
    return number_format.format(bytes / Math.pow(1000, Math.floor(number))) + ' ' + ['B', 'KB', 'MB', 'GB', 'TB', 'PB'][number];
};

var ga = void 0;
E.init_ga = function (_ga) {
    return ga = _ga;
};

E.ga_event = function (category, action, label) {
    return ga && ga.trackEvent(category, action, label, undefined, undefined, { transport: 'beacon' });
};

exports.default = E;

/***/ }),

/***/ 54:
/***/ (function(module, exports, __webpack_require__) {

"use strict";
// LICENSE_CODE ZON ISC
 /*jslint react:true*/

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _regeneratorRuntime = __webpack_require__(31);

var _regeneratorRuntime2 = _interopRequireDefault(_regeneratorRuntime);

var _lodash = __webpack_require__(41);

var _lodash2 = _interopRequireDefault(_lodash);

var _react = __webpack_require__(0);

var _react2 = _interopRequireDefault(_react);

var _reactBootstrap = __webpack_require__(33);

var _axios = __webpack_require__(263);

var _axios2 = _interopRequireDefault(_axios);

var _etask = __webpack_require__(40);

var _etask2 = _interopRequireDefault(_etask);

var _util = __webpack_require__(53);

var _util2 = _interopRequireDefault(_util);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

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

            var Row = this.props.row;
            return _react2.default.createElement(
                'div',
                null,
                _react2.default.createElement(
                    'h4',
                    null,
                    this.props.title,
                    this.props.show_more && _react2.default.createElement(
                        'small',
                        null,
                        '\xA0',
                        _react2.default.createElement(
                            'a',
                            { href: this.props.path },
                            'show all'
                        )
                    )
                ),
                _react2.default.createElement(
                    _reactBootstrap.Table,
                    { bordered: true, condensed: true },
                    _react2.default.createElement(
                        'thead',
                        null,
                        this.props.children
                    ),
                    _react2.default.createElement(
                        'tbody',
                        null,
                        this.props.stats.map(function (s) {
                            return _react2.default.createElement(Row, { stat: s, key: s[_this3.props.row_key || 'key'],
                                path: _this3.props.path });
                        })
                    )
                )
            );
        }
    }]);

    return StatTable;
}(_react2.default.Component);

var StatsService = function StatsService() {
    _classCallCheck(this, StatsService);
};

StatsService.base = '/api/request_stats';
StatsService.get_top = _etask2.default._fn(_regeneratorRuntime2.default.mark(function _callee(_this) {
    var opt = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

    var res, assign, state, _arr, _i, k;

    return _regeneratorRuntime2.default.wrap(function _callee$(_context) {
        while (1) {
            switch (_context.prev = _context.next) {
                case 0:
                    _context.next = 2;
                    return _this.get('top');

                case 2:
                    res = _context.sent;
                    assign = Object.assign;

                    opt = assign({ reverse: true }, opt);
                    state = _lodash2.default.reduce(res, function (s, v, k) {
                        if (_lodash2.default.isInteger(+k)) return s.statuses.stats.push(assign({ status_code: k,
                            value: v.count, bw: v.bw }, v)) && s;
                        if (['http', 'https'].includes(k)) {
                            return s.protocols.stats.push(assign({ protocol: k, bw: v.bw,
                                value: v.count }, v)) && s;
                        }
                        return s.domains.stats.push(assign({ hostname: k, value: v.count,
                            bw: v.bw }, v)) && s;
                    }, { statuses: { stats: [] }, domains: { stats: [] },
                        protocols: { stats: [] } });

                    if (!state.protocols.stats.some(_lodash2.default.matches({ protocol: 'https' }))) state.protocols.stats.push({ protocol: 'https', bw: 0, value: 0 });
                    if (opt.sort || opt.limit) {
                        _arr = ['statuses', 'domains', 'protocols'];

                        for (_i = 0; _i < _arr.length; _i++) {
                            k = _arr[_i];

                            state[k] = {
                                has_more: state[k].stats.length > (opt.limit || Infinity),
                                stats: (0, _lodash2.default)(state[k].stats)
                            };
                            if (opt.sort) {
                                state[k].stats = state[k].stats.sortBy(_lodash2.default.isString(opt.sort) && opt.sort || 'value');
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
StatsService.get_all = _etask2.default._fn(_regeneratorRuntime2.default.mark(function _callee2(_this) {
    var opt = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
    var res;
    return _regeneratorRuntime2.default.wrap(function _callee2$(_context2) {
        while (1) {
            switch (_context2.prev = _context2.next) {
                case 0:
                    opt = Object.assign({ reverse: 1 }, opt);
                    _context2.next = 3;
                    return _this.get('all');

                case 3:
                    res = _context2.sent;

                    if (opt.by) {
                        res = (0, _lodash2.default)(Object.values(res.reduce(function (s, v, k) {
                            var c = v[opt.by];
                            s[c] = s[c] || Object.assign({ value: 0, bw: 0 }, v);
                            s[c].value += 1;
                            s[c].bw += v.bw;
                            return s;
                        }, {})));
                    } else res = (0, _lodash2.default)(res);
                    if (opt.sort) res = res.sortBy(_lodash2.default.isString(opt.sort) && opt.sort || 'value');
                    if (opt.reverse) res = res.reverse();
                    return _context2.abrupt('return', res.value());

                case 8:
                case 'end':
                    return _context2.stop();
            }
        }
    }, _callee2, this);
}));
StatsService.reset = _etask2.default._fn(_regeneratorRuntime2.default.mark(function _callee3(_this) {
    return _regeneratorRuntime2.default.wrap(function _callee3$(_context3) {
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
StatsService.get = _etask2.default._fn(_regeneratorRuntime2.default.mark(function _callee4(_, stats) {
    var res;
    return _regeneratorRuntime2.default.wrap(function _callee4$(_context4) {
        while (1) {
            switch (_context4.prev = _context4.next) {
                case 0:
                    _context4.next = 2;
                    return (0, _etask2.default)(function () {
                        return _axios2.default.get(StatsService.base + '/' + stats);
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
            var cur_page = _lodash2.default.min([Math.ceil(stats.length / this.state.items_per_page), page]);
            this.setState({
                all_stats: stats,
                stats: stats.slice(cur_page * this.state.items_per_page, (cur_page + 1) * this.state.items_per_page),
                cur_page: cur_page
            });
        }
    }, {
        key: 'render',
        value: function render() {
            return _react2.default.createElement(
                'div',
                null,
                _react2.default.createElement(
                    'div',
                    { className: 'page-header' },
                    _react2.default.createElement(
                        'h3',
                        null,
                        this.props.header
                    )
                ),
                _react2.default.createElement(
                    'div',
                    { className: 'page-body' },
                    this.props.title,
                    _react2.default.createElement(
                        'h3',
                        null,
                        'Requests'
                    ),
                    _react2.default.createElement(
                        _reactBootstrap.Table,
                        { bordered: true, className: 'table-fixed' },
                        _react2.default.createElement(
                            'thead',
                            null,
                            _react2.default.createElement(
                                'tr',
                                null,
                                _react2.default.createElement(
                                    'th',
                                    { className: 'col-sm-8' },
                                    'URL'
                                ),
                                _react2.default.createElement(
                                    'th',
                                    null,
                                    'Bandwidth'
                                ),
                                _react2.default.createElement(
                                    'th',
                                    null,
                                    'Response time'
                                ),
                                _react2.default.createElement(
                                    'th',
                                    null,
                                    'IP used'
                                )
                            )
                        ),
                        _react2.default.createElement(
                            'tbody',
                            null,
                            this.state.stats.map(function (s, i) {
                                return _react2.default.createElement(
                                    'tr',
                                    { key: i },
                                    _react2.default.createElement(
                                        'td',
                                        { className: 'nowrap overflow-ellipsis' },
                                        s.url
                                    ),
                                    _react2.default.createElement(
                                        'td',
                                        null,
                                        _util2.default.bytes_format(s.bw)
                                    ),
                                    _react2.default.createElement(
                                        'td',
                                        null,
                                        s.response_time,
                                        ' ms'
                                    ),
                                    _react2.default.createElement(
                                        'td',
                                        null,
                                        s.proxy_peer
                                    )
                                );
                            })
                        )
                    ),
                    _react2.default.createElement(
                        _reactBootstrap.Col,
                        { md: 12, className: 'text-center' },
                        _react2.default.createElement(_reactBootstrap.Pagination, { prev: true, next: true, activePage: this.state.cur_page + 1,
                            bsSize: 'small', onSelect: this.page_change,
                            items: Math.ceil(this.state.all_stats.length / this.state.items_per_page), maxButtons: 5 })
                    ),
                    this.props.children
                )
            );
        }
    }]);

    return StatsDetails;
}(_react2.default.Component);

exports.default = { StatsDetails: StatsDetails, StatTable: StatTable, StatsService: StatsService };

/***/ }),

/***/ 559:
/***/ (function(module, exports, __webpack_require__) {

var __WEBPACK_AMD_DEFINE_ARRAY__, __WEBPACK_AMD_DEFINE_RESULT__;
var module;
/*jslint skip_file:true*/
(function(){

var is_node = typeof module=='object' && module.exports && module.children;
if (!is_node)
    ;
else
    ;
!(__WEBPACK_AMD_DEFINE_ARRAY__ = [], __WEBPACK_AMD_DEFINE_RESULT__ = function(){

/**
 * Minimal EventEmitter interface that is molded against the Node.js
 * EventEmitter interface.
 *
 * @constructor
 * @api public
 */
function EventEmitter() {
  this._events = {};
}

/**
 * Return a list of assigned event listeners.
 *
 * @param {String} event The events that should be listed.
 * @returns {Array}
 * @api public
 */
EventEmitter.prototype.listeners = function listeners(event) {
  return Array.apply(this, this._events[event] || []);
};

/**
 * Emit an event to all registered event listeners.
 *
 * @param {String} event The name of the event.
 * @returns {Boolean} Indication if we've emitted an event.
 * @api public
 */
EventEmitter.prototype.emit = function emit(event, a1, a2, a3, a4, a5) {
  if (!this._events || !this._events[event]) return false;

  var listeners = this._events[event]
    , length = listeners.length
    , len = arguments.length
    , fn = listeners[0]
    , args
    , i;

  if (1 === length) {
    switch (len) {
      case 1:
        fn.call(fn.__EE3_context || this);
      break;
      case 2:
        fn.call(fn.__EE3_context || this, a1);
      break;
      case 3:
        fn.call(fn.__EE3_context || this, a1, a2);
      break;
      case 4:
        fn.call(fn.__EE3_context || this, a1, a2, a3);
      break;
      case 5:
        fn.call(fn.__EE3_context || this, a1, a2, a3, a4);
      break;
      case 6:
        fn.call(fn.__EE3_context || this, a1, a2, a3, a4, a5);
      break;

      default:
        for (i = 1, args = new Array(len -1); i < len; i++) {
          args[i - 1] = arguments[i];
        }

        fn.apply(fn.__EE3_context || this, args);
    }

    if (fn.__EE3_once) this.removeListener(event, fn);
  } else {
    for (i = 1, args = new Array(len -1); i < len; i++) {
      args[i - 1] = arguments[i];
    }

    for (i = 0; i < length; fn = listeners[++i]) {
      fn.apply(fn.__EE3_context || this, args);
      if (fn.__EE3_once) this.removeListener(event, fn);
    }
  }

  return true;
};

function _addListener(event, fn, context, prepend) {
  if (!this._events) this._events = {};
  if (!this._events[event]) this._events[event] = [];

  fn.__EE3_context = context;
  if (prepend)
      this._events[event].unshift(fn);
  else
      this._events[event].push(fn);

  return this;
}

/**
 * Register a new EventListener for the given event.
 *
 * @param {String} event Name of the event.
 * @param {Functon} fn Callback function.
 * @param {Mixed} context The context of the function.
 * @api public
 */
EventEmitter.prototype.on = function on(event, fn, context) {
  return _addListener.apply(this, [event, fn, context]);
};

/**
 * Add an EventListener that's only called once.
 *
 * @param {String} event Name of the event.
 * @param {Function} fn Callback function.
 * @param {Mixed} context The context of the function.
 * @api public
 */
EventEmitter.prototype.once = function once(event, fn, context) {
  fn.__EE3_once = true;
  return this.on(event, fn, context);
};

EventEmitter.prototype.prependListener = function prependListener(event, fn,
    context)
{
  return _addListener.apply(this, [event, fn, context, true]);
};

EventEmitter.prototype.prependOnceListener = function prependOnceListener(
    event, fn, context)
{
    fn.__EE3_once = true;
    return this.prependListener(event, fn, context);
};

/**
 * Remove event listeners.
 *
 * @param {String} event The event we want to remove.
 * @param {Function} fn The listener that we need to find.
 * @api public
 */
EventEmitter.prototype.removeListener = function removeListener(event, fn) {
  if (!this._events || !this._events[event]) return this;

  var listeners = this._events[event]
    , events = [];

  for (var i = 0, length = listeners.length; i < length; i++) {
    if (fn && listeners[i] !== fn) {
      events.push(listeners[i]);
    }
  }

  //
  // Reset the array, or remove it completely if we have no more listeners.
  //
  if (events.length) this._events[event] = events;
  else this._events[event] = null;

  return this;
};

/**
 * Remove all listeners or only the listeners for the specified event.
 *
 * @param {String} event The event want to remove all listeners for.
 * @api public
 */
EventEmitter.prototype.removeAllListeners = function removeAllListeners(event) {
  if (!this._events) return this;

  if (event) this._events[event] = null;
  else this._events = {};

  return this;
};

//
// Alias methods names because people roll like that.
//
EventEmitter.prototype.off = EventEmitter.prototype.removeListener;
EventEmitter.prototype.addListener = EventEmitter.prototype.on;

//
// This function doesn't apply anymore.
//
EventEmitter.prototype.setMaxListeners = function setMaxListeners() {
  return this;
};

EventEmitter.prototype.eventNames = function eventNames(){
    var _this = this;
    return Object.keys(this._events).filter(function(e){
        return _this._events[e]!==null;
    });
}

//
// Expose the module.
//
EventEmitter.EventEmitter = EventEmitter;
EventEmitter.EventEmitter2 = EventEmitter;
EventEmitter.EventEmitter3 = EventEmitter;

return EventEmitter; }.apply(exports, __WEBPACK_AMD_DEFINE_ARRAY__),
				__WEBPACK_AMD_DEFINE_RESULT__ !== undefined && (module.exports = __WEBPACK_AMD_DEFINE_RESULT__)); })();


/***/ }),

/***/ 560:
/***/ (function(module, exports, __webpack_require__) {

var __WEBPACK_AMD_DEFINE_ARRAY__, __WEBPACK_AMD_DEFINE_RESULT__;
var module;
// LICENSE_CODE ZON ISC
'use strict'; /*zlint node, br*/
(function(){
var  node_util;
var is_node = typeof module=='object' && module.exports && module.children;
var is_ff_addon = typeof module=='object' && module.uri
    && !module.uri.indexOf('resource://');
if (is_ff_addon)
    ;
else if (!is_node)
    ;
else
{
    node_util = require('util');
    ;
}
!(__WEBPACK_AMD_DEFINE_ARRAY__ = [__webpack_require__(262)], __WEBPACK_AMD_DEFINE_RESULT__ = function(array){
var E = {};

E._is_mocha = undefined;
E.is_mocha = function(){
    if (E._is_mocha!==undefined)
        return E._is_mocha;
    if (typeof process!='undefined')
        return E._is_mocha = process.env.IS_MOCHA||false;
    return E._is_mocha = false;
};

E.is_lxc = function(){ return is_node && +process.env.LXC; };

E.f_mset = function(flags, mask, bits){ return (flags &~ mask) | bits; };
E.f_lset = function(flags, bits, logic){
    return E.f_mset(flags, bits, logic ? bits : 0); };
E.f_meq = function(flags, mask, bits){ return (flags & mask)==bits; };
E.f_eq = function(flags, bits){ return (flags & bits)==bits; };
E.f_cmp = function(f1, f2, mask){ return (f1 & mask)==(f2 & mask); };
E.xor = function(a, b){ return !a != !b; };
E.div_ceil = function(a, b){ return Math.floor((a+b-1)/b); };
E.ceil_mul = function(a, b){ return E.div_ceil(a, b)*b; };
E.floor_mul = function(a, b){ return Math.floor(a/b)*b; };

E.range = function(x, a, b){ return x>=a && x<=b; };
E.range.ii = function(x, a, b){ return x>=a && x<=b; };
E.range.ie = function(x, a, b){ return x>=a && x<b; };
E.range.ei = function(x, a, b){ return x>a && x<=b; };
E.range.ee = function(x, a, b){ return x>a && x<b; };

E.clamp = function(lower_bound, value, upper_bound){
    if (value < lower_bound)
        return lower_bound;
    if (value < upper_bound)
        return value;
    return upper_bound;
};

/* Union given objects, using fn to resolve conflicting keys */
E.union_with = function(fn /*[o1, [o2, [...]]]*/){
    var res = {}, args;
    if (arguments.length==2 && typeof arguments[1]=='object')
        args = arguments[1];
    else
        args = array.slice(arguments, 1);
    for (var i = 0; i < args.length; ++i)
    {
        for (var key in args[i])
	{
	    var arg = args[i];
	    res[key] = res.hasOwnProperty(key) ? fn(res[key], arg[key])
		: arg[key];
	}
    }
    return res;
};

function _clone_deep(obj){
    var i, n, ret;
    if (obj instanceof Array)
    {
	ret = new Array(obj.length);
	n = obj.length;
	for (i = 0; i < n; i++)
	    ret[i] = obj[i] instanceof Object ? _clone_deep(obj[i]): obj[i];
	return ret;
    }
    else if (obj instanceof Date)
	return new Date(obj);
    else if (obj instanceof RegExp)
	return new RegExp(obj);
    // XXX romank: properly clone function
    else if (obj instanceof Function)
        return obj;
    ret = {};
    for (i in obj)
	ret[i] = obj[i] instanceof Object ? _clone_deep(obj[i]) : obj[i];
    return ret;
}

E.clone_deep = function(obj){
    if (!(obj instanceof Object))
	return obj;
    return _clone_deep(obj);
};

// prefer to normally Object.assign() instead of extend()
E.extend = function(obj){ // like _.extend
    for (var i=1; i<arguments.length; i++)
    {
	var source = arguments[i];
	if (!source)
	    continue;
        for (var prop in source)
	    obj[prop] = source[prop];
    }
    return obj;
};

function is_object(obj){
    return obj && obj.constructor==Object; }

E.extend_deep = function(obj){
    for (var i=1; i<arguments.length; i++)
    {
        var source = arguments[i];
        if (!source)
            continue;
        for (var prop in source)
        {
            if (is_object(source[prop]) && is_object(obj[prop]))
                E.extend_deep(obj[prop], source[prop]);
            else
                obj[prop] = source[prop];
        }
    }
    return obj;
};
E.extend_deep_del_null = function(obj){
    for (var i=1; i<arguments.length; i++)
    {
        var source = arguments[i];
        if (!source)
            continue;
        for (var prop in source)
        {
            if (is_object(source[prop]))
            {
                if (!is_object(obj[prop]))
                    obj[prop] = {};
                E.extend_deep_del_null(obj[prop], source[prop]);
            }
            else if (source[prop]==null)
                delete obj[prop];
            else
                obj[prop] = source[prop];
        }
    }
    return obj;
};

E.clone = function(obj){ // like _.clone
    if (!(obj instanceof Object))
	return obj;
    if (obj instanceof Array)
    {
	var a = new Array(obj.length);
	for (var i=0; i<obj.length; i++)
	    a[i] = obj[i];
	return a;
    }
    return E.extend({}, obj);
};

// like _.map() except returns object, not array
E.map_obj = function(obj, fn){
    var ret = {};
    for (var i in obj)
        ret[i] = fn(obj[i], i, obj);
    return ret;
};

// recursivelly recreate objects with keys added in order
E.sort_obj = function(obj){
    if (obj instanceof Array || !(obj instanceof Object))
	return obj;
    var ret = {}, keys = Object.keys(obj).sort();
    for (var i=0; i<keys.length; i++)
	ret[keys[i]] = E.sort_obj(obj[keys[i]]);
    return ret;
};

// an Object equivalent of Array.prototype.forEach
E.forEach = function(obj, fn, _this){
    for (var i in obj)
        fn.call(_this, obj[i], i, obj);
};
// an Object equivalent of Array.prototype.find
E.find = function(obj, fn, _this){
    for (var i in obj)
    {
        if (fn.call(_this, obj[i], i, obj))
            return obj[i];
    }
};
E.find_prop = function(obj, prop, val){
    return E.find(obj, function(o){ return o[prop]===val; }); };
E.isspace = function(c){ return /\s/.test(c); };
E.isdigit = function(c){ return c>='0' && c<='9'; };
E.isalpha = function(c){ return (c>='a' && c<='z') || (c>='A' && c<='Z'); };
E.isalnum = function(c){ return E.isdigit(c)||E.isalpha(c); };

E.obj_pluck = function(obj, prop){
    var val = obj[prop];
    delete obj[prop];
    return val;
};

// Object.keys() does not work on prototype
E.proto_keys = function(proto){
    var keys = [];
    for (var i in proto)
	keys.push(i);
    return keys;
};

E.values = function(obj){
    var values = [];
    for (var i in obj)
        values.push(obj[i]);
    return values;
};

E.path = function(path){
    if (Array.isArray(path))
        return path;
    path = ''+path;
    if (!path)
        return [];
    return path.split('.');
};
E.get = function(o, path, def){
    path = E.path(path);
    for (var i=0; i<path.length; i++)
    {
	if (!o || !(path[i] in o))
	    return def;
	o = o[path[i]];
    }
    return o;
};
E.set = function(o, path, value){
    path = E.path(path);
    for (var i=0; i<path.length-1; i++)
    {
        var p = path[i];
        o = o[p] || (o[p] = {});
    }
    o[path[path.length-1]] = value;
};
var has_unique = {};
E.has = function(o, path){ return E.get(o, path, has_unique)!==has_unique; };
E.own = function(o, prop){
    return Object.prototype.hasOwnProperty.call(o, prop); };

E.bool_lookup = function(a, split){
    var ret = {}, i;
    if (typeof a=='string')
	a = a.split(split||/\s/);
    for (i=0; i<a.length; i++)
	ret[a[i]] = true;
    return ret;
};

E.clone_inplace = function(dst, src){
    if (dst===src)
        return dst;
    if (Array.isArray(dst))
    {
        for (var i=0; i<src.length; i++)
            dst[i] = src[i];
        dst.splice(src.length);
    }
    else if (typeof dst=='object')
    {
        for (var k in src)
            dst[k] = src[k];
        for (k in dst)
        {
            if (!src.hasOwnProperty(k))
                delete dst[k];
        }
    }
    return dst;
};

if (node_util)
    E.inherits = node_util.inherits;
else
{
    // implementation from node.js 'util' module
    E.inherits = function inherits(ctor, superCtor){
	ctor.super_ = superCtor;
	ctor.prototype = Object.create(superCtor.prototype,
            {constructor: {value: ctor, enumerable: false, writable: true,
	    configurable: true}});
    };
}

// ctor must only have one prototype level
// XXX vladislav: ES6 class is not supported for ctor
E.inherit_init = function(obj, ctor, params){
    var orig_proto = Object.getPrototypeOf(obj);
    var ctor_proto = Object.assign({}, ctor.prototype);
    Object.setPrototypeOf(ctor_proto, orig_proto);
    Object.setPrototypeOf(obj, ctor_proto);
    return ctor.apply(obj, params);
};

E.pick = function(obj){
    var i, o = {};
    for (i=1; i<arguments.length; i++)
    {
        if (E.own(obj, arguments[i]))
            o[arguments[i]] = obj[arguments[i]];
    }
    return o;
};

return E; }.apply(exports, __WEBPACK_AMD_DEFINE_ARRAY__),
				__WEBPACK_AMD_DEFINE_RESULT__ !== undefined && (module.exports = __WEBPACK_AMD_DEFINE_RESULT__)); }());


/***/ }),

/***/ 580:
/***/ (function(module, exports, __webpack_require__) {

"use strict";
// LICENSE_CODE ZON ISC
 /*jslint react:true*/

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _regeneratorRuntime = __webpack_require__(31);

var _regeneratorRuntime2 = _interopRequireDefault(_regeneratorRuntime);

var _lodash = __webpack_require__(41);

var _lodash2 = _interopRequireDefault(_lodash);

var _react = __webpack_require__(0);

var _react2 = _interopRequireDefault(_react);

var _reactBootstrap = __webpack_require__(33);

var _etask = __webpack_require__(40);

var _etask2 = _interopRequireDefault(_etask);

var _common = __webpack_require__(54);

var _common2 = _interopRequireDefault(_common);

var _status_codes = __webpack_require__(87);

var _domains = __webpack_require__(109);

var _protocols = __webpack_require__(110);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var E = {
    install: function install() {
        E.sp = (0, _etask2.default)('status_codes_detail', [function () {
            return this.wait();
        }]);
    },
    uninstall: function uninstall() {
        if (E.sp) E.sp.return();
    }
};

var StatsDetails = function (_React$Component) {
    _inherits(StatsDetails, _React$Component);

    function StatsDetails(props) {
        _classCallCheck(this, StatsDetails);

        var _this2 = _possibleConstructorReturn(this, (StatsDetails.__proto__ || Object.getPrototypeOf(StatsDetails)).call(this, props));

        _this2.state = {
            domains: { stats: [] },
            protocols: { stats: [] }
        };
        return _this2;
    }

    _createClass(StatsDetails, [{
        key: 'componentDidMount',
        value: function componentDidMount() {
            E.install();
            var _this = this;
            E.sp.spawn((0, _etask2.default)(_regeneratorRuntime2.default.mark(function _callee() {
                var res;
                return _regeneratorRuntime2.default.wrap(function _callee$(_context) {
                    while (1) {
                        switch (_context.prev = _context.next) {
                            case 0:
                                _context.t0 = _this;
                                _context.next = 3;
                                return _common2.default.StatsService.get(_this.props.code);

                            case 3:
                                _context.t1 = _context.sent;
                                _context.t2 = {
                                    stats: _context.t1
                                };

                                _context.t0.setState.call(_context.t0, _context.t2);

                                _context.next = 8;
                                return _common2.default.StatsService.get_top({ sort: 1, limit: 5 });

                            case 8:
                                res = _context.sent;

                                _this.setState(_lodash2.default.pick(res, ['domains', 'protocols']));

                            case 10:
                            case 'end':
                                return _context.stop();
                        }
                    }
                }, _callee, this);
            })));
        }
    }, {
        key: 'componentWillUnmount',
        value: function componentWillUnmount() {
            E.uninstall();
        }
    }, {
        key: 'render',
        value: function render() {
            return _react2.default.createElement(
                _common2.default.StatsDetails,
                { stats: this.state.stats,
                    header: 'Status code: ' + this.props.code, title: _react2.default.createElement(
                        _reactBootstrap.Col,
                        { md: 12 },
                        _react2.default.createElement(
                            _reactBootstrap.Col,
                            { md: 6, mdOffset: 3 },
                            _react2.default.createElement(
                                _reactBootstrap.Well,
                                { bsSize: 'small', className: 'text-center' },
                                _react2.default.createElement(
                                    'span',
                                    null,
                                    'Definition of status code ' + this.props.code + ':\n                        ' + (_status_codes.status_codes[this.props.code] || this.props.code)
                                )
                            )
                        )
                    ) },
                _react2.default.createElement(
                    _reactBootstrap.Col,
                    { md: 6 },
                    _react2.default.createElement(
                        'h3',
                        null,
                        'Domains'
                    ),
                    _react2.default.createElement(_domains.DomainTable, { stats: this.state.domains.stats })
                ),
                _react2.default.createElement(
                    _reactBootstrap.Col,
                    { md: 6 },
                    _react2.default.createElement(
                        'h3',
                        null,
                        'Protocols'
                    ),
                    _react2.default.createElement(_protocols.ProtocolTable, { stats: this.state.protocols.stats })
                )
            );
        }
    }]);

    return StatsDetails;
}(_react2.default.Component);

exports.default = StatsDetails;

/***/ }),

/***/ 581:
/***/ (function(module, exports, __webpack_require__) {

"use strict";
// LICENSE_CODE ZON ISC
 /*jslint react:true*/

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _regeneratorRuntime = __webpack_require__(31);

var _regeneratorRuntime2 = _interopRequireDefault(_regeneratorRuntime);

var _lodash = __webpack_require__(41);

var _lodash2 = _interopRequireDefault(_lodash);

var _react = __webpack_require__(0);

var _react2 = _interopRequireDefault(_react);

var _reactBootstrap = __webpack_require__(33);

var _etask = __webpack_require__(40);

var _etask2 = _interopRequireDefault(_etask);

var _common = __webpack_require__(54);

var _common2 = _interopRequireDefault(_common);

var _status_codes = __webpack_require__(87);

var _protocols = __webpack_require__(110);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var E = {
    install: function install() {
        return E.sp = (0, _etask2.default)('domains_detail', [function () {
            return this.wait();
        }]);
    },
    uninstall: function uninstall() {
        if (E.sp) E.sp.return();
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
            E.install();
            var _this = this;
            E.sp.spawn((0, _etask2.default)(_regeneratorRuntime2.default.mark(function _callee() {
                var res;
                return _regeneratorRuntime2.default.wrap(function _callee$(_context) {
                    while (1) {
                        switch (_context.prev = _context.next) {
                            case 0:
                                _context.t0 = _this;
                                _context.next = 3;
                                return _common2.default.StatsService.get(_this.props.domain);

                            case 3:
                                _context.t1 = _context.sent;
                                _context.t2 = {
                                    stats: _context.t1
                                };

                                _context.t0.setState.call(_context.t0, _context.t2);

                                _context.next = 8;
                                return _common2.default.StatsService.get_top({ sort: 1, limit: 5 });

                            case 8:
                                res = _context.sent;

                                _this.setState(_lodash2.default.pick(res, ['statuses', 'protocols']));

                            case 10:
                            case 'end':
                                return _context.stop();
                        }
                    }
                }, _callee, this);
            })));
        }
    }, {
        key: 'componentWillUnmount',
        value: function componentWillUnmount() {
            E.uninstall();
        }
    }, {
        key: 'render',
        value: function render() {
            return _react2.default.createElement(
                _common2.default.StatsDetails,
                { stats: this.state.stats,
                    header: 'Domain name: ' + this.props.domain },
                _react2.default.createElement(
                    _reactBootstrap.Col,
                    { md: 6 },
                    _react2.default.createElement(
                        'h3',
                        null,
                        'Status codes'
                    ),
                    _react2.default.createElement(_status_codes.StatusCodeTable, { stats: this.state.statuses.stats })
                ),
                _react2.default.createElement(
                    _reactBootstrap.Col,
                    { md: 6 },
                    _react2.default.createElement(
                        'h3',
                        null,
                        'Protocols'
                    ),
                    _react2.default.createElement(_protocols.ProtocolTable, { stats: this.state.protocols.stats })
                )
            );
        }
    }]);

    return StatsDetails;
}(_react2.default.Component);

exports.default = StatsDetails;

/***/ }),

/***/ 582:
/***/ (function(module, exports, __webpack_require__) {

"use strict";
// LICENSE_CODE ZON ISC
 /*jslint react:true*/

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _regeneratorRuntime = __webpack_require__(31);

var _regeneratorRuntime2 = _interopRequireDefault(_regeneratorRuntime);

var _lodash = __webpack_require__(41);

var _lodash2 = _interopRequireDefault(_lodash);

var _react = __webpack_require__(0);

var _react2 = _interopRequireDefault(_react);

var _reactBootstrap = __webpack_require__(33);

var _etask = __webpack_require__(40);

var _etask2 = _interopRequireDefault(_etask);

var _common = __webpack_require__(54);

var _common2 = _interopRequireDefault(_common);

var _domains = __webpack_require__(109);

var _status_codes = __webpack_require__(87);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var E = {
    install: function install() {
        return E.sp = (0, _etask2.default)('protocol_detail', [function () {
            return this.wait();
        }]);
    },
    uninstall: function uninstall() {
        if (E.sp) E.sp.return();
    }
};

var StatsDetails = function (_React$Component) {
    _inherits(StatsDetails, _React$Component);

    function StatsDetails(props) {
        _classCallCheck(this, StatsDetails);

        var _this2 = _possibleConstructorReturn(this, (StatsDetails.__proto__ || Object.getPrototypeOf(StatsDetails)).call(this, props));

        _this2.state = {
            statuses: { stats: [] },
            domains: { stats: [] }
        };
        return _this2;
    }

    _createClass(StatsDetails, [{
        key: 'componentDidMount',
        value: function componentDidMount() {
            E.install();
            var _this = this;
            E.sp.spawn((0, _etask2.default)(_regeneratorRuntime2.default.mark(function _callee() {
                var res;
                return _regeneratorRuntime2.default.wrap(function _callee$(_context) {
                    while (1) {
                        switch (_context.prev = _context.next) {
                            case 0:
                                _context.t0 = _this;
                                _context.next = 3;
                                return _common2.default.StatsService.get(_this.props.protocol);

                            case 3:
                                _context.t1 = _context.sent;
                                _context.t2 = {
                                    stats: _context.t1
                                };

                                _context.t0.setState.call(_context.t0, _context.t2);

                                _context.next = 8;
                                return _common2.default.StatsService.get_top({ sort: 1, limit: 5 });

                            case 8:
                                res = _context.sent;

                                _this.setState(_lodash2.default.pick(res, ['statuses', 'domains']));

                            case 10:
                            case 'end':
                                return _context.stop();
                        }
                    }
                }, _callee, this);
            })));
        }
    }, {
        key: 'componentWillUnmount',
        value: function componentWillUnmount() {
            E.uninstall();
        }
    }, {
        key: 'render',
        value: function render() {
            return _react2.default.createElement(
                _common2.default.StatsDetails,
                { stats: this.state.stats,
                    header: 'Protocol: ' + this.props.protocol.toUpperCase() },
                _react2.default.createElement(
                    _reactBootstrap.Col,
                    { md: 6 },
                    _react2.default.createElement(
                        'h3',
                        null,
                        'Domains'
                    ),
                    _react2.default.createElement(_domains.DomainTable, { stats: this.state.domains.stats })
                ),
                _react2.default.createElement(
                    _reactBootstrap.Col,
                    { md: 6 },
                    _react2.default.createElement(
                        'h3',
                        null,
                        'Status codes'
                    ),
                    _react2.default.createElement(_status_codes.StatusCodeTable, { stats: this.state.statuses.stats })
                )
            );
        }
    }]);

    return StatsDetails;
}(_react2.default.Component);

exports.default = StatsDetails;

/***/ }),

/***/ 583:
/***/ (function(module, exports, __webpack_require__) {

"use strict";
// LICENSE_CODE ZON ISC
 /*jslint react:true*/

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _regeneratorRuntime = __webpack_require__(31);

var _regeneratorRuntime2 = _interopRequireDefault(_regeneratorRuntime);

var _react = __webpack_require__(0);

var _react2 = _interopRequireDefault(_react);

var _reactBootstrap = __webpack_require__(33);

var _common = __webpack_require__(269);

var _etask = __webpack_require__(40);

var _etask2 = _interopRequireDefault(_etask);

var _util = __webpack_require__(53);

var _util2 = _interopRequireDefault(_util);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var thumb_style = { margin: '10px' };

var Message = function (_React$Component) {
    _inherits(Message, _React$Component);

    function Message() {
        var _ref;

        var _temp, _this2, _ret;

        _classCallCheck(this, Message);

        for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
            args[_key] = arguments[_key];
        }

        return _ret = (_temp = (_this2 = _possibleConstructorReturn(this, (_ref = Message.__proto__ || Object.getPrototypeOf(Message)).call.apply(_ref, [this].concat(args))), _this2), _this2.thumbs_up = function () {
            return _this2.props.on_thumbs_up(_this2.props.msg);
        }, _this2.thumbs_down = function () {
            return _this2.props.on_thumbs_down(_this2.props.msg);
        }, _this2.dismiss = function () {
            return _this2.props.on_dismiss(_this2.props.msg);
        }, _temp), _possibleConstructorReturn(_this2, _ret);
    }

    _createClass(Message, [{
        key: 'render',
        value: function render() {
            return _react2.default.createElement(
                _reactBootstrap.Col,
                { md: 12, className: 'alert alert-info settings-alert' },
                _react2.default.createElement(
                    _reactBootstrap.Col,
                    { md: 8 },
                    this.props.msg.message
                ),
                _react2.default.createElement(
                    _reactBootstrap.Col,
                    { md: 4, className: 'text-right' },
                    _react2.default.createElement(
                        'a',
                        { className: 'custom_link', onClick: this.thumbs_up, href: '#',
                            style: thumb_style },
                        _react2.default.createElement('img', { src: 'img/ic_thumbs_up.svg' })
                    ),
                    _react2.default.createElement(
                        'a',
                        { className: 'custom_link', onClick: this.thumbs_down, href: '#',
                            style: thumb_style },
                        _react2.default.createElement('img', { src: 'img/ic_thumbs_down.svg' })
                    ),
                    _react2.default.createElement(
                        _reactBootstrap.Button,
                        { bsSize: 'small', bsStyle: 'link', onClick: this.dismiss },
                        'Dismiss'
                    )
                )
            );
        }
    }]);

    return Message;
}(_react2.default.Component);

var MessageList = function (_React$Component2) {
    _inherits(MessageList, _React$Component2);

    function MessageList(props) {
        _classCallCheck(this, MessageList);

        var _this3 = _possibleConstructorReturn(this, (MessageList.__proto__ || Object.getPrototypeOf(MessageList)).call(this, props));

        _this3.thumbs_up = function (msg) {
            _this3.hide(msg);
            _util2.default.ga_event('message', msg.id, 'thumbs_up');
        };

        _this3.thumbs_down = function (msg) {
            _this3.hide(msg);
            _util2.default.ga_event('message', msg.id, 'thumbs_down');
        };

        _this3.dismiss = function (msg) {
            _this3.hide(msg);
            _util2.default.ga_event('message', msg.id, 'dismiss');
        };

        _this3.hide = _etask2.default._fn(_regeneratorRuntime2.default.mark(function _callee(_this, msg) {
            return _regeneratorRuntime2.default.wrap(function _callee$(_context) {
                while (1) {
                    switch (_context.prev = _context.next) {
                        case 0:
                            _this.setState({ show_thank_you: true });
                            window.localStorage.setItem(msg.id, JSON.stringify(msg));
                            _context.next = 4;
                            return _etask2.default.sleep(2000);

                        case 4:
                            _this.setState({ messages: _this.state.messages.filter(function (m) {
                                    return m != msg;
                                }),
                                show_thank_you: false });

                        case 5:
                        case 'end':
                            return _context.stop();
                    }
                }
            }, _callee, this);
        }));

        _this3.state = {
            messages: [{ message: 'Did it work?', id: 'concurrent_connections' }].filter(function (m) {
                return !window.localStorage.getItem(m.id);
            })
        };
        return _this3;
    }

    _createClass(MessageList, [{
        key: 'render',
        value: function render() {
            var _this4 = this;

            return _react2.default.createElement(
                _reactBootstrap.Col,
                { md: 7, className: 'messages' },
                this.state.messages.map(function (m) {
                    return _react2.default.createElement(Message, { msg: m, key: m.id, on_thumbs_up: _this4.thumbs_up,
                        on_thumbs_down: _this4.thumbs_down,
                        on_dismiss: _this4.dismiss });
                }),
                _react2.default.createElement(
                    _common.Dialog,
                    { title: 'Thank you for your feedback',
                        show: this.state.show_thank_you },
                    _react2.default.createElement(
                        'p',
                        null,
                        'We appreciate it!'
                    )
                )
            );
        }
    }]);

    return MessageList;
}(_react2.default.Component);

exports.default = MessageList;

/***/ }),

/***/ 636:
/***/ (function(module, exports, __webpack_require__) {

// style-loader: Adds some css to the DOM by adding a <style> tag

// load the styles
var content = __webpack_require__(637);
if(typeof content === 'string') content = [[module.i, content, '']];
// Prepare cssTransformation
var transform;

var options = {}
options.transform = transform
// add the styles to the DOM
var update = __webpack_require__(58)(content, options);
if(content.locals) module.exports = content.locals;
// Hot Module Replacement
if(false) {
	// When the styles change, update the <style> tags
	if(!content.locals) {
		module.hot.accept("!!../../node_modules/css-loader/index.js?-url!../../node_modules/less-loader/dist/cjs.js!./app.less", function() {
			var newContent = require("!!../../node_modules/css-loader/index.js?-url!../../node_modules/less-loader/dist/cjs.js!./app.less");
			if(typeof newContent === 'string') newContent = [[module.id, newContent, '']];
			update(newContent);
		});
	}
	// When the module is disposed, remove the <style> tags
	module.hot.dispose(function() { update(); });
}

/***/ }),

/***/ 637:
/***/ (function(module, exports, __webpack_require__) {

exports = module.exports = __webpack_require__(57)(undefined);
// imports


// module
exports.push([module.i, "body {\n  font-family: \"Noto Sans\", sans-serif;\n  font-size: 15px;\n  line-height: 23px;\n  overflow-y: scroll;\n}\n.page-body a {\n  color: #428bca;\n  outline: 3px solid transparent;\n  border: 1px solid transparent;\n}\n.page-body a:hover {\n  color: white;\n  background: #428bca;\n  border-color: #428bca;\n  text-decoration: none;\n  box-shadow: #428bca -2px 0 0 1px, #428bca 2px 0 0 1px;\n  border-radius: .15em;\n}\ncode {\n  background: lightgrey;\n  color: black;\n  white-space: nowrap;\n}\n.nowrap {\n  white-space: nowrap;\n}\npre.top-margin {\n  margin-top: 4px;\n}\n.header .dropdown {\n  float: right;\n  margin: 18px 5px 0 0;\n  font-size: 14px;\n}\n.header .dropdown-toggle {\n  background: white;\n  color: #2d404c;\n  border-radius: 5px;\n  padding: 3px 17px 3px 5px;\n  position: relative;\n  text-decoration: none;\n}\n.header .dropdown-toggle:hover {\n  background-color: #e6e6e6;\n}\n.header .dropdown-toggle .caret {\n  position: absolute;\n  right: 6px;\n  top: 12px;\n  margin: 0;\n}\n.container {\n  width: auto;\n  max-width: 1170px;\n}\n.main-container-qs {\n  margin-left: 25%;\n}\n.quickstart {\n  width: 25%;\n  height: 100%;\n  position: fixed;\n  left: 0;\n  top: 0;\n  overflow: auto;\n  border-right: 1px solid black;\n  padding: 12px;\n}\n.qs-move-control {\n  position: absolute;\n  top: 0;\n  bottom: 0;\n  width: 2px;\n  cursor: col-resize;\n}\n.btn-title {\n  float: right;\n  margin-top: -4px;\n  margin-right: 15px;\n  margin-bottom: -5px;\n}\n.header {\n  height: 60px;\n}\n.header img {\n  margin-top: 10px;\n}\n.navigation {\n  background: #f5f5f5;\n  padding: 8px 15px;\n  border-radius: 4px;\n  margin-bottom: 20px;\n  color: #777;\n}\n.navigation:after {\n  content: '';\n  display: block;\n  clear: both;\n}\n.navigation .active {\n  float: left;\n}\n.navigation .active .separator {\n  color: #ccc;\n}\n.navigation .items {\n  float: right;\n}\n.navigation .items .separator {\n  color: #0c334d;\n}\nnav a:hover {\n  box-shadow: none;\n}\n.block {\n  background: #eeeeee;\n  padding: 1em;\n  margin-bottom: 20px;\n}\n.form-group {\n  margin-bottom: 12px;\n}\n.alert-inline {\n  display: inline;\n  padding: 6px 12px;\n  position: relative;\n  top: 2px;\n  margin: 0 8px;\n}\n.tester-body {\n  margin-bottom: 18px;\n}\n.tester-body textarea {\n  height: 100px;\n}\n.tools-header {\n  margin-bottom: 12px;\n}\n.tester-body:after,\n.tools-header:after {\n  content: '';\n  display: block;\n  clear: both;\n}\n.tools-add-header {\n  margin-bottom: 18px;\n}\n.tester-alert {\n  margin-top: 20px;\n  padding: 7.5px 11.5px;\n}\n.tester-results {\n  margin-top: 20px;\n}\n.tools-table {\n  width: auto;\n  float: none;\n  margin: 20px auto;\n}\n.tools-table th {\n  text-align: center;\n}\n.countries-list {\n  text-align: center;\n  margin-top: 20px;\n}\n.countries-list > div {\n  padding: 10px;\n  display: inline-block;\n  width: 200px;\n  white-space: nowrap;\n  overflow: hidden;\n  text-align: left;\n  position: relative;\n  border: 1px solid black;\n  margin: 5px 10px;\n}\n.countries-list .glyphicon {\n  color: grey;\n}\n.countries-list .glyphicon-ok {\n  color: green !important;\n}\n.countries-list .glyphicon-download-alt {\n  color: blue !important;\n}\n.countries-failed {\n  color: red !important;\n}\n.countries-canceled {\n  color: orange !important;\n}\n.countries-op {\n  display: inline-block;\n  position: absolute;\n  right: 0;\n  width: 40px;\n  padding-left: 10px;\n  background: white;\n  background: linear-gradient(to right, rgba(255, 255, 255, 0), white 25%);\n}\n.countries-op span:hover {\n  color: orange;\n  cursor: pointer;\n}\n.countries-view {\n  border-bottom: 1px dashed;\n  cursor: pointer;\n}\n#countries-screenshot .modal-dialog {\n  width: auto;\n  margin-left: 20px;\n  margin-right: 20px;\n}\n#countries-screenshot .modal-body > div {\n  overflow: auto;\n  max-height: calc(100vh - 164px);\n}\ntable.proxies {\n  table-layout: fixed;\n  min-width: 100%;\n  width: auto;\n}\n.proxies-settings,\n.columns-settings {\n  overflow: auto;\n  max-height: calc(100vh - 190px);\n}\n.proxies-panel {\n  overflow: auto;\n}\ndiv.proxies .panel-footer,\ndiv.proxies .panel-heading {\n  position: relative;\n}\ndiv.proxies .panel-heading {\n  height: 65px;\n}\ndiv.proxies .btn-wrapper {\n  position: absolute;\n  right: 10px;\n  top: 10px;\n}\n.proxies-default {\n  color: gray;\n}\n.proxies-editable {\n  cursor: pointer;\n  position: relative;\n  display: inline-block;\n}\n.proxies-editable:hover {\n  color: orange;\n}\n.proxies-table-input {\n  position: absolute;\n  z-index: 2;\n  left: -25px;\n  right: -25px;\n  top: -7px;\n}\n.proxies-table-input input,\n.proxies-table-input select {\n  width: 100%;\n}\n.proxies-check {\n  width: 32px;\n}\n.proxies-actions {\n  white-space: nowrap;\n  width: 80px;\n}\n.proxies-action {\n  cursor: pointer;\n  color: #428bca;\n  outline: 3px solid transparent;\n  border: 1px solid transparent;\n  line-height: 20px;\n  margin: 0 4px;\n}\n.proxies-action-disabled {\n  border: 1px solid transparent;\n  line-height: 20px;\n  margin: 0 4px;\n}\n.proxies-warning {\n  color: red;\n}\n#history .modal-dialog,\n#history_details .modal-dialog,\n#pool .modal-dialog {\n  width: auto;\n  margin-left: 20px;\n  margin-right: 20px;\n}\n#history .modal-body > div {\n  overflow: auto;\n  max-height: calc(100vh - 164px);\n}\n#history label {\n  font-weight: normal;\n}\n.proxies-history-navigation {\n  margin-bottom: 25px;\n}\n.proxies-history-filter {\n  font-size: 11px;\n  border-bottom: 1px dashed;\n  border-color: #428bca;\n}\n.proxies-history th {\n  line-height: 15px !important;\n}\n.clickable {\n  cursor: pointer;\n}\n.proxies-history-loading {\n  padding: 4px;\n  width: 200px;\n  text-align: center;\n  position: fixed;\n  left: 50%;\n  top: 50%;\n  margin-left: -100px;\n  z-index: 2;\n}\n.proxies-history-archive {\n  float: right;\n  font-size: 11px;\n  line-height: 14px;\n  margin-top: -1px;\n  margin-bottom: -2px;\n  margin-right: 32px;\n  text-align: right;\n}\n.proxies-history-archive > span {\n  border-bottom: 1px dashed;\n  border-color: #428bca;\n  cursor: pointer;\n  text-transform: lowercase;\n}\n.zones-table td,\n.zones-table thead th {\n  text-align: right;\n}\n.zones-table td.zones-zone,\n.zones-table thead th.zones-zone {\n  text-align: left;\n}\n#zone .panel-heading {\n  position: relative;\n}\n#zone .panel-heading button {\n  position: absolute;\n  right: 5px;\n  top: 5px;\n}\n.settings-alert {\n  position: relative;\n}\n.settings-alert .buttons {\n  position: absolute;\n  right: 10px;\n  top: 9px;\n}\n.quickstart li {\n  display: block;\n  margin-bottom: 10px;\n}\n.quickstart li:before {\n  font-family: 'Glyphicons Halflings';\n  float: left;\n  margin-left: -22px;\n}\n.quickstart li:before {\n  content: '\\E092';\n}\n.quickstart li.quickstart-completed:before {\n  content: '\\E013';\n  color: green;\n}\n.quickstart li.quickstart-completed + li:not(.quickstart-completed):before,\n.quickstart li:not(.quickstart-completed):first-child:before {\n  color: red;\n}\n#version {\n  background: #f04844;\n  color: white;\n  font-size: 11px;\n  font-weight: bold;\n  padding: 0 4px;\n  border-radius: 2px;\n  position: relative;\n  top: 12px;\n  left: 4px;\n}\n.github {\n  margin-top: 12px;\n}\n#config-textarea,\n#config-textarea + .CodeMirror,\n#resolve-textarea {\n  width: 100%;\n  height: 400px;\n  margin-bottom: 18px;\n}\n.resolve-add-host {\n  margin-top: -6px;\n  margin-bottom: 18px;\n}\n#settings-page {\n  padding-top: 20px;\n}\n.confirmation-items {\n  margin-top: 11px;\n}\n.form-range {\n  width: 100%;\n}\n.form-range .form-control {\n  display: inline-block;\n  width: 48%;\n}\n.form-range .range-seperator {\n  display: inline-block;\n  width: 2%;\n  text-align: center;\n}\n.luminati-login h3 {\n  font-weight: bold;\n  margin-top: 20px;\n  margin-bottom: 20px;\n}\n.luminati-login .alert-danger {\n  color: #d00;\n}\n.luminati-login label {\n  color: #818c93;\n  font-weight: normal;\n}\n.luminati-login button {\n  margin-top: 15px;\n  font-weight: bold;\n  padding: 10px 12px;\n  background-image: -o-linear-gradient(top, #37a3eb, #2181cf);\n  background-image: -webkit-gradient(linear, left top, left bottom, from(#37a3eb), to(#2181cf));\n  background-image: -webkit-linear-gradient(top, #37a3eb, #2181cf);\n  background-image: -moz-linear-gradient(top, #37a3eb, #2181cf);\n  background-image: linear-gradient(top, #37a3eb, #2181cf);\n  border: 1px solid #1c74b3;\n  border-bottom-color: #0d5b97;\n  border-top-color: #2c8ed1;\n  box-shadow: 0 1px 0 #ddd, inset 0 1px 0 rgba(255, 255, 255, 0.2);\n  color: #fff !important;\n  text-shadow: rgba(0, 0, 0, 0.2) 0 1px 0;\n  -webkit-appearance: none;\n  -moz-appearance: none;\n  appearance: none;\n  -moz-user-select: none;\n  -webkit-user-select: none;\n  -ms-user-select: none;\n  user-select: none;\n  -webkit-tap-highlight-color: transparent;\n}\n.luminati-login button:hover:enabled {\n  background-color: #3baaf4;\n  background-image: -o-linear-gradient(top, #3baaf4, #2389dc);\n  background-image: -webkit-gradient(linear, left top, left bottom, from(#3baaf4), to(#2389dc));\n  background-image: -webkit-linear-gradient(top, #3baaf4, #2389dc);\n  background-image: -moz-linear-gradient(top, #3baaf4, #2389dc);\n  background-image: linear-gradient(top, #3baaf4, #2389dc);\n}\n.luminati-login button:active {\n  background-image: -o-linear-gradient(top, #37a3eb, #2181cf);\n  background-image: -webkit-gradient(linear, left top, left bottom, from(#37a3eb), to(#2181cf));\n  background-image: -webkit-linear-gradient(top, #37a3eb, #2181cf);\n  background-image: -moz-linear-gradient(top, #37a3eb, #2181cf);\n  background-image: linear-gradient(top, #37a3eb, #2181cf);\n}\n.luminati-login .signup {\n  color: #818c93;\n  font-size: 16.5px;\n  margin-top: 12px;\n}\n#google {\n  min-width: 300px;\n}\n#google a.google {\n  color: white;\n  display: block;\n  padding: 0;\n  margin: auto;\n  margin-top: 50px;\n  margin-bottom: 40px;\n  height: 35px;\n  font-size: 16px;\n  padding-top: 6px;\n  padding-left: 95px;\n  cursor: pointer;\n  max-width: 300px;\n  text-align: left;\n  text-decoration: none;\n  border: none;\n  position: relative;\n  white-space: nowrap;\n}\n#google a.google,\n#google a.google:hover {\n  background: url(/img/social_btns.svg) no-repeat 50% 100%;\n}\n#google a.google:focus {\n  outline: 0;\n  top: 1px;\n}\n#google a.google:hover {\n  border: none;\n  box-shadow: none;\n  border-radius: 0;\n}\n#google a.google:active {\n  top: 1px;\n}\n.panel .panel-heading button.btn.btn-ico {\n  padding: 7px;\n  border: solid 1px #c8c2bf;\n  background-color: #fcfcfc;\n  width: 35px;\n  height: 34px;\n  margin: 0 1px;\n}\n.panel .panel-heading button.btn.btn-ico img {\n  width: 100%;\n  height: 100%;\n  vertical-align: baseline;\n}\n.panel .panel-heading button.btn.btn-ico[disabled] img {\n  opacity: 0.25;\n}\n.tooltip-default .tooltip-inner {\n  max-width: 250px;\n  border: solid 1px #d8d8d8;\n  box-shadow: 0 1px 1px 0 rgba(0, 0, 0, 0.16);\n  background: #fff;\n  color: #3f505b;\n  white-space: nowrap;\n}\n.tooltip-proxy-status .tooltip-inner {\n  border: solid 1px #d8d8d8;\n  box-shadow: 0 1px 1px 0 rgba(0, 0, 0, 0.16);\n  background: #fff;\n}\n.tooltip-proxy-status.in {\n  opacity: 1;\n}\n.status-details-wrapper {\n  background: #f7f7f7;\n  font-size: 12px;\n}\n.status-details-line {\n  margin: 0 0 5px 25px;\n}\n.status-details-icon-warn {\n  vertical-align: bottom;\n  padding-bottom: 1px;\n}\n.status-details-text {\n  padding: 0 0 0 5px;\n}\n.ic-status-triangle {\n  font-size: 12px;\n  color: #979797;\n}\n.text-err {\n  color: #d8393c;\n}\n.text-ok {\n  color: #4ca16a;\n}\n.text-warn {\n  color: #f5a623;\n}\n.pointer {\n  cursor: pointer;\n}\n.opened,\n.table-hover > tbody > tr.opened:hover {\n  background-color: #d7f6ff;\n}\n.table-hover .no-hover:hover {\n  background: none;\n}\n.pull-none {\n  float: none !important;\n}\n.history__header {\n  margin-top: 10px;\n}\n.history-details__column-first {\n  width: 300px;\n}\n.modal-open .modal {\n  overflow-y: scroll;\n}\n.blue {\n  color: #4a90e2;\n}\n.pagination > li > a:hover,\n.pagination > .disabled > a:hover {\n  box-shadow: none;\n}\n.control-label.preset {\n  width: 100%;\n}\n.control-label.preset .form-control {\n  width: auto;\n  display: inline-block;\n}\ninput.form-control[type=checkbox] {\n  width: auto;\n  height: auto;\n  display: inline;\n}\n.proxies-table-input.session-edit input {\n  width: calc(100% - 2em);\n  display: inline-block;\n}\n.proxies-table-input.session-edit .btn {\n  padding: 4px;\n}\n.tabs_default:hover {\n  color: #555 !important;\n  box-shadow: none !important;\n}\n.chrome_icon {\n  width: 32px;\n  height: 32px;\n  background-image: url('img/icon_chrome.jpg');\n  background-repeat: no-repeat;\n  background-size: 32px 32px;\n  margin: auto;\n}\n.firefox_icon {\n  width: 32px;\n  height: 32px;\n  background-image: url(img/icon_firefox.jpg);\n  background-repeat: no-repeat;\n  background-size: 32px 32px;\n  margin: auto;\n}\n.safari_icon {\n  width: 32px;\n  height: 32px;\n  background-image: url(img/icon_safari.jpg);\n  background-repeat: no-repeat;\n  background-size: 32px 32px;\n  margin: auto;\n}\n.stats_row_change {\n  animation: pulse 1s;\n}\n.code_max_height {\n  max-height: 500px;\n}\n.table-fixed {\n  table-layout: fixed;\n}\n.overflow-ellipsis {\n  overflow: hidden;\n  text-overflow: ellipsis;\n}\n.page-body .messages a.custom_link:hover {\n  background: none;\n  border: none;\n  box-shadow: none;\n}\n", ""]);

// exports


/***/ }),

/***/ 87:
/***/ (function(module, exports, __webpack_require__) {

"use strict";
// LICENSE_CODE ZON ISC
 /*jslint react:true*/

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.StatusCodeTable = exports.StatusCodeRow = exports.status_codes = undefined;

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _regeneratorRuntime = __webpack_require__(31);

var _regeneratorRuntime2 = _interopRequireDefault(_regeneratorRuntime);

var _react = __webpack_require__(0);

var _react2 = _interopRequireDefault(_react);

var _reactBootstrap = __webpack_require__(33);

var _etask = __webpack_require__(40);

var _etask2 = _interopRequireDefault(_etask);

var _util = __webpack_require__(53);

var _util2 = _interopRequireDefault(_util);

var _common = __webpack_require__(54);

var _common2 = _interopRequireDefault(_common);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var E = {
    install: function install() {
        return E.sp = (0, _etask2.default)('status_codes', [function () {
            return this.wait();
        }]);
    },
    uninstall: function uninstall() {
        if (E.sp) E.sp.return();
    }
};

var status_codes = {
    200: 'Succeeded requests',
    301: 'Permanently moved to a new location',
    302: 'Temporary moved to a new location',
    303: 'See other',
    400: 'Bad request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not found',
    407: 'Proxy authentication required',
    414: 'Request-URI too long',
    500: 'Internal server error',
    502: 'Bad gateway',
    503: 'Service unavailable',
    504: 'Gateway timeout'
};

var StatusCodeRow = function (_React$Component) {
    _inherits(StatusCodeRow, _React$Component);

    function StatusCodeRow() {
        _classCallCheck(this, StatusCodeRow);

        return _possibleConstructorReturn(this, (StatusCodeRow.__proto__ || Object.getPrototypeOf(StatusCodeRow)).apply(this, arguments));
    }

    _createClass(StatusCodeRow, [{
        key: 'render',
        value: function render() {
            var tooltip = _react2.default.createElement(
                _reactBootstrap.Tooltip,
                {
                    id: 'status_code_' + this.props.stat.status_code },
                status_codes[this.props.stat.status_code] || this.props.stat.status_code
            );
            return _react2.default.createElement(
                'tr',
                null,
                _react2.default.createElement(
                    _reactBootstrap.OverlayTrigger,
                    { overlay: tooltip, placement: 'top' },
                    _react2.default.createElement(
                        'td',
                        null,
                        _react2.default.createElement(
                            'a',
                            { href: this.props.path + '/' + this.props.stat.status_code },
                            this.props.stat.status_code
                        )
                    )
                ),
                _react2.default.createElement(
                    'td',
                    { className: this.props.class_bw },
                    _util2.default.bytes_format(this.props.stat.bw)
                ),
                _react2.default.createElement(
                    'td',
                    { className: this.props.class_value },
                    this.props.stat.value
                )
            );
        }
    }]);

    return StatusCodeRow;
}(_react2.default.Component);

var StatusCodeTable = function (_React$Component2) {
    _inherits(StatusCodeTable, _React$Component2);

    function StatusCodeTable() {
        _classCallCheck(this, StatusCodeTable);

        return _possibleConstructorReturn(this, (StatusCodeTable.__proto__ || Object.getPrototypeOf(StatusCodeTable)).apply(this, arguments));
    }

    _createClass(StatusCodeTable, [{
        key: 'render',
        value: function render() {
            return _react2.default.createElement(
                _common2.default.StatTable,
                _extends({ row: StatusCodeRow, path: '/status_codes',
                    row_key: 'status_code', title: 'All status codes' }, this.props),
                _react2.default.createElement(
                    'tr',
                    null,
                    _react2.default.createElement(
                        'th',
                        null,
                        'Status Code'
                    ),
                    _react2.default.createElement(
                        'th',
                        { className: 'col-md-2' },
                        'Bandwidth'
                    ),
                    _react2.default.createElement(
                        'th',
                        { className: 'col-md-5' },
                        'Number of requests'
                    )
                )
            );
        }
    }]);

    return StatusCodeTable;
}(_react2.default.Component);

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
            E.install();
            var _this = this;
            E.sp.spawn((0, _etask2.default)(_regeneratorRuntime2.default.mark(function _callee() {
                var res;
                return _regeneratorRuntime2.default.wrap(function _callee$(_context) {
                    while (1) {
                        switch (_context.prev = _context.next) {
                            case 0:
                                _context.next = 2;
                                return _common2.default.StatsService.get_all({ sort: 1,
                                    by: 'status_code' });

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
        key: 'componentWillUnmount',
        value: function componentWillUnmount() {
            E.uninstall();
        }
    }, {
        key: 'render',
        value: function render() {
            return _react2.default.createElement(
                'div',
                null,
                _react2.default.createElement(
                    'div',
                    { className: 'page-header' },
                    _react2.default.createElement(
                        'h3',
                        null,
                        'Status codes'
                    )
                ),
                _react2.default.createElement(
                    'div',
                    { className: 'page-body' },
                    _react2.default.createElement(StatusCodeTable, { stats: this.state.stats })
                )
            );
        }
    }]);

    return Stats;
}(_react2.default.Component);

exports.status_codes = status_codes;
exports.StatusCodeRow = StatusCodeRow;
exports.StatusCodeTable = StatusCodeTable;
exports.default = Stats;

/***/ })

},[309]);