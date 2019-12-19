#!/usr/bin/env node
// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/

const check_compat = ()=>{
    delete require.cache[require.resolve('./check_compat.js')];
    if (!require('./check_compat.js').is_env_compat())
        process.exit();
};
check_compat();

const _ = require('lodash');
const etask = require('../util/etask.js');
const zerr = require('../util/zerr.js');
require('../lib/perr.js').run({});
const logger = require('../lib/logger.js');
const ssl = require('../lib/ssl.js');
const lpm_config = require('../util/lpm_config.js');
const pm2 = require('pm2');
const child_process = require('child_process');
const path = require('path');
const sudo_prompt = require('sudo-prompt');
const ipc = require('node-ipc');
const util_lib = require('../lib/util.js');

ipc.config.id = 'lum_node_index';
ipc.config.silent = true;

class Lum_node_index {
    constructor(argv){
        this.argv = argv;
        this.upgrader_started = false;
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
        const daemon_start_opt = {
            name: lpm_config.daemon_name,
            script: _this.argv.$0,
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
        });
    }
    stop_daemon(){
        const _this = this;
        return etask(function*start_daemon(){
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
        });
    }
    run_daemon(){
        let dopt = _.pick(this.argv.daemon_opt,
            ['start', 'stop', 'delete', 'restart', 'startup']);
        if (!Object.keys(dopt).length)
            return;
        if (dopt.start)
            this.start_daemon();
        else if (dopt.stop)
            this.stop_daemon();
        else if (dopt.delete)
            this.pm2_cmd('delete', lpm_config.daemon_name);
        else if (dopt.restart)
            this.pm2_cmd('restart', lpm_config.daemon_name);
        else if (dopt.startup)
        {
            let pm2_bin = path.resolve(__dirname, '../node_modules/.bin/pm2');
            try {
                child_process.execSync(pm2_bin+' startup');
                child_process.execSync(pm2_bin+' save');
            } catch(e){
                logger.warn('Failed to install startup script automatically, '
                    +`try run:\n${e.stdout.toString('utf-8')}\n${pm2_bin}`
                    +`save`);
            }
        }
        return true;
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
    show_logs(){
        const _this = this;
        return etask(function*start_daemon(){
        this.on('uncaught', e=>{
            logger.error('Show logs: Uncaught exception: '+zerr.e2s(e));
        });
        this.on('finally', ()=>pm2.disconnect());
        yield etask.nfn_apply(pm2, '.connect', []);
        const pm2_list = yield etask.nfn_apply(pm2, '.list', []);
        if (!_this.is_daemon_running(pm2_list))
            return logger.notice('There is no running LPM daemon process');
        const bus = yield etask.nfn_apply(pm2, '.launchBus', []);
        bus.on('log:out', data=>{
            if (data.process.name!=lpm_config.daemon_name)
                return;
            process.stdout.write(data.data);
        });
        yield this.wait();
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
        this.start_autoupgrade();
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
        case 'shutdown_master': return process.exit();
        case 'restart':
            this.child.removeListener('exit', this.shutdown_on_child_exit);
            this.child.on('exit', this.restart_on_child_exit.bind(this,
                msg.is_upgraded));
            this.child.kill();
            break;
        case 'upgrade':
            this.upgrade(e=>this.child.send({command: 'upgrade_finished',
                error: e}));
            break;
        case 'downgrade':
            this.downgrade(e=>this.child.send({command: 'downgrade_finished',
                error: e}));
            break;
        }
    }
    run_upgrader(cb){
        const opt = {name: 'Luminati Proxy Manager'};
        const cmd = `node ${path.resolve(__dirname, 'upgrader.js')}`;
        sudo_prompt.exec(cmd, opt, cb);
    }
    handle_upgrade_downgrade_error(e, stderr, is_downgrade){
        const script = is_downgrade ? 'downgrade' : 'upgrade';
        if (e)
        {
            if (e.signal=='SIGINT')
                return;
            const msg = e.message=='User did not grant permission.' ?
                e.message : zerr.e2s(e);
            logger.error(`Error during ${script}: ${msg}`);
            return true;
        }
        if (stderr)
            logger.error(`${script} stderr: ${stderr}`);
        check_compat();
    }
    upgrade(cb){
        this.run_upgrader((e, stdout, stderr)=>{
            if (cb)
                cb(e);
            this.handle_upgrade_downgrade_error(e, stderr);
        });
    }
    downgrade(cb){
        this.run_upgrader((e, stdout, stderr)=>{
            if (stdout=='BACKUP_NOT_EXISTS')
                e = 'Luminati proxy manager backup version does not exist!';
            if (cb)
                cb(e);
            if (stdout=='BACKUP_NOT_EXISTS')
                return logger.warn(e);
            if (!this.handle_upgrade_downgrade_error(e, stderr, 1))
                logger.notice('Downgrade completed successfully');
        });
    }
    upgrade_cli(){
        const _this = this;
        return etask(function*_upgrade(){
            yield zerr.perr('upgrade_start');
            const pm2_list = yield _this.pm2_cmd('list');
            const running_daemon = _this.is_daemon_running(pm2_list);
            _this.upgrade(e=>etask(function*_cb_upgrade(){
                _this.stop_ipc();
                if (e)
                {
                    if (e.message!='User did not grant permission.')
                        yield zerr.perr('upgrade_error', {error: e});
                    return;
                }
                logger.notice('Upgrade completed successfully');
                if (running_daemon)
                {
                    logger.notice('Restarting daemon...');
                    yield _this.pm2_cmd('restart', lpm_config.daemon_name);
                    logger.notice('Daemon restarted');
                }
                yield zerr.perr('upgrade_finish');
            }));
        });
    }
    start_autoupgrade(){
        if (!this.argv.autoUpgrade || this.upgrader_started)
            return;
        this.upgrader_started = true;
        this.upgrade(e=>{
            this.upgrader_started = false;
            if (this.child)
                this.child.send({command: 'upgrade_finished', error: e});
        });
    }
    start_ipc(){
        ipc.serve(()=>{
            ipc.server.on('upgrader_connected', (data, socket)=>{
                logger.notice('Upgrader connected');
                if (this.argv.upgrade)
                    return ipc.server.emit(socket, 'upgrade');
                else if (this.argv.downgrade)
                    return ipc.server.emit(socket, 'downgrade');
                ipc.server.emit(socket, 'start_auto_upgrade');
            });
            ipc.server.on('log', data=>{
                logger[data.level||'notice'](data.msg);
            });
        });
        ipc.server.start();
    }
    stop_ipc(){
        ipc.server.stop();
    }
    run(){
        if (this.run_daemon())
            return;
        else if (this.argv.status)
            return this.show_status();
        else if (this.argv.showLogs)
            return this.show_logs();
        else if (this.argv.genCert)
            return this.gen_cert();
        this.start_ipc();
        if (lpm_config.is_win)
        {
            const readline = require('readline');
            readline.createInterface({
                input: process.stdin,
                output: process.stdout,
            }).on('SIGINT', ()=>process.emit('SIGINT'));
        }
        // XXX krzysztof: duplication of handling siganls: why?
        ['SIGTERM', 'SIGINT', 'uncaughtException'].forEach(sig=>{
            process.on(sig, e=>{
                if (this.child)
                {
                    const error = zerr.e2s(e);
                    this.child.send({
                        command: 'shutdown',
                        reason: sig+(e ? ', master: error = '+error : ''),
                        error,
                    });
                }
                this.stop_ipc();
                setTimeout(()=>process.exit(), 5000);
            });
        });
        if (this.argv.upgrade)
            return this.upgrade_cli();
        else if (this.argv.downgrade)
            return this.downgrade(this.stop_ipc);
        return this.create_child();
    }
}
module.exports = Lum_node_index;
