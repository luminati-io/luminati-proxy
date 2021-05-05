// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true*/
const zconf = require('./config.js');
const array = require('./array.js');
const crypto = require('crypto');
const rimraf = require('rimraf');
const path = require('path');
const fs = require('fs');
const StringDecoder = require('string_decoder').StringDecoder;
const E = exports, assign = Object.assign;
// file.xxx_e() throw exceptions. file.xxx() return null/false on fail.
E.errno = 0; // an integer/string error code
// XXX sergey: please implement
E.error = null; // an Error() object
E.read_buf_size = 8192;
E.is_win = /^win/.test(process.platform);
E.is_darwin = /^darwin/.test(process.platform);
E.is_linux = /^linux/.test(process.platform);
E.is_zlinux = E.is_linux && !/ARCH=ANDROID/.test(zconf.CONFIG_MAKEFLAGS);
E.is_android = E.is_linux && !E.is_zlinux;

let check_file = (dst, opt)=>{
    opt = opt||{};
    if (opt.rm_rf)
        E.rm_rf(dst);
    if (opt.mkdirp)
        E.mkdirp_file_e(dst);
    if (opt.unlink)
        E.unlink(dst);
};

let FileError = (msg, code)=>{
    let err = new Error(code+' '+msg);
    err.code = code;
    return err;
};

