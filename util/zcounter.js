// LICENSE_CODE ZON
'use strict'; /*jslint node:true*/
require('./config.js');
const cluster = require('cluster');
const cluster_ipc = require('./cluster_ipc.js');
const conf = require('./conf.js');
const date = require('./date.js');
const etask = require('./etask.js');
const file = require('./file.js');
const queue = require('./queue.js');
const zerr = require('./zerr.js');
const zutil = require('./util.js');
const env = process.env, ef = etask.ef, ms = date.ms;
const E = exports;
const interval = 10*ms.SEC, counter_factor = ms.SEC/interval;
const max_age = 30*ms.SEC, level_eco_dispose = ms.HOUR;
const global_only_worlds = new Set();

E.enable_submit = when=>{
    E.enable_submit = ()=>{
        if (process.env.IS_MOCHA)
            return;
        zerr.warn('zcounter.enable_submit() was already called: ignoring.');
    };
    if (+process.env.ZCOUNTER_DROP)
        when = false;
    switch (when)
    {
    case false:
        init();
        return zerr.warn(`zcounter will not be submitted`);
    case 'always': return run();
    case 'production':
        if (env.NODE_ENV=='production')
            return run();
        break;
    }
    zerr.warn(`zcounter is disabled`);
};

let to_valid_ids = {};
E.to_valid_id = id=>to_valid_ids[id]||
    (to_valid_ids[id]=id.toLowerCase().replace(/[^a-z0-9_]/g, '_'));

// XXX vladislavl: convert to Map all structure
let type = {sum: new Map(), avg: {}, sum_mono: {}, avg_level: {},
    sum_level: {}, max_level: {}, min_level: {}, avg_level_eco: {},
    sum_level_eco: {}, sum_mono_eco: {}};

let reported_names = {};
function report_invalid_val(name, value){
    let parts = name.split('/');
    name = parts[parts.length-1];
    if (reported_names[name])
        return;
    reported_names[name] = true;
    zerr.perr('zcounter_invalid_val', {name, value});
}

// monotonic counters: http req/sec, bytes/sec
E.inc = (name, inc=1, agg_srv='sum')=>{
    if (!Number.isFinite(inc))
        return void report_invalid_val(name, inc);
    let _type = type.sum, entry = _type.get(name);
    if (!entry)
        _type.set(name, entry = {v: 0, agg_srv, agg_tm: 'avg0'});
    entry.v += inc;
};

// monotonic counters read from elsewhere: pkt rx/tx on interface from kernel
E.minc = (name, value, agg_srv='sum')=>{
    if (!Number.isFinite(value))
        return void report_invalid_val(name, value);
    let _type = type.sum_mono, entry = _type[name];
    if (!entry)
        entry = _type[name] = {v: 0, b: value, agg_srv, agg_tm: 'avg0'};
    // handle wraparound
    if (value<entry.b)
        entry.b = value;
    entry.v = value-entry.b;
};

// minc but starts sending after non-0 value and stops after 0-only for 1h
E.minc_eco = (name, value, agg_srv='sum')=>{
    if (!Number.isFinite(value))
        return void report_invalid_val(name, value);
    let _type = type.sum_mono_eco, entry = _type[name];
    if (!entry)
        entry = _type[name] = {v: 0, b: value, agg_srv, agg_tm: 'avg0'};
    // handle wraparound
    if (value<entry.b)
        entry.b = value;
    entry.v = value-entry.b;
};

// current in-progress counter: num of open tcp connections: +1 open, -1 close
E.inc_level = (name, inc=1, agg_mas='avg', agg_srv='avg')=>{
    if (!Number.isFinite(inc))
        return void report_invalid_val(name, inc);
    let _type = type[agg_mas+'_level'], entry = _type[name];
    if (!entry)
        entry = _type[name] = {v: 0, agg_srv};
    entry.v += inc;
};

// inc_level but starts sending after non-0 value and stops after 0-only for 1h
E.inc_level_eco = (name, inc=1, agg_mas='avg', agg_srv='avg')=>{
    if (!Number.isFinite(inc))
        return void report_invalid_val(name, inc);
    let _type = type[agg_mas+'_level_eco'], entry = _type[name];
    if (!entry)
        entry = _type[name] = {v: 0, agg_srv};
    entry.v += inc;
};

