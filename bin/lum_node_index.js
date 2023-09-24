#!/usr/bin/env node
// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/
const semver = require('semver');
const etask = require('../util/etask.js');
const zerr = require('../util/zerr.js');
const perr = require('../lib/perr.js');
const logger = require('../lib/logger.js').child({category: 'lum_node_index'});
const ssl = require('../lib/ssl.js');
const lpm_config = require('../util/lpm_config.js');
const lpm_file = require('../util/lpm_file.js');
const file = require('../util/file.js');
const child_process = require('child_process');
const path = require('path');
const util_lib = require('../lib/util.js');
const upgrader = require('./upgrader.js');
const string = require('../util/string.js'), {nl2sp} = string;
const pkg = require('../package.json');
const qw = string.qw;
let pm2;
try { pm2 = require('pm2'); }
catch(e){ logger.warn('could not load pm2: daemon mode not supported'); }

class Lum_node_index {
    constructor(argv){
        this.argv = argv;
        perr.run({enabled: !argv.no_usage_stats, zagent: argv.zagent});
    }
    is_daemon_running(list){
        const daemon = list.find(p=>p.name==lpm_config.daemon_name);
        return !!daemon &&
            ['online', 'launching'].includes(daemon.pm2_env.status);
    }
    pm2_cmd(command, opt){ return etask(function*pm2_cmd(){
        this.on('uncaught', e=>{
            if (e.message=='process name not found')
                logger.notice('There is no running Proxy Manager daemons');
            else
                logger.error('PM2: Uncaught exception: '+zerr.e2s(e));
        });
        this.on('finally', ()=>pm2.disconnect());
        yield etask.nfn_apply(pm2, '.connect', []);
        if (!Array.isArray(opt))
            opt = [opt];
        return yield etask.nfn_apply(pm2, '.'+command, opt);
    }); }
    start_daemon(){
    return etask(function*start_daemon(){
        this.on('uncaught', e=>{
            logger.error('PM2: Uncaught exception: '+zerr.e2s(e));
        });
        this.on('finally', ()=>pm2.disconnect());
        const script = path.resolve(__dirname, 'index.js');
        logger.notice('Running in daemon: %s', script);
        const daemon_start_opt = {
            name: lpm_config.daemon_name,
            script,
            mergeLogs: false,
            output: '/dev/null',
            error: '/dev/null',
            autorestart: true,
            killTimeout: 5000,
            restartDelay: 5000,
            args: process.argv.filter(arg=>arg!='-d'&&!arg.includes('daemon')),
        };
        yield etask.nfn_apply(pm2, '.connect', []);
        yield etask.nfn_apply(pm2, '.start', [daemon_start_opt]);
        const bus = yield etask.nfn_apply(pm2, '.launchBus', []);
        bus.on('log:out', data=>{
            if (data.process.name!=lpm_config.daemon_name)
                return;
            process.stdout.write(data.data);
            if (data.data.includes('Open admin browser') ||
                data.data.includes('Shutdown'))
            {
                this.continue();
            }
        });
        yield this.wait();
    }); }
    stop_daemon(){
        const _this = this;
    return etask(function*stop_daemon(){
        this.on('uncaught', e=>{
            logger.error('PM2: Uncaught exception: '+zerr.e2s(e));
        });
        this.on('finally', ()=>pm2.disconnect());
        yield etask.nfn_apply(pm2, '.connect', []);
        const pm2_list = yield etask.nfn_apply(pm2, '.list', []);
        if (!_this.is_daemon_running(pm2_list))
            return logger.notice('There is no running Proxy Manager daemons');
        const bus = yield etask.nfn_apply(pm2, '.launchBus', []);
        let start_logging;
        bus.on('log:out', data=>{
            if (data.process.name!=lpm_config.daemon_name)
                return;
            start_logging = start_logging||data.data.includes('Shutdown');
            if (!start_logging || !data.data.includes('NOTICE'))
                return;
            process.stdout.write(data.data);
        });
        bus.on('process:event', data=>{
            if (data.process.name==lpm_config.daemon_name &&
                ['delete', 'stop'].includes(data.event))
            {
                this.continue();
            }
        });
        yield etask.nfn_apply(pm2, '.stop', [lpm_config.daemon_name]);
        yield this.wait();
    }); }
    restart_daemon(){
        const _this = this;
        return etask(function*(){
            const pm2_list = yield _this.pm2_cmd('list');
            if (_this.is_daemon_running(pm2_list))
            {
                logger.notice('Restarting daemon...');
                yield _this.pm2_cmd('restart', lpm_config.daemon_name);
                logger.notice('Daemon restarted');
            }
        });
    }
    show_status(){
        const _this = this;
        return etask(function*status(){
        this.on('uncaught', e=>{
            logger.error('Status: Uncaught exception: '+zerr.e2s(e));
        });
        const pm2_list = yield _this.pm2_cmd('list');
        const running_daemon = _this.is_daemon_running(pm2_list);
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
