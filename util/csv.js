// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, browser:true*/
(function(){
var define;
var is_node = typeof module=='object' && module.exports && module.children;
if (!is_node)
    define = self.define;
else
    define = require('./require_node.js').define(module, '../');
define(['/util/util.js', '/util/array.js'], function(zutil, zarray){
var E = {};
var assign = Object.assign;

function make_csv_error(msg){
    var e = new Error(msg);
    e.code = 'csv_error';
    return e;
}

// Returns an array of arrays:
// [['field1', 'field2', 'field3'], ['1','2','3'], [..], ..]
E.to_arr = function(data, opt){
    opt = assign({field: ',', quote: '"', line: '\n'}, opt);
    var line = opt.line, field = opt.field, quote = opt.quote;
    var i = 0, c = data[i], row = 0, array = [];
    var stopped_because_of_fail = false;
    while (c)
    {
        while (opt.trim && (c==' ' || c=='\t' || c=='\r') ||
            opt.trim_cr && c=='\r')
        {
            c = data[++i];
        }
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
            {
                if (opt.return_succesful_rows)
                {
                    stopped_because_of_fail = true;
                    break;
                }
                else
                {
                    throw make_csv_error(
                        'Unexpected end of data, no closing quote found');
                }
            }
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
        {
            value = value.trim();
            if (c=='\r')
                c = data[++i];
        }
        if (opt.trim_cr)
        {
            value = value.replace(/\r+$/, '');
            if (c=='\r')
                c = data[++i];
        }
        // add the value to the array
        if (array.length<=row)
            array.push([]);
        array[row].push(value);
        // go to the next row or column
        if (c==field);
        else if (c==line)
            row++;
        else if (c)
            throw make_csv_error('Delimiter expected after character '+i);
        c = data[++i];
    }
    if (i && data[i-1]==field)
        array[row].push('');
    if (stopped_because_of_fail)
        array.pop();
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
        throw make_csv_error('Headers row-Missing column name for field ' + i);
    for (i=1; i<arr.length; i++)
    {
        var obj = {};
        if (arr[i].length > headers.length)
            throw make_csv_error('Line '+i+' has more fields than header');
        for (var j=0; j<arr[i].length; j++)
            obj[headers[j]] = arr[i][j];
        result.push(obj);
    }
    return result;
};

function is_complex(v){
    return v && typeof v=='object' && (!Array.isArray(v) ||
        v.some(function(e){ return typeof e=='object'; }));
}

E.escape_field = function(v, opt){
    // opt not fully supported
    if (v==null && opt && opt.null_to_empty)
        return '';
    if (is_complex(v))
        v = JSON.stringify(v);
    else
    {
        v = ''+v;
        if (opt && opt.escape_replace)
        {
            v = v
                .replace(new RegExp(opt.field||',', 'g'), '.')
                .replace(/"/g, "'")
                .replace(/\s+/g, ' ');
        }
    }
    var quote_needed = opt && opt.quote_needed || /["'\n,]/.test(v) ||
        opt && opt.quote_spaces && v && v.includes(' ');
    return quote_needed ? '"'+v.replace(/"/g, '""')+'"' : v;
};

function flatten(obj, opt, keys){
    var key_set = [], k;
    for (var i = 0; i < keys.length; i++)
    {
        k = keys[i];
        if (is_complex(obj[k]))
        {
            _get_flatenned_keys(obj[k], opt)
                .forEach(function(h){ key_set.push(k+opt.splitter+h); });
        }
        else
            key_set.push(k);
    }
    return zarray.unique(key_set);
}

function _get_flatenned_keys(obj, opt, keys){
    keys = keys || Object.keys(obj);
    if (Array.isArray(obj))
    {
        var key_set = [];
        for (var i = 0; i < obj.length; i++)
        {
            if (!zutil.is_object(obj[i]))
                continue;
            flatten(obj[i], opt, Object.keys(obj[i])).forEach(
                function(el){ key_set.push(el); });
        }
        return zarray.unique(key_set).reduce(function(_keys, k){
            for (var j = 0; j < obj.length; j++)
                _keys.push(j+opt.splitter+k);
            return _keys;
        }, []);
    }
    return flatten(obj, opt, keys);
}

function get_flatenned_keys(dataset, opt, keys){
    var keymap = {}, i;
    for (i = 0; i<dataset.length; i++)
    {
        var _keys = _get_flatenned_keys(dataset[i], opt, keys);
        for (var j = 0; j<_keys.length; j++)
            keymap[_keys[j]] = true;
    }
    var arr = Object.keys(keymap);
    // XXX josh/gabriel: this should be grouping same prefix keys, not sorting
    arr.sort();
    // Removes keys where value is considered non-complex due to being an empty
    // array but, in reality, it is complex in other entries
    for (i = 0; i < arr.length-1; i++)
    {
        var k1 = arr[i], k2 = arr[i+1];
        if (!k2.startsWith(k1+opt.splitter))
            continue;
        if (dataset.every(function(d){
            var v = get_value(d, k1, opt);
            return is_complex(v) || Array.isArray(v) && !v.length;
        }))
        {
            arr = arr.filter(function(k){ return k!=k1; });
        }
    }
    return arr;
}

function generate_keys(dataset, opt){
    var keys;
    if (!opt.keys)
        keys = Object.keys(dataset[0]);
    else if (opt.keys=='auto')
    {
        var keymap = {};
        for (var i = 0; i<dataset.length; i++)
        {
            for (var j = 0, fields = Object.keys(dataset[i]); j<fields.length;
                j++)
            {
                keymap[fields[j]] = true;
            }
        }
        keys = Object.keys(keymap);
    }
    else
        keys = opt.keys;
    return opt.flatten ? get_flatenned_keys(dataset, opt, keys) : keys;
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
        var _s = '';
        for (var k=0; k<vals.length; k++)
            _s += (k ? field : '')+E.escape_field(vals[k], opt);
        return _s+line;
    }
    if (!csv.length && (!opt.keys || opt.keys=='auto'))
        return '';
    if (Array.isArray(csv[0]) && !opt.flatten)
    {
        if (opt.keys)
            s += line_to_str(opt.keys);
        for (i=0; i<csv.length; i++)
            s += line_to_str(csv[i]);
        return s;
    }
    var keys = generate_keys(csv, opt);
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
