#!/usr/bin/env node
// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/
const Manager = require('../lib/manager.js');
const Tracer = require('../lib/tracer.js');
const file = require('../util/file.js');
const etask = require('../util/etask.js');
const zerr = require('../util/zerr.js');
const lpm_util = require('../util/lpm_util.js');
const lpm_file = require('../util/lpm_file.js');
const qw = require('../util/string.js').qw;
const zdate = require('../util/date.js');
require('../lib/perr.js').run({});
const version = require('../package.json').version;
const analytics = require('universal-analytics');
const _ = require('lodash');
const crypto = require('crypto');
const ps_list = require('ps-list');
const ua = analytics('UA-60520689-2');
const E = module.exports = {};
const is_win = process.platform=='win32';
const shutdown_timeout = 3000;

const gen_filename = name=>{
    return lpm_file.get_file_path(
        `.luminati_${name}.json`.substr(is_win ? 1 : 0));
};
let prev_ua_event = ua.event.bind(ua);
let ua_event_wrapper = (...args)=>{
    let send = true, hash;
    if (!E.last_ev)
    {
        try { E.last_ev = JSON.parse(file.read_e(E.ua_filename)); }
        catch(e){ E.last_ev = {}; }
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
        send = !E.last_ev[hash] || E.last_ev[hash].ts<Date.now()-10*60*1000;
    }
    const last_day = Date.now()-24*3600*1000;
    if (!E.last_ev.clean || E.last_ev.clean.ts<last_day)
    {
        for (let k in E.last_ev)
        {
            if (E.last_ev[k].ts<last_day)
                delete E.last_ev[k];
        }
        E.last_ev.clean = {ts: Date.now()};
    }
    let ev;
    if (hash)
    {
        ev = (E.last_ev[hash]&&E.last_ev[hash].c||0)+1;
        E.last_ev[hash] = {ts: Date.now(), c: send ? 0 : ev};
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
            customer_name: E.manager&&E.manager._defaults
                &&E.manager._defaults.customer,
        });
        prev_ua_event(params, (..._args)=>{
            if (_.isFunction(cb))
                cb.apply(null, _args);
        });
    }
    else if (_.isFunction(cb))
        cb();
};

E.write_ua_file = ()=>{
    if (!E.last_ev)
        return;
    try {
        file.write_e(E.ua_filename, JSON.stringify(E.last_ev));
        E.last_ev = null;
    } catch(e){ zerr.notice(`Fail to write ua file: ${zerr.e2s(e)}`); }
};

E.write_status_file = (status, error = null, config = null, reason = null)=>{
    if (error)
        error = zerr.e2s(error);
    Object.assign(E.lpm_status, {
        last_updated: zdate(),
        status,
        reason,
        error,
        config,
        customer_name: config&&config._defaults&&config._defaults.customer
    });
    try { file.write_e(E.status_filename, JSON.stringify(E.lpm_status)); }
    catch(e){ zerr.notice(`Fail to write status file: ${zerr.e2s(e)}`); }
};

E.read_status_file = ()=>{
    let status_file;
    let invalid_start = {'running': 1, 'initializing': 1, 'shutdowning': 1};
    try { status_file = JSON.parse(file.read_e(E.status_filename)); }
    catch(e){ status_file = {}; }
    if (status_file)
        E.lpm_status = status_file;
    if (status_file && invalid_start[status_file.status])
    {
        ua.event('manager', 'crash_sudden', JSON.stringify(status_file));
        zerr.perr('crash_sudden', E.lpm_status);
    }
};

E.shutdown = (reason, send_ev = true, error = null)=>{
    if (E.shutdowning)
        return;
    E.shutdowning = true;
    E.shutdown_timeout = setTimeout(()=>{
        if (!E.shutdowning)
            return;
        zerr.crit('Forcing exit after 3 sec');
        E.uninit();
        process.exit(1);
    }, shutdown_timeout);
    E.write_ua_file();
    E.write_status_file('shutdowning', error, E.manager&&E.manager._total_conf,
        reason);
    if (E.manager)
    {
        let stop_manager = ()=>{
            E.manager.stop(reason, true);
            E.manager = null;
        };
        if (E.manager.argv.no_usage_stats||!send_ev)
            stop_manager();
        else
            ua.event('manager', 'stop', reason, stop_manager);
    }
    if (error)
        zerr(`Shutdown, reason is ${reason}: ${zerr.e2s(error)}`);
    else
        zerr.info(`Shutdown, reason is ${reason}`);
    file.rm_rf_e(Tracer.screenshot_dir);
    E.write_status_file('shutdown', error, E.manager&&E.manager._total_conf,
        reason);
};

E.handle_signal = (sig, err)=>{
    const errstr = sig+(err ? ', error = '+zerr.e2s(err) : '');
    // XXX maximk: find origin and catch it there
    // XXX maximk: fix process fail on oveload
    if (err)
    {
        zerr.crit(errstr);
        if ((err.message||'').includes('SQLITE') && E.manager)
            return void E.manager.perr('sqlite', {error: errstr});
    }
    if (err&&E.manager&&!E.manager.argv.no_usage_stats)
    {
        ua.event('manager', 'crash', `v${version} ${err.stack}`,
            ()=>E.shutdown(errstr, false, err));
        zerr.perr('crash', {error: errstr, reason: sig,
            config: E.manager&&E.manager._total_conf});
    }
    else
        E.shutdown(errstr, true, err);
};

