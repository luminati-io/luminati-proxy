// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/
const etask = require('../util/etask.js');
const child_process = require('child_process');
const log = require('./log.js');

module.exports = ReqProcess;

// batch load of pid/name of incoming request sockets
function ReqProcess(opt){
    this.log = log(`${opt.listen_port}:req_process`, opt.log);
    this.is_wait = true;
    this.error = false;
    this.queue = {};
    this.req_process_sp = this._loop();
}

ReqProcess.prototype.add = function(req){
    const remote = req.socket.remoteAddress+':'+req.socket.remotePort;
    if (!this.queue[remote])
        this.queue[remote] = [];
    this.queue[remote].push(req);
    if (this.is_wait)
    {
        this.is_wait = false;
        this.req_process_sp.continue();
    }
};

ReqProcess.prototype._loop = etask._fn(function*req_process_loop(_this){
    while (!this.error){
        if (_this.is_wait)
            yield this.wait();
        yield etask.sleep(50);
        let queue = _this.queue;
        _this.queue = {};
        const netstat_cmd = 'netstat -ntp 2>/dev/null';
        try {
            // although this function is asynchronous, it still blocks event
            // loop for 10-15ms
            const data = yield etask.nfn_apply(child_process, '.exec',
                [netstat_cmd, {maxBuffer: 2000*1024}]);
            let lines = data.split('\n');
            lines = lines.map(s=>s.replace(/\s+/g, ' ').split(' '));
            lines.forEach(parts=>{
                const reqs = queue[parts[3]];
                if (!reqs||!reqs.length)
                    return;
                reqs.forEach((req, i)=>{
                    req.process = parts&&parts[6];
                    reqs.splice(i, 1);
                });
            });
        } catch(e){
            _this.log.warn("Can't get incoming request pid/process: %s",
                e.message);
            _this.error = true;
        }
        // if new reqs were added while we were processing previous - repeat
        // loop w/o wait
        _this.is_wait = !Object.keys(_this.queue).length;
    }
});
