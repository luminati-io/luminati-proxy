// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true, evil: true, es9: true*/

const {EventEmitter} = require('events');
const _ = require('lodash4');
const redis = require('ioredis');
const date = require('../util/date.js');
const {e2s} = require('../util/zerr.js');
const etask = require('../util/etask.js');
const logger = require('./logger.js').child({category: 'Ip_cache'});
const metrics = require('./metrics.js');
const util_lib = require('./util.js');

const IS_AGENT = process.env.AGENT_NUM || process.env.AGENT_KUBE;
const MAX_CACHE = IS_AGENT ? 3000 : Infinity;
const UNSERIALIZABLE_FIELDS = ['to'];

class Ip_cache {
    constructor(cache = new Map(), max=MAX_CACHE){
        this.cache = this.deserialize(cache);
        this.max = max;
        this.ensure_max_size();
    }
    create_timeouts(cache = new Map()){
        const now = Date.now();
        for (const [k, v] of cache)
        {
            if (v.to===undefined && v.to_date===undefined)
                continue;
            if (v.to)
                clearTimeout(v.to);
            if (v.to_date>now)
                v.to = setTimeout(()=>cache.delete(k), v.to_date-now);
            else
                cache.delete(k);
        }
    }
    serialize(){
        let serialized = this.cache;
        if (serialized instanceof Map)
            serialized = Object.fromEntries(serialized);
        for (const key in serialized)
            serialized[key] = _.omit(serialized[key], UNSERIALIZABLE_FIELDS);
        return serialized;
    }
    deserialize(map_or_obj){
        const cache = map_or_obj instanceof Map ? map_or_obj :
            new Map(Object.entries(map_or_obj));
        this.create_timeouts(cache);
        return cache;
    }
    _key(ip, domain){
        return !domain ? ip : `${ip}|${domain}`;
    }
    add(ip, ms, domain=''){
        const key = this._key(ip, domain);
        this.delete(ip, domain, key);
        this.cache.set(key, {ip, domain, key, ...ms&&{
                to: setTimeout(this.delete.bind(this, ip, domain, key), ms),
                to_date: Date.now()+ms,
            },
        });
        this.ensure_max_size();
    }
    ensure_max_size(){
        while (this.max && this.size > this.max)
        {
            const {ip, domain, key} = this.first_entry;
            this.delete(ip, domain, key);
        }
    }
    delete(ip, domain, key){
        let _key = key || this._key(ip, domain), entry;
        if ((entry = this.cache.get(_key)) && entry.to)
            clearTimeout(entry.to);
        this.cache.delete(_key);
    }
    clear(){
        this.cache.clear();
    }
    has(ip, domain){
        return this.cache.has(ip)||this.cache.has(this._key(ip, domain));
    }
    clear_timeouts(){
        [...this.cache.values()].forEach(e=>clearTimeout(e.to));
    }
    keys(){ return this.cache.keys(); }
    values(){ return this.cache.values(); }
    get size(){ return this.cache.size; }
    get first_entry(){ return this.cache.values().next().value; }
}

