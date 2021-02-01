#!/usr/bin/env node
// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/
const etask = require('../util/etask.js');
const zerr = require('../util/zerr.js');
const {url2domain} = require('./util.js');
const logger = require('./logger.js').child({category: 'Throttle'});

const Throttle_mgr = etask._class(class Throttle_mgr {
    constructor(limit){
        this.limit = limit;
        this.active = new Map();
        this.throttled = new Map();
    }
    static init(server, limit){
        if (server.throttle_mgr && server.throttle_mgr.limit==limit)
            return server.throttle_mgr;
        const deactivated_throttle = server.throttle_mgr && !limit;
        if (deactivated_throttle)
        {
            logger.debug('Deactivated throttling requests');
            server.throttle_mgr.release_throttled_tasks();
            return null;
        }
        if (limit)
        {
            if (server.throttle_mgr)
                return server.throttle_mgr._set_new_limit(limit);
            logger.debug('Activated throttling requests: %d', limit);
            return new Throttle_mgr(limit);
        }
    }
    *throttle(_this, et, url){
        this.on('uncaught', e=>logger.error('throttle: %s', zerr.e2s(e)));
        const domain = url2domain(url);
        const new_active = _this._increase_active(domain);
        if (new_active<=_this.limit)
            return;
        _this._throttle_task(et, domain);
        return yield et.wait();
    }
    release(url, et_info){
        if (et_info.canceled)
            return;
        const domain = url2domain(url);
        this._decrease_active(domain);
        let task;
        if (!(task = this._get_next_task(domain)))
            return;
        if (!task.info.req.aborted && task.info.req.socket)
            task.continue();
    }
    release_throttled_tasks({abort_requests}={}){
        const all_tasks = [...this.throttled.values()].flat();
        this.throttled.clear();
        this.active.clear();
        const release_type = abort_requests ? 'Aborting' : 'Releasing';
        logger.debug('%s %d throttled tasks', release_type, all_tasks.length);
        all_tasks.forEach(et=>{
            if (et.info.req.aborted || !et.info.req.socket)
                return;
            if (!abort_requests)
                return process.nextTick(et.continue_fn());
            et.info.canceled = true;
            et.throw(new Error('Throttled config changed, request aborted'));
        });
    }
    _throttle_task(et, domain){
        const tasks = this.throttled.get(domain)||[];
        this.throttled.set(domain, tasks.push(et) && tasks);
        return tasks;
    }
    _get_next_task(domain){
        let tasks;
        if (!(tasks = this.throttled.get(domain)))
            return;
        const et = tasks.shift();
        if (!tasks.length)
            this.throttled.delete(domain);
        return et;
    }
    _increase_active(domain){
        let active = this.active.get(domain)||0;
        this.active.set(domain, ++active);
        return active;
    }
    _decrease_active(domain){
        let active;
        if (!(active = this.active.get(domain)))
            return;
        if (!--active)
            this.active.delete(domain);
        else
            this.active.set(domain, active);
        return active;
    }
    _set_new_limit(limit){
        logger.debug('Setting new limit %d -> %d', this.limit, limit);
        this.release_throttled_tasks({abort_requests: true});
        this.limit = limit;
        return this;
    }
});

module.exports = Throttle_mgr;
