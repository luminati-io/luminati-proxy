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

var pads = ['', '0', '00', '000'];
function pad(num, size){
    var s = num.toString();
    return pads[size-s.length]+s;
}

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

// google sheets duration format
E.dur_to_gs_str = function(dur, opt){
    opt = opt||{};
    var parts = [];
    dur = E.round_dur(+dur, opt.precision);
    function chop(period){
        var number = Math.floor(dur/period);
        parts.push(number);
        dur -= number*period;
    }
    chop(ms.HOUR);
    chop(ms.MIN);
    var res = [''+parts[0]]
        .concat(parts.slice(1)
            .map(function(p){ return (''+p).padStart(2, '0'); }))
        .concat((dur/ms.SEC)
            .toLocaleString('en-US', {minimumIntegerDigits: 2}));
    return res.join(':');
};

E.monotonic = undefined;
var monotonic_init = function(){
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
monotonic_init();

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
    return d.getUTCFullYear()+'-'+pad(d.getUTCMonth()+1, 2)
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

E.align_up = function(d, align){
    d = E.get(d, 1);
    var mult;
    switch (align.toUpperCase())
    {
    case 'MS': break;
    case 'SEC': mult = ms.SEC; break;
    case 'MIN': mult = ms.MIN; break;
    case 'HOUR': mult = ms.HOUR; break;
    case 'DAY': mult = ms.DAY; break;
    default: throw new Error('invalid align '+align);
    }
    return new Date(Math.ceil(d/mult)*mult);
};

E.today = function(now){
    return E.align(now, 'DAY');
};

E.nth_of_month = function(now, n){
    if (n===undefined)
    {
        n = now;
        now = date_get();
    }
    var res = E.align(now, 'MONTH');
    var last_day = E.last_day_of_month(res);
    if (n<0)
        res = E.add(res, {d: last_day+n});
    else if (n>1)
        res = E.add(res, {d: n-1});
    return res;
};

E.last_day_of_month = function(month, year){
    if (year===undefined && !(Number.isFinite(month)&&month>=1&&month<=12)
        && E.is_date_like(month))
    {
        var d = date_get(month);
        month = d.getUTCMonth()+1;
        year = d.getUTCFullYear();
    }
    var ts = Date.UTC(year||2001, month, 0); // default to non-leap year
    return new Date(ts).getUTCDate();
};

E.add = function(d, dur){
    d = E.get(d, 1);
    dur = E.normalize_dur(dur);
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
        day = Math.min(day, E.last_day_of_month(month+1, year));
        d.setUTCFullYear(year, month, day);
    }
    ['day', 'hour', 'min', 'sec', 'ms'].forEach(function(k){
        if (dur[k])
            d.setTime(+d+dur[k]*ms[k.toUpperCase()]);
    });
    return d;
};

E.normalize_dur = function(dur){
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
};

E.describe_interval_parts = function(_ms, decimals){
    var rmult = Math.pow(10, decimals||0);
    if (_ms<2*ms.MIN)
        return {value: Math.round(_ms/ms.SEC*rmult)/rmult, unit: 'second'};
    if (_ms<2*ms.HOUR)
        return {value: Math.round(_ms/ms.MIN*rmult)/rmult, unit: 'minute'};
    if (_ms<2*ms.DAY)
        return {value: Math.round(_ms/ms.HOUR*rmult)/rmult, unit: 'hour'};
    if (_ms<2*ms.WEEK)
        return {value: Math.round(_ms/ms.DAY*rmult)/rmult, unit: 'day'};
    if (_ms<2*ms.MONTH)
        return {value: Math.round(_ms/ms.WEEK*rmult)/rmult, unit: 'week'};
    if (_ms<2*ms.YEAR)
        return {value: Math.round(_ms/ms.MONTH*rmult)/rmult, unit: 'month'};
    return {value: Math.round(_ms/ms.YEAR*rmult)/rmult, unit: 'year'};
};

