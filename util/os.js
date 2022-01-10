// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true*/
require('./config.js');
const fs = require('fs');
const string = require('./string.js');
const zerr = require('./zerr.js');
const file = require('./file.js');
const etask = require('./etask.js');
const efile = require('./efile.js');
const array = require('./array.js');
const zutil = require('./util.js');
const assert = require('assert');
const cli = require('./cli.js');
const exec = require('./exec.js');
const os = require('os');
const E = exports;
const env = process.env, qw = string.qw, KB = 1024, MB = KB*KB;
let fallocate;
try { fallocate = require('fallocate-uint32'); } catch(e){}
const BIN_IP = '/bin/ip';

var distro_release;
var procfs_fmt = {
    cpu: qw`cpu user nice system idle iowait irq softirq steal guest
        guest_nice`,
    pstat: qw`pid tcomm state ppid pgrp sid tty_nr tty_pgrp flags min_flt
        cmin_flt maj_flt cmaj_flt utime stime cutime cstime priority nice
        num_threads it_real_value start_time vsize rss rsslim start_code
        end_code start_stack esp eip pending blocked sigign sigcatch notused
        notused notused exit_signal task_cpu rt_priority policy blkio_ticks
        gtime cgtime start_data end_data start_brk arg_start arg_end env_start
        env_end exit_code`,
    filenr: qw`open unused max`,
    diskstats: qw`major minor reads reads_merged reads_sector reads_ms writes
        writes_merged writes_sector writes_ms io_current io_ms io_weighted_ms`,
};

let cyg_readdir = dir=>
    file.is_win ? exec.get_lines(`ls -1 ${dir}`) : file.readdir(dir);
let cyg_read_lines = path=>
    file.is_win ? exec.get_lines(`cat ${path}`) : file.read_lines(path);
let cyg_read = path=>file.is_win ?
    exec.get(`cat ${path}`, {out: 'stdout', stdio: 'pipe'}) : file.read(path);

// XXX vadim: all procfs-related funcs should use this and not magic numbers
function read_procfs_line(filepath, type){
    var str;
    if (!(str = cyg_read(filepath)))
        return;
    var res = {}, parts = str.split(/ +/);
    procfs_fmt[type].forEach((name, idx)=>res[name] = parts[idx]||0);
    return res;
}

// on some machines the lines are in a different order
E.meminfo_parse = function(info){
    var n = string.split_nl(info), mem = {};
    for (var i=0; i<n.length; i++)
    {
        if (!n[i])
            continue;
        var m = /^([A-Za-z0-9_()]+):\s+([0-9]+)( kB)?$/.exec(n[i]);
        if (!m)
           zerr(`meminfo_parse: can't parse line "${n[i]}"`);
        assert(m);
        switch (m[1])
        {
        case 'MemTotal': mem.memtotal = m[2]*KB; break;
        case 'MemFree': mem.memfree = m[2]*KB; break;
        case 'Buffers': mem.buffers = m[2]*KB; break;
        case 'Cached': mem.cached = m[2]*KB; break;
        case 'MemAvailable': mem.memfree_all = m[2]*KB; break;
        }
    }
    return mem;
};