// current in-progress counter read from elsewhere, or absolute value such
// as %cpu or %disk usage
E.set_level = (name, value, agg_mas='avg', agg_srv='avg')=>{
    if (!Number.isFinite(value))
        return void report_invalid_val(name, value);
    let _type = type[agg_mas+'_level'], entry = _type[name];
    if (!entry)
        entry = _type[name] = {v: 0, agg_srv};
    entry.v = value;
};

// set_level but starts sending after non-0 value and stops after 0-only for 1h
E.set_level_eco = (name, value, agg_mas='avg', agg_srv='avg')=>{
    if (!Number.isFinite(value))
        return void report_invalid_val(name, value);
    let _type = type[agg_mas+'_level_eco'], entry = _type[name];
    if (!entry)
        entry = _type[name] = {v: 0, agg_srv};
    entry.v = value;
};

E.avg = (name, value, agg_srv)=>E.avgw(name, value, 1, agg_srv);

E.avgw = (name, value, weight, agg_srv='avg')=>{
    if (!Number.isFinite(value))
        return void report_invalid_val(name, value);
    if (!Number.isFinite(weight) || weight<0)
        return void report_invalid_val(name, weight);
    let _type = type.avg, entry = _type[name];
    if (!entry)
        entry = _type[name] = {v: 0, w: 0, agg_srv};
    entry.v += value;
    entry.w += weight;
};

E.max = (name, value, agg_srv='max', agg_tm='max')=>{
    if (!Number.isFinite(value))
        return void report_invalid_val(name, value);
    let _type = type.max_level, entry = _type[name];
    if (!entry)
        entry = _type[name] = {v: value, agg_srv, agg_tm};
    if (entry.v<value)
        entry.v = value;
};

E.min = (name, value, agg_srv='min')=>{
    if (!Number.isFinite(value))
        return void report_invalid_val(name, value);
    let _type = type.min_level, entry = _type[name];
    if (!entry)
        entry = _type[name] = {v: value, agg_srv, agg_tm: 'min'};
    if (entry.v>value)
        entry.v = value;
};

function _get(_type, n){
    let c = _type.avg_level[n]||_type.sum_level[n]||_type.avg[n]
        ||(_type.sum instanceof Map ? _type.sum.get(n) : _type.sum[n])
        ||_type.sum_mono[n]||_type.max_level[n]||_type.min_level[n]
        ||_type.avg_level_eco[n]||_type.sum_level_eco[n]
        ||_type.sum_mono_eco[n];
    if (c && c.w!==undefined)
        return c.v/c.w;
    return c ? c.v : 0;
}

E.get = n=>_get(type, n);

// The ext_* versions of the above functions provide for reporting for a
// different server than the local host.
E.ext_inc = (server, name, inc, agg_srv)=>E.inc(server+'/'+name, inc, agg_srv);
E.ext_minc = (server, name, value, agg_srv)=>
    E.minc(server+'/'+name, value, agg_srv);
E.ext_inc_level = (server, name, inc, agg_mas, agg_srv)=>
    E.inc_level(server+'/'+name, inc, agg_mas, agg_srv);
E.ext_set_level = (server, name, value, agg_mas, agg_srv)=>
    E.set_level(server+'/'+name, value, agg_mas, agg_srv);
E.ext_avg = (server, name, value, agg_srv)=>
    E.avg(server+'/'+name, value, agg_srv);
E.ext_avgw = (server, name, value, weight, agg_srv)=>
    E.avgw(server+'/'+name, value, weight, agg_srv);
E.ext_max = (server, name, value, agg_srv)=>
    E.max(server+'/'+name, value, agg_srv);
E.ext_min = (server, name, value, agg_srv)=>
    E.min(server+'/'+name, value, agg_srv);
E.ext_get = (server, name)=>E.get(server+'/'+name);

