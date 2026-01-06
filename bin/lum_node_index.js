#!/usr/bin/env node
// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true, es9: true*/
const child_process = require('child_process');
const path = require('path');
const semver = require('semver');
const _ = require('lodash4');
const etask = require('../util/etask.js');
const {e2s} = require('../util/zerr.js');
const date = require('../util/date.js');
const perr = require('../lib/perr.js');
const logger = require('../lib/logger.js').child({category: 'lum_node_index'});
const ssl = require('../lib/ssl.js');
const lpm_config = require('../util/lpm_config.js');
const lpm_file = require('../util/lpm_file.js');
const file = require('../util/file.js');
const util_lib = require('../lib/util.js');
const string = require('../util/string.js'), {nl2sp} = string;
const pkg = require('../package.json');
const upgrader = require('./upgrader.js');
const qw = string.qw;
let forever, tail;
try {
    forever = require('forever');
    tail = require('tail').Tail;
} catch(e){
    logger.warn('daemon mode not supported');
}

class Daemon_mgr {
    #log = null;
    constructor(log_path){
        this.#log = new Daemon_log(log_path);
    }
    get log(){
        return this.#log;
    }
    get script(){
        return path.resolve(__dirname, 'index.js');
    }
}

class Daemon_log {
    #files = {};
    constructor(log_path){
        log_path = log_path||path.resolve(lpm_config.work_dir, 'daemon');
        if (!file.is_dir(log_path))
            file.mkdirp_e(log_path);
        const files = ['out', 'err', 'daemon']
            .map(t=>path.resolve(log_path, t+'.log'));
        const [out, err, daemon] = files;
        this.#files = {out, err, daemon};
        this.str_success = ['Open admin browser'];
        this.str_fail = ['Shutdown', 'is already running'];
        this.str_continue = this.str_success.concat(this.str_fail);
    }
    get files(){
        return this.#files;
    }
    is_continue_log = str=>this.str_continue.some(s=>str.includes(s));
    is_success_log = str=>this.str_success.some(s=>str.includes(s));
    is_fail_log = str=>this.str_fail.some(s=>str.includes(s));
    clear(){
        Object.values(this.#files).forEach(f=>{
            if (file.exists(f))
                file.unlink_e(f);
        });
    }
    ensure(type, timeout=5*date.ms.SEC){
        if (!this.#files[type])
            throw new Error('Wrong log file type: '+type);
        const file_path = this.#files[type];
        return etask(function*(){
            this.alarm(timeout, ()=>this.return(false));
            while (!file.exists(file_path))
                yield etask.sleep(0);
            return true;
        });
    }
}

const watch_file = (filename, opt={}, watcher_opt={})=>{
    if (!tail)
        return;
    const handle_line = typeof opt == 'function' ? opt
        : typeof opt.handle_line == 'function' ? opt.handle_line : _.noop;
    const watcher = new tail(filename, watcher_opt);
    watcher.on('line', line=>{
        if (opt.stdout)
            process.stdout.write(line+'\n');
        handle_line(line);
    });
    watcher.on('error', e=>{
        throw new Error(e);
    });
    return watcher;
};

const wait_file_line = (filename, resolve, opt={}, wopt={})=>etask(function*(){
    this.on('uncaught', ()=>this.return(''));
    this.finally(()=>watcher&&watcher.unwatch());
    let watcher;
    if (!tail)
        return '';
    const handle_line = line=>resolve(line) ? this.continue(line) : null;
    watcher = watch_file(filename, {...opt, handle_line}, wopt);
    return yield this.wait(opt.timeout);
});

const handle_daemon_errors = et=>
    et.on('uncaught', e=>logger.error('Daemon: Uncaught exception: '+e2s(e)));

const check_deamon_supported = (no_throw=false)=>{
    if (forever)
        return true;
    if (no_throw)
        return false;
    throw new Error('Deamon mode not supported');
};

