// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true, evil: true, es9: true*/
const stream = require('stream');
const zerr = require('../../util/zerr.js');
const date = require('../../util/date.js');
const etask = require('../../util/etask.js');
const lutil = require('../util.js');
const consts = require('../consts.js');
const mixin_core = require('./core.js');

const MIXIN_LABEL = module.exports = 'server_handle';

const E = mixin_core.new_mixin(MIXIN_LABEL);

const {SEC} = date.ms;
const {write_http_reply, req_util, res_util} = lutil;

E.static.create_count_stream = (resp, limit)=>new stream.Transform({
    transform(data, encoding, cb){
        if (limit!=-1 && (!limit || resp.body_size<limit))
        {
            const chunk = limit ? limit-resp.body_size : Infinity;
            resp.body.push(data.slice(0, chunk));
        }
        resp.body_size += data.length;
        cb(null, data);
    },
});

E.prototype.handler = etask._fn(function*handler(_this, req, res, head){
    res.once('close', ()=>{
        _this.timeouts.set_timeout(()=>{
            this.return();
        });
    });
    req.once('close', ()=>{
        if (req.readableAborted)
            _this.timeouts.set_timeout(()=>this.return());
    });
    try {
        req.start_time = Date.now();
        if (!_this.is_whitelisted(req))
            return _this.send_unauthorized(req, res);
        if (_this.bw_limit_exp)
        {
            if (_this.bw_limit_exp>date())
                return _this.send_bw_limit_reached(req, res);
            _this.bw_limit_exp = false;
        }
        this.finally(()=>{
            _this.complete_req(this.error, req, res, this.info);
        });
        // to close ongoing requests once bw limit is reached
        _this.store_request(req);
        _this.active++;
        if (_this.active==1)
            _this.emit('idle', false);
        req.once('timeout', ()=>this.throw(new Error('request timeout')));
        let x_ports_error = _this.process_x_ports_header(req);
        if (x_ports_error)
            _this.logger.warn('X-LPM-PORTS Error: %s', x_ports_error);
        this.info.url = req.url;
        this.info.req = req;
        if (_this.opt.throttle)
            yield _this.throttle_mgr.throttle(this, req.url);
        return yield _this.lpm_request(req, res, head);
    } catch(e){
        _this.logger.warn('handler: %s %s %s', req.method,
            req_util.full_url(req), e.message);
        _this.emit('request_error', e);
        throw e;
    }
});

E.prototype.complete_req = function(err, req, res, et_info){
    if (!req.ctx)
    {
        this.logger.warn('ctx does not exist');
        req.ctx = {};
    }
    try {
        if (err && err.proxy_error)
            this.send_error(req.method, req.ctx.url, res, err, 'luminati');
        else if (err)
            this.send_error(req.method, req.ctx.url, res, err, 'lpm');
        if (this.opt.throttle)
            this.throttle_mgr.release(req.url, et_info);
        this.active--;
        if (!this.active)
            return this.emit('idle', true);
    } catch(e){
        this.logger.error('unexpected error: %s', zerr.e2s(e));
    }
};

E.prototype.handle_custom_error = function(e, req, res, ctx){
    if (!this.is_custom_error(e))
        return;
    if (e.message=='Authentication failed')
    {
        this.logger.info('%s %s 502 %s', req.method, ctx.url, e.message);
        write_http_reply(res, {
            statusCode: 502,
            statusMessage: 'Proxy Manager - Authentication failed',
        }, undefined, this.opt, true);
        return true;
    }
};

E.prototype.request_handler = etask._fn(
function*request_handler(_this, req, res, proxy, head, headers){
    const ctx = req && req.ctx;
    const ensure_end_task = ()=>_this.timeouts.set_timeout(()=>{
        if (etask.is_final(this))
            return;
        _this.logger.debug('closing long connection after 15 seconds');
        this.return(ctx && ctx.response);
    }, 15*SEC);
    this.once('cancel', ()=>_this.abort_proxy_req(req, proxy, this));
    if (proxy.setTimeout)
        proxy.setTimeout(ctx.timeout);
    proxy.once('response', _this.handle_proxy_resp(req, res, proxy, this,
        head, headers))
    .once('connect', _this.handle_proxy_connect(req, res, proxy, this, head))
    .once('upgrade', _this.handle_proxy_upgrade(req, res, proxy, this, head))
    .once('error', _this.handle_proxy_error(req, res, proxy, this, head,
        headers))
    .once('timeout', _this.handle_proxy_timeout(req, res, proxy, this))
    .once('close', ensure_end_task);
    return yield this.wait();
});