// The group_* versions of the functions provide group reporting for non-tun
// zagents metrics while regular reporting for servers and tun zagents
E.group_inc = E.inc;
E.group_avg = E.avg;
E.group_max = (name, value, agg_srv)=>E.max(name, value, agg_srv, 'avg');
E.group_set_level = E.set_level;
if (env.ZCOUNTER_GROUP!==undefined)
{
    let groups = [''];
    if (env.ZCOUNTER_GROUP!='')
        groups.push('_g_'+env.ZCOUNTER_GROUP);
    if (env.AGENT_DC)
        groups.push('_g_'+env.AGENT_COUNTRY+'_'+env.AGENT_DC);
    E.group_inc = (name, inc, agg_srv)=>groups.forEach(g=>
        E.inc('glob/'+name+g, inc, agg_srv));
    E.group_avg = (name, value, agg_srv)=>groups.forEach(g=>
        E.avg('glob/'+name+g, value, agg_srv));
    E.group_max = (name, value, agg_srv)=>groups.forEach(g=>
        E.avg('glob/'+name+g, value, agg_srv));
    E.group_set_level = (name, value, agg_mas, agg_srv)=>groups.forEach(g=>
        E.set_level('glob/'+name+g, value, agg_mas, agg_srv));
}

E.glob_inc = (name, inc, agg_srv)=>E.inc('glob/'+name, inc, agg_srv);
E.glob_inc_level = (name, inc, agg_mas, agg_srv)=>
    E.inc_level('glob/'+name, inc, agg_mas, agg_srv);
E.glob_avg = (name, value, agg_srv)=>E.avg('glob/'+name, value, agg_srv);
E.glob_max = (name, value, agg_srv)=>E.max('glob/'+name, value, agg_srv);
E.glob_min = (name, value, agg_srv)=>E.min('glob/'+name, value, agg_srv);
E.glob_set_level = (name, value, agg_mas, agg_srv)=>
    E.set_level('glob/'+name, value, agg_mas, agg_srv);

E.del = name=>{
    if (reported_names[name])
    {
        delete reported_names[name];
        return;
    }
    for (let agg_type in type)
    {
        let _type = type[agg_type];
        if (_type instanceof Map)
            _type.delete(name);
        else if (_type[name])
            delete _type[name];
    }
};

function pluck(obj, key){ return obj.map(v=>v[key]); }
function agg_max(val, cnt){
    val.v = val.v===undefined ? cnt.v : Math.max(val.v, cnt.v); }
function agg_min(val, cnt){
    val.v = val.v===undefined ? cnt.v : Math.min(val.v, cnt.v); }
function agg_sum(val, cnt){ val.v = (val.v||0)+cnt.v; }
function agg_avg(val, cnt){
    val.v = (val.v||0)+cnt.v;
    val.w = (val.w||0)+1;
}
function agg_avgw(val, cnt){
    val.v = (val.v||0)+cnt.v;
    val.w = (val.w||0)+cnt.w;
}

const aggs = {sum: agg_sum, sum_mono: agg_sum, avg_level: agg_avg,
    max_level: agg_max, min_level: agg_min, sum_level: agg_sum,
    avg: agg_avgw, avg_level_eco: agg_avg, sum_level_eco: agg_sum,
    sum_mono_eco: agg_sum};
function mas_agg_counters(worker_counters){
    let res = zutil.map_obj(aggs, (agg, key)=>{
        let worker_counter = pluck(worker_counters, key);
        let vals = {};
        for (let i = 0; i<worker_counter.length; i++)
        {
            let cs = worker_counter[i];
            // Object.keys/for is 25% faster than for..in
            let ids = Object.keys(cs);
            for (let j=0; j<ids.length; j++)
            {
                let id = ids[j], _cs = cs[id];
                if (!vals[id])
                    vals[id] = {agg_srv: _cs.agg_srv, agg_tm: _cs.agg_tm};
                agg(vals[id], _cs);
            }
        }
        return vals;
    });
    return res;
}

E.on_send = [];

const eco_ts = {};

