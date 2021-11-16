// LICENSE_CODE ZON
'use strict'; /*jslint node:true*/
require('./config.js');
const cluster = require('cluster');
const etask = require('./etask.js');
const zerr = require('./zerr.js');
const zutil = require('./util.js');
const assign = Object.assign, ef = etask.ef, E = exports;
const VERBOSE_IPC = +process.env.VERBOSE_IPC;
let current_cookie = 1;
let handlers = {}, waiting = {}, incoming_pending = {};

let send = (to, msg, sock)=>{
    if (to=='master')
        process.send(msg);
    else if (cluster.workers[to])
        cluster.workers[to].send(msg, sock);
};

let on_call = (sender, msg, sock)=>etask(function*cluster_message_handler(){
    if (!handlers[msg.handler])
    {
        let queue = incoming_pending[msg.handler];
        if (!queue)
            queue = incoming_pending[msg.handler] = [];
        queue.push([sender, msg, sock]);
        return;
    }
    if (VERBOSE_IPC)
    {
        zerr.notice(`cluster_ipc: received ${msg.type} `
            +`from ${sender}.${msg.handler}`
            +(msg.type=='ipc_call' ? ` cookie ${msg.cookie}` : ''));
    }
    if (msg.type=='ipc_post')
    {
        try { handlers[msg.handler](msg.msg, sock);
        } catch(e){ ef(e);
            zerr.err(`cluster_ipc.on_call ${sender}: ${e}`); }
        return;
    }
    this.info.from = sender;
    this.info.msg = msg.msg;
    let value, handler_error;
    try {
        value = yield handlers[msg.handler](msg.msg, sock);
    } catch(e){ ef(e);
        handler_error = e;
        zerr.err(`cluster_message_handler: ${msg.handler}: ${e}`);
    }
    let response = {cookie: msg.cookie, handler: msg.handler};
    if (handler_error)
    {
        assign(response, {type: 'ipc_error',
            msg: handler_error.message || String(handler_error)});
    }
    else
        assign(response, {type: 'ipc_result', msg: value});
    try {
        if (VERBOSE_IPC)
        {
            zerr.notice(`cluster_ipc: sending ${response.type} `
                +`to ${sender}.${msg.handler} cookie ${msg.cookie}`);
        }
        send(sender, response);
    } catch(e){ ef(e); zerr.err(`cluster_ipc.on_call ${sender}: ${e}`); }
});

let on_response = (sender, msg)=>{
    if (!msg.cookie || !msg.handler)
        zerr.zexit('wrong cluster_ipc message: %O', msg);
    let key = msg.handler+'-'+msg.cookie;
    let handler = zutil.obj_pluck(waiting[sender], key);
    if (!handler)
    {
        let err = `cluster_on_response: no handler: ${key} [${sender}]`;
        if (process.listeners('message')
            .filter(l=>l.name=='ipc_msg_handler').length>1)
        {
            err += ' Duplicate ipc_msg_handler listeners!';
            return void zerr.err(err);
        }
        zerr.zexit(err);
    }
    if (VERBOSE_IPC)
    {
        zerr.notice(`cluster_ipc: received ${msg.type} `
            +`from ${sender}.${msg.handler} cookie ${msg.cookie}`);
    }
    if (msg.type=='ipc_result')
        handler.continue(msg.msg);
    if (msg.type=='ipc_error')
        handler.throw(new Error(msg.msg));
};

let worker_fail_fn = (worker, ev)=>(...arg)=>{
    for (let key in waiting[worker.id])
    {
        let handler = zutil.obj_pluck(waiting[worker.id], key);
        if (handler)
        {
            handler.throw(new Error(
                `${worker.id} worker ${ev}: ${arg.join(', ')}`));
            // it can be that the worker exits and we get an IPC result right
            // after. This ensures we will not zexit due to missing handler
            // when the worker exit was expected
            if (ev=='exit' && worker.zexpected_exit)
                waiting[worker.id][key] = etask.wait();
        }
    }
};

let message_fn = sender=>function ipc_msg_handler(msg, sock){
    switch (msg.type)
    {
    case 'ipc_result': case 'ipc_error': return on_response(sender, msg);
    case 'ipc_call': case 'ipc_post': on_call(sender, msg, sock);
    }
};