const reconnect_timeout = 10*date.ms.SEC;
let redis_client;
function create_redis_connection(redis_opt){
    if (redis_client)
        return redis_client;
    redis_client = new redis.Cluster(redis_opt.nodes, {
        redisOptions: {
            enableOfflineQueue: true,
            maxRetriesPerRequest: 1,
            commandTimeout: date.ms.MIN,
            password: redis_opt.password,
            retryStrategy: ()=>{
                logger.notice(`reconnecting to node in `
                    +`${reconnect_timeout} ms`);
                return reconnect_timeout;
            },
        },
        enableReadyCheck: true,
        enableAutoPipelining: false,
        enableOfflineQueue: true,
        slotsRefreshInterval: date.ms.SEC*30,
        slotsRefreshTimeout: date.ms.SEC*5,
        // retryDelayOnFailover, retryDelayOnMoved to prevent
        // spamming a lot of SLOTS/AUTH msg to nodes then some nodes
        // are dead
        retryDelayOnFailover: date.ms.SEC*5,
        retryDelayOnMoved: date.ms.SEC*5,
        retryDelayOnClusterDown: date.ms.SEC,
        retryDelayOnTryAgain: date.ms.SEC,
        clusterRetryStrategy: function(){
            logger.notice(`reconnect to cluster in `
                +`${reconnect_timeout} ms`);
            this.startupNodes = redis_opt.nodes.map(x=>Object.assign(x,
                {password: redis_opt.password}));
            return reconnect_timeout;
        },
    });
    redis_client.on('error', e=>{
        logger.error('redis unexpected error ' + e2s(e));
        util_lib.perr('cloud_ip_cache.unexpected_err', {error: e});
    });
    redis_client.on('node error', (e, addr)=>{
        logger.error(`error on node ${addr}, ${e2s(e)}`);
        util_lib.perr('cloud_ip_cache.node_err', {error: e});
    });
    return redis_client;
}

class Cloud_ip_cache extends EventEmitter {
    constructor(redis_opt, name){
        super();
        this.max = MAX_CACHE;
        this.cache = new Ip_cache(new Map(), this.max);
        this.prefix = `lpm_cic:${name}`;
        this.redis = create_redis_connection(redis_opt);
        this.call_method('subscribe', this.prefix);
        this.redis.on('message', (channel, message)=>{
            if (channel != this.prefix)
                return;
            const data = JSON.parse(message);
            const {cmd, args} = data;
            if (cmd == 'UNBANIPS')
                this.cache.clear();
            if (cmd == 'BANIP')
                this.cache.add(args.ip, args.ms, args.domain);
            if (cmd == 'UNBANIP')
                this.cache.delete(args.ip, args.domain);
            this.emit('cmd', data);
        });
        if (this.redis.state == 'ready')
            this.load_data();
        else
            this.redis.on('ready', ()=>this.load_data());
    }
    load_data(){
        this.call_method('get', this.prefix, (err, data)=>{
            if (err)
                return void logger.error('failed load banlist'+e2s(err));
            if (!data)
                return;
            try {
                this.cache = new Ip_cache(JSON.parse(data), this.max);
            } catch(e){
                logger.error('failed load banlist'+e2s(err));
            }
        });
    }
    call_method(method, ...args){
        const _this = this;
        return etask(function*(){
            let res, ts = Date.now();
            try {
                const promise = _this.redis[method](...args)
                    .then(this.continue_fn(), this.throw_fn());
                this.finally(()=>promise.catch(()=>null));
                res = yield this.wait();
            } catch(e){
                metrics.inc(`cloud_ip_cache.${method}.fail`);
                logger.error(`error calling ${method} ${e2s(e)}`);
                return;
            }
            metrics.inc(`cloud_ip_cache.${method}.ok`);
            metrics.avg(`cloud_ip_cache.${method}.ok.ms`, Date.now()-ts);
            return res;
        });
    }
    _cmd(cmd, args){
        this.call_method('publish', this.prefix, JSON.stringify({cmd, args}));
        this.call_method('set',
            this.prefix, JSON.stringify(this.cache.serialize()));
    }
    serialize(){
        return this.cache.serialize();
    }
    add(ip, ms, domain=''){
        this.cache.add(ip, ms, domain);
        this._cmd('BANIP', {ip, ms, domain});
    }
    delete(ip, domain){
        this.cache.delete(ip, domain);
        this._cmd('UNBANIP', {ip, domain});
    }
    clear(){
        this.cache.clear();
        this._cmd('UNBANIPS');
    }
    has(ip, domain){
        return this.cache.has(ip, domain);
    }
    clear_timeouts(){
        this.cache.clear_timeouts();
    }
    toJSON(){
        return this.cache;
    }
}

module.exports = {Ip_cache, Cloud_ip_cache};
