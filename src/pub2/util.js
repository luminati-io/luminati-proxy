// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true, es6:true*/
import _ from 'lodash4';
import React from 'react';
import semver from 'semver';
import etask from '../../util/etask.js';
import {main as Api} from './api.js';

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

const error_desc = [
    // proxy.js
    {
        regex: /Bad Port. Ports we support/,
        description: <span/>,
    },
    {
        regex: /We do not have IPs in the city you requested/,
        description: <span/>,
    },
    {
        regex: /Target site not set as an exclusive domain in zone, request sent from super proxy/,
        description: <span/>,
    },
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
    {
        regex: /target site requires exclusive domains permission/,
        description: <span/>,
    },
    {
        regex: /Forbidden Host/,
        description: <span/>,
    },
    {
        regex: /Forbidden auth key ipv6/,
        description: <span/>,
    },
    {
        regex: /Zone has reached its usage limit/,
        description: <span/>,
    },
    {
        regex: /Request rate too high/,
        description: <span/>,
    },
    {
        regex: /Host is blocked in requested country/,
        description: <span/>,
    },
    {
        regex: /Zone has reached its usage limit/,
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
    // zone_util.js unavail_reasons
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
    // other errors
    {
        regex: /socket hang up/,
        description: <span/>,
    },
    {
        regex: /Could not resolve host/,
        description: <span/>,
    },
    {
        regex: /ECONNREFUSED/,
        description: <span/>,
    },
    {
        regex: /EADDRINUSE/,
        description: <span/>,
    },
    {
        regex: /ENETUNREACH/,
        description: <span/>,
    }
];

const undescribed_error = (()=>{
    let executed;
    return message=>{
        if (executed)
            return;
        executed = true;
    };
})();

export const get_troubleshoot = (body, status_code, headers)=>{
    let title;
    let info;
    headers = headers||[];
    if (/([123]..|404)/.test(status_code))
        return {title, info};
    if (status_code=='canceled')
    {
        return {title: 'canceled by the sender', info: 'This request has been'
            +' canceled by the sender (your browser or scraper).'};
    }
    title = (headers.find(h=>
        h.name=='x-luminati-error'||h.name=='x-lpm-error')||{}).value||'';
    for (let {regex, description} of error_desc)
    {
        if (regex.test(title))
            return {title, info: description};
    }
    if (title)
    {
        let lpm = (headers.find(h=>h.name=='x-lpm-error')||{}).value||'';
        let lum = (headers.find(h=>h.name=='x-luminati-error')||{}).value||'';
        undescribed_error({status_code, title, lpm, lum});
    }
    return {title, info: ''};
};

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

export const report_exception = (error, context)=>etask(function*(){
    this.on('uncaught', e=>console.log(e));
    const {message=error} = error;
    yield perr('fe_warn', message, null, context);
});

export const perr = (type, message, stack, context)=>etask(function*(){
    yield Api.json.post('perr', {type, message, stack, context});
});

export const get_location_port = ()=>window.location.port ||
    {'http:': 80, 'https:': 443}[window.location.protocol];

export const get_last_versions = (ver_cur, ver_last)=>{
    if (!ver_cur || !ver_last)
        return {versions: [], changes: []};
    const versions = ver_last.versions.filter(v=>semver.lt(ver_cur, v.ver));
    const changes = versions.reduce((acc, ver)=>acc.concat(ver.changes), []);
    return {versions, changes};
};

export const get_changes_tooltip = changes=>{
    if (!changes || !changes.length)
        return '';
    const list = changes.map(c=>`<li>${c.text}</li>`).join('\n');
    return `Changes: <ul>${list}</ul>`;
};

export const bind_all = (_this, methods)=>{
    methods.forEach(m=>_this[m] = _this[m].bind(_this));
};

export const is_local = ()=>{
    const {href} = window.location;
    return href.includes('localhost') || href.includes('127.0.0.1');
};

export const in_cp = ()=>window.location!==window.parent.location;

export const with_zagent_fn = zagent=>Comp=>function with_zagent(props){
    return <Comp {...props} zagent={zagent} />;
};

export const Clipboard = ()=><textarea className="copy_area"/>;
Clipboard.copy = text=>{
    if (!text)
        return;
    if (_.get(navigator, 'clipboard.writeText'))
    {
        navigator.clipboard.writeText(text);
        return true;
    }
    const textarea = document.querySelector('textarea.copy_area');
    if (!textarea)
        return;
    textarea.value = text;
    textarea.select();
    try {
        document.execCommand('copy');
        return true;
    } catch(e){ return void console.log('Unable to copy'); }
};