let loc_get_counters = update_prev=>etask(function*zcounter_loc_get_counters(){
    let ret = Object.assign({}, type);
    if (update_prev)
    {
        for (let fn of E.on_send)
            try { yield fn(); } catch(e){ ef(e, this); }
        // base gauge for 'sum_mono' kind should be reset so that next
        // measurement will be relative to the current value
        let mono = {sum_mono: {}, sum_mono_eco: {}};
        ['sum_mono', 'sum_mono_eco'].forEach(m=>{
            let mono_new = mono[m];
            let mono_cur = type[m];
            for (let c in mono_cur)
            {
                let cur = mono_cur[c];
                mono_new[c] = {v: 0, b: cur.b+cur.v, agg_srv: cur.agg_srv,
                    agg_tm: cur.agg_tm};
            }
        });
        type = {sum: new Map(), avg: {}, sum_mono: mono.sum_mono,
            avg_level: type.avg_level, sum_level: type.sum_level,
            max_level: {}, min_level: {}, avg_level_eco: type.avg_level_eco,
            sum_level_eco: type.sum_level_eco,
            sum_mono_eco: mono.sum_mono_eco};
    }
    let now = Date.now(), sum = ret.sum;
    ret.sum = {};
    for (let [k, v] of sum)
        ret.sum[k] = v;
    [ret.avg_level_eco, ret.sum_level_eco].forEach(eco=>{
        for (let t in eco)
        {
            let c = eco[t];
            if (c.v)
            {
                eco_ts[t] = now;
                continue;
            }
            let ts = eco_ts[t];
            if (!ts || now-ts>level_eco_dispose)
            {
                delete eco_ts[t];
                delete eco[t];
            }
        }
    });
    let sum_mono_eco = {};
    let eco = ret.sum_mono_eco;
    for (let t in eco)
    {
        let c = eco[t];
        if (c.v)
        {
            eco_ts[t] = now;
            sum_mono_eco[t] = c;
            continue;
        }
        let ts = eco_ts[t];
        if (ts && now-ts<level_eco_dispose)
            sum_mono_eco[t] = c;
    }
    ret.sum_mono_eco = sum_mono_eco;
    return ret;
});

let mas_get_counters = update_prev=>etask(function*zcounter_mas_get_counters(){
    update_prev = update_prev||false;
    let a = cluster_ipc.call_all_workers('get_zcounters', update_prev)
    .concat(yield loc_get_counters(update_prev));
    let counters = yield etask.all({allow_fail: true}, a);
    return mas_agg_counters(counters.filter(v=>v && !etask.is_err(v)));
});

E.get_names = _type=>type[_type] instanceof Map ?
    [...type[_type].keys()] : Object.keys(type[_type]);

function ws_format(metrics){
    let res = [], last = '';
    for (let i = 0; i<metrics.length; i++)
    {
        let metric = metrics[i], path = metric.path;
        let repeat = 0;
        while (repeat<last.length && repeat<path.length
            && last[repeat]==path[repeat])
        {
            repeat++;
        }
        last = path;
        let row = [repeat, path.slice(repeat), metric.v];
        if (metric.agg_srv && metric.agg_srv!='avg')
            row[4] = metric.agg_srv;
        if (metric.agg_tm && metric.agg_tm!='avg')
            row[5] = metric.agg_tm;
        if (row.length>3 || metric.w && metric.w!=1)
            row[3] = metric.w||1;
        res.push(row);
    }
    return res;
}

function agg_mas_sum_fn(id, c){ return {v: c.v*counter_factor, w: undefined}; }
function agg_mas_avg_fn(id, c){ return c; }
function agg_mas_level_fn(id, c){
    return {v: c.w!==undefined ? c.v/c.w : c.v, w: undefined}; }

const agg_mas_fn = {sum: agg_mas_sum_fn, sum_mono: agg_mas_sum_fn,
    avg: agg_mas_avg_fn, avg_level: agg_mas_level_fn,
    sum_level: agg_mas_level_fn, max_level: agg_mas_level_fn,
    min_level: agg_mas_level_fn, avg_level_eco: agg_mas_level_fn,
    sum_level_eco: agg_mas_level_fn, sum_mono_eco: agg_mas_sum_fn};

