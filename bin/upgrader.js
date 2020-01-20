#!/usr/bin/env node
// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/
const sudo_prompt = require('sudo-prompt');
const yargs = require('yargs');
const child_process = require('child_process');
const logger = require('../lib/logger.js').child({category: 'Upgrader'});
const path = require('path');
const etask = require('../util/etask.js');
const lpm_config = require('../util/lpm_config.js');
const util_lib = require('../lib/util.js');
const zerr = require('../util/zerr.js');
const JOB_NAME = 'lpm upgrader';
const E = module.exports = {};
let crontab;

E.start_upgrader = ()=>{
    sudo_run(upgrader_cmd('--add-cron-job'), null, {log: true});
};

E.stop_upgrader = ()=>{
    sudo_run(upgrader_cmd('--remove-cron-job'), null, {log: true});
};

const upgrader_cmd = flag=>{
    const script = path.resolve(__dirname, 'upgrader.js');
    const node_path = process.argv[0];
    return `${node_path} ${script} ${flag}`;
};

E.upgrade = cb=>etask(function*(){
    zerr.perr('upgrade_start');
    logger.notice('Started upgrading...');
    const v = yield util_lib.get_last_version(
        lpm_config.manager_default.api);
    if (!v.newer)
        return logger.notice('Already the newest version');
    sudo_run(bash_cmd('lpm_upgrade.sh'), e=>{
        if (e)
        {
            logger.error('Could not upgrade: %s', e.message);
            zerr.perr('upgrade_error');
        }
        else
        {
            logger.notice('Finished upgrading!');
            zerr.perr('upgrade_finish');
        }
        if (cb)
            cb(e);
    });
});

E.downgrade = cb=>{
    zerr.perr('downgrade_start');
    logger.notice('Downgrading...');
    sudo_run(bash_cmd('lpm_downgrade.sh'), e=>{
        if (e && e.code==1)
            e = 'Luminati proxy manager backup version does not exist!';
        if (e)
        {
            logger.warn(e);
            zerr.perr('downgrade_error');
        }
        if (!e)
        {
            logger.notice('Finished downgrading!');
            zerr.perr('downgrade_finish');
        }
        if (cb)
            cb(e);
    });
};

const bash_cmd = script=>'bash '+path.resolve(__dirname, script)+' /tmp/lpm_l';

const sudo_run = (cmd, cb, opt={})=>{
    const exec = process.getuid()===0 ?
        child_process.exec.bind(child_process) :
        sudo_prompt.exec.bind(sudo_prompt);
    exec(cmd, {name: 'Upgrader LPM'}, (e, stdout, stderr)=>{
        if (cb)
            cb(e, stdout, stderr);
        if (e)
            return logger.error(e.message);
        if (stderr)
            logger.error(stderr);
        if (opt.log && stdout)
            logger.notice(stdout);
    });
};

const add_cron_job = ()=>etask(function*(){
    const _this = this;
    const jobs = crontab.find({comment: JOB_NAME});
    if (jobs.length)
        return console.log('Auto-upgrader is already installed and running');
    const node_path = process.argv[0];
    const script = path.resolve(__dirname, 'index.js');
    const set_path = `PATH=${process.env.PATH}`;
    const stream = '>> /tmp/up_log.txt 2>&1';
    const flag = '--upgrade';
    const cron_cmd = `${set_path} ${node_path} ${script} ${flag} ${stream}`;
    crontab.create(cron_cmd, '*/15 * * * *', JOB_NAME);
    crontab.save(function(err){
        if (err)
            console.error('Could not save crontab: %s', err);
        else
        {
            console.log('Auto-upgrader has been successfully installed');
            console.log('To run LPM run \'luminati\' or \'luminati -d\' to'
                +' keep it in the daemon mode');
        }
        _this.continue();
    });
    yield _this.wait();
});

const remove_cron_job = ()=>etask(function*(){
    const _this = this;
    const jobs = crontab.find({comment: JOB_NAME});
    if (!jobs.length)
        return console.log('Auto-upgrader is not running. Nothing to stop');
    crontab.remove(jobs[0]);
    crontab.save(function(err){
        if (err)
            console.error('Could not delete job: %s', err);
        else
            console.log('Auto-upgrader has been successfully stopped');
        _this.continue();
    });
    yield _this.wait();
});

const load_cron = ()=>etask(function*(){
    const _this = this;
    require('lum_crontab').load(function(err, _crontab){
        if (err)
        {
            console.error('Could not load crontab: %s', err);
            return process.exit();
        }
        _this.continue(_crontab);
    });
    return yield _this.wait();
});

const main = ()=>etask(function*(){
    const args = process.argv.slice(2).map(String);
    const argv = yargs(args).argv;
    if (!argv.addCronJob && !argv.removeCronJob)
        return;
    if (process.getuid()!==0)
        return console.error('You need to run the process with sudo');
    crontab = yield load_cron();
    if (argv.addCronJob)
        return yield add_cron_job();
    if (argv.removeCronJob)
        return yield remove_cron_job();
});

main();
