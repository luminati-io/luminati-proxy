#!/usr/bin/env node
// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/
const etask = require('../util/etask.js');
const zerr = require('../util/zerr.js');
require('../lib/perr.js').run({});
const logger = require('../lib/logger.js').child({category: 'lum_node_index'});
const ssl = require('../lib/ssl.js');
const lpm_config = require('../util/lpm_config.js');
const pm2 = require('pm2');
const child_process = require('child_process');
const path = require('path');
const util_lib = require('../lib/util.js');
const upgrader = require('./upgrader.js');

class Lum_node_index {
    constructor(argv){
        this.argv = argv;
    }
    is_daemon_running(list){
        const daemon = list.find(p=>p.name==lpm_config.daemon_name);
        return !!daemon &&
            ['online', 'launching'].includes(daemon.pm2_env.status);
    }
    pm2_cmd(command, opt){ return etask(function*pm2_cmd(){
        this.on('uncaught', e=>{
            if (e.message=='process name not found')
                logger.notice('There is no running LPM daemon process');
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
        const _this = this;
    return etask(function*start_daemon(){
        this.on('uncaught', e=>{
            logger.error('PM2: Uncaught exception: '+zerr.e2s(e));
        });
        this.on('finally', ()=>pm2.disconnect());
        const script = _this.argv.$0;
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
            return logger.notice('There is no running LPM daemon process');
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
            return logger.notice('There is no LPM process running');
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
    restart_on_child_exit(is_upgraded){
        if (!this.child)
            return;
        this.child.removeListener('exit', this.restart_on_child_exit);
        setTimeout(()=>this.create_child(is_upgraded), 5000);
    }
    shutdown_on_child_exit(){
        process.exit();
    }
    create_child(is_upgraded){
        process.env.LUM_MAIN_CHILD = true;
        this.child = child_process.fork(
            path.resolve(__dirname, 'lum_node.js'),
            process.argv.slice(2), {stdio: 'inherit', env: process.env});
        this.child.on('message', this.msg_handler.bind(this));
        this.child.on('exit', this.shutdown_on_child_exit);
        this.child.send({command: 'run', argv: this.argv, is_upgraded});
    }
    msg_handler(msg){
        switch (msg.command)
        {
        case 'shutdown_master':
            return process.exit();
        case 'restart':
            this.child.removeListener('exit', this.shutdown_on_child_exit);
            this.child.on('exit', this.restart_on_child_exit.bind(this,
                msg.is_upgraded));
            this.child.kill();
            break;
        case 'upgrade':
            upgrader.upgrade(error=>{
                this.child.send({command: 'upgrade_finished', error});
                this.restart_daemon();
            });
            break;
        case 'downgrade':
            upgrader.downgrade(error=>{
                this.child.send({command: 'downgrade_finished', error});
                this.restart_daemon();
            });
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
            return upgrader.upgrade();
        if (this.argv.downgrade)
            return upgrader.downgrade();
        this.init_traps();
        this.create_child();
    }
}
module.exports = Lum_node_index;
