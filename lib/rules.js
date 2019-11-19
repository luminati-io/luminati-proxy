// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true, evil:true*/
const _ = require('lodash');
const cheerio = require('cheerio');
const zutil = require('../util/util.js');
const {migrate_trigger} = require('../util/rules_util.js');
const etask = require('../util/etask.js');
const zurl = require('../util/url.js');
const request = require('request');
const logger = require('./logger.js').child({category: 'Rules'});

const {decode_body, url2domain} = require('./util.js');

class Rules {
    constructor(server, rules=[]){
        this.server = server;
        this.rules = zutil.clone_deep(rules);
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
    pre(req, res, head){
        if (['STATUS CHECK', 'SESSION KEEP ALIVE'].includes(req.ctx.h_context))
            return;
        const _url = req.ctx.url||req.url_full||req.url;
        const opt = {url: _url};
        for (let i=0; i<this.rules.length; i++)
        {
            const rule = this.rules[i];
            if (rule.type!='before_send' && rule.type!='timeout')
                continue;
            if (!rule.trigger.test(opt))
                continue;
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
        if (['STATUS CHECK', 'SESSION KEEP ALIVE'].includes(req.ctx.h_context))
            return;
        for (let i=0; i<this.rules.length; i++)
        {
            const rule = this.rules[i];
            const status = _res.statusCode || _res.status_code;
            const time_created = _.get(req, 'ctx.timeline.req.create')||0;
            const time_passed = Date.now()-time_created;
            const opt = {url: req.ctx.url, status, time_passed, _res};
            if (rule.type!='after_hdr')
                continue;
            if (!rule.trigger.test(opt) || req.ctx.skip_rule(rule))
                continue;
            this.check_req_time_range(req, rule);
            if (this.action(req, res, head, rule, opt))
                return true;
        }
    }
    post_body(req, res, head, _res, body){
        if (['STATUS CHECK', 'SESSION KEEP ALIVE'].includes(req.ctx.h_context))
            return;
        let _body;
        try {
            _body = decode_body(body, _res.headers['content-encoding']);
        } catch(e){
            logger.error('error decoding body: %s when requesting url %s',
                e.message, req.ctx.url);
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
            if (!rule.trigger.test(opt) || req.ctx.skip_rule(rule))
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
        return res;
    }
    retry(req, res, head, opt={}){
        const {port} = opt;
        if (!req.retry)
            req.retry = 0;
        req.retry++;
        logger.info('req retry %s %s', req.retry, req.ctx.url);
        (req.ctx.proxies||[]).forEach(p=>this.server.abort_proxy_req(req, p));
        this.server.emit('retry', {port: port||this.server.port, req, res,
            head, post: _res=>this.post(req, res, head, _res)});
        return true;
    }
    can_retry(req, action={}){
        const retried = req.retry||0;
        let retry = Number(action.retry)||0;
        if (action.retry_port)
            retry = 20;
        return retried<retry;
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
    action(req, res, head, rule, opt){
        // XXX krzysztof: temp work-around to get IP. Should be moved to
        // server.js and check why SMTP requests don't get to handler
        if (req.ctx && req.ctx.session)
        {
            req.ctx.session.last_res = req.ctx.session.last_res||{};
            req.ctx.session.last_res.ip = opt._res && opt._res.headers &&
                opt._res.headers['x-hola-ip'];
        }
        // XXX krzysztof: bad design - code should not be aware of tests
        if (req.ctx && req.ctx.rule_executed)
            req.ctx.rule_executed(rule);
        // XXX krzysztof: find out why this.lumina.sp is sometimes null here
        if (this.server.sp)
            this.server.sp.spawn(this.server.send_email(rule, opt.url));
        if (rule.action.null_response)
            return this.server.router.send_null_response(req, res);
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
            this.server.session_mgr.add_to_pool(req.ctx.session);
        const _res = opt._res;
        const tl = _res && _res.hola_headers &&
            _res.hola_headers['x-hola-timeline-debug'] ||
            _res && _res.headers && _res.headers['x-hola-timeline-debug'];
        const ip = tl && tl.split(' ')[3];
        if (rule.action.ban_ip!=undefined && _res)
        {
            const t = rule.action.ban_ip || 0;
            if (ip)
                this.server.banip(ip, t, req.ctx.session);
        }
        if (rule.action.ban_ip_global!=undefined && _res)
        {
            const t = rule.action.ban_ip_global || 0;
            if (ip)
                this.server.emit('banip_global', {ip, t});
            if (req.ctx.session)
                this.server.session_mgr.replace_session(req.ctx.session);
        }
        if (rule.action.ban_ip_domain!=undefined && _res)
        {
            const t = rule.action.ban_ip_domain || 0;
            const domain = url2domain(opt.url);
            if (ip)
                this.server.banip(ip, t, req.ctx.session, domain);
        }
        if (rule.action.process)
        {
            this.process_response(req, opt._res, opt.body, rule);
            return false;
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
            const refresh_task = this.server.refresh_ip(req.ctx, ip);
            this.server.refresh_task = refresh_task;
        }
        this.server.session_mgr.refresh_sessions();
        this.retry(req, res, head, {port: rule.action.retry_port});
        return 'switched';
    }
}

const E = module.exports = Rules;

class Trigger {
    constructor(r){
        const code = r.trigger_code+'\nreturn trigger;';
        try { this.func = new Function(code)(); }
        catch(e) { logger.warn('trigger: invalid function'); }
    }
    test(opt){
        if (!this.func)
        {
            logger.warn('trigger: invalid function');
            return false;
        }
        try { return this.func(opt||{}); }
        catch(e){ logger.warn('trigger: function failed'); }
        return false;
    }
}

E.t = {Trigger};