let _show_port_conflict = (addr, port)=>etask(function*(){
    let tasks;
    try { tasks = yield ps_list(); }
    catch(e){ process.exit(); }
    tasks = tasks.filter(t=>t.name.includes('node') &&
        /.*lum_node\.js.*/.test(t.cmd) && t.ppid!=process.pid &&
        t.pid!=process.pid);
    if (!tasks.length)
        return E.manager.stop();
    zerr.notice(`There is already an application running on ${addr}:${port}\n`+
        'Trying to kill it and restart.');
    for (const t of tasks)
        process.kill(t.ppid, 'SIGTERM');
    E.manager.restart();
});

let conflict_shown;
let show_port_conflict = (addr, port)=>{
    if (conflict_shown)
        return;
    conflict_shown = true;
    _show_port_conflict(addr, port);
};

E.run = (argv, run_config)=>{
    E.read_status_file();
    E.write_status_file('initializing', null,
        E.manager&&E.manager._total_conf);
    E.manager = new Manager(argv, Object.assign({ua}, run_config));
    E.manager.on('stop', ()=>{
        E.write_ua_file();
        zerr.flush();
        if (E.shutdown_timeout)
            clearTimeout(E.shutdown_timeout);
        E.uninit();
        process.exit();
    })
    .on('error', (e, fatal)=>{
        zerr(e.raw ? e.message : 'Unhandled error: '+e);
        let handle_fatal = ()=>{
            let err;
            if (err = (e.message||'').match(/((?:\d{1,3}\.?){4}):(\d+)$/))
                return show_port_conflict(err[1], err[2]);
            if (fatal)
                E.manager.stop();
        };
        if (E.manager.argv.no_usage_stats||e.raw)
            handle_fatal();
        else
        {
            ua.event('manager', 'error', `v${version} ${JSON.stringify(e)}`,
                handle_fatal);
        }
    })
    .on('config_changed', etask.fn(function*(zone_autoupdate){
        E.write_status_file('changing_config', null, zone_autoupdate);
        if (!E.manager.argv.no_usage_stats)
        {
            ua.event('manager', 'config_changed',
                JSON.stringify(zone_autoupdate));
        }
        yield E.manager.stop('config change', true, true);
        setTimeout(()=>E.run(argv, zone_autoupdate&&zone_autoupdate.prev ? {
            warnings: [`Your default zone has been automatically changed from `
                +`'${zone_autoupdate.prev}' to '${zone_autoupdate.zone}'.`],
        } : {}), 0);
    }))
    .on('upgrade', cb=>{
        if (E.on_upgrade_finished)
            return;
        process.send({command: 'upgrade'});
        E.on_upgrade_finished = cb;
    }).on('restart', ()=>process.send({command: 'restart'}));
    E.manager.start();
    E.write_status_file('running', null, E.manager&&E.manager._total_conf);
};

E.handle_upgrade_finished = msg=>{
    if (E.on_upgrade_finished)
        E.on_upgrade_finished(msg.error);
    E.on_upgrade_finished = undefined;
};

E.handle_shutdown = msg=>{
    E.shutdown(msg.reason, true, msg.error);
};

E.handle_msg = msg=>{
    switch (msg.command||msg.cmd)
    {
    case 'upgrade_finished': E.handle_upgrade_finished(msg); break;
    case 'shutdown': E.handle_shutdown(msg); break;
    case 'run':
        E.init(msg.argv);
        E.run(msg.argv);
        break;
    }
};

E.init_ua = ()=>{
    ua.set('an', 'LPM');
    ua.set('av', `v${version}`);
    E.ua_filename = gen_filename('ua_ev');
    E.last_ev = null;
    ua.event = ua_event_wrapper;
};

E.uninit_ua = ()=>ua.event = prev_ua_event;

E.init_status = ()=>{
    E.status_filename = gen_filename('status');
    E.lpm_status = {
        status: 'initializing',
        config: null,
        error: null,
        create_date: zdate(),
        update_date: zdate(),
        customer_name: null,
        version,
    };
};

E.uninit_status = ()=>{};

E.init_traps = ()=>{
    E.trap_handlers = ['SIGTERM', 'SIGINT', 'uncaughtException'].map(
        sig=>({sig, handler: E.handle_signal.bind(E, sig)}));
    E.trap_handlers.forEach(({sig, handler})=>process.on(sig, handler));
};

E.uninit_traps = ()=>{
    if (!E.trap_handlers)
        return;
    E.trap_handlers.forEach(({sig, handler})=>process.removeListener(sig,
        handler));
};

E.init_cmd = ()=>{ process.on('message', E.handle_msg); };
E.uninit_cmd = ()=>{ process.removeListener('message', E.handle_msg); };

E.init = argv=>{
    if (E.initialized)
        return;
    E.initialized = true;
    E.shutdown_timeout = null;
    E.shutdowning = false;
    E.manager = null;
    E.on_upgrade_finished = null;
    E.init_ua();
    E.init_status();
    E.init_traps();
    if (process.env.DEBUG_ETASKS)
        E.start_debug_etasks(+process.env.DEBUG_ETASKS*1000);
};

E.uninit = ()=>{
    E.uninit_ua();
    E.uninit_status();
    E.uninit_traps();
    E.uninit_cmd();
    if (E.debug_etask_itv)
        clearInterval(E.debug_etask_itv);
    E.initialized = false;
};

E.start_debug_etasks = (interval = 10000)=>{
    E.debug_etask_itv = setInterval(()=>{
        console.log('=======================================');
        console.log('counter ps', etask.ps());
        console.log('=======================================');
    }, interval);
};

if (!module.parent)
{
    E.init_cmd();
    // XXX vladislavl: for debug purposes only
    if (!process.env.LUM_MAIN_CHILD)
    {
        const argv = lpm_util.init_args();
        E.init(argv);
        E.run(argv);
    }
}
