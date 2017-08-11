// LICENSE_CODE ZON ISC
'use strict'; /*jslint browser:true, es6:true*/

let E = {};

E.bytes_format = (bytes, precision)=>{
    if (!bytes || isNaN(parseFloat(bytes)) || !isFinite(bytes))
        return '';
    let number = Math.floor(Math.log(bytes)/Math.log(1000));
    if (typeof precision==='undefined')
        precision = number ? 2 : 0;
    let number_format = Intl.NumberFormat('en-US',
        {maximumFractionDigits: precision});
    return number_format.format(bytes / Math.pow(1000, Math.floor(number)))+' '
        +['B', 'KB', 'MB', 'GB', 'TB', 'PB'][number];
};

let ga;
E.init_ga = _ga=>ga=_ga;

E.ga_event = (category, action, label)=>ga && ga.trackEvent(category, action,
    label, undefined, undefined, {transport: 'beacon'});

export default E;
