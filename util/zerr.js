// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, browser:true*/
(function(){
var define, process, cluster, worker_threads, version;
var is_node = typeof module=='object' && module.exports && module.children;
var is_rn = typeof global=='object' && !!global.nativeRequire ||
    typeof navigator=='object' && navigator.product=='ReactNative';
if (is_rn)
{
    define = require('./require_node.js').define(module, '../',
        require('/util/date.js'), require('/util/util.js'),
        require('/util/sprintf.js'), require('/util/rate_limit.js'),
        require('/util/escape.js'));
    process = {
        nextTick: function(fn){ setTimeout(fn, 0); },
        env: {},
    };
}
else if (!is_node)
{
    define = self.define;
    process = {env: {}};
}
else
{
    define = require('./require_node.js').define(module, '../');
    if (is_node)
    {
        process = global.process||require('_process');
        require('./config.js');
        cluster = require('cluster');
        // XXX stanislav/sergeyp: remove try/catch wrap after node on
        // app_win64_jse is updated
        worker_threads = {isMainThread: true};
        try { worker_threads = require('worker_threads'); }
        catch(e){}
        version = require('./version.js').version;
    }
}
define(['/util/date.js', '/util/util.js', '/util/sprintf.js',
    '/util/rate_limit.js', '/util/escape.js'],
    function(date, zutil, sprintf, rate_limit, zescape){
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
    catch(e){ return '[circular]'; }
};

E.is = function(level){ return level<=E.level; };
['debug', 'info', 'notice', 'warn', 'err'].forEach(function(l){
    var level = L[l.toUpperCase()];
    E.is[l] = function(){ return level<=E.level; };
});

/* perr is a stub overridden by upper layers */
E.perr = function(id, info, opt){
    E._zerr(!opt || opt.level===undefined ? L.ERR : opt.level,
        ['perr '+id+' '+E.json(info)]);
    if (perr_pending && perr_pending.length<100)
        perr_pending.push(Array.from(arguments));
};
var perr_hooks = [];
E.add_perr_hook = perr_hooks.push.bind(perr_hooks);
var perr_dropped = {};
var perr_orig = E.perr;
function wrap_perr(perr_fn){
    var send = perr_fn, pre_send;
    if (typeof perr_fn!='function')
    {
        send = perr_fn.send;
        pre_send = perr_fn.pre_send;
    }
    return function new_perr(id, info, opt){
        opt = opt||{};
        if (!/^[a-zA-Z0-9_.]+$/.test(id))
        {
            var perr_id = 'invalid_zerr_perr_id';
            var perr_info = {arguments: arguments, trace: E.get_stack_trace()};
            if (env.NODE_ENV=='production')
            {
                var zcounter_file = require('./zcounter_file.js');
                zcounter_file.inc(perr_id);
                perr_info.server = env.SERVER_ID;
            }
            return new_perr(perr_id, perr_info, {rate_limit: false});
        }
        var _rate_limit = opt.rate_limit||{};
        var default_rate_limit = zutil.is_mocha() ? 100 : 10;
        var ms = _rate_limit.ms||date.ms.HOUR;
        var count = _rate_limit.count||default_rate_limit;
        var disable_drop_count = _rate_limit.disable_drop_count;
        var rl_hash = perr_orig.rl_hash = perr_orig.rl_hash||{};
        var rl = rl_hash[id] = rl_hash[id]||{};
        if (pre_send)
            pre_send(id, info, opt);
        perr_hooks.filter(function(h){ return h.ids.test(id); })
        .forEach(function(h){ h.fn(id, info, opt); });
        if (opt.rate_limit===false || rate_limit(rl, ms, count))
        {
            if (perr_dropped[id])
            {
                if (!disable_drop_count && info && typeof info!='string')
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

E.make_nodejs_perr_install_fn = function(prefix){
    var zos = require('os');
    var wget = require('./wget.js');
    var zversion = require('./version.js');
    var perr_send = function(id, info, opt){
        opt = opt||{};
        var full_id = prefix+'_'+id;
        return wget({url: env.PERR_URL+'perr?id='+full_id,
            method: 'POST', timeout: 10000,
            json: {
                timestamp: date.to_sql(),
                info: info,
                filehead: opt.filehead,
                bt: opt.backtrace,
                host: zos.hostname(),
                ver: zversion.version,
            },
        });
    };
    return function(_perr_orig, pending){
        while (pending.length)
            perr_send.apply(null, pending.shift());
        return function(id, info, opt){
            _perr_orig.apply(null, arguments); // keep stub's print
            return perr_send(id, info, opt);
        };
    };
};

function err_has_stack(err){ return err instanceof Error && err.stack; }

E.e2s = function(err){
    var str;
    if (!is_node && err_has_stack(err))
    {
        var e_str = ''+err, e_stack = ''+err.stack;
        str = e_stack.startsWith(e_str) ? e_stack : e_str+' '+e_stack;
    }
    else
        str = err_has_stack(err) ? ''+err.stack : ''+err;
    if (err && err.code)
        str = '[code='+err.code+'] '+str;
    return str;
};

E.s2e = function(str){
    if (!str)
        return;
    var code_match = /^\[code=([^\]]*)\] /.exec(str);
    if (code_match)
        str = str.substr(code_match.index+code_match[0].length);
    if (!str.startsWith('Error:'))
        str = 'Error: '+str;
    var message = (/^Error: (.*)/.exec(str)||[])[1]||'';
    var err = new Error();
    err.message = message;
    err.stack = str;
    if (code_match)
        err.code = code_match[1];
    if (/^\d+$/.test(err.code))
        err.code = +err.code;
    return err;
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

E.get_stack_trace = function(opt){
    if (!opt)
        opt = {};
    if (opt.limit===undefined)
        opt.limit = Infinity;
    if (opt.short===undefined)
        opt.short = true;
    var old_stack_limit = Error.stackTraceLimit;
    if (opt.limit)
        Error.stackTraceLimit = opt.limit;
    var stack = zerr.e2s(new Error());
    if (opt.limit)
        Error.stackTraceLimit = old_stack_limit;
    if (opt.short)
    {
        stack = stack
            .replace(/^.+util\/etask.+$/gm, '    ...')
            .replace(/( {4}\.\.\.\n)+/g, '    ...\n');
    }
    return stack;
};

E.log = [];
E.log.max_size = 200;
E.log_tail = function(size){
    return (E.log||[]).join('\n').substr(-(size||4096)); };

function log_tail_push(msg){
    E.log.push(msg);
    if (E.log.length>E.log.max_size)
        E.log.splice(0, E.log.length - E.log.max_size/2);
}

var zerr_format = function(args){
    return args.length<=1 ? args[0] : sprintf.apply(null, args); };

if (is_node)
{ // zerr-node
E.ZEXIT_LOG_DIR = env.ZEXIT_LOG_DIR||'/tmp/zexit_logs';
E.prefix = '';

E.level = L.NOTICE;

var flush_timer;
E.flush = function(){};
E.set_log_buffer = function(on){
    if (!on)
    {
        if (!E.log_buffer)
            return;
        E.flush();
        write_log = E.log_buffer.destroy();
        E.flush = function(){};
        clearInterval(flush_timer);
        return;
    }
    E.log_buffer = Log_buffer();
    write_log = E.log_buffer(write_log, 32*1024);
    E.flush = function log_buffer_flush(){ E.log_buffer.flush(); };
    flush_timer = setInterval(E.flush, 1000).unref();
};

var Log_buffer = function(){
    var orig_func;
    var size = 0;
    var buf = [];
    var instance = function log_patch(func, limit){
        orig_func = func;
        process.on('exit', instance.flush);
        return function log_write(string){
            size += Buffer.byteLength(string);
            buf.push(string);
            if (size > limit)
                instance.flush();
        };
    };
    instance.flush = function log_flush(){
        if (size)
            orig_func(buf.join('\n'));
        buf.length = 0;
        size = 0;
    };
    instance.destroy = function log_destroy(){
        process.off('exit', instance.flush);
        buf.length = 0;
        size = 0;
        return orig_func;
    };
    return instance;
};

var node_init = function(){
    if (zutil.is_mocha())
    {
        E.level = L.WARN;
        return;
    }
    E.prefix = (!cluster.isMaster ? 'C'+cluster.worker.id+' ' : '')
    +(!worker_threads.isMainThread ? 'T'+worker_threads.threadId+' ': '');
};

var init = function(){
    if (is_node)
        node_init();
    E.set_level();
};
init();

var systemd_level_dict = [];
for (var slk in L)
    systemd_level_dict[L[slk]] = '<'+L[slk]+'>';
var systemd_level = env.CURRENT_SYSTEMD_UNIT_NAME
    ? function(level){ return systemd_level_dict[level]; }
    : function(level){ return ''; };

var level_prefix = [];
for (var lpk in L)
    level_prefix[L[lpk]] = lpk+': ';

var __zerr = function(level, args){
    var msg = zerr_format(args);
    var ts = E.hide_timestamp ? '' : date.to_sql_ms()+' ';
    var res = systemd_level(level)+E.prefix+ts+level_prefix[level]+msg;
    write_log(res);
    log_tail_push(res);
};

// simplified nodejs console.error
// https://github.com/nodejs/node/blob/5fad0b93667ffc6e4def52996b9529ac99b26319/lib/internal/console/constructor.js#L381
var write_log = function(string){
    // There may be an error occurring synchronously (e.g. for files or TTYs
    // on POSIX systems) or asynchronously (e.g. pipes on POSIX systems), so
    // handle both situations.
    try {
        // Add and later remove a noop error handler to catch synchronous
        // errors.
        if (process.stderr.listenerCount('error') === 0)
            process.stderr.once('error', noop);
        process.stderr.write(string+'\n', stderr_error_handler);
    } catch(e){
        // Console is a debugging utility, so it swallowing errors is not
        // desirable even in edge cases such as low stack space.
        if (is_stack_overflow_error(e))
            throw e;
        // Sorry, there's no proper way to pass along the error here.
    } finally {
        process.stderr.removeListener('error', noop);
    }
};
// Make a function that can serve as the callback passed to `stream.write()`.
var stderr_error_handler = function(err){
    // This conditional evaluates to true if and only if there was an error
    // that was not already emitted (which happens when the _write callback
    // is invoked asynchronously).
    if (err !== null && !process.stderr._writableState.errorEmitted)
    {
        // If there was an error, it will be emitted on `stream` as
        // an `error` event. Adding a `once` listener will keep that error
        // from becoming an uncaught exception, but since the handler is
        // removed after the event, non-console.* writes won't be affected.
        // we are only adding noop if there is no one else listening for
        // 'error'
        if (process.stderr.listenerCount('error') === 0)
            process.stderr.once('error', noop);
    }
};
var max_stack_error_name;
var max_stack_error_message;
try {
    var overflow_stack = function(){ overflow_stack(); };
    overflow_stack();
} catch(e){
    max_stack_error_name = e.name;
    max_stack_error_message = e.message;
}
// Returns true if `err.name` and `err.message` are equal to engine-specific
// values indicating max call stack size has been exceeded.
// "Maximum call stack size exceeded" in V8.
var is_stack_overflow_error = function(err){
    return err && err.name === max_stack_error_name &&
        err.message === max_stack_error_message;
};
var noop = function(){};

E.set_logger = function(logger){
    __zerr = function(level, args){
        var msg = zerr_format(args);
        logger(level, msg);
        log_tail_push(E.prefix+date.to_sql_ms()+': '+msg);
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
    // this prevents logs from being truncated when the process exits, which
    // might cause us to lose crash stack traces
    // https://github.com/nodejs/node/issues/6379
    [process.stdout, process.stderr].forEach(function(s){
        if (s && s._handle && s._handle.setBlocking)
            s._handle.setBlocking(true);
    });
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
    }
    if ((args&&args.code)!='ERR_ASSERTION')
        console.error('zerr.zexit was called', new Error().stack);
    E.flush();
    // workaround for process.zon override issue
    if (process.zon && process.zon.main)
    {
        // XXX: expose constants via zutil module
        var LCRIT = 2;
        var LCONSOLE = 0x100;
        var emb_zutil = process.binding('zutil');
        emb_zutil.zerr(LCRIT|LCONSOLE, 'perr node_zexit '+E.e2s(args));
        process.exit(1);
    }
    if (env.NODE_ENV=='production')
    {
        var zcounter_file = require('./zcounter_file.js');
        var conf = require('./conf.js');
        zcounter_file.inc('server_zexit');
        args = zerr_format(arguments);
        write_zexit_log({id: 'lerr_server_zexit', info: ''+args,
            ts: date.to_sql(), backtrace: stack, version: version,
            app: conf.app});
        E.flush();
    }
    /*jslint -W087*/
    debugger;
    process.exit(1);
};

var write_zexit_log = function(json){
    try {
        var file = require('./file.js');
        file.mkdirp(E.ZEXIT_LOG_DIR);
        file.write_atomic_e(E.ZEXIT_LOG_DIR+'/'+date.to_log_file()+'_zexit_'+
            process.pid+'.log', E.json(json));
    } catch(e){ E.zerr(E.e2s(e)); }
};
}
else
{ // browser-zerr
var chrome;
E.log = [];
var L_STR = E.L_STR = ['EMERGENCY', 'ALERT', 'CRITICAL', 'ERROR', 'WARNING',
    'NOTICE', 'INFO', 'DEBUG'];
E.log.max_size = 200;
if (is_rn)
{
    E.level = L.WARN;
    // logcat has timestamp by default
    E.hide_timestamp = true;
}
else
{
    chrome = self.chrome;
    E.conf = self.conf;
    E.level = self.is_tpopup ? L.CRITICAL : E.conf && E.conf.zerr_level ?
        L[self.conf.zerr_level] : L.WARN;
}

var console_method = function(l){
    // XXX arik HACK: in react-native, console.error/console.warn print full
    // backtrace. this is very slow. as a quick hack we just use log/info/debug
    // need to check how to configure react-native not to print backtrace
    if (is_rn)
        return l<=L.NOTICE ? 'log' : l<=L.INFO ? 'info' : 'debug';
    return l<=L.ERR ? 'error' : !chrome ? 'log' : l===L.WARN ? 'warn' :
        l<=L.INFO ? 'info' : 'debug';
};

var logger_fn;

_zerr = function(l, args){
    var s;
    try {
        var fmt = ''+args[0];
        var fmt_args = Array.prototype.slice.call(args, 1);
        /* XXX arik/bahaa HACK: use sprintf (note, console % options are
         * differnt than sprintf % options) */
        s = (fmt+(fmt_args.length ? ' '+E.json(fmt_args) : ''))
        .substr(0, 1024);
        var prefix = (E.hide_timestamp ? '' : date.to_sql_ms()+' ')
        +L_STR[l]+': ';
        if (E.is(l))
        {
            Function.prototype.apply.bind(console[console_method(l)],
                console)([prefix+fmt].concat(fmt_args));
            if (logger_fn)
                logger_fn(l, zerr_format(args));
        }
        log_tail_push(prefix+s);
    } catch(err){
        try { console.error('ERROR in zerr '+(err.stack||err), arguments); }
        catch(e){}
    }
    if (l<=L.CRIT)
        throw new Error(s);
};
E._zerr = _zerr;

E.set_logger = function(logger){
    logger_fn = logger;
};

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
    return req;
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

var perr = function(_perr_orig, pending){
    while (pending.length)
        perr_transport.apply(null, pending.shift());
    // set the zerr.perr stub to send to the clog server
    return perr_transport;
};
E.perr_install(perr);

} // end of browser-zerr}

return E; }); }());
