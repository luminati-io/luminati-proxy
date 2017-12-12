webpackJsonp([1],Array(19).concat([
/* 19 */
/***/ (function(module, exports, __webpack_require__) {

var __WEBPACK_AMD_DEFINE_ARRAY__, __WEBPACK_AMD_DEFINE_RESULT__;
var module;
// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, browser:true*/
(function(){
var  process, zerr, assert;
var is_node = typeof module=='object' && module.exports && module.children;
var is_ff_addon = typeof module=='object' && module.uri
    && !module.uri.indexOf('resource://');
if (!is_node)
{
    if (is_ff_addon)
        ;
    else
        ;
    process = {
        nextTick: function(fn){ setTimeout(fn, 0); },
        env: {},
    };
    assert = function(){}; // XXX romank: add proper assert
    // XXX romank: use zerr.js
    // XXX bahaa: require bext/pub/zerr.js for extensions
    if (!is_ff_addon && self.hola && self.hola.zerr)
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
    ;
}
// XXX yuval: /util/events.js -> events when node 6 (support prependListener)
// is here
!(__WEBPACK_AMD_DEFINE_ARRAY__ = [__webpack_require__(470), __webpack_require__(143), __webpack_require__(233)], __WEBPACK_AMD_DEFINE_RESULT__ = function(events, array, zutil){
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
var cb_pre, cb_post, longcb_ms, perf_enable;
E.perf_stat = {};
function _cb_pre(et){ return {start: Date.now()}; }
function _cb_post(et, ctx){
    var ms = Date.now()-ctx.start;
    if (longcb_ms && ms>longcb_ms)
    {
        zerr('long cb '+ms+'ms: '+et.get_name()+', '
            +et.run_state.f.toString().slice(0, 128));
    }
    if (perf_enable)
    {
        var name = et.get_name();
        var perf = E.perf_stat[name]||(E.perf_stat[name] = {ms: 0, n: 0});
        perf.ms += ms;
        perf.n++;
    }
}
function cb_set(){
    if (longcb_ms || perf_enable)
    {
        cb_pre = _cb_pre;
        cb_post = _cb_post;
    }
    else
        cb_pre = cb_post = undefined;
}
E.longcb = function(ms){
    longcb_ms = ms;
    cb_set();
};
E.perf = function(enable){
    perf_enable = enable;
    cb_set();
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
    opt = (typeof opt=='string' && {name: opt})||opt||{};
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
        this.then_waiting.pop()();
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
        return;
    }
    if (!replace && child.parent)
        assert(0, 'child already has a parent\n'+child.parent.ps());
    child.spawn_parent(this);
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
    this.prependListener('finally', cb);
};
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
    this._next_run(E._res2rv(res));
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
    return (v instanceof Etask && v.error!==undefined) ||
        v instanceof Etask_err;
};
E.err_res = function(err, res){ return err ? E.err(err) : res; };
E._res2rv = function(res){
    return E.is_err(res) ? {ret: undefined, err: res.error}
        : {ret: res, err: undefined};
};
E.is_final = function(v){
    return !v || typeof v.then!='function' || v instanceof Etask_err ||
        (v instanceof Etask && !!v.tm_completed);
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
    else
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
    var _opt = {nfn: 1};
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
    return function(){
        var _opt = assign({}, opt);
        _opt.state0_args = Array.from(arguments);
        if (push_this)
            _opt.state0_args.unshift(this);
        return etask(_opt, states);
    };
}
E.fn = function(opt, states){ return etask_fn(opt, states, false); };
E._fn = function(opt, states){ return etask_fn(opt, states, true); };
E._generator = function(gen, ctor, opt){
    opt = opt||{};
    opt.name = opt.name||(ctor && ctor.name)||'generator';
    if (opt.cancel===undefined)
        opt.cancel = true;
    var done;
    return etask(opt, [function(){
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
        if (!done && gen.return)
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

return Etask; }.apply(exports, __WEBPACK_AMD_DEFINE_ARRAY__),
				__WEBPACK_AMD_DEFINE_RESULT__ !== undefined && (module.exports = __WEBPACK_AMD_DEFINE_RESULT__)); }());


/***/ }),
/* 20 */,
/* 21 */,
/* 22 */,
/* 23 */,
/* 24 */
/***/ (function(module, exports) {

/**
 * Checks if `value` is classified as an `Array` object.
 *
 * @static
 * @memberOf _
 * @since 0.1.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an array, else `false`.
 * @example
 *
 * _.isArray([1, 2, 3]);
 * // => true
 *
 * _.isArray(document.body.children);
 * // => false
 *
 * _.isArray('abc');
 * // => false
 *
 * _.isArray(_.noop);
 * // => false
 */
var isArray = Array.isArray;

module.exports = isArray;


/***/ }),
/* 25 */,
/* 26 */,
/* 27 */,
/* 28 */,
/* 29 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
// LICENSE_CODE ZON ISC
 /*jslint browser:true, es6:true*/

Object.defineProperty(exports, "__esModule", {
    value: true
});
var E = {};

E.bytes_format = function (bytes, precision) {
    if (!bytes || isNaN(parseFloat(bytes)) || !isFinite(bytes)) return '';
    var number = Math.floor(Math.log(bytes) / Math.log(1000));
    if (typeof precision === 'undefined') precision = number ? 2 : 0;
    var number_format = Intl.NumberFormat('en-US', { maximumFractionDigits: precision });
    return number_format.format(bytes / Math.pow(1000, Math.floor(number))) + ' ' + ['B', 'KB', 'MB', 'GB', 'TB', 'PB'][number];
};

var ga = void 0;
E.init_ga = function (_ga) {
    return ga = _ga;
};

E.ga_event = function (category, action, label) {
    return ga && ga.trackEvent(category, action, label, undefined, undefined, { transport: 'beacon' });
};

exports.default = E;

/***/ }),
/* 30 */,
/* 31 */
/***/ (function(module, exports, __webpack_require__) {

var freeGlobal = __webpack_require__(272);

/** Detect free variable `self`. */
var freeSelf = typeof self == 'object' && self && self.Object === Object && self;

/** Used as a reference to the global object. */
var root = freeGlobal || freeSelf || Function('return this')();

module.exports = root;


/***/ }),
/* 32 */,
/* 33 */,
/* 34 */,
/* 35 */,
/* 36 */,
/* 37 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
// LICENSE_CODE ZON ISC
 /*jslint react:true*/

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.combine_presets = exports.onboarding_steps = exports.Loader = exports.Modal = exports.If = exports.Code = exports.Dialog = undefined;

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _lodash = __webpack_require__(32);

var _lodash2 = _interopRequireDefault(_lodash);

var _jquery = __webpack_require__(13);

var _jquery2 = _interopRequireDefault(_jquery);

var _classnames = __webpack_require__(5);

var _classnames2 = _interopRequireDefault(_classnames);

var _react = __webpack_require__(0);

var _react2 = _interopRequireDefault(_react);

var _reactBootstrap = __webpack_require__(25);

var Bootstrap = _interopRequireWildcard(_reactBootstrap);

var _regeneratorRuntime = __webpack_require__(20);

var _regeneratorRuntime2 = _interopRequireDefault(_regeneratorRuntime);

var _etask = __webpack_require__(19);

var _etask2 = _interopRequireDefault(_etask);

var _ajax = __webpack_require__(102);

var _ajax2 = _interopRequireDefault(_ajax);

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var Dialog = function (_React$Component) {
    _inherits(Dialog, _React$Component);

    function Dialog() {
        _classCallCheck(this, Dialog);

        return _possibleConstructorReturn(this, (Dialog.__proto__ || Object.getPrototypeOf(Dialog)).apply(this, arguments));
    }

    _createClass(Dialog, [{
        key: 'render',
        value: function render() {
            return _react2.default.createElement(
                Bootstrap.Modal,
                _lodash2.default.omit(this.props, ['title', 'footer', 'children']),
                _react2.default.createElement(
                    Bootstrap.Modal.Header,
                    { closeButton: true },
                    _react2.default.createElement(
                        Bootstrap.Modal.Title,
                        null,
                        this.props.title
                    )
                ),
                _react2.default.createElement(
                    Bootstrap.Modal.Body,
                    null,
                    this.props.children
                ),
                _react2.default.createElement(
                    Bootstrap.Modal.Footer,
                    null,
                    this.props.footer
                )
            );
        }
    }]);

    return Dialog;
}(_react2.default.Component);

var Modal = function (_React$Component2) {
    _inherits(Modal, _React$Component2);

    function Modal() {
        _classCallCheck(this, Modal);

        return _possibleConstructorReturn(this, (Modal.__proto__ || Object.getPrototypeOf(Modal)).apply(this, arguments));
    }

    _createClass(Modal, [{
        key: 'click_cancel',
        value: function click_cancel() {
            (0, _jquery2.default)('#' + this.props.id).modal('hide');
        }
    }, {
        key: 'click_ok',
        value: function click_ok() {
            var _this = this;
            (0, _etask2.default)( /*#__PURE__*/_regeneratorRuntime2.default.mark(function _callee() {
                return _regeneratorRuntime2.default.wrap(function _callee$(_context) {
                    while (1) {
                        switch (_context.prev = _context.next) {
                            case 0:
                                _this.click_cancel();

                                if (!_this.props.click_ok) {
                                    _context.next = 4;
                                    break;
                                }

                                _context.next = 4;
                                return _this.props.click_ok();

                            case 4:
                            case 'end':
                                return _context.stop();
                        }
                    }
                }, _callee, this);
            }));
        }
    }, {
        key: 'render',
        value: function render() {
            var footer = this.props.footer || _react2.default.createElement(Footer_default, { cancel_clicked: this.click_cancel.bind(this),
                ok_clicked: this.click_ok.bind(this),
                no_cancel_btn: this.props.no_cancel_btn });
            return _react2.default.createElement(
                'div',
                { id: this.props.id, tabIndex: '-1',
                    className: (0, _classnames2.default)('modal', 'fade', this.props.className) },
                _react2.default.createElement(
                    'div',
                    { className: 'modal-dialog' },
                    _react2.default.createElement(
                        'div',
                        { className: 'modal-content' },
                        _react2.default.createElement(
                            'div',
                            { className: 'modal-header' },
                            _react2.default.createElement('button', { className: 'close close_icon', 'data-dismiss': 'modal',
                                'aria-label': 'Close' }),
                            _react2.default.createElement(
                                'h4',
                                { className: 'modal-title' },
                                this.props.title
                            )
                        ),
                        _react2.default.createElement(
                            'div',
                            { className: 'modal-body' },
                            this.props.children
                        ),
                        _react2.default.createElement(
                            'div',
                            { className: 'modal-footer' },
                            footer
                        )
                    )
                )
            );
        }
    }]);

    return Modal;
}(_react2.default.Component);

var Footer_default = function Footer_default(props) {
    return _react2.default.createElement(
        'div',
        { className: 'default_footer' },
        _react2.default.createElement(
            If,
            { when: !props.no_cancel_btn },
            _react2.default.createElement(
                'button',
                { onClick: props.cancel_clicked,
                    className: 'btn btn_lpm btn_lpm_default cancel' },
                'Cancel'
            )
        ),
        _react2.default.createElement(
            'button',
            { onClick: props.ok_clicked, className: 'btn btn_lpm ok' },
            'OK'
        )
    );
};

var Loader = function Loader(_ref) {
    var show = _ref.show;
    return _react2.default.createElement(
        If,
        { when: show },
        _react2.default.createElement(
            'div',
            { className: 'loader_wrapper' },
            _react2.default.createElement('div', { className: 'mask' }),
            _react2.default.createElement(
                'div',
                { className: 'loader' },
                _react2.default.createElement('div', { className: 'spinner' })
            )
        )
    );
};

var Code = function Code(props) {
    var copy = function copy() {
        if (props.on_click) props.on_click();
        var area = document.querySelector('#copy_' + props.id + '>textarea');
        var source = document.querySelector('#copy_' + props.id + '>.source');
        area.value = source.innerText;
        area.select();
        try {
            document.execCommand('copy');
        } catch (e) {
            console.log('Oops, unable to copy');
        }
    };
    var value = props.children.innerText ? props.children.innerText() : props.children;
    return _react2.default.createElement(
        'code',
        { id: 'copy_' + props.id },
        _react2.default.createElement(
            'span',
            { className: 'source' },
            props.children
        ),
        _react2.default.createElement('textarea', { defaultValue: value,
            style: { position: 'fixed', top: '-1000px' } }),
        _react2.default.createElement(
            'button',
            { onClick: copy,
                className: 'btn btn_lpm btn_lpm_default btn_copy' },
            'Copy'
        )
    );
};

var If = function If(_ref2) {
    var when = _ref2.when,
        children = _ref2.children;
    return when ? children : null;
};

var onboarding_steps = {
    WELCOME: 0,
    ADD_PROXY: 1,
    ADD_PROXY_DONE: 2,
    HOWTO: 3,
    HOWTO_DONE: 4
};

var presets = {
    session_long: {
        title: 'Long single session (IP)',
        subtitle: 'All requests share the same long session (IP) For\n            connecting a browser to Luminati, maintaining the same IP for as\n            long as possible',
        check: function check(opt) {
            return !opt.pool_size && !opt.sticky_ipo && opt.session === true && opt.keep_alive;
        },
        set: function set(opt) {
            opt.pool_size = 0;
            opt.ips = [];
            opt.keep_alive = opt.keep_alive || 50;
            opt.pool_type = undefined;
            opt.sticky_ip = false;
            opt.session = true;
            if (opt.session === true) opt.seed = false;
        },
        // XXX krzysztof: find a better, more generic way for rules messages
        rules: [{ field: 'pool_size', label: 'sets \'Pool size\' to 0' }, { field: 'keep_alive', label: 'sets \'Keep-alive\' to 50 seconds' }, { field: 'pool_type', label: 'sequential pool type' }, { field: 'sticky_ip', label: 'disables \'Sticky Ip\'' }, { field: 'session', label: 'enables \'Random Session\'' }, { field: 'seed', label: 'disables \'Session ID Seed\'' }],
        support: {
            keep_alive: true,
            multiply: true,
            session_ducation: true,
            max_requests: true
        }
    },
    session: {
        title: 'Single session (IP)',
        subtitle: 'All requests share the same active session (IP) For\n            connecting a single app/browser that does not need to maintain IP\n            on idle times',
        check: function check(opt) {
            return !opt.pool_size && !opt.sticky_ip && opt.session === true && !opt.keep_alive;
        },
        set: function set(opt) {
            opt.pool_size = 0;
            opt.ips = [];
            opt.keep_alive = 0;
            opt.pool_type = undefined;
            opt.sticky_ip = false;
            opt.session = true;
            if (opt.session === true) opt.seed = false;
        },
        rules: [{ field: 'pool_size', label: 'sets \'Pool size\' to 0' }, { field: 'keep_alive', label: 'sets \'Keep-alive\' to 0 seconds' }, { field: 'pool_type', label: 'sequential pool type' }, { field: 'sticky_ip', label: 'disables \'Sticky Ip\'' }, { field: 'session', label: 'enables \'Random Session\'' }, { field: 'seed', label: 'disables \'Session ID Seed\'' }],
        support: {
            multiply: true,
            session_duration: true,
            max_requests: true
        }
    },
    sticky_ip: {
        title: 'Session (IP) per machine',
        subtitle: 'Each requesting machine will have its own session (IP)\n            For connecting several computers to a single Luminati Proxy\n            Manager, each of them having its own single session (IP)',
        check: function check(opt) {
            return !opt.pool_size && opt.sticky_ip;
        },
        set: function set(opt) {
            opt.pool_size = 0;
            opt.ips = [];
            opt.pool_type = undefined;
            opt.sticky_ip = true;
            opt.session = undefined;
            opt.multiply = undefined;
        },
        rules: [{ field: 'pool_size', label: 'sets \'Pool size\' to 0' }, { field: 'pool_type', label: 'sequential pool type' }, { field: 'sticky_ip', label: 'enables \'Sticky Ip\'' }, { field: 'session', label: 'disables \'Random Session\'' }, { field: 'multiply', label: 'disables \'Multiply\' option' }],
        support: {
            keep_alive: true,
            max_requests: true,
            session_duration: true,
            seed: true
        }
    },
    sequential: {
        title: 'Sequential session (IP) pool',
        subtitle: 'Sequential pool of pre-established of sessions (IPs) For\n            running groups of requests sharing the same IP to a target site\n            Use refresh_sessions max_requests & session_duration to control\n            session (IP) switching',
        check: function check(opt) {
            return opt.pool_size && (!opt.pool_type || opt.pool_type == 'sequential');
        },
        set: function set(opt) {
            opt.pool_size = opt.pool_size || 1;
            opt.pool_type = 'sequential';
            opt.sticky_ip = undefined;
            opt.session = undefined;
        },
        rules: [{ field: 'pool_size', label: 'sets \'Pool size\' to 1' }, { field: 'pool_type', label: 'sequential pool type' }, { field: 'sticky_ip', label: 'disables \'Sticky Ip\'' }, { field: 'session', label: 'disables \'Random Session\'' }],
        support: {
            pool_size: true,
            keep_alive: true,
            max_requests: true,
            session_duration: true,
            multiply: true,
            seed: true
        }
    },
    round_robin: {
        title: 'Round-robin (IP) pool',
        subtitle: 'Round-robin pool of pre-established sessions (IPs) For\n            spreading requests across large number of IPs Tweak pool_size,\n            max_requests & proxy_count to optimize performance',
        check: function check(opt) {
            return opt.pool_size && opt.pool_type == 'round-robin' && !opt.multiply;
        },
        set: function set(opt) {
            opt.pool_size = opt.pool_size || 1;
            opt.pool_type = 'round-robin';
            opt.sticky_ip = undefined;
            opt.session = undefined;
            opt.multiply = undefined;
        },
        rules: [{ field: 'pool_size', label: 'sets \'Pool size\' to 1' }, { field: 'pool_type', label: 'round-robin pool type' }, { field: 'sticky_ip', label: 'disables \'Sticky Ip\'' }, { field: 'session', label: 'disables \'Random Session\'' }, { field: 'multiply', label: 'disables \'Multiply\' options' }],
        support: {
            pool_size: true,
            keep_alive: true,
            max_requests: true,
            session_duration: true,
            seed: true
        }
    },
    custom: {
        title: 'Custom',
        subtitle: 'Manually adjust all settings to your needs For advanced\n            use cases',
        check: function check(opt) {
            return true;
        },
        set: function set(opt) {},
        support: {
            session: true,
            sticky_ip: true,
            pool_size: true,
            pool_type: true,
            keep_alive: true,
            max_requests: true,
            session_duration: true,
            multiply: true,
            seed: true
        }
    }
};
for (var k in presets) {
    if (!presets[k].clean) presets[k].clean = function (opt) {
        return opt;
    };
    presets[k].key = k;
}

var combine_presets = function combine_presets(data) {
    var www_presets = (data.presets || []).reduce(function (prs, np) {
        var set = _lodash2.default.cloneDeep(np.set);
        var clean = _lodash2.default.cloneDeep(np.clean);
        np.set = function (opt) {
            return Object.assign(opt, set);
        };
        np.clean = function (opt) {
            return Object.assign(opt, clean);
        };
        np.check = function () {
            return true;
        };
        prs[np.key] = np;
        return prs;
    }, _lodash2.default.cloneDeep(presets));
    return www_presets;
};

exports.Dialog = Dialog;
exports.Code = Code;
exports.If = If;
exports.Modal = Modal;
exports.Loader = Loader;
exports.onboarding_steps = onboarding_steps;
exports.combine_presets = combine_presets;

/***/ }),
/* 38 */,
/* 39 */,
/* 40 */,
/* 41 */,
/* 42 */,
/* 43 */,
/* 44 */,
/* 45 */,
/* 46 */,
/* 47 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
// LICENSE_CODE ZON ISC
 /*jslint react:true*/

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _regeneratorRuntime = __webpack_require__(20);

var _regeneratorRuntime2 = _interopRequireDefault(_regeneratorRuntime);

var _lodash = __webpack_require__(32);

var _lodash2 = _interopRequireDefault(_lodash);

var _moment = __webpack_require__(114);

var _moment2 = _interopRequireDefault(_moment);

var _react = __webpack_require__(0);

var _react2 = _interopRequireDefault(_react);

var _reactBootstrap = __webpack_require__(25);

var _axios = __webpack_require__(144);

var _axios2 = _interopRequireDefault(_axios);

var _etask = __webpack_require__(19);

var _etask2 = _interopRequireDefault(_etask);

var _util = __webpack_require__(29);

var _util2 = _interopRequireDefault(_util);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var StatTable = function (_React$Component) {
    _inherits(StatTable, _React$Component);

    function StatTable() {
        _classCallCheck(this, StatTable);

        return _possibleConstructorReturn(this, (StatTable.__proto__ || Object.getPrototypeOf(StatTable)).apply(this, arguments));
    }

    _createClass(StatTable, [{
        key: 'render',
        value: function render() {
            var _this3 = this;

            var Row = this.props.row;
            return _react2.default.createElement(
                'div',
                null,
                _react2.default.createElement(
                    'h4',
                    null,
                    this.props.title,
                    this.props.show_more && _react2.default.createElement(
                        'small',
                        null,
                        '\xA0',
                        _react2.default.createElement(
                            'a',
                            { href: this.props.path },
                            'show all'
                        )
                    )
                ),
                _react2.default.createElement(
                    _reactBootstrap.Table,
                    { hover: true, condensed: true },
                    _react2.default.createElement(
                        'thead',
                        null,
                        this.props.children
                    ),
                    _react2.default.createElement(
                        'tbody',
                        null,
                        this.props.stats.map(function (s) {
                            return _react2.default.createElement(Row, _extends({ stat: s, key: s[_this3.props.row_key || 'key'],
                                path: _this3.props.path, go: _this3.props.go
                            }, _this3.props.row_opts || {}));
                        })
                    )
                )
            );
        }
    }]);

    return StatTable;
}(_react2.default.Component);

var StatsService = function StatsService() {
    _classCallCheck(this, StatsService);
};

StatsService.base = '/api/request_stats';
StatsService.get_top = _etask2.default._fn( /*#__PURE__*/_regeneratorRuntime2.default.mark(function _callee(_this) {
    var opt = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

    var res, assign, state, _arr, _i, k;

    return _regeneratorRuntime2.default.wrap(function _callee$(_context) {
        while (1) {
            switch (_context.prev = _context.next) {
                case 0:
                    _context.next = 2;
                    return _this.get('top');

                case 2:
                    res = _context.sent;
                    assign = Object.assign;

                    opt = assign({ reverse: true }, opt);
                    state = _lodash2.default.reduce(res, function (s, v, k) {
                        if (_lodash2.default.isInteger(+k)) return s.statuses.stats.push(assign({ status_code: k,
                            value: v.count, bw: v.bw }, v)) && s;
                        if (['http', 'https'].includes(k)) {
                            return s.protocols.stats.push(assign({ protocol: k, bw: v.bw,
                                value: v.count }, v)) && s;
                        }
                        return s.domains.stats.push(assign({ hostname: k, value: v.count,
                            bw: v.bw }, v)) && s;
                    }, { statuses: { stats: [] }, domains: { stats: [] },
                        protocols: { stats: [] } });

                    if (!state.protocols.stats.some(_lodash2.default.matches({ protocol: 'https' }))) state.protocols.stats.push({ protocol: 'https', bw: 0, value: 0 });
                    if (opt.sort || opt.limit) {
                        _arr = ['statuses', 'domains', 'protocols'];

                        for (_i = 0; _i < _arr.length; _i++) {
                            k = _arr[_i];

                            state[k] = {
                                has_more: state[k].stats.length > (opt.limit || Infinity),
                                stats: (0, _lodash2.default)(state[k].stats)
                            };
                            if (opt.sort) {
                                state[k].stats = state[k].stats.sortBy(_lodash2.default.isString(opt.sort) && opt.sort || 'value');
                            }
                            if (opt.limit) {
                                state[k].stats = state[k].stats['take' + (opt.reverse && 'Right' || '')](opt.limit);
                            }
                            if (opt.reverse) state[k].stats = state[k].stats.reverse();
                            state[k].stats = state[k].stats.value();
                        }
                    }
                    return _context.abrupt('return', state);

                case 9:
                case 'end':
                    return _context.stop();
            }
        }
    }, _callee, this);
}));
StatsService.get_all = _etask2.default._fn( /*#__PURE__*/_regeneratorRuntime2.default.mark(function _callee2(_this) {
    var opt = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
    var res;
    return _regeneratorRuntime2.default.wrap(function _callee2$(_context2) {
        while (1) {
            switch (_context2.prev = _context2.next) {
                case 0:
                    opt = Object.assign({ reverse: 1 }, opt);
                    _context2.next = 3;
                    return _this.get('all');

                case 3:
                    res = _context2.sent;

                    if (opt.by) {
                        res = (0, _lodash2.default)(Object.values(res.reduce(function (s, v, k) {
                            var c = v[opt.by];
                            s[c] = s[c] || Object.assign({ value: 0, bw: 0 }, v);
                            s[c].value += 1;
                            s[c].bw += v.bw;
                            return s;
                        }, {})));
                    } else res = (0, _lodash2.default)(res);
                    if (opt.sort) res = res.sortBy(_lodash2.default.isString(opt.sort) && opt.sort || 'value');
                    if (opt.reverse) res = res.reverse();
                    return _context2.abrupt('return', res.value());

                case 8:
                case 'end':
                    return _context2.stop();
            }
        }
    }, _callee2, this);
}));
StatsService.reset = _etask2.default._fn( /*#__PURE__*/_regeneratorRuntime2.default.mark(function _callee3(_this) {
    return _regeneratorRuntime2.default.wrap(function _callee3$(_context3) {
        while (1) {
            switch (_context3.prev = _context3.next) {
                case 0:
                    _context3.next = 2;
                    return _this.get('reset');

                case 2:
                    return _context3.abrupt('return', _context3.sent);

                case 3:
                case 'end':
                    return _context3.stop();
            }
        }
    }, _callee3, this);
}));
StatsService.get = _etask2.default._fn( /*#__PURE__*/_regeneratorRuntime2.default.mark(function _callee4(_, stats) {
    var res;
    return _regeneratorRuntime2.default.wrap(function _callee4$(_context4) {
        while (1) {
            switch (_context4.prev = _context4.next) {
                case 0:
                    _context4.next = 2;
                    return (0, _etask2.default)(function () {
                        return _axios2.default.get(StatsService.base + '/' + stats);
                    });

                case 2:
                    res = _context4.sent;
                    return _context4.abrupt('return', res.data[stats]);

                case 4:
                case 'end':
                    return _context4.stop();
            }
        }
    }, _callee4, this);
}));

var StatsDetails = function (_React$Component2) {
    _inherits(StatsDetails, _React$Component2);

    function StatsDetails(props) {
        _classCallCheck(this, StatsDetails);

        var _this4 = _possibleConstructorReturn(this, (StatsDetails.__proto__ || Object.getPrototypeOf(StatsDetails)).call(this, props));

        _this4.page_change = function (page) {
            return _this4.paginate(page - 1);
        };

        _this4.state = {
            stats: [],
            all_stats: props.stats || [],
            cur_page: 0,
            items_per_page: props.items_per_page || 10
        };
        return _this4;
    }

    _createClass(StatsDetails, [{
        key: 'componentWillReceiveProps',
        value: function componentWillReceiveProps(props) {
            var _this5 = this;

            var update = {};
            if (props.items_per_page != this.props.items_per_page) Object.assign(update, { items_per_page: props.items_per_page });
            if (props.stats != this.props.stats) Object.assign(update, { all_stats: props.stats });
            if (Object.keys(update).length) this.setState(update, function () {
                return _this5.paginate();
            });
        }
    }, {
        key: 'componentDidMount',
        value: function componentDidMount() {
            this.paginate();
        }
    }, {
        key: 'paginate',
        value: function paginate() {
            var page = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : -1;

            page = page > -1 ? page : this.state.cur_page;
            var stats = this.state.all_stats;
            var cur_page = _lodash2.default.min([Math.ceil(stats.length / this.state.items_per_page), page]);
            this.setState({
                stats: stats.slice(cur_page * this.state.items_per_page, (cur_page + 1) * this.state.items_per_page),
                cur_page: cur_page
            });
        }
    }, {
        key: 'render_headers',
        value: function render_headers() {
            var headers = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

            var hds = Object.keys(headers).map(function (h) {
                return _react2.default.createElement(
                    'div',
                    { className: 'request_headers_header', key: h },
                    h,
                    ': ',
                    headers[h]
                );
            });
            return _react2.default.createElement(
                'div',
                { className: 'request_headers' },
                hds
            );
        }
    }, {
        key: 'render',
        value: function render() {
            var _this6 = this;

            var pagination = null;
            if (this.state.all_stats.length > this.state.items_per_page) {
                var next = false;
                var pages = Math.ceil(this.state.all_stats.length / this.state.items_per_page);
                if (this.state.cur_page + 1 < pages) next = 'Next';
                pagination = _react2.default.createElement(_reactBootstrap.Pagination, { next: next, boundaryLinks: true,
                    activePage: this.state.cur_page + 1,
                    bsSize: 'small', onSelect: this.page_change,
                    items: pages, maxButtons: 5 });
            }
            return _react2.default.createElement(
                'div',
                null,
                _react2.default.createElement(
                    'div',
                    { className: 'page-header' },
                    _react2.default.createElement(
                        'h3',
                        null,
                        this.props.header
                    )
                ),
                _react2.default.createElement(
                    'div',
                    null,
                    this.props.title,
                    _react2.default.createElement(
                        'h3',
                        null,
                        'Requests'
                    ),
                    _react2.default.createElement(
                        _reactBootstrap.Table,
                        { hover: true, className: 'table-consolidate' },
                        _react2.default.createElement(
                            'thead',
                            null,
                            _react2.default.createElement(
                                'tr',
                                null,
                                _react2.default.createElement(
                                    'th',
                                    { className: 'col-sm-6' },
                                    'URL'
                                ),
                                _react2.default.createElement(
                                    'th',
                                    null,
                                    'Bandwidth'
                                ),
                                _react2.default.createElement(
                                    'th',
                                    null,
                                    'Response time'
                                ),
                                _react2.default.createElement(
                                    'th',
                                    null,
                                    'Date'
                                ),
                                _react2.default.createElement(
                                    'th',
                                    null,
                                    'IP used'
                                )
                            )
                        ),
                        _react2.default.createElement(
                            'tbody',
                            null,
                            this.state.stats.map(function (s, i) {
                                var rh = JSON.parse(s.response_headers);
                                var local = (0, _moment2.default)(rh.date).format('YYYY-MM-DD HH:mm:ss');
                                return _react2.default.createElement(
                                    'tr',
                                    { key: i },
                                    _react2.default.createElement(
                                        'td',
                                        null,
                                        s.url,
                                        _this6.render_headers(JSON.parse(s.request_headers))
                                    ),
                                    _react2.default.createElement(
                                        'td',
                                        null,
                                        _util2.default.bytes_format(s.bw)
                                    ),
                                    _react2.default.createElement(
                                        'td',
                                        null,
                                        s.response_time,
                                        ' ms'
                                    ),
                                    _react2.default.createElement(
                                        'td',
                                        null,
                                        local
                                    ),
                                    _react2.default.createElement(
                                        'td',
                                        null,
                                        s.proxy_peer
                                    )
                                );
                            })
                        ),
                        _react2.default.createElement(
                            'tfoot',
                            null,
                            _react2.default.createElement(
                                'tr',
                                null,
                                _react2.default.createElement(
                                    'td',
                                    { colSpan: 5 },
                                    pagination
                                )
                            )
                        )
                    ),
                    this.props.children
                )
            );
        }
    }]);

    return StatsDetails;
}(_react2.default.Component);

exports.default = { StatsDetails: StatsDetails, StatTable: StatTable, StatsService: StatsService };

/***/ }),
/* 48 */,
/* 49 */,
/* 50 */
/***/ (function(module, exports) {

/**
 * Checks if `value` is the
 * [language type](http://www.ecma-international.org/ecma-262/7.0/#sec-ecmascript-language-types)
 * of `Object`. (e.g. arrays, functions, objects, regexes, `new Number(0)`, and `new String('')`)
 *
 * @static
 * @memberOf _
 * @since 0.1.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an object, else `false`.
 * @example
 *
 * _.isObject({});
 * // => true
 *
 * _.isObject([1, 2, 3]);
 * // => true
 *
 * _.isObject(_.noop);
 * // => true
 *
 * _.isObject(null);
 * // => false
 */
function isObject(value) {
  var type = typeof value;
  return value != null && (type == 'object' || type == 'function');
}

module.exports = isObject;


/***/ }),
/* 51 */
/***/ (function(module, exports, __webpack_require__) {

var Symbol = __webpack_require__(81),
    getRawTag = __webpack_require__(547),
    objectToString = __webpack_require__(548);

/** `Object#toString` result references. */
var nullTag = '[object Null]',
    undefinedTag = '[object Undefined]';

/** Built-in value references. */
var symToStringTag = Symbol ? Symbol.toStringTag : undefined;

/**
 * The base implementation of `getTag` without fallbacks for buggy environments.
 *
 * @private
 * @param {*} value The value to query.
 * @returns {string} Returns the `toStringTag`.
 */
function baseGetTag(value) {
  if (value == null) {
    return value === undefined ? undefinedTag : nullTag;
  }
  return (symToStringTag && symToStringTag in Object(value))
    ? getRawTag(value)
    : objectToString(value);
}

module.exports = baseGetTag;


/***/ }),
/* 52 */
/***/ (function(module, exports) {

/**
 * Checks if `value` is object-like. A value is object-like if it's not `null`
 * and has a `typeof` result of "object".
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is object-like, else `false`.
 * @example
 *
 * _.isObjectLike({});
 * // => true
 *
 * _.isObjectLike([1, 2, 3]);
 * // => true
 *
 * _.isObjectLike(_.noop);
 * // => false
 *
 * _.isObjectLike(null);
 * // => false
 */
function isObjectLike(value) {
  return value != null && typeof value == 'object';
}

module.exports = isObjectLike;


/***/ }),
/* 53 */
/***/ (function(module, exports, __webpack_require__) {

var baseIsNative = __webpack_require__(561),
    getValue = __webpack_require__(564);

/**
 * Gets the native function at `key` of `object`.
 *
 * @private
 * @param {Object} object The object to query.
 * @param {string} key The key of the method to get.
 * @returns {*} Returns the function if it's native, else `undefined`.
 */
function getNative(object, key) {
  var value = getValue(object, key);
  return baseIsNative(value) ? value : undefined;
}

module.exports = getNative;


/***/ }),
/* 54 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.warn = exports.stripDiacritics = exports.scrollIntoViewIfNeeded = exports.pluralize = exports.getTruncatedOptions = exports.getOptionLabel = exports.getInputText = exports.getHintText = exports.getDisplayName = exports.getAccessibilityStatus = exports.defaultFilterBy = exports.addCustomOption = undefined;

var _addCustomOption2 = __webpack_require__(612);

var _addCustomOption3 = _interopRequireDefault(_addCustomOption2);

var _defaultFilterBy2 = __webpack_require__(617);

var _defaultFilterBy3 = _interopRequireDefault(_defaultFilterBy2);

var _getAccessibilityStatus2 = __webpack_require__(641);

var _getAccessibilityStatus3 = _interopRequireDefault(_getAccessibilityStatus2);

var _getDisplayName2 = __webpack_require__(642);

var _getDisplayName3 = _interopRequireDefault(_getDisplayName2);

var _getHintText2 = __webpack_require__(643);

var _getHintText3 = _interopRequireDefault(_getHintText2);

var _getInputText2 = __webpack_require__(644);

var _getInputText3 = _interopRequireDefault(_getInputText2);

var _getOptionLabel2 = __webpack_require__(110);

var _getOptionLabel3 = _interopRequireDefault(_getOptionLabel2);

var _getTruncatedOptions2 = __webpack_require__(645);

var _getTruncatedOptions3 = _interopRequireDefault(_getTruncatedOptions2);

var _pluralize2 = __webpack_require__(646);

var _pluralize3 = _interopRequireDefault(_pluralize2);

var _scrollIntoViewIfNeeded2 = __webpack_require__(647);

var _scrollIntoViewIfNeeded3 = _interopRequireDefault(_scrollIntoViewIfNeeded2);

var _stripDiacritics2 = __webpack_require__(112);

var _stripDiacritics3 = _interopRequireDefault(_stripDiacritics2);

var _warn2 = __webpack_require__(55);

var _warn3 = _interopRequireDefault(_warn2);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

exports.addCustomOption = _addCustomOption3.default; /* eslint-disable object-curly-spacing */

exports.defaultFilterBy = _defaultFilterBy3.default;
exports.getAccessibilityStatus = _getAccessibilityStatus3.default;
exports.getDisplayName = _getDisplayName3.default;
exports.getHintText = _getHintText3.default;
exports.getInputText = _getInputText3.default;
exports.getOptionLabel = _getOptionLabel3.default;
exports.getTruncatedOptions = _getTruncatedOptions3.default;
exports.pluralize = _pluralize3.default;
exports.scrollIntoViewIfNeeded = _scrollIntoViewIfNeeded3.default;
exports.stripDiacritics = _stripDiacritics3.default;
exports.warn = _warn3.default;
/* eslint-enable object-curly-spacing */

/***/ }),
/* 55 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = warn;
exports._resetWarned = _resetWarned;

var _warning = __webpack_require__(21);

var _warning2 = _interopRequireDefault(_warning);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var warned = {}; /**
                  * This code is copied from: https://github.com/ReactTraining/react-router/blob/master/modules/routerWarning.js
                  */

function warn(falseToWarn, message) {
  // Only issue deprecation warnings once.
  if (message.indexOf('deprecated') !== -1) {
    if (warned[message]) {
      return;
    }
    warned[message] = true;
  }

  message = '[react-bootstrap-typeahead] ' + message;

  for (var _len = arguments.length, args = Array(_len > 2 ? _len - 2 : 0), _key = 2; _key < _len; _key++) {
    args[_key - 2] = arguments[_key];
  }

  _warning2.default.apply(undefined, [falseToWarn, message].concat(args));
}

function _resetWarned() {
  warned = {};
}

/***/ }),
/* 56 */,
/* 57 */,
/* 58 */,
/* 59 */,
/* 60 */,
/* 61 */,
/* 62 */,
/* 63 */,
/* 64 */,
/* 65 */,
/* 66 */,
/* 67 */,
/* 68 */,
/* 69 */,
/* 70 */,
/* 71 */,
/* 72 */,
/* 73 */,
/* 74 */,
/* 75 */,
/* 76 */,
/* 77 */,
/* 78 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
// LICENSE_CODE ZON ISC
 /*jslint react:true*/

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.StatusCodeTable = exports.StatusCodeRow = exports.status_codes = undefined;

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _regeneratorRuntime = __webpack_require__(20);

var _regeneratorRuntime2 = _interopRequireDefault(_regeneratorRuntime);

var _react = __webpack_require__(0);

var _react2 = _interopRequireDefault(_react);

var _reactBootstrap = __webpack_require__(25);

var _etask = __webpack_require__(19);

var _etask2 = _interopRequireDefault(_etask);

var _util = __webpack_require__(29);

var _util2 = _interopRequireDefault(_util);

var _common = __webpack_require__(47);

var _common2 = _interopRequireDefault(_common);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var E = {
    install: function install() {
        return E.sp = (0, _etask2.default)('status_codes', [function () {
            return this.wait();
        }]);
    },
    uninstall: function uninstall() {
        if (E.sp) E.sp.return();
    }
};

var status_codes = {
    200: 'OK',
    201: 'Created',
    202: 'Accepted',
    203: 'Non-Authoritative Information',
    204: 'No Content',
    205: 'Reset Content',
    206: 'Partial Content',
    300: 'Multiple Choices',
    301: 'Moved Permanently',
    302: 'Found',
    303: 'See Other',
    304: 'Not Modified',
    305: 'Use Proxy',
    307: 'Temporary Redirect',
    400: 'Bad Request',
    401: 'Unauthorized',
    402: 'Payment Required',
    403: 'Forbidden',
    404: 'Not Found',
    405: 'Method Not Allowed',
    406: 'Not Acceptable',
    407: 'Proxy Authentication Required',
    408: 'Request Timeout',
    409: 'Conflict',
    410: 'Gone',
    411: 'Length Required',
    412: 'Precondition Failed',
    413: 'Request Entity Too Large',
    414: 'Request-URI Too Long',
    415: 'Unsupported Media Type',
    416: 'Requested Range Not Satisfiable',
    417: 'Expectation Failed',
    500: 'Internal Server Error',
    501: 'Not Implemented',
    502: 'Bad Gateway',
    503: 'Service Unavailable',
    504: 'Gateway Timeout',
    505: 'HTTP Version Not Supported'
};

var StatusCodeRow = function (_React$Component) {
    _inherits(StatusCodeRow, _React$Component);

    function StatusCodeRow() {
        _classCallCheck(this, StatusCodeRow);

        return _possibleConstructorReturn(this, (StatusCodeRow.__proto__ || Object.getPrototypeOf(StatusCodeRow)).apply(this, arguments));
    }

    _createClass(StatusCodeRow, [{
        key: 'render',
        value: function render() {
            var _this3 = this;

            var tooltip = _react2.default.createElement(
                _reactBootstrap.Tooltip,
                {
                    id: 'status_code_' + this.props.stat.status_code },
                status_codes[this.props.stat.status_code] || this.props.stat.status_code
            );
            var class_name = '';
            var click = function click() {};
            if (this.props.go) {
                click = function click() {
                    return window.location = _this3.props.path + '/' + _this3.props.stat.status_code;
                };
                class_name = 'row_clickable';
            }
            return _react2.default.createElement(
                'tr',
                { className: class_name, onClick: click },
                _react2.default.createElement(
                    _reactBootstrap.OverlayTrigger,
                    { overlay: tooltip, placement: 'top' },
                    _react2.default.createElement(
                        'td',
                        null,
                        _react2.default.createElement(
                            'a',
                            { href: this.props.path + '/' + this.props.stat.status_code },
                            this.props.stat.status_code
                        )
                    )
                ),
                _react2.default.createElement(
                    'td',
                    { className: this.props.class_bw },
                    _util2.default.bytes_format(this.props.stat.bw)
                ),
                _react2.default.createElement(
                    'td',
                    { className: this.props.class_value },
                    this.props.stat.value
                )
            );
        }
    }]);

    return StatusCodeRow;
}(_react2.default.Component);

var StatusCodeTable = function (_React$Component2) {
    _inherits(StatusCodeTable, _React$Component2);

    function StatusCodeTable() {
        _classCallCheck(this, StatusCodeTable);

        return _possibleConstructorReturn(this, (StatusCodeTable.__proto__ || Object.getPrototypeOf(StatusCodeTable)).apply(this, arguments));
    }

    _createClass(StatusCodeTable, [{
        key: 'render',
        value: function render() {
            return _react2.default.createElement(
                _common2.default.StatTable,
                _extends({ row: StatusCodeRow, path: '/status_codes',
                    row_key: 'status_code', go: true }, this.props),
                _react2.default.createElement(
                    'tr',
                    null,
                    _react2.default.createElement(
                        'th',
                        null,
                        'Status Code'
                    ),
                    _react2.default.createElement(
                        'th',
                        { className: 'col-md-2' },
                        'Bandwidth'
                    ),
                    _react2.default.createElement(
                        'th',
                        { className: 'col-md-5' },
                        'Number of requests'
                    )
                )
            );
        }
    }]);

    return StatusCodeTable;
}(_react2.default.Component);

var Stats = function (_React$Component3) {
    _inherits(Stats, _React$Component3);

    function Stats(props) {
        _classCallCheck(this, Stats);

        var _this5 = _possibleConstructorReturn(this, (Stats.__proto__ || Object.getPrototypeOf(Stats)).call(this, props));

        _this5.state = { stats: [] };
        return _this5;
    }

    _createClass(Stats, [{
        key: 'componentDidMount',
        value: function componentDidMount() {
            E.install();
            var _this = this;
            E.sp.spawn((0, _etask2.default)( /*#__PURE__*/_regeneratorRuntime2.default.mark(function _callee() {
                var res;
                return _regeneratorRuntime2.default.wrap(function _callee$(_context) {
                    while (1) {
                        switch (_context.prev = _context.next) {
                            case 0:
                                _context.next = 2;
                                return _common2.default.StatsService.get_all({ sort: 1,
                                    by: 'status_code' });

                            case 2:
                                res = _context.sent;

                                _this.setState({ stats: res });

                            case 4:
                            case 'end':
                                return _context.stop();
                        }
                    }
                }, _callee, this);
            })));
        }
    }, {
        key: 'componentWillUnmount',
        value: function componentWillUnmount() {
            E.uninstall();
        }
    }, {
        key: 'render',
        value: function render() {
            return _react2.default.createElement(
                'div',
                null,
                _react2.default.createElement(
                    'div',
                    { className: 'page-header' },
                    _react2.default.createElement(
                        'h3',
                        null,
                        'Status codes'
                    )
                ),
                _react2.default.createElement(StatusCodeTable, { stats: this.state.stats })
            );
        }
    }]);

    return Stats;
}(_react2.default.Component);

exports.status_codes = status_codes;
exports.StatusCodeRow = StatusCodeRow;
exports.StatusCodeTable = StatusCodeTable;
exports.default = Stats;

/***/ }),
/* 79 */,
/* 80 */,
/* 81 */
/***/ (function(module, exports, __webpack_require__) {

var root = __webpack_require__(31);

/** Built-in value references. */
var Symbol = root.Symbol;

module.exports = Symbol;


/***/ }),
/* 82 */
/***/ (function(module, exports, __webpack_require__) {

var isSymbol = __webpack_require__(103);

/** Used as references for various `Number` constants. */
var INFINITY = 1 / 0;

/**
 * Converts `value` to a string key if it's not a string or symbol.
 *
 * @private
 * @param {*} value The value to inspect.
 * @returns {string|symbol} Returns the key.
 */
function toKey(value) {
  if (typeof value == 'string' || isSymbol(value)) {
    return value;
  }
  var result = (value + '');
  return (result == '0' && (1 / value) == -INFINITY) ? '-0' : result;
}

module.exports = toKey;


/***/ }),
/* 83 */,
/* 84 */,
/* 85 */
/***/ (function(module, exports, __webpack_require__) {

var __WEBPACK_AMD_DEFINE_ARRAY__, __WEBPACK_AMD_DEFINE_RESULT__;
var module;
// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, browser:true*/
(function(){

var is_node = typeof module=='object' && module.exports && module.children;
var is_node_ff = typeof module=='object' && module.exports;
if (!is_node_ff)
    ;
else
    ;
!(__WEBPACK_AMD_DEFINE_ARRAY__ = [], __WEBPACK_AMD_DEFINE_RESULT__ = function(){
var E = date_get;

function pad(num, size){ return ('000'+num).slice(-size); }

E.ms_to_dur = function(_ms){
    var s = '';
    var sec = Math.floor(_ms/1000);
    if (sec<0)
    {
	s += '-';
	sec = -sec;
    }
    var days = Math.floor(sec/(60*60*24));
    sec -= days*60*60*24;
    var hours = Math.floor(sec/(60*60));
    sec -= hours*60*60;
    var mins = Math.floor(sec/60);
    sec -= mins*60;
    if (days)
	s += days + ' ' + (days>1 ? 'Days' : 'Day') + ' ';
    return s+pad(hours, 2)+':'+pad(mins, 2)+':'+pad(sec, 2);
};

E.dur_to_str = function(duration, opt){
    opt = opt||{};
    var parts = [];
    duration = +duration;
    function chop(period, name){
        if (duration<period)
            return;
        var number = Math.floor(duration/period);
        parts.push(number+name);
        duration -= number*period;
    }
    chop(ms.YEAR, 'y');
    chop(ms.MONTH, 'mo');
    if (opt.week)
        chop(ms.WEEK, 'w');
    chop(ms.DAY, 'd');
    chop(ms.HOUR, 'h');
    chop(ms.MIN, 'min');
    chop(ms.SEC, 's');
    if (duration)
        parts.push(duration+'ms');
    if (!parts.length)
        return '0s';
    return parts.slice(0, opt.units||parts.length).join(opt.sep||'');
};

E.monotonic = undefined;
E.init = function(){
    var adjust, last;
    if (typeof window=='object' && window.performance
        && window.performance.now)
    {
        // 10% slower than Date.now, but always monotonic
        adjust = Date.now()-window.performance.now();
        E.monotonic = function(){ return window.performance.now()+adjust; };
    }
    else if (is_node && !global.mocha_running)
    {
        // brings libuv monotonic time since process start
        var timer = process.binding('timer_wrap').Timer;
        adjust = Date.now()-timer.now();
        E.monotonic = function(){ return timer.now()+adjust; };
    }
    else
    {
        last = adjust = 0;
        E.monotonic = function(){
            var now = Date.now()+adjust;
            if (now>=last)
                return last = now;
            adjust += last-now;
            return last;
        };
    }
};
E.init();

E.str_to_dur = function(str, opt){
    opt = opt||{};
    var month = 'mo|mon|months?';
    if (opt.short_month)
        month +='|m';
    var m = str.replace(/ /g, '').match(new RegExp('^(([0-9]+)y(ears?)?)?'
    +'(([0-9]+)('+month+'))?(([0-9]+)w(eeks?)?)?(([0-9]+)d(ays?)?)?'
    +'(([0-9]+)h(ours?)?)?(([0-9]+)(min|minutes?))?'
    +'(([0-9]+)s(ec|econds?)?)?(([0-9]+)ms(ec)?)?$'));
    if (!m)
        return;
    return ms.YEAR*(+m[2]||0)+ms.MONTH*(+m[5]||0)+ms.WEEK*(+m[8]||0)
    +ms.DAY*(+m[11]||0)+ms.HOUR*(+m[14]||0)+ms.MIN*(+m[17]||0)
    +ms.SEC*(+m[20]||0)+(+m[23]||0);
};

E.months_long = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
E.months_short = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug',
    'Sep', 'Oct', 'Nov', 'Dec'];
var months_short_lc = E.months_short.map(function(m){
    return m.toLowerCase(); });
E.days_long = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday',
    'Friday', 'Saturday'];
E.days_short = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
var days_short_lc = E.days_short.map(function(d){ return d.toLowerCase(); });
E.locale = {months_long: E.months_long, months_short: E.months_short,
    days_long: E.days_long, days_short: E.days_short, AM: 'AM', PM: 'PM'};
E.get = date_get;
function date_get(d, _new){
    var y, mon, day, H, M, S, _ms;
    if (d===undefined)
	return new Date();
    if (d==null)
	return new Date(null);
    if (d instanceof Date)
	return _new ? new Date(d) : d;
    if (typeof d=='string')
    {
	var m;
        d = d.trim();
	// check for ISO/SQL/JDate date
	if (m = /^((\d\d\d\d)-(\d\d)-(\d\d)|(\d\d?)-([A-Za-z]{3})-(\d\d(\d\d)?))\s*([\sT](\d\d):(\d\d)(:(\d\d)(\.(\d\d\d))?)?Z?)?$/
	    .exec(d))
	{
            H = +m[10]||0; M = +m[11]||0; S = +m[13]||0; _ms = +m[15]||0;
            if (m[2]) // SQL or ISO date
            {
                y = +m[2]; mon = +m[3]; day = +m[4];
                if (!y && !mon && !day && !H && !M && !S && !_ms)
                    return new Date(NaN);
                return new Date(Date.UTC(y, mon-1, day, H, M, S, _ms));
            }
            if (m[5]) // jdate
            {
                y = +m[7];
                mon = months_short_lc.indexOf(m[6].toLowerCase())+1;
                day = +m[5];
                if (m[7].length==2)
                {
                    y = +y;
                    y += y>=70 ? 1900 : 2000;
                }
                return new Date(Date.UTC(y, mon-1, day, H, M, S, _ms));
            }
            // cannot reach here
        }
        // check for string timestamp
        if (/^\d+$/.test(d))
            return new Date(+d);
        // else might be parsed as non UTC!
        return new Date(d);
    }
    if (typeof d=='number')
	return new Date(d);
    throw new TypeError('invalid date '+d);
}

E.to_sql_ms = function(d){
    d = E.get(d);
    if (isNaN(d))
        return '0000-00-00 00:00:00.000';
    return pad(d.getUTCFullYear(), 4)+'-'+pad(d.getUTCMonth()+1, 2)
    +'-'+pad(d.getUTCDate(), 2)
    +' '+pad(d.getUTCHours(), 2)+':'+pad(d.getUTCMinutes(), 2)
    +':'+pad(d.getUTCSeconds(), 2)
    +'.'+pad(d.getUTCMilliseconds(), 3);
};
E.to_sql_sec = function(d){ return E.to_sql_ms(d).slice(0, -4); };
E.to_sql = function(d){
    return E.to_sql_ms(d).replace(/( 00:00:00)?....$/, ''); };
E.from_sql = E.get;

E.to_month_short = function(d){
    d = E.get(d);
    return E.months_short[d.getUTCMonth()];
};
// timestamp format (used by tickets, etc). dates before 2000 not supported
E.to_jdate = function(d){
    d = E.get(d);
    return (pad(d.getUTCDate(), 2)+'-'+E.months_short[d.getUTCMonth()]
	+'-'+pad(d.getUTCFullYear()%100, 2)+' '+pad(d.getUTCHours(), 2)+
	':'+pad(d.getUTCMinutes(), 2)+':'+pad(d.getUTCSeconds(), 2))
    .replace(/( 00:00)?:00$/, '');
};
// used in log file names
E.to_log_file = function(d){
    d = E.get(d);
    return d.getUTCFullYear()+pad(d.getUTCMonth()+1, 2)+pad(d.getUTCDate(), 2)
    +'_'+pad(d.getUTCHours(), 2)+pad(d.getUTCMinutes(), 2)
    +pad(d.getUTCSeconds(), 2);
};
E.from_log_file = function(d){
    var m = d.match(/^(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})$/);
    if (!m)
        return;
    return new Date(Date.UTC(m[1], m[2]-1, m[3], m[4], m[5], m[6]));
};
// zerr compatible timestamp format
E.to_log_ms = function(d){ return E.to_sql_ms(d).replace(/-/g, '.'); };
E.from_rcs = function(d){
    var m = d.match(/^(\d{4})\.(\d{2})\.(\d{2})\.(\d{2})\.(\d{2})\.(\d{2})$/);
    if (!m)
        return;
    return new Date(Date.UTC(m[1], m[2]-1, m[3], m[4], m[5], m[6]));
};
E.to_rcs = function(d){ return E.to_sql_sec(d).replace(/[-: ]/g, '.'); };

E.sec = {
    MS: 0.001,
    SEC: 1,
    MIN: 60,
    HOUR: 60*60,
    DAY: 24*60*60,
    WEEK: 7*24*60*60,
    MONTH: 30*24*60*60,
    YEAR: 365*24*60*60,
};
E.ms = {};
for (var key in E.sec)
    E.ms[key] = E.sec[key]*1000;
var ms = E.ms;

E.align = function(d, align){
    d = E.get(d, 1);
    switch (align.toUpperCase())
    {
    case 'MS': break;
    case 'SEC': d.setUTCMilliseconds(0); break;
    case 'MIN': d.setUTCSeconds(0, 0); break;
    case 'HOUR': d.setUTCMinutes(0, 0, 0); break;
    case 'DAY': d.setUTCHours(0, 0, 0, 0); break;
    case 'WEEK':
        d.setUTCDate(d.getUTCDate()-d.getUTCDay());
        d.setUTCHours(0, 0, 0, 0);
        break;
    case 'MONTH': d.setUTCDate(1); d.setUTCHours(0, 0, 0, 0); break;
    case 'YEAR': d.setUTCMonth(0, 1); d.setUTCHours(0, 0, 0, 0); break;
    default: throw new Error('invalid align '+align);
    }
    return d;
};

E.add = function(d, duration){
    d = E.get(d, 1);
    if (duration.year)
        d.setUTCFullYear(d.getUTCFullYear()+duration.year);
    if (duration.month)
        d.setUTCMonth(d.getUTCMonth()+duration.month);
    ['day', 'hour', 'min', 'sec', 'ms'].forEach(function(key){
        if (duration[key])
            d.setTime(+d+duration[key]*ms[key.toUpperCase()]);
    });
    return d;
};

E.describe_interval = function(_ms){
    if (_ms<2*ms.MIN)
        return Math.round(_ms/ms.SEC)+' sec';
    if (_ms<2*ms.HOUR)
        return Math.round(_ms/ms.MIN)+' min';
    if (_ms<2*ms.DAY)
        return Math.round(_ms/ms.HOUR)+' hours';
    if (_ms<2*ms.WEEK)
        return Math.round(_ms/ms.DAY)+' days';
    if (_ms<2*ms.MONTH)
        return Math.round(_ms/ms.WEEK)+' weeks';
    if (_ms<2*ms.YEAR)
        return Math.round(_ms/ms.MONTH)+' months';
    return Math.round(_ms/ms.YEAR)+' years';
};

E.time_ago = function(d, until_date){
    var _ms = E.get(until_date)-E.get(d);
    if (_ms<ms.SEC)
        return 'right now';
    return E.describe_interval(_ms)+' ago';
};

E.ms_to_str = function(_ms){
    var s = ''+_ms;
    return s.length<=3 ? s+'ms' : s.slice(0, -3)+'.'+s.slice(-3)+'s';
};

E.parse = function(text, opt){
    opt = opt||{};
    if (opt.fmt)
        return E.strptime(text, opt.fmt);
    var d, a, i, v, _v, dir, _dir, amount, now = opt.now;
    now = !now ? new Date() : new Date(now);
    text = text.replace(/\s+/g, ' ').trim().toLowerCase();
    if (!text)
        return;
    if (text=='now')
        return now;
    if (!isNaN(d = E.get(text)))
        return d;
    d = now;
    a = text.split(' ');
    dir = a.includes('ago') ? -1 : a.includes('last') ? -1 :
        a.includes('next') ? 1 : undefined;
    for (i=0; i<a.length; i++)
    {
        v = a[i];
        if (/^(ago|last|next)$/.test(v));
        else if (v=='today')
            d = E.align(d, 'DAY');
        else if (v=='yesterday')
            d = E.align(+d-ms.DAY, 'DAY');
        else if (v=='tomorrow')
            d = E.align(+d+ms.DAY, 'DAY');
        else if ((_v = days_short_lc.indexOf(v))>=0)
            d = new Date(+E.align(d, 'WEEK')+_v*ms.DAY+(dir||0)*ms.WEEK);
        else if (_v = /^([+-]?\d+)(?:([ymoinwdhs]+)(\d.*)?)?$/.exec(v))
        {
            if (amount!==undefined)
                return;
            amount = dir!==undefined ? Math.abs(+_v[1]) : +_v[1];
            if (_v[2])
            {
                a.splice(i+1, 0, _v[2]);
                if (_v[3])
                    a.splice(i+2, 0, _v[3]);
            }
            continue;
        }
        else if (/^([ywdhs]|years?|months?|mon?|weeks?|days?|hours?|minutes?|min|seconds?|sec)$/.test(v))
        {
            _v = v[0]=='m' && v[1]=='i' ? ms.MIN :
                v[0]=='y' ? ms.YEAR : v[0]=='m' && v[1]=='o' ? ms.MONTH :
                v[0]=='w' ? ms.WEEK :
                v[0]=='d' ? ms.DAY : v[0]=='h' ? ms.HOUR : ms.SEC;
            amount = amount===undefined ? 1 : amount;
            _dir = dir===undefined ? opt.dir||1 : dir;
            if (_v==ms.MONTH)
                d.setUTCMonth(d.getUTCMonth()+_dir*amount);
            else if (_v==ms.YEAR)
                d.setUTCFullYear(d.getUTCFullYear()+_dir*amount);
            else
                d = new Date(+d+_v*amount*_dir);
            amount = undefined;
        }
        else
            return;
        if (amount!==undefined)
            return;
    }
    if (amount!==undefined)
        return;
    return d;
};

E.strptime = function(str, fmt){
    function month(m){ return months_short_lc.indexOf(m.toLowerCase()); }
    var parse = {
        '%': ['%', function(){}, 0],
        a: ['[a-z]+', function(m){}, 0],
        A: ['[a-z]+', function(m){}, 0],
        b: ['[a-z]+', function(m){ d.setUTCMonth(month(m)); }, 2],
        B: ['[a-z]+', function(m){
            d.setUTCMonth(month(m.toLowerCase())); }, 2],
        y: ['[0-9]{2}', function(m){
            d.setUTCFullYear(+m+(m<70 ? 2000 : 1900)); }, 1],
        Y: ['[0-9]{4}', function(m){ d.setUTCFullYear(+m); }, 1],
        m: ['[0-9]{0,2}', function(m){ d.setUTCMonth(+m-1); }, 2],
        d: ['[0-9]{0,2}', function(m){ d.setUTCDate(+m); }, 3],
        H: ['[0-9]{0,2}', function(m){ d.setUTCHours(+m); }, 4],
        M: ['[0-9]{0,2}', function(m){ d.setUTCMinutes(+m); }, 5],
        S: ['[0-9]{0,2}', function(m){ d.setUTCSeconds(+m); }, 6],
        s: ['[0-9]+', function(m){ d = new Date(+m); }, 0],
        L: ['[0-9]{0,3}', function(m){ d.setUTCMilliseconds(+m); }, 7],
        z: ['[+-][0-9]{4}', function(m){
            var timezone = +m.slice(0, 3)*3600+m.slice(3, 5)*60;
            d = new Date(d.getTime()-timezone*1000);
        }, 8],
        Z: ['[a-z]{0,3}[+-][0-9]{2}:?[0-9]{2}|[a-z]{1,3}', function(m){
            m = /^([a-z]{0,3})(?:([+-][0-9]{2}):?([0-9]{2}))?$/i.exec(m);
            if (m[1]=='Z' || m[1]=='UTC')
                return;
            var timezone = +m[2]*3600+m[3]*60;
            d = new Date(d.getTime()-timezone*1000);
        }, 8],
        I: ['[0-9]{0,2}', function(m){ d.setUTCHours(+m); }, 4],
        p: ['AM|PM', function(m){
            if (d.getUTCHours()==12)
                d.setUTCHours(d.getUTCHours()-12);
            if (m.toUpperCase()=='PM')
                d.setUTCHours(d.getUTCHours()+12);
        }, 9],
    };
    var ff = [];
    var ff_idx = [];
    var re = new RegExp('^\\s*'+fmt.replace(/%(?:([a-zA-Z%]))/g,
        function(_, fd)
    {
        var d = parse[fd];
        if (!d)
            throw Error('Unknown format descripter: '+fd);
        ff_idx[d[2]] = ff.length;
        ff.push(d[1]);
        return '('+d[0]+')';
    })+'\\s*$', 'i');
    var matched = str.match(re);
    if (!matched)
        return;
    var d = new Date(0);
    for (var i=0; i<ff_idx.length; i++)
    {
        var idx = ff_idx[i];
        var fun = ff[idx];
        if (fun)
            fun(matched[idx+1]);
    }
    return d;
};

var utc_local = {
    local: {
	getSeconds: function(d){ return d.getSeconds(); },
	getMinutes: function(d){ return d.getMinutes(); },
	getHours: function(d){ return d.getHours(); },
	getDay: function(d){ return d.getDay(); },
	getDate: function(d){ return d.getDate(); },
	getMonth: function(d){ return d.getMonth(); },
	getFullYear: function(d){ return d.getFullYear(); },
	getYearBegin: function(d){ return new Date(d.getFullYear(), 0, 1); }
    },
    utc: {
	getSeconds: function(d){ return d.getUTCSeconds(); },
	getMinutes: function(d){ return d.getUTCMinutes(); },
	getHours: function(d){ return d.getUTCHours(); },
	getDay: function(d){ return d.getUTCDay(); },
	getDate: function(d){ return d.getUTCDate(); },
	getMonth: function(d){ return d.getUTCMonth(); },
	getFullYear: function(d){ return d.getUTCFullYear(); },
	getYearBegin: function(d){ return new Date(Date.UTC(
            d.getUTCFullYear(), 0, 1)); }
    }
};

E.strftime = function(fmt, d, opt){
    function hours12(hours){
        return hours==0 ? 12 : hours>12 ? hours-12 : hours; }
    function ord_str(n){
        var i = n % 10, ii = n % 100;
        if (ii>=11 && ii<=13 || i==0 || i>=4)
            return 'th';
        switch (i)
        {
        case 1: return 'st';
        case 2: return 'nd';
        case 3: return 'rd';
        }
    }
    function week_num(l, d, first_weekday){
        // This works by shifting the weekday back by one day if we
        // are treating Monday as the first day of the week.
        var wday = l.getDay(d);
        if (first_weekday=='monday')
            wday = wday==0 /* Sunday */ ? wday = 6 : wday-1;
        var yday = (d-l.getYearBegin(d))/ms.DAY;
        return Math.floor((yday + 7 - wday)/7);
    }
    // Default padding is '0' and default length is 2, both are optional.
    function padx(n, padding, length){
        // padx(n, <length>)
        if (typeof padding=='number')
        {
            length = padding;
            padding = '0';
        }
        // Defaults handle padx(n) and padx(n, <padding>)
        if (padding===undefined)
            padding = '0';
        length = length||2;
        var s = ''+n;
        // padding may be an empty string, don't loop forever if it is
        if (padding)
            for (; s.length<length; s = padding + s);
        return s;
    }
    opt = opt||{};
    d = E.get(d);
    var locale = opt.locale||E.locale;
    var formats = locale.formats||{};
    var tz = opt.timezone;
    var utc = opt.utc!==undefined ? opt.utc :
	opt.local!==undefined ? !opt.local :
	true;
    if (tz!=null)
    {
	utc = true;
	// ISO 8601 format timezone string, [-+]HHMM
	// Convert to the number of minutes and it'll be applied to the date
	// below.
	if (typeof tz=='string')
	{
	    var sign = tz[0]=='-' ? -1 : 1;
	    var hours = parseInt(tz.slice(1, 3), 10);
	    var mins = parseInt(tz.slice(3, 5), 10);
	    tz = sign*(60*hours+mins);
	}
        if (typeof tz=='number')
	    d = new Date(+d+tz*60000);
    }
    var l = utc ? utc_local.utc : utc_local.local;
    // Most of the specifiers supported by C's strftime, and some from Ruby.
    // Some other syntax extensions from Ruby are supported: %-, %_, and %0
    // to pad with nothing, space, or zero (respectively).
    function replace(fmt){ return fmt.replace(/%([-_0]?.)/g, function(_, c){
	var mod, padding, day;
	if (c.length==2)
	{
	    mod = c[0];
	    if (mod=='-') // omit padding
		padding = '';
	    else if (mod=='_') // pad with space
		padding = ' ';
	    else if (mod=='0') // pad with zero
		padding = '0';
	    else // unrecognized, return the format
		return _;
	    c = c[1];
	}
	switch (c)
	{
	// Examples for new Date(0) in GMT
	case 'A': return locale.days_long[l.getDay(d)]; // 'Thursday'
	case 'a': return locale.days_short[l.getDay(d)]; // 'Thu'
	case 'B': return locale.months_long[l.getMonth(d)]; // 'January'
	case 'b': return locale.months_short[l.getMonth(d)]; // 'Jan'
	case 'C': // '19'
	    return padx(Math.floor(l.getFullYear(d)/100), padding);
	case 'D': return replace(formats.D || '%m/%d/%y'); // '01/01/70'
	case 'd': return padx(l.getDate(d), padding); // '01'
	case 'e': return l.getDate(d); // '01'
	case 'F': return replace(formats.F || '%Y-%m-%d'); // '1970-01-01'
	case 'H': return padx(l.getHours(d), padding); // '00'
	case 'h': return locale.months_short[l.getMonth(d)]; // 'Jan'
	case 'I': return padx(hours12(l.getHours(d)), padding); // '12'
	case 'j': // '000'
	    day = Math.ceil((+d-l.getYearBegin(d))/(1000*60*60*24));
	    return pad(day, 3);
	case 'k': // ' 0'
	    return padx(l.getHours(d), padding===undefined ? ' ' : padding);
	case 'L': return pad(Math.floor(d.getMilliseconds()), 3); // '000'
	case 'l': // '12'
	    return padx(hours12(l.getHours(d)),
		padding===undefined ? ' ' : padding);
	case 'M': return padx(l.getMinutes(d), padding); // '00'
	case 'm': return padx(l.getMonth(d)+1, padding); // '01'
	case 'n': return '\n'; // '\n'
	case 'o': return ''+l.getDate(d)+ord_str(l.getDate(d)); // '1st'
	case 'P': // 'am'
            return (l.getHours(d)<12 ? locale.AM : locale.PM).toLowerCase();
	case 'p': return l.getHours(d)<12 ? locale.AM : locale.PM; // 'AM'
	case 'R': return replace(formats.R || '%H:%M'); // '00:00'
	case 'r': return replace(formats.r || '%I:%M:%S %p'); // '12:00:00 AM'
	case 'S': return padx(l.getSeconds(d), padding); // '00'
	case 's': return Math.floor(+d/1000); // '0'
	case 'T': return replace(formats.T || '%H:%M:%S'); // '00:00:00'
	case 't': return '\t'; // '\t'
	case 'U': return padx(week_num(l, d, 'sunday'), padding); // '00'
	case 'u': // '4'
	    day = l.getDay(d);
	    // 1 - 7, Monday is first day of the week
	    return day==0 ? 7 : day;
	case 'v': return replace(formats.v || '%e-%b-%Y'); // '1-Jan-1970'
	case 'W': return padx(week_num(l, d, 'monday'), padding); // '00'
	case 'w': return l.getDay(d); // '4'. 0 Sunday - 6 Saturday
	case 'Y': return l.getFullYear(d); // '1970'
	case 'y': return (''+l.getFullYear(d)).slice(-2); // '70'
	case 'Z': // 'GMT'
	    if (utc)
	        return 'GMT';
	    var tz_string = d.toString().match(/\((\w+)\)/);
	    return tz_string && tz_string[1] || '';
	case 'z': // '+0000'
	    if (utc)
	        return '+0000';
	    var off = typeof tz=='number' ? tz : -d.getTimezoneOffset();
	    return (off<0 ? '-' : '+')+pad(Math.abs(off/60), 2)+pad(off%60, 2);
	default: return c;
	}
    }); }
    return replace(fmt);
};

return E; }.apply(exports, __WEBPACK_AMD_DEFINE_ARRAY__),
				__WEBPACK_AMD_DEFINE_RESULT__ !== undefined && (module.exports = __WEBPACK_AMD_DEFINE_RESULT__)); }());


/***/ }),
/* 86 */,
/* 87 */,
/* 88 */,
/* 89 */,
/* 90 */,
/* 91 */,
/* 92 */,
/* 93 */,
/* 94 */,
/* 95 */,
/* 96 */,
/* 97 */,
/* 98 */,
/* 99 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
// LICENSE_CODE ZON ISC
 /*jslint react:true*/

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.DomainTable = exports.DomainRow = undefined;

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _regeneratorRuntime = __webpack_require__(20);

var _regeneratorRuntime2 = _interopRequireDefault(_regeneratorRuntime);

var _react = __webpack_require__(0);

var _react2 = _interopRequireDefault(_react);

var _etask = __webpack_require__(19);

var _etask2 = _interopRequireDefault(_etask);

var _util = __webpack_require__(29);

var _util2 = _interopRequireDefault(_util);

var _common = __webpack_require__(47);

var _common2 = _interopRequireDefault(_common);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var E = {
    install: function install() {
        return E.sp = (0, _etask2.default)('domains', [function () {
            return this.wait();
        }]);
    },
    uninstall: function uninstall() {
        if (E.sp) E.sp.return();
    }
};

var DomainRow = function (_React$Component) {
    _inherits(DomainRow, _React$Component);

    function DomainRow() {
        _classCallCheck(this, DomainRow);

        return _possibleConstructorReturn(this, (DomainRow.__proto__ || Object.getPrototypeOf(DomainRow)).apply(this, arguments));
    }

    _createClass(DomainRow, [{
        key: 'render',
        value: function render() {
            var _this3 = this;

            var class_name = '';
            var click = function click() {};
            if (this.props.go) {
                click = function click() {
                    return window.location = _this3.props.path + '/' + _this3.props.stat.hostname;
                };
                class_name = 'row_clickable';
            }
            return _react2.default.createElement(
                'tr',
                { className: class_name, onClick: click },
                _react2.default.createElement(
                    'td',
                    null,
                    _react2.default.createElement(
                        'a',
                        { href: this.props.path + '/' + this.props.stat.hostname },
                        this.props.stat.hostname
                    )
                ),
                _react2.default.createElement(
                    'td',
                    { className: this.props.class_bw },
                    _util2.default.bytes_format(this.props.stat.bw)
                ),
                _react2.default.createElement(
                    'td',
                    { className: this.props.class_value },
                    this.props.stat.value
                )
            );
        }
    }]);

    return DomainRow;
}(_react2.default.Component);

var DomainTable = function (_React$Component2) {
    _inherits(DomainTable, _React$Component2);

    function DomainTable() {
        _classCallCheck(this, DomainTable);

        return _possibleConstructorReturn(this, (DomainTable.__proto__ || Object.getPrototypeOf(DomainTable)).apply(this, arguments));
    }

    _createClass(DomainTable, [{
        key: 'render',
        value: function render() {
            return _react2.default.createElement(
                _common2.default.StatTable,
                _extends({ row: DomainRow, path: '/domains',
                    row_key: 'hostname', go: true }, this.props),
                _react2.default.createElement(
                    'tr',
                    null,
                    _react2.default.createElement(
                        'th',
                        null,
                        'Domain Host'
                    ),
                    _react2.default.createElement(
                        'th',
                        { className: 'col-md-2' },
                        'Bandwidth'
                    ),
                    _react2.default.createElement(
                        'th',
                        { className: 'col-md-5' },
                        'Number of requests'
                    )
                )
            );
        }
    }]);

    return DomainTable;
}(_react2.default.Component);

var Stats = function (_React$Component3) {
    _inherits(Stats, _React$Component3);

    function Stats(props) {
        _classCallCheck(this, Stats);

        var _this5 = _possibleConstructorReturn(this, (Stats.__proto__ || Object.getPrototypeOf(Stats)).call(this, props));

        _this5.state = { stats: [] };
        return _this5;
    }

    _createClass(Stats, [{
        key: 'componentDidMount',
        value: function componentDidMount() {
            E.install();
            var _this = this;
            if (window.localStorage.getItem('quickstart-test-proxy')) window.localStorage.setItem('quickstart-stats', true);
            E.sp.spawn((0, _etask2.default)( /*#__PURE__*/_regeneratorRuntime2.default.mark(function _callee() {
                var res;
                return _regeneratorRuntime2.default.wrap(function _callee$(_context) {
                    while (1) {
                        switch (_context.prev = _context.next) {
                            case 0:
                                _context.next = 2;
                                return _common2.default.StatsService.get_all({ sort: 1,
                                    by: 'hostname' });

                            case 2:
                                res = _context.sent;

                                _this.setState({ stats: res });

                            case 4:
                            case 'end':
                                return _context.stop();
                        }
                    }
                }, _callee, this);
            })));
        }
    }, {
        key: 'componentWillUnmount',
        value: function componentWillUnmount() {
            E.uninstall();
        }
    }, {
        key: 'render',
        value: function render() {
            return _react2.default.createElement(
                'div',
                null,
                _react2.default.createElement(
                    'div',
                    { className: 'page-header' },
                    _react2.default.createElement(
                        'h3',
                        null,
                        'Domains'
                    )
                ),
                _react2.default.createElement(DomainTable, { stats: this.state.stats })
            );
        }
    }]);

    return Stats;
}(_react2.default.Component);

exports.DomainRow = DomainRow;
exports.DomainTable = DomainTable;
exports.default = Stats;

/***/ }),
/* 100 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
// LICENSE_CODE ZON ISC
 /*jslint react:true*/

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.ProtocolTable = exports.ProtocolRow = undefined;

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _regeneratorRuntime = __webpack_require__(20);

var _regeneratorRuntime2 = _interopRequireDefault(_regeneratorRuntime);

var _react = __webpack_require__(0);

var _react2 = _interopRequireDefault(_react);

var _reactBootstrap = __webpack_require__(25);

var _etask = __webpack_require__(19);

var _etask2 = _interopRequireDefault(_etask);

var _util = __webpack_require__(29);

var _util2 = _interopRequireDefault(_util);

var _common = __webpack_require__(47);

var _common2 = _interopRequireDefault(_common);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var E = {
    install: function install() {
        return E.sp = (0, _etask2.default)('protocols', [function () {
            return this.wait();
        }]);
    },
    uninstall: function uninstall() {
        if (E.sp) E.sp.return();
    }
};

var CertificateButton = function (_React$Component) {
    _inherits(CertificateButton, _React$Component);

    function CertificateButton() {
        _classCallCheck(this, CertificateButton);

        return _possibleConstructorReturn(this, (CertificateButton.__proto__ || Object.getPrototypeOf(CertificateButton)).apply(this, arguments));
    }

    _createClass(CertificateButton, [{
        key: 'render',
        value: function render() {
            return _react2.default.createElement(
                _reactBootstrap.Button,
                { bsStyle: this.props.bs_style, bsSize: 'xsmall',
                    onClick: this.props.onClick },
                this.props.text
            );
        }
    }]);

    return CertificateButton;
}(_react2.default.Component);

var ProtocolRow = function (_React$Component2) {
    _inherits(ProtocolRow, _React$Component2);

    function ProtocolRow() {
        var _ref;

        var _temp, _this3, _ret;

        _classCallCheck(this, ProtocolRow);

        for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
            args[_key] = arguments[_key];
        }

        return _ret = (_temp = (_this3 = _possibleConstructorReturn(this, (_ref = ProtocolRow.__proto__ || Object.getPrototypeOf(ProtocolRow)).call.apply(_ref, [this].concat(args))), _this3), _this3.handle_https_btn_click = function (evt) {
            evt.stopPropagation();
            _this3.props.enable_https_button_click(evt);
        }, _temp), _possibleConstructorReturn(_this3, _ret);
    }

    _createClass(ProtocolRow, [{
        key: 'render_https_button',
        value: function render_https_button() {
            if (this.props.stat.protocol != 'https') return null;
            if (!this.props.show_enable_https_button) return null;
            return _react2.default.createElement(CertificateButton, { bs_style: 'success',
                text: 'Enable HTTPS Statistics',
                onClick: this.handle_https_btn_click });
        }
    }, {
        key: 'render',
        value: function render() {
            var _this4 = this;

            var class_name = '';
            var click = function click() {};
            var https_button = this.render_https_button();
            var value = !https_button || this.props.stat.value != '0' ? this.props.stat.value : '';
            if (this.props.go) {
                click = function click() {
                    return window.location = _this4.props.path + '/' + _this4.props.stat.protocol;
                };
                class_name = 'row_clickable';
            }
            return _react2.default.createElement(
                'tr',
                { className: class_name, onClick: click },
                _react2.default.createElement(
                    'td',
                    null,
                    _react2.default.createElement(
                        'a',
                        { href: this.props.path + '/' + this.props.stat.protocol },
                        this.props.stat.protocol
                    )
                ),
                _react2.default.createElement(
                    'td',
                    { className: this.props.class_bw },
                    _util2.default.bytes_format(this.props.stat.bw)
                ),
                _react2.default.createElement(
                    'td',
                    { className: this.props.class_value },
                    value,
                    ' ',
                    https_button
                )
            );
        }
    }]);

    return ProtocolRow;
}(_react2.default.Component);

var ProtocolTable = function (_React$Component3) {
    _inherits(ProtocolTable, _React$Component3);

    function ProtocolTable() {
        _classCallCheck(this, ProtocolTable);

        return _possibleConstructorReturn(this, (ProtocolTable.__proto__ || Object.getPrototypeOf(ProtocolTable)).apply(this, arguments));
    }

    _createClass(ProtocolTable, [{
        key: 'render',
        value: function render() {
            return _react2.default.createElement(
                _common2.default.StatTable,
                _extends({ row: ProtocolRow, path: '/protocols',
                    row_key: 'protocol', title: _react2.default.createElement(
                        _reactBootstrap.Row,
                        null,
                        _react2.default.createElement(
                            _reactBootstrap.Col,
                            { md: 6 },
                            this.props.title
                        ),
                        this.props.show_enable_https_button && _react2.default.createElement(
                            _reactBootstrap.Col,
                            { md: 6, className: 'text-right' },
                            _react2.default.createElement(CertificateButton, { bs_style: 'success',
                                text: 'Enable HTTPS Statistics',
                                onClick: this.props.enable_https_button_click })
                        )
                    ),
                    go: true,
                    row_opts: { show_enable_https_button: this.props.show_enable_https_button, enable_https_button_click: this.props.enable_https_button_click }
                }, this.props),
                _react2.default.createElement(
                    'tr',
                    null,
                    _react2.default.createElement(
                        'th',
                        null,
                        'Protocol'
                    ),
                    _react2.default.createElement(
                        'th',
                        { className: 'col-md-2' },
                        'Bandwidth'
                    ),
                    _react2.default.createElement(
                        'th',
                        { className: 'col-md-5' },
                        'Number of requests'
                    )
                )
            );
        }
    }]);

    return ProtocolTable;
}(_react2.default.Component);

var Stats = function (_React$Component4) {
    _inherits(Stats, _React$Component4);

    function Stats(props) {
        _classCallCheck(this, Stats);

        var _this6 = _possibleConstructorReturn(this, (Stats.__proto__ || Object.getPrototypeOf(Stats)).call(this, props));

        _this6.state = { stats: [] };
        return _this6;
    }

    _createClass(Stats, [{
        key: 'componentDidMount',
        value: function componentDidMount() {
            E.install();
            var _this = this;
            E.sp.spawn((0, _etask2.default)( /*#__PURE__*/_regeneratorRuntime2.default.mark(function _callee() {
                var res;
                return _regeneratorRuntime2.default.wrap(function _callee$(_context) {
                    while (1) {
                        switch (_context.prev = _context.next) {
                            case 0:
                                _context.next = 2;
                                return _common2.default.StatsService.get_all({ sort: 1,
                                    by: 'protocol' });

                            case 2:
                                res = _context.sent;

                                _this.setState({ stats: res });

                            case 4:
                            case 'end':
                                return _context.stop();
                        }
                    }
                }, _callee, this);
            })));
        }
    }, {
        key: 'componentWillUnmount',
        value: function componentWillUnmount() {
            E.uninstall();
        }
    }, {
        key: 'render',
        value: function render() {
            return _react2.default.createElement(
                'div',
                null,
                _react2.default.createElement(
                    'div',
                    { className: 'page-header' },
                    _react2.default.createElement(
                        'h3',
                        null,
                        'Protocols'
                    )
                ),
                _react2.default.createElement(ProtocolTable, { stats: this.state.stats })
            );
        }
    }]);

    return Stats;
}(_react2.default.Component);

exports.ProtocolRow = ProtocolRow;
exports.ProtocolTable = ProtocolTable;
exports.default = Stats;

/***/ }),
/* 101 */,
/* 102 */
/***/ (function(module, exports, __webpack_require__) {

var __WEBPACK_AMD_DEFINE_ARRAY__, __WEBPACK_AMD_DEFINE_RESULT__;
var module;
// LICENSE_CODE ZON ISC
'use strict'; /*zlint node, br*/
(function(){

var is_node_ff = typeof module=='object' && module.exports;
if (!is_node_ff)
    ;
else
    ;
!(__WEBPACK_AMD_DEFINE_ARRAY__ = [__webpack_require__(13), __webpack_require__(19), __webpack_require__(85), __webpack_require__(268),
    __webpack_require__(528), __webpack_require__(531)], __WEBPACK_AMD_DEFINE_RESULT__ = function($, etask, date, zescape, zerr, events){
var E = ajax;
var assign = Object.assign;
E.events = new events.EventEmitter();
E.json = function(opt){ return ajax(assign({}, opt, {json: 1})); };
E.abort = function(ajax){ ajax.goto('abort'); };
// XXX arik: need test
function ajax(opt){
    var timeout = opt.timeout||20*date.ms.SEC, slow = opt.slow||2*date.ms.SEC;
    var retry = opt.retry, data = opt.data, qs = zescape.qs(opt.qs);
    var url = zescape.uri(opt.url, qs), perr = opt.perr;
    // opt.type is deprecated
    var method = opt.method||opt.type||'GET';
    var data_type = opt.json ? 'json' : 'text';
    var t0 = Date.now();
    var xhr;
    zerr.debug('ajax('+data_type+') url '+url+' retry '+retry);
    return etask([function(){
        var ajopt = {dataType: data_type, type: method, url: url,
            data: data, timeout: timeout, xhrFields: {}};
        if (opt.with_credentials)
            ajopt.xhrFields.withCredentials = true;
        if (opt.onprogress)
            ajopt.xhrFields.onprogress = opt.onprogress;
        return xhr = $.ajax(ajopt);
    }, function catch$(err){
        zerr('ajax('+data_type+') failed url '+url+' data '+
            zerr.json(data).substr(0, 200)+' status: '+xhr.status+' '+
            xhr.statusText+'\nresponseText: '+
            (xhr.responseText||'').substr(0, 200));
        if (retry)
            return this.return(ajax(assign({}, opt, {retry: retry-1})));
        if (xhr.statusText=='timeout')
            E.events.emit('timeout', this);
        if (opt.no_throw)
            return {error: xhr.statusText||'no_status'};
        throw new Error(xhr.statusText);
    }, function(data){
        var t = Date.now()-t0;
        zerr[t>slow ? 'err' : 'debug'](
            'ajax('+data_type+') '+(t>slow ? 'SLOW ' : 'ok ')+t+'ms url '+url);
        if (t>slow && perr)
            perr({id: 'be_ajax_slow', info: t+'ms '+url});
        if (E.do_op)
            E.do_op(data&&data.do_op);
        return this.return(data);
    }, function abort(){
        // reachable only via E.abort
        xhr.abort();
    }]);
}

return E; }.apply(exports, __WEBPACK_AMD_DEFINE_ARRAY__),
				__WEBPACK_AMD_DEFINE_RESULT__ !== undefined && (module.exports = __WEBPACK_AMD_DEFINE_RESULT__)); }());


/***/ }),
/* 103 */
/***/ (function(module, exports, __webpack_require__) {

var baseGetTag = __webpack_require__(51),
    isObjectLike = __webpack_require__(52);

/** `Object#toString` result references. */
var symbolTag = '[object Symbol]';

/**
 * Checks if `value` is classified as a `Symbol` primitive or object.
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a symbol, else `false`.
 * @example
 *
 * _.isSymbol(Symbol.iterator);
 * // => true
 *
 * _.isSymbol('abc');
 * // => false
 */
function isSymbol(value) {
  return typeof value == 'symbol' ||
    (isObjectLike(value) && baseGetTag(value) == symbolTag);
}

module.exports = isSymbol;


/***/ }),
/* 104 */
/***/ (function(module, exports, __webpack_require__) {

var listCacheClear = __webpack_require__(551),
    listCacheDelete = __webpack_require__(552),
    listCacheGet = __webpack_require__(553),
    listCacheHas = __webpack_require__(554),
    listCacheSet = __webpack_require__(555);

/**
 * Creates an list cache object.
 *
 * @private
 * @constructor
 * @param {Array} [entries] The key-value pairs to cache.
 */
function ListCache(entries) {
  var index = -1,
      length = entries == null ? 0 : entries.length;

  this.clear();
  while (++index < length) {
    var entry = entries[index];
    this.set(entry[0], entry[1]);
  }
}

// Add methods to `ListCache`.
ListCache.prototype.clear = listCacheClear;
ListCache.prototype['delete'] = listCacheDelete;
ListCache.prototype.get = listCacheGet;
ListCache.prototype.has = listCacheHas;
ListCache.prototype.set = listCacheSet;

module.exports = ListCache;


/***/ }),
/* 105 */
/***/ (function(module, exports, __webpack_require__) {

var eq = __webpack_require__(106);

/**
 * Gets the index at which the `key` is found in `array` of key-value pairs.
 *
 * @private
 * @param {Array} array The array to inspect.
 * @param {*} key The key to search for.
 * @returns {number} Returns the index of the matched value, else `-1`.
 */
function assocIndexOf(array, key) {
  var length = array.length;
  while (length--) {
    if (eq(array[length][0], key)) {
      return length;
    }
  }
  return -1;
}

module.exports = assocIndexOf;


/***/ }),
/* 106 */
/***/ (function(module, exports) {

/**
 * Performs a
 * [`SameValueZero`](http://ecma-international.org/ecma-262/7.0/#sec-samevaluezero)
 * comparison between two values to determine if they are equivalent.
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to compare.
 * @param {*} other The other value to compare.
 * @returns {boolean} Returns `true` if the values are equivalent, else `false`.
 * @example
 *
 * var object = { 'a': 1 };
 * var other = { 'a': 1 };
 *
 * _.eq(object, object);
 * // => true
 *
 * _.eq(object, other);
 * // => false
 *
 * _.eq('a', 'a');
 * // => true
 *
 * _.eq('a', Object('a'));
 * // => false
 *
 * _.eq(NaN, NaN);
 * // => true
 */
function eq(value, other) {
  return value === other || (value !== value && other !== other);
}

module.exports = eq;


/***/ }),
/* 107 */
/***/ (function(module, exports, __webpack_require__) {

var getNative = __webpack_require__(53);

/* Built-in method references that are verified to be native. */
var nativeCreate = getNative(Object, 'create');

module.exports = nativeCreate;


/***/ }),
/* 108 */
/***/ (function(module, exports, __webpack_require__) {

var isKeyable = __webpack_require__(573);

/**
 * Gets the data for `map`.
 *
 * @private
 * @param {Object} map The map to query.
 * @param {string} key The reference key.
 * @returns {*} Returns the map data.
 */
function getMapData(map, key) {
  var data = map.__data__;
  return isKeyable(key)
    ? data[typeof key == 'string' ? 'string' : 'hash']
    : data.map;
}

module.exports = getMapData;


/***/ }),
/* 109 */
/***/ (function(module, exports) {

/** Used as references for various `Number` constants. */
var MAX_SAFE_INTEGER = 9007199254740991;

/** Used to detect unsigned integer values. */
var reIsUint = /^(?:0|[1-9]\d*)$/;

/**
 * Checks if `value` is a valid array-like index.
 *
 * @private
 * @param {*} value The value to check.
 * @param {number} [length=MAX_SAFE_INTEGER] The upper bounds of a valid index.
 * @returns {boolean} Returns `true` if `value` is a valid index, else `false`.
 */
function isIndex(value, length) {
  length = length == null ? MAX_SAFE_INTEGER : length;
  return !!length &&
    (typeof value == 'number' || reIsUint.test(value)) &&
    (value > -1 && value % 1 == 0 && value < length);
}

module.exports = isIndex;


/***/ }),
/* 110 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
/* WEBPACK VAR INJECTION */(function(process) {

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _invariant = __webpack_require__(59);

var _invariant2 = _interopRequireDefault(_invariant);

var _isPlainObject = __webpack_require__(289);

var _isPlainObject2 = _interopRequireDefault(_isPlainObject);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * Retrieves the display string from an option. Options can be the string
 * themselves, or an object with a defined display string. Anything else throws
 * an error.
 */
function getOptionLabel(option, labelKey) {
  var optionLabel = void 0;

  if (typeof option === 'string') {
    optionLabel = option;
  }

  if (typeof labelKey === 'function') {
    // This overwrites string options, but we assume the consumer wants to do
    // something custom if `labelKey` is a function.
    optionLabel = labelKey(option);
  } else if (typeof labelKey === 'string' && (0, _isPlainObject2.default)(option)) {
    optionLabel = option[labelKey];
  }

  !(typeof optionLabel === 'string') ? process.env.NODE_ENV !== 'production' ? (0, _invariant2.default)(false, 'One or more options does not have a valid label string. Check the ' + '`labelKey` prop to ensure that it matches the correct option key and ' + 'provides a string for filtering and display.') : (0, _invariant2.default)(false) : void 0;

  return optionLabel;
}

exports.default = getOptionLabel;
/* WEBPACK VAR INJECTION */}.call(exports, __webpack_require__(10)))

/***/ }),
/* 111 */
/***/ (function(module, exports, __webpack_require__) {

var isArray = __webpack_require__(24),
    isKey = __webpack_require__(173),
    stringToPath = __webpack_require__(626),
    toString = __webpack_require__(288);

/**
 * Casts `value` to a path array if it's not one.
 *
 * @private
 * @param {*} value The value to inspect.
 * @param {Object} [object] The object to query keys on.
 * @returns {Array} Returns the cast property path array.
 */
function castPath(value, object) {
  if (isArray(value)) {
    return value;
  }
  return isKey(value, object) ? [value] : stringToPath(toString(value));
}

module.exports = castPath;


/***/ }),
/* 112 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = stripDiacritics;
/**
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * Taken from: http://stackoverflow.com/questions/990904/remove-accents-diacritics-in-a-string-in-javascript/18391901#18391901
 */

/* eslint-disable max-len */
var map = [{ 'base': 'A', 'letters': 'A\u24B6\uFF21\xC0\xC1\xC2\u1EA6\u1EA4\u1EAA\u1EA8\xC3\u0100\u0102\u1EB0\u1EAE\u1EB4\u1EB2\u0226\u01E0\xC4\u01DE\u1EA2\xC5\u01FA\u01CD\u0200\u0202\u1EA0\u1EAC\u1EB6\u1E00\u0104\u023A\u2C6F' }, { 'base': 'AA', 'letters': '\uA732' }, { 'base': 'AE', 'letters': '\xC6\u01FC\u01E2' }, { 'base': 'AO', 'letters': '\uA734' }, { 'base': 'AU', 'letters': '\uA736' }, { 'base': 'AV', 'letters': '\uA738\uA73A' }, { 'base': 'AY', 'letters': '\uA73C' }, { 'base': 'B', 'letters': 'B\u24B7\uFF22\u1E02\u1E04\u1E06\u0243\u0182\u0181' }, { 'base': 'C', 'letters': 'C\u24B8\uFF23\u0106\u0108\u010A\u010C\xC7\u1E08\u0187\u023B\uA73E' }, { 'base': 'D', 'letters': 'D\u24B9\uFF24\u1E0A\u010E\u1E0C\u1E10\u1E12\u1E0E\u0110\u018B\u018A\u0189\uA779\xD0' }, { 'base': 'DZ', 'letters': '\u01F1\u01C4' }, { 'base': 'Dz', 'letters': '\u01F2\u01C5' }, { 'base': 'E', 'letters': 'E\u24BA\uFF25\xC8\xC9\xCA\u1EC0\u1EBE\u1EC4\u1EC2\u1EBC\u0112\u1E14\u1E16\u0114\u0116\xCB\u1EBA\u011A\u0204\u0206\u1EB8\u1EC6\u0228\u1E1C\u0118\u1E18\u1E1A\u0190\u018E' }, { 'base': 'F', 'letters': 'F\u24BB\uFF26\u1E1E\u0191\uA77B' }, { 'base': 'G', 'letters': 'G\u24BC\uFF27\u01F4\u011C\u1E20\u011E\u0120\u01E6\u0122\u01E4\u0193\uA7A0\uA77D\uA77E' }, { 'base': 'H', 'letters': 'H\u24BD\uFF28\u0124\u1E22\u1E26\u021E\u1E24\u1E28\u1E2A\u0126\u2C67\u2C75\uA78D' }, { 'base': 'I', 'letters': 'I\u24BE\uFF29\xCC\xCD\xCE\u0128\u012A\u012C\u0130\xCF\u1E2E\u1EC8\u01CF\u0208\u020A\u1ECA\u012E\u1E2C\u0197' }, { 'base': 'J', 'letters': 'J\u24BF\uFF2A\u0134\u0248' }, { 'base': 'K', 'letters': 'K\u24C0\uFF2B\u1E30\u01E8\u1E32\u0136\u1E34\u0198\u2C69\uA740\uA742\uA744\uA7A2' }, { 'base': 'L', 'letters': 'L\u24C1\uFF2C\u013F\u0139\u013D\u1E36\u1E38\u013B\u1E3C\u1E3A\u0141\u023D\u2C62\u2C60\uA748\uA746\uA780' }, { 'base': 'LJ', 'letters': '\u01C7' }, { 'base': 'Lj', 'letters': '\u01C8' }, { 'base': 'M', 'letters': 'M\u24C2\uFF2D\u1E3E\u1E40\u1E42\u2C6E\u019C' }, { 'base': 'N', 'letters': 'N\u24C3\uFF2E\u01F8\u0143\xD1\u1E44\u0147\u1E46\u0145\u1E4A\u1E48\u0220\u019D\uA790\uA7A4' }, { 'base': 'NJ', 'letters': '\u01CA' }, { 'base': 'Nj', 'letters': '\u01CB' }, { 'base': 'O', 'letters': 'O\u24C4\uFF2F\xD2\xD3\xD4\u1ED2\u1ED0\u1ED6\u1ED4\xD5\u1E4C\u022C\u1E4E\u014C\u1E50\u1E52\u014E\u022E\u0230\xD6\u022A\u1ECE\u0150\u01D1\u020C\u020E\u01A0\u1EDC\u1EDA\u1EE0\u1EDE\u1EE2\u1ECC\u1ED8\u01EA\u01EC\xD8\u01FE\u0186\u019F\uA74A\uA74C' }, { 'base': 'OI', 'letters': '\u01A2' }, { 'base': 'OO', 'letters': '\uA74E' }, { 'base': 'OU', 'letters': '\u0222' }, { 'base': 'OE', 'letters': '\x8C\u0152' }, { 'base': 'oe', 'letters': '\x9C\u0153' }, { 'base': 'P', 'letters': 'P\u24C5\uFF30\u1E54\u1E56\u01A4\u2C63\uA750\uA752\uA754' }, { 'base': 'Q', 'letters': 'Q\u24C6\uFF31\uA756\uA758\u024A' }, { 'base': 'R', 'letters': 'R\u24C7\uFF32\u0154\u1E58\u0158\u0210\u0212\u1E5A\u1E5C\u0156\u1E5E\u024C\u2C64\uA75A\uA7A6\uA782' }, { 'base': 'S', 'letters': 'S\u24C8\uFF33\u1E9E\u015A\u1E64\u015C\u1E60\u0160\u1E66\u1E62\u1E68\u0218\u015E\u2C7E\uA7A8\uA784' }, { 'base': 'T', 'letters': 'T\u24C9\uFF34\u1E6A\u0164\u1E6C\u021A\u0162\u1E70\u1E6E\u0166\u01AC\u01AE\u023E\uA786' }, { 'base': 'TZ', 'letters': '\uA728' }, { 'base': 'U', 'letters': 'U\u24CA\uFF35\xD9\xDA\xDB\u0168\u1E78\u016A\u1E7A\u016C\xDC\u01DB\u01D7\u01D5\u01D9\u1EE6\u016E\u0170\u01D3\u0214\u0216\u01AF\u1EEA\u1EE8\u1EEE\u1EEC\u1EF0\u1EE4\u1E72\u0172\u1E76\u1E74\u0244' }, { 'base': 'V', 'letters': 'V\u24CB\uFF36\u1E7C\u1E7E\u01B2\uA75E\u0245' }, { 'base': 'VY', 'letters': '\uA760' }, { 'base': 'W', 'letters': 'W\u24CC\uFF37\u1E80\u1E82\u0174\u1E86\u1E84\u1E88\u2C72' }, { 'base': 'X', 'letters': 'X\u24CD\uFF38\u1E8A\u1E8C' }, { 'base': 'Y', 'letters': 'Y\u24CE\uFF39\u1EF2\xDD\u0176\u1EF8\u0232\u1E8E\u0178\u1EF6\u1EF4\u01B3\u024E\u1EFE' }, { 'base': 'Z', 'letters': 'Z\u24CF\uFF3A\u0179\u1E90\u017B\u017D\u1E92\u1E94\u01B5\u0224\u2C7F\u2C6B\uA762' }, { 'base': 'a', 'letters': 'a\u24D0\uFF41\u1E9A\xE0\xE1\xE2\u1EA7\u1EA5\u1EAB\u1EA9\xE3\u0101\u0103\u1EB1\u1EAF\u1EB5\u1EB3\u0227\u01E1\xE4\u01DF\u1EA3\xE5\u01FB\u01CE\u0201\u0203\u1EA1\u1EAD\u1EB7\u1E01\u0105\u2C65\u0250' }, { 'base': 'aa', 'letters': '\uA733' }, { 'base': 'ae', 'letters': '\xE6\u01FD\u01E3' }, { 'base': 'ao', 'letters': '\uA735' }, { 'base': 'au', 'letters': '\uA737' }, { 'base': 'av', 'letters': '\uA739\uA73B' }, { 'base': 'ay', 'letters': '\uA73D' }, { 'base': 'b', 'letters': 'b\u24D1\uFF42\u1E03\u1E05\u1E07\u0180\u0183\u0253' }, { 'base': 'c', 'letters': 'c\u24D2\uFF43\u0107\u0109\u010B\u010D\xE7\u1E09\u0188\u023C\uA73F\u2184' }, { 'base': 'd', 'letters': 'd\u24D3\uFF44\u1E0B\u010F\u1E0D\u1E11\u1E13\u1E0F\u0111\u018C\u0256\u0257\uA77A' }, { 'base': 'dz', 'letters': '\u01F3\u01C6' }, { 'base': 'e', 'letters': 'e\u24D4\uFF45\xE8\xE9\xEA\u1EC1\u1EBF\u1EC5\u1EC3\u1EBD\u0113\u1E15\u1E17\u0115\u0117\xEB\u1EBB\u011B\u0205\u0207\u1EB9\u1EC7\u0229\u1E1D\u0119\u1E19\u1E1B\u0247\u025B\u01DD' }, { 'base': 'f', 'letters': 'f\u24D5\uFF46\u1E1F\u0192\uA77C' }, { 'base': 'g', 'letters': 'g\u24D6\uFF47\u01F5\u011D\u1E21\u011F\u0121\u01E7\u0123\u01E5\u0260\uA7A1\u1D79\uA77F' }, { 'base': 'h', 'letters': 'h\u24D7\uFF48\u0125\u1E23\u1E27\u021F\u1E25\u1E29\u1E2B\u1E96\u0127\u2C68\u2C76\u0265' }, { 'base': 'hv', 'letters': '\u0195' }, { 'base': 'i', 'letters': 'i\u24D8\uFF49\xEC\xED\xEE\u0129\u012B\u012D\xEF\u1E2F\u1EC9\u01D0\u0209\u020B\u1ECB\u012F\u1E2D\u0268\u0131' }, { 'base': 'j', 'letters': 'j\u24D9\uFF4A\u0135\u01F0\u0249' }, { 'base': 'k', 'letters': 'k\u24DA\uFF4B\u1E31\u01E9\u1E33\u0137\u1E35\u0199\u2C6A\uA741\uA743\uA745\uA7A3' }, { 'base': 'l', 'letters': 'l\u24DB\uFF4C\u0140\u013A\u013E\u1E37\u1E39\u013C\u1E3D\u1E3B\u017F\u0142\u019A\u026B\u2C61\uA749\uA781\uA747' }, { 'base': 'lj', 'letters': '\u01C9' }, { 'base': 'm', 'letters': 'm\u24DC\uFF4D\u1E3F\u1E41\u1E43\u0271\u026F' }, { 'base': 'n', 'letters': 'n\u24DD\uFF4E\u01F9\u0144\xF1\u1E45\u0148\u1E47\u0146\u1E4B\u1E49\u019E\u0272\u0149\uA791\uA7A5' }, { 'base': 'nj', 'letters': '\u01CC' }, { 'base': 'o', 'letters': 'o\u24DE\uFF4F\xF2\xF3\xF4\u1ED3\u1ED1\u1ED7\u1ED5\xF5\u1E4D\u022D\u1E4F\u014D\u1E51\u1E53\u014F\u022F\u0231\xF6\u022B\u1ECF\u0151\u01D2\u020D\u020F\u01A1\u1EDD\u1EDB\u1EE1\u1EDF\u1EE3\u1ECD\u1ED9\u01EB\u01ED\xF8\u01FF\u0254\uA74B\uA74D\u0275' }, { 'base': 'oi', 'letters': '\u01A3' }, { 'base': 'ou', 'letters': '\u0223' }, { 'base': 'oo', 'letters': '\uA74F' }, { 'base': 'p', 'letters': 'p\u24DF\uFF50\u1E55\u1E57\u01A5\u1D7D\uA751\uA753\uA755' }, { 'base': 'q', 'letters': 'q\u24E0\uFF51\u024B\uA757\uA759' }, { 'base': 'r', 'letters': 'r\u24E1\uFF52\u0155\u1E59\u0159\u0211\u0213\u1E5B\u1E5D\u0157\u1E5F\u024D\u027D\uA75B\uA7A7\uA783' }, { 'base': 's', 'letters': 's\u24E2\uFF53\xDF\u015B\u1E65\u015D\u1E61\u0161\u1E67\u1E63\u1E69\u0219\u015F\u023F\uA7A9\uA785\u1E9B' }, { 'base': 't', 'letters': 't\u24E3\uFF54\u1E6B\u1E97\u0165\u1E6D\u021B\u0163\u1E71\u1E6F\u0167\u01AD\u0288\u2C66\uA787' }, { 'base': 'tz', 'letters': '\uA729' }, { 'base': 'u', 'letters': 'u\u24E4\uFF55\xF9\xFA\xFB\u0169\u1E79\u016B\u1E7B\u016D\xFC\u01DC\u01D8\u01D6\u01DA\u1EE7\u016F\u0171\u01D4\u0215\u0217\u01B0\u1EEB\u1EE9\u1EEF\u1EED\u1EF1\u1EE5\u1E73\u0173\u1E77\u1E75\u0289' }, { 'base': 'v', 'letters': 'v\u24E5\uFF56\u1E7D\u1E7F\u028B\uA75F\u028C' }, { 'base': 'vy', 'letters': '\uA761' }, { 'base': 'w', 'letters': 'w\u24E6\uFF57\u1E81\u1E83\u0175\u1E87\u1E85\u1E98\u1E89\u2C73' }, { 'base': 'x', 'letters': 'x\u24E7\uFF58\u1E8B\u1E8D' }, { 'base': 'y', 'letters': 'y\u24E8\uFF59\u1EF3\xFD\u0177\u1EF9\u0233\u1E8F\xFF\u1EF7\u1E99\u1EF5\u01B4\u024F\u1EFF' }, { 'base': 'z', 'letters': 'z\u24E9\uFF5A\u017A\u1E91\u017C\u017E\u1E93\u1E95\u01B6\u0225\u0240\u2C6C\uA763' }];
/* eslint-enable max-len */

var diacriticsMap = {};
for (var ii = 0; ii < map.length; ii++) {
  var letters = map[ii].letters;
  for (var jj = 0; jj < letters.length; jj++) {
    diacriticsMap[letters[jj]] = map[ii].base;
  }
}

// "what?" version ... http://jsperf.com/diacritics/12
function stripDiacritics(str) {
  return str.replace(/[^\u0000-\u007E]/g, function (a) {
    return diacriticsMap[a] || a;
  });
}

/***/ }),
/* 113 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


/**
 * KeyCode
 *
 * Map of common (non-printable) keycodes for the `keydown` and `keyup` events.
 * Note that `keypress` handles things differently and may not return the same
 * values.
 */
module.exports = {
  BACKSPACE: 8,
  TAB: 9,
  RETURN: 13,
  ESC: 27,
  SPACE: 32,
  LEFT: 37,
  UP: 38,
  RIGHT: 39,
  DOWN: 40
};

/***/ }),
/* 114 */,
/* 115 */,
/* 116 */,
/* 117 */,
/* 118 */,
/* 119 */,
/* 120 */,
/* 121 */,
/* 122 */,
/* 123 */,
/* 124 */,
/* 125 */,
/* 126 */,
/* 127 */,
/* 128 */,
/* 129 */,
/* 130 */,
/* 131 */,
/* 132 */,
/* 133 */,
/* 134 */,
/* 135 */,
/* 136 */,
/* 137 */,
/* 138 */,
/* 139 */,
/* 140 */,
/* 141 */,
/* 142 */,
/* 143 */
/***/ (function(module, exports, __webpack_require__) {

var __WEBPACK_AMD_DEFINE_ARRAY__, __WEBPACK_AMD_DEFINE_RESULT__;
var module;
// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, browser:true*/
(function(){

var is_node_ff = typeof module=='object' && module.exports;
if (!is_node_ff)
    ;
else
    ;
!(__WEBPACK_AMD_DEFINE_ARRAY__ = [], __WEBPACK_AMD_DEFINE_RESULT__ = function(){
var E = {};

var proto_slice = Array.prototype.slice;
E.copy = function(a){
    switch (a.length)
    {
    case 0: return [];
    case 1: return [a[0]];
    case 2: return [a[0], a[1]];
    case 3: return [a[0], a[1], a[2]];
    case 4: return [a[0], a[1], a[2], a[3]];
    case 5: return [a[0], a[1], a[2], a[3], a[4]];
    default: return proto_slice.call(a);
    }
};

E.push = function(a){
    for (var i=1; i<arguments.length; i++)
    {
        var arg = arguments[i];
        if (Array.isArray(arg))
            a.push.apply(a, arg);
        else
            a.push(arg);
    }
    return a.length;
};
E.unshift = function(a){
    for (var i=arguments.length-1; i>0; i--)
    {
        var arg = arguments[i];
        if (Array.isArray(arg))
            a.unshift.apply(a, arg);
        else
            a.unshift(arg);
    }
    return a.length;
};

E.slice = function(args, from, to){
    return Array.prototype.slice.call(args, from, to); };

E.compact = function(a){ return E.compact_self(a.slice()); };
E.compact_self = function(a){
    var i, j, n = a.length;
    for (i=0; i<n && a[i]; i++);
    if (i==n)
	return a;
    for (j=i; i<n; i++)
    {
	if (!a[i])
	    continue;
	a[j++] = a[i];
    }
    a.length = j;
    return a;
};

// same as _.flatten(a, true)
E.flatten_shallow = function(a){ return Array.prototype.concat.apply([], a); };
E.flatten = function(a){
    var _a = [], i;
    for (i=0; i<a.length; i++)
    {
        if (Array.isArray(a[i]))
            Array.prototype.push.apply(_a, E.flatten(a[i]));
        else
            _a.push(a[i]);
    }
    return _a;
};
E.unique = function(a){
    var _a = [];
    for (var i=0; i<a.length; i++)
    {
        if (!_a.includes(a[i]))
            _a.push(a[i]);
    }
    return _a;
};
E.to_nl = function(a, sep){
    if (!a || !a.length)
	return '';
    if (sep===undefined)
	sep = '\n';
    return a.join(sep)+sep;
};
E.sed = function(a, regex, replace){
    var _a = new Array(a.length), i;
    for (i=0; i<a.length; i++)
	_a[i] = a[i].replace(regex, replace);
    return _a;
};
E.grep = function(a, regex, replace){
    var _a = [], i;
    for (i=0; i<a.length; i++)
    {
	// dont use regex.test() since with //g sticky tag it does not reset
	if (a[i].search(regex)<0)
	    continue;
	if (replace!==undefined)
	    _a.push(a[i].replace(regex, replace));
	else
	    _a.push(a[i]);
    }
    return _a;
};

E.rm_elm = function(a, elm){
    var i = a.indexOf(elm);
    if (i<0)
	return;
    a.splice(i, 1);
    return elm;
};

E.rm_elm_tail = function(a, elm){
    var i = a.length-1;
    if (elm===a[i]) // fast-path
    {
	a.pop();
	return elm;
    }
    if ((i = a.lastIndexOf(elm, i-1))<0)
	return;
    a.splice(i, 1);
    return elm;
};

E.add_elm = function(a, elm){
    if (a.includes(elm))
        return;
    a.push(elm);
    return elm;
};

E.split_every = function(a, n){
    var ret = [];
    for (var i=0; i<a.length; i+=n)
        ret.push(a.slice(i, i+n));
    return ret;
};

E.split_at = function(a, delim){
    var ret = [];
    delim = delim||'';
    for (var i=0; i<a.length; i++)
    {
        var chunk = [];
        for (; i<a.length && a[i]!=delim; i++)
            chunk.push(a[i]);
        if (chunk.length)
            ret.push(chunk);
    }
    return ret;
};

E.rotate = function(a, n){
    if (a && a.length>1 && (n = n%a.length))
        E.unshift(a, a.splice(n));
    return a;
};

E.move = function(a, from, to, n){
    return Array.prototype.splice.apply(a, [to, n]
        .concat(a.slice(from, from+n)));
};

E.to_array = function(v){ return Array.isArray(v) ? v : v==null ? [] : [v]; };

var proto = {};
proto.sed = function(regex, replace){
    return E.sed(this, regex, replace); };
proto.grep = function(regex, replace){
    return E.grep(this, regex, replace); };
proto.to_nl = function(sep){ return E.to_nl(this, sep); };
proto.push_a = function(){
    return E.push.apply(null, [this].concat(Array.from(arguments))); };
proto.unshift_a = function(){
    return E.unshift.apply(null, [this].concat(Array.from(arguments))); };
var installed;
E.prototype_install = function(){
    if (installed)
        return;
    installed = true;
    for (var i in proto)
    {
        Object.defineProperty(Array.prototype, i,
            {value: proto[i], configurable: true, enumerable: false,
            writable: true});
    }
};
E.prototype_uninstall = function(){
    if (!installed)
        return;
    installed = false;
    // XXX sergey: store orig proto, then load it back
    for (var i in proto)
        delete Array.prototype[i];
};
return E; }.apply(exports, __WEBPACK_AMD_DEFINE_ARRAY__),
				__WEBPACK_AMD_DEFINE_RESULT__ !== undefined && (module.exports = __WEBPACK_AMD_DEFINE_RESULT__)); }());


/***/ }),
/* 144 */,
/* 145 */,
/* 146 */,
/* 147 */,
/* 148 */,
/* 149 */,
/* 150 */,
/* 151 */,
/* 152 */,
/* 153 */,
/* 154 */,
/* 155 */,
/* 156 */,
/* 157 */,
/* 158 */,
/* 159 */,
/* 160 */,
/* 161 */,
/* 162 */
/***/ (function(module, exports, __webpack_require__) {

var baseIsEqual = __webpack_require__(163);

/**
 * Performs a deep comparison between two values to determine if they are
 * equivalent.
 *
 * **Note:** This method supports comparing arrays, array buffers, booleans,
 * date objects, error objects, maps, numbers, `Object` objects, regexes,
 * sets, strings, symbols, and typed arrays. `Object` objects are compared
 * by their own, not inherited, enumerable properties. Functions and DOM
 * nodes are compared by strict equality, i.e. `===`.
 *
 * @static
 * @memberOf _
 * @since 0.1.0
 * @category Lang
 * @param {*} value The value to compare.
 * @param {*} other The other value to compare.
 * @returns {boolean} Returns `true` if the values are equivalent, else `false`.
 * @example
 *
 * var object = { 'a': 1 };
 * var other = { 'a': 1 };
 *
 * _.isEqual(object, other);
 * // => true
 *
 * object === other;
 * // => false
 */
function isEqual(value, other) {
  return baseIsEqual(value, other);
}

module.exports = isEqual;


/***/ }),
/* 163 */
/***/ (function(module, exports, __webpack_require__) {

var baseIsEqualDeep = __webpack_require__(550),
    isObjectLike = __webpack_require__(52);

/**
 * The base implementation of `_.isEqual` which supports partial comparisons
 * and tracks traversed objects.
 *
 * @private
 * @param {*} value The value to compare.
 * @param {*} other The other value to compare.
 * @param {boolean} bitmask The bitmask flags.
 *  1 - Unordered comparison
 *  2 - Partial comparison
 * @param {Function} [customizer] The function to customize comparisons.
 * @param {Object} [stack] Tracks traversed `value` and `other` objects.
 * @returns {boolean} Returns `true` if the values are equivalent, else `false`.
 */
function baseIsEqual(value, other, bitmask, customizer, stack) {
  if (value === other) {
    return true;
  }
  if (value == null || other == null || (!isObjectLike(value) && !isObjectLike(other))) {
    return value !== value && other !== other;
  }
  return baseIsEqualDeep(value, other, bitmask, customizer, baseIsEqual, stack);
}

module.exports = baseIsEqual;


/***/ }),
/* 164 */
/***/ (function(module, exports, __webpack_require__) {

var getNative = __webpack_require__(53),
    root = __webpack_require__(31);

/* Built-in method references that are verified to be native. */
var Map = getNative(root, 'Map');

module.exports = Map;


/***/ }),
/* 165 */
/***/ (function(module, exports, __webpack_require__) {

var baseGetTag = __webpack_require__(51),
    isObject = __webpack_require__(50);

/** `Object#toString` result references. */
var asyncTag = '[object AsyncFunction]',
    funcTag = '[object Function]',
    genTag = '[object GeneratorFunction]',
    proxyTag = '[object Proxy]';

/**
 * Checks if `value` is classified as a `Function` object.
 *
 * @static
 * @memberOf _
 * @since 0.1.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a function, else `false`.
 * @example
 *
 * _.isFunction(_);
 * // => true
 *
 * _.isFunction(/abc/);
 * // => false
 */
function isFunction(value) {
  if (!isObject(value)) {
    return false;
  }
  // The use of `Object#toString` avoids issues with the `typeof` operator
  // in Safari 9 which returns 'object' for typed arrays and other constructors.
  var tag = baseGetTag(value);
  return tag == funcTag || tag == genTag || tag == asyncTag || tag == proxyTag;
}

module.exports = isFunction;


/***/ }),
/* 166 */
/***/ (function(module, exports, __webpack_require__) {

var mapCacheClear = __webpack_require__(565),
    mapCacheDelete = __webpack_require__(572),
    mapCacheGet = __webpack_require__(574),
    mapCacheHas = __webpack_require__(575),
    mapCacheSet = __webpack_require__(576);

/**
 * Creates a map cache object to store key-value pairs.
 *
 * @private
 * @constructor
 * @param {Array} [entries] The key-value pairs to cache.
 */
function MapCache(entries) {
  var index = -1,
      length = entries == null ? 0 : entries.length;

  this.clear();
  while (++index < length) {
    var entry = entries[index];
    this.set(entry[0], entry[1]);
  }
}

// Add methods to `MapCache`.
MapCache.prototype.clear = mapCacheClear;
MapCache.prototype['delete'] = mapCacheDelete;
MapCache.prototype.get = mapCacheGet;
MapCache.prototype.has = mapCacheHas;
MapCache.prototype.set = mapCacheSet;

module.exports = MapCache;


/***/ }),
/* 167 */
/***/ (function(module, exports, __webpack_require__) {

var arrayLikeKeys = __webpack_require__(591),
    baseKeys = __webpack_require__(598),
    isArrayLike = __webpack_require__(170);

/**
 * Creates an array of the own enumerable property names of `object`.
 *
 * **Note:** Non-object values are coerced to objects. See the
 * [ES spec](http://ecma-international.org/ecma-262/7.0/#sec-object.keys)
 * for more details.
 *
 * @static
 * @since 0.1.0
 * @memberOf _
 * @category Object
 * @param {Object} object The object to query.
 * @returns {Array} Returns the array of property names.
 * @example
 *
 * function Foo() {
 *   this.a = 1;
 *   this.b = 2;
 * }
 *
 * Foo.prototype.c = 3;
 *
 * _.keys(new Foo);
 * // => ['a', 'b'] (iteration order is not guaranteed)
 *
 * _.keys('hi');
 * // => ['0', '1']
 */
function keys(object) {
  return isArrayLike(object) ? arrayLikeKeys(object) : baseKeys(object);
}

module.exports = keys;


/***/ }),
/* 168 */
/***/ (function(module, exports, __webpack_require__) {

var baseIsArguments = __webpack_require__(593),
    isObjectLike = __webpack_require__(52);

/** Used for built-in method references. */
var objectProto = Object.prototype;

/** Used to check objects for own properties. */
var hasOwnProperty = objectProto.hasOwnProperty;

/** Built-in value references. */
var propertyIsEnumerable = objectProto.propertyIsEnumerable;

/**
 * Checks if `value` is likely an `arguments` object.
 *
 * @static
 * @memberOf _
 * @since 0.1.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an `arguments` object,
 *  else `false`.
 * @example
 *
 * _.isArguments(function() { return arguments; }());
 * // => true
 *
 * _.isArguments([1, 2, 3]);
 * // => false
 */
var isArguments = baseIsArguments(function() { return arguments; }()) ? baseIsArguments : function(value) {
  return isObjectLike(value) && hasOwnProperty.call(value, 'callee') &&
    !propertyIsEnumerable.call(value, 'callee');
};

module.exports = isArguments;


/***/ }),
/* 169 */
/***/ (function(module, exports) {

/** Used as references for various `Number` constants. */
var MAX_SAFE_INTEGER = 9007199254740991;

/**
 * Checks if `value` is a valid array-like length.
 *
 * **Note:** This method is loosely based on
 * [`ToLength`](http://ecma-international.org/ecma-262/7.0/#sec-tolength).
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a valid length, else `false`.
 * @example
 *
 * _.isLength(3);
 * // => true
 *
 * _.isLength(Number.MIN_VALUE);
 * // => false
 *
 * _.isLength(Infinity);
 * // => false
 *
 * _.isLength('3');
 * // => false
 */
function isLength(value) {
  return typeof value == 'number' &&
    value > -1 && value % 1 == 0 && value <= MAX_SAFE_INTEGER;
}

module.exports = isLength;


/***/ }),
/* 170 */
/***/ (function(module, exports, __webpack_require__) {

var isFunction = __webpack_require__(165),
    isLength = __webpack_require__(169);

/**
 * Checks if `value` is array-like. A value is considered array-like if it's
 * not a function and has a `value.length` that's an integer greater than or
 * equal to `0` and less than or equal to `Number.MAX_SAFE_INTEGER`.
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is array-like, else `false`.
 * @example
 *
 * _.isArrayLike([1, 2, 3]);
 * // => true
 *
 * _.isArrayLike(document.body.children);
 * // => true
 *
 * _.isArrayLike('abc');
 * // => true
 *
 * _.isArrayLike(_.noop);
 * // => false
 */
function isArrayLike(value) {
  return value != null && isLength(value.length) && !isFunction(value);
}

module.exports = isArrayLike;


/***/ }),
/* 171 */
/***/ (function(module, exports) {

/**
 * This method returns `undefined`.
 *
 * @static
 * @memberOf _
 * @since 2.3.0
 * @category Util
 * @example
 *
 * _.times(2, _.noop);
 * // => [undefined, undefined]
 */
function noop() {
  // No operation performed.
}

module.exports = noop;


/***/ }),
/* 172 */
/***/ (function(module, exports, __webpack_require__) {

var castPath = __webpack_require__(111),
    toKey = __webpack_require__(82);

/**
 * The base implementation of `_.get` without support for default values.
 *
 * @private
 * @param {Object} object The object to query.
 * @param {Array|string} path The path of the property to get.
 * @returns {*} Returns the resolved value.
 */
function baseGet(object, path) {
  path = castPath(path, object);

  var index = 0,
      length = path.length;

  while (object != null && index < length) {
    object = object[toKey(path[index++])];
  }
  return (index && index == length) ? object : undefined;
}

module.exports = baseGet;


/***/ }),
/* 173 */
/***/ (function(module, exports, __webpack_require__) {

var isArray = __webpack_require__(24),
    isSymbol = __webpack_require__(103);

/** Used to match property names within property paths. */
var reIsDeepProp = /\.|\[(?:[^[\]]*|(["'])(?:(?!\1)[^\\]|\\.)*?\1)\]/,
    reIsPlainProp = /^\w*$/;

/**
 * Checks if `value` is a property name and not a property path.
 *
 * @private
 * @param {*} value The value to check.
 * @param {Object} [object] The object to query keys on.
 * @returns {boolean} Returns `true` if `value` is a property name, else `false`.
 */
function isKey(value, object) {
  if (isArray(value)) {
    return false;
  }
  var type = typeof value;
  if (type == 'number' || type == 'symbol' || type == 'boolean' ||
      value == null || isSymbol(value)) {
    return true;
  }
  return reIsPlainProp.test(value) || !reIsDeepProp.test(value) ||
    (object != null && value in Object(object));
}

module.exports = isKey;


/***/ }),
/* 174 */
/***/ (function(module, exports) {

/**
 * Gets the first element of `array`.
 *
 * @static
 * @memberOf _
 * @since 0.1.0
 * @alias first
 * @category Array
 * @param {Array} array The array to query.
 * @returns {*} Returns the first element of `array`.
 * @example
 *
 * _.head([1, 2, 3]);
 * // => 1
 *
 * _.head([]);
 * // => undefined
 */
function head(array) {
  return (array && array.length) ? array[0] : undefined;
}

module.exports = head;


/***/ }),
/* 175 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.BaseMenuItem = undefined;

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _classnames = __webpack_require__(5);

var _classnames2 = _interopRequireDefault(_classnames);

var _noop = __webpack_require__(171);

var _noop2 = _interopRequireDefault(_noop);

var _react = __webpack_require__(0);

var _react2 = _interopRequireDefault(_react);

var _menuItemContainer = __webpack_require__(296);

var _menuItemContainer2 = _interopRequireDefault(_menuItemContainer);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var BaseMenuItem = function (_React$Component) {
  _inherits(BaseMenuItem, _React$Component);

  function BaseMenuItem() {
    var _ref;

    var _temp, _this, _ret;

    _classCallCheck(this, BaseMenuItem);

    for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
      args[_key] = arguments[_key];
    }

    return _ret = (_temp = (_this = _possibleConstructorReturn(this, (_ref = BaseMenuItem.__proto__ || Object.getPrototypeOf(BaseMenuItem)).call.apply(_ref, [this].concat(args))), _this), _this._handleClick = function (e) {
      var _this$props = _this.props,
          disabled = _this$props.disabled,
          onClick = _this$props.onClick;


      e.preventDefault();
      !disabled && onClick(e);
    }, _temp), _possibleConstructorReturn(_this, _ret);
  }

  _createClass(BaseMenuItem, [{
    key: 'render',
    value: function render() {
      var _props = this.props,
          active = _props.active,
          children = _props.children,
          className = _props.className,
          disabled = _props.disabled;

      var conditionalClassNames = {
        'active': active,
        'disabled': disabled
      };

      return _react2.default.createElement(
        'li',
        {
          className: (0, _classnames2.default)(conditionalClassNames, className) },
        _react2.default.createElement(
          'a',
          {
            className: (0, _classnames2.default)('dropdown-item', conditionalClassNames),
            href: '#',
            onClick: this._handleClick,
            role: 'button' },
          children
        )
      );
    }
  }]);

  return BaseMenuItem;
}(_react2.default.Component);

BaseMenuItem.defaultProps = {
  onClick: _noop2.default
};

var MenuItem = (0, _menuItemContainer2.default)(BaseMenuItem);

exports.BaseMenuItem = BaseMenuItem;
exports.default = MenuItem;

/***/ }),
/* 176 */,
/* 177 */,
/* 178 */,
/* 179 */,
/* 180 */,
/* 181 */
/***/ (function(module, exports, __webpack_require__) {

var __WEBPACK_AMD_DEFINE_ARRAY__, __WEBPACK_AMD_DEFINE_RESULT__;
var module;
// LICENSE_CODE ZON ISC
'use strict'; /*zlint node, br*/
(function(){

var is_node = typeof module=='object' && module.exports && module.children;
var is_ff_addon = typeof module=='object' && module.uri
    && !module.uri.indexOf('resource://');
var qs;
if (!is_node && !is_ff_addon)
    ;
else
{
    ;
    qs = require(is_ff_addon ? 'sdk/querystring' : 'querystring');
}
!(__WEBPACK_AMD_DEFINE_ARRAY__ = [], __WEBPACK_AMD_DEFINE_RESULT__ = function(){
var assign = Object.assign;
var E = {};

E.add_proto = function(url){
    if (!url.match(/^([a-z0-9]+:)?\/\//i))
	url = 'http://'+url;
    return url;
};

E.rel_proto_to_abs = function(url){
    var proto = is_node ? 'http:' : location.protocol;
    return url.replace(/^\/\//, proto+'//');
};

E.get_top_level_domain = function(host){
    var n = host.match(/\.([^.]+)$/);
    return n ? n[1] : '';
};

E.get_host = function(url){
    var n = url.match(/^(https?:)?\/\/([^\/]+)\/.*$/);
    return n ? n[2] : '';
};

E.get_host_without_tld = function(host){
    return host.replace(/^([^.]+)\.[^.]{2,3}(\.[^.]{2,3})?$/, '$1');
};

E.get_path = function(url){
    var n = url.match(/^https?:\/\/[^\/]+(\/.*$)/);
    return n ? n[1] : '';
};

E.get_proto = function(url){
    var n = url.match(/^([a-z0-9]+):\/\//);
    return n ? n[1] : '';
};

E.get_host_gently = function(url){
    var n = url.match(/^(?:(?:[a-z0-9]+?:)?\/\/)?([^\/]+)/);
    return n ? n[1] : '';
};

E.is_ip = function(host){
    var m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
    if (!m)
        return false;
    for (var i=1; i<=4; i++)
    {
        if (+m[i]>255)
            return false;
    }
    return true;
};

E.is_ip_mask = function(host){
    var m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
    if (!m)
        return false;
    if (E.ip2num(host)==0)
        return false;
    var final = false;
    var check_num_mask = function(num){
        var arr = (num >>> 0).toString(2).split(''), final = false;
        for (var i=0; i<arr.length; i++)
        {
            if (final && arr[i]=='1')
                return false;
            if (!final && arr[i]=='0')
                final = true;
        }
        return true;
    };
    for (var i=1; i<=4; i++)
    {
        if (+m[i]>255)
            return false;
        if (final && +m[i]>0)
            return false;
        if (!final && +m[i]<255)
        {
            if (!check_num_mask(+m[i]))
                return false;
            final = true;
        }
    }
    return !!final;
};

E.ip2num = function(ip){
    var num = 0;
    ip.split('.').forEach(function(octet){
        num <<= 8;
        num += +octet;
    });
    return num>>>0;
};

E.num2ip = function(num){
    return (num>>>24)+'.'+(num>>16 & 255)+'.'+(num>>8 & 255)+'.'+(num & 255);
};

E.is_ip_subnet = function(host){
    var m = /(.+?)\/(\d+)$/.exec(host);
    return m && E.is_ip(m[1]) && +m[2]<=32;
};

E.is_ip_netmask = function(host){
    var ips = host.split('/');
    if (ips.length!=2 || !E.is_ip(ips[0]) || !E.is_ip_mask(ips[1]))
        return false;
    return true;
};

E.is_ip_range = function(host){
    var ips = host.split('-');
    if (ips.length!=2 || !E.is_ip(ips[0]) || !E.is_ip(ips[1]))
        return false;
    return E.ip2num(ips[0])<E.ip2num(ips[1]);
};

E.is_ip_port = function(host){
    var m = /(.+?)(?::(\d{1,5}))?$/.exec(host);
    return m && E.is_ip(m[1]) && !(+m[2]>65535);
};

/* basic url validation to prevent script injection like 'javascript:....' */
E.is_valid_url = function(url){
    return /^(https?:\/\/)?([a-z0-9-]+\.)+[a-z0-9-]+(\/.*)?$/i.test(url); };

E.is_valid_domain = function(domain){
    return /^[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,63}$/.test(domain); };

E.is_hola_domain = function(domain){
    return domain.search(/^(.*\.)?(hola\.org|holacdn\.com|h-cdn\.com)$/)!=-1;
};

E.is_valid_email = function(email){
    var n = email.toLowerCase().match(/^[a-z0-9_\.\-\+]+@(.*)$/);
    return !!(n && E.is_valid_domain(n[1]));
};

E.is_ip_in_range = function(ips_range, ip){
    if (!E.is_ip_range(ips_range) || !E.is_ip(ip))
        return false;
    var ips = ips_range.split('-');
    var min_ip = E.ip2num(ips[0]), max_ip = E.ip2num(ips[1]);
    var num_ip = E.ip2num(ip);
    return num_ip>=min_ip && num_ip<=max_ip;
};

E.host_lookup = function(lookup, host){
    var pos;
    while (1)
    {
        if (host in lookup)
            return lookup[host];
        if ((pos = host.indexOf('.'))<0)
            return;
        host = host.slice(pos+1);
    }
};

// more-or-less compatible with NodeJS url API
E.uri_obj_href = function(uri){
    return (uri.protocol||'')+(uri.slashes ? '//' : '')
        +(uri.host ? (uri.auth ? uri.auth+'@' : '')+uri.host : '')
        +uri.path
        +(uri.hash||'');
};

var protocol_re = /^((?:about|http|https|file|ftp|ws|wss):)?(\/\/)?/i;
var host_section_re = /^(.*?)(?:[\/?#]|$)/;
var host_re = /^(?:(([^:@]*):?([^:@]*))?@)?([^:]*)(?::(\d*))?/;
var path_section_re = /^([^?#]*)(\?[^#]*)?(#.*)?$/;
var path_re_loose = /^(\/(?:.(?![^\/]*\.[^\/.]+$))*\/?)?([^\/]*?(?:\.([^.]+))?)$/;
var path_re_strict = /^(\/(?:.(?![^\/]*(?:\.[^\/.]+)?$))*\/?)?([^\/]*?(?:\.([^.]+))?)$/;

E.parse = function(url, strict){
    function re(expr, str){
        var m;
        try { m = expr.exec(str); } catch(e){ m = null; }
        if (!m)
            return m;
        for (var i=0; i<m.length; i++)
            m[i] = m[i]===undefined ? null : m[i];
        return m;
    }
    url = url||location.href;
    var m, uri = {orig: url}, remaining = url;
    // protocol
    if (!(m = re(protocol_re, remaining)))
        return {};
    uri.protocol = m[1];
    if (uri.protocol!==null)
        uri.protocol = uri.protocol.toLowerCase();
    uri.slashes = !!m[2];
    if (!uri.protocol && !uri.slashes)
    {
        uri.protocol = 'http:';
        uri.slashes = true;
    }
    remaining = remaining.slice(m[0].length);
    // host
    if (!(m = re(host_section_re, remaining)))
        return {};
    uri.authority = m[1];
    remaining = remaining.slice(m[1].length);
    // host elements
    if (!(m = re(host_re, uri.authority)))
        return {};
    uri.auth = m[1];
    uri.user = m[2];
    uri.password = m[3];
    uri.hostname = m[4];
    uri.port = m[5];
    if (uri.hostname!==null)
    {
        uri.hostname = uri.hostname.toLowerCase();
        uri.host = uri.hostname+(uri.port ? ':'+uri.port : '');
    }
    // path
    if (!(m = re(path_section_re, remaining)))
        return {};
    uri.relative = m[0];
    uri.pathname = m[1];
    uri.search = m[2];
    uri.query = uri.search ? uri.search.substring(1) : null;
    uri.hash = m[3];
    // path elements
    if (!(m = re(strict ? path_re_strict : path_re_loose, uri.pathname)))
        return {};
    uri.directory = m[1];
    uri.file = m[2];
    uri.ext = m[3];
    if (uri.file=='.'+uri.ext)
        uri.ext = null;
    // finals
    if (!uri.pathname)
        uri.pathname = '/';
    uri.path = uri.pathname+(uri.search||'');
    uri.href = E.uri_obj_href(uri);
    return uri;
};

E.qs_parse = function(q, bin){
    var obj = {};
    q = q.split('&');
    var len = q.length;
    var unescape_val = bin ? function(val){
        return qs.unescapeBuffer(val, true).toString('binary');
    } : function(val){
        return decodeURIComponent(val.replace(/\+/g, ' '));
    };
    for (var i = 0; i<len; ++i)
    {
	var x = q[i];
	var idx = x.indexOf('=');
	var kstr = idx>=0 ? x.substr(0, idx) : x;
	var vstr = idx>=0 ? x.substr(idx + 1) : '';
        var k = unescape_val(kstr);
        var v = unescape_val(vstr);
	if (obj[k]===undefined)
	    obj[k] = v;
	else if (Array.isArray(obj[k]))
	    obj[k].push(v);
	else
	    obj[k] = [obj[k], v];
    }
    return obj;
};

function token_regex(s, end){ return end ? '^'+s+'$' : s; }

E.http_glob_host = function(host, end){
    var port = '';
    var parts = host.split(':');
    host = parts[0];
    if (parts.length>1)
        port = ':'+parts[1].replace('*', '[0-9]+');
    var n = host.match(/^(|.*[^*])(\*+)$/);
    if (n)
    {
        host = E.http_glob_host(n[1])
        +(n[2].length==1 ? '[^./]+' : '[^/]'+(n[1] ? '*' : '+'));
        return token_regex(host+port, end);
    }
    /* '**' replace doesn't use '*' in output to avoid conflict with '*'
     * replace following it */
    host = host.replace(/\*\*\./, '**').replace(/\*\./, '*')
    .replace(/\./g, '\\.').replace(/\*\*/g, '(([^./]+\\.)+)?')
    .replace(/\*/g, '[^./]+\\.');
    return token_regex(host+port, end);
};

E.http_glob_path = function(path, end){
    if (path[0]=='*')
	return E.http_glob_path('/'+path, end);
    var n = path.match(/^(|.*[^*])(\*+)([^*^\/]*)$/);
    if (n)
    {
	path = E.http_glob_path(n[1])+(n[2].length==1 ? '[^/]+' : '.*')+
	    E.http_glob_path(n[3]);
	return token_regex(path, end);
    }
    path = path.replace(/\*\*\//, '**').replace(/\*\//, '*')
    .replace(/\//g, '\\/').replace(/\./g, '\\.')
    .replace(/\*\*/g, '(([^/]+\\/)+)?').replace(/\*/g, '[^/]+\\/');
    return token_regex(path, end);
};

E.http_glob_url = function(url, end){
    var n = url.match(/^((.*):\/\/)?([^\/]+)(\/.*)?$/);
    if (!n)
	return null;
    var prot = n[1] ? n[2] : '*';
    var host = n[3];
    var path = n[4]||'**';
    if (prot=='*')
	prot = 'https?';
    host = E.http_glob_host(host);
    path = E.http_glob_path(path);
    return token_regex(prot+':\\/\\/'+host+path, end);
};

E.root_url_cmp = function(a, b){
    var a_s = a.match(/^[*.]*([^*]+)$/);
    var b_s = b.match(/^[*.]*([^*]+)$/);
    if (!a_s && !b_s)
	return false;
    var re, s;
    if (a_s && b_s && a_s[1].length>b_s[1].length || a_s && !b_s)
    {
	s = a_s[1];
	re = b;
    }
    else
    {
	s = b_s[1];
	re = a;
    }
    s = E.add_proto(s)+'/';
    if (!(re = E.http_glob_url(re, 1)))
	return false;
    try { re = new RegExp(re); }
    catch(e){ return false; }
    return re.test(s);
};

E.qs_strip = function(url){ return /^[^?#]*/.exec(url)[0]; };

// mini-implementation of zescape.qs to avoid dependency of escape.js
function qs_str(qs){
    var q = [];
    for (var k in qs)
    {
        (Array.isArray(qs[k]) ? qs[k] : [qs[k]]).forEach(function(v){
            q.push(encodeURIComponent(k)+'='+encodeURIComponent(v)); });
    }
    return q.join('&');
}

E.qs_add = function(url, qs){
    var u = E.parse(url), q = assign(u.query ? E.qs_parse(u.query) : {}, qs);
    u.path = u.pathname+'?'+qs_str(q);
    return E.uri_obj_href(u);
};

return E; }.apply(exports, __WEBPACK_AMD_DEFINE_ARRAY__),
				__WEBPACK_AMD_DEFINE_RESULT__ !== undefined && (module.exports = __WEBPACK_AMD_DEFINE_RESULT__)); }());


/***/ }),
/* 182 */,
/* 183 */,
/* 184 */,
/* 185 */,
/* 186 */,
/* 187 */,
/* 188 */,
/* 189 */,
/* 190 */,
/* 191 */,
/* 192 */,
/* 193 */,
/* 194 */,
/* 195 */,
/* 196 */,
/* 197 */,
/* 198 */,
/* 199 */,
/* 200 */,
/* 201 */,
/* 202 */,
/* 203 */,
/* 204 */,
/* 205 */,
/* 206 */,
/* 207 */,
/* 208 */,
/* 209 */,
/* 210 */,
/* 211 */,
/* 212 */,
/* 213 */,
/* 214 */,
/* 215 */,
/* 216 */,
/* 217 */,
/* 218 */,
/* 219 */,
/* 220 */,
/* 221 */,
/* 222 */,
/* 223 */,
/* 224 */,
/* 225 */,
/* 226 */,
/* 227 */,
/* 228 */,
/* 229 */,
/* 230 */,
/* 231 */,
/* 232 */,
/* 233 */
/***/ (function(module, exports, __webpack_require__) {

var __WEBPACK_AMD_DEFINE_ARRAY__, __WEBPACK_AMD_DEFINE_RESULT__;
var module;
// LICENSE_CODE ZON ISC
'use strict'; /*zlint node, br*/
(function(){
var  node_util;
var is_node = typeof module=='object' && module.exports && module.children;
var is_ff_addon = typeof module=='object' && module.uri
    && !module.uri.indexOf('resource://');
if (is_ff_addon)
    ;
else if (!is_node)
    ;
else
{
    node_util = require('util');
    ;
}
!(__WEBPACK_AMD_DEFINE_ARRAY__ = [__webpack_require__(143)], __WEBPACK_AMD_DEFINE_RESULT__ = function(array){
var E = {};

E._is_mocha = undefined;
E.is_mocha = function(){
    if (E._is_mocha!==undefined)
        return E._is_mocha;
    if (typeof process!='undefined')
        return E._is_mocha = process.env.IS_MOCHA||false;
    return E._is_mocha = false;
};

E.is_lxc = function(){ return is_node && +process.env.LXC; };

E.f_mset = function(flags, mask, bits){ return (flags &~ mask) | bits; };
E.f_lset = function(flags, bits, logic){
    return E.f_mset(flags, bits, logic ? bits : 0); };
E.f_meq = function(flags, mask, bits){ return (flags & mask)==bits; };
E.f_eq = function(flags, bits){ return (flags & bits)==bits; };
E.f_cmp = function(f1, f2, mask){ return (f1 & mask)==(f2 & mask); };
E.xor = function(a, b){ return !a != !b; };
E.div_ceil = function(a, b){ return Math.floor((a+b-1)/b); };
E.ceil_mul = function(a, b){ return E.div_ceil(a, b)*b; };
E.floor_mul = function(a, b){ return Math.floor(a/b)*b; };

E.range = function(x, a, b){ return x>=a && x<=b; };
E.range.ii = function(x, a, b){ return x>=a && x<=b; };
E.range.ie = function(x, a, b){ return x>=a && x<b; };
E.range.ei = function(x, a, b){ return x>a && x<=b; };
E.range.ee = function(x, a, b){ return x>a && x<b; };

E.clamp = function(lower_bound, value, upper_bound){
    if (value < lower_bound)
        return lower_bound;
    if (value < upper_bound)
        return value;
    return upper_bound;
};

/* Union given objects, using fn to resolve conflicting keys */
E.union_with = function(fn /*[o1, [o2, [...]]]*/){
    var res = {}, args;
    if (arguments.length==2 && typeof arguments[1]=='object')
        args = arguments[1];
    else
        args = array.slice(arguments, 1);
    for (var i = 0; i < args.length; ++i)
    {
        for (var key in args[i])
	{
	    var arg = args[i];
	    res[key] = res.hasOwnProperty(key) ? fn(res[key], arg[key])
		: arg[key];
	}
    }
    return res;
};

function _clone_deep(obj){
    var i, n, ret;
    if (obj instanceof Array)
    {
	ret = new Array(obj.length);
	n = obj.length;
	for (i = 0; i < n; i++)
	    ret[i] = obj[i] instanceof Object ? _clone_deep(obj[i]): obj[i];
	return ret;
    }
    else if (obj instanceof Date)
	return new Date(obj);
    else if (obj instanceof RegExp)
	return new RegExp(obj);
    // XXX romank: properly clone function
    else if (obj instanceof Function)
        return obj;
    ret = {};
    for (i in obj)
	ret[i] = obj[i] instanceof Object ? _clone_deep(obj[i]) : obj[i];
    return ret;
}

E.clone_deep = function(obj){
    if (!(obj instanceof Object))
	return obj;
    return _clone_deep(obj);
};

// prefer to normally Object.assign() instead of extend()
E.extend = function(obj){ // like _.extend
    for (var i=1; i<arguments.length; i++)
    {
	var source = arguments[i];
	if (!source)
	    continue;
        for (var prop in source)
	    obj[prop] = source[prop];
    }
    return obj;
};

function is_object(obj){
    return obj && obj.constructor==Object; }

E.extend_deep = function(obj){
    for (var i=1; i<arguments.length; i++)
    {
        var source = arguments[i];
        if (!source)
            continue;
        for (var prop in source)
        {
            if (is_object(source[prop]) && is_object(obj[prop]))
                E.extend_deep(obj[prop], source[prop]);
            else
                obj[prop] = source[prop];
        }
    }
    return obj;
};
E.extend_deep_del_null = function(obj){
    for (var i=1; i<arguments.length; i++)
    {
        var source = arguments[i];
        if (!source)
            continue;
        for (var prop in source)
        {
            if (is_object(source[prop]))
            {
                if (!is_object(obj[prop]))
                    obj[prop] = {};
                E.extend_deep_del_null(obj[prop], source[prop]);
            }
            else if (source[prop]==null)
                delete obj[prop];
            else
                obj[prop] = source[prop];
        }
    }
    return obj;
};

E.clone = function(obj){ // like _.clone
    if (!(obj instanceof Object))
	return obj;
    if (obj instanceof Array)
    {
	var a = new Array(obj.length);
	for (var i=0; i<obj.length; i++)
	    a[i] = obj[i];
	return a;
    }
    return E.extend({}, obj);
};

// like _.map() except returns object, not array
E.map_obj = function(obj, fn){
    var ret = {};
    for (var i in obj)
        ret[i] = fn(obj[i], i, obj);
    return ret;
};

// recursivelly recreate objects with keys added in order
E.sort_obj = function(obj){
    if (obj instanceof Array || !(obj instanceof Object))
	return obj;
    var ret = {}, keys = Object.keys(obj).sort();
    for (var i=0; i<keys.length; i++)
	ret[keys[i]] = E.sort_obj(obj[keys[i]]);
    return ret;
};

// an Object equivalent of Array.prototype.forEach
E.forEach = function(obj, fn, _this){
    for (var i in obj)
        fn.call(_this, obj[i], i, obj);
};
// an Object equivalent of Array.prototype.find
E.find = function(obj, fn, _this){
    for (var i in obj)
    {
        if (fn.call(_this, obj[i], i, obj))
            return obj[i];
    }
};
E.find_prop = function(obj, prop, val){
    return E.find(obj, function(o){ return o[prop]===val; }); };
E.isspace = function(c){ return /\s/.test(c); };
E.isdigit = function(c){ return c>='0' && c<='9'; };
E.isalpha = function(c){ return (c>='a' && c<='z') || (c>='A' && c<='Z'); };
E.isalnum = function(c){ return E.isdigit(c)||E.isalpha(c); };

E.obj_pluck = function(obj, prop){
    var val = obj[prop];
    delete obj[prop];
    return val;
};

// Object.keys() does not work on prototype
E.proto_keys = function(proto){
    var keys = [];
    for (var i in proto)
	keys.push(i);
    return keys;
};

E.values = function(obj){
    var values = [];
    for (var i in obj)
        values.push(obj[i]);
    return values;
};

E.path = function(path){
    if (Array.isArray(path))
        return path;
    path = ''+path;
    if (!path)
        return [];
    return path.split('.');
};
E.get = function(o, path, def){
    path = E.path(path);
    for (var i=0; i<path.length; i++)
    {
	if (!o || !(path[i] in o))
	    return def;
	o = o[path[i]];
    }
    return o;
};
E.set = function(o, path, value){
    path = E.path(path);
    for (var i=0; i<path.length-1; i++)
    {
        var p = path[i];
        o = o[p] || (o[p] = {});
    }
    o[path[path.length-1]] = value;
};
var has_unique = {};
E.has = function(o, path){ return E.get(o, path, has_unique)!==has_unique; };
E.own = function(o, prop){
    return Object.prototype.hasOwnProperty.call(o, prop); };

E.bool_lookup = function(a, split){
    var ret = {}, i;
    if (typeof a=='string')
	a = a.split(split||/\s/);
    for (i=0; i<a.length; i++)
	ret[a[i]] = true;
    return ret;
};

E.clone_inplace = function(dst, src){
    if (dst===src)
        return dst;
    if (Array.isArray(dst))
    {
        for (var i=0; i<src.length; i++)
            dst[i] = src[i];
        dst.splice(src.length);
    }
    else if (typeof dst=='object')
    {
        for (var k in src)
            dst[k] = src[k];
        for (k in dst)
        {
            if (!src.hasOwnProperty(k))
                delete dst[k];
        }
    }
    return dst;
};

if (node_util)
    E.inherits = node_util.inherits;
else
{
    // implementation from node.js 'util' module
    E.inherits = function inherits(ctor, superCtor){
	ctor.super_ = superCtor;
	ctor.prototype = Object.create(superCtor.prototype,
            {constructor: {value: ctor, enumerable: false, writable: true,
	    configurable: true}});
    };
}

// ctor must only have one prototype level
// XXX vladislav: ES6 class is not supported for ctor
E.inherit_init = function(obj, ctor, params){
    var orig_proto = Object.getPrototypeOf(obj);
    var ctor_proto = Object.assign({}, ctor.prototype);
    Object.setPrototypeOf(ctor_proto, orig_proto);
    Object.setPrototypeOf(obj, ctor_proto);
    return ctor.apply(obj, params);
};

E.pick = function(obj){
    var i, o = {};
    for (i=1; i<arguments.length; i++)
    {
        if (E.own(obj, arguments[i]))
            o[arguments[i]] = obj[arguments[i]];
    }
    return o;
};

return E; }.apply(exports, __WEBPACK_AMD_DEFINE_ARRAY__),
				__WEBPACK_AMD_DEFINE_RESULT__ !== undefined && (module.exports = __WEBPACK_AMD_DEFINE_RESULT__)); }());


/***/ }),
/* 234 */,
/* 235 */,
/* 236 */,
/* 237 */,
/* 238 */,
/* 239 */,
/* 240 */,
/* 241 */,
/* 242 */,
/* 243 */,
/* 244 */,
/* 245 */,
/* 246 */,
/* 247 */,
/* 248 */,
/* 249 */,
/* 250 */,
/* 251 */,
/* 252 */,
/* 253 */,
/* 254 */,
/* 255 */,
/* 256 */,
/* 257 */,
/* 258 */,
/* 259 */,
/* 260 */,
/* 261 */,
/* 262 */,
/* 263 */,
/* 264 */,
/* 265 */,
/* 266 */,
/* 267 */,
/* 268 */
/***/ (function(module, exports, __webpack_require__) {

var __WEBPACK_AMD_DEFINE_ARRAY__, __WEBPACK_AMD_DEFINE_RESULT__;
var module;
// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, browser:true*/
(function(){

var if_node_ff = typeof module=='object' && module.exports;
if (!if_node_ff)
    ;
else
    ;
!(__WEBPACK_AMD_DEFINE_ARRAY__ = [], __WEBPACK_AMD_DEFINE_RESULT__ = function(){
var E = {};
E.un = {};

var html_escape_table = {
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'};
E.html = function(html){
    return html.replace(/[&<>"']/g, function(m){
	return html_escape_table[m[0]]; });
};

E.sh = function(s_or_a){
    function single(s){
        s = ''+s; // supports also numbers
        if (!s)
            return '""';
        if (/^[a-z0-9_\-.\/:]+$/i.test(s))
            return s;
        return '"'+s.replace(/([\\"`$])/g, '\\$1')+'"';
    }
    if (arguments.length==1 && !Array.isArray(s_or_a))
        return single(s_or_a);
    var s = '', a = Array.isArray(s_or_a) ? s_or_a : arguments;
    for (var i=0; i<a.length; i++)
	s += (i ? ' ' : '')+single(a[i]);
    return s;
};

E.un_sh = function(s, keep_esc){
    var state = {PARSE_STATE_INIT: 0, PARSE_STATE_NORMAL_ARG: 1,
        PARSE_STATE_QUOTE_ARG: 2}, cur_state = state.PARSE_STATE_INIT;
    var i, quote = 0, argv = [], a = '';
    for (i=0; i<s.length; i++)
    {
	var esc = 0;
	a += s[i];
        if (s[i]=='\\' && s[1])
	{
	    if (!keep_esc)
		a = a.slice(0, -1);
	    esc = 1;
	    i++;
	    a += s[i];
        }
        switch (cur_state)
        {
        case state.PARSE_STATE_INIT:
            switch (s[i])
            {
	    case '\r': case '\n': case ' ': case '\t':
		if (!esc)
		{
		    a = '';
		    break;
		}
                /*jslint -W086*/ // fall through
            case '"': case '\'':
                if (!esc)
                {
                    cur_state = state.PARSE_STATE_QUOTE_ARG;
		    if (!keep_esc)
			a = a.slice(0, -1);
                    quote = s[i];
                    break;
                }
                /*jslint -W086*/ // fall through
            default: cur_state = state.PARSE_STATE_NORMAL_ARG;
            }
            break;
        case state.PARSE_STATE_NORMAL_ARG:
            switch (s[i])
            {
	    case '\r': case '\n': case ' ': case '\t':
		if (!esc)
		{
                    cur_state = state.PARSE_STATE_INIT;
		    a = a.slice(0, -1);
		    argv.push(a);
		    a = '';
		}
		break;
	    case '"': case '\'':
                if (!esc)
                {
		    cur_state = state.PARSE_STATE_QUOTE_ARG;
                    quote = s[i];
		    if (!keep_esc)
		        a = a.slice(0, -1);
                }
		break;
            }
            break;
        case state.PARSE_STATE_QUOTE_ARG:
            if (s[i]==quote && !esc)
            {
		cur_state = state.PARSE_STATE_NORMAL_ARG;
		if (!keep_esc)
		    a = a.slice(0, -1);
            }
            break;
        }
    }
    if (cur_state==state.PARSE_STATE_NORMAL_ARG)
    {
	cur_state = state.PARSE_STATE_INIT;
	argv.push(a);
    }
    if (cur_state!=state.PARSE_STATE_INIT)
	throw 'error parsing shell';
    return argv;
};

E.regex = function(s){ return s.replace(/[[\]{}()*+?.\\^$|\/]/g, '\\$&'); };

E.uri_comp = function(s){ return encodeURIComponent(s).replace(/%20/g, '+'); };

var http_escape_chars = [];
(function(){
    var i;
    for (i=0; i<256; i++)
    {
	var c = String.fromCharCode(i);
	http_escape_chars[i] = /^[a-zA-Z0-9_.~,\-]$/.test(c) ? c :
	    '%'+('0'+i.toString(16)).slice(-2);
    }
}());
E.encodeURIComponent_bin = function(s_or_b){
    // Browser does not have Buffer Object
    var s = Buffer && s_or_b instanceof Buffer ? s_or_b.toString('binary')
	: ''+s_or_b;
    var esc = '';
    for (var i = 0; i < s.length; i++)
	esc += http_escape_chars[s.charCodeAt(i)];
    return esc;
};

E.qs = function(param, opt){
    opt = opt||{};
    var qs = opt.qs||'';
    var sep = qs || opt.amp ? '&' : '';
    if (!param)
        return qs;
    var uri_comp = opt.space_plus===undefined || opt.space_plus ? E.uri_comp
        : encodeURIComponent;
    var uri_comp_val = opt.bin ? E.encodeURIComponent_bin : uri_comp;
    for (var i in param)
    {
	var val = param[i];
	if (val===undefined)
	    continue;
        var key = uri_comp(i);
        qs += sep;
        if (val===null)
            qs += key;
        else if (Array.isArray(val))
        {
            if (!val.length)
                continue;
            qs += val.map(function(val){ return key+'='+uri_comp_val(val); })
                .join('&');
        }
        else
            qs += key+'='+uri_comp_val(val);
	sep = '&';
    }
    return qs;
};

// uri(opt)
// uri(uri, qs, hash)
E.uri = function(uri, qs, hash){
    var opt;
    if (typeof uri=='string')
        opt = {uri: uri, _qs: qs, hash: hash};
    else
    {
        opt = Object.assign({}, uri);
        opt._qs = opt.qs;
        opt.qs = undefined;
    }
    uri = opt.uri;
    qs = typeof opt._qs=='string' ? opt._qs : E.qs(opt._qs, opt);
    hash = typeof opt.hash=='string' ? opt.hash : E.qs(opt.hash, opt);
    if (qs)
    {
        if (!uri.includes('?'))
            uri += '?';
        else if (uri[uri.length-1]!='?' && uri[uri.length-1]!='&')
            uri += '&';
    }
    else
        qs = '';
    if (hash)
        hash = '#'+hash;
    else
        hash = '';
    return uri+qs+hash;
};

E.mailto_url = function(mail){
    return 'mailto:'+(mail.to||'')+'?'
    +E.qs({cc: mail.cc, bcc: mail.bcc, subject: mail.subject, body: mail.body},
	{space_plus: false});
};

E.parse = {}; // should this move to parse.js?
E.parse.eat_token = function(s_obj, re){
    var match;
    if (!(match = re.exec(s_obj.s)))
	return match;
    s_obj.s = s_obj.s.substr(match.index+match[0].length);
    return match;
};

E.parse.http_words = function(val){
    // Translation from perl:
    // http://search.cpan.org/~gaas/HTTP-Message-6.06/lib/HTTP/Headers/Util.pm
    var res = [], o = {s: val}, eat_token = E.parse.eat_token, match;
    while (o.s)
    {
	// 'token' or parameter 'attribute'
	if (match = eat_token(o, /^\s*(=*[^\s=;,]+)/))
	{
	    var v = match[1];
	    // a quoted value
	    if (match = eat_token(o, /^\s*=\s*\"([^\"\\]*(?:\\.[^\"\\]*)*)\"/))
		res.push([v, match[1].replace(/\\(.)/, '$1')]);
	    // some unquoted value
	    else if (match = eat_token(o, /^\s*=\s*([^;,\s]*)/))
		res.push([v, match[1].replace(/\s+$/, '')]);
	    // no value, a lone token
	    else
		res.push([v, null]);
	}
	else if (match = eat_token(o, /^\s*,/));
	else if ((match = eat_token(o, /^\s*;/)) || (match = eat_token(o,
	    /^\s+/)));
	else
	    throw new Error('This should not happen: '+o.s);
    }
    return res;
};

return E; }.apply(exports, __WEBPACK_AMD_DEFINE_ARRAY__),
				__WEBPACK_AMD_DEFINE_RESULT__ !== undefined && (module.exports = __WEBPACK_AMD_DEFINE_RESULT__)); }());


/***/ }),
/* 269 */,
/* 270 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
// LICENSE_CODE ZON ISC
 /*jslint react:true, es6:true*/

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

__webpack_require__(536);

var _react = __webpack_require__(0);

var _react2 = _interopRequireDefault(_react);

var _prismjs = __webpack_require__(538);

var _prismjs2 = _interopRequireDefault(_prismjs);

var _instructions = __webpack_require__(539);

var _instructions2 = _interopRequireDefault(_instructions);

var _common = __webpack_require__(37);

var _util = __webpack_require__(29);

var _util2 = _interopRequireDefault(_util);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var ga_event = _util2.default.ga_event;

var Howto = function (_React$Component) {
    _inherits(Howto, _React$Component);

    function Howto(props) {
        _classCallCheck(this, Howto);

        var _this = _possibleConstructorReturn(this, (Howto.__proto__ || Object.getPrototypeOf(Howto)).call(this, props));

        _this.state = {};
        return _this;
    }

    _createClass(Howto, [{
        key: 'render_children',
        value: function render_children() {
            var _this2 = this;

            return _react2.default.Children.map(this.props.children, function (child) {
                return _react2.default.cloneElement(child, {
                    on_click: child.props.on_click(_this2.state.option) });
            });
        }
    }, {
        key: 'choose_click',
        value: function choose_click(option) {
            if (this.props.ga_category == 'onboarding') ga_event('lpm-onboarding', '06 select code/browser', option);else if (this.props.ga_category == 'how-to-use') ga_event('How-to-tab', 'select code/browser', option);
            this.setState({ option: option });
        }
    }, {
        key: 'render',
        value: function render() {
            var _this3 = this;

            var subheader = void 0;
            if (this.state.option) subheader = 'using ' + this.state.option;
            var Instructions = function Instructions() {
                return null;
            };
            if (this.state.option == 'browser') Instructions = Browser_instructions;else if (this.state.option == 'code') Instructions = Code_instructions;
            return _react2.default.createElement(
                'div',
                { className: 'intro lpm' },
                _react2.default.createElement(
                    'div',
                    { className: 'howto' },
                    _react2.default.createElement(
                        'h1',
                        { className: 'header' },
                        'Make your first request'
                    ),
                    _react2.default.createElement(Subheader, { value: subheader }),
                    _react2.default.createElement(
                        'div',
                        { className: 'choices' },
                        _react2.default.createElement(Choice, { option: 'Browser',
                            selected: this.state.option == 'browser',
                            on_click: function on_click() {
                                return _this3.choose_click('browser');
                            } }),
                        _react2.default.createElement(
                            'div',
                            { className: 'text_middle' },
                            'or'
                        ),
                        _react2.default.createElement(Choice, { option: 'Code',
                            selected: this.state.option == 'code',
                            on_click: function on_click() {
                                return _this3.choose_click('code');
                            } })
                    ),
                    _react2.default.createElement(
                        Instructions,
                        { ga_cat: this.props.ga_category },
                        this.props.children
                    ),
                    this.state.option ? this.render_children() : null
                )
            );
        }
    }]);

    return Howto;
}(_react2.default.Component);

var Subheader = function Subheader(props) {
    return props.value ? _react2.default.createElement(
        'h1',
        { className: 'sub_header' },
        props.value
    ) : null;
};

var Lang_btn = function Lang_btn(props) {
    var class_names = 'btn btn_lpm btn_lpm_default btn_lpm_small btn_lang' + (props.active ? ' active' : '');
    return _react2.default.createElement(
        'button',
        { className: class_names },
        props.text
    );
};

var Code_instructions = function (_React$Component2) {
    _inherits(Code_instructions, _React$Component2);

    function Code_instructions(props) {
        _classCallCheck(this, Code_instructions);

        var _this4 = _possibleConstructorReturn(this, (Code_instructions.__proto__ || Object.getPrototypeOf(Code_instructions)).call(this, props));

        _this4.state = { lang: 'shell' };
        _this4.category = 'lpm-code-examples' + '-' + _this4.props.ga_cat;
        return _this4;
    }

    _createClass(Code_instructions, [{
        key: 'click_lang',
        value: function click_lang(lang) {
            this.setState({ lang: lang });
            ga_event(this.category, 'selected option', lang);
        }
    }, {
        key: 'click_copy',
        value: function click_copy(lang) {
            ga_event(this.category, 'click copy', lang);
        }
    }, {
        key: 'render',
        value: function render() {
            var _this5 = this;

            var Lang_btn_clickable = function Lang_btn_clickable(props) {
                return _react2.default.createElement(
                    'span',
                    { onClick: function onClick() {
                            return _this5.click_lang(props.lang);
                        } },
                    _react2.default.createElement(Lang_btn, _extends({ active: _this5.state.lang == props.lang }, props))
                );
            };
            var tutorial_port = window.localStorage.getItem('quickstart-first-proxy') || 24000;
            var code = _prismjs2.default.highlight(_instructions2.default.code(tutorial_port)[this.state.lang], _prismjs2.default.languages.clike);
            return _react2.default.createElement(
                'div',
                { className: 'code_instructions' },
                _react2.default.createElement(
                    'div',
                    { className: 'well header_well' },
                    _react2.default.createElement(Lang_btn_clickable, { lang: 'shell', text: 'Shell' }),
                    _react2.default.createElement(Lang_btn_clickable, { lang: 'node', text: 'Node.js' }),
                    _react2.default.createElement(Lang_btn_clickable, { lang: 'java', text: 'Java' }),
                    _react2.default.createElement(Lang_btn_clickable, { lang: 'csharp', text: 'C#' }),
                    _react2.default.createElement(Lang_btn_clickable, { lang: 'vb', text: 'VB' }),
                    _react2.default.createElement(Lang_btn_clickable, { lang: 'php', text: 'PHP' }),
                    _react2.default.createElement(Lang_btn_clickable, { lang: 'python', text: 'Python' }),
                    _react2.default.createElement(Lang_btn_clickable, { lang: 'ruby', text: 'Ruby' }),
                    _react2.default.createElement(Lang_btn_clickable, { lang: 'perl', text: 'Perl' })
                ),
                _react2.default.createElement(
                    'div',
                    { className: 'well instructions_well' },
                    _react2.default.createElement(
                        'pre',
                        null,
                        _react2.default.createElement(
                            'code',
                            null,
                            _react2.default.createElement(
                                _common.Code,
                                { id: this.state.lang,
                                    on_click: function on_click() {
                                        return _this5.click_copy(_this5.state.lang);
                                    } },
                                _react2.default.createElement('div', { dangerouslySetInnerHTML: { __html: code } })
                            )
                        )
                    )
                )
            );
        }
    }]);

    return Code_instructions;
}(_react2.default.Component);

var Browser_instructions = function (_React$Component3) {
    _inherits(Browser_instructions, _React$Component3);

    function Browser_instructions(props) {
        _classCallCheck(this, Browser_instructions);

        var _this6 = _possibleConstructorReturn(this, (Browser_instructions.__proto__ || Object.getPrototypeOf(Browser_instructions)).call(this, props));

        _this6.state = { browser: 'chrome_win' };
        _this6.category = 'lpm-browser-examples' + '-' + _this6.props.ga_cat;
        _this6.port = window.localStorage.getItem('quickstart-first-proxy') || 24000;
        return _this6;
    }

    _createClass(Browser_instructions, [{
        key: 'browser_changed',
        value: function browser_changed(e) {
            var browser = e.target.value;
            this.setState({ browser: browser });
            ga_event(this.category, 'select option', browser);
        }
    }, {
        key: 'render',
        value: function render() {
            return _react2.default.createElement(
                'div',
                { className: 'browser_instructions' },
                _react2.default.createElement(
                    'div',
                    { className: 'well header_well' },
                    _react2.default.createElement(
                        'p',
                        null,
                        'Choose browser'
                    ),
                    _react2.default.createElement(
                        'select',
                        { onChange: this.browser_changed.bind(this) },
                        _react2.default.createElement(
                            'option',
                            { value: 'chrome_win' },
                            'Chrome Windows'
                        ),
                        _react2.default.createElement(
                            'option',
                            { value: 'chrome_mac' },
                            'Chrome Mac'
                        ),
                        _react2.default.createElement(
                            'option',
                            { value: 'ie' },
                            'Internet Explorer'
                        ),
                        _react2.default.createElement(
                            'option',
                            { value: 'firefox' },
                            'Firefox'
                        ),
                        _react2.default.createElement(
                            'option',
                            { value: 'safari' },
                            'Safari'
                        )
                    )
                ),
                _react2.default.createElement(
                    'div',
                    { className: 'well instructions_well' },
                    _react2.default.createElement(
                        'div',
                        { className: 'instructions' },
                        _instructions2.default.browser(this.port)[this.state.browser]
                    )
                )
            );
        }
    }]);

    return Browser_instructions;
}(_react2.default.Component);

var Choice = function Choice(props) {
    var c = 'choice' + (props.selected ? ' active' : '');
    return _react2.default.createElement(
        'div',
        { className: c, onClick: props.on_click },
        _react2.default.createElement(
            'div',
            { className: 'content' },
            _react2.default.createElement(
                'div',
                { className: 'text_smaller' },
                'Using'
            ),
            _react2.default.createElement(
                'div',
                { className: 'text_bigger' },
                props.option
            )
        )
    );
};

exports.default = Howto;

/***/ }),
/* 271 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, "__esModule", {
  value: true
});

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _debounce = __webpack_require__(544);

var _debounce2 = _interopRequireDefault(_debounce);

var _propTypes = __webpack_require__(1);

var _propTypes2 = _interopRequireDefault(_propTypes);

var _react = __webpack_require__(0);

var _react2 = _interopRequireDefault(_react);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _objectWithoutProperties(obj, keys) { var target = {}; for (var i in obj) { if (keys.indexOf(i) >= 0) continue; if (!Object.prototype.hasOwnProperty.call(obj, i)) continue; target[i] = obj[i]; } return target; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var DEFAULT_DELAY_MS = 200;

/**
 * HoC that encapsulates common behavior and functionality for doing
 * asynchronous searches, including:
 *
 *  - Debouncing user input
 *  - Query caching (optional)
 *  - Search prompt and empty results behaviors
 */
var asyncContainer = function asyncContainer(Typeahead) {
  var Container = function (_React$Component) {
    _inherits(Container, _React$Component);

    function Container() {
      var _ref;

      var _temp, _this, _ret;

      _classCallCheck(this, Container);

      for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
        args[_key] = arguments[_key];
      }

      return _ret = (_temp = (_this = _possibleConstructorReturn(this, (_ref = Container.__proto__ || Object.getPrototypeOf(Container)).call.apply(_ref, [this].concat(args))), _this), _this.state = {
        hasSelection: false,
        query: ''
      }, _this._getEmptyLabel = function () {
        var _this$props = _this.props,
            emptyLabel = _this$props.emptyLabel,
            isLoading = _this$props.isLoading,
            multiple = _this$props.multiple,
            promptText = _this$props.promptText,
            searchText = _this$props.searchText,
            useCache = _this$props.useCache;
        var _this$state = _this.state,
            hasSelection = _this$state.hasSelection,
            query = _this$state.query;


        if (!query.length || !multiple && hasSelection) {
          return promptText;
        }

        if (isLoading || useCache && !_this._cache[query]) {
          return searchText;
        }

        return emptyLabel;
      }, _this._handleChange = function (selected) {
        _this.setState({ hasSelection: !!selected.length }, function () {
          _this.props.onChange && _this.props.onChange(selected);
        });
      }, _this._handleInputChange = function (query) {
        _this.props.onInputChange && _this.props.onInputChange(query);
        _this._handleSearchDebounced(query);
      }, _this._handleSearch = function (initialQuery) {
        var _this$props2 = _this.props,
            caseSensitive = _this$props2.caseSensitive,
            minLength = _this$props2.minLength,
            multiple = _this$props2.multiple,
            onSearch = _this$props2.onSearch,
            useCache = _this$props2.useCache;


        var query = initialQuery.trim();
        if (!caseSensitive) {
          query = query.toLowerCase();
        }

        _this.setState({ query: query });

        if (!query || minLength && query.length < minLength) {
          return;
        }

        // Use cached results, if available.
        if (useCache && _this._cache[query]) {
          return;
        }

        // In the single-selection case, perform a search only on user input
        // not selection.
        if (!multiple && _this.state.hasSelection) {
          return;
        }

        // Perform the search.
        onSearch(query);
      }, _temp), _possibleConstructorReturn(_this, _ret);
    }

    _createClass(Container, [{
      key: 'componentWillMount',
      value: function componentWillMount() {
        this._cache = {};
        this._handleSearchDebounced = (0, _debounce2.default)(this._handleSearch, this.props.delay);
      }
    }, {
      key: 'componentWillReceiveProps',
      value: function componentWillReceiveProps(nextProps) {
        var options = nextProps.options,
            useCache = nextProps.useCache;


        if (!this.props.isLoading) {
          return;
        }

        if (useCache) {
          this._cache[this.state.query] = options;
        }
      }
    }, {
      key: 'componentWillUnmount',
      value: function componentWillUnmount() {
        this._cache = {};
        this._handleSearchDebounced.cancel();
      }
    }, {
      key: 'render',
      value: function render() {
        var _this2 = this;

        var _props = this.props,
            allowNew = _props.allowNew,
            options = _props.options,
            useCache = _props.useCache,
            props = _objectWithoutProperties(_props, ['allowNew', 'options', 'useCache']);

        var cachedQuery = this._cache[this.state.query];
        var emptyLabel = this._getEmptyLabel();

        // Short-circuit the creation of custom selections while the user is in
        // the process of searching. The logic for whether or not to display the
        // custom menu option is basically the same as whether we display the
        // empty label, so use that as a proxy.
        var shouldAllowNew = allowNew && emptyLabel === props.emptyLabel;

        return _react2.default.createElement(Typeahead, _extends({}, props, {
          allowNew: shouldAllowNew,
          emptyLabel: emptyLabel,
          onChange: this._handleChange,
          onInputChange: this._handleInputChange,
          options: useCache && cachedQuery ? cachedQuery : options,
          ref: function ref(instance) {
            return _this2._instance = instance;
          }
        }));
      }

      /**
       * Make the component instance available.
       */

    }, {
      key: 'getInstance',
      value: function getInstance() {
        return this._instance.getInstance();
      }
    }]);

    return Container;
  }(_react2.default.Component);

  Container.propTypes = {
    /**
     * Delay, in milliseconds, before performing search.
     */
    delay: _propTypes2.default.number,
    /**
     * Whether or not a request is currently pending. Necessary for the
     * container to know when new results are available.
     */
    isLoading: _propTypes2.default.bool.isRequired,
    /**
     * Callback to perform when the search is executed.
     */
    onSearch: _propTypes2.default.func.isRequired,
    /**
     * Options to be passed to the typeahead. Will typically be the query
     * results, but can also be initial default options.
     */
    options: _propTypes2.default.array,
    /**
     * Text displayed in the menu when there is no user input.
     */
    promptText: _propTypes2.default.string,
    /**
     * Text displayed in the menu while the request is pending.
     */
    searchText: _propTypes2.default.string,
    /**
     * Whether or not the component should cache query results.
     */
    useCache: _propTypes2.default.bool
  };

  Container.defaultProps = {
    delay: DEFAULT_DELAY_MS,
    minLength: 2,
    options: [],
    promptText: 'Type to search...',
    searchText: 'Searching...',
    useCache: true
  };

  return Container;
};

exports.default = asyncContainer;

/***/ }),
/* 272 */
/***/ (function(module, exports, __webpack_require__) {

/* WEBPACK VAR INJECTION */(function(global) {/** Detect free variable `global` from Node.js. */
var freeGlobal = typeof global == 'object' && global && global.Object === Object && global;

module.exports = freeGlobal;

/* WEBPACK VAR INJECTION */}.call(exports, __webpack_require__(83)))

/***/ }),
/* 273 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, "__esModule", {
  value: true
});

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _classnames = __webpack_require__(5);

var _classnames2 = _interopRequireDefault(_classnames);

var _react = __webpack_require__(0);

var _react2 = _interopRequireDefault(_react);

var _Overlay = __webpack_require__(549);

var _Overlay2 = _interopRequireDefault(_Overlay);

var _TypeaheadInput = __webpack_require__(608);

var _TypeaheadInput2 = _interopRequireDefault(_TypeaheadInput);

var _TypeaheadMenu = __webpack_require__(649);

var _TypeaheadMenu2 = _interopRequireDefault(_TypeaheadMenu);

var _typeaheadContainer = __webpack_require__(668);

var _typeaheadContainer2 = _interopRequireDefault(_typeaheadContainer);

var _utils = __webpack_require__(54);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var Typeahead = function (_React$Component) {
  _inherits(Typeahead, _React$Component);

  function Typeahead() {
    var _ref;

    var _temp, _this, _ret;

    _classCallCheck(this, Typeahead);

    for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
      args[_key] = arguments[_key];
    }

    return _ret = (_temp = (_this = _possibleConstructorReturn(this, (_ref = Typeahead.__proto__ || Object.getPrototypeOf(Typeahead)).call.apply(_ref, [this].concat(args))), _this), _this._renderMenu = function (results, shouldPaginate, menuVisible) {
      var _this$props = _this.props,
          align = _this$props.align,
          bodyContainer = _this$props.bodyContainer,
          className = _this$props.className,
          dropup = _this$props.dropup,
          emptyLabel = _this$props.emptyLabel,
          labelKey = _this$props.labelKey,
          maxHeight = _this$props.maxHeight,
          newSelectionPrefix = _this$props.newSelectionPrefix,
          onMenuHide = _this$props.onMenuHide,
          onMenuShow = _this$props.onMenuShow,
          onPaginate = _this$props.onPaginate,
          paginationText = _this$props.paginationText,
          renderMenu = _this$props.renderMenu,
          renderMenuItemChildren = _this$props.renderMenuItemChildren,
          text = _this$props.text;


      var menuProps = {
        align: align,
        dropup: dropup,
        emptyLabel: emptyLabel,
        labelKey: labelKey,
        maxHeight: maxHeight,
        newSelectionPrefix: newSelectionPrefix,
        paginationText: paginationText,
        onPaginate: onPaginate,
        paginate: shouldPaginate,
        text: text
      };

      var menu = typeof renderMenu === 'function' ? renderMenu(results, menuProps) : _react2.default.createElement(_TypeaheadMenu2.default, _extends({}, menuProps, {
        options: results,
        renderMenuItemChildren: renderMenuItemChildren
      }));

      return _react2.default.createElement(
        _Overlay2.default,
        {
          align: align,
          className: className,
          container: bodyContainer ? document.body : _this,
          dropup: dropup,
          onMenuHide: onMenuHide,
          onMenuShow: onMenuShow,
          show: menuVisible,
          target: _this },
        menu
      );
    }, _temp), _possibleConstructorReturn(_this, _ret);
  }

  _createClass(Typeahead, [{
    key: 'componentWillReceiveProps',
    value: function componentWillReceiveProps(nextProps) {
      var allowNew = nextProps.allowNew,
          onInitialItemChange = nextProps.onInitialItemChange,
          onResultsChange = nextProps.onResultsChange,
          results = nextProps.results;

      // Clear the initial item when there are no results.

      if (!(allowNew || results.length)) {
        onInitialItemChange(null);
      }

      if (results.length !== this.props.results.length) {
        onResultsChange(results);
      }
    }
  }, {
    key: 'render',
    value: function render() {
      var _this2 = this;

      var _props = this.props,
          allowNew = _props.allowNew,
          className = _props.className,
          dropup = _props.dropup,
          emptyLabel = _props.emptyLabel,
          labelKey = _props.labelKey,
          minLength = _props.minLength,
          onInputChange = _props.onInputChange,
          _onKeyDown = _props.onKeyDown,
          onSelectionAdd = _props.onSelectionAdd,
          onSelectionRemove = _props.onSelectionRemove,
          paginate = _props.paginate,
          showMenu = _props.showMenu,
          shownResults = _props.shownResults,
          text = _props.text;


      var results = this.props.results.slice();

      // This must come before we truncate.
      var shouldPaginate = paginate && results.length > shownResults;

      // Truncate if necessary.
      results = (0, _utils.getTruncatedOptions)(results, shownResults);

      // Add the custom option.
      if (allowNew) {
        results = (0, _utils.addCustomOption)(results, text, labelKey);
      }

      var menuVisible = !!(showMenu && text.length >= minLength && (results.length || emptyLabel !== ''));

      return _react2.default.createElement(
        'div',
        {
          className: (0, _classnames2.default)('rbt', 'open', 'clearfix', { 'dropup': dropup }, className),
          style: { position: 'relative' },
          tabIndex: -1 },
        _react2.default.createElement(_TypeaheadInput2.default, _extends({}, this.props, {
          onAdd: onSelectionAdd,
          onChange: onInputChange,
          onKeyDown: function onKeyDown(e) {
            return _onKeyDown(results, e);
          },
          onRemove: onSelectionRemove,
          options: results,
          ref: function ref(input) {
            return _this2._input = input;
          }
        })),
        this._renderMenu(results, shouldPaginate, menuVisible),
        _react2.default.createElement(
          'div',
          {
            'aria-atomic': true,
            'aria-live': 'polite',
            className: 'sr-only rbt-sr-status',
            role: 'status' },
          (0, _utils.getAccessibilityStatus)(results, menuVisible, this.props)
        )
      );
    }
  }, {
    key: 'getInputNode',
    value: function getInputNode() {
      return this._input.getInputNode();
    }
  }]);

  return Typeahead;
}(_react2.default.Component);

exports.default = (0, _typeaheadContainer2.default)(Typeahead);

/***/ }),
/* 274 */
/***/ (function(module, exports, __webpack_require__) {

var ListCache = __webpack_require__(104),
    stackClear = __webpack_require__(556),
    stackDelete = __webpack_require__(557),
    stackGet = __webpack_require__(558),
    stackHas = __webpack_require__(559),
    stackSet = __webpack_require__(560);

/**
 * Creates a stack cache object to store key-value pairs.
 *
 * @private
 * @constructor
 * @param {Array} [entries] The key-value pairs to cache.
 */
function Stack(entries) {
  var data = this.__data__ = new ListCache(entries);
  this.size = data.size;
}

// Add methods to `Stack`.
Stack.prototype.clear = stackClear;
Stack.prototype['delete'] = stackDelete;
Stack.prototype.get = stackGet;
Stack.prototype.has = stackHas;
Stack.prototype.set = stackSet;

module.exports = Stack;


/***/ }),
/* 275 */
/***/ (function(module, exports) {

/** Used for built-in method references. */
var funcProto = Function.prototype;

/** Used to resolve the decompiled source of functions. */
var funcToString = funcProto.toString;

/**
 * Converts `func` to its source code.
 *
 * @private
 * @param {Function} func The function to convert.
 * @returns {string} Returns the source code.
 */
function toSource(func) {
  if (func != null) {
    try {
      return funcToString.call(func);
    } catch (e) {}
    try {
      return (func + '');
    } catch (e) {}
  }
  return '';
}

module.exports = toSource;


/***/ }),
/* 276 */
/***/ (function(module, exports, __webpack_require__) {

var SetCache = __webpack_require__(577),
    arraySome = __webpack_require__(277),
    cacheHas = __webpack_require__(580);

/** Used to compose bitmasks for value comparisons. */
var COMPARE_PARTIAL_FLAG = 1,
    COMPARE_UNORDERED_FLAG = 2;

/**
 * A specialized version of `baseIsEqualDeep` for arrays with support for
 * partial deep comparisons.
 *
 * @private
 * @param {Array} array The array to compare.
 * @param {Array} other The other array to compare.
 * @param {number} bitmask The bitmask flags. See `baseIsEqual` for more details.
 * @param {Function} customizer The function to customize comparisons.
 * @param {Function} equalFunc The function to determine equivalents of values.
 * @param {Object} stack Tracks traversed `array` and `other` objects.
 * @returns {boolean} Returns `true` if the arrays are equivalent, else `false`.
 */
function equalArrays(array, other, bitmask, customizer, equalFunc, stack) {
  var isPartial = bitmask & COMPARE_PARTIAL_FLAG,
      arrLength = array.length,
      othLength = other.length;

  if (arrLength != othLength && !(isPartial && othLength > arrLength)) {
    return false;
  }
  // Assume cyclic values are equal.
  var stacked = stack.get(array);
  if (stacked && stack.get(other)) {
    return stacked == other;
  }
  var index = -1,
      result = true,
      seen = (bitmask & COMPARE_UNORDERED_FLAG) ? new SetCache : undefined;

  stack.set(array, other);
  stack.set(other, array);

  // Ignore non-index properties.
  while (++index < arrLength) {
    var arrValue = array[index],
        othValue = other[index];

    if (customizer) {
      var compared = isPartial
        ? customizer(othValue, arrValue, index, other, array, stack)
        : customizer(arrValue, othValue, index, array, other, stack);
    }
    if (compared !== undefined) {
      if (compared) {
        continue;
      }
      result = false;
      break;
    }
    // Recursively compare arrays (susceptible to call stack limits).
    if (seen) {
      if (!arraySome(other, function(othValue, othIndex) {
            if (!cacheHas(seen, othIndex) &&
                (arrValue === othValue || equalFunc(arrValue, othValue, bitmask, customizer, stack))) {
              return seen.push(othIndex);
            }
          })) {
        result = false;
        break;
      }
    } else if (!(
          arrValue === othValue ||
            equalFunc(arrValue, othValue, bitmask, customizer, stack)
        )) {
      result = false;
      break;
    }
  }
  stack['delete'](array);
  stack['delete'](other);
  return result;
}

module.exports = equalArrays;


/***/ }),
/* 277 */
/***/ (function(module, exports) {

/**
 * A specialized version of `_.some` for arrays without support for iteratee
 * shorthands.
 *
 * @private
 * @param {Array} [array] The array to iterate over.
 * @param {Function} predicate The function invoked per iteration.
 * @returns {boolean} Returns `true` if any element passes the predicate check,
 *  else `false`.
 */
function arraySome(array, predicate) {
  var index = -1,
      length = array == null ? 0 : array.length;

  while (++index < length) {
    if (predicate(array[index], index, array)) {
      return true;
    }
  }
  return false;
}

module.exports = arraySome;


/***/ }),
/* 278 */
/***/ (function(module, exports) {

/**
 * Appends the elements of `values` to `array`.
 *
 * @private
 * @param {Array} array The array to modify.
 * @param {Array} values The values to append.
 * @returns {Array} Returns `array`.
 */
function arrayPush(array, values) {
  var index = -1,
      length = values.length,
      offset = array.length;

  while (++index < length) {
    array[offset + index] = values[index];
  }
  return array;
}

module.exports = arrayPush;


/***/ }),
/* 279 */
/***/ (function(module, exports, __webpack_require__) {

/* WEBPACK VAR INJECTION */(function(module) {var root = __webpack_require__(31),
    stubFalse = __webpack_require__(594);

/** Detect free variable `exports`. */
var freeExports = typeof exports == 'object' && exports && !exports.nodeType && exports;

/** Detect free variable `module`. */
var freeModule = freeExports && typeof module == 'object' && module && !module.nodeType && module;

/** Detect the popular CommonJS extension `module.exports`. */
var moduleExports = freeModule && freeModule.exports === freeExports;

/** Built-in value references. */
var Buffer = moduleExports ? root.Buffer : undefined;

/* Built-in method references for those with the same name as other `lodash` methods. */
var nativeIsBuffer = Buffer ? Buffer.isBuffer : undefined;

/**
 * Checks if `value` is a buffer.
 *
 * @static
 * @memberOf _
 * @since 4.3.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a buffer, else `false`.
 * @example
 *
 * _.isBuffer(new Buffer(2));
 * // => true
 *
 * _.isBuffer(new Uint8Array(2));
 * // => false
 */
var isBuffer = nativeIsBuffer || stubFalse;

module.exports = isBuffer;

/* WEBPACK VAR INJECTION */}.call(exports, __webpack_require__(84)(module)))

/***/ }),
/* 280 */
/***/ (function(module, exports, __webpack_require__) {

var baseIsTypedArray = __webpack_require__(595),
    baseUnary = __webpack_require__(596),
    nodeUtil = __webpack_require__(597);

/* Node.js helper references. */
var nodeIsTypedArray = nodeUtil && nodeUtil.isTypedArray;

/**
 * Checks if `value` is classified as a typed array.
 *
 * @static
 * @memberOf _
 * @since 3.0.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a typed array, else `false`.
 * @example
 *
 * _.isTypedArray(new Uint8Array);
 * // => true
 *
 * _.isTypedArray([]);
 * // => false
 */
var isTypedArray = nodeIsTypedArray ? baseUnary(nodeIsTypedArray) : baseIsTypedArray;

module.exports = isTypedArray;


/***/ }),
/* 281 */
/***/ (function(module, exports) {

/**
 * Creates a unary function that invokes `func` with its argument transformed.
 *
 * @private
 * @param {Function} func The function to wrap.
 * @param {Function} transform The argument transform.
 * @returns {Function} Returns the new function.
 */
function overArg(func, transform) {
  return function(arg) {
    return func(transform(arg));
  };
}

module.exports = overArg;


/***/ }),
/* 282 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


exports.__esModule = true;
exports.default = getContainer;

var _reactDom = __webpack_require__(12);

var _reactDom2 = _interopRequireDefault(_reactDom);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function getContainer(container, defaultContainer) {
  container = typeof container === 'function' ? container() : container;
  return _reactDom2.default.findDOMNode(container) || defaultContainer;
}
module.exports = exports['default'];

/***/ }),
/* 283 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


exports.__esModule = true;

exports.default = function (componentOrElement) {
  return (0, _ownerDocument2.default)(_reactDom2.default.findDOMNode(componentOrElement));
};

var _reactDom = __webpack_require__(12);

var _reactDom2 = _interopRequireDefault(_reactDom);

var _ownerDocument = __webpack_require__(45);

var _ownerDocument2 = _interopRequireDefault(_ownerDocument);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

module.exports = exports['default'];

/***/ }),
/* 284 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, "__esModule", {
  value: true
});

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _classnames = __webpack_require__(5);

var _classnames2 = _interopRequireDefault(_classnames);

var _react = __webpack_require__(0);

var _react2 = _interopRequireDefault(_react);

var _propTypes = __webpack_require__(1);

var _propTypes2 = _interopRequireDefault(_propTypes);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _objectWithoutProperties(obj, keys) { var target = {}; for (var i in obj) { if (keys.indexOf(i) >= 0) continue; if (!Object.prototype.hasOwnProperty.call(obj, i)) continue; target[i] = obj[i]; } return target; }

/**
 * ClearButton
 *
 * http://getbootstrap.com/css/#helper-classes-close
 */
var ClearButton = function ClearButton(_ref) {
  var bsSize = _ref.bsSize,
      className = _ref.className,
      label = _ref.label,
      _onClick = _ref.onClick,
      props = _objectWithoutProperties(_ref, ['bsSize', 'className', 'label', 'onClick']);

  return _react2.default.createElement(
    'button',
    _extends({}, props, {
      'aria-label': label,
      className: (0, _classnames2.default)('close', 'rbt-close', {
        'rbt-close-lg': bsSize === 'large' || bsSize === 'lg'
      }, className),
      onClick: function onClick(e) {
        e.stopPropagation();
        _onClick(e);
      },
      type: 'button' }),
    _react2.default.createElement(
      'span',
      { 'aria-hidden': 'true' },
      '\xD7'
    ),
    _react2.default.createElement(
      'span',
      { className: 'sr-only' },
      label
    )
  );
};

ClearButton.propTypes = {
  bsSize: _propTypes2.default.oneOf(['large', 'lg', 'small', 'sm']),
  label: _propTypes2.default.string,
  onClick: _propTypes2.default.func.isRequired
};

ClearButton.defaultProps = {
  label: 'Clear'
};

exports.default = ClearButton;

/***/ }),
/* 285 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, "__esModule", {
  value: true
});

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _classnames = __webpack_require__(5);

var _classnames2 = _interopRequireDefault(_classnames);

var _noop = __webpack_require__(171);

var _noop2 = _interopRequireDefault(_noop);

var _react = __webpack_require__(0);

var _react2 = _interopRequireDefault(_react);

var _propTypes = __webpack_require__(1);

var _propTypes2 = _interopRequireDefault(_propTypes);

var _ClearButton = __webpack_require__(284);

var _ClearButton2 = _interopRequireDefault(_ClearButton);

var _tokenContainer = __webpack_require__(286);

var _tokenContainer2 = _interopRequireDefault(_tokenContainer);

var _keyCode = __webpack_require__(113);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _objectWithoutProperties(obj, keys) { var target = {}; for (var i in obj) { if (keys.indexOf(i) >= 0) continue; if (!Object.prototype.hasOwnProperty.call(obj, i)) continue; target[i] = obj[i]; } return target; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

/**
 * Token
 *
 * Individual token component, generally displayed within the TokenizerInput
 * component, but can also be rendered on its own.
 */
var Token = function (_React$Component) {
  _inherits(Token, _React$Component);

  function Token() {
    var _ref;

    var _temp, _this, _ret;

    _classCallCheck(this, Token);

    for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
      args[_key] = arguments[_key];
    }

    return _ret = (_temp = (_this = _possibleConstructorReturn(this, (_ref = Token.__proto__ || Object.getPrototypeOf(Token)).call.apply(_ref, [this].concat(args))), _this), _this._renderRemoveableToken = function () {
      var _this$props = _this.props,
          active = _this$props.active,
          children = _this$props.children,
          className = _this$props.className,
          onRemove = _this$props.onRemove,
          props = _objectWithoutProperties(_this$props, ['active', 'children', 'className', 'onRemove']);

      return _react2.default.createElement(
        'div',
        _extends({}, props, {
          className: (0, _classnames2.default)('rbt-token', 'rbt-token-removeable', {
            'rbt-token-active': active
          }, className) }),
        children,
        _react2.default.createElement(_ClearButton2.default, {
          className: 'rbt-token-remove-button',
          label: 'Remove',
          onClick: onRemove,
          onKeyDown: _this._handleRemoveButtonKeydown,
          tabIndex: -1
        })
      );
    }, _this._renderToken = function () {
      var _this$props2 = _this.props,
          children = _this$props2.children,
          className = _this$props2.className,
          disabled = _this$props2.disabled,
          href = _this$props2.href;

      var classnames = (0, _classnames2.default)('rbt-token', {
        'rbt-token-disabled': disabled
      }, className);

      if (href) {
        return _react2.default.createElement(
          'a',
          { className: classnames, href: href },
          children
        );
      }

      return _react2.default.createElement(
        'div',
        { className: classnames },
        children
      );
    }, _this._handleRemoveButtonKeydown = function (e) {
      switch (e.keyCode) {
        case _keyCode.RETURN:
          _this.props.onRemove();
          break;
      }
    }, _temp), _possibleConstructorReturn(_this, _ret);
  }

  _createClass(Token, [{
    key: 'render',
    value: function render() {
      return this.props.onRemove && !this.props.disabled ? this._renderRemoveableToken() : this._renderToken();
    }
  }]);

  return Token;
}(_react2.default.Component);

Token.propTypes = {
  active: _propTypes2.default.bool,
  /**
   * Handler for removing/deleting the token. If not defined, the token will
   * be rendered in a read-only state.
   */
  onRemove: _propTypes2.default.func,
  tabIndex: _propTypes2.default.number
};

Token.defaultProps = {
  active: false,
  onRemove: _noop2.default,
  tabIndex: 0
};

exports.default = (0, _tokenContainer2.default)(Token);

/***/ }),
/* 286 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, "__esModule", {
  value: true
});

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _react = __webpack_require__(0);

var _react2 = _interopRequireDefault(_react);

var _reactOnclickoutside = __webpack_require__(287);

var _reactOnclickoutside2 = _interopRequireDefault(_reactOnclickoutside);

var _utils = __webpack_require__(54);

var _keyCode = __webpack_require__(113);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _objectWithoutProperties(obj, keys) { var target = {}; for (var i in obj) { if (keys.indexOf(i) >= 0) continue; if (!Object.prototype.hasOwnProperty.call(obj, i)) continue; target[i] = obj[i]; } return target; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

/**
 * Higher-order component that encapsulates Token behaviors, allowing them to
 * be easily re-used.
 */
var tokenContainer = function tokenContainer(Component) {
  var WrappedComponent = function (_React$Component) {
    _inherits(WrappedComponent, _React$Component);

    function WrappedComponent() {
      var _ref;

      var _temp, _this, _ret;

      _classCallCheck(this, WrappedComponent);

      for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
        args[_key] = arguments[_key];
      }

      return _ret = (_temp = (_this = _possibleConstructorReturn(this, (_ref = WrappedComponent.__proto__ || Object.getPrototypeOf(WrappedComponent)).call.apply(_ref, [this].concat(args))), _this), _this.displayName = 'tokenContainer(' + (0, _utils.getDisplayName)(Component) + ')', _this.state = {
        active: false
      }, _this._handleBlur = function (e) {
        _this.setState({ active: false });
      }, _this._handleKeyDown = function (e) {
        switch (e.keyCode) {
          case _keyCode.BACKSPACE:
            if (_this.state.active) {
              // Prevent backspace keypress from triggering the browser "back"
              // action.
              e.preventDefault();
              _this.props.onRemove();
            }
            break;
        }
      }, _this.handleClickOutside = function (e) {
        _this._handleBlur();
      }, _this._handleActive = function (e) {
        e.stopPropagation();
        _this.setState({ active: true });
      }, _temp), _possibleConstructorReturn(_this, _ret);
    }

    _createClass(WrappedComponent, [{
      key: 'render',
      value: function render() {
        var _props = this.props,
            disableOnClickOutside = _props.disableOnClickOutside,
            enableOnClickOutside = _props.enableOnClickOutside,
            eventTypes = _props.eventTypes,
            outsideClickIgnoreClass = _props.outsideClickIgnoreClass,
            preventDefault = _props.preventDefault,
            stopPropagation = _props.stopPropagation,
            tokenProps = _objectWithoutProperties(_props, ['disableOnClickOutside', 'enableOnClickOutside', 'eventTypes', 'outsideClickIgnoreClass', 'preventDefault', 'stopPropagation']);

        return _react2.default.createElement(Component, _extends({}, tokenProps, this.state, {
          onBlur: this._handleBlur,
          onClick: this._handleActive,
          onFocus: this._handleActive,
          onKeyDown: this._handleKeyDown
        }));
      }

      /**
       * From `onClickOutside` HOC.
       */

    }]);

    return WrappedComponent;
  }(_react2.default.Component);

  return (0, _reactOnclickoutside2.default)(WrappedComponent);
};

exports.default = tokenContainer;

/***/ }),
/* 287 */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
Object.defineProperty(__webpack_exports__, "__esModule", { value: true });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "IGNORE_CLASS_NAME", function() { return IGNORE_CLASS_NAME; });
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_0_react__ = __webpack_require__(0);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_0_react___default = __webpack_require__.n(__WEBPACK_IMPORTED_MODULE_0_react__);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_1_react_dom__ = __webpack_require__(12);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_1_react_dom___default = __webpack_require__.n(__WEBPACK_IMPORTED_MODULE_1_react_dom__);



function _inheritsLoose(subClass, superClass) {
  subClass.prototype = Object.create(superClass.prototype);
  subClass.prototype.constructor = subClass;
  subClass.__proto__ = superClass;
}

function _objectWithoutProperties(source, excluded) {
  if (source == null) return {};
  var target = {};
  var sourceKeys = Object.keys(source);
  var key, i;

  for (i = 0; i < sourceKeys.length; i++) {
    key = sourceKeys[i];
    if (excluded.indexOf(key) >= 0) continue;
    target[key] = source[key];
  }

  if (Object.getOwnPropertySymbols) {
    var sourceSymbolKeys = Object.getOwnPropertySymbols(source);

    for (i = 0; i < sourceSymbolKeys.length; i++) {
      key = sourceSymbolKeys[i];
      if (excluded.indexOf(key) >= 0) continue;
      if (!Object.prototype.propertyIsEnumerable.call(source, key)) continue;
      target[key] = source[key];
    }
  }

  return target;
}

/**
 * Check whether some DOM node is our Component's node.
 */
function isNodeFound(current, componentNode, ignoreClass) {
  if (current === componentNode) {
    return true;
  } // SVG <use/> elements do not technically reside in the rendered DOM, so
  // they do not have classList directly, but they offer a link to their
  // corresponding element, which can have classList. This extra check is for
  // that case.
  // See: http://www.w3.org/TR/SVG11/struct.html#InterfaceSVGUseElement
  // Discussion: https://github.com/Pomax/react-onclickoutside/pull/17


  if (current.correspondingElement) {
    return current.correspondingElement.classList.contains(ignoreClass);
  }

  return current.classList.contains(ignoreClass);
}
/**
 * Try to find our node in a hierarchy of nodes, returning the document
 * node as highest node if our node is not found in the path up.
 */

function findHighest(current, componentNode, ignoreClass) {
  if (current === componentNode) {
    return true;
  } // If source=local then this event came from 'somewhere'
  // inside and should be ignored. We could handle this with
  // a layered approach, too, but that requires going back to
  // thinking in terms of Dom node nesting, running counter
  // to React's 'you shouldn't care about the DOM' philosophy.


  while (current.parentNode) {
    if (isNodeFound(current, componentNode, ignoreClass)) {
      return true;
    }

    current = current.parentNode;
  }

  return current;
}
/**
 * Check if the browser scrollbar was clicked
 */

function clickedScrollbar(evt) {
  return document.documentElement.clientWidth <= evt.clientX || document.documentElement.clientHeight <= evt.clientY;
}

// ideally will get replaced with external dep
// when rafrex/detect-passive-events#4 and rafrex/detect-passive-events#5 get merged in
var testPassiveEventSupport = function testPassiveEventSupport() {
  if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') {
    return;
  }

  var passive = false;
  var options = Object.defineProperty({}, 'passive', {
    get: function get() {
      passive = true;
    }
  });

  var noop = function noop() {};

  window.addEventListener('testPassiveEventSupport', noop, options);
  window.removeEventListener('testPassiveEventSupport', noop, options);
  return passive;
};

function autoInc(seed) {
  if (seed === void 0) {
    seed = 0;
  }

  return function () {
    return ++seed;
  };
}

var uid = autoInc();

var passiveEventSupport;
var handlersMap = {};
var enabledInstances = {};
var touchEvents = ['touchstart', 'touchmove'];
var IGNORE_CLASS_NAME = 'ignore-react-onclickoutside';
/**
 * This function generates the HOC function that you'll use
 * in order to impart onOutsideClick listening to an
 * arbitrary component. It gets called at the end of the
 * bootstrapping code to yield an instance of the
 * onClickOutsideHOC function defined inside setupHOC().
 */

function onClickOutsideHOC(WrappedComponent, config) {
  var _class, _temp;

  return _temp = _class =
  /*#__PURE__*/
  function (_Component) {
    _inheritsLoose(onClickOutside, _Component);

    function onClickOutside(props) {
      var _this;

      _this = _Component.call(this, props) || this;

      _this.__outsideClickHandler = function (event) {
        if (typeof _this.__clickOutsideHandlerProp === 'function') {
          _this.__clickOutsideHandlerProp(event);

          return;
        }

        var instance = _this.getInstance();

        if (typeof instance.props.handleClickOutside === 'function') {
          instance.props.handleClickOutside(event);
          return;
        }

        if (typeof instance.handleClickOutside === 'function') {
          instance.handleClickOutside(event);
          return;
        }

        throw new Error('WrappedComponent lacks a handleClickOutside(event) function for processing outside click events.');
      };

      _this.enableOnClickOutside = function () {
        if (typeof document === 'undefined' || enabledInstances[_this._uid]) {
          return;
        }

        if (typeof passiveEventSupport === 'undefined') {
          passiveEventSupport = testPassiveEventSupport();
        }

        enabledInstances[_this._uid] = true;
        var events = _this.props.eventTypes;

        if (!events.forEach) {
          events = [events];
        }

        handlersMap[_this._uid] = function (event) {
          if (_this.props.disableOnClickOutside) return;
          if (_this.componentNode === null) return;

          if (_this.props.preventDefault) {
            event.preventDefault();
          }

          if (_this.props.stopPropagation) {
            event.stopPropagation();
          }

          if (_this.props.excludeScrollbar && clickedScrollbar(event)) return;
          var current = event.target;

          if (findHighest(current, _this.componentNode, _this.props.outsideClickIgnoreClass) !== document) {
            return;
          }

          _this.__outsideClickHandler(event);
        };

        events.forEach(function (eventName) {
          var handlerOptions = null;
          var isTouchEvent = touchEvents.indexOf(eventName) !== -1;

          if (isTouchEvent && passiveEventSupport) {
            handlerOptions = {
              passive: !_this.props.preventDefault
            };
          }

          document.addEventListener(eventName, handlersMap[_this._uid], handlerOptions);
        });
      };

      _this.disableOnClickOutside = function () {
        delete enabledInstances[_this._uid];
        var fn = handlersMap[_this._uid];

        if (fn && typeof document !== 'undefined') {
          var events = _this.props.eventTypes;

          if (!events.forEach) {
            events = [events];
          }

          events.forEach(function (eventName) {
            return document.removeEventListener(eventName, fn);
          });
          delete handlersMap[_this._uid];
        }
      };

      _this.getRef = function (ref) {
        return _this.instanceRef = ref;
      };

      _this._uid = uid();
      return _this;
    }
    /**
     * Access the WrappedComponent's instance.
     */


    var _proto = onClickOutside.prototype;

    _proto.getInstance = function getInstance() {
      if (!WrappedComponent.prototype.isReactComponent) {
        return this;
      }

      var ref = this.instanceRef;
      return ref.getInstance ? ref.getInstance() : ref;
    };

    /**
     * Add click listeners to the current document,
     * linked to this component's state.
     */
    _proto.componentDidMount = function componentDidMount() {
      // If we are in an environment without a DOM such
      // as shallow rendering or snapshots then we exit
      // early to prevent any unhandled errors being thrown.
      if (typeof document === 'undefined' || !document.createElement) {
        return;
      }

      var instance = this.getInstance();

      if (config && typeof config.handleClickOutside === 'function') {
        this.__clickOutsideHandlerProp = config.handleClickOutside(instance);

        if (typeof this.__clickOutsideHandlerProp !== 'function') {
          throw new Error('WrappedComponent lacks a function for processing outside click events specified by the handleClickOutside config option.');
        }
      }

      this.componentNode = Object(__WEBPACK_IMPORTED_MODULE_1_react_dom__["findDOMNode"])(this.getInstance());
      this.enableOnClickOutside();
    };

    _proto.componentDidUpdate = function componentDidUpdate() {
      this.componentNode = Object(__WEBPACK_IMPORTED_MODULE_1_react_dom__["findDOMNode"])(this.getInstance());
    };
    /**
     * Remove all document's event listeners for this component
     */


    _proto.componentWillUnmount = function componentWillUnmount() {
      this.disableOnClickOutside();
    };
    /**
     * Can be called to explicitly enable event listening
     * for clicks and touches outside of this element.
     */


    /**
     * Pass-through render
     */
    _proto.render = function render() {
      // eslint-disable-next-line no-unused-vars
      var _props = this.props,
          excludeScrollbar = _props.excludeScrollbar,
          props = _objectWithoutProperties(_props, ["excludeScrollbar"]);

      if (WrappedComponent.prototype.isReactComponent) {
        props.ref = this.getRef;
      } else {
        props.wrappedRef = this.getRef;
      }

      props.disableOnClickOutside = this.disableOnClickOutside;
      props.enableOnClickOutside = this.enableOnClickOutside;
      return Object(__WEBPACK_IMPORTED_MODULE_0_react__["createElement"])(WrappedComponent, props);
    };

    return onClickOutside;
  }(__WEBPACK_IMPORTED_MODULE_0_react__["Component"]), _class.displayName = "OnClickOutside(" + (WrappedComponent.displayName || WrappedComponent.name || 'Component') + ")", _class.defaultProps = {
    eventTypes: ['mousedown', 'touchstart'],
    excludeScrollbar: config && config.excludeScrollbar || false,
    outsideClickIgnoreClass: IGNORE_CLASS_NAME,
    preventDefault: false,
    stopPropagation: false
  }, _class.getClass = function () {
    return WrappedComponent.getClass ? WrappedComponent.getClass() : WrappedComponent;
  }, _temp;
}


/* harmony default export */ __webpack_exports__["default"] = (onClickOutsideHOC);


/***/ }),
/* 288 */
/***/ (function(module, exports, __webpack_require__) {

var baseToString = __webpack_require__(614);

/**
 * Converts `value` to a string. An empty string is returned for `null`
 * and `undefined` values. The sign of `-0` is preserved.
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to convert.
 * @returns {string} Returns the converted string.
 * @example
 *
 * _.toString(null);
 * // => ''
 *
 * _.toString(-0);
 * // => '-0'
 *
 * _.toString([1, 2, 3]);
 * // => '1,2,3'
 */
function toString(value) {
  return value == null ? '' : baseToString(value);
}

module.exports = toString;


/***/ }),
/* 289 */
/***/ (function(module, exports, __webpack_require__) {

var baseGetTag = __webpack_require__(51),
    getPrototype = __webpack_require__(616),
    isObjectLike = __webpack_require__(52);

/** `Object#toString` result references. */
var objectTag = '[object Object]';

/** Used for built-in method references. */
var funcProto = Function.prototype,
    objectProto = Object.prototype;

/** Used to resolve the decompiled source of functions. */
var funcToString = funcProto.toString;

/** Used to check objects for own properties. */
var hasOwnProperty = objectProto.hasOwnProperty;

/** Used to infer the `Object` constructor. */
var objectCtorString = funcToString.call(Object);

/**
 * Checks if `value` is a plain object, that is, an object created by the
 * `Object` constructor or one with a `[[Prototype]]` of `null`.
 *
 * @static
 * @memberOf _
 * @since 0.8.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a plain object, else `false`.
 * @example
 *
 * function Foo() {
 *   this.a = 1;
 * }
 *
 * _.isPlainObject(new Foo);
 * // => false
 *
 * _.isPlainObject([1, 2, 3]);
 * // => false
 *
 * _.isPlainObject({ 'x': 0, 'y': 0 });
 * // => true
 *
 * _.isPlainObject(Object.create(null));
 * // => true
 */
function isPlainObject(value) {
  if (!isObjectLike(value) || baseGetTag(value) != objectTag) {
    return false;
  }
  var proto = getPrototype(value);
  if (proto === null) {
    return true;
  }
  var Ctor = hasOwnProperty.call(proto, 'constructor') && proto.constructor;
  return typeof Ctor == 'function' && Ctor instanceof Ctor &&
    funcToString.call(Ctor) == objectCtorString;
}

module.exports = isPlainObject;


/***/ }),
/* 290 */
/***/ (function(module, exports, __webpack_require__) {

var isObject = __webpack_require__(50);

/**
 * Checks if `value` is suitable for strict equality comparisons, i.e. `===`.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` if suitable for strict
 *  equality comparisons, else `false`.
 */
function isStrictComparable(value) {
  return value === value && !isObject(value);
}

module.exports = isStrictComparable;


/***/ }),
/* 291 */
/***/ (function(module, exports) {

/**
 * A specialized version of `matchesProperty` for source values suitable
 * for strict equality comparisons, i.e. `===`.
 *
 * @private
 * @param {string} key The key of the property to get.
 * @param {*} srcValue The value to match.
 * @returns {Function} Returns the new spec function.
 */
function matchesStrictComparable(key, srcValue) {
  return function(object) {
    if (object == null) {
      return false;
    }
    return object[key] === srcValue &&
      (srcValue !== undefined || (key in Object(object)));
  };
}

module.exports = matchesStrictComparable;


/***/ }),
/* 292 */
/***/ (function(module, exports, __webpack_require__) {

var baseHasIn = __webpack_require__(629),
    hasPath = __webpack_require__(630);

/**
 * Checks if `path` is a direct or inherited property of `object`.
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Object
 * @param {Object} object The object to query.
 * @param {Array|string} path The path to check.
 * @returns {boolean} Returns `true` if `path` exists, else `false`.
 * @example
 *
 * var object = _.create({ 'a': _.create({ 'b': 2 }) });
 *
 * _.hasIn(object, 'a');
 * // => true
 *
 * _.hasIn(object, 'a.b');
 * // => true
 *
 * _.hasIn(object, ['a', 'b']);
 * // => true
 *
 * _.hasIn(object, 'b');
 * // => false
 */
function hasIn(object, path) {
  return object != null && hasPath(object, path, baseHasIn);
}

module.exports = hasIn;


/***/ }),
/* 293 */
/***/ (function(module, exports) {

/**
 * This method returns the first argument it receives.
 *
 * @static
 * @since 0.1.0
 * @memberOf _
 * @category Util
 * @param {*} value Any value.
 * @returns {*} Returns `value`.
 * @example
 *
 * var object = { 'a': 1 };
 *
 * console.log(_.identity(object) === object);
 * // => true
 */
function identity(value) {
  return value;
}

module.exports = identity;


/***/ }),
/* 294 */
/***/ (function(module, exports, __webpack_require__) {

var getNative = __webpack_require__(53);

var defineProperty = (function() {
  try {
    var func = getNative(Object, 'defineProperty');
    func({}, '', {});
    return func;
  } catch (e) {}
}());

module.exports = defineProperty;


/***/ }),
/* 295 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _classnames = __webpack_require__(5);

var _classnames2 = _interopRequireDefault(_classnames);

var _react = __webpack_require__(0);

var _react2 = _interopRequireDefault(_react);

var _propTypes = __webpack_require__(1);

var _propTypes2 = _interopRequireDefault(_propTypes);

var _MenuItem = __webpack_require__(175);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var BaseMenu = function BaseMenu(props) {
  return _react2.default.createElement(
    'ul',
    _extends({}, props, {
      className: (0, _classnames2.default)('dropdown-menu', props.className) }),
    props.children
  );
};

/**
 * Menu component that automatically handles pagination and empty state when
 * passed a set of filtered and truncated results.
 */

var Menu = function (_React$Component) {
  _inherits(Menu, _React$Component);

  function Menu() {
    var _ref;

    var _temp, _this, _ret;

    _classCallCheck(this, Menu);

    for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
      args[_key] = arguments[_key];
    }

    return _ret = (_temp = (_this = _possibleConstructorReturn(this, (_ref = Menu.__proto__ || Object.getPrototypeOf(Menu)).call.apply(_ref, [this].concat(args))), _this), _this.displayName = 'Menu', _temp), _possibleConstructorReturn(_this, _ret);
  }

  _createClass(Menu, [{
    key: 'render',
    value: function render() {
      var _props = this.props,
          align = _props.align,
          children = _props.children,
          className = _props.className,
          emptyLabel = _props.emptyLabel,
          maxHeight = _props.maxHeight,
          style = _props.style;


      var contents = _react.Children.count(children) === 0 ? _react2.default.createElement(
        _MenuItem.BaseMenuItem,
        { disabled: true },
        emptyLabel
      ) : children;

      return _react2.default.createElement(
        BaseMenu,
        {
          className: (0, _classnames2.default)('rbt-menu', {
            'dropdown-menu-justify': align === 'justify',
            'dropdown-menu-right': align === 'right'
          }, className),
          style: _extends({}, style, {
            display: 'block',
            maxHeight: maxHeight + 'px',
            overflow: 'auto'
          }) },
        contents,
        this._renderPaginationMenuItem()
      );
    }

    /**
     * Allow user to see more results, if available.
     */

  }, {
    key: '_renderPaginationMenuItem',
    value: function _renderPaginationMenuItem() {
      var _props2 = this.props,
          children = _props2.children,
          onPaginate = _props2.onPaginate,
          paginate = _props2.paginate,
          paginationText = _props2.paginationText;


      if (paginate && _react.Children.count(children)) {
        return [_react2.default.createElement('li', {
          className: 'divider',
          key: 'pagination-item-divider',
          role: 'separator'
        }), _react2.default.createElement(
          _MenuItem.BaseMenuItem,
          {
            className: 'rbt-menu-paginator',
            key: 'pagination-item',
            onClick: onPaginate },
          paginationText
        )];
      }
    }
  }]);

  return Menu;
}(_react2.default.Component);

Menu.propTypes = {
  /**
   * Specify menu alignment. The default value is `justify`, which makes the
   * menu as wide as the input and truncates long values. Specifying `left`
   * or `right` will align the menu to that side and the width will be
   * determined by the length of menu item values.
   */
  align: _propTypes2.default.oneOf(['justify', 'left', 'right']),
  /**
   * Maximum height of the dropdown menu, in px.
   */
  maxHeight: _propTypes2.default.number,
  /**
   * Prompt displayed when large data sets are paginated.
   */
  paginationText: _propTypes2.default.string
};

Menu.defaultProps = {
  align: 'justify',
  maxHeight: 300,
  paginate: true,
  paginationText: 'Display additional results...'
};

exports.default = Menu;

/***/ }),
/* 296 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, "__esModule", {
  value: true
});

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _react = __webpack_require__(0);

var _react2 = _interopRequireDefault(_react);

var _propTypes = __webpack_require__(1);

var _propTypes2 = _interopRequireDefault(_propTypes);

var _reactDom = __webpack_require__(12);

var _utils = __webpack_require__(54);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _objectWithoutProperties(obj, keys) { var target = {}; for (var i in obj) { if (keys.indexOf(i) >= 0) continue; if (!Object.prototype.hasOwnProperty.call(obj, i)) continue; target[i] = obj[i]; } return target; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var menuItemContainer = function menuItemContainer(Component) {
  var WrappedMenuItem = function (_React$Component) {
    _inherits(WrappedMenuItem, _React$Component);

    function WrappedMenuItem() {
      var _ref;

      var _temp, _this, _ret;

      _classCallCheck(this, WrappedMenuItem);

      for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
        args[_key] = arguments[_key];
      }

      return _ret = (_temp = (_this = _possibleConstructorReturn(this, (_ref = WrappedMenuItem.__proto__ || Object.getPrototypeOf(WrappedMenuItem)).call.apply(_ref, [this].concat(args))), _this), _this._handleClick = function (e) {
        var _this$props = _this.props,
            option = _this$props.option,
            onClick = _this$props.onClick;


        _this.context.onMenuItemClick(option);
        onClick && onClick(e);
      }, _this._updateInitialItem = function (props) {
        var option = props.option,
            position = props.position;

        if (position === 0) {
          _this.context.onInitialItemChange(option);
        }
      }, _temp), _possibleConstructorReturn(_this, _ret);
    }

    _createClass(WrappedMenuItem, [{
      key: 'componentWillMount',
      value: function componentWillMount() {
        this._updateInitialItem(this.props);
      }
    }, {
      key: 'componentWillReceiveProps',
      value: function componentWillReceiveProps(nextProps, nextContext) {
        var currentlyActive = this.context.activeIndex === this.props.position;
        var option = nextProps.option,
            position = nextProps.position;
        var activeIndex = nextContext.activeIndex,
            onActiveItemChange = nextContext.onActiveItemChange;


        if (position == null) {
          return;
        }

        // The item will become active.
        if (activeIndex === position) {
          // Ensures that if the menu items exceed the bounds of the menu, the
          // menu will scroll up or down as the user hits the arrow keys.
          (0, _utils.scrollIntoViewIfNeeded)((0, _reactDom.findDOMNode)(this));

          // Fire the change handler when the menu item becomes active.
          !currentlyActive && onActiveItemChange(option);
        }

        this._updateInitialItem(nextProps);
      }
    }, {
      key: 'render',
      value: function render() {
        var _context = this.context,
            activeIndex = _context.activeIndex,
            isOnlyResult = _context.isOnlyResult;

        var _props = this.props,
            position = _props.position,
            props = _objectWithoutProperties(_props, ['position']);

        var active = isOnlyResult || activeIndex === position;

        return _react2.default.createElement(Component, _extends({}, props, {
          active: active,
          onClick: this._handleClick
        }));
      }
    }]);

    return WrappedMenuItem;
  }(_react2.default.Component);

  WrappedMenuItem.displayName = 'menuItemContainer(' + (0, _utils.getDisplayName)(Component) + ')';

  WrappedMenuItem.propTypes = {
    option: _propTypes2.default.oneOfType([_propTypes2.default.object, _propTypes2.default.string]).isRequired,
    position: _propTypes2.default.number
  };

  WrappedMenuItem.contextTypes = {
    activeIndex: _propTypes2.default.number.isRequired,
    isOnlyResult: _propTypes2.default.bool.isRequired,
    onActiveItemChange: _propTypes2.default.func.isRequired,
    onInitialItemChange: _propTypes2.default.func.isRequired,
    onMenuItemClick: _propTypes2.default.func.isRequired
  };

  return WrappedMenuItem;
};

exports.default = menuItemContainer;

/***/ }),
/* 297 */,
/* 298 */,
/* 299 */,
/* 300 */,
/* 301 */,
/* 302 */,
/* 303 */,
/* 304 */,
/* 305 */,
/* 306 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
// LICENSE_CODE ZON ISC
 /*jslint browser:true, react:true, es6:true*/

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

__webpack_require__(176);

__webpack_require__(177);

__webpack_require__(179);

__webpack_require__(180);

var _angular = __webpack_require__(67);

var _angular2 = _interopRequireDefault(_angular);

var _lodash = __webpack_require__(32);

var _lodash2 = _interopRequireDefault(_lodash);

var _moment = __webpack_require__(114);

var _moment2 = _interopRequireDefault(_moment);

var _codemirror = __webpack_require__(115);

var _codemirror2 = _interopRequireDefault(_codemirror);

var _date = __webpack_require__(85);

var _date2 = _interopRequireDefault(_date);

var _csv = __webpack_require__(317);

var _csv2 = _interopRequireDefault(_csv);

var _url = __webpack_require__(181);

var _url2 = _interopRequireDefault(_url);

var _stats = __webpack_require__(318);

var _stats2 = _interopRequireDefault(_stats);

var _status_codes = __webpack_require__(78);

var _status_codes2 = _interopRequireDefault(_status_codes);

var _status_codes_detail = __webpack_require__(533);

var _status_codes_detail2 = _interopRequireDefault(_status_codes_detail);

var _domains = __webpack_require__(99);

var _domains2 = _interopRequireDefault(_domains);

var _domains_detail = __webpack_require__(534);

var _domains_detail2 = _interopRequireDefault(_domains_detail);

var _protocols = __webpack_require__(100);

var _protocols2 = _interopRequireDefault(_protocols);

var _intro = __webpack_require__(535);

var _intro2 = _interopRequireDefault(_intro);

var _add_proxy = __webpack_require__(540);

var _add_proxy2 = _interopRequireDefault(_add_proxy);

var _edit_proxy = __webpack_require__(541);

var _edit_proxy2 = _interopRequireDefault(_edit_proxy);

var _howto = __webpack_require__(270);

var _howto2 = _interopRequireDefault(_howto);

var _protocols_detail = __webpack_require__(677);

var _protocols_detail2 = _interopRequireDefault(_protocols_detail);

var _messages = __webpack_require__(678);

var _messages2 = _interopRequireDefault(_messages);

var _util = __webpack_require__(29);

var _util2 = _interopRequireDefault(_util);

var _react = __webpack_require__(0);

var _react2 = _interopRequireDefault(_react);

var _reactDom = __webpack_require__(12);

var _reactDom2 = _interopRequireDefault(_reactDom);

var _jquery = __webpack_require__(13);

var _jquery2 = _interopRequireDefault(_jquery);

__webpack_require__(297);

__webpack_require__(298);

__webpack_require__(299);

__webpack_require__(300);

__webpack_require__(692);

__webpack_require__(301);

__webpack_require__(302);

__webpack_require__(303);

__webpack_require__(304);

__webpack_require__(305);

var _fileSaver = __webpack_require__(697);

var _fileSaver2 = _interopRequireDefault(_fileSaver);

var _common = __webpack_require__(37);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var url_o = _url2.default.parse(document.location.href);
var qs_o = _url2.default.qs_parse((url_o.search || '').substr(1));

window.feature_flag = function (flag) {
    var enable = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : true;

    window.localStorage.setItem(flag, JSON.stringify(enable));
};

var is_electron = window.process && window.process.versions.electron;

var is_valid_field = function is_valid_field(proxy, name, zone_definition) {
    var value = proxy.zone || zone_definition.def;
    if (name == 'password') return value != 'gen';
    if ({ city: 1, state: 1 }[name] && (!proxy.country || proxy.country == '*')) return false;
    var details = zone_definition.values.filter(function (z) {
        return z.value == value;
    })[0];
    var permissions = details && details.perm.split(' ') || [];
    if (name == 'vip') {
        var plan = details && details.plans[details.plans.length - 1] || {};
        return !!plan.vip;
    }
    if (['country', 'state', 'city', 'asn', 'ip'].includes(name)) return permissions.includes(name);
    return true;
};

var _module = _angular2.default.module('app', ['ngSanitize', 'ui.bootstrap', 'ui.select', 'angular-google-analytics', 'ui.router']);

var analytics_provider = void 0;
var ga_event = _util2.default.ga_event;

_module.config(['$uibTooltipProvider', '$uiRouterProvider', '$locationProvider', 'AnalyticsProvider', function ($uibTooltipProvider, $uiRouter, $location_provider, _analytics_provider) {
    $location_provider.html5Mode(true);
    $uibTooltipProvider.options({ placement: 'bottom' });
    _analytics_provider.delayScriptTag(true);
    analytics_provider = _analytics_provider;

    $uiRouter.urlService.rules.otherwise({ state: 'settings' });

    var state_registry = $uiRouter.stateRegistry;
    state_registry.register({
        name: 'app',
        redirectTo: 'settings',
        controller: 'root'
    });
    state_registry.register({
        name: 'settings',
        parent: 'app',
        url: '/',
        templateUrl: 'settings.html'
    });
    state_registry.register({
        name: 'proxies',
        parent: 'app',
        url: '/proxies',
        params: { 'add_proxy': false },
        templateUrl: 'proxies.html'
    });
    state_registry.register({
        name: 'zones',
        parent: 'app',
        url: '/zones/{zone:string}',
        templateUrl: 'zones.html',
        params: { zone: { squash: true, value: null } }
    });
    state_registry.register({
        name: 'tools',
        parent: 'app',
        url: '/tools',
        templateUrl: 'tools.html'
    });
    state_registry.register({
        name: 'faq',
        parent: 'app',
        url: '/faq',
        templateUrl: 'faq.html'
    });
    state_registry.register({
        name: 'status_codes',
        parent: 'app',
        url: '/status_codes',
        template: '<div react-view=react_component></div>',
        controller: function controller($scope) {
            $scope.react_component = _status_codes2.default;
        }
    });
    state_registry.register({
        name: 'status_codes_detail',
        parent: 'app',
        url: '/status_codes/{code:int}',
        template: '<div react-view=react_component state-props=code\n        class=container></div>',
        controller: function controller($scope) {
            $scope.react_component = _status_codes_detail2.default;
        }
    });
    state_registry.register({
        name: 'domains',
        parent: 'app',
        url: '/domains',
        template: '<div react-view=react_component></div>',
        controller: function controller($scope) {
            $scope.react_component = _domains2.default;
        }
    });
    state_registry.register({
        name: 'domains_detail',
        parent: 'app',
        url: '/domains/{domain:string}',
        template: '<div react-view=react_component state-props=domain\n        class=container></div>',
        controller: function controller($scope) {
            $scope.react_component = _domains_detail2.default;
        }
    });
    state_registry.register({
        name: 'protocols',
        parent: 'app',
        url: '/protocols',
        template: '<div react-view=react_component></div>',
        controller: function controller($scope) {
            $scope.react_component = _protocols2.default;
        }
    });
    state_registry.register({
        name: 'protocols_detail',
        parent: 'app',
        url: '/protocols/{protocol:string}',
        template: '<div react-view=react_component state-props=protocol\n        class=container></div>',
        controller: function controller($scope) {
            $scope.react_component = _protocols_detail2.default;
        }
    });
    state_registry.register({
        name: 'intro',
        parent: 'app',
        url: '/intro',
        template: '<div react-view=react_component></div>',
        controller: function controller($scope) {
            $scope.react_component = _intro2.default;
        }
    });
    state_registry.register({
        name: 'howto',
        parent: 'app',
        url: '/howto',
        template: '<div react-view=react_component></div>',
        controller: function controller($scope) {
            var howto_wrapper = function howto_wrapper(props) {
                return _react2.default.createElement(_howto2.default, { ga_category: 'how-to-use' });
            };
            $scope.react_component = howto_wrapper;
        }
    });
    state_registry.register({
        name: 'edit_proxy',
        parent: 'app',
        url: '/proxy/{port:string}',
        template: '<div react-view=react_component state-props=port\n        extra-props=extra_props></div>',
        controller: function controller($scope, $rootScope) {
            $scope.react_component = _edit_proxy2.default;
            $scope.extra_props = {
                proxy: $rootScope.edit_proxy,
                consts: $rootScope.consts,
                defaults: $rootScope.defaults,
                presets: $rootScope.presets
            };
        }
    });
}]);

_module.run(function ($rootScope, $http, $window, $transitions, $q, Analytics, $timeout) {
    var logged_in_resolver = $q.defer();
    $rootScope.logged_in = logged_in_resolver.promise;
    $transitions.onBefore({ to: function to(state) {
            $timeout(function () {
                $rootScope.hide_quickstart = !!(state.data || {}).hide_quickstart;
            });
            return !['app', 'faq'].includes(state.name);
        } }, function (transition) {
        return $q(function (resolve, reject) {
            $q.resolve($rootScope.logged_in).then(function (logged_in) {
                if (logged_in) {
                    if (!$window.localStorage.getItem('quickstart-intro') && $window.localStorage.getItem('quickstart') != 'dismissed') {
                        $window.localStorage.setItem('quickstart-intro', true);
                        return resolve(transition.router.stateService.target('intro'));
                    }
                    if (transition.to().name != 'settings') return resolve(true);
                    return resolve(transition.router.stateService.target('proxies', undefined, { location: true }));
                }
                if (transition.to().name == 'settings') return resolve(true);
                return resolve(transition.router.stateService.target('settings', undefined, { location: false }));
            });
        });
    });
    $http.get('/api/mode').then(function (data) {
        var logged_in = data.data.logged_in;
        logged_in_resolver.resolve(logged_in);
        $rootScope.mode = data.data.mode;
        $rootScope.run_config = data.data.run_config;
        var ua;
        if (ua = data.data.run_config.ua) {
            if (data.data.no_usage_stats) analytics_provider.disableAnalytics(true);
            analytics_provider.setAccount({
                tracker: ua.tid,
                set: { forceSSL: true },
                trackEvent: true
            });
            Analytics.registerScriptTags();
            Analytics.registerTrackers();
            _lodash2.default.each(ua._persistentParams, function (v, k) {
                return Analytics.set('&' + k, v);
            });
            Analytics.set('&an', (ua._persistentParams.an || 'LPM') + ' - UI');
        }
        analytics_provider = null;
        _util2.default.init_ga(Analytics);
        if ($window.localStorage.getItem('last_run_id') != $rootScope.run_config.id) {
            $window.localStorage.setItem('last_run_id', $rootScope.run_config.id);
            $window.localStorage.setItem('suppressed_warnings', '');
        }
        $rootScope.login_failure = data.data.login_failure;
        $rootScope.$broadcast('error_update');
        if (logged_in) {
            var p = 60 * 60 * 1000;
            var recheck = function recheck() {
                $http.post('/api/recheck').then(function (r) {
                    if (r.data.login_failure) $window.location = '/';
                });
                setTimeout(recheck, p);
            };
            var t = +(0, _date2.default)();
            setTimeout(recheck, p - t % p);
        }
    });
});

_module.factory('$proxies', proxies_factory);
proxies_factory.$inject = ['$http', '$q'];
function proxies_factory($http, $q) {
    var service = {
        subscribe: subscribe,
        proxies: null,
        trigger: trigger,
        update: update_proxies
    };
    var listeners = [];
    service.update();
    return service;
    function subscribe(func) {
        listeners.push(func);
        if (service.proxies) func(service.proxies);
    }
    function update_proxies() {
        var get_status = function get_status(force) {
            var proxy = this;
            if (!proxy._status_call || force) {
                var url = '/api/proxy_status/' + proxy.port;
                if (proxy.proxy_type != 'duplicate') url += '?with_details';
                proxy._status_call = $http.get(url);
            }
            this._status_call.then(function (res) {
                if (res.data.status == 'ok') {
                    proxy._status = 'ok';
                    proxy._status_details = res.data.status_details || [];
                } else {
                    proxy._status = 'error';
                    var errors = res.data.status_details.filter(function (s) {
                        return s.lvl == 'err';
                    });
                    proxy._status_details = errors.length ? errors : [{ lvl: 'err', msg: res.data.status }];
                }
            }).catch(function () {
                proxy._status_call = null;
                proxy._status = 'error';
                proxy._status_details = [{ lvl: 'warn',
                    msg: 'Failed to get proxy status' }];
            });
        };
        return $http.get('/api/proxies_running').then(function (res) {
            var proxies = res.data;
            proxies.sort(function (a, b) {
                return a.port > b.port ? 1 : -1;
            });
            proxies.forEach(function (proxy) {
                if (Array.isArray(proxy.proxy) && proxy.proxy.length == 1) proxy.proxy = proxy.proxy[0];
                proxy.get_status = get_status;
                proxy._status_details = [];
            });
            service.proxies = proxies;
            listeners.forEach(function (cb) {
                cb(proxies);
            });
            return proxies;
        });
    }
    function trigger() {
        listeners.forEach(function (cb) {
            cb(service.proxies);
        });
    }
}

_module.factory('$success_rate', success_rate_factory);
success_rate_factory.$inject = ['$http', '$proxies', '$timeout'];

function success_rate_factory($http, $proxies, $timeout) {
    var is_listening = false;
    var get_timeout = false;
    var poll_interval = 3000;
    return { listen: listen, stop_listening: stop_listening };

    function listen() {
        if (is_listening) return;
        is_listening = true;
        poll();
        function poll() {
            get_request_rate().then(function () {
                if (!is_listening) return;
                get_timeout = $timeout(poll, poll_interval);
            });
        }
    }

    function stop_listening() {
        is_listening = false;
        if (get_timeout) $timeout.cancel(get_timeout);
    }

    function get_request_rate() {
        return $http.get('/api/req_status').then(function (res) {
            var rates = res.data;
            if (!$proxies.proxies) return;
            $proxies.proxies = $proxies.proxies.map(function (p) {
                var rstat = { total: 0, success: 0 };
                if ('' + p.port in rates) rstat = rates[p.port];
                p.success_rate = rstat.total == 0 ? 0 : rstat.success / rstat.total * 100;
                p.success_rate = p.success_rate.toFixed(0);
                return p;
            });
            $proxies.trigger();
        });
    }
}

_module.controller('root', ['$rootScope', '$scope', '$http', '$window', '$state', '$transitions', function ($rootScope, $scope, $http, $window, $state, $transitions) {
    $scope.messages = _messages2.default;
    $scope.sections = [{ name: 'settings', title: 'Settings', navbar: false }, { name: 'howto', title: 'How to use', navbar: true }, { name: 'proxies', title: 'Proxies', navbar: true }, { name: 'zones', title: 'Zones', navbar: true }, { name: 'tools', title: 'Tools', navbar: true }, { name: 'faq', title: 'FAQ', navbar: true }, { name: 'intro', navbar: false }];
    $transitions.onSuccess({}, function (transition) {
        var state = transition.to(),
            section;
        $scope.section = section = $scope.sections.find(function (s) {
            return s.name == state.name;
        });
        $scope.subsection = section && section.name == 'zones' && transition.params().zone;
    });
    $scope.section = $scope.sections.find(function (s) {
        return s.name == $state.$current.name;
    });
    $http.get('/api/settings').then(function (settings) {
        $rootScope.settings = settings.data;
        $rootScope.beta_features = settings.data.argv.includes('beta_features');
        if (!$rootScope.settings.request_disallowed && !$rootScope.settings.customer) {
            if (!$window.localStorage.getItem('quickstart')) $window.localStorage.setItem('quickstart', 'show');
        }
    });
    $http.get('/api/ip').then(function (ip) {
        $scope.ip = ip.data.ip;
    });
    $http.get('/api/version').then(function (version) {
        $scope.ver_cur = version.data.version;
    });
    $http.get('/api/last_version').then(function (version) {
        $scope.ver_last = version.data;
    });
    $http.get('/api/consts').then(function (consts) {
        $rootScope.consts = consts.data;
        $scope.$broadcast('consts', consts.data);
    });
    $http.get('/api/defaults').then(function (defaults) {
        $scope.$root.defaults = defaults.data;
    });
    $http.get('/api/node_version').then(function (node) {
        $scope.ver_node = node.data;
    });
    $http.get('/api/www_lpm').then(function (res) {
        $scope.$root.presets = (0, _common.combine_presets)(res.data);
    });
    // krzysztof: hack to pass data to react
    $scope.$root.$watchGroup(['consts', 'presets'], function () {
        if ($scope.consts && $scope.presets) {
            $scope.$root.add_proxy_constants = { consts: $scope.consts,
                presets: $scope.presets };
        }
    });
    var show_reload = function show_reload() {
        $window.$('#restarting').modal({
            backdrop: 'static',
            keyboard: false
        });
    };
    // XXX krzysztof/ovidiu: incorrect usage of promises
    var check_reload = function check_reload() {
        $http.get('/api/config').catch(function () {
            setTimeout(check_reload, 500);
        }).then(function () {
            $window.location.reload();
        });
    };
    $scope.is_upgradable = function () {
        if (!($scope.ver_node && $scope.ver_node.is_electron) && !is_electron && $scope.ver_last && $scope.ver_last.newer) {
            var version = $window.localStorage.getItem('dismiss_upgrade');
            return version ? $scope.ver_last.version > version : true;
        }
        return false;
    };
    $scope.dismiss_upgrade = function () {
        $window.localStorage.setItem('dismiss_upgrade', $scope.ver_last.version);
    };
    $scope.upgrade = function () {
        $scope.$root.confirmation = {
            text: 'The application will be upgraded and restarted.',
            confirmed: function confirmed() {
                $window.$('#upgrading').modal({ backdrop: 'static',
                    keyboard: false });
                $scope.upgrading = true;
                // XXX krzysztof: wrong usage of promises
                $http.post('/api/upgrade').catch(function () {
                    $scope.upgrading = false;
                    $scope.upgrade_error = true;
                }).then(function (data) {
                    $scope.upgrading = false;
                    // XXX krzysztof: wrong usage of promises
                    $http.post('/api/restart').catch(function () {
                        // $scope.upgrade_error = true;
                        show_reload();
                        check_reload();
                    }).then(function (d) {
                        show_reload();
                        check_reload();
                    });
                });
            }
        };
        $window.$('#confirmation').modal();
    };
    $scope.shutdown = function () {
        $scope.$root.confirmation = {
            text: 'Are you sure you want to shut down the local proxies?',
            confirmed: function confirmed() {
                $http.post('/api/shutdown');
                setTimeout(function () {
                    $window.$('#shutdown').modal({
                        backdrop: 'static',
                        keyboard: false
                    });
                }, 400);
            }
        };
        $window.$('#confirmation').modal();
    };
    $scope.logout = function () {
        $http.post('/api/logout').then(function () {
            show_reload();
            setTimeout(function _check_reload() {
                var retry = function retry() {
                    setTimeout(_check_reload, 500);
                };
                $http.get('/proxies').then(function (res) {
                    $window.location = '/';
                }, retry);
            }, 3000);
        });
    };
    $scope.warnings = function () {
        if (!$rootScope.run_config || !$rootScope.run_config.warnings) return [];
        var suppressed = $window.localStorage.getItem('suppressed_warnings').split('|||');
        var warnings = [];
        for (var i = 0; i < $rootScope.run_config.warnings.length; i++) {
            var w = $rootScope.run_config.warnings[i];
            if (!suppressed.includes(w)) warnings.push(w);
        }
        return warnings;
    };
    $scope.dismiss_warning = function (warning) {
        var warnings = $window.localStorage.getItem('suppressed_warnings').split('|||');
        warnings.push(warning);
        $window.localStorage.setItem('suppressed_warnings', warnings.join('|||'));
    };
    $scope.zone_click = function (name) {
        ga_event('navbar', 'click', name);
    };
}]);

_module.controller('config', Config);
Config.$inject = ['$scope', '$http', '$window'];
function Config($scope, $http, $window) {
    $http.get('/api/config').then(function (config) {
        $scope.config = config.data.config;
        setTimeout(function () {
            $scope.codemirror = _codemirror2.default.fromTextArea($window.$('#config-textarea').get(0), { mode: 'javascript' });
        }, 0);
    });
    var show_reload = function show_reload() {
        $window.$('#restarting').modal({
            backdrop: 'static',
            keyboard: false
        });
    };
    var check_reload = function check_reload() {
        var retry = function retry() {
            setTimeout(check_reload, 500);
        };
        $http.get('/tools').then(function (res) {
            $window.location.reload();
        }, retry);
    };
    $scope.save = function () {
        $scope.errors = null;
        $http.post('/api/config_check', { config: $scope.codemirror.getValue() }).then(function (res) {
            $scope.errors = res.data;
            if ($scope.errors.length) return;
            $scope.$root.confirmation = {
                text: 'Editing the configuration manually may result in your ' + 'proxies working incorrectly. Do you still want to modify' + ' the configuration file?',
                confirmed: function confirmed() {
                    $scope.config = $scope.codemirror.getValue();
                    show_reload();
                    $http.post('/api/config', { config: $scope.config }).then(setTimeout(check_reload, 3000));
                }
            };
            $window.$('#confirmation').modal();
        });
    };
    $scope.update = function () {
        $http.get('/api/config').then(function (config) {
            $scope.config = config.data.config;
            $scope.codemirror.setValue($scope.config);
        });
    };
    $window.$('#config-panel').on('hidden.bs.collapse', $scope.update).on('show.bs.collapse', function () {
        setTimeout(function () {
            $scope.codemirror.scrollTo(0, 0);
            $scope.codemirror.refresh();
        }, 0);
    });
    $scope.cancel = function () {
        $window.$('#config-panel > .collapse').collapse('hide');
    };
}

_module.controller('resolve', Resolve);
Resolve.$inject = ['$scope', '$http', '$window'];
function Resolve($scope, $http, $window) {
    $scope.resolve = { text: '' };
    $scope.update = function () {
        $http.get('/api/resolve').then(function (resolve) {
            $scope.resolve.text = resolve.data.resolve;
        });
    };
    $scope.update();
    var show_reload = function show_reload() {
        $window.$('#restarting').modal({
            backdrop: 'static',
            keyboard: false
        });
    };
    // XXX krzysztof/ovidiu: incorrect usage of promises
    var check_reload = function check_reload() {
        $http.get('/api/config').catch(function () {
            setTimeout(check_reload, 500);
        }).then(function () {
            $window.location.reload();
        });
    };
    $scope.save = function () {
        show_reload();
        $http.post('/api/resolve', { resolve: $scope.resolve.text }).then(check_reload);
    };
    $window.$('#resolve-panel').on('hidden.bs.collapse', $scope.update).on('show.bs.collapse', function () {
        setTimeout(function () {
            $window.$('#resolve-textarea').scrollTop(0).scrollLeft(0);
        }, 0);
    });
    $scope.cancel = function () {
        $window.$('#resolve-panel > .collapse').collapse('hide');
    };
    $scope.new_host = function () {
        $window.$('#resolve_add').one('shown.bs.modal', function () {
            $window.$('#resolve_add input').select();
        }).modal();
    };
    $scope.add_host = function () {
        $scope.adding = true;
        $scope.error = false;
        var host = $scope.host.host.trim();
        $http.get('/api/resolve_host/' + host).then(function (ips) {
            $scope.adding = false;
            if (ips.data.ips && ips.data.ips.length) {
                for (var i = 0; i < ips.data.ips.length; i++) {
                    $scope.resolve.text += '\n' + ips.data.ips[i] + ' ' + host;
                }setTimeout(function () {
                    var textarea = $window.$('#resolve-textarea');
                    textarea.scrollTop(textarea.prop('scrollHeight'));
                }, 0);
                $scope.host.host = '';
                $scope.resolve_frm.$setPristine();
                $window.$('#resolve_add').modal('hide');
            } else $scope.error = true;
        });
    };
}

_module.controller('settings', Settings);
Settings.$inject = ['$scope', '$http', '$window', '$sce', '$rootScope', '$state', '$location'];
function Settings($scope, $http, $window, $sce, $rootScope, $state, $location) {
    var update_error = function update_error() {
        if ($rootScope.relogin_required) return $scope.user_error = { message: 'Please log in again.' };
        if (!$rootScope.login_failure) return;
        switch ($rootScope.login_failure) {
            case 'eval_expired':
                $scope.user_error = { message: 'Evaluation expired!' + '<a href=https://luminati.io/#contact>Please contact your ' + 'Luminati rep.</a>' };
                break;
            case 'invalid_creds':
            case 'unknown':
                $scope.user_error = { message: 'Your proxy is not responding.<br>' + 'Please go to the <a href=https://luminati.io/cp/zones/' + $rootScope.settings.zone + '>zone page</a> and verify that ' + 'your IP address ' + ($scope.$parent.ip ? '(' + $scope.$parent.ip + ')' : '') + ' is in the whitelist.' };
                break;
            default:
                $scope.user_error = { message: $rootScope.login_failure };
        }
    };
    update_error();
    $scope.$on('error_update', update_error);
    $scope.parse_arguments = function (args) {
        return args.replace(/(--password )(.+?)( --|$)/, '$1|||$2|||$3').split('|||');
    };
    $scope.show_password = function () {
        $scope.args_password = true;
    };
    var check_reload = function check_reload() {
        $http.get('/proxies').then(function () {
            $window.location.reload();
        }, function () {
            setTimeout(check_reload, 500);
        });
    };
    var show_reload = function show_reload() {
        $window.$('#restarting').modal({
            backdrop: 'static',
            keyboard: false
        });
    };
    var send_event_user_logged = function send_event_user_logged() {
        if ($window.localStorage.getItem('quickstart-intro') || $window.localStorage.getItem('quickstart') == 'dismissed') {
            ga_event('lpm-onboarding', '02 login successful', 'old user');
        } else ga_event('lpm-onboarding', '02 login successful', 'new user');
    };
    $scope.user_data = { username: '', password: '' };
    var token;
    $scope.save_user = function () {
        var creds = {};
        if (token) creds = { token: token };else {
            var username = $scope.user_data.username;
            var password = $scope.user_data.password;
            if (!(username = username.trim())) {
                $scope.user_error = {
                    message: 'Please enter a valid email address.',
                    username: true };
                return;
            }
            if (!password) {
                $scope.user_error = { message: 'Please enter a password.',
                    password: true };
                return;
            }
            creds = { username: username, password: password };
        }
        $scope.saving_user = true;
        $scope.user_error = null;
        if ($scope.user_customers) creds.customer = $scope.user_data.customer;
        $http.post('/api/creds_user', creds).then(function (d) {
            if (d.data.customers) {
                $scope.saving_user = false;
                $scope.user_customers = d.data.customers;
                $scope.user_data.customer = $scope.user_customers[0];
            } else {
                send_event_user_logged();
                show_reload();
                setTimeout(check_reload, 3000);
            }
        }).catch(function (error) {
            $scope.saving_user = false;
            $scope.user_error = error.data.error;
        });
    };
    $scope.google_click = function (e) {
        var google = $window.$(e.currentTarget),
            l = $window.location;
        google.attr('href', google.attr('href') + '&state=' + encodeURIComponent(l.protocol + '//' + l.hostname + ':' + (l.port || 80) + '?api_version=3'));
    };
    var m,
        qs_regex = /^([a-zA-Z0-9\+\/=]+)$/;
    if (m = ($location.search().t || '').replace(/\s+/g, '+').match(qs_regex)) {
        $scope.google_login = true;
        token = m[1];
        $scope.save_user();
    }
}

_module.controller('zones', Zones);
Zones.$inject = ['$scope', '$http', '$filter', '$window'];
function Zones($scope, $http, $filter, $window) {
    var today = new Date();
    var one_day_ago = new Date().setDate(today.getDate() - 1);
    var two_days_ago = new Date().setDate(today.getDate() - 2);
    var one_month_ago = new Date().setMonth(today.getMonth() - 1, 1);
    var two_months_ago = new Date().setMonth(today.getMonth() - 2, 1);
    $scope.times = [{ title: (0, _moment2.default)(two_months_ago).format('MMM-YYYY'), key: 'back_m2' }, { title: (0, _moment2.default)(one_month_ago).format('MMM-YYYY'), key: 'back_m1' }, { title: (0, _moment2.default)(today).format('MMM-YYYY'), key: 'back_m0' }, { title: (0, _moment2.default)(two_days_ago).format('DD-MMM-YYYY'), key: 'back_d2' }, { title: (0, _moment2.default)(one_day_ago).format('DD-MMM-YYYY'), key: 'back_d1' }, { title: (0, _moment2.default)(today).format('DD-MMM-YYYY'), key: 'back_d0' }];
    var number_filter = $filter('requests');
    var size_filter = $filter('bytes');
    $scope.fields = [{ key: 'http_svc_req', title: 'HTTP', filter: number_filter }, { key: 'https_svc_req', title: 'HTTPS', filter: number_filter }, { key: 'bw_up', title: 'Upload', filter: size_filter }, { key: 'bw_dn', title: 'Download', filter: size_filter }, { key: 'bw_sum', title: 'Total Bandwidth', filter: size_filter }];
    $http.get('/api/stats').then(function (stats) {
        if (stats.data.login_failure) {
            $window.location = '/';
            return;
        }
        $scope.stats = stats.data;
        if (!Object.keys($scope.stats).length) $scope.error = true;
    }).catch(function (e) {
        $scope.error = true;
    });
    $http.get('/api/whitelist').then(function (whitelist) {
        $scope.whitelist = whitelist.data;
    });
    $http.get('/api/recent_ips').then(function (recent_ips) {
        $scope.recent_ips = recent_ips.data;
    });
    $scope.edit_zone = function (zone) {
        $window.location = 'https://luminati.io/cp/zones/' + zone;
    };
}

_module.controller('faq', Faq);
Faq.$inject = ['$scope'];
function Faq($scope) {
    $scope.questions = [{
        name: 'links',
        title: 'More info on the Luminati proxy manager'
    }, {
        name: 'upgrade',
        title: 'How can I upgrade Luminati proxy manager tool?'
    }, {
        name: 'ssl',
        title: 'How do I enable HTTPS analyzing?'
    }];
}

_module.controller('test', Test);
Test.$inject = ['$scope', '$http', '$filter', '$window'];
function Test($scope, $http, $filter, $window) {
    if (qs_o.action && qs_o.action == 'test_proxy') $scope.expand = true;
    var preset = JSON.parse(decodeURIComponent(($window.location.search.match(/[?&]test=([^&]+)/) || ['', 'null'])[1]));
    if (preset) {
        $scope.expand = true;
        $scope.proxy = '' + preset.port;
        $scope.url = preset.url;
        $scope.method = preset.method;
        $scope.body = preset.body;
    } else {
        $scope.method = 'GET';
        $scope.url = $scope.$root.settings.test_url;
    }
    $http.get('/api/proxies').then(function (proxies) {
        $scope.proxies = [['0', 'No proxy']];
        proxies.data.sort(function (a, b) {
            return a.port > b.port ? 1 : -1;
        });
        for (var i = 0; i < proxies.data.length; i++) {
            $scope.proxies.push(['' + proxies.data[i].port, '' + proxies.data[i].port]);
        }
        if (!$scope.proxy) $scope.proxy = $scope.proxies[1][0];
    });
    $scope.methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'COPY', 'HEAD', 'OPTIONS', 'LINK', 'UNLINK', 'PURGE', 'LOCK', 'UNLOCK', 'PROPFIND', 'VIEW'];
    $scope.request = {};
    $scope.go = function (proxy, url, method, headers, body) {
        var headers_obj = {};
        headers.forEach(function (h) {
            headers_obj[h.key] = h.value;
        });
        var req = {
            method: 'POST',
            url: '/api/test/' + proxy,
            data: {
                url: url,
                method: method,
                headers: headers_obj,
                body: body
            }
        };
        $scope.loading = true;
        $http(req).then(function (r) {
            $scope.loading = false;
            r = r.data;
            if (!r.error) {
                r.response.headers = Object.keys(r.response.headers).sort().map(function (key) {
                    return [key, r.response.headers[key]];
                });
            }
            $scope.request = r;
        });
    };
    $scope.headers = preset && preset.headers ? Object.keys(preset.headers).map(function (h) {
        return { key: h, value: preset.headers[h] };
    }) : [];
    $scope.add_header = function () {
        $scope.headers.push({ key: '', value: '' });
    };
    $scope.remove_header = function (index) {
        $scope.headers.splice(index, 1);
    };
    $scope.reset = function () {
        $scope.headers = [];
    };
}

_module.controller('test-ports', ['$scope', '$http', '$filter', '$window', function ($scope, $http, $filter, $window) {
    var preset = JSON.parse(decodeURIComponent(($window.location.search.match(/[?&]test-ports=([^&]+)/) || ['', 'null'])[1]));
    if (preset) $scope.proxy = '' + preset.port;
    $http.get('/api/proxies').then(function (proxies) {
        $scope.proxies = [['0', 'All proxies']];
        proxies.data.sort(function (a, b) {
            return a.port > b.port ? 1 : -1;
        });
        for (var i = 0; i < proxies.data.length; i++) {
            $scope.proxies.push(['' + proxies.data[i].port, '' + proxies.data[i].port]);
        }
        if (!$scope.proxy) $scope.proxy = $scope.proxies[1][0];
    });
    $scope.request = {};
    $scope.go = function (proxy) {
        $scope.reset();
        var req = {
            method: 'GET',
            url: '/api/test-ports?ports=' + (+proxy == 0 ? $scope.proxies.map(function (p) {
                return +p[0];
            }).filter(Boolean).join(',') : proxy)
        };
        $scope.loading = true;
        $http(req).then(function (r) {
            $scope.loading = false;
            r = r.data;
            if (!r.error) {
                for (var port in r) {
                    $scope.request[port] = r[port];
                }
            }
            $scope.request.responses = [];
            for (var p in $scope.request) {
                if (!+p) continue;
                var response = $scope.request[p].response || $scope.request[p].error;
                $scope.request.responses.push({
                    proxy: p,
                    body: response.body || { pass: false },
                    ts: response.ts || +new Date()
                });
            }
        });
    };
    $scope.reset = function () {
        $scope.request = {};
    };
}]);

_module.controller('countries', Countries);
Countries.$inject = ['$scope', '$http', '$window'];
function Countries($scope, $http, $window) {
    $scope.url = '';
    $scope.ua = '';
    $scope.path = '';
    $scope.headers = [];
    $scope.started = 0;
    $scope.num_loading = 0;
    $scope.add_header = function () {
        $scope.headers.push({ key: '', value: '' });
    };
    $scope.remove_header = function (index) {
        $scope.headers.splice(index, 1);
    };
    var normalize_headers = function normalize_headers(headers) {
        var result = {};
        for (var h in headers) {
            result[headers[h].key] = headers[h].value;
        }return result;
    };
    $scope.go = function () {
        var process = function process() {
            $scope.started++;
            $scope.countries = [];
            var max_concur = 4;
            $scope.num_loading = 0;
            $scope.cur_index = 0;
            var progress = function progress(apply) {
                while ($scope.cur_index < $scope.countries.length && $scope.num_loading < max_concur) {
                    if (!$scope.countries[$scope.cur_index].status) {
                        $scope.countries[$scope.cur_index].status = 1;
                        $scope.countries[$scope.cur_index].img.src = $scope.countries[$scope.cur_index].url;
                        $scope.num_loading++;
                    }
                    $scope.cur_index++;
                }
                if (apply) $scope.$apply();
            };
            var nheaders = JSON.stringify(normalize_headers($scope.headers));
            for (var c_index in $scope.$root.consts.proxy.country.values) {
                var c = $scope.$root.consts.proxy.country.values[c_index];
                if (!c.value) continue;
                var params = {
                    country: c.value,
                    url: $scope.url,
                    path: $scope.path,
                    ua: $scope.ua,
                    headers: nheaders
                };
                var nparams = [];
                for (var p in params) {
                    nparams.push(p + '=' + encodeURIComponent(params[p]));
                }var data = {
                    code: c.value,
                    name: c.key,
                    status: 0,
                    url: '/api/country?' + nparams.join('&'),
                    img: new Image(),
                    index: $scope.countries.length
                };
                data.img.onerror = function (started) {
                    return function () {
                        if ($scope.started != started) return;
                        data.status = 3;
                        $scope.num_loading--;
                        progress(true);
                    };
                }($scope.started);
                data.img.onload = function (started) {
                    return function () {
                        if ($scope.started != started) return;
                        data.status = 4;
                        $scope.num_loading--;
                        progress(true);
                    };
                }($scope.started);
                $scope.countries.push(data);
            }
            progress(false);
        };
        if ($scope.started) {
            $scope.$root.confirmation = {
                text: 'The currently made screenshots will be lost. ' + 'Do you want to continue?',
                confirmed: process
            };
            $window.$('#confirmation').modal();
        } else process();
    };
    $scope.view = function (country) {
        $scope.screenshot = {
            country: country.name,
            url: country.url
        };
        $window.$('#countries-screenshot').one('shown.bs.modal', function () {
            $window.$('#countries-screenshot .modal-body > div').scrollTop(0).scrollLeft(0);
        }).modal();
    };
    $scope.cancel = function (country) {
        if (!country.status) country.status = 2;else if (country.status == 1) country.img.src = '';
    };
    $scope.cancel_all = function () {
        $scope.$root.confirmation = {
            text: 'Do you want to stop all the remaining countries?',
            confirmed: function confirmed() {
                for (var c_i = $scope.countries.length - 1; c_i >= 0; c_i--) {
                    var country = $scope.countries[c_i];
                    if (country.status < 2) $scope.cancel(country);
                }
            }
        };
        $window.$('#confirmation').modal();
    };
    $scope.retry = function (country) {
        if ($scope.cur_index > country.index) {
            country.status = 1;
            // XXX colin/ovidiu: why not use urlencoding?
            country.url = country.url.replace(/&\d+$/, '') + '&' + +(0, _date2.default)();
            $scope.num_loading++;
            country.img.src = country.url;
        } else country.status = 0;
    };
}

_module.filter('startFrom', function () {
    return function (input, start) {
        return input.slice(+start);
    };
});

function check_by_re(r, v) {
    return (v = v.trim()) && r.test(v);
}
var check_number = check_by_re.bind(null, /^\d+$/);
function check_reg_exp(v) {
    try {
        return (v = v.trim()) || new RegExp(v, 'i');
    } catch (e) {
        return false;
    }
}

_module.controller('proxies', Proxies);
Proxies.$inject = ['$scope', '$rootScope', '$http', '$proxies', '$window', '$q', '$timeout', '$stateParams', '$success_rate'];
function Proxies($scope, $root, $http, $proxies, $window, $q, $timeout, $stateParams, $success_rate) {
    var prepare_opts = function prepare_opts(opt) {
        return opt.map(function (o) {
            return { key: o, value: o };
        });
    };
    $success_rate.listen();
    $scope.$on('$destroy', function () {
        $success_rate.stop_listening();
    });
    var iface_opts = [],
        zone_opts = [];
    var country_opts = [],
        region_opts = {},
        cities_opts = {};
    var pool_type_opts = [],
        dns_opts = [],
        log_opts = [],
        debug_opts = [];
    var opt_columns = [{
        key: 'port',
        title: 'Port',
        type: 'number',
        check: function check(v, config) {
            if (check_number(v) && v >= 24000) {
                var conflicts = $proxies.proxies.filter(function (proxy) {
                    return proxy.port == v && proxy.port != config.port;
                });
                return !conflicts.length;
            }
            return false;
        }
    }, {
        key: '_status',
        title: 'Status',
        type: 'status'
    }, {
        key: 'iface',
        title: 'Interface',
        type: 'options',
        options: function options() {
            return iface_opts;
        }
    }, {
        key: 'multiply',
        title: 'Multiple',
        type: 'number'
    }, {
        key: 'history',
        title: 'History',
        type: 'boolean'
    }, {
        key: 'ssl',
        title: 'SSL analyzing',
        type: 'boolean'
    }, {
        key: 'socks',
        title: 'SOCKS port',
        type: 'number',
        check: check_number
    }, {
        key: 'zone',
        title: 'Zone',
        type: 'options',
        options: function options() {
            return zone_opts;
        }
    }, {
        key: 'secure_proxy',
        title: 'SSL for super proxy',
        type: 'boolean'
    }, {
        key: 'country',
        title: 'Country',
        type: 'options',
        options: function options(proxy) {
            if (proxy && proxy.zone == 'static') {
                return country_opts.filter(function (c) {
                    return ['', 'br', 'de', 'gb', 'au', 'us'].includes(c.value);
                });
            }
            return country_opts;
        }
    }, {
        key: 'state',
        title: 'State',
        type: 'options',
        options: function options(proxy) {
            return load_regions(proxy.country);
        }
    }, {
        key: 'city',
        title: 'City',
        type: 'autocomplete',
        check: function check() {
            return true;
        },
        options: function options(proxy, view_val) {
            var cities = load_cities(proxy);
            if (!view_val) return cities;
            return cities.filter(function (c) {
                return c.value.toLowerCase().startsWith(view_val.toLowerCase());
            });
        }
    }, {
        key: 'asn',
        title: 'ASN',
        type: 'number',
        check: function check(v) {
            return check_number(v) && v < 400000;
        }
    }, {
        key: 'ip',
        title: 'Datacenter IP',
        type: 'text',
        check: function check(v) {
            if (!(v = v.trim())) return true;
            var m = v.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
            if (!m) return false;
            for (var i = 1; i <= 4; i++) {
                if (m[i] !== '0' && m[i].charAt(0) == '0' || m[i] > 255) return false;
            }
            return true;
        }
    }, {
        key: 'vip',
        title: 'VIP',
        type: 'number',
        check: function check(v) {
            return true;
        }
    }, {
        key: 'max_requests',
        title: 'Max requests',
        type: 'text',
        check: function check(v) {
            return !v || check_by_re(/^\d+(:\d*)?$/, v);
        }
    }, {
        key: 'session_duration',
        title: 'Session duration (sec)',
        type: 'text',
        check: function check(v) {
            return !v || check_by_re(/^\d+(:\d*)?$/, v);
        }
    }, {
        key: 'pool_size',
        title: 'Pool size',
        type: 'number',
        check: function check(v) {
            return !v || check_number(v);
        }
    }, {
        key: 'pool_type',
        title: 'Pool type',
        type: 'options',
        options: function options() {
            return pool_type_opts;
        }
    }, {
        key: 'sticky_ip',
        title: 'Sticky IP',
        type: 'boolean'
    }, {
        key: 'keep_alive',
        title: 'Keep-alive',
        type: 'number',
        check: function check(v) {
            return !v || check_number(v);
        }
    }, {
        key: 'seed',
        title: 'Seed',
        type: 'text',
        check: function check(v) {
            return !v || check_by_re(/^[^\.\-]*$/, v);
        }
    }, {
        key: 'session',
        title: 'Session',
        type: 'text',
        check: function check(v) {
            return !v || check_by_re(/^[^\.\-]*$/, v);
        }
    }, {
        key: 'allow_proxy_auth',
        title: 'Allow request authentication',
        type: 'boolean'
    }, {
        key: 'session_init_timeout',
        title: 'Session init timeout (sec)',
        type: 'number',
        check: function check(v) {
            return !v || check_number(v);
        }
    }, {
        key: 'proxy_count',
        title: 'Min number of super proxies',
        type: 'number',
        check: function check(v) {
            return !v || check_number(v);
        }
    }, {
        key: 'race_reqs',
        title: 'Race request via different super proxies and take the' + ' fastest',
        type: 'number',
        check: function check(v) {
            return !v || check_number(v);
        }
    }, {
        key: 'dns',
        title: 'DNS',
        type: 'options',
        options: function options() {
            return dns_opts;
        }
    }, {
        key: 'log',
        title: 'Log Level',
        type: 'options',
        options: function options() {
            return log_opts;
        }
    }, {
        key: 'proxy_switch',
        title: 'Autoswitch super proxy on failure',
        type: 'number',
        check: function check(v) {
            return !v || check_number(v);
        }
    }, {
        key: 'throttle',
        title: 'Throttle concurrent connections',
        type: 'number',
        check: function check(v) {
            return !v || check_number(v);
        }
    }, {
        key: 'request_timeout',
        title: 'Request timeout (sec)',
        type: 'number',
        check: function check(v) {
            return !v || check_number(v);
        }
    }, {
        key: 'debug',
        title: 'Debug info',
        type: 'options',
        options: function options() {
            return debug_opts;
        }
    }, {
        key: 'null_response',
        title: 'NULL response',
        type: 'text',
        check: check_reg_exp
    }, {
        key: 'bypass_proxy',
        title: 'Bypass proxy',
        type: 'text',
        check: check_reg_exp
    }, {
        key: 'direct_include',
        title: 'Direct include',
        type: 'text',
        check: check_reg_exp
    }, {
        key: 'direct_exclude',
        title: 'Direct exclude',
        type: 'text',
        check: check_reg_exp
    }, {
        key: 'success_rate',
        title: 'Success rate',
        type: 'success_rate'
    }];
    var default_cols = {
        port: true,
        _status: true,
        zone: true,
        country: true,
        city: true,
        state: true,
        success_rate: true
    };
    $scope.cols_conf = JSON.parse($window.localStorage.getItem('columns')) || _lodash2.default.cloneDeep(default_cols);
    $scope.$watch('cols_conf', function () {
        $scope.columns = opt_columns.filter(function (col) {
            return col.key.match(/^_/) || $scope.cols_conf[col.key];
        });
    }, true);
    var apply_consts = function apply_consts(data) {
        iface_opts = data.iface.values;
        zone_opts = data.zone.values;
        country_opts = data.country.values;
        pool_type_opts = data.pool_type.values;
        dns_opts = prepare_opts(data.dns.values);
        log_opts = data.log.values;
        debug_opts = data.debug.values;
    };
    $scope.$on('consts', function (e, data) {
        apply_consts(data.proxy);
    });
    if ($scope.$root.consts) apply_consts($scope.$root.consts.proxy);
    $scope.zones = {};
    $scope.selected_proxies = {};
    $scope.showed_status_proxies = {};
    $scope.pagination = { page: 1, per_page: 10 };
    $scope.set_page = function () {
        var page = $scope.pagination.page;
        var per_page = $scope.pagination.per_page;
        if (page < 1) page = 1;
        if (page * per_page > $scope.proxies.length) page = Math.ceil($scope.proxies.length / per_page);
        $scope.pagination.page = page;
    };
    $proxies.subscribe(function (proxies) {
        $scope.proxies = proxies;
        $scope.set_page();
        proxies.forEach(function (p) {
            $scope.showed_status_proxies[p.port] = $scope.showed_status_proxies[p.port] && p._status_details.length;
        });
    });
    $scope.proxies_loading = function () {
        return !$scope.proxies || !$scope.consts || !$scope.defaults || !$scope.presets;
    };
    $scope.delete_proxies = function (proxy) {
        $scope.$root.confirmation = {
            text: 'Are you sure you want to delete the proxy?',
            confirmed: function confirmed() {
                var selected = proxy ? [proxy] : $scope.get_selected_proxies();
                var promises = $scope.proxies.filter(function (p) {
                    return p.proxy_type == 'persist' && selected.includes(p.port);
                }).map(function (p) {
                    return $http.delete('/api/proxies/' + p.port);
                });
                $scope.selected_proxies = {};
                $q.all(promises).then(function () {
                    return $proxies.update();
                });
            }
        };
        $window.$('#confirmation').modal();
        ga_event('page: proxies', 'click', 'delete proxy');
    };
    $scope.refresh_sessions = function (proxy) {
        $http.post('/api/refresh_sessions/' + proxy.port).then(function () {
            return $proxies.update();
        });
    };
    $scope.show_history = function (proxy) {
        $scope.history_dialog = [{ port: proxy.port }];
    };
    $scope.show_pool = function (proxy) {
        $scope.pool_dialog = [{
            port: proxy.port,
            sticky_ip: proxy.sticky_ip,
            pool_size: proxy.pool_size
        }];
    };
    $scope.add_proxy = function () {
        $scope.proxy_dialog = [{ proxy: {} }];
        ga_event('page: proxies', 'click', 'add proxy');
    };
    $scope.add_proxy_new = function () {
        (0, _jquery2.default)('#add_proxy_modal').modal('show');
    };
    $scope.edit_proxy_new = function (proxy) {
        $root.edit_proxy = proxy.config;
    };
    $scope.get_static_country = function (proxy) {
        var zone = proxy.zones[proxy.zone];
        if (!zone) return false;
        var plan = zone.plans[zone.plans.length - 1];
        if (plan.type == 'static') return plan.country || 'any';
        if (plan.vip == 1) return plan.vip_country || 'any';
        return false;
    };
    $scope.edit_proxy = function (duplicate, proxy) {
        var port = proxy.port || $scope.get_selected_proxies()[0];
        proxy = proxy ? [proxy] : $scope.proxies.filter(function (p) {
            return p.port == port;
        });
        $scope.proxy_dialog = [{ proxy: proxy[0].config, duplicate: duplicate }];
        ga_event('page: proxies', 'click', 'edit proxy');
    };
    $scope.edit_cols = function () {
        $scope.columns_dialog = [{
            columns: opt_columns.filter(function (col) {
                return !col.key.match(/^_/);
            }),
            cols_conf: $scope.cols_conf,
            default_cols: default_cols
        }];
        ga_event('page: proxies', 'click', 'edit columns');
    };
    $scope.download_csv = function () {
        var data = $scope.proxies.map(function (p) {
            return ['127.0.0.1:' + p.port];
        });
        ga_event('page: proxies', 'click', 'export_csv');
        _fileSaver2.default.saveAs(_csv2.default.to_blob(data), 'proxies.csv');
    };
    $scope.success_rate_hover = function (rate) {
        ga_event('page: proxies', 'hover', 'success_rate', rate);
    };
    $scope.inline_edit_click = function (proxy, col) {
        if (proxy.proxy_type != 'persist' || !$scope.is_valid_field(proxy, col.key) || $scope.get_static_country(proxy) && col.key == 'country') {
            return;
        }
        switch (col.type) {
            case 'number':
            case 'text':
            case 'autocomplete':
            case 'options':
                proxy.edited_field = col.key;break;
            case 'boolean':
                var config = _lodash2.default.cloneDeep(proxy.config);
                config[col.key] = !proxy[col.key];
                config.proxy_type = 'persist';
                $http.put('/api/proxies/' + proxy.port, { proxy: config }).then(function () {
                    $proxies.update();
                });
                break;
        }
    };
    $scope.inline_edit_input = function (proxy, col, event) {
        if (event.which == 27) return $scope.inline_edit_blur(proxy, col);
        var v = event.currentTarget.value;
        var p = $window.$(event.currentTarget).closest('.proxies-table-input');
        if (col.check(v, proxy.config)) p.removeClass('has-error');else return p.addClass('has-error');
        if (event.which != 13) return;
        v = v.trim();
        if (proxy.original && proxy.original[col.key] !== undefined && proxy.original[col.key].toString() == v) {
            return $scope.inline_edit_blur(proxy, col);
        }
        if (col.type == 'number' && v) v = +v;
        var config = _lodash2.default.cloneDeep(proxy.config);
        config[col.key] = v;
        config.proxy_type = 'persist';
        $http.post('/api/proxy_check/' + proxy.port, config).then(function (res) {
            var errors = res.data.filter(function (i) {
                return i.lvl == 'err';
            });
            if (!errors.length) return $http.put('/api/proxies/' + proxy.port, { proxy: config });
        }).then(function (res) {
            if (res) $proxies.update();
        });
    };
    $scope.inline_edit_select = function (proxy, col, event) {
        if (event.which == 27) return $scope.inline_edit_blur(proxy, col);
    };
    $scope.inline_edit_set = function (proxy, col, v) {
        if (proxy.original[col.key] === v || proxy.original[col.key] == v && v !== true) return $scope.inline_edit_blur(proxy, col);
        var config = _lodash2.default.cloneDeep(proxy.config);
        config[col.key] = v;
        config.proxy_type = 'persist';
        if (col.key == 'country') config.state = config.city = '';
        if (col.key == 'state') config.city = '';
        if (col.key == 'zone' && $scope.consts) {
            var zone;
            if (zone = $scope.consts.proxy.zone.values.find(_lodash2.default.matches({ zone: v }))) {
                config.password = zone.password;
                var plan = zone.plans[zone.plans.length - 1];
                if (!plan.city) config.state = config.city = '';
            }
        }
        $http.put('/api/proxies/' + proxy.port, { proxy: config }).then(function () {
            $proxies.update();
        });
    };
    $scope.inline_edit_blur = function (proxy, col) {
        $timeout(function () {
            if (proxy.original) proxy.config[col.key] = proxy.original[col.key];
            if (proxy.edited_field == col.key) proxy.edited_field = '';
        }, 100);
    };
    $scope.inline_edit_start = function (proxy, col) {
        if (!proxy.original) proxy.original = _lodash2.default.cloneDeep(proxy.config);
        if (col.key == 'session' && proxy.config.session === true) proxy.config.session = '';
    };
    $scope.get_selected_proxies = function () {
        return Object.keys($scope.selected_proxies).filter(function (p) {
            return $scope.selected_proxies[p];
        }).map(function (p) {
            return +p;
        });
    };
    $scope.is_action_available = function (action, port) {
        var proxies = $scope.get_selected_proxies() || port ? [port] : [];
        if (!proxies.length) return false;
        if (action == 'duplicate') return proxies.length == 1;
        if (port) return port.proxy_type == 'persist';
        return !$scope.proxies.some(function (sp) {
            return $scope.selected_proxies[sp.port] && sp.proxy_type != 'persist';
        });
    };
    $scope.option_key = function (col, val) {
        var opt = col.options().find(function (o) {
            return o.value == val;
        });
        return opt && opt.key;
    };
    $scope.toggle_proxy_status_details = function (proxy) {
        if (proxy._status_details.length) {
            $scope.showed_status_proxies[proxy.port] = !$scope.showed_status_proxies[proxy.port];
        }
    };
    $scope.get_colspans = function () {
        for (var i = 0; i < $scope.columns.length; i++) {
            if ($scope.columns[i].key == '_status') return [i + 1, $scope.columns.length - i + 1];
        }
        return [0, 0];
    };
    $scope.get_column_tooltip = function (proxy, col) {
        if (proxy.proxy_type != 'persist') return 'This proxy\'s settings cannot be changed';
        if (!$scope.is_valid_field(proxy, col.key)) {
            return 'You don\'t have \'' + col.key + '\' permission.<br>' + 'Please contact your success manager.';
        }
        if (col.key == 'country' && $scope.get_static_country(proxy)) {
            return $scope.option_key(col, $scope.get_static_country(proxy)) || 'Any country';
        }
        if (col.key == 'country') return $scope.option_key(col, proxy[col.key]);
        if (col.key == 'session' && proxy.session === true) return 'Random';
        if (['state', 'city'].includes(col.key) && [undefined, '', '*'].includes(proxy.country)) {
            return 'Set the country first';
        }
        var config_val = proxy.config[col.key];
        var real_val = proxy[col.key];
        if (real_val && real_val !== config_val) return 'Set non-default value';
        return 'Change value';
    };
    $scope.is_valid_field = function (proxy, name) {
        if (!$scope.$root.consts) return true;
        return is_valid_field(proxy, name, $scope.$root.consts.proxy.zone);
    };
    $scope.starts_with = function (actual, expected) {
        return expected.length > 1 && actual.toLowerCase().startsWith(expected.toLowerCase());
    };
    $scope.typeahead_on_select = function (proxy, col, item) {
        if (col.key == 'city') {
            var config = _lodash2.default.cloneDeep(proxy.config);
            if (item.value == '' || item.value == '*') config.city = '';else config.city = item.key;
            config.state = item.region || '';
            $http.put('/api/proxies/' + proxy.port, { proxy: config }).then(function () {
                $proxies.update();
            });
        }
    };
    $scope.on_page_change = function () {
        $scope.selected_proxies = {};
    };
    $scope.show_add_proxy = function () {
        return JSON.parse($window.localStorage.getItem('add_proxy'));
    };
    var load_regions = function load_regions(country) {
        if (!country || country == '*') return [];
        return region_opts[country] || (region_opts[country] = $http.get('/api/regions/' + country.toUpperCase()).then(function (r) {
            return region_opts[country] = r.data;
        }));
    };
    var load_cities = function load_cities(proxy) {
        var country = proxy.country || ''.toUpperCase();
        var state = proxy.state;
        if (!country || country == '*') return [];
        if (!cities_opts[country]) {
            cities_opts[country] = [];
            $http.get('/api/cities/' + country).then(function (res) {
                cities_opts[country] = res.data.map(function (city) {
                    if (city.region) city.value = city.value + ' (' + city.region + ')';
                    return city;
                });
                return cities_opts[country];
            });
        }
        var options = cities_opts[country];
        // XXX maximk: temporary disable filter by state
        if (false) {
            options = options.filter(function (i) {
                return i.region == state;
            });
        }
        return options;
    };
    $scope.react_component = _stats2.default;
    $scope.add_proxy_modal = _add_proxy2.default;
    if ($stateParams.add_proxy || qs_o.action && qs_o.action == 'tutorial_add_proxy') {
        setTimeout($scope.add_proxy);
    }
}

_module.controller('history', History);
History.$inject = ['$scope', '$http', '$window'];
function History($scope, $http, $window) {
    $scope.hola_headers = [];
    $http.get('/api/hola_headers').then(function (h) {
        $scope.hola_headers = h.data;
    });
    $scope.init = function (locals) {
        var loader_delay = 100;
        var timestamp_changed_by_select = false;
        $scope.initial_loading = true;
        $scope.port = locals.port;
        $scope.show_modal = function () {
            $window.$('#history').modal();
        };
        $http.get('/api/history_context/' + locals.port).then(function (c) {
            $scope.history_context = c.data;
        });
        $scope.periods = [{ label: 'all time', value: '*' }, { label: '1 year', value: { y: 1 } }, { label: '3 months', value: { M: 3 } }, { label: '2 months', value: { M: 2 } }, { label: '1 month', value: { M: 1 } }, { label: '1 week', value: { w: 1 } }, { label: '3 days', value: { d: 3 } }, { label: '1 day', value: { d: 1 } }, { label: 'custom', value: '' }];
        $scope.fields = [{
            field: 'url',
            title: 'Url',
            type: 'string',
            filter_label: 'URL or substring'
        }, {
            field: 'method',
            title: 'Method',
            type: 'options',
            filter_label: 'Request method'
        }, {
            field: 'status_code',
            title: 'Code',
            type: 'number',
            filter_label: 'Response code'
        }, {
            field: 'timestamp',
            title: 'Time',
            type: 'daterange'
        }, {
            field: 'elapsed',
            title: 'Elapsed',
            type: 'numrange'
        }, {
            field: 'country',
            title: 'Country',
            type: 'options',
            filter_label: 'Node country'
        }, {
            field: 'super_proxy',
            title: 'Super Proxy',
            type: 'string',
            filter_label: 'Super proxy or substring'
        }, {
            field: 'proxy_peer',
            title: 'Proxy Peer',
            type: 'string',
            filter_label: 'IP or substring'
        }, {
            field: 'context',
            title: 'Context',
            type: 'options',
            filter_label: 'Request context'
        }];
        $scope.sort_field = 'timestamp';
        $scope.sort_asc = false;
        $scope.virtual_filters = { period: $scope.periods[0].value };
        $scope.filters = {
            url: '',
            method: '',
            status_code: '',
            timestamp: '',
            timestamp_min: null,
            timestamp_max: null,
            elapsed: '',
            elapsed_min: '',
            elapsed_max: '',
            country: '',
            super_proxy: '',
            proxy_peer: '',
            context: ''
        };
        $scope.pagination = {
            page: 1,
            per_page: 10,
            total: 1
        };
        $scope.update = function (export_type) {
            var params = { sort: $scope.sort_field };
            if (!export_type) {
                params.limit = $scope.pagination.per_page;
                params.skip = ($scope.pagination.page - 1) * $scope.pagination.per_page;
            }
            if (!$scope.sort_asc) params.sort_desc = 1;
            if ($scope.filters.url) params.url = $scope.filters.url;
            if ($scope.filters.method) params.method = $scope.filters.method;
            if ($scope.filters.status_code) params.status_code = $scope.filters.status_code;
            if ($scope.filters.timestamp_min) {
                params.timestamp_min = (0, _moment2.default)($scope.filters.timestamp_min, 'YYYY/MM/DD').valueOf();
            }
            if ($scope.filters.timestamp_max) {
                params.timestamp_max = (0, _moment2.default)($scope.filters.timestamp_max, 'YYYY/MM/DD').add(1, 'd').valueOf();
            }
            if ($scope.filters.elapsed_min) params.elapsed_min = $scope.filters.elapsed_min;
            if ($scope.filters.elapsed_max) params.elapsed_max = $scope.filters.elapsed_max;
            if ($scope.filters.country) params.country = $scope.filters.country;
            if ($scope.filters.super_proxy) params.super_proxy = $scope.filters.super_proxy;
            if ($scope.filters.proxy_peer) params.proxy_peer = $scope.filters.proxy_peer;
            if ($scope.filters.context) params.context = $scope.filters.context;
            var params_arr = [];
            for (var param in params) {
                params_arr.push(param + '=' + encodeURIComponent(params[param]));
            }var url = '/api/history';
            if (export_type == 'har' || export_type == 'csv') url += '_' + export_type;
            url += '/' + locals.port + '?' + params_arr.join('&');
            if (export_type) return $window.location = url;
            $scope.loading = +(0, _date2.default)();
            setTimeout(function () {
                $scope.$apply();
            }, loader_delay);
            $http.get(url).then(function (res) {
                $scope.pagination.total_items = res.data.total;
                var history = res.data.items;
                $scope.initial_loading = false;
                $scope.loading = false;
                $scope.history = history.map(function (r) {
                    var alerts = [];
                    var disabled_alerts = [];
                    var add_alert = function add_alert(alert) {
                        if (localStorage.getItem('request-alert-disabled-' + alert.type)) {
                            disabled_alerts.push(alert);
                        } else alerts.push(alert);
                    };
                    var raw_headers = JSON.parse(r.request_headers);
                    var request_headers = {};
                    for (var h in raw_headers) {
                        request_headers[h.toLowerCase()] = raw_headers[h];
                    }r.request_headers = request_headers;
                    r.response_headers = JSON.parse(r.response_headers);
                    r.alerts = alerts;
                    r.disabled_alerts = disabled_alerts;
                    if (r.url.match(/^(https?:\/\/)?\d+\.\d+\.\d+\.\d+[$\/\?:]/)) {
                        add_alert({
                            type: 'ip_url',
                            title: 'IP URL',
                            description: 'The url uses IP and not ' + 'hostname, it will not be served from the' + ' proxy peer. It could mean a resolve ' + 'configuration issue when using SOCKS.'
                        });
                    }
                    if (r.method == 'CONNECT' || request_headers.host == 'lumtest.com' || r.url.match(/^https?:\/\/lumtest.com[$\/\?]/)) {
                        return r;
                    }
                    if (!request_headers['user-agent']) {
                        add_alert({
                            type: 'agent_empty',
                            title: 'Empty user agent',
                            description: 'The User-Agent header ' + 'is not set to any value.'
                        });
                    } else if (!request_headers['user-agent'].match(/^Mozilla\//)) {
                        add_alert({
                            type: 'agent_suspicious',
                            title: 'Suspicious user agent',
                            description: 'The User-Agent header is set to ' + 'a value not corresponding to any of the ' + 'major web browsers.'
                        });
                    }
                    if (!request_headers.accept) {
                        add_alert({
                            type: 'accept_empty',
                            title: 'Empty accept types',
                            description: 'The Accept header is not set to ' + 'any value.'
                        });
                    }
                    if (!request_headers['accept-encoding']) {
                        add_alert({
                            type: 'accept_encoding_empty',
                            title: 'Empty accept encoding',
                            description: 'The Accept-Encoding header is ' + 'not set to any value.'
                        });
                    }
                    if (!request_headers['accept-language']) {
                        add_alert({
                            type: 'accept_language_empty',
                            title: 'Empty accept language',
                            description: 'The Accept-Language header is ' + 'not set to any value.'
                        });
                    }
                    if (request_headers.connection != 'keep-alive') {
                        add_alert({
                            type: 'connection_suspicious',
                            title: 'Suspicious connection type',
                            description: 'The Connection header is not ' + 'set to "keep-alive".'
                        });
                    }
                    if (r.method == 'GET' && !r.url.match(/^https?:\/\/[^\/\?]+\/?$/) && !r.url.match(/[^\w]favicon[^\w]/) && !request_headers.referer) {
                        add_alert({
                            type: 'referer_empty',
                            title: 'Empty referrer',
                            description: 'The Referer header is not set ' + 'even though the requested URL is not ' + 'the home page of the site.'
                        });
                    }
                    var sensitive_headers = [];
                    for (var i in $scope.hola_headers) {
                        if (request_headers[$scope.hola_headers[i]]) sensitive_headers.push($scope.hola_headers[i]);
                    }
                    if (sensitive_headers.length) {
                        add_alert({
                            type: 'sensitive_header',
                            title: 'Sensitive request header',
                            description: (sensitive_headers.length > 1 ? 'There are sensitive request headers' : 'There is sensitive request header') + ' in the request: ' + sensitive_headers.join(', ')
                        });
                    }
                    return r;
                });
            });
        };
        $scope.show_loader = function () {
            return $scope.loading && (0, _date2.default)() - $scope.loading >= loader_delay;
        };
        $scope.sort = function (field) {
            if ($scope.sort_field == field.field) $scope.sort_asc = !$scope.sort_asc;else {
                $scope.sort_field = field.field;
                $scope.sort_asc = true;
            }
            $scope.update();
        };
        $scope.filter = function (field) {
            var options;
            if (field.field == 'method') {
                options = ['', 'GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'COPY', 'HEAD', 'OPTIONS', 'LINK', 'UNLINK', 'PURGE', 'LOCK', 'UNLOCK', 'PROPFIND', 'VIEW', 'TRACE', 'CONNECT'].map(function (e) {
                    return { key: e, value: e };
                });
            } else if (field.field == 'country') options = $scope.$root.consts.proxy.country.values;else if (field.field == 'context') options = $scope.history_context;
            $scope.filter_dialog = [{
                field: field,
                filters: $scope.filters,
                update: $scope.update,
                options: options
            }];
            setTimeout(function () {
                $window.$('#history_filter').one('shown.bs.modal', function () {
                    $window.$('#history_filter .history-filter-autofocus').select().focus();
                }).modal();
            }, 0);
        };
        $scope.filter_cancel = function (field) {
            if (field.field == 'elapsed') {
                $scope.filters.elapsed_min = '';
                $scope.filters.elapsed_max = '';
            }
            if (field.field == 'timestamp') {
                $scope.filters.timestamp_min = null;
                $scope.filters.timestamp_max = null;
            }
            $scope.filters[field.field] = '';
            $scope.update();
        };
        $scope.toggle_prop = function (row, prop) {
            row[prop] = !row[prop];
        };
        $scope.export_type = 'visible';
        $scope.disable_alert = function (row, alert) {
            localStorage.setItem('request-alert-disabled-' + alert.type, 1);
            for (var i = 0; i < row.alerts.length; i++) {
                if (row.alerts[i].type == alert.type) {
                    row.disabled_alerts.push(row.alerts.splice(i, 1)[0]);
                    break;
                }
            }
        };
        $scope.enable_alert = function (row, alert) {
            localStorage.removeItem('request-alert-disabled-' + alert.type);
            for (var i = 0; i < row.disabled_alerts.length; i++) {
                if (row.disabled_alerts[i].type == alert.type) {
                    row.alerts.push(row.disabled_alerts.splice(i, 1)[0]);
                    break;
                }
            }
        };
        $scope.on_period_change = function () {
            var period = $scope.virtual_filters.period;
            if (!period) return;
            if (period != '*') {
                var from = (0, _moment2.default)().subtract($scope.virtual_filters.period).format('YYYY/MM/DD');
                var to = (0, _moment2.default)().format('YYYY/MM/DD');
                $scope.filters.timestamp_min = from;
                $scope.filters.timestamp_max = to;
                $scope.filters.timestamp = from + '-' + to;
            } else {
                $scope.filters.timestamp_min = null;
                $scope.filters.timestamp_max = null;
                $scope.filters.timestamp = '';
            }
            timestamp_changed_by_select = true;
            $scope.update();
        };
        $scope.$watch('filters.timestamp', function (after) {
            if (!after) $scope.virtual_filters.period = '*';else if (!timestamp_changed_by_select) $scope.virtual_filters.period = '';
            timestamp_changed_by_select = false;
        });
        $scope.update();
    };
}

_module.controller('history_filter', History_filter);
History_filter.$inject = ['$scope', '$window'];
function History_filter($scope, $window) {
    $scope.init = function (locals) {
        $scope.field = locals.field;
        var field = locals.field.field;
        var range = field == 'elapsed' || field == 'timestamp';
        $scope.value = { composite: locals.filters[field] };
        if (range) {
            $scope.value.min = locals.filters[field + '_min'];
            $scope.value.max = locals.filters[field + '_max'];
        }
        $scope.options = locals.options;
        $scope.keypress = function (event) {
            if (event.which == 13) {
                $scope.apply();
                $window.$('#history_filter').modal('hide');
            }
        };
        $scope.daterange = function (event) {
            $window.$(event.currentTarget).closest('.input-group').datepicker({
                autoclose: true,
                format: 'yyyy/mm/dd'
            }).datepicker('show');
        };
        $scope.apply = function () {
            if (range) {
                var display_min, display_max;
                display_min = $scope.value.min;
                display_max = $scope.value.max;
                if ($scope.value.min && $scope.value.max) $scope.value.composite = display_min + '-' + display_max;else if ($scope.value.min) $scope.value.composite = 'From ' + display_min;else if ($scope.value.max) $scope.value.composite = 'Up to ' + display_max;else $scope.value.composite = '';
                locals.filters[field + '_min'] = $scope.value.min;
                locals.filters[field + '_max'] = $scope.value.max;
            }
            if ($scope.value.composite != locals.filters[field]) {
                locals.filters[field] = $scope.value.composite;
                locals.update();
            }
        };
    };
}

_module.controller('pool', Pool);
Pool.$inject = ['$scope', '$http', '$window'];
function Pool($scope, $http, $window) {
    $scope.init = function (locals) {
        $scope.port = locals.port;
        $scope.pool_size = locals.pool_size;
        $scope.sticky_ip = locals.sticky_ip;
        $scope.pagination = { page: 1, per_page: 10 };
        $scope.show_modal = function () {
            $window.$('#pool').modal();
        };
        $scope.update = function (refresh) {
            $scope.pool = null;
            $http.get('/api/sessions/' + $scope.port + (refresh ? '?refresh' : '')).then(function (res) {
                $scope.pool = res.data.data;
            });
        };
        $scope.update();
    };
}

_module.controller('proxy', Proxy);
Proxy.$inject = ['$scope', '$http', '$proxies', '$window', '$q', '$location'];
function Proxy($scope, $http, $proxies, $window, $q, $location) {
    $scope.init = function (locals) {
        var _presets = $scope.presets;
        var regions = {};
        var cities = {};
        $scope.consts = $scope.$root.consts.proxy;
        $scope.port = locals.duplicate ? '' : locals.proxy.port;
        var form = $scope.form = _lodash2.default.omit(_lodash2.default.cloneDeep(locals.proxy), 'rules');
        form.port = $scope.port;
        form.zone = form.zone || '';
        form.debug = form.debug || '';
        form.country = form.country || '';
        form.state = form.state || '';
        form.city = form.city || '';
        form.dns = form.dns || '';
        form.log = form.log || '';
        form.ips = form._ips || form.ips || [];
        delete form._ips;
        form.vips = form._vips || form.vips || [];
        delete form._vips;
        if (_lodash2.default.isBoolean(form.rule)) form.rule = {};
        $scope.extra = {
            reverse_lookup: '',
            reverse_lookup_dns: form.reverse_lookup_dns,
            reverse_lookup_file: form.reverse_lookup_file,
            reverse_lookup_values: (form.reverse_lookup_values || []).join('\n')
        };
        $scope.rule_actions = [{ label: 'Retry request(up to 20 times)',
            value: 'retry', raw: { ban_ip: '60min', retry: true } }];
        $scope.rule_statuses = ['200 - Succeeded requests', '403 - Forbidden', '404 - Not found', '500 - Internal server error', '502 - Bad gateway', '503 - Service unavailable', '504 - Gateway timeout', 'Custom'];
        if (form.rule && form.rule.action) {
            form.rule.action = _lodash2.default.find($scope.rule_actions, { value: form.rule.action.value });
        }
        if ($scope.extra.reverse_lookup_dns) $scope.extra.reverse_lookup = 'dns';else if ($scope.extra.reverse_lookup_file) $scope.extra.reverse_lookup = 'file';else if ($scope.extra.reverse_lookup_values) $scope.extra.reverse_lookup = 'values';
        $scope.extra.whitelist_ips = (form.whitelist_ips || []).join(',');
        $scope.status = {};
        var new_proxy = !form.port || form.port == '';
        if (new_proxy) {
            var port = 24000;
            var socks = form.socks;
            $scope.proxies.forEach(function (p) {
                if (p.port >= port) port = p.port + 1;
                if (socks && p.socks == socks) socks++;
            });
            form.port = port;
            form.socks = socks;
        }
        var def_proxy = form;
        if (new_proxy) {
            def_proxy = {};
            for (var key in $scope.consts) {
                if ($scope.consts[key].def !== undefined) def_proxy[key] = $scope.consts[key].def;
            }
        }
        for (var p in _presets) {
            if (_presets[p].check(def_proxy)) {
                form.preset = _presets[p];
                break;
            }
        }
        if (form.last_preset_applied && _presets[form.last_preset_applied]) form.preset = _presets[form.last_preset_applied];
        $scope.apply_preset = function () {
            var last_preset = form.last_preset_applied ? _presets[form.last_preset_applied] : null;
            form.applying_preset = true;
            if (last_preset && last_preset.clean) last_preset.clean(form);
            form.preset.set(form);
            form.last_preset_applied = form.preset.key;
            if (form.session === true) {
                form.session_random = true;
                form.session = '';
            }
            if (form.max_requests) {
                var max_requests = ('' + form.max_requests).split(':');
                form.max_requests_start = +max_requests[0];
                form.max_requests_end = +max_requests[1];
            }
            if (!form.max_requests) form.max_requests_start = 0;
            if (form.session_duration) {
                var session_duration = ('' + form.session_duration).split(':');
                form.duration_start = +session_duration[0];
                form.duration_end = +session_duration[1];
            }
            delete form.applying_preset;
        };
        $scope.apply_preset();
        $scope.form_errors = {};
        $scope.defaults = {};
        $scope.regions = [];
        $scope.cities = [];
        $scope.beta_features = $scope.$root.beta_features;
        $scope.get_zones_names = function () {
            return Object.keys($scope.zones);
        };
        $scope.show_modal = function () {
            $window.$('#proxy').one('shown.bs.modal', function () {
                $window.$('#proxy-field-port').select().focus();
                $window.$('#proxy .panel-collapse').on('show.bs.collapse', function (event) {
                    var container = $window.$('#proxy .proxies-settings');
                    var opening = $window.$(event.currentTarget).closest('.panel');
                    var pre = opening.prevAll('.panel');
                    var top;
                    if (pre.length) {
                        top = opening.position().top + container.scrollTop();
                        var closing = pre.find('.panel-collapse.in');
                        if (closing.length) top -= closing.height();
                    } else top = 0;
                    container.animate({ 'scrollTop': top }, 250);
                });
            }).modal();
        };
        $scope.is_show_allocated_ips = function () {
            var zone = $scope.consts.zone.values.filter(function (z) {
                return z.value == form.zone;
            })[0];
            var plan = (zone && zone.plans || []).slice(-1)[0];
            return (plan && plan.type || zone && zone.type) == 'static';
        };
        $scope.show_allocated_ips = function () {
            var zone = form.zone;
            var keypass = form.password || '';
            var modals = $scope.$root;
            modals.allocated_ips = {
                ips: [],
                loading: true,
                random_ip: function random_ip() {
                    modals.allocated_ips.ips.forEach(function (item) {
                        item.checked = false;
                    });
                    form.ips = [];
                    form.pool_size = 0;
                },
                toggle_ip: function toggle_ip(item) {
                    var index = form.ips.indexOf(item.ip);
                    if (item.checked && index < 0) form.ips.push(item.ip);else if (!item.checked && index > -1) form.ips.splice(index, 1);
                    if (!form.multiply_ips) form.pool_size = form.ips.length;else form.multiply = form.ips.length;
                },
                zone: zone
            };
            $window.$('#allocated_ips').modal();
            $http.get('/api/allocated_ips?zone=' + zone + '&key=' + keypass).then(function (res) {
                form.ips = form.ips.filter(function (ip) {
                    return res.data.ips.includes(ip);
                });
                modals.allocated_ips.ips = res.data.ips.map(function (ip_port) {
                    var ip = ip_port.split(':')[0];
                    return { ip: ip, checked: form.ips.includes(ip) };
                });
                modals.allocated_ips.loading = false;
            });
        };
        $scope.is_show_allocated_vips = function () {
            var zone = $scope.consts.zone.values.filter(function (z) {
                return z.value == form.zone;
            })[0];
            var plan = (zone && zone.plans || []).slice(-1)[0];
            return plan && !!plan.vip;
        };
        $scope.show_allocated_vips = function () {
            var zone = form.zone;
            var keypass = form.password || '';
            var modals = $scope.$root;
            modals.allocated_vips = {
                vips: [],
                loading: true,
                random_vip: function random_vip() {
                    modals.allocated_vips.vips.forEach(function (item) {
                        item.checked = false;
                    });
                    form.vips = [];
                    form.pool_size = 0;
                },
                toggle_vip: function toggle_vip(item) {
                    var index = form.vips.indexOf(item.vip);
                    if (item.checked && index < 0) form.vips.push(item.vip);else if (!item.checked && index > -1) form.vips.splice(index, 1);
                    if (!form.multiply_vips) form.pool_size = form.vips.length;else form.multiply = form.vips.length;
                },
                zone: zone
            };
            $window.$('#allocated_vips').modal();
            $http.get('/api/allocated_vips?zone=' + zone + '&key=' + keypass).then(function (res) {
                form.vips = form.vips.filter(function (vip) {
                    return res.data.includes(vip);
                });
                modals.allocated_vips.vips = res.data.map(function (vip) {
                    return { vip: vip, checked: form.vips.includes(vip) };
                });
                modals.allocated_vips.loading = false;
            });
        };
        $scope.binary_changed = function (proxy, field, value) {
            proxy[field] = { 'yes': true, 'no': false, 'default': '' }[value];
        };
        var update_allowed_countries = function update_allowed_countries() {
            var countries = $scope.consts.country.values;
            $scope.allowed_countries = [];
            if (!countries) return;
            if (form.zone != 'static') return $scope.allowed_countries = countries;
            $scope.allowed_countries = countries.filter(function (c) {
                return ['', 'au', 'br', 'de', 'gb', 'us'].includes(c.value);
            });
        };
        $scope.update_regions_and_cities = function (is_init) {
            if (!is_init) $scope.form.region = $scope.form.city = '';
            $scope.regions = [];
            $scope.cities = [];
            var country = ($scope.form.country || '').toUpperCase();
            if (!country || country == '*') return;
            if (regions[country]) $scope.regions = regions[country];else {
                regions[country] = [];
                $http.get('/api/regions/' + country).then(function (res) {
                    $scope.regions = regions[country] = res.data;
                });
            }
            if (cities[country]) $scope.cities = cities[country];else {
                cities[country] = [];
                $http.get('/api/cities/' + country).then(function (res) {
                    cities[country] = res.data.map(function (city) {
                        if (city.region) city.value = city.value + ' (' + city.region + ')';
                        return city;
                    });
                    $scope.cities = cities[country];
                    $scope.update_cities();
                });
            }
        };
        $scope.update_cities = function () {
            var country = $scope.form.country.toUpperCase();
            var state = $scope.form.state;
            if (state == '' || state == '*') {
                $scope.form.city = '';
                $scope.cities = cities[country];
            } else {
                $scope.cities = cities[country].filter(function (item) {
                    return !item.region || item.region == state;
                });
                var exist = $scope.cities.filter(function (item) {
                    return item.key == $scope.form.city;
                }).length > 0;
                if (!exist) $scope.form.city = '';
            }
        };
        $scope.update_region_by_city = function (city) {
            if (city.region) $scope.form.state = city.region;
            $scope.update_cities();
        };
        $scope.reset_rules = function () {
            $scope.form.rule = {};
            $scope.form.rules = {};
            $scope.form.delete_rules = true;
            ga_event('proxy_form', 'reset_rules');
        };
        $scope.$watch('form.zone', function (val, old) {
            if (!$scope.consts || val == old) return;
            update_allowed_countries();
            var zone;
            if (zone = $scope.consts.zone.values.find(_lodash2.default.matches({ zone: val }))) form.password = zone.password;
        });
        $scope.$watch('form.multiply_ips', multiply_val_changed);
        $scope.$watch('form.multiply_vips', multiply_val_changed);
        function multiply_val_changed(val, old) {
            if (val == old) return;
            var size = Math.max(form.ips.length, form.vips.length);
            if (val) {
                form.pool_size = 0;
                form.multiply = size;
                return;
            }
            form.multiply = 1;
            form.pool_size = size;
        }
        $scope.$watchCollection('form', function (newv, oldv) {
            function has_changed(f) {
                var old = oldv && oldv[f] || '';
                var val = newv && newv[f] || '';
                return old !== val;
            }
            if (has_changed('preset')) {
                return ga_event('proxy_form', 'preset_change', newv.preset.title);
            }
            if (newv.applying_preset) return;
            for (var f in _lodash2.default.extend({}, newv, oldv)) {
                if (has_changed(f) && f != 'applying_preset' && f != 'rule') {
                    ga_event('proxy_form', f + '_change', f == 'password' ? 'redacted' : newv[f]);
                }
            }
        });
        $scope.$watchCollection('form.rule', function (newv, oldv) {
            function has_changed(f) {
                var old = oldv && oldv[f] || '';
                var val = newv && newv[f] || '';
                old = (typeof old === 'undefined' ? 'undefined' : _typeof(old)) == 'object' ? old.value : old;
                val = (typeof val === 'undefined' ? 'undefined' : _typeof(val)) == 'object' ? val.value : val;
                return old !== val;
            }
            if (_lodash2.default.isEmpty($scope.form.rule)) return;
            var val;
            for (var f in _lodash2.default.extend({}, newv, oldv)) {
                if (!has_changed(f)) continue;
                val = _typeof(newv[f]) == 'object' ? newv[f].value : newv[f];
                ga_event('proxy_form', 'rule_' + f + '_change', val);
            }
        });
        $scope.save = function (model) {
            var proxy = _angular2.default.copy(model);
            delete proxy.preset;
            for (var field in proxy) {
                if (!$scope.is_valid_field(field) || proxy[field] === null) proxy[field] = '';
            }
            var make_int_range = function make_int_range(start, end) {
                var s = parseInt(start, 10) || 0;
                var e = parseInt(end, 10) || 0;
                return s && e ? [s, e].join(':') : s || e;
            };
            var effective = function effective(prop) {
                return proxy[prop] === undefined ? $scope.defaults[prop] : proxy[prop];
            };
            if (proxy.session_random) proxy.session = true;
            proxy.max_requests = make_int_range(proxy.max_requests_start, proxy.max_requests_end);
            delete proxy.max_requests_start;
            delete proxy.max_requests_end;
            proxy.session_duration = make_int_range(proxy.duration_start, proxy.duration_end);
            delete proxy.duration_start;
            delete proxy.duration_end;
            proxy.history = effective('history');
            proxy.ssl = effective('ssl');
            proxy.max_requests = effective('max_requests');
            proxy.session_duration = effective('session_duration');
            proxy.keep_alive = effective('keep_alive');
            proxy.pool_size = effective('pool_size');
            proxy.proxy_type = 'persist';
            proxy.reverse_lookup_dns = '';
            proxy.reverse_lookup_file = '';
            proxy.reverse_lookup_values = '';
            if ($scope.extra.reverse_lookup == 'dns') proxy.reverse_lookup_dns = true;
            if ($scope.extra.reverse_lookup == 'file') proxy.reverse_lookup_file = $scope.extra.reverse_lookup_file;
            if ($scope.extra.reverse_lookup == 'values') {
                proxy.reverse_lookup_values = $scope.extra.reverse_lookup_values.split('\n');
            }
            proxy.whitelist_ips = $scope.extra.whitelist_ips.split(',').filter(Boolean);
            var reload;
            if (Object.keys(proxy.rule || {}).length) {
                if (!proxy.rule.url) delete proxy.rule.url;
                proxy.rule = _lodash2.default.extend({
                    url: '**',
                    action: {}
                }, proxy.rule);
                var rule_status = proxy.rule.status == 'Custom' ? proxy.rule.custom : proxy.rule.status;
                proxy.rules = {
                    post: [{
                        res: [{
                            head: true,
                            status: {
                                type: 'in',
                                arg: rule_status || ''
                            },
                            action: proxy.rule.action.raw || {}
                        }],
                        url: proxy.rule.url + '/**'
                    }]
                };
                reload = true;
            } else delete proxy.rules;
            if (proxy.delete_rules) proxy.rules = {};
            delete proxy.delete_rules;
            model.preset.set(proxy);
            var edit = $scope.port && !locals.duplicate;
            ga_event('proxy_form', 'proxy_' + (edit ? 'edit' : 'create'), 'start');
            var save_inner = function save_inner() {
                $scope.status.type = 'warning';
                $scope.status.message = 'Saving the proxy...';
                var promise = edit ? $http.put('/api/proxies/' + $scope.port, { proxy: proxy }) : $http.post('/api/proxies/', { proxy: proxy });
                var is_ok_cb = function is_ok_cb() {
                    $window.$('#proxy').modal('hide');
                    $proxies.update();
                    var curr_step = JSON.parse($window.localStorage.getItem('quickstart-step'));
                    if (curr_step == _common.onboarding_steps.ADD_PROXY) {
                        $window.localStorage.setItem('quickstart-step', _common.onboarding_steps.ADD_PROXY_DONE);
                        $window.localStorage.setItem('quickstart-first-proxy', proxy.port);
                    }
                    ga_event('proxy_form', 'proxy_' + (edit ? 'edit' : 'create'), 'ok');
                    return $http.post('/api/recheck').then(function (r) {
                        if (qs_o.action && qs_o.action == 'tutorial_add_proxy') {
                            $location.search({});
                            ga_event('lpm-onboarding', '04 tutorial create port completed', '');
                            $window.location = '/intro';
                        }
                        if (r.data.login_failure) $window.location = '/';
                    });
                };
                var is_not_ok_cb = function is_not_ok_cb(res) {
                    $scope.status.type = 'danger';
                    $scope.status.message = 'Error: ' + res.data.status;
                    ga_event('proxy_form', 'proxy_' + (edit ? 'edit' : 'create'), 'err');
                };
                promise.then(function () {
                    if (reload) {
                        $scope.status.type = 'warning';
                        $scope.status.message = 'Loading...';
                        return setTimeout(function () {
                            $window.location.reload();
                        }, 800);
                    }
                    $scope.status.type = 'warning';
                    $scope.status.message = 'Checking the proxy...';
                    return $http.get('/api/proxy_status/' + proxy.port);
                }).then(function (res) {
                    if (res.data && res.data.status == 'ok') return is_ok_cb(res);else if (res.data) return is_not_ok_cb(res);
                });
            };
            var url = '/api/proxy_check' + (edit ? '/' + $scope.port : '');
            $http.post(url, proxy).then(function (res) {
                $scope.form_errors = {};
                var warnings = [];
                _angular2.default.forEach(res.data, function (item) {
                    if (item.lvl == 'err') {
                        var msg = item.msg;
                        if (item.field == 'password' && msg == 'the provided password is not valid') {
                            msg = 'Wrong password';
                        }
                        $scope.form_errors[item.field] = msg;
                    }
                    if (item.lvl == 'warn') warnings.push(item.msg);
                });
                if (Object.keys($scope.form_errors).length) return;else if (warnings.length) {
                    $scope.$root.confirmation = {
                        text: 'Warning' + (warnings.length > 1 ? 's' : '') + ':',
                        items: warnings,
                        confirmed: save_inner
                    };
                    return $window.$('#confirmation').modal();
                }
                save_inner();
            });
        };
        $scope.is_valid_field = function (name) {
            return is_valid_field($scope.form, name, $scope.consts.zone);
        };
        $scope.starts_with = function (actual, expected) {
            return actual.toLowerCase().startsWith(expected.toLowerCase());
        };
        $scope.update_regions_and_cities(true);
        update_allowed_countries();
    };
}

_module.controller('columns', Columns);
Columns.$inject = ['$scope', '$window'];
function Columns($scope, $window) {
    $scope.init = function (locals) {
        $scope.columns = locals.columns;
        $scope.form = _lodash2.default.cloneDeep(locals.cols_conf);
        $scope.show_modal = function () {
            $window.$('#proxy-cols').modal();
        };
        $scope.save = function (config) {
            $window.$('#proxy-cols').modal('hide');
            $window.localStorage.setItem('columns', JSON.stringify(config));
            for (var c in config) {
                locals.cols_conf[c] = config[c];
            }
        };
        $scope.all = function () {
            for (var c in $scope.columns) {
                $scope.form[$scope.columns[c].key] = true;
            }
        };
        $scope.none = function () {
            for (var c in $scope.columns) {
                $scope.form[$scope.columns[c].key] = false;
            }
        };
        $scope.default = function () {
            for (var c in $scope.columns) {
                $scope.form[$scope.columns[c].key] = locals.default_cols[$scope.columns[c].key];
            }
        };
    };
}

_module.filter('timestamp', timestamp_filter);
function timestamp_filter() {
    return function (timestamp) {
        return (0, _moment2.default)(timestamp).format('YYYY/MM/DD HH:mm');
    };
}

_module.filter('requests', requests_filter);
requests_filter.$inject = ['$filter'];
function requests_filter($filter) {
    var number_filter = $filter('number');
    return function (requests, precision) {
        if (!requests || isNaN(parseFloat(requests)) || !isFinite(requests)) {
            return '';
        }
        if (typeof precision === 'undefined') precision = 0;
        return number_filter(requests, precision);
    };
}

_module.filter('bytes', function () {
    return _util2.default.bytes_format;
});

_module.filter('request', request_filter);
function request_filter() {
    return function (r) {
        return '/tools?test=' + encodeURIComponent(JSON.stringify({
            port: r.port,
            url: r.url,
            method: r.method,
            body: r.request_body,
            headers: r.request_headers
        }));
    };
}

_module.directive('initInputSelect', ['$window', function ($window) {
    return {
        restrict: 'A',
        link: function link(scope, element, attrs) {
            setTimeout(function () {
                element.select().focus();
            }, 100); // before changing check for input type=number in Firefox
        }
    };
}]);

_module.directive('initSelectOpen', ['$window', function ($window) {
    return {
        restrict: 'A',
        link: function link(scope, element, attrs) {
            setTimeout(function () {
                element.focus();
            }, 100);
        }
    };
}]);

_module.directive('reactView', ['$state', function ($state) {
    return {
        scope: { view: '=reactView', props: '@stateProps',
            extra_props: '=extraProps' },
        link: function link(scope, element, attrs) {
            var props = _lodash2.default.pick($state.params, (scope.props || '').split(' '));
            Object.assign(props, { extra: scope.extra_props });
            _reactDom2.default.render(_react2.default.createElement(scope.view, props), element[0]);
            element.on('$destroy', function () {
                _reactDom2.default.unmountComponentAtNode(element[0]);
            });
        }
    };
}]);

_module.filter('shorten', shorten_filter);
shorten_filter.$inject = ['$filter'];
function shorten_filter($filter) {
    return function (s, chars) {
        if (s.length <= chars + 2) return s;
        return s.substr(0, chars) + '...';
    };
}

_angular2.default.bootstrap(document, ['app']);

/***/ }),
/* 307 */,
/* 308 */,
/* 309 */,
/* 310 */,
/* 311 */,
/* 312 */,
/* 313 */,
/* 314 */,
/* 315 */,
/* 316 */,
/* 317 */
/***/ (function(module, exports, __webpack_require__) {

var __WEBPACK_AMD_DEFINE_ARRAY__, __WEBPACK_AMD_DEFINE_RESULT__;
var module;
// LICENSE_CODE ZON
'use strict'; /*jslint node:true, browser:true*/
(function(){

var is_node = typeof module=='object' && module.exports && module.children;
if (!is_node)
    ;
else
    ;
!(__WEBPACK_AMD_DEFINE_ARRAY__ = [], __WEBPACK_AMD_DEFINE_RESULT__ = function(){
var E = {};
var assign = Object.assign;

// Returns an array of arrays:
// [['field1', 'field2', 'field3'], ['1','2','3'], [..], ..]
E.to_arr = function(data, opt){
    opt = assign({field: ',', quote: '"', line: '\n'}, opt);
    var line = opt.line, field = opt.field, quote = opt.quote;
    var i = 0, c = data[i], row = 0, array = [];
    while (c)
    {
        while (opt.trim && (c==' ' || c=='\t' || c=='\r'))
            c = data[++i];
        var value = '';
        if (c==quote)
        {
            // value enclosed by quote
            c = data[++i];
            do {
                if (c!=quote)
                {
                    // read a regular character and go to the next character
                    value += c;
                    c = data[++i];
                }
                if (c==quote)
                {
                    // check for escaped quote
                    if (data[i+1]==quote)
                    {
                        // this is an escaped field. Add a quote
                        // to the value, and move two characters ahead.
                        value += quote;
                        i += 2;
                        c = data[i];
                    }
                }
            } while (c && (c!=quote || data[i+1]==quote));
            if (!c)
                throw 'Unexpected end of data, no closing quote found';
            c = data[++i];
        }
        else
        {
            // value not escaped with quote
            while (c && c!=field && c!=line &&
                (!opt.trim || c!=' ' && c!='\t' && c!='\r'))
            {
                value += c;
                c = data[++i];
            }
        }
        // add the value to the array
        if (array.length<=row)
            array.push([]);
        array[row].push(value);
        // skip whitespaces
        while (opt.trim && (c==' ' || c=='\t' || c=='\r'))
            c = data[++i];
        // go to the next row or column
        if (c==field);
        else if (c==line)
            row++;
        else if (c)
            throw 'Delimiter expected after character '+i;
        c = data[++i];
    }
    if (i && data[i-1]==field)
        array[row].push('');
    return array;
};

// Returns an array of hashs:
// [{field1: '1', field2: '2', field3: '3'}, {..}, ..]
E.to_obj = function(data, opt){
    var arr = E.to_arr(data, opt);
    if (!arr.length)
        return arr;
    var i, result = [], headers = arr[0];
    if ((i = headers.indexOf(''))!=-1)
        throw new Error('Field '+i+' has unknown name');
    for (i=1; i<arr.length; i++)
    {
        var obj = {};
        if (arr[i].length > headers.length)
            throw new Error('Line '+i+' has more fields than header');
        for (var j=0; j<arr[i].length; j++)
            obj[headers[j]] = arr[i][j];
        result.push(obj);
    }
    return result;
};

E.escape_field = function(s, opt){
    // opt not fully supported
    if (s==null && opt && opt.null_to_empty)
        return '';
    s = ''+s;
    if (!/["'\n,]/.test(s))
	return s;
    return '"'+s.replace(/"/g, '""')+'"';
};

E.to_str = function(csv, opt){
    var s = '', i, j, a;
    opt = assign({field: ',', quote: '"', line: '\n'}, opt);
    var line = opt.line, field = opt.field;
    function line_to_str(vals){
        var s = '';
        for (var i=0; i<vals.length; i++)
            s += (i ? field : '')+E.escape_field(vals[i], opt);
        return s+line;
    }
    if (!csv.length && !opt.keys)
        return '';
    if (Array.isArray(csv[0]))
    {
        if (opt.keys)
            s += line_to_str(opt.keys);
        for (i=0; i<csv.length; i++)
            s += line_to_str(csv[i]);
        return s;
    }
    var keys = opt.keys || Object.keys(csv[0]);
    if (opt.print_keys===undefined || opt.print_keys)
        s += line_to_str(keys);
    for (i=0; i<csv.length; i++)
    {
        for (j=0, a=[]; j<keys.length; j++)
        {
            var v = csv[i][keys[j]];
            a.push(v===undefined ? '' : v);
        }
        s += line_to_str(a);
    }
    return s;
};

E.to_blob = function(csv, opt){
    return new Blob([E.to_str(csv, opt)], {type: 'application/csv'}); };

return E; }.apply(exports, __WEBPACK_AMD_DEFINE_ARRAY__),
				__WEBPACK_AMD_DEFINE_RESULT__ !== undefined && (module.exports = __WEBPACK_AMD_DEFINE_RESULT__)); }());


/***/ }),
/* 318 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
// LICENSE_CODE ZON ISC
 /*jslint react:true, es6:true*/

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _regeneratorRuntime = __webpack_require__(20);

var _regeneratorRuntime2 = _interopRequireDefault(_regeneratorRuntime);

var _lodash = __webpack_require__(32);

var _lodash2 = _interopRequireDefault(_lodash);

var _react = __webpack_require__(0);

var _react2 = _interopRequireDefault(_react);

var _reactBootstrap = __webpack_require__(25);

var _util = __webpack_require__(29);

var _util2 = _interopRequireDefault(_util);

var _etask = __webpack_require__(19);

var _etask2 = _interopRequireDefault(_etask);

var _date = __webpack_require__(85);

var _date2 = _interopRequireDefault(_date);

var _axios = __webpack_require__(144);

var _axios2 = _interopRequireDefault(_axios);

var _common = __webpack_require__(47);

var _common2 = _interopRequireDefault(_common);

var _status_codes = __webpack_require__(78);

var _domains = __webpack_require__(99);

var _protocols = __webpack_require__(100);

var _common3 = __webpack_require__(37);

__webpack_require__(269);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var E = {
    install: function install() {
        return E.sp = (0, _etask2.default)('stats', [function () {
            return this.wait();
        }]);
    },
    uninstall: function uninstall() {
        if (E.sp) E.sp.return();
    }
};

var StatRow = function (_React$Component) {
    _inherits(StatRow, _React$Component);

    function StatRow(props) {
        _classCallCheck(this, StatRow);

        var _this2 = _possibleConstructorReturn(this, (StatRow.__proto__ || Object.getPrototypeOf(StatRow)).call(this, props));

        _this2.state = {};
        return _this2;
    }

    _createClass(StatRow, [{
        key: 'componentWillReceiveProps',
        value: function componentWillReceiveProps(props) {
            var _this3 = this;

            _lodash2.default.each(props.stat, function (v, k) {
                if (!_this3.state['class_' + k] && _this3.props.stat[k] != v) {
                    _this3.setState(_defineProperty({}, 'class_' + k, 'stats_row_change'));
                    setTimeout(function () {
                        return _this3.setState(_defineProperty({}, 'class_' + k, undefined));
                    }, 1000);
                }
            });
        }
    }]);

    return StatRow;
}(_react2.default.Component);

var SRow = function (_StatRow) {
    _inherits(SRow, _StatRow);

    function SRow() {
        _classCallCheck(this, SRow);

        return _possibleConstructorReturn(this, (SRow.__proto__ || Object.getPrototypeOf(SRow)).apply(this, arguments));
    }

    _createClass(SRow, [{
        key: 'render',
        value: function render() {
            return _react2.default.createElement(_status_codes.StatusCodeRow, _extends({ class_value: this.state.class_value,
                class_bw: this.state.class_bw }, this.props));
        }
    }]);

    return SRow;
}(StatRow);

var DRow = function (_StatRow2) {
    _inherits(DRow, _StatRow2);

    function DRow() {
        _classCallCheck(this, DRow);

        return _possibleConstructorReturn(this, (DRow.__proto__ || Object.getPrototypeOf(DRow)).apply(this, arguments));
    }

    _createClass(DRow, [{
        key: 'render',
        value: function render() {
            return _react2.default.createElement(_domains.DomainRow, _extends({ class_value: this.state.class_value,
                class_bw: this.state.class_bw }, this.props));
        }
    }]);

    return DRow;
}(StatRow);

var PRow = function (_StatRow3) {
    _inherits(PRow, _StatRow3);

    function PRow() {
        _classCallCheck(this, PRow);

        return _possibleConstructorReturn(this, (PRow.__proto__ || Object.getPrototypeOf(PRow)).apply(this, arguments));
    }

    _createClass(PRow, [{
        key: 'render',
        value: function render() {
            return _react2.default.createElement(_protocols.ProtocolRow, _extends({ class_value: this.state.class_value,
                class_bw: this.state.class_bw }, this.props));
        }
    }]);

    return PRow;
}(StatRow);

var StatTable = function (_React$Component2) {
    _inherits(StatTable, _React$Component2);

    function StatTable() {
        var _ref;

        var _temp, _this7, _ret;

        _classCallCheck(this, StatTable);

        for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
            args[_key] = arguments[_key];
        }

        return _ret = (_temp = (_this7 = _possibleConstructorReturn(this, (_ref = StatTable.__proto__ || Object.getPrototypeOf(StatTable)).call.apply(_ref, [this].concat(args))), _this7), _this7.enter = function () {
            var dt = _this7.props.dataType;
            E.sp.spawn(_this7.sp = (0, _etask2.default)( /*#__PURE__*/_regeneratorRuntime2.default.mark(function _callee() {
                return _regeneratorRuntime2.default.wrap(function _callee$(_context) {
                    while (1) {
                        switch (_context.prev = _context.next) {
                            case 0:
                                _context.next = 2;
                                return _etask2.default.sleep(2 * _date2.default.ms.SEC);

                            case 2:
                                _util2.default.ga_event('stats panel', 'hover', dt);

                            case 3:
                            case 'end':
                                return _context.stop();
                        }
                    }
                }, _callee, this);
            })));
        }, _this7.leave = function () {
            if (_this7.sp) _this7.sp.return();
        }, _temp), _possibleConstructorReturn(_this7, _ret);
    }

    _createClass(StatTable, [{
        key: 'render',
        value: function render() {
            var Table = this.props.table || _common2.default.StatTable;
            return _react2.default.createElement(
                'div',
                { onMouseEnter: this.enter, onMouseLeave: this.leave },
                _react2.default.createElement(Table, _extends({ go: true }, this.props))
            );
        }
    }]);

    return StatTable;
}(_react2.default.Component);

var SuccessRatio = function (_React$Component3) {
    _inherits(SuccessRatio, _React$Component3);

    function SuccessRatio(props) {
        _classCallCheck(this, SuccessRatio);

        var _this8 = _possibleConstructorReturn(this, (SuccessRatio.__proto__ || Object.getPrototypeOf(SuccessRatio)).call(this, props));

        _this8.sp = (0, _etask2.default)('SuccessRatio', /*#__PURE__*/_regeneratorRuntime2.default.mark(function _callee2() {
            return _regeneratorRuntime2.default.wrap(function _callee2$(_context2) {
                while (1) {
                    switch (_context2.prev = _context2.next) {
                        case 0:
                            _context2.next = 2;
                            return this.wait();

                        case 2:
                        case 'end':
                            return _context2.stop();
                    }
                }
            }, _callee2, this);
        }));
        _this8.state = { total: 0, success: 0 };
        _this8.get_req_status_stats = _etask2.default._fn( /*#__PURE__*/_regeneratorRuntime2.default.mark(function _callee3(_this) {
            var res;
            return _regeneratorRuntime2.default.wrap(function _callee3$(_context3) {
                while (1) {
                    switch (_context3.prev = _context3.next) {
                        case 0:
                            _context3.next = 2;
                            return (0, _etask2.default)(function () {
                                return _axios2.default.get('/api/req_status');
                            });

                        case 2:
                            res = _context3.sent;
                            return _context3.abrupt('return', res.data);

                        case 4:
                        case 'end':
                            return _context3.stop();
                    }
                }
            }, _callee3, this);
        }));
        return _this8;
    }

    _createClass(SuccessRatio, [{
        key: 'componentDidMount',
        value: function componentDidMount() {
            var _this = this;
            this.sp.spawn((0, _etask2.default)( /*#__PURE__*/_regeneratorRuntime2.default.mark(function _callee4() {
                return _regeneratorRuntime2.default.wrap(function _callee4$(_context4) {
                    while (1) {
                        switch (_context4.prev = _context4.next) {
                            case 0:
                                if (false) {
                                    _context4.next = 10;
                                    break;
                                }

                                _context4.t0 = _this;
                                _context4.next = 4;
                                return _this.get_req_status_stats();

                            case 4:
                                _context4.t1 = _context4.sent;

                                _context4.t0.setState.call(_context4.t0, _context4.t1);

                                _context4.next = 8;
                                return _etask2.default.sleep(3000);

                            case 8:
                                _context4.next = 0;
                                break;

                            case 10:
                            case 'end':
                                return _context4.stop();
                        }
                    }
                }, _callee4, this);
            })));
        }
    }, {
        key: 'componentWillUnmount',
        value: function componentWillUnmount() {
            this.sp.return();
        }
    }, {
        key: 'render',
        value: function render() {
            var _state = this.state,
                total = _state.total,
                success = _state.success;

            var ratio = total == 0 ? 0 : success / total * 100;
            var overallSuccessTooltip = _react2.default.createElement(
                _reactBootstrap.Tooltip,
                {
                    id: 'succes-tooltip' },
                'Ratio of successful requests out of total requests, where successful requests are calculated as 2xx, 3xx or 404 HTTP status codes'
            );
            return _react2.default.createElement(
                _reactBootstrap.OverlayTrigger,
                { overlay: overallSuccessTooltip,
                    placement: 'top' },
                _react2.default.createElement(
                    _reactBootstrap.Row,
                    { className: 'overall-success-ratio', onMouseEnter: function onMouseEnter() {
                            _util2.default.ga_event('stats panel', 'hover', 'success_ratio', ratio);
                        } },
                    _react2.default.createElement(
                        _reactBootstrap.Col,
                        { md: 6, className: 'success_title' },
                        'Overall success'
                    ),
                    _react2.default.createElement(
                        _reactBootstrap.Col,
                        { md: 6, className: 'success_value' },
                        ratio.toFixed(2),
                        '%'
                    )
                )
            );
        }
    }]);

    return SuccessRatio;
}(_react2.default.Component);

var Stats = function (_React$Component4) {
    _inherits(Stats, _React$Component4);

    function Stats(props) {
        _classCallCheck(this, Stats);

        var _this9 = _possibleConstructorReturn(this, (Stats.__proto__ || Object.getPrototypeOf(Stats)).call(this, props));

        _this9.get_stats = _etask2.default._fn( /*#__PURE__*/_regeneratorRuntime2.default.mark(function _callee5(_this) {
            return _regeneratorRuntime2.default.wrap(function _callee5$(_context5) {
                while (1) {
                    switch (_context5.prev = _context5.next) {
                        case 0:
                            this.catch(function (e) {
                                return console.log(e);
                            });

                        case 1:
                            if (false) {
                                _context5.next = 11;
                                break;
                            }

                            _context5.t0 = _this;
                            _context5.next = 5;
                            return _common2.default.StatsService.get_top({ sort: 'value',
                                limit: 5 });

                        case 5:
                            _context5.t1 = _context5.sent;

                            _context5.t0.setState.call(_context5.t0, _context5.t1);

                            _context5.next = 9;
                            return _etask2.default.sleep(_date2.default.ms.SEC);

                        case 9:
                            _context5.next = 1;
                            break;

                        case 11:
                        case 'end':
                            return _context5.stop();
                    }
                }
            }, _callee5, this);
        }));

        _this9.close = function () {
            return _this9.setState({ show_reset: false });
        };

        _this9.confirm = function () {
            return _this9.setState({ show_reset: true });
        };

        _this9.reset_stats = function () {
            if (_this9.state.resetting) return;
            _this9.setState({ resetting: true });
            var _this = _this9;
            E.sp.spawn((0, _etask2.default)( /*#__PURE__*/_regeneratorRuntime2.default.mark(function _callee6() {
                return _regeneratorRuntime2.default.wrap(function _callee6$(_context6) {
                    while (1) {
                        switch (_context6.prev = _context6.next) {
                            case 0:
                                _context6.next = 2;
                                return _common2.default.StatsService.reset();

                            case 2:
                                _this.setState({ resetting: undefined });
                                _this.close();

                            case 4:
                            case 'end':
                                return _context6.stop();
                        }
                    }
                }, _callee6, this);
            })));
            _util2.default.ga_event('stats panel', 'click', 'reset btn');
        };

        _this9.enable_https_statistics = function () {
            _this9.setState({ show_certificate: true });
            _util2.default.ga_event('stats panel', 'click', 'enable https stats');
        };

        _this9.close_certificate = function () {
            _this9.setState({ show_certificate: false });
        };

        _this9.state = {
            statuses: { stats: [] },
            domains: { stats: [] },
            protocols: { stats: [] }
        };
        return _this9;
    }

    _createClass(Stats, [{
        key: 'componentDidMount',
        value: function componentDidMount() {
            E.install();
            E.sp.spawn(this.get_stats());
        }
    }, {
        key: 'componentWillUnmount',
        value: function componentWillUnmount() {
            E.uninstall();
        }
    }, {
        key: 'render',
        value: function render() {
            return _react2.default.createElement(
                _reactBootstrap.Panel,
                { header: _react2.default.createElement(
                        _reactBootstrap.Row,
                        null,
                        _react2.default.createElement(
                            _reactBootstrap.Col,
                            { md: 6 },
                            'Recent statistics'
                        ),
                        _react2.default.createElement(
                            _reactBootstrap.Col,
                            { md: 6, className: 'text-right' },
                            _react2.default.createElement(
                                _reactBootstrap.Button,
                                { bsSize: 'xsmall', onClick: this.confirm },
                                'Reset'
                            )
                        )
                    ) },
                _react2.default.createElement(SuccessRatio, null),
                _react2.default.createElement(StatTable, { table: _status_codes.StatusCodeTable, row: SRow,
                    title: 'Top status codes', dataType: 'status_codes',
                    stats: this.state.statuses.stats,
                    show_more: this.state.statuses.has_more }),
                _react2.default.createElement(StatTable, { table: _domains.DomainTable, row: DRow,
                    dataType: 'domains', stats: this.state.domains.stats,
                    show_more: this.state.domains.has_more,
                    title: 'Top domains' }),
                _react2.default.createElement(StatTable, { table: _protocols.ProtocolTable, row: PRow,
                    dataType: 'protocols', stats: this.state.protocols.stats,
                    show_more: this.state.protocols.has_more,
                    title: 'All protocols',
                    show_enable_https_button: true,
                    enable_https_button_click: this.enable_https_statistics }),
                _react2.default.createElement(
                    _common3.Dialog,
                    { show: this.state.show_reset, onHide: this.close,
                        title: 'Reset stats', footer: _react2.default.createElement(
                            _reactBootstrap.ButtonToolbar,
                            null,
                            _react2.default.createElement(
                                _reactBootstrap.Button,
                                { bsStyle: 'primary', onClick: this.reset_stats,
                                    disabled: this.state.resetting },
                                this.state.resetting ? 'Resetting...' : 'OK'
                            ),
                            _react2.default.createElement(
                                _reactBootstrap.Button,
                                { onClick: this.close },
                                'Cancel'
                            )
                        ) },
                    _react2.default.createElement(
                        'h4',
                        null,
                        'Are you sure you want to reset stats?'
                    )
                ),
                _react2.default.createElement(
                    _common3.Dialog,
                    { show: this.state.show_certificate,
                        onHide: this.close_certificate,
                        title: 'Add certificate file to browsers',
                        footer: _react2.default.createElement(
                            _reactBootstrap.Button,
                            { onClick: this.close_certificate },
                            'Close'
                        ) },
                    'Gathering stats for HTTPS requests requires setting a certificate key.',
                    _react2.default.createElement(
                        'ol',
                        null,
                        _react2.default.createElement(
                            'li',
                            null,
                            'Download our free certificate key',
                            _react2.default.createElement(
                                'a',
                                { href: '/ssl', target: '_blank', download: true },
                                ' here'
                            )
                        ),
                        _react2.default.createElement(
                            'li',
                            null,
                            'Add the certificate to your browser'
                        ),
                        _react2.default.createElement(
                            'li',
                            null,
                            'Refresh the page'
                        )
                    )
                )
            );
        }
    }]);

    return Stats;
}(_react2.default.Component);

exports.default = Stats;

/***/ }),
/* 319 */,
/* 320 */,
/* 321 */,
/* 322 */,
/* 323 */,
/* 324 */,
/* 325 */,
/* 326 */,
/* 327 */,
/* 328 */,
/* 329 */,
/* 330 */,
/* 331 */,
/* 332 */,
/* 333 */,
/* 334 */,
/* 335 */,
/* 336 */,
/* 337 */,
/* 338 */,
/* 339 */,
/* 340 */,
/* 341 */,
/* 342 */,
/* 343 */,
/* 344 */,
/* 345 */,
/* 346 */,
/* 347 */,
/* 348 */,
/* 349 */,
/* 350 */,
/* 351 */,
/* 352 */,
/* 353 */,
/* 354 */,
/* 355 */,
/* 356 */,
/* 357 */,
/* 358 */,
/* 359 */,
/* 360 */,
/* 361 */,
/* 362 */,
/* 363 */,
/* 364 */,
/* 365 */,
/* 366 */,
/* 367 */,
/* 368 */,
/* 369 */,
/* 370 */,
/* 371 */,
/* 372 */,
/* 373 */,
/* 374 */,
/* 375 */,
/* 376 */,
/* 377 */,
/* 378 */,
/* 379 */,
/* 380 */,
/* 381 */,
/* 382 */,
/* 383 */,
/* 384 */,
/* 385 */,
/* 386 */,
/* 387 */,
/* 388 */,
/* 389 */,
/* 390 */,
/* 391 */,
/* 392 */,
/* 393 */,
/* 394 */,
/* 395 */,
/* 396 */,
/* 397 */,
/* 398 */,
/* 399 */,
/* 400 */,
/* 401 */,
/* 402 */,
/* 403 */,
/* 404 */,
/* 405 */,
/* 406 */,
/* 407 */,
/* 408 */,
/* 409 */,
/* 410 */,
/* 411 */,
/* 412 */,
/* 413 */,
/* 414 */,
/* 415 */,
/* 416 */,
/* 417 */,
/* 418 */,
/* 419 */,
/* 420 */,
/* 421 */,
/* 422 */,
/* 423 */,
/* 424 */,
/* 425 */,
/* 426 */,
/* 427 */,
/* 428 */,
/* 429 */,
/* 430 */,
/* 431 */,
/* 432 */,
/* 433 */,
/* 434 */,
/* 435 */,
/* 436 */,
/* 437 */,
/* 438 */,
/* 439 */,
/* 440 */,
/* 441 */,
/* 442 */,
/* 443 */,
/* 444 */,
/* 445 */,
/* 446 */,
/* 447 */,
/* 448 */,
/* 449 */,
/* 450 */,
/* 451 */,
/* 452 */,
/* 453 */,
/* 454 */,
/* 455 */,
/* 456 */,
/* 457 */,
/* 458 */,
/* 459 */,
/* 460 */,
/* 461 */,
/* 462 */,
/* 463 */,
/* 464 */,
/* 465 */,
/* 466 */,
/* 467 */,
/* 468 */,
/* 469 */,
/* 470 */
/***/ (function(module, exports, __webpack_require__) {

var __WEBPACK_AMD_DEFINE_ARRAY__, __WEBPACK_AMD_DEFINE_RESULT__;
var module;
/*jslint skip_file:true*/
(function(){

var is_node = typeof module=='object' && module.exports && module.children;
if (!is_node)
    ;
else
    ;
!(__WEBPACK_AMD_DEFINE_ARRAY__ = [], __WEBPACK_AMD_DEFINE_RESULT__ = function(){

/**
 * Minimal EventEmitter interface that is molded against the Node.js
 * EventEmitter interface.
 *
 * @constructor
 * @api public
 */
function EventEmitter() {
  this._events = {};
}

/**
 * Return a list of assigned event listeners.
 *
 * @param {String} event The events that should be listed.
 * @returns {Array}
 * @api public
 */
EventEmitter.prototype.listeners = function listeners(event) {
  return Array.apply(this, this._events[event] || []);
};

/**
 * Emit an event to all registered event listeners.
 *
 * @param {String} event The name of the event.
 * @returns {Boolean} Indication if we've emitted an event.
 * @api public
 */
EventEmitter.prototype.emit = function emit(event, a1, a2, a3, a4, a5) {
  if (!this._events || !this._events[event]) return false;

  var listeners = this._events[event]
    , length = listeners.length
    , len = arguments.length
    , fn = listeners[0]
    , args
    , i;

  if (1 === length) {
    switch (len) {
      case 1:
        fn.call(fn.__EE3_context || this);
      break;
      case 2:
        fn.call(fn.__EE3_context || this, a1);
      break;
      case 3:
        fn.call(fn.__EE3_context || this, a1, a2);
      break;
      case 4:
        fn.call(fn.__EE3_context || this, a1, a2, a3);
      break;
      case 5:
        fn.call(fn.__EE3_context || this, a1, a2, a3, a4);
      break;
      case 6:
        fn.call(fn.__EE3_context || this, a1, a2, a3, a4, a5);
      break;

      default:
        for (i = 1, args = new Array(len -1); i < len; i++) {
          args[i - 1] = arguments[i];
        }

        fn.apply(fn.__EE3_context || this, args);
    }

    if (fn.__EE3_once) this.removeListener(event, fn);
  } else {
    for (i = 1, args = new Array(len -1); i < len; i++) {
      args[i - 1] = arguments[i];
    }

    for (i = 0; i < length; fn = listeners[++i]) {
      fn.apply(fn.__EE3_context || this, args);
      if (fn.__EE3_once) this.removeListener(event, fn);
    }
  }

  return true;
};

function _addListener(event, fn, context, prepend) {
  if (!this._events) this._events = {};
  if (!this._events[event]) this._events[event] = [];

  fn.__EE3_context = context;
  if (prepend)
      this._events[event].unshift(fn);
  else
      this._events[event].push(fn);

  return this;
}

/**
 * Register a new EventListener for the given event.
 *
 * @param {String} event Name of the event.
 * @param {Functon} fn Callback function.
 * @param {Mixed} context The context of the function.
 * @api public
 */
EventEmitter.prototype.on = function on(event, fn, context) {
  return _addListener.apply(this, [event, fn, context]);
};

/**
 * Add an EventListener that's only called once.
 *
 * @param {String} event Name of the event.
 * @param {Function} fn Callback function.
 * @param {Mixed} context The context of the function.
 * @api public
 */
EventEmitter.prototype.once = function once(event, fn, context) {
  fn.__EE3_once = true;
  return this.on(event, fn, context);
};

EventEmitter.prototype.prependListener = function prependListener(event, fn,
    context)
{
  return _addListener.apply(this, [event, fn, context, true]);
};

EventEmitter.prototype.prependOnceListener = function prependOnceListener(
    event, fn, context)
{
    fn.__EE3_once = true;
    return this.prependListener(event, fn, context);
};

/**
 * Remove event listeners.
 *
 * @param {String} event The event we want to remove.
 * @param {Function} fn The listener that we need to find.
 * @api public
 */
EventEmitter.prototype.removeListener = function removeListener(event, fn) {
  if (!this._events || !this._events[event]) return this;

  var listeners = this._events[event]
    , events = [];

  for (var i = 0, length = listeners.length; i < length; i++) {
    if (fn && listeners[i] !== fn) {
      events.push(listeners[i]);
    }
  }

  //
  // Reset the array, or remove it completely if we have no more listeners.
  //
  if (events.length) this._events[event] = events;
  else this._events[event] = null;

  return this;
};

/**
 * Remove all listeners or only the listeners for the specified event.
 *
 * @param {String} event The event want to remove all listeners for.
 * @api public
 */
EventEmitter.prototype.removeAllListeners = function removeAllListeners(event) {
  if (!this._events) return this;

  if (event) this._events[event] = null;
  else this._events = {};

  return this;
};

//
// Alias methods names because people roll like that.
//
EventEmitter.prototype.off = EventEmitter.prototype.removeListener;
EventEmitter.prototype.addListener = EventEmitter.prototype.on;

//
// This function doesn't apply anymore.
//
EventEmitter.prototype.setMaxListeners = function setMaxListeners() {
  return this;
};

EventEmitter.prototype.eventNames = function eventNames(){
    var _this = this;
    return Object.keys(this._events).filter(function(e){
        return _this._events[e]!==null;
    });
}

//
// Expose the module.
//
EventEmitter.EventEmitter = EventEmitter;
EventEmitter.EventEmitter2 = EventEmitter;
EventEmitter.EventEmitter3 = EventEmitter;

return EventEmitter; }.apply(exports, __WEBPACK_AMD_DEFINE_ARRAY__),
				__WEBPACK_AMD_DEFINE_RESULT__ !== undefined && (module.exports = __WEBPACK_AMD_DEFINE_RESULT__)); })();


/***/ }),
/* 471 */,
/* 472 */,
/* 473 */,
/* 474 */,
/* 475 */,
/* 476 */,
/* 477 */,
/* 478 */,
/* 479 */,
/* 480 */,
/* 481 */,
/* 482 */,
/* 483 */,
/* 484 */,
/* 485 */,
/* 486 */,
/* 487 */,
/* 488 */,
/* 489 */,
/* 490 */,
/* 491 */,
/* 492 */,
/* 493 */,
/* 494 */,
/* 495 */,
/* 496 */,
/* 497 */,
/* 498 */,
/* 499 */,
/* 500 */,
/* 501 */,
/* 502 */,
/* 503 */,
/* 504 */,
/* 505 */,
/* 506 */,
/* 507 */,
/* 508 */,
/* 509 */,
/* 510 */,
/* 511 */,
/* 512 */,
/* 513 */,
/* 514 */,
/* 515 */,
/* 516 */,
/* 517 */,
/* 518 */,
/* 519 */,
/* 520 */,
/* 521 */,
/* 522 */,
/* 523 */,
/* 524 */,
/* 525 */,
/* 526 */,
/* 527 */,
/* 528 */
/***/ (function(module, exports, __webpack_require__) {

var __WEBPACK_AMD_DEFINE_ARRAY__, __WEBPACK_AMD_DEFINE_RESULT__;
var module;
// LICENSE_CODE ZON ISC
'use strict'; /*zlint node, br*/
(function(){
var  process;
var is_node = typeof module=='object' && module.exports && module.children;
var is_ff_addon = typeof module=='object' && module.uri
    && !module.uri.indexOf('resource://');
if (!is_node && !is_ff_addon)
{
    ;
    process = {env: {}};
}
else
{
    ;
    if (is_ff_addon)
        process = {env: {}};
    else if (is_node)
    {
        process = global.process||require('_process');
        require('./config.js');
        var cluster = require('cluster');
        var fs = require('fs');
        var version = require('./version.js').version;
    }
}
!(__WEBPACK_AMD_DEFINE_ARRAY__ = [__webpack_require__(143), __webpack_require__(85), __webpack_require__(233),
    __webpack_require__(529), __webpack_require__(530), __webpack_require__(268)], __WEBPACK_AMD_DEFINE_RESULT__ = function(array, date, zutil, sprintf, rate_limit, zescape){
var E, _zerr;
var env = process.env;
var zerr = function(msg){ _zerr(L.ERR, arguments); };
E = zerr;
// XXX amir: why do we need both E and E.zerr to point to the same function?
E.zerr = zerr;
var L = E.L = {
    EMERG: 0,
    ALERT: 1,
    CRIT: 2,
    ERR: 3,
    WARN: 4,
    NOTICE: 5,
    INFO: 6,
    DEBUG: 7,
};
var perr_pending = [];
// inverted
var LINV = E.LINV = {};
for (var k in L)
    LINV[L[k]] = k;

['debug', 'info', 'notice', 'warn', 'err', 'crit'].forEach(function(l){
    var level = L[l.toUpperCase()];
    E[l] = function(){ return _zerr(level, arguments); };
});

E.assert = function(exp, msg){
    if (!exp)
        zerr.crit(msg);
};

E.json = function(o, replacer, space){
    try { return JSON.stringify(o, replacer, space)||''; }
    catch(err){ return '[circular]'; }
};

E.is = function(level){ return level<=E.level; };
['debug', 'info', 'notice', 'warn', 'err'].forEach(function(l){
    var level = L[l.toUpperCase()];
    E.is[l] = function(){ return level<=E.level; };
});

E.log_tail = function(size){ return E.log.join('\n').substr(-(size||4096)); };

/* perr is a stub overridden by upper layers */
E.perr = function(id, info, opt){
    E._zerr(!opt || opt.level===undefined ? L.ERR : opt.level,
        ['perr '+id+' '+E.json(info)]);
    if (perr_pending && perr_pending.length<100)
        perr_pending.push(Array.from(arguments));
};
var perr_dropped = {};
var perr_orig = E.perr;
function wrap_perr(perr_fn){
    var send = perr_fn, pre_send;
    if (typeof perr_fn!='function')
    {
        send = perr_fn.send;
        pre_send = perr_fn.pre_send;
    }
    return function(id, info, opt){
        opt = opt||{};
        var ms = (opt.rate_limit && opt.rate_limit.ms)||date.ms.HOUR;
        var count = (opt.rate_limit && opt.rate_limit.count)||10;
        var rl_hash = perr_orig.rl_hash = perr_orig.rl_hash||{};
        var rl = rl_hash[id] = rl_hash[id]||{};
        if (pre_send)
            pre_send(id, info, opt);
        if (opt.rate_limit===false || rate_limit(rl, ms, count))
        {
            if (perr_dropped[id])
            {
                if (info && typeof info!='string')
                    info.w = perr_dropped[id];
                perr_dropped[id] = null;
            }
            return send(id, info, opt);
        }
        perr_dropped[id] = (perr_dropped[id]||0)+1;
        if (info && typeof info!='string')
            info = zerr.json(info);
        zerr('perr %s %s rate too high %s %d %d', id, info, zerr.json(rl), ms,
            count);
    };
}
E.perr_install = function(install_fn){
    E.perr = wrap_perr(install_fn(perr_orig, perr_pending||[]));
    perr_pending = null;
};

function err_has_stack(err){ return err instanceof Error && err.stack; }

E.e2s = function(err){
    if (!is_node && err_has_stack(err))
    {
        var e_str = ''+err, e_stack = ''+err.stack;
        return e_stack.startsWith(e_str) ? e_stack : e_str+' '+e_stack;
    }
    return err_has_stack(err) ? ''+err.stack : ''+err;
};

E.on_exception = undefined;
var in_exception;
E.set_exception_handler = function(prefix, err_func){
    E.on_exception = function(err){
        if (!(err instanceof TypeError || err instanceof ReferenceError) ||
            err.sent_perr)
        {
            return;
        }
        if (in_exception)
            return;
        in_exception = 1;
        err.sent_perr = true;
        // XXX amir: better not to get a prefix arg, it can be added by the
        // err_func
        err_func((prefix ? prefix+'_' : '')+'etask_typeerror', null, err);
        in_exception = 0;
    };
};

E.on_unhandled_exception = undefined;
E.catch_unhandled_exception = function(func, obj){
    return function(){
        var args = arguments;
        try { return func.apply(obj, Array.from(args)); }
        catch(e){ E.on_unhandled_exception(e); }
    };
};

if (is_node)
{ // zerr-node
E.ZEXIT_LOG_DIR = '/tmp/zexit_logs';
E.prefix = '';

E.level = L.NOTICE;
E.set_level = function(level){
    var prev = 'L'+LINV[E.level];
    level = level||env.ZERR;
    if (!level)
        return prev;
    var val = L[level] || L[level.replace(/^L/, '')];
    if (val!==undefined)
        E.level = val;
    return prev;
};

E.flush = function(){};
E.set_log_buffer = function(on){
    if (!on)
    {
        if (E.log_buffer)
        {
            E.flush();
            E.log_buffer(0);
        }
        return;
    }
    E.log_buffer = require('log-buffer');
    E.log_buffer(32*1024);
    E.flush = function(){ E.log_buffer.flush(); };
    setInterval(E.flush, 1000).unref();
};
var node_init = function(){
    if (zutil.is_mocha())
        E.level = L.WARN;
    else
        E.prefix = !cluster.isMaster ? 'C'+cluster.worker.id+' ' : '';
};

var init = function(){
    if (is_node)
        node_init();
    E.set_level();
};
init();

var zerr_format = function(args){
    return args.length<=1 ? args[0] : sprintf.apply(null, args); };
var __zerr = function(level, args){
    var msg = zerr_format(args);
    var k = Object.keys(L);
    var prefix = E.hide_timestamp ? '' : E.prefix+date.to_sql_ms()+' ';
    console.error(prefix+k[level]+': '+msg);
};

E.set_logger = function(logger){
    __zerr = function(level, args){
        var msg = zerr_format(args);
        logger(level, msg);
    };
};

_zerr = function(level, args){
    if (level>E.level)
        return;
    __zerr(level, args);
};
E._zerr = _zerr;

E.zexit = function(args){
    var stack;
    if (err_has_stack(args))
    {
        stack = args.stack;
        __zerr(L.CRIT, [E.e2s(args)]);
    }
    else
    {
        var e = new Error();
        stack = e.stack;
        __zerr(L.CRIT, arguments);
        console.error(stack);
    }
    E.flush();
    if (zutil.is_mocha())
    {
        /*jslint -W087*/
        debugger;
        process.exit(1);
    }
    var zcounter_file = require('./zcounter_file.js');
    zcounter_file.inc('server_zexit');
    args = zerr_format(arguments);
    write_zexit_log({id: 'server_zexit', info: ''+args, ts: date.to_sql(),
        backtrace: stack, version: version});
    E.flush();
    debugger;
    process.exit(1);
};

var write_zexit_log = function(json){
    try {
        var file = require('./file.js');
        file.write_e(E.ZEXIT_LOG_DIR+'/'+date.to_log_file()+'_zexit_'+
            process.pid+'.log', E.json(json), {mkdirp: 1});
    } catch(e){ E.zerr(E.e2s(e)); }
};
}
else
{ // browser-zerr
var chrome = self.chrome;
E.conf = self.conf;
E.log = [];
var L_STR = E.L_STR = ['EMERGENCY', 'ALERT', 'CRITICAL', 'ERROR', 'WARNING',
    'NOTICE', 'INFO', 'DEBUG'];
E.level = self.is_tpopup ? L.CRITICAL : E.conf && E.conf.zerr_level ?
    L[self.conf.zerr_level] : L.WARN;
E.log.max_size = 200;

var console_method = function(l){
    return l<=L.ERR ? 'error' : !chrome ? 'log' : l===L.WARN ? 'warn' :
        l<=L.INFO ? 'info' : 'debug';
};

_zerr = function(l, args){
    var s;
    try {
        var fmt = ''+args[0];
        var fmt_args = Array.prototype.slice.call(args, 1);
        /* XXX arik/bahaa HACK: use sprintf (note, console % options are
         * differnt than sprintf % options) */
        s = (fmt+(fmt_args.length ? ' '+E.json(fmt_args) : ''))
        .substr(0, 1024);
        var prefix = date.to_sql_ms()+' '+L_STR[l]+': ';
        E.log.push(prefix+s);
        if (E.is(l))
        {
            Function.prototype.apply.bind(console[console_method(l)],
                console)([prefix+fmt].concat(fmt_args));
        }
        if (E.log.length>E.log.max_size)
            E.log.splice(0, E.log.length - E.log.max_size/2);
    } catch(err){
        try { console.error('ERROR in zerr '+(err.stack||err), arguments); }
        catch(e){}
    }
    if (l<=L.CRIT)
        throw new Error(s);
};
E._zerr = _zerr;

var post = function(url, data){
    var use_xdr = typeof XDomainRequest=='function' &&
        !('withCredentials' in XMLHttpRequest.prototype);
    var req = use_xdr ? new XDomainRequest() : new XMLHttpRequest();
    req.open('POST', url);
    if (req.setRequestHeader)
    {
        req.setRequestHeader('Content-Type',
            'application/x-www-form-urlencoded; charset=UTF-8');
    }
    req.send(zescape.qs(data));
};
var perr_transport = function(id, info, opt){
    opt = zutil.clone(opt||{});
    var qs = opt.qs||{}, data = opt.data||{};
    data.is_json = 1;
    if (info && typeof info!='string')
        info = zerr.json(info);
    if (opt.err && !info)
        info = ''+(opt.err.message||zerr.json(opt.err));
    data.info = info;
    qs.id = id;
    if (!opt.no_zerr)
    {
        zerr._zerr(opt.level, ['perr '+id+(info ? ' info: '+info : '')+
            (opt.bt ? '\n'+opt.bt : '')]);
    }
    return post(zescape.uri(E.conf.url_perr+'/perr', qs), data);
};

var perr = function(perr_orig, pending){
    while (pending.length)
        perr_transport.apply(null, pending.shift());
    // set the zerr.perr stub to send to the clog server
    return perr_transport;
};
E.perr_install(perr);

} // end of browser-zerr}

return E; }.apply(exports, __WEBPACK_AMD_DEFINE_ARRAY__),
				__WEBPACK_AMD_DEFINE_RESULT__ !== undefined && (module.exports = __WEBPACK_AMD_DEFINE_RESULT__)); }());


/***/ }),
/* 529 */
/***/ (function(module, exports, __webpack_require__) {

var __WEBPACK_AMD_DEFINE_ARRAY__, __WEBPACK_AMD_DEFINE_RESULT__;
var module;
// LICENSE_CODE ZON ISC
'use strict'; /*zlint node, br*/
(function(){

var is_node_ff = typeof module=='object' && module.exports;
if (!is_node_ff)
    ;
else
    ;
!(__WEBPACK_AMD_DEFINE_ARRAY__ = [], __WEBPACK_AMD_DEFINE_RESULT__ = function(){
var E = sprintf;
E.sprintf = sprintf;
var has = Object.prototype.hasOwnProperty;
function sprintf(fmt /* args... */){
    if (has.call(E.cache, fmt))
        return E.cache[fmt](arguments);
    E.cache[fmt] = E.parse(fmt);
    E.cache_n++;
    if (E.cache_cb)
        E.cache_cb(fmt);
    return E.cache[fmt](arguments);
}
E.cache = {};
E.cache_n = 0;
E.to_int = function(num){
    return (num = +num)>=0 ? Math.floor(num) : -Math.floor(-num); };
E.thousand_grouping = function(num_s){
    var m = /^([-+])?(\d*)(\.\d*)?$/.exec(num_s);
    if (!m)
        return num_s;
    m[2] = (m[2]||'').replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1'+',');
    return (m[1]||'')+m[2]+(m[3]||'');
};

E.parse_fast = function(fmt){
    var _fmt = fmt, match = [], arg_names = 0, cursor = 1;
    var pad_chr, pad_chrs, arg_padded, f, s = JSON.stringify;
    f = 'var out = "", arg, arg_s, sign;\n';
    for (; _fmt; _fmt = _fmt.substring(match[0].length))
    {
	if (match = /^[^%]+/.exec(_fmt))
	    f += 'out += '+s(match[0])+';\n';
	else if (match = /^%%/.exec(_fmt))
	    f += 'out += "%";\n';
	else if ((match =
	    /^%(?:([1-9]\d*)\$|\(([^\)]+)\))?(\+)?(0|'[^$])?(-)?(\d+)?(?:\.(\d+))?(')?([bcdefoOsuxX])/
	    .exec(_fmt)))
	{
	    var positional = match[1], keyword = match[2], sign = match[3];
	    var pad_zero = match[4], pad_min = match[5], pad_max = match[6];
            var precision = match[7], thousand_grouping = match[8]=="'";
            var conversion = match[9], keyword_list = [];
	    if (keyword)
	    {
		arg_names |= 1;
		var _keyword = keyword, kmatch;
		if (!(kmatch = /^([a-z_][a-z_\d]*)/i.exec(_keyword)))
		    throw 'sprintf: invalid keyword property name '+_keyword;
		keyword_list.push(kmatch[1]);
		while (_keyword = _keyword.substring(kmatch[0].length))
		{
		    if (kmatch = /^\.([a-z_][a-z_\d]*)/i.exec(_keyword))
			keyword_list.push(kmatch[1]);
		    else if (kmatch = /^\[(\d+)\]/.exec(_keyword))
			keyword_list.push(kmatch[1]);
		    else
			throw 'sprintf: invalid keyword format '+_keyword;
		}
	    }
	    else
		arg_names |= 2;
	    if (arg_names===3)
	    {
		throw 'sprintf: mixing positional and named placeholders is '
		    +'not (yet) supported';
	    }
            f += 'sign = false;\n';
	    if (keyword_list.length) // keyword argument
	    {
		f += 'arg = argv['+cursor+']';
		for (var k = 0; k < keyword_list.length; k++)
		    f += '['+s(keyword_list[k])+']';
		f += ';\n';
	    }
	    else if (positional) // positional argument (explicit)
		f += 'arg = argv['+positional+'];\n';
	    else // positional argument (implicit)
		f += 'arg = argv['+(cursor++)+'];\n';
	    if (/[^sO]/.test(conversion))
		f += 'arg = +arg;\n';
	    switch (conversion)
	    {
	    case 'b': f += 'arg_s = arg.toString(2);\n'; break;
	    case 'c': f += 'arg_s = String.fromCharCode(arg);\n'; break;
            case 'd':
                f += 'arg = sprintf.to_int(arg); arg_s = ""+arg;\n';
                if (thousand_grouping)
                    f += 'arg_s = sprintf.thousand_grouping(arg_s);\n';
                break;
	    case 'e':
	        f += 'arg_s = arg.toExponential('
		+(precision ? s(precision) : '')+');\n';
	        break;
	    case 'f':
		if (precision)
		    f += 'arg_s = arg.toFixed('+precision+');\n';
		else
                    f += 'arg_s = ""+arg;\n';
                if (thousand_grouping)
                    f += 'arg_s = sprintf.thousand_grouping(arg_s);\n';
		break;
	    case 'o': f += 'arg_s = arg.toString(8);\n'; break;
	    case 'O': f += 'arg_s = JSON.stringify(arg);\n'; break;
            case 'u': f += 'arg = arg >>> 0; arg_s = ""+arg;\n'; break;
	    case 'x': f += 'arg_s = arg.toString(16);\n'; break;
	    case 'X': f += 'arg_s = arg.toString(16).toUpperCase();\n'; break;
	    case 's':
	        f += 'arg_s = ""+arg;\n';
		if (precision)
                    f += 'arg_s = arg_s.substring(0, '+precision+');\n';
	        break;
	    }
	    if (/[def]/.test(conversion))
            {
                if (sign)
                    f += 'if (arg>=0) arg_s = "+"+arg_s;\n';
                f += 'sign = arg_s[0]=="-" || arg_s[0]=="+";\n';
            }
	    pad_chr = !pad_zero ? ' ' : pad_zero=='0' ? '0' : pad_zero[1];
	    pad_chrs = s(pad_chr)
                +'.repeat(Math.max('+(+pad_max)+'-arg_s.length, 0))';
	    arg_padded = !pad_max ? 'arg_s' :
	        pad_min ? 'arg_s+'+pad_chrs :
                /[def]/.test(conversion) && pad_chr=='0' ?
                '(sign ? arg_s[0]+'+pad_chrs+'+arg_s.slice(1) : '
                +pad_chrs+'+arg_s)' :
                pad_chrs+'+arg_s';
	    f += 'out += '+arg_padded+';\n';
	}
	else
	    throw 'sprintf invalid format '+_fmt;
    }
    f += 'return out;\n';
    return new Function(['sprintf', 'argv'], f).bind(null, sprintf);
};

// slow version for Firefox extention where new Function() is not allowed
E.parse_slow = function(fmt){
    var _fmt = fmt, match = [], arg_names = 0, cursor = 1;
    var _f = [], out, arg, arg_s, argv, sign;
    function f(fn){ _f.push(fn); }
    for (; _fmt; _fmt = _fmt.substring(match[0].length))
    (function(){
	if (match = /^[^%]+/.exec(_fmt))
        {
            var _match = match;
	    f(function(){ return out += _match[0]; });
        }
	else if (match = /^%%/.exec(_fmt))
	    f(function(){ return out += '%'; });
	else if ((match =
	    /^%(?:([1-9]\d*)\$|\(([^\)]+)\))?(\+)?(0|'[^$])?(-)?(\d+)?(?:\.(\d+))?(')?([bcdefoOsuxX])/
	    .exec(_fmt)))
	{
	    var positional = match[1], keyword = match[2], sign = match[3];
	    var pad_zero = match[4], pad_min = match[5], pad_max = match[6];
            var precision = match[7], thousand_grouping = match[8]=="'";
            var conversion = match[9], keyword_list = [], _cursor = cursor;
	    if (keyword)
	    {
		arg_names |= 1;
		var _keyword = keyword, kmatch;
		if (!(kmatch = /^([a-z_][a-z_\d]*)/i.exec(_keyword)))
		    throw 'sprintf: invalid keyword property name '+_keyword;
		keyword_list.push(kmatch[1]);
		while (_keyword = _keyword.substring(kmatch[0].length))
		{
		    if (kmatch = /^\.([a-z_][a-z_\d]*)/i.exec(_keyword))
			keyword_list.push(kmatch[1]);
		    else if (kmatch = /^\[(\d+)\]/.exec(_keyword))
			keyword_list.push(kmatch[1]);
		    else
			throw 'sprintf: invalid keyword format '+_keyword;
		}
	    }
	    else
		arg_names |= 2;
	    if (arg_names===3)
	    {
		throw 'sprintf: mixing positional and named placeholders is '
		    +'not (yet) supported';
	    }
            f(function(){ sign = false; });
	    if (keyword_list.length) // keyword argument
	    {
		f(function(){
                    arg = argv[_cursor];
                    for (var k = 0; k < keyword_list.length && arg!=null; k++)
                        arg = arg[keyword_list[k]];
                });
	    }
	    else if (positional) // positional argument (explicit)
		f(function(){ arg = argv[positional]; });
	    else // positional argument (implicit)
            {
		f(function(){ arg = argv[_cursor]; });
                cursor++;
            }
	    if (/[^sO]/.test(conversion))
		f(function(){ return arg = +arg; });
	    switch (conversion)
	    {
	    case 'b': f(function(){ arg_s = arg.toString(2); }); break;
	    case 'c':
                  f(function(){ arg_s = String.fromCharCode(arg); });
                  break;
            case 'd':
                f(function(){ arg = sprintf.to_int(arg); arg_s = ''+arg; });
                if (thousand_grouping)
                    f(function(){ arg_s = sprintf.thousand_grouping(arg_s); });
                break;
	    case 'e':
	        f(function(){ arg_s = arg.toExponential(
                    precision ? precision : undefined); });
	        break;
	    case 'f':
		if (precision)
		    f(function(){ arg_s = arg.toFixed(precision); });
		else
                    f(function(){ arg_s = ''+arg; });
                if (thousand_grouping)
                    f(function(){ arg_s = sprintf.thousand_grouping(arg_s); });
		break;
	    case 'o': f(function(){ arg_s = arg.toString(8); }); break;
	    case 'O': f(function(){ arg_s = JSON.stringify(arg); }); break;
            case 'u': f(function(){ arg = arg >>> 0; arg_s = ''+arg; }); break;
	    case 'x': f(function(){ arg_s = arg.toString(16); }); break;
	    case 'X':
                f(function(){ arg_s = arg.toString(16).toUpperCase(); });
                break;
	    case 's':
	        f(function(){ arg_s = ''+arg; });
		if (precision)
                    f(function(){ arg_s = arg_s.substring(0, precision); });
	        break;
	    }
	    if (/[def]/.test(conversion))
            {
                if (sign)
                    f(function(){ if (arg>=0) arg_s = '+'+arg_s; });
                f(function(){ sign = arg_s[0]=='-' || arg_s[0]=='+'; });
            }
	    var pad_chr = !pad_zero ? ' ' : pad_zero=='0' ? '0' : pad_zero[1];
	    f(function(){
                var pad_chrs = pad_chr.repeat(
                    Math.max(+pad_max-arg_s.length, 0));
                var arg_padded = !pad_max ? arg_s :
                    pad_min ? arg_s+pad_chrs :
                    sign && pad_chr[0]=='0' ?
                    arg_s[0]+pad_chrs+arg_s.slice(1) :
                    pad_chrs+arg_s;
                out += arg_padded;
            });
	}
	else
	    throw 'sprintf invalid format '+_fmt;
    })();
    return function(_argv){
        argv = _argv;
        out = '';
        for (var i=0; i<_f.length; i++)
            _f[i](argv);
        return out;
    };
};
E.parse = (function(){
    try {
        if ((new Function('return 1')())==1)
            return E.parse_fast;
    } catch(e){}
    return E.parse_slow; // capp does not support new Function()
})();

E.vsprintf = function(fmt, argv, opt){
    if (opt)
    {
        if (opt.fast)
            return E.parse_fast(fmt)([fmt].concat(argv));
        if (opt.slow)
            return E.parse_slow(fmt)([fmt].concat(argv));
    }
    return E.sprintf.apply(null, [fmt].concat(argv)); };

return E; }.apply(exports, __WEBPACK_AMD_DEFINE_ARRAY__),
				__WEBPACK_AMD_DEFINE_RESULT__ !== undefined && (module.exports = __WEBPACK_AMD_DEFINE_RESULT__)); }());


/***/ }),
/* 530 */
/***/ (function(module, exports, __webpack_require__) {

var __WEBPACK_AMD_DEFINE_ARRAY__, __WEBPACK_AMD_DEFINE_RESULT__;
var module;
// LICENSE_CODE ZON ISC
'use strict'; /*zlint node, br*/
(function(){

var is_node = typeof module=='object' && module.exports && module.children;
if (!is_node)
    ;
else
    ;
!(__WEBPACK_AMD_DEFINE_ARRAY__ = [], __WEBPACK_AMD_DEFINE_RESULT__ = function(){
var E = rate_limit;

function rate_limit(rl, ms, n){
    var now = Date.now();
    if (!rl.count || rl.ts+ms<now)
    {
        rl.count = 1;
        rl.ts = now;
        return true;
    }
    rl.count++;
    return rl.count<=n;
}

E.leaky_bucket = function leaky_bucket(size, rate){
    this.size = size;
    this.rate = rate;
    this.time = Date.now();
    this.level = 0;
};

E.leaky_bucket.prototype.inc = function(inc){
    if (inc===undefined)
	inc = 1;
    var now = Date.now();
    this.level -= this.rate * (now - this.time);
    this.time = now;
    if (this.level<0)
	this.level = 0;
    var new_level = this.level + inc;
    if (new_level>this.size)
	return false;
    this.level = new_level;
    return true;
};

return E; }.apply(exports, __WEBPACK_AMD_DEFINE_ARRAY__),
				__WEBPACK_AMD_DEFINE_RESULT__ !== undefined && (module.exports = __WEBPACK_AMD_DEFINE_RESULT__)); }());


/***/ }),
/* 531 */
/***/ (function(module, exports) {

// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

function EventEmitter() {
  this._events = this._events || {};
  this._maxListeners = this._maxListeners || undefined;
}
module.exports = EventEmitter;

// Backwards-compat with node 0.10.x
EventEmitter.EventEmitter = EventEmitter;

EventEmitter.prototype._events = undefined;
EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
EventEmitter.defaultMaxListeners = 10;

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function(n) {
  if (!isNumber(n) || n < 0 || isNaN(n))
    throw TypeError('n must be a positive number');
  this._maxListeners = n;
  return this;
};

EventEmitter.prototype.emit = function(type) {
  var er, handler, len, args, i, listeners;

  if (!this._events)
    this._events = {};

  // If there is no 'error' event listener then throw.
  if (type === 'error') {
    if (!this._events.error ||
        (isObject(this._events.error) && !this._events.error.length)) {
      er = arguments[1];
      if (er instanceof Error) {
        throw er; // Unhandled 'error' event
      } else {
        // At least give some kind of context to the user
        var err = new Error('Uncaught, unspecified "error" event. (' + er + ')');
        err.context = er;
        throw err;
      }
    }
  }

  handler = this._events[type];

  if (isUndefined(handler))
    return false;

  if (isFunction(handler)) {
    switch (arguments.length) {
      // fast cases
      case 1:
        handler.call(this);
        break;
      case 2:
        handler.call(this, arguments[1]);
        break;
      case 3:
        handler.call(this, arguments[1], arguments[2]);
        break;
      // slower
      default:
        args = Array.prototype.slice.call(arguments, 1);
        handler.apply(this, args);
    }
  } else if (isObject(handler)) {
    args = Array.prototype.slice.call(arguments, 1);
    listeners = handler.slice();
    len = listeners.length;
    for (i = 0; i < len; i++)
      listeners[i].apply(this, args);
  }

  return true;
};

EventEmitter.prototype.addListener = function(type, listener) {
  var m;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events)
    this._events = {};

  // To avoid recursion in the case that type === "newListener"! Before
  // adding it to the listeners, first emit "newListener".
  if (this._events.newListener)
    this.emit('newListener', type,
              isFunction(listener.listener) ?
              listener.listener : listener);

  if (!this._events[type])
    // Optimize the case of one listener. Don't need the extra array object.
    this._events[type] = listener;
  else if (isObject(this._events[type]))
    // If we've already got an array, just append.
    this._events[type].push(listener);
  else
    // Adding the second element, need to change to array.
    this._events[type] = [this._events[type], listener];

  // Check for listener leak
  if (isObject(this._events[type]) && !this._events[type].warned) {
    if (!isUndefined(this._maxListeners)) {
      m = this._maxListeners;
    } else {
      m = EventEmitter.defaultMaxListeners;
    }

    if (m && m > 0 && this._events[type].length > m) {
      this._events[type].warned = true;
      console.error('(node) warning: possible EventEmitter memory ' +
                    'leak detected. %d listeners added. ' +
                    'Use emitter.setMaxListeners() to increase limit.',
                    this._events[type].length);
      if (typeof console.trace === 'function') {
        // not supported in IE 10
        console.trace();
      }
    }
  }

  return this;
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.once = function(type, listener) {
  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  var fired = false;

  function g() {
    this.removeListener(type, g);

    if (!fired) {
      fired = true;
      listener.apply(this, arguments);
    }
  }

  g.listener = listener;
  this.on(type, g);

  return this;
};

// emits a 'removeListener' event iff the listener was removed
EventEmitter.prototype.removeListener = function(type, listener) {
  var list, position, length, i;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events || !this._events[type])
    return this;

  list = this._events[type];
  length = list.length;
  position = -1;

  if (list === listener ||
      (isFunction(list.listener) && list.listener === listener)) {
    delete this._events[type];
    if (this._events.removeListener)
      this.emit('removeListener', type, listener);

  } else if (isObject(list)) {
    for (i = length; i-- > 0;) {
      if (list[i] === listener ||
          (list[i].listener && list[i].listener === listener)) {
        position = i;
        break;
      }
    }

    if (position < 0)
      return this;

    if (list.length === 1) {
      list.length = 0;
      delete this._events[type];
    } else {
      list.splice(position, 1);
    }

    if (this._events.removeListener)
      this.emit('removeListener', type, listener);
  }

  return this;
};

EventEmitter.prototype.removeAllListeners = function(type) {
  var key, listeners;

  if (!this._events)
    return this;

  // not listening for removeListener, no need to emit
  if (!this._events.removeListener) {
    if (arguments.length === 0)
      this._events = {};
    else if (this._events[type])
      delete this._events[type];
    return this;
  }

  // emit removeListener for all listeners on all events
  if (arguments.length === 0) {
    for (key in this._events) {
      if (key === 'removeListener') continue;
      this.removeAllListeners(key);
    }
    this.removeAllListeners('removeListener');
    this._events = {};
    return this;
  }

  listeners = this._events[type];

  if (isFunction(listeners)) {
    this.removeListener(type, listeners);
  } else if (listeners) {
    // LIFO order
    while (listeners.length)
      this.removeListener(type, listeners[listeners.length - 1]);
  }
  delete this._events[type];

  return this;
};

EventEmitter.prototype.listeners = function(type) {
  var ret;
  if (!this._events || !this._events[type])
    ret = [];
  else if (isFunction(this._events[type]))
    ret = [this._events[type]];
  else
    ret = this._events[type].slice();
  return ret;
};

EventEmitter.prototype.listenerCount = function(type) {
  if (this._events) {
    var evlistener = this._events[type];

    if (isFunction(evlistener))
      return 1;
    else if (evlistener)
      return evlistener.length;
  }
  return 0;
};

EventEmitter.listenerCount = function(emitter, type) {
  return emitter.listenerCount(type);
};

function isFunction(arg) {
  return typeof arg === 'function';
}

function isNumber(arg) {
  return typeof arg === 'number';
}

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}

function isUndefined(arg) {
  return arg === void 0;
}


/***/ }),
/* 532 */,
/* 533 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
// LICENSE_CODE ZON ISC
 /*jslint react:true*/

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _regeneratorRuntime = __webpack_require__(20);

var _regeneratorRuntime2 = _interopRequireDefault(_regeneratorRuntime);

var _lodash = __webpack_require__(32);

var _lodash2 = _interopRequireDefault(_lodash);

var _react = __webpack_require__(0);

var _react2 = _interopRequireDefault(_react);

var _reactBootstrap = __webpack_require__(25);

var _etask = __webpack_require__(19);

var _etask2 = _interopRequireDefault(_etask);

var _common = __webpack_require__(47);

var _common2 = _interopRequireDefault(_common);

var _status_codes = __webpack_require__(78);

var _domains = __webpack_require__(99);

var _protocols = __webpack_require__(100);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var E = {
    install: function install() {
        E.sp = (0, _etask2.default)('status_codes_detail', [function () {
            return this.wait();
        }]);
    },
    uninstall: function uninstall() {
        if (E.sp) E.sp.return();
    }
};

var StatsDetails = function (_React$Component) {
    _inherits(StatsDetails, _React$Component);

    function StatsDetails(props) {
        _classCallCheck(this, StatsDetails);

        var _this2 = _possibleConstructorReturn(this, (StatsDetails.__proto__ || Object.getPrototypeOf(StatsDetails)).call(this, props));

        _this2.state = {
            domains: { stats: [] },
            protocols: { stats: [] }
        };
        return _this2;
    }

    _createClass(StatsDetails, [{
        key: 'componentDidMount',
        value: function componentDidMount() {
            E.install();
            var _this = this;
            E.sp.spawn((0, _etask2.default)( /*#__PURE__*/_regeneratorRuntime2.default.mark(function _callee() {
                var res;
                return _regeneratorRuntime2.default.wrap(function _callee$(_context) {
                    while (1) {
                        switch (_context.prev = _context.next) {
                            case 0:
                                _context.t0 = _this;
                                _context.next = 3;
                                return _common2.default.StatsService.get(_this.props.code);

                            case 3:
                                _context.t1 = _context.sent;
                                _context.t2 = {
                                    stats: _context.t1
                                };

                                _context.t0.setState.call(_context.t0, _context.t2);

                                _context.next = 8;
                                return _common2.default.StatsService.get_top({ sort: 1, limit: 5 });

                            case 8:
                                res = _context.sent;

                                _this.setState(_lodash2.default.pick(res, ['domains', 'protocols']));

                            case 10:
                            case 'end':
                                return _context.stop();
                        }
                    }
                }, _callee, this);
            })));
        }
    }, {
        key: 'componentWillUnmount',
        value: function componentWillUnmount() {
            E.uninstall();
        }
    }, {
        key: 'render',
        value: function render() {
            var definition = _status_codes.status_codes[this.props.code] ? '(' + _status_codes.status_codes[this.props.code] + ')' : '';
            var header_text = 'Status code: ' + this.props.code + ' ' + definition;
            return _react2.default.createElement(
                _common2.default.StatsDetails,
                { stats: this.state.stats,
                    header: header_text },
                _react2.default.createElement(
                    _reactBootstrap.Col,
                    { md: 6 },
                    _react2.default.createElement(
                        'h3',
                        null,
                        'Domains'
                    ),
                    _react2.default.createElement(_domains.DomainTable, { stats: this.state.domains.stats, go: true })
                ),
                _react2.default.createElement(
                    _reactBootstrap.Col,
                    { md: 6 },
                    _react2.default.createElement(
                        'h3',
                        null,
                        'Protocols'
                    ),
                    _react2.default.createElement(_protocols.ProtocolTable, { stats: this.state.protocols.stats, go: true })
                )
            );
        }
    }]);

    return StatsDetails;
}(_react2.default.Component);

exports.default = StatsDetails;

/***/ }),
/* 534 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
// LICENSE_CODE ZON ISC
 /*jslint react:true*/

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _regeneratorRuntime = __webpack_require__(20);

var _regeneratorRuntime2 = _interopRequireDefault(_regeneratorRuntime);

var _lodash = __webpack_require__(32);

var _lodash2 = _interopRequireDefault(_lodash);

var _react = __webpack_require__(0);

var _react2 = _interopRequireDefault(_react);

var _reactBootstrap = __webpack_require__(25);

var _etask = __webpack_require__(19);

var _etask2 = _interopRequireDefault(_etask);

var _common = __webpack_require__(47);

var _common2 = _interopRequireDefault(_common);

var _status_codes = __webpack_require__(78);

var _protocols = __webpack_require__(100);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var E = {
    install: function install() {
        return E.sp = (0, _etask2.default)('domains_detail', [function () {
            return this.wait();
        }]);
    },
    uninstall: function uninstall() {
        if (E.sp) E.sp.return();
    }
};

var StatsDetails = function (_React$Component) {
    _inherits(StatsDetails, _React$Component);

    function StatsDetails(props) {
        _classCallCheck(this, StatsDetails);

        var _this2 = _possibleConstructorReturn(this, (StatsDetails.__proto__ || Object.getPrototypeOf(StatsDetails)).call(this, props));

        _this2.state = {
            statuses: { stats: [] },
            protocols: { stats: [] }
        };
        return _this2;
    }

    _createClass(StatsDetails, [{
        key: 'componentDidMount',
        value: function componentDidMount() {
            E.install();
            var _this = this;
            E.sp.spawn((0, _etask2.default)( /*#__PURE__*/_regeneratorRuntime2.default.mark(function _callee() {
                var res;
                return _regeneratorRuntime2.default.wrap(function _callee$(_context) {
                    while (1) {
                        switch (_context.prev = _context.next) {
                            case 0:
                                _context.t0 = _this;
                                _context.next = 3;
                                return _common2.default.StatsService.get(_this.props.domain);

                            case 3:
                                _context.t1 = _context.sent;
                                _context.t2 = {
                                    stats: _context.t1
                                };

                                _context.t0.setState.call(_context.t0, _context.t2);

                                _context.next = 8;
                                return _common2.default.StatsService.get_top({ sort: 1, limit: 5 });

                            case 8:
                                res = _context.sent;

                                _this.setState(_lodash2.default.pick(res, ['statuses', 'protocols']));

                            case 10:
                            case 'end':
                                return _context.stop();
                        }
                    }
                }, _callee, this);
            })));
        }
    }, {
        key: 'componentWillUnmount',
        value: function componentWillUnmount() {
            E.uninstall();
        }
    }, {
        key: 'render',
        value: function render() {
            return _react2.default.createElement(
                _common2.default.StatsDetails,
                { stats: this.state.stats,
                    header: 'Domain name: ' + this.props.domain },
                _react2.default.createElement(
                    _reactBootstrap.Col,
                    { md: 6 },
                    _react2.default.createElement(
                        'h3',
                        null,
                        'Status codes'
                    ),
                    _react2.default.createElement(_status_codes.StatusCodeTable, { stats: this.state.statuses.stats, go: true })
                ),
                _react2.default.createElement(
                    _reactBootstrap.Col,
                    { md: 6 },
                    _react2.default.createElement(
                        'h3',
                        null,
                        'Protocols'
                    ),
                    _react2.default.createElement(_protocols.ProtocolTable, { stats: this.state.protocols.stats, go: true })
                )
            );
        }
    }]);

    return StatsDetails;
}(_react2.default.Component);

exports.default = StatsDetails;

/***/ }),
/* 535 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
// LICENSE_CODE ZON ISC
 /*jslint react:true, es6:true*/

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _react = __webpack_require__(0);

var _react2 = _interopRequireDefault(_react);

var _ajax = __webpack_require__(102);

var _ajax2 = _interopRequireDefault(_ajax);

var _etask = __webpack_require__(19);

var _etask2 = _interopRequireDefault(_etask);

var _howto = __webpack_require__(270);

var _howto2 = _interopRequireDefault(_howto);

var _common = __webpack_require__(37);

var _util = __webpack_require__(29);

var _util2 = _interopRequireDefault(_util);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var ga_event = _util2.default.ga_event;
var steps = _common.onboarding_steps;
var localhost = window.location.origin;

var Page = function (_React$Component) {
    _inherits(Page, _React$Component);

    function Page(props) {
        _classCallCheck(this, Page);

        var _this = _possibleConstructorReturn(this, (Page.__proto__ || Object.getPrototypeOf(Page)).call(this, props));

        var step = JSON.parse(window.localStorage.getItem('quickstart-step'));
        if (!Object.values(steps).includes(Number(step))) step = steps.WELCOME;
        _this.state = { step: step };
        return _this;
    }

    _createClass(Page, [{
        key: 'set_step',
        value: function set_step(step) {
            if (step == steps.ADD_PROXY) ga_event('lpm-onboarding', '03 intro page next');
            if (step == steps.HOWTO) {
                ga_event('lpm-onboarding', '05 first request button clicked');
            }
            if (step == steps.HOWTO_DONE) window.location = '/proxies';
            window.localStorage.setItem('quickstart-step', step);
            this.setState({ step: step });
        }
    }, {
        key: 'render',
        value: function render() {
            var Current_page = void 0;
            switch (this.state.step) {
                case steps.WELCOME:
                    Current_page = Welcome;break;
                case steps.ADD_PROXY:
                case steps.HOWTO_DONE:
                case steps.ADD_PROXY_DONE:
                    Current_page = List;break;
                case steps.HOWTO:
                    Current_page = Howto_wrapper;break;
                default:
                    Current_page = Welcome;
            }
            return _react2.default.createElement(
                'div',
                { className: 'intro lpm' },
                _react2.default.createElement(Current_page, { set_step: this.set_step.bind(this),
                    curr_step: this.state.step })
            );
        }
    }]);

    return Page;
}(_react2.default.Component);

var Done_btn = function Done_btn(props) {
    return _react2.default.createElement(
        'button',
        { onClick: props.on_click, className: 'btn btn_lpm btn_done' },
        'Done'
    );
};

var Howto_wrapper = function Howto_wrapper(props) {
    var click_done = function click_done(option) {
        return function () {
            props.set_step(steps.HOWTO_DONE);
            ga_event('lpm-onboarding', '07 click done', option);
        };
    };
    return _react2.default.createElement(
        _howto2.default,
        { ga_category: 'onboarding' },
        _react2.default.createElement(Done_btn, { on_click: click_done })
    );
};

var Welcome = function Welcome(props) {
    return _react2.default.createElement(
        'div',
        { className: 'header' },
        _react2.default.createElement(
            'h1',
            null,
            'Welcome to Luminati Proxy Manager'
        ),
        _react2.default.createElement(
            'h2',
            { className: 'sub_header' },
            'How it works'
        ),
        _react2.default.createElement(
            'div',
            { className: 'sub_header' },
            _react2.default.createElement(
                'h4',
                null,
                'Create multiple proxy ports, each with its own unique configuration, for maximum performance and greater scalability'
            )
        ),
        _react2.default.createElement('div', { className: 'img_intro' }),
        _react2.default.createElement(
            'button',
            { className: 'btn btn-primary btn_lpm btn_lpm_big',
                onClick: function onClick() {
                    return props.set_step(steps.ADD_PROXY);
                } },
            "Let's go"
        )
    );
};

var List = function (_React$Component2) {
    _inherits(List, _React$Component2);

    function List(props) {
        _classCallCheck(this, List);

        var _this2 = _possibleConstructorReturn(this, (List.__proto__ || Object.getPrototypeOf(List)).call(this, props));

        var create = window.localStorage.getItem('quickstart-create-proxy');
        var test = window.localStorage.getItem('quickstart-test-proxy');
        _this2.state = { create: create, test: test };
        return _this2;
    }

    _createClass(List, [{
        key: 'click_add_proxy',
        value: function click_add_proxy() {
            window.location.href = localhost + '/proxies?action=tutorial_add_proxy';
        }
    }, {
        key: 'skip_to_dashboard',
        value: function skip_to_dashboard() {
            ga_event('lpm-onboarding', '04 tutorial skipped');
            window.location.href = localhost + '/proxies';
        }
    }, {
        key: 'render',
        value: function render() {
            var _this3 = this;

            return _react2.default.createElement(
                'div',
                null,
                _react2.default.createElement(
                    'h1',
                    { className: 'header' },
                    'Welcome to Luminati Proxy Manager'
                ),
                _react2.default.createElement(
                    'div',
                    { className: 'sub_header' },
                    _react2.default.createElement(
                        'h4',
                        null,
                        'Configure a new port with specific proxy settings and use it to browse the internet'
                    )
                ),
                _react2.default.createElement(
                    'div',
                    { className: 'section_list' },
                    _react2.default.createElement(Section, { header: 'Configure new proxy port', img: '1',
                        text: 'Specific proxy settings to be applied on this port',
                        on_click: this.click_add_proxy }),
                    _react2.default.createElement(Section, { header: 'Make your first request', img: '2',
                        text: '',
                        on_click: function on_click() {
                            return _this3.props.set_step(steps.HOWTO);
                        },
                        disabled: this.props.curr_step < steps.ADD_PROXY_DONE }),
                    _react2.default.createElement(
                        'a',
                        { onClick: this.skip_to_dashboard.bind(this) },
                        'Skip to dashboard'
                    )
                )
            );
        }
    }]);

    return List;
}(_react2.default.Component);

var Section = function Section(props) {
    var img_class = 'img img_' + props.img + (props.disabled ? '' : '_active');
    var on_click = function on_click() {
        if (props.disabled) return;
        props.on_click();
    };
    return _react2.default.createElement(
        'div',
        { onClick: on_click,
            className: 'section' + (props.disabled ? ' disabled' : '') },
        _react2.default.createElement(
            'div',
            { className: 'img_block' },
            _react2.default.createElement('div', { className: 'circle_wrapper' }),
            _react2.default.createElement('div', { className: img_class })
        ),
        _react2.default.createElement(
            'div',
            { className: 'text_block' },
            _react2.default.createElement(
                'div',
                { className: 'title' },
                props.header
            ),
            _react2.default.createElement(
                'div',
                { className: 'subtitle' },
                props.text
            )
        ),
        _react2.default.createElement('div', { className: 'right_arrow' })
    );
};

exports.default = Page;

/***/ }),
/* 536 */
/***/ (function(module, exports, __webpack_require__) {

// style-loader: Adds some css to the DOM by adding a <style> tag

// load the styles
var content = __webpack_require__(537);
if(typeof content === 'string') content = [[module.i, content, '']];
// Prepare cssTransformation
var transform;

var options = {}
options.transform = transform
// add the styles to the DOM
var update = __webpack_require__(41)(content, options);
if(content.locals) module.exports = content.locals;
// Hot Module Replacement
if(false) {
	// When the styles change, update the <style> tags
	if(!content.locals) {
		module.hot.accept("!!../../css-loader/index.js!./prism.css", function() {
			var newContent = require("!!../../css-loader/index.js!./prism.css");
			if(typeof newContent === 'string') newContent = [[module.id, newContent, '']];
			update(newContent);
		});
	}
	// When the module is disposed, remove the <style> tags
	module.hot.dispose(function() { update(); });
}

/***/ }),
/* 537 */
/***/ (function(module, exports, __webpack_require__) {

exports = module.exports = __webpack_require__(40)(undefined);
// imports


// module
exports.push([module.i, "/**\n * prism.js default theme for JavaScript, CSS and HTML\n * Based on dabblet (http://dabblet.com)\n * @author Lea Verou\n */\n\ncode[class*=\"language-\"],\npre[class*=\"language-\"] {\n\tcolor: black;\n\tbackground: none;\n\ttext-shadow: 0 1px white;\n\tfont-family: Consolas, Monaco, 'Andale Mono', 'Ubuntu Mono', monospace;\n\ttext-align: left;\n\twhite-space: pre;\n\tword-spacing: normal;\n\tword-break: normal;\n\tword-wrap: normal;\n\tline-height: 1.5;\n\n\t-moz-tab-size: 4;\n\t-o-tab-size: 4;\n\ttab-size: 4;\n\n\t-webkit-hyphens: none;\n\t-moz-hyphens: none;\n\t-ms-hyphens: none;\n\thyphens: none;\n}\n\npre[class*=\"language-\"]::-moz-selection, pre[class*=\"language-\"] ::-moz-selection,\ncode[class*=\"language-\"]::-moz-selection, code[class*=\"language-\"] ::-moz-selection {\n\ttext-shadow: none;\n\tbackground: #b3d4fc;\n}\n\npre[class*=\"language-\"]::selection, pre[class*=\"language-\"] ::selection,\ncode[class*=\"language-\"]::selection, code[class*=\"language-\"] ::selection {\n\ttext-shadow: none;\n\tbackground: #b3d4fc;\n}\n\n@media print {\n\tcode[class*=\"language-\"],\n\tpre[class*=\"language-\"] {\n\t\ttext-shadow: none;\n\t}\n}\n\n/* Code blocks */\npre[class*=\"language-\"] {\n\tpadding: 1em;\n\tmargin: .5em 0;\n\toverflow: auto;\n}\n\n:not(pre) > code[class*=\"language-\"],\npre[class*=\"language-\"] {\n\tbackground: #f5f2f0;\n}\n\n/* Inline code */\n:not(pre) > code[class*=\"language-\"] {\n\tpadding: .1em;\n\tborder-radius: .3em;\n\twhite-space: normal;\n}\n\n.token.comment,\n.token.prolog,\n.token.doctype,\n.token.cdata {\n\tcolor: slategray;\n}\n\n.token.punctuation {\n\tcolor: #999;\n}\n\n.namespace {\n\topacity: .7;\n}\n\n.token.property,\n.token.tag,\n.token.boolean,\n.token.number,\n.token.constant,\n.token.symbol,\n.token.deleted {\n\tcolor: #905;\n}\n\n.token.selector,\n.token.attr-name,\n.token.string,\n.token.char,\n.token.builtin,\n.token.inserted {\n\tcolor: #690;\n}\n\n.token.operator,\n.token.entity,\n.token.url,\n.language-css .token.string,\n.style .token.string {\n\tcolor: #a67f59;\n\tbackground: hsla(0, 0%, 100%, .5);\n}\n\n.token.atrule,\n.token.attr-value,\n.token.keyword {\n\tcolor: #07a;\n}\n\n.token.function {\n\tcolor: #DD4A68;\n}\n\n.token.regex,\n.token.important,\n.token.variable {\n\tcolor: #e90;\n}\n\n.token.important,\n.token.bold {\n\tfont-weight: bold;\n}\n.token.italic {\n\tfont-style: italic;\n}\n\n.token.entity {\n\tcursor: help;\n}\n", ""]);

// exports


/***/ }),
/* 538 */
/***/ (function(module, exports, __webpack_require__) {

/* WEBPACK VAR INJECTION */(function(global) {
/* **********************************************
     Begin prism-core.js
********************************************** */

var _self = (typeof window !== 'undefined')
	? window   // if in browser
	: (
		(typeof WorkerGlobalScope !== 'undefined' && self instanceof WorkerGlobalScope)
		? self // if in worker
		: {}   // if in node js
	);

/**
 * Prism: Lightweight, robust, elegant syntax highlighting
 * MIT license http://www.opensource.org/licenses/mit-license.php/
 * @author Lea Verou http://lea.verou.me
 */

var Prism = (function(){

// Private helper vars
var lang = /\blang(?:uage)?-(\w+)\b/i;
var uniqueId = 0;

var _ = _self.Prism = {
	manual: _self.Prism && _self.Prism.manual,
	disableWorkerMessageHandler: _self.Prism && _self.Prism.disableWorkerMessageHandler,
	util: {
		encode: function (tokens) {
			if (tokens instanceof Token) {
				return new Token(tokens.type, _.util.encode(tokens.content), tokens.alias);
			} else if (_.util.type(tokens) === 'Array') {
				return tokens.map(_.util.encode);
			} else {
				return tokens.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\u00a0/g, ' ');
			}
		},

		type: function (o) {
			return Object.prototype.toString.call(o).match(/\[object (\w+)\]/)[1];
		},

		objId: function (obj) {
			if (!obj['__id']) {
				Object.defineProperty(obj, '__id', { value: ++uniqueId });
			}
			return obj['__id'];
		},

		// Deep clone a language definition (e.g. to extend it)
		clone: function (o) {
			var type = _.util.type(o);

			switch (type) {
				case 'Object':
					var clone = {};

					for (var key in o) {
						if (o.hasOwnProperty(key)) {
							clone[key] = _.util.clone(o[key]);
						}
					}

					return clone;

				case 'Array':
					return o.map(function(v) { return _.util.clone(v); });
			}

			return o;
		}
	},

	languages: {
		extend: function (id, redef) {
			var lang = _.util.clone(_.languages[id]);

			for (var key in redef) {
				lang[key] = redef[key];
			}

			return lang;
		},

		/**
		 * Insert a token before another token in a language literal
		 * As this needs to recreate the object (we cannot actually insert before keys in object literals),
		 * we cannot just provide an object, we need anobject and a key.
		 * @param inside The key (or language id) of the parent
		 * @param before The key to insert before. If not provided, the function appends instead.
		 * @param insert Object with the key/value pairs to insert
		 * @param root The object that contains `inside`. If equal to Prism.languages, it can be omitted.
		 */
		insertBefore: function (inside, before, insert, root) {
			root = root || _.languages;
			var grammar = root[inside];

			if (arguments.length == 2) {
				insert = arguments[1];

				for (var newToken in insert) {
					if (insert.hasOwnProperty(newToken)) {
						grammar[newToken] = insert[newToken];
					}
				}

				return grammar;
			}

			var ret = {};

			for (var token in grammar) {

				if (grammar.hasOwnProperty(token)) {

					if (token == before) {

						for (var newToken in insert) {

							if (insert.hasOwnProperty(newToken)) {
								ret[newToken] = insert[newToken];
							}
						}
					}

					ret[token] = grammar[token];
				}
			}

			// Update references in other language definitions
			_.languages.DFS(_.languages, function(key, value) {
				if (value === root[inside] && key != inside) {
					this[key] = ret;
				}
			});

			return root[inside] = ret;
		},

		// Traverse a language definition with Depth First Search
		DFS: function(o, callback, type, visited) {
			visited = visited || {};
			for (var i in o) {
				if (o.hasOwnProperty(i)) {
					callback.call(o, i, o[i], type || i);

					if (_.util.type(o[i]) === 'Object' && !visited[_.util.objId(o[i])]) {
						visited[_.util.objId(o[i])] = true;
						_.languages.DFS(o[i], callback, null, visited);
					}
					else if (_.util.type(o[i]) === 'Array' && !visited[_.util.objId(o[i])]) {
						visited[_.util.objId(o[i])] = true;
						_.languages.DFS(o[i], callback, i, visited);
					}
				}
			}
		}
	},
	plugins: {},

	highlightAll: function(async, callback) {
		var env = {
			callback: callback,
			selector: 'code[class*="language-"], [class*="language-"] code, code[class*="lang-"], [class*="lang-"] code'
		};

		_.hooks.run("before-highlightall", env);

		var elements = env.elements || document.querySelectorAll(env.selector);

		for (var i=0, element; element = elements[i++];) {
			_.highlightElement(element, async === true, env.callback);
		}
	},

	highlightElement: function(element, async, callback) {
		// Find language
		var language, grammar, parent = element;

		while (parent && !lang.test(parent.className)) {
			parent = parent.parentNode;
		}

		if (parent) {
			language = (parent.className.match(lang) || [,''])[1].toLowerCase();
			grammar = _.languages[language];
		}

		// Set language on the element, if not present
		element.className = element.className.replace(lang, '').replace(/\s+/g, ' ') + ' language-' + language;

		if (element.parentNode) {
			// Set language on the parent, for styling
			parent = element.parentNode;

			if (/pre/i.test(parent.nodeName)) {
				parent.className = parent.className.replace(lang, '').replace(/\s+/g, ' ') + ' language-' + language;
			}
		}

		var code = element.textContent;

		var env = {
			element: element,
			language: language,
			grammar: grammar,
			code: code
		};

		_.hooks.run('before-sanity-check', env);

		if (!env.code || !env.grammar) {
			if (env.code) {
				_.hooks.run('before-highlight', env);
				env.element.textContent = env.code;
				_.hooks.run('after-highlight', env);
			}
			_.hooks.run('complete', env);
			return;
		}

		_.hooks.run('before-highlight', env);

		if (async && _self.Worker) {
			var worker = new Worker(_.filename);

			worker.onmessage = function(evt) {
				env.highlightedCode = evt.data;

				_.hooks.run('before-insert', env);

				env.element.innerHTML = env.highlightedCode;

				callback && callback.call(env.element);
				_.hooks.run('after-highlight', env);
				_.hooks.run('complete', env);
			};

			worker.postMessage(JSON.stringify({
				language: env.language,
				code: env.code,
				immediateClose: true
			}));
		}
		else {
			env.highlightedCode = _.highlight(env.code, env.grammar, env.language);

			_.hooks.run('before-insert', env);

			env.element.innerHTML = env.highlightedCode;

			callback && callback.call(element);

			_.hooks.run('after-highlight', env);
			_.hooks.run('complete', env);
		}
	},

	highlight: function (text, grammar, language) {
		var tokens = _.tokenize(text, grammar);
		return Token.stringify(_.util.encode(tokens), language);
	},

	matchGrammar: function (text, strarr, grammar, index, startPos, oneshot, target) {
		var Token = _.Token;

		for (var token in grammar) {
			if(!grammar.hasOwnProperty(token) || !grammar[token]) {
				continue;
			}

			if (token == target) {
				return;
			}

			var patterns = grammar[token];
			patterns = (_.util.type(patterns) === "Array") ? patterns : [patterns];

			for (var j = 0; j < patterns.length; ++j) {
				var pattern = patterns[j],
					inside = pattern.inside,
					lookbehind = !!pattern.lookbehind,
					greedy = !!pattern.greedy,
					lookbehindLength = 0,
					alias = pattern.alias;

				if (greedy && !pattern.pattern.global) {
					// Without the global flag, lastIndex won't work
					var flags = pattern.pattern.toString().match(/[imuy]*$/)[0];
					pattern.pattern = RegExp(pattern.pattern.source, flags + "g");
				}

				pattern = pattern.pattern || pattern;

				// Don’t cache length as it changes during the loop
				for (var i = index, pos = startPos; i < strarr.length; pos += strarr[i].length, ++i) {

					var str = strarr[i];

					if (strarr.length > text.length) {
						// Something went terribly wrong, ABORT, ABORT!
						return;
					}

					if (str instanceof Token) {
						continue;
					}

					pattern.lastIndex = 0;

					var match = pattern.exec(str),
					    delNum = 1;

					// Greedy patterns can override/remove up to two previously matched tokens
					if (!match && greedy && i != strarr.length - 1) {
						pattern.lastIndex = pos;
						match = pattern.exec(text);
						if (!match) {
							break;
						}

						var from = match.index + (lookbehind ? match[1].length : 0),
						    to = match.index + match[0].length,
						    k = i,
						    p = pos;

						for (var len = strarr.length; k < len && (p < to || (!strarr[k].type && !strarr[k - 1].greedy)); ++k) {
							p += strarr[k].length;
							// Move the index i to the element in strarr that is closest to from
							if (from >= p) {
								++i;
								pos = p;
							}
						}

						/*
						 * If strarr[i] is a Token, then the match starts inside another Token, which is invalid
						 * If strarr[k - 1] is greedy we are in conflict with another greedy pattern
						 */
						if (strarr[i] instanceof Token || strarr[k - 1].greedy) {
							continue;
						}

						// Number of tokens to delete and replace with the new match
						delNum = k - i;
						str = text.slice(pos, p);
						match.index -= pos;
					}

					if (!match) {
						if (oneshot) {
							break;
						}

						continue;
					}

					if(lookbehind) {
						lookbehindLength = match[1].length;
					}

					var from = match.index + lookbehindLength,
					    match = match[0].slice(lookbehindLength),
					    to = from + match.length,
					    before = str.slice(0, from),
					    after = str.slice(to);

					var args = [i, delNum];

					if (before) {
						++i;
						pos += before.length;
						args.push(before);
					}

					var wrapped = new Token(token, inside? _.tokenize(match, inside) : match, alias, match, greedy);

					args.push(wrapped);

					if (after) {
						args.push(after);
					}

					Array.prototype.splice.apply(strarr, args);

					if (delNum != 1)
						_.matchGrammar(text, strarr, grammar, i, pos, true, token);

					if (oneshot)
						break;
				}
			}
		}
	},

	tokenize: function(text, grammar, language) {
		var strarr = [text];

		var rest = grammar.rest;

		if (rest) {
			for (var token in rest) {
				grammar[token] = rest[token];
			}

			delete grammar.rest;
		}

		_.matchGrammar(text, strarr, grammar, 0, 0, false);

		return strarr;
	},

	hooks: {
		all: {},

		add: function (name, callback) {
			var hooks = _.hooks.all;

			hooks[name] = hooks[name] || [];

			hooks[name].push(callback);
		},

		run: function (name, env) {
			var callbacks = _.hooks.all[name];

			if (!callbacks || !callbacks.length) {
				return;
			}

			for (var i=0, callback; callback = callbacks[i++];) {
				callback(env);
			}
		}
	}
};

var Token = _.Token = function(type, content, alias, matchedStr, greedy) {
	this.type = type;
	this.content = content;
	this.alias = alias;
	// Copy of the full string this token was created from
	this.length = (matchedStr || "").length|0;
	this.greedy = !!greedy;
};

Token.stringify = function(o, language, parent) {
	if (typeof o == 'string') {
		return o;
	}

	if (_.util.type(o) === 'Array') {
		return o.map(function(element) {
			return Token.stringify(element, language, o);
		}).join('');
	}

	var env = {
		type: o.type,
		content: Token.stringify(o.content, language, parent),
		tag: 'span',
		classes: ['token', o.type],
		attributes: {},
		language: language,
		parent: parent
	};

	if (o.alias) {
		var aliases = _.util.type(o.alias) === 'Array' ? o.alias : [o.alias];
		Array.prototype.push.apply(env.classes, aliases);
	}

	_.hooks.run('wrap', env);

	var attributes = Object.keys(env.attributes).map(function(name) {
		return name + '="' + (env.attributes[name] || '').replace(/"/g, '&quot;') + '"';
	}).join(' ');

	return '<' + env.tag + ' class="' + env.classes.join(' ') + '"' + (attributes ? ' ' + attributes : '') + '>' + env.content + '</' + env.tag + '>';

};

if (!_self.document) {
	if (!_self.addEventListener) {
		// in Node.js
		return _self.Prism;
	}

	if (!_.disableWorkerMessageHandler) {
		// In worker
		_self.addEventListener('message', function (evt) {
			var message = JSON.parse(evt.data),
				lang = message.language,
				code = message.code,
				immediateClose = message.immediateClose;

			_self.postMessage(_.highlight(code, _.languages[lang], lang));
			if (immediateClose) {
				_self.close();
			}
		}, false);
	}

	return _self.Prism;
}

//Get current script and highlight
var script = document.currentScript || [].slice.call(document.getElementsByTagName("script")).pop();

if (script) {
	_.filename = script.src;

	if (!_.manual && !script.hasAttribute('data-manual')) {
		if(document.readyState !== "loading") {
			if (window.requestAnimationFrame) {
				window.requestAnimationFrame(_.highlightAll);
			} else {
				window.setTimeout(_.highlightAll, 16);
			}
		}
		else {
			document.addEventListener('DOMContentLoaded', _.highlightAll);
		}
	}
}

return _self.Prism;

})();

if (typeof module !== 'undefined' && module.exports) {
	module.exports = Prism;
}

// hack for components to work correctly in node.js
if (typeof global !== 'undefined') {
	global.Prism = Prism;
}


/* **********************************************
     Begin prism-markup.js
********************************************** */

Prism.languages.markup = {
	'comment': /<!--[\s\S]*?-->/,
	'prolog': /<\?[\s\S]+?\?>/,
	'doctype': /<!DOCTYPE[\s\S]+?>/i,
	'cdata': /<!\[CDATA\[[\s\S]*?]]>/i,
	'tag': {
		pattern: /<\/?(?!\d)[^\s>\/=$<]+(?:\s+[^\s>\/=]+(?:=(?:("|')(?:\\[\s\S]|(?!\1)[^\\])*\1|[^\s'">=]+))?)*\s*\/?>/i,
		inside: {
			'tag': {
				pattern: /^<\/?[^\s>\/]+/i,
				inside: {
					'punctuation': /^<\/?/,
					'namespace': /^[^\s>\/:]+:/
				}
			},
			'attr-value': {
				pattern: /=(?:("|')(?:\\[\s\S]|(?!\1)[^\\])*\1|[^\s'">=]+)/i,
				inside: {
					'punctuation': [
						/^=/,
						{
							pattern: /(^|[^\\])["']/,
							lookbehind: true
						}
					]
				}
			},
			'punctuation': /\/?>/,
			'attr-name': {
				pattern: /[^\s>\/]+/,
				inside: {
					'namespace': /^[^\s>\/:]+:/
				}
			}

		}
	},
	'entity': /&#?[\da-z]{1,8};/i
};

Prism.languages.markup['tag'].inside['attr-value'].inside['entity'] =
	Prism.languages.markup['entity'];

// Plugin to make entity title show the real entity, idea by Roman Komarov
Prism.hooks.add('wrap', function(env) {

	if (env.type === 'entity') {
		env.attributes['title'] = env.content.replace(/&amp;/, '&');
	}
});

Prism.languages.xml = Prism.languages.markup;
Prism.languages.html = Prism.languages.markup;
Prism.languages.mathml = Prism.languages.markup;
Prism.languages.svg = Prism.languages.markup;


/* **********************************************
     Begin prism-css.js
********************************************** */

Prism.languages.css = {
	'comment': /\/\*[\s\S]*?\*\//,
	'atrule': {
		pattern: /@[\w-]+?.*?(?:;|(?=\s*\{))/i,
		inside: {
			'rule': /@[\w-]+/
			// See rest below
		}
	},
	'url': /url\((?:(["'])(?:\\(?:\r\n|[\s\S])|(?!\1)[^\\\r\n])*\1|.*?)\)/i,
	'selector': /[^{}\s][^{};]*?(?=\s*\{)/,
	'string': {
		pattern: /("|')(?:\\(?:\r\n|[\s\S])|(?!\1)[^\\\r\n])*\1/,
		greedy: true
	},
	'property': /[\w-]+(?=\s*:)/i,
	'important': /\B!important\b/i,
	'function': /[-a-z0-9]+(?=\()/i,
	'punctuation': /[(){};:]/
};

Prism.languages.css['atrule'].inside.rest = Prism.util.clone(Prism.languages.css);

if (Prism.languages.markup) {
	Prism.languages.insertBefore('markup', 'tag', {
		'style': {
			pattern: /(<style[\s\S]*?>)[\s\S]*?(?=<\/style>)/i,
			lookbehind: true,
			inside: Prism.languages.css,
			alias: 'language-css'
		}
	});
	
	Prism.languages.insertBefore('inside', 'attr-value', {
		'style-attr': {
			pattern: /\s*style=("|')(?:\\[\s\S]|(?!\1)[^\\])*\1/i,
			inside: {
				'attr-name': {
					pattern: /^\s*style/i,
					inside: Prism.languages.markup.tag.inside
				},
				'punctuation': /^\s*=\s*['"]|['"]\s*$/,
				'attr-value': {
					pattern: /.+/i,
					inside: Prism.languages.css
				}
			},
			alias: 'language-css'
		}
	}, Prism.languages.markup.tag);
}

/* **********************************************
     Begin prism-clike.js
********************************************** */

Prism.languages.clike = {
	'comment': [
		{
			pattern: /(^|[^\\])\/\*[\s\S]*?(?:\*\/|$)/,
			lookbehind: true
		},
		{
			pattern: /(^|[^\\:])\/\/.*/,
			lookbehind: true
		}
	],
	'string': {
		pattern: /(["'])(?:\\(?:\r\n|[\s\S])|(?!\1)[^\\\r\n])*\1/,
		greedy: true
	},
	'class-name': {
		pattern: /((?:\b(?:class|interface|extends|implements|trait|instanceof|new)\s+)|(?:catch\s+\())[\w.\\]+/i,
		lookbehind: true,
		inside: {
			punctuation: /[.\\]/
		}
	},
	'keyword': /\b(?:if|else|while|do|for|return|in|instanceof|function|new|try|throw|catch|finally|null|break|continue)\b/,
	'boolean': /\b(?:true|false)\b/,
	'function': /[a-z0-9_]+(?=\()/i,
	'number': /\b-?(?:0x[\da-f]+|\d*\.?\d+(?:e[+-]?\d+)?)\b/i,
	'operator': /--?|\+\+?|!=?=?|<=?|>=?|==?=?|&&?|\|\|?|\?|\*|\/|~|\^|%/,
	'punctuation': /[{}[\];(),.:]/
};


/* **********************************************
     Begin prism-javascript.js
********************************************** */

Prism.languages.javascript = Prism.languages.extend('clike', {
	'keyword': /\b(?:as|async|await|break|case|catch|class|const|continue|debugger|default|delete|do|else|enum|export|extends|finally|for|from|function|get|if|implements|import|in|instanceof|interface|let|new|null|of|package|private|protected|public|return|set|static|super|switch|this|throw|try|typeof|var|void|while|with|yield)\b/,
	'number': /\b-?(?:0[xX][\dA-Fa-f]+|0[bB][01]+|0[oO][0-7]+|\d*\.?\d+(?:[Ee][+-]?\d+)?|NaN|Infinity)\b/,
	// Allow for all non-ASCII characters (See http://stackoverflow.com/a/2008444)
	'function': /[_$a-zA-Z\xA0-\uFFFF][_$a-zA-Z0-9\xA0-\uFFFF]*(?=\s*\()/i,
	'operator': /-[-=]?|\+[+=]?|!=?=?|<<?=?|>>?>?=?|=(?:==?|>)?|&[&=]?|\|[|=]?|\*\*?=?|\/=?|~|\^=?|%=?|\?|\.{3}/
});

Prism.languages.insertBefore('javascript', 'keyword', {
	'regex': {
		pattern: /(^|[^/])\/(?!\/)(\[[^\]\r\n]+]|\\.|[^/\\\[\r\n])+\/[gimyu]{0,5}(?=\s*($|[\r\n,.;})]))/,
		lookbehind: true,
		greedy: true
	},
	// This must be declared before keyword because we use "function" inside the look-forward
	'function-variable': {
		pattern: /[_$a-zA-Z\xA0-\uFFFF][_$a-zA-Z0-9\xA0-\uFFFF]*(?=\s*=\s*(?:function\b|(?:\([^()]*\)|[_$a-zA-Z\xA0-\uFFFF][_$a-zA-Z0-9\xA0-\uFFFF]*)\s*=>))/i,
		alias: 'function'
	}
});

Prism.languages.insertBefore('javascript', 'string', {
	'template-string': {
		pattern: /`(?:\\[\s\S]|[^\\`])*`/,
		greedy: true,
		inside: {
			'interpolation': {
				pattern: /\$\{[^}]+\}/,
				inside: {
					'interpolation-punctuation': {
						pattern: /^\$\{|\}$/,
						alias: 'punctuation'
					},
					rest: Prism.languages.javascript
				}
			},
			'string': /[\s\S]+/
		}
	}
});

if (Prism.languages.markup) {
	Prism.languages.insertBefore('markup', 'tag', {
		'script': {
			pattern: /(<script[\s\S]*?>)[\s\S]*?(?=<\/script>)/i,
			lookbehind: true,
			inside: Prism.languages.javascript,
			alias: 'language-javascript'
		}
	});
}

Prism.languages.js = Prism.languages.javascript;


/* **********************************************
     Begin prism-file-highlight.js
********************************************** */

(function () {
	if (typeof self === 'undefined' || !self.Prism || !self.document || !document.querySelector) {
		return;
	}

	self.Prism.fileHighlight = function() {

		var Extensions = {
			'js': 'javascript',
			'py': 'python',
			'rb': 'ruby',
			'ps1': 'powershell',
			'psm1': 'powershell',
			'sh': 'bash',
			'bat': 'batch',
			'h': 'c',
			'tex': 'latex'
		};

		Array.prototype.slice.call(document.querySelectorAll('pre[data-src]')).forEach(function (pre) {
			var src = pre.getAttribute('data-src');

			var language, parent = pre;
			var lang = /\blang(?:uage)?-(?!\*)(\w+)\b/i;
			while (parent && !lang.test(parent.className)) {
				parent = parent.parentNode;
			}

			if (parent) {
				language = (pre.className.match(lang) || [, ''])[1];
			}

			if (!language) {
				var extension = (src.match(/\.(\w+)$/) || [, ''])[1];
				language = Extensions[extension] || extension;
			}

			var code = document.createElement('code');
			code.className = 'language-' + language;

			pre.textContent = '';

			code.textContent = 'Loading…';

			pre.appendChild(code);

			var xhr = new XMLHttpRequest();

			xhr.open('GET', src, true);

			xhr.onreadystatechange = function () {
				if (xhr.readyState == 4) {

					if (xhr.status < 400 && xhr.responseText) {
						code.textContent = xhr.responseText;

						Prism.highlightElement(code);
					}
					else if (xhr.status >= 400) {
						code.textContent = '✖ Error ' + xhr.status + ' while fetching file: ' + xhr.statusText;
					}
					else {
						code.textContent = '✖ Error: File does not exist or is empty';
					}
				}
			};

			xhr.send(null);
		});

	};

	document.addEventListener('DOMContentLoaded', self.Prism.fileHighlight);

})();

/* WEBPACK VAR INJECTION */}.call(exports, __webpack_require__(83)))

/***/ }),
/* 539 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
// LICENSE_CODE ZON ISC
 /*jslint react:true, es6:true*/

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _react = __webpack_require__(0);

var _react2 = _interopRequireDefault(_react);

var _common = __webpack_require__(37);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var E = {};
var Li = function Li(props) {
    return _react2.default.createElement(
        'li',
        null,
        _react2.default.createElement(
            'div',
            { className: 'circle_wrapper' },
            _react2.default.createElement('div', { className: 'circle' })
        ),
        _react2.default.createElement(
            'div',
            { className: 'single_instruction' },
            props.children
        )
    );
};

E.code = function () {
    var proxy = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 24000;
    return {
        shell: 'curl --proxy 127.0.0.1:' + proxy + ' "http://lumtest.com/myip.json"',
        node: '#!/usr/bin/env node\nrequire(\'request-promise\')({\n    url: \'http://lumtest.com/myip.json\',\n    proxy: \'http://127.0.0.1:' + proxy + '\'\n}).then(function(data){\n    console.log(data);\n}, function(err){\n    console.error(err);\n});',
        java: 'package example;\n\nimport org.apache.http.HttpHost;\nimport org.apache.http.client.fluent.*;\n\npublic class Example {\n    public static void main(String[] args) throws Exception {\n        HttpHost proxy = new HttpHost("127.0.0.1", ' + proxy + ');\n        String res = Executor.newInstance()\n            .execute(Request.Get("http://lumtest.com/myip.json")\n            .viaProxy(proxy))\n            .returnContent().asString();\n        System.out.println(res);\n    }\n}',
        csharp: 'using System;\nusing System.Net;\n\nclass Example\n{\n    static void Main()\n    {\n        var client = new WebClient();\n        client.Proxy = new WebProxy("127.0.0.1:' + proxy + '");\n        Console.WriteLine(client.DownloadString(\n            "http://lumtest.com/myip.json"));\n    }\n}',
        vb: 'Imports System.Net\n\nModule Example\n    Sub Main()\n        Dim Client As New WebClient\n        Client.Proxy = New WebProxy("http://127.0.0.1:' + proxy + '")\n        Console.WriteLine(Client.DownloadString(\n            "http://lumtest.com/myip.json"))\n    End Sub\nEnd Module',
        python: '#!/usr/bin/env python\nprint(\'If you get error "ImportError: No module named \\\'six\\\'"\'+\\\n    \'install six:\\n$ sudo pip install six\');\nimport sys\nif sys.version_info[0]==2:\n    import six\n    from six.moves.urllib import request\n    opener = request.build_opener(\n        request.ProxyHandler(\n            {\'http\': \'http://127.0.0.1:' + proxy + '\'}))\n    print(opener.open(\'http://lumtest.com/myip.json\').read())\nif sys.version_info[0]==3:\n    import urllib.request\n    opener = urllib.request.build_opener(\n        urllib.request.ProxyHandler(\n            {\'http\': \'http://127.0.0.1:' + proxy + '\'}))\n    print(opener.open(\'http://lumtest.com/myip.json\').read())',
        ruby: '#!/usr/bin/ruby\n\nrequire \'uri\'\nrequire \'net/http\'\n\nuri = URI.parse(\'{{example.user_url}}\')\nproxy = Net::HTTP::Proxy(\'127.0.0.1\', ' + proxy + ')\n\nreq = Net::HTTP::Get.new(uri.path)\n\nresult = proxy.start(uri.host,uri.port) do |http|\n    http.request(req)\nend\n\nputs result.body',
        php: '<?php\n    $curl = curl_init(\'http://lumtest.com/myip.json\');\n    curl_setopt($curl, CURLOPT_PROXY, \'http://127.0.0.1:' + proxy + '\');\n    curl_exec($curl);\n?>',
        perl: '#!/usr/bin/perl\nuse LWP::UserAgent;\nmy $agent = LWP::UserAgent->new();\n$agent->proxy([\'http\', \'https\'], "http://127.0.0.1:' + proxy + '");\nprint $agent->get(\'http://lumtest.com/myip.json\')->content();'
    };
};
E.browser = function () {
    var proxy = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 24000;
    return {
        chrome_win: _react2.default.createElement(
            'ol',
            null,
            _react2.default.createElement(
                Li,
                null,
                'Click the Chrome menu on the browser toolbar.'
            ),
            _react2.default.createElement(
                Li,
                null,
                'Select "Settings".'
            ),
            _react2.default.createElement(
                Li,
                null,
                'Click "Advanced settings".'
            ),
            _react2.default.createElement(
                Li,
                null,
                'In the "System" section, click "Open proxy settings".'
            ),
            _react2.default.createElement(
                Li,
                null,
                'Click "LAN settings".'
            ),
            _react2.default.createElement(
                Li,
                null,
                'Select the "Use a proxy server for your LAN" check box under "Proxy Server".'
            ),
            _react2.default.createElement(
                Li,
                null,
                'Enter "Address":',
                _react2.default.createElement(
                    _common.Code,
                    { id: 'address' },
                    '127.0.0.1'
                )
            ),
            _react2.default.createElement(
                Li,
                null,
                'Enter "Port":',
                _react2.default.createElement(
                    _common.Code,
                    { id: 'address' },
                    proxy
                )
            ),
            _react2.default.createElement(
                Li,
                null,
                'Save changes by pressing "OK".'
            )
        ),
        chrome_mac: _react2.default.createElement(
            'ol',
            null,
            _react2.default.createElement(
                Li,
                null,
                'Click the Chrome menu on the browser toolbar.'
            ),
            _react2.default.createElement(
                Li,
                null,
                'Select "Settings".'
            ),
            _react2.default.createElement(
                Li,
                null,
                'Click "Show advanced settings".'
            ),
            _react2.default.createElement(
                Li,
                null,
                'In the "Network" section, click "Change proxy settings".'
            ),
            _react2.default.createElement(
                Li,
                null,
                'System Preferences should start up automatically, with the Network window open and Proxies selected.'
            ),
            _react2.default.createElement(
                Li,
                null,
                'Choose "Web Proxy (HTTP)".'
            ),
            _react2.default.createElement(
                Li,
                null,
                'Enter "Web Proxy Server":',
                _react2.default.createElement(
                    _common.Code,
                    { id: 'address' },
                    '127.0.0.1'
                )
            ),
            _react2.default.createElement(
                Li,
                null,
                'Enter "Port":',
                _react2.default.createElement(
                    _common.Code,
                    { id: 'address' },
                    proxy
                )
            ),
            _react2.default.createElement(
                Li,
                null,
                'Save changes by pressing "OK".'
            )
        ),
        ie: _react2.default.createElement(
            'ol',
            null,
            _react2.default.createElement(
                Li,
                null,
                'Click the Tools button, and then click Internet options.'
            ),
            _react2.default.createElement(
                Li,
                null,
                'Click the Connections tab.'
            ),
            _react2.default.createElement(
                Li,
                null,
                'Click "LAN settings".'
            ),
            _react2.default.createElement(
                Li,
                null,
                'Select the "Use a proxy server for your LAN" check box.'
            ),
            _react2.default.createElement(
                Li,
                null,
                'Enter "Address":',
                _react2.default.createElement(
                    _common.Code,
                    { id: 'address' },
                    '127.0.0.1'
                )
            ),
            _react2.default.createElement(
                Li,
                null,
                'Enter "Port":',
                _react2.default.createElement(
                    _common.Code,
                    { id: 'address' },
                    proxy
                )
            ),
            _react2.default.createElement(
                Li,
                null,
                'Save changes by pressing "OK".'
            )
        ),
        firefox: _react2.default.createElement(
            'ol',
            null,
            _react2.default.createElement(
                Li,
                null,
                'In main menu, click "Tools" and then click "Options".'
            ),
            _react2.default.createElement(
                Li,
                null,
                'Click the "General" tab and scroll down to "Network Proxy".'
            ),
            _react2.default.createElement(
                Li,
                null,
                'Open network settings by clicking "Settings..." button.'
            ),
            _react2.default.createElement(
                Li,
                null,
                'Choose "Manual proxy configuration" radio button.'
            ),
            _react2.default.createElement(
                Li,
                null,
                'Enter "HTTP Proxy":',
                _react2.default.createElement(
                    _common.Code,
                    { id: 'address' },
                    '127.0.0.1'
                )
            ),
            _react2.default.createElement(
                Li,
                null,
                'Enter "Port":',
                _react2.default.createElement(
                    _common.Code,
                    { id: 'address' },
                    proxy
                )
            ),
            _react2.default.createElement(
                Li,
                null,
                'Tick "Use this proxy server for all protocols" checkbox.'
            ),
            _react2.default.createElement(
                Li,
                null,
                'Save changes by pressing "OK".'
            )
        ),
        safari: _react2.default.createElement(
            'ol',
            null,
            _react2.default.createElement(
                Li,
                null,
                'Pull down the Safari menu and select "Preferences".'
            ),
            _react2.default.createElement(
                Li,
                null,
                'Click on the "Advanced" icon.'
            ),
            _react2.default.createElement(
                Li,
                null,
                'In the "Proxies" option, click on Change Settings.'
            ),
            _react2.default.createElement(
                Li,
                null,
                'System Preferences should start up automatically, with the Network window open and Proxies selected.'
            ),
            _react2.default.createElement(
                Li,
                null,
                'Choose "Web Proxy (HTTP)".'
            ),
            _react2.default.createElement(
                Li,
                null,
                'Enter "Web Proxy Server":',
                _react2.default.createElement(
                    _common.Code,
                    { id: 'address' },
                    '127.0.0.1'
                )
            ),
            _react2.default.createElement(
                Li,
                null,
                'Enter "Port":',
                _react2.default.createElement(
                    _common.Code,
                    { id: 'address' },
                    proxy
                )
            ),
            _react2.default.createElement(
                Li,
                null,
                'Save changes by pressing "OK".'
            )
        )
    };
};

exports.default = E;

/***/ }),
/* 540 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
// LICENSE_CODE ZON ISC
 /*jslint react:true, es6:true*/

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _regeneratorRuntime = __webpack_require__(20);

var _regeneratorRuntime2 = _interopRequireDefault(_regeneratorRuntime);

var _etask = __webpack_require__(19);

var _etask2 = _interopRequireDefault(_etask);

var _ajax = __webpack_require__(102);

var _ajax2 = _interopRequireDefault(_ajax);

var _react = __webpack_require__(0);

var _react2 = _interopRequireDefault(_react);

var _jquery = __webpack_require__(13);

var _jquery2 = _interopRequireDefault(_jquery);

var _classnames = __webpack_require__(5);

var _classnames2 = _interopRequireDefault(_classnames);

var _common = __webpack_require__(37);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var Add_proxy = function (_React$Component) {
    _inherits(Add_proxy, _React$Component);

    function Add_proxy(props) {
        _classCallCheck(this, Add_proxy);

        var _this2 = _possibleConstructorReturn(this, (Add_proxy.__proto__ || Object.getPrototypeOf(Add_proxy)).call(this, props));

        _this2.field_changed = function (id) {
            return function (value) {
                _this2.setState(_defineProperty({}, id, value));
            };
        };

        _this2.sp = (0, _etask2.default)('Add_proxy', /*#__PURE__*/_regeneratorRuntime2.default.mark(function _callee() {
            return _regeneratorRuntime2.default.wrap(function _callee$(_context) {
                while (1) {
                    switch (_context.prev = _context.next) {
                        case 0:
                            _context.next = 2;
                            return this.wait();

                        case 2:
                        case 'end':
                            return _context.stop();
                    }
                }
            }, _callee, this);
        }));
        _this2.zones = props.extra.consts.proxy.zone.values;
        _this2.presets = props.extra.presets;
        _this2.presets_opt = Object.keys(_this2.presets).map(function (p) {
            return { key: _this2.presets[p].title, value: p };
        });
        _this2.state = { zone: '', preset: 'sequential', show_loader: false };
        return _this2;
    }

    _createClass(Add_proxy, [{
        key: 'persist',
        value: function persist() {
            var preset = this.state.preset;
            var form = { last_preset_applied: preset, zone: this.state.zone };
            form.proxy_type = 'persist';
            this.presets[preset].set(form);
            this.setState({ show_loader: true });
            var _this = this;
            return (0, _etask2.default)( /*#__PURE__*/_regeneratorRuntime2.default.mark(function _callee2() {
                var proxies, port, raw_update;
                return _regeneratorRuntime2.default.wrap(function _callee2$(_context2) {
                    while (1) {
                        switch (_context2.prev = _context2.next) {
                            case 0:
                                _context2.next = 2;
                                return _ajax2.default.json({ url: '/api/proxies' });

                            case 2:
                                proxies = _context2.sent;
                                port = 24000;

                                proxies.forEach(function (p) {
                                    if (p.port >= port) port = p.port + 1;
                                });
                                form.port = port;
                                _context2.next = 8;
                                return window.fetch('/api/proxies', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ proxy: form })
                                });

                            case 8:
                                raw_update = _context2.sent;

                                _this.setState({ show_loader: false });
                                return _context2.abrupt('return', port);

                            case 11:
                            case 'end':
                                return _context2.stop();
                        }
                    }
                }, _callee2, this);
            }));
        }
    }, {
        key: 'save',
        value: function save() {
            var opt = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

            var _this = this;
            this.sp.spawn((0, _etask2.default)( /*#__PURE__*/_regeneratorRuntime2.default.mark(function _callee3() {
                var port, url;
                return _regeneratorRuntime2.default.wrap(function _callee3$(_context3) {
                    while (1) {
                        switch (_context3.prev = _context3.next) {
                            case 0:
                                _context3.next = 2;
                                return _this.persist();

                            case 2:
                                port = _context3.sent;

                                (0, _jquery2.default)('#add_proxy_modal').modal('hide');
                                if (opt.redirect) {
                                    url = '/proxy/' + port;

                                    if (opt.field) url += '?field=' + opt.field;
                                    window.location.href = url;
                                } else window.location.href = '/proxies';

                            case 5:
                            case 'end':
                                return _context3.stop();
                        }
                    }
                }, _callee3, this);
            })));
        }
    }, {
        key: 'rule_clicked',
        value: function rule_clicked(field) {
            this.save({ redirect: true, field: field });
        }
    }, {
        key: 'render',
        value: function render() {
            var _this3 = this;

            var Footer_wrapper = _react2.default.createElement(Footer, { save_clicked: this.save.bind(this) });
            return _react2.default.createElement(
                'div',
                { className: 'lpm' },
                _react2.default.createElement(_common.Loader, { show: this.state.show_loader }),
                _react2.default.createElement(
                    _common.Modal,
                    { id: 'add_proxy_modal', title: 'Add new proxy',
                        footer: Footer_wrapper, className: 'add_proxy_modal' },
                    _react2.default.createElement(
                        'div',
                        { className: 'section' },
                        _react2.default.createElement(Field, { icon_class: 'zone_icon', val: this.state.zone,
                            options: this.zones, title: 'Choose Zone',
                            on_change: this.field_changed('zone').bind(this) })
                    ),
                    _react2.default.createElement(
                        'div',
                        { className: 'section' },
                        _react2.default.createElement(Field, { icon_class: 'preset_icon', val: this.state.preset,
                            options: this.presets_opt,
                            title: 'Select preset configuration',
                            on_change: this.field_changed('preset').bind(this) }),
                        _react2.default.createElement(
                            'div',
                            { className: 'preview' },
                            _react2.default.createElement(
                                'div',
                                { className: 'header' },
                                this.presets[this.state.preset].title
                            ),
                            _react2.default.createElement(
                                'div',
                                { className: 'desc' },
                                this.presets[this.state.preset].subtitle
                            ),
                            _react2.default.createElement(
                                'ul',
                                null,
                                (this.presets[this.state.preset].rules || []).map(function (r, i) {
                                    return _react2.default.createElement(
                                        'li',
                                        { key: i },
                                        _react2.default.createElement(
                                            'a',
                                            { onClick: function onClick() {
                                                    return _this3.rule_clicked(r.field);
                                                } },
                                            r.label
                                        )
                                    );
                                })
                            )
                        )
                    )
                )
            );
        }
    }]);

    return Add_proxy;
}(_react2.default.Component);

var Field = function Field(props) {
    return _react2.default.createElement(
        'div',
        null,
        _react2.default.createElement('div', { className: (0, _classnames2.default)('icon', props.icon_class) }),
        _react2.default.createElement(
            'h4',
            null,
            props.title
        ),
        _react2.default.createElement(
            'select',
            { onChange: function onChange(e) {
                    return props.on_change(e.target.value);
                }, value: props.val },
            props.options.map(function (o, i) {
                return _react2.default.createElement(
                    'option',
                    { key: i, value: o.value },
                    o.key
                );
            })
        )
    );
};

var Footer = function Footer(props) {
    return _react2.default.createElement(
        'div',
        null,
        _react2.default.createElement(
            'button',
            { onClick: function onClick() {
                    return props.save_clicked({ redirect: true });
                },
                className: 'btn btn_lpm_default btn_lpm options' },
            'Advanced options'
        ),
        _react2.default.createElement(
            'button',
            { onClick: props.save_clicked, className: 'btn btn_lpm save' },
            'Save'
        )
    );
};

exports.default = Add_proxy;

/***/ }),
/* 541 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
// LICENSE_CODE ZON ISC
 /*jslint react:true, es6:true*/

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _regeneratorRuntime = __webpack_require__(20);

var _regeneratorRuntime2 = _interopRequireDefault(_regeneratorRuntime);

var _react = __webpack_require__(0);

var _react2 = _interopRequireDefault(_react);

var _classnames = __webpack_require__(5);

var _classnames2 = _interopRequireDefault(_classnames);

var _jquery = __webpack_require__(13);

var _jquery2 = _interopRequireDefault(_jquery);

var _etask = __webpack_require__(19);

var _etask2 = _interopRequireDefault(_etask);

var _ajax = __webpack_require__(102);

var _ajax2 = _interopRequireDefault(_ajax);

var _common = __webpack_require__(37);

var _util = __webpack_require__(29);

var _util2 = _interopRequireDefault(_util);

var _url = __webpack_require__(181);

var _url2 = _interopRequireDefault(_url);

var _reactBootstrapTypeahead = __webpack_require__(542);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var event_tracker = {};
var ga_event = function ga_event(category, action, label) {
    var opt = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : {};

    var id = category + action + label;
    if (!event_tracker[id] || !opt.single) {
        event_tracker[id] = true;
        _util2.default.ga_event(category, action, label);
    }
};
var tabs = {
    target: {
        label: 'Targeting',
        tooltip: 'Select specific targeting for your proxy exit node',
        fields: {
            country: {
                label: 'Country',
                tooltip: 'Choose your exit country for your requests'
            },
            state: {
                label: 'State',
                tooltip: 'Specific state in a given country'
            },
            city: {
                label: 'City',
                tooltip: 'The city from which IP will be allocated'
            },
            asn: {
                label: _react2.default.createElement(
                    'span',
                    null,
                    'ASN (',
                    _react2.default.createElement(
                        'a',
                        { href: 'http://bgp.potaroo.net/cidr/autnums.html',
                            target: '_blank', rel: 'noopener noreferrer' },
                        'ASN list'
                    ),
                    ')'
                ),
                tooltip: 'Specifc ASN provider'
            }
        }
    },
    speed: {
        label: 'Request Speed',
        tooltip: 'Control the speed of your request to improve performance',
        fields: {
            dns: {
                label: 'DNS Lookup',
                tooltip: 'Location of DNS resolve'
            },
            request_timeout: {
                label: 'Timeout for requests on the super proxy',
                tooltip: 'Kill requests to super proxy and try new one if\n                    timeout is exceeded'
            },
            session_init_timeout: {
                label: 'Session establish timeout',
                tooltip: 'Time in seconds for the request to complete before\n                    estblishing connection to new peer'
            },
            race_reqs: {
                label: 'Race requests',
                tooltip: 'Race request via different super proxies and take the\n                    fastest'
            },
            proxy_count: {
                label: 'Minimum number of super proxies to use',
                tooltip: 'Number of super proxies to use in parallel'
            },
            proxy_switch: {
                label: 'Automatically switch super proxy on failure',
                tooltip: 'Number of failed requests(status 403, 429, 502, 503)\n                    to switch to different super proxy'
            },
            throttle: {
                label: 'Throttle requests above given number',
                tooltip: 'Allow maximum number of requests per unit of time'
            },
            reverse_lookup: {
                label: 'Reverse resolve',
                tooltip: 'resolve DNS from IP to url'
            },
            reverse_lookup_file: {
                label: 'Path to file',
                placeholder: '/path/to/file'
            },
            reverse_lookup_values: {
                label: 'Values',
                placeholder: '1.1.1.1 example.com'
            }
        }
    },
    rules: {
        label: 'Zero fail',
        tooltip: 'Configure rules to handle failed requests',
        fields: {
            trigger_type: {
                label: 'Create a rule including',
                tooltip: 'What is the type of condition to trigger the rule\n                    action'
            },
            trigger_regex: { label: 'Apply for specific domains (regex)' },
            status_code: { label: 'Status Code' },
            status_custom: { label: 'Custom Status Code' },
            action: {
                label: 'Select action to be taken when the rule is met',
                tooltip: 'The action to be exected when trigger pulled'
            }
        }
    },
    rotation: {
        label: 'IP Control',
        tooltip: 'Set the conditions for which your IPs will change',
        fields: {
            ip: {
                label: 'Data center IP',
                tooltip: 'Choose specific data center IP (when datacenter\n                    zone'
            },
            pool_size: {
                label: 'Pool size',
                tooltip: 'Maintain number of IPs that will be pinged constantly\n                    - must have keep_allive to work properly'
            },
            pool_type: {
                label: 'Pool type',
                tooltip: 'How to pull the IPs - roundrobin / sequential'
            },
            keep_alive: {
                label: 'Keep-alive',
                tooltip: 'Chosen number of sec to ping ip and keep it\n                    connected. depending on peer availability.'
            },
            whitelist_ips: {
                label: 'Whitelist IP access',
                tooltip: 'Grant proxy access to specific IPs. only those\n                    IPs will be able to send requests to this proxy Port'
            },
            session_random: {
                label: 'Random Session',
                tooltip: 'Switch session ID on each request'
            },
            session: {
                label: 'Explicit Session',
                tooltip: 'Insert session ID to maintain the same session'
            },
            sticky_ip: {
                label: 'Sticky IP',
                tooltip: 'When connecting to lpm server from different servers\n                    stick sessions to client ips. in that case every connected\n                    server will recieve unique session to avoid overriding\n                    sessions between machines'
            },
            max_requests: {
                label: 'Max Requests',
                tooltip: 'Change session based on number of requests can be a\n                    range or a fixed number'
            },
            session_duration: {
                label: 'Session Duration (seconds)',
                tooltip: 'Change session after fixed number of seconds'
            },
            seed: {
                label: 'Session ID Seed',
                tooltip: 'Seed used for random number generator in random\n                    sessions'
            },
            allow_req_auth: {
                label: 'Allow request authentication',
                tooltip: 'Pass auth data per request (use lpm like\n                    api)'
            }
        }
    },
    debug: {
        label: 'Debugging',
        tooltip: 'Improve the info you receive from the Proxy Manager',
        fields: {
            history: {
                label: 'Log request history',
                tooltip: 'Keep track of requests made through LPM, view\n                    through UI or download from UI'
            },
            ssl: {
                label: 'Enable SSL analyzing',
                tooltip: 'Allow the proxy manager to read HTTPS requests'
            },
            log: {
                label: 'Log level',
                tooltip: 'Decide which data to show in logs'
            },
            debug: {
                label: 'Luminati request debug info',
                tooltip: 'Send debug info on every request'
            }
        }
    },
    general: {
        label: 'General',
        tooltip: '',
        fields: {
            iface: {
                label: 'Interface',
                tooltip: 'Specify a network interface for the machine to use'
            },
            multiply: {
                label: 'Multiply',
                tooltip: 'Create multiple identical ports'
            },
            socks: {
                label: 'SOCKS 5 port',
                tooltip: 'In addition to current port, creates a separate port\n                    with a socks5 server (input should be the SOCKS port\n                    number)'
            },
            secure_proxy: {
                label: 'SSL to super proxy',
                tooltip: 'Encrypt requests sent to super proxy to avoid\n                    detection on DNS'
            },
            null_response: {
                label: 'URL regex pattern for null response',
                tooltip: 'on this url pattern, lpm will return a "null\n                    response" without proxying (usefull when users don\'t want\n                    to make a request, but a browser expects 200 response)'
            },
            bypass_proxy: {
                label: 'URL regex for bypassing the proxy manager and send\n                    directly to host',
                tooltip: 'Insert URL pattern for which requests will be passed \n                    directly to target site without any proxy\n                    (super proxy or peer)'
            },
            direct_include: {
                label: 'URL regex for requests to be sent directly from super\n                    proxy',
                tooltip: 'Insert URL pattern for which requests will be passed \n                    through super proxy directly (not through peers)'
            },
            direct_exclude: {
                label: 'URL regex for requests to not be sent directly from\n                    super proxy',
                tooltip: 'Insert URL pattern for which requests will NOT be\n                    passed through super proxy'
            }
        }
    }
};

var Index = function (_React$Component) {
    _inherits(Index, _React$Component);

    function Index(props) {
        _classCallCheck(this, Index);

        var _this2 = _possibleConstructorReturn(this, (Index.__proto__ || Object.getPrototypeOf(Index)).call(this, props));

        _this2.sp = (0, _etask2.default)('Index', /*#__PURE__*/_regeneratorRuntime2.default.mark(function _callee() {
            return _regeneratorRuntime2.default.wrap(function _callee$(_context) {
                while (1) {
                    switch (_context.prev = _context.next) {
                        case 0:
                            _context.next = 2;
                            return this.wait();

                        case 2:
                        case 'end':
                            return _context.stop();
                    }
                }
            }, _callee, this);
        }));
        _this2.state = { tab: 'target', cities: {}, form: { zones: {} },
            warnings: [], errors: {}, show_loader: false, consts: {} };
        return _this2;
    }

    _createClass(Index, [{
        key: 'componentWillMount',
        value: function componentWillMount() {
            var url_o = _url2.default.parse(document.location.href);
            var qs_o = _url2.default.qs_parse((url_o.search || '').substr(1));
            if (qs_o.field) this.set_init_focus(qs_o.field);
            var _this = this;
            this.sp.spawn((0, _etask2.default)( /*#__PURE__*/_regeneratorRuntime2.default.mark(function _callee2() {
                var locations, form, presets, consts, defaults, proxies, www_presets, port, proxy, preset;
                return _regeneratorRuntime2.default.wrap(function _callee2$(_context2) {
                    while (1) {
                        switch (_context2.prev = _context2.next) {
                            case 0:
                                _this.setState({ show_loader: true });
                                _context2.next = 3;
                                return _ajax2.default.json({ url: '/api/all_locations' });

                            case 3:
                                locations = _context2.sent;
                                form = void 0, presets = void 0, consts = void 0, defaults = void 0;

                                if (_this.props.extra.proxy) {
                                    _context2.next = 23;
                                    break;
                                }

                                _context2.next = 8;
                                return _ajax2.default.json({ url: '/api/consts' });

                            case 8:
                                consts = _context2.sent;
                                _context2.next = 11;
                                return _ajax2.default.json({ url: '/api/defaults' });

                            case 11:
                                defaults = _context2.sent;
                                _context2.next = 14;
                                return _ajax2.default.json({ url: '/api/proxies' });

                            case 14:
                                proxies = _context2.sent;
                                _context2.next = 17;
                                return _ajax2.default.json({ url: '/api/www_lpm' });

                            case 17:
                                www_presets = _context2.sent;

                                presets = (0, _common.combine_presets)(www_presets);
                                port = window.location.pathname.split('/').slice(-1)[0];

                                form = proxies.filter(function (p) {
                                    return p.port == port;
                                })[0];
                                _context2.next = 28;
                                break;

                            case 23:
                                proxy = _this.props.extra.proxy;

                                consts = _this.props.extra.consts;
                                defaults = _this.props.extra.defaults;
                                presets = _this.props.extra.presets;
                                form = Object.assign({}, proxy);

                            case 28:
                                preset = _this.guess_preset(form, presets);

                                _this.apply_preset(form, preset, presets);
                                _this.setState({ consts: consts, defaults: defaults, show_loader: false,
                                    presets: presets, locations: locations });

                            case 31:
                            case 'end':
                                return _context2.stop();
                        }
                    }
                }, _callee2, this);
            })));
        }
    }, {
        key: 'componentDidMount',
        value: function componentDidMount() {
            (0, _jquery2.default)('[data-toggle="tooltip"]').tooltip();
        }
    }, {
        key: 'componentWillUnmount',
        value: function componentWillUnmount() {
            this.sp.return();
        }
    }, {
        key: 'set_init_focus',
        value: function set_init_focus(field) {
            this.init_focus = field;
            var tab = void 0;
            var _iteratorNormalCompletion = true;
            var _didIteratorError = false;
            var _iteratorError = undefined;

            try {
                for (var _iterator = Object.entries(tabs)[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
                    var _step$value = _slicedToArray(_step.value, 2),
                        tab_id = _step$value[0],
                        tab_o = _step$value[1];

                    if (Object.keys(tab_o.fields).includes(field)) {
                        tab = tab_id;
                        break;
                    }
                }
            } catch (err) {
                _didIteratorError = true;
                _iteratorError = err;
            } finally {
                try {
                    if (!_iteratorNormalCompletion && _iterator.return) {
                        _iterator.return();
                    }
                } finally {
                    if (_didIteratorError) {
                        throw _iteratorError;
                    }
                }
            }

            if (tab) this.setState({ tab: tab });
        }
    }, {
        key: 'guess_preset',
        value: function guess_preset(form, presets) {
            var res = void 0;
            for (var p in presets) {
                var preset = presets[p];
                if (preset.check(form)) {
                    res = p;
                    break;
                }
            }
            if (form.last_preset_applied && presets[form.last_preset_applied]) res = form.last_preset_applied;
            return res;
        }
    }, {
        key: 'click_tab',
        value: function click_tab(tab) {
            this.setState({ tab: tab });
            ga_event('categories', 'click', tab);
        }
    }, {
        key: 'field_changed',
        value: function field_changed(field_name, value) {
            this.setState(function (prev_state) {
                return { form: _extends({}, prev_state.form, _defineProperty({}, field_name, value)) };
            });
            this.send_ga(field_name);
        }
    }, {
        key: 'send_ga',
        value: function send_ga(id) {
            if (id == 'zone') {
                ga_event('top bar', 'edit field', id);
                return;
            }
            var tab_label = void 0;
            for (var t in tabs) {
                if (Object.keys(tabs[t].fields).includes(id)) {
                    tab_label = tabs[t].label;
                    break;
                }
            }
            ga_event(tab_label, 'edit field', id, { single: true });
        }
    }, {
        key: 'is_valid_field',
        value: function is_valid_field(field_name) {
            var proxy = this.state.consts.proxy;
            var form = this.state.form;
            if (!proxy) return false;
            var zone = form.zone || proxy.zone.def;
            if (['city', 'state'].includes(field_name) && (!form.country || form.country == '*')) {
                return false;
            }
            var details = proxy.zone.values.filter(function (z) {
                return z.value == zone;
            })[0];
            var permissions = details && details.perm.split(' ') || [];
            if (field_name == 'vip') {
                var plan = details && details.plans[details.plans.length - 1] || {};
                return !!plan.vip;
            }
            if (['country', 'state', 'city', 'asn', 'ip'].includes(field_name)) return permissions.includes(field_name);
            return true;
        }
    }, {
        key: 'apply_preset',
        value: function apply_preset(_form, preset, presets) {
            var form = Object.assign({}, _form);
            var last_preset = form.last_preset_applied ? presets[form.last_preset_applied] : null;
            if (last_preset && last_preset.clean) last_preset.clean(form);
            form.preset = preset;
            form.last_preset_applied = preset;
            presets[preset].set(form);
            if (form.session === true) {
                form.session_random = true;
                form.session = '';
            } else form.session_random = false;
            if (form.rule) {
                form.status_code = form.rule.status;
                form.status_custom = form.rule.custom;
                form.trigger_regex = form.rule.url;
                if (form.rule.action) {
                    form.action = form.rule.action.value;
                    form.trigger_type = 'status';
                }
            }
            if (form.reverse_lookup_dns) form.reverse_lookup = 'dns';else if (form.reverse_lookup_file) form.reverse_lookup = 'file';else if (form.reverse_lookup_values) {
                form.reverse_lookup = 'values';
                form.reverse_lookup_values = form.reverse_lookup_values.join('\n');
            }
            form.whitelist_ips = (form.whitelist_ips || []).join(',');
            if (form.city && !Array.isArray(form.city) && form.state) form.city = [{ id: form.city,
                label: form.city + ' (' + form.state + ')' }];else if (!Array.isArray(form.city)) form.city = [];
            this.setState({ form: form });
        }
    }, {
        key: 'default_opt',
        value: function default_opt(option) {
            var default_label = !!this.state.defaults[option] ? 'Yes' : 'No';
            return [{ key: 'No', value: false }, { key: 'Default (' + default_label + ')', value: '' }, { key: 'Yes', value: true }];
        }
    }, {
        key: 'set_errors',
        value: function set_errors(_errors) {
            var errors = _errors.reduce(function (acc, e) {
                return Object.assign(acc, _defineProperty({}, e.field, e.msg));
            }, {});
            this.setState({ errors: errors, error_list: _errors });
        }
    }, {
        key: 'save_from_modal',
        value: function save_from_modal() {
            var _this = this;
            return (0, _etask2.default)( /*#__PURE__*/_regeneratorRuntime2.default.mark(function _callee3() {
                var data;
                return _regeneratorRuntime2.default.wrap(function _callee3$(_context3) {
                    while (1) {
                        switch (_context3.prev = _context3.next) {
                            case 0:
                                data = _this.prepare_to_save();
                                _context3.next = 3;
                                return _this.persist(data);

                            case 3:
                            case 'end':
                                return _context3.stop();
                        }
                    }
                }, _callee3, this);
            }));
        }
    }, {
        key: 'persist',
        value: function persist(data) {
            this.setState({ show_loader: true });
            var update_url = '/api/proxies/' + this.props.port;
            var _this = this;
            return (0, _etask2.default)( /*#__PURE__*/_regeneratorRuntime2.default.mark(function _callee4() {
                var raw_update;
                return _regeneratorRuntime2.default.wrap(function _callee4$(_context4) {
                    while (1) {
                        switch (_context4.prev = _context4.next) {
                            case 0:
                                _context4.next = 2;
                                return window.fetch(update_url, {
                                    method: 'PUT',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ proxy: data })
                                });

                            case 2:
                                raw_update = _context4.sent;

                                _this.setState({ show_loader: false });
                                ga_event('top bar', 'click save', 'successful');
                                window.location = '/';

                            case 6:
                            case 'end':
                                return _context4.stop();
                        }
                    }
                }, _callee4, this);
            }));
        }
    }, {
        key: 'save',
        value: function save() {
            var data = this.prepare_to_save();
            var check_url = '/api/proxy_check/' + this.props.port;
            this.setState({ show_loader: true });
            var _this = this;
            this.sp.spawn((0, _etask2.default)( /*#__PURE__*/_regeneratorRuntime2.default.mark(function _callee5() {
                var raw_check, json_check, errors, warnings;
                return _regeneratorRuntime2.default.wrap(function _callee5$(_context5) {
                    while (1) {
                        switch (_context5.prev = _context5.next) {
                            case 0:
                                this.on('uncaught', function (e) {
                                    console.log(e);
                                    _this.setState({ show_loader: false });
                                });
                                _context5.next = 3;
                                return window.fetch(check_url, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify(data)
                                });

                            case 3:
                                raw_check = _context5.sent;
                                _context5.next = 6;
                                return raw_check.json();

                            case 6:
                                json_check = _context5.sent;
                                errors = json_check.filter(function (e) {
                                    return e.lvl == 'err';
                                });

                                _this.set_errors(errors);
                                _this.setState({ show_loader: false });

                                if (!errors.length) {
                                    _context5.next = 14;
                                    break;
                                }

                                ga_event('top bar', 'click save', 'failed');
                                (0, _jquery2.default)('#save_proxy_errors').modal('show');
                                return _context5.abrupt('return');

                            case 14:
                                warnings = json_check.filter(function (w) {
                                    return w.lvl == 'warn';
                                });

                                if (!warnings.length) {
                                    _context5.next = 20;
                                    break;
                                }

                                _this.setState({ warnings: warnings });
                                (0, _jquery2.default)('#save_proxy_warnings').modal('show');
                                _context5.next = 22;
                                break;

                            case 20:
                                _context5.next = 22;
                                return _this.persist(data);

                            case 22:
                            case 'end':
                                return _context5.stop();
                        }
                    }
                }, _callee5, this);
            })));
        }
    }, {
        key: 'prepare_to_save',
        value: function prepare_to_save() {
            var _this3 = this;

            var save_form = Object.assign({}, this.state.form);
            for (var field in save_form) {
                if (!this.is_valid_field(field) || save_form[field] === null) save_form[field] = '';
            }
            var effective = function effective(attr) {
                return save_form[attr] === undefined ? _this3.state.defaults[attr] : save_form[attr];
            };
            if (save_form.session_random) save_form.session = true;
            save_form.history = effective('history');
            save_form.ssl = effective('ssl');
            save_form.max_requests = effective('max_requests');
            save_form.session_duration = effective('session_duration');
            save_form.keep_alive = effective('keep_alive');
            save_form.pool_size = effective('pool_size');
            save_form.proxy_type = 'persist';
            var action_raw = save_form.action == 'retry' ? { ban_ip: "60min", retry: true } : {};
            save_form.action = {
                label: "Retry request(up to 20 times)",
                raw: action_raw,
                value: save_form.action
            };
            var rule_status = save_form.status_code == 'Custom' ? save_form.status_custom : save_form.status_code;
            save_form.rules = {};
            save_form.rule = {};
            if (save_form.trigger_type) {
                save_form.rule = {
                    url: save_form.trigger_regex || '**',
                    action: save_form.action || {},
                    status: save_form.status_code
                };
                if (save_form.rule.status == 'Custom') save_form.rule.custom = save_form.status_custom;
                save_form.rules = {
                    post: [{
                        res: [{
                            head: true,
                            status: {
                                type: 'in',
                                arg: rule_status || ''
                            },
                            action: action_raw
                        }],
                        url: save_form.trigger_regex + '/**'
                    }]
                };
            }
            delete save_form.trigger_type;
            delete save_form.status_code;
            delete save_form.status_custom;
            delete save_form.trigger_regex;
            delete save_form.action;
            if (save_form.reverse_lookup == 'dns') save_form.reverse_lookup_dns = true;else save_form.reverse_lookup_dns = '';
            if (save_form.reverse_lookup != 'file') save_form.reverse_lookup_file = '';
            if (save_form.reverse_lookup == 'values') {
                save_form.reverse_lookup_values = save_form.reverse_lookup_values.split('\n');
            } else save_form.reverse_lookup_values = '';
            delete save_form.reverse_lookup;
            save_form.whitelist_ips = save_form.whitelist_ips.split(',').filter(Boolean);
            if (save_form.delete_rules) save_form.rules = {};
            delete save_form.delete_rules;
            this.state.presets[save_form.preset].set(save_form);
            delete save_form.preset;
            if (save_form.city.length) save_form.city = save_form.city[0].id;else save_form.city = '';
            return save_form;
        }
    }, {
        key: 'render',
        value: function render() {
            var Main_window = void 0;
            switch (this.state.tab) {
                case 'target':
                    Main_window = Targeting;break;
                case 'speed':
                    Main_window = Speed;break;
                case 'rules':
                    Main_window = Rules;break;
                case 'rotation':
                    Main_window = Rotation;break;
                case 'debug':
                    Main_window = Debug;break;
                case 'general':
                    Main_window = General;break;
            }
            if (!this.state.consts.proxy) Main_window = function Main_window() {
                return null;
            };
            var support = this.state.presets && this.state.form.preset && this.state.presets[this.state.form.preset].support || {};
            var zones = this.state.consts.proxy && this.state.consts.proxy.zone.values || [];
            return _react2.default.createElement(
                'div',
                { className: 'lpm edit_proxy' },
                _react2.default.createElement(_common.Loader, { show: this.state.show_loader }),
                _react2.default.createElement(
                    'h3',
                    null,
                    'Edit port ',
                    this.props.port
                ),
                _react2.default.createElement(Nav, { zones: zones,
                    form: this.state.form, presets: this.state.presets,
                    on_change_field: this.field_changed.bind(this),
                    on_change_preset: this.apply_preset.bind(this),
                    save: this.save.bind(this) }),
                _react2.default.createElement(Nav_tabs, { curr_tab: this.state.tab, form: this.state.form,
                    on_tab_click: this.click_tab.bind(this),
                    errors: this.state.errors }),
                _react2.default.createElement(Main_window, { proxy: this.state.consts.proxy,
                    locations: this.state.locations,
                    cities: this.state.cities, states: this.state.states,
                    defaults: this.state.defaults, form: this.state.form,
                    init_focus: this.init_focus,
                    is_valid_field: this.is_valid_field.bind(this),
                    on_change_field: this.field_changed.bind(this),
                    support: support, errors: this.state.errors,
                    default_opt: this.default_opt.bind(this) }),
                _react2.default.createElement(
                    _common.Modal,
                    { className: 'warnings_modal', id: 'save_proxy_warnings',
                        title: 'Warnings:', click_ok: this.save_from_modal.bind(this) },
                    _react2.default.createElement(Warnings, { warnings: this.state.warnings })
                ),
                _react2.default.createElement(
                    _common.Modal,
                    { className: 'warnings_modal', id: 'save_proxy_errors',
                        title: 'Errors:', no_cancel_btn: true },
                    _react2.default.createElement(Warnings, { warnings: this.state.error_list })
                )
            );
        }
    }]);

    return Index;
}(_react2.default.Component);

var Warnings = function Warnings(props) {
    return _react2.default.createElement(
        'div',
        null,
        (props.warnings || []).map(function (w, i) {
            return _react2.default.createElement(Warning, { key: i, text: w.msg });
        })
    );
};

var Warning = function Warning(props) {
    return _react2.default.createElement(
        'div',
        { className: 'warning' },
        _react2.default.createElement('div', { className: 'warning_icon' }),
        _react2.default.createElement(
            'div',
            { className: 'text' },
            props.text
        )
    );
};

var Nav = function Nav(props) {
    var update_preset = function update_preset(val) {
        props.on_change_preset(props.form, val, props.presets);
        ga_event('top bar', 'edit field', 'preset');
    };
    var update_zone = function update_zone(val) {
        return props.on_change_field('zone', val);
    };
    var presets_opt = Object.keys(props.presets || {}).map(function (p) {
        return { key: props.presets[p].title, value: p };
    });
    return _react2.default.createElement(
        'div',
        { className: 'nav' },
        _react2.default.createElement(Field, { on_change: update_zone, options: props.zones, label: 'Zone',
            value: props.form.zone }),
        _react2.default.createElement(Field, { on_change: update_preset, label: 'Preset', options: presets_opt,
            value: props.form.preset }),
        _react2.default.createElement(Action_buttons, { save: props.save })
    );
};

var Field = function Field(props) {
    var options = props.options || [];
    return _react2.default.createElement(
        'div',
        { className: 'field' },
        _react2.default.createElement(
            'div',
            { className: 'title' },
            props.label
        ),
        _react2.default.createElement(
            'select',
            { value: props.value,
                onChange: function onChange(e) {
                    return props.on_change(e.target.value);
                } },
            options.map(function (o) {
                return _react2.default.createElement(
                    'option',
                    { key: o.key, value: o.value },
                    o.key
                );
            })
        )
    );
};

var Action_buttons = function (_React$Component2) {
    _inherits(Action_buttons, _React$Component2);

    function Action_buttons() {
        _classCallCheck(this, Action_buttons);

        return _possibleConstructorReturn(this, (Action_buttons.__proto__ || Object.getPrototypeOf(Action_buttons)).apply(this, arguments));
    }

    _createClass(Action_buttons, [{
        key: 'cancel_clicked',
        value: function cancel_clicked() {
            ga_event('top bar', 'cancel');
        }
    }, {
        key: 'save_clicked',
        value: function save_clicked() {
            this.props.save();
        }
    }, {
        key: 'render',
        value: function render() {
            return _react2.default.createElement(
                'div',
                { className: 'action_buttons' },
                _react2.default.createElement(
                    'a',
                    { href: '/proxies', onClick: this.cancel_clicked.bind(this),
                        className: 'btn btn_lpm btn_lpm_normal btn_cancel' },
                    'Cancel'
                ),
                _react2.default.createElement(
                    'button',
                    { className: 'btn btn_lpm btn_save',
                        onClick: this.save_clicked.bind(this) },
                    'Save'
                )
            );
        }
    }]);

    return Action_buttons;
}(_react2.default.Component);

var Nav_tabs = function Nav_tabs(props) {
    return _react2.default.createElement(
        'div',
        { className: 'nav_tabs' },
        _react2.default.createElement(Tab_btn, _extends({}, props, { id: 'target' })),
        _react2.default.createElement(Tab_btn, _extends({}, props, { id: 'speed' })),
        _react2.default.createElement(Tab_btn, _extends({}, props, { id: 'rules' })),
        _react2.default.createElement(Tab_btn, _extends({}, props, { id: 'rotation' })),
        _react2.default.createElement(Tab_btn, _extends({}, props, { id: 'debug' })),
        _react2.default.createElement(Tab_btn, _extends({}, props, { id: 'general' }))
    );
};

var Tab_btn = function Tab_btn(props) {
    var btn_class = (0, _classnames2.default)('btn_tab', { active: props.curr_tab == props.id });
    var tab_fields = Object.keys(tabs[props.id].fields);
    var changes = Object.keys(props.form).filter(function (f) {
        var val = props.form[f];
        var is_empty_arr = Array.isArray(val) && !val[0];
        return tab_fields.includes(f) && val && !is_empty_arr;
    }).length;
    var errors = Object.keys(props.errors).filter(function (f) {
        return tab_fields.includes(f);
    });
    return _react2.default.createElement(
        'div',
        { onClick: function onClick() {
                return props.on_tab_click(props.id);
            },
            className: btn_class },
        _react2.default.createElement(Tab_icon, { id: props.id, changes: changes,
            error: errors.length }),
        _react2.default.createElement(
            'div',
            { className: 'title' },
            tabs[props.id].label
        ),
        _react2.default.createElement('div', { className: 'arrow' }),
        _react2.default.createElement(Tooltip_icon, { title: tabs[props.id].tooltip })
    );
};

var Tab_icon = function Tab_icon(props) {
    var circle_class = (0, _classnames2.default)('circle_wrapper', {
        active: props.error || props.changes, error: props.error });
    var content = props.error ? '!' : props.changes;
    return _react2.default.createElement(
        'div',
        { className: (0, _classnames2.default)('icon', props.id) },
        _react2.default.createElement(
            'div',
            { className: circle_class },
            _react2.default.createElement(
                'div',
                { className: 'circle' },
                content
            )
        )
    );
};

var Tooltip_icon = function Tooltip_icon(props) {
    return props.title ? _react2.default.createElement('div', { className: 'info', 'data-toggle': 'tooltip',
        'data-placement': 'bottom', title: props.title }) : null;
};

var Section_header = function Section_header(props) {
    return props.text ? _react2.default.createElement(
        'div',
        { className: 'header' },
        props.text
    ) : null;
};

var Section = function (_React$Component3) {
    _inherits(Section, _React$Component3);

    function Section(props) {
        _classCallCheck(this, Section);

        var _this5 = _possibleConstructorReturn(this, (Section.__proto__ || Object.getPrototypeOf(Section)).call(this, props));

        _this5.state = { focused: false };
        return _this5;
    }

    _createClass(Section, [{
        key: 'on_focus',
        value: function on_focus() {
            if (!this.props.disabled) this.setState({ focused: true });
        }
    }, {
        key: 'on_blur',
        value: function on_blur() {
            this.setState({ focused: false });
        }
    }, {
        key: 'render',
        value: function render() {
            var error = !!this.props.error_msg;
            var dynamic_class = {
                error: error,
                correct: this.props.correct && !error,
                active: this.state.focused && !error,
                disabled: this.props.disabled
            };
            var message = this.props.error_msg ? this.props.error_msg : tabs[this.props.tab_id].fields[this.props.id].tooltip;
            return _react2.default.createElement(
                'div',
                { tabIndex: '0', onFocus: this.on_focus.bind(this), autoFocus: true,
                    onBlur: this.on_blur.bind(this), className: 'section_wrapper' },
                _react2.default.createElement(
                    'div',
                    { className: (0, _classnames2.default)('outlined', dynamic_class) },
                    _react2.default.createElement(Section_header, { text: this.props.header }),
                    _react2.default.createElement(
                        'div',
                        { className: 'section_body' },
                        this.props.children
                    ),
                    _react2.default.createElement('div', { className: 'icon' }),
                    _react2.default.createElement('div', { className: 'arrow' })
                ),
                _react2.default.createElement(
                    'div',
                    { className: 'message_wrapper' },
                    _react2.default.createElement(
                        'div',
                        { className: (0, _classnames2.default)('message', dynamic_class) },
                        message
                    )
                )
            );
        }
    }]);

    return Section;
}(_react2.default.Component);

var Select = function Select(props) {
    return _react2.default.createElement(
        'select',
        { value: props.val,
            onChange: function onChange(e) {
                return props.on_change_wrapper(e.target.value);
            },
            disabled: props.disabled },
        (props.data || []).map(function (c, i) {
            return _react2.default.createElement(
                'option',
                { key: i, value: c.value },
                c.key
            );
        })
    );
};

var Textarea = function Textarea(props) {
    return _react2.default.createElement('textarea', { value: props.val, rows: '3', placeholder: props.placeholder,
        onChange: function onChange(e) {
            return props.on_change_wrapper(e.target.value);
        } });
};

var Input = function Input(props) {
    var update = function update(val) {
        if (props.type == 'number' && val) val = Number(val);
        props.on_change_wrapper(val, props.id);
    };
    return _react2.default.createElement('input', { type: props.type, value: props.val, disabled: props.disabled,
        onChange: function onChange(e) {
            return update(e.target.value);
        }, className: props.className,
        min: props.min, max: props.max, placeholder: props.placeholder });
};

var Double_number = function Double_number(props) {
    var vals = ('' + props.val).split(':');
    var update = function update(start, end) {
        props.on_change_wrapper([start, end].join(':'));
    };
    return _react2.default.createElement(
        'span',
        { className: 'double_field' },
        _react2.default.createElement(Input, _extends({}, props, { val: vals[0] || '', id: props.id + '_start',
            type: 'number', disabled: props.disabled,
            on_change_wrapper: function on_change_wrapper(val) {
                return update(val, vals[1]);
            } })),
        _react2.default.createElement(
            'span',
            { className: 'divider' },
            '\xF7'
        ),
        _react2.default.createElement(Input, _extends({}, props, { val: vals[1] || '', id: props.id + '_end',
            type: 'number', disabled: props.disabled,
            on_change_wrapper: function on_change_wrapper(val) {
                return update(vals[0], val);
            } }))
    );
};

var Input_boolean = function Input_boolean(props) {
    return _react2.default.createElement(
        'div',
        { className: 'radio_buttons' },
        _react2.default.createElement(
            'div',
            { className: 'option' },
            _react2.default.createElement('input', { type: 'radio', checked: props.val == '1',
                onChange: function onChange(e) {
                    return props.on_change_wrapper(e.target.value);
                }, id: 'enable',
                name: props.id, value: '1', disabled: props.disabled }),
            _react2.default.createElement('div', { className: 'checked_icon' }),
            _react2.default.createElement(
                'label',
                { htmlFor: 'enable' },
                'Enabled'
            )
        ),
        _react2.default.createElement(
            'div',
            { className: 'option' },
            _react2.default.createElement('input', { type: 'radio', checked: props.val == '0',
                onChange: function onChange(e) {
                    return props.on_change_wrapper(e.target.value);
                }, id: 'disable',
                name: props.id, value: '0', disabled: props.disabled }),
            _react2.default.createElement('div', { className: 'checked_icon' }),
            _react2.default.createElement(
                'label',
                { htmlFor: 'disable' },
                'Disabled'
            )
        )
    );
};

var Typeahead_wrapper = function Typeahead_wrapper(props) {
    return _react2.default.createElement(_reactBootstrapTypeahead.Typeahead, { options: props.data, maxResults: 10,
        minLength: 1, disabled: props.disabled, selectHintOnEnter: true,
        onChange: props.on_change_wrapper, selected: props.val });
};

var Section_with_fields = function Section_with_fields(props) {
    var id = props.id,
        form = props.form,
        tab_id = props.tab_id,
        header = props.header,
        errors = props.errors,
        init_focus = props.init_focus;

    var disabled = props.disabled || !props.is_valid_field(id);
    var is_empty_arr = Array.isArray(form[id]) && !form[id][0];
    var correct = form[id] && form[id] != '*' && !is_empty_arr;
    var error_msg = errors[id];
    return _react2.default.createElement(
        Section,
        { correct: correct, disabled: disabled, id: id, tab_id: tab_id,
            header: header, error_msg: error_msg, init_focus: init_focus },
        _react2.default.createElement(Section_field, _extends({}, props, { disabled: disabled, correct: correct }))
    );
};

var Section_field = function Section_field(props) {
    var tab_id = props.tab_id,
        id = props.id,
        form = props.form,
        sufix = props.sufix,
        note = props.note,
        type = props.type,
        disabled = props.disabled,
        data = props.data,
        on_change = props.on_change,
        on_change_field = props.on_change_field,
        min = props.min,
        max = props.max;

    var on_change_wrapper = function on_change_wrapper(value, _id) {
        var curr_id = _id || id;
        if (on_change) on_change(value);
        on_change_field(curr_id, value);
    };
    var Comp = void 0;
    switch (type) {
        case 'select':
            Comp = Select;break;
        case 'boolean':
            Comp = Input_boolean;break;
        case 'double_number':
            Comp = Double_number;break;
        case 'typeahead':
            Comp = Typeahead_wrapper;break;
        case 'textarea':
            Comp = Textarea;break;
        default:
            Comp = Input;
    }
    var val = form[id] || '';
    var placeholder = tabs[tab_id].fields[id].placeholder || '';
    return _react2.default.createElement(
        'div',
        { className: 'field_row' },
        _react2.default.createElement(
            'div',
            { className: 'desc' },
            tabs[tab_id].fields[id].label
        ),
        _react2.default.createElement(
            'div',
            { className: 'field' },
            _react2.default.createElement(
                'div',
                { className: 'inline_field' },
                _react2.default.createElement(Comp, { form: form, id: id, data: data, type: type,
                    on_change_wrapper: on_change_wrapper, val: val,
                    disabled: disabled, min: min, max: max,
                    placeholder: placeholder }),
                sufix ? _react2.default.createElement(
                    'span',
                    { className: 'sufix' },
                    sufix
                ) : null
            ),
            note ? _react2.default.createElement(
                Note,
                null,
                note
            ) : null
        )
    );
};

var With_data = function (_React$Component4) {
    _inherits(With_data, _React$Component4);

    function With_data() {
        _classCallCheck(this, With_data);

        return _possibleConstructorReturn(this, (With_data.__proto__ || Object.getPrototypeOf(With_data)).apply(this, arguments));
    }

    _createClass(With_data, [{
        key: 'wrapped_children',
        value: function wrapped_children() {
            var props = Object.assign({}, this.props);
            delete props.children;
            return _react2.default.Children.map(this.props.children, function (child) {
                return _react2.default.cloneElement(child, props);
            });
        }
    }, {
        key: 'render',
        value: function render() {
            return _react2.default.createElement(
                'div',
                null,
                this.wrapped_children()
            );
        }
    }]);

    return With_data;
}(_react2.default.Component);

var Targeting = function (_React$Component5) {
    _inherits(Targeting, _React$Component5);

    function Targeting(props) {
        _classCallCheck(this, Targeting);

        var _this7 = _possibleConstructorReturn(this, (Targeting.__proto__ || Object.getPrototypeOf(Targeting)).call(this, props));

        _this7.def_value = { key: 'Any (default)', value: '' };
        return _this7;
    }

    _createClass(Targeting, [{
        key: 'allowed_countries',
        value: function allowed_countries() {
            var res = this.props.locations.countries.map(function (c) {
                return { key: c.country_name, value: c.country_id };
            });
            return [this.def_value].concat(_toConsumableArray(res));
        }
    }, {
        key: 'country_changed',
        value: function country_changed() {
            this.props.on_change_field('city', []);
            this.props.on_change_field('state', '');
        }
    }, {
        key: 'states',
        value: function states() {
            var country = this.props.form.country;
            if (!country) return [];
            var res = this.props.locations.regions[country].map(function (r) {
                return { key: r.region_name, value: r.region_id };
            });
            return [this.def_value].concat(_toConsumableArray(res));
        }
    }, {
        key: 'state_changed',
        value: function state_changed() {
            this.props.on_change_field('city', []);
        }
    }, {
        key: 'cities',
        value: function cities() {
            var _props$form = this.props.form,
                country = _props$form.country,
                state = _props$form.state;

            var res = void 0;
            if (!country) return [];
            res = this.props.locations.cities.filter(function (c) {
                return c.country_id == country;
            });
            if (state) res = res.filter(function (c) {
                return c.region_id == state;
            });
            var regions = this.states();
            res = res.map(function (c) {
                var region = regions.filter(function (r) {
                    return r.value == c.region_id;
                })[0];
                return { label: c.city_name + ' (' + region.value + ')', id: c.city_name,
                    region: region.value };
            });
            return res;
        }
    }, {
        key: 'city_changed',
        value: function city_changed(e) {
            if (e && e.length) this.props.on_change_field('state', e[0].region);
        }
    }, {
        key: 'country_disabled',
        value: function country_disabled() {
            var zone_name = this.props.form.zone || 'static';
            var zones = this.props.proxy.zone.values;
            var curr_zone = zones.filter(function (p) {
                return p.key == zone_name;
            });
            var curr_plan = void 0;
            if (curr_zone.length) curr_plan = curr_zone[0].plans.slice(-1)[0];
            return curr_plan && curr_plan.type == 'static';
        }
    }, {
        key: 'render',
        value: function render() {
            return _react2.default.createElement(
                With_data,
                _extends({}, this.props, { tab_id: 'target' }),
                _react2.default.createElement(
                    Note,
                    null,
                    _react2.default.createElement(
                        'span',
                        null,
                        'To change Data Center country visit your '
                    ),
                    _react2.default.createElement(
                        'a',
                        { target: '_blank', rel: 'noopener noreferrer',
                            href: 'https://luminati.io/cp/zones' },
                        'zone page'
                    ),
                    _react2.default.createElement(
                        'span',
                        null,
                        ' and change your zone plan.'
                    )
                ),
                _react2.default.createElement(Section_with_fields, { type: 'select', id: 'country',
                    data: this.allowed_countries(),
                    on_change: this.country_changed.bind(this),
                    disabled: this.country_disabled() }),
                _react2.default.createElement(Section_with_fields, { type: 'select', id: 'state',
                    data: this.states(),
                    on_change: this.state_changed.bind(this) }),
                _react2.default.createElement(Section_with_fields, { type: 'typeahead', id: 'city',
                    data: this.cities(),
                    on_change: this.city_changed.bind(this) }),
                _react2.default.createElement(Section_with_fields, { type: 'number', id: 'asn' })
            );
        }
    }]);

    return Targeting;
}(_react2.default.Component);

var Speed = function (_React$Component6) {
    _inherits(Speed, _React$Component6);

    function Speed(props) {
        _classCallCheck(this, Speed);

        var _this8 = _possibleConstructorReturn(this, (Speed.__proto__ || Object.getPrototypeOf(Speed)).call(this, props));

        _this8.dns_options = [{ key: 'Local (default) - resolved by the super proxy',
            value: 'local' }, { key: 'Remote - resolved by peer', value: 'remote' }];
        _this8.reverse_lookup_options = [{ key: 'No', value: '' }, { key: 'DNS', value: 'dns' }, { key: 'File', value: 'file' }, { key: 'Values', value: 'values' }];
        return _this8;
    }

    _createClass(Speed, [{
        key: 'render',
        value: function render() {
            return _react2.default.createElement(
                With_data,
                _extends({}, this.props, { tab_id: 'speed' }),
                _react2.default.createElement(Section_with_fields, { type: 'select', id: 'dns',
                    data: this.dns_options }),
                _react2.default.createElement(Section_with_fields, { type: 'number', id: 'request_timeout',
                    sufix: 'seconds', min: '0' }),
                _react2.default.createElement(Section_with_fields, { type: 'number', id: 'session_init_timeout',
                    sufix: 'seconds', min: '0' }),
                _react2.default.createElement(Section_with_fields, { type: 'number', id: 'race_reqs', min: '1',
                    max: '3' }),
                _react2.default.createElement(Section_with_fields, { type: 'number', id: 'proxy_count', min: '1' }),
                _react2.default.createElement(Section_with_fields, { type: 'number', id: 'proxy_switch', min: '0' }),
                _react2.default.createElement(Section_with_fields, { type: 'number', id: 'throttle', min: '0' }),
                _react2.default.createElement(
                    Section,
                    { id: 'reverse_lookup' },
                    _react2.default.createElement(Section_field, _extends({ type: 'select', id: 'reverse_lookup', tab_id: 'speed'
                    }, this.props, { data: this.reverse_lookup_options })),
                    _react2.default.createElement(
                        _common.If,
                        { when: this.props.form.reverse_lookup == 'file' },
                        _react2.default.createElement(Section_field, _extends({ type: 'text', id: 'reverse_lookup_file',
                            tab_id: 'speed' }, this.props))
                    ),
                    _react2.default.createElement(
                        _common.If,
                        { when: this.props.form.reverse_lookup == 'values' },
                        _react2.default.createElement(Section_field, _extends({ type: 'textarea', id: 'reverse_lookup_values',
                            tab_id: 'speed' }, this.props))
                    )
                )
            );
        }
    }]);

    return Speed;
}(_react2.default.Component);

var Note = function Note(props) {
    return _react2.default.createElement(
        'div',
        { className: 'note' },
        _react2.default.createElement(
            'span',
            { className: 'highlight' },
            'Note:'
        ),
        _react2.default.createElement(
            'span',
            null,
            props.children
        )
    );
};

var Rules = function (_React$Component7) {
    _inherits(Rules, _React$Component7);

    function Rules(props) {
        _classCallCheck(this, Rules);

        var _this9 = _possibleConstructorReturn(this, (Rules.__proto__ || Object.getPrototypeOf(Rules)).call(this, props));

        _this9.state = { show_statuses: _this9.props.form.trigger_type == 'status',
            show_custom: _this9.props.form.status_code == 'Custom' };
        return _this9;
    }

    _createClass(Rules, [{
        key: 'type_changed',
        value: function type_changed(val) {
            if (val == 'status') this.setState({ show_statuses: true });else {
                this.setState({ show_statuses: false, show_custom: false });
                this.props.on_change_field('status_code', '');
                this.props.on_change_field('status_custom', '');
            }
            if (!val) this.props.on_change_field('trigger_regex', '');
        }
    }, {
        key: 'status_changed',
        value: function status_changed(val) {
            this.setState({ show_custom: val == 'Custom' });
            if (val != 'Custom') this.props.on_change_field('status_custom', '');
        }
    }, {
        key: 'render',
        value: function render() {
            var trigger_types = [{ key: '', value: '' }, { key: 'Status-code', value: 'status' }];
            var action_types = [{ key: '', value: '' }, { key: 'Retry request (up to 20 times)', value: 'retry' }];
            var status_types = ['', '200 - Succeeded requests', '403 - Forbidden', '404 - Not found', '500 - Internal server error', '502 - Bad gateway', '503 - Service unavailable', '504 - Gateway timeout', 'Custom'].map(function (s) {
                return { key: s, value: s };
            });
            var _props = this.props,
                form = _props.form,
                on_change_field = _props.on_change_field;

            var trigger_correct = form.trigger_type || form.trigger_regex;
            return _react2.default.createElement(
                'div',
                null,
                _react2.default.createElement(
                    'div',
                    { className: 'tab_header' },
                    'Define custom action for specific request response'
                ),
                _react2.default.createElement(
                    Note,
                    null,
                    'Rules will apply when \'SSL analyzing\' enabled (See \'Debugging\' section)'
                ),
                _react2.default.createElement(
                    With_data,
                    _extends({}, this.props, { tab_id: 'rules' }),
                    _react2.default.createElement(
                        Section,
                        { id: 'trigger_type', header: 'Trigger Type',
                            correct: trigger_correct },
                        _react2.default.createElement(Section_field, { tab_id: 'rules', id: 'trigger_type',
                            form: form, type: 'select', data: trigger_types,
                            on_change_field: on_change_field,
                            on_change: this.type_changed.bind(this) }),
                        _react2.default.createElement(
                            _common.If,
                            { when: this.state.show_statuses },
                            _react2.default.createElement(Section_field, { tab_id: 'rules', id: 'status_code',
                                form: form, type: 'select', data: status_types,
                                on_change_field: on_change_field,
                                on_change: this.status_changed.bind(this) })
                        ),
                        _react2.default.createElement(
                            _common.If,
                            { when: this.state.show_custom },
                            _react2.default.createElement(Section_field, { tab_id: 'rules', id: 'status_custom',
                                form: form, type: 'text', data: status_types,
                                on_change_field: on_change_field })
                        ),
                        _react2.default.createElement(Section_field, { tab_id: 'rules', id: 'trigger_regex',
                            form: form, type: 'text',
                            on_change_field: on_change_field })
                    ),
                    _react2.default.createElement(Section_with_fields, { type: 'select', id: 'action', header: 'Action',
                        note: 'IP will change for every entry', data: action_types,
                        on_change_field: on_change_field })
                )
            );
        }
    }]);

    return Rules;
}(_react2.default.Component);

var Ips_alloc_modal = function Ips_alloc_modal(props) {
    return _react2.default.createElement(
        _common.Modal,
        { id: 'allocated_ips', title: 'Select IPs: static' },
        _react2.default.createElement(
            'p',
            null,
            props.ips
        )
    );
};

var Rotation = function (_React$Component8) {
    _inherits(Rotation, _React$Component8);

    function Rotation(props) {
        _classCallCheck(this, Rotation);

        var _this10 = _possibleConstructorReturn(this, (Rotation.__proto__ || Object.getPrototypeOf(Rotation)).call(this, props));

        _this10.state = { ips: [] };
        return _this10;
    }

    _createClass(Rotation, [{
        key: 'open_modal',
        value: function open_modal() {
            (0, _jquery2.default)('#allocated_ips').modal('show');
        }
    }, {
        key: 'render',
        value: function render() {
            var _props2 = this.props,
                proxy = _props2.proxy,
                support = _props2.support,
                form = _props2.form,
                default_opt = _props2.default_opt;

            var pool_size_disabled = !support.pool_size || form.ips && form.ips.length;
            var pool_size_note = _react2.default.createElement(
                'a',
                { onClick: this.open_modal.bind(this) },
                'set from allocated IPs'
            );
            return _react2.default.createElement(
                With_data,
                _extends({}, this.props, { tab_id: 'rotation' }),
                _react2.default.createElement(Ips_alloc_modal, { ips: this.state.ips }),
                _react2.default.createElement(Section_with_fields, { type: 'text', id: 'ip' }),
                _react2.default.createElement(Section_with_fields, { type: 'number', id: 'pool_size', min: '0',
                    disabled: pool_size_disabled, note: pool_size_note }),
                _react2.default.createElement(Section_with_fields, { type: 'select', id: 'pool_type',
                    data: proxy.pool_type.values,
                    disabled: !support.pool_type }),
                _react2.default.createElement(Section_with_fields, { type: 'number', id: 'keep_alive', min: '0',
                    disabled: !support.keep_alive }),
                _react2.default.createElement(Section_with_fields, { type: 'text', id: 'whitelist_ips' }),
                _react2.default.createElement(Section_with_fields, { type: 'boolean', id: 'session_random',
                    disabled: !support.session }),
                _react2.default.createElement(Section_with_fields, { type: 'text', id: 'session',
                    disabled: form.session_random && !support.session }),
                _react2.default.createElement(Section_with_fields, { type: 'select', id: 'sticky_ip',
                    data: default_opt('sticky_ip'),
                    disabled: !support.sticky_ip }),
                _react2.default.createElement(Section_with_fields, { type: 'double_number', id: 'max_requests',
                    disabled: !support.max_requests }),
                _react2.default.createElement(Section_with_fields, { type: 'double_number', id: 'session_duration',
                    disabled: !support.session_duration }),
                _react2.default.createElement(Section_with_fields, { type: 'text', id: 'seed',
                    disabled: !support.seed }),
                _react2.default.createElement(Section_with_fields, { type: 'select', id: 'allow_req_auth',
                    data: default_opt('allow_proxy_auth') })
            );
        }
    }]);

    return Rotation;
}(_react2.default.Component);

var Debug = function Debug(props) {
    return _react2.default.createElement(
        With_data,
        _extends({}, props, { tab_id: 'debug' }),
        _react2.default.createElement(Section_with_fields, { type: 'select', id: 'history',
            data: props.default_opt('history') }),
        _react2.default.createElement(Section_with_fields, { type: 'select', id: 'ssl',
            data: props.default_opt('ssl') }),
        _react2.default.createElement(Section_with_fields, { type: 'select', id: 'log',
            data: props.proxy.log.values }),
        _react2.default.createElement(Section_with_fields, { type: 'select', id: 'debug',
            data: props.proxy.debug.values })
    );
};

var General = function General(props) {
    return _react2.default.createElement(
        With_data,
        _extends({}, props, { tab_id: 'general' }),
        _react2.default.createElement(Section_with_fields, { type: 'select', id: 'iface',
            data: props.proxy.iface.values }),
        _react2.default.createElement(Section_with_fields, { type: 'number', id: 'multiply', min: '1',
            disabled: !props.support.multiply }),
        _react2.default.createElement(Section_with_fields, { type: 'number', id: 'socks', min: '0' }),
        _react2.default.createElement(Section_with_fields, { type: 'select', id: 'secure_proxy',
            data: props.default_opt('secure_proxy') }),
        _react2.default.createElement(Section_with_fields, { type: 'text', id: 'null_response' }),
        _react2.default.createElement(Section_with_fields, { type: 'text', id: 'bypass_proxy' }),
        _react2.default.createElement(Section_with_fields, { type: 'text', id: 'direct_include' }),
        _react2.default.createElement(Section_with_fields, { type: 'text', id: 'direct_exclude' })
    );
};

exports.default = Index;

/***/ }),
/* 542 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.tokenContainer = exports.menuItemContainer = exports.asyncContainer = exports.Typeahead = exports.Token = exports.MenuItem = exports.Menu = exports.AsyncTypeahead = undefined;

var _AsyncTypeahead2 = __webpack_require__(543);

var _AsyncTypeahead3 = _interopRequireDefault(_AsyncTypeahead2);

var _Menu2 = __webpack_require__(295);

var _Menu3 = _interopRequireDefault(_Menu2);

var _MenuItem2 = __webpack_require__(175);

var _MenuItem3 = _interopRequireDefault(_MenuItem2);

var _Token2 = __webpack_require__(285);

var _Token3 = _interopRequireDefault(_Token2);

var _Typeahead2 = __webpack_require__(273);

var _Typeahead3 = _interopRequireDefault(_Typeahead2);

var _asyncContainer2 = __webpack_require__(271);

var _asyncContainer3 = _interopRequireDefault(_asyncContainer2);

var _menuItemContainer2 = __webpack_require__(296);

var _menuItemContainer3 = _interopRequireDefault(_menuItemContainer2);

var _tokenContainer2 = __webpack_require__(286);

var _tokenContainer3 = _interopRequireDefault(_tokenContainer2);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

exports.AsyncTypeahead = _AsyncTypeahead3.default; /* eslint-disable object-curly-spacing */

// Components

exports.Menu = _Menu3.default;
exports.MenuItem = _MenuItem3.default;
exports.Token = _Token3.default;
exports.Typeahead = _Typeahead3.default;

// HOCs

exports.asyncContainer = _asyncContainer3.default;
exports.menuItemContainer = _menuItemContainer3.default;
exports.tokenContainer = _tokenContainer3.default;

/* eslint-enable object-curly-spacing */

/***/ }),
/* 543 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, "__esModule", {
  value: true
});

var _asyncContainer = __webpack_require__(271);

var _asyncContainer2 = _interopRequireDefault(_asyncContainer);

var _Typeahead = __webpack_require__(273);

var _Typeahead2 = _interopRequireDefault(_Typeahead);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

exports.default = (0, _asyncContainer2.default)(_Typeahead2.default);

/***/ }),
/* 544 */
/***/ (function(module, exports, __webpack_require__) {

var isObject = __webpack_require__(50),
    now = __webpack_require__(545),
    toNumber = __webpack_require__(546);

/** Error message constants. */
var FUNC_ERROR_TEXT = 'Expected a function';

/* Built-in method references for those with the same name as other `lodash` methods. */
var nativeMax = Math.max,
    nativeMin = Math.min;

/**
 * Creates a debounced function that delays invoking `func` until after `wait`
 * milliseconds have elapsed since the last time the debounced function was
 * invoked. The debounced function comes with a `cancel` method to cancel
 * delayed `func` invocations and a `flush` method to immediately invoke them.
 * Provide `options` to indicate whether `func` should be invoked on the
 * leading and/or trailing edge of the `wait` timeout. The `func` is invoked
 * with the last arguments provided to the debounced function. Subsequent
 * calls to the debounced function return the result of the last `func`
 * invocation.
 *
 * **Note:** If `leading` and `trailing` options are `true`, `func` is
 * invoked on the trailing edge of the timeout only if the debounced function
 * is invoked more than once during the `wait` timeout.
 *
 * If `wait` is `0` and `leading` is `false`, `func` invocation is deferred
 * until to the next tick, similar to `setTimeout` with a timeout of `0`.
 *
 * See [David Corbacho's article](https://css-tricks.com/debouncing-throttling-explained-examples/)
 * for details over the differences between `_.debounce` and `_.throttle`.
 *
 * @static
 * @memberOf _
 * @since 0.1.0
 * @category Function
 * @param {Function} func The function to debounce.
 * @param {number} [wait=0] The number of milliseconds to delay.
 * @param {Object} [options={}] The options object.
 * @param {boolean} [options.leading=false]
 *  Specify invoking on the leading edge of the timeout.
 * @param {number} [options.maxWait]
 *  The maximum time `func` is allowed to be delayed before it's invoked.
 * @param {boolean} [options.trailing=true]
 *  Specify invoking on the trailing edge of the timeout.
 * @returns {Function} Returns the new debounced function.
 * @example
 *
 * // Avoid costly calculations while the window size is in flux.
 * jQuery(window).on('resize', _.debounce(calculateLayout, 150));
 *
 * // Invoke `sendMail` when clicked, debouncing subsequent calls.
 * jQuery(element).on('click', _.debounce(sendMail, 300, {
 *   'leading': true,
 *   'trailing': false
 * }));
 *
 * // Ensure `batchLog` is invoked once after 1 second of debounced calls.
 * var debounced = _.debounce(batchLog, 250, { 'maxWait': 1000 });
 * var source = new EventSource('/stream');
 * jQuery(source).on('message', debounced);
 *
 * // Cancel the trailing debounced invocation.
 * jQuery(window).on('popstate', debounced.cancel);
 */
function debounce(func, wait, options) {
  var lastArgs,
      lastThis,
      maxWait,
      result,
      timerId,
      lastCallTime,
      lastInvokeTime = 0,
      leading = false,
      maxing = false,
      trailing = true;

  if (typeof func != 'function') {
    throw new TypeError(FUNC_ERROR_TEXT);
  }
  wait = toNumber(wait) || 0;
  if (isObject(options)) {
    leading = !!options.leading;
    maxing = 'maxWait' in options;
    maxWait = maxing ? nativeMax(toNumber(options.maxWait) || 0, wait) : maxWait;
    trailing = 'trailing' in options ? !!options.trailing : trailing;
  }

  function invokeFunc(time) {
    var args = lastArgs,
        thisArg = lastThis;

    lastArgs = lastThis = undefined;
    lastInvokeTime = time;
    result = func.apply(thisArg, args);
    return result;
  }

  function leadingEdge(time) {
    // Reset any `maxWait` timer.
    lastInvokeTime = time;
    // Start the timer for the trailing edge.
    timerId = setTimeout(timerExpired, wait);
    // Invoke the leading edge.
    return leading ? invokeFunc(time) : result;
  }

  function remainingWait(time) {
    var timeSinceLastCall = time - lastCallTime,
        timeSinceLastInvoke = time - lastInvokeTime,
        result = wait - timeSinceLastCall;

    return maxing ? nativeMin(result, maxWait - timeSinceLastInvoke) : result;
  }

  function shouldInvoke(time) {
    var timeSinceLastCall = time - lastCallTime,
        timeSinceLastInvoke = time - lastInvokeTime;

    // Either this is the first call, activity has stopped and we're at the
    // trailing edge, the system time has gone backwards and we're treating
    // it as the trailing edge, or we've hit the `maxWait` limit.
    return (lastCallTime === undefined || (timeSinceLastCall >= wait) ||
      (timeSinceLastCall < 0) || (maxing && timeSinceLastInvoke >= maxWait));
  }

  function timerExpired() {
    var time = now();
    if (shouldInvoke(time)) {
      return trailingEdge(time);
    }
    // Restart the timer.
    timerId = setTimeout(timerExpired, remainingWait(time));
  }

  function trailingEdge(time) {
    timerId = undefined;

    // Only invoke if we have `lastArgs` which means `func` has been
    // debounced at least once.
    if (trailing && lastArgs) {
      return invokeFunc(time);
    }
    lastArgs = lastThis = undefined;
    return result;
  }

  function cancel() {
    if (timerId !== undefined) {
      clearTimeout(timerId);
    }
    lastInvokeTime = 0;
    lastArgs = lastCallTime = lastThis = timerId = undefined;
  }

  function flush() {
    return timerId === undefined ? result : trailingEdge(now());
  }

  function debounced() {
    var time = now(),
        isInvoking = shouldInvoke(time);

    lastArgs = arguments;
    lastThis = this;
    lastCallTime = time;

    if (isInvoking) {
      if (timerId === undefined) {
        return leadingEdge(lastCallTime);
      }
      if (maxing) {
        // Handle invocations in a tight loop.
        timerId = setTimeout(timerExpired, wait);
        return invokeFunc(lastCallTime);
      }
    }
    if (timerId === undefined) {
      timerId = setTimeout(timerExpired, wait);
    }
    return result;
  }
  debounced.cancel = cancel;
  debounced.flush = flush;
  return debounced;
}

module.exports = debounce;


/***/ }),
/* 545 */
/***/ (function(module, exports, __webpack_require__) {

var root = __webpack_require__(31);

/**
 * Gets the timestamp of the number of milliseconds that have elapsed since
 * the Unix epoch (1 January 1970 00:00:00 UTC).
 *
 * @static
 * @memberOf _
 * @since 2.4.0
 * @category Date
 * @returns {number} Returns the timestamp.
 * @example
 *
 * _.defer(function(stamp) {
 *   console.log(_.now() - stamp);
 * }, _.now());
 * // => Logs the number of milliseconds it took for the deferred invocation.
 */
var now = function() {
  return root.Date.now();
};

module.exports = now;


/***/ }),
/* 546 */
/***/ (function(module, exports, __webpack_require__) {

var isObject = __webpack_require__(50),
    isSymbol = __webpack_require__(103);

/** Used as references for various `Number` constants. */
var NAN = 0 / 0;

/** Used to match leading and trailing whitespace. */
var reTrim = /^\s+|\s+$/g;

/** Used to detect bad signed hexadecimal string values. */
var reIsBadHex = /^[-+]0x[0-9a-f]+$/i;

/** Used to detect binary string values. */
var reIsBinary = /^0b[01]+$/i;

/** Used to detect octal string values. */
var reIsOctal = /^0o[0-7]+$/i;

/** Built-in method references without a dependency on `root`. */
var freeParseInt = parseInt;

/**
 * Converts `value` to a number.
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to process.
 * @returns {number} Returns the number.
 * @example
 *
 * _.toNumber(3.2);
 * // => 3.2
 *
 * _.toNumber(Number.MIN_VALUE);
 * // => 5e-324
 *
 * _.toNumber(Infinity);
 * // => Infinity
 *
 * _.toNumber('3.2');
 * // => 3.2
 */
function toNumber(value) {
  if (typeof value == 'number') {
    return value;
  }
  if (isSymbol(value)) {
    return NAN;
  }
  if (isObject(value)) {
    var other = typeof value.valueOf == 'function' ? value.valueOf() : value;
    value = isObject(other) ? (other + '') : other;
  }
  if (typeof value != 'string') {
    return value === 0 ? value : +value;
  }
  value = value.replace(reTrim, '');
  var isBinary = reIsBinary.test(value);
  return (isBinary || reIsOctal.test(value))
    ? freeParseInt(value.slice(2), isBinary ? 2 : 8)
    : (reIsBadHex.test(value) ? NAN : +value);
}

module.exports = toNumber;


/***/ }),
/* 547 */
/***/ (function(module, exports, __webpack_require__) {

var Symbol = __webpack_require__(81);

/** Used for built-in method references. */
var objectProto = Object.prototype;

/** Used to check objects for own properties. */
var hasOwnProperty = objectProto.hasOwnProperty;

/**
 * Used to resolve the
 * [`toStringTag`](http://ecma-international.org/ecma-262/7.0/#sec-object.prototype.tostring)
 * of values.
 */
var nativeObjectToString = objectProto.toString;

/** Built-in value references. */
var symToStringTag = Symbol ? Symbol.toStringTag : undefined;

/**
 * A specialized version of `baseGetTag` which ignores `Symbol.toStringTag` values.
 *
 * @private
 * @param {*} value The value to query.
 * @returns {string} Returns the raw `toStringTag`.
 */
function getRawTag(value) {
  var isOwn = hasOwnProperty.call(value, symToStringTag),
      tag = value[symToStringTag];

  try {
    value[symToStringTag] = undefined;
    var unmasked = true;
  } catch (e) {}

  var result = nativeObjectToString.call(value);
  if (unmasked) {
    if (isOwn) {
      value[symToStringTag] = tag;
    } else {
      delete value[symToStringTag];
    }
  }
  return result;
}

module.exports = getRawTag;


/***/ }),
/* 548 */
/***/ (function(module, exports) {

/** Used for built-in method references. */
var objectProto = Object.prototype;

/**
 * Used to resolve the
 * [`toStringTag`](http://ecma-international.org/ecma-262/7.0/#sec-object.prototype.tostring)
 * of values.
 */
var nativeObjectToString = objectProto.toString;

/**
 * Converts `value` to a string using `Object.prototype.toString`.
 *
 * @private
 * @param {*} value The value to convert.
 * @returns {string} Returns the converted string.
 */
function objectToString(value) {
  return nativeObjectToString.call(value);
}

module.exports = objectToString;


/***/ }),
/* 549 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, "__esModule", {
  value: true
});

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _classnames = __webpack_require__(5);

var _classnames2 = _interopRequireDefault(_classnames);

var _isEqual = __webpack_require__(162);

var _isEqual2 = _interopRequireDefault(_isEqual);

var _react = __webpack_require__(0);

var _react2 = _interopRequireDefault(_react);

var _propTypes = __webpack_require__(1);

var _propTypes2 = _interopRequireDefault(_propTypes);

var _reactDom = __webpack_require__(12);

var _Portal = __webpack_require__(606);

var _Portal2 = _interopRequireDefault(_Portal);

var _componentOrElement = __webpack_require__(46);

var _componentOrElement2 = _interopRequireDefault(_componentOrElement);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var BODY_CLASS = 'rbt-body-container';
var DROPUP_SPACING = -4;

// When appending the overlay to `document.body`, clicking on it will register
// as an "outside" click and immediately close the overlay. This classname tells
// `react-onclickoutside` to ignore the click.
var IGNORE_CLICK_OUTSIDE = 'ignore-react-onclickoutside';

function isBody(container) {
  return container === document.body;
}

/**
 * Custom `Overlay` component, since the version in `react-overlays` doesn't
 * work for our needs. Specifically, the `Position` component doesn't provide
 * the customized placement we need.
 */

var Overlay = function (_React$Component) {
  _inherits(Overlay, _React$Component);

  function Overlay() {
    var _ref;

    var _temp, _this, _ret;

    _classCallCheck(this, Overlay);

    for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
      args[_key] = arguments[_key];
    }

    return _ret = (_temp = (_this = _possibleConstructorReturn(this, (_ref = Overlay.__proto__ || Object.getPrototypeOf(Overlay)).call.apply(_ref, [this].concat(args))), _this), _this.displayName = 'Overlay', _this.state = {
      left: 0,
      right: 0,
      top: 0
    }, _this._update = function () {
      var _this$props = _this.props,
          className = _this$props.className,
          container = _this$props.container,
          show = _this$props.show;

      // Positioning is only used when body is the container.

      if (!(show && isBody(container) && _this._mounted)) {
        return;
      }

      // Set a classname on the body for scoping purposes.
      container.classList.add(BODY_CLASS);
      container.classList.toggle(className, !!className);

      _this._updatePosition();
    }, _this._updatePosition = function () {
      var _this$props2 = _this.props,
          align = _this$props2.align,
          dropup = _this$props2.dropup,
          target = _this$props2.target;


      var menuNode = (0, _reactDom.findDOMNode)(_this._menu);
      var targetNode = (0, _reactDom.findDOMNode)(target);

      if (menuNode && targetNode) {
        var _window = window,
            innerWidth = _window.innerWidth,
            pageYOffset = _window.pageYOffset;

        var _targetNode$getBoundi = targetNode.getBoundingClientRect(),
            bottom = _targetNode$getBoundi.bottom,
            left = _targetNode$getBoundi.left,
            top = _targetNode$getBoundi.top,
            width = _targetNode$getBoundi.width;

        var newState = {
          left: align === 'right' ? 'auto' : left,
          right: align === 'left' ? 'auto' : innerWidth - left - width,
          top: dropup ? pageYOffset - menuNode.offsetHeight + top + DROPUP_SPACING : pageYOffset + bottom
        };

        // Don't update unless the target element position has changed.
        if (!(0, _isEqual2.default)(_this.state, newState)) {
          _this.setState(newState);
        }
      }
    }, _temp), _possibleConstructorReturn(_this, _ret);
  }

  _createClass(Overlay, [{
    key: 'componentDidMount',
    value: function componentDidMount() {
      this._mounted = true;
      this._update();

      this._updateThrottled = requestAnimationFrame.bind(null, this._update);

      window.addEventListener('resize', this._updateThrottled);
      window.addEventListener('scroll', this._updateThrottled, true);
    }
  }, {
    key: 'componentWillReceiveProps',
    value: function componentWillReceiveProps(nextProps) {
      var onMenuHide = nextProps.onMenuHide,
          onMenuShow = nextProps.onMenuShow,
          show = nextProps.show;


      if (this.props.show && !show) {
        onMenuHide();
      }

      if (!this.props.show && show) {
        onMenuShow();
      }

      // Remove scoping classes if menu isn't being appended to document body.
      var _props = this.props,
          className = _props.className,
          container = _props.container;

      if (isBody(container) && !isBody(nextProps.container)) {
        container.classList.remove(BODY_CLASS, className);
      }

      this._updateThrottled();
    }
  }, {
    key: 'componentWillUnmount',
    value: function componentWillUnmount() {
      this._mounted = false;
      window.removeEventListener('resize', this._updateThrottled);
      window.removeEventListener('scroll', this._updateThrottled);
    }
  }, {
    key: 'render',
    value: function render() {
      var _this2 = this;

      if (!this.props.show) {
        return null;
      }

      var _props2 = this.props,
          container = _props2.container,
          children = _props2.children;

      var child = _react.Children.only(children);

      // When not attaching the overlay to `document.body` treat the child as a
      // simple inline element.
      if (!isBody(container)) {
        return child;
      }

      child = (0, _react.cloneElement)(child, _extends({}, child.props, {
        className: (0, _classnames2.default)(child.props.className, IGNORE_CLICK_OUTSIDE),
        ref: function ref(menu) {
          return _this2._menu = menu;
        },
        style: this.state
      }));

      return _react2.default.createElement(
        _Portal2.default,
        { container: container, ref: function ref(portal) {
            return _this2._portal = portal;
          } },
        child
      );
    }
  }]);

  return Overlay;
}(_react2.default.Component);

Overlay.propTypes = {
  container: _componentOrElement2.default.isRequired,
  onMenuHide: _propTypes2.default.func.isRequired,
  onMenuShow: _propTypes2.default.func.isRequired,
  show: _propTypes2.default.bool,
  target: _componentOrElement2.default.isRequired
};

Overlay.defaultProps = {
  show: false
};

exports.default = Overlay;

/***/ }),
/* 550 */
/***/ (function(module, exports, __webpack_require__) {

var Stack = __webpack_require__(274),
    equalArrays = __webpack_require__(276),
    equalByTag = __webpack_require__(581),
    equalObjects = __webpack_require__(585),
    getTag = __webpack_require__(601),
    isArray = __webpack_require__(24),
    isBuffer = __webpack_require__(279),
    isTypedArray = __webpack_require__(280);

/** Used to compose bitmasks for value comparisons. */
var COMPARE_PARTIAL_FLAG = 1;

/** `Object#toString` result references. */
var argsTag = '[object Arguments]',
    arrayTag = '[object Array]',
    objectTag = '[object Object]';

/** Used for built-in method references. */
var objectProto = Object.prototype;

/** Used to check objects for own properties. */
var hasOwnProperty = objectProto.hasOwnProperty;

/**
 * A specialized version of `baseIsEqual` for arrays and objects which performs
 * deep comparisons and tracks traversed objects enabling objects with circular
 * references to be compared.
 *
 * @private
 * @param {Object} object The object to compare.
 * @param {Object} other The other object to compare.
 * @param {number} bitmask The bitmask flags. See `baseIsEqual` for more details.
 * @param {Function} customizer The function to customize comparisons.
 * @param {Function} equalFunc The function to determine equivalents of values.
 * @param {Object} [stack] Tracks traversed `object` and `other` objects.
 * @returns {boolean} Returns `true` if the objects are equivalent, else `false`.
 */
function baseIsEqualDeep(object, other, bitmask, customizer, equalFunc, stack) {
  var objIsArr = isArray(object),
      othIsArr = isArray(other),
      objTag = objIsArr ? arrayTag : getTag(object),
      othTag = othIsArr ? arrayTag : getTag(other);

  objTag = objTag == argsTag ? objectTag : objTag;
  othTag = othTag == argsTag ? objectTag : othTag;

  var objIsObj = objTag == objectTag,
      othIsObj = othTag == objectTag,
      isSameTag = objTag == othTag;

  if (isSameTag && isBuffer(object)) {
    if (!isBuffer(other)) {
      return false;
    }
    objIsArr = true;
    objIsObj = false;
  }
  if (isSameTag && !objIsObj) {
    stack || (stack = new Stack);
    return (objIsArr || isTypedArray(object))
      ? equalArrays(object, other, bitmask, customizer, equalFunc, stack)
      : equalByTag(object, other, objTag, bitmask, customizer, equalFunc, stack);
  }
  if (!(bitmask & COMPARE_PARTIAL_FLAG)) {
    var objIsWrapped = objIsObj && hasOwnProperty.call(object, '__wrapped__'),
        othIsWrapped = othIsObj && hasOwnProperty.call(other, '__wrapped__');

    if (objIsWrapped || othIsWrapped) {
      var objUnwrapped = objIsWrapped ? object.value() : object,
          othUnwrapped = othIsWrapped ? other.value() : other;

      stack || (stack = new Stack);
      return equalFunc(objUnwrapped, othUnwrapped, bitmask, customizer, stack);
    }
  }
  if (!isSameTag) {
    return false;
  }
  stack || (stack = new Stack);
  return equalObjects(object, other, bitmask, customizer, equalFunc, stack);
}

module.exports = baseIsEqualDeep;


/***/ }),
/* 551 */
/***/ (function(module, exports) {

/**
 * Removes all key-value entries from the list cache.
 *
 * @private
 * @name clear
 * @memberOf ListCache
 */
function listCacheClear() {
  this.__data__ = [];
  this.size = 0;
}

module.exports = listCacheClear;


/***/ }),
/* 552 */
/***/ (function(module, exports, __webpack_require__) {

var assocIndexOf = __webpack_require__(105);

/** Used for built-in method references. */
var arrayProto = Array.prototype;

/** Built-in value references. */
var splice = arrayProto.splice;

/**
 * Removes `key` and its value from the list cache.
 *
 * @private
 * @name delete
 * @memberOf ListCache
 * @param {string} key The key of the value to remove.
 * @returns {boolean} Returns `true` if the entry was removed, else `false`.
 */
function listCacheDelete(key) {
  var data = this.__data__,
      index = assocIndexOf(data, key);

  if (index < 0) {
    return false;
  }
  var lastIndex = data.length - 1;
  if (index == lastIndex) {
    data.pop();
  } else {
    splice.call(data, index, 1);
  }
  --this.size;
  return true;
}

module.exports = listCacheDelete;


/***/ }),
/* 553 */
/***/ (function(module, exports, __webpack_require__) {

var assocIndexOf = __webpack_require__(105);

/**
 * Gets the list cache value for `key`.
 *
 * @private
 * @name get
 * @memberOf ListCache
 * @param {string} key The key of the value to get.
 * @returns {*} Returns the entry value.
 */
function listCacheGet(key) {
  var data = this.__data__,
      index = assocIndexOf(data, key);

  return index < 0 ? undefined : data[index][1];
}

module.exports = listCacheGet;


/***/ }),
/* 554 */
/***/ (function(module, exports, __webpack_require__) {

var assocIndexOf = __webpack_require__(105);

/**
 * Checks if a list cache value for `key` exists.
 *
 * @private
 * @name has
 * @memberOf ListCache
 * @param {string} key The key of the entry to check.
 * @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
 */
function listCacheHas(key) {
  return assocIndexOf(this.__data__, key) > -1;
}

module.exports = listCacheHas;


/***/ }),
/* 555 */
/***/ (function(module, exports, __webpack_require__) {

var assocIndexOf = __webpack_require__(105);

/**
 * Sets the list cache `key` to `value`.
 *
 * @private
 * @name set
 * @memberOf ListCache
 * @param {string} key The key of the value to set.
 * @param {*} value The value to set.
 * @returns {Object} Returns the list cache instance.
 */
function listCacheSet(key, value) {
  var data = this.__data__,
      index = assocIndexOf(data, key);

  if (index < 0) {
    ++this.size;
    data.push([key, value]);
  } else {
    data[index][1] = value;
  }
  return this;
}

module.exports = listCacheSet;


/***/ }),
/* 556 */
/***/ (function(module, exports, __webpack_require__) {

var ListCache = __webpack_require__(104);

/**
 * Removes all key-value entries from the stack.
 *
 * @private
 * @name clear
 * @memberOf Stack
 */
function stackClear() {
  this.__data__ = new ListCache;
  this.size = 0;
}

module.exports = stackClear;


/***/ }),
/* 557 */
/***/ (function(module, exports) {

/**
 * Removes `key` and its value from the stack.
 *
 * @private
 * @name delete
 * @memberOf Stack
 * @param {string} key The key of the value to remove.
 * @returns {boolean} Returns `true` if the entry was removed, else `false`.
 */
function stackDelete(key) {
  var data = this.__data__,
      result = data['delete'](key);

  this.size = data.size;
  return result;
}

module.exports = stackDelete;


/***/ }),
/* 558 */
/***/ (function(module, exports) {

/**
 * Gets the stack value for `key`.
 *
 * @private
 * @name get
 * @memberOf Stack
 * @param {string} key The key of the value to get.
 * @returns {*} Returns the entry value.
 */
function stackGet(key) {
  return this.__data__.get(key);
}

module.exports = stackGet;


/***/ }),
/* 559 */
/***/ (function(module, exports) {

/**
 * Checks if a stack value for `key` exists.
 *
 * @private
 * @name has
 * @memberOf Stack
 * @param {string} key The key of the entry to check.
 * @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
 */
function stackHas(key) {
  return this.__data__.has(key);
}

module.exports = stackHas;


/***/ }),
/* 560 */
/***/ (function(module, exports, __webpack_require__) {

var ListCache = __webpack_require__(104),
    Map = __webpack_require__(164),
    MapCache = __webpack_require__(166);

/** Used as the size to enable large array optimizations. */
var LARGE_ARRAY_SIZE = 200;

/**
 * Sets the stack `key` to `value`.
 *
 * @private
 * @name set
 * @memberOf Stack
 * @param {string} key The key of the value to set.
 * @param {*} value The value to set.
 * @returns {Object} Returns the stack cache instance.
 */
function stackSet(key, value) {
  var data = this.__data__;
  if (data instanceof ListCache) {
    var pairs = data.__data__;
    if (!Map || (pairs.length < LARGE_ARRAY_SIZE - 1)) {
      pairs.push([key, value]);
      this.size = ++data.size;
      return this;
    }
    data = this.__data__ = new MapCache(pairs);
  }
  data.set(key, value);
  this.size = data.size;
  return this;
}

module.exports = stackSet;


/***/ }),
/* 561 */
/***/ (function(module, exports, __webpack_require__) {

var isFunction = __webpack_require__(165),
    isMasked = __webpack_require__(562),
    isObject = __webpack_require__(50),
    toSource = __webpack_require__(275);

/**
 * Used to match `RegExp`
 * [syntax characters](http://ecma-international.org/ecma-262/7.0/#sec-patterns).
 */
var reRegExpChar = /[\\^$.*+?()[\]{}|]/g;

/** Used to detect host constructors (Safari). */
var reIsHostCtor = /^\[object .+?Constructor\]$/;

/** Used for built-in method references. */
var funcProto = Function.prototype,
    objectProto = Object.prototype;

/** Used to resolve the decompiled source of functions. */
var funcToString = funcProto.toString;

/** Used to check objects for own properties. */
var hasOwnProperty = objectProto.hasOwnProperty;

/** Used to detect if a method is native. */
var reIsNative = RegExp('^' +
  funcToString.call(hasOwnProperty).replace(reRegExpChar, '\\$&')
  .replace(/hasOwnProperty|(function).*?(?=\\\()| for .+?(?=\\\])/g, '$1.*?') + '$'
);

/**
 * The base implementation of `_.isNative` without bad shim checks.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a native function,
 *  else `false`.
 */
function baseIsNative(value) {
  if (!isObject(value) || isMasked(value)) {
    return false;
  }
  var pattern = isFunction(value) ? reIsNative : reIsHostCtor;
  return pattern.test(toSource(value));
}

module.exports = baseIsNative;


/***/ }),
/* 562 */
/***/ (function(module, exports, __webpack_require__) {

var coreJsData = __webpack_require__(563);

/** Used to detect methods masquerading as native. */
var maskSrcKey = (function() {
  var uid = /[^.]+$/.exec(coreJsData && coreJsData.keys && coreJsData.keys.IE_PROTO || '');
  return uid ? ('Symbol(src)_1.' + uid) : '';
}());

/**
 * Checks if `func` has its source masked.
 *
 * @private
 * @param {Function} func The function to check.
 * @returns {boolean} Returns `true` if `func` is masked, else `false`.
 */
function isMasked(func) {
  return !!maskSrcKey && (maskSrcKey in func);
}

module.exports = isMasked;


/***/ }),
/* 563 */
/***/ (function(module, exports, __webpack_require__) {

var root = __webpack_require__(31);

/** Used to detect overreaching core-js shims. */
var coreJsData = root['__core-js_shared__'];

module.exports = coreJsData;


/***/ }),
/* 564 */
/***/ (function(module, exports) {

/**
 * Gets the value at `key` of `object`.
 *
 * @private
 * @param {Object} [object] The object to query.
 * @param {string} key The key of the property to get.
 * @returns {*} Returns the property value.
 */
function getValue(object, key) {
  return object == null ? undefined : object[key];
}

module.exports = getValue;


/***/ }),
/* 565 */
/***/ (function(module, exports, __webpack_require__) {

var Hash = __webpack_require__(566),
    ListCache = __webpack_require__(104),
    Map = __webpack_require__(164);

/**
 * Removes all key-value entries from the map.
 *
 * @private
 * @name clear
 * @memberOf MapCache
 */
function mapCacheClear() {
  this.size = 0;
  this.__data__ = {
    'hash': new Hash,
    'map': new (Map || ListCache),
    'string': new Hash
  };
}

module.exports = mapCacheClear;


/***/ }),
/* 566 */
/***/ (function(module, exports, __webpack_require__) {

var hashClear = __webpack_require__(567),
    hashDelete = __webpack_require__(568),
    hashGet = __webpack_require__(569),
    hashHas = __webpack_require__(570),
    hashSet = __webpack_require__(571);

/**
 * Creates a hash object.
 *
 * @private
 * @constructor
 * @param {Array} [entries] The key-value pairs to cache.
 */
function Hash(entries) {
  var index = -1,
      length = entries == null ? 0 : entries.length;

  this.clear();
  while (++index < length) {
    var entry = entries[index];
    this.set(entry[0], entry[1]);
  }
}

// Add methods to `Hash`.
Hash.prototype.clear = hashClear;
Hash.prototype['delete'] = hashDelete;
Hash.prototype.get = hashGet;
Hash.prototype.has = hashHas;
Hash.prototype.set = hashSet;

module.exports = Hash;


/***/ }),
/* 567 */
/***/ (function(module, exports, __webpack_require__) {

var nativeCreate = __webpack_require__(107);

/**
 * Removes all key-value entries from the hash.
 *
 * @private
 * @name clear
 * @memberOf Hash
 */
function hashClear() {
  this.__data__ = nativeCreate ? nativeCreate(null) : {};
  this.size = 0;
}

module.exports = hashClear;


/***/ }),
/* 568 */
/***/ (function(module, exports) {

/**
 * Removes `key` and its value from the hash.
 *
 * @private
 * @name delete
 * @memberOf Hash
 * @param {Object} hash The hash to modify.
 * @param {string} key The key of the value to remove.
 * @returns {boolean} Returns `true` if the entry was removed, else `false`.
 */
function hashDelete(key) {
  var result = this.has(key) && delete this.__data__[key];
  this.size -= result ? 1 : 0;
  return result;
}

module.exports = hashDelete;


/***/ }),
/* 569 */
/***/ (function(module, exports, __webpack_require__) {

var nativeCreate = __webpack_require__(107);

/** Used to stand-in for `undefined` hash values. */
var HASH_UNDEFINED = '__lodash_hash_undefined__';

/** Used for built-in method references. */
var objectProto = Object.prototype;

/** Used to check objects for own properties. */
var hasOwnProperty = objectProto.hasOwnProperty;

/**
 * Gets the hash value for `key`.
 *
 * @private
 * @name get
 * @memberOf Hash
 * @param {string} key The key of the value to get.
 * @returns {*} Returns the entry value.
 */
function hashGet(key) {
  var data = this.__data__;
  if (nativeCreate) {
    var result = data[key];
    return result === HASH_UNDEFINED ? undefined : result;
  }
  return hasOwnProperty.call(data, key) ? data[key] : undefined;
}

module.exports = hashGet;


/***/ }),
/* 570 */
/***/ (function(module, exports, __webpack_require__) {

var nativeCreate = __webpack_require__(107);

/** Used for built-in method references. */
var objectProto = Object.prototype;

/** Used to check objects for own properties. */
var hasOwnProperty = objectProto.hasOwnProperty;

/**
 * Checks if a hash value for `key` exists.
 *
 * @private
 * @name has
 * @memberOf Hash
 * @param {string} key The key of the entry to check.
 * @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
 */
function hashHas(key) {
  var data = this.__data__;
  return nativeCreate ? (data[key] !== undefined) : hasOwnProperty.call(data, key);
}

module.exports = hashHas;


/***/ }),
/* 571 */
/***/ (function(module, exports, __webpack_require__) {

var nativeCreate = __webpack_require__(107);

/** Used to stand-in for `undefined` hash values. */
var HASH_UNDEFINED = '__lodash_hash_undefined__';

/**
 * Sets the hash `key` to `value`.
 *
 * @private
 * @name set
 * @memberOf Hash
 * @param {string} key The key of the value to set.
 * @param {*} value The value to set.
 * @returns {Object} Returns the hash instance.
 */
function hashSet(key, value) {
  var data = this.__data__;
  this.size += this.has(key) ? 0 : 1;
  data[key] = (nativeCreate && value === undefined) ? HASH_UNDEFINED : value;
  return this;
}

module.exports = hashSet;


/***/ }),
/* 572 */
/***/ (function(module, exports, __webpack_require__) {

var getMapData = __webpack_require__(108);

/**
 * Removes `key` and its value from the map.
 *
 * @private
 * @name delete
 * @memberOf MapCache
 * @param {string} key The key of the value to remove.
 * @returns {boolean} Returns `true` if the entry was removed, else `false`.
 */
function mapCacheDelete(key) {
  var result = getMapData(this, key)['delete'](key);
  this.size -= result ? 1 : 0;
  return result;
}

module.exports = mapCacheDelete;


/***/ }),
/* 573 */
/***/ (function(module, exports) {

/**
 * Checks if `value` is suitable for use as unique object key.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is suitable, else `false`.
 */
function isKeyable(value) {
  var type = typeof value;
  return (type == 'string' || type == 'number' || type == 'symbol' || type == 'boolean')
    ? (value !== '__proto__')
    : (value === null);
}

module.exports = isKeyable;


/***/ }),
/* 574 */
/***/ (function(module, exports, __webpack_require__) {

var getMapData = __webpack_require__(108);

/**
 * Gets the map value for `key`.
 *
 * @private
 * @name get
 * @memberOf MapCache
 * @param {string} key The key of the value to get.
 * @returns {*} Returns the entry value.
 */
function mapCacheGet(key) {
  return getMapData(this, key).get(key);
}

module.exports = mapCacheGet;


/***/ }),
/* 575 */
/***/ (function(module, exports, __webpack_require__) {

var getMapData = __webpack_require__(108);

/**
 * Checks if a map value for `key` exists.
 *
 * @private
 * @name has
 * @memberOf MapCache
 * @param {string} key The key of the entry to check.
 * @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
 */
function mapCacheHas(key) {
  return getMapData(this, key).has(key);
}

module.exports = mapCacheHas;


/***/ }),
/* 576 */
/***/ (function(module, exports, __webpack_require__) {

var getMapData = __webpack_require__(108);

/**
 * Sets the map `key` to `value`.
 *
 * @private
 * @name set
 * @memberOf MapCache
 * @param {string} key The key of the value to set.
 * @param {*} value The value to set.
 * @returns {Object} Returns the map cache instance.
 */
function mapCacheSet(key, value) {
  var data = getMapData(this, key),
      size = data.size;

  data.set(key, value);
  this.size += data.size == size ? 0 : 1;
  return this;
}

module.exports = mapCacheSet;


/***/ }),
/* 577 */
/***/ (function(module, exports, __webpack_require__) {

var MapCache = __webpack_require__(166),
    setCacheAdd = __webpack_require__(578),
    setCacheHas = __webpack_require__(579);

/**
 *
 * Creates an array cache object to store unique values.
 *
 * @private
 * @constructor
 * @param {Array} [values] The values to cache.
 */
function SetCache(values) {
  var index = -1,
      length = values == null ? 0 : values.length;

  this.__data__ = new MapCache;
  while (++index < length) {
    this.add(values[index]);
  }
}

// Add methods to `SetCache`.
SetCache.prototype.add = SetCache.prototype.push = setCacheAdd;
SetCache.prototype.has = setCacheHas;

module.exports = SetCache;


/***/ }),
/* 578 */
/***/ (function(module, exports) {

/** Used to stand-in for `undefined` hash values. */
var HASH_UNDEFINED = '__lodash_hash_undefined__';

/**
 * Adds `value` to the array cache.
 *
 * @private
 * @name add
 * @memberOf SetCache
 * @alias push
 * @param {*} value The value to cache.
 * @returns {Object} Returns the cache instance.
 */
function setCacheAdd(value) {
  this.__data__.set(value, HASH_UNDEFINED);
  return this;
}

module.exports = setCacheAdd;


/***/ }),
/* 579 */
/***/ (function(module, exports) {

/**
 * Checks if `value` is in the array cache.
 *
 * @private
 * @name has
 * @memberOf SetCache
 * @param {*} value The value to search for.
 * @returns {number} Returns `true` if `value` is found, else `false`.
 */
function setCacheHas(value) {
  return this.__data__.has(value);
}

module.exports = setCacheHas;


/***/ }),
/* 580 */
/***/ (function(module, exports) {

/**
 * Checks if a `cache` value for `key` exists.
 *
 * @private
 * @param {Object} cache The cache to query.
 * @param {string} key The key of the entry to check.
 * @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
 */
function cacheHas(cache, key) {
  return cache.has(key);
}

module.exports = cacheHas;


/***/ }),
/* 581 */
/***/ (function(module, exports, __webpack_require__) {

var Symbol = __webpack_require__(81),
    Uint8Array = __webpack_require__(582),
    eq = __webpack_require__(106),
    equalArrays = __webpack_require__(276),
    mapToArray = __webpack_require__(583),
    setToArray = __webpack_require__(584);

/** Used to compose bitmasks for value comparisons. */
var COMPARE_PARTIAL_FLAG = 1,
    COMPARE_UNORDERED_FLAG = 2;

/** `Object#toString` result references. */
var boolTag = '[object Boolean]',
    dateTag = '[object Date]',
    errorTag = '[object Error]',
    mapTag = '[object Map]',
    numberTag = '[object Number]',
    regexpTag = '[object RegExp]',
    setTag = '[object Set]',
    stringTag = '[object String]',
    symbolTag = '[object Symbol]';

var arrayBufferTag = '[object ArrayBuffer]',
    dataViewTag = '[object DataView]';

/** Used to convert symbols to primitives and strings. */
var symbolProto = Symbol ? Symbol.prototype : undefined,
    symbolValueOf = symbolProto ? symbolProto.valueOf : undefined;

/**
 * A specialized version of `baseIsEqualDeep` for comparing objects of
 * the same `toStringTag`.
 *
 * **Note:** This function only supports comparing values with tags of
 * `Boolean`, `Date`, `Error`, `Number`, `RegExp`, or `String`.
 *
 * @private
 * @param {Object} object The object to compare.
 * @param {Object} other The other object to compare.
 * @param {string} tag The `toStringTag` of the objects to compare.
 * @param {number} bitmask The bitmask flags. See `baseIsEqual` for more details.
 * @param {Function} customizer The function to customize comparisons.
 * @param {Function} equalFunc The function to determine equivalents of values.
 * @param {Object} stack Tracks traversed `object` and `other` objects.
 * @returns {boolean} Returns `true` if the objects are equivalent, else `false`.
 */
function equalByTag(object, other, tag, bitmask, customizer, equalFunc, stack) {
  switch (tag) {
    case dataViewTag:
      if ((object.byteLength != other.byteLength) ||
          (object.byteOffset != other.byteOffset)) {
        return false;
      }
      object = object.buffer;
      other = other.buffer;

    case arrayBufferTag:
      if ((object.byteLength != other.byteLength) ||
          !equalFunc(new Uint8Array(object), new Uint8Array(other))) {
        return false;
      }
      return true;

    case boolTag:
    case dateTag:
    case numberTag:
      // Coerce booleans to `1` or `0` and dates to milliseconds.
      // Invalid dates are coerced to `NaN`.
      return eq(+object, +other);

    case errorTag:
      return object.name == other.name && object.message == other.message;

    case regexpTag:
    case stringTag:
      // Coerce regexes to strings and treat strings, primitives and objects,
      // as equal. See http://www.ecma-international.org/ecma-262/7.0/#sec-regexp.prototype.tostring
      // for more details.
      return object == (other + '');

    case mapTag:
      var convert = mapToArray;

    case setTag:
      var isPartial = bitmask & COMPARE_PARTIAL_FLAG;
      convert || (convert = setToArray);

      if (object.size != other.size && !isPartial) {
        return false;
      }
      // Assume cyclic values are equal.
      var stacked = stack.get(object);
      if (stacked) {
        return stacked == other;
      }
      bitmask |= COMPARE_UNORDERED_FLAG;

      // Recursively compare objects (susceptible to call stack limits).
      stack.set(object, other);
      var result = equalArrays(convert(object), convert(other), bitmask, customizer, equalFunc, stack);
      stack['delete'](object);
      return result;

    case symbolTag:
      if (symbolValueOf) {
        return symbolValueOf.call(object) == symbolValueOf.call(other);
      }
  }
  return false;
}

module.exports = equalByTag;


/***/ }),
/* 582 */
/***/ (function(module, exports, __webpack_require__) {

var root = __webpack_require__(31);

/** Built-in value references. */
var Uint8Array = root.Uint8Array;

module.exports = Uint8Array;


/***/ }),
/* 583 */
/***/ (function(module, exports) {

/**
 * Converts `map` to its key-value pairs.
 *
 * @private
 * @param {Object} map The map to convert.
 * @returns {Array} Returns the key-value pairs.
 */
function mapToArray(map) {
  var index = -1,
      result = Array(map.size);

  map.forEach(function(value, key) {
    result[++index] = [key, value];
  });
  return result;
}

module.exports = mapToArray;


/***/ }),
/* 584 */
/***/ (function(module, exports) {

/**
 * Converts `set` to an array of its values.
 *
 * @private
 * @param {Object} set The set to convert.
 * @returns {Array} Returns the values.
 */
function setToArray(set) {
  var index = -1,
      result = Array(set.size);

  set.forEach(function(value) {
    result[++index] = value;
  });
  return result;
}

module.exports = setToArray;


/***/ }),
/* 585 */
/***/ (function(module, exports, __webpack_require__) {

var getAllKeys = __webpack_require__(586);

/** Used to compose bitmasks for value comparisons. */
var COMPARE_PARTIAL_FLAG = 1;

/** Used for built-in method references. */
var objectProto = Object.prototype;

/** Used to check objects for own properties. */
var hasOwnProperty = objectProto.hasOwnProperty;

/**
 * A specialized version of `baseIsEqualDeep` for objects with support for
 * partial deep comparisons.
 *
 * @private
 * @param {Object} object The object to compare.
 * @param {Object} other The other object to compare.
 * @param {number} bitmask The bitmask flags. See `baseIsEqual` for more details.
 * @param {Function} customizer The function to customize comparisons.
 * @param {Function} equalFunc The function to determine equivalents of values.
 * @param {Object} stack Tracks traversed `object` and `other` objects.
 * @returns {boolean} Returns `true` if the objects are equivalent, else `false`.
 */
function equalObjects(object, other, bitmask, customizer, equalFunc, stack) {
  var isPartial = bitmask & COMPARE_PARTIAL_FLAG,
      objProps = getAllKeys(object),
      objLength = objProps.length,
      othProps = getAllKeys(other),
      othLength = othProps.length;

  if (objLength != othLength && !isPartial) {
    return false;
  }
  var index = objLength;
  while (index--) {
    var key = objProps[index];
    if (!(isPartial ? key in other : hasOwnProperty.call(other, key))) {
      return false;
    }
  }
  // Assume cyclic values are equal.
  var stacked = stack.get(object);
  if (stacked && stack.get(other)) {
    return stacked == other;
  }
  var result = true;
  stack.set(object, other);
  stack.set(other, object);

  var skipCtor = isPartial;
  while (++index < objLength) {
    key = objProps[index];
    var objValue = object[key],
        othValue = other[key];

    if (customizer) {
      var compared = isPartial
        ? customizer(othValue, objValue, key, other, object, stack)
        : customizer(objValue, othValue, key, object, other, stack);
    }
    // Recursively compare objects (susceptible to call stack limits).
    if (!(compared === undefined
          ? (objValue === othValue || equalFunc(objValue, othValue, bitmask, customizer, stack))
          : compared
        )) {
      result = false;
      break;
    }
    skipCtor || (skipCtor = key == 'constructor');
  }
  if (result && !skipCtor) {
    var objCtor = object.constructor,
        othCtor = other.constructor;

    // Non `Object` object instances with different constructors are not equal.
    if (objCtor != othCtor &&
        ('constructor' in object && 'constructor' in other) &&
        !(typeof objCtor == 'function' && objCtor instanceof objCtor &&
          typeof othCtor == 'function' && othCtor instanceof othCtor)) {
      result = false;
    }
  }
  stack['delete'](object);
  stack['delete'](other);
  return result;
}

module.exports = equalObjects;


/***/ }),
/* 586 */
/***/ (function(module, exports, __webpack_require__) {

var baseGetAllKeys = __webpack_require__(587),
    getSymbols = __webpack_require__(588),
    keys = __webpack_require__(167);

/**
 * Creates an array of own enumerable property names and symbols of `object`.
 *
 * @private
 * @param {Object} object The object to query.
 * @returns {Array} Returns the array of property names and symbols.
 */
function getAllKeys(object) {
  return baseGetAllKeys(object, keys, getSymbols);
}

module.exports = getAllKeys;


/***/ }),
/* 587 */
/***/ (function(module, exports, __webpack_require__) {

var arrayPush = __webpack_require__(278),
    isArray = __webpack_require__(24);

/**
 * The base implementation of `getAllKeys` and `getAllKeysIn` which uses
 * `keysFunc` and `symbolsFunc` to get the enumerable property names and
 * symbols of `object`.
 *
 * @private
 * @param {Object} object The object to query.
 * @param {Function} keysFunc The function to get the keys of `object`.
 * @param {Function} symbolsFunc The function to get the symbols of `object`.
 * @returns {Array} Returns the array of property names and symbols.
 */
function baseGetAllKeys(object, keysFunc, symbolsFunc) {
  var result = keysFunc(object);
  return isArray(object) ? result : arrayPush(result, symbolsFunc(object));
}

module.exports = baseGetAllKeys;


/***/ }),
/* 588 */
/***/ (function(module, exports, __webpack_require__) {

var arrayFilter = __webpack_require__(589),
    stubArray = __webpack_require__(590);

/** Used for built-in method references. */
var objectProto = Object.prototype;

/** Built-in value references. */
var propertyIsEnumerable = objectProto.propertyIsEnumerable;

/* Built-in method references for those with the same name as other `lodash` methods. */
var nativeGetSymbols = Object.getOwnPropertySymbols;

/**
 * Creates an array of the own enumerable symbols of `object`.
 *
 * @private
 * @param {Object} object The object to query.
 * @returns {Array} Returns the array of symbols.
 */
var getSymbols = !nativeGetSymbols ? stubArray : function(object) {
  if (object == null) {
    return [];
  }
  object = Object(object);
  return arrayFilter(nativeGetSymbols(object), function(symbol) {
    return propertyIsEnumerable.call(object, symbol);
  });
};

module.exports = getSymbols;


/***/ }),
/* 589 */
/***/ (function(module, exports) {

/**
 * A specialized version of `_.filter` for arrays without support for
 * iteratee shorthands.
 *
 * @private
 * @param {Array} [array] The array to iterate over.
 * @param {Function} predicate The function invoked per iteration.
 * @returns {Array} Returns the new filtered array.
 */
function arrayFilter(array, predicate) {
  var index = -1,
      length = array == null ? 0 : array.length,
      resIndex = 0,
      result = [];

  while (++index < length) {
    var value = array[index];
    if (predicate(value, index, array)) {
      result[resIndex++] = value;
    }
  }
  return result;
}

module.exports = arrayFilter;


/***/ }),
/* 590 */
/***/ (function(module, exports) {

/**
 * This method returns a new empty array.
 *
 * @static
 * @memberOf _
 * @since 4.13.0
 * @category Util
 * @returns {Array} Returns the new empty array.
 * @example
 *
 * var arrays = _.times(2, _.stubArray);
 *
 * console.log(arrays);
 * // => [[], []]
 *
 * console.log(arrays[0] === arrays[1]);
 * // => false
 */
function stubArray() {
  return [];
}

module.exports = stubArray;


/***/ }),
/* 591 */
/***/ (function(module, exports, __webpack_require__) {

var baseTimes = __webpack_require__(592),
    isArguments = __webpack_require__(168),
    isArray = __webpack_require__(24),
    isBuffer = __webpack_require__(279),
    isIndex = __webpack_require__(109),
    isTypedArray = __webpack_require__(280);

/** Used for built-in method references. */
var objectProto = Object.prototype;

/** Used to check objects for own properties. */
var hasOwnProperty = objectProto.hasOwnProperty;

/**
 * Creates an array of the enumerable property names of the array-like `value`.
 *
 * @private
 * @param {*} value The value to query.
 * @param {boolean} inherited Specify returning inherited property names.
 * @returns {Array} Returns the array of property names.
 */
function arrayLikeKeys(value, inherited) {
  var isArr = isArray(value),
      isArg = !isArr && isArguments(value),
      isBuff = !isArr && !isArg && isBuffer(value),
      isType = !isArr && !isArg && !isBuff && isTypedArray(value),
      skipIndexes = isArr || isArg || isBuff || isType,
      result = skipIndexes ? baseTimes(value.length, String) : [],
      length = result.length;

  for (var key in value) {
    if ((inherited || hasOwnProperty.call(value, key)) &&
        !(skipIndexes && (
           // Safari 9 has enumerable `arguments.length` in strict mode.
           key == 'length' ||
           // Node.js 0.10 has enumerable non-index properties on buffers.
           (isBuff && (key == 'offset' || key == 'parent')) ||
           // PhantomJS 2 has enumerable non-index properties on typed arrays.
           (isType && (key == 'buffer' || key == 'byteLength' || key == 'byteOffset')) ||
           // Skip index properties.
           isIndex(key, length)
        ))) {
      result.push(key);
    }
  }
  return result;
}

module.exports = arrayLikeKeys;


/***/ }),
/* 592 */
/***/ (function(module, exports) {

/**
 * The base implementation of `_.times` without support for iteratee shorthands
 * or max array length checks.
 *
 * @private
 * @param {number} n The number of times to invoke `iteratee`.
 * @param {Function} iteratee The function invoked per iteration.
 * @returns {Array} Returns the array of results.
 */
function baseTimes(n, iteratee) {
  var index = -1,
      result = Array(n);

  while (++index < n) {
    result[index] = iteratee(index);
  }
  return result;
}

module.exports = baseTimes;


/***/ }),
/* 593 */
/***/ (function(module, exports, __webpack_require__) {

var baseGetTag = __webpack_require__(51),
    isObjectLike = __webpack_require__(52);

/** `Object#toString` result references. */
var argsTag = '[object Arguments]';

/**
 * The base implementation of `_.isArguments`.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an `arguments` object,
 */
function baseIsArguments(value) {
  return isObjectLike(value) && baseGetTag(value) == argsTag;
}

module.exports = baseIsArguments;


/***/ }),
/* 594 */
/***/ (function(module, exports) {

/**
 * This method returns `false`.
 *
 * @static
 * @memberOf _
 * @since 4.13.0
 * @category Util
 * @returns {boolean} Returns `false`.
 * @example
 *
 * _.times(2, _.stubFalse);
 * // => [false, false]
 */
function stubFalse() {
  return false;
}

module.exports = stubFalse;


/***/ }),
/* 595 */
/***/ (function(module, exports, __webpack_require__) {

var baseGetTag = __webpack_require__(51),
    isLength = __webpack_require__(169),
    isObjectLike = __webpack_require__(52);

/** `Object#toString` result references. */
var argsTag = '[object Arguments]',
    arrayTag = '[object Array]',
    boolTag = '[object Boolean]',
    dateTag = '[object Date]',
    errorTag = '[object Error]',
    funcTag = '[object Function]',
    mapTag = '[object Map]',
    numberTag = '[object Number]',
    objectTag = '[object Object]',
    regexpTag = '[object RegExp]',
    setTag = '[object Set]',
    stringTag = '[object String]',
    weakMapTag = '[object WeakMap]';

var arrayBufferTag = '[object ArrayBuffer]',
    dataViewTag = '[object DataView]',
    float32Tag = '[object Float32Array]',
    float64Tag = '[object Float64Array]',
    int8Tag = '[object Int8Array]',
    int16Tag = '[object Int16Array]',
    int32Tag = '[object Int32Array]',
    uint8Tag = '[object Uint8Array]',
    uint8ClampedTag = '[object Uint8ClampedArray]',
    uint16Tag = '[object Uint16Array]',
    uint32Tag = '[object Uint32Array]';

/** Used to identify `toStringTag` values of typed arrays. */
var typedArrayTags = {};
typedArrayTags[float32Tag] = typedArrayTags[float64Tag] =
typedArrayTags[int8Tag] = typedArrayTags[int16Tag] =
typedArrayTags[int32Tag] = typedArrayTags[uint8Tag] =
typedArrayTags[uint8ClampedTag] = typedArrayTags[uint16Tag] =
typedArrayTags[uint32Tag] = true;
typedArrayTags[argsTag] = typedArrayTags[arrayTag] =
typedArrayTags[arrayBufferTag] = typedArrayTags[boolTag] =
typedArrayTags[dataViewTag] = typedArrayTags[dateTag] =
typedArrayTags[errorTag] = typedArrayTags[funcTag] =
typedArrayTags[mapTag] = typedArrayTags[numberTag] =
typedArrayTags[objectTag] = typedArrayTags[regexpTag] =
typedArrayTags[setTag] = typedArrayTags[stringTag] =
typedArrayTags[weakMapTag] = false;

/**
 * The base implementation of `_.isTypedArray` without Node.js optimizations.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a typed array, else `false`.
 */
function baseIsTypedArray(value) {
  return isObjectLike(value) &&
    isLength(value.length) && !!typedArrayTags[baseGetTag(value)];
}

module.exports = baseIsTypedArray;


/***/ }),
/* 596 */
/***/ (function(module, exports) {

/**
 * The base implementation of `_.unary` without support for storing metadata.
 *
 * @private
 * @param {Function} func The function to cap arguments for.
 * @returns {Function} Returns the new capped function.
 */
function baseUnary(func) {
  return function(value) {
    return func(value);
  };
}

module.exports = baseUnary;


/***/ }),
/* 597 */
/***/ (function(module, exports, __webpack_require__) {

/* WEBPACK VAR INJECTION */(function(module) {var freeGlobal = __webpack_require__(272);

/** Detect free variable `exports`. */
var freeExports = typeof exports == 'object' && exports && !exports.nodeType && exports;

/** Detect free variable `module`. */
var freeModule = freeExports && typeof module == 'object' && module && !module.nodeType && module;

/** Detect the popular CommonJS extension `module.exports`. */
var moduleExports = freeModule && freeModule.exports === freeExports;

/** Detect free variable `process` from Node.js. */
var freeProcess = moduleExports && freeGlobal.process;

/** Used to access faster Node.js helpers. */
var nodeUtil = (function() {
  try {
    return freeProcess && freeProcess.binding && freeProcess.binding('util');
  } catch (e) {}
}());

module.exports = nodeUtil;

/* WEBPACK VAR INJECTION */}.call(exports, __webpack_require__(84)(module)))

/***/ }),
/* 598 */
/***/ (function(module, exports, __webpack_require__) {

var isPrototype = __webpack_require__(599),
    nativeKeys = __webpack_require__(600);

/** Used for built-in method references. */
var objectProto = Object.prototype;

/** Used to check objects for own properties. */
var hasOwnProperty = objectProto.hasOwnProperty;

/**
 * The base implementation of `_.keys` which doesn't treat sparse arrays as dense.
 *
 * @private
 * @param {Object} object The object to query.
 * @returns {Array} Returns the array of property names.
 */
function baseKeys(object) {
  if (!isPrototype(object)) {
    return nativeKeys(object);
  }
  var result = [];
  for (var key in Object(object)) {
    if (hasOwnProperty.call(object, key) && key != 'constructor') {
      result.push(key);
    }
  }
  return result;
}

module.exports = baseKeys;


/***/ }),
/* 599 */
/***/ (function(module, exports) {

/** Used for built-in method references. */
var objectProto = Object.prototype;

/**
 * Checks if `value` is likely a prototype object.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a prototype, else `false`.
 */
function isPrototype(value) {
  var Ctor = value && value.constructor,
      proto = (typeof Ctor == 'function' && Ctor.prototype) || objectProto;

  return value === proto;
}

module.exports = isPrototype;


/***/ }),
/* 600 */
/***/ (function(module, exports, __webpack_require__) {

var overArg = __webpack_require__(281);

/* Built-in method references for those with the same name as other `lodash` methods. */
var nativeKeys = overArg(Object.keys, Object);

module.exports = nativeKeys;


/***/ }),
/* 601 */
/***/ (function(module, exports, __webpack_require__) {

var DataView = __webpack_require__(602),
    Map = __webpack_require__(164),
    Promise = __webpack_require__(603),
    Set = __webpack_require__(604),
    WeakMap = __webpack_require__(605),
    baseGetTag = __webpack_require__(51),
    toSource = __webpack_require__(275);

/** `Object#toString` result references. */
var mapTag = '[object Map]',
    objectTag = '[object Object]',
    promiseTag = '[object Promise]',
    setTag = '[object Set]',
    weakMapTag = '[object WeakMap]';

var dataViewTag = '[object DataView]';

/** Used to detect maps, sets, and weakmaps. */
var dataViewCtorString = toSource(DataView),
    mapCtorString = toSource(Map),
    promiseCtorString = toSource(Promise),
    setCtorString = toSource(Set),
    weakMapCtorString = toSource(WeakMap);

/**
 * Gets the `toStringTag` of `value`.
 *
 * @private
 * @param {*} value The value to query.
 * @returns {string} Returns the `toStringTag`.
 */
var getTag = baseGetTag;

// Fallback for data views, maps, sets, and weak maps in IE 11 and promises in Node.js < 6.
if ((DataView && getTag(new DataView(new ArrayBuffer(1))) != dataViewTag) ||
    (Map && getTag(new Map) != mapTag) ||
    (Promise && getTag(Promise.resolve()) != promiseTag) ||
    (Set && getTag(new Set) != setTag) ||
    (WeakMap && getTag(new WeakMap) != weakMapTag)) {
  getTag = function(value) {
    var result = baseGetTag(value),
        Ctor = result == objectTag ? value.constructor : undefined,
        ctorString = Ctor ? toSource(Ctor) : '';

    if (ctorString) {
      switch (ctorString) {
        case dataViewCtorString: return dataViewTag;
        case mapCtorString: return mapTag;
        case promiseCtorString: return promiseTag;
        case setCtorString: return setTag;
        case weakMapCtorString: return weakMapTag;
      }
    }
    return result;
  };
}

module.exports = getTag;


/***/ }),
/* 602 */
/***/ (function(module, exports, __webpack_require__) {

var getNative = __webpack_require__(53),
    root = __webpack_require__(31);

/* Built-in method references that are verified to be native. */
var DataView = getNative(root, 'DataView');

module.exports = DataView;


/***/ }),
/* 603 */
/***/ (function(module, exports, __webpack_require__) {

var getNative = __webpack_require__(53),
    root = __webpack_require__(31);

/* Built-in method references that are verified to be native. */
var Promise = getNative(root, 'Promise');

module.exports = Promise;


/***/ }),
/* 604 */
/***/ (function(module, exports, __webpack_require__) {

var getNative = __webpack_require__(53),
    root = __webpack_require__(31);

/* Built-in method references that are verified to be native. */
var Set = getNative(root, 'Set');

module.exports = Set;


/***/ }),
/* 605 */
/***/ (function(module, exports, __webpack_require__) {

var getNative = __webpack_require__(53),
    root = __webpack_require__(31);

/* Built-in method references that are verified to be native. */
var WeakMap = getNative(root, 'WeakMap');

module.exports = WeakMap;


/***/ }),
/* 606 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


exports.__esModule = true;

var _propTypes = __webpack_require__(1);

var _propTypes2 = _interopRequireDefault(_propTypes);

var _componentOrElement = __webpack_require__(46);

var _componentOrElement2 = _interopRequireDefault(_componentOrElement);

var _react = __webpack_require__(0);

var _react2 = _interopRequireDefault(_react);

var _reactDom = __webpack_require__(12);

var _reactDom2 = _interopRequireDefault(_reactDom);

var _getContainer = __webpack_require__(282);

var _getContainer2 = _interopRequireDefault(_getContainer);

var _ownerDocument = __webpack_require__(283);

var _ownerDocument2 = _interopRequireDefault(_ownerDocument);

var _LegacyPortal = __webpack_require__(607);

var _LegacyPortal2 = _interopRequireDefault(_LegacyPortal);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

/**
 * The `<Portal/>` component renders its children into a new "subtree" outside of current component hierarchy.
 * You can think of it as a declarative `appendChild()`, or jQuery's `$.fn.appendTo()`.
 * The children of `<Portal/>` component will be appended to the `container` specified.
 */
var Portal = function (_React$Component) {
  _inherits(Portal, _React$Component);

  function Portal() {
    var _temp, _this, _ret;

    _classCallCheck(this, Portal);

    for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
      args[_key] = arguments[_key];
    }

    return _ret = (_temp = (_this = _possibleConstructorReturn(this, _React$Component.call.apply(_React$Component, [this].concat(args))), _this), _this.setContainer = function () {
      var props = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : _this.props;

      _this._portalContainerNode = (0, _getContainer2.default)(props.container, (0, _ownerDocument2.default)(_this).body);
    }, _this.getMountNode = function () {
      return _this._portalContainerNode;
    }, _temp), _possibleConstructorReturn(_this, _ret);
  }

  Portal.prototype.componentDidMount = function componentDidMount() {
    this.setContainer();
    this.forceUpdate(this.props.onRendered);
  };

  Portal.prototype.componentWillReceiveProps = function componentWillReceiveProps(nextProps) {
    if (nextProps.container !== this.props.container) {
      this.setContainer(nextProps);
    }
  };

  Portal.prototype.componentWillUnmount = function componentWillUnmount() {
    this._portalContainerNode = null;
  };

  Portal.prototype.render = function render() {
    return this.props.children && this._portalContainerNode ? _reactDom2.default.createPortal(this.props.children, this._portalContainerNode) : null;
  };

  return Portal;
}(_react2.default.Component);

Portal.displayName = 'Portal';
Portal.propTypes = {
  /**
   * A Node, Component instance, or function that returns either. The `container` will have the Portal children
   * appended to it.
   */
  container: _propTypes2.default.oneOfType([_componentOrElement2.default, _propTypes2.default.func]),

  onRendered: _propTypes2.default.func
};
exports.default = _reactDom2.default.createPortal ? Portal : _LegacyPortal2.default;
module.exports = exports['default'];

/***/ }),
/* 607 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


exports.__esModule = true;

var _propTypes = __webpack_require__(1);

var _propTypes2 = _interopRequireDefault(_propTypes);

var _componentOrElement = __webpack_require__(46);

var _componentOrElement2 = _interopRequireDefault(_componentOrElement);

var _react = __webpack_require__(0);

var _react2 = _interopRequireDefault(_react);

var _reactDom = __webpack_require__(12);

var _reactDom2 = _interopRequireDefault(_reactDom);

var _getContainer = __webpack_require__(282);

var _getContainer2 = _interopRequireDefault(_getContainer);

var _ownerDocument = __webpack_require__(283);

var _ownerDocument2 = _interopRequireDefault(_ownerDocument);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

/**
 * The `<Portal/>` component renders its children into a new "subtree" outside of current component hierarchy.
 * You can think of it as a declarative `appendChild()`, or jQuery's `$.fn.appendTo()`.
 * The children of `<Portal/>` component will be appended to the `container` specified.
 */
var Portal = function (_React$Component) {
  _inherits(Portal, _React$Component);

  function Portal() {
    var _temp, _this, _ret;

    _classCallCheck(this, Portal);

    for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
      args[_key] = arguments[_key];
    }

    return _ret = (_temp = (_this = _possibleConstructorReturn(this, _React$Component.call.apply(_React$Component, [this].concat(args))), _this), _this._mountOverlayTarget = function () {
      if (!_this._overlayTarget) {
        _this._overlayTarget = document.createElement('div');
        _this._portalContainerNode = (0, _getContainer2.default)(_this.props.container, (0, _ownerDocument2.default)(_this).body);
        _this._portalContainerNode.appendChild(_this._overlayTarget);
      }
    }, _this._unmountOverlayTarget = function () {
      if (_this._overlayTarget) {
        _this._portalContainerNode.removeChild(_this._overlayTarget);
        _this._overlayTarget = null;
      }
      _this._portalContainerNode = null;
    }, _this._renderOverlay = function () {
      var overlay = !_this.props.children ? null : _react2.default.Children.only(_this.props.children);

      // Save reference for future access.
      if (overlay !== null) {
        _this._mountOverlayTarget();

        var initialRender = !_this._overlayInstance;

        _this._overlayInstance = _reactDom2.default.unstable_renderSubtreeIntoContainer(_this, overlay, _this._overlayTarget, function () {
          if (initialRender && _this.props.onRendered) {
            _this.props.onRendered();
          }
        });
      } else {
        // Unrender if the component is null for transitions to null
        _this._unrenderOverlay();
        _this._unmountOverlayTarget();
      }
    }, _this._unrenderOverlay = function () {
      if (_this._overlayTarget) {
        _reactDom2.default.unmountComponentAtNode(_this._overlayTarget);
        _this._overlayInstance = null;
      }
    }, _this.getMountNode = function () {
      return _this._overlayTarget;
    }, _temp), _possibleConstructorReturn(_this, _ret);
  }

  Portal.prototype.componentDidMount = function componentDidMount() {
    this._isMounted = true;
    this._renderOverlay();
  };

  Portal.prototype.componentDidUpdate = function componentDidUpdate() {
    this._renderOverlay();
  };

  Portal.prototype.componentWillReceiveProps = function componentWillReceiveProps(nextProps) {
    if (this._overlayTarget && nextProps.container !== this.props.container) {
      this._portalContainerNode.removeChild(this._overlayTarget);
      this._portalContainerNode = (0, _getContainer2.default)(nextProps.container, (0, _ownerDocument2.default)(this).body);
      this._portalContainerNode.appendChild(this._overlayTarget);
    }
  };

  Portal.prototype.componentWillUnmount = function componentWillUnmount() {
    this._isMounted = false;
    this._unrenderOverlay();
    this._unmountOverlayTarget();
  };

  Portal.prototype.render = function render() {
    return null;
  };

  return Portal;
}(_react2.default.Component);

Portal.displayName = 'Portal';
Portal.propTypes = {
  /**
   * A Node, Component instance, or function that returns either. The `container` will have the Portal children
   * appended to it.
   */
  container: _propTypes2.default.oneOfType([_componentOrElement2.default, _propTypes2.default.func]),

  onRendered: _propTypes2.default.func
};
exports.default = Portal;
module.exports = exports['default'];

/***/ }),
/* 608 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, "__esModule", {
  value: true
});

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _classnames = __webpack_require__(5);

var _classnames2 = _interopRequireDefault(_classnames);

var _propTypes = __webpack_require__(1);

var _propTypes2 = _interopRequireDefault(_propTypes);

var _react = __webpack_require__(0);

var _react2 = _interopRequireDefault(_react);

var _ClearButton = __webpack_require__(284);

var _ClearButton2 = _interopRequireDefault(_ClearButton);

var _Loader = __webpack_require__(609);

var _Loader2 = _interopRequireDefault(_Loader);

var _HintedInput = __webpack_require__(610);

var _HintedInput2 = _interopRequireDefault(_HintedInput);

var _Token = __webpack_require__(285);

var _Token2 = _interopRequireDefault(_Token);

var _utils = __webpack_require__(54);

var _typeaheadInputContainer = __webpack_require__(648);

var _typeaheadInputContainer2 = _interopRequireDefault(_typeaheadInputContainer);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var TypeaheadInput = function (_React$Component) {
  _inherits(TypeaheadInput, _React$Component);

  function TypeaheadInput() {
    var _ref;

    var _temp, _this, _ret;

    _classCallCheck(this, TypeaheadInput);

    for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
      args[_key] = arguments[_key];
    }

    return _ret = (_temp = (_this = _possibleConstructorReturn(this, (_ref = TypeaheadInput.__proto__ || Object.getPrototypeOf(TypeaheadInput)).call.apply(_ref, [this].concat(args))), _this), _this._renderToken = function (option, idx) {
      var _this$props = _this.props,
          disabled = _this$props.disabled,
          inputProps = _this$props.inputProps,
          labelKey = _this$props.labelKey,
          onRemove = _this$props.onRemove,
          renderToken = _this$props.renderToken;

      var onRemoveWrapped = function onRemoveWrapped() {
        return onRemove(option);
      };

      if (typeof renderToken === 'function') {
        return renderToken(option, onRemoveWrapped, idx);
      }

      return _react2.default.createElement(
        _Token2.default,
        {
          disabled: disabled,
          key: idx,
          onRemove: onRemoveWrapped,
          tabIndex: inputProps.tabIndex },
        (0, _utils.getOptionLabel)(option, labelKey)
      );
    }, _this._renderAux = function () {
      var _this$props2 = _this.props,
          bsSize = _this$props2.bsSize,
          clearButton = _this$props2.clearButton,
          disabled = _this$props2.disabled,
          isLoading = _this$props2.isLoading,
          onClear = _this$props2.onClear,
          selected = _this$props2.selected;


      if (isLoading) {
        return _react2.default.createElement(
          'div',
          { className: 'rbt-aux' },
          _react2.default.createElement(_Loader2.default, { bsSize: bsSize })
        );
      }

      if (clearButton && !disabled && selected.length) {
        return _react2.default.createElement(
          'div',
          { className: 'rbt-aux' },
          _react2.default.createElement(_ClearButton2.default, {
            bsSize: bsSize,
            onClick: onClear,
            onFocus: function onFocus(e) {
              // Prevent the main input from auto-focusing again.
              e.stopPropagation();
            }
          })
        );
      }
    }, _temp), _possibleConstructorReturn(_this, _ret);
  }

  _createClass(TypeaheadInput, [{
    key: 'render',
    value: function render() {
      var _props = this.props,
          bsSize = _props.bsSize,
          disabled = _props.disabled,
          hintText = _props.hintText,
          inputRef = _props.inputRef,
          isFocused = _props.isFocused,
          multiple = _props.multiple,
          name = _props.name,
          onBlur = _props.onBlur,
          onChange = _props.onChange,
          onContainerClickOrFocus = _props.onContainerClickOrFocus,
          onFocus = _props.onFocus,
          onKeyDown = _props.onKeyDown,
          placeholder = _props.placeholder,
          selected = _props.selected,
          value = _props.value;


      var inputProps = _extends({}, this.props.inputProps, {
        disabled: disabled,
        hintText: hintText,
        inputRef: inputRef,
        isFocused: isFocused,
        multiple: multiple,
        name: name || this.props.inputProps.name,
        onBlur: onBlur,
        onChange: onChange,
        onClick: onFocus,
        onFocus: onFocus,
        onKeyDown: onKeyDown,
        placeholder: placeholder,
        value: value
      });

      return _react2.default.createElement(
        'div',
        {
          className: (0, _classnames2.default)('rbt-input', 'form-control', {
            'focus': isFocused,
            'input-lg form-control-lg': bsSize === 'large' || bsSize === 'lg',
            'input-sm form-control-sm': bsSize === 'small' || bsSize === 'sm',
            'rbt-input-multi': multiple
          }),
          disabled: disabled,
          onClick: onContainerClickOrFocus,
          onFocus: onContainerClickOrFocus,
          tabIndex: -1 },
        _react2.default.createElement(
          'div',
          { className: 'rbt-input-wrapper' },
          multiple && selected.map(this._renderToken),
          _react2.default.createElement(_HintedInput2.default, inputProps)
        ),
        this._renderAux()
      );
    }
  }]);

  return TypeaheadInput;
}(_react2.default.Component);

TypeaheadInput.propTypes = {
  /**
   * Provides a hook for customized rendering of tokens when multiple
   * selections are enabled.
   */
  renderToken: _propTypes2.default.func
};

exports.default = (0, _typeaheadInputContainer2.default)(TypeaheadInput);

/***/ }),
/* 609 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, "__esModule", {
  value: true
});

var _classnames = __webpack_require__(5);

var _classnames2 = _interopRequireDefault(_classnames);

var _react = __webpack_require__(0);

var _react2 = _interopRequireDefault(_react);

var _propTypes = __webpack_require__(1);

var _propTypes2 = _interopRequireDefault(_propTypes);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var Loader = function Loader(_ref) {
  var bsSize = _ref.bsSize;
  return _react2.default.createElement('div', {
    className: (0, _classnames2.default)('rbt-loader', {
      'rbt-loader-lg': bsSize === 'large' || bsSize === 'lg',
      'rbt-loader-sm': bsSize === 'small' || bsSize === 'sm'
    })
  });
};

Loader.propTypes = {
  bsSize: _propTypes2.default.oneOf(['large', 'lg', 'small', 'sm'])
};

exports.default = Loader;

/***/ }),
/* 610 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, "__esModule", {
  value: true
});

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _classnames = __webpack_require__(5);

var _classnames2 = _interopRequireDefault(_classnames);

var _propTypes = __webpack_require__(1);

var _propTypes2 = _interopRequireDefault(_propTypes);

var _react = __webpack_require__(0);

var _react2 = _interopRequireDefault(_react);

var _reactInputAutosize = __webpack_require__(611);

var _reactInputAutosize2 = _interopRequireDefault(_reactInputAutosize);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _objectWithoutProperties(obj, keys) { var target = {}; for (var i in obj) { if (keys.indexOf(i) >= 0) continue; if (!Object.prototype.hasOwnProperty.call(obj, i)) continue; target[i] = obj[i]; } return target; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var STYLES = {
  backgroundColor: 'transparent',
  border: 0,
  boxShadow: 'none',
  cursor: 'inherit',
  outline: 'none',
  padding: 0
};

var HintedInput = function (_React$Component) {
  _inherits(HintedInput, _React$Component);

  function HintedInput() {
    var _ref;

    var _temp, _this, _ret;

    _classCallCheck(this, HintedInput);

    for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
      args[_key] = arguments[_key];
    }

    return _ret = (_temp = (_this = _possibleConstructorReturn(this, (_ref = HintedInput.__proto__ || Object.getPrototypeOf(HintedInput)).call.apply(_ref, [this].concat(args))), _this), _this._renderHint = function () {
      var _this$props = _this.props,
          hintText = _this$props.hintText,
          isFocused = _this$props.isFocused,
          multiple = _this$props.multiple;

      // TODO: Support hinting for multi-selection.

      return multiple ? null : _react2.default.createElement(_reactInputAutosize2.default, {
        'aria-hidden': true,
        inputClassName: 'rbt-input-hint',
        inputStyle: _extends({}, STYLES, {
          color: 'rgba(0, 0, 0, 0.35)'
        }),
        style: {
          bottom: 0,
          display: 'block',
          position: 'absolute',
          top: 0,
          zIndex: 0
        },
        tabIndex: -1,
        value: isFocused ? hintText : ''
      });
    }, _temp), _possibleConstructorReturn(_this, _ret);
  }

  _createClass(HintedInput, [{
    key: 'render',
    value: function render() {
      var _props = this.props,
          className = _props.className,
          hintText = _props.hintText,
          inputRef = _props.inputRef,
          isFocused = _props.isFocused,
          multiple = _props.multiple,
          props = _objectWithoutProperties(_props, ['className', 'hintText', 'inputRef', 'isFocused', 'multiple']);

      return _react2.default.createElement(
        'div',
        { style: { display: 'inline-block', position: 'relative' } },
        _react2.default.createElement(_reactInputAutosize2.default, _extends({}, props, {
          autoComplete: 'off',
          inputClassName: (0, _classnames2.default)('rbt-input-main', className),
          inputStyle: STYLES,
          ref: inputRef,
          style: {
            position: 'relative',
            zIndex: 1
          }
        })),
        this._renderHint()
      );
    }
  }]);

  return HintedInput;
}(_react2.default.Component);

HintedInput.propTypes = {
  type: _propTypes2.default.string
};

HintedInput.defaultProps = {
  type: 'text'
};

exports.default = HintedInput;

/***/ }),
/* 611 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, "__esModule", {
	value: true
});

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _react = __webpack_require__(0);

var _react2 = _interopRequireDefault(_react);

var _propTypes = __webpack_require__(1);

var _propTypes2 = _interopRequireDefault(_propTypes);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _objectWithoutProperties(obj, keys) { var target = {}; for (var i in obj) { if (keys.indexOf(i) >= 0) continue; if (!Object.prototype.hasOwnProperty.call(obj, i)) continue; target[i] = obj[i]; } return target; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var sizerStyle = {
	position: 'absolute',
	top: 0,
	left: 0,
	visibility: 'hidden',
	height: 0,
	overflow: 'scroll',
	whiteSpace: 'pre'
};

var INPUT_PROPS_BLACKLIST = ['injectStyles', 'inputClassName', 'inputRef', 'inputStyle', 'minWidth', 'onAutosize', 'placeholderIsMinWidth'];

var cleanInputProps = function cleanInputProps(inputProps) {
	INPUT_PROPS_BLACKLIST.forEach(function (field) {
		return delete inputProps[field];
	});
	return inputProps;
};

var copyStyles = function copyStyles(styles, node) {
	node.style.fontSize = styles.fontSize;
	node.style.fontFamily = styles.fontFamily;
	node.style.fontWeight = styles.fontWeight;
	node.style.fontStyle = styles.fontStyle;
	node.style.letterSpacing = styles.letterSpacing;
	node.style.textTransform = styles.textTransform;
};

var isIE = typeof window === 'undefined' ? false : /MSIE |Trident\/|Edge\//.test(window.navigator.userAgent);

var generateId = function generateId() {
	// we only need an auto-generated ID for stylesheet injection, which is only
	// used for IE. so if the browser is not IE, this should return undefined.
	return isIE ? '_' + Math.random().toString(36).substr(2, 12) : undefined;
};

var AutosizeInput = function (_Component) {
	_inherits(AutosizeInput, _Component);

	function AutosizeInput(props) {
		_classCallCheck(this, AutosizeInput);

		var _this = _possibleConstructorReturn(this, (AutosizeInput.__proto__ || Object.getPrototypeOf(AutosizeInput)).call(this, props));

		_this.inputRef = function (el) {
			_this.input = el;
			if (typeof _this.props.inputRef === 'function') {
				_this.props.inputRef(el);
			}
		};

		_this.placeHolderSizerRef = function (el) {
			_this.placeHolderSizer = el;
		};

		_this.sizerRef = function (el) {
			_this.sizer = el;
		};

		_this.state = {
			inputWidth: props.minWidth,
			inputId: props.id || generateId()
		};
		return _this;
	}

	_createClass(AutosizeInput, [{
		key: 'componentDidMount',
		value: function componentDidMount() {
			this.mounted = true;
			this.copyInputStyles();
			this.updateInputWidth();
		}
	}, {
		key: 'componentWillReceiveProps',
		value: function componentWillReceiveProps(nextProps) {
			var id = nextProps.id;

			if (id !== this.props.id) {
				this.setState({ inputId: id || generateId() });
			}
		}
	}, {
		key: 'componentDidUpdate',
		value: function componentDidUpdate(prevProps, prevState) {
			if (prevState.inputWidth !== this.state.inputWidth) {
				if (typeof this.props.onAutosize === 'function') {
					this.props.onAutosize(this.state.inputWidth);
				}
			}
			this.updateInputWidth();
		}
	}, {
		key: 'componentWillUnmount',
		value: function componentWillUnmount() {
			this.mounted = false;
		}
	}, {
		key: 'copyInputStyles',
		value: function copyInputStyles() {
			if (!this.mounted || !window.getComputedStyle) {
				return;
			}
			var inputStyles = this.input && window.getComputedStyle(this.input);
			if (!inputStyles) {
				return;
			}
			copyStyles(inputStyles, this.sizer);
			if (this.placeHolderSizer) {
				copyStyles(inputStyles, this.placeHolderSizer);
			}
		}
	}, {
		key: 'updateInputWidth',
		value: function updateInputWidth() {
			if (!this.mounted || !this.sizer || typeof this.sizer.scrollWidth === 'undefined') {
				return;
			}
			var newInputWidth = void 0;
			if (this.props.placeholder && (!this.props.value || this.props.value && this.props.placeholderIsMinWidth)) {
				newInputWidth = Math.max(this.sizer.scrollWidth, this.placeHolderSizer.scrollWidth) + 2;
			} else {
				newInputWidth = this.sizer.scrollWidth + 2;
			}
			// allow for stepper UI on number types
			if (this.props.type === 'number') {
				newInputWidth += 16;
			}
			if (newInputWidth < this.props.minWidth) {
				newInputWidth = this.props.minWidth;
			}
			if (newInputWidth !== this.state.inputWidth) {
				this.setState({
					inputWidth: newInputWidth
				});
			}
		}
	}, {
		key: 'getInput',
		value: function getInput() {
			return this.input;
		}
	}, {
		key: 'focus',
		value: function focus() {
			this.input.focus();
		}
	}, {
		key: 'blur',
		value: function blur() {
			this.input.blur();
		}
	}, {
		key: 'select',
		value: function select() {
			this.input.select();
		}
	}, {
		key: 'renderStyles',
		value: function renderStyles() {
			// this method injects styles to hide IE's clear indicator, which messes
			// with input size detection. the stylesheet is only injected when the
			// browser is IE, and can also be disabled by the `injectStyles` prop.
			var injectStyles = this.props.injectStyles;

			return isIE && injectStyles ? _react2.default.createElement('style', { dangerouslySetInnerHTML: {
					__html: 'input#' + this.state.inputId + '::-ms-clear {display: none;}'
				} }) : null;
		}
	}, {
		key: 'render',
		value: function render() {
			var sizerValue = [this.props.defaultValue, this.props.value, ''].reduce(function (previousValue, currentValue) {
				if (previousValue !== null && previousValue !== undefined) {
					return previousValue;
				}
				return currentValue;
			});

			var wrapperStyle = _extends({}, this.props.style);
			if (!wrapperStyle.display) wrapperStyle.display = 'inline-block';

			var inputStyle = _extends({
				boxSizing: 'content-box',
				width: this.state.inputWidth + 'px'
			}, this.props.inputStyle);

			var inputProps = _objectWithoutProperties(this.props, []);

			cleanInputProps(inputProps);
			inputProps.className = this.props.inputClassName;
			inputProps.id = this.state.inputId;
			inputProps.style = inputStyle;

			return _react2.default.createElement(
				'div',
				{ className: this.props.className, style: wrapperStyle },
				this.renderStyles(),
				_react2.default.createElement('input', _extends({}, inputProps, { ref: this.inputRef })),
				_react2.default.createElement(
					'div',
					{ ref: this.sizerRef, style: sizerStyle },
					sizerValue
				),
				this.props.placeholder ? _react2.default.createElement(
					'div',
					{ ref: this.placeHolderSizerRef, style: sizerStyle },
					this.props.placeholder
				) : null
			);
		}
	}]);

	return AutosizeInput;
}(_react.Component);

;

AutosizeInput.propTypes = {
	className: _propTypes2.default.string, // className for the outer element
	defaultValue: _propTypes2.default.any, // default field value
	id: _propTypes2.default.string, // id to use for the input, can be set for consistent snapshots
	injectStyles: _propTypes2.default.bool, // inject the custom stylesheet to hide clear UI, defaults to true
	inputClassName: _propTypes2.default.string, // className for the input element
	inputRef: _propTypes2.default.func, // ref callback for the input element
	inputStyle: _propTypes2.default.object, // css styles for the input element
	minWidth: _propTypes2.default.oneOfType([// minimum width for input element
	_propTypes2.default.number, _propTypes2.default.string]),
	onAutosize: _propTypes2.default.func, // onAutosize handler: function(newWidth) {}
	onChange: _propTypes2.default.func, // onChange handler: function(newValue) {}
	placeholder: _propTypes2.default.string, // placeholder text
	placeholderIsMinWidth: _propTypes2.default.bool, // don't collapse size to less than the placeholder
	style: _propTypes2.default.object, // css styles for the outer element
	value: _propTypes2.default.any // field value
};
AutosizeInput.defaultProps = {
	minWidth: 1,
	injectStyles: true
};

exports.default = AutosizeInput;

/***/ }),
/* 612 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
/* WEBPACK VAR INJECTION */(function(process) {

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _invariant = __webpack_require__(59);

var _invariant2 = _interopRequireDefault(_invariant);

var _uniqueId = __webpack_require__(613);

var _uniqueId2 = _interopRequireDefault(_uniqueId);

var _getOptionLabel = __webpack_require__(110);

var _getOptionLabel2 = _interopRequireDefault(_getOptionLabel);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

function addCustomOption(results, text, labelKey) {
  var exactMatchFound = results.some(function (o) {
    return (0, _getOptionLabel2.default)(o, labelKey) === text;
  });

  if (!text.trim() || exactMatchFound) {
    return results;
  }

  !(typeof labelKey === 'string') ? process.env.NODE_ENV !== 'production' ? (0, _invariant2.default)(false, '`labelKey` must be a string when creating new options.') : (0, _invariant2.default)(false) : void 0;

  var customOption = _defineProperty({
    customOption: true,
    id: (0, _uniqueId2.default)('new-id-')
  }, labelKey, text);

  return [].concat(_toConsumableArray(results), [customOption]);
}

exports.default = addCustomOption;
/* WEBPACK VAR INJECTION */}.call(exports, __webpack_require__(10)))

/***/ }),
/* 613 */
/***/ (function(module, exports, __webpack_require__) {

var toString = __webpack_require__(288);

/** Used to generate unique IDs. */
var idCounter = 0;

/**
 * Generates a unique ID. If `prefix` is given, the ID is appended to it.
 *
 * @static
 * @since 0.1.0
 * @memberOf _
 * @category Util
 * @param {string} [prefix=''] The value to prefix the ID with.
 * @returns {string} Returns the unique ID.
 * @example
 *
 * _.uniqueId('contact_');
 * // => 'contact_104'
 *
 * _.uniqueId();
 * // => '105'
 */
function uniqueId(prefix) {
  var id = ++idCounter;
  return toString(prefix) + id;
}

module.exports = uniqueId;


/***/ }),
/* 614 */
/***/ (function(module, exports, __webpack_require__) {

var Symbol = __webpack_require__(81),
    arrayMap = __webpack_require__(615),
    isArray = __webpack_require__(24),
    isSymbol = __webpack_require__(103);

/** Used as references for various `Number` constants. */
var INFINITY = 1 / 0;

/** Used to convert symbols to primitives and strings. */
var symbolProto = Symbol ? Symbol.prototype : undefined,
    symbolToString = symbolProto ? symbolProto.toString : undefined;

/**
 * The base implementation of `_.toString` which doesn't convert nullish
 * values to empty strings.
 *
 * @private
 * @param {*} value The value to process.
 * @returns {string} Returns the string.
 */
function baseToString(value) {
  // Exit early for strings to avoid a performance hit in some environments.
  if (typeof value == 'string') {
    return value;
  }
  if (isArray(value)) {
    // Recursively convert values (susceptible to call stack limits).
    return arrayMap(value, baseToString) + '';
  }
  if (isSymbol(value)) {
    return symbolToString ? symbolToString.call(value) : '';
  }
  var result = (value + '');
  return (result == '0' && (1 / value) == -INFINITY) ? '-0' : result;
}

module.exports = baseToString;


/***/ }),
/* 615 */
/***/ (function(module, exports) {

/**
 * A specialized version of `_.map` for arrays without support for iteratee
 * shorthands.
 *
 * @private
 * @param {Array} [array] The array to iterate over.
 * @param {Function} iteratee The function invoked per iteration.
 * @returns {Array} Returns the new mapped array.
 */
function arrayMap(array, iteratee) {
  var index = -1,
      length = array == null ? 0 : array.length,
      result = Array(length);

  while (++index < length) {
    result[index] = iteratee(array[index], index, array);
  }
  return result;
}

module.exports = arrayMap;


/***/ }),
/* 616 */
/***/ (function(module, exports, __webpack_require__) {

var overArg = __webpack_require__(281);

/** Built-in value references. */
var getPrototype = overArg(Object.getPrototypeOf, Object);

module.exports = getPrototype;


/***/ }),
/* 617 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = defaultFilterBy;

var _isEqual = __webpack_require__(162);

var _isEqual2 = _interopRequireDefault(_isEqual);

var _isFunction = __webpack_require__(165);

var _isFunction2 = _interopRequireDefault(_isFunction);

var _isString = __webpack_require__(618);

var _isString2 = _interopRequireDefault(_isString);

var _some = __webpack_require__(619);

var _some2 = _interopRequireDefault(_some);

var _stripDiacritics = __webpack_require__(112);

var _stripDiacritics2 = _interopRequireDefault(_stripDiacritics);

var _warn = __webpack_require__(55);

var _warn2 = _interopRequireDefault(_warn);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function isMatch(input, string, props) {
  if (!props.caseSensitive) {
    input = input.toLowerCase();
    string = string.toLowerCase();
  }

  if (props.ignoreDiacritics) {
    input = (0, _stripDiacritics2.default)(input);
    string = (0, _stripDiacritics2.default)(string);
  }

  return string.indexOf(input) !== -1;
}

/**
 * Default algorithm for filtering results.
 */
function defaultFilterBy(option, state, props) {
  var selected = state.selected,
      text = state.text;
  var filterBy = props.filterBy,
      labelKey = props.labelKey,
      multiple = props.multiple;

  // Don't show selected options in the menu for the multi-select case.

  if (multiple && selected.some(function (o) {
    return (0, _isEqual2.default)(o, option);
  })) {
    return false;
  }

  var fields = filterBy.slice();

  if ((0, _isFunction2.default)(labelKey) && isMatch(text, labelKey(option), props)) {
    return true;
  }

  if ((0, _isString2.default)(labelKey)) {
    // Add the `labelKey` field to the list of fields if it isn't already there.
    if (fields.indexOf(labelKey) === -1) {
      fields.unshift(labelKey);
    }
  }

  if ((0, _isString2.default)(option)) {
    (0, _warn2.default)(fields.length <= 1, 'You cannot filter by properties when `option` is a string.');

    return isMatch(text, option, props);
  }

  return (0, _some2.default)(fields, function (field) {
    var value = option[field];

    if (!(0, _isString2.default)(value)) {
      (0, _warn2.default)(false, 'Fields passed to `filterBy` should have string values. Value will ' + 'be converted to a string; results may be unexpected.');

      // Coerce to string since `toString` isn't null-safe.
      value = value + '';
    }

    return isMatch(text, value, props);
  });
}

/***/ }),
/* 618 */
/***/ (function(module, exports, __webpack_require__) {

var baseGetTag = __webpack_require__(51),
    isArray = __webpack_require__(24),
    isObjectLike = __webpack_require__(52);

/** `Object#toString` result references. */
var stringTag = '[object String]';

/**
 * Checks if `value` is classified as a `String` primitive or object.
 *
 * @static
 * @since 0.1.0
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a string, else `false`.
 * @example
 *
 * _.isString('abc');
 * // => true
 *
 * _.isString(1);
 * // => false
 */
function isString(value) {
  return typeof value == 'string' ||
    (!isArray(value) && isObjectLike(value) && baseGetTag(value) == stringTag);
}

module.exports = isString;


/***/ }),
/* 619 */
/***/ (function(module, exports, __webpack_require__) {

var arraySome = __webpack_require__(277),
    baseIteratee = __webpack_require__(620),
    baseSome = __webpack_require__(634),
    isArray = __webpack_require__(24),
    isIterateeCall = __webpack_require__(640);

/**
 * Checks if `predicate` returns truthy for **any** element of `collection`.
 * Iteration is stopped once `predicate` returns truthy. The predicate is
 * invoked with three arguments: (value, index|key, collection).
 *
 * @static
 * @memberOf _
 * @since 0.1.0
 * @category Collection
 * @param {Array|Object} collection The collection to iterate over.
 * @param {Function} [predicate=_.identity] The function invoked per iteration.
 * @param- {Object} [guard] Enables use as an iteratee for methods like `_.map`.
 * @returns {boolean} Returns `true` if any element passes the predicate check,
 *  else `false`.
 * @example
 *
 * _.some([null, 0, 'yes', false], Boolean);
 * // => true
 *
 * var users = [
 *   { 'user': 'barney', 'active': true },
 *   { 'user': 'fred',   'active': false }
 * ];
 *
 * // The `_.matches` iteratee shorthand.
 * _.some(users, { 'user': 'barney', 'active': false });
 * // => false
 *
 * // The `_.matchesProperty` iteratee shorthand.
 * _.some(users, ['active', false]);
 * // => true
 *
 * // The `_.property` iteratee shorthand.
 * _.some(users, 'active');
 * // => true
 */
function some(collection, predicate, guard) {
  var func = isArray(collection) ? arraySome : baseSome;
  if (guard && isIterateeCall(collection, predicate, guard)) {
    predicate = undefined;
  }
  return func(collection, baseIteratee(predicate, 3));
}

module.exports = some;


/***/ }),
/* 620 */
/***/ (function(module, exports, __webpack_require__) {

var baseMatches = __webpack_require__(621),
    baseMatchesProperty = __webpack_require__(624),
    identity = __webpack_require__(293),
    isArray = __webpack_require__(24),
    property = __webpack_require__(631);

/**
 * The base implementation of `_.iteratee`.
 *
 * @private
 * @param {*} [value=_.identity] The value to convert to an iteratee.
 * @returns {Function} Returns the iteratee.
 */
function baseIteratee(value) {
  // Don't store the `typeof` result in a variable to avoid a JIT bug in Safari 9.
  // See https://bugs.webkit.org/show_bug.cgi?id=156034 for more details.
  if (typeof value == 'function') {
    return value;
  }
  if (value == null) {
    return identity;
  }
  if (typeof value == 'object') {
    return isArray(value)
      ? baseMatchesProperty(value[0], value[1])
      : baseMatches(value);
  }
  return property(value);
}

module.exports = baseIteratee;


/***/ }),
/* 621 */
/***/ (function(module, exports, __webpack_require__) {

var baseIsMatch = __webpack_require__(622),
    getMatchData = __webpack_require__(623),
    matchesStrictComparable = __webpack_require__(291);

/**
 * The base implementation of `_.matches` which doesn't clone `source`.
 *
 * @private
 * @param {Object} source The object of property values to match.
 * @returns {Function} Returns the new spec function.
 */
function baseMatches(source) {
  var matchData = getMatchData(source);
  if (matchData.length == 1 && matchData[0][2]) {
    return matchesStrictComparable(matchData[0][0], matchData[0][1]);
  }
  return function(object) {
    return object === source || baseIsMatch(object, source, matchData);
  };
}

module.exports = baseMatches;


/***/ }),
/* 622 */
/***/ (function(module, exports, __webpack_require__) {

var Stack = __webpack_require__(274),
    baseIsEqual = __webpack_require__(163);

/** Used to compose bitmasks for value comparisons. */
var COMPARE_PARTIAL_FLAG = 1,
    COMPARE_UNORDERED_FLAG = 2;

/**
 * The base implementation of `_.isMatch` without support for iteratee shorthands.
 *
 * @private
 * @param {Object} object The object to inspect.
 * @param {Object} source The object of property values to match.
 * @param {Array} matchData The property names, values, and compare flags to match.
 * @param {Function} [customizer] The function to customize comparisons.
 * @returns {boolean} Returns `true` if `object` is a match, else `false`.
 */
function baseIsMatch(object, source, matchData, customizer) {
  var index = matchData.length,
      length = index,
      noCustomizer = !customizer;

  if (object == null) {
    return !length;
  }
  object = Object(object);
  while (index--) {
    var data = matchData[index];
    if ((noCustomizer && data[2])
          ? data[1] !== object[data[0]]
          : !(data[0] in object)
        ) {
      return false;
    }
  }
  while (++index < length) {
    data = matchData[index];
    var key = data[0],
        objValue = object[key],
        srcValue = data[1];

    if (noCustomizer && data[2]) {
      if (objValue === undefined && !(key in object)) {
        return false;
      }
    } else {
      var stack = new Stack;
      if (customizer) {
        var result = customizer(objValue, srcValue, key, object, source, stack);
      }
      if (!(result === undefined
            ? baseIsEqual(srcValue, objValue, COMPARE_PARTIAL_FLAG | COMPARE_UNORDERED_FLAG, customizer, stack)
            : result
          )) {
        return false;
      }
    }
  }
  return true;
}

module.exports = baseIsMatch;


/***/ }),
/* 623 */
/***/ (function(module, exports, __webpack_require__) {

var isStrictComparable = __webpack_require__(290),
    keys = __webpack_require__(167);

/**
 * Gets the property names, values, and compare flags of `object`.
 *
 * @private
 * @param {Object} object The object to query.
 * @returns {Array} Returns the match data of `object`.
 */
function getMatchData(object) {
  var result = keys(object),
      length = result.length;

  while (length--) {
    var key = result[length],
        value = object[key];

    result[length] = [key, value, isStrictComparable(value)];
  }
  return result;
}

module.exports = getMatchData;


/***/ }),
/* 624 */
/***/ (function(module, exports, __webpack_require__) {

var baseIsEqual = __webpack_require__(163),
    get = __webpack_require__(625),
    hasIn = __webpack_require__(292),
    isKey = __webpack_require__(173),
    isStrictComparable = __webpack_require__(290),
    matchesStrictComparable = __webpack_require__(291),
    toKey = __webpack_require__(82);

/** Used to compose bitmasks for value comparisons. */
var COMPARE_PARTIAL_FLAG = 1,
    COMPARE_UNORDERED_FLAG = 2;

/**
 * The base implementation of `_.matchesProperty` which doesn't clone `srcValue`.
 *
 * @private
 * @param {string} path The path of the property to get.
 * @param {*} srcValue The value to match.
 * @returns {Function} Returns the new spec function.
 */
function baseMatchesProperty(path, srcValue) {
  if (isKey(path) && isStrictComparable(srcValue)) {
    return matchesStrictComparable(toKey(path), srcValue);
  }
  return function(object) {
    var objValue = get(object, path);
    return (objValue === undefined && objValue === srcValue)
      ? hasIn(object, path)
      : baseIsEqual(srcValue, objValue, COMPARE_PARTIAL_FLAG | COMPARE_UNORDERED_FLAG);
  };
}

module.exports = baseMatchesProperty;


/***/ }),
/* 625 */
/***/ (function(module, exports, __webpack_require__) {

var baseGet = __webpack_require__(172);

/**
 * Gets the value at `path` of `object`. If the resolved value is
 * `undefined`, the `defaultValue` is returned in its place.
 *
 * @static
 * @memberOf _
 * @since 3.7.0
 * @category Object
 * @param {Object} object The object to query.
 * @param {Array|string} path The path of the property to get.
 * @param {*} [defaultValue] The value returned for `undefined` resolved values.
 * @returns {*} Returns the resolved value.
 * @example
 *
 * var object = { 'a': [{ 'b': { 'c': 3 } }] };
 *
 * _.get(object, 'a[0].b.c');
 * // => 3
 *
 * _.get(object, ['a', '0', 'b', 'c']);
 * // => 3
 *
 * _.get(object, 'a.b.c', 'default');
 * // => 'default'
 */
function get(object, path, defaultValue) {
  var result = object == null ? undefined : baseGet(object, path);
  return result === undefined ? defaultValue : result;
}

module.exports = get;


/***/ }),
/* 626 */
/***/ (function(module, exports, __webpack_require__) {

var memoizeCapped = __webpack_require__(627);

/** Used to match property names within property paths. */
var reLeadingDot = /^\./,
    rePropName = /[^.[\]]+|\[(?:(-?\d+(?:\.\d+)?)|(["'])((?:(?!\2)[^\\]|\\.)*?)\2)\]|(?=(?:\.|\[\])(?:\.|\[\]|$))/g;

/** Used to match backslashes in property paths. */
var reEscapeChar = /\\(\\)?/g;

/**
 * Converts `string` to a property path array.
 *
 * @private
 * @param {string} string The string to convert.
 * @returns {Array} Returns the property path array.
 */
var stringToPath = memoizeCapped(function(string) {
  var result = [];
  if (reLeadingDot.test(string)) {
    result.push('');
  }
  string.replace(rePropName, function(match, number, quote, string) {
    result.push(quote ? string.replace(reEscapeChar, '$1') : (number || match));
  });
  return result;
});

module.exports = stringToPath;


/***/ }),
/* 627 */
/***/ (function(module, exports, __webpack_require__) {

var memoize = __webpack_require__(628);

/** Used as the maximum memoize cache size. */
var MAX_MEMOIZE_SIZE = 500;

/**
 * A specialized version of `_.memoize` which clears the memoized function's
 * cache when it exceeds `MAX_MEMOIZE_SIZE`.
 *
 * @private
 * @param {Function} func The function to have its output memoized.
 * @returns {Function} Returns the new memoized function.
 */
function memoizeCapped(func) {
  var result = memoize(func, function(key) {
    if (cache.size === MAX_MEMOIZE_SIZE) {
      cache.clear();
    }
    return key;
  });

  var cache = result.cache;
  return result;
}

module.exports = memoizeCapped;


/***/ }),
/* 628 */
/***/ (function(module, exports, __webpack_require__) {

var MapCache = __webpack_require__(166);

/** Error message constants. */
var FUNC_ERROR_TEXT = 'Expected a function';

/**
 * Creates a function that memoizes the result of `func`. If `resolver` is
 * provided, it determines the cache key for storing the result based on the
 * arguments provided to the memoized function. By default, the first argument
 * provided to the memoized function is used as the map cache key. The `func`
 * is invoked with the `this` binding of the memoized function.
 *
 * **Note:** The cache is exposed as the `cache` property on the memoized
 * function. Its creation may be customized by replacing the `_.memoize.Cache`
 * constructor with one whose instances implement the
 * [`Map`](http://ecma-international.org/ecma-262/7.0/#sec-properties-of-the-map-prototype-object)
 * method interface of `clear`, `delete`, `get`, `has`, and `set`.
 *
 * @static
 * @memberOf _
 * @since 0.1.0
 * @category Function
 * @param {Function} func The function to have its output memoized.
 * @param {Function} [resolver] The function to resolve the cache key.
 * @returns {Function} Returns the new memoized function.
 * @example
 *
 * var object = { 'a': 1, 'b': 2 };
 * var other = { 'c': 3, 'd': 4 };
 *
 * var values = _.memoize(_.values);
 * values(object);
 * // => [1, 2]
 *
 * values(other);
 * // => [3, 4]
 *
 * object.a = 2;
 * values(object);
 * // => [1, 2]
 *
 * // Modify the result cache.
 * values.cache.set(object, ['a', 'b']);
 * values(object);
 * // => ['a', 'b']
 *
 * // Replace `_.memoize.Cache`.
 * _.memoize.Cache = WeakMap;
 */
function memoize(func, resolver) {
  if (typeof func != 'function' || (resolver != null && typeof resolver != 'function')) {
    throw new TypeError(FUNC_ERROR_TEXT);
  }
  var memoized = function() {
    var args = arguments,
        key = resolver ? resolver.apply(this, args) : args[0],
        cache = memoized.cache;

    if (cache.has(key)) {
      return cache.get(key);
    }
    var result = func.apply(this, args);
    memoized.cache = cache.set(key, result) || cache;
    return result;
  };
  memoized.cache = new (memoize.Cache || MapCache);
  return memoized;
}

// Expose `MapCache`.
memoize.Cache = MapCache;

module.exports = memoize;


/***/ }),
/* 629 */
/***/ (function(module, exports) {

/**
 * The base implementation of `_.hasIn` without support for deep paths.
 *
 * @private
 * @param {Object} [object] The object to query.
 * @param {Array|string} key The key to check.
 * @returns {boolean} Returns `true` if `key` exists, else `false`.
 */
function baseHasIn(object, key) {
  return object != null && key in Object(object);
}

module.exports = baseHasIn;


/***/ }),
/* 630 */
/***/ (function(module, exports, __webpack_require__) {

var castPath = __webpack_require__(111),
    isArguments = __webpack_require__(168),
    isArray = __webpack_require__(24),
    isIndex = __webpack_require__(109),
    isLength = __webpack_require__(169),
    toKey = __webpack_require__(82);

/**
 * Checks if `path` exists on `object`.
 *
 * @private
 * @param {Object} object The object to query.
 * @param {Array|string} path The path to check.
 * @param {Function} hasFunc The function to check properties.
 * @returns {boolean} Returns `true` if `path` exists, else `false`.
 */
function hasPath(object, path, hasFunc) {
  path = castPath(path, object);

  var index = -1,
      length = path.length,
      result = false;

  while (++index < length) {
    var key = toKey(path[index]);
    if (!(result = object != null && hasFunc(object, key))) {
      break;
    }
    object = object[key];
  }
  if (result || ++index != length) {
    return result;
  }
  length = object == null ? 0 : object.length;
  return !!length && isLength(length) && isIndex(key, length) &&
    (isArray(object) || isArguments(object));
}

module.exports = hasPath;


/***/ }),
/* 631 */
/***/ (function(module, exports, __webpack_require__) {

var baseProperty = __webpack_require__(632),
    basePropertyDeep = __webpack_require__(633),
    isKey = __webpack_require__(173),
    toKey = __webpack_require__(82);

/**
 * Creates a function that returns the value at `path` of a given object.
 *
 * @static
 * @memberOf _
 * @since 2.4.0
 * @category Util
 * @param {Array|string} path The path of the property to get.
 * @returns {Function} Returns the new accessor function.
 * @example
 *
 * var objects = [
 *   { 'a': { 'b': 2 } },
 *   { 'a': { 'b': 1 } }
 * ];
 *
 * _.map(objects, _.property('a.b'));
 * // => [2, 1]
 *
 * _.map(_.sortBy(objects, _.property(['a', 'b'])), 'a.b');
 * // => [1, 2]
 */
function property(path) {
  return isKey(path) ? baseProperty(toKey(path)) : basePropertyDeep(path);
}

module.exports = property;


/***/ }),
/* 632 */
/***/ (function(module, exports) {

/**
 * The base implementation of `_.property` without support for deep paths.
 *
 * @private
 * @param {string} key The key of the property to get.
 * @returns {Function} Returns the new accessor function.
 */
function baseProperty(key) {
  return function(object) {
    return object == null ? undefined : object[key];
  };
}

module.exports = baseProperty;


/***/ }),
/* 633 */
/***/ (function(module, exports, __webpack_require__) {

var baseGet = __webpack_require__(172);

/**
 * A specialized version of `baseProperty` which supports deep paths.
 *
 * @private
 * @param {Array|string} path The path of the property to get.
 * @returns {Function} Returns the new accessor function.
 */
function basePropertyDeep(path) {
  return function(object) {
    return baseGet(object, path);
  };
}

module.exports = basePropertyDeep;


/***/ }),
/* 634 */
/***/ (function(module, exports, __webpack_require__) {

var baseEach = __webpack_require__(635);

/**
 * The base implementation of `_.some` without support for iteratee shorthands.
 *
 * @private
 * @param {Array|Object} collection The collection to iterate over.
 * @param {Function} predicate The function invoked per iteration.
 * @returns {boolean} Returns `true` if any element passes the predicate check,
 *  else `false`.
 */
function baseSome(collection, predicate) {
  var result;

  baseEach(collection, function(value, index, collection) {
    result = predicate(value, index, collection);
    return !result;
  });
  return !!result;
}

module.exports = baseSome;


/***/ }),
/* 635 */
/***/ (function(module, exports, __webpack_require__) {

var baseForOwn = __webpack_require__(636),
    createBaseEach = __webpack_require__(639);

/**
 * The base implementation of `_.forEach` without support for iteratee shorthands.
 *
 * @private
 * @param {Array|Object} collection The collection to iterate over.
 * @param {Function} iteratee The function invoked per iteration.
 * @returns {Array|Object} Returns `collection`.
 */
var baseEach = createBaseEach(baseForOwn);

module.exports = baseEach;


/***/ }),
/* 636 */
/***/ (function(module, exports, __webpack_require__) {

var baseFor = __webpack_require__(637),
    keys = __webpack_require__(167);

/**
 * The base implementation of `_.forOwn` without support for iteratee shorthands.
 *
 * @private
 * @param {Object} object The object to iterate over.
 * @param {Function} iteratee The function invoked per iteration.
 * @returns {Object} Returns `object`.
 */
function baseForOwn(object, iteratee) {
  return object && baseFor(object, iteratee, keys);
}

module.exports = baseForOwn;


/***/ }),
/* 637 */
/***/ (function(module, exports, __webpack_require__) {

var createBaseFor = __webpack_require__(638);

/**
 * The base implementation of `baseForOwn` which iterates over `object`
 * properties returned by `keysFunc` and invokes `iteratee` for each property.
 * Iteratee functions may exit iteration early by explicitly returning `false`.
 *
 * @private
 * @param {Object} object The object to iterate over.
 * @param {Function} iteratee The function invoked per iteration.
 * @param {Function} keysFunc The function to get the keys of `object`.
 * @returns {Object} Returns `object`.
 */
var baseFor = createBaseFor();

module.exports = baseFor;


/***/ }),
/* 638 */
/***/ (function(module, exports) {

/**
 * Creates a base function for methods like `_.forIn` and `_.forOwn`.
 *
 * @private
 * @param {boolean} [fromRight] Specify iterating from right to left.
 * @returns {Function} Returns the new base function.
 */
function createBaseFor(fromRight) {
  return function(object, iteratee, keysFunc) {
    var index = -1,
        iterable = Object(object),
        props = keysFunc(object),
        length = props.length;

    while (length--) {
      var key = props[fromRight ? length : ++index];
      if (iteratee(iterable[key], key, iterable) === false) {
        break;
      }
    }
    return object;
  };
}

module.exports = createBaseFor;


/***/ }),
/* 639 */
/***/ (function(module, exports, __webpack_require__) {

var isArrayLike = __webpack_require__(170);

/**
 * Creates a `baseEach` or `baseEachRight` function.
 *
 * @private
 * @param {Function} eachFunc The function to iterate over a collection.
 * @param {boolean} [fromRight] Specify iterating from right to left.
 * @returns {Function} Returns the new base function.
 */
function createBaseEach(eachFunc, fromRight) {
  return function(collection, iteratee) {
    if (collection == null) {
      return collection;
    }
    if (!isArrayLike(collection)) {
      return eachFunc(collection, iteratee);
    }
    var length = collection.length,
        index = fromRight ? length : -1,
        iterable = Object(collection);

    while ((fromRight ? index-- : ++index < length)) {
      if (iteratee(iterable[index], index, iterable) === false) {
        break;
      }
    }
    return collection;
  };
}

module.exports = createBaseEach;


/***/ }),
/* 640 */
/***/ (function(module, exports, __webpack_require__) {

var eq = __webpack_require__(106),
    isArrayLike = __webpack_require__(170),
    isIndex = __webpack_require__(109),
    isObject = __webpack_require__(50);

/**
 * Checks if the given arguments are from an iteratee call.
 *
 * @private
 * @param {*} value The potential iteratee value argument.
 * @param {*} index The potential iteratee index or key argument.
 * @param {*} object The potential iteratee object argument.
 * @returns {boolean} Returns `true` if the arguments are from an iteratee call,
 *  else `false`.
 */
function isIterateeCall(value, index, object) {
  if (!isObject(object)) {
    return false;
  }
  var type = typeof index;
  if (type == 'number'
        ? (isArrayLike(object) && isIndex(index, object.length))
        : (type == 'string' && index in object)
      ) {
    return eq(object[index], value);
  }
  return false;
}

module.exports = isIterateeCall;


/***/ }),
/* 641 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, "__esModule", {
  value: true
});
function getAccessibilityStatus(results, menuVisible, props) {
  var a11yNumResults = props.a11yNumResults,
      a11yNumSelected = props.a11yNumSelected,
      emptyLabel = props.emptyLabel,
      selected = props.selected;

  // If the menu is hidden, display info about the number of selections.

  if (!menuVisible) {
    return a11yNumSelected(selected);
  }

  // Display info about the number of matches.
  if (results.length === 0) {
    return emptyLabel;
  }

  return a11yNumResults(results);
}

exports.default = getAccessibilityStatus;

/***/ }),
/* 642 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = getDisplayName;
function getDisplayName(WrappedComponent) {
  return WrappedComponent.displayName || WrappedComponent.name || 'Component';
}

/***/ }),
/* 643 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, "__esModule", {
  value: true
});

var _getOptionLabel = __webpack_require__(110);

var _getOptionLabel2 = _interopRequireDefault(_getOptionLabel);

var _stripDiacritics = __webpack_require__(112);

var _stripDiacritics2 = _interopRequireDefault(_stripDiacritics);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function getHintText(_ref) {
  var activeItem = _ref.activeItem,
      initialItem = _ref.initialItem,
      labelKey = _ref.labelKey,
      minLength = _ref.minLength,
      selected = _ref.selected,
      text = _ref.text;

  // Don't display a hint under the following conditions:
  if (
  // No text entered.
  !text ||
  // Text doesn't meet `minLength` threshold.
  text.length < minLength ||
  // No item in the menu.
  !initialItem ||
  // The initial item is a custom option.
  initialItem.customOption ||
  // One of the menu items is active.
  activeItem ||
  // There's already a selection.
  !!selected.length) {
    return '';
  }

  var initialItemStr = (0, _getOptionLabel2.default)(initialItem, labelKey);

  if (
  // The input text corresponds to the beginning of the first option.
  // Always strip accents and convert to lower case, since the options are
  // already filtered at this point.
  (0, _stripDiacritics2.default)(initialItemStr.toLowerCase()).indexOf((0, _stripDiacritics2.default)(text.toLowerCase())) !== 0) {
    return '';
  }

  // Text matching is case- and accent-insensitive, so to display the hint
  // correctly, splice the input text with the rest of the actual string.
  return text + initialItemStr.slice(text.length, initialItemStr.length);
}

exports.default = getHintText;

/***/ }),
/* 644 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, "__esModule", {
  value: true
});

var _head = __webpack_require__(174);

var _head2 = _interopRequireDefault(_head);

var _getOptionLabel = __webpack_require__(110);

var _getOptionLabel2 = _interopRequireDefault(_getOptionLabel);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function getInputText(_ref) {
  var activeItem = _ref.activeItem,
      labelKey = _ref.labelKey,
      multiple = _ref.multiple,
      selected = _ref.selected,
      text = _ref.text;

  if (multiple) {
    return text;
  }

  if (activeItem) {
    return (0, _getOptionLabel2.default)(activeItem, labelKey);
  }

  var selectedItem = !!selected.length && (0, _head2.default)(selected);
  if (selectedItem) {
    return (0, _getOptionLabel2.default)(selectedItem, labelKey);
  }

  return text;
}

exports.default = getInputText;

/***/ }),
/* 645 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, "__esModule", {
  value: true
});
/**
 * Truncates the result set based on `maxResults` and returns the new set.
 */
function getTruncatedOptions(options, maxResults) {
  if (!maxResults || maxResults >= options.length) {
    return options;
  }

  return options.slice(0, maxResults);
}

exports.default = getTruncatedOptions;

/***/ }),
/* 646 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = pluralize;
/**
 * Basic util for pluralizing words. By default, simply adds an 's' to the word.
 * Also allows for a custom plural version.
 */
function pluralize(text, count, plural) {
  plural = plural || text + "s";
  return count === 1 ? "1 " + text : count + " " + plural;
}

/***/ }),
/* 647 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, "__esModule", {
  value: true
});
/**
 * Partial polyfill for webkit `scrollIntoViewIfNeeded()` method. Addresses
 * vertical scrolling only.
 *
 * Inspired by https://gist.github.com/hsablonniere/2581101, but uses
 * `getBoundingClientRect`.
 */
function scrollIntoViewIfNeeded(node) {
  // Webkit browsers
  if (Element.prototype.scrollIntoViewIfNeeded) {
    node.scrollIntoViewIfNeeded();
    return;
  }

  // FF, IE, etc.
  var rect = node.getBoundingClientRect();
  var parent = node.parentNode;
  var parentRect = parent.getBoundingClientRect();

  var parentComputedStyle = window.getComputedStyle(parent, null);
  var parentBorderTopWidth = parseInt(parentComputedStyle.getPropertyValue('border-top-width'));

  if (rect.top < parentRect.top || rect.bottom > parentRect.bottom) {
    parent.scrollTop = node.offsetTop - parent.offsetTop - parent.clientHeight / 2 - parentBorderTopWidth + node.clientHeight / 2;
  }
}

exports.default = scrollIntoViewIfNeeded;

/***/ }),
/* 648 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, "__esModule", {
  value: true
});

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _head = __webpack_require__(174);

var _head2 = _interopRequireDefault(_head);

var _react = __webpack_require__(0);

var _react2 = _interopRequireDefault(_react);

var _reactDom = __webpack_require__(12);

var _utils = __webpack_require__(54);

var _keyCode = __webpack_require__(113);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

function typeaheadInputContainer(Input) {
  var WrappedInput = function (_React$Component) {
    _inherits(WrappedInput, _React$Component);

    function WrappedInput() {
      var _ref;

      var _temp, _this, _ret;

      _classCallCheck(this, WrappedInput);

      for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
        args[_key] = arguments[_key];
      }

      return _ret = (_temp = (_this = _possibleConstructorReturn(this, (_ref = WrappedInput.__proto__ || Object.getPrototypeOf(WrappedInput)).call.apply(_ref, [this].concat(args))), _this), _this.state = {
        isFocused: false
      }, _this._handleBlur = function (e) {
        // Note: Don't hide the menu here, since that interferes with other
        // actions like making a selection by clicking on a menu item.
        _this.props.onBlur(e);
        _this.setState({ isFocused: false });
      }, _this._handleChange = function (e) {
        var _this$props = _this.props,
            multiple = _this$props.multiple,
            onChange = _this$props.onChange,
            onRemove = _this$props.onRemove,
            selected = _this$props.selected;


        if (!multiple) {
          // Clear any selections when text is entered.
          !!selected.length && onRemove((0, _head2.default)(selected));
        }

        onChange(e.target.value);
      }, _this._handleFocus = function (e) {
        _this.props.onFocus(e);
        _this.setState({ isFocused: true });
      }, _this._handleContainerClickOrFocus = function (e) {
        // Don't focus the input if it's disabled.
        if (_this.props.disabled) {
          e.target.blur();
          return;
        }

        // Move cursor to the end if the user clicks outside the actual input.
        var inputNode = _this.getInputNode();
        if (e.target !== inputNode) {
          inputNode.selectionStart = inputNode.value.length;
        }

        inputNode.focus();
      }, _this._handleKeyDown = function (e) {
        var _this$props2 = _this.props,
            activeItem = _this$props2.activeItem,
            initialItem = _this$props2.initialItem,
            multiple = _this$props2.multiple,
            onAdd = _this$props2.onAdd,
            selected = _this$props2.selected,
            selectHintOnEnter = _this$props2.selectHintOnEnter;


        var value = (0, _utils.getInputText)(_this.props);

        switch (e.keyCode) {
          case _keyCode.BACKSPACE:
            if (!multiple) {
              break;
            }

            var inputContainer = (0, _reactDom.findDOMNode)(_this._input);
            if (inputContainer && inputContainer.contains(document.activeElement) && !value) {
              // If the input is selected and there is no text, select the last
              // token when the user hits backspace.
              var sibling = inputContainer.parentElement.previousSibling;
              sibling && sibling.focus();

              // Prevent browser "back" action.
              e.preventDefault();
            }
            break;
          case _keyCode.RETURN:
          case _keyCode.RIGHT:
          case _keyCode.TAB:
            // TODO: Support hinting for multi-selection.
            if (multiple) {
              break;
            }

            var hintText = (0, _utils.getHintText)(_this.props);
            var selectionStart = e.target.selectionStart;

            // Autocomplete the selection if all of the following are true:

            if (
            // There's a hint or a menu item is highlighted.
            (hintText || activeItem) &&
            // There's no current selection.
            !selected.length &&
            // The input cursor is at the end of the text string when the user
            // hits the right arrow key.
            !(e.keyCode === _keyCode.RIGHT && selectionStart !== value.length) && !(e.keyCode === _keyCode.RETURN && !selectHintOnEnter)) {
              e.preventDefault();

              var selectedOption = hintText ? initialItem : activeItem;

              onAdd && onAdd(selectedOption);
            }
            break;
        }

        _this.props.onKeyDown(e);
      }, _temp), _possibleConstructorReturn(_this, _ret);
    }

    _createClass(WrappedInput, [{
      key: 'render',
      value: function render() {
        var _this2 = this;

        var _props = this.props,
            placeholder = _props.placeholder,
            selected = _props.selected;


        return _react2.default.createElement(Input, _extends({}, this.props, this.state, {
          hintText: (0, _utils.getHintText)(this.props),
          inputRef: function inputRef(input) {
            return _this2._input = input;
          },
          onBlur: this._handleBlur,
          onChange: this._handleChange,
          onContainerClickOrFocus: this._handleContainerClickOrFocus,
          onFocus: this._handleFocus,
          onKeyDown: this._handleKeyDown,
          placeholder: selected.length ? null : placeholder,
          value: (0, _utils.getInputText)(this.props)
        }));
      }
    }, {
      key: 'getInputNode',
      value: function getInputNode() {
        return this._input.getInput();
      }

      /**
       * Forward click or focus events on the container element to the input.
       */

    }]);

    return WrappedInput;
  }(_react2.default.Component);

  return WrappedInput;
}

exports.default = typeaheadInputContainer;

/***/ }),
/* 649 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _pick = __webpack_require__(650);

var _pick2 = _interopRequireDefault(_pick);

var _react = __webpack_require__(0);

var _react2 = _interopRequireDefault(_react);

var _propTypes = __webpack_require__(1);

var _propTypes2 = _interopRequireDefault(_propTypes);

var _Highlighter = __webpack_require__(666);

var _Highlighter2 = _interopRequireDefault(_Highlighter);

var _Menu = __webpack_require__(295);

var _Menu2 = _interopRequireDefault(_Menu);

var _MenuItem = __webpack_require__(175);

var _MenuItem2 = _interopRequireDefault(_MenuItem);

var _utils = __webpack_require__(54);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var TypeaheadMenu = function (_React$Component) {
  _inherits(TypeaheadMenu, _React$Component);

  function TypeaheadMenu() {
    var _ref;

    var _temp, _this, _ret;

    _classCallCheck(this, TypeaheadMenu);

    for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
      args[_key] = arguments[_key];
    }

    return _ret = (_temp = (_this = _possibleConstructorReturn(this, (_ref = TypeaheadMenu.__proto__ || Object.getPrototypeOf(TypeaheadMenu)).call.apply(_ref, [this].concat(args))), _this), _this._renderMenuItem = function (option, idx) {
      var _this$props = _this.props,
          labelKey = _this$props.labelKey,
          newSelectionPrefix = _this$props.newSelectionPrefix,
          renderMenuItemChildren = _this$props.renderMenuItemChildren,
          text = _this$props.text;


      var menuItemProps = {
        disabled: option.disabled,
        key: idx,
        option: option,
        position: idx
      };

      if (option.customOption) {
        return _react2.default.createElement(
          _MenuItem2.default,
          menuItemProps,
          newSelectionPrefix,
          _react2.default.createElement(
            _Highlighter2.default,
            { search: text },
            option[labelKey]
          )
        );
      }

      return renderMenuItemChildren ? _react2.default.createElement(
        _MenuItem2.default,
        menuItemProps,
        renderMenuItemChildren(option, _this.props, idx)
      ) : _react2.default.createElement(
        _MenuItem2.default,
        menuItemProps,
        _react2.default.createElement(
          _Highlighter2.default,
          { search: text },
          (0, _utils.getOptionLabel)(option, labelKey)
        )
      );
    }, _temp), _possibleConstructorReturn(_this, _ret);
  }

  _createClass(TypeaheadMenu, [{
    key: 'render',
    value: function render() {
      var menuProps = (0, _pick2.default)(this.props, ['align', 'className', 'dropup', 'emptyLabel', 'maxHeight', 'onPaginate', 'paginate', 'paginationText', 'style']);

      return _react2.default.createElement(
        _Menu2.default,
        menuProps,
        this.props.options.map(this._renderMenuItem)
      );
    }
  }]);

  return TypeaheadMenu;
}(_react2.default.Component);

/**
 * In addition to the propTypes below, the following props are automatically
 * passed down by `Typeahead`:
 *
 *  - labelKey
 *  - onPaginate
 *  - options
 *  - paginate
 *  - text
 */


TypeaheadMenu.propTypes = {
  /**
   * Provides the ability to specify a prefix before the user-entered text to
   * indicate that the selection will be new. No-op unless `allowNew={true}`.
   */
  newSelectionPrefix: _propTypes2.default.string,
  /**
   * Provides a hook for customized rendering of menu item contents.
   */
  renderMenuItemChildren: _propTypes2.default.func
};

TypeaheadMenu.defaultProps = {
  newSelectionPrefix: 'New selection: '
};

exports.default = TypeaheadMenu;

/***/ }),
/* 650 */
/***/ (function(module, exports, __webpack_require__) {

var basePick = __webpack_require__(651),
    flatRest = __webpack_require__(656);

/**
 * Creates an object composed of the picked `object` properties.
 *
 * @static
 * @since 0.1.0
 * @memberOf _
 * @category Object
 * @param {Object} object The source object.
 * @param {...(string|string[])} [paths] The property paths to pick.
 * @returns {Object} Returns the new object.
 * @example
 *
 * var object = { 'a': 1, 'b': '2', 'c': 3 };
 *
 * _.pick(object, ['a', 'c']);
 * // => { 'a': 1, 'c': 3 }
 */
var pick = flatRest(function(object, paths) {
  return object == null ? {} : basePick(object, paths);
});

module.exports = pick;


/***/ }),
/* 651 */
/***/ (function(module, exports, __webpack_require__) {

var basePickBy = __webpack_require__(652),
    hasIn = __webpack_require__(292);

/**
 * The base implementation of `_.pick` without support for individual
 * property identifiers.
 *
 * @private
 * @param {Object} object The source object.
 * @param {string[]} paths The property paths to pick.
 * @returns {Object} Returns the new object.
 */
function basePick(object, paths) {
  return basePickBy(object, paths, function(value, path) {
    return hasIn(object, path);
  });
}

module.exports = basePick;


/***/ }),
/* 652 */
/***/ (function(module, exports, __webpack_require__) {

var baseGet = __webpack_require__(172),
    baseSet = __webpack_require__(653),
    castPath = __webpack_require__(111);

/**
 * The base implementation of  `_.pickBy` without support for iteratee shorthands.
 *
 * @private
 * @param {Object} object The source object.
 * @param {string[]} paths The property paths to pick.
 * @param {Function} predicate The function invoked per property.
 * @returns {Object} Returns the new object.
 */
function basePickBy(object, paths, predicate) {
  var index = -1,
      length = paths.length,
      result = {};

  while (++index < length) {
    var path = paths[index],
        value = baseGet(object, path);

    if (predicate(value, path)) {
      baseSet(result, castPath(path, object), value);
    }
  }
  return result;
}

module.exports = basePickBy;


/***/ }),
/* 653 */
/***/ (function(module, exports, __webpack_require__) {

var assignValue = __webpack_require__(654),
    castPath = __webpack_require__(111),
    isIndex = __webpack_require__(109),
    isObject = __webpack_require__(50),
    toKey = __webpack_require__(82);

/**
 * The base implementation of `_.set`.
 *
 * @private
 * @param {Object} object The object to modify.
 * @param {Array|string} path The path of the property to set.
 * @param {*} value The value to set.
 * @param {Function} [customizer] The function to customize path creation.
 * @returns {Object} Returns `object`.
 */
function baseSet(object, path, value, customizer) {
  if (!isObject(object)) {
    return object;
  }
  path = castPath(path, object);

  var index = -1,
      length = path.length,
      lastIndex = length - 1,
      nested = object;

  while (nested != null && ++index < length) {
    var key = toKey(path[index]),
        newValue = value;

    if (index != lastIndex) {
      var objValue = nested[key];
      newValue = customizer ? customizer(objValue, key, nested) : undefined;
      if (newValue === undefined) {
        newValue = isObject(objValue)
          ? objValue
          : (isIndex(path[index + 1]) ? [] : {});
      }
    }
    assignValue(nested, key, newValue);
    nested = nested[key];
  }
  return object;
}

module.exports = baseSet;


/***/ }),
/* 654 */
/***/ (function(module, exports, __webpack_require__) {

var baseAssignValue = __webpack_require__(655),
    eq = __webpack_require__(106);

/** Used for built-in method references. */
var objectProto = Object.prototype;

/** Used to check objects for own properties. */
var hasOwnProperty = objectProto.hasOwnProperty;

/**
 * Assigns `value` to `key` of `object` if the existing value is not equivalent
 * using [`SameValueZero`](http://ecma-international.org/ecma-262/7.0/#sec-samevaluezero)
 * for equality comparisons.
 *
 * @private
 * @param {Object} object The object to modify.
 * @param {string} key The key of the property to assign.
 * @param {*} value The value to assign.
 */
function assignValue(object, key, value) {
  var objValue = object[key];
  if (!(hasOwnProperty.call(object, key) && eq(objValue, value)) ||
      (value === undefined && !(key in object))) {
    baseAssignValue(object, key, value);
  }
}

module.exports = assignValue;


/***/ }),
/* 655 */
/***/ (function(module, exports, __webpack_require__) {

var defineProperty = __webpack_require__(294);

/**
 * The base implementation of `assignValue` and `assignMergeValue` without
 * value checks.
 *
 * @private
 * @param {Object} object The object to modify.
 * @param {string} key The key of the property to assign.
 * @param {*} value The value to assign.
 */
function baseAssignValue(object, key, value) {
  if (key == '__proto__' && defineProperty) {
    defineProperty(object, key, {
      'configurable': true,
      'enumerable': true,
      'value': value,
      'writable': true
    });
  } else {
    object[key] = value;
  }
}

module.exports = baseAssignValue;


/***/ }),
/* 656 */
/***/ (function(module, exports, __webpack_require__) {

var flatten = __webpack_require__(657),
    overRest = __webpack_require__(660),
    setToString = __webpack_require__(662);

/**
 * A specialized version of `baseRest` which flattens the rest array.
 *
 * @private
 * @param {Function} func The function to apply a rest parameter to.
 * @returns {Function} Returns the new function.
 */
function flatRest(func) {
  return setToString(overRest(func, undefined, flatten), func + '');
}

module.exports = flatRest;


/***/ }),
/* 657 */
/***/ (function(module, exports, __webpack_require__) {

var baseFlatten = __webpack_require__(658);

/**
 * Flattens `array` a single level deep.
 *
 * @static
 * @memberOf _
 * @since 0.1.0
 * @category Array
 * @param {Array} array The array to flatten.
 * @returns {Array} Returns the new flattened array.
 * @example
 *
 * _.flatten([1, [2, [3, [4]], 5]]);
 * // => [1, 2, [3, [4]], 5]
 */
function flatten(array) {
  var length = array == null ? 0 : array.length;
  return length ? baseFlatten(array, 1) : [];
}

module.exports = flatten;


/***/ }),
/* 658 */
/***/ (function(module, exports, __webpack_require__) {

var arrayPush = __webpack_require__(278),
    isFlattenable = __webpack_require__(659);

/**
 * The base implementation of `_.flatten` with support for restricting flattening.
 *
 * @private
 * @param {Array} array The array to flatten.
 * @param {number} depth The maximum recursion depth.
 * @param {boolean} [predicate=isFlattenable] The function invoked per iteration.
 * @param {boolean} [isStrict] Restrict to values that pass `predicate` checks.
 * @param {Array} [result=[]] The initial result value.
 * @returns {Array} Returns the new flattened array.
 */
function baseFlatten(array, depth, predicate, isStrict, result) {
  var index = -1,
      length = array.length;

  predicate || (predicate = isFlattenable);
  result || (result = []);

  while (++index < length) {
    var value = array[index];
    if (depth > 0 && predicate(value)) {
      if (depth > 1) {
        // Recursively flatten arrays (susceptible to call stack limits).
        baseFlatten(value, depth - 1, predicate, isStrict, result);
      } else {
        arrayPush(result, value);
      }
    } else if (!isStrict) {
      result[result.length] = value;
    }
  }
  return result;
}

module.exports = baseFlatten;


/***/ }),
/* 659 */
/***/ (function(module, exports, __webpack_require__) {

var Symbol = __webpack_require__(81),
    isArguments = __webpack_require__(168),
    isArray = __webpack_require__(24);

/** Built-in value references. */
var spreadableSymbol = Symbol ? Symbol.isConcatSpreadable : undefined;

/**
 * Checks if `value` is a flattenable `arguments` object or array.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is flattenable, else `false`.
 */
function isFlattenable(value) {
  return isArray(value) || isArguments(value) ||
    !!(spreadableSymbol && value && value[spreadableSymbol]);
}

module.exports = isFlattenable;


/***/ }),
/* 660 */
/***/ (function(module, exports, __webpack_require__) {

var apply = __webpack_require__(661);

/* Built-in method references for those with the same name as other `lodash` methods. */
var nativeMax = Math.max;

/**
 * A specialized version of `baseRest` which transforms the rest array.
 *
 * @private
 * @param {Function} func The function to apply a rest parameter to.
 * @param {number} [start=func.length-1] The start position of the rest parameter.
 * @param {Function} transform The rest array transform.
 * @returns {Function} Returns the new function.
 */
function overRest(func, start, transform) {
  start = nativeMax(start === undefined ? (func.length - 1) : start, 0);
  return function() {
    var args = arguments,
        index = -1,
        length = nativeMax(args.length - start, 0),
        array = Array(length);

    while (++index < length) {
      array[index] = args[start + index];
    }
    index = -1;
    var otherArgs = Array(start + 1);
    while (++index < start) {
      otherArgs[index] = args[index];
    }
    otherArgs[start] = transform(array);
    return apply(func, this, otherArgs);
  };
}

module.exports = overRest;


/***/ }),
/* 661 */
/***/ (function(module, exports) {

/**
 * A faster alternative to `Function#apply`, this function invokes `func`
 * with the `this` binding of `thisArg` and the arguments of `args`.
 *
 * @private
 * @param {Function} func The function to invoke.
 * @param {*} thisArg The `this` binding of `func`.
 * @param {Array} args The arguments to invoke `func` with.
 * @returns {*} Returns the result of `func`.
 */
function apply(func, thisArg, args) {
  switch (args.length) {
    case 0: return func.call(thisArg);
    case 1: return func.call(thisArg, args[0]);
    case 2: return func.call(thisArg, args[0], args[1]);
    case 3: return func.call(thisArg, args[0], args[1], args[2]);
  }
  return func.apply(thisArg, args);
}

module.exports = apply;


/***/ }),
/* 662 */
/***/ (function(module, exports, __webpack_require__) {

var baseSetToString = __webpack_require__(663),
    shortOut = __webpack_require__(665);

/**
 * Sets the `toString` method of `func` to return `string`.
 *
 * @private
 * @param {Function} func The function to modify.
 * @param {Function} string The `toString` result.
 * @returns {Function} Returns `func`.
 */
var setToString = shortOut(baseSetToString);

module.exports = setToString;


/***/ }),
/* 663 */
/***/ (function(module, exports, __webpack_require__) {

var constant = __webpack_require__(664),
    defineProperty = __webpack_require__(294),
    identity = __webpack_require__(293);

/**
 * The base implementation of `setToString` without support for hot loop shorting.
 *
 * @private
 * @param {Function} func The function to modify.
 * @param {Function} string The `toString` result.
 * @returns {Function} Returns `func`.
 */
var baseSetToString = !defineProperty ? identity : function(func, string) {
  return defineProperty(func, 'toString', {
    'configurable': true,
    'enumerable': false,
    'value': constant(string),
    'writable': true
  });
};

module.exports = baseSetToString;


/***/ }),
/* 664 */
/***/ (function(module, exports) {

/**
 * Creates a function that returns `value`.
 *
 * @static
 * @memberOf _
 * @since 2.4.0
 * @category Util
 * @param {*} value The value to return from the new function.
 * @returns {Function} Returns the new constant function.
 * @example
 *
 * var objects = _.times(2, _.constant({ 'a': 1 }));
 *
 * console.log(objects);
 * // => [{ 'a': 1 }, { 'a': 1 }]
 *
 * console.log(objects[0] === objects[1]);
 * // => true
 */
function constant(value) {
  return function() {
    return value;
  };
}

module.exports = constant;


/***/ }),
/* 665 */
/***/ (function(module, exports) {

/** Used to detect hot functions by number of calls within a span of milliseconds. */
var HOT_COUNT = 800,
    HOT_SPAN = 16;

/* Built-in method references for those with the same name as other `lodash` methods. */
var nativeNow = Date.now;

/**
 * Creates a function that'll short out and invoke `identity` instead
 * of `func` when it's called `HOT_COUNT` or more times in `HOT_SPAN`
 * milliseconds.
 *
 * @private
 * @param {Function} func The function to restrict.
 * @returns {Function} Returns the new shortable function.
 */
function shortOut(func) {
  var count = 0,
      lastCalled = 0;

  return function() {
    var stamp = nativeNow(),
        remaining = HOT_SPAN - (stamp - lastCalled);

    lastCalled = stamp;
    if (remaining > 0) {
      if (++count >= HOT_COUNT) {
        return arguments[0];
      }
    } else {
      count = 0;
    }
    return func.apply(undefined, arguments);
  };
}

module.exports = shortOut;


/***/ }),
/* 666 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _escapeStringRegexp = __webpack_require__(667);

var _escapeStringRegexp2 = _interopRequireDefault(_escapeStringRegexp);

var _propTypes = __webpack_require__(1);

var _propTypes2 = _interopRequireDefault(_propTypes);

var _react = __webpack_require__(0);

var _react2 = _interopRequireDefault(_react);

var _stripDiacritics = __webpack_require__(112);

var _stripDiacritics2 = _interopRequireDefault(_stripDiacritics);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

function getMatchBoundaries(subject, search) {
  var matches = search.exec((0, _stripDiacritics2.default)(subject));
  if (matches) {
    return {
      first: matches.index,
      last: matches.index + matches[0].length
    };
  }
}

/**
 * Stripped-down version of https://github.com/helior/react-highlighter
 *
 * Results are already filtered by the time the component is used internally so
 * we can safely ignore case and diacritical marks for the purposes of matching.
 */

var Highlighter = function (_React$Component) {
  _inherits(Highlighter, _React$Component);

  function Highlighter() {
    var _ref;

    var _temp, _this, _ret;

    _classCallCheck(this, Highlighter);

    for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
      args[_key] = arguments[_key];
    }

    return _ret = (_temp = (_this = _possibleConstructorReturn(this, (_ref = Highlighter.__proto__ || Object.getPrototypeOf(Highlighter)).call.apply(_ref, [this].concat(args))), _this), _this._count = 0, _temp), _possibleConstructorReturn(_this, _ret);
  }

  _createClass(Highlighter, [{
    key: 'render',
    value: function render() {
      var children = this.props.search ? this._renderHighlightedChildren() : this.props.children;

      return _react2.default.createElement(
        'span',
        null,
        children
      );
    }
  }, {
    key: '_renderHighlightedChildren',
    value: function _renderHighlightedChildren() {
      var children = [];
      var search = new RegExp((0, _escapeStringRegexp2.default)(this.props.search), 'i' // Case-insensitive
      );

      var remaining = this.props.children;

      while (remaining) {
        if (!search.test((0, _stripDiacritics2.default)(remaining))) {
          this._count++;
          children.push(_react2.default.createElement(
            'span',
            { key: this._count },
            remaining
          ));
          return children;
        }

        var boundaries = getMatchBoundaries(remaining, search);

        // Capture the string that leads up to a match...
        var nonMatch = remaining.slice(0, boundaries.first);
        if (nonMatch) {
          this._count++;
          children.push(_react2.default.createElement(
            'span',
            { key: this._count },
            nonMatch
          ));
        }

        // Now, capture the matching string...
        var match = remaining.slice(boundaries.first, boundaries.last);
        if (match) {
          this._count++;
          children.push(_react2.default.createElement(
            'mark',
            { className: 'rbt-highlight-text', key: this._count },
            match
          ));
        }

        // And if there's anything left over, recursively run this method again.
        remaining = remaining.slice(boundaries.last);
      }

      return children;
    }
  }]);

  return Highlighter;
}(_react2.default.Component);

Highlighter.propTypes = {
  children: _propTypes2.default.string.isRequired,
  search: _propTypes2.default.string.isRequired
};

exports.default = Highlighter;

/***/ }),
/* 667 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var matchOperatorsRe = /[|\\{}()[\]^$+*?.]/g;

module.exports = function (str) {
	if (typeof str !== 'string') {
		throw new TypeError('Expected a string');
	}

	return str.replace(matchOperatorsRe, '\\$&');
};


/***/ }),
/* 668 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, "__esModule", {
  value: true
});

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _head = __webpack_require__(174);

var _head2 = _interopRequireDefault(_head);

var _isEqual = __webpack_require__(162);

var _isEqual2 = _interopRequireDefault(_isEqual);

var _noop = __webpack_require__(171);

var _noop2 = _interopRequireDefault(_noop);

var _propTypes = __webpack_require__(1);

var _propTypes2 = _interopRequireDefault(_propTypes);

var _reactOnclickoutside = __webpack_require__(287);

var _reactOnclickoutside2 = _interopRequireDefault(_reactOnclickoutside);

var _react = __webpack_require__(0);

var _react2 = _interopRequireDefault(_react);

var _deprecated = __webpack_require__(215);

var _deprecated2 = _interopRequireDefault(_deprecated);

var _propTypes3 = __webpack_require__(669);

var _utils = __webpack_require__(54);

var _keyCode = __webpack_require__(113);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

function getInitialState(props) {
  var defaultSelected = props.defaultSelected,
      maxResults = props.maxResults,
      multiple = props.multiple;


  var selected = props.selected ? props.selected.slice() : defaultSelected.slice();

  var text = '';

  if (!multiple && selected.length) {
    // Set the text if an initial selection is passed in.
    text = (0, _utils.getOptionLabel)((0, _head2.default)(selected), props.labelKey);

    if (selected.length > 1) {
      // Limit to 1 selection in single-select mode.
      selected = selected.slice(0, 1);
    }
  }

  return {
    activeIndex: -1,
    activeItem: null,
    initialItem: null,
    isOnlyResult: false,
    selected: selected,
    showMenu: false,
    shownResults: maxResults,
    text: text
  };
}

function typeaheadContainer(Typeahead) {
  var WrappedTypeahead = function (_React$Component) {
    _inherits(WrappedTypeahead, _React$Component);

    function WrappedTypeahead(props) {
      _classCallCheck(this, WrappedTypeahead);

      var _this = _possibleConstructorReturn(this, (WrappedTypeahead.__proto__ || Object.getPrototypeOf(WrappedTypeahead)).call(this, props));

      _this.blur = function () {
        _this._getInputNode().blur();
        _this._hideMenu();
      };

      _this.clear = function () {
        _this.setState(getInitialState(_this.props));

        _this._updateSelected([]);
        _this._updateText('');
      };

      _this.focus = function () {
        _this._getInputNode().focus();
      };

      _this._getInputNode = function () {
        return _this._instance.getInputNode();
      };

      _this._handleActiveItemChange = function (activeItem) {
        _this.setState({ activeItem: activeItem });
      };

      _this._handleFocus = function (e) {
        _this.props.onFocus(e);
        _this.setState({ showMenu: true });
      };

      _this._handleInitialItemChange = function (initialItem) {
        var labelKey = _this.props.labelKey;

        var currentItem = _this.state.initialItem;

        // Don't update the initial item if it hasn't changed. For custom items,
        // compare the `labelKey` values since a unique id is generated each time,
        // causing the comparison to always return false otherwise.
        if ((0, _isEqual2.default)(initialItem, currentItem) || currentItem && initialItem && initialItem.customOption && initialItem[labelKey] === currentItem[labelKey]) {
          return;
        }

        _this.setState({ initialItem: initialItem });
      };

      _this._handleInputChange = function (text) {
        var _getInitialState = getInitialState(_this.props),
            activeIndex = _getInitialState.activeIndex,
            activeItem = _getInitialState.activeItem;

        _this.setState({
          activeIndex: activeIndex,
          activeItem: activeItem,
          showMenu: true
        });
        _this._updateText(text);
      };

      _this._handleKeyDown = function (options, e) {
        var _this$state = _this.state,
            activeItem = _this$state.activeItem,
            showMenu = _this$state.showMenu;


        switch (e.keyCode) {
          case _keyCode.UP:
          case _keyCode.DOWN:
            // Don't cycle through the options if the menu is hidden.
            if (!showMenu) {
              break;
            }

            var activeIndex = _this.state.activeIndex;

            // Prevents input cursor from going to the beginning when pressing up.

            e.preventDefault();

            // Increment or decrement index based on user keystroke.
            activeIndex += e.keyCode === _keyCode.UP ? -1 : 1;

            // If we've reached the end, go back to the beginning or vice-versa.
            if (activeIndex === options.length) {
              activeIndex = -1;
            } else if (activeIndex === -2) {
              activeIndex = options.length - 1;
            }

            var newState = { activeIndex: activeIndex };
            if (activeIndex === -1) {
              // Reset the active item if there is no active index.
              newState.activeItem = null;
            }

            _this.setState(newState);
            break;
          case _keyCode.ESC:
          case _keyCode.TAB:
            // Prevent closing dialogs.
            e.keyCode === _keyCode.ESC && e.preventDefault();

            _this._hideMenu();
            break;
          case _keyCode.RETURN:
            if (!showMenu) {
              break;
            }

            var _this$state2 = _this.state,
                initialItem = _this$state2.initialItem,
                isOnlyResult = _this$state2.isOnlyResult;

            // if menu is shown and we have active item
            // there is no any sense to submit form on <RETURN>

            if (!_this.props.submitFormOnEnter || activeItem) {
              // Prevent submitting forms.
              e.preventDefault();
            }

            if (activeItem) {
              _this._handleSelectionAdd(activeItem);
              break;
            }

            if (isOnlyResult) {
              _this._handleSelectionAdd(initialItem);
              break;
            }
            break;
        }

        _this.props.onKeyDown(e);
      };

      _this._handlePaginate = function (e) {
        var _this$props = _this.props,
            maxResults = _this$props.maxResults,
            onPaginate = _this$props.onPaginate;


        onPaginate(e);
        _this.setState({ shownResults: _this.state.shownResults + maxResults });
      };

      _this._handleResultsChange = function (results) {
        var _this$props2 = _this.props,
            allowNew = _this$props2.allowNew,
            highlightOnlyResult = _this$props2.highlightOnlyResult;

        if (!allowNew && highlightOnlyResult) {
          _this.setState({ isOnlyResult: results.length === 1 });
        }
      };

      _this._handleSelectionAdd = function (selection) {
        var _this$props3 = _this.props,
            multiple = _this$props3.multiple,
            labelKey = _this$props3.labelKey;


        var selected = void 0;
        var text = void 0;

        if (multiple) {
          // If multiple selections are allowed, add the new selection to the
          // existing selections.
          selected = _this.state.selected.concat(selection);
          text = '';
        } else {
          // If only a single selection is allowed, replace the existing selection
          // with the new one.
          selected = [selection];
          text = (0, _utils.getOptionLabel)(selection, labelKey);
        }

        _this._hideMenu();
        _this._updateSelected(selected);
        _this._updateText(text);

        _this.setState({ initialItem: selection });
      };

      _this._handleSelectionRemove = function (selection) {
        var selected = _this.state.selected.filter(function (option) {
          return !(0, _isEqual2.default)(option, selection);
        });

        // Make sure the input stays focused after the item is removed.
        _this.focus();
        _this._hideMenu();
        _this._updateSelected(selected);
      };

      _this.handleClickOutside = function (e) {
        _this.state.showMenu && _this._hideMenu();
      };

      _this._hideMenu = function () {
        var _getInitialState2 = getInitialState(_this.props),
            activeIndex = _getInitialState2.activeIndex,
            activeItem = _getInitialState2.activeItem,
            showMenu = _getInitialState2.showMenu,
            shownResults = _getInitialState2.shownResults;

        _this.setState({
          activeIndex: activeIndex,
          activeItem: activeItem,
          showMenu: showMenu,
          shownResults: shownResults
        });
      };

      _this._updateSelected = function (selected) {
        _this.setState({ selected: selected });
        _this.props.onChange(selected);
      };

      _this._updateText = function (text) {
        _this.setState({ text: text });
        _this.props.onInputChange(text);
      };

      _this.state = getInitialState(props);
      return _this;
    }

    _createClass(WrappedTypeahead, [{
      key: 'getChildContext',
      value: function getChildContext() {
        return {
          activeIndex: this.state.activeIndex,
          isOnlyResult: this.state.isOnlyResult,
          onActiveItemChange: this._handleActiveItemChange,
          onInitialItemChange: this._handleInitialItemChange,
          onMenuItemClick: this._handleSelectionAdd
        };
      }
    }, {
      key: 'componentDidMount',
      value: function componentDidMount() {
        this.props.autoFocus && this.focus();
      }
    }, {
      key: 'componentWillReceiveProps',
      value: function componentWillReceiveProps(nextProps) {
        var inputValue = this._getInputNode().value;
        var labelKey = nextProps.labelKey,
            multiple = nextProps.multiple,
            selected = nextProps.selected;

        // If new selections are passed via props, treat as a controlled input.

        if (selected && !(0, _isEqual2.default)(selected, this.props.selected)) {
          this._updateSelected(selected);

          if (multiple) {
            return;
          }

          // Update the input text.
          var text = void 0;
          if (selected.length) {
            // If a new selection has been passed in, display the label.
            text = (0, _utils.getOptionLabel)((0, _head2.default)(selected), labelKey);
          } else if (this.state.text !== inputValue) {
            // The input value was modified by the user, removing the selection.
            // Set the input value as the new text.
            text = inputValue;
          } else {
            // An empty array was passed.
            text = '';
          }

          this._updateText(text);
        }

        // Truncate selections when in single-select mode.
        var newSelected = selected || this.state.selected;
        if (!multiple && newSelected.length > 1) {
          newSelected = newSelected.slice(0, 1);
          this._updateSelected(newSelected);
          this._updateText((0, _utils.getOptionLabel)((0, _head2.default)(newSelected), labelKey));
          return;
        }

        if (multiple !== this.props.multiple) {
          this._updateText('');
        }
      }
    }, {
      key: 'render',
      value: function render() {
        var _this2 = this;

        var _props = this.props,
            filterBy = _props.filterBy,
            minLength = _props.minLength,
            options = _props.options;
        var text = this.state.text;


        var results = [];
        if (text.length >= minLength) {
          var callback = Array.isArray(filterBy) ? function (option) {
            return (0, _utils.defaultFilterBy)(option, _this2.state, _this2.props);
          } : function (option) {
            return filterBy(option, text);
          };

          results = options.filter(callback);
        }

        return _react2.default.createElement(Typeahead, _extends({}, this.props, this.state, {
          onClear: this.clear,
          onFocus: this._handleFocus,
          onInitialItemChange: this._handleInitialItemChange,
          onInputChange: this._handleInputChange,
          onInputFocus: this._handleInputFocus,
          onKeyDown: this._handleKeyDown,
          onPaginate: this._handlePaginate,
          onResultsChange: this._handleResultsChange,
          onSelectionAdd: this._handleSelectionAdd,
          onSelectionRemove: this._handleSelectionRemove,
          ref: function ref(instance) {
            return _this2._instance = instance;
          },
          results: results
        }));
      }

      /**
       * Public method to allow external clearing of the input. Clears both text
       * and selection(s).
       */


      /**
       * From `onClickOutside` HOC.
       */

    }]);

    return WrappedTypeahead;
  }(_react2.default.Component);

  WrappedTypeahead.displayName = 'Typeahead';

  WrappedTypeahead.propTypes = {
    /**
     * For localized accessibility: Should return a string indicating the number
     * of results for screen readers. Receives the current results.
     */
    a11yNumResults: _propTypes2.default.func,
    /**
     * For localized accessibility: Should return a string indicating the number
     * of selections for screen readers. Receives the current selections.
     */
    a11yNumSelected: _propTypes2.default.func,
    /**
     * Allows the creation of new selections on the fly. Note that any new items
     * will be added to the list of selections, but not the list of original
     * options unless handled as such by `Typeahead`'s parent.
     */
    allowNew: _propTypes2.default.bool,
    /**
     * Autofocus the input when the component initially mounts.
     */
    autoFocus: _propTypes2.default.bool,
    /**
     * Whether to render the menu inline or attach to `document.body`.
     */
    bodyContainer: _propTypes2.default.bool,
    /**
     * Whether or not filtering should be case-sensitive.
     */
    caseSensitive: (0, _propTypes3.checkPropType)(_propTypes2.default.bool, _propTypes3.caseSensitiveType),
    /**
     * Displays a button to clear the input when there are selections.
     */
    clearButton: _propTypes2.default.bool,
    /**
     * Specify any pre-selected options. Use only if you want the component to
     * be uncontrolled.
     */
    defaultSelected: _propTypes3.optionType,
    /**
     * Whether to disable the component.
     */
    disabled: _propTypes2.default.bool,
    /**
     * Specify whether the menu should appear above the input.
     */
    dropup: _propTypes2.default.bool,
    /**
     * Message to display in the menu if there are no valid results.
     */
    emptyLabel: _propTypes2.default.string,
    /**
     * Either an array of fields in `option` to search, or a custom filtering
     * callback.
     */
    filterBy: _propTypes2.default.oneOfType([_propTypes2.default.arrayOf(_propTypes2.default.string.isRequired), _propTypes2.default.func]),
    /**
     * Highlights the menu item if there is only one result and allows selecting
     * that item by hitting enter. Does not work with `allowNew`.
     */
    highlightOnlyResult: (0, _propTypes3.checkPropType)(_propTypes2.default.bool, _propTypes3.highlightOnlyResultType),
    /**
     * Whether the filter should ignore accents and other diacritical marks.
     */
    ignoreDiacritics: (0, _propTypes3.checkPropType)(_propTypes2.default.bool, _propTypes3.ignoreDiacriticsType),
    /**
     * Props to be applied directly to the input. `onBlur`, `onChange`,
     * `onFocus`, and `onKeyDown` are ignored.
     */
    inputProps: (0, _propTypes3.checkPropType)(_propTypes2.default.object, _propTypes3.inputPropsType),
    /**
     * Indicate whether an asynchronous data fetch is happening.
     */
    isLoading: _propTypes2.default.bool,
    /**
     * Specify the option key to use for display or a function returning the
     * display string. By default, the selector will use the `label` key.
     */
    labelKey: (0, _propTypes3.checkPropType)(_propTypes2.default.oneOfType([_propTypes2.default.string, _propTypes2.default.func]), _propTypes3.labelKeyType),
    /**
     * Maximum number of results to display by default. Mostly done for
     * performance reasons so as not to render too many DOM nodes in the case of
     * large data sets.
     */
    maxResults: _propTypes2.default.number,
    /**
     * Number of input characters that must be entered before showing results.
     */
    minLength: _propTypes2.default.number,
    /**
     * Whether or not multiple selections are allowed.
     */
    multiple: _propTypes2.default.bool,
    /**
     * DEPRECATED. Name attribute for the input.
     */
    name: (0, _deprecated2.default)(_propTypes2.default.string, 'Use `inputProps` instead'),
    /**
     * Invoked when the input is blurred. Receives an event.
     */
    onBlur: _propTypes2.default.func,
    /**
     * Invoked whenever items are added or removed. Receives an array of the
     * selected options.
     */
    onChange: _propTypes2.default.func,
    /**
     * Invoked when the input is focused. Receives an event.
     */
    onFocus: _propTypes2.default.func,
    /**
     * Invoked when the input value changes. Receives the string value of the
     * input.
     */
    onInputChange: _propTypes2.default.func,
    /**
     * Invoked when a key is pressed. Receives an event.
     */
    onKeyDown: _propTypes2.default.func,
    /**
     * Invoked when the menu is hidden.
     */
    onMenuHide: _propTypes2.default.func,
    /**
     * Invoked when the menu is shown.
     */
    onMenuShow: _propTypes2.default.func,
    /**
     * Invoked when the pagination menu item is clicked. Receives an event.
     */
    onPaginate: _propTypes2.default.func,
    /**
     * Full set of options, including pre-selected options. Must either be an
     * array of objects (recommended) or strings.
     */
    options: _propTypes3.optionType.isRequired,
    /**
     * Give user the ability to display additional results if the number of
     * results exceeds `maxResults`.
     */
    paginate: _propTypes2.default.bool,
    /**
     * Placeholder text for the input.
     */
    placeholder: _propTypes2.default.string,
    /**
     * Callback for custom menu rendering.
     */
    renderMenu: _propTypes2.default.func,
    /**
     * The selected option(s) displayed in the input. Use this prop if you want
     * to control the component via its parent.
     */
    selected: _propTypes3.optionType,
    /**
     * Allows selecting the hinted result by pressing enter.
     */
    selectHintOnEnter: _propTypes2.default.bool,
    /**
     * Propagate <RETURN> event to parent form.
     */
    submitFormOnEnter: _propTypes2.default.bool
  };

  WrappedTypeahead.defaultProps = {
    a11yNumResults: function a11yNumResults(results) {
      var resultString = (0, _utils.pluralize)('result', results.length);
      return resultString + '. Use up and down arrow keys to navigate.';
    },
    a11yNumSelected: function a11yNumSelected(selected) {
      return (0, _utils.pluralize)('selection', selected.length);
    },
    allowNew: false,
    autoFocus: false,
    bodyContainer: false,
    caseSensitive: false,
    clearButton: false,
    defaultSelected: [],
    disabled: false,
    dropup: false,
    emptyLabel: 'No matches found.',
    filterBy: [],
    highlightOnlyResult: false,
    ignoreDiacritics: true,
    inputProps: {},
    isLoading: false,
    labelKey: 'label',
    maxResults: 100,
    minLength: 0,
    multiple: false,
    onBlur: _noop2.default,
    onChange: _noop2.default,
    onFocus: _noop2.default,
    onInputChange: _noop2.default,
    onKeyDown: _noop2.default,
    onMenuHide: _noop2.default,
    onMenuShow: _noop2.default,
    onPaginate: _noop2.default,
    paginate: true,
    placeholder: '',
    selectHintOnEnter: false,
    submitFormOnEnter: false
  };

  WrappedTypeahead.childContextTypes = {
    activeIndex: _propTypes2.default.number.isRequired,
    isOnlyResult: _propTypes2.default.bool.isRequired,
    onActiveItemChange: _propTypes2.default.func.isRequired,
    onInitialItemChange: _propTypes2.default.func.isRequired,
    onMenuItemClick: _propTypes2.default.func.isRequired
  };

  return (0, _reactOnclickoutside2.default)(WrappedTypeahead);
}

exports.default = typeaheadContainer;

/***/ }),
/* 669 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.optionType = exports.labelKeyType = exports.inputPropsType = exports.ignoreDiacriticsType = exports.highlightOnlyResultType = exports.checkPropType = exports.caseSensitiveType = undefined;

var _caseSensitiveType2 = __webpack_require__(670);

var _caseSensitiveType3 = _interopRequireDefault(_caseSensitiveType2);

var _checkPropType2 = __webpack_require__(671);

var _checkPropType3 = _interopRequireDefault(_checkPropType2);

var _highlightOnlyResultType2 = __webpack_require__(672);

var _highlightOnlyResultType3 = _interopRequireDefault(_highlightOnlyResultType2);

var _ignoreDiacriticsType2 = __webpack_require__(673);

var _ignoreDiacriticsType3 = _interopRequireDefault(_ignoreDiacriticsType2);

var _inputPropsType2 = __webpack_require__(674);

var _inputPropsType3 = _interopRequireDefault(_inputPropsType2);

var _labelKeyType2 = __webpack_require__(675);

var _labelKeyType3 = _interopRequireDefault(_labelKeyType2);

var _optionType2 = __webpack_require__(676);

var _optionType3 = _interopRequireDefault(_optionType2);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

exports.caseSensitiveType = _caseSensitiveType3.default; /* eslint-disable object-curly-spacing */

exports.checkPropType = _checkPropType3.default;
exports.highlightOnlyResultType = _highlightOnlyResultType3.default;
exports.ignoreDiacriticsType = _ignoreDiacriticsType3.default;
exports.inputPropsType = _inputPropsType3.default;
exports.labelKeyType = _labelKeyType3.default;
exports.optionType = _optionType3.default;
/* eslint-enable object-curly-spacing */

/***/ }),
/* 670 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = caseSensitiveType;

var _warn = __webpack_require__(55);

var _warn2 = _interopRequireDefault(_warn);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function caseSensitiveType(props, propName, componentName) {
  var caseSensitive = props.caseSensitive,
      filterBy = props.filterBy;

  (0, _warn2.default)(!caseSensitive || typeof filterBy !== 'function', 'Your `filterBy` function will override the `caseSensitive` prop.');
}

/***/ }),
/* 671 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = checkPropType;

var _propTypes = __webpack_require__(1);

var _propTypes2 = _interopRequireDefault(_propTypes);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

/**
 * Allows additional warnings or messaging related to prop validation.
 */
function checkPropType(validator, callback) {
  return function (props, propName, componentName) {
    _propTypes2.default.checkPropTypes(_defineProperty({}, propName, validator), props, 'prop', componentName);

    typeof callback === 'function' && callback(props, propName, componentName);
  };
}

/***/ }),
/* 672 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = highlightOnlyResultType;

var _warn = __webpack_require__(55);

var _warn2 = _interopRequireDefault(_warn);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function highlightOnlyResultType(props, propName, componentName) {
  var allowNew = props.allowNew,
      highlightOnlyResult = props.highlightOnlyResult;

  (0, _warn2.default)(!(highlightOnlyResult && allowNew), '`highlightOnlyResult` will not work with `allowNew`.');
}

/***/ }),
/* 673 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = ignoreDiacriticsType;

var _warn = __webpack_require__(55);

var _warn2 = _interopRequireDefault(_warn);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function ignoreDiacriticsType(props, propName, componentName) {
  var filterBy = props.filterBy,
      ignoreDiacritics = props.ignoreDiacritics;

  (0, _warn2.default)(ignoreDiacritics || typeof filterBy !== 'function', 'Your `filterBy` function will override the `ignoreDiacritics` prop.');
}

/***/ }),
/* 674 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = inputPropsType;

var _isPlainObject = __webpack_require__(289);

var _isPlainObject2 = _interopRequireDefault(_isPlainObject);

var _warn = __webpack_require__(55);

var _warn2 = _interopRequireDefault(_warn);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var BLACKLIST = [{ alt: 'onBlur', prop: 'onBlur' }, { alt: 'onInputChange', prop: 'onChange' }, { alt: 'onFocus', prop: 'onFocus' }, { alt: 'onKeyDown', prop: 'onKeyDown' }];

function inputPropsType(props, propName, componentName) {
  var inputProps = props.inputProps;

  if (!(inputProps && (0, _isPlainObject2.default)(inputProps))) {
    return;
  }

  // Blacklisted properties.
  BLACKLIST.forEach(function (_ref) {
    var alt = _ref.alt,
        prop = _ref.prop;

    var msg = alt ? ' Use the top-level `' + alt + '` prop instead.' : null;
    (0, _warn2.default)(!inputProps.hasOwnProperty(prop), 'The `' + prop + '` property of `inputProps` will be ignored.' + msg);
  });
}

/***/ }),
/* 675 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = labelKeyType;

var _warn = __webpack_require__(55);

var _warn2 = _interopRequireDefault(_warn);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function labelKeyType(props, propName, componentName) {
  var allowNew = props.allowNew,
      labelKey = props.labelKey;

  (0, _warn2.default)(!(typeof labelKey === 'function' && allowNew), '`labelKey` must be a string when `allowNew={true}`.');
}

/***/ }),
/* 676 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, "__esModule", {
  value: true
});

var _propTypes = __webpack_require__(1);

var _propTypes2 = _interopRequireDefault(_propTypes);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

exports.default = _propTypes2.default.oneOfType([_propTypes2.default.arrayOf(_propTypes2.default.object.isRequired), _propTypes2.default.arrayOf(_propTypes2.default.string.isRequired)]);

/***/ }),
/* 677 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
// LICENSE_CODE ZON ISC
 /*jslint react:true*/

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _regeneratorRuntime = __webpack_require__(20);

var _regeneratorRuntime2 = _interopRequireDefault(_regeneratorRuntime);

var _lodash = __webpack_require__(32);

var _lodash2 = _interopRequireDefault(_lodash);

var _react = __webpack_require__(0);

var _react2 = _interopRequireDefault(_react);

var _reactBootstrap = __webpack_require__(25);

var _etask = __webpack_require__(19);

var _etask2 = _interopRequireDefault(_etask);

var _common = __webpack_require__(47);

var _common2 = _interopRequireDefault(_common);

var _domains = __webpack_require__(99);

var _status_codes = __webpack_require__(78);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var E = {
    install: function install() {
        return E.sp = (0, _etask2.default)('protocol_detail', [function () {
            return this.wait();
        }]);
    },
    uninstall: function uninstall() {
        if (E.sp) E.sp.return();
    }
};

var StatsDetails = function (_React$Component) {
    _inherits(StatsDetails, _React$Component);

    function StatsDetails(props) {
        _classCallCheck(this, StatsDetails);

        var _this2 = _possibleConstructorReturn(this, (StatsDetails.__proto__ || Object.getPrototypeOf(StatsDetails)).call(this, props));

        _this2.state = {
            statuses: { stats: [] },
            domains: { stats: [] }
        };
        return _this2;
    }

    _createClass(StatsDetails, [{
        key: 'componentDidMount',
        value: function componentDidMount() {
            E.install();
            var _this = this;
            E.sp.spawn((0, _etask2.default)( /*#__PURE__*/_regeneratorRuntime2.default.mark(function _callee() {
                var res;
                return _regeneratorRuntime2.default.wrap(function _callee$(_context) {
                    while (1) {
                        switch (_context.prev = _context.next) {
                            case 0:
                                _context.t0 = _this;
                                _context.next = 3;
                                return _common2.default.StatsService.get(_this.props.protocol);

                            case 3:
                                _context.t1 = _context.sent;
                                _context.t2 = {
                                    stats: _context.t1
                                };

                                _context.t0.setState.call(_context.t0, _context.t2);

                                _context.next = 8;
                                return _common2.default.StatsService.get_top({ sort: 1, limit: 5 });

                            case 8:
                                res = _context.sent;

                                _this.setState(_lodash2.default.pick(res, ['statuses', 'domains']));

                            case 10:
                            case 'end':
                                return _context.stop();
                        }
                    }
                }, _callee, this);
            })));
        }
    }, {
        key: 'componentWillUnmount',
        value: function componentWillUnmount() {
            E.uninstall();
        }
    }, {
        key: 'render',
        value: function render() {
            return _react2.default.createElement(
                _common2.default.StatsDetails,
                { stats: this.state.stats,
                    header: 'Protocol: ' + this.props.protocol.toUpperCase() },
                _react2.default.createElement(
                    _reactBootstrap.Col,
                    { md: 6 },
                    _react2.default.createElement(
                        'h3',
                        null,
                        'Domains'
                    ),
                    _react2.default.createElement(_domains.DomainTable, { stats: this.state.domains.stats, go: true })
                ),
                _react2.default.createElement(
                    _reactBootstrap.Col,
                    { md: 6 },
                    _react2.default.createElement(
                        'h3',
                        null,
                        'Status codes'
                    ),
                    _react2.default.createElement(_status_codes.StatusCodeTable, { stats: this.state.statuses.stats, go: true })
                )
            );
        }
    }]);

    return StatsDetails;
}(_react2.default.Component);

exports.default = StatsDetails;

/***/ }),
/* 678 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
// LICENSE_CODE ZON ISC
 /*jslint react:true*/

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _regeneratorRuntime = __webpack_require__(20);

var _regeneratorRuntime2 = _interopRequireDefault(_regeneratorRuntime);

var _react = __webpack_require__(0);

var _react2 = _interopRequireDefault(_react);

var _reactBootstrap = __webpack_require__(25);

var _common = __webpack_require__(37);

var _etask = __webpack_require__(19);

var _etask2 = _interopRequireDefault(_etask);

var _util = __webpack_require__(29);

var _util2 = _interopRequireDefault(_util);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var thumb_style = { margin: '10px' };

var Message = function (_React$Component) {
    _inherits(Message, _React$Component);

    function Message() {
        var _ref;

        var _temp, _this2, _ret;

        _classCallCheck(this, Message);

        for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
            args[_key] = arguments[_key];
        }

        return _ret = (_temp = (_this2 = _possibleConstructorReturn(this, (_ref = Message.__proto__ || Object.getPrototypeOf(Message)).call.apply(_ref, [this].concat(args))), _this2), _this2.thumbs_up = function () {
            return _this2.props.on_thumbs_up(_this2.props.msg);
        }, _this2.thumbs_down = function () {
            return _this2.props.on_thumbs_down(_this2.props.msg);
        }, _this2.dismiss = function () {
            return _this2.props.on_dismiss(_this2.props.msg);
        }, _temp), _possibleConstructorReturn(_this2, _ret);
    }

    _createClass(Message, [{
        key: 'render',
        value: function render() {
            return _react2.default.createElement(
                _reactBootstrap.Col,
                { md: 12, className: 'alert alert-info settings-alert' },
                _react2.default.createElement(
                    _reactBootstrap.Col,
                    { md: 8 },
                    this.props.msg.message
                ),
                _react2.default.createElement(
                    _reactBootstrap.Col,
                    { md: 4, className: 'text-right' },
                    _react2.default.createElement(
                        'a',
                        { className: 'custom_link', onClick: this.thumbs_up, href: '#',
                            style: thumb_style },
                        _react2.default.createElement('img', { src: 'img/ic_thumbs_up.svg' })
                    ),
                    _react2.default.createElement(
                        'a',
                        { className: 'custom_link', onClick: this.thumbs_down, href: '#',
                            style: thumb_style },
                        _react2.default.createElement('img', { src: 'img/ic_thumbs_down.svg' })
                    ),
                    _react2.default.createElement(
                        _reactBootstrap.Button,
                        { bsSize: 'small', bsStyle: 'link', onClick: this.dismiss },
                        'Dismiss'
                    )
                )
            );
        }
    }]);

    return Message;
}(_react2.default.Component);

var MessageList = function (_React$Component2) {
    _inherits(MessageList, _React$Component2);

    function MessageList(props) {
        _classCallCheck(this, MessageList);

        var _this3 = _possibleConstructorReturn(this, (MessageList.__proto__ || Object.getPrototypeOf(MessageList)).call(this, props));

        _this3.thumbs_up = function (msg) {
            _this3.hide(msg);
            _util2.default.ga_event('message', msg.id, 'thumbs_up');
        };

        _this3.thumbs_down = function (msg) {
            _this3.hide(msg);
            _util2.default.ga_event('message', msg.id, 'thumbs_down');
        };

        _this3.dismiss = function (msg) {
            _this3.hide(msg);
            _util2.default.ga_event('message', msg.id, 'dismiss');
        };

        _this3.hide = _etask2.default._fn( /*#__PURE__*/_regeneratorRuntime2.default.mark(function _callee(_this, msg) {
            return _regeneratorRuntime2.default.wrap(function _callee$(_context) {
                while (1) {
                    switch (_context.prev = _context.next) {
                        case 0:
                            _this.setState({ show_thank_you: true });
                            window.localStorage.setItem(msg.id, JSON.stringify(msg));
                            _context.next = 4;
                            return _etask2.default.sleep(2000);

                        case 4:
                            _this.setState({ messages: _this.state.messages.filter(function (m) {
                                    return m != msg;
                                }),
                                show_thank_you: false });

                        case 5:
                        case 'end':
                            return _context.stop();
                    }
                }
            }, _callee, this);
        }));

        _this3.state = {
            messages: [{ message: 'Did it work?', id: 'concurrent_connections' }].filter(function (m) {
                return !window.localStorage.getItem(m.id);
            })
        };
        return _this3;
    }

    _createClass(MessageList, [{
        key: 'render',
        value: function render() {
            var _this4 = this;

            return _react2.default.createElement(
                _reactBootstrap.Col,
                { md: 7, className: 'messages' },
                this.state.messages.map(function (m) {
                    return _react2.default.createElement(Message, { msg: m, key: m.id, on_thumbs_up: _this4.thumbs_up,
                        on_thumbs_down: _this4.thumbs_down,
                        on_dismiss: _this4.dismiss });
                }),
                _react2.default.createElement(
                    _common.Dialog,
                    { title: 'Thank you for your feedback',
                        show: this.state.show_thank_you },
                    _react2.default.createElement(
                        'p',
                        null,
                        'We appreciate it!'
                    )
                )
            );
        }
    }]);

    return MessageList;
}(_react2.default.Component);

exports.default = MessageList;

/***/ }),
/* 679 */,
/* 680 */,
/* 681 */,
/* 682 */,
/* 683 */,
/* 684 */,
/* 685 */,
/* 686 */,
/* 687 */,
/* 688 */,
/* 689 */,
/* 690 */,
/* 691 */,
/* 692 */
/***/ (function(module, exports, __webpack_require__) {

// style-loader: Adds some css to the DOM by adding a <style> tag

// load the styles
var content = __webpack_require__(693);
if(typeof content === 'string') content = [[module.i, content, '']];
// Prepare cssTransformation
var transform;

var options = {}
options.transform = transform
// add the styles to the DOM
var update = __webpack_require__(41)(content, options);
if(content.locals) module.exports = content.locals;
// Hot Module Replacement
if(false) {
	// When the styles change, update the <style> tags
	if(!content.locals) {
		module.hot.accept("!!../../node_modules/css-loader/index.js?-url!../../node_modules/less-loader/dist/cjs.js!./app.less", function() {
			var newContent = require("!!../../node_modules/css-loader/index.js?-url!../../node_modules/less-loader/dist/cjs.js!./app.less");
			if(typeof newContent === 'string') newContent = [[module.id, newContent, '']];
			update(newContent);
		});
	}
	// When the module is disposed, remove the <style> tags
	module.hot.dispose(function() { update(); });
}

/***/ }),
/* 693 */
/***/ (function(module, exports, __webpack_require__) {

exports = module.exports = __webpack_require__(40)(undefined);
// imports


// module
exports.push([module.i, "@font-face {\n  font-family: 'Lato';\n  font-style: normal;\n  font-weight: 400;\n  src: local('Lato Regular'), local('Lato-Regular'), url(/font/lato_regular.woff2) format('woff2');\n  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02C6, U+02DA, U+02DC, U+2000-206F, U+2074, U+20AC, U+2212, U+2215;\n}\n@font-face {\n  font-family: 'Lato';\n  font-style: normal;\n  font-weight: 700;\n  src: local('Lato Bold'), local('Lato-Bold'), url(/font/lato_bold.woff2) format('woff2');\n  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02C6, U+02DA, U+02DC, U+2000-206F, U+2074, U+20AC, U+2212, U+2215;\n}\nbody {\n  font-family: \"Noto Sans\", sans-serif;\n  font-size: 15px;\n  line-height: 23px;\n  overflow-y: scroll;\n}\n.no_nav .page-body {\n  margin-left: 0;\n}\n.no_nav .nav_top {\n  background-color: white;\n}\n.page-body {\n  margin-left: 224px;\n}\n.page-body a {\n  color: #428bca;\n  outline: 3px solid transparent;\n  border: 1px solid transparent;\n}\n.page-body a:hover {\n  color: white;\n  background: #428bca;\n  border-color: #428bca;\n  text-decoration: none;\n  box-shadow: #428bca -2px 0 0 1px, #428bca 2px 0 0 1px;\n  border-radius: .15em;\n}\ncode {\n  background: lightgrey;\n  color: black;\n  white-space: nowrap;\n}\n.nowrap {\n  white-space: nowrap;\n}\npre.top-margin {\n  margin-top: 4px;\n}\n.container {\n  width: auto;\n}\n.main-container-qs {\n  margin-left: 25%;\n}\n.qs-move-control {\n  position: absolute;\n  top: 0;\n  bottom: 0;\n  width: 2px;\n  cursor: col-resize;\n}\n.btn-title {\n  float: right;\n  margin-top: -4px;\n  margin-right: 15px;\n  margin-bottom: -5px;\n}\n.header {\n  height: 60px;\n}\n.header img {\n  margin-top: 10px;\n}\nnav a:hover {\n  box-shadow: none;\n}\n.overall-success-ratio {\n  margin-bottom: 20px;\n}\n.success_title {\n  font-size: 22px;\n  cursor: pointer;\n}\n.success_value {\n  text-align: right;\n  font-size: 22px;\n  cursor: pointer;\n  color: #428bca;\n}\n.block {\n  background: #eeeeee;\n  padding: 1em;\n  margin-bottom: 20px;\n}\n.form-group {\n  margin-bottom: 12px;\n}\n.alert-inline {\n  display: inline;\n  padding: 6px 12px;\n  position: relative;\n  top: 2px;\n  margin: 0 8px;\n}\n.tester-body {\n  margin-bottom: 18px;\n}\n.tester-body textarea {\n  height: 100px;\n}\n.tools-header {\n  margin-bottom: 12px;\n}\n.tester-body:after,\n.tools-header:after {\n  content: '';\n  display: block;\n  clear: both;\n}\n.tools-add-header {\n  margin-bottom: 18px;\n}\n.tester-alert {\n  margin-top: 20px;\n  padding: 7.5px 11.5px;\n}\n.tester-results {\n  margin-top: 20px;\n}\n.tools-table {\n  width: auto;\n  float: none;\n  margin: 20px auto;\n}\n.tools-table th {\n  text-align: center;\n}\n.countries-list {\n  text-align: center;\n  margin-top: 20px;\n}\n.countries-list > div {\n  padding: 10px;\n  display: inline-block;\n  width: 200px;\n  white-space: nowrap;\n  overflow: hidden;\n  text-align: left;\n  position: relative;\n  border: 1px solid black;\n  margin: 5px 10px;\n}\n.countries-list .glyphicon {\n  color: grey;\n}\n.countries-list .glyphicon-ok {\n  color: green !important;\n}\n.countries-list .glyphicon-download-alt {\n  color: blue !important;\n}\n.countries-failed {\n  color: red !important;\n}\n.countries-canceled {\n  color: orange !important;\n}\n.countries-op {\n  display: inline-block;\n  position: absolute;\n  right: 0;\n  width: 40px;\n  padding-left: 10px;\n  background: white;\n  background: linear-gradient(to right, rgba(255, 255, 255, 0), white 25%);\n}\n.countries-op span:hover {\n  color: orange;\n  cursor: pointer;\n}\n.countries-view {\n  border-bottom: 1px dashed;\n  cursor: pointer;\n}\n#countries-screenshot .modal-dialog {\n  width: auto;\n  margin-left: 20px;\n  margin-right: 20px;\n}\n#countries-screenshot .modal-body > div {\n  overflow: auto;\n  max-height: calc(100vh - 164px);\n}\ntable.proxies {\n  table-layout: fixed;\n  min-width: 100%;\n  width: auto;\n}\n.proxies-settings,\n.columns-settings {\n  overflow: auto;\n  max-height: calc(100vh - 190px);\n}\n.proxies-panel {\n  overflow: auto;\n}\ndiv.proxies .panel-footer,\ndiv.proxies .panel-heading {\n  position: relative;\n}\ndiv.proxies .panel-heading {\n  height: 65px;\n}\ndiv.proxies .btn-wrapper {\n  position: absolute;\n  right: 10px;\n  top: 10px;\n}\n.proxies .btn-csv {\n  font-size: 12px;\n}\n.proxies-default {\n  color: gray;\n}\n.proxies-editable {\n  cursor: pointer;\n  position: relative;\n  display: inline-block;\n  min-height: 20px;\n  min-width: 100%;\n}\n.proxies-editable:hover {\n  color: orange;\n}\n.proxies-table-input {\n  position: absolute;\n  z-index: 2;\n  left: -25px;\n  right: -25px;\n  top: -7px;\n}\n.proxies-table-input input,\n.proxies-table-input select {\n  width: 100%;\n}\n.proxies-check {\n  width: 32px;\n}\n.col_success_rate {\n  white-space: nowrap;\n  width: 80px;\n}\n.proxies-success-rate-value {\n  color: #428bca;\n  width: 80px;\n  font-size: 16px;\n  cursor: pointer;\n}\n.proxies-actions {\n  white-space: nowrap;\n  width: 80px;\n}\n.proxies-action {\n  cursor: pointer;\n  color: #428bca;\n  outline: 3px solid transparent;\n  border: 1px solid transparent;\n  line-height: 20px;\n  margin: 0;\n}\n.proxies-action-disabled {\n  border: 1px solid transparent;\n  line-height: 20px;\n  margin: 0;\n}\n.proxies-action-edit {\n  visibility: hidden;\n}\n.proxies tr:hover .proxies-action-edit {\n  visibility: visible;\n  cursor: pointer;\n}\n.proxies-action-delete,\n.proxies-action-duplicate {\n  cursor: pointer;\n}\n.proxies-warning {\n  color: red;\n}\n#history .modal-dialog,\n#history_details .modal-dialog,\n#pool .modal-dialog {\n  width: auto;\n  margin-left: 20px;\n  margin-right: 20px;\n}\n#history .modal-body > div {\n  overflow: auto;\n  max-height: calc(100vh - 164px);\n}\n#history label {\n  font-weight: normal;\n}\n.proxies-history-navigation {\n  margin-bottom: 25px;\n}\n.proxies-history-filter {\n  font-size: 11px;\n  border-bottom: 1px dashed;\n  border-color: #428bca;\n}\n.proxies-history th {\n  line-height: 15px !important;\n}\n.clickable {\n  cursor: pointer;\n}\n.proxies-history-loading {\n  padding: 4px;\n  width: 200px;\n  text-align: center;\n  position: fixed;\n  left: 50%;\n  top: 50%;\n  margin-left: -100px;\n  z-index: 2;\n}\n.proxies-history-archive {\n  float: right;\n  font-size: 11px;\n  line-height: 14px;\n  margin-top: -1px;\n  margin-bottom: -2px;\n  margin-right: 32px;\n  text-align: right;\n}\n.proxies-history-archive > span {\n  border-bottom: 1px dashed;\n  border-color: #428bca;\n  cursor: pointer;\n  text-transform: lowercase;\n}\n.zones-table td,\n.zones-table thead th {\n  text-align: right;\n}\n.zones-table td.zones-zone,\n.zones-table thead th.zones-zone {\n  text-align: left;\n}\n#zone .panel-heading {\n  position: relative;\n}\n#zone .panel-heading button {\n  position: absolute;\n  right: 5px;\n  top: 5px;\n}\n.settings-alert {\n  position: relative;\n}\n.settings-alert .buttons {\n  position: absolute;\n  right: 10px;\n  top: 9px;\n}\n.github {\n  margin-top: 12px;\n}\n#config-textarea,\n#config-textarea + .CodeMirror,\n#resolve-textarea {\n  width: 100%;\n  height: 400px;\n  margin-bottom: 18px;\n}\n.resolve-add-host {\n  margin-top: -6px;\n  margin-bottom: 18px;\n}\n#settings-page {\n  padding-top: 20px;\n}\n.confirmation-items {\n  margin-top: 11px;\n}\n.form-range {\n  width: 100%;\n}\n.form-range .form-control {\n  display: inline-block;\n  width: 48%;\n}\n.form-range .range-seperator {\n  display: inline-block;\n  width: 2%;\n  text-align: center;\n}\n.luminati-login h3 {\n  font-weight: bold;\n  margin-top: 20px;\n  margin-bottom: 20px;\n}\n.luminati-login .alert-danger {\n  color: #d00;\n}\n.luminati-login label {\n  color: #818c93;\n  font-weight: normal;\n}\n.luminati-login button {\n  margin-top: 15px;\n  font-weight: bold;\n  padding: 10px 12px;\n  background-image: -o-linear-gradient(top, #37a3eb, #2181cf);\n  background-image: -webkit-gradient(linear, left top, left bottom, from(#37a3eb), to(#2181cf));\n  background-image: -webkit-linear-gradient(top, #37a3eb, #2181cf);\n  background-image: -moz-linear-gradient(top, #37a3eb, #2181cf);\n  background-image: linear-gradient(top, #37a3eb, #2181cf);\n  border: 1px solid #1c74b3;\n  border-bottom-color: #0d5b97;\n  border-top-color: #2c8ed1;\n  box-shadow: 0 1px 0 #ddd, inset 0 1px 0 rgba(255, 255, 255, 0.2);\n  color: #fff !important;\n  text-shadow: rgba(0, 0, 0, 0.2) 0 1px 0;\n  -webkit-appearance: none;\n  -moz-appearance: none;\n  appearance: none;\n  -moz-user-select: none;\n  -webkit-user-select: none;\n  -ms-user-select: none;\n  user-select: none;\n  -webkit-tap-highlight-color: transparent;\n}\n.luminati-login button:hover:enabled {\n  background-color: #3baaf4;\n  background-image: -o-linear-gradient(top, #3baaf4, #2389dc);\n  background-image: -webkit-gradient(linear, left top, left bottom, from(#3baaf4), to(#2389dc));\n  background-image: -webkit-linear-gradient(top, #3baaf4, #2389dc);\n  background-image: -moz-linear-gradient(top, #3baaf4, #2389dc);\n  background-image: linear-gradient(top, #3baaf4, #2389dc);\n}\n.luminati-login button:active {\n  background-image: -o-linear-gradient(top, #37a3eb, #2181cf);\n  background-image: -webkit-gradient(linear, left top, left bottom, from(#37a3eb), to(#2181cf));\n  background-image: -webkit-linear-gradient(top, #37a3eb, #2181cf);\n  background-image: -moz-linear-gradient(top, #37a3eb, #2181cf);\n  background-image: linear-gradient(top, #37a3eb, #2181cf);\n}\n.luminati-login .signup {\n  color: #818c93;\n  font-size: 16.5px;\n  margin-top: 12px;\n}\n#google {\n  min-width: 300px;\n}\n#google a.google {\n  color: white;\n  display: block;\n  padding: 0;\n  margin: auto;\n  margin-top: 50px;\n  margin-bottom: 40px;\n  height: 35px;\n  font-size: 16px;\n  padding-top: 6px;\n  padding-left: 95px;\n  cursor: pointer;\n  max-width: 300px;\n  text-align: left;\n  text-decoration: none;\n  border: none;\n  position: relative;\n  white-space: nowrap;\n}\n#google a.google,\n#google a.google:hover {\n  background: url(/img/social_btns.svg) no-repeat 50% 100%;\n}\n#google a.google:focus {\n  outline: 0;\n  top: 1px;\n}\n#google a.google:hover {\n  border: none;\n  box-shadow: none;\n  border-radius: 0;\n}\n#google a.google:active {\n  top: 1px;\n}\n.panel .panel-heading button.btn.btn-ico {\n  padding: 7px;\n  border: solid 1px #c8c2bf;\n  background-color: #fcfcfc;\n  width: 35px;\n  height: 34px;\n  margin: 0 1px;\n}\n.panel .panel-heading button.btn.btn-ico.add_proxy_btn {\n  color: #004d74;\n  background-color: #05bed1;\n  border-color: #05bed1;\n}\n.panel .panel-heading button.btn.btn-ico img {\n  width: 100%;\n  height: 100%;\n  vertical-align: baseline;\n}\n.panel .panel-heading button.btn.btn-ico[disabled] img {\n  opacity: 0.25;\n}\n.tooltip.in {\n  opacity: 1;\n}\n.tooltip-proxy-status .tooltip-inner,\n.tooltip-default .tooltip-inner,\n.tooltip .tooltip-inner {\n  max-width: 250px;\n  border: solid 1px black;\n  background: #fff;\n  color: black;\n}\n.status-details-wrapper {\n  background: #f7f7f7;\n  font-size: 12px;\n}\n.status-details-line {\n  margin: 0 0 5px 25px;\n}\n.status-details-icon-warn {\n  vertical-align: bottom;\n  padding-bottom: 1px;\n}\n.status-details-text {\n  padding: 0 0 0 5px;\n}\n.ic-status-triangle {\n  font-size: 12px;\n  color: #979797;\n}\n.text-err {\n  color: #d8393c;\n}\n.text-ok {\n  color: #4ca16a;\n}\n.text-warn {\n  color: #f5a623;\n}\n.pointer {\n  cursor: pointer;\n}\n.opened,\n.table-hover > tbody > tr.opened:hover {\n  background-color: #d7f6ff;\n}\n.table-hover > tbody > tr > td {\n  border: none;\n}\n.table-hover .no-hover:hover {\n  background: none;\n}\n.pull-none {\n  float: none !important;\n}\n.history__header {\n  margin-top: 10px;\n}\n.history-details__column-first {\n  width: 300px;\n}\n.modal-open .modal {\n  overflow-y: scroll;\n}\n.blue {\n  color: #4a90e2;\n}\n.pagination > li > a:hover,\n.pagination > .disabled > a:hover {\n  box-shadow: none;\n}\n.control-label.preset {\n  width: 100%;\n}\n.control-label.preset .form-control {\n  width: auto;\n  display: inline-block;\n}\ninput.form-control[type=checkbox] {\n  width: auto;\n  height: auto;\n  display: inline;\n}\n.proxies-table-input.session-edit input {\n  width: calc(100% - 2em);\n  display: inline-block;\n}\n.proxies-table-input.session-edit .btn {\n  padding: 4px;\n}\n.tabs_default:hover {\n  color: #555 !important;\n  box-shadow: none !important;\n}\n.chrome_icon {\n  width: 32px;\n  height: 32px;\n  background-image: url('img/icon_chrome.jpg');\n  background-repeat: no-repeat;\n  background-size: 32px 32px;\n  margin: auto;\n}\n.firefox_icon {\n  width: 32px;\n  height: 32px;\n  background-image: url(img/icon_firefox.jpg);\n  background-repeat: no-repeat;\n  background-size: 32px 32px;\n  margin: auto;\n}\n.safari_icon {\n  width: 32px;\n  height: 32px;\n  background-image: url(img/icon_safari.jpg);\n  background-repeat: no-repeat;\n  background-size: 32px 32px;\n  margin: auto;\n}\n.stats_row_change {\n  animation: pulse 1s;\n}\n.row_clickable {\n  cursor: pointer;\n}\n.code_max_height {\n  max-height: 500px;\n}\n.table-fixed {\n  table-layout: fixed;\n}\n.overflow-ellipsis {\n  overflow: hidden;\n  text-overflow: ellipsis;\n}\n.page-body .messages a.custom_link:hover {\n  background: none;\n  border: none;\n  box-shadow: none;\n}\n.pagination {\n  margin: 0;\n}\n.pagination .active > a,\n.pagination .active > a:focus,\n.pagination .active > span {\n  background: none;\n  color: black;\n  font-weight: bold;\n}\n.pagination .active > a:hover,\n.pagination .active > a:focus:hover,\n.pagination .active > span:hover {\n  background: none;\n  color: black;\n  font-weight: bold;\n}\n.pagination li > a,\n.pagination li > span,\n.pagination li > a:focus {\n  font-size: 14px;\n  padding: 0 5px;\n  color: #428bca;\n  line-height: 1.4;\n  background: none;\n  border: none;\n}\n.pagination li > a:hover,\n.pagination li > span:hover,\n.pagination li > a:focus:hover {\n  border: none;\n  background: none;\n  color: white;\n  background: #428bca;\n}\n.lpm {\n  font-family: \"Lato\";\n  color: #004d74;\n}\n.lpm h1 {\n  font-size: 36px;\n  font-weight: 500;\n  margin: 0;\n}\n.lpm h2 {\n  color: #05bed1;\n  font-size: 36px;\n  font-weight: bold;\n  letter-spacing: 1px;\n  margin: 0;\n}\n.lpm h3 {\n  font-size: 24px;\n  letter-spacing: 0.6px;\n  font-weight: bold;\n  margin: 0;\n  line-height: 1;\n}\n.lpm h4 {\n  margin: 0;\n}\n.lpm a {\n  color: #05bed1;\n  cursor: pointer;\n  border: none;\n  text-decoration: underline;\n}\n.lpm a:hover {\n  color: #05bed1;\n  cursor: pointer;\n  background: rgba(0, 0, 0, 0);\n  border: none;\n  box-shadow: none;\n  text-decoration: underline;\n}\n.lpm select,\n.lpm input[type=number],\n.lpm input[type=text],\n.lpm input[type=password],\n.lpm textarea {\n  width: 100%;\n  height: 32px;\n  background-color: white;\n  border: solid 1px #ccdbe3;\n  border-radius: 3px;\n  padding-left: 10px;\n  padding-right: 25px;\n  font-weight: 300;\n  -webkit-appearance: none;\n  -moz-appearance: none;\n  appearance: none;\n}\n.lpm select:focus,\n.lpm input[type=number]:focus,\n.lpm input[type=text]:focus,\n.lpm input[type=password]:focus,\n.lpm textarea:focus {\n  outline: none;\n  border: solid 1px #05bed1;\n}\n.lpm textarea {\n  height: auto;\n  resize: vertical;\n}\n.lpm select {\n  background: url(/img/down.svg) no-repeat;\n  background-position: right 10px center;\n}\n.lpm input[type=number]::-webkit-inner-spin-button,\n.lpm input[type=number]::-webkit-outer-spin-button {\n  -webkit-appearance: none;\n}\n.lpm input[type=number] {\n  -moz-appearance: textfield;\n}\n.lpm .radio_buttons {\n  width: 100%;\n  display: flex;\n}\n.lpm .radio_buttons .option {\n  flex: 1;\n}\n.lpm .radio_buttons input[type=radio] {\n  display: none;\n}\n.lpm .radio_buttons label {\n  cursor: pointer;\n  font-size: 12px;\n  font-weight: 300;\n}\n.lpm .radio_buttons input[type=radio] + .checked_icon {\n  display: inline-block;\n  width: 16px;\n  height: 16px;\n  margin: -2px 6px 0 0;\n  vertical-align: middle;\n  background: none;\n}\n.lpm .radio_buttons input[type=radio]:checked + .checked_icon {\n  background: url(/img/check_radio.svg) left top no-repeat;\n}\n.lpm .highlight {\n  color: #05bed1;\n  margin-right: 5px;\n  font-weight: bold;\n}\n.lpm a.btn_lpm {\n  text-decoration: none;\n  color: #004d74;\n}\n.lpm a.btn_lpm:hover {\n  border-width: 1px;\n  border-style: solid;\n}\n.lpm .btn_lpm {\n  width: 160px;\n  height: 32px;\n  border-radius: 2px;\n  background-color: #05bed1;\n  border: solid 1px #05bed1;\n  color: white;\n  font-size: 16px;\n  font-weight: bold;\n  padding-top: 3px;\n  margin: 0 5px;\n  box-shadow: none;\n}\n.lpm .btn_lpm:hover {\n  background-color: #004d74;\n  border-color: #004d74;\n}\n.lpm .btn_lpm:active,\n.lpm .btn_lpm.active {\n  background-color: #003d5b;\n  border-color: #003d5b;\n  color: #05bed1;\n}\n.lpm .btn_lpm:focus {\n  outline: none;\n}\n.lpm .btn_lpm_default {\n  color: #05bed1;\n  background-color: white;\n  border-color: #05bed1;\n}\n.lpm .btn_lpm_default:hover {\n  background-color: #B4E6EE;\n  border-color: #05bed1;\n}\n.lpm .btn_lpm_default:active,\n.lpm .btn_lpm_default.active {\n  background-color: #05bed1;\n  border-color: #05bed1;\n  color: white;\n}\n.lpm .btn_lpm_normal {\n  color: #004d74;\n  border-color: #ccdbe3;\n  background-color: white;\n}\n.lpm .btn_lpm_normal:hover {\n  background-color: #f5f5f5;\n  border-color: #ccdbe3;\n}\n.lpm .btn_lpm_normal:active,\n.lpm .btn_lpm_normal.active {\n  background-color: #d7d7d7;\n  border-color: #d7d7d7;\n  color: #004d74;\n}\n.lpm .btn_lpm_big {\n  line-height: 0;\n  font-size: 32px;\n  padding-bottom: 9px;\n  border-radius: 4px;\n  font-weight: 700;\n  width: 280px;\n  height: 60px;\n}\n.lpm .btn_lpm_small {\n  font-size: 11px;\n  height: 27px;\n  width: auto;\n}\n.lpm .btn_copy {\n  color: #05bed1;\n  border-color: #05bed1;\n  font-size: 9px;\n  padding: 0;\n  width: 35px;\n  height: 20px;\n  font-weight: 900;\n  margin-left: 10px;\n  position: relative;\n  top: -1px;\n}\n.lpm .btn_copy:hover {\n  color: white;\n}\n.lpm .loader_wrapper {\n  position: fixed;\n  z-index: 5000;\n}\n.lpm .loader_wrapper .mask {\n  background-color: #004d74;\n  opacity: 0.1;\n  width: 100%;\n  height: 100%;\n  position: fixed;\n  top: 0;\n  left: 0;\n}\n.lpm .loader_wrapper .loader {\n  display: flex;\n  align-items: center;\n  background-color: white;\n  border-radius: 50%;\n  width: 130px;\n  height: 130px;\n  position: fixed;\n  top: 0;\n  bottom: 0;\n  margin: auto;\n  left: 0;\n  right: 0;\n  z-index: 10;\n  box-shadow: 0px 4px 6px 0 #d7d7d7;\n}\n.lpm .loader_wrapper .loader .spinner {\n  background: url(/img/loader.gif);\n  width: 88px;\n  height: 88px;\n  margin: auto;\n}\n.lpm .modal .modal-content {\n  border: 0;\n  width: 640px;\n}\n.lpm .modal .modal-header {\n  border: 0;\n}\n.lpm .modal .modal-header h4 {\n  font-size: 24px;\n  font-weight: bold;\n  text-align: center;\n  padding-top: 30px;\n  line-height: 0;\n}\n.lpm .modal .modal-header .close_icon {\n  background: url(/img/delete.svg);\n  width: 16px;\n  height: 16px;\n  opacity: 1;\n  position: absolute;\n  top: 19px;\n  right: 19px;\n}\n.lpm .modal .modal-body {\n  padding: 15px 50px 0;\n}\n.lpm .modal .modal-footer {\n  border: 0;\n  text-align: center;\n}\n.lpm .modal .modal-footer .default_footer {\n  text-align: right;\n}\n.lpm .modal .modal-footer .default_footer .cancel {\n  width: 72px;\n}\n.lpm .modal .modal-footer .default_footer .ok {\n  width: 88px;\n}\n.lpm .rbt.open {\n  width: 100%;\n}\n.lpm .rbt .rbt-input {\n  padding: 1px 25px 1px 10px;\n  color: #004d74;\n  border-radius: 3px;\n  border: solid 1px #ccdbe3;\n  -webkit-box-shadow: none;\n  box-shadow: none;\n  cursor: text;\n}\n.lpm .rbt .rbt-input[disabled] {\n  cursor: default;\n  background-color: #f5f5f5;\n  border-color: #E0E9EE;\n  color: #ccdbe3;\n}\n.lpm .rbt .rbt-input-wrapper {\n  position: relative;\n  top: 5px;\n}\n.lpm .rbt .rbt-input-wrapper input {\n  height: auto;\n}\n.lpm .rbt .dropdown-menu {\n  width: 100%;\n}\n.lpm .rbt .dropdown-menu .dropdown-item {\n  color: #05bed1;\n}\n.lpm .rbt .dropdown-menu .dropdown-item mark {\n  color: #004d74;\n}\n.edit_proxy h3 {\n  margin-bottom: 20px;\n}\n.edit_proxy .nav {\n  display: flex;\n  margin-bottom: 20px;\n}\n.edit_proxy .nav .field {\n  flex-grow: 1;\n}\n.edit_proxy .nav .field .title {\n  display: inline-block;\n}\n.edit_proxy .nav .field select,\n.edit_proxy .nav .field input[type=number],\n.edit_proxy .nav .field input[type=text] {\n  color: #05bed1;\n  font-weight: bold;\n  margin-left: 10px;\n  width: 200px;\n}\n.edit_proxy .nav .action_buttons {\n  flex-grow: 3;\n  display: flex;\n  direction: rtl;\n}\n.edit_proxy .nav .action_buttons .btn_save {\n  margin-right: 0;\n  order: 1;\n}\n.edit_proxy .nav .action_buttons .btn_cancel {\n  margin-left: 0;\n  order: 2;\n}\n.edit_proxy .warnings_modal .modal-header h4 {\n  font-size: 20px;\n}\n.edit_proxy .warnings_modal .modal-body {\n  padding: 20px;\n}\n.edit_proxy .warnings_modal .warning {\n  margin: 10px 0;\n  font-size: 14px;\n  color: #003d5b;\n  display: flex;\n  align-items: center;\n  background-color: #fff5d7;\n  border-radius: 2px;\n  padding: 17px 20px;\n}\n.edit_proxy .warnings_modal .warning .warning_icon {\n  background: url(/img/warning.svg);\n  width: 18px;\n  min-width: 18px;\n  height: 18px;\n  margin-right: 22px;\n}\n.edit_proxy .nav_tabs {\n  display: flex;\n  margin-bottom: 20px;\n  padding-bottom: 20px;\n  border-bottom: solid 1px #E0E9EE;\n}\n.edit_proxy .nav_tabs .btn_tab {\n  flex-grow: 1;\n  height: 100px;\n  margin: 0 3px;\n  background-color: #f5f5f5;\n  border: solid 2px #f5f5f5;\n  border-radius: 4px;\n  cursor: pointer;\n  text-align: center;\n  position: relative;\n}\n.edit_proxy .nav_tabs .btn_tab .icon {\n  width: 30px;\n  height: 30px;\n  opacity: 0.6;\n  margin: auto;\n  position: relative;\n  top: 16px;\n}\n.edit_proxy .nav_tabs .btn_tab .circle_wrapper {\n  display: none;\n  width: 12px;\n  height: 12px;\n  background-color: #05bed1;\n  position: relative;\n  left: 29px;\n  top: -5px;\n  border-radius: 50%;\n}\n.edit_proxy .nav_tabs .btn_tab .circle_wrapper.active {\n  display: block;\n}\n.edit_proxy .nav_tabs .btn_tab .circle_wrapper.error {\n  background-color: #ef6153;\n}\n.edit_proxy .nav_tabs .btn_tab .circle_wrapper .circle {\n  color: white;\n  font-size: 9px;\n  line-height: 0;\n  position: relative;\n  top: 6px;\n  font-weight: bold;\n}\n.edit_proxy .nav_tabs .btn_tab .title {\n  position: absolute;\n  top: 55px;\n  left: 0;\n  right: 0;\n  opacity: 0.8;\n}\n.edit_proxy .nav_tabs .btn_tab .info {\n  background: url(/img/info.svg);\n  width: 11px;\n  height: 11px;\n  opacity: 0.4;\n  position: absolute;\n  bottom: 6px;\n  right: 6px;\n  cursor: pointer;\n}\n.edit_proxy .nav_tabs .btn_tab .icon.target {\n  background: url(/img/target.svg);\n}\n.edit_proxy .nav_tabs .btn_tab .icon.speed {\n  background: url(/img/speed.svg);\n}\n.edit_proxy .nav_tabs .btn_tab .icon.rules {\n  background: url(/img/rules.svg);\n}\n.edit_proxy .nav_tabs .btn_tab .icon.rotation {\n  background: url(/img/rotation.svg);\n}\n.edit_proxy .nav_tabs .btn_tab .icon.debug {\n  background: url(/img/debug.svg);\n}\n.edit_proxy .nav_tabs .btn_tab .icon.general {\n  background: url(/img/general.svg);\n}\n.edit_proxy .nav_tabs .btn_tab:first-child {\n  margin-left: 0;\n}\n.edit_proxy .nav_tabs .btn_tab:last-child {\n  margin-right: 0;\n}\n.edit_proxy .nav_tabs .btn_tab.active,\n.edit_proxy .nav_tabs .btn_tab:hover {\n  border-color: #05bed1;\n  background-color: white;\n}\n.edit_proxy .nav_tabs .btn_tab.active {\n  cursor: default;\n}\n.edit_proxy .nav_tabs .btn_tab.active .icon {\n  opacity: 1;\n}\n.edit_proxy .nav_tabs .btn_tab.active .title {\n  opacity: 1;\n  font-weight: bold;\n}\n.edit_proxy .nav_tabs .btn_tab.active .arrow {\n  border-left: 7px solid transparent;\n  border-right: 7px solid transparent;\n  border-top: 6px solid #05bed1;\n  position: absolute;\n  bottom: -8px;\n  left: 0;\n  right: 0;\n  width: 0;\n  margin: auto;\n}\n.edit_proxy .tab_header {\n  font-size: 16px;\n  font-weight: bold;\n}\n.edit_proxy .note {\n  font-size: 13px;\n  margin-bottom: 15px;\n}\n.edit_proxy .section_wrapper {\n  display: flex;\n  align-items: center;\n}\n.edit_proxy .section_wrapper:focus {\n  outline: 0;\n}\n.edit_proxy .section_wrapper .outlined {\n  position: relative;\n  border: solid 1px #E0E9EE;\n  border-radius: 4px;\n  flex: 2 0;\n  margin: 5px 0;\n  padding: 14px 30px;\n}\n.edit_proxy .section_wrapper .outlined .header {\n  font-size: 16px;\n  font-weight: bold;\n  height: 40px;\n  color: #05bed1;\n}\n.edit_proxy .section_wrapper .outlined .section_body {\n  position: relative;\n  font-size: 14px;\n}\n.edit_proxy .section_wrapper .outlined .section_body .note {\n  margin-bottom: 0;\n}\n.edit_proxy .section_wrapper .outlined .section_body .field_row {\n  display: flex;\n  align-items: center;\n}\n.edit_proxy .section_wrapper .outlined .section_body .field_row:not(:first-child) {\n  margin-top: 15px;\n}\n.edit_proxy .section_wrapper .outlined .section_body .desc {\n  flex: 3 3;\n  line-height: 1.07;\n  padding-right: 35px;\n}\n.edit_proxy .section_wrapper .outlined .section_body .field {\n  padding-right: 20px;\n  flex: 5 5;\n  align-items: center;\n}\n.edit_proxy .section_wrapper .outlined .section_body .field .inline_field {\n  display: flex;\n}\n.edit_proxy .section_wrapper .outlined .section_body .field .sufix {\n  margin-left: 20px;\n}\n.edit_proxy .section_wrapper .outlined .section_body .field .double_field {\n  display: flex;\n}\n.edit_proxy .section_wrapper .outlined .section_body .field .double_field input {\n  flex: 2 2;\n}\n.edit_proxy .section_wrapper .outlined .section_body .field .double_field .divider {\n  flex: 1 1;\n  text-align: center;\n}\n.edit_proxy .section_wrapper .outlined .icon {\n  position: absolute;\n  right: 20px;\n  top: 0;\n  bottom: 0;\n  margin-top: auto;\n  margin-bottom: auto;\n}\n.edit_proxy .section_wrapper .outlined .arrow {\n  border-top: solid 7px transparent;\n  border-bottom: solid 7px transparent;\n  position: absolute;\n  margin-top: auto;\n  margin-bottom: auto;\n  top: 0;\n  height: 14px;\n  bottom: 0;\n  right: -7px;\n}\n.edit_proxy .section_wrapper .outlined.error {\n  border-color: #F9BFB9;\n}\n.edit_proxy .section_wrapper .outlined.error .icon {\n  background: url(/img/error.svg);\n  width: 10px;\n  height: 10px;\n}\n.edit_proxy .section_wrapper .outlined.error .arrow {\n  border-left: solid 6px #ef6153;\n}\n.edit_proxy .section_wrapper .outlined.error select,\n.edit_proxy .section_wrapper .outlined.error input[type=number],\n.edit_proxy .section_wrapper .outlined.error input[type=text] {\n  border-color: #ef6153;\n}\n.edit_proxy .section_wrapper .outlined.correct {\n  border-color: #B4E6EE;\n}\n.edit_proxy .section_wrapper .outlined.correct .desc {\n  color: #05bed1;\n}\n.edit_proxy .section_wrapper .outlined.correct .icon {\n  background: url(/img/check.svg);\n  width: 11px;\n  height: 8px;\n}\n.edit_proxy .section_wrapper .outlined.active {\n  border-color: #05bed1;\n}\n.edit_proxy .section_wrapper .outlined.active .desc {\n  color: #05bed1;\n}\n.edit_proxy .section_wrapper .outlined.active .arrow {\n  border-left: solid 6px #05bed1;\n}\n.edit_proxy .section_wrapper .outlined.disabled {\n  color: #ccdbe3;\n}\n.edit_proxy .section_wrapper .outlined.disabled a {\n  color: #ccdbe3;\n}\n.edit_proxy .section_wrapper .outlined.disabled input,\n.edit_proxy .section_wrapper .outlined.disabled select {\n  background-color: #f5f5f5;\n  border-color: #E0E9EE;\n}\n.edit_proxy .section_wrapper .outlined.disabled label {\n  cursor: default;\n}\n.edit_proxy .section_wrapper .message_wrapper {\n  margin-left: 25px;\n  flex: 1 0;\n  display: inline-block;\n}\n.edit_proxy .section_wrapper .message_wrapper .message {\n  display: none;\n  font-size: 14px;\n  line-height: 1.17;\n  border-radius: 4px;\n  padding: 14px 19px;\n  background-color: #E6F6F9;\n}\n.edit_proxy .section_wrapper .message_wrapper .message.active {\n  display: block;\n}\n.edit_proxy .section_wrapper .message_wrapper .message.error {\n  display: block;\n  background-color: #ffebeb;\n  color: #eb3a28;\n}\n.modal-backdrop.fade.in {\n  opacity: 0.15;\n}\n.intro {\n  text-align: center;\n  margin-top: 40px;\n}\n.intro .header {\n  margin: auto;\n}\n.intro .sub_header {\n  margin: auto;\n  margin-top: 10px;\n}\n.intro .img_intro {\n  background: url(/img/lpm_infographics.png);\n  width: 592px;\n  height: 326px;\n  margin: 15px 0;\n}\n.intro .section {\n  cursor: pointer;\n  text-align: initial;\n  width: 470px;\n  height: 83px;\n  margin: auto;\n  border: 2px solid #05bed1;\n  box-shadow: 0 2px 2px 0 rgba(156, 181, 190, 0.57);\n  border-radius: 4px;\n  margin-top: 20px;\n  margin-bottom: 20px;\n  padding-top: 17px;\n}\n.intro .section .img_block {\n  position: absolute;\n}\n.intro .section .img_block .circle_wrapper {\n  border: 1px solid #05bed1;\n  width: 20px;\n  height: 20px;\n  position: relative;\n  border-radius: 50%;\n  left: 19px;\n  z-index: 1;\n  background-color: white;\n}\n.intro .section .text_block {\n  display: inline-block;\n  position: relative;\n  left: 110px;\n}\n.intro .section .title {\n  font-size: 22px;\n  font-weight: 700;\n}\n.intro .section .subtitle {\n  font-size: 14px;\n  color: #05bed1;\n}\n.intro .section .right_arrow {\n  width: 14px;\n  height: 14px;\n  position: relative;\n  top: -32px;\n  left: 425px;\n  transform: rotate(45deg);\n  border-top: 2px solid #05bed1;\n  border-right: 2px solid #05bed1;\n}\n.intro .section.disabled {\n  cursor: initial;\n  border: solid 1px #E0E9EE;\n  color: #9cb5be;\n}\n.intro .section.disabled .subtitle {\n  color: #9cb5be;\n}\n.intro .section.disabled .right_arrow {\n  border-color: #9cb5be;\n}\n.intro .section_list {\n  counter-reset: section;\n}\n.intro .img {\n  width: 40px;\n  height: 40px;\n  position: relative;\n  left: 30px;\n  top: -18px;\n}\n.intro .img:before {\n  color: #05bed1;\n  counter-increment: section;\n  content: counters(section, \".\");\n  font-size: 12px;\n  position: absolute;\n  left: -4px;\n  top: -4px;\n  z-index: 2;\n}\n.intro .img_1_active {\n  background: url(/img/1_active.svg);\n}\n.intro .img_2 {\n  background: url(/img/2.svg);\n}\n.intro .img_2_active {\n  background: url(/img/2_active.svg);\n}\n.intro .img_3 {\n  background: url(/img/3.svg);\n}\n.intro .img_3_active {\n  background: url(/img/3_active.svg);\n}\n.intro .howto {\n  width: 537px;\n  margin: auto;\n  margin-bottom: 100px;\n}\n.intro .howto h1.sub_header {\n  line-height: 0;\n  margin: 0 0 25px 0;\n  color: #05bed1;\n}\n.intro .howto .choices {\n  height: 140px;\n}\n.intro .howto .choice {\n  cursor: pointer;\n  display: inline-block;\n  width: 205px;\n  height: 83px;\n  border-radius: 4px;\n  box-shadow: 0 2px 2px 0 #ccdbe3;\n  border: solid 1px #E0E9EE;\n  margin: 30px 20px;\n}\n.intro .howto .choice .content {\n  position: relative;\n  top: 14px;\n}\n.intro .howto .choice .text_smaller {\n  font-size: 14px;\n}\n.intro .howto .choice .text_bigger {\n  font-size: 20px;\n  font-weight: bold;\n}\n.intro .howto .choice.active,\n.intro .howto .choice:hover {\n  border: solid 2px #00aac3;\n  margin-top: 29px;\n}\n.intro .howto .text_middle {\n  display: inline-block;\n  font-size: 17px;\n  font-weight: bold;\n}\n.intro .howto .well {\n  text-align: left;\n  box-shadow: none;\n  border-radius: 3px;\n  background-color: #f5f5f5;\n}\n.intro .howto .browser_instructions .header_well {\n  font-size: 14px;\n  font-weight: bold;\n}\n.intro .howto .browser_instructions .header_well p {\n  margin: 10px;\n  display: inline-block;\n}\n.intro .howto .browser_instructions .header_well select {\n  width: 270px;\n  float: right;\n}\n.intro .howto .code_instructions .header_well {\n  text-align: center;\n}\n.intro .howto .instructions_well {\n  margin-top: 25px;\n  margin-bottom: 25px;\n  position: relative;\n}\n.intro .howto .instructions_well pre {\n  border: none;\n  font-size: 12px;\n  background-color: #E6F6F9;\n}\n.intro .howto .instructions_well pre .btn_copy {\n  position: absolute;\n  top: 28px;\n  right: 28px;\n}\n.intro .howto .btn_lang {\n  margin: 0 2px;\n}\n.intro .howto .btn_done {\n  float: right;\n}\n.intro .howto .instructions {\n  margin-left: 30px;\n  border-left: 1px solid #05bed1;\n}\n.intro .howto .instructions .single_instruction {\n  font-size: 14px;\n  padding-left: 23px;\n  position: relative;\n  top: 2px;\n}\n.intro .howto .instructions ul {\n  margin: 0;\n}\n.intro .howto .instructions ol {\n  counter-reset: section;\n  list-style-type: none;\n  padding-left: 0;\n}\n.intro .howto .instructions li {\n  padding-bottom: 12px;\n}\n.intro .howto .instructions ol li .circle_wrapper {\n  position: absolute;\n  left: 37px;\n  background-color: #f5f5f5;\n  height: 28px;\n  display: inline-block;\n}\n.intro .howto .instructions ol li .circle {\n  border: 1px solid #00bcd2;\n  border-radius: 50%;\n  width: 22px;\n  height: 22px;\n  position: relative;\n  top: 3px;\n  left: 1px;\n}\n.intro .howto .instructions ol li:last-child {\n  padding-bottom: 0;\n}\n.intro .howto .instructions ol li .circle:before {\n  counter-increment: section;\n  content: counters(section, \".\");\n  display: inline-block;\n  font-size: 11px;\n  color: #00bcd2;\n  margin-top: 3px;\n  text-align: center;\n  font-weight: 600;\n  position: relative;\n  left: 7px;\n  top: -5px;\n}\n.intro .howto .instructions code {\n  font-family: Lato;\n  font-size: 13px;\n  font-weight: bold;\n  letter-spacing: -0.1px;\n  border-radius: 3px;\n  background-color: #e7f9fa;\n  color: #005271;\n  padding: 3px 10px;\n  margin: 0 5px;\n}\n.add_proxy_modal.modal .modal-content .icon {\n  position: absolute;\n  width: 26px;\n  height: 26px;\n}\n.add_proxy_modal.modal .modal-content .zone_icon {\n  background: url(/img/zone_icon.png);\n}\n.add_proxy_modal.modal .modal-content .preset_icon {\n  background: url(/img/preset_icon.png);\n}\n.add_proxy_modal.modal .modal-content .modal-footer button {\n  margin: 10px 16px;\n}\n.add_proxy_modal.modal .modal-content .modal-footer button.options {\n  width: 190px;\n}\n.add_proxy_modal.modal .modal-content .section {\n  margin-bottom: 37px;\n}\n.add_proxy_modal.modal .modal-content .section:last-child {\n  margin-bottom: 10px;\n}\n.add_proxy_modal.modal .modal-content .section h4 {\n  color: #05bed1;\n  font-weight: bold;\n  font-size: 20px;\n  letter-spacing: 0.5px;\n  position: relative;\n  left: 50px;\n  top: 3px;\n}\n.add_proxy_modal.modal .modal-content .section select {\n  margin-top: 25px;\n}\n.add_proxy_modal.modal .modal-content .preview {\n  margin-top: 15px;\n  border: solid 1px #ccdbe3;\n  padding: 20px 30px;\n  border-radius: 4px;\n}\n.add_proxy_modal.modal .modal-content .preview .header {\n  height: 30px;\n  font-size: 16px;\n  font-weight: bold;\n}\n.add_proxy_modal.modal .modal-content .preview .desc {\n  font-size: 14px;\n  line-height: 1.3;\n  margin-bottom: 12px;\n}\n.add_proxy_modal.modal .modal-content ul {\n  padding-left: 0;\n}\n.add_proxy_modal.modal .modal-content ul li {\n  list-style: none;\n}\n.add_proxy_modal.modal .modal-content ul li::before {\n  color: #05bed1;\n  content: \"\\2022\";\n  font-size: 26px;\n  padding-right: 6px;\n  position: relative;\n  top: 2px;\n}\n.nav_left {\n  margin-top: -30px;\n  position: absolute;\n  width: 224px;\n  height: 100%;\n}\n.nav_left .menu {\n  background-color: #E6F6F9;\n  padding-top: 11px;\n}\n.nav_left .menu .menu_item {\n  background-color: #E6F6F9;\n  height: 40px;\n  position: relative;\n  cursor: pointer;\n}\n.nav_left .menu .menu_item .text {\n  color: #05bed1;\n  height: 22px;\n  position: absolute;\n  top: 50%;\n  margin-top: -11px;\n  left: 60px;\n  font-size: 14px;\n}\n.nav_left .menu .menu_item.active {\n  background-color: #B4E6EE;\n  cursor: default;\n}\n.nav_left .menu .menu_item.active .text {\n  color: #004d74;\n}\n.nav_left .menu .icon {\n  width: 20px;\n  height: 20px;\n  position: relative;\n  top: 10px;\n  left: 20px;\n}\n.nav_left .menu .howto {\n  background-image: url('img/howto.svg');\n}\n.nav_left .menu .proxies {\n  background-image: url('img/proxies.svg');\n}\n.nav_left .menu .stats {\n  background-image: url('img/stats.svg');\n}\n.nav_left .menu .zones {\n  background-image: url('img/zones.svg');\n}\n.nav_left .menu .tester {\n  background-image: url('img/tester.svg');\n}\n.nav_left .menu .tools {\n  background-image: url('img/tools.svg');\n}\n.nav_left .menu .faq {\n  background-image: url('img/faq.svg');\n}\n.nav_left .menu_filler {\n  background-color: #F3FBFC;\n  height: 100%;\n}\n.nav_top {\n  margin-bottom: 30px;\n  background-color: #f5f5f5;\n  height: 60px;\n}\n.nav_top .logo_wrapper {\n  height: 60px;\n  width: 224px;\n  background: white;\n  display: inline-block;\n}\n.nav_top .logo {\n  background-image: url('img/luminati_logo_2.svg');\n  width: 166px;\n  height: 35px;\n  position: relative;\n  top: 8px;\n  left: 24px;\n}\n.nav_top .version {\n  font-size: 9px;\n  font-weight: bold;\n  float: right;\n  position: relative;\n  top: 4px;\n  right: 3px;\n  opacity: 0.5;\n}\n.nav_top .dropdown {\n  float: right;\n  margin: 18px 36px 0 0;\n  font-size: 14px;\n}\n.nav_top .dropdown-toggle {\n  color: #004d74;\n  padding: 3px 17px 3px 5px;\n  position: relative;\n  text-decoration: none;\n}\n.nav_top .dropdown-toggle .caret {\n  position: absolute;\n  right: 6px;\n  top: 12px;\n  margin: 0;\n}\n.nav_top .dropdown-menu li a {\n  color: #004d74;\n  text-decoration: none;\n}\n", ""]);

// exports


/***/ }),
/* 694 */,
/* 695 */,
/* 696 */,
/* 697 */
/***/ (function(module, exports, __webpack_require__) {

var __WEBPACK_AMD_DEFINE_RESULT__;/* FileSaver.js
 * A saveAs() FileSaver implementation.
 * 1.3.2
 * 2016-06-16 18:25:19
 *
 * By Eli Grey, http://eligrey.com
 * License: MIT
 *   See https://github.com/eligrey/FileSaver.js/blob/master/LICENSE.md
 */

/*global self */
/*jslint bitwise: true, indent: 4, laxbreak: true, laxcomma: true, smarttabs: true, plusplus: true */

/*! @source http://purl.eligrey.com/github/FileSaver.js/blob/master/FileSaver.js */

var saveAs = saveAs || (function(view) {
	"use strict";
	// IE <10 is explicitly unsupported
	if (typeof view === "undefined" || typeof navigator !== "undefined" && /MSIE [1-9]\./.test(navigator.userAgent)) {
		return;
	}
	var
		  doc = view.document
		  // only get URL when necessary in case Blob.js hasn't overridden it yet
		, get_URL = function() {
			return view.URL || view.webkitURL || view;
		}
		, save_link = doc.createElementNS("http://www.w3.org/1999/xhtml", "a")
		, can_use_save_link = "download" in save_link
		, click = function(node) {
			var event = new MouseEvent("click");
			node.dispatchEvent(event);
		}
		, is_safari = /constructor/i.test(view.HTMLElement) || view.safari
		, is_chrome_ios =/CriOS\/[\d]+/.test(navigator.userAgent)
		, throw_outside = function(ex) {
			(view.setImmediate || view.setTimeout)(function() {
				throw ex;
			}, 0);
		}
		, force_saveable_type = "application/octet-stream"
		// the Blob API is fundamentally broken as there is no "downloadfinished" event to subscribe to
		, arbitrary_revoke_timeout = 1000 * 40 // in ms
		, revoke = function(file) {
			var revoker = function() {
				if (typeof file === "string") { // file is an object URL
					get_URL().revokeObjectURL(file);
				} else { // file is a File
					file.remove();
				}
			};
			setTimeout(revoker, arbitrary_revoke_timeout);
		}
		, dispatch = function(filesaver, event_types, event) {
			event_types = [].concat(event_types);
			var i = event_types.length;
			while (i--) {
				var listener = filesaver["on" + event_types[i]];
				if (typeof listener === "function") {
					try {
						listener.call(filesaver, event || filesaver);
					} catch (ex) {
						throw_outside(ex);
					}
				}
			}
		}
		, auto_bom = function(blob) {
			// prepend BOM for UTF-8 XML and text/* types (including HTML)
			// note: your browser will automatically convert UTF-16 U+FEFF to EF BB BF
			if (/^\s*(?:text\/\S*|application\/xml|\S*\/\S*\+xml)\s*;.*charset\s*=\s*utf-8/i.test(blob.type)) {
				return new Blob([String.fromCharCode(0xFEFF), blob], {type: blob.type});
			}
			return blob;
		}
		, FileSaver = function(blob, name, no_auto_bom) {
			if (!no_auto_bom) {
				blob = auto_bom(blob);
			}
			// First try a.download, then web filesystem, then object URLs
			var
				  filesaver = this
				, type = blob.type
				, force = type === force_saveable_type
				, object_url
				, dispatch_all = function() {
					dispatch(filesaver, "writestart progress write writeend".split(" "));
				}
				// on any filesys errors revert to saving with object URLs
				, fs_error = function() {
					if ((is_chrome_ios || (force && is_safari)) && view.FileReader) {
						// Safari doesn't allow downloading of blob urls
						var reader = new FileReader();
						reader.onloadend = function() {
							var url = is_chrome_ios ? reader.result : reader.result.replace(/^data:[^;]*;/, 'data:attachment/file;');
							var popup = view.open(url, '_blank');
							if(!popup) view.location.href = url;
							url=undefined; // release reference before dispatching
							filesaver.readyState = filesaver.DONE;
							dispatch_all();
						};
						reader.readAsDataURL(blob);
						filesaver.readyState = filesaver.INIT;
						return;
					}
					// don't create more object URLs than needed
					if (!object_url) {
						object_url = get_URL().createObjectURL(blob);
					}
					if (force) {
						view.location.href = object_url;
					} else {
						var opened = view.open(object_url, "_blank");
						if (!opened) {
							// Apple does not allow window.open, see https://developer.apple.com/library/safari/documentation/Tools/Conceptual/SafariExtensionGuide/WorkingwithWindowsandTabs/WorkingwithWindowsandTabs.html
							view.location.href = object_url;
						}
					}
					filesaver.readyState = filesaver.DONE;
					dispatch_all();
					revoke(object_url);
				}
			;
			filesaver.readyState = filesaver.INIT;

			if (can_use_save_link) {
				object_url = get_URL().createObjectURL(blob);
				setTimeout(function() {
					save_link.href = object_url;
					save_link.download = name;
					click(save_link);
					dispatch_all();
					revoke(object_url);
					filesaver.readyState = filesaver.DONE;
				});
				return;
			}

			fs_error();
		}
		, FS_proto = FileSaver.prototype
		, saveAs = function(blob, name, no_auto_bom) {
			return new FileSaver(blob, name || blob.name || "download", no_auto_bom);
		}
	;
	// IE 10+ (native saveAs)
	if (typeof navigator !== "undefined" && navigator.msSaveOrOpenBlob) {
		return function(blob, name, no_auto_bom) {
			name = name || blob.name || "download";

			if (!no_auto_bom) {
				blob = auto_bom(blob);
			}
			return navigator.msSaveOrOpenBlob(blob, name);
		};
	}

	FS_proto.abort = function(){};
	FS_proto.readyState = FS_proto.INIT = 0;
	FS_proto.WRITING = 1;
	FS_proto.DONE = 2;

	FS_proto.error =
	FS_proto.onwritestart =
	FS_proto.onprogress =
	FS_proto.onwrite =
	FS_proto.onabort =
	FS_proto.onerror =
	FS_proto.onwriteend =
		null;

	return saveAs;
}(
	   typeof self !== "undefined" && self
	|| typeof window !== "undefined" && window
	|| this.content
));
// `self` is undefined in Firefox for Android content script context
// while `this` is nsIContentFrameMessageManager
// with an attribute `content` that corresponds to the window

if (typeof module !== "undefined" && module.exports) {
  module.exports.saveAs = saveAs;
} else if (("function" !== "undefined" && __webpack_require__(698) !== null) && (__webpack_require__(699) !== null)) {
  !(__WEBPACK_AMD_DEFINE_RESULT__ = function() {
    return saveAs;
  }.call(exports, __webpack_require__, exports, module),
				__WEBPACK_AMD_DEFINE_RESULT__ !== undefined && (module.exports = __WEBPACK_AMD_DEFINE_RESULT__));
}


/***/ }),
/* 698 */
/***/ (function(module, exports) {

module.exports = function() {
	throw new Error("define cannot be used indirect");
};


/***/ }),
/* 699 */
/***/ (function(module, exports) {

/* WEBPACK VAR INJECTION */(function(__webpack_amd_options__) {/* globals __webpack_amd_options__ */
module.exports = __webpack_amd_options__;

/* WEBPACK VAR INJECTION */}.call(exports, {}))

/***/ })
]),[306]);