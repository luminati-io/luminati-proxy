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
const lpm_config = require('../util/lpm_config.js');
const Lum_common = require('./lum_common.js');
const pm2 = require('pm2');
const child_process = require('child_process');
const path = require('path');
const semver = require('semver');
const sudo_prompt = require('sudo-prompt');
const pkg = require('../package.json');
const is_pkg = typeof process.pkg!=='undefined';
const util_lib = require('../lib/util.js');
const os = require('os');
const download = require('download');

class Lum_node_index extends Lum_common {
    pm2_cmd(command, opt){ return etask(function*pm2_cmd(){
        this.on('uncaught', e=>{
            logger.error('PM2: Uncaught exception: '+zerr.e2s(e));
        });
        yield etask.nfn_apply(pm2, '.connect', []);
        if (!Array.isArray(opt))
            opt = [opt];
        const ret = yield etask.nfn_apply(pm2, '.'+command, opt);
        yield etask.nfn_apply(pm2, '.disconnect', []);
        return ret;
    }); }
    run_daemon(){
        let dopt = _.pick(this.argv.daemon_opt,
            ['start', 'stop', 'delete', 'restart', 'startup']);
        if (!Object.keys(dopt).length)
            return;
        const daemon_start_opt = {
            name: lpm_config.daemon_name,
            script: this.argv.$0,
            mergeLogs: false,
            output: '/dev/null',
            error: '/dev/null',
            autorestart: true,
            killTimeout: 5000,
            restartDelay: 5000,
            args: process.argv.filter(arg=>arg!='-d'&&!arg.includes('daemon')),
        };
        if (dopt.start)
            this.pm2_cmd('start', daemon_start_opt);
        else if (dopt.stop)
            this.pm2_cmd('stop', lpm_config.daemon_name);
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
    restart_on_child_exit(){
        if (!this.child)
            return;
        this.child.removeListener('exit', this.restart_on_child_exit);
        setTimeout(()=>this.create_child(), 5000);
    }
    shutdown_on_child_exit(){
        process.exit();
    }
    create_child(){
        process.env.LUM_MAIN_CHILD = true;
        this.child = child_process.fork(
            path.resolve(__dirname, 'lum_node.js'),
            [], {stdio: 'inherit', env: process.env});
        this.child.on('message', this.msg_handler.bind(this));
        this.child.on('exit', this.shutdown_on_child_exit);
        this.child.send({command: 'run', argv: this.argv});
    }
    msg_handler(msg){
        switch (msg.command)
        {
        case 'shutdown_master': return process.exit();
        case 'restart':
            this.child.removeListener('exit', this.shutdown_on_child_exit);
            this.child.on('exit', this.restart_on_child_exit.bind(this));
            this.child.kill();
            break;
        case 'upgrade':
            this.upgrade(e=>this.child.send({command: 'upgrade_finished',
                error: e}));
            break;
        }
    }
    upgrade(cb){
        if (is_pkg)
            return this.upgrade_pkg(cb);
        const log_file = path.join(lpm_config.work_dir,
            'luminati_upgrade.log');
        const npm_cmd = 'npm install --unsafe-perm -g '
            +'@luminati-io/luminati-proxy';
        const cmd = lpm_config.is_win ? npm_cmd :
            `bash -c "${npm_cmd} > ${log_file} 2>&1"`;
        const opt = {name: 'Luminati Proxy Manager'};
        logger.notice('Upgrading proxy manager');
        sudo_prompt.exec(cmd, opt, (e, stdout, stderr)=>{
            if (cb)
                cb(e);
            if (e)
            {
                logger.error('Error during upgrade: '+zerr.e2s(e));
                if (!lpm_config.is_win)
                    logger.error(`Look at ${log_file} for more details`);
                return;
            }
            if (stderr)
                logger.error('NPM stderr: '+stderr);
            check_compat();
        });
    }
    upgrade_pkg(cb){
    return etask(function*(){
        const r = yield util_lib.json({
            url: `${pkg.api_domain}/lpm_config.json`,
            qs: {md5: pkg.lpm.md5, ver: pkg.version},
        });
        const newer = r.body.ver && semver.lt(pkg.version, r.body.ver);
        if (!newer)
            return cb();
        logger.notice('Upgrading proxy manager');
        const install_path = path.resolve(os.homedir(),
            'luminati_proxy_manager');
        const download_url = `http://${pkg.api_domain}/static/lpm/`
            +`luminati-proxy-${r.body.ver}-beta.exe`;
        const upgrade_path = path.resolve(install_path, 'upgrade.exe');
        yield download(download_url, upgrade_path);
        child_process.spawn(upgrade_path, ['--upgrade_win', 1, '--kill_pid',
            process.pid], {detached: true});
        cb();
    }); }
    run(){
        if (this.run_daemon())
            return;
        this.init_log();
        if (lpm_config.is_win)
        {
            const readline = require('readline');
            readline.createInterface({input: process.stdin, output:
                process.stdout}).on('SIGINT', ()=>process.emit('SIGINT'));
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
                setTimeout(()=>process.exit(), 5000);
            });
        });
        if (!this.argv.upgrade)
            return this.create_child();
        const _this = this;
        const log = console.log.bind(console);
        return etask(function*_upgrade(){
            yield zerr.perr('upgrade_start');
            const pm2_list = yield _this.pm2_cmd('list');
            const daemon = pm2_list.find(p=>p.name==lpm_config.daemon_name);
            const running_daemon = !!daemon &&
                ['online', 'launching'].includes(daemon.pm2_env.status);
            _this.upgrade(e=>etask(function*_cb_upgrade(){
                if (e)
                {
                    if (e.message != 'User did not grant permission.')
                        yield zerr.perr('upgrade_error', {error: e});
                    return;
                }
                logger.notice('Upgrade completed successfully');
                if (running_daemon)
                {
                    logger.notice('Restarting daemon');
                    yield _this.pm2_cmd('restart', lpm_config.daemon_name);
                    logger.notice('Daemon restarted');
                }
                yield zerr.perr('upgrade_finish');
            }));
        });
    }
}
module.exports = Lum_node_index;
