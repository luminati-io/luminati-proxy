// LICENSE_CODE ZON
'use strict'; /*jslint node:true, browser:true, es6:true*/
(function(){
var define;
var is_node_ff = typeof module=='object' && module.exports;
var is_rn = typeof global=='object' && !!global.nativeRequire ||
    typeof navigator=='object' && navigator.product=='ReactNative';
if (is_rn)
{
    define = require('./require_node.js').define(module, '../',
        require('lodash'), require('/util/events.js'));
}
else if (!is_node_ff)
    define = self.define;
else
    define = require('./require_node.js').define(module, '../');
define(['lodash', 'events'], (_, EventEmitter)=>{

const RECURSIVE = '.';

const E = new EventEmitter();
E.state = {};

E.on = (path, fn, opt)=>{
    opt = _.assign({recursive: false, init: true}, opt);
    EventEmitter.prototype.on.call(E, path, fn);
    if (opt.recursive)
        EventEmitter.prototype.on.call(E, RECURSIVE+path, fn);
    if (opt.init)
        fn(E.get(path));
    return {path, fn, recursive: opt.recursive};
};

E.once = (path, fn, opt)=>{
    let listener;
    listener = E.on(path, (...args)=>{
        E.off(listener);
        return fn(...args);
    }, _.assign({init: false}, opt));
};

E.off = listener=>{
    EventEmitter.prototype.removeListener.call(E, listener.path, listener.fn);
    if (listener.recursive)
    {
        EventEmitter.prototype.removeListener
            .call(E, RECURSIVE+listener.path, listener.fn);
    }
};

E.get = path=>_.get(E.state, path);

E.set = (path, curr, opt)=>{
    opt = _.assign({force_emit: false}, opt);
    if (!opt.force_emit && _.get(E.state, path)===curr)
        return;
    _.set(E.state, path, curr);
    let depth = opt.recursive ? Number.POSITIVE_INFINITY : opt.depth||0;
    let _path;
    do {
        _path = path;
        E.emit_path(_path);
        if (depth--<=0)
            return;
        path = path.replace(/\.[^.]+$/, '');
    } while (_path!=path);
};

E.delete = path=>E.set(path, undefined);

E.emit_path = path=>{
    E.emit(path, _.get(E.state, path));
    path = path.split('.');
    while (path.length>1)
    {
        path.pop();
        let p = path.join('.');
        E.emit(RECURSIVE+p, _.get(E.state, p));
    }
};

E.clear = function(){
    this.removeAllListeners();
    this.state = {};
};

E.debug = function(){
    window.setdb = E;
};

return E;

}); }());
