// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, browser:true*/
(function(){
var define;
var is_node = typeof module=='object' && module.exports && module.children;
var is_node_ff = typeof module=='object' && module.exports;
if (!is_node_ff)
    define = self.define;
else
    define = require('./require_node.js').define(module, '../');
define([], function(){
var E = date_get;

E.sec = {
    NANO: 1e-9,
    MICRO: 1e-6,
    MS: 1e-3,
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

function pad(num, size){ return ('000'+num).slice(-size); }

E.ms_to_dur = function(_ms){
    var s = '', sec = Math.floor(_ms/1000);
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

E.round_dur = function(dur, precision){
    return !precision ? Math.round(dur) : precision*Math.round(dur/precision);
};

E.dur_to_str = function(dur, opt){
    opt = opt||{};
    var parts = [];
    dur = E.round_dur(+dur, opt.precision);
    function chop(period, name){
        if (dur<period)
            return;
        var number = Math.floor(dur/period);
        parts.push(number+name);
        dur -= number*period;
    }
    chop(ms.YEAR, 'y');
    chop(ms.MONTH, 'mo');
    if (opt.week)
        chop(ms.WEEK, 'w');
    chop(ms.DAY, 'd');
    chop(ms.HOUR, 'h');
    chop(ms.MIN, 'min');
    chop(ms.SEC, 's');
    if (dur)
        parts.push(dur+'ms');
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
        var now_fn = function(){
            var data = process.hrtime();
            var seconds = data[0], nanos = data[1];
            return Math.floor(seconds * E.ms.SEC + nanos * E.ms.NANO);
        };
        adjust = Date.now()-now_fn();
        E.monotonic = function(){ return now_fn()+adjust; };
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
        +'(([0-9]+)s(ec|econds?)?)?(([0-9]+)ms(ec)?)?$', 'i'));
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
var days_long_lc = E.days_long.map(function(d){ return d.toLowerCase(); });
E.locale = {months_long: E.months_long, months_short: E.months_short,
    days_long: E.days_long, days_short: E.days_short, AM: 'AM', PM: 'PM'};
E.get = date_get;
function date_get(d, _new){
    var y, mon, day, H, M, S, _ms;
    if (d==null)
        return new Date();
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

E.is_valid = function(d){ return d instanceof Date && !isNaN(d); };

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
E.to_month_long = function(d){
    d = E.get(d);
    return E.months_long[d.getUTCMonth()];
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

E.add = function(d, dur){
    d = E.get(d, 1);
    dur = normalize_dur(dur);
    // manual handling, because of '31-Jan + 1 month'
    // we are doing same as: momentjs, C# DateTime, Excel EDATE, R Lubridate
    // see: https://lubridate.tidyverse.org/reference/mplus.html
    if (dur.year || dur.month)
    {
        var year = d.getUTCFullYear() + (dur.year||0);
        var month = d.getUTCMonth() + (dur.month||0);
        var day = d.getUTCDate();
        while (month<0)
        {
            year--;
            month += 12;
        }
        while (month>=12)
        {
            year++;
            month -= 12;
        }
        day = Math.min(day, last_day_of_month(month, year));
        d.setUTCFullYear(year, month, day);
    }
    ['day', 'hour', 'min', 'sec', 'ms'].forEach(function(k){
        if (dur[k])
            d.setTime(+d+dur[k]*ms[k.toUpperCase()]);
    });
    return d;
};

function normalize_dur(dur){
    var aliases = {
        years: 'year', months: 'month', days: 'day',
        hours: 'hour', minutes: 'min', seconds: 'sec',
        minute: 'min', mins: 'min', second: 'sec', secs: 'sec',
        y: 'year', mo: 'month', d: 'day', h: 'hour', m: 'min', s: 'sec',
    };
    var norm = {};
    for (var k in dur)
        norm[aliases[k]||k] = dur[k];
    return norm;
}

function last_day_of_month(month, year){
    var ts = Date.UTC(year||2001, month+1, 0); // default to non-leap year
    return new Date(ts).getUTCDate();
}

E.describe_interval = function(_ms, decimals){
    var rmult = Math.pow(10, decimals||0);
    return _ms<2*ms.MIN ? Math.round(_ms/ms.SEC*rmult)/rmult+' sec' :
        _ms<2*ms.HOUR ? Math.round(_ms/ms.MIN*rmult)/rmult+' min' :
        _ms<2*ms.DAY ? Math.round(_ms/ms.HOUR*rmult)/rmult+' hours' :
        _ms<2*ms.WEEK ? Math.round(_ms/ms.DAY*rmult)/rmult+' days' :
        _ms<2*ms.MONTH ? Math.round(_ms/ms.WEEK*rmult)/rmult+' weeks' :
        _ms<2*ms.YEAR ? Math.round(_ms/ms.MONTH*rmult)/rmult+' months' :
        Math.round(_ms/ms.YEAR*rmult)/rmult+' years';
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
        else if ((_v = days_long_lc.indexOf(v))>=0)
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
        B: ['[a-z]+', function(m){ d.setUTCMonth(month(m)); }, 2],
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
            d = new Date(+d-timezone*1000);
        }, 8],
        Z: ['[a-z]{0,3}[+-][0-9]{2}:?[0-9]{2}|[a-z]{1,3}', function(m){
            m = /^([a-z]{0,3})(?:([+-][0-9]{2}):?([0-9]{2}))?$/i.exec(m);
            if (m[1]=='Z' || m[1]=='UTC')
                return;
            var timezone = +m[2]*3600+m[3]*60;
            d = new Date(+d-timezone*1000);
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

// tz in format shh:mm (for exmpl +01:00, -03:45)
E.apply_tz = function(date, tz, opt){
    if (!date)
        return date;
    date = E.get(date);
    tz = (tz||E.local_tz).replace(':', '');
    opt = opt||{};
    var timezone = +tz.slice(1, 3)*E.ms.HOUR+tz.slice(3, 5)*E.ms.MIN;
    var sign = tz.slice(0, 1) == '+' ? 1 : -1;
    if (opt.inverse)
        sign *= -1;
    return new Date(date.getTime()+sign*timezone);
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
    function week_num(l, _d, first_weekday){
        // This works by shifting the weekday back by one day if we
        // are treating Monday as the first day of the week.
        var wday = l.getDay(_d);
        if (first_weekday=='monday')
            wday = wday==0 /* Sunday */ ? wday = 6 : wday-1;
        var yday = (_d-l.getYearBegin(_d))/ms.DAY;
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
    function replace(_fmt){ return _fmt.replace(/%([-_0]?.)/g, function(_, c){
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
            return (off<0 ? '-' : '+')+pad(Math.abs(Math.trunc(off/60)), 2)+
                pad(off%60, 2);
        default: return c;
        }
    }); }
    return replace(fmt);
};

E.local_tz = E.strftime('%z', E.get(), {utc: false});

// For a string like '11:00-23:30', returns a function that checks whether a
// given date (moment in time) belongs to the set.
// Syntax notes:
// * ':00' is optional: '11-23'
// * several intervals: '12-14 16-18'
// * '10-12' includes exact 10:00 but excludes exact 12:00
// * 24:00 is the same as 0:00, 25:00 is the same as 1:00, etc
// * intervals wrap around midnight: '23-7' is the same as '23-24 0-7'
// * therefore, '0-0' and '0-24' include all times
// * all times are assumed in UTC
E.compile_schedule = function(expr){
    var re = /^(\d\d?)(?::(\d\d?))?-(\d\d?)(?::(\d\d?))?$/;
    var parts = expr.split(/\s+/);
    var intervals = [];
    for (var i = 0; i<parts.length; i++)
    {
        if (!parts[i])
            continue;
        var m = re.exec(parts[i]);
        if (!m)
            throw new Error('Schedule syntax error: '+expr);
        var from = m[1]*ms.HOUR, to = m[3]*ms.HOUR;
        if (m[2])
            from += m[2]*ms.MIN;
        if (m[4])
            to += m[4]*ms.MIN;
        intervals.push({from: from%ms.DAY, to: to%ms.DAY});
    }
    return function(d){
        var t = E.get(d) % ms.DAY;
        for (var j = 0; j<intervals.length; j++)
        {
            var interval = intervals[j];
            if (interval.from<interval.to)
            {
                if (t>=interval.from && t<interval.to)
                    return true;
            }
            else
            {
                if (t<interval.to || t>=interval.from)
                    return true;
            }
        }
        return false;
    };
};

E.timezone_offset = function(tz, dt){
    dt = dt || E.get();
    tz = dt.toLocaleString('en', {timeZone: tz, timeStyle: 'long'})
    .split(' ').slice(-1)[0];
    var dt_str = dt.toString();
    var offset = Date.parse(dt_str+' '+tz)-Date.parse(dt_str+' UTC');
    return offset/ms.MIN;
};

E.min = function(v1, v2){
    var min;
    for (var i=0; i<arguments.length; i++)
    {
        var v = arguments[i];
        if (!E.is_date_like(v))
            continue;
        v = date_get(v);
        if (min==null || v<min)
            min = v;
    }
    return min;
};

E.max = function(v1, v2){
    var max;
    for (var i=0; i<arguments.length; i++)
    {
        var v = arguments[i];
        if (!E.is_date_like(v))
            continue;
        v = date_get(v);
        if (max==null || v>max)
            max = v;
    }
    return max;
};

E.is_date_like = function(v){
    if (v instanceof Date)
        return true;
    if (Number.isFinite(v))
        return true;
    if (typeof v=='string')
    {
        return date_like_regexes.some(function(re){ return re.test(v); })
            && Number.isFinite(Date.parse(v));
    }
    return false;
};
var date_like_regexes = [
    /^\d{2}(\d{2})?[ /-](\d{2}|[a-z]{3,10})[ /-]\d{2}/i, // yy(yy)?-mm-dd
    /^\d{2}[ /-](\d{2}|[a-z]{3,10})[ /-]\d{2}(\d{2})?/i, // dd-mm-yy(yy)?
    /^(\d{2}|[a-z]{3,10})[ /-]\d{2}[ /-]\d{2}(\d{2})?/i, // mm-dd-yy(yy)?
];

return E; }); }());
