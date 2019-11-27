// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/
const events = require('events');
const tls = require('tls');
const http2 = require('http2');
const util = require('util');
const consts = require('./consts.js');
const ssl = require('./ssl.js');
const {ensure_socket_close, is_ws_upgrade_req} = require('./util.js');
const logger = require('./logger.js').child({category: 'HTTP2'});
const etask = require('../util/etask.js');
const E = module.exports = Http2_handler;

const {
    HTTP2_HEADER_METHOD,
    HTTP2_HEADER_STATUS,
    HTTP2_HEADER_PATH,
    HTTP2_HEADER_SCHEME,
    HTTP2_HEADER_AUTHORITY,
} = http2.constants;

function Http2_handler(serv){
    events.EventEmitter.call(this);
    this.serv = serv;
    this.clients = {};
    this.server = http2.createSecureServer(Object.assign(
        {requestCert: false, allowHTTP1: true}, ssl()), (req, res)=>{
            const remote_ip = serv.req_remote_ip[req.socket.remotePort];
            if (remote_ip && req.socket.remoteAddress=='127.0.0.1')
            {
                logger.debug('request ip fixed %s %s', remote_ip,
                    req.url);
                req.original_ip = remote_ip;
            }
            const auth = serv.authorization[req.socket.remotePort];
            if (auth)
                req.headers['proxy-authorization'] = auth;
            serv.sp.spawn(serv.handler(req, res));
        }
    )
    .on('error', e=>{
        serv.emit('error', e);
    })
    .on('sessionError', e=>{
        if (e.code=='ECONNRESET')
            return logger.info('Connection closed by the client');
        serv.emit('error', e);
    })
    .on('tlsClientError', err=>{
        if (!/unknown ca/.test(err.message))
            return;
        logger.warn(consts.TLS_ERROR_MSG
            +`: ${serv.www_api}/faq#proxy-certificate`);
        serv.emit('tls_error');
    })
    .on('upgrade', (req, socket, head)=>{
        if (!is_ws_upgrade_req(req))
            return ensure_socket_close(socket);
        return serv.sp.spawn(serv.handler(req, socket, head));
    });
    this.on('connection', socket=>this.server.emit('connection', socket));
}

util.inherits(E, events.EventEmitter);

E.prototype.get_client = etask._fn(
function*get_client(_this, task, req, res, head, host){
    const authority = req.headers[HTTP2_HEADER_AUTHORITY];
    const key = `${req.ctx.cred.username}:${host}:${authority}`;
    if (_this.clients[key])
    {
        logger.debug('reusing HTTP2 client: %s', key);
        return _this.clients[key];
    }
    const conn = yield _this.serv.request_new_socket(task, req, res, head,
        host);
    if (!conn || !conn.socket)
        return conn;
    const tls_socket = tls.connect({
        host: authority,
        port: 443,
        socket: conn.socket,
        rejectUnauthorized: !_this.serv.opt.insecure,
        ALPNProtocols: ['h2', 'http/1.1'],
    }, this.continue_fn());
    tls_socket.once('error', this.throw_fn());
    yield this.wait();
    if (tls_socket.alpnProtocol!='h2')
    {
        logger.debug('Server did not agree to use HTTP2. Using HTTPS');
        throw Error(consts.NO_HTTP2_SERVER);
    }
    const client = http2.connect(`https://${authority}`, {
        rejectUnauthorized: !_this.serv.opt.insecure,
        createConnection: ()=>tls_socket,
    }, this.continue_fn());
    client.once('error', this.throw_fn());
    yield this.wait();
    _this.clients[key] = client;
    client.once('close', ()=>delete _this.clients[key]);
    return client;
});

E.prototype.send_proxy_req_fallback = etask._fn(
function*send_proxy_req_fallback(_this, task, req, res, head, host){
    const target_host = req.headers[HTTP2_HEADER_AUTHORITY];
    const pseudo_headers = [HTTP2_HEADER_AUTHORITY, HTTP2_HEADER_METHOD,
        HTTP2_HEADER_SCHEME, HTTP2_HEADER_PATH];
    pseudo_headers.forEach(h=>delete req.ctx.headers[h]);
    req.ctx.is_http2 = false;
    req.ctx.headers.host = target_host;
    return yield _this.serv.send_proxy_req_ssl(task, req, res, head, host);
});

E.prototype.send_proxy_req = etask._fn(
function*send_proxy_req(_this, task, req, res, head, host){
    const ctx = req.ctx;
    try {
        ctx.response.request.url = ctx.url;
        const client = yield _this.get_client(task, req, res, head, host);
        if (!client)
            return;
        const proxy_req = client.request(ctx.format_headers(ctx.headers));
        task.once('cancel', ()=>proxy_req.close());
        proxy_req.host = host;
        ctx.proxies.push(proxy_req);
        if (ctx.response.request.body)
            proxy_req.write(ctx.response.request.body);
        return yield _this.serv.request_handler(req, res, proxy_req, head);
    } catch(e){
        if (e.message==consts.NO_HTTP2_SERVER)
        {
            return yield _this.send_proxy_req_fallback(task, req, res,
                head, host);
        }
        return e;
    }
});

E.prototype.to_http1_res = function(proxy_req, proxy_res){
    const status_code = proxy_res[HTTP2_HEADER_STATUS];
    delete proxy_res[HTTP2_HEADER_STATUS];
    return {
        statusCode: status_code,
        headers: proxy_res,
        on: proxy_req.on.bind(proxy_req),
        once: proxy_req.once.bind(proxy_req),
    };
};

E.prototype.stop = function(){
    Object.values(this.clients).forEach(c=>c.close());
};