// os.freemem does not include buffers and cached as freemem
E.meminfo = function(){
    if (file.is_darwin)
        return {memtotal: os.totalmem(), memfree_all: os.freemem()};
    var info = cyg_read('/proc/meminfo');
    var mem = E.meminfo_parse(info);
    mem.buffers = mem.buffers||0; // openvz does not always have Buffers
    mem.cached = mem.cached||0; // cygwin does not have Cached
    mem.memfree_all = mem.memfree_all||mem.memfree+mem.buffers+mem.cached;
    return mem;
};
E.freemem = function(){ return E.meminfo().memfree_all; };
E.totalmem = function(){ return E.meminfo().memtotal; };
E.mem_usage = function(){
    var info = E.meminfo();
    return (info.memtotal-info.memfree_all)/info.memtotal;
};
E.freemem_percent = function(){ return 100*(1-E.mem_usage()); };
E.get_release = function(no_cache){
    if (distro_release && !no_cache)
        return distro_release;
    distro_release = {};
    if (file.is_win)
    {
        const lines = exec.get_lines('systeminfo.exe');
        const values = {id: /OS Name:\s+(.+)/, version: /OS Version:\s+(.+)/};
        for (let l of lines)
        {
            let v;
            for (let k in values)
            {
                if (v = values[k].exec(l))
                    distro_release[k] = v[1];
            }
        }
    }
    else if (!file.is_darwin)
    {
        let info = exec.get_lines(['lsb_release', '-i', '-r', '-c', '-s']);
        if (!info.length)
        {
            const os_info = exec.get_lines('cat /etc/os-release');
            const get = k=>{
                const start = `${k.toUpperCase()}=`;
                const data = os_info.find(l=>l.startsWith(start));
                return data &&
                    data.slice(start.length).replace(/^"|"$/g, '') || '';
            };
            info = [get('id'), get('version_id'), get('version_codename')];
        }
        distro_release = {
            id: info[0].toLowerCase(),
            version: info[1],
            codename: info[2].toLowerCase(),
        };
    }
    return distro_release;
};
E.is_release = function(releases, no_cache){
    releases = array.to_array(releases);
    E.get_release(no_cache);
    return releases.some(function(e){
        var m = e.toLowerCase().match(/^(i|v|c):(.*)$/);
        switch (m[1])
        {
        case 'i':
            return distro_release.id==m[2];
        case 'v':
            return distro_release.version==m[2];
        case 'c':
            return distro_release.codename==m[2];
        }
    });
};

E.fallocate = function(fd, len, offset, mode){
    let ret = fallocate(fd, mode||0, offset||0, len);
    if (ret)
    {
        if (ret == -95) // EOPNOTSUPP
            fs.ftruncateSync(fd, len);
        else
            throw new Error(`fallocate failed: ${ret}`);
    }
};

var swapfile = '/tmp/zapt.swap';
E.swapon = function(){
    if (!file.is_file(swapfile) || file.size(swapfile)<512*MB)
    {
        cli.exec_rt_e('rm -f '+swapfile);
        // XXX sergey: we cannot use it anyway, it disabled by hoster
        if (cli.exec_rt('fallocate -l 512M '+swapfile))
            return;
        cli.exec_rt_e('mkswap '+swapfile);
    }
    // XXX sergey: some openvz does not support swapon, ignore it
    cli.exec_rt('swapon '+swapfile);
};
E.swapoff = function(){ cli.exec_rt('swapoff '+swapfile); };
E.swap_usage = function(){
    if (file.is_darwin)
        return {count: 0, usage: 0};
    let swaps = cyg_read_lines('/proc/swaps').slice(1);
    let ret = {count: swaps.length, usage: 0};
    if (!swaps.length)
        return ret;
    let data = swaps.reduce((p, line)=>{
        let splitted = line.split('\t');
        p.total += +splitted[splitted.length-3];
        p.used += +splitted[splitted.length-2];
        return p;
    }, {total: 0, used: 0});
    ret.usage = data.total ? data.used/data.total*100 : 0;
    return ret;
};

E.check_space = function(req){
    return +exec.get_line('df --output=avail -k / | grep -iv avail')>req;
};

function cpu_diff(prev, curr){
    var d = {};
    for (var i in curr)
        d[i] = curr[i]-prev[i];
    // vitaly: ignoring steal diff<0 to mitigate decreasing steal
    // https://0xstubs.org/debugging-a-flaky-cpu-steal-time-counter-on-a-paravirtualized-xen-guest/
    d.busy = d.user+d.nice+d.system+d.irq+d.softirq+Math.max(d.steal, 0)
        +d.guest+d.guest_nice;
    d.total = d.busy+d.idle+d.iowait;
    if (d.total>0)
        d.busy_ratio = d.busy/d.total;
    return d;
}

function cpus_diff(prev, curr){
    var diff = [];
    for (var i = 0; i<curr.length; i++)
        diff.push(cpu_diff(prev[i], curr[i]));
    diff.all = cpu_diff(prev.all, curr.all);
    return diff;
}