let prepare = ()=>etask(function*zcounter_prepare(){
    let get_counters_fn = Object.keys(cluster.workers).length
        ? mas_get_counters : loc_get_counters;
    let counters = yield get_counters_fn(true);
    let prefix = `stats.${conf.hostname}.${conf.app}.`;
    let res = {lum: [], stats: []};
    for (let t in agg_mas_fn)
    {
        let _type = counters[t];
        let agg_fn = agg_mas_fn[t];
        for (let key in _type)
        {
            let world = 'stats';
            let c = _type[key], agg = agg_fn(key, c);
            let path;
            if (key[0]=='.')
            {
                path = key.slice(1).replace(/\//g, '.');
                if (path.startsWith('lum.'))
                    world = 'lum';
            }
            else
            {
                let parts = key.split('/');
                if (parts.length==1)
                    path = prefix+key;
                else
                    path = `stats.${parts[0]}.${conf.app}.${parts[1]}`;
            }
            if (!global_only_worlds.has(world) || path.includes('.glob.'))
            {
                res[world].push({path, v: agg.v, w: agg.w,
                    agg_srv: c.agg_srv, agg_tm: c.agg_tm});
            }
        }
    }
    return res;
});

let get_agg_counters = ()=>etask(function*zcounter_get_agg_counters(){
    if (cluster.isMaster)
        return yield mas_get_counters();
    return yield cluster_ipc.call_master('get_zcounters');
});

let handler_get = (req, res)=>etask(function*zcounter_handler_get(){
    let counters = yield get_agg_counters();
    if (req.url.match(/^\/procinfo\/zcounter(\/|)$/))
        return void res.json({counters});
    let name = req.url.replace(/^\/procinfo\/zcounter\//, '');
    res.type('text/plain');
    res.send(''+(_get(counters, name)||0));
});

function init(){
    const procinfo = require('./procinfo.js');
    procinfo.register('/procinfo/zcounter', handler_get, false);
    procinfo.register('/procinfo/zcounter/*', handler_get, false);
    if (cluster.isMaster)
        cluster_ipc.master_on('get_zcounters', mas_get_counters);
    else
        cluster_ipc.worker_on('get_zcounters', loc_get_counters);
}

let ws_queue = {lum: new queue('lum zc'), stats: new queue('stats zc')};
const ws_conn = {lum: new Map(), stats: new Map()};
let send_loop = world=>etask(function*(){
    if (send_loop[world])
        zerr.perr('zcounter_double_conn');
    this.finally(()=>send_loop[world] = null);
    send_loop[world] = this;
    for (;;)
    {
        const data = ws_format(yield ws_queue[world].wait());
        let conns = ws_conn[world];
        if (!conns.size)
            return void (send_loop[world] = null);
        conns.forEach(ws=>ws.json(data));
    }
});

let all_conns = new Map();
function ws_client(world, url){
    if (!url.startsWith('ws'))
        url = `ws://${url}`;
    let ws, conn_info;
    if (conn_info = all_conns.get(url))
    {
        if (conn_info.worlds.includes(world))
            return conn_info.ws;
        ws = conn_info.ws;
        conn_info.worlds.push(world);
    }
    else
    {
        zerr.notice(`Opening zcounter conn to ${url}`);
        let zws = require('./ws.js');
        const label = url.split(':')[1].replace(/^\/\//, '');
        ws = new zws.Client(url, {label: `zcounter-${label}`,
            retry_interval: 3*ms.SEC});
        all_conns.set(url, {ws, worlds: [world]});
    }
    let conns = ws_conn[world];
    if (ws.connected && !conns.has(url))
    {
        conns.set(url, ws);
        if (!send_loop[world])
            send_loop(world);
    }
    ws.on('connected', ()=>{
        conns.set(url, ws);
        if (!send_loop[world])
            send_loop(world);
    });
    ws.on('disconnected', ()=>conns.delete(url));
    return ws;
}

const lazy_conns = {lum: [], stats: []};
class Lazy_ws_client {
    constructor(world, url){
        zerr.notice(`Opening lazy zcounter conn to ${url}`);
        this.world = world;
        this.url = url;
    }
    connect(){
        let _this = this;
        return etask(function*(){
            _this.ws = ws_client(_this.world, _this.url);
            if (_this.ws.connected)
                return _this.ws;
            let task = etask.sleep(10*ms.SEC);
            _this.ws.on('connected', task.continue_fn());
            yield task;
            return _this.ws;
        });
    }
}

function run(){
    init();
    if (cluster.isWorker)
        return;
    let port = env.ZCOUNTER_PORT||3374;
    let create_client = env.ZCOUNTER_LAZY_CONNECT
        ? (world, url)=>{
            let client = new Lazy_ws_client(world, url);
            lazy_conns[world].push(client);
        } : ws_client;
    if (env.NODE_ENV!='production')
    {
        create_client('lum', `ws://localhost:${port}`);
        create_client('stats', `ws://localhost:${port}`);
    }
    else if (env.ZCOUNTER_STATS_URL && env.ZCOUNTER_LUM_URL)
    {
        env.ZCOUNTER_STATS_URL.split(';')
            .forEach(x=>create_client('stats', x));
        env.ZCOUNTER_LUM_URL.split(';').forEach(x=>create_client('lum', x));
    }
    else
    {
        let lum = ['zs-graphite.luminati.io', 'zs-graphite-log.luminati.io'];
        let stats = ['zs-graphite-stats.luminati.io',
            'zs-graphite-log.luminati.io'];
        if (+env.LXC)
        {
            lum = ['zs-graphite.luminati.io'];
            stats = ['zs-graphite-stats.luminati.io'];
        }
        lum.forEach(h=>create_client('lum', `ws://${h}:${port}`));
        stats.forEach(h=>create_client('stats', `ws://${h}:${port}`));
    }
    if (env.ZCOUNTER_LUM_GLOB_ONLY)
        global_only_worlds.add('lum');
    if (env.ZCOUNTER_STATS_GLOB_ONLY)
        global_only_worlds.add('stats');
    etask.interval(interval, function*zcounter_run(){
        this.on('uncaught', e=>zerr.e2s(e));
        let data = yield prepare();
        for (let world of ['lum', 'stats'])
        {
            if (!data[world].length)
                continue;
            if (lazy_conns[world].length)
            {
                let tasks = lazy_conns[world].map(x=>x.connect());
                lazy_conns[world] = [];
                yield etask.all(tasks);
            }
            ws_queue[world].put(data[world], max_age);
        }
    });
}

E.submit_raw = (data, ttl)=>{
    if (data.world)
        return void ws_queue[data.world].put(data.metrics, ttl);
    let lum = [], stats = [];
    for (let metric of data)
    {
        if (!metric.path)
            continue;
        let world = metric.path.startsWith('lum.') && lum || stats;
        world.push(metric);
    }
    if (lum.length)
        ws_queue.lum.put(lum, ttl);
    if (stats.length)
        ws_queue.stats.put(stats, ttl);
};

E.flush = ()=>etask(function*zcounter_flush(){
    if (cluster.isWorker)
        zerr.zexit('zcounter.flush must be called from the master');
    const dir = env.ZCOUNTER_DIR||'/run/shm/zcounter';
    let data = yield prepare();
    for (let world of ['lum', 'stats'])
    {
        let metrics = data[world];
        if (metrics.length)
            ws_queue[world].put(metrics, max_age);
        if (ws_conn[world].size)
            continue;
        for (;;)
        {
            let entry = ws_queue[world].get_ex();
            if (!entry)
                break;
            let r = Math.random()*1e8|0;
            file.mkdirp(dir);
            file.write_atomic(`${dir}/${entry.expires}.${conf.app}.${r}.json`,
                JSON.stringify({world, metrics: entry.item}));
        }
    }
});

let agent_conf;
E.is_debug = title=>{
    if (!agent_conf)
    {
        let system_db = require('../system/db/db.js');
        agent_conf = system_db.use('agent_conf');
    }
    let debug = agent_conf.debug_zcounter;
    let v = debug && debug[title];
    if (typeof v=='object')
        return v.includes(+env.AGENT_NUM);
    return !!v;
};

function test_reset(){
    type = {sum: new Map(), avg: {}, sum_mono: {}, avg_level: {},
        sum_level: {}, max_level: {}, min_level: {}, avg_level_eco: {},
        sum_level_eco: {}, sum_mono_eco: {}};
}

E.t = {loc_get_counters, get_agg_counters, _get, prepare, ws_client,
    test_reset, all_conns, ws_conn};
