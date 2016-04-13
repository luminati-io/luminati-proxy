// LICENSE_CODE ZON
'use strict'; /*jslint node:true, esnext:true*/
const _ = require('underscore');
const http = require('http');
const url = require('url');
const request = require('request');
let agent = new http.Agent({keepAlive: true, keepAliveMsecs: 5000});

function write_http_reply(stream, res){
    if (stream instanceof http.ServerResponse)
    {
        return stream.writeHead(res.statusCode, res.statusMessage,
            res.headers);
    }
    var str = `HTTP/1.1 ${res.statusCode} ${res.statusMessage}\r\n`;
    Object.keys(res.headers).reduce((str, field)=>
        str+`${field}: ${res.headers[field]}\r\n`, str);
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
    if (opt.raw)
        username += '-raw';
    if (opt.direct)
        username += '-direct';
    return username;
}

const Luminati = module.exports = function(opt){
    this.opt = opt||{};
    this.stats = {
        active_requests: 0,
        max_requests: 0,
    };
    let handler = (req, res, head)=>Promise.resolve().then(()=>{
        if (!this.opt.pool_size)
            return;
        if (!this.sessions)
        {
            this.sessions = [];
            this.session_id = 1;
            return this._pool(this.opt.pool_size).then(()=>{
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
        if (req.headers.host=='trigger.domain' || /^\/hola_trigger/.test(req.url))
            return res.end();
        handler(req, res, head);
    }).on('connect', handler);
};

Luminati.prototype.listen = function(port){
    return new Promise((resolve, reject)=>{
        this.http.on('error', err=>{
            this.http.removeListener('error', reject);
            reject(err);
        }).listen(port||this.opt.port||23000, ()=>{
            this.http.removeListener('error', reject);
            this.port = this.http.address().port;
            resolve(this);
        });
    });
};

Luminati.prototype._pool = function(count, retries){
    let fetch = (tryout, resolve, reject)=>{
        let session = `${this.port}_${this.session_id++}`;
        let username = calculate_username(_.extend({session: session},
            _.pick(this.opt, 'customer', 'zone', 'country', 'city', 'asn',
            'raw')));
        let opt = {
            url: 'http://lumtest.com/myip.json',
            proxy: `http://${username}:${this.opt.password}@${this.opt.host}:22225`,
            timeout: this.opt.session_timeout,
        };
        request(opt, (err, res, data)=>{
            if (res && res.statusCode==200)
            {
                let info = JSON.parse(data);
                this._log('DEBUG', `new session added ${session}`,
                    {ip: info.ip});
                this.sessions.push({session: session, count: 0, info: info});
                return resolve();
            }
            this._log('WARNING', `Failed to establish session ${session}`, {
                error: err,
                code: res && res.statusCode,
                headers: res && res.headers,
                data: data,
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
    if (Luminati.log_level[level]>this.opt.log)
        return;
    let args = [`${level}:${this.port}: ${msg}`];
    if (extra)
        args.push(extra);
    console.log.apply(console, args);
};

Luminati.prototype._request = function(req, res, head){
    this.stats.active_requests++;
    this.stats.max_requests = Math.max(this.stats.max_requests,
        this.stats.active_requests);
    this._log('INFO', `${req.method} ${req.url}`);
    let session = this.sessions[0];
    let username = calculate_username(_.extend({}, this.opt, {
        session: session && session.session,
        direct: this.opt.direct && this.opt.direct.include &&
            this.opt.direct.include.test(req.url) ||
            this.opt.direct && this.opt.direct.exclude &&
            !this.opt.direct.exclude.test(req.url) || false,
    }));
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
    req.headers['proxy-authorization'] = 'Basic '+
        new Buffer(username+':'+this.opt.password).toString('base64');
    let proxy = http.request({
        protocol: 'http:',
        host: this.opt.host,
        port: 22225,
        method: req.method,
        path: req.url,
        headers: req.headers,
        agent: agent,
    });
    if (req.method=='CONNECT')
        proxy.end();
    else
        req.pipe(proxy);
    proxy.on('response', _res=>{
        this.stats.active_requests--;
        this._log('DEBUG', `${req.method} ${req.url} - ${_res.statusCode}`);
        write_http_reply(res, _res);
        _res.pipe(res);
    }).on('connect', (_res, socket, _head)=>{
        this.stats.active_requests--;
        write_http_reply(res, _res);
        if (_res.statusCode!=200)
        {
            this._log('ERROR',
                `${req.method} ${req.url} - ${_res.statusCode}`);
            return res.end();
        }
        socket.write(head);
        res.write(_head);
        socket.pipe(res).pipe(socket);
    }).on('error', err=>{
        this._log('ERROR', `${req.method} ${req.url} - ${err}`);
        if (!res.ended)
        {
            this.stats.active_requests--;
            write_http_reply(res, {statusCode: 502,
                statusMessage: 'Bad Gateway',
                headers: {Connection: 'close'}});
        }
        res.end();
    });
};
