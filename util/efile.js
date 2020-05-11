// LICENSE_CODE ZON
'use strict'; /*jslint node:true*/
require('./config.js');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const StringDecoder = require('string_decoder').StringDecoder;
const rimraf = require('rimraf');
const buf_pool = require('./buf_pool.js');
const etask = require('./etask.js');
const zerr = require('./zerr.js');
const file = require('./file.js');
const date = require('./date.js');
const E = exports, ef = etask.ef, assign = Object.assign, ms = date.ms;
const KB = 1024, MB = 1024*KB;
E.read_buf_size = 128*KB;
E.write_buf_size = 1*MB;
E.log = 1;
let log = msg=>{
    if (E.log)
        zerr(msg);
};
let check_file = (dst, opt)=>etask(function*check_file(){
    opt = opt||{};
    if (opt.rm_rf)
        yield E.rm_rf(dst);
    if (opt.mkdirp)
        yield E.mkdirp_file_e(dst);
    if (opt.unlink)
        yield E.unlink(dst);
});
// xxx_e() throws, xxx() does not.
E.open_e = (path, flags, mode)=>etask.nfn_apply(fs.open, [path, flags, mode]);
E.close_e = fd=>etask.nfn_apply(fs.close, [fd]);
E.open_cb_e = (path, flags, mode, cb)=>etask(function*open_cb_e(){
    let ret, fd = yield E.open_e(path, flags, mode);
    try { ret = yield cb(fd); }
    catch(e){ ef(e);
        yield E.close_e(fd);
        throw e;
    }
    yield E.close_e(fd);
    return ret;
});
E.write_e = (path, data, opt)=>etask(function*write_e(){
    opt = opt||{};
    yield check_file(path, opt);
    yield etask.nfn_apply(fs.writeFile, [path, data]);
});
E.write_atomic_e = (file, data, opt)=>etask(function*write_atomic_e(){
    opt = opt||{};
    yield check_file(file, opt);
    let tmpfile = file+'.'+(1000000*Math.random()|0)+'.tmp';
    try {
        yield etask.nfn_apply(fs.writeFile, [tmpfile, data]);
        yield etask.nfn_apply(fs.rename, [tmpfile, file]);
    } catch(e){
        E.unlink_e(tmpfile);
        throw e;
    }
    return true;
});
E.rename_e = (old_path, new_path)=>
    etask.nfn_apply(fs.rename, [old_path, new_path]);
E.unlink_e = path=>etask.nfn_apply(fs.unlink, [path]);
E.mkdir_e = (path, mode)=>etask.nfn_apply(fs.mkdir, [path, mode]);
E.mkdirp_e = p=>etask(function*mkdirp_e(){
    let mode = 0o777 & ~(process.umask&&process.umask());
    try { yield E.mkdir_e(p, mode); }
    catch(e){ ef(e);
        if (e.code=='EEXIST')
            return;
        if (e.code!='ENOENT')
            throw e;
        yield E.mkdirp_e(path.dirname(p));
        try { yield E.mkdir_e(p, mode); }
        catch(e){ ef(e);
            if (e.code=='EEXIST')
                return;
            throw e;
        }
    }
});
E.mkdirp_file_e = f=>E.mkdirp_e(path.dirname(f));
E.readdir_e = path=>etask.nfn_apply(fs.readdir, [path]);
E.rmdir_e = path=>etask.nfn_apply(fs.rmdir, [path]);
E.fwrite_e = (fd, buf, pos, size, len)=>etask(function*fwrite_e(){
    let written, offset = 0;
    len = len||buf.length;
    size = size||E.write_buf_size;
    while ((written = yield etask.nfn_apply(fs.write,
        [fd, buf, offset, Math.min(size, len), pos]))<len)
    {
        offset += written;
        len -= written;
        if (typeof pos=='number')
            pos += written;
    }
    return true;
});
// XXX vladislav: merge to fread_e
E.fread_chunk_e = (fd, buffer, offset, length, pos)=>
    etask.nfn_apply(fs.read, [fd, buffer, offset, length, pos]);
