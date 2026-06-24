// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, react:true*/
let is_node = typeof module=='object' && module.exports;
let define;
if (is_node)
{
    try {
        define = require('./require_node.js').define(module, '..');
    } catch(e){
        define = require('../../util/require_node.js').define(module, '..');
    }
}
else
    define = self.define;
define(['/util/js_sanitizer.js'], sanitizer_util=>{
const E = {};

const Js_sanitizer = sanitizer_util.default || sanitizer_util;

E.WWW_API = 'https://brightdata.com';

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
    {key: 'Connection time more than', value: 'min_conn_time',
        tooltip: 'Triggers when the connection time is above'+
            'the selected value', type: 'pre'},
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
    {key: 'Retry with the same IP', value: 'retry_same', tooltip: `System will
        send the exact same request again using the existing session/IP`,
        min_req_time: true},
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
        configured on this Proxy Manager.`, min_req_time: true, url: true,
        type: 'post'},
    {key: 'Ban IP per domain', value: 'ban_ip_domain', tooltip: `Will ban the
        IP for custom amount of time per domain.`, min_req_time: true,
        url: true, type: 'post'},
    {key: 'Refresh IP', value: 'refresh_ip', tooltip: `Refresh the current
        Data Center IP with new allocated IP. This action contain
        additional charges. View the cost of IP refreshing in your zones
        page ${E.WWW_API}/cp/zones`, type: 'post', min_req_time: true},
    {key: 'Save IP to reserved pool', value: 'save_to_pool', tooltip: `Save
        the current IP to a pool of reserved IPs.  you can then download all
        the IPs at a later time.`, type: 'post'},
    {key: 'Null response', value: 'null_response', tooltip: `Proxy Manager will
        return a "null response" without proxying. It is useful when users do
        not want to make a request, but a browser expects 200 response.`,
        type: 'pre', only_url: true, url: true},
    {key: 'Timeout response', value: 'timeout_response', tooltip: `Proxy`
        +` Manager will return a "Timeout response" with status code 504`
        +` and status message "Proxy manager tunnel timeout"`,
        min_req_time: true},
    {key: 'Bypass proxy', value: 'bypass_proxy', tooltip: `Requests will be
        passed directly to target site without any proxy (super proxy or
        peer).`, type: 'pre', only_url: true, url: true},
    {key: 'Cache the response', value: 'cache', tooltip: `The response will be
        served from a local cache if exists. If the action is triggered and
        cache for this specific URL does not exist then it will be cached`,
        only_url: false, url: true, type: 'pre'},
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
        type = 'timeout';
    else if (t=='pre' && rule.min_conn_time)
        type = 'timeout';
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
        const k = rule.domain ? 'domain' : 'url';
        body += `if (!new RegExp(String.raw\`${rule.url}\`).test(opt.${k}))\n`
        +`  return false;\n`;
    }
    body += `return true;`;
    return Object.assign({}, rule, {type,
        trigger_code: gen_function('trigger', body)});
};

E.get_timeout_value = rule=>rule.min_req_time || rule.min_conn_time
    || rule.max_req_time || 0;

const TRIGGER_NODES = [
    'Program', 'FunctionDeclaration', 'ArrowFunctionExpression',
    'BlockStatement', 'VariableDeclaration', 'VariableDeclarator',
    'Identifier', 'IfStatement', 'ReturnStatement', 'ExpressionStatement',
    'CallExpression', 'NewExpression', 'MemberExpression',
    'UnaryExpression', 'BinaryExpression', 'LogicalExpression',
    'AssignmentExpression', 'Literal', 'TemplateLiteral',
    'TemplateElement', 'TaggedTemplateExpression', 'ArrayExpression',
    'ChainExpression', 'ForStatement', 'UpdateExpression', 'AssignmentPattern',
];
const DANGEROUS_PROPS = [
    'constructor', '__proto__', 'prototype',
    '__defineGetter__', '__defineSetter__',
    '__lookupGetter__', '__lookupSetter__',
    'caller', 'callee', 'arguments',
];
const SAFE_GLOBAL_IDS = [
    'RegExp',
    'String',
    'Number',
    'Boolean',
    'JSON',
    'Math',
    'Object',
    'Array',
    'console',
    'undefined',
    'NaN',
    'Infinity',
];

const SAFE_OBJECT_PROPS = new Set([
    'keys',
    'values',
    'entries',
]);

const validate_global_identifiers = (node, parent, gp, fail, ctx)=>{
    if (!ctx.is_global_identifier_reference())
        return;
    if (SAFE_GLOBAL_IDS.includes(node.name))
        return;
    fail(`identifiers ${node.name} is not allowed`, node);
};

const validate_trigger_shape = (ast, fail)=>{
    const triggers = ast.body.filter(stmt=>
        stmt.type=='FunctionDeclaration'
        && stmt.id
        && stmt.id.name=='trigger');
    if (triggers.length!=1)
        fail('code must contain exactly one top-level trigger function', ast);
    const fn = triggers[0];
    if (fn.async || fn.generator)
        fail('async/generator functions are not allowed', fn);
    if (fn.params.length!=1 || fn.params[0].type!='Identifier'
        || fn.params[0].name!='opt')
    {
        fail('trigger must have exactly one parameter: opt', fn);
    }
};

const validate_object_props = (node, parent, gp, fail, ctx)=>{
    if (node.type!='MemberExpression')
        return;
    if (node.object.type!='Identifier' || node.object.name!='Object')
        return;
    if (!ctx.is_global_identifier_reference(node.object, node, parent))
        return;
    const prop = node.computed
        ? node.property.type=='Literal' && String(node.property.value)
        : ctx.prop_name(node.property);
    if (!prop || !SAFE_OBJECT_PROPS.has(prop))
        fail(`Object.${prop || '<computed>'} is not allowed`, node);
};

let rules_sanitizer;
E.get_sanitizer = ()=>{
    if (rules_sanitizer)
        return rules_sanitizer;
    rules_sanitizer = new Js_sanitizer({
        validate_shape: validate_trigger_shape,
        node_validators: [
            validate_global_identifiers,
            validate_object_props,
        ],
    })
    .only(TRIGGER_NODES)
    .forbid({
        global_mutation: true,
        global_alias: true,
        props: DANGEROUS_PROPS,
        new_expr: true,
    })
    .allow({new_expr: ['RegExp']});
    return rules_sanitizer;
};

E.sanitize = (rules=[])=>{
    let errs = [];
    for (let i = 0; i < rules.length; i++)
    {
        let rule = rules[i];
        if (!rule.trigger_code)
            continue;
        try {
            E.get_sanitizer().sanitize(rule.trigger_code);
        } catch(e){
            errs.push([i, e]);
        }
    }
    return errs;
};

return E; }); // eslint-disable-line
