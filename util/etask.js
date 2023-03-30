// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, browser:true, es6: true*/
(function(){
var define, process, zerr, assert;
var is_node = typeof module=='object' && module.exports && module.children &&
    typeof __webpack_require__!='function';
var is_rn = typeof global=='object' && !!global.nativeRequire ||
    typeof navigator=='object' && navigator.product=='ReactNative';
if (!is_node)
{
    if (is_rn)
    {
        define = require('./require_node.js').define(module, '../',
            require('/util/events.js'), require('/util/array.js'),
            require('/util/util.js'));
    }
    else
        define = self.define;
    process = {
        nextTick: function(fn){ setTimeout(fn, 0); },
        env: {},
    };
    // XXX romank: use zerr.js
    // XXX bahaa: require bext/pub/zerr.js for extensions
    if (!is_rn && self.hola && self.hola.zerr)
        zerr = self.hola.zerr;
    else
    {
        zerr = function(){ console.log.apply(console, arguments); };
        zerr.perr = zerr;
        zerr.debug = function(){};
        zerr.is = function(){ return false; };
        zerr.L = {DEBUG: 0};
    }
    if (!zerr.is)
        zerr.is = function(){ return false; };
}
else
{
    require('./config.js');
    process = global.process||require('_process');
    zerr = require('./zerr.js');
    assert = require('assert');
    define = require('./require_node.js').define(module, '../');
}
// XXX odin: normally this would only be run for !is_node, but 'who' unittests
// loads a stubbed assert
if (typeof assert!='function')
    assert = function(){}; // XXX romank: add proper assert
// XXX yuval: /util/events.js -> events when node 6 (support prependListener)
// is here
define(['/util/events.js', '/util/array.js', '/util/util.js'],
    function(events, array, zutil){
const E = Etask;
const GEN_FN = 'GeneratorFunction';
const env = process.env, assign = Object.assign;
E.use_bt = +env.ETASK_BT;
E.root = new Set();
E.assert_extra = +env.ETASK_ASSERT_EXTRA; // to debug internal etask bugs
E.nextTick = process.nextTick;
// XXX arik/romank: hack, rm set_zerr, get zerzerrusing require
E.set_zerr = function(_zerr){ zerr = _zerr; };
E.events = new events();
var cb_pre, cb_post, cb_ctx, longcb_ms, perf_enable;
E.perf_stat = {};
// XXX romang: hack to import in react native
if (is_rn)
    E.etask = E;
function _cb_pre(et){ return {start: Date.now()}; }
function _cb_post(et, ctx){
    ctx = ctx||cb_ctx;
    var ms = Date.now()-ctx.start;
    if (longcb_ms && ms>longcb_ms)
    {
        zerr('long cb '+ms+'ms: '+et.get_name()+', '
            +et.funcs[et.cur_state].toString().slice(0, 128));
    }
    if (perf_enable)
    {
        var name = et.get_name();
        var perf = E.perf_stat[name] ||
            (E.perf_stat[name] = {ms: 0, n: 0, max: 0});
        if (perf.max<ms)
            perf.max = ms;
        perf.ms += ms;
        perf.n++;
    }
}
function cb_set(){
    if (longcb_ms || perf_enable)
    {
        cb_pre = _cb_pre;
        cb_post = _cb_post;
        cb_ctx = {start: Date.now()};
    }
    else
        cb_pre = cb_post = cb_ctx = undefined;
}
E.longcb = function(ms){
    longcb_ms = ms;
    cb_set();
};
E.perf = function(enable){
    if (arguments.length)
    {
        perf_enable = enable;
        cb_set();
    }
    return perf_enable;
};
E.longcb(+env.LONGCB);
E.perf(+env.ETASK_PERF);

function stack_get(){
    // new Error(): 200K per second
    // http://jsperf.com/error-generation
    // Function.caller (same as arguments.callee.caller): 2M per second
    // http://jsperf.com/does-function-caller-affect-preformance
    // http://jsperf.com/the-arguments-object-s-effect-on-speed/2
    var prev = Error.stackTraceLimit, err;
    Error.stackTraceLimit = 4;
    err = new Error();
    Error.stackTraceLimit = prev;
    return err;
}

function Etask(opt, states){
    if (!(this instanceof Etask))
    {
        if (Array.isArray(opt) || typeof opt=='function')
        {
            states = opt;
            opt = undefined;
        }
        opt = typeof opt=='string' && {name: opt} || opt || {};
        if (typeof states=='function' && states.constructor.name==GEN_FN)
            return E._generator(null, states, opt);
        return new Etask(opt, typeof states=='function' ? [states] : states);
    }
    assert(Array.isArray(states), 'states must be an array');
    // init fields
    this.name = opt.name;
    this.cancelable = opt.cancel;
    this.then_waiting = new Set();
    this.child = new Set();
    this.child_guess = new Set();
    this.cur_state = -1;
    this.next_state = -1;
    this.states_idx = {};
    this.tm_create = Date.now();
    this.use_retval = false;
    this.at_return = false;
    this.free = false;
    this._stack = Etask.use_bt ? stack_get() : undefined;
    this._finally = -1;
    this._cancel = -1;
    if (opt.zexit_on_err!=null)
        this.info.zexit_on_err = opt.zexit_on_err;
    if (opt.skip_err_metrics!=null)
        this.info.skip_err_metrics = opt.skip_err_metrics;
    // performance: set all rest fields to undefined
    this.error = this.running = this.at_continue = this.wait_timer =
    this.retval = this.down = this.up = this.parent = this._alarm =
    this.tm_completed = this.parent_type = this.parent_guess =
    this.wait_retval = this.generator = this.generator_ctor = undefined;
    const funcs = [];
    const types = [];
    for (let i=0; i<states.length; i++)
    {
        const func = states[i];
        assert(typeof func=='function', 'invalid state type');
        const type = this._get_state_type(func.name, undefined);
        if (type.label)
            this.states_idx[type.label] = i;
        if (type.finally)
        {
            assert(this._finally==-1, 'more than 1 finally$');
            this._finally = i;
        }
        if (type.cancel)
        {
            assert(this._cancel==-1, 'more than 1 cancel$');
            this._cancel = i;
        }
        funcs[i] = i==0 && opt.state0_args
            ? func.bind.apply(func, [this].concat(opt.state0_args))
            : func;
        types[i] = type;
    }
    // keep PACKED_ELEMENTS array type with capacity equal to length
    this.funcs = Array.from(funcs);
    this.states = Array.from(types);
    E.root.add(this);
    let in_run;
    if (opt.spawn_parent)
        this.spawn_parent(opt.spawn_parent);
    else if (opt.up)
        opt.up._set_down(this);
    else if (in_run = E.in_run_top())
        this._spawn_parent_guess(in_run);
    if (opt.init)
        opt.init.call(this);
    if (opt.async)
    {
        const wait_retval = this._set_wait_retval();
        E.nextTick(()=>{
            if (this.running===undefined)
                this._got_retval(wait_retval);
        });
    }
    else if (this._next())
        this._run();
    return this;
}
zutil.inherits(Etask, events.EventEmitter);

Object.defineProperty(E.prototype, 'info', {
    get: function(){
        if (!this._info)
            this._info = {};
        return this._info;
    },
    set: function(v){
        this._info = v;
    },
});

E.prototype._root_remove = function(){
    assert(!this.parent, 'cannot remove from root when has parent');
    if (!E.root.delete(this))
        assert(0, 'etask not in root\n'+E.ps({MARK: this}));
};

E.prototype._parent_remove = function(){
    if (this.up)
    {
        var up = this.up;
        this.up = this.up.down = undefined;
        if (up.tm_completed)
            up._check_free();
        return;
    }
    if (this.parent_guess)
        this._parent_guess_remove();
    if (!this.parent)
        return this._root_remove();
    if (!this.parent.child.delete(this))
    {
        assert(0, 'etask child not in parent\n'
            +E.ps({MARK: [['child', this], ['parent', this.parent]]}));
    }
    if (this.parent.tm_completed)
        this.parent._check_free();
    this.parent = undefined;
};

E.prototype._check_free = function(){
    if (this.down || this.child.size)
        return;
    this._parent_remove();
    this.free = true;
};

E.prototype._call_err = function(e){
    E.ef(e, this);
    // XXX derry: add assert(0, 'etask err in signal: '+e);
};
E.prototype.emit_safe = function(){
    try { this.emit.apply(this, arguments); }
    catch(e){ this._call_err(e); }
};
E.prototype._call_safe = function(state_fn){
    try { return state_fn.call(this); }
    catch(e){ this._call_err(e); }
};
E.prototype._complete = function(){
    if (zerr.is(zerr.L.DEBUG))
        zerr.debug(this.shortname()+': close');
    this.tm_completed = Date.now();
    this.parent_type = this.up ? 'call' : 'spawn';
    if (this.error)
        this.emit_safe('uncaught', this.error);
    if (this._finally!==-1)
    {
        var ret = this._call_safe(this.funcs[this._finally]);
        if (E.is_err(ret))
            this._set_retval(ret);
    }
    this.emit_safe('finally');
    this.emit_safe('ensure');
    if (this.error && !this.up && !this.parent && !this.parent_guess)
        E.events.emit('uncaught', this);
    if (this.parent)
        this.parent.emit('child', this);
    if (this.up && (this.down || this.child.size))
    {
        var up = this.up;
        this.up = this.up.down = undefined;
        this.parent = up;
        up.child.add(this);
    }
    this._check_free();
    this._del_wait_timer();
    this.del_alarm();
    this._ecancel_child();
    this.emit_safe('finally1');
    for (let v of this.then_waiting.values())
    {
        this.then_waiting.delete(v);
        v();
    }
};
E.prototype._next = function(rv){
    if (this.tm_completed)
        return false;
    const states = this.states;
    let state = this.at_return ? states.length :
        this.next_state!=-1 ? this.next_state : this.cur_state+1;
    this.retval = rv&&rv.ret;
    this.error = rv&&rv.err;
    if (this.error!==undefined)
    {
        if (zerr.on_exception)
            zerr.on_exception(this.error, this);
        if (this.cur_state>-1 && this.states[this.cur_state].try_catch)
        {
            this.use_retval = true;
            for (; state<states.length && states[state].sig; state++);
        }
        else
            for (; state<states.length && !states[state].catch; state++);
    }
    else
        for (; state<states.length && states[state].aux; state++);
    this.cur_state = state;
    this.next_state = -1;
    if (this.cur_state<states.length)
        return true;
    this._complete();
    return false;
};
E.prototype._handle_rv = function(rv){
    var wait_retval, _this = this, ret = rv.ret;
    if (ret===this.retval); // fast-path: retval already set
    else if (!ret);
    else if (ret instanceof Etask)
    {
        if (!ret.tm_completed)
        {
            this._set_down(ret);
            wait_retval = this._set_wait_retval();
            ret.then_waiting.add(function(){
                _this._got_retval(wait_retval, E.err_res(ret.error,
                    ret.retval));
            });
            return true;
        }
        rv.err = ret.error;
        rv.ret = ret.retval;
    }
    else if (ret instanceof Etask_err)
    {
        rv.err = ret.error;
        rv.ret = undefined;
    }
    else if (typeof ret.then=='function') // promise
    {
        wait_retval = this._set_wait_retval();
        ret.then(function(_ret){ _this._got_retval(wait_retval, _ret); },
            function(err){ _this._got_retval(wait_retval, E.err(err)); });
        return true;
    }
    // generator
    else if (typeof ret.next=='function' && typeof ret.throw=='function')
    {
        rv.ret = E._generator(ret, this.funcs[this.cur_state], {});
        return this._handle_rv(rv);
    }
    return false;
};
E.prototype._set_retval = function(ret){
    if (ret===this.retval && !this.error); // fast-path retval already set
    else if (!ret)
    {
        this.retval = ret;
        this.error = undefined;
    }
    else if (ret instanceof Etask)
    {
        if (ret.tm_completed)
        {
            this.retval = ret.retval;
            this.error = ret.error;
        }
    }
    else if (ret instanceof Etask_err)
    {
        this.retval = undefined;
        this.error = ret.error;
    }
    else if (typeof ret.then=='function'); // promise
    // generator
    else if (typeof ret.next=='function' && typeof ret.throw=='function');
    else
    {
        this.retval = ret;
        this.error = undefined;
    }
    return ret;
};

E.prototype._set_wait_retval = function(){
    return this.wait_retval = new Etask_wait(this, 'wait_int'); };
E.in_run = [];
E.in_run_top = function(){ return E.in_run[E.in_run.length-1]; };
E.prototype._run = function(){
    var rv = {ret: undefined, err: undefined};
    while (1)
    {
        var _cb_ctx;
        var arg = this.error && !this.use_retval ? this.error : this.retval;
        this.use_retval = false;
        this.running = true;
        rv.ret = rv.err = undefined;
        E.in_run.push(this);
        if (zerr.is(zerr.L.DEBUG))
            zerr.debug(this.shortname()+':S'+this.cur_state+': running');
        if (cb_pre)
            _cb_ctx = cb_pre(this);
        try { rv.ret = this.funcs[this.cur_state].call(this, arg); }
        catch(e){
            rv.err = e;
            if (rv.err instanceof Error)
                rv.err.etask = this;
        }
        if (cb_post)
            cb_post(this, _cb_ctx);
        this.running = false;
        E.in_run.pop();
        for (let vv of this.child_guess.values())
        {
            this.child_guess.delete(vv);
            vv.parent_guess = undefined;
        }
        if (rv.ret instanceof Etask_wait)
        {
            var wait_completed = false, wait = rv.ret;
            if (!this.at_continue && !wait.ready)
            {
                this.wait_retval = wait;
                if (wait.op=='wait_child')
                     wait_completed = this._set_wait_child(wait);
                if (wait.timeout)
                    this._set_wait_timer(wait.timeout);
                if (!wait_completed)
                    return;
                this.wait_retval = undefined;
            }
            rv.ret = this.at_continue ? this.at_continue.ret :
                wait.ready && !wait.completed ? wait.ready.ret : undefined;
            wait.completed = true;
        }
        this.at_continue = undefined;
        if (this._handle_rv(rv))
            return;
        if (!this._next(rv))
            return;
    }
};

E.prototype._set_down = function(down){
    if (this.down)
        assert(0, 'caller already has a down\n'+this.ps());
    if (down.parent_guess)
        down._parent_guess_remove();
    assert(!down.parent, 'returned etask already has a spawn parent');
    assert(!down.up, 'returned etask already has a caller parent, '
        + 'consider using wait_ext');
    down._parent_remove();
    this.down = down;
    down.up = this;
};

const state_type_cache = {};
E.prototype._get_state_type = function(name, on_fail){
    let type = state_type_cache[name];
    if (type)
        return type;
    type = state_type_cache[name] = new Etask_state_type();
    if (!name)
        return type;
    type.name = name;
    const n = name.split('$');
    if (n.length==1)
    {
        type.label = n[0];
        return type;
    }
    if (n.length>2)
        return type;
    if (n[1].length)
        type.label = n[1];
    const f = n[0].split('_');
    for (let j=0; j<f.length; j++)
    {
        if (f[j]=='try')
        {
            type.try_catch = true;
            if (j+1<f.length && f[j+1]=='catch')
                j++;
        }
        else if (f[j]=='catch')
            type['catch'] = true;
        else if (f[j]=='finally' || f[j]=='ensure')
            type.finally = true;
        else if (f[j]=='cancel')
            type.cancel = true;
        else
        {
            return void (on_fail||assert.bind(null, false))(
                'unknown func name '+name);
        }
    }
    if ((+(type.catch||type.try_catch))+(+type.finally)+(+type.cancel)>1)
    {
        return void (on_fail||assert.bind(null, false))(
            'invalid multiple state types');
    }
    type.sig = type.finally||type.cancel;
    type.aux = type.sig||type.catch;
    return type;
};
class Etask_state_type {
    constructor(){
        this.name = undefined;
        this.label = undefined;
        this.try_catch = false;
        this.catch = false;
        this.finally = false;
        this.cancel = false;
        this.sig = false;
        this.aux = false;
    }
}

E.prototype.spawn = function(child, replace){
    if (!(child instanceof Etask) && child && typeof child.then=='function')
    {
        var promise = child;
        child = new Etask({}, [function(){ return promise; }]);
    }
    if (!(child instanceof Etask)) // promise already completed?
    {
        this.emit('child', child);
        return child;
    }
    if (!replace && child.parent)
        assert(0, 'child already has a parent\n'+child.parent.ps());
    child.spawn_parent(this);
    return child;
};

E.prototype._spawn_parent_guess = function(parent){
    this.parent_guess = parent;
    parent.child_guess.add(this);
};
E.prototype._parent_guess_remove = function(){
    if (!this.parent_guess.child_guess.delete(this))
    {
        assert(0, 'etask not in parent_guess\n'+this.ps({MARK: this})+'\n'
            +E.ps({MARK: this}));
    }
    this.parent_guess = undefined;
};
E.prototype.spawn_parent = function(parent){
    if (this.up)
        assert(0, 'child already has an up\n'+this.up.ps());
    if (this.tm_completed && !this.parent)
        return;
    this._parent_remove();
    if (parent && parent.free)
        parent = undefined;
    if (!parent)
        return void E.root.add(this);
    parent.child.add(this);
    this.parent = parent;
};

E.prototype.set_state = function(name){
    var state = this.states_idx[name];
    if (state===undefined)
        assert(0, 'named func "'+name+'" not found');
    return this.next_state = state;
};

E.prototype.finally = function(cb){
    if (this.tm_completed)
        process.nextTick(cb);
    else
        this.prependListener('finally', cb);
};
E.prototype.goto_fn = function(name){
    return this.goto.bind(this, name); };
E.prototype.goto = function(name, promise){
    this.set_state(name);
    assert(!this.states[this.next_state].sig, 'goto to sig');
    return this.continue(promise);
};

E.prototype.loop = function(promise){
    this.next_state = this.cur_state;
    return promise;
};

E.prototype._set_wait_timer = function(timeout){
    var _this = this;
    this.wait_timer = setTimeout(function(){
        _this.wait_timer = undefined;
        if (_this._next({ret: undefined, err: 'timeout'}))
            _this._run();
    }, timeout);
};
E.prototype._del_wait_timer = function(){
    if (this.wait_timer)
        this.wait_timer = clearTimeout(this.wait_timer);
    this.wait_retval = undefined;
};

E.prototype._get_child_running = function(){
    for (let v of this.child.values())
    {
        if (!v.tm_completed)
            return v;
    }
};
E.prototype._set_wait_child = function(wait_retval){
    let {child, cond, rethrow} = wait_retval;
    if (cond && child!='any')
    {
        assert(0, 'condition supported only for "any" option, you can add '
            +'support if needed');
    }
    if (child=='any')
    {
        if (!this._get_child_running())
            return true;
        let wait_on = ()=>{
            this.once('child', _child=>{
                if (rethrow && E.is_err(_child))
                    return this._got_retval(wait_retval, _child);
                if (!cond || cond.call(_child, _child.retval))
                    return this._got_retval(wait_retval, {child: _child});
                if (!this._get_child_running())
                    return this._got_retval(wait_retval);
                wait_on();
            });
        };
        wait_on();
    }
    else if (child=='all')
    {
        if (!this._get_child_running())
            return true;
        let wait_on = ()=>{
            this.once('child', _child=>{
                if (rethrow && E.is_err(_child))
                    return this._got_retval(wait_retval, _child);
                if (!this._get_child_running())
                    return this._got_retval(wait_retval);
                wait_on();
            });
        };
        wait_on();
    }
    else
    {
        assert(child, 'no child provided');
        assert(this===child.parent, 'child does not belong to parent');
        if (child.tm_completed)
            return true;
        child.once('finally', ()=>this._got_retval(wait_retval, {child}));
    }
    this.emit_safe('wait_on_child');
    return false;
};

E.prototype._got_retval = function(wait_retval, res){
    if (this.wait_retval!==wait_retval || wait_retval.completed)
        return;
    wait_retval.completed = true;
    if (this._next(E._res2rv(res)))
        this._run();
};
E.prototype.continue_fn = function(){
    return this.continue.bind(this); };
E.continue_depth = 0;
E.prototype.continue = function(promise, sync){
    this.wait_retval = undefined;
    this._set_retval(promise);
    if (this.tm_completed)
        return promise;
    if (this.down)
        this.down._ecancel();
    this._del_wait_timer();
    var rv = {ret: promise, err: undefined};
    if (this.running)
    {
        this.at_continue = rv;
        return promise;
    }
    if (this._handle_rv(rv))
        return rv.ret;
    var _this = this;
    if (E.is_final(promise) &&
        (!E.continue_depth && !E.in_run.length || sync))
    {
        E.continue_depth++;
        if (this._next(rv))
            this._run();
        E.continue_depth--;
    }
    else // avoid high stack depth
    {
        E.nextTick(function(){
            if (_this._next(rv))
                _this._run();
        });
    }
    return promise;
};

E.prototype._ecancel = function(){
    if (this.tm_completed)
        return this;
    this.emit_safe('cancel');
    if (this._cancel!=-1)
        return this._call_safe(this.funcs[this._cancel]);
    if (this.cancelable)
        return this.return();
};

E.prototype._ecancel_child = function(){
    if (!this.child.size)
        return;
    // copy array, since ecancel has side affects and can modify array
    let children = Array.from(this.child.values());
    for (let child of children)
        child._ecancel();
};

E.prototype.return_fn = function(){
    return this.return.bind(this); };
E.prototype.return = function(promise){
    if (this.tm_completed)
        return this._set_retval(promise);
    this.at_return = true;
    this.next_state = -1;
    return this.continue(promise, true);
};

E.prototype.del_alarm = function(){
    var a = this._alarm;
    if (!a)
        return;
    clearTimeout(a.id);
    if (a.cb)
        this.removeListener('sig_alarm', a.cb);
    this._alarm = undefined;
};

E.prototype.upd_alarm = function(ms){
    var a = this._alarm;
    if (!a)
        return;
    var cb = a.cb;
    this.alarm(ms, cb);
};

E.prototype.inc_alarm = function(ms){
    var a = this._alarm;
    if (!a)
        return;
    var cb = a.cb;
    var left = this.alarm_left();
    this.alarm(ms+left, cb);
};

E.prototype.alarm_left = function(){
    var a = this._alarm;
    if (!a)
        return 0;
    return a.start+a.ms-Date.now();
};

E.prototype.alarm_elapsed = function(){
    var a = this._alarm;
    if (!a)
        return 0;
    return Date.now()-a.start;
};

E.prototype._operation_opt = function(opt){
    if (opt.goto)
        return {ret: this.goto(opt.goto, opt.ret)};
    if (opt.throw)
        return {ret: this.throw(opt.throw)};
    if (opt.return!==undefined)
        return {ret: this.return(opt.return)};
    if (opt.continue!==undefined)
        return {ret: this.continue(opt.continue)};
};

E.prototype.alarm = function(ms, cb){
    var _this = this, opt, a;
    if (cb && typeof cb!='function')
    {
        opt = cb;
        cb = function(){
            var v;
            if (!(v = _this._operation_opt(opt)))
                assert(0, 'invalid alarm cb opt');
            return v.ret;
        };
    }
    this.del_alarm();
    a = this._alarm = {ms: ms, cb: cb, start: Date.now()};
    a.id = setTimeout(function(){
        _this._alarm = undefined;
        _this.emit('sig_alarm');
    }, a.ms);
    if (cb)
        this.once('sig_alarm', cb);
};

class Etask_wait {
    constructor(et, op, timeout, child, cond, rethrow){
        this.timeout = timeout;
        this.et = et;
        this.op = op;
        this.child = child;
        this.cond = cond;
        // XXX: rethrow==true should probably be the default behavir
        this.rethrow = rethrow;
        this.ready = undefined;
        this.completed = false;
    }
    continue(res){
        if (this.completed)
            return;
        if (!this.et.wait_retval)
            return void(this.ready = {ret: res});
        if (this!==this.et.wait_retval)
            return;
        this.et.continue(res);
    }
    continue_fn(){ return this.continue.bind(this); }
    throw(err){ return this.continue(E.err(err)); }
    throw_fn(){ return this.throw.bind(this); }
}
E.prototype.wait = function(timeout){
    return new Etask_wait(this, 'wait', timeout); };
E.prototype.wait_child = function(child, timeout, cond, opt){
    if (typeof timeout=='function')
    {
        cond = timeout;
        opt = cond;
        timeout = 0;
    }
    else if (typeof timeout=='object')
    {
        cond = undefined;
        opt = timeout;
        timeout = 0;
    }
    return new Etask_wait(this, 'wait_child', timeout, child, cond,
        opt&&opt.rethrow);
};

E.prototype.throw_fn = function(err){
    return err ? this.throw.bind(this, err) : this.throw.bind(this); };
E.prototype.throw = function(err){
    return this.continue(E.err(err)); };

E.prototype.get_name = function(flags){
    /* anon: Context.<anonymous> (/home/yoni/zon1/pkg/util/test.js:1740:7)
     * with name: Etask.etask1_1 (/home/yoni/zon1/pkg/util/test.js:1741:11) */
    var stack = this._stack instanceof Error ? this._stack.stack.split('\n') :
        undefined;
    var caller;
    flags = flags||{};
    if (stack)
    {
        caller = /^ {4}at (.*)$/.exec(stack[4]);
        caller = caller ? caller[1] : undefined;
    }
    var names = [];
    if (this.name)
        names.push(this.name);
    if (caller && !(this.name && flags.SHORT_NAME))
        names.push(caller);
    if (!names.length)
        names.push('noname');
    return names.join(' ');
};

E.prototype.state_str = function(){
    return this.cur_state+(this.next_state>=0 ? '->'+this.next_state : ''); };

E.prototype.get_depth = function(){
    var i=0, et = this;
    for (; et; et = et.up, i++);
    return i;
};

function trim_space(s){
    if (s[s.length-1]!=' ')
        return s;
    return s.slice(0, -1);
}
function ms_to_str(ms){ // from date.js
    var s = ''+ms;
    return s.length<=3 ? s+'ms' : s.slice(0, -3)+'.'+s.slice(-3)+'s';
}
E.prototype.get_time_passed = function(){
    return ms_to_str(Date.now()-this.tm_create); };
E.prototype.get_time_completed = function(){
    return ms_to_str(Date.now()-this.tm_completed); };
E.prototype.get_info = function(){
    var info = this.info, s = '', _i;
    if (!info)
        return '';
    for (var i in info)
    {
        _i = info[i];
        if (!_i)
            continue;
        if (s!=='')
            s += ' ';
        if (typeof _i=='function')
            s += _i();
        else
            s += _i;
    }
    return trim_space(s);
};

// light-weight efficient etask/promise error value
function Etask_err(err){ this.error = err || new Error(); }
E.Etask_err = Etask_err;
E.err = function(err){ return new Etask_err(err); };
E.is_err = function(v){
    return v instanceof Etask && v.error!==undefined ||
        v instanceof Etask_err;
};
E.err_res = function(err, res){ return err ? E.err(err) : res; };
E._res2rv = function(res){
    return E.is_err(res) ? {ret: undefined, err: res.error}
        : {ret: res, err: undefined};
};
E.is_final = function(v){
    return !v || typeof v.then!='function' || v instanceof Etask_err ||
        v instanceof Etask && !!v.tm_completed;
};

// promise compliant .then() implementation for Etask and Etask_err.
// for unit-test comfort, also .otherwise(), .catch(), .ensure(), resolve() and
// reject() are implemented.
E.prototype.then = function(on_res, on_err){
    var _this = this;
    function on_done(){
        if (!_this.error)
            return !on_res ? _this.retval : on_res(_this.retval);
        return !on_err ? E.err(_this.error) : on_err(_this.error);
    }
    if (this.tm_completed)
    {
        return new Etask({name: 'then_completed'},
            [function(){ return on_done(); }]);
    }
    var then_wait = new Etask({name: 'then_wait'},
        [function(){ return this.wait(); }]);
    this.then_waiting.add(function(){
        try { then_wait.continue(on_done()); }
        catch(e){ then_wait.throw(e); }
    });
    return then_wait;
};
E.prototype.otherwise = E.prototype.catch = function(on_err){
    return this.then(null, on_err); };
E.prototype.ensure = function(on_ensure){
    return this.then(function(res){ on_ensure(); return res; },
        function(err){ on_ensure(); throw err; });
};
Etask_err.prototype.then = function(on_res, on_err){
    var _this = this;
    return new Etask({name: 'then_err'}, [function(){
        return !on_err ? E.err(_this.error) : on_err(_this.error);
    }]);
};
Etask_err.prototype.otherwise = Etask_err.prototype.catch = function(on_err){
    return this.then(null, on_err); };
Etask_err.prototype.ensure = function(on_ensure){
    this.then(null, function(){ on_ensure(); });
    return this;
};
E.resolve = function(v){ return new Etask({}, [function(){ return v; }]); };
E.reject = function(e){ return new Etask({}, [function(){ throw e; }]); };

E.prototype.wait_ext = function(promise){
    if (!promise || typeof promise.then!='function')
        return promise;
    var wait = this.wait();
    promise.then(wait.continue_fn(), wait.throw_fn());
    return wait;
};

E.prototype.shortname = function(){
    return this.name===undefined ? 'noname' : this.name;
};
E.prototype.longname = function(flags){
    flags = flags||{TIME: 1};
    var s = '', _s;
    if (this.running)
        s += 'RUNNING ';
    s += this.get_name(flags)+(!this.tm_completed ? '.'+this.state_str() : '')
        +' ';
    if (this.tm_completed)
        s += 'COMPLETED'+(flags.TIME ? ' '+this.get_time_completed() : '')+' ';
    if (flags.TIME)
        s += this.get_time_passed()+' ';
    if (_s = this.get_info())
        s += _s+' ';
    return trim_space(s);
};
E.prototype.stack = function(flags){
    var et = this, s = '';
    flags = assign({STACK: 1, RECURSIVE: 1, GUESS: 1}, flags);
    while (et)
    {
        var _s = et.longname(flags)+'\n';
        if (et.up)
            et = et.up;
        else if (et.parent)
        {
            _s = (et.parent_type=='call' ? 'CALL' : 'SPAWN')+' '+_s;
            et = et.parent;
        }
        else if (et.parent_guess && flags.GUESS)
        {
            _s = 'SPAWN? '+_s;
            et = et.parent_guess;
        }
        else
            et = undefined;
        if (flags.TOPDOWN)
            s = _s+s;
        else
            s += _s;
    }
    return s;
};
E.prototype._ps = function(pre_first, pre_next, flags){
    var i, s = '', task_trail, et = this, child_guess;
    if (++flags.limit_n>=flags.LIMIT)
        return flags.limit_n==flags.LIMIT ? '\nLIMIT '+flags.LIMIT+'\n': '';
    /* get top-most et */
    for (; et.up; et = et.up);
    /* print the sp frames */
    for (var first = 1; et; et = et.down, first = 0)
    {
        s += first ? pre_first : pre_next;
        first = 0;
        if (flags.MARK && (i = flags.MARK.sp.indexOf(et))>=0)
            s += (flags.MARK.name[i]||'***')+' ';
        s += et.longname(flags)+'\n';
        if (flags.RECURSIVE)
        {
            var stack_trail = et.down ? '.' : ' ';
            var child = et.child;
            if (flags.GUESS)
                child = new Set([...child, ...et.child_guess]);
            i = 0;
            for (let child_i of child.values())
            {
                task_trail = i<child.size-1 ? '|' : stack_trail;
                child_guess = child_i.parent_guess ? '\\? ' :
                    child_i.parent_type=='call' ? '\\> ' : '\\_ ';
                s += child_i._ps(pre_next+task_trail+child_guess,
                    pre_next+task_trail+'   ', flags);
                i++;
            }
        }
    }
    return s;
};
function ps_flags(flags){
    var m, _m;
    if (m = flags.MARK)
    {
        if (!Array.isArray(m))
            _m = {sp: [m], name: []};
        else if (!Array.isArray(flags.MARK[0]))
            _m = {sp: m, name: []};
        else
        {
            _m = {sp: [], name: []};
            for (var i=0; i<m.length; i++)
            {
                _m.name.push(m[i][0]);
                _m.sp.push(m[i][1]);
            }
        }
        flags.MARK = _m;
    }
}
E.prototype.ps = function(flags){
    flags = assign({STACK: 1, RECURSIVE: 1, LIMIT: 10000000, TIME: 1,
        GUESS: 1}, flags, {limit_n: 0});
    ps_flags(flags);
    return this._ps('', '', flags);
};
E._longname_root = function(){
    return (zerr.prefix ? zerr.prefix+'pid '+process.pid+' ' : '')+'root'; };
E.ps = function(flags){
    var s = '', task_trail;
    flags = assign({STACK: 1, RECURSIVE: 1, LIMIT: 10000000, TIME: 1,
        GUESS: 1}, flags, {limit_n: 0});
    ps_flags(flags);
    s += E._longname_root()+'\n';
    var child = Array.from(E.root.values());
    if (flags.GUESS)
    {
        child = [];
        E.root.forEach(root_i=>{
            if (!root_i.parent_guess)
                child.push(root_i);
        });
    }
    child.forEach((child_i, i)=>{
        task_trail = i<child.length-1 ? '|' : ' ';
        s += child_i._ps(task_trail+'\\_ ', task_trail+'   ', flags);
    });
    return s;
};

function assert_tree_unique(a){
    var i;
    for (i=0; i<a.length-1; i++)
        assert(!a.includes(a[i], i+1));
}
E.prototype._assert_tree = function(opt){
    var et;
    opt = opt||{};
    assert_tree_unique(this.child);
    assert(this.parent);
    if (this.down)
    {
        et = this.down;
        assert(et.up===this);
        assert(!et.parent);
        assert(!et.parent_guess);
        this.down._assert_tree(opt);
    }
    for (let _et of this.child.values())
    {
        assert(_et.parent===this);
        assert(!_et.parent_guess);
        assert(!_et.up);
        _et._assert_tree(opt);
    }
    if (this.child_guess.size)
        assert(E.in_run.includes(this));
    for (let _et of this.child_guess.values())
    {
        assert(_et.parent_guess===this);
        assert(!_et.parent);
        assert(!_et.up);
    }
};
E._assert_tree = function(opt){
    opt = opt||{};
    assert_tree_unique(E.root);
    for (let et of this.child.values())
    {
        assert(!et.parent);
        assert(!et.up);
        et._assert_tree(opt);
    }
};
E.prototype._assert_parent = function(){
    if (this.up)
        return assert(!this.parent && !this.parent_guess);
    assert(this.parent && this.parent_guess,
        'parent_guess together with parent');
    if (this.parent)
    {
        var child = this.parent ? this.parent.child : E.root;
        assert(child.has(this),
            'cannot find in parent '+(this.parent ? '' : 'root'));
    }
    else if (this.parent_guess)
    {
        assert(this.parent_guess.child_guess.has(this),
            'cannot find in parent_guess');
        assert(E.in_run.includes(this.parent_guess));
    }
};

E.prototype.return_child = function(){
    // copy array, since return() has side affects and can modify array
    var child = Array.from(this.child.values());
    for (var i=0; i<child.length; i++)
        child[i].return();
};

E.sleep = function(ms){
    var timer;
    ms = ms||0;
    return new Etask({name: 'sleep', cancel: true}, [function(){
        this.info.ms = ms+'ms';
        timer = setTimeout(this.continue_fn(), ms);
        return this.wait();
    }, function finally$(){
        '@jsdefender { localDeclarations: false }';
        clearTimeout(timer);
    }]);
};

var ebreak_obj = {ebreak: 1};
E.prototype.break = function(ret){
    return this.throw({ebreak: ebreak_obj, ret: ret}); };
E.for = function(cond, inc, opt, states){
    if (Array.isArray(opt) || typeof opt=='function')
    {
        states = opt;
        opt = undefined;
    }
    states = typeof states=='function' ? [states] : states;
    return new Etask({name: 'for', cancel: true, init: opt&&opt.init_parent},
    [function loop(){
        return !cond || cond.call(this);
    }, function try_catch$(res){
        '@jsdefender { localDeclarations: false }';
        if (!res)
            return this.return();
        return new Etask({name: 'for_iter', cancel: true, init: opt&&opt.init},
            states||[]);
    }, function(){
        if (this.error)
        {
            if (this.error.ebreak===ebreak_obj)
                return this.return(this.error.ret);
            return this.throw(this.error);
        }
        return inc && inc.call(this);
    }, function(){
        return this.goto('loop');
    }]);
};
E.for_each = function(obj, states){
    var keys = Object.keys(obj);
    var iter = {obj: obj, keys: keys, i: 0, key: undefined, val: undefined};
    function init_iter(){ this.iter = iter; }
    return E.for(function(){
            this.iter = this.iter||iter;
            iter.key = keys[iter.i];
            iter.val = obj[keys[iter.i]];
            return iter.i<keys.length;
        },
        function(){ return iter.i++; },
        {init: init_iter, init_parent: init_iter},
        states);
};
E.while = function(cond, states){ return E.for(cond, null, states); };

// all([opt, ]a_or_o)
E.all = function(a_or_o, ao2){
    var i, j, opt = {};
    if (ao2)
    {
        opt = a_or_o;
        a_or_o = ao2;
    }
    if (Array.isArray(a_or_o))
    {
        var a = Array.from(a_or_o);
        i = 0;
        return new Etask({name: 'all_a', cancel: true}, [function(){
            for (j=0; j<a.length; j++)
                this.spawn(a[j]);
        }, function try_catch$loop(){
            '@jsdefender { localDeclarations: false }';
            if (i>=a.length)
                return this.return(a);
            this.info.at = 'at '+i+'/'+a.length;
            var _a = a[i];
            if (_a instanceof Etask)
                _a.spawn_parent();
            return _a;
        }, function(res){
            if (this.error)
            {
                if (!opt.allow_fail)
                    return this.throw(this.error);
                res = E.err(this.error);
            }
            a[i] = res;
            i++;
            return this.goto('loop');
        }]);
    }
    else if (a_or_o instanceof Object)
    {
        var keys = Object.keys(a_or_o), o = {};
        i = 0;
        return new Etask({name: 'all_o', cancel: true}, [function(){
            for (j=0; j<keys.length; j++)
                this.spawn(a_or_o[keys[j]]);
        }, function try_catch$loop(){
            '@jsdefender { localDeclarations: false }';
            if (i>=keys.length)
                return this.return(o);
            var _i = keys[i], _a = a_or_o[_i];
            this.info.at = 'at '+_i+' '+i+'/'+keys.length;
            if (_a instanceof Etask)
                _a.spawn_parent();
            return _a;
        }, function(res){
            if (this.error)
            {
                if (!opt.allow_fail)
                    return this.throw(this.error);
                res = E.err(this.error);
            }
            o[keys[i]] = res;
            i++;
            return this.goto('loop');
        }]);
    }
    assert(0, 'invalid type');
};

E.all_limit = function(limit, arr_iter, cb){
    var at = 0;
    var iter = !Array.isArray(arr_iter) ? arr_iter : function(){
        if (at<arr_iter.length)
            return cb.call(this, arr_iter[at++]);
    };
    return new Etask({name: 'all_limit', cancel: true}, [function(){
        var next;
        if (!(next = iter.call(this)))
            return this.goto('done');
        if (E.is_err(next))
            return this.throw(next.error);
        var _this = this;
        if (typeof next.catch=='function')
            next.catch(function(e){ _this.throw(e); });
        this.spawn(next);
        this.loop();
        if (this.child.size>=limit)
            return this.wait_child('any', {rethrow: true});
    }, function done(){
        return this.wait_child('all', {rethrow: true});
    }]);
};

// _apply(opt, func[, _this], args)
// _apply(opt, object, method, args)
E._apply = function(opt, func, _this, args){
    var func_name;
    if (typeof _this=='string') // class with '.method' string call
    {
        if (_this[0]!='.')
            assert(0, 'invalid method '+_this);
        var method = _this.slice(1), _class = func;
        func = _class[method];
        _this = _class;
        if (!(_this instanceof Object))
            assert(0, 'invalid method .'+method);
        func_name = method;
    }
    else if (Array.isArray(_this) && !args)
    {
        args = _this;
        _this = null;
    }
    opt.name = opt.name||func_name||func.name;
    return new Etask(opt, [function(){
        var et = this, ret_sync, returned = 0;
        args = Array.from(args);
        args.push(function cb(err, res){
            if (typeof opt.ret_sync=='string' && !returned)
            {
                // hack to wait for result
                var a = arguments;
                returned++;
                return void E.nextTick(function(){ cb.apply(null, a); });
            }
            var nfn = opt.nfn===undefined || opt.nfn ? 1 : 0;
            if (opt.ret_o)
            {
                var o = {}, i;
                if (Array.isArray(opt.ret_o))
                {
                    for (i=0; i<opt.ret_o.length; i++)
                        o[opt.ret_o[i]] = arguments[i+nfn];
                }
                else if (typeof opt.ret_o=='string')
                    o[opt.ret_o] = array.slice(arguments, nfn);
                else
                    assert(0, 'invalid opt.ret_o');
                if (typeof opt.ret_sync=='string')
                    o[opt.ret_sync] = ret_sync;
                res = o;
            }
            else if (opt.ret_a)
                res = array.slice(arguments, nfn);
            else if (!nfn)
                res = err;
            et.continue(nfn ? E.err_res(err, res) : res);
        });
        ret_sync = func.apply(_this, args);
        if (Array.isArray(opt.ret_sync))
            opt.ret_sync[0][opt.ret_sync[1]] = ret_sync;
        returned++;
        return this.wait();
    }]);
};

// nfn_apply([opt, ]object, method, args)
// nfn_apply([opt, ]func, this, args)
E.nfn_apply = function(opt, func, _this, args){
    var _opt = {nfn: 1, cancel: 1};
    if (typeof opt=='function' || typeof func=='string')
    {
        args = _this;
        _this = func;
        func = opt;
        opt = _opt;
    }
    else
        opt = assign(_opt, opt);
    return E._apply(opt, func, _this, args);
};
// cb_apply([opt, ]object, method, args)
// cb_apply([opt, ]func, this, args)
E.cb_apply = function(opt, func, _this, args){
    var _opt = {nfn: 0};
    if (typeof opt=='function' || typeof func=='string')
    {
        args = _this;
        _this = func;
        func = opt;
        opt = _opt;
    }
    else
        opt = assign(_opt, opt);
    return E._apply(opt, func, _this, args);
};

E.prototype.continue_nfn = function(){
    return function(err, res){ this.continue(E.err_res(err, res)); }
    .bind(this);
};

E.augment = function(_prototype, method, e_method){
    var i, opt = {};
    if (method instanceof Object && !Array.isArray(method))
    {
        assign(opt, method);
        method = arguments[2];
        e_method = arguments[3];
    }
    if (Array.isArray(method))
    {
        if (e_method)
            opt.prefix = e_method;
        for (i=0; i<method.length; i++)
            E.augment(_prototype, opt, method[i]);
        return;
    }
    opt.prefix = opt.prefix||'e_';
    if (!e_method)
        e_method = opt.prefix+method;
    var fn = _prototype[method];
    _prototype[e_method] = function(){
        return E._apply({name: e_method, nfn: 1}, fn, this, arguments); };
};

E.wait = function(timeout){
    return new Etask({name: 'wait', cancel: true},
        [function(){ return this.wait(timeout); }]);
};
E.to_nfn = function(promise, cb, opt){
    return new Etask({name: 'to_nfn', async: true}, [function try_catch$(){
        '@jsdefender { localDeclarations: false }';
        return promise;
    }, function(res){
        var ret = [this.error];
        if (opt && opt.ret_a)
            ret = ret.concat(res);
        else
            ret.push(res);
        cb.apply(null, ret);
    }]);
};
function etask_fn(opt, states, push_this){
    if (Array.isArray(opt) || typeof opt=='function')
    {
        states = opt;
        opt = undefined;
    }
    let is_gen = typeof states=='function' && states.constructor.name==GEN_FN;
    let arg_start = +push_this;
    return function(){
        const _opt = assign({}, opt);
        _opt.state0_args = new Array(arg_start+arguments.length);
        _opt.state0_args[0] = this;
        for (var i=0; i<arguments.length; i++)
            _opt.state0_args[arg_start+i] = arguments[i];
        if (is_gen)
            return E._generator(null, states, _opt);
        return new Etask(_opt, typeof states=='function' ? [states] : states);
    };
}
E.fn = function(opt, states){ return etask_fn(opt, states, false); };
E._fn = function(opt, states){ return etask_fn(opt, states, true); };
E._generator = function(gen, ctor, opt){
    opt.name = opt.name || ctor && ctor.name || 'generator';
    opt.cancel = opt.cancel===undefined ? true : opt.cancel;
    let done = false;
    return new Etask(opt, [function(){
        this.generator = gen = gen||ctor.apply(this, opt.state0_args||[]);
        this.generator_ctor = ctor;
        return {ret: undefined, err: undefined};
    }, function try_catch$loop(rv){
        '@jsdefender { localDeclarations: false }';
        var res;
        try { res = rv.err ? gen.throw(rv.err) : gen.next(rv.ret); }
        catch(e){ return this.return(E.err(e)); }
        if (res.done)
        {
            done = true;
            return this.return(res.value);
        }
        return res.value;
    }, function(ret){
        return this.goto('loop', this.error ?
            {ret: undefined, err: this.error} : {ret: ret, err: undefined});
    }, function finally$(){
        '@jsdefender { localDeclarations: false }';
        // https://kangax.github.io/compat-table/es6/#test-generators_%GeneratorPrototype%.return
        // .return() supported only in node>=6.x.x
        if (!done && gen && gen.return)
            try { gen.return(); } catch(e){}
    }]);
};
E.ef = function(err, et){ // error filter
    if (zerr.on_exception)
        zerr.on_exception(err, et);
    return err;
};
// similar to setInterval
// opt==10000 (or opt.ms==10000) - call states every 10 seconds
// opt.mode=='smart' - default mode, like setInterval. If states take
//   longer than 'ms' to execute, next execution is delayed.
// opt.mode=='fixed' - always sleep 10 seconds between states
// opt.mode=='spawn' - spawn every 10 seconds
E.interval = function(opt, states){
    if (typeof opt=='number')
        opt = {ms: opt};
    if (!opt.mode || opt.mode=='smart')
        return interval_smart(opt, states);
    if (opt.mode=='fixed')
        return interval_fixed(opt, states);
    if (opt.mode=='spawn')
        return interval_spawn(opt, states);
    throw new Error('unexpected mode '+opt.mode);
};
const interval_smart = (opt, states)=>{
    const STATE_BEGIN = 0;
    const STATE_OPS = 1;
    const STATE_TIMER = 2;
    const STATE_DONE = 4;
    let state, w, timer, gap_timer;
    const init_parent = function(){
        w = this.wait();
        this.finally(()=>clearTimeout(timer));
    };
    const set_state = (for_et, flag)=>{
        if ((state = state|flag) != (STATE_OPS|STATE_TIMER))
            return;
        state = state|STATE_DONE;
        if (flag==STATE_TIMER)
            return void for_et.continue();
        if (gap_timer && zutil.is_timer_refresh)
            gap_timer.refresh();
        else
        {
            clearTimeout(gap_timer);
            gap_timer = setTimeout(for_et.continue_fn(), 0);
        }
    };
    return E.for(function(){
        state = STATE_BEGIN;
        if (timer && zutil.is_timer_refresh)
            timer.refresh();
        else
        {
            clearTimeout(timer);
            timer = setTimeout(()=>set_state(this, STATE_TIMER), opt.ms);
        }
        return true;
    }, function(){
        set_state(this, STATE_OPS);
        return w;
    }, {init_parent}, states);
};
const interval_fixed = (opt, states)=>{
    let w, timer;
    const init_parent = function(){
        w = this.wait();
        this.finally(()=>clearTimeout(timer));
    };
    return E.for(null, function(){
        if (timer && zutil.is_timer_refresh)
            timer.refresh();
        else
        {
            clearTimeout(timer);
            timer = setTimeout(this.continue_fn(), opt.ms);
        }
        return w;
    }, {init_parent}, states);
};
const interval_spawn = (opt, states)=>{
    let w, timer, stopped = false;
    const init = function(){
        w = this.wait();
        this.finally(()=>clearTimeout(timer));
    };
    states = typeof states=='function' ? [states] : states;
    return new Etask({name: 'interval_spawn', cancel: true, init},
        [function loop(){
            new Etask({}, [function try_catch$(){
                '@jsdefender { localDeclarations: false }';
                return new Etask({}, states);
            }, function(res){
                if (!this.error)
                    return;
                if (this.error.ebreak!==ebreak_obj)
                    return this.throw(this.error);
                stopped = true;
            }]);
        }, function(){
            if (stopped)
                return this.return();
            if (timer && zutil.is_timer_refresh)
                timer.refresh();
            else
            {
                clearTimeout(timer);
                timer = setTimeout(this.continue_fn(), opt.ms);
            }
            return w;
        }, function(){
            if (stopped) // stopped during sleep by prev long iteration
                return this.return();
            return this.goto('loop');
        }]);
};

E._class = function(cls){
    var proto = cls.prototype, keys = Reflect.ownKeys(proto);
    for (var i=0; i<keys.length; i++)
    {
        var key = keys[i];
        var descr = Object.getOwnPropertyDescriptor(proto, key);
        if (descr.get||descr.set)
            continue;
        var p = proto[key];
        if (typeof p=='function' && p.constructor.name==GEN_FN)
            proto[key] = E._fn(p);
    }
    return cls;
};
E.shutdown = function(){
    var prev;
    while (E.root.size)
    {
        var e = E.root.values().next().value;
        if (e==prev)
        {
            assert(e.tm_completed);
            zerr.zexit('etask root not removed after return - '+
                'fix non-cancelable child etask');
        }
        prev = e;
        e.return();
    }
};

E.race = function(ets){
    return new Etask({}, [function race(){
        if (!Array.isArray(ets))
            zerr.zexit('provided argument is not an array');
        if (!ets.length)
            return;
        var race_et = E.wait();
        var _this = this;
        function _child_error_handler(e){ race_et.throw(e); }
        var _race = new Etask({}, [
            function(){
                return E.for_each(ets, function(){
                    var et = this.iter.val;
                    _this.spawn(new Etask({}, [
                        function(){
                            this.on('uncaught', _child_error_handler);
                            return et;
                        },
                        function(res){ race_et.continue(res); },
                    ]));
                });
            },
            function(){ return race_et; },
        ]);
        _race.finally(function(){ _this.return_child(); });
        return _race;
    }]);
};

E.any = function(opt, ets){
    if (!ets)
    {
        ets = opt;
        opt = {};
    }
    opt=opt||{};
    opt.rethrow = opt.rethrow==undefined ? 1 : opt.rethrow;
    return new Etask({}, [function race(){
        if (!Array.isArray(ets))
            zerr.zexit('provided argument is not an array');
        var length = ets.length;
        if (!length)
            return;
        var race_et = E.wait();
        var errors = [];
        var _this = this;
        function _child_error_handler(e){
            errors.push(e);
            if (errors.length!=length)
                return;
            var err = new Error('aggregation error');
            err.errors = errors;
            if (opt.rethrow)
                race_et.throw(err);
            else
                race_et.continue();
        }
        var _race = new Etask({}, [
            function(){
                return E.for_each(ets, function(){
                    var et = this.iter.val;
                    var child = _this.spawn(new Etask({}, [
                        function(){
                            this.on('uncaught', _child_error_handler);
                            return et;
                        },
                        function(res){ race_et.continue(res); },
                    ]));
                    if (opt.timeout)
                        setTimeout(()=>child.throw('timeout'), opt.timeout);
                });
            },
            function(){ return race_et; },
        ]);
        _race.finally(function(){ _this.return_child(); });
        return _race;
    }]);
};

return Etask; }); }());