E.read_e = (path, opt)=>etask(function*read_e(){
    opt = opt||{};
    let buf_size = opt.buf_size||E.read_buf_size;
    let buf = buf_pool.alloc(buf_size), data = '';
    this.finally(()=>buf_pool.free(buf));
    let res, pos = 0, fd = yield E.open_e(path, 'r+', 0o777);
    while (res = yield E.fread_chunk_e(fd, buf, 0, buf_size, pos))
    {
        pos += res;
        data += ''+buf.slice(0, res); // supports only ascii, not utf8
    }
    yield E.close_e(fd);
    return data;
});
// XXX vladislav: should be named just 'copy'?
E.copy_e = (old_path, new_path, opt)=>etask(function*copy_e(){
    opt = opt||{};
    yield check_file(new_path, opt);
    let r_stream = fs.createReadStream(old_path);
    let w_stream = fs.createWriteStream(new_path, {flags: 'w+', mode: 0o777});
    let close = ()=>{
        if (w_stream)
            w_stream.close();
        if (r_stream)
        {
            r_stream.unpipe(w_stream);
            r_stream.close();
        }
        w_stream = undefined;
        r_stream = undefined;
    };
    this.finally(close);
    r_stream.on('error', this.throw_fn());
    w_stream.on('error', this.throw_fn());
    r_stream.on('close', this.continue_fn());
    r_stream.pipe(w_stream);
    try { yield this.wait(); }
    catch(e){ ef(e);
        log('copy error: '+e);
        close();
        yield E.unlink_e(new_path);
    }
});
E.read_line_e = path=>etask(function*read_line_e(){
    let ret;
    yield E.read_line_cb_e(path, line=>{
        ret = line;
        return true;
    });
    return ret;
});
E.read_lines_e = path=>etask(function*read_lines_e(){
    let ret = (yield E.read_e(path)).split(/\r?\n/);
    if (ret[ret.length-1]==='')
        ret.pop();
    return ret;
});
E.fread_e = (fd, start, size, opt)=>etask(function*fread_e(){
    start = start||0;
    opt = opt||{};
    let decoder = new StringDecoder(opt.encoding), rest = size;
    let ret = '', append_ret = buf=>ret += decoder.write(buf);
    yield E.fread_cb_e(fd, start, rest===undefined ? append_ret : buf=>{
        rest -= buf.length;
        if (rest<0)
            buf = buf.slice(0, rest);
        append_ret(buf);
        return rest<=0;
    });
    return ret;
});
E.find_e = (dir, opt)=>etask(function*find_e(){
    opt = opt||{};
    let ret = [];
    let exclude = opt.exclude, match = opt.match, strip = opt.strip;
    for (let f of yield E.readdir_e(dir))
    {
        let name = file.normalize(dir+'/'+f);
        let stripped = strip ? name.replace(strip, '') : name;
        if (exclude && exclude.test(stripped))
            continue;
        if (opt.cb)
            yield opt.cb(name);
        if (yield E.is_dir(name))
        {
            if (opt.dirs)
                ret.push(stripped);
            if (!opt.follow_symlinks && (yield E.is_symlink(name)))
                continue;
            let files = yield E.find_e(name, opt);
            files.forEach(f=>ret.push(f));
            if (!files.length && opt.empty_dirs)
                opt.empty_dirs.push(stripped);
        }
        else
            ret.push(stripped);
    }
    if (match)
        ret = ret.filter(f=>match.test(f));
    return ret;
});
E.tail_e = (filename, count)=>etask(function*tail_e(){
    count = count||E.read_buf_size;
    let start = (yield E.size_e(filename))-count;
    if (start<0)
        start = 0;
    return yield E.open_cb_e(filename, 'r', null, fd=>E.fread_e(fd, start));
});
E.head_e = (filename, size)=>etask(function*head_e(){
    if (size<0)
        size = 0;
    return yield E.open_cb_e(filename, 'r', null, fd=>E.fread_e(fd, 0, size));
});
E.size_e = filename=>etask(function*size_e(){
    return (yield E.stat_e(filename)).size; });
