// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true, evil:true*/
const _ = require('lodash');
const zutil = require('../util/util.js');
const date = require('../util/date.js');
const etask = require('../util/etask.js');
const decode_body = require('./util.js').decode_body;
const {SEC, MIN, HOUR, DAY} = date.ms;
const cheerio = require('cheerio');

const rule2str = (trigger, action)=>{
    // XXX krzysztof: TODO
    let res = '';
    if (trigger.type==='max_req_time')
        res = 'Max request time: '+trigger.value;
    res += ' -> '+action;
    return res;
};

class Rules {
    constructor(luminati, rules){
        rules = rules||{};
        this.luminati = luminati;
        this.rules = zutil.clone_deep(rules);
        this._post = (this.rules.post||[]).map(p=>{
            p.trigger = new Trigger(p);
            if (_.get(p, 'action.reserve_session'))
                p.pool_key = 'reserve_session';
            return p;
        });
        // XXX vladislavl: temp solution for activation fast_pool
        // must be removed when permanent solution is released
        this._post.forEach(p=>{
            if (!_.get(p, 'action.fast_pool_session'))
                return;
            p.pool_key = `fast_pool:${p.url}`;
            this.rules.pre = this.rules.pre||[];
            this.rules.pre.push({url: p.url, pool_key: p.pool_key});
        });
        this._pre = (this.rules.pre||[]).map(p=>{
            p.trigger = new Trigger(p);
            return p;
        });
    }
    get_time(t){
        const n = (''+t).match(/^(\d+)(ms|sec|min|hr|day)?$/);
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
            const p = _this._pre[i];
            if (!p.trigger.test({url: _url}, ctx))
                continue;
            if (p.session)
                req.session = _this.gen_session();
            else if (p.pool_key && !req.ctx.pool_key)
                req.ctx.pool_key = p.pool_key;
            if (p.type=='timeout')
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
                return _this.luminati.router.send_null_response(req, res);
            }
            else if (p.action=='bypass_proxy')
            {
                _this.luminati._send_rule_mail(p.email,
                    {type: 'URL', value: p.url}, 'Bypass proxy', _url);
                const resp = yield ctx.lum.send_bypass_req(this, req, res,
                    head);
                if (resp && resp.child && resp.child.retval)
                    return resp.child.retval;
                return resp;
            }
            else if (p.action=='direct')
            {
                _this.luminati._send_rule_mail(p.email,
                    {type: 'URL', value: p.url}, 'Direct super proxy', _url);
                ctx.is_direct = true;
            }
            else if (p.action=='switch_port')
            {
                const serv = _this.luminati.get_other_port(p.port);
                if (!serv)
                    return _this.luminati.router.send_null_response(req, res);
                ctx.rules = serv.rules;
                ctx.port = serv.port;
                serv.once('response', _res=>_this.post(req, res, head, _res));
                serv._request(req, res, head);
                return 'switched';
            }
        }
    }); }
    cmp(pattern, value){
        if (!pattern)
            return false;
        try {
            const r = new RegExp(pattern);
            return r.test(value);
        } catch(e){ console.log('wrong regexp in cmp rule'); }
        return false;
    }
    post(req, res, head, _res){
        const ctx = req.ctx;
        if (ctx.h_context=='STATUS CHECK'||!this._post)
            return;
        const _url = ctx.url;
        for (let i=0; i<this._post.length; i++)
        {
            const p = this._post[i];
            if (!p.trigger.test({url: _url}, ctx) || ctx.skip_rule(p))
                continue;
            if (this.check_req_time_range(req, p)&&_res)
            {
                if (this.action(req, res, head, _res, p.action, p,
                    {type: p.type}))
                {
                    return true;
                }
            }
            if (p.ipban && _res)
            {
                const tl = _res.hola_headers &&
                    _res.hola_headers['x-hola-timeline-debug'] ||
                    _res.headers&&_res.headers['x-hola-timeline-debug'];
                if (tl)
                {
                    const ip = tl.split(' ')[3];
                    if (this.luminati.banlist.has(ip)
                        && this.action(req, res, head, _res, p.action, p,
                        {type: 'IP was banned'}))
                    {
                        return true;
                    }
                }
            }
            if (this.cmp(p.status, _res.statusCode||_res.status_code))
            {
                if (this.action(req, res, head, _res, p.action, p,
                    {type: 'status code', value: p.status}))
                {
                    return true;
                }
            }
        }
    }
    post_body(req, res, head, _res, body){
        const ctx = req.ctx;
        if (ctx.h_context=='STATUS CHECK' || !this._post)
            return;
        const _body = decode_body(body, _res.headers['content-encoding']);
        const _url = ctx.url;
        for (let i=0; i<this._post.length; i++)
        {
            let p = this._post[i];
            if (p.type!='after_body' || !p.trigger.test({url: _url}, ctx))
                continue;
            if (this.cmp(p.status, _res.statusCode||_res.status_code))
            {
                if (this.action(req, res, head, _res, p.action, p,
                    {type: 'status with body', value: p.status}))
                {
                    return true;
                }
            }
            if (p.body && this.cmp(p.body, _body))
            {
                if (this.action(req, res, head, _res, p.action, p,
                    {type: 'HTML body element', value: p.body}))
                {
                    return true;
                }
            }
            if (p.action && p.action.process)
            {
                this.process_response(req, _res, p.action.process, _body,
                    p.action, {type: 'URL', value: p.url});
                return false;
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
            if (!p.trigger.test({url: _url}, ctx))
                continue;
            if (p.type!='after_body')
                continue;
            return true;
        }
        return false;
    }
    check_req_time_range(req, r){
        if (!r.max_req_time)
            return false;
        const ctx = req.ctx;
        const pk = ctx.pool_key;
        const req_max = r.max_req_time ? this.get_time(r.max_req_time)
            : +Infinity;
        const req_time = Date.now()-ctx.timeline.req.create;
        // XXX vladislavl: temp solution while rules are inconsistent:
        // one logic rule in current arch - several independent srtuctures
        // this code MUST be moved inside rule structure
        const res = req_time<=req_max;
        if (!res && /fast_pool/.test(pk))
        {
            this.luminati.session_mgr.remove_session_from_pool(
                ctx.session, pk);
        }
        return res;
    }
    retry(req, res, head, port, trigger){
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
        serv._request(req, res, head, trigger);
        serv.once('response', _res=>this.post(req, res, head, _res));
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
        return retry<(rule.retry||1);
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
                action_retry = 1;
            else if (isNaN(action_retry))
                action_retry = 0;
            if (action.retry_port)
                action_retry = 20;
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
            req.ctx.response.body = [Buffer.from(new_body)];
        } catch(e){
            const new_body = JSON.stringify({
                error: 'processing data',
                message: e.message,
                context: process_rules,
            });
            req.ctx.response.body = [Buffer.from(new_body)];
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
                action.email, trigger, rule.action_type, req.url));
        }
        if (action.reserve_session)
        {
            this.luminati.session_mgr.add_reserve_pool_session(ctx.session,
                rule.pool_key);
            ctx.set_rule(rule2str(trigger, 'Reserve session'));
        }
        if (action.fast_pool_session)
        {
            this.luminati.session_mgr.add_fast_pool_session(ctx.session,
                rule.pool_key, action.fast_pool_size);
            ctx.set_rule(rule2str(trigger, 'Fast pool session'));
        }
        const tl = _res && _res.hola_headers &&
            _res.hola_headers['x-hola-timeline-debug'] ||
            _res.headers && _res.headers['x-hola-timeline-debug'];
        if (action.ban_ip && _res)
        {
            let t = this.get_time(action.ban_ip)||1;
            if (tl)
                this.luminati.banlist.add(tl.split(' ')[3], t);
            req.session = this.gen_session();
        }
        if (!this.can_retry(req, res, action))
            return false;
        if (action.refresh_ip&&_res&&tl)
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
        this.retry(req, res, head, action.retry_port, trigger);
        if (action.retry_port)
            ctx.rule_executed(rule);
        return true;
    }
}

const E = module.exports = Rules;

class Trigger {
    constructor(r){
        this.code = r.trigger_code;
        this.url = r.url;
    }
    test(opt, ctx){
        opt = opt||{};
        if (!this.code)
        {
            if (!this.url || this.url=='*')
                return true;
            try {
                const r = new RegExp(this.url);
                return r.test(opt.url);
            } catch(e){ ctx.log.warn('trigger: wrong RegExp'); }
            return false;
        }
        const code = this.code+'\nreturn trigger;';
        try {
            const func = new Function(code)();
            return func(opt);
        } catch(e){ ctx.log.warn('trigger: function failed'); }
        return false;
    }
}

E.Trigger = Trigger;
