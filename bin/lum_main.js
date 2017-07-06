#!/usr/bin/env node
// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/

const Manager = require('../lib/manager.js');
const hutil = require('hutil');
const etask = hutil.etask;
const version = require('../package.json').version;
const analytics = require('universal-analytics');
const _ = require('lodash');
const file = require('hutil').file;
const qw = require('hutil').string.qw;
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const ua = analytics('UA-60520689-2');

ua.set('an', 'LPM');
ua.set('av', `v${version}`);

const ua_filename = path.resolve(os.homedir(),
    '.luminati_ua_ev.json'.substr(process.platform=='win32' ? 1 : 0));
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
let manager, args = process.argv.slice(2), shutdowning = false;
let shutdown = (reason, send_ev = true)=>{
    if (shutdowning)
        return;
    console.log('Shutdown, reason is '+reason);
    shutdowning = true;
    write_ua_file();
    if (manager)
    {
        let stop_manager = ()=>{
            manager.stop(reason, true);
            manager = null;
        };
        if (manager.argv.no_usage_stats||!send_ev)
            stop_manager();
        else
            ua.event('manager', 'stop', reason, stop_manager);
    }
};
['SIGTERM', 'SIGINT', 'uncaughtException'].forEach(sig=>process.on(sig, err=>{
    const errstr = sig+(err ? ', error = '+err : '');
    if (err&&manager)
    {
        manager._log.error(errstr);
        manager._log.silly(err, err.stack);
    }
    if (err&&manager&&!manager.argv.no_usage_stats)
    {
        ua.event('manager', 'crash', `v${version} ${err.stack}`,
            ()=>shutdown(errstr, false));
    }
    else
        shutdown(errstr);
}));
let on_upgrade_finished;
(function run(run_config){
    manager = new Manager(args, Object.assign({ua}, run_config));
    manager.on('www_ready', ()=>
        ua.event('admin_ready', 'sniffing', ''+manager.argv.ssl))
    .on('stop', ()=>{
        write_ua_file();
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
})();

process.on('message', msg=>{
    switch (msg.command)
    {
    case 'upgrade_finished':
        if (on_upgrade_finished)
            on_upgrade_finished(msg.error);
        on_upgrade_finished = undefined;
        break;
    case 'shutdown': shutdown(msg.reason); break;
    }
});
