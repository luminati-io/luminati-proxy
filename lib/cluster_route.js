// LICENSE_CODE ZON
'use strict'; /*jslint node:true*/
require('./config.js');
const net = require('net');
const cluster = require('cluster');
const child_process = require('child_process');
const EventEmitter = require('events');
const _http_common = require('_http_common');
const tls = require('tls');
const hutil = require('hutil');
const socket_pair = require('socket-pair');
const {etask, zerr, conv, array} = hutil;
const zutil = hutil.util;
const hash = require('./hash.js');
// const znet = require('./net.js');
// const proc = require('./proc.js');
// const toobusy = require('./toobusy.js');

const znet = {};
const proc = {
    cluster_workers_n: ()=>{ return 2; }
};
const toobusy = {};

const E = exports, assign = Object.assign;
zutil.inherit_init(E, EventEmitter);

// cannot monkey patch 'freeParser' since it assigned to variable in modules
let old_free = _http_common.parsers.free.bind(_http_common.parsers);
_http_common.parsers.free = function(parser){
    if (parser.old_execute)
    {
        parser.execute = parser.old_execute;
        delete parser.old_execute;
    }
    delete parser.onIncoming;
    return old_free(parser);
};

let worker_pending = {};
let master_init = ()=>{
    cluster.on('fork', worker=>{
        for (let {msg, handle} of worker_pending[worker.id]||[])
            worker.send(msg, handle);
        delete worker_pending[worker.id];
        worker.on('message', (msg, handle)=>{
            if (msg.cmd!='cluster_route:w2w_channel')
                return;
            let w = cluster.workers[msg.to_worker_id];
            if (w)
                w.send(msg, handle);
            else
            {
                let queue = worker_pending[msg.to_worker_id];
                if (!queue)
                    queue = worker_pending[msg.to_worker_id] = [];
                queue.push({msg, handle});
            }
        });
    });
};
let ipc_socket_error = e=>zerr('cluster_route: socket error: '+e);
E._create_ipc_channel = fd=>{
    // save process so we can restore it after _forkChild() changed it
    let original_process = process;
    try {
        let channel = global.process = new EventEmitter();
        child_process._forkChild(fd);
        // fixing node bug:
        // recv handle loss when msg is splitted into multiple chunks
        let pipe = channel._channel, orig_onread = pipe.onread, last_handle;
        pipe.onread = (nread, pool, handle)=>{
            last_handle = handle||last_handle;
            return orig_onread.call(pipe, nread, pool, last_handle);
        };
        channel.on('internalMessage', (msg, handle)=>{
            if (handle===last_handle)
                last_handle = null;
        });
        return channel;
    } finally { global.process = original_process; }
};
E.create_socket_pair = ()=>etask(function*create_socket_pair(){
    let socket = socket_pair.create((err, other)=>{
        if (err)
            throw err;
        other.pause();
        this.continue(other);
    });
    let other = yield this.wait();
    let fds = [socket._handle.fd, other._handle.fd];
    return {socket, other, fds};
});
let tx_w2w_channel = {};
let worker_init = channel_needed=>etask(function*worker_init(){
    for (let i=1; i<=proc.cluster_workers_n(); i++)
    {
        if (i==cluster.worker.id)
            continue;
        if (channel_needed && !channel_needed(cluster.worker.id, i))
            continue;
        let {socket, other} = yield E.create_socket_pair();
        if (!socket._handle||!other._handle)
            throw new Error(`cluster_route: bad ipc socket`);
        tx_w2w_channel[i] = E._create_ipc_channel(socket._handle.fd);
        process.send({cmd: 'cluster_route:w2w_channel', to_worker_id: i,
            from_worker_id: cluster.worker.id}, other._handle);
    }
    process.on('message', (msg, recv_handle)=>{
        if (msg.cmd!='cluster_route:w2w_channel')
            return;
        if (!recv_handle)
            zerr('cluster_route no handle: %O', msg);
        let rx_w2w_channel = E._create_ipc_channel(recv_handle.fd);
        rx_w2w_channel.on('message', (w2w_msg, w2w_recv_handle)=>{
            if (w2w_msg && w2w_msg.cmd=='cluster_route:connection')
            {
                if (!w2w_recv_handle)
                {
                    return zerr('cluster_route socket lost on ipc: %O %O', msg,
                        w2w_msg);
                }
                w2w_recv_handle.on('error', ipc_socket_error);
            }
            E.emit('message', w2w_msg, w2w_recv_handle, msg.from_worker_id);
        });
    });
    E.on('message', (msg, recv_handle, from_worker_id)=>{
        if (msg && typeof msg.cmd=='string')
            E.emit(msg.cmd, msg, recv_handle, from_worker_id);
    });
});

