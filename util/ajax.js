// LICENSE_CODE ZON ISC
'use strict'; /*zlint node, br*/
(function(){
var define;
var is_node_ff = typeof module=='object' && module.exports;
if (!is_node_ff)
    define = self.define;
else
    define = require('./require_node.js').define(module, '../');
define(['jquery', '/util/etask.js', '/util/date.js', '/util/escape.js',
    '/util/zerr.js', 'events'],
    function($, etask, date, zescape, zerr, events){
var E = ajax;
var assign = Object.assign;
E.events = new events.EventEmitter();
E.json = function(opt){ return ajax(assign({}, opt, {json: 1})); };
E.abort = function(aj){ aj.goto('abort'); };
// XXX arik: need test
function ajax(opt){
    var timeout = opt.timeout||20*date.ms.SEC, slow = opt.slow||2*date.ms.SEC;
    var retry = opt.retry, data = opt.data, qs = zescape.qs(opt.qs);
    var url = zescape.uri(opt.url, qs), perr = opt.perr;
    // opt.type is deprecated
    var method = opt.method||opt.type||'GET';
    var data_type = opt.json ? 'json' : 'text';
    var t0 = Date.now();
    var xhr;
    zerr.debug('ajax('+data_type+') url '+url+' retry '+retry);
    return etask([function(){
        var ajopt = {dataType: data_type, type: method, url: url,
            data: data, timeout: timeout, xhrFields: {}};
        if (opt.headers)
            ajopt.headers = opt.headers;
        if (opt.content_type)
            ajopt.contentType = opt.content_type;
        if (opt.with_credentials)
            ajopt.xhrFields.withCredentials = true;
        if (opt.onprogress)
            ajopt.xhrFields.onprogress = opt.onprogress;
        if (opt.onuploadprogress)
        {
            ajopt.xhr = function(){
                var _xhr = $.ajaxSettings.xhr();
                _xhr.upload.onprogress = opt.onuploadprogress;
                return _xhr;
            };
        }
        if (opt.multipart)
        {
            ajopt.contentType = false;
            ajopt.processData = false;
            delete ajopt.dataType;
        }
        xhr = $.ajax(ajopt);
        var _this = this;
        xhr.done(function(v){
            _this.continue(v); });
        xhr.fail(function(_xhr, status_text, err){
            if (data_type=='json' && _xhr.status==200 &&
                ['', 'ok', 'OK'].includes(_xhr.responseText))
            {
                _this.continue(null);
                return;
            }
            _this.throw(err instanceof Error ? err : new Error(''+err));
        });
        return this.wait();
    }, function catch$(err){
        zerr('ajax('+data_type+') failed url '+url+' data '+
            zerr.json(data).substr(0, 200)+' status: '+xhr.status+' '+
            xhr.statusText+'\nresponseText: '+
            (xhr.responseText||'').substr(0, 200));
        if (retry && (!opt.should_retry||opt.should_retry(err, xhr)))
            return this.return(ajax(assign({}, opt, {retry: retry-1})));
        if (xhr.statusText=='timeout')
            E.events.emit('timeout', this);
        if (opt.no_throw)
        {
            return {
                err: err,
                url: url,
                method: method,
                status: +xhr.status || 0,
                data: get_res_data(xhr),
                xhr: xhr,
                // legacy
                error: xhr.statusText||'no_status', message: xhr.responseText,
            };
        }
        err.hola_info = {url: url, method: method, status: xhr.status,
            data: get_res_data(xhr), response_text: xhr.responseText};
        err.x_error = xhr.getResponseHeader('X-Luminati-Error') ||
            xhr.getResponseHeader('X-Hola-Error');
        throw err;
    }, function(data){
        var t = Date.now()-t0;
        zerr[t>slow ? 'err' : 'debug'](
            'ajax('+data_type+') '+(t>slow ? 'SLOW ' : 'ok ')+t+'ms url '+url);
        if (t>slow && perr)
            perr({id: 'be_ajax_slow', info: t+'ms '+url});
        if (E.do_op)
            E.do_op(data&&data.do_op);
        return this.return(data);
    }, function abort(){
        // reachable only via E.abort
        xhr.abort();
    }]);
}

['GET', 'POST', 'PUT', 'DELETE'].forEach(function(m){
    E[m.toLowerCase()] = function(url, opt){
        url = typeof url=='string' ? {url: url} : url;
        opt = assign({method: m, json: 1}, url, opt);
        if (!{get: 1, delete: 1}[opt.method.toLowerCase()]
            && opt.data!=null && typeof opt.data!='string')
        {
            opt.content_type = opt.content_type||'application/json';
            if (opt.content_type.startsWith('application/json'))
                opt.data = JSON.stringify(opt.data);
        }
        return ajax(opt);
    };
});

function get_res_data(xhr){
    if (xhr.responseJSON!=null && xhr.responseJSON!=='')
        return xhr.responseJSON;
    var content_type = xhr.getResponseHeader('content-type')||'';
    if (xhr.responseText && content_type.includes('application/json'))
    {
        try { return JSON.parse(xhr.responseText); }
        catch(e){ }
    }
    return xhr.responseText||'';
}

return E; }); }());