E.hashsum_e = (filename, type)=>etask(function*hashsum_e(){
    let hash = crypto.createHash(type||'md5');
    yield E.read_cb_e(filename, 0, buf=>void hash.update(buf));
    return hash.digest('hex');
});
E.stat_e = path=>etask.nfn_apply(fs.stat, [path]);
E.lstat_e = path=>etask.nfn_apply(fs.lstat, [path]);
E.realpath_e = path=>etask.nfn_apply(fs.realpath, [path]);
E.readlink_e = src=>etask.nfn_apply(fs.readlink, [src]);
let hash_re = /([0-9a-fA-F]+) [ |*](.*)/;
E.hashsum_check_e = (type, filename)=>etask(function*hashsum_check_e(){
    let base = path.dirname(filename);
    for (let line of yield E.read_lines_e(filename))
    {
        let match;
        if (!(match = hash_re.exec(line)))
            throw new Error('Incorrect line found: '+line);
        let source = file.absolutize(match[2], base);
        let hash = yield E.hashsum_e(source, type);
        if (hash!=match[1])
            throw new Error('Hash mismatch '+source+': '+hash+' != '+match[1]);
    }
    return true;
});
E.fread_cb_e = (fd, pos, cb)=>etask(function*fread_cb_e(){
    let res, buf = buf_pool.alloc(E.read_buf_size);
    this.finally(()=>buf_pool.free(buf));
    while (res = yield E.fread_chunk_e(fd, buf, 0, buf.length, pos))
    {
        if (yield cb(buf.slice(0, res), pos))
            return true;
        pos += res;
    }
    return true;
});
E.read_cb_e = (filename, pos, cb)=>
    E.open_cb_e(filename, 'r', null, fd=>E.fread_cb_e(fd, pos, cb));
E.fread_line_cb_e = (fd, cb, opt)=>etask(function*fread_line_cb_e(){
    opt = assign({encoding: 'utf8', buf_size: E.read_buf_size}, opt);
    let read, buf = buf_pool.alloc(opt.buf_size);
    this.finally(()=>buf_pool.free(buf));
    let strbuf = '', lf_idx, decoder = new StringDecoder(opt.encoding);
    while (read = yield E.fread_chunk_e(fd, buf, 0, buf.length))
    {
        strbuf += decoder.write(buf.slice(0, read));
        while ((lf_idx = strbuf.indexOf('\n'))>=0)
        {
            let ln = strbuf.slice(0, lf_idx-(strbuf[lf_idx-1]=='\r' ? 1 : 0));
            if (yield cb(ln))
                return true;
            strbuf = strbuf.slice(lf_idx+1);
        }
    }
    if (strbuf)
        yield cb(strbuf);
    return true;
});
E.read_line_cb_e = (filename, cb, opt)=>
    E.open_cb_e(filename, 'r', null, fd=>E.fread_line_cb_e(fd, cb, opt));
E.write_lines_e = (file, data, opt)=>etask(function*write_lines_e(){
    data = Array.isArray(data) ?
        data.length ? data.join('\n')+'\n' : '' : ''+data+'\n';
    return yield E.write_e(file, data, opt);
});
E.append_e = (file, data, opt)=>etask(function*append_e(){
    opt = opt||{};
    yield check_file(file, opt);
    yield etask.nfn_apply(fs.appendFile, [file, data, opt]);
    return true;
});
E.rm_rf_e = path=>etask.nfn_apply(rimraf, [path]);
E.touch_e = path=>E.open_cb_e(path, 'a', null, function*touch_e(fd){
    let tm = Date.now()/1000;
    yield etask.nfn_apply(fs.futimes, [fd, tm, tm]);
    return true;
});
E.link_e = (src, dst, opt)=>etask(function*line_e(){
    opt = opt||{};
    src = file.normalize(src);
    dst = file.normalize(dst);
    yield check_file(dst, opt);
    try { yield etask.nfn_apply(fs.link, [src, dst]); }
    catch(e){ ef(e);
        if (opt.no_copy)
            throw e;
        return yield E.copy_e(src, dst, opt);
    }
    return true;
});
E.link_r_e = (src, dst, opt)=>etask(function*link_r_e(){
    opt = opt||{};
    src = file.normalize(src);
    dst = file.normalize(dst);
    yield E.mkdirp_file(dst);
    if (!opt.follow_symlinks && (yield E.is_symlink(src)))
        return yield E.symlink_e(src, dst, opt);
    if (!(yield E.is_dir(src)))
        return yield E.link_e(src, dst, opt);
    for (let f of yield E.readdir_e(src))
    {
        if (!opt.exclude || !opt.exclude.test(f))
            yield E.link_r_e(src+'/'+f, dst+'/'+f, opt);
    }
    return true;
});
E.symlink_e = (src, dst, opt)=>etask(function*symlink_e(){
    opt = opt||{};
    if (file.is_win && !opt.force)
        return yield E.link_e(src, dst, opt);
    src = file.normalize(src);
    dst = file.normalize(dst);
    yield check_file(dst, opt);
    let target = src;
    if (!opt.keep_relative)
        target = yield E.realpath_e(src);
    else if (yield E.is_symlink(src))
        target = yield E.readlink_e(src);
    yield etask.nfn_apply(fs.symlink, [target, dst]);
    return true;
});
E.mtime_e = path=>etask(function*mtime_e(){
    return +(yield E.stat_e(path)).mtime; });
