// LICENSE_CODE ZON
'use strict'; /*jslint node:true, browser:true, mocha:true*/
(function(){
var define;
var is_node_ff = typeof module=='object' && module.exports;
if (!is_node_ff)
    define = self.define;
else
    define = require('./require_node.js').define(module, '../');
define(['sinon', 'events', '/util/date.js', '/util/etask.js',
    '/util/util.js'], function(sinon, events, date, etask, zutil){
var E = {};
var timer;
var is_auto_inc;
var clock_restore;
var clock_tick;
var clock;
var idle_time = 30;
var event_funcs = [
    {obj: global, funcs: ['setTimeout', 'setInterval', 'setImmediate']},
    {obj: global.process, funcs: ['nextTick']},
];
var orig = {
    setTimeout: setTimeout,
    setInterval: setInterval,
    setImmediate: setImmediate,
    clearTimeout: clearTimeout,
    nextTick: global.process&&global.process.nextTick,
};
var idle_listeners = new events();

// XXX: use lolex's clock.next() from newer lolex
function auto_inc(){
    var next = clock.firstTimerInRange(clock.now, Number.MAX_VALUE);
    if (next)
        clock_tick.call(clock, next.callAt-clock.now);
}

function idle_clear(){
    orig.clearTimeout(timer);
    timer = null;
}

function on_idle(){
    idle_clear();
    idle_listeners.emit('idle');
    if (is_auto_inc)
        auto_inc();
    timer_set();
}

function timer_set(){
    idle_clear();
    timer = orig.setTimeout(on_idle, idle_time);
}

E.uninit = function(){
    event_funcs.forEach(function(elem){
        if (!elem.obj)
            return;
        elem.funcs.forEach(function(func){
            if (!elem.obj[func]._orig)
                return;
            elem.obj[func] = elem.obj[func]._orig;
        });
    });
    idle_clear();
    idle_listeners = new events();
    if (clock)
        clock = void clock.restore();
};

E.tick = function(time, opt){
    opt = opt||{};
    if (is_auto_inc && !opt.force)
        throw Error('Cannot manually call clock.tick() in auto_inc mode');
    if (time instanceof Date)
        time = +time-clock.now;
    else if (time===undefined)
        time = 0;
    if (time<0)
        throw Error('can\'t tick backwards');
    return clock_tick.call(clock, time);
};
E.wait = function(){
    return etask('wait', [function(){
        var _this = this;
        var ready = function(){ _this.continue(); };
        this.finally(function(){
            idle_listeners.removeListener('idle', ready); });
        idle_listeners.on('idle', ready);
        return this.wait();
    }]);
};
E.clock_set = function(opt){
    E.uninit();
    opt = opt||{};
    opt.now = +date(opt.now||'2000-01-01');
    opt.date = opt.date||date;
    opt.to_fake = opt.to_fake||[];
    is_auto_inc = opt.auto_inc;
    clock = sinon.useFakeTimers.apply(null, [opt.now].concat(opt.to_fake));
    clock_restore = clock.restore;
    clock_tick = clock.tick;
    var _monotonic = opt.date.monotonic;
    opt.date.monotonic = function(){ return clock.now; };
    clock.restore = function(){
        opt.date.monotonic = _monotonic;
        clock.restore = clock_restore;
        clock.tick = clock_tick;
        clock_restore.apply(clock, arguments);
    };
    if (typeof opt.idle_time=='number')
        idle_time = opt.idle_time||idle_time;
    clock.tick = E.tick;
    clock._tick = clock_tick;
    if (is_auto_inc)
    {
        event_funcs.forEach(function(elem){
            if (!elem.obj)
                return;
            elem.funcs.forEach(function(func){
                var _orig = elem.obj[func];
                elem.obj[func] = function(){
                    timer_set();
                    return _orig.apply(this, arguments);
                };
                elem.obj[func]._orig = _orig;
            });
        });
    }
    timer_set();
    return clock;
};
E.clock_restore = function(){ return clock.restore(); };
E.create_sandbox = function(opt){
    var sandbox = sinon.sandbox.create(opt);
    var _restore = sandbox.restore;
    sandbox.restore = function(){
        E.uninit();
        _restore.call(sandbox);
    };
    sandbox.clock_set = E.clock_set;
    sandbox.stub_et = function(obj, meth, fn){
        return sandbox.stub(obj, meth, function(){
            var args = arguments;
            return etask([function(){ return fn.apply(null, args); }]);
        });
    };
    return sandbox;
};
E.is_fake_clock = function(){ return clock!==undefined; };
if (zutil.is_mocha())
    afterEach(function(){ return E.uninit(); });

return E; }); }());