let socket_err = e=>{
    zerr('cluster_route pipe '+zerr.e2s(e));
};

let pipe_wrap_socket = src_socket=>etask(function*pipe_wrap_socket(){
    let spair = yield E.create_socket_pair();
    let local_socket = spair.socket;
    let ret_socket = spair.other;
    let remove_listeners = sock=>{
        if (!sock)
            return false;
        sock.removeListener('close', handle_close);
        sock.removeListener('error', handle_error);
        return true;
    };
    let handle_close = ()=>{
        if (remove_listeners(src_socket))
            src_socket = undefined;
        if (remove_listeners(local_socket))
            local_socket = undefined;
        if (remove_listeners(ret_socket))
            ret_socket = undefined;
    };
    let handle_error = e=>{
        if (src_socket)
        {
            src_socket.unpipe(local_socket);
            src_socket.destroy();
        }
        if (local_socket)
        {
            local_socket.unpipe(src_socket);
            local_socket.destroy();
        }
        if (ret_socket)
            ret_socket.destroy();
        handle_close();
    };
    src_socket.pipe(local_socket).pipe(src_socket);
    for (let sock of [local_socket, ret_socket, src_socket])
    {
        sock.on('close', handle_close)
        .on('error', socket_err)
        .on('error', handle_error);
    }
    return ret_socket;
});
E.send = (msg, send_handle, to_worker_id)=>etask(function*send(){
    if (to_worker_id==cluster.worker.id)
        return void E.emit('message', msg, send_handle, cluster.worker.id);
    let w2w_channel;
    if (!(w2w_channel = tx_w2w_channel[to_worker_id]))
        throw new Error(`No channel to worker '${to_worker_id}'`);
    if (send_handle)
    {
        msg.send_handle_src = {ip: send_handle.remoteAddress,
            port: send_handle.remotePort, ssl: send_handle.encrypted};
    }
    if (send_handle && send_handle.encrypted)
    {
        send_handle._handle.readStart();
        send_handle = yield pipe_wrap_socket(send_handle);
    }
    if (msg.cmd=='cluster_route:connection')
    {
        if (send_handle)
            msg.handle_ip = send_handle.remoteAddress;
        else
            msg.no_handle = true;
    }
    w2w_channel.send(msg, send_handle);
});
let set_hook = (ee, event_name, hook_fn)=>{
    let orig_listeners = array.to_array(ee._events[event_name]);
    let call_orig = function(){
        for (let listener of orig_listeners)
            listener.apply(ee, arguments);
    };
    ee._events[event_name] = hook_fn.bind(ee, call_orig);
    return call_orig;
};
let ip_hash = ip=>hash.hash_int(conv.inet_addr(ip));
let select_worker_by_ip = socket=>
    ip_hash(socket.remoteAddress)%proc.cluster_workers_n()+1;
// XXX vladislav: when x-forwarded-for is not defined, we use only a single
// worker
let select_worker_by_ip_smart = (socket, req)=>ip_hash(
    req.headers['x-forwarded-for']||socket.remoteAddress)
    %proc.cluster_workers_n()+1;
