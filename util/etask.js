// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, browser:true*/
(function(){
var define, process, zerr, assert;
var is_node = typeof module=='object' && module.exports && module.children;
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
var E = Etask;
var etask = Etask;
var env = process.env, assign = Object.assign;
E.use_bt = +env.ETASK_BT;
E.root = [];
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
            +et.run_state.f.toString().slice(0, 128));
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
        return new Etask(opt, states);
    if (Array.isArray(opt) || typeof opt=='function')
    {
        states = opt;
        opt = undefined;
    }
    opt = typeof opt=='string' && {name: opt} || opt || {};
    if (typeof states=='function')
    {
        if (states.constructor.name=='GeneratorFunction')
            return E._generator(null, states, opt);
        states = [states];
    }
    // performance: set all fields to undefined
    this.cur_state = this.states = this._finally = this.error =
    this.at_return = this.next_state = this.use_retval = this.running =
    this.at_continue = this.cancel = this.wait_timer = this.retval =
    this.run_state = this._stack = this.down = this.up = this.child =
    this.name = this._name = this.parent = this.cancelable =
    this.tm_create = this._alarm = this.tm_completed = this.parent_type =
    this.info = this.then_waiting = this.free = this.parent_guess =
    this.child_guess = this.wait_retval = undefined;
    // init fields
    this.name = opt.name;
    this._name = this.name===undefined ? 'noname' : this.name;
    this.cancelable = opt.cancel;
    this.then_waiting = [];
    this.child = [];
    this.child_guess = [];
    this.cur_state = -1;
    this.states = [];
    this._stack = Etask.use_bt ? stack_get() : undefined;
    this.tm_create = Date.now();
    this.info = {};
    var idx = this.states.idx = {};
    for (var i=0; i<states.length; i++)
    {
        var pstate = states[i], t;
        if (typeof pstate!='function')
            assert(0, 'invalid state type');
        t = this._get_func_type(pstate);
        var state = {f: pstate, label: t.label, try_catch: t.try_catch,
            catch: t.catch, finally: t.finally, cancel: t.cancel,
            sig: undefined};
        if (i==0 && opt.state0_args)
        {
            state.f = state.f.bind.apply(state.f,
                [this].concat(opt.state0_args));
        }
        if (state.label)
            idx[state.label] = i;
        assert((state.catch||state.try_catch?1:0)
            +(state.finally?1:0)+(state.cancel?1:0)<=1,
            'invalid multiple state types');
        state.sig = state.finally||state.cancel;
        if (state.finally)
        {
            assert(this._finally===undefined, 'more than 1 finally$');
            this._finally = i;
        }
        if (state.cancel)
        {
            assert(this.cancel===undefined, 'more than 1 cancel$');
            this.cancel = i;
        }
        this.states[i] = state;
    }
    var _this = this;
    E.root.push(this);
    var in_run = E.in_run_top();
    if (opt.spawn_parent)
        this.spawn_parent(opt.spawn_parent);
    else if (opt.up)
        opt.up._set_down(this);
    else if (in_run)
        this._spawn_parent_guess(in_run);
    if (opt.init)
        opt.init.call(this);
    if (opt.async)
    {
        var wait_retval = this._set_wait_retval();
        E.nextTick(function(){
            if (_this.running!==undefined)
                return;
            _this._got_retval(wait_retval);
        });
    }
    else
        this._next_run();
    return this;
}
zutil.inherits(Etask, events.EventEmitter);

E.prototype._root_remove = function(){
    assert(!this.parent, 'cannot remove from root when has parent');
    if (!array.rm_elm_tail(E.root, this))
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
    if (!array.rm_elm_tail(this.parent.child, this))
    {
        assert(0, 'etask child not in parent\n'
            +E.ps({MARK: [['child', this], ['parent', this.parent]]}));
    }
    if (this.parent.tm_completed)
        this.parent._check_free();
    this.parent = undefined;
};

E.prototype._check_free = function(){
    if (this.down || this.child.length)
        return;
    this._parent_remove();
    this.free = true;
};

