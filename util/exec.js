// LICENSE_CODE ZON
'use strict'; /*jslint node:true*/
require('./config.js');
const child_process = require('child_process');
const fs = require('fs');
const etask = require('./etask.js');
const file = require('./file.js');
const string = require('./string.js');
const array = require('./array.js');
const E = exports;
const assign = Object.assign;

E.process_opt = opt=>{
    opt = assign({}, opt);
    if (opt.out=='stdall')
        opt.stdall = true;
    if (opt.stdall)
        opt.stdout = opt.stderr = true;
    if (!opt.out && (opt.stdout || opt.stderr))
        opt.out = 'obj';
    if (!opt.out)
        opt.out = 'unix';
    if (opt.out=='stdout')
        opt.stdout = true;
    if (opt.out=='stderr')
        opt.stderr = true;
    // XXX sergey: must use pipes only on required ios
    if (opt.stdin || opt.stdout || opt.stderr)
        opt.piped = true;
    if (opt.cmd_shell)
        opt.opt = assign({shell: true}, opt.opt);
    return opt;
};
E.get_cmd = (cmd, opt)=>{
    let args = array.copy(array.to_array(cmd));
    // XXX vladimir: rm process.zon from hutil
    if (opt.node && process.zon && process.zon.main)
        throw new Error('Unable to spawn node process from embedded Node');
    let command = opt.cmd_shell ? `"${args.shift()}"` :
        opt.shell ? '/bin/bash' : opt.node ? process.argv[0] : args.shift();
    command = file.normalize(command);
    if (opt.cmd_shell)
        args = args.map(a=>`"${a}"`);
    else if (opt.shell)
        args = ['-c', args.join(' ')];
    else if (opt.node&&args.length)
        args[0] = file.normalize(args[0]);
    if (opt.node&&opt.node_args)
        args.unshift(...opt.node_args);
    return {cmd: command, argv: args};
};
E.get_env = opt=>{
    if (!opt.opt||!opt.opt.env)
    {
        if (!opt.opt||!opt.opt.remove_env)
            return process.env;
        let cur_env = {};
        for (let k of Object.keys(process.env)
            .filter(r=>!opt.opt.remove_env.includes(r)))
        {
            cur_env[k] = process.env[k];
        }
        return cur_env;
    }
    if (!opt.node)
        return opt.opt.env;
    let nave_env = {};
    string.qw`NAVEPATH NAVEBIN NAVELIB NAVEVERSION NAVENAME NAVE_DIR NAVE
        npm_config_binroot npm_config_root npm_config_manroot
        npm_config_prefix NODE_MODULES NODE_PATH`.forEach(v=>{
        nave_env[v] = process.env[v]; });
    return assign(nave_env, opt.opt.env);
};
E.get_redir = (input, piped, ipc)=>{
    let redir_modes = {'<': 'r', '>': 'w', '>>': 'a'};
    let outputs = [0, 1, 2], fds = [];
    input = input||'';
    if (piped)
        input = '0</dev/pipe 1>/dev/pipe 2>/dev/pipe '+input;
    let redirs = string.qw(input), match;
    for (let r=0; r<redirs.length; r++)
    {
        if (!(match = /^(\d*)(<|>|>>)(&(\d+)|[^>&].*)$/.exec(redirs[r])))
            throw new Error('Invalid redirection '+redirs[r]);
        let src, dst;
        src = match[1] ? +match[1] : match[2]=='<' ? 0 : 1;
        if (match[4]) // to fd
        {
            dst = +match[4];
            if (dst in outputs)
                dst = outputs[dst];
        }
        else // to file
        {
            dst = match[3];
            if (/^\/dev\/pipe$/.test(dst))
                dst += src; // remember src fd
            if (!/^\/dev\/(null|pipe)/.test(dst)) // real file
                fds.push(dst = fs.openSync(dst, redir_modes[match[2]]));
        }
        outputs[src] = dst;
    }
    let pipes = {};
    for (let i=0; i<outputs.length; i++)
    {
        let o = outputs[i], m;
        if (o=='/dev/null')
            o = 'ignore';
        else if (m = /^\/dev\/pipe(\d)$/.exec(o))
        {
            o = 'pipe';
            if (+m[1]!=i)
                pipes[i] = +m[1];
        }
        outputs[i] = o;
    }
    if (ipc)
        outputs.push('ipc');
    return {stdio: outputs, pipes: pipes, fds: fds};
};
E.get_redir_sync = (redir, stdio)=>{
    if (redir)
        return E.get_redir(redir);
    return {stdio: stdio||'pipe', fds: []};
};
function unshift_pipe(stdio, data){
    // XXX sergey: find out what causes stream to close
    if (stdio && !stdio._readableState.ended)
        stdio.unshift(data);
}
function handle_stdio(child, redir, logger){
    let io_names = ['stdin', 'stdout', 'stderr'];
    if (!child || !child.stdio)
        return;
    child.stdio.forEach((stdio, i)=>{
        if (i<1||!stdio)
           return;
        let method = !(i in redir) ? data=>logger(io_names[i], data) :
            data=>unshift_pipe(child.stdio[redir[i]], data);
        stdio.on('data', method);
    });
}
function close_fds(child, fds){
    fds.forEach(fs.closeSync);
    if (!child || !child.stdio)
        return;
    child.stdio.forEach(stdio=>stdio && stdio.destroy());
}