E.prototype.handle_proxy_timeout = function(req, res, proxy, task){
    return ()=>{
        const ctx = req.ctx;
        this.ensure_socket_close(proxy);
        this.logger.debug('socket inactivity timeout: %s', ctx.url);
        task.return();
    };
};

E.prototype.handle_session_termination = function(req, res){
    if (req && req.ctx && req.ctx.session)
        req.ctx.session.terminated = true;
    if (req && res)
        return this.router.send_internal_redirection(req, res);
};

E.prototype.handle_proxy_resp = function(req, res, proxy, task, head,
    _headers)
{
    let _this = this;
    return etask._fn(function*(_that, proxy_res){
        if (_this.opt.session_termination && proxy_res.statusCode==502 &&
            proxy_res.headers &&
            proxy_res.headers['x-luminati-error']==consts.NO_PEERS_ERROR)
        {
            const resp = _this.handle_session_termination(req, res);
            task.return(resp);
        }
        if (proxy.aborted)
            return;
        const ctx = req.ctx;
        // if connect event did not handled
        if (req.min_conn_task)
        {
            req.min_conn_task.return();
            req.min_conn_task = null;
        }
        if (req.min_req_task)
        {
            req.min_req_task.return();
            req.min_req_task = null;
        }
        if (ctx.responded)
            return _this.abort_proxy_req(req, proxy, task);
        if (ctx.response.proxy && proxy.socket)
            ctx.response.proxy.host = proxy.socket.remoteAddress;
        ctx.proxies.forEach(p=>p!=proxy && _this.abort_proxy_req(req, p));
        ctx.responded = true;
        const har_limit = res_util.is_one_of_types(proxy_res,
            ['image', 'javascript', 'css']) ? -1 : _this.opt.har_limit;
        const count_stream = E.static.create_count_stream(ctx.response,
            har_limit);
        try {
            ctx.timeline.track('response');
            _this.check_proxy_response(proxy_res);
            const ip = proxy_res.headers['x-luminati-ip']
                || proxy_res.headers['x-brd-ip'];
            const domain = req_util.get_domain(req);
            if (_this.is_ip_banned(ip, domain) &&
                (req.retry||0)<_this.opt.max_ban_retries)
            {
                _this.refresh_sessions();
                return _this.rules.retry(req, res, head);
            }
            else if (_this.is_ip_banned(ip, domain))
                throw new Error('Too many banned IPs');
            if (ctx.session)
            {
                ctx.session.last_res = {ts: Date.now(), ip,
                    session: ctx.session.session};
            }
            if (!res.resp_written)
            {
                proxy_res.hola_headers = _headers;
                if (_this.should_redirect(req, proxy_res))
                {
                    return yield _this.redirect_req(req, res, head, proxy,
                        proxy_res);
                }
                if (yield _this.rules.post(req, res, head, proxy_res))
                    return _this.abort_proxy_req(req, proxy);
                else if (_this.rules.post_need_body(req, proxy_res))
                {
                    const temp_data = [];
                    let temp_data_size = 0;
                    const prest_on_error = _this.log_throw_fn(task, ctx,
                        'handle_proxy_resp, proxy_res');
                    const on_first_byte = ()=>
                        ctx.timeline.track('first_byte');
                    const on_data = data=>{
                        temp_data.push(data);
                        temp_data_size += data.length;
                    };
                    proxy_res.once('data', on_first_byte);
                    proxy_res.on('data', on_data);
                    proxy_res.once('end', etask._fn(function*(){
                        const rule_res = yield _this.rules.post_body(req, res,
                            head, proxy_res, temp_data);
                        if (rule_res)
                            return _this.abort_proxy_req(req, proxy);
                        const has_body = !!ctx.response.body.length;
                        ctx.response.body_size = has_body ?
                            ctx.response.body[0].length : 0;
                        for (let i=0; i<temp_data.length; i++)
                        {
                            if (ctx.response.body_size>=har_limit || has_body)
                                break;
                            const l = har_limit-ctx.response.body_size;
                            const new_piece = temp_data[i].slice(0, l);
                            ctx.response.body.push(new_piece);
                            ctx.response.body_size += new_piece.length;
                        }
                        ctx.response.body_size = temp_data_size;
                        write_http_reply(res, proxy_res, _headers, _this.opt);
                        const res_data = has_body ?
                            ctx.response.body : temp_data;
                        for (let i=0; i<res_data.length; i++)
                            res.write(res_data[i]);
                        res.end();
                        Object.assign(ctx.response, {
                            status_code: proxy_res.statusCode,
                            status_message: proxy_res.statusMessage,
                            headers: Object.assign({}, proxy_res.headers,
                            _headers||{}),
                        });
                        proxy_res.removeListener('error', prest_on_error);
                        proxy_res.removeListener('data', on_first_byte);
                        proxy_res.removeListener('data', on_data);
                        task.return(ctx.response);
                    })).once('error', prest_on_error);
                    return;
                }
            }
            write_http_reply(res, proxy_res, _headers, _this.opt);
            proxy_res.pipe(count_stream).pipe(res);
            const on_first_byte = ()=>ctx.timeline.track('first_byte');
            proxy_res.once('data', on_first_byte);
            const pres_on_error = _this.log_throw_fn(task, ctx, 'proxy_res');
            proxy_res.once('end', ()=>{
                Object.assign(ctx.response, {
                    status_code: proxy_res.statusCode,
                    status_message: proxy_res.statusMessage,
                    headers: Object.assign({}, proxy_res.headers,
                        _headers||{}),
                });
                proxy_res.removeListener('error', pres_on_error);
                proxy_res.removeListener('data', on_first_byte);
                task.return(ctx.response);
            }).once('error', pres_on_error);
        } catch(e){
            _this.logger.error('handle_proxy_resp error: %s', zerr.e2s(e));
            task.throw(e);
        }
    });
};

