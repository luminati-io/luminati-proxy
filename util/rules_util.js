// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/
const E = module.exports;

E.gen_function = body=>{
    body = body.split('\n').map(l=>'  '+l).join('\n');
    return `function trigger(opt){\n${body}\n}`;
};

const empty_function = E.gen_function('return true;');

E.gen_code = val=>{
    if (!val)
        return empty_function;
    return E.gen_function(`return /${val}/.test(opt.url);`);
};

E.migrate_rule = t=>rule=>{
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
    return Object.assign({}, rule, {type, trigger_code: E.gen_function(body)});
};
