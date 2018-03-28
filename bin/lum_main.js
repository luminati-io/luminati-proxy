#!/usr/bin/env node
// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/

const Manager = require('../lib/manager.js');
const hutil = require('hutil');
const etask = hutil.etask;
const zerr = hutil.zerr;
require('../lib/perr.js').run({});
const version = require('../package.json').version;
const analytics = require('universal-analytics');
const _ = require('lodash');
const file = require('hutil').file;
const qw = require('hutil').string.qw;
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const ua = analytics('UA-60520689-2');
const cluster = require('cluster');

ua.set('an', 'LPM');
ua.set('av', `v${version}`);

const ua_filename = path.resolve(os.homedir(),
    '.luminati_ua_ev.json'.substr(process.platform=='win32' ? 1 : 0));
const status_filename = path.resolve(os.homedir(),
    '.luminati_status.json'.substr(process.platform=='win32' ? 1 : 0));
let lpm_status = {
    status: 'initializing',
    config: null,
    error: null,
    create_date: hutil.date(),
    update_date: hutil.date(),
    customer_name: null,
    version,
};
let last_ev;
const ua_event = ua.event.bind(ua);
ua.event = (...args)=>{
    let send = true, hash;
    if (!last_ev)
    {
        try { last_ev = JSON.parse(file.read_e(ua_filename)); }
        catch(e){ last_ev = {}; }
    }
    const cb = _.isFunction(_.last(args)) ? args.pop() : null;
    let params;
    if (_.isObject(_.last(args)))
        params = args.pop();
    params = Object.assign({}, params,
        _.zipObject(_.take(qw`ec ea el ev`, args.length), args));
    if (params.ec&&params.ea)
    {
        hash = crypto.createHash('md5').update(_.values(params).join(''))
            .digest('hex');
        send = !last_ev[hash] || last_ev[hash].ts<Date.now()-10*60*1000;
    }
    const last_day = Date.now()-24*3600*1000;
    if (!last_ev.clean || last_ev.clean.ts<last_day)
    {
        for (let k in last_ev)
        {
            if (last_ev[k].ts<last_day)
                delete last_ev[k];
        }
        last_ev.clean = {ts: Date.now()};
    }
    let ev;
    if (hash)
    {
        ev = (last_ev[hash]&&last_ev[hash].c||0)+1;
        last_ev[hash] = {ts: Date.now(), c: send ? 0 : ev};
    }
    if (send)
    {
        if (params.ev===undefined && ev>1)
            params.ev = ev;
        zerr.perr('event', {
            action: params.ea,
            category: params.ec,
            label: params.el,
            value: params.ev,
            customer_name: manager&&manager._defaults
                &&manager._defaults.customer,
        });
        ua_event(params, (..._args)=>{
            if (_.isFunction(cb))
                cb.apply(null, _args);
        });
    }
    else if (_.isFunction(cb))
        cb();
};
let write_ua_file = ()=>{
    if (!last_ev)
        return;
    try {
        file.write_e(ua_filename, JSON.stringify(last_ev));
        last_ev = null;
    } catch(e){ }
};
let write_status_file = (status, error = null, config = null, reason = null)=>{
    if (error)
        error = zerr.e2s(error);
    Object.assign(lpm_status, {
        last_updated: hutil.date(),
        status,
        reason,
        error,
        config,
        customer_name: config&&config._defaults&&config._defaults.customer
    });
    try {
        file.write_e(status_filename, JSON.stringify(lpm_status));
    } catch(e){ }
};
let read_status_file = ()=>{
    let status_file;
    let invalid_start = {'running': 1, 'initializing': 1, 'shutdowning': 1};
    try { status_file = JSON.parse(file.read_e(status_filename)); }
    catch(e){ status_file = {}; }
    if (status_file)
        lpm_status = status_file;
    if (status_file && invalid_start[status_file.status])
    {
        ua.event('manager', 'crash_sudden', JSON.stringify(status_file));
        zerr.perr('crash_sudden', lpm_status);
    }
};