E.read_e = (filename, opt)=>{
    if (opt===undefined)
        opt = 'utf8';
    return fs.readFileSync(filename, opt);
};
E.fread_cb_e = (fd, pos, cb)=>{
    let res, buf = Buffer.alloc(E.read_buf_size);
    while (res = fs.readSync(fd, buf, 0, buf.length, pos))
    {
        if (cb(buf.slice(0, res), pos))
            return true;
        pos += res;
    }
    return true;
};
E.read_cb_e = (filename, pos, cb)=>{
    let fd = fs.openSync(filename, 'r');
    try { return E.fread_cb_e(fd, pos, cb); }
    finally { fs.closeSync(fd); }
};
E.fread_line_cb_e = (fd, cb, opt)=>{
    opt = assign({encoding: 'utf8', buf_size: E.read_buf_size}, opt);
    cb = cb||(()=>false);
    let read, buf = Buffer.alloc(opt.buf_size);
    let strbuf = '', lf_idx, decoder = new StringDecoder(opt.encoding);
    while (read = fs.readSync(fd, buf, 0, buf.length))
    {
        strbuf += decoder.write(buf.slice(0, read));
        while ((lf_idx = strbuf.indexOf('\n'))>=0)
        {
            if (cb(strbuf.slice(0, lf_idx-(strbuf[lf_idx-1]=='\r' ? 1 : 0))))
                return true;
            strbuf = strbuf.slice(lf_idx+1);
        }
    }
    if (strbuf)
        cb(strbuf);
    return true;
};
E.read_line_cb_e = (filename, cb, opt)=>{
    let fd = fs.openSync(filename, 'r');
    try { return E.fread_line_cb_e(fd, cb, opt); }
    finally { fs.closeSync(fd); }
};
E.read_line_e = filename=>{
    let ret;
    E.read_line_cb_e(filename, line=>(ret = line, true));
    return ret;
};
E.read_lines_e = filename=>{
    let ret = E.read_e(filename).split(/\r?\n/);
    if (ret[ret.length-1]=='')
        ret.pop();
    return ret;
};
E.fread_e = (fd, start, size, opt)=>{
    opt = opt||{};
    let decoder = new StringDecoder(opt.encoding), rest = size;
    let ret = '', append_ret = buf=>ret += decoder.write(buf);
    E.fread_cb_e(fd, start, rest===undefined ? append_ret : buf=>{
        rest -= buf.length;
        if (rest<0)
            buf = buf.slice(0, rest);
        append_ret(buf);
        return rest<=0;
    });
    return ret;
};
E.write_e = (file, data, opt)=>{
    if (typeof data == 'number')
        data = ''+data;
    opt = opt||{};
    check_file(file, opt);
    fs.writeFileSync(file, data, opt);
    return true;
};
E.write_atomic_e = (file, data, opt)=>{
    if (typeof data == 'number')
        data = ''+data;
    opt = opt||{};
    check_file(file, opt);
    let tmpfile = file+'.'+(1000000*Math.random()|0)+'.tmp';
    try {
        fs.writeFileSync(tmpfile, data, opt);
        fs.renameSync(tmpfile, file);
    } catch(e){
        E.unlink(tmpfile);
        throw e;
    }
    return true;
};
E.write_lines_e = (file, data, opt)=>{
    data = Array.isArray(data) ?
        data.length ? data.join('\n')+'\n' : '' : ''+data+'\n';
    return E.write_e(file, data, opt);
};
E.append_e = (file, data, opt)=>{
    if (typeof data == 'number')
        data = ''+data;
    opt = opt||{};
    check_file(file, opt);
    fs.appendFileSync(file, data, opt);
    return true;
};
E.head_e = (file, size)=>{
    if (size<0)
        size = 0;
    let fd = fs.openSync(file, 'r');
    try { return E.fread_e(fd, 0, size); }
    finally { fs.closeSync(fd); }
};
E.tail_e = (file, count)=>{
    let fd, start;
    count = count||E.read_buf_size;
    start = E.size_e(file)-count;
    if (start<0)
        start = 0;
    fd = fs.openSync(file, 'r');
    try { return E.fread_e(fd, start); }
    finally { fs.closeSync(fd); }
};
E.size_e = file=>fs.statSync(file).size;
E.mtime_e = file=>+fs.statSync(file).mtime;
function mkdirp(p, mode){
    if (typeof mode=='string')
        mode = parseInt(mode, 8);
    let made = null;
    p = path.resolve(p);
    let paths = [];
    while (p && !E.exists(p))
    {
        paths.unshift(p);
        p = path.dirname(p);
    }
    for (let i=0; i<paths.length; i++)
    {
        fs.mkdirSync(paths[i], mode);
        made = made||paths[i];
    }
    return made||p;
}
E.mkdirp_e = (p, mode)=>{
    if (mode===undefined || !process.umask)
        return mkdirp(p);
    let oldmask = process.umask(0);
    try { return mkdirp(p, mode); }
    finally { process.umask(oldmask); }
};
E.mkdirp_file_e = (file, mode)=>{
    E.mkdirp_e(path.dirname(file), mode);
    return file;
};
E.rm_rf_e = rimraf.sync;
E.unlink_e = src=>{
    fs.unlinkSync(src);
    return true;
};
E.rmdir_e = dir=>{
    fs.rmdirSync(dir);
    return true;
};
E.touch_e = (src, d)=>{
    let tm = (d||Date.now())/1000;
    let h = fs.openSync(src, 'a');
    fs.futimesSync(h, tm, tm);
    fs.closeSync(h);
    return true;
};
E.readdir_e = (dir, opt)=>{
    let names = fs.readdirSync(dir);
    if (!opt || !!opt.dirs==!!opt.files)
        return names;
    if (opt.dirs)
        return names.filter(n=>E.is_dir(dir+'/'+n));
    return names.filter(n=>E.is_file(dir+'/'+n));
};
E.readdir_r_e = (dir, opt)=>{
    dir = E.normalize(dir).replace(/\/+$/, '');
    return E.find_e(dir, assign({strip: new RegExp('^'+dir+'/')}, opt));
};
function get_owner(stat, opt){
    let has_uid = 'user' in opt, has_gid = 'group' in opt;
    if (!has_uid&&!has_gid&&!opt.preserve)
        return;
    return {
        user: has_uid ? opt.user :
            opt.preserve||E.is_win ? stat.uid : process.getuid(),
        group: has_gid ? opt.group :
            opt.preserve||E.is_win ? stat.gid : process.getgid(),
    };
}
function copy_file(src, dst, opt){
    let fdw, stat, mode;
    opt = opt||{};
    stat = fs.statSync(src);
    if (E.is_dir(dst)||dst[dst.length-1]=='/')
        dst = dst+'/'+path.basename(src);
    if (opt.no_overwrite && E.exists(dst))
    {
        if (opt.no_overwrite=='skip')
        {
            if (opt.verbose)
                console.log(`Skipping copy (already exists): ${src}->${dst}`);
            return true;
        }
        throw FileError(`file already exists: ${dst}`, 'EEXIST');
    }
    if (opt.if_newer && E.exists(dst) && stat.mtime<=E.mtime(dst))
    {
        if (opt.verbose)
            console.log(`Skipping copy (src is not newer): ${src}->${dst}`);
        return true;
    }
    check_file(dst, opt);
    mode = 'mode' in opt ? opt.mode : stat.mode & 0o777;
    fdw = fs.openSync(dst, 'w', mode);
    try {
        E.read_cb_e(src, 0, buf=>void fs.writeSync(fdw, buf, 0, buf.length));
        let owner = get_owner(stat, opt);
        if (owner)
            fs.fchownSync(fdw, owner.user, owner.group);
        // Does it really needed?
        if (opt.preserve_ts)
            fs.futimesSync(fdw, stat.atime, stat.mtime);
    } finally { fs.closeSync(fdw); }
    if (opt.verbose)
        console.log(`Copy: ${src}->${dst}`);
    return true;
}
E.copy_e = (src, dst, opt)=>{
    src = E.normalize(src);
    dst = E.normalize(dst);
    if (E.is_dir(src))
        throw FileError('cannot copy directory, use copy_r', 'EISDIR');
    return copy_file(src, dst, opt);
};
E.copy_r_e = (src, dst, opt)=>{
    opt = assign({mkdirp: true}, opt);
    src = E.normalize(src);
    dst = E.normalize(dst);
    if (opt.exclude && opt.exclude.test(src))
        return true;
    if (E.is_file(src))
        return copy_file(src, dst, opt);
    if (E.is_win && E.is_symlink(src))
        src = E.readlink_e(src);
    return E.readdir_r_e(src, opt).every(f=>
        E.copy_r_e(src+'/'+f, dst+'/'+f, opt));
};
E.rename_e = (src, dst)=>{
    fs.renameSync(src, dst);
    return true;
};
E.readlink_e = src=>fs.readlinkSync(src);
E.link_e = (src, dst, opt)=>{
    opt = opt||{};
    src = E.normalize(src);
    dst = E.normalize(dst);
    check_file(dst, opt);
    try { fs.linkSync(src, dst); }
    catch(e){
        if (opt.no_copy)
            throw e;
        return E.copy_r_e(src, dst, opt);
    }
    return true;
};
E.link_r_e = (src, dst, opt)=>{
    opt = assign({mkdirp: true}, opt);
    src = E.normalize(src);
    dst = E.normalize(dst);
    if (opt.exclude && opt.exclude.test(src))
        return true;
    if (!opt.follow_symlinks && E.is_symlink(src))
        return E.symlink_e(src, dst, opt);
    if (!E.is_dir(src))
        return E.link_e(src, dst, opt);
    return E.readdir_r_e(src, opt).every(f=>
        E.link_e(src+'/'+f, dst+'/'+f, opt));
};
E.symlink_e = (src, dst, opt)=>{
    opt = opt||{};
    if (E.is_win && !opt.force)
        return E.link_e(src, dst, opt);
    src = E.normalize(src);
    dst = E.normalize(dst);
    check_file(dst, opt);
    let target = src;
    if (!opt.keep_relative)
        target = fs.realpathSync(src);
    else if (E.is_symlink(src))
        target = E.readlink_e(src);
    fs.symlinkSync(target, dst);
    return true;
};
E.hashsum_e = (filename, type)=>{
    let hash = crypto.createHash(type||'md5');
    E.read_cb_e(filename, 0, buf=>void hash.update(buf));
    return hash.digest('hex');
};
let hash_re = /([0-9a-fA-F]+) [ |*](.*)/;
E.hashsum_check_e = (type, filename)=>{
    let data = E.read_lines_e(filename);
    let base = path.dirname(filename);
    for (let i=0; i<data.length; i++)
    {
        let match = hash_re.exec(data[i]);
        if (!match)
            throw new Error('Incorrect line found: '+data[i]);
        let source = E.absolutize(match[2], base);
        let hash = E.hashsum_e(source, type);
        if (hash!=match[1])
            throw new Error('Hash mismatch '+source+': '+hash+' != '+match[1]);
    }
    return true;
};

