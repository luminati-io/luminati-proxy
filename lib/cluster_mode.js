#!/usr/bin/env node
// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/
const _ = require('lodash');
const cluster = require('cluster');
const cluster_route = require('./cluster_route.js');
const os = require('os');
const etask = require('../util/etask.js');
const zerr = require('../util/zerr.js');
const log = require('./log.js');
const is_win = process.platform=='win32';
const E = module.exports = {
    opt:{
        force_stop_delay: 3000,
    },
    msg_hdlrs: [],
};

E.get_workers_list = ()=>{
    return Object.keys(cluster.workers).map(wid=>cluster.workers[wid]);
};

E.get_worker = worker=>{
    if (!worker instanceof cluster.Worker)
        worker = cluster.workers[worker];
    if (!worker)
        return null;
    return worker;
};

E.is_enabled = ()=>{
    return !!E.enabled;
};

E.is_worker = strict=>{
    if (strict)
        return E.is_enabled() && cluster.isWorker;
    if (E.is_enabled())
        return cluster.isWorker;
    return true;
};

E.workers_count_active = ()=>{
    return E.get_workers_list().length;
};

E.workers_count = ()=>{
    if (!E.is_enabled())
        return 0;
    return E.opt.workers_num || os.cpus().length;
};

E.is_master = strict=>{
    if (strict)
        return E.is_enabled() && cluster.isMaster;
    if (E.is_enabled())
        return cluster.isMaster;
    return true;
};

E.handle_exit = worker=>{
    E.log.debug('worker %s exit', worker.id);
    if (E.opt.worker_exit_handler)
        return E.opt.worker_exit_handler(worker);
    if (E.opt.worker_exit_restart&&E.opt.worker_exit_restart())
    {
        E.log.debug('spawning new worker on exit', worker.id);
        return E.start_worker();
    }
};

E.start_worker = ()=>{
    cluster.fork();
};

E.broadcast = msg=>{
    if (!E.is_master(true))
        return;
    for (let wid in cluster.workers)
        cluster.workers[wid].send(msg);
};

E.add_msg_hdlr = (hdl)=>{
    E.msg_hdlrs.push(hdl);
};

E.rm_msg_hdlr = (hdl)=>{
    if (hdl == 'all')
    {
        E.msg_hdlrs = [];
        return;
    }
    _.remove(E.msg_hdlrs, h=>h==hdl);
};

E.handle_message = (worker, msg)=>{
    if (!msg)
    {
        msg = worker;
        worker = null;
    }
    E.msg_hdlrs.forEach(hdl=>hdl(worker, msg));
};

E.stop_worker = (worker, force)=>etask(function*cm_stop_worker(){
    if (!(worker = E.get_worker(worker)))
        return;
    worker.send('shutdown');
    worker.disconect();
    if (!force)
        return;
    try {
        let d_sp;
        this.spawn(d_sp = etask.cb_apply(worker, '.on', ['disconect']));
        yield this.wait_child(d_sp);
    } catch(e){
        if (e=='timeout')
            E.kill_worker(worker);
        else
        {
            E.log.debug('failed stopping worker %s, %s', worker.id,
                zerr.e2s(e));
        }
    }
});

E.kill_worker = worker=>{
    if (!(worker = E.get_worker(worker)))
        return;
    worker.kill();
};

E.init_master = ()=>{
    E.log.debug('init_master');
    E.log.warn('cluster mode is experimental, use with cation');
    for (let i=0; i<E.workers_count(); i++)
        cluster.fork();
    cluster.on('exit', E.handle_exit);
};

E.uninit_master = ()=>{
    E.log.debug('uninit_master');
    cluster.removeListener('exit', E.handle_exit);
    for (let wid in cluster.workers)
        E.stop_worker(wid, true);
};

E.init_worker = ()=>{
    process.on('message', E.handle_message);
};

E.uninit_worker = ()=>{
    process.removeListener('message', E.handle_message);
};

E.server_wrap = (server, opt)=>{
    if (!E.opt.sticky||!E.is_worker(true))
        return;
    cluster_route.setup(server, {select: 'server_id', check_busy: false});
};

E.init = (opt = {})=>{
    if (E.initialized)
        return;
    E.initialized = true;
    E.enabled = true;
    E.opt = Object.assign(E.opt, opt);
    E.log = log('cluster_mode', opt.log);
    if (E.is_master())
        E.init_master();
    if (E.is_worker())
        E.init_worker();
    if (opt.sticky)
    {
        opt.sticky = opt.sticky && !is_win;
        if (is_win&&E.is_master())
        {
            E.log.warn(
                'sticky cluster is incompatible with windows, skipping');
        }
    }
    if (opt.sticky)
    {
        E.log.warn('sticky cluster mode is experimental, use with cation');
        cluster_route.init();
    }
};

E.uninit = ()=>{
    if (!E.initialized)
        return;
    E.initialized = false;
    E.rm_msg_hdlr('all');
    if (E.is_master())
        E.uninit_master();
    if (E.is_worker())
        E.uninit_worker();
};
