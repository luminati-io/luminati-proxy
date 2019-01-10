// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/
const E = module.exports;

const gen_function = body=>{
    body = body.split('\n').map(l=>'  '+l).join('\n');
    return `function trigger(opt){\n${body}\n}`;
};

E.migrate_trigger = t=>rule=>{
    let body = '';
    let type = 'before_send';
    if (t=='pre' && rule.min_req_time)
    {
        body = `opt.timeout = ${rule.min_req_time};\n`;
        type = 'timeout';
    }
    else if (t=='post' && rule.status)
    {
        body += `if (!/${rule.status}/.test(opt.status))\n`
        +`  return false;\n`;
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
        body += `if (!/${rule.body}/.test(opt.body))\n`
        +`  return false;\n`;
        type = 'after_body';
    }
    if (rule.action && rule.action.process)
        type = 'after_body';
    if (rule.url)
    {
        body += `if (!/${rule.url}/.test(opt.url))\n`
        +`  return false;\n`;
    }
    body += `return true;`;
    return Object.assign({}, rule, {type, trigger_code: gen_function(body)});
};

E.migrate_action = rule=>{
    return Object.assign({}, rule, {action_code: get_action(rule)});
};

// XXX krzysztof: WIP
const get_action = rule=>{
    let body = '';
    if (!rule.action)
        return '';
    if (rule.action.retry)
        body += `opt.retry(${+rule.action.retry});`;
    return gen_function(body);
};