// XXX vladimir: check about platforms other than x86/arm from signal(7)
const sigstring_int = {
    // posix.1-1990
    SIGHUP: 1,
    SIGINT: 2,
    SIGQUIT: 3,
    SIGILL: 4,
    SIGABRT: 6,
    SIGFPE: 8,
    SIGKILL: 9,
    SIGSEGV: 11,
    SIGPIPE: 13,
    SIGALRM: 14,
    SIGTERM: 15,
    SIGUSR1: 10,
    SIGUSR2: 12,
    SIGCHLD: 17,
    SIGCONT: 18,
    SIGSTOP: 19,
    SIGTSTP: 20,
    SIGTTIN: 21,
    SIGTTOU: 22,
    // posix.1-2001
    SIGBUS: 7,
    SIGPOLL: 29,
    SIGPROF: 27,
    SIGSYS: 31,
    SIGTRAP: 5,
    SIGURG: 23,
    SIGVTALRM: 26,
    SIGXCPU: 24,
    SIGXFSZ: 25,
    // various
    SIGIOT: 6,
    SIGSTKFLT: 16,
    SIGIO: 29,
    SIGPWR: 30,
    SIGINFO: 30,
    SIGWINCH: 28,
    SIGUNUSED: 31,
};
E.sys = (cmd, opt)=>etask(function*exec(){
    opt = E.process_opt(opt||{});
    // XXX vladimir: rm process.zon from hutil
    if (opt.fork && process.zon && process.zon.main)
        throw new Error('Unable to spawn node process from embedded Node');
    cmd = E.get_cmd(cmd, opt);
    let status = {signal: 0, code: 0};
    let log = {stdout: '', stderr: '', stdall: ''};
    let kill_signal = opt.kill_signal||'SIGINT';
    let child;
    let redir_str = opt.redir||'';
    this.info.cmd = ()=>cmd.cmd+' '+cmd.argv.join(' ')+redir_str;
    if (opt.verbose)
        console.log(cmd.cmd, cmd.argv.join(' '), redir_str);
    let redir = E.get_redir(redir_str, opt.piped, opt.fork);
    let opts = assign({stdio: redir.stdio, cwd: opt.cwd}, opt.opt);
    this.finally(()=>{
        close_fds(child, redir.fds);
        if (child && !child.killed && child.exitCode===null)
            child.kill(kill_signal);
    });
    let error;
    let on_error = err=>{
        error = err;
        this.continue();
    };
    // To kill children of process it needed to be run in detached state
    if (opt.timeout||opt.detached)
        opts.detached = true;
    opts.env = E.get_env(opt);
    if (opt.fork)
        child = child_process.fork(cmd.cmd, cmd.argv, opts);
    else
        child = child_process.spawn(cmd.cmd, cmd.argv, opts);
    child.on('error', on_error);
    child.on('close', (code, signal)=>{
        status.code = code;
        status.signal = signal;
        this.continue();
    });
    if (opt.on_msg)
        child.on('message', msg=>opt.on_msg(child, msg));
    if (opt.on_disc)
        child.on('disconnect', msg=>opt.on_disc(child));
    if (opt.timeout||opt.detached)
        this.child_process = child;
    // Process stdio redirection
    let logger = (name, data)=>{
        if (opt.log)
        {
            opt.log(data, name);
            if (opt.no_buf)
                return;
        }
        if (opt[name])
            log[name] += data;
        if (opt.stdall)
            log.stdall += data;
    };
    handle_stdio(child, redir.pipes, logger);
    if (opt.stdin&&child.stdio[0])
    {
        child.stdio[0].end(opt.stdin);
        child.stdio[0].once('error', on_error);
    }
    if (opt.timeout)
        this.alarm(opt.timeout, on_error.bind(null, 'timeout'));
    yield this.wait();
    if (error==='timeout' && !child.killed)
        process.kill(-child.pid);
    let rv = error ? -1 : status.code;
    let ret = {stdout: log.stdout, stderr: log.stderr, stdall: log.stdall,
        signal: status.signal, retval: rv&0xff, error: error,
        status_code: status.code};
    ret.unix = error ? -257 :
        ret.signal ? -(sigstring_int[ret.signal]||258) : ret.retval;
    return opt.out=='retval' ? ret.retval :
        opt.out=='unix' ? ret.unix :
        opt.out=='stdout' ? ret.stdout :
        opt.out=='stderr' ? ret.stderr :
        opt.out=='stdall' ? ret.stdall :
        ret;
});

