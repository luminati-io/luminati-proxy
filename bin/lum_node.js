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
const pkg = require('../package.json');
const _ = require('lodash');
const crypto = require('crypto');
const ps_list = require('ps-list');
const analytics = require('../lib/analytics.js');
const ua = analytics.get_ua();
const E = module.exports = {};
const is_win = process.platform=='win32';
const shutdown_timeout = 3000;
const child_process = require('child_process');
const os = require('os');
const download = require('download');
const extract = require('extract-zip');
const is_pkg = typeof process.pkg!=='undefined';
const path = require('path');
const ws = require('lum_windows-shortcuts');
const install_path = path.resolve(os.homedir(), 'luminati_proxy_manager');
const exe_path = path.resolve(install_path, 'lpm.exe');

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
            customer_name: _.get(E.manager, '_defaults.customer'),
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
        customer_name: _.get(config, '_defaults.customer'),
    });
    try { file.write_e(E.status_filename, JSON.stringify(E.lpm_status)); }
    catch(e){ zerr.notice(`Fail to write status file: ${zerr.e2s(e)}`); }
};

E.read_status_file = ()=>{
    let status_file;
    const invalid_start = {'running': 1, 'initializing': 1, 'shutdowning': 1};
    try { status_file = JSON.parse(file.read_e(E.status_filename)); }
    catch(e){ status_file = {}; }
    if (status_file)
        E.lpm_status = status_file;
    if (status_file && invalid_start[status_file.status])
        zerr.perr('crash_sudden', E.lpm_status);
};

E.shutdown = (reason, error=null)=>{
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
        E.manager.stop(reason, true);
        E.manager = null;
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
    if (err)
    {
        zerr.crit(errstr);
        if ((err.message||'').includes('SQLITE') && E.manager)
            return void E.manager.perr('crash_sqlite', {error: errstr});
    }
    etask(function*handle_signal_lum_node(){
        if (sig=='SIGINT'||sig=='SIGTERM')
            yield zerr.perr('sig', {reason: sig});
        else
        {
            yield zerr.perr('crash', {error: errstr, reason: sig,
                customer: _.get(E.manager, '_defaults.customer'),
                config: _.get(E.manager, '_total_conf')});
        }
        E.shutdown(errstr, err);
    });
};

const add_alias_for_whitelist_ips = ()=>{
    const func =
        `curl_add_ip(){\n`+
        `    ENDPOINT="http://127.0.0.1:22999/api/add_whitelist_ip"\n`+
        `    DATA="ip="$1\n`+
        `    curl $ENDPOINT -X POST -d $DATA\n`+
        `}`;
    const name = 'lpm_whitelist_ip';
    const cmd = 'curl_add_ip';
    const bashrc_path = os.homedir()+'/.bashrc';
    let bashrc;
    try { bashrc = file.read_e(bashrc_path); }
    catch(e){
        zerr.notice(`.bashrc not found! alias for whitelisting failed`);
        return;
    }
    if (/lpm_whitelist_ip/.test(bashrc)||/curl_add_ip/.test(bashrc))
    {
        zerr.notice(`${name} already installed`);
        return;
    }
    zerr.notice(`installing ${name}`);
    try {
        const alias = `alias ${name}='${cmd}'`;
        file.append_e(bashrc_path, func+'\n'+alias);
        child_process.execSync(func);
        child_process.execSync(alias);
    } catch(e){ zerr.warn(`Failed to install ${name}: ${e.message}`); }
};

let conflict_shown = false;
const show_port_conflict = (port, force)=>etask(function*(){
    if (conflict_shown)
        return;
    conflict_shown = true;
    yield _show_port_conflict(port, force);
});

const get_lpm_tasks = ()=>etask(function*(){
    let tasks;
    try { tasks = yield ps_list(); }
    catch(e){ process.exit(); }
    return tasks.filter(t=>t.name.includes('node') &&
        /.*lum_node\.js.*/.test(t.cmd) && t.ppid!=process.pid &&
        t.pid!=process.pid);
});

const _show_port_conflict = (port, force)=>etask(function*(){
    const tasks = yield get_lpm_tasks();
    if (!tasks.length)
    {
        zerr.notice(`There is a conflict on port ${port}`);
        return E.manager.stop();
    }
    const pid = tasks[0].pid;
    zerr.notice(`LPM is already running (${pid}) and uses port ${port}`);
    if (!force)
    {
        zerr.notice('If you want to kill other instances use --force flag');
        return process.exit();
    }
    zerr.notice('Trying to kill it and restart.');
    for (const t of tasks)
        process.kill(t.ppid, 'SIGTERM');
    E.manager.restart();
});

const check_running = argv=>etask(function*(){
    const tasks = yield get_lpm_tasks();
    if (!tasks.length)
        return;
    if (!argv.dir)
    {
        zerr.notice(`LPM is already running (${tasks[0].pid})`);
        zerr.notice('You need to pass a separate path to the directory for'
            +' this LPM instance. Use --dir flag');
        process.exit();
    }
});