// Safe methods
function errno_wrapper(func, ret){
    let args = array.slice(arguments, 2);
    E.errno = 0;
    E.error = null;
    try { return func.apply(null, args); }
    catch(e){
        E.errno = e.code||e;
        E.error = e;
        return ret;
    }
}
function find_cb(dir, cb, opt){
    opt = opt||{};
    let exclude = opt.exclude, match = opt.match, strip = opt.strip;
    function proc(f){
        if (match && !match.test(f))
            return;
        cb(f);
    }
    E.readdir_e(dir).forEach(f=>{
        let name = E.normalize(dir+'/'+f);
        let stripped = strip ? name.replace(strip, '') : name;
        if (exclude && exclude.test(stripped))
            return;
        if (E.is_dir(name))
        {
            if (opt.dirs)
                proc(stripped);
            if (!opt.follow_symlinks && E.is_symlink(name))
                return;
            find_cb(name, cb, opt);
        }
        else
            proc(stripped);
    });
}
E.find_e = (dir, opt)=>{
    dir = E.normalize(dir);
    opt = opt||{};
    if (opt.cb)
        return find_cb(dir, opt.cb, opt);
    let ret = [];
    find_cb(dir, f=>ret.push(f), opt);
    return ret;
};
E.realpath_e = src=>fs.realpathSync(src);
E.stat_e = src=>fs.statSync(src);
E.lstat_e = src=>fs.lstatSync(src);
let err_retval = {
    read: null, read_line: null, read_lines: null, fread: null,
    tail: null, head: null, size: null, mkdirp: null, mkdirp_file: null,
    hashsum: null, stat: null, lstat: null, realpath: null, readlink: null,
    hashsum_check: false, fread_cb: false, read_cb: false,
    fread_line_cb: false, read_line_cb: false, write: false,
    write_atomic: false, write_lines: false,
    append: false, unlink: false, rmdir: false, rm_rf: false, touch: false,
    readdir: [], readdir_r: [], copy: false, copy_r: false, rename: false,
    link: false, link_r: false, symlink: false, mtime: -1, find: null,
};
for (let method in err_retval)
    E[method] = errno_wrapper.bind(null, E[method+'_e'], err_retval[method]);

