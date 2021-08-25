// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true*/
require('./config.js');
const file = require('./file.js');
const exec = require('./exec.js');
const zerr = require('./zerr.js');
const zutil = require('./util.js');
const array = require('./array.js');
const string = require('./string.js');
const sprintf = require('./sprintf.js');
const zescape = require('./escape.js');
const jtools = require('./jtools.js');
const etask = require('./etask.js');
const assign = Object.assign, ef = etask.ef;
const E = exports;
E.dry_run = false;
E.opt = {};
const L = E.L = {
    require: function(name, lib){
        this.__defineGetter__(name, function(){
            delete this[name];
            return this[name] = require(lib);
        });
    }
};
L.require('readline', 'readline-sync');
L.require('getopt', 'node-getopt');

function find_opt(arg, argv){
    for (let a=0; a<argv.length; a++)
    {
        if (argv[a][0]==arg||argv[a][1]==arg)
            return a;
    }
    return -1;
}

function cmdpp(commands){
    if (!commands)
        return '';
    let maxlen = commands.reduce(function(n, cmd){
        return Math.max(n, cmd[0].length); }, 0);
    let dc = E.default_command ? `\n default: ${E.default_command}\n` : '';
    return commands.reduce((s, cmd)=>{
        return sprintf(`${s} %-${maxlen}s  ${cmd[1]}\n`, cmd[0]);
    }, 'Commands:\n')+dc;
}

function guess_dryrun(args){
    let dry = find_opt('dry-run', args)>=0;
    let real = find_opt('real-run', args)>=0;
    if (!dry&&!real)
        return E.dry_run = false;
    // Set dry-run mode if real-run or dry-run options requested
    E.dry_run = true;
    if (!dry)
        args.push(['', 'dry-run', 'emulate commands run']);
    if (!real)
        args.push(['', 'real-run', 'actually run commands']);
}

E.getopt = function(args, usage, commands, lock_key){
    if (global.zcli_getopt_lock_key && global.zcli_getopt_lock_key!=lock_key)
        return;
    if (find_opt('h', args)<0)
        args.push(['h', 'help', 'show usage']);
    if (find_opt('v', args)<0)
        args.push(['v', 'verbose+', 'verbose output (-vv* to control level)']);
    guess_dryrun(args);
    if (commands)
    {
        E.commands = {};
        commands.forEach(cmd=>{
            E.commands[cmd[0].split(' ')[0]] = null;
            if (cmd[2])
                E.default_command = cmd[0];
        });
    }
    E._getopt = L.getopt.create(args).setHelp(
        usage.replace('[[COMMANDS]]', cmdpp(commands)));
};

// Do not process args immediatly, but store it
let p_modules = {};
E.getopt_p = function(module, args, usage, commands){
    p_modules[module.filename] = ()=>E.getopt(args, usage, commands); };

E.exit = function(msg, code){
    code = code===undefined ? 1 : code;
    if (msg)
    {
        if (!code)
            console.log(msg);
        else
            zerr.err(msg);
    }
    process.exit(code);
};
E.usage = function(msg){
    E._getopt.showHelp();
    E.exit(msg);
};
E.verbose = function(msg){
    if (E.opt.verbose)
        console.log(msg);
};
let get_exec_opt = opt=>
    assign({verbose: E.opt.verbose, dry_run: E.dry_run}, opt);
E.exec_sys = (cmd, opt)=>exec.sys(cmd, get_exec_opt(opt));
E.exec = (cmd, opt)=>exec.get(cmd, get_exec_opt(opt));
E.exec_get_lines = cmd=>exec.get_lines(cmd, get_exec_opt());
E.exec_get_line = cmd=>exec.get_line(cmd, get_exec_opt());
E.exec_e = function(cmd, opt){
    let ret;
    if (ret = E.exec(cmd, opt))
        throw new Error("exec_e('"+cmd+"') exits with code "+ret);
};
E.geteuid = function(){
    if (process.geteuid)
        return process.geteuid();
    let filename = '/proc/self/status';
    let status = file.is_win ?
        exec.sys_sync(['cat', filename], {out: 'stdout'}).split('\n') :
        file.read_lines(filename)||[];
    let euid = array.grep(status, /^Uid:\s*\d+\s*(\d+).*$/, '$1');
    return euid.length>0 ? +euid[0] : 1000;
};
if (E.geteuid())
{
    E.HAS_RT = !!exec.which('rt');
    E.RT = 'rt';
}
else
    E.HAS_RT = !(E.RT = '');
E.exec_rt = function(cmd, opt){
    if (Array.isArray(cmd))
        cmd = cmd.slice();
    if (!file.is_win && E.RT)
    {
        if (E.HAS_RT)
        {
            if (Array.isArray(cmd))
                cmd.unshift(E.RT);
            else
                cmd = E.RT+' '+cmd;
        }
        else if (process.stdin.isTTY)
        {
            let su_cmd = [];
            if (file.is_darwin)
                su_cmd.push('sudo');
            else
                su_cmd.push('su', 'root', '-c');
            if (Array.isArray(cmd))
                cmd = su_cmd.concat(cmd.join(' '));
            else
            {
                cmd = su_cmd.concat(file.is_darwin ? cmd : zescape.sh(cmd))
                    .join(' ');
            }
        }
        else
        {
            zerr.err("need rt or 'su root' to exec "+cmd);
            return 1;
        }
    }
    return E.exec(cmd, opt);
};
E.exec_rt_e = function(cmd, opt){
    let ret;
    if (ret = E.exec_rt(cmd, opt))
        throw new Error("exec_rt_e('"+cmd+"') exits with code "+ret);
};
E.run_from_tree = function(filename, script, opt){
    let exec_opt = process.argv.slice(2);
    let args = jtools.split_debug_flags(opt);
    if (args.node_args.length)
    {
        opt.node_args = (opt.node_args||[]).concat(args.node_args);
        exec_opt = args.args;
    }
    return jtools.exec_in_zon_tree(filename, script, exec_opt, opt);
};

