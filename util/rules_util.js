// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/
const E = module.exports;

E.WWW_API = 'https://luminati.io';

E.no_ssl_trigger_types = [
    {key: '--Select--', value: '', tooltip: `Choose a trigger type.
        For each request the system will check if the trigger is matching
        the response`},
    {key: 'URL', value: 'url', tooltip: `Trigger will be pulled for all
        requests to the selected URL`, type: 'pre'},
    {key: 'Status code', value: 'status', tooltip: `Trigger will be pulled
        for all the requests that returns the matching status code`},
];

E.trigger_types = [
    ...E.no_ssl_trigger_types,
    {key: 'Response body', value: 'body', tooltip: `Trigger will be
        pulled when the response body contain the selected string`},
    {key: 'Request time more than', value: 'min_req_time',
        tooltip: `Triggers when the request time is above the selected value`,
        type: 'pre'},
    {key: 'Request time less than', value: 'max_req_time',
        tooltip: `Triggers when the request time is below the selected value`},
];

E.default_action = {key: '--Select--', value: '', tooltip: `Select an
    action. Once the trigger rule is met the selected action is executed
    automatically.`};

E.action_types = [
    {key: 'Retry with new IP', value: 'retry', tooltip: `System will send
        the exact same request again with newly generated session`,
        min_req_time: true},
    {key: 'Retry with new proxy port (Waterfall)', value: 'retry_port',
        tooltip: `System will send another request using different port
        from your port list. This can allow cost optimization by escalating the
        request between different types of networks according to the port
        configuration.`, min_req_time: true, url: true},
    {key: 'Ban IP', value: 'ban_ip', tooltip: `Will ban the IP for custom
        amount of time. Usually used for failed requests.`, min_req_time: true,
        url: true, type: 'post'},
    {key: 'Ban IP globally', value: 'ban_ip_global', tooltip: `The same as
        'Ban IP' action but will ban the IP globally for all the proxy ports
        configured on this LPM.`, min_req_time: true, url: true, type: 'post'},
    {key: 'Ban IP per domain', value: 'ban_ip_domain', tooltip: `Will ban the
        IP for custom amount of time per domain.`, min_req_time: true,
        url: true, type: 'post'},
    {key: 'Refresh IP', value: 'refresh_ip', tooltip: `Refresh the current
        Data center IP with new allocated IP. This action contain
        additional charges. View the cost of IP refreshing in your zones
        page ${E.WWW_API}/cp/zones`, type: 'post'},
    {key: 'Save IP to reserved pool', value: 'save_to_pool', tooltip: `Save
        the current IP to a pool of reserved IPs.  you can then download all
        the IPs at a later time.`, type: 'post'},
    {key: 'Null response', value: 'null_response', tooltip: `LPM will return a
        "null response" without proxying. It is useful when users do not want
        to make a request, but a browser expects 200 response.`, type: 'pre',
        only_url: true, url: true},
    {key: 'Bypass proxy', value: 'bypass_proxy', tooltip: `Requests will be
        passed directly to target site without any proxy (super proxy or
        peer).`, type: 'pre', only_url: true, url: true},
    {key: 'Cache the response', value: 'cache', tooltip: `The response will be
        served from a local cache if exists. If the action is triggered and
        cache for this specific URL does not exist then it will be cached`,
        only_url: true, url: true, type: 'pre'},
    {key: 'Direct super proxy', value: 'direct', tooltip: `Requests will be
        passed through super proxy (not through peers)`, type: 'pre',
        only_url: true, url: true},
    {key: 'Request URL', value: 'request_url', tooltip: `Defined URL will be
        requested after current request is finished`, url: true, type: 'post'},
];

const gen_function = (name, body)=>{
    body = body.split('\n').map(l=>'  '+l).join('\n');
    return `function ${name}(opt){\n${body}\n}`;
};

const pre_actions = E.action_types.filter(a=>!a.type||a.type=='pre')
.map(a=>a.value);
const pre_trigger_types = E.trigger_types.filter(tt=>tt.type=='pre')
.map(tt=>tt.value);
const is_pre_rule = rule=>{
    return pre_actions.includes(rule.action_type) &&
        pre_trigger_types.includes(rule.trigger_type);
};

E.migrate_trigger = rule=>{
    const t = is_pre_rule(rule) ? 'pre' : 'post';
    let body = '';
    let type = 'before_send';
    if (t=='pre' && rule.min_req_time)
    {
        body = `opt.timeout = ${rule.min_req_time};\n`;
        type = 'timeout';
    }
    else if (t=='post' && rule.status)
    {
        body += `if (!new RegExp(String.raw\`${rule.status}\`)`
        +`.test(opt.status))\n  return false;\n`;
        type = 'after_hdr';
    }
    else if (t=='post' && rule.max_req_time)
    {
        body += `if (opt.time_passed>${rule.max_req_time})\n`
        +`  return false;\n`;
        type = 'after_hdr';
    }
    else if (t=='post' && rule.min_req_time)
    {
        body += `if (opt.time_passed<${rule.min_req_time})\n`
        +`  return false;\n`;
        type = 'after_hdr';
    }
    else if (t=='post' && rule.body)
    {
        body += `if (!new RegExp(String.raw\`${rule.body}\`).test(opt.body))\n`
        +`  return false;\n`;
        type = 'after_body';
    }
    if (rule.url)
    {
        body += `if (!new RegExp(String.raw\`${rule.url}\`).test(opt.url))\n`
        +`  return false;\n`;
    }
    body += `return true;`;
    return Object.assign({}, rule, {type,
        trigger_code: gen_function('trigger', body)});
};

const stringify_obj = obj=>{
    let str = '{';
    const keys = Object.keys(obj);
    for (let i=0; i<keys.length; ++i)
    {
        const k = keys[i], v = obj[k];
        const val = typeof v=='object' ?
            stringify_obj(v) : JSON.stringify(v);
        str += `${k}: ${val}`;
        if (i<keys.length-1)
            str += ', ';
    }
    return str + '}';
};
