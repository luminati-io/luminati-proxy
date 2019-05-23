// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true, evil:true*/
const _ = require('lodash');
const cheerio = require('cheerio');
const zutil = require('../util/util.js');
const {migrate_trigger} = require('../util/rules_util.js');
const etask = require('../util/etask.js');
const {decode_body, url2domain} = require('./util.js');

class Rules {
    constructor(luminati, rules=[]){
        this.luminati = luminati;
        this.rules = zutil.clone_deep(rules);
        this.rules = this.rules.map(rule=>{
            // XXX krzysztof: get rid of this preinitialization: bad design
            if (_.get(rule, 'action.reserve_session'))
                rule.pool_key = 'reserve_session';
            if (!rule.type || !rule.trigger_code)
                rule = migrate_trigger(rule);
            rule.trigger = new Trigger(rule);
            return rule;
        });
        this.rules.forEach(rule=>{
            // XXX krzysztof: get rid of this preinitialization: bad design
            if (!_.get(rule, 'action.fast_pool_session'))
                return;
            rule.pool_key = `fast_pool:${rule.url}`;
            this.rules.push({url: rule.url, pool_key: rule.pool_key});
        });
        this.rules.sort(function(a, b){
            a.action = a.action||{};
            b.action = b.action||{};
            const a_retry = a.action.retry || a.action.retry_port;
            const b_retry = b.action.retry || b.action.retry_port;
            if (a_retry==b_retry)
                return 0;
            if (a_retry && !b_retry)
                return 1;
            return -1;
        });
    }
    pre(req, res, head){
        req.ctx.pool_key = req.ctx.h_reserved ? 'reserve_session' : null;
        if (req.ctx.h_context=='STATUS CHECK')
            return;
        const _url = req.ctx.url||req.url_full||req.url;
        const opt = {url: _url};
        for (let i=0; i<this.rules.length; i++)
        {
            const rule = this.rules[i];
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
        if (req.ctx.h_context=='STATUS CHECK')
            return;
        for (let i=0; i<this.rules.length; i++)
        {
            const rule = this.rules[i];
            const status = _res.statusCode||_res.status_code;
            const time_created = _.get(req, 'ctx.timeline.req.create')||0;
            const time_passed = Date.now()-time_created;
            const opt = {url: req.ctx.url, status, time_passed, _res};
            if (rule.type!='after_hdr')
                continue;
            if (!rule.trigger.test(opt, req.ctx) || req.ctx.skip_rule(rule))
                continue;
            this.check_req_time_range(req, rule);
            if (this.action(req, res, head, rule, opt))
                return true;
        }
    }
    post_body(req, res, head, _res, body){
        if (req.ctx.h_context=='STATUS CHECK')
            return;
        let _body;
        try {
            _body = decode_body(body, _res.headers['content-encoding']);
        } catch(e){
            req.ctx.log.error('error decoding body: %s when requesting url %s',
                e.messgae, req.ctx.url);
            return;
        }
        for (let i=0; i<this.rules.length; i++)
        {
            const rule = this.rules[i];
            const status = _res.statusCode||_res.status_code;
            const time_passed = Date.now()-req.ctx.timeline.req.create;
            const opt = {url: req.ctx.url, status, body: _body, time_passed,
                _res};
            if (rule.type!='after_body')
                continue;
            if (!rule.trigger.test(opt, req.ctx) || req.ctx.skip_rule(rule))
                continue;
            this.check_req_time_range(req, rule);
            let res_action;
            if (res_action = this.action(req, res, head, rule, opt))
                return res_action;
        }
    }
    post_need_body(req){
        return this.rules.some(rule=>rule.type=='after_body');
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
    retry(req, res, head, opt={}){
        const {port} = opt;
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
        // XXX krzysztof: bad design - code should not be aware of tests
        if (req.ctx && req.ctx.rule_executed)
            req.ctx.rule_executed(rule);
        // XXX krzysztof: find out why this.lumina.sp is sometimes null here
        if (this.luminati.sp)
            this.luminati.sp.spawn(this.luminati.send_email(rule, opt.url));
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
            this.luminati.session_mgr.add_to_pool(req.ctx.session);
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
        if (rule.action.ban_ip!=undefined && _res)
        {
            const t = rule.action.ban_ip||0;
            if (tl)
                this.luminati.banip(tl.split(' ')[3], t, req.ctx.session);
            req.session = this.gen_session();
        }
        if (rule.action.ban_ip_domain!=undefined && _res)
        {
            const t = rule.action.ban_ip_domain||0;
            const domain = url2domain(opt.url);
            if (tl)
            {
                this.luminati.banip(tl.split(' ')[3], t, req.ctx.session,
                    domain);
            }
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
            req.session = this.gen_session();
        }
        else
            req.session = this.gen_session();
        this.retry(req, res, head, {port: rule.action.retry_port});
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
