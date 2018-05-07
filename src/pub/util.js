// LICENSE_CODE ZON ISC
'use strict'; /*jslint browser:true, es6:true*/

let E = {};

E.bytes_format = (bytes, precision)=>{
    if (!bytes||isNaN(parseFloat(bytes))||!isFinite(bytes))
        return '';
    let number = Math.floor(Math.log(bytes)/Math.log(1000));
    if (typeof precision==='undefined')
        precision = number ? 2 : 0;
    let number_format = Intl.NumberFormat('en-US',
        {maximumFractionDigits: precision});
    return number_format.format(bytes/Math.pow(1000, Math.floor(number)))+' '
        +['B', 'KB', 'MB', 'GB', 'TB', 'PB'][number];
};

E.ga_event = (category, action, label)=>{
    if (!window.ga)
        return;
    window.ga('send', 'event', category, action, label);
};

export default E;