E.sys_sync = (cmd, opt)=>{
    opt = E.process_opt(opt||{});
    cmd = E.get_cmd(cmd, opt);
    if (opt.verbose)
        console.log(cmd.cmd, cmd.argv.join(' '));
    let redir = E.get_redir_sync(opt.redir, opt.stdio);
    let opts = assign({stdio: redir.stdio, cwd: opt.cwd}, opt.opt);
    opts.env = E.get_env(opt);
    let child = child_process.spawnSync(cmd.cmd, cmd.argv, opts);
    close_fds(null, redir.fds);
    let rv = child.error ? -1 : child.status;
    // XXX sergey: stdall must be mixed, not concatinated
    let stdout = (child.stdout||'').toString();
    let stderr = (child.stderr||'').toString();
    let ret = {stdout: stdout, stderr: stderr, stdall: stdout+stderr,
        signal: child.signal, retval: rv&0xff, error: child.error,
        status_code: child.status};
    ret.unix = ret.error ? -257 :
        ret.signal ? -(sigstring_int[ret.signal]||258) : ret.retval;
    return opt.out=='retval' ? ret.retval :
        opt.out=='unix' ? ret.unix :
        opt.out=='stdout' ? stdout :
        opt.out=='stderr' ? stderr :
        opt.out=='stdall' ? stdout+stderr :
        ret;
};

let which_cache = {};
E.which = bin=>{
    let cache = which_cache;
    if (bin in cache && file.is_exec(cache[bin]))
        return cache[bin];
    let ret = file.which(bin)||'';
    let sys_opts = {out: 'stdout'};
    if (ret&&file.is_win)
        ret = string.chomp(E.sys_sync(['cygpath', '-w', ret], sys_opts));
    if (ret&&file.is_win&&file.is_symlink(ret))
        ret = fs.readlinkSync(ret);
    cache[bin] = ret;
    return ret;
};

E.get = (cmd, opt)=>{
    opt = assign(Array.isArray(cmd) ? {} :
        {shell: true, stdio: 'inherit'}, opt);
    if (opt.dry_run)
    {
        if (opt.verbose)
            console.log(array.to_array(cmd).join(' '));
        return;
    }
    return E.sys_sync(cmd, opt);
};
E.get_lines = (cmd, opt)=>{
    let ret = E.get(cmd, assign({out: 'stdout', stdio: 'pipe'}, opt));
    return string.split_crlf(ret);
};
E.get_line = (cmd, opt)=>E.get_lines(cmd, opt)[0];
