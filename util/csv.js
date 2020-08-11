// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, browser:true*/
(function(){
var define;
var is_node = typeof module=='object' && module.exports && module.children;
if (!is_node)
    define = self.define;
else
    define = require('./require_node.js').define(module, '../');
define(['/util/util.js'], function(zutil){
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

function is_complex(v){
    return typeof v=='object' && (!Array.isArray(v) ||
        v.some(function(e){ return typeof e=='object'; }));
}

E.escape_field = function(v, opt){
    // opt not fully supported
    if (v==null && opt && opt.null_to_empty)
        return '';
    if (is_complex(v))
        v = JSON.stringify(v);
    else
        v = ''+v;
    if (!/["'\n,]/.test(v))
        return v;
    return '"'+v.replace(/"/g, '""')+'"';
};

// Note that, since we only take the first value into consideration to generate
// keys, if there are other entries with different complex fields, those will
// not be flattened. A consistent structure must be ensured when flatten==true
function generate_keys(obj, opt){
    var keys = opt.keys || Object.keys(obj);
    if (!opt.flatten)
        return keys;
    return keys.reduce(function(arr, k){
        if (is_complex(obj[k]))
        {
            arr = arr.concat(generate_keys(obj[k], zutil.omit(opt, 'keys'))
                .map(function(h){ return k+opt.splitter+h; }));
        }
        else
            arr.push(k);
        return arr;
    }, []);
}

function get_value(obj, key, opt){
    if (obj.hasOwnProperty(key))
        return obj[key];
    return key.split(opt.splitter).reduce(
        function(acc, v){ return acc&&acc[v]; }, obj);
}

E.to_str = function(csv, opt){
    var s = '', i, j, a;
    opt = assign({field: ',', quote: '"', line: '\n', splitter: '$$'}, opt);
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
    var keys = generate_keys(csv[0], opt);
    if (opt.print_keys===undefined || opt.print_keys)
    {
        s += line_to_str(keys.map(function(k){
            var parts = k.split(opt.splitter);
            return parts.map(function(p){
                // indexes start at 1
                if (Number.isFinite(+p))
                    p = +p+1;
                return p;
            }).join('_');
        }));
    }
    for (i=0; i<csv.length; i++)
    {
        for (j=0, a=[]; j<keys.length; j++)
        {
            var v = get_value(csv[i], keys[j], opt);
            a.push(v===undefined ? '' : v);
        }
        s += line_to_str(a);
    }
    return s;
};

E.to_blob = function(csv, opt){
    return new Blob([E.to_str(csv, opt)], {type: 'application/csv'}); };

return E; }); }());
