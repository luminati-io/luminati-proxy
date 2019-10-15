// LICENSE_CODE ZON
'use strict'; /*jslint node:true*/
require('./config.js');
const file = require('./file.js');
const exec = require('./exec.js');
const etask = require('./etask.js');
const string = require('./string.js');
const path = require('path');
const E = exports;
const env = process.env, assign = Object.assign;

function local_jdir_one(top){
    const repo = '/CVS/Repository', cvs = '/CVS';
    let root, inbin, rel = '', _rel, ret = {};
    top = file.normalize(top||process.cwd());
    let t = file.cyg2unix('/');
    let re = new RegExp(`^(${t}.*)\/([^\/]*)$`);
    for (let i=0; i<24 && top!==t; i++)
    {
        let up_top = top;
        let up_rel, res;
        if (!(res = up_top.match(re)))
            break;
        up_top = res[1];
        up_rel = `/${res[2]}${rel}`;
        if (file.read_line(up_top+repo)==='zon' && !file.is_dir(top+cvs))
        {
            root = up_top;
            inbin = 1;
            break;
        }
        else if (file.read_line(top+repo)==='zon')
        {
            root = top;
            break;
        }
        top = up_top;
        rel = up_rel;
    }
    if (!root)
        return null;
    _rel = rel[0]==='/' ? rel.substr(1) : rel;
    if (env.BUILD)
    {
        let bin = `${root}/build.${env.BUILD}`;
        assign(ret, {bin: bin+rel, binroot: bin,
            flip: inbin ? root+rel : bin+rel});
    }
    assign(ret, {root: root, src: root+rel, rel: _rel||'.'});
    return ret;
}

E.get_builds = root=>{
    let ret = [], re = /^(\.makeflags|build)\.(.*)/, parts;
    file.readdir_e(root).forEach(elem=>{
        if ((parts = re.exec(elem)) && !ret.includes(parts[2]))
            ret.unshift(parts[2]);
    });
    return ret.sort();
};

E.build_makeflags = (root, build)=>{
    let makeflags = file.read(`${root}/.makeflags.${build}`);
    if (!makeflags)
    {
        makeflags = file.read(`${root}/build.${build}/makeflags`);
        if (makeflags)
            file.write_e(`${root}/.makeflags.${build}`, makeflags);
    }
    return makeflags||'';
};

E.local_jdir = (top, opt)=>{
    opt = opt||{};
    let jdir = local_jdir_one(top);
    if (!jdir && opt.fallback_to_env)
        jdir = local_jdir_one(env.PROJECT_PATH);
    return jdir;
};

E.use_zon = script=>{
    // allow loading as module
    if (module.parent.parent)
        return E;
    let filename = require.main.filename;
    let args = process.argv.slice(2);
    // Will zexit or success
    E.exec_in_zon_tree(filename, script, args,
        {sync: true, fallback_to_env: true, ignore_build: true});
    return E;
};

E.exec_in_zon_tree = (filename, exe_in_tree, args, opt)=>{
    let file_dir = file.win2unix(path.dirname(path.resolve(filename)));
    let jdir = E.local_jdir(null, {fallback_to_env: opt.fallback_to_env});
    if (!jdir)
    {
        if (!opt.notree)
            E.zexit(filename+' must be run from within a zon tree');
        return;
    }
    let root = opt.bin ? jdir.binroot : jdir.root;
    // It is local script if root in file path
    if (file.is_subdir(root, file_dir))
        return;
    let child_env;
    if (!env.BUILD)
    {
        if (opt.ignore_build)
            child_env = assign({ZON_CONFIG_FALLBACK: 1}, env);
        else
        {
            if (!opt.notree)
                E.zexit('no $BUILD selected');
            return;
        }
    }
    let exe = `${root}/${exe_in_tree}`;
    let cmd = [exe, ...args];
    // XXX pavelp: don't try to execute .js files directly (windows only)
    if (file.is_win && /.js$/.test(exe))
        cmd.unshift(process.argv[0]);
    if (opt.sync&&exec.sys_sync)
    {
        let ret = exec.sys_sync(cmd, {
            opt: {stdio: 'inherit', cwd: opt.cwd, env: child_env},
            node: opt.node, node_args: opt.node_args, out: 'ret'});
        if (!opt.noexit)
            process.exit(ret.retval||ret.unix);
        return ret;
    }
    return etask(function*(){
        this.on('uncaught',
            ()=>E.zexit(`Error in ${exe} execution: ${this.error}`));
        const ret = yield exec.sys(cmd, {opt: {env: child_env},
            cwd: opt.cwd, node: opt.node,
            node_args: opt.node_args, out: 'ret'
        });
        if (opt.noexit)
            return ret;
        if (ret.retval||ret.unix)
        {
            E.zexit(`Failed running ${exe} code: ${ret.retval} signal `+
                `${ret.signal}`);
        }
        process.exit(0);
    });
};

E.zon_root = product=>{
    const zon_dir = file.normalize(product ? `${env.HOME}/.zon.${product}` :
        env.PROJECT_PATH||`${env.HOME}/.zon`);
    if (!zon_dir)
        E.zexit('PROJECT_PATH environment variable is not set');
    if (!file.exists(zon_dir))
    {
        console.error(`checking out zon to ${zon_dir}`);
        let _env;
        if (product)
        {
            const domain = product=='lum' ? 'luminati.io' :
                product=='spark' ? 'holaspark.com' : 'hola.org';
            _env = {CVSROOT: `:pserver:${env.USER}@cvs.${domain}:/arch/cvs`};
        }
        const res = exec.sys_sync(
            ['cvs', '-q', 'co', '-d', path.basename(zon_dir), 'zon'],
            {opt: {cwd: path.dirname(zon_dir), env: _env}});
        if (res.retval)
            E.zexit(`cvs co returned error:\n${res.stdall}`);
        console.error(string.align`
            *****************************************************
            ATTENTION: now the default directory moved to ~/.zon
            you MUST restart all terminals to update environment`);
    }
    else if (!file.is_dir(`${zon_dir}/CVS`))
    {
        E.zexit(`${zon_dir} exists, but there is no CVS directory`
            +' inside. please remove it and run again');
    }
    return zon_dir;
};

E.split_debug_flags = opt=>{
    let args = [], node_args = [];
    let s;
    opt = opt||{};
    for (s = 1; process.argv[s].startsWith('-'); s++);
    process.argv.slice(s+1).forEach(a=>{
        let f = a.split('=')[0];
        if (opt[f])
            args.push(opt[f]);
        switch (f)
        {
        case '-d':
            node_args.push('--debug');
            break;
        case 'debug':
        case '--debug':
        case '--debug-brk':
            node_args.push(a);
            break;
        case '--gc':
        case '--expose-gc':
            node_args.push('--expose-gc');
            break;
        case '--gc-global':
        case '--es_staging':
        case '--no-deprecation':
        case '--prof':
        case '--throw-deprecation':
        case '--trace-deprecation':
        case '--allow-natives-syntax':
        case '--expose-internals':
        case '--inspect':
        case '--inspect-brk':
            node_args.push(a);
            break;
        default:
            if (a.startsWith('--harmony'))
                node_args.push(a);
            else if (a.startsWith('--trace'))
                node_args.push(a);
            else if (a.startsWith('--max-old-space-size'))
                node_args.push(a);
            else if (a.startsWith('--inspect-addr'))
                node_args.push(a);
            else
                args.push(a);
            break;
        }
    });
    return {args, node_args};
};

E.zexit = msg=>{
    console.error(msg);
    process.exit(1);
};
