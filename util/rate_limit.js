// LICENSE_CODE ZON ISC
'use strict'; /*zlint node, br*/
(function(){
var define;
var is_node = typeof module=='object' && module.exports && module.children;
var is_rn = (typeof global=='object' && !!global.nativeRequire) ||
    (typeof navigator=='object' && navigator.product=='ReactNative');
if (!is_node && !is_rn)
    define = self.define;
else
    define = require('./require_node.js').define(module, '../');
define([], function(){
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

E.leaky_bucket.prototype._update_level = function(){
    var now = Date.now();
    this.level -= this.rate * (now - this.time);
    this.time = now;
    if (this.level<0)
        this.level = 0;
};

E.leaky_bucket.prototype.inc_would_exceed = function(inc){
    if (inc===undefined)
        inc = 1;
    this._update_level();
    var new_level = this.level + inc;
    return new_level>this.size;
};

E.leaky_bucket.prototype.inc = function(inc){
    if (inc===undefined)
        inc = 1;
    this._update_level();
    var new_level = this.level + inc;
    if (new_level>this.size)
        return false;
    this.level = new_level;
    return true;
};

return E; }); }());