class Lum_node_index {
    constructor(argv){
        this.argv = argv;
        perr.run({enabled: !argv.no_usage_stats, zagent: argv.zagent});
    }
    is_daemon_running(){
        const _this = this;
        if (!check_deamon_supported(true))
            return false;
        return etask(function*is_daemon_running(){
            const {index} = yield _this._find_child(new Daemon_mgr().script);
            return index > -1;
        });
    }
    _find_child(script){
        const _this = this;
        return etask(function*(){
            const list = (yield _this.ensure_daemon_processes(100))||[];
            const index = list.findIndex(p=>p.running &&
                p.uid==lpm_config.daemon_name && p.file==script);
            return {index, ...list[index]||{}};
        });
    }
    ensure_daemon_processes(max_tries=Infinity){
        return etask(function*(){
            let i = 0, list;
            do {
                forever.list(false, (e, res)=>{
                    if (e)
                        logger.error('Forever list: '+e2s(e));
                    this.continue(res);
                });
                list = yield this.wait();
            } while (!list && ++i<max_tries);
            return list;
        });
    }
    start_daemon(){ return etask(function*start_daemon(){
        handle_daemon_errors(this);
        check_deamon_supported();
        const mgr = new Daemon_mgr();
        logger.notice('Running in daemon: %s', mgr.script);
        mgr.log.clear();
        forever.startDaemon(mgr.script, {
            max: 1,
            minUptime: 2000,
            silent: true,
            uid: lpm_config.daemon_name,
            logFile: mgr.log.files.daemon,
            outFile: mgr.log.files.out,
            errFile: mgr.log.files.err,
            args: process.argv.filter(arg=>arg!='-d'&&!arg.includes('daemon')),
            killTree: true,
        }).on('spawn', ()=>logger.notice('Daemon spawned'));
        if (!(yield mgr.log.ensure('out')))
            return logger.error('Can not find daemon log file');
        const last_line = yield wait_file_line(mgr.log.files.out,
            mgr.log.is_continue_log, {stdout: true});
        if (mgr.log.is_fail_log(last_line))
            logger.error('Daemon failed to start');
    }); }
    stop_daemon(){
        const _this = this;
    return etask(function*stop_daemon(){
        handle_daemon_errors(this);
        check_deamon_supported();
        const {index, pid} = yield _this._find_child(new Daemon_mgr().script);
        if (!pid)
            return logger.notice('There is no running PMGR daemons');
        const stop_emitter = forever.stop(index);
        stop_emitter.on('stop', ()=>{
            logger.notice('Daemon process stopped');
            this.continue();
        });
        stop_emitter.on('error', e=>{
            logger.error('Daemon process stop error: %s', e.message);
            this.continue();
        });
        yield this.wait();
    }); }
    restart_daemon(){
        const _this = this;
    return etask(function*(){
        handle_daemon_errors(this);
        check_deamon_supported();
        this.alarm_throw(30*date.ms.SEC);
        const mgr = new Daemon_mgr();
        const {index, pid} = yield _this._find_child(mgr.script);
        if (!pid)
            return logger.notice('There is no running PMGR daemons');
        logger.notice('Restarting daemon...');
        const on_error = e=>{
            logger.error('Error: %s', e.message);
            this.continue();
        };
        if (!(yield mgr.log.ensure('out')))
        {
            logger.error('Can not find daemon log file %s. Output ommited',
                mgr.log.files.out);
            forever.restart(index).on('restart', ()=>{
                logger.notice('Daemon process (%s) restarted');
                this.continue();
            }).on('error', on_error);
            return yield this.wait();
        }
        forever.restart(index).on('error', on_error);
        yield wait_file_line(mgr.log.files.out, mgr.log.is_continue_log,
            {stdout: true});
    }); }
    show_status(){
        const _this = this;
        return etask(function*status(){
        this.on('uncaught', e=>{
            logger.error('Status: Uncaught exception: '+e2s(e));
        });
        const running_daemon = yield _this.is_daemon_running();
        const tasks = yield util_lib.get_lpm_tasks({all_processes: true});
        if (!tasks.length && !running_daemon)
            return logger.notice('There is no Proxy Manager process running');
        let msg = 'Proxy manager status:\n';
        if (running_daemon)
        {
            msg += 'Running in daemon mode. You can close it by '+
            'running \'luminati --stop-daemon\'\n';
        }
        msg += util_lib.get_status_tasks_msg(tasks);
        logger.notice(msg);
        });
    }
    gen_cert(){
        logger.notice('Generating cert');
        ssl.gen_cert();
    }
    _cleanup_file(file_path){
        try {
            file.unlink_e(path.resolve(lpm_file.work_dir, file_path));
        } catch(e){
            logger.debug(e.message);
        }
    }
    _cleanup_local_files(){
        const local_files = qw`.luminati.json
            .luminati.db .luminati.db.0 .luminati.db.1 .luminati.db.2
            .luminati.db.3 .luminati.db.4 .luminati.uuid`;
        local_files.forEach(this._cleanup_file);
    }
    restart_on_child_exit(opt){
        if (!this.child)
            return;
        this.child.removeListener('exit', this.restart_on_child_exit);
        if (opt.cleanup)
            this._cleanup_local_files();
        setTimeout(()=>this.create_child(opt), 5000);
    }
    shutdown_on_child_exit(){
        process.exit();
    }
    create_child(opt={}){
        process.env.LUM_MAIN_CHILD = true;
        const exec_argv = process.execArgv;
        if (!lpm_config.is_win && this.is_node_compatible('>10.15.0'))
            exec_argv.push('--max-http-header-size=80000');
        if (this.argv.insecureHttpParser)
            exec_argv.push('--insecure-http-parser');
        const child_opt = {
            stdio: 'inherit',
            env: process.env,
            execArgv: exec_argv,
        };
        this.child = child_process.fork(path.resolve(__dirname, 'lum_node.js'),
            process.argv.slice(2), child_opt);
        this.child.on('message', this.msg_handler.bind(this));
        this.child.on('exit', this.shutdown_on_child_exit);
        this.child.send(Object.assign(opt, {command: 'run', argv: this.argv}));
    }
    msg_handler(msg){
        switch (msg.command)
        {
        case 'shutdown_master':
            return process.exit();
        case 'restart':
            this.child.removeListener('exit', this.shutdown_on_child_exit);
            this.child.on('exit', this.restart_on_child_exit.bind(this, msg));
            this.child.kill();
            break;
        case 'upgrade':
            this.upgrade();
            break;
        case 'downgrade':
            this.downgrade();
            break;
        }
    }
    init_traps(){
        ['SIGTERM', 'SIGINT', 'uncaughtException'].forEach(sig=>{
            process.on(sig, e=>{
                setTimeout(()=>process.exit(), 5000);
            });
        });
        if (lpm_config.is_win)
        {
            const readline = require('readline');
            readline.createInterface({
                input: process.stdin,
                output: process.stdout,
            }).on('SIGINT', ()=>process.emit('SIGINT'));
        }
    }
    upgrade(opt={}){
        upgrader.upgrade(error=>{
            if (this.child)
                this.child.send({command: 'upgrade_finished', error});
            this.restart_daemon();
        });
    }
    downgrade(){
        upgrader.downgrade(error=>{
            if (this.child)
                this.child.send({command: 'downgrade_finished', error});
            this.restart_daemon();
        });
    }
    is_node_compatible(compare_ver){
        const node_ver = process.versions.node;
        return semver.satisfies(node_ver, compare_ver);
    }
    check_node_ver(){
        const recommended_ver = pkg.recommendedNode;
        const node_ver = process.versions.node;
        if (!this.is_node_compatible(recommended_ver))
        {
            logger.warn(nl2sp`Node version is too old (${node_ver}). Proxy
                Manager requires at least ${recommended_ver} to run
                correctly.`);
        }
    }
    run(){
        if (this.argv.startUpgrader)
            return upgrader.start_upgrader();
        if (this.argv.stopUpgrader)
            return upgrader.stop_upgrader();
        if (this.argv.daemon_opt.start)
            return this.start_daemon();
        if (this.argv.daemon_opt.stop)
            return this.stop_daemon();
        if (this.argv.daemon_opt.restart)
            return this.restart_daemon();
        if (this.argv.status)
            return this.show_status();
        if (this.argv.genCert)
            return this.gen_cert();
        if (this.argv.upgrade)
            return this.upgrade();
        if (this.argv.downgrade)
            return this.downgrade();
        this.check_node_ver();
        this.init_traps();
        this.create_child();
    }
}
module.exports = Lum_node_index;