E.prototype._call_err = function(e){
    E.ef(e);
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
        zerr.debug(this._name+': close');
    this.tm_completed = Date.now();
    this.parent_type = this.up ? 'call' : 'spawn';
    if (this.error)
        this.emit_safe('uncaught', this.error);
    if (this._finally!==undefined)
    {
        var ret = this._call_safe(this.states[this._finally].f);
        if (E.is_err(ret))
            this._set_retval(ret);
    }
    this.emit_safe('finally');
    this.emit_safe('ensure');
    if (this.error && !this.up && !this.parent && !this.parent_guess)
        E.events.emit('uncaught', this);
    if (this.parent)
        this.parent.emit('child', this);
    if (this.up && (this.down || this.child.length))
    {
        var up = this.up;
        this.up = this.up.down = undefined;
        this.parent = up;
        up.child.push(this);
    }
    this._check_free();
    this._del_wait_timer();
    this.del_alarm();
    this._ecancel_child();
    this.emit_safe('finally1');
    while (this.then_waiting.length)
        this.then_waiting.shift()();
};
E.prototype._next = function(rv){
    if (this.tm_completed)
        return true;
    rv = rv||{ret: undefined, err: undefined};
    var states = this.states;
    var state = this.at_return ? states.length :
        this.next_state!==undefined ? this.next_state :
        this.cur_state+1;
    this.retval = rv.ret;
    this.error = rv.err;
    if (rv.err!==undefined)
    {
        if (zerr.on_exception)
            zerr.on_exception(rv.err);
        if (this.run_state.try_catch)
        {
            this.use_retval = true;
            for (; state<states.length && states[state].sig; state++);
        }
        else
            for (; state<states.length && !states[state].catch; state++);
    }
    else
    {
        for (; state<states.length &&
            (states[state].sig || states[state].catch); state++);
    }
    this.cur_state = state;
    this.run_state = states[state];
    this.next_state = undefined;
    if (this.cur_state<states.length)
        return false;
    this._complete();
    return true;
};