let manager, args = process.argv.slice(2), shutdowning = false;
const enable_cluster = process.argv.includes('--cluster');
let shutdown_timeout;
let shutdown = (reason, send_ev = true, error = null)=>{
    if (shutdowning)
        return;
    shutdowning = true;
    shutdown_timeout = setTimeout(()=>{
        if (shutdowning)
        {
            if (manager)
                manager._log.crit('Forcing exit after 3 sec');
            else
                console.error('Forcing exit after 3 sec');
            process.exit(1);
        }
    }, 3000);
    write_ua_file();
    write_status_file('shutdowning', error, manager&&manager._total_conf,
        reason);
    if (manager)
    {
        manager._log.info(`Shutdown, reason is ${reason}`);
        if (error)
            manager._log.error('%s %s', reason, error);
        let stop_manager = ()=>{
            manager.stop(reason, true);
            manager = null;
        };
        if (manager.argv.no_usage_stats||!send_ev)
            stop_manager();
        else
            ua.event('manager', 'stop', reason, stop_manager);
    }
    else if (enable_cluster&&cluster.isMaster)
        cluster.workers.forEach(w=>{ w.send('shutdown'); });
    else
        console.log(`Shutdown, reason is ${reason}`, error.stack);
    write_status_file('shutdown', error, manager&&manager._total_conf,
        reason);
};
['SIGTERM', 'SIGINT', 'uncaughtException'].forEach(sig=>process.on(sig, err=>{
    const errstr = sig+(err ? ', error = '+zerr.e2s(err) : '');
    // XXX maximk: find origin and catch it there
    // XXX maximk: fix process fail on oveload
    if (err && (err.message||'').includes('SQLITE'))
    {
        manager._log.crit(errstr);
        manager.perr('sqlite', {error: errstr});
        return;
    }
    if (err&&manager)
        manager._log.crit(errstr);
    if (err&&manager&&!manager.argv.no_usage_stats)
    {
        ua.event('manager', 'crash', `v${version} ${err.stack}`,
            ()=>shutdown(errstr, false, err));
        zerr.perr('crash', {error: errstr, reason: sig,
            config: manager&&manager._total_conf});
    }
    else
        shutdown(errstr, true, err);
}));
let on_upgrade_finished;
(function run(run_config){
    read_status_file();
    if (enable_cluster&&cluster.isMaster)
    {
        console.log('WARNING: cluster mode is experimental');
        const cpus = os.cpus().length;
        for (let i=0; i<cpus; i++)
            cluster.fork();
        cluster.on('exit', worker=>{
            console.log('worker %d died', worker.id);
            if (!shutdowning)
                cluster.fork();
        });
        return;
    }
    write_status_file('initializing', null, manager&&manager._total_conf);
    manager = new Manager(args, Object.assign({ua}, run_config));
    manager.on('stop', ()=>{
        write_ua_file();
        zerr.flush();
        if (shutdown_timeout)
            clearTimeout(shutdown_timeout);
        process.exit();
    })
    .on('error', (e, fatal)=>{
        console.log(e.raw ? e.message : 'Unhandled error: '+e);
        let handle_fatal = ()=>{
            if (fatal)
                manager.stop();
        };
        if (manager.argv.no_usage_stats||e.raw)
            handle_fatal();
        else
        {
            ua.event('manager', 'error', `v${version} ${JSON.stringify(e)}`,
                handle_fatal);
        }
    })
    .on('config_changed', etask.fn(function*(zone_autoupdate){
        write_status_file('changing_config', null, zone_autoupdate);
        if (!manager.argv.no_usage_stats)
        {
            ua.event('manager', 'config_changed',
                JSON.stringify(zone_autoupdate));
        }
        args = manager.get_params();
        yield manager.stop('config change', true, true);
        setTimeout(()=>run(zone_autoupdate&&zone_autoupdate.prev ? {
            warnings: [`Your default zone has been automatically changed from `
                +`'${zone_autoupdate.prev}' to '${zone_autoupdate.zone}'.`],
        } : {}), 0);
    }))
    .on('upgrade', cb=>{
        if (on_upgrade_finished)
            return;
        process.send({command: 'upgrade'});
        on_upgrade_finished = cb;
    }).on('restart', ()=>process.send({command: 'restart'}));
    manager.start();
    write_status_file('running', null, manager&&manager._total_conf);
})();

process.on('message', msg=>{
    switch (msg.command)
    {
    case 'upgrade_finished':
        if (on_upgrade_finished)
            on_upgrade_finished(msg.error);
        on_upgrade_finished = undefined;
        break;
    case 'shutdown': shutdown(msg.reason, true, msg.error); break;
    }
});
