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
const sudo_prompt = require('sudo-prompt');
const ipc = require('node-ipc');
const util_lib = require('../lib/util.js');

ipc.config.id = 'lum_node_index';
ipc.config.silent = true;

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
        case 'shutdown_master': return process.exit();
        case 'restart':
            this.child.removeListener('exit', this.shutdown_on_child_exit);
            this.child.on('exit', this.restart_on_child_exit.bind(this,
                msg.is_upgraded));
            this.child.kill();
            break;
        case 'upgrade': this.emit_message('upgrade'); break;
        case 'downgrade': this.emit_message('downgrade'); break;
        }
    }
    run_upgrader(){
        if (this.upgrader_started)
            return;
        this.upgrader_started = true;
        const opt = {name: 'Luminati Proxy Manager'};
        const cmd = `node ${path.resolve(__dirname, 'upgrader.js')}`;
        sudo_prompt.exec(cmd, opt, (e, stdout, stderr)=>{
            this.upgrader_started = false;
            if (e)
            {
                if (e.signal=='SIGINT')
                    return;
                const msg = e.message=='User did not grant permission.' ?
                    e.message : zerr.e2s(e);
                logger.error(`Upgrader error: ${msg}`);
            }
            if (stderr)
                logger.error(`Upgrader stderr: ${stderr}`);
        });
    }
    emit_message(msg, data){
        if (!ipc.server)
        {
            logger.error('IPC server is not running, starting...');
            return this.start_ipc();
        }
        if (!this.upgrader_socket)
        {
            this.run_upgrader();
            return this.ipc_cb = ()=>this.emit_message(msg, data);
        }
        ipc.server.emit(this.upgrader_socket, msg, data);
    }
    start_upgrade_cli(){
        zerr.perr('upgrade_start');
        this.emit_message('upgrade', {cli: true});
    }
    start_downgrade_cli(){
        zerr.perr('downgrade_start');
        this.emit_message('downgrade', {cli: true});
    }
    upgrade_downgrade_cli(e, is_downgrade){
        this.emit_message('stop');
        this.stop_ipc();
        const op = is_downgrade ? 'downgrade' : 'upgrade';
        const _this = this;
        return etask(function*_upgrade_downgrade_cli(){
            if (e)
                return yield zerr.perr(`${op}_error`, {error: e});
            const pm2_list = yield _this.pm2_cmd('list');
            if (_this.is_daemon_running(pm2_list))
            {
                logger.notice('Restarting daemon...');
                yield _this.pm2_cmd('restart', lpm_config.daemon_name);
                logger.notice('Daemon restarted');
            }
            yield zerr.perr(`${op}_finish`);
        });
    }
    start_ipc(){
        ipc.serve(()=>{
            ipc.server.on('upgrader_connected', (data, socket)=>{
                this.upgrader_socket = socket;
                if (!this.ipc_cb)
                    return;
                this.ipc_cb();
                delete this.ipc_cb;
            });
            ipc.server.on('upgrade_finished', ({error, cli})=>{
                if (cli)
                    this.upgrade_downgrade_cli(error);
                else if (this.child)
                    this.child.send({command: 'upgrade_finished', error});
            });
            ipc.server.on('downgrade_finished', ({error, cli})=>{
                if (cli)
                    this.upgrade_downgrade_cli(error, 1);
                else if (this.child)
                    this.child.send({command: 'downgrade_finished', error});
            });
            ipc.server.on('auto_upgrade_finished', ({error})=>{
                if (this.child)
                    this.child.send({command: 'upgrade_finished', error});
            });
            ipc.server.on('log', data=>{
                logger[data.level||'notice'](data.msg);
            });
            ipc.server.on('socket.disconnected', ()=>{
                delete this.upgrader_socket;
            });
        });
        ipc.server.start();
    }
    stop_ipc(){
        logger.debug('stopping IPC');
        if (ipc.server)
            ipc.server.stop();
    }
    init_traps(){
        ['SIGTERM', 'SIGINT', 'uncaughtException'].forEach(sig=>{
            process.on(sig, e=>{
                setTimeout(()=>process.exit(), 5000);
            });
        });
        process.on('exit', ()=>{
            this.emit_message('stop');
            this.stop_ipc();
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
        if (this.argv.status)
            return this.show_status();
        if (this.argv.genCert)
            return this.gen_cert();
        this.init_traps();
        if (this.argv.upgrade)
        {
            this.ipc_cb = ()=>this.start_upgrade_cli();
            this.run_upgrader();
            return this.start_ipc();
        }
        else if (this.argv.downgrade)
        {
            this.ipc_cb = ()=>this.start_downgrade_cli(1);
            this.run_upgrader();
            return this.start_ipc();
        }
        else if (this.argv.autoUpgrade)
        {
            this.ipc_cb = ()=>this.emit_message('start_auto_upgrade');
            this.run_upgrader();
        }
        this.start_ipc();
        this.create_child();
    }
}
module.exports = Lum_node_index;
