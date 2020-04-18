// LICENSE_CODE ZON ISC
'use strict'; /*jslint browser:true, es6:true*/

import user_agent_gen from '/www/util/pub/user_agent_gen.js';
import etask from '../../util/etask.js';

export const bytes_format = (bytes, number)=>{
    if (!bytes||isNaN(parseFloat(bytes))||!isFinite(bytes))
        return '';
    number = number!=undefined ?
        number : Math.floor(Math.log(bytes)/Math.log(1000));
    const precision = number ? 2 : 0;
    let n = (bytes/Math.pow(1000, Math.floor(number))).toFixed(precision);
    if (+n===0)
        n = 0;
    return n+' '+['B', 'KB', 'MB', 'GB', 'TB', 'PB'][number];
};

export const formatted_user_agents = user_agent_gen.map(u=>({
    key: u.name,
    value: u.value,
}));

export const status_codes = {
    101: 'Switching Protocols',
    200: 'OK',
    201: 'Created',
    202: 'Accepted',
    203: 'Non-Authoritative Information',
    204: 'No Content',
    205: 'Reset Content',
    206: 'Partial Content',
    300: 'Multiple Choices',
    301: 'Moved Permanently',
    302: 'Found',
    303: 'See Other',
    304: 'Not Modified',
    305: 'Use Proxy',
    307: 'Temporary Redirect',
    400: 'Bad Request',
    401: 'Unauthorized',
    402: 'Payment Required',
    403: 'Forbidden',
    404: 'Not Found',
    405: 'Method Not Allowed',
    406: 'Not Acceptable',
    407: 'Proxy Authentication Required',
    408: 'Request Timeout',
    409: 'Conflict',
    410: 'Gone',
    411: 'Length Required',
    412: 'Precondition Failed',
    413: 'Request Entity Too Large',
    414: 'Request-URI Too Long',
    415: 'Unsupported Media Type',
    416: 'Requested Range Not Satisfiable',
    417: 'Expectation Failed',
    500: 'Internal Server Error',
    501: 'Not Implemented',
    502: 'Bad Gateway',
    503: 'Service Unavailable',
    504: 'Gateway Timeout',
    505: 'HTTP Version Not Supported',
};

export const get_static_country = (proxy, zones)=>{
    if (!proxy||!proxy.zone||!zones||!zones.zones)
        return false;
    const zone = zones.zones.find(z=>z.name==proxy.zone);
    if (!zone)
        return false;
    if (!zone.plan)
        return false;
    if (zone.plan.type=='static')
        return zone.plan.country||'any';
    if (['domain', 'domain_p'].includes(zone.plan.vips_type))
        return zone.plan.vip_country||'any';
    return false;
};

export const swagger_url = 'http://petstore.swagger.io/?url=https://'
+'raw.githubusercontent.com/luminati-io/luminati-proxy/master/lib/'
+'swagger.json#/Proxy';

export const report_exception = (error, context)=>etask(function*(){
    this.on('uncaught', e=>console.log(e));
    const {message=error} = error;
    yield perr('fe_warn', message, null, context);
});

export const perr = (type, message, stack, context)=>etask(function*(){
    yield window.fetch('/api/perr', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({type, message, stack, context}),
    });
});