// XXX vadim: cleanup
E.cpus = function(){
    var cpus = [];
    var items = ['user', 'nice', 'system', 'idle', 'iowait', 'irq', 'softirq',
        'steal', 'guest', 'guest_nice'];
    if (file.is_darwin)
    {
        const names = {system: 'sys'};
        const res = os.cpus();
        for (let i=0; i<res.length; i++)
        {
            let c = cpus[i] = {};
            for (let item of items)
                c[item] = res[i].times[names[item]||item]|0;
        }
        cpus.all = {};
        for (let item of items)
            cpus.all[item] = cpus.reduce((p, c)=>p+c[item], 0)/res.length;
        return cpus;
    }
    var ll = cyg_read_lines('/proc/stat');
    ll.forEach(l=>{
        if (!/^cpu\d* /.test(l))
            return;
        l = l.split(/ +/);
        var c = {}, name = l[0]=='cpu' ? 'all' : +l[0].slice(3), i;
        for (i=0; i<items.length; i++)
            c[items[i]] = +(l[i+1]||0); // guest/guest_nice not on old kernels
        cpus[name] = c;
    });
    return cpus;
};

E.cpu_threads = function(){
    let res = {};
    let read_stat = (dir, tid)=>{
        let str;
        if (!(str = file.read(`${dir}/${tid}/stat`)))
            return;
        let parts = str.split(' ');
        // stat.utime + stat.stime
        res[tid] = +parts[13]+(+parts[14]);
    };
    E.ps().forEach(pid=>{
        if (file.is_win)
            return read_stat('/proc', pid);
        let taskdir = `/proc/${pid}/task`;
        cyg_readdir(taskdir).forEach(tid=>read_stat(taskdir, tid));
    });
    return res;
};

E.cpu_threads_prev = {};
E.cpu_threads_usage = function(){
    const curr = E.cpu_threads();
    let res = [];
    for (let tid in curr)
        res.push(curr[tid]-E.cpu_threads_prev[tid]||0);
    E.cpu_threads_prev = curr;
    return res;
};

E.cpus_prev = [null, null];
E.cpu_usage = function(cpus_curr, cpus_prev){
    var p = cpus_prev||E.cpus_prev;
    cpus_curr = cpus_curr||E.cpus();
    var zero = {all: 0, single: 0};
    if (!p[0])
    {
        p[1] = p[0] = cpus_curr;
        return zero;
    }
    var d = cpus_diff(p[0], cpus_curr);
    if (!d.all.total)
    {
        d = cpus_diff(p[1], cpus_curr);
        if (!d.all.total)
            return zero;
    }
    else
    {
        p[1] = p[0];
        p[0] = cpus_curr;
    }
    const total_per_cpu = d.all.total/d.length;
    const threads = E.cpu_threads_usage();
    return {all: d.all.busy_ratio,
        single: Math.max.apply(null, d.map(e=>e.busy_ratio)),
        thread_single: Math.max.apply(null, threads.map(x=>x/total_per_cpu)),
        diff: d};
};
if (!file.is_darwin)
    E.cpu_usage(); // init

E.iface_list = ()=>{
    if (file.is_win || file.is_darwin)
        return Object.keys(os.networkInterfaces());
    // https://github.com/nodejs/node/issues/498
    let ifaces = cli.exec_get_lines(`${BIN_IP} link show`);
    return ifaces.map(str=>{
        const match = /^\d+:\s([\w@]+):.*/.exec(str);
        return match && match[1].replace(/@\w+$/, '');
    }).filter(i=>i);
};

E.eth_dev = ()=>{
    let is_ether = ifname=>/^(bond|en|wl|eth)/.test(ifname);
    let ifaces = E.iface_list().filter(is_ether);
    // https://cgit.freedesktop.org/systemd/systemd/tree/src/udev/udev-builtin-net_id.c#n20
    if (!ifaces.length)
        throw new Error('No ethernet interfaces found');
    if (ifaces.length==1)
        return {eth_dev: ifaces[0], ifaces};
    let routes = cli.exec_get_lines(`${BIN_IP} -4 route`);
    let default_route = array.grep(routes, /^default/)[0];
    if (!default_route)
        throw new Error('Default route not found');
    let m = default_route.match(/dev (\w+)/);
    if (!m)
        throw new Error('Cannot determine interface for default route');
    if (!is_ether(m[1]))
        throw new Error('None of multiple ethernet interfaces is default');
    let eth_dev = m[1];
    let udptunnel_dev = ifaces.filter(s=>s!=eth_dev)[0];
    return {eth_dev, udptunnel_dev, ifaces, routes};
};