E.exists = path=>etask(function*exists(){
    try { yield etask.nfn_apply(fs.access, [path]); }
    catch(e){ ef(e); return false; }
    return true;
});
E.is_exec = path=>etask(function*is_exec(){
    try { yield etask.nfn_apply(fs.access, [path, fs.X_OK]); }
    catch(e){ ef(e); return false; }
    return true;
});
let false_stat = {isSymbolicLink: ()=>false, isCharacterDevice: ()=>false,
    isFile: ()=>false, isDirectory: ()=>false, isSocket: ()=>false};
E.is_file = path=>etask(function*is_file(){
    return ((yield E.stat(path))||false_stat).isFile(); });
E.is_dir = path=>etask(function*is_dir(){
    return ((yield E.stat(path))||false_stat).isDirectory(); });
E.is_chardev = path=>etask(function*is_chardev(){
    return ((yield E.stat(path))||false_stat).isCharacterDevice(); });
E.is_socket = path=>etask(function*is_socket(){
    return ((yield E.stat(path))||false_stat).isSocket(); });
E.is_symlink = path=>etask(function*is_symlink(){
    return ((yield E.lstat(path))||false_stat).isSymbolicLink(); });
E.write_stream = (stream, data, opt)=>etask(function*write_stream(){
    if (stream.finished)
        return;
    let wait = etask.wait(opt.stream_write_timeout);
    stream.write(data, null, e=>{
        if (!e)
            return wait.continue(data.length);
        e.is_pipe_write_error = true;
        wait.throw(e);
    }, opt);
    return yield wait;
});
E.pipe_stream = (fd, pos, len, stream, opt)=>etask(function*pipe_stream(){
    opt = assign({buf_size: 1*MB, stream_write_timeout: 10*ms.MIN}, opt);
    let buf, close, err, cur_pos = pos, size = opt.buf_size;
    let wsize = opt.write_size;
    this.finally(()=>{
        if (buf)
            buf_pool.free(buf);
    });
    if (stream)
    {
        let on_error = e=>err = e;
        let on_close_or_end = ()=>close = true;
        stream.once('error', on_error);
        stream.once('end', on_close_or_end);
        stream.once('close', on_close_or_end);
    }
    for (;;)
    {
        let offset = cur_pos-pos;
        if (offset+opt.buf_size>=len)
            size = len-offset;
        if (!size || close)
            break;
        if (err)
            throw err;
        buf = buf_pool.alloc(opt.buf_size);
        let start_ts = Date.now();
        let res = yield E.fread_chunk_e(fd, buf, 0, size, cur_pos);
        let data = res!=buf.length ? buf.slice(0, res) : buf;
        if (opt.on_read)
            yield opt.on_read({size, duration: Date.now()-start_ts});
        if (!res || close)
            break;
        if (err)
            throw err;
        if (opt.on_send)
            yield opt.on_send(data);
        if (opt.fd)
            yield E.fwrite_e(opt.fd, data, cur_pos, wsize);
        else if (opt.write_cb)
            yield opt.write_cb(data);
        else if (stream)
            yield E.write_stream(stream, data, opt);
        cur_pos += res;
        buf_pool.free(buf);
        buf = null;
    }
});
let call_safe = (method, func, ret, args)=>etask(method, function*(){
    E.errno = 0;
    E.error = null;
    try { return yield func.apply(null, args); }
    catch(e){ ef(e);
        E.errno = e.code||e;
        E.error = e;
        log(`${method} failed: ${e}`);
        return ret;
    }
});
let err_retval = {open: null, close: false, rename: false,
    mkdir: false, readdir: [], fwrite: false, read: null, fread: false,
    copy: false, rmdir: false, unlink: false, mkdirp: false, fread_chunk: null,
    mkdirp_file: false, stat: null, lstat: null, read_line: null, write: false,
    read_lines: null, find: null, tail: null, head: null, size: null,
    hashsum: null, realpath: null, readlink: null, hashsum_check: false,
    fread_cb: false, read_cb: false, read_line_cb: false, write_lines: false,
    append: false, rm_rf: false, touch: false, link: false, link_r: false,
    symlink: false, mtime: -1};
for (let m in err_retval)
{
    E[m] = function(){
        return call_safe(m, E[m+'_e'], err_retval[m], arguments); };
}
