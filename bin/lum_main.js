#!/usr/bin/env node
// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/

const Manager = require('../lib/manager.js');
const hutil = require('hutil');
const etask = hutil.etask;
const analytics = require('universal-analytics');
const ua = analytics('UA-60520689-2');

let manager, args = process.argv.slice(2), shutdowning = false;
let shutdown = reason=>{
    if (shutdowning)
        return;
    console.log('Shutdown, reason is '+reason);
    shutdowning = true;
    if (manager)
    {
        let stop_manager = ()=> {
            manager.stop(reason, true);
            manager = null;
        };
        if (manager.argv.no_usage_stats)
            stop_manager();
        else
            ua.event('manager', 'stop', reason, stop_manager);
    }
};
['SIGTERM', 'SIGINT', 'uncaughtException'].forEach(sig=>process.on(sig, err=>{
    const errstr = sig+(err ? ', error = '+err : '');
    if (err&&manager&&!manager.argv.no_usage_stats)
    {
        ua.event('manager', 'error', `${err.message}, stack: ${err.stack}`,
            ()=>shutdown(errstr));
    }
    else
        shutdown(errstr);
}));
let on_upgrade_finished;
(function run(run_config){
    manager = new Manager(args, Object.assign({ua}, run_config));
    manager.on('stop', ()=>process.exit())
    .on('www_ready', url=>{
        if (!manager.argv.no_usage_stats)
            ua.event('manager', 'www_ready', url).send();
    })
    .on('error', (e, fatal)=>{
        console.log(e.raw ? e.message : 'Unhandled error: '+e);
        let handle_fatal = ()=>{
            if (fatal)
                manager.stop();
        };
        if (manager.argv.no_usage_stats)
            handle_fatal();
        else
            ua.event('manager', 'error', JSON.stringify(e), handle_fatal);
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
