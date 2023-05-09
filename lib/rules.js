// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/
const request = require('request');
const zutil = require('../util/util.js');
const {migrate_trigger} = require('../util/rules_util.js');
const etask = require('../util/etask.js');
const zurl = require('../util/url.js');
const logger = require('./logger.js').child({category: 'Rules'});
const lutil = require('./util.js');

class Rules {
    constructor(server, rules=[]){
        this.server = server;
        this.rules = zutil.clone_deep(rules);
        if (!Array.isArray(this.rules))
            this.rules = [];
        this.rules = this.rules.map(rule=>{
            if (!rule.type || !rule.trigger_code)
                rule = migrate_trigger(rule);
            rule.trigger = new Trigger(rule);
            return rule;
        });
        const rule_to_priority = rule=>{
            const action = rule.action||{};
            if (action.retry)
                return 1;
            if (action.retry_port)
                return 2;
            return 0;
        };
        this.rules.sort(function(a, b){
            return rule_to_priority(a)-rule_to_priority(b);
        });
    }
    has_reserve_session_rules(){
        return this.rules.some(r=>r.action && r.action.reserve_session);
    }
    try_from_cache(rule, url){
        const regexp = new RegExp(String(rule.url));
        return rule.action.cache && regexp.test(url);
    }
    *pre(req, res, head){
        if ('STATUS CHECK'==req.ctx.h_context)
            return;
        const _url = req.ctx.url||req.url_full||req.url;
        const opt = {url: _url, pre: 1, sent_reqs: req.ctx.retry};
        for (let i=0; i<this.rules.length; i++)
        {
            const rule = this.rules[i];
            if (rule.active===false)
                continue;
            if (rule.type!='before_send' && rule.type!='timeout' &&
                !rule.action.cache)
            {
                continue;
            }
            rule.url = rule.url||'';
            if (!rule.trigger.test(opt) && !this.try_from_cache(rule, opt.url))
                continue;
            if (rule.type=='timeout' && opt.timeout)
            {
                const _this = this;
                req.min_req_task = etask(function*min_req_time(){
                    yield etask.sleep(opt.timeout);
                    yield _this.action(req, res, head, rule, opt);
                });
                return false;
            }
            return yield this.action(req, res, head, rule, opt);
        }
    }
    *post(req, res, head, _res){
        if ('STATUS CHECK'==req.ctx.h_context)
            return;
        for (let i=0; i<this.rules.length; i++)
        {
            const rule = this.rules[i];
            if (rule.active===false)
                continue;
            const status = _res.statusCode || _res.status_code;
            const time_created = zutil.get(req, 'ctx.timeline.req.create')||0;
            const time_passed = Date.now()-time_created;
            const opt = {url: req.ctx.url, status, time_passed, _res, post: 1,
                sent_reqs: req.ctx.retry+1};
            if (rule.type!='after_hdr')
                continue;
            if (!rule.trigger.test(opt) || req.ctx.skip_rule(rule))
                continue;
            this.check_req_time_range(req, rule);
            if (yield this.action(req, res, head, rule, opt))
                return true;
        }
    }
    *post_body(req, res, head, _res, body){
        if ('STATUS CHECK'==req.ctx.h_context)
            return;
        let _body;
        try {
            _body = lutil.decode_body(body, _res.headers['content-encoding']);
        } catch(e){
            logger.error('error decoding body: %s when requesting url %s',
                e.message, req.ctx.url);
            return;
        }
        for (let i=0; i<this.rules.length; i++)
        {
            const rule = this.rules[i];
            if (rule.active===false)
                continue;
            const status = _res.statusCode||_res.status_code;
            const time_passed = Date.now()-req.ctx.timeline.req.create;
            const opt = {url: req.ctx.url, status, body: _body, time_passed,
                _res, post_body: 1, res_data: body,
                sent_reqs: req.ctx.retry+1};
            if (rule.type!='after_body' && !rule.action.cache)
                continue;
            if (!rule.trigger.test(opt) || req.ctx.skip_rule(rule))
                continue;
            this.check_req_time_range(req, rule);
            let res_action;
            if (res_action = yield this.action(req, res, head, rule, opt))
                return res_action;
        }
    }
    will_cache(req, proxy_res){
        return proxy_res && this.rules.some(rule=>{
            const opt = {url: req.ctx.url, status: proxy_res.statusCode};
            return rule.active!==false && rule.action && rule.action.cache &&
                rule.trigger.test(opt);
        });
    }
    post_need_body(req, proxy_res){
        return this.will_cache(req, proxy_res) || this.rules.some(rule=>
            rule.type=='after_body' && rule.active!==false);
    }
    check_req_time_range(req, rule){
        if (!rule.max_req_time && !rule.min_req_time)
            return false;
        const time_passed = Date.now()-req.ctx.timeline.req.create;
        const max_time = rule.max_req_time||+Infinity;
        const min_time = rule.min_req_time||0;
        const res = time_passed<=max_time && time_passed>=min_time;
        return res;
    }
    retry(req, res, head, action={}){
        const port = action.retry_port;
        const retry_same = action.retry_same;
        if (!retry_same && (!port || port==this.server.port))
            this.server.refresh_sessions();
        if (!req.retry)
            req.retry = 0;
        req.retry++;
        logger.info('req retry %s %s', req.retry, req.ctx.url);
        (req.ctx.proxies||[]).forEach(p=>this.server.abort_proxy_req(req, p));
        // XXX krzysztof: this is probably a request leak, one request is sent
        // extra when retrying on already retried request
        let _this = this;
        this.server.emit('retry', {
            port: port||this.server.port,
            req,
            res,
            head,
            post: etask._fn(function*_post(_, _res){
                return yield _this.post(req, res, head, _res);
            }),
            opt: {keep_session: retry_same},
        });
        return true;
    }
    can_retry(req, action={}){
        const retried = req.retry||0;
        let retry = Number(action.retry)||0;
        if (retry>3)
            retry = 3;
        if (action.retry_port)
            retry = 20;
        return retried<retry;
    }
    send_request(req, opt, ip){
        if (!zurl.is_valid_url(opt.url))
            return;
        opt.method = opt.method || 'GET';
        const has_payload = opt.method!='GET' && !!opt.payload;
        const url = /^https?:\/\//.test(opt.url) ? opt.url : 'http://'+opt.url;
        const req_opt = {url, method: opt.method};
        if (has_payload)
        {
            const payload = Object.assign({}, opt.payload);
            const k = Object.keys(payload).find(_k=>payload[_k]=='$IP');
            if (k)
                payload[k] = ip;
            req_opt.body = JSON.stringify(payload);
            req_opt.headers = {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(req_opt.body),
            };
        }
        request(req_opt, e=>{
            if (e)
            {
                logger.error('error when requesting url %s : %s', req_opt.url,
                    e.message);
            }
        });
    }
    *action(req, res, head, rule, opt){
        // XXX krzysztof: temp work-around to get IP. Should be moved to
        // server.js and check why SMTP requests don't get to handler
        if (req.ctx && req.ctx.session)
        {
            req.ctx.session.last_res = req.ctx.session.last_res||{};
            req.ctx.session.last_res.ip = opt._res && opt._res.headers &&
                opt._res.headers['x-luminati-ip'];
        }
        if (req.ctx && req.ctx.rule_executed)
            req.ctx.rule_executed(rule);
        if (rule.action.null_response)
        {
            req.ctx.is_null_response = true;
            req.ctx.init_stats();
            return this.server.router.send_null_response(req, res);
        }
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
        if (opt.pre && rule.action.cache &&
            (yield this.server.cache.has(req.ctx.url)))
        {
            req.ctx.is_from_cache = true;
            req.ctx.init_stats();
            return this.server.router.send_cached(req, res,
                yield this.server.cache.get(req.ctx.url));
        }
        if (opt.post_body && rule.action.cache)
        {
            yield this.server.cache.set(req.ctx.url, opt.res_data,
                opt._res.headers);
        }
        if (rule.action.reserve_session)
            this.server.session_mgr.add_to_pool(req.ctx.session);
        const _res = opt._res;
        const headers = _res && _res.hola_headers || _res && _res.headers;
        const ip = headers && headers['x-luminati-ip'];
        const vip = headers && headers['x-luminati-gip'];
        if (rule.action.ban_ip!=undefined && _res)
        {
            const ms = rule.action.ban_ip || 0;
            if (ip)
                this.server.banip(ip, ms, req.ctx.session);
        }
        if (rule.action.ban_ip_global!=undefined && _res)
        {
            const ms = rule.action.ban_ip_global || 0;
            if (ip)
                this.server.emit('banip_global', {ip, ms});
            if (req.ctx.session)
                this.server.session_mgr.replace_session(req.ctx.session);
        }
        if (rule.action.ban_ip_domain!=undefined && _res)
        {
            const ms = rule.action.ban_ip_domain || 0;
            const domain = lutil.url2domain(opt.url);
            if (ip)
                this.server.banip(ip, ms, req.ctx.session, domain);
        }
        if (rule.action.request_url)
        {
            this.send_request(req, rule.action.request_url, ip);
            return false;
        }
        if (!this.can_retry(req, rule.action))
            return false;
        if (rule.action.refresh_ip && opt._res && ip)
        {
            const refresh_task = this.server.refresh_ip(req.ctx, ip, vip);
            this.server.refresh_task = refresh_task;
        }
        this.retry(req, res, head, rule.action);
        return 'switched';
    }
}

const E = module.exports = Rules;

class Trigger {
    constructor(r){
        this.code = r.trigger_code+'\nreturn trigger;';
        try {
            this.func = new Function(this.code)();
        } catch(e){
            logger.warn('trigger: invalid function: %s', this.code);
        }
    }
    test(opt){
        if (!this.func)
        {
            logger.warn('trigger: no function');
            return false;
        }
        try {
            return this.func(opt||{});
        } catch(e){
            logger.warn('trigger: function failed: %s', this.func.toString());
        }
        return false;
    }
}

E.t = {Trigger};