E.prototype.handle_proxy_connect = function(req, res, proxy, task, head){
    let _this = this;
    return etask._fn(function*(_that, proxy_res, proxy_socket, proxy_head){
        if (proxy.aborted)
            return;
        const ctx = req.ctx;
        if (ctx.connected)
            return _this.abort_proxy_req(req, proxy);
        if (ctx.response.proxy && proxy.socket)
            ctx.response.proxy.host = proxy.socket.remoteAddress;
        ctx.proxies.forEach(p=>p!=proxy && _this.abort_proxy_req(req, p));
        ctx.connected = true;
        if (req.min_conn_task)
        {
            req.min_conn_task.return();
            req.min_conn_task = null;
        }
        const har_limit = _this.opt.smtp ? _this.opt.har_limit : -1;
        const resp_counter = E.static.create_count_stream(ctx.response,
            har_limit);
        try {
            ctx.timeline.track('connect');
            const proxy_err = _this.check_proxy_response(proxy_res);
            const task_throw = task.throw_fn();
            const res_resume = ()=>res.resume();
            const on_first_byte = ()=>ctx.timeline.track('first_byte');
            const on_res_end = ()=>etask(function*_on_res_end(){
                res.removeListener('end', on_res_end);
                res.removeListener('finish', on_res_end);
                res.removeListener('error', task_throw);
                res.removeListener('unpipe', res_resume);
                if (yield _this.handle_smtp_rules(req, res, head, proxy_res,
                        proxy))
                {
                    return;
                }
                task.return(ctx.response);
            });
            if (proxy_err)
            {
                return !proxy_err.code || proxy_err.code==502 ?
                    task.throw(proxy_err) : write_http_reply(res, proxy_res,
                    {}, _this.opt, true);
            }
            if (_this.should_redirect(req, proxy_res))
            {
                return yield _this.redirect_req(req, res, head, proxy,
                    proxy_res);
            }
            if (yield _this.rules.post(req, res, head, proxy_res))
                return _this.abort_proxy_req(req, proxy);
            if (res.lpm_onconnect)
                res.lpm_onconnect(proxy_res);
            else
                write_http_reply(res, proxy_res, {}, _this.opt);
            Object.assign(ctx.response, {
                status_code: proxy_res.statusCode,
                status_message: proxy_res.statusMessage,
                headers: proxy_res.headers,
            });
            if (proxy_res.statusCode!=200)
            {
                res.end();
                return task.return(ctx.response);
            }
            res.write(proxy_head);
            proxy_socket.write(head);
            proxy_socket.pipe(resp_counter).pipe(res).pipe(proxy_socket);
            proxy_socket.once('data', on_first_byte);
            // for https requests 'unpipe' might happen before 'Close Notify'
            // is received so need to drain socket for 'end' to be emitted
            res.on('unpipe', res_resume);
            proxy_res.on('error', task_throw);
            res.on('error', task_throw);
            res.once('end', on_res_end);
            res.once('finish', on_res_end);
            proxy_socket.once('error', err=>{
                _this.logger.warn('error on proxy_socket: %s', err.message);
            }).once('end', ()=>{
                if (ctx.timeline.get('end'))
                    return task.return();
            });
        } catch(e){
            _this.logger.error('handle_proxy_connect error: %s', zerr.e2s(e));
            task.throw(e);
        }
    });
};

