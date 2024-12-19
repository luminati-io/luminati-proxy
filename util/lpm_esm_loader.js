// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true, es9: true*/
const Module = require('module').Module;
const babel = require('@babel/core');

const transform = filename=>babel.transformFileSync(filename, {
    plugins: [
        require.resolve('@babel/plugin-transform-export-namespace-from'),
        require.resolve('@babel/plugin-transform-modules-commonjs'),
    ],
});

const get_loaders = ()=>({
    js_loader: Module._extensions['.js'],
    mjs_loader: Module._extensions['.mjs'],
});

const apply_loaders = (js, mjs)=>{
    Module._extensions['.js'] = js;
    Module._extensions['.mjs'] = mjs||js;
};

const make_loader = orig=>(mod, filename)=>{
    try {
        return orig(mod, filename);
    } catch(e){
        if (e.code==='ERR_REQUIRE_ESM')
            mod._compile(transform(filename).code, filename);
        else
            throw e;
    }
};

module.exports = {
	require: (...args)=>{
        const {js_loader, mjs_loader} = get_loaders();
        let new_loader = make_loader(js_loader);
        apply_loaders(new_loader);
		let required = require(...args);
        apply_loaders(js_loader, mjs_loader);
		return required;
	},
};
