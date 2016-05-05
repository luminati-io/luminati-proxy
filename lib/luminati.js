// LICENSE_CODE ZON
'use strict'; /*jslint node:true, esnext:true*/
const _ = require('underscore');
const http = require('http');
const https = require('https');
const url = require('url');
const tls = require('tls');
const net = require('net');
const request = require('request');
const agent = new http.Agent({keepAlive: true, keepAliveMsecs: 5000});

function write_http_reply(stream, res, headers){
    headers = Object.assign(headers||{}, res.headers);
    if (stream instanceof http.ServerResponse)
        return stream.writeHead(res.statusCode, res.statusMessage, headers);
    var str = `HTTP/1.1 ${res.statusCode} ${res.statusMessage}\r\n`;
    Object.keys(headers).reduce((str, field)=>
        str+`${field}: ${headers[field]}\r\n`, str);
    stream.write(str+'\r\n');
}

function calculate_username(opt){
    let username = `lum-customer-${opt.customer}-zone-${opt.zone||'gen'}`;
    if (opt.country)
        username += `-country-${opt.country}`;
    if (opt.city)
        username += `-city-${opt.city}`;
    if (opt.session)
        username += `-session-${opt.session}`;
    if (opt.asn)
        username += `-asn-${opt.asn}`;
    if (opt.dns)
        username += `-dns-${opt.dns}`;
    if (opt.raw)
        username += '-raw';
    if (opt.direct)
        username += '-direct';
    return username;
}

const Luminati = module.exports = function(opt){
    this.opt = opt;
    this.stats = {};
    opt.proxy.forEach(proxy=>{
        this.stats[proxy] = {
            active_requests: 0,
            max_requests: 0,
            status_code: {},
        };
    });
    let handler = (req, res, head)=>Promise.resolve().then(()=>{
        if (!opt.pool_size)
            return;
        if (!this.sessions)
        {
            this.sessions = [];
            this.session_id = 1;
            return this._pool(opt.pool_size).then(()=>{
                this._log('DEBUG',
                    `initialized pool - ${this.opt.pool_size}`);
                this._pool_ready = true;
            });
        }
        if (this._pool_ready)
        {
            if (this.sessions.length)
                return;
            this._log('WARNING', 'pool size is too small');
            return this._pool(1);
        }
        return new Promise(resolve=>{
            let timer = setInterval(()=>{
                if (!this._pool_ready)
                    return;
                clearInterval(timer);
                if (this.sessions.length)
                    return resolve();
                this._log('WARNING', 'pool size is too small');
                this._pool(1).then(resolve);
            }, 1000);
        });
    }).then(()=>this._request(req, res, head)).catch(err=>{
        this._log('ERROR', `${req.method} ${req.url} - ${err}`);
        if (!res.ended)
        {
            write_http_reply(res, {statusCode: 502,
                statusMessage: 'Bad Gateway',
                headers: {Connection: 'close'}});
        }
        res.end();
    });
    this.http = http.createServer((req, res, head)=>{
        if (req.headers.host=='trigger.domain' ||
            /^\/hola_trigger/.test(req.url))
        {
            return res.end();
        }
        handler(req, res, head);
    });
    if (this.opt.ssl)
    {
        this.https = https.createServer(this.opt.ssl, handler);
        this.http.on('connect', (req, socket, head)=>{
            socket.write(`HTTP/1.1 200 OK\r\n\r\n`);
            socket.pipe(net.connect({host: '127.0.0.1',
                port: this.https.address().port})).pipe(socket);
        });
    }
    else
        this.http.on('connect', handler);
};

Luminati.prototype.listen = function(port){
    return new Promise((resolve, reject)=>{
        this.http.on('error', err=>{
            this.http.removeAllListeners('error');
            reject(err);
        }).listen(port||this.opt.port||23000, ()=>{
            this.http.removeAllListeners('error');
            this.port = this.http.address().port;
            if (!this.https)
                return resolve(this);
            this.https.on('error', err=>{
                this.https.removeAllListener('error');
                reject(err);
            }).listen(()=>{
                this.https.removeAllListeners('error');
                resolve(this);
            });
        });
    });
};

Luminati.prototype._pool = function(count, retries){
    let fetch = (tryout, resolve, reject)=>{
        let session = `${this.port}_${this.session_id++}`;
        let username = calculate_username(Object.assign({session: session},
            _.pick(this.opt, 'customer', 'zone', 'country', 'city', 'asn',
            'raw', 'dns')));
        let proxy = this.opt.proxy.shift();
        this.opt.proxy.push(proxy);
        let opt = {
            url: 'http://lumtest.com/myip.json',
            proxy: `http://${username}:${this.opt.password}@${proxy}:22225`,
            timeout: this.opt.session_timeout,
        };
        request(opt, (err, res, data)=>{
            if (res && res.statusCode==200 &&
                res.headers['content-type'].match(/\/json/))
            {
                let info = JSON.parse(data);
                this._log('DEBUG', `new session added ${proxy}:${session}`,
                    {ip: info.ip});
                this.sessions.push({proxy: proxy, session: session, count: 0,
                    info: info});
                return resolve();
            }
            this._log('WARNING',
                `Failed to establish session ${proxy}:${session}`, {
                    error: err,
                    code: res && res.statusCode,
                    headers: res && res.headers,
                    body: data,
                });
            if (retries && tryout>=retries)
                return reject(new Error('could not establish a session'));
            fetch(tryout+1, resolve, reject);
        });
    };
    let tasks = [];
    for (let i=0; i<count; i++)
        tasks.push(new Promise((resolve, reject)=>fetch(1, resolve, reject)));
    return Promise.all(tasks);
};

