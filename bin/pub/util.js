// LICENSE_CODE ZON ISC
'use strict'; /*jslint browser:true*//*global module:true*/

define([], function(){
var E = {};

E.bytes_format = function(bytes, precision){
    if (!bytes || isNaN(parseFloat(bytes)) || !isFinite(bytes))
        return '';
    var number = Math.floor(Math.log(bytes)/Math.log(1000));
    if (typeof precision==='undefined')
        precision = number ? 2 : 0;
    var number_format = Intl.NumberFormat('en-US',
        {maximumFractionDigits: precision});
    return number_format.format(bytes / Math.pow(1000, Math.floor(number)))+' '
        +['B', 'KB', 'MB', 'GB', 'TB', 'PB'][number];
};

return E; });
