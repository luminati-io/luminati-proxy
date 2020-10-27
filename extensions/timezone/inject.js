/*jslint skip_file:true*/
// taken from https://github.com/joue-quroi/spoof-timezone
'use strict';

const prefs = `
  Date.prefs = Date.prefs || [
    'Etc/GMT', 0, new Date().getTimezoneOffset(), 'London Standard Time'
  ];
  try { // get preferences for subframes synchronously
    Date.prefs = window.parent.Date.prefs;
  }
  catch (e) {}
`;

const intl = `
  const ODateTimeFormat = Intl.DateTimeFormat;
  Intl.DateTimeFormat = function(locales, options = {}) {
    Object.assign(options, {
      timeZone: Date.prefs[0]
    });
    return ODateTimeFormat(locales, options);
  };
  Intl.DateTimeFormat.prototype = Object.create(ODateTimeFormat.prototype);
  Intl.DateTimeFormat.supportedLocalesOf = ODateTimeFormat.supportedLocalesOf;
`;

const shiftedDate = `
  const clean = str => {
    const toGMT = offset => {
      const z = n => (n < 10 ? '0' : '') + n;
      const sign = offset <= 0 ? '+' : '-';
      offset = Math.abs(offset);
      return sign + z(offset / 60 | 0) + z(offset % 60);
    };
    const name = ()=>{
      const intl_str = Intl.DateTimeFormat({}, {timeStyle: 'full',
        timeZone: Date.prefs[0]}).format();
      return intl_str.match(/(?:AM|PM)\\s(.*?)$/)[1];
    };
    str = str.replace(/([T\\(])[\\+-]\\d+/g, '$1' + toGMT(Date.prefs[1]));
    if (str.indexOf(' (') !== -1) {
      str = str.split(' (')[0] + ' (' + name() + ')';
    }
    return str;
  }
  const ODate = Date;
  const {
    getTime, getDate, getDay, getFullYear, getHours, getMilliseconds, getMinutes, getMonth, getSeconds, getYear,
    toDateString, toLocaleString, toString, toTimeString, toLocaleTimeString, toLocaleDateString,
    setYear, setHours, setTime, setFullYear, setMilliseconds, setMinutes, setMonth, setSeconds, setDate,
    setUTCDate, setUTCFullYear, setUTCHours, setUTCMilliseconds, setUTCMinutes, setUTCMonth, setUTCSeconds
  } = ODate.prototype;
  class ShiftedDate extends ODate {
    constructor(...args) {
      super(...args);
      this.nd = new ODate(
        getTime.apply(this) + (Date.prefs[2] - Date.prefs[1]) * 60 * 1000
      );
    }
    // get
    toLocaleString(...args) {
      return toLocaleString.apply(this.nd, args);
    }
    toLocaleTimeString(...args) {
      return toLocaleTimeString.apply(this.nd, args);
    }
    toLocaleDateString(...args) {
      return toLocaleDateString.apply(this.nd, args);
    }
    toDateString(...args) {
      return toDateString.apply(this.nd, args);
    }
    getDate(...args) {
      return getDate.apply(this.nd, args);
    }
    getDay(...args) {
      return getDay.apply(this.nd, args);
    }
    getFullYear(...args) {
      return getFullYear.apply(this.nd, args);
    }
    getHours(...args) {
      return getHours.apply(this.nd, args);
    }
    getMilliseconds(...args) {
      return getMilliseconds.apply(this.nd, args);
    }
    getMinutes(...args) {
      return getMinutes.apply(this.nd, args);
    }
    getMonth(...args) {
      return getMonth.apply(this.nd, args);
    }
    getSeconds(...args) {
      return getSeconds.apply(this.nd, args);
    }
    getYear(...args) {
      return getYear.apply(this.nd, args);
    }
    // set
    setHours(...args) {
      const a = getTime.call(this.nd);
      const b = setHours.apply(this.nd, args);
      setTime.call(this, getTime.call(this) + b - a);
      return b;
    }
    setFullYear(...args) {
      const a = getTime.call(this.nd);
      const b = setFullYear.apply(this.nd, args);
      setTime.call(this, getTime.call(this) + b - a);
      return b;
    }
    setMilliseconds(...args) {
      const a = getTime.call(this.nd);
      const b = setMilliseconds.apply(this.nd, args);
      setTime.call(this, getTime.call(this) + b - a);
      return b;
    }
    setMinutes(...args) {
      const a = getTime.call(this.nd);
      const b = setMinutes.apply(this.nd, args);
      setTime.call(this, getTime.call(this) + b - a);
      return b;
    }
    setMonth(...args) {
      const a = getTime.call(this.nd);
      const b = setMonth.apply(this.nd, args);
      setTime.call(this, getTime.call(this) + b - a);
      return b;
    }
    setSeconds(...args) {
      const a = getTime.call(this.nd);
      const b = setSeconds.apply(this.nd, args);
      setTime.call(this, getTime.call(this) + b - a);
      return b;
    }
    setDate(...args) {
      const a = getTime.call(this.nd);
      const b = setDate.apply(this.nd, args);
      setTime.call(this, getTime.call(this) + b - a);
      return b;
    }
    setYear(...args) {
      const a = getTime.call(this.nd);
      const b = setYear.apply(this.nd, args);
      setTime.call(this, getTime.call(this) + b - a);
      return b;
    }
    setTime(...args) {
      const a = getTime.call(this);
      const b = setTime.apply(this, args);
      setTime.call(this.nd, getTime.call(this.nd) + b - a);
      return b;
    }
    setUTCDate(...args) {
      const a = getTime.call(this);
      const b = setUTCDate.apply(this, args);
      setTime.call(this.nd, getTime.call(this.nd) + b - a);
      return b;
    }
    setUTCFullYear(...args) {
      const a = getTime.call(this);
      const b = setUTCFullYear.apply(this, args);
      setTime.call(this.nd, getTime.call(this.nd) + b - a);
      return b;
    }
    setUTCHours(...args) {
      const a = getTime.call(this);
      const b = setUTCHours.apply(this, args);
      setTime.call(this.nd, getTime.call(this.nd) + b - a);
      return b;
    }
    setUTCMilliseconds(...args) {
      const a = getTime.call(this);
      const b = setUTCMilliseconds.apply(this, args);
      setTime.call(this.nd, getTime.call(this.nd) + b - a);
      return b;
    }
    setUTCMinutes(...args) {
      const a = getTime.call(this);
      const b = setUTCMinutes.apply(this, args);
      setTime.call(this.nd, getTime.call(this.nd) + b - a);
      return b;
    }
    setUTCMonth(...args) {
      const a = getTime.call(this);
      const b = setUTCMonth.apply(this, args);
      setTime.call(this.nd, getTime.call(this.nd) + b - a);
      return b;
    }
    setUTCSeconds(...args) {
      const a = getTime.call(this);
      const b = setUTCSeconds.apply(this, args);
      setTime.call(this.nd, getTime.call(this.nd) + b - a);
      return b;
    }
    // toString
    toString(...args) {
      return clean(toString.apply(this.nd, args));
    }
    toTimeString(...args) {
      return clean(toTimeString.apply(this.nd, args));
    }
    // offset
    getTimezoneOffset() {
      return Date.prefs[1];
    }
  }
`;

const script = document.createElement('script');
script.textContent = `{
  ${prefs}
  ${intl}
  ${shiftedDate}
  Date = ShiftedDate;
}`;
document.documentElement.appendChild(script);
script.remove();