Luminati.log_level = {
    ERROR: 0,
    WARNING: 1,
    INFO: 2,
    DEBUG: 3,
};

Luminati.prototype._log = function(level, msg, extra){
    if (Luminati.log_level[level]>Luminati.log_level[this.opt.log])
        return;
    let args = [`${level}:${this.port}: ${msg}`];
    if (extra)
        args.push(extra);
    console.log.apply(console, args);
};

Luminati.prototype._request = function(req, res, head){
    this._log('INFO', `${req.method} ${req.url}`);
    const timestamp = Date.now();
    let session = this.sessions && this.sessions[0];
    let host = session&&session.proxy||this.opt.proxy[0];
    let username = calculate_username(Object.assign({}, this.opt, {
        session: session && session.session,
        direct: this.opt.direct && this.opt.direct.include &&
            this.opt.direct.include.test(req.url) ||
            this.opt.direct && this.opt.direct.exclude &&
            !this.opt.direct.exclude.test(req.url) || false,
    }));
    let stats = this.stats[host];
    stats.active_requests++;
    stats.max_requests = Math.max(stats.max_requests, stats.active_requests);
    this._log('DEBUG', `requesting using ${username}`);
    if (session)
    {
        session.count++;
        if (this.opt.max_requests &&
            session.count>=this.opt.max_requests)
        {
            this.sessions.shift();
            this._log('DEBUG', `switching session ${session.session}`);
            this._pool(1);
        }
    }
    const timeline = {start: Date.now()};
    const handler = (proxy, headers)=>{
        proxy.on('response', _res=>{
            timeline.response = Date.now()-timeline.start;
            stats.active_requests--;
            let code = `${_res.statusCode}`.replace(/(?!^)./g, 'x');
            stats.status_code[code] = (stats.status_code[code]||0)+1;
            this._log('DEBUG', `${req.method} ${req.url} - ${_res.statusCode}`);
            write_http_reply(res, _res, headers);
            _res.pipe(res);
            _res.on('end', ()=>{
                timeline.end = Date.now()-timeline.start;
            });
        }).on('connect', (_res, socket, _head)=>{
            timeline.connect = Date.now()-timeline.start;
            stats.active_requests--;
            write_http_reply(res, _res);
            if (_res.statusCode!=200)
            {
                this._log('ERROR',
                    `${req.method} ${req.url} - ${_res.statusCode}`);
                return res.end();
            }
            this._log('DEBUG', `CONNECT - ${_res.statusCode}`);
            socket.write(head);
            res.write(_head);
            socket.pipe(res).pipe(socket);
        }).on('error', err=>{
            this._log('ERROR', `${req.method} ${req.url} - ${err}`);
            if (!res.ended)
            {
                stats.active_requests--;
                write_http_reply(res, {statusCode: 502,
                    statusMessage: 'Bad Gateway',
                    headers: {Connection: 'close'}});
            }
            res.end();
        });
    };
    const authorization = {'proxy-authorization': 'Basic '+
        new Buffer(username+':'+this.opt.password).toString('base64')};
    if (req.socket instanceof tls.TLSSocket)
    {
        return http.request({
            protocol: 'http:',
            host: host,
            port: 22225,
            method: 'CONNECT',
            path: `${req.headers.host}:443`,
            headers: authorization,
            agent: agent,
        }).on('connect', (_res, socket, _head)=>{
            timeline.connect = Date.now()-timeline.start;
            const proxy = https.request({
                host: req.headers.host,
                method: req.method,
                path: req.url,
                headers: req.headers,
                socket: socket,
                agent: false,
            });
            req.pipe(proxy);
            handler(proxy, _res.headers);
        }).on('error', err=>{
            this._log('ERROR', `${req.method} ${req.url} - ${err}`);
            if (!res.ended)
            {
                stats.active_requests--;
                write_http_reply(res, {statusCode: 502,
                    statusMessage: 'Bad Gateway',
                    headers: {Connection: 'close'}});
            }
            res.end();
        }).end();
    }
    const proxy = http.request({
        protocol: 'http:',
        host: host,
        port: 22225,
        method: req.method,
        path: req.url,
        headers: Object.assign(authorization, req.headers),
        agent: agent,
    });
    if (req.method=='CONNECT')
        proxy.end();
    else
        req.pipe(proxy);
    handler(proxy);
};
