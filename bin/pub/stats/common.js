
// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true*/

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

define(['regenerator-runtime', 'lodash', 'react', 'react-dom', 'react-bootstrap', 'axios', '/util.js', 'hutil/etask', 'hutil/date', '_css!animate'], function (rr, _, React, ReactDOM, RB, axios, util, etask, date) {

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
        var _this2 = this;

        var Row = this.props.row,
            Table = RB.Table;
        return React.createElement(
          'div',
          null,
          React.createElement(
            'h4',
            null,
            this.props.title,
            false && this.props.show_more && React.createElement(
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
                return React.createElement(Row, { stat: s, key: s[_this2.props.row_key || 'key'],
                  path: _this2.props.path });
              })
            )
          )
        );
      }
    }]);

    return StatTable;
  }(React.Component);

  E.StatTable = StatTable;

  return E;
});