let init_worker = worker=>{
    if (!worker)
        return;
    if (waiting[worker.id])
        return;
    waiting[worker.id] = {};
    worker.on('message', message_fn(worker.id));
    for (let ev of ['error', 'disconnect', 'exit'])
        worker.on(ev, worker_fail_fn(worker, ev));
};

let init = ()=>{
    if (cluster.isMaster)
    {
        for (let id in cluster.workers)
            init_worker(cluster.workers[id]);
        cluster.on('fork', function(worker){ init_worker(worker); });
    }
    if (cluster.isWorker)
    {
        waiting.master = {};
        process.on('message', message_fn('master'));
    }
};

let call = (to, name, args, sock, timeout)=>etask(function*ipc_call(){
    this.info.to = to;
    this.info.msg = name;
    let cookie = current_cookie++, key = name+'-'+cookie;
    try {
        if (to!='master')
            init_worker(cluster.workers[to]);
        waiting[to][key] = this;
        if (VERBOSE_IPC)
        {
            zerr.notice(`cluster_ipc: sending ipc_call to ${to}.${name} `
                +`cookie ${cookie}`);
        }
        let msg = {type: 'ipc_call', handler: name, msg: args, cookie: cookie};
        send(to, msg, sock);
        return yield this.wait(timeout);
    } catch(e){ ef(e);
        zerr.err(`cluster_ipc.call to ${to} ${name}(${args}): `+zerr.e2s(e));
        throw e;
    }
});

let post = (to, name, args, sock)=>{
    if (VERBOSE_IPC)
        zerr.notice(`cluster_ipc: sending ipc_post to ${to}.${name}`);
    let msg = {type: 'ipc_post', handler: name, msg: args};
    send(to, msg, sock);
};

let add_handler = (name, fn)=>{
    if (handlers[name])
    {
        throw new Error((cluster.isMaster ? 'master' : 'worker')
            +'_on handler already installed: '+name);
    }
    handlers[name] = fn;
    let queue = zutil.obj_pluck(incoming_pending, name);
    if (queue)
    {
        for (let args of queue)
            on_call(...args);
    }
};

E.call_master = function(name, args, send_handle, timeout){
    if (cluster.isMaster)
        throw new Error('call_master called from Cluster master');
    return call('master', name, args, send_handle, timeout);
};

E.master_on = function(name, fn){
    if (!cluster.isMaster)
        throw new Error('master_on called not from Cluster master');
    add_handler(name, fn);
};

E.master_once = (name, fn)=>E.master_on(name, function(){
    delete handlers[name];
    fn(...arguments);
});

E.call_worker = function(worker, name, args, send_handle, timeout){
    if (!cluster.isMaster)
        throw new Error('call_worker called not from Cluster master');
    return call(worker.id||worker, name, args, send_handle, timeout);
};

E.call_all_workers = function(message, args, timeout){
    if (!cluster.isMaster)
        throw new Error('call_all_workers called not from Cluster master');
    let tasks = [];
    for (let id in cluster.workers)
    {
        tasks[id] = E.call_worker(cluster.workers[id], message, args,
            undefined, timeout);
    }
    return tasks;
};

E.worker_on = function(name, fn){
    if (cluster.isMaster)
        throw new Error('worker_on called from Cluster master');
    add_handler(name, fn);
};

E.worker_once = (name, fn)=>E.worker_on(name, function(){
    delete handlers[name];
    fn(...arguments);
});

E.post_master = function(name, args, send_handle){
    if (cluster.isMaster)
        throw new Error('post_master called from Cluster master');
    return post('master', name, args, send_handle);
};

E.post_worker = function(worker, name, args, send_handle){
    if (!cluster.isMaster)
        throw new Error('post_worker called not from Cluster master');
    return post(worker.id, name, args, send_handle);
};

E.post_all_workers = function(message, args){
    if (!cluster.isMaster)
        throw new Error('call_all_workers called not from Cluster master');
    for (let id in cluster.workers)
        E.post_worker(cluster.workers[id], message, args);
};

E.worker_remove_listener = function(name){
    if (cluster.isMaster)
        throw new Error('worker_remove_listener called from Cluster master');
    delete handlers[name];
};

E.master_remove_listener = function(name){
    if (!cluster.isMaster)
        throw new Error('master_remove_listener called from Cluster worker');
    delete handlers[name];
};

init();