E.describe_interval = function(_ms, decimals){
    var parts = E.describe_interval_parts(_ms, decimals);
    return parts.value+' '+parts.unit+(parts.value==1 ? '' : 's');
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
    var matched = (''+str).match(re);
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
E.apply_tz = function(d, tz, opt){
    if (!d)
        return d;
    d = E.get(d);
    tz = (tz||E.local_tz).replace(':', '');
    opt = opt||{};
    var timezone = +tz.slice(1, 3)*E.ms.HOUR+tz.slice(3, 5)*E.ms.MIN;
    var sign = tz.slice(0, 1) == '+' ? 1 : -1;
    if (opt.inverse)
        sign *= -1;
    return new Date(d.getTime()+sign*timezone);
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
    var p = {d: d, utc: utc, l: l, locale: locale, formats: formats, tz: tz};
    return format(fmt, p);
};

// Most of the specifiers supported by C's strftime, and some from Ruby.
// Some other syntax extensions from Ruby are supported: %-, %_, and %0
// to pad with nothing, space, or zero (respectively).
function format(fmt, p){
    function replacer(_, c){
        var mod, padding;
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
        return ext.hasOwnProperty(c) ? ext[c](p, padding) : c;
    }
    if ((fmt.length==2 || fmt.length==3) && fmt[0]=='%')
        return ''+replacer(fmt, fmt.slice(1));
    if (frequently_used.hasOwnProperty(fmt))
        return frequently_used[fmt](p);
    return fmt.replace(/%([-_0]?.)/g, replacer);
}

var frequently_used = {
    '%Y-%m-%d': function(p){ return ext.F(p); },
    '%Y_%m_%d': function(p){ return ext.Y(p)+'_'+ext.m(p)+'_'+ext.d(p); },
    '%Y-%m-%d %H:%M:%S': function(p){ return ext.F(p)+' '+ext.T(p); },
    '%H:%M': function(p){ return ext.R(p); },
    '%H:%M:%S': function(p){ return ext.T(p); },
    '%b-%Y': function(p){ return ext.b(p)+'-'+ext.Y(p); },
    '%d-%b': function(p){ return ext.d(p)+'-'+ext.b(p); },
    '%d-%b-%y': function(p){ return ext.d(p)+'-'+ext.b(p)+'-'+ext.y(p); },
    '%d-%b-%Y': function(p){ return ext.d(p)+'-'+ext.b(p)+'-'+ext.Y(p); },
    '%d-%m-%Y': function(p){ return ext.d(p)+'-'+ext.m(p)+'-'+ext.Y(p); },
    '%e-%b-%Y': function(p){ return ext.v(p); },
    '%B %Y': function(p){ return ext.B(p)+' '+ext.Y(p); },
    '%F %T': function(p){ return ext.F(p)+' '+ext.T(p); },
    '%F %R': function(p){ return ext.F(p)+' '+ext.R(p); },
};
var ext = {
    // Examples for new Date(0) in GMT
    A: function(p, padding){ // 'Thursday'
        return p.locale.days_long[p.l.getDay(p.d)]; },
    a: function(p, padding){ // 'Thu'
        return p.locale.days_short[p.l.getDay(p.d)]; },
    B: function(p, padding){ // 'January'
        return p.locale.months_long[p.l.getMonth(p.d)]; },
    b: function(p, padding){ // 'Jan'
        return p.locale.months_short[p.l.getMonth(p.d)]; },
    C: function(p, padding){ // '19'
        return padx(Math.floor(p.l.getFullYear(p.d)/100), padding); },
    D: function(p, padding){ // '01/01/70'
        return p.formats.D ? format(p.formats.D, p) :
            ext.m(p, padding)+'/'+
            ext.d(p, padding)+'/'+
            ext.y(p, padding);
    },
    d: function(p, padding){ // '01'
        return padx(p.l.getDate(p.d), padding); },
    e: function(p, padding){ // '01'
        return p.l.getDate(p.d); },
    F: function(p, padding){ // '1970-01-01'
        return p.formats.F ? format(p.formats.F, p) :
            ext.Y(p, padding)+'-'+
            ext.m(p, padding)+'-'+
            ext.d(p, padding);
    },
    H: function(p, padding){ // '00'
        return padx(p.l.getHours(p.d), padding); },
    h: function(p, padding){ // 'Jan'
        return p.locale.months_short[p.l.getMonth(p.d)]; },
    I: function(p, padding){ // '12'
        return padx(hours12(p.l.getHours(p.d)), padding); },
    j: function(p, padding){ // '000'
        var day = Math.ceil((+p.d-p.l.getYearBegin(p.d))/(1000*60*60*24));
        return pad(day, 3);
    },
    k: function(p, padding){ // ' 0'
        return padx(p.l.getHours(p.d), padding===undefined ? ' ' : padding); },
    L: function(p, padding){ // '000'
        return pad(p.d.getMilliseconds(), 3); },
    l: function(p, padding){ // '12'
        return padx(hours12(p.l.getHours(p.d)),
            padding===undefined ? ' ' : padding);
    },
    M: function(p, padding){ // '00'
        return padx(p.l.getMinutes(p.d), padding); },
    m: function(p, padding){ // '01'
        return padx(p.l.getMonth(p.d)+1, padding); },
    n: function(p, padding){ // '\n'
        return '\n'; },
    o: function(p, padding){ // '1st'
        return ''+p.l.getDate(p.d)+ord_str(p.l.getDate(p.d)); },
    P: function(p, padding){ // 'am'
        return (p.l.getHours(p.d)<12 ? p.locale.AM : p.locale.PM)
            .toLowerCase();
    },
    p: function(p, padding){ // 'AM'
        return p.l.getHours(p.d)<12 ? p.locale.AM : p.locale.PM; },
    R: function(p, padding){ // '00:00'
        return p.formats.R ? format(p.formats.R, p) :
            ext.H(p, padding)+':'+
            ext.M(p, padding);
    },
    r: function(p, padding){ // '12:00:00 AM'
        return p.formats.r ? format(p.formats.r, p) :
            ext.I(p, padding)+':'+
            ext.M(p, padding)+':'+
            ext.S(p, padding)+' '+
            ext.p(p, padding);
    },
    S: function(p, padding){ // '00'
        return padx(p.l.getSeconds(p.d), padding); },
    s: function(p, padding){ // '0'
        return Math.floor(+p.d/1000);
    },
    T: function(p, padding){ // '00:00:00'
        return p.formats.T ? format(p.formats.T, p) :
            ext.H(p, padding)+':'+
            ext.M(p, padding)+':'+
            ext.S(p, padding);
    },
    t: function(p, padding){ // '\t'
        return '\t'; },
    U: function(p, padding){ // '00'
        return padx(week_num(p.l, p.d, 'sunday'), padding);
    },
    u: function(p, padding){ // '4'
        var day = p.l.getDay(p.d);
        // 1 - 7, Monday is first day of the week
        return day==0 ? 7 : day;
    },
    v: function(p, padding){ // '1-Jan-1970'
        return p.formats.v ? format(p.formats.v, p) :
            ext.e(p, padding)+'-'+
            ext.b(p, padding)+'-'+
            ext.Y(p, padding);
    },
    W: function(p, padding){ // '00'
        return padx(week_num(p.l, p.d, 'monday'), padding);
    },
    w: function(p, padding){ // '4'. 0 Sunday - 6 Saturday
        return p.l.getDay(p.d); },
    Y: function(p, padding){ // '1970'
        return p.l.getFullYear(p.d); },
    y: function(p, padding){ // '70'
        return (''+p.l.getFullYear(p.d)).slice(-2); },
    Z: function(p, padding){ // 'GMT'
        if (p.utc)
            return 'GMT';
        var tz_string = p.d.toString().match(/\((\w+)\)/);
        return tz_string && tz_string[1] || '';
    },
    z: function(p, padding){ // '+0000'
        if (p.utc)
            return '+0000';
        var off = typeof p.tz=='number' ? p.tz : -p.d.getTimezoneOffset();
        return (off<0 ? '-' : '+')+pad(Math.abs(Math.trunc(off/60)), 2)+
            pad(off%60, 2);
    },
};

function hours12(hours){
    return hours==0 ? 12 : hours>12 ? hours-12 : hours;
}
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

var short_timezone_offsets = {
    AST: 'GMT-4', ADT: 'GMT-3',
    EST: 'GMT-5', EDT: 'GMT-4',
    CST: 'GMT-6', CDT: 'GMT-5',
    MST: 'GMT-7', MDT: 'GMT-6',
    PST: 'GMT-8', PDT: 'GMT-7',
    HST: 'GMT-9', HDT: 'GMT-8',
    AKST: 'GMT-10', AKDT: 'GMT-9',
};
// compatible with Date.getTimezoneOffset (which works only with current TZ)
// returns negative UTC offset (UTC+3 -> -180, UTC -> 0, UTC-2 -> 120)
// example: Israel winter timezone is IST which is UTC+2, return value is -120
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/getTimezoneOffset
E.timezone_offset = function(tz, dt){
    dt = dt || E.get();
    tz = dt.toLocaleString('en', {timeZone: tz, timeStyle: 'long'})
        .split(' ').slice(-1)[0];
    tz = short_timezone_offsets[tz] || tz;
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

var metronomes = {};
E.metronome = function(delay, cb){
    if (!metronomes.hasOwnProperty(delay))
    {
        metronomes[delay] = [];
        var t = setInterval(function(){
            metronomes[delay].forEach(function(f){ f(); });
        }, delay);
        if (is_node)
            t.unref();
        cb();
    }
    metronomes[delay].push(cb);
};

E.to_unix_secs = function(v){
    return Math.floor(+date_get(v)/E.ms.SEC);
};

// Calculates the date by incrementing the date while skipping over
// Saturdays and Sundays.
// This function does not skip holidays.
E.add_business_days = function(from, bdays){
    var res = date_get(from, true);
    var count = 0;
    var delta = bdays < 0 ? -1 : 1;
    bdays = Math.abs(bdays);
    while (count < bdays)
    {
        res.setDate(res.getDate() + delta);
        if (![0, 6].includes(res.getDay()))
            count++;
    }
    return res;
};

return E; }); }());