E.net_dev = undefined;
function set_net_dev(){
    if (E.net_dev)
        return;
    // XXX vadim: rename to NET_DEV_STAT?
    if (env.NET_DEV)
    {
        E.net_dev = qw(env.NET_DEV);
        E.net_dev.forEach(dev=>{
            if (!file.exists('/sys/class/net/'+dev))
            {
                zerr.perr('err_assert_bad_conf', 'Device '+dev+' configured '+
                    'in NET_DEV env but it does not exist');
            }
        });
        return;
    }
    let eth_dev = 'ens3';
    try { eth_dev = E.eth_dev(); } catch(e){ zerr(e); }
    var search = [eth_dev.eth_dev, 'eth0', 'venet0', 'em1'];
    for (var i in search)
    {
        if (file.exists('/sys/class/net/'+search[i]))
            return void(E.net_dev = [search[i]]);
    }
}

E.net_dev_stats = function(net_dev, opt={}){
    var o = {};
    if (!E.net_dev)
        set_net_dev();
    net_dev = array.to_array(net_dev||E.net_dev);
    if (!net_dev.length)
        return;
    net_dev.forEach((dev, index)=>{
        var ifname = index ? '_'+dev : '';
        var stats = ['rx_bytes', 'tx_bytes'];
        if (opt.err_stat)
        {
            stats.push('rx_packets', 'tx_packets', 'rx_errors', 'rx_dropped',
                'rx_fifo_errors', 'rx_frame_errors', 'tx_errors', 'tx_dropped',
                'tx_fifo_errors', 'tx_carrier_errors', 'collisions');
        }
        for (var i in stats)
        {
            try {
                o[stats[i]+ifname] = +file.read_e(
                    '/sys/class/net/'+dev+'/statistics/'+stats[i]);
            } catch(e){}
        }
    });
    return o;
};

function beancounter_value(value){
    return value=='9223372036854775807' ? null : +value; }

E.beancounters = function(){
    try {
        var info = file.read_lines_e('/proc/user_beancounters')
        .slice(2).map(line=>line.slice(12).split(/[^\w]+/g));
        var data = {total_failcnt: 0};
        info.forEach(line=>{
            data[line[0]] = {
                held: +line[1],
                    maxheld: +line[2],
                    barrier: beancounter_value(line[3]),
                    limit: beancounter_value(line[4]),
                    failcnt: +line[5]
            };
            data.total_failcnt += +line[5];
        });
        return data;
    } catch(e){ return; }
};

E.TCP = { // net/tcp_states.h
    1: 'ESTABLISHED',
    2: 'SYN_SENT',
    3: 'SYN_RECV',
    4: 'FIN_WAIT1',
    5: 'FIN_WAIT2',
    6: 'TIME_WAIT',
    7: 'CLOSE',
    8: 'CLOSE_WAIT',
    9: 'LAST_ACK',
    10: 'LISTEN',
    11: 'CLOSING',
};
E.sockets_count = proto=>etask(function*(){
    let line_idx = -1, v = {total: 0, lo: 0, ext: 0, err: 0};
    zutil.forEach(E.TCP, id=>v[id] = 0);
    yield efile.read_line_cb_e('/proc/net/'+proto, conn=>{
        line_idx++;
        if (!conn || !line_idx)
            return;
        let start;
        if ((start = conn.indexOf(':'))==-1)
            return void(v.err++);
        v.total++;
        if (conn.substr(start+2, 8)=='0100007F')
            v.lo++;
        else
            v.ext++;
        let state = E.TCP[+('0x'+conn.substr(start+30, 2))];
        if (state)
            v[state]++;
    });
    return v;
});

E.tcp_stats = ()=>{
    let ll = file.read_lines_e('/proc/net/snmp'), i = 0;
    for (; i<ll.length && !ll[i].startsWith('Tcp'); i++);
    if (i<ll.length-1)
    {
        let l = ll[i+1].split(/\s+/);
        return {in_segs: +l[10], out_segs: +l[11], retrans_segs: +l[12],
            in_errs: +l[13], in_csum_errs: +l[15]};
    }
};