E.prototype.handle_smtp_rules = etask._fn(
function*_handle_smtp_rules(_this, req, res, head, proxy_res, proxy){
    if (!(_this.opt.smtp&&_this.opt.smtp.length ||
          req.ctx.url.endsWith(':25')))
    {
        return false;
    }
    const applied = yield _this.rules.post(req, res, head, proxy_res);
    if (!applied && _this.rules.post_need_body(req))
    {
        if (yield _this.rules.post_body(req, res, head, proxy_res,
          req.ctx.response.body))
        {
            return _this.abort_proxy_req(req, proxy);
        }
    }
    return applied;
});

E.prototype.handle_proxy_upgrade = function(req, socket, proxy, task, head){
    return (proxy_res, proxy_socket, proxy_head)=>{
        if (proxy.aborted)
            return;
        const ctx = req.ctx;
        if (ctx.upgraded)
            return this.abort_proxy_req(req, proxy);
        ctx.proxies.forEach(p=>p!=proxy && this.abort_proxy_req(req, p));
        ctx.upgraded = true;
        this.logger.info('Upgrade: %s %s %s %s', req.method, ctx.url,
            proxy_res.statusCode, proxy_res.statusMessage);
        if (head && head.length)
            socket.unshift(head);
        if (proxy_head && proxy_head.length)
            proxy_socket.unshift(proxy_head);
        Object.assign(ctx.response, {
            status_code: proxy_res.statusCode,
            headers: proxy_res.headers,
        });
        ctx.timeline.track('connect');
        if (!socket.writable)
        {
            this.ensure_socket_close(socket);
            this.ensure_socket_close(proxy_socket);
            return task.return(ctx.response);
        }
        write_http_reply(socket, proxy_res, {}, this.opt);
        socket.once('end', ()=>{
            task.return(ctx.response);
        });
        this.ws_handler.handle_connection(socket, proxy_socket);
    };
};

E.prototype.abort_proxy_req = function(req, proxy, task){
    req.unpipe(proxy);
    proxy.destroy();
    if (task)
        task.return('abort');
};

E.prototype.handle_proxy_error = function(req, res, proxy, task, head,
    headers)
{
    return err=>{
        const ctx = req.ctx;
        if (proxy.aborted||ctx.responded||ctx.connected)
            return;
        const proxy_err = this.check_proxy_response(res || {statusCode: 502});
        this.log_fn(proxy_err||err, ctx, 'handle_proxy_error');
        const can_retry = this.rules.can_retry(req,
            {retry: ctx.proxy_retry});
        if (proxy_err && proxy_err.can_retry && can_retry)
        {
            this.rules.retry(req, res, head);
            this.abort_proxy_req(req, proxy);
            return;
        }
        this.abort_proxy_req(req, proxy);
        err = proxy_err||err;
        err.payload = {headers};
        return ctx.req_sp.throw(err);
    };
};
