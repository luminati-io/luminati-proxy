// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/
const _ = require('lodash');
const events = require('events');
const util = require('util');
const hutil = require('hutil');
const date = hutil.date;
const etask = hutil.etask;
const qw = hutil.string.qw;
const assign = Object.assign;
const cluster = require('cluster');
const os = require('os');
const request = require('request');
const log = require('./log.js');
const username = require('./username.js');
const version = require('../package.json').version;

const E = module.exports = Luminati;

const pool_types = {
    sequential: 0,
    'round-robin': 1,
};

const user_agent = 'luminati-proxy-manager/'+version;

const hola_agent = 'proxy='+version+' node='+process.version
+' platform='+process.platform;

const hola_headers = qw`proxy-connection proxy-authentication x-hola-agent
    x-hola-debug x-hola-tunnel-key x-hola-tunnel-ip x-hola-tunnel-session
    x-hola-auth x-hola-unblocker-debug x-hola-session x-hola-cid
    x-hola-country x-hola-forbid-peer x-hola-dst-ips x-hola-ip
    x-hola-immediate x-hola-dns-only x-hola-response x-hola-direct-first
    x-hola-direct-discover x-hola-blocked-response x-hola-conf
    x-hola-headers-only x-hola-unblocker-bext x-hola-dynamic-tunnels
    x-hola-context x-luminati-timeline`;

const rand_range = (start=0, end=1)=>(
    Math.round(start+Math.random()*(end-start)));

const info_request = etask(function*info_request(sess, context){
    let host = sess.host;
    let cred = sess.get_creds();
    let protocol = sess.protocol;
    let proxy_url = `${protocol}://${cred.username}:${cred.password}@${host}:`
    +`${sess.proxy_port}`;
    sess._log.debug('info_request via %s', proxy_url);
    let opt = {
        url: sess.test_url,
        proxy: proxy_url,
        timeout: sess.timeout,
        headers: {
            'x-hola-agent': hola_agent,
            host: 'zproxy.hola.org',
        },
        proxyHeaderWhitelist: hola_headers,
        proxyHeaderExclusiveList: hola_headers,
    };

    const timeline = new Timeline();
    const res = {
        request: {
            method: 'GET',
            url: opt.url,
            headers: opt.headers,
            body: '',
        },
        timeline,
        context,
        body: '',
        proxy: {
            host,
            username: cred.username,
        },
    };
    let err, info;
    try {
        request(opt)
        .on('response', _res=>{
            timeline.track('response');
            assign(res, {
                status_code: _res.statusCode,
                status_message: _res.statusMessage,
                headers: _res.headers,
                raw_headers: _res.rawHeaders,
            });
        })
        .on('data', data=>res.body+=data)
        .on('error', _err=>{
            err = _err;
            this.continue();
        })
        .on('end', ()=>{
            timeline.track('end');
            this.continue();
        });
        yield this.wait();
        if (err)
            throw err;
        res.body_size = res.body.length;
        if (res.status_code==200&&res.headers['content-type'].match(/\/json/))
            info = JSON.parse(res.body);

    } catch(e){
        err = e;
        res.status_code = 502;
    }
    return {res, err, info};
});

function Luminati(opt){
    events.EventEmitter.call(this);
    opt = opt||{};
    this.is_cluster = true;
    this.opt = opt;
}
util.inherits(Luminati, events.EventEmitter);

function Sess_mgr(opt){
    this.opt = opt;
    this.hosts = opt.hosts;
    this._log = log('Session manager', opt.log);
    this.prefix = opt.session_prefix || '';
    this.ips = this.opt.ips||[];
    this.vips = this.opt.vips||[];
    this.pool = new Session_pool(opt);
    this.pool_size = opt.pool_size||1;
    this.max_requests = opt.max_requests||0;
    this.seed = opt.seed;
    this.test_url = this.opt.test_url;
    this.session_id = 0;
}

Sess_mgr.prototype.populate_pool = function(){
    for (let i=0; i<this.pool_size; i++)
    {
        let sess = this.establish_session();
        if (sess)
            this.pool.add(sess);
    }
};

Sess_mgr.prototype.next_session_id = function(){
    return `${this.prefix}_${this.seed}_${this.session_id++}`;
};

Sess_mgr.prototype.establish_session = function(){
    const host = this.hosts.next();
    const session = this.next_session_id();
    const ip = this.ips[this.session_id&this.ips.length];
    const vip = this.vips[this.session_id&this.vips.length];
    const max_requests = this.calc_max_requests();
    return new Session(assign({}, this.opt, {host, session, ip, vip,
        max_requests}));
};

Sess_mgr.prototype.calc_max_requests = function(){
    let mr = (''+this.max_requests).split(':');
    let sess_mr = mr[0];
    if (mr.length>1)
        sess_mr += Math.floor(Math.random()*(mr[1]-mr[0]+1));
    return sess_mr;
};

const lum_username_fields = qw`customer zone country state city session asn
    dns timeout cid ip raw direct debug mobile vip`;
const lum_fields = lum_username_fields.push('password');

function Session(opt){
    this.opt = opt = opt||{};
    this.bandwidth_max_downloaded = 0;
    assign(this, _.pick(opt, lum_fields));
    if (opt.request_timeout)
        this.timeout = opt.request_timeout;
    this.duration = opt.session_duration||0;
    this.max_requests = opt.max_requests||0;
    this.keep_alive = opt.keep_alive*date.ms.SEC||false;
    this.init_timeout = opt.session_init_timeout*date.ms.SEC;
    this.session = opt.session_id;
    this.port = opt.proxy_port;
    this.host = opt.host||null;
    this.created = Date.now();
    this.short = opt.short_username;
    this.id = opt.id;
    this.protocol = this.opt.secure_proxy ? 'https' : 'http';
}

Session.prototype.get_creds = function(){
    let sess = _.pick(this, lum_username_fields);
    if (sess.ip||sess.vip)
        delete sess.session;
    return {username: username.calc(sess, this.short), password:
        encodeURIComponent(this.password)};
};

Session.prototype.update = function(){

};

Session.prototype.start_keep_alive = function(){

};

Session.prototype.stop_keep_alive = function(){

};

Session.prototype.is_expired = function(){

};

function Session_pool(opt){
    this.type = pool_types[opt.pool_type]||E.pool_types.sequential;
    this.size = 0;
}

Session_pool.prototype.establish = function(){

};

Session_pool.prototype.update = function(){

};

Session_pool.prototype.add = function(){

};

function Hosts_mgr(opt){

}

Hosts_mgr.prototype.next = function(){

};

function Proxy(opt){

}

function Router(opt){

}

function Timeline(opt){

}

function Rules(opt){

}

function Stats(opt){

}

function Rpc(opt){

}
