// LICENSE_CODE ZON
'use strict'; /*zlint node*/
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
const max_age = 30*ms.SEC;

E.config = {hosts: {
    hola: ['zs-graphite-hola'],
    spark: ['zs-graphite-spark'],
    lum: ['zs-graphite'],
}};

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

let type = {sum: {}, avg: {}, sum_mono: {}, avg_level: {}, sum_level: {},
    max_level: {}, min_level: {}};

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
    let _type = type.sum, entry = _type[name];
    if (!entry)
        entry = _type[name] = {v: 0, agg_srv, agg_tm: 'avg0'};
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

// current in-progress counter: num of open tcp connections: +1 open, -1 close
E.inc_level = (name, inc=1, agg_mas='avg', agg_srv='avg')=>{
    if (!Number.isFinite(inc))
        return void report_invalid_val(name, inc);
    let _type = type[agg_mas+'_level'], entry = _type[name];
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

E.max = (name, value, agg_srv='max')=>{
    if (!Number.isFinite(value))
        return void report_invalid_val(name, value);
    let _type = type.max_level, entry = _type[name];
    if (!entry)
        entry = _type[name] = {v: value, agg_srv, agg_tm: 'max'};
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
    let c = _type.avg_level[n]||_type.sum_level[n]||_type.avg[n]||_type.sum[n]
        ||_type.sum_mono[n]||_type.max_level[n]||_type.min_level[n];
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

E.glob_inc = (name, inc, agg_srv)=>E.inc('glob/'+name, inc, agg_srv);
E.glob_avg = (name, value, agg_srv)=>E.avg('glob/'+name, value, agg_srv);
E.glob_max = (name, value, agg_srv)=>E.max('glob/'+name, value, agg_srv);
E.glob_min = (name, value, agg_srv)=>E.min('glob/'+name, value, agg_srv);

E.del = name=>{
    if (reported_names[name])
    {
        delete reported_names[name];
        return;
    }
    for (let agg_type in type)
    {
        let _type = type[agg_type];
        if (_type[name])
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
    avg: agg_avgw};
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

let loc_get_counters = update_prev=>etask(function*zcounter_loc_get_counters(){
    let ret = type;
    if (update_prev)
    {
        for (let fn of E.on_send)
            try { yield fn(); } catch(e){ ef(e); }
        // base gauge for 'sum_mono' kind should be reset so that next
        // measurement will be relative to the current value
        let sum_mono = {};
        for (let c in type.sum_mono)
        {
            let cur = type.sum_mono[c];
            sum_mono[c] = {v: 0, b: cur.b+cur.v,
                agg_srv: cur.agg_srv, agg_tm: cur.agg_tm};
        }
        type = {sum: {}, avg: {}, sum_mono,
            avg_level: type.avg_level, sum_level: type.sum_level,
            max_level: {}, min_level: {}};
    }
    return ret;
});

let mas_get_counters = update_prev=>etask(function*zcounter_mas_get_counters(){
    update_prev = update_prev||false;
    let a = cluster_ipc.call_all_workers('get_zcounters', update_prev)
    .concat(yield loc_get_counters(update_prev));
    let counters = yield etask.all({allow_fail: true}, a);
    return mas_agg_counters(counters.filter(v=>v && !etask.is_err(v)));
});

E.get_names = _type=>Object.keys(type[_type]);

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
    min_level: agg_mas_level_fn};

let prepare = ()=>etask(function*zcounter_prepare(){
    let get_counters_fn = Object.keys(cluster.workers).length
        ? mas_get_counters : loc_get_counters;
    let counters = yield get_counters_fn(true);
    let prefix = `stats.${conf.hostname}.${conf.app}.`;
    let metrics = [];
    for (let t in agg_mas_fn)
    {
        let _type = counters[t];
        let agg_fn = agg_mas_fn[t];
        for (let key in _type)
        {
            let c = _type[key], agg = agg_fn(key, c);
            let path;
            if (key[0]=='.')
                path = key.slice(1).replace(/\//g, '.');
            else
            {
                let parts = key.split('/');
                if (parts.length==1)
                    path = prefix+key;
                else
                    path = `stats.${parts[0]}.${conf.app}.${parts[1]}`;
            }
            metrics.push({path, v: agg.v, w: agg.w,
                agg_srv: c.agg_srv, agg_tm: c.agg_tm});
        }
    }
    return metrics;
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

let ws_queue = new queue('zcounter');
const ws_conn = new Map();
let send_loop = ()=>etask(function*(){
    if (send_loop.et)
        zerr.perr('zcounter_double_conn');
    this.finally(()=>send_loop.et = null);
    send_loop.et = this;
    for (;;)
    {
        const data = ws_format(yield ws_queue.wait());
        if (!ws_conn.size)
            return void (send_loop.et = null);
        ws_conn.forEach(ws=>ws.json(data));
    }
});

function ws_client(url){
    if (!url.startsWith('ws'))
        url = `ws://${url}`;
    if (ws_conn.has(url))
        return ws_conn.get(url);
    zerr.notice(`Opening zcounter conn to ${url}`);
    let zws = require('./ws.js');
    const label = url.split(':')[1].replace(/^\/\//, '');
    const ws = new zws.Client(url, {label: `zcounter-${label}`,
        retry_interval: ms.SEC});
    ws.on('connected', ()=>{
        ws_conn.set(url, ws);
        if (!send_loop.et)
            send_loop();
    });
    ws.on('disconnected', ()=>ws_conn.delete(url));
    return ws;
}

function run(){
    init();
    if (cluster.isWorker)
        return;
    const port = env.ZCOUNTER_PORT||3374;
    if (env.NODE_ENV!='production')
        ws_client(`ws://localhost:${port}`);
    else if (env.ZCOUNTER_URL)
    {
        const urls = env.ZCOUNTER_URL.split(';');
        for (let url of urls)
            ws_client(url);
    }
    else
    {
        const hosts = zutil.get(E.config.hosts, env.SERVER_PRODUCT||'lum',
            ['zs-graphite']);
        for (let host of hosts)
            ws_client(`ws://${host}.${env.DOMAIN||'hola.org'}:${port}`);
    }
    etask.interval({ms: interval, mode: 'smart'}, function*zcounter_run(){
        let metrics = yield prepare();
        if (metrics.length)
            ws_queue.put(metrics, max_age);
    });
}

E.submit_raw = (metrics, ttl)=>ws_queue.put(metrics, ttl);

E.flush = ()=>etask(function*zcounter_flush(){
    if (cluster.isWorker)
        zerr.zexit('zcounter.flush must be called from the master');
    let metrics = yield prepare();
    if (metrics.length)
        ws_queue.put(metrics, max_age);
    if (ws_conn.size)
        return;
    const dir = env.ZCOUNTER_DIR||'/run/shm/zcounter';
    for (;;)
    {
        let entry = ws_queue.get_ex();
        if (!entry)
            break;
        let r = Math.random()*1e8|0;
        file.mkdirp(dir);
        file.write_atomic(`${dir}/${entry.expires}.${conf.app}.${r}.json`,
            JSON.stringify(entry.item));
    }
});

E.is_debug = title=>{
    let system_db = require('../system/db/db.js');
    let agent_conf = system_db.use('agent_conf', env.CONF_SERVER);
    let debug = agent_conf.debug_zcounter;
    return debug && debug[title];
};

E.t = {loc_get_counters, get_agg_counters, _get, prepare, ws_client};