E.exists = src=>{
    try { fs.accessSync(src); }
    catch(e){ return false; }
    return true;
};
E.is_file = src=>{
    let stat;
    try { stat = fs.statSync(src); }
    catch(e){ return false; }
    return stat.isFile();
};
E.is_dir = src=>{
    let stat;
    try { stat = fs.statSync(src); }
    catch(e){ return false; }
    return stat.isDirectory();
};
E.is_symlink = src=>{
    let stat;
    try { stat = fs.lstatSync(src); }
    catch(e){ return false; }
    return stat.isSymbolicLink();
};
E.is_chardev = src=>{
    let stat;
    try { stat = fs.statSync(src); }
    catch(e){ return false; }
    return stat.isCharacterDevice();
};
E.is_socket = src=>{
    let stat;
    try { stat = fs.statSync(src); }
    catch(e){ return false; }
    return stat.isSocket();
};
E.is_exec = src=>{
    try { fs.accessSync(src, fs.X_OK); }
    catch(e){ return false; }
    return true;
};
E.which = (bin, env)=>{
    bin = E.normalize(bin);
    if (E.is_absolute(bin)&&E.is_exec(bin))
        return bin;
    const pathvar = env&&env.PATH||process.env.PATH;
    let paths = pathvar.split(E.is_win ? ';' : ':');
    for (let i=0; i<paths.length; i++)
    {
        let filename = E.normalize(`${paths[i]}/${bin}`);
        // In cygwin .exe extensions is omitting
        if (E.is_win&&!E.exists(filename)&&E.exists(filename+'.exe'))
            filename += '.exe';
        if (E.exists(filename)&&E.is_exec(filename))
            return filename;
    }
};
let watch_files = {};
E.file_changed = (file_path, scope)=>{
    scope = scope||'';
    let mtime = E.mtime(file_path);
    watch_files[scope] = watch_files[scope]||{};
    if (watch_files[scope][file_path]===mtime)
        return false;
    watch_files[scope][file_path] = mtime;
    return true;
};

