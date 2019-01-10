// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true, evil:true*/
const _ = require('lodash');
const zutil = require('../util/util.js');
const {migrate_trigger} = require('../util/rules_util.js');
const etask = require('../util/etask.js');
const decode_body = require('./util.js').decode_body;
const cheerio = require('cheerio');
const Domains = require('./domains.js');

class Rules {
    constructor(luminati, rules){
        rules = rules||{};
        this.luminati = luminati;
        this.rules = zutil.clone_deep(rules);
        this._post = (this.rules.post||[]).map(rule=>{
            if (_.get(rule, 'action.reserve_session'))
                rule.pool_key = 'reserve_session';
            if (_.get(rule, 'action.ban_ip_domain_reqs'))
                rule.domains = new Domains(rule.action);
            rule = migrate_trigger('post')(rule);
            rule.trigger = new Trigger(rule);
            return rule;
        });
        this._post.forEach(rule=>{
            if (!_.get(rule, 'action.fast_pool_session'))
                return;
            rule.pool_key = `fast_pool:${rule.url}`;
            this.rules.pre = this.rules.pre||[];
            this.rules.pre.push({url: rule.url, pool_key: rule.pool_key});
        });
        this._pre = (this.rules.pre||[]).map(rule=>{
            rule = migrate_trigger('pre')(rule);
            rule.trigger = new Trigger(rule);
            return rule;
        });
    }
    pre(req, res, head){
        const _this = this;
    return etask(function*rules_pre(){
        const {ctx} = req;
        req.ctx.pool_key = req.ctx.h_reserved ? 'reserve_session' : null;
        if (ctx.h_context=='STATUS CHECK'||!_this._pre)
            return;
        const _url = req.ctx.url||req.url_full||req.url;
        const opt = {url: _url};
        for (let i=0; i<_this._pre.length; i++)
        {
            const rule = _this._pre[i];
            if (rule.type!='before_send' && rule.type!='timeout')
                continue;
            if (!rule.trigger.test(opt, ctx))
                continue;
            // XXX krzysztof: rule.session is probably legacy and to remove
            if (rule.session)
                req.session = _this.gen_session();
            else if (rule.pool_key && !req.ctx.pool_key)
                req.ctx.pool_key = rule.pool_key;
            if (rule.type=='timeout' && opt.timeout)
            {
                req.min_req_task = etask(function*min_req_time(){
                    yield etask.sleep(opt.timeout);
                    _this._action(req, res, rule);
                });
                return false;
            }
            else if (rule.action=='null_response')
            {
                _this.luminati._send_rule_mail(rule.email, 'Null response',
                    _url);
                return _this.luminati.router.send_null_response(req, res);
            }
            else if (rule.action=='bypass_proxy')
            {
                _this.luminati._send_rule_mail(rule.email, 'Bypass proxy',
                    _url);
                const resp = yield ctx.lum.send_bypass_req(this, req, res,
                    head);
                if (resp && resp.child && resp.child.retval)
                    return resp.child.retval;
                return resp;
            }
            else if (rule.action=='direct')
            {
                _this.luminati._send_rule_mail(rule.email,
                    'Direct super proxy', _url);
                ctx.is_direct = true;
            }
            else if (rule.action=='switch_port')
            {
                const serv = _this.luminati.get_other_port(rule.port);
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
    post(req, res, head, _res){
        if (req.ctx.h_context=='STATUS CHECK'||!this._post)
            return;
        for (let i=0; i<this._post.length; i++)
        {
            const rule = this._post[i];
            const status = _res.statusCode||_res.status_code;
            const time_created = _.get(req, 'ctx.timeline.req.create')||0;
            const time_passed = Date.now()-time_created;
            const opt = {url: req.ctx.url, status, time_passed};
            if (rule.type!='after_hdr')
                continue;
            if (!rule.trigger.test(opt, req.ctx)||req.ctx.skip_rule(rule))
                continue;
            this.check_req_time_range(req, rule);
            if (this.action(req, res, head, _res, rule.action, rule))
                return true;
        }
    }
    post_body(req, res, head, _res, body){
        if (req.ctx.h_context=='STATUS CHECK'||!this._post)
            return;
        const _body = decode_body(body, _res.headers['content-encoding']);
        const _url = req.ctx.url;
        for (let i=0; i<this._post.length; i++)
        {
            const rule = this._post[i];
            const status = _res.statusCode||_res.status_code;
            const time_passed = Date.now()-req.ctx.timeline.req.create;
            const opt = {url: _url, status, body: _body, time_passed};
            if (rule.type!='after_body'||!rule.trigger.test(opt, req.ctx))
                continue;
            this.check_req_time_range(req, rule);
            if (this.action(req, res, head, _res, rule.action, rule, _body))
                return true;
        }
    }
    post_need_body(req){
        if (!this._post)
            return;
        for (let i=0; i<this._post.length; i++)
        {
            let p = this._post[i];
            if (p.type!='after_body')
                continue;
            return true;
        }
        return false;
    }
    check_req_time_range(req, rule){
        if (!rule.max_req_time && !rule.min_req_time)
            return false;
        const time_passed = Date.now()-req.ctx.timeline.req.create;
        const max_time = rule.max_req_time||+Infinity;
        const min_time = rule.min_req_time||0;
        const res = time_passed<=max_time && time_passed>=min_time;
        if (!res && /fast_pool/.test(req.ctx.pool_key))
        {
            this.luminati.session_mgr.remove_session_from_pool(
                req.ctx.session, req.ctx.pool_key);
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
        if (this.luminati.port!=port && this.luminati.opt.handle_abort)
            this.luminati.opt.handle_abort(req.ctx.uuid);
        serv._request(req, res, head);
        serv.once('response', _res=>this.post(req, res, head, _res));
        return true;
    }
    // XXX krzysztof: merge with can_retry()
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
    process_response(req, _res, process_rules, body, action){
        if (action.email)
        {
            this.luminati.sp.spawn(this.luminati._send_rule_mail(
                action.email, 'process data', req.url));
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
    // XXX krzysztof: merge with action()
    _action(req, res, rule){
        if (!this._can_retry(req, res, rule))
            return false;
        req.session = this.gen_session();
        this.retry(req, res, null, rule.retry_port);
        return true;
    }
    action(req, res, head, _res, action, rule, _body){
        const ctx = req.ctx;
        if (action.email)
        {
            this.luminati.sp.spawn(this.luminati._send_rule_mail(
                action.email, rule.action_type, req.url));
        }
        if (action.reserve_session)
        {
            this.luminati.session_mgr.add_reserve_pool_session(ctx.session,
                rule.pool_key);
            ctx.set_rule('Reserve session');
        }
        if (action.fast_pool_session)
        {
            this.luminati.session_mgr.add_fast_pool_session(ctx.session,
                rule.pool_key, action.fast_pool_size);
            ctx.set_rule('Fast pool session');
        }
        const tl = _res && _res.hola_headers &&
            _res.hola_headers['x-hola-timeline-debug'] ||
            _res.headers && _res.headers['x-hola-timeline-debug'];
        if (action.ban_ip && _res)
        {
            const ban = ()=>{
                const t = action.ban_ip||1;
                if (tl)
                    this.luminati.banlist.add(tl.split(' ')[3], t);
                req.session = this.gen_session();
            };
            if (rule.domains)
            {
                if (rule.domains.update(ctx.url).reached_limit(ctx.url))
                    ban();
            }
            else
                ban();
        }
        if (rule.action && rule.action.process)
        {
            this.process_response(req, _res, rule.action.process, _body,
                rule.action);
            return false;
        }
        if (!this.can_retry(req, res, action))
            return false;
        if (action.refresh_ip && _res && tl)
        {
            const refresh_task = this.luminati.refresh_ip(ctx,
                tl.split(' ')[3]);
            this.luminati.refresh_task = refresh_task;
        }
        else if (action.url && _res)
        {
            let _url = action.url;
            if (_url=='location')
                _url = _res.headers.location;
            req.url = _url;
        }
        else
            req.session = this.gen_session();
        this.retry(req, res, head, action.retry_port);
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
