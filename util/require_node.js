// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, browser:true*/
var is_node = typeof module=='object' && module.exports && module.children;
var is_rn = (typeof global=='object' && !!global.nativeRequire) ||
    (typeof navigator=='object' && navigator.product=='ReactNative');
if (is_rn)
{
    // in react native, module resolution is done in compile-time so we must do
    // require('dep') and not require(dep) even if dep=='dep' in runtime
    // rel_root is not used, it's there for compatability with the signature in
    // node and ff
    exports.define = function(_module, rel_root/*, deps*/){
        var deps = Array.prototype.slice.call(arguments, 2);
        return function(name, req, setup){
            if (arguments.length==2)
            {
                setup = req;
                req = name;
            }
            _module.exports = setup.apply(this, deps);
        };
    };
}
else
{
    if (is_node)
        require('./config.js');
    var opt = exports.opt = {};
    exports.define = function(_module, rel_root){
        return function(name, req, setup){
            if (arguments.length==2)
            {
                setup = req;
                req = name;
            }
            _module.exports = setup.apply(this, req.map(function(dep){
                var ex;
                if (opt.on_require && (ex = opt.on_require(dep)))
                    return ex;
                // XXX odin: react native bundler syntax error when require()
                // not string literal -> workaround.
                var _require = require;
                if (!dep||/https?:\/\//.test(dep))
                    return null;
                if (/^\.?\.?\//.test(dep)) // './' '../' '/'
                    return _require(/* brd-build-deps ignore */rel_root+dep);
                return _require(/* brd-build-deps ignore */dep);
            }));
        };
    };
}