if (E.is_win)
{
    E.cygwin_root = E.is_dir('C:/cygwin') ? 'C:/cygwin' :
        E.is_dir('D:/cygwin') ? 'D:/cygwin' : null;
}
E.cyg2unix = src=>{
    if (!E.is_win || !E.cygwin_root)
        return src;
    // /cygdrive/X/yyy --> X:/yyy
    src = src.replace(/^\/cygdrive\/(.)(\/(.*))?$/, '$1:/$3');
    // /usr/lib --> c:/cygwin/lib
    src = src.replace(/^\/usr\/lib(\/.*)?$/, E.cygwin_root.toLowerCase()+
        '/lib$1');
    // /usr/bin --> c:/cygwin/bin
    src = src.replace(/^\/usr\/bin(\/.*)?$/, E.cygwin_root.toLowerCase()+
        '/bin$1');
    // /xxx --> c:/cygwin/xxx
    src = src.replace(/^\//, E.cygwin_root.toLowerCase()+'/');
    return src;
};
E.unix2cyg = src=>{
    if (!E.is_win)
        return src;
    // c:/cygwin/lib -> /usr/lib
    src = src.replace(new RegExp('^'+E.cygwin_root.toLowerCase()+'/lib(.*)'),
        '/usr/lib$1');
    // c:/cygwin/bin -> /usr/bin
    src = src.replace(new RegExp('^'+E.cygwin_root.toLowerCase()+'/bin(.*)'),
        '/usr/bin$1');
    // c:/cygwin/xxx -> /xxx
    src = src.replace(new RegExp('^'+E.cygwin_root.toLowerCase()+'/(.*)'),
        '/$1');
    return src;
};
E.unix2win = src=>{
    if (!E.is_win)
        return src;
    // c:/xxx -> C:/xxx
    src = src.replace(/^[c-z]:/, s=>s.toUpperCase());
    // C:/xxx/yyy -> C:\xxx\yyy
    src = src.replace(/\//g, '\\');
    return src;
};
E.win2unix = (src, force)=>{
    if (!force && !E.is_win)
        return src;
    // C:\xxx\yyy --> C:/xxx/yyy
    src = src.replace(/\\/g, '/');
    // C:/ --> c:/
    src = src.replace(/^[c-z]:/i, s=>s.toLowerCase());
    return src;
};
E.win2cyg = src=>{
    if (!E.is_win)
        return src;
    src = E.win2unix(src);
    let escaped_root = E.cygwin_root.replace(/([?\\/[\]+*])/g, '\\$1');
    src = src.replace(new RegExp('^'+escaped_root+'/?', 'i'), '/');
    src = src.replace(/^[c-z]:/i, s=>'/cygdrive/'+s[0].toLowerCase());
    return src;
};
E.is_dotfile = src=>src.split('/').pop().startsWith('.');
E.is_absolute = src=>/^(\/|([c-z]:))/i.test(src);
E.absolutize = (p, d1, d2)=>{
    if (!p||E.is_absolute(p))
        return p;
    if (d2&&E.exists(d2+'/'+p))
        return d2+'/'+p;
    return d1+'/'+p;
};
E.normalize = p=>E.cyg2unix(E.win2unix(path.normalize(p)));
E.is_subdir = (root, sub)=>{
    let nroot = root.length;
    return !root || sub.startsWith(root) && (root[nroot-1]=='/' ||
        sub[nroot]===undefined || sub[nroot]=='/');
};
E.chown_e = (src, opt)=>{
    let stat = fs.statSync(src);
    let owner = get_owner(stat, opt);
    if (owner)
        return fs.chownSync(src, owner.user, owner.group);
};
E.chmod_e = (src, mode)=>fs.chmodSync(src, mode);
