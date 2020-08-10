// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, browser:true*/
(function(){
var define;
var is_node = typeof module=='object' && module.exports && module.children;
if (!is_node)
    define = self.define;
else
    define = require('./require_node.js').define(module, '../');
define([], function(){
var E = {};
var assign = Object.assign;

// Returns an array of arrays:
// [['field1', 'field2', 'field3'], ['1','2','3'], [..], ..]
E.to_arr = function(data, opt){
    opt = assign({field: ',', quote: '"', line: '\n'}, opt);
    var line = opt.line, field = opt.field, quote = opt.quote;
    var i = 0, c = data[i], row = 0, array = [];
    while (c)
    {
        while (opt.trim && (c==' ' || c=='\t' || c=='\r'))
            c = data[++i];
        var value = '';
        if (c==quote)
        {
            // value enclosed by quote
            c = data[++i];
            do {
                if (c!=quote)
                {
                    // read a regular character and go to the next character
                    value += c;
                    c = data[++i];
                }
                if (c==quote)
                {
                    // check for escaped quote
                    if (data[i+1]==quote)
                    {
                        // this is an escaped field. Add a quote
                        // to the value, and move two characters ahead.
                        value += quote;
                        i += 2;
                        c = data[i];
                    }
                }
            } while (c && (c!=quote || data[i+1]==quote));
            if (!c)
                throw 'Unexpected end of data, no closing quote found';
            c = data[++i];
        }
        else
        {
            // value not escaped with quote
            while (c && c!=field && c!=line)
            {
                value += c;
                c = data[++i];
            }
        }
        if (opt.trim)
            value = value.trim();
        // add the value to the array
        if (array.length<=row)
            array.push([]);
        array[row].push(value);
        // go to the next row or column
        if (c==field);
        else if (c==line)
            row++;
        else if (c)
            throw 'Delimiter expected after character '+i;
        c = data[++i];
    }
    if (i && data[i-1]==field)
        array[row].push('');
    return array;
};

// Returns an array of hashs:
// [{field1: '1', field2: '2', field3: '3'}, {..}, ..]
E.to_obj = function(data, opt){
    var arr = E.to_arr(data, opt);
    if (!arr.length)
        return arr;
    var i, result = [], headers = arr[0];
    if ((i = headers.indexOf(''))!=-1)
        throw new Error('Field '+i+' has unknown name');
    for (i=1; i<arr.length; i++)
    {
        var obj = {};
        if (arr[i].length > headers.length)
            throw new Error('Line '+i+' has more fields than header');
        for (var j=0; j<arr[i].length; j++)
            obj[headers[j]] = arr[i][j];
        result.push(obj);
    }
    return result;
};

E.escape_field = function(s, opt){
    // opt not fully supported
    if (s==null && opt && opt.null_to_empty)
        return '';
    if (typeof s=='object' && (!Array.isArray(s) ||
        s.some(function(e){ return typeof e=='object'; })))
    {
        s = JSON.stringify(s);
    }
    else
        s = ''+s;
    if (!/["'\n,]/.test(s))
        return s;
    return '"'+s.replace(/"/g, '""')+'"';
};

E.to_str = function(csv, opt){
    var s = '', i, j, a;
    opt = assign({field: ',', quote: '"', line: '\n'}, opt);
    var line = opt.line, field = opt.field;
    function line_to_str(vals){
        var s = '';
        for (var i=0; i<vals.length; i++)
            s += (i ? field : '')+E.escape_field(vals[i], opt);
        return s+line;
    }
    if (!csv.length && !opt.keys)
        return '';
    if (Array.isArray(csv[0]))
    {
        if (opt.keys)
            s += line_to_str(opt.keys);
        for (i=0; i<csv.length; i++)
            s += line_to_str(csv[i]);
        return s;
    }
    var keys = opt.keys || Object.keys(csv[0]);
    if (opt.print_keys===undefined || opt.print_keys)
        s += line_to_str(keys);
    for (i=0; i<csv.length; i++)
    {
        for (j=0, a=[]; j<keys.length; j++)
        {
            var v = csv[i][keys[j]];
            a.push(v===undefined ? '' : v);
        }
        s += line_to_str(a);
    }
    return s;
};

E.to_blob = function(csv, opt){
    return new Blob([E.to_str(csv, opt)], {type: 'application/csv'}); };

return E; }); }());