let select_worker_by_port = (socket, req)=>hash.hash_int(socket.remotePort)%proc.cluster_workers_n()+1;
let check_fallback = to_worker_id=>{
    if (!to_worker_id)
        to_worker_id = cluster.worker.id;
    if (to_worker_id==cluster.worker.id
        && toobusy.actions.cluster_route_fallback
        && proc.is_worker_busy(to_worker_id))
    {
        to_worker_id = cluster.worker.id;
    }
    return to_worker_id;
};
let conn_hook = (pass_conn, socket)=>void etask(function*_conn_hook(){
    let route = socket.route;
    socket.removeListener('error', ipc_socket_error);
    if (route.routed)
    {
        route.routed = false;
        return pass_conn(socket);
    }
    let opt = route.opt;
    socket.on('error', e=>{
        socket.destroy();
        zerr(`cluster_route(${opt.server_id}): ${zerr.e2s(e)}`);
    });
    E.send({cmd: 'cluster_route:connection', server_id: opt.server_id},
       socket, check_fallback(yield opt.select(socket)));
});
let parser_on_incoming = function(req, should_keep_alive){
    let parser = this, socket = parser.socket, route = socket.route;
    if (route.routed)
    {
        route.routed = false;
        return route.orig_on_incoming(req, should_keep_alive);
    }
    req.should_keep_alive = should_keep_alive;
    route.paused_on_headers = true;
    socket._handle.readStop();
    parser.pause();
};
let parser_execute = function(buf){
    let parser = this, socket = parser.socket, route = socket&&socket.route;
    let res = parser.constructor.prototype.execute.call(parser, buf);
    if (!(route && route.paused_on_headers))
        return res;
return etask(function*_parser_execute(){
    let opt = route.opt, req = parser.incoming;
    let to_worker_id = check_fallback(yield opt.select(socket, req));
    if (to_worker_id==cluster.worker.id)
    {
        zerr.info(`cluster_route(${opt.server_id}): don't route`);
        route.orig_on_incoming(req, req.should_keep_alive);
        route.paused_on_headers = false;
        socket._handle.readStart();
        parser.resume();
        buf = buf.slice(res.bytesParsed);
        let next_res = parser.execute(buf);
        if (next_res instanceof Error && parser[parser.constructor.kOnExecute])
        {
            next_res.bytesParsed = (next_res.bytesParsed||0)+res.bytesParsed;
            parser[parser.constructor.kOnExecute](next_res, buf);
        }
        return;
    }
    delete socket._events.data;
    for (let l of socket.listeners('end'))
    {
        if (l.name=='bound socketOnEnd')
            socket.removeListener('end', l);
    }
    _http_common.freeParser(parser, req, socket);
    while (socket._httpMessage)
    {
        zerr.info(`cluster_route(${opt.server_id}): wait for response`);
        let wait = this.wait();
        socket._httpMessage.on('finish', ()=>wait.continue());
        yield wait;
    }
    let head = `${req.method} ${req.url} `+
        `HTTP/${req.httpVersionMajor}.${req.httpVersionMinor}\r\n`;
    for (let i=0; i<req.rawHeaders.length; i+=2)
        head += `${req.rawHeaders[i]}: ${req.rawHeaders[i+1]}\r\n`;
    head += '\r\n';
    let consumed_data = Buffer.concat(
        [new Buffer(head), buf.slice(res.bytesParsed+1)]).toString('base64');
    zerr.info(`cluster_route(${opt.server_id}): pass to C${to_worker_id}`);
    E.send({cmd: 'cluster_route:connection', server_id: opt.server_id,
        consumed_data}, req.socket, to_worker_id);
}); };
let http_server_on_connection = socket=>{
    if (!socket._handle)
        return void zerr('cluster_route broken socket '+socket.remoteAddress);
    // make parser to unconsume socket and let 'data' events occur
    socket.on('data', ()=>0);
    let parser = socket.parser;
    socket.route.orig_on_incoming = parser.onIncoming.bind(parser);
    parser.onIncoming = parser_on_incoming;
    parser.old_execute = parser.execute;
    parser.execute = parser_execute;
};
E.setup = (server, opt)=>{
    if (!cluster.isWorker)
        throw new Error('cluster_route.setup called from master');
    opt = assign({select: 'ip'}, opt);
    if (opt.server_id==undefined)
    {
        let upd_server_id = ()=>{
            let addr;
            if (addr = server.address())
                opt.server_id = addr.family+':'+addr.address+':'+addr.port;
        };
        server.on('listening', upd_server_id);
        upd_server_id();
    }
    if (opt.select=='ip_smart')
        assign(opt, {select: select_worker_by_ip_smart, need_headers: true});
    else if (opt.select=='ip')
        assign(opt, {select: select_worker_by_ip});
    let conn_ev = server instanceof tls.Server && opt.need_headers
        ? 'secureConnection' : 'connection';
    if (opt.need_headers)
        server.on(conn_ev, http_server_on_connection);
    else
        set_hook(server, conn_ev, conn_hook);
    E.on('cluster_route:connection', (msg, socket)=>{
        if (msg.server_id!=opt.server_id)
            return;
        if (opt.check_busy!=false && toobusy.actions.cluster_route_disconnect
            && toobusy.is_busy())
        {
            return socket.destroy();
        }
        socket.route = {src: msg.send_handle_src, routed: true};
        let src = socket.route.src;
        if (src && src.ip)
            socket._peername = {address: src.ip, port: src.port, family: 4};
        server.emit(conn_ev, socket);
        if (msg.consumed_data)
            socket.unshift(new Buffer(msg.consumed_data, 'base64'));
    });
    set_hook(server, conn_ev, (pass_conn, socket)=>{
        socket.route = assign({opt}, socket.route);
        socket.server = server;
        pass_conn(socket);
    });
};
E.init = opt=>{
    opt = opt||{};
    if (cluster.isMaster)
        return void master_init(opt.external);
    worker_init(opt.channel_needed, opt.external);
};
