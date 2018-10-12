// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true, evil:true*/
const _ = require('lodash');
const zutil = require('../util/util.js');
const date = require('../util/date.js');
const etask = require('../util/etask.js');
const http = require('http');
const decode_body = require('./util.js').decode_body;
const assign = Object.assign, {SEC, MIN, HOUR, DAY} = date.ms;
const cheerio = require('cheerio');

let write_http_reply = (_stream, res, headers)=>{
    headers = assign(headers||{}, res.headers||{});
    if (_stream.x_hola_context)
        headers['x-hola-context'] = _stream.x_hola_context;
    if (_stream.cred)
        headers['x-lpm-authorization'] = _stream.cred;
    _stream.resp_written = true;
    if (_stream instanceof http.ServerResponse)
        return _stream.writeHead(res.statusCode, res.statusMessage, headers);
    let head = `HTTP/1.1 ${res.statusCode} ${res.statusMessage}\r\n`;
    for (let field in headers)
        head += `${field}: ${headers[field]}\r\n`;
    _stream.write(head+'\r\n');
};

module.exports = class Rules {
    constructor(luminati, rules){
        rules = rules||{};
        const priority_cmp = (a, b)=>a.priority-b.priority;
        this.luminati = luminati;
        this.rules = zutil.clone_deep(rules);
        this._post = (this.rules.post||[]).map(p=>{
            p.url_re = this._url_regexp(p.url);
            p.need_body = p.res.filter(r=>r.body||r.action&&r.action.process)
            .length>0;
            p.priority = p.priority||10;
            if (p.res&&p.res.some(pres=>_.get(pres, 'action.reserve_session')))
                p.pool_key = 'reserve_session';
            return p;
        }).sort(priority_cmp);
        // XXX vladislavl: temp solution for activation fast_pool
        // must be removed when permanent solution is released
        this._post.forEach(p=>{
            if (!p.res||!p.res.some(r=>_.get(r, 'action.fast_pool_session')))
                return;
            p.pool_key = `fast_pool:${p.url}`;
            this.rules.pre = this.rules.pre||[];
            this.rules.pre.push({url: p.url, priority: p.priority
                ||Number.MAX_SAFE_INTEGER, pool_key: p.pool_key});
        });
        this._pre = (this.rules.pre||[]).map(p=>{
            p.url_re = this._url_regexp(p.url);
            p.priority = p.priority||10;
            return p;
        }).sort(priority_cmp);
    }
    _url_regexp(_url){
        if (!_url||_url=='*'||_url=='**')
            return new RegExp('');
        let r;
        try { r = new RegExp(_url); }
        catch(e){ r = new RegExp('$a'); }
        return r;
    }
    get_time(t){
        let n = (''+t).match(/^(\d+)(ms|sec|min|hr|day)?$/);
        if (!n)
            return 0;
        t = +n[1];
        switch (n[2])
        {
        case 'day': t *= DAY; break;
        case 'hr': t *= HOUR; break;
        case 'min': t *= MIN; break;
        case 'sec': t *= SEC; break;
        case 'ms': break;
        }
        return t;
    }
    pre(req, res, head){
        const _this = this;
    return etask(function*rules_pre(){
        const {ctx} = req;
        req.ctx.pool_key = req.ctx.h_reserved ? 'reserve_session' : null;
        if (ctx.h_context=='STATUS CHECK'||!_this._pre)
            return;
        const _url = req.ctx.url||req.url_full||req.url;
        for (let i=0; i<_this._pre.length; i++)
        {
            let p = _this._pre[i];
            if (p.connect)
            {
                if (req.method!='CONNECT'||p.connect!=_url)
                    continue;
            }
            else if (!p.url_re.test(_url))
                continue;
            if (p.session)
                req.session = _this.gen_session();
            else if (p.pool_key && !req.ctx.pool_key)
                req.ctx.pool_key = p.pool_key;
            // XXX krzysztof: legacy and does not work
            if (p.timeout)
                req.timeout = _this.get_time(p.timeout);
            if (p.trigger_type=='min_req_time')
            {
                req.min_req_task = etask(function*min_req_time(){
                    yield etask.sleep(p.min_req_time);
                    _this._action(req, res, p);
                });
                return false;
            }
            else if (p.action=='null_response')
            {
                _this.luminati._send_rule_mail(p.email,
                    {type: 'URL', value: p.url}, 'Null response', _url);
                ctx.log.debug('requested url %s matches null_response', _url);
                return _this.send_null_response(req, res);
            }
            else if (p.action=='bypass_proxy')
            {
                _this.luminati._send_rule_mail(p.email,
                    {type: 'URL', value: p.url}, 'Bypass proxy', _url);
                ctx.log.debug('requested url %s matches bypass proxy', _url);
                const resp = yield ctx.lum.send_bypass_req(req, res, head);
                // XXX maximk: sometimes retval is not returned directly, why?
                if (resp && resp.child && resp.child.retval)
                    return resp.child.retval;
                return resp;
            }
            else if (p.action=='direct')
            {
                _this.luminati._send_rule_mail(p.email,
                    {type: 'URL', value: p.url}, 'Direct super proxy', _url);
                ctx.log.debug('requested url %s matches direct request', _url);
                ctx.is_direct = true;
            }
            else if (p.action=='switch_port')
            {
                let serv;
                serv = _this.luminati.get_other_port(p.port);
                if (!serv)
                    return _this.send_null_response(req, res);
                ctx.rules = serv.rules;
                ctx.port = serv.port;
                serv._request(req, res, head);
                return 'switched';
            }
        }
    }); }
    send_null_response(req, res){
        const ctx = req.ctx;
        ctx.log.debug('Returning null response: %s %s', req.method, ctx.url);
        let status = req.method=='CONNECT' ? 501 : 200;
        write_http_reply(res, {statusCode: status, statusMessage: 'NULL'});
        res.end();
        ctx.timeline.track('end');
        ctx.response.status_code = status;
        ctx.response.status_message = 'NULL';
        return ctx.response;
    }
    _cmp(rule, value){
        if (!rule)
            return false;
        let type = rule.type||'==';
        switch (type)
        {
        case '==': return rule.arg==value;
        case '!=': return rule.arg!=value;
        case '=~':
            if (!rule.arg_re)
                rule.arg_re = new RegExp(rule.arg);
            return rule.arg_re.test(value);
        case '!~':
            if (!rule.arg_re)
                rule.arg_re = new RegExp(rule.arg);
            return !rule.arg_re.test(value);
        case 'in': return rule.arg.includes(value);
        case '!in': return !rule.arg.includes(value);
        }
        return false;
    }
    cmp(rule, value){
        if (!rule)
            return false;
        if (!(rule instanceof Array))
        {
            if (rule.name)
                value = value[rule.name];
            return this._cmp(rule, value);
        }
        for (let i=0; i<rule.length; i++)
        {
            let r = rule[i], v = value;
            if (r.name)
                v = value[r.name];
            if (this._cmp(r, v))
                return true;
        }
        return false;
    }
    // XXX krzysztof: probably legacy and does not work
    post_timeout(req, res, head){
        if (req.ctx.h_context=='STATUS CHECK'||!this._post)
            return;
        const _url = req.url_full||req.url;
        for (let i=0; i<this._post.length; i++)
        {
            let p = this._post[i];
            if (p.connect)
            {
                if (req.method!='CONNECT'||p.connect!=_url)
                    continue;
            }
            else if (!p.url_re.test(_url))
                continue;
            for (let j=0; j<p.res.length; j++)
            {
                let r = p.res[j];
                if (!r.timeout)
                    continue;
                if (this.action(req, res, head, null, r.action||p.action, p))
                    return true;
            }
        }
    }
    post(req, res, head, _res, hdrs_only){
        const ctx = req.ctx;
        if (ctx.h_context=='STATUS CHECK'||!this._post)
            return;
        const _url = ctx.url;
        for (let i=0; i<this._post.length; i++)
        {
            let p = this._post[i];
            if (p.connect)
            {
                if (req.method!='CONNECT'||p.connect!=_url)
                    continue;
            }
            else if (!p.url_re.test(_url))
                continue;
            for (let j=0; j<p.res.length; j++)
            {
                const r = p.res[j], pr_action = r.action||p.action;
                if (hdrs_only && !r.head)
                    continue;
                if (this.check_req_time_range(req, r)&&_res)
                {
                    if (this.action(req, res, head, _res, pr_action, p,
                        {type: r.trigger_type.replace(/_/g, ' '),
                            value: r[r.trigger_type]}))
                    {
                        return true;
                    }
                }
                if (r.ipban&&_res)
                {
                    let tl = _res.hola_headers&&
                        _res.hola_headers['x-hola-timeline-debug']||
                        _res.headers&&_res.headers['x-hola-timeline-debug'];
                    if (tl)
                    {
                        const ip = tl.split(' ')[3];
                        if (this.luminati.banlist.has(ip)
                            && this.action(req, res, head, _res, pr_action, p,
                            {type: 'IP was banned', value: ip}))
                        {
                            return true;
                        }
                    }
                }
                if (this.cmp(r.status, _res.statusCode)
                    || this.cmp(r.header, _res.headers))
                {
                    if (this.action(req, res, head, _res, pr_action, p,
                        {type: 'status code', value: r.status.arg}))
                    {
                        return true;
                    }
                }
            }
        }
    }
    post_body(req, res, head, _res, body){
        const ctx = req.ctx;
        if (ctx.h_context=='STATUS CHECK'||!this._post)
            return;
        const _body = decode_body(body, _res.headers['content-encoding']);
        const _url = ctx.url;
        for (let i=0; i<this._post.length; i++)
        {
            let p = this._post[i];
            if (!p.need_body || !p.url_re.test(_url))
                continue;
            for (let j=0; j<p.res.length; j++)
            {
                const r = p.res[j], pr_action = r.action||p.action;
                if (this.cmp(r.status, _res.statusCode))
                {
                    if (this.action(req, res, head, _res, pr_action, p,
                        {type: 'status with body', value: r.status}))
                    {
                        return true;
                    }
                }
                if (r.body && this.cmp(r.body, _body))
                {
                    if (this.action(req, res, head, _res, pr_action, p,
                        {type: 'HTML body element', value: r.body.arg}))
                    {
                        return true;
                    }
                }
                if (r.action&&r.action.process)
                {
                    this.process_response(req, _res, r.action.process, _body,
                        r.action, {type: 'URL', value: p.url});
                    return false;
                }
            }
        }
    }
    post_need_body(req){
        if (!this._post)
            return;
        const ctx = req.ctx;
        const _url = ctx.url;
        for (let i=0; i<this._post.length; i++)
        {
            let p = this._post[i];
            if (!p.url_re.test(_url))
                continue;
            if (!p.need_body)
                continue;
            return true;
        }
        return false;
    }
    check_req_time_range(req, r){
        if (!r.max_req_time && !r.min_req_time)
            return false;
        const ctx = req.ctx, pk = ctx.pool_key;
        let req_max = r.max_req_time ? this.get_time(r.max_req_time)
            : +Infinity;
        let req_min = r.min_req_time ? this.get_time(r.min_req_time) : 0;
        let req_time = Date.now()-ctx.timeline.req.create;
        // XXX vladislavl: temp solution while rules are inconsistent:
        // one logic rule in current arch - several independent srtuctures
        // this code MUST be moved inside rule structure
        const res = req_time<=req_max && req_time>=req_min;
        if (!res && /fast_pool/.test(pk))
        {
            this.luminati.session_mgr.remove_session_from_pool(
                ctx.session, pk);
        }
        return res;
    }
    retry(req, res, head, port){
        if (!req.retry)
            req.retry = 0;
        req.retry++;
        req.ctx.log.info('req retry %s %s', req.retry, req.ctx.url);
        let serv;
        if (port)
            serv = this.luminati.get_other_port(port);
        if (!serv)
            serv = this.luminati;
        req.ctx.rules = serv.rules;
        req.ctx.port = serv.port;
        req.ctx.proxies.forEach(p=>this.luminati._abort_proxy_req(req, p));
        if (this.luminati.port!=port&&this.luminati.opt.handle_abort)
            this.luminati.opt.handle_abort(req.ctx.uuid);
        serv._request(req, res, head);
        return true;
    }
    // XXX krzysztof: WIP _can_retry is a newer implementation of can_retry
    _can_retry(req, res, rule){
        if (rule.action!='retry'&&rule.action!='retry_port')
            return false;
        const retry = req.retry||0;
        const port = rule.retry_port;
        if (port&&!this.luminati.get_other_port(port))
            return false;
        return retry<5;
    }
    can_retry(req, response, action){
        let retry = req.retry||0;
        let ret = (!action||!action.refresh_ip)&&retry<5||retry==0;
        let port;
        if (action)
        {
            let action_retry = parseInt(action.retry);
            if (action.retry===false)
                action_retry = 0;
            else if (action.retry===true)
                action_retry = 5;
            else if (isNaN(action_retry))
                action_retry = 0;
            ret = !(!action.retry||action_retry<=retry||!ret);
            port = action.retry_port;
            if (port&&!this.luminati.get_other_port(port))
                ret = false;
        }
        return ret;
    }
    gen_session(){
        return 'rand'+Math.floor(Math.random()*9999999+1000000);
    }
    process_response(req, _res, process_rules, body, action, trigger){
        if (action.email)
        {
            this.luminati.sp.spawn(this.luminati._send_rule_mail(
                action.email, trigger, 'process data', req.url));
        }
        _res.headers['content-type'] = 'application/json; charset=utf-8';
        delete _res.headers['content-encoding'];
        /* eslint-disable no-unused-vars */
        const $ = cheerio.load(body, {xml: {normalizeWhitespace: true}});
        /* eslint-enable no-unused-vars */
        const processed = {};
        for (let key in process_rules)
        {
            try {
                processed[key] = eval(process_rules[key]);
                JSON.stringify(processed[key]);
            } catch(e){
                processed[key] = {error: 'processing data',
                    message: e.message, context: process_rules[key]};
            }
        }
        try {
            const new_body = JSON.stringify(processed);
            req.ctx.response.body = [Buffer(new_body)];
        } catch(e){
            const new_body = JSON.stringify({
                error: 'processing data',
                message: e.message,
                context: process_rules,
            });
            req.ctx.response.body = [Buffer(new_body)];
        }
    }
    // XXX krzysztof: WIP _action is a newer implementation of action
    _action(req, res, rule){
        if (!this._can_retry(req, res, rule))
            return false;
        req.session = this.gen_session();
        this.retry(req, res, null, rule.retry_port);
        return true;
    }
    action(req, res, head, _res, action, rule, trigger){
        const ctx = req.ctx;
        if (action.email)
        {
            this.luminati.sp.spawn(this.luminati._send_rule_mail(
                action.email, trigger, rule.res[0].action_type, req.url));
        }
        if (action.reserve_session)
        {
            this.luminati.session_mgr.add_reserve_pool_session(ctx.session,
                rule.pool_key);
        }
        if (action.fast_pool_session)
        {
            this.luminati.session_mgr.add_fast_pool_session(ctx.session,
                rule.pool_key, action.fast_pool_size);
        }
        if (!this.can_retry(req, res, action))
            return false;
        const tl = _res&&_res.hola_headers&&
            _res.hola_headers['x-hola-timeline-debug']||
            _res.headers&&_res.headers['x-hola-timeline-debug'];
        if (action.ban_ip&&_res)
        {
            let t = this.get_time(action.ban_ip)||1;
            if (tl)
                this.luminati.banlist.add(tl.split(' ')[3], t);
            req.session = this.gen_session();
        }
        else if (action.refresh_ip&&_res&&tl)
        {
            const refresh_task = this.luminati.refresh_ip(ctx,
                tl.split(' ')[3]);
            this.luminati.refresh_task = refresh_task;
        }
        else if (action.url&&_res)
        {
            let _url = action.url;
            if (_url=='location')
                _url = _res.headers.location;
            req.url = _url;
        }
        else
            req.session = this.gen_session();
        this.retry(req, res, head, action.retry_port);
        return true;
    }
};