E.udp_stats = ()=>{
    let ll = file.read_lines_e('/proc/net/snmp'), i = 0;
    for (; i<ll.length && !ll[i].startsWith('Udp'); i++);
    if (i<ll.length-1)
    {
        let l = ll[i+1].split(/\s+/);
        return {in_datagrams: +l[1], no_ports: +l[2], in_errors: +l[3],
            out_datagrams: +l[4], rcvbuf_errors: +l[5], sndbuf_errors: +l[6],
            in_csum_errors: +l[7]};
    }
};

E.vmstat = function(){
    var vmstat = file.read_lines_e('/proc/vmstat');
    var ret = {};
    for (var i=0; i<vmstat.length; i++)
    {
        var n = qw(vmstat[i]);
        if (!n[0])
            continue;
        ret[n[0]] = +n[1];
    }
    return ret;
};

E.disk_page_io = function(){
    var vmstat = E.vmstat();
    // pgpgin/pgpgout are reported in KB; nr_dirty is reported in 4K pages
    return {
        read: vmstat.pgpgin*KB,
        write: vmstat.pgpgout*KB,
        dirty: vmstat.nr_dirty*4*KB,
        dirty_max: vmstat.nr_dirty_threshold*4*KB,
        dirty_bg_max: vmstat.nr_dirty_background_threshold*4*KB,
    };
};

function calc_diskstat(cur, prev){
    cur.rw_ms = cur.reads_ms+cur.writes_ms;
    cur.rw_ios = cur.reads+cur.writes;
    if (!prev)
        return;
    let d_ts = cur.ts-prev.ts;
    let d_ios = cur.rw_ios-prev.rw_ios;
    cur.await = d_ios ? (cur.rw_ms-prev.rw_ms)/d_ios : 0;
    cur.util = d_ts ? (cur.io_ms-prev.io_ms)/d_ts*100 : 0;
    cur.util_weighted = d_ts
        ? (cur.io_weighted_ms-prev.io_weighted_ms)/d_ts : 0;
}

E.diskstats_prev = {};
E.diskstats_sys = function(dev, inflight){
    let diskstats;
    if (!(diskstats = file.read_line(`/sys/block/${dev}/stat`)))
        return;
    let n = diskstats.trim().split(/\s+/);
    let cur = {reads: +n[0], reads_merged: +n[1], reads_sector: +n[2],
        reads_ms: +n[3], writes: +n[4], writes_merged: +n[5],
        writes_sector: +n[6], writes_ms: +n[7], io_current: +n[8],
        io_ms: +n[9], io_weighted_ms: +n[10], await: 0, util: 0,
        util_weighted: 0, ts: Date.now()};
    let prev = E.diskstats_prev[dev];
    calc_diskstat(cur, prev);
    if (prev)
    {
        cur.major = prev.major||0;
        cur.minor = prev.minor||0;
    }
    inflight = inflight && file.read_line(`/sys/block/${dev}/inflight`);
    if (inflight)
    {
        inflight = inflight.trim().split(/\s+/);
        [cur.inflight_r, cur.inflight_w] = [+inflight[0], +inflight[1]];
    }
    E.diskstats_prev[dev] = cur;
    return cur;
};
E.diskstats = function(){
    // https://www.kernel.org/doc/Documentation/iostats.txt
    let diskstats;
    if (!(diskstats = cyg_read_lines('/proc/diskstats')))
        return;
    let ret = {};
    for (let i=0; i<diskstats.length; i++)
    {
        let n = diskstats[i].trim().split(/\s+/), dev = n[2];
        if (/\d+$/.test(dev) && !/nvme\dn\d$/.test(dev)) // ignore paritions
            continue;
        let cur = ret[dev] = {major: +n[0], minor: +n[1], reads: +n[3],
            reads_merged: +n[4], reads_sector: +n[5], reads_ms: +n[6],
            writes: +n[7], writes_merged: +n[8], writes_sector: +n[9],
            writes_ms: +n[10], io_current: +n[11], io_ms: +n[12],
            io_weighted_ms: +n[13], await: 0, util: 0, util_weighted: 0,
            ts: Date.now()};
        calc_diskstat(cur, E.diskstats_prev[dev]);
    }
    E.diskstats_prev = ret;
    return ret;
};