E.process_commands = function(commands){
    if (!commands||!E.commands)
        return;
    E.command = E.argv.shift()||E.default_command;
    for (let cmd in E.commands)
    {
        if (!(cmd in commands))
            E.usage('Unknown command '+cmd);
        E.commands[cmd] = commands[cmd];
    }
    if (!E.command || !(E.command in E.commands))
        E.usage();
};

E.process_args = function(commands){
    // Execute delayed options
    if (module.parent.filename in p_modules)
        p_modules[module.parent.filename]();
    let options = E.sys_opt = E._getopt.parseSystem();
    let opt = E.opt = {};
    for (let o in options.options)
        opt[o] = opt[o.replace(/-/g, '_')] = options.options[o];
    E.argv = options.argv.slice();
    zerr.hide_timestamp = true;
    if (opt.help)
        E.usage();
    E.process_commands(commands);
    if (opt.verbose)
    {
        // Compact verbose to int value
        let l = opt.verbose = opt.verbose.length;
        // Default is INFO, -vv = CRIT
        zerr.set_level(l==1 ? 'INFO' : zerr.LINV[l]);
    }
    if (E.dry_run)
    {
        if (!zutil.xor(opt.dry_run, opt.real_run))
            E.usage('choose either --dry-run or --real-run');
        E.dry_run = !opt.real_run;
    }
};

E.script_error = name=>{
    function err(msg, opt){
        msg = msg||'';
        this.opt = opt||{};
        this.name = name;
        this.message = msg.message||msg;
        this.stack = msg.stack||(new Error(this)).stack;
        this.output = this.opt.output||'';
    }
    err.prototype = Object.create(Error.prototype);
    err.prototype.constructor = err;
    return err;
};

function flush_stream(stream, cb){ stream.write('', cb); }
function exit_with_code(opt, exit_code){
    if (!opt.drain)
        process.exit(exit_code);
    flush_stream(process.stdout, ()=>
        flush_stream(process.stderr, ()=>process.exit(exit_code)));
}

E.process_exit = (promise, opt)=>etask(function*process_main(){
    opt = opt||{};
    let ret;
    try {
        ret = yield promise;
        for (let et of etask.root)
        {
            if (et!=this)
            {
                et.return();
                yield this.wait_ext(et);
            }
        }
    } catch(e){ ef(e);
        console.error(opt.skip_stack ? e.message : e.stack||e);
        return exit_with_code(opt, 1);
    }
    // XXX vladimir: make use_retval default
    exit_with_code(opt, opt.use_retval ? ret : 0);
});

// get input from user that works also in cygwin
E.get_input = (prompt, opt)=>{
    if (opt!=null && opt.constructor!=Object)
        opt = {hide: opt};
    opt = opt||{};
    let fd = opt.stderr&&'stderr' || 'stdout';
    let hide_cmd = opt.hide ? '-s' : '';
    if (zerr.log_buffer)
        zerr.flush();
    process[fd].write(prompt+' ', ()=>{});
    let res = E.exec('read '+hide_cmd+' param && echo $param',
        {out: 'stdout', stdio: [0, 'pipe'], dry_run: false});
    if (opt.hide)
        process[fd].write('\n');
    return string.chomp(res);
};

// prompt user for approval, using cli.get_input
E.ask_approval = (prompt, opt)=>{
    let res;
    opt = opt||{};
    opt.limit = opt.limit||/^(?:y|n|yes|no)$/i;
    if (E.opt.quiet)
        return true;
    while (!opt.limit.test(res))
    {
        if (!(res = E.get_input(prompt, opt)) && opt.default_input)
        {
            res = opt.default_input;
            break;
        }
    }
    if (opt.return_ans)
        return res;
    return !/^n.*$/i.test(res);
};

E.question = prompt=>L.readline.question(prompt);
E.ask_password = prompt=>
    L.readline.question(prompt, {hideEchoBack: true, mask: ''});

let spinner = {};
E.spinner = status=>{
    spinner.status = status;
    if (!process.stderr.isTTY || spinner.id)
        return;
    let frames = ['\\', '|', '/', '-'], frame = 0;
    spinner.id = setInterval(()=>{
        process.stderr.clearLine();
        process.stderr.write('\r'+frames[frame++]
            +(spinner.status ? ' '+spinner.status : ''));
        frame &= 3;
    }, 250);
};
E.spinner.stop = ()=>{
    if (!process.stderr.isTTY || !spinner.id)
        return;
    clearInterval(spinner.id);
    spinner.id = null;
    process.stderr.clearLine();
    process.stderr.write('\r');
};
