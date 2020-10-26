// LICENSE_CODE ZON
'use strict'; /*jslint browser:true, es6:true, react:true*/

const qw = ([str])=>str.split(/\s+/);
const proto_keys = qw`toJSON getYear getMonth getHours getMinutes getUTCDay
    getSeconds getUTCMonth getFullYear getUTCHours toString getUTCFullYear
    getMilliseconds getUTCMilliseconds getUTCDay toLocaleTimeString getDate
    toLocaleDateString toISOString toUTCString toTimeString toDateString
    getUTCSeconds getUTCMinutes toLocaleString getUTCDate getDay
    getTimezoneOffset`;

const inject = ({timezone_id, offset, keys})=>{
    const to_gmt = num=>{
        const format = v=>(v<10 ? '0' : '')+v;
        const hours = format(Math.abs(num)/60|0);
        const mins = format(Math.abs(num)%60);
        const sign = {'1': '-', '0': '+', '-1': '+'}[Math.sign(num)];
        return sign+hours+mins;
    };
    const format_name = ()=>{
        const intl_str = Intl.DateTimeFormat({}, {timeStyle: 'full',
            timeZone: timezone_id}).format();
        return intl_str.match(/(?:AM|PM)\s(.*?)$/)[1];
    };
    const Intl_ctor = Intl.DateTimeFormat;
    Intl.DateTimeFormat = function(locales, opt={}){
        Object.assign(opt, {timeZone: timezone_id});
        return Intl_ctor(locales, opt);
    };
    Intl.DateTimeFormat.prototype = Object.create(Intl_ctor.prototype);
    Intl.DateTimeFormat.supportedLocalesOf = Intl_ctor.supportedLocalesOf;
    const {getTimezoneOffset, toString, ...get_methods} = Object.fromEntries(
        keys.flatMap(k=>Date.prototype[k] ? [[k, Date.prototype[k]]] : []));
    const defineProperty = Object.defineProperty.bind(Object);
    defineProperty(Date.prototype, '_offset', {
        configurable: true,
        get(){ return getTimezoneOffset.call(this); },
    });
    defineProperty(Date.prototype, '_date', {
        configurable: true,
        get(){
            return new Date(this.getTime()+(this._offset-offset)*60*1000);
        },
    });
    Object.entries(get_methods).forEach(([prop, fn])=>{
        defineProperty(Date.prototype, prop, {
            value(){ return fn.call(this._date); },
        });
    });
    defineProperty(Date.prototype, 'getTimezoneOffset', {value: ()=>+offset});
    defineProperty(Date.prototype, 'toString', {
        value(){
            const gmt_from = to_gmt(this._offset);
            const gmt_to = to_gmt(offset);
            return toString.call(this._date).replace(gmt_from, gmt_to)
                .replace(/\(.*\)/, `(${format_name()})`);
        },
    });
};

const script = document.createElement('script');
// eslint-disable-next-line
const args = JSON.stringify({...timezone_opt, keys: proto_keys});
script.textContent = `(${inject})(${args});`;
document.documentElement.appendChild(script).remove();
