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
        req.ctx.pool_key = req.ctx.h_reserved ? 'reserve_session' : null;
        if (req.ctx.h_context=='STATUS CHECK' || !this._pre)
            return;
        const _url = req.ctx.url||req.url_full||req.url;
        const opt = {url: _url};
        for (let i=0; i<this._pre.length; i++)
        {
            const rule = this._pre[i];
            if (rule.type!='before_send' && rule.type!='timeout')
                continue;
            if (!rule.trigger.test(opt, req.ctx))
                continue;
            else if (rule.pool_key && !req.ctx.pool_key)
                req.ctx.pool_key = rule.pool_key;
            if (rule.type=='timeout' && opt.timeout)
            {
                const _this = this;
                req.min_req_task = etask(function*min_req_time(){
                    yield etask.sleep(opt.timeout);
                    _this.action(req, res, head, rule, opt);
                });
                return false;
            }
            return this.action(req, res, head, rule, opt);
        }
    }
    post(req, res, head, _res){
        if (req.ctx.h_context=='STATUS CHECK'||!this._post)
            return;
        for (let i=0; i<this._post.length; i++)
        {
            const rule = this._post[i];
            const status = _res.statusCode||_res.status_code;
            const time_created = _.get(req, 'ctx.timeline.req.create')||0;
            const time_passed = Date.now()-time_created;
            const opt = {url: req.ctx.url, status, time_passed, _res};
            if (rule.type!='after_hdr')
                continue;
            if (!rule.trigger.test(opt, req.ctx)||req.ctx.skip_rule(rule))
                continue;
            this.check_req_time_range(req, rule);
            if (this.action(req, res, head, rule, opt))
                return true;
        }
    }
    post_body(req, res, head, _res, body){
        if (req.ctx.h_context=='STATUS CHECK'||!this._post)
            return;
        const _body = decode_body(body, _res.headers['content-encoding']);
        for (let i=0; i<this._post.length; i++)
        {
            const rule = this._post[i];
            const status = _res.statusCode||_res.status_code;
            const time_passed = Date.now()-req.ctx.timeline.req.create;
            const opt = {url: req.ctx.url, status, body: _body, time_passed,
                _res};
            if (rule.type!='after_body'||!rule.trigger.test(opt, req.ctx))
                continue;
            this.check_req_time_range(req, rule);
            if (this.action(req, res, head, rule, opt))
                return true;
        }
    }
    post_need_body(req){
        return (this._post||[]).some(rule=>rule.type=='after_body');
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
        const serv = port && this.luminati.get_other_port(port) ||
            this.luminati;
        req.ctx.rules = serv.rules;
        req.ctx.port = serv.port;
        (req.ctx.proxies||[]).forEach(p=>
            this.luminati._abort_proxy_req(req, p));
        if (this.luminati.port!=port && this.luminati.opt.handle_abort)
            this.luminati.opt.handle_abort(req.ctx.uuid);
        serv._request(req, res, head);
        serv.once('response', _res=>this.post(req, res, head, _res));
        return true;
    }
    can_retry(req, action={}){
        const retried = req.retry||0;
        const port = action.retry_port;
        if (port && !this.luminati.get_other_port(port))
            return false;
        let retry = Number(action.retry)||0;
        if (action.retry_port)
            retry = 20;
        return retried<retry;
    }
    gen_session(){
        return 'rand'+Math.floor(Math.random()*9999999+1000000);
    }
    process_response(req, _res, body, rule){
        const process_rules = rule.action.process;
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
    action(req, res, head, rule, opt){
        this.luminati.sp.spawn(this.luminati._send_rule_mail(rule, opt.url));
        if (rule.action.null_response)
            return this.luminati.router.send_null_response(req, res);
        if (rule.action.bypass_proxy)
        {
            req.ctx.is_bypass_proxy = true;
            return;
        }
        if (rule.action.direct)
        {
            req.ctx.is_direct = true;
            return;
        }
        if (rule.action.reserve_session)
        {
            this.luminati.session_mgr.add_reserve_pool_session(req.ctx.session,
                rule.pool_key);
        }
        if (rule.action.fast_pool_session)
        {
            this.luminati.session_mgr.add_fast_pool_session(req.ctx.session,
                rule.pool_key, rule.action.fast_pool_size);
        }
        const _res = opt._res;
        const tl = _res && _res.hola_headers &&
            _res.hola_headers['x-hola-timeline-debug'] ||
            _res && _res.headers && _res.headers['x-hola-timeline-debug'];
        if (rule.action.ban_ip && _res)
        {
            const t = rule.action.ban_ip||1;
            if (tl)
                this.luminati.banlist.add(tl.split(' ')[3], t);
            req.session = this.gen_session();
        }
        if (rule.action.process)
        {
            this.process_response(req, opt._res, opt.body, rule);
            return false;
        }
        if (!this.can_retry(req, rule.action))
            return false;
        if (rule.action.refresh_ip && opt._res && tl)
        {
            const refresh_task = this.luminati.refresh_ip(req.ctx,
                tl.split(' ')[3]);
            this.luminati.refresh_task = refresh_task;
        }
        else
            req.session = this.gen_session();
        this.retry(req, res, head, rule.action.retry_port);
        if (rule.action.retry_port && req.ctx.rule_executed)
            req.ctx.rule_executed(rule);
        return 'switched';
    }
}

const E = module.exports = Rules;

class Trigger {
    constructor(r){
        this.code = r.trigger_code;
    }
    test(opt, ctx){
        opt = opt||{};
        const code = this.code+'\nreturn trigger;';
        try {
            const func = new Function(code)();
            return func(opt);
        } catch(e){ ctx.log.warn('trigger: function failed'); }
        return false;
    }
}

E.Trigger = Trigger;