E.prototype._next_run = function(rv){
    if (this._next(rv))
        return;
    this._run();
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
            ret.then_waiting.push(function(){
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
        ret.then(function(ret){ _this._got_retval(wait_retval, ret); },
            function(err){ _this._got_retval(wait_retval, E.err(err)); });
        return true;
    }
    // generator
    else if (typeof ret.next=='function' && typeof ret.throw=='function')
    {
        rv.ret = E._generator(ret, this.states[this.cur_state]);
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
        var cb_ctx;
        var arg = this.error && !this.use_retval ? this.error : this.retval;
        this.use_retval = false;
        this.running = true;
        rv.ret = rv.err = undefined;
        E.in_run.push(this);
        if (zerr.is(zerr.L.DEBUG))
            zerr.debug(this._name+':S'+this.cur_state+': running');
        if (cb_pre)
            cb_ctx = cb_pre(this);
        try { rv.ret = this.run_state.f.call(this, arg); }
        catch(e){
            rv.err = e;
            if (rv.err instanceof Error)
                rv.err.etask = this;
        }
        if (cb_post)
            cb_post(this, cb_ctx);
        this.running = false;
        E.in_run.pop();
        for (; this.child_guess.length;
            this.child_guess.pop().parent_guess = undefined);
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
        if (this._next(rv))
            return;
    }
};

E.prototype._set_down = function(down){
    if (this.down)
        assert(0, 'caller already has a down\n'+this.ps());
    if (down.parent_guess)
        down._parent_guess_remove();
    assert(!down.parent, 'returned etask already has a spawn parent');
    assert(!down.up, 'returned etask already has a caller parent');
    down._parent_remove();
    this.down = down;
    down.up = this;
};

var func_type_cache = {};
E.prototype._get_func_type = function(func, on_fail){
    var name = func.name;
    var type = func_type_cache[name];
    if (type)
        return type;
    type = func_type_cache[name] = {name: undefined, label: undefined,
        try_catch: undefined, catch: undefined, finally: undefined,
        cancel: undefined};
    if (!name)
        return type;
    type.name = name;
    var n = name.split('$');
    if (n.length==1)
    {
        type.label = n[0];
        return type;
    }
    if (n.length>2)
        return type;
    if (n[1].length)
        type.label = n[1];
    var f = n[0].split('_');
    for (var j=0; j<f.length; j++)
    {
        if (f[j]=='try')
        {
            type.try_catch = true;
            if (f[j+1]=='catch')
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
    return type;
};

E.prototype.spawn = function(child, replace){
    if (!(child instanceof Etask) && child && typeof child.then=='function')
    {
        var promise = child;
        child = etask([function(){ return promise; }]);
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
    parent.child_guess.push(this);
};
E.prototype._parent_guess_remove = function(){
    if (!array.rm_elm_tail(this.parent_guess.child_guess, this))
        assert(0, 'etask not in parent_guess\n'+E.ps({MARK: this}));
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
        return void E.root.push(this);
    parent.child.push(this);
    this.parent = parent;
};

E.prototype.set_state = function(name){
    var state = this.states.idx[name];
    assert(state!==undefined, 'named func "'+name+'" not found');
    return this.next_state = state;
};

E.prototype.finally = function(cb){
    this.prependListener('finally', cb); };
E.prototype.goto_fn = function(name){
    return this.goto.bind(this, name); };
E.prototype.goto = function(name, promise){
    this.set_state(name);
    var state = this.states[this.next_state];
    assert(!state.sig, 'goto to sig');
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
        _this._next_run({ret: undefined, err: 'timeout'});
    }, timeout);
};
E.prototype._del_wait_timer = function(){
    if (this.wait_timer)
        this.wait_timer = clearTimeout(this.wait_timer);
    this.wait_retval = undefined;
};
E.prototype._get_child_running = function(from){
    var i, child = this.child;
    for (i=from||0; i<child.length && child[i].tm_completed; i++);
    return i>=child.length ? -1 : i;
};
E.prototype._set_wait_child = function(wait_retval){
    var i, _this = this, child = wait_retval.child;
    var cond = wait_retval.cond, wait_on;
    assert(!cond || child=='any', 'condition supported only for "any" '+
        'option, you can add support if needed');
    if (child=='any')
    {
        if (this._get_child_running()<0)
            return true;
        wait_on = function(){
            _this.once('child', function(child){
                if (!cond || cond.call(child, child.retval))
                    return _this._got_retval(wait_retval, {child: child});
                if (_this._get_child_running()<0)
                    return _this._got_retval(wait_retval);
                wait_on();
            });
        };
        wait_on();
    }
    else if (child=='all')
    {
        if ((i = this._get_child_running())<0)
            return true;
        wait_on = function(child){
            _this.once('child', function(child){
                var i;
                if ((i = _this._get_child_running())<0)
                    return _this._got_retval(wait_retval);
                wait_on(_this.child[i]);
            });
        };
        wait_on(this.child[i]);
    }
    else
    {
        assert(child, 'no child provided');
        assert(this===child.parent, 'child does not belong to parent');
        if (child.tm_completed)
            return true;
        child.once('finally', function(){
            return _this._got_retval(wait_retval, {child: child}); });
    }
    this.emit_safe('wait_on_child');
};

E.prototype._got_retval = function(wait_retval, res){
    if (this.wait_retval!==wait_retval || wait_retval.completed)
        return;
    wait_retval.completed = true;
    // inline _next_run to reduce stack depth
    if (!this._next(E._res2rv(res)))
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
        this._next_run(rv);
        E.continue_depth--;
    }
    else // avoid high stack depth
        E.nextTick(function(){ _this._next_run(rv); });
    return promise;
};

E.prototype._ecancel = function(){
    if (this.tm_completed)
        return this;
    this.emit_safe('cancel');
    if (this.cancel!==undefined)
        return this._call_safe(this.states[this.cancel].f);
    if (this.cancelable)
        return this.return();
};

E.prototype._ecancel_child = function(){
    if (!this.child.length)
        return;
    // copy array, since ecancel has side affects and can modify array
    var child = Array.from(this.child);
    for (var i=0; i<child.length; i++)
        child[i]._ecancel();
};

E.prototype.return_fn = function(){
    return this.return.bind(this); };
E.prototype.return = function(promise){
    if (this.tm_completed)
        return this._set_retval(promise);
    this.at_return = true;
    this.next_state = undefined;
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

E.prototype.alarm_left = function(){
    var a = this._alarm;
    if (!a)
        return 0;
    return a.start-Date.now();
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

function Etask_wait(et, op, timeout){
    this.timeout = timeout;
    this.et = et;
    this.op = op;
    this.child = this.at_child = this.cond = undefined;
    this.ready = this.completed = undefined;
}
Etask_wait.prototype.continue = function(res){
    if (this.completed)
        return;
    if (!this.et.wait_retval)
        return void(this.ready = {ret: res});
    if (this!==this.et.wait_retval)
        return;
    this.et.continue(res);
};
Etask_wait.prototype.continue_fn = function(){
    return this.continue.bind(this); };
Etask_wait.prototype.throw = function(err){
    return this.continue(E.err(err)); };
Etask_wait.prototype.throw_fn = function(){
    return this.throw.bind(this); };
E.prototype.wait = function(timeout){
    return new Etask_wait(this, 'wait', timeout); };
E.prototype.wait_child = function(child, timeout, cond){
    if (typeof timeout=='function')
    {
        cond = timeout;
        timeout = 0;
    }
    var wait = new Etask_wait(this, 'wait_child', timeout);
    wait.child = child;
    wait.at_child = null;
    wait.cond = cond;
    return wait;
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
        caller = /^    at (.*)$/.exec(stack[4]);
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
    return this.cur_state+(this.next_state ? '->'+this.next_state : ''); };

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
        return etask('then_completed', [function(){ return on_done(); }]);
    var then_wait = etask('then_wait', [function(){ return this.wait(); }]);
    this.then_waiting.push(function(){
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
    return etask('then_err', [function(){
        return !on_err ? E.err(_this.error) : on_err(_this.error);
    }]);
};
Etask_err.prototype.otherwise = Etask_err.prototype.catch = function(on_err){
    return this.then(null, on_err); };
Etask_err.prototype.ensure = function(on_ensure){
    this.then(null, function(){ on_ensure(); });
    return this;
};
E.resolve = function(res){ return etask([function(){ return res; }]); };
E.reject = function(err){ return etask([function(){ throw err; }]); };

E.prototype.wait_ext = function(promise){
    if (!promise || typeof promise.then!='function')
        return promise;
    var wait = this.wait();
    promise.then(wait.continue_fn(), wait.throw_fn());
    return wait;
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
                child = child.concat(et.child_guess);
            for (i = 0; i<child.length; i++)
            {
                task_trail = i<child.length-1 ? '|' : stack_trail;
                child_guess = child[i].parent_guess ? '\\? ' :
                    child[i].parent_type=='call' ? '\\> ' : '\\_ ';
                s += child[i]._ps(pre_next+task_trail+child_guess,
                    pre_next+task_trail+'   ', flags);
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
    var i, s = '', task_trail;
    flags = assign({STACK: 1, RECURSIVE: 1, LIMIT: 10000000, TIME: 1,
        GUESS: 1}, flags, {limit_n: 0});
    ps_flags(flags);
    s += E._longname_root()+'\n';
    var child = E.root;
    if (flags.GUESS)
    {
        child = [];
        for (i=0; i<E.root.length; i++)
        {
            if (!E.root[i].parent_guess)
                child.push(E.root[i]);
        }
    }
    for (i=0; i<child.length; i++)
    {
        task_trail = i<child.length-1 ? '|' : ' ';
        s += child[i]._ps(task_trail+'\\_ ', task_trail+'   ', flags);
    }
    return s;
};

function assert_tree_unique(a){
    var i;
    for (i=0; i<a.length-1; i++)
        assert(!a.includes(a[i], i+1));
}
E.prototype._assert_tree = function(opt){
    var i, et;
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
    for (i=0; i<this.child.length; i++)
    {
        et = this.child[i];
        assert(et.parent===this);
        assert(!et.parent_guess);
        assert(!et.up);
        et._assert_tree(opt);
    }
    if (this.child_guess.length)
        assert(E.in_run.includes(this));
    for (i=0; i<this.child_guess.length; i++)
    {
        et = this.child_guess[i];
        assert(et.parent_guess===this);
        assert(!et.parent);
        assert(!et.up);
    }
};
E._assert_tree = function(opt){
    var i, et, child = E.root;
    opt = opt||{};
    assert_tree_unique(E.root);
    for (i=0; i<child.length; i++)
    {
        et = child[i];
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
        assert(child.includes(this),
            'cannot find in parent '+(this.parent ? '' : 'root'));
    }
    else if (this.parent_guess)
    {
        assert(this.parent_guess.child_guess.includes(this),
            'cannot find in parent_guess');
        assert(E.in_run.includes(this.parent_guess));
    }
};

E.prototype.return_child = function(){
    // copy array, since return() has side affects and can modify array
    var child = Array.from(this.child);
    for (var i=0; i<child.length; i++)
        child[i].return();
};

E.sleep = function(ms){
    var timer;
    ms = ms||0;
    return etask({name: 'sleep', cancel: true}, [function(){
        this.info.ms = ms+'ms';
        timer = setTimeout(this.continue_fn(), ms);
        return this.wait();
    }, function finally$(){
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
        opt = {};
    }
    if (typeof states=='function')
        states = [states];
    opt = opt||{};
    return etask({name: 'for', cancel: true, init: opt.init_parent},
    [function loop(){
        return !cond || cond.call(this);
    }, function try_catch$(res){
        if (!res)
            return this.return();
        return etask({name: 'for_iter', cancel: true, init: opt.init},
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
        return etask({name: 'all_a', cancel: true}, [function(){
            for (j=0; j<a.length; j++)
                this.spawn(a[j]);
        }, function try_catch$loop(){
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
        return etask({name: 'all_o', cancel: true}, [function(){
            for (j=0; j<keys.length; j++)
                this.spawn(a_or_o[keys[j]]);
        }, function try_catch$loop(){
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
    return etask({name: 'all_limit', cancel: true}, [function(){
        var next;
        if (!(next = iter.call(this)))
            return this.goto('done');
        this.spawn(next);
        this.loop();
        if (this.child.length>=limit)
            return this.wait_child('any');
    }, function done(){
        return this.wait_child('all');
    }]);
};

// _apply(opt, func[, _this], args)
// _apply(opt, object, method, args)
E._apply = function(opt, func, _this, args){
    var func_name;
    if (typeof _this=='string') // class with '.method' string call
    {
        assert(_this[0]=='.', 'invalid method '+_this);
        var method = _this.slice(1), _class = func;
        func = _class[method];
        _this = _class;
        assert(_this instanceof Object, 'invalid method .'+method);
        func_name = method;
    }
    else if (Array.isArray(_this) && !args)
    {
        args = _this;
        _this = null;
    }
    opt.name = opt.name||func_name||func.name;
    return etask(opt, [function(){
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
        return etask._apply({name: e_method, nfn: 1}, fn, this, arguments); };
};

E.wait = function(timeout){
    return etask({name: 'wait', cancel: true},
        [function(){ return this.wait(timeout); }]);
};
E.to_nfn = function(promise, cb, opt){
    return etask({name: 'to_nfn', async: true}, [function try_catch$(){
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
    var is_generator = typeof states=='function' &&
        states.constructor.name=='GeneratorFunction';
    return function(){
        var _opt = assign({}, opt);
        _opt.state0_args = Array.from(arguments);
        if (push_this)
            _opt.state0_args.unshift(this);
        if (is_generator)
            return E._generator(null, states, _opt);
        return new Etask(_opt, states);
    };
}
E.fn = function(opt, states){ return etask_fn(opt, states, false); };
E._fn = function(opt, states){ return etask_fn(opt, states, true); };
E._generator = function(gen, ctor, opt){
    opt = opt||{};
    opt.name = opt.name || ctor && ctor.name || 'generator';
    if (opt.cancel===undefined)
        opt.cancel = true;
    var done;
    return new Etask(opt, [function(){
        this.generator = gen = gen||ctor.apply(this, opt.state0_args||[]);
        this.generator_ctor = ctor;
        return {ret: undefined, err: undefined};
    }, function try_catch$loop(rv){
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
        // https://kangax.github.io/compat-table/es6/#test-generators_%GeneratorPrototype%.return
        // .return() supported only in node>=6.x.x
        if (!done && gen && gen.return)
            try { gen.return(); } catch(e){}
    }]);
};
E.ef = function(err){ // error filter
    if (zerr.on_exception)
        zerr.on_exception(err);
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
    if (opt.mode=='fixed')
    {
        return E.for(null, function(){ return etask.sleep(opt.ms); },
            states);
    }
    if (opt.mode=='smart' || !opt.mode)
    {
        var now;
        return E.for(function(){ now = Date.now(); return true; },
            function(){
                var delay = zutil.clamp(0, now+opt.ms-Date.now(), Infinity);
                return etask.sleep(delay);
            }, states);
    }
    if (opt.mode=='spawn')
    {
        var stopped = false;
        return etask([function loop(){
            etask([function try_catch$(){
                return etask(states);
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
            return etask.sleep(opt.ms);
        }, function(){
            if (stopped) // stopped during sleep by prev long iteration
                return this.return();
            return this.goto('loop');
        }]);
    }
    throw new Error('unexpected mode '+opt.mode);
};
E._class = function(cls){
    var proto = cls.prototype, keys = Object.getOwnPropertyNames(proto);
    for (var i=0; i<keys.length; i++)
    {
        var key = keys[i];
        var p = proto[key];
        if (p && p.constructor && p.constructor.name=='GeneratorFunction')
            proto[key] = E._fn(p);
    }
    return cls;
};
E.shutdown = function(){
    var prev;
    while (E.root.length)
    {
        var e = E.root[0];
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

return Etask; }); }());
