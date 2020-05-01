// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true, es6:true*/
import React from 'react';
import _ from 'lodash';
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

const error_desc = [
    // proxy.js err_messages
    {
        regex: /Bad Port. Ports we support/,
        description: <span/>,
    },
    {
        regex: /We do not have IPs in the city you requested/,
        description: <span/>,
    },
    {
        regex: /Request is not allowed from peers and sent from super proxy/,
        description: <span/>,
    },
    // proxy.js check_blocked_target
    {
        regex: /You tried to target .* but got blocked/,
        description: <span/>,
    },
    {
        regex: /request needs to be made using residential network/,
        description: <span/>,
    },
    {
        regex: /target site requires special permission/,
        description: <span/>,
    },
    // agent_conn.js find_reasons
    {
        regex: /No peers available/,
        description: <span/>,
    },
    {
        regex: /not matching any of allocated gIPs/,
        description: <span>This error means that the chosen targeting could
            not be applied on any of the allocated gIPs. Go to the
            <b>Targeting</b> tab and remove the selected criteria and try
            again
        </span>,
    },
    {
        regex: /Zone wrong status/,
        description: <span/>,
    },
    {
        regex: /Internal server error/,
        description: <span/>,
    },
    {
        regex: /Wrong city/,
        description: <span/>,
    },
    {
        regex: /No matching fallback IP/,
        description: <span/>,
    },
    // zone_util.js disabled_reasons_names
    {
        regex: /Wrong customer name/,
        description: <span/>,
    },
    {
        regex: /Customer suspended/,
        description: <span/>,
    },
    {
        regex: /Customer disabled/,
        description: <span/>,
    },
    {
        regex: /IP forbidden/,
        description: <span/>,
    },
    {
        regex: /Wrong password/,
        description: <span/>,
    },
    {
        regex: /Zone not found/,
        description: <span/>,
    },
    {
        regex: /No passwords/,
        description: <span/>,
    },
    {
        regex: /No IPs/,
        description: <span/>,
    },
    {
        regex: /Usage limit reached/,
        description: <span/>,
    },
    {
        regex: /No plan/,
        description: <span/>,
    },
    {
        regex: /Plan disabled/,
        description: <span/>,
    },
];

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

const undescribed_error = _.once((status_code, title)=>{
    perr('undescribed_error', {status_code, title});
});

export const get_troubleshoot = (body, status_code, headers)=>{
    let title;
    let info;
    if (/([123]..|404)/.test(status_code))
        return {title, info};
    if (status_code=='canceled')
    {
        return {title: 'canceled by the sender', info: 'This request has been'
            +' canceled by the sender (your browser or scraper).'};
    }
    title = (headers && headers.find(h=>
        h.name=='x-luminati-error'||h.name=='x-lpm-error')||{}).value||'';
    for (let {regex, description} of error_desc)
    {
        if (regex.test(title))
            return {title, info: description};
    }
    if (title)
        undescribed_error(status_code, title);
    return {title, info: ''};
};