const upgrade_win = function(){
    try {
        zerr.notice('Copying %s to %s', process.execPath, exe_path);
        file.copy_e(process.execPath, exe_path);
        const subprocess = child_process.spawn(exe_path, ['--cleanup_win',
            process.execPath, '--kill_pid', process.pid],
            {detached: true, stdio: 'ignore', shell: true});
        subprocess.unref();
    } catch(e){
        zerr.notice(e.message);
    }
};

const install_win = ()=>etask(function*lum_node_install_win(){
    this.on('uncaught', e=>{
        zerr('There was an error while installing on Windows: %s', e.message);
    });
    zerr.notice('Checking installation on Windows');
    if (!file.exists(install_path))
    {
        file.mkdir_e(install_path);
        zerr.notice('Created %s', install_path);
    }
    if (process.execPath!=exe_path)
        upgrade_win();
    const lnk_path = path.resolve(os.homedir(),
        'Desktop/Luminati Proxy Manager.lnk');
    if (!file.exists(lnk_path))
    {
        ws.create(lnk_path, {
            target: exe_path,
            icon: path.join(__dirname, '../build/pkgcon.ico'),
        }, e=>{
            if (e)
                return console.log('ERR while creating a shortcut: %s', e);
            console.log('shortcut created: %s', lnk_path);
        });
    }
    const puppeteer_path = path.resolve(install_path, 'chromium');
    if (file.exists(puppeteer_path))
        return;
    const old_install_path = path.resolve(os.homedir(),
        'AppData/Local/Programs/@luminati-ioluminati-proxy');
    const old_puppeteer_path = path.resolve(old_install_path,
        'resources/app/node_modules/puppeteer/.local-chromium');
    if (file.exists(old_puppeteer_path))
    {
        const new_puppeteer_path = path.resolve(install_path, 'chromium');
        zerr.notice('Copying puppeteer from %s to %s', old_puppeteer_path,
            new_puppeteer_path);
        file.rename_e(old_puppeteer_path, new_puppeteer_path);
        return zerr.notice('Puppeteer reused from previous installation');
    }
    zerr.notice('Started fetching puppeteer binary');
    yield download(`http://${pkg.api_domain}/static/lpm/puppeteer.zip`, 'tmp');
    const source = path.join(process.cwd(), 'tmp', 'puppeteer.zip');
    extract(source, {dir: install_path}, err=>{
        if (err)
            return this.throw(err);
        zerr.notice('Puppeteer fetched');
    });
});

const cleanup_win = function(_path){
    zerr.notice('Cleaning up after installation. Deleting file %s', _path);
    try {
        file.unlink_e(_path);
    } catch(e){
        zerr.notice(e.message);
    }
};

E.run = (argv, run_config)=>etask(function*(){
    zerr.notice('Running Luminati Proxy Manager v%s, PID: %s', pkg.version,
        process.pid);
    if (is_pkg && argv.kill_pid)
    {
        zerr.notice('Killing previous process %s', argv.kill_pid);
        try {
            process.kill(argv.kill_pid);
            yield etask.sleep(4000);
        } catch(e){ zerr.notice('Could not kill process %s', argv.kill_pid); }
    }
    yield check_running(argv);
    if (is_pkg && argv.upgrade_win)
        upgrade_win();
    else if (is_pkg && argv.cleanup_win)
        cleanup_win(argv.cleanup_win);
    if (is_pkg)
        install_win();
    if (!is_pkg)
        add_alias_for_whitelist_ips();
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
        let match;
        if (match = e.message.match(/EADDRINUSE.+:(\d+)/))
            return show_port_conflict(match[1], argv.force);
        zerr(e.raw ? e.message : 'Unhandled error: '+e);
        const handle_fatal = ()=>{
            if (fatal)
                E.manager.stop();
        };
        if (!analytics.enabled||e.raw)
            handle_fatal();
        else
        {
            // XXX krzysztof: make a generic function for sending crashes
            etask(function*send_err(){
                yield zerr.perr('crash', {error: zerr.e2s(e),
                    customer: _.get(E.manager, '_defaults.customer'),
                    config: _.get(E.manager, '_total_conf')});
                handle_fatal();
            });
        }
    })
    .on('config_changed', etask.fn(function*(zone_autoupdate){
        E.write_status_file('changing_config', null, zone_autoupdate);
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
});

E.handle_upgrade_finished = msg=>{
    if (E.on_upgrade_finished)
        E.on_upgrade_finished(msg.error);
    E.on_upgrade_finished = undefined;
};

E.handle_shutdown = msg=>{
    E.shutdown(msg.reason, msg.error);
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

E.init_ua = argv=>{
    ua.set('an', 'LPM');
    ua.set('av', `v${pkg.version}`);
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
        version: pkg.version,
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
    E.init_ua(argv);
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