E.disk_io_time = function(stats){
    var diskstats = stats||E.diskstats();
    if (!diskstats)
        return;
    var io = {read: 0, write: 0, total: 0, max_await: 0, max_util: 0,
        max_util_weighted: 0};
    for (var i in diskstats)
    {
        io.read += diskstats[i].reads_ms;
        io.write += diskstats[i].writes_ms;
        io.total += diskstats[i].io_ms;
        io.max_await = Math.max(io.max_await, diskstats[i].await);
        io.max_util = Math.max(io.max_util, diskstats[i].util);
        io.max_util_weighted = Math.max(io.max_util_weighted,
            diskstats[i].util_weighted);
    }
    return io;
};

E.get_kernel = function(){
    const uname = exec.get_line('uname -snrv');
    const res = /^(\S+) (\S+) (\S+) (.+)/.exec(uname);
    if (!res)
        return {};
    return {name: res[1], node: res[2], release: res[3], version: res[4]};
};

E.info = function(){
    return {type: os.type(), endianness: os.endianness(),
        hostname: os.hostname(), arch: os.arch(),
        release: E.get_release(), kernel: E.get_kernel()};
};

E.node = function(){
    const dst = file.is_dir(file.normalize('/var/hola_agent')) ?
        'hola_agent' : 'hola_server';
    let host = exec.get_line('/usr/local/bin/node -v').replace(/^v/, '');
    let hola_server = file.read_line(
        file.normalize(`/var/${dst}/node_version`));
    return {host, hola_server};
};

E.ps = function(){
    return cyg_readdir('/proc').filter(p=>/^\d+$/.test(p)).map(p=>+p)
    .sort((a, b)=>a-b);
};

E.fd_use = opt=>etask(function*(){
    opt = opt||{};
    let res = {use: -1, pid: -1, pids: {}, glob: {open: -1, max: -1, use: 0}};
    if (file.is_win||file.is_darwin)
        return res;
    let pids = opt.pids||E.ps();
    if (!pids.length)
        return res;
    let calc = (o, m)=>o<0 ? 0 : 100*o/m;
    let ln = file.read_line('/proc/sys/fs/file-nr').split('\t');
    if (ln.length==3)
    {
        res.glob.open = +ln[0];
        res.glob.max = +ln[2];
    }
    res.use = res.glob.use = calc(res.glob.open, res.glob.max);
    for (let pid of pids)
    {
        pid = ''+pid;
        let dir = `/proc/${pid}/fd`;
        let open = yield efile.readdir(dir);
        let nopen = efile.error ? -1 : open.length;
        let ln_re = cyg_read('/proc/'+pid+'/limits'), nmax = -1, m;
        if (m = /Max open files\s+([0-9]+)/g.exec(ln_re))
            nmax = +m[1];
        if (!nmax)
            continue;
        let use = calc(nopen, nmax);
        if (res.use<use)
        {
            res.use = use;
            res.pid = +pid;
            let status = cyg_read(`/proc/${pid}/status`);
            if (m = /^Name:\t(.*)/.exec(status))
                res.name = m[1];
        }
        if (nopen>0 && opt.match)
        {
            res.match = res.match||0;
            for (let f of open)
            {
                let link = yield efile.readlink(`${dir}/${f}`);
                if (opt.match.test(link))
                    res.match++;
            }
        }
        res.pids[pid] = {open: nopen, max: nmax, use: use};
    }
    if (res.match)
        res.match = calc(res.match, res.glob.max);
    return res;
});

E.systemd_analyze = (type, args=[])=>{
    args = [].concat(args);
    return exec.get(`systemd-analyze ${type} ${args.join(' ')}`,
        {out: 'stdout', stdio: 'pipe'});
};

const PAGESIZE = 4096;

const parse_pid_stat = stat=>{
    if (!stat)
        return {};
    let res = stat.match(/^(\d+)\s+\(([^)]*)\)\s+(.*)\n?$/);
    if (!res)
        return {};
    let fields = res[3].split(' ');
    return {pid: +res[1], name: res[2], rss: +(fields[21]||0)*PAGESIZE};
};

const proc_mem = pid=>parse_pid_stat(cyg_read('/proc/'+pid+'/stat'));

E.ps_mem = ()=>E.ps().map(p=>proc_mem(p));

E.conntrack = function(){
    const count = +cyg_read('/proc/sys/net/netfilter/nf_conntrack_count');
    const max = +cyg_read('/proc/sys/net/netfilter/nf_conntrack_max');
    return {count, max, use: Math.round(count*100/max)};
};
